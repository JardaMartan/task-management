// Ensure AgentX globals exist before anything else imports SDK expectations
import './agentx-globals';
import '@momentum-ui/core/css/momentum-ui.min.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import store from './store';
import { clearSearch, stopJDSStreaming } from './store';
import { setJDSDataCenter } from './api';
import TaskManagement from './TaskManagement';
import { I18nProvider } from './i18n/I18nContext';
import { detectBrowserLocale } from './i18n/translations';

/**
 * Inject CSS into the container (shadow DOM or document head)
 * PostCSS with inject:true will have already injected into document,
 * but we also need to inject into shadow DOM for web components
 * @param {HTMLElement} container - Container element to inject CSS into
 */
const injectCSS = (container) => {
  const targetDocument = container?.getRootNode?.() || document;
  const isShadowRoot = targetDocument !== document;

  if (!isShadowRoot) {
    console.log('TaskManagement: Not in shadow DOM, CSS already injected by postcss');
    return;
  }

  // Get all stylesheets from document
  const styleSheets = [];
  for (const sheet of document.styleSheets) {
    try {
      // Try to access stylesheet rules
      if (sheet.cssRules) {
        let css = '';
        for (const rule of sheet.cssRules) {
          css += rule.cssText + '\n';
        }
        if (css) styleSheets.push(css);
      }
    } catch (e) {
      // CORS or other restriction
      console.warn('Could not read stylesheet:', e.message);
    }
  }

  if (styleSheets.length === 0) {
    console.warn('TaskManagement: No stylesheets found to inject into shadow DOM');
    return;
  }

  const combinedCSS = styleSheets.join('\n');

  // Remove existing style if present
  const existingStyle = targetDocument.querySelector('#task-management-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = 'task-management-styles';
  style.textContent = combinedCSS;

  targetDocument.insertBefore(style, targetDocument.firstChild);
  console.log('TaskManagement: CSS injected into shadow DOM (length:', combinedCSS.length, ')');
};

if (globalThis.document?.getElementById('react-root')) {
  const container = globalThis.document.getElementById('react-root');

  injectCSS(container);

  if (ReactDOM.createRoot) {
    const root = ReactDOM.createRoot(container);
    root.render(
      <Provider store={store}>
        <TaskManagement />
      </Provider>
    );
  } else {
    ReactDOM.render(
      <Provider store={store}>
        <TaskManagement />
      </Provider>,
      container
    );
  }
}

/**
 * TaskManagementElement - Custom Web Component wrapper for the React widget
 * Provides property getters/setters for integration with Webex Contact Center Desktop
 */
class TaskManagementElement extends HTMLElement {
  constructor() {
    super();
    this.root = null;
    this.widgetAttributes = {
      darkmode: null,
      accesstoken: null
    };
    this._task = null;
    this._selectedtaskid = null;
    this._cad = null;
    this._details = null;
    this._wrap = null;
    this._avatar = null;
    this._name = null;
    this._orgid = null;
    this._datacenter = null;
    this._workspaceid = null;
    this._taskType = null;
    this._email = null;
    this._agent = null;
    this._locale = null; // Will be set from attribute or browser detection
    this._customStyle = null; // Custom styles passed as property
    this._config = null; // Widget configuration JSON from Desktop profile

    // Create a proxy to intercept style property assignments
    // This allows us to capture { height: '100%', ... } style objects passed by Desktop
    const handler = {
      set: (target, property, value) => {
        if (property === 'style' && typeof value === 'object' && value !== null) {
          console.log('TaskManagement: Intercepted style object:', value);
          this._customStyle = value;
          this.updateComponent();
          return true;
        }
        target[property] = value;
        return true;
      },
    };

    // Note: Proxy doesn't work with DOM elements in all browsers, so we'll use
    // Object.defineProperty instead as a fallback
  }

  static get observedAttributes() {
    return ['darkmode', 'accesstoken', 'orgid', 'datacenter', 'locale', 'tasktype', 'email', 'view'];
  }

  set darkmode(value) {
    console.log('DarkMode setter:', value);
    const strVal = String(value);
    this.widgetAttributes.darkmode = strVal;
    this.updateComponent();
  }

  get darkmode() {
    return this.widgetAttributes.darkmode;
  }

  set accesstoken(value) {
    console.log('AccessToken setter:', value);
    this.setAttribute('accesstoken', value);
  }

  get accesstoken() {
    return this.getAttribute('accesstoken');
  }

  set orgid(value) {
    console.log('OrgId setter:', value);
    this.setAttribute('orgid', value);
  }

  get orgid() {
    return this.getAttribute('orgid');
  }

  set datacenter(value) {
    console.log('DataCenter setter:', value);
    // Avoid infinite loop if attribute change triggers setter (though browsers usually prevent this)
    if (this.getAttribute('datacenter') !== value) {
        this.setAttribute('datacenter', value);
    }
    this._datacenter = value;
    setJDSDataCenter(value);
    this.updateComponent();
  }

  get datacenter() {
    return this._datacenter || this.getAttribute('datacenter');
  }

  // camelCase alias for Desktop layout compatibility ("dataCenter" property in JSON)
  set dataCenter(value) {
    this.datacenter = value;
  }

  get dataCenter() {
    return this.datacenter;
  }

  set workspaceid(value) {
    console.log('WorkspaceId setter:', value);
    this._workspaceid = value;
    this.updateComponent();
  }

  get workspaceid() {
    return this._workspaceid;
  }

  set taskType(value) {
    this._taskType = value;
    this.updateComponent();
  }

  get taskType() {
    return this._taskType;
  }

  set tasktype(value) {
    this.taskType = value;
  }

  get tasktype() {
    return this.taskType;
  }

  set email(value) {
    this._email = value;
    this.updateComponent();
  }

  get email() {
    return this._email;
  }

  set view(value) {
    this._view = value;
    this.updateComponent();
  }

  get view() {
    return this._view;
  }

  set styleConfig(value) {
    console.log('StyleConfig setter:', value);
    if (typeof value === 'object' && value !== null) {
      this._customStyle = value;
      this.updateComponent();
    }
  }

  get styleConfig() {
    return this._customStyle;
  }

  set task(value) {
    if (this._task === value) return;
    this._task = value;
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      console.log('TaskManagement: task prop updated:', JSON.stringify(parsed, null, 2));
    } catch {
      console.log('TaskManagement: task prop updated (raw):', value);
    }
    this.updateComponent();
  }

  get task() {
    return this._task;
  }

  set selectedtaskid(value) {
    if (this._selectedtaskid === value) return;
    this._selectedtaskid = value;
    this.updateComponent();
  }

  get selectedtaskid() {
    return this._selectedtaskid;
  }

  set cad(value) {
    if (this._cad === value) return;
    this._cad = value;
    this.updateComponent();
  }

  get cad() {
    return this._cad;
  }

  set details(value) {
    if (this._details === value) return;
    this._details = value;
    this.updateComponent();
  }

  get details() {
    return this._details;
  }

  set wrap(value) {
    if (this._wrap === value) return;
    this._wrap = value;
    this.updateComponent();
  }

  get wrap() {
    return this._wrap;
  }

  set avatar(value) {
    if (this._avatar === value) return;
    this._avatar = value;
    this.updateComponent();
  }

  get avatar() {
    return this._avatar;
  }

  set name(value) {
    if (this._name === value) return;
    this._name = value;
    this.updateComponent();
  }

  get name() {
    return this._name;
  }

  set agent(value) {
    if (this._agent === value) return;
    this._agent = value;
    this.updateComponent();
  }

  get agent() {
    return this._agent;
  }

  set locale(value) {
    const resolved = value || detectBrowserLocale();
    if (this._locale === resolved) return;
    this._locale = resolved;
    this.updateComponent();
  }

  get locale() {
    return this._locale || detectBrowserLocale();
  }

  set config(value) {
    let parsed = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch { parsed = null; }
    }
    this._config = (parsed && typeof parsed === 'object') ? parsed : null;
    this.updateComponent();
  }

  get config() {
    return this._config;
  }

  /**
   * Handle style property - accepts object with CSS properties
   * Cannot override native style, so we use a custom method
   */
  setStyles(styleObj) {
    if (typeof styleObj === 'object' && styleObj !== null) {
      this._customStyle = styleObj;
      this.updateComponent();
    }
  }

  /**
   * Get custom styles passed by Desktop environment
   */
  getCustomStyle() {
    return this._customStyle;
  }

  /**
   * Update component when properties change.
   * Debounced via microtask so multiple synchronous setter calls in one tick
   * collapse into a single React re-render.
   */
  updateComponent() {
    if (!this.root && !this.container) return;
    if (this._updatePending) return;
    this._updatePending = true;
    Promise.resolve().then(() => {
      this._updatePending = false;
      this.renderComponent();
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`TaskManagement: Attribute ${name} changed from "${oldValue}" to "${newValue}"`);
    if (name === 'locale') {
      this._locale = newValue || detectBrowserLocale();
    } else if (name === 'orgid') {
      this._orgid = newValue;
    } else if (name === 'tasktype') {
      this._taskType = newValue;
    } else if (name === 'email') {
      this._email = newValue;
    } else if (name === 'view') {
      this._view = newValue;
    } else if (name === 'datacenter') {
      console.log('TaskManagement: Attribute datacenter changed:', newValue);
      this._datacenter = newValue;
      setJDSDataCenter(newValue);
    } else {
      this.widgetAttributes[name] = newValue;
    }

    if (this.root || this.container) {
      this.renderComponent();
    }
  }

  /**
   * Render the React component with current props
   */
  renderComponent() {
    const container = this.querySelector('#task-management-container');
    if (!container) return;

    // Determine effective locale: explicit attribute > browser detection
    const effectiveLocale = this._locale || detectBrowserLocale();

    // Convert darkmode string attribute to boolean (web component attributes are always strings)
    const rawDarkmode = this.widgetAttributes.darkmode;
    const isDarkMode = rawDarkmode === 'true' || rawDarkmode === true;

    console.log('TaskManagement: Rendering with datacenter:', this._datacenter);

    const componentProps = {
      darkmode: isDarkMode,
      accesstoken: this.widgetAttributes.accesstoken,
      workspaceid: this._workspaceid,
      taskType: this._taskType,
      email: this._email,
      view: this._view,
      task: this._task,
      selectedtaskid: this._selectedtaskid,
      cad: this._cad,
      details: this._details,
      wrap: this._wrap,
      avatar: this._avatar,
      name: this._name,
      orgid: this._orgid,
      datacenter: this._datacenter,
      agent: this._agent,
      locale: effectiveLocale,
      style: this.getCustomStyle(),
      config: this._config,
    };

    if (ReactDOM.createRoot && this.root) {
      this.root.render(
        <Provider store={store}>
          <I18nProvider initialLocale={effectiveLocale}>
            <TaskManagement {...componentProps} />
          </I18nProvider>
        </Provider>
      );
    } else if (this.container) {
      ReactDOM.render(
        <Provider store={store}>
          <I18nProvider initialLocale={effectiveLocale}>
            <TaskManagement {...componentProps} />
          </I18nProvider>
        </Provider>,
        container
      );
    }
  }

  connectedCallback() {
    console.log('TaskManagement: Connected to DOM');

    // Reset widget state on every connection (tab switch)
    store.dispatch(clearSearch());
    store.dispatch(stopJDSStreaming());

    try {
      this.widgetAttributes.darkmode = this.getAttribute('darkmode');
      this.widgetAttributes.accesstoken = this.getAttribute('accesstoken');

      // Initialize orgid, datacenter, and workspaceid from attributes/properties
      this._orgid = this.getAttribute('orgid');
      this._datacenter = this.getAttribute('datacenter');
      this._workspaceid = this.getAttribute('workspaceid') || this._workspaceid;
      this._taskType = this.getAttribute('tasktype') || this._taskType;
      this._email = this.getAttribute('email') || this._email;
      this._view = this.getAttribute('view') || this._view;

      // Detect locale: explicit attribute > browser preference > default
      const localeAttr = this.getAttribute('locale');
      this._locale = localeAttr || detectBrowserLocale();

      console.log('TaskManagement: Initial attributes:', this.widgetAttributes);
      console.log('TaskManagement: Detected locale:', this._locale);

      const container = globalThis.document.createElement('div');
      container.id = 'task-management-container';
      // Set container to take full width and height of parent
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.width = '100%';
      container.style.height = '100%';
      this.appendChild(container);
      console.log('TaskManagement: Container created and appended');

      // Set web component styles
      this.style.display = 'flex';
      this.style.flexDirection = 'column';
      this.style.width = '100%';
      this.style.height = '100%';

      // Inject CSS BEFORE React renders
      injectCSS(this);
      console.log('TaskManagement: CSS injected, ready to render React');

      // Convert darkmode string to boolean (web component attributes are always strings)
      const rawDarkmode = this.widgetAttributes.darkmode;
      const isDarkMode = rawDarkmode === 'true' || rawDarkmode === true;
      console.log('TaskManagement: Initial darkmode conversion', {
        rawDarkmode,
        rawType: typeof rawDarkmode,
        isDarkMode
      });

      const componentProps = {
        darkmode: isDarkMode,
        accesstoken: this.widgetAttributes.accesstoken,
        workspaceid: this._workspaceid,
        taskType: this._taskType,
        email: this._email,
        view: this._view,
        task: this._task,
        selectedtaskid: this._selectedtaskid,
        cad: this._cad,
        details: this._details,
        wrap: this._wrap,
        avatar: this._avatar,
        name: this._name,
        orgid: this._orgid,
        datacenter: this._datacenter,
        agent: this._agent,
        locale: this._locale,
        style: this.getCustomStyle(),
        config: this._config,
      };

      console.log('TaskManagement: About to render with React', ReactDOM.createRoot ? '18' : '17');
      console.log('TaskManagement: Component props:', componentProps);

      if (ReactDOM.createRoot) {
        this.root = ReactDOM.createRoot(container);
        console.log('TaskManagement: React 18 root created');
        this.root.render(
          <Provider store={store}>
            <I18nProvider initialLocale={this._locale}>
              <TaskManagement {...componentProps} />
            </I18nProvider>
          </Provider>
        );
        console.log('TaskManagement: React 18 render called');
      } else {
        console.log('TaskManagement: Using React 17 render');
        ReactDOM.render(
          <Provider store={store}>
            <I18nProvider initialLocale={this._locale}>
              <TaskManagement {...componentProps} />
            </I18nProvider>
          </Provider>,
          container
        );
        this.container = container;
        console.log('TaskManagement: React 17 render called');
      }
    } catch (error) {
      console.error('❌ TaskManagement: Error in connectedCallback:', error);
      console.error('Error stack:', error.stack);
      // Display error in the component
      this.innerHTML = `<div style="padding: 20px; color: red; border: 2px solid red;">
        <h3>Widget Error</h3>
        <p>${error.message}</p>
        <pre style="font-size: 11px; overflow: auto;">${error.stack}</pre>
      </div>`;
    }
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
    } else if (this.container) {
      ReactDOM.unmountComponentAtNode(this.container);
    }
  }
}

if (globalThis.customElements && !globalThis.customElements.get('task-management')) {
  globalThis.customElements.define('task-management', TaskManagementElement);
}