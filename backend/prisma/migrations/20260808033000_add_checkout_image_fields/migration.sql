BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'frontCheckOutImageUrl') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [frontCheckOutImageUrl] NVARCHAR(500) NULL;
    END;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'frontCheckOutImagePublicId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [frontCheckOutImagePublicId] NVARCHAR(255) NULL;
    END;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'rearCheckOutImageUrl') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [rearCheckOutImageUrl] NVARCHAR(500) NULL;
    END;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'rearCheckOutImagePublicId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [rearCheckOutImagePublicId] NVARCHAR(255) NULL;
    END;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'driverCheckOutImageUrl') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [driverCheckOutImageUrl] NVARCHAR(500) NULL;
    END;

    IF COL_LENGTH(N'dbo.CheckInRecord', N'driverCheckOutImagePublicId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [driverCheckOutImagePublicId] NVARCHAR(255) NULL;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
