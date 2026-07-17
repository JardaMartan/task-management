/**
 * crmContactBridge.js
 *
 * Receives "initiate contact" requests from the CRM Click-to-Contact browser
 * extension and dispatches them into the Redux store.
 *
 * Flow:
 *   CRM tab (extension content script) → background service worker → Desktop tab
 *   (extension bridge) → window.postMessage({ __crmC2C, type:'INITIATE_CONTACT' })
 *   → THIS listener → handleInboundContactRequest thunk → Desktop SDK.
 *
 * The bridge is intentionally decoupled from the relay: click-to-contact needs
 * no sessionId and no WebSocket. It only listens for same-origin postMessage
 * events tagged with `__crmC2C`.
 *
 * Registered once per page (guarded) from index.jsx after the store is created.
 */

import { handleInboundContactRequest } from './store/slices/widgetSlice';

let _installed = false;
const _recentIds = []; // small ring buffer of handled message ids for de-dup

function _alreadyHandled(id) {
  if (!id) return false;
  if (_recentIds.indexOf(id) !== -1) return true;
  _recentIds.push(id);
  if (_recentIds.length > 25) _recentIds.shift();
  return false;
}

export function initCrmContactBridge(store) {
  if (_installed) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  _installed = true;

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.__crmC2C !== true || data.type !== 'INITIATE_CONTACT') return;

    // Accept messages posted into this window by the extension content script:
    //   - same frame (the widget shares the frame the content script runs in), or
    //   - forwarded down from the Desktop shell frame into this widget iframe
    //     (event.source is then the parent window).
    // The `__crmC2C` tag + type is the trust gate. De-dup by id so the direct
    // and forwarded delivery paths only dispatch once.
    if (_alreadyHandled(data.id)) return;

    const channel = data.channel;
    const destination = data.destination;
    if (!channel || !destination) return;

    console.log('[crmContactBridge] received', channel, destination, event.source === window ? '(self)' : '(forwarded)');
    try {
      store.dispatch(handleInboundContactRequest({ channel, destination }));
    } catch (err) {
      console.warn('[crmContactBridge] dispatch failed:', err && err.message);
    }
  });

  console.log('[crmContactBridge] listening for CRM click-to-contact events');
}
