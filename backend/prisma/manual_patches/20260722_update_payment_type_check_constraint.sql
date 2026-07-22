-- Drop the existing CK_Payment_type constraint if present
DECLARE @ConstraintName NVARCHAR(128);
DECLARE @Sql NVARCHAR(MAX);

SELECT @ConstraintName = cc.name
FROM sys.check_constraints AS cc
WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]')
  AND cc.name = N'CK_Payment_type';

IF @ConstraintName IS NOT NULL
BEGIN
    SET @Sql =
        N'ALTER TABLE [dbo].[Payment] DROP CONSTRAINT '
        + QUOTENAME(@ConstraintName)
        + N';';

    EXEC sys.sp_executesql @Sql;
END;

-- Recreate CK_Payment_type allowing all legitimate application and legacy values
ALTER TABLE [dbo].[Payment] WITH CHECK
ADD CONSTRAINT [CK_Payment_type]
CHECK (
    [type] IN (
        N'MONTHLY',
        N'SESSION',
        N'BOOKING_FEE',
        N'PARKING_FEE',
        N'MONTHLY_PACKAGE'
    )
);

ALTER TABLE [dbo].[Payment]
CHECK CONSTRAINT [CK_Payment_type];
