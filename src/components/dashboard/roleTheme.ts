import type { UserRole } from '../../types/app';

export interface RoleThemeConfig {
  role: UserRole;
  label: string;
  codename: string;
  primary: string;
  mid: string;
  bright: string;
  light: string;
  brass?: string;
  accentMetallic: string;
  headerStrip: string;
  heroGradient: string;
  progressGradient: string;
  activePillClass: string;
  badgeClass: string;
  ringClass: string;
  spotlightRgba: string;
  spotlightBorderRgba: string;
  borderTint: string;
  borderTintClass: string;
  textAccent: string;
  softBgClass: string;
  backdropWash: string;
  orbPrimary: string;
  orbSecondary: string;
  orbTertiary: string;
  ringStroke: string;
  glowRgba: string;
}

export const ROLE_THEMES: Record<UserRole, RoleThemeConfig> = {
  admin: {
    role: 'admin',
    label: 'Administrador',
    codename: 'Comando Central',
    primary: '#8B0018',
    mid: '#A31629',
    bright: '#C4283D',
    light: '#FBECEE',
    accentMetallic: '#D4AF37',
    headerStrip: 'linear-gradient(90deg, #4A040E 0%, #7C0A1B 38%, #A31629 74%, #C8A24A 100%)',
    heroGradient: 'linear-gradient(135deg, #2B060D 0%, #630A18 52%, #8A1527 100%)',
    progressGradient: 'linear-gradient(90deg, #6E0A19 0%, #9E1B2E 62%, #C8A24A 100%)',
    activePillClass:
      'bg-gradient-to-r from-[#6E0A19] via-[#8B0D20] to-[#A1182C] text-white shadow-[0_6px_18px_-4px_rgba(110,10,25,0.48),inset_0_1px_0_rgba(255,255,255,0.22)] border border-[#E2C275]/30',
    badgeClass:
      'bg-[#8B0018]/10 text-[#8B0018] border border-[#8B0018]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
    ringClass: 'ring-1 ring-[#A31629]/40 border-[#A31629]/45',
    spotlightRgba: 'rgba(159, 28, 52, 0.10)',
    spotlightBorderRgba: 'rgba(139, 0, 24, 0.28)',
    borderTint: 'rgba(139, 0, 24, 0.20)',
    borderTintClass: 'border-[#8B0018]/20',
    textAccent: 'text-[#8B0018]',
    softBgClass: 'bg-[#FEE2E2]/55',
    backdropWash:
      'radial-gradient(ellipse 85% 65% at 15% 12%, rgba(159, 28, 52, 0.13) 0%, transparent 58%), radial-gradient(ellipse 75% 60% at 88% 82%, rgba(212, 175, 55, 0.11) 0%, transparent 60%), linear-gradient(155deg, #FDFBF9 0%, #F8F0F0 48%, #F3E6E7 100%)',
    orbPrimary: 'rgba(159, 28, 52, 0.16)',
    orbSecondary: 'rgba(139, 0, 24, 0.13)',
    orbTertiary: 'rgba(212, 175, 55, 0.12)',
    ringStroke: 'rgba(139, 0, 24, 0.19)',
    glowRgba: 'rgba(110, 10, 25, 0.22)',
  },
  telemarketing: {
    role: 'telemarketing',
    label: 'Telemarketing',
    codename: 'Centro de Contacto',
    primary: '#0B4F6C',
    mid: '#0E7490',
    bright: '#168BA8',
    light: '#E3F4F8',
    accentMetallic: '#7CC0DB',
    headerStrip: 'linear-gradient(90deg, #062838 0%, #0B4F6C 42%, #0E7490 78%, #7CC0DB 100%)',
    heroGradient: 'linear-gradient(135deg, #052230 0%, #0A4660 52%, #0E6A85 100%)',
    progressGradient: 'linear-gradient(90deg, #0B4F6C 0%, #0E7490 60%, #4D9DB8 100%)',
    activePillClass:
      'bg-gradient-to-r from-[#083B52] via-[#0B5675] to-[#0E7490] text-white shadow-[0_6px_18px_-4px_rgba(11,79,108,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] border border-[#9CC7E0]/35',
    badgeClass:
      'bg-[#0891B2]/12 text-[#0B4F6C] border border-[#0891B2]/26 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
    ringClass: 'ring-1 ring-[#0E7490]/40 border-[#0E7490]/45',
    spotlightRgba: 'rgba(14, 116, 144, 0.10)',
    spotlightBorderRgba: 'rgba(11, 79, 108, 0.30)',
    borderTint: 'rgba(14, 116, 144, 0.22)',
    borderTintClass: 'border-[#0891B2]/22',
    textAccent: 'text-[#0B4F6C]',
    softBgClass: 'bg-[#CFFAFE]/55',
    backdropWash:
      'radial-gradient(ellipse 85% 65% at 18% 12%, rgba(14, 116, 144, 0.13) 0%, transparent 58%), radial-gradient(ellipse 75% 60% at 85% 84%, rgba(11, 79, 108, 0.12) 0%, transparent 60%), linear-gradient(155deg, #F9FCFD 0%, #EEF6F9 48%, #E4F0F5 100%)',
    orbPrimary: 'rgba(14, 116, 144, 0.16)',
    orbSecondary: 'rgba(11, 79, 108, 0.14)',
    orbTertiary: 'rgba(124, 192, 219, 0.13)',
    ringStroke: 'rgba(14, 116, 144, 0.20)',
    glowRgba: 'rgba(11, 79, 108, 0.22)',
  },
  vendedor: {
    role: 'vendedor',
    label: 'Vendedor',
    codename: 'Vanguardia Comercial',
    primary: '#2B3A24',
    mid: '#3F5432',
    bright: '#526836',
    brass: '#C8A85B',
    light: '#E9F0E2',
    accentMetallic: '#C8A85B',
    headerStrip: 'linear-gradient(90deg, #1B2516 0%, #2B3A24 40%, #485E36 74%, #C8A85B 100%)',
    heroGradient: 'linear-gradient(135deg, #172013 0%, #263520 50%, #3A4E2F 100%)',
    progressGradient: 'linear-gradient(90deg, #2B3A24 0%, #4A5F36 66%, #C8A85B 100%)',
    activePillClass:
      'bg-gradient-to-r from-[#23301D] via-[#34472A] to-[#465C34] text-white shadow-[0_6px_18px_-4px_rgba(35,48,29,0.48),inset_0_1px_0_rgba(243,226,179,0.22)] border border-[#C8A85B]/40',
    badgeClass:
      'bg-[#2B3A24]/10 text-[#2B3A24] border border-[#3F5432]/26 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
    ringClass: 'ring-1 ring-[#485E36]/40 border-[#C8A85B]/50',
    spotlightRgba: 'rgba(74, 95, 54, 0.11)',
    spotlightBorderRgba: 'rgba(200, 168, 91, 0.36)',
    borderTint: 'rgba(63, 84, 50, 0.22)',
    borderTintClass: 'border-[#3F5432]/22',
    textAccent: 'text-[#2B3A24]',
    softBgClass: 'bg-[#E6EEDB]/65',
    backdropWash:
      'radial-gradient(ellipse 85% 65% at 16% 12%, rgba(74, 95, 54, 0.13) 0%, transparent 58%), radial-gradient(ellipse 70% 58% at 86% 82%, rgba(43, 58, 36, 0.12) 0%, transparent 60%), radial-gradient(ellipse 55% 45% at 72% 18%, rgba(200, 168, 91, 0.12) 0%, transparent 55%), linear-gradient(155deg, #FAFBF8 0%, #F1F5EC 48%, #E7EEE0 100%)',
    orbPrimary: 'rgba(74, 95, 54, 0.16)',
    orbSecondary: 'rgba(43, 58, 36, 0.14)',
    orbTertiary: 'rgba(200, 168, 91, 0.15)',
    ringStroke: 'rgba(63, 84, 50, 0.20)',
    glowRgba: 'rgba(43, 58, 36, 0.22)',
  },
};

export function getRoleTheme(role?: UserRole | null): RoleThemeConfig {
  if (role && role in ROLE_THEMES) {
    return ROLE_THEMES[role];
  }
  return ROLE_THEMES.admin;
}
