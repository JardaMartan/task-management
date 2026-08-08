import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setPanelUiState } from '../store/slices/widgetSlice';

const EMPTY = {};

/**
 * Persist a panel's transient UI state (filters, last-selected item, sub-view)
 * in Redux so it survives tab switches (panels unmount when their tab is hidden).
 *
 * @param {string} panelKey  Unique key per panel (e.g. 'history', 'voice').
 * @returns {[object, (patch: object) => void]} current state + a patch setter.
 */
export function usePanelUiState(panelKey) {
  const dispatch = useDispatch();
  const state = useSelector((s) => s.widget?.panelUi?.[panelKey]) || EMPTY;
  const patch = useCallback(
    (p) => dispatch(setPanelUiState({ panel: panelKey, patch: p })),
    [dispatch, panelKey],
  );
  return [state, patch];
}
