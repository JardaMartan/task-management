'use strict';

/**
 * AI enrichment for inbound emails.
 * Provider is selected via AI_PROVIDER env var: 'gemini' (default) | 'openai'
 */

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gemini-2.5-flash';

// ─── Gemini ───────────────────────────────────────────────────────────────────

const geminiEnrich = async (threadText) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${encodeURIComponent(AI_API_KEY)}`;

  const prompt = `You are a customer service AI. Analyze this inbound email and return JSON only (no markdown):
{
  "summary": "2-3 sentence summary of the customer issue",
  "category": "one of: billing, technical, account, shipping, returns, general",
  "sentiment": "one of: positive, neutral, negative, urgent",
  "confidence": 0.0-1.0,
  "suggestedReply": "optional short suggested reply (may be null)"
}

Email:
${threadText}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API ${response.status}: ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return { summary: text.slice(0, 200) };
  }
};

// ─── OpenAI ───────────────────────────────────────────────────────────────────

const openaiEnrich = async (threadText) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a customer service AI. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Analyze this email. Return JSON with: summary, category (billing/technical/account/shipping/returns/general), sentiment (positive/neutral/negative/urgent), confidence (0.0-1.0), suggestedReply (string or null).\n\nEmail:\n${threadText}`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '{}';

  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich an inbound email message with AI-generated metadata.
 * @param {{ subject, from, bodyText, snippet }} msg
 * @returns {Promise<{ summary, category, sentiment, confidence, suggestedReply }>}
 */
const enrichEmailWithAi = async (msg) => {
  if (!AI_API_KEY) {
    console.warn('[ai] AI_API_KEY not set, skipping enrichment');
    return null;
  }

  const threadText = `Subject: ${msg.subject || ''}\nFrom: ${msg.from || ''}\n\n${msg.bodyText || msg.snippet || ''}`.slice(0, 8000);

  switch (AI_PROVIDER) {
    case 'openai':
      return openaiEnrich(threadText);
    case 'gemini':
    default:
      return geminiEnrich(threadText);
  }
};

module.exports = { enrichEmailWithAi };
