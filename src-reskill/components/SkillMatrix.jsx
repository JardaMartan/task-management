import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { SKILL_TYPES } from '../mock/mockData';
import { setSearch, setOnlyChanged, setShowAllSkills, stageSkill } from '../store/slices/reskillSlice';
import {
  effectiveValue, isChanged, agentsForTeams, filterAgents, relevantSkills,
} from '../selectors';
import { assignAgentState } from '../analytics';
import ViewModeToggle from './ViewModeToggle';
import AgentFilterChip from './AgentFilterChip';

const teamNameMap = (teams) => {
  const m = new Map();
  teams.forEach((t) => m.set(t.id, t.name));
  return m;
};

/** A single editable cell — level selector for proficiency, switch for boolean. */
const SkillCell = ({ agent, skill }) => {
  const dispatch = useDispatch();
  const draft = useSelector((s) => s.reskill.draft);
  const value = effectiveValue(agent, skill.id, draft);
  const changed = isChanged(agent, skill.id, draft);
  const baseValue = agent.skills?.[skill.id];

  if (skill.type === SKILL_TYPES.BOOLEAN) {
    return (
      <td className={changed ? 'reskill-cell--changed' : undefined}>
        <input
          type="checkbox"
          className="reskill-switch"
          checked={Boolean(value)}
          onChange={(e) => dispatch(stageSkill({
            agentId: agent.id, skillId: skill.id, value: e.target.checked, baseValue: Boolean(baseValue),
          }))}
        />
      </td>
    );
  }

  if (skill.type === SKILL_TYPES.ENUM) {
    return (
      <td className={changed ? 'reskill-cell--changed' : undefined}>
        <select
          className={`reskill-enum${changed ? ' reskill-level--changed' : ''}`}
          value={value ?? ''}
          onChange={(e) => dispatch(stageSkill({
            agentId: agent.id, skillId: skill.id, value: e.target.value, baseValue: baseValue ?? '',
          }))}
        >
          <option value="">—</option>
          {(skill.values || []).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </td>
    );
  }

  if (skill.type === SKILL_TYPES.TEXT) {
    return (
      <td className={changed ? 'reskill-cell--changed' : undefined}>
        <input
          type="text"
          className={`reskill-text${changed ? ' reskill-level--changed' : ''}`}
          value={value ?? ''}
          maxLength={skill.maxLength || 40}
          onChange={(e) => dispatch(stageSkill({
            agentId: agent.id, skillId: skill.id, value: e.target.value, baseValue: baseValue ?? '',
          }))}
        />
      </td>
    );
  }

  const max = skill.maxLevel || 10;
  return (
    <td className={changed ? 'reskill-cell--changed' : undefined}>
      <select
        className={`reskill-level${changed ? ' reskill-level--changed' : ''}`}
        value={Number(value ?? 0)}
        onChange={(e) => dispatch(stageSkill({
          agentId: agent.id, skillId: skill.id, value: Number(e.target.value), baseValue: Number(baseValue ?? 0),
        }))}
      >
        {Array.from({ length: max + 1 }, (_, i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
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
  const showAllSkills = useSelector((s) => s.reskill.showAllSkills);
  const agentStateFilter = useSelector((s) => s.reskill.agentStateFilter);
  const draft = useSelector((s) => s.reskill.draft);

  const names = React.useMemo(() => teamNameMap(teams), [teams]);

  const scopedAgents = React.useMemo(
    () => agentsForTeams(agents, selectedTeamIds),
    [agents, selectedTeamIds],
  );

  // Agent-state filter (from the analytics donut) applies only with teams selected.
  const stateScoped = React.useMemo(
    () => (agentStateFilter
      ? scopedAgents.filter((a) => assignAgentState(a.id) === agentStateFilter)
      : scopedAgents),
    [scopedAgents, agentStateFilter],
  );

  const visibleAgents = React.useMemo(
    () => filterAgents(stateScoped, { search, onlyChanged, draft }),
    [stateScoped, search, onlyChanged, draft],
  );

  // Default to the skills the selected teams actually use; the toggle reveals
  // the full org catalog (skills are global in Webex CC, so any can be added).
  const visibleSkills = React.useMemo(
    () => (showAllSkills ? skills : relevantSkills(scopedAgents, skills, draft)),
    [showAllSkills, skills, scopedAgents, draft],
  );
  const hiddenCount = skills.length - visibleSkills.length;

  const skillTypeLabel = (type) => t(`matrix.skillType.${type}`) || type;

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
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="reskill-toggle">
          <input
            type="checkbox"
            className="reskill-checkbox"
            checked={showAllSkills}
            onChange={(e) => dispatch(setShowAllSkills(e.target.checked))}
          />
          {hiddenCount > 0 && !showAllSkills
            ? t('matrix.showAllSkillsCount', { count: hiddenCount })
            : t('matrix.showAllSkills')}
        </label>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="reskill-toggle">
          <input
            type="checkbox"
            className="reskill-checkbox"
            checked={onlyChanged}
            onChange={(e) => dispatch(setOnlyChanged(e.target.checked))}
          />
          {t('matrix.showOnlyChanged')}
        </label>
      </div>

      {selectedTeamIds.length === 0 ? (
        <div className="reskill-empty">{t('matrix.noTeams')}</div>
      ) : (
        <>
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
                        <div className="reskill-agent__team">{names.get(agent.teamId) || ''}</div>
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
