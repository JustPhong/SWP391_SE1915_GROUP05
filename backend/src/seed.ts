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

// ── Permission definitions ──────────────────────────────────────────
const PERMISSIONS = [
  // Check-in / Check-out
  { key: 'checkin.create',   label: 'Tạo check-in',       category: 'Check-in / Check-out' },
  { key: 'checkout.process', label: 'Xử lý check-out',     category: 'Check-in / Check-out' },
  { key: 'slotmap.view',     label: 'Xem sơ đồ slot',      category: 'Check-in / Check-out' },
  // Gói tháng & Đặt chỗ
  { key: 'package.buy',      label: 'Mua gói tháng',       category: 'Gói tháng & Đặt chỗ' },
  { key: 'booking.create',   label: 'Tạo đặt chỗ',         category: 'Gói tháng & Đặt chỗ' },
  { key: 'driver.dashboard', label: 'Xem dashboard tài xế', category: 'Gói tháng & Đặt chỗ' },
  // Báo cáo & Thống kê
  { key: 'report.overview',  label: 'Xem tổng quan',      category: 'Báo cáo & Thống kê' },
  { key: 'report.revenue',  label: 'Xem doanh thu',       category: 'Báo cáo & Thống kê' },
  { key: 'report.occupancy',label: 'Xem tỷ lệ lấp đầy',  category: 'Báo cáo & Thống kê' },
  { key: 'report.traffic',  label: 'Xem lưu lượng',       category: 'Báo cáo & Thống kê' },
  { key: 'report.export',   label: 'Xuất báo cáo',        category: 'Báo cáo & Thống kê' },
  // Quản trị hệ thống
  { key: 'account.manage',  label: 'Quản lý tài khoản',  category: 'Quản trị hệ thống' },
  { key: 'permission.manage',label: 'Phân quyền',         category: 'Quản trị hệ thống' },
  { key: 'slotconfig.manage',label: 'Cấu hình slot',      category: 'Quản trị hệ thống' },
];

// Owner map: which role is the "primary" for each permission
const PERMISSION_OWNERS: Record<string, string[]> = {
  'checkin.create':     ['STAFF'],
  'checkout.process':   ['STAFF'],
  'slotmap.view':       ['STAFF'],
  'package.buy':         ['DRIVER'],
  'booking.create':      ['DRIVER'],
  'driver.dashboard':    ['DRIVER'],
  'report.overview':    ['MANAGER'],
  'report.revenue':     ['MANAGER'],
  'report.occupancy':   ['MANAGER'],
  'report.traffic':     ['MANAGER'],
  'report.export':      ['MANAGER'],
  'account.manage':     ['ADMIN'],
  'permission.manage':  ['ADMIN'],
  'slotconfig.manage':  ['ADMIN'],
};

const ALL_ROLES = ['DRIVER', 'STAFF', 'MANAGER', 'ADMIN'];

async function seedRoles() {
  for (const name of ALL_ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Roles seeded: ${ALL_ROLES.join(', ')}`);
}

async function seedPermissions() {
  // Upsert all permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, category: p.category },
      create: p,
    });
  }
  console.log(`Permissions seeded: ${PERMISSIONS.length}`);

  // Build role × permission matrix
  const allPermKeys = PERMISSIONS.map((p) => p.key);

  // Resolve roleId for each role name once
  const roleMap: Record<string, number> = {};
  for (const roleName of ALL_ROLES) {
    const r = await prisma.role.findUnique({ where: { name: roleName } });
    roleMap[roleName] = r!.id;
  }

  for (const role of ALL_ROLES) {
    for (const permKey of allPermKeys) {
      const owners = PERMISSION_OWNERS[permKey] ?? [];
      const allowed = role === 'ADMIN' || owners.includes(role);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId: roleMap[role], permissionKey: permKey } },
        update: { allowed },
        create: { permissionKey: permKey, allowed, roleId: roleMap[role] },
      });
    }
  }
  console.log(`RolePermission matrix seeded for ${ALL_ROLES.length} roles × ${allPermKeys.length} permissions`);
}

async function main() {
  console.log('Starting seed...');

  await seedRoles();
  await seedPermissions();

  // Resolve roleIds once so they can be reused across upserts
  const [roleAdmin, roleManager, roleStaff, roleDriver] = await Promise.all([
    prisma.role.findUnique({ where: { name: 'ADMIN' } }),
    prisma.role.findUnique({ where: { name: 'MANAGER' } }),
    prisma.role.findUnique({ where: { name: 'STAFF' } }),
    prisma.role.findUnique({ where: { name: 'DRIVER' } }),
  ]);

  // ── Staff account (idempotent) ────────────────────────────────────────────
  const staffEmail = 'staff@test.com';
  const hash = await bcrypt.hash('staff123', 12);
  await prisma.user.upsert({
    where: { email: staffEmail },
    update: { passwordHash: hash, isActive: true, roleId: roleStaff!.id },
    create: {
      fullName: 'Nhân viên A',
      email: staffEmail,
      passwordHash: hash,
      isActive: true,
      roleId: roleStaff!.id },
  });
  console.log('Staff account ready: staff@test.com / staff123');

  // ── Admin account (idempotent) ──────────────────────────────────────────
  const adminEmail = 'admin@test.com';
  const adminHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, isActive: true, roleId: roleAdmin!.id },
    create: {
      fullName: 'Quản trị viên',
      email: adminEmail,
      passwordHash: adminHash,
      isActive: true,
      roleId: roleAdmin!.id },
  });
  console.log('Admin account ready: admin@test.com / admin123');

  // ── Manager account (idempotent) ──────────────────────────────────────────
  const managerEmail = 'manager@test.com';
  const managerHash = await bcrypt.hash('manager123', 12);
  await prisma.user.upsert({
    where: { email: managerEmail },
    update: { passwordHash: managerHash, isActive: true, roleId: roleManager!.id },
    create: {
      fullName: 'Quản lý A',
      email: managerEmail,
      passwordHash: managerHash,
      isActive: true,
      roleId: roleManager!.id },
  });
  console.log('Manager account ready: manager@test.com / manager123');

  // ── Driver account (idempotent) ──────────────────────────────────────────
  const driverEmail = 'driver@test.com';
  const driverHash = await bcrypt.hash('driver123', 12);
  await prisma.user.upsert({
    where: { email: driverEmail },
    update: { passwordHash: driverHash, isActive: true, roleId: roleDriver!.id },
    create: {
      fullName: 'Nguyễn Tài Xế',
      email: driverEmail,
      passwordHash: driverHash,
      isActive: true,
      roleId: roleDriver!.id },
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
      isActive: true,
      roleId: roleDriver!.id },
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
      isActive: true,
      roleId: roleDriver!.id },
  });

  const vehicleA = await prisma.vehicle.upsert({
    where: { plateNumber: '51A11111' },
    update: {},
    create: {
      plateNumber: '51A11111',
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
  console.log('Monthly customer seeded: Nguyen Van A / 51A11111 / G-01 (VALID, expires', validExpiry.toLocaleDateString('vi-VN'), ')');

  // ── Monthly customer: Tran Thi B / 51B22222 (EXPIRED) ─────────────────
  const driverBEmail = 'tranthib@test.com';
  const hashB = await bcrypt.hash('test123', 12);
  const driverB = await prisma.user.upsert({
    where: { email: driverBEmail },
    update: {},
    create: {
      fullName: 'Tran Thi B',
      email: driverBEmail,
      passwordHash: hashB,
      isActive: true,
      roleId: roleDriver!.id },
  });

  const vehicleB = await prisma.vehicle.upsert({
    where: { plateNumber: '51B22222' },
    update: {},
    create: {
      plateNumber: '51B22222',
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
  console.log('Monthly customer seeded: Tran Thi B / 51B22222 / G-02 (EXPIRED since', expiredExpiry.toLocaleDateString('vi-VN'), ')');

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
