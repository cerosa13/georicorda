import { useEffect, useRef, useState } from 'react';
import { Download, FileImage, Share2, X } from 'lucide-react';
import { Spot } from '../types/spot';
import { getCategoryMeta } from '../utils/categoryIcons';
import { InfographicResult, generateSpotInfographic } from '../utils/infographic';

interface SpotInfographicModalProps {
  spot: (Spot & { dist?: number | null }) | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export function SpotInfographicModal({
  spot,
  onSuccess,
  onError,
  onClose,
}: SpotInfographicModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InfographicResult | null>(null);
  const [canNativeShareFile, setCanNativeShareFile] = useState(false);

  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);
  onErrorRef.current = onError;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!spot) {
      setResult(null);
      setCanNativeShareFile(false);
      return;
    }

    let active = true;
    setLoading(true);
    setResult(null);

    generateSpotInfographic(spot)
      .then((res) => {
        if (!active) return;
        setResult(res);
        try {
          const testFile = new File([res.blob], res.filename, { type: 'image/png' });
          setCanNativeShareFile(
            Boolean(navigator.canShare && navigator.canShare({ files: [testFile] }))
          );
        } catch {
          setCanNativeShareFile(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        onErrorRef.current(
          err instanceof Error ? err.message : 'Impossibile generare l’infografica.'
        );
        onCloseRef.current();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [spot]);

  useEffect(() => {
    if (!spot) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [spot, onClose]);

  if (!spot) return null;

  const catMeta = getCategoryMeta(spot.category);

  const handleDownload = () => {
    if (!result) return;
    const objectUrl = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = result.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    onSuccess('Infografica PNG scaricata.');
  };

  const handleShareImage = async () => {
    if (!result || !navigator.share) return;
    try {
      const file = new File([result.blob], result.filename, { type: 'image/png' });
      await navigator.share({
        title: spot.title,
        text: `${spot.title} (${spot.lat.toFixed(5)}, ${spot.lon.toFixed(5)})`,
        files: [file],
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError('Impossibile condividere il file immagine da questo dispositivo.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="infographic-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b27] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${catMeta.topAccentClass} shrink-0`} />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-9 w-9 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <FileImage className="w-4.5 h-4.5" />
            </span>
            <div className="min-w-0">
              <h3
                id="infographic-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                Infografica segnaposto
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Anteprima scheda riepilogo PNG
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100/80 dark:bg-[#09111c] flex items-center justify-center">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <div className="mx-auto h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Creazione infografica in corso...
              </p>
            </div>
          ) : result ? (
            <img
              src={result.dataUrl}
              alt={`Infografica di ${spot.title}`}
              className="w-full max-w-[340px] rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700"
            />
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!result || loading}
            className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-teal-600/20 transition-all whitespace-nowrap"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Scarica PNG</span>
          </button>

          {canNativeShareFile && (
            <button
              type="button"
              onClick={handleShareImage}
              disabled={!result || loading}
              className="min-h-[46px] px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Condividi</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
