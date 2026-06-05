import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ChatAnalyticsBar from './ChatAnalyticsBar';
import { useI18n } from '../i18n/I18nContext';
import './chat.css';

// ─── Channel metadata ──────────────────────────────────────────────────────

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

// ─── Mock data — Moneta Bank / Sarah Johnson ───────────────────────────────

const MOCK_CONVERSATIONS = [
  {
    id: 'conv-1', channel: 'whatsapp', active: true,
    customer: 'Sarah Johnson',
    snippet: "SEPA transfer still hasn't processed…",
    time: '14 min', status: 'Active',
    caseId: 'CASE-2024-0892',
  },
  {
    id: 'conv-2', channel: 'webchat', active: false,
    customer: 'Sarah Johnson',
    snippet: 'Login failure after password reset…',
    time: '8d', status: 'Resolved',
    caseId: 'CASE-2024-0784',
  },
  {
    id: 'conv-3', channel: 'sms', active: false,
    customer: 'Sarah Johnson',
    snippet: 'Overdraft fee query — €45 charge…',
    time: '26d', status: 'Resolved',
    caseId: 'CASE-2024-0651',
  },
  {
    id: 'conv-4', channel: 'in-app', active: false,
    customer: 'Sarah Johnson',
    snippet: 'Card blocked in New York, need help',
    time: '63d', status: 'Resolved',
    caseId: 'CASE-2024-0445',
  },
];

const MOCK_MESSAGES = [
  {
    id: 'm0', role: 'system',
    text: 'Sarah Johnson connected via WhatsApp · 14 min ago',
  },
  {
    id: 'm1', role: 'customer',
    text: "I still haven't received any update on my SEPA transfer. My reference is SEPA-20250529-8821. This is really urgent — my invoice deadline was yesterday.",
    time: '14 min ago',
  },
  {
    id: 'm2', role: 'customer',
    text: "Invoice #INV-2024-0892 for €12,500. My supplier is now threatening to put our account on hold.",
    time: '13 min ago',
  },
  {
    id: 'm3', role: 'agent',
    text: "Hi Sarah! I can see your account and the payment details right here. I'm looking into this immediately — please give me just a moment.",
    time: '12 min ago',
  },
  {
    id: 'm4', role: 'agent',
    text: "I can see this is linked to CASE-2024-0892, which has already been escalated to our payments team. The SEPA transfer has been received but is currently pending a routine compliance review. I'm prioritising this right now.",
    time: '11 min ago',
  },
  {
    id: 'm5', role: 'customer',
    text: "Compliance check? This is a regular monthly supplier payment — I've done this exact transfer for two years!",
    time: '9 min ago',
  },
  {
    id: 'm6', role: 'agent',
    text: "Completely understood, Sarah. This is an automated check that triggers for transfers above €10,000 — it's not a reflection of your account standing. Given your history with us, I'm escalating now to our senior payments officer. You should have a resolution within 2 hours.",
    time: '7 min ago',
  },
];

const AI_SUGGESTIONS = [
  {
    label: 'Escalate & Confirm',
    text: "I've just escalated CASE-2024-0892 to Priority 1. Our senior payments officer will contact you directly within the next 2 hours to confirm the release of SEPA-20250529-8821.",
  },
  {
    label: 'Resolution Ready',
    text: "Good news — SEPA-20250529-8821 has cleared the compliance review. Funds will be credited to your supplier within 1–2 business hours. I'll send a confirmation message once complete.",
  },
  {
    label: 'Prevent Future Delay',
    text: "I've added a note to CASE-2024-0892 confirming this is a recurring supplier payment and requesting an exemption for future transfers of this type. This should prevent any delays going forward.",
  },
];

const OPEN_CASES = [
  { id: 'CASE-2024-0892', topic: 'Payment Processing', status: 'In Progress', priority: 'High',   color: '#f5a623' },
  { id: 'CASE-2024-0784', topic: 'Login Access',       status: 'Open',        priority: 'Medium', color: '#00a0d1' },
  { id: 'CASE-2024-0651', topic: 'Overdraft Dispute',  status: 'In Progress', priority: 'High',   color: '#f5a623' },
];

// ─── Small sub-components ──────────────────────────────────────────────────

const ConvItem = ({ conv, active, darkMode, onClick }) => (
  <li
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
const ChatWidget = ({ darkMode, mockMode }) => {
  const { t } = useI18n();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [activeConvId, setActiveConvId] = useState('conv-1');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState(MOCK_MESSAGES);

  const activeConv = MOCK_CONVERSATIONS.find((c) => c.id === activeConvId) || MOCK_CONVERSATIONS[0];
  const channelColor = CHANNEL_COLORS[activeConv.channel] || '#9ca3af';
  const channelLabel = CHANNEL_LABELS[activeConv.channel] || activeConv.channel;

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, role: 'agent', text, time: 'just now' },
    ]);
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
        <button
          className="analytics-collapse__toggle"
          onClick={() => setAnalyticsOpen((o) => !o)}
          aria-expanded={analyticsOpen}
        >
          <span className="analytics-collapse__label">{t('analytics.customerAnalytics')}</span>
          <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
        </button>
        {analyticsOpen && <ChatAnalyticsBar darkMode={darkMode} />}
      </div>

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
            {MOCK_CONVERSATIONS.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeConvId}
                darkMode={darkMode}
                onClick={() => setActiveConvId(conv.id)}
              />
            ))}
          </ul>
        </div>

        {/* ── Center: transcript + composer ── */}
        <div className="chat-widget__transcript widget-panel">
          <div className="chat-messages">
            {messages.map((msg) => (
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
    </div>
  );
};

ChatWidget.propTypes = {
  darkMode: PropTypes.bool,
  mockMode: PropTypes.bool,
};

ChatWidget.defaultProps = {
  darkMode: false,
  mockMode: false,
};

export default ChatWidget;
