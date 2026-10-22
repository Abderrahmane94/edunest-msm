import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Backpack, Banknote, CalendarHeart, HeartHandshake, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND_COLORS, BrandMark, KiddooLogo } from './BrandMark';

/** The website's heading face: straight and bold, in French and in Arabic. */
const SITE_HEADING_FONT = "'Plus Jakarta Sans', 'Noto Sans Arabic', system-ui, sans-serif";

/** The logo's four pebbles, as on the website: circle, bar, dome, bar. */
const PEBBLES = {
  circle: 'M12 2a10 10 0 1 1 0 20a10 10 0 1 1 0-20z',
  slab: 'M2.6 8.6c0-1.6.7-2.1 2.2-2.1 5-.2 9.3.1 13.3 1.5 1.8.6 2.4 1.5 2.4 3.4 0 1.9-.6 2.6-2.2 3-3.4.7-6.6.8-9.6.7-2.3.1-5.2.1-5.6-1.2-.4-1.2-.5-3.1-.5-5.3z',
  dome: 'M1.8 17.4c.6-3.6 3.4-8.4 8.2-8.7 5-.3 8.8 3.2 10.3 8.3.5 1.6-.3 2.3-2.1 2.3-4.1-.5-7.2-1-11-1.5-3.6-.4-5.6-.8-5.4-.4z',
  slab2: 'M2.8 16.6c-.4-2.3 1-4 3.3-4.6 3.6-.9 7-1.3 10.6-.6 1.5.3 2.1 1 2.5 2.3.6 1.9.7 3.5.6 4.7 0 .6-.4.9-1 .9H5.4c-1.4 0-2.3-.6-2.6-2.7z',
} as const;

function Pebble({ shape, color, className, style }: { shape: keyof typeof PEBBLES; color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('absolute pointer-events-none', className)} style={style} aria-hidden="true" focusable="false">
      <path d={PEBBLES[shape]} fill={color} />
    </svg>
  );
}

/** Soft tints of the logo colours, for the large background pebbles. */
const SOFT = ['#E7E5FA', '#DDF1E8', '#FBE7D9', '#FADDE4'] as const;

/** The four colours as a short line, the site's signature above a title. */
function Stripe({ className }: { className?: string }) {
  return (
    <span className={cn('kd-stripe flex gap-1', className)} aria-hidden="true">
      {BRAND_COLORS.map((c) => (
        <i key={c} className="block h-1 w-5 rounded-full" style={{ background: c }} />
      ))}
    </span>
  );
}

/**
 * The frame of the sign-in pages (login, invitation, password reset), in the
 * website's look: the logo, its four pebbles drifting behind the text, the
 * features on pebble-shaped tiles. On a phone a short band carries the logo,
 * so the form's button stays in view. The form sits on a white card.
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

  const [indigo, green, orange, red] = BRAND_COLORS;
  // Each feature on one of the logo's pebbles, in its colour.
  const features = [
    { icon: Backpack, label: t('auth.features.students'), color: indigo, radius: '50%' },
    { icon: HeartHandshake, label: t('auth.features.people'), color: green, radius: '12px 22px 18px 10px / 12px 18px 20px 10px' },
    { icon: CalendarHeart, label: t('auth.features.attendance'), color: orange, radius: '50% 50% 10px 10px / 60% 60% 10px 10px' },
    { icon: Banknote, label: t('auth.features.finance'), color: red, radius: '20px 14px 8px 18px / 18px 12px 8px 16px' },
  ];

  return (
    <div className="min-h-screen flex bg-[#FBFAFE]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Brand panel (large screens) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col p-12 relative overflow-hidden isolate bg-gradient-to-br from-[#EEEDFB] via-[#F7F6FE] to-[#FFF4EA]">
        <Pebble shape="circle" color={SOFT[0]} className="kd-drift -z-10 -top-32 -end-32 w-[30rem] h-[30rem]" />
        <Pebble shape="slab" color={SOFT[1]} className="kd-drift-slow -z-10 -bottom-24 -start-24 w-[26rem] h-[26rem]" style={{ rotate: '-10deg' }} />
        <Pebble shape="dome" color={SOFT[2]} className="kd-drift -z-10 top-[38%] -start-24 w-64 h-64" style={{ animationDelay: '-6s' }} />
        <Pebble shape="slab2" color={SOFT[3]} className="kd-drift-slow -z-10 top-24 start-[42%] w-40 h-40" style={{ rotate: '8deg' }} />

        {/* The logo's "i", large, floating */}
        <BrandMark size={176} className="kd-bob absolute bottom-14 end-12 -z-10 drop-shadow-[0_20px_30px_rgba(79,73,207,0.18)]" />

        <KiddooLogo className="relative h-10 kd-rise" />

        <div className="relative mt-[14vh] max-w-xl">
          <Stripe className="mb-6" />
          <h2 className="kd-rise text-[2.75rem] font-extrabold text-[#111018] leading-[1.15] tracking-tight mb-4 whitespace-pre-line" style={{ animationDelay: '.08s', fontFamily: SITE_HEADING_FONT }}>
            {t('auth.hero.title')}
          </h2>
          <p className="kd-rise text-[#5D5A6B] text-lg leading-relaxed max-w-md" style={{ animationDelay: '.16s' }}>
            {t('auth.hero.subtitle')}
          </p>
          <ul className="mt-10 space-y-4">
            {features.map(({ icon: Icon, label, color, radius }, i) => (
              <li key={label} className="kd-rise flex items-center gap-4" style={{ animationDelay: `${0.24 + i * 0.07}s` }}>
                <span className="w-11 h-10 flex items-center justify-center shrink-0 text-white shadow-[0_8px_18px_-10px_rgba(17,16,24,0.5)]" style={{ background: color, borderRadius: radius }}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-[#2B2938] text-body-lg font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="absolute bottom-5 start-12 text-[#5D5A6B]/70 text-caption">© {new Date().getFullYear()} Kiddoo</p>
      </div>

      {/* Form column */}
      <div className="flex-1 flex flex-col relative">
        <button
          type="button"
          onClick={toggleLanguage}
          className="absolute top-4 end-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E4E2F2] bg-white/90 hover:bg-white text-text-secondary hover:text-foreground text-label font-medium transition"
          title={isRtl ? 'Français' : 'العربية'}
          aria-label={isRtl ? 'Français' : 'العربية'}
        >
          <Languages className="w-4 h-4" />
          <span>{isRtl ? 'FR' : 'ع'}</span>
        </button>

        {/* Logo band (phone and tablet) */}
        <div className="lg:hidden relative h-32 shrink-0 overflow-hidden isolate bg-gradient-to-br from-[#EEEDFB] to-[#FFF4EA]">
          <Pebble shape="circle" color={SOFT[0]} className="kd-drift -z-10 -top-16 -end-10 w-44 h-44" />
          <Pebble shape="slab" color={SOFT[1]} className="kd-drift-slow -z-10 -bottom-14 -start-10 w-48 h-48" />
          <Pebble shape="dome" color={SOFT[2]} className="-z-10 top-2 start-[30%] w-16 h-16" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <KiddooLogo className="h-9" />
            <Stripe />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 pt-6 pb-10 sm:px-6 sm:py-12">
          <div className="auth-soft kd-rise w-full max-w-[420px] bg-white rounded-3xl border border-[#ECEAF6] shadow-[0_24px_60px_-28px_rgba(79,73,207,0.35)] p-6 sm:p-8">
            {children}
          </div>
          <p className="lg:hidden mt-8 text-[#5D5A6B]/70 text-caption">© {new Date().getFullYear()} Kiddoo</p>
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
