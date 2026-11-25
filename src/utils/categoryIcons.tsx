import type { ComponentType, SVGProps } from 'react';
import {
  Bath,
  Coffee,
  Route,
  MapPin,
  Umbrella,
  Waves,
  Car,
  Bookmark,
} from 'lucide-react';

export type CategoryIconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

function MushroomIcon({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M4 13a8 8 0 0 1 16 0c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1Z" />
      <path d="M9.5 14v5a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-5" />
      <circle cx="9.5" cy="9.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export interface CategoryMeta {
  icon: CategoryIconComponent;
  markerBg: string;
  markerBorder: string;
  iconBgClass: string;
  iconTextClass: string;
  activeControlClass: string;
  topAccentClass: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  'Toilet / Servizio': {
    icon: Bath,
    markerBg: '#0d9488',
    markerBorder: '#115e59',
    iconBgClass: 'bg-teal-100 dark:bg-teal-500/20',
    iconTextClass: 'text-teal-700 dark:text-teal-300',
    activeControlClass: 'bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-600/25',
    topAccentClass: 'from-teal-400 via-emerald-400 to-cyan-400',
  },
  'Bar / Prodotto': {
    icon: Coffee,
    markerBg: '#ea580c',
    markerBorder: '#9a3412',
    iconBgClass: 'bg-orange-100 dark:bg-orange-500/20',
    iconTextClass: 'text-orange-700 dark:text-orange-300',
    activeControlClass: 'bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-600/25',
    topAccentClass: 'from-orange-400 via-amber-400 to-yellow-400',
  },
  'Scorciatoia': {
    icon: Route,
    markerBg: '#7c3aed',
    markerBorder: '#5b21b6',
    iconBgClass: 'bg-violet-100 dark:bg-violet-500/20',
    iconTextClass: 'text-violet-700 dark:text-violet-300',
    activeControlClass: 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/25',
    topAccentClass: 'from-violet-400 via-purple-400 to-fuchsia-400',
  },
  'Località': {
    icon: MapPin,
    markerBg: '#e11d48',
    markerBorder: '#9f1239',
    iconBgClass: 'bg-rose-100 dark:bg-rose-500/20',
    iconTextClass: 'text-rose-700 dark:text-rose-300',
    activeControlClass: 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-600/25',
    topAccentClass: 'from-rose-400 via-pink-400 to-orange-400',
  },
  'Spiaggia': {
    icon: Umbrella,
    markerBg: '#06b6d4',
    markerBorder: '#0e7490',
    iconBgClass: 'bg-cyan-100 dark:bg-cyan-500/20',
    iconTextClass: 'text-cyan-700 dark:text-cyan-300',
    activeControlClass: 'bg-cyan-600 border-cyan-600 text-white shadow-sm shadow-cyan-600/25',
    topAccentClass: 'from-cyan-400 via-sky-400 to-amber-300',
  },
  'Fiume': {
    icon: Waves,
    markerBg: '#0284c7',
    markerBorder: '#075985',
    iconBgClass: 'bg-sky-100 dark:bg-sky-500/20',
    iconTextClass: 'text-sky-700 dark:text-sky-300',
    activeControlClass: 'bg-sky-600 border-sky-600 text-white shadow-sm shadow-sky-600/25',
    topAccentClass: 'from-sky-400 via-blue-400 to-teal-400',
  },
  'Funghi': {
    icon: MushroomIcon,
    markerBg: '#16a34a',
    markerBorder: '#14532d',
    iconBgClass: 'bg-emerald-100 dark:bg-emerald-500/20',
    iconTextClass: 'text-emerald-700 dark:text-emerald-300',
    activeControlClass: 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/25',
    topAccentClass: 'from-emerald-400 via-green-400 to-lime-400',
  },
  'Lavoro / Parcheggio': {
    icon: Car,
    markerBg: '#2563eb',
    markerBorder: '#1e40af',
    iconBgClass: 'bg-blue-100 dark:bg-blue-500/20',
    iconTextClass: 'text-blue-700 dark:text-blue-300',
    activeControlClass: 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/25',
    topAccentClass: 'from-blue-500 via-indigo-400 to-sky-400',
  },
  'Altro': {
    icon: Bookmark,
    markerBg: '#d97706',
    markerBorder: '#92400e',
    iconBgClass: 'bg-amber-100 dark:bg-amber-500/20',
    iconTextClass: 'text-amber-700 dark:text-amber-300',
    activeControlClass: 'bg-amber-600 border-amber-600 text-white shadow-sm shadow-amber-600/25',
    topAccentClass: 'from-amber-400 via-yellow-400 to-orange-400',
  },
};

const DEFAULT_META: CategoryMeta = {
  icon: Bookmark,
  markerBg: '#d97706',
  markerBorder: '#92400e',
  iconBgClass: 'bg-amber-100 dark:bg-amber-500/20',
  iconTextClass: 'text-amber-700 dark:text-amber-300',
  activeControlClass: 'bg-amber-600 border-amber-600 text-white shadow-sm shadow-amber-600/25',
  topAccentClass: 'from-amber-400 via-yellow-400 to-orange-400',
};

export function getCategoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] || DEFAULT_META;
}

export function getCategoryIcon(category: string): CategoryIconComponent {
  return getCategoryMeta(category).icon;
}

export function getCategoryMarkerColors(category: string): { bg: string; border: string } {
  const meta = getCategoryMeta(category);
  return { bg: meta.markerBg, border: meta.markerBorder };
}
