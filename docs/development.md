# Development & Deployment

This repo builds several independent Web Component widgets plus a relay server, a
browser extension, and a backend cloud function. This page covers the build
targets, artifacts, deployment, i18n, design tokens, and testing.

---

## Prerequisites

- Node.js ≥ 18, npm ≥ 9
- For deploys: Google Cloud CLI (`gcloud`) with access to the target project.

```bash
npm install
```

---

## Repository layout

| Path | What |
|---|---|
| [src/](../src/) | Task Management widget (`task-management-widget`) + `crm-sync-header.js` watcher. |
| [src-report/](../src-report/) | Agent Activity Analytics widget (`agent-activity-widget`). |
| [src-reskill/](../src-reskill/) | Bulk Reskilling widget (`bulk-reskill-widget`). |
| [src-experience/](../src-experience/) | Agent Experience widget (`agent-experience-widget`) — supervisor email templates/signatures/prompts. |
| [crm-tab-manager/](../crm-tab-manager/) | CRM Tab Manager web app. |
| [crm-clicktocall-extension/](../crm-clicktocall-extension/) | MV3 browser extension. |
| [relay-server/](../relay-server/) | WebSocket relay + static file server. |
| [backend/cloud-function/](../backend/cloud-function/) | Gmail / AI / token backend. |
| [scripts/](../scripts/) | Build helpers (`inline-fonts.js`, mocks, serve). |
| `dist/` | Build output (git‑ignored). |

---

## Build targets & artifacts

Every widget has a **standard** build (React/ReactDOM/Redux expected as host
externals) and a **standalone** build (all dependencies inlined, required for
Desktop deployment). Standalone is selected with `BUILD_MODE=self-contained`.

| Widget | Dev | Standard | Standalone | Tag |
|---|---|---|---|---|
| Task Management | `npm start` | `npm run build` → `dist/task-management.js` | `npm run build:standalone` → `dist/task-management-standalone.js` | `task-management-widget` |
| Agent Activity | `npm run start:report` | `npm run build:report` → `dist/agent-activity.js` | `npm run build:report:standalone` → `dist/agent-activity-standalone.js` | `agent-activity-widget` |
| Bulk Reskill | `npm run start:reskill` | `npm run build:reskill` → `dist/bulk-reskill.js` | `npm run build:reskill:standalone` → `dist/bulk-reskill-standalone.js` | `bulk-reskill-widget` |
| Agent Experience | `npm run start:experience` | `npm run build:experience` → `dist/agent-experience.js` | `npm run build:experience:standalone` → `dist/agent-experience-standalone.js` | `agent-experience-widget` |

Notes:

- All builds run [scripts/inline-fonts.js](../scripts/inline-fonts.js) to embed
  Momentum UI fonts into the bundle.
- The Task Management build also copies the headless helpers into `dist/`:
  `panel-layout-headless.js`, **`crm-sync-header.js`**, `activity-emitter.js`.
- `npm run build:clean` removes `dist/` first.

### Extension packaging

```bash
npm run ext:package   # → dist/crm-clicktocall-extension.zip
```

---

## Deploying widgets to Webex CC Desktop

1. Run the widget's `*:standalone` build.
2. Host the resulting `dist/*-standalone.js` on a CDN / static server (the relay
   serves `dist/` at `/dist/` — see below).
3. Reference the widget in your Desktop Layout JSON, e.g.:

```json
{
  "comp": "agentx-wc",
  "attributes": {
    "tag": "task-management-widget",
    "src": "https://your-host/dist/task-management-standalone.js"
  }
}
```

A complete multi‑tab layout example lives in
`tmp/agent-desktop-layout MonetaBank_v05.json`.

The headless `crm-sync-header` is added as a `crm-sync-header` component in the
`advancedHeader` — see [CRM integration](crm-integration.md#layout-integration-example).

---

## Deploying the relay server

The relay serves the widget bundles (`/dist`), the CRM Tab Manager, and the
extension, and brokers the WebSocket traffic.

**`/dist` is served from a GCS bucket** (`newagent-kxwo-relay-dist`) mounted into
the Cloud Run service at `/srv/dist` (gcsfuse, gen2). That mount **shadows** the
image's baked‑in `dist/` copy, so **JS bundle changes deploy by syncing objects
to the bucket — no image rebuild.**

### Fast path — JS bundle changes (the common case)

```bash
npm run build:standalone   # or build:report:standalone / build:reskill:standalone
gcloud storage rsync dist gs://newagent-kxwo-relay-dist --recursive --project newagent-kxwo
```

Or use the helper [scripts/deploy.sh](../scripts/deploy.sh):

```bash
scripts/deploy.sh sync                               # rsync existing dist/ → bucket (no build)
BUILD_CMD="npm run build:standalone" scripts/deploy.sh   # build + sync
```

Changes go live within ~60s (the FUSE metadata TTL) on existing instances, and
immediately on new instances. Then hard‑reload the Desktop (browsers cache the
bundles).

> Prefer `gcloud storage cp dist/<file> gs://newagent-kxwo-relay-dist/` for just
> the files you changed — a full `rsync` makes the bucket match your local
> `dist/`, which could revert other widgets' bundles if `dist/` is stale.

### Full rebuild — only for server / image changes

A Docker image rebuild is required **only** for `relay-server/` code, the
`Dockerfile`, dependency changes, or `crm-tab-manager/` (which is served from the
image, not the bucket). It does **not** update `/dist` (that's bucket‑backed).

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions="_SERVICE=webex-crm-relay,_REGION=us-central1,_ALLOWED_ORGS=<org-uuid>,_DIST_BUCKET=newagent-kxwo-relay-dist" \
  --project <gcp-project>
```

Or `scripts/deploy.sh full` (build + sync + image rebuild). One‑time setup of the
bucket + mount is `scripts/deploy.sh setup`.

See [CRM integration](crm-integration.md#2-relay-server-relay-server) for env
vars and WebSocket behavior, and [backend.md](backend.md) for the cloud function.

---

## i18n

- Each widget has its own dictionaries under `*/i18n/translations.js` with a
  React `useI18n()` provider. Supported locales: **en**, **de**, **cs**.
- Every key must exist in all locales; components never hardcode display text.
- Locale resolves from the `locale` attribute → `navigator.language` → `en`.
- The **`crm-sync-header.js`** watcher is copied raw (not bundled) and carries its
  own inline dictionary (`_SLA_I18N`) — mirror new locales there too. See
  [SLA Focus Mode](sla-focus-mode.md#localization-of-the-panel).

---

## Design tokens & layout

- Single source of truth: [src/ui/widget-layout.css](../src/ui/widget-layout.css)
  (`--tm-*` tokens). No hardcoded px in widget CSS.
- Root classes: `.widget-shell` (multi‑column channel widgets) and `.view-panel`
  (single‑column tab views), each with an 8px outer gutter.
- Full guide: [src/ui/design-guide.md](../src/ui/design-guide.md).
- Use Momentum UI components/tokens; verify visuals in both normal DOM and
  shadow‑root host rendering.

---

## Testing

```bash
npm test         # Jest (src/__tests__/**/*.test.js)
```

The Desktop SDK is mocked via [scripts/sdkMock.js](../scripts/sdkMock.js); CSS is
mapped through [scripts/fileMock.js](../scripts/fileMock.js).

---

## PR checklist

- No direct API/SDK calls from components (thunks only).
- All user‑facing text is i18n‑key based (all locales updated).
- Loading and error states handled in the thunk flow.
- Demo mode works without the Desktop SDK.
- Standalone build smoke‑tested; icon/font assets resolve in the bundle.
- Momentum primitives reused; shadow‑root rendering verified.
