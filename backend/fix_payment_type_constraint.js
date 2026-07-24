const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Drop existing CK_Payment_type
  try {
    await prisma.$executeRawUnsafe(`
      DECLARE @ConstraintName NVARCHAR(128);
      DECLARE @Sql NVARCHAR(MAX);
      SELECT @ConstraintName = cc.name FROM sys.check_constraints AS cc
        WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]')
          AND cc.name = N'CK_Payment_type';
      IF @ConstraintName IS NOT NULL
      BEGIN
        SET @Sql = N'ALTER TABLE [dbo].[Payment] DROP CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
        EXEC sys.sp_executesql @Sql;
      END
    `);
    console.log('Dropped CK_Payment_type');
  } catch(e) { console.log('Drop error:', e.message); }

  // Create new CK_Payment_type which includes BOOKING_DEPOSIT
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE [dbo].[Payment] WITH CHECK
      ADD CONSTRAINT [CK_Payment_type]
      CHECK ([type] IN (
        N'MONTHLY',
        N'SESSION',
        N'BOOKING_FEE',
        N'PARKING_FEE',
        N'MONTHLY_PACKAGE',
        N'BOOKING_DEPOSIT'
      ))
    `);
    console.log('Created CK_Payment_type with BOOKING_DEPOSIT');
  } catch(e) { console.log('Create error:', e.message); }

  await prisma.$disconnect();
  console.log('Done fixing CK_Payment_type');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
