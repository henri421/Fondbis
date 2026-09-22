import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Bouton } from './ui/Bouton';

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
        <div className="min-h-screen bg-fond text-texte flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface border border-bordure rounded-rayon p-6 space-y-4">
            <div className="flex items-center gap-3 text-refus">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h1 className="text-lg font-semibold text-texte">Une erreur est survenue</h1>
                <p className="text-xs text-texte-doux">L'application a rencontré une exception inattendue.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-refus-fond p-3 rounded-rayon-petit border border-bordure text-xs font-mono text-refus max-h-36 overflow-y-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Bouton onClick={() => window.location.reload()} className="flex-1 justify-center">
                <RefreshCw className="w-3.5 h-3.5" />
                Recharger
              </Bouton>
              <Bouton onClick={this.handleReset}>
                Réinitialiser les données
              </Bouton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
