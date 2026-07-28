# Bulk Reskilling Widget

A supervisor tool for managing Webex CC agent skill assignments at scale.
Supervisors select teams, edit a skill matrix (agents × skills) or reassign
skill‑profiles in bulk, stage the changes, review them, and apply them to live
Webex CC configuration.

- **Web Component tag:** `bulk-reskill-widget`
- **Entry:** [src-reskill/index.jsx](../src-reskill/index.jsx)
- **Main component:** [src-reskill/BulkReskill.jsx](../src-reskill/BulkReskill.jsx)
- **Standard artifact:** `dist/bulk-reskill.js`
- **Standalone artifact:** `dist/bulk-reskill-standalone.js`
- **Dev harness:** [dev-reskill.html](../dev-reskill.html)

![the skill matrix with staged changes highlighted](images/bulk-reskill-matrix.png)
![the review dialog listing staged changes](images/bulk-reskill-review.png)

---

## What it does

Two editing modes:

1. **Skill grid** — a granular per‑skill editor (proficiency 0–10, boolean
   toggles, enum dropdowns, text values).
2. **Profiles** — bulk skill‑profile reassignment.

An analytics bar shows agent‑state distribution, per‑skill demand vs coverage,
service level, and trends. Changes are staged as drafts and applied only after a
review step.

### Main areas

| Area | Component | Purpose |
|---|---|---|
| Analytics bar | [AnalyticsBar.jsx](../src-reskill/components/AnalyticsBar.jsx) | Agent‑state donut (click to filter), skill demand vs coverage, trend sparklines, KPI tiles, demo/live toggle. |
| Team selector | [TeamSelector.jsx](../src-reskill/components/TeamSelector.jsx) | Multi‑select supervised teams with agent counts + search. |
| Skill matrix | [SkillMatrix.jsx](../src-reskill/components/SkillMatrix.jsx) | Editable agents × skills grid; pending‑change badges; "only changed" / "all skills" toggles. |
| Profiles view | [ProfilesView.jsx](../src-reskill/components/ProfilesView.jsx) | Current profile per agent + bulk assignment + scenario presets. |
| Quick actions | [QuickActions.jsx](../src-reskill/components/QuickActions.jsx) / [ProfileQuickActions.jsx](../src-reskill/components/ProfileQuickActions.jsx) | Template presets + percentage‑based bulk generation. |
| Review dialog | [ReviewDialog.jsx](../src-reskill/components/ReviewDialog.jsx) | Tabular agent / skill / from → to before applying. |
| Toolbar | [ReskillToolbar.jsx](../src-reskill/components/ReskillToolbar.jsx) | Pending count, reset, review, apply. |

---

## State & data

Single Redux slice: `src-reskill/store/slices/reskillSlice.js`. Holds lifecycle
(`status`, `applying`, `applyResult`), Desktop context, config (`skills`,
`teams`, `agents`, `skillProfiles`), UI selection, analytics, and two staged
drafts: `draft` (per‑skill overrides) and `profileDraft` (profile reassignments).

Selectors: [src-reskill/selectors.js](../src-reskill/selectors.js) (`effectiveValue`,
`isChanged`, `agentsForTeams`, `filterAgents`, `stagedChangeRows`, `stagedSummary`,
`relevantSkills`, …).

Thunks: `initReskillWidget`, `loadConfig`, `loadAnalytics`,
`applyReskillChanges`, `setDataMode`.

### Data sources ([src-reskill/api.js](../src-reskill/api.js))

- **Live** (with `accessToken` + `orgId` + `datacenter`): Webex CC Configuration
  APIs — `GET .../team`, `.../user`, `.../skill`, `.../skill-profile` (paginated),
  with regional base auto‑discovery. Apply path uses `PUT .../user/{agentId}` and
  `PUT .../skill-profile/{profileId}`.
- **Demo**: deterministic fixtures in [src-reskill/mock/](../src-reskill/mock/).
- **Live analytics**: Search API (agent‑state distribution, coverage, SL/ASA/
  abandon, volume/AHT trends), refreshed while the analytics bar is open.

---

## Props

`accesstoken`, `orgid`, `datacenter`, `darkmode`, `view` (`mock` | `live`),
`locale`.

---

## i18n

Dictionaries in [src-reskill/i18n/translations.js](../src-reskill/i18n/translations.js);
supported locales **en**, **de**, **cs** (browser detection + `?locale=` override).

---

## Build & deploy

```bash
npm run start:reskill               # dev harness
npm run build:reskill               # → dist/bulk-reskill.js
npm run build:reskill:standalone    # → dist/bulk-reskill-standalone.js
```

See [development.md](development.md) for layout wiring.
