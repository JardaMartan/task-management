# Webex API Schema Catalog

This folder documents the Webex Contact Center and Webex Admin REST API endpoints in a single, easy-to-read catalog.  It is designed as a **quick reference**: each resource has a short description, the operations it supports (color-coded), and its dependencies on other resources.

## Files

| File | Contents |
|------|----------|
| `webexcc-api-schema.md` | Webex Contact Center REST resources and endpoint operations |
| `webex-admin-api-schema.md` | Webex Admin REST resources and endpoint operations |
| `operation-legend.md` | Legend for the color-coded operation badges used in the schema files |

## How to read the tables

Each resource is shown as a small card/table:

- **Name** — resource name and a one-line purpose.
- **Operations** — badges for every supported HTTP verb/method.
  - <span style="color:#0e7fc1">GET</span> read / list
  - <span style="color:#1d8a63">POST</span> create / execute action
  - <span style="color:#d97a07">PUT / PATCH</span> update / replace
  - <span style="color:#c23934">DELETE</span> remove
- **Endpoints** — method + path for each operation; most rows now link directly to the relevant page on **developer.webex.com**.
- **Depends on** — resources that are typically referenced by IDs in requests or responses.
- **Used by** — resources that consume this one.

Dependencies are also summarized at the end of each file as ASCII dependency trees.

## Verification notes

- **Webex Admin API** — People, Organizations, Licenses, and Roles were verified against the live docs; the remaining Admin resource groups are linked to their resource landing pages on developer.webex.com because the site renders as a JS SPA and could not be enumerated with static fetch.
- **Webex Contact Center API** — Verified links are provided where the docs paths are known (agents, tasks, subscriptions, search, reports, etc.); inferred endpoints are marked with `*`.
- The canonical landing pages are:
  - WebexCC: https://developer.webex.com/webex-contact-center/docs/webex-contact-center
  - Webex Admin: https://developer.webex.com/admin/docs/api
