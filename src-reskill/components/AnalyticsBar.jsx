import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { toggleAnalyticsOpen, setAnalyticsTrendDays, setAgentStateFilter, setDataMode, loadAnalytics } from '../store/slices/reskillSlice';
import { computeAnalytics } from '../analytics';
import { Donut, Sparkline, Legend, KpiTile } from './charts';

const TREND_DAYS = [90, 30, 7, 1];

const trendLabel = (t, d) => (d <= 1 ? t('analytics.trend24h') : t('analytics.trendDays', { days: d }));

/**
 * Collapsible operational-analytics strip shown above the skill matrix.
 * Mirrors the task-management analytics-collapse pattern. Surfaces the metrics
 * a supervisor needs when fine-tuning staffing/skills: agent-state mix, per-skill
 * demand vs coverage, service level, volume/AHT trends, and headline KPIs.
 */
const AnalyticsBar = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const darkMode = useSelector((s) => s.reskill.darkMode);
  const isDemo = useSelector((s) => s.reskill.isDemo);
  const agents = useSelector((s) => s.reskill.agents);
  const skills = useSelector((s) => s.reskill.skills);
  const selectedTeamIds = useSelector((s) => s.reskill.selectedTeamIds);
  const draft = useSelector((s) => s.reskill.draft);
  const analyticsOpen = useSelector((s) => s.reskill.analyticsOpen);
  const trendDays = useSelector((s) => s.reskill.analyticsTrendDays);
  const agentStateFilter = useSelector((s) => s.reskill.agentStateFilter);
  const liveAnalytics = useSelector((s) => s.reskill.liveAnalytics);

  // Agent-state donut acts as a filter, but only once team(s) are selected.
  const filterable = selectedTeamIds.length > 0;
  const onStateClick = filterable ? (key) => dispatch(setAgentStateFilter(key)) : undefined;

  // Light "live" refresh so real-time figures wobble like a running CC.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!analyticsOpen) return undefined;
    const id = setInterval(() => setTick((x) => x + 1), 6000);
    return () => clearInterval(id);
  }, [analyticsOpen]);

  // In live mode, (re)fetch real trends/KPIs when the trend window or team
  // scope changes and refresh periodically so the KPIs stay current. Demo mode
  // synthesizes.
  const teamScopeKey = selectedTeamIds.join(',');
  React.useEffect(() => {
    if (isDemo) return undefined;
    dispatch(loadAnalytics());
    const id = setInterval(() => dispatch(loadAnalytics()), 60000);
    return () => clearInterval(id);
  }, [dispatch, isDemo, trendDays, teamScopeKey]);

  const a = React.useMemo(
    () => computeAnalytics({ agents, skills, selectedTeamIds, draft, trendDays, tick, live: liveAnalytics, t }),
    [agents, skills, selectedTeamIds, draft, trendDays, tick, liveAnalytics, t],
  );

  return (
    <div className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
      <div
        className="analytics-collapse__toggle"
        role="button"
        tabIndex={0}
        onClick={() => dispatch(toggleAnalyticsOpen())}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && dispatch(toggleAnalyticsOpen())}
        aria-expanded={analyticsOpen}
      >
        <span className="analytics-collapse__label">{t('analytics.title')}</span>
        <span className="analytics-collapse__header-right">
          {a.underCoveredCount > 0 && (
            <span className="analytics-alert">
              {t('analytics.underCovered', { count: a.underCoveredCount })}
            </span>
          )}
          <button
            type="button"
            className={`analytics-demo-badge ${isDemo ? 'analytics-demo-badge--demo' : 'analytics-demo-badge--live'}`}
            onClick={(e) => { e.stopPropagation(); dispatch(setDataMode(isDemo ? 'live' : 'mock')); }}
            title={isDemo ? t('analytics.switchLive') : t('analytics.switchDemo')}
          >
            {isDemo ? t('analytics.demo') : t('analytics.live')}
          </button>
          <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
        </span>
      </div>

      {analyticsOpen && (
        <div className={`analytics-bar${darkMode ? ' analytics-bar--dark' : ''}`}>
          {/* ── Agent state mix (real-time) ─────────────────────────────── */}
          <div className="analytics-section">
            <div className="analytics-section__title">{t('analytics.agentState')}</div>
            <div className="analytics-section__content--row">
              <div style={{ position: 'relative' }}>
                <Donut
                  segments={a.agentState}
                  darkMode={darkMode}
                  onSegmentClick={onStateClick}
                  activeKey={agentStateFilter}
                />
                <div className="analytics-donut-center">
                  <span className="analytics-donut-center__big">{a.agentCount}</span>
                  <span className="analytics-donut-center__small">{t('analytics.agents')}</span>
                </div>
              </div>
              <Legend
                items={a.agentState}
                onItemClick={onStateClick}
                activeKey={agentStateFilter}
              />
            </div>
          </div>

          <div className="analytics-divider" />

          {/* ── Skill demand vs coverage (reskilling headline) ──────────── */}
          <div className="analytics-section analytics-section--coverage">
            <div className="analytics-section__title">{t('analytics.skillCoverage')}</div>
            <div className="analytics-coverage">
              {a.skillCoverage.slice(0, 6).map((row) => (
                <div
                  key={row.skillId}
                  className={`analytics-cov-row${row.underCovered ? ' analytics-cov-row--alert' : ''}`}
                  title={t('analytics.coverageTip', { covering: row.covering, waiting: row.waiting })}
                >
                  <span className="analytics-cov-row__name">{row.name}</span>
                  <span className="analytics-cov-row__cover">{t('analytics.covAgents', { count: row.covering })}</span>
                  <span className="analytics-cov-row__wait">{t('analytics.covWaiting', { count: row.waiting })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-divider" />

          {/* ── Service level (real-time) ───────────────────────────────── */}
          <div className="analytics-section">
            <div className="analytics-section__title">{t('analytics.serviceLevel')}</div>
            <div className="analytics-section__content--row">
              <div style={{ position: 'relative' }}>
                <Donut segments={a.serviceLevel} darkMode={darkMode} />
                <div className="analytics-donut-center">
                  <span className="analytics-donut-center__big">{a.slPct}%</span>
                  <span className="analytics-donut-center__small">{t('analytics.sl.met')}</span>
                </div>
              </div>
              <Legend items={a.serviceLevel} />
            </div>
          </div>

          <div className="analytics-divider" />

          {/* ── Volume + AHT trends (historical) ────────────────────────── */}
          <div className="analytics-section analytics-section--sparklines">
            <div className="analytics-section__title analytics-section__title--with-controls">
              <span>{t('analytics.trends')}</span>
              <div className="analytics-trend-period">
                {TREND_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`analytics-trend-period__btn${trendDays === d ? ' analytics-trend-period__btn--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); dispatch(setAnalyticsTrendDays(d)); }}
                    aria-pressed={trendDays === d}
                  >
                    {trendLabel(t, d)}
                  </button>
                ))}
              </div>
            </div>
            <div className="analytics-sparkline-row">
              <Sparkline values={a.volumeTrend} color="#0e7fc1" />
              <span className="analytics-spark-label">{t('analytics.volume')}</span>
            </div>
            <div className="analytics-sparkline-row">
              <Sparkline values={a.ahtTrend} color="#9854cb" />
              <span className="analytics-spark-label">{t('analytics.aht')}</span>
            </div>
          </div>

          <div className="analytics-divider" />

          {/* ── Headline KPIs ───────────────────────────────────────────── */}
          <div className="analytics-section analytics-section--kpis">
            <div className="analytics-section__title">{t('analytics.kpis')}</div>
            <div className="analytics-kpi-grid">
              <KpiTile label={t('analytics.kpi.serviceLevel')} value={`${a.kpis.serviceLevel}%`} accent="#1a7f37" />
              <KpiTile label={t('analytics.kpi.asa')} value={`${a.kpis.asaSec}s`} accent="#0e7fc1" />
              <KpiTile label={t('analytics.kpi.abandon')} value={`${a.kpis.abandonPct}%`} accent="#e8453c" />
              <KpiTile label={t('analytics.kpi.occupancy')} value={`${a.kpis.occupancyPct}%`} accent="#9854cb" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsBar;
