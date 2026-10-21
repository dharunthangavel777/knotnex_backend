# KnotNex Backend — Low-Cost 3-Service GCP Architecture

## 1. Overview
KnotNex backend has been migrated from an enterprise multi-tier architecture to an optimized, low-cost **3-Service GCP Architecture** designed for high efficiency, high availability, and minimal idle cost (down to ~₹2,640–₹3,720/month / ~$32–$45/mo).

- **GCP Project ID**: `lively-welder-512304-n4`
- **Region**: `asia-south1` (Mumbai)
- **Primary Database**: Google Cloud SQL PostgreSQL (`34.93.172.107`)
- **API URL**: `https://api.knotnex.com` / Cloud Run URL

---

## 2. Active Cloud Resources

| Service | Tier / Spec | Primary Role | Cost Model |
|---|---|---|---|
| **Google Cloud Run** | 1 vCPU, 1 GiB RAM, 0 to 5 instances, 40 concurrency | Unified Express & Socket.IO API | Scales to zero when idle; ₹0 base cost |
| **Google Cloud SQL** | PostgreSQL 15, `db-g1-small` (1 vCPU, 1.7 GB RAM) | Primary relational datastore (22 tables) | Flat monthly managed instance (~₹2,400/mo) |
| **Google Cloud Storage** | Standard Storage (`knotnex-media-prod`, `knotnex-private-prod`) | User uploads, verification docs, avatars | Pay-per-GB (~₹200/mo) |
| **Firebase Auth & Firestore** | Spark / Blaze Free Tier | Auth provider + Real-time presence/chat mirror | Free tier covers pilot scale |
| **Brevo (Sendinblue)** | Free Tier | Email OTP, transactional emails (300/day free) | Free tier |

---

## 3. What Was Removed & Why

1. **Redis / Memorystore**
   - **Saved**: ₹2,500 – ₹15,000 / month
   - **Replacement**: Built-in in-memory Maps with TTL for OTP verification, token revocation, and Express built-in in-memory rate limiting. `isRedisReady()` safe no-op stub is retained in `src/config/redis.ts`.
2. **Google Cloud Pub/Sub**
   - **Saved**: ₹200 – ₹1,500 / month
   - **Replacement**: Pub/Sub events are safely skipped via no-op in `src/integrations/gcp/pubsub.gcp.ts`.
3. **Serverless VPC Access Connector**
   - **Saved**: ₹1,000 – ₹3,500 / month
   - **Replacement**: Cloud SQL Auth Connector (`--add-cloudsql-instances`) connects directly over Google's internal secure proxy without needing a dedicated VPC connector.
4. **Cloud CDN & Cloud Armor**
   - **Saved**: ₹200 – ₹15,000 / month
   - **Replacement**: Standard Cloud Run built-in DDoS protection and HTTPS terminates automatically.

---

## 4. Re-Enabling Services at Scale

When user traffic scales beyond 5,000 daily active users:
- **To re-enable Redis**:
  1. Provision a Memorystore Redis instance.
  2. Set `REDIS_URL` in `.env`.
  3. Re-install `ioredis` and `rate-limit-redis`.
  4. Replace `src/config/redis.ts` with the active Redis connection client.
- **To re-enable Pub/Sub**:
  1. Install `@google-cloud/pubsub`.
  2. Restore the publisher in `src/integrations/gcp/pubsub.gcp.ts`.
  3. Set `PUBSUB_PROJECT_ID=lively-welder-512304-n4`.
