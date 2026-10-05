import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { generateTestUser } from '../helpers/test-user';
import { requestApi, registerTestUser } from '../helpers/auth-helper';
import { cleanupTestUsers } from '../helpers/cleanup';
import { query } from '../../src/config/database';

describe('Authentication: Login Flow', () => {
  const registeredUser = generateTestUser(201, 'login');

  before(async () => {
    await cleanupTestUsers('test_login_%');
    // Register one user to use for login tests
    const regResult = await registerTestUser(registeredUser);
    assert.strictEqual(regResult.success, true, 'Pre-registration for login tests failed');
  });

  after(async () => {
    await cleanupTestUsers('test_login_%');
  });

  test('1. Valid Sign-in succeeds with valid Firebase token', async () => {
    const res = await requestApi('POST', '/auth/signin', {
      firebaseIdToken: registeredUser.firebaseToken,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data?.user?.email, registeredUser.email);
    assert.ok(res.data.data?.tokens?.accessToken, 'Must return new access token');
    assert.ok(res.data.data?.tokens?.refreshToken, 'Must return new refresh token');
    assert.strictEqual(res.data.data?.tokens?.expiresIn, 900); // 15 min
  });

  test('2. Sign-in with non-existent user returns 401 with appropriate message', async () => {
    const nonExistentUser = generateTestUser(999, 'login');
    const res = await requestApi('POST', '/auth/signin', {
      firebaseIdToken: nonExistentUser.firebaseToken,
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error?.message?.includes('not found') || res.data.error?.message?.includes('sign up first'));
  });

  test('3. Suspended/Banned user is blocked from sign-in', async () => {
    // Ban the registered user in DB
    await query('UPDATE users SET is_banned = true WHERE email = $1', [registeredUser.email]);

    const res = await requestApi('POST', '/auth/signin', {
      firebaseIdToken: registeredUser.firebaseToken,
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error?.message?.includes('suspended'));

    // Unban for subsequent tests
    await query('UPDATE users SET is_banned = false WHERE email = $1', [registeredUser.email]);
  });

  test('4. Sign-in without firebaseIdToken fails validation', async () => {
    const res = await requestApi('POST', '/auth/signin', {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error?.code, 'VALIDATION_FAILED');
  });

  test('5. Sign-in with invalid/malformed token fails', async () => {
    const res = await requestApi('POST', '/auth/signin', {
      firebaseIdToken: 'this_is_an_invalid_token',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });
});
