import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { Coords } from '../types/spot';
import { PlaceSearchResult, isValidCoords, searchPlacesNominatim } from '../utils/geo';

type PlacesLibrary = NonNullable<ReturnType<typeof useMapsLibrary<'places'>>>;
type AutocompleteFetchResult = Awaited<
  ReturnType<PlacesLibrary['AutocompleteSuggestion']['fetchAutocompleteSuggestions']>
>;
type GooglePrediction = AutocompleteFetchResult['suggestions'][number];
type GoogleSessionToken = InstanceType<PlacesLibrary['AutocompleteSessionToken']>;
type TextSearchPlace = InstanceType<PlacesLibrary['Place']>;

interface PlaceSearchBoxProps {
  currentCoords: Coords | null;
  selectedPlace: PlaceSearchResult | null;
  onSelectPlace: (place: PlaceSearchResult | null) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('429')
  );
}

function extractCityFromGoogleComponents(
  components?: Array<{ types?: string[]; longText?: string | null }> | null
): string {
  if (!components || components.length === 0) return '';
  const priorityTypes = [
    'locality',
    'administrative_area_level_3',
    'postal_town',
    'administrative_area_level_2',
  ];
  for (const t of priorityTypes) {
    const match = components.find((c) => c.types?.includes(t));
    if (match?.longText) return match.longText.trim();
  }
  return '';
}

function GooglePlacesLoader({
  onLibraryReady,
}: {
  onLibraryReady: (lib: PlacesLibrary | null) => void;
}) {
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    onLibraryReady(placesLib);
  }, [placesLib, onLibraryReady]);

  return null;
}

export function PlaceSearchBox({
  currentCoords,
  selectedPlace,
  onSelectPlace,
  onNotify,
}: PlaceSearchBoxProps) {
  const hasMapsKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const [placesLib, setPlacesLib] = useState<PlacesLibrary | null>(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [googleSuggestions, setGoogleSuggestions] = useState<GooglePrediction[]>([]);
  const [directResults, setDirectResults] = useState<PlaceSearchResult[]>([]);

  const sessionTokenRef = useRef<GoogleSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLibraryReady = useCallback((lib: PlacesLibrary | null) => {
    setPlacesLib(lib);
  }, []);

  // Close dropdown when tapping outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced autocomplete suggestions while typing
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setGoogleSuggestions([]);
      setDirectResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        if (placesLib?.AutocompleteSuggestion && placesLib?.AutocompleteSessionToken) {
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
          }

          const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: trimmed,
            sessionToken: sessionTokenRef.current,
            language: 'it',
            region: 'IT',
            ...(currentCoords
              ? { origin: { lat: currentCoords.lat, lng: currentCoords.lon } }
              : {}),
          });

          if (!cancelled && res.suggestions.length > 0) {
            setGoogleSuggestions(res.suggestions.slice(0, 5));
            setDirectResults([]);
            setDropdownOpen(true);
            return;
          }
        }

        // Fallback to OpenStreetMap Nominatim when Maps key/Places isn't available
        const osmResults = await searchPlacesNominatim(trimmed, currentCoords);
        if (!cancelled) {
          setGoogleSuggestions([]);
          setDirectResults(osmResults);
          setDropdownOpen(osmResults.length > 0);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        try {
          const osmResults = await searchPlacesNominatim(trimmed, currentCoords);
          if (!cancelled) {
            setGoogleSuggestions([]);
            setDirectResults(osmResults);
            setDropdownOpen(osmResults.length > 0);
          }
        } catch {
          // Silent on live typing network hiccup
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 380);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, placesLib, currentCoords]);

  const handleExplicitSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      onNotify('info', 'Scrivi almeno 2 caratteri per cercare un luogo (es. "Bar Piccolo Chiavari").');
      return;
    }

    setSearching(true);
    try {
      let results: PlaceSearchResult[] = [];

      if (placesLib?.Place?.searchByText) {
        try {
          const response = await placesLib.Place.searchByText({
            textQuery: trimmed,
            fields: ['displayName', 'formattedAddress', 'addressComponents', 'location'],
            language: 'it',
            region: 'IT',
            maxResultCount: 5,
            ...(currentCoords
              ? {
                  locationBias: {
                    center: { lat: currentCoords.lat, lng: currentCoords.lon },
                    radius: 25000,
                  },
                }
              : {}),
          });

          const places = (response?.places ?? []) as TextSearchPlace[];
          results = places
            .map((p: TextSearchPlace, idx: number): PlaceSearchResult | null => {
              const lat = p.location?.lat();
              const lon = p.location?.lng();
              if (lat == null || lon == null || !isValidCoords(lat, lon)) return null;
              return {
                id: `google-${p.id || idx}-${lat}`,
                name: p.displayName || trimmed,
                address: p.formattedAddress || '',
                city: extractCityFromGoogleComponents(p.addressComponents),
                lat,
                lon,
                source: 'google',
              };
            })
            .filter((item: PlaceSearchResult | null): item is PlaceSearchResult => item !== null);
        } catch (err) {
          if (isQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        }
      }

      if (results.length === 0) {
        results = await searchPlacesNominatim(trimmed, currentCoords);
      }

      setGoogleSuggestions([]);
      setDirectResults(results);
      setDropdownOpen(true);

      if (results.length === 0) {
        onNotify('info', `Nessun risultato trovato per "${trimmed}". Prova aggiungendo il comune.`);
      }
    } catch {
      onNotify('error', 'Ricerca luoghi non disponibile al momento (verifica la connessione).');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectGoogleSuggestion = async (suggestion: GooglePrediction) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;

    setSearching(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'addressComponents', 'location'],
      });

      const lat = place.location?.lat();
      const lon = place.location?.lng();
      if (lat == null || lon == null || !isValidCoords(lat, lon)) {
        onNotify('error', 'Coordinate del luogo non disponibili.');
        return;
      }

      const name =
        place.displayName ||
        prediction.mainText?.text ||
        prediction.text?.text ||
        query.trim();
      const city = extractCityFromGoogleComponents(place.addressComponents);

      const selected: PlaceSearchResult = {
        id: `google-${place.id || Date.now()}`,
        name,
        address: place.formattedAddress || prediction.secondaryText?.text || '',
        city,
        lat,
        lon,
        source: 'google',
      };

      sessionTokenRef.current = null;
      setGoogleSuggestions([]);
      setDirectResults([]);
      setDropdownOpen(false);
      setQuery(selected.name);
      onSelectPlace(selected);
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      // Try Nominatim with prediction text as graceful fallback
      try {
        const fallbackText = prediction.text?.text || query.trim();
        const fallback = await searchPlacesNominatim(fallbackText, currentCoords);
        if (fallback.length > 0) {
          setGoogleSuggestions([]);
          setDirectResults([]);
          setDropdownOpen(false);
          setQuery(fallback[0].name);
          onSelectPlace(fallback[0]);
          return;
        }
      } catch {
        // fall through to toast
      }
      onNotify('error', 'Impossibile recuperare le coordinate di questo luogo.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectDirectResult = (item: PlaceSearchResult) => {
    setDropdownOpen(false);
    setGoogleSuggestions([]);
    setDirectResults([]);
    setQuery(item.name);
    onSelectPlace(item);
  };

  const hasDropdownItems = googleSuggestions.length > 0 || directResults.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {hasMapsKey && <GooglePlacesLoader onLibraryReady={handleLibraryReady} />}

      <label
        htmlFor="placeSearchInput"
        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
      >
        Cerca un luogo o locale (opzionale)
      </label>

      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="placeSearchInput"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value.trim()) {
                setDropdownOpen(false);
              }
            }}
            onFocus={() => {
              if (hasDropdownItems) setDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleExplicitSearch();
              }
            }}
            placeholder="Es. Bar Piccolo Chiavari, Spiaggia Paraggi..."
            className="w-full min-h-[44px] rounded-xl border border-teal-200 dark:border-teal-500/35 bg-teal-50/40 dark:bg-[#0b131e] pl-10 pr-9 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setGoogleSuggestions([]);
                setDirectResults([]);
                setDropdownOpen(false);
                if (selectedPlace) onSelectPlace(null);
              }}
              aria-label="Pulisci ricerca luogo"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleExplicitSearch()}
          disabled={searching}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-xs"
        >
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>Cerca</span>
        </button>
      </div>

      {/* Selected place confirmation */}
      {selectedPlace && (
        <div className="mt-2 rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-500/15 px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 truncate">
                Posizione impostata: {selectedPlace.name}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-emerald-700/85 dark:text-emerald-300/80">
                {selectedPlace.lat.toFixed(5)}, {selectedPlace.lon.toFixed(5)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectPlace(null);
              setQuery('');
            }}
            className="min-h-[32px] px-2.5 rounded-lg bg-white/80 dark:bg-[#111b27] border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-white transition-colors whitespace-nowrap shrink-0"
          >
            Usa GPS
          </button>
        </div>
      )}

      {/* Search Suggestions Dropdown */}
      {dropdownOpen && hasDropdownItems && (
        <ul
          role="listbox"
          aria-label="Risultati ricerca luoghi"
          className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111b27] shadow-xl divide-y divide-slate-100 dark:divide-slate-800"
        >
          {googleSuggestions.map((suggestion, idx) => {
            const pred = suggestion.placePrediction;
            if (!pred) return null;
            const mainText = pred.mainText?.text || pred.text?.text || '';
            const secondaryText = pred.secondaryText?.text || '';
            return (
              <li key={pred.placeId || `g-${idx}`}>
                <button
                  type="button"
                  onClick={() => void handleSelectGoogleSuggestion(suggestion)}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-teal-50/70 dark:hover:bg-teal-500/10 flex items-start gap-2.5 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {mainText}
                    </p>
                    {secondaryText && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {secondaryText}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}

          {directResults.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelectDirectResult(item)}
                className="w-full px-3.5 py-2.5 text-left hover:bg-teal-50/70 dark:hover:bg-teal-500/10 flex items-start gap-2.5 transition-colors"
              >
                <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {item.name}
                  </p>
                  {item.address && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.address}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
