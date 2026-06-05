import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { List, ListItem, ListItemSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { fetchEmailThread } from '../store/slices/emailSlice';

const OtherThreadsList = ({ darkMode }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const customerThreads = useSelector((state) => state.email.customerThreads);
  const activeEmail = useSelector((state) => state.email.activeEmail);

  if (!customerThreads || customerThreads.length === 0) {
    return (
      <div className="other-threads--empty md-font-size--75">
        {t('email.customer.noThreads')}
      </div>
    );
  }

  const handleSelect = (e, value) => {
    if (value && value !== activeEmail?.threadId) {
      dispatch(fetchEmailThread(value));
    }
  };

  return (
    <List
      className={`other-threads${darkMode ? ' md--dark' : ''}`}
      onSelect={handleSelect}
      trackActive
    >
      {customerThreads.map((thread) => {
        const isActive = thread.threadId === activeEmail?.threadId;
        return (
          <ListItem
            key={thread.threadId}
            value={thread.threadId}
            active={isActive}
            className={`other-threads__item${isActive ? ' other-threads__item--active' : ''}`}
            title={thread.snippet || thread.threadId}
          >
            <ListItemSection position="center">
              <div className="other-threads__snippet">
                {thread.snippet || thread.threadId}
              </div>
            </ListItemSection>
          </ListItem>
        );
      })}
    </List>
  );
};

OtherThreadsList.propTypes = {
  darkMode: PropTypes.bool,
};

OtherThreadsList.defaultProps = {
  darkMode: false,
};

export default OtherThreadsList;
