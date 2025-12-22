-- CreateTable
CREATE TABLE "employees" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "date_of_birth" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "employment_type" TEXT NOT NULL,
    "cccd" TEXT,
    "hometown" TEXT,
    "permanent_residence" TEXT,
    "temporary_residence" TEXT,
    "marital_status" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employee_id" INTEGER NOT NULL,
    "relation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    CONSTRAINT "family_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "timekeeping_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employee_code" TEXT NOT NULL,
    "employee_id" INTEGER,
    "employee_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "check_in" TEXT NOT NULL,
    "check_out" TEXT NOT NULL,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_minutes" INTEGER NOT NULL DEFAULT 0,
    "workday" REAL NOT NULL,
    "total_hours" REAL NOT NULL,
    "overtime_hours" REAL NOT NULL DEFAULT 0,
    "total_all_hours" REAL NOT NULL,
    "shift" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    CONSTRAINT "timekeeping_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "timekeeping_records_employee_code_idx" ON "timekeeping_records"("employee_code");

-- CreateIndex
CREATE INDEX "timekeeping_records_date_idx" ON "timekeeping_records"("date");

-- CreateIndex
CREATE INDEX "timekeeping_records_department_idx" ON "timekeeping_records"("department");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
