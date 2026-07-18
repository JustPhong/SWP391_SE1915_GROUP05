import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log('Checking for duplicate payment records...');
  try {
    const duplicates = await prisma.$queryRawUnsafe<Array<{ checkInRecordId: string; type: string; duplicateCount: number }>>(`
      SELECT
          checkInRecordId,
          type,
          COUNT(*) AS duplicateCount
      FROM Payment
      WHERE checkInRecordId IS NOT NULL
      GROUP BY checkInRecordId, type
      HAVING COUNT(*) > 1;
    `);

    if (duplicates.length > 0) {
      console.log('❌ DUPLICATES FOUND:');
      console.table(duplicates);
    } else {
      console.log('✅ NO DUPLICATES FOUND. Unique index is data-safe to create.');
    }
  } catch (error) {
    console.error('Error checking duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
