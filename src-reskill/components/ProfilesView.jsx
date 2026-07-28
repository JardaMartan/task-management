import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Badge, Button } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { SKILL_TYPES } from '../mock/mockData';
import { setSearch, stageProfile, stageProfileBulk } from '../store/slices/reskillSlice';
import { agentsForTeams, filterAgents } from '../selectors';
import { NO_PROFILE } from '../constants';
import { resolveAgentState } from '../analytics';
import ViewModeToggle from './ViewModeToggle';
import SearchableSelect from './SearchableSelect';
import AgentFilterChip from './AgentFilterChip';

const teamNameMap = (teams) => {
  const m = new Map();
  teams.forEach((t) => m.set(t.id, t.name));
  return m;
};

/** Compact skill summary for a profile, rendered as Momentum badges. */
const ProfileSummary = ({ profile, skills }) => {
  if (!profile) return null;
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const entries = Object.entries(profile.skills || {});
  return (
    <div className="reskill-chiprow">
      {entries.slice(0, 5).map(([sid, val]) => {
        const skill = skillById.get(sid);
        if (!skill) return null;
        const label = skill.type === SKILL_TYPES.BOOLEAN
          ? skill.name
          : `${skill.name} ${val}`;
        return <Badge key={sid} color="blue-pastel" rounded>{label}</Badge>;
      })}
      {entries.length > 5 && <Badge color="default" rounded>+{entries.length - 5}</Badge>}
    </div>
  );
};

/** Center column (profiles mode): bulk Skill-Profile assignment per agent. */
const ProfilesView = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const agents = useSelector((s) => s.reskill.agents);
  const teams = useSelector((s) => s.reskill.teams);
  const skills = useSelector((s) => s.reskill.skills);
  const skillProfiles = useSelector((s) => s.reskill.skillProfiles);
  const selectedTeamIds = useSelector((s) => s.reskill.selectedTeamIds);
  const search = useSelector((s) => s.reskill.search);
  const profileDraft = useSelector((s) => s.reskill.profileDraft);
  const agentStateFilter = useSelector((s) => s.reskill.agentStateFilter);
  const liveStates = useSelector((s) => s.reskill.liveAnalytics?.agentStates || null);

  const [bulkProfile, setBulkProfile] = React.useState('');

  const names = React.useMemo(() => teamNameMap(teams), [teams]);
  const profById = React.useMemo(
    () => new Map(skillProfiles.map((p) => [p.id, p])),
    [skillProfiles],
  );

  const scopedAgents = React.useMemo(
    () => agentsForTeams(agents, selectedTeamIds),
    [agents, selectedTeamIds],
  );
  const stateScoped = React.useMemo(
    () => (agentStateFilter
      ? scopedAgents.filter((a) => resolveAgentState(a.id, liveStates) === agentStateFilter)
      : scopedAgents),
    [scopedAgents, agentStateFilter, liveStates],
  );
  const visibleAgents = React.useMemo(
    () => filterAgents(stateScoped, { search, onlyChanged: false, draft: {} }),
    [stateScoped, search],
  );

  const effectiveProfile = (agent) => profileDraft[agent.id] ?? agent.skillProfileId;

  // With multi-team agents, show the selected team the agent matches on.
  const teamLabel = (agent) => {
    const ids = agent.teamIds?.length ? agent.teamIds : [agent.teamId];
    const match = ids.find((id) => selectedTeamIds.includes(id)) || agent.teamId;
    return names.get(match) || '';
  };

  const assignToAll = () => {
    if (!bulkProfile) return;
    dispatch(stageProfileBulk({
      profileId: bulkProfile,
      entries: visibleAgents.map((a) => ({ agentId: a.id, baseProfileId: a.skillProfileId })),
    }));
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
      </div>

      {selectedTeamIds.length === 0 ? (
        <div className="reskill-empty">{t('matrix.noTeams')}</div>
      ) : (
        <>
          <AgentFilterChip />
          {visibleAgents.length === 0 ? (
            <div className="reskill-empty">{t('matrix.noAgents')}</div>
          ) : (
            <>
              {/* Bulk assignment strip */}
              <div className="reskill-bulk-assign">
                <span className="reskill-bulk-assign__label">{t('profiles.bulkLabel')}</span>
                <SearchableSelect
                  value={bulkProfile}
                  options={skillProfiles}
                  firstOption={{ id: NO_PROFILE, label: t('profiles.noProfileUnassign') }}
                  placeholder={t('profiles.selectProfile')}
                  searchPlaceholder={t('profiles.searchProfile')}
                  ariaLabel={t('profiles.bulkLabel')}
                  onChange={(id) => setBulkProfile(id)}
                />
                <Button color="blue" size={28} disabled={!bulkProfile} onClick={assignToAll}>
                  {t('profiles.assignAll', { count: visibleAgents.length })}
                </Button>
              </div>

              <div className="reskill-matrix-scroll">
                <table className="reskill-table reskill-table--profiles">
                  <thead>
                    <tr>
                      <th className="reskill-th--agent">{t('matrix.agent')}</th>
                      <th className="reskill-th--profile">{t('profiles.currentProfile')}</th>
                      <th>{t('profiles.skills')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAgents.map((agent) => {
                      const current = effectiveProfile(agent);
                      const changed = profileDraft[agent.id] !== undefined;
                      return (
                        <tr key={agent.id}>
                          <td className="reskill-td--agent">
                            <div className="reskill-agent__name">{agent.name}</div>
                            <div className="reskill-agent__team">{teamLabel(agent)}</div>
                          </td>
                          <td className={`reskill-td--profile${changed ? ' reskill-cell--changed' : ''}`}>
                            <SearchableSelect
                              value={current == null ? NO_PROFILE : current}
                              options={skillProfiles}
                              firstOption={{ id: NO_PROFILE, label: t('profiles.noProfile') }}
                              searchPlaceholder={t('profiles.searchProfile')}
                              ariaLabel={t('profiles.currentProfile')}
                              changed={changed}
                              onChange={(id) => dispatch(stageProfile({
                                agentId: agent.id,
                                profileId: id,
                                baseProfileId: agent.skillProfileId,
                              }))}
                            />
                          </td>
                          <td className="reskill-td--summary">
                            <ProfileSummary profile={profById.get(current)} skills={skills} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ProfilesView;
