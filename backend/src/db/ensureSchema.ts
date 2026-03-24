/**
 * Tự tạo các bảng dbo nếu chưa có — tránh 500 "Invalid object name 'employees'|'notifications'|…"
 * khi chưa chạy migration.sql trong SSMS.
 */
import { exec } from './sqlServer';

export async function ensureDatabaseSchema(): Promise<void> {
  await exec(`
IF OBJECT_ID(N'dbo.employees', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[employees] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [gender] NVARCHAR(1000) NOT NULL,
    [date_of_birth] NVARCHAR(1000) NOT NULL,
    [age] INT NOT NULL,
    [department] NVARCHAR(1000) NOT NULL,
    [employment_type] NVARCHAR(1000) NOT NULL,
    [cccd] NVARCHAR(1000),
    [hometown] NVARCHAR(1000),
    [permanent_residence] NVARCHAR(1000),
    [temporary_residence] NVARCHAR(1000),
    [marital_status] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [avatar_url] NVARCHAR(1000),
    [created_at] NVARCHAR(1000) NOT NULL CONSTRAINT [employees_created_at_df] DEFAULT '',
    [updated_at] NVARCHAR(1000) NOT NULL CONSTRAINT [employees_updated_at_df] DEFAULT '',
    CONSTRAINT [employees_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employees_employee_code_key] UNIQUE NONCLUSTERED ([employee_code])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [username] NVARCHAR(1000) NOT NULL,
    [password_hash] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [users_role_df] DEFAULT 'admin',
    [created_at] NVARCHAR(1000) NOT NULL CONSTRAINT [users_created_at_df] DEFAULT '',
    [updated_at] NVARCHAR(1000) NOT NULL CONSTRAINT [users_updated_at_df] DEFAULT '',
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_username_key] UNIQUE NONCLUSTERED ([username])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.family_members', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[family_members] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_id] INT NOT NULL,
    [relation] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [occupation] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [family_members_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.timekeeping_records', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[timekeeping_records] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_code] NVARCHAR(1000) NOT NULL,
    [employee_id] INT,
    [employee_name] NVARCHAR(1000) NOT NULL,
    [date] NVARCHAR(1000) NOT NULL,
    [day_of_week] NVARCHAR(1000) NOT NULL,
    [check_in] NVARCHAR(1000) NOT NULL,
    [check_out] NVARCHAR(1000) NOT NULL,
    [late_minutes] INT NOT NULL CONSTRAINT [timekeeping_records_late_minutes_df] DEFAULT 0,
    [early_minutes] INT NOT NULL CONSTRAINT [timekeeping_records_early_minutes_df] DEFAULT 0,
    [workday] FLOAT(53) NOT NULL,
    [total_hours] FLOAT(53) NOT NULL,
    [overtime_hours] FLOAT(53) NOT NULL CONSTRAINT [timekeeping_records_overtime_hours_df] DEFAULT 0,
    [total_all_hours] FLOAT(53) NOT NULL,
    [shift] NVARCHAR(1000) NOT NULL,
    [department] NVARCHAR(1000) NOT NULL,
    [created_at] NVARCHAR(1000) NOT NULL CONSTRAINT [timekeeping_records_created_at_df] DEFAULT '',
    [is_archived] INT NOT NULL CONSTRAINT [timekeeping_records_is_archived_df] DEFAULT 0,
    CONSTRAINT [timekeeping_records_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[notifications] (
    [id] INT NOT NULL IDENTITY(1,1),
    [type] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(max) NOT NULL,
    [is_read] INT NOT NULL CONSTRAINT [notifications_is_read_df] DEFAULT 0,
    [metadata] NVARCHAR(max),
    [created_at] NVARCHAR(1000) NOT NULL CONSTRAINT [notifications_created_at_df] DEFAULT '',
    CONSTRAINT [notifications_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.employee_excel_store', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[employee_excel_store] (
    [id] INT NOT NULL IDENTITY(1,1),
    [type] NVARCHAR(1000) NOT NULL,
    [headers] NVARCHAR(max) NOT NULL,
    [rows] NVARCHAR(max) NOT NULL,
    [created_at] NVARCHAR(1000) NOT NULL CONSTRAINT [employee_excel_store_created_at_df] DEFAULT '',
    [updated_at] NVARCHAR(1000) NOT NULL CONSTRAINT [employee_excel_store_updated_at_df] DEFAULT '',
    CONSTRAINT [employee_excel_store_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_excel_store_type_key] UNIQUE NONCLUSTERED ([type])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.employee_vendor_map', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[employee_vendor_map] (
    [employee_code] NVARCHAR(1000) NOT NULL,
    [vendor_name] NVARCHAR(1000) NOT NULL,
    [updated_at] NVARCHAR(1000) NOT NULL CONSTRAINT [employee_vendor_map_updated_df] DEFAULT '',
    CONSTRAINT [employee_vendor_map_pkey] PRIMARY KEY CLUSTERED ([employee_code])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.hr_excel_uploads', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[hr_excel_uploads] (
    [id] INT NOT NULL IDENTITY(1,1),
    [report_type] NVARCHAR(1000) NOT NULL,
    [original_file_name] NVARCHAR(1000) NOT NULL,
    [stored_file_name] NVARCHAR(1000) NOT NULL,
    [sheet_names] NVARCHAR(max) NOT NULL,
    [default_sheet] NVARCHAR(1000) NOT NULL,
    [created_at] NVARCHAR(1000) NOT NULL CONSTRAINT [hr_excel_uploads_created_at_df] DEFAULT '',
    CONSTRAINT [hr_excel_uploads_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  const idx = [
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'timekeeping_records_employee_code_idx' AND object_id = OBJECT_ID(N'dbo.timekeeping_records'))
     CREATE NONCLUSTERED INDEX [timekeeping_records_employee_code_idx] ON [dbo].[timekeeping_records]([employee_code]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'timekeeping_records_date_idx' AND object_id = OBJECT_ID(N'dbo.timekeeping_records'))
     CREATE NONCLUSTERED INDEX [timekeeping_records_date_idx] ON [dbo].[timekeeping_records]([date]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'timekeeping_records_department_idx' AND object_id = OBJECT_ID(N'dbo.timekeeping_records'))
     CREATE NONCLUSTERED INDEX [timekeeping_records_department_idx] ON [dbo].[timekeeping_records]([department]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'timekeeping_records_created_at_idx' AND object_id = OBJECT_ID(N'dbo.timekeeping_records'))
     CREATE NONCLUSTERED INDEX [timekeeping_records_created_at_idx] ON [dbo].[timekeeping_records]([created_at]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'timekeeping_records_is_archived_idx' AND object_id = OBJECT_ID(N'dbo.timekeeping_records'))
     CREATE NONCLUSTERED INDEX [timekeeping_records_is_archived_idx] ON [dbo].[timekeeping_records]([is_archived]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'notifications_is_read_idx' AND object_id = OBJECT_ID(N'dbo.notifications'))
     CREATE NONCLUSTERED INDEX [notifications_is_read_idx] ON [dbo].[notifications]([is_read]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'notifications_created_at_idx' AND object_id = OBJECT_ID(N'dbo.notifications'))
     CREATE NONCLUSTERED INDEX [notifications_created_at_idx] ON [dbo].[notifications]([created_at]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'hr_excel_uploads_report_type_idx' AND object_id = OBJECT_ID(N'dbo.hr_excel_uploads'))
     CREATE NONCLUSTERED INDEX [hr_excel_uploads_report_type_idx] ON [dbo].[hr_excel_uploads]([report_type]);`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'hr_excel_uploads_created_at_idx' AND object_id = OBJECT_ID(N'dbo.hr_excel_uploads'))
     CREATE NONCLUSTERED INDEX [hr_excel_uploads_created_at_idx] ON [dbo].[hr_excel_uploads]([created_at]);`,
  ];
  for (const s of idx) {
    await exec(s);
  }

  const fks = [
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'family_members_employee_id_fkey' AND parent_object_id = OBJECT_ID(N'dbo.family_members'))
     ALTER TABLE [dbo].[family_members] ADD CONSTRAINT [family_members_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employees]([id]) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'timekeeping_records_employee_id_fkey' AND parent_object_id = OBJECT_ID(N'dbo.timekeeping_records'))
     ALTER TABLE [dbo].[timekeeping_records] ADD CONSTRAINT [timekeeping_records_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employees]([id]) ON DELETE SET NULL ON UPDATE CASCADE;`,
  ];
  for (const s of fks) {
    try {
      await exec(s);
    } catch (e: unknown) {
      console.warn('[ensureSchema] Bỏ qua FK (có thể đã tồn tại hoặc dữ liệu cũ):', (e as Error).message);
    }
  }
}
