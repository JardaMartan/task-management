import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import ChatAnalyticsBar from './ChatAnalyticsBar';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';
import { toggleAnalyticsOpen } from '../store/slices/widgetSlice';
import HistoryView from '../views/HistoryView';
import './chat.css';

// ─── Channel metadata (display-only, no mock data) ────────────────────────

const CHANNEL_COLORS = {
  webchat:  '#00a0d1',
  whatsapp: '#25D366',
  sms:      '#f5a623',
  apple:    '#007AFF',
  rcs:      '#34d399',
  'in-app': '#a78bfa',
};

const CHANNEL_LABELS = {
  webchat:  'Webchat',
  whatsapp: 'WhatsApp',
  sms:      'SMS',
  apple:    'Apple Messages',
  rcs:      'RCS',
  'in-app': 'In-App',
};

// ─── Small sub-components ──────────────────────────────────────────────────

const ConvItem = ({ conv, active, darkMode, onClick, innerRef }) => (
  <li
    ref={innerRef}
    className={`chat-conv-item${active ? ' chat-conv-item--active' : ''}`}
    style={{ '--ch-color': CHANNEL_COLORS[conv.channel] || '#9ca3af' }}
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick()}
  >
    <div className="chat-conv-item__head">
      <span className="chat-conv-item__channel">
        <span className="chat-conv-item__channel-dot" />
        {CHANNEL_LABELS[conv.channel] || conv.channel}
      </span>
      <span className="chat-conv-item__time">{conv.time}</span>
    </div>
    <div className="chat-conv-item__snippet">{conv.snippet}</div>
    <div className={`chat-conv-item__status${conv.active ? ' chat-conv-item__status--active' : ''}`}>
      {conv.status}{conv.caseId ? ` · ${conv.caseId}` : ''}
    </div>
  </li>
);

const ChatBubble = ({ message, darkMode }) => (
  <div className={`chat-bubble chat-bubble--${message.role}`}>
    <div className="chat-bubble__text">{message.text}</div>
    {message.time && <div className="chat-bubble__meta">{message.time}</div>}
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────

/**
 * ChatWidget — full mock chat widget for all digital messaging channels.
 *
 * Layout:
 *   [Analytics bar (collapsible)]
 *   [Session header: channel | customer | timer | linked case]
 *   [Conversations list | Chat transcript + composer | AI rail + cases]
 *
 * Channel support: Webchat, WhatsApp, SMS, Apple Messages for Business,
 *                  RCS, In-App chat.
 */
const ChatWidget = ({ darkMode, mockMode, initialTaskId, onNavigate }) => {
  const { locale, t } = useI18n();
  const dispatch = useDispatch();
  const analyticsOpen = useSelector((state) => state.widget.analyticsOpen);
  const mock = getMockData(locale);
  const MOCK_CONVERSATIONS = mock.chat.conversations;
  const MESSAGES_BY_CONV   = mock.chat.messagesByConvId || {};
  const AI_SUGGESTIONS = mock.chat.aiSuggestions;
  const OPEN_CASES = mock.chat.openCases;
  const [activeFilters, setActiveFilters] = useState({ channel: null, status: null });
  const isDemoMode = Boolean(mockMode);
  const [activeTab, setActiveTab] = useState('chat');

  const handleFilterChange = useCallback(({ type, key }) => {
    setActiveFilters((f) => ({ ...f, [type]: key }));
  }, []);

  const handleCaseClick = useCallback((caseId) => {
    onNavigate?.('cases', { highlightCaseId: caseId });
  }, [onNavigate]);

  // Resolve initial conversation: prefer the conv matching initialTaskId
  const resolveConvId = (taskId) => {
    if (taskId) {
      const found = MOCK_CONVERSATIONS.find((c) => c.taskId === taskId);
      if (found) return found.id;
    }
    return MOCK_CONVERSATIONS[0]?.id || 'conv-1';
  };

  const [activeConvId, setActiveConvId] = useState(() => resolveConvId(initialTaskId));

  // Navigate to a different conv when initialTaskId prop changes
  useEffect(() => {
    if (!initialTaskId) return;
    setActiveConvId(resolveConvId(initialTaskId));
  }, [initialTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [inputText, setInputText] = useState('');

  // Per-conversation message state — messages typed in session are kept per conv
  const [extraByConv, setExtraByConv] = useState({});

  const getMessages = (convId) => [
    ...(MESSAGES_BY_CONV[convId] || MESSAGES_BY_CONV['conv-1'] || []),
    ...(extraByConv[convId] || []),
  ];

  const activeConv = MOCK_CONVERSATIONS.find((c) => c.id === activeConvId) || MOCK_CONVERSATIONS[0];
  const channelColor = CHANNEL_COLORS[activeConv.channel] || '#9ca3af';
  const channelLabel = CHANNEL_LABELS[activeConv.channel] || activeConv.channel;

  // Apply quick-filters to the conversation list
  const filteredConversations = useMemo(() => {
    if (!activeFilters.channel && !activeFilters.status) return MOCK_CONVERSATIONS;
    return MOCK_CONVERSATIONS.filter((c) => {
      if (activeFilters.channel && c.channel !== activeFilters.channel) return false;
      if (activeFilters.status  && c.statusKey !== activeFilters.status)  return false;
      return true;
    });
  }, [MOCK_CONVERSATIONS, activeFilters]);

  const isFiltered = activeFilters.channel || activeFilters.status;
  const activeFilterCount = [activeFilters.channel, activeFilters.status].filter(Boolean).length;

  // Scroll active conv item into view when selection changes
  const activeConvRef = useRef(null);
  useEffect(() => {
    activeConvRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeConvId]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setExtraByConv((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), { id: `m-${Date.now()}`, role: 'agent', text, time: 'just now' }],
    }));
    setInputText('');
  };

  const handleSuggestionClick = (text) => {
    setInputText(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`chat-widget widget-shell${darkMode ? ' md--dark' : ''}`}>

      {/* ── Analytics bar (collapsible) ── */}
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
          <ChatAnalyticsBar
            darkMode={darkMode}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
            onCaseClick={onNavigate ? handleCaseClick : undefined}
          />
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="widget-tab-bar" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'chat'}
          className={`widget-tab${activeTab === 'chat' ? ' widget-tab--active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          {t('tabs.chat')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'history'}
          className={`widget-tab${activeTab === 'history' ? ' widget-tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          {t('tabs.history')}
        </button>
      </div>

      {/* ── History tab ── */}
      {activeTab === 'history' && (
        <HistoryView darkMode={darkMode} mockMode={isDemoMode} />
      )}

      {/* ── Chat tab content ── */}
      {activeTab === 'chat' && (<>

      {/* ── Active filter indicator ── */}
      {isFiltered && (
        <div className="history-view__filter-bar">
          <span className="history-view__filter-bar__label">Filtered:</span>
          {activeFilters.channel && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'channel', key: null })}>
              {activeFilters.channel} ×
            </button>
          )}
          {activeFilters.status && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'status', key: null })}>
              {activeFilters.status} ×
            </button>
          )}
          {activeFilterCount > 1 && (
            <button type="button" className="history-view__filter-chip history-view__filter-chip--clear"
              onClick={() => setActiveFilters({ channel: null, status: null })}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Session header ── */}
      <div
        className="chat-session-header widget-header-bar"
        style={{ '--ch-color': channelColor }}
      >
        <span className="chat-session-header__channel-dot" />
        <span className="chat-session-header__channel-label">{channelLabel}</span>
        <span className="chat-session-header__customer">{activeConv.customer}</span>
        <div className="chat-session-header__meta">
          <span className="chat-session-header__timer">
            <span className="chat-session-header__timer-dot" />
            14:22
          </span>
          <span>{t('chat.interaction')} #{activeConv.id.replace('conv-', '20240')}</span>
          {activeConv.caseId && (
            <span className="chat-session-header__case-link">{activeConv.caseId}</span>
          )}
        </div>
      </div>

      {/* ── 3-column body ── */}
      <div className="chat-widget__body widget-body">

        {/* ── Left: conversation list ── */}
        <div className="chat-widget__conversations widget-panel">
          <div className="chat-conv-list__header">{t('chat.conversations')}</div>
          <ul className="chat-conv-list">
            {filteredConversations.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeConvId}
                darkMode={darkMode}
                onClick={() => setActiveConvId(conv.id)}
                innerRef={conv.id === activeConvId ? activeConvRef : null}
              />
            ))}
          </ul>
        </div>

        {/* ── Center: transcript + composer ── */}
        <div className="chat-widget__transcript widget-panel">
          <div className="chat-messages">
            {getMessages(activeConvId).map((msg) => (
              <ChatBubble key={msg.id} message={msg} darkMode={darkMode} />
            ))}
            {/* Typing indicator — always show in active mock session */}
            {activeConv.active && (
              <div className="chat-typing">
                <div className="chat-typing__dots">
                  <div className="chat-typing__dot" />
                  <div className="chat-typing__dot" />
                  <div className="chat-typing__dot" />
                </div>
                <span>{activeConv.customer} {t('chat.typing')}</span>
              </div>
            )}
          </div>

          <div className="chat-composer">
            <textarea
              className="chat-composer__input"
              placeholder={t('chat.composer.placeholder')}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className="chat-composer__send" onClick={handleSend}>{t('chat.composer.send')}</button>
          </div>
        </div>

        {/* ── Right rail: AI suggestions + cases ── */}
        <div className="chat-widget__rail widget-rail">

          {/* AI suggested replies */}
          <div className="chat-rail__section widget-rail-card widget-rail-card__content">
            <div className="chat-rail__section-title">{t('chat.ai.suggestedReplies')}</div>
            {AI_SUGGESTIONS.map((s, i) => (
              <div
                key={i}
                className="chat-ai-suggestion"
                role="button"
                tabIndex={0}
                onClick={() => handleSuggestionClick(s.text)}
                onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(s.text)}
              >
                <span className="chat-ai-suggestion__label">{s.label}</span>
                {s.text}
              </div>
            ))}
          </div>

          {/* Linked open cases */}
          <div className="chat-rail__section widget-rail-card widget-rail-card__content">
            <div className="chat-rail__section-title">{t('chat.ai.openCases')}</div>
            {OPEN_CASES.map((c) => (
              <div key={c.id} className="chat-case-item">
                <span className="chat-case-item__id" style={{ '--case-color': c.color }}>
                  {c.id}
                </span>
                <span className="chat-case-item__topic">{c.topic}</span>
                <span className="chat-case-item__meta">{c.status} · {c.priority}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      </>)} {/* end activeTab === 'chat' */}
    </div>
  );
};

ChatWidget.propTypes = {
  darkMode: PropTypes.bool,
  mockMode: PropTypes.bool,
  onNavigate: PropTypes.func,
};

ChatWidget.defaultProps = {
  darkMode: false,
  mockMode: false,
};

export default ChatWidget;
