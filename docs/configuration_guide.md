# 🛠️ Knotnex Backend: Complete Configuration & GCP Setup Guide

> **A step-by-step master reference for local setup, testing endpoints, and configuring Google Cloud Platform (GCP), Firebase, Twilio, SendGrid, and PostgreSQL.**

---

## 📑 Table of Contents

1. [Quick Start: Test Your API in 5 Minutes](#1-quick-start-test-your-api-in-5-minutes)
2. [How to Open & Test API URLs in Browser/Postman](#2-how-to-open--test-api-urls-in-browserpostman)
3. [Complete `.env` Configuration Reference](#3-complete-env-configuration-reference)
4. [Step-by-Step GCP & External Tool Configuration](#4-step-by-step-gcp--external-tool-configuration)
   - [4.1 PostgreSQL Database (Local & Cloud SQL)](#41-postgresql-database-local--cloud-sql)
   - [4.2 Redis Cache (Local & Memorystore)](#42-redis-cache-local--memorystore)
   - [4.3 Firebase Setup (Auth, Firestore, FCM & Service Account Key)](#43-firebase-setup-auth-firestore-fcm--service-account-key)
   - [4.4 Google Cloud Storage (Media & Private Buckets)](#44-google-cloud-storage-media--private-buckets)
   - [4.5 Twilio Setup (SMS & Phone OTP Verify)](#45-twilio-setup-sms--phone-otp-verify)
   - [4.6 SendGrid Setup (Transactional Emails)](#46-sendgrid-setup-transactional-emails)
   - [4.7 Google Cloud Pub/Sub](#47-google-cloud-pubsub)
5. [Deploying to GCP Cloud Run](#5-deploying-to-gcp-cloud-run)
6. [API Endpoints Quick Reference](#6-api-endpoints-quick-reference)

---

# 1. Quick Start: Test Your API in 5 Minutes

You can run the backend completely locally without paying for cloud services right away.

### Step 1: Start PostgreSQL & Redis using Docker
Ensure Docker Desktop is open and running on your computer, then run:
```powershell
cd "c:\flutter projects\Knotnex\knotnex_backend"
docker-compose up -d postgres redis
```
*This starts a PostgreSQL 15 database on port `5432` and Redis on port `6379`.*

### Step 2: Install Node Dependencies
```powershell
npm install
```

### Step 3: Run Database Migrations & Seeds
This will create all **22 database tables** and insert initial sample data (Admin, Samarthya NGO, sample events, jobs, and schemes):
```powershell
npm run db:migrate
npm run db:seed
```

### Step 4: Start the Backend Server
```powershell
npm run dev
```
You will see output in the terminal:
```
🚀 Knotnex API Server listening on port 8080 [development]
📡 Healthcheck available at: http://localhost:8080/api/v1/health
⚡ Socket.IO real-time engine attached at /socket.io
Connected to PostgreSQL (Cloud SQL)
Connected to Redis (Memorystore)
```

---

# 2. How to Open & Test API URLs in Browser/Postman

### 🌐 Test 1: Health Check (Open directly in Chrome / Edge)
Open this URL in your web browser:
```
http://localhost:8080/api/v1/health
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Knotnex API service is healthy",
  "data": {
    "status": "healthy",
    "uptime": 12.45,
    "timestamp": "2026-10-01T06:50:00.000Z",
    "services": {
      "api": "operational",
      "database": "connected"
    }
  }
}
```

---

### 🌐 Test 2: Browse Events (Public Read)
Open this URL in your browser:
```
http://localhost:8080/api/v1/events
```
**Expected Response:** Returns paginated event cards including accessibility badges (`wheelchair_accessible`, `sign_language`), venue, and date.

---

### 🌐 Test 3: Browse Jobs (Public Read)
Open this URL in your browser:
```
http://localhost:8080/api/v1/jobs
```
**Expected Response:** Returns open opportunities including `disability_accommodations`, salary, and location.

---

### 🌐 Test 4: Universal Search
Open in your browser:
```
http://localhost:8080/api/v1/search?q=tech
```
**Expected Response:** Simultaneously searches events, jobs, organizations, and schemes matching `tech`.

---

### 🔐 Test 5: Testing Authenticated Endpoints (Dev Bypass Token)
The backend has a built-in development authentication bypass so you can test user, organization, or admin endpoints without needing Firebase tokens immediately:

Pass the header `Authorization: Bearer mock_admin` or `Bearer mock_user` in Postman / cURL:

#### Example: Get Support Tickets (Admin Only)
```bash
curl -X GET http://localhost:8080/api/v1/tickets \
  -H "Authorization: Bearer mock_admin"
```

#### Example: Create an Event (Organization / Admin)
```bash
curl -X POST http://localhost:8080/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock_admin" \
  -d '{
    "title": "Inclusive Career Fair 2026",
    "category": "Career",
    "type": "In-Person",
    "eventDate": "2026-11-20",
    "venueName": "Convention Center",
    "wheelchairAccessible": true,
    "signLanguage": true,
    "isFree": true
  }'
```

---

# 3. Complete `.env` Configuration Reference

Here is what each environment variable does and where to get its value:

| Variable | Default (Local Dev) | Production (GCP / Cloud) | Where to Get / Configure |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | Set to `production` when deployed |
| `PORT` | `8080` | `8080` | Cloud Run automatically listens on 8080 |
| `API_VERSION` | `v1` | `v1` | API versioning prefix |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | `https://your-domain.com` | Allowed web origins (Flutter Web & React) |
| `DATABASE_URL` | `postgresql://knotnex_user:knotnex_password@localhost:5432/knotnex_db` | Cloud SQL socket or private IP | From GCP Cloud SQL Console |
| `DB_POOL_MIN` | `2` | `5` | Min idle PostgreSQL pool connections |
| `DB_POOL_MAX` | `20` | `50` | Max active PostgreSQL pool connections |
| `DB_SSL` | `false` | `true` | Set to `true` for Cloud SQL production |
| `REDIS_URL` | `redis://localhost:6379` | Memorystore IP e.g. `redis://10.0.0.3:6379` | From GCP Memorystore Console |
| `FIREBASE_PROJECT_ID` | `knotnex-dev` | Your GCP Project ID | Firebase Console > Project Settings |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | `./keys/firebase-sa.json` | `./keys/firebase-sa.json` | Downloaded from Firebase Console |
| `GCS_MEDIA_BUCKET` | `knotnex-media-dev` | `knotnex-media-prod` | GCP Cloud Storage Console |
| `GCS_PRIVATE_BUCKET` | `knotnex-private-dev` | `knotnex-private-prod` | GCP Cloud Storage Console |
| `GCS_PROJECT_ID` | `knotnex-dev` | Your GCP Project ID | GCP Console Dashboard |
| `TWILIO_ACCOUNT_SID` | `AC_dummy_account_sid` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Twilio Console Dashboard |
| `TWILIO_AUTH_TOKEN` | `dummy_auth_token` | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Twilio Console Dashboard |
| `TWILIO_VERIFY_SERVICE_SID` | `VA_dummy_verify_sid` | `VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Twilio Verify Services Console |
| `TWILIO_PHONE_NUMBER` | `+1234567890` | `+1xxxxxxxxxx` | Twilio Phone Numbers Console |
| `SENDGRID_API_KEY` | `SG.dummy_api_key` | `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | SendGrid Settings > API Keys |
| `SENDGRID_FROM_EMAIL` | `noreply@knotnex.com` | Verified SendGrid sender email | SendGrid Single Sender Verification |
| `SENDGRID_FROM_NAME` | `KnotNex` | `KnotNex Platform` | Sender branding name |
| `PUBSUB_PROJECT_ID` | `knotnex-dev` | Your GCP Project ID | GCP Console Dashboard |
| `JWT_SECRET` | Any random 32-char string | Long cryptographic random string | Generated using `openssl rand -hex 32` |
| `LOG_LEVEL` | `info` | `info` or `warn` | Logging verbosity |

---

# 4. Step-by-Step GCP & External Tool Configuration

---

## 4.1 PostgreSQL Database (Local & Cloud SQL)

### Option A: Local Development (Docker)
The provided `docker-compose.yml` automatically sets up PostgreSQL.
- Database: `knotnex_db`
- User: `knotnex_user`
- Password: `knotnex_password`
- Port: `5432`

### Option B: Production (GCP Cloud SQL)
1. Go to **Google Cloud Console**: [https://console.cloud.google.com/sql](https://console.cloud.google.com/sql)
2. Click **Create Instance** > Select **PostgreSQL**.
3. Configure:
   - **Instance ID**: `knotnex-postgres-prod`
   - **Password**: Generate a secure password.
   - **Database version**: `PostgreSQL 15`
   - **Region**: `asia-south1` (Mumbai) or your target region.
   - **Configuration**:
     - *Dev*: `db-f1-micro` or `db-g1-small`
     - *Production*: `db-custom-2-8192` (2 vCPU, 8 GB RAM)
4. Under **Connections**:
   - Check **Private IP** (connecting within GCP VPC) or **Public IP** with authorized networks for dev access.
5. Click **Create Instance** (takes ~5 minutes).
6. Once created, click **Databases** tab > Click **Create Database** > Enter `knotnex_db`.
7. Click **Users** tab > Add user `knotnex_user` with your password.
8. Set `.env`:
   ```env
   DATABASE_URL=postgresql://knotnex_user:YOUR_PASSWORD@YOUR_CLOUD_SQL_IP:5432/knotnex_db
   DB_SSL=true
   ```

---

## 4.2 Redis Cache (Local & Memorystore)

### Option A: Local Development (Docker)
Already configured in `docker-compose.yml`:
- Port: `6379`
- Connection URL: `redis://localhost:6379`

### Option B: Production (GCP Memorystore)
1. Go to: [https://console.cloud.google.com/memorystore/redis/instances](https://console.cloud.google.com/memorystore/redis/instances)
2. Click **Create Instance**.
3. Configure:
   - **Instance ID**: `knotnex-redis-prod`
   - **Tier**: Basic (1 GB capacity is plenty for startup)
   - **Region**: Same as Cloud SQL (`asia-south1`)
4. Click **Create**.
5. Once created, copy the **IP Address** shown (e.g. `10.0.0.5`).
6. Set `.env`:
   ```env
   REDIS_URL=redis://10.0.0.5:6379
   ```

---

## 4.3 Firebase Setup (Auth, Firestore, FCM & Service Account Key)

Firebase handles identity authentication, Firestore real-time messaging, and push notifications.

### Step 1: Create or Link Firebase Project
1. Go to **Firebase Console**: [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** (or select your existing Google Cloud project).
3. Name it: `knotnex-prod` (or `knotnex-dev`).

### Step 2: Enable Firebase Authentication
1. In the left sidebar, click **Build** > **Authentication**.
2. Click **Get Started**.
3. Under **Sign-in method** tab, enable:
   - **Email/Password** (Enable Email/Password, leave Email link disabled).
   - **Phone** (Enable Phone provider for SMS OTP).
   - **Google** (Optional: for Google sign-in).

### Step 3: Enable Cloud Firestore (Real-Time Database)
1. In the left sidebar, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. Select location: `asia-south1` (or your chosen region).
4. Start in **Production mode** > Click **Create**.
5. Deploy Firestore Security Rules:
   - In Firebase Console > Firestore > **Rules** tab.
   - Copy and paste the contents of `knotnex_backend/firestore.rules` and click **Publish**.

### Step 4: Download Service Account Key (`firebase-sa.json`)
The backend needs this private key to verify tokens and send push notifications.
1. In Firebase Console, click the **Gear icon (⚙️)** in top-left > **Project settings**.
2. Click the **Service accounts** tab.
3. Ensure **Node.js** is selected.
4. Click the blue **Generate new private key** button.
5. A JSON file will download to your computer.
6. In `c:\flutter projects\Knotnex\knotnex_backend`:
   - Create a folder named `keys`:
     ```powershell
     mkdir keys
     ```
   - Move the downloaded JSON file into `keys/` and rename it to `firebase-sa.json`.
7. Verify `.env`:
   ```env
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_SERVICE_ACCOUNT_KEY=./keys/firebase-sa.json
   ```

---

## 4.4 Google Cloud Storage (Media & Private Buckets)

### Step 1: Create Public Media Bucket
1. Go to **Cloud Storage Console**: [https://console.cloud.google.com/storage/browser](https://console.cloud.google.com/storage/browser)
2. Click **Create Bucket**.
3. Name: `knotnex-media-prod` (bucket names must be globally unique, e.g. `knotnex-media-yourname`).
4. Location type: **Region** > `asia-south1`.
5. Storage class: **Standard**.
6. Access control: **Uniform** (recommended).
7. Uncheck "Enforce public access prevention on this bucket" (since public avatars and event banners are stored here).
8. Click **Create**.
9. Grant public read access to media files:
   - Click the bucket name > **Permissions** tab.
   - Click **Grant Access**.
   - New principals: `allUsers`.
   - Role: `Storage Object Viewer`.
   - Click **Save** > Confirm "Allow Public Access".

### Step 2: Create Private Documents Bucket
1. Click **Create Bucket** again.
2. Name: `knotnex-private-prod` (or `knotnex-private-yourname`).
3. Location type: **Region** > `asia-south1`.
4. Storage class: **Standard**.
5. Access control: **Uniform**.
6. Keep **Enforce public access prevention** CHECKED (this bucket holds private resumes and verification documents, accessed ONLY via signed URLs).
7. Click **Create**.

### Step 3: Update `.env`
```env
GCS_MEDIA_BUCKET=knotnex-media-yourname
GCS_PRIVATE_BUCKET=knotnex-private-yourname
GCS_PROJECT_ID=your-gcp-project-id
```

---

## 4.5 Twilio Setup (SMS & Phone OTP Verify)

Twilio handles SMS delivery and phone verification.

### Step 1: Create Twilio Account
1. Sign up at [https://console.twilio.com](https://console.twilio.com).
2. On the main Dashboard, find:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)
3. Copy these into `.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 2: Create a Twilio Verify Service
1. In Twilio search bar, type **Verify** > Click **Services**.
2. Click **Create Service**.
3. Friendly Name: `KnotNex`.
4. Code length: `6 digits`.
5. Click **Create**.
6. Copy the **Service SID** (starts with `VA...`).
7. Add to `.env`:
   ```env
   TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

> 💡 **Development Note**: When running with dummy Twilio keys in `.env`, the backend will simulate verification and accept `123456` as the valid OTP without charging your Twilio account!

---

## 4.6 SendGrid Setup (Transactional Emails)

SendGrid sends emails (welcome messages, ticket replies, event confirmations).

### Step 1: Create SendGrid API Key
1. Sign up or log in to [https://app.sendgrid.com](https://app.sendgrid.com).
2. Go to **Settings** (left sidebar) > **API Keys**.
3. Click **Create API Key**.
4. Name: `Knotnex Backend`.
5. API Key Permissions: Select **Full Access** (or Restricted with "Mail Send").
6. Click **Create & View**.
7. Copy the key (starts with `SG...`) — it will only be shown once!
8. Add to `.env`:
   ```env
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 2: Verify Sender Email
1. Go to **Settings** > **Sender Authentication**.
2. Under "Single Sender Verification", click **Create New Sender**.
3. Enter your email (e.g. `support@yourdomain.com` or your personal email for testing).
4. SendGrid sends a verification link to that email; click it to confirm.
5. Add the verified email to `.env`:
   ```env
   SENDGRID_FROM_EMAIL=your-verified-email@example.com
   SENDGRID_FROM_NAME=KnotNex Platform
   ```

---

## 4.7 Google Cloud Pub/Sub

Google Cloud Pub/Sub handles asynchronous background events.

1. Go to **Pub/Sub Console**: [https://console.cloud.google.com/cloudpubsub/topic/list](https://console.cloud.google.com/cloudpubsub/topic/list).
2. Click **Create Topic**.
3. Create the topics used by Knotnex:
   - `user.registered`
   - `event.registration`
   - `event.reminder`
   - `job.applied`
   - `job.stage-changed`
   - `ticket.created`
   - `ticket.replied`
4. Set `.env`:
   ```env
   PUBSUB_PROJECT_ID=your-gcp-project-id
   ```

---

# 5. Deploying to GCP Cloud Run

When you are ready to publish the backend to production:

### Prerequisites:
Install the Google Cloud CLI (`gcloud`) and log in:
```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Option A: One-Command Deployment
Run from `knotnex_backend`:
```powershell
gcloud run deploy knotnex-api `
  --source . `
  --region asia-south1 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars NODE_ENV=production,PORT=8080,API_VERSION=v1
```

### Option B: Automated Cloud Build CI/CD
The project contains `cloudbuild.yaml`. You can trigger a build whenever you push to GitHub:
```powershell
gcloud builds submit --config=cloudbuild.yaml .
```

Cloud Run will output your live URL, e.g.:
```
https://knotnex-api-xyz-as.a.run.app
```
Test your deployed health check:
```
https://knotnex-api-xyz-as.a.run.app/api/v1/health
```

---

# 6. API Endpoints Quick Reference

All routes are mounted under prefix `/api/v1`:

| Domain | Route Prefix | Key Endpoints | Auth Required? |
|---|---|---|---|
| **Health** | `/api/v1/health` | `GET /` | No |
| **Auth** | `/api/v1/auth` | `POST /signup`, `POST /send-otp`, `POST /verify-otp`, `POST /forgot-password` | No |
| **Users** | `/api/v1/users` | `GET /`, `GET /:id`, `PATCH /:id`, `GET /:id/devices` | Yes |
| **Profiles** | `/api/v1/profiles` | `GET /:userId`, `PATCH /:userId`, `GET /:userId/qr`, `GET /:userId/dashboard` | Yes |
| **Organizations** | `/api/v1/organizations` | `POST /`, `GET /`, `GET /:id`, `POST /:id/follow`, `POST /:id/reviews` | Partial |
| **Events** | `/api/v1/events` | `POST /`, `GET /`, `GET /:id`, `POST /:id/save`, `GET /:id/similar` | Partial |
| **Registrations** | `/api/v1/registrations` | `POST /`, `GET /event/:eventId`, `POST /check-in`, `GET /:id/qr-pass` | Yes |
| **Jobs** | `/api/v1/jobs` | `POST /`, `GET /`, `GET /:id`, `POST /:id/save`, `GET /:id/similar` | Partial |
| **Applications** | `/api/v1/applications` | `POST /`, `GET /job/:jobId`, `PATCH /:id/stage` | Yes |
| **Schemes** | `/api/v1/schemes` | `POST /`, `GET /`, `GET /:id`, `POST /:id/apply` | Partial |
| **Posts & Reels** | `/api/v1/posts` | `POST /`, `GET /feed`, `GET /reels`, `POST /:id/like`, `POST /:id/comments` | Yes |
| **Real-Time Chat** | `/api/v1/chat` | `GET /conversations`, `POST /conversations`, `POST /messages` | Yes |
| **Notifications** | `/api/v1/notifications` | `POST /register-device`, `POST /send` | Yes |
| **Support Tickets**| `/api/v1/tickets` | `POST /`, `GET /`, `GET /:id`, `POST /:id/reply`, `PATCH /:id/status` | Yes |
| **Universal Search**| `/api/v1/search` | `GET /?q=keyword` | No |
| **File Uploads** | `/api/v1/uploads` | `POST /image`, `POST /video`, `POST /document`, `GET /signed-url` | Yes |
| **Analytics** | `/api/v1/analytics` | `GET /dashboard`, `GET /org/:orgId`, `GET /ai-scan` | Yes |
| **Admin Operations**| `/api/v1/admin` | `PATCH /users/:id/ban`, `GET /feeds/curation`, `PATCH /feeds/:postId/action` | Admin Only |
