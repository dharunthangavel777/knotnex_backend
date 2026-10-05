import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { generateTestUser } from '../helpers/test-user';
import { requestApi, registerTestUser } from '../helpers/auth-helper';
import { cleanupTestUsers } from '../helpers/cleanup';
import { query } from '../../src/config/database';
import { signAccessToken } from '../../src/shared/utils/jwt.util';
import { UserRole } from '../../src/types/enums';

describe('Authentication: Role-Based Access Control (RBAC) & Authorization', () => {
  const regularUserDef = generateTestUser(401, 'authz');
  let userAccessToken: string;
  let adminAccessToken: string;
  let orgAccessToken: string;

  before(async () => {
    await cleanupTestUsers('test_authz_%');

    // Register a standard user
    const regResult = await registerTestUser(regularUserDef);
    assert.strictEqual(regResult.success, true);
    userAccessToken = regResult.tokens!.accessToken;

    // Create Admin user in DB
    const adminRes = await query(
      `INSERT INTO users (firebase_uid, email, full_name, role, is_verified)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email) DO UPDATE SET role = 'admin'
       RETURNING id, firebase_uid, email, role`,
      ['admin-test-uid', 'admin_test@knotnex.test', 'Admin Tester', UserRole.ADMIN]
    );
    const adminUser = adminRes.rows[0];
    adminAccessToken = signAccessToken({
      sub: adminUser.id,
      uid: adminUser.firebase_uid,
      email: adminUser.email,
      role: UserRole.ADMIN,
    });

    // Create Organization user in DB
    const orgRes = await query(
      `INSERT INTO users (firebase_uid, email, full_name, role, is_verified)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email) DO UPDATE SET role = 'organization'
       RETURNING id, firebase_uid, email, role`,
      ['org-test-uid', 'org_test@knotnex.test', 'Org Tester', UserRole.ORGANIZATION]
    );
    const orgUser = orgRes.rows[0];
    orgAccessToken = signAccessToken({
      sub: orgUser.id,
      uid: orgUser.firebase_uid,
      email: orgUser.email,
      role: UserRole.ORGANIZATION,
    });
  });

  after(async () => {
    await cleanupTestUsers('test_authz_%');
    await query(`DELETE FROM users WHERE email IN ('admin_test@knotnex.test', 'org_test@knotnex.test')`);
  });

  test('1. Unauthenticated request to protected route is rejected with 401 UNAUTHORIZED', async () => {
    const res = await requestApi('GET', '/admin/users');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error?.code, 'UNAUTHORIZED');
  });

  test('2. Regular user is forbidden from accessing Admin endpoints (403 FORBIDDEN)', async () => {
    const res = await requestApi('GET', '/admin/users', undefined, userAccessToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error?.code, 'FORBIDDEN');
    assert.ok(res.data.error?.message?.includes('Requires one of roles'));
  });

  test('3. Organization user is forbidden from accessing Admin endpoints (403 FORBIDDEN)', async () => {
    const res = await requestApi('GET', '/admin/users', undefined, orgAccessToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error?.code, 'FORBIDDEN');
  });

  test('4. Admin user can successfully access Admin endpoints', async () => {
    const res = await requestApi('GET', '/admin/users', undefined, adminAccessToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data), 'Admin users response data must be an array');
  });

  test('5. Development mock tokens correctly identify roles', async () => {
    // mock_admin
    const adminRes = await requestApi('GET', '/admin/users', undefined, 'mock_admin');
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.data.success, true);

    // mock_user
    const userRes = await requestApi('GET', '/admin/users', undefined, 'mock_user');
    assert.strictEqual(userRes.status, 403);
    assert.strictEqual(userRes.data.error?.code, 'FORBIDDEN');
  });
});
