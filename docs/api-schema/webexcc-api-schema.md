# Webex Contact Center REST API Schema

Base URL: `https://webexapis.com/v1` (control/config) or regional realtime/data endpoints.

Official docs landing page: [Webex Contact Center API Reference](https://developer.webex.com/webex-contact-center/docs/webex-contact-center)  
Canonical resource URL pattern: `https://developer.webex.com/webex-contact-center/docs/api/v1/{resource}`

> **Mapping note:** This schema uses conceptual names (`Agents`, `Tasks`, `Agent States`, `Reports`, etc.). Many of these do **not** have dedicated docs pages. Each endpoint links to the closest verified WebexCC resource page; paths marked with `*` are inferred from the codebase and not confirmed by a public docs page.

## Legend

- <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> read / list
- <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> create / execute
- <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> full update
- <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> remove
- <span style="background:#e2e3e5;color:#383d41;padding:2px 6px;border-radius:4px;">*</span> inferred endpoint

---

## Organization & routing

### Organization

| | |
|---|---|
| **Purpose** | Top-level customer tenant. Most other resources live inside an `orgId`. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> |
| **Endpoints** | `GET /v1/organizations`<br>`GET /v1/organizations/{orgId}` — [get-organization-details](https://developer.webex.com/admin/docs/api/v1/organizations/get-organization-details)<br>`PUT /v1/organizations/{orgId}` |
| **Depends on** | — |
| **Used by** | Sites, Teams, Queues, Agents, Users, Campaigns, Subscriptions |

### Sites

| | |
|---|---|
| **Purpose** | Geographic / datacenter location. Parent of Teams and Queues. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/sites`<br>`GET /v1/sites/{siteId}`<br>`POST /v1/sites` *<br>`PUT /v1/sites/{siteId}` *<br>`DELETE /v1/sites/{siteId}` * |
| **Depends on** | Organization |
| **Used by** | Teams, Queues, Agents, Agent Sessions, Call Legs |

### Teams

| | |
|---|---|
| **Purpose** | Group of agents at a site. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/teams`<br>`GET /v1/teams/{teamId}`<br>`GET /v1/teams/statistics`<br>`POST /v1/teams` *<br>`PUT /v1/teams/{teamId}` *<br>`DELETE /v1/teams/{teamId}` * |
| **Depends on** | Organization, Site |
| **Used by** | Agents, Agent Sessions, Tasks, Call Legs |

### Queues

| | |
|---|---|
| **Purpose** | Holds tasks until an agent becomes available. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/queues`<br>`GET /v1/queues/{queueId}`<br>`GET /v1/queues/statistics`<br>`POST /v1/queues` *<br>`PUT /v1/queues/{queueId}` *<br>`DELETE /v1/queues/{queueId}` * |
| **Depends on** | Organization, Site, Skill Profile |
| **Used by** | Tasks, Call Legs, Entry Points, Agent Profiles |

### Entry Points

| | |
|---|---|
| **Purpose** | Inbound routing entry; usually maps to a Flow/IVR. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/entry-points`<br>`GET /v1/entry-points/{entryPointId}`<br>`POST /v1/entry-points` *<br>`PUT /v1/entry-points/{entryPointId}` *<br>`DELETE /v1/entry-points/{entryPointId}` * |
| **Depends on** | Organization, Flow |
| **Used by** | Tasks, Call Legs |

### Flows

| | |
|---|---|
| **Purpose** | IVR / routing workflow definition. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/flows`<br>`GET /v1/flows/{flowId}`<br>`POST /v1/flows`<br>`PUT /v1/flows/{flowId}`<br>`DELETE /v1/flows/{flowId}`<br>`POST /v1/flows/{flowId}/publish`<br>`POST /v1/flows/{flowId}/lock`<br>`POST /v1/flows/{flowId}/unlock` |
| **Depends on** | Organization |
| **Used by** | Entry Points |

---

## Agents & users

### Agents

| | |
|---|---|
| **Purpose** | Contact-center agent record; maps to a Webex user. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/agents` — [Agents](https://developer.webex.com/webex-contact-center/docs/api/v1/agents)<br>`GET /v1/agents/{agentId}` *<br>`GET /v1/agents/statistics` * — no dedicated docs page found; statistics likely appear under [Queue Statistics](https://developer.webex.com/webex-contact-center/docs/api/v1/queue-statistics) or the [Agents](https://developer.webex.com/webex-contact-center/docs/api/v1/agents) page |
| **Depends on** | Organization, Team, Site, Media Profile, Skill Profile, Agent Profile |
| **Used by** | Agent States, Agent Sessions, Tasks, Call Legs |

### Agent States

| | |
|---|---|
| **Purpose** | Read or change the current state of an agent (available, idle, wrapup, etc.). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> |
| **Endpoints** | `GET /v1/agents/states` *<br>`POST /v1/agents/states` *<br>No dedicated *agent-states* docs page found; agent-state operations may be documented under [Agents](https://developer.webex.com/webex-contact-center/docs/api/v1/agents) or the Desktop SDK. |
| **Depends on** | Agents |
| **Used by** | Agent Sessions, Agent Activities |

### Agent Sessions

| | |
|---|---|
| **Purpose** | Agent login/logout session record (ASR). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/agent-sessions` * — no dedicated REST docs page; agent-session data is typically queried through the [Search GraphQL](https://developer.webex.com/webex-contact-center/docs/api/v1/search) API.<br>`GET /v1/agent-sessions/{agentSessionId}` * |
| **Depends on** | Agents, Teams, Sites |
| **Used by** | Agent Channel Info, Agent Activities |

### Users / People

| | |
|---|---|
| **Purpose** | Webex identity that an Agent record represents. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/people`<br>`GET /v1/people/{personId}`<br>`POST /v1/people`<br>`PUT /v1/people/{personId}`<br>`DELETE /v1/people/{personId}` |
| **Depends on** | Organization, Licenses, Roles, Locations |
| **Used by** | Agents |

### Agent Profiles

| | |
|---|---|
| **Purpose** | Defines what queues, wrap-up codes, dial plans, idle codes an agent can access. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/agent-profiles` *<br>`GET /v1/agent-profiles/{agentProfileId}` *<br>`POST /v1/agent-profiles` *<br>`PUT /v1/agent-profiles/{agentProfileId}` *<br>`DELETE /v1/agent-profiles/{agentProfileId}` * |
| **Depends on** | Organization, Queues, Entry Points, Wrap-up Codes, Dial Plans, Idle Codes |
| **Used by** | Agents, Users |

### Media Profiles

| | |
|---|---|
| **Purpose** | Multimedia blending rules for an agent. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/media-profiles` *<br>`GET /v1/media-profiles/{mediaProfileId}` *<br>`POST /v1/media-profiles` *<br>`PUT /v1/media-profiles/{mediaProfileId}` *<br>`DELETE /v1/media-profiles/{mediaProfileId}` * |
| **Depends on** | Organization |
| **Used by** | Agents |

### Skill Profiles / Skills

| | |
|---|---|
| **Purpose** | Skill-based routing attributes. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/skills`<br>`GET /v1/skills/{skillId}`<br>`POST /v1/skills` *<br>`PUT /v1/skills/{skillId}` *<br>`DELETE /v1/skills/{skillId}` * |
| **Depends on** | Organization |
| **Used by** | Agents, Queues, Tasks, Call Legs |

---

## Tasks & media

### Tasks

| | |
|---|---|
| **Purpose** | Central customer interaction object (CSR). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/tasks` * — no dedicated *tasks* REST docs page found; the closest resource is [Tasks Call Control](https://developer.webex.com/webex-contact-center/docs/api/v1/tasks-call-control).<br>`GET /v1/tasks/{taskId}` *<br>`POST /v1/tasks` *<br>`PUT /v1/tasks/{taskId}` *<br>`DELETE /v1/tasks/{taskId}` *<br>`POST /v1/tasks/{taskId}/transfers` *<br>`POST /v1/tasks/{taskId}/consult` * |
| **Depends on** | Entry Points, Queues, Agents, Wrap-up Codes, Campaigns |
| **Used by** | Call Legs, Conversations, Recordings, Transcriptions, CAD Variables |

### Conversations

| | |
|---|---|
| **Purpose** | Digital messaging thread attached to a task. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/conversations`<br>`GET /v1/conversations/{conversationId}`<br>`POST /v1/conversations` *<br>`PUT /v1/conversations/{conversationId}` *<br>`DELETE /v1/conversations/{conversationId}` * |
| **Depends on** | Tasks |
| **Used by** | Transcriptions, Messages |

### Recordings

| | |
|---|---|
| **Purpose** | Call / screen recordings. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/recordings`<br>`GET /v1/recordings/{recordingId}`<br>`DELETE /v1/recordings/{recordingId}` |
| **Depends on** | Tasks |
| **Used by** | Transcriptions |

### Transcriptions

| | |
|---|---|
| **Purpose** | Speech-to-text output for a call or conversation. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/transcriptions` *<br>`GET /v1/transcriptions/{transcriptionId}` * |
| **Depends on** | Tasks, Conversations, Recordings |
| **Used by** | — |

### CAD Variables

| | |
|---|---|
| **Purpose** | Call-attached data (global variables) carried with a task. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/cad-variables` *<br>`GET /v1/cad-variables/{cadVariableId}` *<br>`POST /v1/cad-variables` *<br>`PUT /v1/cad-variables/{cadVariableId}` *<br>`DELETE /v1/cad-variables/{cadVariableId}` * |
| **Depends on** | Tasks |
| **Used by** | Tasks, Call Legs |

---

## Outbound & dialing

### Campaigns

| | |
|---|---|
| **Purpose** | Outbound campaign definition. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/campaigns`<br>`GET /v1/campaigns/{campaignId}` * |
| **Depends on** | Organization |
| **Used by** | Campaign Contacts, Tasks |

### Campaign Contacts

| | |
|---|---|
| **Purpose** | Contacts on a campaign dial list. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/campaign-contacts` *<br>`GET /v1/campaign-contacts/{contactId}` *<br>`POST /v1/campaign-contacts` *<br>`PUT /v1/campaign-contacts/{contactId}` *<br>`DELETE /v1/campaign-contacts/{contactId}` * |
| **Depends on** | Campaigns |
| **Used by** | Tasks |

### Outbound Dialing

| | |
|---|---|
| **Purpose** | Place outbound calls / preview/progressive dial actions. |
| **Operations** | <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> |
| **Endpoints** | `POST /v1/outbound-dialing` * |
| **Depends on** | Agents, Campaigns |
| **Used by** | Tasks |

### Call Connectors

| | |
|---|---|
| **Purpose** | Telephony connector configuration (SIP/PSTN trunks). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/call-connectors` *<br>`GET /v1/call-connectors/{connectorId}` *<br>`POST /v1/call-connectors` *<br>`PUT /v1/call-connectors/{connectorId}` *<br>`DELETE /v1/call-connectors/{connectorId}` * |
| **Depends on** | Organization |
| **Used by** | Flows, Entry Points |

---

## Configuration helpers

### Wrap-up Codes

| | |
|---|---|
| **Purpose** | Codes applied after a contact to categorize the outcome. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/wrapup-codes`<br>`GET /v1/wrapup-codes/{wrapUpCodeId}`<br>`POST /v1/wrapup-codes` *<br>`PUT /v1/wrapup-codes/{wrapUpCodeId}` *<br>`DELETE /v1/wrapup-codes/{wrapUpCodeId}` * |
| **Depends on** | Organization |
| **Used by** | Agent Profiles, Tasks, Agent Sessions, Call Legs |

### Call Reasons

| | |
|---|---|
| **Purpose** | Contact-disposition classification. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/call-reasons` *<br>`GET /v1/call-reasons/{callReasonId}` *<br>`POST /v1/call-reasons` *<br>`PUT /v1/call-reasons/{callReasonId}` *<br>`DELETE /v1/call-reasons/{callReasonId}` * |
| **Depends on** | Organization |
| **Used by** | Tasks |

### Schedules

| | |
|---|---|
| **Purpose** | Time-of-day / holiday routing schedules. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/schedules` *<br>`GET /v1/schedules/{scheduleId}` *<br>`POST /v1/schedules` *<br>`PUT /v1/schedules/{scheduleId}` *<br>`DELETE /v1/schedules/{scheduleId}` * |
| **Depends on** | Organization |
| **Used by** | Flows, Entry Points |

### Scripts

| | |
|---|---|
| **Purpose** | Agent guidance / script definitions. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/scripts` *<br>`GET /v1/scripts/{scriptId}` *<br>`POST /v1/scripts` *<br>`PUT /v1/scripts/{scriptId}` *<br>`DELETE /v1/scripts/{scriptId}` * |
| **Depends on** | Organization |
| **Used by** | Agent Profiles, Flows |

### Organization Features

| | |
|---|---|
| **Purpose** | Org-level feature toggles / settings. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> |
| **Endpoints** | `GET /v1/organization-features` *<br>`PUT /v1/organization-features/{featureId}` * |
| **Depends on** | Organization |
| **Used by** | — |

### Permissions

| | |
|---|---|
| **Purpose** | Available org-level permissions for RBAC. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/permissions` * |
| **Depends on** | Organization |
| **Used by** | Roles, Agent Profiles |

---

## Events & reporting

### Subscriptions / Webhooks

| | |
|---|---|
| **Purpose** | Near-real-time event delivery (agent:login, task:created, capture:published, etc.). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/subscriptions` — [Subscriptions](https://developer.webex.com/webex-contact-center/docs/api/v1/subscriptions)<br>`POST /v1/subscriptions` — [Subscriptions](https://developer.webex.com/webex-contact-center/docs/api/v1/subscriptions)<br>`GET /v1/subscriptions/{subscriptionId}` *<br>`PUT /v1/subscriptions/{subscriptionId}` *<br>`DELETE /v1/subscriptions/{subscriptionId}` *<br>`GET /v2/subscriptions` *<br>`POST /v2/subscriptions` *<br>`GET /v2/subscriptions/list-event-types` * |
| **Depends on** | Organization |
| **Used by** | WebhookEvent (delivery envelope) |

### Search (GraphQL)

| | |
|---|---|
| **Purpose** | Historical reporting and analytics over CSR/CAR/ASR/AAR/CLR. |
| **Operations** | <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> |
| **Endpoints** | `POST /v1/search` — [Search](https://developer.webex.com/webex-contact-center/docs/api/v1/search) |
| **Depends on** | Tasks, Agent Sessions, Call Legs |
| **Used by** | Reports |

### Reports

| | |
|---|---|
| **Purpose** | Control Hub style reports (requires Pro Pack + `analytics:read_all`). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/reports` * — no dedicated WebexCC *reports* docs page found; reporting is primarily served by the [Search GraphQL](https://developer.webex.com/webex-contact-center/docs/api/v1/search) API.<br>`GET /v1/reports/{reportId}` *<br>`POST /v1/reports` *<br>`DELETE /v1/reports/{reportId}` *<br>`GET /v1/reports/{reportId}/download` * |
| **Depends on** | Report Templates, Search |
| **Used by** | — |

### Event Relays

| | |
|---|---|
| **Purpose** | Forward CC events to external systems. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/event-relays` *<br>`POST /v1/event-relays` *<br>`PUT /v1/event-relays/{eventRelayId}` *<br>`DELETE /v1/event-relays/{eventRelayId}` * |
| **Depends on** | Organization, Subscriptions |
| **Used by** | — |

---

## Platform capability guides

These conceptual/integration APIs span multiple REST resources. They are documented below with the same **Operations / Endpoints / Depends on / Used by** structure as the standalone REST resources.

### AI (WCCAI)

| | |
|---|---|
| **Purpose** | Cloud AI services for real-time transcription, agent assist / agent answers, and speech insights. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | [AI guide](https://developer.webex.com/webex-contact-center/docs/ai)<br>`GET /v1/agent-summaries` — [Agent Summaries](https://developer.webex.com/webex-contact-center/docs/api/v1/agent-summaries)<br>`GET /v1/agent-wellbeing-events` — [Agent Wellbeing Events](https://developer.webex.com/webex-contact-center/docs/api/v1/agent-wellbeing-events)<br>`GET /v1/virtual-agent` — [Virtual Agent](https://developer.webex.com/webex-contact-center/docs/api/v1/virtual-agent)<br>Real-time streaming uses gRPC (Speech Insights Orchestrator & Serving APIs). |
| **Depends on** | Organization, Tasks, Conversations, Recordings |
| **Used by** | Voice calls, Agent Desktop, Virtual Agent flows |

### Customer Journey Data Service (CJDS)

| | |
|---|---|
| **Purpose** | Ingest customer data, build identity profiles, derive insights, and trigger routing actions in real time. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | [Getting Started with CJDS](https://developer.webex.com/webex-contact-center/docs/journey-getting-started)<br>`GET /v1/data-ingestion` — [Data Ingestion](https://developer.webex.com/webex-contact-center/docs/api/v1/data-ingestion)<br>`GET /v1/customer-identification` — [Customer Identification](https://developer.webex.com/webex-contact-center/docs/api/v1/customer-identification)<br>`GET /v1/profile-creation-and-insights` — [Profile Creation and Insights](https://developer.webex.com/webex-contact-center/docs/api/v1/profile-creation-and-insights)<br>`GET /v1/subscription` — [Subscription](https://developer.webex.com/webex-contact-center/docs/api/v1/subscription)<br>`GET /v1/trigger-actions` — [Trigger Actions](https://developer.webex.com/webex-contact-center/docs/api/v1/trigger-actions)<br>`GET /v1/workspace-management` — [Workspace Management](https://developer.webex.com/webex-contact-center/docs/api/v1/workspace-management) |
| **Depends on** | Organization, Flows, Entry Points, Tasks |
| **Used by** | Customer Journey Widget, Flow Designer, Agent Desktop |

### Work Items

| | |
|---|---|
| **Purpose** | Inject non-conversational backend tasks (cases, leads, faxes, purchase orders) into WebexCC routing and reporting. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> |
| **Endpoints** | [Task Routing - Work Item](https://developer.webex.com/webex-contact-center/docs/task-routing-work-items)<br>`POST /v1/tasks-call-control/create-task` — [Create Task API](https://developer.webex.com/webex-contact-center/docs/api/v1/tasks-call-control/create-task)<br>`POST /v1/tasks-call-control/append-task-message` — [Task Messages API](https://developer.webex.com/webex-contact-center/docs/api/v1/tasks-call-control/append-task-message)<br>`POST /v1/tasks-call-control/end-task` — [End Task API](https://developer.webex.com/webex-contact-center/docs/api/v1/tasks-call-control/end-task)<br>`GET /v1/subscriptions/list-event-types` — [List Event Types API](https://developer.webex.com/webex-contact-center/docs/api/v1/subscriptions/list-event-types)<br>`GET /v1/captures/list-captures` — [Captures API](https://developer.webex.com/webex-contact-center/docs/api/v1/captures/list-captures)<br>`GET /v1/subscriptions` — [Subscriptions API](https://developer.webex.com/webex-contact-center/docs/api/v1/subscriptions)<br>`POST /v1/search` — [Search API](https://developer.webex.com/webex-contact-center/docs/api/v1/search) |
| **Depends on** | Organization, Entry Points, Queues, Subscriptions, Tasks Call Control |
| **Used by** | External middleware, Agent Desktop |

### Flow Orchestration

| | |
|---|---|
| **Purpose** | Design, deploy, and manage IVR / routing flows via the Flow Designer and REST APIs. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | [Getting Started with Flow Orchestration](https://developer.webex.com/webex-contact-center/docs/api/guides/flow-orchestration)<br>`GET /v1/flows` — [Flows](https://developer.webex.com/webex-contact-center/docs/api/v1/flows)<br>`GET /v1/flow-templates` — [Flow Templates](https://developer.webex.com/webex-contact-center/docs/api/v1/flow-templates)<br>`GET /v1/flow-activities` — [Flow Activities](https://developer.webex.com/webex-contact-center/docs/api/v1/flow-activities)<br>`GET /v1/flow-event-specifications` — [Flow Event Specifications](https://developer.webex.com/webex-contact-center/docs/api/v1/flow-event-specifications)<br>`GET /v1/legacy-flows` — [Legacy Flows](https://developer.webex.com/webex-contact-center/docs/api/v1/legacy-flows)<br>`GET /v1/custom-functions` — [Custom Functions](https://developer.webex.com/webex-contact-center/docs/api/v1/custom-functions) |
| **Depends on** | Organization, Entry Points, Queues, Skills, Teams, Audio Files |
| **Used by** | Entry Points, Tasks, Call Legs |

### Other integration guides

| API / guide | Purpose | Primary link |
|---|---|---|
| Bring Your Own AWS Lex Virtual Agent | Connect a custom AWS Lex bot as a virtual agent. | [byova-and-aws-lex](https://developer.webex.com/webex-contact-center/docs/byova-and-aws-lex) |
| Bring Your Own Custom Messaging Channel | Integrate a non-native digital messaging channel. | [bring-your-own-custom-messaging-channel](https://developer.webex.com/webex-contact-center/docs/bring-your-own-custom-messaging-channel) |
| Bring Your Own Data Source | Feed external data into WebexCC analytics/flows. | [bring-your-own-data-source-cc](https://developer.webex.com/webex-contact-center/docs/bring-your-own-data-source-cc) |
| Bring Your Own Virtual Agent | Generic BYO virtual-agent integration pattern. | [bring-your-own-virtual-agent](https://developer.webex.com/webex-contact-center/docs/bring-your-own-virtual-agent) |
| Campaign Manager Outbound Dialers | Configure outbound dialing campaigns. | [campaign-manager-outbound-dialers](https://developer.webex.com/webex-contact-center/docs/campaign-manager-outbound-dialers) |
| Contact Center HTTP Connector | HTTP-based integration with external systems. | [contact-center-http-connector](https://developer.webex.com/webex-contact-center/docs/contact-center-http-connector) |
| Contact Control APIs | Programmatic control over contacts/tasks. | [contact-control-apis](https://developer.webex.com/webex-contact-center/docs/contact-control-apis) |
| Desktop | Agent Desktop customization and integration. | [desktop](https://developer.webex.com/webex-contact-center/docs/desktop) |
| Getting Started With Search API | GraphQL Search API primer. | [getting-started-with-search-api](https://developer.webex.com/webex-contact-center/docs/getting-started-with-search-api) |
| Guide for Digital Transcripts | Digital channel transcript handling. | [guide-for-digital-transcripts](https://developer.webex.com/webex-contact-center/docs/guide-for-digital-transcripts) |
| Migrate from AgentStats and QueueStats to the GraphQL Search API | Migration guide from legacy stats to GraphQL. | [migrate-from-stats-rest-api-to-graphql](https://developer.webex.com/webex-contact-center/docs/migrate-from-stats-rest-api-to-graphql) |
| Virtual Agent Transcripts and Call Summary | Post-call transcript/summary for virtual agents. | [virtual-agent-transcripts-and-call-summary](https://developer.webex.com/webex-contact-center/docs/virtual-agent-transcripts-and-call-summary) |
| Using Webhooks | Subscribing to CC events. | [using-webhooks](https://developer.webex.com/webex-contact-center/docs/using-webhooks) |

---

## Dependency summary

```
Organization
 ├── Sites
 │    ├── Teams
 │    │    └── Agents
 │    └── Queues
 ├── Entry Points
 │    └── Flows
 ├── Agent Profiles
 │    ├── Queues
 │    ├── Entry Points
 │    ├── Wrap-up Codes
 │    └── Dial Plans / Idle Codes
 ├── Media Profiles
 ├── Skill Profiles
 ├── Agents
 │    ├── Agent States
 │    ├── Agent Sessions
 │    │    └── Agent Channel Info → Agent Activities
 │    └── Tasks
 ├── Users / People
 ├── Tasks
 │    ├── Entry Points
 │    ├── Queues
 │    ├── Agents
 │    ├── Wrap-up Codes
 │    ├── Campaigns
 │    ├── Call Legs
 │    ├── Conversations
 │    ├── Recordings
 │    ├── Transcriptions
 │    └── CAD Variables
 ├── Campaigns
 │    └── Campaign Contacts
 ├── Outbound Dialing
 ├── Call Connectors
 ├── Wrap-up Codes
 ├── Call Reasons
 ├── Schedules
 ├── Scripts
 ├── Organization Features
 ├── Permissions
 ├── Subscriptions / Webhooks
 ├── Event Relays
 ├── Search (GraphQL)
 └── Reports
      └── Report Templates
```

## Verification status

- **Verified / linked to developer.webex.com/WebexCC docs**:
  - Organization get-details via the Admin API reference.
  - [Agents](https://developer.webex.com/webex-contact-center/docs/api/v1/agents)
  - [Subscriptions](https://developer.webex.com/webex-contact-center/docs/api/v1/subscriptions)
  - [Search](https://developer.webex.com/webex-contact-center/docs/api/v1/search)
  - [Tasks Call Control](https://developer.webex.com/webex-contact-center/docs/api/v1/tasks-call-control)
  - [Flows](https://developer.webex.com/webex-contact-center/docs/api/v1/flows), [Entry Point](https://developer.webex.com/webex-contact-center/docs/api/v1/entry-point), [Site](https://developer.webex.com/webex-contact-center/docs/api/v1/site), [Team](https://developer.webex.com/webex-contact-center/docs/api/v1/team), [Skill](https://developer.webex.com/webex-contact-center/docs/api/v1/skill), [Contact Service Queues](https://developer.webex.com/webex-contact-center/docs/api/v1/contact-service-queues)
- **Inferred endpoints** (`*`) remain for conceptual REST paths that do **not** have dedicated public docs pages (e.g., `/v1/tasks/{taskId}/transfers`, `/v1/agents/states`, `/v1/reports`). These are inferred from the codebase and SDK behavior and should be treated as unconfirmed against the live docs.
- **WebexCC docs root**: https://developer.webex.com/webex-contact-center/docs/webex-contact-center

## Local-codebase cross references

- [src/api.js#L1472-L1511](src/api.js#L1472-L1511) — resolves social tasks via `/digitalfm/v1/resolveTask` because the dialer `/v1/tasks` endpoint rejects social entry-point IDs.
- [src/store/slices/widgetSlice.js#L872](src/store/slices/widgetSlice.js#L872) — notes the social-entry-point restriction when creating tasks.
