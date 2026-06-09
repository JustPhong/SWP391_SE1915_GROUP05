import prisma from '../config/db';
import { AppError } from '../utils/helpers';

const SLOT_AVAILABLE = 'AVAILABLE';
const PKG_ACTIVE = 'ACTIVE';

export interface LookupResult {
  found: boolean;
  alreadyParked?: boolean;
  slotCode?: string;
  customerType: 'monthly' | 'casual';
  vehicleType?: 'CAR' | 'MOTORBIKE';
  fixedSlot?: string | null;
  packageExpiry?: string;
  isExpired?: boolean;
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
  slotCode: string;
  isMonthly: boolean;
}

export interface SubmitCheckinResult {
  ok: boolean;
  plate: string;
  slotCode: string;
  checkInTime: string;
}

export const checkinService = {
  // ── GET /api/checkin/lookup/:plate ─────────────────────────────────────
  async lookupPlate(plate: string): Promise<LookupResult> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: plate },
      include: {
        monthlyPackage: {
          include: { slot: true },
        },
      },
    });

    // No vehicle at all → casual
    if (!vehicle) {
      return { found: false, customerType: 'casual' };
    }

    // Active check-in record? → already parked
    const activeRecord = await prisma.checkInRecord.findFirst({
      where: { vehicleId: vehicle.id, checkOutTime: null },
      include: { slot: true },
    });

    if (activeRecord) {
      return {
        found: true,
        alreadyParked: true,
        slotCode: activeRecord.slot.code,
        customerType: 'monthly',
      };
    }

    // Vehicle exists but not monthly → casual
    if (!vehicle.isMonthly || !vehicle.monthlyPackage) {
      return { found: false, customerType: 'casual' };
    }

    const pkg = vehicle.monthlyPackage;
    const isExpired =
      new Date(pkg.expiryDate) < new Date() || pkg.status !== PKG_ACTIVE;

    return {
      found: true,
      alreadyParked: false,
      customerType: 'monthly',
      vehicleType: vehicle.type as 'CAR' | 'MOTORBIKE',
      fixedSlot: pkg.slot?.code ?? null,
      packageExpiry: pkg.expiryDate.toISOString(),
      isExpired,
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
    const { plate, vehicleType, slotCode, isMonthly } = input;

    // Resolve slot by code
    const slot = await prisma.parkingSlot.findUnique({ where: { code: slotCode } });
    if (!slot) throw new AppError(404, 'Slot không tìm thấy');
    if (slot.status !== SLOT_AVAILABLE) throw new AppError(409, 'Slot không còn trống');

    // Resolve vehicle by plate; create walk-in vehicle if casual and not found
    let vehicle = await prisma.vehicle.findUnique({ where: { plateNumber: plate } });

    if (!vehicle) {
      if (isMonthly) {
        throw new AppError(400, 'Xe chưa đăng ký trong hệ thống');
      }

      // Find or create the walk-in system user
      const walkinUser = await findOrCreateWalkinUser();
      vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: plate,
          type: vehicleType,
          isMonthly: false,
          ownerId: walkinUser.id,
        },
      });
    }

    // Create check-in record + mark slot occupied in a transaction
    const checkInTime = new Date();

    await prisma.$transaction([
      prisma.parkingSlot.update({
        where: { id: slot.id },
        data: { status: 'OCCUPIED', assignedVehicleId: vehicle.id },
      }),
      prisma.checkInRecord.create({
        data: {
          vehicleId: vehicle.id,
          slotId: slot.id,
          checkInTime,
          isMonthly,
        },
      }),
    ]);

    return {
      ok: true,
      plate,
      slotCode,
      checkInTime: checkInTime.toISOString(),
    };
  },
};

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
        role: 'DRIVER',
        roleId: driverRole!.id,
      },
    });
    console.log('[Seed] Walk-in system user created:', email);
  }
  return user;
}
