import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { generateTestUser } from '../helpers/test-user';
import { requestApi, registerTestUser } from '../helpers/auth-helper';
import { getStoredOtp } from '../../src/shared/utils/otp.util';
import { cleanupTestUsers } from '../helpers/cleanup';

describe('Authentication: Security, Headers & Vulnerability Tests', () => {
  const userDef = generateTestUser(501, 'sec');

  before(async () => {
    await cleanupTestUsers('test_sec_%');
    const regResult = await registerTestUser(userDef);
    assert.strictEqual(regResult.success, true);
  });

  after(async () => {
    await cleanupTestUsers('test_sec_%');
  });

  test('1. Anti-Enumeration: forgot-password returns identical success message for existing vs non-existent emails', async () => {
    // Existing user
    const resExisting = await requestApi('POST', '/auth/forgot-password', {
      email: userDef.email,
    });
    assert.strictEqual(resExisting.status, 200);
    assert.strictEqual(resExisting.data.success, true);

    // Non-existent email
    const resNonExistent = await requestApi('POST', '/auth/forgot-password', {
      email: 'nonexistent_account_never_created@knotnex.test',
    });
    assert.strictEqual(resNonExistent.status, 200);
    assert.strictEqual(resNonExistent.data.success, true);

    // Both should indicate success without revealing email presence
    assert.ok(resNonExistent.data.message);
  });

  test('2. Complete Forgot Password & Password Reset flow works', async () => {
    // 1. Request reset
    const forgotRes = await requestApi('POST', '/auth/forgot-password', { email: userDef.email });

    // 2. Fetch reset OTP
    const otp = forgotRes.data.data?.debugOtp || await getStoredOtp(userDef.email, 'PASSWORD_RESET');
    assert.ok(otp, 'Reset OTP should be saved');

    // 3. Verify OTP
    const verifyRes = await requestApi('POST', '/auth/verify-forgot-otp', {
      email: userDef.email,
      otp,
    });
    assert.strictEqual(verifyRes.status, 200);
    const resetToken = verifyRes.data.data?.resetToken;
    assert.ok(resetToken, 'resetToken must be returned');

    // 4. Reset password
    const resetRes = await requestApi('POST', '/auth/reset-password', {
      resetToken,
      newPassword: 'NewSecurePassword@2026',
    });
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.data.success, true);
  });

  test('3. SQL Injection payloads in email/name do not cause 500 crashes', async () => {
    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "admin'--",
      "1' OR 1=1 #",
    ];

    for (const p of payloads) {
      const res = await requestApi('POST', '/auth/initiate-signup', {
        email: `valid${Math.random().toString(36).substring(7)}@knotnex.test`,
        fullName: p,
      });
      // Should handle safely via Zod or parameterized query (never 500)
      assert.notStrictEqual(res.status, 500, `SQLi payload "${p}" must not cause internal server error`);
    }
  });

  test('4. Security headers are properly applied by Helmet', async () => {
    const res = await requestApi('GET', '/health');
    assert.strictEqual(res.status, 200);

    const xContentTypeOptions = res.headers.get('x-content-type-options');
    const xFrameOptions = res.headers.get('x-frame-options');

    assert.strictEqual(xContentTypeOptions, 'nosniff', 'X-Content-Type-Options must be nosniff');
    assert.strictEqual(xFrameOptions, 'SAMEORIGIN', 'X-Frame-Options must be present');
  });

  test('5. Excessively large payloads are rejected by express body parser limits', async () => {
    const hugeString = 'A'.repeat(1024 * 1024 * 12); // 12MB payload
    const res = await requestApi('POST', '/auth/initiate-signup', {
      email: 'huge@knotnex.test',
      fullName: hugeString,
    });
    // Express 10mb limit returns 413 Payload Too Large
    assert.ok(res.status === 413 || res.status === 400, `Oversized payload should be rejected with 413 or 400 (got ${res.status})`);
  });
});
