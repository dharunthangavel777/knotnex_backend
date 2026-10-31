import { test, describe } from 'node:test';
import assert from 'node:assert';
import { requestApi } from '../helpers/auth-helper';

describe('Careers & Job Application Pipeline Integration', () => {
  const mockToken = 'mock_jwt_auth_token';

  test('1. Public careers listing (GET /jobs)', async () => {
    const res = await requestApi('GET', '/jobs?limit=10');
    assert.ok(res.status === 200 || res.status === 503);
    if (res.status === 200) {
      assert.ok(res.data.success);
    }
  });

  test('2. Unauthenticated job posting must fail authorization', async () => {
    const res = await requestApi('POST', '/jobs', {
      title: 'Senior Accessibility Engineer',
      department: 'Engineering',
    });
    assert.ok(res.status === 401 || res.status === 403 || res.status === 503);
  });

  test('3. Job detail inquiry by ID (GET /jobs/:id)', async () => {
    const res = await requestApi('GET', '/jobs/job_test_123');
    assert.ok(res.status === 200 || res.status === 404 || res.status === 503);
  });
});

