import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 dark:bg-amber-500/15 border-b border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 px-3.5 py-2 text-xs font-medium flex items-center justify-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span>Modalità offline attiva: i segnaposti salvati e il GPS restano utilizzabili.</span>
    </div>
  );
}
