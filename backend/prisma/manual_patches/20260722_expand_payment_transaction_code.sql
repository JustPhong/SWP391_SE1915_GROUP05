SET NOCOUNT ON;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
      AND name = N'Payment_transactionCode_key'
      AND is_unique_constraint = 1
)
BEGIN
    ALTER TABLE [dbo].[Payment]
    DROP CONSTRAINT [Payment_transactionCode_key];
END
ELSE IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
      AND name = N'Payment_transactionCode_key'
)
BEGIN
    DROP INDEX [Payment_transactionCode_key]
    ON [dbo].[Payment];
END;

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
      AND name = N'transactionCode'
      AND (
          system_type_id <> TYPE_ID(N'nvarchar')
          OR max_length < 510
          OR is_nullable = 0
      )
)
BEGIN
    ALTER TABLE [dbo].[Payment]
    ALTER COLUMN [transactionCode] NVARCHAR(255) NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
      AND name = N'Payment_transactionCode_key'
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX
        [Payment_transactionCode_key]
    ON [dbo].[Payment] ([transactionCode])
    WHERE [transactionCode] IS NOT NULL;
END;
