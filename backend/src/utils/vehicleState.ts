import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import { AppError } from './helpers';

export async function acquireLock(tx: Prisma.TransactionClient, resource: string, timeoutMs = 5000): Promise<void> {
  const result: any[] = await tx.$queryRawUnsafe(`
    DECLARE @res INT;
    EXEC @res = sp_getapplock 
      @Resource = '${resource}', 
      @LockMode = 'Exclusive', 
      @LockOwner = 'Transaction', 
      @LockTimeout = ${timeoutMs};
    SELECT @res AS status;
  `);
  const status = result?.[0]?.status;
  if (status === undefined || status < 0) {
    throw new AppError(409, `Yêu cầu đang được xử lý. Vui lòng thử lại sau. (Lock status: ${status})`);
  }
}

export async function acquireVehicleOrPlateLock(
  tx: Prisma.TransactionClient,
  vehicleId: string | null | undefined,
  plateNumber: string | null | undefined
): Promise<void> {
  let resource = '';
  if (vehicleId) {
    resource = `ParkSmart:Vehicle:${vehicleId}`;
  } else if (plateNumber) {
    const cleaned = plateNumber.trim().toUpperCase().replace(/[-. \s]/g, '');
    resource = `ParkSmart:Plate:${cleaned}`;
  } else {
    return;
  }
  await acquireLock(tx, resource);
}

export async function getVehicleOperationalState(
  tx: Prisma.TransactionClient,
  params: {
    vehicleId?: string | null;
    plateNumber?: string | null;
    excludeBookingId?: string | null;
    excludeCheckInRecordId?: string | null;
  }
) {
  const { vehicleId, plateNumber, excludeBookingId, excludeCheckInRecordId } = params;

  let vehicle: any = null;
  let cleaned = '';
  let stripped = '';

  if (plateNumber) {
    cleaned = plateNumber.trim().toUpperCase();
    stripped = cleaned.replace(/[-. \s]/g, '');
  }

  // 1. Find authoritative vehicle
  if (vehicleId) {
    vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      include: { monthlyPackage: true },
    });
  } else if (plateNumber) {
    vehicle = await tx.vehicle.findFirst({
      where: {
        OR: [
          { plateNumber: cleaned },
          { plateNumber: stripped },
        ],
      },
      include: { monthlyPackage: true },
    });
  }

  const effectiveVehicleId = vehicle?.id || null;
  const platesToQuery = vehicle 
    ? [vehicle.plateNumber, vehicle.plateNumber.replace(/[-. \s]/g, '')] 
    : (plateNumber ? [cleaned, stripped] : []);

  // 2. Find active CheckInRecord
  const activeCheckIn = await tx.checkInRecord.findFirst({
    where: {
      checkOutTime: null,
      id: excludeCheckInRecordId ? { not: excludeCheckInRecordId } : undefined,
      OR: [
        ...(effectiveVehicleId ? [{ vehicleId: effectiveVehicleId }] : []),
        ...(platesToQuery.map(p => ({ vehicle: { plateNumber: p } }))),
        ...(platesToQuery.map(p => ({ vehicle: { plateNumber: p.replace(/[-. \s]/g, '') } })))
      ]
    },
    include: {
      vehicle: true,
      floor: true,
    }
  });

  // 3. Find usable active Booking
  const activeBooking = await tx.booking.findFirst({
    where: {
      status: 'ACTIVE',
      depositStatus: 'PAID',
      expiresAt: { gt: new Date() },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      checkInRecords: { none: {} },
      OR: [
        ...(effectiveVehicleId ? [{ vehicleId: effectiveVehicleId }] : []),
        ...(platesToQuery.map(p => ({ vehicle: { plateNumber: p } }))),
        ...(platesToQuery.map(p => ({ vehicle: { plateNumber: p.replace(/[-. \s]/g, '') } })))
      ]
    },
    include: {
      floor: true,
      vehicle: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  // 4. Find reusable pending Booking payment flow
  const pendingBookingPayment = await tx.booking.findFirst({
    where: {
      status: 'PENDING_PAYMENT',
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      OR: [
        ...(effectiveVehicleId ? [{ vehicleId: effectiveVehicleId }] : []),
        ...(platesToQuery.map(p => ({ vehicle: { plateNumber: p } }))),
        ...(platesToQuery.map(p => ({ vehicle: { plateNumber: p.replace(/[-. \s]/g, '') } })))
      ]
    },
    include: {
      payments: {
        where: { type: 'BOOKING_FEE', status: 'PENDING' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 5. Find active monthly package
  let activeMonthlyPackage = null;
  if (vehicle) {
    if (vehicle.monthlyPackage && vehicle.monthlyPackage.status === 'ACTIVE' && new Date(vehicle.monthlyPackage.expiryDate) > new Date()) {
      activeMonthlyPackage = vehicle.monthlyPackage;
    }
  }

  // 6. Find reusable pending PARKING_FEE flow
  let pendingParkingFeePayment = null;
  if (activeCheckIn) {
    pendingParkingFeePayment = await tx.payment.findFirst({
      where: {
        checkInRecordId: activeCheckIn.id,
        type: 'PARKING_FEE',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return {
    vehicle,
    activeCheckIn,
    activeBooking,
    pendingBookingPayment,
    activeMonthlyPackage,
    pendingParkingFeePayment,
  };
}
