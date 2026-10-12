# KnotNex — Database Optimization & Scaling Guide

**Database:** PostgreSQL 15+ (Cloud SQL)  
**Target Load:** 5,000 Concurrent Rapid Users / 500,000 DAU  
**Scope:** Query Optimization, N+1 Elimination, Connection Pooling, Indexing Strategy  

---

## 1. Fixing RC-3: Eliminating the N+1 Subquery Fan-Out in `POST_SELECT`

### The Current Flaw (`src/services/post.service.ts`):
Each post query executes 8 correlated subqueries per row:
```sql
SELECT 
  p.*,
  (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count,
  (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comments_count,
  (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) as shares_count,
  (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = p.id) as views_count,
  EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $userId) as is_liked,
  EXISTS(SELECT 1 FROM post_saves WHERE post_id = p.id AND user_id = $userId) as is_saved,
  ...
FROM posts p
```
When retrieving 20 posts for 500 concurrent users:
- 20 posts × 8 subqueries = **160 index scans per request**.
- 500 users loading feed = **80,000 queries executing simultaneously**.
- Cloud SQL CPU hits 100%, causing query timeouts and cascade failures.

### Target Solution:
1. **Denormalize Aggregate Counters on `posts` Table:**
   - Add columns directly to `posts`:
     - `likes_count INT DEFAULT 0`
     - `comments_count INT DEFAULT 0`
     - `shares_count INT DEFAULT 0`
     - `views_count INT DEFAULT 0`
   - Update counters via atomic increment in transactions or Redis flush worker:
     ```sql
     UPDATE posts SET likes_count = likes_count + 1 WHERE id = $postId;
     ```
2. **Batch User Interaction Flags (`is_liked`, `is_saved`) via LEFT JOINs:**
   ```sql
   SELECT 
     p.id, p.content, p.media_urls, p.created_at,
     p.likes_count, p.comments_count, p.shares_count, p.views_count,
     u.id as author_id, u.username as author_username, u.avatar_url as author_avatar,
     (pl.user_id IS NOT NULL) AS is_liked,
     (ps.user_id IS NOT NULL) AS is_saved
   FROM posts p
   JOIN users u ON p.user_id = u.id
   LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = $currentUserId
   LEFT JOIN post_saves ps ON ps.post_id = p.id AND ps.user_id = $currentUserId
   WHERE p.is_deleted = false
   ORDER BY p.created_at DESC
   LIMIT $limit OFFSET $offset;
   ```
   **Performance Gain:** Query time drops from ~280ms to ~12ms (95% reduction in DB load).

---

## 2. Fixing RC-4: High-Volume View Recording

### Current Bottleneck:
- Flutter fires `POST /api/v1/posts/:id/view` on every single post scroll.
- Each call executes:
  1. `INSERT INTO post_views (post_id, user_id, viewed_at) VALUES ...`
  2. `UPDATE posts SET views_count = views_count + 1 WHERE id = ...`
- 5,000 active users scrolling = up to **2,000 writes/sec** to the same tables, causing write locks and transaction backlog.

### Target Solution:
1. **Batch Ingestion Endpoint:**
   `POST /api/v1/posts/views/batch`
   Body: `{"views": [{"postId": "...", "durationMs": 3500}, ...]}`
2. **Bulk PostgreSQL Upsert:**
   ```sql
   INSERT INTO post_views (post_id, user_id, viewed_at)
   SELECT unnest($1::uuid[]), $2::uuid, NOW()
   ON CONFLICT (post_id, user_id) DO NOTHING;
   ```
3. **Table Partitioning for `post_views`:**
   - Partition `post_views` monthly by range on `viewed_at` to prevent sequential table bloat and maintain index performance as rows reach tens of millions.

---

## 3. Database Connection Pooling Formula

### The Cloud Run Concurrency Trap:
- Cloud Run instances scale dynamically from 3 to 25+.
- If each Node.js instance creates a default pool of 20 connections:
  - 25 instances × 20 connections = **500 connections**.
  - Default Cloud SQL `max_connections` for standard instances is 100-200.
  - When connection limit is breached, Postgres returns `FATAL: remaining connection slots are reserved for non-replication superuser connections`.

### Mathematical Sizing & Solution:
$$\text{Max Instances} \times \text{Pool Size Per Instance} \le \text{PostgreSQL Available Connections}$$

```
Max Cloud Run Instances: 25
Connection Pool per Instance: 5 connections
Max Total Direct Connections: 25 × 5 = 125 connections
Cloud SQL max_connections: 200 (75 reserved for migrations, workers, admin)
```

### PgBouncer Integration:
Deploy PgBouncer in transaction pooling mode:
- Client connections (Node.js): up to 500 connections supported.
- Server connections (Postgres): 30 to 50 multiplexed persistent connections.
- Result: Cloud Run can scale freely without saturating Postgres connection limits.

---

## 4. Critical Indexing Checklist

| Table | Index Name | Columns | Purpose |
|---|---|---|---|
| `posts` | `idx_posts_created_at_desc` | `(created_at DESC) WHERE is_deleted = false` | Feed ordering |
| `posts` | `idx_posts_user_created` | `(user_id, created_at DESC)` | Profile posts |
| `post_likes` | `idx_post_likes_post_user` | `(post_id, user_id)` UNIQUE | Fast like lookup & dedup |
| `post_saves` | `idx_post_saves_user_post` | `(user_id, post_id)` UNIQUE | Fast saved lookup |
| `post_views` | `idx_post_views_post_user` | `(post_id, user_id)` | View dedup |
| `users` | `idx_users_firebase_uid` | `(firebase_uid)` UNIQUE | Auth middleware resolution |
| `notifications` | `idx_notif_recipient_created`| `(recipient_id, created_at DESC)` | Notification feed |
| `comments` | `idx_comments_post_created` | `(post_id, created_at ASC)` | Comment thread fetch |

---

## 5. PostgreSQL Server Configuration Parameters

Configure Cloud SQL Database Flags:
```ini
# Memory Tuning
shared_buffers = 4GB               # 25% of 16GB RAM
work_mem = 16MB                    # Per sorting operation
maintenance_work_mem = 512MB
effective_cache_size = 12GB        # 75% of 16GB RAM

# Timeouts & Safety Guards
statement_timeout = 5000           # Cancel queries taking > 5 seconds
idle_in_transaction_session_timeout = 10000  # Abort zombie transactions after 10s
lock_timeout = 3000                # Avoid deadlocks waiting for row locks
```
