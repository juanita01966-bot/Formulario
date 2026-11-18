import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { AppSettings } from '../../types/app';
import { DsbAuthError, updateDsbCredentials } from '../../services/storeClient';

interface SettingsPanelProps {
  settings: AppSettings;
  onSaveSettings: (updates: Partial<AppSettings>) => Promise<void>;
  onOpenMasterReset?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSaveSettings,
  onOpenMasterReset,
}) => {
  const [advisorName, setAdvisorName] = useState(settings.advisorName);
  const [hostTitle, setHostTitle] = useState(settings.hostTitle);
  const [defaultTicketAmount, setDefaultTicketAmount] = useState(String(settings.defaultTicketAmount));
  const [saved, setSaved] = useState(false);

  // 2-Filter Security Credentials State (requires Master Override Key on backend)
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [secSaving, setSecSaving] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTicket = Number(defaultTicketAmount);
    await onSaveSettings({
      advisorName: advisorName.trim() || settings.advisorName,
      hostTitle: hostTitle.trim() || settings.hostTitle,
      defaultTicketAmount: Number.isFinite(parsedTicket) && parsedTicket >= 0 ? parsedTicket : 2792,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError(null);
    setSecSuccess(null);

    if (!newUsername.trim() && !newPassword && !newPin.trim()) {
      setSecError('Ingresa al menos un dato nuevo (usuario, contraseña o PIN) para actualizar.');
      return;
    }
    if (!masterPassword) {
      setSecError('Debes ingresar la contraseña maestra de autorización para modificar credenciales.');
      return;
    }

    setSecSaving(true);
    try {
      const res = await updateDsbCredentials({
        masterPassword,
        newUsername: newUsername.trim() || undefined,
        newPassword: newPassword || undefined,
        newPin: newPin.trim() || undefined,
      });
      setSecSuccess(`${res.message} (Usuario activo: ${res.username})`);
      setNewUsername('');
      setNewPassword('');
      setNewPin('');
      setMasterPassword('');
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setSecError(err.message);
      } else {
        setSecError(err instanceof Error ? err.message : 'No se pudieron actualizar las credenciales.');
      }
    } finally {
      setSecSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* General Settings Card */}
      <section className="rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-5 sm:p-7 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)]">
        <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#22150E]">
          Configuración de Métricas Ciprian & Formulario
        </h2>
        <p className="text-xs sm:text-sm text-[#7B5D4A] mt-1">
          Personaliza la identidad del distribuidor y el ticket promedio base del panel operativo.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#594133] mb-1">
              Nombre del asesor (Saludo en Dashboard)
            </label>
            <input
              type="text"
              value={advisorName}
              onChange={(e) => setAdvisorName(e.target.value)}
              className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm text-[#22150E] focus:bg-white focus:border-[#B84A27] focus:outline-none"
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
              className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm text-[#22150E] focus:bg-white focus:border-[#B84A27] focus:outline-none"
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
              className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#22150E] focus:bg-white focus:border-[#B84A27] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#22150E] px-5 py-2.5 text-sm font-semibold text-[#FAF3E8] hover:bg-[#3A2418] transition-colors cursor-pointer"
            >
              {saved ? <Check className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
              {saved ? 'Cambios guardados' : 'Guardar configuración'}
            </button>
          </div>
        </form>

        {onOpenMasterReset && (
          <div className="mt-6 rounded-2xl border border-[#B84A27]/30 bg-[#FFF5EC] p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C3318]">
                  Reinicio Total desde 0
                </h3>
                <p className="mt-0.5 text-xs text-[#6D4735]">
                  Limpia todos los prospectos, métricas e historial QR (protegido con Contraseña Maestra).
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenMasterReset}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#B84A27] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#9D3B1B] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Poner todo en 0
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Cybersecurity & 2-Filter Credentials Vault */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#23150E] via-[#2E1C13] to-[#1A0F0A] border border-[#C88A2B]/40 p-5 sm:p-7 text-[#FFFDF9] shadow-[0_18px_40px_-16px_rgba(34,21,14,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4CA73]/15 border border-[#F4CA73]/35 text-[#F4CA73]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#F4CA73]">
                Blindaje de Doble Filtro · Anti-Brute-Force
              </span>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-[#FFFDF9]">
                Credenciales de Acceso y PIN (`/dsb`)
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[#E8D5BE] hover:bg-white/10 cursor-pointer"
          >
            {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPasswords ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <p className="mt-2 text-xs text-[#D5C0A8] leading-relaxed">
          Modifica el usuario y contraseña del <strong>Filtro 1</strong> o el PIN numérico del{' '}
          <strong>Filtro 2</strong>. Por seguridad criptográfica, cualquier cambio exige autorización con tu{' '}
          <strong>Contraseña Maestra</strong>.
        </p>

        <form onSubmit={handleSecuritySubmit} className="mt-5 space-y-3.5" autoComplete="off">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#E8D5BE] mb-1">
                Nuevo Usuario (Filtro 1)
              </label>
              <div className="relative">
                <UserCheck className="h-4 w-4 text-[#C88A2B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Dejar vacío para conservar"
                  className="w-full rounded-xl border border-white/15 bg-black/25 pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#E8D5BE] mb-1">
                Nuevo PIN Numérico (Filtro 2)
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-[#C88A2B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4 a 12 dígitos (opcional)"
                  className="w-full rounded-xl border border-white/15 bg-black/25 pl-9 pr-3 py-2.5 text-xs font-mono tracking-widest text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#E8D5BE] mb-1">
              Nueva Contraseña de Acceso (Filtro 1)
            </label>
            <div className="relative">
              <KeyRound className="h-4 w-4 text-[#C88A2B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres (dejar vacío para conservar)"
                className="w-full rounded-xl border border-white/15 bg-black/25 pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#F4CA73]/35 bg-black/35 p-3.5 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#F4CA73]">
              <ShieldAlert className="h-4 w-4 text-[#F4CA73]" />
              Contraseña Maestra de Autorización (Obligatoria)
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Ingresa la llave maestra secreta para autorizar el cambio"
              className="w-full rounded-xl border border-[#F4CA73]/40 bg-[#140B07] px-3.5 py-2.5 text-xs text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
            />
            <p className="text-[11px] text-[#C4AC92]">
              Verificación en tiempo constante (scrypt + HMAC) con bloqueo anti-fuerza bruta tras 5 intentos fallidos.
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
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4942A] via-[#F4CA73] to-[#C88A2B] px-5 py-3 text-xs font-bold text-[#1E110A] shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {secSaving ? 'Verificando llave maestra...' : 'Autorizar y Actualizar Credenciales'}
          </button>
        </form>
      </section>
    </div>
  );
};
