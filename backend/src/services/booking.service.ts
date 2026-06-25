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
}

export interface FulfillBookingInput {
  bookingId: string;
  staffId: string;
}

export const bookingService = {
  async create(input: CreateBookingInput) {
    // 1. Find or create vehicle (casual bookings are allowed)
    let vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: input.plateNumber },
    });
    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: input.plateNumber,
          type: 'CAR',
          ownerId: input.createdById,
          isMonthly: false,
        },
      });
    }

    // 2. Auto-assign best slot using the existing Greedy algorithm
    const suggestion = await slotSuggestionService.suggestSlot('CAR', 'CASUAL');
    if (!suggestion) {
      throw new AppError(409, 'Hiện không còn chỗ trống cho khách vãng lai (ô tô). Vui lòng thử lại sau.');
    }

    // 3. Transaction: tạo booking + payment cọc + reserve slot
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          vehicleId:       vehicle.id,
          slotId:          suggestion.slotId,
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