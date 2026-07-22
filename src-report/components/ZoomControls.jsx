import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';

/** Zoom in / out / reset controls for an interactive timeline viewport. */
export default function ZoomControls({ vp }) {
  const { t } = useI18n();
  return (
    <div className="zoomctl" role="group" aria-label={t('zoom.label')}>
      <Button color="default" size={28} circle ariaLabel={t('zoom.out')} title={t('zoom.out')} onClick={vp.zoomOut}>−</Button>
      <Button color="default" size={28} circle ariaLabel={t('zoom.reset')} title={t('zoom.reset')} disabled={!vp.isZoomed} onClick={vp.reset}>⤢</Button>
      <Button color="default" size={28} circle ariaLabel={t('zoom.in')} title={t('zoom.in')} onClick={vp.zoomIn}>+</Button>
    </div>
  );
}

ZoomControls.propTypes = {
  vp: PropTypes.object.isRequired,
};
