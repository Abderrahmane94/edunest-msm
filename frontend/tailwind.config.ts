import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* ─── Font Families ─── */
      fontFamily: {
        sans: [
          'Inter Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        arabic: [
          '"Noto Sans Arabic"',
          'Inter Variable',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'ui-monospace',
          'monospace',
        ],
      },

      /* ─── Colors (mapped to CSS custom properties) ─── */
      colors: {
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        input: 'var(--color-border)',
        ring: 'var(--color-accent)',
        background: 'var(--color-bg-page)',
        foreground: 'var(--color-text-primary)',

        // Semantic surfaces
        page: 'var(--color-bg-page)',
        card: {
          DEFAULT: 'var(--color-bg-card)',
          foreground: 'var(--color-text-primary)',
        },
        subtle: 'var(--color-bg-subtle)',
        hover: 'var(--color-bg-hover)',

        // Primary / Accent (Indigo)
        primary: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          muted: 'var(--color-accent-muted)',
          foreground: 'var(--color-text-inverse)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          muted: 'var(--color-accent-muted)',
          foreground: 'var(--color-text-inverse)',
        },

        // Semantic states
        success: {
          DEFAULT: 'var(--color-success)',
          muted: 'var(--color-success-muted)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          muted: 'var(--color-warning-muted)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          muted: 'var(--color-danger-muted)',
        },
        destructive: {
          DEFAULT: 'var(--color-danger)',
          foreground: 'var(--color-text-inverse)',
        },

        // Text
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-heading': 'var(--color-text-heading)',
        'text-disabled': 'var(--color-text-disabled)',
        'text-inverse': 'var(--color-text-inverse)',

        // Attendance / Finance status
        present: 'var(--color-present)',
        absent: 'var(--color-absent)',
        late: 'var(--color-late)',
        paid: 'var(--color-paid)',
        overdue: 'var(--color-overdue)',
        pending: 'var(--color-pending)',

        // shadcn/ui compatibility
        muted: {
          DEFAULT: 'var(--color-bg-subtle)',
          foreground: 'var(--color-text-secondary)',
        },
        popover: {
          DEFAULT: 'var(--color-bg-card)',
          foreground: 'var(--color-text-primary)',
        },
        secondary: {
          DEFAULT: 'var(--color-bg-subtle)',
          foreground: 'var(--color-text-primary)',
        },
      },

      /* ─── Border Radius ─── */
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },

      /* ─── Spacing (4px base unit) ─── */
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
      },

      /* ─── Box Shadows (Elevation System) ─── */
      boxShadow: {
        'level-0': 'none',
        'level-1':
          '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        'level-2':
          '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
        'level-3':
          '0 10px 30px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)',
        'level-4':
          '0 20px 60px rgba(15,23,42,0.15), 0 8px 16px rgba(15,23,42,0.08)',
        'focus-ring': '0 0 0 3px rgba(79,70,229,0.25)',
        'focus-danger': '0 0 0 3px rgba(220,38,38,0.20)',
      },

      /* ─── Font Sizes (Type Scale) ─── */
      fontSize: {
        micro: ['11px', { lineHeight: '1.3', letterSpacing: '0.2px' }],
        caption: ['12px', { lineHeight: '1.4' }],
        'caption-md': ['12px', { lineHeight: '1.4' }],
        label: ['13px', { lineHeight: '1.4', letterSpacing: '0.1px' }],
        body: ['14px', { lineHeight: '1.6' }],
        'body-lg': ['15px', { lineHeight: '1.6' }],
        subsection: ['16px', { lineHeight: '1.4' }],
        section: ['20px', { lineHeight: '1.3', letterSpacing: '-0.2px' }],
        'page-title': ['24px', { lineHeight: '1.25', letterSpacing: '-0.3px' }],
        display: ['30px', { lineHeight: '1.2', letterSpacing: '-0.5px' }],
      },

      /* ─── Keyframes & Animations (shadcn/ui) ─── */
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
        'fade-in': 'fade-in 150ms ease',
        'scale-in': 'scale-in 200ms ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
