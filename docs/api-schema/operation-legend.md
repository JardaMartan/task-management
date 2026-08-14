# Operation Badge Legend

The schema files use short, color-coded badges for HTTP operations.  The colors are chosen to be readable in both light and dark Markdown viewers.

| Badge | Operation | Meaning |
|-------|-----------|---------|
| <span style="background:#cfe0ee;color:#0a2236;padding:2px 6px;border-radius:4px;">GET</span> | **GET** | Read or list one or more resources. |
| <span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;">POST</span> | **POST** | Create a resource or execute an action/transition. |
| <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PUT</span> | **PUT** | Full replace/update of a resource. |
| <span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;">PATCH</span> | **PATCH** | Partial update (used by Admin `/licenses`, SCIM). |
| <span style="background:#f8d7da;color:#721c24;padding:2px 6px;border-radius:4px;">DELETE</span> | **DELETE** | Remove a resource. |
| <span style="background:#e2e3e5;color:#383d41;padding:2px 6px;border-radius:4px;">*</span> | **Inferred** | Endpoint inferred from canonical Webex v1 patterns when live docs were unavailable. |

In the plain-text source, operation verbs are tagged with inline HTML `<span>` tags for color.  If your renderer strips HTML, the verb itself still carries the meaning.
