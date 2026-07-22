import prisma from '../config/db';

async function run() {
  try {
    const counts = await prisma.$queryRawUnsafe(`
      SELECT
          [depositStatus],
          COUNT(*) AS [rowCount]
      FROM [dbo].[Booking]
      GROUP BY [depositStatus]
      ORDER BY [depositStatus]
    `);
    console.log('DEPOSIT STATUS COUNTS:', JSON.stringify(counts, null, 2));

    const definition = await prisma.$queryRawUnsafe(`
      SELECT
          cc.name,
          cc.definition
      FROM sys.check_constraints AS cc
      WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Booking]')
        AND cc.name = N'CK_Booking_depositStatus'
    `);
    console.log('CONSTRAINT DEFINITION:', JSON.stringify(definition, null, 2));
  } catch (err: any) {
    console.error('ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
