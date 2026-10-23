# ==============================================================================
# KnotNex — Low-Cost, High-Performance GCP Setup Script (PowerShell)
# Architecture: Cloud Run + Cloud SQL (PostgreSQL) + Cloud Storage
# Target Project: lively-welder-512304-n4 | Region: asia-south1 (Mumbai)
# ==============================================================================

$ErrorActionPreference = "Stop"

$PROJECT_ID = "lively-welder-512304-n4"
$REGION = "asia-south1"
$DB_INSTANCE_NAME = "knotnex-db"
$DB_NAME = "knotnex_db"
$DB_USER = "postgres"
$DB_PASSWORD = "knotnex@2026"
$MEDIA_BUCKET = "knotnex-media-prod"
$PRIVATE_BUCKET = "knotnex-private-prod"
$ARTIFACT_REPO = "knotnex"
$CLOUD_RUN_SERVICE = "knotnex-backend"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting GCP Setup for KnotNex (Project: $PROJECT_ID)" -ForegroundColor Cyan
Write-Host "📍 Region: $REGION" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# Set active project
gcloud config set project $PROJECT_ID

# 1. Enable Required APIs
Write-Host "==> Step 1: Enabling required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable `
  run.googleapis.com `
  sqladmin.googleapis.com `
  storage.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  secretmanager.googleapis.com

# 2. Create Artifact Registry
Write-Host "==> Step 2: Creating Artifact Registry Docker repository..." -ForegroundColor Yellow
gcloud artifacts repositories create $ARTIFACT_REPO `
  --repository-format=docker `
  --location=$REGION `
  --description="KnotNex Backend Container Images" 2>$null

# 3. Create Cloud Storage Buckets
Write-Host "==> Step 3: Creating Cloud Storage Buckets..." -ForegroundColor Yellow
gcloud storage buckets create "gs://$MEDIA_BUCKET" --location=$REGION --default-storage-class=STANDARD --uniform-bucket-level-access 2>$null
gcloud storage buckets add-iam-policy-binding "gs://$MEDIA_BUCKET" --member="allUsers" --role="roles/storage.objectViewer" 2>$null

gcloud storage buckets create "gs://$PRIVATE_BUCKET" --location=$REGION --default-storage-class=STANDARD --uniform-bucket-level-access 2>$null

# 4. Cloud SQL
Write-Host "==> Step 4: Creating Cloud SQL PostgreSQL instance (db-g1-small)..." -ForegroundColor Yellow
gcloud sql instances create $DB_INSTANCE_NAME `
  --database-version=POSTGRES_15 `
  --tier=db-g1-small `
  --region=$REGION `
  --storage-type=SSD `
  --storage-size=10GB `
  --storage-auto-increase `
  --backup-start-time=03:00 `
  --root-password=$DB_PASSWORD `
  --no-deletion-protection 2>$null
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE_NAME 2>$null

$SQL_CONNECTION_NAME = (gcloud sql instances describe $DB_INSTANCE_NAME --format="value(connectionName)")
Write-Host "🔗 Cloud SQL Connection Name: $SQL_CONNECTION_NAME" -ForegroundColor Green

# 5. Service Account
Write-Host "==> Step 5: Configuring Service Account and IAM..." -ForegroundColor Yellow
$RUN_SA = "knotnex-cloudrun-sa"
$RUN_SA_EMAIL = "$RUN_SA@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create $RUN_SA --display-name="KnotNex Cloud Run Service Account" 2>$null
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$RUN_SA_EMAIL" --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$RUN_SA_EMAIL" --role="roles/storage.objectAdmin"
gcloud iam service-accounts add-iam-policy-binding $RUN_SA_EMAIL --member="serviceAccount:$RUN_SA_EMAIL" --role="roles/iam.serviceAccountTokenCreator"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete! Run 'gcloud builds submit' to build and deploy." -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
