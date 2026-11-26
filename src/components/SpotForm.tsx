import { useRef, useState } from 'react';
import {
  Camera,
  LocateFixed,
  MapPin,
  Plus,
  X,
  Check,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { CATEGORIES, Coords, Spot } from '../types/spot';
import { getCategoryMeta } from '../utils/categoryIcons';
import { PlaceSearchResult, parseManualCoords, reverseGeocodeCity } from '../utils/geo';
import { compressImageFile } from '../utils/image';
import { PlaceSearchBox } from './PlaceSearchBox';
import { VoiceMemoRecorder } from './VoiceMemoRecorder';

interface SpotFormProps {
  currentCoords: Coords | null;
  onSave: (spot: Spot) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function SpotForm({ currentCoords, onSave, onNotify }: SpotFormProps) {
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [voiceMemo, setVoiceMemo] = useState<string | null>(null);
  const [voiceMemoDuration, setVoiceMemoDuration] = useState<number | null>(null);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [searchedPlace, setSearchedPlace] = useState<PlaceSearchResult | null>(null);
  const [detectingCity, setDetectingCity] = useState(false);
  const [saving, setSaving] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const manualTrimmed = manualInput.trim();
  const parsedManual = manualTrimmed ? parseManualCoords(manualTrimmed) : null;
  const searchedCoords: Coords | null = searchedPlace
    ? { lat: searchedPlace.lat, lon: searchedPlace.lon }
    : null;
  const effectiveCoords = parsedManual || searchedCoords || currentCoords;

  const handleDetectCity = async () => {
    if (!effectiveCoords) {
      onNotify('error', 'Posizione GPS non ancora disponibile. Attendi o inserisci le coordinate.');
      return;
    }
    setDetectingCity(true);
    try {
      const detected = await reverseGeocodeCity(effectiveCoords.lat, effectiveCoords.lon);
      if (detected) {
        setCity(detected);
        onNotify('success', `Comune rilevato: ${detected}`);
      } else {
        onNotify('info', 'Comune non trovato per queste coordinate. Puoi scriverlo manualmente.');
      }
    } catch {
      onNotify('error', 'Rete non disponibile per rilevare il comune. Puoi inserirlo a mano.');
    } finally {
      setDetectingCity(false);
    }
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPhoto(compressed);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Errore nel caricamento della foto.');
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleClearPhoto = () => {
    setPhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      onNotify('error', 'Inserisci almeno un titolo breve per ricordare il punto.');
      titleInputRef.current?.focus();
      return;
    }

    if (manualTrimmed && !parsedManual) {
      onNotify('error', 'Coordinate manuali non valide. Usa il formato "44.4812, 9.7654" o un link Google Maps completo.');
      return;
    }

    if (!effectiveCoords) {
      onNotify('error', 'Posizione GPS non ancora agganciata. Attendi qualche secondo o inserisci le coordinate manualmente.');
      return;
    }

    setSaving(true);
    try {
      const newSpot: Spot = {
        id: Date.now(),
        title: cleanTitle,
        city: city.trim(),
        category: selectedCat,
        note: note.trim(),
        lat: effectiveCoords.lat,
        lon: effectiveCoords.lon,
        photo,
        voiceMemo,
        voiceMemoDuration,
        createdAt: new Date().toISOString(),
      };

      await onSave(newSpot);

      setTitle('');
      setCity('');
      setNote('');
      setManualInput('');
      setSearchedPlace(null);
      setShowManualCoords(false);
      setVoiceMemo(null);
      setVoiceMemoDuration(null);
      handleClearPhoto();
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSearchedPlace = (place: PlaceSearchResult | null) => {
    const prevName = searchedPlace?.name ?? '';
    setSearchedPlace(place);

    if (place) {
      if (!title.trim() || title.trim() === prevName) {
        setTitle(place.name);
      }
      if (place.city) {
        setCity(place.city);
      }
    }
  };

  const activeCatMeta = getCategoryMeta(selectedCat);

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-3xl border border-sky-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#111b27]/95 shadow-md shadow-sky-900/5 dark:shadow-black/30"
    >
      {/* Colorful top gradient hairline */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${activeCatMeta.topAccentClass}`} />

      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25 shrink-0">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                Nuovo segnaposto
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Salva posizione, foto e memo vocale
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowManualCoords((prev) => {
                const next = !prev;
                if (next) {
                  window.setTimeout(() => manualInputRef.current?.focus(), 40);
                }
                return next;
              });
            }}
            className={`min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              showManualCoords
                ? 'border-sky-500/50 bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1622] text-slate-600 dark:text-slate-300 hover:bg-sky-50/70 dark:hover:bg-slate-800'
            }`}
          >
            {showManualCoords ? 'Nascondi GPS' : 'Coordinate'}
          </button>
        </div>

        <div className="space-y-3.5">
          {showManualCoords && (
            <div className="rounded-2xl border border-sky-200 dark:border-sky-500/35 bg-sky-50/70 dark:bg-sky-500/10 p-3">
              <label
                htmlFor="manualInput"
                className="block text-xs font-semibold text-sky-900 dark:text-sky-200 mb-1.5"
              >
                Coordinate manuali (lat, lon) o link Google Maps
              </label>
              <input
                ref={manualInputRef}
                id="manualInput"
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Es. 44.31735, 9.32492"
                className="w-full min-h-[44px] rounded-xl border border-sky-200 dark:border-sky-500/30 bg-white dark:bg-[#0b131e] px-3.5 py-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-colors"
              />
              {manualTrimmed && (
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  {parsedManual ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                        Coordinate rilevate: {parsedManual.lat.toFixed(5)}, {parsedManual.lon.toFixed(5)}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-amber-700 dark:text-amber-400">
                        Coordinate non riconosciute. Inserisci latitudine e longitudine (es. 44.31735, 9.32492).
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <PlaceSearchBox
            currentCoords={currentCoords}
            selectedPlace={searchedPlace}
            onSelectPlace={handleSelectSearchedPlace}
            onNotify={onNotify}
          />

          <div>
            <label
              htmlFor="titleInput"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Cosa hai trovato? *
            </label>
            <input
              ref={titleInputRef}
              id="titleInput"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Parcheggio gratuito lungolago, Bagno pulito..."
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-[#0b131e] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="cityInput"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Località o Comune
            </label>
            <div className="flex gap-2">
              <input
                id="cityInput"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Es. Gardone Riviera, Chiavari..."
                className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-[#0b131e] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
              />
              <button
                type="button"
                onClick={handleDetectCity}
                disabled={detectingCity}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <LocateFixed className={`w-4 h-4 ${detectingCity ? 'animate-spin' : ''}`} />
                <span>{detectingCity ? 'Rilevo...' : 'Rileva'}</span>
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Categoria
            </span>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const meta = getCategoryMeta(cat);
                const Icon = meta.icon;
                const isActive = cat === selectedCat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCat(cat)}
                    className={`min-h-[56px] px-2 py-2 rounded-2xl border text-xs font-medium flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-[0.97] ${
                      isActive
                        ? `${meta.activeControlClass} font-semibold`
                        : 'bg-slate-50/90 dark:bg-[#0b131e] border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : `${meta.iconBgClass} ${meta.iconTextClass}`
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </span>
                    <span className="leading-tight line-clamp-1 w-full text-[11px]">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="noteInput"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Note utili (opzionale)
            </label>
            <textarea
              id="noteInput"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. Disco orario 2 ore, chiave al bancone, fungaia sotto castagno..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-[#0b131e] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors resize-y"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className="flex-1 min-h-[46px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-sky-300 dark:border-sky-500/40 bg-sky-50/70 dark:bg-sky-500/10 hover:bg-sky-100/70 dark:hover:bg-sky-500/15 px-3.5 py-2.5 text-xs font-semibold text-sky-800 dark:text-sky-200 cursor-pointer transition-colors">
                <Camera className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>{photo ? 'Sostituisci foto' : 'Scatta o allega foto'}</span>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>

              {photo && (
                <button
                  type="button"
                  onClick={handleClearPhoto}
                  aria-label="Rimuovi foto"
                  className="min-h-[46px] px-3.5 rounded-xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  <X className="w-4 h-4" />
                  Rimuovi
                </button>
              )}
            </div>

            {photo && (
              <div className="mt-2.5 overflow-hidden rounded-xl border border-sky-200 dark:border-slate-800">
                <img
                  src={photo}
                  alt="Anteprima allegato"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-44 object-cover"
                />
              </div>
            )}
          </div>

          <VoiceMemoRecorder
            voiceMemo={voiceMemo}
            voiceMemoDuration={voiceMemoDuration}
            onChange={(dataUrl, duration) => {
              setVoiceMemo(dataUrl);
              setVoiceMemoDuration(duration);
            }}
            onError={(msg) => onNotify('error', msg)}
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:via-teal-500 hover:to-sky-500 active:scale-[0.99] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-teal-600/25 transition-all"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>
              {saving
                ? 'Salvataggio...'
                : searchedPlace
                  ? 'Salva luogo cercato'
                  : 'Salva segnaposto qui'}
            </span>
          </button>

          {!effectiveCoords && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>
                In attesa del GPS: puoi cercare un luogo qui sopra o inserire le coordinate.
              </span>
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
