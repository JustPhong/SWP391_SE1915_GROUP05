import prisma from '../config/db';
import { floorService } from './floor.service';
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
  slotId?: string;
  expectedArrival: Date;
  createdById: string;
}

export interface FulfillBookingInput {
  bookingId: string;
  staffId: string;
}

export const bookingService = {
  async create(input: CreateBookingInput) {
    // 1. Find vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: input.plateNumber },
    });

    // BR01 + BR02: chỉ cư dân gói tháng mới được booking
    if (!vehicle) {
      throw new AppError(403, 'Xe chưa đăng ký trong hệ thống. Khách vãng lai không được đặt chỗ trước.');
    }
    if (!vehicle.isMonthly) {
      throw new AppError(403, 'BR02: Khách vãng lai không được tạo booking trước.');
    }

    // Kiểm tra gói tháng còn hiệu lực
    const activePackage = await prisma.monthlyPackage.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: 'ACTIVE',
        expiryDate: { gt: new Date() },
      },
    });
    if (!activePackage) {
      throw new AppError(403, 'BR01: Gói tháng đã hết hạn. Vui lòng gia hạn để đặt chỗ.');
    }

    // 2. Load slot + floor
    if (!input.slotId) {
      throw new AppError(400, 'Vui lòng chọn vị trí đỗ xe.');
    }
    const slot = await prisma.parkingSlot.findUnique({
      where: { id: input.slotId },
      include: { floor: true },
    });
    if (!slot) throw new AppError(404, 'Không tìm thấy vị trí đỗ');

    // BR03: chỉ MONTHLY floor mới được chọn slot cụ thể
    if (slot.floor.customerType !== 'MONTHLY') {
      throw new AppError(400, 'BR03: Khách vãng lai không được chọn vị trí đỗ xe.');
    }

    // Loại xe phải khớp
    if (slot.floor.vehicleType !== 'CAR') {
      throw new AppError(400, 'Chỉ đặt chỗ được cho ô tô.');
    }

    // BR04: slot phải AVAILABLE
    if (slot.status !== SLOT_AVAILABLE) {
      throw new AppError(409, 'BR04: Vị trí này không còn trống.');
    }

    // BR06: không được có 2 booking trùng thời gian cho cùng slot (±30 phút)
    const arrival = new Date(input.expectedArrival);
    const windowStart = new Date(arrival.getTime() - 30 * 60000);
    const windowEnd   = new Date(arrival.getTime() + 30 * 60000);

    const conflict = await prisma.booking.findFirst({
      where: {
        slotId: input.slotId,
        status: BOOKING_ACTIVE,
        expectedArrival: { gte: windowStart, lte: windowEnd },
      },
    });
    if (conflict) {
      throw new AppError(409, 'BR06: Vị trí này đã có booking trong khoảng thời gian đó.');
    }

    // 5. Transaction: tạo booking + payment cọc + reserve slot
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          vehicleId:       vehicle.id,
          slotId:          input.slotId!,
          expectedArrival: input.expectedArrival,
          status:          BOOKING_ACTIVE,
          depositAmount:   BOOKING_DEPOSIT,
          depositStatus:   'PAID',
          createdById:     input.createdById,
        },
        include: {
          slot: true,
          vehicle: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      // Ghi nhận thu cọc 15.000đ (BR-BK-01)
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

      // Giữ slot
      await tx.parkingSlot.update({
        where: { id: input.slotId },
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
      include: {
        slot: true,
        vehicle: { include: { owner: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { bookingTime: 'desc' },
    });
  },

  async getAll() {
    await floorService.cleanupNoShowBookings();
    return prisma.booking.findMany({
      include: {
        slot: true,
        vehicle: { include: { owner: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { bookingTime: 'desc' },
    });
  },

  async getByVehicle(vehicleId: string) {
    return prisma.booking.findMany({
      where: { vehicleId },
      orderBy: { bookingTime: 'desc' },
      include: { slot: true },
    });
  },
};