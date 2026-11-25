import { useEffect, useRef, useState } from 'react';
import { Download, Upload, X, Database } from 'lucide-react';
import { Spot } from '../types/spot';
import { isValidCoords } from '../utils/geo';
import { isSafeImageDataUrl } from '../utils/image';
import { isSafeAudioDataUrl } from '../utils/audio';

interface BackupModalProps {
  open: boolean;
  spotsCount: number;
  onExport: () => void;
  onImport: (spots: Spot[], skippedCount: number) => Promise<void>;
  onError: (msg: string) => void;
  onClose: () => void;
}

export function BackupModal({
  open,
  spotsCount,
  onExport,
  onImport,
  onError,
  onClose,
}: BackupModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onerror = () => {
      setImporting(false);
      onError('Impossibile leggere il file selezionato.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onload = async (e) => {
      try {
        const raw = e.target?.result;
        if (typeof raw !== 'string') throw new Error('Formato non valido');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Il file JSON deve contenere una lista');

        const validSpots: Spot[] = [];
        let skipped = 0;

        for (const item of parsed) {
          if (
            item &&
            typeof item === 'object' &&
            (typeof item.id === 'number' || (typeof item.id === 'string' && item.id.trim() !== '')) &&
            typeof item.title === 'string' &&
            item.title.trim() !== '' &&
            typeof item.lat === 'number' &&
            typeof item.lon === 'number' &&
            isValidCoords(item.lat, item.lon)
          ) {
            const safeCreatedAt =
              typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt))
                ? item.createdAt
                : new Date().toISOString();

            validSpots.push({
              id: item.id,
              title: item.title.trim(),
              city: typeof item.city === 'string' ? item.city.trim() : '',
              category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Altro',
              note: typeof item.note === 'string' ? item.note.trim() : '',
              lat: item.lat,
              lon: item.lon,
              photo: isSafeImageDataUrl(item.photo) ? item.photo : null,
              voiceMemo: isSafeAudioDataUrl(item.voiceMemo) ? item.voiceMemo : null,
              voiceMemoDuration:
                typeof item.voiceMemoDuration === 'number' &&
                Number.isFinite(item.voiceMemoDuration) &&
                item.voiceMemoDuration >= 0
                  ? item.voiceMemoDuration
                  : null,
              createdAt: safeCreatedAt,
            });
          } else {
            skipped += 1;
          }
        }

        if (validSpots.length === 0) {
          onError('Nessun segnaposto valido trovato nel file di backup.');
        } else {
          await onImport(validSpots, skipped);
          onClose();
        }
      } catch {
        onError('Errore nella lettura del file JSON. Verifica che sia un backup valido.');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-sky-200 dark:border-slate-800 bg-white dark:bg-[#111b27] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500" />
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Database className="w-4.5 h-4.5" />
              </span>
              <h3 id="backup-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Backup & Ripristino
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            I tuoi <span className="font-mono font-semibold tabular-nums text-sky-700 dark:text-sky-300">{spotsCount}</span> segnaposti, foto e memo vocali sono salvati localmente su questo dispositivo. Esporta un file JSON per conservarne una copia di sicurezza o trasferirli altrove.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onExport}
              disabled={spotsCount === 0}
              className="min-h-[48px] w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 transition-all whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Scarica Backup (.json)
            </button>

            <label className="min-h-[48px] w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-sky-300 dark:border-sky-500/40 bg-sky-50/70 dark:bg-sky-500/10 hover:bg-sky-100/70 dark:hover:bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-800 dark:text-sky-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              {importing ? 'Importazione in corso...' : 'Ripristina da file (.json)'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
                disabled={importing}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
