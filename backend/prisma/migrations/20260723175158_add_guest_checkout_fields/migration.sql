DECLARE @migrationName NVARCHAR(255) = '20260723175158_add_guest_checkout_fields';
IF NOT EXISTS (
    SELECT 1 FROM [dbo].[_prisma_migrations] WHERE migration_name = @migrationName
)
BEGIN
    INSERT INTO [dbo].[_prisma_migrations] (migration_name, started_at, finished_at)
    VALUES (@migrationName, GETDATE(), GETDATE());
END
GO

ALTER TABLE [dbo].[CheckInRecord] ADD [guestCode] NVARCHAR(10) NULL;
ALTER TABLE [dbo].[CheckInRecord] ADD [prepaidAt] DATETIME2 NULL;
ALTER TABLE [dbo].[CheckInRecord] ADD [prepaidFee] DECIMAL(10, 2) NULL;
ALTER TABLE [dbo].[CheckInRecord] ADD [prepaidMethod] NVARCHAR(30) NULL;
ALTER TABLE [dbo].[CheckInRecord] ADD [graceExpiresAt] DATETIME2 NULL;
ALTER TABLE [dbo].[CheckInRecord] ADD [exitedAt] DATETIME2 NULL;
GO

CREATE NONCLUSTERED INDEX [CheckInRecord_guestCode_idx] ON [dbo].[CheckInRecord] ([guestCode]);
GO