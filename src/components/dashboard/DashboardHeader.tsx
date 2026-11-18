import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  Copy,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LogOut,
  QrCode,
  Settings,
  UserCheck,
} from 'lucide-react';
import type { AppSettings, Lead } from '../../types/app';

export type DashboardTab = 'overview' | 'gifts' | 'qr' | 'settings';

interface DashboardHeaderProps {
  settings: AppSettings;
  leads: Lead[];
  activeTab: DashboardTab;
  syncMode: 'api' | 'local';
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
  settings,
  leads,
  activeTab,
  syncMode,
  userRole = 'admin',
  onTabChange,
  onJumpToPending,
  onLockNow,
  onLogout,
}) => {
  const [bellOpen, setBellOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const pendingLeads = leads.filter((l) => !l.called);

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const publicUrl = `${window.location.origin}/#/`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const isCaller = userRole === 'caller';

  return (
    <header className="sticky top-0 z-30 border-b border-[#E6D5BF]/80 bg-gradient-to-r from-[#FFFDF9]/95 via-[#FFF9F0]/92 to-[#FAF1E4]/95 backdrop-blur-xl shadow-[0_6px_24px_-12px_rgba(34,21,14,0.1)]">
      <div className="h-1 w-full bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#3D6B52]" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5">
        {/* Top bar: Métricas Ciprian brand + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.35 }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-[2px] bg-gradient-to-br from-[#F4CA73] via-[#C88A2B] to-[#6E450E] shadow-md"
            >
              <img
                src="/images/logo%20ciprian.png"
                alt="Métricas Ciprian"
                className="h-full w-full rounded-full object-cover"
              />
            </motion.div>
            <div className="flex items-center gap-2.5">
              <div>
                <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#22150E] block leading-none">
                  Métricas Ciprian
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A2683A]">
                  Show de Cocina · {isCaller ? 'Directorio Caller' : 'Panel Operativo'}
                </span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {syncMode === 'api' ? 'En vivo' : 'Local Sync'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCaller && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm">
                <UserCheck className="w-3.5 h-3.5" />
                Perfil Caller
              </span>
            )}

            {!isCaller && (
              <>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FAF3E8] px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
                  title="Copiar enlace público del formulario"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{copiedLink ? 'Enlace copiado' : 'Copiar link'}</span>
                </button>

                <a
                  href="#/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#DFCBB3] bg-white px-3 py-1.5 text-xs font-semibold text-[#22150E] hover:bg-[#FAF3E8] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#B84A27]" />
                  <span className="hidden sm:inline">Ver formulario</span>
                </a>
              </>
            )}

            {/* Prominent Cerrar sesión button */}
            <button
              type="button"
              onClick={onLogout || onLockNow}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer shadow-sm"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>

            {/* Notification Bell (admin only) */}
            {!isCaller && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBellOpen((prev) => !prev)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#DFCBB3] bg-white text-[#22150E] hover:bg-[#FAF3E8] transition-colors cursor-pointer"
                  aria-label="Notificaciones de prospectos sin llamar"
                >
                  <Bell className="h-4 w-4" />
                  {pendingLeads.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#B84A27] px-1 text-[10px] font-bold text-white tabular-nums shadow">
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
                      className="absolute right-0 mt-2 w-72 rounded-2xl border border-[#E6D5BF] bg-[#FFFDF9] p-3.5 shadow-xl z-40"
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
                          className="text-xs font-semibold text-[#B84A27] hover:underline cursor-pointer"
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
                              className="w-full rounded-xl bg-[#FAF3E8]/70 hover:bg-[#FAF3E8] p-2.5 text-left transition-colors cursor-pointer"
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

        {/* Profile Greeting + Navigation Tabs */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#EFE2D0] to-[#DFC4A3] border-2 border-[#C88A2B]/40 text-sm font-bold text-[#4E311E] shadow-inner">
              {isCaller
                ? 'CA'
                : settings.advisorName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() || '')
                    .join('')}
            </div>
            <div>
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#22150E] leading-tight">
                Hola, {isCaller ? 'Caller' : settings.advisorName}
              </h1>
              <p className="text-xs sm:text-sm text-[#7B5D4A] capitalize">
                {formattedDate} {isCaller && '· Panel de Contacto'}
              </p>
            </div>
          </div>

          {!isCaller && (
            <nav
              aria-label="Navegación del dashboard"
              className="inline-flex flex-wrap max-w-full rounded-2xl bg-[#F3E8D9] p-1 border border-[#E3D0B8] self-start sm:self-auto"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`relative flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                      isActive ? 'text-[#22150E]' : 'text-[#7B5D4A] hover:text-[#22150E]'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="dsb-active-tab"
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        className="absolute inset-0 rounded-xl bg-[#FFFDF9] shadow-sm border border-[#E6D5BF]/70"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon className="h-4 w-4" />
                      {tab.label}
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
