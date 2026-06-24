import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { initiateOutdialCall, cancelOutdialCall, initiateSmsChat } from '../store/slices/widgetSlice';
import { isMobileNumber } from '../ui/phoneUtils';

/**
 * Inline SMS glyph (a speech bubble containing the letters "SMS").
 *
 * Rendered as an inline SVG rather than via the Momentum icon font because the
 * `sms_16` glyph (PUA codepoint U+FB35) is absent from the bundled
 * `momentum-ui-icons` font, so `<Icon name="sms_16" />` renders blank.  The SVG
 * uses `currentColor` so it inherits the button's text colour and matches the
 * 16px sizing of the other Momentum icons.
 */
const SmsIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path
      fillRule="evenodd"
      d="M14.061,9.403 C13.741,9.634 13.296,9.751 12.729,9.751 C12.149,9.751 11.691,9.611 11.355,9.331 C11.071,9.094 10.901,8.781 10.844,8.388 L11.798,8.388 C11.834,8.601 11.939,8.765 12.111,8.881 C12.275,8.993 12.485,9.049 12.741,9.049 C13.277,9.049 13.544,8.882 13.544,8.55 C13.544,8.339 13.428,8.176 13.197,8.065 C13.065,8.001 12.821,7.926 12.464,7.842 C11.976,7.731 11.624,7.587 11.409,7.411 C11.136,7.187 11,6.882 11,6.499 C11,6.083 11.166,5.765 11.498,5.544 C11.798,5.349 12.21,5.25 12.735,5.25 C13.266,5.25 13.682,5.37 13.983,5.611 C14.243,5.819 14.399,6.099 14.451,6.451 L13.508,6.451 C13.485,6.279 13.39,6.147 13.226,6.054 C13.086,5.979 12.915,5.941 12.71,5.941 C12.247,5.941 12.014,6.087 12.014,6.379 C12.014,6.539 12.075,6.659 12.195,6.739 C12.315,6.819 12.546,6.897 12.89,6.972 C13.43,7.089 13.832,7.253 14.096,7.465 C14.405,7.709 14.558,8.033 14.558,8.437 C14.558,8.841 14.392,9.163 14.061,9.403 L14.061,9.403 Z M10.304,9.661 L9.392,9.661 L9.392,6.685 L8.378,9.661 L7.556,9.661 L6.518,6.691 L6.518,9.661 L5.666,9.661 L5.666,5.34 L6.818,5.34 L7.988,8.713 L9.123,5.34 L10.304,5.34 L10.304,9.661 Z M4.659,9.403 C4.338,9.634 3.894,9.751 3.327,9.751 C2.747,9.751 2.289,9.611 1.953,9.331 C1.668,9.094 1.498,8.781 1.443,8.388 L2.396,8.388 C2.432,8.601 2.537,8.765 2.708,8.881 C2.873,8.993 3.082,9.049 3.338,9.049 C3.874,9.049 4.142,8.882 4.142,8.55 C4.142,8.339 4.027,8.176 3.794,8.065 C3.663,8.001 3.418,7.926 3.062,7.842 C2.575,7.731 2.222,7.587 2.006,7.411 C1.735,7.187 1.598,6.882 1.598,6.499 C1.598,6.083 1.764,5.765 2.096,5.544 C2.396,5.349 2.808,5.25 3.332,5.25 C3.865,5.25 4.28,5.37 4.581,5.611 C4.84,5.819 4.997,6.099 5.048,6.451 L4.107,6.451 C4.082,6.279 3.989,6.147 3.825,6.054 C3.684,5.979 3.512,5.941 3.308,5.941 C2.844,5.941 2.613,6.087 2.613,6.379 C2.613,6.539 2.672,6.659 2.792,6.739 C2.913,6.819 3.144,6.897 3.489,6.972 C4.029,7.089 4.43,7.253 4.694,7.465 C5.002,7.709 5.156,8.033 5.156,8.437 C5.156,8.841 4.99,9.163 4.659,9.403 L4.659,9.403 Z M14.5,1 L1.5,1 C0.673,1 0,1.673 0,2.5 L0,12 C0,12.827 0.673,13.5 1.5,13.5 L1.5,15.5 C1.5,15.694 1.613,15.871 1.789,15.953 C1.856,15.984 1.928,16 2,16 C2.116,16 2.229,15.96 2.321,15.883 L5.182,13.5 L14.5,13.5 C15.328,13.5 16,12.827 16,12 L16,2.5 C16,1.673 15.328,1 14.5,1 L14.5,1 Z"
    />
  </svg>
);

/**
 * CustomerContactCard
 *
 * Displays the customer's name, email address(es), and phone number(s) fetched
 * from JDS and stored in `state.email.customerProfile`.  Each contact value is
 * rendered as a clickable action button:
 *
 *   • Email  → navigate to the Email tab in "compose new thread" mode
 *   • Phone  → initiate an outbound voice call via the Webex CC Desktop SDK
 *              When a call is active, replaces the button with a status pill +
 *              cancel (×) button.
 *
 * The card only renders when a customer profile is available in Redux state.
 *
 * Props:
 *   onNavigate  – function(tab, params) provided by UnifiedView360 for cross-tab
 *                 navigation.  When falsy the email button is hidden.
 *   darkMode    – boolean
 */
const CustomerContactCard = ({ onNavigate, darkMode, mockProfile }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();

  const reduxProfile        = useSelector((s) => s.email?.customerProfile);
  const customerProfile     = mockProfile || reduxProfile;
  const outdialEntryPointId    = useSelector((s) => s.widget?.widgetConfig?.outdialEntryPointId);
  const smsEntryPointId        = useSelector((s) => s.widget?.widgetConfig?.smsEntryPointId);
  const outdialPending          = useSelector((s) => s.widget?.outdialPending);
  const outdialDelivered        = Boolean(outdialPending?.delivered);

  if (!customerProfile) return null;

  const { name, firstName, lastName, email, phone } = customerProfile;

  // Normalise to arrays — JDS may return strings or arrays
  const normalise = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return [String(v)];
  };

  const emails = normalise(email);
  const phones = normalise(phone);

  const displayName = name || [firstName, lastName].filter(Boolean).join(' ') || null;

  // Nothing to show if there are no contact details
  if (emails.length === 0 && phones.length === 0 && !displayName) return null;

  const handleEmailClick = (address) => {
    if (!onNavigate) return;
    onNavigate('email', { composeMode: true, composeTo: address });
  };

  const handlePhoneClick = (number) => {
    if (!outdialEntryPointId) {
      console.warn('[CustomerContactCard] outdialEntryPointId not configured — add it to the widget layout config');
      return;
    }
    dispatch(initiateOutdialCall({ entryPointId: outdialEntryPointId, destination: number }));
  };

  const handleCancelCall = () => {
    dispatch(cancelOutdialCall());
  };

  const handleSmsClick = (number) => {
    dispatch(initiateSmsChat({ destination: number }));
  };

  const phoneDisabled = !outdialEntryPointId;

  return (
    <div className={`customer-contact-card${darkMode ? ' md--dark' : ''}`} aria-label={t('customer.card.label')}>
      {displayName && (
        <div className="customer-contact-card__name">
          <Icon name="person_16" className="customer-contact-card__name-icon" />
          <span>{displayName}</span>
        </div>
      )}

      {(emails.length > 0 || phones.length > 0) && (
        <div className="customer-contact-card__actions">
          {emails.map((addr) => (
            <button
              key={`email-${addr}`}
              type="button"
              className="customer-contact-card__action-btn customer-contact-card__action-btn--email"
              onClick={() => handleEmailClick(addr)}
              disabled={!onNavigate}
              title={onNavigate ? `${t('customer.action.email')}: ${addr}` : addr}
              aria-label={`${t('customer.action.email')} ${addr}`}
            >
              <Icon name="email_16" />
              <span className="customer-contact-card__action-label">{addr}</span>
            </button>
          ))}

          {phones.map((num) => {
            const isThisCallActive = outdialPending?.destination === num;
            const anyCallActive    = Boolean(outdialPending);

            if (isThisCallActive) {
              // Replace the dial button with a "Calling…" status pill.
              // Cancel button is only shown while the call is still being set up
              // (not yet delivered to the desktop as an active task).
              return (
                <span key={`phone-${num}`} className="customer-contact-card__calling-pill">
                  <span className="customer-contact-card__calling-dot" aria-hidden="true" />
                  <span className="customer-contact-card__calling-label">
                    {t('customer.action.calling') || 'Calling'} {num}
                  </span>
                  {!outdialDelivered && (
                    <button
                      type="button"
                      className="customer-contact-card__cancel-call-btn"
                      onClick={handleCancelCall}
                      title={t('customer.action.cancelCall') || 'Cancel call'}
                      aria-label={t('customer.action.cancelCall') || 'Cancel call'}
                    >
                      <Icon name="cancel_16" />
                    </button>
                  )}
                </span>
              );
            }

            return (
              <button
                key={`phone-${num}`}
                type="button"
                className={`customer-contact-card__action-btn customer-contact-card__action-btn--phone${(phoneDisabled || anyCallActive) ? ' customer-contact-card__action-btn--disabled' : ''}`}
                onClick={() => handlePhoneClick(num)}
                disabled={phoneDisabled || anyCallActive}
                title={phoneDisabled ? t('customer.action.noEntryPoint') : `${t('customer.action.call')}: ${num}`}
                aria-label={`${t('customer.action.call')} ${num}`}
              >
                <Icon name="handset_16" />
                <span className="customer-contact-card__action-label">{num}</span>
              </button>
            );
          })}

          {/* WhatsApp outbound is not available in this environment.
               The button is intentionally omitted; the backing code (thunk,
               API, i18n, CSS) is retained for future enablement. */}

          {smsEntryPointId && phones.filter(isMobileNumber).map((num) => (
            <button
              key={`sms-${num}`}
              type="button"
              className="customer-contact-card__action-btn customer-contact-card__action-btn--sms"
              onClick={() => handleSmsClick(num)}
              title={`${t('customer.action.sms.label')}: ${num}`}
              aria-label={`${t('customer.action.sms.label')} ${num}`}
            >
              <SmsIcon />
              <span className="customer-contact-card__action-label">{num}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

CustomerContactCard.propTypes = {
  onNavigate:  PropTypes.func,
  darkMode:    PropTypes.bool,
  mockProfile: PropTypes.object,
};

CustomerContactCard.defaultProps = {
  onNavigate: null,
  darkMode:   false,
};

export default CustomerContactCard;
