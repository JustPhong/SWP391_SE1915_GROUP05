import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateGuestCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function findUniqueGuestCode(): Promise<string> {
  let code = generateGuestCode();
  let attempts = 0;
  while (attempts < 50) {
    const existing = await prisma.checkInRecord.findFirst({
      where: { guestCode: code },
      select: { id: true },
    });
    if (!existing) return code;
    code = generateGuestCode();
    attempts++;
  }
  return code;
}

export interface GuestCheckoutLookup {
  found: boolean;
  recordId?: string;
  plate?: string;
  vehicleType?: 'CAR' | 'MOTORBIKE';
  slotCode?: string | null;
  isMonthly?: boolean;
  checkInTime?: string;
  now?: string;
  durationMinutes?: number;
  fee?: number;
  prepaidFee?: number;
  amountDue?: number;
  graceExpiresAt?: string;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  message?: string;
}

export interface GuestPrepayResult {
  ok: boolean;
  recordId: string;
  amountPaid: number;
  graceExpiresAt: string;
  remainingDue: number;
  message?: string;
}

export interface GuestConfirmExitResult {
  ok: boolean;
  recordId: string;
  fee: number;
  method: 'CASH' | 'CARD' | 'EWALLET';
  checkOutTime: string;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
}

export class GuestCheckoutService {
  static async lookupByGuestCode(code: string): Promise<GuestCheckoutLookup> {
    const record = await prisma.checkInRecord.findFirst({
      where: {
        guestCode: code,
        status: { in: ['PARKING', 'PAID_GRACE'] },
      },
      include: {
        vehicle: true,
        slot: { select: { code: true } },
      },
    });

    if (!record) {
      return { found: false, message: 'Mã khách không hợp lệ hoặc đã hết hạn.' };
    }

    const anyRecord = record as any;
    if (record.isMonthly) {
      return {
        found: true,
        recordId: record.id,
        plate: record.vehicle.plateNumber,
        vehicleType: record.vehicle.type as 'CAR' | 'MOTORBIKE',
        slotCode: record.slot?.code ?? null,
        isMonthly: true,
        checkInTime: record.checkInTime.toISOString(),
        now: new Date().toISOString(),
        durationMinutes: Math.floor((Date.now() - record.checkInTime.getTime()) / 60000),
        fee: 0,
        prepaidFee: 0,
        amountDue: 0,
        brand: record.vehicle.brand,
        model: record.vehicle.model,
        color: record.vehicle.color,
        year: record.vehicle.year ?? null,
        seats: record.vehicle.seats ?? null,
        ownerName: record.vehicle.ownerFullName,
        ownerPhone: record.vehicle.ownerPhone,
        ownerEmail: record.vehicle.ownerEmail,
      };
    }

    const now = new Date();
    const prepaidFee = Number(anyRecord.prepaidFee ?? 0);
    const rawTotal = this.calcFee(record.checkInTime, now);
    const fee = prepaidFee > 0 ? Math.max(0, rawTotal - prepaidFee) : rawTotal;
    const durationMinutes = Math.floor((now.getTime() - record.checkInTime.getTime()) / 60000);
    const breakdown = this.buildBreakdown(record.checkInTime, now);
    const graceExpires = anyRecord.graceExpiresAt ? new Date(anyRecord.graceExpiresAt).toISOString() : undefined;

    return {
      found: true,
      recordId: record.id,
      plate: record.vehicle.plateNumber,
      vehicleType: record.vehicle.type as 'CAR' | 'MOTORBIKE',
      slotCode: record.slot?.code ?? null,
      isMonthly: false,
      checkInTime: record.checkInTime.toISOString(),
      now: now.toISOString(),
      durationMinutes,
      fee: Number(fee.toFixed(2)),
      prepaidFee: Number(prepaidFee.toFixed(2)),
      amountDue: Number(fee.toFixed(2)),
      graceExpiresAt: graceExpires,
      breakdown,
      brand: record.vehicle.brand,
      model: record.vehicle.model,
      color: record.vehicle.color,
      year: record.vehicle.year ?? null,
      seats: record.vehicle.seats ?? null,
      ownerName: record.vehicle.ownerFullName,
      ownerPhone: record.vehicle.ownerPhone,
      ownerEmail: record.vehicle.ownerEmail,
    };
  }

  static async prepay(code: string, method: 'CASH' | 'CARD' | 'EWALLET'): Promise<GuestPrepayResult> {
    const record = await prisma.checkInRecord.findFirst({
      where: {
        guestCode: code,
        status: { in: ['PARKING', 'PAID_GRACE'] },
        isMonthly: false,
      },
    });

    if (!record) {
      return { ok: false, recordId: '', amountPaid: 0, graceExpiresAt: '', remainingDue: 0, message: 'Mã khách không hợp lệ.' };
    }

    const currentDue = this.calcFee(record.checkInTime, new Date());
    const now = new Date();
    const graceExpires = new Date(now.getTime() + 15 * 60 * 1000);

    const updated = await prisma.checkInRecord.update({
      where: { id: record.id },
      data: {
        prepaidAt: now,
        prepaidFee: currentDue,
        prepaidMethod: method,
        graceExpiresAt: graceExpires,
        status: 'PAID_GRACE',
      },
    });

    await prisma.payment.create({
      data: {
        checkInRecordId: record.id,
        amount: currentDue,
        method,
        type: 'CHECKOUT',
        status: 'PAID',
        paidAt: now,
        transactionCode: `GC-${code}-${Date.now()}`,
      },
    });

    return {
      ok: true,
      recordId: updated.id,
      amountPaid: Number(currentDue.toFixed(2)),
      graceExpiresAt: graceExpires.toISOString(),
      remainingDue: 0,
    };
  }

  static async payOverstay(code: string, method: 'CASH' | 'CARD' | 'EWALLET'): Promise<GuestPrepayResult> {
    const record = await prisma.checkInRecord.findFirst({
      where: {
        guestCode: code,
        status: { in: ['PARKING', 'PAID_GRACE'] },
        isMonthly: false,
      },
    });

    if (!record) {
      return { ok: false, recordId: '', amountPaid: 0, graceExpiresAt: '', remainingDue: 0, message: 'Mã khách không hợp lệ.' };
    }

    const anyRecord = record as any;
    if (!anyRecord.graceExpiresAt || new Date() < anyRecord.graceExpiresAt) {
      return { ok: false, recordId: record.id, amountPaid: 0, graceExpiresAt: '', remainingDue: 0, message: 'Chưa quá thời gian miễn phí.' };
    }

    const newGrace = new Date(Date.now() + 15 * 60 * 1000);
    const additionalFee = this.calcFee(anyRecord.graceExpiresAt, new Date());

    await prisma.payment.create({
      data: {
        checkInRecordId: record.id,
        amount: additionalFee,
        method,
        type: 'OVERSTAY',
        status: 'PAID',
        paidAt: new Date(),
        transactionCode: `GO-${code}-${Date.now()}`,
      },
    });

    const updated = await prisma.checkInRecord.update({
      where: { id: record.id },
      data: {
        prepaidAt: anyRecord.prepaidAt ?? new Date(),
        prepaidFee: Number((Number(anyRecord.prepaidFee ?? 0) + additionalFee).toFixed(2)),
        prepaidMethod: method,
        graceExpiresAt: newGrace,
        status: 'PAID_GRACE',
      },
    });

    return {
      ok: true,
      recordId: updated.id,
      amountPaid: Number(additionalFee.toFixed(2)),
      graceExpiresAt: newGrace.toISOString(),
      remainingDue: 0,
    };
  }

  static async confirmExit(code: string): Promise<GuestConfirmExitResult> {
    const record = await prisma.checkInRecord.findFirst({
      where: {
        guestCode: code,
        status: { in: ['PARKING', 'PAID_GRACE'] },
      },
      include: { vehicle: true, slot: true },
    });

    if (!record) {
      throw new Error('Mã khách không hợp lệ.');
    }

    const anyRecord = record as any;
    if (record.isMonthly) {
      const updated = await prisma.checkInRecord.update({
        where: { id: record.id },
        data: {
          checkOutTime: new Date(),
          exitedAt: new Date(),
          status: 'CHECKED_OUT',
          guestCode: null as string | null,
        },
      });
      return { ok: true, recordId: updated.id, fee: 0, method: 'CASH', checkOutTime: new Date().toISOString() };
    }

    const now = new Date();
    const grace = anyRecord.graceExpiresAt as Date | null | undefined;
    if (grace && now > grace) {
      throw new Error('Đã quá thời gian miễn phí. Vui lòng thanh toán phí phát sinh trước khi ra cổng.');
    }

    const totalFee = Number(anyRecord.prepaidFee ?? 0);
    if (totalFee < 0) throw new Error('Phí chưa được thanh toán.');

    const updated = await prisma.checkInRecord.update({
      where: { id: record.id },
      data: {
        checkOutTime: now,
        exitedAt: now,
        status: 'CHECKED_OUT',
        guestCode: null as string | null,
      },
    });

    const method = (anyRecord.prepaidMethod as 'CASH' | 'CARD' | 'EWALLET') ?? 'CASH';
    return { ok: true, recordId: updated.id, fee: totalFee, method, checkOutTime: updated.checkOutTime ? new Date(updated.checkOutTime).toISOString() : now.toISOString() };
  }

  static calcFee(checkIn: Date, current: Date): number {
    const minutes = Math.max(0, Math.floor((current.getTime() - checkIn.getTime()) / 60000));
    if (minutes <= 0) return 0;

    const firstHourMinutes = Math.min(minutes, 60);
    const remainingAfterFirstHour = Math.max(0, minutes - 60);
    const partialHours = Math.ceil(remainingAfterFirstHour / 60);

    const ratePerHour = 10000;
    const firstHourFee = firstHourMinutes <= 15 ? 0 : firstHourMinutes <= 30 ? 3000 : firstHourMinutes <= 45 ? 6000 : 10000;

    return Number((firstHourFee + partialHours * ratePerHour).toFixed(2));
  }

  static buildBreakdown(checkIn: Date, current: Date) {
    const minutes = Math.max(0, Math.floor((current.getTime() - checkIn.getTime()) / 60000));
    if (minutes <= 0) return [];

    const items: { label: string; minutesInBlock: number; lots: number; lotHours: number; rate: number; amount: number; note?: string }[] = [];

    const firstHourMinutes = Math.min(minutes, 60);
    let firstAmount = 0;
    let note = '';

    if (firstHourMinutes <= 15) {
      firstAmount = 0;
      note = 'Miễn phí ≤15 phút';
    } else if (firstHourMinutes <= 30) {
      firstAmount = 3000;
      note = 'Đến 30 phút';
    } else if (firstHourMinutes <= 45) {
      firstAmount = 6000;
      note = 'Đến 45 phút';
    } else {
      firstAmount = 10000;
      note = 'Đủ 60 phút';
    }

    const firstRate = firstHourMinutes <= 15 ? 0 : firstHourMinutes <= 30 ? 6000 : firstHourMinutes <= 45 ? 8000 : 10000;

    items.push({
      label: 'Giờ đầu',
      minutesInBlock: firstHourMinutes,
      lots: 1,
      lotHours: firstHourMinutes / 60,
      rate: firstRate,
      amount: firstAmount,
      note,
    });

    const remainingAfterFirstHour = Math.max(0, minutes - 60);
    if (remainingAfterFirstHour > 0) {
      const lots = Math.ceil(remainingAfterFirstHour / 60);
      items.push({
        label: 'Giờ tiếp theo',
        minutesInBlock: remainingAfterFirstHour,
        lots,
        lotHours: remainingAfterFirstHour / 60,
        rate: 10000,
        amount: Number((lots * 10000).toFixed(2)),
      });
    }

    return items;
  }
}
