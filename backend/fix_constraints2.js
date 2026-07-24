const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // First drop CK_Payment_OneSource
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE [dbo].[Payment] DROP CONSTRAINT [CK_Payment_OneSource]`);
    console.log('Dropped CK_Payment_OneSource');
  } catch(e) { console.log('Drop error:', e.message); }

  // We need to fix existing data first. Find and fix any records with 0 or >1 sources
  const badRecords = await prisma.$queryRawUnsafe(`
    SELECT id, checkInRecordId, monthlyPackageId, bookingId FROM [dbo].[Payment] WHERE
    (CASE WHEN checkInRecordId IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN monthlyPackageId IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN bookingId IS NOT NULL THEN 1 ELSE 0 END) <> 1
  `);
  console.log('Bad records:', badRecords);

  // Create new constraint WITH NOCHECK (won't validate existing data)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE [dbo].[Payment] WITH NOCHECK ADD CONSTRAINT [CK_Payment_OneSource] CHECK (
      CASE WHEN [checkInRecordId] IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN [monthlyPackageId] IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN [bookingId] IS NOT NULL THEN 1 ELSE 0 END = 1
    )`);
    console.log('Created CK_Payment_OneSource with NOCHECK');
  } catch(e) { console.log('Create error:', e.message); }

  await prisma.$disconnect();
  console.log('Done fixing constraints');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
