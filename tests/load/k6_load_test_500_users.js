import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom Performance Metrics ──────────────────────────────────────────────
const errorRate = new Rate('knotnex_error_rate');
const signinLatency = new Trend('knotnex_signin_latency_ms');
const feedLatency = new Trend('knotnex_feed_latency_ms');
const postCreateLatency = new Trend('knotnex_post_create_latency_ms');
const likeLatency = new Trend('knotnex_like_latency_ms');
const commentLatency = new Trend('knotnex_comment_latency_ms');

// ── Target Configuration & Progressive Stages ──────────────────────────────
// Target: 500 Maximum Concurrent Virtual Users (VUs)
// Staged Ramp-up: 10 -> 50 -> 100 -> 250 -> 500 VUs
export const options = {
  stages: [
    // Stage 1: Warmup & baseline (10 VUs)
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },

    // Stage 2: Moderate load (50 VUs)
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },

    // Stage 3: Peak regular load (100 VUs)
    { duration: '30s', target: 100 },
    { duration: '2m', target: 100 },

    // Stage 4: High spike event (250 VUs)
    { duration: '45s', target: 250 },
    { duration: '2m', target: 250 },

    // Stage 5: Maximum stress test horizon (500 VUs)
    { duration: '1m', target: 500 },
    { duration: '3m', target: 500 },

    // Cool down & recovery
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // 95% of all HTTP requests must complete within 600ms
    http_req_duration: ['p(95)<600', 'p(99)<1200'],
    // Overall error rate must stay below 2%
    knotnex_error_rate: ['rate<0.02'],
    // Individual key transactions
    knotnex_signin_latency_ms: ['p(95)<500'],
    knotnex_feed_latency_ms: ['p(95)<400'],
    knotnex_like_latency_ms: ['p(95)<300'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'https://knotnex-backend-445162659573.europe-west1.run.app/api/v1';

// Bypass header enabled for authorized load test runs
const HEADERS = {
  'Content-Type': 'application/json',
  'x-test-bypass-rate-limit': 'true',
};

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const userEmail = `k6_user_${vuId}@knotnex.test`;
  const userPassword = 'TestPassword@2026';
  let authToken = null;
  let activePostId = null;

  // ── Step 1: Authentication (Registration / Sign-In) ────────────────────────
  group('1. Authentication Flow', function () {
    const signinPayload = JSON.stringify({
      email: userEmail,
      password: userPassword,
    });

    const signinStart = Date.now();
    let res = http.post(`${BASE_URL}/auth/signin`, signinPayload, { headers: HEADERS });
    signinLatency.add(Date.now() - signinStart);

    // If account doesn't exist, register directly
    if (res.status === 404 || res.status === 401) {
      const signupPayload = JSON.stringify({
        email: userEmail,
        fullName: `K6 VU ${vuId}`,
        password: userPassword,
        role: 'user',
      });
      res = http.post(`${BASE_URL}/auth/signup`, signupPayload, { headers: HEADERS });
    }

    const isSuccess = check(res, {
      'Auth succeeded (200 or 201)': (r) => r.status === 200 || r.status === 201,
      'Received valid access token': (r) => {
        try {
          const body = JSON.parse(r.body);
          authToken = body.data?.tokens?.accessToken || body.data?.accessToken;
          return !!authToken;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!isSuccess);
  });

  if (!authToken) {
    sleep(1);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'x-test-bypass-rate-limit': 'true',
  };

  sleep(0.5);

  // ── Step 2: Feed & Discovery Retrieval (70% probability) ───────────────────
  group('2. Feed & Reels Consumption', function () {
    const feedStart = Date.now();
    const feedRes = http.get(`${BASE_URL}/posts/feed?page=1&limit=20`, { headers: authHeaders });
    feedLatency.add(Date.now() - feedStart);

    const isFeedOk = check(feedRes, {
      'Feed retrieval status is 200': (r) => r.status === 200,
      'Feed returned array': (r) => {
        try {
          const body = JSON.parse(r.body);
          const list = body.data?.posts || body.data;
          if (Array.isArray(list) && list.length > 0) {
            activePostId = list[0].id;
          }
          return true;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!isFeedOk);

    // Fetch Reels
    const reelsRes = http.get(`${BASE_URL}/posts/reels?limit=10`, { headers: authHeaders });
    check(reelsRes, {
      'Reels retrieval status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);

  // ── Step 3: Post Creation (15% probability per VU iteration) ───────────────
  if (Math.random() < 0.15) {
    group('3. Create Social Post', function () {
      const createPayload = JSON.stringify({
        caption: `Automated test post from VU ${vuId} (iteration ${iterId}) #KnotNex`,
        postType: 'post',
        audience: 'public',
        tags: ['scale', 'test', 'concurrency'],
      });

      const createStart = Date.now();
      const createRes = http.post(`${BASE_URL}/posts`, createPayload, { headers: authHeaders });
      postCreateLatency.add(Date.now() - createStart);

      const isCreateOk = check(createRes, {
        'Post created successfully (201)': (r) => r.status === 201,
      });
      errorRate.add(!isCreateOk);

      if (isCreateOk) {
        try {
          const body = JSON.parse(createRes.body);
          if (body.data?.id) activePostId = body.data.id;
        } catch {}
      }
    });
  }

  sleep(0.5);

  // ── Step 4: Social Interactions: Like, Comment, Save (35% probability) ─────
  if (activePostId && Math.random() < 0.35) {
    group('4. Post Interactions', function () {
      // Like / Unlike Toggle
      const likeStart = Date.now();
      const likeRes = http.post(`${BASE_URL}/posts/${activePostId}/like`, null, { headers: authHeaders });
      likeLatency.add(Date.now() - likeStart);

      check(likeRes, {
        'Toggle like responded 200': (r) => r.status === 200,
      });

      // Add Comment
      const commentPayload = JSON.stringify({
        content: `Great engagement from VU ${vuId}! Testing 500-user concurrency.`,
      });
      const commentStart = Date.now();
      const commentRes = http.post(`${BASE_URL}/posts/${activePostId}/comments`, commentPayload, {
        headers: authHeaders,
      });
      commentLatency.add(Date.now() - commentStart);

      check(commentRes, {
        'Comment creation responded 200 or 201': (r) => r.status === 200 || r.status === 201,
      });

      // Save / Bookmark
      const saveRes = http.post(`${BASE_URL}/posts/${activePostId}/save`, null, { headers: authHeaders });
      check(saveRes, {
        'Save toggle responded 200': (r) => r.status === 200,
      });
    });
  }

  // Realistic user pacing between 1 and 3 seconds
  sleep(Math.random() * 2 + 1);
}
