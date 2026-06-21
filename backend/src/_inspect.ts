import prisma from './config/db';
(async () => {
  const pkgs = await prisma.monthlyPackage.findMany({
    include: { vehicle: { select: { plateNumber: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  for (const p of pkgs) {
    console.log(p.id, p.status, p.vehicle?.plateNumber, p.slotId, p.createdAt.toISOString());
  }
  await prisma.$disconnect();
})();
   