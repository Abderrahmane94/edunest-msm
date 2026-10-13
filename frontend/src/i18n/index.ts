import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import frCommon from './locales/fr/common.json';

// French comes with the site (it is also the fallback); Arabic is fetched by
// those who read in Arabic, and by the others once the first page is shown.
const resources = {
  fr: { common: frCommon },
};

const otherLanguages = {
  type: 'backend' as const,
  init(): void {},
  read(language: string, _namespace: string, callback: (error: unknown, data: Record<string, unknown> | null) => void): void {
    if (language !== 'ar') {
      callback(null, {});
      return;
    }
    import('./locales/ar/common.json').then(
      (module) => callback(null, module.default as Record<string, unknown>),
      (error) => callback(error, null),
    );
  },
};

i18n
  .use(otherLanguages)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    partialBundledLanguages: true,
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

// Switching language later must not wait for the network (or need it at all).
if (typeof window !== 'undefined') {
  window.setTimeout(() => void i18n.loadLanguages('ar').catch(() => {}), 4000);
}

export default i18n;
