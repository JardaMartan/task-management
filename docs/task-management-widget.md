# Task Management Widget

A Webex Contact Center Desktop widget for managing tasks (cases) across all
digital channels — email, chat, voice — plus a unified customer view and
AI‑assisted hints. Built with React, Redux Toolkit, Momentum UI, and deployed as
a Web Component (shadow DOM).

- **Web Component tag:** `task-management-widget`
- **Entry:** [src/index.jsx](../src/index.jsx)
- **Main component:** [src/TaskManagement.jsx](../src/TaskManagement.jsx)
- **Standalone artifact:** `dist/task-management-standalone.js`

---

## Features

| Feature | Description |
|---|---|
| **Cases view** | List and detail editor for cases assigned to the agent; inline status, notes, and customer‑data editing. |
| **History view** | JDS‑sourced customer journey timeline. |
| **Email widget** | Three‑column layout: thread list, reading pane, reply composer (TipTap rich text), AI suggestions rail, and wrap‑up dialog. |
| **Chat widget** | Multi‑channel conversation list (Webchat, WhatsApp, SMS, Apple Messages, RCS, In‑App), live transcript, and AI rail. |
| **Voice widget** | Call history, live transcript, AI summary, and action suggestions. |
| **Unified Customer 360** | Cross‑channel customer view (`UnifiedView360`); also hosts the SLA focus‑mode delegate and requeue controller. |
| **AI integration** | Contextual hints and summaries via a configurable AI provider ([src/ai/](../src/ai/)). |
| **Demo mode** | Works without the Desktop SDK; safe fallbacks for local development. |
| **Dark mode** | Full `md--dark` theme support using CSS design tokens. |
| **Localization** | English, German, Czech (see [i18n](#i18n)). |

![the widget with the Cases tab open in the Desktop](images/task-management-cases.png)

![the Email three‑column layout with the AI rail](images/task-management-email.png)

---

## Views and channels

### Single‑column tab views ([src/views/](../src/views/))

| View | File | Shows |
|---|---|---|
| Cases | [CasesView.jsx](../src/views/CasesView.jsx) | Agent's assigned cases with inline editing + a `CasesAnalyticsBar`. |
| History | [HistoryView.jsx](../src/views/HistoryView.jsx) | JDS customer journey timeline + a `HistoryAnalyticsBar`. |
| Chat | [ChatView.jsx](../src/views/ChatView.jsx) | Multi‑channel chat conversation surface. |
| Customer 360 | [UnifiedView360.jsx](../src/views/UnifiedView360.jsx) | Unified customer view; hosts the SLA focus delegate + `SlaRequeueController`. |

Single‑column views use the `.view-panel` root class.

### Multi‑column channel widgets

- **Email** — [src/email/](../src/email/): `EmailWidget.jsx`, `EmailTaskHeader.jsx`, `SlaCountdown.jsx`, `SlaRequeueController.jsx`.
- **Chat** — [src/chat/](../src/chat/).
- **Voice** — [src/voice/](../src/voice/).

Channel widgets use the `.widget-shell` root class. Layout and spacing are driven
entirely by `--tm-*` tokens in [src/ui/widget-layout.css](../src/ui/widget-layout.css).

---

## State management

All async operations (Desktop SDK, backend API, JDS) run through Redux thunks —
components only dispatch actions and read selectors.

| Slice | File | Responsibility |
|---|---|---|
| Widget | [store/slices/widgetSlice.js](../src/store/slices/widgetSlice.js) | Core agent/task/context state. |
| Email | [store/slices/emailSlice.js](../src/store/slices/emailSlice.js) | Email threads, composer, wrap‑up. |
| Settings | [store/slices/settingsSlice.js](../src/store/slices/settingsSlice.js) | Per‑agent settings + SDK‑backed `applyAgentState` thunk (see [SLA Focus Mode](sla-focus-mode.md)). |

- Store wiring: [src/store.js](../src/store.js)
- Pure API layer (no Redux): [src/api.js](../src/api.js)
- Desktop SDK guard / global shims: [src/agentx-globals.js](../src/agentx-globals.js)

---

## Props (Desktop Layout attributes & properties)

The web component reads plain HTML **attributes** (`observedAttributes`) for
simple values and JSON-capable **properties** (set directly on the DOM node by
the Desktop layout engine, e.g. `$STORE.*` bindings or object literals) for
structured data. Both are parsed defensively — structured values may arrive as
JSON strings and are `JSON.parse`'d safely.

### Attributes

| Attribute | Type | Purpose |
|---|---|---|
| `accesstoken` | string | Webex bearer token for API/JDS calls. |
| `orgid` | string | Webex org UUID. |
| `datacenter` | string | Regional datacenter (e.g. `prodeu1`); also settable as the camelCase property `dataCenter`. |
| `locale` | string | UI locale (`en` / `de` / `cs`); falls back to browser detection. |
| `tasktype` / `taskType` | string | Which channel/view to render for the current task. |
| `darkmode` | boolean-ish string | Toggles the `md--dark` theme. |
| `view` | string | View selector for standalone/tab mounting: `email` \| `cases` \| `history` \| `chat` \| `360`. |
| `email` | string | Pre-populates the email address context (e.g. outbound/agent-initiated flows). |

### Properties (objects, set by the layout engine)

| Property | Type | Purpose |
|---|---|---|
| `task` | object | Current task (interaction) object from `$STORE.agentContact.taskSelected`. |
| `selectedtaskid` | string | ID of the currently selected task. |
| `cad` / `details` | object | Call-associated data / task map (`$STORE.agentContact.taskMap`); both names accepted, same data. |
| `wrap` | object | Agent wrap-up data. |
| `agent` | object | Agent object (`$STORE.agent`); defensively stripped of MobX observables. |
| `workspaceid` | string | JDS workspace UUID used for case/knowledge-base lookups. |
| `avatar` | string | Agent avatar URL. |
| `name` | string | Display name shown in the header. |
| `style` | object | Inline style overrides for the host element, e.g. `{ "height": "100%", "overflow": "hidden" }`. |
| `config` | object | Nested feature configuration — see below. Accepted as an object or a JSON string. |

### `config` object fields (only the ones the widget actually reads)

| Field | Purpose |
|---|---|
| `tokenBrokerUrl` | Backend URL used to mint scoped Gmail/AI tokens (see [backend.md](backend.md)). |
| `aiProvider` | `{ type: 'gemini'\|'openai', model, apiKey }` — AI provider used for hints/summaries/proofreading. |
| `experienceUrl` | Agent Experience Cloud Function URL (email templates/signatures/prompts, team-scoped). Defaults to the deployed `experience` function if omitted. |
| `templatesUrl` / `signaturesUrl` | Fallback URLs to fetch email templates/signatures when `experienceUrl` is not configured. |
| `templates` / `signatures` | Pre-loaded template/signature arrays (bypasses fetching). |
| `defaultSignatureId` | Signature to select by default in the composer. |
| `knowledgeBase` | Knowledge-base items array surfaced in the AI rail. |
| `slaVariable` | Global Variable name holding an email's SLA-expiry epoch-ms timestamp. |
| `slaThresholdMinutes` | Minutes before SLA expiry to show the amber warning (default `15`). |
| `proofreadPrompt` | Custom AI proofreading prompt template (`{{language}}`, `{{customerMessage}}`, `{{draft}}` placeholders). |
| `workspaceOverrideTaskTypes` | Task types to fetch from the workspace (default `['case']`). |
| `outdialEntryPointId` | Entry point UUID used for agent-initiated outbound calls. |
| `smsEntryPointId` / `smsOrigin` | Entry point UUID + sender ANI for agent-initiated SMS. |
| `whatsappEntryPointId` / `whatsappOrigin` | Entry point UUID + sender address for agent-initiated WhatsApp. |
| `transcriptUrl` | Backend URL for voice-transcript retrieval (see [backend.md](backend.md)). |
| `wsUrl` | Relay-server WebSocket URL for CRM tab sync; also used to auto-derive `crmTabManagerUrl` if not set. |
| `crmTabManagerUrl` | Override URL for the CRM Tab Manager window (see [crm-integration.md](crm-integration.md)). |

### Sample Desktop Layout JSON

```json
{
  "comp": "task-management",
  "script": "https://your-host/dist/task-management-standalone.js",
  "attributes": {
    "view": "360",
    "accesstoken": "$STORE.auth.accessToken",
    "style": { "height": "100%", "overflow": "hidden" }
  },
  "properties": {
    "darkmode": "$STORE.app.darkMode",
    "task": "$STORE.agentContact.taskSelected",
    "selectedtaskid": "$STORE.agentContact.selectedTaskId",
    "cad": "$STORE.agentContact.taskMap",
    "workspaceid": "6682a446abe8cf671b34f47c",
    "orgid": "$STORE.agent.orgId",
    "datacenter": "$STORE.app.datacenter",
    "agent": "$STORE.agent",
    "locale": "$STORE.app.selectedLanguage",
    "config": {
      "tokenBrokerUrl": "https://us-central1-your-project.cloudfunctions.net/auth",
      "transcriptUrl": "https://us-central1-your-project.cloudfunctions.net/transcript",
      "experienceUrl": "https://us-central1-your-project.cloudfunctions.net/experience",
      "aiProvider": { "type": "gemini", "model": "gemini-2.5-flash" },
      "outdialEntryPointId": "38b5c40e-8bcb-44d9-8d93-a79cc4d615fe",
      "smsEntryPointId": "2e84a61b-8e06-4395-8d3b-da4df382e980",
      "smsOrigin": "447908663416",
      "slaVariable": "SLAExpires",
      "slaThresholdMinutes": 15
    }
  }
}
```

Only include the `config` fields your deployment actually uses — every field is
optional and the widget degrades gracefully (demo/mock data, disabled feature)
when a field is omitted.

---

## Demo mode

When the Desktop SDK is unavailable (local dev), the widget initializes safe
defaults and serves data from [src/mock/](../src/mock/). This keeps the dev
harness ([dev.html](../dev.html)) fully functional without a live Desktop
session. Never call the SDK directly from component lifecycle hooks; always guard
availability and fall back to demo data in the thunk layer.

---

## i18n

- Translation dictionaries: [src/i18n/translations.js](../src/i18n/translations.js)
- Provider/hook: [src/i18n/I18nContext.jsx](../src/i18n/I18nContext.jsx) (`useI18n()`)
- Supported locales: **en**, **de**, **cs**. Every key must exist in all locales.
- Components render text via i18n lookup — no hardcoded strings in JSX.

---

## Build & deploy

```bash
npm run build:standalone   # → dist/task-management-standalone.js
```

The standalone build also inlines Momentum fonts and copies the headless helpers
(`panel-layout-headless.js`, `crm-sync-header.js`, `activity-emitter.js`) into
`dist/`. Full build/deploy details for every widget are in
[development.md](development.md).

---

## Related docs

- [SLA Focus Mode](sla-focus-mode.md) — the focus/requeue behavior hosted in Customer 360 + the header watcher.
- [CRM integration](crm-integration.md) — how tasks sync to the CRM Tab Manager and click‑to‑call.
- [Agent Experience widget](agent-experience-widget.md) — team‑scoped email templates/signatures/prompts consumed by this widget's Email tab.
- [Backend cloud function](backend.md) — `tokenBrokerUrl`, `transcriptUrl`, and `experienceUrl` endpoints.
- [Development & deployment](development.md).
