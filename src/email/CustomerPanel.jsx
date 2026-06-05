import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardSection, Tabs, Tab, TabList, TabContent, TabPane } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import OtherThreadsList from './OtherThreadsList';
import JdsTimeline from './JdsTimeline';

const CustomerPanel = ({ darkMode }) => {
  const { t } = useI18n();

  return (
    <Card className={`customer-panel${darkMode ? ' md--dark' : ''}`}>
      <CardSection full>
        <Tabs>
          <TabList>
            <Tab heading={t('email.customer.threads')} />
            <Tab heading={t('email.customer.jds')} />
          </TabList>
          <TabContent>
            <TabPane>
              <OtherThreadsList darkMode={darkMode} />
            </TabPane>
            <TabPane>
              <JdsTimeline darkMode={darkMode} />
            </TabPane>
          </TabContent>
        </Tabs>
      </CardSection>
    </Card>
  );
};

CustomerPanel.propTypes = {
  darkMode: PropTypes.bool,
};

CustomerPanel.defaultProps = {
  darkMode: false,
};

export default CustomerPanel;
