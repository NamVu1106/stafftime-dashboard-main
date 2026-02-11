-- CreateTable
CREATE TABLE IF NOT EXISTS "hr_excel_uploads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "report_type" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "sheet_names" TEXT NOT NULL,
    "default_sheet" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT ""
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hr_excel_uploads_report_type_idx" ON "hr_excel_uploads"("report_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hr_excel_uploads_created_at_idx" ON "hr_excel_uploads"("created_at");

