# Backend Cloud Function

`backend/cloud-function/` contains a Google Cloud Functions service that supports
the email channel: it ingests inbound Gmail, enriches it with AI, brokers scoped
Gmail tokens, and exposes agent‑activity/config helpers.

- Entry: [backend/cloud-function/index.js](../backend/cloud-function/index.js)
- Package: [backend/cloud-function/package.json](../backend/cloud-function/package.json)
- BigQuery schema: [backend/cloud-function/schema.bigquery.sql](../backend/cloud-function/schema.bigquery.sql)
- GCP setup helper: [backend/cloud-function/setup-gcp.sh](../backend/cloud-function/setup-gcp.sh)

---

## Modules

| File | Responsibility |
|---|---|
| [index.js](../backend/cloud-function/index.js) | HTTP entry / routing. |
| [gmail.js](../backend/cloud-function/gmail.js) | Gmail API: watch registration, message fetch/parse. |
| [ai.js](../backend/cloud-function/ai.js) | AI enrichment (summaries / hints). |
| [token-broker.js](../backend/cloud-function/token-broker.js) | Mints scoped Gmail OAuth tokens after Webex identity verification. |
| [config-api.js](../backend/cloud-function/config-api.js) | Webex CC Config API helpers. |
| [activity.js](../backend/cloud-function/activity.js) | Agent‑activity data (feeds the Agent Activity widget). |
| [agent-state.js](../backend/cloud-function/agent-state.js) | Agent‑state (AAR) data. |

---

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check. |
| `POST /inbound` | Receives Gmail Pub/Sub push, enriches with AI, forwards to Webex Connect. |
| `POST /watch` | Registers a Gmail inbox watch subscription. |
| `POST /token` | Mints a scoped Gmail OAuth token after Webex identity verification. |

> The activity/config/agent‑state modules also back the supervisor widgets — see
> [Agent Activity](agent-activity-widget.md) and [Bulk Reskill](bulk-reskill-widget.md).

---

## Setup

```bash
cd backend/cloud-function
cp .env.example .env
# fill in GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, WEBEX_TOKEN_VALIDATION_URL, etc.
npm install
```

Deploy with the Google Cloud CLI:

```bash
gcloud functions deploy inbound \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated
```

See [setup-gcp.sh](../backend/cloud-function/setup-gcp.sh) for the full GCP
resource bootstrap (Pub/Sub topic, service accounts, BigQuery dataset).
