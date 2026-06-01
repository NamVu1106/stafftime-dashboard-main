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
import { toFlatChecklistJson } from '../utils/checklistTemplateJson';
import { toDbStatus, phienTrangThaiGui, phienTrangThaiNhap } from '../security/statusCodec';

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

type CatRow = { id: number; bo_phan_id: number; ten_nhom: string; thu_tu: number };
export type ItemRow = {
  id: number;
  nhom_id: number;
  noi_dung: string;
  yeu_cau_an_loi: number;
  thu_tu: number;
  kieu_du_lieu: string;
  nguong_min: number | null;
  nguong_max: number | null;
  don_vi: string | null;
};

export function mapCheckItem(i: ItemRow) {
  const inputType = (i.kieu_du_lieu || 'boolean').toLowerCase();
  return {
    id: i.id,
    label: i.noi_dung,
    requiresPhotoOnFail: !!i.yeu_cau_an_loi,
    inputType: inputType === 'number' ? 'number' : 'boolean',
    minValue: i.nguong_min,
    maxValue: i.nguong_max,
    unit: i.don_vi,
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
      `SELECT id, ma_bo_phan AS code, ten_bo_phan AS name, mau_sac AS color, thu_tu AS sort_order
       FROM dbo.BoPhan
       WHERE dang_hoat_dong = 1 AND ${clause}
       ORDER BY thu_tu`,
      params
    );
    const stats = await query<{ department_id: number; submitted: number; draft: number }>(`
      SELECT bo_phan_id AS department_id,
        SUM(CASE WHEN trang_thai_phien = N'da_gui' THEN 1 ELSE 0 END) AS submitted,
        SUM(CASE WHEN trang_thai_phien = N'nhap' THEN 1 ELSE 0 END) AS draft
      FROM dbo.PhienKiemTra
      WHERE tao_luc >= CONVERT(NVARCHAR(10), GETDATE(), 23)
      GROUP BY bo_phan_id
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
      `SELECT id, ma_bo_phan AS code, ten_bo_phan AS name, mau_sac AS color, thu_tu AS sort_order
       FROM dbo.BoPhan WHERE id = @id AND dang_hoat_dong = 1`,
      { id: deptId }
    );
    if (!dept) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }
    const categories = await query<CatRow>(
      'SELECT id, bo_phan_id, ten_nhom, thu_tu FROM dbo.NhomHangMuc WHERE bo_phan_id = @dept ORDER BY thu_tu',
      { dept: deptId }
    );
    const items = await query<ItemRow>(`
      SELECT i.id, i.nhom_id, i.noi_dung, i.yeu_cau_an_loi, i.thu_tu,
        ISNULL(i.kieu_du_lieu, N'boolean') AS kieu_du_lieu,
        i.nguong_min, i.nguong_max, i.don_vi
      FROM dbo.HangMucKiemTra i
      INNER JOIN dbo.NhomHangMuc c ON c.id = i.nhom_id
      WHERE c.bo_phan_id = @dept
      ORDER BY c.thu_tu, i.thu_tu
    `, { dept: deptId });
    const itemsByCat = new Map<number, ItemRow[]>();
    for (const item of items) {
      const list = itemsByCat.get(item.nhom_id) ?? [];
      list.push(item);
      itemsByCat.set(item.nhom_id, list);
    }
    const categoryPayload = categories.map((c) => ({
      id: c.id,
      name: c.ten_nhom,
      items: (itemsByCat.get(c.id) ?? []).map(mapCheckItem),
    }));

    if (String(req.query.format ?? '').toLowerCase() === 'flat') {
      res.json(toFlatChecklistJson(dept, categoryPayload));
      return;
    }

    res.json({
      department: dept,
      categories: categoryPayload,
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
      `SELECT a.id, a.bo_phan_id AS department_id, a.ma_qr AS qr_code, a.ten_thiet_bi AS name, a.loai_thiet_bi AS asset_type
       FROM dbo.ThietBi a
       WHERE a.ma_qr = @qr AND a.dang_hoat_dong = 1`,
      { qr }
    );
    if (!asset) {
      res.status(404).json({ error: 'QR not found' });
      return;
    }
    if (!assertDeptAccess(req, res, asset.department_id)) return;
    const dept = await queryOne<DeptRow>(
      `SELECT id, ma_bo_phan AS code, ten_bo_phan AS name, mau_sac AS color, thu_tu AS sort_order
       FROM dbo.BoPhan WHERE id = @id`,
      { id: asset.department_id }
    );

    const lastInsp = await queryOne<{
      id: number;
      created_at: string;
      inspector_username: string;
    }>(`
      SELECT TOP 1 id, tao_luc AS created_at, nguoi_kiem_tra AS inspector_username
      FROM dbo.PhienKiemTra
      WHERE thiet_bi_id = @aid AND trang_thai_phien = N'da_gui'
      ORDER BY tao_luc DESC
    `, { aid: asset.id });

    let lastInspection: {
      date: string;
      inspector: string;
      failItems: { label: string; note: string | null }[];
    } | null = null;

    if (lastInsp?.id) {
      const failItems = await query<{ label: string; note: string | null }>(`
        SELECT h.noi_dung AS label, r.ghi_chu AS note
        FROM dbo.KetQuaKiemTra r
        INNER JOIN dbo.HangMucKiemTra h ON h.id = r.hang_muc_id
        WHERE r.phien_kiem_tra_id = @iid AND r.trang_thai = N'NOT_OK'
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
  kieu_du_lieu: string;
  nguong_min: number | null;
  nguong_max: number | null;
  yeu_cau_an_loi: number;
};

async function validateInspectionResults(results: ResultPayload[]): Promise<string | null> {
  for (const r of results) {
    const item = await queryOne<ItemRuleRow>(
      `SELECT ISNULL(kieu_du_lieu, N'boolean') AS kieu_du_lieu, nguong_min, nguong_max, yeu_cau_an_loi
       FROM dbo.HangMucKiemTra WHERE id = @id`,
      { id: r.itemId }
    );
    if (!item) return `Unknown item ${r.itemId}`;

    const inputType = (item.kieu_du_lieu || 'boolean').toLowerCase();
    if (inputType === 'number' && r.status !== 'skip') {
      if (r.numericValue == null || Number.isNaN(Number(r.numericValue))) {
        return `Numeric value required for item ${r.itemId}`;
      }
      const num = Number(r.numericValue);
      const inRange = isWithinThreshold(num, item.nguong_min, item.nguong_max);
      const expectedStatus = inRange ? 'pass' : 'fail';
      if (r.status !== expectedStatus) {
        return `Item ${r.itemId} status must be ${expectedStatus} for value ${num}`;
      }
      if (r.status === 'fail' && item.yeu_cau_an_loi && !r.photoData && !r.photoUrl) {
        return `Photo required for out-of-range item ${r.itemId}`;
      }
    }
    if (r.status === 'fail' && !String(r.note ?? '').trim()) {
      return `Note required for NOT OK item ${r.itemId}`;
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
  const phienStatus =
    body.status === 'submitted' ? phienTrangThaiGui() : phienTrangThaiNhap();
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM dbo.PhienKiemTra WHERE client_id = @cid',
    { cid: body.clientId }
  );

  let inspectionId: number;
  if (existing?.id) {
    inspectionId = existing.id;
    await exec(
      `UPDATE dbo.PhienKiemTra SET
        bo_phan_id = @dept, thiet_bi_id = @asset, ca_truc = @shift,
        trang_thai_phien = @st, chu_ky = @sig, ghi_chu_phien = @notes, cap_nhat_luc = @ts,
        gui_luc = CASE WHEN @st = N'da_gui' THEN @ts ELSE gui_luc END
       WHERE id = @id`,
      {
        id: inspectionId,
        dept: body.departmentId,
        asset: body.assetId,
        shift: body.shiftLabel ?? '',
        st: phienStatus,
        sig: body.signatureData ?? null,
        notes: body.notes ?? null,
        ts,
      }
    );
    await exec('DELETE FROM dbo.KetQuaKiemTra WHERE phien_kiem_tra_id = @id', {
      id: inspectionId,
    });
  } else {
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO dbo.PhienKiemTra
        (client_id, bo_phan_id, thiet_bi_id, nguoi_kiem_tra, ca_truc, trang_thai_phien, chu_ky, ghi_chu_phien, tao_luc, cap_nhat_luc, gui_luc)
       OUTPUT INSERTED.id
       VALUES (@cid, @dept, @asset, @user, @shift, @st, @sig, @notes, @ts, @ts,
         CASE WHEN @st = N'da_gui' THEN @ts ELSE NULL END)`,
      {
        cid: body.clientId,
        dept: body.departmentId,
        asset: body.assetId,
        user: username ?? '',
        shift: body.shiftLabel ?? '',
        st: phienStatus,
        sig: body.signatureData ?? null,
        notes: body.notes ?? null,
        ts,
      }
    );
    inspectionId = inserted!.id;
  }

  for (const r of body.results) {
    const photoUrl = r.photoUrl ?? persistInspectionPhoto(r.photoData) ?? null;
    await exec(
      `INSERT INTO dbo.KetQuaKiemTra
        (phien_kiem_tra_id, thiet_bi_id, hang_muc_id, trang_thai, ghi_chu, url_anh, gia_tri_do)
       VALUES (@insp, @asset, @item, @st, @note, @photoUrl, @num)`,
      {
        insp: inspectionId,
        asset: body.assetId,
        item: r.itemId,
        st: toDbStatus(r.status),
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
      if (!String(f.note ?? '').trim()) {
        res.status(400).json({ error: `Note required for NOT OK item ${f.itemId}` });
        return;
      }
      const item = await queryOne<{ yeu_cau_an_loi: number; kieu_du_lieu: string }>(
        "SELECT yeu_cau_an_loi, ISNULL(kieu_du_lieu, N'boolean') AS kieu_du_lieu FROM dbo.HangMucKiemTra WHERE id = @id",
        { id: f.itemId }
      );
      if (item?.yeu_cau_an_loi && !f.photoData && !f.photoUrl) {
        res.status(400).json({ error: `Photo required for NOT OK item ${f.itemId}` });
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
        d.ten_bo_phan AS department_name,
        d.mau_sac AS color,
        (SELECT COUNT(1) FROM dbo.ThietBi a WHERE a.bo_phan_id = d.id AND a.dang_hoat_dong = 1) AS total_machines,
        ISNULL(ch.checked_count, 0) AS checked_count,
        ISNULL(fl.fail_count, 0) AS fail_count
      FROM dbo.BoPhan d
      LEFT JOIN (
        SELECT bo_phan_id AS department_id, COUNT(DISTINCT thiet_bi_id) AS checked_count
        FROM dbo.PhienKiemTra
        WHERE trang_thai_phien = N'da_gui'
          AND tao_luc >= @from AND tao_luc < DATEADD(day, 1, CAST(@to AS DATE))
        GROUP BY bo_phan_id
      ) ch ON ch.department_id = d.id
      LEFT JOIN (
        SELECT i.bo_phan_id AS department_id, SUM(CASE WHEN r.trang_thai = N'NOT_OK' THEN 1 ELSE 0 END) AS fail_count
        FROM dbo.PhienKiemTra i
        INNER JOIN dbo.KetQuaKiemTra r ON r.phien_kiem_tra_id = i.id
        WHERE i.trang_thai_phien = N'da_gui'
          AND i.tao_luc >= @from AND i.tao_luc < DATEADD(day, 1, CAST(@to AS DATE))
        GROUP BY i.bo_phan_id
      ) fl ON fl.department_id = d.id
      WHERE d.dang_hoat_dong = 1 AND ${clause}
      ORDER BY d.thu_tu
    `, { from, to, ...deptParams });

    const rows = departments.map((row) => ({
      ...row,
      unchecked_count: Math.max(0, row.total_machines - row.checked_count),
    }));

    const pieDept = deptSqlFilter(scope, 'i.bo_phan_id');
    const statusPie = await query<{ status: string; count: number }>(`
      SELECT r.trang_thai AS status, COUNT(1) AS count
      FROM dbo.KetQuaKiemTra r
      INNER JOIN dbo.PhienKiemTra i ON i.id = r.phien_kiem_tra_id
      WHERE i.trang_thai_phien = N'da_gui'
        AND i.tao_luc >= @from AND i.tao_luc < DATEADD(day, 1, CAST(@to AS DATE))
        AND ${pieDept.clause}
      GROUP BY r.trang_thai
    `, { from, to, ...pieDept.params });

    const totals = {
      machines: rows.reduce((n, r) => n + r.total_machines, 0),
      checked: rows.reduce((n, r) => n + r.checked_count, 0),
      unchecked: rows.reduce((n, r) => n + r.unchecked_count, 0),
      failures: rows.reduce((n, r) => n + r.fail_count, 0),
    };
    const progressPercent =
      totals.machines > 0 ? Math.round((totals.checked / totals.machines) * 100) : 0;

    const alertDept = deptSqlFilter(scope, 'i.bo_phan_id');
    const openAlerts = await queryOne<{ n: number }>(`
      SELECT COUNT(1) AS n
      FROM dbo.KetQuaKiemTra r
      INNER JOIN dbo.PhienKiemTra i ON i.id = r.phien_kiem_tra_id
      WHERE r.trang_thai = N'NOT_OK' AND i.trang_thai_phien = N'da_gui' AND r.thoi_gian_xu_ly IS NULL
        AND ${alertDept.clause}
    `, alertDept.params);

    res.json({
      from,
      to,
      scope: scope.isAdmin ? 'all' : 'departments',
      departmentIds: scope.departmentIds ?? [],
      departments: rows.map((row) => ({
        ...row,
        progress_percent:
          row.total_machines > 0
            ? Math.round((row.checked_count / row.total_machines) * 100)
            : 0,
      })),
      statusPie: statusPie.map((s) => ({
        name: s.status,
        value: s.count,
      })),
      totals: { ...totals, progressPercent, openAlerts: openAlerts?.n ?? 0 },
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /reports/summary — tương thích cũ */
export async function getSecurityReportSummary(req: AuthRequest, res: Response) {
  return getSecurityManagementDashboard(req, res);
}

type FailureRow = {
  id: number;
  inspection_id: number;
  created_at: string;
  department_name: string;
  department_color: string;
  qr_code: string;
  asset_name: string;
  item_label: string;
  note: string | null;
  numeric_value: number | null;
  photo_url: string | null;
  inspector_username: string;
  shift_label: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

function failureListSql(scope: ReturnType<typeof deptSqlFilter>, resolvedOnly?: boolean) {
  const resolvedClause =
    resolvedOnly === true
      ? 'AND r.thoi_gian_xu_ly IS NOT NULL'
      : resolvedOnly === false
        ? 'AND r.thoi_gian_xu_ly IS NULL'
        : '';
  return {
    sql: `
      SELECT
        r.id,
        r.phien_kiem_tra_id AS inspection_id,
        i.tao_luc AS created_at,
        d.ten_bo_phan AS department_name,
        d.mau_sac AS department_color,
        a.ma_qr AS qr_code,
        a.ten_thiet_bi AS asset_name,
        h.noi_dung AS item_label,
        r.ghi_chu AS note,
        r.gia_tri_do AS numeric_value,
        r.url_anh AS photo_url,
        i.nguoi_kiem_tra AS inspector_username,
        i.ca_truc AS shift_label,
        r.thoi_gian_xu_ly AS resolved_at,
        r.nguoi_xu_ly AS resolved_by
      FROM dbo.KetQuaKiemTra r
      INNER JOIN dbo.PhienKiemTra i ON i.id = r.phien_kiem_tra_id
      INNER JOIN dbo.BoPhan d ON d.id = i.bo_phan_id
      INNER JOIN dbo.ThietBi a ON a.id = i.thiet_bi_id
      INNER JOIN dbo.HangMucKiemTra h ON h.id = r.hang_muc_id
      WHERE r.trang_thai = N'NOT_OK' AND i.trang_thai_phien = N'da_gui'
        ${resolvedClause}
        AND i.tao_luc >= @from AND i.tao_luc < DATEADD(day, 1, CAST(@to AS DATE))
        AND ${scope.clause}
      ORDER BY i.tao_luc DESC, r.id DESC
    `,
    params: scope.params,
  };
}

/** GET /reports/critical-alerts — NOT OK chưa xử lý */
export async function getCriticalAlerts(req: AuthRequest, res: Response) {
  try {
    const scope = req.securityScope!;
    const { from, to } = parseDateRange(req);
    const deptFilter = deptSqlFilter(scope, 'i.bo_phan_id');
    const { sql, params } = failureListSql(deptFilter, false);
    const data = await query<FailureRow>(sql, { from, to, ...params });
    res.json({ from, to, data });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /reports/failure-history — lịch sử lỗi kèm ảnh */
export async function getFailureHistory(req: AuthRequest, res: Response) {
  try {
    const scope = req.securityScope!;
    const { from, to } = parseDateRange(req);
    const deptFilter = deptSqlFilter(scope, 'i.bo_phan_id');
    const { sql, params } = failureListSql(deptFilter);
    const data = await query<FailureRow>(sql, { from, to, ...params });
    res.json({ from, to, data });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** POST /reports/results/:id/resolve — đóng lỗi (feedback loop) */
export async function resolveInspectionResult(req: AuthRequest, res: Response) {
  try {
    const resultId = Number(req.params.id);
    if (!resultId) {
      res.status(400).json({ error: 'Invalid result id' });
      return;
    }
    const row = await queryOne<{ department_id: number; status: string }>(`
      SELECT i.bo_phan_id AS department_id, r.trang_thai AS status
      FROM dbo.KetQuaKiemTra r
      INNER JOIN dbo.PhienKiemTra i ON i.id = r.phien_kiem_tra_id
      WHERE r.id = @id
    `, { id: resultId });
    if (!row || row.status !== 'NOT_OK') {
      res.status(404).json({ error: 'Failure not found' });
      return;
    }
    const evidence = await queryOne<{ url_anh: string | null }>(
      'SELECT url_anh FROM dbo.KetQuaKiemTra WHERE id = @id',
      { id: resultId }
    );
    if (!evidence?.url_anh) {
      res.status(400).json({
        error: 'Cannot resolve without field photo evidence — request re-inspection from field staff',
      });
      return;
    }
    if (!assertDeptAccess(req, res, row.department_id)) return;
    const ts = nowIso();
    await exec(
      `UPDATE dbo.KetQuaKiemTra SET thoi_gian_xu_ly = @ts, nguoi_xu_ly = @user WHERE id = @id`,
      { id: resultId, ts, user: req.user?.username ?? '' }
    );
    res.json({ ok: true, resolvedAt: ts, resolvedBy: req.user?.username });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
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
        LEFT(i.tao_luc, 10) AS inspection_date,
        d.ten_bo_phan AS department_name,
        a.ma_qr AS qr_code,
        a.ten_thiet_bi AS asset_name,
        h.noi_dung AS item_label,
        r.ghi_chu AS note,
        r.gia_tri_do AS numeric_value,
        r.url_anh AS photo_url,
        i.nguoi_kiem_tra AS inspector_username,
        i.ca_truc AS shift_label
      FROM dbo.KetQuaKiemTra r
      INNER JOIN dbo.PhienKiemTra i ON i.id = r.phien_kiem_tra_id
      INNER JOIN dbo.BoPhan d ON d.id = i.bo_phan_id
      INNER JOIN dbo.ThietBi a ON a.id = i.thiet_bi_id
      INNER JOIN dbo.HangMucKiemTra h ON h.id = r.hang_muc_id
      WHERE r.trang_thai = N'NOT_OK'
        AND i.trang_thai_phien = N'da_gui'
        AND i.tao_luc >= @from AND i.tao_luc < DATEADD(day, 1, CAST(@to AS DATE))
        AND ${clause}
      ORDER BY i.tao_luc DESC, d.ten_bo_phan, a.ma_qr
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
