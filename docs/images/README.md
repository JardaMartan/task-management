# Documentation images

Place screenshots referenced by the docs in this folder. They are not committed
automatically — capture them from a running Webex CC Desktop (or the local dev
harnesses) and drop the PNGs here using the filenames below.

## Capture checklist

| Filename | What to capture | Referenced by |
|---|---|---|
| `task-management-cases.png` | Task Management widget, Cases tab open | [task-management-widget.md](../task-management-widget.md) |
| `task-management-email.png` | Email three‑column layout with AI rail | [task-management-widget.md](../task-management-widget.md) |
| `sla-focus-panel.png` | In‑header SLA / Focus settings panel | [sla-focus-mode.md](../sla-focus-mode.md) |
| `crm-header-pill.png` | Header pill (CRM / gear / End shift) | [crm-integration.md](../crm-integration.md) |
| `crm-tab-manager.png` | CRM Tab Manager window with interaction list | [crm-integration.md](../crm-integration.md) |
| `agent-activity-overview.png` | Agent Activity overview KPIs + timeline | [agent-activity-widget.md](../agent-activity-widget.md) |
| `agent-activity-team.png` | Agent Activity team timeline | [agent-activity-widget.md](../agent-activity-widget.md) |
| `bulk-reskill-matrix.png` | Bulk Reskill skill matrix with staged changes | [bulk-reskill-widget.md](../bulk-reskill-widget.md) |
| `bulk-reskill-review.png` | Bulk Reskill review dialog | [bulk-reskill-widget.md](../bulk-reskill-widget.md) |

## Tips

- Use the dev harnesses to capture clean shots without a live Desktop:
  `npm start` (task management), `npm run start:report`, `npm run start:reskill`.
- Capture both light and dark variants where the theme matters; suffix dark
  shots with `-dark` (e.g. `sla-focus-panel-dark.png`).
- Prefer PNG at 2× (retina) for crisp rendering; crop to the widget.
- To embed in a doc, replace the `> 📸 **Screenshot:** …` note with:
  `![Alt text](images/<filename>.png)`.
