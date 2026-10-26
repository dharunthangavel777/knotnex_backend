import http from 'http';
import app from '../src/app';

const PORT = 8095;
const BASE_URL = `http://127.0.0.1:${PORT}`;

interface StepResult {
  step: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
}

const testResults: StepResult[] = [];

function recordResult(result: StepResult) {
  testResults.push(result);
  const mark = result.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${mark}] ${result.step.padEnd(45)} | ${result.method} ${result.endpoint.padEnd(35)} | Status: ${result.actualStatus} (Expected: ${result.expectedStatus})`);
  if (!result.passed) {
    console.error(`       Error details: ${result.notes}`);
  }
}

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, data };
}

function extractItems(response: { status: number; data: any }): any[] {
  if (!response || !response.data) return [];
  const payload = response.data;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  KNOTNEX UNIFIED BACKEND: ADMIN CONTENT VERIFICATION PIPELINE TEST');
  console.log('========================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`Test Express server listening on ${BASE_URL}...\n`);

  let eventId = '';
  let jobId = '';
  let schemeId = '';
  let rejectedEventId = '';

  try {
    // ─── STEP 1: Health Check ───
    const health = await request('/health');
    recordResult({
      step: '1. Health check verification',
      endpoint: '/health',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: health.status,
      passed: health.status === 200 && health.data?.status === 'ok',
      notes: JSON.stringify(health.data),
    });

    // ─── STEP 2: Org Creates Event (Must enter pending_verification) ───
    const createEventRes = await request('/api/v1/events', {
      method: 'POST',
      token: 'mock_organization',
      body: {
        title: 'Accessible Tech Hackathon 2026',
        category: 'Technology',
        type: 'Hybrid',
        eventDate: '2026-11-20',
        venueName: 'KnotNex Innovation Center',
        shortDescription: 'Empowering accessible software development.',
        detailedDescription: 'Join 500+ builders creating accessible, voice-first, and assistive technologies.',
        capacity: 500,
        isFree: true,
        wheelchairAccessible: true,
        signLanguage: true,
      },
    });

    const createdEvent = createEventRes.data?.data;
    eventId = createdEvent?.id || '';
    const eventIsPending = createdEvent?.status === 'pending_verification' && createdEvent?.is_verified === false;

    recordResult({
      step: '2. Org creates event (defaults to pending_verification)',
      endpoint: '/api/v1/events',
      method: 'POST',
      expectedStatus: 201,
      actualStatus: createEventRes.status,
      passed: createEventRes.status === 201 && !!eventId && eventIsPending,
      notes: `Event ID: ${eventId}, Status: ${createdEvent?.status}, is_verified: ${createdEvent?.is_verified}`,
    });

    // ─── STEP 3: Org Creates Career / Job (Must enter pending_verification) ───
    const createJobRes = await request('/api/v1/jobs', {
      method: 'POST',
      token: 'mock_organization',
      body: {
        title: 'Lead Accessibility Engineer',
        department: 'Engineering',
        type: 'full-time',
        locationType: 'hybrid',
        location: 'Bengaluru, India',
        description: 'Design accessible, WCAG AAA compliant experiences for KnotNex community.',
        requirements: ['React', 'TypeScript', 'ARIA standards', 'Screen reader testing'],
        disabilityAccommodations: ['Flexible hours', 'Screen reader license', 'Ergonomic workspace'],
        minSalary: 1800000,
        maxSalary: 2800000,
        currency: 'INR',
      },
    });

    const createdJob = createJobRes.data?.data;
    jobId = createdJob?.id || '';
    const jobIsPending = createdJob?.status === 'pending_verification' && createdJob?.is_verified === false;

    recordResult({
      step: '3. Org creates job (defaults to pending_verification)',
      endpoint: '/api/v1/jobs',
      method: 'POST',
      expectedStatus: 201,
      actualStatus: createJobRes.status,
      passed: createJobRes.status === 201 && !!jobId && jobIsPending,
      notes: `Job ID: ${jobId}, Status: ${createdJob?.status}, is_verified: ${createdJob?.is_verified}`,
    });

    // ─── STEP 4: Org Creates Scheme (Must enter pending_verification) ───
    const createSchemeRes = await request('/api/v1/schemes', {
      method: 'POST',
      token: 'mock_organization',
      body: {
        title: 'Assistive Devices Subsidy Grant 2026',
        category: 'Subsidy',
        type: 'NGO',
        providerName: 'KnotNex Social Foundation',
        description: 'Financial subsidy supporting assistive devices and adaptive mobility tools.',
        eligibilityCriteria: ['Persons with verified disability certificate', 'Family income < 8 LPA'],
        benefits: ['Up to ₹50,000 subsidy per beneficiary', 'Direct vendor disbursement'],
        grantAmount: '₹50,00,000',
        fundingAmount: 5000000,
        officialPortalUrl: 'https://knotnex.com/grants/devices-2026',
      },
    });

    const createdScheme = createSchemeRes.data?.data;
    schemeId = createdScheme?.id || '';
    const schemeIsPending = createdScheme?.status === 'pending_verification' && createdScheme?.is_verified === false;

    recordResult({
      step: '4. Org creates scheme (defaults to pending_verification)',
      endpoint: '/api/v1/schemes',
      method: 'POST',
      expectedStatus: 201,
      actualStatus: createSchemeRes.status,
      passed: createSchemeRes.status === 201 && !!schemeId && schemeIsPending,
      notes: `Scheme ID: ${schemeId}, Status: ${createdScheme?.status}, is_verified: ${createdScheme?.is_verified}`,
    });

    // ─── STEP 5: Public Feeds Gatekeeper (Unverified items must be HIDDEN) ───
    const publicEventsRes = await request('/api/v1/events');
    const publicEvents = extractItems(publicEventsRes);
    const eventHiddenFromPublic = !publicEvents.some((e: any) => String(e.id) === String(eventId));

    recordResult({
      step: '5a. Public events feed excludes unverified event',
      endpoint: '/api/v1/events',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: publicEventsRes.status,
      passed: publicEventsRes.status === 200 && eventHiddenFromPublic,
      notes: `Target event ${eventId} in public feed: ${!eventHiddenFromPublic}`,
    });

    const publicJobsRes = await request('/api/v1/jobs');
    const publicJobs = extractItems(publicJobsRes);
    const jobHiddenFromPublic = !publicJobs.some((j: any) => String(j.id) === String(jobId));

    recordResult({
      step: '5b. Public jobs feed excludes unverified job',
      endpoint: '/api/v1/jobs',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: publicJobsRes.status,
      passed: publicJobsRes.status === 200 && jobHiddenFromPublic,
      notes: `Target job ${jobId} in public feed: ${!jobHiddenFromPublic}`,
    });

    const publicSchemesRes = await request('/api/v1/schemes');
    const publicSchemes = extractItems(publicSchemesRes);
    const schemeHiddenFromPublic = !publicSchemes.some((s: any) => String(s.id) === String(schemeId));

    recordResult({
      step: '5c. Public schemes feed excludes unverified scheme',
      endpoint: '/api/v1/schemes',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: publicSchemesRes.status,
      passed: publicSchemesRes.status === 200 && schemeHiddenFromPublic,
      notes: `Target scheme ${schemeId} in public feed: ${!schemeHiddenFromPublic}`,
    });

    // ─── STEP 6: Org Dashboard can view its pending submissions ───
    const orgEventsRes = await request(`/api/v1/events?orgId=00000000-0000-0000-0000-000000000001`, {
      token: 'mock_organization',
    });
    const orgEvents = extractItems(orgEventsRes);
    const eventVisibleToOrg = orgEvents.some((e: any) => String(e.id) === String(eventId));

    recordResult({
      step: '6. Org dashboard displays its own pending event',
      endpoint: '/api/v1/events?orgId=...',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: orgEventsRes.status,
      passed: orgEventsRes.status === 200 && eventVisibleToOrg,
      notes: `Org events count: ${orgEvents.length}, Target event found: ${eventVisibleToOrg}`,
    });

    // ─── STEP 7: Admin Pending Content Queue Inspection ───
    const pendingContentRes = await request('/api/v1/admin/pending-content', {
      token: 'mock_admin',
    });
    const pendingData = pendingContentRes.data?.data;
    const hasPendingEvent = (pendingData?.events || []).some((e: any) => String(e.id) === String(eventId));
    const hasPendingJob = (pendingData?.jobs || []).some((j: any) => String(j.id) === String(jobId));
    const hasPendingScheme = (pendingData?.schemes || []).some((s: any) => String(s.id) === String(schemeId));

    recordResult({
      step: '7. Admin lists all pending verification items',
      endpoint: '/api/v1/admin/pending-content',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: pendingContentRes.status,
      passed: pendingContentRes.status === 200 && hasPendingEvent && hasPendingJob && hasPendingScheme,
      notes: `Pending total: ${pendingData?.totalPending}, Event: ${hasPendingEvent}, Job: ${hasPendingJob}, Scheme: ${hasPendingScheme}`,
    });

    // ─── STEP 8: Admin Approves Event -> Becomes published & public ───
    const verifyEventRes = await request(`/api/v1/admin/events/${eventId}/verify`, {
      method: 'POST',
      token: 'mock_admin',
    });
    const verifiedEvent = verifyEventRes.data?.data;
    const eventNowPublished = verifiedEvent?.status === 'published' && verifiedEvent?.is_verified === true;

    recordResult({
      step: '8a. Admin approves event -> published & verified',
      endpoint: `/api/v1/admin/events/:id/verify`,
      method: 'POST',
      expectedStatus: 200,
      actualStatus: verifyEventRes.status,
      passed: verifyEventRes.status === 200 && eventNowPublished,
      notes: `Status: ${verifiedEvent?.status}, is_verified: ${verifiedEvent?.is_verified}`,
    });

    const publicEventsAfterRes = await request('/api/v1/events');
    const publicEventsAfter = extractItems(publicEventsAfterRes);
    const eventNowInPublic = publicEventsAfter.some((e: any) => String(e.id) === String(eventId));

    recordResult({
      step: '8b. Newly approved event is live in public feed',
      endpoint: '/api/v1/events',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: publicEventsAfterRes.status,
      passed: publicEventsAfterRes.status === 200 && eventNowInPublic,
      notes: `Event ${eventId} found in public feed: ${eventNowInPublic}`,
    });

    // ─── STEP 9: Admin Approves Job -> Becomes open & public ───
    const verifyJobRes = await request(`/api/v1/admin/jobs/${jobId}/verify`, {
      method: 'POST',
      token: 'mock_admin',
    });
    const verifiedJob = verifyJobRes.data?.data;
    const jobNowOpen = verifiedJob?.status === 'open' && verifiedJob?.is_verified === true;

    recordResult({
      step: '9a. Admin approves job -> open & verified',
      endpoint: `/api/v1/admin/jobs/:id/verify`,
      method: 'POST',
      expectedStatus: 200,
      actualStatus: verifyJobRes.status,
      passed: verifyJobRes.status === 200 && jobNowOpen,
      notes: `Status: ${verifiedJob?.status}, is_verified: ${verifiedJob?.is_verified}`,
    });

    const publicJobsAfterRes = await request('/api/v1/jobs');
    const publicJobsAfter = extractItems(publicJobsAfterRes);
    const jobNowInPublic = publicJobsAfter.some((j: any) => String(j.id) === String(jobId));

    recordResult({
      step: '9b. Newly approved job is live in public feed',
      endpoint: '/api/v1/jobs',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: publicJobsAfterRes.status,
      passed: publicJobsAfterRes.status === 200 && jobNowInPublic,
      notes: `Job ${jobId} found in public feed: ${jobNowInPublic}`,
    });

    // ─── STEP 10: Admin Approves Scheme -> Becomes active & public ───
    const verifySchemeRes = await request(`/api/v1/admin/schemes/${schemeId}/verify`, {
      method: 'POST',
      token: 'mock_admin',
    });
    const verifiedScheme = verifySchemeRes.data?.data;
    const schemeNowActive = verifiedScheme?.status === 'active' && verifiedScheme?.is_verified === true;

    recordResult({
      step: '10a. Admin approves scheme -> active & verified',
      endpoint: `/api/v1/admin/schemes/:id/verify`,
      method: 'POST',
      expectedStatus: 200,
      actualStatus: verifySchemeRes.status,
      passed: verifySchemeRes.status === 200 && schemeNowActive,
      notes: `Status: ${verifiedScheme?.status}, is_verified: ${verifiedScheme?.is_verified}`,
    });

    const publicSchemesAfterRes = await request('/api/v1/schemes');
    const publicSchemesAfter = extractItems(publicSchemesAfterRes);
    const schemeNowInPublic = publicSchemesAfter.some((s: any) => String(s.id) === String(schemeId));

    recordResult({
      step: '10b. Newly approved scheme is live in public feed',
      endpoint: '/api/v1/schemes',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: publicSchemesAfterRes.status,
      passed: publicSchemesAfterRes.status === 200 && schemeNowInPublic,
      notes: `Scheme ${schemeId} found in public feed: ${schemeNowInPublic}`,
    });

    // ─── STEP 11: Admin Rejection Flow Test ───
    const createRejectedEventRes = await request('/api/v1/events', {
      method: 'POST',
      token: 'mock_organization',
      body: {
        title: 'Unverified Community Gathering',
        category: 'Social',
        shortDescription: 'Incomplete application',
        venueName: 'TBD',
      },
    });
    rejectedEventId = createRejectedEventRes.data?.data?.id || '';

    const rejectRes = await request(`/api/v1/admin/events/${rejectedEventId}/reject`, {
      method: 'POST',
      token: 'mock_admin',
      body: {
        reason: 'Missing detailed accessibility arrangements and confirmed venue booking.',
      },
    });
    const rejectedEvent = rejectRes.data?.data;
    const rejectionValid = rejectedEvent?.status === 'rejected' &&
      rejectedEvent?.is_verified === false &&
      typeof rejectedEvent?.rejection_reason === 'string' &&
      rejectedEvent?.rejection_reason.includes('accessibility arrangements');

    recordResult({
      step: '11a. Admin rejects event with feedback reason',
      endpoint: `/api/v1/admin/events/:id/reject`,
      method: 'POST',
      expectedStatus: 200,
      actualStatus: rejectRes.status,
      passed: rejectRes.status === 200 && rejectionValid,
      notes: `Status: ${rejectedEvent?.status}, Reason: ${rejectedEvent?.rejection_reason}`,
    });

    const publicEventsRejectedRes = await request('/api/v1/events');
    const publicEventsRejected = extractItems(publicEventsRejectedRes);
    const rejectedEventExcluded = !publicEventsRejected.some((e: any) => String(e.id) === String(rejectedEventId));

    recordResult({
      step: '11b. Rejected event remains excluded from public feed',
      endpoint: '/api/v1/events',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: publicEventsRejectedRes.status,
      passed: publicEventsRejectedRes.status === 200 && rejectedEventExcluded,
      notes: `Rejected event ${rejectedEventId} in public feed: ${!rejectedEventExcluded}`,
    });

  } catch (err: any) {
    console.error('Test execution error:', err);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('\nTest Express server terminated.');
  }

  // ─── SUMMARY ───
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n========================================================================');
  console.log(`  TEST RESULTS SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('========================================================================');

  if (failed > 0) {
    console.error(`\nFAILED TESTS (${failed}):`);
    testResults.filter((r) => !r.passed).forEach((r) => {
      console.error(` - [${r.step}] ${r.notes}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ ALL ADMIN VERIFICATION PIPELINE TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  }
}

runTestSuite();
