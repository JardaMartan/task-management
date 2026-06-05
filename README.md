# Task Management Widget

A Webex Contact Center Desktop widget for managing tasks (cases) across all digital channels — email, chat, voice, and unified case views. Built with React, Redux Toolkit, Momentum UI, and deployed as a Web Component (shadow DOM).

---

## Features

- **Cases view** — list and detail editor for cases assigned to the agent; inline status, notes, and customer data editing
- **History view** — JDS-sourced customer journey timeline
- **Email widget** — three-column layout with thread list, reading pane, reply composer, AI suggestions rail, and wrap-up dialog
- **Chat widget** — multi-channel conversation list (Webchat, WhatsApp, SMS, Apple Messages, RCS, In-App), live transcript, and AI rail
- **Voice widget** — call history, live transcript, AI summary and action suggestions
- **AI integration** — contextual hints and summaries powered by a configurable AI provider
- **Demo mode** — works without the Desktop SDK; safe fallbacks for local development
- **Dark mode** — full `md--dark` theme support using CSS design tokens

---

## Architecture

```
src/
├── index.jsx                 # Web Component registration & CSS injection
├── TaskManagement.jsx        # Main component, view routing
├── store.js                  # Redux store, root thunks
├── api.js                    # Pure async API/JDS functions (no Redux)
├── agentx-globals.js         # Desktop SDK guard / global shims
├── panel-layout-headless.js  # Desktop layout helper
│
├── store/slices/
│   ├── widgetSlice.js        # Core agent/task state
│   └── emailSlice.js         # Email-specific state
│
├── ai/
│   └── aiProvider.js         # AI service abstraction layer
│
├── views/                    # Single-column tab views
│   ├── CasesView.jsx
│   ├── HistoryView.jsx
│   ├── ChatView.jsx
│   ├── CasesAnalyticsBar.jsx
│   ├── HistoryAnalyticsBar.jsx
│   └── views.css             # View-specific styles (no shared layout overrides)
│
├── email/                    # Email channel widget
├── chat/                     # Chat channel widget
├── voice/                    # Voice channel widget
│
├── ui/
│   ├── widget-layout.css     # ← single source of truth for all layout & tokens
│   ├── momentumPrimitives.jsx
│   └── design-guide.md       # UI design guide for contributors
│
└── i18n/
    ├── I18nContext.jsx
    └── translations.js
```

**Key architectural rules:**
- All async operations (SDK, API) go through Redux thunks — never called directly from components
- API module contains pure functions only; no Redux logic
- All user-facing strings are i18n-key based; no hardcoded text in components
- All spacing and layout values use `--tm-*` CSS design tokens; no hardcoded px values in widget CSS

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install

```bash
npm install
```

### Development server

Starts a Webpack dev server with a local harness (`dev.html`) that simulates the Desktop environment:

```bash
npm start
# → http://localhost:8080
```

The harness includes a sidebar to configure task props, channel type, dark mode, and SDK simulation without needing a live Desktop session.

### Run tests

```bash
npm test
```

---

## Build

### Standard build (development / staging)

Outputs `dist/task-management.js`. React and ReactDOM are expected as externals provided by the host page.

```bash
npm run build
```

### Standalone build (Desktop deployment)

Outputs `dist/task-management-standalone.js` — fully self-contained bundle with all dependencies inlined. Required for deployment to Webex Contact Center Desktop.

```bash
npm run build:standalone
```

Both commands also run `scripts/inline-fonts.js` to embed Momentum UI fonts into the bundle, and copy `src/panel-layout-headless.js` to `dist/`.

### Clean build

```bash
npm run build:clean
```

---

## Deployment to Webex CC Desktop

1. Run `npm run build:standalone`
2. Host `dist/task-management-standalone.js` and `dist/panel-layout-headless.js` on a CDN or static file server
3. Reference the widget in your Desktop Layout JSON:

```json
{
  "comp": "agentx-wc",
  "attributes": {
    "tag": "task-management-widget",
    "src": "https://your-cdn/task-management-standalone.js"
  }
}
```

See `tmp/agent-desktop-layout MonetaBank_v05.json` for a complete layout example with all five tabs (Cases → History → Voice → Email → Chat).

---

## Backend Cloud Function

`backend/cloud-function/` contains a Google Cloud Functions scaffold for inbound email processing:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check |
| `POST /inbound` | Receives Gmail Pub/Sub push, enriches with AI, forwards to Webex Connect |
| `POST /watch` | Registers a Gmail inbox watch subscription |
| `POST /token` | Mints a scoped Gmail OAuth token after Webex identity verification |

### Setup

```bash
cd backend/cloud-function
cp .env.example .env
# fill in GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, WEBEX_TOKEN_VALIDATION_URL, etc.
npm install
```

Deploy with the Google Cloud CLI:

```bash
gcloud functions deploy inbound --runtime nodejs20 --trigger-http --allow-unauthenticated
```

---

## UI Design Guide

Full spacing token reference, layout model, class catalogue, dark mode rules, and PR checklist are in [src/ui/design-guide.md](src/ui/design-guide.md).

**Quick reference:**

| Root class | Used by | Outer gutter |
|---|---|---|
| `.widget-shell` | Multi-column channel widgets (email, chat, voice) | 8 px |
| `.view-panel` | Single-column tab views (cases, history) | 8 px |

All spacing values are controlled by `--tm-*` tokens in `src/ui/widget-layout.css`. Do not add hardcoded spacing in widget-specific CSS files.

---

## i18n

Translation keys live in `src/i18n/translations.js`. All supported locales must have an entry for every key. Components retrieve strings via the `useI18n()` hook — no fallback hardcoded text in JSX.

---

## License

Private — Webex Contact Center customisation project.
