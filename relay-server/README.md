# Relay Server

WebSocket relay + static file server that brokers CRM-sync messages between the
Webex CC Desktop (`crm-sync-header.js`, `role='webexcc'`) and the CRM Tab
Manager (`role='crm'`), and serves the built widget bundles, the Tab Manager
app, and the click-to-call extension.

Full protocol, env vars, and deploy steps: **[docs/crm-integration.md § Relay server](../docs/crm-integration.md#2-relay-server-relay-server)**.

## Quick start

```bash
npm install
PORT=3001 ALLOWED_ORG_IDS= npm start
```

- `PORT` — listen port (default `3001`; Cloud Run injects `8080`).
- `ALLOWED_ORG_IDS` — comma-separated Webex org UUIDs allowed to connect as
  `webexcc`; empty/unset allows all (local dev only).
- `GET /health` — `{ status: 'ok', clients: { total, webexcc, crm } }`.

Deployed to Cloud Run via [Dockerfile](Dockerfile) + [../cloudbuild.yaml](../cloudbuild.yaml);
see [development.md](../docs/development.md#deploying-the-relay-server) for the
fast path (bucket sync, no image rebuild) vs. full image rebuild.
