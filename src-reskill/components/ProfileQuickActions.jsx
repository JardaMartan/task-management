import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Badge, Button } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { PROFILE_PRESETS } from '../mock/mockData';
import { stageProfileBulk } from '../store/slices/reskillSlice';
import { agentsForTeams } from '../selectors';

/** Fisher–Yates shuffle (returns a new array). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Right column for the profile-centric view: scenario profile assignments
 * (Stage/Revert) + percentage-based random profile distribution. Mirrors the
 * skill-grid QuickActions but operates on Skill Profiles instead of skill cells.
 */
const ProfileQuickActions = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const agents = useSelector((s) => s.reskill.agents);
  const skillProfiles = useSelector((s) => s.reskill.skillProfiles);
  const selectedTeamIds = useSelector((s) => s.reskill.selectedTeamIds);
  const profileDraft = useSelector((s) => s.reskill.profileDraft);

  const scopedAgents = React.useMemo(
    () => agentsForTeams(agents, selectedTeamIds),
    [agents, selectedTeamIds],
  );
  const hasAgents = scopedAgents.length > 0;
  const profById = React.useMemo(
    () => new Map(skillProfiles.map((p) => [p.id, p])),
    [skillProfiles],
  );

  // Only presets whose target profile exists in the loaded config.
  const presets = React.useMemo(
    () => PROFILE_PRESETS.filter((p) => profById.has(p.profileId)),
    [profById],
  );

  const effProfile = (agent) => profileDraft[agent.id] ?? agent.skillProfileId;

  // ── Percentage generator local state ──────────────────────────────────────
  const [profileId, setProfileId] = React.useState('');
  const [percent, setPercent] = React.useState(50);
  // Remembers the previous generation so each re-roll replaces it.
  const lastGenRef = React.useRef([]);

  const affectedCount = Math.round((percent / 100) * scopedAgents.length);

  const entriesFor = (list) => list.map((a) => ({ agentId: a.id, baseProfileId: a.skillProfileId }));

  const assignPreset = (preset) => {
    if (!hasAgents) return;
    dispatch(stageProfileBulk({ profileId: preset.profileId, entries: entriesFor(scopedAgents) }));
  };

  // A preset is "staged" when every scoped agent's effective profile is the
  // preset's profile AND at least one agent carries a staged override.
  const isPresetStaged = (preset) => {
    if (!hasAgents) return false;
    const anyOverride = scopedAgents.some((a) => profileDraft[a.id] !== undefined);
    const allMatch = scopedAgents.every((a) => effProfile(a) === preset.profileId);
    return allMatch && anyOverride;
  };

  // Revert: clear profile overrides for the scoped agents (falsy profileId
  // makes stageProfileBulk delete each entry → back to base profile).
  const revertPreset = () => {
    dispatch(stageProfileBulk({ profileId: '', entries: entriesFor(scopedAgents) }));
  };

  const generatePercentageMix = () => {
    if (!hasAgents || !profileId) return;
    const n = Math.round((percent / 100) * scopedAgents.length);
    const chosen = shuffle(scopedAgents).slice(0, n);

    // Revert the previous generation (clear those agents' profile overrides)
    // before applying the new selection, so a re-roll replaces rather than adds.
    const prevIds = lastGenRef.current;
    if (prevIds.length > 0) {
      const prevEntries = prevIds.map((id) => {
        const agent = agents.find((a) => a.id === id);
        return { agentId: id, baseProfileId: agent?.skillProfileId };
      });
      dispatch(stageProfileBulk({ profileId: '', entries: prevEntries }));
    }

    dispatch(stageProfileBulk({ profileId, entries: entriesFor(chosen) }));
    lastGenRef.current = chosen.map((a) => a.id);
  };

  return (
    <div className="reskill-col">
      <div className="reskill-panel-head">
        <h3 className="reskill-section-title">{t('quickActions.title')}</h3>
      </div>
      <div className="reskill-col__pad">
        <p className="reskill-section-sub">{t('profileActions.subtitle')}</p>

        {/* ── Scenario profile assignments ──────────────────────────────── */}
        <h4 className="reskill-subtitle">{t('profileActions.presetsTitle')}</h4>
        {presets.map((preset) => {
          const staged = isPresetStaged(preset);
          const profile = profById.get(preset.profileId);
          return (
            <div key={preset.id} className="reskill-template">
              <span className="reskill-template__name">{t(`profilePresets.${preset.i18nKey}.name`)}</span>
              <span className="reskill-template__desc">{t(`profilePresets.${preset.i18nKey}.desc`)}</span>
              <div className="reskill-chiprow">
                <Badge color="blue-pastel" rounded>{profile?.name || preset.profileId}</Badge>
              </div>
              <div className="reskill-template__foot">
                {staged ? (
                  <Button color="default" size={28} onClick={revertPreset}>
                    {t('quickActions.templateRevert')}
                  </Button>
                ) : (
                  <Button color="blue" size={28} disabled={!hasAgents} onClick={() => assignPreset(preset)}>
                    {t('quickActions.templateApply')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <hr className="reskill-divider" />

        {/* ── Percentage-based profile distribution ─────────────────────── */}
        <h4 className="reskill-subtitle">{t('profileActions.percentTitle')}</h4>
        <p className="reskill-section-sub">{t('profileActions.percentHint')}</p>

        <div className="reskill-field">
          <label htmlFor="rk-pa-profile">{t('profileActions.profileLabel')}</label>
          <select
            id="rk-pa-profile"
            className="reskill-select"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            <option value="">{t('profiles.selectProfile')}</option>
            {skillProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="reskill-field">
          <label htmlFor="rk-pa-pct">{t('quickActions.percentLabel')}: {percent}%</label>
          <div className="reskill-range-row">
            <input
              id="rk-pa-pct"
              className="reskill-range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="reskill-affected">
          {t('quickActions.affected', { count: affectedCount })}
        </div>

        <div className="reskill-range-row">
          <Button
            color="blue"
            disabled={!hasAgents || !profileId || affectedCount === 0}
            onClick={generatePercentageMix}
          >
            {t('quickActions.generate')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileQuickActions;
