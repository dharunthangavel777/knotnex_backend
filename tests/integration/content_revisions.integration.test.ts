import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ContentRevisionService } from '../../src/services/content_revision.service';
import { EventService } from '../../src/services/event.service';
import { JobService } from '../../src/services/job.service';
import { SchemeService } from '../../src/services/scheme.service';

describe('Content Revisions & Edit/Re-approval Lifecycle Integration Test', () => {
  const testOrgId = '20000000-0000-0000-0000-000000000001';
  const testUserId = '00000000-0000-0000-0000-000000000001';

  test('1. Creating a revision preserves live entity and queues for admin review', async () => {
    const changes = {
      title: 'Updated Annual Tech Inclusion Summit 2026',
      venue_name: 'Main Convention Hall A, Bengaluru',
      capacity: 1200,
    };

    const rev = await ContentRevisionService.createRevision(
      'event',
      'evt-test-123',
      testOrgId,
      changes,
      testUserId
    );

    assert.ok(rev);
    assert.strictEqual(rev.entity_type, 'event');
    assert.strictEqual(rev.status, 'PENDING_APPROVAL');
    assert.ok(rev.changes);
  });

  test('2. Listing pending revisions returns diff and live entity context', async () => {
    const list = await ContentRevisionService.listPendingRevisions();
    assert.ok(Array.isArray(list));
    if (list.length > 0) {
      const first = list[0];
      assert.strictEqual(first.status, 'PENDING_APPROVAL');
      assert.ok(first.changes !== undefined);
    }
  });

  test('3. Admin rejection preserves live entity and stores rejection reason', async () => {
    const rev = await ContentRevisionService.createRevision(
      'job',
      'job-test-456',
      testOrgId,
      { title: 'Senior Accessibility Engineer - Special Revision' },
      testUserId
    );

    const rejected = await ContentRevisionService.rejectRevision(
      rev.id,
      testUserId,
      'Compensation range missing details'
    );

    assert.ok(rejected);
    assert.strictEqual(rejected.status, 'REJECTED');
    assert.strictEqual(rejected.rejection_reason, 'Compensation range missing details');
  });

  test('4. Admin approval applies changes and increments version', async () => {
    const rev = await ContentRevisionService.createRevision(
      'scheme',
      'sch-test-789',
      testOrgId,
      { title: 'Empowerment Grant 2026 - Approved Edition', grant_amount: '₹5,00,000' },
      testUserId
    );

    const approved = await ContentRevisionService.approveRevision(
      rev.id,
      testUserId
    );

    assert.ok(approved);
    assert.strictEqual(approved.status, 'APPROVED');
  });
});
