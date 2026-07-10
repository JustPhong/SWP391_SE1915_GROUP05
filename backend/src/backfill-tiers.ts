import prisma from './config/db';

async function main() {
  console.log('Starting parking slot tier backfill...');

  // 1. Fetch floor G details
  const floorG = await prisma.floor.findUnique({
    where: { floorCode: 'G' },
    include: { slots: true },
  });

  if (!floorG) {
    throw new Error('Floor G not found in database!');
  }

  // Verify target floor G has vehicle type CAR and customer type MONTHLY
  if (floorG.vehicleType !== 'CAR' || floorG.customerType !== 'MONTHLY') {
    throw new Error(`Target Floor G has mismatched attributes: vehicleType=${floorG.vehicleType}, customerType=${floorG.customerType}`);
  }

  const slots = floorG.slots;
  console.log(`Found ${slots.length} slots on Floor G.`);

  // Expected slot codes definitions
  const vipCodes = ['G-01', 'G-02', 'G-11', 'G-12'];
  const popularCodes = ['G-03', 'G-04', 'G-05', 'G-06', 'G-13', 'G-14', 'G-15', 'G-16'];

  // 2. Perform validations
  // Verify all expected slots exist in database
  const allExpectedCodes = Array.from({ length: 20 }, (_, i) => `G-${String(i + 1).padStart(2, '0')}`);
  
  for (const expectedCode of allExpectedCodes) {
    const exists = slots.some(s => s.code === expectedCode);
    if (!exists) {
      throw new Error(`Validation Failed: Expected slot code ${expectedCode} is missing on Floor G.`);
    }
  }

  // Check for duplicates
  const codeCounts = slots.reduce((acc, s) => {
    acc[s.code] = (acc[s.code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  for (const [code, count] of Object.entries(codeCounts)) {
    if (count > 1) {
      throw new Error(`Validation Failed: Duplicate slot code ${code} detected on Floor G.`);
    }
  }

  console.log('All expected Floor G slots validated successfully. Committing backfill updates...');

  // 3. Perform updates
  let vipUpdated = 0;
  let popularUpdated = 0;
  let regularUpdated = 0;

  for (const slot of slots) {
    let targetTier = 'REGULAR';
    if (vipCodes.includes(slot.code)) {
      targetTier = 'VIP';
    } else if (popularCodes.includes(slot.code)) {
      targetTier = 'POPULAR';
    }

    await prisma.parkingSlot.update({
      where: { id: slot.id },
      data: { tier: targetTier },
    });

    if (targetTier === 'VIP') vipUpdated++;
    else if (targetTier === 'POPULAR') popularUpdated++;
    else regularUpdated++;
  }

  console.log('Backfill successfully completed!');
  console.log(`VIP slots updated: ${vipUpdated} (Expected: 4)`);
  console.log(`POPULAR slots updated: ${popularUpdated} (Expected: 8)`);
  console.log(`REGULAR slots updated: ${regularUpdated} (Expected: 8)`);

  if (vipUpdated !== 4 || popularUpdated !== 8 || regularUpdated !== 8) {
    throw new Error('Mismatch in update counts!');
  }
}

main()
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
