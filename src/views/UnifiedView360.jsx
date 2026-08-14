/**
 * UnifiedView360.jsx
 *
 * A single widget that hosts all customer-360 tabs internally.
 * This allows cross-tab navigation (e.g. History → Cases) without
 * relying on the WebexCC Desktop tab mechanism, which has no
 * inter-widget communication channel.
 *
 * Navigation API:
 *   onNavigate(view, params)
 *     view    – one of 'cases' | 'history' | 'voice' | 'email' | 'chat'
 *     params  – optional object, e.g. { highlightCaseId: 'CASE-2024-0892' }
 *
 * Accepted props (forwarded from TaskManagement):
 *   darkMode  – boolean
 *   mockMode  – boolean (enable demo data)
 *   task      – raw task payload from desktop (forwarded to sub-views)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';
import { setPendingEmailCompose } from '../store/slices/widgetSlice';
import { parseRiskValue } from '../store/slices/emailSlice';
import CasesView from './CasesView';
import HistoryView from './HistoryView';
import CustomerContactCard from './CustomerContactCard';
import VoiceWidget from '../voice/VoiceWidget';
import EmailWidget from '../email/EmailWidget';
import SlaCountdown from '../email/SlaCountdown';
import ChatWidget from '../chat/ChatWidget';
import TaskWidget from '../task/TaskWidget';
import { loadAgentSettings, provisionSlaCatalog, applyAgentState } from '../store/slices/settingsSlice';
import { setEmailTouched, setCadRiskDetected, searchCustomerByIdentityManual, clearManualCustomerSearch } from '../store/slices/emailSlice';

const TAB_IDS = ['cases', 'history', 'voice', 'email', 'chat', 'task'];
const TAB_ICONS = { cases: 'tasks_16', history: 'recents_16', voice: 'handset_16', email: 'email_16', chat: 'chat_16', task: 'check-circle_16' };

// Build callAssociatedDetails for EmailWidget from the raw task payload.
// Mirrors the logic in TaskManagement.buildEmailCallDetails.
const buildEmailCallDetails = (task, slaVariable) => {
  if (!task) return null;
  const raw = task.callAssociatedDetails || {};
  const cadVal = (field) => {
    const v = task.callAssociatedData?.[field];
    if (!v) return null;
    return typeof v === 'object' && 'value' in v ? v.value : String(v);
  };
  // For workItem tasks the ANI is a phone number, not an email — prefer the
  // explicit CAD 'email' field.  For native email tasks, ANI IS the sender address.
  const isWorkItem = task.mediaType === 'workItem';
  const isSocial   = task.mediaType === 'social';
  // For social/SMS outbound tasks the customer number is in customerNumber/dnis.
  // ani is the entry-point name — never use it as a customer identity.
  const fromAddress = isSocial
    ? (task.customerNumber ||
       task.callAssociatedData?.customerNumber?.value ||
       task.dnis ||
       null)
    : isWorkItem
      ? (cadVal('email') || raw.fromAddress || cadVal('fromAddress') || task.email || null)
      : (raw.fromAddress || cadVal('fromAddress') || task.ani || task.displayAni || task.phoneNumber || null);
  const subject = raw.subject || cadVal('subject') || task.mediaProperties?.emailSubject || null;
  const gmailThreadId = raw.gmailThreadId || cadVal('gmailThreadId') || null;
  const rfcMessageId = raw.rfcMessageId || cadVal('rfcMessageId') || null;
  // SLA expiry is delivered WITH the task as CAD; the variable name is configurable
  // via the desktop layout (emailConfig.slaVariable). Look in callAssociatedData
  // (cadVal unwraps {value:…}/string) then callAssociatedDetails, unwrapping either.
  const unwrap = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
  const slaExpiresRaw = slaVariable
    ? (cadVal(slaVariable) ?? unwrap(raw[slaVariable]) ?? null)
    : null;
  return { ...raw, customerEmail: fromAddress, fromAddress, gmailThreadId, rfcMessageId, subject, slaExpiresRaw };
};

const UnifiedView360 = ({ darkMode, mockMode, navPanel, task }) => {
  const { t, locale } = useI18n();
  const dispatch = useDispatch();
  // Auto-navigate to the correct tab when a task arrives.
  const isEmailTask = task?.mediaType === 'email' || task?.mediaChannel === 'email';
  const isWorkItemTask = task?.mediaType === 'workItem';
  const isVoiceTask = task?.mediaType === 'telephony';
  const isSocialTask = task?.mediaType === 'social'; // outbound SMS, etc.
  const initialTab = isEmailTask ? 'email' : isWorkItemTask ? 'task' : isVoiceTask ? 'voice' : 'history';

  // Customer email resolved from JDS (used when agent opens Email tab during a voice call).
  // loadJdsHistoryForVoiceTask sets state.email.customerEmail from the JDS person record.
  const voiceCustomerEmail = useSelector((s) => {
    if (!isVoiceTask) return null;
    if (s.email?.customerEmail) return s.email.customerEmail;
    const emails = s.email?.customerProfile?.email;
    if (Array.isArray(emails)) return emails.find((e) => String(e).includes('@')) || null;
    if (typeof emails === 'string' && emails.includes('@')) return emails;
    return null;
  });
  // Configurable CAD variable name that carries the email SLA expiry.
  const slaVariable = useSelector((s) => s.widget?.emailConfig?.slaVariable);
  // Agent id drives per-agent settings hydration + catalog provisioning.
  const agentId = useSelector((s) => s.widget?.agent?.agentId || s.widget?.agent?.agentDbId);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [navParams, setNavParams] = useState({});
  const [demoMode, setDemoMode] = useState(Boolean(mockMode));

  // ── Navigation-panel live customer lookup ────────────────────────────────
  // When the widget is open outside of any task (navPanel) the agent can search
  // a customer by email/phone. The resolved 360 context lives in Redux (same
  // state the task-driven loaders populate).
  const isNavPanel = Boolean(navPanel);
  const [searchInput, setSearchInput] = useState('');
  const manualStatus = useSelector((s) => s.email?.manualSearch?.status) || 'idle';
  const manualIdentity = useSelector((s) => s.email?.manualSearch?.identity);
  const resolvedProfile = useSelector((s) => s.email?.customerProfile);
  // In nav-panel live mode, only reveal the 360 tabs once a customer is resolved.
  const hasResolvedCustomer = Boolean(resolvedProfile) || manualStatus === 'searching';

  // Searched customer's email (nav-panel read-only email browse). Mirrors the
  // voice selector but is not gated on a task — the resolved profile is enough.
  const navCustomerEmail = useSelector((s) => {
    const email = s.email?.customerEmail;
    if (email && String(email).includes('@')) return email;
    const emails = s.email?.customerProfile?.email;
    if (Array.isArray(emails)) return emails.find((e) => String(e).includes('@')) || null;
    if (typeof emails === 'string' && emails.includes('@')) return emails;
    return null;
  });

  // Back / forward navigation stacks — each entry: { tab, params }
  const [histStack, setHistStack] = useState([]);
  const [fwdStack,  setFwdStack]  = useState([]);

  // Ref mirrors current tab+params so navigate() has no stale-closure deps.
  // Must be initialised to match activeTab so handleTabClick guard works correctly.
  const currentRef = useRef({ tab: initialTab, params: {} });

  // Reactive tab auto-switch: when the active task changes (new interaction or
  // agent switching between routed tasks), jump to the appropriate tab.
  // Track the last interactionId we auto-switched for so manual tab clicks are
  // not overridden when the component re-renders.
  const autoSwitchedForRef = useRef(null);
  useEffect(() => {
    const id = task?.interactionId;
    if (!id || id === autoSwitchedForRef.current) return;
    const targetTab = (task?.mediaType === 'email' || task?.mediaChannel === 'email')
      ? 'email'
      : task?.mediaType === 'workItem'
        ? 'task'
        : task?.mediaType === 'telephony'
          ? 'voice'
          : task?.mediaType === 'social'
            ? 'history'
            : null;
    if (!targetTab) return;
    autoSwitchedForRef.current = id;
    // Reset nav history — new task context
    setHistStack([]);
    setFwdStack([]);
    setNavParams({});
    setActiveTab(targetTab);
    currentRef.current = { tab: targetTab, params: {} };
  }, [task?.interactionId, task?.mediaType, task?.mediaChannel]);

  const applyNav = (tab, params) => {
    currentRef.current = { tab, params };
    setActiveTab(tab);
    setNavParams(params);
  };

  const navigate = useCallback((view, params = {}) => {
    // Snapshot BEFORE applyNav mutates currentRef — updater closures run after mutation
    const prev = { ...currentRef.current };
    setHistStack((h) => [...h, prev]);
    setFwdStack([]);
    applyNav(view, params);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabClick = (id) => {
    if (id === currentRef.current.tab) return;
    const prev = { ...currentRef.current };
    setHistStack((h) => [...h, prev]);
    setFwdStack([]);
    applyNav(id, {});
  };

  // External email-compose trigger (e.g. CRM Click-to-Contact extension via
  // handleInboundContactRequest → setPendingEmailCompose). Navigates to the
  // Email tab in compose mode for the requested address — the same result as
  // clicking the email button on the CustomerContactCard — then clears the
  // signal so it fires once per request.
  const pendingEmailCompose = useSelector((s) => s.widget?.pendingEmailCompose);
  useEffect(() => {
    if (!pendingEmailCompose || !pendingEmailCompose.address) return;
    navigate('email', { composeMode: true, composeTo: pendingEmailCompose.address });
    dispatch(setPendingEmailCompose(null));
  }, [pendingEmailCompose, navigate, dispatch]);

  const handleBack = () => {
    if (histStack.length === 0) return;
    const entry = histStack[histStack.length - 1];
    const current = { ...currentRef.current }; // snapshot before applyNav
    setHistStack(histStack.slice(0, -1));
    setFwdStack([current, ...fwdStack]);
    applyNav(entry.tab, entry.params);
  };

  const handleForward = () => {
    if (fwdStack.length === 0) return;
    const entry = fwdStack[0];
    const current = { ...currentRef.current }; // snapshot before applyNav
    setFwdStack(fwdStack.slice(1));
    setHistStack([...histStack, current]);
    applyNav(entry.tab, entry.params);
  };

  const canBack    = histStack.length > 0;
  const canForward = fwdStack.length > 0;

  // Submit a manual customer lookup (email or phone) in nav-panel live mode.
  const handleCustomerSearch = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setActiveTab('history');
    currentRef.current = { tab: 'history', params: {} };
    setHistStack([]);
    setFwdStack([]);
    setNavParams({});
    dispatch(searchCustomerByIdentityManual(q));
  };

  const handleClearCustomerSearch = () => {
    setSearchInput('');
    dispatch(clearManualCustomerSearch());
  };

  // Toggle between the demo showcase and the live search in nav-panel mode.
  const handleToggleDemo = () => {
    setDemoMode((d) => {
      const next = !d;
      // Leaving live → demo: drop any resolved customer so demo data is clean.
      if (next && isNavPanel) dispatch(clearManualCustomerSearch());
      return next;
    });
  };

  // Hydrate per-agent settings (localStorage) once the agent id is known.
  useEffect(() => {
    dispatch(loadAgentSettings());
    // Provision the idle-code / queue catalog for the central watcher + Tab Manager.
    dispatch(provisionSlaCatalog());
  }, [dispatch, agentId]);

  // Re-hydrate requeue settings when they are changed centrally in the CRM Tab
  // Manager (the watcher persists them, then broadcasts on the 'crm-sync' channel).
  // Also execute focus-mode agent state changes the headless watcher delegates
  // here (it can't reliably reach the routing service from the header widget).
  useEffect(() => {
    let ch;
    try {
      ch = new BroadcastChannel('crm-sync');
      ch.onmessage = (e) => {
        const d = e?.data;
        if (!d) return;
        if (d.type === 'SLA_SETTINGS_CHANGED') dispatch(loadAgentSettings());
        if (d.type === 'PROVISION_CATALOG') {
          // The header opened its settings panel and wants a fresh idle-code /
          // queue / wrap-up catalog. Re-fetch, persist, then notify it back.
          Promise.resolve(dispatch(provisionSlaCatalog())).finally(() => {
            try {
              const bc = new BroadcastChannel('crm-sync');
              bc.postMessage({ type: 'CATALOG_UPDATED' });
              bc.close();
            } catch { /* ignore */ }
          });
        }
        if (d.type === 'FOCUS_STATE' && d.state) {
          dispatch(applyAgentState({ state: d.state, auxCodeId: d.auxCodeId, channelType: d.channelType })).then((r) => {
            try {
              const bc = new BroadcastChannel('crm-sync');
              bc.postMessage({ type: 'FOCUS_STATE_RESULT', state: d.state, ok: !!r?.ok, error: r?.error });
              bc.close();
            } catch { /* ignore */ }
          });
        }
      };
    } catch { /* BroadcastChannel unsupported */ }
    return () => { try { ch?.close(); } catch { /* ignore */ } };
  }, [dispatch]);

  // Reset the email "touched" flag when a new task arrives. This view stays
  // mounted across tab switches, so the effect only fires on a real task change.
  useEffect(() => {
    dispatch(setEmailTouched(false));
  }, [dispatch, task?.interactionId]);

  // Tell the headless watcher which email tasks the agent has started drafting,
  // so its end-of-shift routine only requeues NEW (untouched) emails.
  const emailTouched = useSelector((s) => s.email.emailTouched);
  useEffect(() => {
    if (!emailTouched) return;
    const id = task?.interactionId;
    if (!id) return;
    try {
      const bc = new BroadcastChannel('crm-sync');
      bc.postMessage({ type: 'EMAIL_TOUCHED', interactionId: id });
      bc.close();
    } catch { /* BroadcastChannel unsupported */ }
  }, [emailTouched, task?.interactionId]);

  // Feed the FULL open-task list to the headless watcher so its SLA requeue /
  // focus checks cover every task — not just the one the Desktop pushes as the
  // selected `task` prop. The Desktop only exposes all open tasks via getTaskMap.
  useEffect(() => {
    if (demoMode) return undefined;
    let cancelled = false;
    const cadVal = (cad, cad2, key) => (cad?.[key]?.value) || cad2?.[key] || null;
    const extractOne = (tk) => {
      if (!tk) return null;
      const t = tk.interaction || tk;
      const id = tk.interactionId || t.interactionId || tk.id || null;
      if (!id) return null;
      const cad = t.callAssociatedData || {};
      const cad2 = t.callAssociatedDetails || {};
      const channel = String(t.mediaType || tk.mediaType || t.channelType || '').toLowerCase();
      const first = cadVal(cad, cad2, 'firstName') || cadVal(cad, cad2, 'first_name');
      const last = cadVal(cad, cad2, 'lastName') || cadVal(cad, cad2, 'last_name');
      const fullName = (first && last) ? `${first} ${last}` : (first || last || null);
      const title = cadVal(cad, cad2, 'title') || fullName || cadVal(cad, cad2, 'name')
        || t.customerName || cadVal(cad, cad2, 'customerName') || null;
      const email = cadVal(cad, cad2, 'email') || t.fromAddress || cadVal(cad, cad2, 'fromAddress') || null;
      let slaExpiresAt = null;
      if (slaVariable) {
        const raw = cadVal(cad, cad2, slaVariable);
        if (raw != null && raw !== '') {
          let ms = Number(raw);
          if (Number.isFinite(ms)) { if (ms > 0 && ms < 1e12) ms *= 1000; } else ms = Date.parse(raw);
          if (Number.isFinite(ms) && ms > 0) slaExpiresAt = ms;
        }
      }
      const riskRaw = cadVal(cad, cad2, 'Jmartan_Riziko');
      const riskDetected = parseRiskValue(riskRaw);
      return { interactionId: id, channel, slaExpiresAt, title: title || email || null, email, riskDetected };
    };
    const poll = async () => {
      try {
        const { Desktop } = await import('@wxcc-desktop/sdk');
        const map = await Desktop.actions.getTaskMap();
        if (cancelled || !map) return;
        const list = [];
        if (typeof map.forEach === 'function') map.forEach((v) => { const x = extractOne(v); if (x) list.push(x); });
        else Object.keys(map).forEach((k) => { const x = extractOne(map[k]); if (x) list.push(x); });
        const currentId = task?.interactionId;
        const currentTask = currentId ? list.find((t) => t.interactionId === currentId) : null;
        if (currentTask?.riskDetected !== undefined) {
          dispatch(setCadRiskDetected({ detected: currentTask.riskDetected, available: true }));
        }
        // Always reset the CAD risk flag when the current task is no longer in the
        // Desktop's open task map, so stale risk from a previous interaction does not
        // bleed onto the new active task.
        if (!currentTask && currentId) {
          dispatch(setCadRiskDetected({ detected: false, available: false }));
        }
        const bc = new BroadcastChannel('crm-sync');
        bc.postMessage({ type: 'TASK_MAP', tasks: list });
        bc.close();
      } catch { /* SDK unavailable */ }
    };
    poll();
    const timer = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [demoMode, slaVariable, task?.interactionId]);

  return (
    <div className={`unified-360${darkMode ? ' md--dark' : ''}`}>
      {/* ── Navigation-panel customer search bar (live lookup, no active task) ── */}
      {isNavPanel && !demoMode && (
        <form className="unified-360__search" onSubmit={handleCustomerSearch} role="search">
          <div className="unified-360__search-field">
            <svg className="unified-360__search-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M11.74 10.34l2.96 2.96a1 1 0 0 1-1.41 1.41l-2.96-2.96a5.5 5.5 0 1 1 1.41-1.41zM7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
            <input
              type="text"
              className="unified-360__search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('customer.search.placeholder')}
              aria-label={t('customer.search.placeholder')}
            />
            {searchInput && (
              <button
                type="button"
                className="unified-360__search-clear"
                onClick={handleClearCustomerSearch}
                title={t('customer.search.clear')}
                aria-label={t('customer.search.clear')}
              >
                <Icon name="clear_16" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="unified-360__search-btn"
            disabled={!searchInput.trim() || manualStatus === 'searching'}
          >
            {manualStatus === 'searching' ? t('customer.search.searching') : t('customer.search.button')}
          </button>
          <button
            type="button"
            className="unified-360__demo-toggle unified-360__demo-toggle--live"
            onClick={handleToggleDemo}
            title={t('analytics.demo')}
          >
            {t('analytics.live')}
          </button>
        </form>
      )}

      {isNavPanel && !demoMode && manualStatus === 'notfound' && (
        <div className="unified-360__search-msg" role="status">
          {t('customer.search.notFound', { identity: manualIdentity || '' })}
        </div>
      )}
      {isNavPanel && !demoMode && manualStatus === 'error' && (
        <div className="unified-360__search-msg unified-360__search-msg--error" role="status">
          {t('customer.search.error')}
        </div>
      )}

      {/* ── Live-search empty state: prompt before any customer is resolved ── */}
      {isNavPanel && !demoMode && !hasResolvedCustomer && manualStatus !== 'notfound' && (
        <div className="unified-360__search-empty">
          <Icon name="contact-card_24" className="unified-360__search-empty-icon" />
          <p className="unified-360__search-empty-text">{t('customer.search.prompt')}</p>
        </div>
      )}

      {/* ── Customer context bar ── */}
      <div className="unified-360__customer-bar">
        <CustomerContactCard
          onNavigate={navigate}
          darkMode={darkMode}
          mockProfile={demoMode ? getMockData(locale).customer : null}
        />
      </div>

      {/* ── Tab bar + content (hidden in live search until a customer resolves) ── */}
      {(!isNavPanel || demoMode || hasResolvedCustomer) && (
      <>
      {/* ── Tab bar ── */}
      <nav className="unified-360__tabs" role="tablist" aria-label="Customer 360">
        {/* Back / Forward buttons */}
        <div className="unified-360__nav-btns">
          <button
            type="button"
            className="unified-360__nav-btn"
            disabled={!canBack}
            onClick={handleBack}
            title="Back"
            aria-label="Back"
          >
            <Icon name="arrow-left_16" />
          </button>
          <button
            type="button"
            className="unified-360__nav-btn"
            disabled={!canForward}
            onClick={handleForward}
            title="Forward"
            aria-label="Forward"
          >
            <Icon name="arrow-right_16" />
          </button>
        </div>

        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`unified-360__tab${activeTab === id ? ' unified-360__tab--active' : ''}`}
            onClick={() => handleTabClick(id)}
          >
            <Icon name={TAB_ICONS[id]} className="unified-360__tab-icon" />
            <span className="unified-360__tab-label">{t(`tabs.${id}`) || id}</span>
          </button>
        ))}
        {/* ── SLA countdown + demo indicator (right side of the tab bar) ── */}
        <div className="unified-360__tab-trailing">
          <SlaCountdown darkMode={darkMode} />
          {demoMode && (
            <button
              type="button"
              className="unified-360__demo-toggle unified-360__demo-toggle--demo"
              onClick={handleToggleDemo}
              title={t('analytics.live')}
            >
              {t('analytics.demo')}
            </button>
          )}
        </div>
      </nav>

      {/* ── Tab content ── */}
      <div className="unified-360__content">
        {activeTab === 'cases' && (
          <CasesView
            darkMode={darkMode}
            mockMode={demoMode}
            highlightCaseId={navParams.highlightCaseId}
            onNavigate={navigate}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView
            darkMode={darkMode}
            mockMode={demoMode}
            onNavigate={navigate}
          />
        )}
        {activeTab === 'voice' && (
          <VoiceWidget
            darkMode={darkMode}
            mockMode={demoMode}
            initialTaskId={navParams.taskId}
            onNavigate={navigate}
            currentTaskId={isVoiceTask ? task?.interactionId : undefined}
            currentCustomer={[task?.callAssociatedData?.FirstName?.value, task?.callAssociatedData?.LastName?.value].filter(Boolean).join(' ') || undefined}
            currentPhone={task?.ani || task?.callAssociatedData?.MobilePhone?.value || undefined}
            currentDirection={task?.contactDirection ? String(task.contactDirection).toLowerCase() : undefined}
          />
        )}
        {activeTab === 'email' && (
          demoMode
            ? <EmailWidget
                key={navParams.composeMode ? `email-compose-${navParams.composeTo}` : (navParams.taskId || 'email-default')}
                interactionId="mock-001"
                darkMode={darkMode}
                mockMode
                initialTaskId={navParams.taskId}
                onNavigate={navigate}
                composeMode={Boolean(navParams.composeMode)}
                composeTo={navParams.composeTo || ''}
              />
            : isNavPanel && !task
              // Nav-panel customer browse: read-only email history for the searched
              // customer. Loads threads by resolved email; no compose/reply/send.
              ? (navCustomerEmail
                  ? <EmailWidget
                      key={`email-nav-${navCustomerEmail}`}
                      interactionId=""
                      callAssociatedDetails={{ fromAddress: navCustomerEmail, customerEmail: navCustomerEmail }}
                      darkMode={darkMode}
                      onNavigate={navigate}
                      readOnly
                    />
                  : <div className={`email-widget widget-shell${darkMode ? ' md--dark' : ''}`}>
                      <div className="widget-state">
                        <span className="md-h4 widget-state__text">
                          {t('email.noCustomerEmail')}
                        </span>
                      </div>
                    </div>)
            : isVoiceTask && voiceCustomerEmail
              // Voice call: open the customer's email history using the JDS-resolved email.
              // No gmailThreadId — EmailWidget will load all threads for that address.
              ? <EmailWidget
                  key={`email-voice-${task?.interactionId || 'voice'}-${voiceCustomerEmail}`}
                  interactionId={task?.interactionId || ''}
                  callAssociatedDetails={{ fromAddress: voiceCustomerEmail, customerEmail: voiceCustomerEmail }}
                  darkMode={darkMode}
                  onNavigate={navigate}
                  composeMode={Boolean(navParams.composeMode)}
                  composeTo={navParams.composeTo || voiceCustomerEmail}
                />
              : <EmailWidget
                  key={navParams.composeMode ? `email-compose-${navParams.composeTo}` : (task?.interactionId || 'email-live')}
                  interactionId={task?.interactionId || task?.taskId || ''}
                  callAssociatedDetails={buildEmailCallDetails(task, slaVariable)}
                  darkMode={darkMode}
                  onNavigate={navigate}
                  composeMode={Boolean(navParams.composeMode)}
                  composeTo={navParams.composeTo || ''}
                />
        )}
        {activeTab === 'chat' && (
          <ChatWidget
            darkMode={darkMode}
            mockMode={demoMode}
            initialTaskId={navParams.taskId}
            onNavigate={navigate}
          />
        )}
        {activeTab === 'task' && (
          demoMode
            ? <TaskWidget darkMode={darkMode} mockMode onNavigate={navigate} />
            : <TaskWidget task={task} darkMode={darkMode} onNavigate={navigate} />
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default UnifiedView360;
