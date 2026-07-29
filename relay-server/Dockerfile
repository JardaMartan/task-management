FROM node:20-slim

# Mirror the repo layout inside the image:
#   /srv/relay-server/server.js
#   /srv/crm-tab-manager/          ← one level up from server.js, matching the
#                                     path.join(__dirname, '..', 'crm-tab-manager')
#                                     reference in server.js
#
# Build context MUST be the repo root. Use cloudbuild.yaml or:
#   docker build -f relay-server/Dockerfile -t webex-crm-relay .

WORKDIR /srv

# Install relay server dependencies
COPY relay-server/package.json relay-server/
RUN cd relay-server && npm install --omit=dev

# Copy server source, CRM Tab Manager static files, the click-to-contact
# extension, and pre-built widget scripts. NOTE: in Cloud Run, /srv/dist is
# overlaid by a GCS bucket volume (see cloudbuild.yaml / scripts/deploy.sh), so
# this copy is only a fallback baseline for local `docker run`. Frontend-only
# changes are deployed by syncing the bucket, not by rebuilding this image.
COPY relay-server/server.js relay-server/
COPY crm-tab-manager/ crm-tab-manager/
COPY crm-clicktocall-extension/ crm-clicktocall-extension/
COPY dist/ dist/

WORKDIR /srv/relay-server

EXPOSE 8080

CMD ["node", "server.js"]
