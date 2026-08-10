'use strict';

// Firestore-backed store for the Agent Experience supervisor widget.
// One document per org holds the email templates, signatures, team assignments
// and per-team proof-reading prompts. Lazy Firestore init (mirrors activity.js)
// so the module degrades gracefully when credentials are unavailable.

const FS_COLLECTION = process.env.EXPERIENCE_COLLECTION || 'agent_experience';

let _fs;
let _fsReady;

/**
 * Reduce any Webex org identifier to its bare lowercase UUID. Handles raw UUIDs,
 * `ciscospark://us/ORGANIZATION/<uuid>` URNs, and the base64 hydra IDs returned
 * by the People API (identity.orgId) — so a token org and a widget-supplied
 * orgId can be compared even when they arrive in different encodings.
 */
function extractOrgUuid(value) {
  if (!value) return '';
  let v = String(value).trim();
  if (!v.includes('://') && !v.includes('/')) {
    try {
      const decoded = Buffer.from(v, 'base64').toString('utf8');
      if (decoded.includes('ORGANIZATION/') || decoded.includes('ciscospark://')) v = decoded;
    } catch { /* not base64 — fall through */ }
  }
  const m = v.match(/ORGANIZATION\/([0-9a-f-]{36})/i)
    || v.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1].toLowerCase() : v.toLowerCase();
}

function _getFirestore() {
  if (_fsReady !== undefined) return _fs;
  try {
    const { Firestore } = require('@google-cloud/firestore');
    _fs = new Firestore();
    _fsReady = true;
  } catch (err) {
    console.warn('[experience] Firestore unavailable:', err.message);
    _fs = null;
    _fsReady = false;
  }
  return _fs;
}

/** Coerce a stored/posted config into a safe, complete shape. */
function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const prompts = c.proofreadPrompts && typeof c.proofreadPrompts === 'object' ? c.proofreadPrompts : {};
  const templates = Array.isArray(c.templates) ? c.templates : [];
  const signatures = Array.isArray(c.signatures) ? c.signatures : [];
  const langSet = new Set();
  const scan = (arr) => arr.forEach((it) => Object.keys(it?.variants || {}).forEach((l) => langSet.add(l)));
  scan(templates); scan(signatures);
  return {
    languages: Array.isArray(c.languages) && c.languages.length ? c.languages : (langSet.size ? Array.from(langSet) : ['en']),
    templates,
    signatures,
    templateAssignments: c.templateAssignments && typeof c.templateAssignments === 'object' ? c.templateAssignments : {},
    signatureAssignments: c.signatureAssignments && typeof c.signatureAssignments === 'object' ? c.signatureAssignments : {},
    proofreadPrompts: {
      default: typeof prompts.default === 'string' ? prompts.default : '',
      teams: prompts.teams && typeof prompts.teams === 'object' ? prompts.teams : {},
    },
  };
}

/**
 * Read the stored configuration for an org. Returns an empty (but complete)
 * config when nothing is stored yet or Firestore is unavailable.
 */
async function getExperienceConfig(orgId) {
  const fs = _getFirestore();
  const id = extractOrgUuid(orgId);
  if (!fs || !id) return normalizeConfig(null);
  const snap = await fs.collection(FS_COLLECTION).doc(id).get();
  if (!snap.exists) return normalizeConfig(null);
  return normalizeConfig(snap.data()?.config);
}

/**
 * Persist the configuration for an org. Returns { saved:boolean }.
 */
async function saveExperienceConfig(orgId, config, meta = {}) {
  const fs = _getFirestore();
  if (!fs) {
    console.log('[experience][demo] would save config for org', orgId);
    return { saved: false, simulated: true };
  }
  const id = extractOrgUuid(orgId);
  if (!id) throw new Error('orgId required');
  await fs.collection(FS_COLLECTION).doc(id).set({
    config: normalizeConfig(config),
    orgId: id,
    updatedAt: new Date().toISOString(),
    updatedBy: meta.updatedBy || null,
  }, { merge: true });
  return { saved: true };
}

module.exports = { getExperienceConfig, saveExperienceConfig, normalizeConfig, extractOrgUuid };
