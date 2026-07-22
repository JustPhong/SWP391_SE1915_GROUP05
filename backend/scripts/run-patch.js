const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runPatches() {
  console.log('[Manual Patch] Initializing pre-flight SQL runner...');

  const patches = [
    '20260721_booking_stripe_columns.sql',
    '20260721_booking_deposit_applied_fields.sql',
    '20260721_booking_email_sent_field.sql',
    '20260721_update_defaults_pending.sql',
    '20260722_update_status_check_constraints.sql',
    '20260722_update_payment_type_check_constraint.sql',
    '20260722_update_payment_one_source_constraint.sql',
    '20260722_expand_payment_transaction_code.sql'
  ];

  for (const patchFile of patches) {
    const filePath = path.join(__dirname, '../prisma/manual_patches', patchFile);
    console.log(`[Manual Patch] Reading ${patchFile}...`);
    if (!fs.existsSync(filePath)) {
      console.error(`[Error] Patch file not found at: ${filePath}`);
      process.exit(1);
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    const batches = sql
      .split(/^\s*GO\s*;?\s*$/gim)
      .map(batch => batch.trim())
      .filter(Boolean);

    for (let idx = 0; idx < batches.length; idx++) {
      const batch = batches[idx];
      try {
        console.log(`[Manual Patch] Executing ${patchFile} (batch ${idx + 1}/${batches.length})...`);
        await prisma.$executeRawUnsafe(batch);
      } catch (err) {
        console.error(`[Error] Failed executing ${patchFile} at batch ${idx + 1}:`, err.message);
        process.exit(1);
      }
    }
    console.log(`[Manual Patch] Successfully completed ${patchFile}.`);
  }

  console.log('[Manual Patch] All patches applied successfully!');
  await prisma.$disconnect();
}

runPatches();
