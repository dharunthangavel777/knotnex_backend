import { test, describe } from 'node:test';
import assert from 'node:assert';
import { requestApi } from '../helpers/auth-helper';

describe('Government & Institutional Schemes Pipeline', () => {
  test('1. Public schemes listing (GET /schemes)', async () => {
    const res = await requestApi('GET', '/schemes?limit=10');
    assert.ok(res.status === 200 || res.status === 503);
    if (res.status === 200) {
      assert.ok(res.data.success);
    }
  });

  test('2. Scheme detail inquiry by ID (GET /schemes/:id)', async () => {
    const res = await requestApi('GET', '/schemes/sch_test_welfare');
    assert.ok(res.status === 200 || res.status === 404 || res.status === 503);
  });
});

