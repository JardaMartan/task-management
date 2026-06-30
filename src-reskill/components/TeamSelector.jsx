import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setSelectedTeams, toggleTeam } from '../store/slices/reskillSlice';

/** Left column: list of supervised teams with multi-select checkboxes. */
const TeamSelector = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const teams = useSelector((s) => s.reskill.teams);
  const agents = useSelector((s) => s.reskill.agents);
  const selectedTeamIds = useSelector((s) => s.reskill.selectedTeamIds);

  // Local (non-Redux) quick filter to narrow the visible team list.
  const [teamSearch, setTeamSearch] = React.useState('');

  // Case-insensitive, locale-aware (Unicode) sort by team name.
  const collator = React.useMemo(
    () => new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }),
    [],
  );

  const filteredTeams = React.useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    const list = q
      ? teams.filter((tm) => (tm.name || '').toLowerCase().includes(q))
      : teams;
    return [...list].sort((a, b) => collator.compare(a.name || '', b.name || ''));
  }, [teams, teamSearch, collator]);

  const countByTeam = React.useMemo(() => {
    const m = new Map();
    agents.forEach((a) => m.set(a.teamId, (m.get(a.teamId) || 0) + 1));
    return m;
  }, [agents]);

  const selectedAgentCount = React.useMemo(() => {
    const set = new Set(selectedTeamIds);
    return agents.filter((a) => set.has(a.teamId)).length;
  }, [agents, selectedTeamIds]);

  if (teams.length === 0) {
    return (
      <div className="reskill-col">
        <div className="reskill-panel-head">
          <h3 className="reskill-section-title">{t('teams.title')}</h3>
        </div>
        <div className="reskill-col__pad">
          <p className="reskill-section-sub">{t('teams.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reskill-col">
      <div className="reskill-panel-head">
        <h3 className="reskill-section-title">{t('teams.title')}</h3>
      </div>
      <div className="reskill-col__pad">
        <p className="reskill-section-sub" style={{ marginBottom: 10 }}>{t('teams.subtitle')}</p>

        <input
          type="search"
          className="reskill-team-search"
          value={teamSearch}
          onChange={(e) => setTeamSearch(e.target.value)}
          placeholder={t('teams.searchPlaceholder')}
          aria-label={t('teams.searchPlaceholder')}
        />

        <div className="reskill-team-actions">
          <button
            type="button"
            className="reskill-linkbtn"
            onClick={() => dispatch(setSelectedTeams(filteredTeams.map((tm) => tm.id)))}
          >
            {t('teams.selectAll')}
          </button>
          <button
            type="button"
            className="reskill-linkbtn"
            onClick={() => dispatch(setSelectedTeams([]))}
          >
            {t('teams.clear')}
          </button>
        </div>

        {filteredTeams.length === 0 ? (
          <p className="reskill-section-sub reskill-team-nomatch">{t('teams.noMatches')}</p>
        ) : filteredTeams.map((team) => {
          const selected = selectedTeamIds.includes(team.id);
          return (
            // eslint-disable-next-line jsx-a11y/label-has-associated-control
            <label
              key={team.id}
              className={`reskill-team${selected ? ' reskill-team--selected' : ''}`}
            >
              <input
                type="checkbox"
                className="reskill-checkbox"
                checked={selected}
                onChange={() => dispatch(toggleTeam(team.id))}
              />
              <span className="reskill-team__body">
                <span className="reskill-team__name">{team.name}</span>
                <span className="reskill-team__count">
                  {t('teams.agentCount', { count: countByTeam.get(team.id) || 0 })}
                </span>
              </span>
            </label>
          );
        })}

        {selectedTeamIds.length > 0 && (
          <div className="reskill-team__summary">
            {t('teams.selectedSummary', { teams: selectedTeamIds.length, agents: selectedAgentCount })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamSelector;
