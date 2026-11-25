export const CATEGORIES = [
  'Toilet / Servizio',
  'Bar / Prodotto',
  'Scorciatoia',
  'Località',
  'Spiaggia',
  'Fiume',
  'Funghi',
  'Lavoro / Parcheggio',
  'Altro',
] as const;

export type SpotCategory = (typeof CATEGORIES)[number];

export interface Coords {
  lat: number;
  lon: number;
  acc?: number;
}

export interface Spot {
  id: number | string;
  title: string;
  city: string;
  category: string;
  note: string;
  lat: number;
  lon: number;
  photo: string | null;
  voiceMemo?: string | null;
  voiceMemoDuration?: number | null;
  createdAt: string;
}

export type SortOption = 'distance' | 'newest' | 'alpha';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}
