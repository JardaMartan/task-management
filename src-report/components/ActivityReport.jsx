import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Badge } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { buildTimeline } from '../timeline';
import { buildTeamTimeline } from '../team';
import { computeOverview } from '../analytics';
import { rangeWindowMs, resolveRange, teardown } from '../store/slices/activitySlice';
import AgentPicker from './AgentPicker';
import TeamPicker from './TeamPicker';
import ScopeToggle from './ScopeToggle';
import ModeToggle from './ModeToggle';
import ActivityOverviewBar from './ActivityOverviewBar';
import ActivityTimeline from './ActivityTimeline';
import TeamTimeline from './TeamTimeline';

export default function ActivityReport() {
  const { t } = useI18n();
  const dispatch = useDispatch();

  const status = useSelector((s) => s.activity.status);
  const isDemo = useSelector((s) => s.activity.isDemo);
  const loading = useSelector((s) => s.activity.loading);
  const events = useSelector((s) => s.activity.events);
  const mode = useSelector((s) => s.activity.mode);
  const scope = useSelector((s) => s.activity.scope);
  const rangeKey = useSelector((s) => s.activity.rangeKey);
  const customFrom = useSelector((s) => s.activity.customFrom);
  const customTo = useSelector((s) => s.activity.customTo);
  const selectedAgentId = useSelector((s) => s.activity.selectedAgentId);
  const agents = useSelector((s) => s.activity.agents);
  const darkMode = useSelector((s) => s.activity.darkMode);
  const agentState = useSelector((s) => s.activity.agentState);
  const teamState = useSelector((s) => s.activity.teamState);

  // Stop any live subscription on unmount.
  useEffect(() => () => { dispatch(teardown()); }, [dispatch]);

  // Collapse the top panels (header + controls + overview) into a compact,
  // still-visible/controllable strip once the supervisor scrolls the content.
  const [compact, setCompact] = useState(false);
  const handleScroll = (top) => setCompact(top > 6);

  // The overview (KPIs + per-channel) panel is collapsible so the supervisor
  // can reclaim vertical space; the choice is remembered across sessions.
  const [overviewOpen, setOverviewOpen] = useState(() => {
    try { return localStorage.getItem('wx_activity_overview_open') !== '0'; } catch { return true; }
  });
  const toggleOverview = () => setOverviewOpen((v) => {
    const next = !v;
    try { localStorage.setItem('wx_activity_overview_open', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  // Live "now" tick — advances every second so open interaction bars and the
  // now-marker grow smoothly between the (slower) data polls.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (mode !== 'live') return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Still-open interactions (no task_ended) extend to the view end so a long
  // one-task-all-day interaction shows its full span. Live: advancing "now".
  // Historical: now clamped to the range end (captured at each data load).
  const viewEndMs = useMemo(
    () => Math.min(Date.now(), resolveRange(rangeKey, customFrom, customTo).toMs),
    [rangeKey, customFrom, customTo, events],
  );
  const openEndMs = mode === 'live' ? nowTick : viewEndMs;

  const timeline = useMemo(() => buildTimeline(events, { openEndMs }), [events, openEndMs]);
  const teamTimeline = useMemo(
    () => (scope === 'team' ? buildTeamTimeline(events, { openEndMs }) : null),
    [scope, events, openEndMs],
  );
  const overview = useMemo(
    () => computeOverview({
      byInteraction: timeline.byInteraction,
      bounds: timeline.bounds,
      windowMs: rangeWindowMs(rangeKey, customFrom, customTo),
    }),
    [timeline, rangeKey, customFrom, customTo],
  );

  const isTeam = scope === 'team';
  // Team view is roster-driven: it lists every member of the selected team with
  // their login/logout/state timeline, even when they handled no interactions.
  const hasAgentState = !!(agentState && (agentState.loginMs != null || (agentState.segments && agentState.segments.length > 0)));
  const hasData = isTeam ? agents.length > 0 : (timeline.groups.length > 0 || hasAgentState);
  const ready = isTeam || !!selectedAgentId;

  return (
    <div className={`activity-report ${darkMode ? 'is-dark' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="activity-report__top">
        <header className="activity-report__header">
          <div className="activity-report__titles">
            <h1 className="activity-report__title">{t('app.title')}</h1>
            <p className="activity-report__subtitle">{t('app.subtitle')}</p>
          </div>
          <span className={`data-badge ${isDemo ? 'is-demo' : 'is-live'}`}>
            <Badge color={isDemo ? 'yellow' : 'green'} rounded>
              {isDemo ? t('app.demoBadge') : t('app.liveBadge')}
            </Badge>
          </span>
        </header>

        <div className="activity-report__controls">
          <ScopeToggle />
          <TeamPicker />
          {!isTeam && <AgentPicker />}
          <ModeToggle />
        </div>

        {ready && hasData && <ActivityOverviewBar overview={overview} open={overviewOpen} onToggle={toggleOverview} />}
      </div>

      <div className="activity-report__body" onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}>
        {status === 'error' && (
          <div className="activity-report__state activity-report__state--error">{t('app.error')}</div>
        )}

        {!ready && status !== 'loading' && (
          <div className="activity-report__state">{t('app.noAgent')}</div>
        )}

        {ready && (
          loading && !hasData ? (
            <div className="activity-report__state">{t('app.loading')}</div>
          ) : hasData ? (
            isTeam
              ? <TeamTimeline agents={agents} team={teamTimeline} teamState={teamState} mode={mode} windowMs={rangeWindowMs(rangeKey, customFrom, customTo)} onScroll={handleScroll} />
              : <ActivityTimeline timeline={timeline} stateTimeline={agentState} mode={mode} onScroll={handleScroll} />
          ) : (
            <div className="activity-report__state">{t('app.noData')}</div>
          )
        )}
      </div>
    </div>
  );
}
