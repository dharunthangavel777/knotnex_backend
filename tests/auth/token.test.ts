import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { generateTestUser } from '../helpers/test-user';
import { requestApi, registerTestUser } from '../helpers/auth-helper';
import { cleanupTestUsers } from '../helpers/cleanup';

describe('Authentication: Token & Session Management', () => {
  const userDef = generateTestUser(301, 'token');
  let accessToken: string;
  let refreshToken: string;

  before(async () => {
    await cleanupTestUsers('test_token_%');
    const regResult = await registerTestUser(userDef);
    assert.strictEqual(regResult.success, true);
    accessToken = regResult.tokens!.accessToken;
    refreshToken = regResult.tokens!.refreshToken;
  });

  after(async () => {
    await cleanupTestUsers('test_token_%');
  });

  test('1. Valid access token can fetch /auth/me profile', async () => {
    const res = await requestApi('GET', '/auth/me', undefined, accessToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data?.user?.email, userDef.email);
  });

  test('2. Missing Authorization header returns 401 UNAUTHORIZED', async () => {
    const res = await requestApi('GET', '/auth/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error?.code, 'UNAUTHORIZED');
  });

  test('3. Invalid / malformed Bearer token returns 401', async () => {
    const res = await requestApi('GET', '/auth/me', undefined, 'invalid.token.here');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  test('4. Token Refresh returns a new valid token pair', async () => {
    const res = await requestApi('POST', '/auth/refresh', {
      refreshToken,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data?.tokens?.accessToken, 'Must return new access token');
    assert.ok(res.data.data?.tokens?.refreshToken, 'Must return new refresh token');

    const newAccessToken = res.data.data?.tokens?.accessToken;
    const newRefreshToken = res.data.data?.tokens?.refreshToken;

    // Verify new access token works immediately
    const meRes = await requestApi('GET', '/auth/me', undefined, newAccessToken);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.data?.user?.email, userDef.email);

    // 5. Token Rotation: Old refresh token must be revoked and fail if reused
    const reuseRes = await requestApi('POST', '/auth/refresh', {
      refreshToken, // old one
    });
    assert.strictEqual(reuseRes.status, 401, 'Reusing rotated refresh token must fail');
    assert.strictEqual(reuseRes.data.success, false);
    assert.ok(reuseRes.data.error?.message?.includes('revoked'));

    // Update refreshToken reference for subsequent tests
    refreshToken = newRefreshToken;
    accessToken = newAccessToken;
  });

  test('5. Logout revokes the refresh token', async () => {
    // Call logout
    const logoutRes = await requestApi('POST', '/auth/logout', { refreshToken }, accessToken);
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.data.success, true);
    assert.strictEqual(logoutRes.data.data?.loggedOut, true);

    // Verify refresh token is now revoked
    const refreshAfterLogout = await requestApi('POST', '/auth/refresh', {
      refreshToken,
    });
    assert.strictEqual(refreshAfterLogout.status, 401, 'Revoked refresh token should fail on refresh');
  });
});
