import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Sets the `dir` and `lang` attributes on the <html> element based on the current language.
 * Arabic → RTL, French → LTR.
 * Also toggles the `font-arabic` class on the document element for Tailwind font-family switching.
 */
export function useDirection() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const isArabic = i18n.language === 'ar';
    const dir = isArabic ? 'rtl' : 'ltr';

    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', i18n.language);

    // Toggle Arabic font class for Tailwind utility support
    if (isArabic) {
      document.documentElement.classList.add('font-arabic');
    } else {
      document.documentElement.classList.remove('font-arabic');
    }
  }, [i18n.language]);
}
