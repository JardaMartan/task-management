import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Badge, Button } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { SKILL_TYPES } from '../mock/mockData';
import { stageBulk, SKILL_TEMPLATES } from '../store/slices/reskillSlice';
import { agentsForTeams, effectiveValue } from '../selectors';

/** Normalize an agent's stored value for a skill to the type's canonical form. */
function baseValueFor(skill, raw) {
  if (skill.type === SKILL_TYPES.BOOLEAN) return Boolean(raw);
  if (skill.type === SKILL_TYPES.ENUM || skill.type === SKILL_TYPES.TEXT) return raw ?? '';
  return Number(raw ?? 0);
}

/** Build stageBulk entries for a set of skill→value changes over given agents. */
function buildEntries(agents, changes, skills) {
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const entries = [];
  agents.forEach((agent) => {
    Object.entries(changes).forEach(([skillId, value]) => {
      const skill = skillById.get(skillId);
      if (!skill) return;
      const baseValue = baseValueFor(skill, agent.skills?.[skillId]);
      entries.push({ agentId: agent.id, skillId, value, baseValue });
    });
  });
  return entries;
}

/** Fisher–Yates shuffle (returns a new array). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Right column: preconfigured mixes + percentage-based random generator. */
const QuickActions = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const skills = useSelector((s) => s.reskill.skills);
  const agents = useSelector((s) => s.reskill.agents);
  const selectedTeamIds = useSelector((s) => s.reskill.selectedTeamIds);
  const draft = useSelector((s) => s.reskill.draft);

  const scopedAgents = React.useMemo(
    () => agentsForTeams(agents, selectedTeamIds),
    [agents, selectedTeamIds],
  );
  const hasAgents = scopedAgents.length > 0;
  const skillById = React.useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  // ── Percentage generator local state ──────────────────────────────────────
  const [skillId, setSkillId] = React.useState('');
  const [percent, setPercent] = React.useState(50);
  const [level, setLevel] = React.useState(8);
  const [enabled, setEnabled] = React.useState(true);
  const [enumValue, setEnumValue] = React.useState('');
  const [textValue, setTextValue] = React.useState('');
  // Remembers the previous generation so each re-roll replaces it instead of
  // accumulating staged changes.
  const lastGenRef = React.useRef({ skillId: null, agentIds: [] });

  const selectedSkill = skills.find((s) => s.id === skillId) || null;
  const isBoolean = selectedSkill?.type === SKILL_TYPES.BOOLEAN;
  const isEnum = selectedSkill?.type === SKILL_TYPES.ENUM;
  const isText = selectedSkill?.type === SKILL_TYPES.TEXT;
  const affectedCount = Math.round((percent / 100) * scopedAgents.length);

  // Selecting an enum skill seeds the value picker with its first option.
  const onSelectSkill = (id) => {
    setSkillId(id);
    const skill = skills.find((s) => s.id === id);
    if (skill?.type === SKILL_TYPES.ENUM) setEnumValue(skill.values?.[0] || '');
  };

  const mixValue = () => {
    if (isBoolean) return Boolean(enabled);
    if (isEnum) return enumValue;
    if (isText) return textValue;
    return Number(level);
  };

  // Enum requires a chosen value; other types always have a usable value.
  const valueReady = !isEnum || Boolean(enumValue);

  const applyTemplate = (template) => {
    if (!hasAgents) return;
    dispatch(stageBulk(buildEntries(scopedAgents, template.changes, skills)));
  };

  // A template is "staged" when every scoped agent's effective value matches the
  // template AND at least one agent carries a staged override from it. Lets the
  // button flip to Revert so the supervisor can undo the staged change.
  const isTemplateStaged = (template) => {
    if (!hasAgents) return false;
    let anyOverride = false;
    const allMatch = scopedAgents.every((agent) => (
      Object.entries(template.changes).every(([sid, val]) => {
        const skill = skillById.get(sid);
        if (!skill) return true;
        if (draft[agent.id]?.[sid] !== undefined) anyOverride = true;
        const eff = baseValueFor(skill, effectiveValue(agent, sid, draft));
        return eff === baseValueFor(skill, val);
      })
    ));
    return allMatch && anyOverride;
  };

  // Revert a staged template: set each affected skill back to the agent's base
  // value (stageBulk clears the override when value === base).
  const revertTemplate = (template) => {
    const entries = [];
    scopedAgents.forEach((agent) => {
      Object.keys(template.changes).forEach((sid) => {
        const skill = skillById.get(sid);
        if (!skill) return;
        const baseValue = baseValueFor(skill, agent.skills?.[sid]);
        entries.push({ agentId: agent.id, skillId: sid, value: baseValue, baseValue });
      });
    });
    dispatch(stageBulk(entries));
  };

  const generatePercentageMix = () => {
    if (!hasAgents || !selectedSkill || !valueReady) return;
    const value = mixValue();

    // Revert the previous generation (set its agents' skill back to base) so a
    // re-roll produces a fresh distribution instead of accumulating changes.
    const prev = lastGenRef.current;
    const revertEntries = [];
    if (prev.skillId) {
      const prevSkill = skillById.get(prev.skillId);
      if (prevSkill) {
        prev.agentIds.forEach((id) => {
          const agent = agents.find((a) => a.id === id);
          if (!agent) return;
          const baseValue = baseValueFor(prevSkill, agent.skills?.[prev.skillId]);
          revertEntries.push({ agentId: id, skillId: prev.skillId, value: baseValue, baseValue });
        });
      }
    }

    const n = Math.round((percent / 100) * scopedAgents.length);
    const chosen = shuffle(scopedAgents).slice(0, n);
    const applyEntries = buildEntries(chosen, { [skillId]: value }, skills);

    // Apply entries come last so they win when an agent appears in both sets.
    dispatch(stageBulk([...revertEntries, ...applyEntries]));
    lastGenRef.current = { skillId, agentIds: chosen.map((a) => a.id) };
  };

  return (
    <div className="reskill-col">
      <div className="reskill-panel-head">
        <h3 className="reskill-section-title">{t('quickActions.title')}</h3>
      </div>
      <div className="reskill-col__pad">
        <p className="reskill-section-sub">{t('quickActions.subtitle')}</p>

      {/* ── Preconfigured templates ─────────────────────────────────────── */}
      <h4 className="reskill-subtitle">{t('quickActions.templatesTitle')}</h4>
      {SKILL_TEMPLATES.map((tpl) => {
        const staged = isTemplateStaged(tpl);
        return (
        <div key={tpl.id} className="reskill-template">
          <span className="reskill-template__name">{t(`templates.${tpl.i18nKey}.name`)}</span>
          <span className="reskill-template__desc">{t(`templates.${tpl.i18nKey}.desc`)}</span>
          <div className="reskill-chiprow">
            {Object.entries(tpl.changes).map(([sid, val]) => {
              const skill = skills.find((s) => s.id === sid);
              if (!skill) return null;
              const label = skill.type === SKILL_TYPES.BOOLEAN
                ? skill.name
                : `${skill.name} ${val}`;
              return <Badge key={sid} color="blue-pastel" rounded>{label}</Badge>;
            })}
          </div>
          <div className="reskill-template__foot">
            {staged ? (
              <Button
                color="default"
                size={28}
                onClick={() => revertTemplate(tpl)}
              >
                {t('quickActions.templateRevert')}
              </Button>
            ) : (
              <Button
                color="blue"
                size={28}
                disabled={!hasAgents}
                onClick={() => applyTemplate(tpl)}
              >
                {t('quickActions.templateApply')}
              </Button>
            )}
          </div>
        </div>
        );
      })}

      <hr className="reskill-divider" />

      {/* ── Percentage-based mix ────────────────────────────────────────── */}
      <h4 className="reskill-subtitle">{t('quickActions.percentTitle')}</h4>
      <p className="reskill-section-sub">{t('quickActions.percentHint')}</p>

      <div className="reskill-field">
        <label htmlFor="rk-skill">{t('quickActions.skillLabel')}</label>
        <select
          id="rk-skill"
          className="reskill-select"
          value={skillId}
          onChange={(e) => onSelectSkill(e.target.value)}
        >
          <option value="">{t('quickActions.selectSkill')}</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {selectedSkill && (
        isBoolean ? (
          <div className="reskill-field">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="reskill-toggle">
              <input
                type="checkbox"
                className="reskill-checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              {t('quickActions.enabledLabel')}
            </label>
          </div>
        ) : isEnum ? (
          <div className="reskill-field">
            <label htmlFor="rk-enum">{t('quickActions.valueLabel')}</label>
            <select
              id="rk-enum"
              className="reskill-select"
              value={enumValue}
              onChange={(e) => setEnumValue(e.target.value)}
            >
              {(selectedSkill.values || []).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        ) : isText ? (
          <div className="reskill-field">
            <label htmlFor="rk-text">{t('quickActions.valueLabel')}</label>
            <input
              id="rk-text"
              className="reskill-select"
              type="text"
              maxLength={selectedSkill.maxLength || 40}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
            />
          </div>
        ) : (
          <div className="reskill-field">
            <label htmlFor="rk-level">{t('quickActions.levelLabel')}: {level}</label>
            <input
              id="rk-level"
              className="reskill-range"
              type="range"
              min={0}
              max={selectedSkill.maxLevel || 10}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
          </div>
        )
      )}

      <div className="reskill-field">
        <label htmlFor="rk-pct">{t('quickActions.percentLabel')}: {percent}%</label>
        <div className="reskill-range-row">
          <input
            id="rk-pct"
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
          disabled={!hasAgents || !selectedSkill || !valueReady || affectedCount === 0}
          onClick={generatePercentageMix}
        >
          {t('quickActions.generate')}
        </Button>
      </div>
      </div>
    </div>
  );
};

export default QuickActions;
