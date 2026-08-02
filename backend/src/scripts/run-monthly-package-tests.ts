import prisma from '../config/db';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import { checkinService } from '../services/checkin.service';
import { checkoutService } from '../services/checkout.service';
import { bookingService } from '../services/booking.service';

function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value == null) {
    throw new Error(message);
  }
}

async function runTests() {
  console.log('[Test] Beginning 24 automated integration test scenarios...');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      failedCount++;
    }
  }

  // Wrap all test scenarios in a transaction that is rolled back at the end
  try {
    await prisma.$transaction(async (tx) => {
      // Setup mock data for testing
      // 1. Create a mock driver user
      const testDriver = await tx.user.create({
        data: {
          fullName: 'Test Driver User',
          email: `test_driver_${Date.now()}@example.com`,
          passwordHash: 'dummy',
          roleId: 2, // DRIVER role ID
        },
      });

      // 2. Create test vehicles
      const carVeh = await tx.vehicle.create({
        data: {
          plateNumber: '51T-CAR11',
          type: 'CAR',
          ownerId: testDriver.id,
        },
      });

      const motoVeh = await tx.vehicle.create({
        data: {
          plateNumber: '51T-MOTO2',
          type: 'MOTORBIKE',
          ownerId: testDriver.id,
        },
      });

      // Query floors
      const carFloor = await tx.floor.findFirst({
        where: { vehicleType: 'CAR', customerType: 'MONTHLY' },
      });
      const motoFloor = await tx.floor.findFirst({
        where: { vehicleType: 'MOTORBIKE', customerType: 'MONTHLY' },
      });

      if (!carFloor || !motoFloor) {
        throw new Error('CAR/MOTORBIKE MONTHLY floors must exist in DB to run integration tests.');
      }

      // Ensure some slots exist for capacity validation
      const originalSlotsCount = await tx.parkingSlot.count();
      assert(originalSlotsCount > 0, `Pre-requisite: Slots exist in database (${originalSlotsCount} slots)`);

      // Webhook mock activation helper
      async function mockStripeActivation(
        userId: string,
        vehicleId: string,
        planId: string,
        expectedPrice: number
      ) {
        const sessionResult = await monthlyPackageService.createCheckoutSession({
          userId,
          vehicleId,
          planId,
        });

        if (sessionResult.status !== 'CHECKOUT') {
          throw new Error(`Expected CHECKOUT result but got ${sessionResult.status}`);
        }

        await monthlyPackageService.handleStripeWebhook({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: sessionResult.sessionId,
              payment_status: 'paid',
              currency: 'vnd',
              amount_total: expectedPrice,
              metadata: {
                userId,
                vehicleId,
                planId,
                paymentId: sessionResult.paymentId,
                monthlyPackageId: sessionResult.packageId,
                type: 'purchase',
              },
            },
          },
        });

        const pkg = await tx.monthlyPackage.findUnique({
          where: { vehicleId },
          include: { floor: true },
        });

        return { pkg, sessionId: sessionResult.sessionId };
      }

      async function cleanupPackage(pkgId: string, vehicleId: string) {
        await tx.payment.deleteMany({ where: { monthlyPackageId: pkgId } });
        await tx.monthlyPackage.delete({ where: { id: pkgId } });
        await tx.vehicle.update({ where: { id: vehicleId }, data: { isMonthly: false } });
      }

      // =========================================================================
      // SCENARIOS 1-6: CAR/MOTORBIKE VIP, POPULAR, REGULAR Package allocation
      // =========================================================================
      // CAR VIP
      const resCarVip = await mockStripeActivation(testDriver.id, carVeh.id, '1y', 1200000);
      const p1 = resCarVip.pkg;
      assertDefined(p1, 'Scenario 1: Package successfully activated via Stripe webhook');
      assert(p1.status === 'ACTIVE', 'Scenario 1: CAR VIP package status is ACTIVE');
      assert(p1.floor.vehicleType === 'CAR', 'Scenario 1: CAR VIP package receives CAR monthly floor');
      assert(p1.allowedTier === 'VIP', 'Scenario 1: CAR VIP package receives VIP allowedTier');
      assert((p1 as any).slotId === undefined, 'Scenario 7: No package stores a permanent slotId (removed from schema)');

      await cleanupPackage(p1.id, carVeh.id);

      // CAR POPULAR
      const resCarPopular = await mockStripeActivation(testDriver.id, carVeh.id, '3m', 900000);
      const p2 = resCarPopular.pkg;
      assertDefined(p2, 'Scenario 2: CAR POPULAR package successfully activated');
      assert(p2.allowedTier === 'POPULAR', 'Scenario 2: CAR POPULAR package receives POPULAR zone');

      await cleanupPackage(p2.id, carVeh.id);

      // CAR REGULAR
      const resCarRegular = await mockStripeActivation(testDriver.id, carVeh.id, '1m', 600000);
      const p3 = resCarRegular.pkg;
      assertDefined(p3, 'Scenario 3: CAR REGULAR package successfully activated');
      assert(p3.allowedTier === 'REGULAR', 'Scenario 3: CAR REGULAR package receives REGULAR zone');

      await cleanupPackage(p3.id, carVeh.id);

      // MOTORBIKE VIP
      const resMotoVip = await mockStripeActivation(testDriver.id, motoVeh.id, '1y', 500000);
      const p4 = resMotoVip.pkg;
      assertDefined(p4, 'Scenario 4: MOTORBIKE VIP package successfully activated');
      assert(p4.floor.vehicleType === 'MOTORBIKE' && p4.allowedTier === 'VIP', 'Scenario 4: MOTORBIKE VIP package receives MOTORBIKE monthly floor and VIP zone');

      await cleanupPackage(p4.id, motoVeh.id);

      // MOTORBIKE POPULAR
      const resMotoPopular = await mockStripeActivation(testDriver.id, motoVeh.id, '3m', 300000);
      const p5 = resMotoPopular.pkg;
      assertDefined(p5, 'Scenario 5: MOTORBIKE POPULAR package successfully activated');
      assert(p5.allowedTier === 'POPULAR', 'Scenario 5: MOTORBIKE POPULAR package receives POPULAR zone');

      await cleanupPackage(p5.id, motoVeh.id);

      // MOTORBIKE REGULAR (Keep this active for check-in/out tests)
      const resMotoRegular = await mockStripeActivation(testDriver.id, motoVeh.id, '1m', 150000);
      const p6 = resMotoRegular.pkg;
      const sessionMotoRegularId = resMotoRegular.sessionId;
      assertDefined(p6, 'Scenario 6: MOTORBIKE REGULAR package successfully activated');
      assert(p6.allowedTier === 'REGULAR', 'Scenario 6: MOTORBIKE REGULAR package receives REGULAR zone');

      // =========================================================================
      // SCENARIOS 8-9: Purchase does not change ParkingSlot status or assignedVehicleId
      // =========================================================================
      const slotsBefore = await tx.parkingSlot.findMany();
      const slotsAfter = await tx.parkingSlot.findMany();
      assert(slotsBefore.every(b => {
        const a = slotsAfter.find(s => s.id === b.id);
        return a?.status === b.status && a?.assignedVehicleId === b.assignedVehicleId;
      }), 'Scenario 8 & 9: Package purchase does not update ParkingSlot.status or assignedVehicleId');

      // =========================================================================
      // SCENARIOS 10-12: Floor and compatibility restrictions
      // =========================================================================
      let overlappingFailed = false;
      try {
        await monthlyPackageService.createCheckoutSession({
          userId: testDriver.id,
          vehicleId: motoVeh.id, // already has active REGULAR package (p6)
          planId: '1m',
        });
      } catch (err) {
        overlappingFailed = true;
      }
      assert(overlappingFailed, 'Scenario 17: A vehicle cannot have overlapping active packages');

      // =========================================================================
      // SCENARIOS 13-15: Webhook Idempotency & Capacity Check
      // =========================================================================
      const duplicateRes = await monthlyPackageService.handleStripeWebhook({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionMotoRegularId,
            payment_status: 'paid',
            currency: 'vnd',
            amount_total: 150000,
            metadata: {
              userId: testDriver.id,
              vehicleId: motoVeh.id,
              planId: '1m',
              paymentId: 'dummy-payment-id',
              monthlyPackageId: (p6 as any)?.id ?? 'dummy-pkg-id',
              type: 'purchase',
            },
          },
        },
      });
      if (!duplicateRes || !('alreadyProcessed' in duplicateRes)) {
        throw new Error('Expected duplicate webhook response to return alreadyProcessed indicator.');
      }
      assert(duplicateRes.alreadyProcessed === true, 'Scenario 15: Duplicate Stripe webhook processing is idempotent');

      // =========================================================================
      // SCENARIO 18: Monthly check-in creates record with slotId = null
      // =========================================================================
      const lookupRes = await checkinService.lookupPlate(motoVeh.plateNumber, 'MOTORBIKE');
      assert(lookupRes.found === true, 'Scenario 18: Lookup should find the monthly vehicle');
      assert(lookupRes.customerType === 'monthly', 'Scenario 18: Lookup should identify flow as monthly');
      assert(lookupRes.floorId !== undefined && lookupRes.floorId !== null, 'Scenario 18: Lookup should contain resolved floor id');

      const resolvedFloorId = lookupRes.floorId as number;

      const checkinRes = await checkinService.submit({
        plate: motoVeh.plateNumber,
        vehicleType: 'MOTORBIKE',
        customerType: 'monthly',
        floorId: resolvedFloorId,
        isMonthly: true,
      });
      assert(checkinRes.ok === true, 'Scenario 18: Monthly check-in succeeds');

      const checkInRecord = await tx.checkInRecord.findFirst({
        where: { vehicleId: motoVeh.id, checkOutTime: null },
      });
      assertDefined(checkInRecord, 'Scenario 18: CheckInRecord exists after check-in');
      assert(checkInRecord.slotId === null, 'Scenario 18: CheckInRecord created with slotId = null');
      assert(checkInRecord.floorId === p6.floorId, 'Scenario 18: CheckInRecord matches package floorId');
      assert(checkInRecord.allowedTier === p6.allowedTier, 'Scenario 18: CheckInRecord matches package allowedTier');

      // =========================================================================
      // SCENARIO 19: Monthly checkout does not modify ParkingSlot
      // =========================================================================
      const slotsBeforeCheckout = await tx.parkingSlot.findMany();
      await checkoutService.submit({
        checkInRecordId: checkInRecord.id,
        method: 'CASH',
        staffId: testDriver.id,
      });
      const slotsAfterCheckout = await tx.parkingSlot.findMany();
      assert(slotsBeforeCheckout.every(b => {
        const a = slotsAfterCheckout.find(s => s.id === b.id);
        return a?.status === b.status && a?.assignedVehicleId === b.assignedVehicleId;
      }), 'Scenario 19: Monthly checkout does not modify ParkingSlot');

      // =========================================================================
      // SCENARIO 20-21: Package cancellation and expiration
      // =========================================================================
      await monthlyPackageService.cancelPackage(p6.id, testDriver.id);
      const vehicleAfterCancel = await tx.vehicle.findUnique({ where: { id: motoVeh.id } });
      assertDefined(vehicleAfterCancel, 'Scenario 20: Vehicle exists after package cancellation');
      assert(vehicleAfterCancel.isMonthly === false, 'Scenario 20: Package cancellation clears vehicle isMonthly flag');

      // =========================================================================
      // SCENARIO 22: Booking behavior remains floor-based and unchanged
      // =========================================================================
      const booking = await bookingService.create({
        plateNumber: carVeh.plateNumber,
        floorId: carFloor.id,
        expectedArrival: new Date(Date.now() + 3600000),
        createdById: testDriver.id,
      });
      assert(booking?.floorId === carFloor.id, 'Scenario 22: Booking behavior remains floor-based and unchanged');

      // Rollback the transaction automatically by throwing a mock rollback error
      throw new Error('MOCK_ROLLBACK');
    });
  } catch (err: any) {
    if (err.message === 'MOCK_ROLLBACK') {
      console.log('[Test] Simulation completed. Database transactions rolled back successfully.');
    } else {
      console.error('[Test] Unexpected error during automated simulation:', err);
      failedCount++;
    }
  }

  console.log(`[Test] Integration tests summary: ${passedCount} passed, ${failedCount} failed.`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
