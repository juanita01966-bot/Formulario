import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { AppSettings, AppState, GiftThemeId } from '../types/app';
import {
  createGift,
  createLead,
  createQrCode,
  deleteGift,
  deleteLead,
  deleteQrCode,
  DsbAuthError,
  fetchAppState,
  loginStep1,
  logoutDsbSession,
  resetAllWorkspaceData,
  resetDefaultGifts,
  updateGift,
  updateGiftProbabilities,
  updateLead,
  updateSettings,
  verifyDsbSession,
  verifyPinStep2,
  type CreateQrPayload,
  type UpsertGiftPayload,
} from '../services/storeClient';
import { AutumnAtmosphere } from '../components/autumn/AutumnAtmosphere';
import { DashboardHeader, type DashboardTab } from '../components/dashboard/DashboardHeader';
import { KpiGrid, type KpiFilterKey } from '../components/dashboard/KpiGrid';
import { ProspectsManager, type LeadUpdatePayload } from '../components/dashboard/ProspectsManager';
import { CallerProspectsView } from '../components/dashboard/CallerProspectsView';
import { GiftsEditor } from '../components/dashboard/GiftsEditor';
import { QrStudioPanel } from '../components/dashboard/QrStudioPanel';
import { SettingsPanel } from '../components/dashboard/SettingsPanel';
import { MasterResetModal } from '../components/dashboard/MasterResetModal';

interface DashboardPageProps {
  appState: AppState;
  syncMode: 'api' | 'local';
  onStateChange: (next: AppState) => void;
  onSyncPauseChange?: (paused: boolean) => void;
}

type SecurityStage = 'checking' | 'filter1_credentials' | 'filter2_pin' | 'authenticated';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  appState,
  syncMode,
  onStateChange,
  onSyncPauseChange,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey>('all');
  const [userRole, setUserRole] = useState<'admin' | 'caller'>('admin');
  const [masterResetOpen, setMasterResetOpen] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [prospectsBusy, setProspectsBusy] = useState(false);
  const [giftsBusy, setGiftsBusy] = useState(false);

  // 2-Filter Cybersecurity Gateway State
  const [securityStage, setSecurityStage] = useState<SecurityStage>('checking');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const pinInputRef = useRef(pinInput);
  pinInputRef.current = pinInput;

  const shouldPauseSync =
    securityStage !== 'authenticated' || masterResetOpen || prospectsBusy || giftsBusy;

  useEffect(() => {
    onSyncPauseChange?.(shouldPauseSync);
    return () => onSyncPauseChange?.(false);
  }, [shouldPauseSync, onSyncPauseChange]);

  // Check active session token on mount
  useEffect(() => {
    let cancelled = false;
    verifyDsbSession().then(async (res) => {
      if (cancelled) return;
      if (res.authenticated) {
        if (res.role) setUserRole(res.role);
        setSecurityStage('authenticated');
        try {
          const fresh = await fetchAppState();
          if (!cancelled) onStateChange(fresh.state);
        } catch {
          // Handled by periodic sync
        }
      } else {
        setSecurityStage('filter1_credentials');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [onStateChange]);

  // Countdown timer when rate-limited / locked out
  const isLockedOut = lockoutSeconds > 0;
  useEffect(() => {
    if (!isLockedOut) return;
    const timer = window.setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLockedOut]);

  const handleFilter1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || authLoading) return;
    setAuthError(null);

    if (!usernameInput.trim() || !passwordInput) {
      setAuthError('Ingresa tu usuario y contraseña de seguridad.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await loginStep1(usernameInput.trim(), passwordInput);
      setPreAuthToken(res.preAuthToken);
      if (res.role) setUserRole(res.role);
      setAuthError(null);
      setPinInput('');
      setSecurityStage('filter2_pin');
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setAuthError(err.message);
        if (err.locked && err.retryAfterSeconds > 0) {
          setLockoutSeconds(err.retryAfterSeconds);
        }
      } else {
        setAuthError('Error de conexión con el módulo de seguridad.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const submitPinCode = async (code: string) => {
    if (lockoutSeconds > 0 || authLoading || !preAuthToken) return;
    setAuthError(null);

    if (code.trim().length < 4) {
      setAuthError('Ingresa el PIN de 4 o más dígitos.');
      return;
    }

    setAuthLoading(true);
    try {
      const step2Res = await verifyPinStep2(preAuthToken, code.trim());
      if (step2Res.role) setUserRole(step2Res.role);
      setAuthError(null);
      setPasswordInput('');
      setPinInput('');
      const fresh = await fetchAppState();
      onStateChange(fresh.state);
      setSecurityStage('authenticated');
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setAuthError(err.message);
        setPinInput('');
        if (err.locked && err.retryAfterSeconds > 0) {
          setLockoutSeconds(err.retryAfterSeconds);
        }
        if (err.expiredFirstFactor) {
          setPreAuthToken(null);
          setSecurityStage('filter1_credentials');
        }
      } else {
        setAuthError('No se pudo verificar el PIN.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFilter2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPinCode(pinInput);
  };

  const submitPinCodeRef = useRef(submitPinCode);
  submitPinCodeRef.current = submitPinCode;

  // Physical keyboard support while on the Safe / Vault PIN screen
  useEffect(() => {
    if (securityStage !== 'filter2_pin') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (lockoutSeconds > 0 || authLoading) return;
      if (/^\d$/.test(e.key)) {
        setAuthError(null);
        setPinInput((prev) => (prev.length < 12 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        setAuthError(null);
        setPinInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void submitPinCodeRef.current(pinInputRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [securityStage, lockoutSeconds, authLoading]);

  const handleLockNow = () => {
    logoutDsbSession();
    setUserRole('admin');
    setActiveTab('overview');
    setPreAuthToken(null);
    setPasswordInput('');
    setPinInput('');
    setAuthError(null);
    onStateChange({ ...appState, leads: [], qrHistory: [] });
    setSecurityStage('filter1_credentials');
  };

  const handleUpdateLead = async (id: string, updates: LeadUpdatePayload) => {
    const res = await updateLead(id, updates as Parameters<typeof updateLead>[1]);
    onStateChange(res.state);
  };

  const handleCreateManualLead = async (payload: {
    name: string;
    phone: string;
    address: string;
    giftId: string;
  }) => {
    const chosen = appState.gifts.find((g) => g.id === payload.giftId);
    const res = await createLead({
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      acceptedTerms: true,
      giftId: chosen?.id || null,
      giftName: chosen?.name || null,
      giftVisualKey: chosen?.visualKey || null,
      notes: 'Registrado manualmente desde Métricas Ciprian.',
    });
    onStateChange(res.state);
  };

  const handleDeleteLead = async (id: string) => {
    const next = await deleteLead(id);
    onStateChange(next);
  };

  const handleCreateGift = async (payload: UpsertGiftPayload) => {
    const res = await createGift(payload);
    onStateChange(res.state);
  };

  const handleUpdateGift = async (id: string, updates: Partial<UpsertGiftPayload>) => {
    const res = await updateGift(id, updates);
    onStateChange(res.state);
  };

  const handleSaveGiftProbabilities = async (
    updates: Array<{ id: string; probability: number }>
  ) => {
    if (updates.length === 0) return;
    const res = await updateGiftProbabilities(updates);
    onStateChange(res.state);
  };

  const handleDeleteGift = async (id: string) => {
    const next = await deleteGift(id);
    onStateChange(next);
  };

  const handleResetGifts = async () => {
    const next = await resetDefaultGifts();
    onStateChange(next);
  };

  const handleSaveSettings = async (updates: Partial<AppSettings>) => {
    const next = await updateSettings(updates);
    onStateChange(next);
  };

  const handleUpdateGiftTheme = async (giftTheme: GiftThemeId, customBoxColor?: string) => {
    const next = await updateSettings({
      giftTheme,
      customBoxColor: customBoxColor || appState.settings.customBoxColor || '#B84A27',
    });
    onStateChange(next);
  };

  const handleCreateQr = async (payload: CreateQrPayload) => {
    const res = await createQrCode(payload);
    onStateChange(res.state);
  };

  const handleDeleteQr = async (id: string) => {
    const next = await deleteQrCode(id);
    onStateChange(next);
  };

  const handleConfirmMasterReset = async (
    masterPassword: string,
    resetCatalogAndSettings: boolean
  ) => {
    const res = await resetAllWorkspaceData(masterPassword, resetCatalogAndSettings);
    onStateChange(res.state);
    setKpiFilter('all');
    setResetSuccessMessage(res.message);
    window.setTimeout(() => setResetSuccessMessage(null), 4000);
  };

  if (securityStage !== 'authenticated') {
    const isFilter2 = securityStage === 'filter2_pin';
    const dialRotation = pinInput.length * 45;
    const slotCount = Math.max(4, pinInput.length);

    return (
      <div className="relative min-h-[100dvh] flex items-center justify-center px-3.5 sm:px-4 py-6 sm:py-12 overflow-x-hidden">
        <AutumnAtmosphere variant="dashboard" />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[440px]"
        >
          {/* Ambient bronze/gold halo behind entrance gateway */}
          <div
            className={`pointer-events-none hidden sm:block -inset-1.5 absolute rounded-[38px] blur-2xl transition-opacity duration-500 ${
              isFilter2
                ? 'bg-gradient-to-br from-[#F4CA73]/25 via-[#4B4F58]/30 to-[#0F1014]/60 opacity-85'
                : 'bg-gradient-to-br from-[#E5AE4E]/35 via-[#9E4725]/25 to-[#4B644A]/25 opacity-80'
            }`}
          />

          <div
            className={`relative overflow-hidden rounded-[26px] sm:rounded-[34px] text-[#FFFDF9] backdrop-blur-md sm:backdrop-blur-2xl shadow-[0_24px_56px_-15px_rgba(10,6,4,0.88)] p-5 sm:p-8 transition-colors duration-500 ${
              isFilter2
                ? 'bg-gradient-to-b from-[#23262C]/96 via-[#181A1F]/97 to-[#0F1114]/98 border-2 border-[#525763]/80'
                : 'bg-gradient-to-b from-[#24150D]/95 via-[#1A0E08]/97 to-[#110805]/98 border border-[#C88A2B]/55'
            }`}
          >
            {/* Top gold foil stripe */}
            <div
              className={`absolute inset-x-0 top-0 h-1.5 ${
                isFilter2
                  ? 'bg-gradient-to-r from-[#525763] via-[#F4CA73] to-[#525763]'
                  : 'bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#4B644A]'
              }`}
            />

            {/* Architectural hairline inner frame */}
            <div
              className={`pointer-events-none absolute inset-2.5 rounded-[22px] sm:rounded-[26px] border ${
                isFilter2 ? 'border-[#8D939E]/20' : 'border-[#F4CA73]/18'
              }`}
            />

            {/* Top soft warm spotlight */}
            <div
              className={`pointer-events-none absolute inset-0 ${
                isFilter2
                  ? 'bg-[radial-gradient(ellipse_at_top,_rgba(244,202,115,0.09),_transparent_58%)]'
                  : 'bg-[radial-gradient(ellipse_at_top,_rgba(244,202,115,0.16),_transparent_60%)]'
              }`}
            />

            {/* Steel Corner Rivets for Vault Look on Step 2 */}
            {isFilter2 && (
              <>
                <span className="pointer-events-none absolute top-4 left-4 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#A1A7B3] to-[#2E3138] border border-black/60 shadow-inner" />
                <span className="pointer-events-none absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#A1A7B3] to-[#2E3138] border border-black/60 shadow-inner" />
                <span className="pointer-events-none absolute bottom-4 left-4 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#A1A7B3] to-[#2E3138] border border-black/60 shadow-inner" />
                <span className="pointer-events-none absolute bottom-4 right-4 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#A1A7B3] to-[#2E3138] border border-black/60 shadow-inner" />
              </>
            )}

            {/* Minimal 2-Step Gate Indicator */}
            <div className="relative z-10 flex items-center justify-center gap-2 mb-5">
              <span
                className={`h-1 rounded-full transition-all duration-300 ${
                  !isFilter2 ? 'w-12 bg-gradient-to-r from-[#C88A2B] to-[#FDE68A]' : 'w-8 bg-[#F4CA73]/45'
                }`}
              />
              <span
                className={`h-1 rounded-full transition-all duration-300 ${
                  isFilter2 ? 'w-12 bg-gradient-to-r from-[#C88A2B] to-[#FDE68A]' : 'w-8 bg-white/15'
                }`}
              />
            </div>

            <AnimatePresence mode="wait">
              {securityStage === 'checking' ? (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-10 py-14 text-center space-y-4"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#F4CA73]/40 bg-[#F4CA73]/10">
                    <ShieldCheck className="h-8 w-8 text-[#F4CA73] animate-pulse" />
                  </div>
                  <p className="font-serif text-base font-medium text-[#E8D5BE]">Verificando sesión...</p>
                </motion.div>
              ) : !isFilter2 ? (
                <motion.form
                  key="filter1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleFilter1Submit}
                  className="relative z-10 space-y-5"
                  autoComplete="off"
                >
                  {/* Executive Medallion Header */}
                  <div className="text-center space-y-3">
                    <div className="relative mx-auto w-fit">
                      <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full p-[3px] bg-gradient-to-br from-[#FEF08A] via-[#C88A2B] to-[#6E450E] shadow-[0_14px_34px_rgba(229,174,78,0.28)]">
                        <div className="h-full w-full rounded-full overflow-hidden bg-[#160D08]">
                          <img
                            src="/images/logo%20ciprian.png"
                            alt="The Ciprian Company"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#F4CA73] to-[#B47A24] text-[#1A0E08] ring-2 ring-[#1A0E08] shadow-md">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    <div>
                      <h1 className="font-serif text-2xl sm:text-[26px] font-bold tracking-tight text-white">
                        Métricas Ciprian
                      </h1>
                      <div className="mt-1.5 flex items-center justify-center gap-2.5">
                        <span className="h-px w-7 bg-gradient-to-r from-transparent to-[#C88A2B]/70" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E5AE4E]">
                          The Ciprian Company
                        </p>
                        <span className="h-px w-7 bg-gradient-to-l from-transparent to-[#C88A2B]/70" />
                      </div>
                    </div>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold tracking-wide text-[#E8D5BE] mb-1.5 pl-1">
                        Usuario
                      </label>
                      <div className="group relative flex items-center rounded-2xl border border-[#C88A2B]/30 bg-gradient-to-b from-black/55 to-[#120A06]/85 focus-within:border-[#F4CA73] focus-within:ring-4 focus-within:ring-[#F4CA73]/15 transition-all">
                        <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4CA73]/10 border border-[#F4CA73]/20 text-[#C88A2B] group-focus-within:text-[#F4CA73] group-focus-within:border-[#F4CA73]/45 transition-colors">
                          <User className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          autoFocus
                          disabled={lockoutSeconds > 0}
                          value={usernameInput}
                          onChange={(e) => {
                            setUsernameInput(e.target.value);
                            setAuthError(null);
                          }}
                          placeholder="Usuario autorizado"
                          className="w-full min-h-[46px] bg-transparent px-3 py-3 text-base sm:text-sm text-white placeholder:text-white/35 focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold tracking-wide text-[#E8D5BE] mb-1.5 pl-1">
                        Contraseña
                      </label>
                      <div className="group relative flex items-center rounded-2xl border border-[#C88A2B]/30 bg-gradient-to-b from-black/55 to-[#120A06]/85 focus-within:border-[#F4CA73] focus-within:ring-4 focus-within:ring-[#F4CA73]/15 transition-all">
                        <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4CA73]/10 border border-[#F4CA73]/20 text-[#C88A2B] group-focus-within:text-[#F4CA73] group-focus-within:border-[#F4CA73]/45 transition-colors">
                          <KeyRound className="h-4 w-4" />
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          disabled={lockoutSeconds > 0}
                          value={passwordInput}
                          onChange={(e) => {
                            setPasswordInput(e.target.value);
                            setAuthError(null);
                          }}
                          placeholder="••••••••••••"
                          className="w-full min-h-[46px] bg-transparent pl-3 pr-12 py-3 text-base sm:text-sm text-white placeholder:text-white/35 focus:outline-none disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:text-[#F4CA73] hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {lockoutSeconds > 0 && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/50 bg-rose-950/70 px-3.5 py-3 text-xs font-semibold text-rose-200">
                      <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
                      <div>
                        <p className="font-bold text-rose-100">Acceso bloqueado temporalmente</p>
                        <p>
                          Reintento disponible en{' '}
                          <span className="font-mono underline">{lockoutSeconds}s</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  {authError && lockoutSeconds === 0 && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-400/40 bg-rose-950/50 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || lockoutSeconds > 0}
                    className="relative w-full min-h-[48px] overflow-hidden rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] py-3.5 text-sm font-bold text-[#1A0E08] shadow-[0_12px_28px_-6px_rgba(229,174,78,0.45)] border border-[#FEF08A]/40 hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer" />
                    <span className="relative">{authLoading ? 'Verificando...' : 'Continuar'}</span>
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="filter2"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  onSubmit={handleFilter2Submit}
                  className="relative z-10 space-y-4 text-center"
                  autoComplete="off"
                >
                  {/* Rotating Combination Safe Dial with Graduated Perimeter Scale */}
                  <div className="relative mx-auto flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center">
                    <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full opacity-55">
                      <circle cx="60" cy="60" r="56" fill="none" stroke="#6B7280" strokeWidth="1" strokeDasharray="2 4" />
                    </svg>
                    <div className="absolute inset-2 rounded-full bg-gradient-to-b from-[#3A3E46] to-[#15171B] border-4 border-[#5C616C] shadow-[inset_0_4px_12px_rgba(0,0,0,0.9),0_12px_26px_rgba(0,0,0,0.7)]" />
                    <motion.div
                      animate={{ rotate: dialRotation }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="relative flex h-16 w-16 sm:h-[70px] sm:w-[70px] items-center justify-center rounded-full bg-gradient-to-br from-[#F4CA73] via-[#B47A24] to-[#6E450E] border-2 border-[#FEF08A]/60 shadow-lg"
                    >
                      <span className="absolute -top-1.5 h-3 w-1.5 rounded-full bg-[#FEF08A] shadow" />
                      <div className="h-9 w-9 rounded-full bg-[#191B20] border border-[#F4CA73]/45 flex items-center justify-center shadow-inner">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#F4CA73]" />
                      </div>
                    </motion.div>
                  </div>

                  <div>
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-wide">
                      Caja Fuerte · PIN
                    </h2>
                    <p className="text-xs text-[#A3A8B3] mt-0.5">
                      Marca la combinación numérica para ingresar a Métricas Ciprian.
                    </p>
                  </div>

                  {/* Recessed Steel LED Combination Screen */}
                  <div className="rounded-2xl border-2 border-[#383C44] bg-[#0B0C0E] px-3 sm:px-4 py-3 shadow-[inset_0_4px_14px_rgba(0,0,0,0.9)]">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                      {Array.from({ length: slotCount }).map((_, idx) => {
                        const filled = idx < pinInput.length;
                        return (
                          <motion.span
                            key={idx}
                            animate={filled ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                            transition={{ duration: 0.18 }}
                            className={`flex h-9 w-7 sm:w-8 items-center justify-center rounded-lg border font-mono text-lg sm:text-xl font-bold transition-colors ${
                              filled
                                ? 'border-[#F4CA73]/60 bg-[#23190B] text-[#F4CA73] shadow-[0_0_12px_rgba(244,202,115,0.35)]'
                                : 'border-[#2A2D34] bg-[#14161A] text-[#3B3F47]'
                            }`}
                          >
                            {filled ? '•' : '–'}
                          </motion.span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tactile Safe Numeric Keypad */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <motion.button
                        key={digit}
                        type="button"
                        disabled={lockoutSeconds > 0 || authLoading}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => {
                          setAuthError(null);
                          setPinInput((prev) => (prev.length < 12 ? prev + digit : prev));
                        }}
                        className="min-h-[48px] rounded-xl border border-[#454952] bg-gradient-to-b from-[#2E3138] to-[#202227] py-3 font-mono text-lg font-bold text-[#F3F4F6] shadow-[0_3px_0_#111215] hover:border-[#F4CA73]/50 hover:text-[#F4CA73] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
                      >
                        {digit}
                      </motion.button>
                    ))}

                    <motion.button
                      type="button"
                      disabled={lockoutSeconds > 0 || authLoading}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        setAuthError(null);
                        setPinInput('');
                      }}
                      className="min-h-[48px] rounded-xl border border-[#454952] bg-gradient-to-b from-[#272A30] to-[#1A1C20] py-3 text-xs font-bold uppercase tracking-wider text-[#B5BAC4] shadow-[0_3px_0_#111215] hover:text-white active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
                    >
                      Limpiar
                    </motion.button>

                    <motion.button
                      type="button"
                      disabled={lockoutSeconds > 0 || authLoading}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        setAuthError(null);
                        setPinInput((prev) => (prev.length < 12 ? prev + '0' : prev));
                      }}
                      className="min-h-[48px] rounded-xl border border-[#454952] bg-gradient-to-b from-[#2E3138] to-[#202227] py-3 font-mono text-lg font-bold text-[#F3F4F6] shadow-[0_3px_0_#111215] hover:border-[#F4CA73]/50 hover:text-[#F4CA73] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
                    >
                      0
                    </motion.button>

                    <motion.button
                      type="button"
                      disabled={lockoutSeconds > 0 || authLoading}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        setAuthError(null);
                        setPinInput((prev) => prev.slice(0, -1));
                      }}
                      aria-label="Borrar último dígito"
                      className="min-h-[48px] flex items-center justify-center rounded-xl border border-[#454952] bg-gradient-to-b from-[#272A30] to-[#1A1C20] py-3 text-[#B5BAC4] shadow-[0_3px_0_#111215] hover:text-white active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
                    >
                      <Delete className="h-5 w-5" />
                    </motion.button>
                  </div>

                  {authError && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-400/40 bg-rose-950/50 px-3.5 py-2.5 text-xs font-semibold text-rose-200 text-left">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || lockoutSeconds > 0 || pinInput.length < 4}
                    className="relative w-full min-h-[48px] overflow-hidden rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] py-3.5 text-sm font-bold text-[#1A0E08] shadow-[0_12px_28px_-6px_rgba(229,174,78,0.4)] border border-[#FEF08A]/40 hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-45"
                  >
                    <span className="relative">{authLoading ? 'Abriendo caja fuerte...' : 'Abrir Caja Fuerte'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreAuthToken(null);
                      setAuthError(null);
                      setPinInput('');
                      setSecurityStage('filter1_credentials');
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#9CA3AF] hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] pb-12 sm:pb-14 overflow-x-clip">
      <AutumnAtmosphere variant="dashboard" />

      <div className="relative z-10">
        <DashboardHeader
          settings={appState.settings}
          leads={appState.leads}
          activeTab={activeTab}
          syncMode={syncMode}
          userRole={userRole}
          onTabChange={setActiveTab}
          onJumpToPending={() => {
            setActiveTab('overview');
            setKpiFilter('pending');
          }}
          onLockNow={handleLockNow}
          onLogout={handleLockNow}
        />

        <main className="mx-auto max-w-6xl px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-5 sm:space-y-6">
          {userRole === 'caller' ? (
            <CallerProspectsView leads={appState.leads} />
          ) : (
            <>
              {activeTab === 'overview' && (
                <>
                  <KpiGrid
                    leads={appState.leads}
                    defaultTicketAmount={appState.settings.defaultTicketAmount}
                    activeFilter={kpiFilter}
                    onSelectFilter={setKpiFilter}
                    onOpenMasterReset={() => setMasterResetOpen(true)}
                    resetSuccessMessage={resetSuccessMessage}
                  />

                  <ProspectsManager
                    leads={appState.leads}
                    gifts={appState.gifts}
                    defaultTicketAmount={appState.settings.defaultTicketAmount}
                    activeFilter={kpiFilter}
                    onFilterChange={setKpiFilter}
                    onUpdateLead={handleUpdateLead}
                    onCreateManualLead={handleCreateManualLead}
                    onDeleteLead={handleDeleteLead}
                    onBusyChange={setProspectsBusy}
                  />
                </>
              )}

              {activeTab === 'gifts' && (
                <GiftsEditor
                  gifts={appState.gifts}
                  giftTheme={appState.settings.giftTheme}
                  customBoxColor={appState.settings.customBoxColor}
                  showcaseStyle={appState.settings.showcaseStyle}
                  randomizeGifts={appState.settings.randomizeGifts ?? true}
                  onUpdateGiftTheme={handleUpdateGiftTheme}
                  onUpdateShowcaseSettings={handleSaveSettings}
                  onCreateGift={handleCreateGift}
                  onUpdateGift={handleUpdateGift}
                  onSaveGiftProbabilities={handleSaveGiftProbabilities}
                  onDeleteGift={handleDeleteGift}
                  onResetGifts={handleResetGifts}
                  onBusyChange={setGiftsBusy}
                />
              )}

              {activeTab === 'qr' && (
                <QrStudioPanel
                  qrHistory={appState.qrHistory || []}
                  defaultUrl={window.location.origin + '/'}
                  onCreateQr={handleCreateQr}
                  onDeleteQr={handleDeleteQr}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPanel
                  settings={appState.settings}
                  onSaveSettings={handleSaveSettings}
                />
              )}
            </>
          )}
        </main>
      </div>

      {userRole === 'admin' && (
        <MasterResetModal
          open={masterResetOpen}
          onClose={() => setMasterResetOpen(false)}
          onConfirmReset={handleConfirmMasterReset}
        />
      )}
    </div>
  );
};
