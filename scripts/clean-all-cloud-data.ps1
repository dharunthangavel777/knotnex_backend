# ==============================================================================
# KnotNex — Complete Cloud Data & Storage Wipe Script (PowerShell)
# Project: lively-welder-512304-n4 | Region: asia-south1
# ==============================================================================
$ErrorActionPreference = "Continue"

$PROJECT_ID = "lively-welder-512304-n4"
$DB_INSTANCE = "knotnex-db"
$DB_NAME = "knotnex_db"
$MEDIA_BUCKET = "knotnex-media-prod"
$PRIVATE_BUCKET = "knotnex-private-prod"
$FIREBASE_PROJECT = "knotnex-f68fd"

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "⚠️  WIPING ALL KNOTNEX CLOUD STORAGE & SERVER DATA" -ForegroundColor Red
Write-Host "Project: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Yellow

# 1. Clean Cloud Storage Buckets
Write-Host "==> 1. Emptying Cloud Storage buckets..." -ForegroundColor Cyan
gcloud storage rm --recursive "gs://$MEDIA_BUCKET/**" --project="$PROJECT_ID" --quiet
gcloud storage rm --recursive "gs://$PRIVATE_BUCKET/**" --project="$PROJECT_ID" --quiet
Write-Host "✅ Cloud Storage media and private buckets cleared." -ForegroundColor Green

# 2. Reset Database
Write-Host "==> 2. Resetting Cloud SQL Database ($DB_NAME on $DB_INSTANCE)..." -ForegroundColor Cyan
gcloud sql databases delete "$DB_NAME" --instance="$DB_INSTANCE" --project="$PROJECT_ID" --quiet
gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE" --project="$PROJECT_ID"
Write-Host "✅ Cloud SQL Database recreated cleanly." -ForegroundColor Green

Write-Host "=================================================================" -ForegroundColor Green
Write-Host "🎉 ALL KNOTNEX CLOUD DATA AND STORAGE HAVE BEEN CLEANED!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

