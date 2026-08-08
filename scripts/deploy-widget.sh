#!/usr/bin/env bash
#
# Deploy raw (non-bundled) widget JS to the GCS dist bucket and VERIFY that the
# publicly-served bytes match local. This makes silent failures impossible:
#   - gcloud auth/reauth failures abort (no pipe masks the exit code)
#   - a stale CDN/browser copy is caught by an md5 comparison of the served file
#   - Cache-Control is (re)set to no-cache so browsers always revalidate
#
# Usage:  bash scripts/deploy-widget.sh [file ...]
#   default files: panel-layout-headless.js crm-sync-header.js activity-emitter.js
#   files are read from dist/<file> (copied there by `npm run build`, or cp'd).
set -euo pipefail

BUCKET="${DIST_BUCKET:-gs://newagent-kxwo-relay-dist}"
PROJECT="${GCP_PROJECT:-newagent-kxwo}"
PUBLIC_BASE="${PUBLIC_BASE:-https://newagent-kxwo-relay-dist.storage.googleapis.com}"
CACHE_CONTROL="no-cache, max-age=0"

FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
  FILES=(panel-layout-headless.js crm-sync-header.js activity-emitter.js)
fi

md5of() { if command -v md5 >/dev/null 2>&1; then md5 -q "$1"; else md5sum "$1" | awk '{print $1}'; fi; }

# Auth/access preflight — fail early with a clear message instead of shipping a
# silent stale deploy (the exact bug this script exists to prevent).
if ! gcloud storage ls "$BUCKET" --project "$PROJECT" >/dev/null 2>&1; then
  echo "ERROR: cannot access $BUCKET (auth or permissions)." >&2
  echo "       Run:  gcloud auth login   (then re-run this deploy)" >&2
  exit 1
fi

fail=0
for f in "${FILES[@]}"; do
  local_path="dist/$f"
  if [ ! -f "$local_path" ]; then echo "SKIP $f (dist/$f not found)"; continue; fi
  echo "→ uploading $f"
  gcloud storage cp "$local_path" "$BUCKET/$f" --cache-control="$CACHE_CONTROL" --project "$PROJECT"

  # Verify the served object matches local, byte-for-byte, with a cache-buster.
  served="$(mktemp)"
  curl -fsS "$PUBLIC_BASE/$f?cb=$(date +%s)$RANDOM" -o "$served"
  cc="$(curl -fsSI "$PUBLIC_BASE/$f?cb=$(date +%s)$RANDOM" | tr -d '\r' | awk -F': ' 'tolower($1)=="cache-control"{print $2}')"
  lm="$(md5of "$local_path")"; sm="$(md5of "$served")"; rm -f "$served"
  if [ "$lm" = "$sm" ]; then
    echo "   verified $f  md5=$sm  cache-control='${cc:-<none>}'"
  else
    echo "   MISMATCH $f  local=$lm  served=$sm" >&2; fail=1
  fi
done

if [ "$fail" -ne 0 ]; then echo "DEPLOY VERIFICATION FAILED" >&2; exit 1; fi
echo "ALL WIDGETS VERIFIED"
