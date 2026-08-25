const EXACT_DEVICE_COLOR_SWATCHES: Record<string, string> = {
  black: '#242424',
  white: '#f7f7f5',
  pink: '#f2a9bd',
  blue: '#6d9fd3',
  green: '#7da57a',
  red: '#d94b4b',
  purple: '#9b86c8',
  yellow: '#e9cf62',
  orange: '#e8954d',
  gold: '#d8ba73',
  silver: '#c8cdd2',
  gray: '#8c9298',
  grey: '#8c9298',
  graphite: '#5f6062',
  midnight: '#1d2730',
  starlight: '#e8e0d2',
  'rose gold': '#d9a39b',
  'space gray': '#777b80',
  'space grey': '#777b80',
  'sierra blue': '#9bb5ce',
  'alpine green': '#576b61',
  'deep purple': '#66586e',
  'natural titanium': '#b4aa98',
  'blue titanium': '#53606c',
  'white titanium': '#e6e4df',
  'black titanium': '#3e3d3b',
  'desert titanium': '#c2a78f',
  ultramarine: '#5866ad',
  teal: '#4d9b98',
  aqua: '#70b7bd',
  cyan: '#65b8c8',
  coral: '#e68072',
  'product red': '#c92a2f',
  lavender: '#b5a5cf',
  mint: '#9bc7b1',
  cream: '#ede3c9',
  beige: '#d8c8ad',
  brown: '#8b6b53',
  bronze: '#a97855',
  navy: '#394f68',

  // Common manufacturer finish names that do not read well from a generic hash.
  'cosmic orange': '#e8753d',
  'deep blue': '#31577a',
  'ocean blue': '#4f83ad',
  'sky blue': '#9ec5df',
  'forest green': '#55735b',
  'sage green': '#9aab91',
  'hot pink': '#e96f9d',
  'light pink': '#efc2cf',
  'midnight green': '#445b52',
  'midnight blue': '#273f59',
  'jet black': '#1b1b1b',
  'matte black': '#303030',
  'gloss black': '#202020',
};

const BASE_COLOR_SWATCHES: Record<string, string> = {
  black: '#242424',
  white: '#f7f7f5',
  pink: '#f2a9bd',
  blue: '#6d9fd3',
  green: '#7da57a',
  red: '#d94b4b',
  purple: '#9b86c8',
  yellow: '#e9cf62',
  orange: '#e8954d',
  gold: '#d8ba73',
  silver: '#c8cdd2',
  gray: '#8c9298',
  grey: '#8c9298',
  teal: '#4d9b98',
  aqua: '#70b7bd',
  cyan: '#65b8c8',
  coral: '#e68072',
  lavender: '#b5a5cf',
  mint: '#9bc7b1',
  cream: '#ede3c9',
  beige: '#d8c8ad',
  brown: '#8b6b53',
  bronze: '#a97855',
  navy: '#394f68',
  graphite: '#5f6062',
  titanium: '#aaa39a',
};

const DARK_BASE_COLOR_SWATCHES: Record<string, string> = {
  black: '#171717',
  pink: '#b8677f',
  blue: '#31577a',
  green: '#4f6b55',
  red: '#9f3737',
  purple: '#66547c',
  orange: '#b95f2d',
  yellow: '#aa9133',
  gold: '#9d8143',
  silver: '#777f87',
  gray: '#5e646a',
  grey: '#5e646a',
  teal: '#326f6c',
  aqua: '#43848a',
  cyan: '#3f8290',
  coral: '#b45549',
  brown: '#664d3d',
  bronze: '#795139',
  navy: '#26394e',
};

const LIGHT_BASE_COLOR_SWATCHES: Record<string, string> = {
  white: '#fafaf8',
  pink: '#f3c3d0',
  blue: '#a8c8e2',
  green: '#b4c9ad',
  red: '#e9a5a5',
  purple: '#c7b9de',
  orange: '#efb480',
  yellow: '#f0df91',
  gold: '#e7d39e',
  silver: '#dde0e3',
  gray: '#b8bdc2',
  grey: '#b8bdc2',
  teal: '#94c8c5',
  aqua: '#a7d5d9',
  cyan: '#a1d5df',
  coral: '#efb1a8',
  lavender: '#cfc4e2',
  mint: '#c5dfd0',
  cream: '#f4eddc',
  beige: '#e8dcc8',
};

function normalizeDeviceColor(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a presentation swatch for a device finish name without changing the
 * stored color value. Exact manufacturer finishes win, then recognizable color
 * words ("Cosmic Orange" -> orange), and only truly unknown names use a stable
 * generated fallback.
 */
export function getDeviceColorSwatch(value: string): string {
  const normalized = normalizeDeviceColor(value);
  if (!normalized) return '#a3a3a3';

  const exact = EXACT_DEVICE_COLOR_SWATCHES[normalized];
  if (exact) return exact;

  const tokens = new Set(normalized.split(' '));
  const base = Object.keys(BASE_COLOR_SWATCHES).find((name) => tokens.has(name));

  if (base) {
    const isDark = tokens.has('dark') || tokens.has('deep') || tokens.has('midnight');
    const isLight = tokens.has('light') || tokens.has('pale') || tokens.has('soft') || tokens.has('ice');

    if (isDark && DARK_BASE_COLOR_SWATCHES[base]) {
      return DARK_BASE_COLOR_SWATCHES[base]!;
    }
    if (isLight && LIGHT_BASE_COLOR_SWATCHES[base]) {
      return LIGHT_BASE_COLOR_SWATCHES[base]!;
    }
    return BASE_COLOR_SWATCHES[base]!;
  }

  let hash = 0;
  for (const char of normalized) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360} 38% 62%)`;
}
