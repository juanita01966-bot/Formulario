import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  Lead,
  SecurityAlert,
  SecurityAlertSeverity,
  UserRole,
} from '../../types/app';
import { getRoleTheme } from './roleTheme';
import { RoleEmblemBadge } from './RoleEmblem';
import { DashboardNavDock } from './DashboardNavDock';
import {
  DEFAULT_SURFACE_THEME,
  SURFACE_THEMES,
  type DashboardSurfaceTheme,
} from './surfaceTheme';

export type DashboardTab =
  | 'ai_control'
  | 'overview'
  | 'referrals'
  | 'embajadores'
  | 'accounts'
  | 'gifts'
  | 'settings'
  | 'security'
  | 'activity';

export interface DashboardSessionUser {
  userId?: string;
  username?: string;
  displayName?: string;
  tag?: string;
  avatarUrl?: string | null;
  role: UserRole;
}

export interface DashboardHeaderProps {
  leads: Lead[];
  activeTab?: DashboardTab;
  userRole?: UserRole;
  currentUser?: DashboardSessionUser | null;
  surfaceTheme?: DashboardSurfaceTheme;
  openSecurityAlertsCount?: number;
  criticalSecurityAlertsCount?: number;
  securityAlerts?: SecurityAlert[];
  onSurfaceThemeChange?: (theme: DashboardSurfaceTheme) => void;
  onTabChange?: (tab: DashboardTab) => void;
  onJumpToPending: () => void;
  onJumpToSecurity?: () => void;
  onLockNow?: () => void;
  onLogout?: () => void;
}

const SEVERITY_PRIORITY: Record<SecurityAlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

interface BellSeverityVisual {
  pillLabel: string;
  riskLabel: string;
  badgeBg: string;
  badgeShadow: string;
  pulseMode: 'ping' | 'pulse' | 'none';
  pulseColor: string;
  light: {
    buttonBg: string;
    buttonHoverBg: string;
    borderColor: string;
    iconColor: string;
    shadow: string;
    pillClass: string;
    headerIconColor: string;
  };
  dark: {
    buttonBg: string;
    buttonHoverBg: string;
    borderColor: string;
    iconColor: string;
    shadow: string;
    pillClass: string;
    headerIconColor: string;
  };
}

const BELL_SEVERITY_STYLES: Record<SecurityAlertSeverity, BellSeverityVisual> = {
  critical: {
    pillLabel: 'CRÍTICO',
    riskLabel: 'Alerta de fraude crítica',
    badgeBg: '#DC2626',
    badgeShadow: '0 2px 10px rgba(220, 38, 38, 0.58)',
    pulseMode: 'ping',
    pulseColor: 'rgba(239, 68, 68, 0.55)',
    light: {
      buttonBg: 'rgba(239, 68, 68, 0.14)',
      buttonHoverBg: 'rgba(239, 68, 68, 0.22)',
      borderColor: 'rgba(220, 38, 38, 0.72)',
      iconColor: '#DC2626',
      shadow:
        '0 0 0 1px rgba(239, 68, 68, 0.18), 0 8px 20px -6px rgba(220, 38, 38, 0.45)',
      pillClass: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#EF4444]/45',
      headerIconColor: '#DC2626',
    },
    dark: {
      buttonBg: 'rgba(239, 68, 68, 0.22)',
      buttonHoverBg: 'rgba(239, 68, 68, 0.32)',
      borderColor: 'rgba(239, 68, 68, 0.82)',
      iconColor: '#F87171',
      shadow:
        '0 0 0 1px rgba(239, 68, 68, 0.28), 0 0 20px -3px rgba(239, 68, 68, 0.58)',
      pillClass: 'bg-[#EF4444]/22 text-[#FCA5A5] border border-[#EF4444]/55',
      headerIconColor: '#F87171',
    },
  },
  high: {
    pillLabel: 'ALTO',
    riskLabel: 'Alerta de fraude alta',
    badgeBg: '#EA580C',
    badgeShadow: '0 2px 10px rgba(234, 88, 12, 0.54)',
    pulseMode: 'pulse',
    pulseColor: 'rgba(249, 115, 22, 0.62)',
    light: {
      buttonBg: 'rgba(249, 115, 22, 0.14)',
      buttonHoverBg: 'rgba(249, 115, 22, 0.22)',
      borderColor: 'rgba(234, 88, 12, 0.70)',
      iconColor: '#EA580C',
      shadow:
        '0 0 0 1px rgba(249, 115, 22, 0.16), 0 8px 18px -6px rgba(234, 88, 12, 0.40)',
      pillClass: 'bg-[#FFEDD5] text-[#C2410C] border border-[#F97316]/45',
      headerIconColor: '#EA580C',
    },
    dark: {
      buttonBg: 'rgba(249, 115, 22, 0.22)',
      buttonHoverBg: 'rgba(249, 115, 22, 0.30)',
      borderColor: 'rgba(249, 115, 22, 0.80)',
      iconColor: '#FB923C',
      shadow:
        '0 0 0 1px rgba(249, 115, 22, 0.26), 0 0 18px -3px rgba(249, 115, 22, 0.50)',
      pillClass: 'bg-[#F97316]/22 text-[#FDBA74] border border-[#F97316]/55',
      headerIconColor: '#FB923C',
    },
  },
  medium: {
    pillLabel: 'MEDIO',
    riskLabel: 'Alerta de fraude media',
    badgeBg: '#D97706',
    badgeShadow: '0 2px 10px rgba(217, 119, 6, 0.48)',
    pulseMode: 'none',
    pulseColor: 'rgba(245, 158, 11, 0.45)',
    light: {
      buttonBg: 'rgba(245, 158, 11, 0.15)',
      buttonHoverBg: 'rgba(245, 158, 11, 0.24)',
      borderColor: 'rgba(217, 119, 6, 0.68)',
      iconColor: '#D97706',
      shadow:
        '0 0 0 1px rgba(245, 158, 11, 0.16), 0 6px 16px -5px rgba(217, 119, 6, 0.36)',
      pillClass: 'bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]/50',
      headerIconColor: '#D97706',
    },
    dark: {
      buttonBg: 'rgba(245, 158, 11, 0.20)',
      buttonHoverBg: 'rgba(245, 158, 11, 0.28)',
      borderColor: 'rgba(245, 158, 11, 0.76)',
      iconColor: '#FBBF24',
      shadow:
        '0 0 0 1px rgba(245, 158, 11, 0.24), 0 0 16px -3px rgba(245, 158, 11, 0.42)',
      pillClass: 'bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/50',
      headerIconColor: '#FBBF24',
    },
  },
  info: {
    pillLabel: 'INFO',
    riskLabel: 'Alerta de fraude info',
    badgeBg: '#0284C7',
    badgeShadow: '0 2px 10px rgba(2, 132, 199, 0.48)',
    pulseMode: 'none',
    pulseColor: 'rgba(56, 189, 248, 0.45)',
    light: {
      buttonBg: 'rgba(56, 189, 248, 0.15)',
      buttonHoverBg: 'rgba(56, 189, 248, 0.24)',
      borderColor: 'rgba(2, 132, 199, 0.65)',
      iconColor: '#0284C7',
      shadow:
        '0 0 0 1px rgba(56, 189, 248, 0.16), 0 6px 16px -5px rgba(2, 132, 199, 0.32)',
      pillClass: 'bg-[#E0F2FE] text-[#0369A1] border border-[#38BDF8]/50',
      headerIconColor: '#0284C7',
    },
    dark: {
      buttonBg: 'rgba(56, 189, 248, 0.20)',
      buttonHoverBg: 'rgba(56, 189, 248, 0.28)',
      borderColor: 'rgba(56, 189, 248, 0.75)',
      iconColor: '#38BDF8',
      shadow:
        '0 0 0 1px rgba(56, 189, 248, 0.24), 0 0 16px -3px rgba(56, 189, 248, 0.40)',
      pillClass: 'bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/50',
      headerIconColor: '#38BDF8',
    },
  },
};

function formatAlertActorTag(alert: SecurityAlert): string {
  const parts: string[] = [];
  if (alert.actorName?.trim()) {
    parts.push(alert.actorName.trim());
  } else if (alert.actorTag?.trim()) {
    parts.push(alert.actorTag.trim());
  }
  if (alert.referralCode?.trim()) {
    parts.push(`QR ${alert.referralCode.trim().toUpperCase()}`);
  } else if (parts.length === 0 && alert.leadName?.trim()) {
    parts.push(alert.leadName.trim());
  } else if (parts.length === 0 && alert.claimCode?.trim()) {
    parts.push(alert.claimCode.trim());
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sistema';
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  leads,
  activeTab,
  userRole = 'admin',
  currentUser,
  surfaceTheme = DEFAULT_SURFACE_THEME,
  securityAlerts,
  onSurfaceThemeChange,
  onTabChange,
  onJumpToPending,
  onJumpToSecurity,
  onLockNow,
  onLogout,
}) => {
  const [bellOpen, setBellOpen] = useState(false);
  const [bellHovered, setBellHovered] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const theme = getRoleTheme(userRole);
  const isDarkSurface = surfaceTheme !== 'porcelain';
  const greetingName = (currentUser?.displayName || currentUser?.username || '').trim();
  const pendingLeads = useMemo(
    () =>
      leads.filter(
        (l) => (l.callOutcome ?? (l.called ? 'scheduled' : 'pending')) === 'pending'
      ),
    [leads]
  );
  const isAdminLike = userRole === 'admin' || userRole === 'ai_manager';

  const openSecurityAlerts = useMemo(
    () => (securityAlerts ?? []).filter((a) => a.status === 'open'),
    [securityAlerts]
  );

  const sortedOpenSecurityAlerts = useMemo(() => {
    return [...openSecurityAlerts].sort((a, b) => {
      const severityDiff = SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [openSecurityAlerts]);

  const highestSeverity: SecurityAlertSeverity | null =
    sortedOpenSecurityAlerts.length > 0 ? sortedOpenSecurityAlerts[0].severity : null;

  const activeBellVisual = highestSeverity ? BELL_SEVERITY_STYLES[highestSeverity] : null;
  const activeBellPalette = activeBellVisual
    ? isDarkSurface
      ? activeBellVisual.dark
      : activeBellVisual.light
    : null;

  const bellBadgeCount =
    openSecurityAlerts.length > 0 ? openSecurityAlerts.length : pendingLeads.length;

  const bellAriaLabel = activeBellVisual
    ? `${activeBellVisual.riskLabel}: ${openSecurityAlerts.length} ${
        openSecurityAlerts.length === 1 ? 'alerta abierta' : 'alertas abiertas'
      } · ${pendingLeads.length} por llamar`
    : `Notificaciones: sin alertas de fraude · ${pendingLeads.length} prospectos sin llamar`;

  const handleJumpToSecurity = () => {
    setBellOpen(false);
    if (onJumpToSecurity) {
      onJumpToSecurity();
    } else {
      onTabChange?.('security');
    }
  };

  useEffect(() => {
    if (!bellOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (bellContainerRef.current && !bellContainerRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBellOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [bellOpen]);

  return (
    <header
      className="sticky top-0 z-30 dsb-glass-strong border-b transition-colors"
      style={{
        borderBottomColor: isDarkSurface
          ? surfaceTheme === 'royal-blue'
            ? 'rgba(186, 212, 245, 0.16)'
            : 'rgba(226, 194, 117, 0.16)'
          : theme.borderTint,
        boxShadow: isDarkSurface
          ? surfaceTheme === 'royal-blue'
            ? '0 14px 36px -18px rgba(3, 10, 32, 0.82), inset 0 1px 0 rgba(186, 212, 245, 0.18)'
            : '0 14px 36px -18px rgba(0, 0, 0, 0.76), inset 0 1px 0 rgba(226, 194, 117, 0.16)'
          : `0 10px 30px -16px ${theme.glowRgba}, inset 0 1px 0 rgba(255,255,255,0.88)`,
      }}
    >
      {/* Role signature top accent hairline */}
      <div className="h-[2.5px] w-full opacity-95" style={{ background: theme.headerStrip }} />

      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-2.5 sm:py-3">
        {/* Identity & Controls Bar (compact 2-tier grid on < md; spacious single row on md+) */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 md:flex md:items-center md:justify-between md:gap-4">
          {/* LEFT: Ciprian Medallion + Dashboard Operativo + RoleEmblemBadge + Hola {greetingName} */}
          <div className="col-start-1 row-start-1 flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <motion.div
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full p-[2px] shadow-md"
              style={{
                background: theme.headerStrip,
                boxShadow: isDarkSurface
                  ? '0 6px 16px -6px rgba(0,0,0,0.65)'
                  : `0 6px 16px -6px ${theme.glowRgba}`,
              }}
            >
              <img
                src="/images/logo%20ciprian.png"
                alt="Dashboard Operativo"
                className="h-full w-full rounded-full object-cover bg-white"
              />
            </motion.div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 md:gap-2.5 flex-wrap md:flex-nowrap">
                <h1
                  data-dsb-title="true"
                  className="font-sans text-[14px] min-[390px]:text-[15px] sm:text-lg lg:text-xl font-extrabold tracking-[-0.02em] leading-none whitespace-nowrap"
                  style={{
                    color: '#09090B',
                    WebkitTextStroke: '2px #FFFFFF',
                    paintOrder: 'stroke fill',
                    textShadow: '0 2px 8px rgba(0,0,0,0.28)',
                  }}
                >
                  Dashboard Operativo
                </h1>
                <RoleEmblemBadge
                  role={userRole}
                  size="sm"
                  className="hidden md:inline-flex shrink-0"
                />
              </div>
              {greetingName && (
                <p
                  data-dsb-greeting="true"
                  className="font-sans text-[11px] sm:text-[13px] font-bold tracking-[0.02em] text-white leading-tight break-words sm:whitespace-nowrap"
                  style={{
                    WebkitTextStroke: '1.5px #09090B',
                    paintOrder: 'stroke fill',
                    textShadow: '0 1px 4px rgba(0, 0, 0, 0.48)',
                  }}
                >
                  Hola {greetingName}
                </p>
              )}
            </div>
          </div>

          {/* Mobile & Small-Tablet Role Badge paired cleanly opposite the Theme Switcher (never truncated) */}
          <div className="col-start-1 row-start-2 flex items-center md:hidden min-w-0">
            <RoleEmblemBadge
              role={userRole}
              size="sm"
              className="inline-flex shrink-0"
            />
          </div>

          {/* RIGHT: 3-Theme Switcher + Cerrar sesión + Smart Fraud Bell (Admin only) */}
          <div className="contents md:flex md:items-center md:gap-2.5 md:shrink-0">
            {onSurfaceThemeChange && (
              <div
                role="group"
                aria-label="Tema de superficie del dashboard"
                data-preserve-surface="true"
                className={`col-start-2 row-start-2 justify-self-end inline-flex h-7 md:h-auto items-center gap-0.5 md:gap-1 rounded-full p-0.5 md:p-1 border backdrop-blur-md transition-colors ${
                  isDarkSurface
                    ? surfaceTheme === 'royal-blue'
                      ? 'bg-[#07153C]/75 border-[#BAD4F5]/18 shadow-[inset_0_1px_2px_rgba(0,0,0,0.42)]'
                      : 'bg-white/[0.045] border-white/[0.12] shadow-[inset_0_1px_2px_rgba(0,0,0,0.42)]'
                    : 'bg-white/75 border-slate-300/65 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]'
                }`}
              >
                {SURFACE_THEMES.map((item) => {
                  const isSelected = surfaceTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-preserve-surface="true"
                      onClick={() => onSurfaceThemeChange(item.id)}
                      aria-pressed={isSelected}
                      aria-label={`Tema ${item.label}`}
                      title={`${item.label} — ${item.description}`}
                      className={`relative inline-flex h-6 w-6 md:h-auto md:w-auto md:min-h-[34px] items-center justify-center gap-1.5 rounded-full p-0 md:px-2.5 lg:px-3 md:py-1 text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                        isSelected
                          ? isDarkSurface
                            ? 'bg-white/[0.13] text-[#F5F2EB] ring-1 ring-[#E2C275]/45 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]'
                            : 'bg-slate-900 text-white shadow-sm'
                          : isDarkSurface
                            ? 'text-[#C9C3B8]/80 hover:text-[#F5F2EB] hover:bg-white/[0.06]'
                            : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
                      }`}
                    >
                      <span
                        data-preserve-surface="true"
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 rounded-full shrink-0 border transition-transform ${
                          isSelected
                            ? 'scale-105 border-[#E2C275]/80 shadow-[0_0_8px_rgba(226,194,117,0.36)]'
                            : 'border-white/35'
                        }`}
                        style={{ background: item.swatchStyle }}
                      />
                      <span className="hidden lg:inline whitespace-nowrap">
                        {item.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="col-start-2 row-start-1 justify-self-end flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                data-preserve-surface={isDarkSurface ? 'true' : undefined}
                onClick={onLogout || onLockNow}
                className={`inline-flex h-9 sm:h-auto sm:min-h-[42px] items-center justify-center gap-1 sm:gap-1.5 rounded-full border backdrop-blur-md px-2.5 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-xs whitespace-nowrap ${
                  isDarkSurface
                    ? 'border-[#E2A8B0]/24 bg-[#6E1224]/24 text-[#E2A8B0] hover:bg-[#8B182E]/36 hover:border-[#E2A8B0]/42 hover:text-[#F2CCD2]'
                    : 'border-[#8B0018]/25 bg-white/75 text-[#8B0018] hover:bg-[#FEE2E2]/60 hover:border-[#8B0018]/40'
                }`}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="sm:hidden">Salir</span>
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>

              {isAdminLike && (
                <div ref={bellContainerRef} className="relative">
                  <button
                    type="button"
                    data-preserve-surface={highestSeverity !== null ? 'true' : undefined}
                    onClick={() => setBellOpen((prev) => !prev)}
                    onMouseEnter={() => setBellHovered(true)}
                    onMouseLeave={() => setBellHovered(false)}
                    className={`relative flex h-9 w-9 sm:h-[42px] sm:w-[42px] items-center justify-center rounded-full border backdrop-blur-md transition-all cursor-pointer ${
                      highestSeverity !== null
                        ? ''
                        : 'bg-white/70 text-slate-900 hover:bg-white/95 shadow-xs'
                    }`}
                    style={
                      activeBellPalette
                        ? {
                            backgroundColor: bellHovered
                              ? activeBellPalette.buttonHoverBg
                              : activeBellPalette.buttonBg,
                            borderColor: activeBellPalette.borderColor,
                            color: activeBellPalette.iconColor,
                            boxShadow: activeBellPalette.shadow,
                          }
                        : {
                            borderColor: isDarkSurface
                              ? surfaceTheme === 'royal-blue'
                                ? 'rgba(186, 212, 245, 0.22)'
                                : 'rgba(226, 194, 117, 0.22)'
                              : theme.borderTint,
                          }
                    }
                    title={bellAriaLabel}
                    aria-label={bellAriaLabel}
                    aria-expanded={bellOpen}
                  >
                    {/* Subtle alert ring for critical (ping) & high (pulse) when motion is allowed */}
                    {activeBellVisual && !prefersReducedMotion && activeBellVisual.pulseMode === 'ping' && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-0.5 rounded-full animate-ping opacity-45"
                        style={{
                          border: `2px solid ${activeBellVisual.pulseColor}`,
                        }}
                      />
                    )}
                    {activeBellVisual && !prefersReducedMotion && activeBellVisual.pulseMode === 'pulse' && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 rounded-full dsb-pulse-ring"
                        style={{
                          border: `1.5px solid ${activeBellVisual.pulseColor}`,
                        }}
                      />
                    )}

                    <Bell className="relative z-10 h-4 w-4" />

                    {bellBadgeCount > 0 && (
                      <span
                        data-preserve-surface="true"
                        className="absolute -top-1 -right-1 sm:-top-0.5 sm:-right-0.5 z-20 flex h-4 min-w-4 sm:h-4.5 sm:min-w-4.5 items-center justify-center rounded-full px-1 text-[9.5px] sm:text-[10px] font-extrabold text-[#FFFFFF] ring-1 ring-white/35 tabular-nums"
                        style={{
                          backgroundColor: activeBellVisual
                            ? activeBellVisual.badgeBg
                            : theme.primary,
                          boxShadow: activeBellVisual
                            ? activeBellVisual.badgeShadow
                            : '0 2px 6px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        {bellBadgeCount > 99 ? '99+' : bellBadgeCount}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {bellOpen && (
                      <motion.div
                        initial={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }
                        }
                        transition={{ duration: 0.18 }}
                        className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-[54px] sm:top-auto sm:mt-2 sm:w-80 max-h-[75dvh] overflow-y-auto rounded-2xl dsb-glass-strong border p-3.5 shadow-2xl z-40"
                        style={{
                          borderColor: activeBellPalette
                            ? activeBellPalette.borderColor
                            : isDarkSurface
                              ? surfaceTheme === 'royal-blue'
                                ? 'rgba(186, 212, 245, 0.22)'
                                : 'rgba(226, 194, 117, 0.22)'
                              : theme.borderTint,
                        }}
                      >
                        {/* Section 1: Fraud & Security Alerts */}
                        <div>
                          {openSecurityAlerts.length > 0 ? (
                            <>
                              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/75">
                                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800 min-w-0">
                                  <ShieldAlert
                                    data-preserve-surface="true"
                                    className="h-3.5 w-3.5 shrink-0"
                                    style={{
                                      color: activeBellPalette?.headerIconColor ?? '#DC2626',
                                    }}
                                  />
                                  <span className="truncate">
                                    Alertas de Seguridad ({openSecurityAlerts.length})
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  data-preserve-surface={isDarkSurface ? 'true' : undefined}
                                  onClick={handleJumpToSecurity}
                                  className={`inline-flex items-center gap-1 min-h-[32px] px-2 rounded-lg text-xs font-semibold hover:underline cursor-pointer shrink-0 ${
                                    isDarkSurface
                                      ? 'text-[#E2C275] hover:text-[#F5DFA0]'
                                      : theme.textAccent
                                  }`}
                                >
                                  <span>Ver Seguridad</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>

                              <div className="mt-2 space-y-2">
                                {sortedOpenSecurityAlerts.slice(0, 4).map((alert) => {
                                  const meta = BELL_SEVERITY_STYLES[alert.severity];
                                  const palette = isDarkSurface ? meta.dark : meta.light;
                                  const actorLabel = formatAlertActorTag(alert);
                                  return (
                                    <button
                                      key={alert.id}
                                      type="button"
                                      onClick={handleJumpToSecurity}
                                      className="w-full min-h-[44px] rounded-xl bg-white/65 hover:bg-white/95 border border-white/80 p-2.5 text-left transition-colors cursor-pointer shadow-2xs"
                                    >
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span
                                          data-preserve-surface="true"
                                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wider leading-none ${palette.pillClass}`}
                                        >
                                          {meta.pillLabel}
                                        </span>
                                        <span className="text-[10.5px] font-medium text-slate-600 truncate">
                                          {actorLabel}
                                        </span>
                                      </div>
                                      <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                                        {alert.title}
                                      </p>
                                    </button>
                                  );
                                })}

                                {openSecurityAlerts.length > 4 && (
                                  <button
                                    type="button"
                                    onClick={handleJumpToSecurity}
                                    className="w-full py-1.5 text-center text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                                  >
                                    +{openSecurityAlerts.length - 4}{' '}
                                    {openSecurityAlerts.length - 4 === 1
                                      ? 'alerta más'
                                      : 'alertas más'}{' '}
                                    en Seguridad
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <div
                              data-preserve-surface="true"
                              className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 ${
                                isDarkSurface
                                  ? 'bg-[#10B981]/12 border-[#34D399]/28 text-[#A7F3D0]'
                                  : 'bg-[#ECFDF5] border-[#10B981]/30 text-[#047857]'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
                                <ShieldCheck className="h-4 w-4 shrink-0" />
                                <span className="truncate">Sin alertas de fraude</span>
                              </span>
                              <button
                                type="button"
                                data-preserve-surface="true"
                                onClick={handleJumpToSecurity}
                                className={`inline-flex items-center gap-0.5 text-[11px] font-bold hover:underline cursor-pointer shrink-0 ${
                                  isDarkSurface ? 'text-[#6EE7B7]' : 'text-[#065F46]'
                                }`}
                              >
                                <span>Ver Seguridad</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Section 2: Pending Leads to Call */}
                        <div className="mt-3 pt-3 border-t border-slate-200/75">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/75">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              Por llamar ({pendingLeads.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setBellOpen(false);
                                onJumpToPending();
                              }}
                              className={`min-h-[34px] px-2 text-xs font-semibold hover:underline cursor-pointer ${theme.textAccent}`}
                            >
                              Filtrar todos
                            </button>
                          </div>
                          {pendingLeads.length === 0 ? (
                            <p className="py-3.5 text-center text-xs text-slate-600">
                              Todos los prospectos ya han sido llamados.
                            </p>
                          ) : (
                            <div className="mt-2 max-h-52 overflow-y-auto space-y-2">
                              {pendingLeads.slice(0, 5).map((lead) => (
                                <button
                                  key={lead.id}
                                  type="button"
                                  onClick={() => {
                                    setBellOpen(false);
                                    onJumpToPending();
                                  }}
                                  className="w-full min-h-[44px] rounded-xl bg-white/65 hover:bg-white/95 border border-white/80 p-2.5 text-left transition-colors cursor-pointer shadow-2xs"
                                >
                                  <p className="text-xs font-bold text-slate-900 truncate">
                                    {lead.name}
                                  </p>
                                  <p className="text-[11px] text-slate-600 truncate">
                                    {lead.phone} · {lead.giftName || 'Sin regalo'}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {(isAdminLike || userRole === 'vendedor') && activeTab && onTabChange && (
          <DashboardNavDock
            embedded
            activeTab={activeTab}
            onTabChange={onTabChange}
            userRole={userRole}
            surfaceTheme={surfaceTheme}
            securityAlerts={securityAlerts}
          />
        )}
      </div>
    </header>
  );
};
