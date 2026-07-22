import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatClock, formatDuration } from '../format';
import { useViewport } from '../useViewport';
import ZoomControls from './ZoomControls';

const CHANNEL_COLORS = {
  email: '#0e7fc1', chat: '#1a7f37', voice: '#9854cb', telephony: '#9854cb',
  social: '#17a2b8', custom: '#e0559b', sms: '#f5a623', workitem: '#c1440e',
  unknown: '#97a4b1',
};
const ROW_H = 46;

/**
 * Dependency-free swim-lane timeline. Consumes the vis-timeline-compatible model
 * from buildTimeline(); can be replaced by a vis-timeline instance driven by the
 * same { groups, items } without changing callers.
 */
export default function ActivityTimeline({ timeline, mode }) {
  const { t } = useI18n();
  const plotRef = useRef(null);

  const bounds = useMemo(() => {
    if (!timeline || !timeline.bounds || timeline.groups.length === 0) return null;
    const { min, max } = timeline.bounds;
    const nowMs = Date.now();
    const viewMax = mode === 'live' ? Math.max(max, nowMs) : max;
    const pad = Math.max((viewMax - min) * 0.03, 30 * 1000);
    return { vMin: min - pad, vMax: viewMax + pad, nowMs };
  }, [timeline, mode]);

  const vp = useViewport(bounds ? bounds.vMin : 0, bounds ? bounds.vMax : 1, plotRef);

  if (!bounds) {
    return <div className="timeline timeline--empty">{t('app.noData')}</div>;
  }

  const nowMs = bounds.nowMs;
  const pct = vp.pct;
  const ticks = [];
  for (let i = 0; i <= 6; i++) {
    const ms = vp.start + (vp.span * i) / 6;
    ticks.push({ leftPct: (i / 6) * 100, label: formatClock(ms) });
  }
  const groups = timeline.groups;

  return (
    <section className="timeline" aria-label={t('timeline.title')}>
      <div className="timeline__head">
        <h3 className="timeline__title">{t('timeline.title')}</h3>
        <div className="timeline__head-right">
          <Legend t={t} />
          <ZoomControls vp={vp} />
        </div>
      </div>

      <div className="timeline__grid">
        {/* Left gutter: interaction labels */}
        <div className="timeline__gutter" style={{ height: groups.length * ROW_H + 24 }}>
          <div className="timeline__gutter-head">{t('timeline.interactionsAxis')}</div>
          {groups.map((g) => {
            const m = timeline.byInteraction[g.id] || {};
            const focusPct = m.handleMs ? Math.round((m.focusMs / m.handleMs) * 100) : 0;
            return (
              <div className="lane-label" key={g.id} style={{ height: ROW_H }} title={g.id}>
                <span className="lane-label__chip" style={{ background: CHANNEL_COLORS[g.channel] || CHANNEL_COLORS.unknown }} />
                <div className="lane-label__body">
                  <div className="lane-label__line1">
                    <span className="lane-label__channel">{t(`channel.${g.channel}`) || g.channel}</span>
                    {m.customer && <span className="lane-label__cust">{m.customer}</span>}
                    {m.open && <span className="meta-chip meta-chip--live lane-label__live">{t('controls.live')}</span>}
                  </div>
                  <div className="lane-label__meta">
                    <span
                      className="meta-chip meta-chip--time"
                      title={`${t('timeline.tooltipHandle')}: ${formatDuration(m.handleMs)} · ${t('timeline.tooltipFocus')}: ${formatDuration(m.focusMs)} (${focusPct}%)`}
                    >
                      <span className="meta-chip__total">{formatDuration(m.handleMs)}</span>
                      <span className="meta-chip__sep">·</span>
                      <span className="meta-chip__focus">{formatDuration(m.focusMs)} {t('timeline.focusShort')}</span>
                    </span>
                    {m.interruptions > 0 && (
                      <span className="meta-chip meta-chip--intr" title={t('timeline.tooltipInterruptions')}>
                        {m.interruptions} {t('timeline.interruptionsShort')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Plot area */}
        <div className="timeline__plot timeline__plot--interactive" ref={plotRef} style={{ height: groups.length * ROW_H + 24 }}>
          {/* axis ticks */}
          <div className="timeline__axis">
            {ticks.map((tick, i) => (
              <span className="timeline__tick" key={i} style={{ left: `${tick.leftPct}%` }}>{tick.label}</span>
            ))}
          </div>
          {/* gridlines */}
          {ticks.map((tick, i) => (
            <span className="timeline__gridline" key={`gl-${i}`} style={{ left: `${tick.leftPct}%` }} />
          ))}

          {/* rows */}
          {groups.map((g, rowIdx) => (
            <div className="lane-row" key={g.id} style={{ top: 24 + rowIdx * ROW_H, height: ROW_H }} />
          ))}

          {/* items */}
          {timeline.items.map((item) => renderItem(item, groups, pct, timeline.byInteraction, t))}

          {/* per-interaction handle-time labels at the end of each finished bar */}
          {groups.map((g, rowIdx) => {
            const m = timeline.byInteraction[g.id];
            if (!m || m.open) return null;
            const endPct = pct(m.endMs);
            if (endPct > 92) return null;
            return (
              <span
                key={`${g.id}-endlabel`}
                className="ti-endlabel"
                style={{ left: `${endPct}%`, top: 24 + rowIdx * ROW_H + ROW_H / 2 }}
              >
                {formatDuration(m.handleMs)}
              </span>
            );
          })}

          {/* now marker (live) */}
          {mode === 'live' && (
            <span className="timeline__now" style={{ left: `${pct(nowMs)}%` }} title={t('timeline.now')}>
              <span className="timeline__now-label">{t('timeline.now')}</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function renderItem(item, groups, pct, byInteraction, t) {
  const rowIdx = groups.findIndex((g) => g.id === item.group);
  if (rowIdx < 0) return null;
  const top = 24 + rowIdx * ROW_H;

  if (item.type === 'interruption') {
    return (
      <span
        key={item.id}
        className="ti-interruption"
        style={{ left: `${pct(item.start)}%`, top: top + ROW_H / 2 }}
        title={t('timeline.interruption')}
      />
    );
  }

  const left = pct(item.start);
  const right = pct(item.end != null ? item.end : item.start);
  const width = Math.max(right - left, 0.4);
  const meta = byInteraction[item.group];
  const title = meta
    ? [
        `${t('timeline.tooltipChannel')}: ${t(`channel.${meta.channel}`) || meta.channel}`,
        meta.customer ? `${t('timeline.tooltipCustomer')}: ${meta.customer}` : null,
        `${t('timeline.tooltipHandle')}: ${formatDuration(meta.handleMs)}`,
        `${t('timeline.tooltipFocus')}: ${formatDuration(meta.focusMs)}`,
        `${t('timeline.tooltipInterruptions')}: ${meta.interruptions}`,
      ].filter(Boolean).join('\n')
    : undefined;

  const cls = item.type === 'active' ? 'ti-active'
    : item.type === 'focus' ? 'ti-focus'
    : item.type === 'wrapup' ? 'ti-wrapup'
    : 'ti-active';

  const channel = meta ? meta.channel : 'unknown';
  const bg = item.type === 'focus' ? (CHANNEL_COLORS[channel] || CHANNEL_COLORS.unknown) : undefined;

  return (
    <span
      key={item.id}
      className={`ti ${cls}`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: top + (item.type === 'active' ? 6 : item.type === 'focus' ? 9 : 6),
        height: item.type === 'active' ? ROW_H - 12 : item.type === 'focus' ? ROW_H - 18 : ROW_H - 12,
        ...(bg ? { background: bg } : {}),
      }}
      title={title}
    />
  );
}

function Legend({ t }) {
  return (
    <div className="legend">
      <span className="legend__item"><span className="legend__swatch sw-focus" />{t('timeline.focused')}</span>
      <span className="legend__item"><span className="legend__swatch sw-active" />{t('timeline.active')}</span>
      <span className="legend__item"><span className="legend__swatch sw-wrapup" />{t('timeline.wrapup')}</span>
      <span className="legend__item"><span className="legend__swatch sw-intr" />{t('timeline.interruption')}</span>
    </div>
  );
}

ActivityTimeline.propTypes = {
  timeline: PropTypes.object,
  mode: PropTypes.string,
};
