BEGIN TRY
    BEGIN TRANSACTION;

    -- ==================================================
    -- A. Backfill Booking.floorId
    -- ==================================================
    IF COL_LENGTH(N'dbo.Booking', N'slotId') IS NOT NULL
    BEGIN
        UPDATE b
        SET b.floorId = ps.floorId
        FROM [dbo].[Booking] b
        INNER JOIN [dbo].[ParkingSlot] ps ON ps.id = b.slotId
        WHERE b.floorId IS NULL;
    END;

    -- ==================================================
    -- B. Validate Booking.floorId is non-null
    -- ==================================================
    IF EXISTS (SELECT 1 FROM [dbo].[Booking] WHERE [floorId] IS NULL)
    BEGIN
        THROW 50001, 'Validation Error: Booking.floorId backfill failed: null values remain.', 1;
    END;

    -- ==================================================
    -- C. Validate Booking.floorId references Floor.id
    -- ==================================================
    IF EXISTS (SELECT 1 FROM [dbo].[Booking] b WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Floor] f WHERE f.id = b.floorId))
    BEGIN
        THROW 50005, 'Validation Error: Some Booking.floorId values do not reference valid Floor rows.', 1;
    END;

    -- ==================================================
    -- D. ALTER Booking.floorId to INT NOT NULL (nullable to non-nullable)
    -- ==================================================
    IF EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = 'Booking'
          AND COLUMN_NAME = 'floorId'
          AND IS_NULLABLE = 'YES'
    )
    BEGIN
        ALTER TABLE [dbo].[Booking] ALTER COLUMN [floorId] INT NOT NULL;
        PRINT 'Altered Booking.floorId to INT NOT NULL.';
    END;

    -- ==================================================
    -- E. Backfill CheckInRecord.floorId
    -- ==================================================
    IF COL_LENGTH(N'dbo.CheckInRecord', N'slotId') IS NOT NULL
    BEGIN
        UPDATE r
        SET r.floorId = s.floorId
        FROM [dbo].[CheckInRecord] r
        INNER JOIN [dbo].[ParkingSlot] s ON s.id = r.slotId
        WHERE r.floorId IS NULL
          AND r.slotId IS NOT NULL
          AND EXISTS (SELECT 1 FROM [dbo].[ParkingSlot] ps WHERE ps.id = r.slotId);
    END;

    -- ==================================================
    -- F. Validate CheckInRecord.bookingId duplicates
    -- ==================================================
    IF EXISTS (
        SELECT 1
        FROM [dbo].[CheckInRecord]
        WHERE [bookingId] IS NOT NULL
        GROUP BY [bookingId]
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50003, 'Validation Error: Duplicate non-null bookingId values exist in CheckInRecord. Filtered unique index cannot be created.', 1;
    END;

    -- ==================================================
    -- G. Create Indexes (includes Booking_floorId_idx)
    -- ==================================================

    -- G.1 Index Booking(floorId)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'Booking'
          AND 1 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id AND ic2.key_ordinal > 0)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'floorId' AND ic.key_ordinal > 0
          )
    )
    BEGIN
        CREATE INDEX [Booking_floorId_idx] ON [dbo].[Booking] ([floorId]);
        PRINT 'Created Booking_floorId_idx.';
    END;

    -- G.2 Index CheckInRecord(floorId)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'CheckInRecord'
          AND 1 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id AND ic2.key_ordinal > 0)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'floorId' AND ic.key_ordinal > 0
          )
    )
    BEGIN
        CREATE INDEX [CheckInRecord_floorId_idx] ON [dbo].[CheckInRecord] ([floorId]);
        PRINT 'Created CheckInRecord_floorId_idx.';
    END;

    -- G.3 Index CheckInRecord(bookingId) (normal index)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'CheckInRecord'
          AND ind.is_unique = 0
          AND 1 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id AND ic2.key_ordinal > 0)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'bookingId' AND ic.key_ordinal > 0
          )
    )
    BEGIN
        CREATE INDEX [CheckInRecord_bookingId_idx] ON [dbo].[CheckInRecord] ([bookingId]);
        PRINT 'Created CheckInRecord_bookingId_idx.';
    END;

    -- G.4 Index Payment(bookingId)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'Payment'
          AND 1 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id AND ic2.key_ordinal > 0)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'bookingId' AND ic.key_ordinal > 0
          )
    )
    BEGIN
        CREATE INDEX [Payment_bookingId_idx] ON [dbo].[Payment] ([bookingId]);
        PRINT 'Created Payment_bookingId_idx.';
    END;

    -- G.5 Create Filtered Unique Index for CheckInRecord.bookingId
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes ind
        INNER JOIN sys.tables t ON ind.object_id = t.object_id
        WHERE t.name = 'CheckInRecord'
          AND ind.is_unique = 1
          AND ind.has_filter = 1
          AND (ind.filter_definition LIKE '%bookingId%IS%NOT%NULL%' OR ind.filter_definition LIKE '%[bookingId]%IS%NOT%NULL%')
          AND 1 = (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = ind.object_id AND ic2.index_id = ind.index_id)
          AND EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE ic.object_id = ind.object_id AND ic.index_id = ind.index_id AND c.name = 'bookingId'
          )
    )
    BEGIN
        CREATE UNIQUE INDEX [CheckInRecord_bookingId_unique_not_null]
        ON [dbo].[CheckInRecord] ([bookingId])
        WHERE [bookingId] IS NOT NULL;
        PRINT 'Created CheckInRecord_bookingId_unique_not_null filtered unique index.';
    END;

    -- ==================================================
    -- H. Create Foreign Keys (ON DELETE NO ACTION ON UPDATE NO ACTION)
    -- ==================================================

    -- H.1 Booking.floorId -> Floor.id
    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fkc.parent_object_id = OBJECT_ID(N'[dbo].[Booking]')
          AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Booking]'), 'floorId', 'ColumnId')
          AND fkc.referenced_object_id = OBJECT_ID(N'[dbo].[Floor]')
          AND fkc.referenced_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Floor]'), 'id', 'ColumnId')
    )
    BEGIN
        ALTER TABLE [dbo].[Booking]
        ADD CONSTRAINT [Booking_floorId_fkey]
        FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
        PRINT 'Created Booking_floorId_fkey.';
    END;

    -- H.2 CheckInRecord.floorId -> Floor.id
    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fkc.parent_object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
          AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[CheckInRecord]'), 'floorId', 'ColumnId')
          AND fkc.referenced_object_id = OBJECT_ID(N'[dbo].[Floor]')
          AND fkc.referenced_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Floor]'), 'id', 'ColumnId')
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord]
        ADD CONSTRAINT [CheckInRecord_floorId_fkey]
        FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
        PRINT 'Created CheckInRecord_floorId_fkey.';
    END;

    -- H.3 CheckInRecord.bookingId -> Booking.id
    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fkc.parent_object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
          AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[CheckInRecord]'), 'bookingId', 'ColumnId')
          AND fkc.referenced_object_id = OBJECT_ID(N'[dbo].[Booking]')
          AND fkc.referenced_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Booking]'), 'id', 'ColumnId')
    )
    BEGIN
        ALTER TABLE [dbo].[CheckInRecord]
        ADD CONSTRAINT [CheckInRecord_bookingId_fkey]
        FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
        PRINT 'Created CheckInRecord_bookingId_fkey.';
    END;

    -- H.4 Payment.bookingId -> Booking.id
    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fkc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]')
          AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Payment]'), 'bookingId', 'ColumnId')
          AND fkc.referenced_object_id = OBJECT_ID(N'[dbo].[Booking]')
          AND fkc.referenced_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Booking]'), 'id', 'ColumnId')
    )
    BEGIN
        ALTER TABLE [dbo].[Payment]
        ADD CONSTRAINT [Payment_bookingId_fkey]
        FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
        PRINT 'Created Payment_bookingId_fkey.';
    END;

    -- ==================================================
    -- I. Remove Booking.slotId dependencies safely
    -- ==================================================
    IF COL_LENGTH(N'dbo.Booking', N'slotId') IS NOT NULL
    BEGIN
        -- I.1 Discover and drop all foreign keys involving Booking.slotId
        DECLARE @BookingFkName NVARCHAR(255);
        DECLARE booking_fk_cursor CURSOR FOR
        SELECT fk.name
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fkc.parent_object_id = OBJECT_ID(N'[dbo].[Booking]')
          AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'[dbo].[Booking]'), 'slotId', 'ColumnId');

        OPEN booking_fk_cursor;
        FETCH NEXT FROM booking_fk_cursor INTO @BookingFkName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @DropBookingFkSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[Booking] DROP CONSTRAINT ' + QUOTENAME(@BookingFkName);
            EXEC sp_executesql @DropBookingFkSql;
            PRINT 'Dropped Booking.slotId foreign key: ' + @BookingFkName;
            FETCH NEXT FROM booking_fk_cursor INTO @BookingFkName;
        END;
        CLOSE booking_fk_cursor;
        DEALLOCATE booking_fk_cursor;

        -- I.2 Discover default constraints attached to Booking.slotId and drop them
        DECLARE @DefName NVARCHAR(255);
        DECLARE def_cursor CURSOR FOR
        SELECT d.name
        FROM sys.default_constraints d
        INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
        WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[Booking]')
          AND c.name = 'slotId';

        OPEN def_cursor;
        FETCH NEXT FROM def_cursor INTO @DefName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @DropDefSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[Booking] DROP CONSTRAINT ' + QUOTENAME(@DefName);
            EXEC sp_executesql @DropDefSql;
            PRINT 'Dropped Booking.slotId default constraint: ' + @DefName;
            FETCH NEXT FROM def_cursor INTO @DefName;
        END;
        CLOSE def_cursor;
        DEALLOCATE def_cursor;

        -- I.3 Discover check constraints directly depending on Booking.slotId and drop them
        DECLARE @CheckName NVARCHAR(255);
        DECLARE check_cursor CURSOR FOR
        SELECT cc.name
        FROM sys.check_constraints cc
        INNER JOIN sys.columns c ON cc.parent_column_id = c.column_id AND cc.parent_object_id = c.object_id
        WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Booking]')
          AND c.name = 'slotId';

        OPEN check_cursor;
        FETCH NEXT FROM check_cursor INTO @CheckName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @DropCheckSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[Booking] DROP CONSTRAINT ' + QUOTENAME(@CheckName);
            EXEC sp_executesql @DropCheckSql;
            PRINT 'Dropped Booking.slotId check constraint: ' + @CheckName;
            FETCH NEXT FROM check_cursor INTO @CheckName;
        END;
        CLOSE check_cursor;
        DEALLOCATE check_cursor;

        -- I.4 Discover indexes involving Booking.slotId and drop them safely
        DECLARE @IdxName NVARCHAR(255);
        DECLARE @IdxIsUniqueConstraint BIT;

        DECLARE idx_cursor CURSOR FOR
        SELECT DISTINCT ind.name, ind.is_unique_constraint
        FROM sys.indexes ind
        INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
        INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
        WHERE ind.object_id = OBJECT_ID(N'[dbo].[Booking]')
          AND col.name = 'slotId';

        OPEN idx_cursor;
        FETCH NEXT FROM idx_cursor INTO @IdxName, @IdxIsUniqueConstraint;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF @IdxName IS NOT NULL
            BEGIN
                -- never drop a primary key
                IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = @IdxName AND type = 'PK')
                BEGIN
                    IF @IdxIsUniqueConstraint = 1
                    BEGIN
                        DECLARE @DropConstraintSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[Booking] DROP CONSTRAINT ' + QUOTENAME(@IdxName);
                        EXEC sp_executesql @DropConstraintSql;
                        PRINT 'Dropped unique constraint ' + @IdxName;
                    END
                    ELSE
                    BEGIN
                        DECLARE @DropIndexSql NVARCHAR(MAX) = N'DROP INDEX ' + QUOTENAME(@IdxName) + N' ON [dbo].[Booking]';
                        EXEC sp_executesql @DropIndexSql;
                        PRINT 'Dropped index ' + @IdxName;
                    END;
                END;
            END;
            FETCH NEXT FROM idx_cursor INTO @IdxName, @IdxIsUniqueConstraint;
        END;
        CLOSE idx_cursor;
        DEALLOCATE idx_cursor;

        -- ==================================================
        -- J. Drop Booking.slotId
        -- ==================================================
        ALTER TABLE [dbo].[Booking] DROP COLUMN [slotId];
        PRINT 'Dropped Booking.slotId column.';
    END;

    COMMIT TRANSACTION;
    PRINT 'Phase 2: Backfill and Finalization committed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
