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
  slotId: string;
  expectedArrival: Date;
  createdById: string;
}

export interface FulfillBookingInput {
  bookingId: string;
  staffId: string;
}

export const bookingService = {
  async create(input: CreateBookingInput) {
    // 1. Find or create vehicle by plate number (type CAR)
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

    // 2. Load the slot + its floor
    const slot = await prisma.parkingSlot.findUnique({
      where: { id: input.slotId },
      include: { floor: true },
    });
    if (!slot) throw new AppError(404, 'Không tìm thấy vị trí đỗ');

    // 3. Business rule: slot's floor must be CAR + CASUAL (Tầng 3)
    if (slot.floor.vehicleType !== 'CAR' || slot.floor.customerType !== 'CASUAL') {
      throw new AppError(400, 'Chỉ có thể đặt chỗ tại Tầng 3 (ô tô, khách vãng lai)');
    }

    // 4. Business rule: slot must be AVAILABLE
    if (slot.status !== SLOT_AVAILABLE) {
      throw new AppError(409, 'Vị trí này không còn trống');
    }

    // 5. Create booking + reserve slot in a transaction
    const [booking] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          vehicleId: vehicle.id,
          slotId: input.slotId,
          expectedArrival: input.expectedArrival,
          status: BOOKING_ACTIVE,
          depositAmount: BOOKING_DEPOSIT,
          depositStatus: 'PAID',
          createdById: input.createdById,
        },
        include: {
          slot: true,
          vehicle: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.parkingSlot.update({
        where: { id: input.slotId },
        data: { status: SLOT_RESERVED },
      }),
    ]);

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
          slotId: booking.slotId,
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
