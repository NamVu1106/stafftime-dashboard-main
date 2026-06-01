import { ensureVnSecuritySchema } from './vnSecuritySchema';
import { seedSecurityInspectionIfEmpty } from './seedSecurityInspection';
import { seedSecurityDemoManagers } from './seedSecurityManagers';
import { seedSecurityNumericItemsIfMissing } from './seedSecurityNumericItems';

/** Bảng kiểm tra an ninh — BoPhan > NhomHangMuc > HangMucKiemTra (CSDL tiếng Việt) */
export async function ensureSecurityInspectionSchema(): Promise<void> {
  await ensureVnSecuritySchema();
  await seedSecurityInspectionIfEmpty();
  await seedSecurityNumericItemsIfMissing();
  await seedSecurityDemoManagers();
}
