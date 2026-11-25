import { useState } from 'react';
import { Download, Share, PlusSquare, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Installa app sul telefono"
        title="Installa come app (PWA)"
        className="min-h-[36px] px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs shadow-teal-600/25 transition-all whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Installa</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Installa su iPhone"
          title="Aggiungi a schermata Home (iPhone)"
          className="min-h-[36px] px-2.5 rounded-xl border border-teal-200 dark:border-teal-500/35 bg-teal-50 dark:bg-teal-500/15 hover:bg-teal-100 dark:hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Installa</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-teal-200 dark:border-slate-800 bg-white dark:bg-[#111b27] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-9 w-9 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4.5 h-4.5" />
                    </span>
                    <h3
                      id="ios-install-title"
                      className="text-base font-bold text-slate-900 dark:text-slate-100"
                    >
                      Installa su iPhone / iPad
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    aria-label="Chiudi"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="h-6 w-6 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Tocca il tasto{' '}
                      <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white">
                        Condividi <Share className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      </strong>{' '}
                      nella barra di Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Scorri e seleziona{' '}
                      <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white">
                        Aggiungi alla schermata Home{' '}
                        <PlusSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </strong>
                      .
                    </span>
                  </li>
                </ol>

                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all"
                >
                  Ho capito
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
