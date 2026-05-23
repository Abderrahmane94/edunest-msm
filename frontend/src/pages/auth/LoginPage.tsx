import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, LogIn, GraduationCap, Users, ClipboardCheck, BarChart3, Languages } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function getDefaultRoute(role?: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin': return '/admin';
    case 'teacher': return '/teacher';
    case 'parent': return '/parent';
    default: return '/admin';
  }
}

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleLanguage() {
    const newLang = i18n.language === 'ar' ? 'fr' : 'ar';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferred_language', newLang);
  }

  useEffect(() => {
    if (user) navigate(getDefaultRoute(user.role), { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginError'));
      setIsSubmitting(false);
    }
  }

  const features = [
    { icon: GraduationCap, label: t('auth.features.students') },
    { icon: Users,          label: t('auth.features.people') },
    { icon: ClipboardCheck, label: t('auth.features.attendance') },
    { icon: BarChart3,      label: t('auth.features.finance') },
  ];

  return (
    <div className="min-h-screen flex" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Left panel (branding) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[var(--color-accent)] relative overflow-hidden">
        <div className="absolute -top-24 -start-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -end-16 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 start-1/3 w-64 h-64 rounded-full bg-white/5" />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">E</span>
          </div>
          <span className="text-white text-xl font-bold tracking-tight">{t('app.name')}</span>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              {t('auth.hero.title')}
            </h2>
            <p className="text-white/70 text-lg leading-relaxed">
              {t('auth.hero.subtitle')}
            </p>
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

        <p className="relative z-10 text-white/40 text-caption">
          © {new Date().getFullYear()} EduNest
        </p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-page relative">

        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-hover text-text-secondary hover:text-foreground text-label font-medium transition"
          title={isRtl ? 'Français' : 'العربية'}
        >
          <Languages className="w-4 h-4" />
          <span>{isRtl ? 'FR' : 'ع'}</span>
        </button>

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
            <span className="text-white font-bold">E</span>
          </div>
          <span className="text-text-heading text-lg font-bold">{t('app.name')}</span>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h1 className="text-display font-bold text-text-heading">{t('auth.welcome')}</h1>
            <p className="text-body text-text-secondary mt-1">{t('auth.welcomeSub')}</p>
          </div>

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-[var(--color-danger-muted)] border border-danger/20 flex items-start gap-2">
              <span className="text-danger mt-0.5">⚠</span>
              <p className="text-body text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-label font-medium text-text-heading block mb-1.5">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  autoComplete="email"
                  className="w-full h-11 ps-10 pe-4 rounded-xl border border-border bg-card text-foreground text-body placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="text-label font-medium text-text-heading block mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none" />
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-11 ps-10 pe-4 rounded-xl border border-border bg-card text-foreground text-body placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold text-body flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-level-1"
            >
              {isSubmitting ? (
                <span className="animate-pulse">{t('common.loading')}</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {t('auth.login')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
