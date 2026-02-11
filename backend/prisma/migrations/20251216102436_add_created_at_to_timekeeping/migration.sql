-- AlterTable
ALTER TABLE "timekeeping_records" ADD COLUMN "created_at" TEXT NOT NULL DEFAULT '';

-- Update existing records to have a default created_at (use current timestamp for old records)
-- This ensures old records are sorted after new ones
UPDATE "timekeeping_records" SET "created_at" = datetime('now', '-1 day') WHERE "created_at" = '';

-- CreateIndex
CREATE INDEX "timekeeping_records_created_at_idx" ON "timekeeping_records"("created_at");

