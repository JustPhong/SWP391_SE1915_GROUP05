BEGIN TRY
    BEGIN TRANSACTION;

    -- Add monthlyAccessPin column if not exists
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'monthlyAccessPin') IS NULL
    BEGIN
        ALTER TABLE [dbo].[MonthlyPackage] ADD [monthlyAccessPin] NVARCHAR(6) NULL;
    END;

    -- Add monthlyAccessPinIssuedAt column if not exists
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'monthlyAccessPinIssuedAt') IS NULL
    BEGIN
        ALTER TABLE [dbo].[MonthlyPackage] ADD [monthlyAccessPinIssuedAt] DATETIME2 NULL;
    END;

    -- Create non-unique index if not exists
    IF NOT EXISTS (
        SELECT * FROM sys.indexes 
        WHERE object_id = OBJECT_ID(N'[dbo].[MonthlyPackage]') 
          AND name = N'MonthlyPackage_monthlyAccessPin_idx'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX [MonthlyPackage_monthlyAccessPin_idx] ON [dbo].[MonthlyPackage]([monthlyAccessPin]);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
