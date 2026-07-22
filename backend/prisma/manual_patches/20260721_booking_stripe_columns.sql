BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Add Booking.expiresAt as DATETIME2 NULL if it does not exist
    IF COL_LENGTH(N'dbo.Booking', N'expiresAt') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Booking] ADD [expiresAt] DATETIME2 NULL;';
        PRINT 'Added column [expiresAt] to [Booking].';
    END;

    -- 2. Add Booking.stripeCheckoutSessionId as NVARCHAR(100) NULL if it does not exist
    IF COL_LENGTH(N'dbo.Booking', N'stripeCheckoutSessionId') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Booking] ADD [stripeCheckoutSessionId] NVARCHAR(100) NULL;';
        PRINT 'Added column [stripeCheckoutSessionId] to [Booking].';
    END;

    -- 3. Add Booking.confirmedAt as DATETIME2 NULL if it does not exist
    IF COL_LENGTH(N'dbo.Booking', N'confirmedAt') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Booking] ADD [confirmedAt] DATETIME2 NULL;';
        PRINT 'Added column [confirmedAt] to [Booking].';
    END;

    COMMIT TRANSACTION;
    PRINT 'Phase 1: Additive columns for Booking committed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
