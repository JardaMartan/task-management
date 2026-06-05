import React from 'react';
import PropTypes from 'prop-types';

// ─── Inline SVG mini-charts ────────────────────────────────────────────────

/** Donut chart */
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

/** Bar chart — vertical bars for time series */
const BarChart = ({ values, color, width = 96, height = 36, darkMode }) => {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values);
  const barW = width / values.length - 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      {values.map((v, i) => {
        const barH = max > 0 ? (v / max) * (height - 4) : 0;
        const x = i * (barW + 2) + 1;
        const y = height - barH - 2;
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH}
            rx="2" fill={color} opacity="0.85"
            style={{ transition: 'height 0.4s ease' }}
          />
        );
      })}
    </svg>
  );
};

/** Sparkline */
const Sparkline = ({ values, color, width = 80, height = 32 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) =>
    `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`
  ).join(' ');
  const areaPoints = [
    `0,${height}`,
    ...values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`),
    `${width},${height}`,
  ].join(' ');
  const lx = ((values.length - 1) * step).toFixed(1);
  const lv = values[values.length - 1];
  const ly = (height - ((lv - min) / range) * (height - 4) - 2).toFixed(1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <polygon points={areaPoints} fill={color} fillOpacity="0.15" />
      <polyline points={points} fill="none" stroke={color}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill={color} />
    </svg>
  );
};

/** Horizontal stacked bar */
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

// ─── Mock data ─────────────────────────────────────────────────────────────

const MOCK_HISTORY = {
  byChannel: [
    { label: 'Phone', value: 38, color: '#4ade80' },
    { label: 'Email', value: 27, color: '#a78bfa' },
    { label: 'Chat', value: 19, color: '#60a5fa' },
    { label: 'SMS', value: 8, color: '#f472b6' },
    { label: 'Task', value: 6, color: '#fbbf24' },
  ],
  byOutcome: [
    { label: 'Resolved', value: 58, color: '#4ade80' },
    { label: 'Escalated', value: 14, color: '#f5a623' },
    { label: 'Pending', value: 11, color: '#60a5fa' },
    { label: 'Abandoned', value: 7, color: '#e8453c' },
    { label: 'Transferred', value: 8, color: '#9ca3af' },
  ],
  // Interactions per day last 7 days
  volumeTrend: [12, 18, 15, 22, 19, 14, 17],
  // Avg handle time per day (minutes)
  ahtTrend: [6.2, 7.1, 5.8, 8.4, 6.9, 5.5, 7.3],
  // Sentiment distribution (last 30 days)
  sentiment: [
    { label: 'Positive', value: 41, color: '#4ade80' },
    { label: 'Neutral', value: 34, color: '#9ca3af' },
    { label: 'Negative', value: 23, color: '#e8453c' },
  ],
  // Weekday distribution (Mon–Sun)
  weekdayVolume: [21, 19, 23, 18, 22, 9, 5],
  totalInteractions: 98,
  avgHandleTimeMin: 6.7,
  repeatContactRate: 22, // %
  escalationRate: 14, // %
  resolutionRate: 76, // %
};

// ─── Legend ────────────────────────────────────────────────────────────────

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

// ─── KPI tile ──────────────────────────────────────────────────────────────

const KpiTile = ({ label, value, sub, accent }) => (
  <div className="analytics-kpi" style={{ borderLeft: `3px solid ${accent}` }}>
    <div className="analytics-kpi__value" style={{ color: accent }}>{value}</div>
    <div className="analytics-kpi__label">{label}</div>
    {sub && <div className="analytics-kpi__sub">{sub}</div>}
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────

/**
 * HistoryAnalyticsBar — analytics strip above the interaction history timeline.
 * Covers the key contact-centre communication history metrics:
 * - Channel mix donut
 * - Outcome distribution
 * - Customer sentiment
 * - Daily volume & AHT trends
 * - Weekday pattern bar chart
 * - KPIs: resolution rate, escalation rate, repeat contacts, avg handle time
 */
const HistoryAnalyticsBar = ({ darkMode, data: dataProp }) => {
  const d = dataProp || MOCK_HISTORY;
  const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className={`analytics-bar analytics-bar--history${darkMode ? ' analytics-bar--dark' : ''}`}>

      {/* ── Channel mix donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Channel Mix</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.byChannel} size={64} thickness={11} darkMode={darkMode} />
            <div className="analytics-donut-center">
              <span className="analytics-donut-center__big">{d.totalInteractions}</span>
              <span className="analytics-donut-center__small">total</span>
            </div>
          </div>
          <Legend items={d.byChannel} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Outcome stack ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Outcomes</div>
        <div className="analytics-section__content">
          <StackBar segments={d.byOutcome} height={8} />
          <Legend items={d.byOutcome} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Sentiment donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Sentiment</div>
        <div className="analytics-section__content analytics-section__content--row">
          <DonutChart segments={d.sentiment} size={56} thickness={10} darkMode={darkMode} />
          <Legend items={d.sentiment} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Weekday pattern ── */}
      <div className="analytics-section analytics-section--sparklines">
        <div className="analytics-section__title">By Weekday</div>
        <div className="analytics-section__content">
          <BarChart values={d.weekdayVolume} color="#60a5fa" width={96} height={36} darkMode={darkMode} />
          <div className="analytics-weekday-labels">
            {weekdays.map((wd) => <span key={wd}>{wd}</span>)}
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Volume & AHT sparklines ── */}
      <div className="analytics-section analytics-section--sparklines">
        <div className="analytics-section__title">7-Day Trend</div>
        <div className="analytics-section__content">
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">Volume</span>
            <Sparkline values={d.volumeTrend} color="#4ade80" width={84} height={28} />
          </div>
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">AHT (min)</span>
            <Sparkline values={d.ahtTrend} color="#fbbf24" width={84} height={28} />
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── KPIs ── */}
      <div className="analytics-section analytics-section--kpis">
        <div className="analytics-section__title">KPIs</div>
        <div className="analytics-section__content analytics-kpi-grid">
          <KpiTile label="Resolution" value={`${d.resolutionRate}%`} accent="#4ade80" />
          <KpiTile label="Escalation" value={`${d.escalationRate}%`} accent="#f5a623" />
          <KpiTile label="Repeat Contact" value={`${d.repeatContactRate}%`} accent="#e8453c" />
          <KpiTile label="Avg AHT" value={`${d.avgHandleTimeMin}m`} sub="handle time" accent="#60a5fa" />
        </div>
      </div>

    </div>
  );
};

HistoryAnalyticsBar.propTypes = {
  darkMode: PropTypes.bool,
  data: PropTypes.object,
};

export default HistoryAnalyticsBar;
