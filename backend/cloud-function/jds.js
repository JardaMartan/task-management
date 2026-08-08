'use strict';

/**
 * jds.js — customer NAME resolution for the activity timeline (display only).
 *
 * The Search API taskDetails gives us the customer CONTACT (origin = phone/email)
 * but no name. We resolve the name at query time from the Journey Data Service
 * aliases endpoint (identity → person), keyed by that contact. Nothing is stored;
 * results are cached briefly per warm instance to avoid repeat lookups.
 */

const _nameCache = new Map();
const NAME_TTL_MS = 5 * 60 * 1000;
const CONCURRENCY = 6;

// JDS now shares the regional Webex CC host (was api-jds.wxdap-<dc>.webex.com).
// Accept prodeu1 / eu1 / wxcc-eu1 and resolve to https://api.wxcc-<region>.cisco.com.
function jdsBaseUrl(datacenter) {
  const s = String(datacenter || '').toLowerCase();
  if (!s) return null;
  const m = s.match(/(us1|us2|eu1|eu2|anz1|ca1|jp1|in1|sg1)/);
  const region = m ? m[1] : s.replace(/^prod/, '');
  if (!region) return null;
  return `https://api.wxcc-${region}.cisco.com`;
}

async function _lookupName(identity, accessToken, workspaceId, base) {
  const url = `${base}/admin/v1/api/person/workspace-id/${encodeURIComponent(workspaceId)}/aliases/${encodeURIComponent(identity)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
  if (!res.ok) return null;
  const body = await res.json();
  const p = Array.isArray(body?.data) ? body.data[0] : (body?.data || body);
  if (!p) return null;
  const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
  return name || null;
}

/**
 * Resolve names for a set of contact identities (email/phone).
 * @returns {Promise<Object<string,string>>} identity → display name
 */
async function resolveCustomerNames({ identities, accessToken, workspaceId, datacenter }) {
  const base = jdsBaseUrl(datacenter);
  if (!accessToken || !workspaceId || !base || !Array.isArray(identities) || !identities.length) return {};

  const now = Date.now();
  const out = {};
  const need = [];
  const seen = new Set();
  for (const raw of identities) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const cached = _nameCache.get(id);
    if (cached && (now - cached.ts) < NAME_TTL_MS) {
      if (cached.name) out[id] = cached.name;
    } else {
      need.push(id);
    }
  }
  if (!need.length) return out;

  let idx = 0;
  const worker = async () => {
    while (idx < need.length) {
      const id = need[idx++];
      try {
        const name = await _lookupName(id, accessToken, workspaceId, base);
        _nameCache.set(id, { name: name || null, ts: now });
        if (name) out[id] = name;
      } catch (e) {
        _nameCache.set(id, { name: null, ts: now });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, need.length) }, worker));
  return out;
}

module.exports = { resolveCustomerNames };
