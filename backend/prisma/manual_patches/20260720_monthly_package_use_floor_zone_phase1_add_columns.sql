BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Add MonthlyPackage.floorId as nullable if it does not exist
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'floorId') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[MonthlyPackage] ADD [floorId] INT NULL;';
        PRINT 'Added column [floorId] to [MonthlyPackage].';
    END;

    -- 2. Add MonthlyPackage.allowedTier as nullable if it does not exist
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'allowedTier') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[MonthlyPackage] ADD [allowedTier] NVARCHAR(30) NULL;';
        PRINT 'Added column [allowedTier] to [MonthlyPackage].';
    END;

    COMMIT TRANSACTION;
    PRINT 'Phase 1: Additive columns for MonthlyPackage committed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
