import React, { useState } from 'react';
import PropTypes from 'prop-types';
import VoiceAnalyticsBar from './VoiceAnalyticsBar';
import './voice.css';

// ─── Mock call history ────────────────────────────────────────────────────

const MOCK_CALLS = [
  {
    id: 'call-1', active: true,
    customer: 'Sarah Johnson',
    phone: '+49 89 1234 5678',
    started: '09:41',
    durationSec: 847,
    direction: 'inbound',
    queue: 'Priority Banking',
    caseId: 'CASE-2024-0892',
    sentiment: 'negative',
    outcome: null, // still active
  },
  {
    id: 'call-2', active: false,
    customer: 'Sarah Johnson',
    phone: '+49 89 1234 5678',
    started: '2025-05-29',
    durationSec: 312,
    direction: 'outbound',
    queue: 'Callback',
    caseId: 'CASE-2024-0784',
    sentiment: 'positive',
    outcome: 'Resolved',
  },
  {
    id: 'call-3', active: false,
    customer: 'Sarah Johnson',
    phone: '+49 89 1234 5678',
    started: '2025-04-14',
    durationSec: 489,
    direction: 'inbound',
    queue: 'General Banking',
    caseId: 'CASE-2024-0651',
    sentiment: 'neutral',
    outcome: 'Transferred',
  },
  {
    id: 'call-4', active: false,
    customer: 'Sarah Johnson',
    phone: '+49 89 1234 5678',
    started: '2025-03-01',
    durationSec: 228,
    direction: 'inbound',
    queue: 'General Banking',
    caseId: 'CASE-2024-0445',
    sentiment: 'positive',
    outcome: 'Resolved',
  },
];

// ─── Mock transcript (active call) ────────────────────────────────────────

const MOCK_TRANSCRIPT = [
  {
    id: 't0', role: 'system',
    text: 'Inbound call connected · Sarah Johnson · Priority Banking · 09:41',
  },
  {
    id: 't1', role: 'customer', speaker: 'Sarah Johnson',
    text: "Good morning. I'm Sarah Johnson, account number 40-2291-886. I placed a SEPA transfer on Tuesday — reference SEPA-20250529-8821 — and the funds still haven't arrived. This is a business payment and my supplier's invoice was due yesterday.",
    time: '00:12',
  },
  {
    id: 't2', role: 'agent', speaker: 'Agent',
    text: "Good morning, Ms. Johnson. I can see your account. Let me pull up the transfer right away — SEPA-20250529-8821. One moment please.",
    time: '00:42',
  },
  {
    id: 't3', role: 'customer', speaker: 'Sarah Johnson',
    text: "The invoice amount was €12,500. It's for invoice INV-2024-0892. My supplier is Technologix GmbH in Munich.",
    time: '01:05',
  },
  {
    id: 't4', role: 'agent', speaker: 'Agent',
    text: "Thank you. I can see the payment is currently showing a compliance hold — our fraud screening flagged the transaction due to the amount. I'm escalating this to the payments team now and this should be cleared within the next two hours.",
    time: '01:28',
  },
  {
    id: 't5', role: 'customer', speaker: 'Sarah Johnson',
    text: "Two hours? This is completely unacceptable. My supplier said they'll put our account on hold if they don't receive payment today.",
    time: '01:58',
  },
  {
    id: 't6', role: 'agent', speaker: 'Agent',
    text: "I completely understand your frustration, Ms. Johnson. I'm going to mark this as urgent and personally ensure the payments escalation team prioritises it. You'll receive an SMS confirmation as soon as the hold is released. I'm also creating a case so we can track this end to end.",
    time: '02:18',
  },
  {
    id: 't7', role: 'system',
    text: '⟳ Live transcription in progress…',
    live: true,
  },
];

// ─── AI Summary & suggestions ──────────────────────────────────────────────

const AI_SUMMARY = {
  headline: 'SEPA transfer blocked — urgent resolution required',
  points: [
    'Customer: Sarah Johnson · Acct 40-2291-886 · Priority Banking tier',
    'Transfer SEPA-20250529-8821 for €12,500 to Technologix GmbH flagged by fraud screening',
    'Invoice INV-2024-0892 overdue; supplier threatening to place account on hold',
    'Agent escalated to payments team — ETA 2 hours; SMS confirmation committed',
    'Overall sentiment: Negative → improving after escalation commitment',
  ],
  sentiment: 'negative',
  intent: 'Payment dispute — SEPA transfer delay',
  suggestedActions: [
    { id: 'a1', label: 'Create Case', type: 'action', description: 'Open a new Priority case for this transfer dispute' },
    { id: 'a2', label: 'Send SMS Update', type: 'action', description: 'Send SMS to customer confirming escalation and 2h ETA' },
    { id: 'a3', label: 'Transfer to Payments', type: 'transfer', description: 'Warm transfer to the Payments Escalation team' },
  ],
};

const OPEN_CASES = [
  { id: 'CASE-2024-0892', title: 'SEPA Transfer Dispute — €12,500', status: 'Open',   priority: 'High' },
  { id: 'CASE-2024-0784', title: 'Login failure after password reset',  status: 'Closed', priority: 'Low'  },
  { id: 'CASE-2024-0651', title: 'Overdraft fee dispute — €45',         status: 'Closed', priority: 'Low'  },
];

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

const VoiceWidget = ({ darkMode }) => {
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [selectedCallId, setSelectedCallId] = useState('call-1');
  const selectedCall = MOCK_CALLS.find(c => c.id === selectedCallId) || MOCK_CALLS[0];

  return (
    <div className={`voice widget-shell${darkMode ? ' md--dark' : ''}`}>

      {/* ── Collapsible analytics bar ─────────────────── */}
      <div className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
        <button
          className="analytics-collapse__toggle"
          onClick={() => setAnalyticsOpen(o => !o)}
          aria-expanded={analyticsOpen}
        >
          <span className="analytics-collapse__label">Customer Analytics</span>
          <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
        </button>
        {analyticsOpen && <VoiceAnalyticsBar darkMode={darkMode} />}
      </div>

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
            {selectedCall.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
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
          <div className="widget-panel__header">Call History</div>
          {MOCK_CALLS.map(call => (
            <div
              key={call.id}
              className={`voice__call-item${call.id === selectedCallId ? ' voice__call-item--active' : ''}`}
              onClick={() => setSelectedCallId(call.id)}
            >
              <div className="voice__call-item-top">
                <SentimentDot sentiment={call.sentiment} />
                <span className="voice__call-item-dir">{call.direction === 'inbound' ? '↙' : '↗'}</span>
                <span className="voice__call-item-time">{call.started}</span>
                {call.active && <span className="voice__live-badge">LIVE</span>}
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
            Transcript
            {selectedCall.active && <span className="voice__live-badge voice__live-badge--sm">● LIVE</span>}
          </div>
          <div className="voice__transcript-scroll">
            {MOCK_TRANSCRIPT.map(entry => {
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
              <span className="voice__ai-icon">✦</span> AI Summary
            </div>
            <div className="voice__ai-headline">{AI_SUMMARY.headline}</div>
            <div className="voice__ai-intent">
              Intent: <strong>{AI_SUMMARY.intent}</strong>
            </div>
            <ul className="voice__ai-points">
              {AI_SUMMARY.points.map((pt, i) => (
                <li key={i} className="voice__ai-point">{pt}</li>
              ))}
            </ul>
          </div>

          {/* Suggested Actions */}
          <div className="voice__ai-actions widget-rail-card">
            <div className="widget-panel__subheader">Suggested Actions</div>
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
            <div className="widget-panel__subheader">Related Cases</div>
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
};

export default VoiceWidget;
