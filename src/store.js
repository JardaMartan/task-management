import { configureStore } from '@reduxjs/toolkit';

import widgetReducer, {
  // Actions
  setAgentName, setAgent, setStatus, clearStatus, setLoading, setDesktopSDK,
  setAccessToken, setOrgId, setDatacenter, setWorkspaceId, setStreamingActive,
  setWidgetConfig, setEmailConfig, setDarkMode,
  toggleRelatedCaseExpanded,
  clearSearch, stopJDSStreaming,
  // Thunks
  initializeDesktopSDK, hydrateWidgetContext, loadCaseTask, loadMoreCaseHistory,
  saveCaseNotes, saveCaseStatus, toggleCustomerPanelAndLoadCases,
  openRelatedCasePage, navigateBackToPreviousCase
} from './store/slices/widgetSlice';

import emailReducer, {
  // Actions
  setGmailToken, setActiveEmail, setThread, setCustomerThreads, setCustomerHistory,
  setAiEnrichment, setAiReplyDraft, setTemplates, setPendingCorrelationId,
  clearPendingCorrelationId, setIsFetchingToken, setIsFetchingEmail, setIsSending,
  setSendResult, setWrapUp, setError, resetEmail,
  // Thunks
  fetchGmailToken, initEmailTask, fetchEmailThread, fetchCustomerThreads,
  fetchCustomerJdsHistory, refreshAiEnrichment, generateAiReply, improveAiDraft,
  sendEmailReply, handleSseEvent, submitWrapUp,
  // Helpers
  parseGmailMessage, decodeBase64Url,
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
  clearSearch, stopJDSStreaming,
  // Widget thunks
  initializeDesktopSDK, hydrateWidgetContext, loadCaseTask, loadMoreCaseHistory,
  saveCaseNotes, saveCaseStatus, toggleCustomerPanelAndLoadCases,
  openRelatedCasePage, navigateBackToPreviousCase,
  // Email actions
  setGmailToken, setActiveEmail, setThread, setCustomerThreads, setCustomerHistory,
  setAiEnrichment, setAiReplyDraft, setTemplates, setPendingCorrelationId,
  clearPendingCorrelationId, setIsFetchingToken, setIsFetchingEmail, setIsSending,
  setSendResult, setWrapUp, setError, resetEmail,
  // Email thunks
  fetchGmailToken, initEmailTask, fetchEmailThread, fetchCustomerThreads,
  fetchCustomerJdsHistory, refreshAiEnrichment, generateAiReply, improveAiDraft,
  sendEmailReply, handleSseEvent, submitWrapUp,
  // Email helpers
  parseGmailMessage, decodeBase64Url,
};