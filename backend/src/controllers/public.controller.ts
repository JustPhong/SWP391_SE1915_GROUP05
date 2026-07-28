import { Response, Request } from 'express';
import prisma from '../config/db';
import { asyncHandler, AppError } from '../utils/helpers';
import { slotSuggestionService } from '../services/slotSuggestion.service';
import { calcFee } from '../utils/fee';
import { feeRuleService } from '../services/feeRule.service';
import { config } from '../config';

type VehicleBucket = { available: number; total: number };
type ZoneBucket = { car: VehicleBucket; motorbike: VehicleBucket };
type AvailabilityData = {
  casual: ZoneBucket;
  monthly: ZoneBucket;
  total: { available: number; capacity: number };
};

export const publicController = {
  // ── GET /api/public/vietqr-config — no auth required for guests ──────────
  getVietQRConfig: asyncHandler(async (_req, res: Response) => {
    return res.status(200).json({ success: true, data: config.vietqr });
  }),

  // ── GET /api/public/availability ─────────────────────────────────────────
  getAvailability: asyncHandler(async (_req, res: Response) => {
    const allRows = await prisma.parkingSlot.findMany({
      select: {
        status: true,
        floorId: true,
        floor: { select: { id: true, vehicleType: true, customerType: true } },
      },
    });

    const now = new Date();
    const activeBookings = await prisma.booking.findMany({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        expiresAt: { gt: now },
        checkInRecords: { none: {} },
      },
      select: { floorId: true },
    });

    const activeBookingsPerFloor: Record<number, number> = {};
    for (const b of activeBookings) {
      activeBookingsPerFloor[b.floorId] = (activeBookingsPerFloor[b.floorId] || 0) + 1;
    }

    const data: AvailabilityData = {
      casual: { car: { available: 0, total: 0 }, motorbike: { available: 0, total: 0 } },
      monthly: { car: { available: 0, total: 0 }, motorbike: { available: 0, total: 0 } },
      total: { available: 0, capacity: 0 },
    };

    const floorsMap: Record<number, { customerType: string; vehicleType: string; slots: { status: string }[] }> = {};
    for (const row of allRows) {
      if (!floorsMap[row.floorId]) {
        floorsMap[row.floorId] = { customerType: row.floor.customerType, vehicleType: row.floor.vehicleType, slots: [] };
      }
      floorsMap[row.floorId].slots.push(row);
    }

    for (const [floorIdStr, floorInfo] of Object.entries(floorsMap)) {
      const floorId = Number(floorIdStr);
      const ct = floorInfo.customerType;
      const vt = floorInfo.vehicleType;
      if (ct !== 'CASUAL' && ct !== 'MONTHLY') continue;
      if (vt !== 'CAR' && vt !== 'MOTORBIKE') continue;

      const physicalAvailable = floorInfo.slots.filter(s => s.status === 'AVAILABLE').length;
      const total = floorInfo.slots.length;
      const activeBookingsCount = activeBookingsPerFloor[floorId] || 0;
      const receivable = Math.max(0, physicalAvailable - activeBookingsCount);

      const zone = data[ct === 'CASUAL' ? 'casual' : 'monthly'];
      const bucket = zone[vt === 'CAR' ? 'car' : 'motorbike'];
      bucket.total += total;
      data.total.capacity += total;
      bucket.available += receivable;
      data.total.available += receivable;
    }

    return res.status(200).json({ success: true, data });
  }),

  // ── GET /api/public/guest-lookup/:plate ──────────────────────────────────
  guestLookup: asyncHandler(async (req: Request, res: Response) => {
    const plate = (req.params.plate || '').trim().toUpperCase();
    if (!plate) throw new AppError(400, 'Vui lòng cung cấp biển số xe');

    const stripped = plate.replace(/[-.\s]/g, '');
    const vehicle = await prisma.vehicle.findFirst({
      where: { OR: [{ plateNumber: plate }, { plateNumber: stripped }] },
    });

    if (vehicle) {
      const active = await prisma.checkInRecord.findFirst({
        where: { vehicleId: vehicle.id, checkOutTime: null },
        include: { slot: true },
      });
      if (active) {
        return res.status(200).json({
          success: true,
          data: {
            alreadyParked: true,
            slotCode: active.slot?.code ?? 'Chưa gán slot',
            vehicleType: vehicle.type,
            checkInTime: active.checkInTime.toISOString(),
          },
        });
      }
      if (vehicle.isMonthly) {
        return res.status(200).json({
          success: true,
          data: {
            alreadyParked: false,
            isMonthly: true,
            vehicleType: vehicle.type,
            message: 'Xe đăng ký gói tháng — vui lòng sử dụng lối vào dành cho gói tháng.',
          },
        });
      }
    }

    // Get available casual slots
    const slots = await slotSuggestionService.suggestTopSlots(
      vehicle?.type ?? 'CAR',
      'CASUAL',
      20
    );

    return res.status(200).json({
      success: true,
      data: {
        alreadyParked: false,
        isMonthly: false,
        vehicleType: vehicle?.type ?? null,
        found: !!vehicle,
        availableSlots: slots.map(s => ({ code: s.code, suggested: true })),
      },
    });
  }),

  // ── POST /api/public/guest-checkin ───────────────────────────────────────
  guestCheckin: asyncHandler(async (req: Request, res: Response) => {
    const { plateNumber, vehicleType, guestName, guestPhone, slotCode } = req.body as {
      plateNumber?: string;
      vehicleType?: 'CAR' | 'MOTORBIKE';
      guestName?: string;
      guestPhone?: string;
      slotCode?: string;
    };

    if (!plateNumber || !vehicleType) throw new AppError(400, 'Vui lòng cung cấp biển số xe và loại xe');
    if (!guestName || guestName.trim().length < 2) throw new AppError(400, 'Vui lòng nhập họ tên (tối thiểu 2 ký tự)');
    if (!guestPhone || !/^(0|\+84)[0-9]{8,10}$/.test(guestPhone.replace(/\s/g, ''))) {
      throw new AppError(400, 'Số điện thoại không hợp lệ (VD: 0987654321)');
    }

    const cleaned = plateNumber.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');

    let vehicle = await prisma.vehicle.findFirst({
      where: { OR: [{ plateNumber: cleaned }, { plateNumber: stripped }] },
    });

    if (vehicle) {
      const active = await prisma.checkInRecord.findFirst({
        where: { vehicleId: vehicle.id, checkOutTime: null },
      });
      if (active) throw new AppError(409, 'Xe này đang trong bãi đỗ. Vui lòng check-out trước.');
      if (vehicle.isMonthly) throw new AppError(400, 'Xe đăng ký gói tháng — vui lòng sử dụng lối vào gói tháng.');
    }

    // Resolve slot
    let resolvedSlotCode = slotCode?.trim().toUpperCase();
    if (!resolvedSlotCode) {
      const suggestion = await slotSuggestionService.suggestSlot(vehicleType, 'CASUAL');
      if (!suggestion) throw new AppError(503, 'Bãi xe đã hết chỗ trống. Vui lòng thử lại sau.');
      resolvedSlotCode = suggestion.code;
    }

    const slot = await prisma.parkingSlot.findUnique({ where: { code: resolvedSlotCode } });
    if (!slot) throw new AppError(404, `Vị trí ${resolvedSlotCode} không tồn tại`);
    if (slot.status !== 'AVAILABLE') throw new AppError(409, `Vị trí ${resolvedSlotCode} không còn trống.`);

    // Ensure walkin system user exists
    const walkinEmail = 'walkin@system.local';
    let walkinUser = await prisma.user.findUnique({ where: { email: walkinEmail } });
    if (!walkinUser) {
      const driverRole = await prisma.role.findUnique({ where: { name: 'DRIVER' } });
      walkinUser = await prisma.user.create({
        data: { fullName: 'Walk-in Customer', email: walkinEmail, passwordHash: '', roleId: driverRole!.id },
      });
    }

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: cleaned,
          type: vehicleType,
          isMonthly: false,
          ownerId: walkinUser.id,
          ownerFullName: guestName.trim(),
          ownerPhone: guestPhone.trim(),
        },
      });
    } else {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { ownerFullName: guestName.trim(), ownerPhone: guestPhone.trim() },
      });
    }

    const checkInTime = new Date();
    await prisma.$transaction([
      prisma.parkingSlot.update({
        where: { id: slot.id },
        data: { status: 'OCCUPIED', assignedVehicleId: vehicle.id },
      }),
      prisma.checkInRecord.create({
        data: { vehicleId: vehicle.id, slotId: slot.id, floorId: slot.floorId, checkInTime, isMonthly: false },
      }),
    ]);

    return res.status(201).json({
      success: true,
      data: {
        plate: cleaned,
        slotCode: resolvedSlotCode,
        checkInTime: checkInTime.toISOString(),
        guestName: guestName.trim(),
        message: `Check-in thành công! Xe của bạn ở vị trí ${resolvedSlotCode}.`,
      },
    });
  }),

  // ── POST /api/public/guest-checkout ──────────────────────────────────────
  // Returns fee preview so guest knows how much to pay at the cashier
  guestCheckout: asyncHandler(async (req: Request, res: Response) => {
    const { plateNumber } = req.body as { plateNumber?: string };
    if (!plateNumber) throw new AppError(400, 'Vui lòng cung cấp biển số xe');

    const cleaned = plateNumber.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');

    const vehicle = await prisma.vehicle.findFirst({
      where: { OR: [{ plateNumber: cleaned }, { plateNumber: stripped }] },
    });
    if (!vehicle) throw new AppError(404, 'Không tìm thấy xe với biển số này');

    const record = await prisma.checkInRecord.findFirst({
      where: { vehicleId: vehicle.id, checkOutTime: null },
      include: { slot: true },
    });
    if (!record) throw new AppError(404, 'Xe này chưa check-in hoặc đã check-out');

    const now = new Date();
    const checkIn = new Date(record.checkInTime);
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = calcFee(checkIn, now, vehicle.type as 'CAR' | 'MOTORBIKE', config);
    const durationMinutes = Math.round((now.getTime() - checkIn.getTime()) / 60_000);

    return res.status(200).json({
      success: true,
      data: {
        plate: vehicle.plateNumber,
        vehicleType: vehicle.type,
        slotCode: record.slot?.code ?? 'Không cố định',
        checkInTime: record.checkInTime.toISOString(),
        checkoutTime: now.toISOString(),
        durationMinutes,
        fee: total,
        breakdown,
        message: `Phí đỗ xe: ${total.toLocaleString('vi-VN')} đ. Vui lòng thanh toán tại quầy thu phí.`,
      },
    });
  }),
};
