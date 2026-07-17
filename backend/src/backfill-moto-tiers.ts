import prisma from './config/db';

const VIP_CODES = new Set([
  '1-01', '1-02', '1-03',
  '1-11', '1-12', '1-13',
  '1-21', '1-22', '1-23',
  '1-31', '1-32', '1-33',
]);

const POPULAR_CODES = new Set([
  '1-04', '1-05', '1-06', '1-07',
  '1-14', '1-15', '1-16', '1-17',
  '1-24', '1-25', '1-26', '1-27',
  '1-34', '1-35', '1-36', '1-37',
]);

async function main() {
  console.log('=== Transactional Motorbike Monthly Tier Backfill ===\n');

  // 1. Locate monthly motorbike floor dynamically
  const floor = await prisma.floor.findFirst({
    where: {
      vehicleType: 'MOTORBIKE',
      customerType: 'MONTHLY',
    },
    include: { slots: true },
  });

  if (!floor) {
    throw new Error('Verification failed: Monthly motorbike floor not found.');
  }

  const slots = floor.slots;
  console.log(`Located monthly motorbike floor: "${floor.name}" (${floor.floorCode}) with ${slots.length} slots.`);

  // 2. Validate exactly 40 slots exist and match code expectations
  if (slots.length !== 40) {
    throw new Error(`Validation failed: Expected exactly 40 slots, but database has ${slots.length}.`);
  }

  // Pre-flight check codes: e.g. for floorCode '1', codes should be '1-01' to '1-40'
  const expectedCodes = Array.from({ length: 40 }, (_, i) => {
    const suffix = String(i + 1).padStart(2, '0');
    return `${floor.floorCode}-${suffix}`;
  });

  for (const expCode of expectedCodes) {
    const exists = slots.some(s => s.code === expCode);
    if (!exists) {
      throw new Error(`Validation failed: Expected slot code "${expCode}" is missing from database.`);
    }
  }

  // Calculate "before" counts
  const beforeCounts = { VIP: 0, POPULAR: 0, REGULAR: 0 };
  for (const s of slots) {
    const t = s.tier || 'REGULAR';
    if (t === 'VIP' || t === 'POPULAR' || t === 'REGULAR') {
      beforeCounts[t]++;
    }
  }

  console.log('\nBefore backfill counts:');
  console.log(`  VIP:     ${beforeCounts.VIP}`);
  console.log(`  POPULAR: ${beforeCounts.POPULAR}`);
  console.log(`  REGULAR: ${beforeCounts.REGULAR}`);

  // 3. Execute updates in a Prisma Transaction
  console.log('\nExecuting transactional updates...');
  await prisma.$transaction(async (tx) => {
    for (const slot of slots) {
      // Find tier mapping based on the standardized code mapping
      const suffix = slot.code.split('-')[1]; // E.g. '01'
      const matchCode = `1-${suffix}`; // Map checking to standard '1-xx' codes
      
      let targetTier = 'REGULAR';
      if (VIP_CODES.has(matchCode)) {
        targetTier = 'VIP';
      } else if (POPULAR_CODES.has(matchCode)) {
        targetTier = 'POPULAR';
      }

      // Update ONLY the tier column. Preserve status, isFixed, assignedVehicleId, etc.
      await tx.parkingSlot.update({
        where: { id: slot.id },
        data: { tier: targetTier },
      });
    }
  });

  // Verify "after" counts
  const updatedFloor = await prisma.floor.findUnique({
    where: { id: floor.id },
    include: { slots: true },
  });
  
  const afterCounts = { VIP: 0, POPULAR: 0, REGULAR: 0 };
  if (updatedFloor) {
    for (const s of updatedFloor.slots) {
      const t = s.tier || 'REGULAR';
      if (t === 'VIP' || t === 'POPULAR' || t === 'REGULAR') {
        afterCounts[t]++;
      }
    }
  }

  console.log('\nAfter backfill counts:');
  console.log(`  VIP:     ${afterCounts.VIP}  (expected: 12)`);
  console.log(`  POPULAR: ${afterCounts.POPULAR}  (expected: 16)`);
  console.log(`  REGULAR: ${afterCounts.REGULAR}  (expected: 12)`);

  if (afterCounts.VIP !== 12 || afterCounts.POPULAR !== 16 || afterCounts.REGULAR !== 12) {
    throw new Error('Verification failed: Post-update slot counts did not match target definition.');
  }

  console.log('\n=== Backfill Transaction Completed Successfully ===');
}

main()
  .catch(err => {
    console.error('\nBackfill aborted safely:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
