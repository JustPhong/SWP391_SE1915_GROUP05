BEGIN TRY
    BEGIN TRANSACTION;

    ------------------------------------------------------------
    -- prepaidAt on CheckInRecord
    ------------------------------------------------------------
    IF COL_LENGTH(N'dbo.CheckInRecord', N'prepaidAt') IS NULL
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord]
        ADD [prepaidAt] DATETIME2 NULL;
    END;

    ------------------------------------------------------------
    -- GuestAccessCredential Table
    ------------------------------------------------------------
    IF OBJECT_ID(N'dbo.GuestAccessCredential', N'U') IS NULL
    BEGIN
        CREATE TABLE [dbo].[GuestAccessCredential] (
            [id] NVARCHAR(1000) NOT NULL,
            [checkInRecordId] NVARCHAR(1000) NOT NULL,
            [pin] NVARCHAR(6) NOT NULL,
            [qrToken] NVARCHAR(255) NOT NULL,
            [active] BIT NOT NULL CONSTRAINT [GuestAccessCredential_active_df] DEFAULT 1,
            [issuedAt] DATETIME2 NOT NULL CONSTRAINT [GuestAccessCredential_issuedAt_df] DEFAULT CURRENT_TIMESTAMP,
            [revokedAt] DATETIME2 NULL,
            CONSTRAINT [GuestAccessCredential_pkey] PRIMARY KEY CLUSTERED ([id]),
            CONSTRAINT [GuestAccessCredential_checkInRecordId_key] UNIQUE NONCLUSTERED ([checkInRecordId]),
            CONSTRAINT [GuestAccessCredential_pin_key] UNIQUE NONCLUSTERED ([pin]),
            CONSTRAINT [GuestAccessCredential_qrToken_key] UNIQUE NONCLUSTERED ([qrToken]),
            CONSTRAINT [GuestAccessCredential_checkInRecordId_fkey] FOREIGN KEY ([checkInRecordId]) REFERENCES [dbo].[CheckInRecord] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
        );

        CREATE NONCLUSTERED INDEX [GuestAccessCredential_active_idx] ON [dbo].[GuestAccessCredential] ([active]);
    END;

    ------------------------------------------------------------
    -- Allow multiple PARKING_FEE payments for one parking visit
    ------------------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
          AND name = N'Payment_checkInRecordId_type_key'
    )
    BEGIN
        DROP INDEX [Payment_checkInRecordId_type_key]
        ON [dbo].[Payment];
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
          AND name = N'Payment_checkInRecordId_type_idx'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX
            [Payment_checkInRecordId_type_idx]
        ON [dbo].[Payment] ([checkInRecordId], [type]);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
