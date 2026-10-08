import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import i18n from '@/i18n';

interface Props {
  children: React.ReactNode;
  /** 'page': inside a layout, the menus stay usable. 'screen': the whole app. */
  variant?: 'page' | 'screen';
}

interface State {
  error: Error | null;
}

/** A newer version was deployed and this page's code files are gone: reloading fixes it. */
function isStaleBuild(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    error.message,
  );
}

/**
 * Catches a crash while displaying a page and shows a message with a way out
 * (reload, back to home) instead of a blank screen.
 */
class Boundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // Stale code after a deployment: reload once, quietly.
    if (isStaleBuild(error)) {
      try {
        if (!sessionStorage.getItem('stale-build-reload')) {
          sessionStorage.setItem('stale-build-reload', '1');
          window.location.reload();
        }
      } catch {
        // Storage unavailable: the message below offers to reload.
      }
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const t = i18n.t.bind(i18n);
    const screen = this.props.variant === 'screen';
    return (
      <div
        role="alert"
        className={
          screen
            ? 'min-h-screen flex items-center justify-center bg-page px-4'
            : 'flex items-center justify-center px-4 py-16'
        }
      >
        <div className="w-full max-w-[420px] bg-card border border-border rounded-xl p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--color-danger-muted)] flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div className="space-y-1">
            <h1 className="text-section font-semibold text-text-heading">{t('errors.crash.title')}</h1>
            <p className="text-body text-text-secondary">{t('errors.crash.message')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-body font-medium hover:bg-[var(--color-accent-hover)]"
            >
              <RotateCw className="w-4 h-4" />
              {t('errors.crash.reload')}
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card text-body font-medium text-foreground hover:bg-subtle"
            >
              <Home className="w-4 h-4" />
              {t('errors.crash.home')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Starts over on each page: a crash on one page doesn't stay when moving to another. */
export function ErrorBoundary({ children, variant = 'page' }: Props) {
  const { pathname } = useLocation();
  return (
    <Boundary key={pathname} variant={variant}>
      {children}
    </Boundary>
  );
}
