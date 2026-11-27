import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ClipboardList,
  Crown,
  Gift,
  LayoutDashboard,
  QrCode,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import type { SecurityAlert, SecurityAlertSeverity, UserRole } from '../../types/app';
import type { DashboardTab } from './DashboardHeader';
import { getRoleTheme } from './roleTheme';
import {
  DEFAULT_SURFACE_THEME,
  type DashboardSurfaceTheme,
} from './surfaceTheme';

interface DashboardNavDockProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  userRole?: UserRole;
  surfaceTheme?: DashboardSurfaceTheme;
  securityAlerts?: SecurityAlert[];
  embedded?: boolean;
}

const ADMIN_TABS: Array<{
  id: DashboardTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Inicio', mobileLabel: 'Inicio', icon: LayoutDashboard },
  { id: 'referrals', label: 'QR y Embajadores', mobileLabel: 'QR', icon: QrCode },
  { id: 'accounts', label: 'Cuentas', mobileLabel: 'Cuentas', icon: Users },
  { id: 'gifts', label: 'Regalos', mobileLabel: 'Regalos', icon: Gift },
  { id: 'settings', label: 'Ajustes', mobileLabel: 'Ajustes', icon: Settings },
  { id: 'security', label: 'Seguridad', mobileLabel: 'Seguridad', icon: ShieldAlert },
  { id: 'activity', label: 'Registro', mobileLabel: 'Registro', icon: ClipboardList },
];

const AI_MANAGER_TABS: Array<{
  id: DashboardTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'ai_control', label: 'Centro AI', mobileLabel: 'Centro AI', icon: Crown },
  ...ADMIN_TABS,
];

const VENDEDOR_TABS: Array<{
  id: DashboardTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Inicio', mobileLabel: 'Inicio', icon: LayoutDashboard },
  { id: 'embajadores', label: 'Embajadores', mobileLabel: 'Embajadores', icon: Sparkles },
];

const SEVERITY_RANK: Record<SecurityAlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  info: 1,
};

const SEVERITY_BADGE_CLASSES: Record<SecurityAlertSeverity, string> = {
  critical:
    'bg-[#DC2626] text-white ring-1 ring-[#FCA5A5]/65 shadow-[0_0_12px_rgba(239,68,68,0.52)]',
  high:
    'bg-[#EA580C] text-white ring-1 ring-[#FDBA74]/65 shadow-[0_0_12px_rgba(249,115,22,0.46)]',
  medium:
    'bg-[#F59E0B] text-[#17120A] ring-1 ring-[#FDE68A]/75 shadow-[0_0_10px_rgba(245,158,11,0.42)]',
  info:
    'bg-[#0284C7] text-white ring-1 ring-[#7DD3FC]/70 shadow-[0_0_10px_rgba(56,189,248,0.42)]',
};

const SEVERITY_ARIA_LABELS: Record<SecurityAlertSeverity, string> = {
  critical: 'severidad crítica',
  high: 'severidad alta',
  medium: 'severidad media',
  info: 'severidad informativa',
};

export const DashboardNavDock: React.FC<DashboardNavDockProps> = ({
  activeTab,
  onTabChange,
  userRole = 'admin',
  surfaceTheme = DEFAULT_SURFACE_THEME,
  securityAlerts = [],
  embedded = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  const { openAlertsCount, highestSeverity } = useMemo(() => {
    let count = 0;
    let highest: SecurityAlertSeverity | null = null;
    for (const alert of securityAlerts) {
      if (alert.status !== 'open') continue;
      count += 1;
      if (!highest || SEVERITY_RANK[alert.severity] > SEVERITY_RANK[highest]) {
        highest = alert.severity;
      }
    }
    return { openAlertsCount: count, highestSeverity: highest };
  }, [securityAlerts]);

  const isAiManager = userRole === 'ai_manager';
  const isAdminLike = userRole === 'admin' || isAiManager;

  if (!isAdminLike && userRole !== 'vendedor') {
    return null;
  }

  const isVendedor = userRole === 'vendedor';
  const tabs = isVendedor ? VENDEDOR_TABS : isAiManager ? AI_MANAGER_TABS : ADMIN_TABS;
  const theme = getRoleTheme(userRole);
  const isDarkSurface = surfaceTheme !== 'porcelain';

  const dockBorderColor =
    surfaceTheme === 'obsidian-marble'
      ? isAiManager
        ? 'rgba(212, 175, 55, 0.34)'
        : isVendedor
          ? 'rgba(200, 168, 91, 0.24)'
          : 'rgba(226, 194, 117, 0.18)'
      : surfaceTheme === 'royal-blue'
        ? isAiManager
          ? 'rgba(212, 175, 55, 0.30)'
          : 'rgba(186, 212, 245, 0.20)'
        : theme.borderTint;

  const dockShadow =
    surfaceTheme === 'obsidian-marble'
      ? '0 18px 42px -18px rgba(0, 0, 0, 0.78), 0 4px 16px -6px rgba(0, 0, 0, 0.50), inset 0 1px 0 rgba(226, 194, 117, 0.18)'
      : surfaceTheme === 'royal-blue'
        ? '0 18px 42px -18px rgba(3, 10, 32, 0.82), 0 6px 20px -8px rgba(18, 52, 136, 0.36), inset 0 1px 0 rgba(186, 212, 245, 0.22)'
        : `0 14px 36px -16px ${theme.glowRgba}, 0 4px 14px -6px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.92)`;

  const pillTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.9 };

  const inactiveTabClass = isDarkSurface
    ? surfaceTheme === 'royal-blue'
      ? 'text-[#C9DCF5] hover:text-[#F4F7FC] hover:bg-[#93C5FD]/[0.10]'
      : 'text-[#D5CFC4] hover:text-[#F5F2EB] hover:bg-white/[0.06]'
    : 'text-slate-700 hover:text-slate-950 hover:bg-white/75';

  const securityBadgeClass = highestSeverity
    ? SEVERITY_BADGE_CLASSES[highestSeverity]
    : SEVERITY_BADGE_CLASSES.info;

  const formattedAlertCount = openAlertsCount > 99 ? '99+' : String(openAlertsCount);

  const navContent = (
    <nav
      aria-label={
        isVendedor
          ? 'Navegación principal del vendedor'
          : isAiManager
            ? 'Navegación principal de AI Manager'
            : 'Navegación principal del panel de administración'
      }
      className={
        embedded
          ? `${isVendedor ? 'w-full sm:w-fit' : 'w-full'} rounded-xl p-1 transition-colors border`
          : `${isVendedor ? 'w-full sm:w-fit' : 'w-full'} dsb-glass rounded-2xl p-1.5 transition-colors`
      }
      style={
        embedded
          ? {
              borderColor: dockBorderColor,
              backgroundColor: isDarkSurface
                ? surfaceTheme === 'royal-blue'
                  ? 'rgba(5, 16, 48, 0.48)'
                  : 'rgba(255, 255, 255, 0.04)'
                : 'rgba(255, 255, 255, 0.56)',
            }
          : {
              borderColor: dockBorderColor,
              boxShadow: dockShadow,
            }
      }
    >
      <div
        className={
          isVendedor
            ? 'grid grid-cols-2 sm:inline-flex items-center gap-1.5'
            : 'flex items-center gap-1 overflow-x-auto overscroll-x-contain lg:overflow-visible md:justify-between [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isSecurityTab = !isVendedor && tab.id === 'security';
          const showSecurityBadge = isSecurityTab && openAlertsCount > 0;
          const badgeAriaLabel =
            showSecurityBadge && highestSeverity
              ? `${openAlertsCount} alertas abiertas (${SEVERITY_ARIA_LABELS[highestSeverity]})`
              : undefined;

          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center justify-center rounded-xl font-semibold tracking-tight transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E2C275]/75 ${
                isVendedor
                  ? 'min-h-[40px] sm:min-h-[38px] sm:min-w-[152px] px-3 sm:px-5 py-1.5 text-xs sm:text-[13px]'
                  : isAiManager
                    ? 'min-h-[40px] md:min-h-[38px] min-w-[66px] shrink-0 lg:min-w-0 md:flex-auto px-2 md:px-2 lg:px-2.5 xl:px-3 py-1.5 text-[10.5px] md:text-[11.5px] lg:text-xs'
                    : 'min-h-[40px] md:min-h-[38px] min-w-[68px] shrink-0 lg:min-w-0 md:flex-auto px-2.5 md:px-2 lg:px-3.5 py-1.5 text-[10.5px] md:text-xs lg:text-[13px]'
              } ${isActive ? 'text-white' : inactiveTabClass}`}
            >
              {isActive && (
                <motion.span
                  layoutId={`dsb-nav-dock-active-${userRole}`}
                  transition={pillTransition}
                  data-preserve-surface="true"
                  className={`absolute inset-0 rounded-xl ${theme.activePillClass}`}
                />
              )}

              <span
                className={`relative z-10 flex items-center justify-center leading-none whitespace-nowrap ${
                  isVendedor
                    ? 'flex-row gap-1.5 sm:gap-2'
                    : 'flex-col md:flex-row gap-1 md:gap-1.5'
                }`}
              >
                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                {isVendedor ? (
                  <span>{tab.label}</span>
                ) : (
                  <>
                    <span className="md:hidden">{tab.mobileLabel}</span>
                    <span className="hidden md:inline">{tab.label}</span>
                  </>
                )}

                {showSecurityBadge && (
                  <span
                    data-preserve-surface="true"
                    aria-label={badgeAriaLabel}
                    className={`hidden md:inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold tabular-nums leading-none ${securityBadgeClass}`}
                  >
                    {formattedAlertCount}
                  </span>
                )}
              </span>

              {showSecurityBadge && (
                <span
                  data-preserve-surface="true"
                  aria-label={badgeAriaLabel}
                  className={`md:hidden absolute top-0.5 right-0.5 z-20 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold tabular-nums leading-none pointer-events-none ${securityBadgeClass}`}
                >
                  {formattedAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );

  if (embedded) {
    return (
      <div
        className="mt-2 pt-2 border-t"
        style={{
          borderTopColor: isDarkSurface
            ? surfaceTheme === 'royal-blue'
              ? 'rgba(186, 212, 245, 0.14)'
              : 'rgba(226, 194, 117, 0.14)'
            : 'rgba(15, 23, 42, 0.08)',
        }}
      >
        {navContent}
      </div>
    );
  }

  return <div className="mx-auto max-w-6xl px-3 sm:px-6 pt-3 sm:pt-4">{navContent}</div>;
};
