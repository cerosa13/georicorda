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

      if (res.ok) {
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
        if (city.trim()) return city.trim();
      }
    } catch {
      // Fall through to Photon reverse geocoding
    }

    const photonUrl = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}`;
    const photonRes = await fetch(photonUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!photonRes.ok) {
      throw new Error(`HTTP ${photonRes.status}`);
    }
    const photonData = await photonRes.json();
    const props = photonData?.features?.[0]?.properties || {};
    const city =
      props.city ||
      props.town ||
      props.village ||
      props.municipality ||
      props.county ||
      '';
    return typeof city === 'string' && city.trim() ? city.trim() : null;
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

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

export async function searchPlacesPhoton(
  query: string,
  nearCoords?: Coords | null
): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const params = new URLSearchParams({
      q: trimmed,
      limit: '8',
    });

    // Apply GPS bias only for single-word generic searches (e.g., "bar", "parcheggio"),
    // so multi-word queries like "Bar Piccolo Chiavari" prioritize the city typed by the user.
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 1 && nearCoords && isValidCoords(nearCoords.lat, nearCoords.lon)) {
      params.set('lat', String(nearCoords.lat));
      params.set('lon', String(nearCoords.lon));
    }

    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as { features?: PhotonFeature[] };
    const features = Array.isArray(data?.features) ? data.features : [];

    const results: PlaceSearchResult[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      const coords = feat.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;

      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!isValidCoords(lat, lon)) continue;

      const p = feat.properties || {};
      const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ').trim();
      const name = (p.name && p.name.trim()) || streetLine || trimmed;

      const city = (
        p.city ||
        p.town ||
        p.village ||
        p.municipality ||
        (p.type === 'city' ? p.name : '') ||
        p.county ||
        ''
      ).trim();

      const addressParts = [streetLine, city, p.state, p.country]
        .map((part) => (part || '').trim())
        .filter((part, idx, arr) => Boolean(part) && part !== name && arr.indexOf(part) === idx);

      const dedupeKey = `${name.toLowerCase()}|${lat.toFixed(4)},${lon.toFixed(4)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      results.push({
        id: `photon-${p.osm_type || 'x'}-${p.osm_id ?? i}-${lat.toFixed(4)}`,
        name,
        address: addressParts.join(', '),
        city,
        lat,
        lon,
        source: 'osm',
      });
    }

    // Prefer Italian results first when mixed international matches appear
    const italian = results.filter((r) => r.address.toLowerCase().includes('italia'));
    const other = results.filter((r) => !r.address.toLowerCase().includes('italia'));
    return [...italian, ...other].slice(0, 6);
  } finally {
    window.clearTimeout(timeout);
  }
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

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 1 && nearCoords && isValidCoords(nearCoords.lat, nearCoords.lon)) {
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
      const address = displayParts.slice(1, 4).join(', ') || item.display_name || '';

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

export async function searchPlacesOpen(
  query: string,
  nearCoords?: Coords | null
): Promise<PlaceSearchResult[]> {
  try {
    const photonResults = await searchPlacesPhoton(query, nearCoords);
    if (photonResults.length > 0) {
      return photonResults;
    }
  } catch {
    // Fallback to Nominatim if Photon is unreachable or throttled
  }

  return searchPlacesNominatim(query, nearCoords);
}
