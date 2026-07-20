import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('[Postcheck-Monthly] Verification started...');

  // 1. Read preflight report to compare baseline
  const preflightPath = path.join(__dirname, '../../monthly_package_preflight.json');
  if (!fs.existsSync(preflightPath)) {
    throw new Error('Preflight report not found! Please run generate-monthly-package-preflight.ts first.');
  }
  const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
  const preflightTotalPackages = preflight.preflightCounts.totalPackages;

  // 2. Total MonthlyPackage count post-migration
  const totalPackagesRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM [MonthlyPackage]`);
  const totalPackages = Number(totalPackagesRes[0]?.count ?? 0);

  // 3. Columns inspection
  const columns: any[] = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('MonthlyPackage', 'CheckInRecord', 'Payment')
  `);

  const hasSlotIdInPackage = columns.some(c => c.TABLE_NAME === 'MonthlyPackage' && c.COLUMN_NAME === 'slotId');

  const floorIdInPackage = columns.find(c => c.TABLE_NAME === 'MonthlyPackage' && c.COLUMN_NAME === 'floorId');
  const allowedTierInPackage = columns.find(c => c.TABLE_NAME === 'MonthlyPackage' && c.COLUMN_NAME === 'allowedTier');

  const floorIdInCheckIn = columns.find(c => c.TABLE_NAME === 'CheckInRecord' && c.COLUMN_NAME === 'floorId');
  const bookingIdInCheckIn = columns.find(c => c.TABLE_NAME === 'CheckInRecord' && c.COLUMN_NAME === 'bookingId');

  const bookingIdInPayment = columns.find(c => c.TABLE_NAME === 'Payment' && c.COLUMN_NAME === 'bookingId');

  // 4. Foreign Key and Actions check
  const fks: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      fk.name AS ForeignKeyName,
      tp.name AS ParentTable,
      cp.name AS ParentColumn,
      tr.name AS ReferencedTable,
      cr.name AS ReferencedColumn,
      fk.delete_referential_action_desc AS DeleteAction,
      fk.update_referential_action_desc AS UpdateAction
    FROM sys.foreign_keys fk
    INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
    INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
    INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
    WHERE tp.name IN ('MonthlyPackage', 'CheckInRecord', 'Payment')
  `);

  const pkgFloorFk = fks.find(f => f.ParentTable === 'MonthlyPackage' && f.ParentColumn === 'floorId');
  const rcdFloorFk = fks.find(f => f.ParentTable === 'CheckInRecord' && f.ParentColumn === 'floorId');
  const rcdBookingFk = fks.find(f => f.ParentTable === 'CheckInRecord' && f.ParentColumn === 'bookingId');
  const payBookingFk = fks.find(f => f.ParentTable === 'Payment' && f.ParentColumn === 'bookingId');

  // 5. CheckInRecord bookingId Filtered Unique Index
  const indexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT ind.name AS IndexName, ind.is_unique AS IsUnique, ind.has_filter AS HasFilter, ind.filter_definition AS FilterDefinition, col.name AS ColumnName
    FROM sys.indexes ind
    INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
    INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
    WHERE ind.object_id = OBJECT_ID(N'[dbo].[CheckInRecord]')
  `);

  const bookingIdUniqueIndex = indexes.find(i =>
    i.ColumnName === 'bookingId' &&
    i.IsUnique === true &&
    i.HasFilter === true &&
    i.FilterDefinition &&
    (i.FilterDefinition.includes('bookingId') || i.FilterDefinition.includes('[bookingId]'))
  );

  // 6. Payment uniqueness constraint preserved
  const paymentIndexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT ind.name AS IndexName, ind.is_unique AS IsUnique, ind.has_filter AS HasFilter, ind.filter_definition AS FilterDefinition
    FROM sys.indexes ind
    WHERE ind.object_id = OBJECT_ID(N'[dbo].[Payment]') AND ind.name = 'Payment_checkInRecordId_type_key'
  `);
  const paymentUniquenessPreserved = paymentIndexes.length > 0 && paymentIndexes[0].IsUnique === true;

  // 6.2 Payment transactionCode filtered unique index check
  const paymentTransactionCodeIndexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT ind.name AS IndexName, ind.is_unique AS IsUnique, ind.has_filter AS HasFilter, ind.filter_definition AS FilterDefinition
    FROM sys.indexes ind
    WHERE ind.object_id = OBJECT_ID(N'[dbo].[Payment]') AND ind.name = 'Payment_transactionCode_key'
  `);

  const paymentTransactionCodeIndexExists = paymentTransactionCodeIndexes.length > 0;
  const paymentTransactionCodeUnique = paymentTransactionCodeIndexes.some(i => i.IsUnique === true);
  const paymentTransactionCodeFiltered = paymentTransactionCodeIndexes.some(i =>
    i.HasFilter === true &&
    i.FilterDefinition &&
    (i.FilterDefinition.includes('transactionCode') || i.FilterDefinition.includes('[transactionCode]')) &&
    i.FilterDefinition.includes('IS NOT NULL')
  );

  // 6.3 Ensure no duplicate non-null transactionCode values actually exist in the table
  const duplicatesRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT transactionCode
      FROM [Payment]
      WHERE transactionCode IS NOT NULL
      GROUP BY transactionCode
      HAVING COUNT(*) > 1
    ) AS dup
  `);
  const noDuplicatesExist = Number(duplicatesRes[0]?.count ?? 0) === 0;

  // 7. Load all current slots
  const currentSlots: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, code, status, assignedVehicleId, floorId, tier
    FROM [ParkingSlot]
  `);
  const currentTotalSlotCount = currentSlots.length;

  // 8. Deduplicate preflight legacy slots by slotId
  const legacySlots: any[] = preflight.legacySlotsLinked || [];
  const uniqueLegacySlotsMap = new Map<string, any>();
  for (const ls of legacySlots) {
    if (ls.slotId) {
      uniqueLegacySlotsMap.set(ls.slotId, ls);
    }
  }
  const uniqueLegacySlots = Array.from(uniqueLegacySlotsMap.values());
  const uniqueLegacySlotCount = uniqueLegacySlots.length;

  // 9. Calculate slot counts and check total slots count
  const preflightTotalSlotCount = preflight.slotStatusCounts.reduce((acc: number, item: any) => acc + Number(item.count || item.Count || 0), 0);
  const parkingSlotCountUnchanged = currentTotalSlotCount === preflightTotalSlotCount;

  // 10. Verify legacy slot state transitions
  let legacyMonthlySlotsReleasedSafely = true;
  let expectedReleasedSlots = 0;
  let actualReleasedSlots = 0;

  for (const legacy of uniqueLegacySlots) {
    const current = currentSlots.find(s => s.id === legacy.slotId);

    // Check if this slot had an active checkin record in preflight
    const hadActiveCheckIn = (preflight.activeCheckInOnLegacySlots || []).some((c: any) => c.slotId === legacy.slotId);

    if (!hadActiveCheckIn) {
      expectedReleasedSlots++;
      const isCorrect = current &&
        current.status === 'AVAILABLE' &&
        current.assignedVehicleId === null &&
        current.floorId === legacy.floorId &&
        current.tier === legacy.tier &&
        current.code === legacy.slotCode;

      if (isCorrect) {
        actualReleasedSlots++;
      } else {
        legacyMonthlySlotsReleasedSafely = false;
      }
    } else {
      // Legacy slots with active checkin must retain occupied/active session status
      const isPreserved = current && current.status !== 'AVAILABLE';
      if (!isPreserved) {
        legacyMonthlySlotsReleasedSafely = false;
      }
    }
  }

  // 11. Verify non-legacy slots remain unchanged
  const currentNonLegacySlots = currentSlots.filter(s => !uniqueLegacySlotsMap.has(s.id));

  const currentNonLegacyAvailable = currentNonLegacySlots.filter(s => s.status === 'AVAILABLE').length;
  const currentNonLegacyOccupied = currentNonLegacySlots.filter(s => s.status === 'OCCUPIED').length;
  const currentNonLegacyReserved = currentNonLegacySlots.filter(s => s.status === 'RESERVED').length;

  const preflightAvailable = Number(preflight.slotStatusCounts.find((s: any) => (s.status || s.Status) === 'AVAILABLE')?.count ?? 0);
  const preflightOccupied = Number(preflight.slotStatusCounts.find((s: any) => (s.status || s.Status) === 'OCCUPIED')?.count ?? 0);
  const preflightReserved = Number(preflight.slotStatusCounts.find((s: any) => (s.status || s.Status) === 'RESERVED')?.count ?? 0);

  const legacyReservedCount = uniqueLegacySlots.filter(l => l.slotStatus === 'RESERVED').length;
  const legacyAvailableCount = uniqueLegacySlots.filter(l => l.slotStatus === 'AVAILABLE').length;
  const legacyOccupiedCount = uniqueLegacySlots.filter(l => l.slotStatus === 'OCCUPIED').length;

  const expectedNonLegacyAvailable = preflightAvailable - legacyAvailableCount;
  const expectedNonLegacyOccupied = preflightOccupied - legacyOccupiedCount;
  const expectedNonLegacyReserved = preflightReserved - legacyReservedCount;

  const nonLegacySlotsUnchanged =
    currentNonLegacyAvailable === expectedNonLegacyAvailable &&
    currentNonLegacyOccupied === expectedNonLegacyOccupied &&
    currentNonLegacyReserved === expectedNonLegacyReserved;

  let unexpectedChangedSlots = 0;
  if (!nonLegacySlotsUnchanged) {
    unexpectedChangedSlots = Math.abs(currentNonLegacyAvailable - expectedNonLegacyAvailable) +
                             Math.abs(currentNonLegacyOccupied - expectedNonLegacyOccupied) +
                             Math.abs(currentNonLegacyReserved - expectedNonLegacyReserved);
  }

  // Checks mapping
  const checks = {
    packageCountUnchanged: totalPackages === preflightTotalPackages,
    slotIdRemovedFromMonthlyPackage: !hasSlotIdInPackage,
    floorIdInPackageRequired: floorIdInPackage && floorIdInPackage.IS_NULLABLE === 'NO',
    allowedTierInPackageRequired: allowedTierInPackage && allowedTierInPackage.IS_NULLABLE === 'NO',
    floorIdInCheckInNullable: floorIdInCheckIn && floorIdInCheckIn.IS_NULLABLE === 'YES',
    bookingIdInCheckInNullable: bookingIdInCheckIn && bookingIdInCheckIn.IS_NULLABLE === 'YES',
    bookingIdInPaymentNullable: bookingIdInPayment && bookingIdInPayment.IS_NULLABLE === 'YES',
    monthlyPackageFloorFkCorrect: pkgFloorFk && pkgFloorFk.DeleteAction === 'NO_ACTION' && pkgFloorFk.UpdateAction === 'NO_ACTION',
    checkInRecordFloorFkCorrect: rcdFloorFk && rcdFloorFk.DeleteAction === 'NO_ACTION' && rcdFloorFk.UpdateAction === 'NO_ACTION',
    checkInRecordBookingFkCorrect: rcdBookingFk && rcdBookingFk.DeleteAction === 'NO_ACTION' && rcdBookingFk.UpdateAction === 'NO_ACTION',
    paymentBookingFkCorrect: payBookingFk && payBookingFk.DeleteAction === 'NO_ACTION' && payBookingFk.UpdateAction === 'NO_ACTION',
    filteredUniqueIndexOnCheckInBookingIdCorrect: !!bookingIdUniqueIndex,
    paymentUniquenessPreserved,
    paymentTransactionCodeUnique: paymentTransactionCodeIndexExists && paymentTransactionCodeUnique && paymentTransactionCodeFiltered,
    paymentTransactionCodeNoDuplicates: noDuplicatesExist,
    parkingSlotCountUnchanged,
    legacyMonthlySlotsReleasedSafely,
    nonLegacySlotsUnchanged,
  };

  const allPassed = Object.values(checks).every(Boolean);

  const report = {
    verificationTime: new Date().toISOString(),
    totalPackages,
    preflightTotalPackages,
    hasSlotIdInPackage,
    floorIdInPackage,
    allowedTierInPackage,
    floorIdInCheckIn,
    bookingIdInCheckIn,
    bookingIdInPayment,
    pkgFloorFk,
    rcdFloorFk,
    rcdBookingFk,
    payBookingFk,
    bookingIdUniqueIndex,
    paymentUniquenessPreserved,
    preflightTotalSlotCount,
    currentTotalSlotCount,
    uniqueLegacySlotCount,
    expectedReleasedSlots,
    actualReleasedSlots,
    unexpectedChangedSlots,
    checks,
    allPassed,
  };

  const postcheckPath = path.join(__dirname, '../../monthly_package_postcheck.json');
  fs.writeFileSync(postcheckPath, JSON.stringify(report, null, 2));

  console.log(`[Postcheck-Monthly] Report successfully written to ${postcheckPath}`);
  if (allPassed) {
    console.log('[Postcheck-Monthly] SUCCESS: All data integrity and schema checks passed successfully.');
  } else {
    console.error('[Postcheck-Monthly] FAILURE: Some schema or data verification checks failed! See monthly_package_postcheck.json for details.');
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('[Postcheck-Monthly] Error running verification script:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
