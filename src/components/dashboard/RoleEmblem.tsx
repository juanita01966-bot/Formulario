import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { UserRole } from '../../types/app';
import { getRoleTheme } from './roleTheme';

export interface RoleSymbolSvgProps {
  role: UserRole;
  className?: string;
  animated?: boolean;
}

export const RoleSymbolSvg: React.FC<RoleSymbolSvgProps> = ({
  role,
  className = 'w-6 h-6',
  animated = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const prefersReducedMotion = useReducedMotion();
  const allowMotion = animated && !prefersReducedMotion;

  if (role === 'admin') {
    const shieldGrad = `dsb-admin-shield-${uid}`;
    const crownGrad = `dsb-admin-crown-${uid}`;
    const sheenGrad = `dsb-admin-sheen-${uid}`;

    return (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={shieldGrad} x1="6" y1="4" x2="34" y2="37" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="48%" stopColor="#8B0018" />
            <stop offset="100%" stopColor="#4A040E" />
          </linearGradient>
          <linearGradient id={crownGrad} x1="12" y1="12" x2="28" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="50%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id={sheenGrad} x1="8" y1="4" x2="26" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Imperial Crimson Shield */}
        <path
          d="M20 3L33.5 8.2V19.2C33.5 27.6 27.8 34.4 20 37.2C12.2 34.4 6.5 27.6 6.5 19.2V8.2L20 3Z"
          fill={`url(#${shieldGrad})`}
          stroke="#FCA5A5"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />
        {/* Inner faceted bevel */}
        <path
          d="M20 5.6L31 9.8V19C31 26 26.3 31.8 20 34.3C13.7 31.8 9 26 9 19V9.8L20 5.6Z"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.22"
          strokeWidth="0.9"
        />
        {/* Diagonal metallic sheen */}
        <path
          d="M20 4.2L32.2 8.9V16.2L9.4 24.4C8.4 22.8 7.8 21 7.8 19.1V8.9L20 4.2Z"
          fill={`url(#${sheenGrad})`}
        />
        {/* Sovereign Crown Crest */}
        <path
          d="M12.2 24.5L11.2 15.8L16 19.4L20 13.2L24 19.4L28.8 15.8L27.8 24.5H12.2Z"
          fill={`url(#${crownGrad})`}
          stroke="#7C2D12"
          strokeOpacity="0.35"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <rect x="12.2" y="25.8" width="15.6" height="2.2" rx="1.1" fill={`url(#${crownGrad})`} />
        <circle cx="20" cy="12" r="1.4" fill="#FEF3C7" />
        <circle cx="11.2" cy="14.7" r="1.1" fill="#FDE68A" />
        <circle cx="28.8" cy="14.7" r="1.1" fill="#FDE68A" />
        {/* Center ruby gem */}
        <polygon points="20,19.4 21.6,21.5 20,23.6 18.4,21.5" fill="#8B0018" />
      </svg>
    );
  }

  if (role === 'telemarketing') {
    const coreGrad = `dsb-tmk-core-${uid}`;
    const sweepGrad = `dsb-tmk-sweep-${uid}`;

    return (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={coreGrad} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="68%" stopColor="#0B4F6C" />
            <stop offset="100%" stopColor="#062D3F" />
          </radialGradient>
          <linearGradient id={sweepGrad} x1="20" y1="6" x2="34" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer sonar medallion */}
        <circle
          cx="20"
          cy="20"
          r="17"
          fill={`url(#${coreGrad})`}
          stroke="#67E8F9"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />
        {/* Concentric tactical sonar rings */}
        <circle
          cx="20"
          cy="20"
          r="13.2"
          stroke="#22D3EE"
          strokeOpacity="0.38"
          strokeWidth="0.9"
          strokeDasharray="3 2.5"
          className={allowMotion ? 'dsb-orbit-slow' : undefined}
          style={{ transformOrigin: '20px 20px' }}
        />
        <circle
          cx="20"
          cy="20"
          r="9.2"
          stroke="#A5F3FC"
          strokeOpacity="0.45"
          strokeWidth="0.9"
          className={allowMotion ? 'dsb-pulse-ring' : undefined}
          style={{ transformOrigin: '20px 20px' }}
        />
        {/* Radar sweep sector */}
        <path
          d="M20 20L20 6.5A13.5 13.5 0 0 1 33.5 20Z"
          fill={`url(#${sweepGrad})`}
          className={allowMotion ? 'dsb-orbit-slow' : undefined}
          style={{ transformOrigin: '20px 20px' }}
        />
        {/* Cardinal ticks */}
        <path
          d="M20 4.5V7.5M20 32.5V35.5M4.5 20H7.5M32.5 20H35.5"
          stroke="#CFFAFE"
          strokeOpacity="0.65"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        {/* Voice-wave acoustic bars */}
        <rect x="13" y="17.5" width="2.2" height="5" rx="1.1" fill="#A5F3FC" />
        <rect x="16.4" y="14" width="2.2" height="12" rx="1.1" fill="#ECFEFF" />
        <rect x="19.8" y="11.5" width="2.2" height="17" rx="1.1" fill="#FFFFFF" />
        <rect x="23.2" y="14.8" width="2.2" height="10.4" rx="1.1" fill="#ECFEFF" />
        <rect x="26.6" y="17.8" width="2.2" height="4.4" rx="1.1" fill="#A5F3FC" />
      </svg>
    );
  }

  // vendedor: Military Tactical Chevron + Vanguard Star Emblem in olive & brushed brass
  const oliveGrad = `dsb-vnd-olive-${uid}`;
  const brassGrad = `dsb-vnd-brass-${uid}`;

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={oliveGrad} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#556B2F" />
          <stop offset="50%" stopColor="#3F5432" />
          <stop offset="100%" stopColor="#1E2919" />
        </linearGradient>
        <linearGradient id={brassGrad} x1="10" y1="9" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F3E2B3" />
          <stop offset="48%" stopColor="#C8A85B" />
          <stop offset="100%" stopColor="#8E7232" />
        </linearGradient>
      </defs>

      {/* Tactical hexagonal olive patch */}
      <path
        d="M20 3L34 10.6V26.4L20 37L6 26.4V10.6L20 3Z"
        fill={`url(#${oliveGrad})`}
        stroke={`url(#${brassGrad})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner tactical trim */}
      <path
        d="M20 5.8L31.4 12V25L20 33.8L8.6 25V12L20 5.8Z"
        fill="none"
        stroke="#E6EEDB"
        strokeOpacity="0.22"
        strokeWidth="0.85"
      />
      {/* Vanguard 5-point brass star */}
      <path
        d="M20 9.4L21.55 13.15L25.6 13.48L22.5 16.12L23.46 20.08L20 17.95L16.54 20.08L17.5 16.12L14.4 13.48L18.45 13.15L20 9.4Z"
        fill={`url(#${brassGrad})`}
      />
      {/* Upper tactical chevron */}
      <path
        d="M12.2 21.8L20 26.8L27.8 21.8"
        stroke={`url(#${brassGrad})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lower tactical chevron */}
      <path
        d="M14 26.4L20 30.3L26 26.4"
        stroke="#E6EEDB"
        strokeOpacity="0.82"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export interface RoleEmblemBadgeProps {
  role: UserRole;
  tag?: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showCodename?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<
  NonNullable<RoleEmblemBadgeProps['size']>,
  {
    wrapper: string;
    symbol: string;
    avatar: string;
    miniSymbol: string;
    label: string;
    sub: string;
    tag: string;
  }
> = {
  sm: {
    wrapper: 'px-2 py-0.5 sm:px-2.5 sm:py-1 gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl',
    symbol: 'w-4 h-4 sm:w-5 sm:h-5',
    avatar: 'w-5 h-5 sm:w-6 sm:h-6',
    miniSymbol: 'w-3 h-3 sm:w-3.5 sm:h-3.5',
    label: 'text-[10px] sm:text-[11px]',
    sub: 'text-[9.5px] sm:text-[10px]',
    tag: 'text-[8.5px] sm:text-[9px] px-1 sm:px-1.5 py-0.5',
  },
  md: {
    wrapper: 'px-3 py-1.5 gap-2.5 rounded-2xl',
    symbol: 'w-7 h-7',
    avatar: 'w-8 h-8',
    miniSymbol: 'w-4 h-4',
    label: 'text-xs',
    sub: 'text-[10.5px]',
    tag: 'text-[10px] px-2 py-0.5',
  },
  lg: {
    wrapper: 'px-4 py-2.5 gap-3 rounded-2xl',
    symbol: 'w-10 h-10',
    avatar: 'w-11 h-11',
    miniSymbol: 'w-5 h-5',
    label: 'text-sm',
    sub: 'text-xs',
    tag: 'text-[11px] px-2.5 py-0.5',
  },
};

export const RoleEmblemBadge: React.FC<RoleEmblemBadgeProps> = ({
  role,
  tag,
  avatarUrl,
  displayName,
  size = 'md',
  showCodename = false,
  className = '',
}) => {
  const theme = getRoleTheme(role);
  const s = SIZE_CLASSES[size];
  const prefersReducedMotion = useReducedMotion();

  const cleanTag = tag?.trim() || null;
  const cleanName = displayName?.trim() || null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`inline-flex items-center backdrop-blur-xl bg-white/70 border shadow-sm transition-shadow ${s.wrapper} ${className}`}
      style={{
        borderColor: theme.borderTint,
        boxShadow: `0 6px 20px -10px ${theme.glowRgba}, inset 0 1px 0 rgba(255,255,255,0.85)`,
      }}
    >
      {/* Avatar with mini emblem overlay OR standalone custom role crest */}
      {avatarUrl ? (
        <div className="relative shrink-0">
          <img
            src={avatarUrl}
            alt={cleanName || theme.label}
            className={`${s.avatar} rounded-full object-cover ring-2 ring-offset-1 ring-offset-white/80`}
            style={{ boxShadow: `0 0 0 2px ${theme.mid}` }}
          />
          <span
            className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-sm"
            aria-hidden="true"
          >
            <RoleSymbolSvg role={role} className={s.miniSymbol} animated={false} />
          </span>
        </div>
      ) : (
        <div className="relative shrink-0 flex items-center justify-center">
          <RoleSymbolSvg role={role} className={s.symbol} />
        </div>
      )}

      {/* Text block */}
      <div className="min-w-0 flex flex-col leading-tight">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            data-dsb-role-label={role}
            className={`font-bold tracking-tight truncate ${s.label}`}
            style={{ color: theme.primary }}
          >
            {cleanName || theme.label}
          </span>
          {cleanTag && (
            <span
              data-dsb-role-tag={role}
              className={`font-mono font-semibold uppercase tracking-wider rounded-md border ${s.tag}`}
              style={{
                backgroundColor: `${theme.primary}14`,
                borderColor: `${theme.primary}30`,
                color: theme.primary,
              }}
            >
              {cleanTag}
            </span>
          )}
        </div>
        {(cleanName || showCodename) && (
          <span className={`font-medium text-slate-600 truncate ${s.sub}`}>
            {cleanName && showCodename
              ? `${theme.label} · ${theme.codename}`
              : cleanName
                ? theme.label
                : theme.codename}
          </span>
        )}
      </div>
    </motion.div>
  );
};
