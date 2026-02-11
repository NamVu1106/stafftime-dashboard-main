-- CreateTable
CREATE TABLE "employee_excel_store" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "headers" TEXT NOT NULL,
    "rows" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_excel_store_type_key" ON "employee_excel_store"("type");
