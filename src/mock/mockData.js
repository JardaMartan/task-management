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
      id: REF.case1, caseId: REF.case1, status: 'in progress',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-06-03T12:00:00Z', owner: 'Agent Thompson', _isActive: true,
      description: `Customer reports repeated payment failure for Invoice #${REF.invoice} (${REF.amount}). Third follow-up in 5 days. SEPA transfer ref: ${REF.sepaRef} debited from customer account but not reflected in system. Escalating to supervisor level.`,
    },
    {
      id: REF.case2, caseId: REF.case2, status: 'open',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-05-28T09:30:00Z', owner: 'Agent Chen',
      description: 'Online banking login failure after password reset. Customer unable to access account for 2 days. Two-factor authentication not delivering SMS codes.',
    },
    {
      id: REF.case3, caseId: REF.case3, status: 'in progress',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-05-10T14:15:00Z', owner: 'Agent Schmidt',
      description: 'Customer disputes overdraft fee of €45 charged on 8 May. Payment processor delay caused temporary balance mismatch. Back-office review in progress.',
    },
    {
      id: REF.case4, caseId: REF.case4, status: 'closed',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-04-02T10:00:00Z', owner: 'Agent Williams',
      description: 'Card blocked during international travel to the United States. Identity verified via video call. Card reactivated within 20 minutes. Customer satisfied.',
    },
    {
      id: REF.case5, caseId: REF.case5, status: 'closed',
      customerName: 'Sarah Johnson', customerEmail: 'sarah.j@acme-corp.com',
      createdAt: '2025-03-15T08:45:00Z', owner: 'Agent Martinez',
      description: 'SEPA transfer to supplier delayed 3 business days due to AML screening threshold trigger. Resolved and funds credited. Customer notified with apology.',
    },
  ],

  // ── VoiceWidget ─────────────────────────────────────────────────────────
  voice: {
    calls: [
      { id: 'call-1', active: true, customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '09:41', durationSec: 847, direction: 'inbound', queue: 'Priority Banking', caseId: REF.case1, sentiment: 'negative', outcome: null },
      { id: 'call-2', active: false, customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '2025-05-29', durationSec: 312, direction: 'outbound', queue: 'Callback', caseId: REF.case2, sentiment: 'positive', outcome: 'Resolved' },
      { id: 'call-3', active: false, customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '2025-04-14', durationSec: 489, direction: 'inbound', queue: 'General Banking', caseId: REF.case3, sentiment: 'neutral', outcome: 'Transferred' },
      { id: 'call-4', active: false, customer: 'Sarah Johnson', phone: '+44 20 7946 0958', started: '2025-03-01', durationSec: 228, direction: 'inbound', queue: 'General Banking', caseId: REF.case4, sentiment: 'positive', outcome: 'Resolved' },
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
      { id: 'conv-1', channel: 'whatsapp', active: true,  customer: 'Sarah Johnson', snippet: "SEPA transfer still hasn't processed…", time: '14 min', status: 'Active',   caseId: REF.case1 },
      { id: 'conv-2', channel: 'webchat',  active: false, customer: 'Sarah Johnson', snippet: 'Login failure after password reset…',   time: '8d',     status: 'Resolved', caseId: REF.case2 },
      { id: 'conv-3', channel: 'sms',      active: false, customer: 'Sarah Johnson', snippet: 'Overdraft fee query — €45 charge…',     time: '26d',    status: 'Resolved', caseId: REF.case3 },
      { id: 'conv-4', channel: 'in-app',   active: false, customer: 'Sarah Johnson', snippet: 'Card blocked in New York, need help',   time: '63d',    status: 'Resolved', caseId: REF.case4 },
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
  },

  // ── HistoryView ─────────────────────────────────────────────────────────
  history: {
    events: [
      { id: 'hist-1',  ts: ago(5 * MIN),    channel: 'email',   title: `Urgent: Invoice #${REF.invoice} – Payment Not Processed`, summary: `Third escalation. SEPA transfer ref ${REF.sepaRef} debited but not reflected in system. Invoice and bank confirmation attached.` },
      { id: 'hist-2',  ts: ago(3 * H),      channel: 'phone',   title: 'Inbound call – payment processing follow-up',            summary: `Customer called to follow up on ${REF.case1}. Transferred to payments team after 4 min hold. Total duration: 8m 22s.` },
      { id: 'hist-3',  ts: ago(26 * H),     channel: 'email',   title: 'Still no update. Can you please escalate?',              summary: 'Customer escalating to supervisor level. No resolution after 24h since case was opened.' },
      { id: 'hist-4',  ts: ago(2 * D),      channel: 'email',   title: 'Dear Sarah, we have received your query',               summary: `Support acknowledgment email. Case ${REF.case1} opened. Expected resolution within 3 business days.` },
      { id: 'hist-5',  ts: ago(8 * D),      channel: 'webchat', title: 'Online banking access issue – webchat',                  summary: 'Customer reported login failure after password reset via Moneta Bank webchat. 2FA SMS not delivered. Issue resolved in session.' },
      { id: 'hist-6',  ts: ago(14 * D),     channel: 'whatsapp',title: 'Overdraft fee dispute – WhatsApp',                      summary: 'Customer contacted via WhatsApp to query €45 overdraft fee (8 May). Fee waived as goodwill gesture.' },
      { id: 'hist-7',  ts: ago(21 * D),     channel: 'sms',     title: 'SMS confirmation: case update',                         summary: `Outbound SMS sent to +44 20 7946 0958 confirming ${REF.case3} escalation. Customer replied: "Thank you, waiting for update."` },
      { id: 'hist-8',  ts: ago(35 * D),     channel: 'apple',   title: 'Monthly statement query – Apple Messages',              summary: 'Customer asked for clarification of April statement line item. Explained currency conversion fee on USD purchase. Customer satisfied.' },
      { id: 'hist-9',  ts: ago(42 * D),     channel: 'in-app',  title: 'Card limit increase request – In-App chat',             summary: `Customer requested temporary credit card limit increase to €20,000 for upcoming procurement. Approved after identity verification.` },
      { id: 'hist-10', ts: ago(63 * D),     channel: 'phone',   title: 'Inbound call – card blocked abroad',                    summary: `Card blocked during international travel (USA). Identity verified via video call. Card reactivated within 20 minutes.` },
      { id: 'hist-11', ts: ago(71 * D),     channel: 'rcs',     title: 'Travel notification – RCS',                             summary: 'Customer sent travel notification for US trip via RCS messaging. Card cleared for international use. Fraud alerts suppressed for 14 days.' },
      { id: 'hist-12', ts: ago(81 * D),     channel: 'email',   title: 'SEPA transfer delay enquiry',                           summary: 'Customer enquired about delayed payment to supplier. AML screening threshold triggered. Funds cleared after 3 business days.' },
    ],
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
      { threadId: 'mock-thread-prev', subject: 'Account access issue — resolved', date: 'May 12, 2025', snippet: 'Thank you for your help, the issue is now resolved.' },
    ],
  },

  // ── Analytics bars ──────────────────────────────────────────────────────
  analytics: {
    cases: {
      byStatus:   [ { label: 'Open', value: 14, color: '#f5a623' }, { label: 'In Progress', value: 9, color: '#00a0d1' }, { label: 'Resolved', value: 22, color: '#4ade80' }, { label: 'Closed', value: 31, color: '#9ca3af' } ],
      byPriority: [ { label: 'Critical', value: 3, color: '#e8453c' }, { label: 'High', value: 11, color: '#f5a623' }, { label: 'Medium', value: 18, color: '#00a0d1' }, { label: 'Low', value: 44, color: '#9ca3af' } ],
      byCategory: [ { label: 'Payment', value: 19, color: '#a78bfa' }, { label: 'Account', value: 14, color: '#60a5fa' }, { label: 'Technical', value: 12, color: '#34d399' }, { label: 'General', value: 31, color: '#f472b6' } ],
      trend: [8, 11, 7, 14, 10, 6, 9], resolutionTrend: [18, 22, 15, 28, 19, 14, 21],
      slaBreached: 4, slaMet: 72, avgResolutionH: 19, fcr: 68, csat: 4.2, total: 76, openCount: 23,
    },
    history: {
      byChannel: [ { label: 'Phone', value: 38, color: '#4ade80' }, { label: 'Email', value: 27, color: '#a78bfa' }, { label: 'Chat', value: 19, color: '#60a5fa' }, { label: 'SMS', value: 8, color: '#f472b6' }, { label: 'Task', value: 6, color: '#fbbf24' } ],
      byOutcome: [ { label: 'Resolved', value: 58, color: '#4ade80' }, { label: 'Escalated', value: 14, color: '#f5a623' }, { label: 'Pending', value: 11, color: '#60a5fa' }, { label: 'Abandoned', value: 7, color: '#e8453c' }, { label: 'Transferred', value: 8, color: '#9ca3af' } ],
      sentiment: [ { label: 'Positive', value: 41, color: '#4ade80' }, { label: 'Neutral', value: 34, color: '#9ca3af' }, { label: 'Negative', value: 23, color: '#e8453c' } ],
      volumeTrend: [12, 18, 15, 22, 19, 14, 17], ahtTrend: [6.2, 7.1, 5.8, 8.4, 6.9, 5.5, 7.3],
      weekdayVolume: [21, 19, 23, 18, 22, 9, 5],
      totalInteractions: 98, avgHandleTimeMin: 6.7, repeatContactRate: 22, escalationRate: 14, resolutionRate: 76,
    },
    voice: {
      callOutcomes: [ { label: 'Resolved', value: 14, color: '#00c389' }, { label: 'Transferred', value: 4, color: '#f5a623' }, { label: 'Callback', value: 3, color: '#7c3aed' }, { label: 'Abandoned', value: 2, color: '#e0463e' } ],
      sentiment:    [ { label: 'Positive', value: 9, color: '#00c389' }, { label: 'Neutral', value: 7, color: '#f5a623' }, { label: 'Negative', value: 7, color: '#e0463e' } ],
      callTypes:    [ { label: 'Inbound', value: 16, color: '#00a0d1' }, { label: 'Outbound', value: 4, color: '#a78bfa' }, { label: 'Callback', value: 3, color: '#f5a623' } ],
      volumeTrend: [5, 7, 4, 8, 6, 9, 6], ahtTrend: [312, 298, 340, 280, 315, 302, 288],
      openCases: [ { id: REF.case1, status: 'Open', topic: 'SEPA Transfer Dispute', priority: 'High', color: '#f5a623' }, { id: REF.case2, status: 'Closed', topic: 'Login Access', priority: 'Low', color: '#00a0d1' } ],
      avgHandleTimeSec: 288, slaMet: 87, csat: 4.2, totalCalls30d: 23,
    },
    chat: {
      customer: 'Sarah Johnson',
      channelMix: [ { label: 'Webchat', value: 18, color: '#00a0d1' }, { label: 'WhatsApp', value: 12, color: '#25D366' }, { label: 'SMS', value: 7, color: '#f5a623' }, { label: 'Apple Msgs', value: 5, color: '#007AFF' }, { label: 'In-App', value: 4, color: '#a78bfa' }, { label: 'RCS', value: 2, color: '#34d399' } ],
      sessionStatus: [ { label: 'Active', value: 1, color: '#00a0d1' }, { label: 'Resolved', value: 42, color: '#4ade80' }, { label: 'Transferred', value: 2, color: '#f5a623' }, { label: 'Abandoned', value: 3, color: '#e8453c' } ],
      sentiment: [ { label: 'Positive', value: 19, color: '#4ade80' }, { label: 'Neutral', value: 16, color: '#9ca3af' }, { label: 'Negative', value: 13, color: '#e8453c' } ],
      volumeTrend: [3, 4, 5, 3, 6, 2, 1], ahtTrend: [4.8, 5.2, 3.9, 6.1, 5.5, 4.2, 3.7],
      openCases: [ { id: REF.case1, status: 'In Progress', topic: 'Payment Processing', priority: 'High', color: '#f5a623' }, { id: REF.case2, status: 'Open', topic: 'Login Access', priority: 'Medium', color: '#00a0d1' }, { id: REF.case3, status: 'In Progress', topic: 'Overdraft Dispute', priority: 'High', color: '#f5a623' } ],
      totalConversations: 48, avgFirstResponseSec: 18, slaMet: 91, csat: 4.4, conversationsThisMonth: 48,
    },
    email: {
      threadStatus: [ { label: 'Active', value: 2, color: '#00a0d1' }, { label: 'Awaiting Customer', value: 1, color: '#f5a623' }, { label: 'Resolved', value: 8, color: '#4ade80' } ],
      topicMix: [ { label: 'Payment Issue', value: 5, color: '#a78bfa' }, { label: 'Account Access', value: 3, color: '#60a5fa' }, { label: 'Dispute', value: 2, color: '#f472b6' }, { label: 'General', value: 1, color: '#9ca3af' } ],
      sentiment: [ { label: 'Positive', value: 3, color: '#4ade80' }, { label: 'Neutral', value: 5, color: '#9ca3af' }, { label: 'Negative', value: 3, color: '#e8453c' } ],
      volumeTrend: [2, 1, 3, 2, 2, 1, 2], replyTimeTrend: [4.2, 3.8, 5.1, 4.7, 3.9, 4.4, 3.6],
      openCases: [ { id: REF.case1, status: 'In Progress', topic: 'Payment Processing', priority: 'High', color: '#f5a623' }, { id: REF.case2, status: 'Open', topic: 'Login Access', priority: 'Medium', color: '#00a0d1' }, { id: REF.case3, status: 'In Progress', topic: 'Overdraft Dispute', priority: 'High', color: '#f5a623' } ],
      avgFirstReplyH: 4.1, slaMet: 87, csat: 4.2, emailsThisMonth: 11, totalThreads: 11,
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
      id: REF.case1, caseId: REF.case1, status: 'in progress',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-06-03T12:00:00Z', owner: 'Agent Hoffmann', _isActive: true,
      description: `Kundin meldet wiederholten Zahlungsfehler für Rechnung #${REF.invoice} (${REF.amount}). Dritte Nachfrage in 5 Tagen. SEPA-Überweisung Ref.: ${REF.sepaRef} vom Kundenkonto belastet, aber im System nicht verbucht. Eskalation an Vorgesetzten.`,
    },
    {
      id: REF.case2, caseId: REF.case2, status: 'open',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-05-28T09:30:00Z', owner: 'Agent Krause',
      description: 'Online-Banking-Login-Fehler nach Passwort-Reset. Kundin konnte 2 Tage nicht auf ihr Konto zugreifen. Zwei-Faktor-Authentifizierung lieferte keine SMS-Codes.',
    },
    {
      id: REF.case3, caseId: REF.case3, status: 'in progress',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-05-10T14:15:00Z', owner: 'Agent Bauer',
      description: 'Kundin beanstandet Überziehungsgebühr von €45, belastet am 8. Mai. Verzögerung durch Zahlungsabwickler verursachte temporäre Saldodifferenz. Backoffice-Prüfung läuft.',
    },
    {
      id: REF.case4, caseId: REF.case4, status: 'closed',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-04-02T10:00:00Z', owner: 'Agent Weber',
      description: 'Karte während Auslandsreise in die USA gesperrt. Identität per Video-Call verifiziert. Karte innerhalb von 20 Minuten reaktiviert. Kundin zufrieden.',
    },
    {
      id: REF.case5, caseId: REF.case5, status: 'closed',
      customerName: 'Anna Müller', customerEmail: 'a.mueller@bavarian-tech.de',
      createdAt: '2025-03-15T08:45:00Z', owner: 'Agent Fischer',
      description: 'SEPA-Überweisung an Lieferanten um 3 Werktage verzögert durch AML-Prüfschwelle ausgelöst. Gelder gutgeschrieben. Kundin mit Entschuldigungsschreiben benachrichtigt.',
    },
  ],

  voice: {
    calls: [
      { id: 'call-1', active: true, customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '09:41', durationSec: 847, direction: 'inbound', queue: 'Priority Banking', caseId: REF.case1, sentiment: 'negative', outcome: null },
      { id: 'call-2', active: false, customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '2025-05-29', durationSec: 312, direction: 'outbound', queue: 'Rückruf', caseId: REF.case2, sentiment: 'positive', outcome: 'Gelöst' },
      { id: 'call-3', active: false, customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '2025-04-14', durationSec: 489, direction: 'inbound', queue: 'Allgemeines Banking', caseId: REF.case3, sentiment: 'neutral', outcome: 'Weitergeleitet' },
      { id: 'call-4', active: false, customer: 'Anna Müller', phone: '+49 89 1234 5678', started: '2025-03-01', durationSec: 228, direction: 'inbound', queue: 'Allgemeines Banking', caseId: REF.case4, sentiment: 'positive', outcome: 'Gelöst' },
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
      { id: 'conv-1', channel: 'whatsapp', active: true,  customer: 'Anna Müller', snippet: 'SEPA-Überweisung noch nicht verbucht…', time: '14 Min.', status: 'Aktiv',      caseId: REF.case1 },
      { id: 'conv-2', channel: 'webchat',  active: false, customer: 'Anna Müller', snippet: 'Login-Fehler nach Passwort-Reset…',      time: '8 Tg.',  status: 'Gelöst',     caseId: REF.case2 },
      { id: 'conv-3', channel: 'sms',      active: false, customer: 'Anna Müller', snippet: 'Überziehungsgebühr-Anfrage — €45…',      time: '26 Tg.', status: 'Gelöst',     caseId: REF.case3 },
      { id: 'conv-4', channel: 'in-app',   active: false, customer: 'Anna Müller', snippet: 'Karte in New York gesperrt, brauche Hilfe', time: '63 Tg.', status: 'Gelöst', caseId: REF.case4 },
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
  },

  history: {
    events: [
      { id: 'hist-1',  ts: ago(5 * MIN),  channel: 'email',    title: `Dringend: Rechnung #${REF.invoice} – Zahlung nicht verbucht`,  summary: `Dritte Eskalation. SEPA-Ref. ${REF.sepaRef} belastet, aber im System nicht verbucht. Rechnung und Bankbestätigung beigefügt.` },
      { id: 'hist-2',  ts: ago(3 * H),    channel: 'phone',    title: 'Eingehender Anruf – Follow-up Zahlungsabwicklung',             summary: `Kundin rief wegen ${REF.case1} nach. Nach 4 Min. Warteschleife an Zahlungs-Team weitergeleitet. Gesamtdauer: 8 Min. 22 Sek.` },
      { id: 'hist-3',  ts: ago(26 * H),   channel: 'email',    title: 'Noch kein Update. Können Sie bitte eskalieren?',               summary: 'Kundin eskaliert auf Vorgesetztenebene. Keine Lösung nach 24 Stunden seit Fallöffnung.' },
      { id: 'hist-4',  ts: ago(2 * D),    channel: 'email',    title: 'Sehr geehrte Frau Müller, wir haben Ihre Anfrage erhalten',    summary: `Support-Bestätigungs-E-Mail. Fall ${REF.case1} eröffnet. Erwartete Lösung innerhalb von 3 Werktagen.` },
      { id: 'hist-5',  ts: ago(8 * D),    channel: 'webchat',  title: 'Online-Banking-Zugriffsproblem – Webchat',                     summary: 'Kundin meldete Login-Fehler nach Passwort-Reset. 2FA SMS nicht geliefert. Problem in der Sitzung gelöst.' },
      { id: 'hist-6',  ts: ago(14 * D),   channel: 'whatsapp', title: 'Überziehungsgebühren-Streit – WhatsApp',                       summary: 'Kundin kontaktierte via WhatsApp wegen €45-Überziehungsgebühr vom 8. Mai. Gebühr als Goodwill erlassen.' },
      { id: 'hist-7',  ts: ago(21 * D),   channel: 'sms',      title: 'SMS-Bestätigung: Fall-Update',                                 summary: `Ausgehende SMS an +49 89 1234 5678 gesendet, ${REF.case3}-Eskalation bestätigt.` },
      { id: 'hist-8',  ts: ago(35 * D),   channel: 'apple',    title: 'Kontoauszug-Anfrage – Apple Messages',                         summary: 'Kundin fragte nach Klärung einer Kontoauszugsposition. Währungsumrechnungsgebühr erklärt. Kundin zufrieden.' },
      { id: 'hist-9',  ts: ago(42 * D),   channel: 'in-app',   title: 'Kreditkartenlimit-Erhöhung – In-App-Chat',                     summary: 'Kundin beantragte temporäre Kreditkartenlimit-Erhöhung auf €20.000. Nach Identitätsprüfung genehmigt.' },
      { id: 'hist-10', ts: ago(63 * D),   channel: 'phone',    title: 'Eingehender Anruf – Karte im Ausland gesperrt',               summary: 'Karte während Auslandsreise (USA) gesperrt. Identität per Video-Call verifiziert. Karte in 20 Min. reaktiviert.' },
      { id: 'hist-11', ts: ago(71 * D),   channel: 'rcs',      title: 'Reisemitteilung – RCS',                                        summary: 'Kundin sendete Reisemitteilung für USA-Reise via RCS. Karte für internationalen Einsatz freigegeben.' },
      { id: 'hist-12', ts: ago(81 * D),   channel: 'email',    title: 'SEPA-Überweisungsverzögerung – Anfrage',                       summary: 'Kundin fragte nach verzögerter Zahlung an Lieferanten. AML-Prüfschwelle ausgelöst. Gelder nach 3 Werktagen gutgeschrieben.' },
    ],
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
      { threadId: 'mock-thread-prev', subject: 'Kontozugang — gelöst', date: '12. Mai 2025', snippet: 'Vielen Dank für Ihre Hilfe, das Problem ist nun gelöst.' },
    ],
  },

  analytics: {
    cases: {
      byStatus:   [ { label: 'Offen', value: 14, color: '#f5a623' }, { label: 'In Bearbeitung', value: 9, color: '#00a0d1' }, { label: 'Gelöst', value: 22, color: '#4ade80' }, { label: 'Geschlossen', value: 31, color: '#9ca3af' } ],
      byPriority: [ { label: 'Kritisch', value: 3, color: '#e8453c' }, { label: 'Hoch', value: 11, color: '#f5a623' }, { label: 'Mittel', value: 18, color: '#00a0d1' }, { label: 'Niedrig', value: 44, color: '#9ca3af' } ],
      byCategory: [ { label: 'Zahlung', value: 19, color: '#a78bfa' }, { label: 'Konto', value: 14, color: '#60a5fa' }, { label: 'Technisch', value: 12, color: '#34d399' }, { label: 'Allgemein', value: 31, color: '#f472b6' } ],
      trend: [8, 11, 7, 14, 10, 6, 9], resolutionTrend: [18, 22, 15, 28, 19, 14, 21],
      slaBreached: 4, slaMet: 72, avgResolutionH: 19, fcr: 68, csat: 4.2, total: 76, openCount: 23,
    },
    history: {
      byChannel: [ { label: 'Telefon', value: 38, color: '#4ade80' }, { label: 'E-Mail', value: 27, color: '#a78bfa' }, { label: 'Chat', value: 19, color: '#60a5fa' }, { label: 'SMS', value: 8, color: '#f472b6' }, { label: 'Aufgabe', value: 6, color: '#fbbf24' } ],
      byOutcome: [ { label: 'Gelöst', value: 58, color: '#4ade80' }, { label: 'Eskaliert', value: 14, color: '#f5a623' }, { label: 'Ausstehend', value: 11, color: '#60a5fa' }, { label: 'Abgebrochen', value: 7, color: '#e8453c' }, { label: 'Weitergeleitet', value: 8, color: '#9ca3af' } ],
      sentiment: [ { label: 'Positiv', value: 41, color: '#4ade80' }, { label: 'Neutral', value: 34, color: '#9ca3af' }, { label: 'Negativ', value: 23, color: '#e8453c' } ],
      volumeTrend: [12, 18, 15, 22, 19, 14, 17], ahtTrend: [6.2, 7.1, 5.8, 8.4, 6.9, 5.5, 7.3],
      weekdayVolume: [21, 19, 23, 18, 22, 9, 5],
      totalInteractions: 98, avgHandleTimeMin: 6.7, repeatContactRate: 22, escalationRate: 14, resolutionRate: 76,
    },
    voice: {
      callOutcomes: [ { label: 'Gelöst', value: 14, color: '#00c389' }, { label: 'Weitergeleitet', value: 4, color: '#f5a623' }, { label: 'Rückruf', value: 3, color: '#7c3aed' }, { label: 'Abgebrochen', value: 2, color: '#e0463e' } ],
      sentiment:    [ { label: 'Positiv', value: 9, color: '#00c389' }, { label: 'Neutral', value: 7, color: '#f5a623' }, { label: 'Negativ', value: 7, color: '#e0463e' } ],
      callTypes:    [ { label: 'Eingehend', value: 16, color: '#00a0d1' }, { label: 'Ausgehend', value: 4, color: '#a78bfa' }, { label: 'Rückruf', value: 3, color: '#f5a623' } ],
      volumeTrend: [5, 7, 4, 8, 6, 9, 6], ahtTrend: [312, 298, 340, 280, 315, 302, 288],
      openCases: [ { id: REF.case1, status: 'Offen', topic: 'SEPA-Überweisungsstreit', priority: 'Hoch', color: '#f5a623' }, { id: REF.case2, status: 'Geschlossen', topic: 'Login-Zugang', priority: 'Niedrig', color: '#00a0d1' } ],
      avgHandleTimeSec: 288, slaMet: 87, csat: 4.2, totalCalls30d: 23,
    },
    chat: {
      customer: 'Anna Müller',
      channelMix: [ { label: 'Webchat', value: 18, color: '#00a0d1' }, { label: 'WhatsApp', value: 12, color: '#25D366' }, { label: 'SMS', value: 7, color: '#f5a623' }, { label: 'Apple Msgs', value: 5, color: '#007AFF' }, { label: 'In-App', value: 4, color: '#a78bfa' }, { label: 'RCS', value: 2, color: '#34d399' } ],
      sessionStatus: [ { label: 'Aktiv', value: 1, color: '#00a0d1' }, { label: 'Gelöst', value: 42, color: '#4ade80' }, { label: 'Weitergeleitet', value: 2, color: '#f5a623' }, { label: 'Abgebrochen', value: 3, color: '#e8453c' } ],
      sentiment: [ { label: 'Positiv', value: 19, color: '#4ade80' }, { label: 'Neutral', value: 16, color: '#9ca3af' }, { label: 'Negativ', value: 13, color: '#e8453c' } ],
      volumeTrend: [3, 4, 5, 3, 6, 2, 1], ahtTrend: [4.8, 5.2, 3.9, 6.1, 5.5, 4.2, 3.7],
      openCases: [ { id: REF.case1, status: 'In Bearbeitung', topic: 'Zahlungsabwicklung', priority: 'Hoch', color: '#f5a623' }, { id: REF.case2, status: 'Offen', topic: 'Login-Zugang', priority: 'Mittel', color: '#00a0d1' }, { id: REF.case3, status: 'In Bearbeitung', topic: 'Überziehungsstreit', priority: 'Hoch', color: '#f5a623' } ],
      totalConversations: 48, avgFirstResponseSec: 18, slaMet: 91, csat: 4.4, conversationsThisMonth: 48,
    },
    email: {
      threadStatus: [ { label: 'Aktiv', value: 2, color: '#00a0d1' }, { label: 'Wartet auf Kunden', value: 1, color: '#f5a623' }, { label: 'Gelöst', value: 8, color: '#4ade80' } ],
      topicMix: [ { label: 'Zahlungsproblem', value: 5, color: '#a78bfa' }, { label: 'Kontozugang', value: 3, color: '#60a5fa' }, { label: 'Streit', value: 2, color: '#f472b6' }, { label: 'Allgemein', value: 1, color: '#9ca3af' } ],
      sentiment: [ { label: 'Positiv', value: 3, color: '#4ade80' }, { label: 'Neutral', value: 5, color: '#9ca3af' }, { label: 'Negativ', value: 3, color: '#e8453c' } ],
      volumeTrend: [2, 1, 3, 2, 2, 1, 2], replyTimeTrend: [4.2, 3.8, 5.1, 4.7, 3.9, 4.4, 3.6],
      openCases: [ { id: REF.case1, status: 'In Bearbeitung', topic: 'Zahlungsabwicklung', priority: 'Hoch', color: '#f5a623' }, { id: REF.case2, status: 'Offen', topic: 'Login-Zugang', priority: 'Mittel', color: '#00a0d1' }, { id: REF.case3, status: 'In Bearbeitung', topic: 'Überziehungsstreit', priority: 'Hoch', color: '#f5a623' } ],
      avgFirstReplyH: 4.1, slaMet: 87, csat: 4.2, emailsThisMonth: 11, totalThreads: 11,
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
      id: REF.case1, caseId: REF.case1, status: 'in progress',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-06-03T12:00:00Z', owner: 'Agent Novák', _isActive: true,
      description: `Zákaznice hlásí opakované selhání platby pro fakturu #${REF.invoice} (${REF.amount}). Třetí dotaz za 5 dní. SEPA převod ref.: ${REF.sepaRef} odepsán z účtu zákaznice, ale v systému nezaúčtován. Eskalace na vedoucího.`,
    },
    {
      id: REF.case2, caseId: REF.case2, status: 'open',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-05-28T09:30:00Z', owner: 'Agent Dvořák',
      description: 'Selhání přihlášení do internetového bankovnictví po resetu hesla. Zákaznice se nemohla přihlásit 2 dny. Dvoufaktorová autentizace nedoručovala SMS kódy.',
    },
    {
      id: REF.case3, caseId: REF.case3, status: 'in progress',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-05-10T14:15:00Z', owner: 'Agent Kovář',
      description: 'Zákaznice rozporuje poplatek za kontokorent €45 účtovaný 8. května. Zpoždění platebního procesoru způsobilo dočasný nesoulad zůstatku. Přezkoumání back-office probíhá.',
    },
    {
      id: REF.case4, caseId: REF.case4, status: 'closed',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-04-02T10:00:00Z', owner: 'Agent Šimánek',
      description: 'Karta zablokována při zahraniční cestě do USA. Identita ověřena prostřednictvím video hovoru. Karta reaktivována do 20 minut. Zákaznice spokojená.',
    },
    {
      id: REF.case5, caseId: REF.case5, status: 'closed',
      customerName: 'Jana Nováková', customerEmail: 'j.novakova@praha-systems.cz',
      createdAt: '2025-03-15T08:45:00Z', owner: 'Agent Procházka',
      description: 'SEPA převod dodavateli zpožděn o 3 pracovní dny kvůli spuštění prahu AML kontroly. Prostředky připsány. Zákaznice informována s omluvným dopisem.',
    },
  ],

  voice: {
    calls: [
      { id: 'call-1', active: true, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '09:41', durationSec: 847, direction: 'inbound', queue: 'Priority Banking', caseId: REF.case1, sentiment: 'negative', outcome: null },
      { id: 'call-2', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-05-29', durationSec: 312, direction: 'outbound', queue: 'Zpětné volání', caseId: REF.case2, sentiment: 'positive', outcome: 'Vyřešeno' },
      { id: 'call-3', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-04-14', durationSec: 489, direction: 'inbound', queue: 'Obecné bankovnictví', caseId: REF.case3, sentiment: 'neutral', outcome: 'Přesměrováno' },
      { id: 'call-4', active: false, customer: 'Jana Nováková', phone: '+420 222 333 444', started: '2025-03-01', durationSec: 228, direction: 'inbound', queue: 'Obecné bankovnictví', caseId: REF.case4, sentiment: 'positive', outcome: 'Vyřešeno' },
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
      { id: 'conv-1', channel: 'whatsapp', active: true,  customer: 'Jana Nováková', snippet: 'SEPA převod stále nezaúčtován…',       time: '14 min', status: 'Aktivní',    caseId: REF.case1 },
      { id: 'conv-2', channel: 'webchat',  active: false, customer: 'Jana Nováková', snippet: 'Selhání přihlášení po resetu hesla…',  time: '8d',     status: 'Vyřešeno',   caseId: REF.case2 },
      { id: 'conv-3', channel: 'sms',      active: false, customer: 'Jana Nováková', snippet: 'Dotaz na poplatek — €45…',              time: '26d',    status: 'Vyřešeno',   caseId: REF.case3 },
      { id: 'conv-4', channel: 'in-app',   active: false, customer: 'Jana Nováková', snippet: 'Karta zablokována v New Yorku',         time: '63d',    status: 'Vyřešeno',   caseId: REF.case4 },
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
  },

  history: {
    events: [
      { id: 'hist-1',  ts: ago(5 * MIN),  channel: 'email',    title: `Urgentní: Faktura #${REF.invoice} – Platba nezaúčtována`,   summary: `Třetí eskalace. SEPA ref. ${REF.sepaRef} odepsán, ale v systému nezaúčtován. Přiložena faktura a potvrzení z banky.` },
      { id: 'hist-2',  ts: ago(3 * H),    channel: 'phone',    title: 'Příchozí hovor – sledování zpracování platby',               summary: `Zákaznice volala kvůli ${REF.case1}. Po 4 min. čekání přesměrována na platební tým. Celková délka: 8 min. 22 sek.` },
      { id: 'hist-3',  ts: ago(26 * H),   channel: 'email',    title: 'Stále žádná aktualizace. Můžete prosím eskalovat?',          summary: 'Zákaznice eskaluje na úroveň vedoucího. Žádné řešení po 24 hodinách od otevření případu.' },
      { id: 'hist-4',  ts: ago(2 * D),    channel: 'email',    title: 'Vážená paní Nováková, obdrželi jsme váš dotaz',              summary: `Potvrzovací e-mail podpory. Případ ${REF.case1} otevřen. Očekávané řešení do 3 pracovních dní.` },
      { id: 'hist-5',  ts: ago(8 * D),    channel: 'webchat',  title: 'Problém s přístupem do internetového bankovnictví – webchat', summary: 'Zákaznice nahlásila selhání přihlášení po resetu hesla. 2FA SMS nedoručena. Problém vyřešen v relaci.' },
      { id: 'hist-6',  ts: ago(14 * D),   channel: 'whatsapp', title: 'Spor o poplatek za kontokorent – WhatsApp',                  summary: 'Zákaznice kontaktovala přes WhatsApp kvůli poplatku €45 za kontokorent (8. května). Poplatek odpuštěn jako gesto dobré vůle.' },
      { id: 'hist-7',  ts: ago(21 * D),   channel: 'sms',      title: 'SMS potvrzení: aktualizace případu',                         summary: `Odchozí SMS odeslána na +420 222 333 444 potvrzující eskalaci ${REF.case3}.` },
      { id: 'hist-8',  ts: ago(35 * D),   channel: 'apple',    title: 'Dotaz k měsíčnímu výpisu – Apple Messages',                  summary: 'Zákaznice požádala o vysvětlení položky výpisu přes Apple Messages for Business. Vysvětlen poplatek za konverzi měny. Zákaznice spokojena.' },
      { id: 'hist-9',  ts: ago(42 * D),   channel: 'in-app',   title: 'Žádost o zvýšení limitu karty – In-App chat',                summary: 'Zákaznice požádala o dočasné zvýšení limitu kreditní karty na €20 000. Schváleno po ověření identity.' },
      { id: 'hist-10', ts: ago(63 * D),   channel: 'phone',    title: 'Příchozí hovor – karta zablokována v zahraničí',            summary: 'Karta zablokována při zahraniční cestě (USA). Identita ověřena přes video hovor. Karta reaktivována do 20 minut.' },
      { id: 'hist-11', ts: ago(71 * D),   channel: 'rcs',      title: 'Cestovní oznámení – RCS',                                    summary: 'Zákaznice zaslala cestovní oznámení pro cestu do USA přes RCS. Karta povolena pro mezinárodní použití.' },
      { id: 'hist-12', ts: ago(81 * D),   channel: 'email',    title: 'Dotaz ohledně zpoždění SEPA převodu',                        summary: 'Zákaznice se dotazovala na opožděnou platbu dodavateli. Spuštěn práh AML kontroly. Prostředky připsány po 3 pracovních dnech.' },
    ],
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
      { threadId: 'mock-thread-prev', subject: 'Přístup k účtu — vyřešeno', date: '12. května 2025', snippet: 'Děkuji za vaši pomoc, problém je nyní vyřešen.' },
    ],
  },

  analytics: {
    cases: {
      byStatus:   [ { label: 'Otevřený', value: 14, color: '#f5a623' }, { label: 'Probíhá', value: 9, color: '#00a0d1' }, { label: 'Vyřešený', value: 22, color: '#4ade80' }, { label: 'Uzavřený', value: 31, color: '#9ca3af' } ],
      byPriority: [ { label: 'Kritická', value: 3, color: '#e8453c' }, { label: 'Vysoká', value: 11, color: '#f5a623' }, { label: 'Střední', value: 18, color: '#00a0d1' }, { label: 'Nízká', value: 44, color: '#9ca3af' } ],
      byCategory: [ { label: 'Platby', value: 19, color: '#a78bfa' }, { label: 'Účet', value: 14, color: '#60a5fa' }, { label: 'Technické', value: 12, color: '#34d399' }, { label: 'Obecné', value: 31, color: '#f472b6' } ],
      trend: [8, 11, 7, 14, 10, 6, 9], resolutionTrend: [18, 22, 15, 28, 19, 14, 21],
      slaBreached: 4, slaMet: 72, avgResolutionH: 19, fcr: 68, csat: 4.2, total: 76, openCount: 23,
    },
    history: {
      byChannel: [ { label: 'Telefon', value: 38, color: '#4ade80' }, { label: 'E-mail', value: 27, color: '#a78bfa' }, { label: 'Chat', value: 19, color: '#60a5fa' }, { label: 'SMS', value: 8, color: '#f472b6' }, { label: 'Úkol', value: 6, color: '#fbbf24' } ],
      byOutcome: [ { label: 'Vyřešeno', value: 58, color: '#4ade80' }, { label: 'Eskalováno', value: 14, color: '#f5a623' }, { label: 'Čeká', value: 11, color: '#60a5fa' }, { label: 'Opuštěno', value: 7, color: '#e8453c' }, { label: 'Přesměrováno', value: 8, color: '#9ca3af' } ],
      sentiment: [ { label: 'Pozitivní', value: 41, color: '#4ade80' }, { label: 'Neutrální', value: 34, color: '#9ca3af' }, { label: 'Negativní', value: 23, color: '#e8453c' } ],
      volumeTrend: [12, 18, 15, 22, 19, 14, 17], ahtTrend: [6.2, 7.1, 5.8, 8.4, 6.9, 5.5, 7.3],
      weekdayVolume: [21, 19, 23, 18, 22, 9, 5],
      totalInteractions: 98, avgHandleTimeMin: 6.7, repeatContactRate: 22, escalationRate: 14, resolutionRate: 76,
    },
    voice: {
      callOutcomes: [ { label: 'Vyřešeno', value: 14, color: '#00c389' }, { label: 'Přesměrováno', value: 4, color: '#f5a623' }, { label: 'Zpětné volání', value: 3, color: '#7c3aed' }, { label: 'Opuštěno', value: 2, color: '#e0463e' } ],
      sentiment:    [ { label: 'Pozitivní', value: 9, color: '#00c389' }, { label: 'Neutrální', value: 7, color: '#f5a623' }, { label: 'Negativní', value: 7, color: '#e0463e' } ],
      callTypes:    [ { label: 'Příchozí', value: 16, color: '#00a0d1' }, { label: 'Odchozí', value: 4, color: '#a78bfa' }, { label: 'Zpětné volání', value: 3, color: '#f5a623' } ],
      volumeTrend: [5, 7, 4, 8, 6, 9, 6], ahtTrend: [312, 298, 340, 280, 315, 302, 288],
      openCases: [ { id: REF.case1, status: 'Otevřený', topic: 'Spor o SEPA převod', priority: 'Vysoká', color: '#f5a623' }, { id: REF.case2, status: 'Uzavřený', topic: 'Přístup k přihlášení', priority: 'Nízká', color: '#00a0d1' } ],
      avgHandleTimeSec: 288, slaMet: 87, csat: 4.2, totalCalls30d: 23,
    },
    chat: {
      customer: 'Jana Nováková',
      channelMix: [ { label: 'Webchat', value: 18, color: '#00a0d1' }, { label: 'WhatsApp', value: 12, color: '#25D366' }, { label: 'SMS', value: 7, color: '#f5a623' }, { label: 'Apple Msgs', value: 5, color: '#007AFF' }, { label: 'In-App', value: 4, color: '#a78bfa' }, { label: 'RCS', value: 2, color: '#34d399' } ],
      sessionStatus: [ { label: 'Aktivní', value: 1, color: '#00a0d1' }, { label: 'Vyřešeno', value: 42, color: '#4ade80' }, { label: 'Přesměrováno', value: 2, color: '#f5a623' }, { label: 'Opuštěno', value: 3, color: '#e8453c' } ],
      sentiment: [ { label: 'Pozitivní', value: 19, color: '#4ade80' }, { label: 'Neutrální', value: 16, color: '#9ca3af' }, { label: 'Negativní', value: 13, color: '#e8453c' } ],
      volumeTrend: [3, 4, 5, 3, 6, 2, 1], ahtTrend: [4.8, 5.2, 3.9, 6.1, 5.5, 4.2, 3.7],
      openCases: [ { id: REF.case1, status: 'Probíhá', topic: 'Zpracování plateb', priority: 'Vysoká', color: '#f5a623' }, { id: REF.case2, status: 'Otevřený', topic: 'Přístup k přihlášení', priority: 'Střední', color: '#00a0d1' }, { id: REF.case3, status: 'Probíhá', topic: 'Spor o kontokorent', priority: 'Vysoká', color: '#f5a623' } ],
      totalConversations: 48, avgFirstResponseSec: 18, slaMet: 91, csat: 4.4, conversationsThisMonth: 48,
    },
    email: {
      threadStatus: [ { label: 'Aktivní', value: 2, color: '#00a0d1' }, { label: 'Čeká na zákazníka', value: 1, color: '#f5a623' }, { label: 'Vyřešeno', value: 8, color: '#4ade80' } ],
      topicMix: [ { label: 'Problém s platbou', value: 5, color: '#a78bfa' }, { label: 'Přístup k účtu', value: 3, color: '#60a5fa' }, { label: 'Spor', value: 2, color: '#f472b6' }, { label: 'Obecné', value: 1, color: '#9ca3af' } ],
      sentiment: [ { label: 'Pozitivní', value: 3, color: '#4ade80' }, { label: 'Neutrální', value: 5, color: '#9ca3af' }, { label: 'Negativní', value: 3, color: '#e8453c' } ],
      volumeTrend: [2, 1, 3, 2, 2, 1, 2], replyTimeTrend: [4.2, 3.8, 5.1, 4.7, 3.9, 4.4, 3.6],
      openCases: [ { id: REF.case1, status: 'Probíhá', topic: 'Zpracování plateb', priority: 'Vysoká', color: '#f5a623' }, { id: REF.case2, status: 'Otevřený', topic: 'Přístup k přihlášení', priority: 'Střední', color: '#00a0d1' }, { id: REF.case3, status: 'Probíhá', topic: 'Spor o kontokoren', priority: 'Vysoká', color: '#f5a623' } ],
      avgFirstReplyH: 4.1, slaMet: 87, csat: 4.2, emailsThisMonth: 11, totalThreads: 11,
    },  },
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
