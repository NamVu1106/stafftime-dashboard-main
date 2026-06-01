import { Response } from 'express';
import ExcelJS from 'exceljs';
import { query, queryOne, exec } from '../db/sqlServer';
import type { AuthRequest } from '../middleware/auth';
import {
  assertDeptAccess,
  canAccessDepartment,
  deptSqlFilter,
  loadSecurityScope,
} from '../middleware/securityPermission';
import { persistInspectionPhoto } from '../utils/securityPhotos';

function parseDateRange(req: AuthRequest): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  const from = String(req.query.from ?? today).slice(0, 10);
  const to = String(req.query.to ?? from).slice(0, 10);
  return from <= to ? { from, to } : { from: to, to: from };
}

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
  input_type: string;
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
};

function mapCheckItem(i: ItemRow) {
  const inputType = (i.input_type || 'boolean').toLowerCase();
  return {
    id: i.id,
    label: i.label,
    requiresPhotoOnFail: !!i.requires_photo_on_fail,
    inputType: inputType === 'number' ? 'number' : 'boolean',
    minValue: i.min_value,
    maxValue: i.max_value,
    unit: i.unit,
  };
}

function isWithinThreshold(
  value: number,
  min: number | null,
  max: number | null
): boolean {
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function nowIso() {
  return new Date().toISOString();
}

/** GET /me/scope — phạm vi bộ phận của user */
export async function getMySecurityScope(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const scope = req.securityScope ?? (await loadSecurityScope(req.user));
    res.json({
      isAdmin: scope.isAdmin,
      departmentIds: scope.departmentIds ?? [],
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /departments — dashboard cards + tiến độ ca */
export async function getSecurityDepartments(req: AuthRequest, res: Response) {
  try {
    const scope = req.securityScope!;
    const { clause, params } = deptSqlFilter(scope, 'id');
    const depts = await query<DeptRow>(
      `SELECT id, code, name, color, sort_order FROM dbo.sec_departments
       WHERE is_active = 1 AND ${clause}
       ORDER BY sort_order`,
      params
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
    if (!assertDeptAccess(req, res, deptId)) return;
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
      SELECT i.id, i.category_id, i.label, i.requires_photo_on_fail, i.sort_order,
        ISNULL(i.input_type, N'boolean') AS input_type,
        i.min_value, i.max_value, i.unit
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
        items: (itemsByCat.get(c.id) ?? []).map(mapCheckItem),
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
    if (!assertDeptAccess(req, res, asset.department_id)) return;
    const dept = await queryOne<DeptRow>(
      'SELECT id, code, name, color, sort_order FROM dbo.sec_departments WHERE id = @id',
      { id: asset.department_id }
    );

    const lastInsp = await queryOne<{
      id: number;
      created_at: string;
      inspector_username: string;
    }>(`
      SELECT TOP 1 id, created_at, inspector_username
      FROM dbo.sec_inspections
      WHERE asset_id = @aid AND status = N'submitted'
      ORDER BY created_at DESC
    `, { aid: asset.id });

    let lastInspection: {
      date: string;
      inspector: string;
      failItems: { label: string; note: string | null }[];
    } | null = null;

    if (lastInsp?.id) {
      const failItems = await query<{ label: string; note: string | null }>(`
        SELECT ci.label, r.note
        FROM dbo.sec_inspection_results r
        INNER JOIN dbo.sec_check_items ci ON ci.id = r.item_id
        WHERE r.inspection_id = @iid AND r.status = N'fail'
      `, { iid: lastInsp.id });
      lastInspection = {
        date: lastInsp.created_at.slice(0, 10),
        inspector: lastInsp.inspector_username,
        failItems,
      };
    }

    res.json({ asset, department: dept, lastInspection });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

type ResultPayload = {
  itemId: number;
  status: 'pass' | 'fail' | 'skip';
  note?: string;
  numericValue?: number;
  /** data URL (offline) hoặc /uploads/... — server chuyển thành file + photo_url */
  photoData?: string;
  photoUrl?: string;
};

type ItemRuleRow = {
  input_type: string;
  min_value: number | null;
  max_value: number | null;
  requires_photo_on_fail: number;
};

async function validateInspectionResults(results: ResultPayload[]): Promise<string | null> {
  for (const r of results) {
    const item = await queryOne<ItemRuleRow>(
      `SELECT ISNULL(input_type, N'boolean') AS input_type, min_value, max_value, requires_photo_on_fail
       FROM dbo.sec_check_items WHERE id = @id`,
      { id: r.itemId }
    );
    if (!item) return `Unknown item ${r.itemId}`;

    const inputType = (item.input_type || 'boolean').toLowerCase();
    if (inputType === 'number' && r.status !== 'skip') {
      if (r.numericValue == null || Number.isNaN(Number(r.numericValue))) {
        return `Numeric value required for item ${r.itemId}`;
      }
      const num = Number(r.numericValue);
      const inRange = isWithinThreshold(num, item.min_value, item.max_value);
      const expectedStatus = inRange ? 'pass' : 'fail';
      if (r.status !== expectedStatus) {
        return `Item ${r.itemId} status must be ${expectedStatus} for value ${num}`;
      }
      if (r.status === 'fail' && item.requires_photo_on_fail && !r.photoData && !r.photoUrl) {
        return `Photo required for out-of-range item ${r.itemId}`;
      }
    }
  }
  return null;
}

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

async function upsertInspection(
  body: InspectionPayload,
  username?: string,
  scope?: { departmentIds: number[] | null; isAdmin: boolean }
) {
  if (scope && !scope.isAdmin && scope.departmentIds !== null) {
    if (!scope.departmentIds.includes(body.departmentId)) {
      throw new Error('Forbidden department');
    }
  }
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
      `INSERT INTO dbo.sec_inspection_results (inspection_id, item_id, status, note, photo_data, photo_url, numeric_value)
       VALUES (@insp, @item, @st, @note, NULL, @photoUrl, @num)`,
      {
        insp: inspectionId,
        item: r.itemId,
        st: r.status,
        note: r.note ?? null,
        photoUrl,
        num: r.numericValue ?? null,
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
    if (!assertDeptAccess(req, res, body.departmentId)) return;
    const id = await upsertInspection(body, req.user?.username, req.securityScope);
    res.json({ ok: true, id, clientId: body.clientId });
  } catch (e: unknown) {
    const msg = (e as Error).message;
    res.status(msg.includes('Forbidden') ? 403 : 500).json({ error: msg });
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
    const validationError = await validateInspectionResults(body.results);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const fails = body.results.filter((r) => r.status === 'fail');
    for (const f of fails) {
      const item = await queryOne<{ requires_photo_on_fail: number; input_type: string }>(
        "SELECT requires_photo_on_fail, ISNULL(input_type, N'boolean') AS input_type FROM dbo.sec_check_items WHERE id = @id",
        { id: f.itemId }
      );
      if (item?.requires_photo_on_fail && !f.photoData && !f.photoUrl) {
        res.status(400).json({ error: `Photo required for failed item ${f.itemId}` });
        return;
      }
    }
    if (!assertDeptAccess(req, res, body.departmentId)) return;
    const id = await upsertInspection(body, req.user?.username, req.securityScope);
    res.json({ ok: true, id, clientId: body.clientId });
  } catch (e: unknown) {
    const msg = (e as Error).message;
    res.status(msg.includes('Forbidden') ? 403 : 500).json({ error: msg });
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
      if (
        req.securityScope &&
        !canAccessDepartment(req.securityScope, item.departmentId)
      ) {
        res.status(403).json({ error: `No access to department ${item.departmentId}` });
        return;
      }
      const id = await upsertInspection(item, req.user?.username, req.securityScope);
      ids.push(id);
    }
    res.json({ ok: true, synced: ids.length, ids });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /reports/dashboard — báo cáo quản lý (lọc bộ phận + khoảng ngày) */
export async function getSecurityManagementDashboard(req: AuthRequest, res: Response) {
  try {
    const scope = req.securityScope!;
    const { from, to } = parseDateRange(req);
    const { clause, params: deptParams } = deptSqlFilter(scope, 'd.id');
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
          AND created_at >= @from AND created_at < DATEADD(day, 1, CAST(@to AS DATE))
        GROUP BY department_id
      ) ch ON ch.department_id = d.id
      LEFT JOIN (
        SELECT i.department_id, SUM(CASE WHEN r.status = N'fail' THEN 1 ELSE 0 END) AS fail_count
        FROM dbo.sec_inspections i
        INNER JOIN dbo.sec_inspection_results r ON r.inspection_id = i.id
        WHERE i.status = N'submitted'
          AND i.created_at >= @from AND i.created_at < DATEADD(day, 1, CAST(@to AS DATE))
        GROUP BY i.department_id
      ) fl ON fl.department_id = d.id
      WHERE d.is_active = 1 AND ${clause}
      ORDER BY d.sort_order
    `, { from, to, ...deptParams });

    const rows = departments.map((row) => ({
      ...row,
      unchecked_count: Math.max(0, row.total_machines - row.checked_count),
    }));

    const pieDept = deptSqlFilter(scope, 'i.department_id');
    const statusPie = await query<{ status: string; count: number }>(`
      SELECT r.status, COUNT(1) AS count
      FROM dbo.sec_inspection_results r
      INNER JOIN dbo.sec_inspections i ON i.id = r.inspection_id
      WHERE i.status = N'submitted'
        AND i.created_at >= @from AND i.created_at < DATEADD(day, 1, CAST(@to AS DATE))
        AND ${pieDept.clause}
      GROUP BY r.status
    `, { from, to, ...pieDept.params });

    res.json({
      from,
      to,
      scope: scope.isAdmin ? 'all' : 'departments',
      departmentIds: scope.departmentIds ?? [],
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
export async function getSecurityReportSummary(req: AuthRequest, res: Response) {
  return getSecurityManagementDashboard(req, res);
}

/** GET /reports/export — Excel lỗi phát hiện */
export async function exportSecurityReport(req: AuthRequest, res: Response) {
  try {
    const scope = req.securityScope!;
    const { from, to } = parseDateRange(req);
    const { clause, params: deptParams } = deptSqlFilter(scope, 'd.id');

    const rows = await query<{
      inspection_date: string;
      department_name: string;
      qr_code: string;
      asset_name: string;
      item_label: string;
      note: string;
      numeric_value: number | null;
      photo_url: string;
      inspector_username: string;
      shift_label: string;
    }>(`
      SELECT
        LEFT(i.created_at, 10) AS inspection_date,
        d.name AS department_name,
        a.qr_code,
        a.name AS asset_name,
        ci.label AS item_label,
        r.note,
        r.numeric_value,
        COALESCE(r.photo_url, r.photo_data) AS photo_url,
        i.inspector_username,
        i.shift_label
      FROM dbo.sec_inspection_results r
      INNER JOIN dbo.sec_inspections i ON i.id = r.inspection_id
      INNER JOIN dbo.sec_departments d ON d.id = i.department_id
      INNER JOIN dbo.sec_assets a ON a.id = i.asset_id
      INNER JOIN dbo.sec_check_items ci ON ci.id = r.item_id
      WHERE r.status = N'fail'
        AND i.status = N'submitted'
        AND i.created_at >= @from AND i.created_at < DATEADD(day, 1, CAST(@to AS DATE))
        AND ${clause}
      ORDER BY i.created_at DESC, d.name, a.qr_code
    `, { from, to, ...deptParams });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Loi phat hien');
    ws.columns = [
      { header: 'Ngày', key: 'inspection_date', width: 12 },
      { header: 'Bộ phận', key: 'department_name', width: 22 },
      { header: 'Mã QR', key: 'qr_code', width: 18 },
      { header: 'Thiết bị', key: 'asset_name', width: 24 },
      { header: 'Hạng mục lỗi', key: 'item_label', width: 28 },
      { header: 'Giá trị đo', key: 'numeric_value', width: 12 },
      { header: 'Mô tả', key: 'note', width: 32 },
      { header: 'Ảnh (URL)', key: 'photo_url', width: 40 },
      { header: 'Người kiểm tra', key: 'inspector_username', width: 16 },
      { header: 'Ca', key: 'shift_label', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const row of rows) {
      ws.addRow(row);
    }

    const filename = `bao-cao-an-ninh_${from}_${to}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}
