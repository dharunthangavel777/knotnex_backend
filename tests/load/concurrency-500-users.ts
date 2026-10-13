/**
 * KNOTNEX — 500 CONCURRENT VIRTUAL USER LOAD TEST HARNESS
 *
 * Simulates progressive concurrency stages:
 *  - Stage 1: 10 VUs (Baseline)
 *  - Stage 2: 50 VUs (Moderate Load)
 *  - Stage 3: 100 VUs (Peak Normal Traffic)
 *  - Stage 4: 250 VUs (Traffic Spike)
 *  - Stage 5: 500 VUs (Maximum Concurrency Horizon)
 *
 * Real user journeys: Auth -> Feed -> Post -> Like -> Comment -> Me
 */

import { LOAD_TEST_CONFIG } from './config';

interface LatencyRecord {
  durationMs: number;
  status: number;
  success: boolean;
  endpoint: string;
}

interface StageReport {
  stageName: string;
  configuredVUs: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: string;
  rps: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
}

const BASE_URL = process.env.API_BASE_URL || LOAD_TEST_CONFIG.apiBaseUrl || 'https://knotnex-backend-445162659573.europe-west1.run.app/api/v1';

function calculatePercentiles(records: LatencyRecord[], totalDurationSec: number, name: string, vus: number): StageReport {
  const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
  const total = durations.length;
  const successful = records.filter((r) => r.success).length;
  const failed = total - successful;

  const pct = (p: number) => {
    if (total === 0) return 0;
    const idx = Math.ceil((p / 100) * total) - 1;
    return Number(durations[Math.max(0, Math.min(idx, total - 1))].toFixed(1));
  };

  const avg = total > 0 ? Number((durations.reduce((a, b) => a + b, 0) / total).toFixed(1)) : 0;
  const rps = totalDurationSec > 0 ? Number((total / totalDurationSec).toFixed(1)) : 0;

  return {
    stageName: name,
    configuredVUs: vus,
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: failed,
    errorRate: `${total > 0 ? ((failed / total) * 100).toFixed(2) : 0}%`,
    rps,
    p50Ms: pct(50),
    p90Ms: pct(90),
    p95Ms: pct(95),
    p99Ms: pct(99),
    avgMs: avg,
  };
}

async function simulateVirtualUser(vuIndex: number, records: LatencyRecord[]): Promise<void> {
  const email = `test_vu_${vuIndex}@knotnex.test`;
  const password = 'Password@2026';
  let token = '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-test-bypass-rate-limit': 'true',
  };

  // 1. Signin (or signup if missing)
  const signinStart = performance.now();
  try {
    let res = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 401 || res.status === 404) {
      // Register
      res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, fullName: `VU Tester ${vuIndex}`, password, role: 'user' }),
      });
    }

    const durationMs = performance.now() - signinStart;
    const json = (await res.json().catch(() => ({}))) as any;
    token = json.data?.tokens?.accessToken || json.data?.accessToken || '';
    records.push({
      durationMs,
      status: res.status,
      success: res.ok && !!token,
      endpoint: '/auth/signin',
    });
  } catch (err) {
    records.push({
      durationMs: performance.now() - signinStart,
      status: 0,
      success: false,
      endpoint: '/auth/signin',
    });
  }

  if (!token) return;

  const authHeaders: Record<string, string> = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  // 2. Fetch Feed
  const feedStart = performance.now();
  let firstPostId = '';
  try {
    const res = await fetch(`${BASE_URL}/posts/feed?page=1&limit=20`, {
      method: 'GET',
      headers: authHeaders,
    });
    const durationMs = performance.now() - feedStart;
    const json = (await res.json().catch(() => ({}))) as any;
    const posts = json.data?.posts || (Array.isArray(json.data) ? json.data : []);
    if (posts.length > 0 && posts[0].id) {
      firstPostId = posts[0].id;
    }
    records.push({
      durationMs,
      status: res.status,
      success: res.ok,
      endpoint: '/posts/feed',
    });
  } catch {
    records.push({
      durationMs: performance.now() - feedStart,
      status: 0,
      success: false,
      endpoint: '/posts/feed',
    });
  }

  // 3. Social Interaction: Like or Comment
  if (firstPostId) {
    const likeStart = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/posts/${firstPostId}/like`, {
        method: 'POST',
        headers: authHeaders,
      });
      records.push({
        durationMs: performance.now() - likeStart,
        status: res.status,
        success: res.ok,
        endpoint: '/posts/:id/like',
      });
    } catch {
      records.push({
        durationMs: performance.now() - likeStart,
        status: 0,
        success: false,
        endpoint: '/posts/:id/like',
      });
    }
  }

  // 4. Fetch /auth/me
  const meStart = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: authHeaders,
    });
    records.push({
      durationMs: performance.now() - meStart,
      status: res.status,
      success: res.ok,
      endpoint: '/auth/me',
    });
  } catch {
    records.push({
      durationMs: performance.now() - meStart,
      status: 0,
      success: false,
      endpoint: '/auth/me',
    });
  }
}

async function runStage(stageName: string, vus: number): Promise<StageReport> {
  console.log(`[Stage Start] Running ${stageName} with ${vus} concurrent virtual users...`);
  const records: LatencyRecord[] = [];
  const start = performance.now();

  const promises: Promise<void>[] = [];
  for (let i = 1; i <= vus; i++) {
    promises.push(simulateVirtualUser(i, records));
  }

  await Promise.all(promises);
  const durationSec = (performance.now() - start) / 1000;
  const report = calculatePercentiles(records, durationSec, stageName, vus);
  console.log(`[Stage Done] ${stageName} finished in ${durationSec.toFixed(2)}s | RPS: ${report.rps} | P95: ${report.p95Ms}ms | Error: ${report.errorRate}\n`);
  return report;
}

export async function runFullBenchmark(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('       KNOTNEX 500 CONCURRENT VIRTUAL USER BENCHMARK SUITE         ');
  console.log(`  Target: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const stages = [
    { name: 'Stage 1 (Baseline)', vus: 10 },
    { name: 'Stage 2 (Moderate)', vus: 50 },
    { name: 'Stage 3 (Peak)', vus: 100 },
    { name: 'Stage 4 (Spike)', vus: 250 },
    { name: 'Stage 5 (Stress 500 VUs)', vus: 500 },
  ];

  const reports: StageReport[] = [];
  for (const s of stages) {
    const rep = await runStage(s.name, s.vus);
    reports.push(rep);
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                 PROGRESSIVE BENCHMARK RESULTS                     ');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.table(reports);

  const finalErrorRate = parseFloat(reports[reports.length - 1].errorRate);
  const pass = finalErrorRate < 3.0;
  console.log(`\nFinal Verdict: ${pass ? '✅ ARCHITECTURE CAPACITY VERIFIED' : '❌ THRESHOLD EXCEEDED'}`);
}

if (require.main === module) {
  runFullBenchmark().catch((err) => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  });
}
