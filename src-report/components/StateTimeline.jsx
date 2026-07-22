import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatClock, formatDuration } from '../format';
import { stateColor, resolveStateTimeline, stateLabelKey } from '../stateModel';
import { useViewport } from '../useViewport';
import ZoomControls from './ZoomControls';

/**
 * Time-aligned agent state lane with zoom (wheel / buttons) and pan (drag).
 * Shows login, each state change and logout/now — even when there are no
 * state segments (just the shift span with markers).
 */
export default function StateTimeline({ segments, loginMs, logoutMs, live }) {
  const { t } = useI18n();
  const laneRef = useRef(null);
  const resolved = useMemo(() => resolveStateTimeline(segments), [segments]);

  const bounds = useMemo(() => {
    const nowMs = Date.now();
    const min = loginMs ?? (resolved.length ? resolved[0].startMs : null);
    if (min == null) return null;
    const endCandidate = logoutMs || (resolved.length ? resolved[resolved.length - 1].endMs : nowMs);
    let max = live ? Math.max(endCandidate, nowMs) : endCandidate;
    if (max <= min) max = min + 60 * 1000;
    const pad = Math.max((max - min) * 0.02, 30 * 1000);
    return { vMin: min - pad, vMax: max + pad, loginMs: min, endMs: max };
  }, [resolved, loginMs, logoutMs, live]);

  const vp = useViewport(bounds ? bounds.vMin : 0, bounds ? bounds.vMax : 1, laneRef);

  if (!bounds) return null;

  const ticks = [];
  for (let i = 0; i <= 6; i++) {
    const x = vp.start + (vp.span * i) / 6;
    ticks.push({ leftPct: (i / 6) * 100, label: formatClock(x) });
  }

  return (
    <div className="statetimeline">
      <div className="statetimeline__head">
        <span className="statetimeline__hint">{t('zoom.hint')}</span>
        <ZoomControls vp={vp} />
      </div>
      <div className="statetimeline__axis">
        {ticks.map((tk, i) => (
          <span key={i} className="statetimeline__tick" style={{ left: `${tk.leftPct}%` }}>{tk.label}</span>
        ))}
      </div>
      <div className="statetimeline__lane" ref={laneRef}>
        {ticks.map((tk, i) => (
          <span key={`g${i}`} className="statetimeline__grid" style={{ left: `${tk.leftPct}%` }} />
        ))}
        {resolved.map((seg, i) => {
          const left = vp.pct(seg.startMs);
          const width = Math.max(vp.pct(seg.endMs) - left, 0.1);
          const label = seg.name || t(stateLabelKey(seg.code)) || seg.code;
          return (
            <span
              key={i}
              className="stl-seg"
              style={{ left: `${left}%`, width: `${width}%`, background: stateColor(seg.code) }}
              title={`${label} · ${formatClock(seg.startMs)}–${formatClock(seg.endMs)} (${formatDuration(seg.endMs - seg.startMs)})`}
            />
          );
        })}
        <span className="stl-marker stl-marker--login" style={{ left: `${vp.pct(bounds.loginMs)}%` }} title={t('state.login')}>
          <span className="stl-marker__label">{t('state.login')} {formatClock(bounds.loginMs)}</span>
        </span>
        <span className={`stl-marker ${live ? 'stl-marker--now' : 'stl-marker--logout'}`} style={{ left: `${vp.pct(bounds.endMs)}%` }} title={live ? t('timeline.now') : t('state.logout')}>
          <span className="stl-marker__label">{live ? t('timeline.now') : `${t('state.logout')} ${formatClock(bounds.endMs)}`}</span>
        </span>
      </div>
    </div>
  );
}

StateTimeline.propTypes = {
  segments: PropTypes.array,
  loginMs: PropTypes.number,
  logoutMs: PropTypes.number,
  live: PropTypes.bool,
};
