/**
 * Seed / upsert the 5 FeeRule rows.
 * Run with:  npx ts-node --project tsconfig.json prisma/seedFeeRules.ts
 * or add to package.json scripts.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Natural unique key: vehicleType + ruleType + startHour */
type FeeRuleKey = { vehicleType: string; ruleType: string; startHour: number };

const RULES: Array<{
  vehicleType: string;
  ruleType: string;
  label: string;
  startHour: number;
  endHour: number;
  blockMinutes: number | null;
  amount: number;
}> = [
  { vehicleType: 'MOTORBIKE', ruleType: 'TIME_BLOCK',    label: 'Ban ngày (06:00–17:59)',  startHour:  6, endHour: 18, blockMinutes: 240, amount:  3000 },
  { vehicleType: 'MOTORBIKE', ruleType: 'TIME_BLOCK',    label: 'Ban đêm (18:00–05:59)',   startHour: 18, endHour:  6, blockMinutes: 240, amount:  4000 },
  { vehicleType: 'CAR',       ruleType: 'TIME_BLOCK',    label: 'Ban ngày (06:00–17:59)',  startHour:  6, endHour: 18, blockMinutes: 120, amount: 15000 },
  { vehicleType: 'CAR',       ruleType: 'TIME_BLOCK',    label: 'Buổi tối (18:00–23:59)', startHour: 18, endHour: 24, blockMinutes: 120, amount: 20000 },
  { vehicleType: 'CAR',       ruleType: 'FLAT_OVERNIGHT', label: 'Đêm muộn (00:00–05:59)', startHour:  0, endHour:  6, blockMinutes: null, amount: 100000 },
];

async function upsertRule(data: (typeof RULES)[number]) {
  const existing = await prisma.feeRule.findFirst({
    where: { vehicleType: data.vehicleType, ruleType: data.ruleType, startHour: data.startHour },
  });

  if (existing) {
    await prisma.feeRule.update({
      where: { id: existing.id },
      data: { label: data.label, endHour: data.endHour, blockMinutes: data.blockMinutes, amount: data.amount, isActive: true },
    });
    console.log(`  Updated: ${data.vehicleType} / ${data.ruleType} / ${data.startHour}h`);
  } else {
    await prisma.feeRule.create({ data: { ...data, isActive: true } });
    console.log(`  Created: ${data.vehicleType} / ${data.ruleType} / ${data.startHour}h`);
  }
}

async function main() {
  console.log('Seeding FeeRule rows...');
  for (const rule of RULES) {
    await upsertRule(rule);
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
