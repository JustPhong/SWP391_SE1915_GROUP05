import prisma from '../config/db';
import { floorService } from './floor.service';
import { slotSuggestionService } from './slotSuggestion.service';
import { AppError } from '../utils/helpers';

const BOOKING_ACTIVE = 'ACTIVE';
const BOOKING_FULFILLED = 'FULFILLED';
const BOOKING_CANCELLED = 'CANCELLED';
const BOOKING_NO_SHOW = 'NO_SHOW';
const SLOT_AVAILABLE = 'AVAILABLE';
const SLOT_RESERVED = 'RESERVED';
const SLOT_OCCUPIED = 'OCCUPIED';
const BOOKING_DEPOSIT = 15000;

export interface CreateBookingInput {
  plateNumber: string;
  expectedArrival: Date;
  createdById: string;
  ownerFullName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  type?: 'CAR' | 'MOTORBIKE';
  brand?: string;
  model?: string;
  color?: string;
  year?: number;
  seats?: number;
}


export interface FulfillBookingInput {
  bookingId: string;
  staffId: string;
}

const bookingInclude = {
  slot: {
    include: {
      floor: {
        select: {
          floorCode: true,
          name: true,
          vehicleType: true,
          customerType: true,
        },
      },
    },
  },
  vehicle: { include: { owner: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
} as const;

export const bookingService = {
  async create(input: CreateBookingInput) {
    // 1. Find or create vehicle (casual bookings are allowed)
    let vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: input.plateNumber },
      include: { monthlyPackage: true }
    });
    if (!vehicle) {
      // Xe chưa từng đăng ký → bắt buộc thông tin liên hệ chủ xe
      const ownerFullName = input.ownerFullName?.trim();
      const ownerEmail = input.ownerEmail?.trim();
      const ownerPhone = input.ownerPhone?.trim();

      if (!ownerFullName || !ownerPhone) {
        throw new AppError(
          400,
          'Biển số chưa được đăng ký. Vui lòng nhập họ tên và số điện thoại chủ xe.'
        );
      }

      const vehicleType = input.type === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR';

      vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: input.plateNumber,
          type: vehicleType,
          ownerId: input.createdById,
          isMonthly: false,
          ownerFullName,
          ownerEmail: ownerEmail ? ownerEmail.toLowerCase() : undefined,
          ownerPhone,
          brand: input.brand?.trim() || undefined,
          model: input.model?.trim() || undefined,
          color: input.color?.trim() || undefined,
          year: input.year,
          seats: vehicleType === 'CAR' ? input.seats : undefined,
        },
        include: { monthlyPackage: true }
      });
    }

    const isVehicleMonthly = vehicle.isMonthly || !!vehicle.monthlyPackage;
    const vType = vehicle.type;
    const zone = isVehicleMonthly ? 'MONTHLY' : 'CASUAL';

    // 2. Auto-assign best slot using the existing Greedy algorithm
    const suggestion = await slotSuggestionService.suggestSlot(vType, zone);
    if (!suggestion) {
      throw new AppError(409, `Hiện không còn chỗ trống cho ${isVehicleMonthly ? 'cư dân' : 'khách vãng lai'} (${vType === 'CAR' ? 'ô tô' : 'xe máy'}). Vui lòng thử lại sau.`);
    }

    // 3. Transaction: tạo booking + payment cọc + reserve slot
    const booking = await prisma.$transaction(async (tx) => {
      const depositAmt = isVehicleMonthly ? 0 : BOOKING_DEPOSIT;
      const newBooking = await tx.booking.create({
        data: {
          vehicleId:       vehicle.id,
          slotId:          suggestion.slotId,
          expectedArrival: input.expectedArrival,
          status:          BOOKING_ACTIVE,
          depositAmount:   depositAmt,
          depositStatus:   'PAID',
          createdById:     input.createdById,
        },
        include: {
          slot: {
            include: {
              floor: {
                select: {
                  floorCode: true,
                  name: true,
                  vehicleType: true,
                  customerType: true,
                },
              },
            },
          },
          vehicle: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      // Chỉ ghi nhận thu cọc 15.000đ nếu không phải cư dân (BR-BK-01)
      if (!isVehicleMonthly) {
        await tx.payment.create({
          data: {
            amount:          BOOKING_DEPOSIT,
            method:          'CASH',
            type:            'SESSION',
            status:          'SUCCESS',
            paidAt:          new Date(),
            collectedById:   input.createdById,
            transactionCode: `DEP-${newBooking.id}`,
          },
        });
      }

      // Giữ slot
      await tx.parkingSlot.update({
        where: { id: suggestion.slotId },
        data: { status: SLOT_RESERVED },
      });

      return newBooking;
    });

    return booking;
  },

  async fulfill(input: FulfillBookingInput) {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: { slot: true },
    });
    if (!booking) throw new AppError(404, 'Không tìm thấy đặt chỗ');
    if (booking.status !== BOOKING_ACTIVE) {
      throw new AppError(400, `Không thể xác nhận đặt chỗ ở trạng thái "${booking.status}"`);
    }

    return prisma.$transaction([
      prisma.booking.update({
        where: { id: input.bookingId },
        data: { status: BOOKING_FULFILLED },
      }),
      prisma.parkingSlot.update({
        where: { id: booking.slotId },
        data: { status: SLOT_OCCUPIED },
      }),
      prisma.checkInRecord.create({
        data: {
          vehicleId: booking.vehicleId,
          slotId:    booking.slotId,
          isMonthly: false,
        },
      }),
    ]);
  },

  async markNoShow(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true, vehicle: { select: { plateNumber: true } } },
    });
    if (!booking) throw new AppError(404, 'Không tìm thấy đặt chỗ');
    if (booking.status !== BOOKING_ACTIVE) {
      throw new AppError(400, `Không thể đánh dấu vắng mặt đặt chỗ ở trạng thái "${booking.status}"`);
    }

    return prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: BOOKING_NO_SHOW, depositStatus: 'FORFEITED' },
      }),
      prisma.parkingSlot.update({
        where: { id: booking.slotId },
        data: { status: SLOT_AVAILABLE },
      }),
    ]);
  },

  async cancel(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    });
    if (!booking) throw new AppError(404, 'Không tìm thấy đặt chỗ');
    if (booking.status === BOOKING_CANCELLED) {
      throw new AppError(400, 'Đặt chỗ đã được hủy trước đó');
    }

    // BR07: khi hủy → nhả slot về AVAILABLE
    return prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: BOOKING_CANCELLED, depositStatus: 'FORFEITED' },
      }),
      prisma.parkingSlot.update({
        where: { id: booking.slotId },
        data: { status: SLOT_AVAILABLE },
      }),
    ]);
  },

  async getActiveBookings() {
    await floorService.cleanupNoShowBookings();
    return prisma.booking.findMany({
      where: { status: BOOKING_ACTIVE },
      include: bookingInclude,
      orderBy: { bookingTime: 'desc' },
    });
  },

  async getAll() {
    await floorService.cleanupNoShowBookings();
    return prisma.booking.findMany({
      include: bookingInclude,
      orderBy: { bookingTime: 'desc' },
    });
  },

  async getByVehicle(vehicleId: string) {
    return prisma.booking.findMany({
      where: { vehicleId },
      orderBy: { bookingTime: 'desc' },
      include: { slot: { include: { floor: { select: { floorCode: true, name: true, vehicleType: true, customerType: true } } } } },
    });
  },
};