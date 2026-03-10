#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deploy Gemini Tutor to Google Cloud Run
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
SERVICE_NAME="gemini-tutor-ai"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No GCP project configured."
  echo "   Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  Deploying Gemini Tutor to Google Cloud Run"
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
# Read GEMINI_API_KEY from .env if available
GEMINI_KEY=""
if [ -f .env ]; then
  GEMINI_KEY=$(grep '^GEMINI_API_KEY=' .env | cut -d'=' -f2-)
fi

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION,GEMINI_API_KEY=$GEMINI_KEY" \
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
