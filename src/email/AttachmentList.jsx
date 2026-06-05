import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { fetchEmailAttachment as apiFetchEmailAttachment } from '../api';

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentList = ({ messageId, attachments }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const gmailToken = useSelector((state) => state.email.gmailToken.value);

  if (!attachments || attachments.length === 0) {
    return (
      <span className="attachment-list__empty">{t('email.attachments.noAttachments')}</span>
    );
  }

  const handleDownload = async (attachment) => {
    if (!gmailToken || !messageId) return;

    try {
      const data = await apiFetchEmailAttachment(messageId, attachment.attachmentId, gmailToken);
      if (!data?.data) return;

      // Convert base64url to a blob and trigger download
      const binary = atob(data.data.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename || 'attachment';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[AttachmentList] Download error:', err);
    }
  };

  return (
    <div className="attachment-list">
      <span className="attachment-list__title">{t('email.attachments.title')}</span>
      <ul className="attachment-list__items">
        {attachments.map((att) => (
          <li key={att.attachmentId} className="attachment-list__item">
            <Icon name="file_16" className="attachment-list__icon" />
            <span className="attachment-list__name" title={att.filename}>
              {att.filename}
            </span>
            <span className="attachment-list__size">{formatFileSize(att.size)}</span>
            <Button
              ariaLabel={t('email.attachments.download')}
              className="attachment-list__download"
              size={28}
              color="none"
              onClick={() => handleDownload(att)}
            >
              <Icon name="download_16" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

AttachmentList.propTypes = {
  messageId: PropTypes.string,
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      attachmentId: PropTypes.string,
      filename: PropTypes.string,
      mimeType: PropTypes.string,
      size: PropTypes.number,
    })
  ),
};

AttachmentList.defaultProps = {
  messageId: null,
  attachments: [],
};

export default AttachmentList;
