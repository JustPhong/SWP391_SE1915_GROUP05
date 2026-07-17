-- Add lost ticket fields to CheckInRecord
ALTER TABLE [CheckInRecord] ADD [lostTicketReason] NVARCHAR(500) NULL;
ALTER TABLE [CheckInRecord] ADD [lostTicketFullName] NVARCHAR(100) NULL;
ALTER TABLE [CheckInRecord] ADD [lostTicketPhone] NVARCHAR(20) NULL;

-- Add unique constraint on Payment(checkInRecordId, type)
-- This ensures idempotency: only one payment per checkInRecord per type
CREATE UNIQUE INDEX [Payment_checkInRecordId_type_key] ON [Payment] ([checkInRecordId], [type]) WHERE [checkInRecordId] IS NOT NULL;