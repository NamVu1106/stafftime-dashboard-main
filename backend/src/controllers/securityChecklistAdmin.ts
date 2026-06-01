import { Response } from 'express';
import { query, queryOne, exec } from '../db/sqlServer';
import type { AuthRequest } from '../middleware/auth';
import { assertDeptAccess } from '../middleware/securityPermission';
import { mapCheckItem } from './securityInspection';

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

/** GET /admin/checklist-editor/:deptId */
export async function getChecklistEditorTemplate(req: AuthRequest, res: Response) {
  try {
    const deptId = Number(req.params.deptId);
    if (!assertDeptAccess(req, res, deptId)) return;

    const dept = await queryOne<{ id: number; code: string; name: string; color: string }>(
      'SELECT id, code, name, color FROM dbo.sec_departments WHERE id = @id AND is_active = 1',
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
        ISNULL(i.input_type, N'boolean') AS input_type, i.min_value, i.max_value, i.unit
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
        sortOrder: c.sort_order,
        items: (itemsByCat.get(c.id) ?? []).map(mapCheckItem),
      })),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** POST /admin/checklist-editor/:deptId/categories */
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
      'SELECT ISNULL(MAX(sort_order), -1) AS m FROM dbo.sec_categories WHERE department_id = @dept',
      { dept: deptId }
    );
    const sortOrder = (maxRow?.m ?? -1) + 1;
    const row = await queryOne<{ id: number }>(
      `INSERT INTO dbo.sec_categories (department_id, name, sort_order)
       OUTPUT INSERTED.id VALUES (@dept, @name, @sort)`,
      { dept: deptId, name, sort: sortOrder }
    );
    res.json({ ok: true, id: row!.id, sortOrder });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** PATCH /admin/checklist-editor/categories/:catId */
export async function updateChecklistCategory(req: AuthRequest, res: Response) {
  try {
    const catId = Number(req.params.catId);
    const cat = await queryOne<CatRow>(
      'SELECT id, department_id, name, sort_order FROM dbo.sec_categories WHERE id = @id',
      { id: catId }
    );
    if (!cat || !assertDeptAccess(req, res, cat.department_id)) return;

    const name = req.body?.name != null ? String(req.body.name).trim() : cat.name;
    if (!name) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    await exec('UPDATE dbo.sec_categories SET name = @name WHERE id = @id', { id: catId, name });
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** DELETE /admin/checklist-editor/categories/:catId */
export async function deleteChecklistCategory(req: AuthRequest, res: Response) {
  try {
    const catId = Number(req.params.catId);
    const cat = await queryOne<CatRow>(
      'SELECT id, department_id FROM dbo.sec_categories WHERE id = @id',
      { id: catId }
    );
    if (!cat || !assertDeptAccess(req, res, cat.department_id)) return;

    const used = await queryOne<{ n: number }>(
      `SELECT COUNT(1) AS n FROM dbo.sec_inspection_results r
       INNER JOIN dbo.sec_check_items i ON i.id = r.item_id WHERE i.category_id = @cat`,
      { cat: catId }
    );
    if (used && used.n > 0) {
      res.status(400).json({ error: 'Category has inspection history — delete items first or contact IT' });
      return;
    }
    await exec('DELETE FROM dbo.sec_check_items WHERE category_id = @cat', { cat: catId });
    await exec('DELETE FROM dbo.sec_categories WHERE id = @cat', { cat: catId });
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

/** POST /admin/checklist-editor/categories/:catId/items */
export async function createChecklistItem(req: AuthRequest, res: Response) {
  try {
    const catId = Number(req.params.catId);
    const cat = await queryOne<CatRow>(
      'SELECT id, department_id FROM dbo.sec_categories WHERE id = @id',
      { id: catId }
    );
    if (!cat || !assertDeptAccess(req, res, cat.department_id)) return;

    const norm = normalizeItemBody(req.body as ItemBody);
    if (!norm.label) {
      res.status(400).json({ error: 'label required' });
      return;
    }
    const maxRow = await queryOne<{ m: number }>(
      'SELECT ISNULL(MAX(sort_order), -1) AS m FROM dbo.sec_check_items WHERE category_id = @cat',
      { cat: catId }
    );
    const sortOrder = (maxRow?.m ?? -1) + 1;
    const row = await queryOne<{ id: number }>(
      `INSERT INTO dbo.sec_check_items
        (category_id, label, requires_photo_on_fail, sort_order, input_type, min_value, max_value, unit)
       OUTPUT INSERTED.id
       VALUES (@cat, @label, @photo, @sort, @type, @min, @max, @unit)`,
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

/** PATCH /admin/checklist-editor/items/:itemId */
export async function updateChecklistItem(req: AuthRequest, res: Response) {
  try {
    const itemId = Number(req.params.itemId);
    const item = await queryOne<ItemRow & { department_id: number }>(`
      SELECT i.*, c.department_id
      FROM dbo.sec_check_items i
      INNER JOIN dbo.sec_categories c ON c.id = i.category_id
      WHERE i.id = @id
    `, { id: itemId });
    if (!item || !assertDeptAccess(req, res, item.department_id)) return;

    const norm = normalizeItemBody({ ...req.body, label: req.body?.label ?? item.label } as ItemBody);
    if (!norm.label) {
      res.status(400).json({ error: 'label required' });
      return;
    }
    await exec(
      `UPDATE dbo.sec_check_items SET
        label = @label, requires_photo_on_fail = @photo, input_type = @type,
        min_value = @min, max_value = @max, unit = @unit
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

/** DELETE /admin/checklist-editor/items/:itemId */
export async function deleteChecklistItem(req: AuthRequest, res: Response) {
  try {
    const itemId = Number(req.params.itemId);
    const item = await queryOne<{ department_id: number }>(`
      SELECT c.department_id FROM dbo.sec_check_items i
      INNER JOIN dbo.sec_categories c ON c.id = i.category_id WHERE i.id = @id
    `, { id: itemId });
    if (!item || !assertDeptAccess(req, res, item.department_id)) return;

    const used = await queryOne<{ n: number }>(
      'SELECT COUNT(1) AS n FROM dbo.sec_inspection_results WHERE item_id = @id',
      { id: itemId }
    );
    if (used && used.n > 0) {
      res.status(400).json({ error: 'Item has inspection history — cannot delete' });
      return;
    }
    await exec('DELETE FROM dbo.sec_check_items WHERE id = @id', { id: itemId });
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** POST /admin/checklist-editor/:deptId/reorder */
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
        'UPDATE dbo.sec_categories SET sort_order = @sort WHERE id = @id AND department_id = @dept',
        { id: c.id, sort: c.sortOrder, dept: deptId }
      );
    }
    for (const i of items) {
      const cat = await queryOne<{ department_id: number }>(
        'SELECT department_id FROM dbo.sec_categories WHERE id = @cat',
        { cat: i.categoryId }
      );
      if (!cat || cat.department_id !== deptId) continue;
      await exec(
        'UPDATE dbo.sec_check_items SET sort_order = @sort, category_id = @cat WHERE id = @id',
        { id: i.id, sort: i.sortOrder, cat: i.categoryId }
      );
    }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}
