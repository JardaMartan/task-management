# Backend Cloud Function

`backend/cloud-function/` contains a Google Cloud Functions service that supports
the email channel and the supervisor widgets: it ingests inbound Gmail, enriches
it with AI, brokers scoped Gmail/AI tokens, exposes agent‑activity/config
helpers, persists Agent Experience settings, proxies voice transcripts, and
periodically crawls a public knowledge-base site into a Vertex AI Search data
store for Gemini RAG grounding.

- Entry: [backend/cloud-function/index.js](../backend/cloud-function/index.js)
- Package: [backend/cloud-function/package.json](../backend/cloud-function/package.json)
- BigQuery schema: [backend/cloud-function/schema.bigquery.sql](../backend/cloud-function/schema.bigquery.sql)
- GCP setup helpers: [setup-gcp.sh](../backend/cloud-function/setup-gcp.sh) (activity),
  [setup-vertex-search.sh](../backend/cloud-function/setup-vertex-search.sh) (crawler / Vertex AI Search)

---

## Modules

| File | Responsibility |
|---|---|
| [index.js](../backend/cloud-function/index.js) | HTTP entry / routing. |
| [gmail.js](../backend/cloud-function/gmail.js) | Gmail API: watch registration, message fetch/parse. |
| [ai.js](../backend/cloud-function/ai.js) | AI enrichment (summaries / hints). |
| [token-broker.js](../backend/cloud-function/token-broker.js) | Mints scoped Gmail/Gemini OAuth tokens after Webex identity verification. |
| [config-api.js](../backend/cloud-function/config-api.js) | Webex CC Config API helpers. |
| [activity.js](../backend/cloud-function/activity.js) | Agent‑activity data (feeds the Agent Activity widget). |
| [agent-state.js](../backend/cloud-function/agent-state.js) | Agent‑state (AAR) data. |
| [jds.js](../backend/cloud-function/jds.js) | Customer name resolution via JDS aliases. |
| [transcript.js](../backend/cloud-function/transcript.js) | Voice transcript retrieval (Captures API). |
| [experience.js](../backend/cloud-function/experience.js) | Agent Experience config (templates/signatures/prompts), Firestore-backed. |
| [crawler.js](../backend/cloud-function/crawler.js) | Web crawler + noise-aware content extraction for the knowledge-base pipeline. |
| [vertex-search.js](../backend/cloud-function/vertex-search.js) | Stages crawled docs to GCS and imports them into a Vertex AI Search data store. |

---

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check. |
| `POST /inbound` | Receives Gmail Pub/Sub push, enriches with AI, forwards to Webex Connect. |
| `POST /auth` | Mints scoped Gmail/Gemini OAuth tokens after Webex identity verification. |
| `GET/POST /renewWatch` | Renews the Gmail inbox watch subscription (called by Cloud Scheduler). |
| `GET/POST /activity` | Ingests and queries agent-activity events (feeds the Agent Activity widget). |
| `GET/POST /transcript` | Retrieves a voice interaction's transcript via Captures (feeds the Task Management widget). |
| `GET/POST /experience` | Reads/writes Agent Experience config — templates, signatures, team assignments, proofread prompts (feeds the Agent Experience widget). |
| `POST /crawlPece` | Crawls a configured knowledge-base site + one level deep and rebuilds the Vertex AI Search data store. Guarded by an optional `X-Trigger-Token` header; intended for Cloud Scheduler. |

> The activity/config/agent‑state modules also back the supervisor widgets — see
> [Agent Activity](agent-activity-widget.md), [Bulk Reskill](bulk-reskill-widget.md),
> and [Agent Experience](agent-experience-widget.md).

---

## Setup

```bash
cd backend/cloud-function
cp .env.example .env
# fill in GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, WEBEX_TOKEN_VALIDATION_URL, etc.
npm install
```

### Environment variables ([.env.example](../backend/cloud-function/.env.example))

| Variable | Used by | Purpose |
|---|---|---|
| `PUBSUB_TOPIC` | `inbound` | Gmail push-notification Pub/Sub topic. |
| `SUPPORT_EMAIL` | `renewWatch` | Mailbox to (re)register the Gmail watch for. |
| `WEBEX_CONNECT_INBOUND_WEBHOOK` | `inbound` | Webhook URL that receives enriched inbound emails. |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | `ai.js` | AI enrichment provider (`gemini` \| `openai`), key, and model. |
| `CORS_ORIGIN` | `auth`, `activity`, `transcript`, `experience` | CORS origin allowed for browser-facing endpoints. |
| `GCP_PROJECT` | `crawlPece` | Target GCP project for the Vertex AI Search data store (defaults to ADC project). |
| `VAIS_LOCATION` | `crawlPece` | Discovery Engine location: `global` \| `us` \| `eu`. |
| `VAIS_DATA_STORE_ID` / `VAIS_DATA_STORE_NAME` | `crawlPece` | Data store id + display name (created automatically on first run). |
| `VAIS_BUCKET` / `VAIS_GCS_PREFIX` | `crawlPece` | GCS bucket + prefix used to stage crawled content before import. |
| `CRAWL_SEED_URL` | `crawlPece` | Page to crawl (plus one level of same-host links under its path). |
| `CRAWL_MAX_PAGES` / `CRAWL_DELAY_MS` | `crawlPece` | Crawl page budget and per-request delay. |
| `CRAWL_TRIGGER_TOKEN` | `crawlPece` | Optional shared secret checked against the `X-Trigger-Token` header. |

### Deploy scripts ([package.json](../backend/cloud-function/package.json))

```bash
npm run deploy:inbound      # email-inbound    (Pub/Sub trigger)
npm run deploy:auth         # email-auth       (HTTP, unauthenticated)
npm run deploy:watch        # email-renew-watch (HTTP)
npm run deploy:activity     # activity         (HTTP, unauthenticated)
npm run deploy:transcript   # transcript       (HTTP, unauthenticated)
npm run deploy:experience   # experience       (HTTP, unauthenticated)
npm run deploy:crawl        # innogy-pece-crawl (HTTP, authenticated — see setup-vertex-search.sh)
```

See [setup-gcp.sh](../backend/cloud-function/setup-gcp.sh) for the activity
widget's GCP resource bootstrap (Pub/Sub topic, service accounts, BigQuery
dataset), and [setup-vertex-search.sh](../backend/cloud-function/setup-vertex-search.sh)
for the knowledge-base crawler: it provisions the GCS staging bucket, deploys
`crawlPece` **without** `--allow-unauthenticated`, grants the function's service
account `roles/run.invoker` + `roles/discoveryengine.admin`, creates a daily
Cloud Scheduler job (OIDC-authenticated), runs the first crawl, and prints the
Vertex AI Search data store's console link and resource name — attach that data
store to a Gemini API call via the Vertex AI Search grounding tool for RAG.

