-- Alter Payment.paidAt column to be nullable
ALTER TABLE [dbo].[Payment] ALTER COLUMN [paidAt] datetime2 NULL;

-- Drop the existing CK_Payment_OneSource constraint if present
DECLARE @ConstraintName NVARCHAR(128);
DECLARE @Sql NVARCHAR(MAX);

SELECT @ConstraintName = cc.name
FROM sys.check_constraints AS cc
WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]')
  AND cc.name = N'CK_Payment_OneSource';

IF @ConstraintName IS NOT NULL
BEGIN
    SET @Sql =
        N'ALTER TABLE [dbo].[Payment] DROP CONSTRAINT '
        + QUOTENAME(@ConstraintName)
        + N';';

    EXEC sys.sp_executesql @Sql;
END;

-- Recreate CK_Payment_OneSource constraint using WITH CHECK
ALTER TABLE [dbo].[Payment] WITH CHECK
ADD CONSTRAINT [CK_Payment_OneSource]
CHECK (
    (
        [bookingId] IS NOT NULL
        AND [checkInRecordId] IS NULL
        AND [monthlyPackageId] IS NULL
        AND [type] = N'BOOKING_FEE'
    )
    OR
    (
        [bookingId] IS NULL
        AND [checkInRecordId] IS NOT NULL
        AND [monthlyPackageId] IS NULL
        AND [type] IN (N'SESSION', N'PARKING_FEE')
    )
    OR
    (
        [bookingId] IS NULL
        AND [checkInRecordId] IS NULL
        AND [monthlyPackageId] IS NOT NULL
        AND [type] IN (N'MONTHLY', N'MONTHLY_PACKAGE')
    )
);

ALTER TABLE [dbo].[Payment]
CHECK CONSTRAINT [CK_Payment_OneSource];
