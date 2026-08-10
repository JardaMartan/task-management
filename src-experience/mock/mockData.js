// Deterministic demo data for the Agent Experience widget. Used when the Desktop
// SDK / live credentials are unavailable, or when the `view` prop forces mock.
//
// Templates are LANGUAGE-GROUPED: each logical template carries per-language
// `variants` ({ name, subject, body }). The supervisor picks a language first;
// the whole set then displays in that language, and a template missing that
// flavor shows an empty editor ready to be filled in. (Sourced from the task
// widget's en/de/cs email mock data.)

import { DEFAULT_PROOFREAD_PROMPT } from '../constants';

const MOCK_LANGUAGES = ['en', 'de', 'cs'];
const RE_SUBJECT = 'Re: {{subject}}';

const MOCK_TEAMS = [
  { id: 'team-support-en', name: 'Support — English' },
  { id: 'team-support-de', name: 'Support — Deutsch' },
  { id: 'team-billing', name: 'Billing & Payments' },
  { id: 'team-retention', name: 'Retention' },
  { id: 'team-escalations', name: 'Escalations' },
];

// Logical templates → per-language variants. Some flavors are intentionally
// missing (follow-up only in EN; payment/security have no DE) to exercise the
// availability indicators and the empty-flavor editor.
const MOCK_TEMPLATES = [
  {
    id: 'greeting',
    category: 'greeting',
    variables: ['customerName', 'agentName'],
    variants: {
      en: { name: 'Welcome Greeting', subject: RE_SUBJECT, body: '<p>Dear {{customerName}},</p><p>Thank you for contacting Innogy. My name is {{agentName}} and I will be assisting you today.</p><p>I have reviewed your enquiry and will respond shortly with a full resolution.</p><p>Please feel free to let me know if you have any additional information to share.</p>' },
      de: { name: 'Begrüßung', subject: RE_SUBJECT, body: '<p>Sehr geehrte(r) {{customerName}},</p><p>vielen Dank für Ihre Kontaktaufnahme mit der Innogy. Mein Name ist {{agentName}} und ich stehe Ihnen heute gerne zur Verfügung.</p><p>Ich habe Ihre Anfrage geprüft und werde Ihnen in Kürze eine vollständige Antwort zukommen lassen.</p>' },
      cs: { name: 'Úvodní pozdrav', subject: RE_SUBJECT, body: '<p>Vážený/á {{customerName}},</p><p>děkujeme Vám za kontaktování Innogy. Jmenuji se {{agentName}} a dnes Vám budu pomáhat s Vaší žádostí.</p><p>Vaší otázce jsem věnoval/a pozornost a brzy Vás kontaktuji s plným vyřešením.</p>' },
    },
  },
  {
    id: 'followup',
    category: 'follow-up',
    variables: ['customerName', 'date'],
    variants: {
      en: { name: 'Follow-Up', subject: RE_SUBJECT, body: '<p>Dear {{customerName}},</p><p>I am following up on our previous correspondence from {{date}}.</p><p>Could you please let us know if the issue has been resolved to your satisfaction, or if there is anything further we can assist you with?</p>' },
    },
  },
  {
    id: 'apology',
    category: 'apology',
    variables: ['customerName', 'agentName'],
    variants: {
      en: { name: 'Sincere Apology', subject: RE_SUBJECT, body: '<p>Dear {{customerName}},</p><p>I sincerely apologise for the inconvenience this situation has caused you. We fully understand how frustrating this must be.</p><p>I assure you that this matter is being treated as a priority and I am personally overseeing its resolution. We will keep you updated every step of the way.</p><p>Thank you for your patience and understanding.</p>' },
      de: { name: 'Entschuldigung', subject: RE_SUBJECT, body: '<p>Sehr geehrte(r) {{customerName}},</p><p>wir möchten uns aufrichtig für die entstandenen Unannehmlichkeiten entschuldigen. Wir verstehen vollkommen, wie frustrierend diese Situation sein muss.</p><p>Wir versichern Ihnen, dass diese Angelegenheit mit höchster Priorität behandelt wird.</p>' },
      cs: { name: 'Omluva', subject: RE_SUBJECT, body: '<p>Vážený/á {{customerName}},</p><p>v první řadě se Vám omlouváme za vzniklou komplikaci. Plně rozumíme, jak nepříjemná tato situace může být.</p><p>Ujistěte se, že Váš požadavek řešíme jako prioritní. Budeme Vás průběžně informovat o postupu.</p>' },
    },
  },
  {
    id: 'resolution',
    category: 'resolution',
    variables: ['customerName'],
    variants: {
      en: { name: 'Issue Resolved', subject: RE_SUBJECT, body: '<p>Dear {{customerName}},</p><p>I am pleased to inform you that your recent enquiry has now been fully resolved.</p><p>Here is a summary of the actions taken:</p><ul><li>Your account has been reviewed and updated</li><li>The relevant team has been notified</li><li>All necessary changes have been applied</li></ul><p>Should you have any further questions, please do not hesitate to contact us.</p>' },
      de: { name: 'Abschluss', subject: RE_SUBJECT, body: '<p>Sehr geehrte(r) {{customerName}},</p><p>wir freuen uns, Ihnen mitteilen zu können, dass Ihre Anfrage vollständig bearbeitet wurde.</p><p>Sollten Sie weitere Fragen haben, stehen wir Ihnen jederzeit gerne zur Verfügung.</p>' },
      cs: { name: 'Vyřízení', subject: RE_SUBJECT, body: '<p>Vážený/á {{customerName}},</p><p>s radostí Vám oznamujeme, že Vaše žádost byla plně vyřízena.</p><p>Pokud máte jakékoliv další dotazy, neváhejte nás kontaktovat. Rádi Vám pomůžeme.</p>' },
    },
  },
  {
    id: 'payment',
    category: 'billing',
    variables: ['customerName', 'orderNumber'],
    variants: {
      en: { name: 'Payment Query', subject: RE_SUBJECT, body: '<p>Dear {{customerName}},</p><p>Thank you for contacting us regarding your payment.</p><p>We have located your transaction and are currently reviewing the details. Please note that payment processing typically takes <strong>1–3 business days</strong>.</p><p>If you have any documentation or reference numbers related to this transaction, please share them with us to expedite the process.</p>' },
      cs: { name: 'Dotaz k platbě', subject: RE_SUBJECT, body: '<p>Vážený/á {{customerName}},</p><p>děkujeme za Vaši zprávu ohledně Vaší platby.</p><p>Vaší transakci jsme dohledali a aktuálně procházíme její podrobnosti. Standardní zpracování platby trvá <strong>1–3 pracovní dny</strong>.</p>' },
    },
  },
  {
    id: 'security',
    category: 'general',
    variables: ['customerName'],
    variants: {
      en: { name: 'Security Verification', subject: RE_SUBJECT, body: '<p>Dear {{customerName}},</p><p>For the security of your account, we need to verify your identity before proceeding.</p><p>Please confirm the following:</p><ol><li>Your registered email address</li><li>The last 4 digits of your registered phone number</li><li>Your date of birth</li></ol><p>Once verified, we will be able to assist you immediately.</p>' },
      cs: { name: 'Bezpečnostní ověření', subject: RE_SUBJECT, body: '<p>Vážený/á {{customerName}},</p><p>z bezpečnostních důvodů potřebujeme ověřit Vaši totožnost dříve, než budeme moci pokračovat.</p><p>Prosíme potvrďte následující:</p><ol><li>Vaši registrovanou e-mailovou adresu</li><li>Poslední 4 číslice Vašeho registrovaného telefonu</li><li>Vaše datum narození</li></ol>' },
    },
  },
];

// Signatures are LANGUAGE-GROUPED too: each logical signature has per-language
// variants { name, html }. 'brief' is EN-only to exercise the missing-flavor UI.
const MOCK_SIGNATURES = [
  {
    id: 'standard',
    variants: {
      en: { name: 'Standard', html: '<p style="font-size:12px;color:#545454">Kind regards,<br><strong>{{agentName}}</strong><br>Customer Support | Innogy<br>+44 20 7946 0800</p>' },
      de: { name: 'Standard', html: '<p style="font-size:12px;color:#545454">Mit freundlichen Grüßen,<br><strong>{{agentName}}</strong><br>Kundenservice | Innogy</p>' },
      cs: { name: 'Standard', html: '<p style="font-size:12px;color:#545454">S pozdravem,<br><strong>{{agentName}}</strong><br>Zákaznická podpora | Innogy</p>' },
    },
  },
  {
    id: 'brief',
    variants: {
      en: { name: 'Brief', html: '<p style="font-size:12px;color:#545454">Best regards, {{agentName}} &mdash; Innogy Support</p>' },
    },
  },
];

// Many-to-many: itemId → [teamId, …]. Templates are keyed by their logical id
// (shared across languages); a team gets the template in the agent's language.
const MOCK_TEMPLATE_ASSIGNMENTS = {
  greeting: ['team-support-en', 'team-support-de', 'team-billing', 'team-retention'],
  apology: ['team-support-en', 'team-escalations'],
  resolution: ['team-support-en', 'team-billing'],
  payment: ['team-billing'],
  security: ['team-support-en'],
  followup: ['team-retention'],
};

const MOCK_SIGNATURE_ASSIGNMENTS = {
  standard: ['team-support-en', 'team-support-de', 'team-billing', 'team-retention', 'team-escalations'],
  brief: ['team-retention'],
};

// Per-team proofread prompt overrides (default = org-wide fallback).
const MOCK_PROMPTS = {
  default: DEFAULT_PROOFREAD_PROMPT,
  teams: {
    'team-escalations': `${DEFAULT_PROOFREAD_PROMPT}\n\nAdditional guidance for Escalations: be extra empathetic, acknowledge the customer's frustration explicitly, and never make commitments about compensation without a placeholder for the agent to confirm.`,
  },
};

/** Full demo configuration for the widget. */
export function getMockTeams() {
  return MOCK_TEAMS.map((t) => ({ ...t }));
}

export function getMockConfig() {
  return {
    languages: [...MOCK_LANGUAGES],
    templates: JSON.parse(JSON.stringify(MOCK_TEMPLATES)),
    signatures: JSON.parse(JSON.stringify(MOCK_SIGNATURES)),
    templateAssignments: JSON.parse(JSON.stringify(MOCK_TEMPLATE_ASSIGNMENTS)),
    signatureAssignments: JSON.parse(JSON.stringify(MOCK_SIGNATURE_ASSIGNMENTS)),
    proofreadPrompts: JSON.parse(JSON.stringify(MOCK_PROMPTS)),
  };
}
