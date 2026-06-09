import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Button, Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { fetchEmailAttachment as apiFetchEmailAttachment } from '../api';

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isPreviewable = (mimeType = '') =>
  mimeType.startsWith('image/') || mimeType === 'application/pdf';

// ─── Lightbox modal ───────────────────────────────────────────────────────────
const PreviewModal = ({ src, mimeType, filename, onClose }) => {
  const { t } = useI18n();
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="attachment-preview-modal"
      role="dialog"
      aria-modal="true"
      aria-label={filename}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="attachment-preview-modal__inner">
        <div className="attachment-preview-modal__header">
          <span className="attachment-preview-modal__title">{filename}</span>
          <button
            type="button"
            className="attachment-preview-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>
        <div className="attachment-preview-modal__body">
          {mimeType.startsWith('image/') ? (
            <img
              src={src}
              alt={filename}
              className="attachment-preview-modal__img"
            />
          ) : (
            <iframe
              src={src}
              title={filename}
              className="attachment-preview-modal__iframe"
            />
          )}
        </div>
      </div>
    </div>
  );
};
PreviewModal.propTypes = {
  src: PropTypes.string.isRequired,
  mimeType: PropTypes.string.isRequired,
  filename: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

// ─── Main AttachmentList ──────────────────────────────────────────────────────
const AttachmentList = ({ messageId, attachments }) => {
  const { t } = useI18n();
  const gmailToken = useSelector((state) => state.email.gmailToken.value);
  const [preview, setPreview] = useState(null); // { src, mimeType, filename }

  if (!attachments || attachments.length === 0) {
    return (
      <span className="attachment-list__empty">{t('email.attachments.noAttachments')}</span>
    );
  }

  const fetchBlob = async (attachment) => {
    if (!gmailToken || !messageId) return null;
    const data = await apiFetchEmailAttachment(messageId, attachment.attachmentId, gmailToken);
    if (!data?.data) return null;
    const binary = atob(data.data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
  };

  const handlePreview = async (attachment) => {
    try {
      const blob = await fetchBlob(attachment);
      if (!blob) return;
      const src = URL.createObjectURL(blob);
      setPreview({ src, mimeType: attachment.mimeType, filename: attachment.filename });
    } catch (err) {
      console.error('[AttachmentList] Preview error:', err);
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const blob = await fetchBlob(attachment);
      if (!blob) return;
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

  const handleClosePreview = useCallback(() => {
    if (preview?.src) URL.revokeObjectURL(preview.src);
    setPreview(null);
  }, [preview]);

  return (
    <>
      {preview && (
        <PreviewModal
          src={preview.src}
          mimeType={preview.mimeType}
          filename={preview.filename}
          onClose={handleClosePreview}
        />
      )}
      <div className="attachment-list">
        <span className="attachment-list__title">{t('email.attachments.title')}</span>
        <ul className="attachment-list__items">
          {attachments.map((att) => (
            <li key={att.attachmentId} className="attachment-list__item">
              <Icon name="file_16" className="attachment-list__icon" />
              {isPreviewable(att.mimeType) ? (
                <button
                  type="button"
                  className="attachment-list__name attachment-list__name--link"
                  title={t('email.attachments.preview')}
                  onClick={() => handlePreview(att)}
                >
                  {att.filename}
                </button>
              ) : (
                <span className="attachment-list__name" title={att.filename}>
                  {att.filename}
                </span>
              )}
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
    </>
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
