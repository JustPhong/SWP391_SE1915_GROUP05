BEGIN TRY
    BEGIN TRANSACTION;

    -- Add frontImageUrl column to CheckInRecord if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
        AND name = 'frontImageUrl'
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [frontImageUrl] NVARCHAR(500) NULL;
    END

    -- Add rearImageUrl column to CheckInRecord if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
        AND name = 'rearImageUrl'
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [rearImageUrl] NVARCHAR(500) NULL;
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
