BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'driverCheckInImageUrl') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [driverCheckInImageUrl] NVARCHAR(500) NULL;
    END;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'driverCheckInImagePublicId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [driverCheckInImagePublicId] NVARCHAR(255) NULL;
    END;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'driverFaceCapturedAt') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [driverFaceCapturedAt] DATETIME2 NULL;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
