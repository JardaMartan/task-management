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
  }
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