import prisma from '../config/db';
import { floorService } from './floor.service';
import { AppError } from '../utils/helpers';
import { sendBookingEmail } from './email.service';

const BOOKING_ACTIVE = 'ACTIVE';
const BOOKING_FULFILLED = 'FULFILLED';
const BOOKING_CANCELLED = 'CANCELLED';
const BOOKING_NO_SHOW = 'NO_SHOW';
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
  floorId?: number;
}

export interface FulfillBookingInput {
  bookingId: string;
  staffId: string;
}

const bookingInclude = {
  floor: {
    select: {
      id: true,
      floorCode: true,
      name: true,
      vehicleType: true,
      customerType: true,
    },
  },
  vehicle: { include: { owner: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
} as const;

async function runWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 100): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      let isSerializationError = false;
      if (error && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (errObj.code === 'P2034' || (typeof errObj.message === 'string' && errObj.message.includes('serialization'))) {
          isSerializationError = true;
        }
      }
      if (isSerializationError && i < retries - 1) {
        await new Promise(res => setTimeout(res, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new AppError(500, 'Transaction conflict retry limit reached');
}

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

    // Public/casual booking is available for CAR vehicles only.
    if (vType !== 'CAR') {
      throw new AppError(400, 'Dịch vụ đặt chỗ trước chỉ áp dụng cho xe ô tô (CAR).');
    }

    // Determine target floor safely
    let targetFloorId = input.floorId;
    let floor: { id: number; floorCode: string; name: string; capacity: number; vehicleType: string; customerType: string } | null = null;
    let eligibleFloors: { id: number; floorCode: string; name: string; capacity: number; vehicleType: string; customerType: string }[] = [];

    if (targetFloorId) {
      floor = await prisma.floor.findUnique({ where: { id: targetFloorId } });
      if (!floor) {
        throw new AppError(404, 'Khu vực đỗ xe không tồn tại');
      }
      if (floor.vehicleType.toUpperCase() !== vType.toUpperCase()) {
        throw new AppError(400, 'Khu vực đỗ xe không khớp với loại phương tiện');
      }
      if (floor.customerType !== zone) {
        throw new AppError(400, 'Khu vực đỗ xe không khớp với loại khách hàng');
      }
    } else {
      eligibleFloors = await prisma.floor.findMany({
        where: {
          vehicleType: vType.toUpperCase(),
          customerType: zone,
        },
        orderBy: { id: 'asc' },
      });
      if (eligibleFloors.length === 0) {
        throw new AppError(
          404,
          `Không tìm thấy khu vực đỗ xe phù hợp cho xe ${vType === 'CAR' ? 'ô tô' : 'xe máy'} (${zone === 'MONTHLY' ? 'cư dân' : 'khách vãng lai'})`
        );
      }
    }

    // 3. Transaction: tạo booking + payment cọc + check capacity
    const booking = await runWithRetry(async () => {
      return prisma.$transaction(async (tx) => {
        let chosenFloorId: number;

        if (targetFloorId) {
          chosenFloorId = targetFloorId;

          const activeCheckIns = await tx.checkInRecord.count({
            where: {
              status: 'PARKING',
              OR: [
                { floorId: chosenFloorId },
                { slot: { floorId: chosenFloorId } }
              ]
            }
          });

          const activeBookingsCount = await tx.booking.count({
            where: {
              floorId: chosenFloorId,
              status: BOOKING_ACTIVE,
            },
          });

          if (activeCheckIns + activeBookingsCount >= floor!.capacity) {
            throw new AppError(409, `Khu vực đỗ xe ${floor!.name} đã hết chỗ trống dự kiến.`);
          }
        } else {
          let foundFloor = null;
          for (const ef of eligibleFloors) {
            const activeCheckIns = await tx.checkInRecord.count({
              where: {
                status: 'PARKING',
                OR: [
                  { floorId: ef.id },
                  { slot: { floorId: ef.id } }
                ]
              }
            });

            const activeBookingsCount = await tx.booking.count({
              where: {
                floorId: ef.id,
                status: BOOKING_ACTIVE,
              },
            });

            if (activeCheckIns + activeBookingsCount < ef.capacity) {
              foundFloor = ef;
              break;
            }
          }

          if (!foundFloor) {
            throw new AppError(409, 'Tất cả khu vực đỗ xe phù hợp đã hết chỗ trống dự kiến.');
          }

          chosenFloorId = foundFloor.id;
        }

        const depositAmt = isVehicleMonthly ? 0 : BOOKING_DEPOSIT;

        // Tạo mã đặt chỗ độc nhất dạng BK-XXXXXX
        let bookingCode = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (let attempt = 0; attempt < 5; attempt++) {
          let tempCode = 'BK-';
          for (let i = 0; i < 6; i++) {
            tempCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const existing = await tx.booking.findUnique({ where: { id: tempCode } });
          if (!existing) {
            bookingCode = tempCode;
            break;
          }
        }
        if (!bookingCode) {
          bookingCode = `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        }

        const newBooking = await tx.booking.create({
          data: {
            id:              bookingCode,
            vehicleId:       vehicle!.id,
            floorId:         chosenFloorId,
            expectedArrival: input.expectedArrival,
            status:          BOOKING_ACTIVE,
            depositAmount:   depositAmt,
            depositStatus:   'PAID',
            createdById:     input.createdById,
          },
          include: {
            floor: {
              select: {
                id: true,
                floorCode: true,
                name: true,
                vehicleType: true,
                customerType: true,
              },
            },
            vehicle: { include: { owner: true } },
            createdBy: { select: { id: true, fullName: true, email: true } },
          },
        });

        // Chỉ ghi nhận thu cọc 15.000đ nếu không phải cư dân (BR-BK-01)
        if (!isVehicleMonthly) {
          await tx.payment.create({
            data: {
              amount:          BOOKING_DEPOSIT,
              method:          'CASH',
              type:            'BOOKING_DEPOSIT',
              status:          'SUCCESS',
              paidAt:          new Date(),
              collectedById:   input.createdById,
              transactionCode: `DEP-${newBooking.id}`,
              bookingId:       newBooking.id,
            },
          });
        }

        return newBooking;
      }, {
        isolationLevel: 'Serializable',
      });
    });

    // Gửi email xác nhận đặt chỗ (bất đồng bộ - fire-and-forget)
    const emailTo = booking.vehicle?.owner?.email || booking.vehicle?.ownerEmail || booking.createdBy?.email;
    const nameTo = booking.vehicle?.owner?.fullName || booking.vehicle?.ownerFullName || booking.createdBy?.fullName || 'Quý khách';

    if (emailTo) {
      sendBookingEmail(emailTo, nameTo, {
        bookingId: booking.id,
        plateNumber: booking.vehicle.plateNumber,
        vehicleType: booking.vehicle.type as 'CAR' | 'MOTORBIKE',
        floorId: booking.floor.id,
        floorCode: booking.floor.floorCode,
        floorName: booking.floor.name,
        parkingArea: 'Khu ô tô',
        expectedArrival: booking.expectedArrival,
        depositAmount: Number(booking.depositAmount),
      }).catch(err => {
        console.error('[BookingEmail] Lỗi khi gửi email xác nhận đặt chỗ:', err);
      });
    }

    return booking;
  },

  async fulfill(input: FulfillBookingInput) {
    return runWithRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: input.bookingId },
          include: { vehicle: true },
        });
        if (!booking) throw new AppError(404, 'Không tìm thấy đặt chỗ');

        // Idempotency: if already FULFILLED, return existing check-in record
        if (booking.status === BOOKING_FULFILLED) {
          const existingRecord = await tx.checkInRecord.findFirst({
            where: { bookingId: booking.id },
          });
          return [booking, existingRecord];
        }

        if (booking.status !== BOOKING_ACTIVE) {
          throw new AppError(400, `Không thể xác nhận đặt chỗ ở trạng thái "${booking.status}"`);
        }

        const updatedBooking = await tx.booking.update({
          where: { id: input.bookingId },
          data: { status: BOOKING_FULFILLED },
        });

        const newRecord = await tx.checkInRecord.create({
          data: {
            vehicleId: booking.vehicleId,
            floorId:   booking.floorId,
            bookingId: booking.id,
            slotId:    null, // No slot auto-assignment at check-in
            isMonthly: false,
          },
        });

        return [updatedBooking, newRecord];
      }, {
        isolationLevel: 'Serializable',
      });
    });
  },

  async markNoShow(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: { select: { plateNumber: true } } },
    });
    if (!booking) throw new AppError(404, 'Không tìm thấy đặt chỗ');
    if (booking.status !== BOOKING_ACTIVE) {
      throw new AppError(400, `Không thể đánh dấu vắng mặt đặt chỗ ở trạng thái "${booking.status}"`);
    }

    return prisma.booking.update({
      where: { id: bookingId },
      data: { status: BOOKING_NO_SHOW, depositStatus: 'FORFEITED' },
    });
  },

  async cancel(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new AppError(404, 'Không tìm thấy đặt chỗ');
    if (booking.status === BOOKING_CANCELLED) {
      throw new AppError(400, 'Đặt chỗ đã được hủy trước đó');
    }

    return prisma.booking.update({
      where: { id: bookingId },
      data: { status: BOOKING_CANCELLED, depositStatus: 'FORFEITED' },
    });
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
      include: { floor: { select: { id: true, floorCode: true, name: true, vehicleType: true, customerType: true } } },
    });
  },
};