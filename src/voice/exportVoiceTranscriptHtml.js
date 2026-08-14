/**
 * Generate a self-contained HTML document for a single voice call.
 * Includes metadata, AI wrap-up summary, and transcript utterances.
 */

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDuration = (sec) => {
  const n = Number.isFinite(sec) ? Math.max(0, Math.round(sec)) : 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const buildVoiceTranscriptHtml = ({
  call,
  transcript,
  summary,
  t,
  locale,
}) => {
  const safe = escapeHtml;
  const fmtDate = (value) => {
    if (!value) return '—';
    const d = Number.isFinite(value) ? new Date(value) : new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale || undefined);
  };

  const callId = safe(call?.taskId || call?.id || '');
  const customer = safe(call?.customer || t('voice.customer'));
  const phone = safe(call?.phone || '');
  const directionKey = call?.direction === 'outbound' ? 'voice.directionOutbound' : 'voice.directionInbound';
  const direction = safe(t(directionKey));
  const started = fmtDate(call?.startTime || call?.started);
  const duration = formatDuration(call?.durationSec || 0);
  const queue = safe(call?.queue || '');
  const entryPoint = safe(call?.entryPointName || '');
  const agent = safe(call?.agentName || '');
  const team = safe(call?.teamName || '');
  const site = safe(call?.siteName || '');
  const wrapUp = safe(call?.wrapUpReason || '');

  const rows = (Array.isArray(transcript) ? transcript : []).map((entry) => ({
    role: entry.role === 'agent' ? 'agent' : 'customer',
    speaker: safe(
      entry.role === 'agent'
        ? agent || t('voice.agent')
        : (entry.speaker || customer)
    ),
    time: safe(entry.time || ''),
    text: safe(entry.text || '').replace(/\n/g, '<br>'),
  }));

  const hasSummary = summary && (
    summary.initialContactReason
    || summary.keyActionsTaken
    || summary.nextSteps
    || summary.additionalContactReasons
    || summary.chosenWrapUpCode
  );

  const summaryRows = [];
  if (summary?.chosenWrapUpCode) {
    summaryRows.push({ label: safe(t('history.aiSummaryWrapUpTitle')), value: safe(summary.chosenWrapUpCode) });
  }
  if (summary?.initialContactReason) {
    summaryRows.push({ label: safe(t('history.aiSummaryReason')), value: safe(summary.initialContactReason) });
  }
  if (summary?.keyActionsTaken) {
    summaryRows.push({ label: safe(t('history.aiSummaryActions')), value: safe(summary.keyActionsTaken).replace(/\n/g, '<br>') });
  }
  if (summary?.nextSteps) {
    summaryRows.push({ label: safe(t('history.aiSummaryNextSteps')), value: safe(summary.nextSteps).replace(/\n/g, '<br>') });
  }
  if (summary?.additionalContactReasons) {
    summaryRows.push({ label: safe(t('history.aiSummaryAdditional')), value: safe(summary.additionalContactReasons) });
  }

  const sectionTitle = safe(t('voice.export.title'));
  const generatedAt = safe(t('voice.export.generatedAt'));

  const rowsHtml = rows.length
    ? rows.map((r) => `          <div class="utterance utterance--${r.role}">
            <div class="meta">
              <span class="speaker">${r.speaker}</span>
              ${r.time ? `<span class="time">${r.time}</span>` : ''}
            </div>
            <div class="bubble">${r.text}</div>
          </div>`).join('\n')
    : `          <div class="empty">${safe(t('voice.transcriptUnavailable'))}</div>`;

  const summaryHtml = summaryRows.length
    ? summaryRows.map((s) => `          <div class="summary-row">
            <div class="summary-label">${s.label}</div>
            <div class="summary-value">${s.value}</div>
          </div>`).join('\n')
    : `          <div class="empty">${safe(t('voice.summaryUnavailable'))}</div>`;

  const metadata = [
    { label: safe(t('voice.export.callId')), value: callId || '—' },
    { label: safe(t('voice.export.customer')), value: customer || '—' },
    { label: safe(t('voice.export.phone')), value: phone || '—' },
    { label: safe(t('voice.export.started')), value: started },
    { label: safe(t('voice.export.duration')), value: duration },
    { label: safe(t('voice.export.direction')), value: direction },
    queue && { label: safe(t('history.biz.queue')), value: queue },
    entryPoint && { label: safe(t('history.biz.entrypoint')), value: entryPoint },
    agent && { label: safe(t('history.biz.agent')), value: agent },
    team && { label: safe(t('history.biz.team')), value: team },
    site && { label: safe(t('history.biz.site')), value: site },
    wrapUp && { label: safe(t('history.biz.wrapUp')), value: wrapUp },
  ].filter(Boolean);

  const metadataHtml = metadata.map((m) => `        <div class="field">
          <div class="field-label">${m.label}</div>
          <div class="field-value">${m.value}</div>
        </div>`).join('\n');

  const title = safe(t('voice.export.documentTitle', { callId: callId || t('voice.callHistory') }));

  return `<!DOCTYPE html>
<html lang="${safe(locale || 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      --bg: #f4f7fa;
      --panel: #ffffff;
      --border: #dbe3ec;
      --text: #0a2236;
      --text2: #5b6b7b;
      --accent: #0e7fc1;
      --agent: #e8f4fb;
      --customer: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "CiscoSansTT", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 6px 0;
      font-size: 22px;
      font-weight: 600;
    }
    .subtitle {
      color: var(--text2);
      font-size: 13px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    h2 {
      margin: 0 0 12px 0;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--text2);
    }
    .metadata {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .field-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--text2);
      margin-bottom: 2px;
    }
    .field-value {
      font-size: 13px;
      color: var(--text);
      word-break: break-word;
    }
    .summary {
      border-left: 3px solid #6366f1;
      background: rgba(99,102,241,.05);
    }
    .summary-row + .summary-row { margin-top: 10px; }
    .summary-label {
      font-size: 11px;
      font-weight: 700;
      color: #6366f1;
      text-transform: uppercase;
      letter-spacing: .03em;
      margin-bottom: 2px;
    }
    .summary-value {
      font-size: 13px;
      white-space: pre-line;
    }
    .transcript {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .utterance { max-width: 85%; }
    .utterance--agent { align-self: flex-end; }
    .utterance--customer { align-self: flex-start; }
    .meta {
      display: flex;
      gap: 6px;
      align-items: baseline;
      margin-bottom: 3px;
      padding: 0 4px;
    }
    .utterance--agent .meta { flex-direction: row-reverse; }
    .speaker {
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
    }
    .utterance--customer .speaker { color: #007ba3; }
    .time {
      font-size: 11px;
      color: var(--text2);
    }
    .bubble {
      font-size: 13px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--customer);
    }
    .utterance--agent .bubble {
      background: var(--agent);
      border-color: rgba(14,127,193,.25);
    }
    .empty {
      color: var(--text2);
      font-style: italic;
      padding: 20px 0;
      text-align: center;
    }
    footer {
      color: var(--text2);
      font-size: 11px;
      text-align: right;
      margin-top: 8px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${sectionTitle}</h1>
      <div class="subtitle">${safe(callId)} · ${started}</div>
    </header>

    <section>
      <h2>${safe(t('voice.export.metadata'))}</h2>
      <div class="metadata">
${metadataHtml}
      </div>
    </section>

    <section class="summary">
      <h2>${safe(t('history.aiSummaryTitle'))}</h2>
${summaryHtml}
    </section>

    <section>
      <h2>${safe(t('voice.transcript'))}</h2>
      <div class="transcript">
${rowsHtml}
      </div>
    </section>

    <footer>
      ${generatedAt} ${new Date().toLocaleString(locale || undefined)}
    </footer>
  </div>
</body>
</html>`;
};

export const downloadHtml = (filename, html) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
