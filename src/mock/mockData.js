/**
 * src/mock/mockData.js
 *
 * Centralised demo/mock data for all widget views.
 * Each locale gets a full, culturally-appropriate data set:
 *   en — Sarah Johnson · ACME Corp Ltd · London
 *   de — Anna Müller   · Bavarian Tech GmbH · München
 *   cs — Jana Nováková · Praha Systems s.r.o. · Praha
 *
 * Usage:
 *   const { locale } = useI18n();
 *   const mock = getMockData(locale);
 *
 * Data shape:
 *   mock.customer          – customer card fields
 *   mock.cases             – CasesView case list
 *   mock.voice             – VoiceWidget calls / transcript / AI / openCases
 *   mock.chat              – ChatWidget conversations / messages / AI / openCases
 *   mock.history           – HistoryView events + AI summary
 *   mock.analytics.cases   – CasesAnalyticsBar data
 *   mock.analytics.history – HistoryAnalyticsBar data
 *   mock.analytics.voice   – VoiceAnalyticsBar data
 *   mock.analytics.chat    – ChatAnalyticsBar data
 */

// ─── Shared reference numbers (system identifiers stay locale-neutral) ─────
const REF = {
  case1: 'CASE-2024-0892',
  case2: 'CASE-2024-0784',
  case3: 'CASE-2024-0651',
  case4: 'CASE-2024-0445',
  case5: 'CASE-2024-0312',
  case6: 'CASE-2025-0104',
  sepaRef: 'SEPA-20250529-8821',
  invoice: 'INV-2024-0892',
  amount: '€12,500',
  supplier: 'Technologix GmbH',
  account: '40-2291-886',
};

// ─── Helper: compute timestamps relative to now ─────────────────────────────
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const H = 3_600_000;
const D = 86_400_000;

// ─── 90-day trend series (shared across locales — values are locale-neutral) ─
/**
 * Deterministic pseudo-random trend generator (LCG).
 * Returns `len` values around `base` ± `variance`.
 * When `decimal` is true, values are rounded to 1 decimal place.
 */
const makeTrend = (seed, base, variance, len = 90, decimal = false) => {
  let v = seed >>> 0;
  return Array.from({ length: len }, () => {
    v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
    const raw = base + ((v / 0xffffffff) - 0.5) * variance * 2;
    return decimal ? Math.round(Math.max(0, raw) * 10) / 10 : Math.max(0, Math.round(raw));
  });
};

const TREND = {
  // Cases
  casesNew:        makeTrend(0xA1B2C3, 10,  5),
  casesResolution: makeTrend(0xD4E5F6, 20, 10),
  // History
  histVolume:      makeTrend(0x11223344, 17,  7),
  histAht:         makeTrend(0x55667788, 6.8, 2, 90, true),
  // Voice
  voiceVolume:     makeTrend(0x99AABBCC, 6,   3),
  voiceAht:        makeTrend(0xDDEEFF00, 305, 40),
  // Chat
  chatVolume:      makeTrend(0x12345678, 4,   2),
  chatAht:         makeTrend(0x87654321, 5.2, 1.5, 90, true),
  // Email
  emailVolume:     makeTrend(0xFEDCBA98, 2,   1),
  emailReplyTime:  makeTrend(0x0F1E2D3C, 4.2, 1,   90, true),
};

// ═══════════════════════════════════════════════════════════════════════════
// ENGLISH
// ═══════════════════════════════════════════════════════════════════════════
const EN = {
  customer: {
    name: 'Sarah Johnson',
    email: 'sarah.j@acme-corp.com',
    phone: '+44 20 7946 0958',
    company: 'ACME Corp Ltd',
    city: 'London',
    country: 'GB',
  },
  agents: {
    primary:   'Agent Thompson',
    secondary: 'Agent Chen',
    tertiary:  'Agent Williams',
    fourth:    'Agent Martinez',
    fifth:     'Agent Schmidt',
  },

  // ── CasesView ───────────────────────────────────────────────────────────
  cases: [
    {
      id: REF.case1, caseId: REF.case1, status: 'in progress', priority: 'high', category: 'payment',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-06-03T12:00:00Z', owner: 'Agent Thompson', _isActive: true,
      description: `Customer reports repeated payment failure for Invoice #${REF.invoice} (${REF.amount}). Third follow-up in 5 days. SEPA transfer ref: ${REF.sepaRef} debited from customer account but not reflected in system. Escalating to supervisor level.`,
    },
    {
      id: REF.case2, caseId: REF.case2, status: 'open', priority: 'medium', category: 'technical',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-05-28T09:30:00Z', owner: 'Agent Chen',
      description: 'Online banking login failure after password reset. Customer unable to access account for 2 days. Two-factor authentication not delivering SMS codes.',
    },
    {
      id: REF.case3, caseId: REF.case3, status: 'in progress', priority: 'medium', category: 'account',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-05-10T14:15:00Z', owner: 'Agent Schmidt',
      description: 'Customer disputes overdraft fee of €45 charged on 8 May. Payment processor delay caused temporary balance mismatch. Back-office review in progress.',
    },
    {
      id: REF.case4, caseId: REF.case4, status: 'closed', priority: 'low', category: 'fraud',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-04-02T10:00:00Z', owner: 'Agent Williams',
      description: 'Card blocked during international travel to the United States. Identity verified via video call. Card reactivated within 20 minutes. Customer satisfied.',
    },
    {
      id: REF.case5, caseId: REF.case5, status: 'closed', priority: 'low', category: 'payment',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-03-15T08:45:00Z', owner: 'Agent Martinez',
      description: 'SEPA transfer to supplier delayed 3 business days due to AML screening threshold trigger. Resolved and funds credited. Customer notified with apology.',
    },
    {
      id: REF.case6, caseId: REF.case6, status: 'open', priority: 'medium', category: 'lending',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-06-04T16:20:00Z', owner: 'Agent Chen',
      description: 'Customer enquiring about Gold tier mortgage refinancing offer following ECB rate cut notification. Requesting full rate comparison and cost illustration for fixed-rate conversion from 4.7% variable to 3.9% fixed (5-year term). Lending advisor call scheduled.',
    },
    {
      id: 'CASE-2025-0115', caseId: 'CASE-2025-0115', status: 'open', priority: 'critical', category: 'payment',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: ago(1 * D), owner: 'Agent Thompson',
      description: 'Unauthorised card transaction of €4,200 at an unrecognised merchant (online, Eastern Europe). Customer denies authorisation. Chargeback investigation opened. Card temporarily blocked pending fraud team review.',
    },
    {
      id: 'CASE-2025-0097', caseId: 'CASE-2025-0097', status: 'in progress', priority: 'high', category: 'fraud',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: ago(3 * D), owner: 'Agent Williams',
      description: 'Three failed login attempts from an unrecognised device (IP: Bulgaria). Biometric challenge triggered. Customer confirmed they were not attempting to log in. Account access restricted pending identity re-verification.',
    },
    {
      id: 'CASE-2025-0076', caseId: 'CASE-2025-0076', status: 'in progress', priority: 'high', category: 'payment',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: ago(4 * D), owner: 'Agent Martinez',
      description: `SWIFT payment of ${REF.amount} to ${REF.supplier} delayed 4 business days. Correspondent bank compliance hold triggered. Beneficiary bank confirmation pending. Escalated to international payments team.`,
    },
    {
      id: 'CASE-2025-0108', caseId: 'CASE-2025-0108', status: 'resolved', priority: 'medium', category: 'technical',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: ago(5 * D), owner: 'Agent Chen',
      description: 'Customer unable to complete biometric enrollment on new iPhone 15 Pro. FaceID data not syncing with Moneta Bank app v3.2. Workaround: manual PIN fallback enabled. Permanent fix deployed in app update v3.2.1.',
    },
    {
      id: 'CASE-2025-0089', caseId: 'CASE-2025-0089', status: 'resolved', priority: 'medium', category: 'account',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: ago(12 * D), owner: 'Agent Chen',
      description: 'Customer requested update to standing order beneficiary details — new account number for regular supplier payment. IBAN validated. Update processed. Next payment will use the new details.',
    },
    {
      id: 'CASE-2025-0031', caseId: 'CASE-2025-0031', status: 'resolved', priority: 'low', category: 'general',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: ago(25 * D), owner: 'Agent Schmidt',
      description: 'Customer requested paper statements for last 6 months and confirmed postal address update. Statements dispatched by recorded post. Address updated in CRM. Opted in for future e-statements.',
    },
  ],

  // ── VoiceWidget ─────────────────────────────────────────────────────────
  voice: {
    calls: [
      { id: 'call-1', taskId: 'task-2024-0892-voice-2', active: true,  customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '09:41',     durationSec: 847, direction: 'inbound',  queue: 'Priority Banking', caseId: REF.case1, sentiment: 'negative', outcome: null, outcomeKey: null },
      { id: 'call-2', taskId: 'task-2024-0784-voice-1', active: false, customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '2025-05-29', durationSec: 312, direction: 'outbound', queue: 'Callback',         caseId: REF.case2, sentiment: 'positive', outcome: 'Resolved', outcomeKey: 'resolved' },
      { id: 'call-3', taskId: 'task-2024-0651-voice-1', active: false, customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '2025-04-14', durationSec: 489, direction: 'inbound',  queue: 'General Banking',  caseId: REF.case3, sentiment: 'neutral',  outcome: 'Transferred', outcomeKey: 'transferred' },
      { id: 'call-4', taskId: 'task-2024-0445-voice-1', active: false, customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '2025-03-01', durationSec: 228, direction: 'inbound',  queue: 'General Banking',  caseId: REF.case4, sentiment: 'positive', outcome: 'Resolved', outcomeKey: 'resolved' },
    ],
    transcript: [
      { id: 't0', role: 'system', text: 'Inbound call connected · Sarah Johnson · Priority Banking · 09:41' },
      { id: 't1', role: 'customer', speaker: 'Sarah Johnson', text: `Good morning. I'm Sarah Johnson, account number ${REF.account}. I placed a SEPA transfer on Tuesday — reference ${REF.sepaRef} — and the funds still haven't arrived. This is a business payment and my supplier's invoice was due yesterday.`, time: '00:12' },
      { id: 't2', role: 'agent', speaker: 'Agent Thompson', text: `Good morning, Ms. Johnson. I can see your account. Let me pull up the transfer right away — ${REF.sepaRef}. One moment please.`, time: '00:42' },
      { id: 't3', role: 'customer', speaker: 'Sarah Johnson', text: `The invoice amount was ${REF.amount}. It's for invoice ${REF.invoice}. My supplier is ${REF.supplier} in Munich.`, time: '01:05' },
      { id: 't4', role: 'agent', speaker: 'Agent Thompson', text: "Thank you. I can see the payment is currently showing a compliance hold — our fraud screening flagged the transaction due to the amount. I'm escalating this to the payments team now and this should be cleared within the next two hours.", time: '01:28' },
      { id: 't5', role: 'customer', speaker: 'Sarah Johnson', text: "Two hours? This is completely unacceptable. My supplier said they'll put our account on hold if they don't receive payment today.", time: '01:58' },
      { id: 't6', role: 'agent', speaker: 'Agent Thompson', text: "I completely understand your frustration, Ms. Johnson. I'm going to mark this as urgent and personally ensure the payments escalation team prioritises it. You'll receive an SMS confirmation as soon as the hold is released.", time: '02:18' },
      { id: 't7', role: 'system', text: '⟳ Live transcription in progress…', live: true },
    ],
    aiSummary: {
      headline: `SEPA transfer blocked — urgent resolution required`,
      points: [
        `Customer: Sarah Johnson · Acct ${REF.account} · Priority Banking tier`,
        `Transfer ${REF.sepaRef} for ${REF.amount} to ${REF.supplier} flagged by fraud screening`,
        `Invoice ${REF.invoice} overdue; supplier threatening to place account on hold`,
        'Agent escalated to payments team — ETA 2 hours; SMS confirmation committed',
        'Overall sentiment: Negative → improving after escalation commitment',
      ],
      sentiment: 'negative',
      intent: 'Payment dispute — SEPA transfer delay',
      suggestedActions: [
        { id: 'a1', label: 'Create Case', type: 'action', description: 'Open a new Priority case for this transfer dispute' },
        { id: 'a2', label: 'Send SMS Update', type: 'action', description: 'Send SMS to customer confirming escalation and 2h ETA' },
        { id: 'a3', label: 'Transfer to Payments', type: 'transfer', description: 'Warm transfer to the Payments Escalation team' },
      ],
    },
    openCases: [
      { id: REF.case1, title: `SEPA Transfer Dispute — ${REF.amount}`, status: 'Open',   priority: 'High' },
      { id: REF.case2, title: 'Login failure after password reset',      status: 'Closed', priority: 'Low'  },
      { id: REF.case3, title: 'Overdraft fee dispute — €45',             status: 'Closed', priority: 'Low'  },
    ],
  },

  // ── ChatWidget ──────────────────────────────────────────────────────────
  chat: {
    conversations: [
      { id: 'conv-1', taskId: 'task-2024-0892-wa-1',    channel: 'whatsapp', active: true,  statusKey: 'active',   customer: 'Sarah Johnson', snippet: "SEPA transfer still hasn't processed…", time: '14 min', status: 'Active',   caseId: REF.case1 },
      { id: 'conv-2', taskId: 'task-2024-0784-chat-1',  channel: 'webchat',  active: false, statusKey: 'resolved', customer: 'Sarah Johnson', snippet: 'Login failure after password reset…',   time: '8d',     status: 'Resolved', caseId: REF.case2 },
      { id: 'conv-3', taskId: 'task-2024-0651-sms-1',   channel: 'sms',      active: false, statusKey: 'resolved', customer: 'Sarah Johnson', snippet: 'Overdraft fee query — €45 charge…',     time: '26d',    status: 'Resolved', caseId: REF.case3 },
      { id: 'conv-4', taskId: 'task-2024-0445-inapp-1', channel: 'in-app',   active: false, statusKey: 'resolved', customer: 'Sarah Johnson', snippet: 'Card blocked in New York, need help',   time: '63d',    status: 'Resolved', caseId: REF.case4 },
    ],
    messages: [
      { id: 'm0', role: 'system', text: 'Sarah Johnson connected via WhatsApp · 14 min ago' },
      { id: 'm1', role: 'customer', text: `I still haven't received any update on my SEPA transfer. My reference is ${REF.sepaRef}. This is really urgent — my invoice deadline was yesterday.`, time: '14 min ago' },
      { id: 'm2', role: 'customer', text: `Invoice #${REF.invoice} for ${REF.amount}. My supplier is now threatening to put our account on hold.`, time: '13 min ago' },
      { id: 'm3', role: 'agent',    text: "Hi Sarah! I can see your account and the payment details right here. I'm looking into this immediately — please give me just a moment.", time: '12 min ago' },
      { id: 'm4', role: 'agent',    text: `I can see this is linked to ${REF.case1}, which has already been escalated to our payments team. The SEPA transfer has been received but is currently pending a routine compliance review.`, time: '11 min ago' },
      { id: 'm5', role: 'customer', text: "Compliance check? This is a regular monthly supplier payment — I've done this exact transfer for two years!", time: '9 min ago' },
      { id: 'm6', role: 'agent',    text: "Completely understood, Sarah. This is an automated check that triggers for transfers above €10,000. Given your history with us, I'm escalating now to our senior payments officer. You should have a resolution within 2 hours.", time: '7 min ago' },
    ],
    aiSuggestions: [
      { label: 'Escalate & Confirm', text: `I've just escalated ${REF.case1} to Priority 1. Our senior payments officer will contact you directly within the next 2 hours to confirm the release of ${REF.sepaRef}.` },
      { label: 'Resolution Ready',   text: `Good news — ${REF.sepaRef} has cleared the compliance review. Funds will be credited to your supplier within 1–2 business hours.` },
      { label: 'Prevent Future Delay', text: `I've added a note to ${REF.case1} confirming this is a recurring supplier payment and requesting an exemption for future transfers of this type.` },
    ],
    openCases: [
      { id: REF.case1, topic: 'Payment Processing', status: 'In Progress', priority: 'High',   color: '#f5a623' },
      { id: REF.case2, topic: 'Login Access',        status: 'Open',        priority: 'Medium', color: '#00a0d1' },
      { id: REF.case3, topic: 'Overdraft Dispute',   status: 'In Progress', priority: 'High',   color: '#f5a623' },
    ],
    // ── Per-conversation message sets (keyed by conversation id) ─────────
    messagesByConvId: {
      'conv-1': [
        { id: 'm0', role: 'system',   text: 'Sarah Johnson connected via WhatsApp · 14 min ago' },
        { id: 'm1', role: 'customer', text: `I still haven't received any update on my SEPA transfer. My reference is ${REF.sepaRef}. This is really urgent — my invoice deadline was yesterday.`, time: '14 min ago' },
        { id: 'm2', role: 'customer', text: `Invoice #${REF.invoice} for ${REF.amount}. My supplier is now threatening to put our account on hold.`, time: '13 min ago' },
        { id: 'm3', role: 'agent',    text: "Hi Sarah! I can see your account and the payment details right here. I'm looking into this immediately — please give me just a moment.", time: '12 min ago' },
        { id: 'm4', role: 'agent',    text: `I can see this is linked to ${REF.case1}, which has already been escalated to our payments team. The SEPA transfer has been received but is currently pending a routine compliance review.`, time: '11 min ago' },
        { id: 'm5', role: 'customer', text: "Compliance check? This is a regular monthly supplier payment — I've done this exact transfer for two years!", time: '9 min ago' },
        { id: 'm6', role: 'agent',    text: "Completely understood, Sarah. This is an automated check that triggers for transfers above €10,000. Given your history with us, I'm escalating now to our senior payments officer. You should have a resolution within 2 hours.", time: '7 min ago' },
      ],
      'conv-2': [
        { id: 'c2-m0', role: 'system',   text: 'Sarah Johnson connected via Webchat · 8 days ago' },
        { id: 'c2-m1', role: 'customer', text: "Hi, I reset my password yesterday but now I can't log in. It keeps asking for a 2FA code but I'm not receiving any SMS.", time: '8d ago' },
        { id: 'c2-m2', role: 'agent',    text: "Hello Sarah! I can see the password reset completed successfully. Let me look into the 2FA issue. Can you confirm the mobile number on your account?", time: '8d ago' },
        { id: 'c2-m3', role: 'customer', text: "+44 7700 900456. I've tried 3 times in the last hour.", time: '8d ago' },
        { id: 'c2-m4', role: 'agent',    text: "I can see there's a routing issue with our SMS provider for UK numbers. I'm updating your 2FA method to email temporarily. You should receive a code at sarah.j@acme-corp.com within 2 minutes.", time: '8d ago' },
        { id: 'c2-m5', role: 'customer', text: "Got it! That worked. I'm in now. Thank you!", time: '8d ago' },
        { id: 'c2-m6', role: 'agent',    text: `Great! I've also raised ${REF.case2} to fix the SMS routing permanently. You'll receive a notification once resolved. Anything else I can help with?`, time: '8d ago' },
      ],
      'conv-3': [
        { id: 'c3-m0', role: 'system',   text: 'Outbound SMS delivered to +44 7700 900456 · 26 days ago' },
        { id: 'c3-m1', role: 'agent',    text: `Hi Sarah, this is Moneta Bank. Your overdraft fee dispute (case ${REF.case3}) has been reviewed and approved. A refund of €45 has been applied to your account today.`, time: '26d ago' },
        { id: 'c3-m2', role: 'customer', text: "Thank you, that's great news!", time: '26d ago' },
      ],
      'conv-4': [
        { id: 'c4-m0', role: 'system',   text: 'Sarah Johnson connected via In-App chat · 63 days ago' },
        { id: 'c4-m1', role: 'customer', text: "Hi, I need to temporarily increase my card limit to €20,000 for an upcoming large procurement order. Can this be done quickly?", time: '63d ago' },
        { id: 'c4-m2', role: 'agent',    text: "Hello Sarah! Yes, I can process a temporary credit limit increase. I'll need to verify your identity first — could you confirm your date of birth and account number?", time: '63d ago' },
        { id: 'c4-m3', role: 'customer', text: "It's 15/04/1982 and account ending 5678.", time: '63d ago' },
        { id: 'c4-m4', role: 'agent',    text: "Identity confirmed. I'm processing the temporary increase to €20,000 for 30 days. This will be active within 5 minutes.", time: '63d ago' },
        { id: 'c4-m5', role: 'customer', text: "Perfect, thank you! The procurement is scheduled for tomorrow so this is really helpful.", time: '63d ago' },
        { id: 'c4-m6', role: 'agent',    text: "Done! Your limit is now €20,000 until the 2nd of May. I've created case ${REF.case4} for reference. Enjoy the procurement!", time: '63d ago' },
      ],
    },
  },

  // ── HistoryView ─────────────────────────────────────────────────────────
  history: {
    events: [
      // ── Task 1: CASE-2024-0892 — email escalation (active, negative) ──────
      { id: 'en-t1-e1', taskId: 'task-2024-0892-email-3', ts: ago(5 * MIN),     channel: 'email',    eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Priority Banking Email', agentName: 'Agent Thompson', title: `Urgent: Invoice #${REF.invoice} – Payment Not Processed`, summary: `Third escalation. SEPA ref ${REF.sepaRef} debited but not reflected in system. Invoice and bank confirmation attached.`, caseId: REF.case1 },
      { id: 'en-t1-e2', taskId: 'task-2024-0892-email-3', ts: ago(4 * MIN),     channel: 'email',    eventType: 'task:connected', typeLabel: 'Connected', direction: 'inbound',  queueName: 'Priority Banking Email', agentName: 'Agent Thompson', title: `Urgent: Invoice #${REF.invoice} – Payment Not Processed`, summary: 'Agent Thompson reviewing escalation and preparing priority response.', caseId: REF.case1 },
      // ── Task 2: CASE-2024-0892 — voice follow-up (resolved, positive) ──────
      { id: 'en-t2-e1', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H),       channel: 'voice',    eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Priority Banking',       agentName: 'Agent Thompson', title: 'Inbound call – payment processing follow-up', summary: `Customer called to follow up on ${REF.case1}. Transferred to payments team.`, ivrDuration: 45, caseId: REF.case1 },
      { id: 'en-t2-e2', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H - 2 * MIN), channel: 'voice', eventType: 'task:connected', typeLabel: 'Connected', direction: 'inbound', queueName: 'Priority Banking',       agentName: 'Agent Thompson', title: 'Inbound call – payment processing follow-up', summary: 'Agent Thompson connected. Reviewing SEPA hold status with payments team.', caseId: REF.case1 },
      { id: 'en-t2-e3', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H - 10 * MIN), channel: 'voice', eventType: 'task:ended',   typeLabel: 'Ended',     direction: 'inbound',  queueName: 'Priority Banking',       agentName: 'Agent Thompson', title: 'Inbound call – payment processing follow-up', summary: 'Resolved: Agent confirmed escalation to senior payments officer. ETA 2h. Customer satisfied.', wrapUpName: 'Payment Escalation – Resolved', caseId: REF.case1 },
      // ── Task 3: CASE-2024-0892 — WhatsApp follow-up (parked, neutral) ──────
      { id: 'en-t3-e1', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D),        channel: 'whatsapp', eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Digital Messaging',      agentName: 'Agent Chen',     title: `SEPA transfer still hasn't processed – WhatsApp`, summary: `Customer contacts via WhatsApp. Ref ${REF.sepaRef} unresolved. Routed to Agent Chen.`, caseId: REF.case1 },
      { id: 'en-t3-e2', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D - 3 * MIN), channel: 'whatsapp', eventType: 'task:connected', typeLabel: 'Connected', direction: 'inbound', queueName: 'Digital Messaging',     agentName: 'Agent Chen',     title: `SEPA transfer still hasn't processed – WhatsApp`, summary: 'Agent Chen reviewing linked case and messaging customer with status update.', caseId: REF.case1 },
      { id: 'en-t3-e3', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D - 8 * MIN), channel: 'whatsapp', eventType: 'task:parked',  typeLabel: 'Parked',    direction: 'inbound',  queueName: 'Digital Messaging',      agentName: 'Agent Chen',     title: `SEPA transfer still hasn't processed – WhatsApp`, summary: 'Parked pending compliance team callback. Customer informed of 2h window.', caseId: REF.case1 },
      // ── Task 4: CASE-2024-0784 — webchat login issue (resolved, positive) ──
      { id: 'en-t4-e1', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D),        channel: 'chat',     eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'General Banking Chat',   agentName: 'Agent Chen',     title: 'Online banking access issue – webchat', summary: 'Customer reported login failure after password reset via Moneta Bank webchat. 2FA SMS not delivered.', caseId: REF.case2 },
      { id: 'en-t4-e2', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D - 5 * MIN), channel: 'chat',  eventType: 'task:connected', typeLabel: 'Connected', direction: 'inbound',  queueName: 'General Banking Chat',   agentName: 'Agent Chen',     title: 'Online banking access issue – webchat', summary: 'Agent Chen connected. Diagnosing 2FA delivery issue with IT systems.', caseId: REF.case2 },
      { id: 'en-t4-e3', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D - 18 * MIN), channel: 'chat', eventType: 'task:ended',    typeLabel: 'Ended',     direction: 'inbound',  queueName: 'General Banking Chat',   agentName: 'Agent Chen',     title: 'Online banking access issue – webchat', summary: 'Resolved: 2FA SMS routing issue fixed. Customer regained access in session. Case CASE-2024-0784 closed.', caseId: REF.case2 },
      // ── Task 5: CASE-2024-0651 — WhatsApp overdraft dispute (parked, neutral)
      { id: 'en-t5-e1', taskId: 'task-2024-0651-wa-1',    ts: ago(14 * D),       channel: 'whatsapp', eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Digital Messaging',      agentName: 'Agent Williams', title: 'Overdraft fee dispute – WhatsApp', summary: 'Customer contacted via WhatsApp to query €45 overdraft fee (8 May).', caseId: REF.case3 },
      { id: 'en-t5-e2', taskId: 'task-2024-0651-wa-1',    ts: ago(14 * D - 4 * MIN), channel: 'whatsapp', eventType: 'task:parked', typeLabel: 'Parked',   direction: 'inbound',  queueName: 'Digital Messaging',      agentName: 'Agent Williams', title: 'Overdraft fee dispute – WhatsApp', summary: 'Parked while back-office team reviews processor delay evidence. Agent will follow up.', caseId: REF.case3 },
      // ── Task 6: CASE-2024-0651 — outbound SMS update (resolved, positive) ──
      { id: 'en-t6-e1', taskId: 'task-2024-0651-sms-1',   ts: ago(21 * D),       channel: 'sms',      eventType: 'task:new',       typeLabel: 'New',       direction: 'outbound', queueName: 'Proactive Outreach',     agentName: 'Agent Williams', title: 'SMS: Overdraft dispute update', summary: `Outbound SMS to +44 20 7946 0958 confirming ${REF.case3} fee waiver approved.`, caseId: REF.case3 },
      { id: 'en-t6-e2', taskId: 'task-2024-0651-sms-1',   ts: ago(21 * D - 1 * MIN), channel: 'sms',  eventType: 'task:ended',    typeLabel: 'Ended',     direction: 'outbound', queueName: 'Proactive Outreach',     agentName: 'Agent Williams', title: 'SMS: Overdraft dispute update', summary: 'Delivered. Customer replied: "Thank you, that\'s great news."', caseId: REF.case3 },
      // ── Task 7: no case — email statement query (resolved, positive) ────────
      { id: 'en-t7-e1', taskId: 'task-stmt-email-1',       ts: ago(35 * D),       channel: 'email',    eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'General Enquiries Email', agentName: 'Agent Martinez', title: 'Monthly statement query – April line item', summary: 'Customer asked for clarification of April statement line item. USD purchase currency fee queried.', caseId: null },
      { id: 'en-t7-e2', taskId: 'task-stmt-email-1',       ts: ago(35 * D - 6 * H), channel: 'email',  eventType: 'task:ended',    typeLabel: 'Ended',     direction: 'inbound',  queueName: 'General Enquiries Email', agentName: 'Agent Martinez', title: 'Monthly statement query – April line item', summary: 'Resolved: Currency conversion fee explained. Customer satisfied, no further action needed.', caseId: null },
      // ── Task 8: CASE-2024-0445 — in-app card limit increase (resolved, pos) ─
      { id: 'en-t8-e1', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D),       channel: 'chat',     eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'In-App Support',         agentName: 'Agent Schmidt',  title: 'Card limit increase request – In-App chat', summary: `Customer requested temporary credit card limit increase to €20,000 for upcoming procurement.`, caseId: REF.case4 },
      { id: 'en-t8-e2', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D - 3 * MIN), channel: 'chat', eventType: 'task:connected', typeLabel: 'Connected', direction: 'inbound', queueName: 'In-App Support',         agentName: 'Agent Schmidt',  title: 'Card limit increase request – In-App chat', summary: 'Agent Schmidt processing limit increase after identity verification.', caseId: REF.case4 },
      { id: 'en-t8-e3', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D - 10 * MIN), channel: 'chat', eventType: 'task:ended',   typeLabel: 'Ended',     direction: 'inbound',  queueName: 'In-App Support',         agentName: 'Agent Schmidt',  title: 'Card limit increase request – In-App chat', summary: 'Approved: Limit raised to €20,000 for 30 days. Customer confirmed procurement completed successfully.', caseId: REF.case4 },
      // ── Task 9: no case — abandoned callback (negative) ─────────────────────
      { id: 'en-t9-e1', taskId: 'task-callback-voice-1',   ts: ago(50 * D),       channel: 'voice',    eventType: 'task:new',       typeLabel: 'New',       direction: 'outbound', queueName: 'Scheduled Callbacks',    agentName: 'Agent Martinez', title: 'Outbound callback – account review', summary: 'Scheduled annual account review callback. Customer did not answer.', caseId: null },
      { id: 'en-t9-e2', taskId: 'task-callback-voice-1',   ts: ago(50 * D - 2 * MIN), channel: 'voice', eventType: 'task:connected', typeLabel: 'Connected', direction: 'outbound', queueName: 'Scheduled Callbacks',   agentName: 'Agent Martinez', title: 'Outbound callback – account review', summary: 'Voicemail left. Agent noted follow-up email to be sent.', caseId: null },
      // ── Task 10: CASE-2024-0445 — voice card blocked abroad (resolved, pos) ─
      { id: 'en-t10-e1', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D),       channel: 'voice',    eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Fraud & Security',       agentName: 'Agent Williams', title: 'Inbound call – card blocked abroad', summary: 'Card blocked during international travel (USA). Customer calling from New York.', ivrDuration: 90, caseId: REF.case4 },
      { id: 'en-t10-e2', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D - 1 * MIN), channel: 'voice', eventType: 'task:connected', typeLabel: 'Connected', direction: 'inbound', queueName: 'Fraud & Security',       agentName: 'Agent Williams', title: 'Inbound call – card blocked abroad', summary: 'Identity verified via video call. Processing card reactivation for US travel.', holdDuration: 120, caseId: REF.case4 },
      { id: 'en-t10-e3', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D - 22 * MIN), channel: 'voice', eventType: 'task:ended',  typeLabel: 'Ended',     direction: 'inbound',  queueName: 'Fraud & Security',       agentName: 'Agent Williams', title: 'Inbound call – card blocked abroad', summary: 'Resolved: Card reactivated within 20 minutes. Travel notice added. Customer satisfied.', wrapUpName: 'Card Reactivated – Travel Auth', caseId: REF.case4 },
      // ── Task 11: no case — RCS travel notification (resolved, positive) ──────
      { id: 'en-t11-e1', taskId: 'task-rcs-001',           ts: ago(71 * D),       channel: 'rcs',      eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Digital Messaging',      agentName: 'Agent Chen',     title: 'Travel notification – RCS', summary: 'Customer sent travel notification for US trip via RCS. Fraud alert suppression requested for 14 days.', caseId: null },
      { id: 'en-t11-e2', taskId: 'task-rcs-001',           ts: ago(71 * D - 2 * MIN), channel: 'rcs',  eventType: 'task:ended',    typeLabel: 'Ended',     direction: 'inbound',  queueName: 'Digital Messaging',      agentName: 'Agent Chen',     title: 'Travel notification – RCS', summary: 'Card cleared for international use. Fraud alerts suppressed for 14 days. Auto-confirmation sent.', caseId: null },
      // ── Task 12: CASE-2024-0312 — email SEPA delay 81d ago (parked, neutral) ─
      { id: 'en-t12-e1', taskId: 'task-2024-0312-email-1', ts: ago(81 * D),       channel: 'email',    eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Priority Banking Email', agentName: 'Agent Martinez', title: 'SEPA transfer delay enquiry', summary: 'Customer enquired about delayed payment to supplier. AML screening threshold triggered.', caseId: REF.case5 },
      { id: 'en-t12-e2', taskId: 'task-2024-0312-email-1', ts: ago(81 * D - 3 * H), channel: 'email',  eventType: 'task:parked',   typeLabel: 'Parked',    direction: 'inbound',  queueName: 'Priority Banking Email', agentName: 'Agent Martinez', title: 'SEPA transfer delay enquiry', summary: 'Parked pending AML team clearance. Customer notified funds expected within 3 business days.', caseId: REF.case5 },
      // ── System S1: Fraud alert (2 days ago, negative) ────────────────────────
      { id: 'en-s1-e1', taskId: 'task-fraud-alert-2d',     ts: ago(2 * D),        channel: 'system',   eventType: 'task:new',       typeLabel: 'Alert',     direction: null,       queueName: 'Risk Management',        agentName: 'Fraud Detection Engine', title: 'Fraud alert: unusual transaction pattern', summary: '3 rapid online purchases totalling €850 detected from unrecognised merchant IDs in Eastern Europe. Account temporarily restricted. Customer notified by SMS. Manual review required.', caseId: null },
      // ── System S2: Premium upgrade offer (18 days ago, positive) ─────────────
      { id: 'en-s2-e1', taskId: 'task-marketing-gold-18d', ts: ago(18 * D),       channel: 'system',   eventType: 'task:new',       typeLabel: 'Offer',     direction: null,       queueName: 'Marketing Automation',   agentName: 'Personalisation Engine', title: 'Personalised offer: Moneta Gold tier upgrade', summary: 'Based on transaction volume (€48k YTD) and loyalty score 4.8/5, customer qualifies for Gold tier. Push notification + in-app offer dispatched.', caseId: null },
      { id: 'en-s2-e2', taskId: 'task-marketing-gold-18d', ts: ago(18 * D - 4 * H), channel: 'system', eventType: 'task:ended',    typeLabel: 'Completed', direction: null,       queueName: 'Marketing Automation',   agentName: 'Personalisation Engine', title: 'Personalised offer: Moneta Gold tier upgrade', summary: 'Offer viewed by customer (2 min engagement). No conversion. Follow-up email scheduled in 7 days. A/B variant: fee-waiver framing.', caseId: null },
      // ── System S3: KYC annual review (48 days ago, neutral) ──────────────────
      { id: 'en-s3-e1', taskId: 'task-kyc-review-48d',     ts: ago(48 * D),       channel: 'system',   eventType: 'task:new',       typeLabel: 'Compliance', direction: null,      queueName: 'Compliance',             agentName: 'KYC System',             title: 'Annual KYC review — documentation requested', summary: 'Regulatory annual KYC review triggered (12-month cycle). Email sent: updated photo ID + address confirmation required. 30-day deadline set.', caseId: null },
      { id: 'en-s3-e2', taskId: 'task-kyc-review-48d',     ts: ago(48 * D - 1 * H), channel: 'system', eventType: 'task:parked',   typeLabel: 'Pending',   direction: null,       queueName: 'Compliance',             agentName: 'KYC System',             title: 'Annual KYC review — documentation requested', summary: 'Awaiting documents. Automated reminder set for day 14. Account access unaffected until deadline.', caseId: null },
      // ── System S4: Loyalty milestone (57 days ago, positive) ─────────────────
      { id: 'en-s4-e1', taskId: 'task-loyalty-5k-57d',     ts: ago(57 * D),       channel: 'system',   eventType: 'task:new',       typeLabel: 'Reward',    direction: null,       queueName: 'Loyalty Engine',         agentName: 'Loyalty Engine',         title: '5,000 Moneta Rewards points milestone reached', summary: 'Customer crossed 5,000 rewards points (Gold threshold). Automated congratulation email dispatched with Gold tier benefits brochure.', caseId: null },
      { id: 'en-s4-e2', taskId: 'task-loyalty-5k-57d',     ts: ago(57 * D - 20 * MIN), channel: 'system', eventType: 'task:ended', typeLabel: 'Completed', direction: null,       queueName: 'Loyalty Engine',         agentName: 'Loyalty Engine',         title: '5,000 Moneta Rewards points milestone reached', summary: 'Reward notification delivered and opened. 3-month fee waiver automatically applied to account. Customer acknowledged via mobile app.', caseId: null },
      // ── System S5: ECB rate alert (70 days ago, neutral) ─────────────────────
      { id: 'en-s5-e1', taskId: 'task-ecb-rate-70d',       ts: ago(70 * D),       channel: 'system',   eventType: 'task:new',       typeLabel: 'Advisory',  direction: null,       queueName: 'Product Engine',         agentName: 'Rate Watch System',      title: 'ECB rate cut — mortgage refinancing opportunity', summary: 'ECB base rate decreased 0.25% to 3.25%. Customer holds variable mortgage at 4.7%. Fixed-rate conversion at 3.9% (5-yr) offered via email and push notification.', caseId: null },
      { id: 'en-s5-e2', taskId: 'task-ecb-rate-70d',       ts: ago(70 * D - 2 * H), channel: 'system', eventType: 'task:parked',   typeLabel: 'Pending',   direction: null,       queueName: 'Product Engine',         agentName: 'Rate Watch System',      title: 'ECB rate cut — mortgage refinancing opportunity', summary: 'Offer viewed; no action taken. Advisor follow-up call scheduled. Offer valid 14 days.', caseId: null },
      // ── System S6: PSD2 re-authentication (78 days ago, negative) ────────────
      { id: 'en-s6-e1', taskId: 'task-psd2-reauth-78d',    ts: ago(78 * D),       channel: 'system',   eventType: 'task:new',       typeLabel: 'Security',  direction: null,       queueName: 'Security',               agentName: 'Authentication System',  title: 'PSD2 biometric re-enrollment required', summary: 'Regulatory 90-day strong authentication reset. 3 push notification attempts unanswered. SMS fallback sent. Customer must re-enroll before next login.', caseId: null },
      // ── Task 4b: CASE-2024-0784 — email follow-up login/app issue (resolved) ──
      { id: 'en-t4b-e1', taskId: 'task-2024-0784-email-1', ts: ago(7 * D),        channel: 'email',    eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Digital Support Email',  agentName: 'Agent Chen',     title: 'Online banking — app update query', summary: 'Follow-up email after webchat session. 2FA resolved; customer requesting app v3.2 update instructions.', caseId: REF.case2 },
      { id: 'en-t4b-e2', taskId: 'task-2024-0784-email-1', ts: ago(7 * D - 2 * H), channel: 'email',   eventType: 'task:ended',    typeLabel: 'Ended',     direction: 'inbound',  queueName: 'Digital Support Email',  agentName: 'Agent Chen',     title: 'Online banking — app update query', summary: 'Resolved: Step-by-step update guide sent. Customer confirmed successful App Store update. Case CASE-2024-0784 closed.', caseId: REF.case2 },
      // ── Task 13: CASE-2025-0104 — mortgage refinancing enquiry (open, positive)
      { id: 'en-t13-e1', taskId: 'task-2025-0104-email-1', ts: ago(2 * D - 2 * H), channel: 'email',   eventType: 'task:new',       typeLabel: 'New',       direction: 'inbound',  queueName: 'Premium Lending',        agentName: 'Agent Chen',     title: 'Gold tier offer — mortgage refinancing at 3.9% fixed', summary: 'Customer responding to ECB rate cut offer. Requesting full rate comparison and cost illustration before advisor call.', caseId: REF.case6 },
      { id: 'en-t13-e2', taskId: 'task-2025-0104-email-1', ts: ago(2 * D - 4 * H), channel: 'email',   eventType: 'task:parked',   typeLabel: 'Parked',    direction: 'inbound',  queueName: 'Premium Lending',        agentName: 'Agent Chen',     title: 'Gold tier offer — mortgage refinancing at 3.9% fixed', summary: 'ESIS illustration and rate comparison prepared. Lending advisor call booked for next business day.', caseId: REF.case6 },
      // ── Campaign C1: Q2 retention offer (6 days ago, outbound) ──────────────
      { id: 'en-c1-e1', taskId: null, ts: ago(6 * D), channel: 'email', eventType: 'email:out', typeLabel: 'Campaign', direction: 'outbound', title: 'Campaign: moneta_q2_retention_2026', summary: 'Personalised retention offer dispatched: Gold tier fee waiver + travel insurance add-on. Part of Q2 2026 at-risk segment campaign (482 recipients).', campaign: 'moneta_q2_retention_2026', campaignStatus: 'Success', caseId: null },
      // ── Campaign C2: ECB rate cut notification (71 days ago, outbound) ──────
      { id: 'en-c2-e1', taskId: null, ts: ago(71 * D), channel: 'email', eventType: 'email:out', typeLabel: 'Campaign', direction: 'outbound', title: 'Campaign: ecb_rate_cut_notification_mar26', summary: 'ECB rate cut alert sent: 3.9% fixed-rate mortgage refinancing offer. Targeted to variable mortgage holders with balance >€150k. 1,240 recipients.', campaign: 'ecb_rate_cut_notification_mar26', campaignStatus: 'Success', caseId: null },
      // ── Campaign C3: KYC reminder (32 days ago, outbound) ────────────────────
      { id: 'en-c3-e1', taskId: null, ts: ago(32 * D), channel: 'email', eventType: 'email:out', typeLabel: 'Campaign', direction: 'outbound', title: 'Campaign: kyc_annual_reminder_2026', summary: 'Annual KYC renewal reminder sent as part of regulatory compliance batch. Documents requested: photo ID + proof of address. 30-day deadline.', campaign: 'kyc_annual_reminder_2026', campaignStatus: 'Success', caseId: null },
    ],
    interactionSummaries: {
      'task-2024-0892-voice-2': {
        initialContactReason: 'Customer called to follow up on a pending payment escalation for Invoice #' + REF.invoice + '. The SEPA transfer had been debited but not credited for over a week.',
        keyActionsTaken: 'Agent Thompson escalated the case to the Senior Payments Officer team. Customer was informed of a 2-hour callback commitment.',
        nextSteps: 'Senior Payments Officer to call back within 2 hours to confirm manual crediting of the transfer. Case ' + REF.case1 + ' remains open pending confirmation.',
      },
      'task-2024-0445-voice-1': {
        initialContactReason: 'Customer\'s credit card was automatically blocked by fraud detection during international travel to the USA. Customer was calling from New York.',
        keyActionsTaken: 'Identity verified via video call. Card reactivated for international use within 20 minutes. Travel notice added for the duration of the US trip (17–30 March). 2-minute hold while reactivation was processed.',
        nextSteps: 'No further action required. Customer to confirm card is working at point of sale.',
        additionalContactReasons: 'Customer also asked about increasing the daily ATM limit for the trip — referred to the mobile app self-service.',
      },
    },
    aiSummary: `Sarah Johnson (ACME Corp Ltd, Finance Manager) is a high-value customer with a pattern of payment processing issues. Current active case ${REF.case1} is her third escalation for Invoice #${REF.invoice} (${REF.amount}). History shows 2 prior resolved cases (card block, SEPA delay) and an open login issue. Sentiment is urgent — immediate payment team escalation and proactive callback recommended.`,
  },

  email: {
    activeEmail: {
      messageId: 'mock-msg-001', threadId: 'mock-thread-001',
      from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: 'john.doe@acme-corp.com',
      subject: `Urgent: Invoice #${REF.invoice} — Payment Not Processed`,
      date: 'Thu, 5 Jun 2025 14:22',
      snippet: `Third attempt to resolve payment failure for Invoice #${REF.invoice} (${REF.amount}). SEPA ref: ${REF.sepaRef}.`,
      bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Hello Support Team,</p><p>I am writing to urgently follow up on the payment processing failure for <strong>Invoice #${REF.invoice}</strong> (${REF.amount}). This is now our <strong>third attempt</strong> to resolve this issue.</p><p>SEPA transfer ref: ${REF.sepaRef}, initiated 29 May 2025. Funds debited but not reflected in system.</p><ul><li>Invoice: ${REF.invoice}</li><li>Amount: ${REF.amount}</li><li>Reference: ${REF.sepaRef}</li></ul><p>Please treat this as a <strong>priority case</strong>. Invoice and bank confirmation attached.</p><p>Best regards,<br/>Sarah Johnson<br/>Finance Manager, ACME Corp</p></div>`,
      bodyText: '', attachments: [
        { attachmentId: 'mock-att-1', filename: `invoice_${REF.invoice}.pdf`, mimeType: 'application/pdf', size: 45820 },
        { attachmentId: 'mock-att-2', filename: 'bank_confirmation_SEPA.pdf', mimeType: 'application/pdf', size: 23440 },
      ],
    },
    thread: [
      { messageId: 'mock-msg-000', threadId: 'mock-thread-001', from: 'Support Team <support@moneta-bank.com>', to: 'sarah.j@acme-corp.com', cc: '', subject: `Re: Invoice #${REF.invoice} — Payment Not Processed`, date: 'Wed, 4 Jun 2025 10:05', snippet: 'We have received your query and our payments team is looking into this matter.', bodyHtml: '<p>Dear Sarah,</p><p>We have received your query and our payments team is looking into this. We will update you within 24 hours.</p><p>Kind regards,<br/>Moneta Bank Support</p>', bodyText: '', attachments: [] },
      { messageId: 'mock-msg-002', threadId: 'mock-thread-001', from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: '', subject: `Re: Invoice #${REF.invoice} — Payment Not Processed`, date: 'Wed, 4 Jun 2025 16:48', snippet: 'Still no update. Can you please escalate this to a supervisor?', bodyHtml: '<p>Hi,</p><p>I still have not received an update. Can you please escalate to a supervisor? We cannot close our books until this is resolved.</p><p>Sarah</p>', bodyText: '', attachments: [] },
      { messageId: 'mock-msg-001', threadId: 'mock-thread-001', from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: 'john.doe@acme-corp.com', subject: `Urgent: Invoice #${REF.invoice} — Payment Not Processed`, date: 'Thu, 5 Jun 2025 14:22', snippet: `Third attempt to resolve payment failure for Invoice #${REF.invoice} (${REF.amount}). SEPA ref: ${REF.sepaRef}.`, bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Hello Support Team,</p><p>Urgently following up on Invoice #${REF.invoice} (${REF.amount}) — third attempt. SEPA ref: ${REF.sepaRef}.</p><p>Please treat as priority. Invoice and bank confirmation attached.</p><p>Best regards,<br/>Sarah Johnson<br/>Finance Manager, ACME Corp</p></div>`, bodyText: '', attachments: [{ attachmentId: 'mock-att-1', filename: `invoice_${REF.invoice}.pdf`, mimeType: 'application/pdf', size: 45820 }, { attachmentId: 'mock-att-2', filename: 'bank_confirmation_SEPA.pdf', mimeType: 'application/pdf', size: 23440 }] },
    ],
    aiEnrichment: {
      summary: `Customer reports repeated payment failure for Invoice #${REF.invoice} (${REF.amount}). Third follow-up in 5 days. SEPA transfer debited but not in system. Escalating to supervisor.`,
      category: 'Payment Issue', sentiment: 'urgent', confidence: 0.94,
      suggestedReply: `Dear Sarah, thank you for your follow-up. I have escalated your case (ref: INC-20250605-4421) to our payments investigation team as a priority. A senior specialist will contact you directly within 2 business hours. We sincerely apologise for the inconvenience and delay.`,
      source: 'ai',
    },
    customerThreads: [
      { threadId: 'mock-thread-mortgage', statusKey: 'resolved', topicKey: 'general', subject: 'Gold tier offer — mortgage refinancing at 3.9% fixed', date: 'Jun 4, 2025', snippet: 'Rate comparison and ESIS illustration requested.' },
      { threadId: 'mock-thread-login', statusKey: 'resolved', topicKey: 'account', subject: 'Online banking — app update after login fix', date: 'May 26, 2025', snippet: 'App v3.2 update instructions sent. Resolved.' },
      { threadId: 'mock-thread-stmt', statusKey: 'resolved', topicKey: 'account', subject: 'April statement query — USD transaction fee', date: 'May 1, 2025', snippet: 'Currency conversion fee waived as Gold tier member.' },
      { threadId: 'mock-thread-sepa-delay', statusKey: 'resolved', topicKey: 'payment', subject: `SEPA transfer delay – Invoice #${REF.invoice}`, date: 'Mar 14, 2025', snippet: 'AML screening on supplier payment. Resolved in 3 days.' },
    ],
  },

  // ── Per-taskId email lookup (for cross-tab navigation from History/Cases) ─
  // taskIds not listed here fall back to the default `email` block above.
  emails: {
    'task-stmt-email-1': {
      activeEmail: {
        messageId: 'mock-msg-stmt-q', topicKey: 'account', statusKey: 'resolved', threadId: 'mock-thread-stmt',
        from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: '',
        subject: 'April statement query — USD transaction fee',
        date: 'Thu, 1 May 2025 09:30',
        snippet: 'Querying a USD 340 currency conversion fee (approx. \u20ac312) on the April statement.',
        bodyHtml: `<p>Dear Support,</p><p>I am reviewing our April statement and noticed a currency conversion fee of USD 340 (approx. \u20ac312) on a purchase dated 15 April. Could you please clarify whether this fee is correct and provide the exchange rate applied?</p><p>Kind regards,<br/>Sarah Johnson<br/>Finance Manager, ACME Corp</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-stmt-r', threadId: 'mock-thread-stmt', from: 'Moneta Bank Support <support@moneta-bank.com>', to: 'sarah.j@acme-corp.com', cc: '', subject: 'Re: April statement query — USD transaction fee', date: 'Thu, 1 May 2025 14:15', snippet: 'USD fee at ECB mid-market + 1.5%. Gold tier one-time quarterly waiver applied — \u20ac312 credited today.', bodyHtml: '<p>Dear Sarah,</p><p>The USD 340 fee was applied at the ECB mid-market rate of 1.083 plus our standard 1.5% non-sterling transaction fee, totalling \u20ac312.40. As a Gold tier customer you are eligible for a one-time quarterly waiver. I have applied a credit of \u20ac312.40 to your account effective today.</p><p>Kind regards,<br/>Agent Martinez<br/>Moneta Bank Support</p>', bodyText: '', attachments: [] },
        { messageId: 'mock-msg-stmt-q', topicKey: 'account', statusKey: 'resolved', threadId: 'mock-thread-stmt', from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: '', subject: 'April statement query — USD transaction fee', date: 'Thu, 1 May 2025 09:30', snippet: 'Query on April statement: USD 340 currency conversion fee.', bodyHtml: `<p>Dear Support,</p><p>Querying USD 340 (\u20ac312) conversion fee on 15 April purchase. Please clarify exchange rate applied.</p><p>Sarah Johnson</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Customer querying USD currency conversion fee on April statement. ECB rate + 1.5% correctly applied. Gold tier one-time quarterly waiver applied — \u20ac312.40 credited.',
        category: 'Account Enquiry', sentiment: 'neutral', confidence: 0.82,
        suggestedReply: `Dear Sarah, the USD 340 charge is our standard 1.5% non-sterling conversion fee (ECB rate 1.083). As a Gold tier member I have applied a one-time credit of \u20ac312.40 effective today — you will see this on your next statement.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgent: Invoice #${REF.invoice} — Payment Not Processed`, date: 'Jun 5, 2025', snippet: 'Third escalation on SEPA payment failure.' },
        { threadId: 'mock-thread-mortgage', statusKey: 'resolved', topicKey: 'general', subject: 'Gold tier offer — mortgage refinancing at 3.9% fixed', date: 'Jun 4, 2025', snippet: 'Rate comparison and ESIS illustration requested.' },
        { threadId: 'mock-thread-login', statusKey: 'resolved', topicKey: 'account', subject: 'Online banking — app update after login fix', date: 'May 26, 2025', snippet: 'App v3.2 update guide sent.' },
        { threadId: 'mock-thread-sepa-delay', statusKey: 'resolved', topicKey: 'payment', subject: `SEPA transfer delay – Invoice #${REF.invoice}`, date: 'Mar 14, 2025', snippet: 'AML screening on supplier payment. Resolved.' },
      ],
    },
    'task-2024-0784-email-1': {
      activeEmail: {
        messageId: 'mock-msg-login-q', threadId: 'mock-thread-login',
        from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: '',
        subject: 'Online banking — app update after login fix',
        date: 'Mon, 26 May 2025 10:12',
        snippet: '2FA working now — thank you! Getting an error when updating to the new app version (v3.2).',
        bodyHtml: `<p>Hi,</p><p>Thank you for sorting the 2FA issue — everything is working now. However I am getting an error when trying to update to the new mobile app version (3.2). Could you send me the update instructions?</p><p>Best,<br/>Sarah</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-login-r', threadId: 'mock-thread-login', from: 'Moneta Bank Support <support@moneta-bank.com>', to: 'sarah.j@acme-corp.com', cc: '', subject: 'Re: Online banking — app update after login fix', date: 'Mon, 26 May 2025 11:45', snippet: 'iOS 16+ required. App Store \u2192 Moneta Bank \u2192 Update. Takes 2 min. 2FA settings preserved.', bodyHtml: '<p>Dear Sarah,</p><p>Glad the 2FA is sorted! For the app update (v3.2 requires iOS 16+):</p><ol><li>Open the App Store and search \u201cMoneta Bank\u201d</li><li>Tap \u201cUpdate\u201d (not \u201cGet\u201d)</li><li>Enter your Apple ID if prompted</li><li>Allow ~2 minutes to install</li></ol><p>Restart the app and log in normally \u2014 your 2FA settings will be preserved.</p><p>Kind regards,<br/>Agent Chen<br/>Digital Support</p>', bodyText: '', attachments: [] },
        { messageId: 'mock-msg-login-q', threadId: 'mock-thread-login', from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: '', subject: 'Online banking — app update after login fix', date: 'Mon, 26 May 2025 10:12', snippet: '2FA fixed. App v3.2 update error persists. Please send instructions.', bodyHtml: `<p>Hi,</p><p>2FA is working. Getting error on app v3.2 update. Please send instructions.</p><p>Sarah</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Follow-up after login/2FA resolution. Customer requesting mobile app v3.2 update instructions. Requires iOS 16+. Step-by-step guide sent by Agent Chen.',
        category: 'Technical Support', sentiment: 'positive', confidence: 0.88,
        suggestedReply: `Hi Sarah, great that 2FA is working! For the v3.2 update: App Store \u2192 search \u201cMoneta Bank\u201d \u2192 tap Update. Requires iOS 16+. Takes about 2 minutes, 2FA settings preserved.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgent: Invoice #${REF.invoice} — Payment Not Processed`, date: 'Jun 5, 2025', snippet: 'Third escalation on SEPA payment failure.' },
        { threadId: 'mock-thread-mortgage', statusKey: 'resolved', topicKey: 'general', subject: 'Gold tier offer — mortgage refinancing at 3.9% fixed', date: 'Jun 4, 2025', snippet: 'Rate comparison requested.' },
        { threadId: 'mock-thread-stmt', statusKey: 'resolved', topicKey: 'account', subject: 'April statement query — USD transaction fee', date: 'May 1, 2025', snippet: 'Currency conversion fee. Gold tier waiver applied.' },
        { threadId: 'mock-thread-sepa-delay', statusKey: 'resolved', topicKey: 'payment', subject: `SEPA transfer delay – Invoice #${REF.invoice}`, date: 'Mar 14, 2025', snippet: 'AML screening on supplier payment. Resolved.' },
      ],
    },
    'task-2025-0104-email-1': {
      activeEmail: {
        messageId: 'mock-msg-mortgage-q', threadId: 'mock-thread-mortgage',
        from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'lending@moneta-bank.com', cc: '',
        subject: 'Gold tier offer — mortgage refinancing at 3.9% fixed',
        date: 'Wed, 4 Jun 2025 15:35',
        snippet: 'Interested in the fixed-rate conversion offer. Please send rate comparison and cost illustration.',
        bodyHtml: `<p>Dear Lending Team,</p><p>I received your notification about the ECB rate cut and the 3.9% fixed mortgage refinancing offer (5 years). Our current rate is 4.7% variable.</p><p>I am interested in exploring this. Could you please send:</p><ul><li>A full rate comparison (current vs proposed)</li><li>Total cost illustration over the full mortgage term</li><li>Any early repayment charges or switching fees</li></ul><p>Kind regards,<br/>Sarah Johnson<br/>Finance Manager, ACME Corp</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-mortgage-q', threadId: 'mock-thread-mortgage', from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'lending@moneta-bank.com', cc: '', subject: 'Gold tier offer — mortgage refinancing at 3.9% fixed', date: 'Wed, 4 Jun 2025 15:35', snippet: 'Requesting rate comparison and ESIS illustration for fixed-rate conversion.', bodyHtml: `<p>Dear Lending Team,</p><p>Interested in 3.9% fixed rate offer. Please send full comparison and total cost illustration.</p><p>Sarah Johnson</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Customer responding positively to ECB rate cut mortgage refinancing offer. Requesting full rate comparison and ESIS illustration before advisor call. Gold tier — high-value opportunity.',
        category: 'Mortgage / Lending', sentiment: 'positive', confidence: 0.91,
        suggestedReply: `Dear Sarah, thank you for your interest in our Gold tier refinancing offer. I am preparing a personalised rate comparison (4.7% variable vs 3.9% 5-year fixed) along with the full ESIS illustration. Our lending advisor will call you tomorrow morning to walk through the options in detail.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgent: Invoice #${REF.invoice} — Payment Not Processed`, date: 'Jun 5, 2025', snippet: 'Third escalation on SEPA payment failure.' },
        { threadId: 'mock-thread-login', statusKey: 'resolved', topicKey: 'account', subject: 'Online banking — app update after login fix', date: 'May 26, 2025', snippet: 'App v3.2 update instructions sent.' },
        { threadId: 'mock-thread-stmt', statusKey: 'resolved', topicKey: 'account', subject: 'April statement query — USD transaction fee', date: 'May 1, 2025', snippet: 'Currency conversion fee waived as Gold tier.' },
        { threadId: 'mock-thread-sepa-delay', statusKey: 'resolved', topicKey: 'payment', subject: `SEPA transfer delay – Invoice #${REF.invoice}`, date: 'Mar 14, 2025', snippet: 'AML screening on supplier payment. Resolved.' },
      ],
    },
    'task-2024-0312-email-1': {
      activeEmail: {
        messageId: 'mock-msg-sepa-delay', threadId: 'mock-thread-sepa-delay',
        from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: '',
        subject: `SEPA transfer delay – Invoice #${REF.invoice} to ${REF.supplier}`,
        date: 'Fri, 14 Mar 2025 11:05',
        snippet: 'Payment to supplier delayed. AML screening triggered. Please advise on timeline.',
        bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Dear Support,</p><p>I am writing regarding a SEPA transfer I initiated on 12 March to <strong>${REF.supplier}</strong> (reference: ${REF.sepaRef}) for our monthly supplier invoice.</p><p>The funds were debited from our account on 12 March but have not yet been credited to the supplier. Our account manager mentioned this may be due to AML screening — could you please advise on the expected timeline and whether any additional documentation is required?</p><p>This is a regular monthly payment and we have a long-standing relationship with this supplier.</p><p>Best regards,<br/>Sarah Johnson<br/>Finance Manager, ACME Corp</p></div>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-sepa-delay-r1', threadId: 'mock-thread-sepa-delay', from: 'Moneta Bank Support <support@moneta-bank.com>', to: 'sarah.j@acme-corp.com', cc: '', subject: `Re: SEPA transfer delay – Invoice #${REF.invoice} to ${REF.supplier}`, date: 'Fri, 14 Mar 2025 14:30', snippet: 'We have identified the AML hold and escalated for expedited review.', bodyHtml: '<p>Dear Ms. Johnson,</p><p>We have identified the compliance hold on your transfer. Our AML team is reviewing it as a priority and expects to release the funds within 3 business days. No additional documentation is required at this stage.</p><p>We apologise for the inconvenience.</p><p>Kind regards,<br/>Agent Martinez<br/>Moneta Bank Priority Support</p>', bodyText: '', attachments: [] },
        { messageId: 'mock-msg-sepa-delay', threadId: 'mock-thread-sepa-delay', from: `Sarah Johnson <sarah.j@acme-corp.com>`, to: 'support@moneta-bank.com', cc: '', subject: `SEPA transfer delay – Invoice #${REF.invoice} to ${REF.supplier}`, date: 'Fri, 14 Mar 2025 11:05', snippet: 'Payment to supplier delayed. AML screening triggered. Please advise on timeline.', bodyHtml: `<p>Dear Support,</p><p>SEPA transfer to ${REF.supplier} on 12 March (ref: ${REF.sepaRef}) not yet credited. AML screening may have triggered. Please advise on timeline.</p><p>Sarah Johnson</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: `Customer querying delayed SEPA transfer to ${REF.supplier}. AML screening triggered for regular monthly supplier payment. Funds held for up to 3 business days.`,
        category: 'Payment Delay', sentiment: 'neutral', confidence: 0.87,
        suggestedReply: `Dear Sarah, your SEPA transfer (ref: ${REF.sepaRef}) to ${REF.supplier} is under routine AML review and is expected to clear within 3 business days. No action is required from your side. We will notify you by email once the funds are released.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgent: Invoice #${REF.invoice} — Payment Not Processed`, date: 'Jun 5, 2025', snippet: 'Third escalation on unresolved SEPA transfer.' },
        { threadId: 'mock-thread-mortgage', statusKey: 'resolved', topicKey: 'general', subject: 'Gold tier offer — mortgage refinancing at 3.9% fixed', date: 'Jun 4, 2025', snippet: 'Rate comparison and ESIS illustration requested.' },
        { threadId: 'mock-thread-login', statusKey: 'resolved', topicKey: 'account', subject: 'Online banking — app update after login fix', date: 'May 26, 2025', snippet: 'App update instructions sent.' },
        { threadId: 'mock-thread-stmt', statusKey: 'resolved', topicKey: 'account', subject: 'April statement query — USD transaction fee', date: 'May 1, 2025', snippet: 'Currency conversion fee waived.' },
      ],
    },
  },
  analytics: {
    cases: {
      byStatus:   [ { label: 'Open', value: 14, color: '#f5a623' }, { label: 'In Progress', value: 9, color: '#00a0d1' }, { label: 'Resolved', value: 22, color: '#4ade80' }, { label: 'Closed', value: 31, color: '#9ca3af' } ],
      byPriority: [ { label: 'Critical', value: 3, color: '#e8453c' }, { label: 'High', value: 11, color: '#f5a623' }, { label: 'Medium', value: 18, color: '#00a0d1' }, { label: 'Low', value: 44, color: '#9ca3af' } ],
      byCategory: [ { label: 'Payment', value: 19, color: '#a78bfa' }, { label: 'Account', value: 14, color: '#60a5fa' }, { label: 'Technical', value: 12, color: '#34d399' }, { label: 'General', value: 31, color: '#f472b6' } ],
      trend: TREND.casesNew, resolutionTrend: TREND.casesResolution,
      slaBreached: 4, slaMet: 72, avgResolutionH: 19, fcr: 68, csat: 4.2, total: 76, openCount: 23,
    },
    history: {
      byChannel: [ { key: 'voice', label: 'Phone', value: 26, color: '#4ade80' }, { key: 'email', label: 'Email', value: 25, color: '#a78bfa' }, { key: 'chat', label: 'Chat', value: 24, color: '#60a5fa' }, { key: 'whatsapp', label: 'WhatsApp', value: 15, color: '#25d366' }, { key: 'sms', label: 'SMS', value: 8, color: '#f472b6' } ],
      byOutcome: [ { key: 'resolved', label: 'Resolved', value: 58, color: '#4ade80' }, { key: 'escalated', label: 'Escalated', value: 14, color: '#f5a623' }, { key: 'pending', label: 'Pending', value: 11, color: '#60a5fa' }, { key: 'abandoned', label: 'Abandoned', value: 7, color: '#e8453c' }, { key: 'transferred', label: 'Transferred', value: 8, color: '#9ca3af' } ],
      sentiment: [ { key: 'positive', label: 'Positive', value: 57, color: '#4ade80' }, { key: 'neutral', label: 'Neutral', value: 24, color: '#9ca3af' }, { key: 'negative', label: 'Negative', value: 17, color: '#e8453c' } ],
      volumeTrend: TREND.histVolume, ahtTrend: TREND.histAht,
      weekdayVolume: [21, 19, 23, 18, 22, 9, 5],
      totalInteractions: 98, avgHandleTimeMin: 6.7, repeatContactRate: 22, escalationRate: 14, resolutionRate: 76,
    },
    voice: {
      callOutcomes: [ { key: 'resolved', label: 'Resolved', value: 14, color: '#00c389' }, { key: 'transferred', label: 'Transferred', value: 4, color: '#f5a623' }, { key: 'callback', label: 'Callback', value: 3, color: '#7c3aed' }, { key: 'abandoned', label: 'Abandoned', value: 2, color: '#e0463e' } ],
      sentiment:    [ { key: 'positive', label: 'Positive', value: 9, color: '#00c389' }, { key: 'neutral', label: 'Neutral', value: 7, color: '#f5a623' }, { key: 'negative', label: 'Negative', value: 7, color: '#e0463e' } ],
      callTypes:    [ { key: 'inbound', label: 'Inbound', value: 16, color: '#00a0d1' }, { key: 'outbound', label: 'Outbound', value: 4, color: '#a78bfa' }, { key: 'callback', label: 'Callback', value: 3, color: '#f5a623' } ],
      volumeTrend: TREND.voiceVolume, ahtTrend: TREND.voiceAht,
      openCases: [ { id: REF.case1, status: 'Open', topic: 'SEPA Transfer Dispute', priority: 'High', color: '#f5a623' }, { id: REF.case2, status: 'Closed', topic: 'Login Access', priority: 'Low', color: '#00a0d1' } ],
      avgHandleTimeSec: 288, slaMet: 87, csat: 4.2, totalCalls30d: 23,
    },
    chat: {
      customer: 'Sarah Johnson',
      channelMix: [ { key: 'webchat',  label: 'Webchat', value: 18, color: '#00a0d1' }, { key: 'whatsapp', label: 'WhatsApp', value: 12, color: '#25D366' }, { key: 'sms',      label: 'SMS', value: 7, color: '#f5a623' }, { key: 'apple',    label: 'Apple Msgs', value: 5, color: '#007AFF' }, { key: 'in-app',   label: 'In-App', value: 4, color: '#a78bfa' }, { key: 'rcs',      label: 'RCS', value: 2, color: '#34d399' } ],
      sessionStatus: [ { key: 'active',      label: 'Active', value: 1, color: '#00a0d1' }, { key: 'resolved',    label: 'Resolved', value: 42, color: '#4ade80' }, { key: 'transferred', label: 'Transferred', value: 2, color: '#f5a623' }, { key: 'abandoned',   label: 'Abandoned', value: 3, color: '#e8453c' } ],
      sentiment: [ { label: 'Positive', value: 19, color: '#4ade80' }, { label: 'Neutral', value: 16, color: '#9ca3af' }, { label: 'Negative', value: 13, color: '#e8453c' } ],
      volumeTrend: TREND.chatVolume, ahtTrend: TREND.chatAht,
      openCases: [ { id: REF.case1, status: 'In Progress', topic: 'Payment Processing', priority: 'High', color: '#f5a623' }, { id: REF.case2, status: 'Open', topic: 'Login Access', priority: 'Medium', color: '#00a0d1' }, { id: REF.case3, status: 'In Progress', topic: 'Overdraft Dispute', priority: 'High', color: '#f5a623' } ],
      totalConversations: 48, avgFirstResponseSec: 18, slaMet: 91, csat: 4.4, conversationsThisMonth: 48,
    },
    email: {
      threadStatus: [ { key: 'active',            label: 'Active', value: 2, color: '#00a0d1' }, { key: 'awaiting-customer', label: 'Awaiting Customer', value: 1, color: '#f5a623' }, { key: 'resolved', label: 'Resolved', value: 8, color: '#4ade80' } ],
      topicMix: [ { key: 'payment', label: 'Payment Issue', value: 5, color: '#a78bfa' }, { key: 'account', label: 'Account Access', value: 3, color: '#60a5fa' }, { key: 'dispute', label: 'Dispute', value: 2, color: '#f472b6' }, { key: 'general', label: 'General', value: 1, color: '#9ca3af' } ],
      sentiment: [ { label: 'Positive', value: 3, color: '#4ade80' }, { label: 'Neutral', value: 5, color: '#9ca3af' }, { label: 'Negative', value: 3, color: '#e8453c' } ],
      volumeTrend: TREND.emailVolume, replyTimeTrend: TREND.emailReplyTime,
      openCases: [ { id: REF.case1, status: 'In Progress', topic: 'Payment Processing', priority: 'High', color: '#f5a623' }, { id: REF.case2, status: 'Open', topic: 'Login Access', priority: 'Medium', color: '#00a0d1' }, { id: REF.case3, status: 'In Progress', topic: 'Overdraft Dispute', priority: 'High', color: '#f5a623' } ],
      avgFirstReplyH: 4.1, slaMet: 87, csat: 4.2, emailsThisMonth: 11, totalThreads: 11,
    },
  },

  // ── Email composer: templates, signatures, knowledge base ─────────────────
  emailComposer: {
    defaultSignatureId: 'sig-en-default',
    signatures: [
      {
        id: 'sig-en-default',
        name: 'Standard EN',
        html: '<p style="font-size:12px;color:#545454">Kind regards,<br><strong>{{agentName}}</strong><br>Customer Support | Moneta Bank<br>+44 20 7946 0800</p>',
      },
      {
        id: 'sig-en-brief',
        name: 'Brief EN',
        html: '<p style="font-size:12px;color:#545454">Best regards, {{agentName}} &mdash; Moneta Bank Support</p>',
      },
    ],
    templates: [
      {
        id: 'tpl-en-greeting',
        name: 'Welcome Greeting',
        locale: 'en',
        category: 'greeting',
        subject: 'Re: {{subject}}',
        variables: ['customerName', 'agentName'],
        body: '<p>Dear {{customerName}},</p><p>Thank you for contacting Moneta Bank. My name is {{agentName}} and I will be assisting you today.</p><p>I have reviewed your enquiry and will respond shortly with a full resolution.</p><p>Please feel free to let me know if you have any additional information to share.</p>',
      },
      {
        id: 'tpl-en-followup',
        name: 'Follow-Up',
        locale: 'en',
        category: 'follow-up',
        variables: ['customerName', 'date'],
        body: '<p>Dear {{customerName}},</p><p>I am following up on our previous correspondence from {{date}}.</p><p>Could you please let us know if the issue has been resolved to your satisfaction, or if there is anything further we can assist you with?</p>',
      },
      {
        id: 'tpl-en-apology',
        name: 'Sincere Apology',
        locale: 'en',
        category: 'apology',
        variables: ['customerName', 'agentName'],
        body: '<p>Dear {{customerName}},</p><p>I sincerely apologise for the inconvenience this situation has caused you. We fully understand how frustrating this must be.</p><p>I assure you that this matter is being treated as a priority and I am personally overseeing its resolution. We will keep you updated every step of the way.</p><p>Thank you for your patience and understanding.</p>',
      },
      {
        id: 'tpl-en-resolution',
        name: 'Issue Resolved',
        locale: 'en',
        category: 'resolution',
        variables: ['customerName', 'agentName'],
        body: '<p>Dear {{customerName}},</p><p>I am pleased to inform you that your recent enquiry has now been fully resolved.</p><p>Here is a summary of the actions taken:</p><ul><li>Your account has been reviewed and updated</li><li>The relevant team has been notified</li><li>All necessary changes have been applied</li></ul><p>Should you have any further questions, please do not hesitate to contact us.</p>',
      },
      {
        id: 'tpl-en-payment',
        name: 'Payment Query',
        locale: 'en',
        category: 'general',
        variables: ['customerName', 'orderNumber'],
        body: '<p>Dear {{customerName}},</p><p>Thank you for contacting us regarding your payment.</p><p>We have located your transaction and are currently reviewing the details. Please note that payment processing typically takes <strong>1–3 business days</strong>.</p><p>If you have any documentation or reference numbers related to this transaction, please share them with us to expedite the process.</p>',
      },
      {
        id: 'tpl-en-security',
        name: 'Security Verification',
        locale: 'en',
        category: 'general',
        variables: ['customerName'],
        body: '<p>Dear {{customerName}},</p><p>For the security of your account, we need to verify your identity before proceeding.</p><p>Please confirm the following:</p><ol><li>Your registered email address</li><li>The last 4 digits of your registered phone number</li><li>Your date of birth</li></ol><p>Once verified, we will be able to assist you immediately.</p>',
      },
    ],
    knowledgeBase: [
      {
        id: 'kb-payment-processing',
        title: 'Payment Processing Times',
        tags: ['payment', 'transfer', 'SEPA', 'delay', 'processing'],
        content: 'Standard payments are processed within 1-3 business days. SEPA transfers are processed same-day if submitted before 14:00 CET. International transfers may take 3-5 business days. Weekend and public holiday submissions are processed on the next business day.',
      },
      {
        id: 'kb-account-security',
        title: 'Account Security & Verification',
        tags: ['security', 'login', 'password', 'verification', 'access', 'blocked'],
        content: 'For security purposes, we require identity verification before making any account changes. Required: registered email, last 4 digits of registered phone, date of birth. Accounts locked after 5 failed attempts — contact support to unlock. 2FA is mandatory for transactions over €1,000.',
      },
      {
        id: 'kb-dispute-resolution',
        title: 'Transaction Dispute Process',
        tags: ['dispute', 'chargeback', 'fraud', 'unauthorised', 'refund', 'complaint'],
        content: 'To raise a dispute: submit the claim within 60 days of the transaction date. Required information: transaction date, amount, merchant name, reason for dispute. Processing time: 5-10 business days. Provisional credit may be issued within 3 business days for disputes over €100.',
      },
      {
        id: 'kb-overdraft',
        title: 'Overdraft Facilities',
        tags: ['overdraft', 'credit', 'limit', 'fee', 'charges', 'balance'],
        content: 'Standard overdraft limit: up to 2x monthly salary (max €5,000). Interest rate: 19.9% APR. No fee for arranged overdraft. Unarranged overdraft fee: €5/day (max €35/month). To request limit increase: online banking or call support. Overdraft must be cleared within 90 days.',
      },
    ],
  },

  // ── TaskWidget ─────────────────────────────────────────────────────────────────────
  task: {
    elapsedSec: 247,
    slaSec: 900,
    activeTask: {
      mediaType: 'workItem',
      mediaChannel: 'jmartanTask1',
      interactionId: '72a9741f-demo-0001-0000-000000000000',
      state: 'connected',
      isWrapUp: false,
      isHold: false,
      timeStamp: Date.now() - 247000,
      virtualTeamName: 'Fraud_Alert_Queue',
      ani: '+44 20 7946 0958',
      callAssociatedData: {
        caseId:       { value: 'INC0003' },
        taskId:       { value: 'fd440207-demo-0001-0000-000000000000' },
        taskType:     { value: 'fraud' },
        customerName: { value: 'Sarah Johnson' },
        email:        { value: 'sarah.j@acme-corp.com' },
        ani:          { value: '+44 20 7946 0958' },
        virtualTeamName: { value: 'Fraud_Alert_Queue' },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// GERMAN
// ═══════════════════════════════════════════════════════════════════════════
const DE = {
  customer: {
    name: 'Anna Müller',
    email: 'a.mueller@bavarian-tech.de',
    phone: '+49 89 1234 5678',
    company: 'Bavarian Tech GmbH',
    city: 'München',
    country: 'DE',
  },
  agents: {
    primary:   'Agent Hoffmann',
    secondary: 'Agent Krause',
    tertiary:  'Agent Weber',
    fourth:    'Agent Fischer',
    fifth:     'Agent Bauer',
  },

  cases: [
    {
      id: REF.case1, caseId: REF.case1, status: 'in progress', priority: 'high', category: 'payment',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-06-03T12:00:00Z', owner: 'Agent Hoffmann', _isActive: true,
      description: `Kundin meldet wiederholten Zahlungsfehler für Rechnung #${REF.invoice} (${REF.amount}). Dritte Nachfrage in 5 Tagen. SEPA-Überweisung Ref.: ${REF.sepaRef} vom Kundenkonto belastet, aber im System nicht verbucht. Eskalation an Vorgesetzten.`,
    },
    {
      id: REF.case2, caseId: REF.case2, status: 'open', priority: 'medium', category: 'technical',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-05-28T09:30:00Z', owner: 'Agent Krause',
      description: 'Online-Banking-Login-Fehler nach Passwort-Reset. Kundin konnte 2 Tage nicht auf ihr Konto zugreifen. Zwei-Faktor-Authentifizierung lieferte keine SMS-Codes.',
    },
    {
      id: REF.case3, caseId: REF.case3, status: 'in progress', priority: 'medium', category: 'account',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-05-10T14:15:00Z', owner: 'Agent Bauer',
      description: 'Kundin beanstandet Überziehungsgebühr von €45, belastet am 8. Mai. Verzögerung durch Zahlungsabwickler verursachte temporäre Saldodifferenz. Backoffice-Prüfung läuft.',
    },
    {
      id: REF.case4, caseId: REF.case4, status: 'closed', priority: 'low', category: 'fraud',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-04-02T10:00:00Z', owner: 'Agent Weber',
      description: 'Karte während Auslandsreise in die USA gesperrt. Identität per Video-Call verifiziert. Karte innerhalb von 20 Minuten reaktiviert. Kundin zufrieden.',
    },
    {
      id: REF.case5, caseId: REF.case5, status: 'closed', priority: 'low', category: 'payment',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-03-15T08:45:00Z', owner: 'Agent Fischer',
      description: 'SEPA-Überweisung an Lieferanten um 3 Werktage verzögert durch AML-Prüfschwelle ausgelöst. Gelder gutgeschrieben. Kundin mit Entschuldigungsschreiben benachrichtigt.',
    },
    {
      id: REF.case6, caseId: REF.case6, status: 'open', priority: 'medium', category: 'lending',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-06-04T16:20:00Z', owner: 'Agent Hoffmann',
      description: 'Kundin erkundigt sich nach dem Gold-Tier-Hypothekenrefinanzierungsangebot nach EZB-Zinssenkung. Wünscht vollständigen Zinsvergleich und Kostendarstellung für Umwandlung von 4,7 % variabel auf 3,9 % fest (5 Jahre). Beratungsgespräch geplant.',
    },
  ],

  voice: {
    calls: [
      { id: 'call-1', taskId: 'task-2024-0892-voice-2', active: true,  customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '09:41',     durationSec: 847, direction: 'inbound',  queue: 'Priority Banking',       caseId: REF.case1, sentiment: 'negative', outcome: null, outcomeKey: null },
      { id: 'call-2', taskId: 'task-2024-0784-voice-1', active: false, customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '2025-05-29', durationSec: 312, direction: 'outbound', queue: 'Rückruf',                caseId: REF.case2, sentiment: 'positive', outcome: 'Gelöst', outcomeKey: 'resolved' },
      { id: 'call-3', taskId: 'task-2024-0651-voice-1', active: false, customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '2025-04-14', durationSec: 489, direction: 'inbound',  queue: 'Allgemeines Banking',    caseId: REF.case3, sentiment: 'neutral',  outcome: 'Weitergeleitet', outcomeKey: 'transferred' },
      { id: 'call-4', taskId: 'task-2024-0445-voice-1', active: false, customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '2025-03-01', durationSec: 228, direction: 'inbound',  queue: 'Allgemeines Banking',    caseId: REF.case4, sentiment: 'positive', outcome: 'Gelöst', outcomeKey: 'resolved' },
    ],
    transcript: [
      { id: 't0', role: 'system', text: 'Eingehender Anruf verbunden · Anna Müller · Priority Banking · 09:41' },
      { id: 't1', role: 'customer', speaker: 'Anna Müller', text: `Guten Morgen. Mein Name ist Anna Müller, Kontonummer ${REF.account}. Ich habe am Dienstag eine SEPA-Überweisung veranlasst — Referenz ${REF.sepaRef} — und der Betrag ist noch nicht angekommen. Es handelt sich um eine Geschäftszahlung und die Rechnung meines Lieferanten war gestern fällig.`, time: '00:12' },
      { id: 't2', role: 'agent', speaker: 'Agent Hoffmann', text: `Guten Morgen, Frau Müller. Ich sehe Ihr Konto. Ich rufe die Überweisung sofort auf — ${REF.sepaRef}. Einen Moment bitte.`, time: '00:42' },
      { id: 't3', role: 'customer', speaker: 'Anna Müller', text: `Der Rechnungsbetrag beträgt ${REF.amount}. Es handelt sich um Rechnung ${REF.invoice}. Mein Lieferant ist ${REF.supplier} in München.`, time: '01:05' },
      { id: 't4', role: 'agent', speaker: 'Agent Hoffmann', text: 'Danke. Ich sehe, dass die Zahlung derzeit durch eine Compliance-Prüfung zurückgehalten wird — unser Betrugsfilter hat die Transaktion aufgrund des Betrags markiert. Ich eskaliere dies jetzt an das Zahlungs-Team. Das sollte innerhalb der nächsten zwei Stunden geklärt sein.', time: '01:28' },
      { id: 't5', role: 'customer', speaker: 'Anna Müller', text: 'Zwei Stunden? Das ist völlig inakzeptabel. Mein Lieferant droht, unser Konto zu sperren, wenn er die Zahlung heute nicht erhält.', time: '01:58' },
      { id: 't6', role: 'agent', speaker: 'Agent Hoffmann', text: 'Frau Müller, ich verstehe Ihre Frustration vollkommen. Ich werde dies als dringend markieren und persönlich dafür sorgen, dass das Zahlungs-Eskalationsteam es priorisiert. Sie erhalten eine SMS-Bestätigung, sobald die Sperre aufgehoben ist.', time: '02:18' },
      { id: 't7', role: 'system', text: '⟳ Live-Transkription läuft…', live: true },
    ],
    aiSummary: {
      headline: 'SEPA-Überweisung blockiert — dringende Lösung erforderlich',
      points: [
        `Kundin: Anna Müller · Kto. ${REF.account} · Priority Banking Stufe`,
        `Überweisung ${REF.sepaRef} über ${REF.amount} an ${REF.supplier} durch Betrugsfilter markiert`,
        `Rechnung ${REF.invoice} überfällig; Lieferant droht mit Kontosperrung`,
        'Agent an Zahlungs-Team eskaliert — ETA 2 Stunden; SMS-Bestätigung zugesagt',
        'Gesamtstimmung: Negativ → Verbesserung nach Eskalationszusage',
      ],
      sentiment: 'negative',
      intent: 'Zahlungsstreit — SEPA-Überweisungsverzögerung',
      suggestedActions: [
        { id: 'a1', label: 'Fall erstellen', type: 'action', description: 'Neuen Priority-Fall für diesen Überweisungsstreit öffnen' },
        { id: 'a2', label: 'SMS-Update senden', type: 'action', description: 'SMS an Kundin senden, Eskalation und 2h ETA bestätigen' },
        { id: 'a3', label: 'An Zahlungen übergeben', type: 'transfer', description: 'Warme Übergabe an das Zahlungs-Eskalationsteam' },
      ],
    },
    openCases: [
      { id: REF.case1, title: `SEPA-Überweisungsstreit — ${REF.amount}`, status: 'Offen',     priority: 'Hoch'     },
      { id: REF.case2, title: 'Login-Fehler nach Passwort-Reset',          status: 'Geschlossen', priority: 'Niedrig' },
      { id: REF.case3, title: 'Überziehungsgebühr-Streit — €45',           status: 'Geschlossen', priority: 'Niedrig' },
    ],
  },

  chat: {
    conversations: [
      { id: 'conv-1', taskId: 'task-2024-0892-wa-1',    channel: 'whatsapp', active: true,  statusKey: 'active',   customer: 'Anna Müller', snippet: 'SEPA-Überweisung noch nicht verbucht…', time: '14 Min.', status: 'Aktiv',      caseId: REF.case1 },
      { id: 'conv-2', taskId: 'task-2024-0784-chat-1',  channel: 'webchat',  active: false, statusKey: 'resolved', customer: 'Anna Müller', snippet: 'Login-Fehler nach Passwort-Reset…',      time: '8 Tg.',  status: 'Gelöst',     caseId: REF.case2 },
      { id: 'conv-3', taskId: 'task-2024-0651-sms-1',   channel: 'sms',      active: false, statusKey: 'resolved', customer: 'Anna Müller', snippet: 'Überziehungsgebühr-Anfrage — €45…',      time: '26 Tg.', status: 'Gelöst',     caseId: REF.case3 },
      { id: 'conv-4', taskId: 'task-2024-0445-inapp-1',   channel: 'in-app',   active: false, statusKey: 'resolved',    customer: 'Anna Müller', snippet: 'Karte in New York gesperrt, brauche Hilfe',                    time: '63 Tg.', status: 'Gelöst',           caseId: REF.case4         },
      { id: 'conv-5', taskId: 'task-2025-0115-apple-1',    channel: 'apple',    active: false, statusKey: 'resolved',    customer: 'Anna Müller', snippet: 'Betrugsalarm — unbekannte Kartentransaktion',                  time: '2 Tg.', status: 'Gelöst',           caseId: 'CASE-2025-0115'  },
      { id: 'conv-6', taskId: 'task-rcs-travel-1',         channel: 'rcs',      active: false, statusKey: 'resolved',    customer: 'Anna Müller', snippet: 'Reisebenachrichtigung bestätigt — Betrugsalarme deaktiviert', time: '71 Tg.', status: 'Gelöst',           caseId: null              },
      { id: 'conv-7', taskId: 'task-2025-0097-wa-2',       channel: 'whatsapp', active: false, statusKey: 'transferred', customer: 'Anna Müller', snippet: 'Konto gesperrt — Weitergeleitet an Betrugs-Team',             time: '3 Tg.',  status: 'Weitergeleitet',   caseId: 'CASE-2025-0097'  },
      { id: 'conv-8', taskId: 'task-2025-0076-webchat-1',  channel: 'webchat',  active: false, statusKey: 'abandoned',   customer: 'Anna Müller', snippet: 'SWIFT-Zahlungsverzögerung — Sitzung abgebrochen',            time: '4 Tg.',  status: 'Abgebrochen',      caseId: 'CASE-2025-0076'  },
    ],
    messages: [
      { id: 'm0', role: 'system',   text: 'Anna Müller via WhatsApp verbunden · vor 14 Min.' },
      { id: 'm1', role: 'customer', text: `Ich habe immer noch kein Update zu meiner SEPA-Überweisung. Meine Referenz ist ${REF.sepaRef}. Das ist wirklich dringend — meine Rechnungsfrist war gestern.`, time: 'vor 14 Min.' },
      { id: 'm2', role: 'customer', text: `Rechnung #${REF.invoice} über ${REF.amount}. Mein Lieferant droht jetzt damit, unser Konto zu sperren.`, time: 'vor 13 Min.' },
      { id: 'm3', role: 'agent',    text: 'Hallo Frau Müller! Ich sehe Ihr Konto und die Zahlungsdetails direkt vor mir. Ich kümmere mich sofort darum — bitte geben Sie mir einen kurzen Moment.', time: 'vor 12 Min.' },
      { id: 'm4', role: 'agent',    text: `Ich sehe, dass dies mit ${REF.case1} verknüpft ist, der bereits an unser Zahlungs-Team eskaliert wurde. Die SEPA-Überweisung ist eingegangen, wartet aber auf eine routinemäßige Compliance-Prüfung.`, time: 'vor 11 Min.' },
      { id: 'm5', role: 'customer', text: 'Compliance-Prüfung? Das ist eine reguläre monatliche Lieferantenzahlung — ich mache diese Überweisung seit zwei Jahren!', time: 'vor 9 Min.' },
      { id: 'm6', role: 'agent',    text: 'Absolut verständlich, Frau Müller. Diese automatische Prüfung wird bei Überweisungen über €10.000 ausgelöst. Aufgrund Ihrer Kontohistorie eskaliere ich jetzt zu unserem Senior-Zahlungsbeauftragten. Sie haben innerhalb von 2 Stunden eine Lösung.', time: 'vor 7 Min.' },
    ],
    aiSuggestions: [
      { label: 'Eskalieren & Bestätigen', text: `Ich habe ${REF.case1} soeben auf Priorität 1 eskaliert. Unser Senior-Zahlungsbeauftragter wird Sie innerhalb der nächsten 2 Stunden direkt kontaktieren, um die Freigabe von ${REF.sepaRef} zu bestätigen.` },
      { label: 'Lösung bereit',           text: `Gute Nachrichten — ${REF.sepaRef} hat die Compliance-Prüfung bestanden. Die Gelder werden Ihrem Lieferanten innerhalb von 1–2 Geschäftsstunden gutgeschrieben.` },
      { label: 'Zukünftige Verzögerung verhindern', text: `Ich habe einen Vermerk zu ${REF.case1} hinzugefügt, der bestätigt, dass es sich um eine wiederkehrende Lieferantenzahlung handelt, und eine Ausnahme für künftige Überweisungen beantragt.` },
    ],
    openCases: [
      { id: REF.case1, topic: 'Zahlungsabwicklung', status: 'In Bearbeitung', priority: 'Hoch',    color: '#f5a623' },
      { id: REF.case2, topic: 'Login-Zugang',        status: 'Offen',          priority: 'Mittel',  color: '#00a0d1' },
      { id: REF.case3, topic: 'Überziehungsstreit',  status: 'In Bearbeitung', priority: 'Hoch',    color: '#f5a623' },
    ],
    messagesByConvId: {
      'conv-1': [
        { id: 'm0', role: 'system',   text: 'Anna Müller via WhatsApp verbunden · vor 14 Min.' },
        { id: 'm1', role: 'customer', text: `Ich habe immer noch kein Update zu meiner SEPA-Überweisung. Meine Referenz ist ${REF.sepaRef}. Das ist wirklich dringend — meine Rechnungsfrist war gestern.`, time: 'vor 14 Min.' },
        { id: 'm2', role: 'customer', text: `Rechnung #${REF.invoice} über ${REF.amount}. Mein Lieferant droht jetzt damit, unser Konto zu sperren.`, time: 'vor 13 Min.' },
        { id: 'm3', role: 'agent',    text: 'Hallo Frau Müller! Ich sehe Ihr Konto und die Zahlungsdetails direkt vor mir. Ich kümmere mich sofort darum — bitte geben Sie mir einen kurzen Moment.', time: 'vor 12 Min.' },
        { id: 'm4', role: 'agent',    text: `Ich sehe, dass dies mit ${REF.case1} verknüpft ist, der bereits an unser Zahlungs-Team eskaliert wurde. Die SEPA-Überweisung ist eingegangen, wartet aber auf eine routinemäßige Compliance-Prüfung.`, time: 'vor 11 Min.' },
        { id: 'm5', role: 'customer', text: 'Compliance-Prüfung? Das ist eine regelmäßige monatliche Lieferantenzahlung — ich führe diese Überweisung seit zwei Jahren durch!', time: 'vor 9 Min.' },
        { id: 'm6', role: 'agent',    text: 'Absolut verständlich, Frau Müller. Diese automatische Prüfung wird bei Überweisungen über €10.000 ausgelöst. Aufgrund Ihrer Kontohistorie eskaliere ich jetzt zu unserem Senior-Zahlungsbeauftragten. Sie haben innerhalb von 2 Stunden eine Lösung.', time: 'vor 7 Min.' },
      ],
      'conv-2': [
        { id: 'c2-m0', role: 'system',   text: 'Anna Müller via Webchat verbunden · vor 8 Tagen' },
        { id: 'c2-m1', role: 'customer', text: 'Hallo, ich habe gestern mein Passwort zurückgesetzt, kann mich aber jetzt nicht einloggen. Es fragt nach einem 2FA-Code, aber ich erhalte keine SMS.', time: 'vor 8 Tg.' },
        { id: 'c2-m2', role: 'agent',    text: 'Hallo Frau Müller! Der Passwort-Reset war erfolgreich. Ich schaue mir das 2FA-Problem an. Können Sie die Handynummer Ihres Kontos bestätigen?', time: 'vor 8 Tg.' },
        { id: 'c2-m3', role: 'customer', text: '+49 170 987 6543. Ich habe es dreimal in der letzten Stunde versucht.', time: 'vor 8 Tg.' },
        { id: 'c2-m4', role: 'agent',    text: 'Ich sehe ein Routing-Problem mit unserem SMS-Anbieter für deutsche Nummern. Ich stelle Ihre 2FA vorläufig auf E-Mail um. Sie erhalten einen Code an a.mueller@bavarian-tech.de innerhalb von 2 Minuten.', time: 'vor 8 Tg.' },
        { id: 'c2-m5', role: 'customer', text: 'Erhalten! Das hat funktioniert. Ich bin jetzt drin. Vielen Dank!', time: 'vor 8 Tg.' },
      ],
      'conv-3': [
        { id: 'c3-m0', role: 'system',   text: 'Ausgehende SMS zugestellt an +49 89 1234 5678 · vor 26 Tagen' },
        { id: 'c3-m1', role: 'agent',    text: `Guten Tag Frau Müller, hier ist die Moneta Bank. Ihr Überziehungsgebühr-Widerspruch (Fall ${REF.case3}) wurde geprüft und genehmigt. Eine Rückerstattung von €45 wurde heute auf Ihr Konto gebucht.`, time: 'vor 26 Tg.' },
        { id: 'c3-m2', role: 'customer', text: 'Danke, das sind tolle Nachrichten!', time: 'vor 26 Tg.' },
      ],
      'conv-4': [
        { id: 'c4-m0', role: 'system',   text: 'Anna Müller via In-App-Chat verbunden · vor 63 Tagen' },
        { id: 'c4-m1', role: 'customer', text: 'Hallo, ich möchte mein Kartenlimit vorübergehend auf €20.000 erhöhen. Können Sie das schnell erledigen?', time: 'vor 63 Tg.' },
        { id: 'c4-m2', role: 'agent',    text: 'Hallo Frau Müller! Ja, ich kann eine vorübergehende Kreditlimit-Erhöhung bearbeiten. Ich muss zuerst Ihre Identität bestätigen.', time: 'vor 63 Tg.' },
        { id: 'c4-m3', role: 'customer', text: '15.04.1982, Konto endet auf 5678.', time: 'vor 63 Tg.' },
        { id: 'c4-m4', role: 'agent',    text: 'Identität bestätigt. Ich bearbeite die vorübergehende Erhöhung auf €20.000 für 30 Tage. In 5 Minuten aktiv.', time: 'vor 63 Tg.' },
        { id: 'c4-m5', role: 'customer', text: 'Perfekt, vielen Dank!', time: 'vor 63 Tg.' },
      ],
      'conv-5': [
        { id: 'c5-m0', role: 'system',   text: 'Anna Müller verbunden über Apple Messages · vor 2 Tagen' },
        { id: 'c5-m1', role: 'customer', text: 'Hallo, ich habe soeben eine unbekannte Belastung über €4.200 auf meiner Karte festgestellt. Können Sie mir helfen?', time: 'vor 2 Tg.' },
        { id: 'c5-m2', role: 'agent',    text: 'Guten Tag, Frau Müller! Unser Betrugs-Team hat bereits eine Rückbuchungsuntersuchung eingeleitet. Ihre Karte wurde vorsorglich gesperrt.', time: 'vor 2 Tg.' },
        { id: 'c5-m3', role: 'customer', text: 'Danke für die schnelle Reaktion. Bekomme ich das Geld zurück?', time: 'vor 2 Tg.' },
        { id: 'c5-m4', role: 'agent',    text: 'Ja — bei erfolgreicher Rückbuchung wird der Betrag vollständig gutgeschrieben. Die Untersuchung dauert 5–10 Werktage.', time: 'vor 2 Tg.' },
      ],
      'conv-6': [
        { id: 'c6-m0', role: 'system',   text: 'Anna Müller hat eine RCS-Nachricht gesendet · vor 71 Tagen' },
        { id: 'c6-m1', role: 'customer', text: 'Hallo, ich reise nächste Woche in die USA (17.–30. März). Bitte deaktivieren Sie Betrugsalarme für diesen Zeitraum.', time: 'vor 71 Tg.' },
        { id: 'c6-m2', role: 'agent',    text: 'Reisebenachrichtigung für 17.–30. März in den USA bestätigt. Betrugsalarme für 14 Tage deaktiviert. Gute Reise!', time: 'vor 71 Tg.' },
      ],
      'conv-7': [
        { id: 'c7-m0', role: 'system',   text: 'Anna Müller verbunden über WhatsApp · vor 3 Tagen' },
        { id: 'c7-m1', role: 'customer', text: 'Ich versuche mich beim Online-Banking anzumelden, aber es heißt, mein Konto sei gesperrt.', time: 'vor 3 Tg.' },
        { id: 'c7-m2', role: 'agent',    text: 'Ihr Konto wurde nach 3 fehlgeschlagenen Anmeldeversuchen gesperrt. Ich übergebe Sie jetzt an unser Betrugs-Verifikationsteam.', time: 'vor 3 Tg.' },
        { id: 'c7-m3', role: 'system',   text: 'Sitzung an Betrugs-Verifikationsteam übergeben · vor 3 Tagen' },
      ],
      'conv-8': [
        { id: 'c8-m0', role: 'system',   text: 'Anna Müller verbunden über Webchat · vor 4 Tagen' },
        { id: 'c8-m1', role: 'customer', text: 'Hallo, ich habe vor 4 Tagen eine SWIFT-Überweisung veranlasst und sie ist noch nicht angekommen.', time: 'vor 4 Tg.' },
        { id: 'c8-m2', role: 'agent',    text: 'Guten Tag, Frau Müller! Ich schaue gerne nach. Können Sie mir die Zahlungsreferenz nennen?', time: 'vor 4 Tg.' },
        { id: 'c8-m3', role: 'system',   text: 'Sitzung nach 8 Minuten Inaktivität beendet' },
      ],
    },
  },

  history: {
    events: [
      // ── Aufgabe 1: CASE-2024-0892 — E-Mail-Eskalation (aktiv, negativ) ────
      { id: 'de-t1-e1', taskId: 'task-2024-0892-email-3', ts: ago(5 * MIN),          channel: 'email',    eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Priority Banking E-Mail', agentName: 'Agent Hoffmann', title: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, summary: `Dritte Eskalation. SEPA-Ref. ${REF.sepaRef} belastet, aber im System nicht verbucht. Rechnung und Bankbestätigung beigefügt.`, caseId: REF.case1 },
      { id: 'de-t1-e2', taskId: 'task-2024-0892-email-3', ts: ago(4 * MIN),          channel: 'email',    eventType: 'task:connected', typeLabel: 'Verbunden',    direction: 'inbound',  queueName: 'Priority Banking E-Mail', agentName: 'Agent Hoffmann', title: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, summary: 'Agent Hoffmann prüft Eskalation und bereitet Prioritätsantwort vor.', caseId: REF.case1 },
      // ── Aufgabe 2: CASE-2024-0892 — Telefonanruf Follow-up (gelöst, positiv) ─
      { id: 'de-t2-e1', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H),            channel: 'voice',    eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Priority Banking',        agentName: 'Agent Hoffmann', title: 'Eingehender Anruf – Follow-up Zahlungsabwicklung', summary: `Kundin rief wegen ${REF.case1} nach. Weiterleitung an Zahlungs-Team.`, ivrDuration: 45, caseId: REF.case1 },
      { id: 'de-t2-e2', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H - 2 * MIN), channel: 'voice',    eventType: 'task:connected', typeLabel: 'Verbunden',    direction: 'inbound',  queueName: 'Priority Banking',        agentName: 'Agent Hoffmann', title: 'Eingehender Anruf – Follow-up Zahlungsabwicklung', summary: 'Agent Hoffmann verbunden. Prüft SEPA-Sperrstatus mit Zahlungs-Team.', caseId: REF.case1 },
      { id: 'de-t2-e3', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H - 10 * MIN), channel: 'voice',   eventType: 'task:ended',     typeLabel: 'Beendet',      direction: 'inbound',  queueName: 'Priority Banking',        agentName: 'Agent Hoffmann', title: 'Eingehender Anruf – Follow-up Zahlungsabwicklung', summary: 'Gelöst: Eskalation an Senior-Zahlungsbeauftragten bestätigt. ETA 2h. Kundin zufrieden.', wrapUpName: 'Zahlungseskalation – Gelöst', caseId: REF.case1 },
      // ── Aufgabe 3: CASE-2024-0892 — WhatsApp-Follow-up (geparkt, neutral) ───
      { id: 'de-t3-e1', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D),            channel: 'whatsapp', eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Digitales Messaging',     agentName: 'Agent Krause',   title: `SEPA-Überweisung noch nicht verbucht – WhatsApp`, summary: `Kundin kontaktiert via WhatsApp. Ref. ${REF.sepaRef} ungelöst. Weitergeleitet an Agent Krause.`, caseId: REF.case1 },
      { id: 'de-t3-e2', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D - 3 * MIN), channel: 'whatsapp', eventType: 'task:connected', typeLabel: 'Verbunden',    direction: 'inbound',  queueName: 'Digitales Messaging',     agentName: 'Agent Krause',   title: `SEPA-Überweisung noch nicht verbucht – WhatsApp`, summary: 'Agent Krause prüft verknüpften Fall und sendet Statusmeldung.', caseId: REF.case1 },
      { id: 'de-t3-e3', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D - 8 * MIN), channel: 'whatsapp', eventType: 'task:parked',    typeLabel: 'Geparkt',      direction: 'inbound',  queueName: 'Digitales Messaging',     agentName: 'Agent Krause',   title: `SEPA-Überweisung noch nicht verbucht – WhatsApp`, summary: 'Geparkt, bis Compliance-Team zurückruft. Kundin über 2h-Fenster informiert.', caseId: REF.case1 },
      // ── Aufgabe 4: CASE-2024-0784 — Webchat Login (gelöst, positiv) ─────────
      { id: 'de-t4-e1', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D),            channel: 'chat',     eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Allg. Banking Chat',      agentName: 'Agent Krause',   title: 'Online-Banking-Zugriffsproblem – Webchat', summary: 'Kundin meldete Login-Fehler nach Passwort-Reset. 2FA SMS nicht geliefert.', caseId: REF.case2 },
      { id: 'de-t4-e2', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D - 5 * MIN), channel: 'chat',     eventType: 'task:connected', typeLabel: 'Verbunden',    direction: 'inbound',  queueName: 'Allg. Banking Chat',      agentName: 'Agent Krause',   title: 'Online-Banking-Zugriffsproblem – Webchat', summary: 'Agent Krause verbunden. Diagnose des 2FA-Lieferproblems mit IT.', caseId: REF.case2 },
      { id: 'de-t4-e3', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D - 18 * MIN), channel: 'chat',    eventType: 'task:ended',     typeLabel: 'Beendet',      direction: 'inbound',  queueName: 'Allg. Banking Chat',      agentName: 'Agent Krause',   title: 'Online-Banking-Zugriffsproblem – Webchat', summary: 'Gelöst: SMS-Routing-Problem behoben. Kundin hat in der Sitzung Zugang wiedererlangt.', caseId: REF.case2 },
      // ── Aufgabe 5: CASE-2024-0651 — WhatsApp Überziehungsgebühr (geparkt) ───
      { id: 'de-t5-e1', taskId: 'task-2024-0651-wa-1',    ts: ago(14 * D),           channel: 'whatsapp', eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Digitales Messaging',     agentName: 'Agent Weber',    title: 'Überziehungsgebühren-Streit – WhatsApp', summary: 'Kundin fragte via WhatsApp nach €45-Überziehungsgebühr vom 8. Mai.', caseId: REF.case3 },
      { id: 'de-t5-e2', taskId: 'task-2024-0651-wa-1',    ts: ago(14 * D - 4 * MIN), channel: 'whatsapp', eventType: 'task:parked',   typeLabel: 'Geparkt',      direction: 'inbound',  queueName: 'Digitales Messaging',     agentName: 'Agent Weber',    title: 'Überziehungsgebühren-Streit – WhatsApp', summary: 'Geparkt während Back-Office-Team Verzögerungsnachweis prüft.', caseId: REF.case3 },
      // ── Aufgabe 6: CASE-2024-0651 — ausgehende SMS (gelöst, positiv) ────────
      { id: 'de-t6-e1', taskId: 'task-2024-0651-sms-1',   ts: ago(21 * D),           channel: 'sms',      eventType: 'task:new',       typeLabel: 'Neu',          direction: 'outbound', queueName: 'Proaktiver Kontakt',      agentName: 'Agent Weber',    title: 'SMS: Gebührenerlass bestätigt', summary: `Ausgehende SMS an +49 89 1234 5678: Gebührenerlass für ${REF.case3} genehmigt.`, caseId: REF.case3 },
      { id: 'de-t6-e2', taskId: 'task-2024-0651-sms-1',   ts: ago(21 * D - 1 * MIN), channel: 'sms',      eventType: 'task:ended',    typeLabel: 'Beendet',      direction: 'outbound', queueName: 'Proaktiver Kontakt',      agentName: 'Agent Weber',    title: 'SMS: Gebührenerlass bestätigt', summary: 'Zugestellt. Kundin antwortete: „Vielen Dank, das ist eine gute Nachricht."', caseId: REF.case3 },
      // ── Aufgabe 7: kein Fall — E-Mail Kontoauszug-Anfrage (gelöst, positiv) ─
      { id: 'de-t7-e1', taskId: 'task-stmt-email-1',       ts: ago(35 * D),           channel: 'email',    eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Allg. Anfragen E-Mail',   agentName: 'Agent Fischer',  title: 'Kontoauszug-Anfrage – April-Position', summary: 'Kundin fragte nach Klärung einer Kontoauszugsposition. Währungsumrechnungsgebühr bei USD-Kauf.', caseId: null },
      { id: 'de-t7-e2', taskId: 'task-stmt-email-1',       ts: ago(35 * D - 6 * H),  channel: 'email',    eventType: 'task:ended',    typeLabel: 'Beendet',      direction: 'inbound',  queueName: 'Allg. Anfragen E-Mail',   agentName: 'Agent Fischer',  title: 'Kontoauszug-Anfrage – April-Position', summary: 'Gelöst: Gebühr erklärt. Kundin zufrieden, kein weiterer Handlungsbedarf.', caseId: null },
      // ── Aufgabe 8: CASE-2024-0445 — In-App Kreditlimit-Erhöhung (gelöst) ────
      { id: 'de-t8-e1', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D),           channel: 'chat',     eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'In-App Support',          agentName: 'Agent Bauer',    title: 'Kreditkartenlimit-Erhöhung – In-App-Chat', summary: 'Kundin beantragte temporäre Kreditkartenlimit-Erhöhung auf €20.000 für geplante Beschaffung.', caseId: REF.case4 },
      { id: 'de-t8-e2', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D - 3 * MIN), channel: 'chat',     eventType: 'task:connected', typeLabel: 'Verbunden',    direction: 'inbound', queueName: 'In-App Support',          agentName: 'Agent Bauer',    title: 'Kreditkartenlimit-Erhöhung – In-App-Chat', summary: 'Agent Bauer bearbeitet Limiterhöhung nach Identitätsprüfung.', caseId: REF.case4 },
      { id: 'de-t8-e3', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D - 10 * MIN), channel: 'chat',    eventType: 'task:ended',    typeLabel: 'Beendet',      direction: 'inbound',  queueName: 'In-App Support',          agentName: 'Agent Bauer',    title: 'Kreditkartenlimit-Erhöhung – In-App-Chat', summary: 'Genehmigt: Limit für 30 Tage auf €20.000 erhöht. Beschaffung erfolgreich abgeschlossen.', caseId: REF.case4 },
      // ── Aufgabe 9: kein Fall — abgebrochener Rückruf (negativ) ──────────────
      { id: 'de-t9-e1', taskId: 'task-callback-voice-1',   ts: ago(50 * D),           channel: 'voice',    eventType: 'task:new',       typeLabel: 'Neu',          direction: 'outbound', queueName: 'Geplante Rückrufe',       agentName: 'Agent Fischer',  title: 'Ausgehender Rückruf – Kontoüberprüfung', summary: 'Geplanter Jahres-Kontoüberprüfungs-Rückruf. Kundin nicht erreichbar.', caseId: null },
      { id: 'de-t9-e2', taskId: 'task-callback-voice-1',   ts: ago(50 * D - 2 * MIN), channel: 'voice',    eventType: 'task:connected', typeLabel: 'Verbunden',    direction: 'outbound', queueName: 'Geplante Rückrufe',       agentName: 'Agent Fischer',  title: 'Ausgehender Rückruf – Kontoüberprüfung', summary: 'Mailbox-Nachricht hinterlassen. Follow-up-E-Mail eingeplant.', caseId: null },
      // ── Aufgabe 10: CASE-2024-0445 — Karte im Ausland gesperrt (gelöst) ─────
      { id: 'de-t10-e1', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D),            channel: 'voice',   eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Betrug & Sicherheit',     agentName: 'Agent Weber',    title: 'Eingehender Anruf – Karte im Ausland gesperrt', summary: 'Karte während Auslandsreise (USA) gesperrt. Kundin ruft aus New York an.', ivrDuration: 90, caseId: REF.case4 },
      { id: 'de-t10-e2', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D - 1 * MIN), channel: 'voice',    eventType: 'task:connected', typeLabel: 'Verbunden',    direction: 'inbound',  queueName: 'Betrug & Sicherheit',     agentName: 'Agent Weber',    title: 'Eingehender Anruf – Karte im Ausland gesperrt', summary: 'Identität per Video-Call verifiziert. Kartenreaktivierung für USA-Reise wird bearbeitet.', holdDuration: 120, caseId: REF.case4 },
      { id: 'de-t10-e3', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D - 22 * MIN), channel: 'voice',   eventType: 'task:ended',    typeLabel: 'Beendet',      direction: 'inbound',  queueName: 'Betrug & Sicherheit',     agentName: 'Agent Weber',    title: 'Eingehender Anruf – Karte im Ausland gesperrt', summary: 'Gelöst: Karte in 20 Min. reaktiviert. Reisehinweis hinterlegt. Kundin zufrieden.', wrapUpName: 'Karte reaktiviert – Reise-Auth', caseId: REF.case4 },
      // ── Aufgabe 11: kein Fall — RCS Reisemitteilung (gelöst, positiv) ────────
      { id: 'de-t11-e1', taskId: 'task-rcs-001',           ts: ago(71 * D),            channel: 'rcs',     eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Digitales Messaging',     agentName: 'Agent Krause',   title: 'Reisemitteilung – RCS', summary: 'Kundin sendete Reisemitteilung für USA-Reise via RCS. Betrugsalarm für 14 Tage deaktiviert.', caseId: null },
      { id: 'de-t11-e2', taskId: 'task-rcs-001',           ts: ago(71 * D - 2 * MIN), channel: 'rcs',      eventType: 'task:ended',    typeLabel: 'Beendet',      direction: 'inbound',  queueName: 'Digitales Messaging',     agentName: 'Agent Krause',   title: 'Reisemitteilung – RCS', summary: 'Karte für internationalen Einsatz freigegeben. Betrugsalarme für 14 Tage deaktiviert.', caseId: null },
      // ── Aufgabe 12: CASE-2024-0312 — E-Mail SEPA-Verzögerung (geparkt) ───────
      { id: 'de-t12-e1', taskId: 'task-2024-0312-email-1', ts: ago(81 * D),            channel: 'email',   eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Priority Banking E-Mail', agentName: 'Agent Fischer',  title: 'SEPA-Überweisungsverzögerung – Anfrage', summary: 'Kundin fragte nach verzögerter Zahlung an Lieferanten. AML-Prüfschwelle ausgelöst.', caseId: REF.case5 },
      { id: 'de-t12-e2', taskId: 'task-2024-0312-email-1', ts: ago(81 * D - 3 * H),  channel: 'email',    eventType: 'task:parked',   typeLabel: 'Geparkt',      direction: 'inbound',  queueName: 'Priority Banking E-Mail', agentName: 'Agent Fischer',  title: 'SEPA-Überweisungsverzögerung – Anfrage', summary: 'Geparkt bis AML-Freigabe. Kundin über 3-Werktage-Frist informiert.', caseId: REF.case5 },
      // ── System S1: Betrugsalarm (2 Tage, negativ) ───────────────────────────
      { id: 'de-s1-e1', taskId: 'task-fraud-alert-2d',     ts: ago(2 * D),            channel: 'system',   eventType: 'task:new',       typeLabel: 'Warnung',   direction: null,       queueName: 'Risikomanagement',        agentName: 'Betrugserkennung',       title: 'Betrugsalarm: ungewöhnliches Transaktionsmuster', summary: '3 schnelle Online-Käufe über €850 von unbekannten Händler-IDs in Osteuropa erkannt. Konto vorübergehend gesperrt. Kundin per SMS benachrichtigt.', caseId: null },
      // ── System S2: Premium-Angebot (18 Tage, positiv) ────────────────────────
      { id: 'de-s2-e1', taskId: 'task-marketing-gold-18d', ts: ago(18 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Angebot',   direction: null,       queueName: 'Marketing-Automatisierung', agentName: 'Personalisierungs-Engine', title: 'Personalisiertes Angebot: Moneta Gold-Tier Upgrade', summary: 'Basierend auf Transaktionsvolumen (€48k YTD) qualifiziert sich Kundin für Gold-Tier. Push-Benachrichtigung und In-App-Angebot versendet.', caseId: null },
      { id: 'de-s2-e2', taskId: 'task-marketing-gold-18d', ts: ago(18 * D - 4 * H),  channel: 'system',   eventType: 'task:ended',    typeLabel: 'Abgeschlossen', direction: null,    queueName: 'Marketing-Automatisierung', agentName: 'Personalisierungs-Engine', title: 'Personalisiertes Angebot: Moneta Gold-Tier Upgrade', summary: 'Angebot von Kundin angesehen (2 Min. Engagement). Keine Konversion. Follow-up-E-Mail in 7 Tagen geplant.', caseId: null },
      // ── System S3: KYC-Prüfung (48 Tage, neutral) ───────────────────────────
      { id: 'de-s3-e1', taskId: 'task-kyc-review-48d',     ts: ago(48 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Compliance', direction: null,      queueName: 'Compliance',             agentName: 'KYC-System',             title: 'Jährliche KYC-Prüfung — Dokumente angefordert', summary: 'Regulatorische KYC-Jahresprüfung ausgelöst. E-Mail gesendet: aktualisierter Lichtbildausweis und Adressbestätigung erforderlich. Frist: 30 Tage.', caseId: null },
      { id: 'de-s3-e2', taskId: 'task-kyc-review-48d',     ts: ago(48 * D - 1 * H),  channel: 'system',   eventType: 'task:parked',   typeLabel: 'Ausstehend', direction: null,       queueName: 'Compliance',             agentName: 'KYC-System',             title: 'Jährliche KYC-Prüfung — Dokumente angefordert', summary: 'Warte auf Dokumente. Automatische Erinnerung am Tag 14 geplant.', caseId: null },
      // ── System S4: Treue-Meilenstein (57 Tage, positiv) ─────────────────────
      { id: 'de-s4-e1', taskId: 'task-loyalty-5k-57d',     ts: ago(57 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Prämie',    direction: null,       queueName: 'Treueprogramm',          agentName: 'Loyalty-Engine',         title: '5.000 Moneta-Bonuspunkte erreicht', summary: 'Kundin überschritt 5.000 Punkte (Gold-Schwelle). Glückwunsch-E-Mail mit Gold-Vorteilen versendet.', caseId: null },
      { id: 'de-s4-e2', taskId: 'task-loyalty-5k-57d',     ts: ago(57 * D - 20 * MIN), channel: 'system',  eventType: 'task:ended',    typeLabel: 'Abgeschlossen', direction: null,    queueName: 'Treueprogramm',          agentName: 'Loyalty-Engine',         title: '5.000 Moneta-Bonuspunkte erreicht', summary: 'Prämienbenachrichtigung geöffnet. 3-monatiger Gebührenerlass automatisch angewendet.', caseId: null },
      // ── System S5: EZB-Zinsalert (70 Tage, neutral) ─────────────────────────
      { id: 'de-s5-e1', taskId: 'task-ecb-rate-70d',       ts: ago(70 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Beratung',  direction: null,       queueName: 'Produktmanagement',      agentName: 'Zinswächter-System',     title: 'EZB-Zinssenkung — Hypothekenrefinanzierungschance', summary: 'EZB-Leitzins um 0,25% auf 3,25% gesenkt. Kundin hat variablen Hypothekenzins von 4,7%. Festzinsangebot 3,9% (5 Jahre) per E-Mail und Push versendet.', caseId: null },
      { id: 'de-s5-e2', taskId: 'task-ecb-rate-70d',       ts: ago(70 * D - 2 * H),  channel: 'system',   eventType: 'task:parked',   typeLabel: 'Ausstehend', direction: null,      queueName: 'Produktmanagement',      agentName: 'Zinswächter-System',     title: 'EZB-Zinssenkung — Hypothekenrefinanzierungschance', summary: 'Angebot angesehen, keine Maßnahme. Berater-Anruf geplant. Angebot 14 Tage gültig.', caseId: null },
      // ── System S6: PSD2-Neuauthentifizierung (78 Tage, negativ) ──────────────
      { id: 'de-s6-e1', taskId: 'task-psd2-reauth-78d',    ts: ago(78 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Sicherheit', direction: null,      queueName: 'Sicherheit',             agentName: 'Authentifizierungssystem', title: 'PSD2 biometrische Neuregistrierung erforderlich', summary: 'Regulatorisches 90-Tage-Starkes-Authentifizierungs-Reset. 3 Push-Benachrichtigungen ohne Reaktion. SMS-Fallback gesendet. Neuregistrierung vor nächstem Login erforderlich.', caseId: null },
      // ── Aufgabe 4b: CASE-2024-0784 — E-Mail-Nachverfolgung Login/App (gelöst) ──
      { id: 'de-t4b-e1', taskId: 'task-2024-0784-email-1', ts: ago(7 * D),            channel: 'email',    eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Digital-Support E-Mail', agentName: 'Agent Hoffmann', title: 'Online-Banking — App-Update nach Login-Behebung', summary: 'Nachverfolgungs-E-Mail nach Webchat-Sitzung. 2FA gelöst; Kundin bittet um Anleitung für App-v3.2-Update.', caseId: REF.case2 },
      { id: 'de-t4b-e2', taskId: 'task-2024-0784-email-1', ts: ago(7 * D - 2 * H),   channel: 'email',    eventType: 'task:ended',    typeLabel: 'Beendet',      direction: 'inbound',  queueName: 'Digital-Support E-Mail', agentName: 'Agent Hoffmann', title: 'Online-Banking — App-Update nach Login-Behebung', summary: 'Gelöst: Schritt-für-Schritt-Updateanleitung gesendet. Kundin bestätigte erfolgreiches Update über App Store. Fall CASE-2024-0784 geschlossen.', caseId: REF.case2 },
      // ── Aufgabe 13: CASE-2025-0104 — Hypothekenrefinanzierungsanfrage (offen)
      { id: 'de-t13-e1', taskId: 'task-2025-0104-email-1', ts: ago(2 * D - 2 * H),   channel: 'email',    eventType: 'task:new',       typeLabel: 'Neu',          direction: 'inbound',  queueName: 'Premium-Kreditvergabe',  agentName: 'Agent Hoffmann', title: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9\u00a0% fest', summary: 'Kundin reagiert positiv auf EZB-Zinssenkungsangebot. Bittet um vollständigen Zinsvergleich und Kostendarstellung vor Beratungsgespräch.', caseId: REF.case6 },
      { id: 'de-t13-e2', taskId: 'task-2025-0104-email-1', ts: ago(2 * D - 4 * H),   channel: 'email',    eventType: 'task:parked',   typeLabel: 'Geparkt',      direction: 'inbound',  queueName: 'Premium-Kreditvergabe',  agentName: 'Agent Hoffmann', title: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9\u00a0% fest', summary: 'ESIS-Darstellung und Zinsvergleich erstellt. Beratungsgespräch für nächsten Werktag vereinbart.', caseId: REF.case6 },
      // ── Kampagne C1: Q2-Kundenbindungsangebot (vor 6 Tagen)
      { id: 'de-c1-e1', taskId: null, ts: ago(6 * D), channel: 'email', eventType: 'email:out', typeLabel: 'Kampagne', direction: 'outbound', title: 'Kampagne: moneta_q2_retention_2026', summary: 'Personalisiertes Kundenbindungsangebot versendet: Gold-Tier-Gebührenbefreiung + Reiseversicherung. Q2-2026-Risikosegmentkampagne (482 Empfänger).', campaign: 'moneta_q2_retention_2026', campaignStatus: 'Success', caseId: null },
      // ── Kampagne C2: EZB-Zinssenkungsbenachrichtigung (vor 71 Tagen)
      { id: 'de-c2-e1', taskId: null, ts: ago(71 * D), channel: 'email', eventType: 'email:out', typeLabel: 'Kampagne', direction: 'outbound', title: 'Kampagne: ezb_zinssenkung_maerz26', summary: 'EZB-Zinssenkungsbenachrichtigung: 3,9 % Festzins Hypothekenrefinanzierung. Zielgruppe: variable Hypothekeninhaber mit Saldo > 150.000 €.', campaign: 'ezb_zinssenkung_maerz26', campaignStatus: 'Success', caseId: null },
    ],
    interactionSummaries: {
      'task-2024-0892-voice-2': {
        initialContactReason: 'Kundin rief an, um eine ausstehende Zahlungseskalation für Rechnung #' + REF.invoice + ' nachzuverfolgen. Die SEPA-Überweisung war belastet, aber seit über einer Woche nicht gutgeschrieben.',
        keyActionsTaken: 'Agent Hoffmann eskalierte den Fall an das Senior-Zahlungsbeauftragte-Team. Kundin wurde über eine Rückrufszeit von 2 Stunden informiert.',
        nextSteps: 'Senior-Zahlungsbeauftragter ruft innerhalb von 2 Stunden zurück, um manuelle Gutschrift zu bestätigen. Fall ' + REF.case1 + ' bleibt offen bis zur Bestätigung.',
      },
      'task-2024-0445-voice-1': {
        initialContactReason: 'Kreditkarte der Kundin wurde automatisch durch Betrugserkennung bei Auslandsreise in die USA gesperrt. Kundin rief aus New York an.',
        keyActionsTaken: 'Identität per Video-Call verifiziert. Karte in 20 Minuten für internationalen Einsatz reaktiviert. Reisehinweis für den USA-Aufenthalt (17.–30. März) hinterlegt. 2 Minuten Hold während der Reaktivierung.',
        nextSteps: 'Keine weiteren Maßnahmen erforderlich. Kundin bestätigt Kartennutzung am Point of Sale.',
        additionalContactReasons: 'Kundin fragte auch nach Erhöhung des täglichen Geldautomaten-Limits — an Mobile-App-Self-Service verwiesen.',
      },
    },
    aiSummary: `Anna Müller (Bavarian Tech GmbH, Finanzdirektorin) ist eine hochwertige Kundin mit einem Muster von Zahlungsabwicklungsproblemen. Der aktive Fall ${REF.case1} ist ihre dritte Eskalation für Rechnung #${REF.invoice} (${REF.amount}). Die Geschichte zeigt 2 zuvor gelöste Fälle (Kartensperre, SEPA-Verzögerung) und ein offenes Login-Problem. Stimmung dringend — sofortige Eskalation an das Zahlungs-Team und proaktiver Rückruf empfohlen.`,
  },

  email: {
    activeEmail: {
      messageId: 'mock-msg-001', threadId: 'mock-thread-001',
      from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: 'buchhaltung@bavarian-tech.de',
      subject: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`,
      date: 'Do., 5. Jun 2025 14:22',
      snippet: `Dritter Versuch, Zahlungsfehler für Rechnung #${REF.invoice} (${REF.amount}) zu lösen. SEPA-Ref.: ${REF.sepaRef}.`,
      bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Sehr geehrtes Support-Team,</p><p>ich schreibe Ihnen dringend bezüglich des Zahlungsfehlers für <strong>Rechnung #${REF.invoice}</strong> (${REF.amount}). Dies ist unser <strong>dritter Versuch</strong>, dieses Problem zu lösen.</p><p>SEPA-Überweisung Ref.: ${REF.sepaRef}, initiiert am 29. Mai 2025. Gelder belastet, aber im System nicht verbucht.</p><ul><li>Rechnung: ${REF.invoice}</li><li>Betrag: ${REF.amount}</li><li>Referenz: ${REF.sepaRef}</li></ul><p>Bitte behandeln Sie dies als <strong>Prioritätsfall</strong>. Rechnung und Bankbestätigung beigefügt.</p><p>Mit freundlichen Grüßen,<br/>Anna Müller<br/>Finanzdirektorin, Bavarian Tech GmbH</p></div>`,
      bodyText: '', attachments: [
        { attachmentId: 'mock-att-1', filename: `rechnung_${REF.invoice}.pdf`, mimeType: 'application/pdf', size: 45820 },
        { attachmentId: 'mock-att-2', filename: 'bank_bestaetigung_SEPA.pdf', mimeType: 'application/pdf', size: 23440 },
      ],
    },
    thread: [
      { messageId: 'mock-msg-000', threadId: 'mock-thread-001', from: 'Support-Team <support@moneta-bank.com>', to: 'a.mueller@bavarian-tech.de', cc: '', subject: `Re: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, date: 'Mi., 4. Jun 2025 10:05', snippet: 'Wir haben Ihre Anfrage erhalten und unser Zahlungs-Team kümmert sich darum.', bodyHtml: '<p>Sehr geehrte Frau Müller,</p><p>wir haben Ihre Anfrage erhalten und unser Zahlungs-Team prüft dies. Wir werden Sie innerhalb von 24 Stunden informieren.</p><p>Mit freundlichen Grüßen,<br/>Moneta Bank Support</p>', bodyText: '', attachments: [] },
      { messageId: 'mock-msg-002', threadId: 'mock-thread-001', from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: '', subject: `Re: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, date: 'Mi., 4. Jun 2025 16:48', snippet: 'Noch keine Rückmeldung. Können Sie bitte eskalieren?', bodyHtml: '<p>Hallo,</p><p>ich habe immer noch kein Update erhalten. Können Sie das bitte an einen Vorgesetzten eskalieren? Wir können unsere Bücher nicht abschließen, bis dies gelöst ist.</p><p>A. Müller</p>', bodyText: '', attachments: [] },
      { messageId: 'mock-msg-001', threadId: 'mock-thread-001', from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: 'buchhaltung@bavarian-tech.de', subject: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, date: 'Do., 5. Jun 2025 14:22', snippet: `Dritter Versuch, Zahlungsfehler für Rechnung #${REF.invoice} (${REF.amount}) zu lösen.`, bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Sehr geehrtes Support-Team,</p><p>Dringender Rückruf zu Rechnung #${REF.invoice} (${REF.amount}) — dritter Versuch. SEPA-Ref.: ${REF.sepaRef}.</p><p>Bitte als Priorität behandeln. Rechnung und Bankbestätigung beigefügt.</p><p>Mit freundlichen Grüßen,<br/>Anna Müller<br/>Finanzdirektorin, Bavarian Tech GmbH</p></div>`, bodyText: '', attachments: [{ attachmentId: 'mock-att-1', filename: `rechnung_${REF.invoice}.pdf`, mimeType: 'application/pdf', size: 45820 }, { attachmentId: 'mock-att-2', filename: 'bank_bestaetigung_SEPA.pdf', mimeType: 'application/pdf', size: 23440 }] },
    ],
    aiEnrichment: {
      summary: `Kundin meldet wiederholten Zahlungsfehler für Rechnung #${REF.invoice} (${REF.amount}). Dritte Nachfrage in 5 Tagen. SEPA-Überweisung belastet, aber nicht im System. Eskalation an Vorgesetzten.`,
      category: 'Zahlungsproblem', sentiment: 'urgent', confidence: 0.94,
      suggestedReply: `Sehr geehrte Frau Müller, vielen Dank für Ihre Nachricht. Ich habe Ihren Fall (Ref.: INC-20250605-4421) als Priorität an unser Zahlungs-Untersuchungsteam eskaliert. Ein Senior-Spezialist wird Sie direkt innerhalb von 2 Geschäftsstunden kontaktieren. Wir entschuldigen uns aufrichtig für die Unannehmlichkeiten.`,
      source: 'ai',
    },
    customerThreads: [
      { threadId: 'mock-thread-mortgage-de', subject: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9\u00a0% fest', date: '4. Jun 2025', snippet: 'Zinsvergleich und ESIS-Darstellung angefordert.' },
      { threadId: 'mock-thread-login-de', subject: 'Online-Banking — App-Update nach Login-Behebung', date: '26. Mai 2025', snippet: 'App-v3.2-Updateanleitung gesendet. Gelöst.' },
      { threadId: 'mock-thread-stmt-de', subject: 'Kontoauszug April — USD-Transaktionsgebühr', date: '1. Mai 2025', snippet: 'Währungsumrechnungsgebühr als Gold-Tier-Mitglied erlassen.' },
      { threadId: 'mock-thread-sepa-de', subject: `SEPA-Überweisung verzögert – Rechnung #${REF.invoice}`, date: '14. Mär 2025', snippet: 'AML-Prüfung bei Lieferantenzahlung. Gelöst.' },
        { threadId: 'mock-thread-chargeback-de',   statusKey: 'active',            topicKey: 'payment', subject: 'Rückbuchungsantrag — nicht autorisierte Belastung €4.200', date: '5. Jun 2025', snippet: 'Betrug gemeldet. Rückbuchungsverfahren eingeleitet.' },
        { threadId: 'mock-thread-overdraft-de',     statusKey: 'active',            topicKey: 'dispute', subject: 'Überziehungsgebühr — Widerspruch gegen Belastung bei genehmigtem Limit', date: '3. Jun 2025', snippet: 'Widerspruch gegen Überziehungsgebühr bei genehmigtem Disporahmen.' },
        { threadId: 'mock-thread-kyc-de',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Kontoverifizierung — KYC-Dokument ausstehend', date: '28. Mai 2025', snippet: 'Auf Einreichung des erneuerten Lichtbildausweises wartend.' },
        { threadId: 'mock-thread-swift-de',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'SWIFT-Überweisungsverzögerung — Auftragsreferenz ${REF.sepaRef}', date: '20. Mai 2025', snippet: 'Korrespondenzbank-Verzögerung. Gelöst nach 4 Werktagen.' },
    ],
  },

  // taskIds not listed here fall back to the default `email` block above.
  emails: {
    'task-stmt-email-1': {
      activeEmail: {
        messageId: 'mock-msg-stmt-q-de', threadId: 'mock-thread-stmt-de',
        from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: '',
        subject: 'Kontoauszug April — USD-Transaktionsgebühr',
        date: 'Do., 1. Mai 2025 09:30',
        snippet: 'Anfrage zu USD-340-Währungsumrechnungsgebühr (ca. \u20ac312) im April-Auszug.',
        bodyHtml: `<p>Sehr geehrtes Support-Team,</p><p>bei der Prüfung unseres April-Auszugs ist mir eine Währungsumrechnungsgebühr von USD 340 (ca. \u20ac312) für einen Kauf vom 15. April aufgefallen. Können Sie mir bitte erläutern, ob diese Gebühr korrekt ist und welchen Wechselkurs Sie angewendet haben?</p><p>Mit freundlichen Grüßen,<br/>Anna Müller</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-stmt-r-de', threadId: 'mock-thread-stmt-de', from: 'Moneta Bank Support <support@moneta-bank.com>', to: 'a.mueller@bavarian-tech.de', cc: '', subject: 'Re: Kontoauszug April — USD-Transaktionsgebühr', date: 'Do., 1. Mai 2025 14:15', snippet: 'USD-Gebühr zu EZB-Mittelkurs + 1,5\u00a0%. Gold-Tier-Einmalnachlass angewendet — \u20ac312 heute gutgeschrieben.', bodyHtml: '<p>Sehr geehrte Frau Müller,</p><p>die USD-340-Gebühr wurde zum EZB-Mittelkurs von 1,083 plus unserer Standard-Fremdwährungsgebühr von 1,5\u00a0% berechnet (gesamt \u20ac312,40). Als Gold-Tier-Kundin haben Sie Anspruch auf einen einmaligen viertjährlichen Erlass. Ich habe heute eine Gutschrift von \u20ac312,40 auf Ihr Konto vorgenommen.</p><p>Mit freundlichen Grüßen,<br/>Agent Hoffmann<br/>Moneta Bank Support</p>', bodyText: '', attachments: [] },
        { messageId: 'mock-msg-stmt-q-de', threadId: 'mock-thread-stmt-de', from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: '', subject: 'Kontoauszug April — USD-Transaktionsgebühr', date: 'Do., 1. Mai 2025 09:30', snippet: 'Anfrage zu USD-340-Währungsumrechnungsgebühr im April-Auszug.', bodyHtml: `<p>Sehr geehrtes Support-Team,</p><p>Währungsumrechnungsgebühr USD 340 (\u20ac312) für Kauf vom 15. April. Bitte Wechselkurs erläutern.</p><p>Anna Müller</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Kundin fragt nach USD-Währungsumrechnungsgebühr im April-Auszug. EZB-Kurs + 1,5\u00a0% korrekt angewendet. Gold-Tier-Einmalerlassene \u20ac312,40 gutgeschrieben.',
        category: 'Kontoanfrage', sentiment: 'neutral', confidence: 0.82,
        suggestedReply: `Sehr geehrte Frau Müller, die USD-340-Gebühr entspricht unserer Standard-Fremdwährungsgebühr von 1,5\u00a0% (EZB-Kurs 1,083). Als Gold-Tier-Mitglied wurde eine einmalige Gutschrift von \u20ac312,40 ab heute auf Ihr Konto angewendet — sie erscheint auf Ihrem nächsten Kontoauszug.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, date: '5. Jun 2025', snippet: 'Dritte Eskalation wegen SEPA-Zahlungsfehler.' },
        { threadId: 'mock-thread-mortgage-de', subject: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9\u00a0% fest', date: '4. Jun 2025', snippet: 'Zinsvergleich angefordert.' },
        { threadId: 'mock-thread-login-de', subject: 'Online-Banking — App-Update nach Login-Behebung', date: '26. Mai 2025', snippet: 'App-Updateanleitung gesendet.' },
        { threadId: 'mock-thread-sepa-de', subject: `SEPA-Überweisung verzögert – Rechnung #${REF.invoice}`, date: '14. Mär 2025', snippet: 'AML-Prüfung. Gelöst.' },
        { threadId: 'mock-thread-chargeback-de',   statusKey: 'active',            topicKey: 'payment', subject: 'Rückbuchungsantrag — nicht autorisierte Belastung €4.200', date: '5. Jun 2025', snippet: 'Betrug gemeldet. Rückbuchungsverfahren eingeleitet.' },
        { threadId: 'mock-thread-overdraft-de',     statusKey: 'active',            topicKey: 'dispute', subject: 'Überziehungsgebühr — Widerspruch gegen Belastung bei genehmigtem Limit', date: '3. Jun 2025', snippet: 'Widerspruch gegen Überziehungsgebühr bei genehmigtem Disporahmen.' },
        { threadId: 'mock-thread-kyc-de',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Kontoverifizierung — KYC-Dokument ausstehend', date: '28. Mai 2025', snippet: 'Auf Einreichung des erneuerten Lichtbildausweises wartend.' },
        { threadId: 'mock-thread-swift-de',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'SWIFT-Überweisungsverzögerung — Auftragsreferenz ${REF.sepaRef}', date: '20. Mai 2025', snippet: 'Korrespondenzbank-Verzögerung. Gelöst nach 4 Werktagen.' },
      ],
    },
    'task-2024-0784-email-1': {
      activeEmail: {
        messageId: 'mock-msg-login-q-de', threadId: 'mock-thread-login-de',
        from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: '',
        subject: 'Online-Banking — App-Update nach Login-Behebung',
        date: 'Mo., 26. Mai 2025 10:12',
        snippet: '2FA funktioniert jetzt — danke! Fehler beim Update auf neue App-Version (v3.2).',
        bodyHtml: `<p>Hallo,</p><p>vielen Dank für die Behebung des 2FA-Problems. Leider erhalte ich beim Update auf die neue Mobile-App-Version (3.2) eine Fehlermeldung. Könnten Sie mir die Updateanleitung senden?</p><p>Mit freundlichen Grüßen,<br/>Anna Müller</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-login-r-de', threadId: 'mock-thread-login-de', from: 'Moneta Bank Support <support@moneta-bank.com>', to: 'a.mueller@bavarian-tech.de', cc: '', subject: 'Re: Online-Banking — App-Update nach Login-Behebung', date: 'Mo., 26. Mai 2025 11:45', snippet: 'iOS 16+ erforderlich. App Store \u2192 Moneta Bank \u2192 Aktualisieren. Ca. 2 Min. 2FA-Einstellungen bleiben erhalten.', bodyHtml: '<p>Sehr geehrte Frau Müller,</p><p>für das Update (v3.2 benötigt iOS 16+): App Store \u2192 \u201eMoneta Bank\u201c suchen \u2192 \u201eAktualisieren\u201c tippen \u2192 ca. 2 Minuten warten. 2FA-Einstellungen bleiben erhalten. Bei Bedarf bitte Apple-ID eingeben.</p><p>Mit freundlichen Grüßen,<br/>Agent Hoffmann<br/>Digital Support</p>', bodyText: '', attachments: [] },
        { messageId: 'mock-msg-login-q-de', threadId: 'mock-thread-login-de', from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: '', subject: 'Online-Banking — App-Update nach Login-Behebung', date: 'Mo., 26. Mai 2025 10:12', snippet: '2FA behoben. App-v3.2-Update-Fehler besteht. Bitte Anleitung senden.', bodyHtml: `<p>Hallo,</p><p>2FA funktioniert. App-v3.2-Update-Fehler besteht. Bitte Anleitung senden.</p><p>Anna Müller</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Nachverfolgung nach Login/2FA-Behebung. Kundin bittet um App-v3.2-Updateanleitung. iOS 16+ erforderlich. Schritt-für-Schritt-Anleitung von Agent Hoffmann gesendet.',
        category: 'Technischer Support', sentiment: 'positive', confidence: 0.88,
        suggestedReply: `Sehr geehrte Frau Müller, schön, dass 2FA funktioniert! Für das v3.2-Update: App Store \u2192 \u201eMoneta Bank\u201c suchen \u2192 Aktualisieren. iOS 16+ erforderlich, ca. 2 Minuten, 2FA-Einstellungen bleiben erhalten.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, date: '5. Jun 2025', snippet: 'Dritte Eskalation wegen SEPA-Zahlungsfehler.' },
        { threadId: 'mock-thread-mortgage-de', subject: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9\u00a0% fest', date: '4. Jun 2025', snippet: 'Zinsvergleich angefordert.' },
        { threadId: 'mock-thread-stmt-de', subject: 'Kontoauszug April — USD-Transaktionsgebühr', date: '1. Mai 2025', snippet: 'Währungsgebühr erlassen.' },
        { threadId: 'mock-thread-sepa-de', subject: `SEPA-Überweisung verzögert – Rechnung #${REF.invoice}`, date: '14. Mär 2025', snippet: 'AML-Prüfung. Gelöst.' },
        { threadId: 'mock-thread-chargeback-de',   statusKey: 'active',            topicKey: 'payment', subject: 'Rückbuchungsantrag — nicht autorisierte Belastung €4.200', date: '5. Jun 2025', snippet: 'Betrug gemeldet. Rückbuchungsverfahren eingeleitet.' },
        { threadId: 'mock-thread-overdraft-de',     statusKey: 'active',            topicKey: 'dispute', subject: 'Überziehungsgebühr — Widerspruch gegen Belastung bei genehmigtem Limit', date: '3. Jun 2025', snippet: 'Widerspruch gegen Überziehungsgebühr bei genehmigtem Disporahmen.' },
        { threadId: 'mock-thread-kyc-de',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Kontoverifizierung — KYC-Dokument ausstehend', date: '28. Mai 2025', snippet: 'Auf Einreichung des erneuerten Lichtbildausweises wartend.' },
        { threadId: 'mock-thread-swift-de',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'SWIFT-Überweisungsverzögerung — Auftragsreferenz ${REF.sepaRef}', date: '20. Mai 2025', snippet: 'Korrespondenzbank-Verzögerung. Gelöst nach 4 Werktagen.' },
      ],
    },
    'task-2025-0104-email-1': {
      activeEmail: {
        messageId: 'mock-msg-mortgage-q-de', threadId: 'mock-thread-mortgage-de',
        from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'kredit@moneta-bank.com', cc: '',
        subject: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9\u00a0% fest',
        date: 'Mi., 4. Jun 2025 15:35',
        snippet: 'Interesse am Festzinsangebot. Bitte vollständigen Zinsvergleich und Kostendarstellung senden.',
        bodyHtml: `<p>Sehr geehrtes Kreditteam,</p><p>ich habe Ihre Mitteilung zur EZB-Zinssenkung und dem Angebot zur Hypothekenrefinanzierung zu 3,9\u00a0% fest (5 Jahre) erhalten. Unser aktueller Zinssatz beträgt 4,7\u00a0% variabel.</p><p>Ich möchte dies gerne prüfen. Könnten Sie mir bitte senden:</p><ul><li>Vollständiger Zinsvergleich (aktuell vs. vorgeschlagen)</li><li>Gesamtkostendarstellung über die volle Laufzeit</li><li>Vorfälligkeitsentschädigungen oder Umschuldungsgebühren</li></ul><p>Mit freundlichen Grüßen,<br/>Anna Müller<br/>Finanzdirektorin, Bavarian Tech GmbH</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-mortgage-q-de', threadId: 'mock-thread-mortgage-de', from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'kredit@moneta-bank.com', cc: '', subject: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9\u00a0% fest', date: 'Mi., 4. Jun 2025 15:35', snippet: 'Vollständigen Zinsvergleich und ESIS-Darstellung angefordert.', bodyHtml: `<p>Sehr geehrtes Kreditteam,</p><p>Interesse am 3,9\u00a0%-Festzinsangebot. Bitte vollständigen Vergleich und Kostendarstellung senden.</p><p>Anna Müller</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Kundin reagiert positiv auf EZB-Zinssenkungsangebot. Bittet um vollständigen Zinsvergleich und ESIS-Darstellung. Gold-Tier — hochwertige Opportunity.',
        category: 'Hypothek / Kredit', sentiment: 'positive', confidence: 0.91,
        suggestedReply: `Sehr geehrte Frau Müller, vielen Dank für Ihr Interesse an unserem Gold-Tier-Refinanzierungsangebot. Ich erstelle einen personalisierten Zinsvergleich (4,7\u00a0% variabel vs. 3,9\u00a0% fest, 5 Jahre) samt ESIS-Darstellung. Unser Kreditberater wird Sie morgen früh anrufen.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, date: '5. Jun 2025', snippet: 'Dritte Eskalation wegen SEPA-Zahlungsfehler.' },
        { threadId: 'mock-thread-login-de', subject: 'Online-Banking — App-Update nach Login-Behebung', date: '26. Mai 2025', snippet: 'App-Updateanleitung gesendet.' },
        { threadId: 'mock-thread-stmt-de', subject: 'Kontoauszug April — USD-Transaktionsgebühr', date: '1. Mai 2025', snippet: 'Währungsgebühr als Gold-Tier erlassen.' },
        { threadId: 'mock-thread-sepa-de', subject: `SEPA-Überweisung verzögert – Rechnung #${REF.invoice}`, date: '14. Mär 2025', snippet: 'AML-Prüfung. Gelöst.' },
        { threadId: 'mock-thread-chargeback-de',   statusKey: 'active',            topicKey: 'payment', subject: 'Rückbuchungsantrag — nicht autorisierte Belastung €4.200', date: '5. Jun 2025', snippet: 'Betrug gemeldet. Rückbuchungsverfahren eingeleitet.' },
        { threadId: 'mock-thread-overdraft-de',     statusKey: 'active',            topicKey: 'dispute', subject: 'Überziehungsgebühr — Widerspruch gegen Belastung bei genehmigtem Limit', date: '3. Jun 2025', snippet: 'Widerspruch gegen Überziehungsgebühr bei genehmigtem Disporahmen.' },
        { threadId: 'mock-thread-kyc-de',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Kontoverifizierung — KYC-Dokument ausstehend', date: '28. Mai 2025', snippet: 'Auf Einreichung des erneuerten Lichtbildausweises wartend.' },
        { threadId: 'mock-thread-swift-de',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'SWIFT-Überweisungsverzögerung — Auftragsreferenz ${REF.sepaRef}', date: '20. Mai 2025', snippet: 'Korrespondenzbank-Verzögerung. Gelöst nach 4 Werktagen.' },
      ],
    },
    'task-2024-0312-email-1': {
      activeEmail: {
        messageId: 'mock-msg-sepa-delay-de', threadId: 'mock-thread-sepa-de',
        from: `Anna Müller <a.mueller@bavarian-tech.de>`,
        to: 'support@moneta-bank.com', cc: '',
        subject: `SEPA-Überweisung verzögert – Rechnung #${REF.invoice}`,
        date: 'Mo., 2. Jun 2025 09:14',
        snippet: `SEPA-Überweisung Ref. ${REF.sepaRef} wurde vor 3 Tagen initiiert, aber der Empfänger hat das Geld noch nicht erhalten.`,
        bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Sehr geehrtes Support-Team,</p><p>ich schreibe bezüglich einer verzögerten SEPA-Überweisung, die am <strong>30. Mai 2025</strong> initiiert wurde.</p><p><strong>Überweisungsdetails:</strong></p><ul><li>SEPA-Referenz: ${REF.sepaRef}</li><li>Betrag: ${REF.amount}</li><li>Empfänger: Lieferantenservices GmbH</li><li>Rechnungsnummer: #${REF.invoice}</li></ul><p>Der Betrag wurde von meinem Konto abgebucht, aber der Empfänger hat die Gelder noch nicht erhalten. Die Zahlungsfrist war gestern. Können Sie bitte den Status prüfen?</p><p>Mit freundlichen Grüßen,<br/>Anna Müller</p></div>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-sepa-delay-de', threadId: 'mock-thread-sepa-de', from: `Anna Müller <a.mueller@bavarian-tech.de>`, to: 'support@moneta-bank.com', cc: '', subject: `SEPA-Überweisung verzögert – Rechnung #${REF.invoice}`, date: 'Mo., 2. Jun 2025 09:14', snippet: `SEPA-Überweisung Ref. ${REF.sepaRef} noch nicht beim Empfänger eingetroffen.`, bodyHtml: `<p>Details wie oben.</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: `Kundin meldet, dass SEPA-Überweisung Ref. ${REF.sepaRef} (${REF.amount}) für Rechnung #${REF.invoice} den Empfänger nach 3 Tagen nicht erreicht hat. Erstanfrage für diese Transaktion.`,
        category: 'Zahlungsverzögerung', sentiment: 'neutral', confidence: 0.88,
        suggestedReply: `Sehr geehrte Frau Müller, wir haben Ihre Anfrage bezüglich SEPA-Überweisung Ref. ${REF.sepaRef} erhalten. Wir prüfen den Status sofort und werden Sie innerhalb von 4 Stunden mit einem Update kontaktieren. Wir entschuldigen uns für die entstandenen Unannehmlichkeiten.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`, date: '5. Jun 2025', snippet: 'Dritte Eskalation wegen SEPA-Zahlungsfehler.' },
        { threadId: 'mock-thread-mortgage-de', subject: 'Gold-Tier-Angebot — Hypothekenrefinanzierung 3,9 % fest', date: '4. Jun 2025', snippet: 'Zinsvergleich und ESIS-Darstellung angefordert.' },
        { threadId: 'mock-thread-login-de', subject: 'Online-Banking — App-Update nach Login-Behebung', date: '26. Mai 2025', snippet: 'App-Updateanleitung gesendet.' },
        { threadId: 'mock-thread-stmt-de', subject: 'Kontoauszug April — USD-Transaktionsgebühr', date: '1. Mai 2025', snippet: 'Währungsgebühr erlassen.' },
        { threadId: 'mock-thread-chargeback-de',   statusKey: 'active',            topicKey: 'payment', subject: 'Rückbuchungsantrag — nicht autorisierte Belastung €4.200', date: '5. Jun 2025', snippet: 'Betrug gemeldet. Rückbuchungsverfahren eingeleitet.' },
        { threadId: 'mock-thread-overdraft-de',     statusKey: 'active',            topicKey: 'dispute', subject: 'Überziehungsgebühr — Widerspruch gegen Belastung bei genehmigtem Limit', date: '3. Jun 2025', snippet: 'Widerspruch gegen Überziehungsgebühr bei genehmigtem Disporahmen.' },
        { threadId: 'mock-thread-kyc-de',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Kontoverifizierung — KYC-Dokument ausstehend', date: '28. Mai 2025', snippet: 'Auf Einreichung des erneuerten Lichtbildausweises wartend.' },
        { threadId: 'mock-thread-swift-de',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'SWIFT-Überweisungsverzögerung — Auftragsreferenz ${REF.sepaRef}', date: '20. Mai 2025', snippet: 'Korrespondenzbank-Verzögerung. Gelöst nach 4 Werktagen.' },
      ],
    },
  },

  analytics: {
    cases: {
      byStatus:   [ { label: 'Offen', value: 14, color: '#f5a623' }, { label: 'In Bearbeitung', value: 9, color: '#00a0d1' }, { label: 'Gelöst', value: 22, color: '#4ade80' }, { label: 'Geschlossen', value: 31, color: '#9ca3af' } ],
      byPriority: [ { label: 'Kritisch', value: 3, color: '#e8453c' }, { label: 'Hoch', value: 11, color: '#f5a623' }, { label: 'Mittel', value: 18, color: '#00a0d1' }, { label: 'Niedrig', value: 44, color: '#9ca3af' } ],
      byCategory: [ { label: 'Zahlung', value: 19, color: '#a78bfa' }, { label: 'Konto', value: 14, color: '#60a5fa' }, { label: 'Technisch', value: 12, color: '#34d399' }, { label: 'Allgemein', value: 31, color: '#f472b6' } ],
      trend: TREND.casesNew, resolutionTrend: TREND.casesResolution,
      slaBreached: 4, slaMet: 72, avgResolutionH: 19, fcr: 68, csat: 4.2, total: 76, openCount: 23,
    },
    history: {
      byChannel: [ { key: 'voice', label: 'Telefon', value: 26, color: '#4ade80' }, { key: 'email', label: 'E-Mail', value: 25, color: '#a78bfa' }, { key: 'chat', label: 'Chat', value: 24, color: '#60a5fa' }, { key: 'whatsapp', label: 'WhatsApp', value: 15, color: '#25d366' }, { key: 'sms', label: 'SMS', value: 8, color: '#f472b6' } ],
      byOutcome: [ { key: 'resolved', label: 'Gelöst', value: 58, color: '#4ade80' }, { key: 'escalated', label: 'Eskaliert', value: 14, color: '#f5a623' }, { key: 'pending', label: 'Ausstehend', value: 11, color: '#60a5fa' }, { key: 'abandoned', label: 'Abgebrochen', value: 7, color: '#e8453c' }, { key: 'transferred', label: 'Weitergeleitet', value: 8, color: '#9ca3af' } ],
      sentiment: [ { key: 'positive', label: 'Positiv', value: 57, color: '#4ade80' }, { key: 'neutral', label: 'Neutral', value: 24, color: '#9ca3af' }, { key: 'negative', label: 'Negativ', value: 17, color: '#e8453c' } ],
      volumeTrend: TREND.histVolume, ahtTrend: TREND.histAht,
      weekdayVolume: [21, 19, 23, 18, 22, 9, 5],
      totalInteractions: 98, avgHandleTimeMin: 6.7, repeatContactRate: 22, escalationRate: 14, resolutionRate: 76,
    },
    voice: {
      callOutcomes: [ { key: 'resolved', label: 'Gelöst', value: 14, color: '#00c389' }, { key: 'transferred', label: 'Weitergeleitet', value: 4, color: '#f5a623' }, { key: 'callback', label: 'Rückruf', value: 3, color: '#7c3aed' }, { key: 'abandoned', label: 'Abgebrochen', value: 2, color: '#e0463e' } ],
      sentiment:    [ { key: 'positive', label: 'Positiv', value: 9, color: '#00c389' }, { key: 'neutral', label: 'Neutral', value: 7, color: '#f5a623' }, { key: 'negative', label: 'Negativ', value: 7, color: '#e0463e' } ],
      callTypes:    [ { key: 'inbound', label: 'Eingehend', value: 16, color: '#00a0d1' }, { key: 'outbound', label: 'Ausgehend', value: 4, color: '#a78bfa' }, { key: 'callback', label: 'Rückruf', value: 3, color: '#f5a623' } ],
      volumeTrend: TREND.voiceVolume, ahtTrend: TREND.voiceAht,
      openCases: [ { id: REF.case1, status: 'Offen', topic: 'SEPA-Überweisungsstreit', priority: 'Hoch', color: '#f5a623' }, { id: REF.case2, status: 'Geschlossen', topic: 'Login-Zugang', priority: 'Niedrig', color: '#00a0d1' } ],
      avgHandleTimeSec: 288, slaMet: 87, csat: 4.2, totalCalls30d: 23,
    },
    chat: {
      customer: 'Anna Müller',
      channelMix: [ { key: 'webchat',  label: 'Webchat',    value: 18, color: '#00a0d1' }, { key: 'whatsapp', label: 'WhatsApp',  value: 12, color: '#25D366' }, { key: 'sms',      label: 'SMS',       value: 7,  color: '#f5a623' }, { key: 'apple',    label: 'Apple Msgs', value: 5,  color: '#007AFF' }, { key: 'in-app',   label: 'In-App',    value: 4,  color: '#a78bfa' }, { key: 'rcs',      label: 'RCS',       value: 2,  color: '#34d399' } ],
      sessionStatus: [ { key: 'active',      label: 'Aktiv', value: 1, color: '#00a0d1' }, { key: 'resolved',    label: 'Gelöst', value: 42, color: '#4ade80' }, { key: 'transferred', label: 'Weitergeleitet', value: 2, color: '#f5a623' }, { key: 'abandoned',   label: 'Abgebrochen', value: 3, color: '#e8453c' } ],
      sentiment: [ { label: 'Positiv', value: 19, color: '#4ade80' }, { label: 'Neutral', value: 16, color: '#9ca3af' }, { label: 'Negativ', value: 13, color: '#e8453c' } ],
      volumeTrend: TREND.chatVolume, ahtTrend: TREND.chatAht,
      openCases: [ { id: REF.case1, status: 'In Bearbeitung', topic: 'Zahlungsabwicklung', priority: 'Hoch', color: '#f5a623' }, { id: REF.case2, status: 'Offen', topic: 'Login-Zugang', priority: 'Mittel', color: '#00a0d1' }, { id: REF.case3, status: 'In Bearbeitung', topic: 'Überziehungsstreit', priority: 'Hoch', color: '#f5a623' } ],
      totalConversations: 48, avgFirstResponseSec: 18, slaMet: 91, csat: 4.4, conversationsThisMonth: 48,
    },
    email: {
      threadStatus: [ { key: 'active',            label: 'Aktiv', value: 2, color: '#00a0d1' }, { key: 'awaiting-customer', label: 'Wartet auf Kunden', value: 1, color: '#f5a623' }, { key: 'resolved', label: 'Gelöst', value: 8, color: '#4ade80' } ],
      topicMix: [ { key: 'payment', label: 'Zahlungsproblem', value: 5, color: '#a78bfa' }, { key: 'account', label: 'Kontozugang', value: 3, color: '#60a5fa' }, { key: 'dispute', label: 'Streit', value: 2, color: '#f472b6' }, { key: 'general', label: 'Allgemein', value: 1, color: '#9ca3af' } ],
      sentiment: [ { label: 'Positiv', value: 3, color: '#4ade80' }, { label: 'Neutral', value: 5, color: '#9ca3af' }, { label: 'Negativ', value: 3, color: '#e8453c' } ],
      volumeTrend: TREND.emailVolume, replyTimeTrend: TREND.emailReplyTime,
      openCases: [ { id: REF.case1, status: 'In Bearbeitung', topic: 'Zahlungsabwicklung', priority: 'Hoch', color: '#f5a623' }, { id: REF.case2, status: 'Offen', topic: 'Login-Zugang', priority: 'Mittel', color: '#00a0d1' }, { id: REF.case3, status: 'In Bearbeitung', topic: 'Überziehungsstreit', priority: 'Hoch', color: '#f5a623' } ],
      avgFirstReplyH: 4.1, slaMet: 87, csat: 4.2, emailsThisMonth: 11, totalThreads: 11,
    },
  },

  // ── Email composer: templates, signatures, knowledge base ─────────────────
  emailComposer: {
    defaultSignatureId: 'sig-de-default',
    signatures: [
      {
        id: 'sig-de-default',
        name: 'Standard DE',
        html: '<p style="font-size:12px;color:#545454">Mit freundlichen Gr&uuml;&szlig;en,<br><strong>{{agentName}}</strong><br>Kundendienst | Moneta Bank<br>+49 89 1234 5678</p>',
      },
      {
        id: 'sig-de-brief',
        name: 'Kurz DE',
        html: '<p style="font-size:12px;color:#545454">MfG, {{agentName}} &mdash; Moneta Bank Support</p>',
      },
    ],
    templates: [
      {
        id: 'tpl-de-greeting',
        name: 'Begr&uuml;&szlig;ung',
        locale: 'de',
        category: 'greeting',
        variables: ['customerName', 'agentName'],
        body: '<p>Sehr geehrte(r) {{customerName}},</p><p>vielen Dank f&uuml;r Ihre Kontaktaufnahme mit der Moneta Bank. Mein Name ist {{agentName}} und ich stehe Ihnen heute gerne zur Verf&uuml;gung.</p><p>Ich habe Ihre Anfrage gepr&uuml;ft und werde Ihnen in K&uuml;rze eine vollst&auml;ndige Antwort zukommen lassen.</p>',
      },
      {
        id: 'tpl-de-apology',
        name: 'Entschuldigung',
        locale: 'de',
        category: 'apology',
        variables: ['customerName'],
        body: '<p>Sehr geehrte(r) {{customerName}},</p><p>wir m&ouml;chten uns aufrichtig f&uuml;r die entstandenen Unannehmlichkeiten entschuldigen. Wir verstehen vollkommen, wie frustrierend diese Situation sein muss.</p><p>Wir versichern Ihnen, dass diese Angelegenheit mit h&ouml;chster Priorit&auml;t behandelt wird.</p>',
      },
      {
        id: 'tpl-de-resolution',
        name: 'Abschluss',
        locale: 'de',
        category: 'resolution',
        variables: ['customerName'],
        body: '<p>Sehr geehrte(r) {{customerName}},</p><p>wir freuen uns, Ihnen mitteilen zu k&ouml;nnen, dass Ihre Anfrage vollst&auml;ndig bearbeitet wurde.</p><p>Sollten Sie weitere Fragen haben, stehen wir Ihnen jederzeit gerne zur Verf&uuml;gung.</p>',
      },
    ],
    knowledgeBase: [
      {
        id: 'kb-de-zahlung',
        title: 'Zahlungsverarbeitungszeiten',
        tags: ['zahlung', 'transfer', 'SEPA', 'verz&ouml;gerung'],
        content: 'Standardzahlungen werden innerhalb von 1-3 Werktagen verarbeitet. SEPA-&Uuml;berweisungen werden am selben Tag verarbeitet, wenn sie vor 14:00 Uhr MEZ eingereicht werden. Internationale &Uuml;berweisungen k&ouml;nnen 3-5 Werktage dauern.',
      },
      {
        id: 'kb-de-sicherheit',
        title: 'Kontosicherheit',
        tags: ['sicherheit', 'login', 'passwort', 'sperrung'],
        content: 'F&uuml;r &Auml;nderungen am Konto ist eine Identit&auml;tspr&uuml;fung erforderlich. Ben&ouml;tigt werden: registrierte E-Mail, letzte 4 Ziffern der Telefonnummer, Geburtsdatum.',
      },
    ],
  },

  // ── TaskWidget ─────────────────────────────────────────────────────────────────────
  task: {
    elapsedSec: 183,
    slaSec: 900,
    activeTask: {
      mediaType: 'workItem',
      mediaChannel: 'AMLReview_DE',
      interactionId: '72a9741f-demo-0002-0000-000000000000',
      state: 'connected',
      isWrapUp: false,
      isHold: false,
      timeStamp: Date.now() - 183000,
      virtualTeamName: 'AML_Review_Queue',
      ani: '+49 89 20 85 55 55',
      callAssociatedData: {
        caseId:       { value: 'INC0007' },
        taskId:       { value: 'fd440207-demo-0002-0000-000000000000' },
        taskType:     { value: 'aml' },
        customerName: { value: 'Anna Müller' },
        email:        { value: 'a.mueller@bavarian-tech.de' },
        ani:          { value: '+49 89 20 85 55 55' },
        virtualTeamName: { value: 'AML_Review_Queue' },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CZECH
// ═══════════════════════════════════════════════════════════════════════════
const CS = {
  customer: {
    name: 'Jana Nováková',
    email: 'j.novakova@praha-systems.cz',
    phone: '+420 222 333 444',
    company: 'Praha Systems s.r.o.',
    city: 'Praha',
    country: 'CZ',
  },
  agents: {
    primary:   'Agent Novák',
    secondary: 'Agent Dvořák',
    tertiary:  'Agent Šimánek',
    fourth:    'Agent Procházka',
    fifth:     'Agent Kovář',
  },

  cases: [
    {
      id: REF.case1, caseId: REF.case1, status: 'in progress', priority: 'high', category: 'payment',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-06-03T12:00:00Z', owner: 'Agent Novák', _isActive: true,
      description: `Zákaznice hlásí opakované selhání platby pro fakturu #${REF.invoice} (${REF.amount}). Třetí dotaz za 5 dní. SEPA převod ref.: ${REF.sepaRef} odepsán z účtu zákaznice, ale v systému nezaúčtován. Eskalace na vedoucího.`,
    },
    {
      id: REF.case2, caseId: REF.case2, status: 'open', priority: 'medium', category: 'technical',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-05-28T09:30:00Z', owner: 'Agent Dvořák',
      description: 'Selhání přihlášení do internetového bankovnictví po resetu hesla. Zákaznice se nemohla přihlásit 2 dny. Dvoufaktorová autentizace nedoručovala SMS kódy.',
    },
    {
      id: REF.case3, caseId: REF.case3, status: 'in progress', priority: 'medium', category: 'account',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-05-10T14:15:00Z', owner: 'Agent Kovář',
      description: 'Zákaznice rozporuje poplatek za kontokorent €45 účtovaný 8. května. Zpoždění platebního procesoru způsobilo dočasný nesoulad zůstatku. Přezkoumání back-office probíhá.',
    },
    {
      id: REF.case4, caseId: REF.case4, status: 'closed', priority: 'low', category: 'fraud',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-04-02T10:00:00Z', owner: 'Agent Šimánek',
      description: 'Karta zablokována při zahraniční cestě do USA. Identita ověřena prostřednictvím video hovoru. Karta reaktivována do 20 minut. Zákaznice spokojená.',
    },
    {
      id: REF.case5, caseId: REF.case5, status: 'closed', priority: 'low', category: 'payment',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-03-15T08:45:00Z', owner: 'Agent Procházka',
      description: 'SEPA převod dodavateli zpožděn o 3 pracovní dny kvůli spuštění prahu AML kontroly. Prostředky připsány. Zákaznice informována s omluvným dopisem.',
    },
  ],

  voice: {
    calls: [
      { id: 'call-1', taskId: 'task-2024-0892-voice-2', active: true,  customer: 'Jana Nováková', phone: '+420 222 333 444', started: '09:41',     durationSec: 847, direction: 'inbound',  queue: 'Priority Banking',          caseId: REF.case1, sentiment: 'negative', outcome: null, outcomeKey: null },
      { id: 'call-2', taskId: 'task-2024-0784-voice-1', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-05-29', durationSec: 312, direction: 'outbound', queue: 'Zpětné volání',             caseId: REF.case2, sentiment: 'positive', outcome: 'Vyřešeno', outcomeKey: 'resolved' },
      { id: 'call-3', taskId: 'task-2024-0651-voice-1', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-04-14', durationSec: 489, direction: 'inbound',  queue: 'Obecné bankovnictví',       caseId: REF.case3, sentiment: 'neutral',  outcome: 'Přesměrováno', outcomeKey: 'transferred' },
      { id: 'call-4', taskId: 'task-2024-0445-voice-1', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-03-01', durationSec: 228, direction: 'inbound',  queue: 'Obecné bankovnictví',       caseId: REF.case4, sentiment: 'positive', outcome: 'Vyřešeno',      outcomeKey: 'resolved'   },
      { id: 'call-5', taskId: 'task-2025-0063-voice-1', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-05-12', durationSec: 195, direction: 'callback', queue: 'Zpětné volání',            caseId: null,       sentiment: 'positive', outcome: 'Zpětné volání', outcomeKey: 'callback'   },
      { id: 'call-6', taskId: 'task-2025-0071-voice-1', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-05-20', durationSec: 43,  direction: 'inbound',  queue: 'Obecné bankovnictví',       caseId: null,       sentiment: 'neutral',  outcome: 'Zavěšeno',     outcomeKey: 'abandoned'  },
      { id: 'call-7', taskId: 'task-2025-0088-voice-1', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-06-01', durationSec: 380, direction: 'outbound', queue: 'Zpětné volání',            caseId: null,       sentiment: 'positive', outcome: 'Vyřešeno',      outcomeKey: 'resolved'   },
    ],
    transcript: [
      { id: 't0', role: 'system', text: 'Příchozí hovor spojen · Jana Nováková · Priority Banking · 09:41' },
      { id: 't1', role: 'customer', speaker: 'Jana Nováková', text: `Dobré ráno. Jsem Jana Nováková, číslo účtu ${REF.account}. V úterý jsem zadala SEPA převod — reference ${REF.sepaRef} — a prostředky stále nedorazily. Jedná se o obchodní platbu a faktura mého dodavatele byla splatná včera.`, time: '00:12' },
      { id: 't2', role: 'agent', speaker: 'Agent Novák', text: `Dobré ráno, paní Nováková. Vidím váš účet. Okamžitě vyhledám převod — ${REF.sepaRef}. Chvilku strpení.`, time: '00:42' },
      { id: 't3', role: 'customer', speaker: 'Jana Nováková', text: `Částka faktury je ${REF.amount}. Je to faktura ${REF.invoice}. Můj dodavatel je ${REF.supplier} v Mnichově.`, time: '01:05' },
      { id: 't4', role: 'agent', speaker: 'Agent Novák', text: 'Děkuji. Vidím, že platba je aktuálně pozastavena kvůli kontrole souladu — náš systém ochrany před podvody označil transakci z důvodu výše částky. Nyní to eskaluji na platební tým. To by mělo být vyřešeno během dvou hodin.', time: '01:28' },
      { id: 't5', role: 'customer', speaker: 'Jana Nováková', text: 'Dvě hodiny? To je naprosto nepřijatelné. Můj dodavatel říká, že zablokuje náš účet, pokud dnes platbu nedostane.', time: '01:58' },
      { id: 't6', role: 'agent', speaker: 'Agent Novák', text: 'Paní Nováková, plně chápu vaše rozčarování. Označím toto jako urgentní a osobně zajistím, aby to platební eskalační tým upřednostnil. Dostanete SMS potvrzení, jakmile bude pozastavení uvolněno.', time: '02:18' },
      { id: 't7', role: 'system', text: '⟳ Živý přepis probíhá…', live: true },
    ],
    aiSummary: {
      headline: 'SEPA převod zablokován — nutné urgentní řešení',
      points: [
        `Zákaznice: Jana Nováková · Účet ${REF.account} · Priority Banking úroveň`,
        `Převod ${REF.sepaRef} ve výši ${REF.amount} na ${REF.supplier} označen systémem ochrany před podvody`,
        `Faktura ${REF.invoice} po splatnosti; dodavatel hrozí zablokováním účtu`,
        'Agent eskaloval na platební tým — ETA 2 hodiny; SMS potvrzení přislíbeno',
        'Celková nálada: Negativní → zlepšení po příslibu eskalace',
      ],
      sentiment: 'negative',
      intent: 'Platební spor — zpoždění SEPA převodu',
      suggestedActions: [
        { id: 'a1', label: 'Vytvořit případ', type: 'action', description: 'Otevřít nový prioritní případ pro tento převodní spor' },
        { id: 'a2', label: 'Odeslat SMS aktualizaci', type: 'action', description: 'Odeslat SMS zákaznici potvrzující eskalaci a ETA 2h' },
        { id: 'a3', label: 'Přepojit na platby', type: 'transfer', description: 'Teplé přepojení na tým eskalace plateb' },
      ],
    },
    openCases: [
      { id: REF.case1, title: `Spor o SEPA převod — ${REF.amount}`, status: 'Otevřený',    priority: 'Vysoká'  },
      { id: REF.case2, title: 'Selhání přihlášení po resetu hesla',   status: 'Uzavřený',   priority: 'Nízká'   },
      { id: REF.case3, title: 'Spor o poplatek za kontokorent — €45', status: 'Uzavřený',   priority: 'Nízká'   },
    ],
  },

  chat: {
    conversations: [
      { id: 'conv-1', taskId: 'task-2024-0892-wa-1',    channel: 'whatsapp', active: true,  statusKey: 'active',   customer: 'Jana Nováková', snippet: 'SEPA převod stále nezaúčtován…',       time: '14 min', status: 'Aktivní',    caseId: REF.case1 },
      { id: 'conv-2', taskId: 'task-2024-0784-chat-1',  channel: 'webchat',  active: false, statusKey: 'resolved', customer: 'Jana Nováková', snippet: 'Selhání přihlášení po resetu hesla…',  time: '8d',     status: 'Vyřešeno',   caseId: REF.case2 },
      { id: 'conv-3', taskId: 'task-2024-0651-sms-1',   channel: 'sms',      active: false, statusKey: 'resolved', customer: 'Jana Nováková', snippet: 'Dotaz na poplatek — €45…',              time: '26d',    status: 'Vyřešeno',   caseId: REF.case3 },
      { id: 'conv-4', taskId: 'task-2024-0445-inapp-1',   channel: 'in-app',   active: false, statusKey: 'resolved',    customer: 'Jana Nováková', snippet: 'Karta zablokována v New Yorku',                                time: '63d',    status: 'Vyřešeno',       caseId: REF.case4         },
      { id: 'conv-5', taskId: 'task-2025-0115-apple-1',    channel: 'apple',    active: false, statusKey: 'resolved',    customer: 'Jana Nováková', snippet: 'Upozornění na podvod — neznámá platba kartou',                 time: '2d',     status: 'Vyřešeno',       caseId: 'CASE-2025-0115'  },
      { id: 'conv-6', taskId: 'task-rcs-travel-1',         channel: 'rcs',      active: false, statusKey: 'resolved',    customer: 'Jana Nováková', snippet: 'Cestovní oznámení potvrzeno — podvodné alarmy deaktivovány', time: '71d',    status: 'Vyřešeno',       caseId: null              },
      { id: 'conv-7', taskId: 'task-2025-0097-wa-2',       channel: 'whatsapp', active: false, statusKey: 'transferred', customer: 'Jana Nováková', snippet: 'Přístup omezen — přesměrováno na tým pro podvody',           time: '3d',     status: 'Přesměrováno',   caseId: 'CASE-2025-0097'  },
      { id: 'conv-8', taskId: 'task-2025-0076-webchat-1',  channel: 'webchat',  active: false, statusKey: 'abandoned',   customer: 'Jana Nováková', snippet: 'Dotaz na zpoždění platby SWIFT — relace přerušena',         time: '4d',     status: 'Opuštěno',       caseId: 'CASE-2025-0076'  },
    ],
    messages: [
      { id: 'm0', role: 'system',   text: 'Jana Nováková připojena přes WhatsApp · před 14 min' },
      { id: 'm1', role: 'customer', text: `Stále jsem nedostala žádnou aktualizaci o svém SEPA převodu. Moje reference je ${REF.sepaRef}. Je to opravdu urgentní — termín splatnosti faktury byl včera.`, time: 'před 14 min' },
      { id: 'm2', role: 'customer', text: `Faktura #${REF.invoice} za ${REF.amount}. Můj dodavatel nyní hrozí zablokováním našeho účtu.`, time: 'před 13 min' },
      { id: 'm3', role: 'agent',    text: 'Dobrý den, paní Nováková! Vidím váš účet a platební detaily přímo zde. Ihned to prověřím — prosím, dejte mi jen chvilku.', time: 'před 12 min' },
      { id: 'm4', role: 'agent',    text: `Vidím, že toto je propojeno s ${REF.case1}, který již byl eskalován na náš platební tým. SEPA převod byl přijat, ale čeká na rutinní kontrolu souladu.`, time: 'před 11 min' },
      { id: 'm5', role: 'customer', text: 'Kontrola souladu? Toto je pravidelná měsíční platba dodavateli — dělám tento převod již dva roky!', time: 'před 9 min' },
      { id: 'm6', role: 'agent',    text: 'Zcela chápu, paní Nováková. Tato automatická kontrola se spouští u převodů nad €10 000. S ohledem na vaši historii u nás nyní eskaluji na našeho senior platebního specialistu. Řešení byste měla mít do 2 hodin.', time: 'před 7 min' },
    ],
    aiSuggestions: [
      { label: 'Eskalovat a potvrdit', text: `Právě jsem eskaloval ${REF.case1} na prioritu 1. Náš senior platební specialista vás přímo kontaktuje do 2 hodin s potvrzením uvolnění ${REF.sepaRef}.` },
      { label: 'Řešení připraveno',    text: `Dobrá zpráva — ${REF.sepaRef} prošel kontrolou souladu. Prostředky budou připsány vašemu dodavateli do 1–2 pracovních hodin.` },
      { label: 'Předejít budoucímu zpoždění', text: `Přidal jsem poznámku k ${REF.case1} potvrzující, že se jedná o opakující se platbu dodavateli, a požádal o výjimku pro budoucí převody tohoto typu.` },
    ],
    openCases: [
      { id: REF.case1, topic: 'Zpracování plateb', status: 'Probíhá',  priority: 'Vysoká',  color: '#f5a623' },
      { id: REF.case2, topic: 'Přístup k přihlášení', status: 'Otevřený', priority: 'Střední', color: '#00a0d1' },
      { id: REF.case3, topic: 'Spor o kontokorent', status: 'Probíhá', priority: 'Vysoká',  color: '#f5a623' },
    ],
    messagesByConvId: {
      'conv-1': [
        { id: 'm0', role: 'system',   text: 'Jana Nováková připojena přes WhatsApp · před 14 min' },
        { id: 'm1', role: 'customer', text: `Stále jsem nedostala žádnou aktualizaci o svém SEPA převodu. Moje reference je ${REF.sepaRef}. Je to opravdu urgentní — termín splatnosti faktury byl včera.`, time: 'před 14 min' },
        { id: 'm2', role: 'customer', text: `Faktura #${REF.invoice} za ${REF.amount}. Můj dodavatel nyní hrozí zablokováním našeho účtu.`, time: 'před 13 min' },
        { id: 'm3', role: 'agent',    text: 'Dobrý den, paní Nováková! Vidím váš účet a platební detaily přímo zde. Ihned to prověřím — prosím, dejte mi jen chvilku.', time: 'před 12 min' },
        { id: 'm4', role: 'agent',    text: `Vidím, že toto je propojeno s ${REF.case1}, který již byl eskalován na náš platební tým. SEPA převod byl přijat, ale čeká na rutinní kontrolu souladu.`, time: 'před 11 min' },
        { id: 'm5', role: 'customer', text: 'Kontrola souladu? Toto je pravidelná měsíční platba dodavateli — dělám tento převod již dva roky!', time: 'před 9 min' },
        { id: 'm6', role: 'agent',    text: 'Zcela chápu, paní Nováková. Tato automatická kontrola se spouští u převodů nad €10 000. S ohledem na vaši historii u nás nyní eskaluji na našeho senior platebního specialistu. Řešení byste měla mít do 2 hodin.', time: 'před 7 min' },
      ],
      'conv-2': [
        { id: 'c2-m0', role: 'system',   text: 'Jana Nováková připojena přes Webchat · před 8 dny' },
        { id: 'c2-m1', role: 'customer', text: 'Dobrý den, resetovala jsem si heslo, ale teď se nemůžu přihlásit. Žádá mě o kód 2FA, ale žádnou SMS nedostávám.', time: 'před 8 d.' },
        { id: 'c2-m2', role: 'agent',    text: 'Dobrý den, paní Nováková! Reset hesla proběhl úspěšně. Podívám se na problém s 2FA. Můžete potvrdit telefonní číslo na vašem účtu?', time: 'před 8 d.' },
        { id: 'c2-m3', role: 'customer', text: '+420 777 123 456. Zkoušela jsem to třikrát za poslední hodinu.', time: 'před 8 d.' },
        { id: 'c2-m4', role: 'agent',    text: 'Vidím problém s routingem u našeho poskytovatele SMS. Dočasně přepnu vaši 2FA na e-mail. Kód dostanete na jana.novakova@bavarian-tech.cz do 2 minut.', time: 'před 8 d.' },
        { id: 'c2-m5', role: 'customer', text: 'Dostala jsem! Fungovalo to. Jsem přihlášená. Děkuji!', time: 'před 8 d.' },
      ],
      'conv-3': [
        { id: 'c3-m0', role: 'system',   text: 'Odchozí SMS doručena na +420 222 333 444 · před 26 dny' },
        { id: 'c3-m1', role: 'agent',    text: `Dobrý den, paní Nováková, zde Moneta Bank. Váš spor o poplatek za kontokorent (případ ${REF.case3}) byl posouzen a schválen. Na váš účet byl dnes připsán refund €45.`, time: 'před 26 d.' },
        { id: 'c3-m2', role: 'customer', text: 'Děkuji, to jsou skvělé zprávy!', time: 'před 26 d.' },
      ],
      'conv-4': [
        { id: 'c4-m0', role: 'system',   text: 'Jana Nováková připojena přes In-App chat · před 63 dny' },
        { id: 'c4-m1', role: 'customer', text: 'Dobrý den, potřebuji dočasně zvýšit limit karty na €20 000 pro nadcházející velkou zakázku.', time: 'před 63 d.' },
        { id: 'c4-m2', role: 'agent',    text: 'Dobrý den, paní Nováková! Ano, mohu zpracovat dočasné zvýšení limitu. Nejprve musím ověřit vaši totožnost.', time: 'před 63 d.' },
        { id: 'c4-m3', role: 'customer', text: '15.04.1982, účet končí 3444.', time: 'před 63 d.' },
        { id: 'c4-m4', role: 'agent',    text: 'Totožnost ověřena. Zpracovávám dočasné zvýšení na €20 000 na 30 dní. Aktivní do 5 minut.', time: 'před 63 d.' },
        { id: 'c4-m5', role: 'customer', text: 'Perfektní, moc děkuji!', time: 'před 63 d.' },
      ],
      'conv-5': [
        { id: 'c5-m0', role: 'system',   text: 'Jana Nováková připojena přes Apple Messages · před 2 dny' },
        { id: 'c5-m1', role: 'customer', text: 'Dobrý den, zjistila jsem neznámou platbu €4 200 na své kartě. Můžete mi pomoci?', time: 'před 2 d.' },
        { id: 'c5-m2', role: 'agent',    text: 'Dobrý den! Náš tým pro podvody již zahájil reklamační řízení. Vaše karta byla z preventivních důvodů dočasně zablokována.', time: 'před 2 d.' },
        { id: 'c5-m3', role: 'customer', text: 'Děkuji za rychlou reakci. Dostanu peníze zpět?', time: 'před 2 d.' },
        { id: 'c5-m4', role: 'agent',    text: 'Ano — při úspěšné reklamaci bude celá částka připsána. Vyšetřování trvá 5–10 pracovních dnů.', time: 'před 2 d.' },
      ],
      'conv-6': [
        { id: 'c6-m0', role: 'system',   text: 'Jana Nováková odeslala zprávu přes RCS · před 71 dny' },
        { id: 'c6-m1', role: 'customer', text: 'Dobrý den, příští týden cestuji do USA (17.–30. března). Prosím deaktivujte podvodné alarmy na kartě.', time: 'před 71 d.' },
        { id: 'c6-m2', role: 'agent',    text: 'Cestovní oznámení pro 17.–30. března v USA potvrzeno. Podvodné alarmy deaktivovány na 14 dní. Příjemnou cestu!', time: 'před 71 d.' },
      ],
      'conv-7': [
        { id: 'c7-m0', role: 'system',   text: 'Jana Nováková připojena přes WhatsApp · před 3 dny' },
        { id: 'c7-m1', role: 'customer', text: 'Dobrý den, nemohu se přihlásit do internetového bankovnictví — hlásí, že je účet omezen.', time: 'před 3 d.' },
        { id: 'c7-m2', role: 'agent',    text: 'Váš účet byl dočasně omezen po neúspěšných pokusech o přihlášení. Přesměrovávám vás na tým pro ověřování identity.', time: 'před 3 d.' },
        { id: 'c7-m3', role: 'system',   text: 'Relace přesměrována na tým pro ověřování · před 3 dny' },
      ],
      'conv-8': [
        { id: 'c8-m0', role: 'system',   text: 'Jana Nováková připojena přes Webchat · před 4 dny' },
        { id: 'c8-m1', role: 'customer', text: 'Dobrý den, před 4 dny jsem odeslala platbu SWIFT a ještě nedorazila. Můžete to zkontrolovat?', time: 'před 4 d.' },
        { id: 'c8-m2', role: 'agent',    text: 'Dobrý den! Rád se na to podívám. Můžete mi prosím sdělit referenci platby?', time: 'před 4 d.' },
        { id: 'c8-m3', role: 'system',   text: 'Relace ukončena po 8 minutách nečinnosti' },
      ],
    },
  },

  history: {
    events: [
      // ── Úkol 1: CASE-2024-0892 — eskalace e-mailem (aktivní, negativní) ───
      { id: 'cs-t1-e1', taskId: 'task-2024-0892-email-3', ts: ago(5 * MIN),          channel: 'email',    eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Priority Banking E-mail', agentName: 'Agent Novák',    title: `Urgentní: Faktura #${REF.invoice} – Platba nezaúčtována`, summary: `Třetí eskalace. SEPA ref. ${REF.sepaRef} odepsán, ale v systému nezaúčtován. Přiložena faktura a potvrzení z banky.`, caseId: REF.case1 },
      { id: 'cs-t1-e2', taskId: 'task-2024-0892-email-3', ts: ago(4 * MIN),          channel: 'email',    eventType: 'task:connected', typeLabel: 'Připojen',     direction: 'inbound',  queueName: 'Priority Banking E-mail', agentName: 'Agent Novák',    title: `Urgentní: Faktura #${REF.invoice} – Platba nezaúčtována`, summary: 'Agent Novák posuzuje eskalaci a připravuje prioritní odpověď.', caseId: REF.case1 },
      // ── Úkol 2: CASE-2024-0892 — telefonní follow-up (vyřešeno, pozitivní) ─
      { id: 'cs-t2-e1', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H),            channel: 'voice',    eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Priority Banking',        agentName: 'Agent Novák',    title: 'Příchozí hovor – sledování zpracování platby', summary: `Zákaznice volala kvůli ${REF.case1}. Přesměrování na platební tým.`, ivrDuration: 45, caseId: REF.case1 },
      { id: 'cs-t2-e2', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H - 2 * MIN), channel: 'voice',    eventType: 'task:connected', typeLabel: 'Připojen',     direction: 'inbound',  queueName: 'Priority Banking',        agentName: 'Agent Novák',    title: 'Příchozí hovor – sledování zpracování platby', summary: 'Agent Novák připojen. Prověřuje stav pozastavení SEPA s platebním týmem.', caseId: REF.case1 },
      { id: 'cs-t2-e3', taskId: 'task-2024-0892-voice-2', ts: ago(3 * H - 10 * MIN), channel: 'voice',   eventType: 'task:ended',     typeLabel: 'Ukončen',      direction: 'inbound',  queueName: 'Priority Banking',        agentName: 'Agent Novák',    title: 'Příchozí hovor – sledování zpracování platby', summary: 'Vyřešeno: Eskalace na senior platebního specialistu potvrzena. ETA 2h. Zákaznice spokojena.', wrapUpName: 'Platební eskalace – Vyřešeno', caseId: REF.case1 },
      // ── Úkol 3: CASE-2024-0892 — WhatsApp follow-up (pozastaven, neutrální) ─
      { id: 'cs-t3-e1', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D),            channel: 'whatsapp', eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Digitální zprávy',        agentName: 'Agent Dvořák',   title: `SEPA převod stále nezaúčtován – WhatsApp`, summary: `Zákaznice kontaktuje přes WhatsApp. Ref. ${REF.sepaRef} nevyřešen. Přesměrováno na Agent Dvořák.`, caseId: REF.case1 },
      { id: 'cs-t3-e2', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D - 3 * MIN), channel: 'whatsapp', eventType: 'task:connected', typeLabel: 'Připojen',     direction: 'inbound',  queueName: 'Digitální zprávy',        agentName: 'Agent Dvořák',   title: `SEPA převod stále nezaúčtován – WhatsApp`, summary: 'Agent Dvořák prověřuje propojený případ a zasílá zákaznici aktualizaci stavu.', caseId: REF.case1 },
      { id: 'cs-t3-e3', taskId: 'task-2024-0892-wa-1',    ts: ago(1 * D - 8 * MIN), channel: 'whatsapp', eventType: 'task:parked',    typeLabel: 'Pozastaven',   direction: 'inbound',  queueName: 'Digitální zprávy',        agentName: 'Agent Dvořák',   title: `SEPA převod stále nezaúčtován – WhatsApp`, summary: 'Pozastaveno do zpětného volání týmu compliance. Zákaznice informována o oknu 2h.', caseId: REF.case1 },
      // ── Úkol 4: CASE-2024-0784 — webchat přihlášení (vyřešeno, pozitivní) ──
      { id: 'cs-t4-e1', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D),            channel: 'chat',     eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Obecný banking chat',     agentName: 'Agent Dvořák',   title: 'Problém s přístupem do internetového bankovnictví – webchat', summary: 'Zákaznice nahlásila selhání přihlášení po resetu hesla. 2FA SMS nedoručena.', caseId: REF.case2 },
      { id: 'cs-t4-e2', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D - 5 * MIN), channel: 'chat',     eventType: 'task:connected', typeLabel: 'Připojen',     direction: 'inbound',  queueName: 'Obecný banking chat',     agentName: 'Agent Dvořák',   title: 'Problém s přístupem do internetového bankovnictví – webchat', summary: 'Agent Dvořák připojen. Diagnostikuje problém s doručením 2FA s IT.', caseId: REF.case2 },
      { id: 'cs-t4-e3', taskId: 'task-2024-0784-chat-1',  ts: ago(8 * D - 18 * MIN), channel: 'chat',    eventType: 'task:ended',     typeLabel: 'Ukončen',      direction: 'inbound',  queueName: 'Obecný banking chat',     agentName: 'Agent Dvořák',   title: 'Problém s přístupem do internetového bankovnictví – webchat', summary: 'Vyřešeno: Problém s SMS routingem opraven. Zákaznice získala přístup v relaci.', caseId: REF.case2 },
      // ── Úkol 5: CASE-2024-0651 — WhatsApp kontokorent (pozastaven) ──────────
      { id: 'cs-t5-e1', taskId: 'task-2024-0651-wa-1',    ts: ago(14 * D),           channel: 'whatsapp', eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Digitální zprávy',        agentName: 'Agent Šimánek',  title: 'Spor o poplatek za kontokorent – WhatsApp', summary: 'Zákaznice kontaktovala přes WhatsApp kvůli poplatku €45 za kontokorent (8. května).', caseId: REF.case3 },
      { id: 'cs-t5-e2', taskId: 'task-2024-0651-wa-1',    ts: ago(14 * D - 4 * MIN), channel: 'whatsapp', eventType: 'task:parked',   typeLabel: 'Pozastaven',   direction: 'inbound',  queueName: 'Digitální zprávy',        agentName: 'Agent Šimánek',  title: 'Spor o poplatek za kontokorent – WhatsApp', summary: 'Pozastaveno zatímco back-office tým přezkoumává doklady o prodlevě procesoru.', caseId: REF.case3 },
      // ── Úkol 6: CASE-2024-0651 — odchozí SMS (vyřešeno, pozitivní) ──────────
      { id: 'cs-t6-e1', taskId: 'task-2024-0651-sms-1',   ts: ago(21 * D),           channel: 'sms',      eventType: 'task:new',       typeLabel: 'Nový',         direction: 'outbound', queueName: 'Proaktivní oslovení',     agentName: 'Agent Šimánek',  title: 'SMS: Prominutí poplatku potvrzeno', summary: `Odchozí SMS na +420 222 333 444: Prominutí poplatku pro ${REF.case3} schváleno.`, caseId: REF.case3 },
      { id: 'cs-t6-e2', taskId: 'task-2024-0651-sms-1',   ts: ago(21 * D - 1 * MIN), channel: 'sms',      eventType: 'task:ended',    typeLabel: 'Ukončen',      direction: 'outbound', queueName: 'Proaktivní oslovení',     agentName: 'Agent Šimánek',  title: 'SMS: Prominutí poplatku potvrzeno', summary: 'Doručeno. Zákaznice odpověděla: „Děkuji, to jsou skvělé zprávy."', caseId: REF.case3 },
      // ── Úkol 7: žádný případ — e-mail výpis (vyřešeno, pozitivní) ───────────
      { id: 'cs-t7-e1', taskId: 'task-stmt-email-1',       ts: ago(35 * D),           channel: 'email',    eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Obecné dotazy e-mail',    agentName: 'Agent Procházka', title: 'Dotaz k výpisu – dubnová položka', summary: 'Zákaznice požádala o vysvětlení položky výpisu. Dotaz na poplatek za konverzi USD.', caseId: null },
      { id: 'cs-t7-e2', taskId: 'task-stmt-email-1',       ts: ago(35 * D - 6 * H),  channel: 'email',    eventType: 'task:ended',    typeLabel: 'Ukončen',      direction: 'inbound',  queueName: 'Obecné dotazy e-mail',    agentName: 'Agent Procházka', title: 'Dotaz k výpisu – dubnová položka', summary: 'Vyřešeno: Poplatek za konverzi vysvětlen. Zákaznice spokojena.', caseId: null },
      // ── Úkol 8: CASE-2024-0445 — in-app limit karty (vyřešeno, pozitivní) ───
      { id: 'cs-t8-e1', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D),           channel: 'chat',     eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'In-App podpora',          agentName: 'Agent Kovář',    title: 'Žádost o zvýšení limitu karty – In-App chat', summary: 'Zákaznice požádala o dočasné zvýšení limitu kreditní karty na €20 000 pro nákup.', caseId: REF.case4 },
      { id: 'cs-t8-e2', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D - 3 * MIN), channel: 'chat',     eventType: 'task:connected', typeLabel: 'Připojen',     direction: 'inbound', queueName: 'In-App podpora',          agentName: 'Agent Kovář',    title: 'Žádost o zvýšení limitu karty – In-App chat', summary: 'Agent Kovář zpracovává zvýšení limitu po ověření identity.', caseId: REF.case4 },
      { id: 'cs-t8-e3', taskId: 'task-2024-0445-inapp-1',  ts: ago(42 * D - 10 * MIN), channel: 'chat',    eventType: 'task:ended',    typeLabel: 'Ukončen',      direction: 'inbound',  queueName: 'In-App podpora',          agentName: 'Agent Kovář',    title: 'Žádost o zvýšení limitu karty – In-App chat', summary: 'Schváleno: Limit zvýšen na €20 000 na 30 dní. Nákup úspěšně dokončen.', caseId: REF.case4 },
      // ── Úkol 9: žádný případ — zmeškaný zpětný hovor (negativní) ────────────
      { id: 'cs-t9-e1', taskId: 'task-callback-voice-1',   ts: ago(50 * D),           channel: 'voice',    eventType: 'task:new',       typeLabel: 'Nový',         direction: 'outbound', queueName: 'Plánované zpětné hovory', agentName: 'Agent Procházka', title: 'Odchozí zpětný hovor – přehled účtu', summary: 'Plánovaný roční přehled účtu. Zákaznice neodpověděla.', caseId: null },
      { id: 'cs-t9-e2', taskId: 'task-callback-voice-1',   ts: ago(50 * D - 2 * MIN), channel: 'voice',    eventType: 'task:connected', typeLabel: 'Připojen',     direction: 'outbound', queueName: 'Plánované zpětné hovory', agentName: 'Agent Procházka', title: 'Odchozí zpětný hovor – přehled účtu', summary: 'Zanechána zpráva na hlasové schránce. Naplánován follow-up e-mail.', caseId: null },
      // ── Úkol 10: CASE-2024-0445 — karta zablokována v zahraničí (vyřešeno) ──
      { id: 'cs-t10-e1', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D),            channel: 'voice',   eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Podvody a bezpečnost',    agentName: 'Agent Šimánek',  title: 'Příchozí hovor – karta zablokována v zahraničí', summary: 'Karta zablokována při zahraniční cestě (USA). Zákaznice volá z New Yorku.', ivrDuration: 90, caseId: REF.case4 },
      { id: 'cs-t10-e2', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D - 1 * MIN), channel: 'voice',    eventType: 'task:connected', typeLabel: 'Připojen',     direction: 'inbound',  queueName: 'Podvody a bezpečnost',    agentName: 'Agent Šimánek',  title: 'Příchozí hovor – karta zablokována v zahraničí', summary: 'Identita ověřena prostřednictvím video hovoru. Reaktivace karty pro cestování do USA.', holdDuration: 120, caseId: REF.case4 },
      { id: 'cs-t10-e3', taskId: 'task-2024-0445-voice-1', ts: ago(63 * D - 22 * MIN), channel: 'voice',   eventType: 'task:ended',    typeLabel: 'Ukončen',      direction: 'inbound',  queueName: 'Podvody a bezpečnost',    agentName: 'Agent Šimánek',  title: 'Příchozí hovor – karta zablokována v zahraničí', summary: 'Vyřešeno: Karta reaktivována do 20 minut. Cestovní upozornění přidáno. Zákaznice spokojena.', wrapUpName: 'Karta reaktivována – cestovní auth.', caseId: REF.case4 },
      // ── Úkol 11: žádný případ — RCS cestovní oznámení (vyřešeno, pozitivní) ─
      { id: 'cs-t11-e1', taskId: 'task-rcs-001',           ts: ago(71 * D),            channel: 'rcs',     eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Digitální zprávy',        agentName: 'Agent Dvořák',   title: 'Cestovní oznámení – RCS', summary: 'Zákaznice zaslala cestovní oznámení pro cestu do USA přes RCS. Požadavek na vypnutí upozornění na podvody po dobu 14 dní.', caseId: null },
      { id: 'cs-t11-e2', taskId: 'task-rcs-001',           ts: ago(71 * D - 2 * MIN), channel: 'rcs',      eventType: 'task:ended',    typeLabel: 'Ukončen',      direction: 'inbound',  queueName: 'Digitální zprávy',        agentName: 'Agent Dvořák',   title: 'Cestovní oznámení – RCS', summary: 'Karta povolena pro mezinárodní použití. Upozornění na podvody vypnuta na 14 dní.', caseId: null },
      // ── Úkol 12: CASE-2024-0312 — e-mail SEPA prodleva (pozastaven) ──────────
      { id: 'cs-t12-e1', taskId: 'task-2024-0312-email-1', ts: ago(81 * D),            channel: 'email',   eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Priority Banking E-mail', agentName: 'Agent Procházka', title: 'Dotaz ohledně zpoždění SEPA převodu', summary: 'Zákaznice se dotazovala na opožděnou platbu dodavateli. Spuštěn práh AML kontroly.', caseId: REF.case5 },
      { id: 'cs-t12-e2', taskId: 'task-2024-0312-email-1', ts: ago(81 * D - 3 * H),  channel: 'email',    eventType: 'task:parked',   typeLabel: 'Pozastaven',   direction: 'inbound',  queueName: 'Priority Banking E-mail', agentName: 'Agent Procházka', title: 'Dotaz ohledně zpoždění SEPA převodu', summary: 'Pozastaveno do clearance AML týmu. Zákaznice informována o 3pracovní lhůtě.', caseId: REF.case5 },
      // ── Systém S1: Upozornění na podvod (2 dny, negativní) ──────────────────
      { id: 'cs-s1-e1', taskId: 'task-fraud-alert-2d',     ts: ago(2 * D),            channel: 'system',   eventType: 'task:new',       typeLabel: 'Upozornění', direction: null,       queueName: 'Řízení rizik',            agentName: 'Systém detekce podvodů', title: 'Upozornění na podvod: neobvyklý vzor transakcí', summary: 'Detekovány 3 rychlé online nákupy v celkové výši €850 od neznámých obchodníků ve východní Evropě. Účet dočasně omezen. Zákaznice informována SMS.', caseId: null },
      // ── Systém S2: Prémium nabídka (18 dní, pozitivní) ──────────────────────
      { id: 'cs-s2-e1', taskId: 'task-marketing-gold-18d', ts: ago(18 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Nabídka',   direction: null,       queueName: 'Marketingová automatizace', agentName: 'Personalizační engine', title: 'Personalizovaná nabídka: upgrade na Moneta Gold tier', summary: 'Na základě objemu transakcí (€48k YTD) se zákaznice kvalifikuje pro Gold tier. Odeslána push notifikace a in-app nabídka.', caseId: null },
      { id: 'cs-s2-e2', taskId: 'task-marketing-gold-18d', ts: ago(18 * D - 4 * H),  channel: 'system',   eventType: 'task:ended',    typeLabel: 'Dokončeno', direction: null,        queueName: 'Marketingová automatizace', agentName: 'Personalizační engine', title: 'Personalizovaná nabídka: upgrade na Moneta Gold tier', summary: 'Nabídka zobrazena zákaznicí (2 min zapojení). Bez konverze. Follow-up email naplánován na 7 dní.', caseId: null },
      // ── Systém S3: KYC přezkum (48 dní, neutrální) ──────────────────────────
      { id: 'cs-s3-e1', taskId: 'task-kyc-review-48d',     ts: ago(48 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Compliance', direction: null,      queueName: 'Compliance',             agentName: 'KYC systém',             title: 'Roční KYC přezkum — vyžádána dokumentace', summary: 'Spuštěn regulatorní roční KYC přezkum. Email odeslán: aktualizovaný foto doklad + potvrzení adresy. Lhůta 30 dní.', caseId: null },
      { id: 'cs-s3-e2', taskId: 'task-kyc-review-48d',     ts: ago(48 * D - 1 * H),  channel: 'system',   eventType: 'task:parked',   typeLabel: 'Čeká',      direction: null,       queueName: 'Compliance',             agentName: 'KYC systém',             title: 'Roční KYC přezkum — vyžádána dokumentace', summary: 'Čeká na dokumenty. Automatická připomínka naplánována na den 14.', caseId: null },
      // ── Systém S4: Věrnostní milestone (57 dní, pozitivní) ──────────────────
      { id: 'cs-s4-e1', taskId: 'task-loyalty-5k-57d',     ts: ago(57 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Odměna',    direction: null,       queueName: 'Věrnostní program',      agentName: 'Loyalty engine',         title: 'Dosaženo 5 000 bodů Moneta Rewards', summary: 'Zákaznice překročila 5 000 bodů (práh Gold). Odesláno gratuační email s brožurou výhod Gold.', caseId: null },
      { id: 'cs-s4-e2', taskId: 'task-loyalty-5k-57d',     ts: ago(57 * D - 20 * MIN), channel: 'system',  eventType: 'task:ended',    typeLabel: 'Dokončeno', direction: null,       queueName: 'Věrnostní program',      agentName: 'Loyalty engine',         title: 'Dosaženo 5 000 bodů Moneta Rewards', summary: 'Notifikace o odměně otevřena. Automaticky aplikována 3měsíční sleva poplatků.', caseId: null },
      // ── Systém S5: Alert ECB sazeb (70 dní, neutrální) ──────────────────────
      { id: 'cs-s5-e1', taskId: 'task-ecb-rate-70d',       ts: ago(70 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Poradenství', direction: null,     queueName: 'Produktový engine',      agentName: 'Systém sledování sazeb', title: 'Snížení sazby ECB — refinancování hypotéky', summary: 'Základní sazba ECB snížena o 0,25% na 3,25%. Zákaznice má variabilní hypotéku 4,7%. Nabídka fixní sazby 3,9% (5 let) odeslána emailem a push notifikací.', caseId: null },
      { id: 'cs-s5-e2', taskId: 'task-ecb-rate-70d',       ts: ago(70 * D - 2 * H),  channel: 'system',   eventType: 'task:parked',   typeLabel: 'Čeká',      direction: null,       queueName: 'Produktový engine',      agentName: 'Systém sledování sazeb', title: 'Snížení sazby ECB — refinancování hypotéky', summary: 'Nabídka zobrazena, žádná akce. Plánován telefonát poradce. Nabídka platí 14 dní.', caseId: null },
      // ── Systém S6: PSD2 re-autentizace (78 dní, negativní) ──────────────────
      { id: 'cs-s6-e1', taskId: 'task-psd2-reauth-78d',    ts: ago(78 * D),           channel: 'system',   eventType: 'task:new',       typeLabel: 'Bezpečnost', direction: null,     queueName: 'Bezpečnost',             agentName: 'Autentizační systém',    title: 'PSD2 biometrická re-registrace vyžadována', summary: 'Regulatorní 90denní reset silné autentizace. 3 push notifikace bez reakce. SMS záloha odeslána. Zákaznice musí dokončit re-registraci před dalším přihlášením.', caseId: null },
      // ── Úkol 4b: CASE-2024-0784 — navazující e-mail Login/App (vyřešeno) ──
      { id: 'cs-t4b-e1', taskId: 'task-2024-0784-email-1', ts: ago(7 * D),            channel: 'email',    eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Digitální podpora e-mail', agentName: 'Agent Dvořák',   title: 'Internet banking — aktualizace aplikace po obnovení přihlášení', summary: 'Navazující e-mail po webchat sezení. 2FA vyřešeno; zákaznice žádá instrukce k aktualizaci aplikace v3.2.', caseId: REF.case2 },
      { id: 'cs-t4b-e2', taskId: 'task-2024-0784-email-1', ts: ago(7 * D - 2 * H),   channel: 'email',    eventType: 'task:ended',    typeLabel: 'Ukončeno',     direction: 'inbound',  queueName: 'Digitální podpora e-mail', agentName: 'Agent Dvořák',   title: 'Internet banking — aktualizace aplikace po obnovení přihlášení', summary: 'Vyřešeno: Instrukce krok za krokem odeslány. Zákaznice potvrdila úspěšnou aktualizaci přes App Store. Případ CASE-2024-0784 uzavřen.', caseId: REF.case2 },
      // ── Úkol 13: CASE-2025-0104 — dotaz na refinancování hypotéky (otevřeno)
      { id: 'cs-t13-e1', taskId: 'task-2025-0104-email-1', ts: ago(2 * D - 2 * H),   channel: 'email',    eventType: 'task:new',       typeLabel: 'Nový',         direction: 'inbound',  queueName: 'Prémiové úvěry',          agentName: 'Agent Dvořák',   title: 'Nabídka Gold tier — refinancování hypotéky 3,9\u00a0% fix', summary: 'Zákaznice reaguje pozitivně na nabídku snížení sazby. Žádá porovnání sazeb a ilustraci nákladů před poradenskym hovorem.', caseId: REF.case6 },
      { id: 'cs-t13-e2', taskId: 'task-2025-0104-email-1', ts: ago(2 * D - 4 * H),   channel: 'email',    eventType: 'task:parked',   typeLabel: 'Zaparkováno',  direction: 'inbound',  queueName: 'Prémiové úvěry',          agentName: 'Agent Dvořák',   title: 'Nabídka Gold tier — refinancování hypotéky 3,9\u00a0% fix', summary: 'ESIS ilustrace a porovnání sazeb připraveny. Poradenský hovor naplánován na následující pracovní den.', caseId: REF.case6 },
      // ── Kampaň C1: Udržení zákazníků Q2 (před 6 dny)
      { id: 'cs-c1-e1', taskId: null, ts: ago(6 * D), channel: 'email', eventType: 'email:out', typeLabel: 'Kampaň', direction: 'outbound', title: 'Kampaň: moneta_q2_retention_2026', summary: 'Osobní nabídka udržení zákazníků odeslána: odpuštění poplatků Gold tier + cestovní pojištění. Kampaň Q2 2026 pro rizikový segment (482 příjemce).', campaign: 'moneta_q2_retention_2026', campaignStatus: 'Success', caseId: null },
      // ── Kampaň C2: Upozornění na snížení sazby ECB (před 71 dny)
      { id: 'cs-c2-e1', taskId: null, ts: ago(71 * D), channel: 'email', eventType: 'email:out', typeLabel: 'Kampaň', direction: 'outbound', title: 'Kampaň: ecb_snizeni_sazby_brezen26', summary: 'Upozornění na snížení sazby ECB: refinancování hypotéky na 3,9 % fix. Cíleno na držitele variabilních hypoték se zůstatkem > 150 000 Kč.', campaign: 'ecb_snizeni_sazby_brezen26', campaignStatus: 'Success', caseId: null },
    ],
    interactionSummaries: {
      'task-2024-0892-voice-2': {
        initialContactReason: 'Zákaznice volala, aby sledovala čekající eskalaci platby za fakturu #' + REF.invoice + '. SEPA převod byl odepsán, ale přes týden nebyl zaúčtován.',
        keyActionsTaken: 'Agent Novák eskaloval případ na tým senior platebních specialistů. Zákaznice byla informována o zpětném volání do 2 hodin.',
        nextSteps: 'Senior platební specialista zavolá do 2 hodin a potvrdí ruční připsání převodu. Případ ' + REF.case1 + ' zůstává otevřen do potvrzení.',
      },
      'task-2024-0445-voice-1': {
        initialContactReason: 'Kreditní karta zákaznice byla automaticky zablokována detekcí podvodů při zahraniční cestě do USA. Zákaznice volala z New Yorku.',
        keyActionsTaken: 'Identita ověřena prostřednictvím video hovoru. Karta reaktivována pro mezinárodní použití do 20 minut. Cestovní upozornění přidáno pro pobyt v USA (17.–30. března). 2 minuty čekání při reaktivaci.',
        nextSteps: 'Není potřeba žádná další akce. Zákaznice potvrdí funkčnost karty u pokladního terminálu.',
        additionalContactReasons: 'Zákaznice se také ptala na zvýšení denního limitu výběru z bankomatu — odkázána na samoobsluhu v mobilní aplikaci.',
      },
    },
    aiSummary: `Jana Nováková (Praha Systems s.r.o., finanční ředitelka) je hodnotná zákaznice s opakujícími se problémy se zpracováním plateb. Aktivní případ ${REF.case1} je její třetí eskalace pro fakturu #${REF.invoice} (${REF.amount}). Historie ukazuje 2 dříve vyřešené případy (blokace karty, zpoždění SEPA) a otevřený přihlašovací problém. Nálada je urgentní — doporučena okamžitá eskalace na platební tým a proaktivní zpětné volání.`,
  },

  email: {
    activeEmail: {
      messageId: 'mock-msg-001', threadId: 'mock-thread-001',
      from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: 'finance@praha-systems.cz',
      subject: `Urgentní: Faktura #${REF.invoice} – Platba nebyla zaúčtována`,
      date: 'Čt, 5. 6. 2025 14:22',
      snippet: `Třetí pokus o vyřešení selhání platby za fakturu #${REF.invoice} (${REF.amount}). SEPA ref.: ${REF.sepaRef}.`,
      bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Dobrý den, vážený tým podpory,</p><p>píšu vám v naléhavé věci opakovaného selhání zpracování platby za <strong>Fakturu #${REF.invoice}</strong> (${REF.amount}). Toto je náš <strong>třetí pokus</strong> o vyřešení tohoto problému.</p><p>SEPA převod ref.: ${REF.sepaRef}, zadán 29. května 2025. Prostředky odepsány, ale v systému nezaúčtovány.</p><ul><li>Faktura: ${REF.invoice}</li><li>Částka: ${REF.amount}</li><li>Reference: ${REF.sepaRef}</li></ul><p>Prosím, považujte tento případ za <strong>prioritní</strong>. Faktura a bankovní potvrzení přiloženy.</p><p>S pozdravem,<br/>Jana Nováková<br/>Finanční ředitelka, Praha Systems s.r.o.</p></div>`,
      bodyText: '', attachments: [
        { attachmentId: 'mock-att-1', filename: `faktura_${REF.invoice}.pdf`, mimeType: 'application/pdf', size: 45820 },
        { attachmentId: 'mock-att-2', filename: 'potvrzeni_banky_SEPA.pdf', mimeType: 'application/pdf', size: 23440 },
      ],
    },
    thread: [
      { messageId: 'mock-msg-000', threadId: 'mock-thread-001', from: 'Tým podpory <support@moneta-bank.com>', to: 'j.novakova@praha-systems.cz', cc: '', subject: `Re: Faktura #${REF.invoice} – Platba nebyla zaúčtována`, date: 'St, 4. 6. 2025 10:05', snippet: 'Obdrželi jsme váš dotaz a náš platební tým se věcí zabývá.', bodyHtml: '<p>Vážená paní Nováková,</p><p>obdrželi jsme váš dotaz a náš platební tým věc prošetřuje. Do 24 hodin vás budeme informovat.</p><p>S pozdravem,<br/>Tým podpory Moneta Bank</p>', bodyText: '', attachments: [] },
      { messageId: 'mock-msg-002', threadId: 'mock-thread-001', from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: '', subject: `Re: Faktura #${REF.invoice} – Platba nebyla zaúčtována`, date: 'St, 4. 6. 2025 16:48', snippet: 'Stále žádná odpověď. Můžete prosím eskalovat?', bodyHtml: '<p>Dobrý den,</p><p>stále jsem neobdržela žádnou aktualizaci. Můžete prosím eskalovat na nadřízeného? Nemůžeme uzavřít naše knihy, dokud není toto vyřešeno.</p><p>Jana Nováková</p>', bodyText: '', attachments: [] },
      { messageId: 'mock-msg-001', threadId: 'mock-thread-001', from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: 'finance@praha-systems.cz', subject: `Urgentní: Faktura #${REF.invoice} – Platba nebyla zaúčtována`, date: 'Čt, 5. 6. 2025 14:22', snippet: `Třetí pokus o vyřešení selhání platby za fakturu #${REF.invoice} (${REF.amount}).`, bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Dobrý den, vážený tým podpory,</p><p>Urgentní upomínka k Faktuře #${REF.invoice} (${REF.amount}) — třetí pokus. SEPA ref.: ${REF.sepaRef}.</p><p>Prosím o prioritní zpracování. Faktura a bankovní potvrzení přiloženy.</p><p>S pozdravem,<br/>Jana Nováková<br/>Finanční ředitelka, Praha Systems s.r.o.</p></div>`, bodyText: '', attachments: [{ attachmentId: 'mock-att-1', filename: `faktura_${REF.invoice}.pdf`, mimeType: 'application/pdf', size: 45820 }, { attachmentId: 'mock-att-2', filename: 'potvrzeni_banky_SEPA.pdf', mimeType: 'application/pdf', size: 23440 }] },
    ],
    aiEnrichment: {
      summary: `Zákaznice hlásí opakované selhání platby za fakturu #${REF.invoice} (${REF.amount}). Třetí dotaz za 5 dní. SEPA převod odepsán, ale nezaúčtován v systému. Eskalace na vedúcho.`,
      category: 'Problém s platbou', sentiment: 'urgent', confidence: 0.94,
      suggestedReply: `Vážená paní Nováková, děkujeme za Váš podnět. Váš případ (ref.: INC-20250605-4421) jsem jako prioritu eskaloval na náš tým pro vyšetřování plateb. Senior specialista vás přímo kontaktuje do 2 pracovních hodin. Upřímně se omlouváme za způsobené potíže.`,
      source: 'ai',
    },
    customerThreads: [
      { threadId: 'mock-thread-mortgage-cs', subject: 'Nabídka Gold tier — refinancování hypotéky 3,9 % fix', date: '4. 6. 2025', snippet: 'Porovnání sazeb a ESIS ilustrace požadovány.' },
      { threadId: 'mock-thread-login-cs', subject: 'Internet banking — aktualizace aplikace po obnovení přihlášení', date: '26. 5. 2025', snippet: 'Instrukce k aktualizaci aplikace v3.2 odeslány.' },
      { threadId: 'mock-thread-stmt-cs', subject: 'Výpis dubna — poplatek za transakci v USD', date: '1. 5. 2025', snippet: 'Poplatek za konverzi měny odpustištěn jako členovi Gold tier.' },
      { threadId: 'mock-thread-sepa-cs', subject: `Zpoždění SEPA převodu – Faktura #${REF.invoice}`, date: '14. 3. 2025', snippet: 'AML kontrola při platbě dodavateli. Vyřešeno.' },
        { threadId: 'mock-thread-chargeback-cs',   statusKey: 'active',            topicKey: 'payment', subject: 'Žádost o chargeback — neoprávněná transakce €4 200', date: '5. 6. 2025', snippet: 'Podvod nahlášen. Reklamační řízení zahájeno.' },
        { threadId: 'mock-thread-overdraft-cs',     statusKey: 'active',            topicKey: 'dispute', subject: 'Poplatek za přečerpání — stížnost při schváleném limitu', date: '3. 6. 2025', snippet: 'Stížnost na poplatek za přečerpání při schváleném debetním limitu.' },
        { threadId: 'mock-thread-kyc-cs',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Ověření účtu — KYC dokument vyžadován', date: '28. 5. 2025', snippet: 'Čeká se na doložení obnoveného průkazu totožnosti.' },
        { threadId: 'mock-thread-swift-cs',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'Zpoždění SWIFT platby — referenční č. ${REF.sepaRef}', date: '20. 5. 2025', snippet: 'Zpoždění v korespondenční bance. Vyřešeno po 4 pracovních dnech.' },
    ],
  },

  // taskIds not listed here fall back to the default `email` block above.
  emails: {
    'task-stmt-email-1': {
      activeEmail: {
        messageId: 'mock-msg-stmt-q-cs', threadId: 'mock-thread-stmt-cs',
        from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: '',
        subject: 'Výpis dubna — poplatek za transakci v USD',
        date: 'Čt, 1. 5. 2025 09:30',
        snippet: 'Dotaz na poplatek za konverzi měny USD 340 (cca 312 Kč) na výpisu za duben.',
        bodyHtml: `<p>Dobrý den,</p><p>při kontrole výpisu za duben jsem si všimla poplatku za konverzi měny USD 340 (cca 312 Kč) za nákup z 15. dubna. Můžete mi prosím upesnit, zda je tento poplatek správný a jaký směnný kurz byl použit?</p><p>S pozdravem,<br/>Jana Nováková</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-stmt-r-cs', threadId: 'mock-thread-stmt-cs', from: 'Tým podpory Moneta Bank <support@moneta-bank.com>', to: 'j.novakova@praha-systems.cz', cc: '', subject: 'Re: Výpis dubna — poplatek za transakci v USD', date: 'Čt, 1. 5. 2025 14:15', snippet: 'Poplatek za USD dle kurzu ECB + 1,5 %. Jednorázové prominutí Gold tier aplikováno — 312 Kč dnes přepsáno.', bodyHtml: '<p>Vitám Vás, paní Nováková,</p><p>poplatek USD 340 byl vyčíslen dle středního kurzu ECB 1,083 plus našeho standardního poplatku za nekorunovou transakci 1,5 %, celkem 312,40 Kč. Jako členka Gold tier máte nárok na jednorázové čtvrtletní prominutí. Dnes jsem na Váš účet připsala 312,40 Kč.</p><p>S pozdravem,<br/>Agent Dvořák<br/>Moneta Bank</p>', bodyText: '', attachments: [] },
        { messageId: 'mock-msg-stmt-q-cs', threadId: 'mock-thread-stmt-cs', from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: '', subject: 'Výpis dubna — poplatek za transakci v USD', date: 'Čt, 1. 5. 2025 09:30', snippet: 'Dotaz na poplatek za konverzi měny USD 340 na výpisu za duben.', bodyHtml: `<p>Dobrý den,</p><p>poplatek za konverzi měny USD 340 (312 Kč) na výpisu za duben. Prosím upesnit směnný kurz.</p><p>Jana Nováková</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Zákaznice se dotává na poplatek za konverzi měny USD na výpisu za duben. Kurz ECB + 1,5 % správně aplikováno. Jednorázové prominutí Gold tier 312,40 Kč připsáno.',
        category: 'Dotaz k účtu', sentiment: 'neutral', confidence: 0.82,
        suggestedReply: `Vitám Vás, paní Nováková, poplatek USD 340 odpovídá našemu standardnímu poplatku 1,5 % za nekorunovou transakci (kurz ECB 1,083). Jako členka Gold tier jsem Vám dnes připsala 312,40 Kč — objeví se na následujícím výpisu.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgenchí: Faktura #${REF.invoice} – Platba nebyla zaúčtována`, date: '5. 6. 2025', snippet: 'Třetí eskalace kvůli selhání SEPA platby.' },
        { threadId: 'mock-thread-mortgage-cs', subject: 'Nabídka Gold tier — refinancování hypotéky 3,9 % fix', date: '4. 6. 2025', snippet: 'Porovnání sazeb požadováno.' },
        { threadId: 'mock-thread-login-cs', subject: 'Internet banking — aktualizace aplikace po obnovení přihlášení', date: '26. 5. 2025', snippet: 'Instrukce k aktualizaci odeslány.' },
        { threadId: 'mock-thread-sepa-cs', subject: `Zpoždění SEPA převodu – Faktura #${REF.invoice}`, date: '14. 3. 2025', snippet: 'AML kontrola. Vyřešeno.' },
        { threadId: 'mock-thread-chargeback-cs',   statusKey: 'active',            topicKey: 'payment', subject: 'Žádost o chargeback — neoprávněná transakce €4 200', date: '5. 6. 2025', snippet: 'Podvod nahlášen. Reklamační řízení zahájeno.' },
        { threadId: 'mock-thread-overdraft-cs',     statusKey: 'active',            topicKey: 'dispute', subject: 'Poplatek za přečerpání — stížnost při schváleném limitu', date: '3. 6. 2025', snippet: 'Stížnost na poplatek za přečerpání při schváleném debetním limitu.' },
        { threadId: 'mock-thread-kyc-cs',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Ověření účtu — KYC dokument vyžadován', date: '28. 5. 2025', snippet: 'Čeká se na doložení obnoveného průkazu totožnosti.' },
        { threadId: 'mock-thread-swift-cs',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'Zpoždění SWIFT platby — referenční č. ${REF.sepaRef}', date: '20. 5. 2025', snippet: 'Zpoždění v korespondenční bance. Vyřešeno po 4 pracovních dnech.' },
      ],
    },
    'task-2024-0784-email-1': {
      activeEmail: {
        messageId: 'mock-msg-login-q-cs', threadId: 'mock-thread-login-cs',
        from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: '',
        subject: 'Internet banking — aktualizace aplikace po obnovení přihlášení',
        date: 'Po, 26. 5. 2025 10:12',
        snippet: '2FA funguje — děkuji! Chyba při aktualizaci na novou verzi aplikace (v3.2).',
        bodyHtml: `<p>Dobrý den,</p><p>děkuji za vyřešení problému s 2FA. Všechno funguje. Ale při pokusu o aktualizaci na novou verzi mobilní aplikace (3.2) dostávám chybové hlášení. Mohli byste mi zaslat instrukce k aktualizaci?</p><p>S pozdravem,<br/>Jana Nováková</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-login-r-cs', threadId: 'mock-thread-login-cs', from: 'Tým podpory Moneta Bank <support@moneta-bank.com>', to: 'j.novakova@praha-systems.cz', cc: '', subject: 'Re: Internet banking — aktualizace aplikace po obnovení přihlášení', date: 'Po, 26. 5. 2025 11:45', snippet: 'Vyžadován iOS 16+. App Store → Moneta Bank → Aktualizovat. Cca 2 min. Nastavení 2FA zůstane zachováno.', bodyHtml: '<p>Dobrý den, paní Nováková,</p><p>pro aktualizaci (v3.2 vyžaduje iOS 16+): App Store → vyhledat „Moneta Bank“ → klepnout na „Aktualizovat“ → cca 2 minuty instalace. Nastavení 2FA zůstane zachováno. Vítejte.</p><p>S pozdravem,<br/>Agent Dvořák<br/>Digitální podpora</p>', bodyText: '', attachments: [] },
        { messageId: 'mock-msg-login-q-cs', threadId: 'mock-thread-login-cs', from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: '', subject: 'Internet banking — aktualizace aplikace po obnovení přihlášení', date: 'Po, 26. 5. 2025 10:12', snippet: '2FA vyřešeno. Chyba aktualizace aplikace v3.2 trvajá.', bodyHtml: `<p>Dobrý den,</p><p>2FA funguje. Chyba při aktualizaci v3.2 trvajá. Prosím zaslat instrukce.</p><p>Jana Nováková</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Navazující e-mail po obnovení přihlášení/2FA. Zákaznice žádá instrukce k aktualizaci mobilní aplikace v3.2. Vyžadován iOS 16+. Instrukce krok za krokem zaslány agentem Dvořákem.',
        category: 'Technická podpora', sentiment: 'positive', confidence: 0.88,
        suggestedReply: `Dobrý den, paní Nováková, ráda slyším, že 2FA funguje! Pro aktualizaci v3.2: App Store → vyhledat „Moneta Bank“ → Aktualizovat. Vyžadován iOS 16+, cca 2 minuty, nastavení 2FA zůstane zachováno.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgenchí: Faktura #${REF.invoice} – Platba nebyla zaúčtována`, date: '5. 6. 2025', snippet: 'Třetí eskalace kvůli selhání SEPA platby.' },
        { threadId: 'mock-thread-mortgage-cs', subject: 'Nabídka Gold tier — refinancování hypotéky 3,9 % fix', date: '4. 6. 2025', snippet: 'Porovnání sazeb požadováno.' },
        { threadId: 'mock-thread-stmt-cs', subject: 'Výpis dubna — poplatek za transakci v USD', date: '1. 5. 2025', snippet: 'Poplatek za konverzi měny odpustištěn.' },
        { threadId: 'mock-thread-sepa-cs', subject: `Zpoždění SEPA převodu – Faktura #${REF.invoice}`, date: '14. 3. 2025', snippet: 'AML kontrola. Vyřešeno.' },
        { threadId: 'mock-thread-chargeback-cs',   statusKey: 'active',            topicKey: 'payment', subject: 'Žádost o chargeback — neoprávněná transakce €4 200', date: '5. 6. 2025', snippet: 'Podvod nahlášen. Reklamační řízení zahájeno.' },
        { threadId: 'mock-thread-overdraft-cs',     statusKey: 'active',            topicKey: 'dispute', subject: 'Poplatek za přečerpání — stížnost při schváleném limitu', date: '3. 6. 2025', snippet: 'Stížnost na poplatek za přečerpání při schváleném debetním limitu.' },
        { threadId: 'mock-thread-kyc-cs',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Ověření účtu — KYC dokument vyžadován', date: '28. 5. 2025', snippet: 'Čeká se na doložení obnoveného průkazu totožnosti.' },
        { threadId: 'mock-thread-swift-cs',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'Zpoždění SWIFT platby — referenční č. ${REF.sepaRef}', date: '20. 5. 2025', snippet: 'Zpoždění v korespondenční bance. Vyřešeno po 4 pracovních dnech.' },
      ],
    },
    'task-2025-0104-email-1': {
      activeEmail: {
        messageId: 'mock-msg-mortgage-q-cs', threadId: 'mock-thread-mortgage-cs',
        from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'uvery@moneta-bank.com', cc: '',
        subject: 'Nabídka Gold tier — refinancování hypotéky 3,9 % fix',
        date: 'St, 4. 6. 2025 15:35',
        snippet: 'Mám zájem o nabídku fixní sazby. Prosím zaslat porovnání sazeb a ilustraci nákladů.',
        bodyHtml: `<p>Dobrý den,</p><p>obdržela jsem Váš oznámení o snížení sazby a nabídku refinancování hypotéky na 3,9 % fix (5 let). Naše stávající sazba je 4,7 % variabilní.</p><p>Mám o tuto možnost zájem. Mohli byste mi prosím zaslat:</p><ul><li>Porovnání sazeb (stávající vs. navrhované)</li><li>Celkovou ilustraci nákladů na celou dobu hypotéky</li><li>Poplatky za předcasné splacení nebo přechod</li></ul><p>S pozdravem,<br/>Jana Nováková<br/>Finanční ředitelka, Praha Systems s.r.o.</p>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-mortgage-q-cs', threadId: 'mock-thread-mortgage-cs', from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'uvery@moneta-bank.com', cc: '', subject: 'Nabídka Gold tier — refinancování hypotéky 3,9 % fix', date: 'St, 4. 6. 2025 15:35', snippet: 'Porovnání sazeb a ESIS ilustrace požadovány.', bodyHtml: `<p>Dobrý den,</p><p>Mám zájem o nabídku 3,9 % fix. Prosím zaslat porovnání a ilustraci nákladů.</p><p>Jana Nováková</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: 'Zákaznice reaguje pozitivně na nabídku refinancování hypotéky. Žádá porovnání sazeb a ESIS ilustraci. Gold tier — významná příležitost.',
        category: 'Hypotéka / Úvěry', sentiment: 'positive', confidence: 0.91,
        suggestedReply: `Dobrý den, paní Nováková, děkuji za Váš zájem o naši nabídku Gold tier. Připravuji porovnání sazeb (4,7 % variabilní vs. 3,9 % fix na 5 let) a ESIS ilustraci. Naš poradce Vás ráno zavolaj zítra.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgenchí: Faktura #${REF.invoice} – Platba nebyla zaúčtována`, date: '5. 6. 2025', snippet: 'Třetí eskalace kvůli selhání SEPA platby.' },
        { threadId: 'mock-thread-login-cs', subject: 'Internet banking — aktualizace aplikace po obnovení přihlášení', date: '26. 5. 2025', snippet: 'Instrukce k aktualizaci odeslány.' },
        { threadId: 'mock-thread-stmt-cs', subject: 'Výpis dubna — poplatek za transakci v USD', date: '1. 5. 2025', snippet: 'Poplatek za konverzi měny odpustištěn.' },
        { threadId: 'mock-thread-sepa-cs', subject: `Zpoždění SEPA převodu – Faktura #${REF.invoice}`, date: '14. 3. 2025', snippet: 'AML kontrola. Vyřešeno.' },
        { threadId: 'mock-thread-chargeback-cs',   statusKey: 'active',            topicKey: 'payment', subject: 'Žádost o chargeback — neoprávněná transakce €4 200', date: '5. 6. 2025', snippet: 'Podvod nahlášen. Reklamační řízení zahájeno.' },
        { threadId: 'mock-thread-overdraft-cs',     statusKey: 'active',            topicKey: 'dispute', subject: 'Poplatek za přečerpání — stížnost při schváleném limitu', date: '3. 6. 2025', snippet: 'Stížnost na poplatek za přečerpání při schváleném debetním limitu.' },
        { threadId: 'mock-thread-kyc-cs',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Ověření účtu — KYC dokument vyžadován', date: '28. 5. 2025', snippet: 'Čeká se na doložení obnoveného průkazu totožnosti.' },
        { threadId: 'mock-thread-swift-cs',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'Zpoždění SWIFT platby — referenční č. ${REF.sepaRef}', date: '20. 5. 2025', snippet: 'Zpoždění v korespondenční bance. Vyřešeno po 4 pracovních dnech.' },
      ],
    },
    'task-2024-0312-email-1': {
      activeEmail: {
        messageId: 'mock-msg-sepa-delay-cs', threadId: 'mock-thread-sepa-cs',
        from: `Jana Nováková <j.novakova@praha-systems.cz>`,
        to: 'support@moneta-bank.com', cc: '',
        subject: `Zpoždění SEPA převodu – Faktura #${REF.invoice}`,
        date: 'Po, 2. 6. 2025 09:14',
        snippet: `SEPA převod ref. ${REF.sepaRef} byl iniciován před 3 dny, ale příjemce prostředky dosud neobdržel.`,
        bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;"><p>Dobrý den, vážený tým podpory,</p><p>píšu vám ohledně zpožděného SEPA převodu iniciovaného dne <strong>30. května 2025</strong>.</p><p><strong>Detaily převodu:</strong></p><ul><li>Reference SEPA: ${REF.sepaRef}</li><li>Částka: ${REF.amount}</li><li>Příjemce: Dodavatelské služby s.r.o.</li><li>Číslo faktury: #${REF.invoice}</li></ul><p>Částka byla odepsána z mého účtu, ale příjemce dosud prostředky neobdržel. Lhůta splatnosti faktury byla včera. Můžete prosím prověřit stav?</p><p>S pozdravem,<br/>Jana Nováková</p></div>`,
        bodyText: '', attachments: [],
      },
      thread: [
        { messageId: 'mock-msg-sepa-delay-cs', threadId: 'mock-thread-sepa-cs', from: `Jana Nováková <j.novakova@praha-systems.cz>`, to: 'support@moneta-bank.com', cc: '', subject: `Zpoždění SEPA převodu – Faktura #${REF.invoice}`, date: 'Po, 2. 6. 2025 09:14', snippet: `SEPA převod ref. ${REF.sepaRef} dosud nedorazil k příjemci.`, bodyHtml: `<p>Detaily viz výše.</p>`, bodyText: '', attachments: [] },
      ],
      aiEnrichment: {
        summary: `Zákaznice oznamuje, že SEPA převod ref. ${REF.sepaRef} (${REF.amount}) pro fakturu #${REF.invoice} nedorazil příjemci po 3 dnech. Jde o první dotaz k této transakci.`,
        category: 'Zpoždění platby', sentiment: 'neutral', confidence: 0.88,
        suggestedReply: `Vážená paní Nováková, obdrželi jsme Váš dotaz ohledně SEPA převodu ref. ${REF.sepaRef}. Ihned prověřujeme stav a do 4 hodin Vás kontaktujeme s aktualizací. Omlouváme se za způsobené potíže.`,
        source: 'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-001', statusKey: 'resolved', topicKey: 'payment', subject: `Urgentní: Faktura #${REF.invoice} – Platba nebyla zaúčtována`, date: '5. 6. 2025', snippet: 'Třetí eskalace kvůli selhání SEPA platby.' },
        { threadId: 'mock-thread-mortgage-cs', subject: 'Nabídka Gold tier — refinancování hypotéky 3,9\u00a0% fix', date: '4. 6. 2025', snippet: 'Porovnání sazeb požadováno.' },
        { threadId: 'mock-thread-login-cs', subject: 'Internet banking — aktualizace aplikace po obnovení přihlášení', date: '26. 5. 2025', snippet: 'Instrukce k aktualizaci odeslány.' },
        { threadId: 'mock-thread-stmt-cs', subject: 'Výpis dubna — poplatek za transakci v USD', date: '1. 5. 2025', snippet: 'Poplatek za konverzi měny odpuštěn.' },
        { threadId: 'mock-thread-chargeback-cs',   statusKey: 'active',            topicKey: 'payment', subject: 'Žádost o chargeback — neoprávněná transakce €4 200', date: '5. 6. 2025', snippet: 'Podvod nahlášen. Reklamační řízení zahájeno.' },
        { threadId: 'mock-thread-overdraft-cs',     statusKey: 'active',            topicKey: 'dispute', subject: 'Poplatek za přečerpání — stížnost při schváleném limitu', date: '3. 6. 2025', snippet: 'Stížnost na poplatek za přečerpání při schváleném debetním limitu.' },
        { threadId: 'mock-thread-kyc-cs',           statusKey: 'awaiting-customer', topicKey: 'account', subject: 'Ověření účtu — KYC dokument vyžadován', date: '28. 5. 2025', snippet: 'Čeká se na doložení obnoveného průkazu totožnosti.' },
        { threadId: 'mock-thread-swift-cs',         statusKey: 'resolved',          topicKey: 'dispute', subject: 'Zpoždění SWIFT platby — referenční č. ${REF.sepaRef}', date: '20. 5. 2025', snippet: 'Zpoždění v korespondenční bance. Vyřešeno po 4 pracovních dnech.' },
      ],
    },

    // ── Real-task test sample: mirrors live task data (jarda@kp.cz, subject "Odecet") ──
    // Use in EmailWidget: <EmailWidget mockMode initialTaskId="jarda-odecet-test-1" />
    'jarda-odecet-test-1': {
      activeEmail: {
        messageId: 'mock-msg-odecet-q',
        threadId:  'mock-thread-odecet',
        from:      'Jarda Martan <jarda@kp.cz>',
        to:        'jarda@collab-rocks.cz',
        cc:        '',
        subject:   'Odecet',
        date:      'Sat, 6 Jun 2026 07:41:23 +0200',
        snippet:   'Dobrý den, chci se zeptat na odečet z mého účtu dne 3. 6. Nebyl mi srozumitelně vysvětlen účel transakce.',
        bodyHtml:  `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;">
<p>Dobrý den,</p>
<p>obdržel jsem výpis z účtu a zaznamenal jsem odečet ve výši <strong>1 850 Kč</strong> dne <strong>3. června 2026</strong>. Popis transakce je pro mě nesrozumitelný a nemohu ji přiřadit žádnému svému výdaji.</p>
<p><strong>Detaily transakce:</strong></p>
<ul>
  <li>Datum: 3. 6. 2026</li>
  <li>Částka: −1 850 Kč</li>
  <li>Popis: <em>ODECET POPLATEK MS 06/26</em></li>
</ul>
<p>Prosím o vysvětlení, co tento odečet představuje, a pokud jde o chybu, žádám o jeho vrácení.</p>
<p>S pozdravem,<br/>Jarda Martan</p>
</div>`,
        bodyText:  '',
        attachments: [],
      },
      thread: [
        {
          messageId: 'mock-msg-odecet-r1',
          threadId:  'mock-thread-odecet',
          from:      'Zákaznická podpora <jarda@collab-rocks.cz>',
          to:        'jarda@kp.cz',
          cc:        '',
          subject:   'Re: Odecet',
          date:      'Sat, 6 Jun 2026 09:15:00 +0200',
          snippet:   'Váš dotaz jsme obdrželi. Transakci prověřujeme a do 2 hodin se ozveme.',
          bodyHtml:  `<p>Dobrý den, pane Martane,</p>
<p>děkujeme za Váš podnět. Transakci ze dne 3. 6. 2026 ve výši 1 850 Kč prověřujeme. Ozveme se Vám do 2 pracovních hodin s vysvětlením.</p>
<p>S pozdravem,<br/>Tým zákaznické podpory</p>`,
          bodyText:  '',
          attachments: [],
        },
        {
          messageId: 'mock-msg-odecet-q',
          threadId:  'mock-thread-odecet',
          from:      'Jarda Martan <jarda@kp.cz>',
          to:        'jarda@collab-rocks.cz',
          cc:        '',
          subject:   'Odecet',
          date:      'Sat, 6 Jun 2026 07:41:23 +0200',
          snippet:   'Dotaz na odečet 1 850 Kč ze dne 3. 6. — popis transakce nesrozumitelný.',
          bodyHtml:  `<p>Dobrý den,</p><p>zaznamenal jsem odečet 1 850 Kč (3. 6. 2026, popis: ODECET POPLATEK MS 06/26). Nemohu ho přiřadit žádnému svému výdaji. Prosím o vysvětlení.</p><p>Jarda Martan</p>`,
          bodyText:  '',
          attachments: [],
        },
      ],
      aiEnrichment: {
        summary: 'Zákazník se ptá na odečet 1 850 Kč ze dne 3. 6. 2026 s popisem „ODECET POPLATEK MS 06/26". Transakce nesouvisí se žádným zákazníkem identifikovaným výdajem. Možný měsíční servisní poplatek. Čeká na vysvětlení nebo vrácení.',
        category:     'Dotaz k výpisu',
        sentiment:    'neutral',
        confidence:   0.85,
        suggestedReply: 'Dobrý den, pane Martane, popis „ODECET POPLATEK MS 06/26" označuje měsíční servisní poplatek za správu účtu pro červen 2026. Pokud se domníváte, že poplatek byl účtován chybně (např. máte účet s poplatkem odpuštěným), rád to prověřím a případně poplatek vrátím. Stačí potvrdit číslo smlouvy.',
        source:       'ai',
      },
      customerThreads: [
        { threadId: 'mock-thread-odecet-2', statusKey: 'resolved', topicKey: 'account',  subject: 'Změna tarifu — přechod na Premium',          date: '15. 4. 2026', snippet: 'Zákazník přešel na tarif Premium. Poplatky změněny.' },
        { threadId: 'mock-thread-odecet-3', statusKey: 'resolved', topicKey: 'payment',  subject: 'Platba kartou odmítnuta — e-shop',              date: '2. 3. 2026',  snippet: 'Limit online platby překročen. Limit zvýšen na žádost.' },
        { threadId: 'mock-thread-odecet-4', statusKey: 'resolved', topicKey: 'account',  subject: 'Žádost o výpis za Q1 2026',                     date: '5. 1. 2026',  snippet: 'Výpis za Q1 2026 odeslán na e-mail.' },
        { threadId: 'mock-thread-odecet-5', statusKey: 'resolved', topicKey: 'general',  subject: 'Přihlášení do internet bankingu — zapomenuté heslo', date: '18. 11. 2025', snippet: 'Reset hesla proveden. Přístup obnoven.' },
      ],
    },
  },

  analytics: {
    cases: {
      byStatus:   [ { label: 'Otevřený', value: 14, color: '#f5a623' }, { label: 'Probíhá', value: 9, color: '#00a0d1' }, { label: 'Vyřešený', value: 22, color: '#4ade80' }, { label: 'Uzavřený', value: 31, color: '#9ca3af' } ],
      byPriority: [ { label: 'Kritická', value: 3, color: '#e8453c' }, { label: 'Vysoká', value: 11, color: '#f5a623' }, { label: 'Střední', value: 18, color: '#00a0d1' }, { label: 'Nízká', value: 44, color: '#9ca3af' } ],
      byCategory: [ { label: 'Platby', value: 19, color: '#a78bfa' }, { label: 'Účet', value: 14, color: '#60a5fa' }, { label: 'Technické', value: 12, color: '#34d399' }, { label: 'Obecné', value: 31, color: '#f472b6' } ],
      trend: TREND.casesNew, resolutionTrend: TREND.casesResolution,
      slaBreached: 4, slaMet: 72, avgResolutionH: 19, fcr: 68, csat: 4.2, total: 76, openCount: 23,
    },
    history: {
      byChannel: [ { key: 'voice', label: 'Telefon', value: 26, color: '#4ade80' }, { key: 'email', label: 'E-mail', value: 25, color: '#a78bfa' }, { key: 'chat', label: 'Chat', value: 24, color: '#60a5fa' }, { key: 'whatsapp', label: 'WhatsApp', value: 15, color: '#25d366' }, { key: 'sms', label: 'SMS', value: 8, color: '#f472b6' } ],
      byOutcome: [ { key: 'resolved', label: 'Vyřešeno', value: 58, color: '#4ade80' }, { key: 'escalated', label: 'Eskalováno', value: 14, color: '#f5a623' }, { key: 'pending', label: 'Čeká', value: 11, color: '#60a5fa' }, { key: 'abandoned', label: 'Opuštěno', value: 7, color: '#e8453c' }, { key: 'transferred', label: 'Přesměrováno', value: 8, color: '#9ca3af' } ],
      sentiment: [ { key: 'positive', label: 'Pozitivní', value: 57, color: '#4ade80' }, { key: 'neutral', label: 'Neutrální', value: 24, color: '#9ca3af' }, { key: 'negative', label: 'Negativní', value: 17, color: '#e8453c' } ],
      volumeTrend: TREND.histVolume, ahtTrend: TREND.histAht,
      weekdayVolume: [21, 19, 23, 18, 22, 9, 5],
      totalInteractions: 98, avgHandleTimeMin: 6.7, repeatContactRate: 22, escalationRate: 14, resolutionRate: 76,
    },
    voice: {
      callOutcomes: [ { key: 'resolved', label: 'Vyřešeno', value: 14, color: '#00c389' }, { key: 'transferred', label: 'Přesměrováno', value: 4, color: '#f5a623' }, { key: 'callback', label: 'Zpětné volání', value: 3, color: '#7c3aed' }, { key: 'abandoned', label: 'Opuštěno', value: 2, color: '#e0463e' } ],
      sentiment:    [ { key: 'positive', label: 'Pozitivní', value: 9, color: '#00c389' }, { key: 'neutral', label: 'Neutrální', value: 7, color: '#f5a623' }, { key: 'negative', label: 'Negativní', value: 7, color: '#e0463e' } ],
      callTypes:    [ { key: 'inbound', label: 'Příchozí', value: 16, color: '#00a0d1' }, { key: 'outbound', label: 'Odchozí', value: 4, color: '#a78bfa' }, { key: 'callback', label: 'Zpětné volání', value: 3, color: '#f5a623' } ],
      volumeTrend: TREND.voiceVolume, ahtTrend: TREND.voiceAht,
      openCases: [ { id: REF.case1, status: 'Otevřený', topic: 'Spor o SEPA převod', priority: 'Vysoká', color: '#f5a623' }, { id: REF.case2, status: 'Uzavřený', topic: 'Přístup k přihlášení', priority: 'Nízká', color: '#00a0d1' } ],
      avgHandleTimeSec: 288, slaMet: 87, csat: 4.2, totalCalls30d: 23,
    },
    chat: {
      customer: 'Jana Nováková',
      channelMix: [ { key: 'webchat',  label: 'Webchat',    value: 18, color: '#00a0d1' }, { key: 'whatsapp', label: 'WhatsApp',  value: 12, color: '#25D366' }, { key: 'sms',      label: 'SMS',       value: 7,  color: '#f5a623' }, { key: 'apple',    label: 'Apple Msgs', value: 5,  color: '#007AFF' }, { key: 'in-app',   label: 'In-App',    value: 4,  color: '#a78bfa' }, { key: 'rcs',      label: 'RCS',       value: 2,  color: '#34d399' } ],
      sessionStatus: [ { key: 'active',      label: 'Aktivní', value: 1, color: '#00a0d1' }, { key: 'resolved',    label: 'Vyřešeno', value: 42, color: '#4ade80' }, { key: 'transferred', label: 'Přesměrováno', value: 2, color: '#f5a623' }, { key: 'abandoned',   label: 'Opuštěno', value: 3, color: '#e8453c' } ],
      sentiment: [ { label: 'Pozitivní', value: 19, color: '#4ade80' }, { label: 'Neutrální', value: 16, color: '#9ca3af' }, { label: 'Negativní', value: 13, color: '#e8453c' } ],
      volumeTrend: TREND.chatVolume, ahtTrend: TREND.chatAht,
      openCases: [ { id: REF.case1, status: 'Probíhá', topic: 'Zpracování plateb', priority: 'Vysoká', color: '#f5a623' }, { id: REF.case2, status: 'Otevřený', topic: 'Přístup k přihlášení', priority: 'Střední', color: '#00a0d1' }, { id: REF.case3, status: 'Probíhá', topic: 'Spor o kontokorent', priority: 'Vysoká', color: '#f5a623' } ],
      totalConversations: 48, avgFirstResponseSec: 18, slaMet: 91, csat: 4.4, conversationsThisMonth: 48,
    },
    email: {
      threadStatus: [ { key: 'active',            label: 'Aktivní', value: 2, color: '#00a0d1' }, { key: 'awaiting-customer', label: 'Čeká na zákazníka', value: 1, color: '#f5a623' }, { key: 'resolved', label: 'Vyřešeno', value: 8, color: '#4ade80' } ],
      topicMix: [ { key: 'payment', label: 'Problém s platbou', value: 5, color: '#a78bfa' }, { key: 'account', label: 'Přístup k účtu', value: 3, color: '#60a5fa' }, { key: 'dispute', label: 'Spor', value: 2, color: '#f472b6' }, { key: 'general', label: 'Obecné', value: 1, color: '#9ca3af' } ],
      sentiment: [ { label: 'Pozitivní', value: 3, color: '#4ade80' }, { label: 'Neutrální', value: 5, color: '#9ca3af' }, { label: 'Negativní', value: 3, color: '#e8453c' } ],
      volumeTrend: TREND.emailVolume, replyTimeTrend: TREND.emailReplyTime,
      openCases: [ { id: REF.case1, status: 'Probíhá', topic: 'Zpracování plateb', priority: 'Vysoká', color: '#f5a623' }, { id: REF.case2, status: 'Otevřený', topic: 'Přístup k přihlášení', priority: 'Střední', color: '#00a0d1' }, { id: REF.case3, status: 'Probíhá', topic: 'Spor o kontokoren', priority: 'Vysoká', color: '#f5a623' } ],
      avgFirstReplyH: 4.1, slaMet: 87, csat: 4.2, emailsThisMonth: 11, totalThreads: 11,
    },  },

  // ── Email composer: templates, signatures, knowledge base ─────────────────
  emailComposer: {
    defaultSignatureId: 'sig-cs-default',
    signatures: [
      {
        id: 'sig-cs-default',
        name: 'Standard CS',
        html: '<p style="font-size:12px;color:#545454">S pozdravem,<br><strong>{{agentName}}</strong><br>Zákaznická podpora | Moneta Bank<br>+420 800 123 456</p>',
      },
      {
        id: 'sig-cs-formal',
        name: 'Formální CS',
        html: '<p style="font-size:12px;color:#545454">S úctou,<br><strong>{{agentName}}</strong> | Moneta Bank a.s. | Zákaznické centrum</p>',
      },
    ],
    templates: [
      {
        id: 'tpl-cs-pozdrav',
        name: 'Úvodní pozdrav',
        locale: 'cs',
        category: 'greeting',
        variables: ['customerName', 'agentName'],
        body: '<p>Vážený/á {{customerName}},</p><p>děkujeme Vám za kontaktování Moneta Bank. Jmenuji se {{agentName}} a dnes Vám budu pomáhat s Vaší žádostí.</p><p>Vaší otázce jsem věnoval/a pozornost a brzy Vás kontaktuji s plným vyřešením.</p>',
      },
      {
        id: 'tpl-cs-omluva',
        name: 'Omluva',
        locale: 'cs',
        category: 'apology',
        variables: ['customerName'],
        body: '<p>Vážený/á {{customerName}},</p><p>v první řadě se Vám omlouváme za vzniklou komplikaci. Plně rozumíme, jak nepříjemná tato situace může být.</p><p>Ujistěte se, že Váš požadavek řešíme jako prioritní. Budeme Vás průběžně informovat o postupu.</p>',
      },
      {
        id: 'tpl-cs-vyrizeno',
        name: 'Vyřízení',
        locale: 'cs',
        category: 'resolution',
        variables: ['customerName'],
        body: '<p>Vážený/á {{customerName}},</p><p>s radostí Vám oznamujeme, že Vaše žádost byla plně vyřízena.</p><p>Pokud máte jakékoliv další dotazy, neváhejte nás kontaktovat. Rádi Vám pomůžeme.</p>',
      },
      {
        id: 'tpl-cs-platba',
        name: 'Dotaz k platbě',
        locale: 'cs',
        category: 'general',
        variables: ['customerName'],
        body: '<p>Vážený/á {{customerName}},</p><p>děkujeme za Vaši zprávu ohledně Vaší platby.</p><p>Vaší transakci jsme dohledali a aktuálně procházíme její podrobnosti. Standardní zpracování platby trvá <strong>1–3 pracovní dny</strong>.</p>',
      },
      {
        id: 'tpl-cs-bezpecnost',
        name: 'Bezpečnostní ověření',
        locale: 'cs',
        category: 'general',
        variables: ['customerName'],
        body: '<p>Vážený/á {{customerName}},</p><p>z bezpečnostních důvodů potřebujeme ověřit Vaši totožnost dříve, než budeme moci pokračovat.</p><p>Prosíme potvrdte následující:</p><ol><li>Vaši registrovanou e-mailovou adresu</li><li>Poslední 4 číslice Vašeho registrovaného telefonu</li><li>Vaše datum narození</li></ol>',
      },
    ],
    knowledgeBase: [
      {
        id: 'kb-cs-platby',
        title: 'Doby zpracování plateb',
        tags: ['platba', 'převod', 'SEPA', 'zpoždění', 'zpracování'],
        content: 'Standardní platby jsou zpracovány během 1-3 pracovních dnů. SEPA převody jsou zpracovány tentýž den, pokud jsou podány před 14:00 SEV. Mezinárodní převody mohou trvat 3-5 pracovních dnů.',
      },
      {
        id: 'kb-cs-bezpecnost',
        title: 'Bezpečnost účtu a ověření',
        tags: ['bezpečnost', 'přihlášení', 'heslo', 'blokování', 'přístup'],
        content: 'Pro jakékoliv změny účtu je vyžadováno ověření totožnosti. Požadováno: registrovaný e-mail, poslední 4 číslice telefonu, datum narození. Účet je zamknut po 5 neúspěšných pokusech. 2FA je povinné pro transakce nad 25 000 Kč.',
      },
      {
        id: 'kb-cs-reklamace',
        title: 'Proces reklamace transakce',
        tags: ['reklamace', 'spor', 'podvod', 'neautorizované', 'vrácení'],
        content: 'Reklamaci lze podat do 60 dnů od data transakce. Potřebné údaje: datum transakce, částka, název obchodníka, důvod reklamace. Doba řešení: 5-10 pracovních dnů.',
      },
      {
        id: 'kb-cs-kontokorent',
        title: 'Kontokorentový úvěr',
        tags: ['kontokorent', 'přečerpání', 'limit', 'poplatky', 'zůstatek'],
        content: 'Standardní limit kontokorentu: až 2x měsíční plat (max 125 000 Kč). Úroky: 19,9 % ročně. Žádný poplatek za sjednaný kontokorent. Kontokorent musí být vyrovnán do 90 dnů.',
      },
    ],
  },

  // ── TaskWidget ─────────────────────────────────────────────────────────
  task: {
    elapsedSec: 312,
    slaSec: 900,
    activeTask: {
      mediaType: 'workItem',
      mediaChannel: 'KYC_Review_CZ',
      interactionId: '72a9741f-demo-0003-0000-000000000000',
      state: 'connected',
      isWrapUp: false,
      isHold: false,
      timeStamp: Date.now() - 312000,
      virtualTeamName: 'KYC_Review_Queue',
      ani: '+420 222 333 444',
      callAssociatedData: {
        caseId:       { value: 'INC0011' },
        taskId:       { value: 'fd440207-demo-0003-0000-000000000000' },
        taskType:     { value: 'kyc' },
        customerName: { value: 'Jana Nováková' },
        email:        { value: 'j.novakova@praha-systems.cz' },
        ani:          { value: '+420 222 333 444' },
        virtualTeamName: { value: 'KYC_Review_Queue' },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════
const MOCK_BY_LOCALE = { en: EN, de: DE, cs: CS };

/**
 * Returns the full mock dataset for the given locale.
 * Falls back to English if the locale is not available.
 * @param {string} locale - e.g. 'en' | 'de' | 'cs'
 * @returns {object} locale-specific mock data
 */
export function getMockData(locale = 'en') {
  return MOCK_BY_LOCALE[locale] || MOCK_BY_LOCALE.en;
}
