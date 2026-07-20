BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Record starting count of MonthlyPackages
    DECLARE @StartCount INT = 0;
    SELECT @StartCount = COUNT(*) FROM [dbo].[MonthlyPackage];

    -- ==================================================
    -- 2. Backfill MonthlyPackage.floorId and allowedTier
    -- ==================================================
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'slotId') IS NOT NULL
    BEGIN
        UPDATE m
        SET m.floorId = s.floorId,
            m.allowedTier = s.tier
        FROM [dbo].[MonthlyPackage] m
        INNER JOIN [dbo].[ParkingSlot] s ON m.slotId = s.id
        WHERE m.floorId IS NULL OR m.allowedTier IS NULL;
    END;

    -- ==================================================
    -- 3. Data Validation
    -- ==================================================
    -- Check that all packages have floorId
    IF EXISTS (SELECT 1 FROM [dbo].[MonthlyPackage] WHERE [floorId] IS NULL)
    BEGIN
        THROW 50001, 'Validation Error: Some MonthlyPackage rows have null floorId and cannot be backfilled.', 1;
    END;

    -- Check that all packages have allowedTier
    IF EXISTS (SELECT 1 FROM [dbo].[MonthlyPackage] WHERE [allowedTier] IS NULL)
    BEGIN
        THROW 50002, 'Validation Error: Some MonthlyPackage rows have null allowedTier and cannot be backfilled.', 1;
    END;

    -- Check that floorId references a valid Floor
    IF EXISTS (SELECT 1 FROM [dbo].[MonthlyPackage] m WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Floor] f WHERE f.id = m.floorId))
    BEGIN
        THROW 50003, 'Validation Error: Some MonthlyPackage.floorId values do not reference valid Floor rows.', 1;
    END;

    -- Check vehicle type matches Floor.vehicleType
    IF EXISTS (
        SELECT 1 FROM [dbo].[MonthlyPackage] m
        INNER JOIN [dbo].[Vehicle] v ON m.vehicleId = v.id
        INNER JOIN [dbo].[Floor] f ON m.floorId = f.id
        WHERE v.type <> f.vehicleType
    )
    BEGIN
        THROW 50005, 'Validation Error: Vehicle type does not match floor vehicle type.', 1;
    END;

    -- Check vehicle type matches legacy ParkingSlot.type (if slotId is not null)
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'slotId') IS NOT NULL
    BEGIN
        IF EXISTS (
            SELECT 1 FROM [dbo].[MonthlyPackage] m
            INNER JOIN [dbo].[Vehicle] v ON m.vehicleId = v.id
            INNER JOIN [dbo].[ParkingSlot] s ON m.slotId = s.id
            WHERE v.type <> s.type
        )
        BEGIN
            THROW 50006, 'Validation Error: Vehicle type does not match legacy slot type.', 1;
        END;
    END;

    -- Check that there are no duplicate active packages per vehicle
    IF EXISTS (
        SELECT vehicleId FROM [dbo].[MonthlyPackage]
        WHERE status = 'ACTIVE'
        GROUP BY vehicleId
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50007, 'Validation Error: Duplicate active monthly packages exist for the same vehicle.', 1;
    END;

    -- ==================================================
    -- 4. ALTER COLUMN to NOT NULL
    -- ==================================================
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = 'MonthlyPackage'
          AND COLUMN_NAME = 'floorId'
          AND IS_NULLABLE = 'YES'
    )
    BEGIN
        ALTER TABLE [dbo].[MonthlyPackage] ALTER COLUMN [floorId] INT NOT NULL;
        PRINT 'Altered MonthlyPackage.floorId to INT NOT NULL.';
    END;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = 'MonthlyPackage'
          AND COLUMN_NAME = 'allowedTier'
          AND IS_NULLABLE = 'YES'
    )
    BEGIN
        ALTER TABLE [dbo].[MonthlyPackage] ALTER COLUMN [allowedTier] NVARCHAR(30) NOT NULL;
        PRINT 'Altered MonthlyPackage.allowedTier to NVARCHAR(30) NOT NULL.';
    END;

    -- ==================================================
    -- 5. Create Indexes and Foreign Keys
    -- ==================================================

    -- 5.1 Foreign Key: MonthlyPackage.floorId -> Floor.id
    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fkc.parent_object_id = OBJECT_ID(N'[dbo].[MonthlyPackage]')
          AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[MonthlyPackage]'), 'floorId', 'ColumnId')
          AND fkc.referenced_object_id = OBJECT_ID(N'[dbo].[Floor]')
          AND fkc.referenced_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Floor]'), 'id', 'ColumnId')
    )
    BEGIN
        ALTER TABLE [dbo].[MonthlyPackage]
        ADD CONSTRAINT [MonthlyPackage_floorId_fkey]
        FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
        PRINT 'Created MonthlyPackage_floorId_fkey.';
    END;

    -- 5.2 Index: MonthlyPackage(floorId)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'MonthlyPackage'
          AND 1 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id AND ic2.key_ordinal > 0)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'floorId' AND ic.key_ordinal > 0
          )
    )
    BEGIN
        CREATE INDEX [MonthlyPackage_floorId_idx] ON [dbo].[MonthlyPackage] ([floorId]);
        PRINT 'Created MonthlyPackage_floorId_idx.';
    END;

    -- 5.3 Index: MonthlyPackage(allowedTier)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'MonthlyPackage'
          AND 1 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id AND ic2.key_ordinal > 0)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'allowedTier' AND ic.key_ordinal > 0
          )
    )
    BEGIN
        CREATE INDEX [MonthlyPackage_allowedTier_idx] ON [dbo].[MonthlyPackage] ([allowedTier]);
        PRINT 'Created MonthlyPackage_allowedTier_idx.';
    END;

    -- 5.4 Composite Capacity Index: MonthlyPackage(status, floorId, allowedTier)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'MonthlyPackage'
          AND 3 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id AND ic2.key_ordinal > 0)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'status' AND ic.key_ordinal = 1
          )
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'floorId' AND ic.key_ordinal = 2
          )
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'allowedTier' AND ic.key_ordinal = 3
          )
    )
    BEGIN
        CREATE INDEX [MonthlyPackage_status_floorId_allowedTier_idx] ON [dbo].[MonthlyPackage] ([status], [floorId], [allowedTier]);
    END;

    -- 5.5 Filtered Unique Index: Payment(transactionCode)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'Payment' AND ind.name = 'Payment_transactionCode_key'
    )
    BEGIN
        IF EXISTS (
            SELECT [transactionCode]
            FROM [dbo].[Payment]
            WHERE [transactionCode] IS NOT NULL
            GROUP BY [transactionCode]
            HAVING COUNT(*) > 1
        )
        BEGIN
            THROW 50020, 'Validation Error: Duplicate non-null transactionCode values exist in Payment table. Unique index cannot be created.', 1;
        END;

        CREATE UNIQUE INDEX [Payment_transactionCode_key] ON [dbo].[Payment] ([transactionCode]) WHERE [transactionCode] IS NOT NULL;
        PRINT 'Created filtered unique index Payment_transactionCode_key.';
    END;

    -- ==================================================
    -- 6. Safely Release Legacy Fixed Monthly Slots
    -- ==================================================
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'slotId') IS NOT NULL
    BEGIN
        DECLARE @LinkedSlotId UNIQUEIDENTIFIER;

        DECLARE linked_slots_cursor CURSOR FOR
        SELECT DISTINCT CAST(slotId AS UNIQUEIDENTIFIER)
        FROM [dbo].[MonthlyPackage]
        WHERE slotId IS NOT NULL;

        OPEN linked_slots_cursor;
        FETCH NEXT FROM linked_slots_cursor INTO @LinkedSlotId;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Release the slot if no active checkin record currently uses it
            IF NOT EXISTS (
                SELECT 1 FROM [dbo].[CheckInRecord]
                WHERE slotId = @LinkedSlotId AND checkOutTime IS NULL
            )
            BEGIN
                UPDATE [dbo].[ParkingSlot]
                SET status = 'AVAILABLE',
                    assignedVehicleId = NULL,
                    isFixed = 0
                WHERE id = @LinkedSlotId;
                PRINT 'Released legacy monthly slot: ' + CAST(@LinkedSlotId AS NVARCHAR(50));
            END
            ELSE
            BEGIN
                -- Defer clean status update to checkout, just remove the isFixed flag
                UPDATE [dbo].[ParkingSlot]
                SET isFixed = 0
                WHERE id = @LinkedSlotId;
                PRINT 'Deferred release of legacy slot (has active parking session): ' + CAST(@LinkedSlotId AS NVARCHAR(50));
            END;

            FETCH NEXT FROM linked_slots_cursor INTO @LinkedSlotId;
        END;
        CLOSE linked_slots_cursor;
        DEALLOCATE linked_slots_cursor;
    END;

    -- ==================================================
    -- 7. Drop MonthlyPackage.slotId Dependencies and Column
    -- ==================================================
    IF COL_LENGTH(N'dbo.MonthlyPackage', N'slotId') IS NOT NULL
    BEGIN
        -- 7.1 Discover and drop foreign keys referencing slotId
        DECLARE @FkName NVARCHAR(255);
        DECLARE fk_cursor CURSOR FOR
        SELECT fk.name
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fkc.parent_object_id = OBJECT_ID(N'[dbo].[MonthlyPackage]')
          AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[MonthlyPackage]'), 'slotId', 'ColumnId');

        OPEN fk_cursor;
        FETCH NEXT FROM fk_cursor INTO @FkName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @DropFkSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[MonthlyPackage] DROP CONSTRAINT ' + QUOTENAME(@FkName);
            EXEC sp_executesql @DropFkSql;
            PRINT 'Dropped foreign key constraint: ' + @FkName;
            FETCH NEXT FROM fk_cursor INTO @FkName;
        END;
        CLOSE fk_cursor;
        DEALLOCATE fk_cursor;

        -- 7.2 Discover and drop default constraints on slotId
        DECLARE @DefName NVARCHAR(255);
        DECLARE def_cursor CURSOR FOR
        SELECT d.name
        FROM sys.default_constraints d
        INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
        WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[MonthlyPackage]')
          AND c.name = 'slotId';

        OPEN def_cursor;
        FETCH NEXT FROM def_cursor INTO @DefName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @DropDefSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[MonthlyPackage] DROP CONSTRAINT ' + QUOTENAME(@DefName);
            EXEC sp_executesql @DropDefSql;
            PRINT 'Dropped default constraint: ' + @DefName;
            FETCH NEXT FROM def_cursor INTO @DefName;
        END;
        CLOSE def_cursor;
        DEALLOCATE def_cursor;

        -- 7.3 Discover and drop check constraints depending on slotId
        DECLARE @CheckName NVARCHAR(255);
        DECLARE check_cursor CURSOR FOR
        SELECT cc.name
        FROM sys.check_constraints cc
        INNER JOIN sys.columns c ON cc.parent_column_id = c.column_id AND cc.parent_object_id = c.object_id
        WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[MonthlyPackage]')
          AND c.name = 'slotId';

        OPEN check_cursor;
        FETCH NEXT FROM check_cursor INTO @CheckName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @DropCheckSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[MonthlyPackage] DROP CONSTRAINT ' + QUOTENAME(@CheckName);
            EXEC sp_executesql @DropCheckSql;
            PRINT 'Dropped check constraint: ' + @CheckName;
            FETCH NEXT FROM check_cursor INTO @CheckName;
        END;
        CLOSE check_cursor;
        DEALLOCATE check_cursor;

        -- 7.4 Discover and drop indexes involving slotId
        DECLARE @IdxName NVARCHAR(255);
        DECLARE @IdxIsUniqueConstraint BIT;
        DECLARE idx_cursor CURSOR FOR
        SELECT DISTINCT ind.name, ind.is_unique_constraint
        FROM sys.indexes ind
        INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
        INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
        WHERE ind.object_id = OBJECT_ID(N'[dbo].[MonthlyPackage]')
          AND col.name = 'slotId';

        OPEN idx_cursor;
        FETCH NEXT FROM idx_cursor INTO @IdxName, @IdxIsUniqueConstraint;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF @IdxName IS NOT NULL
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = @IdxName AND type = 'PK')
                BEGIN
                    IF @IdxIsUniqueConstraint = 1
                    BEGIN
                        DECLARE @DropConstraintSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[MonthlyPackage] DROP CONSTRAINT ' + QUOTENAME(@IdxName);
                        EXEC sp_executesql @DropConstraintSql;
                        PRINT 'Dropped unique constraint: ' + @IdxName;
                    END
                    ELSE
                    BEGIN
                        DECLARE @DropIndexSql NVARCHAR(MAX) = N'DROP INDEX ' + QUOTENAME(@IdxName) + N' ON [dbo].[MonthlyPackage]';
                        EXEC sp_executesql @DropIndexSql;
                        PRINT 'Dropped index: ' + @IdxName;
                    END;
                END;
            END;
            FETCH NEXT FROM idx_cursor INTO @IdxName, @IdxIsUniqueConstraint;
        END;
        CLOSE idx_cursor;
        DEALLOCATE idx_cursor;

        -- 7.5 Drop the slotId column itself
        ALTER TABLE [dbo].[MonthlyPackage] DROP COLUMN [slotId];
        PRINT 'Dropped MonthlyPackage.slotId column.';
    END;

  -- ==================================================
  -- 8. Final Count Verification
  -- ==================================================
  DECLARE @EndCount INT = 0;
  SELECT @EndCount = COUNT(*) FROM [dbo].[MonthlyPackage];

  IF @StartCount <> @EndCount
  BEGIN
      THROW 50010, 'Validation Error: MonthlyPackage row count has changed after migration!', 1;
  END;

  COMMIT TRANSACTION;
  PRINT 'Phase 2: MonthlyPackage backfill and finalization committed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
