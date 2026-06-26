import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { passwordHash: hash, role: 'ADMIN', isActive: true },
    create: {
      fullName: 'Admin User',
      email: 'admin@test.com',
      passwordHash: hash,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('Admin user created successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
