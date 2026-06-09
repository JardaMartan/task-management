import React from 'react';
import PropTypes from 'prop-types';
import ReplyComposer from './ReplyComposer';

/**
 * OutboundEmailComposer
 *
 * Thin wrapper that renders ReplyComposer in outbound mode — creating a brand-new
 * email thread instead of replying to an existing one.  All advanced features
 * (AI corrections, tone adjustment, proofread, templates, formatting toolbar,
 * signatures, attachments) are provided by ReplyComposer automatically.
 */
const OutboundEmailComposer = ({ initialTo, darkMode, onCancel }) => (
  <ReplyComposer
    outboundMode
    initialTo={initialTo}
    darkMode={darkMode}
    onCancel={onCancel}
  />
);

OutboundEmailComposer.propTypes = {
  initialTo: PropTypes.string,
  darkMode:  PropTypes.bool,
  onCancel:  PropTypes.func,
};

OutboundEmailComposer.defaultProps = {
  initialTo: '',
  darkMode:  false,
  onCancel:  null,
};

export default OutboundEmailComposer;
