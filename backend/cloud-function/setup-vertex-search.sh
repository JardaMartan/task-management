#!/usr/bin/env bash
#
# Provision + deploy the innogy.cz "Péče" knowledge-base crawler and its
# Vertex AI Search (Discovery Engine) data store.
#
#   1. Enables required APIs (Cloud Functions, Run, Build, Storage, Discovery Engine)
#   2. Creates the GCS staging bucket
#   3. Deploys the `crawlPece` Cloud Function (gen2, HTTP)
#   4. Grants the function's service account the roles it needs
#   5. Creates a Cloud Scheduler job to run the crawl periodically
#   6. Triggers one crawl and prints the DATA STORE LINK
#
# The data store itself is created automatically by the function on first run
# (ensureDataStore) — no manual data-store step is required here.
#
# Prereqs: gcloud CLI authenticated (`gcloud auth login`) with rights on the
# target project. Re-runnable (idempotent where the APIs allow).
#
# Usage (from backend/cloud-function/):
#   PROJECT=my-project REGION=us-central1 VAIS_LOCATION=eu ./setup-vertex-search.sh
#
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
VAIS_LOCATION="${VAIS_LOCATION:-eu}"
DATA_STORE_ID="${VAIS_DATA_STORE_ID:-innogy-pece}"
DATA_STORE_NAME="${VAIS_DATA_STORE_NAME:-Innogy Péče Knowledge Base}"
BUCKET="${VAIS_BUCKET:-${PROJECT}-innogy-pece}"
SEED_URL="${CRAWL_SEED_URL:-https://www.innogy.cz/pece/}"
SCHEDULE="${CRAWL_SCHEDULE:-0 3 * * *}"          # daily 03:00
TRIGGER_TOKEN="${CRAWL_TRIGGER_TOKEN:-$(openssl rand -hex 16)}"
FUNCTION_NAME="innogy-pece-crawl"

if [[ -z "${PROJECT}" ]]; then
  echo "ERROR: no project set. Pass PROJECT=… or run 'gcloud config set project <id>'." >&2
  exit 1
fi

echo "==> Project: ${PROJECT} | Region: ${REGION} | Data store: ${DATA_STORE_ID} (${VAIS_LOCATION})"

echo "==> Enabling APIs…"
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  discoveryengine.googleapis.com \
  --project "${PROJECT}"

echo "==> Ensuring GCS staging bucket gs://${BUCKET}…"
if ! gcloud storage buckets describe "gs://${BUCKET}" --project "${PROJECT}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --project "${PROJECT}" --location "${VAIS_LOCATION}" --uniform-bucket-level-access
else
  echo "    Bucket already exists — skipping."
fi

echo "==> Deploying '${FUNCTION_NAME}' Cloud Function (gen2)…"
gcloud functions deploy "${FUNCTION_NAME}" \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --source=. \
  --entry-point=crawlPece \
  --trigger-http \
  --memory=1Gi \
  --timeout=540s \
  --set-env-vars="GCP_PROJECT=${PROJECT},VAIS_LOCATION=${VAIS_LOCATION},VAIS_DATA_STORE_ID=${DATA_STORE_ID},VAIS_DATA_STORE_NAME=${DATA_STORE_NAME},VAIS_BUCKET=${BUCKET},CRAWL_SEED_URL=${SEED_URL},CRAWL_TRIGGER_TOKEN=${TRIGGER_TOKEN}" \
  --project "${PROJECT}"

FUNC_URL="$(gcloud functions describe "${FUNCTION_NAME}" --gen2 --region="${REGION}" --project "${PROJECT}" --format='value(serviceConfig.uri)')"
SA_EMAIL="$(gcloud functions describe "${FUNCTION_NAME}" --gen2 --region="${REGION}" --project "${PROJECT}" --format='value(serviceConfig.serviceAccountEmail)')"

echo "==> Granting the function service account (${SA_EMAIL}) required roles…"
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/discoveryengine.admin" --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/storage.objectAdmin" >/dev/null

echo "==> Allowing the service account to invoke the (private) function…"
# The function stays authenticated (no --allow-unauthenticated); the scheduler
# calls it with an OIDC token, so the SA needs run.invoker on the underlying
# Cloud Run service.
gcloud run services add-iam-policy-binding "${FUNCTION_NAME}" \
  --project "${PROJECT}" --region "${REGION}" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/run.invoker" >/dev/null

echo "==> Creating Cloud Scheduler job (schedule: '${SCHEDULE}')…"
gcloud scheduler jobs create http "${FUNCTION_NAME}-schedule" \
  --project "${PROJECT}" --location "${REGION}" \
  --schedule="${SCHEDULE}" \
  --uri="${FUNC_URL}" \
  --http-method=POST \
  --headers="X-Trigger-Token=${TRIGGER_TOKEN}" \
  --oidc-service-account-email="${SA_EMAIL}" \
  --oidc-token-audience="${FUNC_URL}" \
  2>/dev/null || \
gcloud scheduler jobs update http "${FUNCTION_NAME}-schedule" \
  --project "${PROJECT}" --location "${REGION}" \
  --schedule="${SCHEDULE}" \
  --uri="${FUNC_URL}" \
  --http-method=POST \
  --headers="X-Trigger-Token=${TRIGGER_TOKEN}" \
  --oidc-service-account-email="${SA_EMAIL}" \
  --oidc-token-audience="${FUNC_URL}"

echo "==> Triggering the first crawl (via the scheduler job's OIDC identity)…"
gcloud scheduler jobs run "${FUNCTION_NAME}-schedule" \
  --project "${PROJECT}" --location "${REGION}" || true
echo

echo
echo "======================================================================"
echo " Vertex AI Search DATA STORE LINK (use as a Gemini RAG grounding source):"
echo "   https://console.cloud.google.com/gen-app-builder/locations/${VAIS_LOCATION}/data-stores/${DATA_STORE_ID}/documents?project=${PROJECT}"
echo
echo " Data store resource name (for the Gemini API / grounding config):"
echo "   projects/${PROJECT}/locations/${VAIS_LOCATION}/collections/default_collection/dataStores/${DATA_STORE_ID}"
echo "======================================================================"
