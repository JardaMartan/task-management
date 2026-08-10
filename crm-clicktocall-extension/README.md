# CRM Click-to-Contact (browser extension POC)

A Manifest V3 browser extension that scans **third-party CRM pages** for phone
numbers and email addresses and injects **Call / SMS / Email** buttons next to
them. Clicking a button is routed to the Webex CC Desktop tab, where the Task
Management widget initiates the communication via the Desktop SDK.

This is the **Option A** answer to "can we build a JS wrapper that adds
click-to-contact to a CRM we can't modify". A plain wrapper page cannot read a
cross-origin CRM (Same-Origin Policy); an extension **content script** runs in
the CRM page's own origin and can.

## Why an extension (and not an iframe wrapper)

The existing CRM Tab Manager shows the CRM in a cross-origin `<iframe>`. The
browser's Same-Origin Policy forbids the wrapper from reading or modifying that
iframe's DOM, so it cannot scan for contacts or inject buttons. Running code
**inside the CRM origin** is the only robust way, and for a CRM you cannot
modify, a content script is the standard mechanism (this is how commercial
click-to-dial add-ons integrate with arbitrary CRMs).

## Flow

```
┌─ CRM tab ──────────────┐        ┌─ Extension ────────┐        ┌─ Webex CC Desktop tab ─────────┐
│ content.js (scanner)   │        │  background.js     │        │ content.js (bridge role)       │
│  scans DOM, injects    │        │  routes CRM→Desktop│        │  window.postMessage(__crmC2C)  │
│  Call/SMS/Email buttons │──msg──▶│  by URL pattern    │──msg──▶│         │                      │
└─────────────────────────┘        └────────────────────┘        │         ▼                      │
                                                                  │ crmContactBridge.js (widget)   │
                                                                  │   dispatch(handleInbound...)   │
                                                                  │         ▼                      │
                                                                  │  Desktop SDK: startOutdial /   │
                                                                  │  DigitalFM SMS / email compose │
                                                                  └────────────────────────────────┘
```

No relay server, WebSocket, or sessionId is involved in click-to-contact — it is
a pure extension bridge. (The existing relay + `crm-sync-header.js` continues to
handle task-lifecycle CRM tab syncing separately.)

`content.js` plays **one of two roles per page**, decided from the configured
Desktop URL pattern:
- On the Desktop tab → **bridge**: forwards `INITIATE_CONTACT` into the page.
- On any other allowed page → **scanner**: finds contacts and injects buttons.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (content script on `<all_urls>`, background worker) |
| `contact-scan.js` | Pure email/phone extraction helpers (unit-tested) |
| `content.js` | Dual-role content script: scanner **or** desktop bridge |
| `field-transfer.js` | Separate concern: wrap-up → CRM field transfer. Desktop forwarder role bridges `panel-layout-headless.js` to the background worker; CRM-participant role runs the element picker, target glow, and writes the wrap-up text into the chosen field inside the CRM Tab Manager's iframes. |
| `content.css` | Injected button styling |
| `background.js` | Service worker; routes CRM clicks to the Desktop tab |
| `options.html/js` | Settings: enable, Desktop URL pattern, CRM allowlist, channels |
| `popup.html/js` | Toolbar popup: on/off toggle + current-tab role |
| `demo/fake-crm.html` | Sample CRM page for testing the scanner |
| `demo/fake-desktop.html` | Desktop stand-in that logs received intents |

## Install (developer mode)

1. Chrome/Edge → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `crm-clicktocall-extension/` folder.
3. Open the extension **options** and set:
   - **Desktop URL pattern** — a substring/glob matching your Webex CC Desktop
     tab URL (e.g. `desktop.wxcc-us1.cisco.com`). For the demo, use the path of
     `demo/fake-desktop.html`.
   - **CRM allowlist** — optional substrings limiting where the scanner runs.
   - **Channels** — enable Call / SMS / Email.

## Try the demo locally

```bash
# from the repo root, serve the extension folder
npx http-server crm-clicktocall-extension -p 4200
```

1. Load the unpacked extension (above).
2. In options, set **Desktop URL pattern** to `fake-desktop.html`.
3. Open `http://localhost:4200/demo/fake-desktop.html` (leave it open).
4. Open `http://localhost:4200/demo/fake-crm.html` — buttons appear next to each
   contact. Click one; the intent appears in the fake-desktop log.
5. Click **Add contact dynamically** on the CRM page to verify the
   `MutationObserver` re-scans SPA-injected content.

## Wiring into the real widget

The widget side is already wired in this repo:
- `src/crmContactBridge.js` listens for the `window.postMessage({__crmC2C})`
  events the extension emits and dispatches `handleInboundContactRequest`.
- `handleInboundContactRequest` (`src/store/slices/widgetSlice.js`) maps:
  - `call`  → `initiateOutdialCall` → `Desktop.dialer.startOutdial`
  - `sms`   → `initiateSmsChat`     → DigitalFM `resolveTask`
  - `email` → status message (compose lives in the Email tab; see limitations)
- `src/index.jsx` calls `initCrmContactBridge(store)` once on mount.

So in production you only need to: build/deploy the widget as usual, deploy this
extension to agents (enterprise managed-extension policy), and set the Desktop
URL pattern.

## Limitations / next steps

- **Email**: voice/SMS use the Desktop SDK directly and work from any widget
  instance. Email compose lives inside the Email tab (a separate widget
  instance), so `email` currently raises a status notice rather than opening the
  composer. Completing it means handing the address to the Email tab instance
  (e.g. via a shared `pendingCompose` state or a `BroadcastChannel`).
- **Phone detection** uses a pragmatic regex, not libphonenumber; tune
  `PHONE_RE` in `contact-scan.js` for locale-specific formats.
- **`<all_urls>`** host permission is broad for the POC. In production, scope
  `host_permissions` / `content_scripts.matches` to the specific CRM and Desktop
  origins.
- The extension scans page text; heavily canvas- or shadow-DOM-rendered CRMs may
  need targeted selectors.
- **Widget in an iframe**: `crmContactBridge.js` only accepts same-window
  (`event.source === window`) messages. If the Desktop hosts the widget inside a
  cross-origin iframe, ensure the extension's Desktop URL pattern also matches
  that iframe's URL (content scripts run in all frames), or add explicit
  cross-frame `postMessage` targeting. For the common same-window case this
  works out of the box.
