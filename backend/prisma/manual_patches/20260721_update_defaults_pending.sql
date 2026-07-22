-- Idempotent manual patch to alter default constraints in SQL Server for Payment and Booking tables.
-- Targets:
-- 1. Booking.status -> default 'PENDING_PAYMENT'
-- 2. Payment.status -> default 'PENDING'

-- ── 1. UPDATE DEFAULT CONSTRAINT FOR Booking.status ─────────────────────────
DECLARE @ConstraintName NVARCHAR(128);
DECLARE @Sql NVARCHAR(MAX);

SELECT @ConstraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[Booking]')
  AND c.name = N'status';

IF @ConstraintName IS NOT NULL
BEGIN
    SET @Sql = N'ALTER TABLE [dbo].[Booking] DROP CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
    EXEC sys.sp_executesql @Sql;
END;

ALTER TABLE [dbo].[Booking]
ADD CONSTRAINT [DF_Booking_status]
DEFAULT (N'PENDING_PAYMENT') FOR [status];


-- ── 2. UPDATE DEFAULT CONSTRAINT FOR Payment.status ─────────────────────────
DECLARE @ConstraintName2 NVARCHAR(128);
DECLARE @Sql2 NVARCHAR(MAX);

SELECT @ConstraintName2 = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]')
  AND c.name = N'status';

IF @ConstraintName2 IS NOT NULL
BEGIN
    SET @Sql2 = N'ALTER TABLE [dbo].[Payment] DROP CONSTRAINT ' + QUOTENAME(@ConstraintName2) + N';';
    EXEC sys.sp_executesql @Sql2;
END;

ALTER TABLE [dbo].[Payment]
ADD CONSTRAINT [DF_Payment_status]
DEFAULT (N'PENDING') FOR [status];
