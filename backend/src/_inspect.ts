import prisma from './config/db';
(async () => {
  const pkgs = await prisma.monthlyPackage.findMany({
    include: {
      vehicle: { select: { plateNumber: true } },
      floor: { select: { floorCode: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  for (const p of pkgs) {
    console.log(
      p.id,
      p.status,
      p.vehicle?.plateNumber,
      p.floorId,
      p.allowedTier,
      p.floor?.floorCode,
      p.createdAt.toISOString()
    );
  }
  await prisma.$disconnect();
})();
