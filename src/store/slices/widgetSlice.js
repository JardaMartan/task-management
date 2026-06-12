import { createSlice } from '@reduxjs/toolkit';
import {
    fetchCaseTaskContext,
    fetchCasesForCustomerFromTicketDB,
    resolveWorkspaceForTaskType,
    updateCaseNotesInTicketDB,
    updateCaseStatusInTicketDB,
} from '../../api';

// ─── Analytics UI prefs (localStorage-backed) ─────────────────────────────
const readAnalyticsPrefs = () => {
    try {
        const open = localStorage.getItem('wx_analytics_open');
        const days = parseInt(localStorage.getItem('wx_analytics_trend_days'), 10);
        return {
            analyticsOpen: open === null ? true : open === 'true',
            analyticsTrendDays: [7, 30, 90].includes(days) ? days : 30,
        };
    } catch {
        return { analyticsOpen: true, analyticsTrendDays: 30 };
    }
};
const { analyticsOpen: _initOpen, analyticsTrendDays: _initDays } = readAnalyticsPrefs();

const HISTORY_PAGE_SIZE = 15;
const DEFAULT_WORKSPACE_OVERRIDE_TASK_TYPES = ['case'];

const getTaskCaseId = (task = {}) => (
    task.caseId ||
    task.caseid ||
    task.callAssociatedData?.caseId?.value ||
    task.callAssociatedDetails?.caseId ||
    null
);

const resolveNormalizedTaskType = (task = {}) => {
    // Only check explicit task type sources, NOT task.type (which is the event type)
    const rawType = String(
        task.taskType ||
        task.callAssociatedData?.taskType?.value ||
        task.callAssociatedDetails?.taskType ||
        '',
    ).toLowerCase();
    if (rawType) {
        return rawType;
    }
    return getTaskCaseId(task) ? 'case' : '';
};

const initialCaseState = {
    // darkMode is stored at widget level, not here
    task: null,
    taskContext: null,
    caseData: null,
    previousCaseData: null,
    customerData: null,
    historyItems: [],
    visibleHistory: [],
    historyNextOffset: 0,
    hasMoreHistory: false,
    historyPageSize: HISTORY_PAGE_SIZE,
    errors: [],
    isLoading: false,
    isSavingNotes: false,
    isSavingStatus: false,
    customerPanelOpen: false,
    isLoadingRelatedCases: false,
    relatedCasesError: null,
    relatedCases: [],
    relatedExpandedCaseIds: {},
    caseNavigationStack: [],
};

const widgetSlice = createSlice({
    name: 'widget',
    initialState: {
        agentName: 'Agent',
        agent: null,
        status: '',
        statusType: '',
        darkMode: false,
        isLoading: false,
        desktopSDK: null,
        accesstoken: null,
        orgid: null,
        datacenter: null,
        workspaceid: null,
        isStreamingActive: false,
        analyticsOpen: _initOpen,
        analyticsTrendDays: _initDays,
        widgetConfig: {
            workspaceOverrideTaskTypes: DEFAULT_WORKSPACE_OVERRIDE_TASK_TYPES,
            outdialEntryPointId: null,
            // Optional: override the URL used by syncSlice to open the CRM Tab Manager window.
            // If not set, the URL is derived automatically from the relay wsUrl.
            // Example: 'https://relay.example.com/crm-tab-manager/'
            crmTabManagerUrl: null,
        },
        outdialPending: null,  // { destination: string } while an outdial call is active, null otherwise
        emailConfig: {
            tokenBrokerUrl: null,
            webexConnectOutboundWebhook: null,
            aiProvider: null,
            templatesUrl: null,
            signaturesUrl: null,
            templates: [],
            signatures: [],
            defaultSignatureId: null,
            knowledgeBase: [],
        },
        caseWorkflow: initialCaseState,
    },
    reducers: {
        setAgentName: (state, action) => {
            state.agentName = action.payload;
        },
        setDarkMode: (state, action) => {
            state.darkMode = Boolean(action.payload);
        },
        setAgent: (state, action) => {
            // Strip MobX observable proxies ($STORE.agent is a MobX object).
            // JSON round-trip alone may not fully unwrap deeply-nested observables;
            // structuredClone (available in all modern browsers) handles it properly.
            // Falls back to JSON round-trip, then to plain property copy.
            try {
                if (!action.payload) { state.agent = null; return; }
                if (typeof structuredClone !== 'undefined') {
                    state.agent = structuredClone(action.payload);
                } else {
                    state.agent = JSON.parse(JSON.stringify(action.payload));
                }
            } catch {
                // Last resort: manually copy only primitive/plain fields
                try {
                    const src = action.payload;
                    state.agent = {
                        agentId: src.agentId || src.agentDbId || '',
                        agentDbId: src.agentDbId || '',
                        agentEmailId: src.agentEmailId || '',
                        agentName: src.agentName || src.name || '',
                        name: src.name || src.agentName || '',
                        agentProfileId: src.agentProfileId || '',
                    };
                } catch {
                    state.agent = null;
                }
            }
        },
        setStatus: (state, action) => {
            state.status = action.payload.message;
            state.statusType = action.payload.type;
        },
        clearStatus: (state) => {
            state.status = '';
            state.statusType = '';
        },
        setLoading: (state, action) => {
            state.isLoading = action.payload;
        },
        setDesktopSDK: (state, action) => {
            // Store only a boolean flag — the Desktop SDK object contains MobX observables
            // that Immer cannot freeze without triggering MobX error 13.
            // Callers that need the live SDK reference must import it directly.
            state.desktopSDK = action.payload ? true : null;
        },
        setAccessToken: (state, action) => {
            state.accesstoken = action.payload;
        },
        setOrgId: (state, action) => {
            state.orgid = action.payload;
        },
        setDatacenter: (state, action) => {
            state.datacenter = action.payload;
        },
        setWorkspaceId: (state, action) => {
            state.workspaceid = action.payload;
        },
        setStreamingActive: (state, action) => {
            state.isStreamingActive = action.payload;
        },
        setWidgetConfig: (state, action) => {
            if (!action.payload || typeof action.payload !== 'object') return;
            state.widgetConfig = {
                workspaceOverrideTaskTypes: DEFAULT_WORKSPACE_OVERRIDE_TASK_TYPES,
                outdialEntryPointId: state.widgetConfig.outdialEntryPointId ?? null,
                crmTabManagerUrl: state.widgetConfig.crmTabManagerUrl ?? null,
                ...action.payload,
            };
        },
        setEmailConfig: (state, action) => {
            if (!action.payload || typeof action.payload !== 'object') return;
            state.emailConfig = { ...state.emailConfig, ...action.payload };
        },
        setCaseTaskPayload: (state, action) => {
            if (!action.payload) { state.caseWorkflow.task = null; return; }
            try {
                state.caseWorkflow.task = typeof structuredClone !== 'undefined'
                    ? structuredClone(action.payload)
                    : JSON.parse(JSON.stringify(action.payload));
            } catch {
                state.caseWorkflow.task = null;
            }
        },
        setCaseWorkflowLoading: (state, action) => {
            state.caseWorkflow.isLoading = action.payload;
        },
        setCaseWorkflowData: (state, action) => {
            const { taskContext, caseData, customerData, history, errors } = action.payload;
            const pageSize = state.caseWorkflow.historyPageSize;
            const safeHistory = Array.isArray(history) ? history : [];
            const visibleHistory = safeHistory.slice(0, pageSize);

            state.caseWorkflow.taskContext = taskContext || null;
            state.caseWorkflow.caseData = caseData || null;
            state.caseWorkflow.customerData = customerData || null;
            state.caseWorkflow.historyItems = safeHistory;
            state.caseWorkflow.visibleHistory = visibleHistory;
            state.caseWorkflow.historyNextOffset = visibleHistory.length;
            state.caseWorkflow.hasMoreHistory = safeHistory.length > visibleHistory.length;
            state.caseWorkflow.errors = Array.isArray(errors) ? errors : [];
            state.caseWorkflow.customerPanelOpen = false;
            state.caseWorkflow.relatedCases = [];
            state.caseWorkflow.relatedCasesError = null;
            state.caseWorkflow.isLoadingRelatedCases = false;
        },
        appendCaseHistoryPage: (state) => {
            const { historyItems, visibleHistory, historyNextOffset, historyPageSize } = state.caseWorkflow;
            const nextChunk = historyItems.slice(historyNextOffset, historyNextOffset + historyPageSize);
            state.caseWorkflow.visibleHistory = [...visibleHistory, ...nextChunk];
            state.caseWorkflow.historyNextOffset = historyNextOffset + nextChunk.length;
            state.caseWorkflow.hasMoreHistory = historyItems.length > state.caseWorkflow.historyNextOffset;
        },
        setCaseNotesSaving: (state, action) => {
            state.caseWorkflow.isSavingNotes = action.payload;
        },
        setCaseStatusSaving: (state, action) => {
            state.caseWorkflow.isSavingStatus = action.payload;
        },
        setCustomerPanelOpen: (state, action) => {
            state.caseWorkflow.customerPanelOpen = action.payload;
        },
        setRelatedCasesLoading: (state, action) => {
            state.caseWorkflow.isLoadingRelatedCases = action.payload;
        },
        setRelatedCasesError: (state, action) => {
            state.caseWorkflow.relatedCasesError = action.payload;
        },
        setRelatedCases: (state, action) => {
            state.caseWorkflow.relatedCases = Array.isArray(action.payload) ? action.payload : [];
        },
        toggleRelatedCaseExpanded: (state, action) => {
            const id = String(action.payload || '');
            if (!id) return;
            const current = Boolean(state.caseWorkflow.relatedExpandedCaseIds[id]);
            state.caseWorkflow.relatedExpandedCaseIds[id] = !current;
        },
        setCaseNavigationStack: (state, action) => {
            state.caseWorkflow.caseNavigationStack = Array.isArray(action.payload) ? action.payload : [];
        },
        optimisticUpdateCaseData: (state, action) => {
            if (!action.payload) return;
            state.caseWorkflow.previousCaseData = state.caseWorkflow.caseData
                ? { ...state.caseWorkflow.caseData }
                : null;
            state.caseWorkflow.caseData = {
                ...(state.caseWorkflow.caseData || {}),
                ...action.payload,
            };
        },
        updateCaseData: (state, action) => {
            if (!action.payload) return;
            state.caseWorkflow.caseData = {
                ...(state.caseWorkflow.caseData || {}),
                ...action.payload,
            };
            state.caseWorkflow.previousCaseData = null;
        },
        rollbackCaseData: (state) => {
            if (state.caseWorkflow.previousCaseData) {
                state.caseWorkflow.caseData = state.caseWorkflow.previousCaseData;
            }
            state.caseWorkflow.previousCaseData = null;
        },
        clearCaseWorkflow: (state) => {
            state.caseWorkflow = {
                ...initialCaseState,
                historyPageSize: state.caseWorkflow.historyPageSize,
            };
        },
        clearSearch: (state) => {
            state.caseWorkflow = {
                ...initialCaseState,
                historyPageSize: state.caseWorkflow.historyPageSize,
            };
        },
        stopJDSStreaming: (state) => {
            state.isStreamingActive = false;
        },
        setOutdialPending: (state, action) => {
            // action.payload: { destination } to mark a call in progress, null to clear
            state.outdialPending = action.payload || null;
        },
        setAnalyticsOpen: (state, action) => {
            state.analyticsOpen = Boolean(action.payload);
            try { localStorage.setItem('wx_analytics_open', String(state.analyticsOpen)); } catch {}
        },
        toggleAnalyticsOpen: (state) => {
            state.analyticsOpen = !state.analyticsOpen;
            try { localStorage.setItem('wx_analytics_open', String(state.analyticsOpen)); } catch {}
        },
        setAnalyticsTrendDays: (state, action) => {
            const days = action.payload;
            if ([7, 30, 90].includes(days)) {
                state.analyticsTrendDays = days;
                try { localStorage.setItem('wx_analytics_trend_days', String(days)); } catch {}
            }
        },
    },
});

export const {
    setAgentName,
    setDarkMode,
    setAgent,
    setStatus,
    clearStatus,
    setLoading,
    setDesktopSDK,
    setAccessToken,
    setOrgId,
    setDatacenter,
    setWorkspaceId,
    setStreamingActive,
    setWidgetConfig,
    setEmailConfig,
    setCaseTaskPayload,
    setCaseWorkflowLoading,
    setCaseWorkflowData,
    appendCaseHistoryPage,
    setCaseNotesSaving,
    setCaseStatusSaving,
    setCustomerPanelOpen,
    setRelatedCasesLoading,
    setRelatedCasesError,
    setRelatedCases,
    toggleRelatedCaseExpanded,
    setCaseNavigationStack,
    optimisticUpdateCaseData,
    updateCaseData,
    rollbackCaseData,
    clearCaseWorkflow,
    clearSearch,
    stopJDSStreaming,
    setOutdialPending,
    setAnalyticsOpen,
    toggleAnalyticsOpen,
    setAnalyticsTrendDays,
} = widgetSlice.actions;

export default widgetSlice.reducer;

export const initializeDesktopSDK = () => async (dispatch, getState) => {
    try {
        dispatch(setLoading(true));

        try {
            const { Desktop } = await import('@wxcc-desktop/sdk');
            console.log('Checking for Desktop SDK availability...');

            // The Desktop platform initializes its sub-services (Dialer, AgentContact, …)
            // asynchronously after the global AGENTX_SERVICE is registered.  Our widget
            // may call Desktop.config.init() before those services are ready, causing
            // the first attempt to throw.  Retry up to 3 times with short delays before
            // giving up and falling back to demo mode.
            const RETRY_DELAYS_MS = [0, 500, 1500];
            let lastSdkError;
            let sdkInitOk = false;
            for (const delay of RETRY_DELAYS_MS) {
                if (delay > 0) {
                    await new Promise((r) => setTimeout(r, delay));
                }
                try {
                    await Desktop.config.init();
                    sdkInitOk = true;
                    break;
                } catch (e) {
                    lastSdkError = e;
                    console.log(`[SDK] init attempt failed (delay ${delay}ms): ${e.message}`);
                }
            }
            if (!sdkInitOk) throw lastSdkError;

            console.log('Desktop SDK detected');
            dispatch(setDesktopSDK(Desktop));

            if (Desktop.agentStateInfo?.onAgentStateChange) {
                Desktop.agentStateInfo.onAgentStateChange((state) => {
                    console.log('Agent state changed:', state);
                });
            }

            dispatch(setStatus({ message: 'status.sdk.init.success', type: 'success' }));
            setTimeout(() => dispatch(clearStatus()), 3000);
        } catch (sdkError) {
            console.log('Desktop SDK not available, using demo mode');

            if (!getState().widget.agent) {
                const mockAgent = {
                    agentId: 'demo-001',
                    agentDbId: 'demo-001',
                    agentProfileId: 'demo-profile-001',
                    agentEmailId: 'demo.agent@example.com',
                    agentName: 'Demo Agent',
                    name: 'Demo Agent',
                };
                dispatch(setAgent(mockAgent));
                dispatch(setAgentName(mockAgent.agentName));
            }

            dispatch(setStatus({ message: 'status.sdk.demo', type: 'info' }));
            setTimeout(() => dispatch(clearStatus()), 3000);
        }
    } catch (error) {
        console.error('Unexpected error during SDK initialization:', error);
        dispatch(setStatus({ message: 'status.sdk.initFail', type: 'error' }));
    } finally {
        dispatch(setLoading(false));
    }
};

export const hydrateWidgetContext = (props = {}) => (dispatch) => {
    dispatch(setDarkMode(props.darkmode));

    if (props.accesstoken) {
        dispatch(setAccessToken(props.accesstoken));
    }

    if (props.orgid) {
        dispatch(setOrgId(props.orgid));
    }

    if (props.datacenter) {
        dispatch(setDatacenter(props.datacenter));
    }

    if (props.workspaceid) {
        dispatch(setWorkspaceId(props.workspaceid));
    }

    if (props.agent) {
        let safeAgent = props.agent;
        try {
            safeAgent = typeof structuredClone !== 'undefined'
                ? structuredClone(props.agent)
                : JSON.parse(JSON.stringify(props.agent));
        } catch {
            // structuredClone/JSON failed (circular/non-serializable) — copy only scalar fields
            try {
                const s = props.agent;
                safeAgent = {
                    agentId: s.agentId || s.agentDbId || '',
                    agentDbId: s.agentDbId || '',
                    agentEmailId: s.agentEmailId || '',
                    agentName: s.agentName || s.name || '',
                    name: s.name || s.agentName || '',
                    agentProfileId: s.agentProfileId || '',
                };
            } catch { /* give up */ }
        }
        dispatch(setAgent(safeAgent));
        const displayName = safeAgent.agentName || safeAgent.name;
        if (displayName) {
            dispatch(setAgentName(displayName));
        }
    }

    if (props.config && typeof props.config === 'object') {
        let safeConfig = props.config;
        try {
            safeConfig = typeof structuredClone !== 'undefined'
                ? structuredClone(props.config)
                : JSON.parse(JSON.stringify(props.config));
        } catch { /* use as-is if it fails */ }
        dispatch(setWidgetConfig(safeConfig));

        // Extract email-specific config fields from the layout config object
        const {
            tokenBrokerUrl, webexConnectOutboundWebhook,
            aiProvider, aiApiKey,
            templatesUrl, signaturesUrl, templates, signatures, defaultSignatureId, knowledgeBase,
        } = safeConfig;
        const emailCfg = {};
        if (tokenBrokerUrl) emailCfg.tokenBrokerUrl = tokenBrokerUrl;
        if (webexConnectOutboundWebhook) emailCfg.webexConnectOutboundWebhook = webexConnectOutboundWebhook;
        if (aiProvider) {
            emailCfg.aiProvider = typeof aiProvider === 'object'
                ? { ...aiProvider, apiKey: aiApiKey || aiProvider.apiKey || null }
                : { type: aiProvider, apiKey: aiApiKey || null };
        }
        if (templatesUrl) emailCfg.templatesUrl = templatesUrl;
        if (signaturesUrl) emailCfg.signaturesUrl = signaturesUrl;
        if (Array.isArray(templates) && templates.length > 0) emailCfg.templates = templates;
        if (Array.isArray(signatures) && signatures.length > 0) emailCfg.signatures = signatures;
        if (defaultSignatureId) emailCfg.defaultSignatureId = defaultSignatureId;
        if (Array.isArray(knowledgeBase) && knowledgeBase.length > 0) emailCfg.knowledgeBase = knowledgeBase;
        if (Object.keys(emailCfg).length > 0) {
            dispatch(setEmailConfig(emailCfg));
        }
    }
};

export const loadCaseTask = (task = null) => async (dispatch, getState) => {
    dispatch(setCaseTaskPayload(task));

    const normalizedTaskType = resolveNormalizedTaskType(task || {});
    if (!task || normalizedTaskType !== 'case') {
        dispatch(clearCaseWorkflow());
        return;
    }

    const state = getState().widget;
    dispatch(setCaseWorkflowLoading(true));

    try {
        const overrideTaskTypes =
            state.widgetConfig?.workspaceOverrideTaskTypes || DEFAULT_WORKSPACE_OVERRIDE_TASK_TYPES;

        const resolvedWorkspaceId = resolveWorkspaceForTaskType(
            normalizedTaskType,
            state.workspaceid,
            task.JDSWorkspaceId || task.jdsWorkspaceId,
            overrideTaskTypes,
        );

        const payload = await fetchCaseTaskContext({
            task,
            accessToken: state.accesstoken,
            workspaceId: resolvedWorkspaceId,
            datacenter: state.datacenter,
        });

        dispatch(setCaseWorkflowData(payload));

        if (payload.errors?.length > 0) {
            dispatch(setStatus({ message: 'status.case.partial', type: 'warning' }));
        } else {
            dispatch(setStatus({ message: 'status.case.loaded', type: 'success' }));
        }

        setTimeout(() => dispatch(clearStatus()), 3000);
    } catch (error) {
        console.error('Failed to load case task context:', error);
        dispatch(setStatus({ message: 'status.case.loadFail', type: 'error' }));
    } finally {
        dispatch(setCaseWorkflowLoading(false));
    }
};

export const loadMoreCaseHistory = () => (dispatch, getState) => {
    const hasMore = getState().widget.caseWorkflow.hasMoreHistory;
    if (!hasMore) {
        return;
    }

    dispatch(appendCaseHistoryPage());
};

export const saveCaseNotes = (notes) => async (dispatch, getState) => {
    const { caseWorkflow } = getState().widget;
    const caseRecordId = caseWorkflow.caseData?.id;
    if (!caseRecordId) {
        dispatch(setStatus({ message: 'status.case.notes.missing', type: 'warning' }));
        return;
    }

    dispatch(setCaseNotesSaving(true));
    dispatch(optimisticUpdateCaseData({ notes }));

    try {
        const updatedCase = await updateCaseNotesInTicketDB(caseRecordId, notes);
        dispatch(updateCaseData(updatedCase));
        dispatch(setStatus({ message: 'status.case.notes.saved', type: 'success' }));
    } catch (error) {
        console.error('Failed to save notes:', error);
        dispatch(rollbackCaseData());
        dispatch(setStatus({ message: 'status.case.notes.failed', type: 'error' }));
    } finally {
        dispatch(setCaseNotesSaving(false));
        setTimeout(() => dispatch(clearStatus()), 3000);
    }
};

export const saveCaseStatus = (status) => async (dispatch, getState) => {
    const { caseWorkflow } = getState().widget;
    const caseRecordId = caseWorkflow.caseData?.id;
    if (!caseRecordId) {
        dispatch(setStatus({ message: 'status.case.status.missing', type: 'warning' }));
        return;
    }

    dispatch(setCaseStatusSaving(true));
    dispatch(optimisticUpdateCaseData({ status }));

    try {
        const updatedCase = await updateCaseStatusInTicketDB(caseRecordId, status);
        dispatch(updateCaseData(updatedCase));
        dispatch(setStatus({ message: 'status.case.status.saved', type: 'success' }));
    } catch (error) {
        console.error('Failed to update status:', error);
        dispatch(rollbackCaseData());
        dispatch(setStatus({ message: 'status.case.status.failed', type: 'error' }));
    } finally {
        dispatch(setCaseStatusSaving(false));
        setTimeout(() => dispatch(clearStatus()), 3000);
    }
};

export const toggleCustomerPanelAndLoadCases = () => async (dispatch, getState) => {
    const { caseWorkflow } = getState().widget;
    const nextOpen = !caseWorkflow.customerPanelOpen;
    dispatch(setCustomerPanelOpen(nextOpen));

    if (!nextOpen) {
        return;
    }

    if (caseWorkflow.isLoadingRelatedCases || caseWorkflow.relatedCases.length > 0) {
        return;
    }

    const customerEmail = caseWorkflow.customerData?.email || caseWorkflow.caseData?.customerEmail;
    const customerPhone = caseWorkflow.customerData?.phone || caseWorkflow.caseData?.customerPhone;
    const customerName = caseWorkflow.customerData?.name || caseWorkflow.caseData?.customerName;

    if (!customerEmail && !customerPhone && !customerName) {
        dispatch(setRelatedCasesError('status.case.related.missingIdentity'));
        return;
    }

    dispatch(setRelatedCasesLoading(true));
    dispatch(setRelatedCasesError(null));

    try {
        const relatedCases = await fetchCasesForCustomerFromTicketDB({
            customerEmail,
            customerPhone,
            customerName,
        });

        const currentCaseId = String(caseWorkflow.caseData?.caseId || '').toLowerCase();
        const filtered = relatedCases.filter((item) => String(item.caseId || '').toLowerCase() !== currentCaseId);

        dispatch(setRelatedCases(filtered));
    } catch (error) {
        console.error('Failed to load related cases:', error);
        dispatch(setRelatedCasesError('status.case.related.loadFail'));
    } finally {
        dispatch(setRelatedCasesLoading(false));
    }
};

export const openRelatedCasePage = (relatedCase) => async (dispatch, getState) => {
    const targetCaseId = relatedCase?.caseId || relatedCase?.id;
    if (!targetCaseId) {
        dispatch(setStatus({ message: 'status.case.related.openMissingCaseId', type: 'warning' }));
        return;
    }

    const { caseWorkflow } = getState().widget;
    const currentCaseId = String(caseWorkflow.caseData?.caseId || '').toLowerCase();
    if (String(targetCaseId).toLowerCase() === currentCaseId) {
        return;
    }

    const currentTask = caseWorkflow.task || {
        taskType: 'case',
        caseId: caseWorkflow.caseData?.caseId,
    };

    dispatch(
        setCaseNavigationStack([
            ...caseWorkflow.caseNavigationStack,
            currentTask,
        ]),
    );

    const targetTask = {
        ...currentTask,
        taskType: 'case',
        caseId: targetCaseId,
        caseid: targetCaseId,
        mediaResourceId: targetCaseId,
    };

    dispatch(loadCaseTask(targetTask));
};

export const navigateBackToPreviousCase = () => async (dispatch, getState) => {
    const { caseWorkflow } = getState().widget;
    if (!Array.isArray(caseWorkflow.caseNavigationStack) || caseWorkflow.caseNavigationStack.length === 0) {
        return;
    }

    const previousTask = caseWorkflow.caseNavigationStack[caseWorkflow.caseNavigationStack.length - 1];
    const nextStack = caseWorkflow.caseNavigationStack.slice(0, -1);
    dispatch(setCaseNavigationStack(nextStack));
    dispatch(loadCaseTask(previousTask));
};

/**
 * Initiate an outbound voice call via the Webex CC Desktop SDK dialer.
 *
 * Requires `outdialEntryPointId` to be configured in the widget layout config
 * (passed via the `config.outdialEntryPointId` property).
 *
 * In demo mode (SDK not available) the call is only logged; no error is raised.
 *
 * @param {object} params
 * @param {string} params.entryPointId - Webex CC entry point ID for outbound calls
 * @param {string} params.destination  - Phone number to dial (E.164 or local format)
 * @param {string} [params.origin]     - Caller ANI (optional; uses entry-point default if omitted)
 */
export const initiateOutdialCall = ({ entryPointId, destination, origin }) => async (dispatch) => {
    if (!entryPointId) {
        console.error('[WidgetSlice] initiateOutdialCall: outdialEntryPointId not configured');
        dispatch(setStatus({ message: 'outdial.missingEntryPoint', type: 'error' }));
        setTimeout(() => dispatch(clearStatus()), 4000);
        return;
    }
    try {
        dispatch(setOutdialPending({ destination }));
        const { Desktop } = await import('@wxcc-desktop/sdk');
        await Desktop.dialer.startOutdial({
            data: {
                entryPointId,
                direction: entryPointId,
                destination,
                outboundType: 'OUTDIAL',
                mediaType: 'telephony',
                attributes: { key: 'outdial', value: 'true' },
                ...(origin ? { origin } : {}),
            },
        });
        console.log('[WidgetSlice] Outdial started for:', destination);
        // Keep outdialPending set — the task panel will show the new interaction.
        // The agent cancels via the cancel button which dispatches cancelOutdialCall.
    } catch (err) {
        console.error('[WidgetSlice] initiateOutdialCall error:', err);
        dispatch(setOutdialPending(null));
        dispatch(setStatus({ message: err.message || 'outdial.failed', type: 'error' }));
        setTimeout(() => dispatch(clearStatus()), 4000);
    }
};

/**
 * Cancel the active outdial call.
 * Resets the outdialPending UI state and attempts to end the call via the SDK.
 * The actual call termination is best-effort — the agent can also end it from
 * the Desktop task panel.
 */
export const cancelOutdialCall = () => async (dispatch) => {
    dispatch(setOutdialPending(null));
    try {
        const { Desktop } = await import('@wxcc-desktop/sdk');
        // cancelOutdial is the standard API for aborting a pending/ringing outdial
        if (typeof Desktop.dialer.cancelOutdial === 'function') {
            await Desktop.dialer.cancelOutdial();
            console.log('[WidgetSlice] Outdial cancelled via SDK');
        } else {
            console.log('[WidgetSlice] SDK cancelOutdial not available — call must be ended from task panel');
        }
    } catch (err) {
        // Non-fatal — the UI is already reset; agent can end from task panel
        console.warn('[WidgetSlice] cancelOutdialCall error (non-fatal):', err.message);
    }
};
