# KnotNex — Monitoring, Telemetry & Alerting Strategy

**Scope:** Production Observability, SRE Alerting, Health Checks & Dashboards  
**Target Load:** 5,000 Concurrent Users / 500,000 DAU  
**Tools:** Google Cloud Monitoring, Cloud Logging, Prometheus / OpenTelemetry, Sentry  

---

## 1. Golden Signals & Service Level Objectives (SLOs)

| Metric | Target SLO | Warning Threshold | Critical Alert Threshold |
|---|---|---|---|
| **API Latency (p95)** | < 250 ms | > 500 ms for 3 min | > 1,000 ms for 2 min |
| **API Latency (p99)** | < 600 ms | > 1,200 ms for 3 min | > 2,500 ms for 2 min |
| **API Availability** | 99.9% uptime | < 99.5% over 15 min | < 99.0% over 5 min |
| **HTTP 5xx Error Rate** | < 0.1% | > 1.0% of total requests | > 3.0% of total requests |
| **HTTP 429 Rate** | < 0.5% | > 2.0% of total requests | > 5.0% (indicates policy tuning issue or attack) |
| **Cloud SQL CPU** | < 60% | > 75% for 5 min | > 85% for 2 min |
| **Cloud SQL Connections** | < 65% of max | > 75% pool utilization | > 85% pool utilization |
| **Redis Memory Used** | < 60% | > 75% memory used | > 85% memory used |
| **Redis Evictions** | 0 keys | > 50 keys/min | > 500 keys/min |

---

## 2. Structured Logging & Distributed Tracing

### Mandatory Log Schema for Cloud Run (JSON format):
Every API request logged to `stdout` must follow this schema for automatic Google Cloud Logging ingestion:
```json
{
  "timestamp": "2026-10-12T11:15:30.123Z",
  "severity": "INFO",
  "requestId": "req_8f1a23b9-1234-4567-89ab-cdef01234567",
  "userId": "usr_9a8b7c6d5e",
  "method": "GET",
  "route": "/api/v1/posts/feed",
  "statusCode": 200,
  "durationMs": 42.5,
  "clientIp": "203.0.113.195",
  "userAgent": "KnotNex-Flutter/2.1.0",
  "rateLimit": {
    "limit": 60,
    "remaining": 48
  },
  "dbQueriesCount": 2,
  "dbDurationMs": 14.1
}
```

### Rate-Limiter Log Event (when 429 is triggered):
```json
{
  "timestamp": "2026-10-12T11:15:30.456Z",
  "severity": "WARNING",
  "event": "RATE_LIMIT_EXCEEDED",
  "limiterType": "USER",
  "userId": "usr_9a8b7c6d5e",
  "clientIp": "203.0.113.195",
  "endpoint": "POST /api/v1/posts",
  "limit": 5,
  "windowSeconds": 60,
  "retryAfter": 18
}
```

---

## 3. Cloud Monitoring Alerting Policies

### Alert 1: Elevated 429 Rejections (Rate Limit Anomaly)
- **Condition:** Sum of `response_code = 429` > 50 per minute for 2 consecutive minutes.
- **Notification:** Slack `#alerts-ops` & PagerDuty low-urgency.
- **Triage Guide:** Check if a mobile release has a runaway loop or if a DDoS IP cluster is active.

### Alert 2: Database Connection Saturation
- **Condition:** PostgreSQL active connections > 120 (of 150 budget) for 2 minutes.
- **Notification:** PagerDuty high-urgency (immediate paging).
- **Auto-Mitigation:** Scale down non-essential Cloud Run background workers.

### Alert 3: Redis High Memory / Eviction Surge
- **Condition:** Memorystore `memory.usage_ratio > 0.85`.
- **Notification:** SRE On-call engineer.
- **Triage Guide:** Check for unexpiring feed cache keys or huge hyperloglog keys.

---

## 4. Health Check Endpoints

### `/health/liveness`
- Checks whether the Node.js process is responsive.
- Returns `200 OK` immediately without downstream checks.
- Used by Cloud Run orchestrator for container health.

### `/health/readiness`
- Tests connectivity to:
  1. PostgreSQL (`SELECT 1`)
  2. Redis (`PING`)
- If either fails, returns `503 Service Unavailable`.
- Prevents routing traffic to instances with severed database or cache connections.
