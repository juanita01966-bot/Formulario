import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { UserRole } from '../../types/app';
import { getRoleTheme } from './roleTheme';
import type { DashboardSurfaceTheme } from './surfaceTheme';

interface AutumnLeafSpec {
  id: number;
  left: string;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  rotateStart: number;
  rotateEnd: number;
  color: string;
  accent: string;
  opacity: number;
  shape: 'maple' | 'oak' | 'ginkgo';
}

const AUTUMN_LEAVES: AutumnLeafSpec[] = [
  { id: 101, left: '4%', size: 46, delay: 0, duration: 15.5, driftX: 64, rotateStart: -25, rotateEnd: 195, color: '#C84B24', accent: '#F29F4B', opacity: 0.72, shape: 'maple' },
  { id: 102, left: '16%', size: 38, delay: 2.4, duration: 18, driftX: -52, rotateStart: 35, rotateEnd: -165, color: '#D98A1E', accent: '#F9CF6B', opacity: 0.68, shape: 'ginkgo' },
  { id: 103, left: '28%', size: 44, delay: 5.8, duration: 16.5, driftX: 58, rotateStart: 12, rotateEnd: 225, color: '#9E3316', accent: '#D86B38', opacity: 0.66, shape: 'oak' },
  { id: 104, left: '44%', size: 36, delay: 1.2, duration: 19, driftX: -46, rotateStart: -40, rotateEnd: 150, color: '#E09A2B', accent: '#FCE192', opacity: 0.64, shape: 'maple' },
  { id: 105, left: '62%', size: 48, delay: 4.1, duration: 17, driftX: 54, rotateStart: 18, rotateEnd: -190, color: '#B8431F', accent: '#EDA145', opacity: 0.7, shape: 'maple' },
  { id: 106, left: '76%', size: 40, delay: 2.0, duration: 15, driftX: -58, rotateStart: -15, rotateEnd: 205, color: '#C87D20', accent: '#F6C465', opacity: 0.68, shape: 'ginkgo' },
  { id: 107, left: '89%', size: 42, delay: 6.5, duration: 17.5, driftX: -48, rotateStart: 28, rotateEnd: -175, color: '#8F2D14', accent: '#D45A32', opacity: 0.68, shape: 'oak' },
  { id: 108, left: '95%', size: 36, delay: 3.4, duration: 16, driftX: -40, rotateStart: -22, rotateEnd: 165, color: '#D88924', accent: '#F8D078', opacity: 0.64, shape: 'ginkgo' },
];

const AUTUMN_MOTES = [
  { id: 'dm1', left: '10%', top: '22%', size: 7, delay: 0.3, duration: 5.4 },
  { id: 'dm2', left: '24%', top: '66%', size: 6, delay: 1.5, duration: 6.6 },
  { id: 'dm3', left: '38%', top: '16%', size: 8, delay: 2.1, duration: 5.8 },
  { id: 'dm4', left: '56%', top: '78%', size: 6, delay: 0.8, duration: 6.2 },
  { id: 'dm5', left: '72%', top: '28%', size: 7, delay: 2.8, duration: 5.6 },
  { id: 'dm6', left: '84%', top: '58%', size: 8, delay: 1.1, duration: 7.0 },
  { id: 'dm7', left: '91%', top: '19%', size: 6, delay: 3.2, duration: 6.0 },
  { id: 'dm8', left: '17%', top: '84%', size: 5, delay: 1.9, duration: 5.2 },
];

function AutumnLeafSvg({
  shape,
  color,
  accent,
  size,
  id,
}: {
  shape: AutumnLeafSpec['shape'];
  color: string;
  accent: string;
  size: number;
  id: number;
}) {
  const gradId = `dsb-leaf-grad-${id}`;
  if (shape === 'ginkgo') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className="sm:drop-shadow-[0_6px_8px_rgba(34,21,14,0.22)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={accent} />
            <stop offset="65%" stopColor={color} />
            <stop offset="100%" stopColor="#5C1D0C" />
          </linearGradient>
        </defs>
        <path
          d="M24 43V27M24 27C13 26 5 18 8 8C14 9 19 13 24 17C29 13 34 9 40 8C43 18 35 26 24 27Z"
          fill={`url(#${gradId})`}
          stroke="#5C1D0C"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 27L16 14M24 27L21 15M24 27L27 15M24 27L32 14"
          stroke="#FFF5E4"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (shape === 'oak') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className="sm:drop-shadow-[0_6px_8px_rgba(34,21,14,0.22)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={accent} />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor="#4F1809" />
          </linearGradient>
        </defs>
        <path
          d="M24 44V35M24 35C18 35 14 31 16 27C11 25 11 19 16 17C14 12 19 7 24 5C29 7 34 12 32 17C37 19 37 25 32 27C34 31 30 35 24 35Z"
          fill={`url(#${gradId})`}
          stroke="#4F1809"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 9V35M24 17L18 13M24 22L31 18M24 26L17 22M24 30L30 26"
          stroke="#FFF5E4"
          strokeOpacity="0.6"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className="sm:drop-shadow-[0_6px_9px_rgba(34,21,14,0.24)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={accent} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor="#591A0A" />
        </linearGradient>
      </defs>
      <path
        d="M24 44V33M24 5L28 15L38 12L33 21L42 25L31 29L32 35L24 31L16 35L17 29L6 25L15 21L10 12L20 15L24 5Z"
        fill={`url(#${gradId})`}
        stroke="#591A0A"
        strokeOpacity="0.4"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M24 11V33M24 22L15 16M24 22L33 16M24 27L14 25M24 27L34 25"
        stroke="#FFF6E6"
        strokeOpacity="0.65"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface DashboardBackdropProps {
  role?: UserRole | 'gateway';
  stage?: string;
  surfaceTheme?: DashboardSurfaceTheme;
}

const GATEWAY_PALETTE = {
  backdropWash:
    'radial-gradient(ellipse 85% 65% at 18% 14%, rgba(139, 0, 24, 0.16) 0%, transparent 56%), radial-gradient(ellipse 75% 60% at 84% 84%, rgba(200, 168, 91, 0.22) 0%, transparent 58%), linear-gradient(155deg, #FAF6F0 0%, #F4ECE4 50%, #EFE4DA 100%)',
  orbPrimary: 'rgba(139, 0, 24, 0.16)',
  orbSecondary: 'rgba(200, 168, 91, 0.22)',
  orbTertiary: 'rgba(185, 28, 28, 0.12)',
  ringStroke: 'rgba(139, 0, 24, 0.20)',
  glowRgba: 'rgba(139, 0, 24, 0.18)',
  dotColor: 'rgba(89, 65, 51, 0.11)',
};

const ROLE_DARK_AURAS: Record<
  UserRole | 'gateway',
  {
    orbPrimary: string;
    orbSecondary: string;
    orbTertiary: string;
    washTint: string;
  }
> = {
  gateway: {
    orbPrimary: 'rgba(139, 0, 24, 0.22)',
    orbSecondary: 'rgba(244, 202, 115, 0.16)',
    orbTertiary: 'rgba(185, 28, 28, 0.14)',
    washTint: 'rgba(139, 0, 24, 0.14)',
  },
  ai_manager: {
    orbPrimary: 'rgba(232, 189, 85, 0.28)',
    orbSecondary: 'rgba(200, 150, 46, 0.22)',
    orbTertiary: 'rgba(247, 220, 136, 0.18)',
    washTint: 'rgba(200, 150, 46, 0.19)',
  },
  admin: {
    orbPrimary: 'rgba(185, 28, 28, 0.22)',
    orbSecondary: 'rgba(244, 202, 115, 0.14)',
    orbTertiary: 'rgba(139, 0, 24, 0.18)',
    washTint: 'rgba(185, 28, 28, 0.14)',
  },
  telemarketing: {
    orbPrimary: 'rgba(6, 182, 212, 0.20)',
    orbSecondary: 'rgba(14, 116, 144, 0.18)',
    orbTertiary: 'rgba(56, 189, 248, 0.14)',
    washTint: 'rgba(8, 145, 178, 0.14)',
  },
  vendedor: {
    orbPrimary: 'rgba(85, 107, 47, 0.22)',
    orbSecondary: 'rgba(200, 168, 91, 0.16)',
    orbTertiary: 'rgba(63, 84, 50, 0.18)',
    washTint: 'rgba(85, 107, 47, 0.14)',
  },
};

export const DashboardBackdrop: React.FC<DashboardBackdropProps> = ({
  role = 'gateway',
  stage,
  surfaceTheme = 'porcelain',
}) => {
  const prefersReducedMotion = useReducedMotion();

  const isGateway = role === 'gateway';
  const isAiManager = role === 'ai_manager';
  const isVault = stage === 'filter2_pin';
  const isObsidian = surfaceTheme === 'obsidian-marble';
  const isRoyalBlue = surfaceTheme === 'royal-blue';
  const isDarkSurface = isObsidian || isRoyalBlue;

  const theme = isGateway ? null : getRoleTheme(role);
  const darkAura = ROLE_DARK_AURAS[role] ?? ROLE_DARK_AURAS.gateway;

  const palette = isObsidian
    ? {
        backdropWash: isAiManager
          ? `radial-gradient(ellipse 82% 62% at 16% 14%, rgba(232, 189, 85, 0.22) 0%, transparent 56%), radial-gradient(ellipse 74% 58% at 84% 84%, rgba(200, 150, 46, 0.16) 0%, transparent 58%), linear-gradient(155deg, #090806 0%, #14110B 48%, #0B0907 100%)`
          : `radial-gradient(ellipse 80% 60% at 16% 14%, ${darkAura.washTint} 0%, transparent 56%), radial-gradient(ellipse 70% 55% at 84% 84%, rgba(244, 202, 115, 0.10) 0%, transparent 58%), linear-gradient(155deg, #08080A 0%, #111015 48%, #0A090C 100%)`,
        orbPrimary: darkAura.orbPrimary,
        orbSecondary: darkAura.orbSecondary,
        orbTertiary: darkAura.orbTertiary,
        ringStroke: isAiManager ? 'rgba(245, 214, 123, 0.44)' : 'rgba(244, 202, 115, 0.30)',
        glowRgba: isAiManager ? 'rgba(232, 189, 85, 0.34)' : 'rgba(244, 202, 115, 0.24)',
        dotColor: isAiManager ? 'rgba(245, 214, 123, 0.11)' : 'rgba(244, 202, 115, 0.08)',
      }
    : isRoyalBlue
      ? {
          backdropWash: `radial-gradient(ellipse 82% 62% at 18% 12%, rgba(59, 130, 246, 0.22) 0%, transparent 58%), radial-gradient(ellipse 72% 58% at 84% 86%, rgba(244, 202, 115, 0.14) 0%, transparent 58%), radial-gradient(ellipse 55% 45% at 74% 18%, ${darkAura.washTint} 0%, transparent 55%), linear-gradient(155deg, #040B24 0%, #0A1D56 38%, #102C7A 72%, #061133 100%)`,
          orbPrimary: isAiManager ? 'rgba(232, 189, 85, 0.24)' : 'rgba(37, 99, 235, 0.26)',
          orbSecondary: darkAura.orbPrimary,
          orbTertiary: 'rgba(244, 202, 115, 0.18)',
          ringStroke: isAiManager ? 'rgba(245, 214, 123, 0.42)' : 'rgba(147, 197, 253, 0.32)',
          glowRgba: isAiManager ? 'rgba(232, 189, 85, 0.32)' : 'rgba(96, 165, 250, 0.28)',
          dotColor: isAiManager ? 'rgba(245, 214, 123, 0.11)' : 'rgba(147, 197, 253, 0.10)',
        }
      : theme
        ? {
            backdropWash: theme.backdropWash,
            orbPrimary: theme.orbPrimary,
            orbSecondary: theme.orbSecondary,
            orbTertiary: theme.orbTertiary,
            ringStroke: theme.ringStroke,
            glowRgba: theme.glowRgba,
            dotColor: `${theme.primary}1A`,
          }
        : GATEWAY_PALETTE;

  const watermarkOpacity = isDarkSurface ? 0.34 : isGateway || isVault ? 0.36 : 0.28;

  const watermarkFilter = isObsidian
    ? 'drop-shadow(0 12px 34px rgba(244, 202, 115, 0.34)) drop-shadow(0 0 22px rgba(255, 248, 232, 0.16)) brightness(1.08) contrast(1.08)'
    : isRoyalBlue
      ? 'drop-shadow(0 12px 34px rgba(147, 197, 253, 0.36)) drop-shadow(0 0 24px rgba(244, 202, 115, 0.20)) brightness(1.1) contrast(1.08)'
      : `drop-shadow(0 12px 32px ${palette.glowRgba}) contrast(1.06) saturate(1.05)`;

  const haloBackground = isObsidian
    ? 'radial-gradient(circle, rgba(244, 202, 115, 0.18) 0%, rgba(255, 248, 232, 0.08) 38%, transparent 72%)'
    : isRoyalBlue
      ? 'radial-gradient(circle, rgba(147, 197, 253, 0.22) 0%, rgba(244, 202, 115, 0.10) 42%, transparent 74%)'
      : `radial-gradient(circle, rgba(255,255,255,0.78) 0%, ${palette.glowRgba} 46%, transparent 74%)`;

  const vignetteBackground = isObsidian
    ? 'radial-gradient(circle at 50% 48%, transparent 42%, rgba(0, 0, 0, 0.52) 100%)'
    : isRoyalBlue
      ? 'radial-gradient(circle at 50% 48%, transparent 42%, rgba(2, 6, 23, 0.52) 100%)'
      : 'radial-gradient(circle at 50% 48%, transparent 45%, rgba(255, 255, 255, 0.24) 100%)';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Surface & role-tinted atmospheric wash */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{ background: palette.backdropWash }}
      />

      {/* Nero Marquina luxury black marble champagne-gold & ivory veining */}
      {isObsidian && (
        <svg
          className="absolute inset-0 h-full w-full opacity-90 transition-opacity duration-700"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="dsb-marble-gold-a" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F4CA73" stopOpacity="0" />
              <stop offset="28%" stopColor="#F4CA73" stopOpacity="0.24" />
              <stop offset="56%" stopColor="#FFF8EA" stopOpacity="0.18" />
              <stop offset="82%" stopColor="#C8A85B" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#F4CA73" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="dsb-marble-ivory" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="35%" stopColor="#F8F4EC" stopOpacity="0.14" />
              <stop offset="68%" stopColor="#F4CA73" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <filter id="dsb-marble-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          {/* Soft golden under-glow veins */}
          <path
            d="M-60 760 C 180 650, 340 540, 560 470 C 780 400, 960 280, 1220 150 C 1320 100, 1410 55, 1500 10"
            stroke="url(#dsb-marble-gold-a)"
            strokeWidth="7"
            strokeLinecap="round"
            filter="url(#dsb-marble-glow)"
          />
          <path
            d="M160 940 C 370 790, 590 700, 810 560 C 1020 425, 1190 365, 1480 240"
            stroke="url(#dsb-marble-ivory)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#dsb-marble-glow)"
          />
          {/* Crisp primary champagne-gold & ivory marble fracture veins */}
          <path
            d="M-60 760 C 180 650, 340 540, 560 470 C 780 400, 960 280, 1220 150 C 1320 100, 1410 55, 1500 10"
            stroke="url(#dsb-marble-gold-a)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M320 558 C 430 515, 515 440, 640 392 C 745 352, 850 322, 955 245"
            stroke="url(#dsb-marble-ivory)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M160 940 C 370 790, 590 700, 810 560 C 1020 425, 1190 365, 1480 240"
            stroke="url(#dsb-marble-ivory)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <path
            d="M-40 310 C 160 240, 320 205, 510 120 C 660 52, 790 24, 940 -30"
            stroke="url(#dsb-marble-gold-a)"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
          <path
            d="M740 930 C 920 820, 1080 760, 1250 645 C 1345 580, 1415 535, 1510 475"
            stroke="url(#dsb-marble-gold-a)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Imperial Royal Blue / Sapphire crystal facet & gold shimmer */}
      {isRoyalBlue && (
        <svg
          className="absolute inset-0 h-full w-full opacity-90 transition-opacity duration-700"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="dsb-sapphire-facet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.16" />
              <stop offset="48%" stopColor="#1A44A8" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#F4CA73" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="dsb-sapphire-vein" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0" />
              <stop offset="32%" stopColor="#93C5FD" stopOpacity="0.24" />
              <stop offset="64%" stopColor="#F4CA73" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Subtle crystalline sapphire geometry */}
          <polygon points="0,0 520,0 240,420 0,280" fill="url(#dsb-sapphire-facet)" opacity="0.45" />
          <polygon points="1440,900 940,900 1210,480 1440,620" fill="url(#dsb-sapphire-facet)" opacity="0.4" />
          {/* Luminous sapphire-gold crystalline lines */}
          <path
            d="M-40 720 C 220 590, 440 500, 720 420 C 980 345, 1210 210, 1490 60"
            stroke="url(#dsb-sapphire-vein)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M120 930 C 400 770, 680 650, 960 510 C 1170 405, 1320 330, 1500 230"
            stroke="url(#dsb-sapphire-vein)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M-20 260 L 420 0 M 1020 900 L 1460 560"
            stroke="rgba(147, 197, 253, 0.14)"
            strokeWidth="1"
          />
        </svg>
      )}

      {/* Subtle architectural dot-grid texture */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `radial-gradient(${palette.dotColor} 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
      />

      {/* Drifting aurora light orbs */}
      <div
        className="dsb-float-aura absolute -top-20 -left-20 sm:-top-28 sm:-left-24 h-[280px] w-[280px] sm:h-[520px] sm:w-[520px] rounded-full blur-3xl transition-colors duration-700"
        style={{
          background: `radial-gradient(circle, ${palette.orbPrimary} 0%, transparent 70%)`,
        }}
      />
      <div
        className="dsb-float-aura-delayed absolute -bottom-24 -right-20 sm:-bottom-32 sm:-right-24 h-[300px] w-[300px] sm:h-[560px] sm:w-[560px] rounded-full blur-3xl transition-colors duration-700"
        style={{
          background: `radial-gradient(circle, ${palette.orbSecondary} 0%, transparent 70%)`,
        }}
      />
      <div
        className="hidden sm:block dsb-float-aura absolute top-1/3 right-[12%] h-[360px] w-[360px] rounded-full blur-3xl transition-colors duration-700"
        style={{
          background: `radial-gradient(circle, ${palette.orbTertiary} 0%, transparent 72%)`,
        }}
      />

      {/* Prominent centered Ciprian Logo Watermark fixed in viewport (NO pointer parallax) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative flex items-center justify-center w-[min(68vw,320px)] h-[min(68vw,320px)] sm:w-[min(78vw,620px)] sm:h-[min(78vw,620px)]"
        >
          {/* Soft radial luminous halo behind the logo */}
          <div
            className="absolute inset-[10%] rounded-full blur-3xl transition-all duration-700"
            style={{
              background: haloBackground,
            }}
          />

          {/* Outer slow-rotating orbital ring (60s) */}
          <svg
            viewBox="0 0 600 600"
            fill="none"
            className="dsb-orbit-slow absolute inset-0 h-full w-full"
          >
            <circle
              cx="300"
              cy="300"
              r="286"
              stroke={palette.ringStroke}
              strokeWidth="1.25"
              strokeDasharray="6 10"
            />
            <circle
              cx="300"
              cy="300"
              r="268"
              stroke={palette.ringStroke}
              strokeOpacity="0.6"
              strokeWidth="0.8"
            />
            <circle cx="300" cy="14" r="3.5" fill={palette.ringStroke} />
            <circle cx="300" cy="586" r="3.5" fill={palette.ringStroke} />
          </svg>

          {/* Inner counter-rotating orbital ring (90s) */}
          <svg
            viewBox="0 0 600 600"
            fill="none"
            className="dsb-orbit-reverse absolute inset-[11%] h-[78%] w-[78%]"
          >
            <circle
              cx="300"
              cy="300"
              r="275"
              stroke={palette.ringStroke}
              strokeOpacity="0.85"
              strokeWidth="1.1"
              strokeDasharray="18 14 4 14"
            />
            <circle cx="25" cy="300" r="3" fill={palette.ringStroke} />
            <circle cx="575" cy="300" r="3" fill={palette.ringStroke} />
          </svg>

          {/* Ciprian Brand Logo Watermark */}
          <img
            src="/images/logo%20ciprian.png"
            alt=""
            decoding="async"
            draggable={false}
            className="relative z-10 w-[56%] max-w-[340px] h-auto object-contain transition-all duration-700"
            style={{
              opacity: watermarkOpacity,
              filter: watermarkFilter,
            }}
          />
        </div>
      </div>

      {/* Falling autumn leaves (maple, oak, ginkgo — capped & subtly scaled on mobile for 60 FPS) */}
      {!prefersReducedMotion &&
        AUTUMN_LEAVES.map((leaf, idx) => (
          <motion.div
            key={leaf.id}
            className={`absolute -top-20 will-change-transform ${idx >= 4 ? 'hidden sm:block' : ''}`}
            style={{
              left: leaf.left,
              opacity: isDarkSurface ? Math.min(0.86, leaf.opacity + 0.12) : leaf.opacity,
            }}
            initial={{ y: -70, x: 0, rotate: leaf.rotateStart, scale: 0.92 }}
            animate={{
              y: ['-8vh', '114vh'],
              x: [0, leaf.driftX, -leaf.driftX * 0.6, leaf.driftX * 0.85, -leaf.driftX * 0.3],
              rotate: [leaf.rotateStart, leaf.rotateEnd * 0.5, leaf.rotateStart * 0.4, leaf.rotateEnd],
              scale: [0.92, 1.06, 0.95, 1.04],
            }}
            transition={{
              duration: leaf.duration,
              delay: leaf.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div className="scale-[0.76] sm:scale-100 opacity-75 sm:opacity-100">
              <AutumnLeafSvg
                shape={leaf.shape}
                color={leaf.color}
                accent={leaf.accent}
                size={leaf.size}
                id={leaf.id}
              />
            </div>
          </motion.div>
        ))}

      {/* Floating warm golden autumn particles / motes */}
      {!prefersReducedMotion &&
        AUTUMN_MOTES.map((mote, idx) => (
          <motion.div
            key={mote.id}
            className={`absolute rounded-full will-change-transform ${idx >= 4 ? 'hidden sm:block' : ''}`}
            style={{
              left: mote.left,
              top: mote.top,
              width: mote.size,
              height: mote.size,
              background: 'radial-gradient(circle, #FEF08A 0%, #E5AE4E 55%, rgba(200,138,43,0) 100%)',
              boxShadow: isDarkSurface
                ? '0 0 16px rgba(244, 202, 115, 0.92)'
                : '0 0 12px rgba(229, 174, 78, 0.75)',
            }}
            animate={{
              opacity: isDarkSurface ? [0.35, 1, 0.35] : [0.22, 0.92, 0.22],
              scale: [0.85, 1.45, 0.85],
              y: [0, -18, 0],
            }}
            transition={{
              duration: mote.duration,
              delay: mote.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

      {/* Subtle surface-aware edge vignette for crisp depth */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: vignetteBackground,
        }}
      />
    </div>
  );
};
