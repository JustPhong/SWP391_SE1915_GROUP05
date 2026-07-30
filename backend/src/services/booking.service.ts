import prisma from '../config/db';
import { floorService } from './floor.service';
import { AppError } from '../utils/helpers';
import { sendBookingEmail } from './email.service';
import { stripe } from '../config/stripe';
import { Prisma, MonthlyPackage, Vehicle } from '@prisma/client';
import { acquireVehicleOrPlateLock, getVehicleOperationalState } from '../utils/vehicleState';

const BOOKING_ACTIVE = 'ACTIVE';
const BOOKING_FULFILLED = 'FULFILLED';
const BOOKING_CANCELLED = 'CANCELLED';
const BOOKING_NO_SHOW = 'NO_SHOW';
const BOOKING_DEPOSIT = 15000;

export function isMonthlyPackageValid(pkg: MonthlyPackage | null | undefined, vehicle: Vehicle, userId: string, now: Date = new Date()): boolean {
  if (!pkg) return false;
  if (pkg.status !== 'ACTIVE') return false;
  if (new Date(pkg.expiryDate).getTime() <= now.getTime()) return false;
  if (pkg.vehicleId !== vehicle.id) return false;
  if (vehicle.ownerId !== userId) return false;
  return true;
}

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
  checkInRecords: {
    where: {
      bookingId: {
        not: null,
      },
    },
    orderBy: {
      checkInTime: 'desc',
    },
    take: 1,
    select: {
      checkInTime: true,
    },
  },
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

    const isVehicleMonthly = vehicle ? isMonthlyPackageValid(vehicle.monthlyPackage, vehicle, vehicle.ownerId) : false;
    if (isVehicleMonthly) {
      throw new AppError(400, 'Xe đang có gói tháng còn hiệu lực và không cần đặt chỗ.');
    }
    const vType = vehicle.type;
    const zone = isVehicleMonthly ? 'MONTHLY' : 'CASUAL';

    const creatorUser = await prisma.user.findUnique({
      where: { id: input.createdById },
      include: { roleRef: true },
    });
    if (creatorUser?.roleRef?.name === 'DRIVER') {
      throw new AppError(400, 'Vui lòng thực hiện đặt chỗ và thanh toán qua Stripe.');
    }

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
      if (floor.floorCode.toUpperCase() === 'G') {
        throw new AppError(400, 'Tầng G không áp dụng cho đặt chỗ trước.');
      }
      if (floor.customerType === 'MONTHLY') {
        throw new AppError(400, 'Khu vực cư dân (MONTHLY) không áp dụng cho đặt chỗ trước.');
      }
      if (floor.vehicleType.toUpperCase() !== 'CAR') {
        throw new AppError(400, 'Khu vực đỗ xe không khớp với loại phương tiện ô tô (CAR)');
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
          vehicleType: 'CAR',
          customerType: 'CASUAL',
          floorCode: { not: 'G' },
        },
        orderBy: { id: 'asc' },
      });
      if (eligibleFloors.length === 0) {
        throw new AppError(
          404,
          `Không tìm thấy khu vực đỗ xe phù hợp cho xe ô tô (khách vãng lai)`
        );
      }
    }

    const booking = await runWithRetry(async () => {
      return prisma.$transaction(async (tx) => {
        // Concurrency lock
        await acquireVehicleOrPlateLock(tx, vehicle?.id, input.plateNumber);

        // Fetch operational state
        const state = await getVehicleOperationalState(tx, {
          vehicleId: vehicle?.id,
          plateNumber: input.plateNumber
        });

        if (state.activeCheckIn) {
          throw new AppError(409, 'Xe đang ở trong bãi. Vui lòng Check-out trước khi đặt chỗ mới.');
        }

        if (state.activeBooking) {
          throw new AppError(409, 'Xe này đang có một lượt đặt chỗ còn hiệu lực.');
        }

        if (state.activeMonthlyPackage) {
          throw new AppError(409, 'Xe đang sử dụng gói tháng và không cần đặt chỗ theo lượt.');
        }

        let chosenFloorId: number;

        if (targetFloorId) {
          chosenFloorId = targetFloorId;

          const physicalAvailableSlots = await tx.parkingSlot.count({
            where: {
              floorId: chosenFloorId,
              status: 'AVAILABLE',
            },
          });

          const activeBookingCount = await tx.booking.count({
            where: {
              floorId: chosenFloorId,
              status: 'ACTIVE',
              depositStatus: 'PAID',
              expiresAt: { gt: new Date() },
              checkInRecords: {
                none: {},
              },
            },
          });

          const receivableCapacity = Math.max(0, physicalAvailableSlots - activeBookingCount);

          if (receivableCapacity <= 0) {
            throw new AppError(409, `Khu vực đỗ xe ${floor!.name} đã hết chỗ trống dự kiến.`);
          }
        } else {
          let foundFloor = null;
          for (const ef of eligibleFloors) {
            const physicalAvailableSlots = await tx.parkingSlot.count({
              where: {
                floorId: ef.id,
                status: 'AVAILABLE',
              },
            });

            const activeBookingCount = await tx.booking.count({
              where: {
                floorId: ef.id,
                status: 'ACTIVE',
                depositStatus: 'PAID',
                expiresAt: { gt: new Date() },
                checkInRecords: {
                  none: {},
                },
              },
            });

            const receivableCapacity = Math.max(0, physicalAvailableSlots - activeBookingCount);

            if (receivableCapacity > 0) {
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

    const emailTo = booking.createdBy?.email || booking.vehicle?.owner?.email;
    const nameTo = booking.createdBy?.fullName || booking.vehicle?.owner?.fullName || 'Quý khách';
    const smtpUser = process.env.GMAIL_USER || '';

    if (emailTo && emailTo.trim().toLowerCase() !== smtpUser.trim().toLowerCase()) {
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

        if (booking.expiresAt && booking.expiresAt < new Date()) {
          throw new AppError(400, 'Lượt đặt chỗ đã hết hạn.');
        }

        // Concurrency lock
        await acquireVehicleOrPlateLock(tx, booking.vehicleId, booking.vehicle.plateNumber);

        // Fetch operational state
        const state = await getVehicleOperationalState(tx, {
          vehicleId: booking.vehicleId,
          plateNumber: booking.vehicle.plateNumber,
          excludeBookingId: booking.id,
        });

        if (state.activeCheckIn) {
          throw new AppError(
            409,
            `Biển số ${booking.vehicle.plateNumber} hiện đang có lượt gửi xe trong bãi. Vui lòng check-out lượt hiện tại trước khi check-in lại.`,
            true,
            'ACTIVE_PARKING_SESSION'
          );
        }

        const newRecord = await tx.checkInRecord.create({
          data: {
            vehicleId: booking.vehicleId,
            floorId:   booking.floorId,
            bookingId: booking.id,
            slotId:    null, // No slot auto-assignment at check-in
            isMonthly: false,
          },
        });

        const updatedBooking = await tx.booking.update({
          where: { id: input.bookingId },
          data: { status: BOOKING_FULFILLED },
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

  async getActiveBookings(userId?: string) {
    await floorService.cleanupNoShowBookings();
    return prisma.booking.findMany({
      where: {
        status: BOOKING_ACTIVE,
        depositStatus: 'PAID',
        expiresAt: {
          not: null,
          gt: new Date()
        },
        checkInRecords: {
          none: {}
        },
        ...(userId ? {
          vehicle: {
            ownerId: userId
          }
        } : {})
      },
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

  async getById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        payments: {
          select: {
            type: true,
            status: true,
            amount: true,
          },
        },
        floor: true,
        vehicle: true,
      },
    });
  },

  async createCheckoutSession(input: { userId: string; vehicleId: string; expectedArrival: Date }) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      include: { monthlyPackage: true },
    });
    if (!vehicle) throw new AppError(404, 'Không tìm thấy phương tiện');
    if (vehicle.ownerId !== input.userId) {
      throw new AppError(403, 'Bạn không có quyền với xe này');
    }
    const isVehicleMonthly = isMonthlyPackageValid(vehicle.monthlyPackage, vehicle, input.userId);
    if (isVehicleMonthly) {
      throw new AppError(400, 'Xe đang có gói tháng còn hiệu lực và không cần đặt chỗ.');
    }
    if (vehicle.type !== 'CAR') {
      throw new AppError(400, 'Dịch vụ đặt chỗ trước chỉ áp dụng cho xe ô tô (CAR).');
    }

    const state = await prisma.$transaction(async (tx) => {
      await acquireVehicleOrPlateLock(tx, input.vehicleId, vehicle.plateNumber);
      return getVehicleOperationalState(tx, {
        vehicleId: input.vehicleId,
        plateNumber: vehicle.plateNumber
      });
    });

    if (state.activeCheckIn) {
      throw new AppError(409, 'Xe đang ở trong bãi. Vui lòng Check-out trước khi đặt chỗ mới.');
    }
    if (state.activeBooking) {
      throw new AppError(409, 'Xe này đang có một lượt đặt chỗ còn hiệu lực.');
    }
    if (state.activeMonthlyPackage) {
      throw new AppError(409, 'Xe đang sử dụng gói tháng và không cần đặt chỗ theo lượt.');
    }

    const now = new Date();
    console.log(`[StripeCheckout] Start session creation: userId=${input.userId}, vehicleId=${input.vehicleId}, expectedArrival=${input.expectedArrival.toISOString()}`);

    const existingActive = await prisma.booking.findFirst({
      where: {
        vehicleId: input.vehicleId,
        status: 'ACTIVE',
      },
    });
    if (existingActive) {
      throw new AppError(400, 'Phương tiện này đang có lượt đặt chỗ hoạt động.');
    }

    let booking: any = null;
    let payment: any = null;

    const existingPending = await prisma.booking.findFirst({
      where: {
        vehicleId: input.vehicleId,
        status: 'PENDING_PAYMENT',
      },
      include: {
        payments: {
          where: { type: 'BOOKING_FEE', status: 'PENDING' }
        }
      }
    });

    if (existingPending) {
      console.log(`[StripeCheckout] Found existing pending booking: bookingId=${existingPending.id}`);

      // If the booking already has a Stripe session, check its status before creating a new one
      if (existingPending.stripeCheckoutSessionId) {
        let existingSession;
        try {
          existingSession = await stripe.checkout.sessions.retrieve(existingPending.stripeCheckoutSessionId);
        } catch (retrieveErr: unknown) {
          const msg = retrieveErr instanceof Error ? retrieveErr.message : String(retrieveErr);
          console.warn(`[StripeCheckout] Failed to retrieve existing session ${existingPending.stripeCheckoutSessionId}: ${msg}. Will create replacement.`);
        }

        if (existingSession) {
          if (existingSession.payment_status === 'paid') {
            // Session is already paid — finalize and return without creating another session
            console.log(`[StripeCheckout] Existing session ${existingSession.id} is already paid. Running reconciliation instead of new session.`);
            const reconResult = await this.finalizePaidBookingCheckout(existingSession.id);
            return {
              success: true,
              checkoutUrl: '',
              sessionId: existingSession.id,
              bookingId: existingPending.id,
              alreadyPaid: true,
              booking: reconResult.booking,
            };
          } else if (existingSession.status === 'open') {
            // Session is still open and unpaid — return the existing URL
            console.log(`[StripeCheckout] Reusing open existing session: sessionId=${existingSession.id}`);
            return {
              success: true,
              checkoutUrl: existingSession.url!,
              sessionId: existingSession.id,
              bookingId: existingPending.id,
            };
          } else {
            // Session is expired/complete but not paid — fall through to create a replacement
            console.log(`[StripeCheckout] Existing session ${existingSession.id} has status=${existingSession.status}, payment_status=${existingSession.payment_status}. Will create replacement session.`);
          }
        }
      }

      console.log(`[StripeCheckout] Reusing existing pending booking: bookingId=${existingPending.id}`);
      booking = existingPending;
      payment = existingPending.payments[0] || null;
      if (!payment) {
        payment = await prisma.payment.create({
          data: {
            bookingId: booking.id,
            checkInRecordId: null,
            monthlyPackageId: null,
            amount: 15000,
            method: 'CARD',
            type: 'BOOKING_FEE',
            status: 'PENDING',
            paidAt: null,
          },
        });
        console.log(`[StripeCheckout] Recreated pending payment for existing booking: paymentId=${payment.id}`);
      } else {
        console.log(`[StripeCheckout] Reusing pending payment: paymentId=${payment.id}`);
      }
    } else {
      const eligibleFloors = await prisma.floor.findMany({
        where: {
          vehicleType: 'CAR',
          customerType: 'CASUAL',
          floorCode: { not: 'G' },
        },
        orderBy: { id: 'asc' },
      });
      if (eligibleFloors.length === 0) {
        throw new AppError(404, 'Không tìm thấy khu vực đỗ xe phù hợp cho khách vãng lai.');
      }

      let chosenFloorId: number | null = null;
      for (const ef of eligibleFloors) {
        const physicalAvailableSlots = await prisma.parkingSlot.count({
          where: {
            floorId: ef.id,
            status: 'AVAILABLE',
          },
        });

        const activeBookingCount = await prisma.booking.count({
          where: {
            floorId: ef.id,
            status: 'ACTIVE',
            depositStatus: 'PAID',
            expiresAt: { gt: now },
            checkInRecords: {
              none: {},
            },
          },
        });

        const receivableCapacity = Math.max(0, physicalAvailableSlots - activeBookingCount);

        if (receivableCapacity > 0) {
          chosenFloorId = ef.id;
          break;
        }
      }

      if (!chosenFloorId) {
        throw new AppError(409, 'Khu vực này hiện đã hết khả năng nhận thêm xe.');
      }

      const finalFloorId = chosenFloorId;

      let bookingCode = '';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (let attempt = 0; attempt < 5; attempt++) {
        let tempCode = 'BK-';
        for (let i = 0; i < 6; i++) {
          tempCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existingCode = await prisma.booking.findUnique({ where: { id: tempCode } });
        if (!existingCode) {
          bookingCode = tempCode;
          break;
        }
      }
      if (!bookingCode) {
        bookingCode = `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }

      const dbResult = await prisma.$transaction(async (tx) => {
        // Concurrency lock
        await acquireVehicleOrPlateLock(tx, input.vehicleId, vehicle.plateNumber);

        // Fetch operational state
        const state = await getVehicleOperationalState(tx, {
          vehicleId: input.vehicleId,
          plateNumber: vehicle.plateNumber
        });

        if (state.activeCheckIn) {
          throw new AppError(409, 'Xe đang ở trong bãi. Vui lòng Check-out trước khi đặt chỗ mới.');
        }

        if (state.activeBooking) {
          throw new AppError(409, 'Xe này đang có một lượt đặt chỗ còn hiệu lực.');
        }

        if (state.activeMonthlyPackage) {
          throw new AppError(409, 'Xe đang sử dụng gói tháng và không cần đặt chỗ theo lượt.');
        }

        if (state.pendingBookingPayment) {
          throw new AppError(409, 'Xe này đang có một giao dịch đặt chỗ đang chờ xử lý.');
        }

        const newBooking = await tx.booking.create({
          data: {
            id: bookingCode,
            vehicleId: input.vehicleId,
            floorId: finalFloorId,
            expectedArrival: input.expectedArrival,
            status: 'PENDING_PAYMENT',
            depositAmount: 15000,
            depositStatus: 'PENDING',
            createdById: input.userId,
          },
        });

        const newPayment = await tx.payment.create({
          data: {
            bookingId: newBooking.id,
            checkInRecordId: null,
            monthlyPackageId: null,
            amount: 15000,
            method: 'CARD',
            type: 'BOOKING_FEE',
            status: 'PENDING',
            paidAt: null,
          },
        });

        return { booking: newBooking, payment: newPayment };
      });

      booking = dbResult.booking;
      payment = dbResult.payment;
      console.log(`[StripeCheckout] Created new pending booking: bookingId=${booking.id}, paymentId=${payment.id}`);
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new AppError(500, 'FRONTEND_URL environment variable is not configured.');
    }

    console.log(`[StripeCheckout] Initiating Stripe Checkout Session create for bookingId=${booking.id}`);

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        success_url: `${frontendUrl}/driver/booking?success=true&booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/driver/booking?cancelled=true&booking_id=${booking.id}`,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'vnd',
              product_data: {
                name: 'Phí giữ chỗ ParkSmart',
                description: 'Đặt chỗ ô tô - Phí giữ chỗ 30 phút',
              },
              unit_amount: 15000,
            },
            quantity: 1,
          },
        ],
        metadata: {
          paymentType: 'BOOKING_FEE',
          bookingId: String(booking.id),
          paymentId: String(payment.id),
          userId: String(input.userId),
          vehicleId: String(input.vehicleId),
        },
      });
      console.log(`[StripeCheckout] Stripe Session created successfully: sessionId=${session.id}, url=${session.url}`);
    } catch (stripeErr: any) {
      console.error(`[StripeCheckout] Stripe Checkout Session creation failed: name=${stripeErr.name}, code=${stripeErr.code}, type=${stripeErr.type}, message=${stripeErr.message}`);
      
      if (!existingPending && booking) {
        console.log(`[StripeCheckout] Cleaning up newly-created pending booking due to Stripe failure: bookingId=${booking.id}`);
        try {
          await prisma.payment.deleteMany({ where: { bookingId: booking.id } });
          await prisma.booking.delete({ where: { id: booking.id } });
        } catch (cleanupErr: any) {
          console.error('[StripeCheckout] Cleanup failed:', cleanupErr.message);
        }
      }
      throw new AppError(500, `Unable to create Stripe Checkout Session: ${stripeErr.message}`);
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return {
      success: true,
      checkoutUrl: session.url!,
      sessionId: session.id,
      bookingId: booking.id,
    };
  },

  async finalizeBookingPaymentInTransaction(
    bookingId: string,
    paymentIntentId: string | null,
    sessionId: string,
    overrideConfirmedAt?: Date
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          vehicle: {
            include: { owner: true },
          },
          createdBy: true,
          floor: true,
        },
      });
      if (!booking) throw new AppError(404, 'Không tìm thấy đặt chỗ.');

      // If already processed, return success
      if (booking.status === 'ACTIVE' && booking.depositStatus === 'PAID') {
        return { success: true, alreadyProcessed: true, booking };
      }

      // Check for active checkins/bookings capacity using receivableCapacity
      const floor = await tx.floor.findUnique({ where: { id: booking.floorId } });
      if (!floor) throw new AppError(404, 'Khu vực đỗ xe không tồn tại.');

      const physicalAvailableSlots = await tx.parkingSlot.count({
        where: {
          floorId: floor.id,
          status: 'AVAILABLE',
        },
      });

      const activeBookingCount = await tx.booking.count({
        where: {
          floorId: floor.id,
          status: 'ACTIVE',
          depositStatus: 'PAID',
          expiresAt: { gt: new Date() },
          checkInRecords: {
            none: {},
          },
        },
      });

      const receivableCapacity = Math.max(0, physicalAvailableSlots - activeBookingCount);

      if (receivableCapacity <= 0) {
        console.warn(`[StripeWebhook/Reconcile] OVER CAPACITY: floor ${floor.name} is full. Aborting booking finalization for bookingId=${booking.id}`);
        throw new AppError(409, 'Khu vực đỗ xe đã hết chỗ trống dự kiến.');
      }

      // Resolve the linked BOOKING_FEE Payment
      const payment = await tx.payment.findFirst({
        where: { bookingId: booking.id, status: 'PENDING' },
      });

      // Use Stripe-provided payment time if available, otherwise now
      const confirmedAt = overrideConfirmedAt ?? new Date();
      const expiresAt = new Date(confirmedAt.getTime() + 30 * 60 * 1000);

      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            paidAt: confirmedAt,
            transactionCode: paymentIntentId ?? null,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            checkInRecordId: null,
            monthlyPackageId: null,
            amount: 15000,
            method: 'CARD',
            type: 'BOOKING_FEE',
            status: 'SUCCESS',
            paidAt: confirmedAt,
            transactionCode: paymentIntentId ?? null,
          },
        });
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'ACTIVE',
          depositStatus: 'PAID',
          confirmedAt,
          expiresAt,
          stripeCheckoutSessionId: sessionId,
        },
        include: {
          vehicle: {
            include: { owner: true },
          },
          createdBy: true,
          floor: true,
        },
      });

      console.log(`[StripeWebhook/Reconcile] Atomic finalization succeeded: bookingId=${booking.id}, newBookingStatus=${updatedBooking.status}, newDepositStatus=${updatedBooking.depositStatus}, confirmedAt=${confirmedAt.toISOString()}, expiresAt=${expiresAt.toISOString()}`);

      return { success: true, alreadyProcessed: false, booking: updatedBooking };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return result;
  },

  async finalizePaidBookingCheckout(sessionId: string) {
    console.log(`[Reconciliation] Running reconciliation for Stripe session ID: ${sessionId}`);

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Reconciliation] Failed to retrieve session from Stripe: ${msg}`);
      throw new AppError(400, `Không thể truy xuất thông tin phiên thanh toán: ${msg}`);
    }

    if (session.payment_status !== 'paid') {
      console.warn(`[Reconciliation] Session ${sessionId} is not paid. Current status: ${session.payment_status}`);
      throw new AppError(400, 'Giao dịch chưa được thanh toán thành công.');
    }

    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      throw new AppError(400, 'Không tìm thấy mã đặt chỗ trong metadata của phiên thanh toán.');
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    // Derive the actual payment timestamp from Stripe PaymentIntent.created
    // session.payment_intent.created is Unix epoch seconds
    let overrideConfirmedAt: Date | undefined;
    if (session.payment_intent && typeof session.payment_intent === 'object' && 'created' in session.payment_intent) {
      const piCreated = (session.payment_intent as { created: number }).created;
      if (typeof piCreated === 'number' && piCreated > 0) {
        overrideConfirmedAt = new Date(piCreated * 1000);
        console.log(`[Reconciliation] Using Stripe payment timestamp: ${overrideConfirmedAt.toISOString()}`);
      }
    }

    const result = await this.finalizeBookingPaymentInTransaction(bookingId, paymentIntentId, session.id, overrideConfirmedAt);

    // Send email confirmation if this was just processed
    if (result.success && !result.alreadyProcessed && result.booking) {
      const finalBooking = result.booking;
      const ownerEmail = finalBooking.createdBy?.email;
      const ownerName = finalBooking.createdBy?.fullName || 'Quý khách';

      if (ownerEmail) {
        const [local, domain] = ownerEmail.split('@');
        const maskedEmail = local.length > 2 ? `${local[0]}***${local[local.length-1]}@${domain}` : `***@${domain}`;

        let bookingToMail = null;
        try {
          bookingToMail = await prisma.booking.update({
            where: {
              id: finalBooking.id,
              bookingDepositEmailSentAt: null,
            },
            data: {
              bookingDepositEmailSentAt: new Date(),
            },
          });
        } catch (e) {
          // Lock already acquired
        }

        if (bookingToMail) {
          try {
            const vehicleType = finalBooking.vehicle.type;
            if (vehicleType !== 'CAR' && vehicleType !== 'MOTORBIKE') {
              throw new AppError(500, 'Loại phương tiện của lượt đặt chỗ không hợp lệ.');
            }
            if (!finalBooking.expiresAt) {
              throw new AppError(500, 'Lượt đặt chỗ đã thanh toán nhưng chưa có thời hạn giữ chỗ.');
            }
            console.log(`[Reconciliation] Sending reservation confirmation email to ${maskedEmail}`);
            await sendBookingEmail(ownerEmail, ownerName, {
              bookingId: finalBooking.id,
              plateNumber: finalBooking.vehicle.plateNumber,
              vehicleType,
              floorId: finalBooking.floor.id,
              floorCode: finalBooking.floor.floorCode,
              floorName: finalBooking.floor.name,
              parkingArea: 'Khu ô tô',
              expectedArrival: finalBooking.expiresAt,
              depositAmount: 15000,
            });
          } catch (mailErr: unknown) {
            const mailMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
            console.error(`[Reconciliation] Lỗi khi gửi email xác nhận đặt chỗ cho booking ${finalBooking.id}:`, mailMsg);
            try {
              await prisma.booking.update({
                where: { id: finalBooking.id },
                data: { bookingDepositEmailSentAt: null },
              });
            } catch (revertErr) {
              // Ignore
            }
          }
        }
      }
    }

    return { success: true, booking: result.booking };
  },

  async handleStripeWebhook(event: any) {
    const sessionObj = event.data?.object;
    if (!sessionObj) throw new AppError(400, 'Invalid Stripe webhook object format.');

    const metadata = sessionObj.metadata;
    if (!metadata || !metadata.bookingId) {
      throw new AppError(400, 'Missing required bookingId in metadata.');
    }

    const bookingId = metadata.bookingId;
    let paymentIntentId =
      typeof sessionObj.payment_intent === 'string'
        ? sessionObj.payment_intent
        : sessionObj.payment_intent?.id ?? null;

    if (!paymentIntentId) {
      console.warn(`[StripeWebhook] paymentIntentId is unavailable for session ${sessionObj.id}`);
    }

    // Retrieve full session with payment_intent expanded to get timestamp
    let overrideConfirmedAt: Date | undefined;
    try {
      const fullSession = await stripe.checkout.sessions.retrieve(sessionObj.id, {
        expand: ['payment_intent'],
      });
      if (fullSession.payment_intent && typeof fullSession.payment_intent === 'object' && 'created' in fullSession.payment_intent) {
        const piCreated = (fullSession.payment_intent as { created: number }).created;
        if (typeof piCreated === 'number' && piCreated > 0) {
          overrideConfirmedAt = new Date(piCreated * 1000);
          console.log(`[StripeWebhook] Derived payment timestamp from payment_intent.created: ${overrideConfirmedAt.toISOString()}`);
        }
      }
      if (!paymentIntentId && fullSession.payment_intent) {
        paymentIntentId = typeof fullSession.payment_intent === 'string' ? fullSession.payment_intent : fullSession.payment_intent.id;
      }
    } catch (retrieveErr: any) {
      console.warn(`[StripeWebhook] Failed to expand payment_intent for session ${sessionObj.id}:`, retrieveErr.message);
    }

    let attempts = 0;
    const maxAttempts = 3;
    let finalBooking: any = null;

    while (true) {
      attempts++;
      try {
        const result = await this.finalizeBookingPaymentInTransaction(bookingId, paymentIntentId, sessionObj.id, overrideConfirmedAt);
        if (result.success && !result.alreadyProcessed && result.booking) {
          finalBooking = result.booking;
          const ownerEmail = finalBooking.createdBy?.email;
          const ownerName = finalBooking.createdBy?.fullName || 'Quý khách';

          if (ownerEmail) {
            const [local, domain] = ownerEmail.split('@');
            const maskedEmail = local.length > 2 ? `${local[0]}***${local[local.length-1]}@${domain}` : `***@${domain}`;

            let bookingToMail = null;
            try {
              bookingToMail = await prisma.booking.update({
                where: {
                  id: finalBooking.id,
                  bookingDepositEmailSentAt: null,
                },
                data: {
                  bookingDepositEmailSentAt: new Date(),
                },
              });
            } catch (e) {
              // Lock already acquired
            }

            if (bookingToMail) {
              try {
                const vehicleType = finalBooking.vehicle.type;
                if (vehicleType !== 'CAR' && vehicleType !== 'MOTORBIKE') {
                  throw new AppError(500, 'Loại phương tiện của lượt đặt chỗ không hợp lệ.');
                }
                if (!finalBooking.expiresAt) {
                  throw new AppError(500, 'Lượt đặt chỗ đã thanh toán nhưng chưa có thời hạn giữ chỗ.');
                }
                console.log(`[StripeWebhook] Sending reservation confirmation email to ${maskedEmail}`);
                await sendBookingEmail(ownerEmail, ownerName, {
                  bookingId: finalBooking.id,
                  plateNumber: finalBooking.vehicle.plateNumber,
                  vehicleType,
                  floorId: finalBooking.floor.id,
                  floorCode: finalBooking.floor.floorCode,
                  floorName: finalBooking.floor.name,
                  parkingArea: 'Khu ô tô',
                  expectedArrival: finalBooking.expiresAt,
                  depositAmount: 15000,
                });
              } catch (mailErr: unknown) {
                const mailMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
                console.error(`[StripeWebhook] Lỗi khi gửi email xác nhận đặt chỗ cho booking ${finalBooking.id}:`, mailMsg);
                try {
                  await prisma.booking.update({
                    where: { id: finalBooking.id },
                    data: { bookingDepositEmailSentAt: null },
                  });
                } catch (revertErr) {
                  // Ignore
                }
              }
            }
          }
        }

        return result;
      } catch (err: any) {
        if (err.code === 'P2034' && attempts < maxAttempts) {
          await new Promise(res => setTimeout(res, attempts * 100));
          continue;
        }
        if (err.code === 'P2002' && err.meta?.target?.includes('transactionCode')) {
          return { success: true, alreadyProcessed: true };
        }
        throw err;
      }
    }
  },

  async handleStripeExpired(event: any) {
    const session = event.data?.object;
    if (!session) throw new AppError(400, 'Invalid Stripe webhook object format.');

    const metadata = session.metadata;
    if (!metadata || !metadata.bookingId) return { received: true };

    const bookingId = metadata.bookingId;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== 'PENDING_PAYMENT') {
      return { success: true, alreadyProcessed: true };
    }

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED', depositStatus: 'FAILED' },
      }),
      prisma.payment.updateMany({
        where: { bookingId, status: 'PENDING' },
        data: { status: 'FAILED' },
      }),
    ]);

    return { success: true };
  },
};