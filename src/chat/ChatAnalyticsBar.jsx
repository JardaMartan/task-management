import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';

// ─── Inline SVG mini-charts ────────────────────────────────────────────────

const DonutChart = ({ segments, size = 64, thickness = 11, darkMode }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke={darkMode ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'}
        strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const el = (
          <circle key={i} cx={cx} cy={cx} r={r}
            fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circumference}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
};

const Sparkline = ({ values, color, width = 84, height = 28 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = (v, i) =>
    `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`;
  const points = values.map(pts).join(' ');
  const area = [`0,${height}`, ...values.map(pts), `${width},${height}`].join(' ');
  const lx = ((values.length - 1) * step).toFixed(1);
  const lv = values[values.length - 1];
  const ly = (height - ((lv - min) / range) * (height - 4) - 2).toFixed(1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <polygon points={area} fill={color} fillOpacity="0.14" />
      <polyline points={points} fill="none" stroke={color}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill={color} />
    </svg>
  );
};

const StackBar = ({ segments, height = 8, radius = 4 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div style={{ display: 'flex', height, borderRadius: radius, overflow: 'hidden', gap: 1 }}>
      {segments.map((seg, i) => (
        <div key={i} title={`${seg.label}: ${seg.value}`}
          style={{ flex: total > 0 ? seg.value / total : 0, background: seg.color, transition: 'flex 0.4s ease' }}
        />
      ))}
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────

const KpiTile = ({ label, value, sub, accent }) => (
  <div className="analytics-kpi" style={{ borderLeft: `3px solid ${accent}` }}>
    <div className="analytics-kpi__value" style={{ color: accent }}>{value}</div>
    <div className="analytics-kpi__label">{label}</div>
    {sub && <div className="analytics-kpi__sub">{sub}</div>}
  </div>
);

const Legend = ({ items }) => (
  <div className="analytics-legend">
    {items.map((it) => (
      <span key={it.label} className="analytics-legend__item">
        <span className="analytics-legend__dot" style={{ background: it.color }} />
        <span className="analytics-legend__text">{it.label}</span>
        <span className="analytics-legend__count">{it.value}</span>
      </span>
    ))}
  </div>
);

const CaseBadge = ({ caseItem }) => (
  <div
    className="analytics-case-badge"
    style={{ borderLeft: `3px solid ${caseItem.color}` }}
  >
    <span className="analytics-case-badge__id" style={{ color: caseItem.color }}>{caseItem.id}</span>
    <span className="analytics-case-badge__topic">{caseItem.topic}</span>
    <span className="analytics-case-badge__meta">{caseItem.status} · {caseItem.priority}</span>
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────

/**
 * ChatAnalyticsBar — horizontal analytics strip for the chat widget.
 * Shows customer-level metrics across all chat channels:
 * - Channel mix donut (Webchat / WhatsApp / SMS / Apple Messages / RCS / In-App)
 * - Session outcome stacked bar (Active / Resolved / Transferred / Abandoned)
 * - Customer sentiment donut
 * - 7-day conversation volume + AHT sparklines
 * - Open cases cross-reference
 * - KPIs: First Response, SLA %, CSAT, Conversations/month
 */
const ChatAnalyticsBar = ({ darkMode, data: dataProp }) => {
  const { locale } = useI18n();
  const d = dataProp || getMockData(locale).analytics.chat;

  return (
    <div className={`analytics-bar analytics-bar--chat${darkMode ? ' analytics-bar--dark' : ''}`}>

      {/* ── Channel mix ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Channel Mix</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.channelMix} size={64} thickness={11} darkMode={darkMode} />
            <div className="analytics-donut-center">
              <span className="analytics-donut-center__big">{d.totalConversations}</span>
              <span className="analytics-donut-center__small">30d</span>
            </div>
          </div>
          <Legend items={d.channelMix} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Session outcomes ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Outcomes</div>
        <div className="analytics-section__content">
          <StackBar segments={d.sessionStatus} height={8} />
          <Legend items={d.sessionStatus} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Sentiment ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Sentiment</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.sentiment} size={56} thickness={10} darkMode={darkMode} />
          </div>
          <Legend items={d.sentiment} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Sparklines ── */}
      <div className="analytics-section analytics-section--sparklines">
        <div className="analytics-section__title">7-Day Trend</div>
        <div className="analytics-section__content">
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">Volume</span>
            <Sparkline values={d.volumeTrend} color="#25D366" width={84} height={28} />
          </div>
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">AHT (min)</span>
            <Sparkline values={d.ahtTrend} color="#f5a623" width={84} height={28} />
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Open cases ── */}
      <div className="analytics-section analytics-section--cases">
        <div className="analytics-section__title">Open Cases</div>
        <div className="analytics-section__content">
          <div className="analytics-cases-list">
            {d.openCases.map((c) => (
              <CaseBadge key={c.id} caseItem={c} />
            ))}
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── KPIs ── */}
      <div className="analytics-section analytics-section--kpis">
        <div className="analytics-section__title">KPIs</div>
        <div className="analytics-section__content analytics-kpi-grid">
          <KpiTile label="First Response" value={`${d.avgFirstResponseSec}s`} accent="#25D366" />
          <KpiTile label="SLA Met" value={`${d.slaMet}%`} accent="#4ade80" />
          <KpiTile label="CSAT" value={d.csat.toFixed(1)} sub="out of 5" accent="#a78bfa" />
          <KpiTile label="Convos (30d)" value={d.conversationsThisMonth} accent="#f5a623" />
        </div>
      </div>

    </div>
  );
};

ChatAnalyticsBar.propTypes = {
  darkMode: PropTypes.bool,
  data: PropTypes.object,
};

ChatAnalyticsBar.defaultProps = {
  darkMode: false,
  data: null,
};

export default ChatAnalyticsBar;
