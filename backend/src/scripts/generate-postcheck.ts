import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('[Postcheck] Verifying database schema changes and data integrity...');

  // Database Columns
  const columns: any[] = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('Booking', 'CheckInRecord', 'Payment', 'ParkingSlot', 'Floor')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);

  // Foreign keys (with referential actions)
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

  // Indexes
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

  // Verify Booking columns
  const bookingCols = columns.filter(c => c.TABLE_NAME === 'Booking');
  const hasFloorId = bookingCols.some(c => c.COLUMN_NAME === 'floorId');
  const isFloorIdNotNull = bookingCols.some(c => c.COLUMN_NAME === 'floorId' && c.IS_NULLABLE === 'NO');
  const hasSlotId = bookingCols.some(c => c.COLUMN_NAME === 'slotId');

  // Verify CheckInRecord columns
  const checkInCols = columns.filter(c => c.TABLE_NAME === 'CheckInRecord');
  const hasCheckInFloorId = checkInCols.some(c => c.COLUMN_NAME === 'floorId' && c.IS_NULLABLE === 'YES');
  const hasCheckInBookingId = checkInCols.some(c => c.COLUMN_NAME === 'bookingId' && c.IS_NULLABLE === 'YES');

  // Verify Payment columns
  const paymentCols = columns.filter(c => c.TABLE_NAME === 'Payment');
  const hasPaymentBookingId = paymentCols.some(c => c.COLUMN_NAME === 'bookingId' && c.IS_NULLABLE === 'YES');

  // Verify Foreign keys and Referential actions
  const bookingFkFloor = foreignKeys.find(fk => fk.ParentTable === 'Booking' && fk.ParentColumn === 'floorId' && fk.ReferencedTable === 'Floor');
  const checkInFkFloor = foreignKeys.find(fk => fk.ParentTable === 'CheckInRecord' && fk.ParentColumn === 'floorId' && fk.ReferencedTable === 'Floor');
  const checkInFkBooking = foreignKeys.find(fk => fk.ParentTable === 'CheckInRecord' && fk.ParentColumn === 'bookingId' && fk.ReferencedTable === 'Booking');
  const paymentFkBooking = foreignKeys.find(fk => fk.ParentTable === 'Payment' && fk.ParentColumn === 'bookingId' && fk.ReferencedTable === 'Booking');

  const matchesSchemaActions = (fk: any) => {
    return fk && fk.DeleteAction === 'NO_ACTION' && fk.UpdateAction === 'NO_ACTION';
  };

  // Verify Indexes structures
  const bookingFloorIdIndex = indexes.some(idx => idx.TableName === 'Booking' && idx.ColumnName === 'floorId');
  const checkInBookingIdUniqueIndex = indexes.some(idx =>
    idx.TableName === 'CheckInRecord' &&
    idx.ColumnName === 'bookingId' &&
    idx.IsUnique === true &&
    idx.HasFilter === true &&
    (idx.FilterDefinition && idx.FilterDefinition.includes('bookingId'))
  );

  // Check for duplicate indexes
  const duplicateIndexesFound: string[] = [];
  const groupedIdx = indexes.reduce((acc: any, curr: any) => {
    const key = `${curr.TableName}_${curr.ColumnName}_${curr.IsUnique}_${curr.HasFilter}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr.IndexName);
    return acc;
  }, {});
  for (const key in groupedIdx) {
    const names = [...new Set(groupedIdx[key])] as string[];
    if (names.length > 1) {
      duplicateIndexesFound.push(`Duplicate index configuration on key ${key}: ${names.join(', ')}`);
    }
  }

  // Load Preflight reports for comparison
  let preflightBookingsCount = 0;
  let preflightSlots: any[] = [];
  try {
    const preflightPath = path.join(__dirname, '../../booking_patch_preflight.json');
    if (fs.existsSync(preflightPath)) {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      preflightBookingsCount = preflight.preflightCounts?.totalBookings || 0;
      preflightSlots = preflight.allSlots || [];
    }
  } catch (err: any) {
    console.log(`[Postcheck] Warning: Preflight counts could not be loaded: ${err.message}`);
  }

  // Current counts
  const countARes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM [Booking]`);
  const currentBookingsCount = Number(countARes[0]?.count ?? 0);

  const currentSlots: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, code, status FROM [ParkingSlot]
  `);

  const bookingCountMatches = preflightBookingsCount === currentBookingsCount;

  // Compare status changes on individual slots
  const changedSlots: any[] = [];
  const preflightSlotMap: Record<string, string> = {};
  for (const s of preflightSlots) {
    preflightSlotMap[s.id] = s.status;
  }

  for (const s of currentSlots) {
    const prevStatus = preflightSlotMap[s.id];
    if (prevStatus && s.status !== prevStatus) {
      changedSlots.push({
        id: s.id,
        code: s.code,
        previousStatus: prevStatus,
        currentStatus: s.status
      });
    }
  }

  // Validate that only allowed status changes occurred
  // Since there are 0 legacy RESERVED slots from Booking, we expect exactly 0 changed slots.
  const expectedChanges = 0;
  const isSlotChangesValid = changedSlots.length === expectedChanges;

  const postcheckReport = {
    verifications: {
      booking: {
        floorIdExists: hasFloorId,
        floorIdIsNotNull: isFloorIdNotNull,
        slotIdRemoved: !hasSlotId,
        floorFkExists: !!bookingFkFloor,
        floorFkActionMatches: matchesSchemaActions(bookingFkFloor),
        floorIdIndexExists: bookingFloorIdIndex
      },
      checkInRecord: {
        floorIdExistsAndNullable: hasCheckInFloorId,
        bookingIdExistsAndNullable: hasCheckInBookingId,
        floorFkExists: !!checkInFkFloor,
        floorFkActionMatches: matchesSchemaActions(checkInFkFloor),
        bookingFkExists: !!checkInFkBooking,
        bookingFkActionMatches: matchesSchemaActions(checkInFkBooking),
        filteredUniqueBookingIdIndex: checkInBookingIdUniqueIndex
      },
      payment: {
        bookingIdExistsAndNullable: hasPaymentBookingId,
        bookingFkExists: !!paymentFkBooking,
        bookingFkActionMatches: matchesSchemaActions(paymentFkBooking)
      },
      integrity: {
        bookingCountUnchanged: bookingCountMatches,
        preflightBookings: preflightBookingsCount,
        currentBookings: currentBookingsCount,
        slotChangesValid: isSlotChangesValid,
        changedSlotsCount: changedSlots.length,
        changedSlots: changedSlots
      },
      duplicateIndexesFound
    },
    columns,
    foreignKeys,
    indexes
  };

  const outputPath = path.join(__dirname, '../../booking_patch_postcheck.json');
  fs.writeFileSync(outputPath, JSON.stringify(postcheckReport, null, 2), 'utf8');
  console.log(`[Postcheck] Verification report successfully written to ${outputPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
