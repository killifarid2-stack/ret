import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Keeps the last crash around so it can be inspected later (e.g. from the
// Admin panel) instead of vanishing the moment the screen goes black.
const CRASH_LOG_KEY = 'kyorugi_last_crash';

function logCrash(error: Error, info?: React.ErrorInfo) {
  try {
    const entry = {
      message: error.message,
      stack: error.stack,
      componentStack: info?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.hash,
    };
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(entry));
  } catch {
    // If localStorage itself is unavailable there's nothing more we can do.
  }
}

/**
 * Catches render-time errors anywhere below it in the tree.
 * Without this, any uncaught exception during render unmounts the whole
 * React tree and the app is left showing a black screen with no way to
 * recover except a hard reload (losing whatever match/tournament was open).
 * This shows a proper fallback with a "Reload" action instead, and keeps
 * the rest of the app (e.g. a different route) usable.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('WAB-TKD crash caught by ErrorBoundary:', error, info);
    logCrash(error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.hash = '#/';
  };

  render() {
    if (this.state.hasError) {
      const isPublicWindow = (() => {
        try {
          return new URLSearchParams(window.location.search).get('displayWindow') === 'public';
        } catch {
          return false;
        }
      })();

      if (isPublicWindow) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#03050a] text-white p-6" dir="ltr">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0f18] p-6 text-center space-y-4 shadow-2xl">
              <div className="text-red-400 text-4xl">⚠</div>
              <h1 className="text-lg font-black">PUBLIC DISPLAY ERROR</h1>
              <p className="text-sm text-white/60">The audience display encountered an unexpected error. The operator controls and internal navigation are hidden from this window.</p>
              {this.state.error && <p className="text-[10px] text-white/40 font-mono break-all">{this.state.error.message}</p>}
              <button onClick={this.handleReload} className="px-5 py-2 rounded-lg bg-yellow-400 text-black font-black">RELOAD DISPLAY</button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen gradient-dark flex items-center justify-center p-6">
          <div className="panel p-6 max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle size={40} className="text-[hsl(var(--destructive))]" />
            </div>
            <h1 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              توقف التطبيق عن العمل بشكل غير متوقع، لكن بياناتك المحفوظة (البطولات والمباريات) لم تتأثر.
              يمكنك إعادة تحميل التطبيق أو العودة للصفحة الرئيسية.
            </p>
            {this.state.error && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]/60 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg gradient-gold text-[hsl(var(--accent-foreground))] font-display font-bold text-sm flex items-center gap-2"
              >
                <RotateCcw size={16} /> إعادة تحميل
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-display font-bold text-sm flex items-center gap-2"
              >
                <Home size={16} /> الصفحة الرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
