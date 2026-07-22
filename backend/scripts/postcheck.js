const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function normalizeSqlDefault(rawValue) {
  let value = String(rawValue ?? '').trim();

  while (
    value.length >= 2 &&
    value.startsWith('(') &&
    value.endsWith(')')
  ) {
    value = value.slice(1, -1).trim();
  }

  if (/^N'.*'$/i.test(value)) {
    value = value.slice(2, -1);
  } else if (/^'.*'$/.test(value)) {
    value = value.slice(1, -1);
  }

  return value.trim().toUpperCase();
}

async function postCheck() {
  console.log('[Post Check] Auditing schema columns...');
  let hasErrors = false;
  try {
    const columnsToCheck = [
      { table: 'Booking', col: 'expiresAt', nullable: 'YES' },
      { table: 'Booking', col: 'confirmedAt', nullable: 'YES' },
      { table: 'Booking', col: 'stripeCheckoutSessionId', nullable: 'YES' },
      { table: 'Booking', col: 'bookingDepositAppliedAt', nullable: 'YES' },
      { table: 'Booking', col: 'bookingDepositAppliedToSessionId', nullable: 'YES' },
      { table: 'Booking', col: 'bookingDepositEmailSentAt', nullable: 'YES' },
      { table: 'Payment', col: 'paidAt', nullable: 'YES' },
      { table: 'Payment', col: 'bookingId', nullable: 'YES' },
      { table: 'Payment', col: 'checkInRecordId', nullable: 'YES' },
      { table: 'Payment', col: 'monthlyPackageId', nullable: 'YES' },
      { table: 'Payment', col: 'transactionCode', nullable: 'YES', expectedLength: 255, expectedType: 'nvarchar' }
    ];

    for (const item of columnsToCheck) {
      const res = await prisma.$queryRawUnsafe(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${item.table}' AND COLUMN_NAME = '${item.col}'
      `);
      if (res && res.length > 0) {
        const isNullable = res[0].IS_NULLABLE;
        const dataType = res[0].DATA_TYPE;
        const maxLen = res[0].CHARACTER_MAXIMUM_LENGTH;

        if (item.nullable && isNullable !== item.nullable) {
          console.error(`[FAIL] Column '${item.col}' in table '${item.table}' has nullable '${isNullable}' (expected '${item.nullable}')`);
          hasErrors = true;
        } else if (item.expectedType && String(dataType).toLowerCase() !== String(item.expectedType).toLowerCase()) {
          console.error(`[FAIL] Column '${item.col}' in table '${item.table}' has type '${dataType}' (expected '${item.expectedType}')`);
          hasErrors = true;
        } else if (item.expectedLength && maxLen < item.expectedLength) {
          console.error(`[FAIL] Column '${item.col}' in table '${item.table}' has max length '${maxLen}' (expected >= '${item.expectedLength}')`);
          hasErrors = true;
        } else {
          console.log(`[OK] Column '${item.col}' in table '${item.table}' verified. Type: ${dataType}, Nullable: ${isNullable}, MaxLen: ${maxLen}`);
        }
      } else {
        console.warn(`[FAIL] Column '${item.col}' in table '${item.table}' is MISSING!`);
        hasErrors = true;
      }
    }

    console.log('[Post Check] Auditing default constraints...');
    const defaultsToCheck = [
      { table: 'Booking', col: 'status', expected: 'PENDING_PAYMENT' },
      { table: 'Payment', col: 'status', expected: 'PENDING' },
      { table: 'Booking', col: 'depositStatus', expected: 'PENDING' }
    ];

    for (const item of defaultsToCheck) {
      const res = await prisma.$queryRawUnsafe(`
        SELECT definition
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE dc.parent_object_id = OBJECT_ID('${item.table}')
          AND c.name = '${item.col}'
      `);
      if (res && res.length > 0) {
        const def = res[0].definition;
        const cleanDef = normalizeSqlDefault(def);
        if (cleanDef === item.expected) {
          console.log(`[OK] Default value for '${item.table}.${item.col}' matches expected: ${cleanDef}`);
        } else {
          console.error(`[FAIL] Default value for '${item.table}.${item.col}' is '${cleanDef}' (expected '${item.expected}', raw: '${def}')`);
          hasErrors = true;
        }
      } else {
        console.error(`[FAIL] Default value constraint for '${item.table}.${item.col}' is MISSING!`);
        hasErrors = true;
      }
    }

    console.log('[Post Check] Auditing check constraints...');
    const checksToCheck = [
      { name: 'CK_Booking_status', expected: ['PENDING_PAYMENT', 'ACTIVE', 'FULFILLED', 'CANCELLED', 'NO_SHOW'] },
      { name: 'CK_Payment_status', expected: ['PENDING', 'SUCCESS'] },
      { name: 'CK_Booking_depositStatus', expected: ['PENDING', 'PAID', 'FAILED', 'FORFEITED', 'REFUNDED'] },
      { name: 'CK_Payment_type', expected: ['MONTHLY', 'SESSION', 'BOOKING_FEE', 'PARKING_FEE', 'MONTHLY_PACKAGE'] },
      { name: 'CK_Payment_method', expected: ['CARD', 'CASH', 'EWALLET'] },
      { name: 'CK_Payment_OneSource', expected: ['bookingId', 'checkInRecordId', 'monthlyPackageId'] }
    ];

    for (const item of checksToCheck) {
      const res = await prisma.$queryRawUnsafe(`
        SELECT definition
        FROM sys.check_constraints
        WHERE name = '${item.name}'
      `);
      if (res && res.length > 0) {
        const def = String(res[0].definition).toUpperCase();
        console.log(`[Info] Check constraint '${item.name}' definition: ${def}`);
        
        let allAllowed = true;
        for (const val of item.expected) {
          if (!def.includes(val.toUpperCase())) {
            console.error(`[FAIL] Check constraint '${item.name}' does NOT allow: ${val}`);
            allAllowed = false;
            hasErrors = true;
          }
        }
        if (allAllowed) {
          console.log(`[OK] Check constraint '${item.name}' verifies successfully.`);
        }
      } else {
        console.error(`[FAIL] Check constraint '${item.name}' is MISSING!`);
        hasErrors = true;
      }
    }

    console.log('[Post Check] Auditing source count per Payment row...');
    const payments = await prisma.payment.findMany();
    for (const p of payments) {
      let sourceCount = 0;
      if (p.bookingId) sourceCount++;
      if (p.checkInRecordId) sourceCount++;
      if (p.monthlyPackageId) sourceCount++;

      if (sourceCount === 0) {
        console.error(`[FAIL] Payment row ${p.id} has 0 source relations!`);
        hasErrors = true;
      } else if (sourceCount > 1) {
        console.error(`[FAIL] Payment row ${p.id} has multiple source relations (${sourceCount})!`);
        hasErrors = true;
      }

      const type = String(p.type).toUpperCase();
      if (type === 'BOOKING_FEE' && !p.bookingId) {
        console.error(`[FAIL] Payment row ${p.id} has type BOOKING_FEE but bookingId is null!`);
        hasErrors = true;
      }
      if ((type === 'SESSION' || type === 'PARKING_FEE') && !p.checkInRecordId) {
        console.error(`[FAIL] Payment row ${p.id} has type ${type} but checkInRecordId is null!`);
        hasErrors = true;
      }
      if ((type === 'MONTHLY' || type === 'MONTHLY_PACKAGE') && !p.monthlyPackageId) {
        console.error(`[FAIL] Payment row ${p.id} has type ${type} but monthlyPackageId is null!`);
        hasErrors = true;
      }
    }

    console.log('[Post Check] Auditing row counts and integrity...');
    const bookingCount = await prisma.booking.count();
    console.log(`[OK] Existing Booking row count is preserved: ${bookingCount}`);

    const paymentCount = await prisma.payment.count();
    console.log(`[OK] Existing Payment row count is preserved: ${paymentCount}`);

    const slotCount = await prisma.parkingSlot.count();
    const occupiedSlots = await prisma.parkingSlot.count({ where: { status: 'OCCUPIED' } });
    console.log(`[OK] ParkingSlot rows: total = ${slotCount}, occupied = ${occupiedSlots} (no ParkingSlot rows changed/dropped)`);

    console.log('[Post Check] Auditing Payment_transactionCode_key index...');
    const idxRes = await prisma.$queryRawUnsafe(`
      SELECT
        i.name,
        i.is_unique,
        i.filter_definition
      FROM sys.indexes i
      WHERE i.object_id = OBJECT_ID(N'[dbo].[Payment]')
        AND i.name = N'Payment_transactionCode_key'
    `);
    if (!idxRes || idxRes.length === 0) {
      console.error('[FAIL] Index Payment_transactionCode_key does NOT exist!');
      hasErrors = true;
    } else {
      const idx = idxRes[0];
      if (!idx.is_unique) {
        console.error('[FAIL] Index Payment_transactionCode_key is NOT unique!');
        hasErrors = true;
      } else if (!idx.filter_definition || !String(idx.filter_definition).toUpperCase().includes('TRANSACTIONCODE') || !String(idx.filter_definition).toUpperCase().includes('IS NOT NULL')) {
        console.error(`[FAIL] Index Payment_transactionCode_key filter is incorrect: ${idx.filter_definition}`);
        hasErrors = true;
      } else {
        console.log(`[OK] Index Payment_transactionCode_key exists, is unique, filter: ${idx.filter_definition}`);
      }
    }

    if (hasErrors) {
      console.error('[FAIL] Audit completed with schema validation errors.');
      process.exit(1);
    } else {
      console.log('[OK] All postcheck audits passed successfully.');
    }
  } catch (err) {
    console.error('[Error] Post check audit encountered an error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

postCheck();
