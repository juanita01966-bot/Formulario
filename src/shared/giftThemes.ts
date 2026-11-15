import type { GiftThemeId } from '../types/app';

export interface Box3DPalette {
  front: string;
  side: string;
  lid: string;
  ribbonStart: string;
  ribbonMid: string;
  ribbonEnd: string;
  glow: string;
}

export interface GiftThemePreset {
  id: GiftThemeId;
  name: string;
  subtitle: string;
  badgeColor: string;
  swatches: [string, string, string];
  boxes: Box3DPalette[];
}

function shadeHex(hex: string, percent: number): string {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const num = parseInt(clean, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round((255 * percent) / 100)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round((255 * percent) / 100)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round((255 * percent) / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const GIFT_THEME_PRESETS: GiftThemePreset[] = [
  {
    id: 'autumn',
    name: 'Otoño Dorado',
    subtitle: 'Terracota cálido, canela y listón de oro imperial',
    badgeColor: '#B84A27',
    swatches: ['#B84A27', '#D45A32', '#E5AE4E'],
    boxes: [
      { front: '#B84A27', side: '#7A2B14', lid: '#D45A32', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(229,174,78,0.34)' },
      { front: '#9E381E', side: '#662010', lid: '#BF4A2B', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(229,174,78,0.34)' },
      { front: '#8C4A19', side: '#5A2E0D', lid: '#B06224', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(229,174,78,0.34)' },
      { front: '#A84220', side: '#6E2710', lid: '#C85730', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(229,174,78,0.34)' },
      { front: '#7D3B23', side: '#4F2213', lid: '#9E4D30', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(229,174,78,0.34)' },
      { front: '#B05224', side: '#733112', lid: '#CF6934', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(229,174,78,0.34)' },
    ],
  },
  {
    id: 'marble-gold',
    name: 'Mármol & Champán',
    subtitle: 'Marfil Calacatta, piedra cálida y lazo bronce',
    badgeColor: '#C89B54',
    swatches: ['#EDE3D5', '#C89B54', '#8C6226'],
    boxes: [
      { front: '#DFD2C0', side: '#B5A188', lid: '#F4ECE1', ribbonStart: '#FFF3C4', ribbonMid: '#C88A2B', ribbonEnd: '#7B4B12', glow: 'rgba(244,202,115,0.4)' },
      { front: '#D6C5AF', side: '#A89277', lid: '#EDE2D3', ribbonStart: '#FFF3C4', ribbonMid: '#C88A2B', ribbonEnd: '#7B4B12', glow: 'rgba(244,202,115,0.4)' },
      { front: '#E3D7C7', side: '#B9A68E', lid: '#F7F1E8', ribbonStart: '#FFF3C4', ribbonMid: '#C88A2B', ribbonEnd: '#7B4B12', glow: 'rgba(244,202,115,0.4)' },
    ],
  },
  {
    id: 'obsidian-luxe',
    name: 'Gala Obsidiana',
    subtitle: 'Negro espresso profundo con listón oro 24k',
    badgeColor: '#261810',
    swatches: ['#2C1E18', '#17100C', '#E5AE4E'],
    boxes: [
      { front: '#2E2019', side: '#18100C', lid: '#422E24', ribbonStart: '#FEF08A', ribbonMid: '#E5AE4E', ribbonEnd: '#9A6018', glow: 'rgba(229,174,78,0.38)' },
      { front: '#251B16', side: '#130D0A', lid: '#382820', ribbonStart: '#FEF08A', ribbonMid: '#E5AE4E', ribbonEnd: '#9A6018', glow: 'rgba(229,174,78,0.38)' },
      { front: '#34231A', side: '#1C120D', lid: '#4A3326', ribbonStart: '#FEF08A', ribbonMid: '#E5AE4E', ribbonEnd: '#9A6018', glow: 'rgba(229,174,78,0.38)' },
    ],
  },
  {
    id: 'emerald-sage',
    name: 'Bosque Esmeralda',
    subtitle: 'Verde salvia imperial, pino y destellos ámbar',
    badgeColor: '#2E5A44',
    swatches: ['#2E5A44', '#1D3D2D', '#E5AE4E'],
    boxes: [
      { front: '#2E5A44', side: '#1B382A', lid: '#3D7358', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(75,163,115,0.34)' },
      { front: '#264E3A', side: '#163023', lid: '#35684F', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(75,163,115,0.34)' },
      { front: '#36634C', side: '#203E2F', lid: '#467D61', ribbonStart: '#FEF08A', ribbonMid: '#D4942A', ribbonEnd: '#8A5212', glow: 'rgba(75,163,115,0.34)' },
    ],
  },
  {
    id: 'ruby-velvet',
    name: 'Terciopelo Rubí',
    subtitle: 'Borgoña real, carmesí de gala y listón champán',
    badgeColor: '#7C1D2E',
    swatches: ['#7C1D2E', '#52101C', '#F4CA73'],
    boxes: [
      { front: '#7C1D2E', side: '#4F101B', lid: '#99263B', ribbonStart: '#FFF3C4', ribbonMid: '#E5AE4E', ribbonEnd: '#8F5514', glow: 'rgba(225,85,105,0.34)' },
      { front: '#6B1827', side: '#420D16', lid: '#872033', ribbonStart: '#FFF3C4', ribbonMid: '#E5AE4E', ribbonEnd: '#8F5514', glow: 'rgba(225,85,105,0.34)' },
      { front: '#8A2235', side: '#591320', lid: '#A82D43', ribbonStart: '#FFF3C4', ribbonMid: '#E5AE4E', ribbonEnd: '#8F5514', glow: 'rgba(225,85,105,0.34)' },
    ],
  },
];

export function resolveBoxPalette(
  themeId: GiftThemeId | undefined,
  customBoxColor: string | undefined,
  index = 0
): Box3DPalette {
  if (themeId === 'custom' && customBoxColor && /^#[0-9a-fA-F]{6}$/.test(customBoxColor.trim())) {
    const base = customBoxColor.trim();
    const offset = (index % 3) * 4 - 4;
    const front = shadeHex(base, offset);
    const side = shadeHex(base, -18 + offset);
    const lid = shadeHex(base, 12 + offset);
    return {
      front,
      side,
      lid,
      ribbonStart: '#FEF08A',
      ribbonMid: '#D4942A',
      ribbonEnd: '#8A5212',
      glow: 'rgba(229,174,78,0.36)',
    };
  }

  const preset = GIFT_THEME_PRESETS.find((t) => t.id === themeId) || GIFT_THEME_PRESETS[0];
  return preset.boxes[index % preset.boxes.length];
}
