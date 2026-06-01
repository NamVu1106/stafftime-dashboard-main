import { exec } from './sqlServer';
import { seedSecurityInspectionIfEmpty } from './seedSecurityInspection';
import { seedSecurityDemoManagers } from './seedSecurityManagers';

/** Bảng kiểm tra an ninh — phân cấp Department > Category > Item */
export async function ensureSecurityInspectionSchema(): Promise<void> {
  await exec(`
IF OBJECT_ID(N'dbo.sec_departments', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sec_departments] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(50) NOT NULL,
    [name] NVARCHAR(500) NOT NULL,
    [color] NVARCHAR(50) NOT NULL CONSTRAINT [sec_departments_color_df] DEFAULT '#2563eb',
    [sort_order] INT NOT NULL CONSTRAINT [sec_departments_sort_df] DEFAULT 0,
    [is_active] INT NOT NULL CONSTRAINT [sec_departments_active_df] DEFAULT 1,
    CONSTRAINT [sec_departments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [sec_departments_code_key] UNIQUE NONCLUSTERED ([code])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.sec_categories', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sec_categories] (
    [id] INT NOT NULL IDENTITY(1,1),
    [department_id] INT NOT NULL,
    [name] NVARCHAR(500) NOT NULL,
    [sort_order] INT NOT NULL CONSTRAINT [sec_categories_sort_df] DEFAULT 0,
    CONSTRAINT [sec_categories_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.sec_check_items', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sec_check_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [category_id] INT NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [requires_photo_on_fail] INT NOT NULL CONSTRAINT [sec_check_items_photo_df] DEFAULT 1,
    [sort_order] INT NOT NULL CONSTRAINT [sec_check_items_sort_df] DEFAULT 0,
    CONSTRAINT [sec_check_items_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.sec_assets', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sec_assets] (
    [id] INT NOT NULL IDENTITY(1,1),
    [department_id] INT NOT NULL,
    [qr_code] NVARCHAR(200) NOT NULL,
    [name] NVARCHAR(500) NOT NULL,
    [asset_type] NVARCHAR(50) NOT NULL CONSTRAINT [sec_assets_type_df] DEFAULT 'equipment',
    [is_active] INT NOT NULL CONSTRAINT [sec_assets_active_df] DEFAULT 1,
    CONSTRAINT [sec_assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [sec_assets_qr_key] UNIQUE NONCLUSTERED ([qr_code])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.sec_inspections', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sec_inspections] (
    [id] INT NOT NULL IDENTITY(1,1),
    [client_id] NVARCHAR(100),
    [department_id] INT NOT NULL,
    [asset_id] INT NOT NULL,
    [inspector_username] NVARCHAR(200),
    [shift_label] NVARCHAR(200),
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [sec_inspections_status_df] DEFAULT 'draft',
    [signature_data] NVARCHAR(max),
    [notes] NVARCHAR(max),
    [created_at] NVARCHAR(50) NOT NULL,
    [updated_at] NVARCHAR(50) NOT NULL,
    [submitted_at] NVARCHAR(50),
    CONSTRAINT [sec_inspections_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.sec_inspection_results', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sec_inspection_results] (
    [id] INT NOT NULL IDENTITY(1,1),
    [inspection_id] INT NOT NULL,
    [item_id] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [note] NVARCHAR(max),
    [photo_data] NVARCHAR(max),
    CONSTRAINT [sec_inspection_results_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.sec_user_departments', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sec_user_departments] (
    [user_id] INT NOT NULL,
    [department_id] INT NOT NULL,
    CONSTRAINT [sec_user_departments_pkey] PRIMARY KEY CLUSTERED ([user_id], [department_id])
  );
END
`);

  await exec(`
IF COL_LENGTH('dbo.sec_inspection_results', 'photo_url') IS NULL
  ALTER TABLE [dbo].[sec_inspection_results] ADD [photo_url] NVARCHAR(1000) NULL;
`);

  await exec(`
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'sec_inspections_client_id_idx' AND object_id = OBJECT_ID(N'dbo.sec_inspections'))
  CREATE NONCLUSTERED INDEX [sec_inspections_client_id_idx] ON [dbo].[sec_inspections]([client_id]);
`);

  await exec(`
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'sec_inspections_dept_status_idx' AND object_id = OBJECT_ID(N'dbo.sec_inspections'))
  CREATE NONCLUSTERED INDEX [sec_inspections_dept_status_idx] ON [dbo].[sec_inspections]([department_id], [status]);
`);

  await seedSecurityInspectionIfEmpty();
  await seedSecurityDemoManagers();
}
