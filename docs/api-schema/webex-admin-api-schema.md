# Webex Admin REST API Schema

Base URL: `https://webexapis.com/v1`

Official docs: [Webex Admin API Reference](https://developer.webex.com/admin/docs/api)

## Legend

- <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> read / list
- <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> create / execute
- <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> full update
- <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PATCH</span> partial update
- <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> remove

---

## Identity & licensing

### Organizations

| | |
|---|---|
| **Purpose** | Top-level Webex tenant; all admin actions are scoped to an org. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> |
| **Endpoints** | `GET /v1/organizations` — [list-organizations](https://developer.webex.com/admin/docs/api/v1/organizations/list-organizations)<br>`GET /v1/organizations/{orgId}` — [get-organization-details](https://developer.webex.com/admin/docs/api/v1/organizations/get-organization-details)<br>`PATCH /identity/organizations/{orgId}` — [update-an-organization](https://developer.webex.com/admin/docs/api/v1/identity-organization/update-an-organization) |
| **Depends on** | — |
| **Used by** | People, Workspaces, Devices, Locations, Licenses, Roles, Resource Groups, Teams, Reports |
| **Verification note** | The standard `PUT /v1/organizations/{orgId}` operation could not be confirmed in the live docs; the verified org update uses the `identity/organizations` path and `PATCH`. |

### People

| | |
|---|---|
| **Purpose** | Users in the organization (admins, agents, workspace users). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/people` — [list-people](https://developer.webex.com/admin/docs/api/v1/people/list-people)<br>`GET /v1/people/{personId}` — [get-person-details](https://developer.webex.com/admin/docs/api/v1/people/get-person-details)<br>`GET /v1/people/me` — [get-my-own-details](https://developer.webex.com/admin/docs/api/v1/people/get-my-own-details)<br>`POST /v1/people` — [create-a-person](https://developer.webex.com/admin/docs/api/v1/people/create-a-person)<br>`PUT /v1/people/{personId}` — [update-a-person](https://developer.webex.com/admin/docs/api/v1/people/update-a-person)<br>`DELETE /v1/people/{personId}` — [delete-a-person](https://developer.webex.com/admin/docs/api/v1/people/delete-a-person) |
| **Depends on** | Organizations, Licenses, Roles, Locations, Call Settings, Resource Group Memberships |
| **Used by** | Memberships, Messages, Meetings, Devices, Events, Admin Audit Events |

### Roles

| | |
|---|---|
| **Purpose** | Organization roles for RBAC. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/roles` — [list-roles](https://developer.webex.com/admin/docs/api/v1/roles/list-roles)<br>`GET /v1/roles/{roleId}` — [get-role-details](https://developer.webex.com/admin/docs/api/v1/roles/get-role-details) |
| **Depends on** | Organizations |
| **Used by** | People |

### Licenses

| | |
|---|---|
| **Purpose** | License inventory and assignment. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PATCH</span> |
| **Endpoints** | `GET /v1/licenses` — [list-licenses](https://developer.webex.com/admin/docs/api/v1/licenses/list-licenses)<br>`GET /v1/licenses/{licenseId}` — [get-license-details](https://developer.webex.com/admin/docs/api/v1/licenses/get-license-details)<br>`PATCH /v1/licenses` — [assign-licenses-to-users](https://developer.webex.com/admin/docs/api/v1/licenses/assign-licenses-to-users) |
| **Depends on** | Organizations |
| **Used by** | People, SCIM Users |

### Locations

| | |
|---|---|
| **Purpose** | Physical / calling locations (address, timezone, country). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/locations` — [resource landing](https://developer.webex.com/admin/docs/api/v1/locations)<br>`GET /v1/locations/{locationId}`<br>`POST /v1/locations`<br>`PUT /v1/locations/{locationId}`<br>`DELETE /v1/locations/{locationId}` |
| **Depends on** | Organizations |
| **Used by** | People, Workspaces, Devices, Call Settings |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. The resource landing page is linked. |

---

## Workspaces & devices

### Workspaces

| | |
|---|---|
| **Purpose** | Physical collaboration spaces (rooms, desks, huddle spaces). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/workspaces` — [resource landing](https://developer.webex.com/admin/docs/api/v1/workspaces)<br>`GET /v1/workspaces/{workspaceId}`<br>`POST /v1/workspaces`<br>`PUT /v1/workspaces/{workspaceId}`<br>`DELETE /v1/workspaces/{workspaceId}` |
| **Depends on** | Organizations, Locations, Resource Groups |
| **Used by** | Devices, Calling Settings |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Devices

| | |
|---|---|
| **Purpose** | Phones, RoomOS devices, accessories. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/devices` — [resource landing](https://developer.webex.com/admin/docs/api/v1/devices)<br>`GET /v1/devices/{deviceId}`<br>`POST /v1/devices`<br>`PUT /v1/devices/{deviceId}`<br>`DELETE /v1/devices/{deviceId}`<br>`POST /v1/devices/activationCode` |
| **Depends on** | Organizations, Locations, Workspaces, People |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

---

## Hybrid services

### Resource Groups

| | |
|---|---|
| **Purpose** | Subset of people/workspaces receiving hybrid services. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/resourceGroups` — [resource landing](https://developer.webex.com/admin/docs/api/v1/resource-groups)<br>`GET /v1/resourceGroups/{resourceGroupId}` |
| **Depends on** | Organizations |
| **Used by** | Resource Group Memberships, Hybrid Clusters, Workspaces |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Resource Group Memberships

| | |
|---|---|
| **Purpose** | Assign a person to a resource group. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/resourceGroup/memberships` — [resource landing](https://developer.webex.com/admin/docs/api/v1/resource-group-memberships)<br>`POST /v1/resourceGroup/memberships`<br>`DELETE /v1/resourceGroup/memberships/{membershipId}` |
| **Depends on** | Resource Groups, People |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Hybrid Clusters

| | |
|---|---|
| **Purpose** | Container for Hybrid Connectors. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/hybrid/clusters` — [resource landing](https://developer.webex.com/admin/docs/api/v1/hybrid-clusters)<br>`GET /v1/hybrid/clusters/{clusterId}` |
| **Depends on** | Organizations, Resource Groups |
| **Used by** | Hybrid Connectors |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Hybrid Connectors

| | |
|---|---|
| **Purpose** | Connector instances inside a Hybrid Cluster. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/hybrid/connectors` — [resource landing](https://developer.webex.com/admin/docs/api/v1/hybrid-connectors)<br>`GET /v1/hybrid/connectors/{connectorId}` |
| **Depends on** | Hybrid Clusters, Organizations |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

---

## Collaboration

### Teams

| | |
|---|---|
| **Purpose** | Persistent team spaces (not CC Teams). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/teams` — [resource landing](https://developer.webex.com/admin/docs/api/v1/teams)<br>`GET /v1/teams/{teamId}`<br>`POST /v1/teams`<br>`PUT /v1/teams/{teamId}`<br>`DELETE /v1/teams/{teamId}` |
| **Depends on** | Organizations |
| **Used by** | Rooms |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Rooms

| | |
|---|---|
| **Purpose** | Messaging rooms/spaces. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/rooms` — [resource landing](https://developer.webex.com/admin/docs/api/v1/rooms)<br>`GET /v1/rooms/{roomId}`<br>`POST /v1/rooms`<br>`PUT /v1/rooms/{roomId}`<br>`DELETE /v1/rooms/{roomId}` |
| **Depends on** | Organizations, Teams |
| **Used by** | Memberships, Messages, Meetings |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Memberships

| | |
|---|---|
| **Purpose** | Room membership (who is in a room). |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/memberships` — [resource landing](https://developer.webex.com/admin/docs/api/v1/memberships)<br>`GET /v1/memberships/{membershipId}`<br>`POST /v1/memberships`<br>`PUT /v1/memberships/{membershipId}`<br>`DELETE /v1/memberships/{membershipId}` |
| **Depends on** | Rooms, People |
| **Used by** | Messages |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Messages

| | |
|---|---|
| **Purpose** | Messages posted to rooms or direct 1:1 spaces. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/messages` — [resource landing](https://developer.webex.com/admin/docs/api/v1/messages)<br>`GET /v1/messages/{messageId}`<br>`POST /v1/messages`<br>`DELETE /v1/messages/{messageId}` |
| **Depends on** | Rooms, People |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Meetings

| | |
|---|---|
| **Purpose** | Scheduled or instant Webex meetings. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/meetings` — [resource landing](https://developer.webex.com/admin/docs/api/v1/meetings)<br>`GET /v1/meetings/{meetingId}`<br>`POST /v1/meetings`<br>`PUT /v1/meetings/{meetingId}`<br>`DELETE /v1/meetings/{meetingId}` |
| **Depends on** | People, Rooms |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Events

| | |
|---|---|
| **Purpose** | Compliance / user activity events for bots/integrations. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/events` — [resource landing](https://developer.webex.com/admin/docs/api/v1/events)<br>`GET /v1/events/{eventId}` |
| **Depends on** | People |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

---

## Reports & audit

### Reports

| | |
|---|---|
| **Purpose** | Control Hub reports; requires Pro Pack + `analytics:read_all`. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/reports` — [resource landing](https://developer.webex.com/admin/docs/api/v1/reports)<br>`GET /v1/reports/{reportId}`<br>`POST /v1/reports`<br>`DELETE /v1/reports/{reportId}` |
| **Depends on** | Organizations, Report Templates |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Report Templates

| | |
|---|---|
| **Purpose** | Available templates for creating reports. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/reportTemplates` — [resource landing](https://developer.webex.com/admin/docs/api/v1/report-templates)<br>`GET /v1/reportTemplates/{templateId}` |
| **Depends on** | Organizations |
| **Used by** | Reports |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

### Admin Audit Events

| | |
|---|---|
| **Purpose** | Significant admin actions in Control Hub. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> |
| **Endpoints** | `GET /v1/adminAudit/events` — [resource landing](https://developer.webex.com/admin/docs/api/v1/admin-audit-events)<br>`GET /v1/adminAudit/events/{eventId}` |
| **Depends on** | Organizations, People |
| **Used by** | — |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

---

## User provisioning

### SCIM 2.0 Users

| | |
|---|---|
| **Purpose** | Recommended way to provision users and assign licenses. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PATCH</span> <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> |
| **Endpoints** | `GET /v1/scim/Users` — [resource landing](https://developer.webex.com/admin/docs/api/v1/scim-2)<br>`GET /v1/scim/Users/{id}`<br>`POST /v1/scim/Users`<br>`PUT /v1/scim/Users/{id}`<br>`PATCH /v1/scim/Users/{id}`<br>`DELETE /v1/scim/Users/{id}` |
| **Depends on** | Organizations, Licenses |
| **Used by** | People |
| **Verification note** | Individual operation URLs for this group could not be confirmed because the live docs are JS-rendered. |

---

## Webex Calling sub-resources

### Person Calling Features

| | |
|---|---|
| **Purpose** | Per-user calling configuration. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> |
| **Endpoints** | `GET/PUT /v1/people/{personId}/features/callerId`<br>`GET/PUT /v1/people/{personId}/features/callForwarding`<br>`GET/PUT /v1/people/{personId}/features/voicemail`<br>`GET/PUT /v1/people/{personId}/features/callPolicies`<br>`GET/PUT /v1/people/{personId}/features/sequentialRing`<br>`GET/PUT /v1/people/{personId}/features/simultaneousRing`<br>`GET/PUT /v1/people/{personId}/features/priorityAlert`<br>`GET/PUT /v1/people/{personId}/features/privacy`<br>`GET/PUT /v1/people/{personId}/features/intercept`<br>`GET/PUT /v1/people/{personId}/features/monitor`<br>`GET/PUT /v1/people/{personId}/features/pushToTalk`<br>`GET /v1/people/{personId}/features/numbers`<br>`GET /v1/people/{personId}/features/communalLine` |
| **Depends on** | People |
| **Used by** | — |
| **Verification note** | Webex Calling sub-resource operation URLs are not individually documented in the public Webex Admin API reference; exhaustive specs are in the Partner Administration reference app / OpenAPI definitions. Treat these paths as convention-based. |

### Location Calling Features

| | |
|---|---|
| **Purpose** | Location-level calling enablement and settings. |
| **Operations** | <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> |
| **Endpoints** | `POST /v1/locations/{locationId}/calling`<br>`GET /v1/locations/{locationId}/callSettings`<br>`PUT /v1/locations/{locationId}/callSettings`<br>`GET /v1/locations/{locationId}/numbers` |
| **Depends on** | Locations |
| **Used by** | — |
| **Verification note** | Webex Calling sub-resource operation URLs are not individually documented in the public Webex Admin API reference; treat these paths as convention-based. |

### Workspace Calling Features

| | |
|---|---|
| **Purpose** | Workspace-level calling configuration. |
| **Operations** | <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> |
| **Endpoints** | `GET /v1/workspaces/{workspaceId}/calling/settings`<br>`PUT /v1/workspaces/{workspaceId}/calling/settings` |
| **Depends on** | Workspaces |
| **Used by** | — |
| **Verification note** | Webex Calling sub-resource operation URLs are not individually documented in the public Webex Admin API reference; treat these paths as convention-based. |

---

## Verification status

- **Verified per-operation links** (all from the live Webex Admin API reference):
  - People — all six operations verified.
  - Organizations — list / get / identity update verified.
  - Licenses — list / get / assign verified.
  - Roles — list / get verified.
- **Resource-landing links only** (individual operations could not be confirmed because `developer.webex.com` renders as a JS SPA and static fetch could not enumerate the left-nav operations):
  - Locations, Workspaces, Devices, Resource Groups, Resource Group Memberships, Hybrid Clusters, Hybrid Connectors, Teams, Rooms, Memberships, Messages, Meetings, Events, Reports, Report Templates, Admin Audit Events, SCIM 2.0.
- **Convention-based paths** (no public per-operation docs; rely on Partner Administration / Webex Calling OpenAPI specs):
  - Person Calling Features, Location Calling Features, Workspace Calling Features.

> If you have a browser/snapshot tool available, the remaining resource groups can be re-scraped to replace landing links with exact operation URLs.

## Dependency summary

```
Organizations
 ├── People
 │    ├── Licenses (assign via PATCH /licenses or SCIM)
 │    ├── Roles
 │    ├── Resource Group Memberships
 │    ├── Call Settings (Webex Calling)
 │    ├── Memberships → Rooms
 │    ├── Messages
 │    ├── Meetings
 │    ├── Devices
 │    └── Events / Admin Audit Events
 ├── Workspaces
 │    ├── Locations
 │    ├── Devices
 │    ├── Resource Groups
 │    └── Calling Settings
 ├── Devices
 │    ├── Locations
 │    ├── Workspaces
 │    └── People
 ├── Locations
 │    └── Call Settings / Numbers
 ├── Resource Groups
 │    ├── Resource Group Memberships
 │    └── Hybrid Clusters
 │         └── Hybrid Connectors
 ├── Teams / Rooms / Memberships / Messages / Events / Meetings
 ├── Reports
 │    └── Report Templates
 ├── Admin Audit Events
 └── SCIM 2.0 Users
      └── Licenses
```
