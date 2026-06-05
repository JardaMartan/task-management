import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Card, CardSection } from '@momentum-ui/react';
import EmailViewer from './EmailViewer';
import AttachmentList from './AttachmentList';

/**
 * Center reading pane: shows the currently selected email with optional
 * collapsed AI summary, full body, and attachment thumbnails.
 */
const EmailReadingPane = ({ darkMode }) => {
  const activeEmail = useSelector((state) => state.email.activeEmail);

  if (!activeEmail) return null;

  return (
    <Card className={`reading-pane${darkMode ? ' md--dark' : ''}`}>
      <CardSection full>
        <EmailViewer bodyHtml={activeEmail.bodyHtml} bodyText={activeEmail.bodyText} darkMode={darkMode} />
        {activeEmail.attachments?.length > 0 && (
          <AttachmentList
            messageId={activeEmail.messageId}
            attachments={activeEmail.attachments}
          />
        )}
      </CardSection>
    </Card>
  );
};

EmailReadingPane.propTypes = { darkMode: PropTypes.bool };
EmailReadingPane.defaultProps = { darkMode: false };

export default EmailReadingPane;
