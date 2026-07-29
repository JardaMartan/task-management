#!/usr/bin/env bash
#
# Relay deployment helper.
#
# The relay's /dist assets (widget bundles, extension zip) are served from a
# GCS bucket mounted into the Cloud Run service as a volume at /srv/dist. That
# means a JS-only change is just an object sync — no Docker image rebuild and no
# Cloud Run revision. Only server code / Dockerfile / dependency changes need a
# full rebuild.
#
# Usage:
#   scripts/deploy.sh                 # fast path: build report bundle + sync dist → bucket
#   scripts/deploy.sh frontend        #   (same as default)
#   scripts/deploy.sh sync            # sync existing dist/ → bucket (no build)
#   scripts/deploy.sh full            # build + sync + rebuild image + redeploy Cloud Run
#   scripts/deploy.sh setup           # ONE-TIME: create bucket, seed it, mount it on the service
#
# Override any default via env vars, e.g.:
#   BUILD_CMD="npm run build:standalone" scripts/deploy.sh
#
set -euo pipefail

PROJECT="${PROJECT:-newagent-kxwo}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-webex-crm-relay}"
BUCKET_NAME="${BUCKET_NAME:-${PROJECT}-relay-dist}"
BUCKET="gs://${BUCKET_NAME}"
MOUNT_PATH="${MOUNT_PATH:-/srv/dist}"
ALLOWED_ORGS="${ALLOWED_ORGS:-fc5af61b-06a3-4122-be5c-bb344cffffdc}"
# Frontend build for the fast path (the supervisor activity widget by default).
BUILD_CMD="${BUILD_CMD:-npm run build:report:standalone}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }

build_frontend() {
  log "Building frontend bundle: ${BUILD_CMD}"
  eval "$BUILD_CMD"
}

sync_dist() {
  log "Syncing dist/ → ${BUCKET}"
  gcloud storage rsync dist "${BUCKET}" --recursive --project "${PROJECT}"
  log "Assets published. Live within the FUSE metadata TTL (~60s); new instances are immediate."
}

full_deploy() {
  log "Full deploy: rebuilding image + redeploying Cloud Run"
  gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions="_SERVICE=${SERVICE},_REGION=${REGION},_ALLOWED_ORGS=${ALLOWED_ORGS},_DIST_BUCKET=${BUCKET_NAME}" \
    --project "${PROJECT}"
}

setup() {
  log "One-time setup for ${SERVICE} in ${PROJECT}/${REGION}"

  if gcloud storage buckets describe "${BUCKET}" --project "${PROJECT}" >/dev/null 2>&1; then
    log "Bucket ${BUCKET} already exists."
  else
    log "Creating bucket ${BUCKET}"
    gcloud storage buckets create "${BUCKET}" \
      --project "${PROJECT}" --location "${REGION}" --uniform-bucket-level-access
  fi

  # Grant the service's runtime service account read access to the bucket.
  local sa
  sa="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT}" \
        --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  if [[ -z "${sa}" ]]; then
    local num
    num="$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')"
    sa="${num}-compute@developer.gserviceaccount.com"
  fi
  log "Granting objectViewer on ${BUCKET} to ${sa}"
  gcloud storage buckets add-iam-policy-binding "${BUCKET}" \
    --member="serviceAccount:${sa}" --role="roles/storage.objectViewer" --project "${PROJECT}"

  build_frontend
  sync_dist

  log "Mounting ${BUCKET} at ${MOUNT_PATH} on ${SERVICE} (gen2 execution env)"
  gcloud run services update "${SERVICE}" \
    --region "${REGION}" --project "${PROJECT}" \
    --execution-environment=gen2 \
    --add-volume="name=dist,type=cloud-storage,bucket=${BUCKET_NAME}" \
    --add-volume-mount="volume=dist,mount-path=${MOUNT_PATH}"

  log "Setup complete. From now on use: scripts/deploy.sh   (fast, no rebuild)."
}

mode="${1:-frontend}"
case "$mode" in
  frontend|fe|"")
    build_frontend
    sync_dist
    ;;
  sync)
    sync_dist
    ;;
  full)
    build_frontend
    sync_dist
    full_deploy
    ;;
  setup)
    setup
    ;;
  *)
    echo "Unknown mode: ${mode}" >&2
    echo "Use one of: frontend | sync | full | setup" >&2
    exit 1
    ;;
esac
