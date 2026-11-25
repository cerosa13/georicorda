import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  ColorScheme,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ImageDown,
  LocateFixed,
  MapPin,
  Maximize2,
  Navigation,
  Pencil,
  Search,
  Share2,
  X,
} from 'lucide-react';
import { Coords, Spot } from '../types/spot';
import { getCategoryMarkerColors, getCategoryMeta } from '../utils/categoryIcons';
import { buildGoogleMapsDirectionsUrl, formatDistance } from '../utils/geo';
import { isSafeImageDataUrl } from '../utils/image';
import { isSafeAudioDataUrl } from '../utils/audio';
import { VoiceMemoPlayer } from './VoiceMemoPlayer';

type SpotWithDist = Spot & { dist: number | null };
type RadiusFilter = 'all' | '1000' | '5000' | '10000' | '25000';

interface SpotsMapViewProps {
  spots: SpotWithDist[];
  currentCoords: Coords | null;
  isDark: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterCategories: string[];
  activeFilter: string;
  onFilterChange: (cat: string) => void;
  onRefreshGPS: () => void;
  onShare: (spot: Spot) => void;
  onEdit: (spot: Spot) => void;
  onPreviewPhoto: (src: string, title: string) => void;
  onGenerateInfographic: (spot: SpotWithDist) => void;
}

const DEFAULT_ITALY_CENTER = { lat: 43.7696, lng: 11.2558 };

function MapContent({
  spots,
  currentCoords,
  isDark,
  selectedSpot,
  onSelectSpot,
  onRefreshGPS,
}: {
  spots: SpotWithDist[];
  currentCoords: Coords | null;
  isDark: boolean;
  selectedSpot: SpotWithDist | null;
  onSelectSpot: (spot: SpotWithDist | null) => void;
  onRefreshGPS: () => void;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  const loadingStatus = useApiLoadingStatus();
  const [hasInitialCentered, setHasInitialCentered] = useState(false);

  const initialCenter = useMemo(() => {
    if (currentCoords) {
      return { lat: currentCoords.lat, lng: currentCoords.lon };
    }
    if (spots.length > 0) {
      return { lat: spots[0].lat, lng: spots[0].lon };
    }
    return DEFAULT_ITALY_CENTER;
  }, [currentCoords, spots]);

  const initialZoom = currentCoords ? 14 : spots.length > 0 ? 12 : 6;

  // Sort by descending latitude so southern markers render cleanly in front
  const sortedMarkers = useMemo(() => {
    return [...spots]
      .sort((a, b) => b.lat - a.lat)
      .map((spot, idx) => ({ spot, baseZIndex: idx + 1 }));
  }, [spots]);

  const handleRecenterOnUser = useCallback(() => {
    if (!currentCoords) {
      onRefreshGPS();
      return;
    }
    if (!map) return;
    map.panTo({ lat: currentCoords.lat, lng: currentCoords.lon });
    const currentZoom = map.getZoom() ?? 12;
    if (currentZoom < 14) {
      map.setZoom(14);
    }
  }, [currentCoords, map, onRefreshGPS]);

  const handleFitAll = useCallback(() => {
    if (!map || !coreLib?.LatLngBounds) return;
    const bounds = new coreLib.LatLngBounds();
    let count = 0;

    if (currentCoords) {
      bounds.extend({ lat: currentCoords.lat, lng: currentCoords.lon });
      count += 1;
    }
    spots.forEach((s) => {
      bounds.extend({ lat: s.lat, lng: s.lon });
      count += 1;
    });

    if (count === 0) return;
    if (count === 1) {
      const target = currentCoords
        ? { lat: currentCoords.lat, lng: currentCoords.lon }
        : { lat: spots[0].lat, lng: spots[0].lon };
      map.panTo(target);
      map.setZoom(14);
      return;
    }

    map.fitBounds(bounds, { top: 48, right: 32, bottom: selectedSpot ? 180 : 48, left: 32 });
  }, [map, coreLib, currentCoords, spots, selectedSpot]);

  // Center once when GPS arrives if user hasn't interacted yet
  useEffect(() => {
    if (!map || hasInitialCentered) return;
    if (currentCoords) {
      map.panTo({ lat: currentCoords.lat, lng: currentCoords.lon });
      map.setZoom(14);
      setHasInitialCentered(true);
    } else if (spots.length > 0) {
      setHasInitialCentered(true);
    }
  }, [map, currentCoords, spots.length, hasInitialCentered]);

  const handleMarkerSelect = useCallback(
    (spot: SpotWithDist) => {
      onSelectSpot(spot);
      if (map) {
        map.panTo({ lat: spot.lat, lng: spot.lon });
      }
    },
    [map, onSelectSpot]
  );

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-sky-50 dark:bg-[#111b27]">
        <MapPin className="w-7 h-7 text-rose-500 mb-2" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Impossibile caricare la mappa
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          Verifica la connessione di rete o la configurazione della chiave Google Maps.
        </p>
      </div>
    );
  }

  return (
    <>
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={initialCenter}
        defaultZoom={initialZoom}
        colorScheme={isDark ? ColorScheme.DARK : ColorScheme.LIGHT}
        gestureHandling="greedy"
        disableDefaultUI={true}
        clickableIcons={false}
        onClick={() => onSelectSpot(null)}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        {/* User current position marker */}
        {currentCoords && (
          <AdvancedMarker
            position={{ lat: currentCoords.lat, lng: currentCoords.lon }}
            anchorLeft="-50%"
            anchorTop="-50%"
            zIndex={900}
            title="La tua posizione attuale"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute w-7 h-7 rounded-full bg-sky-500/25 border border-sky-400/40" />
              <span className="relative w-3.5 h-3.5 rounded-full bg-sky-500 border-2 border-white shadow-md" />
            </div>
          </AdvancedMarker>
        )}

        {/* Saved spot markers with custom category icons */}
        {sortedMarkers.map(({ spot, baseZIndex }) => {
          const isSelected = selectedSpot?.id === spot.id;
          const catMeta = getCategoryMeta(spot.category);
          const Icon = catMeta.icon;
          const { bg, border } = getCategoryMarkerColors(spot.category);

          return (
            <AdvancedMarker
              key={spot.id}
              position={{ lat: spot.lat, lng: spot.lon }}
              zIndex={isSelected ? 1000 : baseZIndex}
              title={spot.title}
              onClick={() => handleMarkerSelect(spot)}
            >
              <div
                className={`flex flex-col items-center transition-transform duration-150 cursor-pointer select-none ${
                  isSelected ? 'scale-125' : 'hover:scale-110'
                }`}
              >
                <div
                  style={{
                    backgroundColor: bg,
                    borderColor: isSelected ? '#ffffff' : border,
                  }}
                  className={`flex items-center justify-center rounded-full border-2 text-white shadow-lg ${
                    isSelected
                      ? 'w-10 h-10 ring-4 ring-emerald-400/45'
                      : 'w-8 h-8'
                  }`}
                >
                  <Icon className={isSelected ? 'w-5 h-5' : 'w-4 h-4'} />
                </div>
                <div
                  style={{ borderTopColor: isSelected ? '#ffffff' : border }}
                  className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent -mt-[1px]"
                />
              </div>
            </AdvancedMarker>
          );
        })}
      </GoogleMap>

      {/* Floating Map Controls (Top-Right) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleRecenterOnUser}
          aria-label="Centra sulla tua posizione"
          title="Centra su di me"
          className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-sky-200 dark:border-slate-700 bg-white/95 dark:bg-[#111b27]/95 backdrop-blur-xs text-sky-600 dark:text-sky-400 shadow-md hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
        >
          <LocateFixed className={`w-4 h-4 ${currentCoords ? 'text-sky-500' : 'text-slate-400'}`} />
        </button>

        {spots.length > 0 && (
          <button
            type="button"
            onClick={handleFitAll}
            aria-label="Inquadra tutti i segnaposti"
            title="Inquadra tutti i punti"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-emerald-200 dark:border-slate-700 bg-white/95 dark:bg-[#111b27]/95 backdrop-blur-xs text-emerald-600 dark:text-emerald-400 shadow-md hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  );
}

export function SpotsMapView({
  spots,
  currentCoords,
  isDark,
  searchQuery,
  onSearchChange,
  filterCategories,
  activeFilter,
  onFilterChange,
  onRefreshGPS,
  onShare,
  onEdit,
  onPreviewPhoto,
  onGenerateInfographic,
}: SpotsMapViewProps) {
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('all');
  const [selectedSpotId, setSelectedSpotId] = useState<number | string | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const filteredSpots = useMemo(() => {
    if (radiusFilter === 'all' || !currentCoords) return spots;
    const maxMeters = Number(radiusFilter);
    return spots.filter((s) => s.dist != null && s.dist <= maxMeters);
  }, [spots, radiusFilter, currentCoords]);

  const selectedSpot = useMemo(
    () => filteredSpots.find((s) => s.id === selectedSpotId) || null,
    [filteredSpots, selectedSpotId]
  );

  useEffect(() => {
    if (selectedSpotId != null && !selectedSpot) {
      setSelectedSpotId(null);
    }
  }, [selectedSpotId, selectedSpot]);

  const selectedCatMeta = selectedSpot ? getCategoryMeta(selectedSpot.category) : null;
  const SelectedCatIcon = selectedCatMeta?.icon ?? MapPin;

  return (
    <div className="space-y-3">
      {/* Compact Search, Radius Dropdown & Category Strip */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-sky-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cerca sulla mappa..."
              aria-label="Cerca sulla mappa"
              className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111b27]/95 pl-9 pr-8 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Pulisci ricerca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            aria-label="Filtra per raggio di distanza"
            value={radiusFilter}
            onChange={(e) => {
              const val = e.target.value as RadiusFilter;
              setRadiusFilter(val);
              if (val !== 'all' && !currentCoords) {
                onRefreshGPS();
              }
            }}
            className="min-h-[42px] shrink-0 rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/80 dark:bg-[#111b27] px-2.5 py-2 text-xs font-semibold text-sky-800 dark:text-sky-300 focus:outline-none focus:border-sky-500"
          >
            <option value="all">Raggio: Tutti</option>
            <option value="1000">Entro 1 km</option>
            <option value="5000">Entro 5 km</option>
            <option value="10000">Entro 10 km</option>
            <option value="25000">Entro 25 km</option>
          </select>
        </div>

        {radiusFilter !== 'all' && !currentCoords && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 px-1">
            Attiva o attendi il GPS per filtrare in base alla distanza dalla tua posizione.
          </p>
        )}

        {/* Colorful Category Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {filterCategories.map((cat) => {
            const isActive = cat === activeFilter;
            const isAll = cat === 'Tutte';
            const meta = !isAll ? getCategoryMeta(cat) : null;
            const Icon = meta?.icon;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => onFilterChange(cat)}
                className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 border flex items-center gap-1.5 transition-all ${
                  isActive
                    ? isAll
                      ? 'bg-gradient-to-r from-emerald-600 to-sky-600 border-transparent text-white font-semibold shadow-xs'
                      : `${meta?.activeControlClass} font-semibold`
                    : 'bg-white/90 dark:bg-[#111b27] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {Icon && meta && (
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-white' : meta.iconTextClass
                    }`}
                  />
                )}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explicit Height Map Container */}
      <div className="relative w-full h-[calc(100dvh-16rem)] min-h-[360px] rounded-3xl overflow-hidden border border-sky-200/80 dark:border-slate-800 bg-sky-50 dark:bg-[#111b27] shadow-md shadow-sky-900/5">
        {!apiKey ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-7 h-7 text-amber-500 mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Chiave Google Maps non configurata
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Abilita Google Maps dalle impostazioni dell&apos;app per visualizzare la mappa interattiva.
            </p>
          </div>
        ) : (
          <MapContent
            spots={filteredSpots}
            currentCoords={currentCoords}
            isDark={isDark}
            selectedSpot={selectedSpot}
            onSelectSpot={(s) => setSelectedSpotId(s ? s.id : null)}
            onRefreshGPS={onRefreshGPS}
          />
        )}

        {/* Top-Left Counter Overlay */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div className="rounded-xl border border-emerald-200/90 dark:border-slate-700/80 bg-white/95 dark:bg-[#111b27]/95 backdrop-blur-xs px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm tabular-nums flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {filteredSpots.length}{' '}
              {filteredSpots.length === 1 ? 'punto' : 'punti'}
            </span>
          </div>
        </div>

        {/* Selected Marker Detail Bottom Card */}
        {selectedSpot && selectedCatMeta && (
          <div
            role="region"
            aria-label={`Dettagli ${selectedSpot.title}`}
            className="absolute bottom-3 left-3 right-3 z-20 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/98 dark:bg-[#111b27]/98 backdrop-blur-md shadow-xl"
          >
            <div className={`h-1 w-full bg-gradient-to-r ${selectedCatMeta.topAccentClass}`} />

            <div className="p-3.5 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${selectedCatMeta.iconBgClass} ${selectedCatMeta.iconTextClass}`}
                  aria-hidden="true"
                >
                  <SelectedCatIcon className="w-4.5 h-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug truncate">
                    {selectedSpot.title}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`font-semibold ${selectedCatMeta.iconTextClass}`}>
                      {selectedSpot.category}
                    </span>
                    {selectedSpot.city && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[120px]">{selectedSpot.city}</span>
                      </>
                    )}
                    {selectedSpot.dist != null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          <Compass className="w-3 h-3 shrink-0" />
                          {formatDistance(selectedSpot.dist)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSpotId(null)}
                  aria-label="Chiudi dettagli"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(selectedSpot.note || isSafeImageDataUrl(selectedSpot.photo)) && (
                <div className="flex items-start gap-2.5">
                  {selectedSpot.note && (
                    <p className="flex-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {selectedSpot.note}
                    </p>
                  )}
                  {isSafeImageDataUrl(selectedSpot.photo) && selectedSpot.photo && (
                    <button
                      type="button"
                      onClick={() => onPreviewPhoto(selectedSpot.photo!, selectedSpot.title)}
                      className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"
                    >
                      <img
                        src={selectedSpot.photo}
                        alt={selectedSpot.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                </div>
              )}

              {isSafeAudioDataUrl(selectedSpot.voiceMemo) && (
                <VoiceMemoPlayer
                  src={selectedSpot.voiceMemo}
                  duration={selectedSpot.voiceMemoDuration}
                  compact
                />
              )}

              <div className="flex items-center gap-1.5 pt-0.5">
                <a
                  href={buildGoogleMapsDirectionsUrl(
                    selectedSpot.lat,
                    selectedSpot.lon,
                    currentCoords
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 min-h-[40px] px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/20 transition-all whitespace-nowrap"
                >
                  <Navigation className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Ottieni indicazioni</span>
                </a>

                <button
                  type="button"
                  onClick={() => onGenerateInfographic(selectedSpot)}
                  aria-label="Crea e scarica infografica"
                  title="Infografica PNG"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50/70 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 transition-colors shrink-0"
                >
                  <ImageDown className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onShare(selectedSpot)}
                  aria-label="Invia segnaposto"
                  title="Invia"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 transition-colors shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(selectedSpot)}
                  aria-label="Modifica segnaposto"
                  title="Modifica"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 transition-colors shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
