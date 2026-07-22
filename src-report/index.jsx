// Ensure AgentX globals exist before anything imports SDK expectations.
import './agentx-globals';
import '@momentum-ui/core/css/momentum-ui.min.css';
import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import store from './store';
import ActivityReport from './components/ActivityReport';
import { I18nProvider } from './i18n/I18nContext';
import { detectBrowserLocale } from './i18n/translations';
import { hydrateContext } from './store/slices/activitySlice';

const ELEMENT_TAG = 'agent-activity-widget';
const STYLE_ID = 'agent-activity-styles';

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
      console.warn('[agent-activity] Could not read stylesheet:', e.message);
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

// ── Standalone harness mount (dev / preview) ─────────────────────────────────
if (globalThis.document?.getElementById('react-root')) {
  const container = globalThis.document.getElementById('react-root');
  injectCSS(container);
  const params = (() => {
    try { return new URLSearchParams(globalThis.location?.search); } catch { return null; }
  })();
  const urlLocale = params?.get('locale');
  const urlView = params?.get('view');        // mock | live (data source)
  const urlActivityUrl = params?.get('activityurl');
  store.dispatch(hydrateContext({
    view: urlView || 'mock',
    activityurl: urlActivityUrl || null,
  }));
  const locale = urlLocale || detectBrowserLocale();
  const render = (
    <Provider store={store}>
      <I18nProvider initialLocale={locale}>
        <ActivityReport />
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
 * AgentActivityElement — custom Web Component for the supervisor activity widget.
 * Mounted on a dedicated navigation page of the Webex CC supervisor desktop.
 */
class AgentActivityElement extends HTMLElement {
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
      view: null,          // 'mock' | 'live'
      activityurl: null,   // Cloud Function ingest/query URL
      config: null,
    };
    this._updatePending = false;
  }

  static get observedAttributes() {
    return ['darkmode', 'accesstoken', 'orgid', 'datacenter', 'locale', 'view', 'activityurl'];
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

  set view(v) { this._props.view = v; this.updateComponent(); }
  get view() { return this._props.view; }

  set activityurl(v) { this._props.activityurl = v; this.updateComponent(); }
  get activityurl() { return this._props.activityurl; }

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
    if (name === 'config') {
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
    const container = this.querySelector('#agent-activity-container');
    if (!container) return;
    const locale = this._props.locale || detectBrowserLocale();
    const tree = (
      <Provider store={store}>
        <I18nProvider initialLocale={locale}>
          <ActivityReport />
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
    const preUpgrade = ['config', 'view', 'activityurl', 'accesstoken', 'orgid', 'datacenter', 'darkmode', 'locale'];
    for (const prop of preUpgrade) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const val = this[prop];
        delete this[prop];
        this[prop] = val;
      }
    }

    // Seed from attributes when properties were not set.
    for (const name of ['darkmode', 'accesstoken', 'orgid', 'datacenter', 'locale', 'view', 'activityurl']) {
      if (this._props[name] == null && this.hasAttribute(name)) {
        this._props[name] = this.getAttribute(name);
      }
    }

    // Establish a definite height chain (panel → host → container → report) so
    // the report's internal overflow:auto engages and the widget scrolls.
    this.style.display = 'flex';
    this.style.flexDirection = 'column';
    this.style.height = '100%';
    this.style.minHeight = '0';
    this.innerHTML = '<div id="agent-activity-container" style="display:flex;flex-direction:column;width:100%;height:100%;min-height:0;"></div>';
    const container = this.querySelector('#agent-activity-container');
    this.container = container;
    injectCSS(this);
    if (ReactDOM.createRoot) this.root = ReactDOM.createRoot(container);

    this._hydrate();
    this.renderComponent();
  }

  disconnectedCallback() {
    if (this.root && this.root.unmount) {
      try { this.root.unmount(); } catch { /* ignore */ }
    }
    this.root = null;
    this.container = null;
  }
}

if (!customElements.get(ELEMENT_TAG)) {
  customElements.define(ELEMENT_TAG, AgentActivityElement);
}
