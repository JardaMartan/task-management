import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { initiateOutdialCall, cancelOutdialCall } from '../store/slices/widgetSlice';

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
  const outdialEntryPointId = useSelector((s) => s.widget?.widgetConfig?.outdialEntryPointId);
  const outdialPending      = useSelector((s) => s.widget?.outdialPending);

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
              // Replace the dial button with a "Calling…" status pill + cancel button
              return (
                <span key={`phone-${num}`} className="customer-contact-card__calling-pill">
                  <span className="customer-contact-card__calling-dot" aria-hidden="true" />
                  <span className="customer-contact-card__calling-label">
                    {t('customer.action.calling') || 'Calling'} {num}
                  </span>
                  <button
                    type="button"
                    className="customer-contact-card__cancel-call-btn"
                    onClick={handleCancelCall}
                    title={t('customer.action.cancelCall') || 'Cancel call'}
                    aria-label={t('customer.action.cancelCall') || 'Cancel call'}
                  >
                    <Icon name="cancel_16" />
                  </button>
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
