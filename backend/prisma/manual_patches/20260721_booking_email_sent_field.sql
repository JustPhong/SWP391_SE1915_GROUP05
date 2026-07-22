BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Add Booking.bookingDepositEmailSentAt as DATETIME2 NULL if it does not exist
    IF COL_LENGTH(N'dbo.Booking', N'bookingDepositEmailSentAt') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Booking] ADD [bookingDepositEmailSentAt] DATETIME2 NULL;';
        PRINT 'Added column [bookingDepositEmailSentAt] to [Booking].';
    END;

    COMMIT TRANSACTION;
    PRINT 'Phase 3: Booking deposit email sent tracking column committed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
