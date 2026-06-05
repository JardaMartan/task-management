import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Badge, Card, CardSection, Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import HistoryAnalyticsBar from './HistoryAnalyticsBar';

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

// ─── Mock data (Moneta Bank / ACME Corp context) ───────────────────────────

const now = Date.now();
const MOCK_HISTORY_EVENTS = [
  {
    id: 'hist-1',
    ts: new Date(now - 5 * 60000).toISOString(),
    channel: 'email',
    title: 'Urgent: Invoice #INV-2024-0892 – Payment Not Processed',
    summary: 'Third escalation. SEPA transfer ref SEPA-20250529-8821 debited but not reflected in system. Invoice and bank confirmation attached.',
  },
  {
    id: 'hist-2',
    ts: new Date(now - 3 * 3600000).toISOString(),
    channel: 'phone',
    title: 'Inbound call – payment processing follow-up',
    summary: 'Customer called to follow up on CASE-2024-0892. Transferred to payments team after 4 min hold. Total duration: 8m 22s.',
  },
  {
    id: 'hist-3',
    ts: new Date(now - 26 * 3600000).toISOString(),
    channel: 'email',
    title: 'Still no update. Can you please escalate?',
    summary: 'Customer escalating to supervisor level. No resolution after 24h since case was opened.',
  },
  {
    id: 'hist-4',
    ts: new Date(now - 2 * 86400000).toISOString(),
    channel: 'email',
    title: 'Dear Sarah, we have received your query',
    summary: 'Support acknowledgment email. Case CASE-2024-0892 opened. Expected resolution within 3 business days.',
  },
  {
    id: 'hist-5',
    ts: new Date(now - 8 * 86400000).toISOString(),
    channel: 'webchat',
    title: 'Online banking access issue – webchat',
    summary: 'Customer reported login failure after password reset via Moneta Bank webchat. 2FA SMS not delivered. Issue resolved in session — new authenticator app set up.',
  },
  {
    id: 'hist-6',
    ts: new Date(now - 14 * 86400000).toISOString(),
    channel: 'whatsapp',
    title: 'Overdraft fee dispute – WhatsApp',
    summary: 'Customer contacted via WhatsApp to query €45 overdraft fee (8 May). Explained payment processor delay. Back-office review authorised — fee waived as goodwill gesture.',
  },
  {
    id: 'hist-7',
    ts: new Date(now - 21 * 86400000).toISOString(),
    channel: 'sms',
    title: 'SMS confirmation: case update',
    summary: 'Outbound SMS sent to +49 89 1234 5678 confirming CASE-2024-0651 escalation. Customer replied: "Thank you, waiting for update."',
  },
  {
    id: 'hist-8',
    ts: new Date(now - 35 * 86400000).toISOString(),
    channel: 'apple',
    title: 'Monthly statement query – Apple Messages',
    summary: 'Customer asked for clarification of April statement line item via Apple Messages for Business. Explained currency conversion fee on USD purchase. Customer satisfied.',
  },
  {
    id: 'hist-9',
    ts: new Date(now - 42 * 86400000).toISOString(),
    channel: 'in-app',
    title: 'Card limit increase request – In-App chat',
    summary: 'Customer requested temporary credit card limit increase to €20,000 for upcoming procurement via Moneta mobile app chat. Approved after identity verification. Limit active for 7 days.',
  },
  {
    id: 'hist-10',
    ts: new Date(now - 63 * 86400000).toISOString(),
    channel: 'phone',
    title: 'Inbound call – card blocked abroad',
    summary: 'Card blocked during international travel (USA). Identity verified via video call. Card reactivated within 20 minutes. CASE-2024-0445 opened and resolved.',
  },
  {
    id: 'hist-11',
    ts: new Date(now - 71 * 86400000).toISOString(),
    channel: 'rcs',
    title: 'Travel notification – RCS',
    summary: 'Customer sent travel notification for US trip via RCS messaging. Card cleared for international use. Fraud alerts suppressed for 14 days.',
  },
  {
    id: 'hist-12',
    ts: new Date(now - 81 * 86400000).toISOString(),
    channel: 'email',
    title: 'SEPA transfer delay enquiry',
    summary: 'Customer enquired about delayed payment to supplier. AML screening threshold triggered. Funds cleared after 3 business days. Apology letter sent.',
  },
];

const MOCK_AI_SUMMARY = 'Sarah Johnson (ACME Corp Finance Manager) is a high-value customer with a pattern of payment processing issues. Current active case CASE-2024-0892 is her third escalation for Invoice #INV-2024-0892 ($12,500). History shows 2 prior resolved cases (card block, SEPA delay) and an open login issue. Sentiment is urgent — immediate payment team escalation and proactive callback recommended.';

// ─── Component ─────────────────────────────────────────────────────────────

const HistoryView = ({ darkMode, mockMode }) => {
  const { t } = useI18n();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

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
