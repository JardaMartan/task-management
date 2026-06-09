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
        const x1o = cx + outerR * Math.cos(startAngle); const y1o = cy + outerR * Math.sin(startAngle);
        const x2o = cx + outerR * Math.cos(endAngle);   const y2o = cy + outerR * Math.sin(endAngle);
        const x1i = cx + innerR * Math.cos(endAngle);   const y1i = cy + innerR * Math.sin(endAngle);
        const x2i = cx + innerR * Math.cos(startAngle); const y2i = cy + innerR * Math.sin(startAngle);
        const pathD = [`M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`, `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`, `L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`, `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)}`, 'Z'].join(' ');
        return (
          <path key={i} d={pathD} fill={seg.color}
            opacity={isInactive && !isHovered ? 0.25 : 1}
            strokeWidth={isHovered ? 2.5 : isActive ? 1.5 : 0} stroke={(isHovered || isActive) ? seg.color : 'none'}
            style={{ cursor: clickable ? 'pointer' : 'default', transition: 'opacity 0.15s, filter 0.15s', filter: glow }}
            role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `${seg.label}: ${seg.value}` : undefined}
            aria-pressed={clickable ? isActive : undefined}
            onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
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
          <div key={i} title={`${seg.label}: ${seg.value}`}
            role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `${seg.label}: ${seg.value}` : undefined}
            aria-pressed={clickable ? isActive : undefined}
            style={{ flex: total > 0 ? seg.value / total : 0, background: seg.color,
              transition: 'flex 0.4s ease, opacity 0.15s, transform 0.15s',
              opacity: isInactive && !isHovered ? 0.25 : 1,
              transform: isHovered || isActive ? 'scaleY(1.5)' : 'scaleY(1)',
              transformOrigin: 'center', cursor: clickable ? 'pointer' : undefined }}
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

const Sparkline = ({ values, color, width = 84, height = 28 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values), range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = (v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`;
  const points = values.map(pts).join(' ');
  const area = [`0,${height}`, ...values.map(pts), `${width},${height}`].join(' ');
  const lx = ((values.length - 1) * step).toFixed(1);
  const ly = (height - ((values[values.length - 1] - min) / range) * (height - 4) - 2).toFixed(1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <polygon points={area} fill={color} fillOpacity="0.14" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        <span key={it.key || it.label}
          className={`analytics-legend__item${clickable ? ' analytics-legend__item--clickable' : ''}${isActive ? ' analytics-legend__item--active' : ''}${isInactive ? ' analytics-legend__item--inactive' : ''}`}
          role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
          onClick={clickable ? () => onItemClick(isActive ? null : it.key) : undefined}
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

// ─── Case badge ────────────────────────────────────────────────────────────

const CaseBadge = ({ caseItem, onCaseClick }) => (
  <div
    className={`analytics-case-badge${onCaseClick ? ' analytics-case-badge--clickable' : ''}`}
    style={{ borderLeft: `3px solid ${caseItem.color}`, cursor: onCaseClick ? 'pointer' : 'default' }}
    role={onCaseClick ? 'button' : undefined}
    tabIndex={onCaseClick ? 0 : undefined}
    onClick={onCaseClick ? () => onCaseClick(caseItem.id) : undefined}
    onKeyDown={onCaseClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onCaseClick(caseItem.id) : undefined}
  >
    <span className="analytics-case-badge__id" style={{ color: caseItem.color }}>{caseItem.id}</span>
    <span className="analytics-case-badge__topic">{caseItem.topic}</span>
    <span className="analytics-case-badge__meta">{caseItem.status} · {caseItem.priority}</span>
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
 * VoiceAnalyticsBar — interactive analytics strip above the voice call list.
 * onFilterChange({ type: 'outcome'|'direction'|'sentiment', key })
 */
const VoiceAnalyticsBar = ({ darkMode, data: dataProp, onFilterChange, activeFilters = {}, onCaseClick }) => {
  const { locale, t } = useI18n();
  const dispatch = useDispatch();
  const trendDays = useSelector((state) => state.widget.analyticsTrendDays);
  const d = dataProp || getMockData(locale).analytics.voice;
  const total = d.callOutcomes.reduce((s, seg) => s + seg.value, 0);
  const ahtMin = Math.floor(d.avgHandleTimeSec / 60);
  const ahtSec = d.avgHandleTimeSec % 60;
  const ahtLabel = `${ahtMin}m ${ahtSec.toString().padStart(2, '0')}s`;

  const handleOutcome   = (key) => onFilterChange?.({ type: 'outcome',   key });
  const handleDirection = (key) => onFilterChange?.({ type: 'direction', key });
  const handleSentiment = (key) => onFilterChange?.({ type: 'sentiment', key });

  return (
    <div className={`analytics-bar analytics-bar--voice${darkMode ? ' analytics-bar--dark' : ''}`}>

      {/* ── Call outcomes donut ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.voice.callOutcomes')}</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.callOutcomes} size={80} thickness={14} darkMode={darkMode}
              onSegmentClick={handleOutcome} activeKey={activeFilters.outcome} />
            <div className="analytics-donut-center">
              <span className="analytics-donut-center__big">{total}</span>
              <span className="analytics-donut-center__small">{trendDays}d</span>
            </div>
          </div>
          <Legend items={d.callOutcomes} onItemClick={handleOutcome} activeKey={activeFilters.outcome} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Call type mix ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.voice.callTypeMix')}</div>
        <div className="analytics-section__content">
          <StackBar segments={d.callTypes} height={8}
            onSegmentClick={handleDirection} activeKey={activeFilters.direction} />
          <Legend items={d.callTypes} onItemClick={handleDirection} activeKey={activeFilters.direction} />
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Sentiment ── */}
      <div className="analytics-section">
        <div className="analytics-section__title">{t('analytics.sentiment')}</div>
        <div className="analytics-section__content analytics-section__content--row">
          <div className="analytics-donut-wrap">
            <DonutChart segments={d.sentiment} size={68} thickness={12} darkMode={darkMode}
              onSegmentClick={handleSentiment} activeKey={activeFilters.sentiment} />
          </div>
          <Legend items={d.sentiment} onItemClick={handleSentiment} activeKey={activeFilters.sentiment} />
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
            <span className="analytics-sparkline-label">{t('analytics.volume')}</span>
            <Sparkline values={d.volumeTrend.slice(-trendDays)} color="#00a0d1" width={84} height={28} />
          </div>
          <div className="analytics-sparkline-row">
            <span className="analytics-sparkline-label">{t('analytics.voice.ahtSec')}</span>
            <Sparkline values={d.ahtTrend.slice(-trendDays)} color="#a78bfa" width={84} height={28} />
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── Open cases ── */}
      <div className="analytics-section analytics-section--cases">
        <div className="analytics-section__title">{t('analytics.openCases')}</div>
        <div className="analytics-section__content">
          <div className="analytics-cases-list">
            {d.openCases.map(c => <CaseBadge key={c.id} caseItem={c} onCaseClick={onCaseClick} />)}
          </div>
        </div>
      </div>

      <div className="analytics-divider" />

      {/* ── KPIs ── */}
      <div className="analytics-section analytics-section--kpis">
        <div className="analytics-section__title">{t('analytics.kpis')}</div>
        <div className="analytics-section__content analytics-kpi-grid">
          <KpiTile label={t('analytics.voice.kpi.avgHandleTime')} value={ahtLabel}           accent="#00a0d1" />
          <KpiTile label={t('analytics.voice.kpi.slaMet')}        value={`${d.slaMet}%`}    accent="#00c389" />
          <KpiTile label={t('analytics.voice.kpi.csat')}          value={d.csat.toFixed(1)} sub={t('analytics.cases.kpi.outOf5')} accent="#a78bfa" />
          <KpiTile label={t('analytics.voice.kpi.calls')}         value={d.totalCalls30d}   accent="#f5a623" />
        </div>
      </div>

    </div>
  );
};

VoiceAnalyticsBar.propTypes = {
  darkMode: PropTypes.bool,
  data: PropTypes.object,
  onFilterChange: PropTypes.func,
  activeFilters: PropTypes.object,
  onCaseClick: PropTypes.func,
};

export default VoiceAnalyticsBar;
