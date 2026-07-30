import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatClock, formatDuration } from '../format';
import { buildTicks } from '../axis';
import { stateColor, resolveStateTimeline, stateLabelKey } from '../stateModel';
import { useViewport } from '../useViewport';
import ZoomControls from './ZoomControls';

const CHANNEL_COLORS = {
  email: '#0e7fc1', chat: '#1a7f37', voice: '#9854cb', telephony: '#9854cb',
  social: '#17a2b8', custom: '#e0559b', sms: '#f5a623', workitem: '#c1440e',
  unknown: '#97a4b1',
};
const ROW_H = 56; // per-interaction lane height (fits channel line + metric chips)

const clampPct = (p) => Math.max(0, Math.min(100, p));
const inView = (p) => p >= -0.01 && p <= 100.01;

/**
 * Agent activity timeline: a single shared-zoom viewport with the agent's state
 * (login/logout/status) lane pinned on top of the interaction swim-lanes, so
 * state changes line up in time with task switching. The axis (times + day
 * markers) and the state lane stay visible while the interaction lanes scroll.
 */
export default function ActivityTimeline({ timeline, stateTimeline, mode, onScroll }) {
  const { t } = useI18n();
  const plotRef = useRef(null);

  const stateSegs = useMemo(
    () => resolveStateTimeline(stateTimeline?.segments),
    [stateTimeline],
  );
  const login = stateTimeline?.loginMs != null ? stateTimeline.loginMs : null;
  const logout = stateTimeline?.logoutMs != null ? stateTimeline.logoutMs : null;
  const hasState = login != null || stateSegs.length > 0;

  const bounds = useMemo(() => {
    const nowMs = Date.now();
    let lo = Infinity;
    let hi = -Infinity;
    if (timeline && timeline.bounds) { lo = Math.min(lo, timeline.bounds.min); hi = Math.max(hi, timeline.bounds.max); }
    if (login != null) lo = Math.min(lo, login);
    for (const s of stateSegs) { lo = Math.min(lo, s.startMs); hi = Math.max(hi, s.endMs); }
    const stEnd = logout || (mode === 'live' ? nowMs : (stateSegs.length ? stateSegs[stateSegs.length - 1].endMs : nowMs));
    if (hasState) hi = Math.max(hi, stEnd);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    const viewMax = mode === 'live' ? Math.max(hi, nowMs) : hi;
    const pad = Math.max((viewMax - lo) * 0.03, 30 * 1000);
    return { vMin: lo - pad, vMax: viewMax + pad, nowMs, stEnd };
  }, [timeline, stateSegs, login, logout, hasState, mode]);

  const vp = useViewport(bounds ? bounds.vMin : 0, bounds ? bounds.vMax : 1, plotRef);

  const groups = (timeline && timeline.groups) || [];
  const itemsByGroup = useMemo(() => {
    const m = {};
    for (const g of groups) m[g.id] = [];
    for (const it of (timeline && timeline.items) || []) if (m[it.group]) m[it.group].push(it);
    return m;
  }, [timeline, groups]);

  if (!bounds) {
    return <div className="timeline timeline--empty">{t('app.noData')}</div>;
  }

  const { nowMs, stEnd } = bounds;
  const pct = vp.pct;

  // Adaptive axis ticks: intraday → times, multi-day → dates (no overlap).
  const axisTicks = buildTicks(vp.start, vp.end)
    .map((tk) => ({ ...tk, leftPct: pct(tk.ms) }))
    .filter((tk) => tk.leftPct >= 0 && tk.leftPct <= 100);

  const nowVisible = nowMs >= vp.start && nowMs <= vp.end;

  const grid = (
    <>
      {axisTicks.map((tk, i) => <span className={`atl-grid ${tk.major ? 'atl-grid--day' : ''}`} key={`g${i}`} style={{ left: `${tk.leftPct}%` }} />)}
      {nowVisible && <span className="atl-nowline" style={{ left: `${pct(nowMs)}%` }} />}
    </>
  );

  return (
    <section className="timeline atl" aria-label={t('timeline.title')}>
      <div className="timeline__head">
        <h3 className="timeline__title">{t('timeline.title')}</h3>
        <div className="timeline__head-right">
          <Legend t={t} />
          <ZoomControls vp={vp} />
        </div>
      </div>

      <div className="atl__scroll" onScroll={(e) => onScroll && onScroll(e.currentTarget.scrollTop)}>
        <div className="atl__grid">
          {/* ── Left gutter column (labels) ── */}
          <div className="atl__gutcol">
            <div className="atl__gut atl__gut--axis atl__sticky0">{t('timeline.interactionsAxis')}</div>
            {hasState && (
              <div className="atl__gut atl__gut--state atl__sticky1">
                <span className="atl__gut-title">{t('state.title')}</span>
                {login != null && <span className="atl__gut-sub">{t('state.shiftSince', { time: formatClock(login) })}</span>}
              </div>
            )}
            {groups.map((g) => {
              const m = timeline.byInteraction[g.id] || {};
              const focusPct = m.handleMs ? Math.round((m.focusMs / m.handleMs) * 100) : 0;
              return (
                <div className="atl__gut atl__gut--lane" key={g.id} title={g.id}>
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
                      {m.wrapupMs > 0 && (
                        <span className="meta-chip meta-chip--wrap" title={`${t('timeline.wrapup')}: ${formatDuration(m.wrapupMs)}`}>
                          {formatDuration(m.wrapupMs)} {t('timeline.wrapupShort')}
                        </span>
                      )}
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

          {/* ── Plot column (shared viewport) ── */}
          <div className="atl__plotcol" ref={plotRef}>
            {/* sticky axis: times + day markers */}
            <div className="atl__axis atl__sticky0">
              {grid}
              {axisTicks.map((tk, i) => (
                <span className={tk.major ? 'atl-daylabel' : 'atl-tick'} key={`t${i}`} style={{ left: `${tk.leftPct}%` }}>{tk.label}</span>
              ))}
              {nowVisible && (
                <span className="atl-now-label" style={{ left: `${pct(nowMs)}%` }}>{t('timeline.now')}</span>
              )}
            </div>

            {/* sticky agent-state lane */}
            {hasState && (
              <div className="atl__staterow atl__sticky1">
                {grid}
                {login != null && (() => {
                  const l = clampPct(pct(login));
                  const r = clampPct(pct(stEnd));
                  return r > l ? (
                    <span
                      className="atl-shift"
                      style={{ left: `${l}%`, width: `${r - l}%` }}
                      title={`${t('state.login')} ${formatClock(login)}`}
                    />
                  ) : null;
                })()}
                {stateSegs.map((seg, i) => {
                  const l = clampPct(pct(seg.startMs));
                  const r = clampPct(pct(seg.endMs));
                  if (r <= l) return null;
                  const label = seg.name || t(stateLabelKey(seg.code)) || seg.code;
                  return (
                    <span
                      key={`st${i}`}
                      className="atl-state"
                      style={{ left: `${l}%`, width: `${r - l}%`, background: stateColor(seg.code) }}
                      title={`${label} · ${formatClock(seg.startMs)}–${formatClock(seg.endMs)} (${formatDuration(seg.endMs - seg.startMs)})`}
                    />
                  );
                })}
                {login != null && inView(pct(login)) && <span className="atl-mark atl-mark--login" style={{ left: `${pct(login)}%` }} title={`${t('state.login')} ${formatClock(login)}`} />}
                {(logout || mode === 'live') && inView(pct(stEnd)) && (
                  <span
                    className={`atl-mark ${mode === 'live' ? 'atl-mark--now' : 'atl-mark--logout'}`}
                    style={{ left: `${pct(stEnd)}%` }}
                    title={mode === 'live' ? t('timeline.now') : `${t('state.logout')} ${formatClock(stEnd)}`}
                  />
                )}
              </div>
            )}

            {/* interaction lanes */}
            {groups.map((g) => {
              const m = timeline.byInteraction[g.id] || {};
              const endPct = pct(m.endMs);
              return (
                <div className="atl__lane" key={g.id}>
                  {grid}
                  {(itemsByGroup[g.id] || []).map((item) => renderItem(item, m, pct, t))}
                  {!m.open && endPct <= 92 && inView(endPct) && (
                    <span className="ti-endlabel" style={{ left: `${endPct}%`, top: ROW_H / 2 }}>{formatDuration(m.handleMs)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function renderItem(item, meta, pct, t) {
  if (item.type === 'interruption') {
    const p = pct(item.start);
    if (!inView(p)) return null;
    return (
      <span
        key={item.id}
        className="ti-interruption"
        style={{ left: `${p}%`, top: ROW_H / 2 }}
        title={t('timeline.interruption')}
      />
    );
  }

  const left = clampPct(pct(item.start));
  const right = clampPct(pct(item.end != null ? item.end : item.start));
  const width = right - left;
  if (width <= 0) return null;
  const channel = meta ? meta.channel : 'unknown';
  const title = meta
    ? [
        `${t('timeline.tooltipChannel')}: ${t(`channel.${meta.channel}`) || meta.channel}`,
        meta.customer ? `${t('timeline.tooltipCustomer')}: ${meta.customer}` : null,
        `${t('timeline.tooltipHandle')}: ${formatDuration(meta.handleMs)}`,
        `${t('timeline.tooltipFocus')}: ${formatDuration(meta.focusMs)}`,
        `${t('timeline.tooltipInterruptions')}: ${meta.interruptions}`,
      ].filter(Boolean).join('\n')
    : undefined;

  const cls = item.type === 'focus' ? 'ti-focus' : item.type === 'wrapup' ? 'ti-wrapup' : 'ti-active';
  const bg = item.type === 'focus' ? (CHANNEL_COLORS[channel] || CHANNEL_COLORS.unknown) : undefined;

  return (
    <span
      key={item.id}
      className={`ti ${cls}`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: item.type === 'active' ? 6 : item.type === 'focus' ? 9 : 6,
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
  stateTimeline: PropTypes.object,
  mode: PropTypes.string,
  onScroll: PropTypes.func,
};
