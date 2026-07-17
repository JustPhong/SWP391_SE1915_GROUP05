import prisma from './config/db';
import { monthlyPackageService } from './services/monthlyPackage.service';

async function main() {
  console.log('=== VERIFYING MOTORBIKE SLOTS TIERS ===');

  const floor = await prisma.floor.findFirst({
    where: {
      vehicleType: 'MOTORBIKE',
      customerType: 'MONTHLY'
    },
    include: { slots: true }
  });

  if (!floor) {
    console.error('Error: Monthly motorbike floor not found!');
    process.exit(1);
  }

  const slots = floor.slots;
  console.log(`Total monthly motorbike slots: ${slots.length}`);

  const counts = { VIP: 0, POPULAR: 0, REGULAR: 0 };
  for (const s of slots) {
    const t = s.tier || 'REGULAR';
    if (t === 'VIP' || t === 'POPULAR' || t === 'REGULAR') {
      counts[t]++;
    }
  }

  console.log(`VIP count: ${counts.VIP} (Expected: 12)`);
  console.log(`POPULAR count: ${counts.POPULAR} (Expected: 16)`);
  console.log(`REGULAR count: ${counts.REGULAR} (Expected: 12)`);

  console.log('\n=== REPRESENTATIVE SLOT TIERS ===');
  const targetSuffixes = ['01', '04', '08', '31', '34', '38'];
  for (const suffix of targetSuffixes) {
    const code = `${floor.floorCode}-${suffix}`;
    const s = slots.find(item => item.code === code);
    console.log(`Slot ${code}: tier = ${s?.tier ?? 'NOT FOUND'} (status = ${s?.status})`);
  }

  console.log('\n=== VERIFYING ZONE QUOTAS ===');
  const quotas = await monthlyPackageService.getZoneQuotas();
  console.log('CAR Quotas:', JSON.stringify(quotas.CAR, null, 2));
  console.log('MOTORBIKE Quotas:', JSON.stringify(quotas.MOTORBIKE, null, 2));
}

main()
  .catch(err => {
    console.error('Verification failed:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
