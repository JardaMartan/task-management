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

export function initCrmContactBridge(store) {
  if (_installed) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  _installed = true;

  window.addEventListener('message', (event) => {
    // Only accept same-origin messages carrying our tag.
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.__crmC2C !== true || data.type !== 'INITIATE_CONTACT') return;

    const channel = data.channel;
    const destination = data.destination;
    if (!channel || !destination) return;

    console.log('[crmContactBridge] received', channel, destination);
    try {
      store.dispatch(handleInboundContactRequest({ channel, destination }));
    } catch (err) {
      console.warn('[crmContactBridge] dispatch failed:', err && err.message);
    }
  });

  console.log('[crmContactBridge] listening for CRM click-to-contact events');
}
