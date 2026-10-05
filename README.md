# 🚀 Knotnex Platform Backend API

Production-ready backend API service for the **Knotnex Platform**, serving all 3 client applications:
1. 📱 **knotnex** (Flutter Mobile — Specially-abled individuals / Users)
2. 🖥️ **knotnex_org** (React + Vite Web — NGO & Corporate Organizations)
3. 🖥️ **knotnex_admin** (Flutter Web — Platform Operations & Moderation)

---

## 🏛️ Architecture Overview

- **Language / Framework**: Node.js 20+ with Express & TypeScript
- **Primary Database**: PostgreSQL 15 (Cloud SQL) for relational data, queries, analytics, and ACID compliance
- **Real-Time Database**: Google Cloud Firestore for chat messages, active presence, and typing indicators
- **Cache & Rate Limiting**: Memorystore Redis (or standalone Redis for local development)
- **Identity & Auth**: Firebase Auth with Custom Claims (`role`, `orgId`, `verified`)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Object Storage**: Google Cloud Storage (Media & Private buckets)
- **Hosting & Compute**: GCP Cloud Run (Serverless container deployment)

---

## 📁 Project Structure

```
knotnex_backend/
├── src/
│   ├── config/            # PostgreSQL, Redis, Firebase, GCP, Logger, CORS configs
│   ├── types/             # Enums, interfaces, and Express request types
│   ├── utils/             # API responses, pagination, crypto, sanitize helpers
│   ├── middleware/        # Auth, role check, rate limiting, error handling, upload
│   ├── validators/        # Zod request validation schemas
│   ├── models/            # PostgreSQL & Firestore data models (User, Event, Job, Scheme, Post, etc.)
│   ├── integrations/      # Firebase, Twilio, SendGrid, Cloud Storage, PubSub, QR
│   ├── services/          # Core domain business logic
│   ├── controllers/       # HTTP Request/Response controllers
│   ├── routes/            # Express route definitions (prefixed with /api/v1)
│   ├── websockets/        # Socket.IO handlers for chat, presence, typing
│   ├── db/                # SQL migrations & seed scripts
│   ├── app.ts             # Express application configuration
│   └── server.ts          # Server initialization and shutdown listeners
├── scripts/               # Migration runner, seed runner, Firestore initializer
├── Dockerfile             # Multi-stage production container
└── docker-compose.yml     # Local environment (PostgreSQL + Redis + API)
```

---

## 🛠️ Local Development Setup

### 1. Environment Variables
Copy the template and verify settings:
```bash
cp .env.example .env
```

### 2. Run with Docker Compose
Start PostgreSQL and Redis locally:
```bash
docker-compose up -d postgres redis
```

### 3. Install & Migrate
```bash
npm install
npm run db:migrate
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```
The server will start listening at `http://localhost:8080/api/v1`.
Health check: `http://localhost:8080/api/v1/health`
