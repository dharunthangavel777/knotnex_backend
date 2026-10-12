# KnotNex — Rate Limit Policy Matrix
**Version:** 1.0  
**Environment:** Production  
**Note:** All values are proposed initial settings. Must be validated by load testing.

---

## Global Assumptions
- Concurrent users (peak): 2,500 (estimated 0.5% of 500K DAU active in any 15-min window)
- Authenticated users: 95% of traffic
- Shared IPs (NAT/carrier): up to 50 users per IP assumed
- Redis: Required for all distributed limits (in-memory only in dev/test)

---

## Layer A -- Edge (Cloud Armor / Load Balancer)
| Protection | Limit | Action |
|---|---|---|
| Global RPS | 10,000 RPS | Drop at edge |
| Per-IP RPS | 100 RPS | Throttle/block |
| Request body size | 20 MB max | Reject 413 |
| Malformed requests | Signature-based | Block |

---

## Layer B -- IP-Based Limits (All routes, anonymous fallback)

| Route Group | Window | Max Requests | Notes |
|---|---|---|---|
| Anonymous /api/* | 15 min | 200 per IP | Relaxed from 100 to allow shared IPs |
| Auth endpoints | 15 min | 20 per IP | Stricter for abuse prevention |
| OTP send | 15 min | 5 per IP | Unchanged -- appropriate |
| Password reset | 30 min | 3 per IP | Unchanged -- appropriate |
| Upload endpoints | 1 hour | 50 per IP | Large payload protection |

---

## Layer C -- Authenticated User Limits (by verified user ID from JWT/session)

| Route Group | Window | Max Requests | Burst | Notes |
|---|---|---|---|---|
| General API | 1 min | 60 per user | +20 | ~1 req/sec sustained |
| Feed/Reels | 1 min | 10 per user | +5 | Pagination prevents hammering |
| Post interactions (like/save/share) | 1 min | 30 per user | +10 | Normal social usage |
| View recording | 5 min | 100 per user | +20 | Batch-friendly |
| Comments (add) | 1 min | 10 per user | +5 | Anti-spam |
| Search | 1 min | 20 per user | +10 | |
| Upload | 1 hour | 20 per user | 0 | Rate expensive storage ops |
| Notification fetch | 1 min | 5 per user | +2 | |
| Token refresh | 15 min | 10 per user | 0 | Anti-storm |

---

## Layer D -- Endpoint-Specific Policies

### Authentication
| Endpoint | Method | Auth | User Limit | IP Limit | Burst | Cost | Notes |
|---|---|---|---|---|---|---|---|
| POST /auth/initiate-signup | POST | None | N/A | 5/15min | 0 | Medium | OTP send |
| POST /auth/verify-signup-otp | POST | None | N/A | 10/15min | 0 | Low | OTP verify |
| POST /auth/complete-signup | POST | None | N/A | 10/15min | 0 | Medium | |
| POST /auth/signup | POST | None | N/A | 10/15min | 0 | Medium | |
| POST /auth/signin | POST | None | N/A | 20/15min | 0 | Medium | authSigninRateLimiter |
| POST /auth/refresh | POST | None | 10/15min | 30/15min | 0 | Low | No retry on 429 |
| POST /auth/forgot-password | POST | None | N/A | 5/15min | 0 | Medium | authOtpRateLimiter |
| POST /auth/reset-password | POST | None | N/A | 3/30min | 0 | Medium | authResetRateLimiter |

### Feed & Posts
| Endpoint | Method | Auth | User Limit | IP Limit | Burst | Cost | Notes |
|---|---|---|---|---|---|---|---|
| GET /posts/feed | GET | Required | 10/min | 20/min | +5 | High | Cached response recommended |
| GET /posts/reels | GET | Required | 10/min | 20/min | +5 | High | |
| GET /posts/saved | GET | Required | 5/min | 10/min | +2 | Medium | |
| POST /posts | POST | Required | 5/min | 10/min | 0 | Medium | Content creation |
| GET /posts/:id | GET | Optional | 30/min | 60/min | +10 | Low | |
| DELETE /posts/:id | DELETE | Required | 10/min | 20/min | 0 | Low | |
| POST /posts/:id/like | POST | Required | 30/min | 60/min | +10 | Low | Per user |
| POST /posts/:id/save | POST | Required | 30/min | 60/min | +10 | Low | Per user |
| POST /posts/:id/share | POST | Required | 20/min | 40/min | +5 | Low | |
| POST /posts/:id/view | POST | Required | 100/5min | 200/5min | +20 | Low | Batch recommended |
| POST /posts/:id/report | POST | Required | 5/min | 10/min | 0 | Low | |
| GET /posts/:id/comments | GET | Optional | 20/min | 40/min | +5 | Medium | |
| POST /posts/:id/comments | POST | Required | 10/min | 20/min | 0 | Low | Anti-spam |

### Search & Discovery
| Endpoint | Method | Auth | User Limit | IP Limit | Burst | Cost | Notes |
|---|---|---|---|---|---|---|---|
| GET /search | GET | Optional | 20/min | 30/min | +5 | High | FTS query |
| GET /users | GET | Optional | 20/min | 40/min | +5 | Medium | |

### Uploads
| Endpoint | Method | Auth | User Limit | IP Limit | Concurrency | Cost | Notes |
|---|---|---|---|---|---|---|---|
| POST /uploads/* | POST | Required | 20/hour | 40/hour | 3 per user | Very High | GCS write |

### Organizations & Jobs
| Endpoint | Method | Auth | User Limit | IP Limit | Burst | Cost | Notes |
|---|---|---|---|---|---|---|---|
| GET /organizations | GET | Optional | 30/min | 60/min | +10 | Medium | Cacheable |
| GET /jobs | GET | Optional | 30/min | 60/min | +10 | Medium | Cacheable |
| POST /applications | POST | Required | 5/min | 10/min | 0 | Medium | Application submit |

### Notifications
| Endpoint | Method | Auth | User Limit | IP Limit | Burst | Cost | Notes |
|---|---|---|---|---|---|---|---|
| GET /notifications | GET | Required | 5/min | 10/min | +2 | Low | Poll interval min 30s |

### Admin
| Endpoint | Method | Auth | User Limit | IP Limit | Burst | Cost | Notes |
|---|---|---|---|---|---|---|---|
| All /admin/* | * | Required+Admin | 60/min | 120/min | +10 | Varies | Admin role enforced |

---

## Layer E -- Service-Level Quotas

| Service | Quota | Per | Notes |
|---|---|---|---|
| Email (Brevo) | 300/day | Platform total | Free tier limit |
| SMS (Twilio) | Postponed | - | V2 feature |
| GCS uploads | 500/hour | Platform total | Cost control |
| Pub/Sub messages | Unlimited | - | GCP quota applies |
| PostgreSQL connections | 200 max | Platform total | See DB plan |
| Redis connections | 100 max | Platform total | Memorystore limit |

---

## Layer F -- Concurrency Limits

| Resource | Limit | Enforcement |
|---|---|---|
| Simultaneous uploads per user | 3 | Semaphore in middleware |
| Simultaneous requests per user | No hard limit | Rate limit controls frequency |
| Cloud Run max instances | 10 (initial) | cloudbuild.yaml |
| DB connections per instance | 10 (max=10 per instance) | pg Pool config |
| Total DB connections | 100 max (10 instances x 10) | Cloud SQL must support this |

---

## Standard Rate Limit Error Response

`json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again shortly.",
    "retryAfterSeconds": 60
  },
  "requestId": "server-generated-uuid"
}
`

HTTP Status: 429  
Headers:
- Retry-After: <seconds>
- RateLimit-Limit: <max>
- RateLimit-Remaining: <remaining>
- RateLimit-Reset: <unix-timestamp>
- X-Request-ID: <uuid>
