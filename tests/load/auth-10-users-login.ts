import { query } from '../../src/config/database';
import { generateTestUser, TestUserDef } from '../helpers/test-user';
import { requestApi } from '../helpers/auth-helper';
import { LOAD_TEST_CONFIG } from './config';

interface MetricResult {
  totalRequests: number;
  successful: number;
  failed: number;
  successRate: string;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  rps: number;
  statusCodes: Record<number, number>;
}

function calculateMetrics(latencies: number[], statuses: number[], totalDurationMs: number): MetricResult {
  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.length;
  const successful = statuses.filter(s => s >= 200 && s < 300).length;
  const failed = total - successful;

  const percentile = (p: number) => {
    if (total === 0) return 0;
    const index = Math.ceil((p / 100) * total) - 1;
    return Number(sorted[Math.max(0, Math.min(index, total - 1))].toFixed(2));
  };

  const statusCodes: Record<number, number> = {};
  for (const s of statuses) {
    statusCodes[s] = (statusCodes[s] || 0) + 1;
  }

  const avg = total > 0 ? Number((sorted.reduce((acc, v) => acc + v, 0) / total).toFixed(2)) : 0;
  const min = total > 0 ? Number(sorted[0].toFixed(2)) : 0;
  const max = total > 0 ? Number(sorted[total - 1].toFixed(2)) : 0;
  const rps = totalDurationMs > 0 ? Number(((total / totalDurationMs) * 1000).toFixed(2)) : 0;

  return {
    totalRequests: total,
    successful,
    failed,
    successRate: `${((successful / total) * 100).toFixed(1)}%`,
    avgLatencyMs: avg,
    minLatencyMs: min,
    maxLatencyMs: max,
    p50Ms: percentile(50),
    p90Ms: percentile(90),
    p95Ms: percentile(95),
    p99Ms: percentile(99),
    rps,
    statusCodes,
  };
}

async function runInstantLoginTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       KNOTNEX AUTHENTICATION: 10-USER INSTANT LOGIN TEST      ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const userCount = LOAD_TEST_CONFIG.userCount;
  const users: TestUserDef[] = [];

  for (let i = 1; i <= userCount; i++) {
    users.push(generateTestUser(i, LOAD_TEST_CONFIG.userPrefix));
  }

  // ─── Step 1: Pre-populate 10 users in database ───
  console.log(`[Setup] Provisioning ${userCount} verified test users in PostgreSQL...`);
  for (const u of users) {
    const res = await query(
      `INSERT INTO users (firebase_uid, email, full_name, role, is_verified)
       VALUES ($1, $2, $3, 'user', true)
       ON CONFLICT (email) DO UPDATE
         SET firebase_uid = EXCLUDED.firebase_uid,
             is_verified = true
       RETURNING id`,
      [u.uid, u.email, u.fullName]
    );
    await query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [res.rows[0].id]
    );
  }
  console.log(`[Setup] All ${userCount} users provisioned successfully.\n`);

  // ─── Step 2: Instant Concurrent Sign-in Test ───
  console.log(`[Execute] Firing ${userCount} concurrent /auth/signin requests...`);
  const signinStart = performance.now();
  const signinLatencies: number[] = [];
  const signinStatuses: number[] = [];
  const tokens: { email: string; accessToken: string }[] = [];

  const signinPromises = users.map(async (u) => {
    const res = await requestApi('POST', '/auth/signin', {
      firebaseIdToken: u.firebaseToken,
    });
    signinLatencies.push(res.latencyMs);
    signinStatuses.push(res.status);
    if (res.data.success && res.data.data?.tokens?.accessToken) {
      tokens.push({
        email: u.email,
        accessToken: res.data.data.tokens.accessToken,
      });
    }
  });

  await Promise.all(signinPromises);
  const signinTotalDuration = performance.now() - signinStart;
  const signinMetrics = calculateMetrics(signinLatencies, signinStatuses, signinTotalDuration);

  console.log(`[Done] Sign-in completed in ${signinTotalDuration.toFixed(2)}ms\n`);

  // ─── Step 3: Instant Concurrent Authenticated Profile Fetch (/auth/me) ───
  console.log(`[Execute] Firing ${tokens.length} concurrent /auth/me authenticated API requests...`);
  const apiStart = performance.now();
  const apiLatencies: number[] = [];
  const apiStatuses: number[] = [];

  const apiPromises = tokens.map(async (t) => {
    const res = await requestApi('GET', '/auth/me', undefined, t.accessToken);
    apiLatencies.push(res.latencyMs);
    apiStatuses.push(res.status);
  });

  await Promise.all(apiPromises);
  const apiTotalDuration = performance.now() - apiStart;
  const apiMetrics = calculateMetrics(apiLatencies, apiStatuses, apiTotalDuration);

  console.log(`[Done] Authenticated API calls completed in ${apiTotalDuration.toFixed(2)}ms\n`);

  // ─── Step 4: Clean up 10 test users ───
  console.log('[Cleanup] Safely removing 10 test users from database...');
  const delRes = await query(
    `DELETE FROM users WHERE email LIKE $1 RETURNING id`,
    [`${LOAD_TEST_CONFIG.userPrefix}_%`]
  );
  console.log(`[Cleanup] Deleted ${delRes.rowCount} test records. Database clean.\n`);

  // ─── Step 5: Report Output ───
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                        PERFORMANCE REPORT                     ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.table([
    {
      Flow: 'Concurrent Sign-In',
      Users: userCount,
      Concurrency: userCount,
      Success: signinMetrics.successful,
      Failed: signinMetrics.failed,
      Rate: signinMetrics.successRate,
      'Avg (ms)': signinMetrics.avgLatencyMs,
      'P50 (ms)': signinMetrics.p50Ms,
      'P95 (ms)': signinMetrics.p95Ms,
      'Max (ms)': signinMetrics.maxLatencyMs,
      RPS: signinMetrics.rps,
    },
    {
      Flow: 'Authenticated API (/me)',
      Users: tokens.length,
      Concurrency: tokens.length,
      Success: apiMetrics.successful,
      Failed: apiMetrics.failed,
      Rate: apiMetrics.successRate,
      'Avg (ms)': apiMetrics.avgLatencyMs,
      'P50 (ms)': apiMetrics.p50Ms,
      'P95 (ms)': apiMetrics.p95Ms,
      'Max (ms)': apiMetrics.maxLatencyMs,
      RPS: apiMetrics.rps,
    },
  ]);

  console.log('\nHTTP Status Distribution:');
  console.log('Sign-In Statuses:', signinMetrics.statusCodes);
  console.log('Authenticated API Statuses:', apiMetrics.statusCodes);

  const overallPass = signinMetrics.failed === 0 && apiMetrics.failed === 0;
  console.log(`\nOverall Result: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);

  process.exit(overallPass ? 0 : 1);
}

runInstantLoginTest().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
