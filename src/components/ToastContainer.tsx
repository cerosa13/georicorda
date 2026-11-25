import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types/spot';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-4 left-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;

        const borderClass =
          toast.type === 'success'
            ? 'border-emerald-200 dark:border-emerald-500/35'
            : toast.type === 'error'
              ? 'border-rose-200 dark:border-rose-500/35'
              : 'border-sky-200 dark:border-sky-500/35';

        const iconColor =
          toast.type === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : toast.type === 'error'
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-sky-600 dark:text-sky-400';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl border ${borderClass} bg-white/95 dark:bg-[#111b27]/95 backdrop-blur-md px-4 py-3 shadow-lg text-sm text-slate-900 dark:text-slate-100`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
            <p className="flex-1 leading-snug">{toast.text}</p>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  onDismiss(toast.id);
                }}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 px-1 py-1"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Chiudi notifica"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
