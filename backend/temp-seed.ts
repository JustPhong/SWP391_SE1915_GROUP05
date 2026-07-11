import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create roles if not exist
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  const driverRole = await prisma.role.upsert({
    where: { name: 'DRIVER' },
    update: {},
    create: { name: 'DRIVER' },
  });

  // Seed ADMIN
  const adminHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { passwordHash: adminHash, roleId: adminRole.id, isActive: true },
    create: {
      fullName: 'Admin User',
      email: 'admin@test.com',
      passwordHash: adminHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });
  console.log('Admin user created/updated successfully');

  // Seed DRIVER
  const driverHash = await bcrypt.hash('driver123', 12);
  await prisma.user.upsert({
    where: { email: 'driver@test.com' },
    update: { passwordHash: driverHash, roleId: driverRole.id, isActive: true },
    create: {
      fullName: 'Driver User',
      email: 'driver@test.com',
      passwordHash: driverHash,
      roleId: driverRole.id,
      isActive: true,
    },
  });
  console.log('Driver user created/updated successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
