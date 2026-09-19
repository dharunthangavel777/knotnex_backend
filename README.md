# Knotnex Backend Service

Node.js & Express backend for Knotnex.

## Features
- **Express 4.x** with security headers ([`helmet`](https://helmetjs.github.io/)) and configurable **CORS**.
- **HTTP Request Logger** using `morgan`.
- **Health Check Endpoint** with system metrics (uptime, memory, platform) and mocked dependencies (database, cache, auth).
- **Mock Testing Endpoint** supporting scenario simulation (`down`, `degraded`, latency injection).
- **Graceful Shutdown** and unhandled rejection/exception management.

---

## Getting Started

### 1. Environment Variables
Copy `.env.example` to `.env` (already initialized with defaults):
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
```

### 2. Run the Server
- **Production mode**:
  ```bash
  npm start
  ```
- **Development mode (auto-reload)**:
  ```bash
  npm run dev
  ```

### 3. Run Automated Tests
```bash
npm test
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and links to health endpoints |
| `GET` | `/api/health` (or `/health`) | System health metrics & mock service states |
| `GET` | `/api/health/mock` | Mock testing endpoint |
| `GET` | `/api/health/mock?status=down` | Simulates a 503 service outage |
| `GET` | `/api/health/mock?status=degraded` | Simulates high latency / degraded state |
| `GET` | `/api/health/mock?delay=1000` | Injects simulated network delay (ms) |

### Sample Response (`GET /api/health`):
```json
{
  "status": "ok",
  "service": "knotnex-backend",
  "version": "1.0.0",
  "timestamp": "2026-09-19T08:05:00.000Z",
  "uptime": "0h 1m 20s",
  "uptimeSeconds": 80,
  "environment": "development",
  "system": {
    "platform": "win32",
    "nodeVersion": "v22.19.0",
    "memoryUsage": {
      "rss": "38 MB",
      "heapUsed": "12 MB"
    }
  },
  "dependencies": {
    "database": {
      "name": "MongoDB",
      "status": "healthy (mocked)",
      "latency": "2ms"
    },
    "cache": {
      "name": "Redis",
      "status": "healthy (mocked)",
      "latency": "1ms"
    },
    "authService": {
      "name": "JWT Auth",
      "status": "operational (mocked)"
    }
  }
}
```
