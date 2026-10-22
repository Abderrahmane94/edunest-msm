import { cn } from '@/lib/utils';

/** The four colours of the logo, top to bottom of the "i". */
export const BRAND_COLORS = ['#5751D5', '#16956C', '#D9691A', '#DC3157'] as const;

/**
 * The Kiddoo mark: the "i" of the logo, four pebbles stacked (a circle, a
 * bar, a dome, a bar). Drawn inline, so it shows offline too. Used where a
 * square mark is needed: beside a school's name, the favicon, the app icons.
 * Source file: public/favicon.svg.
 */
export function BrandMark({
  size = 32,
  className,
  title,
}: {
  size?: number;
  className?: string;
  /** Accessible name; without it the mark is decorative (the name is written next to it). */
  title?: string;
}) {
  const [indigo, green, orange, red] = BRAND_COLORS;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <circle cx="50" cy="19" r="13" fill={indigo} />
      <rect x="21" y="37" width="58" height="16" rx="8" fill={green} transform="rotate(-4 50 45)" />
      <path d="M25 76 C25 62 36 56 50 56 C64 56 75 62 75 76 C75 78 74 79 72 79 H28 C26 79 25 78 25 76 Z" fill={orange} />
      <rect x="22" y="82" width="56" height="13" rx="6.5" fill={red} transform="rotate(3 50 88)" />
    </svg>
  );
}

/**
 * The full logo, the written name with its pebble "i". One file per theme:
 * dark letters on light screens, light letters in dark mode.
 * Source files: public/kiddoo-logo.png and public/kiddoo-logo-light.png.
 */
export function KiddooLogo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex shrink-0', className)} dir="ltr" role="img" aria-label="Kiddoo">
      {onDark ? (
        <img src="/kiddoo-logo-light.png" alt="" width={1200} height={262} className="h-full w-auto" />
      ) : (
        <>
          <img src="/kiddoo-logo.png" alt="" width={1200} height={262} className="h-full w-auto dark:hidden" />
          <img src="/kiddoo-logo-light.png" alt="" width={1200} height={262} className="hidden h-full w-auto dark:block" />
        </>
      )}
    </span>
  );
}
