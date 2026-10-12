# KnotNex — Capacity Planning

## Traffic Model & Assumptions

### User Tiers
| Scenario | Users | Description |
|---|---|---|
| Current | 5,000 | Initial registered users |
| Near-term target | 50,000 DAU | 6-month goal |
| Long-term planning | 500,000 DAU | Architecture capacity target |

### Traffic Assumptions (documented, not measured)
| Assumption | Value | Basis |
|---|---|---|
| API calls per active user per session | 50-80 | Social app benchmark |
| Average session duration | 20 min | Assumed |
| Peak hour concentration | 20% traffic in 1 hour | Evening primetime |
| Cache hit ratio (target) | 60-70% for feed | Redis caching |
| Concurrent sessions (peak) | 2% of DAU | Conservative estimate |
| recordView calls per session | 20-50 posts viewed | Scroll depth |

---

## RPS Calculations

### Current (5,000 users)
- DAU: 5,000 (all registered users active)
- Sessions/day: ~3 per user avg = 15,000 sessions/day
- API calls/session: 60 avg
- Total daily API calls: 900,000
- Average RPS: 900,000 / 86,400 = ~10.4 RPS
- Peak hour RPS (20% traffic): 900,000 x 0.20 / 3600 = ~50 RPS
- Peak burst (3x): ~150 RPS
- DB queries/RPS (avg 3 queries/req): ~450 queries/sec at peak

### 50,000 DAU
- Total daily API calls: 9,000,000
- Average RPS: ~104 RPS
- Peak RPS: ~500 RPS
- Peak burst: ~1,500 RPS
- DB queries at peak: ~4,500 queries/sec

### 500,000 DAU (long-term planning target)
- Total daily API calls: 90,000,000
- Average RPS: ~1,042 RPS
- Peak RPS: ~5,000 RPS
- Peak burst (viral event): ~15,000 RPS
- DB queries at peak: ~15,000-45,000 queries/sec (requires read replicas + caching)

---

## Infrastructure Requirements by Tier

### Current (5,000 DAU) -- Immediate
| Resource | Current | Required | Gap |
|---|---|---|---|
| Cloud Run instances | Unknown (no max set) | Max=5, Min=1 | Set limits |
| DB connections | Max=20/instance x ? | 50 connections total | Pool sizing |
| Redis | Not connected | 1x Memorystore Basic | Missing |
| DB instance size | Unknown | db-f1-micro or db-g1-small | Verify |

### Near-term (50,000 DAU)
| Resource | Required |
|---|---|
| Cloud Run instances | Max=10, Min=2 |
| DB connections | 100 max total (10 instances x 10 pool) |
| DB instance | db-custom-2-3840 (2vCPU, 3.84GB) |
| Redis (Memorystore) | Basic, 1GB |
| CDN (Cloud CDN) | For media assets |

### Long-term (500,000 DAU)
| Resource | Required |
|---|---|
| Cloud Run instances | Max=100, Min=5 |
| DB primary | db-custom-8-30720 (8vCPU, 30GB) |
| DB read replicas | 2-3 replicas |
| Connection pooler | Cloud SQL Auth Proxy + PgBouncer |
| Redis (Memorystore) | Standard HA, 5GB+ |
| CDN | Cloud CDN + Cloud Armor |
| DB connections | 300+ (via PgBouncer multiplexing) |

---

## Database Connection Budget

Cloud SQL default max_connections (db-g1-small): ~200
Cloud SQL default max_connections (db-custom-2): ~400

### Immediate (10 instances max x 10 connections each)
- Total max connections: 100
- System reserved: 10
- Available for app: 90
- Safe with db-g1-small (200 max): YES

### Near-term (25 instances x 10 connections)
- Total max connections: 250
- Requires db-custom-2 or PgBouncer

### Long-term (100 instances)
- Requires PgBouncer connection pooler
- PgBouncer: 100 app connections -> 50 real DB connections (transaction mode)
- DB instance: db-custom-8 with 400+ max_connections

---

## Cache Requirements

| Data Type | TTL | Size Estimate | Redis Memory |
|---|---|---|---|
| Feed page (per user) | 2 min | 50KB x 5000 users | 250MB |
| User auth/ban status | 5 min | 200B x 5000 | 1MB |
| Public org profiles | 15 min | 5KB x 1000 orgs | 5MB |
| Public event listings | 10 min | 10KB x 500 events | 5MB |
| Search results | 5 min | 20KB x common queries | 10MB |
| Total estimated | - | - | ~271MB |

Recommendation: Memorystore Basic, 1GB (allows 3x headroom for 500K DAU growth)

---

## Monthly Cost Estimates (INR approximate, asia-south1)

### Current Scale (5K DAU)
| Resource | Cost/month |
|---|---|
| Cloud Run (5 instances, 256MB, 0.083 vCPU) | ~INR 800 |
| Cloud SQL db-g1-small | ~INR 2,000 |
| Redis Memorystore Basic 1GB | ~INR 2,500 |
| GCS storage (media) | ~INR 500 |
| Cloud CDN | ~INR 200 |
| **Total** | **~INR 6,000/month** |

### Near-term Scale (50K DAU)
| Resource | Cost/month |
|---|---|
| Cloud Run (10 instances, 512MB, 0.167 vCPU) | ~INR 4,000 |
| Cloud SQL db-custom-2-3840 | ~INR 8,000 |
| Redis Memorystore Basic 1GB | ~INR 2,500 |
| GCS + CDN | ~INR 3,000 |
| **Total** | **~INR 17,500/month** |

### Long-term Scale (500K DAU)
| Resource | Cost/month |
|---|---|
| Cloud Run (100 instances) | ~INR 40,000 |
| Cloud SQL db-custom-8-30720 + 2 replicas | ~INR 60,000 |
| Redis Memorystore Standard HA 5GB | ~INR 15,000 |
| GCS + CDN + Armor | ~INR 20,000 |
| PgBouncer (Cloud Run) | ~INR 2,000 |
| **Total** | **~INR 137,000/month** |

All estimates are approximate and must be verified using GCP Pricing Calculator.
