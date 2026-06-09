/**
 * AI Provider Factory
 * Returns a provider object with: summarize, classify, generateReply, improveText
 * Config shape: { type: 'gemini'|'openai'|'mock', apiKey, model, endpoint? }
 */

// ─── Gemini Provider ─────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Low-level Gemini generateContent call.
 * Supports two auth modes:
 *   - Bearer token (preferred, key never in browser): pass authConfig.token
 *   - API key (fallback, dev only): pass authConfig.apiKey
 */
const geminiGenerate = async (model, authConfig, prompt, extraBody = {}) => {
  const { token, apiKey } = typeof authConfig === 'string'
    ? { apiKey: authConfig, token: null }   // legacy call-site compat
    : authConfig;

  const url = token
    ? `${GEMINI_BASE}/${model}:generateContent`
    : `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey || '')}`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...extraBody,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

class GeminiProvider {
  constructor(config) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gemini-2.5-flash';
    // resolvedToken is set by the token-broker flow; takes priority over apiKey
    this.token = config.resolvedToken || null;
  }

  get auth() {
    return { token: this.token, apiKey: this.apiKey };
  }

  async summarize(threadText, historyContext) {
    const historySnippet = Array.isArray(historyContext) && historyContext.length > 0
      ? `\n\nCustomer history summary: ${historyContext.slice(0, 5).map((e) => e.type || e.eventType).join(', ')}`
      : '';

    const prompt = `You are an agent assist AI. Analyze this email thread and respond with JSON only (no markdown):
{
  "summary": "2-3 sentence summary of the customer issue",
  "category": "one of: billing, technical, account, shipping, returns, general",
  "sentiment": "one of: positive, neutral, negative, urgent",
  "confidence": 0.0-1.0 number
}

Email thread:
${threadText}${historySnippet}`;

    const text = await geminiGenerate(this.model, this.auth, prompt);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, category: null, sentiment: null, confidence: null };
    } catch {
      return { summary: text, category: null, sentiment: null, confidence: null };
    }
  }

  async classify(text, categories) {
    const catList = (categories || []).join(', ');
    const prompt = `Classify the following text into one of these categories: ${catList}.
Respond with JSON only: { "category": "chosen_category", "confidence": 0.0-1.0 }

Text: ${text}`;

    const result = await geminiGenerate(this.model, this.auth, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { category: categories[0], confidence: 0.5 };
    } catch {
      return { category: categories[0], confidence: 0.5 };
    }
  }

  async generateReply(context, instruction, tone) {
    const { thread, aiEnrichment } = context || {};
    const lastMessage = Array.isArray(thread) && thread.length > 0
      ? thread[thread.length - 1]
      : null;

    const toneGuide = tone ? `Tone: ${tone}.` : '';
    const instructionGuide = instruction ? `Additional instruction: ${instruction}` : '';
    const summaryGuide = aiEnrichment?.summary ? `Issue summary: ${aiEnrichment.summary}` : '';

    const prompt = `You are a customer service agent. Write a professional email reply.
${toneGuide} ${instructionGuide} ${summaryGuide}

Customer's last message:
${lastMessage?.bodyText || lastMessage?.snippet || '(no message content)'}

Respond with JSON only:
{
  "replyText": "plain text reply",
  "replyHtml": "<p>HTML formatted reply</p>"
}`;

    const result = await geminiGenerate(this.model, this.auth, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { replyText: result, replyHtml: `<p>${result}</p>` };
    } catch {
      return { replyText: result, replyHtml: `<p>${result}</p>` };
    }
  }

  async improveText(text, instruction, locale) {
    const langNote = locale && locale !== 'en'
      ? `The text is in language with locale "${locale}". Apply proper grammar, punctuation, and style rules for that language.`
      : '';
    const prompt = `Improve the following email reply draft. ${instruction || 'Make it more professional and clear.'}. ${langNote}
Respond with JSON only:
{
  "improvedText": "improved plain text",
  "improvedHtml": "<p>improved HTML</p>"
}

Draft:
${text}`;

    const result = await geminiGenerate(this.model, this.auth, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { improvedText: text, improvedHtml: `<p>${text}</p>` };
    } catch {
      return { improvedText: text, improvedHtml: `<p>${text}</p>` };
    }
  }

  /**
   * Fix grammar and spelling, respecting the target language.
   * Czech locale uses proper Vykání (formal address) and correct grammar cases.
   */
  async correctGrammar(html, locale) {
    const langMap = {
      cs: 'Czech (use Vykání — formal address "Vy" forms, correct grammatical cases)',
      de: 'German (use Sie — formal address, correct declension)',
      es: 'Spanish (use usted — formal)',
      en: 'English (professional)',
    };
    const langGuide = langMap[locale] || langMap.en;

    const prompt = `You are a professional email editor. Fix all grammar, spelling, and punctuation errors in the following HTML email draft.
Language: ${langGuide}
Rules:
- Preserve all HTML tags and structure
- Fix only grammar, spelling, style issues — do not change the meaning
- Maintain the author's voice

Respond with JSON only:
{
  "correctedHtml": "<p>corrected HTML content</p>",
  "changesDescription": "Brief summary of what was fixed"
}

Draft HTML:
${html}`;

    const result = await geminiGenerate(this.model, this.auth, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { correctedHtml: html, changesDescription: '' };
    } catch {
      return { correctedHtml: html, changesDescription: '' };
    }
  }

  /**
   * Proofread and return a list of specific issues for the agent to review.
   */
  async proofread(html, locale) {
    const langMap = {
      cs: 'Czech — check Vykání forms, grammar cases, diacritics',
      de: 'German — check Sie forms, declension, umlauts',
      es: 'Spanish — check usted forms, accents, punctuation',
      en: 'English — check grammar, spelling, punctuation',
    };
    const langGuide = langMap[locale] || langMap.en;

    const prompt = `You are a professional proofreader. Analyze the following email draft and identify specific issues.
Language: ${langGuide}

Respond with JSON only:
{
  "correctedHtml": "<p>fully corrected HTML</p>",
  "issues": [
    { "type": "grammar|spelling|style|tone", "original": "incorrect phrase", "suggestion": "correct phrase" }
  ]
}

Draft HTML:
${html}`;

    const result = await geminiGenerate(this.model, this.auth, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { correctedHtml: html, issues: [] };
    } catch {
      return { correctedHtml: html, issues: [] };
    }
  }

  /**
   * Generate a reply grounded in a knowledge base.
   * Tier A: Uses Gemini File Search REST API if fileSearchStoreName is provided.
   * Tier B: Injects relevant inline KB articles into the context window.
   * Tier C: Falls back to plain generateReply with no KB.
   */
  async generateGroundedReply(context, kbConfig, instruction, tone, locale) {
    const { thread, aiEnrichment, activeEmail } = context || {};
    const { kbArticles, fileSearchStoreName } = kbConfig || {};

    const lastMessage = Array.isArray(thread) && thread.length > 0
      ? thread[thread.length - 1]
      : null;

    const langMap = {
      cs: 'Czech — use Vykání, correct grammar cases, polite formal tone',
      de: 'German — use Sie, correct formal tone',
      es: 'Spanish — use usted, correct formal tone',
      en: 'English — professional',
    };
    const langGuide = langMap[locale] || langMap.en;

    const toneGuide = tone ? `Tone: ${tone}.` : '';
    const instructionGuide = instruction ? `Additional instruction: ${instruction}` : '';
    const summaryGuide = aiEnrichment?.summary ? `Issue summary: ${aiEnrichment.summary}` : '';

    const customerMessage = lastMessage?.bodyText ||
      (lastMessage?.bodyHtml ? lastMessage.bodyHtml.replace(/<[^>]+>/g, ' ') : '') ||
      lastMessage?.snippet || '(no message content)';

    // ── Tier A: Gemini File Search ───────────────────────────────────────────
    if (fileSearchStoreName) {
      const tierAUrl = this.token
        ? `${GEMINI_BASE}/${this.model}:generateContent`
        : `${GEMINI_BASE}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const tierAHeaders = { 'Content-Type': 'application/json' };
      if (this.token) tierAHeaders['Authorization'] = `Bearer ${this.token}`;
      const prompt = `You are a customer service agent. Write a professional email reply grounded in the knowledge base.\nLanguage: ${langGuide}. ${toneGuide} ${instructionGuide} ${summaryGuide}\n\nCustomer's message:\n${customerMessage}\n\nUse the knowledge base to provide accurate, policy-compliant information.\nReturn only the reply text, formatted as a professional email. Do not include a subject line.`;

      const response = await fetch(tierAUrl, {
        method: 'POST',
        headers: tierAHeaders,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ fileSearch: { fileSearchStoreNames: [fileSearchStoreName] } }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini File Search ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const groundingChunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .filter((c) => c.retrievedContext)
        .map((c) => ({ title: c.retrievedContext.title, uri: c.retrievedContext.uri }));

      return {
        replyText,
        replyHtml: `<p>${replyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
        sources,
      };
    }

    // ── Tier B: Inline KB articles ───────────────────────────────────────────
    let kbContext = '';
    if (Array.isArray(kbArticles) && kbArticles.length > 0) {
      const customerText = customerMessage.toLowerCase();
      const scored = kbArticles.map((art) => {
        const text = `${art.title} ${(art.tags || []).join(' ')} ${art.content}`.toLowerCase();
        const score = customerText.split(/\s+/).filter((w) => w.length > 3 && text.includes(w)).length;
        return { ...art, score };
      });
      const top = scored.sort((a, b) => b.score - a.score).slice(0, 3);
      if (top.some((a) => a.score > 0)) {
        kbContext = `\n\nRelevant knowledge base articles:\n${top.map((a) => `[${a.title}]\n${a.content}`).join('\n---\n')}`;
      }
    }

    const prompt = `You are a customer service agent. Write a professional email reply.
Language: ${langGuide}. ${toneGuide} ${instructionGuide} ${summaryGuide}${kbContext}

Customer's message:
${customerMessage}

Respond with JSON only:
{
  "replyText": "plain text reply",
  "replyHtml": "<p>HTML formatted reply</p>"
}`;

    const result = await geminiGenerate(this.model, this.auth, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { replyText: result, replyHtml: `<p>${result}</p>`, sources: [] };
    } catch {
      return { replyText: result, replyHtml: `<p>${result}</p>`, sources: [] };
    }
  }
}

// ─── OpenAI Provider ─────────────────────────────────────────────────────────

class OpenAIProvider {
  constructor(config) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o-mini';
    this.endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
  }

  async _chat(systemPrompt, userPrompt) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '{}';
  }

  async summarize(threadText, historyContext) {
    const text = await this._chat(
      'You are an agent assist AI. Always respond with valid JSON.',
      `Analyze this email thread and return JSON with keys: summary, category, sentiment, confidence.\n\n${threadText}`
    );
    try { return JSON.parse(text); } catch { return { summary: text }; }
  }

  async classify(text, categories) {
    const result = await this._chat(
      'You are a text classifier. Always respond with valid JSON.',
      `Classify into one of [${categories.join(', ')}]. Return JSON: { "category": "...", "confidence": 0.0-1.0 }.\n\nText: ${text}`
    );
    try { return JSON.parse(result); } catch { return { category: categories[0], confidence: 0.5 }; }
  }

  async generateReply(context, instruction, tone) {
    const lastMessage = (context?.thread || []).slice(-1)[0];
    const result = await this._chat(
      'You are a professional customer service agent. Always respond with valid JSON.',
      `Write a reply. Tone: ${tone || 'professional'}. ${instruction || ''}
Customer message: ${lastMessage?.bodyText || lastMessage?.snippet || ''}
Return JSON: { "replyText": "...", "replyHtml": "<p>...</p>" }`
    );
    try { return JSON.parse(result); } catch { return { replyText: result, replyHtml: `<p>${result}</p>` }; }
  }

  async improveText(text, instruction) {
    const result = await this._chat(
      'You are a professional writing assistant. Always respond with valid JSON.',
      `Improve this draft. ${instruction || 'Make it clearer and more professional.'}
Draft: ${text}
Return JSON: { "improvedText": "...", "improvedHtml": "<p>...</p>" }`
    );
    try { return JSON.parse(result); } catch { return { improvedText: text, improvedHtml: `<p>${text}</p>` }; }
  }

  async correctGrammar(html) {
    const result = await this._chat(
      'You are a professional editor. Always respond with valid JSON.',
      `Fix grammar and spelling in this HTML email draft. Preserve all HTML tags.
Draft: ${html}
Return JSON: { "correctedHtml": "...", "changesDescription": "..." }`
    );
    try { return JSON.parse(result); } catch { return { correctedHtml: html, changesDescription: '' }; }
  }

  async proofread(html) {
    const result = await this._chat(
      'You are a proofreader. Always respond with valid JSON.',
      `List grammar/spelling/style issues in this draft.
Draft: ${html}
Return JSON: { "correctedHtml": "...", "issues": [{"type":"grammar","original":"...","suggestion":"..."}] }`
    );
    try { return JSON.parse(result); } catch { return { correctedHtml: html, issues: [] }; }
  }

  async generateGroundedReply(context, kbConfig, instruction, tone) {
    return this.generateReply(context, instruction, tone);
  }
}

// ─── Mock Provider ────────────────────────────────────────────────────────────

class MockProvider {
  async summarize() {
    return {
      summary: 'Customer is requesting help with their recent order. The issue involves a delivery delay and they are requesting an update on their shipment status.',
      category: 'shipping',
      sentiment: 'neutral',
      confidence: 0.87,
      suggestedReply: null,
    };
  }

  async classify(text, categories) {
    return { category: categories[0] || 'general', confidence: 0.75 };
  }

  async generateReply(context, instruction, tone) {
    const reply = `Thank you for reaching out to us.\n\nI understand your concern and I'd be happy to help you with this matter. ${instruction ? `Regarding your request to "${instruction}": ` : ''}I will personally look into this and ensure it gets resolved as quickly as possible.\n\nPlease don't hesitate to reach out if you need any further assistance.\n\nBest regards,\nCustomer Support Team`;
    return { replyText: reply, replyHtml: `<p>${reply.replace(/\n/g, '<br>')}</p>` };
  }

  async improveText(text) {
    return {
      improvedText: `Thank you for contacting us. ${text} Please let us know if there is anything else we can assist you with.`,
      improvedHtml: `<p>Thank you for contacting us. ${text} Please let us know if there is anything else we can assist you with.</p>`,
    };
  }

  async correctGrammar(html) {
    return { correctedHtml: html, changesDescription: 'No issues found (demo mode)' };
  }

  async proofread(html) {
    return {
      correctedHtml: html,
      issues: [
        { type: 'style', original: 'reach out', suggestion: 'contact' },
        { type: 'grammar', original: 'me know', suggestion: 'us know' },
      ],
    };
  }

  async generateGroundedReply(context, kbConfig, instruction, tone) {
    const reply = `Thank you for reaching out to us.\n\nBased on our knowledge base and your enquiry, here is the information you need: Our standard policy covers this situation within 5–7 business days. ${instruction ? `Regarding: "${instruction}". ` : ''}We will process your request immediately.\n\nPlease let us know if you need further assistance.\n\nBest regards,\nCustomer Support Team`;
    return {
      replyText: reply,
      replyHtml: `<p>${reply.replace(/\n/g, '<br>')}</p>`,
      sources: [{ title: 'Standard Policy FAQ', uri: '#' }],
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * @param {string} type - 'gemini' | 'openai' | 'mock'
 * @param {object} config - { apiKey, model, endpoint? }
 * @returns {{ summarize, classify, generateReply, improveText, correctGrammar, proofread, generateGroundedReply }}
 */
export const createAiProvider = (type, config = {}) => {
  switch ((type || '').toLowerCase()) {
    case 'gemini':
      return new GeminiProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'mock':
    default:
      return new MockProvider();
  }
};
