import { createSlice } from '@reduxjs/toolkit';
import {
    fetchCaseTaskContext,
    fetchCasesForCustomerFromTicketDB,
    resolveWorkspaceForTaskType,
    updateCaseNotesInTicketDB,
    updateCaseStatusInTicketDB,
} from '../../api';

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
        isLoading: false,
        desktopSDK: null,
        accesstoken: null,
        orgid: null,
        datacenter: null,
        workspaceid: null,
        isStreamingActive: false,
        widgetConfig: {
            workspaceOverrideTaskTypes: DEFAULT_WORKSPACE_OVERRIDE_TASK_TYPES,
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
            state.agent = action.payload;
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
            state.desktopSDK = action.payload;
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
                ...action.payload,
            };
        },
        setCaseTaskPayload: (state, action) => {
            state.caseWorkflow.task = action.payload || null;
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
} = widgetSlice.actions;

export default widgetSlice.reducer;

export const initializeDesktopSDK = () => async (dispatch, getState) => {
    try {
        dispatch(setLoading(true));

        try {
            const { Desktop } = await import('@wxcc-desktop/sdk');
            console.log('Checking for Desktop SDK availability...');
            await Desktop.config.init();

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
    if (props.darkmode !== undefined) {
        dispatch(setDarkMode(props.darkmode));
    }

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
        dispatch(setAgent(props.agent));
        const displayName = props.agent.agentName || props.agent.name;
        if (displayName) {
            dispatch(setAgentName(displayName));
        }
    }

    if (props.config && typeof props.config === 'object') {
        dispatch(setWidgetConfig(props.config));
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
