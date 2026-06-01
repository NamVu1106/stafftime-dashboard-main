export type InspectionItemStatus = 'pass' | 'fail' | 'skip' | 'unset';

export type SecurityDepartment = {
  id: number;
  code: string;
  name: string;
  color: string;
  progressPercent: number;
  submittedToday: number;
  draftToday: number;
};

export type ChecklistInputType = 'boolean' | 'number';

export type ChecklistItemDef = {
  id: number;
  label: string;
  requiresPhotoOnFail: boolean;
  inputType?: ChecklistInputType;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
};

export type ChecklistCategory = {
  id: number;
  name: string;
  items: ChecklistItemDef[];
};

export type DepartmentTemplate = {
  department: { id: number; code: string; name: string; color: string };
  categories: ChecklistCategory[];
};

export type ChecklistEditorCategory = {
  id: number;
  name: string;
  sortOrder: number;
  items: ChecklistItemDef[];
};

export type ChecklistEditorTemplate = {
  department: { id: number; code: string; name: string; color: string };
  categories: ChecklistEditorCategory[];
};

export type LastInspectionSummary = {
  date: string;
  inspector: string;
  failItems: { label: string; note: string | null }[];
};

export type ResolvedAsset = {
  asset: { id: number; department_id: number; qr_code: string; name: string; asset_type: string };
  department: { id: number; code: string; name: string; color: string };
  lastInspection?: LastInspectionSummary | null;
};

export type ItemResult = {
  itemId: number;
  status: InspectionItemStatus;
  note?: string;
  numericValue?: number;
  photoData?: string;
};

export type InspectionDraft = {
  clientId: string;
  departmentId: number;
  assetId: number;
  assetName: string;
  qrCode: string;
  shiftLabel: string;
  results: ItemResult[];
  signatureData?: string;
  updatedAt: string;
  paused?: boolean;
  pauseReason?: string;
};

export type SecurityFailureRecord = {
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

export type SyncQueueEntry = {
  id: string;
  payload: {
    clientId: string;
    departmentId: number;
    assetId: number;
    shiftLabel?: string;
    status: 'draft' | 'submitted';
    signatureData?: string;
    results: {
      itemId: number;
      status: 'pass' | 'fail' | 'skip';
      note?: string;
      numericValue?: number;
      photoData?: string;
    }[];
  };
  createdAt: string;
};
