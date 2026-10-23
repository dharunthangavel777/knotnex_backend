#!/bin/bash
# ==============================================================================
# KnotNex — Low-Cost, High-Performance GCP Setup Script
# Architecture: Cloud Run + Cloud SQL (PostgreSQL) + Cloud Storage
# Target Project: lively-welder-512304-n4 | Region: asia-south1 (Mumbai)
# Estimated Monthly Cost: ₹2,640 – ₹3,720 / month (~$32 – $45 / month)
# ==============================================================================

set -e

# ─── 0. Configuration Variables ───────────────────────────────────────────────
export PROJECT_ID="lively-welder-512304-n4"
export REGION="asia-south1"
export DB_INSTANCE_NAME="knotnex-db"
export DB_NAME="knotnex_db"
export DB_USER="postgres"
export DB_PASSWORD="knotnex@2026" # Change if desired
export MEDIA_BUCKET="knotnex-media-prod"
export PRIVATE_BUCKET="knotnex-private-prod"
export ARTIFACT_REPO="knotnex"
export CLOUD_RUN_SERVICE="knotnex-backend"

echo "================================================================="
echo "🚀 Starting GCP Setup for KnotNex (Project: $PROJECT_ID)"
echo "📍 Region: $REGION"
echo "================================================================="

# Set active project
gcloud config set project "$PROJECT_ID"

# ─── 1. Enable Required GCP APIs (Pay-as-you-go / Free to enable) ──────────────
echo "==> Step 1: Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

# ─── 2. Create Artifact Registry Repository (For Docker Images) ────────────────
echo "==> Step 2: Creating Artifact Registry Docker repository..."
if ! gcloud artifacts repositories describe "$ARTIFACT_REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="KnotNex Backend Container Images"
  echo "✅ Artifact Registry repository '$ARTIFACT_REPO' created."
else
  echo "ℹ️ Artifact Registry repository '$ARTIFACT_REPO' already exists."
fi

# ─── 3. Create Cloud Storage Buckets (Low-Cost Standard Storage) ───────────────
echo "==> Step 3: Creating Cloud Storage Buckets in $REGION..."

# 3.1 Media Bucket (Public avatar, reels, event banners)
if ! gsutil ls -b "gs://$MEDIA_BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$MEDIA_BUCKET" \
    --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access
  
  # Allow public read access to media files
  gcloud storage buckets add-iam-policy-binding "gs://$MEDIA_BUCKET" \
    --member="allUsers" \
    --role="roles/storage.objectViewer"
  echo "✅ Public media bucket created: gs://$MEDIA_BUCKET"
else
  echo "ℹ️ Media bucket gs://$MEDIA_BUCKET already exists."
fi

# 3.2 Private Bucket (Verification docs, sensitive attachments)
if ! gsutil ls -b "gs://$PRIVATE_BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$PRIVATE_BUCKET" \
    --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access
  echo "✅ Private bucket created: gs://$PRIVATE_BUCKET"
else
  echo "ℹ️ Private bucket gs://$PRIVATE_BUCKET already exists."
fi

# 3.3 Set CORS policy for direct uploads from Flutter / Web
cat << 'EOF' > /tmp/gcs-cors.json
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable", "ETag"],
    "maxAgeSeconds": 3600
  }
]
EOF

gcloud storage buckets update "gs://$MEDIA_BUCKET" --cors-file=/tmp/gcs-cors.json
gcloud storage buckets update "gs://$PRIVATE_BUCKET" --cors-file=/tmp/gcs-cors.json
rm -f /tmp/gcs-cors.json
echo "✅ CORS policies applied to both storage buckets."

# ─── 4. Create Cloud SQL (PostgreSQL 15 — Low Cost Tier: db-g1-small) ──────────
echo "==> Step 4: Provisioning Cloud SQL PostgreSQL instance ($DB_INSTANCE_NAME)..."
if ! gcloud sql instances describe "$DB_INSTANCE_NAME" >/dev/null 2>&1; then
  gcloud sql instances create "$DB_INSTANCE_NAME" \
    --database-version=POSTGRES_15 \
    --tier=db-g1-small \
    --region="$REGION" \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --root-password="$DB_PASSWORD" \
    --no-deletion-protection

  echo "✅ Cloud SQL instance created."

  # Create primary database
  echo "==> Creating database '$DB_NAME'..."
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE_NAME"
  echo "✅ Database '$DB_NAME' created."
else
  echo "ℹ️ Cloud SQL instance '$DB_INSTANCE_NAME' already exists."
fi

# Get Cloud SQL Connection Name (e.g. lively-welder-512304-n4:asia-south1:knotnex-db)
SQL_CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --format="value(connectionName)")
echo "🔗 Cloud SQL Connection Name: $SQL_CONNECTION_NAME"

# ─── 5. Configure Cloud Run Service Account & Permissions ─────────────────────
echo "==> Step 5: Setting up Cloud Run Service Account..."
export RUN_SA="knotnex-cloudrun-sa"
export RUN_SA_EMAIL="$RUN_SA@$PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$RUN_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUN_SA" \
    --display-name="KnotNex Cloud Run Service Account"
  echo "✅ Service account created: $RUN_SA_EMAIL"
fi

# Grant Cloud SQL Client permission to connect via unix socket/proxy
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUN_SA_EMAIL" \
  --role="roles/cloudsql.client" >/dev/null

# Grant Cloud Storage Admin to upload/sign URLs
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUN_SA_EMAIL" \
  --role="roles/storage.objectAdmin" >/dev/null

# Grant Token Creator for direct signed URLs
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA_EMAIL" \
  --member="serviceAccount:$RUN_SA_EMAIL" \
  --role="roles/iam.serviceAccountTokenCreator" >/dev/null

echo "✅ IAM permissions granted to $RUN_SA_EMAIL."

# ─── 6. Deploy Cloud Run Service (Low-Cost High-Performance Spec) ─────────────
echo "==> Step 6: Deploying Cloud Run service: $CLOUD_RUN_SERVICE..."
echo "    - Min Instances: 0 (Scale to zero when idle = ₹0 idle cost)"
echo "    - Max Instances: 5"
echo "    - Concurrency: 40 requests per container"
echo "    - CPU: 1 vCPU | Memory: 1 GiB"
echo "    - Region: $REGION"

# Cloud SQL Unix Socket URL when using Cloud SQL Auth Proxy on Cloud Run:
# Format: postgresql://USER:PASSWORD@/DB_NAME?host=/cloudsql/CONNECTION_NAME
PROD_DB_URL="postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$SQL_CONNECTION_NAME"

echo "ℹ️ Cloud Run deployment command:"
cat << EOF

Run this command once your Docker image is built and pushed:

gcloud run deploy "$CLOUD_RUN_SERVICE" \\
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/api:latest" \\
  --region="$REGION" \\
  --platform="managed" \\
  --allow-unauthenticated \\
  --service-account="$RUN_SA_EMAIL" \\
  --add-cloudsql-instances="$SQL_CONNECTION_NAME" \\
  --port="8080" \\
  --min-instances="0" \\
  --max-instances="5" \\
  --concurrency="40" \\
  --cpu="1" \\
  --memory="1Gi" \\
  --set-env-vars="NODE_ENV=production,APP_ENV=production,GCS_PROJECT_ID=$PROJECT_ID,GCS_MEDIA_BUCKET=$MEDIA_BUCKET,GCS_PRIVATE_BUCKET=$PRIVATE_BUCKET,DATABASE_URL=$PROD_DB_URL,AUTO_RUN_MIGRATIONS=true"

EOF

echo "================================================================="
echo "🎉 KnotNex GCP Setup Completed Successfully!"
echo "   - Project: $PROJECT_ID"
echo "   - Cloud SQL Connection: $SQL_CONNECTION_NAME"
echo "   - Media Bucket: gs://$MEDIA_BUCKET (Public read enabled)"
echo "   - Private Bucket: gs://$PRIVATE_BUCKET"
echo "   - Artifact Registry: $REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO"
echo "================================================================="
