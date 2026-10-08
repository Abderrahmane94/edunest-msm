import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, ClipboardCheck, GraduationCap, Languages, Users } from 'lucide-react';

/**
 * The frame of the sign-in pages (login, invitation, password reset): the
 * brand panel on large screens, the language switch, and the form column.
 * On a phone the form starts near the top so its button stays in view.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  function toggleLanguage() {
    const next = isRtl ? 'fr' : 'ar';
    i18n.changeLanguage(next);
    try {
      localStorage.setItem('preferred_language', next);
    } catch {
      // Storage unavailable: the language still changes for this visit.
    }
  }

  const features = [
    { icon: GraduationCap, label: t('auth.features.students') },
    { icon: Users, label: t('auth.features.people') },
    { icon: ClipboardCheck, label: t('auth.features.attendance') },
    { icon: BarChart3, label: t('auth.features.finance') },
  ];

  return (
    <div className="min-h-screen flex" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Brand panel (large screens) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[var(--color-accent)] relative overflow-hidden">
        <div className="absolute -top-24 -start-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -end-16 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 start-1/3 w-64 h-64 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">E</span>
          </div>
          <span className="text-white text-xl font-bold tracking-tight">{t('app.name')}</span>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">{t('auth.hero.title')}</h2>
            <p className="text-white/70 text-lg leading-relaxed">{t('auth.hero.subtitle')}</p>
          </div>
          <ul className="space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/90 text-body">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-white/40 text-caption">© {new Date().getFullYear()} EduNest</p>
      </div>

      {/* Form column */}
      <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-6 pt-16 pb-10 sm:py-12 bg-page relative">
        <button
          type="button"
          onClick={toggleLanguage}
          className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-hover text-text-secondary hover:text-foreground text-label font-medium transition"
          title={isRtl ? 'Français' : 'العربية'}
          aria-label={isRtl ? 'Français' : 'العربية'}
        >
          <Languages className="w-4 h-4" />
          <span>{isRtl ? 'FR' : 'ع'}</span>
        </button>

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
            <span className="text-white font-bold">E</span>
          </div>
          <span className="text-text-heading text-lg font-bold">{t('app.name')}</span>
        </div>

        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}

/** Title and one line under it, at the top of a sign-in form. */
export function AuthHeading({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-display font-bold text-text-heading">{title}</h1>
      {subtitle && <p className="text-body text-text-secondary mt-1">{subtitle}</p>}
    </div>
  );
}
