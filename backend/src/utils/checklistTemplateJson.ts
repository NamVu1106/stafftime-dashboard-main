/**
 * Chuyển template phân cấp (API tablet/editor) → JSON phẳng theo format đề xuất nghiệp vụ.
 */
export type TemplateCategory = {
  id: number;
  name: string;
  items: Array<{
    id: number;
    label: string;
    inputType?: string;
    minValue?: number | null;
    maxValue?: number | null;
    unit?: string | null;
    requiresPhotoOnFail?: boolean;
  }>;
};

export type FlatChecklistJson = {
  department: string;
  departmentId: number;
  departmentCode?: string;
  items: Array<{
    id: number;
    label: string;
    type: 'boolean' | 'number';
    category?: string;
    threshold?: { min: number | null; max: number | null; unit: string | null };
    requiresPhotoOnFail?: boolean;
  }>;
};

export function toFlatChecklistJson(
  department: { id: number; code?: string; name: string },
  categories: TemplateCategory[]
): FlatChecklistJson {
  const items: FlatChecklistJson['items'] = [];
  for (const cat of categories) {
    for (const item of cat.items) {
      const type = item.inputType === 'number' ? 'number' : 'boolean';
      const row: FlatChecklistJson['items'][0] = {
        id: item.id,
        label: item.label,
        type,
        category: cat.name,
        requiresPhotoOnFail: item.requiresPhotoOnFail,
      };
      if (type === 'number') {
        row.threshold = {
          min: item.minValue ?? null,
          max: item.maxValue ?? null,
          unit: item.unit ?? null,
        };
      }
      items.push(row);
    }
  }
  return {
    department: department.name,
    departmentId: department.id,
    departmentCode: department.code,
    items,
  };
}
