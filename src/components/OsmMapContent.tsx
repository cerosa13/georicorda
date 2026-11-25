import { useCallback, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Maximize2 } from 'lucide-react';
import { Coords, Spot } from '../types/spot';
import { getCategoryMarkerColors, getCategoryMeta } from '../utils/categoryIcons';

type SpotWithDist = Spot & { dist: number | null };

interface OsmMapContentProps {
  spots: SpotWithDist[];
  currentCoords: Coords | null;
  isDark: boolean;
  selectedSpot: SpotWithDist | null;
  onSelectSpot: (spot: SpotWithDist | null) => void;
  onRefreshGPS: () => void;
}

const DEFAULT_ITALY_CENTER: [number, number] = [43.7696, 11.2558];

export function OsmMapContent({
  spots,
  currentCoords,
  isDark,
  selectedSpot,
  onSelectSpot,
  onRefreshGPS,
}: OsmMapContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const hasInitialCenteredRef = useRef(false);
  const onSelectSpotRef = useRef(onSelectSpot);

  useEffect(() => {
    onSelectSpotRef.current = onSelectSpot;
  }, [onSelectSpot]);

  // Initialize Leaflet map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialCenter: [number, number] = currentCoords
      ? [currentCoords.lat, currentCoords.lon]
      : spots.length > 0
        ? [spots[0].lat, spots[0].lon]
        : DEFAULT_ITALY_CENTER;
    const initialZoom = currentCoords ? 14 : spots.length > 0 ? 12 : 6;

    const map = L.map(el, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
    });

    if (currentCoords || spots.length > 0) {
      hasInitialCenteredRef.current = true;
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    map.attributionControl.setPrefix(false);

    const markersLayer = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);

    map.on('click', () => {
      onSelectSpotRef.current(null);
    });

    mapRef.current = map;
    markersLayerRef.current = markersLayer;
    userLayerRef.current = userLayer;

    // Ensure accurate size calculation after container mount
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      userLayerRef.current = null;
      hasInitialCenteredRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center once when GPS arrives if map hasn't centered on user yet
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentCoords || hasInitialCenteredRef.current) return;
    map.setView([currentCoords.lat, currentCoords.lon], 14, { animate: true });
    hasInitialCenteredRef.current = true;
  }, [currentCoords]);

  // Update user GPS marker
  useEffect(() => {
    const userLayer = userLayerRef.current;
    if (!userLayer) return;
    userLayer.clearLayers();

    if (!currentCoords) return;

    const userIcon = L.divIcon({
      className: '!bg-transparent !border-0',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;position:relative;">
        <span style="position:absolute;width:28px;height:28px;border-radius:9999px;background:rgba(14,165,233,0.25);border:1px solid rgba(56,189,248,0.45);"></span>
        <span style="position:relative;width:14px;height:14px;border-radius:9999px;background:#0ea5e9;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></span>
      </div>`,
    });

    L.marker([currentCoords.lat, currentCoords.lon], {
      icon: userIcon,
      zIndexOffset: 900,
      title: 'La tua posizione attuale',
      interactive: false,
    }).addTo(userLayer);
  }, [currentCoords]);

  // Render saved spot markers
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const sorted = [...spots].sort((a, b) => b.lat - a.lat);

    sorted.forEach((spot, idx) => {
      const isSelected = selectedSpot?.id === spot.id;
      const catMeta = getCategoryMeta(spot.category);
      const Icon = catMeta.icon;
      const { bg, border } = getCategoryMarkerColors(spot.category);
      const size = isSelected ? 40 : 32;
      const iconSizePx = isSelected ? 20 : 16;
      const borderCol = isSelected ? '#ffffff' : border;
      const shadowRing = isSelected
        ? 'box-shadow:0 0 0 4px rgba(52,211,153,0.45),0 6px 14px rgba(0,0,0,0.35);'
        : 'box-shadow:0 4px 10px rgba(0,0,0,0.3);';

      const iconSvg = renderToStaticMarkup(
        <Icon style={{ width: `${iconSizePx}px`, height: `${iconSizePx}px`, color: '#ffffff' }} />
      );

      const pinHtml = `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:2px solid ${borderCol};display:flex;align-items:center;justify-content:center;${shadowRing}">
          ${iconSvg}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${borderCol};margin-top:-1px;"></div>
      </div>`;

      const totalHeight = size + 6;
      const markerIcon = L.divIcon({
        className: '!bg-transparent !border-0',
        iconSize: [size, totalHeight],
        iconAnchor: [size / 2, totalHeight],
        html: pinHtml,
      });

      const marker = L.marker([spot.lat, spot.lon], {
        icon: markerIcon,
        zIndexOffset: isSelected ? 1000 : idx + 1,
        title: spot.title,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectSpotRef.current(spot);
        map.panTo([spot.lat, spot.lon], { animate: true });
      });

      marker.addTo(markersLayer);
    });
  }, [spots, selectedSpot]);

  const handleRecenterOnUser = useCallback(() => {
    if (!currentCoords) {
      onRefreshGPS();
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    const targetZoom = Math.max(map.getZoom(), 14);
    map.setView([currentCoords.lat, currentCoords.lon], targetZoom, { animate: true });
  }, [currentCoords, onRefreshGPS]);

  const handleFitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const points: [number, number][] = [];
    if (currentCoords) {
      points.push([currentCoords.lat, currentCoords.lon]);
    }
    spots.forEach((s) => points.push([s.lat, s.lon]));

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {
      paddingTopLeft: [32, 48],
      paddingBottomRight: [32, selectedSpot ? 180 : 48],
      animate: true,
    });
  }, [currentCoords, spots, selectedSpot]);

  return (
    <div className="relative w-full h-full isolate">
      <div
        ref={containerRef}
        className={`w-full h-full z-0 ${
          isDark
            ? '[&_.leaflet-tile-pane]:brightness-[0.86] [&_.leaflet-tile-pane]:invert [&_.leaflet-tile-pane]:contrast-[0.95] [&_.leaflet-tile-pane]:hue-rotate-180 [&_.leaflet-control-attribution]:!bg-slate-900/80 [&_.leaflet-control-attribution]:!text-slate-300 [&_.leaflet-control-attribution_a]:!text-sky-400'
            : ''
        }`}
      />

      {/* Floating Map Controls (Top-Right) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
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
    </div>
  );
}
