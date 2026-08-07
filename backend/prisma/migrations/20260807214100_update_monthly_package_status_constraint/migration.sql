-- Drop the existing status check constraint on MonthlyPackage
ALTER TABLE [dbo].[MonthlyPackage] DROP CONSTRAINT [CK_MonthlyPackage_status];

-- Create the updated check constraint allowing PENDING_PAYMENT, ACTIVE, and EXPIRED
ALTER TABLE [dbo].[MonthlyPackage] ADD CONSTRAINT [CK_MonthlyPackage_status]
    CHECK ([status] = 'PENDING_PAYMENT' OR [status] = 'ACTIVE' OR [status] = 'EXPIRED');
