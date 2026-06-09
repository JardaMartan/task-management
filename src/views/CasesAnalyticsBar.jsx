import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { getMockData } from '../mock/mockData';
import { setAnalyticsTrendDays } from '../store/slices/widgetSlice';

// ─── Interactive DonutChart — path-based for precise hit-testing ──────────

const DonutChart = ({ segments, size = 80, thickness = 14, darkMode, onSegmentClick, activeKey }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const [hoveredIdx, setHoveredIdx] = React.useState(null);
  let cumulativeAngle = -Math.PI / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" style={{ overflow: 'visible' }}>
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
        const glow  = isHovered ? `brightness(1.18) drop-shadow(0 0 5px ${seg.color}dd)`
                    : isActive  ? `drop-shadow(0 0 4px ${seg.color}99)` : 'none';

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

// ─── Interactive stacked bar ──────────────────────────────────────────────

const StackBar = ({ segments, height = 8, radius = 4, onSegmentClick, activeKey }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const [hoveredKey, setHoveredKey] = React.useState(null);
  return (
    <div style={{ display: 'flex', height, borderRadius: radius, overflow: 'hidden', gap: 1 }}>
      {segments.map((seg, i) => {
        const isActive   = activeKey != null && seg.key === activeKey;
        const isInactive = activeKey != null && seg.key !== activeKey;
        const isHovered  = hoveredKey === seg.key;
        const clickable  = !!onSegmentClick && seg.key != null;
        return (
          <div
            key={i}
            title={`${seg.label}: ${seg.value}`}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `${seg.label}: ${seg.value}` : undefined}
            aria-pressed={clickable ? isActive : undefined}
            style={{
              flex: total > 0 ? seg.value / total : 0,
              background: seg.color,
              transition: 'flex 0.4s ease, opacity 0.15s, transform 0.15s',
              opacity: isInactive && !isHovered ? 0.25 : 1,
              transform: isHovered || isActive ? 'scaleY(1.5)' : 'scaleY(1)',
              transformOrigin: 'center',
              cursor: clickable ? 'pointer' : undefined,
            }}
            onMouseEnter={() => clickable && setHoveredKey(seg.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={clickable ? (e) => { e.stopPropagation(); onSegmentClick(isActive ? null : seg.key); } : undefined}
            onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onSegmentClick(isActive ? null : seg.key) : undefined}
          />
        );
      })}
    </div>
  );
};

// ─── Sparkline ────────────────────────────────────────────────────────────

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

// ─── Interactive legend ───────────────────────────────────────────────────

const Legend = ({ items, onItemClick, activeKey }) => (
  <div className="analytics-legend">
    {items.map((it) => {
      const isActive   = activeKey != null && it.key === activeKey;
      const isInactive = activeKey != null && it.key !== activeKey;
      const clickable  = !!onItemClick && it.key != null;
      return (
        <span
          key={it.key || it.label}
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
 * CasesAnalyticsBar — interactive analytics strip above the case list.
 * Clicking donut segments or legend items quick-filters the case list via onFilterChange.
 * Shows: status distribution, priority stack, category breakdown, trend sparklines, KPIs.
 */
const CasesAnalyticsBar = ({ darkMode, data: dataProp, onFilterChange, activeFilters = {} }) => {
  const { locale, t } = useI18n();
  const dispatch = useDispatch();
  const trendDays = useSelector((state) => state.widget.analyticsTrendDays);
  const d = dataProp || getMockData(locale).analytics.cases;

  return (
    <div className={`analytics-bar analytics-bar--cases${darkMode ? ' analytics-bar--dark' : ''}`}>

      {/* ── Status donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.caseStatus') || 'Case Status'}</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart
              segments={d.byStatus}
              size={64}
              thickness={11}
              darkMode={darkMode}
              onSegmentClick={onFilterChange ? (key) => onFilterChange({ type: 'status', key }) : undefined}
              activeKey={activeFilters.status || null}
            />
            <div className="analytics-donut-center">
              <span className="analytics-donut-center__big">{d.total}</span>
              <span className="analytics-donut-center__small">{t('analytics.total')}</span>
            </div>
          </div>
          <Legend
            items={d.byStatus}
            onItemClick={onFilterChange ? (key) => onFilterChange({ type: 'status', key }) : undefined}
            activeKey={activeFilters.status || null}
          />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Priority stack + legend ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.priority') || 'Priority'}</div>
        <div className="analytics-section__content">
          <StackBar
            segments={d.byPriority}
            height={8}
            onSegmentClick={onFilterChange ? (key) => onFilterChange({ type: 'priority', key }) : undefined}
            activeKey={activeFilters.priority || null}
          />
          <Legend
            items={d.byPriority}
            onItemClick={onFilterChange ? (key) => onFilterChange({ type: 'priority', key }) : undefined}
            activeKey={activeFilters.priority || null}
          />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Category donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.category') || 'Category'}</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart
              segments={d.byCategory}
              size={56}
              thickness={10}
              darkMode={darkMode}
              onSegmentClick={onFilterChange ? (key) => onFilterChange({ type: 'category', key }) : undefined}
              activeKey={activeFilters.category || null}
            />
          </div>
          <Legend
            items={d.byCategory}
            onItemClick={onFilterChange ? (key) => onFilterChange({ type: 'category', key }) : undefined}
            activeKey={activeFilters.category || null}
          />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Trend sparklines ── */}
      <div className="analytics-section analytics-section--sparklines">
        <div className="analytics-section__title analytics-section__title--with-controls">
          {t('analytics.trend')}
          <TrendPeriodSelector days={trendDays} onChange={(d) => dispatch(setAnalyticsTrendDays(d))} />
        </div>
        <div className="analytics-section__content">
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">{t('analytics.cases.newCases') || 'New cases'}</span>
            <Sparkline values={d.trend.slice(-trendDays)} color="#00a0d1" width={84} height={28} />
          </div>
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">{t('analytics.cases.resTime') || 'Res. time (h)'}</span>
            <Sparkline values={d.resolutionTrend.slice(-trendDays)} color="#f5a623" width={84} height={28} />
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── KPI tiles ── */}
      <div className="analytics-section analytics-section--kpis">
        <div className="analytics-section__title">{t('analytics.kpis')}</div>
        <div className="analytics-section__content analytics-kpi-grid">
          <KpiTile
            label={t('analytics.cases.kpi.slaMet') || 'SLA Met'}
            value={`${d.slaMet > 0 || d.slaBreached > 0 ? Math.round((d.slaMet / (d.slaMet + d.slaBreached)) * 100) : 0}%`}
            accent="#4ade80"
          />
          <KpiTile
            label={t('analytics.cases.kpi.fcr') || 'FCR'}
            value={`${d.fcr}%`}
            sub={t('analytics.cases.kpi.firstContact') || 'First Contact'}
            accent="#60a5fa"
          />
          <KpiTile
            label={t('analytics.cases.kpi.csat') || 'CSAT'}
            value={(d.csat || 0).toFixed(1)}
            sub={t('analytics.cases.kpi.outOf5') || 'out of 5'}
            accent="#a78bfa"
          />
          <KpiTile
            label={t('analytics.cases.kpi.avgResolve') || 'Avg. Resolve'}
            value={`${d.avgResolutionH}h`}
            accent="#f5a623"
          />
        </div>
      </div>

    </div>
  );
};

CasesAnalyticsBar.propTypes = {
  darkMode: PropTypes.bool,
  data: PropTypes.object,
  onFilterChange: PropTypes.func,
  activeFilters: PropTypes.object,
};

export default CasesAnalyticsBar;
