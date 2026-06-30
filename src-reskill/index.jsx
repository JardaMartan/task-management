// Ensure AgentX globals exist before anything imports SDK expectations.
import './agentx-globals';
import '@momentum-ui/core/css/momentum-ui.min.css';
import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import store from './store';
import BulkReskill from './BulkReskill';
import { I18nProvider } from './i18n/I18nContext';
import { detectBrowserLocale } from './i18n/translations';
import { hydrateContext } from './store/slices/reskillSlice';

const ELEMENT_TAG = 'bulk-reskill-widget';
const STYLE_ID = 'bulk-reskill-styles';

/**
 * Copy document stylesheets into a shadow root so Momentum + widget CSS resolve
 * inside the Desktop's web-component host. No-op when not in a shadow root
 * (postcss inject already placed the CSS in document head).
 */
const injectCSS = (container) => {
  const targetDocument = container?.getRootNode?.() || document;
  if (targetDocument === document) return;

  const styleSheets = [];
  for (const sheet of document.styleSheets) {
    try {
      if (sheet.cssRules) {
        let css = '';
        for (const rule of sheet.cssRules) css += `${rule.cssText}\n`;
        if (css) styleSheets.push(css);
      }
    } catch (e) {
      console.warn('[bulk-reskill] Could not read stylesheet:', e.message);
    }
  }
  if (styleSheets.length === 0) return;

  const existing = targetDocument.querySelector(`#${STYLE_ID}`);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = styleSheets.join('\n');
  targetDocument.insertBefore(style, targetDocument.firstChild);
};

// Standalone harness mount (dev / preview): render straight into #react-root.
if (globalThis.document?.getElementById('react-root')) {
  const container = globalThis.document.getElementById('react-root');
  injectCSS(container);
  const params = (() => {
    try { return new URLSearchParams(globalThis.location?.search); } catch { return null; }
  })();
  const urlLocale = params?.get('locale');
  const urlView = params?.get('view');
  // Allow the dev harness to force data mode via ?view=mock|live.
  if (urlView) store.dispatch(hydrateContext({ view: urlView }));
  const locale = urlLocale || detectBrowserLocale();
  const render = (
    <Provider store={store}>
      <I18nProvider initialLocale={locale}>
        <BulkReskill />
      </I18nProvider>
    </Provider>
  );
  if (ReactDOM.createRoot) {
    ReactDOM.createRoot(container).render(render);
  } else {
    ReactDOM.render(render, container);
  }
}

/**
 * BulkReskillElement — custom Web Component wrapper for the supervisor reskilling
 * widget. Mounted on a dedicated navigation page of the Webex CC supervisor
 * desktop. Accepts desktop context via attributes/properties.
 */
class BulkReskillElement extends HTMLElement {
  constructor() {
    super();
    this.root = null;
    this.container = null;
    this._props = {
      darkmode: null,
      accesstoken: null,
      orgid: null,
      datacenter: null,
      locale: null,
      teams: null, // supervisor team scope (JSON array or comma list)
      view: null, // initial data mode: 'mock' | 'live' (null = auto-detect)
      config: null,
    };
    this._updatePending = false;
  }

  static get observedAttributes() {
    return ['darkmode', 'accesstoken', 'orgid', 'datacenter', 'locale', 'teams', 'view'];
  }

  // ── property setters (Desktop passes via element.<prop> = value) ──────────
  set darkmode(v) { this._props.darkmode = v; this.updateComponent(); }
  get darkmode() { return this._props.darkmode; }

  set accesstoken(v) { this._props.accesstoken = v; this.updateComponent(); }
  get accesstoken() { return this._props.accesstoken; }

  set orgid(v) { this._props.orgid = v; this.updateComponent(); }
  get orgid() { return this._props.orgid; }

  set datacenter(v) { this._props.datacenter = v; this.updateComponent(); }
  get datacenter() { return this._props.datacenter; }

  set dataCenter(v) { this.datacenter = v; }
  get dataCenter() { return this.datacenter; }

  set locale(v) { this._props.locale = v; this.updateComponent(); }
  get locale() { return this._props.locale || detectBrowserLocale(); }

  set teams(v) { this._props.teams = v; this.updateComponent(); }
  get teams() { return this._props.teams; }

  set supervisorteams(v) { this.teams = v; }
  get supervisorteams() { return this._props.teams; }

  set view(v) { this._props.view = v; this.updateComponent(); }
  get view() { return this._props.view; }

  set config(v) {
    let parsed = v;
    if (typeof v === 'string') {
      try { parsed = JSON.parse(v); } catch { parsed = null; }
    }
    this._props.config = (parsed && typeof parsed === 'object') ? parsed : null;
    this.updateComponent();
  }
  get config() { return this._props.config; }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === 'teams' || name === 'config') {
      this[name] = newValue;
    } else {
      this._props[name] = newValue;
      this.updateComponent();
    }
  }

  updateComponent() {
    if (!this.root && !this.container) return;
    if (this._updatePending) return;
    this._updatePending = true;
    Promise.resolve().then(() => {
      this._updatePending = false;
      this._hydrate();
      this.renderComponent();
    });
  }

  _hydrate() {
    // Merge config object (if Desktop passed one) over the flat props.
    const merged = { ...this._props, ...(this._props.config || {}) };
    store.dispatch(hydrateContext(merged));
  }

  renderComponent() {
    const container = this.querySelector('#bulk-reskill-container');
    if (!container) return;
    const locale = this._props.locale || detectBrowserLocale();
    const tree = (
      <Provider store={store}>
        <I18nProvider initialLocale={locale}>
          <BulkReskill />
        </I18nProvider>
      </Provider>
    );
    if (ReactDOM.createRoot && this.root) {
      this.root.render(tree);
    } else if (this.container) {
      ReactDOM.render(tree, container);
    }
  }

  connectedCallback() {
    // Promote any pre-upgrade properties so prototype setters run.
    const preUpgrade = ['config', 'teams', 'view', 'accesstoken', 'orgid', 'datacenter', 'darkmode', 'locale'];
    for (const prop of preUpgrade) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const val = this[prop];
        delete this[prop];
        this[prop] = val;
      }
    }

    // Seed from attributes when properties were not set.
    for (const name of ['darkmode', 'accesstoken', 'orgid', 'datacenter', 'locale', 'teams', 'view']) {
      if (this._props[name] == null && this.hasAttribute(name)) {
        this._props[name] = this.getAttribute(name);
      }
    }
    if (!this._props.config && this.hasAttribute('config')) {
      try { this._props.config = JSON.parse(this.getAttribute('config')); } catch { /* ignore */ }
    }

    this.style.display = 'flex';
    this.style.flexDirection = 'column';
    this.style.width = '100%';
    this.style.height = '100%';

    const container = globalThis.document.createElement('div');
    container.id = 'bulk-reskill-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    injectCSS(this);
    this._hydrate();

    const locale = this._props.locale || detectBrowserLocale();
    const tree = (
      <Provider store={store}>
        <I18nProvider initialLocale={locale}>
          <BulkReskill />
        </I18nProvider>
      </Provider>
    );

    try {
      if (ReactDOM.createRoot) {
        this.root = ReactDOM.createRoot(container);
        this.root.render(tree);
      } else {
        this.container = container;
        ReactDOM.render(tree, container);
      }
    } catch (error) {
      console.error('[bulk-reskill] Error in connectedCallback:', error);
      this.innerHTML = `<div style="padding:20px;color:red;border:2px solid red;">
        <h3>Widget Error</h3><p>${error.message}</p></div>`;
    }
  }

  disconnectedCallback() {
    if (this.root) this.root.unmount();
    else if (this.container) ReactDOM.unmountComponentAtNode(this.container);
  }
}

if (globalThis.customElements && !globalThis.customElements.get(ELEMENT_TAG)) {
  globalThis.customElements.define(ELEMENT_TAG, BulkReskillElement);
}
