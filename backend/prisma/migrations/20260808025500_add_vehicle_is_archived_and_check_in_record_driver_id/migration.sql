-- 1. Add isArchived to Vehicle table if it does not exist
IF COL_LENGTH('[dbo].[Vehicle]', 'isArchived') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vehicle] ADD [isArchived] BIT NOT NULL CONSTRAINT [Vehicle_isArchived_df] DEFAULT 0;
END;

-- 2. Add driverId to CheckInRecord table if it does not exist, or alter it to NVARCHAR(1000) if it does.
-- We use dynamic SQL for ALTER COLUMN to prevent batch compilation errors when driverId is created in the same batch.
IF COL_LENGTH('[dbo].[CheckInRecord]', 'driverId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CheckInRecord] ADD [driverId] NVARCHAR(1000) NULL;
END
ELSE
BEGIN
    EXEC sp_executesql N'ALTER TABLE [dbo].[CheckInRecord] ALTER COLUMN [driverId] NVARCHAR(1000) NULL;';
END;

-- 3. Add foreign key constraint if it does not exist (using dynamic SQL for compiler safety)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys 
    WHERE name = 'CheckInRecord_driverId_fkey' 
      AND parent_object_id = OBJECT_ID('[dbo].[CheckInRecord]')
)
BEGIN
    EXEC sp_executesql N'
    ALTER TABLE [dbo].[CheckInRecord] ADD CONSTRAINT [CheckInRecord_driverId_fkey]
        FOREIGN KEY ([driverId]) REFERENCES [dbo].[User]([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
    ';
END;

-- 4. Create index on CheckInRecord.driverId if it does not exist (using dynamic SQL for compiler safety)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'CheckInRecord_driverId_idx' 
      AND object_id = OBJECT_ID('[dbo].[CheckInRecord]')
)
BEGIN
    EXEC sp_executesql N'CREATE NONCLUSTERED INDEX [CheckInRecord_driverId_idx] ON [dbo].[CheckInRecord]([driverId]);';
END;

-- 5. Backfill historical records using dynamic SQL to prevent compilation errors in the same batch
EXEC sp_executesql N'
UPDATE cr
SET cr.[driverId] = v.[ownerId]
FROM [dbo].[CheckInRecord] cr
INNER JOIN [dbo].[Vehicle] v ON cr.[vehicleId] = v.[id]
INNER JOIN [dbo].[User] u ON v.[ownerId] = u.[id]
WHERE u.[email] <> N''walkin@system.local''
  AND cr.[driverId] IS NULL;
';
