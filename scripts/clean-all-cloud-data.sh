#!/bin/bash
# ==============================================================================
# KnotNex — Complete Cloud Data & Storage Wipe Script
# Project: lively-welder-512304-n4 | Region: asia-south1
# ==============================================================================
set -e

PROJECT_ID="lively-welder-512304-n4"
DB_INSTANCE="knotnex-db"
DB_NAME="knotnex_db"
MEDIA_BUCKET="knotnex-media-prod"
PRIVATE_BUCKET="knotnex-private-prod"
FIREBASE_PROJECT="knotnex-f68fd"

echo "================================================================="
echo "⚠️  WIPING ALL KNOTNEX CLOUD STORAGE & SERVER DATA"
echo "Project: $PROJECT_ID"
echo "================================================================="

# 1. Clean Cloud Storage Buckets
echo "==> 1. Emptying Cloud Storage buckets..."
gcloud storage rm --recursive "gs://$MEDIA_BUCKET/**" --project="$PROJECT_ID" --quiet 2>/dev/null || true
gcloud storage rm --recursive "gs://$PRIVATE_BUCKET/**" --project="$PROJECT_ID" --quiet 2>/dev/null || true
echo "✅ Cloud Storage media and private buckets cleared."

# 2. Reset Database (Drop & Re-create database on Cloud SQL)
echo "==> 2. Resetting Cloud SQL Database ($DB_NAME on $DB_INSTANCE)..."
gcloud sql databases delete "$DB_NAME" --instance="$DB_INSTANCE" --project="$PROJECT_ID" --quiet 2>/dev/null || true
gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE" --project="$PROJECT_ID"
echo "✅ Cloud SQL Database recreated cleanly."

# 3. Clean Firebase Authentication Users (Optional / if firebase CLI logged in)
if command -v firebase &> /dev/null; then
  echo "==> 3. Clearing Firebase Auth users..."
  firebase auth:export /tmp/users.json --project "$FIREBASE_PROJECT" --quiet 2>/dev/null || true
  if [ -s /tmp/users.json ]; then
    firebase auth:delete /tmp/users.json --project "$FIREBASE_PROJECT" --force --quiet 2>/dev/null || true
    rm -f /tmp/users.json
    echo "✅ Firebase Auth users deleted."
  else
    echo "ℹ️  Firebase Auth had no users or export skipped."
  fi
fi

echo "================================================================="
echo "🎉 ALL KNOTNEX CLOUD DATA AND STORAGE HAVE BEEN CLEANED!"
echo "Now run database migrations: npm run db:migrate:prod (or npm run db:migrate)"
echo "================================================================="

