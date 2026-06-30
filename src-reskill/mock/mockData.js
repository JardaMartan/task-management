// Mock contact-center configuration for the Bulk Reskilling widget (demo mode).
// Mirrors the shape we expect back from the Webex CC Configuration APIs:
//   - skills:  { id, name, type, maxLevel?, values?, maxLength? }
//   - teams:   { id, name }
//   - agents:  { id, name, teamId, skillProfileId, skills: { [skillId]: value } }
//
// Webex CC supports four skill types; `value` is shaped per type:
//   - proficiency → number 0–10 (maxLevel)
//   - boolean     → true / false
//   - enum        → one string from the skill's predefined `values` list
//   - text        → free-form string (matched exactly; up to `maxLength` chars)

export const SKILL_TYPES = {
  PROFICIENCY: 'proficiency',
  BOOLEAN: 'boolean',
  TEXT: 'text',
  ENUM: 'enum',
};

// Predefined value list for the enum skill below.
const SUPPORT_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

// Org-defined skills — a realistic mix covering all four Webex CC skill types.
const SKILLS = [
  { id: 'sk_billing',     name: 'Billing',          type: SKILL_TYPES.PROFICIENCY, maxLevel: 10 },
  { id: 'sk_sales',       name: 'Sales',            type: SKILL_TYPES.PROFICIENCY, maxLevel: 10 },
  { id: 'sk_tech',        name: 'Technical Support',type: SKILL_TYPES.PROFICIENCY, maxLevel: 10 },
  { id: 'sk_collections', name: 'Collections',      type: SKILL_TYPES.PROFICIENCY, maxLevel: 10 },
  { id: 'sk_spanish',     name: 'Spanish',          type: SKILL_TYPES.PROFICIENCY, maxLevel: 10 },
  { id: 'sk_escalations', name: 'Escalations',      type: SKILL_TYPES.BOOLEAN },
  { id: 'sk_vip',         name: 'VIP Desk',         type: SKILL_TYPES.BOOLEAN },
  { id: 'sk_retention',   name: 'Retention',        type: SKILL_TYPES.BOOLEAN },
  { id: 'sk_tier',        name: 'Support Tier',     type: SKILL_TYPES.ENUM, values: SUPPORT_TIERS },
  { id: 'sk_langcode',    name: 'Language Code',    type: SKILL_TYPES.TEXT, maxLength: 40 },
];

const TEAMS = [
  { id: 'tm_inbound',  name: 'Inbound Care' },
  { id: 'tm_sales',    name: 'Sales East' },
  { id: 'tm_tech',     name: 'Tier-2 Technical' },
  { id: 'tm_retention',name: 'Retention & Collections' },
];

// Deterministic pseudo-random so the demo is stable across reloads.
let seed = 1337;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function level(min, max) {
  return Math.round(min + rand() * (max - min));
}
function chance(p) {
  return rand() < p;
}
function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

// Free-text values an agent might carry for the text skill.
const LANGUAGE_CODES = ['EN', 'EN-ES', 'EN-DE', 'EN-CS', 'EN-FR', ''];

const FIRST = ['Alex', 'Jordan', 'Casey', 'Riley', 'Sam', 'Taylor', 'Morgan', 'Jamie',
  'Avery', 'Quinn', 'Drew', 'Reese', 'Skyler', 'Hayden', 'Cameron', 'Devon',
  'Jana', 'Petr', 'Lucia', 'Marco', 'Nadia', 'Omar', 'Sofia', 'Tomas'];
const LAST = ['Novak', 'Garcia', 'Smith', 'Patel', 'Kim', 'Rossi', 'Dubois', 'Haas',
  'Silva', 'Meyer', 'Okafor', 'Lopez', 'Chen', 'Ivanov', 'Costa', 'Berg'];

function buildAgents() {
  const agents = [];
  const perTeam = [7, 6, 6, 6];
  let n = 0;
  TEAMS.forEach((team, ti) => {
    for (let i = 0; i < perTeam[ti]; i++) {
      const name = `${FIRST[n % FIRST.length]} ${LAST[n % LAST.length]}`;
      n++;
      // Base skill values shaped loosely by the team's specialty.
      const skills = {
        sk_billing:     ti === 0 ? level(4, 9) : level(0, 5),
        sk_sales:       ti === 1 ? level(5, 10) : level(0, 4),
        sk_tech:        ti === 2 ? level(5, 10) : level(0, 4),
        sk_collections: ti === 3 ? level(4, 9) : level(0, 3),
        sk_spanish:     level(0, 8),
        sk_escalations: ti === 2 ? chance(0.6) : chance(0.2),
        sk_vip:         chance(0.18),
        sk_retention:   ti === 3 ? chance(0.7) : chance(0.15),
        // enum: one tier from the predefined list (VIP-heavy teams skew higher)
        sk_tier:        ti === 3 ? pick(['Silver', 'Gold', 'Gold', 'Platinum']) : pick(SUPPORT_TIERS),
        // text: free-form language code (some agents have none)
        sk_langcode:    pick(LANGUAGE_CODES),
      };
      agents.push({
        id: `ag_${String(n).padStart(3, '0')}`,
        name,
        teamId: team.id,
        skillProfileId: `sp_${team.id}`,
        skills,
      });
    }
  });
  return agents;
}

const AGENTS = buildAgents();

// ── Skill Profiles ───────────────────────────────────────────────────────────
// In Webex CC the Skill Profile is the real unit of assignment: a reusable named
// bundle of (skill → value) pairs assigned to an agent (a Team can also carry a
// default profile). Agents reference one via skillProfileId. These ids line up
// with the per-team defaults set in buildAgents (sp_<teamId>), plus a few
// cross-functional profiles a supervisor might reassign agents to.
const SKILL_PROFILES = [
  { id: 'sp_tm_inbound',   name: 'Inbound Care',           skills: { sk_billing: 7, sk_spanish: 5, sk_escalations: false, sk_tier: 'Silver' } },
  { id: 'sp_tm_sales',     name: 'Sales East',             skills: { sk_sales: 8, sk_spanish: 4, sk_tier: 'Gold' } },
  { id: 'sp_tm_tech',      name: 'Tier-2 Technical',       skills: { sk_tech: 8, sk_escalations: true, sk_vip: true, sk_tier: 'Gold' } },
  { id: 'sp_tm_retention', name: 'Retention & Collections',skills: { sk_collections: 8, sk_retention: true, sk_tier: 'Silver' } },
  { id: 'sp_bilingual',    name: 'Bilingual Support',      skills: { sk_spanish: 9, sk_billing: 5 } },
  { id: 'sp_vip',          name: 'VIP Desk',               skills: { sk_vip: true, sk_escalations: true, sk_tier: 'Platinum' } },
  { id: 'sp_generalist',   name: 'Generalist',             skills: { sk_billing: 4, sk_sales: 4, sk_tech: 4 } },
];

/**
 * Return a deep-ish clone of the mock configuration so callers can mutate freely.
 */
export function getMockConfig() {
  return {
    skills: SKILLS.map((s) => ({ ...s, ...(s.values ? { values: [...s.values] } : {}) })),
    teams: TEAMS.map((t) => ({ ...t })),
    agents: AGENTS.map((a) => ({ ...a, skills: { ...a.skills } })),
    skillProfiles: SKILL_PROFILES.map((p) => ({ ...p, skills: { ...p.skills } })),
  };
}

// Preconfigured "skill mix" templates surfaced as quick actions. Each template
// lists target skill values applied to every selected agent when staged.
// i18nKey points at translations.templates.<key> for name + description.
export const SKILL_TEMPLATES = [
  {
    id: 'holidaySurge',
    i18nKey: 'holidaySurge',
    icon: 'gift_16',
    changes: { sk_billing: 8, sk_sales: 6, sk_escalations: true },
  },
  {
    id: 'outageResponse',
    i18nKey: 'outageResponse',
    icon: 'tools_16',
    changes: { sk_tech: 9, sk_escalations: true, sk_vip: true },
  },
  {
    id: 'bilingualPush',
    i18nKey: 'bilingualPush',
    icon: 'chat_16',
    changes: { sk_spanish: 8 },
  },
  {
    id: 'collectionsFocus',
    i18nKey: 'collectionsFocus',
    icon: 'handset_16',
    changes: { sk_collections: 8, sk_retention: true },
  },
];

// Profile-assignment scenario presets surfaced as quick actions in the
// profile-centric view. Each maps a named scenario to a target Skill Profile id.
// i18nKey points at translations.profilePresets.<key> for name + description.
export const PROFILE_PRESETS = [
  { id: 'surge',      i18nKey: 'surge',      profileId: 'sp_generalist' },
  { id: 'escalation', i18nKey: 'escalation', profileId: 'sp_tm_tech' },
  { id: 'bilingual',  i18nKey: 'bilingual',  profileId: 'sp_bilingual' },
  { id: 'vip',        i18nKey: 'vip',        profileId: 'sp_vip' },
];

