import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { List, ListItem, ListItemSection, Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';

const EVENT_ICONS = {
  call: 'handset_16',
  email: 'email_16',
  chat: 'chat_16',
  sms: 'sms-message_16',
  task: 'tasks_16',
};

const formatRelativeTime = (ts) => {
  if (!ts) return '';
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  } catch {
    return ts;
  }
};

const JdsTimeline = ({ darkMode }) => {
  const { t } = useI18n();
  const customerHistory = useSelector((state) => state.email.customerHistory);

  if (!customerHistory || customerHistory.length === 0) {
    return (
      <div className="jds-timeline--empty md-font-size--75">
        {t('email.customer.noHistory')}
      </div>
    );
  }

  return (
    <List
      className={`jds-timeline${darkMode ? ' md--dark' : ''}`}
      tabType="vertical"
    >
      {customerHistory.map((event, idx) => {
        const eventType = event.type || event.eventType || 'task';
        const iconName = EVENT_ICONS[eventType] || 'tasks_16';
        const timestamp = event.time || event.timestamp || event.createdAt;
        const label = event.channelType || eventType;
        const detail = event.direction || event.outcome || '';

        return (
          <ListItem
            key={event.id || idx}
            className={`jds-timeline__item jds-timeline__item--${eventType}`}
            isReadOnly
          >
            <ListItemSection position="left">
              <Icon name={iconName} />
            </ListItemSection>
            <ListItemSection position="center">
              <div className="jds-timeline__label">{label}{detail && ` · ${detail}`}</div>
              <div className="jds-timeline__time md-font-size--75">
                {formatRelativeTime(timestamp)}
              </div>
            </ListItemSection>
          </ListItem>
        );
      })}
    </List>
  );
};

JdsTimeline.propTypes = {
  darkMode: PropTypes.bool,
};

JdsTimeline.defaultProps = {
  darkMode: false,
};

export default JdsTimeline;
