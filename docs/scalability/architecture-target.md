# KnotNex — Target Production Architecture

**Scale Target:** 5,000 Concurrent Rapid Users | 500,000 Daily Active Users (5 Lakh DAU)  
**Status:** Architecture Blueprint  
**Date:** 2026-10-12  

---

## 1. High-Level Architecture Diagram

```
                                      [ Mobile Clients (Flutter) ]
                                                   │
                                                   ▼
                                       [ Cloudflare / Cloud Armor ]
                                 (DDoS Shield, WAF, Edge SSL, Rate Limiting)
                                                   │
                                                   ▼
                                        [ GCP Cloud CDN ]
                                 (Static Assets, Media Thumbnails, Images)
                                                   │
                                                   ▼
                                    [ Serverless VPC Connector ]
                                                   │
                                                   ▼
                                   [ Cloud Run Service Cluster ]
                                  (Auto-scales: min 3, max 25-50)
                                 (2 vCPU, 2GB RAM, concurrency: 80)
                                    /              |              \
                                   /               |               \
                                  ▼                ▼                ▼
                     [ Redis Memorystore HA ]  [ Cloud Pub/Sub ]  [ PgBouncer Pooler ]
                       - User/IP Rate Limits     - Async Views       (Max Conn: 150)
                       - Auth User Token Cache   - Notifications            │
                       - Feed Cache (TTL 30s)    - Analytics                ▼
                       - Distributed Locks                          [ Cloud SQL Postgres ]
                                                                     (db-custom-4-16384)
                                                                     (1 Primary + 1 Replica)
```

---

## 2. Infrastructure Dimensioning & Sizing

### 2.1 GCP Cloud Run Sizing
| Parameter | Development/Staging | Current Production Issue | Target Production (5K CCU / 500K DAU) |
|---|---|---|---|
| **Min Instances** | 0 | 0 (Cold starts: 3-8s latency spike) | **3 instances** (Always warm, zero cold start) |
| **Max Instances** | 2 | Not set (unlimited, can crash DB) | **25 instances** (Hard cap to protect downstream DB) |
| **Concurrency** | 80 | 80 | **80** (Optimal for Node.js event-loop I/O) |
| **CPU Allocation** | 1 vCPU | 1 vCPU | **2 vCPU** (Prevents event-loop stalls under JSON parse) |
| **Memory** | 512 MB | 512 MB (OOM risk on multipart upload) | **2 GB** |
| **CPU Throttling** | Enabled | Enabled | **Disabled** (CPU always allocated for background async tasks) |
| **VPC Connector** | Not configured | Direct public or incomplete | **Serverless VPC Access Connector** (Private IP to Redis & Cloud SQL) |

### 2.2 Google Cloud Memorystore (Redis)
- **Tier:** Standard (High Availability with automatic failover)
- **Version:** Redis 7.x
- **Memory Capacity:** 5 GB (Initial), scalable to 10 GB
- **Eviction Policy:** `volatile-lru` (Evict keys with TTL when memory fills up)
- **Network:** Private Service Access / Direct VPC peering (Zero public internet latency)

### 2.3 Cloud SQL (PostgreSQL 15+)
- **Primary Instance:** `db-custom-4-16384` (4 vCPU, 16 GB RAM) with SSD storage (automatic storage increase enabled)
- **Read Replica:** 1x `db-custom-4-16384` dedicated for search, read-only analytics, and heavy feed queries
- **Connection Management:** PgBouncer running either as sidecar or Cloud SQL Auth Proxy with connection limits:
  - Max pool per Cloud Run instance: **6 connections** (25 instances × 6 = 150 connections max, well within PostgreSQL limits)
  - Statement timeout: `statement_timeout = '5000'` (5 seconds max to kill runaway queries)
  - Idle transaction timeout: `idle_in_transaction_session_timeout = '10000'` (10 seconds)

---

## 3. Multi-Layer Rate Limiting System

### Layer 1: Edge (Cloud Armor / CDN)
- Filters layer 7 volumetric attacks before reaching Cloud Run.
- IP rate limit: 120 req/min per IP across the edge.
- Request payload ceiling: 15 MB.

### Layer 2: API Gateway / Reverse Proxy Rate Limiting
- Handles TLS termination and basic bot filtering.
- Provides initial header inspection (`X-Forwarded-For`, `Authorization`).

### Layer 3: Application Distributed Rate Limiting (Redis Sliding Window)
- **Dual-Key Strategy:**
  1. **Unauthenticated / Public routes:** Key = `rl:ip:<client_ip>:<route_group>`
  2. **Authenticated routes:** Key = `rl:user:<user_id>:<route_group>`
- **Fail-Open with Local Fallback:** If Redis is temporarily unreachable, fall back to relaxed local LRU cache (never hard-crash user requests, log P1 alert).
- **HTTP 429 Payload Structure:**
```json
{
  "success": false,
  "code": "TOO_MANY_REQUESTS",
  "message": "Too many requests. Please slow down and try again.",
  "retryAfter": 12,
  "limit": 60,
  "remaining": 0,
  "resetTime": "2026-10-12T11:30:15.000Z"
}
```

---

## 4. Asynchronous High-Volume Ingestion (View Tracking)

### The Problem:
5,000 rapid users scrolling 20 posts generates **100,000 view write operations** in minutes. Direct synchronous DB `INSERT INTO post_views` and `UPDATE posts SET views_count = views_count + 1` locks post rows and exhausts DB pools.

### Target Solution:
1. **Flutter Client Batching:** Client collects viewed post IDs in a memory queue and flushes every 10 seconds or every 20 viewed posts:
   `POST /api/v1/posts/views/batch` with payload `{"postIds": ["uuid1", "uuid2", ...]}`
2. **Redis Ingestion Counter:**
   - Instead of immediate DB update, increment Redis hyperloglog or counter:
     `HINCRBY post:views:<date> <postId> 1`
     `SADD post:unique_views:<postId> <userId>`
3. **Scheduled Flush Worker:**
   - Every 60 seconds, worker pulls view deltas and executes a bulk batch update:
     `UPDATE posts SET views_count = views_count + data.delta FROM ...`
   - Bulk insert view records into partitioned `post_views` table.
   - Result: 100,000 DB writes reduced to **1 bulk write every minute**.
