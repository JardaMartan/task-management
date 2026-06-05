import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectOption,
  Label,
} from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { submitWrapUp, setWrapUp } from '../store/slices/emailSlice';

const WRAPUP_REASONS = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'follow_up', label: 'Follow Up Required' },
  { value: 'no_action', label: 'No Action Needed' },
  { value: 'other', label: 'Other' },
];

const WrapUpDialog = ({ interactionId, darkMode }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const wrapUp = useSelector((state) => state.email.wrapUp);
  const isSending = useSelector((state) => state.email.isSending);
  const sendResult = useSelector((state) => state.email.sendResult);

  const [visible, setVisible] = useState(false);

  const shouldPromptWrapUp = sendResult?.success && !wrapUp.submitted;

  if (wrapUp.submitted) return null;

  if (!shouldPromptWrapUp && !visible) {
    return (
      <div className="wrapup-trigger">
        <Button
          ariaLabel={t('email.wrapup.title')}
          size={28}
          color="none"
          onClick={() => setVisible(true)}
        >
          {t('email.wrapup.title')}
        </Button>
      </div>
    );
  }

  const handleReasonSelect = (selected) => {
    const value = Array.isArray(selected) ? selected[0]?.value : selected;
    if (value) dispatch(setWrapUp({ reason: value }));
  };

  const handleNotesChange = (e) => {
    dispatch(setWrapUp({ notes: e.target.value }));
  };

  const handleSubmit = () => {
    dispatch(submitWrapUp(interactionId, { reason: wrapUp.reason, notes: wrapUp.notes }));
  };

  const handleCancel = () => {
    setVisible(false);
  };

  return (
    <Modal
      applicationId="email-widget"
      htmlId="wrapup-modal"
      show={shouldPromptWrapUp || visible}
      onHide={handleCancel}
      size="small"
      className={darkMode ? 'md--dark' : ''}
    >
      <ModalHeader>
        <div>{t('email.wrapup.title')}</div>
      </ModalHeader>
      <ModalBody>
        <div className="wrapup-dialog__field">
          <Label
            htmlFor="wrapup-reason-select"
            label={t('email.wrapup.reason')}
          />
          <Select
            id="wrapup-reason-select"
            defaultValue={WRAPUP_REASONS[0].label}
            onSelect={handleReasonSelect}
          >
            {WRAPUP_REASONS.map((r) => (
              <SelectOption key={r.value} value={r.value} label={r.label} />
            ))}
          </Select>
        </div>
        <div className="wrapup-dialog__field">
          <Input
            name="wrapup-notes"
            label={t('email.wrapup.notes')}
            value={wrapUp.notes || ''}
            onChange={handleNotesChange}
            placeholder={t('email.wrapup.notesPlaceholder')}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          ariaLabel={t('email.wrapup.cancel')}
          size={36}
          color="none"
          onClick={handleCancel}
        >
          {t('email.wrapup.cancel')}
        </Button>
        <Button
          ariaLabel={t('email.wrapup.submit')}
          size={36}
          color="blue"
          onClick={handleSubmit}
          disabled={!wrapUp.reason || isSending}
        >
          {t('email.wrapup.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

WrapUpDialog.propTypes = {
  interactionId: PropTypes.string.isRequired,
  darkMode: PropTypes.bool,
};

WrapUpDialog.defaultProps = {
  darkMode: false,
};

export default WrapUpDialog;
