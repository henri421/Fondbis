import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';
import { Bouton } from './ui/Bouton';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <Bouton id="btn-pwa-install" onClick={install}>
        <Download className="w-3.5 h-3.5" />
        <span>Installer PWA</span>
      </Bouton>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <Bouton id="btn-pwa-install-ios" onClick={() => setShowIOSGuide(true)}>
          <Smartphone className="w-3.5 h-3.5" />
          <span>Installer sur iOS</span>
        </Bouton>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-rayon bg-surface border border-bordure p-6 text-texte">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Installer sur iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-rayon-petit hover:bg-surface-appui text-texte-faible hover:text-texte"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-texte-doux leading-relaxed mb-4">
                1. Appuyez sur le bouton <strong>Partager</strong> dans la barre d'outils Safari.<br />
                2. Faites défiler vers le bas et appuyez sur <strong>Sur l'écran d'accueil</strong>.
              </p>
              <Bouton onClick={() => setShowIOSGuide(false)} className="w-full justify-center">
                Compris
              </Bouton>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
