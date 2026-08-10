'use strict';

/**
 * crawler.js — polite web crawler for the innogy.cz "Péče" (customer care) section.
 *
 * Crawls the seed page and one level deeper (pages linked FROM the seed that live
 * under the same path prefix on the same host), extracts the main readable text of
 * each page, and returns normalized documents ready for a Vertex AI Search
 * (Discovery Engine) unstructured data store.
 *
 * Depth model (per the requirement "…and 1 level lower"):
 *   depth 0 = the seed page (/pece/)
 *   depth 1 = every same-host page linked from the seed under the path prefix
 *
 * No content is stored here; the caller stages the returned docs to GCS and imports
 * them. Crawling is throttled and identifies itself via a descriptive User-Agent.
 */

const crypto = require('crypto');
const cheerio = require('cheerio');

const SEED_URL = process.env.CRAWL_SEED_URL || 'https://www.innogy.cz/pece/';
const MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES || 120);
const REQUEST_DELAY_MS = Number(process.env.CRAWL_DELAY_MS || 400);
const REQUEST_TIMEOUT_MS = Number(process.env.CRAWL_TIMEOUT_MS || 15000);
const USER_AGENT =
  process.env.CRAWL_USER_AGENT ||
  'InnogyKnowledgeBaseBot/1.0 (+Vertex AI Search ingestion; contact: webexcc-widgets)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const docId = (url) => crypto.createHash('sha1').update(url).digest('hex').slice(0, 24);

// Content-bearing block elements we keep; everything else is chrome/layout.
const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,blockquote,figcaption';

// Class/id tokens that mark a subtree as non-content (nav, chrome, widgets,
// popups, promos). Matched per whole token (split on non-alphanumerics) so we do
// NOT accidentally nuke real content like "formulare"/"informace"/"kontakt".
const NOISE_TOKENS = new Set([
  'nav', 'navbar', 'navigation', 'menu', 'submenu', 'breadcrumb', 'breadcrumbs',
  'footer', 'header', 'cookie', 'cookies', 'consent', 'gdpr', 'popup', 'modal',
  'fancybox', 'cmb', 'overlay', 'dialog', 'tooltip', 'share', 'social',
  'newsletter', 'subscribe', 'banner', 'promo', 'advert', 'cta', 'search',
  'skip', 'lang', 'login', 'logout', 'basket', 'cart', 'hero', 'sitemap',
  'toolbar', 'pager', 'pagination', 'sidebar', 'widget', 'fixed', 'chat',
  'chatbot', 'anchor-nav',
]);

/** True when an element's class/id marks it as chrome rather than page content. */
function isNoisyNode($el) {
  const key = `${$el.attr('class') || ''} ${$el.attr('id') || ''}`.toLowerCase();
  for (const tok of key.split(/[^a-z0-9]+/)) {
    if (tok && NOISE_TOKENS.has(tok)) return true;
  }
  return false;
}

/** Strip fragment/query, drop trailing slash (except root) so URLs dedupe cleanly. */
function normalizeUrl(raw, base) {
  try {
    const u = new URL(raw, base);
    u.hash = '';
    u.search = '';
    let s = u.toString();
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

/** Only same-host http(s) pages under the seed's path prefix are crawl candidates. */
function isInScope(url, seedUrl) {
  try {
    const u = new URL(url);
    const seed = new URL(seedUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.hostname !== seed.hostname) return false;
    const prefix = process.env.CRAWL_PATH_PREFIX || seed.pathname.replace(/\/+$/, '');
    return u.pathname.startsWith(prefix || '/');
  } catch {
    return false;
  }
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !/text\/html|application\/xhtml/i.test(type)) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Extract a page's readable content. It harvests crawl links from the full page,
 * then strips boilerplate (scripts, forms, nav/header/footer, popups, contact
 * widgets, promos, etc.) and reads only genuine content blocks — headings,
 * paragraphs, list items and table cells — keeping just the innermost ones so text
 * is captured once, in reading order.
 */
function extractContent(html, url) {
  const $ = cheerio.load(html);

  // 1) Harvest links for crawling BEFORE we prune, so navigation-only links to
  //    deeper content pages are still discoverable.
  const links = [];
  $('a[href]').each((_, el) => {
    const abs = normalizeUrl($(el).attr('href'), url);
    if (abs) links.push(abs);
  });

  // 2) Page metadata (read before pruning removes <head>/<title> context).
  const title =
    ($('meta[property="og:title"]').attr('content') || $('title').first().text() || '').trim();
  const description = ($('meta[name="description"]').attr('content') || '').trim();
  const lang = ($('html').attr('lang') || 'cs').trim().slice(0, 5) || 'cs';

  // 3) Hard-remove non-content elements and interactive controls.
  $('script, style, noscript, template, svg, iframe, form, input, select, textarea, button, nav, header, footer, aside').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"], [role="search"], [role="dialog"], [aria-hidden="true"]').remove();

  // 4) Remove chrome/widget subtrees identified by their class/id tokens.
  $('[class], [id]').each((_, el) => {
    const $el = $(el);
    if (isNoisyNode($el)) $el.remove();
  });

  // 5) Prefer the semantic main region, then read innermost content blocks only.
  const root = $('main').first().length
    ? $('main').first()
    : $('article').first().length
      ? $('article').first()
      : $('body');

  const lines = [];
  const seen = new Set();
  root.find(BLOCK_SELECTOR).each((_, el) => {
    const $el = $(el);
    if ($el.find(BLOCK_SELECTOR).length) return; // skip wrappers → keep innermost
    const t = $el
      .text()
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (t.length < 3 || seen.has(t)) return;
    seen.add(t);
    lines.push(t);
  });

  const text = lines.join('\n').trim();
  return { title, description, lang, text, links };
}

/**
 * Crawl the seed + one level deeper and return extracted documents.
 * @returns {Promise<Array<{id,url,title,description,lang,text,crawledAt}>>}
 */
async function crawlPeceDocs(opts = {}) {
  const seed = normalizeUrl(opts.seedUrl || SEED_URL, SEED_URL);
  if (!seed) throw new Error(`Invalid seed URL: ${opts.seedUrl || SEED_URL}`);

  const maxPages = opts.maxPages || MAX_PAGES;
  const visited = new Set();
  const docs = [];

  // BFS queue of { url, depth }; depth 1 is the deepest we descend.
  const queue = [{ url: seed, depth: 0 }];

  while (queue.length && docs.length < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchHtml(url);
    if (REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS);
    if (!html) continue;

    const { title, description, lang, text, links } = extractContent(html, url);
    if (text && text.length >= 80) {
      docs.push({
        id: docId(url),
        url,
        title: title || url,
        description,
        lang,
        text,
        crawledAt: new Date().toISOString(),
      });
    }

    if (depth < 1) {
      for (const link of links) {
        if (!visited.has(link) && isInScope(link, seed)) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  return docs;
}

module.exports = { crawlPeceDocs, docId, SEED_URL };
