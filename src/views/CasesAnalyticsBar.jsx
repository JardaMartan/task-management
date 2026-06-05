import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';

// ─── Inline SVG mini-charts (no external dep) ─────────────────────────────

/** Donut chart — segments as SVG arc paths */
const DonutChart = ({ segments, size = 64, thickness = 11, darkMode }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circumference}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        );
        offset += pct;
        return el;
      })}
      {/* background track */}
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={darkMode ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'}
        strokeWidth={thickness}
        style={{ zIndex: -1 }}
      />
    </svg>
  );
};

/** Sparkline — thin SVG polyline */
const Sparkline = ({ values, color, width = 80, height = 32, darkMode }) => {
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
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <polygon points={areaPoints} fill={color} fillOpacity="0.15" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* last data point dot */}
      {values.length > 0 && (() => {
        const lx = ((values.length - 1) * step).toFixed(1);
        const lv = values[values.length - 1];
        const ly = (height - ((lv - min) / range) * (height - 4) - 2).toFixed(1);
        return <circle cx={lx} cy={ly} r={3} fill={color} />;
      })()}
    </svg>
  );
};

/** Horizontal stacked bar */
const StackBar = ({ segments, height = 8, radius = 4, darkMode }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div style={{ display: 'flex', height, borderRadius: radius, overflow: 'hidden', gap: 1 }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          title={`${seg.label}: ${seg.value}`}
          style={{
            flex: total > 0 ? seg.value / total : 0,
            background: seg.color,
            transition: 'flex 0.4s ease',
          }}
        />
      ))}
    </div>
  );
};

// ─── KPI tile ──────────────────────────────────────────────────────────────

const KpiTile = ({ label, value, sub, accent, darkMode }) => (
  <div className="analytics-kpi" style={{ borderLeft: `3px solid ${accent}` }}>
    <div className="analytics-kpi__value" style={{ color: accent }}>{value}</div>
    <div className="analytics-kpi__label">{label}</div>
    {sub && <div className="analytics-kpi__sub">{sub}</div>}
  </div>
);

// ─── Legend row ────────────────────────────────────────────────────────────

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

// ─── Main component ────────────────────────────────────────────────────────

/**
 * CasesAnalyticsBar — horizontal analytics strip above the case list.
 * Shows KPIs relevant to contact-centre case management:
 * - Status distribution donut
 * - Priority stack bar
 * - Category breakdown
 * - New-case volume trend sparkline
 * - Resolution time trend sparkline
 * - SLA compliance, FCR, CSAT KPIs
 */
const CasesAnalyticsBar = ({ darkMode, data: dataProp }) => {
  const { locale } = useI18n();
  const d = dataProp || getMockData(locale).analytics.cases;

  return (
    <div className={`analytics-bar analytics-bar--cases${darkMode ? ' analytics-bar--dark' : ''}`}>

      {/* ── Status donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Case Status</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.byStatus} size={64} thickness={11} darkMode={darkMode} />
            <div className="analytics-donut-center">
              <span className="analytics-donut-center__big">{d.total}</span>
              <span className="analytics-donut-center__small">total</span>
            </div>
          </div>
          <Legend items={d.byStatus} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Priority stack ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Priority</div>
        <div className="analytics-section__content">
          <StackBar segments={d.byPriority} height={8} darkMode={darkMode} />
          <Legend items={d.byPriority} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Category donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">Category</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.byCategory} size={56} thickness={10} darkMode={darkMode} />
          </div>
          <Legend items={d.byCategory} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Trend sparklines ── */}
      <div className="analytics-section analytics-section--sparklines">
        <div className="analytics-section__title">7-Day Trend</div>
        <div className="analytics-section__content">
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">New cases</span>
            <Sparkline values={d.trend} color="#00a0d1" width={84} height={28} darkMode={darkMode} />
          </div>
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">Res. time (h)</span>
            <Sparkline values={d.resolutionTrend} color="#f5a623" width={84} height={28} darkMode={darkMode} />
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── KPI tiles ── */}
      <div className="analytics-section analytics-section--kpis">
        <div className="analytics-section__title">KPIs</div>
        <div className="analytics-section__content analytics-kpi-grid">
          <KpiTile label="SLA Met" value={`${Math.round((d.slaMet / (d.slaMet + d.slaBreached)) * 100)}%`} accent="#4ade80" />
          <KpiTile label="FCR" value={`${d.fcr}%`} sub="First Contact" accent="#60a5fa" />
          <KpiTile label="CSAT" value={d.csat.toFixed(1)} sub="out of 5" accent="#a78bfa" />
          <KpiTile label="Avg. Resolve" value={`${d.avgResolutionH}h`} accent="#f5a623" />
        </div>
      </div>

    </div>
  );
};

CasesAnalyticsBar.propTypes = {
  darkMode: PropTypes.bool,
  data: PropTypes.object,
};

export default CasesAnalyticsBar;
