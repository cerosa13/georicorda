import { useState } from 'react';
import {
  Navigation,
  Share2,
  Trash2,
  Pencil,
  Copy,
  Check,
  Compass,
  ImageDown,
} from 'lucide-react';
import { Coords, Spot } from '../types/spot';
import { getCategoryMeta } from '../utils/categoryIcons';
import { buildGoogleMapsDirectionsUrl, formatDistance } from '../utils/geo';
import { copyToClipboard, isSafeImageDataUrl } from '../utils/image';
import { isSafeAudioDataUrl } from '../utils/audio';
import { VoiceMemoPlayer } from './VoiceMemoPlayer';

interface SpotCardProps {
  spot: Spot & { dist: number | null };
  currentCoords?: Coords | null;
  onShare: (spot: Spot) => void;
  onEdit: (spot: Spot) => void;
  onRequestDelete: (spot: Spot) => void;
  onPreviewPhoto: (src: string, title: string) => void;
  onGenerateInfographic: (spot: Spot & { dist: number | null }) => void;
}

export function SpotCard({
  spot,
  currentCoords,
  onShare,
  onEdit,
  onRequestDelete,
  onPreviewPhoto,
  onGenerateInfographic,
}: SpotCardProps) {
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const catMeta = getCategoryMeta(spot.category);
  const CategoryIcon = catMeta.icon;
  const directionsUrl = buildGoogleMapsDirectionsUrl(spot.lat, spot.lon, currentCoords);

  const formattedDate = (() => {
    const parsed = new Date(spot.createdAt);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  })();

  const handleCopyCoords = async () => {
    const ok = await copyToClipboard(`${spot.lat.toFixed(6)}, ${spot.lon.toFixed(6)}`);
    if (ok) {
      setCopiedCoords(true);
      window.setTimeout(() => setCopiedCoords(false), 1800);
    }
  };

  const hasValidPhoto = isSafeImageDataUrl(spot.photo) && !imgFailed;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#111b27]/95 shadow-sm shadow-slate-900/5 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
      {/* Subtle category-colored top stripe */}
      <div className={`h-1 w-full bg-gradient-to-r ${catMeta.topAccentClass}`} />

      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Header: Colored Icon Tile + Title + Distance */}
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${catMeta.iconBgClass} ${catMeta.iconTextClass}`}
            aria-hidden="true"
          >
            <CategoryIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
              {spot.title}
            </h3>
            {/* Zero-pill unboxed metadata with typographic separators */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className={`font-semibold ${catMeta.iconTextClass}`}>
                {spot.category}
              </span>
              {spot.city && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-700 dark:text-slate-300">{spot.city}</span>
                </>
              )}
              {formattedDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formattedDate}</span>
                </>
              )}
            </div>
          </div>

          {spot.dist != null && (
            <div className="shrink-0 flex items-center gap-1 text-xs font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 pt-0.5">
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>{formatDistance(spot.dist)}</span>
            </div>
          )}
        </div>

        {/* Coordinates copy strip */}
        <div>
          <button
            type="button"
            onClick={handleCopyCoords}
            title="Copia coordinate"
            className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
          >
            <span>
              {spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}
            </span>
            {copiedCoords ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 opacity-70" />
            )}
          </button>
        </div>

        {/* Note */}
        {spot.note && (
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {spot.note}
          </p>
        )}

        {/* Voice Memo */}
        {isSafeAudioDataUrl(spot.voiceMemo) && (
          <VoiceMemoPlayer
            src={spot.voiceMemo}
            duration={spot.voiceMemoDuration}
          />
        )}

        {/* Photo */}
        {hasValidPhoto && spot.photo && (
          <button
            type="button"
            onClick={() => onPreviewPhoto(spot.photo!, spot.title)}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <img
              src={spot.photo}
              alt={`Foto di ${spot.title}`}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full max-h-48 object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </button>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center gap-1.5 sm:gap-2 border-t border-slate-100 dark:border-slate-800/80">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/20 transition-all whitespace-nowrap"
          >
            <Navigation className="w-4 h-4 shrink-0" />
            <span className="truncate">Ottieni indicazioni</span>
          </a>

          <button
            type="button"
            onClick={() => onGenerateInfographic(spot)}
            aria-label="Crea e scarica infografica"
            title="Infografica PNG"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50/70 dark:bg-teal-500/15 hover:bg-teal-100 dark:hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 transition-colors shrink-0"
          >
            <ImageDown className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onShare(spot)}
            aria-label="Condividi segnaposto"
            title="Invia o copia dettagli"
            className="min-h-[44px] min-w-[44px] sm:px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Invia</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(spot)}
            aria-label="Modifica segnaposto"
            title="Modifica"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors shrink-0"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onRequestDelete(spot)}
            aria-label="Elimina segnaposto"
            title="Elimina"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 transition-colors shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
