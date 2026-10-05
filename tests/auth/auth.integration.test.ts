import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { generateTestUser } from '../helpers/test-user';
import { requestApi, registerTestUser } from '../helpers/auth-helper';
import { getStoredOtp } from '../../src/shared/utils/otp.util';
import { cleanupTestUsers } from '../helpers/cleanup';

describe('Authentication: Full Lifecycle Integration Test', () => {
  const user = generateTestUser(601, 'lifecycle');

  before(async () => {
    await cleanupTestUsers('test_lifecycle_%');
  });

  after(async () => {
    await cleanupTestUsers('test_lifecycle_%');
  });

  test('Complete End-to-End User Lifecycle Journey', async () => {
    // ─── Phase 1: Registration Flow ───
    const initRes = await requestApi('POST', '/auth/initiate-signup', {
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
    });
    assert.strictEqual(initRes.status, 200);

    const signupOtp = initRes.data.data?.debugOtp || await getStoredOtp(user.email, 'SIGNUP');
    assert.ok(signupOtp);

    const verifyOtpRes = await requestApi('POST', '/auth/verify-signup-otp', {
      email: user.email,
      otp: signupOtp,
    });
    assert.strictEqual(verifyOtpRes.status, 200);
    const regToken = verifyOtpRes.data.data?.registrationToken;
    assert.ok(regToken);

    const completeRes = await requestApi('POST', '/auth/complete-signup', {
      registrationToken: regToken,
      firebaseIdToken: user.firebaseToken,
    });
    assert.strictEqual(completeRes.status, 201);
    let accessToken = completeRes.data.data?.tokens?.accessToken;
    let refreshToken = completeRes.data.data?.tokens?.refreshToken;
    const userId = completeRes.data.data?.user?.id;
    assert.ok(accessToken);
    assert.ok(refreshToken);
    assert.ok(userId);

    // ─── Phase 2: Access Protected Endpoint ───
    const meRes = await requestApi('GET', '/auth/me', undefined, accessToken);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.data?.user?.email, user.email);

    // ─── Phase 3: Token Refresh & Rotation ───
    const refreshRes = await requestApi('POST', '/auth/refresh', { refreshToken });
    assert.strictEqual(refreshRes.status, 200);
    const oldRefreshToken = refreshToken;
    accessToken = refreshRes.data.data?.tokens?.accessToken;
    refreshToken = refreshRes.data.data?.tokens?.refreshToken;
    assert.ok(accessToken);
    assert.ok(refreshToken);

    // Verify rotated token cannot be used again
    const staleRefreshRes = await requestApi('POST', '/auth/refresh', { refreshToken: oldRefreshToken });
    assert.strictEqual(staleRefreshRes.status, 401);

    // Verify new access token works
    const meRes2 = await requestApi('GET', '/auth/me', undefined, accessToken);
    assert.strictEqual(meRes2.status, 200);

    // ─── Phase 4: Signin with Firebase Session ───
    const signinRes = await requestApi('POST', '/auth/signin', {
      firebaseIdToken: user.firebaseToken,
    });
    assert.strictEqual(signinRes.status, 200);
    assert.strictEqual(signinRes.data.data?.user?.email, user.email);

    // ─── Phase 5: Forgot Password & Reset ───
    const forgotRes = await requestApi('POST', '/auth/forgot-password', { email: user.email });
    const resetOtp = forgotRes.data.data?.debugOtp || await getStoredOtp(user.email, 'PASSWORD_RESET');
    assert.ok(resetOtp);

    const verifyForgotRes = await requestApi('POST', '/auth/verify-forgot-otp', {
      email: user.email,
      otp: resetOtp,
    });
    assert.strictEqual(verifyForgotRes.status, 200);
    const resetToken = verifyForgotRes.data.data?.resetToken;
    assert.ok(resetToken);

    const resetRes = await requestApi('POST', '/auth/reset-password', {
      resetToken,
      newPassword: 'BrandNewSecurePassword123!',
    });
    assert.strictEqual(resetRes.status, 200);

    // ─── Phase 6: Logout & Session Invalidation ───
    const logoutRes = await requestApi('POST', '/auth/logout', { refreshToken }, accessToken);
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.data.data?.loggedOut, true);

    // Verify refresh token is completely invalidated after logout
    const postLogoutRefresh = await requestApi('POST', '/auth/refresh', { refreshToken });
    assert.strictEqual(postLogoutRefresh.status, 401);
  });
});
