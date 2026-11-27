import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Save,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppSettings } from '../../types/app';
import { DsbAuthError, updateDsbCredentials } from '../../services/storeClient';
import { getRoleTheme } from './roleTheme';
import { RoleSymbolSvg } from './RoleEmblem';

interface SettingsPanelProps {
  settings: AppSettings;
  onSaveSettings: (updates: Partial<AppSettings>, masterPassword: string) => Promise<void>;
  onCredentialsUpdated?: (username: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSaveSettings,
  onCredentialsUpdated,
  onBusyChange,
}) => {
  // General Settings State (requires logged-in Admin password)
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

  // Admin Credentials Vault State (Special Security Key + 2x New Password + PIN Confirmation Modal)
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [secSaving, setSecSaving] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);

  // Confirmation PIN Modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [confirmationPin, setConfirmationPin] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!generalSaving) {
      setAdvisorName(settings.advisorName);
      setHostTitle(settings.hostTitle);
      setDefaultTicketAmount(String(settings.defaultTicketAmount));
    }
  }, [settings.advisorName, settings.hostTitle, settings.defaultTicketAmount, generalSaving]);

  useEffect(() => {
    onBusyChange?.(generalSaving || secSaving || pinModalOpen);
    return () => onBusyChange?.(false);
  }, [generalSaving, secSaving, pinModalOpen, onBusyChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generalSaving) return;
    setGeneralError(null);
    setSaved(false);

    if (!generalMasterKey) {
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
        generalMasterKey
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

  const handleSecurityStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setSecError(null);
    setSecSuccess(null);

    if (!newUsername.trim() && !newPassword && !newPin.trim()) {
      setSecError('Ingresa al menos un dato nuevo (usuario, contraseña o PIN) para actualizar.');
      return;
    }
    if (newPassword) {
      if (newPassword.length < 8) {
        setSecError('La nueva contraseña de Administrador debe tener al menos 8 caracteres.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setSecError('La nueva contraseña y su confirmación no coinciden.');
        return;
      }
    }
    if (newPin.trim() && (newPin.trim().length < 4 || newPin.trim().length > 12)) {
      setSecError('El nuevo PIN de inicio de sesión debe tener entre 4 y 12 dígitos.');
      return;
    }
    if (!masterPassword) {
      setSecError('Debes ingresar la Clave de Seguridad especial para continuar.');
      return;
    }

    setConfirmationPin('');
    setPinModalError(null);
    setPinModalOpen(true);
  };

  const handleConfirmPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secSaving) return;
    setPinModalError(null);

    const cleanPin = confirmationPin.trim();
    if (cleanPin.length < 4) {
      setPinModalError('Ingresa el PIN de confirmación de 4 dígitos.');
      return;
    }

    setSecSaving(true);
    try {
      const res = await updateDsbCredentials({
        masterPassword,
        confirmationPin: cleanPin,
        newUsername: newUsername.trim() || undefined,
        newPassword: newPassword || undefined,
        confirmNewPassword: newPassword ? confirmNewPassword : undefined,
        newPin: newPin.trim() || undefined,
      });
      setPinModalOpen(false);
      setConfirmationPin('');
      setSecSuccess(`${res.message} (Usuario activo: ${res.username})`);
      onCredentialsUpdated?.(res.username);
      setNewUsername('');
      setNewPassword('');
      setConfirmNewPassword('');
      setNewPin('');
      setMasterPassword('');
    } catch (err) {
      const msg =
        err instanceof DsbAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudieron actualizar las credenciales.';
      setPinModalError(msg);
    } finally {
      setSecSaving(false);
    }
  };

  const adminTheme = getRoleTheme('admin');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
      {/* General Settings Card (Protected by logged-in Admin password) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden dsb-glass rounded-[24px] sm:rounded-[26px] p-4 sm:p-7"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: adminTheme.headerStrip }}
        />
        <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#22150E]">
          Configuración de Dashboard Operativo & Formulario
        </h2>
        <p className="text-xs sm:text-sm text-[#6E5341] mt-1">
          Personaliza la identidad del distribuidor y el ticket promedio base del panel operativo. Requiere tu contraseña de Administrador para guardar cambios.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 sm:mt-6 space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-semibold text-[#594133] mb-1">
              Nombre del asesor (Saludo en Dashboard)
            </label>
            <input
              type="text"
              value={advisorName}
              onChange={(e) => setAdvisorName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3.5 py-2.5 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors"
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
              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3.5 py-2.5 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors"
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
              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3.5 py-2.5 text-base sm:text-sm font-mono tabular-nums text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors"
            />
          </div>

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
              style={{ background: adminTheme.heroGradient }}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-60"
            >
              {saved ? <Check className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
              {generalSaving
                ? 'Verificando...'
                : saved
                  ? 'Cambios guardados'
                  : 'Autorizar y guardar'}
            </button>
          </div>
        </form>
      </motion.section>

      {/* Admin Credentials Vault (Special Security Key + 2x New Password + Confirmation PIN Modal) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: adminTheme.heroGradient }}
        className="relative overflow-hidden rounded-[24px] sm:rounded-[26px] border border-white/20 backdrop-blur-xl p-4 sm:p-7 text-[#FFFDF9] shadow-[0_20px_44px_-16px_rgba(139,0,24,0.45)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/25 border border-white/20 backdrop-blur-md shadow-inner">
              <RoleSymbolSvg role="admin" className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#FDE68A]">
                Blindaje Admin · Solo Tu Propia Cuenta
              </span>
              <h3 className="font-serif text-base sm:text-xl font-bold text-[#FFFDF9] leading-snug break-words">
                Mis Credenciales de Administrador (`/dsb`)
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="inline-flex min-h-[40px] sm:min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl sm:rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs sm:text-[11px] font-semibold text-[#E8D5BE] hover:bg-white/10 cursor-pointer"
          >
            {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPasswords ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <p className="mt-2.5 text-xs text-[#D5C0A8] leading-relaxed">
          Actualiza <strong>exclusivamente tu propia cuenta de Administrador</strong>. Esta es la{' '}
          <strong>única sección que utiliza la Clave de Seguridad especial</strong> junto con el{' '}
          <strong>PIN de confirmación</strong> en el siguiente paso (y escribir la nueva contraseña dos veces).
        </p>

        <form onSubmit={handleSecurityStep1} className="mt-5 space-y-3.5" autoComplete="off">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#E8D5BE] mb-1">
                Nuevo Usuario Admin (opcional)
              </label>
              <div className="relative">
                <UserCheck className="h-4 w-4 text-[#C88A2B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Dejar vacío para conservar"
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-black/25 pl-9 pr-3 py-2.5 text-base sm:text-xs text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#E8D5BE] mb-1">
                Nuevo PIN de Acceso (opcional)
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-[#C88A2B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4 a 12 dígitos"
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-black/25 pl-9 pr-3 py-2.5 text-base sm:text-xs font-mono tracking-widest text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#E8D5BE] mb-1">
                Nueva Contraseña Admin
              </label>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-[#C88A2B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mín. 8 caracteres"
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-black/25 pl-9 pr-3 py-2.5 text-base sm:text-xs text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#E8D5BE] mb-1">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-[#C88A2B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-black/25 pl-9 pr-3 py-2.5 text-base sm:text-xs text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#F4CA73]/35 bg-black/35 p-3.5 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#F4CA73]">
              <ShieldAlert className="h-4 w-4 text-[#F4CA73] shrink-0" />
              Clave de Seguridad Especial (Obligatoria)
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Ingresa la Clave de Seguridad especial"
              className="w-full min-h-[44px] rounded-xl border border-[#F4CA73]/40 bg-[#140B07] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
            />
            <p className="text-[11px] text-[#C4AC92]">
              Al presionar continuar se abrirá el modal de PIN de Confirmación para validar el cambio de tu propia cuenta en el servidor.
            </p>
          </div>

          {secError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{secError}</span>
            </div>
          )}

          {secSuccess && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/60 px-3.5 py-2.5 text-xs font-semibold text-emerald-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{secSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={secSaving}
            data-preserve-surface="true"
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4942A] via-[#F4CA73] to-[#C88A2B] px-5 py-3 text-xs sm:text-sm font-bold text-[#1E110A] shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Continuar y Confirmar con PIN
          </button>
        </form>
      </motion.section>

      {/* Modal de PIN de Confirmación para Credenciales Admin */}
      <AnimatePresence>
        {pinModalOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-pin-confirm-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#120804]/80 px-3 sm:px-4 py-3 sm:py-4 backdrop-blur-sm overflow-y-auto"
            onClick={() => {
              if (!secSaving) {
                setPinModalOpen(false);
              }
            }}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleConfirmPinSubmit}
              autoComplete="off"
              className="relative w-full max-w-[420px] max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[26px] border border-[#C88A2B]/60 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-4 sm:p-6 text-[#FFFDF9] shadow-2xl space-y-4"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F4CA73]/40 bg-[#F4CA73]/15 text-[#F4CA73]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F4CA73] block">
                      Paso Final de Seguridad
                    </span>
                    <h3 id="admin-pin-confirm-title" className="font-serif text-lg font-bold text-white">
                      PIN de Confirmación
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={secSaving}
                  onClick={() => {
                    setPinModalOpen(false);
                  }}
                  aria-label="Cerrar modal de PIN"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#C8B29A] hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-[#E3CEB6] leading-relaxed">
                Ingresa el <strong>PIN de confirmación de 4 dígitos</strong> para autorizar el cambio de credenciales de tu propia cuenta de Administrador.
              </p>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-confirmation-pin-input"
                  className="block text-xs font-bold text-[#F4CA73]"
                >
                  PIN de Confirmación (4 dígitos)
                </label>
                <input
                  id="admin-confirmation-pin-input"
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  disabled={secSaving}
                  value={confirmationPin}
                  onChange={(e) => {
                    setConfirmationPin(e.target.value.replace(/\D/g, ''));
                    setPinModalError(null);
                  }}
                  placeholder="••••"
                  className="w-full min-h-[48px] rounded-xl border border-[#F4CA73]/45 bg-[#110804] px-4 py-2.5 text-center font-mono text-xl font-bold tracking-[0.4em] text-[#F4CA73] placeholder:text-white/25 focus:border-[#F4CA73] focus:outline-none"
                />
              </div>

              {pinModalError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/65 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{pinModalError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={secSaving}
                  onClick={() => {
                    setPinModalOpen(false);
                  }}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={secSaving || confirmationPin.length < 4}
                  data-preserve-surface="true"
                  className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow hover:brightness-105 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {secSaving ? 'Verificando PIN...' : 'Confirmar y actualizar'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
