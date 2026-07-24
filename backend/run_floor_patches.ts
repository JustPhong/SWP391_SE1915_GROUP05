import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function run() {
  const patches = [
    '20260720_booking_use_floor_phase1_add_columns.sql',
    '20260720_booking_use_floor_phase2_finalize.sql',
    '20260720_monthly_package_use_floor_zone_phase1_add_columns.sql',
    '20260720_monthly_package_use_floor_zone_phase2_finalize.sql',
  ];

  for (const patchFile of patches) {
    const filePath = path.join(__dirname, 'prisma/manual_patches', patchFile);
    console.log('Running', patchFile);
    const sql = fs.readFileSync(filePath, 'utf8');
    const batches = sql
      .split(/^\s*GO\s*;?\s*$/gim)
      .map((b) => b.trim())
      .filter(Boolean);
    for (let i = 0; i < batches.length; i++) {
      try {
        await prisma.$executeRawUnsafe(batches[i]);
        console.log(`  Batch ${i + 1} OK`);
      } catch (err: any) {
        console.error(`  Batch ${i + 1} Error: ${err.message}`);
      }
    }
  }

  await prisma.$disconnect();
  console.log('All floor patches completed!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
