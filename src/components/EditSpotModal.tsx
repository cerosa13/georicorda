import { useEffect, useState } from 'react';
import { X, Save, Pencil } from 'lucide-react';
import { CATEGORIES, Spot } from '../types/spot';
import { getCategoryMeta } from '../utils/categoryIcons';
import { parseManualCoords } from '../utils/geo';
import { isSafeAudioDataUrl } from '../utils/audio';
import { VoiceMemoRecorder } from './VoiceMemoRecorder';

interface EditSpotModalProps {
  spot: Spot | null;
  onSave: (updated: Spot) => Promise<void>;
  onError: (msg: string) => void;
  onClose: () => void;
}

export function EditSpotModal({ spot, onSave, onError, onClose }: EditSpotModalProps) {
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [coordsText, setCoordsText] = useState('');
  const [voiceMemo, setVoiceMemo] = useState<string | null>(null);
  const [voiceMemoDuration, setVoiceMemoDuration] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!spot) return;
    setTitle(spot.title);
    setCity(spot.city || '');
    setCategory(spot.category || CATEGORIES[0]);
    setNote(spot.note || '');
    setCoordsText(`${spot.lat.toFixed(6)}, ${spot.lon.toFixed(6)}`);
    setVoiceMemo(isSafeAudioDataUrl(spot.voiceMemo) ? spot.voiceMemo : null);
    setVoiceMemoDuration(
      typeof spot.voiceMemoDuration === 'number' && Number.isFinite(spot.voiceMemoDuration)
        ? spot.voiceMemoDuration
        : null
    );
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

  const catMeta = getCategoryMeta(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      onError('Il titolo non può essere vuoto.');
      return;
    }

    const parsedCoords = parseManualCoords(coordsText);
    if (!parsedCoords) {
      onError('Coordinate non valide. Usa il formato "44.4812, 9.7654".');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...spot,
        title: cleanTitle,
        city: city.trim(),
        category,
        note: note.trim(),
        lat: parsedCoords.lat,
        lon: parsedCoords.lon,
        voiceMemo,
        voiceMemoDuration,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-spot-title"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b27] shadow-xl"
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${catMeta.topAccentClass}`} />

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Pencil className="w-4 h-4" />
              </span>
              <h3 id="edit-spot-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Modifica segnaposto
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

          <div>
            <label htmlFor="editTitle" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Titolo *
            </label>
            <input
              id="editTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0b131e] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="editCity" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Località / Comune
            </label>
            <input
              id="editCity"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0b131e] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="editCat" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Categoria
            </label>
            <select
              id="editCat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0b131e] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="editNote" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Note
            </label>
            <textarea
              id="editNote"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0b131e] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="editCoords" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Coordinate (lat, lon)
            </label>
            <input
              id="editCoords"
              type="text"
              value={coordsText}
              onChange={(e) => setCoordsText(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0b131e] px-3.5 py-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Memo vocale
            </span>
            <VoiceMemoRecorder
              voiceMemo={voiceMemo}
              voiceMemoDuration={voiceMemoDuration}
              onChange={(dataUrl, duration) => {
                setVoiceMemo(dataUrl);
                setVoiceMemoDuration(duration);
              }}
              onError={onError}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-sm font-semibold text-white flex items-center gap-2 shadow-sm shadow-teal-600/20 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Salva modifiche</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
