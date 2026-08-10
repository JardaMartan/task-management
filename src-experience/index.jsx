// Ensure AgentX globals exist before anything imports SDK expectations.
import './agentx-globals';
import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import store from './store';
import AgentExperience from './AgentExperience';
import { I18nProvider } from './i18n/I18nContext';
import { detectBrowserLocale } from './i18n/translations';
import { hydrateContext } from './store/slices/experienceSlice';

const ELEMENT_TAG = 'agent-experience-widget';
const STYLE_ID = 'agent-experience-styles';

// Momentum core CSS is loaded from a CDN instead of bundled (~1.3 MB saved). The
// stylesheet's own @font-face url()s then resolve against the CDN, so fonts come
// from the CDN too (jsDelivr sends the CORS header cross-origin fonts need).
const MOMENTUM_CSS_CDN = 'https://cdn.jsdelivr.net/npm/@momentum-ui/core@19.16.1/css/momentum-ui.min.css';
const MOMENTUM_LINK_ID = 'agent-experience-momentum-css';

const injectMomentumLink = (node) => {
  const root = node?.getRootNode?.() || document;
  const inShadow = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot;
  const target = inShadow ? root : document.head;
  if (!target || target.querySelector(`#${MOMENTUM_LINK_ID}`)) return;
  const link = document.createElement('link');
  link.id = MOMENTUM_LINK_ID;
  link.rel = 'stylesheet';
  link.href = MOMENTUM_CSS_CDN;
  target.insertBefore(link, target.firstChild);
};

// Kick off the CDN download as early as possible (covers the light-DOM case).
injectMomentumLink(document);

/**
 * Copy document stylesheets into a shadow root so Momentum + widget CSS resolve
 * inside the Desktop's web-component host. No-op when not in a shadow root.
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
      console.warn('[agent-experience] Could not read stylesheet:', e.message);
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
  injectMomentumLink(container);
  const params = (() => {
    try { return new URLSearchParams(globalThis.location?.search); } catch { return null; }
  })();
  const urlLocale = params?.get('locale');
  const urlView = params?.get('view');
  if (urlView) store.dispatch(hydrateContext({ view: urlView }));
  const locale = urlLocale || detectBrowserLocale();
  const render = (
    <Provider store={store}>
      <I18nProvider initialLocale={locale}>
        <AgentExperience />
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
 * AgentExperienceElement — custom Web Component wrapper for the supervisor
 * "Agent Experience" widget. Mounted as a tab in the supervisor desktop.
 */
class AgentExperienceElement extends HTMLElement {
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
      experienceurl: null, // settings service (Cloud Function) endpoint
      config: null,
    };
    this._updatePending = false;
  }

  static get observedAttributes() {
    return ['darkmode', 'accesstoken', 'orgid', 'datacenter', 'locale', 'teams', 'view', 'experienceurl'];
  }

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

  set experienceurl(v) { this._props.experienceurl = v; this.updateComponent(); }
  get experienceurl() { return this._props.experienceurl; }

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
    const merged = { ...this._props, ...(this._props.config || {}) };
    store.dispatch(hydrateContext(merged));
  }

  renderComponent() {
    const container = this.querySelector('#agent-experience-container');
    if (!container) return;
    const locale = this._props.locale || detectBrowserLocale();
    const tree = (
      <Provider store={store}>
        <I18nProvider initialLocale={locale}>
          <AgentExperience />
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
    const preUpgrade = ['config', 'teams', 'view', 'accesstoken', 'orgid', 'datacenter', 'darkmode', 'locale', 'experienceurl'];
    for (const prop of preUpgrade) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const val = this[prop];
        delete this[prop];
        this[prop] = val;
      }
    }

    // Seed from attributes when properties were not set.
    for (const name of ['darkmode', 'accesstoken', 'orgid', 'datacenter', 'locale', 'teams', 'view', 'experienceurl']) {
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
    container.id = 'agent-experience-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    injectCSS(this);
    injectMomentumLink(this);
    this._hydrate();

    const locale = this._props.locale || detectBrowserLocale();
    const tree = (
      <Provider store={store}>
        <I18nProvider initialLocale={locale}>
          <AgentExperience />
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
      console.error('[agent-experience] Error in connectedCallback:', error);
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
  globalThis.customElements.define(ELEMENT_TAG, AgentExperienceElement);
}
