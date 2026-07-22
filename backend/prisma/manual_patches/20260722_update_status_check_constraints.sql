-- Drop existing check constraints if they exist
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Booking_status' AND parent_object_id = OBJECT_ID('[dbo].[Booking]'))
BEGIN
    ALTER TABLE [dbo].[Booking] DROP CONSTRAINT [CK_Booking_status];
END

IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Payment_status' AND parent_object_id = OBJECT_ID('[dbo].[Payment]'))
BEGIN
    ALTER TABLE [dbo].[Payment] DROP CONSTRAINT [CK_Payment_status];
END

IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Booking_depositStatus' AND parent_object_id = OBJECT_ID('[dbo].[Booking]'))
BEGIN
    ALTER TABLE [dbo].[Booking] DROP CONSTRAINT [CK_Booking_depositStatus];
END

-- Recreate CK_Booking_status with all currently valid application statuses
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [CK_Booking_status] 
    CHECK ([status] IN ('PENDING_PAYMENT', 'ACTIVE', 'FULFILLED', 'CANCELLED', 'NO_SHOW'));

-- Recreate CK_Payment_status with all currently valid application statuses
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [CK_Payment_status] 
    CHECK ([status] IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED'));

-- Recreate CK_Booking_depositStatus with all currently valid and legacy application statuses
ALTER TABLE [dbo].[Booking] WITH CHECK ADD CONSTRAINT [CK_Booking_depositStatus] 
    CHECK ([depositStatus] IN ('PENDING', 'PAID', 'FAILED', 'FORFEITED', 'REFUNDED'));
