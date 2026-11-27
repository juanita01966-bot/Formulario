export type DashboardSurfaceTheme = 'porcelain' | 'obsidian-marble' | 'royal-blue';

export interface SurfaceThemeMeta {
  id: DashboardSurfaceTheme;
  label: string;
  shortLabel: string;
  description: string;
  isDark: boolean;
  swatchStyle: string;
  accentColor: string;
}

export const STORAGE_KEY = 'cipriano_dsb_surface_theme';

export const DEFAULT_SURFACE_THEME: DashboardSurfaceTheme = 'obsidian-marble';

export const SURFACE_THEMES: SurfaceThemeMeta[] = [
  {
    id: 'porcelain',
    label: 'Cristal Claro',
    shortLabel: 'Porcelana',
    description: 'Porcelana esmerilada translúcida con luminosidad cálida',
    isDark: false,
    swatchStyle: 'linear-gradient(135deg, #FFFFFF 0%, #F5EDE3 52%, #E5D4C0 100%)',
    accentColor: '#C8A85B',
  },
  {
    id: 'obsidian-marble',
    label: 'Mármol Oscuro',
    shortLabel: 'Mármol',
    description: 'Mármol Nero Marquina de lujo con vetas doradas y marfil',
    isDark: true,
    swatchStyle:
      'linear-gradient(135deg, #08080A 0%, #17161D 42%, #F4CA73 46.5%, #FFF8EA 48%, #15141B 51%, #09090C 100%)',
    accentColor: '#F4CA73',
  },
  {
    id: 'royal-blue',
    label: 'Azul Rey',
    shortLabel: 'Azul Rey',
    description: 'Zafiro imperial translúcido con destellos de oro y cristal',
    isDark: true,
    swatchStyle:
      'linear-gradient(135deg, #071438 0%, #0E2463 48%, #1A44A8 82%, #93C5FD 100%)',
    accentColor: '#93C5FD',
  },
];

function isDashboardSurfaceTheme(value: unknown): value is DashboardSurfaceTheme {
  return value === 'porcelain' || value === 'obsidian-marble' || value === 'royal-blue';
}

export function getSurfaceThemeMeta(theme: DashboardSurfaceTheme): SurfaceThemeMeta {
  return SURFACE_THEMES.find((item) => item.id === theme) ?? SURFACE_THEMES[1];
}

export function readSavedSurfaceTheme(): DashboardSurfaceTheme {
  if (typeof window === 'undefined') {
    return DEFAULT_SURFACE_THEME;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isDashboardSurfaceTheme(raw)) {
      return raw;
    }
  } catch {
    // Ignore storage access errors in private/restricted contexts
  }
  return DEFAULT_SURFACE_THEME;
}

export function saveSurfaceTheme(theme: DashboardSurfaceTheme): void {
  if (typeof window === 'undefined' || !isDashboardSurfaceTheme(theme)) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage write errors in private/restricted contexts
  }
}
