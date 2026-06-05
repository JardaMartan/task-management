import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';

// ─── Inline SVG mini-charts ───────────────────────────────────────────────────

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
  let x = 0;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none" role="img">
      {segments.map((seg, i) => {
        const w = total > 0 ? (seg.value / total) * 100 : 0;
        const isFirst = i === 0;
        const el = (
          <rect key={i} x={x} y={0} width={w} height={height} fill={seg.color}
            rx={isFirst ? radius : 0} ry={isFirst ? radius : 0} />
        );
        x += w;
        return el;
      })}
    </svg>
  );
};

// Uses the shared analytics CSS classes from views.css — same as ChatAnalyticsBar
const KpiTile = ({ label, value, sub, accent }) => (
  <div className="analytics-kpi" style={{ borderLeft: `3px solid ${accent}` }}>
    <div className="analytics-kpi__value" style={{ color: accent }}>{value}</div>
    <div className="analytics-kpi__label">{label}</div>
    {sub && <div className="analytics-kpi__sub">{sub}</div>}
  </div>
);

const Legend = ({ items }) => (
  <div className="analytics-legend">
    {items.map(item => (
      <span key={item.label} className="analytics-legend__item">
        <span className="analytics-legend__dot" style={{ background: item.color }} />
        <span className="analytics-legend__text">{item.label}</span>
        <span className="analytics-legend__count">{item.value}</span>
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

// ─── Component ────────────────────────────────────────────────────────────

const VoiceAnalyticsBar = ({ darkMode, data }) => {
  const { locale } = useI18n();
  const d = data || getMockData(locale).analytics.voice;
  const total = d.callOutcomes.reduce((s, seg) => s + seg.value, 0);
  const ahtMin = Math.floor(d.avgHandleTimeSec / 60);
  const ahtSec = d.avgHandleTimeSec % 60;
  const ahtLabel = `${ahtMin}m ${ahtSec.toString().padStart(2, '0')}s`;

  return (
    <div className={`analytics-bar analytics-bar--voice${darkMode ? ' analytics-bar--dark' : ''}`}>

      {/* ── Call outcomes donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Call Outcomes</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.callOutcomes} size={64} thickness={11} darkMode={darkMode} />
            <div className="analytics-donut-center">
              <span className="analytics-donut-center__big">{total}</span>
              <span className="analytics-donut-center__small">30d</span>
            </div>
          </div>
          <Legend items={d.callOutcomes} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Call type mix ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Call Type Mix</div>
        <div className="analytics-section__content">
          <StackBar segments={d.callTypes} height={8} />
          <Legend items={d.callTypes} />
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

      {/* ── 7-day trend sparklines ── */}
      <div className="analytics-section analytics-section--sparklines">
        <div className="analytics-section__title">7-Day Trend</div>
        <div className="analytics-section__content">
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">Volume</span>
            <Sparkline values={d.volumeTrend} color="#00a0d1" width={84} height={28} />
          </div>
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">AHT (sec)</span>
            <Sparkline values={d.ahtTrend} color="#a78bfa" width={84} height={28} />
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Open cases ── */}
      <div className="analytics-section analytics-section--cases">
        <div className="analytics-section__title">Open Cases</div>
        <div className="analytics-section__content">
          <div className="analytics-cases-list">
            {d.openCases.map(c => (
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
          <KpiTile label="Avg Handle Time" value={ahtLabel}           accent="#00a0d1" />
          <KpiTile label="SLA Met"         value={`${d.slaMet}%`}    accent="#00c389" />
          <KpiTile label="CSAT"            value={d.csat.toFixed(1)} sub="out of 5" accent="#a78bfa" />
          <KpiTile label="Calls (30d)"     value={d.totalCalls30d}   accent="#f5a623" />
        </div>
      </div>

    </div>
  );
};

VoiceAnalyticsBar.propTypes = {
  darkMode: PropTypes.bool,
  data: PropTypes.object,
};

export default VoiceAnalyticsBar;
