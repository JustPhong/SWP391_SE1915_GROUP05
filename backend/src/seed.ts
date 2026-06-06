import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const FLOOR_DEFINITIONS: { floorCode: string; name: string; vehicleType: string; customerType: string; capacity: number; slots: { code: string; type: string }[] }[] = [
  {
    floorCode: 'G',
    name: 'Tầng G',
    vehicleType: 'CAR',
    customerType: 'MONTHLY',
    capacity: 20,
    slots: Array.from({ length: 20 }, (_, i) => ({
      code: `G-${String(i + 1).padStart(2, '0')}`,
      type: 'CAR',
    })),
  },
  {
    floorCode: '1',
    name: 'Tầng 1',
    vehicleType: 'MOTORBIKE',
    customerType: 'MONTHLY',
    capacity: 40,
    slots: Array.from({ length: 40 }, (_, i) => ({
      code: `1-${String(i + 1).padStart(2, '0')}`,
      type: 'MOTORBIKE',
    })),
  },
  {
    floorCode: '2',
    name: 'Tầng 2',
    vehicleType: 'MOTORBIKE',
    customerType: 'CASUAL',
    capacity: 40,
    slots: Array.from({ length: 40 }, (_, i) => ({
      code: `2-${String(i + 1).padStart(2, '0')}`,
      type: 'MOTORBIKE',
    })),
  },
  {
    floorCode: '3',
    name: 'Tầng 3',
    vehicleType: 'CAR',
    customerType: 'CASUAL',
    capacity: 20,
    slots: Array.from({ length: 20 }, (_, i) => ({
      code: `3-${String(i + 1).padStart(2, '0')}`,
      type: 'CAR',
    })),
  },
];

async function main() {
  console.log('Starting seed...');

  // ── Staff account (idempotent) ────────────────────────────────────────────
  const staffEmail = 'staff@test.com';
  const hash = await bcrypt.hash('staff123', 12);
  await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      fullName: 'Nhân viên A',
      email: staffEmail,
      passwordHash: hash,
      role: 'STAFF',
    },
  });
  console.log('Staff account ready: staff@test.com / staff123');

  // ── Manager account (idempotent) ──────────────────────────────────────────
  const managerEmail = 'manager@test.com';
  const managerHash = await bcrypt.hash('manager123', 12);
  await prisma.user.upsert({
    where: { email: managerEmail },
    update: {},
    create: {
      fullName: 'Quản lý A',
      email: managerEmail,
      passwordHash: managerHash,
      role: 'MANAGER',
    },
  });
  console.log('Manager account ready: manager@test.com / manager123');

  // ── Driver account (idempotent) ──────────────────────────────────────────
  const driverEmail = 'driver@test.com';
  const driverHash = await bcrypt.hash('driver123', 12);
  const driver = await prisma.user.upsert({
    where: { email: driverEmail },
    update: {},
    create: {
      fullName: 'Người lái xe',
      email: driverEmail,
      passwordHash: driverHash,
      role: 'DRIVER',
    },
  });
  console.log('Driver account ready: driver@test.com / driver123');

  // ── Seed floors + slots ──────────────────────────────────────────────────
  for (const floorDef of FLOOR_DEFINITIONS) {
    const floor = await prisma.floor.upsert({
      where: { floorCode: floorDef.floorCode },
      update: {},
      create: {
        floorCode: floorDef.floorCode,
        name: floorDef.name,
        vehicleType: floorDef.vehicleType,
        customerType: floorDef.customerType,
        capacity: floorDef.capacity,
      },
    });

    for (const slotDef of floorDef.slots) {
      await prisma.parkingSlot.upsert({
        where: { code: slotDef.code },
        update: {},
        create: {
          code: slotDef.code,
          type: slotDef.type,
          status: 'AVAILABLE',
          isFixed: false,
          floorId: floor.id,
        },
      });
    }
    console.log(`Floor ${floorDef.floorCode} (${floorDef.name}): ${floorDef.slots.length} slots seeded`);
  }

  // ── Walk-in system user (idempotent) ─────────────────────────────────────
  const walkinEmail = 'walkin@system.local';
  await prisma.user.upsert({
    where: { email: walkinEmail },
    update: {},
    create: {
      fullName: 'Walk-in Customer',
      email: walkinEmail,
      passwordHash: '', // no login needed
      role: 'DRIVER',
    },
  });
  console.log('Walk-in system user ready:', walkinEmail);

  // ── Monthly customer: Nguyen Van A / 51A-11111 (VALID) ──────────────────
  const driverAEmail = 'nguyenvana@test.com';
  const hashA = await bcrypt.hash('test123', 12);
  const driverA = await prisma.user.upsert({
    where: { email: driverAEmail },
    update: {},
    create: {
      fullName: 'Nguyen Van A',
      email: driverAEmail,
      passwordHash: hashA,
      role: 'DRIVER',
    },
  });

  const vehicleA = await prisma.vehicle.upsert({
    where: { plateNumber: '51A-11111' },
    update: {},
    create: {
      plateNumber: '51A-11111',
      type: 'CAR',
      isMonthly: true,
      ownerId: driverA.id,
    },
  });

  // Reserve slot G-01 for this customer
  await prisma.parkingSlot.update({
    where: { code: 'G-01' },
    data: { isFixed: true, assignedVehicleId: vehicleA.id, status: 'AVAILABLE' },
  });

  const validExpiry = new Date();
  validExpiry.setDate(validExpiry.getDate() + 30);

  await prisma.monthlyPackage.upsert({
    where: { vehicleId: vehicleA.id },
    update: {},
    create: {
      userId: driverA.id,
      vehicleId: vehicleA.id,
      slotId: (await prisma.parkingSlot.findUnique({ where: { code: 'G-01' } }))!.id,
      planName: 'Gói tháng',
      startDate: new Date(),
      expiryDate: validExpiry,
      price: 600000,
      status: 'ACTIVE',
    },
  });
  console.log('Monthly customer seeded: Nguyen Van A / 51A-11111 / G-01 (VALID, expires', validExpiry.toLocaleDateString('vi-VN'), ')');

  // ── Monthly customer: Tran Thi B / 51B-22222 (EXPIRED) ─────────────────
  const driverBEmail = 'tranthib@test.com';
  const hashB = await bcrypt.hash('test123', 12);
  const driverB = await prisma.user.upsert({
    where: { email: driverBEmail },
    update: {},
    create: {
      fullName: 'Tran Thi B',
      email: driverBEmail,
      passwordHash: hashB,
      role: 'DRIVER',
    },
  });

  const vehicleB = await prisma.vehicle.upsert({
    where: { plateNumber: '51B-22222' },
    update: {},
    create: {
      plateNumber: '51B-22222',
      type: 'CAR',
      isMonthly: true,
      ownerId: driverB.id,
    },
  });

  // Reserve slot G-02 for this customer
  await prisma.parkingSlot.update({
    where: { code: 'G-02' },
    data: { isFixed: true, assignedVehicleId: vehicleB.id, status: 'AVAILABLE' },
  });

  const expiredExpiry = new Date();
  expiredExpiry.setDate(expiredExpiry.getDate() - 5);

  await prisma.monthlyPackage.upsert({
    where: { vehicleId: vehicleB.id },
    update: {},
    create: {
      userId: driverB.id,
      vehicleId: vehicleB.id,
      slotId: (await prisma.parkingSlot.findUnique({ where: { code: 'G-02' } }))!.id,
      planName: 'Gói tháng',
      startDate: new Date(Date.now() - 10 * 86400000),
      expiryDate: expiredExpiry,
      price: 600000,
      status: 'EXPIRED',
    },
  });
  console.log('Monthly customer seeded: Tran Thi B / 51B-22222 / G-02 (EXPIRED since', expiredExpiry.toLocaleDateString('vi-VN'), ')');

  console.log('Seed complete —', 2, 'sample monthly customer(s) seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
