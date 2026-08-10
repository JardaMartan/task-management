# CRM Tab Manager

A self-contained web app, opened in a separate browser window, that keeps one
CRM tab/iframe per customer in sync with the agent's Webex CC Desktop tasks.
Registers with the [relay server](../relay-server/) as `role='crm'` under the
same session as the Desktop's `crm-sync-header.js`.

Full behavior, message protocol, and configuration:
**[docs/crm-integration.md § CRM Tab Manager](../docs/crm-integration.md#3-crm-tab-manager-crm-tab-manager)**.

## Files

| File | Purpose |
|---|---|
| [index.html](index.html) / [app.js](app.js) | Tab Manager shell — interaction registry, relay connection, tab UI. |
| [crm-proxy.html](crm-proxy.html) | Per-interaction iframe host that loads the CRM URL. |
| [styles.css](styles.css) | Dark/light theming via CSS custom properties. |

## Configuration

Stored in `localStorage` under `crmTabManager_config`: relay URL, CRM URL
template (`{ani}` / `{email}` / `{customerId}` / `{interactionId}`
placeholders), auto-close-on-wrapup, and tab placement.

Served by the relay server at `/crm-tab-manager/` — no separate build step or
dev server; it's static HTML/JS/CSS.
