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
import { useSelector } from 'react-redux';
import { Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';
import CasesView from './CasesView';
import HistoryView from './HistoryView';
import CustomerContactCard from './CustomerContactCard';
import VoiceWidget from '../voice/VoiceWidget';
import EmailWidget from '../email/EmailWidget';
import ChatWidget from '../chat/ChatWidget';
import TaskWidget from '../task/TaskWidget';

const TAB_IDS = ['cases', 'history', 'voice', 'email', 'chat', 'task'];
const TAB_ICONS = { cases: 'tasks_16', history: 'recents_16', voice: 'handset_16', email: 'email_16', chat: 'chat_16', task: 'check-circle_16' };

// Build callAssociatedDetails for EmailWidget from the raw task payload.
// Mirrors the logic in TaskManagement.buildEmailCallDetails.
const buildEmailCallDetails = (task) => {
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
  const fromAddress = isWorkItem
    ? (cadVal('email') || raw.fromAddress || cadVal('fromAddress') || task.email || null)
    : (raw.fromAddress || cadVal('fromAddress') || task.ani || task.displayAni || task.phoneNumber || null);
  const subject = raw.subject || cadVal('subject') || task.mediaProperties?.emailSubject || null;
  const gmailThreadId = raw.gmailThreadId || cadVal('gmailThreadId') || null;
  const rfcMessageId = raw.rfcMessageId || cadVal('rfcMessageId') || null;
  return { ...raw, customerEmail: fromAddress, fromAddress, gmailThreadId, rfcMessageId, subject };
};

const UnifiedView360 = ({ darkMode, mockMode, task }) => {
  const { t, locale } = useI18n();
  // Auto-navigate to the correct tab when a task arrives.
  const isEmailTask = task?.mediaType === 'email' || task?.mediaChannel === 'email';
  const isWorkItemTask = task?.mediaType === 'workItem';
  const isVoiceTask = task?.mediaType === 'telephony';
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
  const [activeTab, setActiveTab] = useState(initialTab);
  const [navParams, setNavParams] = useState({});
  const [demoMode, setDemoMode] = useState(Boolean(mockMode));

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

  return (
    <div className={`unified-360${darkMode ? ' md--dark' : ''}`}>
      {/* ── Customer context bar ── */}
      <div className="unified-360__customer-bar">
        <CustomerContactCard
          onNavigate={navigate}
          darkMode={darkMode}
          mockProfile={demoMode ? getMockData(locale).customer : null}
        />
      </div>

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
        {/* ── Demo / Live toggle ── */}
        <button
          type="button"
          className={`unified-360__demo-toggle unified-360__demo-toggle--${demoMode ? 'demo' : 'live'}`}
          onClick={() => setDemoMode((d) => !d)}
          title={demoMode ? t('analytics.live') : t('analytics.demo')}
        >
          {demoMode ? t('analytics.demo') : t('analytics.live')}
        </button>
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
                  callAssociatedDetails={buildEmailCallDetails(task)}
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
    </div>
  );
};

export default UnifiedView360;
