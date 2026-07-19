import { createAuthService } from '../services/auth.service';
import { AppError } from '../utils/helpers';

// Ensure the test is run in test mode and cannot be executed accidentally in production
if (process.env.NODE_ENV !== 'test') {
  console.error('CRITICAL ERROR: Tests must only be executed with NODE_ENV=test');
  process.exit(1);
}

const originalDateNow = Date.now;
const originalSetTimeout = global.setTimeout;

let passed = true;

const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    passed = false;
  }
};

// Stub global setTimeout to automatically call .unref() on timer creation
(global as any).setTimeout = (cb: any, ms: number, ...args: any[]) => {
  const timer = originalSetTimeout(cb, ms, ...args);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
  return timer;
};

async function runTests() {
  console.log('=== Starting Isolated Dependency-Injected OTP Unit Tests ===');

  let mockTime = originalDateNow();
  Date.now = () => mockTime;

  // Delegating mock database implementation
  let findUniqueUserImpl = async (email: string): Promise<any> => null;
  let findUniqueVehicleImpl = async (plateNumber: string): Promise<any> => null;
  let findUniqueRoleImpl = async (name: string): Promise<any> => ({ id: 'mock-role-id', name });
  let updateUserImpl = async (id: string, data: any): Promise<any> => ({} as any);
  
  let transactionImpl = async (fn: any) => {
    const mockTx = {
      user: {
        create: async (args: any) => ({
          id: 'mock-user-id',
          fullName: args.data.fullName,
          email: args.data.email,
          phoneNumber: args.data.phoneNumber,
          passwordHash: args.data.passwordHash,
          roleId: args.data.roleId,
        })
      },
      vehicle: {
        create: async (args: any) => ({
          id: 'mock-vehicle-id',
          plateNumber: args.data.plateNumber,
          type: args.data.type,
          ownerId: args.data.ownerId,
        })
      }
    };
    return fn(mockTx);
  };

  const mockPrisma: any = {
    user: {
      findUnique: (args: any) => findUniqueUserImpl(args.where.email),
      update: (args: any) => updateUserImpl(args.where.id, args.data),
    },
    vehicle: {
      findUnique: (args: any) => findUniqueVehicleImpl(args.where.plateNumber),
    },
    role: {
      findUnique: (args: any) => findUniqueRoleImpl(args.where.name),
    },
    $transaction: (fn: any) => transactionImpl(fn),
  };

  // Delegating mock SMTP implementation
  let lastCapturedPurpose: string | null = null;
  let capturedOtp: string | null = null;
  let sendImplementation = async (to: string, otp: string, fullName: string, purpose: string) => {
    capturedOtp = otp;
    lastCapturedPurpose = purpose;
    return { messageId: 'mock-msg-id', accepted: [to], rejected: [] };
  };

  const injectedSendOtpEmail = (...args: any[]) =>
    sendImplementation(args[0], args[1], args[2], args[3]);

  // Construct stable, single test service instance
  const service = createAuthService({
    prisma: mockPrisma,
    sendOtpEmail: injectedSendOtpEmail,
  });

  try {
    // ----------------------------------------------------
    // Test Case 1: Normal registration OTP send and validation
    // ----------------------------------------------------
    try {
      const testEmail = 'test_success@example.com';
      const testName = 'Test User';

      sendImplementation = async (to, otp, fullName, purpose) => {
        capturedOtp = otp;
        lastCapturedPurpose = purpose;
        return { messageId: 'mock-msg-id-1', accepted: [to], rejected: [] };
      };

      await service.sendOtp({ email: testEmail, fullName: testName });
      assert(capturedOtp !== null, 'OTP code should be generated and captured by the stub');
      assert(lastCapturedPurpose === 'REGISTER', 'Registration OTP uses REGISTER purpose');

      // Successful registration
      const regResult = await service.register({
        fullName: testName,
        email: testEmail,
        password: 'password123',
        plateNumber: '29A-12345',
        vehicleType: 'CAR',
        otp: capturedOtp!
      });
      assert(regResult.user.email === testEmail, 'User registers successfully');

      // Registration should fail if calling again with same OTP (proving consumption)
      let reRegError: any = null;
      try {
        await service.register({
          fullName: testName,
          email: testEmail,
          password: 'password123',
          plateNumber: '29A-12345',
          vehicleType: 'CAR',
          otp: capturedOtp!
        });
      } catch (err: any) {
        reRegError = err;
      }
      assert(reRegError instanceof AppError, 'Re-registration fails (OTP consumed)');
    } catch (err: any) {
      assert(false, `Test Case 1 failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // Test Case 2: Cooldown check
    // ----------------------------------------------------
    try {
      const testEmail = 'test_cooldown@example.com';
      const testName = 'Test User Cooldown';

      sendImplementation = async (to, otp, fullName, purpose) => {
        return { messageId: 'mock-msg-id-2', accepted: [to], rejected: [] };
      };

      await service.sendOtp({ email: testEmail, fullName: testName });

      // Second send immediately should throw 429
      let secondSendError: any = null;
      try {
        await service.sendOtp({ email: testEmail, fullName: testName });
      } catch (err: any) {
        secondSendError = err;
      }
      assert(secondSendError instanceof AppError && secondSendError.statusCode === 429, 'Immediate second send throws 429 due to cooldown');

      // Advance time by 70 seconds
      mockTime += 70000;

      // Third send succeeds
      await service.sendOtp({ email: testEmail, fullName: testName });
    } catch (err: any) {
      assert(false, `Test Case 2 failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // Test Case 3: Option A - failed resend preserves old OTP
    // ----------------------------------------------------
    try {
      const testEmail = 'test_resend_preserve@example.com';
      const testName = 'Test User Preserve';
      let code1: string | null = null;

      sendImplementation = async (to, otp, fullName, purpose) => {
        code1 = otp;
        return { messageId: 'mock-msg-ok-3', accepted: [to], rejected: [] };
      };

      await service.sendOtp({ email: testEmail, fullName: testName });

      // Advance time by 70s to bypass cooldown
      mockTime += 70000;

      // Second send fails
      sendImplementation = async () => {
        throw new Error('SMTP server rejected recipient');
      };

      let resendError: any = null;
      try {
        await service.sendOtp({ email: testEmail, fullName: testName });
      } catch (err: any) {
        resendError = err;
      }
      assert(resendError instanceof AppError && resendError.statusCode === 502, 'Failed resend throws AppError 502');

      // Verify first code is still valid for registration
      const regResult = await service.register({
        fullName: testName,
        email: testEmail,
        password: 'password123',
        plateNumber: '29A-12345',
        vehicleType: 'CAR',
        otp: code1!
      });
      assert(regResult.user.email === testEmail, 'First OTP code remains valid if the resend fails');
    } catch (err: any) {
      assert(false, `Test Case 3 failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // Test Case 4: Incorrect attempts limit (capped at 5)
    // ----------------------------------------------------
    try {
      const testEmail = 'test_attempts@example.com';
      const testName = 'Test User Attempts';
      let code: string | null = null;

      sendImplementation = async (to, otp, fullName, purpose) => {
        code = otp;
        return { messageId: 'mock-msg-ok-attempts', accepted: [to], rejected: [] };
      };
      await service.sendOtp({ email: testEmail, fullName: testName });

      // Try incorrect OTP 4 times
      for (let i = 1; i <= 4; i++) {
        let checkError: any = null;
        try {
          await service.register({
            fullName: testName,
            email: testEmail,
            password: 'password123',
            plateNumber: '29A-12345',
            vehicleType: 'CAR',
            otp: 'wrong'
          });
        } catch (err: any) {
          checkError = err;
        }
        assert(checkError instanceof AppError && checkError.message.includes(`Bạn còn ${5 - i} lần thử`), `Incorrect attempt #${i} notifies remaining attempts: ${5 - i}`);
      }

      // 5th incorrect attempt locks/deletes OTP
      let fifthError: any = null;
      try {
        await service.register({
          fullName: testName,
          email: testEmail,
          password: 'password123',
          plateNumber: '29A-12345',
          vehicleType: 'CAR',
          otp: 'wrong'
        });
      } catch (err: any) {
        fifthError = err;
      }
      assert(fifthError instanceof AppError && fifthError.message.includes('đã nhập sai mã OTP quá 5 lần'), '5th incorrect attempt locks/deletes OTP');

      // Correct OTP fails because it was deleted
      let correctError: any = null;
      try {
        await service.register({
          fullName: testName,
          email: testEmail,
          password: 'password123',
          plateNumber: '29A-12345',
          vehicleType: 'CAR',
          otp: code!
        });
      } catch (err: any) {
        correctError = err;
      }
      assert(correctError instanceof AppError && correctError.message.includes('Mã xác nhận không tồn tại hoặc đã hết hạn'), 'Correct OTP now fails because store was cleared');
    } catch (err: any) {
      assert(false, `Test Case 4 failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // Test Case 5: Transaction consumption order
    // ----------------------------------------------------
    try {
      const testEmail = 'test_db_fail@example.com';
      const testName = 'Test User DB Fail';
      let code: string | null = null;

      sendImplementation = async (to, otp, fullName, purpose) => {
        code = otp;
        return { messageId: 'mock-msg-ok-db', accepted: [to], rejected: [] };
      };
      await service.sendOtp({ email: testEmail, fullName: testName });

      // Set transaction callback to fail
      transactionImpl = async () => {
        throw new Error('Database transaction error');
      };

      let regError: any = null;
      try {
        await service.register({
          fullName: testName,
          email: testEmail,
          password: 'password123',
          plateNumber: '29A-12345',
          vehicleType: 'CAR',
          otp: code!
        });
      } catch (err: any) {
        regError = err;
      }
      assert(regError instanceof AppError && regError.statusCode === 500, 'Failed DB transaction throws AppError 500');

      // Restore transaction success callback
      transactionImpl = async (fn: any) => {
        const mockTx = {
          user: { create: async () => ({ id: 'mock-id-ok', fullName: testName, email: testEmail, phoneNumber: null, passwordHash: 'hash', roleId: 'role' }) },
          vehicle: { create: async () => ({}) }
        };
        return fn(mockTx);
      };

      // Registration succeeds because the OTP was not consumed when transaction failed
      const successResult = await service.register({
        fullName: testName,
        email: testEmail,
        password: 'password123',
        plateNumber: '29A-12345',
        vehicleType: 'CAR',
        otp: code!
      });
      assert(successResult.user.email === testEmail, 'OTP remains valid and registers successfully after temporary database failure');
    } catch (err: any) {
      assert(false, `Test Case 5 failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // Test Case 6: True concurrent-send lock blockage
    // ----------------------------------------------------
    try {
      const testEmail = 'test_concurrent@example.com';
      const testName = 'Test User Concurrent';

      let resolveSend: any;
      const deferredPromise = new Promise<any>((resolve) => {
        resolveSend = resolve;
      });

      sendImplementation = async (to, otp, fullName, purpose) => {
        await deferredPromise;
        return { messageId: 'mock-msg-id-6', accepted: [to], rejected: [] };
      };

      const firstSendPromise = service.sendOtp({ email: testEmail, fullName: testName });

      // Immediate concurrent send fails
      let concurrentError: any = null;
      try {
        await service.sendOtp({ email: testEmail, fullName: testName });
      } catch (err: any) {
        concurrentError = err;
      }
      assert(concurrentError instanceof AppError && concurrentError.message.includes('đang được xử lý'), 'Concurrent send triggers send lock error');

      // Resolve the first send
      resolveSend();
      await firstSendPromise;

      // Clean up lock and verify calling send again throws cooldown instead of send lock
      let cooldownError: any = null;
      try {
        await service.sendOtp({ email: testEmail, fullName: testName });
      } catch (err: any) {
        cooldownError = err;
      }
      assert(cooldownError instanceof AppError && cooldownError.message.includes('gửi lại mã'), 'After send resolves, the send lock is released (cooldown error is thrown instead)');
    } catch (err: any) {
      assert(false, `Test Case 6 failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // Test Case 7: Forgot-password OTP coverage
    // ----------------------------------------------------
    try {
      const resetEmail = 'reset@example.com';
      let code: string | null = null;

      findUniqueUserImpl = async (email: string) => {
        if (email === resetEmail) {
          return { id: 'user-reset-id', fullName: 'Reset User', email: resetEmail };
        }
        return null;
      };

      // 1. SMTP Failure throws 502
      sendImplementation = async () => {
        throw new Error('SMTP connection failure');
      };
      let smtpErr: any = null;
      try {
        await service.forgotPasswordSendOtp({ email: resetEmail });
      } catch (err: any) {
        smtpErr = err;
      }
      assert(smtpErr instanceof AppError && smtpErr.statusCode === 502, 'SMTP failure on forgot-password throws AppError 502');

      // 2. Successful send captures OTP and purpose
      sendImplementation = async (to, otp, fullName, purpose) => {
        code = otp;
        lastCapturedPurpose = purpose;
        return { messageId: 'msg-reset-ok', accepted: [to], rejected: [] };
      };
      await service.forgotPasswordSendOtp({ email: resetEmail });
      assert(code !== null, 'Reset OTP captured');
      assert(lastCapturedPurpose === 'RESET_PASSWORD', 'Forgot-password OTP uses RESET_PASSWORD purpose');

      // 3. Incorrect attempts limit (5 wrong attempts)
      for (let i = 1; i <= 4; i++) {
        let resetErr: any = null;
        try {
          await service.resetPassword({ email: resetEmail, otp: 'wrong', newPassword: 'newPassword123' });
        } catch (err: any) {
          resetErr = err;
        }
        assert(resetErr instanceof AppError && resetErr.message.includes(`Bạn còn ${5 - i} lần thử`), `Reset attempt #${i} notifies remaining attempts: ${5 - i}`);
      }

      let fifthResetErr: any = null;
      try {
        await service.resetPassword({ email: resetEmail, otp: 'wrong', newPassword: 'newPassword123' });
      } catch (err: any) {
        fifthResetErr = err;
      }
      assert(fifthResetErr instanceof AppError && fifthResetErr.message.includes('đã nhập sai mã OTP quá 5 lần'), '5th reset attempt deletes the reset OTP');

      // Correct code fails because it was deleted
      let correctResetErr: any = null;
      try {
        await service.resetPassword({ email: resetEmail, otp: code!, newPassword: 'newPassword123' });
      } catch (err: any) {
        correctResetErr = err;
      }
      assert(correctResetErr instanceof AppError && correctResetErr.message.includes('Mã xác nhận không tồn tại hoặc đã hết hạn'), 'Correct reset OTP fails after 5 unsuccessful attempts');

      // 4. Reset OTP preservation on failed password update
      // Re-send reset OTP
      await service.forgotPasswordSendOtp({ email: resetEmail });
      assert(code !== null, 'Reset OTP captured successfully');

      // Make update fail
      updateUserImpl = async () => {
        throw new Error('Database connection lost');
      };

      let dbUpdateErr: any = null;
      try {
        await service.resetPassword({ email: resetEmail, otp: code!, newPassword: 'newPassword123' });
      } catch (err: any) {
        dbUpdateErr = err;
      }
      assert(dbUpdateErr instanceof Error && dbUpdateErr.message === 'Database connection lost', 'Failed database update throws error');

      // Restore update success
      updateUserImpl = async () => ({} as any);

      // Verify OTP remains valid and consumes successfully
      let successResetErr: any = null;
      try {
        await service.resetPassword({ email: resetEmail, otp: code!, newPassword: 'newPassword123' });
      } catch (err: any) {
        successResetErr = err;
      }
      assert(successResetErr === null, 'Reset password succeeds (OTP remains valid after temporary database update failure)');

    } catch (err: any) {
      assert(false, `Test Case 7 failed: ${err.message}`);
    }

  } finally {
    // Restore original timers and Date functions
    global.setTimeout = originalSetTimeout;
    Date.now = originalDateNow;
  }

  console.log(passed ? '\n🎉 ALL OTP FLOW UNIT TESTS PASSED SUCCESSFULLY! 🎉' : '\n❌ SOME OTP FLOW TESTS FAILED! ❌');
  process.exitCode = passed ? 0 : 1;
}

runTests();
