import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Backpack, CalendarHeart, HeartHandshake, Languages, PiggyBank } from 'lucide-react';
import { BrandMark } from './BrandMark';
import {
  NurseryBalloon,
  NurseryBlocks,
  NurseryCloud,
  NurseryHills,
  NurseryRainbow,
  NurserySun,
} from './NurseryScene';

/**
 * The frame of the sign-in pages (login, invitation, password reset): a
 * nursery scene on large screens (sky, sun, hills, letter blocks), a small
 * sky band on a phone, the language switch, and the form on a soft card.
 * On a phone the band stays short so the form's button stays in view.
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
    { icon: Backpack, label: t('auth.features.students'), tint: 'bg-[#FFE1DD] text-[#D9534A]' },
    { icon: HeartHandshake, label: t('auth.features.people'), tint: 'bg-[#FFF0C7] text-[#C98A00]' },
    { icon: CalendarHeart, label: t('auth.features.attendance'), tint: 'bg-[#DDF3D8] text-[#3E9A45]' },
    { icon: PiggyBank, label: t('auth.features.finance'), tint: 'bg-[#DCEFFB] text-[#2B8AC2]' },
  ];
  const letters: [string, string, string] = isRtl ? ['أ', 'ب', 'ت'] : ['A', 'B', 'C'];

  return (
    <div className="min-h-screen flex bg-[#FFF9F1]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Nursery scene (large screens) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col p-12 relative overflow-hidden bg-gradient-to-b from-[#CDE9FF] via-[#E6F4FF] to-[#FFF6E8]">
        <NurserySun className="absolute top-8 end-10 w-32 h-32" />
        <NurseryCloud className="nest-drift absolute top-28 start-[38%] w-36 opacity-90" />
        <NurseryCloud className="nest-drift-slow absolute top-[42%] end-6 w-28 opacity-80" />
        <NurseryRainbow className="absolute bottom-24 start-[8%] w-[42%] max-w-[300px] opacity-80" />
        <NurseryHills className="absolute bottom-0 inset-x-0 w-full h-44" />
        <NurseryBlocks letters={letters} className="absolute bottom-10 end-[14%] w-36" />
        <NurseryBalloon className="absolute bottom-24 end-[6%] w-12" />

        <div className="relative z-10 flex items-center gap-3">
          <BrandMark size={56} className="shrink-0" />
          <span className="font-playful text-[#2E2A6B] text-2xl font-extrabold tracking-tight">{t('app.name')}</span>
        </div>

        <div className="relative z-10 mt-[12vh] max-w-xl space-y-8">
          <div>
            <h2 className="font-playful text-[2.75rem] font-extrabold text-[#2E2A6B] leading-[1.15] mb-3 whitespace-pre-line">
              {t('auth.hero.title')}
            </h2>
            <p className="text-[#5B5A7A] text-lg leading-relaxed">{t('auth.hero.subtitle')}</p>
          </div>
          <ul className="space-y-3">
            {features.map(({ icon: Icon, label, tint }) => (
              <li key={label} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <span className="text-[#3F3D5C] text-body font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="absolute bottom-4 start-12 z-10 text-[#2F6B32]/60 text-caption">© {new Date().getFullYear()} EduNest</p>
      </div>

      {/* Form column */}
      <div className="flex-1 flex flex-col relative">
        <button
          type="button"
          onClick={toggleLanguage}
          className="absolute top-4 end-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#EADFCF] bg-white/90 hover:bg-white text-text-secondary hover:text-foreground text-label font-medium transition"
          title={isRtl ? 'Français' : 'العربية'}
          aria-label={isRtl ? 'Français' : 'العربية'}
        >
          <Languages className="w-4 h-4" />
          <span>{isRtl ? 'FR' : 'ع'}</span>
        </button>

        {/* Sky band (phone and tablet) */}
        <div className="lg:hidden relative h-32 shrink-0 overflow-hidden bg-gradient-to-b from-[#CDE9FF] to-[#EAF5FF]">
          <NurserySun className="absolute -top-3 start-3 w-20 h-20" />
          <NurseryCloud className="nest-drift absolute top-5 end-20 w-20" />
          <NurseryCloud className="nest-drift-slow absolute top-3 start-[34%] w-12 opacity-80" />
          <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="absolute bottom-0 inset-x-0 w-full h-8" aria-hidden="true">
            <path d="M0 22 Q100 2 200 20 T400 16 V40 H0Z" fill="#FFF9F1" />
          </svg>
          <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2">
            <BrandMark size={48} className="shrink-0" />
            <span className="font-playful text-[#2E2A6B] text-xl font-extrabold">{t('app.name')}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 pt-2 pb-10 sm:px-6 sm:py-12">
          <div className="auth-soft w-full max-w-[420px] bg-card rounded-3xl border border-[#F1E6D6] shadow-[0_10px_30px_-12px_rgba(120,90,40,0.18)] p-6 sm:p-8">
            {children}
          </div>
        </div>

        {/* Hills and blocks under the form (phone and tablet) */}
        <div className="lg:hidden relative h-24 shrink-0 overflow-hidden" aria-hidden="true">
          <NurseryHills className="absolute bottom-0 inset-x-0 w-full h-16" />
          <NurseryBlocks letters={letters} className="absolute bottom-3 end-8 w-16" />
          <NurseryBalloon className="absolute bottom-6 end-[30%] w-6" />
        </div>
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
