BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Add Booking.bookingDepositAppliedAt as DATETIME2 NULL if it does not exist
    IF COL_LENGTH(N'dbo.Booking', N'bookingDepositAppliedAt') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Booking] ADD [bookingDepositAppliedAt] DATETIME2 NULL;';
        PRINT 'Added column [bookingDepositAppliedAt] to [Booking].';
    END;

    -- 2. Add Booking.bookingDepositAppliedToSessionId as NVARCHAR(100) NULL if it does not exist
    IF COL_LENGTH(N'dbo.Booking', N'bookingDepositAppliedToSessionId') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Booking] ADD [bookingDepositAppliedToSessionId] NVARCHAR(100) NULL;';
        PRINT 'Added column [bookingDepositAppliedToSessionId] to [Booking].';
    END;

    COMMIT TRANSACTION;
    PRINT 'Phase 2: Deposit application tracking columns committed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
