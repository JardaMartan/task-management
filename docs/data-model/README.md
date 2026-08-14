# Webex API Data Model Diagrams

This folder contains Mermaid data-model diagrams for the Webex Contact Center (Customer Experience) and Webex Admin APIs.

## Files

| File | Description |
|------|-------------|
| `webexcc-org-hierarchy.mmd` | Organization → Site → Team → Agent/Queue topology |
| `webexcc-task-lifecycle.mmd` | Task (CSR) → CallLeg / Conversation / Recording / Transcription / CAD variables |
| `webexcc-agent-session.mmd` | Agent login session → channel info → activities (AAR) |
| `webexcc-webhooks.mmd` | Subscriptions and CloudEvents webhook envelope |
| `webexcc-search-graphql.mmd` | GraphQL Search API query model (CSR/CAR/ASR/AAR/CLR) |
| `webex-admin-identity.mmd` | Organization → People, Roles, Licenses, Locations |
| `webex-admin-workspaces-devices.mmd` | Workspace / Location / Device hierarchy |
| `webex-admin-collaboration.mmd` | Teams, Memberships, Messages, Meetings |
| `webex-admin-hybrid-reports.mmd` | Resource Groups, Hybrid Clusters/Connectors, Reports, Audit Events |

## How to view

- In VS Code, install the [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension and open any `.md` containing a ```` ```mermaid ```` block.
- Or use the Mermaid Live Editor: https://mermaid.live
- The files are intentionally **separate smaller diagrams** rather than one giant model, making them easier to consume and maintain.
