import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  props: Props;
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erreur non interceptée dans l\'interface :', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h1 className="text-lg font-bold text-white">Une erreur est survenue</h1>
                <p className="text-xs text-slate-400">L'application a rencontré une exception inattendue.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-rose-300 max-h-36 overflow-y-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recharger
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Réinitialiser les données
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
