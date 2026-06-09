import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import VoiceAnalyticsBar from './VoiceAnalyticsBar';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';
import { toggleAnalyticsOpen } from '../store/slices/widgetSlice';
import './voice.css';

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

const VoiceWidget = ({ darkMode, mockMode, initialTaskId, onNavigate }) => {
  const { locale, t } = useI18n();
  const dispatch = useDispatch();
  const analyticsOpen = useSelector((state) => state.widget.analyticsOpen);
  const mock = getMockData(locale);
  const MOCK_CALLS = mock.voice.calls;
  const MOCK_TRANSCRIPT = mock.voice.transcript;
  const AI_SUMMARY = mock.voice.aiSummary;
  const OPEN_CASES = mock.voice.openCases;
  const [activeFilters, setActiveFilters] = useState({ outcome: null, direction: null, sentiment: null });
  const isDemoMode = Boolean(mockMode);

  const handleFilterChange = useCallback(({ type, key }) => {
    setActiveFilters((f) => ({ ...f, [type]: key }));
  }, []);

  const handleCaseClick = useCallback((caseId) => {
    onNavigate?.('cases', { highlightCaseId: caseId });
  }, [onNavigate]);

  // Resolve initial call: prefer the call matching initialTaskId, else first call
  const resolveCallId = (taskId) => {
    if (taskId) {
      const found = MOCK_CALLS.find((c) => c.taskId === taskId);
      if (found) return found.id;
    }
    return MOCK_CALLS[0]?.id || 'call-1';
  };

  const [selectedCallId, setSelectedCallId] = useState(() => resolveCallId(initialTaskId));

  // Navigate to a different call when initialTaskId prop changes (cross-tab navigate)
  useEffect(() => {
    if (!initialTaskId) return;
    const id = resolveCallId(initialTaskId);
    setSelectedCallId(id);
  }, [initialTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply quick-filters to the call list
  const filteredCalls = useMemo(() => {
    if (!activeFilters.outcome && !activeFilters.direction && !activeFilters.sentiment) return MOCK_CALLS;
    return MOCK_CALLS.filter((c) => {
      if (activeFilters.outcome   && c.outcomeKey !== activeFilters.outcome)   return false;
      if (activeFilters.direction && c.direction  !== activeFilters.direction) return false;
      if (activeFilters.sentiment && c.sentiment  !== activeFilters.sentiment) return false;
      return true;
    });
  }, [MOCK_CALLS, activeFilters]);

  const isFiltered = activeFilters.outcome || activeFilters.direction || activeFilters.sentiment;
  const activeFilterCount = [activeFilters.outcome, activeFilters.direction, activeFilters.sentiment].filter(Boolean).length;

  const selectedCall = MOCK_CALLS.find(c => c.id === selectedCallId) || MOCK_CALLS[0];

  // Scroll the active call item into view whenever selection changes
  const activeCallRef = useRef(null);
  useEffect(() => {
    activeCallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedCallId]);

  // Use transcript keyed to the selected call if available, else fall back to default
  const callTranscript = selectedCall.transcript || MOCK_TRANSCRIPT;

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
              onClick={() => setActiveFilters({ outcome: null, direction: null, sentiment: null })}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Active call header ────────────────────────── */}
      <div className="voice__call-header">
        <div className="voice__call-header-left">
          <span className="voice__call-status-dot" />
          <div>
            <div className="voice__call-customer">{selectedCall.customer}</div>
            <div className="voice__call-phone">{selectedCall.phone}</div>
          </div>
        </div>
        <div className="voice__call-header-center">
          <span className={`voice__direction-badge voice__direction-badge--${selectedCall.direction}`}>
            {selectedCall.direction === 'inbound' ? t('voice.directionInbound') : t('voice.directionOutbound')}
          </span>
          <span className="voice__queue-label">{selectedCall.queue}</span>
        </div>
        <div className="voice__call-header-right">
          {selectedCall.active ? (
            <>
              <span className="voice__timer">{fmtDuration(selectedCall.durationSec)}</span>
              <span className="voice__case-tag">{selectedCall.caseId}</span>
            </>
          ) : (
            <>
              <span className="voice__duration-past">{fmtDuration(selectedCall.durationSec)}</span>
              <span className={`voice__outcome voice__outcome--${selectedCall.outcome?.toLowerCase()}`}>
                {selectedCall.outcome}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── 3-column body ─────────────────────────────── */}
      <div className="voice__body widget-body">

        {/* ── Left: call history list ─────────────────── */}
        <div className="voice__call-list widget-panel">
          <div className="widget-panel__header">{t('voice.callHistory')}</div>
          {filteredCalls.map(call => (
            <div
              key={call.id}
              ref={call.id === selectedCallId ? activeCallRef : null}
              className={`voice__call-item${call.id === selectedCallId ? ' voice__call-item--active' : ''}`}
              onClick={() => setSelectedCallId(call.id)}
            >
              <div className="voice__call-item-top">
                <SentimentDot sentiment={call.sentiment} />
                <span className="voice__call-item-dir">{call.direction === 'inbound' ? '↙' : '↗'}</span>
                <span className="voice__call-item-time">{call.started}</span>
                {call.active && <span className="voice__live-badge">{t('voice.live')}</span>}
              </div>
              <div className="voice__call-item-dur">{fmtDuration(call.durationSec)}</div>
              <div className="voice__call-item-queue">{call.queue}</div>
              {call.outcome && (
                <div className={`voice__outcome voice__outcome--${call.outcome.toLowerCase()} voice__outcome--sm`}>
                  {call.outcome}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Centre: transcript ─────────────────────── */}
        <div className="voice__transcript widget-panel">
          <div className="widget-panel__header">
            {t('voice.transcript')}
            {selectedCall.active && <span className="voice__live-badge voice__live-badge--sm">● {t('voice.live')}</span>}
          </div>
          <div className="voice__transcript-scroll">
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
                    <span className="voice__utterance-speaker">{entry.speaker}</span>
                    <span className="voice__utterance-time">{entry.time}</span>
                  </div>
                  <div className="voice__utterance-text">{entry.text}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: AI summary + actions + cases ─────── */}
        <div className="voice__ai-rail widget-rail">

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
};

export default VoiceWidget;
