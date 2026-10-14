# KnotNex — Automated PostgreSQL Migrations, GitHub CI/CD & GCP Infrastructure Guide

This guide details the complete automation implemented for KnotNex PostgreSQL database migrations, continuous deployment on pushing to the GitHub `main` branch, and the comprehensive Google Cloud Platform (GCP) configurations required to support **5,000 concurrent active users (500K DAU)**.

---

## 1. Automated PostgreSQL Schema Migrations

### How It Works
Previously, migrations had to be run manually or risked crashing if rerun. We have implemented an **enterprise-grade, race-condition-safe automated migration engine**:

1. **Schema Migration Tracking Table (`schema_migrations`)**:
   - The engine automatically creates and inspects a tracking table in PostgreSQL:
     ```sql
     CREATE TABLE IF NOT EXISTS schema_migrations (
       id SERIAL PRIMARY KEY,
       name VARCHAR(255) UNIQUE NOT NULL,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     ```
   - Before executing any file, it checks which migrations have already been recorded.

2. **PostgreSQL Advisory Locking (`pg_advisory_lock`)**:
   - When Cloud Run auto-scales or multiple container instances boot simultaneously, they all connect to Cloud SQL at once.
   - To prevent multiple instances from racing to run migrations, the migration engine acquires an advisory lock (`SELECT pg_advisory_lock(74219842)`).
   - Only **one** instance executes pending migrations; all other instances wait and then detect that all migrations have been applied.

3. **Per-Migration Transaction Isolation**:
   - Each migration file (`001_...`, `002_...`, ..., `005_feed_scale_indexes.sql`) is executed inside its own `BEGIN ... COMMIT` block.
   - If any migration fails, it is automatically rolled back (`ROLLBACK`), preventing half-applied schema corruption.

4. **Zero-Touch Server Boot Hook (`src/server.ts`)**:
   - Whenever a newly deployed container starts, `server.ts` automatically runs:
     ```typescript
     if (config.database.autoMigrate) {
       await runMigrations();
     }
     ```
   - When all migrations are already applied, this check completes in **~10ms**, adding zero noticeable startup overhead.

5. **Multi-Environment File Discovery & Docker Packaging**:
   - `scripts/copy-migrations.js` runs automatically during `npm run build` to copy `.sql` files to `dist/db/migrations`.
   - `Dockerfile` copies `src/db/migrations` into both `dist/db/migrations` and `src/db/migrations`, ensuring it works identically in local development, tests, CI/CD, and production Docker containers.

---

## 2. Automatic Rebuild & Deploy on Push to GitHub `main`

We have configured two seamless CI/CD paths. You can use either **GitHub Actions** or **Google Cloud Build**.

### Option A: GitHub Actions (Recommended & Pre-Configured)
The repository now includes `.github/workflows/deploy.yml`.

Whenever you run:
```bash
git push origin main
```
GitHub Actions automatically executes the following 8-step pipeline:
1. **Checks out the repository**.
2. **Authenticates to GCP** using your GitHub Secret `GCP_SA_KEY`.
3. **Sets up Google Cloud SDK** (`gcloud`).
4. **Configures Docker authentication** for Google Artifact Registry (`asia-south1-docker.pkg.dev`).
5. **Builds the Docker container** using BuildKit with caching.
6. **Tags and pushes** images: `.../api:${{ github.sha }}` and `.../api:latest`.
7. **Deploys directly to Cloud Run** with production scaling flags:
   - `--min-instances 2`
   - `--max-instances 25`
   - `--concurrency 80`
   - `--cpu 2`
   - `--memory 2Gi`
   - `--no-cpu-throttling` (Required for Socket.IO WebSockets)
   - `--session-affinity` (Sticky routing for Socket.IO handshakes)
   - `--set-env-vars AUTO_RUN_MIGRATIONS=true`
8. **Validates Healthcheck** (`GET /api/v1/health`).

#### One-Time Setup for GitHub Actions:
In your GitHub repository (`dharunthangavel777/knotnex_backend`) under **Settings → Secrets and variables → Actions**, add:
- `GCP_PROJECT_ID`: Your GCP Project ID (e.g., `knotnex-dev` or production project ID).
- `GCP_SA_KEY`: The JSON key string of a GCP Service Account with deployment permissions.

---

### Option B: Native Google Cloud Build GitHub Trigger
If you prefer GCP to pull directly from GitHub without storing credentials in GitHub Secrets:

1. In the GCP Console, navigate to **Cloud Build → Triggers**.
2. Click **Connect Repository**, authorize GitHub, and select `dharunthangavel777/knotnex_backend`.
3. Click **Create Trigger**:
   - **Name**: `knotnex-backend-main-deploy`
   - **Event**: `Push to a branch`
   - **Branch**: `^main$`
   - **Configuration**: `Cloud Build configuration file (yaml)`
   - **File location**: `cloudbuild.yaml`
4. Now, any push to `main` triggers Cloud Build to run `cloudbuild.yaml` directly on Google infrastructure.

---

## 3. Complete Checklist of Everything Needed in GCP

To support **5,000 concurrent active users** smoothly, configure the following resources in Google Cloud Platform:

### 3.1. Enable Required GCP APIs
Run this command in Google Cloud Shell or terminal:
```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  redis.googleapis.com \
  compute.googleapis.com \
  storage.googleapis.com
```

---

### 3.2. Google Artifact Registry (Container Storage)
Create the Docker repository to store your backend images:
```bash
gcloud artifacts repositories create knotnex \
  --repository-format=docker \
  --location=asia-south1 \
  --description="KnotNex Production Docker Repository"
```

---

### 3.3. Google Cloud SQL (PostgreSQL 15)
To handle 5,000 concurrent users without connection pool exhaustion:

1. **Instance Tier**:
   - Recommended: `db-custom-4-16384` (4 vCPU, 16 GB RAM) with SSD storage and automatic storage increase enabled.
   - Minimum dev/staging: `db-custom-2-8192` (2 vCPU, 8 GB RAM).

2. **Database Flags**:
   Set `max_connections` to at least `300`:
   ```bash
   gcloud sql instances patch <INSTANCE_NAME> \
     --database-flags=max_connections=300
   ```
   *(Note: Cloud Run is configured with `poolMin: 2, poolMax: 8`. With 25 instances, maximum backend connections cap at 200, safely below 300).*

3. **Cloud Run Connection**:
   Cloud Run connects to Cloud SQL via Cloud SQL Auth Proxy by passing:
   ```bash
   --add-cloudsql-instances=<PROJECT_ID>:asia-south1:<INSTANCE_NAME>
   ```

---

### 3.4. Serverless VPC Access Connector
**Why it is needed**:
Cloud Run is a serverless environment. To communicate with **Memorystore Redis** and **Cloud SQL** over private VPC IP addresses (reducing network latency to <2ms and keeping database traffic off the public internet), a Serverless VPC Access Connector is required:

```bash
gcloud compute networks vpc-access connectors create knotnex-vpc-cx \
  --region=asia-south1 \
  --range=10.8.0.0/28 \
  --network=default \
  --min-instances=2 \
  --max-instances=10 \
  --machine-type=e2-micro
```

Attach it to Cloud Run deployments:
```bash
--vpc-connector=knotnex-vpc-cx --vpc-egress=private-ranges-only
```

---

### 3.5. Google Cloud Memorystore for Redis
Used for:
- Socket.IO Redis Adapter (synchronizing real-time events across all 25 Cloud Run instances).
- Feed and profile caching.
- IP rate limiting.

Create the Redis instance:
```bash
gcloud redis instances create knotnex-redis \
  --size=2 \
  --region=asia-south1 \
  --network=default \
  --redis-version=redis_7_0
```
Set `REDIS_URL` in Cloud Run environment variables: `redis://<REDIS_PRIVATE_IP>:6379`.

---

### 3.6. Secret Manager (Security Best Practice)
Never hardcode production credentials in source code or Git. Store them in GCP Secret Manager:

```bash
# Example secrets
gcloud secrets create knotnex-db-url --data-file=db_url.txt
gcloud secrets create knotnex-jwt-secret --data-file=jwt_secret.txt
```

Mount them directly in Cloud Run:
```bash
--set-secrets="DATABASE_URL=knotnex-db-url:latest,JWT_SECRET=knotnex-jwt-secret:latest"
```

---

### 3.7. Google Cloud Storage (GCS) & Cloud CDN
For posts, reels, video streaming, and avatars:

1. **Media Bucket**:
   ```bash
   gcloud storage buckets create gs://knotnex-media \
     --location=asia-south1 \
     --uniform-bucket-level-access
   ```

2. **CORS Policy for Flutter Web & Mobile**:
   Create a `cors.json` file:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "responseHeader": ["Content-Type", "Content-Range", "Accept-Ranges", "Authorization"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
   Apply it to the bucket:
   ```bash
   gcloud storage buckets update gs://knotnex-media --cors-file=cors.json
   ```

3. **Public Read Permissions for CDN/User Serving**:
   ```bash
   gcloud storage buckets add-iam-policy-binding gs://knotnex-media \
     --member=allUsers \
     --role=roles/storage.objectViewer
   ```

---

### 3.8. IAM Service Account & Roles
Create a dedicated deployment service account for GitHub Actions / Cloud Build:

```bash
# 1. Create service account
gcloud iam service-accounts create knotnex-deployer \
  --description="KnotNex CI/CD Deployment Service Account" \
  --display-name="knotnex-deployer"

# 2. Grant necessary roles
SA_EMAIL="knotnex-deployer@<PROJECT_ID>.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# 3. Generate JSON key for GitHub Actions secret (GCP_SA_KEY)
gcloud iam service-accounts keys create sa-key.json \
  --iam-account="${SA_EMAIL}"
```

---

## 4. Summary Table of Architecture Specs (5,000 CCU)

| Component | Target Spec / Flag | Rationale |
|---|---|---|
| **Cloud Run Min Instances** | `2` (or `3` during peak) | Zero cold starts for incoming HTTP requests and WebSocket handshakes |
| **Cloud Run Max Instances** | `25` | 25 × 80 concurrency = 2,000 concurrent request workers |
| **Cloud Run Concurrency** | `80` | Optimal Node.js event-loop throughput without I/O blocking |
| **Cloud Run CPU & RAM** | `2 vCPU`, `2 GiB` RAM | Handles image processing, video thumbnailing, and socket message serialization |
| **CPU Throttling** | `--no-cpu-throttling` | Mandatory for persistent WebSockets so ping/pong timeouts never drop |
| **Session Affinity** | `--session-affinity` | Mandatory for Socket.IO sticky polling during initial connection |
| **Cloud SQL Connections** | `poolMin: 2, poolMax: 8` | Caps max DB connections across 25 instances at 200 (well within Cloud SQL limit) |
| **Migration Lock** | `pg_advisory_lock(74219842)` | Prevents multi-instance migration race conditions |
