import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Badge, Card, CardSection, Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import HistoryAnalyticsBar from './HistoryAnalyticsBar';
import { getMockData } from '../mock/mockData';

const CHANNEL_ICONS = {
  call: 'handset_16',
  phone: 'handset_16',
  voice: 'handset_16',
  email: 'email_16',
  chat: 'chat_16',
  webchat: 'chat_16',
  whatsapp: 'chat_16',
  sms: 'sms-message_16',
  rcs: 'sms-message_16',
  apple: 'chat_16',
  'in-app': 'chat_16',
  task: 'tasks_16',
  case: 'tasks_16',
};

const CHANNEL_COLOR = {
  call: 'green',
  phone: 'green',
  voice: 'green',
  email: 'purple',
  chat: 'blue',
  webchat: 'blue',
  whatsapp: 'green',
  sms: 'blue',
  rcs: 'blue',
  apple: 'blue',
  'in-app': 'violet',
  task: 'pastel',
  case: 'pastel',
};

const formatDateTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
};

const formatRelative = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

const normalizeEvents = (caseEvents, emailEvents) => {
  const out = [];
  (caseEvents || []).forEach((e) => {
    out.push({
      id: e.id || `${e.timestamp}-${e.title || 'case'}`,
      ts: e.timestamp || e.createdAt,
      channel: String(e.interactionType || 'task').toLowerCase(),
      title: e.title || e.summary || 'Interaction',
      summary: e.summary,
      details: e.details,
    });
  });
  (emailEvents || []).forEach((e) => {
    out.push({
      id: e.id || `${e.time || e.timestamp}-${e.type || 'email'}`,
      ts: e.time || e.timestamp || e.createdAt,
      channel: String(e.type || e.eventType || e.channelType || 'email').toLowerCase(),
      title: e.subject || e.title || `${e.channelType || e.type || 'event'}`,
      summary: e.snippet || e.summary || e.outcome || '',
      details: e.details,
    });
  });
  // sort newest first
  out.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
  return out;
};

// ─── Component ───────────────────────────────────────────────────────────────

const HistoryView = ({ darkMode, mockMode }) => {
  const { locale, t } = useI18n();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  // Mock data (locale-aware)
  const mockData = getMockData(locale);
  const MOCK_HISTORY_EVENTS = mockData.history.events;
  const MOCK_AI_SUMMARY = mockData.history.aiSummary;

  // Always call hooks (hook order must be stable)
  const caseHistory  = useSelector((s) => s.widget.caseWorkflow?.visibleHistory) || [];
  const emailHistory = useSelector((s) => s.email?.customerHistory) || [];
  const reduxSummary = useSelector((s) => s.email?.aiEnrichment?.summary);

  // Choose data source
  const aiSummary = mockMode ? MOCK_AI_SUMMARY : reduxSummary;
  const events = useMemo(
    () => mockMode ? MOCK_HISTORY_EVENTS : normalizeEvents(caseHistory, emailHistory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mockMode, caseHistory, emailHistory]
  );

  return (
    <div className={`history-view view-panel${darkMode ? ' md--dark' : ''}`}>
      <div className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
        <button
          className="analytics-collapse__toggle"
          onClick={() => setAnalyticsOpen((o) => !o)}
          aria-expanded={analyticsOpen}
        >
          <span className="analytics-collapse__label">Customer Analytics</span>
          <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
        </button>
        {analyticsOpen && <HistoryAnalyticsBar darkMode={darkMode} />}
      </div>
      {aiSummary && (
        <Card className="history-view__summary" dark={darkMode}>
          <CardSection full>
            <div className="history-view__summary-label">
              {t('history.aiSummary') || 'AI summary of recent activity'}
            </div>
            <p className="history-view__summary-text">{aiSummary}</p>
          </CardSection>
        </Card>
      )}

      {events.length === 0 ? (
        <Card><CardSection full>
          <div className="history-view__empty">
            {t('history.empty') || 'No interaction history yet.'}
          </div>
        </CardSection></Card>
      ) : (
        <ol className="history-view__timeline" aria-label="Customer interaction timeline">
          {events.map((ev) => {
            const icon = CHANNEL_ICONS[ev.channel] || CHANNEL_ICONS.task;
            const color = CHANNEL_COLOR[ev.channel] || 'pastel';
            return (
              <li key={ev.id} className="history-view__item">
                <div className={`history-view__dot history-view__dot--${ev.channel}`}>
                  <Icon name={icon} />
                </div>
                <div className="history-view__body">
                  <div className="history-view__row">
                    <Badge color={color} rounded>{ev.channel}</Badge>
                    <span className="history-view__title">{ev.title}</span>
                    <span className="history-view__when" title={formatDateTime(ev.ts)}>
                      {formatRelative(ev.ts)}
                    </span>
                  </div>
                  {ev.summary && <div className="history-view__summary-line">{ev.summary}</div>}
                  {ev.details && <div className="history-view__details">{ev.details}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

HistoryView.propTypes = { darkMode: PropTypes.bool, mockMode: PropTypes.bool };
HistoryView.defaultProps = { darkMode: false, mockMode: false };

export default HistoryView;
