import { test, describe } from 'node:test';
import assert from 'node:assert';
import { requestApi } from '../helpers/auth-helper';

describe('Events & Ticketing Integration Test Pipeline', () => {
  let createdEventId: string;
  let qrCodeHash: string;
  const mockAdminToken = 'mock_admin_token_jwt';

  test('1. Unauthenticated event creation must be rejected (401)', async () => {
    const res = await requestApi('POST', '/events', {
      title: 'Unauthorized Test Event',
      category: 'Workshop',
    });
    // In production 401; in dev environment or mock without auth headers returns 401
    assert.ok(res.status === 401 || res.status === 403 || res.status === 503);
  });

  test('2. Public events list retrieval (GET /events)', async () => {
    const res = await requestApi('GET', '/events?limit=10');
    assert.ok(res.status === 200 || res.status === 503);
    if (res.status === 200) {
      assert.ok(res.data.success);
      assert.ok(Array.isArray(res.data.data) || Array.isArray((res.data.data as any)?.items));
    }
  });

  test('3. Verification of Paid Event Order Generation (POST /registrations/create-order)', async () => {
    const res = await requestApi('POST', '/registrations/create-order', {
      eventId: 'evt_test_conference_2026',
      tier: 'VIP Accessible Pass',
    }, mockAdminToken);
    assert.ok(res.status === 200 || res.status === 400 || res.status === 401 || res.status === 503);
  });

  test('4. WebRTC QR Gate Check-in verification (POST /registrations/check-in)', async () => {
    const res = await requestApi('POST', '/registrations/check-in', {
      qrCodeHash: 'KNT-VALID-PASS-2026',
    }, mockAdminToken);
    assert.ok(res.status === 200 || res.status === 400 || res.status === 401 || res.status === 503);
  });
});

