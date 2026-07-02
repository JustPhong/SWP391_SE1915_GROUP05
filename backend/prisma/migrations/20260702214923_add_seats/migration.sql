BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[MonthlyPackage] ADD [autoRenew] BIT NOT NULL CONSTRAINT [MonthlyPackage_autoRenew_df] DEFAULT 0;

-- AlterTable
ALTER TABLE [dbo].[Vehicle] ADD [seats] INT;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
