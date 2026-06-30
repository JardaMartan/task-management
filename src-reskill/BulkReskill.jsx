import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@momentum-ui/react';
import { useI18n } from './i18n/I18nContext';
import { initReskillWidget, loadConfig } from './store/slices/reskillSlice';
import TeamSelector from './components/TeamSelector';
import SkillMatrix from './components/SkillMatrix';
import ProfilesView from './components/ProfilesView';
import QuickActions from './components/QuickActions';
import ProfileQuickActions from './components/ProfileQuickActions';
import ReskillToolbar from './components/ReskillToolbar';
import ReviewDialog from './components/ReviewDialog';
import AnalyticsBar from './components/AnalyticsBar';

const BulkReskill = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const status = useSelector((s) => s.reskill.status);
  const errorMessage = useSelector((s) => s.reskill.errorMessage);
  const darkMode = useSelector((s) => s.reskill.darkMode);
  const viewMode = useSelector((s) => s.reskill.viewMode);

  const [reviewOpen, setReviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === 'idle') dispatch(initReskillWidget());
  }, [status, dispatch]);

  return (
    <div className={`reskill-root${darkMode ? ' md--dark' : ''}`}>
      {status === 'loading' && (
        <div className="reskill-empty">{t('app.loading')}</div>
      )}

      {status === 'error' && (
        <div className="reskill-empty">
          <div>
            <div>{t('app.error')}</div>
            {errorMessage && <div className="reskill-footer__note">{errorMessage}</div>}
            <div style={{ marginTop: 12 }}>
              <Button color="blue" onClick={() => dispatch(loadConfig())}>
                {t('app.retry')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="reskill-analytics">
            <AnalyticsBar />
          </div>
          <div className="reskill-body">
            <TeamSelector />
            {viewMode === 'profiles' ? <ProfilesView /> : <SkillMatrix />}
            {viewMode === 'profiles' ? <ProfileQuickActions /> : <QuickActions />}
          </div>
          <ReskillToolbar onReview={() => setReviewOpen(true)} />
        </>
      )}

      {reviewOpen && <ReviewDialog onClose={() => setReviewOpen(false)} />}
    </div>
  );
};

export default BulkReskill;
