import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from './i18n/I18nContext';
import { initExperienceWidget, loadAll } from './store/slices/experienceSlice';
import SectionNav from './components/SectionNav';
import EmailSection from './components/EmailSection';
import Toolbar from './components/Toolbar';

const AgentExperience = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const status = useSelector((s) => s.experience.status);
  const errorMessage = useSelector((s) => s.experience.errorMessage);
  const darkMode = useSelector((s) => s.experience.darkMode);
  const source = useSelector((s) => s.experience.source);
  const activeSection = useSelector((s) => s.experience.activeSection);

  React.useEffect(() => {
    if (status === 'idle') dispatch(initExperienceWidget());
  }, [status, dispatch]);

  return (
    <div className={`exp-root${darkMode ? ' md--dark' : ''}`}>
      <div className="exp-header">
        <div className="exp-header__titles">
          <h1 className="exp-header__title">{t('app.title')}</h1>
          <p className="exp-header__subtitle">{t('app.subtitle')}</p>
        </div>
        <div className="exp-header__right">
          <span className={`exp-badge${source === 'live' ? ' exp-badge--live' : ''}`}>
            {source === 'live' ? t('app.liveBadge') : t('app.demoBadge')}
          </span>
          <SectionNav />
        </div>
      </div>

      {status === 'loading' && <div className="exp-empty exp-empty--center">{t('app.loading')}</div>}

      {status === 'error' && (
        <div className="exp-empty exp-empty--center">
          <div>
            <div>{t('app.error')}</div>
            {errorMessage && <div className="exp-muted">{errorMessage}</div>}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="exp-btn exp-btn--primary exp-btn--sm" onClick={() => dispatch(loadAll())}>
                {t('app.retry')}
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="exp-body">
            {activeSection === 'email' && <EmailSection />}
            {activeSection === 'chat' && (
              <div className="exp-empty exp-empty--center">{t('section.chatComingSoon')}</div>
            )}
          </div>
          <Toolbar />
        </>
      )}
    </div>
  );
};

export default AgentExperience;
