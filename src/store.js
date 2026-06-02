import { configureStore } from '@reduxjs/toolkit';

import widgetReducer, {
  // Actions
  setAgentName, setAgent, setStatus, clearStatus, setLoading, setDesktopSDK,
  setAccessToken, setOrgId, setDatacenter, setWorkspaceId, setStreamingActive,
  setWidgetConfig, setDarkMode,
  toggleRelatedCaseExpanded,
  clearSearch, stopJDSStreaming,
  // Thunks
  initializeDesktopSDK, hydrateWidgetContext, loadCaseTask, loadMoreCaseHistory,
  saveCaseNotes, saveCaseStatus, toggleCustomerPanelAndLoadCases,
  openRelatedCasePage, navigateBackToPreviousCase
} from './store/slices/widgetSlice';
const store = configureStore({
    reducer: {
        widget: widgetReducer,
    },
});

export default store;

export {
  // Actions
  setAgentName, setAgent, setStatus, clearStatus, setLoading, setDesktopSDK,
  setAccessToken, setOrgId, setDatacenter, setWorkspaceId, setStreamingActive,
  setWidgetConfig, setDarkMode,
  toggleRelatedCaseExpanded,
  clearSearch, stopJDSStreaming,
  // Thunks
  initializeDesktopSDK, hydrateWidgetContext, loadCaseTask, loadMoreCaseHistory,
  saveCaseNotes, saveCaseStatus, toggleCustomerPanelAndLoadCases,
  openRelatedCasePage, navigateBackToPreviousCase
};