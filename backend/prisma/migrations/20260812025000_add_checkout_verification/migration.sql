BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.CheckoutVerification', N'U') IS NULL
    BEGIN
        CREATE TABLE [dbo].[CheckoutVerification] (
            [id] NVARCHAR(1000) NOT NULL,
            [checkInRecordId] NVARCHAR(1000) NOT NULL,
            [normalizedPlate] NVARCHAR(50) NOT NULL,
            [vehicleType] NVARCHAR(30) NOT NULL,
            [verificationMethod] NVARCHAR(30) NOT NULL,
            [frontCheckOutImageUrl] NVARCHAR(500) NOT NULL,
            [frontCheckOutImagePublicId] NVARCHAR(255) NOT NULL,
            [rearCheckOutImageUrl] NVARCHAR(500) NOT NULL,
            [rearCheckOutImagePublicId] NVARCHAR(255) NOT NULL,
            [driverCheckOutImageUrl] NVARCHAR(500) NOT NULL,
            [driverCheckOutImagePublicId] NVARCHAR(255) NOT NULL,
            [verifiedAt] DATETIME2 NOT NULL CONSTRAINT [CheckoutVerification_verifiedAt_df] DEFAULT CURRENT_TIMESTAMP,
            [expiresAt] DATETIME2 NOT NULL,
            [createdAt] DATETIME2 NOT NULL CONSTRAINT [CheckoutVerification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT [CheckoutVerification_pkey] PRIMARY KEY CLUSTERED ([id]),
            CONSTRAINT [CheckoutVerification_checkInRecordId_fkey] FOREIGN KEY ([checkInRecordId]) REFERENCES [dbo].[CheckInRecord] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
        );
        
        CREATE INDEX [CheckoutVerification_checkInRecordId_createdAt_idx] ON [dbo].[CheckoutVerification]([checkInRecordId], [createdAt]);
        CREATE INDEX [CheckoutVerification_expiresAt_idx] ON [dbo].[CheckoutVerification]([expiresAt]);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
