BEGIN TRY
    BEGIN TRANSACTION;

    -- Add frontImageUrl column to CheckInRecord
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[CheckInRecord]') 
        AND name = 'frontImageUrl'
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [frontImageUrl] NVARCHAR(500) NULL;
    END

    -- Add rearImageUrl column to CheckInRecord
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[CheckInRecord]') 
        AND name = 'rearImageUrl'
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [rearImageUrl] NVARCHAR(500) NULL;
    END

    -- Record migration
    DECLARE @migrationName NVARCHAR(255) = '20260717050000_add_checkin_image_urls';
    IF NOT EXISTS (
        SELECT 1 FROM [dbo].[_prisma_migrations] WHERE migration_name = @migrationName
    )
    BEGIN
        INSERT INTO [dbo].[_prisma_migrations] (migration_name, started_at, finished_at)
        VALUES (@migrationName, GETDATE(), GETDATE());
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
END CATCH;