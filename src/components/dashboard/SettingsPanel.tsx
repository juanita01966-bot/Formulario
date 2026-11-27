import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
  Eye,
  EyeOff,
  Lock,
  Save,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { AppSettings, UserRole } from '../../types/app';
import { DsbAuthError } from '../../services/storeClient';
import { getRoleTheme } from './roleTheme';
import { RoleSymbolSvg } from './RoleEmblem';

interface SettingsPanelProps {
  settings: AppSettings;
  userRole?: UserRole;
  onGoToAiControl?: () => void;
  onSaveSettings: (updates: Partial<AppSettings>, masterPassword: string) => Promise<void>;
  onCredentialsUpdated?: (username: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  userRole = 'admin',
  onGoToAiControl,
  onSaveSettings,
  onBusyChange,
}) => {
  const isAiManager = userRole === 'ai_manager';
  const activeTheme = getRoleTheme(userRole);

  // General Settings State
  const [advisorName, setAdvisorName] = useState(settings.advisorName);
  const [hostTitle, setHostTitle] = useState(settings.hostTitle);
  const [defaultTicketAmount, setDefaultTicketAmount] = useState(
    String(settings.defaultTicketAmount)
  );
  const [generalMasterKey, setGeneralMasterKey] = useState('');
  const [showGeneralKey, setShowGeneralKey] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!generalSaving) {
      setAdvisorName(settings.advisorName);
      setHostTitle(settings.hostTitle);
      setDefaultTicketAmount(String(settings.defaultTicketAmount));
    }
  }, [settings.advisorName, settings.hostTitle, settings.defaultTicketAmount, generalSaving]);

  useEffect(() => {
    onBusyChange?.(generalSaving);
    return () => onBusyChange?.(false);
  }, [generalSaving, onBusyChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generalSaving) return;
    setGeneralError(null);
    setSaved(false);

    if (!isAiManager && !generalMasterKey) {
      setGeneralError('Ingresa tu contraseña de Administrador para guardar los ajustes del panel.');
      return;
    }

    const parsedTicket = Number(defaultTicketAmount);
    setGeneralSaving(true);
    try {
      await onSaveSettings(
        {
          advisorName: advisorName.trim() || settings.advisorName,
          hostTitle: hostTitle.trim() || settings.hostTitle,
          defaultTicketAmount:
            Number.isFinite(parsedTicket) && parsedTicket >= 0 ? parsedTicket : 2792,
        },
        isAiManager ? '' : generalMasterKey
      );
      setGeneralMasterKey('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    } catch (err) {
      setGeneralError(
        err instanceof DsbAuthError || err instanceof Error
          ? err.message
          : 'No se pudo guardar la configuración.'
      );
    } finally {
      setGeneralSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
      {/* Left: General Settings Card */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden dsb-glass rounded-[22px] sm:rounded-[26px] p-4 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: activeTheme.headerStrip }}
        />
        <h2 className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">
          Configuración de Dashboard Operativo &amp; Formulario
        </h2>
        <p className="text-xs sm:text-sm text-[#6E5341] mt-1">
          {isAiManager
            ? 'Personaliza la identidad del distribuidor y el ticket promedio base. Guardado inmediato en 1 clic con autoridad AI Manager.'
            : 'Personaliza la identidad del distribuidor y el ticket promedio base del panel operativo. Requiere tu contraseña de Administrador para guardar cambios.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-3.5" autoComplete="off">
          <div>
            <label className="block text-xs font-semibold text-[#594133] mb-1">
              Nombre del asesor (Saludo en Dashboard)
            </label>
            <input
              type="text"
              value={advisorName}
              onChange={(e) => setAdvisorName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#594133] mb-1">
              Título destacado del formulario público
            </label>
            <input
              type="text"
              value={hostTitle}
              onChange={(e) => setHostTitle(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#594133] mb-1">
              Ticket promedio base ($)
            </label>
            <input
              type="number"
              min={0}
              value={defaultTicketAmount}
              onChange={(e) => setDefaultTicketAmount(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3.5 py-2 text-base sm:text-sm font-mono tabular-nums text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors"
            />
          </div>

          {!isAiManager && (
            <div className="dsb-glass-subtle rounded-2xl border border-[#8B0018]/25 p-3.5 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#8B0018]">
                <ShieldAlert className="h-4 w-4 shrink-0 text-[#B91C1C]" />
                Tu contraseña de Administrador (Obligatoria)
              </label>
              <div className="relative">
                <input
                  type={showGeneralKey ? 'text' : 'password'}
                  value={generalMasterKey}
                  onChange={(e) => {
                    setGeneralMasterKey(e.target.value);
                    setGeneralError(null);
                  }}
                  placeholder="Ingresa tu contraseña de acceso para autorizar cambios"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/90 bg-white/85 pl-3.5 pr-12 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowGeneralKey((p) => !p)}
                  aria-label={showGeneralKey ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-[#7B5D4A] hover:text-[#22150E] cursor-pointer"
                >
                  {showGeneralKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {generalError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/90 backdrop-blur-sm px-3.5 py-2.5 text-xs font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={generalSaving}
              data-preserve-surface="true"
              style={{ background: activeTheme.heroGradient }}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-60"
            >
              {saved ? <Check className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
              {generalSaving
                ? 'Guardando...'
                : saved
                  ? 'Cambios guardados'
                  : isAiManager
                    ? 'Guardar cambios'
                    : 'Autorizar y guardar'}
            </button>
          </div>
        </form>
      </motion.section>

      {/* Right: Compact Opción A Info Card (Admin) OR Centro AI Control Shortcut (AI Manager) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        data-preserve-surface="true"
        style={{ background: activeTheme.heroGradient }}
        className="relative overflow-hidden rounded-[22px] sm:rounded-[26px] border border-white/20 backdrop-blur-xl p-4 sm:p-6 text-[#FFFDF9] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)] space-y-4"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FDE68A]/55 to-transparent"
        />

        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/25 border border-white/20 backdrop-blur-md shadow-inner">
            {isAiManager ? (
              <Crown className="h-5 w-5 text-[#FDE68A]" />
            ) : (
              <RoleSymbolSvg role="admin" className="h-7 w-7" animated={false} />
            )}
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#FDE68A]">
              {isAiManager ? 'Control Supremo · AI Manager' : 'Política de Seguridad · Opción A'}
            </span>
            <h3 className="font-serif text-base sm:text-xl font-bold text-[#FFFDF9] leading-snug">
              {isAiManager
                ? 'Credenciales Admin y Controles en Vivo'
                : 'Credenciales de Administrador'}
            </h3>
          </div>
        </div>

        {isAiManager ? (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#F5EBD6]/90 leading-relaxed">
              Desde <strong>Centro AI</strong> puedes cambiar la contraseña y PIN 2FA de cualquier cuenta Administradora, revocar sesiones activas al instante y controlar todos los interruptores del sistema sin ingresar contraseñas.
            </p>
            <div className="rounded-2xl border border-[#F4CA73]/30 bg-black/25 p-3.5 space-y-1.5 text-xs text-[#E8D5BE]">
              <p className="flex items-center gap-2 font-bold text-[#FDE68A]">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Autoridad Zero-Password Activa
              </p>
              <p className="leading-relaxed">
                Tus cambios en Ajustes, Regalos, Cuentas y Prospectos se aplican en 1 clic y quedan auditados automáticamente.
              </p>
            </div>
            {onGoToAiControl && (
              <button
                type="button"
                onClick={onGoToAiControl}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4942A] via-[#F4CA73] to-[#C88A2B] px-5 py-2.5 text-xs sm:text-sm font-bold text-[#1A0E08] shadow-lg hover:brightness-105 transition-all cursor-pointer"
              >
                <Crown className="h-4 w-4 shrink-0" />
                <span>Abrir Centro AI</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#F4CA73]/30 bg-black/25 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FDE68A]">
                <Lock className="h-4 w-4 shrink-0" />
                <span>Gestión Centralizada de Credenciales</span>
              </div>
              <p className="text-xs sm:text-sm text-[#F5F2EB] leading-relaxed font-medium">
                Credenciales de Administrador: gestionadas exclusivamente por el AI Manager.
              </p>
              <p className="text-[11.5px] text-[#E3CEB6]/85 leading-relaxed">
                Si necesitas rotar tu contraseña de acceso o tu PIN 2FA de seguridad, solicítalo directamente al AI Manager para una actualización auditada y segura.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#E3CEB6]/80">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
              <span>Tus permisos operativos sobre prospectos, QRs, regalos y equipo permanecen activos.</span>
            </div>
          </div>
        )}
      </motion.section>
    </div>
  );
};
