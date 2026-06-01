import { Response } from 'express';
import { query, queryOne, exec } from '../db/sqlServer';
import type { AuthRequest } from '../middleware/auth';
import { assertDeptAccess } from '../middleware/securityPermission';
import { mapCheckItem } from './securityInspection';

type CatRow = { id: number; bo_phan_id: number; ten_nhom: string; thu_tu: number };
type ItemRow = {
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

/** GET /admin/checklist-editor/:deptId */
export async function getChecklistEditorTemplate(req: AuthRequest, res: Response) {
  try {
    const deptId = Number(req.params.deptId);
    if (!assertDeptAccess(req, res, deptId)) return;

    const dept = await queryOne<{ id: number; code: string; name: string; color: string }>(
      `SELECT id, ma_bo_phan AS code, ten_bo_phan AS name, mau_sac AS color
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
        ISNULL(i.kieu_du_lieu, N'boolean') AS kieu_du_lieu, i.nguong_min, i.nguong_max, i.don_vi
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

    res.json({
      department: dept,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.ten_nhom,
        sortOrder: c.thu_tu,
        items: (itemsByCat.get(c.id) ?? []).map(mapCheckItem),
      })),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

export async function createChecklistCategory(req: AuthRequest, res: Response) {
  try {
    const deptId = Number(req.params.deptId);
    if (!assertDeptAccess(req, res, deptId)) return;
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    const maxRow = await queryOne<{ m: number }>(
      'SELECT ISNULL(MAX(thu_tu), -1) AS m FROM dbo.NhomHangMuc WHERE bo_phan_id = @dept',
      { dept: deptId }
    );
    const sortOrder = (maxRow?.m ?? -1) + 1;
    const row = await queryOne<{ id: number }>(
      `INSERT INTO dbo.NhomHangMuc (bo_phan_id, ten_nhom, thu_tu)
       OUTPUT INSERTED.id VALUES (@dept, @name, @sort)`,
      { dept: deptId, name, sort: sortOrder }
    );
    res.json({ ok: true, id: row!.id, sortOrder });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

export async function updateChecklistCategory(req: AuthRequest, res: Response) {
  try {
    const catId = Number(req.params.catId);
    const cat = await queryOne<CatRow>(
      'SELECT id, bo_phan_id, ten_nhom, thu_tu FROM dbo.NhomHangMuc WHERE id = @id',
      { id: catId }
    );
    if (!cat || !assertDeptAccess(req, res, cat.bo_phan_id)) return;

    const name = req.body?.name != null ? String(req.body.name).trim() : cat.ten_nhom;
    if (!name) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    await exec('UPDATE dbo.NhomHangMuc SET ten_nhom = @name WHERE id = @id', { id: catId, name });
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

export async function deleteChecklistCategory(req: AuthRequest, res: Response) {
  try {
    const catId = Number(req.params.catId);
    const cat = await queryOne<{ bo_phan_id: number }>(
      'SELECT bo_phan_id FROM dbo.NhomHangMuc WHERE id = @id',
      { id: catId }
    );
    if (!cat || !assertDeptAccess(req, res, cat.bo_phan_id)) return;

    const used = await queryOne<{ n: number }>(
      `SELECT COUNT(1) AS n FROM dbo.KetQuaKiemTra r
       INNER JOIN dbo.HangMucKiemTra i ON i.id = r.hang_muc_id WHERE i.nhom_id = @cat`,
      { cat: catId }
    );
    if (used && used.n > 0) {
      res.status(400).json({ error: 'Category has inspection history — delete items first' });
      return;
    }
    await exec('DELETE FROM dbo.HangMucKiemTra WHERE nhom_id = @cat', { cat: catId });
    await exec('DELETE FROM dbo.NhomHangMuc WHERE id = @cat', { cat: catId });
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

type ItemBody = {
  label?: string;
  inputType?: 'boolean' | 'number';
  requiresPhotoOnFail?: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
};

function normalizeItemBody(body: ItemBody) {
  const inputType = body.inputType === 'number' ? 'number' : 'boolean';
  return {
    label: String(body.label ?? '').trim(),
    inputType,
    requiresPhoto: body.requiresPhotoOnFail !== false ? 1 : 0,
    minValue: inputType === 'number' ? (body.minValue ?? null) : null,
    maxValue: inputType === 'number' ? (body.maxValue ?? null) : null,
    unit: inputType === 'number' ? (body.unit?.trim() || null) : null,
  };
}

export async function createChecklistItem(req: AuthRequest, res: Response) {
  try {
    const catId = Number(req.params.catId);
    const cat = await queryOne<{ bo_phan_id: number }>(
      'SELECT bo_phan_id FROM dbo.NhomHangMuc WHERE id = @id',
      { id: catId }
    );
    if (!cat || !assertDeptAccess(req, res, cat.bo_phan_id)) return;

    const norm = normalizeItemBody(req.body as ItemBody);
    if (!norm.label) {
      res.status(400).json({ error: 'label required' });
      return;
    }
    const maxRow = await queryOne<{ m: number }>(
      'SELECT ISNULL(MAX(thu_tu), -1) AS m FROM dbo.HangMucKiemTra WHERE nhom_id = @cat',
      { cat: catId }
    );
    const sortOrder = (maxRow?.m ?? -1) + 1;
    const row = await queryOne<{ id: number }>(
      `INSERT INTO dbo.HangMucKiemTra
        (nhom_id, noi_dung, yeu_cau_an_loi, thu_tu, kieu_du_lieu, nguong_min, nguong_max, don_vi, bat_buoc)
       OUTPUT INSERTED.id
       VALUES (@cat, @label, @photo, @sort, @type, @min, @max, @unit, 1)`,
      {
        cat: catId,
        label: norm.label,
        photo: norm.requiresPhoto,
        sort: sortOrder,
        type: norm.inputType,
        min: norm.minValue,
        max: norm.maxValue,
        unit: norm.unit,
      }
    );
    res.json({ ok: true, id: row!.id, sortOrder });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

export async function updateChecklistItem(req: AuthRequest, res: Response) {
  try {
    const itemId = Number(req.params.itemId);
    const item = await queryOne<ItemRow & { bo_phan_id: number }>(`
      SELECT i.id, i.nhom_id, i.noi_dung, i.yeu_cau_an_loi, i.thu_tu, i.kieu_du_lieu, i.nguong_min, i.nguong_max, i.don_vi, c.bo_phan_id
      FROM dbo.HangMucKiemTra i
      INNER JOIN dbo.NhomHangMuc c ON c.id = i.nhom_id
      WHERE i.id = @id
    `, { id: itemId });
    if (!item || !assertDeptAccess(req, res, item.bo_phan_id)) return;

    const norm = normalizeItemBody({ ...req.body, label: req.body?.label ?? item.noi_dung } as ItemBody);
    if (!norm.label) {
      res.status(400).json({ error: 'label required' });
      return;
    }
    await exec(
      `UPDATE dbo.HangMucKiemTra SET
        noi_dung = @label, yeu_cau_an_loi = @photo, kieu_du_lieu = @type,
        nguong_min = @min, nguong_max = @max, don_vi = @unit
       WHERE id = @id`,
      {
        id: itemId,
        label: norm.label,
        photo: norm.requiresPhoto,
        type: norm.inputType,
        min: norm.minValue,
        max: norm.maxValue,
        unit: norm.unit,
      }
    );
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

export async function deleteChecklistItem(req: AuthRequest, res: Response) {
  try {
    const itemId = Number(req.params.itemId);
    const item = await queryOne<{ bo_phan_id: number }>(`
      SELECT c.bo_phan_id FROM dbo.HangMucKiemTra i
      INNER JOIN dbo.NhomHangMuc c ON c.id = i.nhom_id WHERE i.id = @id
    `, { id: itemId });
    if (!item || !assertDeptAccess(req, res, item.bo_phan_id)) return;

    const used = await queryOne<{ n: number }>(
      'SELECT COUNT(1) AS n FROM dbo.KetQuaKiemTra WHERE hang_muc_id = @id',
      { id: itemId }
    );
    if (used && used.n > 0) {
      res.status(400).json({ error: 'Item has inspection history — cannot delete' });
      return;
    }
    await exec('DELETE FROM dbo.HangMucKiemTra WHERE id = @id', { id: itemId });
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

export async function reorderChecklist(req: AuthRequest, res: Response) {
  try {
    const deptId = Number(req.params.deptId);
    if (!assertDeptAccess(req, res, deptId)) return;

    const categories = (req.body?.categories ?? []) as { id: number; sortOrder: number }[];
    const items = (req.body?.items ?? []) as {
      id: number;
      categoryId: number;
      sortOrder: number;
    }[];

    for (const c of categories) {
      await exec(
        'UPDATE dbo.NhomHangMuc SET thu_tu = @sort WHERE id = @id AND bo_phan_id = @dept',
        { id: c.id, sort: c.sortOrder, dept: deptId }
      );
    }
    for (const i of items) {
      const cat = await queryOne<{ bo_phan_id: number }>(
        'SELECT bo_phan_id FROM dbo.NhomHangMuc WHERE id = @cat',
        { cat: i.categoryId }
      );
      if (!cat || cat.bo_phan_id !== deptId) continue;
      await exec(
        'UPDATE dbo.HangMucKiemTra SET thu_tu = @sort, nhom_id = @cat WHERE id = @id',
        { id: i.id, sort: i.sortOrder, cat: i.categoryId }
      );
    }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}
