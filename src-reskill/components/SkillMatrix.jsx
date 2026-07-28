import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { SKILL_TYPES } from '../mock/mockData';
import { setSearch, setOnlyChanged, stageSkill } from '../store/slices/reskillSlice';
import { agentsForTeams, filterAgents, dynamicSkills } from '../selectors';
import { REMOVE_SKILL } from '../constants';
import { resolveAgentState } from '../analytics';
import ViewModeToggle from './ViewModeToggle';
import ToggleSwitch from './ToggleSwitch';
import AgentFilterChip from './AgentFilterChip';

const teamNameMap = (teams) => {
  const m = new Map();
  teams.forEach((t) => m.set(t.id, t.name));
  return m;
};

/** Starting value used when assigning a not-yet-assigned dynamic skill. */
const assignValue = (skill) => {
  if (skill.type === SKILL_TYPES.BOOLEAN) return true;
  if (skill.type === SKILL_TYPES.ENUM) return skill.values?.[0] ?? '';
  if (skill.type === SKILL_TYPES.TEXT) return '';
  return 1;
};

/** A single dynamic-skill cell. Every grid skill is a dynamic skill assigned
 * directly to the agent, so a cell has three states: assigned (value control +
 * remove), staged-removed (undo), or unassigned (assign). */
const SkillCell = ({ agent, skill }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const override = useSelector((s) => s.reskill.draft?.[agent.id]?.[skill.id]);
  const changed = override !== undefined;
  const removed = override === REMOVE_SKILL;
  const baseAssigned = Object.prototype.hasOwnProperty.call(agent.skills || {}, skill.id);
  const assigned = removed ? false : (changed ? true : baseAssigned);
  const rawBase = agent.skills?.[skill.id];

  // Normalized base value → staging this exact value clears the override.
  const normBase = skill.type === SKILL_TYPES.BOOLEAN
    ? Boolean(rawBase)
    : (skill.type === SKILL_TYPES.ENUM || skill.type === SKILL_TYPES.TEXT)
      ? (rawBase ?? '')
      : Number(rawBase ?? 0);

  const value = removed ? undefined : (changed ? override : rawBase);
  const stage = (val) => dispatch(stageSkill({
    agentId: agent.id, skillId: skill.id, value: val, baseValue: normBase,
  }));
  const cellClass = changed ? 'reskill-cell--changed' : undefined;

  if (!assigned) {
    return (
      <td className={cellClass}>
        {removed ? (
          <span className="reskill-removed">
            <span className="reskill-removed__tag">{t('matrix.removed')}</span>
            <button type="button" className="reskill-linkbtn" onClick={() => stage(normBase)}>
              {t('matrix.undo')}
            </button>
          </span>
        ) : (
          <button type="button" className="reskill-assignbtn" onClick={() => stage(assignValue(skill))}>
            + {t('matrix.assign')}
          </button>
        )}
      </td>
    );
  }

  let control;
  if (skill.type === SKILL_TYPES.BOOLEAN) {
    control = (
      <ToggleSwitch
        tone="on"
        checked={Boolean(value)}
        ariaLabel={skill.name}
        onChange={(c) => stage(c)}
      />
    );
  } else if (skill.type === SKILL_TYPES.ENUM) {
    control = (
      <select
        className={`reskill-enum${changed ? ' reskill-level--changed' : ''}`}
        value={value ?? ''}
        onChange={(e) => stage(e.target.value)}
      >
        <option value="">—</option>
        {(skill.values || []).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  } else if (skill.type === SKILL_TYPES.TEXT) {
    control = (
      <input
        type="text"
        className={`reskill-text${changed ? ' reskill-level--changed' : ''}`}
        value={value ?? ''}
        maxLength={skill.maxLength || 40}
        onChange={(e) => stage(e.target.value)}
      />
    );
  } else {
    const max = skill.maxLevel || 10;
    control = (
      <select
        className={`reskill-level${changed ? ' reskill-level--changed' : ''}`}
        value={Number(value ?? 0)}
        onChange={(e) => stage(Number(e.target.value))}
      >
        {Array.from({ length: max + 1 }, (_, i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
    );
  }

  return (
    <td className={cellClass}>
      <div className="reskill-cellwrap">
        {control}
        <button
          type="button"
          className="reskill-cellremove"
          title={t('matrix.remove')}
          aria-label={t('matrix.remove')}
          onClick={() => stage(REMOVE_SKILL)}
        >
          ✕
        </button>
      </div>
    </td>
  );
};

/** Center column: the agents × skills editable matrix. */
const SkillMatrix = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const skills = useSelector((s) => s.reskill.skills);
  const agents = useSelector((s) => s.reskill.agents);
  const teams = useSelector((s) => s.reskill.teams);
  const selectedTeamIds = useSelector((s) => s.reskill.selectedTeamIds);
  const search = useSelector((s) => s.reskill.search);
  const onlyChanged = useSelector((s) => s.reskill.onlyChanged);
  const agentStateFilter = useSelector((s) => s.reskill.agentStateFilter);
  const draft = useSelector((s) => s.reskill.draft);
  const liveStates = useSelector((s) => s.reskill.liveAnalytics?.agentStates || null);

  const names = React.useMemo(() => teamNameMap(teams), [teams]);

  const scopedAgents = React.useMemo(
    () => agentsForTeams(agents, selectedTeamIds),
    [agents, selectedTeamIds],
  );

  // Agent-state filter (from the analytics donut) applies only with teams selected.
  const stateScoped = React.useMemo(
    () => (agentStateFilter
      ? scopedAgents.filter((a) => resolveAgentState(a.id, liveStates) === agentStateFilter)
      : scopedAgents),
    [scopedAgents, agentStateFilter, liveStates],
  );

  const visibleAgents = React.useMemo(
    () => filterAgents(stateScoped, { search, onlyChanged, draft }),
    [stateScoped, search, onlyChanged, draft],
  );

  // The grid only edits DYNAMIC skills (assigned directly to agents). Skills
  // that live in Skill Profiles are managed in the Profiles view, so editing
  // them per-agent never forces ad-hoc profile creation.
  const visibleSkills = React.useMemo(
    () => dynamicSkills(skills),
    [skills],
  );

  const skillTypeLabel = (type) => t(`matrix.skillType.${type}`) || type;

  // With multi-team agents, show the selected team the agent matches on.
  const teamLabel = (agent) => {
    const ids = agent.teamIds?.length ? agent.teamIds : [agent.teamId];
    const match = ids.find((id) => selectedTeamIds.includes(id)) || agent.teamId;
    return names.get(match) || '';
  };

  return (
    <div className="reskill-col reskill-col--matrix">
      <div className="reskill-matrix-toolbar">
        <ViewModeToggle />
        <span className="reskill-matrix-toolbar__spacer" />
        <input
          className="reskill-input"
          type="search"
          placeholder={t('matrix.searchPlaceholder')}
          value={search}
          onChange={(e) => dispatch(setSearch(e.target.value))}
        />
        <ToggleSwitch
          checked={onlyChanged}
          onChange={(checked) => dispatch(setOnlyChanged(checked))}
          label={t('matrix.showOnlyChanged')}
        />
      </div>

      {selectedTeamIds.length === 0 ? (
        <div className="reskill-empty">{t('matrix.noTeams')}</div>
      ) : (
        <>
          <div className="reskill-hint">{t('matrix.dynamicNote')}</div>
          <AgentFilterChip />
          {visibleAgents.length === 0 ? (
            <div className="reskill-empty">{t('matrix.noAgents')}</div>
          ) : (
            <div className="reskill-matrix-scroll">
              <table className="reskill-table">
                <thead>
                  <tr>
                    <th className="reskill-th--agent">{t('matrix.agent')}</th>
                    {visibleSkills.map((skill) => (
                      <th key={skill.id}>
                        {skill.name}
                        <span className="reskill-th__type">{skillTypeLabel(skill.type)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleAgents.map((agent) => (
                    <tr key={agent.id}>
                      <td className="reskill-td--agent">
                        <div className="reskill-agent__name">{agent.name}</div>
                        <div className="reskill-agent__team">{teamLabel(agent)}</div>
                      </td>
                      {visibleSkills.map((skill) => (
                        <SkillCell key={skill.id} agent={agent} skill={skill} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SkillMatrix;
