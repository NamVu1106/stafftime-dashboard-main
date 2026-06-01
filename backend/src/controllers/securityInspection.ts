import { Response } from 'express';
import { query, queryOne, exec } from '../db/sqlServer';
import type { AuthRequest } from '../middleware/auth';
import { persistInspectionPhoto } from '../utils/securityPhotos';

type DeptRow = {
  id: number;
  code: string;
  name: string;
  color: string;
  sort_order: number;
};

type CatRow = { id: number; department_id: number; name: string; sort_order: number };
type ItemRow = {
  id: number;
  category_id: number;
  label: string;
  requires_photo_on_fail: number;
  sort_order: number;
};

function nowIso() {
  return new Date().toISOString();
}

/** GET /departments — dashboard cards + tiến độ ca */
export async function getSecurityDepartments(_req: AuthRequest, res: Response) {
  try {
    const depts = await query<DeptRow>(
      'SELECT id, code, name, color, sort_order FROM dbo.sec_departments WHERE is_active = 1 ORDER BY sort_order'
    );
    const stats = await query<{ department_id: number; submitted: number; draft: number }>(`
      SELECT department_id,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft
      FROM dbo.sec_inspections
      WHERE created_at >= CONVERT(NVARCHAR(10), GETDATE(), 23)
      GROUP BY department_id
    `);
    const map = new Map(stats.map((s) => [s.department_id, s]));
    const data = depts.map((d) => {
      const s = map.get(d.id);
      const submitted = s?.submitted ?? 0;
      const draft = s?.draft ?? 0;
      const total = submitted + draft;
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        color: d.color,
        progressPercent: total > 0 ? Math.round((submitted / total) * 100) : 0,
        submittedToday: submitted,
        draftToday: draft,
      };
    });
    res.json({ data });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /departments/:id/template */
export async function getDepartmentTemplate(req: AuthRequest, res: Response) {
  try {
    const deptId = Number(req.params.id);
    const dept = await queryOne<DeptRow>(
      'SELECT id, code, name, color, sort_order FROM dbo.sec_departments WHERE id = @id AND is_active = 1',
      { id: deptId }
    );
    if (!dept) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }
    const categories = await query<CatRow>(
      'SELECT id, department_id, name, sort_order FROM dbo.sec_categories WHERE department_id = @dept ORDER BY sort_order',
      { dept: deptId }
    );
    const items = await query<ItemRow>(`
      SELECT i.id, i.category_id, i.label, i.requires_photo_on_fail, i.sort_order
      FROM dbo.sec_check_items i
      INNER JOIN dbo.sec_categories c ON c.id = i.category_id
      WHERE c.department_id = @dept
      ORDER BY c.sort_order, i.sort_order
    `, { dept: deptId });
    const itemsByCat = new Map<number, ItemRow[]>();
    for (const item of items) {
      const list = itemsByCat.get(item.category_id) ?? [];
      list.push(item);
      itemsByCat.set(item.category_id, list);
    }
    res.json({
      department: dept,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        items: (itemsByCat.get(c.id) ?? []).map((i) => ({
          id: i.id,
          label: i.label,
          requiresPhotoOnFail: !!i.requires_photo_on_fail,
        })),
      })),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /assets/resolve?qr= */
export async function resolveAssetByQr(req: AuthRequest, res: Response) {
  try {
    const qr = String(req.query.qr ?? '').trim();
    if (!qr) {
      res.status(400).json({ error: 'qr required' });
      return;
    }
    const asset = await queryOne<{
      id: number;
      department_id: number;
      qr_code: string;
      name: string;
      asset_type: string;
    }>(
      `SELECT a.id, a.department_id, a.qr_code, a.name, a.asset_type
       FROM dbo.sec_assets a
       WHERE a.qr_code = @qr AND a.is_active = 1`,
      { qr }
    );
    if (!asset) {
      res.status(404).json({ error: 'QR not found' });
      return;
    }
    const dept = await queryOne<DeptRow>(
      'SELECT id, code, name, color, sort_order FROM dbo.sec_departments WHERE id = @id',
      { id: asset.department_id }
    );
    res.json({ asset, department: dept });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

type ResultPayload = {
  itemId: number;
  status: 'pass' | 'fail' | 'skip';
  note?: string;
  /** data URL (offline) hoặc /uploads/... — server chuyển thành file + photo_url */
  photoData?: string;
  photoUrl?: string;
};

type InspectionPayload = {
  clientId: string;
  departmentId: number;
  assetId: number;
  shiftLabel?: string;
  status?: 'draft' | 'submitted';
  signatureData?: string;
  notes?: string;
  results: ResultPayload[];
};

async function upsertInspection(body: InspectionPayload, username?: string) {
  const ts = nowIso();
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM dbo.sec_inspections WHERE client_id = @cid',
    { cid: body.clientId }
  );

  let inspectionId: number;
  if (existing?.id) {
    inspectionId = existing.id;
    await exec(
      `UPDATE dbo.sec_inspections SET
        department_id = @dept, asset_id = @asset, shift_label = @shift,
        status = @status, signature_data = @sig, notes = @notes, updated_at = @ts,
        submitted_at = CASE WHEN @status = 'submitted' THEN @ts ELSE submitted_at END
       WHERE id = @id`,
      {
        id: inspectionId,
        dept: body.departmentId,
        asset: body.assetId,
        shift: body.shiftLabel ?? '',
        status: body.status ?? 'draft',
        sig: body.signatureData ?? null,
        notes: body.notes ?? null,
        ts,
      }
    );
    await exec('DELETE FROM dbo.sec_inspection_results WHERE inspection_id = @id', {
      id: inspectionId,
    });
  } else {
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO dbo.sec_inspections
        (client_id, department_id, asset_id, inspector_username, shift_label, status, signature_data, notes, created_at, updated_at, submitted_at)
       OUTPUT INSERTED.id
       VALUES (@cid, @dept, @asset, @user, @shift, @status, @sig, @notes, @ts, @ts,
         CASE WHEN @status = 'submitted' THEN @ts ELSE NULL END)`,
      {
        cid: body.clientId,
        dept: body.departmentId,
        asset: body.assetId,
        user: username ?? '',
        shift: body.shiftLabel ?? '',
        status: body.status ?? 'draft',
        sig: body.signatureData ?? null,
        notes: body.notes ?? null,
        ts,
      }
    );
    inspectionId = inserted!.id;
  }

  for (const r of body.results) {
    const photoUrl =
      r.photoUrl ?? persistInspectionPhoto(r.photoData) ?? null;
    await exec(
      `INSERT INTO dbo.sec_inspection_results (inspection_id, item_id, status, note, photo_data, photo_url)
       VALUES (@insp, @item, @st, @note, NULL, @photoUrl)`,
      {
        insp: inspectionId,
        item: r.itemId,
        st: r.status,
        note: r.note ?? null,
        photoUrl,
      }
    );
  }
  return inspectionId;
}

/** POST /inspections */
export async function saveInspection(req: AuthRequest, res: Response) {
  try {
    const body = req.body as InspectionPayload;
    if (!body?.clientId || !body.departmentId || !body.assetId || !Array.isArray(body.results)) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const id = await upsertInspection(body, req.user?.username);
    res.json({ ok: true, id, clientId: body.clientId });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** POST /inspections/submit */
export async function submitInspection(req: AuthRequest, res: Response) {
  try {
    const body = req.body as InspectionPayload;
    body.status = 'submitted';
    if (!body.signatureData) {
      res.status(400).json({ error: 'signature required' });
      return;
    }
    const fails = body.results.filter((r) => r.status === 'fail');
    for (const f of fails) {
      const item = await queryOne<{ requires_photo_on_fail: number }>(
        'SELECT requires_photo_on_fail FROM dbo.sec_check_items WHERE id = @id',
        { id: f.itemId }
      );
      if (item?.requires_photo_on_fail && !f.photoData && !f.photoUrl) {
        res.status(400).json({ error: `Photo required for failed item ${f.itemId}` });
        return;
      }
    }
    const id = await upsertInspection(body, req.user?.username);
    res.json({ ok: true, id, clientId: body.clientId });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** POST /sync — batch offline */
export async function syncInspections(req: AuthRequest, res: Response) {
  try {
    const list = (req.body?.inspections ?? []) as InspectionPayload[];
    if (!Array.isArray(list)) {
      res.status(400).json({ error: 'inspections array required' });
      return;
    }
    const ids: number[] = [];
    for (const item of list) {
      const id = await upsertInspection(item, req.user?.username);
      ids.push(id);
    }
    res.json({ ok: true, synced: ids.length, ids });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /reports/dashboard — báo cáo quản lý (hôm nay) */
export async function getSecurityManagementDashboard(_req: AuthRequest, res: Response) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const departments = await query<{
      department_id: number;
      department_name: string;
      color: string;
      total_machines: number;
      checked_count: number;
      fail_count: number;
    }>(`
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        d.color,
        (SELECT COUNT(1) FROM dbo.sec_assets a WHERE a.department_id = d.id AND a.is_active = 1) AS total_machines,
        ISNULL(ch.checked_count, 0) AS checked_count,
        ISNULL(fl.fail_count, 0) AS fail_count
      FROM dbo.sec_departments d
      LEFT JOIN (
        SELECT department_id, COUNT(DISTINCT asset_id) AS checked_count
        FROM dbo.sec_inspections
        WHERE status = N'submitted'
          AND created_at >= @today
        GROUP BY department_id
      ) ch ON ch.department_id = d.id
      LEFT JOIN (
        SELECT i.department_id, SUM(CASE WHEN r.status = N'fail' THEN 1 ELSE 0 END) AS fail_count
        FROM dbo.sec_inspections i
        INNER JOIN dbo.sec_inspection_results r ON r.inspection_id = i.id
        WHERE i.status = N'submitted' AND i.created_at >= @today
        GROUP BY i.department_id
      ) fl ON fl.department_id = d.id
      WHERE d.is_active = 1
      ORDER BY d.sort_order
    `, { today });

    const rows = departments.map((row) => ({
      ...row,
      unchecked_count: Math.max(0, row.total_machines - row.checked_count),
    }));

    const statusPie = await query<{ status: string; count: number }>(`
      SELECT r.status, COUNT(1) AS count
      FROM dbo.sec_inspection_results r
      INNER JOIN dbo.sec_inspections i ON i.id = r.inspection_id
      WHERE i.status = N'submitted' AND i.created_at >= @today
      GROUP BY r.status
    `, { today });

    res.json({
      date: today,
      departments: rows,
      statusPie: statusPie.map((s) => ({
        name: s.status,
        value: s.count,
      })),
      totals: {
        machines: rows.reduce((n, r) => n + r.total_machines, 0),
        checked: rows.reduce((n, r) => n + r.checked_count, 0),
        unchecked: rows.reduce((n, r) => n + r.unchecked_count, 0),
        failures: rows.reduce((n, r) => n + r.fail_count, 0),
      },
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /reports/summary — tương thích cũ */
export async function getSecurityReportSummary(_req: AuthRequest, res: Response) {
  return getSecurityManagementDashboard(_req, res);
}
