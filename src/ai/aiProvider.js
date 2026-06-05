/**
 * AI Provider Factory
 * Returns a provider object with: summarize, classify, generateReply, improveText
 * Config shape: { type: 'gemini'|'openai'|'mock', apiKey, model, endpoint? }
 */

// ─── Gemini Provider ─────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const geminiGenerate = async (model, apiKey, prompt) => {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
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
    this.model = config.model || 'gemini-1.5-flash';
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

    const text = await geminiGenerate(this.model, this.apiKey, prompt);

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

    const result = await geminiGenerate(this.model, this.apiKey, prompt);
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

    const result = await geminiGenerate(this.model, this.apiKey, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { replyText: result, replyHtml: `<p>${result}</p>` };
    } catch {
      return { replyText: result, replyHtml: `<p>${result}</p>` };
    }
  }

  async improveText(text, instruction) {
    const prompt = `Improve the following email reply draft. ${instruction || 'Make it more professional and clear.'}.
Respond with JSON only:
{
  "improvedText": "improved plain text",
  "improvedHtml": "<p>improved HTML</p>"
}

Draft:
${text}`;

    const result = await geminiGenerate(this.model, this.apiKey, prompt);
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { improvedText: text, improvedHtml: `<p>${text}</p>` };
    } catch {
      return { improvedText: text, improvedHtml: `<p>${text}</p>` };
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
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * @param {string} type - 'gemini' | 'openai' | 'mock'
 * @param {object} config - { apiKey, model, endpoint? }
 * @returns {{ summarize, classify, generateReply, improveText }}
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
