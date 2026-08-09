import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { generateWrapUpSummary } from '../store/slices/emailSlice';

// Headless: detects the Webex CC wrap-up stage via the Desktop SDK
// (agentContact 'eAgentWrapup') and generates the AI wrap-up summary so it's
// ready in the wrap-up text. Renders nothing.
const WrapUpSummaryController = ({ interactionId }) => {
  const dispatch = useDispatch();
  const { locale } = useI18n();
  const desktopSDK = useSelector((s) => s.widget.desktopSDK);

  useEffect(() => {
    if (!desktopSDK || !interactionId) return undefined;
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      try {
        const { Desktop } = await import('@wxcc-desktop/sdk');
        const onWrapup = (msg) => {
          const id = msg?.data?.interactionId;
          if (id && id !== interactionId) return;
          dispatch(generateWrapUpSummary(locale));
        };
        Desktop.agentContact.addEventListener('eAgentWrapup', onWrapup);
        cleanup = () => { try { Desktop.agentContact.removeEventListener('eAgentWrapup', onWrapup); } catch { /* ignore */ } };
        if (cancelled) cleanup();
      } catch { /* SDK unavailable (demo mode) */ }
    })();
    return () => { cancelled = true; cleanup(); };
  }, [desktopSDK, interactionId, locale, dispatch]);

  return null;
};

WrapUpSummaryController.propTypes = {
  interactionId: PropTypes.string,
};

WrapUpSummaryController.defaultProps = {
  interactionId: null,
};

export default WrapUpSummaryController;
