import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="indicator-offline"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-rayon bg-alerte-fond border border-bordure text-alerte px-3.5 py-2 text-xs font-semibold"
    >
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>Mode Hors-ligne — Calculs et données locales actifs.</span>
    </div>
  );
};
