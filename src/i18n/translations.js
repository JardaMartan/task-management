// Translation dictionaries for supported locales
// Add new locales by extending this object with the same key structure.
const baseDictionary = {
  case: {
    title: 'Case Management',
    noTask: 'No task payload available.',
    unsupportedTaskType: 'Task type {{taskType}} is not supported in this view.',
    loading: 'Loading case details...',
    notFound: 'No case was found for the provided case ID.',
    fields: {
      caseId: 'Case ID',
      status: 'Status',
      customer: 'Customer',
      owner: 'Owner',
      createdAt: 'Created',
      assetId: 'Asset ID',
      description: 'Description',
      notes: 'Case Notes'
    },
    statusValues: {
      open: 'Open',
      inProgress: 'In Progress',
      closed: 'Closed'
    },
    actions: {
      saveNotes: 'Save Notes',
      loadMoreHistory: 'Load More History',
      showCustomerCases: 'Show Customer Cases',
      hideCustomerCases: 'Hide Customer Cases',
      openCase: 'Open Case',
      backToPreviousCase: 'Back To Previous Case',
      expandCase: 'Expand Details',
      collapseCase: 'Collapse Details'
    },
    customerCard: {
      title: 'Customer Card',
      source: 'Data source: {{source}}',
      email: 'Email',
      phone: 'Phone',
      city: 'City',
      country: 'Country'
    },
    related: {
      title: 'Related Cases',
      loading: 'Loading related cases...',
      empty: 'No related cases found for this customer.',
      created: 'Created: {{value}}',
      status: 'Status: {{value}}',
      details: 'Case Details'
    },
    history: {
      title: 'Case History',
      aiSummary: 'AI Customer Summary',
      empty: 'No history events available.',
      entry: 'Interaction',
      customerSource: 'Customer source: {{source}}',
      types: {
        task: 'Task',
        chat: 'Chat',
        email: 'Email',
        phone: 'Phone',
        call: 'Phone',
        interaction: 'Interaction'
      }
    }
  },
  status: {
    sdk: {
      init: {
        success: 'Desktop SDK initialized',
      },
      demo: 'Desktop SDK unavailable, using demo mode',
      initFail: 'Desktop SDK initialization failed',
    },
    case: {
      loaded: 'Case loaded successfully',
      partial: 'Case loaded with partial data',
      loadFail: 'Failed to load case details',
      notes: {
        missing: 'No case record selected for notes update',
        saved: 'Case notes saved',
        failed: 'Failed to save case notes',
      },
      status: {
        missing: 'No case record selected for status update',
        saved: 'Case status updated',
        failed: 'Failed to update case status',
      },
      related: {
        missingIdentity: 'Cannot load related cases without customer identity',
        loadFail: 'Failed to load related cases',
        openMissingCaseId: 'Cannot open related case because case ID is missing',
      }
    }
  },
  email: {
    loading: 'Loading email...',
    noTask: 'No email task.',
    subject: 'Subject',
    from: 'From',
    to: 'To',
    cc: 'CC',
    date: 'Date',
    sentiment: {
      positive: 'Positive',
      neutral: 'Neutral',
      negative: 'Negative',
      urgent: 'Urgent',
    },
    thread: {
      title: 'Email Thread',
      expand: 'Expand',
      collapse: 'Collapse',
      summary: {
        show: 'Show AI summary',
        hide: 'Hide summary',
      },
    },
    attachments: {
      title: 'Attachments',
      download: 'Download',
      noAttachments: 'No attachments',
    },
    ai: {
      summary: 'AI Summary',
      category: 'Category',
      sentiment: 'Sentiment',
      confidence: 'Confidence',
      refresh: 'Refresh Analysis',
      suggestedReply: 'Suggested Reply',
      useReply: 'Use this reply',
      generating: 'Generating…',
      chips: {
        label: 'Quick start:',
        confirm: 'Confirming your request…',
        info: 'I need more information…',
        escalate: 'Escalating to our specialist…',
      },
    },
    reply: {
      title: 'Compose Reply',
      send: 'Send',
      sending: 'Sending...',
      placeholder: 'Type your reply...',
      generate: 'AI Generate',
      polish: 'Polish Draft',
      translate: 'Translate',
      instruction: 'Instruction for AI',
      instructionPlaceholder: 'e.g. Apologize and offer a discount',
      template: 'Use Template',
      aiOptions: 'AI Options',
      generating: 'AI is generating your reply…',
      note: {
        toggle: 'Internal Note',
        active: '📝 Note Mode',
        save: 'Save Note',
        hint: 'Visible to agents only — not sent to customer',
      },
      undoHint: 'Sending in {n}s',
      undo: 'Undo',
      shortcuts: 'Ctrl+Enter to send',
    },
    send: {
      pending: 'Sending email...',
      success: 'Email sent successfully',
      failed: 'Failed to send email',
      timeout: 'Could not confirm delivery — please check the sent folder',
    },
    wrapup: {
      title: 'Wrap Up',
      reason: 'Wrap-up reason',
      notes: 'Additional notes',
      notesPlaceholder: 'Add any relevant notes...',
      submit: 'Submit & Close',
      cancel: 'Cancel',
    },
    customer: {
      title: 'Customer History',
      threads: 'Email History',
      jds: 'Interaction Timeline',
      noThreads: 'No previous emails found',
      noHistory: 'No interaction history found',
    },
    error: {
      tokenFetch: 'Failed to get email access token',
      noWebhookUrl: 'Outbound webhook not configured',
      wrapupFailed: 'Failed to complete wrap-up',
    },
  },
};

export const translations = {
  en: baseDictionary,
  es: baseDictionary,
  cs: baseDictionary,
  de: baseDictionary
};

export const DEFAULT_LOCALE = 'en';

/**
 * Detect browser's preferred language and return supported locale
 * @returns {string} Supported locale code (falls back to DEFAULT_LOCALE)
 */
export function detectBrowserLocale() {
  // Get browser language (e.g., 'en-US', 'es-ES', 'es')
  const browserLang = navigator.language || navigator.userLanguage;
  
  if (!browserLang) return DEFAULT_LOCALE;
  
  // Extract primary language code (e.g., 'en' from 'en-US')
  const primaryLang = browserLang.toLowerCase().split(/[-_]/)[0];
  
  // Check if we have translations for this language
  if (translations[primaryLang]) {
    return primaryLang;
  }
  
  // Fallback to default
  return DEFAULT_LOCALE;
}