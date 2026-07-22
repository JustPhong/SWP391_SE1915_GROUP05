import prisma from '../config/db';

async function run() {
  try {
    const columns = await prisma.$queryRawUnsafe(`
      SELECT
          c.name,
          t.name AS dataType,
          c.is_nullable
      FROM sys.columns AS c
      JOIN sys.types AS t
        ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID(N'[dbo].[Payment]')
      ORDER BY c.column_id;
    `);
    console.log('PAYMENT COLUMNS:', JSON.stringify(columns, null, 2));

    const checkConstraints = await prisma.$queryRawUnsafe(`
      SELECT
          cc.name,
          cc.definition
      FROM sys.check_constraints AS cc
      WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[Payment]')
      ORDER BY cc.name;
    `);
    console.log('CHECK CONSTRAINTS:', JSON.stringify(checkConstraints, null, 2));
  } catch (err: any) {
    console.error('ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
