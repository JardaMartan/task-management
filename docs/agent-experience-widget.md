# Agent Experience Widget

A supervisor tool for managing agent-facing email assets — templates,
signatures, and the AI proofreading prompt — with per-team assignment and
multi-language variants. Consumed at runtime by the Task Management widget's
Email tab (team-filtered by the agent's active team).

- **Web Component tag:** `agent-experience-widget`
- **Entry:** [src-experience/index.jsx](../src-experience/index.jsx)
- **Main component:** [src-experience/AgentExperience.jsx](../src-experience/AgentExperience.jsx)
- **Standard artifact:** `dist/agent-experience.js`
- **Standalone artifact:** `dist/agent-experience-standalone.js`
- **CDN artifact:** `dist/agent-experience-cdn.js` + `dist/agent-experience-cdn-loader.js`
- **Dev harness:** [dev-experience.html](../dev-experience.html)

---

## What it does

Two sections, navigated with a Momentum-style pill tab bar
([SectionNav.jsx](../src-experience/components/SectionNav.jsx)):

- **Email** (built) — template & signature management plus the AI proofread
  prompt, each with its own sub-tab
  ([SubTabNav.jsx](../src-experience/components/SubTabNav.jsx)).
- **Chat** — placeholder for a future iteration.

### Main areas

| Area | Component | Purpose |
|---|---|---|
| Templates | [TemplateManager.jsx](../src-experience/components/TemplateManager.jsx) | 3‑column: template list, editor (name/category/subject/body via a WYSIWYG rich‑text editor), assignment panel. |
| Signatures | [SignatureManager.jsx](../src-experience/components/SignatureManager.jsx) | Same pattern as templates: name + HTML body + live preview. |
| Proofread prompt | [PromptEditor.jsx](../src-experience/components/PromptEditor.jsx) | Edit the org-default AI proofreading prompt, or create a per-team override. |
| Assignment | [AssignmentPanel.jsx](../src-experience/components/AssignmentPanel.jsx) | Per-item, many-to-many team assignment (searchable team list + toggle switches). |
| Language bar | [LanguageBar.jsx](../src-experience/components/LanguageBar.jsx) | Templates/signatures are language-first: each item has per-language variants (name/subject/body); the bar switches which language is being edited and shows availability per item. |
| Rich text editor | [RichHtmlEditor.jsx](../src-experience/components/RichHtmlEditor.jsx) | Tiptap-based WYSIWYG with a Visual/HTML toggle, toolbar, and `{{variable}}` highlighting + insertion helper. |
| Toolbar | [Toolbar.jsx](../src-experience/components/Toolbar.jsx) | Dirty-state detection, Save / Discard. |

---

## State & data

Single Redux slice: [src-experience/store/slices/experienceSlice.js](../src-experience/store/slices/experienceSlice.js).
Key fields: lifecycle (`status`, `saving`, `saveResult`), Desktop context
(`accessToken`, `orgId`, `datacenter`, `darkMode`, `experienceUrl`,
`supervisorTeamIds`, `forcedMode`), `teams` (from the Config API), `config`
(`languages`, `templates`, `signatures`, `templateAssignments`,
`signatureAssignments`, `proofreadPrompts`), a `savedConfig` snapshot for dirty
detection, and UI selection/navigation state.

Templates and signatures are **language-grouped**: each item is
`{ id, category, variables, variants: { <lang>: { name, subject, body } } }`
(signatures omit `category`/`variables`). `config.languages` lists the
languages in use and is editable from the language bar.

### Data sources ([src-experience/api.js](../src-experience/api.js))

- **Teams** — Webex CC Configuration API `GET /organization/{orgId}/team`
  (regional base auto-discovery), filtered to agent-type teams.
- **Config** — `GET`/`POST` against the `experienceurl` Cloud Function (see
  [backend.md](backend.md#endpoints)), Firestore-backed, one document per org.
- **Demo / fallback**: any missing URL, token, or live error falls back to
  deterministic fixtures in [src-experience/mock/](../src-experience/mock/); a
  save in that state simulates success. A `localStorage` cache
  (`wx_experience_config_<orgId>`) is written on every live load/save and read
  back if a later live fetch fails, so supervisors keep working offline.

### Consumption by the Task Management widget

The Email composer's `loadTeamEmailAssets` thunk
([src/store/slices/emailSlice.js](../src/store/slices/emailSlice.js)) fetches
this same `experienceUrl`, resolves the agent's **active** team
(`teamUniqueId`/`teamName` from the Desktop SDK agent object), filters
templates/signatures to that team's assignments (fail-open to "all assigned"
if no team is detected), flattens the language-grouped shape into
locale-tagged flat records, and resolves the proofread prompt (team override →
org default). See [task-management-widget.md](task-management-widget.md#config-object-fields-only-the-ones-the-widget-actually-reads)
for the `config.experienceUrl` field on that widget.

---

## Props

| Attribute | Type | Purpose |
|---|---|---|
| `accesstoken` | string | Webex bearer token for the Configuration API + `experienceurl` calls. |
| `orgid` | string | Webex org UUID. |
| `datacenter` | string | Regional datacenter (e.g. `eu1`); auto-discovered if omitted. Also settable as the camelCase property `dataCenter`. |
| `darkmode` | boolean-ish string | Toggles the `md--dark` theme. |
| `locale` | string | UI locale (`en` / `de` / `cs`); falls back to browser detection. |
| `view` | string | `mock` (demo data) \| `live` (real data); omit to auto-detect. |
| `experienceurl` | string | Cloud Function endpoint that persists templates/signatures/assignments/prompts (see [backend.md](backend.md#endpoints)). |
| `teams` / `supervisorteams` | JSON array \| CSV string | Restricts the supervisor's team scope, same format as [Bulk Reskill](bulk-reskill-widget.md#props). Omit to show all teams. |
| `config` | object | Optional JSON object (or JSON string) merging any of the above. |

### Sample Desktop Layout JSON

```json
{
  "comp": "agent-experience-widget",
  "script": "https://your-host/dist/agent-experience-standalone.js",
  "properties": {
    "darkmode": "$STORE.app.darkMode",
    "accesstoken": "$STORE.auth.accessToken",
    "orgid": "$STORE.agent.orgId",
    "datacenter": "$STORE.app.datacenter",
    "locale": "$STORE.app.selectedLanguage",
    "view": "live",
    "experienceurl": "https://us-central1-your-project.cloudfunctions.net/experience"
  }
}
```

Typically added as a second tab in a "Supervisor Controls" page, alongside the
Bulk Reskill widget.

---

## i18n

Dictionaries in [src-experience/i18n/translations.js](../src-experience/i18n/translations.js);
supported locales **en**, **de**, **cs** (browser detection + `?locale=` override).

---

## Build & deploy

```bash
npm run start:experience               # dev harness (port 8082)
npm run build:experience               # → dist/agent-experience.js
npm run build:experience:standalone    # → dist/agent-experience-standalone.js
npm run build:experience:cdn           # → dist/agent-experience-cdn.js + -cdn-loader.js
```

Backend deploy: `cd backend/cloud-function && npm run deploy:experience` (see
[backend.md](backend.md)). See [development.md](development.md) for layout
wiring.

---

## Related docs

- [Task Management widget](task-management-widget.md) — the agent-facing
  consumer of templates/signatures/prompts.
- [Bulk Reskill widget](bulk-reskill-widget.md) — sibling supervisor tool with
  the same `teams` scoping pattern.
- [Backend cloud function](backend.md) — the `experience` endpoint contract.
