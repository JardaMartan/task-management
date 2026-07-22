#!/usr/bin/env bash
#
# Provision + deploy the agent activity analytics backend on GCP.
#
#   1. Enables required APIs
#   2. Creates the Firestore native database (live stream)
#   3. Creates the BigQuery dataset + partitioned events table (historical)
#   4. Deploys the `activity` Cloud Function (gen2, HTTP)
#   5. Prints the function URL to use as `activityurl` in the Desktop layout
#
# Prereqs: gcloud + bq CLIs authenticated (`gcloud auth login`) with rights on
# the target project. Re-runnable (idempotent where the APIs allow).
#
# Usage (from backend/cloud-function/):
#   PROJECT=newagent-kxwo REGION=us-central1 ./setup-gcp.sh
#
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
BQ_DATASET="${BQ_DATASET:-agent_activity}"
BQ_TABLE="${BQ_TABLE:-events}"
BQ_LOCATION="${BQ_LOCATION:-US}"
FS_COLLECTION="${FS_COLLECTION:-agent_activity_live}"

if [[ -z "${PROJECT}" ]]; then
  echo "ERROR: no project set. Pass PROJECT=… or run 'gcloud config set project <id>'." >&2
  exit 1
fi

echo "==> Project: ${PROJECT} | Region: ${REGION} | Dataset: ${BQ_DATASET}.${BQ_TABLE}"

echo "==> Enabling APIs…"
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  bigquery.googleapis.com \
  firestore.googleapis.com \
  --project "${PROJECT}"

echo "==> Ensuring Firestore native database…"
if ! gcloud firestore databases describe --project "${PROJECT}" >/dev/null 2>&1; then
  gcloud firestore databases create --location="${REGION}" --project "${PROJECT}"
else
  echo "    Firestore database already exists — skipping."
fi

echo "==> Ensuring BigQuery dataset…"
bq --location="${BQ_LOCATION}" --project_id="${PROJECT}" mk -f --dataset "${PROJECT}:${BQ_DATASET}" || true

echo "==> Creating BigQuery events table (if not present)…"
bq --project_id="${PROJECT}" query --use_legacy_sql=false < schema.bigquery.sql

echo "==> Deploying 'activity' Cloud Function (gen2)…"
gcloud functions deploy activity \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --source=. \
  --entry-point=activity \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="BQ_DATASET=${BQ_DATASET},BQ_TABLE=${BQ_TABLE},FS_COLLECTION=${FS_COLLECTION}" \
  --project "${PROJECT}"

echo "==> Done. Activity endpoint:"
gcloud functions describe activity --gen2 --region="${REGION}" --project "${PROJECT}" \
  --format="value(serviceConfig.uri)"
echo "    Use the URL above as 'activityurl' in the Desktop layout properties."
