import { configureStore } from '@reduxjs/toolkit';
// Disable Immer's auto-freeze. The Webex CC Desktop passes MobX observable
// objects (from $STORE.agent, $STORE.agentContact.taskSelected, etc.) as widget
// props. If any observable reference leaks into Redux state before our
// serialization guards strip it, Immer's Object.freeze call on the state tree
// triggers MobX error 13 ("Cannot freeze an observable"). Disabling auto-freeze
// is the standard recommendation when running Immer alongside MobX.
// See: https://immerjs.github.io/immer/freezing/
import { setAutoFreeze } from 'immer';
setAutoFreeze(false);

import widgetReducer, {
  // Actions
  setAgentName, setAgent, setStatus, clearStatus, setLoading, setDesktopSDK,
  setAccessToken, setOrgId, setDatacenter, setWorkspaceId, setStreamingActive,
  setWidgetConfig, setEmailConfig, setDarkMode,
  toggleRelatedCaseExpanded,
  clearSearch, stopJDSStreaming, setOutdialPending, markOutdialDelivered,
  // Thunks
  initializeDesktopSDK, hydrateWidgetContext, loadCaseTask, loadMoreCaseHistory,
  saveCaseNotes, saveCaseStatus, toggleCustomerPanelAndLoadCases,
  openRelatedCasePage, navigateBackToPreviousCase,
  initiateOutdialCall, cancelOutdialCall,
} from './store/slices/widgetSlice';

import emailReducer, {
  // Actions
  setGmailToken, setActiveEmail, setThread, setCustomerThreads, setCustomerHistory,
  appendCustomerHistoryEvent, setCustomerIdentities,
  setAiEnrichment, setAiReplyDraft, setTemplates, setPendingCorrelationId,
  fetchCustomerJdsHistory, loadJdsHistoryForEmailTask, loadJdsHistoryForWorkItemTask, loadJdsHistoryForVoiceTask, refreshAiEnrichment, generateAiReply, improveAiDraft,
  sendEmailReply, handleSseEvent, submitWrapUp,
  // Helpers
  parseGmailMessage, decodeBase64Url, extractEmailFromTask,
} from './store/slices/emailSlice';

const store = configureStore({
    reducer: {
        widget: widgetReducer,
        email: emailReducer,
    },
});

export default store;

export {
  // Widget actions
  setAgentName, setAgent, setStatus, clearStatus, setLoading, setDesktopSDK,
  setAccessToken, setOrgId, setDatacenter, setWorkspaceId, setStreamingActive,
  setWidgetConfig, setEmailConfig, setDarkMode,
  toggleRelatedCaseExpanded,
  clearSearch, stopJDSStreaming, setOutdialPending, markOutdialDelivered,
  // Widget thunks
  initializeDesktopSDK, hydrateWidgetContext, loadCaseTask, loadMoreCaseHistory,
  saveCaseNotes, saveCaseStatus, toggleCustomerPanelAndLoadCases,
  openRelatedCasePage, navigateBackToPreviousCase,
  initiateOutdialCall, cancelOutdialCall,
  // Email actions
  setGmailToken, setActiveEmail, setThread, setCustomerThreads, setCustomerHistory,
  appendCustomerHistoryEvent, setCustomerIdentities,
  setAiEnrichment, setAiReplyDraft, setTemplates, setPendingCorrelationId,
  fetchCustomerJdsHistory, loadJdsHistoryForEmailTask, loadJdsHistoryForWorkItemTask, loadJdsHistoryForVoiceTask, refreshAiEnrichment, generateAiReply, improveAiDraft,
  sendEmailReply, handleSseEvent, submitWrapUp,
  // Email helpers
  parseGmailMessage, decodeBase64Url, extractEmailFromTask,
};