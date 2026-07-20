import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('[Preflight] Auditing database schema and data integrity (SELECT-only)...');

  // Database Name
  const dbNameRes: any[] = await prisma.$queryRawUnsafe(`SELECT DB_NAME() AS db_name`);
  const dbName = dbNameRes[0]?.db_name || 'unknown';

  // 1. Total Booking rows
  const totalBookingRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM [Booking]`);
  const totalBookings = Number(totalBookingRes[0]?.count ?? 0);

  // 2. Booking rows with null slotId (if slotId exists)
  let nullSlotIdBookings = 0;
  const bookingColumns: any[] = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Booking'
  `);
  const hasSlotIdCol = bookingColumns.some(c => c.COLUMN_NAME === 'slotId');
  if (hasSlotIdCol) {
    const nullSlotRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM [Booking] WHERE slotId IS NULL`);
    nullSlotIdBookings = Number(nullSlotRes[0]?.count ?? 0);
  }

  // 3. Booking rows with invalid slotId (does not reference ParkingSlot)
  let invalidSlotIdBookings = 0;
  if (hasSlotIdCol) {
    const invalidSlotRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS count FROM [Booking] b
      WHERE b.slotId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM [ParkingSlot] s WHERE s.id = b.slotId)
    `);
    invalidSlotIdBookings = Number(invalidSlotRes[0]?.count ?? 0);
  }

  // 4. Booking rows whose slot has null or invalid floorId
  let nullFloorIdSlotBookings = 0;
  if (hasSlotIdCol) {
    const nullFloorSlotRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS count FROM [Booking] b
      JOIN [ParkingSlot] s ON b.slotId = s.id
      WHERE s.floorId IS NULL
    `);
    nullFloorIdSlotBookings = Number(nullFloorSlotRes[0]?.count ?? 0);
  }

  // 5. Exact invalid Booking IDs and slot IDs
  let invalidBookingList: any[] = [];
  if (hasSlotIdCol) {
    invalidBookingList = await prisma.$queryRawUnsafe(`
      SELECT b.id, b.slotId
      FROM [Booking] b
      WHERE b.slotId IS NOT NULL
        AND (
          NOT EXISTS (SELECT 1 FROM [ParkingSlot] s WHERE s.id = b.slotId)
          OR EXISTS (SELECT 1 FROM [ParkingSlot] s WHERE s.id = b.slotId AND s.floorId IS NULL)
        )
    `);
  }

  // 6. Duplicate non-null CheckInRecord.bookingId values
  let duplicateCheckInBookingIds: any[] = [];
  const checkInBookingIdCol: any[] = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CheckInRecord' AND COLUMN_NAME = 'bookingId'
  `);
  if (checkInBookingIdCol.length > 0) {
    duplicateCheckInBookingIds = await prisma.$queryRawUnsafe(`
      SELECT bookingId, COUNT(*) as count
      FROM [CheckInRecord]
      WHERE bookingId IS NOT NULL
      GROUP BY bookingId
      HAVING COUNT(*) > 1
    `);
  }

  // 7. Duplicate non-null Payment.checkInRecordId + type values
  const duplicatePayments: any[] = await prisma.$queryRawUnsafe(`
    SELECT checkInRecordId, type, COUNT(*) as count
    FROM [Payment]
    WHERE checkInRecordId IS NOT NULL
    GROUP BY checkInRecordId, type
    HAVING COUNT(*) > 1
  `);

  // 8. Existing new columns
  const existingNewColumns: any[] = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_NAME = 'Booking' AND COLUMN_NAME = 'floorId')
       OR (TABLE_NAME = 'CheckInRecord' AND COLUMN_NAME IN ('floorId', 'bookingId'))
       OR (TABLE_NAME = 'Payment' AND COLUMN_NAME = 'bookingId')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);

  // 9. Exact foreign key metadata (including Actions)
  const foreignKeys: any[] = await prisma.$queryRawUnsafe(`
    SELECT
        fk.name AS ForeignKeyName,
        tp.name AS ParentTable,
        cp.name AS ParentColumn,
        tr.name AS ReferencedTable,
        cr.name AS ReferencedColumn,
        fk.delete_referential_action_desc AS DeleteAction,
        fk.update_referential_action_desc AS UpdateAction
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
    INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
    INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
    WHERE tp.name IN ('Booking', 'CheckInRecord', 'Payment', 'ParkingSlot', 'Floor')
       OR tr.name IN ('Booking', 'CheckInRecord', 'Payment', 'ParkingSlot', 'Floor')
    ORDER BY ParentTable, ForeignKeyName
  `);

  // 10. Exact index metadata
  const indexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT
        t.name AS TableName,
        ind.name AS IndexName,
        col.name AS ColumnName,
        ind.is_unique AS IsUnique,
        ind.is_unique_constraint AS IsUniqueConstraint,
        ind.has_filter AS HasFilter,
        ind.filter_definition AS FilterDefinition,
        ic.key_ordinal AS KeyOrdinal
    FROM sys.indexes ind
    INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
    INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
    INNER JOIN sys.tables t ON ind.object_id = t.object_id
    WHERE t.name IN ('Booking', 'CheckInRecord', 'Payment', 'ParkingSlot', 'Floor')
    ORDER BY t.name, ind.name, ic.key_ordinal
  `);

  // 11. Current ParkingSlot statuses grouped by status
  const slotStatusGroups: any[] = await prisma.$queryRawUnsafe(`
    SELECT status, COUNT(*) AS count
    FROM [ParkingSlot]
    GROUP BY status
    ORDER BY status
  `);

  // 12. Audit individual ParkingSlots status for post-check comparison
  const allSlots: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, code, status FROM [ParkingSlot]
  `);

  const preflightReport = {
    databaseName: dbName,
    preflightCounts: {
      totalBookings,
      nullSlotIdBookings,
      invalidSlotIdBookings,
      nullFloorIdSlotBookings,
      slotStatusGroups
    },
    allSlots,
    invalidBookings: invalidBookingList,
    duplicateCheckInBookingIds,
    duplicatePayments,
    existingNewColumns,
    foreignKeys,
    indexes
  };

  const outputPath = path.join(__dirname, '../../booking_patch_preflight.json');
  fs.writeFileSync(outputPath, JSON.stringify(preflightReport, null, 2), 'utf8');
  console.log(`[Preflight] Report successfully written to ${outputPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
