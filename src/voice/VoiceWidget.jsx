import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import VoiceAnalyticsBar from './VoiceAnalyticsBar';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';
import { toggleAnalyticsOpen } from '../store/slices/widgetSlice';
import { fetchLiveVoiceTranscript, fetchVoiceSummaryFor, fetchVoiceCallsForCustomer } from '../store/slices/voiceSlice';
import { usePanelUiState } from '../ui/usePanelUiState';
import './voice.css';

// Stable default so filter memos aren't invalidated every render.
const DEFAULT_VOICE_FILTERS = { outcome: null, direction: null, sentiment: null };

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const SentimentDot = ({ sentiment }) => {
  const colors = { positive: '#00c389', neutral: '#f5a623', negative: '#e0463e' };
  return (
    <span className="voice__sentiment-dot" style={{ background: colors[sentiment] || '#aaa' }} />
  );
};

// ─── Main widget ───────────────────────────────────────────────────────────

const VoiceWidget = ({ darkMode, mockMode, initialTaskId, onNavigate, currentTaskId, currentCustomer, currentPhone, currentDirection }) => {
  const { locale, t } = useI18n();
  const dispatch = useDispatch();
  const analyticsOpen = useSelector((state) => state.widget.analyticsOpen);
  const mock = getMockData(locale);
  const MOCK_CALLS = mock.voice.calls;
  const MOCK_TRANSCRIPT = mock.voice.transcript;
  const AI_SUMMARY = mock.voice.aiSummary;
  const OPEN_CASES = mock.voice.openCases;
  // Persisted per-tab UI state (filters + selected call) — restored on revisit.
  const [panelUi, patchPanelUi] = usePanelUiState('voice');
  const activeFilters = panelUi.filters || DEFAULT_VOICE_FILTERS;
  const [visibleCount, setVisibleCount] = useState(20);
  const isDemoMode = Boolean(mockMode);

  // Live mode: list the customer's voice calls via the Search API (by phone
  // number — JDS omits some voice interactions), enriched with duration +
  // transcript availability. Transcripts are fetched lazily on selection.
  const customerIdentities = useSelector((s) => s.email?.customerIdentities) || [];
  const customerProfile = useSelector((s) => s.email?.customerProfile);
  const customerCalls = useSelector((s) => s.voice?.customerCalls) || [];
  const customerCallsStatus = useSelector((s) => s.voice?.customerCallsStatus);

  // Customer phone number(s): active-call ANI + JDS identities/profile.
  const phones = useMemo(() => {
    if (isDemoMode) return [];
    const set = new Set();
    const add = (v) => {
      const raw = String(v || '').trim();
      const digits = raw.replace(/[^\d]/g, '');
      if (/@/.test(raw) || digits.length < 6) return; // skip emails / short DNs
      set.add(raw.replace(/[^\d+]/g, ''));
    };
    add(currentPhone);
    customerIdentities.forEach(add);
    const p = customerProfile?.phone;
    (Array.isArray(p) ? p : [p]).forEach(add);
    return Array.from(set).slice(0, 5);
  }, [isDemoMode, currentPhone, customerIdentities, customerProfile]);

  useEffect(() => {
    if (!isDemoMode && phones.length) dispatch(fetchVoiceCallsForCustomer(phones));
  }, [isDemoMode, phones, dispatch]);

  // Reset the visible window when the customer (phone set) changes.
  useEffect(() => { setVisibleCount(20); }, [phones]);

  const realCalls = useMemo(() => {
    if (isDemoMode) return [];
    const fmtStarted = (ms) => (ms ? new Date(ms).toLocaleString(locale || undefined, { dateStyle: 'short', timeStyle: 'short' }) : '');
    const rows = customerCalls.map((c) => ({
      id: c.taskId, taskId: c.taskId,
      active: c.taskId === currentTaskId,
      customer: currentCustomer || c.origin || currentPhone || 'Customer',
      phone: c.origin || currentPhone || '',
      started: c.startTime ? fmtStarted(c.startTime) : (c.taskId === currentTaskId ? t('voice.live') : ''),
      durationSec: c.durationSec || 0,
      direction: c.direction || currentDirection || 'inbound',
      queue: c.queueName || '', sentiment: 'neutral', outcome: null, outcomeKey: null,
      wrapUpReason: c.wrapUpReason || null,
      agentName: c.agentName || null,
      teamName: c.teamName || null,
      siteName: c.siteName || null,
      entryPointName: c.entryPointName || null,
      hasTranscript: c.hasTranscript,
    }));
    // Ensure the active / history-navigated call is present even if the Search
    // list hasn't caught up (very recent) or falls outside the phone set.
    const ensure = (id, active) => {
      if (!id || rows.some((r) => r.taskId === id)) return;
      rows.unshift({
        id, taskId: id, active,
        customer: currentCustomer || currentPhone || 'Customer',
        phone: currentPhone || '', started: active ? t('voice.live') : '',
        durationSec: 0, direction: currentDirection || 'inbound',
        queue: '', sentiment: 'neutral', outcome: null, outcomeKey: null,
      });
    };
    ensure(initialTaskId, false);
    ensure(currentTaskId, true);
    return rows;
  }, [isDemoMode, customerCalls, currentTaskId, initialTaskId, currentCustomer, currentPhone, currentDirection, locale, t]);

  // In live mode always use the real (Search API) call list — never fall back to
  // mock data, even while it is still loading (empty list shows a status line).
  const usingRealCalls = !isDemoMode;
  const CALLS = usingRealCalls ? realCalls : MOCK_CALLS;

  const handleFilterChange = useCallback(({ type, key }) => {
    patchPanelUi({ filters: { ...(panelUi.filters || DEFAULT_VOICE_FILTERS), [type]: key } });
  }, [panelUi.filters, patchPanelUi]);

  const handleCaseClick = useCallback((caseId) => {
    onNavigate?.('cases', { highlightCaseId: caseId });
  }, [onNavigate]);

  // Resolve initial call: prefer the call matching initialTaskId, else first call
  const resolveCallId = (taskId) => {
    if (taskId) {
      const found = CALLS.find((c) => c.taskId === taskId);
      if (found) return found.id;
    }
    return CALLS[0]?.id || 'call-1';
  };

  // Restore the previously-selected call on revisit; setSelectedCallId persists it.
  const [selectedCallId, setSelectedCallIdRaw] = useState(() => panelUi.selectedCallId || resolveCallId(initialTaskId));
  const setSelectedCallId = useCallback((id) => {
    setSelectedCallIdRaw(id);
    patchPanelUi({ selectedCallId: id });
  }, [patchPanelUi]);

  // Navigate to a specific call when arriving via initialTaskId (history "open
  // transcript"). Otherwise auto-select the active call only when the persisted
  // selection isn't valid for the current call list (e.g. new customer) — so a
  // previously-selected call is preserved across tab switches for the same customer.
  useEffect(() => {
    if (initialTaskId) {
      setSelectedCallId(resolveCallId(initialTaskId));
      return;
    }
    if (usingRealCalls && currentTaskId) {
      const persisted = panelUi.selectedCallId;
      const persistedInList = persisted && CALLS.some((c) => c.id === persisted);
      if (!persistedInList) setSelectedCallId(resolveCallId(currentTaskId));
    }
  }, [initialTaskId, currentTaskId, usingRealCalls]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply quick-filters to the call list
  const filteredCalls = useMemo(() => {
    if (!activeFilters.outcome && !activeFilters.direction && !activeFilters.sentiment) return CALLS;
    return CALLS.filter((c) => {
      if (activeFilters.outcome   && c.outcomeKey !== activeFilters.outcome)   return false;
      if (activeFilters.direction && c.direction  !== activeFilters.direction) return false;
      if (activeFilters.sentiment && c.sentiment  !== activeFilters.sentiment) return false;
      return true;
    });
  }, [CALLS, activeFilters]);

  const isFiltered = activeFilters.outcome || activeFilters.direction || activeFilters.sentiment;
  const activeFilterCount = [activeFilters.outcome, activeFilters.direction, activeFilters.sentiment].filter(Boolean).length;

  const selectedCall = CALLS.find(c => c.id === selectedCallId) || CALLS[0];

  // Scroll the active call item into view whenever selection changes
  const activeCallRef = useRef(null);
  useEffect(() => {
    activeCallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedCall?.id]);

  // Live mode: fetch the real transcript AND AI summary in parallel via the
  // backend proxy. They render independently — whichever arrives first shows.
  const liveTranscript = useSelector((state) => state.voice?.transcripts?.[selectedCall?.taskId]);
  const liveStatus = useSelector((state) => state.voice?.status?.[selectedCall?.taskId]);
  const liveSummary = useSelector((state) => state.voice?.summaries?.[selectedCall?.taskId]);
  const liveSummaryStatus = useSelector((state) => state.voice?.summaryStatus?.[selectedCall?.taskId]);
  useEffect(() => {
    if (usingRealCalls && selectedCall?.taskId) {
      dispatch(fetchLiveVoiceTranscript(selectedCall.taskId));
      dispatch(fetchVoiceSummaryFor(selectedCall.taskId));
    }
  }, [usingRealCalls, selectedCall?.taskId, dispatch]);

  // Use the live transcript when available. Never show a mock transcript for the
  // active/live call — a live transcript isn't available via API during the call,
  // so only completed (historical) calls render a transcript. In live mode we also
  // don't fall back to mock; demo mode keeps mock transcripts for historical calls.
  const hasLiveTranscript = Boolean(liveTranscript?.transcript?.length);
  const isLiveCall = Boolean(selectedCall?.active);
  const callTranscript = hasLiveTranscript
    ? liveTranscript.transcript
    : ((usingRealCalls || isLiveCall) ? [] : (selectedCall?.transcript || MOCK_TRANSCRIPT));

  // Resolve a transcript utterance's speaker label to the real customer/agent
  // name when known, falling back to a localized "Customer"/"Agent".
  const isPhoneLike = (s) => /^[\s+\d()./-]+$/.test(String(s || ''));
  // Customer name from the widget's already-loaded profile (JDS person record).
  const profileName = customerProfile
    ? (customerProfile.name || [customerProfile.firstName, customerProfile.lastName].filter(Boolean).join(' ')).trim()
    : '';
  const customerDisplayName = (currentCustomer && !isPhoneLike(currentCustomer) && currentCustomer !== 'Customer')
    ? currentCustomer
    : (profileName && !isPhoneLike(profileName) ? profileName : t('voice.customer'));
  const resolveSpeaker = (entry) => {
    if (entry.role === 'agent') return selectedCall?.agentName || t('voice.agent');
    if (entry.role === 'customer') return customerDisplayName;
    return entry.speaker || '';
  };

  return (
    <div className={`voice widget-shell${darkMode ? ' md--dark' : ''}`}>

      {/* ── Collapsible analytics bar ─────────────────── */}
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
          <VoiceAnalyticsBar
            darkMode={darkMode}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
            onCaseClick={onNavigate ? handleCaseClick : undefined}
          />
        )}
      </div>

      {/* ── Active filter indicator ── */}
      {isFiltered && (
        <div className="history-view__filter-bar">
          <span className="history-view__filter-bar__label">Filtered:</span>
          {activeFilters.outcome && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'outcome', key: null })}>
              {activeFilters.outcome} ×
            </button>
          )}
          {activeFilters.direction && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'direction', key: null })}>
              {activeFilters.direction} ×
            </button>
          )}
          {activeFilters.sentiment && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'sentiment', key: null })}>
              {activeFilters.sentiment} ×
            </button>
          )}
          {activeFilterCount > 1 && (
            <button type="button" className="history-view__filter-chip history-view__filter-chip--clear"
              onClick={() => patchPanelUi({ filters: DEFAULT_VOICE_FILTERS })}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── 3-column body ─────────────────────────────── */}
      <div className="voice__body widget-body">

        {/* ── Left: call history list ─────────────────── */}
        <div
          className="voice__call-list widget-panel"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
              setVisibleCount((v) => (v < filteredCalls.length ? v + 20 : v));
            }
          }}
        >
          <div className="widget-panel__header">{t('voice.callHistory')}</div>
          {filteredCalls.slice(0, visibleCount).map(call => (
            <div
              key={call.id}
              ref={call.id === selectedCall?.id ? activeCallRef : null}
              className={`voice__call-item${call.id === selectedCall?.id ? ' voice__call-item--active' : ''}`}
              onClick={() => setSelectedCallId(call.id)}
            >
              <div className="voice__call-item-top">
                <SentimentDot sentiment={call.sentiment} />
                <span className="voice__call-item-dir">{call.direction === 'inbound' ? '↙' : '↗'}</span>
                <span className="voice__call-item-dur">{fmtDuration(call.durationSec)}</span>
                {call.active && <span className="voice__live-badge">{t('voice.live')}</span>}
                <span className="voice__call-item-time">{call.started}</span>
              </div>
              {(call.agentName || call.teamName) && (
                <div className="voice__call-item-agent" title={[call.agentName, call.teamName].filter(Boolean).join(' · ')}>
                  <span className="voice__call-item-agent-name">👤 {call.agentName || '—'}</span>
                  {call.teamName && <span className="voice__call-item-team">{call.teamName}</span>}
                </div>
              )}
              {call.wrapUpReason && (
                <div className="voice__call-item-wrapup" title={call.wrapUpReason}>🏷️ {call.wrapUpReason}</div>
              )}
              {call.outcome && (
                <div className={`voice__outcome voice__outcome--${call.outcome.toLowerCase()} voice__outcome--sm`}>
                  {call.outcome}
                </div>
              )}
            </div>
          ))}
          {usingRealCalls && filteredCalls.length === 0 && (
            <div className="voice__call-empty">
              {customerCallsStatus === 'loading' ? t('voice.callsLoading') : t('voice.callsEmpty')}
            </div>
          )}
        </div>

        {/* ── Centre: transcript ─────────────────────── */}
        <div className="voice__transcript widget-panel">
          <div className="widget-panel__header">
            {t('voice.transcript')}
            {selectedCall?.active && <span className="voice__live-badge voice__live-badge--sm">● {t('voice.live')}</span>}
            {usingRealCalls && selectedCall?.taskId && (
              <button
                type="button"
                className={`voice__refresh-btn${(liveStatus === 'loading' || liveSummaryStatus === 'loading') ? ' voice__refresh-btn--spin' : ''}`}
                title={t('voice.refresh')}
                aria-label={t('voice.refresh')}
                disabled={liveStatus === 'loading' && liveSummaryStatus === 'loading'}
                onClick={() => {
                  dispatch(fetchLiveVoiceTranscript(selectedCall.taskId, { force: true }));
                  dispatch(fetchVoiceSummaryFor(selectedCall.taskId, { force: true }));
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>
            )}
          </div>
          {usingRealCalls && selectedCall && (selectedCall.agentName || selectedCall.teamName || selectedCall.queue || selectedCall.entryPointName || selectedCall.siteName || selectedCall.wrapUpReason || selectedCall.durationSec > 0) && (
            <div className="voice__detail-bar">
              {selectedCall.started && <span className="voice__detail-chip voice__detail-chip--time">{selectedCall.started}</span>}
              {selectedCall.direction && (
                <span className="voice__detail-chip">{t(selectedCall.direction === 'inbound' ? 'voice.directionInbound' : 'voice.directionOutbound')}</span>
              )}
              {selectedCall.durationSec > 0 && <span className="voice__detail-chip">⏱ {fmtDuration(selectedCall.durationSec)}</span>}
              {selectedCall.phone && <span className="voice__detail-chip">📞 {selectedCall.phone}</span>}
              {selectedCall.agentName && <span className="voice__detail-chip voice__detail-chip--agent">👤 {selectedCall.agentName}</span>}
              {selectedCall.teamName && <span className="voice__detail-chip">👥 {selectedCall.teamName}</span>}
              {selectedCall.queue && <span className="voice__detail-chip">🎯 {selectedCall.queue}</span>}
              {selectedCall.entryPointName && <span className="voice__detail-chip">↳ {selectedCall.entryPointName}</span>}
              {selectedCall.siteName && <span className="voice__detail-chip">🏢 {selectedCall.siteName}</span>}
              {selectedCall.wrapUpReason && <span className="voice__detail-chip voice__detail-chip--wrapup">🏷️ {selectedCall.wrapUpReason}</span>}
            </div>
          )}
          <div className="voice__transcript-scroll">
            {selectedCall?.virtualAgent && (
              <div className="voice__va">
                <div className="voice__va-header">
                  <span className="voice__va-icon">🤖</span>
                  {t('voice.va.title')}
                  {selectedCall.virtualAgent.provider && (
                    <span className="voice__va-provider">· {selectedCall.virtualAgent.provider}</span>
                  )}
                  {selectedCall.virtualAgent.containmentSec != null && (
                    <span className="voice__va-containment">{t('voice.va.containment')}: {fmtDuration(selectedCall.virtualAgent.containmentSec)}</span>
                  )}
                </div>
                {(selectedCall.virtualAgent.transcript || []).map((entry) => (
                  <div key={entry.id} className={`voice__va-utterance voice__va-utterance--${entry.role}`}>
                    <div className="voice__va-utterance-meta">
                      <span className="voice__va-utterance-speaker">
                        {entry.role === 'bot' ? t('voice.va.title') : customerDisplayName}
                      </span>
                      {entry.time && <span className="voice__va-utterance-time">{entry.time}</span>}
                    </div>
                    <div className="voice__va-utterance-text">{entry.text}</div>
                  </div>
                ))}
                <div className="voice__va-handoff">
                  {selectedCall.virtualAgent.callReason && (
                    <div className="voice__va-handoff-row">
                      <span className="voice__va-handoff-label">{t('voice.va.callReason')}</span>
                      <span className="voice__va-handoff-val">{selectedCall.virtualAgent.callReason}</span>
                    </div>
                  )}
                  {selectedCall.virtualAgent.handOffReason && (
                    <div className="voice__va-handoff-row">
                      <span className="voice__va-handoff-label">{t('voice.va.handoffReason')}</span>
                      <span className="voice__va-handoff-val">{selectedCall.virtualAgent.handOffReason}</span>
                    </div>
                  )}
                  {selectedCall.virtualAgent.details && (
                    <div className="voice__va-handoff-details">{selectedCall.virtualAgent.details}</div>
                  )}
                </div>
                <div className="voice__va-divider">{t('voice.va.agentJoined')}</div>
              </div>
            )}
            {callTranscript.map(entry => {
              if (entry.role === 'system') {
                return (
                  <div key={entry.id} className={`voice__transcript-system${entry.live ? ' voice__transcript-system--live' : ''}`}>
                    {entry.text}
                  </div>
                );
              }
              return (
                <div key={entry.id} className={`voice__utterance voice__utterance--${entry.role}`}>
                  <div className="voice__utterance-meta">
                    <span className="voice__utterance-speaker">{resolveSpeaker(entry)}</span>
                    <span className="voice__utterance-time">{entry.time}</span>
                  </div>
                  <div className="voice__utterance-text">{entry.text}</div>
                </div>
              );
            })}
            {selectedCall && !hasLiveTranscript && (usingRealCalls || isLiveCall) && (
              <div className="voice__transcript-status">
                {isLiveCall
                  ? t('voice.transcriptLive')
                  : (liveStatus === 'loading' ? t('voice.transcriptLoading') : t('voice.transcriptUnavailable'))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: AI summary + actions + cases ─────── */}
        <div className="voice__ai-rail widget-rail">

          {/* Live mode: real post-call wrap-up / AI summary */}
          {usingRealCalls && (
            (liveSummary && (liveSummary.initialContactReason || liveSummary.keyActionsTaken || liveSummary.nextSteps || liveSummary.additionalContactReasons || liveSummary.chosenWrapUpCode)) ? (
              <div className="voice__summary voice__summary--rail">
                <div className="voice__summary-header">
                  <span className="voice__summary-icon">🤖</span> {t('history.aiSummaryTitle')}
                  {liveSummary.chosenWrapUpCode && (
                    <span className="voice__summary-wrapup">{liveSummary.chosenWrapUpCode}</span>
                  )}
                </div>
                {liveSummary.initialContactReason && (
                  <div className="voice__summary-row">
                    <span className="voice__summary-label">{t('history.aiSummaryReason')}</span>
                    <span className="voice__summary-text">{liveSummary.initialContactReason}</span>
                  </div>
                )}
                {liveSummary.keyActionsTaken && (
                  <div className="voice__summary-row">
                    <span className="voice__summary-label">{t('history.aiSummaryActions')}</span>
                    <span className="voice__summary-text voice__summary-text--multiline">{liveSummary.keyActionsTaken}</span>
                  </div>
                )}
                {liveSummary.nextSteps && (
                  <div className="voice__summary-row">
                    <span className="voice__summary-label">{t('history.aiSummaryNextSteps')}</span>
                    <span className="voice__summary-text voice__summary-text--multiline">{liveSummary.nextSteps}</span>
                  </div>
                )}
                {liveSummary.additionalContactReasons && (
                  <div className="voice__summary-row">
                    <span className="voice__summary-label">{t('history.aiSummaryAdditional')}</span>
                    <span className="voice__summary-text">{liveSummary.additionalContactReasons}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="voice__summary voice__summary--rail">
                <div className="voice__summary-header">
                  <span className="voice__summary-icon">🤖</span> {t('history.aiSummaryTitle')}
                </div>
                <div className="voice__summary-empty-text">
                  {liveSummaryStatus === 'loading' ? t('voice.summaryLoading') : t('voice.summaryUnavailable')}
                </div>
              </div>
            )
          )}

          {/* Mock AI insights — demo only; hidden for real live calls until wired to real AI */}
          {!usingRealCalls && (
          <>
          {/* AI Summary */}
          <div className="voice__ai-summary widget-rail-card">
            <div className="widget-panel__header">
              <span className="voice__ai-icon">✦</span> {t('voice.ai.summary')}
            </div>
            <div className="voice__ai-headline">{AI_SUMMARY.headline}</div>
            <div className="voice__ai-intent">
              {t('voice.ai.intent')}: <strong>{AI_SUMMARY.intent}</strong>
            </div>
            <ul className="voice__ai-points">
              {AI_SUMMARY.points.map((pt, i) => (
                <li key={i} className="voice__ai-point">{pt}</li>
              ))}
            </ul>
          </div>

          {/* Suggested Actions */}
          <div className="voice__ai-actions widget-rail-card">
            <div className="widget-panel__subheader">{t('voice.ai.suggestedActions')}</div>
            {AI_SUMMARY.suggestedActions.map(action => (
              <button
                key={action.id}
                className={`voice__action-btn voice__action-btn--${action.type}`}
                title={action.description}
              >
                <span className="voice__action-label">{action.label}</span>
                <span className="voice__action-desc">{action.description}</span>
              </button>
            ))}
          </div>

          {/* Related Cases */}
          <div className="voice__cases widget-rail-card">
            <div className="widget-panel__subheader">{t('voice.ai.relatedCases')}</div>
            {OPEN_CASES.map(c => (
              <div key={c.id} className="voice__case-item">
                <div className="voice__case-item-top">
                  <span className="voice__case-id">{c.id}</span>
                  <span className={`voice__case-priority voice__case-priority--${c.priority.toLowerCase()}`}>
                    {c.priority}
                  </span>
                </div>
                <div className="voice__case-title">{c.title}</div>
                <div className={`voice__case-status voice__case-status--${c.status.toLowerCase()}`}>
                  {c.status}
                </div>
              </div>
            ))}
          </div>
          </>
          )}

          {/* Wrap-up */}
          {selectedCall?.wrapUp && (
            <div className="voice__wrapup widget-rail-card">
              <div className="widget-panel__subheader">{t('voice.wrapUp.title')}</div>
              <div className="voice__wrapup-reason">
                <span className="voice__wrapup-reason-text">{selectedCall.wrapUp.reason}</span>
                {selectedCall.wrapUp.code && (
                  <span className="voice__wrapup-code">{selectedCall.wrapUp.code}</span>
                )}
              </div>
              {selectedCall.wrapUp.note && (
                <div className="voice__wrapup-note">
                  <span className="voice__wrapup-note-label">{t('voice.wrapUp.note')}</span>
                  <span className="voice__wrapup-note-text">{selectedCall.wrapUp.note}</span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

VoiceWidget.propTypes = {
  darkMode: PropTypes.bool,
  mockMode: PropTypes.bool,
  initialTaskId: PropTypes.string,
  onNavigate: PropTypes.func,
  currentTaskId: PropTypes.string,
  currentCustomer: PropTypes.string,
  currentPhone: PropTypes.string,
  currentDirection: PropTypes.string,
};

export default VoiceWidget;
