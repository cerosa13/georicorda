import { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Compass,
  Database,
  Eye,
  EyeOff,
  List,
  LocateFixed,
  LocateOff,
  Map as MapIcon,
  MapPin,
  Moon,
  PlusCircle,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { BackupModal } from './components/BackupModal';
import { ConfirmModal } from './components/ConfirmModal';
import { EditSpotModal } from './components/EditSpotModal';
import { ImageModal } from './components/ImageModal';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SpotCard } from './components/SpotCard';
import { SpotForm } from './components/SpotForm';
import { SpotInfographicModal } from './components/SpotInfographicModal';
import { SpotsMapView } from './components/SpotsMapView';
import { ToastContainer } from './components/ToastContainer';
import { CATEGORIES, Coords, SortOption, Spot, ToastMessage } from './types/spot';
import { getCategoryMeta } from './utils/categoryIcons';
import { getAllSpots, putSpot, removeSpot } from './utils/db';
import { buildGoogleMapsUrl, calcDistanceMeters } from './utils/geo';
import { copyToClipboard } from './utils/image';

type GpsState = 'searching' | 'ready' | 'error';
type MobileTab = 'create' | 'map' | 'list';

export default function App() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(true);
  const [currentCoords, setCurrentCoords] = useState<Coords | null>(null);
  const [gpsState, setGpsState] = useState<GpsState>('searching');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Tutte');
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [hideMushrooms, setHideMushrooms] = useState(false);

  const [mobileTab, setMobileTab] = useState<MobileTab>('create');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem('segnaposto_theme');
    return saved ? saved === 'dark' : true;
  });

  const [backupOpen, setBackupOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [spotToDelete, setSpotToDelete] = useState<Spot | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; title: string } | null>(null);
  const [infographicSpot, setInfographicSpot] = useState<(Spot & { dist?: number | null }) | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      window.localStorage.setItem('segnaposto_theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('segnaposto_theme', 'light');
    }
  }, [isDark]);

  const addToast = useCallback(
    (
      type: ToastMessage['type'],
      text: string,
      actionLabel?: string,
      onAction?: () => void
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, text, actionLabel, onAction }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState('error');
      return;
    }

    setGpsState('searching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
        });
        setGpsState('ready');
      },
      () => {
        setGpsState('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  }, []);

  // Load initial data from IndexedDB & start GPS
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await getAllSpots();
        if (active) setSpots(stored);
      } catch {
        if (active) addToast('error', 'Impossibile accedere alla memoria locale del browser.');
      } finally {
        if (active) setLoadingSpots(false);
      }
    })();

    refreshGPS();
    return () => {
      active = false;
    };
  }, [refreshGPS, addToast]);

  const handleSaveNewSpot = async (spot: Spot) => {
    try {
      await putSpot(spot);
      setSpots((prev) => [spot, ...prev.filter((s) => s.id !== spot.id)]);
      addToast('success', `Segnaposto "${spot.title}" salvato.`, 'Vedi elenco', () =>
        setMobileTab('list')
      );
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Errore nel salvataggio.');
      throw err;
    }
  };

  const handleUpdateSpot = async (updated: Spot) => {
    try {
      await putSpot(updated);
      setSpots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      addToast('success', 'Segnaposto aggiornato.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Errore durante la modifica.');
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!spotToDelete) return;
    const target = spotToDelete;
    setSpotToDelete(null);

    try {
      await removeSpot(target.id);
      setSpots((prev) => prev.filter((s) => s.id !== target.id));
      addToast('info', `"${target.title}" eliminato.`);
    } catch {
      addToast('error', 'Errore durante la rimozione del segnaposto.');
    }
  };

  const handleShareSpot = async (spot: Spot) => {
    const mapsUrl = buildGoogleMapsUrl(spot.lat, spot.lon);
    const cityPart = spot.city ? ` - ${spot.city}` : '';
    const text = `${spot.title}${cityPart} (${spot.category})${spot.note ? `\n${spot.note}` : ''}\n${mapsUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: spot.title, text });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Fallback to clipboard if share failed
      }
    }

    const copied = await copyToClipboard(text);
    if (copied) {
      addToast('success', 'Link e dettagli copiati negli appunti.');
    } else {
      addToast('error', 'Impossibile copiare negli appunti.');
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(spots, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segnaposto-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Backup JSON scaricato.');
  };

  const handleImportJSON = async (importedSpots: Spot[], skippedCount: number) => {
    try {
      for (const item of importedSpots) {
        await putSpot(item);
      }
      const fresh = await getAllSpots();
      setSpots(fresh);
      const skippedText = skippedCount > 0 ? ` (${skippedCount} non validi ignorati)` : '';
      addToast('success', `Importati ${importedSpots.length} segnaposti${skippedText}.`);
    } catch {
      addToast('error', 'Errore durante il salvataggio dei dati importati.');
    }
  };

  const visibleSpots = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let filtered = spots;

    if (hideMushrooms) {
      filtered = filtered.filter((s) => s.category !== 'Funghi');
    }

    if (activeFilter !== 'Tutte') {
      filtered = filtered.filter((s) => s.category === activeFilter);
    }

    if (q) {
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.note && s.note.toLowerCase().includes(q)) ||
          s.category.toLowerCase().includes(q)
      );
    }

    const withDist = filtered.map((s) => ({
      ...s,
      dist: currentCoords
        ? calcDistanceMeters(currentCoords.lat, currentCoords.lon, s.lat, s.lon)
        : null,
    }));

    withDist.sort((a, b) => {
      if (sortBy === 'distance' && currentCoords) {
        return (a.dist ?? Number.POSITIVE_INFINITY) - (b.dist ?? Number.POSITIVE_INFINITY);
      }
      if (sortBy === 'alpha') {
        return a.title.localeCompare(b.title, 'it');
      }
      const timeA = Date.parse(a.createdAt) || 0;
      const timeB = Date.parse(b.createdAt) || 0;
      return timeB - timeA;
    });

    return withDist;
  }, [spots, hideMushrooms, activeFilter, searchQuery, currentCoords, sortBy]);

  const filterCategories = useMemo(() => {
    const base = hideMushrooms
      ? CATEGORIES.filter((c) => c !== 'Funghi')
      : [...CATEGORIES];
    return ['Tutte', ...base];
  }, [hideMushrooms]);

  // Reset activeFilter if user hides Funghi while Funghi filter was active
  useEffect(() => {
    if (hideMushrooms && activeFilter === 'Funghi') {
      setActiveFilter('Tutte');
    }
  }, [hideMushrooms, activeFilter]);

  const visibleTotalCount = useMemo(
    () => (hideMushrooms ? spots.filter((s) => s.category !== 'Funghi').length : spots.length),
    [spots, hideMushrooms]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Compact Colorful Phone Sticky Top Bar */}
      <header className="sticky top-0 z-30 border-b border-sky-200/70 dark:border-slate-800/90 bg-white/85 dark:bg-[#09111c]/85 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-3.5 h-13 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 text-white flex items-center justify-center shadow-xs shadow-emerald-500/25 shrink-0">
              <MapPin className="w-4 h-4" />
            </span>
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
              Segnaposto Rapido
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton />

            <button
              type="button"
              onClick={refreshGPS}
              title="Aggiorna posizione GPS"
              className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                gpsState === 'searching'
                  ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : gpsState === 'ready' && currentCoords
                    ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
              }`}
            >
              {gpsState === 'searching' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>GPS...</span>
                </>
              ) : gpsState === 'ready' && currentCoords ? (
                <>
                  <LocateFixed className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono tabular-nums">
                    ±{currentCoords.acc ?? 0}m
                  </span>
                </>
              ) : (
                <>
                  <LocateOff className="w-3.5 h-3.5 shrink-0" />
                  <span>GPS off</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setHideMushrooms((prev) => !prev)}
              aria-pressed={hideMushrooms}
              aria-label={hideMushrooms ? 'Mostra categoria Funghi' : 'Nascondi punti Funghi'}
              title={hideMushrooms ? 'Funghi nascosti' : 'Funghi visibili'}
              className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
                hideMushrooms
                  ? 'border-amber-300 dark:border-amber-500/40 bg-amber-100/80 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 hover:bg-emerald-100/70 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {hideMushrooms ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
              title={isDark ? 'Tema chiaro' : 'Tema scuro'}
              className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
                isDark
                  ? 'border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300'
                  : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setBackupOpen(true)}
              aria-label="Backup e ripristino"
              title="Backup e ripristino JSON"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 transition-colors shrink-0"
            >
              <Database className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      <OfflineBanner />

      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-13 z-40 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Main Phone-First Single Column Content */}
      {(() => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
        const mainContent = (
          <main className="flex-1 max-w-lg w-full mx-auto px-3.5 pt-4 pb-24">
        {mobileTab === 'create' ? (
          <section aria-label="Crea nuovo segnaposto">
            <SpotForm
              currentCoords={currentCoords}
              onSave={handleSaveNewSpot}
              onNotify={(type, text) => addToast(type, text)}
            />
          </section>
        ) : mobileTab === 'map' ? (
          <section aria-label="Mappa segnaposti">
            <SpotsMapView
              spots={visibleSpots}
              currentCoords={currentCoords}
              isDark={isDark}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterCategories={filterCategories}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onRefreshGPS={refreshGPS}
              onShare={handleShareSpot}
              onEdit={(s) => setEditingSpot(s)}
              onPreviewPhoto={(src, title) => setPreviewPhoto({ src, title })}
              onGenerateInfographic={(s) => setInfographicSpot(s)}
            />
          </section>
        ) : (
          <section aria-label="Elenco segnaposti salvati" className="space-y-3.5">
            {/* Search & Filters */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-sky-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca località, titolo o parola chiave..."
                  aria-label="Cerca tra i segnaposti"
                  className="w-full min-h-[44px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111b27]/95 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-colors shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Pulisci ricerca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Colorful Category Filter Strip */}
              <div
                role="tablist"
                aria-label="Filtra per categoria"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
              >
                {filterCategories.map((cat) => {
                  const isActive = cat === activeFilter;
                  const isAll = cat === 'Tutte';
                  const meta = !isAll ? getCategoryMeta(cat) : null;
                  const Icon = meta?.icon;

                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveFilter(cat)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 border flex items-center gap-1.5 ${
                        isActive
                          ? isAll
                            ? 'bg-gradient-to-r from-emerald-600 to-sky-600 border-transparent text-white font-semibold shadow-xs'
                            : `${meta?.activeControlClass} font-semibold`
                          : 'bg-white/95 dark:bg-[#111b27] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
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

              {/* Count & Sort Row */}
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                  {visibleSpots.length}{' '}
                  {visibleSpots.length === 1 ? 'punto trovato' : 'punti trovati'}
                  {sortBy === 'distance' && !currentCoords && visibleSpots.length > 0 && (
                    <span className="ml-1.5 font-medium text-amber-600 dark:text-amber-400">
                      (GPS non attivo)
                    </span>
                  )}
                </p>

                <select
                  aria-label="Ordina segnaposti"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="min-h-[38px] rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/80 dark:bg-[#111b27] px-3 py-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300 focus:outline-none focus:border-sky-500"
                >
                  <option value="distance">Più vicini a me</option>
                  <option value="newest">Più recenti</option>
                  <option value="alpha">Ordine alfabetico (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Spots Grid / States */}
            {loadingSpots ? (
              <div className="rounded-3xl border border-sky-200/70 dark:border-slate-800 bg-white/90 dark:bg-[#111b27]/90 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Caricamento segnaposti...
              </div>
            ) : visibleSpots.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-sky-300/80 dark:border-slate-700 bg-white/80 dark:bg-[#111b27]/70 p-8 text-center space-y-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 via-sky-400/20 to-amber-400/20 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center">
                  <Compass className="w-7 h-7 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {spots.length === 0
                      ? 'Nessun segnaposto salvato'
                      : 'Nessun risultato con questi filtri'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    {spots.length === 0
                      ? 'Salva parcheggi, spiagge, funghi o scorciatoie con foto e memo vocali in un tocco.'
                      : 'Prova a cambiare categoria o a pulire il testo di ricerca.'}
                  </p>
                </div>
                {spots.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setMobileTab('create')}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-xs font-bold text-white shadow-sm shadow-teal-600/20 transition-all"
                  >
                    Crea il primo segnaposto
                  </button>
                ) : (
                  (searchQuery || activeFilter !== 'Tutte') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveFilter('Tutte');
                      }}
                      className="min-h-[40px] px-4 py-2 rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/15 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/25 transition-colors"
                    >
                      Azzera filtri
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {visibleSpots.map((spot) => (
                  <SpotCard
                    key={spot.id}
                    spot={spot}
                    currentCoords={currentCoords}
                    onShare={handleShareSpot}
                    onEdit={(s) => setEditingSpot(s)}
                    onRequestDelete={(s) => setSpotToDelete(s)}
                    onPreviewPhoto={(src, title) => setPreviewPhoto({ src, title })}
                    onGenerateInfographic={(s) => setInfographicSpot(s)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
          </main>
        );
        return apiKey ? (
          <APIProvider apiKey={apiKey} libraries={['marker', 'places']} language="it" region="IT">
            {mainContent}
          </APIProvider>
        ) : (
          mainContent
        );
      })()}

      {/* Fixed Colorful Bottom Thumb Navigation Bar */}
      <nav
        aria-label="Navigazione principale"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-sky-200/80 dark:border-slate-800/90 bg-white/90 dark:bg-[#09111c]/95 backdrop-blur-md"
      >
        <div className="max-w-lg mx-auto grid grid-cols-3 h-15 px-2 py-1 gap-1">
          <button
            type="button"
            onClick={() => setMobileTab('create')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all ${
              mobileTab === 'create'
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[11px] leading-none">Nuovo</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('map')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all ${
              mobileTab === 'map'
                ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[11px] leading-none">Mappa</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('list')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all ${
              mobileTab === 'list'
                ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <List className="w-5 h-5" />
            <span className="text-[11px] leading-none tabular-nums">
              Salvati ({visibleTotalCount})
            </span>
          </button>
        </div>
      </nav>

      {/* Modals & Toasts */}
      <BackupModal
        open={backupOpen}
        spotsCount={spots.length}
        onExport={handleExportJSON}
        onImport={handleImportJSON}
        onError={(msg) => addToast('error', msg)}
        onClose={() => setBackupOpen(false)}
      />

      <EditSpotModal
        spot={editingSpot}
        onSave={handleUpdateSpot}
        onError={(msg) => addToast('error', msg)}
        onClose={() => setEditingSpot(null)}
      />

      <ConfirmModal
        open={Boolean(spotToDelete)}
        title="Elimina segnaposto"
        description={
          spotToDelete
            ? `Vuoi eliminare definitivamente "${spotToDelete.title}"? L'operazione non può essere annullata.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setSpotToDelete(null)}
      />

      <ImageModal
        src={previewPhoto?.src ?? null}
        title={previewPhoto?.title}
        onClose={() => setPreviewPhoto(null)}
      />

      <SpotInfographicModal
        spot={infographicSpot}
        onSuccess={(msg) => addToast('success', msg)}
        onError={(msg) => addToast('error', msg)}
        onClose={() => setInfographicSpot(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
