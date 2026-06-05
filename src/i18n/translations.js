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
  analytics: {
    customerAnalytics: 'Customer Analytics',
  },
  voice: {
    callHistory: 'Call History',
    transcript: 'Transcript',
    live: 'LIVE',
    directionInbound: '↙ Inbound',
    directionOutbound: '↗ Outbound',
    ai: {
      summary: 'AI Summary',
      intent: 'Intent',
      suggestedActions: 'Suggested Actions',
      relatedCases: 'Related Cases',
    },
  },
  chat: {
    conversations: 'Conversations',
    interaction: 'Interaction',
    typing: 'is typing…',
    composer: {
      placeholder: 'Type a reply…',
      send: 'Send',
    },
    ai: {
      suggestedReplies: 'AI Suggested Replies',
      openCases: 'Open Cases',
    },
  },
};

const deDictionary = {
  case: {
    title: 'Fallverwaltung',
    noTask: 'Keine Aufgabendaten verfügbar.',
    unsupportedTaskType: 'Aufgabentyp {{taskType}} wird in dieser Ansicht nicht unterstützt.',
    loading: 'Falldetails werden geladen...',
    notFound: 'Für die angegebene Fall-ID wurde kein Fall gefunden.',
    fields: {
      caseId: 'Fall-ID',
      status: 'Status',
      customer: 'Kunde',
      owner: 'Bearbeiter',
      createdAt: 'Erstellt',
      assetId: 'Asset-ID',
      description: 'Beschreibung',
      notes: 'Fallnotizen',
    },
    statusValues: {
      open: 'Offen',
      inProgress: 'In Bearbeitung',
      closed: 'Geschlossen',
    },
    actions: {
      saveNotes: 'Notizen speichern',
      loadMoreHistory: 'Mehr Verlauf laden',
      showCustomerCases: 'Kundenfälle anzeigen',
      hideCustomerCases: 'Kundenfälle ausblenden',
      openCase: 'Fall öffnen',
      backToPreviousCase: 'Zurück zum vorherigen Fall',
      expandCase: 'Details erweitern',
      collapseCase: 'Details reduzieren',
    },
    customerCard: {
      title: 'Kundenkarte',
      source: 'Datenquelle: {{source}}',
      email: 'E-Mail',
      phone: 'Telefon',
      city: 'Stadt',
      country: 'Land',
    },
    related: {
      title: 'Verwandte Fälle',
      loading: 'Verwandte Fälle werden geladen...',
      empty: 'Keine verwandten Fälle für diesen Kunden gefunden.',
      created: 'Erstellt: {{value}}',
      status: 'Status: {{value}}',
      details: 'Falldetails',
    },
    history: {
      title: 'Fallverlauf',
      aiSummary: 'KI-Kundenzusammenfassung',
      empty: 'Keine Verlaufsereignisse verfügbar.',
      entry: 'Interaktion',
      customerSource: 'Kundenquelle: {{source}}',
      types: {
        task: 'Aufgabe',
        chat: 'Chat',
        email: 'E-Mail',
        phone: 'Telefon',
        call: 'Telefon',
        interaction: 'Interaktion',
      },
    },
  },
  status: {
    sdk: {
      init: { success: 'Desktop SDK initialisiert' },
      demo: 'Desktop SDK nicht verfügbar, Demo-Modus aktiv',
      initFail: 'Desktop SDK-Initialisierung fehlgeschlagen',
    },
    case: {
      loaded: 'Fall erfolgreich geladen',
      partial: 'Fall mit unvollständigen Daten geladen',
      loadFail: 'Falldetails konnten nicht geladen werden',
      notes: {
        missing: 'Kein Falldatensatz für Notizenaktualisierung ausgewählt',
        saved: 'Fallnotizen gespeichert',
        failed: 'Fallnotizen konnten nicht gespeichert werden',
      },
      status: {
        missing: 'Kein Falldatensatz für Statusaktualisierung ausgewählt',
        saved: 'Fallstatus aktualisiert',
        failed: 'Fallstatus konnte nicht aktualisiert werden',
      },
      related: {
        missingIdentity: 'Verwandte Fälle können ohne Kundenidentität nicht geladen werden',
        loadFail: 'Verwandte Fälle konnten nicht geladen werden',
        openMissingCaseId: 'Verwandter Fall kann nicht geöffnet werden, da die Fall-ID fehlt',
      },
    },
  },
  email: {
    loading: 'E-Mail wird geladen...',
    noTask: 'Keine E-Mail-Aufgabe.',
    subject: 'Betreff',
    from: 'Von',
    to: 'An',
    cc: 'CC',
    date: 'Datum',
    sentiment: {
      positive: 'Positiv',
      neutral: 'Neutral',
      negative: 'Negativ',
      urgent: 'Dringend',
    },
    thread: {
      title: 'E-Mail-Thread',
      expand: 'Erweitern',
      collapse: 'Reduzieren',
      summary: {
        show: 'KI-Zusammenfassung anzeigen',
        hide: 'Zusammenfassung ausblenden',
      },
    },
    attachments: {
      title: 'Anhänge',
      download: 'Herunterladen',
      noAttachments: 'Keine Anhänge',
    },
    ai: {
      summary: 'KI-Zusammenfassung',
      category: 'Kategorie',
      sentiment: 'Stimmung',
      confidence: 'Konfidenz',
      refresh: 'Analyse aktualisieren',
      suggestedReply: 'Vorgeschlagene Antwort',
      useReply: 'Diese Antwort verwenden',
      generating: 'Wird generiert…',
      chips: {
        label: 'Schnellstart:',
        confirm: 'Ihre Anfrage bestätigen…',
        info: 'Ich benötige weitere Informationen…',
        escalate: 'An unseren Spezialisten weiterleiten…',
      },
    },
    reply: {
      title: 'Antwort verfassen',
      send: 'Senden',
      sending: 'Wird gesendet...',
      placeholder: 'Geben Sie Ihre Antwort ein...',
      generate: 'KI generieren',
      polish: 'Entwurf verbessern',
      translate: 'Übersetzen',
      instruction: 'Anweisung für KI',
      instructionPlaceholder: 'z.B. Entschuldigen und Rabatt anbieten',
      template: 'Vorlage verwenden',
      aiOptions: 'KI-Optionen',
      generating: 'KI generiert Ihre Antwort…',
      note: {
        toggle: 'Interne Notiz',
        active: '📝 Notizmodus',
        save: 'Notiz speichern',
        hint: 'Nur für Agenten sichtbar — wird nicht an den Kunden gesendet',
      },
      undoHint: 'Senden in {n}s',
      undo: 'Rückgängig',
      shortcuts: 'Strg+Enter zum Senden',
    },
    send: {
      pending: 'E-Mail wird gesendet...',
      success: 'E-Mail erfolgreich gesendet',
      failed: 'E-Mail konnte nicht gesendet werden',
      timeout: 'Zustellung konnte nicht bestätigt werden — bitte Gesendet-Ordner prüfen',
    },
    wrapup: {
      title: 'Nachbearbeitung',
      reason: 'Nachbearbeitungsgrund',
      notes: 'Zusätzliche Notizen',
      notesPlaceholder: 'Relevante Notizen hinzufügen...',
      submit: 'Absenden & Schließen',
      cancel: 'Abbrechen',
    },
    customer: {
      title: 'Kundenverlauf',
      threads: 'E-Mail-Verlauf',
      jds: 'Interaktionszeitlinie',
      noThreads: 'Keine früheren E-Mails gefunden',
      noHistory: 'Keine Interaktionshistorie gefunden',
    },
    error: {
      tokenFetch: 'E-Mail-Zugriffstoken konnte nicht abgerufen werden',
      noWebhookUrl: 'Ausgehender Webhook nicht konfiguriert',
      wrapupFailed: 'Nachbearbeitung konnte nicht abgeschlossen werden',
    },
  },
  analytics: {
    customerAnalytics: 'Kundenanalyse',
  },
  voice: {
    callHistory: 'Anrufverlauf',
    transcript: 'Transkript',
    live: 'LIVE',
    directionInbound: '↙ Eingehend',
    directionOutbound: '↗ Ausgehend',
    ai: {
      summary: 'KI-Zusammenfassung',
      intent: 'Absicht',
      suggestedActions: 'Vorgeschlagene Aktionen',
      relatedCases: 'Verwandte Fälle',
    },
  },
  chat: {
    conversations: 'Konversationen',
    interaction: 'Interaktion',
    typing: 'tippt…',
    composer: {
      placeholder: 'Antwort eingeben…',
      send: 'Senden',
    },
    ai: {
      suggestedReplies: 'KI-Antwortvorschläge',
      openCases: 'Offene Fälle',
    },
  },
};

const csDictionary = {
  case: {
    title: 'Správa případů',
    noTask: 'Nejsou dostupná žádná data úkolu.',
    unsupportedTaskType: 'Typ úkolu {{taskType}} není v tomto zobrazení podporován.',
    loading: 'Načítám detaily případu...',
    notFound: 'Pro zadané ID případu nebyl nalezen žádný případ.',
    fields: {
      caseId: 'ID případu',
      status: 'Stav',
      customer: 'Zákazník',
      owner: 'Vlastník',
      createdAt: 'Vytvořeno',
      assetId: 'ID aktiva',
      description: 'Popis',
      notes: 'Poznámky k případu',
    },
    statusValues: {
      open: 'Otevřený',
      inProgress: 'Probíhá',
      closed: 'Uzavřený',
    },
    actions: {
      saveNotes: 'Uložit poznámky',
      loadMoreHistory: 'Načíst více historie',
      showCustomerCases: 'Zobrazit případy zákazníka',
      hideCustomerCases: 'Skrýt případy zákazníka',
      openCase: 'Otevřít případ',
      backToPreviousCase: 'Zpět na předchozí případ',
      expandCase: 'Rozbalit detaily',
      collapseCase: 'Sbalit detaily',
    },
    customerCard: {
      title: 'Karta zákazníka',
      source: 'Zdroj dat: {{source}}',
      email: 'E-mail',
      phone: 'Telefon',
      city: 'Město',
      country: 'Země',
    },
    related: {
      title: 'Související případy',
      loading: 'Načítám související případy...',
      empty: 'Pro tohoto zákazníka nebyly nalezeny žádné související případy.',
      created: 'Vytvořeno: {{value}}',
      status: 'Stav: {{value}}',
      details: 'Detaily případu',
    },
    history: {
      title: 'Historie případu',
      aiSummary: 'AI shrnutí zákazníka',
      empty: 'Nejsou dostupné žádné události z historie.',
      entry: 'Interakce',
      customerSource: 'Zdroj zákazníka: {{source}}',
      types: {
        task: 'Úkol',
        chat: 'Chat',
        email: 'E-mail',
        phone: 'Telefon',
        call: 'Telefon',
        interaction: 'Interakce',
      },
    },
  },
  status: {
    sdk: {
      init: { success: 'Desktop SDK inicializováno' },
      demo: 'Desktop SDK není k dispozici, používám demo režim',
      initFail: 'Inicializace Desktop SDK selhala',
    },
    case: {
      loaded: 'Případ úspěšně načten',
      partial: 'Případ načten s neúplnými daty',
      loadFail: 'Nepodařilo se načíst detaily případu',
      notes: {
        missing: 'Pro aktualizaci poznámek není vybrán žádný záznam případu',
        saved: 'Poznámky k případu uloženy',
        failed: 'Nepodařilo se uložit poznámky k případu',
      },
      status: {
        missing: 'Pro aktualizaci stavu není vybrán žádný záznam případu',
        saved: 'Stav případu aktualizován',
        failed: 'Nepodařilo se aktualizovat stav případu',
      },
      related: {
        missingIdentity: 'Nelze načíst související případy bez identity zákazníka',
        loadFail: 'Nepodařilo se načíst související případy',
        openMissingCaseId: 'Nelze otevřít související případ, protože chybí ID případu',
      },
    },
  },
  email: {
    loading: 'Načítám e-mail...',
    noTask: 'Žádný e-mailový úkol.',
    subject: 'Předmět',
    from: 'Od',
    to: 'Komu',
    cc: 'Kopie',
    date: 'Datum',
    sentiment: {
      positive: 'Pozitivní',
      neutral: 'Neutrální',
      negative: 'Negativní',
      urgent: 'Urgentní',
    },
    thread: {
      title: 'E-mailové vlákno',
      expand: 'Rozbalit',
      collapse: 'Sbalit',
      summary: {
        show: 'Zobrazit AI shrnutí',
        hide: 'Skrýt shrnutí',
      },
    },
    attachments: {
      title: 'Přílohy',
      download: 'Stáhnout',
      noAttachments: 'Žádné přílohy',
    },
    ai: {
      summary: 'AI shrnutí',
      category: 'Kategorie',
      sentiment: 'Nálada',
      confidence: 'Spolehlivost',
      refresh: 'Obnovit analýzu',
      suggestedReply: 'Navrhovaná odpověď',
      useReply: 'Použít tuto odpověď',
      generating: 'Generuji…',
      chips: {
        label: 'Rychlý start:',
        confirm: 'Potvrzuji váš požadavek…',
        info: 'Potřebuji více informací…',
        escalate: 'Předávám našemu specialistovi…',
      },
    },
    reply: {
      title: 'Napsat odpověď',
      send: 'Odeslat',
      sending: 'Odesílám...',
      placeholder: 'Napište svou odpověď...',
      generate: 'AI generovat',
      polish: 'Vylepšit návrh',
      translate: 'Přeložit',
      instruction: 'Instrukce pro AI',
      instructionPlaceholder: 'např. Omluvit se a nabídnout slevu',
      template: 'Použít šablonu',
      aiOptions: 'Možnosti AI',
      generating: 'AI generuje vaši odpověď…',
      note: {
        toggle: 'Interní poznámka',
        active: '📝 Režim poznámky',
        save: 'Uložit poznámku',
        hint: 'Viditelné pouze agentům — zákazníkovi se neposílá',
      },
      undoHint: 'Odesílám za {n}s',
      undo: 'Zpět',
      shortcuts: 'Ctrl+Enter pro odeslání',
    },
    send: {
      pending: 'Odesílám e-mail...',
      success: 'E-mail úspěšně odeslán',
      failed: 'Nepodařilo se odeslat e-mail',
      timeout: 'Doručení nebylo potvrzeno — zkontrolujte složku Odeslaná pošta',
    },
    wrapup: {
      title: 'Dokončení',
      reason: 'Důvod dokončení',
      notes: 'Další poznámky',
      notesPlaceholder: 'Přidejte relevantní poznámky...',
      submit: 'Odeslat a zavřít',
      cancel: 'Zrušit',
    },
    customer: {
      title: 'Historie zákazníka',
      threads: 'E-mailová historie',
      jds: 'Časová osa interakcí',
      noThreads: 'Nenalezeny žádné předchozí e-maily',
      noHistory: 'Nenalezena žádná historie interakcí',
    },
    error: {
      tokenFetch: 'Nepodařilo se získat přístupový token e-mailu',
      noWebhookUrl: 'Odchozí webhook není nakonfigurován',
      wrapupFailed: 'Nepodařilo se dokončit zpracování',
    },
  },
  analytics: {
    customerAnalytics: 'Analýza zákazníka',
  },
  voice: {
    callHistory: 'Historie hovorů',
    transcript: 'Přepis',
    live: 'ŽIVĚ',
    directionInbound: '↙ Příchozí',
    directionOutbound: '↗ Odchozí',
    ai: {
      summary: 'AI shrnutí',
      intent: 'Záměr',
      suggestedActions: 'Navrhované akce',
      relatedCases: 'Související případy',
    },
  },
  chat: {
    conversations: 'Konverzace',
    interaction: 'Interakce',
    typing: 'píše…',
    composer: {
      placeholder: 'Napište odpověď…',
      send: 'Odeslat',
    },
    ai: {
      suggestedReplies: 'Návrhy odpovědí AI',
      openCases: 'Otevřené případy',
    },
  },
};

export const translations = {
  en: baseDictionary,
  de: deDictionary,
  cs: csDictionary,
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