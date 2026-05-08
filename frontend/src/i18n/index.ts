import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import arCommon from './locales/ar/common.json';
import frCommon from './locales/fr/common.json';

const resources = {
  ar: { common: arCommon },
  fr: { common: frCommon },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: ['ar', 'fr'],
    defaultNS: 'common',
    ns: ['common'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'preferred_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
