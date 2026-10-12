# KnotNex — Audit Report
**Date:** 2026-10-12  
**Auditor:** Antigravity AI Architect  
**Scope:** Full codebase audit of `knotnex_backend` (Node.js/Express) and `knotnex` (Flutter)

---

## Executive Summary

The KnotNex platform is experiencing rate-limit errors across multiple users simultaneously. This audit found **ten confirmed root causes** ranging from a single global IP-based rate limiter to N+1 SQL queries on every feed page load, to Flutter making DB-hitting view-recording calls on every scroll event.

The platform is **not production-ready for 5,000 concurrent users** under the current architecture. However, the foundation (Redis already integrated, pg pool configured, Cloud Run deployed) is solid and fixes are achievable in phases.

---

## 1. Existing Architecture

```
Flutter App
  └─ ApiClient (http package, 15s timeout, single-flight token refresh)
       └─ GCP Cloud Run (asia-south1)
            └─ knotnex-backend (Node/Express/TypeScript)
                 ├─ express-rate-limit (IP-only, in-memory fallback when Redis offline)
                 ├─ PostgreSQL 20-connection pool (Cloud SQL)
                 ├─ Redis / Memorystore (rate-limit store, OTP cache)
                 ├─ Firebase Auth (token verification)
                 ├─ GCS (media storage)
                 ├─ Pub/Sub (notification fan-out)
                 └─ Socket.IO (real-time chat)
```

### Cloud Run Configuration (as found in cloudbuild.yaml)
- Region: `asia-south1`
- Min instances: NOT SET (defaults to 0 — cold starts guaranteed)
- Max instances: NOT SET (unlimited — no downstream protection)
- Concurrency: NOT SET (defaults to 80)
- CPU/Memory: NOT SET (defaults to 1 vCPU / 512 MB)

---

## 2. Confirmed Root Causes

### RC-1 (CRITICAL): Single global IP rate limiter — 100 req/15 min shared across ALL routes
**File:** `src/middleware/rateLimiter.middleware.ts` lines 46–61  
**File:** `src/app.ts` line 40

Every authenticated user behind a shared IP (mobile carrier NAT, corporate Wi-Fi, university network) shares a single 100-request bucket. When 5–10 users share an IP, the bucket depletes in minutes.

**Reproduction:** 10 users on the same 4G carrier — each loads feed (1 req) + views 10 posts (10 view reqs) = 110 requests — ALL 10 users get 429 immediately.

**Severity:** CRITICAL — Confirmed root cause of widespread rate-limit errors.

---

### RC-2 (CRITICAL): Redis falls back to per-instance in-memory limiter when offline
**File:** `src/config/redis.ts` lines 9–16  
**File:** `src/middleware/rateLimiter.middleware.ts` lines 11–15

When Redis is offline or unreachable, each Cloud Run instance maintains its own counter. With multiple instances, each user gets 100 req/15 min PER INSTANCE — rate limiting is effectively disabled.

**Severity:** CRITICAL — Rate limiting is not shared across instances when Redis is down.

---

### RC-3 (HIGH): N+1 subquery fan-out in POST_SELECT — 8 extra DB queries per post row
**File:** `src/services/post.service.ts` lines 9–42

The POST_SELECT helper embeds 8 correlated subqueries per post row. A feed page of 20 posts executes ~160–200 SQL statements. With 50 concurrent users loading the feed, this creates 8,000–10,000 DB queries per minute.

**Severity:** HIGH — Major database resource consumer.

---

### RC-4 (HIGH): Every post scroll triggers a recordView API call from Flutter
**File:** `knotnex/lib/features/home/providers/feed_provider.dart` lines 320–326

The backend recordView fires 2 DB queries per call (INSERT + UPDATE). A user scrolling 20 posts fires 20 POST requests in rapid succession.

**Severity:** HIGH — Request storm generator.

---

### RC-5 (HIGH): Auth middleware does a DB lookup on EVERY authenticated request
**File:** `src/middleware/auth.middleware.ts` lines 46–50

Every API request fires a SELECT FROM users query. At 50 RPS, this is 50 extra DB queries/second from auth alone.

**Severity:** HIGH — Silent DB resource drain on every request.

---

### RC-6 (HIGH): Cloud Run max instances not capped — no downstream connection budget
**File:** `cloudbuild.yaml` lines 21–29 — no --max-instances flag

Cloud Run can autoscale to dozens of instances. Each instance has a pool of up to 20 connections. 10 instances x 20 connections = 200 connections to PostgreSQL. Cloud SQL default max_connections is typically 100–200. At 15+ instances, new connections fail.

**Severity:** HIGH — Will cause total DB outage under sustained load.

---

### RC-7 (MEDIUM): FeedProvider calls fetchFeed() in constructor without lifecycle guard
**File:** `knotnex/lib/features/home/providers/feed_provider.dart` lines 19–21

If FeedProvider is not properly kept alive, it may be recreated on navigation, triggering multiple redundant feed requests.

**Severity:** MEDIUM — Potential duplicate requests from navigation events.

---

### RC-8 (MEDIUM): toggleLike/toggleSave/sharePost — no debounce or in-flight deduplication
**File:** `knotnex/lib/features/home/providers/feed_provider.dart` lines 213–318

Rapid taps fire multiple POST requests simultaneously. No in-flight check prevents duplicate toggle calls.

**Severity:** MEDIUM — Duplicate write operations possible.

---

### RC-9 (LOW-MEDIUM): Body parser limit is 10MB for all routes including auth
**File:** `src/app.ts` line 28

An attacker can POST 10MB JSON to any endpoint. At scale, this is a memory exhaustion vector.

**Severity:** LOW-MEDIUM — Security and resource concern.

---

### RC-10 (LOW): Auth routes use wrong rate limiter for OTP send endpoint
**File:** `src/routes/auth.routes.ts` lines 10–11

OTP sending is limited at 20/15min (signin limit) instead of the intended 5/15min (OTP limit). SMS/email cost exposure.

**Severity:** LOW — Incorrect rate-limit policy applied.

---

## 3. Missing Protections Summary

| Protection | Status |
|---|---|
| User-ID based rate limiting | NOT implemented |
| Endpoint-specific rate limits | NOT implemented |
| Feed/read endpoint limits | No limit (expensive DB) |
| Upload size limits per endpoint | 10MB applied globally |
| Request ID / correlation ID | Not in all responses |
| Auth middleware user caching | No cache (DB hit every request) |
| DB statement timeout | Not configured |
| Cloud Run min instances | Not set (cold starts) |
| Cloud Run max instances | Not set (no connection budget) |
| Flutter exponential backoff | Not implemented |
| Flutter 429 / Retry-After handling | Not implemented |

---

## 4. Proposed Fix Priority

| Priority | Fix | Effort |
|---|---|---|
| P0 | User-ID rate limiting replacing IP-only | 2h |
| P0 | Hard-cap Cloud Run max-instances | 30m |
| P0 | Fix OTP rate limiter assignment | 30m |
| P1 | POST_SELECT query rewrite (use denormalized counts) | 4h |
| P1 | recordView client-side debounce + batch | 2h |
| P1 | Auth middleware user cache (Redis TTL 60s) | 3h |
| P1 | Endpoint-specific rate-limit policies | 3h |
| P2 | Body parser per-route limits | 1h |
| P2 | Flutter 429 handling + Retry-After | 2h |
| P2 | Flutter interaction debouncing | 2h |
| P3 | DB index audit and slow-query analysis | 4h |
| P3 | Feed caching layer with Redis | 6h |
