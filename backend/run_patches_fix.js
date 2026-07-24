const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function run() {
  const patches = [
    '20260720_booking_use_floor_phase1_add_columns.sql',
    '20260720_booking_use_floor_phase2_finalize.sql',
    '20260720_monthly_package_use_floor_zone_phase1_add_columns.sql',
    '20260720_monthly_package_use_floor_zone_phase2_finalize.sql',
  ];

  const patchesDir = path.join(__dirname, 'prisma', 'manual_patches');

  for (const patchFile of patches) {
    const filePath = path.join(patchesDir, patchFile);
    console.log('Running', patchFile);
    if (!fs.existsSync(filePath)) {
      console.log(`  File not found: ${filePath}, skipping`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    const batches = sql
      .split(/^\s*GO\s*;?\s*$/gim)
      .map((b) => b.trim())
      .filter(Boolean);
    for (let i = 0; i < batches.length; i++) {
      try {
        await prisma.$executeRawUnsafe(batches[i]);
        console.log(`  Batch ${i + 1} OK`);
      } catch (err) {
        console.error(`  Batch ${i + 1} Error: ${err.message}`);
      }
    }
  }

  // Now run the remaining original patches
  const remainingPatches = [
    '20260721_booking_stripe_columns.sql',
    '20260721_booking_deposit_applied_fields.sql',
    '20260721_booking_email_sent_field.sql',
    '20260721_update_defaults_pending.sql',
    '20260722_update_status_check_constraints.sql',
    '20260722_update_payment_type_check_constraint.sql',
    '20260722_update_payment_one_source_constraint.sql',
    '20260722_expand_payment_transaction_code.sql',
  ];

  for (const patchFile of remainingPatches) {
    const filePath = path.join(patchesDir, patchFile);
    console.log('Running', patchFile);
    if (!fs.existsSync(filePath)) {
      console.log(`  File not found: ${filePath}, skipping`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    const batches = sql
      .split(/^\s*GO\s*;?\s*$/gim)
      .map((b) => b.trim())
      .filter(Boolean);
    for (let i = 0; i < batches.length; i++) {
      try {
        await prisma.$executeRawUnsafe(batches[i]);
        console.log(`  Batch ${i + 1} OK`);
      } catch (err) {
        console.error(`  Batch ${i + 1} Error: ${err.message}`);
      }
    }
  }

  await prisma.$disconnect();
  console.log('All patches completed!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
