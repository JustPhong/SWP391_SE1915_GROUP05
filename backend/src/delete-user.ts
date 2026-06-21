import prisma from './config/db';

const TARGET_EMAIL = 'staff@gmail.com';

async function main() {
  console.log(`Looking up user: ${TARGET_EMAIL}`);

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { roleRef: true },
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`Found user: ${user.fullName} (${user.roleRef!.name}) — ID: ${user.id}`);

  // Gather all vehicles owned by this user
  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: user.id },
  });
  console.log(`\nVehicles owned: ${vehicles.length}`);
  vehicles.forEach((v) => console.log(`  - ${v.plateNumber} (${v.type})`));

  const vehicleIds = vehicles.map((v) => v.id);

  if (vehicleIds.length > 0) {
    // 1. Delete Payments that reference CheckInRecords for these vehicles
    const checkInRecords = await prisma.checkInRecord.findMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    const checkInRecordIds = checkInRecords.map((r) => r.id);

    const paymentsViaRecord = await prisma.payment.deleteMany({
      where: { checkInRecordId: { in: checkInRecordIds } },
    });
    console.log(`\nDeleted ${paymentsViaRecord.count} Payment(s) via CheckInRecord`);

    // 2. Delete MonthlyPackages for these vehicles, then their Payments
    const packages = await prisma.monthlyPackage.findMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    const packageIds = packages.map((p) => p.id);

    if (packageIds.length > 0) {
      const paymentsViaPackage = await prisma.payment.deleteMany({
        where: { monthlyPackageId: { in: packageIds } },
      });
      console.log(`Deleted ${paymentsViaPackage.count} Payment(s) via MonthlyPackage`);
    }

    const deletedPackages = await prisma.monthlyPackage.deleteMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    console.log(`Deleted ${deletedPackages.count} MonthlyPackage(s)`);

    // 3. Delete dependent rows that reference these vehicles
    const deletedBookings = await prisma.booking.deleteMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    console.log(`Deleted ${deletedBookings.count} Booking(s)`);

    const deletedCheckInRecords = await prisma.checkInRecord.deleteMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    console.log(`Deleted ${deletedCheckInRecords.count} CheckInRecord(s)`);

    // 4. Delete the vehicles
    const deletedVehicles = await prisma.vehicle.deleteMany({
      where: { ownerId: user.id },
    });
    console.log(`Deleted ${deletedVehicles.count} Vehicle(s)`);
  }

  // 5. Delete MonthlyPackages that reference this user directly
  const userPackages = await prisma.monthlyPackage.deleteMany({
    where: { userId: user.id },
  });
  if (userPackages.count > 0) {
    console.log(`\nDeleted ${userPackages.count} MonthlyPackage(s) via userId`);
  }

  // 6. Delete the user
  const deletedUser = await prisma.user.delete({ where: { id: user.id } });
  console.log(`\nDeleted user: ${deletedUser.email} (${user.roleRef!.name})`);
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
