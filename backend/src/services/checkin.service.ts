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
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  fixedSlot?: string | null;
  packageExpiry?: string;
  isExpired?: boolean;
  allowedTier?: string | null;
  // Owner / customer info
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  note?: string | null;
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
  slotCode?: string;
  isMonthly: boolean;
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
}

export const checkinService = {
  // ── GET /api/checkin/lookup/:plate ─────────────────────────────────────
  async lookupPlate(plate: string): Promise<LookupResult> {
    const cleaned = plate.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { plateNumber: cleaned },
          { plateNumber: stripped },
        ],
      },
      include: {
        monthlyPackage: {
          include: { slot: true },
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

    // No vehicle at all → casual
    if (!vehicle) {
      return { found: false, customerType: 'casual' };
    }

    // Active check-in record? → already parked
    const activeRecord = await prisma.checkInRecord.findFirst({
      where: { vehicleId: vehicle.id, checkOutTime: null },
      include: { slot: true },
    });

    const baseResult = {
      found: true,
      vehicleType: vehicle.type as 'CAR' | 'MOTORBIKE',
      brand: vehicle.brand ?? null,
      model: vehicle.model ?? null,
      color: vehicle.color ?? null,
      year: vehicle.year ?? null,
      seats: (vehicle as any).seats ?? null,
      customerType: vehicle.isMonthly ? 'monthly' : 'casual',
      ownerName: vehicle.owner?.fullName ?? null,
      ownerPhone: vehicle.owner?.phoneNumber ?? null,
      ownerEmail: vehicle.owner?.email ?? null,
      note: null,
    } as LookupResult;

    if (activeRecord) {
      return {
        ...baseResult,
        alreadyParked: true,
        slotCode: activeRecord.slot?.code ?? (activeRecord.allowedTier ? `Khu ${activeRecord.allowedTier === 'VIP' ? 'VIP' : activeRecord.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      };
    }

    if (!vehicle.isMonthly || !vehicle.monthlyPackage) {
      return {
        ...baseResult,
        alreadyParked: false,
      };
    }

    const pkg = vehicle.monthlyPackage;
    const isExpired =
      new Date(pkg.expiryDate) < new Date() || pkg.status !== PKG_ACTIVE;

    return {
      ...baseResult,
      alreadyParked: false,
      fixedSlot: pkg.slot?.code ?? null,
      packageExpiry: pkg.expiryDate.toISOString(),
      isExpired,
      allowedTier: pkg.allowedTier ?? null,
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
    const normalizedPlate = normalizePlate(plate);

    const cleaned = plate.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');
    let vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { plateNumber: cleaned },
          { plateNumber: stripped },
        ],
      },
      include: {
        monthlyPackage: true,
      },
    });

    if (isMonthly && vehicleType === 'CAR') {
      if (!vehicle) {
        throw new AppError(400, 'Xe chưa đăng ký trong hệ thống');
      }

      const pkg = vehicle.monthlyPackage;
      if (!pkg || pkg.status !== PKG_ACTIVE || new Date(pkg.expiryDate) < new Date()) {
        throw new AppError(400, 'Gói tháng đã hết hạn hoặc không tồn tại');
      }

      const allowedTier = pkg.allowedTier;
      const zoneName = allowedTier === 'VIP' ? 'Khu VIP' : allowedTier === 'POPULAR' ? 'Khu Phổ biến' : 'Khu Cơ bản';

      const checkInTime = new Date();
      await prisma.checkInRecord.create({
        data: {
          vehicleId: vehicle.id,
          slotId: null,
          checkInTime,
          isMonthly: true,
          allowedTier,
        },
      });

      return {
        ok: true,
        plate: normalizedPlate,
        slotCode: `Khu ${allowedTier === 'VIP' ? 'VIP' : allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}`,
        checkInTime: checkInTime.toISOString(),
        accessGranted: true,
        floorCode: 'G',
        allowedTier,
        zoneName,
        message: `Vui lòng di chuyển vào ${zoneName} và đỗ tại vị trí trống phù hợp.`,
      };
    }

    if (!slotCode) throw new AppError(400, 'Mã slot không được để trống');
    const slot = await prisma.parkingSlot.findUnique({ where: { code: slotCode } });
    if (!slot) throw new AppError(404, 'Slot không tìm thấy');
    if (slot.status !== SLOT_AVAILABLE) throw new AppError(409, 'Slot không còn trống');

    if (!vehicle) {
      if (isMonthly) {
        throw new AppError(400, 'Xe chưa đăng ký trong hệ thống');
      }

      const walkinUser = await findOrCreateWalkinUser();
      const newVehicle = await prisma.vehicle.create({
        data: {
          plateNumber: cleaned,
          type: vehicleType,
          isMonthly: false,
          ownerId: walkinUser.id,
        },
      });
      vehicle = { ...newVehicle, monthlyPackage: null } as any;
    }

    const checkInTime = new Date();

    await prisma.$transaction([
      prisma.parkingSlot.update({
        where: { id: slot.id },
        data: { status: 'OCCUPIED', assignedVehicleId: vehicle!.id },
      }),
      prisma.checkInRecord.create({
        data: {
          vehicleId: vehicle!.id,
          slotId: slot.id,
          checkInTime,
          isMonthly,
        },
      }),
    ]);

    return {
      ok: true,
      plate: normalizedPlate,
      slotCode,
      checkInTime: checkInTime.toISOString(),
    };
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
