import React from 'react';

/** Donut chart — segments are {label, value, color}. When onSegmentClick is
 * provided the slices become interactive (filter) with active/inactive styling. */
export const Donut = ({ segments, size = 76, thickness = 13, darkMode, onSegmentClick, activeKey }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let angle = -Math.PI / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={darkMode ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'}
        strokeWidth={thickness}
      />
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        if (pct <= 0) return null;
        const start = angle;
        const sweep = pct * 2 * Math.PI;
        const end = start + sweep;
        angle = end;
        const outerR = r + thickness / 2 - 1;
        const innerR = r - thickness / 2 + 1;
        const largeArc = sweep > Math.PI ? 1 : 0;
        const x1o = cx + outerR * Math.cos(start);
        const y1o = cy + outerR * Math.sin(start);
        const x2o = cx + outerR * Math.cos(end);
        const y2o = cy + outerR * Math.sin(end);
        const x1i = cx + innerR * Math.cos(end);
        const y1i = cy + innerR * Math.sin(end);
        const x2i = cx + innerR * Math.cos(start);
        const y2i = cy + innerR * Math.sin(start);
        const d = [
          `M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
          `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
          `L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
          `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
          'Z',
        ].join(' ');
        const clickable = !!onSegmentClick && seg.key != null;
        const isActive = activeKey != null && seg.key === activeKey;
        const isInactive = activeKey != null && seg.key !== activeKey;
        return (
          <path
            key={i}
            d={d}
            fill={seg.color}
            opacity={isInactive ? 0.28 : 1}
            stroke={isActive ? seg.color : 'none'}
            strokeWidth={isActive ? 1.5 : 0}
            style={{ transition: 'all .25s ease', cursor: clickable ? 'pointer' : 'default' }}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `${seg.label}: ${seg.value}` : undefined}
            aria-pressed={clickable ? isActive : undefined}
            onClick={clickable ? (e) => { e.stopPropagation(); onSegmentClick(seg.key); } : undefined}
            onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onSegmentClick(seg.key) : undefined}
          />
        );
      })}
    </svg>
  );
};

/** Sparkline with filled area + end dot. */
export const Sparkline = ({ values, color, width = 92, height = 34 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) =>
    `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`).join(' ');
  const area = [
    `0,${height}`,
    ...values.map((v, i) =>
      `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`),
    `${width},${height}`,
  ].join(' ');
  const lx = ((values.length - 1) * step).toFixed(1);
  const lv = values[values.length - 1];
  const ly = (height - ((lv - min) / range) * (height - 4) - 2).toFixed(1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <polygon points={area} fill={color} fillOpacity="0.15" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill={color} />
    </svg>
  );
};

/** Vertical bar chart for a small categorical series. */
export const BarChart = ({ values, color, width = 92, height = 34 }) => {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  const barW = width / values.length - 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      {values.map((v, i) => {
        const barH = (v / max) * (height - 4);
        return (
          <rect
            key={i}
            x={i * (barW + 2) + 1}
            y={height - barH - 2}
            width={barW}
            height={barH}
            rx="2"
            fill={color}
            opacity="0.85"
            style={{ transition: 'height .4s ease' }}
          />
        );
      })}
    </svg>
  );
};

/** Legend rows with coloured dot + label + count. Clickable when onItemClick set. */
export const Legend = ({ items, onItemClick, activeKey }) => (
  <div className="analytics-legend">
    {items.map((it) => {
      const clickable = !!onItemClick && it.key != null;
      const isActive = activeKey != null && it.key === activeKey;
      const isInactive = activeKey != null && it.key !== activeKey;
      return (
        <span
          key={it.key || it.label}
          className={`analytics-legend__item${clickable ? ' analytics-legend__item--clickable' : ''}${isActive ? ' analytics-legend__item--active' : ''}${isInactive ? ' analytics-legend__item--inactive' : ''}`}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          aria-pressed={clickable ? isActive : undefined}
          onClick={clickable ? (e) => { e.stopPropagation(); onItemClick(it.key); } : undefined}
          onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onItemClick(it.key) : undefined}
        >
          <span className="analytics-legend__dot" style={{ background: it.color }} />
          <span className="analytics-legend__text">{it.label}</span>
          <span className="analytics-legend__count">{it.value}</span>
        </span>
      );
    })}
  </div>
);

/** KPI tile with an accent left border. */
export const KpiTile = ({ label, value, sub, accent }) => (
  <div className="analytics-kpi" style={{ borderLeft: `3px solid ${accent}` }}>
    <div className="analytics-kpi__value" style={{ color: accent }}>{value}</div>
    <div className="analytics-kpi__label">{label}</div>
    {sub && <div className="analytics-kpi__sub">{sub}</div>}
  </div>
);
