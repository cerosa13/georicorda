import { Coords } from '../types/spot';

export function isValidCoords(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Parses raw coordinates ("44.4812, 9.7654", "45 9") and common Google Maps URL formats
 * (@lat,lon, ?q=lat,lon, ll=lat,lon, !3dlat!4dlon).
 */
export function parseManualCoords(text: string): Coords | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Google Maps embed / place data format: !3dLAT!4dLON
  const mapsDataMatch = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (mapsDataMatch) {
    const lat = parseFloat(mapsDataMatch[1]);
    const lon = parseFloat(mapsDataMatch[2]);
    if (isValidCoords(lat, lon)) return { lat, lon };
  }

  // 2. Google Maps @lat,lon or ?q=lat,lon or plain "lat, lon"
  const commaMatch = trimmed.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (commaMatch) {
    const lat = parseFloat(commaMatch[1]);
    const lon = parseFloat(commaMatch[2]);
    if (isValidCoords(lat, lon)) return { lat, lon };
  }

  return null;
}

export function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function buildGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
}

export function buildGoogleMapsDirectionsUrl(
  destLat: number,
  destLon: number,
  origin?: { lat: number; lon: number } | null
): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destLat},${destLon}`,
  });
  if (origin && isValidCoords(origin.lat, origin.lon)) {
    params.set('origin', `${origin.lat},${origin.lon}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export async function reverseGeocodeCity(lat: number, lon: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&accept-language=it`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const addr = data?.address || {};
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.hamlet ||
      addr.county ||
      '';

    return city.trim() || null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  source: 'google' | 'osm';
}

export async function searchPlacesNominatim(
  query: string,
  nearCoords?: Coords | null
): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: trimmed,
      addressdetails: '1',
      'accept-language': 'it',
      limit: '5',
    });

    if (nearCoords && isValidCoords(nearCoords.lat, nearCoords.lon)) {
      const delta = 0.35;
      params.set(
        'viewbox',
        `${nearCoords.lon - delta},${nearCoords.lat + delta},${nearCoords.lon + delta},${nearCoords.lat - delta}`
      );
    }

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as Array<{
      place_id?: number | string;
      name?: string;
      display_name?: string;
      lat?: string;
      lon?: string;
      address?: Record<string, string | undefined>;
    }>;

    if (!Array.isArray(data)) return [];

    const results: PlaceSearchResult[] = [];
    for (const item of data) {
      const lat = Number.parseFloat(item.lat ?? '');
      const lon = Number.parseFloat(item.lon ?? '');
      if (!isValidCoords(lat, lon)) continue;

      const addr = item.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.hamlet ||
        addr.county ||
        '';

      const displayParts = (item.display_name || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const fallbackName = displayParts[0] || trimmed;
      const name = (item.name && item.name.trim()) || fallbackName;
      const address = displayParts.slice(item.name ? 1 : 1, 4).join(', ') || item.display_name || '';

      results.push({
        id: `osm-${item.place_id ?? `${lat},${lon}`}`,
        name,
        address,
        city: city.trim(),
        lat,
        lon,
        source: 'osm',
      });
    }

    return results;
  } finally {
    window.clearTimeout(timeout);
  }
}
