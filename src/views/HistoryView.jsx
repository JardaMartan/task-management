import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Badge, Card, CardSection, Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import HistoryAnalyticsBar from './HistoryAnalyticsBar';
import { getMockData } from '../mock/mockData';
import { fetchInteractionSummary, fetchCustomerJdsHistory } from '../store/slices/emailSlice';
import { toggleAnalyticsOpen } from '../store/slices/widgetSlice';

// ─── Analytics computation from live JDS events ───────────────────────────

const ANALYTICS_CHANNEL_COLORS = {
  email: '#9854cb',
  voice: '#4db33d',
  call: '#4db33d',
  phone: '#4db33d',
  chat: '#007aa3',
  webchat: '#007aa3',
  whatsapp: '#25d366',
  sms: '#60a5fa',
  task: '#888888',
};

/** Normalize a raw channel string to one of the known translation keys. */
function normalizeChannel(raw) {
  const r = String(raw || 'task').toLowerCase();
  if (r.includes('email')) return 'email';
  if (r.includes('chat') || r.includes('webchat')) return 'chat';
  if (r.includes('call') || r.includes('phone') || r.includes('voice') || r.includes('telephon')) return 'voice';
  if (r.includes('whatsapp') || r === 'wa') return 'whatsapp';
  if (r.includes('sms') || r.includes('text-message') || r.includes('text message')) return 'sms';
  // Facebook Messenger before general social so it gets its own icon bucket
  if (r.includes('messenger') || r === 'fb' || r === 'facebook messenger' || r === 'fb messenger') return 'messenger';
  // Generic social-media channels
  if (r.includes('facebook') || r.includes('instagram') || r.includes('twitter') || r.includes('linkedin') ||
      r.includes('tiktok') || r.includes('youtube') || r.includes('social') || r.includes('community')) return 'social';
  // Web / browser interactions
  if (r.includes('web') || r.includes('website') || r === 'page visit' || r === 'browse') return 'web';
  if (r.includes('task') || r.includes('workitem') || r.includes('agent') || r.includes('contact')) return 'task';
  return r;
}

/**
 * Derive contact-centre analytics metrics from the flat JDS event array stored
 * in Redux state (state.email.customerHistory).  Returns an object with the same
 * shape as getMockData().analytics.history so it can be passed directly to
 * HistoryAnalyticsBar as the `data` prop.
 *
 * Returns null when there are no events yet (caller falls back to mock/demo).
 */
const computeHistoryAnalytics = (rawEvents, t) => {
  if (!rawEvents || rawEvents.length === 0) return null;

  // Group events by taskId → one entry per interaction
  const interactions = new Map();
  rawEvents.forEach((e) => {
    const taskId =
      e.taskId ||
      (e.data && e.data.taskId) ||
      null;
    if (!taskId) return;

    if (!interactions.has(taskId)) {
      interactions.set(taskId, { taskId, events: [], channel: null, direction: null, startTs: null });
    }
    const inter = interactions.get(taskId);
    inter.events.push(e);

    // Channel — prefer data.channelType over top-level channel
    if (!inter.channel) {
      const ch = String(e.data?.channelType || e.channel || e.channelType || '').toLowerCase();
      if (ch) inter.channel = ch;
    }

    // Direction
    if (!inter.direction) {
      const dir = String(e.data?.direction || e.direction || '').toUpperCase();
      if (dir) inter.direction = dir;
    }

    // Earliest event timestamp = interaction start
    const ts = e.timestamp ? Number(e.timestamp) : 0;
    if (ts > 0 && (!inter.startTs || ts < inter.startTs)) {
      inter.startTs = ts;
    }
  });

  const totalInteractions = interactions.size;
  if (totalInteractions === 0) return null;

  // ── Channel mix ──────────────────────────────────────────────────────────
  const channelCount = new Map();
  interactions.forEach(({ channel }) => {
    const ch = normalizeChannel(channel);
    channelCount.set(ch, (channelCount.get(ch) || 0) + 1);
  });
  const byChannel = Array.from(channelCount.entries()).map(([ch, count]) => ({
    key: ch,
    label: t(`analytics.channel.${ch}`) || ch.charAt(0).toUpperCase() + ch.slice(1),
    value: count,
    color: ANALYTICS_CHANNEL_COLORS[ch] || '#888888',
  }));

  // ── Outcomes ─────────────────────────────────────────────────────────────
  // Derive from event types present in each interaction group
  let resolved = 0, parked = 0, abandoned = 0;
  const handleTimesMs = [];

  interactions.forEach(({ events }) => {
    const types = new Set(events.map((e) => e.type || ''));
    const hasEnded = types.has('task:ended') || types.has('task:wrapup') || types.has('task:closed');
    const hasParked = types.has('task:parked');

    if (hasEnded) {
      resolved++;
      // AHT: time from task:connect (or task:connected) to task:ended
      const connectEvt = events.find((e) => e.type === 'task:connect' || e.type === 'task:connected');
      const endEvt = events.find((e) => e.type === 'task:ended' || e.type === 'task:wrapup' || e.type === 'task:closed');
      if (connectEvt && endEvt) {
        const ms = Number(endEvt.timestamp) - Number(connectEvt.timestamp);
        if (ms > 0) handleTimesMs.push(ms);
      }
    } else if (hasParked) {
      parked++;
    } else {
      abandoned++;
    }
  });

  const byOutcome = [
    { label: t('analytics.outcome.resolved'), value: resolved, color: '#4ade80' },
    { label: t('analytics.outcome.parked'),   value: parked,   color: '#fbbf24' },
    { label: t('analytics.outcome.other'),    value: abandoned, color: '#94a3b8' },
  ].filter((o) => o.value > 0);
  if (byOutcome.length === 0) byOutcome.push({ label: t('analytics.outcome.noData'), value: 1, color: '#94a3b8' });

  // Sentiment proxy: outcome → positive/neutral/negative
  const sentiment = [
    { key: 'positive', label: t('analytics.sentimentLabels.positive'), value: resolved,  color: '#4ade80' },
    { key: 'neutral',  label: t('analytics.sentimentLabels.neutral'),  value: parked,    color: '#fbbf24' },
    { key: 'negative', label: t('analytics.sentimentLabels.negative'), value: abandoned, color: '#e8453c' },
  ].filter((s) => s.value > 0);
  if (sentiment.length === 0) sentiment.push({ key: 'noData', label: t('analytics.sentimentLabels.noData'), value: 1, color: '#94a3b8' });

  // ── Weekday distribution ─────────────────────────────────────────────────
  // Convert JS getDay() (Sun=0) → Mon=0…Sun=6
  const weekdayVolume = [0, 0, 0, 0, 0, 0, 0];
  interactions.forEach(({ startTs }) => {
    if (startTs) {
      const wd = (new Date(startTs).getDay() + 6) % 7;
      weekdayVolume[wd]++;
    }
  });

  // ── 7-day volume + AHT trend ─────────────────────────────────────────────
  const now = Date.now();
  const volumeTrend = Array(7).fill(0);
  const ahtByDay = Array(7).fill(null).map(() => []);

  interactions.forEach(({ startTs, events }) => {
    if (!startTs) return;
    const daysAgo = Math.floor((now - startTs) / 86400000);
    if (daysAgo < 0 || daysAgo >= 7) return;
    const idx = 6 - daysAgo; // idx 6 = today, 0 = 6 days ago
    volumeTrend[idx]++;

    const connectEvt = events.find((e) => e.type === 'task:connect' || e.type === 'task:connected');
    const endEvt = events.find((e) => e.type === 'task:ended' || e.type === 'task:wrapup');
    if (connectEvt && endEvt) {
      const ms = Number(endEvt.timestamp) - Number(connectEvt.timestamp);
      if (ms > 0) ahtByDay[idx].push(ms);
    }
  });

  const ahtTrend = ahtByDay.map((list) =>
    list.length > 0
      ? +(list.reduce((s, v) => s + v, 0) / list.length / 60000).toFixed(1)
      : 0
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const resolutionRate = Math.round((resolved / totalInteractions) * 100);
  const avgHandleTimeMin = handleTimesMs.length > 0
    ? +(handleTimesMs.reduce((s, v) => s + v, 0) / handleTimesMs.length / 60000).toFixed(1)
    : 0;

  // Escalation proxy: interactions that have a task:transferred event
  const escalated = [...interactions.values()].filter(({ events }) =>
    events.some((e) => String(e.type || '').includes('transfer'))
  ).length;
  const escalationRate = Math.round((escalated / totalInteractions) * 100);

  // Repeat contact: interactions beyond the first on distinct calendar days
  const distinctDays = new Set();
  interactions.forEach(({ startTs }) => {
    if (startTs) distinctDays.add(new Date(startTs).toDateString());
  });
  const repeatContactRate = totalInteractions > 1 && distinctDays.size > 0
    ? Math.round(((totalInteractions - distinctDays.size) / totalInteractions) * 100)
    : 0;

  return {
    totalInteractions,
    byChannel,
    byOutcome,
    sentiment,
    weekdayVolume,
    volumeTrend,
    ahtTrend,
    resolutionRate,
    escalationRate,
    repeatContactRate,
    avgHandleTimeMin,
  };
};

// Maps normalised channel name → Momentum icon name.
// Covers all well-known Webex CC / CJDS channelType values per defaultIcons.json.
const CHANNEL_ICONS = {
  // Voice / telephony
  call: 'handset_16',
  phone: 'handset_16',
  voice: 'handset_16',
  // Digital messaging
  email: 'email_16',
  chat: 'chat_16',
  webchat: 'chat_16',
  whatsapp: 'chat_16',
  sms: 'sms-message_16',
  rcs: 'sms-message_16',
  apple: 'chat_16',
  'in-app': 'chat_16',
  // Social / OTT channels
  messenger: 'chat_16',        // Facebook Messenger
  social: 'contact-group_16', // Twitter, Instagram, LinkedIn, Facebook, TikTok, etc.
  // Web / browser
  web: 'cursor_16',
  // Work-item / system
  task: 'tasks_16',
  case: 'tasks_16',
  system: 'workflows_16',
};

// Maps normalised channel name → Momentum badge-color token (used for dot tint).
const CHANNEL_COLOR = {
  call: 'green',
  phone: 'green',
  voice: 'green',
  email: 'purple',
  chat: 'blue',
  webchat: 'blue',
  whatsapp: 'green',
  sms: 'mint',
  rcs: 'blue',
  apple: 'blue',
  'in-app': 'violet',
  messenger: 'cobalt',
  social: 'mint',
  web: 'gray',
  task: 'pastel',
  case: 'pastel',
  system: 'mint',
};

// ── CJDS custom icon map ────────────────────────────────────────────────────
//
// Mirrors the logic of CJDS getIconData(): each entry has a regex pattern
// that is tested (case-insensitive) against uiData.iconType first, then the
// raw event type string.  Entries are tried in order; first match wins.
// icon  = Momentum icon name (passed to <Icon name={...} />)
// src   = image URL (rendered as <img> instead of <Icon>)
// color = Momentum badge color token, maps to a CSS hex via BADGE_COLOR_HEX
const CJDS_ICON_MAP = [
  { re: /^(sms|text.?message|sms.?notif)/i,                    icon: 'sms-message_16',   color: 'mint'   },
  { re: /^(telephony|voice|call|phone)$/i,                     icon: 'handset_16',       color: 'green'  },
  { re: /call.?incoming|inbound.?call|imi.?inbound/i,          icon: 'handset_16',       color: 'green'  },
  { re: /call.?outgoing|outbound.?call|imi.?outbound/i,        icon: 'handset_16',       color: 'orange' },
  { re: /^(chat|webchat|messaging|in.?app|imessage|rcs)$/i,    icon: 'chat_16',          color: 'blue'   },
  { re: /whatsapp/i,                                           icon: 'chat_16',          color: 'green'  },
  { re: /^(messenger|facebook.?messenger|fb.?messenger)$/i,    icon: 'chat_16',          color: 'cobalt' },
  { re: /^(social|facebook|instagram|twitter|linkedin|tiktok)$/i, icon: 'contact-group_16', color: 'mint' },
  { re: /^email$/i,                                            icon: 'email_16',         color: 'purple' },
  { re: /campaign/i,                                           icon: 'email_16',         color: 'purple' },
  { re: /payment|pay\b/i,                          icon: 'payment_16',        color: 'gold'   },
  { re: /survey|nps/i,                             icon: 'analysis_16',        color: 'red'    },
  { re: /feedback|review|rating/i,                 icon: 'analysis_16',        color: 'gold'   },
  { re: /page.?visit|web.?visit|website|browse/i,  icon: 'cursor_16',          color: 'gray'   },
  { re: /login|sign.?in|sign.?up|register/i,       icon: 'user_16',            color: 'gold'   },
  { re: /identify|profile/i,                       icon: 'user_16',            color: 'blue'   },
  { re: /notify|notification/i,                    icon: 'alert_16',           color: 'orange' },
  { re: /wrapup|wrap.?up/i,                        icon: 'cancel_16',          color: 'red'    },
  { re: /agent/i,                                  icon: 'headset_16',         color: 'pink'   },
  { re: /location|zip.?code|address/i,             icon: 'location_16',        color: 'cyan'   },
  { re: /task|work.?item|ticket/i,                 icon: 'tasks_16',           color: 'yellow' },
  { re: /trigger/i,                                icon: 'event_16',           color: 'violet' },
  { re: /quote|document|form/i,                    icon: 'file_16',            color: 'cobalt' },
  { re: /calendar|schedule|appointment/i,          icon: 'calendar_16',        color: 'yellow' },
  { re: /social|community/i,                       icon: 'contact-group_16',   color: 'mint'   },
  { re: /walk.?in|video/i,                         icon: 'camera-photo_16',    color: 'orange' },
];

/** Momentum badge-color token → CSS hex for dot border/icon tint. */
const BADGE_COLOR_HEX = {
  green:  '#4db33d',
  blue:   '#007aa3',
  purple: '#9854cb',
  violet: '#7c3aed',
  mint:   '#009999',
  gold:   '#b38600',
  yellow: '#ca8a04',
  red:    '#dc2626',
  orange: '#f27900',
  cyan:   '#0891b2',
  cobalt: '#004494',
  pink:   '#db2777',
  pastel: '#9ca3af',
  gray:   '#6b7280',
  grey:   '#6b7280',
};

/**
 * Resolve the icon to render for an event.  Priority order:
 *
 *  1. Custom icon from uiData.iconType (URL or keyword)
 *  2. Channel-based icon from data.channelType / data.channel (well-known Webex CC channels)
 *  3. Event-type semantic icon (e.g. "Payment", "NPS Survey", "Page Visit")
 *  4. Generic fallback
 *
 * Returns { icon, src, color }:
 *   icon  – Momentum icon name string, or null when src is set
 *   src   – image URL for <img> custom icons, or null
 *   color – Momentum badge color token (dot tint), or null
 */
const resolveEventIcon = (channel, eventType, uiIconType) => {
  // 1a. Custom icon — image URL (CJDS spec allows iconType to be a full URL)
  if (uiIconType && /^(https?:\/\/|\/\/)/i.test(uiIconType)) {
    return { icon: null, src: uiIconType, color: null };
  }
  // 1b. Custom icon — keyword match against CJDS icon map
  if (uiIconType) {
    const m = CJDS_ICON_MAP.find(({ re }) => re.test(uiIconType));
    if (m) return { icon: m.icon, src: null, color: m.color };
  }
  // 2. Channel-based icon — primary lookup for well-known Webex CC channelType values
  if (CHANNEL_ICONS[channel]) {
    return { icon: CHANNEL_ICONS[channel], src: null, color: CHANNEL_COLOR[channel] || null };
  }
  // 3. Event-type semantic — third-party / custom event names (e.g. "Payment", "Survey")
  if (eventType) {
    const m = CJDS_ICON_MAP.find(({ re }) => re.test(eventType));
    if (m) return { icon: m.icon, src: null, color: m.color };
  }
  // 4. Generic fallback
  return { icon: 'event_16', src: null, color: 'gray' };
};

/** Dot indicator beside each timeline event. Supports Momentum icons and custom images. */
const EventDot = ({ channel, icon, src, color }) => {
  const hexColor = color ? (BADGE_COLOR_HEX[color] || color) : null;
  return (
    <div
      className={`history-view__dot${color ? ' history-view__dot--custom' : ` history-view__dot--${channel}`}`}
      style={hexColor ? { '--dot-color': hexColor } : undefined}
    >
      {src
        ? <img src={src} alt="" className="history-view__dot-img" />
        : <Icon name={icon} />
      }
    </div>
  );
};

const formatDateTime = (ts, locale) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString(locale || undefined);
};

const formatRelative = (ts, locale) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(locale || undefined);
};

// Human-readable labels for Webex CC CloudEvents types
const EVENT_TYPE_LABELS = {
  'task:new':           'history.eventType.new',
  'task:connect':       'history.eventType.connecting',
  'task:connected':     'history.eventType.connected',
  'task:assigned':      'history.eventType.assigned',
  'task:parked':        'history.eventType.parked',
  'task:hold':          'history.eventType.onHold',
  'task:unhold':        'history.eventType.resumed',
  'task:wrapup':        'history.eventType.wrapup',
  'task:ended':         'history.eventType.ended',
  'task:closed':        'history.eventType.closed',
  'task:transferred':   'history.eventType.transferred',
  'agent:routed':       'history.eventType.agentRouted',
  'agent:assigned':     'history.eventType.agentAssigned',
  'contact:new':        'history.eventType.contactCreated',
  'contact:ended':      'history.eventType.contactEnded',
  'email:out':          'history.eventType.campaign',
  'email:reply-sent':   'history.eventType.replySent',
};



/**
 * Normalise a raw JDS event (from fetchJourneyEvents) or a case-history item
 * into a flat display object.  The `taskId` field is populated from all known
 * locations so that grouping can work regardless of the event type.
 */
const normalizeEvent = (e, source) => {
  const d = e.data || {};

  // Channel: explicit field first, then data.channelType, then derive from type prefix
  const rawChannel = String(
    e.channel || d.channelType || d.channel || e.channelType || e.type || source || 'task'
  ).toLowerCase();
  const channel = normalizeChannel(rawChannel);

  // taskId can live in multiple places depending on the event source
  const taskId =
    e.taskId ||
    d.taskId ||
    (e.raw && e.raw.data && e.raw.data.taskId) ||
    null;

  const typeLabel = EVENT_TYPE_LABELS[e.type] || e.type || '';

  // Campaign email detection (type email:out OR source contains 'campaign')
  const isCampaign = e.type === 'email:out' || String(e.source || '').toLowerCase().includes('campaign');
  const campaign       = isCampaign ? (d.template || d.campaignName || null) : null;
  const campaignStatus = isCampaign ? (d.status || null) : null;

  // Direction normalisation (raw event has data.direction = "INBOUND" / "OUTBOUND")
  const rawDir = String(d.direction || e.direction || '').toUpperCase();
  const direction = isCampaign ? 'outbound'
    : rawDir === 'INBOUND' ? 'inbound'
    : rawDir === 'OUTBOUND' ? 'outbound'
    : null;

  // agentName: on agent:routed events it is in data.agentName; uiData.subTitle
  // on the same event is also the agent display name
  const agentName = d.agentName
    || d.uiData?.subTitle
    || null;

  // Title: prefer human-readable uiData.title, then subject/title fields,
  // then campaign template name, then typeLabel i18n key (translated at render time)
  const title = d.uiData?.title
    || e.subject || e.title || e.summary
    || (isCampaign && campaign ? `Campaign: ${campaign}` : null)
    || typeLabel
    || channel;

  // uiData — structured display hints per JDS spec:
  //   title, subTitle, iconType, auxiliary, listItem: [{key, value}]
  const uiAuxiliary = d.uiData?.auxiliary || null;
  const uiListItems = Array.isArray(d.uiData?.listItem) ? d.uiData.listItem : null;
  const uiIconType  = d.uiData?.iconType  || null;

  // Exclude uiData from the raw data panel — rendered separately via the fields above.
  const dataForPanel = Object.fromEntries(
    Object.entries(d).filter(([k]) => k !== 'uiData')
  );

  return {
    id: e.id || `${e.timestamp || e.ts}-${e.type || channel}`,
    ts: e.timestamp || e.createdAt || e.time || e.ts,
    channel,
    title,
    eventType: String(e.type || ''),
    typeLabel,
    direction,
    queueName: d.queueName || null,
    agentName,
    origin: d.origin || null,
    destination: d.destination || null,
    summary: e.snippet || e.summary || e.outcome || '',
    details: e.details,
    taskId,
    caseId: e.caseId || d.caseId || null,
    campaign,
    campaignStatus,
    // uiData structured display fields
    auxiliary: uiAuxiliary,
    uiListItems,
    uiIconType,
    // ── Business/timing fields ────────────────────────────────────────────
    ivrDuration:  e.ivrDuration  ?? d.ivrDuration  ?? null,
    holdDuration: e.holdDuration ?? d.holdDuration ?? null,
    wrapUpCode:   e.wrapUpCode   ?? d.wrapUpCode   ?? d.wrapUpAuxCode       ?? null,
    wrapUpName:   e.wrapUpName   ?? d.wrapUpName   ?? d.wrapUpAuxCodeName   ?? null,
    endReason:    d.reason       ?? d.endReason    ?? null,
    // Raw data section — uiData key excluded (rendered via structured fields above)
    rawData: Object.keys(dataForPanel).length > 0 ? dataForPanel : null,
  };
};

// ─── Business metrics helpers ───────────────────────────────────────────────

/** Format seconds into a human-readable duration string (e.g. "2m 15s", "45s") */
const fmtSec = (s) => {
  if (!s || s <= 0) return null;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0 && rem > 0) return `${m}m ${rem}s`;
  if (m > 0) return `${m}m`;
  return `${rem}s`;
};

/**
 * Derive per-interaction business metrics from a group of normalized events.
 * Covers voice-specific phases (IVR → queue → talk → hold → wrap-up) and
 * wrapup codes available on any channel.
 */
const deriveInteractionMetrics = (events) => {
  if (!events || events.length === 0) return null;
  const channel = events[0]?.channel || 'task';
  const isVoice = ['voice', 'call', 'phone'].includes(channel);

  const sorted = [...events].sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));
  const findEvt = (type) => sorted.find((e) => e.eventType === type);
  const tsOf    = (e) => (e?.ts ? new Date(e.ts).getTime() : null);
  const secBetween = (t1, t2) => (t1 && t2 && t2 > t1) ? Math.round((t2 - t1) / 1000) : null;

  const newEvt       = findEvt('task:new');
  const connectEvt   = findEvt('task:connect');    // end of IVR / start of queue wait
  const connectedEvt = findEvt('task:connected');  // agent picks up
  const holdEvt      = findEvt('task:hold');
  const unholdEvt    = findEvt('task:unhold');
  const wrapupEvt    = findEvt('task:wrapup');
  const endedEvt     = findEvt('task:ended');

  const tsNew       = tsOf(newEvt);
  const tsConnect   = tsOf(connectEvt);
  const tsConnected = tsOf(connectedEvt);
  const tsWrapup    = tsOf(wrapupEvt);
  const tsEnded     = tsOf(endedEvt);

  // IVR: explicit field on any event takes priority; else timestamp gap new→connect
  const explicitIvr = sorted.find((e) => e.ivrDuration != null)?.ivrDuration ?? null;
  const ivrSec = isVoice
    ? (explicitIvr != null ? explicitIvr : secBetween(tsNew, tsConnect))
    : null;

  // Queue: connect→connected; fallback (new→connected) minus IVR
  const queueSec = isVoice
    ? (tsConnect
        ? secBetween(tsConnect, tsConnected)
        : (tsNew && tsConnected
            ? Math.max(0, Math.round((tsConnected - tsNew) / 1000) - (ivrSec || 0))
            : null))
    : null;

  // Hold: explicit field wins, then hold/unhold pair
  const explicitHold = sorted.find((e) => e.holdDuration != null)?.holdDuration ?? null;
  const holdSec = explicitHold != null
    ? (explicitHold > 0 ? explicitHold : null)
    : (tsOf(holdEvt) && tsOf(unholdEvt) ? secBetween(tsOf(holdEvt), tsOf(unholdEvt)) : null);

  // Talk: connected→wrapup|ended, minus hold
  const talkEnd = tsWrapup || tsEnded;
  const rawTalkSec = tsConnected && talkEnd ? secBetween(tsConnected, talkEnd) : null;
  const talkSec = rawTalkSec != null ? Math.max(0, rawTalkSec - (holdSec || 0)) : null;

  // Wrapup duration: wrapup→ended
  const wrapupDurSec = tsWrapup && tsEnded ? secBetween(tsWrapup, tsEnded) : null;

  // Wrapup name/code
  const wrapUpEvent = sorted.find((e) => e.wrapUpName || e.wrapUpCode);
  const wrapUpName  = wrapUpEvent?.wrapUpName || null;

  // Only return a non-null result when there is at least one useful field
  const hasData = ivrSec || queueSec || talkSec || holdSec || wrapupDurSec || wrapUpName;
  if (!hasData) return null;

  return { ivrSec, queueSec, talkSec, holdSec, wrapupDurSec, wrapUpName };
};

// ─── InteractionMetrics component ────────────────────────────────────────────

const InteractionMetrics = ({ metrics }) => {
  if (!metrics) return null;
  const { ivrSec, queueSec, talkSec, holdSec, wrapupDurSec, wrapUpName } = metrics;

  const chips = [];
  if (ivrSec > 0)       chips.push({ key: 'ivr',    label: 'IVR',     value: fmtSec(ivrSec)       });
  if (queueSec > 0)     chips.push({ key: 'queue',  label: 'Queue',   value: fmtSec(queueSec)     });
  if (talkSec > 0)      chips.push({ key: 'talk',   label: 'Talk',    value: fmtSec(talkSec)      });
  if (holdSec > 0)      chips.push({ key: 'hold',   label: 'Hold',    value: fmtSec(holdSec)      });
  if (wrapupDurSec > 0) chips.push({ key: 'wrapup', label: 'Wrap-up', value: fmtSec(wrapupDurSec) });

  if (chips.length === 0 && !wrapUpName) return null;

  return (
    <div className="history-view__metrics">
      {chips.map((c) => (
        <span key={c.key} className={`history-view__metric-chip history-view__metric-chip--${c.key}`}>
          <span className="history-view__metric-label">{c.label}</span>
          <span className="history-view__metric-value">{c.value}</span>
        </span>
      ))}
      {wrapUpName && (
        <span className="history-view__metric-chip history-view__metric-chip--wrapup-name">
          <span className="history-view__metric-label">Wrap-up</span>
          <span className="history-view__metric-value">{wrapUpName}</span>
        </span>
      )}
    </div>
  );
};

// ─── InteractionSummary component ──────────────────────────────────────────

const InteractionSummary = ({ summary }) => {
  if (!summary) return null;
  const { initialContactReason, keyActionsTaken, nextSteps, additionalContactReasons } = summary;
  const rows = [
    { key: 'reason',     icon: '💬', label: 'Reason',      text: initialContactReason },
    { key: 'actions',    icon: '✅',    label: 'Actions',     text: keyActionsTaken },
    { key: 'next',       icon: '➡️',    label: 'Next steps',  text: nextSteps },
    { key: 'additional', icon: '📎',    label: 'Additional',  text: additionalContactReasons },
  ].filter((r) => r.text);

  if (rows.length === 0) return null;

  return (
    <div className="history-view__interaction-summary">
      <div className="history-view__interaction-summary-header">
        <span className="history-view__interaction-summary-icon">🤖</span>
        AI Summary
      </div>
      {rows.map((r) => (
        <div key={r.key} className="history-view__interaction-summary-row">
          <span className="history-view__interaction-summary-label">{r.icon} {r.label}</span>
          <span className="history-view__interaction-summary-text">{r.text}</span>
        </div>
      ))}
    </div>
  );
};

const normalizeEvents = (caseEvents, emailEvents) => {
  const out = [];
  (caseEvents || []).forEach((e) => out.push(normalizeEvent(e, 'task')));
  (emailEvents || []).forEach((e) => out.push(normalizeEvent(e, 'email')));
  out.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
  return out;
};

/**
 * Group flat events by taskId.  Events without a taskId are kept as standalone.
 * Returns `{ groups: Map<taskId, event[]>, standalone: event[] }`
 */
const groupByTaskId = (events) => {
  const groups = new Map();
  const standalone = [];
  events.forEach((ev) => {
    if (ev.taskId) {
      if (!groups.has(ev.taskId)) groups.set(ev.taskId, []);
      groups.get(ev.taskId).push(ev);
    } else {
      standalone.push(ev);
    }
  });
  return { groups, standalone };
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Render a single data value from the event detail panel.
 * Linkifies HTTP/HTTPS URLs so agents can click through directly.
 * Nested objects are JSON-stringified as a fallback.
 */
const renderDataValue = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s && s !== '{}' && s !== '[]' ? s : null;
  }
  const s = String(v);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    return (
      <a
        href={s}
        target="_blank"
        rel="noopener noreferrer"
        className="history-view__data-link"
        onClick={(e) => e.stopPropagation()}
      >
        {s}
      </a>
    );
  }
  return s;
};

const EventRow = ({ ev }) => {
  const { t } = useI18n();
  const [dataOpen, setDataOpen] = useState(false);
  const { icon, src, color } = resolveEventIcon(ev.channel, ev.eventType, ev.uiIconType);
  const badgeColor = CHANNEL_COLOR[ev.channel] || 'pastel';
  const showMeta = ev.direction || ev.queueName || ev.agentName;
  const isCampaign = ev.eventType === 'email:out' || !!ev.campaign;
  const hasListItems = ev.uiListItems && ev.uiListItems.length > 0;
  const hasRawData   = ev.rawData && Object.keys(ev.rawData).length > 0;
  const hasData = hasListItems || hasRawData;
  // Campaign status → chip colour
  const campaignStatusColor = (() => {
    const s = String(ev.campaignStatus || '').toLowerCase();
    if (s === 'success' || s === 'delivered') return 'campaign-success';
    if (s === 'failed' || s === 'error')   return 'campaign-failed';
    return 'campaign-pending';
  })();
  const toggleData = hasData ? () => setDataOpen((o) => !o) : undefined;

  return (
    <li className={`history-view__item${isCampaign ? ' history-view__item--campaign' : ''}`}>
      <EventDot channel={ev.channel} icon={icon} src={src} color={color} />
      <div className="history-view__body">
        <div
          className={`history-view__row${hasData ? ' history-view__row--clickable' : ''}`}
          role={hasData ? 'button' : undefined}
          tabIndex={hasData ? 0 : undefined}
          aria-expanded={hasData ? dataOpen : undefined}
          onClick={toggleData}
          onKeyDown={hasData ? (e) => (e.key === 'Enter' || e.key === ' ') && toggleData() : undefined}
          style={hasData ? { cursor: 'pointer', userSelect: 'none' } : undefined}
        >
          <Badge color={badgeColor} rounded>{ev.channel}</Badge>
          {ev.typeLabel && (
            <span className="history-view__type-label">{t(ev.typeLabel)}</span>
          )}
          <span className="history-view__title">{t(ev.title)}</span>
          <span className="history-view__when" title={formatDateTime(ev.ts)}>
            {formatRelative(ev.ts)}
          </span>
          {hasData && (
            <span className={`history-view__data-toggle${dataOpen ? ' history-view__data-toggle--open' : ''}`} aria-hidden="true">
              {dataOpen ? '▲' : '▼'}
            </span>
          )}
        </div>
        {isCampaign && (
          <div className="history-view__campaign-bar">
            {ev.campaign && (
              <span className="history-view__chip history-view__chip--campaign-template">
                <Icon name="email_16" /> {ev.campaign}
              </span>
            )}
            {ev.campaignStatus && (
              <span className={`history-view__chip history-view__chip--${campaignStatusColor}`}>
                {ev.campaignStatus}
              </span>
            )}
          </div>
        )}
        {showMeta && (
          <div className="history-view__meta">
            {ev.direction && (
              <span className={`history-view__chip history-view__chip--${ev.direction}`}>
                {ev.direction === 'inbound' ? '↓' : '↑'} {ev.direction}
              </span>
            )}
            {ev.queueName && (
              <span className="history-view__chip history-view__chip--queue">
                {ev.queueName}
              </span>
            )}
            {ev.agentName && (
              <span className="history-view__chip history-view__chip--agent">
                {ev.agentName}
              </span>
            )}
            {ev.auxiliary && (
              <span className="history-view__chip history-view__chip--auxiliary">
                {ev.auxiliary}
              </span>
            )}
          </div>
        )}
        {ev.summary && <div className="history-view__summary-line">{ev.summary}</div>}
        {ev.details && <div className="history-view__details">{ev.details}</div>}
        {hasData && dataOpen && (
          <div className="history-view__data-panel">
            {/* uiData.listItem — curated, human-readable key/value pairs */}
            {hasListItems && (
              <>
                {hasRawData && (
                  <div className="history-view__data-section-label">Details</div>
                )}
                <dl className="history-view__data-grid">
                  {ev.uiListItems.map(({ key, value }, i) => {
                    const display = renderDataValue(value);
                    if (!display) return null;
                    return (
                      <div key={i} className="history-view__data-row">
                        <dt className="history-view__data-key">{key}</dt>
                        <dd className="history-view__data-val">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
              </>
            )}
            {/* Raw event data fields */}
            {hasRawData && (
              <>
                {hasListItems && (
                  <div className="history-view__data-section-label history-view__data-section-label--secondary">Raw fields</div>
                )}
                <dl className="history-view__data-grid">
                  {Object.entries(ev.rawData).map(([k, v]) => {
                    const display = renderDataValue(v);
                    if (!display) return null;
                    return (
                      <div key={k} className="history-view__data-row">
                        <dt className="history-view__data-key">{k}</dt>
                        <dd className="history-view__data-val">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

const InteractionGroup = ({ taskId, events, darkMode, defaultOpen = false, casesMap, onNavigate, mockSummary }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [caseExpanded, setCaseExpanded] = useState(false);
  const dispatch = useDispatch();
  const { t } = useI18n();
  // Live mode: select summary from redux state; demo mode: use mockSummary prop
  const reduxSummary = useSelector((s) => s.email?.interactionSummaries?.[taskId]);
  const summary = mockSummary || reduxSummary;

  // Fetch AI summary on first expand (live mode only; mockSummary guard prevents API call in demo)
  useEffect(() => {
    if (open && !mockSummary && !reduxSummary) {
      dispatch(fetchInteractionSummary(taskId));
    }
  }, [open, taskId, mockSummary, reduxSummary, dispatch]);

  const first = events[0];
  const metrics = deriveInteractionMetrics(events);
  const { icon: firstIcon, src: firstSrc, color: firstDotColor } = resolveEventIcon(first.channel, first.eventType, first.uiIconType);
  const badgeColor = CHANNEL_COLOR[first.channel] || 'pastel';
  const shortId = taskId.length > 12 ? `${taskId.substring(0, 8)}…` : taskId;

  // Derive best label — prefer a meaningful title over bare channel/type strings;
  // titles that are i18n keys (e.g. 'history.eventType.replySent') are translated via t()
  const rawLabel = events.find(
    (e) => e.title && e.title !== e.channel && e.title !== e.eventType
  )?.title;
  const label = rawLabel ? t(rawLabel) : `${first.channel} interaction`;

  // Aggregate handling metadata across all events in this interaction
  const queueName = events.find((e) => e.queueName)?.queueName;
  const agentName = events.find((e) => e.agentName)?.agentName;
  const direction = events.find((e) => e.direction)?.direction;
  const showMeta = direction || queueName || agentName;

  // Case linkage — take the first caseId found across events
  const caseId = events.find((e) => e.caseId)?.caseId || null;
  const caseData = caseId && casesMap ? casesMap.get(caseId) : null;

  return (
    <li className="history-view__item history-view__item--group">
      <EventDot channel={first.channel} icon={firstIcon} src={firstSrc} color={firstDotColor} />
      <div className="history-view__body" style={{ flex: 1 }}>
        <div
          className="history-view__row history-view__row--clickable"
          role="button"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}
          aria-expanded={open}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <Badge color={badgeColor} rounded>{first.channel}</Badge>
          <span className="history-view__title">{label}</span>
          <span className="history-view__when" title={formatDateTime(first.ts)}>
            {formatRelative(first.ts)}
          </span>
          <Badge color="pastel" rounded style={{ marginLeft: 4 }}>{events.length}</Badge>
          <span className="history-view__item-chevron">{open ? '▲' : '▼'}</span>
        </div>
        {showMeta && (
          <div className="history-view__meta">
            {direction && (
              <span className={`history-view__chip history-view__chip--${direction}`}>
                {direction === 'inbound' ? '↓' : '↑'} {direction}
              </span>
            )}
            {queueName && (
              <span className="history-view__chip history-view__chip--queue">
                {queueName}
              </span>
            )}
            {agentName && (
              <span className="history-view__chip history-view__chip--agent">
                {agentName}
              </span>
            )}
            {caseId && (
              <button
                type="button"
                className={`history-view__chip history-view__chip--case${!onNavigate && caseExpanded ? ' history-view__chip--case-active' : ''}${onNavigate ? ' history-view__chip--case-nav' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onNavigate) {
                    onNavigate('cases', { highlightCaseId: caseId });
                  } else {
                    setCaseExpanded((x) => !x);
                  }
                }}
                title={onNavigate ? `Open ${caseId} in Cases tab` : (caseData ? `${caseData.status} — ${caseData.owner || ''}` : caseId)}
              >
                📋 {caseId}{onNavigate && <span className="history-view__chip-arrow"> →</span>}
              </button>
            )}
          </div>
        )}
        <InteractionMetrics metrics={metrics} />
        <div style={{ color: 'var(--md-color-gray-50)', fontSize: '0.75rem' }}>
          {shortId}
        </div>
        {/* ── Channel jump CTA — shown only in 360-mode (onNavigate present) ── */}
        {onNavigate && ['voice', 'call', 'phone'].includes(first.channel) && (
          <button type="button" className="history-view__view-cta" onClick={() => onNavigate('voice', { taskId })}>
            Open call transcript →
          </button>
        )}
        {onNavigate && first.channel === 'email' && (
          <button type="button" className="history-view__view-cta" onClick={() => onNavigate('email', { taskId })}>
            Open email →
          </button>
        )}
        {onNavigate && ['chat', 'whatsapp', 'sms', 'in-app', 'rcs'].includes(first.channel) && (
          <button type="button" className="history-view__view-cta" onClick={() => onNavigate('chat', { taskId })}>
            Open chat →
          </button>
        )}
        {/* ── Inline case details panel — shown only in standalone (no onNavigate) ── */}
        {!onNavigate && caseExpanded && caseId && (
          <div className="history-view__case-panel">
            <div className="history-view__case-panel-row">
              <span className="history-view__case-panel-id">{caseId}</span>
              {caseData?.status && (
                <span className={`history-view__case-status history-view__case-status--${(caseData.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                  {caseData.status}
                </span>
              )}
              {caseData?.priority && (
                <span className="history-view__chip history-view__chip--queue" style={{ fontSize: '0.7rem' }}>
                  {caseData.priority}
                </span>
              )}
            </div>
            {caseData?.owner && (
              <div className="history-view__case-panel-meta">Owner: {caseData.owner}</div>
            )}
            {caseData?.description && (
              <div className="history-view__case-panel-desc">
                {caseData.description.length > 160
                  ? `${caseData.description.substring(0, 160)}…`
                  : caseData.description}
              </div>
            )}
            {!caseData && (
              <div className="history-view__case-panel-meta" style={{ fontStyle: 'italic', opacity: 0.6 }}>
                Case details not available in live mode
              </div>
            )}
          </div>
        )}
        {open && (
          <ol className="history-view__sub-timeline" style={{ marginTop: 8, paddingLeft: 0 }}>
            <InteractionSummary summary={summary} />
            {events.map((ev) => (
              <EventRow key={ev.id} ev={ev} />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
};

// ─── Calendar view ───────────────────────────────────────────────────────────

// ─── Channel badge system (letter + color, used in calendar cells) ───────────

const CHANNEL_BADGE = {
  email:   { letter: 'E', hex: '#9854cb' },
  voice:   { letter: 'V', hex: '#16a34a' },
  call:    { letter: 'V', hex: '#16a34a' },
  phone:   { letter: 'V', hex: '#16a34a' },
  chat:    { letter: 'C', hex: '#0076d6' },
  webchat: { letter: 'C', hex: '#0076d6' },
  whatsapp:{ letter: 'W', hex: '#25d366' },
  sms:     { letter: 'S', hex: '#0891b2' },
  rcs:     { letter: 'S', hex: '#0891b2' },
  task:    { letter: 'T', hex: '#6b7280' },
  case:    { letter: 'T', hex: '#6b7280' },
};

const ChannelBadge = ({ channel, count }) => {
  const cfg = CHANNEL_BADGE[channel] || { letter: channel[0]?.toUpperCase() || '?', hex: '#888' };
  return (
    <span
      className="history-cal-badge"
      style={{ background: cfg.hex }}
      title={`${count} ${channel}`}
    >
      {cfg.letter}{count > 1 && <sup>{count}</sup>}
    </span>
  );
};

// ─── Calendar view ───────────────────────────────────────────────────────────

const buildCalendarMap = (timelineItems) => {
  const map = new Map();
  timelineItems.forEach((item) => {
    const ts = item.ts;
    if (!ts) return;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};

const CalendarView = ({ timelineItems, groups, darkMode, onOpenTimeline, t, locale }) => {
  const [cursor, setCursor] = useState(() => {
    const latest = timelineItems[0]?.ts;
    const d = latest ? new Date(latest) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);

  const calMap = useMemo(() => buildCalendarMap(timelineItems), [timelineItems]);

  // Derive the range of years that have data, plus current year as minimum
  const dataYears = useMemo(() => {
    const ySet = new Set([new Date().getFullYear()]);
    timelineItems.forEach(({ ts }) => {
      if (ts) ySet.add(new Date(ts).getFullYear());
    });
    const sorted = [...ySet].sort((a, b) => a - b);
    // Include one year before and after the data range for navigation headroom
    return Array.from(
      { length: sorted[sorted.length - 1] - sorted[0] + 1 },
      (_, i) => sorted[0] + i,
    );
  }, [timelineItems]);

  // Localized month names (Jan–Dec)
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleString(locale || undefined, { month: 'long' })
    ),
    [locale],
  );

  const { year, month } = cursor;
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthLabel = firstDay.toLocaleString(locale || undefined, { month: 'long', year: 'numeric' });

  const weekdayLabels = [
    t('analytics.weekday.mon'), t('analytics.weekday.tue'), t('analytics.weekday.wed'),
    t('analytics.weekday.thu'), t('analytics.weekday.fri'), t('analytics.weekday.sat'),
    t('analytics.weekday.sun'),
  ];

  // Heatmap: find max interactions in any day of this month for scaling
  const maxCount = useMemo(() => {
    let max = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cnt = calMap.get(key)?.length || 0;
      if (cnt > max) max = cnt;
    }
    return max;
  }, [calMap, year, month, daysInMonth]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { setCursor(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 }); setSelectedDay(null); setExpandedTask(null); };
  const nextMonth = () => { setCursor(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 }); setSelectedDay(null); setExpandedTask(null); };
  const setMonth = (m) => { setCursor((c) => ({ ...c, month: Number(m) })); setSelectedDay(null); setExpandedTask(null); };
  const setYear  = (y) => { setCursor((c) => ({ ...c, year:  Number(y) })); setSelectedDay(null); setExpandedTask(null); };
  const dayKey = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const selectedItems = selectedDay ? (calMap.get(selectedDay) || []) : [];

  return (
    <div className={`history-calendar${darkMode ? ' md--dark' : ''}`}>
      {/* ── Month navigation ── */}
      <div className="history-calendar__nav">
        <button type="button" className="history-calendar__nav-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <div className="history-calendar__selects">
          <select
            className="history-calendar__select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Month"
          >
            {monthNames.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          <select
            className="history-calendar__select"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Year"
          >
            {dataYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button type="button" className="history-calendar__nav-btn" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      {/* ── Heatmap legend ── */}
      {maxCount > 0 && (
        <div className="history-calendar__legend">
          <span className="history-calendar__legend-label">0</span>
          <span className="history-cal-heat history-cal-heat--1" />
          <span className="history-cal-heat history-cal-heat--2" />
          <span className="history-cal-heat history-cal-heat--3" />
          <span className="history-cal-heat history-cal-heat--4" />
          <span className="history-calendar__legend-label">{maxCount}</span>
        </div>
      )}

      {/* ── Weekday header + grid ── */}
      <div className="history-calendar__grid">
        {weekdayLabels.map((wd) => (
          <div key={wd} className="history-calendar__weekday">{wd}</div>
        ))}

        {cells.map((d, i) => {
          if (d === null) return <div key={`pad-${i}`} className="history-calendar__cell history-calendar__cell--pad" />;
          const key = dayKey(d);
          const items = calMap.get(key) || [];
          const count = items.length;
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;

          // Aggregate channel counts for this day
          const channelCounts = {};
          items.forEach((it) => {
            const ch = it.type === 'group' ? (it.events[0]?.channel || 'task') : (it.ev?.channel || 'task');
            channelCounts[ch] = (channelCounts[ch] || 0) + 1;
          });
          // Sort channels: most frequent first, max 3 shown
          const sortedChannels = Object.entries(channelCounts)
            .sort((a, b) => b[1] - a[1]);
          const visibleChannels = sortedChannels.slice(0, 3);
          const hiddenCount = count - visibleChannels.reduce((s, [, n]) => s + n, 0);

          // Heatmap intensity: 4 levels based on count relative to max
          const intensity = maxCount > 0 ? Math.ceil((count / maxCount) * 4) : 0;
          // Dominant channel color for heatmap tint
          const dominantCh = sortedChannels[0]?.[0] || 'task';
          const dominantHex = (CHANNEL_BADGE[dominantCh] || CHANNEL_BADGE.task).hex;
          const heatStyle = count > 0 ? {
            '--cal-heat-color': dominantHex,
            '--cal-heat-opacity': [0, 0.08, 0.14, 0.22, 0.32][intensity],
          } : {};

          return (
            <div
              key={key}
              className={`history-calendar__cell${count ? ' history-calendar__cell--has-events' : ''}${isToday ? ' history-calendar__cell--today' : ''}${isSelected ? ' history-calendar__cell--selected' : ''}`}
              style={heatStyle}
              role={count ? 'button' : undefined}
              tabIndex={count ? 0 : -1}
              onClick={() => {
                if (!count) return;
                const next = isSelected ? null : key;
                setSelectedDay(next);
                if (next) {
                  const firstItem = items[0];
                  const id = firstItem?.type === 'group'
                    ? firstItem.taskId
                    : (firstItem?.ev?.taskId || firstItem?.ev?.id);
                  if (id) onOpenTimeline(id);
                }
              }}
              onKeyDown={(e) => {
                if (!count || (e.key !== 'Enter' && e.key !== ' ')) return;
                const next = isSelected ? null : key;
                setSelectedDay(next);
                if (next) {
                  const firstItem = items[0];
                  const id = firstItem?.type === 'group'
                    ? firstItem.taskId
                    : (firstItem?.ev?.taskId || firstItem?.ev?.id);
                  if (id) onOpenTimeline(id);
                }
              }}
              aria-pressed={isSelected || undefined}
            >
              {/* Heatmap background overlay */}
              {count > 0 && (
                <span
                  className="history-calendar__heat-bg"
                  style={{ background: dominantHex, opacity: 'var(--cal-heat-opacity)' }}
                />
              )}
              <span className="history-calendar__day-num">{d}</span>
              {count > 0 && (
                <div className="history-calendar__badges">
                  {visibleChannels.map(([ch, n]) => (
                    <ChannelBadge key={ch} channel={ch} count={n} />
                  ))}
                  {hiddenCount > 0 && (
                    <span className="history-cal-badge history-cal-badge--more">+{hiddenCount}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Day detail panel ── */}
      {selectedDay && selectedItems.length > 0 && (
        <div className="history-calendar__day-panel">
          <div className="history-calendar__day-panel-header">
            <span>{new Date(selectedDay + 'T12:00:00').toLocaleDateString(locale || undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="history-calendar__day-count">{selectedItems.length} interaction{selectedItems.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              className="history-calendar__day-panel-close"
              onClick={() => { setSelectedDay(null); setExpandedTask(null); }}
              aria-label="Close"
            >×</button>
          </div>

          <ol className="history-calendar__day-list">
            {selectedItems.map((item) => {
              const isGroup = item.type === 'group';
              const taskId = isGroup ? item.taskId : item.ev?.taskId;
              const first = isGroup ? item.events[0] : item.ev;
              const channel = first?.channel || 'task';
              const color = CHANNEL_COLOR[channel] || 'pastel';
              const rawCalLabel = isGroup
                ? item.events.find((e) => e.title && e.title !== e.channel && e.title !== e.eventType)?.title
                : item.ev?.title;
              const label = rawCalLabel ? t(rawCalLabel) : (isGroup ? `${channel} interaction` : channel);
              const isExpanded = expandedTask === (taskId || item.ev?.id);
              const itemKey = taskId || item.ev?.id;

              // Format time as HH:MM for the detail panel
              const timeStr = first?.ts ? new Date(first.ts).toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <li key={itemKey} className="history-calendar__day-item">
                  <div
                    className="history-calendar__day-item-header"
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedTask(isExpanded ? null : itemKey)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpandedTask(isExpanded ? null : itemKey)}
                    aria-expanded={isExpanded}
                  >
                    <ChannelBadge channel={channel} count={isGroup ? item.events.length : 1} />
                    <span className="history-calendar__item-label">{label}</span>
                    <span className="history-calendar__item-time">{timeStr}</span>
                    <span className="history-calendar__item-chevron">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="history-calendar__day-item-detail">
                      {/* Metadata chips */}
                      {(first?.direction || first?.queueName || first?.agentName) && (
                        <div className="history-view__meta" style={{ marginBottom: 6 }}>
                          {first.direction && (
                            <span className={`history-view__chip history-view__chip--${first.direction}`}>
                              {first.direction === 'inbound' ? '↓' : '↑'} {first.direction}
                            </span>
                          )}
                          {first.queueName && (
                            <span className="history-view__chip history-view__chip--queue">{first.queueName}</span>
                          )}
                          {first.agentName && (
                            <span className="history-view__chip history-view__chip--agent">{first.agentName}</span>
                          )}
                        </div>
                      )}
                      {/* Event sub-list for groups */}
                      {isGroup && (
                        <ol className="history-calendar__sub-list">
                          {item.events.map((ev) => (
                            <li key={ev.id} className="history-calendar__sub-item">
                              <span className="history-view__type-label">{t(ev.typeLabel) || ev.eventType || ev.channel}</span>
                              <span className="history-calendar__sub-time">
                                {ev.ts ? new Date(ev.ts).toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                      <button
                        type="button"
                        className="history-calendar__open-timeline"
                        onClick={() => onOpenTimeline(taskId || itemKey)}
                      >
                        {t('history.openInTimeline') || 'Open in Timeline →'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const HistoryView = ({ darkMode, mockMode, onNavigate }) => {
  const { locale, t } = useI18n();
  const analyticsOpen = useSelector((s) => s.widget.analyticsOpen);
  const isDemoMode = Boolean(mockMode);
  const [highlightedTask, setHighlightedTask] = useState(null);
  const highlightedRef = useRef(null);

  // Mock data (locale-aware)
  const mockData = getMockData(locale);
  const MOCK_HISTORY_EVENTS = mockData.history.events;
  const MOCK_AI_SUMMARY = mockData.history.aiSummary;
  const MOCK_INTERACTION_SUMMARIES = mockData.history.interactionSummaries || {};
  // Build a Map of caseId → case object for quick lookup in demo mode
  const casesMap = useMemo(() => {
    if (!isDemoMode || !mockData.cases) return null;
    const m = new Map();
    mockData.cases.forEach((c) => { if (c.id) m.set(c.id, c); });
    return m;
  }, [isDemoMode, mockData.cases]);

  // Always call hooks (hook order must be stable)
  const dispatch     = useDispatch();
  const caseHistory  = useSelector((s) => s.widget.caseWorkflow?.visibleHistory) || [];
  const emailHistory = useSelector((s) => s.email?.customerHistory) || [];
  const reduxSummary = useSelector((s) => s.email?.aiEnrichment?.summary);
  const widgetState  = useSelector((s) => s.widget);

  // Fetch JDS history when the History tab is shown and customerHistory is empty.
  // This covers the case where the tab is the initial/only view (no EmailWidget mounted).
  useEffect(() => {
    if (isDemoMode) return;
    if (emailHistory.length > 0) return; // already loaded
    const { accesstoken, workspaceid, datacenter, task } = widgetState;
    const identity =
      task?.ani ||
      task?.displayAni ||
      task?.phoneNumber ||
      null;
    if (!identity || !accesstoken || !workspaceid) return;
    dispatch(fetchCustomerJdsHistory(identity, accesstoken, workspaceid, datacenter));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, widgetState.accesstoken, widgetState.workspaceid, widgetState.task?.interactionId]);

  // Choose data source
  const aiSummary = isDemoMode ? MOCK_AI_SUMMARY : reduxSummary;
  const events = useMemo(
    () => isDemoMode ? MOCK_HISTORY_EVENTS : normalizeEvents(caseHistory, emailHistory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDemoMode, caseHistory, emailHistory]
  );

  // Derive live analytics from JDS events; falls back to undefined → HistoryAnalyticsBar
  // uses its own mock data when in demo mode or before history has loaded.
  const liveAnalytics = useMemo(
    () => isDemoMode ? undefined : (computeHistoryAnalytics(emailHistory, t) || undefined),
    // t is stable within a locale; re-run when locale changes or new history arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDemoMode, emailHistory, locale]
  );

  // Group events by taskId so related events (e.g. task:new + task:connected +
  // task:ended for the same interaction) collapse into a single expandable card.
  const { groups, standalone } = useMemo(() => groupByTaskId(events), [events]);

  // Merge groups + standalone into a single time-ordered list for rendering
  const timelineItems = useMemo(() => {
    const items = [];
    groups.forEach((evts, taskId) => {
      const ts = evts[0]?.ts;
      items.push({ type: 'group', taskId, events: evts, ts });
    });
    standalone.forEach((ev) => items.push({ type: 'single', ev, ts: ev.ts }));
    items.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    return items;
  }, [groups, standalone]);

  const [activeFilters, setActiveFilters] = useState({ channel: null, sentiment: null });
  const analyticsRef = useRef(null);
  const handleFilterChange = useCallback(({ type, key }) => {
    setActiveFilters((f) => ({ ...f, [type]: key }));
  }, []);

  const filteredTimelineItems = useMemo(() => {
    if (!activeFilters.channel && !activeFilters.sentiment) return timelineItems;
    return timelineItems.filter((item) => {
      const evts = item.type === 'group' ? item.events : (item.ev ? [item.ev] : []);
      if (activeFilters.channel) {
        const ch = evts[0]?.channel || 'task';
        if (ch !== activeFilters.channel) return false;
      }
      if (activeFilters.sentiment) {
        const types = new Set(evts.map((e) => e?.eventType || ''));
        const hasEnded = types.has('task:ended') || types.has('task:wrapup') || types.has('task:closed');
        const hasParked = types.has('task:parked');
        const skey = hasEnded ? 'positive' : hasParked ? 'neutral' : 'negative';
        if (skey !== activeFilters.sentiment) return false;
      }
      return true;
    });
  }, [timelineItems, activeFilters]);

  // Called from CalendarView when user clicks "Open in Timeline" — just highlight
  const handleOpenTimeline = useCallback((taskId) => {
    setHighlightedTask(taskId);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedTask && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedTask]);

  // Clear highlight after a short delay so the pulse animation finishes
  useEffect(() => {
    if (!highlightedTask) return;
    const timer = setTimeout(() => setHighlightedTask(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedTask]);

  return (
    <div className={`history-view view-panel history-view--flex${darkMode ? ' md--dark' : ''}`}>

      {/* ── Fixed header ── */}
      <div className="history-view__header">
        <div ref={analyticsRef} className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
          <div
            className="analytics-collapse__toggle"
            role="button"
            tabIndex={0}
            onClick={() => dispatch(toggleAnalyticsOpen())}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && dispatch(toggleAnalyticsOpen())}
            aria-expanded={analyticsOpen}
          >
            <span className="analytics-collapse__label">{t('analytics.customerAnalytics')}</span>
              <span className="analytics-collapse__header-right">
                <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
              </span>
          </div>
          {analyticsOpen && (
            <HistoryAnalyticsBar
              darkMode={darkMode}
              data={liveAnalytics}
              onFilterChange={handleFilterChange}
              activeFilters={activeFilters}
            />
          )}
        </div>

        {aiSummary && (
          <Card className="history-view__summary" dark={darkMode}>
            <CardSection full>
              <div className="history-view__summary-label">
                {t('history.aiSummary') || 'AI summary of recent activity'}
              </div>
              <p className="history-view__summary-text">{aiSummary}</p>
            </CardSection>
          </Card>
        )}

        {/* ── Active filter indicator ── */}
        {(activeFilters.channel || activeFilters.sentiment) && (
          <div className="history-view__filter-bar">
            <span className="history-view__filter-bar__label">{t('history.filterActive') || 'Filtered:'}</span>
            {activeFilters.channel && (
              <button
                type="button"
                className="history-view__filter-chip"
                onClick={() => handleFilterChange({ type: 'channel', key: null })}
              >
                {t(`analytics.channel.${activeFilters.channel}`) || activeFilters.channel} ×
              </button>
            )}
            {activeFilters.sentiment && (
              <button
                type="button"
                className="history-view__filter-chip"
                onClick={() => handleFilterChange({ type: 'sentiment', key: null })}
              >
                {t(`analytics.sentimentLabels.${activeFilters.sentiment}`) || activeFilters.sentiment} ×
              </button>
            )}
            {activeFilters.channel && activeFilters.sentiment && (
              <button
                type="button"
                className="history-view__filter-chip history-view__filter-chip--clear"
                onClick={() => setActiveFilters({ channel: null, sentiment: null })}
              >
                {t('history.clearAll') || 'Clear all'}
              </button>
            )}
          </div>
        )}

      </div>

      {/* ── Split body: timeline left, calendar right ── */}
      <div className="history-view__split-body">
        {/* ── Timeline column ── */}
        <div className="history-view__timeline-col">
          {filteredTimelineItems.length === 0 ? (
            <Card><CardSection full>
              <div className="history-view__empty">
                {t('history.empty') || 'No interaction history yet.'}
              </div>
            </CardSection></Card>
          ) : (
            <ol className="history-view__timeline" aria-label="Customer interaction timeline">
              {filteredTimelineItems.map((item) => {
                const itemKey = item.type === 'group' ? item.taskId : item.ev.id;
                const isHighlighted = highlightedTask && (
                  (item.type === 'group' && item.taskId === highlightedTask) ||
                  (item.type === 'single' && (item.ev.taskId === highlightedTask || item.ev.id === highlightedTask))
                );
                const refProp = isHighlighted ? { ref: highlightedRef } : {};

                if (item.type === 'group') {
                  if (item.events.length === 1) {
                    return (
                      <div key={itemKey} {...refProp} className={isHighlighted ? 'history-view__highlight' : ''}>
                        <EventRow ev={item.events[0]} />
                      </div>
                    );
                  }
                  return (
                    <div key={itemKey} {...refProp} className={isHighlighted ? 'history-view__highlight' : ''}>
                      <InteractionGroup
                        taskId={item.taskId}
                        events={item.events}
                        darkMode={darkMode}
                        defaultOpen={isHighlighted}
                        casesMap={casesMap}
                        onNavigate={onNavigate}
                        mockSummary={isDemoMode ? (MOCK_INTERACTION_SUMMARIES[item.taskId] || null) : null}
                      />
                    </div>
                  );
                }
                return (
                  <div key={itemKey} {...refProp} className={isHighlighted ? 'history-view__highlight' : ''}>
                    <EventRow ev={item.ev} />
                  </div>
                );
              })}
            </ol>
          )}
        </div>

        {/* ── Calendar column ── */}
        <div className="history-view__calendar-col">
          {filteredTimelineItems.length === 0 ? (
            <div className="history-view__empty history-view__empty--cal">
              {t('history.empty') || 'No interaction history yet.'}
            </div>
          ) : (
            <CalendarView
              timelineItems={filteredTimelineItems}
              groups={groups}
              darkMode={darkMode}
              onOpenTimeline={handleOpenTimeline}
              t={t}
              locale={locale}
            />
          )}
        </div>
      </div>
    </div>
  );
};

HistoryView.propTypes = { darkMode: PropTypes.bool, mockMode: PropTypes.bool };
HistoryView.defaultProps = { darkMode: false, mockMode: false };

export default HistoryView;

