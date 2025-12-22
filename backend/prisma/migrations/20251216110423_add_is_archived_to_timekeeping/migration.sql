-- AlterTable
ALTER TABLE "timekeeping_records" ADD COLUMN "is_archived" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timekeeping_records_is_archived_idx" ON "timekeeping_records"("is_archived");

-- Update existing records: all current records are considered "new" (not archived)
-- This ensures existing data shows up in Reports page
UPDATE "timekeeping_records" SET "is_archived" = 0 WHERE "is_archived" IS NULL;
