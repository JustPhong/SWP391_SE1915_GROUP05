import prisma from '../src/config/db';
import { checkoutService } from '../src/services/checkout.service';
import { AppError } from '../src/utils/helpers';

async function run() {
  console.log('--- Starting Unified PIN Service Verification ---');

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create a dummy user/owner
      const owner = await tx.user.create({
        data: {
          fullName: 'Test Owner',
          email: 'testowner@example.com',
          password: 'hashedpassword',
          role: 'CUSTOMER',
        },
      });

      // 2. Create a dummy vehicle
      const vehicle = await tx.vehicle.create({
        data: {
          plateNumber: '99A-99999',
          type: 'CAR',
          brand: 'Toyota',
          model: 'Vios',
          color: 'Black',
          year: 2022,
          seats: 5,
          ownerId: owner.id,
          isMonthly: false,
        },
      });

      // 3. Create a dummy floor and slot
      const floor = await tx.floor.create({
        data: {
          name: 'Floor Verification',
          floorCode: 'FV',
          capacity: 10,
          customerType: 'CASUAL',
          vehicleType: 'CAR',
          userId: owner.id,
        },
      });

      const slot = await tx.parkingSlot.create({
        data: {
          code: 'FV-01',
          floorId: floor.id,
          type: 'CAR',
          status: 'OCCUPIED',
        },
      });

      // 4. Create active guest record
      const guestRecord = await tx.checkInRecord.create({
        data: {
          vehicleId: vehicle.id,
          slotId: slot.id,
          floorId: floor.id,
          checkInTime: new Date(),
          isMonthly: false,
          status: 'PARKING',
        },
      });

      const guestCred = await tx.guestAccessCredential.create({
        data: {
          checkInRecordId: guestRecord.id,
          pin: '888888',
          qrToken: 'testqrtoken1234567890testqrtoken1234567890testqrtoken123456789012',
          active: true,
        },
      });

      console.log('✅ Guest record and credential created');

      // Test 1: Valid active guest PIN resolves
      const res1 = await checkoutService.lookupByPin('888888');
      if (res1.found && res1.credentialType === 'GUEST_PIN' && res1.recordId === guestRecord.id) {
        console.log('PASS: Test 1 - Valid active guest PIN resolves correctly');
      } else {
        throw new Error('FAIL: Test 1');
      }

      // Test 2: Invalid PIN returns 404
      try {
        await checkoutService.lookupByPin('000000');
        throw new Error('FAIL: Test 2 (did not throw)');
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 404) {
          console.log('PASS: Test 2 - Invalid PIN throws 404');
        } else {
          throw err;
        }
      }

      // Test 3: Revoked guest credential is rejected
      await tx.guestAccessCredential.update({
        where: { id: guestCred.id },
        data: { active: false },
      });
      try {
        await checkoutService.lookupByPin('888888');
        throw new Error('FAIL: Test 3 (did not throw)');
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 404) {
          console.log('PASS: Test 3 - Revoked guest PIN throws 404');
        } else {
          throw err;
        }
      }

      // 5. Create active monthly record and package
      const monthlyVehicle = await tx.vehicle.create({
        data: {
          plateNumber: '99A-88888',
          type: 'CAR',
          brand: 'Honda',
          model: 'Civic',
          color: 'White',
          year: 2021,
          seats: 5,
          ownerId: owner.id,
          isMonthly: true,
        },
      });

      const monthlyRecord = await tx.checkInRecord.create({
        data: {
          vehicleId: monthlyVehicle.id,
          slotId: slot.id,
          floorId: floor.id,
          checkInTime: new Date(),
          isMonthly: true,
          status: 'PARKING',
        },
      });

      const activePkg = await tx.monthlyPackage.create({
        data: {
          vehicleId: monthlyVehicle.id,
          userId: owner.id,
          floorId: floor.id,
          allowedTier: 'POPULAR',
          status: 'ACTIVE',
          expiryDate: new Date(Date.now() + 86400000), // tomorrow
          monthlyAccessPin: '777777',
        },
      });

      console.log('✅ Monthly record and package created');

      // Test 4: Valid active monthly PIN resolves
      const res4 = await checkoutService.lookupByPin('777777');
      if (res4.found && res4.credentialType === 'MONTHLY_PIN' && res4.recordId === monthlyRecord.id && res4.fee === 0) {
        console.log('PASS: Test 4 - Valid active monthly PIN resolves correctly with zero fee');
      } else {
        throw new Error('FAIL: Test 4');
      }

      // Test 5: Expired monthly package is rejected
      await tx.monthlyPackage.update({
        where: { id: activePkg.id },
        data: { expiryDate: new Date(Date.now() - 86400000) }, // yesterday
      });
      try {
        await checkoutService.lookupByPin('777777');
        throw new Error('FAIL: Test 5 (did not throw)');
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 404) {
          console.log('PASS: Test 5 - Expired monthly package PIN throws 404');
        } else {
          throw err;
        }
      }

      // Reset package to ACTIVE/valid
      await tx.monthlyPackage.update({
        where: { id: activePkg.id },
        data: { expiryDate: new Date(Date.now() + 86400000) },
      });

      // Test 6: Checked-out record is rejected
      await tx.checkInRecord.update({
        where: { id: monthlyRecord.id },
        data: { checkOutTime: new Date(), status: 'COMPLETED' },
      });
      try {
        await checkoutService.lookupByPin('777777');
        throw new Error('FAIL: Test 6 (did not throw)');
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 404) {
          console.log('PASS: Test 6 - Checked-out monthly PIN throws 404');
        } else {
          throw err;
        }
      }

      // Reset record to parking
      await tx.checkInRecord.update({
        where: { id: monthlyRecord.id },
        data: { checkOutTime: null, status: 'PARKING' },
      });

      // Test 7: Ambiguity check (duplicate PIN matches return 409)
      await tx.guestAccessCredential.update({
        where: { id: guestCred.id },
        data: { pin: '777777', active: true },
      });

      try {
        await checkoutService.lookupByPin('777777');
        throw new Error('FAIL: Test 7 (did not throw)');
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 409) {
          console.log('PASS: Test 7 - Duplicate active PIN matches throw 409 conflict');
        } else {
          throw err;
        }
      }

      throw new Error('ROLLBACK_INTENDED');
    });
  } catch (err: any) {
    if (err.message === 'ROLLBACK_INTENDED') {
      console.log('✅ Verification transaction rolled back successfully');
    } else {
      console.error('FAIL: Verification error:', err);
      process.exit(1);
    }
  }

  console.log('--- All Unified PIN Service Verifications Passed Successfully ---');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
