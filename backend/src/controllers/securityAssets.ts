import { Response } from 'express';
import { query, queryOne, exec } from '../db/sqlServer';
import type { AuthRequest } from '../middleware/auth';
import {
  assertDeptAccess,
  canAccessDepartment,
  deptSqlFilter,
} from '../middleware/securityPermission';
import { generateQrCode } from '../utils/securityQrCode';
import { writeQrLabelsPdf } from '../utils/securityQrPdf';

function nowIso() {
  return new Date().toISOString();
}

/** GET /assets */
export async function listSecurityAssets(req: AuthRequest, res: Response) {
  try {
    const scope = req.securityScope!;
    const { clause, params } = deptSqlFilter(scope, 'a.bo_phan_id');
    const departmentId = req.query.departmentId
      ? Number(req.query.departmentId)
      : undefined;
    if (departmentId && !assertDeptAccess(req, res, departmentId)) return;

    let extra = '';
    const extraParams: Record<string, unknown> = { ...params };
    if (departmentId) {
      extra = ' AND a.bo_phan_id = @filterDept';
      extraParams.filterDept = departmentId;
    }

    const rows = await query<{
      id: number;
      department_id: number;
      department_name: string;
      department_code: string;
      qr_code: string;
      name: string;
      asset_type: string;
      is_active: number;
      inspections_submitted: number;
    }>(`
      SELECT
        a.id,
        a.bo_phan_id AS department_id,
        d.ten_bo_phan AS department_name,
        d.ma_bo_phan AS department_code,
        a.ma_qr AS qr_code,
        a.ten_thiet_bi AS name,
        a.loai_thiet_bi AS asset_type,
        a.dang_hoat_dong AS is_active,
        (SELECT COUNT(1) FROM dbo.PhienKiemTra i
         WHERE i.thiet_bi_id = a.id AND i.trang_thai_phien = N'da_gui'
           AND i.tao_luc >= CONVERT(NVARCHAR(10), GETDATE(), 23)) AS inspections_submitted
      FROM dbo.ThietBi a
      INNER JOIN dbo.BoPhan d ON d.id = a.bo_phan_id
      WHERE ${clause}${extra}
      ORDER BY d.thu_tu, a.ten_thiet_bi
    `, extraParams);

    res.json({
      data: rows.map((r) => ({
        id: r.id,
        departmentId: r.department_id,
        departmentName: r.department_name,
        departmentCode: r.department_code,
        qrCode: r.qr_code,
        name: r.name,
        assetType: r.asset_type,
        isActive: !!r.is_active,
        inspectionsSubmittedToday: r.inspections_submitted,
        qrStatus: r.is_active ? 'active' : 'inactive',
      })),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** POST /assets */
export async function createSecurityAsset(req: AuthRequest, res: Response) {
  try {
    const { departmentId, name, assetType = 'equipment', qrCode } = req.body as {
      departmentId?: number;
      name?: string;
      assetType?: string;
      qrCode?: string;
    };
    if (!departmentId || !name?.trim()) {
      res.status(400).json({ error: 'departmentId and name required' });
      return;
    }
    if (!assertDeptAccess(req, res, departmentId)) return;

    const dept = await queryOne<{ code: string }>(
      'SELECT ma_bo_phan AS code FROM dbo.BoPhan WHERE id = @id',
      { id: departmentId }
    );
    if (!dept) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    let qr = qrCode?.trim().toUpperCase();
    if (!qr) qr = generateQrCode(dept.code);

    const dup = await queryOne<{ id: number }>(
      'SELECT id FROM dbo.ThietBi WHERE ma_qr = @qr',
      { qr }
    );
    if (dup) {
      res.status(409).json({ error: 'QR code already exists' });
      return;
    }

    const row = await queryOne<{ id: number }>(
      `INSERT INTO dbo.ThietBi (bo_phan_id, ma_qr, ten_thiet_bi, loai_thiet_bi, dang_hoat_dong)
       OUTPUT INSERTED.id
       VALUES (@dept, @qr, @name, @type, 1)`,
      { dept: departmentId, qr, name: name.trim(), type: assetType }
    );

    res.status(201).json({
      ok: true,
      id: row!.id,
      qrCode: qr,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** PATCH /assets/:id */
export async function updateSecurityAsset(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const asset = await queryOne<{ department_id: number }>(
      'SELECT bo_phan_id AS department_id FROM dbo.ThietBi WHERE id = @id',
      { id }
    );
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    if (!assertDeptAccess(req, res, asset.department_id)) return;

    const { name, assetType, isActive } = req.body as {
      name?: string;
      assetType?: string;
      isActive?: boolean;
    };

    await exec(
      `UPDATE dbo.ThietBi SET
        ten_thiet_bi = COALESCE(@name, ten_thiet_bi),
        loai_thiet_bi = COALESCE(@type, loai_thiet_bi),
        dang_hoat_dong = COALESCE(@active, dang_hoat_dong)
       WHERE id = @id`,
      {
        id,
        name: name?.trim() ?? null,
        type: assetType ?? null,
        active: isActive === undefined ? null : isActive ? 1 : 0,
      }
    );
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** POST /assets/:id/regenerate-qr */
export async function regenerateAssetQr(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const asset = await queryOne<{
      department_id: number;
      qr_code: string;
    }>('SELECT bo_phan_id AS department_id, ma_qr AS qr_code FROM dbo.ThietBi WHERE id = @id', { id });
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    if (!assertDeptAccess(req, res, asset.department_id)) return;

    const dept = await queryOne<{ code: string }>(
      'SELECT ma_bo_phan AS code FROM dbo.BoPhan WHERE id = @id',
      { id: asset.department_id }
    );
    if (!dept) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    let newQr = generateQrCode(dept.code);
    for (let attempt = 0; attempt < 5; attempt++) {
      const dup = await queryOne<{ id: number }>(
        'SELECT id FROM dbo.ThietBi WHERE ma_qr = @qr',
        { qr: newQr }
      );
      if (!dup) break;
      newQr = generateQrCode(dept.code);
    }

    const ts = nowIso();
    await exec(
      `INSERT INTO dbo.LichSuMaQrThietBi (thiet_bi_id, ma_qr_cu, ma_qr_moi, thoi_diem, nguoi_doi)
       VALUES (@aid, @old, @new, @ts, @user)`,
      {
        aid: id,
        old: asset.qr_code,
        new: newQr,
        ts,
        user: req.user?.username ?? '',
      }
    );
    await exec('UPDATE dbo.ThietBi SET ma_qr = @qr WHERE id = @id', {
      id,
      qr: newQr,
    });

    res.json({
      ok: true,
      assetId: id,
      previousQrCode: asset.qr_code,
      qrCode: newQr,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /assets/labels/pdf?ids=1,2,3 */
export async function exportAssetLabelsPdf(req: AuthRequest, res: Response) {
  try {
    const scope = req.securityScope!;
    const idsRaw = String(req.query.ids ?? '').trim();
    if (!idsRaw) {
      res.status(400).json({ error: 'ids query required' });
      return;
    }
    const ids = idsRaw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => n > 0);
    if (!ids.length) {
      res.status(400).json({ error: 'invalid ids' });
      return;
    }

    const placeholders = ids.map((_, i) => `@id${i}`).join(',');
    const params: Record<string, unknown> = {};
    ids.forEach((id, i) => {
      params[`id${i}`] = id;
    });

    const assets = await query<{
      id: number;
      department_id: number;
      qr_code: string;
      name: string;
      department_name: string;
    }>(`
      SELECT a.id, a.bo_phan_id AS department_id, a.ma_qr AS qr_code, a.ten_thiet_bi AS name, d.ten_bo_phan AS department_name
      FROM dbo.ThietBi a
      INNER JOIN dbo.BoPhan d ON d.id = a.bo_phan_id
      WHERE a.id IN (${placeholders}) AND a.dang_hoat_dong = 1
    `, params);

    const allowed = assets.filter((a) => canAccessDepartment(scope, a.department_id));
    if (!allowed.length) {
      res.status(403).json({ error: 'No accessible assets' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tem-qr-an-ninh_${nowIso().slice(0, 10)}.pdf"`
    );
    await writeQrLabelsPdf(res, allowed);
  } catch (e: unknown) {
    if (!res.headersSent) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
}
