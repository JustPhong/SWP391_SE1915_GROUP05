const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Delete bad payment records with no source reference
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM [dbo].[Payment] WHERE checkInRecordId IS NULL AND monthlyPackageId IS NULL AND bookingId IS NULL`
  );
  console.log('Deleted ' + result + ' bad payment records');

  // Drop and recreate the constraint to validate
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE [dbo].[Payment] DROP CONSTRAINT [CK_Payment_OneSource]`);
    console.log('Dropped CK_Payment_OneSource');
  } catch(e) { console.log('Drop error (may be normal):', e.message); }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE [dbo].[Payment] WITH CHECK ADD CONSTRAINT [CK_Payment_OneSource] CHECK (
      CASE WHEN [checkInRecordId] IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN [monthlyPackageId] IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN [bookingId] IS NOT NULL THEN 1 ELSE 0 END = 1
    )`);
    console.log('Created CK_Payment_OneSource with CHECK');
  } catch(e) { console.log('Create error:', e.message); }

  await prisma.$disconnect();
  console.log('Done');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
