import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Gift,
  LayoutDashboard,
  LogOut,
  QrCode,
  Settings,
} from 'lucide-react';
import type { Lead } from '../../types/app';

export type DashboardTab = 'overview' | 'gifts' | 'qr' | 'settings';

interface DashboardHeaderProps {
  leads: Lead[];
  activeTab: DashboardTab;
  userRole?: 'admin' | 'caller';
  onTabChange: (tab: DashboardTab) => void;
  onJumpToPending: () => void;
  onLockNow?: () => void;
  onLogout?: () => void;
}

const TABS: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'gifts', label: 'Regalos', icon: Gift },
  { id: 'qr', label: 'QR', icon: QrCode },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  leads,
  activeTab,
  userRole = 'admin',
  onTabChange,
  onJumpToPending,
  onLockNow,
  onLogout,
}) => {
  const [bellOpen, setBellOpen] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement | null>(null);

  const pendingLeads = leads.filter((l) => !l.called);
  const isCaller = userRole === 'caller';

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
    <header className="sticky top-0 z-30 border-b border-[#E6D5BF]/80 bg-gradient-to-r from-[#FFFDF9]/96 via-[#FFF9F0]/94 to-[#FAF1E4]/96 backdrop-blur-md sm:backdrop-blur-xl shadow-[0_6px_24px_-12px_rgba(34,21,14,0.1)]">
      <div className="h-1 w-full bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#3D6B52]" />
      <div className="mx-auto max-w-6xl px-3.5 sm:px-6 py-2.5 sm:py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 lg:gap-4">
          {/* Brand + Action Buttons Row */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 lg:flex-1 lg:min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <motion.div
                whileHover={{ scale: 1.06 }}
                transition={{ duration: 0.35 }}
                className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full p-[2px] bg-gradient-to-br from-[#F4CA73] via-[#C88A2B] to-[#6E450E] shadow-md"
              >
                <img
                  src="/images/logo%20ciprian.png"
                  alt="Métricas Ciprian"
                  className="h-full w-full rounded-full object-cover"
                />
              </motion.div>
              <h1 className="font-serif text-base sm:text-xl font-bold tracking-tight text-[#22150E] leading-none truncate">
                Métricas Ciprian
              </h1>
            </div>

            {/* Desktop inline tabs (>= lg) */}
            {!isCaller && (
              <nav
                aria-label="Navegación del dashboard"
                className="hidden lg:inline-flex rounded-2xl bg-[#F3E8D9] p-1 border border-[#E3D0B8] shrink-0"
              >
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={`relative flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                        isActive ? 'text-[#22150E]' : 'text-[#7B5D4A] hover:text-[#22150E]'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="dsb-active-tab-desktop"
                          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                          className="absolute inset-0 rounded-xl bg-[#FFFDF9] shadow-sm border border-[#E6D5BF]/70"
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{tab.label}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Rightmost Actions: Cerrar sesión + Notification Bell at the very end */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onLogout || onLockNow}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 sm:px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer shadow-sm"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="sm:hidden">Salir</span>
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>

              {!isCaller && (
                <div ref={bellContainerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setBellOpen((prev) => !prev)}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#DFCBB3] bg-white text-[#22150E] hover:bg-[#FAF3E8] transition-colors cursor-pointer shadow-xs"
                    aria-label="Notificaciones de prospectos sin llamar"
                    aria-expanded={bellOpen}
                  >
                    <Bell className="h-4 w-4" />
                    {pendingLeads.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#B84A27] px-1 text-[10px] font-bold text-white tabular-nums shadow">
                        {pendingLeads.length}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {bellOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        className="fixed sm:absolute right-3.5 sm:right-0 left-3.5 sm:left-auto top-[66px] sm:top-auto sm:mt-2 sm:w-72 rounded-2xl border border-[#E6D5BF] bg-[#FFFDF9] p-3.5 shadow-xl z-40"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-[#EFE3D2]">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#6E5341]">
                            Por llamar ({pendingLeads.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setBellOpen(false);
                              onJumpToPending();
                            }}
                            className="min-h-[36px] px-2 text-xs font-semibold text-[#B84A27] hover:underline cursor-pointer"
                          >
                            Filtrar todos
                          </button>
                        </div>
                        {pendingLeads.length === 0 ? (
                          <p className="py-4 text-center text-xs text-[#7B5D4A]">
                            Todos los prospectos ya han sido llamados.
                          </p>
                        ) : (
                          <div className="mt-2 max-h-56 overflow-y-auto space-y-2">
                            {pendingLeads.slice(0, 5).map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => {
                                  setBellOpen(false);
                                  onJumpToPending();
                                }}
                                className="w-full min-h-[44px] rounded-xl bg-[#FAF3E8]/70 hover:bg-[#FAF3E8] p-2.5 text-left transition-colors cursor-pointer"
                              >
                                <p className="text-xs font-bold text-[#22150E] truncate">{lead.name}</p>
                                <p className="text-[11px] text-[#7B5D4A] truncate">
                                  {lead.phone} · {lead.giftName || 'Sin regalo'}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Mobile & Tablet Navigation Tabs (< lg) */}
          {!isCaller && (
            <nav
              aria-label="Navegación del dashboard"
              className="grid grid-cols-4 w-full lg:hidden rounded-2xl bg-[#F3E8D9] p-1 border border-[#E3D0B8]"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`relative flex min-h-[44px] items-center justify-center gap-1 sm:gap-1.5 rounded-xl px-1.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                      isActive ? 'text-[#22150E]' : 'text-[#7B5D4A] hover:text-[#22150E]'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="dsb-active-tab-mobile"
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        className="absolute inset-0 rounded-xl bg-[#FFFDF9] shadow-sm border border-[#E6D5BF]/70"
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};
