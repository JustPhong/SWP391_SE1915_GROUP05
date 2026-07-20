BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Add Booking.floorId as nullable if it does not exist
    IF COL_LENGTH(N'dbo.Booking', N'floorId') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Booking] ADD [floorId] INT NULL;';
        PRINT 'Added column [floorId] to [Booking].';
    END;

    -- 2. Add CheckInRecord.floorId as nullable if it does not exist
    IF COL_LENGTH(N'dbo.CheckInRecord', N'floorId') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[CheckInRecord] ADD [floorId] INT NULL;';
        PRINT 'Added column [floorId] to [CheckInRecord].';
    END;

    -- 3. Add CheckInRecord.bookingId as nullable if it does not exist
    IF COL_LENGTH(N'dbo.CheckInRecord', N'bookingId') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[CheckInRecord] ADD [bookingId] NVARCHAR(1000) NULL;';
        PRINT 'Added column [bookingId] to [CheckInRecord].';
    END;

    -- 4. Add Payment.bookingId as nullable if it does not exist
    IF COL_LENGTH(N'dbo.Payment', N'bookingId') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'ALTER TABLE [dbo].[Payment] ADD [bookingId] NVARCHAR(1000) NULL;';
        PRINT 'Added column [bookingId] to [Payment].';
    END;

    COMMIT TRANSACTION;
    PRINT 'Phase 1: Additive columns committed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
