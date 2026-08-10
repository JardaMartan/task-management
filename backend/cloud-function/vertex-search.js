'use strict';

/**
 * vertex-search.js — stage crawled docs to GCS and (re)build a Vertex AI Search
 * (Discovery Engine) unstructured data store, so the content can be used for RAG
 * grounding with the Gemini API.
 *
 * Pipeline:
 *   1. ensureDataStore()   — create the data store if it doesn't exist (idempotent)
 *   2. stageToGcs(docs)    — write one .txt per page + a metadata NDJSON manifest
 *   3. importDocuments()   — import the manifest with reconciliationMode=FULL so a
 *                            periodic re-crawl fully replaces the previous snapshot
 *                            (stale/removed pages are dropped automatically)
 *
 * Auth uses Application Default Credentials (the Cloud Function's service account).
 * Discovery Engine calls go through the REST API; GCS uses the storage client.
 */

const { GoogleAuth } = require('google-auth-library');
const { Storage } = require('@google-cloud/storage');

const PROJECT =
  process.env.GCP_PROJECT || process.env.PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.VAIS_LOCATION || 'eu'; // global | us | eu
const COLLECTION = 'default_collection';
const BRANCH = 'default_branch';
const DATA_STORE_ID = process.env.VAIS_DATA_STORE_ID || 'innogy-pece';
const DATA_STORE_NAME = process.env.VAIS_DATA_STORE_NAME || 'Innogy Péče Knowledge Base';
const BUCKET = process.env.VAIS_BUCKET || '';
const GCS_PREFIX = process.env.VAIS_GCS_PREFIX || 'innogy-pece';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const storage = new Storage();

function discoveryHost() {
  return LOCATION === 'global'
    ? 'discoveryengine.googleapis.com'
    : `${LOCATION}-discoveryengine.googleapis.com`;
}

function parentPath() {
  return `projects/${PROJECT}/locations/${LOCATION}/collections/${COLLECTION}`;
}

function dataStorePath() {
  return `${parentPath()}/dataStores/${DATA_STORE_ID}`;
}

/** Public Cloud Console deep link to the data store (this is the shareable link). */
function dataStoreConsoleLink() {
  return `https://console.cloud.google.com/gen-app-builder/locations/${LOCATION}/data-stores/${DATA_STORE_ID}/documents?project=${PROJECT}`;
}

async function authedFetch(url, init = {}) {
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': PROJECT,
      ...(init.headers || {}),
    },
  });
  return res;
}

/** Poll a Discovery Engine long-running operation until it completes (or times out). */
async function waitForOperation(opName, timeoutMs = 15 * 60 * 1000) {
  const url = `https://${discoveryHost()}/v1/${opName}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await authedFetch(url);
    const body = await res.json().catch(() => ({}));
    if (body.done) {
      if (body.error) throw new Error(`Operation failed: ${JSON.stringify(body.error)}`);
      return body;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Operation ${opName} timed out`);
}

/**
 * Create the unstructured, content-bearing data store if it does not already exist.
 * @returns {Promise<{id:string,name:string,created:boolean,consoleLink:string}>}
 */
async function ensureDataStore() {
  if (!PROJECT) throw new Error('GCP_PROJECT env var is not set');

  const getUrl = `https://${discoveryHost()}/v1/${dataStorePath()}`;
  const existing = await authedFetch(getUrl);
  if (existing.ok) {
    return { id: DATA_STORE_ID, name: dataStorePath(), created: false, consoleLink: dataStoreConsoleLink() };
  }
  if (existing.status !== 404) {
    throw new Error(`GET dataStore ${existing.status}: ${await existing.text()}`);
  }

  const createUrl =
    `https://${discoveryHost()}/v1/${parentPath()}/dataStores` +
    `?dataStoreId=${encodeURIComponent(DATA_STORE_ID)}`;
  const res = await authedFetch(createUrl, {
    method: 'POST',
    body: JSON.stringify({
      displayName: DATA_STORE_NAME,
      industryVertical: 'GENERIC',
      solutionTypes: ['SOLUTION_TYPE_SEARCH'],
      contentConfig: 'CONTENT_REQUIRED',
    }),
  });
  if (!res.ok) throw new Error(`Create dataStore ${res.status}: ${await res.text()}`);

  const op = await res.json();
  if (op.name) await waitForOperation(op.name);
  return { id: DATA_STORE_ID, name: dataStorePath(), created: true, consoleLink: dataStoreConsoleLink() };
}

/**
 * Write one text object per page plus a metadata NDJSON manifest that references
 * them. Import uses the manifest (dataSchema=document).
 * @returns {Promise<{manifestUri:string,count:number}>}
 */
async function stageToGcs(docs) {
  if (!BUCKET) throw new Error('VAIS_BUCKET env var is not set');
  const bucket = storage.bucket(BUCKET);

  const lines = [];
  for (const doc of docs) {
    const objectPath = `${GCS_PREFIX}/content/${doc.id}.txt`;
    const body = `${doc.title}\n${doc.url}\n\n${doc.text}`;
    await bucket.file(objectPath).save(body, {
      resumable: false,
      contentType: 'text/plain; charset=utf-8',
      metadata: { cacheControl: 'no-store' },
    });

    lines.push(
      JSON.stringify({
        id: doc.id,
        structData: {
          title: doc.title,
          url: doc.url,
          description: doc.description || '',
          lang: doc.lang || 'cs',
          crawledAt: doc.crawledAt,
        },
        content: { mimeType: 'text/plain', uri: `gs://${BUCKET}/${objectPath}` },
      })
    );
  }

  const manifestPath = `${GCS_PREFIX}/metadata/manifest.ndjson`;
  await bucket.file(manifestPath).save(lines.join('\n'), {
    resumable: false,
    contentType: 'application/x-ndjson',
    metadata: { cacheControl: 'no-store' },
  });

  return { manifestUri: `gs://${BUCKET}/${manifestPath}`, count: docs.length };
}

/**
 * Import the staged manifest into the data store, fully reconciling so the store
 * mirrors the latest crawl.
 * @returns {Promise<{operation:string}>}
 */
async function importDocuments(manifestUri) {
  const url =
    `https://${discoveryHost()}/v1/${dataStorePath()}/branches/${BRANCH}/documents:import`;
  const res = await authedFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      gcsSource: { inputUris: [manifestUri], dataSchema: 'document' },
      reconciliationMode: 'FULL',
    }),
  });
  if (!res.ok) throw new Error(`Import ${res.status}: ${await res.text()}`);
  const op = await res.json();
  return { operation: op.name || '' };
}

module.exports = {
  ensureDataStore,
  stageToGcs,
  importDocuments,
  dataStoreConsoleLink,
  DATA_STORE_ID,
  LOCATION,
};
