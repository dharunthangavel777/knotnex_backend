# KnotNex — Production Scalability, Rate Limiting & High-Traffic Master Plan

**Target Scale:** 5,000 Rapid Concurrent Users (CCU) | 500,000 Daily Active Users (5 Lakh DAU)  
**Target Throughput:** 500 to 1,500 RPS Peak Burst  
**Author:** Antigravity Senior Backend & Infrastructure Architect  
**Status:** Approved for Execution  
**Date:** 2026-10-12  

---

## 1. Executive Summary

During high-traffic periods, KnotNex users experience widespread `429 Too Many Requests` errors and intermittent service degradation. A comprehensive engineering audit of both the Node.js backend (`knotnex_backend`) and Flutter mobile app (`knotnex`) identified **10 confirmed root causes**:

1. **RC-1 (CRITICAL):** A single global IP-based rate limiter (100 req / 15 min) wraps all routes indiscriminately. Mobile carrier NAT networks (e.g., Jio, Airtel) aggregate thousands of users under shared IPs, triggering immediate 429 lockouts.
2. **RC-2 (CRITICAL):** When Redis is offline or partitioned, Cloud Run falls back to per-instance in-memory limiters, desynchronizing limits across auto-scaled instances.
3. **RC-3 (HIGH):** The feed query `POST_SELECT` runs 8 correlated subqueries per post row ($N \times 8$), generating ~160 queries per page load and exhausting database CPU.
4. **RC-4 (HIGH):** Flutter dispatches individual `POST /api/v1/posts/:id/view` requests on every post scrolled into view, creating write-request storms.
5. **RC-5 (HIGH):** Authentication middleware performs a synchronous `SELECT FROM users` query on every authenticated request without caching.
6. **RC-6 (HIGH):** Cloud Run instance limits (`--max-instances`) are unconstrained, creating an existential risk of exhausting Cloud SQL connections.
7. **RC-7 (MEDIUM):** Flutter `FeedProvider` lacks lifecycle guards, triggering redundant feed refetches on navigation and rebuilds.
8. **RC-8 (MEDIUM):** Rapid taps on Like/Save/Share lack debouncing or in-flight deduplication.
9. **RC-9 (LOW):** Express `json()` body parser globally accepts 10MB payloads on all endpoints including auth.
10. **RC-10 (LOW):** Signup OTP endpoint was erroneously mapped to the login rate limiter (20/15 min instead of 5/15 min).

This Master Plan details the phased execution strategy to upgrade KnotNex to support **5,000 concurrent users** and **500,000 daily active users**.

---

## 2. Master Plan Reference Documents

| Document | Purpose |
|---|---|
| [audit-report.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/audit-report.md) | Full audit of code flaws, file paths, line numbers, and severities |
| [rate-limit-policy.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/rate-limit-policy.md) | Complete rate limit matrix across IP, User ID, and endpoints |
| [capacity-planning.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/capacity-planning.md) | Traffic modeling, RPS math, compute, memory, and database sizing |
| [architecture-target.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/architecture-target.md) | Target Cloud Run, Redis HA, PgBouncer, and Cloud Armor architecture |
| [redis-design.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/redis-design.md) | Redis key namespaces, sliding-window Lua script, and cache design |
| [database-optimization.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/database-optimization.md) | SQL query rewrites, index audit, and connection pool sizing |
| [client-resilience.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/client-resilience.md) | Flutter 429 Retry-After handling, view batching, and interaction debouncing |
| [monitoring-alerting.md](file:///c:/flutter/%20projects/Knotnex/knotnex_backend/docs/scalability/monitoring-alerting.md) | Telemetry, SLOs, Cloud Monitoring alerts, and health checks |

---

## 3. Phased Implementation Roadmap

```
Phase 0: P0 Hotfixes (Immediate)
├── Cap Cloud Run max-instances to 25
├── Replace global IP limiter with User-ID rate limiter
└── Fix OTP rate limiter assignment
        │
Phase 1: Backend Rate Limiting & Query Optimization
├── Implement Redis sliding window rate limiter (Lua script)
├── Cache auth user lookups in Redis (TTL: 5 min)
├── Rewrite POST_SELECT to eliminate 8 correlated subqueries
└── Add batch view recording endpoint (/posts/views/batch)
        │
Phase 2: Flutter Client Resilience
├── Implement 429 Retry-After interceptor with jitter
├── Implement ViewTrackingService (10s / 25-post batching)
├── Add interaction debounce & optimistic UI to FeedProvider
└── Add FeedProvider fetch lifecycle guard
        │
Phase 3: Database & Cloud Infrastructure Hardening
├── Add missing PostgreSQL compound indexes
├── Configure PgBouncer connection multiplexer
├── Tune Cloud SQL memory flags & timeouts
└── Deploy Cloud Run VPC connector to Redis Memorystore
        │
Phase 4: Load Testing & Production Rollout
├── Execute k6 load tests (simulating 5,000 virtual users)
├── Canary deployment (10% traffic -> 50% -> 100%)
└── Activate Cloud Monitoring alert policies
```

---

## 4. Phase-by-Phase Technical Specifications

### Phase 0: Immediate P0 Hotfixes
1. **Cloud Run Instance Cap (`cloudbuild.yaml`):**
   Add `--max-instances=25 --min-instances=3 --concurrency=80` to prevent database connection exhaustion.
2. **User-ID Rate Limiter (`rateLimiter.middleware.ts`):**
   Modify rate limiting key generator:
   ```typescript
   keyGenerator: (req) => {
     if (req.user && req.user.id) {
       return `user:${req.user.id}`;
     }
     return req.ip || req.socket.remoteAddress || 'anonymous';
   }
   ```
3. **Correct OTP Rate Limiter:** Ensure `/auth/initiate-signup` uses `authOtpRateLimiter` (5 per 15 min).

### Phase 1: Backend Optimization
1. **Redis Sliding Window Limiter:** Deploy atomic Lua script for precise sliding window calculation with standard `X-RateLimit-*` and `Retry-After` headers.
2. **Auth Token Caching:** In `auth.middleware.ts`, check `auth:user:{uid}` in Redis first. On cache miss, fetch from PostgreSQL and store with 300s TTL.
3. **Eliminate N+1 Subqueries in `post.service.ts`:**
   Add denormalized counters on `posts` and query user like/save statuses via `LEFT JOIN` in a single query pass.
4. **Batch View Recording Endpoint:** Create `POST /api/v1/posts/views/batch` accepting `{ postIds: string[] }`.

### Phase 2: Flutter Client Resilience
1. **Smart Rate Limit Interceptor:** In `api_client.dart`, intercept HTTP 429 responses, inspect `Retry-After` header, calculate backoff with jitter, and retry once.
2. **View Tracking Buffer:** In `feed_provider.dart`, replace direct calls to `recordView` with `ViewTrackingService.instance.trackPostView(postId)`.
3. **Action Debouncing:** Add in-flight boolean maps for `toggleLike`, `toggleSave`, and `sharePost`.

### Phase 3: Database & Infrastructure Hardening
1. **Database Connection Formula:**
   $$25 \text{ Cloud Run instances} \times 5 \text{ pool connections} = 125 \text{ connections max}$$
   Configure PostgreSQL `max_connections = 200` and statement timeout of 5,000ms.
2. **Database Indexes:** Deploy migration adding `idx_posts_created_at_desc`, `idx_post_likes_post_user`, and `idx_post_views_post_user`.

### Phase 4: Load Testing & Verification
1. **Load Test Script (`load-test-5k.js`):**
   Simulate 5,000 concurrent virtual users executing realistic usage patterns (80% feed scroll, 10% post interactions, 5% profile view, 5% search).
2. **Success Gate:**
   - 95th percentile latency < 350ms
   - 99th percentile latency < 750ms
   - HTTP 429 rate < 0.2% under normal simulated traffic
   - Zero database connection errors.

---

## 5. Rollback & Emergency Runbook

| Failure Mode | Trigger | Emergency Action |
|---|---|---|
| **Redis Outage** | Health check fails on Redis PING | Middleware automatically falls open with local memory limiter; alert P1 SRE |
| **Database Lock Spike** | Cloud SQL active queries > 100 | Run `SELECT pg_terminate_backend(pid)` on long-running queries; scale down non-critical workers |
| **False Positive 429s** | HTTP 429 rate > 5% on mobile release | Bump User-ID rate limit windows by 3x via Redis config flag without redeployment |
