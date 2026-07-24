const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Drop old CK_Payment_type constraint
  try {
    await prisma.$executeRawUnsafe(`
      DECLARE @ConstraintName NVARCHAR(128);
      SELECT @ConstraintName = cc.name FROM sys.check_constraints AS cc WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]') AND cc.name = N'CK_Payment_type';
      IF @ConstraintName IS NOT NULL
        EXEC('ALTER TABLE [dbo].[Payment] DROP CONSTRAINT ' + QUOTENAME(@ConstraintName));
    `);
    console.log('Dropped CK_Payment_type');
  } catch(e) { console.log('Drop CK_Payment_type error:', e.message); }

  // Create new one with BOOKING_DEPOSIT
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE [dbo].[Payment] WITH CHECK ADD CONSTRAINT [CK_Payment_type] CHECK ([type] IN (N'MONTHLY', N'SESSION', N'BOOKING_FEE', N'PARKING_FEE', N'MONTHLY_PACKAGE', N'BOOKING_DEPOSIT'))`);
    console.log('Created CK_Payment_type with BOOKING_DEPOSIT');
  } catch(e) { console.log('Create CK_Payment_type error:', e.message); }

  // Drop CK_Payment_OneSource
  try {
    await prisma.$executeRawUnsafe(`
      DECLARE @ConstraintName NVARCHAR(128);
      SELECT @ConstraintName = cc.name FROM sys.check_constraints AS cc WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]') AND cc.name = N'CK_Payment_OneSource';
      IF @ConstraintName IS NOT NULL
        EXEC('ALTER TABLE [dbo].[Payment] DROP CONSTRAINT ' + QUOTENAME(@ConstraintName));
    `);
    console.log('Dropped CK_Payment_OneSource');
  } catch(e) { console.log('Drop CK_Payment_OneSource error:', e.message); }

  // Create new one that allows bookingId
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE [dbo].[Payment] WITH CHECK ADD CONSTRAINT [CK_Payment_OneSource] CHECK (
      CASE WHEN [checkInRecordId] IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN [monthlyPackageId] IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN [bookingId] IS NOT NULL THEN 1 ELSE 0 END = 1
    )`);
    console.log('Created CK_Payment_OneSource');
  } catch(e) { console.log('Create CK_Payment_OneSource error:', e.message); }

  await prisma.$disconnect();
  console.log('Done fixing constraints');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
