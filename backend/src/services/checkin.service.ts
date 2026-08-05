import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/helpers';
import { acquireVehicleOrPlateLock, getVehicleOperationalState } from '../utils/vehicleState';

const SLOT_AVAILABLE = 'AVAILABLE';
const PKG_ACTIVE = 'ACTIVE';

export interface ActiveBookingSummary {
  id: string;
  floorId: number;
  floorName: string;
  floorCode: string;
  depositAmount: number;
  expiresAt: string;
}

export interface LookupResult {
  found: boolean;
  alreadyParked?: boolean;
  activeCheckInRecordId?: string | null;
  activeCheckInTime?: string | null;
  plate?: string;
  message?: string;
  slotCode?: string;
  customerType: 'monthly' | 'casual' | 'booking';
  isGuest?: boolean;
  vehicleType?: 'CAR' | 'MOTORBIKE';
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  fixedSlot?: string | null;
  packageExpiry?: string;
  isExpired?: boolean;
  allowedTier?: string | null;
  // Floor information determined by backend lookup
  floorId?: number | null;
  floorName?: string | null;
  floorCode?: string | null;
  totalCapacity?: number | null;
  activeParkingCount?: number | null;
  activeBookingCount?: number | null;
  receivableCapacity?: number | null;
  // Active booking (CAR only)
  activeBooking?: ActiveBookingSummary | null;
  // Owner / customer info
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  note?: string | null;
  requestedPlateNormalized?: string;
  matchedPlateNormalized?: string | null;
}

export interface AvailableSlotResult {
  code: string;
  suggested: boolean;
}

export interface CheckinStats {
  capacityUsed: number;
  capacityTotal: number;
  monthlyToday: number;
}

export interface SubmitCheckinInput {
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  customerType: 'monthly' | 'casual';
  floorId: number;
  slotCode?: string | null;
  isMonthly: boolean;
  frontImageUrl?: string;
  rearImageUrl?: string;
  driverCheckInImageUrl?: string;
  driverCheckInImagePublicId?: string;
}

export interface SubmitCheckinResult {
  ok: boolean;
  plate: string;
  slotCode: string;
  checkInTime: string;
  accessGranted?: boolean;
  floorCode?: string;
  allowedTier?: string | null;
  zoneName?: string | null;
  message?: string;
  isGuest?: boolean;
  guestPin?: string | null;
  guestQrToken?: string | null;
  driverCheckInImageUrl?: string | null;
  driverFaceCapturedAt?: string | null;
}

export const checkinService = {
  // ── GET /api/checkin/lookup/:plate ─────────────────────────────────────
  async lookupPlate(
    plate: string,
    vehicleType?: 'CAR' | 'MOTORBIKE'
  ): Promise<LookupResult> {
    const cleaned = plate.trim().toUpperCase();
    const stripped = cleaned.replace(/[-. \s]/g, '');

    // 1. Authoritative check for existing active parking session for this plate
    const activeParkingSession = await prisma.checkInRecord.findFirst({
      where: {
        checkOutTime: null,
        status: 'PARKING',
        vehicle: {
          OR: [
            { plateNumber: cleaned },
            { plateNumber: stripped },
          ],
        },
      },
      include: {
        vehicle: {
          include: {
            owner: {
              select: {
                email: true,
              },
            },
          },
        },
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
      },
    });

    const requestedPlateNormalized = stripped;
    const activeMatchedPlateNormalized = activeParkingSession?.vehicle?.plateNumber
      ? activeParkingSession.vehicle.plateNumber.replace(/[-. \s]/g, '').toUpperCase()
      : null;

    if (activeParkingSession) {
      const activeFloor = activeParkingSession.floor ?? activeParkingSession.slot?.floor;
      const isGuest = activeParkingSession.vehicle?.owner?.email === 'walkin@system.local';
      return {
        found: true,
        alreadyParked: true,
        activeCheckInRecordId: activeParkingSession.id,
        activeCheckInTime: activeParkingSession.checkInTime.toISOString(),
        plate: activeParkingSession.vehicle?.plateNumber ?? plate,
        isGuest,
        customerType: activeParkingSession.vehicle?.isMonthly ? 'monthly' : 'casual',
        vehicleType: activeParkingSession.vehicle?.type as 'CAR' | 'MOTORBIKE',
        floorId: activeParkingSession.floorId,
        floorName: activeFloor?.name ?? null,
        floorCode: activeFloor?.floorCode ?? null,
        message: `Biển số ${activeParkingSession.vehicle?.plateNumber ?? plate} hiện đang có lượt gửi xe trong bãi. Vui lòng check-out lượt hiện tại trước khi check-in lại.`,
        requestedPlateNormalized,
        matchedPlateNormalized: activeMatchedPlateNormalized,
      };
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { plateNumber: cleaned },
          { plateNumber: stripped },
        ],
      },
      include: {
        monthlyPackage: {
          include: { floor: true },
        },
        owner: {
          select: {
            fullName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    const vType = (vehicle?.type || vehicleType || 'CAR') as 'CAR' | 'MOTORBIKE';

    const getCapacityInfo = async (fId?: number, custType?: 'MONTHLY' | 'CASUAL') => {
      let floor;
      if (fId) {
        floor = await prisma.floor.findUnique({ where: { id: fId } });
      } else {
        floor = await prisma.floor.findFirst({
          where: { vehicleType: vType, customerType: custType || 'CASUAL' },
        });
      }
      if (!floor) {
        return {
          floorId: null,
          floorName: null,
          floorCode: null,
          totalCapacity: 0,
          activeParkingCount: 0,
          activeBookingCount: 0,
          receivableCapacity: 0,
        };
      }
      const now = new Date();
      const activeParkingCount = await prisma.checkInRecord.count({
        where: { floorId: floor.id, checkOutTime: null },
      });
      const activeBookingCount = await prisma.booking.count({
        where: {
          floorId: floor.id,
          status: 'ACTIVE',
          depositStatus: 'PAID',
          expiresAt: { gt: now },
          checkInRecords: { none: {} },
        },
      });
      const receivableCapacity = Math.max(0, floor.capacity - activeParkingCount - activeBookingCount);
      return {
        floorId: floor.id,
        floorName: floor.name,
        floorCode: floor.floorCode,
        totalCapacity: floor.capacity,
        activeParkingCount,
        activeBookingCount,
        receivableCapacity,
      };
    };

    const matchedPlateNormalized = vehicle ? vehicle.plateNumber.replace(/[-. \s]/g, '').toUpperCase() : null;
    const isExact = vehicle && matchedPlateNormalized === requestedPlateNormalized;
    const found = !!isExact;

    // No exact matching vehicle found → casual guest
    if (!vehicle || !found) {
      const capInfo = await getCapacityInfo(undefined, 'CASUAL');
      return {
        found: false,
        customerType: 'casual',
        isGuest: true,
        vehicleType: vType,
        requestedPlateNormalized,
        matchedPlateNormalized: null,
        ...capInfo,
      };
    }

    // Active check-in record? → already parked
    const activeRecord = await prisma.checkInRecord.findFirst({
      where: { vehicleId: vehicle.id, checkOutTime: null },
      include: { slot: true },
    });

    const isGuest = vehicle.owner?.email === 'walkin@system.local';

    const baseResult: LookupResult = {
      found: true,
      vehicleType: vehicle.type as 'CAR' | 'MOTORBIKE',
      brand: vehicle.brand ?? null,
      model: vehicle.model ?? null,
      color: vehicle.color ?? null,
      year: vehicle.year ?? null,
      seats: (vehicle as Record<string, unknown>).seats as number | null ?? null,
      customerType: vehicle.isMonthly ? 'monthly' : 'casual',
      isGuest,
      ownerName: vehicle.owner?.fullName ?? null,
      ownerPhone: vehicle.owner?.phoneNumber ?? null,
      ownerEmail: vehicle.owner?.email ?? null,
      note: null,
      requestedPlateNormalized,
      matchedPlateNormalized,
    };

    if (activeRecord) {
      const activeFloor = activeRecord.floorId
        ? await prisma.floor.findUnique({ where: { id: activeRecord.floorId } })
        : null;
      return {
        ...baseResult,
        alreadyParked: true,
        slotCode: activeRecord.slot?.code ?? (
          activeRecord.allowedTier
            ? `Khu ${
                activeRecord.allowedTier === 'VIP' ? 'VIP'
                  : activeRecord.allowedTier === 'POPULAR' ? 'Phổ biến'
                  : 'Cơ bản'
              }`
            : 'Không cố định'
        ),
        floorId: activeRecord.floorId,
        floorName: activeFloor?.name ?? null,
        floorCode: activeFloor?.floorCode ?? null,
        receivableCapacity: 0,
      };
    }

    // ── Active Booking check (CAR only) ─────────────────────────────────
    if (vType === 'CAR') {
      const now = new Date();
      const activeBooking = await prisma.booking.findFirst({
        where: {
          vehicleId: vehicle.id,
          status: 'ACTIVE',
          depositStatus: 'PAID',
          expiresAt: { gt: now },
          checkInRecords: { none: {} },
        },
        include: { floor: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeBooking) {
        const capInfo = await getCapacityInfo(activeBooking.floorId);
        return {
          ...baseResult,
          alreadyParked: false,
          customerType: 'booking',
          activeBooking: {
            id: activeBooking.id,
            floorId: activeBooking.floorId,
            floorName: activeBooking.floor.name,
            floorCode: activeBooking.floor.floorCode,
            depositAmount: Number(activeBooking.depositAmount),
            expiresAt: activeBooking.expiresAt!.toISOString(),
          },
          ...capInfo,
        };
      }
    }

    // Monthly Package Check
    if (vehicle.isMonthly && vehicle.monthlyPackage) {
      const pkg = vehicle.monthlyPackage;
      const isExpired =
        new Date(pkg.expiryDate) < new Date() || pkg.status !== PKG_ACTIVE;

      const capInfo = await getCapacityInfo(pkg.floorId, 'MONTHLY');
      return {
        ...baseResult,
        alreadyParked: false,
        fixedSlot: null,
        packageExpiry: pkg.expiryDate.toISOString(),
        isExpired,
        allowedTier: pkg.allowedTier ?? null,
        ...capInfo,
      };
    }

    // Default to Casual
    const capInfo = await getCapacityInfo(undefined, 'CASUAL');
    return {
      ...baseResult,
      customerType: 'casual',
      alreadyParked: false,
      ...capInfo,
    };
  },

  // ── GET /api/slots/available?vehicleType=&customerType= ─────────────────
  async getAvailableSlots(
    vehicleType: 'CAR' | 'MOTORBIKE',
    customerType: 'MONTHLY' | 'CASUAL'
  ): Promise<AvailableSlotResult[]> {
    // Find the matching floor
    const floor = await prisma.floor.findFirst({
      where: { vehicleType, customerType },
    });

    if (!floor) return [];

    const slots = await prisma.parkingSlot.findMany({
      where: { floorId: floor.id, status: SLOT_AVAILABLE },
      orderBy: { code: 'asc' },
    });

    if (slots.length === 0) return [];

    return slots.map((s, i) => ({
      code: s.code,
      suggested: i === 0,
    }));
  },

  // ── GET /api/checkin/stats ─────────────────────────────────────────────
  async getStats(): Promise<CheckinStats> {
    const [capacityUsed, capacityTotal] = await Promise.all([
      prisma.parkingSlot.count({ where: { status: 'OCCUPIED' } }),
      prisma.parkingSlot.count(),
    ]);

    // monthlyToday = CheckInRecord where isMonthly=true AND checkInTime is today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const monthlyToday = await prisma.checkInRecord.count({
      where: {
        isMonthly: true,
        checkInTime: { gte: startOfDay },
      },
    });

    return { capacityUsed, capacityTotal, monthlyToday };
  },

  // ── POST /api/checkin ─────────────────────────────────────────────────
  async submit(input: SubmitCheckinInput): Promise<SubmitCheckinResult> {
    const { plate, vehicleType, floorId, isMonthly, frontImageUrl, rearImageUrl } = input;
    const normalizedPlate = normalizePlate(plate);

    if (floorId === undefined || floorId === null) {
      throw new AppError(400, 'Tầng/khu vực không được để trống');
    }

    const cleaned = plate.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');

    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
      try {
        return await prisma.$transaction(async (tx) => {
          const now = new Date();

      // 1. Resolve vehicle
      let vehicle = await tx.vehicle.findFirst({
        where: {
          OR: [
            { plateNumber: cleaned },
            { plateNumber: stripped },
          ],
        },
        include: {
          monthlyPackage: {
            include: { floor: true },
          },
          owner: true,
        },
      });

      // 2. Concurrency Lock
      await acquireVehicleOrPlateLock(tx, vehicle?.id, plate);

      // 3. Resolve authoritative operational state
      const state = await getVehicleOperationalState(tx, {
        vehicleId: vehicle?.id,
        plateNumber: plate
      });

      // 4. Duplicate Check-in guard (must return 409)
      if (state.activeCheckIn) {
        throw new AppError(
          409,
          `Biển số ${plate} hiện đang có lượt gửi xe trong bãi. Vui lòng check-out lượt hiện tại trước khi check-in lại.`,
          true,
          'ACTIVE_PARKING_SESSION'
        );
      }

      // 5. Inconsistency Check
      if (state.activeBooking && state.activeMonthlyPackage) {
        throw new AppError(
          409,
          'Trạng thái xe không nhất quán. Vui lòng kiểm tra lượt đặt chỗ và gói tháng.'
        );
      }

      // Flow A: Active Booking exists
      if (state.activeBooking) {
        const activeBooking = state.activeBooking;
        if (activeBooking.floorId !== floorId) {
          throw new AppError(400, 'Tầng đỗ xe không khớp với thông tin đặt chỗ');
        }

        const totalCapacity = activeBooking.floor.capacity;
        const activeParkingCount = await tx.checkInRecord.count({
          where: { floorId: activeBooking.floorId, checkOutTime: null },
        });

        if (activeParkingCount >= totalCapacity) {
          throw new AppError(400, `Tầng ${activeBooking.floor.name} đã đầy xe, không thể nhận thêm.`);
        }

        const checkInTime = new Date();
        await tx.checkInRecord.create({
          data: {
            vehicleId: activeBooking.vehicleId,
            slotId: null,
            floorId: activeBooking.floorId,
            bookingId: activeBooking.id,
            checkInTime,
            isMonthly: false,
            frontImageUrl: frontImageUrl ?? null,
            rearImageUrl: rearImageUrl ?? null,
            driverCheckInImageUrl: input.driverCheckInImageUrl ?? null,
            driverCheckInImagePublicId: input.driverCheckInImagePublicId ?? null,
            driverFaceCapturedAt: input.driverCheckInImageUrl ? checkInTime : null,
          },
        });

        await tx.booking.update({
          where: { id: activeBooking.id },
          data: { status: 'FULFILLED' },
        });

        return {
          ok: true,
          plate: normalizedPlate,
          slotCode: 'Tự chọn',
          checkInTime: checkInTime.toISOString(),
          floorCode: activeBooking.floor.floorCode,
          zoneName: `Đặt chỗ - ${activeBooking.floor.name}`,
          message: `Đặt chỗ hợp lệ. Vui lòng di chuyển vào ${activeBooking.floor.name} và tự chọn vị trí trống phù hợp.`,
          isGuest: false,
          guestPin: null,
          guestQrToken: null,
          driverCheckInImageUrl: input.driverCheckInImageUrl ?? null,
          driverFaceCapturedAt: input.driverCheckInImageUrl ? checkInTime.toISOString() : null,
        };
      }

      // Flow B: No Active Booking, Monthly Package exists
      if (state.activeMonthlyPackage) {
        const pkg = state.activeMonthlyPackage;
        const pkgFloorId = pkg.floorId;
        if (!pkgFloorId) {
          throw new AppError(400, 'Gói tháng chưa được bố trí tầng đỗ xe.');
        }

        if (pkgFloorId !== floorId) {
          throw new AppError(400, 'Tầng đỗ xe không khớp với thông tin gói tháng');
        }

        const totalCapacity = pkg.floor.capacity;
        const activeParkingCount = await tx.checkInRecord.count({
          where: { floorId: pkgFloorId, checkOutTime: null },
        });

        if (totalCapacity - activeParkingCount <= 0) {
          throw new AppError(400, `Khu vực đỗ xe của gói tháng tại ${pkg.floor.name} đã hết chỗ trống.`);
        }

        const checkInTime = new Date();
        await tx.checkInRecord.create({
          data: {
            vehicleId: pkg.vehicleId,
            slotId: null,
            floorId: pkgFloorId,
            checkInTime,
            isMonthly: true,
            allowedTier: pkg.allowedTier,
            frontImageUrl: frontImageUrl ?? null,
            rearImageUrl: rearImageUrl ?? null,
            driverCheckInImageUrl: input.driverCheckInImageUrl ?? null,
            driverCheckInImagePublicId: input.driverCheckInImagePublicId ?? null,
            driverFaceCapturedAt: input.driverCheckInImageUrl ? checkInTime : null,
          },
        });

        return {
          ok: true,
          plate: normalizedPlate,
          slotCode: `Khu ${pkg.allowedTier === 'VIP' ? 'VIP' : pkg.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}`,
          checkInTime: checkInTime.toISOString(),
          floorCode: pkg.floor.floorCode,
          allowedTier: pkg.allowedTier,
          zoneName: `Khách tháng - ${pkg.floor.name}`,
          message: `Vui lòng di chuyển vào tầng ${pkg.floor.name} và đỗ tại vị trí trống phù hợp.`,
          isGuest: false,
          guestPin: null,
          guestQrToken: null,
          driverCheckInImageUrl: input.driverCheckInImageUrl ?? null,
          driverFaceCapturedAt: input.driverCheckInImageUrl ? checkInTime.toISOString() : null,
        };
      }

      // Flow C: Casual Walk-in
      const floor = await tx.floor.findFirst({
        where: { vehicleType, customerType: 'CASUAL' },
      });
      if (!floor) {
        throw new AppError(400, 'Không tìm thấy tầng đỗ xe phù hợp cho khách vãng lai.');
      }

      if (floor.id !== floorId) {
        throw new AppError(400, 'Tầng đỗ xe không khớp với thông tin khách vãng lai');
      }

      const activeParkingCount = await tx.checkInRecord.count({
        where: { floorId: floor.id, checkOutTime: null },
      });
      const activeBookingCount = await tx.booking.count({
        where: {
          floorId: floor.id,
          status: 'ACTIVE',
          depositStatus: 'PAID',
          expiresAt: { gt: now },
          checkInRecords: { none: {} },
        },
      });

      const receivableCapacity = floor.capacity - activeParkingCount - activeBookingCount;
      if (receivableCapacity <= 0) {
        throw new AppError(400, `Bãi đỗ xe đã hết chỗ trống tại ${floor.name}.`);
      }

      const isGuest = !vehicle || !vehicle.owner || vehicle.owner.email === 'walkin@system.local';
      let effectiveVehicleId: string;

      if (!vehicle) {
        const walkinUser = await findOrCreateWalkinUser();
        const newVehicle = await tx.vehicle.create({
          data: {
            plateNumber: cleaned,
            type: vehicleType,
            isMonthly: false,
            ownerId: walkinUser.id,
          },
        });
        effectiveVehicleId = newVehicle.id;
      } else {
        effectiveVehicleId = vehicle.id;
      }

      let guestPin: string | null = null;
      let guestQrToken: string | null = null;

      if (isGuest) {
        const crypto = require('crypto');
        let pin = '';
        let pinAttempts = 0;
        while (pinAttempts < 10) {
          const rand = crypto.randomInt(0, 1000000);
          pin = rand.toString().padStart(6, '0');
          // Check collision against all previously issued PIN values in GuestAccessCredential
          const existing = await tx.guestAccessCredential.findFirst({
            where: { pin },
          });
          if (!existing) break;
          pinAttempts++;
        }
        guestPin = pin;
        guestQrToken = crypto.randomBytes(32).toString('hex');
      }

      const checkInTime = new Date();
      await tx.checkInRecord.create({
        data: {
          vehicleId: effectiveVehicleId,
          slotId: null,
          floorId: floor.id,
          checkInTime,
          isMonthly: false,
          frontImageUrl: frontImageUrl ?? null,
          rearImageUrl: rearImageUrl ?? null,
          driverCheckInImageUrl: input.driverCheckInImageUrl ?? null,
          driverCheckInImagePublicId: input.driverCheckInImagePublicId ?? null,
          driverFaceCapturedAt: input.driverCheckInImageUrl ? checkInTime : null,
          guestCredential: isGuest && guestPin && guestQrToken ? {
            create: {
              pin: guestPin,
              qrToken: guestQrToken,
              active: true,
              issuedAt: checkInTime,
            }
          } : undefined,
        },
      });

      return {
        ok: true,
        plate: normalizedPlate,
        slotCode: 'Tự chọn',
        checkInTime: checkInTime.toISOString(),
        floorCode: floor.floorCode,
        zoneName: `Khách vãng lai - ${floor.name}`,
        message: `Vui lòng di chuyển vào ${floor.name} và tự chọn vị trí trống phù hợp.`,
        guestPin,
        guestQrToken,
        isGuest,
        driverCheckInImageUrl: input.driverCheckInImageUrl ?? null,
        driverFaceCapturedAt: input.driverCheckInImageUrl ? checkInTime.toISOString() : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (err: any) {
        if (err.code === 'P2002' && (
          err.meta?.target?.includes('GuestAccessCredential') ||
          err.meta?.target?.includes('pin') ||
          err.meta?.target?.includes('qrToken') ||
          err.meta?.target?.includes('checkInRecordId')
        )) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new AppError(409, 'Không thể tạo mã PIN/QR duy nhất cho khách vãng lai sau nhiều lần thử. Vui lòng thử lại.');
          }
          continue;
        }
        throw err;
      }
    }
    throw new AppError(500, 'Không thể thực hiện Check-in.');
  },
};

function normalizePlate(input: string): string {
  return (input ?? '').trim().toUpperCase();
}

// ── Internal helper ────────────────────────────────────────────────────────
async function findOrCreateWalkinUser() {

  const email = 'walkin@system.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const driverRole = await prisma.role.findUnique({ where: { name: 'DRIVER' } });
      user = await prisma.user.create({
        data: {
          fullName: 'Walk-in Customer',
          email,
          passwordHash: '',
          roleId: driverRole!.id,
        },
      });
    console.log('[Seed] Walk-in system user created:', email);
  }
  return user;
}
