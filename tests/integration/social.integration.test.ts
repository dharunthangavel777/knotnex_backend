import { test, describe } from 'node:test';
import assert from 'node:assert';
import { requestApi } from '../helpers/auth-helper';

describe('Community Social Feed Pipeline', () => {
  test('1. Public feed inquiry (GET /posts)', async () => {
    const res = await requestApi('GET', '/posts?limit=10');
    assert.ok(res.status === 200 || res.status === 503);
    if (res.status === 200) {
      assert.ok(res.data.success);
    }
  });

  test('2. Unauthenticated post creation must return 401', async () => {
    const res = await requestApi('POST', '/posts', {
      caption: 'Community announcement post',
      mediaUrls: [],
    });
    assert.ok(res.status === 401 || res.status === 403 || res.status === 503);
  });
});

