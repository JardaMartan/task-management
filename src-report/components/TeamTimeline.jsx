import React, { useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatClock, formatDuration, formatPercent } from '../format';
import { buildTicks } from '../axis';
import { fallbackBreakdown, stateColor, resolveStateTimeline, stateLabelKey } from '../stateModel';
import { useViewport } from '../useViewport';
import StateDistribution from './StateDistribution';
import ZoomControls from './ZoomControls';

const CHANNEL_COLORS = {
  email: '#0e7fc1', chat: '#1a7f37', voice: '#9854cb', telephony: '#9854cb',
  social: '#17a2b8', custom: '#e0559b', sms: '#f5a623', workitem: '#c1440e',
  unknown: '#97a4b1',
};
const HEAD = 0;     // rows start at the top of the (separately-pinned) scroll body
const STATE_H = 7;  // per-agent state lane height (thin — interactions are primary)
const SUB_H = 14;   // per interaction sub-lane height
const GAP = 10;     // gap between agent blocks
const MIN_BLOCK = 46; // ensure the gutter label (name + chips + state bar) fits

// Sortable per-agent metric columns shown in the team gutter table. `get`
// reads the agent's cumulative totals (from buildTeamTimeline).
const METRICS = [
  { key: 'tasks', labelKey: 'team.colTasks', get: (tot) => tot.handled, kind: 'num' },
  { key: 'handle', labelKey: 'team.colHandle', get: (tot) => tot.handleMs, kind: 'dur' },
  { key: 'focus', labelKey: 'team.colFocus', get: (tot) => tot.focusMs, kind: 'dur', cls: 'tt-val--focus' },
  { key: 'wrap', labelKey: 'team.colWrap', get: (tot) => tot.wrapupMs, kind: 'dur', cls: 'tt-val--wrap' },
  { key: 'peak', labelKey: 'team.colPeak', get: (tot) => tot.maxConcurrency, kind: 'peak' },
];

/**
 * Per-team view: one row per team member (from the roster), each showing the
 * agent's login/logout/state timeline (sourced from Webex CC) with any
 * interactions overlaid on thin sub-lanes. Because rows are driven by the
 * roster — not by interaction events — every member of the selected team is
 * listed with their shift/state timeline even when they handled no interactions.
 */
export default function TeamTimeline({ agents, team, teamState, mode, windowMs, onScroll }) {
  const { t } = useI18n();
  const plotRef = useRef(null);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const totalsOf = (id) => (team && team.perAgent && team.perAgent[id] && team.perAgent[id].totals) || null;

  // Roster ordered by the selected metric (name = alphabetical). Numeric metrics
  // default to descending (busiest first) when first picked.
  const sortedAgents = useMemo(() => {
    const list = [...(agents || [])];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const metric = METRICS.find((m) => m.key === sort.key);
    list.sort((a, b) => {
      if (!metric) {
        return dir * String(a.name || a.id || '').localeCompare(String(b.name || b.id || ''));
      }
      const ta = totalsOf(a.id);
      const tb = totalsOf(b.id);
      const va = ta ? metric.get(ta) || 0 : 0;
      const vb = tb ? metric.get(tb) || 0 : 0;
      return dir * (va - vb) || String(a.name || '').localeCompare(String(b.name || ''));
    });
    return list;
  }, [agents, team, sort]);

  const onSort = (key) => setSort((s) => (
    s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'name' ? 'asc' : 'desc' }
  ));

  const stateByAgent = useMemo(() => {
    const m = {};
    for (const s of teamState || []) if (s && s.agentId) m[s.agentId] = s;
    return m;
  }, [teamState]);

  const layout = useMemo(() => {
    const roster = sortedAgents || [];
    if (!roster.length) return null;
    const nowMs = Date.now();
    const win = windowMs || 8 * 3600 * 1000;

    const rows = [];
    let minStart = nowMs - win;
    let maxEnd = nowMs;
    let y = HEAD;
    for (const a of roster) {
      const st = stateByAgent[a.id] || null;
      const resolved = st ? resolveStateTimeline(st.segments) : [];
      const pa = (team && team.perAgent && team.perAgent[a.id]) || null;
      const lanes = pa ? pa.lanes || 1 : 0;
      const loginMs = st && st.loginMs != null ? st.loginMs : null;
      const logoutMs = st && st.logoutMs != null ? st.logoutMs : null;
      const shiftEnd = logoutMs || nowMs;

      if (loginMs != null) minStart = Math.min(minStart, loginMs);
      if (shiftEnd) maxEnd = Math.max(maxEnd, shiftEnd);
      for (const seg of resolved) { minStart = Math.min(minStart, seg.startMs); maxEnd = Math.max(maxEnd, seg.endMs); }
      if (pa) for (const it of pa.items) { if (it.start != null) minStart = Math.min(minStart, it.start); if (it.end != null) maxEnd = Math.max(maxEnd, it.end); }

      const interactionsH = lanes > 0 ? 4 + lanes * SUB_H : 0;
      const height = Math.max(STATE_H + interactionsH + GAP, MIN_BLOCK);
      rows.push({ agent: a, st, resolved, pa, lanes, loginMs, logoutMs, shiftEnd, top: y, height });
      y += height;
    }
    if (mode === 'live') maxEnd = Math.max(maxEnd, nowMs);
    const pad = Math.max((maxEnd - minStart) * 0.03, 30 * 1000);
    return { vMin: minStart - pad, vMax: maxEnd + pad, nowMs, rows, totalHeight: y };
  }, [sortedAgents, team, stateByAgent, mode, windowMs]);

  const vp = useViewport(layout ? layout.vMin : 0, layout ? layout.vMax : 1, plotRef);

  if (!layout) return <div className="timeline timeline--empty">{t('app.noData')}</div>;

  const { nowMs, rows, totalHeight } = layout;
  const pct = vp.pct;
  const ticks = buildTicks(vp.start, vp.end)
    .map((tk) => ({ ...tk, leftPct: pct(tk.ms) }))
    .filter((tk) => tk.leftPct >= 0 && tk.leftPct <= 100);

  return (
    <section className="timeline tt" aria-label={t('team.title')}>
      <div className="timeline__head">
        <h3 className="timeline__title">{t('team.title')}</h3>
        <div className="timeline__head-right">
          <TeamLegend t={t} />
          <ZoomControls vp={vp} />
        </div>
      </div>

      {/* Fixed axis row — stays visible while the roster scrolls vertically. */}
      <div className="tt__axisrow">
        <div className="tt__axishead tt-cols">
          <button
            type="button"
            className={`tt-col tt-col--name ${sort.key === 'name' ? 'is-sorted' : ''}`}
            onClick={() => onSort('name')}
            title={t('team.sortBy', { metric: t('team.colName') })}
          >
            {t('team.colName')}
            {sort.key === 'name' && <span className="tt-col__arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
          </button>
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`tt-col tt-col--num ${sort.key === m.key ? 'is-sorted' : ''}`}
              onClick={() => onSort(m.key)}
              title={t('team.sortBy', { metric: t(m.labelKey) })}
            >
              {t(m.labelKey)}
              {sort.key === m.key && <span className="tt-col__arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
            </button>
          ))}
        </div>
        <div className="tt__axisplot">
          {ticks.map((tick, i) => (
            <span className={tick.major ? 'timeline__daylabel' : 'timeline__tick'} key={i} style={{ left: `${tick.leftPct}%` }}>{tick.label}</span>
          ))}
        </div>
      </div>

      <div className="tt__scroll" onScroll={(e) => onScroll && onScroll(e.currentTarget.scrollTop)}>
        <div className="timeline__grid team-grid">
        {/* gutter: agent name + shift + per-agent metric totals */}
        <div className="timeline__gutter" style={{ height: totalHeight }}>
          {rows.map(({ agent, st, pa, loginMs, shiftEnd, top, height }) => {
            const sum = pa ? pa.summary || {} : {};
            const tot = (pa && pa.totals) || { handled: 0, handleMs: 0, focusMs: 0, wrapupMs: 0, maxConcurrency: 0 };
            const breakdown = st && st.breakdown && st.breakdown.length
              ? st.breakdown
              : (pa ? fallbackBreakdown(sum.occupiedMs, sum.wrapupMs) : []);
            return (
              <div className="team-label tt-cols" key={agent.id} style={{ position: 'absolute', top, height }} title={agent.id}>
                <div className="team-label__namecell">
                  <span className="team-label__name">{agent.name || agent.id}</span>
                  <span className="team-label__meta">
                    {tot.handled > 0 ? (
                      <>
                        <span className="meta-chip meta-chip--kpi" title={`${t('overview.ahtAvg')}: ${formatDuration(tot.ahtMs)}`}>
                          {t('team.aht')} {formatDuration(tot.ahtMs)}
                        </span>
                        <span className="meta-chip meta-chip--kpi" title={`${t('overview.occupancy')}: ${formatPercent(tot.occupancy)}`}>
                          {formatPercent(tot.occupancy)} {t('team.occ')}
                        </span>
                      </>
                    ) : (
                      <span className="meta-chip meta-chip--muted">{t('app.noData')}</span>
                    )}
                  </span>
                  {breakdown.length > 0 && <StateDistribution compact breakdown={breakdown} />}
                </div>
                <span className={`tt-val ${sort.key === 'tasks' ? 'is-sorted' : ''}`}>{tot.handled || '—'}</span>
                <span className={`tt-val ${sort.key === 'handle' ? 'is-sorted' : ''}`}>{tot.handleMs > 0 ? formatDuration(tot.handleMs) : '—'}</span>
                <span className={`tt-val tt-val--focus ${sort.key === 'focus' ? 'is-sorted' : ''}`}>{tot.focusMs > 0 ? formatDuration(tot.focusMs) : '—'}</span>
                <span className={`tt-val tt-val--wrap ${sort.key === 'wrap' ? 'is-sorted' : ''}`}>{tot.wrapupMs > 0 ? formatDuration(tot.wrapupMs) : '—'}</span>
                <span className={`tt-val ${sort.key === 'peak' ? 'is-sorted' : ''}`}>{tot.maxConcurrency > 0 ? `×${tot.maxConcurrency}` : '—'}</span>
              </div>
            );
          })}
        </div>

        {/* plot */}
        <div className="timeline__plot timeline__plot--interactive" ref={plotRef} style={{ height: totalHeight }}>
          {ticks.map((tick, i) => (
            <span className={`timeline__gridline ${tick.major ? 'timeline__gridline--day' : ''}`} key={`gl-${i}`} style={{ left: `${tick.leftPct}%` }} />
          ))}

          {rows.map(({ agent, resolved, pa, loginMs, shiftEnd, top, height }) => {
            const stateTop = top + 2;
            return (
              <React.Fragment key={agent.id}>
                <div className="team-row" style={{ top: top + height, height: 0 }} />

                {/* state timeline lane (login → logout with state colours) */}
                {loginMs != null && (
                  <span
                    className="tt-shift"
                    style={{ left: `${pct(loginMs)}%`, width: `${Math.max(pct(shiftEnd) - pct(loginMs), 0.1)}%`, top: stateTop, height: STATE_H }}
                    title={`${t('state.login')} ${formatClock(loginMs)} · ${mode === 'live' ? t('timeline.now') : t('state.logout')} ${formatClock(shiftEnd)}`}
                  />
                )}
                {resolved.map((seg, i) => {
                  const left = pct(seg.startMs);
                  const w = Math.max(pct(seg.endMs) - left, 0.1);
                  const label = seg.name || t(stateLabelKey(seg.code)) || seg.code;
                  return (
                    <span
                      key={`st-${i}`}
                      className="tt-state"
                      style={{ left: `${left}%`, width: `${w}%`, top: stateTop, height: STATE_H, background: stateColor(seg.code) }}
                      title={`${label} · ${formatClock(seg.startMs)}–${formatClock(seg.endMs)} (${formatDuration(seg.endMs - seg.startMs)})`}
                    />
                  );
                })}

                {/* interaction sub-lanes overlaid below the state lane */}
                {pa && pa.items.map((item) => renderItem(item, pa, stateTop + STATE_H + 3, pct, t))}
              </React.Fragment>
            );
          })}

          {mode === 'live' && (
            <span className="timeline__now" style={{ left: `${pct(nowMs)}%` }} title={t('timeline.now')}>
              <span className="timeline__now-label">{t('timeline.now')}</span>
            </span>
          )}
        </div>
        </div>
      </div>
    </section>
  );
}

function renderItem(item, pa, agentTop, pct, t) {
  const lane = pa.laneOf[item.group] || 0;
  const meta = pa.byInteraction[item.group];
  const channel = meta ? meta.channel : 'unknown';
  const color = CHANNEL_COLORS[channel] || CHANNEL_COLORS.unknown;
  const laneTop = agentTop + lane * SUB_H;

  if (item.type === 'interruption') {
    return (
      <span
        key={item.id}
        className="tt-intr"
        style={{ left: `${pct(item.start)}%`, top: laneTop + SUB_H / 2 }}
        title={t('timeline.interruption')}
      />
    );
  }

  const left = pct(item.start);
  const width = Math.max(pct(item.end != null ? item.end : item.start) - left, 0.3);
  const title = meta
    ? `${t(`channel.${channel}`) || channel}${meta.customer ? ' · ' + meta.customer : ''} · `
      + `${t('timeline.tooltipHandle')} ${formatDuration(meta.handleMs)} · ${t('timeline.tooltipFocus')} ${formatDuration(meta.focusMs)}`
    : undefined;

  if (item.type === 'active') {
    return (
      <span key={item.id} className="tt-active"
        style={{ left: `${left}%`, width: `${width}%`, top: laneTop + 2, height: SUB_H - 5, background: color }}
        title={title} />
    );
  }
  if (item.type === 'wrapup') {
    return (
      <span key={item.id} className="tt-wrap"
        style={{ left: `${left}%`, width: `${width}%`, top: laneTop + 2, height: SUB_H - 5, '--wrap-color': '#9854cb' }}
        title={t('team.wrapup')} />
    );
  }
  // focus
  return (
    <span key={item.id} className="tt-focus"
      style={{ left: `${left}%`, width: `${width}%`, top: laneTop + 4, height: SUB_H - 9, background: color }}
      title={title} />
  );
}

function TeamLegend({ t }) {
  return (
    <div className="legend">
      <span className="legend__item"><span className="legend__swatch sw-focus" />{t('timeline.focused')}</span>
      <span className="legend__item"><span className="legend__swatch sw-active" />{t('timeline.active')}</span>
      <span className="legend__item"><span className="legend__swatch sw-wrapup" />{t('team.wrapup')}</span>
      <span className="legend__item"><span className="legend__swatch sw-intr" />{t('timeline.interruption')}</span>
    </div>
  );
}

TeamTimeline.propTypes = {
  agents: PropTypes.array,
  team: PropTypes.object,
  teamState: PropTypes.array,
  mode: PropTypes.string,
  windowMs: PropTypes.number,
  onScroll: PropTypes.func,
};
