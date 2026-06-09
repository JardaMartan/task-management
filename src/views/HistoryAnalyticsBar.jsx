import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';
import { setAnalyticsTrendDays } from '../store/slices/widgetSlice';
// ─── Inline SVG mini-charts ────────────────────────────────────────────────

/** Donut chart — path-based so each segment has a precise hit area */
const DonutChart = ({ segments, size = 80, thickness = 14, darkMode, onSegmentClick, activeKey }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const [hoveredIdx, setHoveredIdx] = React.useState(null);
  let cumulativeAngle = -Math.PI / 2; // start from 12 o'clock

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" style={{ overflow: 'visible' }}>
      {/* Background track */}
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke={darkMode ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'}
        strokeWidth={thickness} />

      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        if (pct <= 0) return null;

        const startAngle = cumulativeAngle;
        const sweep = pct * 2 * Math.PI;
        const endAngle = startAngle + sweep;
        cumulativeAngle = endAngle;

        const isActive   = activeKey != null && seg.key === activeKey;
        const isInactive = activeKey != null && seg.key !== activeKey;
        const isHovered  = hoveredIdx === i;
        const clickable  = !!onSegmentClick && seg.key != null;
        // Glow when active or hovered
        const glow  = isHovered ? `brightness(1.18) drop-shadow(0 0 5px ${seg.color}dd)`
                    : isActive  ? `drop-shadow(0 0 4px ${seg.color}99)` : 'none';

        // Build donut-slice path for exact hit-testing
        const outerR = r + thickness / 2 - 1;
        const innerR = r - thickness / 2 + 1;
        const largeArc = sweep > Math.PI ? 1 : 0;
        const x1o = cx + outerR * Math.cos(startAngle);
        const y1o = cy + outerR * Math.sin(startAngle);
        const x2o = cx + outerR * Math.cos(endAngle);
        const y2o = cy + outerR * Math.sin(endAngle);
        const x1i = cx + innerR * Math.cos(endAngle);
        const y1i = cy + innerR * Math.sin(endAngle);
        const x2i = cx + innerR * Math.cos(startAngle);
        const y2i = cy + innerR * Math.sin(startAngle);
        const pathD = [
          `M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
          `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
          `L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
          `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
          'Z',
        ].join(' ');

        return (
          <path
            key={i}
            d={pathD}
            fill={seg.color}
            opacity={isInactive && !isHovered ? 0.25 : 1}
            strokeWidth={isActive ? 1.5 : 0}
            stroke={isActive ? seg.color : 'none'}
            style={{
              cursor: 'pointer',
              transition: 'opacity 0.15s, filter 0.15s',
              filter: glow,
            }}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `${seg.label}: ${seg.value}` : undefined}
            aria-pressed={clickable ? isActive : undefined}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={clickable ? (e) => { e.stopPropagation(); onSegmentClick(isActive ? null : seg.key); } : undefined}
            onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onSegmentClick(isActive ? null : seg.key) : undefined}
          />
        );
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

// ─── Legend ────────────────────────────────────────────────────────────────

const Legend = ({ items, onItemClick, activeKey }) => (
  <div className="analytics-legend">
    {items.map((it) => {
      const isActive = activeKey != null && it.key === activeKey;
      const isInactive = activeKey != null && it.key !== activeKey;
      const clickable = !!onItemClick && it.key != null;
      return (
        <span
          key={it.label}
          className={`analytics-legend__item${clickable ? ' analytics-legend__item--clickable' : ''}${isActive ? ' analytics-legend__item--active' : ''}${isInactive ? ' analytics-legend__item--inactive' : ''}`}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onClick={clickable ? (e) => { e.stopPropagation(); onItemClick(isActive ? null : it.key); } : undefined}
          onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onItemClick(isActive ? null : it.key) : undefined}
          title={clickable ? (isActive ? 'Clear filter' : `Filter by ${it.label}`) : undefined}
          aria-pressed={clickable ? isActive : undefined}
        >
          <span className="analytics-legend__dot" style={{ background: it.color }} />
          <span className="analytics-legend__text">{it.label}</span>
          <span className="analytics-legend__count">{it.value}</span>
        </span>
      );
    })}
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

// ─── Trend period selector ────────────────────────────────────────────────

const TREND_DAYS = [90, 30, 7];

const TrendPeriodSelector = ({ days, onChange }) => {
  const { t } = useI18n();
  return (
    <div className="analytics-trend-period">
      {TREND_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          className={`analytics-trend-period__btn${days === d ? ' analytics-trend-period__btn--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onChange(d); }}
          aria-pressed={days === d}
        >
          {t('analytics.trendDays', { days: d })}
        </button>
      ))}
    </div>
  );
};

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
const HistoryAnalyticsBar = ({ darkMode, data: dataProp, onFilterChange, activeFilters = {} }) => {
  const { locale, t } = useI18n();
  const dispatch = useDispatch();
  const trendDays = useSelector((state) => state.widget.analyticsTrendDays);
  const d = dataProp || getMockData(locale).analytics.history;
  const weekdays = [
    t('analytics.weekday.mon'), t('analytics.weekday.tue'), t('analytics.weekday.wed'),
    t('analytics.weekday.thu'), t('analytics.weekday.fri'), t('analytics.weekday.sat'),
    t('analytics.weekday.sun'),
  ];

  return (
    <div className={`analytics-bar analytics-bar--history${darkMode ? ' analytics-bar--dark' : ''}`}>

      {/* ── Channel mix donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.channelMix')}</div>
        <div
          className="analytics-section__content analytics-section__content--row"
          onClick={onFilterChange && activeFilters.channel ? () => onFilterChange({ type: 'channel', key: null }) : undefined}
          style={onFilterChange && activeFilters.channel ? { cursor: 'pointer' } : undefined}
          title={onFilterChange && activeFilters.channel ? 'Click to clear channel filter' : undefined}
        >
          <div className="analytics-donut-wrap">
            <DonutChart
              segments={d.byChannel}
              size={64}
              thickness={11}
              darkMode={darkMode}
              onSegmentClick={onFilterChange ? (key) => onFilterChange({ type: 'channel', key }) : undefined}
              activeKey={activeFilters.channel || null}
            />
            <div className="analytics-donut-center">
              <span className="analytics-donut-center__big">{d.totalInteractions}</span>
              <span className="analytics-donut-center__small">{t('analytics.total')}</span>
            </div>
          </div>
          <Legend
            items={d.byChannel}
            onItemClick={onFilterChange ? (key) => onFilterChange({ type: 'channel', key }) : undefined}
            activeKey={activeFilters.channel || null}
          />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Outcome stack ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.outcomes')}</div>
        <div className="analytics-section__content">
          <StackBar segments={d.byOutcome} height={8} />
          <Legend items={d.byOutcome} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Sentiment donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.sentiment')}</div>
        <div
          className="analytics-section__content analytics-section__content--row"
          onClick={onFilterChange && activeFilters.sentiment ? () => onFilterChange({ type: 'sentiment', key: null }) : undefined}
          style={onFilterChange && activeFilters.sentiment ? { cursor: 'pointer' } : undefined}
          title={onFilterChange && activeFilters.sentiment ? 'Click to clear sentiment filter' : undefined}
        >
          <DonutChart
            segments={d.sentiment}
            size={56}
            thickness={10}
            darkMode={darkMode}
            onSegmentClick={onFilterChange ? (key) => onFilterChange({ type: 'sentiment', key }) : undefined}
            activeKey={activeFilters.sentiment || null}
          />
          <Legend
            items={d.sentiment}
            onItemClick={onFilterChange ? (key) => onFilterChange({ type: 'sentiment', key }) : undefined}
            activeKey={activeFilters.sentiment || null}
          />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Weekday pattern ── */}
      <div className="analytics-section analytics-section--sparklines">
        <div className="analytics-section__title">{t('analytics.byWeekday')}</div>
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
        <div className="analytics-section__title analytics-section__title--with-controls">
          {t('analytics.trend')}
          <TrendPeriodSelector days={trendDays} onChange={(d) => dispatch(setAnalyticsTrendDays(d))} />
        </div>
        <div className="analytics-section__content">
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">{t('analytics.volume')}</span>
            <Sparkline values={d.volumeTrend.slice(-trendDays)} color="#4ade80" width={84} height={28} />
          </div>
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">{t('analytics.aht')}</span>
            <Sparkline values={d.ahtTrend.slice(-trendDays)} color="#fbbf24" width={84} height={28} />
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── KPIs ── */}
      <div className="analytics-section analytics-section--kpis">
        <div className="analytics-section__title">{t('analytics.kpis')}</div>
        <div className="analytics-section__content analytics-kpi-grid">
          <KpiTile label={t('analytics.kpi.resolution')}    value={`${d.resolutionRate}%`}    accent="#4ade80" />
          <KpiTile label={t('analytics.kpi.escalation')}    value={`${d.escalationRate}%`}    accent="#f5a623" />
          <KpiTile label={t('analytics.kpi.repeatContact')} value={`${d.repeatContactRate}%`} accent="#e8453c" />
          <KpiTile label={t('analytics.kpi.avgAht')}        value={`${d.avgHandleTimeMin}m`}  sub={t('analytics.kpi.handleTime')} accent="#60a5fa" />
        </div>
      </div>

    </div>
  );
};

HistoryAnalyticsBar.propTypes = {
  darkMode: PropTypes.bool,
  data: PropTypes.object,
  onFilterChange: PropTypes.func,
  activeFilters: PropTypes.object,
};

export default HistoryAnalyticsBar;
