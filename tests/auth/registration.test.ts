import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { generateTestUser } from '../helpers/test-user';
import { requestApi, registerTestUser } from '../helpers/auth-helper';
import { getStoredOtp } from '../../src/shared/utils/otp.util';
import { cleanupTestUsers } from '../helpers/cleanup';

describe('Authentication: Registration Flow', () => {
  before(async () => {
    await cleanupTestUsers('test_reg_%');
  });

  after(async () => {
    await cleanupTestUsers('test_reg_%');
  });

  test('1. Valid 3-step User Registration succeeds', async () => {
    const user = generateTestUser(101, 'reg');

    // Step 1: Initiate
    const initRes = await requestApi('POST', '/auth/initiate-signup', {
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
    });
    assert.strictEqual(initRes.status, 200, 'Initiate signup should return 200');
    assert.strictEqual(initRes.data.success, true);
    assert.ok(initRes.data.message?.includes('Verification code sent'));

    // Step 2: Verify OTP
    const otp = initRes.data.data?.debugOtp || await getStoredOtp(user.email, 'SIGNUP');
    assert.ok(otp, 'OTP must exist in response or cache');
    assert.strictEqual(otp.length, 4, 'OTP must be 4 digits');

    const verifyRes = await requestApi('POST', '/auth/verify-signup-otp', {
      email: user.email,
      otp,
    });
    assert.strictEqual(verifyRes.status, 200, 'Verify OTP should return 200');
    assert.strictEqual(verifyRes.data.success, true);
    const regToken = verifyRes.data.data?.registrationToken;
    assert.ok(regToken, 'Registration token must be issued');

    // Step 3: Complete signup
    const completeRes = await requestApi('POST', '/auth/complete-signup', {
      registrationToken: regToken,
      firebaseIdToken: user.firebaseToken,
    });
    assert.strictEqual(completeRes.status, 201, 'Complete signup should return 201 Created');
    assert.strictEqual(completeRes.data.success, true);
    assert.ok(completeRes.data.data?.tokens?.accessToken, 'Access token must be returned');
    assert.ok(completeRes.data.data?.tokens?.refreshToken, 'Refresh token must be returned');
    assert.strictEqual(completeRes.data.data?.user?.email, user.email);
    assert.strictEqual(completeRes.data.data?.user?.role, 'user');
    assert.strictEqual(completeRes.data.data?.user?.isVerified, true);
  });

  test('2. Duplicate Email Registration is rejected', async () => {
    const user = generateTestUser(101, 'reg'); // Same email as test 1

    const initRes = await requestApi('POST', '/auth/initiate-signup', {
      email: user.email,
      fullName: 'Duplicate Tester',
    });
    assert.strictEqual(initRes.status, 400, 'Should return 400 Bad Request');
    assert.strictEqual(initRes.data.success, false);
    assert.ok(initRes.data.error?.message?.includes('already exists'));
  });

  test('3. Invalid Email Format is rejected with validation error', async () => {
    const initRes = await requestApi('POST', '/auth/initiate-signup', {
      email: 'not-an-email',
      fullName: 'Bad Email User',
    });
    assert.strictEqual(initRes.status, 400, 'Should return 400');
    assert.strictEqual(initRes.data.success, false);
    assert.strictEqual(initRes.data.error?.code, 'VALIDATION_FAILED');
  });

  test('4. Missing required fullName is rejected', async () => {
    const initRes = await requestApi('POST', '/auth/initiate-signup', {
      email: 'noname@knotnex.test',
    });
    assert.strictEqual(initRes.status, 400);
    assert.strictEqual(initRes.data.success, false);
    assert.strictEqual(initRes.data.error?.code, 'VALIDATION_FAILED');
  });

  test('5. Invalid Phone Number format (non-E.164) is rejected', async () => {
    const initRes = await requestApi('POST', '/auth/initiate-signup', {
      email: 'invalidphone@knotnex.test',
      fullName: 'Phone Tester',
      phone: '12345', // Missing country code and invalid length
    });
    assert.strictEqual(initRes.status, 400);
    assert.strictEqual(initRes.data.error?.code, 'VALIDATION_FAILED');
  });

  test('6. Wrong OTP is rejected', async () => {
    const user = generateTestUser(102, 'reg');

    await requestApi('POST', '/auth/initiate-signup', {
      email: user.email,
      fullName: user.fullName,
    });

    const verifyRes = await requestApi('POST', '/auth/verify-signup-otp', {
      email: user.email,
      otp: '0000', // incorrect OTP
    });
    assert.strictEqual(verifyRes.status, 400);
    assert.strictEqual(verifyRes.data.success, false);
    assert.ok(verifyRes.data.error?.message?.includes('Invalid OTP'));
  });

  test('7. Complete Signup with expired or forged registration token fails', async () => {
    const user = generateTestUser(103, 'reg');

    const completeRes = await requestApi('POST', '/auth/complete-signup', {
      registrationToken: 'forged.fake.jwt.token',
      firebaseIdToken: user.firebaseToken,
    });
    assert.strictEqual(completeRes.status, 400);
    assert.strictEqual(completeRes.data.success, false);
    assert.ok(completeRes.data.error?.message?.includes('expired') || completeRes.data.error?.message?.includes('session'));
  });

  test('8. Complete Signup with email mismatch fails', async () => {
    const userA = generateTestUser(104, 'reg');
    const userB = generateTestUser(105, 'reg');

    // Initiate userA
    const initResA = await requestApi('POST', '/auth/initiate-signup', {
      email: userA.email,
      fullName: userA.fullName,
    });
    const otp = initResA.data.data?.debugOtp || await getStoredOtp(userA.email, 'SIGNUP');
    const verifyRes = await requestApi('POST', '/auth/verify-signup-otp', {
      email: userA.email,
      otp: otp!,
    });
    const regTokenUserA = verifyRes.data.data?.registrationToken;

    // Try to complete using userB's firebase token with userA's registrationToken
    const completeRes = await requestApi('POST', '/auth/complete-signup', {
      registrationToken: regTokenUserA,
      firebaseIdToken: userB.firebaseToken, // Different email!
    });
    assert.strictEqual(completeRes.status, 400);
    assert.strictEqual(completeRes.data.success, false);
    assert.ok(completeRes.data.error?.message?.includes('mismatch'));
  });
});
