import React, { useEffect, useState } from 'react';
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
import type { AppSettings, AppState, GiftThemeId, LeadCategory } from '../types/app';
import {
  createGift,
  createLead,
  deleteGift,
  deleteLead,
  DsbAuthError,
  fetchAppState,
  loginStep1,
  logoutDsbSession,
  resetDefaultGifts,
  updateGift,
  updateLead,
  updateSettings,
  verifyDsbSession,
  verifyPinStep2,
  type UpsertGiftPayload,
} from '../services/storeClient';
import { AutumnAtmosphere } from '../components/autumn/AutumnAtmosphere';
import { DashboardHeader, type DashboardTab } from '../components/dashboard/DashboardHeader';
import { KpiGrid, type KpiFilterKey } from '../components/dashboard/KpiGrid';
import { ProspectsManager } from '../components/dashboard/ProspectsManager';
import { GiftsEditor } from '../components/dashboard/GiftsEditor';
import { SettingsPanel } from '../components/dashboard/SettingsPanel';

interface DashboardPageProps {
  appState: AppState;
  syncMode: 'api' | 'local';
  onStateChange: (next: AppState) => void;
}

type SecurityStage = 'checking' | 'filter1_credentials' | 'filter2_pin' | 'authenticated';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  appState,
  syncMode,
  onStateChange,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey>('all');

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

  // Check active session token on mount
  useEffect(() => {
    let cancelled = false;
    verifyDsbSession().then(async (res) => {
      if (cancelled) return;
      if (res.authenticated) {
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
  }, []);

  // Countdown timer when rate-limited / locked out
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutSeconds]);

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
      await verifyPinStep2(preAuthToken, code.trim());
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
        void submitPinCode(pinInput);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleLockNow = () => {
    logoutDsbSession();
    setPreAuthToken(null);
    setPasswordInput('');
    setPinInput('');
    setAuthError(null);
    onStateChange({ ...appState, leads: [] });
    setSecurityStage('filter1_credentials');
  };

  const handleUpdateLead = async (
    id: string,
    updates: {
      called?: boolean;
      category?: LeadCategory;
      orderAmount?: number | null;
      notes?: string;
    }
  ) => {
    const res = await updateLead(id, updates);
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
      notes: 'Registrado manualmente desde Métricas Cipriano.',
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

  if (securityStage !== 'authenticated') {
    const isFilter2 = securityStage === 'filter2_pin';
    const dialRotation = pinInput.length * 45;
    const slotCount = Math.max(4, pinInput.length);

    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <AutumnAtmosphere variant="dashboard" />

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={`relative z-10 w-full max-w-md overflow-hidden rounded-[28px] sm:rounded-[32px] text-[#FFFDF9] shadow-[0_28px_60px_-15px_rgba(15,10,8,0.8)] p-5 sm:p-8 ${
            isFilter2
              ? 'bg-gradient-to-b from-[#23252A] via-[#191B1F] to-[#121316] border-2 border-[#4B4F58]'
              : 'bg-[#1F120B] border border-[#C88A2B]/45'
          }`}
        >
          {/* Steel Corner Rivets for Vault Look */}
          {isFilter2 && (
            <>
              <span className="absolute top-3.5 left-3.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#8D939E] to-[#34373D] border border-black/50 shadow-inner" />
              <span className="absolute top-3.5 right-3.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#8D939E] to-[#34373D] border border-black/50 shadow-inner" />
              <span className="absolute bottom-3.5 left-3.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#8D939E] to-[#34373D] border border-black/50 shadow-inner" />
              <span className="absolute bottom-3.5 right-3.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#8D939E] to-[#34373D] border border-black/50 shadow-inner" />
            </>
          )}

          <AnimatePresence mode="wait">
            {securityStage === 'checking' ? (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center space-y-3"
              >
                <ShieldCheck className="h-10 w-10 text-[#F4CA73] mx-auto animate-pulse" />
                <p className="text-sm font-medium text-[#E8D5BE]">Verificando sesión...</p>
              </motion.div>
            ) : !isFilter2 ? (
              <motion.form
                key="filter1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleFilter1Submit}
                className="space-y-4"
                autoComplete="off"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4CA73]/15 border border-[#F4CA73]/40 text-[#F4CA73]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="font-serif text-xl font-bold text-white">Métricas Cipriano</h1>
                    <p className="text-xs text-[#CDB8A0]">Acceso administrativo · The Ciprian Company</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E8D5BE] mb-1">
                    Usuario
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-[#C88A2B] absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                      className="w-full rounded-xl border border-white/15 bg-black/35 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E8D5BE] mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-[#C88A2B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      disabled={lockoutSeconds > 0}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setAuthError(null);
                      }}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-white/15 bg-black/35 pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {lockoutSeconds > 0 && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/50 bg-rose-950/70 px-3.5 py-3 text-xs font-semibold text-rose-200">
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
                  <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/50 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading || lockoutSeconds > 0}
                  className="w-full rounded-full bg-gradient-to-r from-[#D4942A] via-[#F4CA73] to-[#C88A2B] py-3.5 text-sm font-bold text-[#1E110A] shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? 'Verificando...' : 'Continuar'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="filter2"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onSubmit={handleFilter2Submit}
                className="space-y-4 text-center"
                autoComplete="off"
              >
                {/* Rotating Combination Safe Dial */}
                <div className="relative mx-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#3A3E46] to-[#17191D] border-4 border-[#5C616C] shadow-[inset_0_3px_10px_rgba(0,0,0,0.85),0_10px_24px_rgba(0,0,0,0.65)]" />
                  <motion.div
                    animate={{ rotate: dialRotation }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#E5AE4E] via-[#B47A24] to-[#6E450E] border-2 border-[#FEF08A]/50 shadow-lg"
                  >
                    {/* Dial notch & spokes */}
                    <span className="absolute -top-1.5 h-2.5 w-1.5 rounded-full bg-[#FEF08A] shadow" />
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-[#1C1E22] border border-[#F4CA73]/40 flex items-center justify-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#F4CA73]" />
                    </div>
                  </motion.div>
                </div>

                <div>
                  <h2 className="font-serif text-xl font-bold text-white tracking-wide">
                    Caja Fuerte · PIN
                  </h2>
                  <p className="text-xs text-[#A3A8B3] mt-0.5">
                    Marca la combinación numérica para abrir el panel.
                  </p>
                </div>

                {/* Recessed Steel LED Combination Screen */}
                <div className="rounded-2xl border-2 border-[#383C44] bg-[#0B0C0E] px-4 py-3.5 shadow-[inset_0_4px_14px_rgba(0,0,0,0.9)]">
                  <div className="flex items-center justify-center gap-3">
                    {Array.from({ length: slotCount }).map((_, idx) => {
                      const filled = idx < pinInput.length;
                      return (
                        <motion.span
                          key={idx}
                          animate={filled ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                          transition={{ duration: 0.18 }}
                          className={`flex h-9 w-8 items-center justify-center rounded-lg border font-mono text-xl font-bold transition-colors ${
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
                <div className="grid grid-cols-3 gap-2.5 pt-1">
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
                      className="rounded-xl border border-[#454952] bg-gradient-to-b from-[#2E3138] to-[#202227] py-3 font-mono text-lg font-bold text-[#F3F4F6] shadow-[0_3px_0_#111215] hover:border-[#F4CA73]/50 hover:text-[#F4CA73] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
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
                    className="rounded-xl border border-[#454952] bg-gradient-to-b from-[#272A30] to-[#1A1C20] py-3 text-xs font-bold uppercase tracking-wider text-[#B5BAC4] shadow-[0_3px_0_#111215] hover:text-white active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
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
                    className="rounded-xl border border-[#454952] bg-gradient-to-b from-[#2E3138] to-[#202227] py-3 font-mono text-lg font-bold text-[#F3F4F6] shadow-[0_3px_0_#111215] hover:border-[#F4CA73]/50 hover:text-[#F4CA73] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
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
                    className="flex items-center justify-center rounded-xl border border-[#454952] bg-gradient-to-b from-[#272A30] to-[#1A1C20] py-3 text-[#B5BAC4] shadow-[0_3px_0_#111215] hover:text-white active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
                  >
                    <Delete className="h-5 w-5" />
                  </motion.button>
                </div>

                {authError && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/50 px-3.5 py-2.5 text-xs font-semibold text-rose-200 text-left">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading || lockoutSeconds > 0 || pinInput.length < 4}
                  className="w-full rounded-full bg-gradient-to-r from-[#D4942A] via-[#F4CA73] to-[#C88A2B] py-3.5 text-sm font-bold text-[#1E110A] shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-45"
                >
                  {authLoading ? 'Abriendo caja fuerte...' : 'Abrir Caja Fuerte'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreAuthToken(null);
                    setAuthError(null);
                    setPinInput('');
                    setSecurityStage('filter1_credentials');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-14">
      <AutumnAtmosphere variant="dashboard" />

      <div className="relative z-10">
        <DashboardHeader
          settings={appState.settings}
          leads={appState.leads}
          activeTab={activeTab}
          syncMode={syncMode}
          onTabChange={setActiveTab}
          onJumpToPending={() => {
            setActiveTab('overview');
            setKpiFilter('pending');
          }}
          onLockNow={handleLockNow}
        />

        <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              <KpiGrid
                leads={appState.leads}
                defaultTicketAmount={appState.settings.defaultTicketAmount}
                activeFilter={kpiFilter}
                onSelectFilter={setKpiFilter}
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
              />
            </>
          )}

          {activeTab === 'gifts' && (
            <GiftsEditor
              gifts={appState.gifts}
              giftTheme={appState.settings.giftTheme}
              customBoxColor={appState.settings.customBoxColor}
              onUpdateGiftTheme={handleUpdateGiftTheme}
              onCreateGift={handleCreateGift}
              onUpdateGift={handleUpdateGift}
              onDeleteGift={handleDeleteGift}
              onResetGifts={handleResetGifts}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel settings={appState.settings} onSaveSettings={handleSaveSettings} />
          )}
        </main>
      </div>
    </div>
  );
};
