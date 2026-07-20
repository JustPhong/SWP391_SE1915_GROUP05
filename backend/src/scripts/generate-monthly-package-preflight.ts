import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('[Preflight-Monthly] Auditing monthly packages schema and data integrity (SELECT-only)...');

  // Database Name
  const dbNameRes: any[] = await prisma.$queryRawUnsafe(`SELECT DB_NAME() AS db_name`);
  const dbName = dbNameRes[0]?.db_name || 'unknown';

  // 1. Total MonthlyPackage count
  const totalPackageRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM [MonthlyPackage]`);
  const totalPackages = Number(totalPackageRes[0]?.count ?? 0);

  // 2. Packages with null slotId
  const nullSlotRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM [MonthlyPackage] WHERE slotId IS NULL`);
  const nullSlotPackages = Number(nullSlotRes[0]?.count ?? 0);

  // 3. Packages with invalid slotId (not in ParkingSlot)
  const invalidSlotRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count FROM [MonthlyPackage] m
    WHERE m.slotId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM [ParkingSlot] s WHERE s.id = m.slotId)
  `);
  const invalidSlotPackages = Number(invalidSlotRes[0]?.count ?? 0);

  // 4. Packages whose slot has null/invalid floorId
  const nullFloorSlotRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count FROM [MonthlyPackage] m
    JOIN [ParkingSlot] s ON m.slotId = s.id
    WHERE s.floorId IS NULL
  `);
  const nullFloorSlotPackages = Number(nullFloorSlotRes[0]?.count ?? 0);

  // 5. Packages whose linked slot has null tier
  const nullTierRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count FROM [MonthlyPackage] m
    JOIN [ParkingSlot] s ON m.slotId = s.id
    WHERE s.tier IS NULL
  `);
  const nullTierPackages = Number(nullTierRes[0]?.count ?? 0);

  // 6. Packages whose vehicle type does not match slot type
  const vehicleSlotMismatchRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count FROM [MonthlyPackage] m
    JOIN [ParkingSlot] s ON m.slotId = s.id
    JOIN [Vehicle] v ON m.vehicleId = v.id
    WHERE v.type <> s.type
  `);
  const vehicleSlotMismatchCount = Number(vehicleSlotMismatchRes[0]?.count ?? 0);

  // 7. Packages whose floor vehicleType does not match vehicle type
  const floorVehicleMismatchRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count FROM [MonthlyPackage] m
    JOIN [ParkingSlot] s ON m.slotId = s.id
    JOIN [Vehicle] v ON m.vehicleId = v.id
    JOIN [Floor] f ON s.floorId = f.id
    WHERE v.type <> f.vehicleType
  `);
  const floorVehicleMismatchCount = Number(floorVehicleMismatchRes[0]?.count ?? 0);

  // 8. Duplicate active packages per vehicle
  const duplicateActivePackages = await prisma.$queryRawUnsafe(`
    SELECT vehicleId, COUNT(*) as count
    FROM [MonthlyPackage]
    WHERE status = 'ACTIVE'
    GROUP BY vehicleId
    HAVING COUNT(*) > 1
  `);

  // 9. Legacy slots linked to MonthlyPackage
  const legacySlotsLinked = await prisma.$queryRawUnsafe(`
    SELECT
      m.id AS packageId,
      m.slotId,
      s.code AS slotCode,
      s.status AS slotStatus,
      s.assignedVehicleId,
      s.floorId,
      s.tier
    FROM [MonthlyPackage] m
    JOIN [ParkingSlot] s ON m.slotId = s.id
  `);

  // 10. Active CheckInRecord references to those legacy slots
  const activeCheckInOnLegacySlots = await prisma.$queryRawUnsafe(`
    SELECT
      c.id AS recordId,
      c.slotId,
      c.vehicleId,
      c.status
    FROM [CheckInRecord] c
    WHERE c.checkOutTime IS NULL
      AND c.slotId IN (SELECT slotId FROM [MonthlyPackage] WHERE slotId IS NOT NULL)
  `);

  // 11. Current slot status counts
  const slotStatusCounts = await prisma.$queryRawUnsafe(`
    SELECT status, COUNT(*) AS count
    FROM [ParkingSlot]
    GROUP BY status
  `);

  // 11.2 Duplicate non-null Payment.transactionCode values
  const duplicatePaymentTransactionCodes = await prisma.$queryRawUnsafe(`
    SELECT transactionCode, COUNT(*) as count
    FROM [Payment]
    WHERE transactionCode IS NOT NULL
    GROUP BY transactionCode
    HAVING COUNT(*) > 1
  `);

  // 12. MonthlyPackage Columns
  const monthlyPackageColumns = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'MonthlyPackage'
  `);

  // 13. Index Metadata for MonthlyPackage
  const monthlyPackageIndexes = await prisma.$queryRawUnsafe(`
    SELECT ind.name AS IndexName, ind.is_unique AS IsUnique, col.name AS ColumnName
    FROM sys.indexes ind
    INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
    INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
    WHERE ind.object_id = OBJECT_ID(N'[dbo].[MonthlyPackage]')
  `);

  // 14. Foreign Keys for MonthlyPackage
  const monthlyPackageForeignKeys = await prisma.$queryRawUnsafe(`
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
    WHERE tp.name = 'MonthlyPackage'
  `);

  const report = {
    dbName,
    preflightCounts: {
      totalPackages,
      nullSlotPackages,
      invalidSlotPackages,
      nullFloorSlotPackages,
      nullTierPackages,
      vehicleSlotMismatchCount,
      floorVehicleMismatchCount,
    },
    duplicateActivePackages,
    legacySlotsLinked,
    activeCheckInOnLegacySlots,
    slotStatusCounts,
    duplicatePaymentTransactionCodes,
    monthlyPackageColumns,
    monthlyPackageIndexes,
    monthlyPackageForeignKeys,
  };

  const reportPath = path.join(__dirname, '../../monthly_package_preflight.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[Preflight-Monthly] Report successfully written to ${reportPath}`);
}

main()
  .catch((err) => {
    console.error('[Preflight-Monthly] Error running audit script:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
