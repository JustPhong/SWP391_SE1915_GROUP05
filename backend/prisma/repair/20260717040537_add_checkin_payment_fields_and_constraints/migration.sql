BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Add lostTicketReason to CheckInRecord if missing
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
        AND name = 'lostTicketReason'
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [lostTicketReason] NVARCHAR(500) NULL;
    END

    -- 2. Add lostTicketFullName to CheckInRecord if missing
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
        AND name = 'lostTicketFullName'
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [lostTicketFullName] NVARCHAR(100) NULL;
    END

    -- 3. Add lostTicketPhone to CheckInRecord if missing
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
        AND name = 'lostTicketPhone'
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord] ADD [lostTicketPhone] NVARCHAR(20) NULL;
    END

    -- 4. Check for duplicate Payment records that would prevent index creation
    DECLARE @DuplicateCount INT = 0;
    SELECT @DuplicateCount = COUNT(*)
    FROM (
        SELECT [checkInRecordId], [type]
        FROM [dbo].[Payment]
        WHERE [checkInRecordId] IS NOT NULL
        GROUP BY [checkInRecordId], [type]
        HAVING COUNT(*) > 1
    ) AS Dups;

    IF @DuplicateCount > 0
    BEGIN
        DECLARE @ErrMsg NVARCHAR(255) = N'Index creation failed: Duplicate payment records found for checkInRecordId and type. Please resolve duplicates before creating unique index.';
        THROW 50000, @ErrMsg, 1;
    END

    -- 5. Create filtered unique index on Payment if missing
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
        AND name = N'Payment_checkInRecordId_type_key'
    )
    BEGIN
        CREATE UNIQUE INDEX [Payment_checkInRecordId_type_key]
        ON [dbo].[Payment] ([checkInRecordId], [type])
        WHERE [checkInRecordId] IS NOT NULL;
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
