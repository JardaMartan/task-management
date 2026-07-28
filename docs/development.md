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

The relay serves `dist/*`, the CRM Tab Manager, and the extension, and brokers
the WebSocket traffic. Deploy via Cloud Build:

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions="_SERVICE=webex-crm-relay,_REGION=us-central1,_ALLOWED_ORGS=<org-uuid>" \
  --project <gcp-project>
```

Because the relay serves `dist/`, a typical publish is:

```bash
npm run build:standalone          # includes crm-sync-header.js
# (only when those bundles change:)
npm run build:report:standalone
npm run build:reskill:standalone
npm run ext:package
# then deploy the relay (command above)
```

> After deploying, hard‑reload the Desktop — browsers cache `crm-sync-header.js`
> and the standalone bundles.

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
