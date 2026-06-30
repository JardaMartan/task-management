import React, { createContext, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { translations, DEFAULT_LOCALE } from './translations';

function interpolate(template, vars) {
  if (!template || typeof template !== 'string') return template;
  // eslint-disable-next-line unicorn/prefer-string-replace-all
  return template.replace(/\{\{(\w+)\}\}/g, (match, k) => (vars && Object.hasOwn(vars, k) ? vars[k] : ''));
}

function getNested(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

export const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  t: (key) => key,
  setLocale: () => {}
});

export const I18nProvider = ({ children = null, initialLocale = DEFAULT_LOCALE }) => {
  const [locale, setLocale] = useState(initialLocale || DEFAULT_LOCALE);

  const value = useMemo(() => {
    const dict = translations[locale] || translations[DEFAULT_LOCALE];
    const t = (key, vars) => {
      const val = getNested(dict, key) ?? getNested(translations[DEFAULT_LOCALE], key) ?? key;
      if (typeof val === 'string') return interpolate(val, vars);
      return val;
    };
    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);

I18nProvider.propTypes = {
  children: PropTypes.node,
  initialLocale: PropTypes.string
};
