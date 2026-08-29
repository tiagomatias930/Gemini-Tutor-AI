#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deploy Ngola Tutor to Google Cloud Run
#
# Prerequisites:
#   1. Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install
#   2. Authenticate: gcloud auth login
#   3. Create a project: gcloud projects create YOUR_PROJECT_ID
#   4. Set project: gcloud config set project YOUR_PROJECT_ID
#   5. Enable APIs:
#      gcloud services enable run.googleapis.com
#      gcloud services enable cloudbuild.googleapis.com
#      gcloud services enable aiplatform.googleapis.com
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get project 2>/dev/null)}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE_NAME="ngola-tutor-ai"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No GCP project configured."
  echo "   Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  Deploying Ngola Tutor to Google Cloud Run"
echo "═══════════════════════════════════════════════════════"
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Service:  $SERVICE_NAME"
echo "  Image:    $IMAGE_NAME"
echo "═══════════════════════════════════════════════════════"
echo ""

# Step 1: Enable required APIs


# Step 1b: Create Firestore database if it doesn't exist
echo ""
echo "🗄️  Ensuring Firestore database exists..."
gcloud firestore databases describe --project="$PROJECT_ID" 2>/dev/null || \
  gcloud firestore databases create \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --quiet 2>/dev/null || \
  echo "   Firestore database already exists or was just created."

# Step 2: Build container image using Cloud Build
echo ""
echo "🏗️  Building container image with Cloud Build..."
gcloud builds submit \
  --tag "$IMAGE_NAME" \
  --project="$PROJECT_ID" \
  --quiet

# Step 3: Deploy to Cloud Run
echo ""
echo "🚀 Deploying to Cloud Run..."
# Read secrets from .env if available
read_env() {
  [ -f .env ] && grep "^$1=" .env | head -n1 | cut -d'=' -f2- || true
}
GEMINI_KEY=$(read_env GEMINI_API_KEY)
SESSION_SECRET=$(read_env SESSION_SECRET)
ADMIN_SECRET=$(read_env ADMIN_SECRET)

# The server refuses to start in production without a stable session secret, and
# admin login stays disabled without an admin secret. Fail here with a clear
# message instead of shipping a container that crashes or half-works.
if [ ${#SESSION_SECRET} -lt 32 ]; then
  echo "❌ Error: SESSION_SECRET must be set in .env with at least 32 characters."
  echo "   Generate one with: openssl rand -hex 32"
  echo "   Keep it stable across deploys, or every user session and admin login is invalidated."
  exit 1
fi
if [ -z "$ADMIN_SECRET" ]; then
  echo "❌ Error: ADMIN_SECRET is not set in .env, so /admin login would return 503."
  echo "   Generate one with: openssl rand -hex 24"
  exit 1
fi
if [ -z "$GEMINI_KEY" ]; then
  echo "❌ Error: GEMINI_API_KEY is not set in .env."
  exit 1
fi

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "^@^GOOGLE_CLOUD_PROJECT=$PROJECT_ID@GOOGLE_CLOUD_LOCATION=$REGION@GEMINI_API_KEY=$GEMINI_KEY@SESSION_SECRET=$SESSION_SECRET@ADMIN_SECRET=$ADMIN_SECRET" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --project="$PROJECT_ID" \
  --quiet

# Step 4: Get the deployed URL
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "═══════════════════════════════════════════════════════"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project="$PROJECT_ID" \
  --format 'value(status.url)')
echo "  URL: $SERVICE_URL"
echo "  Health: $SERVICE_URL/api/health"
echo ""
echo "  To view logs:"
echo "  gcloud run services logs read $SERVICE_NAME --region $REGION"
echo "═══════════════════════════════════════════════════════"
