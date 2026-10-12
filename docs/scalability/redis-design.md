# KnotNex — Redis Architecture & Data Design

**Component:** Redis / Memorystore HA Cluster  
**Scope:** Distributed Rate Limiting, High-Speed Caching, In-Memory Counters & Locks  
**Target Load:** 5,000 Concurrent Users / 500,000 DAU  

---

## 1. Redis Key Namespacing & TTL Policy

All Redis keys MUST follow strict colon-delimited hierarchical namespaces with deterministic TTLs:

| Category | Key Pattern | Data Structure | TTL | Purpose |
|---|---|---|---|---|
| **Rate Limiter (IP)** | `rl:ip:{ip}:{endpointGroup}` | Sorted Set (ZSET) or Hash | 1 min - 15 min | Sliding window rate count |
| **Rate Limiter (User)** | `rl:user:{userId}:{endpointGroup}` | Sorted Set (ZSET) or Hash | 1 min - 15 min | Per-user rate limiting |
| **Auth User Cache** | `auth:user:{firebaseUid}` | String (JSON) | 5 minutes | Avoids SELECT * FROM users on every API call |
| **User Profile Cache** | `cache:user:{userId}` | String (JSON) | 10 minutes | Fast user profile resolution |
| **Feed Page Cache** | `cache:feed:home:{userId}:{cursor}` | String (JSON) | 30 seconds | Fast scroll cache |
| **Explore / Trending** | `cache:feed:explore:page:{page}` | String (JSON) | 60 seconds | Shared cache for all explore viewers |
| **View Tracking Queue** | `queue:post:views` | Hash (`post_id` -> count) | No TTL (worker flushes every 60s) | Aggregates high-frequency post views |
| **Post Interaction Dedup**| `dedup:like:{userId}:{postId}` | String ("1") | 2 seconds | Prevents double-tap race conditions |
| **Distributed Lock** | `lock:{resourceName}:{resourceId}` | String (lockId) | 5 - 10 seconds | Redlock / single instance mutex for jobs |

---

## 2. Distributed Sliding Window Rate Limiting Algorithm

### Why Fixed Window / Token Bucket in memory fails:
- **Fixed Window:** Allows burst at boundary (e.g., 50 requests at 00:59 and 50 requests at 01:01 = 100 requests in 2 seconds).
- **Single Process In-Memory:** When Cloud Run scales to 20 instances, an in-memory limit allows 20x the configured volume.

### Sliding Window Log via Redis Lua Script
To execute atomicity in a single round-trip, we use a Redis Lua script:

```lua
-- KEYS[1]: Rate limit key (e.g., rl:user:12345:feed)
-- ARGV[1]: Current timestamp in ms (Date.now())
-- ARGV[2]: Window size in ms (e.g., 60000 for 1 min)
-- ARGV[3]: Max requests allowed in window (e.g., 20)

local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

-- 1. Remove old requests outside current window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- 2. Count current elements in window
local currentRequests = redis.call('ZCARD', key)

if currentRequests < limit then
    -- 3. Add current timestamp to sorted set
    redis.call('ZADD', key, now, now)
    -- 4. Set expiry to ensure key cleans up
    redis.call('PEXPIRE', key, window)
    return {1, limit - currentRequests - 1, 0} -- {allowed, remaining, retryAfterMs}
else
    -- 5. Calculate retry after time
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAfter = math.ceil((oldest[2] + window - now) / 1000)
    if retryAfter < 1 then retryAfter = 1 end
    return {0, 0, retryAfter} -- {blocked, remaining, retryAfterSeconds}
end
```

### Response Headers Standard:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when current bucket resets
- `Retry-After`: Seconds to wait before retrying (sent on 429)

---

## 3. High-Traffic Caching Strategy

### 3.1 Auth Middleware Optimization (RC-5 Fix)
Currently, `auth.middleware.ts` runs:
```sql
SELECT id, username, email, role, status FROM users WHERE firebase_uid = $1
```
On **every single authenticated request**. At 1,000 RPS, this causes **1,000 DB queries/sec** just for auth validation.

**Target Implementation:**
1. Check Redis: `GET auth:user:{firebaseUid}`
2. If hit: Parse JSON and attach `req.user = cachedUser` (latency < 1.5ms).
3. If miss: Query PostgreSQL, write to Redis with `SETEX auth:user:{firebaseUid} 300` (5 minutes TTL).
4. Invalidate key immediately whenever user updates profile or changes status: `DEL auth:user:{firebaseUid}`.

### 3.2 Feed Generation Caching
- Trending / Explore feed is global: cache for 60 seconds with `cache:feed:explore:page:{page}`.
- Home feeds: generate paginated cursor response and cache per user for 30 seconds: `cache:feed:home:{userId}:{cursor}`.
- When user creates a post, publish invalidation message to flush `cache:feed:home:{userId}:*`.

---

## 4. Memory Sizing & Eviction Budget

### Sizing Calculation for 500,000 DAU:
- **Active Users in 1-hour window:** ~50,000 users
- **Rate Limiting Keys:**
  - 50,000 users × 4 endpoint buckets × ~200 bytes per ZSET entry = ~40 MB
- **Auth User Cache:**
  - 50,000 active users × 500 bytes per record = ~25 MB
- **Feed Cache:**
  - 20,000 active sessions × 10 KB per feed page = ~200 MB
- **View Aggregation Buffer:**
  - 10,000 active posts × 100 bytes = ~1 MB
- **Total Operational Memory:** ~300 MB - 600 MB
- **Allocated Memorystore Sizing:** **5 GB Standard HA** (gives 8x headroom for peak surges, zero risk of memory thrashing).
- **Eviction Policy:** `volatile-lru` (Ensures unexpired rate limits and locks are preserved while stale read caches are safely evicted if memory crosses 80%).
