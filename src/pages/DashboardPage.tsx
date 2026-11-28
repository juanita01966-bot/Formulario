import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Delete,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react';
import type {
  AppSettings,
  AppState,
  GiftThemeId,
  AiSecurityQuestionChallenge,
  QrStyleId,
  ReferralPrizeRule,
  SecurityAlertStatus,
  UserAccount,
  UserRole,
} from '../types/app';
import {
  bulkUpdateSecurityAlerts,
  createAccount,
  createGift,
  createLead,
  createQrCode,
  deleteAccount,
  deleteGift,
  deleteLead,
  deleteQrCode,
  deleteReferralPartner,
  DSB_SESSION_REVOKED_EVENT,
  DsbAuthError,
  fetchAccounts,
  fetchAppState,
  loginStep1,
  logoutDsbSession,
  resetAllWorkspaceData,
  resetDefaultGifts,
  updateAccount,
  updateAccountPassword,
  updateAdminAccountPassword,
  updateGift,
  updateGiftProbabilities,
  updateLead,
  updateReferralPartner,
  updateSecurityAlertStatus,
  updateSettings,
  verifyDsbSession,
  verifyPinStep2,
  verifySecurityQuestionStep2,
  type CreateAccountPayload,
  type CreateQrPayload,
  type UpdateAccountPasswordPayload,
  type UpdateAccountPayload,
  type UpdateAdminAccountPasswordPayload,
  type UpdateReferralPayload,
  type UpsertGiftPayload,
} from '../services/storeClient';
import { DashboardBackdrop } from '../components/dashboard/DashboardBackdrop';
import { RoleEmblemBadge, RoleSymbolSvg } from '../components/dashboard/RoleEmblem';
import { getRoleTheme } from '../components/dashboard/roleTheme';
import {
  readSavedSurfaceTheme,
  saveSurfaceTheme,
  type DashboardSurfaceTheme,
} from '../components/dashboard/surfaceTheme';
import {
  DashboardHeader,
  type DashboardSessionUser,
  type DashboardTab,
} from '../components/dashboard/DashboardHeader';
import { KpiGrid, type KpiFilterKey } from '../components/dashboard/KpiGrid';
import {
  MetricsFilterBar,
  isTimestampInRange,
  resolveDateBounds,
  type DatePreset,
} from '../components/dashboard/MetricsFilterBar';
import { ReposoProspectsSection } from '../components/dashboard/ReposoProspectsSection';
import { ProspectsManager, type LeadUpdatePayload } from '../components/dashboard/ProspectsManager';
import { TelemarketingProspectsView } from '../components/dashboard/TelemarketingProspectsView';
import { GiftsEditor } from '../components/dashboard/GiftsEditor';
import { QrStudioPanel } from '../components/dashboard/QrStudioPanel';
import { EmbajadoresHubPanel } from '../components/dashboard/EmbajadoresHubPanel';
import { ReferralsLeaderboardPanel } from '../components/dashboard/ReferralsLeaderboardPanel';
import { AccountsManagerPanel } from '../components/dashboard/AccountsManagerPanel';
import { SettingsPanel } from '../components/dashboard/SettingsPanel';
import { SecurityCenterPanel } from '../components/dashboard/SecurityCenterPanel';
import { ActivityLogPanel } from '../components/dashboard/ActivityLogPanel';
import { MasterResetModal } from '../components/dashboard/MasterResetModal';
import { AiManagerPanel } from '../components/dashboard/AiManagerPanel';
import { setClientGuardEnabled } from '../utils/clientGuard';
import {
  buildReferralUrl,
  downloadReferralQrPng,
} from '../components/dashboard/referralQrExport';
import { AmbassadorAvatar } from '../components/shared/AmbassadorAvatar';
import { computeVendedorRollupMetrics } from '../utils/partnerMetrics';

interface DashboardPageProps {
  appState: AppState;
  syncMode: 'api' | 'local';
  onStateChange: (next: AppState) => void;
  onSyncPauseChange?: (paused: boolean) => void;
}

type SecurityStage =
  | 'checking'
  | 'filter1_credentials'
  | 'filter2_pin'
  | 'filter2_security_question'
  | 'authenticated';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  appState,
  onStateChange,
  onSyncPauseChange,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [referralsSubTab, setReferralsSubTab] = useState<'studio' | 'embajadores' | 'ranking'>('studio');
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey>('all');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<DashboardSessionUser | null>(null);
  const [accountsFallback, setAccountsFallback] = useState<UserAccount[]>([]);
  const [surfaceTheme, setSurfaceTheme] = useState<DashboardSurfaceTheme>(() =>
    readSavedSurfaceTheme()
  );

  const handleSurfaceThemeChange = (next: DashboardSurfaceTheme) => {
    setSurfaceTheme(next);
    saveSurfaceTheme(next);
  };

  // Global Overview / Vendedor Metrics Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ambassadorFilter, setAmbassadorFilter] = useState<string>('all');

  // Vendedor quick QR card UI state
  const [vendedorCopied, setVendedorCopied] = useState(false);
  const [vendedorDownloadingQr, setVendedorDownloadingQr] = useState(false);

  const [masterResetOpen, setMasterResetOpen] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [createAdminSignal, setCreateAdminSignal] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [prospectsBusy, setProspectsBusy] = useState(false);
  const [reposoBusy, setReposoBusy] = useState(false);
  const [giftsBusy, setGiftsBusy] = useState(false);
  const [referralsBusy, setReferralsBusy] = useState(false);
  const [accountsBusy, setAccountsBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);

  // Auth Gateway State (1FA for telemarketing/vendedor, 2FA + PIN for admin)
  const [securityStage, setSecurityStage] = useState<SecurityStage>('checking');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [securityChallenge, setSecurityChallenge] = useState<AiSecurityQuestionChallenge | null>(null);
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');
  const [showSecurityAnswer, setShowSecurityAnswer] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const pinInputRef = useRef(pinInput);
  pinInputRef.current = pinInput;

  const accounts = useMemo(
    () => (Array.isArray(appState.accounts) && appState.accounts.length > 0 ? appState.accounts : accountsFallback),
    [appState.accounts, accountsFallback]
  );

  const shouldPauseSync =
    securityStage !== 'authenticated' ||
    masterResetOpen ||
    prospectsBusy ||
    reposoBusy ||
    giftsBusy ||
    referralsBusy ||
    accountsBusy ||
    settingsBusy ||
    securityBusy;

  const isElevated = userRole === 'admin' || userRole === 'ai_manager';

  const securityAlerts = useMemo(
    () => (isElevated && Array.isArray(appState.securityAlerts) ? appState.securityAlerts : []),
    [isElevated, appState.securityAlerts]
  );

  // Keep client-side DevTools / context-menu security guard synced with live AI Manager process controls
  useEffect(() => {
    const enabled = appState.settings.processControls?.clientGuardEnabled ?? true;
    setClientGuardEnabled(enabled);
  }, [appState.settings.processControls?.clientGuardEnabled]);

  // Subtle floating "Volver arriba" button visibility when scrolled past 420px
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 420);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openSecurityAlertsCount = useMemo(
    () => securityAlerts.filter((a) => a.status === 'open').length,
    [securityAlerts]
  );

  const criticalSecurityAlertsCount = useMemo(
    () =>
      securityAlerts.filter(
        (a) => a.status === 'open' && (a.severity === 'critical' || a.severity === 'high')
      ).length,
    [securityAlerts]
  );

  useEffect(() => {
    onSyncPauseChange?.(shouldPauseSync);
    return () => onSyncPauseChange?.(false);
  }, [shouldPauseSync, onSyncPauseChange]);

  const hydrateAfterAuth = async (role: UserRole) => {
    const fresh = await fetchAppState();
    onStateChange(fresh.state);
    if (role === 'admin' || role === 'ai_manager') {
      if (Array.isArray(fresh.state.accounts) && fresh.state.accounts.length > 0) {
        setAccountsFallback(fresh.state.accounts);
      } else {
        try {
          const list = await fetchAccounts();
          setAccountsFallback(list);
        } catch {
          // Ignore secondary fetch error
        }
      }
    }
  };

  // Keep activeTab valid whenever role changes
  useEffect(() => {
    if (userRole === 'vendedor' && activeTab !== 'overview' && activeTab !== 'embajadores') {
      setActiveTab('overview');
    } else if (userRole === 'telemarketing' && activeTab !== 'overview') {
      setActiveTab('overview');
    } else if (userRole === 'admin' && activeTab === 'ai_control') {
      setActiveTab('overview');
    } else if ((userRole === 'admin' || userRole === 'ai_manager') && activeTab === 'embajadores') {
      setActiveTab('referrals');
      setReferralsSubTab('embajadores');
    }
  }, [userRole, activeTab]);

  // Check active session token on mount
  useEffect(() => {
    let cancelled = false;
    verifyDsbSession().then(async (res) => {
      if (cancelled) return;
      if (res.authenticated) {
        const resolvedRole: UserRole = res.role || 'admin';
        setUserRole(resolvedRole);
        setActiveTab(resolvedRole === 'ai_manager' ? 'ai_control' : 'overview');
        setAmbassadorFilter('all');
        setCurrentUser({
          userId: res.userId,
          username: res.username,
          displayName: res.displayName,
          tag: res.tag,
          avatarUrl: res.avatarUrl ?? null,
          role: resolvedRole,
        });
        setSecurityStage('authenticated');
        try {
          const fresh = await fetchAppState();
          if (!cancelled) {
            onStateChange(fresh.state);
            if (resolvedRole === 'admin' || resolvedRole === 'ai_manager') {
              if (Array.isArray(fresh.state.accounts) && fresh.state.accounts.length > 0) {
                setAccountsFallback(fresh.state.accounts);
              } else {
                const list = await fetchAccounts().catch(() => []);
                if (!cancelled && list.length > 0) setAccountsFallback(list);
              }
            }
          }
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

  // Instant session expulsion when backend returns 401 SESSION_REVOKED
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSessionRevoked = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setCurrentUser(null);
      setPreAuthToken(null);
      setSecurityChallenge(null);
      setPinInput('');
      setSecurityAnswerInput('');
      setPasswordInput('');
      setAuthLoading(false);
      setLockoutSeconds(0);
      setAuthError(detail?.message || 'Tu sesión fue cerrada por un administrador.');
      setSecurityStage('filter1_credentials');
    };
    window.addEventListener(DSB_SESSION_REVOKED_EVENT, handleSessionRevoked);
    return () => {
      window.removeEventListener(DSB_SESSION_REVOKED_EVENT, handleSessionRevoked);
    };
  }, []);

  // Expel if sessionStorage is cleared from another context on the same origin
  useEffect(() => {
    if (typeof window === 'undefined' || securityStage !== 'authenticated') return;
    const handleStorage = (event: StorageEvent) => {
      if (
        event.storageArea === window.sessionStorage &&
        (event.key === null || (event.key === 'cipriano_dsb_session_token' && !event.newValue))
      ) {
        setCurrentUser(null);
        setPreAuthToken(null);
        setSecurityChallenge(null);
        setPinInput('');
        setSecurityAnswerInput('');
        setPasswordInput('');
        setAuthError('Tu sesión fue cerrada.');
        setSecurityStage('filter1_credentials');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [securityStage]);

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
      const resolvedRole: UserRole = res.role || 'admin';
      setUserRole(resolvedRole);
      setCurrentUser({
        userId: res.userId,
        username: res.username,
        displayName: res.displayName,
        tag: res.tag,
        avatarUrl: res.avatarUrl ?? null,
        role: resolvedRole,
      });
      setAuthError(null);

      if (res.requiresSecurityQuestion && res.securityChallenge) {
        setPreAuthToken(res.preAuthToken || null);
        setSecurityChallenge(res.securityChallenge);
        setSecurityAnswerInput('');
        setShowSecurityAnswer(false);
        setPinInput('');
        setSecurityStage('filter2_security_question');
        return;
      }

      if (!res.requiresPin) {
        // Telemarketing & Vendedor authenticate directly (1FA) without PIN screen
        setActiveTab(resolvedRole === 'ai_manager' ? 'ai_control' : 'overview');
        setAmbassadorFilter('all');
        setKpiFilter('all');
        setPreAuthToken(null);
        setSecurityChallenge(null);
        setSecurityAnswerInput('');
        setPasswordInput('');
        setPinInput('');
        await hydrateAfterAuth(resolvedRole);
        setSecurityStage('authenticated');
        return;
      }

      setPreAuthToken(res.preAuthToken || null);
      setSecurityChallenge(null);
      setPinInput('');
      setSecurityStage('filter2_pin');
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setAuthError(err.message);
        if (err.locked && err.retryAfterSeconds > 0) {
          setLockoutSeconds(err.retryAfterSeconds);
        }
      } else {
        setAuthError(
          err instanceof Error && err.message
            ? err.message
            : 'Error de conexión con el módulo de seguridad.'
        );
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
      const resolvedRole: UserRole = step2Res.role || 'admin';
      setUserRole(resolvedRole);
      setCurrentUser({
        userId: step2Res.userId,
        username: step2Res.username,
        displayName: step2Res.displayName,
        tag: step2Res.tag,
        avatarUrl: step2Res.avatarUrl ?? null,
        role: resolvedRole,
      });
      setAuthError(null);
      setActiveTab('overview');
      setAmbassadorFilter('all');
      setKpiFilter('all');
      setPasswordInput('');
      setPinInput('');
      setPreAuthToken(null);
      await hydrateAfterAuth(resolvedRole);
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

  const handleSecurityQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || authLoading || !preAuthToken) return;
    setAuthError(null);

    const cleanAnswer = securityAnswerInput.trim();
    if (!cleanAnswer) {
      setAuthError('Ingresa tu respuesta de seguridad para desbloquear el Centro AI.');
      return;
    }

    setAuthLoading(true);
    try {
      const step2Res = await verifySecurityQuestionStep2(preAuthToken, cleanAnswer);
      const resolvedRole: UserRole = step2Res.role || 'ai_manager';
      setUserRole(resolvedRole);
      setCurrentUser({
        userId: step2Res.userId,
        username: step2Res.username,
        displayName: step2Res.displayName,
        tag: step2Res.tag,
        avatarUrl: step2Res.avatarUrl ?? null,
        role: resolvedRole,
      });
      setAuthError(null);
      setActiveTab('ai_control');
      setAmbassadorFilter('all');
      setKpiFilter('all');
      setPasswordInput('');
      setPinInput('');
      setSecurityAnswerInput('');
      setShowSecurityAnswer(false);
      setSecurityChallenge(null);
      setPreAuthToken(null);
      await hydrateAfterAuth(resolvedRole);
      setSecurityStage('authenticated');
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setAuthError(err.message);
        setSecurityAnswerInput('');
        if (err.locked && err.retryAfterSeconds > 0) {
          setLockoutSeconds(err.retryAfterSeconds);
        }
        if (err.expiredFirstFactor) {
          setPreAuthToken(null);
          setSecurityChallenge(null);
          setSecurityStage('filter1_credentials');
        }
      } else {
        setAuthError('No se pudo verificar la respuesta de seguridad.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const submitPinCodeRef = useRef(submitPinCode);
  submitPinCodeRef.current = submitPinCode;

  // Physical keyboard support while on the Admin Safe / Vault PIN screen
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
    setCurrentUser(null);
    setAccountsFallback([]);
    setActiveTab('overview');
    setKpiFilter('all');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setAmbassadorFilter('all');
    setPreAuthToken(null);
    setPasswordInput('');
    setPinInput('');
    setAuthError(null);
    onStateChange({
      ...appState,
      leads: [],
      qrHistory: [],
      referrers: [],
      accounts: [],
      visitLog: [],
      securityAlerts: [],
      activityLogs: [],
    });
    setSecurityStage('filter1_credentials');
  };

  // Filtered Leads for Overview (Admin) and Vendedor View
  const dateBounds = useMemo(
    () => resolveDateBounds(datePreset, dateFrom, dateTo),
    [datePreset, dateFrom, dateTo]
  );

  const referrerById = useMemo(() => {
    const map = new Map<string, (NonNullable<AppState['referrers']>)[number]>();
    for (const r of appState.referrers ?? []) {
      map.set(r.id, r);
    }
    return map;
  }, [appState.referrers]);

  const referrerByCode = useMemo(() => {
    const map = new Map<string, (NonNullable<AppState['referrers']>)[number]>();
    for (const r of appState.referrers ?? []) {
      map.set(r.code.trim().toUpperCase(), r);
    }
    return map;
  }, [appState.referrers]);

  const vendedorAccountByTag = useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const acc of accounts) {
      if (acc.role !== 'vendedor') continue;
      map.set(acc.tag.trim().toUpperCase(), acc);
    }
    return map;
  }, [accounts]);

  const vendedorTag = (currentUser?.tag || '').trim().toUpperCase();

  const vendedorOwnedEmbajadores = useMemo(() => {
    if (userRole !== 'vendedor') return [];
    const myId = currentUser?.userId || '';
    return (appState.referrers ?? []).filter((r) => {
      if (r.partnerType !== 'embajador') return false;
      if (myId && r.ownerVendedorAccountId === myId) return true;
      if (vendedorTag && (r.ownerVendedorTag || '').trim().toUpperCase() === vendedorTag) return true;
      if (!r.ownerVendedorAccountId && !r.ownerVendedorTag && r.code.trim().toUpperCase() !== vendedorTag) {
        return true;
      }
      return false;
    });
  }, [userRole, appState.referrers, currentUser?.userId, vendedorTag]);

  const matchesChannelFilter = useMemo(() => {
    const referrersList = appState.referrers ?? [];
    return (referrerId?: string | null, referralCode?: string | null, isVisit = false): boolean => {
      if (ambassadorFilter === 'all') return true;

      const matchedPartner =
        (referrerId ? referrerById.get(referrerId) : undefined) ||
        (referralCode ? referrerByCode.get(referralCode.trim().toUpperCase()) : undefined);
      const itemCode =
        (referralCode || '').trim().toUpperCase() ||
        (matchedPartner ? matchedPartner.code.trim().toUpperCase() : '');

      if (userRole === 'vendedor') {
        if (ambassadorFilter === 'direct') {
          if (matchedPartner?.partnerType === 'embajador') return false;
          if (vendedorTag) {
            return (
              itemCode === vendedorTag ||
              (Boolean(currentUser?.userId) && matchedPartner?.accountId === currentUser?.userId)
            );
          }
          return true;
        }
        if (ambassadorFilter.startsWith('tag:')) {
          const targetCode = ambassadorFilter.slice('tag:'.length).trim().toUpperCase();
          const targetPartner = referrerByCode.get(targetCode);
          return (
            itemCode === targetCode ||
            (Boolean(targetPartner) && Boolean(referrerId) && referrerId === targetPartner!.id)
          );
        }
        return true;
      }

      if (!isElevated) return true;

      if (ambassadorFilter === 'organic') {
        if (isVisit) return false;
        return !itemCode && !matchedPartner;
      }

      if (ambassadorFilter.startsWith('tag:')) {
        const targetCode = ambassadorFilter.slice('tag:'.length).trim().toUpperCase();
        const targetPartner = referrerByCode.get(targetCode);

        // Filtering by a specific Embajador → only leads/visits from that Embajador
        if (targetPartner?.partnerType === 'embajador') {
          return (
            itemCode === targetCode ||
            (Boolean(referrerId) && referrerId === targetPartner.id)
          );
        }

        // Filtering by a Vendedor → include BOTH direct Vendedor leads AND owned Embajadores
        const matchedVendedorAccount = vendedorAccountByTag.get(targetCode);
        const vendedorAccountId = matchedVendedorAccount?.id || targetPartner?.accountId || null;

        const allowedCodes = new Set<string>([targetCode]);
        const allowedPartnerIds = new Set<string>();
        if (targetPartner?.id) allowedPartnerIds.add(targetPartner.id);
        if (matchedVendedorAccount?.referrerId) allowedPartnerIds.add(matchedVendedorAccount.referrerId);

        for (const r of referrersList) {
          if (r.partnerType !== 'embajador') continue;
          const ownerTagUpper = (r.ownerVendedorTag || '').trim().toUpperCase();
          const ownedByAccount =
            Boolean(vendedorAccountId) && r.ownerVendedorAccountId === vendedorAccountId;
          const ownedByTag = Boolean(ownerTagUpper) && ownerTagUpper === targetCode;
          if (ownedByAccount || ownedByTag) {
            allowedCodes.add(r.code.trim().toUpperCase());
            allowedPartnerIds.add(r.id);
          }
        }

        if (itemCode && allowedCodes.has(itemCode)) return true;
        if (referrerId && allowedPartnerIds.has(referrerId)) return true;
        return false;
      }

      return true;
    };
  }, [
    ambassadorFilter,
    userRole,
    appState.referrers,
    referrerById,
    referrerByCode,
    vendedorAccountByTag,
    vendedorTag,
    currentUser?.userId,
  ]);

  const filteredLeads = useMemo(() => {
    return appState.leads.filter((lead) => {
      if (!isTimestampInRange(lead.createdAt, dateBounds)) return false;
      return matchesChannelFilter(lead.referrerId, lead.referralCode, false);
    });
  }, [appState.leads, dateBounds, matchesChannelFilter]);

  const handleClearGlobalFilters = () => {
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setAmbassadorFilter('all');
  };

  // Mutation Handlers
  const handleUpdateLead = async (id: string, updates: LeadUpdatePayload) => {
    const res = await updateLead(id, updates);
    onStateChange(res.state);
  };

  const handleCreateManualLead = async (payload: {
    name: string;
    phone: string;
    address: string;
    giftId: string;
    referrerId?: string | null;
    referralCode?: string | null;
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
      referrerId: payload.referrerId || null,
      referralCode: payload.referralCode || null,
      notes: 'Registrado manualmente desde Dashboard Operativo.',
    });
    onStateChange(res.state);
  };

  const handleDeleteLead = async (id: string) => {
    const next = await deleteLead(id);
    onStateChange(next);
  };

  const handleCreateGift = async (payload: UpsertGiftPayload, masterPassword: string) => {
    const res = await createGift(payload, masterPassword);
    onStateChange(res.state);
  };

  const handleUpdateGift = async (
    id: string,
    updates: Partial<UpsertGiftPayload>,
    masterPassword: string
  ) => {
    const res = await updateGift(id, updates, masterPassword);
    onStateChange(res.state);
  };

  const handleSaveGiftProbabilities = async (
    updates: Array<{ id: string; probability: number }>,
    masterPassword: string
  ) => {
    if (updates.length === 0) return;
    const res = await updateGiftProbabilities(updates, masterPassword);
    onStateChange(res.state);
  };

  const handleDeleteGift = async (id: string, masterPassword: string) => {
    const next = await deleteGift(id, masterPassword);
    onStateChange(next);
  };

  const handleResetGifts = async (masterPassword: string) => {
    const next = await resetDefaultGifts(masterPassword);
    onStateChange(next);
  };

  const handleSaveSettings = async (updates: Partial<AppSettings>, masterPassword: string) => {
    const next = await updateSettings(updates, masterPassword);
    onStateChange(next);
  };

  const handleUpdateGiftTheme = async (
    giftTheme: GiftThemeId,
    customBoxColor: string | undefined,
    masterPassword: string
  ) => {
    const next = await updateSettings(
      {
        giftTheme,
        customBoxColor: customBoxColor || appState.settings.customBoxColor || '#B84A27',
      },
      masterPassword
    );
    onStateChange(next);
  };

  const handleUpdateReferralPartner = async (
    id: string,
    updates: UpdateReferralPayload,
    masterPassword: string
  ) => {
    const res = await updateReferralPartner(id, updates, masterPassword);
    onStateChange(res.state);
  };

  const handleDeleteReferralPartner = async (id: string, masterPassword: string) => {
    const res = await deleteReferralPartner(id, masterPassword);
    onStateChange(res.state);
  };

  const handleSaveReferralPrizeRule = async (
    referralPrizeRule: ReferralPrizeRule,
    masterPassword: string
  ) => {
    const next = await updateSettings({ referralPrizeRule }, masterPassword);
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

  const handleCreateAccount = async (payload: CreateAccountPayload) => {
    const res = await createAccount(payload);
    setAccountsFallback(res.accounts);
    onStateChange(res.state);
  };

  const handleUpdateAccount = async (id: string, payload: UpdateAccountPayload) => {
    const res = await updateAccount(id, payload);
    setAccountsFallback(res.accounts);
    onStateChange(res.state);
  };

  const handleUpdateAccountPassword = async (
    id: string,
    payload: UpdateAccountPasswordPayload
  ): Promise<string> => {
    const res = await updateAccountPassword(id, payload);
    return res.message;
  };

  const handleUpdateAdminAccountPassword = async (
    id: string,
    payload: UpdateAdminAccountPasswordPayload
  ): Promise<string> => {
    const res = await updateAdminAccountPassword(id, payload);
    return res.message;
  };

  const handleDeleteAccount = async (id: string, masterPassword: string) => {
    const res = await deleteAccount(id, masterPassword);
    setAccountsFallback(res.accounts);
    onStateChange(res.state);
  };

  const handleUpdateSecurityAlertStatus = async (
    id: string,
    status: SecurityAlertStatus,
    reviewNote?: string
  ) => {
    const res = await updateSecurityAlertStatus(id, status, reviewNote);
    onStateChange(res.state);
  };

  const handleBulkSecurityAlertsAction = async (
    action: 'mark_all_reviewed' | 'clear_resolved'
  ) => {
    const res = await bulkUpdateSecurityAlerts(action);
    onStateChange(res.state);
  };

  const handleJumpToLeadFromSecurity = (_leadId: string) => {
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setAmbassadorFilter('all');
    setKpiFilter('all');
    setActiveTab('overview');
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

  const defaultOriginUrl = `${window.location.origin}/`;

  // Vendedor Personal QR helpers
  const vendedorPartner = useMemo(() => {
    if (userRole !== 'vendedor' || !vendedorTag) return null;
    return (
      (appState.referrers ?? []).find(
        (r) =>
          r.partnerType !== 'embajador' &&
          ((currentUser?.userId && r.accountId === currentUser.userId) ||
            r.code.trim().toUpperCase() === vendedorTag)
      ) || null
    );
  }, [userRole, vendedorTag, appState.referrers, currentUser?.userId]);

  const vendedorUrl = vendedorTag ? buildReferralUrl(defaultOriginUrl, vendedorTag) : defaultOriginUrl;
  const effectiveVendedorAvatarUrl = currentUser?.avatarUrl ?? vendedorPartner?.avatarUrl ?? null;

  const vendedorRollup = useMemo(() => {
    if (userRole !== 'vendedor') return null;
    return computeVendedorRollupMetrics(
      {
        accountId: currentUser?.userId ?? null,
        partnerId: vendedorPartner?.id ?? null,
        name: currentUser?.displayName || currentUser?.username || vendedorTag || 'Vendedor',
        tag: vendedorTag,
        avatarUrl: effectiveVendedorAvatarUrl,
        active: vendedorPartner?.active ?? true,
        partner: vendedorPartner,
      },
      appState.referrers ?? [],
      appState.leads,
      appState.qrHistory ?? [],
      appState.visitLog ?? [],
      false,
      accounts,
      appState.settings.defaultTicketAmount
    );
  }, [
    userRole,
    currentUser?.userId,
    currentUser?.displayName,
    currentUser?.username,
    vendedorTag,
    effectiveVendedorAvatarUrl,
    vendedorPartner,
    appState.referrers,
    appState.leads,
    appState.qrHistory,
    appState.visitLog,
    accounts,
    appState.settings.defaultTicketAmount,
  ]);

  const headerUser = useMemo<DashboardSessionUser | null>(() => {
    if (!currentUser) return null;
    if (userRole === 'vendedor') {
      return { ...currentUser, avatarUrl: effectiveVendedorAvatarUrl };
    }
    return currentUser;
  }, [currentUser, userRole, effectiveVendedorAvatarUrl]);

  const handleCopyVendedorUrl = async () => {
    try {
      await navigator.clipboard.writeText(vendedorUrl);
      setVendedorCopied(true);
      window.setTimeout(() => setVendedorCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleDownloadVendedorQr = async () => {
    if (!vendedorTag || vendedorDownloadingQr) return;
    setVendedorDownloadingQr(true);
    try {
      await downloadReferralQrPng({
        partnerName: currentUser?.displayName || currentUser?.username || vendedorTag,
        code: vendedorTag,
        referralUrl: vendedorUrl,
        avatarUrl: effectiveVendedorAvatarUrl,
        styleId: (vendedorPartner?.qrStyleId || 'classic-gold') as QrStyleId,
      });
    } catch {
      // Ignore export error
    } finally {
      setVendedorDownloadingQr(false);
    }
  };

  if (securityStage !== 'authenticated') {
    const isFilter2 = securityStage === 'filter2_pin';
    const isAiChallenge = securityStage === 'filter2_security_question';
    const dialRotation = pinInput.length * 45;
    const slotCount = Math.max(4, pinInput.length);

    return (
      <div
        className="relative min-h-[100dvh] flex items-center justify-center px-3 sm:px-4 py-4 sm:py-10 overflow-x-hidden dsb-theme-root"
        data-dsb-surface={surfaceTheme}
      >
        <DashboardBackdrop
          role={isAiChallenge ? 'ai_manager' : isFilter2 ? 'admin' : 'gateway'}
          stage={isAiChallenge ? 'filter2_pin' : securityStage}
          surfaceTheme={surfaceTheme}
        />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[440px]"
        >
          {/* Ambient halo behind entrance gateway / Imperial Gold AI Vault / Crimson Admin Vault */}
          <div
            className={`pointer-events-none hidden sm:block -inset-2 absolute rounded-[40px] blur-2xl transition-all duration-500 ${
              isAiChallenge
                ? 'bg-gradient-to-br from-[#D4A437]/40 via-[#F7DC88]/22 to-[#1A1305]/55 opacity-95'
                : isFilter2
                  ? 'bg-gradient-to-br from-[#5C0A17]/34 via-[#C8A24A]/18 to-[#121015]/50 opacity-85'
                  : 'bg-gradient-to-br from-[#D4AF37]/16 via-[#E6C677]/12 to-[#121015]/32 opacity-75'
            }`}
          />

          <div
            data-preserve-surface="true"
            className={`relative overflow-hidden rounded-[24px] sm:rounded-[34px] text-[#F5F2EB] backdrop-blur-2xl p-4 sm:p-8 transition-all duration-500 ${
              isAiChallenge
                ? 'bg-[#171105]/92 border border-[#F5D67B]/48 shadow-[0_32px_74px_-16px_rgba(0,0,0,0.85),0_12px_36px_-10px_rgba(200,150,46,0.45),inset_0_1px_0_rgba(255,244,200,0.34)]'
                : isFilter2
                  ? 'bg-[#140E12]/90 border border-[#C8A24A]/34 shadow-[0_30px_70px_-18px_rgba(0,0,0,0.82),0_10px_30px_-12px_rgba(92,10,23,0.44),inset_0_1px_0_rgba(230,198,119,0.22)]'
                  : 'bg-[#121015]/88 border border-[#D4AF37]/28 shadow-[0_32px_72px_-18px_rgba(0,0,0,0.78),0_10px_28px_-12px_rgba(212,175,55,0.14),inset_0_1px_0_rgba(255,255,255,0.14)]'
            }`}
          >
            {/* Top sculpted luxury foil hairline */}
            <div
              className={`absolute inset-x-0 top-0 h-[2px] ${
                isAiChallenge
                  ? 'bg-gradient-to-r from-[#5A3B08] via-[#F7DC88] to-[#5A3B08] opacity-100'
                  : isFilter2
                    ? 'bg-gradient-to-r from-[#5C0A17] via-[#C8A24A] to-[#5C0A17] opacity-95'
                    : 'bg-gradient-to-r from-transparent via-[#E6C677] to-transparent opacity-90'
              }`}
            />

            {/* Architectural hairline inner frame */}
            <div
              className={`pointer-events-none absolute inset-2 sm:inset-2.5 rounded-[18px] sm:rounded-[26px] border ${
                isAiChallenge
                  ? 'border-[#F5D67B]/26'
                  : isFilter2
                    ? 'border-[#C8A24A]/16'
                    : 'border-[#E6C677]/12'
              }`}
            />

            {/* Soft top light sheen */}
            <div
              className={`pointer-events-none absolute inset-0 ${
                isAiChallenge
                  ? 'bg-[radial-gradient(ellipse_at_top,_rgba(247,220,136,0.20),_transparent_58%)]'
                  : isFilter2
                    ? 'bg-[radial-gradient(ellipse_at_top,_rgba(200,162,74,0.13),_transparent_56%)]'
                    : 'bg-[radial-gradient(ellipse_at_top,_rgba(230,198,119,0.11),_transparent_56%)]'
              }`}
            />

            {/* Brushed Gold / Champagne Titanium Corner Rivets on Step 2 Vaults */}
            {(isFilter2 || isAiChallenge) && (
              <>
                <span className="pointer-events-none absolute top-3.5 left-3.5 sm:top-4 sm:left-4 h-2 w-2 rounded-full bg-gradient-to-br from-[#F7DC88] via-[#C8962E] to-[#3B2F1D] border border-black/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]" />
                <span className="pointer-events-none absolute top-3.5 right-3.5 sm:top-4 sm:right-4 h-2 w-2 rounded-full bg-gradient-to-br from-[#F7DC88] via-[#C8962E] to-[#3B2F1D] border border-black/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]" />
                <span className="pointer-events-none absolute bottom-3.5 left-3.5 sm:bottom-4 sm:left-4 h-2 w-2 rounded-full bg-gradient-to-br from-[#F7DC88] via-[#C8962E] to-[#3B2F1D] border border-black/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]" />
                <span className="pointer-events-none absolute bottom-3.5 right-3.5 sm:bottom-4 sm:right-4 h-2 w-2 rounded-full bg-gradient-to-br from-[#F7DC88] via-[#C8962E] to-[#3B2F1D] border border-black/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]" />
              </>
            )}

            <AnimatePresence mode="wait">
              {securityStage === 'checking' ? (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-10 py-10 sm:py-14 text-center space-y-3.5 sm:space-y-4"
                >
                  <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10">
                    <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8 text-[#E2C275] animate-pulse" />
                  </div>
                  <p className="font-serif text-base font-medium text-[#D5CFC4]">
                    Verificando sesión...
                  </p>
                </motion.div>
              ) : !isFilter2 && !isAiChallenge ? (
                <motion.form
                  key="filter1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleFilter1Submit}
                  className="relative z-10 space-y-4 sm:space-y-5"
                  autoComplete="off"
                >
                  {/* Executive Medallion Header */}
                  <div className="text-center space-y-2 sm:space-y-3">
                    <div className="relative mx-auto w-fit">
                      <div className="flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-full p-[2.5px] bg-gradient-to-br from-[#F3DFAD] via-[#D4AF37] to-[#876424] shadow-[0_14px_34px_rgba(0,0,0,0.58),0_0_24px_rgba(212,175,55,0.16)]">
                        <div className="h-full w-full rounded-full overflow-hidden bg-[#121015]">
                          <img
                            src="/images/logo%20ciprian.png"
                            alt="The Ciprian Company"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#E9CA7A] to-[#A67C2E] text-[#17120A] ring-2 ring-[#121015] shadow-md">
                        <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </span>
                    </div>

                    <div>
                      <h1 className="font-serif text-xl sm:text-[26px] font-bold tracking-tight text-[#F5F2EB]">
                        Dashboard Operativo
                      </h1>
                      <div className="mt-1 sm:mt-1.5 flex items-center justify-center gap-2 sm:gap-2.5">
                        <span className="h-px w-6 sm:w-7 bg-gradient-to-r from-transparent to-[#D4AF37]/55" />
                        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.22em] text-[#E2C275]">
                          The Ciprian Company
                        </p>
                        <span className="h-px w-6 sm:w-7 bg-gradient-to-l from-transparent to-[#D4AF37]/55" />
                      </div>
                    </div>
                  </div>

                  {/* Integrated Architectural Smoked-Glass Inputs */}
                  <div className="space-y-3 sm:space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold tracking-wide text-[#D5CFC4] mb-1 sm:mb-1.5 pl-1">
                        Usuario
                      </label>
                      <div className="group relative flex items-center rounded-2xl border border-white/[0.11] bg-white/[0.045] backdrop-blur-md focus-within:border-[#E2C275]/60 focus-within:bg-white/[0.07] focus-within:ring-4 focus-within:ring-[#D4AF37]/12 transition-all">
                        <span className="ml-2 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#E2C275] group-focus-within:bg-[#D4AF37]/16 group-focus-within:border-[#E2C275]/45 group-focus-within:text-[#F0D794] transition-colors">
                          <User className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          data-preserve-surface="true"
                          autoFocus
                          disabled={lockoutSeconds > 0}
                          value={usernameInput}
                          onChange={(e) => {
                            setUsernameInput(e.target.value);
                            setAuthError(null);
                          }}
                          placeholder="Usuario autorizado"
                          className="w-full min-h-[44px] sm:min-h-[46px] bg-transparent px-3 py-2.5 sm:py-3 text-base sm:text-sm text-[#F5F2EB] placeholder:text-[#9C9589]/75 focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold tracking-wide text-[#D5CFC4] mb-1 sm:mb-1.5 pl-1">
                        Contraseña
                      </label>
                      <div className="group relative flex items-center rounded-2xl border border-white/[0.11] bg-white/[0.045] backdrop-blur-md focus-within:border-[#E2C275]/60 focus-within:bg-white/[0.07] focus-within:ring-4 focus-within:ring-[#D4AF37]/12 transition-all">
                        <span className="ml-2 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#E2C275] group-focus-within:bg-[#D4AF37]/16 group-focus-within:border-[#E2C275]/45 group-focus-within:text-[#F0D794] transition-colors">
                          <KeyRound className="h-4 w-4" />
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          data-preserve-surface="true"
                          disabled={lockoutSeconds > 0}
                          value={passwordInput}
                          onChange={(e) => {
                            setPasswordInput(e.target.value);
                            setAuthError(null);
                          }}
                          placeholder="••••••••••••"
                          className="w-full min-h-[44px] sm:min-h-[46px] bg-transparent pl-3 pr-11 sm:pr-12 py-2.5 sm:py-3 text-base sm:text-sm text-[#F5F2EB] placeholder:text-[#9C9589]/75 focus:outline-none disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-[#9C9589] hover:text-[#E2C275] hover:bg-white/[0.06] transition-colors cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {lockoutSeconds > 0 && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-[#B85668]/35 bg-[#3D121C]/60 px-3.5 py-2.5 sm:py-3 text-xs font-semibold text-[#E8BDC4]">
                      <ShieldAlert className="h-5 w-5 shrink-0 text-[#E2A8B0]" />
                      <div>
                        <p className="font-bold text-[#F5DDE1]">Acceso bloqueado temporalmente</p>
                        <p>
                          Reintento disponible en{' '}
                          <span className="font-mono underline">{lockoutSeconds}s</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  {authError && lockoutSeconds === 0 && (
                    <div className="flex items-start gap-2 rounded-2xl border border-[#B85668]/35 bg-[#3D121C]/55 px-3.5 py-2.5 text-xs font-semibold text-[#E8BDC4]">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#E2A8B0] mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || lockoutSeconds > 0}
                    data-preserve-surface="true"
                    className="relative w-full min-h-[46px] sm:min-h-[48px] overflow-hidden rounded-full bg-gradient-to-r from-[#B88B32] via-[#E9CA7A] to-[#C2953B] py-3 sm:py-3.5 text-sm font-bold tracking-wide text-[#17120A] shadow-[0_14px_28px_-10px_rgba(212,175,55,0.42),inset_0_1px_0_rgba(255,255,255,0.45)] border border-[#F2DBA0]/45 hover:brightness-[1.04] active:scale-[0.985] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    <span className="relative">
                      {authLoading ? 'Verificando...' : 'Ingresar'}
                    </span>
                  </button>
                </motion.form>
              ) : isFilter2 ? (
                <motion.form
                  key="filter2"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  onSubmit={handleFilter2Submit}
                  className="relative z-10 space-y-2.5 sm:space-y-4 text-center"
                  autoComplete="off"
                >
                  {/* Brushed Crimson + Champagne Admin Sovereign Pill */}
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A24A]/32 bg-[#5C0A17]/50 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-[#E9D7B0] shadow-inner">
                      <RoleSymbolSvg role="admin" className="h-3.5 w-3.5 sm:h-4 sm:w-4" animated={false} />
                      Comando Central · 2FA
                    </span>
                  </div>

                  {/* Rotating Combination Safe Dial (Brushed Crimson + Champagne Gold) */}
                  <div className="relative mx-auto flex h-[76px] w-[76px] sm:h-28 sm:w-28 items-center justify-center">
                    <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full opacity-60">
                      <circle
                        cx="60"
                        cy="60"
                        r="56"
                        fill="none"
                        stroke="#C8A24A"
                        strokeOpacity="0.55"
                        strokeWidth="1.2"
                        strokeDasharray="2 4"
                      />
                    </svg>
                    <div className="absolute inset-1.5 sm:inset-2 rounded-full bg-gradient-to-b from-[#332E36] via-[#1C1920] to-[#100E13] border-[3px] border-[#C8A24A]/45 shadow-[inset_0_4px_12px_rgba(0,0,0,0.85),0_12px_28px_rgba(92,10,23,0.42)]" />
                    <motion.div
                      animate={{ rotate: dialRotation }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="relative flex h-12 w-12 sm:h-[70px] sm:w-[70px] items-center justify-center rounded-full bg-gradient-to-br from-[#8B1528] via-[#5C0A17] to-[#2B060C] border border-[#C8A24A]/60 shadow-[0_6px_20px_rgba(92,10,23,0.5)]"
                    >
                      <span className="absolute -top-1 sm:-top-1.5 h-2.5 sm:h-3 w-1.5 rounded-full bg-[#E9CA7A] shadow" />
                      <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-[#140E12] border border-[#C8A24A]/40 flex items-center justify-center shadow-inner">
                        <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-[#C84356] shadow-[0_0_8px_rgba(200,67,86,0.75)]" />
                      </div>
                    </motion.div>
                  </div>

                  <div>
                    <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#F5F2EB] tracking-wide">
                      Caja Fuerte · PIN Admin
                    </h2>
                    <p className="text-[11.5px] sm:text-xs text-[#D5CFC4] mt-0.5">
                      Marca la combinación numérica de Administrador para ingresar.
                    </p>
                  </div>

                  {/* Recessed Smoked-Glass & Champagne Combination Screen */}
                  <div className="rounded-2xl border border-white/[0.11] bg-white/[0.04] px-3 sm:px-4 py-2 sm:py-3 shadow-[inset_0_4px_14px_rgba(0,0,0,0.55)]">
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5">
                      {Array.from({ length: slotCount }).map((_, idx) => {
                        const filled = idx < pinInput.length;
                        return (
                          <motion.span
                            key={idx}
                            animate={filled ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                            transition={{ duration: 0.18 }}
                            className={`flex h-8 w-7 sm:h-9 sm:w-8 items-center justify-center rounded-lg border font-mono text-base sm:text-xl font-bold transition-colors ${
                              filled
                                ? 'border-[#C8A24A]/60 bg-[#5C0A17]/55 text-[#E9CA7A] shadow-[0_0_12px_rgba(200,162,74,0.22)]'
                                : 'border-white/[0.10] bg-white/[0.03] text-[#9C9589]/55'
                            }`}
                          >
                            {filled ? '•' : '–'}
                          </motion.span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tactile Smoked-Glass Vault Numeric Keypad */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-0.5 sm:pt-1">
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
                        className="min-h-[44px] sm:min-h-[48px] rounded-xl border border-white/[0.10] bg-white/[0.05] py-2.5 sm:py-3 font-mono text-base sm:text-lg font-bold text-[#F5F2EB] shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#C8A24A]/55 hover:bg-white/[0.09] hover:text-[#E9CA7A] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
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
                      className="min-h-[44px] sm:min-h-[48px] rounded-xl border border-white/[0.09] bg-white/[0.035] py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#D5CFC4] shadow-[0_2px_0_rgba(0,0,0,0.45)] hover:border-[#C8A24A]/45 hover:bg-white/[0.07] hover:text-[#F5F2EB] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
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
                      className="min-h-[44px] sm:min-h-[48px] rounded-xl border border-white/[0.10] bg-white/[0.05] py-2.5 sm:py-3 font-mono text-base sm:text-lg font-bold text-[#F5F2EB] shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#C8A24A]/55 hover:bg-white/[0.09] hover:text-[#E9CA7A] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
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
                      className="min-h-[44px] sm:min-h-[48px] flex items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] py-2.5 sm:py-3 text-[#D5CFC4] shadow-[0_2px_0_rgba(0,0,0,0.45)] hover:border-[#C8A24A]/45 hover:bg-white/[0.07] hover:text-[#F5F2EB] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
                    >
                      <Delete className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </motion.button>
                  </div>

                  {authError && (
                    <div className="flex items-start gap-2 rounded-2xl border border-[#B85668]/35 bg-[#3D121C]/55 px-3.5 py-2 text-xs font-semibold text-[#E8BDC4] text-left">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#E2A8B0] mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || lockoutSeconds > 0 || pinInput.length < 4}
                    className="relative w-full min-h-[44px] sm:min-h-[48px] overflow-hidden rounded-full bg-gradient-to-r from-[#5C0A17] via-[#8B1528] to-[#5C0A17] py-2.5 sm:py-3.5 text-sm font-bold tracking-wide text-[#F5F2EB] shadow-[0_14px_28px_-8px_rgba(92,10,23,0.58),inset_0_1px_0_rgba(233,202,122,0.3)] border border-[#C8A24A]/42 hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-45"
                  >
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    <span className="relative">
                      {authLoading ? 'Abriendo caja fuerte...' : 'Abrir Caja Fuerte'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreAuthToken(null);
                      setAuthError(null);
                      setPinInput('');
                      setSecurityStage('filter1_credentials');
                    }}
                    className="inline-flex min-h-[38px] sm:min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#D5CFC4] hover:text-[#F5F2EB] cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="filter2-ai-question"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  onSubmit={handleSecurityQuestionSubmit}
                  className="relative z-10 space-y-4 sm:space-y-5 text-center"
                  autoComplete="off"
                >
                  {/* Imperial Gold AI Manager Cognitive 2FA Pill */}
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F5D67B]/45 bg-[#5A3B08]/55 px-3 py-1 text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-[#F7DC88] shadow-inner">
                      <RoleSymbolSvg role="ai_manager" className="h-3.5 w-3.5 sm:h-4 sm:w-4" animated={false} />
                      AI MANAGER · Verificación Suprema
                    </span>
                  </div>

                  {/* Imperial Gold Emblem */}
                  <div className="relative mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border border-[#F5D67B]/50 bg-gradient-to-br from-[#3A2706] via-[#1C1405] to-[#0E0A03] shadow-[0_12px_30px_rgba(200,150,46,0.35),inset_0_1px_0_rgba(255,244,200,0.35)]">
                    <RoleSymbolSvg role="ai_manager" className="h-10 w-10 sm:h-12 sm:w-12" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#FDF6E2] tracking-wide">
                      Pregunta de Seguridad Aleatoria
                    </h2>
                    <p className="text-[11.5px] sm:text-xs text-[#DFC99B]">
                      Solo tú conoces la respuesta. Cada inicio de sesión rota la pregunta.
                    </p>
                  </div>

                  {/* Random Challenge Question Box */}
                  <div className="rounded-2xl border border-[#F5D67B]/35 bg-gradient-to-b from-[#2A1D06]/75 to-[#171004]/85 px-4 py-3.5 sm:py-4 text-left space-y-2 shadow-[inset_0_2px_12px_rgba(0,0,0,0.45)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#F5D67B]/35 bg-[#C8962E]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F7DC88]">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        {securityChallenge?.typeLabel || 'Desafío Personal'}
                      </span>
                      <span className="font-mono text-[10px] text-[#C8B289]">1 de 5 · Aleatoria</span>
                    </div>
                    <p className="font-serif text-base sm:text-lg font-bold text-[#FFF9E6] leading-snug">
                      {securityChallenge?.prompt || 'Responde tu pregunta de seguridad personal'}
                    </p>
                  </div>

                  {/* Answer Input */}
                  <div className="text-left space-y-1.5">
                    <label
                      htmlFor="ai-security-answer-input"
                      className="block text-xs font-semibold tracking-wide text-[#E7D5AE] pl-1"
                    >
                      Tu respuesta secreta
                    </label>
                    <div className="group relative flex items-center rounded-2xl border border-[#F5D67B]/30 bg-white/[0.05] backdrop-blur-md focus-within:border-[#F7DC88]/75 focus-within:bg-white/[0.08] focus-within:ring-4 focus-within:ring-[#D4A437]/18 transition-all">
                      <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4A437]/16 border border-[#F5D67B]/30 text-[#F7DC88]">
                        <KeyRound className="h-4 w-4" />
                      </span>
                      <input
                        id="ai-security-answer-input"
                        type={showSecurityAnswer ? 'text' : 'password'}
                        data-preserve-surface="true"
                        autoFocus
                        disabled={lockoutSeconds > 0 || authLoading}
                        value={securityAnswerInput}
                        onChange={(e) => {
                          setSecurityAnswerInput(e.target.value);
                          setAuthError(null);
                        }}
                        placeholder="Escribe tu respuesta secreta..."
                        className="w-full min-h-[46px] bg-transparent pl-3 pr-12 py-2.5 text-base sm:text-sm text-[#FFFDF5] placeholder:text-[#B8A57E]/70 focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecurityAnswer((prev) => !prev)}
                        aria-label={showSecurityAnswer ? 'Ocultar respuesta' : 'Mostrar respuesta'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-xl text-[#C8B289] hover:text-[#F7DC88] hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        {showSecurityAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {lockoutSeconds > 0 && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-[#B85668]/40 bg-[#3D121C]/65 px-3.5 py-2.5 text-xs font-semibold text-[#E8BDC4] text-left">
                      <ShieldAlert className="h-5 w-5 shrink-0 text-[#E2A8B0]" />
                      <div>
                        <p className="font-bold text-[#F5DDE1]">Verificación bloqueada temporalmente</p>
                        <p>
                          Reintento disponible en{' '}
                          <span className="font-mono underline">{lockoutSeconds}s</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  {authError && lockoutSeconds === 0 && (
                    <div className="flex items-start gap-2 rounded-2xl border border-[#B85668]/40 bg-[#3D121C]/60 px-3.5 py-2.5 text-xs font-semibold text-[#E8BDC4] text-left">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#E2A8B0] mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || lockoutSeconds > 0 || !securityAnswerInput.trim()}
                    data-preserve-surface="true"
                    className="relative w-full min-h-[46px] sm:min-h-[48px] overflow-hidden rounded-full bg-gradient-to-r from-[#8A5E11] via-[#E8BD55] to-[#B8861E] py-3 text-sm font-extrabold tracking-wide text-[#1A1204] shadow-[0_14px_30px_-8px_rgba(212,164,55,0.58),inset_0_1px_0_rgba(255,248,220,0.65)] border border-[#F7DC88]/65 hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-45"
                  >
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer" />
                    <span className="relative">
                      {authLoading ? 'Verificando identidad...' : 'Verificar y Desbloquear Centro AI'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreAuthToken(null);
                      setSecurityChallenge(null);
                      setSecurityAnswerInput('');
                      setShowSecurityAnswer(false);
                      setAuthError(null);
                      setSecurityStage('filter1_credentials');
                    }}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#DFC99B] hover:text-[#FFF9E6] cursor-pointer"
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

  const activeRoleTheme = getRoleTheme(userRole);

  const handleAiManagerSessionTokenUpdated = (_sessionToken?: string) => {
    void verifyDsbSession().then((res) => {
      if (res.authenticated) {
        setCurrentUser({
          userId: res.userId,
          username: res.username,
          displayName: res.displayName,
          tag: res.tag,
          avatarUrl: res.avatarUrl ?? null,
          role: res.role || userRole,
        });
      }
    });
  };

  const handleOpenCreateAdminFromAiControl = () => {
    setActiveTab('accounts');
    setCreateAdminSignal((n) => n + 1);
  };

  return (
    <div
      className="relative min-h-[100dvh] pb-10 sm:pb-14 overflow-x-clip dsb-theme-root"
      data-dsb-surface={surfaceTheme}
    >
      <DashboardBackdrop
        role={userRole}
        stage={securityStage}
        surfaceTheme={surfaceTheme}
      />

      <div className="relative z-10">
        <DashboardHeader
          leads={appState.leads}
          activeTab={activeTab}
          userRole={userRole}
          currentUser={headerUser}
          surfaceTheme={surfaceTheme}
          securityAlerts={appState.securityAlerts ?? []}
          openSecurityAlertsCount={openSecurityAlertsCount}
          criticalSecurityAlertsCount={criticalSecurityAlertsCount}
          onSurfaceThemeChange={handleSurfaceThemeChange}
          onTabChange={setActiveTab}
          onJumpToPending={() => {
            setActiveTab('overview');
            setKpiFilter('pending');
          }}
          onJumpToSecurity={() => setActiveTab('security')}
          onLockNow={handleLockNow}
          onLogout={handleLockNow}
        />

        <main className="mx-auto max-w-6xl px-3 sm:px-6 pt-2.5 sm:pt-4 space-y-3.5 sm:space-y-4">
          {userRole === 'telemarketing' ? (
            <TelemarketingProspectsView
              leads={appState.leads}
              referrers={appState.referrers ?? []}
              operatorName={currentUser?.displayName || currentUser?.username}
              onUpdateLead={handleUpdateLead}
              onBusyChange={setProspectsBusy}
            />
          ) : userRole === 'vendedor' ? (
            <AnimatePresence mode="wait">
              {activeTab === 'embajadores' ? (
                <motion.div
                  key="vendedor-embajadores"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                >
                  <EmbajadoresHubPanel
                    mode="vendedor"
                    userRole={userRole}
                    currentUser={currentUser}
                    referrers={appState.referrers ?? []}
                    leads={appState.leads}
                    qrHistory={appState.qrHistory ?? []}
                    visitLog={appState.visitLog ?? []}
                    defaultOriginUrl={defaultOriginUrl}
                    surfaceTheme={surfaceTheme}
                    onStateUpdated={onStateChange}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="vendedor-overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                  className="space-y-4 sm:space-y-6"
                >
                  {/* Personal Vendedor / Embajador QR & Tag Card — Verde Militar + Brushed Brass */}
                  <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="relative overflow-hidden rounded-[22px] sm:rounded-[28px] bg-gradient-to-br from-[#1E2919]/88 via-[#2B3A24]/84 to-[#1A2416]/90 backdrop-blur-2xl border border-[#C8A85B]/50 p-3.5 sm:p-6 text-[#F5F7F2] shadow-[0_20px_44px_-16px_rgba(30,41,25,0.52),inset_0_1px_0_rgba(243,226,179,0.28)]"
                  >
                    {/* Top military brass foil bar */}
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-1"
                      style={{
                        background:
                          'linear-gradient(90deg, #2B3A24 0%, #556B2F 38%, #C8A85B 72%, #F3E2B3 100%)',
                      }}
                    />
                    {/* Subtle tactical olive & brass radial glow */}
                    <div
                      className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full blur-3xl opacity-35"
                      style={{
                        background: 'radial-gradient(circle, #C8A85B 0%, transparent 70%)',
                      }}
                    />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 min-w-0">
                      <div className="flex items-center sm:items-start gap-3 sm:gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <AmbassadorAvatar
                            name={currentUser?.displayName || currentUser?.username || vendedorTag}
                            avatarUrl={effectiveVendedorAvatarUrl}
                            size="lg"
                            ring="gold"
                            className="ring-offset-[#23301D] !h-11 !w-11 sm:!h-14 sm:!w-14"
                          />
                          <span
                            className="absolute -bottom-1 -right-1 rounded-full bg-[#1E2919] p-0.5 ring-1 ring-[#C8A85B]/70 shadow-md"
                            aria-hidden="true"
                          >
                            <RoleSymbolSvg role="vendedor" className="h-4 w-4 sm:h-5 sm:w-5" animated={false} />
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.12em] sm:tracking-[0.16em] text-[#E5CF92]">
                              <RoleSymbolSvg role="vendedor" className="h-3.5 w-3.5 shrink-0" animated={false} />
                              Vanguardia Comercial · Vendedor
                            </span>
                            {vendedorTag && (
                              <span className="rounded-md bg-[#C8A85B]/18 border border-[#C8A85B]/55 px-1.5 sm:px-2 py-0.5 font-mono text-[10.5px] sm:text-[11px] font-bold text-[#F3E2B3] shadow-2xs">
                                Tag: {vendedorTag}
                              </span>
                            )}
                          </div>
                          <h2 className="font-serif text-base sm:text-2xl font-bold text-white mt-0.5 truncate">
                            Hola, {currentUser?.displayName || currentUser?.username}
                          </h2>
                          <p className="text-[11px] sm:text-xs text-[#D3DEC8] mt-0.5 sm:mt-1 font-mono truncate min-w-0 w-full sm:max-w-xl">
                            {vendedorUrl}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
                        <RoleEmblemBadge
                          role="vendedor"
                          tag={vendedorTag || undefined}
                          size="sm"
                          showCodename
                          className="hidden xl:inline-flex"
                        />
                        {vendedorTag && (
                          <>
                            <button
                              type="button"
                              onClick={handleCopyVendedorUrl}
                              className="inline-flex min-h-[40px] sm:min-h-[42px] min-w-0 items-center justify-center gap-1 sm:gap-1.5 rounded-full border border-[#C8A85B]/40 bg-white/10 hover:bg-white/16 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-[#F5F7F2] backdrop-blur-md transition-colors cursor-pointer"
                            >
                              {vendedorCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 shrink-0 text-[#96CDB2]" />
                                  <span className="truncate">Enlace copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 shrink-0 text-[#E5CF92]" />
                                  <span className="truncate">Copiar mi enlace</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={vendedorDownloadingQr}
                              onClick={handleDownloadVendedorQr}
                              data-preserve-surface="true"
                              className="inline-flex min-h-[40px] sm:min-h-[42px] min-w-0 items-center justify-center gap-1 sm:gap-1.5 rounded-full bg-gradient-to-r from-[#B59245] via-[#E2C87E] to-[#C8A85B] px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-[#1B2516] shadow-[0_8px_20px_-6px_rgba(200,168,91,0.55)] hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Download className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {vendedorDownloadingQr ? 'Generando...' : 'Descargar mi QR HD'}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Vendedor Consolidated Team Rollup Stat Chips */}
                    {vendedorRollup && (
                      <div
                        data-preserve-surface="true"
                        className="relative z-10 mt-3.5 pt-3 border-t border-[#C8A85B]/25 grid grid-cols-1 sm:grid-cols-3 gap-2"
                      >
                        <div className="rounded-xl border border-[#C8A85B]/30 bg-black/25 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#E5CF92]">
                              Embajadores
                            </span>
                            <span className="block text-[11px] text-[#C8D8BC] truncate">
                              {vendedorRollup.activeEmbajadoresCount}{' '}
                              {vendedorRollup.activeEmbajadoresCount === 1 ? 'activo' : 'activos'} en tu equipo
                            </span>
                          </div>
                          <span className="font-serif text-lg sm:text-xl font-bold text-white tabular-nums shrink-0">
                            {vendedorRollup.embajadoresCount}
                          </span>
                        </div>

                        <div className="rounded-xl border border-[#C8A85B]/30 bg-black/25 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#E5CF92]">
                              QRs totales
                            </span>
                            <span className="block text-[11px] text-[#C8D8BC] tabular-nums truncate">
                              Directo: {vendedorRollup.directQrCount} · Emb: {vendedorRollup.embajadoresQrCount}
                            </span>
                          </div>
                          <span className="font-serif text-lg sm:text-xl font-bold text-[#F3E2B3] tabular-nums shrink-0">
                            {vendedorRollup.totalQrCount}
                          </span>
                        </div>

                        <div className="rounded-xl border border-[#C8A85B]/35 bg-[#C8A85B]/12 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#F3E2B3]">
                              Prospectos
                            </span>
                            <span className="block text-[11px] text-[#E4ECD8] tabular-nums truncate">
                              Directo: {vendedorRollup.directLeadsCount} + Embajadores: {vendedorRollup.embajadoresLeadsCount}
                            </span>
                          </div>
                          <span className="font-serif text-lg sm:text-xl font-bold text-white tabular-nums shrink-0">
                            {vendedorRollup.totalLeadsCount}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.section>

                  <MetricsFilterBar
                    datePreset={datePreset}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDatePresetChange={setDatePreset}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    showAmbassadorFilter={vendedorOwnedEmbajadores.length > 0}
                    ambassadorFilter={ambassadorFilter}
                    onAmbassadorFilterChange={setAmbassadorFilter}
                    vendedorDirectTag={vendedorTag}
                    referrers={appState.referrers ?? []}
                    totalLeadsCount={appState.leads.length}
                    filteredLeadsCount={filteredLeads.length}
                    onClearFilters={handleClearGlobalFilters}
                    userRole={userRole}
                  />

                  <KpiGrid
                    title="Mis Métricas"
                    leads={filteredLeads}
                    defaultTicketAmount={appState.settings.defaultTicketAmount}
                    activeFilter={kpiFilter}
                    onSelectFilter={setKpiFilter}
                    userRole={userRole}
                  />

                  <ReposoProspectsSection
                    leads={filteredLeads}
                    referrers={appState.referrers ?? []}
                    userRole="vendedor"
                  />

                  <ProspectsManager
                    leads={filteredLeads}
                    gifts={appState.gifts}
                    referrers={appState.referrers ?? []}
                    userRole="vendedor"
                    currentUser={currentUser}
                    hideOriginFilter
                    defaultTicketAmount={appState.settings.defaultTicketAmount}
                    activeFilter={kpiFilter}
                    onFilterChange={setKpiFilter}
                    onUpdateLead={handleUpdateLead}
                    onCreateManualLead={handleCreateManualLead}
                    onBusyChange={setProspectsBusy}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              {userRole === 'ai_manager' && activeTab === 'ai_control' && (
                <motion.div
                  key="ai_control"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                >
                  <AiManagerPanel
                    appState={appState}
                    accounts={accounts}
                    currentUser={currentUser}
                    surfaceTheme={surfaceTheme}
                    onStateUpdated={onStateChange}
                    onSessionTokenUpdated={handleAiManagerSessionTokenUpdated}
                    onOpenMasterReset={() => setMasterResetOpen(true)}
                    onCreateAdminClick={handleOpenCreateAdminFromAiControl}
                  />
                </motion.div>
              )}

              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                  className="space-y-3.5 sm:space-y-4"
                >
                  <MetricsFilterBar
                    datePreset={datePreset}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDatePresetChange={setDatePreset}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    showAmbassadorFilter
                    ambassadorFilter={ambassadorFilter}
                    onAmbassadorFilterChange={setAmbassadorFilter}
                    accounts={accounts}
                    referrers={appState.referrers ?? []}
                    totalLeadsCount={appState.leads.length}
                    filteredLeadsCount={filteredLeads.length}
                    onClearFilters={handleClearGlobalFilters}
                    userRole={userRole}
                  />

                  <KpiGrid
                    leads={filteredLeads}
                    defaultTicketAmount={appState.settings.defaultTicketAmount}
                    activeFilter={kpiFilter}
                    onSelectFilter={setKpiFilter}
                    onOpenMasterReset={() => setMasterResetOpen(true)}
                    resetSuccessMessage={resetSuccessMessage}
                    userRole={userRole}
                  />

                  <ReposoProspectsSection
                    leads={filteredLeads}
                    referrers={appState.referrers ?? []}
                    accounts={accounts}
                    userRole={userRole}
                    onUpdateLead={handleUpdateLead}
                    onBusyChange={setReposoBusy}
                  />

                  <ProspectsManager
                    leads={filteredLeads}
                    gifts={appState.gifts}
                    referrers={appState.referrers ?? []}
                    accounts={accounts}
                    userRole={userRole}
                    hideOriginFilter
                    defaultTicketAmount={appState.settings.defaultTicketAmount}
                    activeFilter={kpiFilter}
                    onFilterChange={setKpiFilter}
                    onUpdateLead={handleUpdateLead}
                    onCreateManualLead={handleCreateManualLead}
                    onDeleteLead={handleDeleteLead}
                    onBusyChange={setProspectsBusy}
                  />
                </motion.div>
              )}

              {activeTab === 'referrals' && (
                <motion.div
                  key="referrals"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                  className="space-y-3.5 sm:space-y-4"
                >
                  {/* Sub-tabs: Estudio QR · Embajadores · Ranking y Premios */}
                  <div className="flex items-center justify-center sm:justify-start">
                    <div
                      className="dsb-glass-subtle grid grid-cols-3 sm:inline-flex gap-1 w-full sm:w-auto rounded-2xl p-1 border shadow-xs"
                      style={{ borderColor: activeRoleTheme.borderTint }}
                    >
                      <button
                        type="button"
                        onClick={() => setReferralsSubTab('studio')}
                        className={`inline-flex min-h-[40px] sm:min-h-[40px] items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-4 py-1.5 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                          referralsSubTab === 'studio'
                            ? activeRoleTheme.activePillClass
                            : 'text-[#4B2E2B] hover:text-[#8B0018]'
                        }`}
                      >
                        <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span>Estudio QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReferralsSubTab('embajadores')}
                        className={`inline-flex min-h-[40px] sm:min-h-[40px] items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-4 py-1.5 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                          referralsSubTab === 'embajadores'
                            ? activeRoleTheme.activePillClass
                            : 'text-[#4B2E2B] hover:text-[#8B0018]'
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span>Embajadores</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReferralsSubTab('ranking')}
                        className={`inline-flex min-h-[40px] sm:min-h-[40px] items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-4 py-1.5 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                          referralsSubTab === 'ranking'
                            ? activeRoleTheme.activePillClass
                            : 'text-[#4B2E2B] hover:text-[#8B0018]'
                        }`}
                      >
                        <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="sm:hidden">Ranking</span>
                        <span className="hidden sm:inline">Ranking y Premios</span>
                      </button>
                    </div>
                  </div>

                  {referralsSubTab === 'studio' ? (
                    <QrStudioPanel
                      qrHistory={appState.qrHistory ?? []}
                      referrers={appState.referrers ?? []}
                      accounts={accounts}
                      leads={appState.leads}
                      visitLog={appState.visitLog ?? []}
                      defaultTicketAmount={appState.settings.defaultTicketAmount}
                      defaultUrl={defaultOriginUrl}
                      userRole={userRole}
                      onCreateQr={handleCreateQr}
                      onDeleteQr={handleDeleteQr}
                      onGoToAccounts={() => setActiveTab('accounts')}
                    />
                  ) : referralsSubTab === 'embajadores' ? (
                    <EmbajadoresHubPanel
                      mode="admin"
                      userRole={userRole}
                      currentUser={currentUser}
                      referrers={appState.referrers ?? []}
                      accounts={accounts}
                      leads={appState.leads}
                      qrHistory={appState.qrHistory ?? []}
                      visitLog={appState.visitLog ?? []}
                      defaultOriginUrl={defaultOriginUrl}
                      surfaceTheme={surfaceTheme}
                      onStateUpdated={onStateChange}
                    />
                  ) : (
                    <ReferralsLeaderboardPanel
                      referrers={appState.referrers ?? []}
                      leads={appState.leads}
                      visitLog={appState.visitLog}
                      accounts={accounts}
                      qrHistory={appState.qrHistory ?? []}
                      settings={appState.settings}
                      defaultOriginUrl={defaultOriginUrl}
                      userRole={userRole}
                      onUpdatePartner={handleUpdateReferralPartner}
                      onDeletePartner={handleDeleteReferralPartner}
                      onSavePrizeRule={handleSaveReferralPrizeRule}
                      onGoToAccounts={() => setActiveTab('accounts')}
                      onBusyChange={setReferralsBusy}
                    />
                  )}
                </motion.div>
              )}

              {activeTab === 'accounts' && (
                <motion.div
                  key="accounts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                >
                  <AccountsManagerPanel
                    accounts={accounts}
                    referrers={appState.referrers ?? []}
                    userRole={userRole}
                    currentUserId={currentUser?.userId}
                    currentUsername={currentUser?.username}
                    currentDisplayName={currentUser?.displayName}
                    openCreateAdminSignal={createAdminSignal}
                    onGoToAiControl={
                      userRole === 'ai_manager' ? () => setActiveTab('ai_control') : undefined
                    }
                    onCreateAccount={handleCreateAccount}
                    onUpdateAccount={handleUpdateAccount}
                    onUpdateAccountPassword={handleUpdateAccountPassword}
                    onUpdateAdminAccountPassword={handleUpdateAdminAccountPassword}
                    onDeleteAccount={handleDeleteAccount}
                    onBusyChange={setAccountsBusy}
                  />
                </motion.div>
              )}

              {activeTab === 'gifts' && (
                <motion.div
                  key="gifts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                >
                  <GiftsEditor
                    gifts={appState.gifts}
                    giftTheme={appState.settings.giftTheme}
                    customBoxColor={appState.settings.customBoxColor}
                    showcaseStyle={appState.settings.showcaseStyle}
                    randomizeGifts={appState.settings.randomizeGifts ?? true}
                    userRole={userRole}
                    onUpdateGiftTheme={handleUpdateGiftTheme}
                    onUpdateShowcaseSettings={handleSaveSettings}
                    onCreateGift={handleCreateGift}
                    onUpdateGift={handleUpdateGift}
                    onSaveGiftProbabilities={handleSaveGiftProbabilities}
                    onDeleteGift={handleDeleteGift}
                    onResetGifts={handleResetGifts}
                    onBusyChange={setGiftsBusy}
                  />
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                >
                  <SettingsPanel
                    settings={appState.settings}
                    userRole={userRole}
                    onGoToAiControl={
                      userRole === 'ai_manager' ? () => setActiveTab('ai_control') : undefined
                    }
                    onSaveSettings={handleSaveSettings}
                    onCredentialsUpdated={(updatedUsername) =>
                      setCurrentUser((prev) =>
                        prev ? { ...prev, username: updatedUsername } : prev
                      )
                    }
                    onBusyChange={setSettingsBusy}
                  />
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                >
                  <SecurityCenterPanel
                    alerts={securityAlerts}
                    leads={appState.leads}
                    accounts={accounts}
                    referrers={appState.referrers ?? []}
                    userRole={userRole}
                    onUpdateAlertStatus={handleUpdateSecurityAlertStatus}
                    onBulkAction={handleBulkSecurityAlertsAction}
                    onJumpToLead={handleJumpToLeadFromSecurity}
                    onBusyChange={setSecurityBusy}
                  />
                </motion.div>
              )}

              {activeTab === 'activity' && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
                >
                  <ActivityLogPanel
                    logs={appState.activityLogs ?? []}
                    accounts={accounts}
                    userRole={userRole}
                    onJumpToLead={handleJumpToLeadFromSecurity}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Subtle Floating Back-to-Top Glass Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: 10 }}
            transition={{ duration: 0.18 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Volver arriba"
            title="Volver arriba"
            className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full dsb-glass-strong border shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            style={{
              borderColor: activeRoleTheme.borderTint,
              boxShadow: `0 12px 28px -8px ${activeRoleTheme.glowRgba}`,
            }}
          >
            <ArrowUp className={`h-4.5 w-4.5 ${activeRoleTheme.textAccent}`} />
          </motion.button>
        )}
      </AnimatePresence>

      {isElevated && (
        <MasterResetModal
          open={masterResetOpen}
          bypassPassword={userRole === 'ai_manager'}
          onClose={() => setMasterResetOpen(false)}
          onConfirmReset={handleConfirmMasterReset}
        />
      )}
    </div>
  );
};
