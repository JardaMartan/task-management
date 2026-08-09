import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { Alert } from '@momentum-ui/react';
import { initEmailTask, resetEmail, resetEmailContent, setMockEmailData, checkGmailThreadUpdates, loadEmailSla, loadCustomerEmailThreads } from '../store/slices/emailSlice';
import { toggleAnalyticsOpen } from '../store/slices/widgetSlice';
import { useI18n } from '../i18n/I18nContext';
import EmailAnalyticsBar from './EmailAnalyticsBar';
import ThreadPanel from './ThreadPanel';
import ConversationView from './ConversationView';
import AiPanel from './AiPanel';
import ReplyComposer from './ReplyComposer';
import OutboundEmailComposer from './OutboundEmailComposer';
import WrapUpSummaryController from './WrapUpSummaryController';
import './email.css';

const EmailWidget = ({ interactionId, callAssociatedDetails, darkMode, mockMode, initialTaskId, onNavigate, composeMode, composeTo, readOnly }) => {
  // Local state: agent may dismiss compose mode even while `composeMode` prop stays true.
  // Read-only mode (e.g. nav-panel customer browse) never composes.
  const [showCompose, setShowCompose] = React.useState(Boolean(composeMode) && !readOnly);
  React.useEffect(() => { setShowCompose(Boolean(composeMode) && !readOnly); }, [composeMode, readOnly]);
  const dispatch = useDispatch();
  const { locale, t } = useI18n();
  const analyticsOpen = useSelector((state) => state.widget.analyticsOpen);
  const [activeFilters, setActiveFilters] = useState({ status: null, topic: null });
  const isDemoMode = Boolean(mockMode);

  const handleFilterChange = React.useCallback(({ type, key }) => {
    setActiveFilters((f) => ({ ...f, [type]: key }));
  }, []);

  const handleCaseClick = React.useCallback((caseId) => {
    onNavigate?.('cases', { highlightCaseId: caseId });
  }, [onNavigate]);

  const { isFetchingEmail, isFetchingToken, error, activeEmail } = useSelector(
    (state) => state.email
  );
  const customerThreads = useSelector((state) => state.email.customerThreads);
  // Watch for tokenBrokerUrl becoming available — it may arrive after the task
  // if the Desktop framework sets `config` (properties) after `task` (properties).
  const tokenBrokerUrl = useSelector((state) => state.widget?.emailConfig?.tokenBrokerUrl);

  useEffect(() => {
    if (isDemoMode) {
      dispatch(setMockEmailData({ locale, taskId: initialTaskId || null }));
      return () => { dispatch(resetEmail()); };
    }
    // Wait until tokenBrokerUrl is available before starting the Gmail flow.
    // The effect re-runs automatically when tokenBrokerUrl arrives in state,
    // so no separate retry effect is needed.
    if (readOnly) {
      // Nav-panel customer browse: load the searched customer's Gmail threads by
      // address only (read-only). No task init / no JDS-profile mutation.
      const browseEmail = callAssociatedDetails?.customerEmail || callAssociatedDetails?.fromAddress || null;
      if (browseEmail && tokenBrokerUrl) {
        dispatch(loadCustomerEmailThreads(browseEmail));
      }
    } else if (interactionId && tokenBrokerUrl) {
      dispatch(initEmailTask(interactionId, callAssociatedDetails));
    }
    return () => {
      // resetEmailContent preserves customerHistory so the History tab does not
      // have to re-fetch every time the user switches between Email and History.
      // resetEmail (full reset) is only used in demo mode above.
      dispatch(resetEmailContent());
    };
  }, [interactionId, isDemoMode, locale, initialTaskId, tokenBrokerUrl, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll Gmail for new messages every 60s while the Email tab is visible.
  // Uses the History API — only re-fetches the thread when there are actual changes.
  useEffect(() => {
    if (isDemoMode || !interactionId || !tokenBrokerUrl) return;
    const interval = setInterval(() => {
      dispatch(checkGmailThreadUpdates());
    }, 60_000);
    return () => clearInterval(interval);
  }, [dispatch, isDemoMode, interactionId, tokenBrokerUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // SLA expiry is delivered WITH the task as CAD (configurable variable name),
  // unwrapped by UnifiedView360.buildEmailCallDetails as `slaExpiresRaw`.
  const slaExpiresRaw = callAssociatedDetails?.slaExpiresRaw;
  useEffect(() => {
    if (isDemoMode) return;
    dispatch(loadEmailSla(slaExpiresRaw));
  }, [dispatch, isDemoMode, slaExpiresRaw]);

  const analyticsHeader = (
    <div className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
      <div
        className="analytics-collapse__toggle"
        role="button"
        tabIndex={0}
        onClick={() => dispatch(toggleAnalyticsOpen())}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && dispatch(toggleAnalyticsOpen())}
        aria-expanded={analyticsOpen}
      >
        <span className="analytics-collapse__label">{t('analytics.customerAnalytics')}</span>
        <span className="analytics-collapse__header-right">
          <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
        </span>
      </div>
      {analyticsOpen && (
          <EmailAnalyticsBar
            darkMode={darkMode}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
            onCaseClick={onNavigate ? handleCaseClick : undefined}
          />)}
    </div>
  );

  const isFiltered = activeFilters.status || activeFilters.topic;
  const activeFilterCount = [activeFilters.status, activeFilters.topic].filter(Boolean).length;

  const filterChips = isFiltered ? (
    <div className="history-view__filter-bar">
      <span className="history-view__filter-bar__label">Filtered:</span>
      {activeFilters.status && (
        <button type="button" className="history-view__filter-chip"
          onClick={() => handleFilterChange({ type: 'status', key: null })}>
          {activeFilters.status} ×
        </button>
      )}
      {activeFilters.topic && (
        <button type="button" className="history-view__filter-chip"
          onClick={() => handleFilterChange({ type: 'topic', key: null })}>
          {activeFilters.topic} ×
        </button>
      )}
      {activeFilterCount > 1 && (
        <button type="button" className="history-view__filter-chip history-view__filter-chip--clear"
          onClick={() => setActiveFilters({ status: null, topic: null })}>
          Clear all
        </button>
      )}
    </div>
  ) : null;

  if (isFetchingToken || isFetchingEmail) {
    return (
      <div className={`email-widget widget-shell${darkMode ? ' md--dark' : ''}`}>
        {analyticsHeader}
        <div className="widget-state">
          <div className="widget-spinner" />
          <span className="md-h4 widget-state__text widget-state__text--spaced">
            {t('email.loading')}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`email-widget widget-shell${darkMode ? ' md--dark' : ''}`}>
        {analyticsHeader}
        <div className="widget-state">
          <Alert type="error" message={t(error) || error} />
        </div>
      </div>
    );
  }

  // Compose overlay: shown when navigated here via the customer contact card email button
  if (showCompose) {
    return (
      <div className={`email-widget widget-shell email-widget--compose${darkMode ? ' md--dark' : ''}`}>
        {analyticsHeader}
        <OutboundEmailComposer
          initialTo={composeTo || ''}
          darkMode={darkMode}
          onCancel={() => setShowCompose(false)}
        />
      </div>
    );
  }

  if (!activeEmail) {
    // If threads are already loaded (e.g. voice-context email browsing), show the
    // thread list so the agent can select one — rather than a "no task" placeholder.
    if (customerThreads && customerThreads.length > 0) {
      return (
        <div className={`email-widget widget-shell${darkMode ? ' md--dark' : ''}`}>
          {analyticsHeader}
          {filterChips}
          <div className="email-widget__body email-widget__body--3col widget-body">
            <aside className="email-widget__col email-widget__col--threads widget-panel" aria-label="Thread list">
              <ThreadPanel darkMode={darkMode} isDemoMode={isDemoMode} locale={locale} activeFilters={activeFilters} />
            </aside>
            <main className="email-widget__col email-widget__col--center widget-panel">
              <div className="widget-state">
                <span className="md-h4 widget-state__text">
                  {t('email.selectThread') || 'Select a thread to view'}
                </span>
              </div>
            </main>
            <aside className="email-widget__col email-widget__col--rail" aria-label="AI assist">
              <AiPanel darkMode={darkMode} />
            </aside>
          </div>
        </div>
      );
    }
    return (
      <div className={`email-widget widget-shell${darkMode ? ' md--dark' : ''}`}>
        {analyticsHeader}
        <div className="widget-state">
          <span className="md-h4 widget-state__text">
            {t('email.noTask')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`email-widget widget-shell${darkMode ? ' md--dark' : ''}`}>
      {analyticsHeader}
      {filterChips}
      {!readOnly && <WrapUpSummaryController interactionId={interactionId} />}
      <div className="email-widget__body email-widget__body--3col widget-body">
        <aside className="email-widget__col email-widget__col--threads widget-panel" aria-label="Thread list">
          <ThreadPanel darkMode={darkMode} isDemoMode={isDemoMode} locale={locale} activeFilters={activeFilters} />
        </aside>
        <main className="email-widget__col email-widget__col--center widget-panel">
          <ConversationView darkMode={darkMode} />
          {!readOnly && (
            <ReplyComposer
              interactionId={interactionId}
              callAssociatedDetails={callAssociatedDetails}
              darkMode={darkMode}
            />
          )}
        </main>
        <aside className="email-widget__col email-widget__col--rail" aria-label="AI assist">
          <AiPanel darkMode={darkMode} />
        </aside>
      </div>
    </div>
  );
};

EmailWidget.propTypes = {
  interactionId: PropTypes.string,
  callAssociatedDetails: PropTypes.object,
  darkMode: PropTypes.bool,
  mockMode: PropTypes.bool,
  onNavigate: PropTypes.func,
  composeMode: PropTypes.bool,
  composeTo: PropTypes.string,
  readOnly: PropTypes.bool,
};

EmailWidget.defaultProps = {
  interactionId: '',
  callAssociatedDetails: null,
  darkMode: false,
  mockMode: false,
  composeMode: false,
  composeTo: '',
  readOnly: false,
};

export default EmailWidget;
