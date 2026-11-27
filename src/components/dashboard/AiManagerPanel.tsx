import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Database,
  Download,
  Eye,
  EyeOff,
  Filter,
  Gift,
  HelpCircle,
  KeyRound,
  LayoutTemplate,
  LogOut,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  Video,
  X,
} from 'lucide-react';
import type {
  AiSecurityQuestionPublic,
  AppState,
  ProcessControls,
  SecurityQuestionType,
  SystemHealthReport,
  UserAccount,
  UserRole,
} from '../../types/app';
import {
  DEFAULT_PROCESS_CONTROLS,
  aiManagerClearActivity,
  aiManagerPurgeAlerts,
  aiManagerReassignEmbajador,
  aiManagerRevokeSessions,
  aiManagerUpdateAccountCredentials,
  createAccount,
  downloadSystemBackup,
  fetchAiSecurityQuestions,
  fetchSystemHealth,
  updateAiSecurityQuestions,
  updateProcessControlsRemote,
} from '../../services/storeClient';
import { setClientGuardEnabled } from '../../utils/clientGuard';
import { computeEmbajadorMetrics } from '../../utils/partnerMetrics';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { RoleSymbolSvg } from './RoleEmblem';
import type { DashboardSurfaceTheme } from './surfaceTheme';

export interface AiManagerPanelProps {
  appState: AppState;
  accounts: UserAccount[];
  currentUser: { userId?: string; username?: string; displayName?: string; tag?: string } | null;
  surfaceTheme?: DashboardSurfaceTheme;
  onStateUpdated: (next: AppState) => void;
  onSessionTokenUpdated?: (token: string, username?: string) => void;
  onOpenMasterReset?: () => void;
  onCreateAdminClick?: () => void;
}

type AiSubTab =
  | 'public_controls'
  | 'admins_access'
  | 'embajadores_transfer'
  | 'monitoring'
  | 'my_account';
type AccountFilterRole = 'all' | 'admin' | 'vendedor' | 'telemarketing';

interface ControlToggleItem {
  key: keyof Pick<
    ProcessControls,
    | 'publicFormEnabled'
    | 'welcomeVideoEnabled'
    | 'qualificationQuizEnabled'
    | 'giftRevealEnabled'
    | 'clientGuardEnabled'
  >;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  activeText: string;
  pausedText: string;
}

const PUBLIC_CONTROL_ITEMS: ControlToggleItem[] = [
  {
    key: 'publicFormEnabled',
    label: 'Pantalla del Formulario Público',
    description: 'Activa o pausa el registro público de invitados con mensaje personalizado.',
    icon: LayoutTemplate,
    activeText: 'En Línea',
    pausedText: 'Pausado',
  },
  {
    key: 'welcomeVideoEnabled',
    label: 'Video de Bienvenida',
    description: 'Muestra la ventana emergente de video introductorio al abrir el enlace.',
    icon: Video,
    activeText: 'Visible',
    pausedText: 'Oculto',
  },
  {
    key: 'qualificationQuizEnabled',
    label: 'Quiz de Cualificación',
    description: 'Habilita las preguntas rápidas de perfil después de llenar el formulario.',
    icon: HelpCircle,
    activeText: 'Activo',
    pausedText: 'Omitido',
  },
  {
    key: 'giftRevealEnabled',
    label: 'Cajas Misteriosas y Regalos',
    description: 'Activa la selección de cajas 3D y revelación del regalo; al pausarlo muestra confirmación VIP.',
    icon: Gift,
    activeText: 'Activo',
    pausedText: 'Solo VIP',
  },
  {
    key: 'clientGuardEnabled',
    label: 'Escudo Anti-Inspección (Client Guard)',
    description: 'Bloquea clic derecho y atajos de DevTools (F12 / Ctrl+Shift+I) en vivo.',
    icon: Shield,
    activeText: 'Protegido',
    pausedText: 'Libre',
  },
];

const NON_ADMIN_PAGE_SIZE = 6;
const EMBAJADORES_PAGE_SIZE = 10;

function formatUptime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function getRoleBadgeMeta(role: UserRole): { label: string; className: string } {
  switch (role) {
    case 'ai_manager':
      return {
        label: 'AI MANAGER',
        className: 'bg-[#C8962E]/16 text-[#8A5610] border-[#C8962E]/40',
      };
    case 'admin':
      return {
        label: 'Admin',
        className: 'bg-rose-500/12 text-[#8B0018] border-rose-500/30',
      };
    case 'telemarketing':
      return {
        label: 'Telemarketing',
        className: 'bg-cyan-500/12 text-[#0B4F6C] border-cyan-500/30',
      };
    default:
      return {
        label: 'Vendedor',
        className: 'bg-emerald-500/12 text-[#2B3A24] border-emerald-600/30',
      };
  }
}

export const AiManagerPanel: React.FC<AiManagerPanelProps> = ({
  appState,
  accounts,
  currentUser,
  surfaceTheme = 'obsidian-marble',
  onStateUpdated,
  onSessionTokenUpdated,
  onOpenMasterReset,
  onCreateAdminClick,
}) => {
  const isDark = surfaceTheme === 'obsidian-marble' || surfaceTheme === 'royal-blue';
  const [activeSubTab, setActiveSubTab] = useState<AiSubTab>('public_controls');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live Process Controls state
  const currentControls = useMemo<ProcessControls>(
    () => ({
      ...DEFAULT_PROCESS_CONTROLS,
      ...(appState.settings.processControls ?? {}),
    }),
    [appState.settings.processControls]
  );

  const [savingControlKey, setSavingControlKey] = useState<string | null>(null);
  const [pauseTitle, setPauseTitle] = useState(currentControls.publicFormDisabledTitle);
  const [pauseMessage, setPauseMessage] = useState(currentControls.publicFormDisabledMessage);
  const [savingPauseCopy, setSavingPauseCopy] = useState(false);

  useEffect(() => {
    setPauseTitle(currentControls.publicFormDisabledTitle);
    setPauseMessage(currentControls.publicFormDisabledMessage);
  }, [currentControls.publicFormDisabledTitle, currentControls.publicFormDisabledMessage]);

  // Accounts & Admins state
  const [accountSearch, setAccountSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AccountFilterRole>('all');
  const [otherAccountsPage, setOtherAccountsPage] = useState(1);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  // Edit Credentials Modal (ZERO password confirmation)
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editNewPin, setEditNewPin] = useState('');
  const [editClearPin, setEditClearPin] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingEditCreds, setSavingEditCreds] = useState(false);

  // Quick Create Admin Modal (ZERO password confirmation)
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminDisplayName, setNewAdminDisplayName] = useState('');
  const [newAdminTag, setNewAdminTag] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Embajadores & Traspasos state
  const [embajadorSearch, setEmbajadorSearch] = useState('');
  const [embajadorOwnerFilter, setEmbajadorOwnerFilter] = useState<string>('all');
  const [embajadoresPage, setEmbajadoresPage] = useState(1);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [transferBanner, setTransferBanner] = useState<{
    message: string;
    movedLeadsCount: number;
    movedQrsCount: number;
    previousOwnerName: string;
    newOwnerName: string;
  } | null>(null);

  // System Health & Maintenance state
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [purgingAlerts, setPurgingAlerts] = useState<'resolved' | 'all' | null>(null);
  const [confirmPurgeAllAlerts, setConfirmPurgeAllAlerts] = useState(false);
  const [clearingActivity, setClearingActivity] = useState(false);
  const [confirmClearActivity, setConfirmClearActivity] = useState(false);

  // Self-service Mi Cuenta AI state
  const [selfDisplayName, setSelfDisplayName] = useState(currentUser?.displayName || 'Juan Orozco');
  const [selfUsername, setSelfUsername] = useState(currentUser?.username || 'JuanOrozco');
  const [selfNewPassword, setSelfNewPassword] = useState('');
  const [selfConfirmPassword, setSelfConfirmPassword] = useState('');
  const [showSelfPassword, setShowSelfPassword] = useState(false);
  const [savingSelf, setSavingSelf] = useState(false);

  // Security Questions 2FA Bank (Mi Cuenta AI)
  interface EditableSecurityQuestion {
    id: string;
    type: SecurityQuestionType;
    prompt: string;
    answer: string;
    hasAnswer: boolean;
  }
  const [secQuestions, setSecQuestions] = useState<EditableSecurityQuestion[]>([]);
  const [loadingSecQuestions, setLoadingSecQuestions] = useState(false);
  const [savingSecQuestions, setSavingSecQuestions] = useState(false);
  const [showSecAnswers, setShowSecAnswers] = useState(false);

  const loadSecQuestions = useCallback(async () => {
    setLoadingSecQuestions(true);
    try {
      const list: AiSecurityQuestionPublic[] = await fetchAiSecurityQuestions();
      setSecQuestions(
        list.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          answer: '',
          hasAnswer: q.hasAnswer,
        }))
      );
    } catch {
      // Ignore transient error
    } finally {
      setLoadingSecQuestions(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'my_account' && secQuestions.length === 0 && !loadingSecQuestions) {
      void loadSecQuestions();
    }
  }, [activeSubTab, secQuestions.length, loadingSecQuestions, loadSecQuestions]);

  const handleSaveSecurityQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSecQuestions) return;
    if (secQuestions.length < 3) {
      setFeedback({ type: 'error', text: 'Debes mantener al menos 3 preguntas de seguridad activas.' });
      return;
    }
    setSavingSecQuestions(true);
    try {
      const res = await updateAiSecurityQuestions(
        secQuestions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt.trim(),
          ...(q.answer.trim() ? { answer: q.answer.trim() } : {}),
        }))
      );
      setSecQuestions(
        res.questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          answer: '',
          hasAnswer: q.hasAnswer,
        }))
      );
      setFeedback({ type: 'success', text: res.message || 'Preguntas de seguridad actualizadas.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudieron guardar las preguntas de seguridad.',
      });
    } finally {
      setSavingSecQuestions(false);
    }
  };

  useEffect(() => {
    if (currentUser?.displayName) setSelfDisplayName(currentUser.displayName);
    if (currentUser?.username) setSelfUsername(currentUser.username);
  }, [currentUser?.displayName, currentUser?.username]);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const report = await fetchSystemHealth();
      setHealth(report);
    } catch (err) {
      setHealthError(
        err instanceof Error ? err.message : 'No se pudo consultar la salud del sistema.'
      );
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    setOtherAccountsPage(1);
  }, [accountSearch, roleFilter]);

  useEffect(() => {
    setEmbajadoresPage(1);
  }, [embajadorSearch, embajadorOwnerFilter]);

  const allAccounts = useMemo(() => {
    return accounts.length > 0 ? accounts : appState.accounts ?? [];
  }, [accounts, appState.accounts]);

  const adminAccounts = useMemo(
    () => allAccounts.filter((acc) => acc.role === 'admin'),
    [allAccounts]
  );

  const filteredAdmins = useMemo(() => {
    if (roleFilter !== 'all' && roleFilter !== 'admin') return [];
    const q = accountSearch.trim().toLowerCase();
    if (!q) return adminAccounts;
    return adminAccounts.filter(
      (acc) =>
        acc.displayName.toLowerCase().includes(q) ||
        acc.username.toLowerCase().includes(q) ||
        acc.tag.toLowerCase().includes(q)
    );
  }, [adminAccounts, accountSearch, roleFilter]);

  const filteredNonAdmins = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return allAccounts.filter((acc) => {
      if (acc.role === 'admin' || acc.role === 'ai_manager') return false;
      if (roleFilter !== 'all' && acc.role !== roleFilter) return false;
      if (!q) return true;
      return (
        acc.displayName.toLowerCase().includes(q) ||
        acc.username.toLowerCase().includes(q) ||
        acc.tag.toLowerCase().includes(q)
      );
    });
  }, [allAccounts, accountSearch, roleFilter]);

  const totalNonAdminPages = Math.max(1, Math.ceil(filteredNonAdmins.length / NON_ADMIN_PAGE_SIZE));
  const pagedNonAdmins = useMemo(() => {
    const safePage = Math.min(otherAccountsPage, totalNonAdminPages);
    const start = (safePage - 1) * NON_ADMIN_PAGE_SIZE;
    return filteredNonAdmins.slice(start, start + NON_ADMIN_PAGE_SIZE);
  }, [filteredNonAdmins, otherAccountsPage, totalNonAdminPages]);

  const roleCounts = useMemo(() => {
    let admins = 0;
    let vendedores = 0;
    let telemarketing = 0;
    let aiManagers = 0;
    for (const acc of allAccounts) {
      if (acc.role === 'admin') admins += 1;
      else if (acc.role === 'vendedor') vendedores += 1;
      else if (acc.role === 'telemarketing') telemarketing += 1;
      else if (acc.role === 'ai_manager') aiManagers += 1;
    }
    return { admins, vendedores, telemarketing, aiManagers };
  }, [allAccounts]);

  const vendedorAccounts = useMemo(() => {
    return allAccounts
      .filter((acc) => acc.role === 'vendedor')
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' }));
  }, [allAccounts]);

  const embajadorRows = useMemo(() => {
    const referrersList = appState.referrers ?? [];
    return referrersList
      .filter((r) => r.partnerType === 'embajador')
      .map((emb) =>
        computeEmbajadorMetrics(
          emb,
          appState.leads,
          appState.qrHistory ?? [],
          appState.visitLog ?? [],
          false,
          allAccounts,
          referrersList,
          appState.settings.defaultTicketAmount
        )
      )
      .sort((a, b) =>
        a.embajador.name.localeCompare(b.embajador.name, 'es', { sensitivity: 'base' })
      );
  }, [
    appState.referrers,
    appState.leads,
    appState.qrHistory,
    appState.visitLog,
    appState.settings.defaultTicketAmount,
    allAccounts,
  ]);

  const embajadorOwnerCounts = useMemo(() => {
    let direct = 0;
    const byVendedorId = new Map<string, number>();
    for (const row of embajadorRows) {
      if (row.owner.isDirect || !row.owner.accountId) {
        direct += 1;
      } else {
        byVendedorId.set(row.owner.accountId, (byVendedorId.get(row.owner.accountId) ?? 0) + 1);
      }
    }
    return { direct, byVendedorId };
  }, [embajadorRows]);

  const filteredEmbajadorRows = useMemo(() => {
    const q = embajadorSearch.trim().toLowerCase();
    return embajadorRows.filter((row) => {
      if (embajadorOwnerFilter === '__direct__') {
        if (!row.owner.isDirect && row.owner.accountId) return false;
      } else if (embajadorOwnerFilter !== 'all') {
        if (row.owner.accountId !== embajadorOwnerFilter) return false;
      }
      if (!q) return true;
      return (
        row.embajador.name.toLowerCase().includes(q) ||
        row.embajador.code.toLowerCase().includes(q) ||
        row.owner.name.toLowerCase().includes(q) ||
        (row.owner.tag || '').toLowerCase().includes(q)
      );
    });
  }, [embajadorRows, embajadorSearch, embajadorOwnerFilter]);

  const totalEmbajadorPages = Math.max(
    1,
    Math.ceil(filteredEmbajadorRows.length / EMBAJADORES_PAGE_SIZE)
  );
  const safeEmbajadoresPage = Math.min(embajadoresPage, totalEmbajadorPages);
  const pagedEmbajadorRows = useMemo(() => {
    const start = (safeEmbajadoresPage - 1) * EMBAJADORES_PAGE_SIZE;
    return filteredEmbajadorRows.slice(start, start + EMBAJADORES_PAGE_SIZE);
  }, [filteredEmbajadorRows, safeEmbajadoresPage]);

  const handleReassignEmbajador = async (
    embajadorId: string,
    targetVendedorAccountId: string | null
  ) => {
    if (transferringId) return;
    setTransferringId(embajadorId);
    try {
      const res = await aiManagerReassignEmbajador(embajadorId, targetVendedorAccountId);
      onStateUpdated(res.state);
      setSelectedTargets((prev) => {
        if (!(embajadorId in prev)) return prev;
        const next = { ...prev };
        delete next[embajadorId];
        return next;
      });
      const finalMsg =
        res.message ||
        `Embajador ${res.referrer?.name || ''} transferido a ${res.newOwnerName} (${res.movedLeadsCount} prospectos y ${res.movedQrsCount} QRs traspasados).`;
      setTransferBanner({
        message: finalMsg,
        movedLeadsCount: res.movedLeadsCount,
        movedQrsCount: res.movedQrsCount,
        previousOwnerName: res.previousOwnerName,
        newOwnerName: res.newOwnerName,
      });
      showToast('success', finalMsg);
      void loadHealth();
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo transferir el Embajador.'
      );
    } finally {
      setTransferringId(null);
    }
  };

  // Handlers: Public Controls
  const handleToggleControl = async (key: ControlToggleItem['key']) => {
    if (savingControlKey) return;
    const nextValue = !currentControls[key];
    setSavingControlKey(key);
    try {
      const res = await updateProcessControlsRemote({ [key]: nextValue });
      if (key === 'clientGuardEnabled') {
        setClientGuardEnabled(nextValue);
      }
      onStateUpdated(res.state);
      const item = PUBLIC_CONTROL_ITEMS.find((c) => c.key === key);
      showToast(
        'success',
        `${item?.label || key}: ${nextValue ? item?.activeText || 'Activado' : item?.pausedText || 'Pausado'}.`
      );
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo actualizar el control público.'
      );
    } finally {
      setSavingControlKey(null);
    }
  };

  const handleSavePauseCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPauseCopy) return;
    setSavingPauseCopy(true);
    try {
      const res = await updateProcessControlsRemote({
        publicFormDisabledTitle: pauseTitle.trim() || DEFAULT_PROCESS_CONTROLS.publicFormDisabledTitle,
        publicFormDisabledMessage:
          pauseMessage.trim() || DEFAULT_PROCESS_CONTROLS.publicFormDisabledMessage,
      });
      onStateUpdated(res.state);
      showToast('success', 'Mensaje de pausa pública guardado en vivo.');
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo guardar el mensaje de pausa.'
      );
    } finally {
      setSavingPauseCopy(false);
    }
  };

  // Handlers: Admins & Accounts
  const openEditCredentialsModal = (acc: UserAccount) => {
    setEditingAccount(acc);
    setEditUsername(acc.username);
    setEditDisplayName(acc.displayName);
    setEditNewPassword('');
    setEditNewPin('');
    setEditClearPin(false);
    setShowEditPassword(false);
  };

  const handleSaveEditedCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || savingEditCreds) return;

    const payload: {
      username?: string;
      displayName?: string;
      newPassword?: string;
      newPin?: string | null;
    } = {};

    const cleanUser = editUsername.trim();
    const cleanName = editDisplayName.trim();
    const cleanPass = editNewPassword.trim();
    const cleanPin = editNewPin.trim();

    if (cleanUser && cleanUser !== editingAccount.username) {
      payload.username = cleanUser;
    }
    if (cleanName && cleanName !== editingAccount.displayName) {
      payload.displayName = cleanName;
    }
    if (cleanPass) {
      if (cleanPass.length < 8) {
        showToast('error', 'La nueva contraseña debe tener al menos 8 caracteres.');
        return;
      }
      payload.newPassword = cleanPass;
    }
    if (editClearPin) {
      payload.newPin = null;
    } else if (cleanPin) {
      if (!/^\d{4,8}$/.test(cleanPin)) {
        showToast('error', 'El PIN 2FA debe contener entre 4 y 8 dígitos numéricos.');
        return;
      }
      payload.newPin = cleanPin;
    }

    if (Object.keys(payload).length === 0) {
      showToast('error', 'Realiza al menos un cambio antes de guardar.');
      return;
    }

    setSavingEditCreds(true);
    try {
      const res = await aiManagerUpdateAccountCredentials(editingAccount.id, payload);
      onStateUpdated(res.state);
      showToast('success', res.message || `Credenciales actualizadas para ${editingAccount.displayName}.`);
      setEditingAccount(null);
      void loadHealth();
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudieron actualizar las credenciales.'
      );
    } finally {
      setSavingEditCreds(false);
    }
  };

  const handleRevokeSession = async (acc: UserAccount) => {
    if (busyAccountId) return;
    setBusyAccountId(acc.id);
    try {
      const res = await aiManagerRevokeSessions(acc.id);
      onStateUpdated(res.state);
      showToast('success', res.message || `Sesiones expulsadas para ${acc.displayName}.`);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo expulsar la sesión de la cuenta.'
      );
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleToggleAccountActive = async (acc: UserAccount) => {
    if (busyAccountId) return;
    setBusyAccountId(acc.id);
    try {
      const nextActive = !acc.active;
      const res = await aiManagerUpdateAccountCredentials(acc.id, { active: nextActive });
      onStateUpdated(res.state);
      showToast(
        'success',
        `${acc.displayName} ${nextActive ? 'activado' : 'desactivado'} correctamente.`
      );
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo cambiar el estado de la cuenta.'
      );
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingAdmin) return;
    const username = newAdminUsername.trim();
    const displayName = newAdminDisplayName.trim();
    const tag = newAdminTag.trim().toUpperCase() || `ADMIN-${username.toUpperCase().slice(0, 8)}`;
    const password = newAdminPassword;
    const pin = newAdminPin.trim();

    if (!username || !displayName) {
      showToast('error', 'Ingresa el usuario y nombre visible del Administrador.');
      return;
    }
    if (password.length < 8) {
      showToast('error', 'La contraseña del Administrador debe tener al menos 8 caracteres.');
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      showToast('error', 'El PIN 2FA es obligatorio y debe contener entre 4 y 8 dígitos numéricos.');
      return;
    }

    setCreatingAdmin(true);
    try {
      const res = await createAccount({
        masterPassword: '',
        username,
        displayName,
        role: 'admin',
        tag,
        password,
        confirmPassword: password,
        ...(pin ? { pin } : {}),
      });
      let latestState = res.state;
      // Ensure PIN is applied cleanly if provided and account still reports !hasPin
      if (pin && res.account?.id && !res.account.hasPin) {
        const pinRes = await aiManagerUpdateAccountCredentials(res.account.id, { newPin: pin });
        latestState = pinRes.state;
      }
      onStateUpdated(latestState);
      setCreateAdminOpen(false);
      setNewAdminUsername('');
      setNewAdminDisplayName('');
      setNewAdminTag('');
      setNewAdminPassword('');
      setNewAdminPin('');
      showToast('success', `Administrador "${displayName}" creado sin contraseña maestra.`);
      void loadHealth();
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo crear la cuenta de Administrador.'
      );
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Handlers: Maintenance
  const handleDownloadBackup = async () => {
    if (downloadingBackup) return;
    setDownloadingBackup(true);
    try {
      const snapshot = await downloadSystemBackup();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ciprian-backup-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('success', 'Backup JSON descargado correctamente (sin hashes ni secretos).');
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo descargar el respaldo JSON.'
      );
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handlePurgeAlerts = async (scope: 'resolved' | 'all') => {
    if (purgingAlerts) return;
    if (scope === 'all' && !confirmPurgeAllAlerts) {
      setConfirmPurgeAllAlerts(true);
      return;
    }
    setPurgingAlerts(scope);
    setConfirmPurgeAllAlerts(false);
    try {
      const res = await aiManagerPurgeAlerts(scope);
      onStateUpdated(res.state);
      showToast(
        'success',
        scope === 'all'
          ? `Se purgaron todas las alertas (${res.removed} eliminadas).`
          : `Alertas resueltas purgadas (${res.removed} eliminadas).`
      );
      void loadHealth();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'No se pudieron purgar las alertas.');
    } finally {
      setPurgingAlerts(null);
    }
  };

  const handleClearActivity = async () => {
    if (clearingActivity) return;
    if (!confirmClearActivity) {
      setConfirmClearActivity(true);
      return;
    }
    setClearingActivity(true);
    setConfirmClearActivity(false);
    try {
      const res = await aiManagerClearActivity();
      onStateUpdated(res.state);
      showToast('success', `Registro de actividad limpiado (${res.removed} entradas eliminadas).`);
      void loadHealth();
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo limpiar el registro de actividad.'
      );
    } finally {
      setClearingActivity(false);
    }
  };

  // Handlers: Mi Cuenta AI
  const handleSaveSelfAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSelf) return;

    const targetId =
      currentUser?.userId ||
      allAccounts.find((a) => a.role === 'ai_manager')?.id ||
      'ai-manager-juan';

    const payload: {
      displayName?: string;
      username?: string;
      newPassword?: string;
    } = {};

    const cleanName = selfDisplayName.trim();
    const cleanUser = selfUsername.trim();
    const cleanPass = selfNewPassword;

    if (cleanName && cleanName !== (currentUser?.displayName || '')) {
      payload.displayName = cleanName;
    }
    if (cleanUser && cleanUser !== (currentUser?.username || '')) {
      payload.username = cleanUser;
    }
    if (cleanPass) {
      if (cleanPass.length < 8) {
        showToast('error', 'La nueva contraseña AI Manager debe tener al menos 8 caracteres.');
        return;
      }
      if (cleanPass !== selfConfirmPassword) {
        showToast('error', 'La confirmación de contraseña no coincide.');
        return;
      }
      payload.newPassword = cleanPass;
    }

    if (Object.keys(payload).length === 0) {
      showToast('error', 'Modifica al menos un campo para actualizar tu cuenta AI.');
      return;
    }

    setSavingSelf(true);
    try {
      const res = await aiManagerUpdateAccountCredentials(targetId, payload);
      onStateUpdated(res.state);
      if (res.sessionToken) {
        onSessionTokenUpdated?.(res.sessionToken, res.account?.username || cleanUser);
      }
      setSelfNewPassword('');
      setSelfConfirmPassword('');
      showToast('success', res.message || 'Cuenta AI Manager actualizada correctamente.');
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo actualizar tu cuenta AI Manager.'
      );
    } finally {
      setSavingSelf(false);
    }
  };

  const healthCounts = health?.counts;
  const kpiCards = [
    { label: 'Admins', value: healthCounts?.admins ?? roleCounts.admins },
    { label: 'Vendedores', value: healthCounts?.vendedores ?? roleCounts.vendedores },
    { label: 'Telemarketing', value: healthCounts?.telemarketing ?? roleCounts.telemarketing },
    {
      label: 'Embajadores',
      value:
        healthCounts?.embajadores ??
        (appState.referrers ?? []).filter((r) => r.partnerType === 'embajador').length,
    },
    { label: 'Prospectos', value: healthCounts?.leads ?? appState.leads.length },
    { label: 'QRs', value: healthCounts?.qrCodes ?? (appState.qrHistory ?? []).length },
    { label: 'Visitas', value: healthCounts?.visits ?? (appState.visitLog ?? []).length },
    {
      label: 'Alertas Abiertas',
      value:
        healthCounts?.openAlerts ??
        (appState.securityAlerts ?? []).filter((a) => a.status === 'open').length,
    },
    { label: 'Registro', value: healthCounts?.activityLogs ?? (appState.activityLogs ?? []).length },
    {
      label: 'Regalos Activos',
      value:
        healthCounts !== undefined
          ? `${healthCounts.activeGifts}/${healthCounts.totalGifts}`
          : `${appState.gifts.filter((g) => g.active).length}/${appState.gifts.length}`,
    },
  ];

  const subTabs: Array<{
    id: AiSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }> = [
    { id: 'public_controls', label: 'Control Público', icon: Sliders },
    { id: 'admins_access', label: 'Admins y Accesos', icon: Users, badge: roleCounts.admins },
    {
      id: 'embajadores_transfer',
      label: 'Embajadores y Traspasos',
      icon: ArrowRightLeft,
      badge: embajadorRows.length,
    },
    { id: 'monitoring', label: 'Monitoreo y Procesos', icon: Activity },
    { id: 'my_account', label: 'Mi Cuenta AI', icon: UserCog },
  ];

  return (
    <div className="space-y-4">
      {/* Compact Imperial Gold Header Strip & 4 Sleek Sub-Tabs */}
      <section className="dsb-glass relative overflow-hidden rounded-[22px] sm:rounded-[26px] border border-[#C8962E]/35">
        <div
          className="h-1.5 w-full"
          style={{
            background: 'linear-gradient(90deg, #3D2806 0%, #8A5E11 32%, #D4A437 68%, #F7DC88 100%)',
          }}
        />
        <div className="p-3.5 sm:p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <RoleSymbolSvg role="ai_manager" className="w-10 h-10 sm:w-11 sm:h-11" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#22150E] truncate">
                    Centro AI · Control Supremo
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#C8962E]/40 bg-[#C8962E]/14 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8A5610]">
                    <Crown className="h-3 w-3" />
                    24K Imperial
                  </span>
                </div>
                <p className="text-xs text-[#6B5447] truncate">
                  {currentUser?.displayName || 'Juan Orozco'} · Autoridad total sin confirmación de contraseña
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                  currentControls.publicFormEnabled
                    ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700'
                    : 'border-amber-500/40 bg-amber-500/15 text-amber-800'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    currentControls.publicFormEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {currentControls.publicFormEnabled ? 'Formulario Público Activo' : 'Formulario Pausado'}
              </span>
            </div>
          </div>

          {/* 5 Sub-Tabs Navigation Bar */}
          <div
            role="tablist"
            aria-label="Secciones Centro AI"
            className="grid grid-cols-2 md:grid-cols-5 gap-1.5 rounded-2xl border border-[#C8962E]/25 bg-black/[0.04] p-1"
          >
            {subTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const active = activeSubTab === tab.id;
              const isLast = idx === subTabs.length - 1;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSubTab(tab.id)}
                  data-preserve-surface={active ? 'true' : undefined}
                  className={`min-h-[42px] min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] xl:text-xs font-bold transition-all cursor-pointer ${
                    isLast ? 'col-span-2 md:col-span-1' : ''
                  } ${
                    active
                      ? 'bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] text-white shadow-[0_6px_20px_-4px_rgba(184,134,30,0.58),inset_0_1px_0_rgba(255,244,200,0.45)] border border-[#F5D67B]/55'
                      : 'text-[#594133] hover:bg-white/50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                        active ? 'bg-black/25 text-[#FFF6D1]' : 'bg-[#C8962E]/15 text-[#8A5610]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Instant Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="status"
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-xs font-semibold shadow-sm ${
              feedback.type === 'success'
                ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-800'
                : 'border-rose-500/40 bg-rose-500/14 text-rose-800'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              )}
              <span className="truncate">{feedback.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Cerrar aviso"
              className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUB-TAB 1: CONTROL PÚBLICO */}
      {activeSubTab === 'public_controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* 5 Instant Live Toggles */}
          <div className="lg:col-span-7 dsb-glass rounded-[22px] p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-1">
              <div>
                <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E]">
                  Interruptores en Vivo
                </h3>
                <p className="text-[11px] text-[#6B5447]">
                  Cada cambio se guarda al instante y afecta el flujo público inmediatamente.
                </p>
              </div>
              <span className="rounded-full border border-[#C8962E]/35 bg-[#C8962E]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8A5610]">
                Tiempo Real
              </span>
            </div>

            <div className="space-y-2">
              {PUBLIC_CONTROL_ITEMS.map((item) => {
                const Icon = item.icon;
                const enabled = Boolean(currentControls[item.key]);
                const isBusy = savingControlKey === item.key;

                return (
                  <div
                    key={item.key}
                    className="dsb-glass-subtle flex items-center justify-between gap-3 rounded-2xl border border-[#C8962E]/20 px-3.5 py-3 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                          enabled
                            ? 'border-[#C8962E]/40 bg-[#C8962E]/15 text-[#8A5610]'
                            : 'border-slate-400/25 bg-slate-500/10 text-slate-500'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-[#22150E]">
                            {item.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              enabled
                                ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                                : 'bg-rose-500/14 text-rose-700 border border-rose-500/30'
                            }`}
                          >
                            {enabled ? `ON · ${item.activeText}` : `OFF · ${item.pausedText}`}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#6B5447] leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={item.label}
                      disabled={isBusy}
                      onClick={() => void handleToggleControl(item.key)}
                      data-preserve-surface="true"
                      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-all cursor-pointer disabled:opacity-60 ${
                        enabled
                          ? 'border-[#F5D67B]/70 bg-gradient-to-r from-[#8A5E11] to-[#D4A437] shadow-[0_4px_14px_-3px_rgba(200,150,46,0.65)]'
                          : isDark
                            ? 'border-white/15 bg-white/10'
                            : 'border-stone-300 bg-stone-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                          enabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inline Editable Pause Title & Message */}
          <form
            onSubmit={handleSavePauseCopy}
            className="lg:col-span-5 dsb-glass rounded-[22px] p-4 sm:p-5 space-y-3.5"
          >
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E]">
                Mensaje de Pausa Pública
              </h3>
              <p className="text-[11px] text-[#6B5447]">
                Visible cuando <strong className="font-semibold">Pantalla del Formulario Público</strong> está en OFF.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-pause-title"
                className="block text-xs font-bold text-[#594133]"
              >
                Título de Pausa
              </label>
              <input
                id="ai-pause-title"
                type="text"
                maxLength={120}
                value={pauseTitle}
                onChange={(e) => setPauseTitle(e.target.value)}
                placeholder={DEFAULT_PROCESS_CONTROLS.publicFormDisabledTitle}
                className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/30 bg-white/80 px-3 py-2 text-base sm:text-sm text-[#22150E] focus:border-[#C8962E] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-pause-message"
                className="block text-xs font-bold text-[#594133]"
              >
                Mensaje para los Invitados
              </label>
              <textarea
                id="ai-pause-message"
                rows={3}
                maxLength={360}
                value={pauseMessage}
                onChange={(e) => setPauseMessage(e.target.value)}
                placeholder={DEFAULT_PROCESS_CONTROLS.publicFormDisabledMessage}
                className="w-full rounded-xl border border-[#C8962E]/30 bg-white/80 px-3 py-2 text-base sm:text-sm text-[#22150E] focus:border-[#C8962E] focus:outline-none resize-none"
              />
            </div>

            {/* Compact Live Mini-Preview */}
            <div className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/25 p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A5610]">
                Vista previa en pausa
              </span>
              <p className="mt-1 font-serif text-sm font-bold text-[#22150E] truncate">
                {pauseTitle.trim() || DEFAULT_PROCESS_CONTROLS.publicFormDisabledTitle}
              </p>
              <p className="mt-0.5 text-[11px] text-[#6B5447] line-clamp-2">
                {pauseMessage.trim() || DEFAULT_PROCESS_CONTROLS.publicFormDisabledMessage}
              </p>
            </div>

            <button
              type="submit"
              disabled={savingPauseCopy}
              data-preserve-surface="true"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] px-5 py-2.5 text-xs font-bold text-white shadow-[0_6px_18px_-4px_rgba(184,134,30,0.55)] border border-[#F5D67B]/45 hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {savingPauseCopy ? 'Guardando mensaje...' : 'Guardar Título y Mensaje'}
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 2: ADMINS Y ACCESOS */}
      {activeSubTab === 'admins_access' && (
        <div className="space-y-4">
          {/* Toolbar: Search, Filters & Create Admin */}
          <div className="dsb-glass rounded-[22px] p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A5610]" />
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Buscar por nombre, usuario o tag..."
                  className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/25 bg-white/80 pl-9 pr-3 py-2 text-base sm:text-sm text-[#22150E] focus:border-[#C8962E] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    { id: 'all', label: `Todos (${allAccounts.filter((a) => a.role !== 'ai_manager').length})` },
                    { id: 'admin', label: `Admins (${roleCounts.admins})` },
                    { id: 'vendedor', label: `Vendedores (${roleCounts.vendedores})` },
                    { id: 'telemarketing', label: `TMK (${roleCounts.telemarketing})` },
                  ] as Array<{ id: AccountFilterRole; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRoleFilter(f.id)}
                    className={`min-h-[36px] rounded-xl px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer border ${
                      roleFilter === f.id
                        ? 'border-[#C8962E]/50 bg-[#C8962E]/18 text-[#8A5610]'
                        : 'border-transparent bg-black/[0.04] text-[#6B5447] hover:bg-black/[0.08]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {onCreateAdminClick && (
                <button
                  type="button"
                  onClick={() => onCreateAdminClick()}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full border border-[#C8962E]/35 bg-[#C8962E]/10 px-3.5 py-2 text-xs font-bold text-[#8A5610] hover:bg-[#C8962E]/18 transition-colors cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                  Ir a Cuentas
                </button>
              )}
              <button
                type="button"
                onClick={() => setCreateAdminOpen(true)}
                data-preserve-surface="true"
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] px-4 py-2 text-xs font-bold text-white shadow-[0_6px_18px_-4px_rgba(184,134,30,0.55)] border border-[#F5D67B]/50 hover:brightness-105 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Crear Administrador
              </button>
            </div>
          </div>

          {/* Prominent Administrators Section */}
          {(roleFilter === 'all' || roleFilter === 'admin') && (
            <div className="dsb-glass rounded-[22px] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-[#8A5610]" />
                  <h3 className="font-serif text-base font-bold text-[#22150E]">
                    Cuentas Administradoras ({filteredAdmins.length})
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-[#6B5447]">
                  Control exclusivo AI Manager (Clave + PIN 2FA)
                </span>
              </div>

              {filteredAdmins.length === 0 ? (
                <p className="text-xs text-[#6B5447] py-3 text-center">
                  No se encontraron cuentas administradoras con ese filtro.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredAdmins.map((admin) => {
                    const isBusy = busyAccountId === admin.id;
                    return (
                      <div
                        key={admin.id}
                        className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/28 p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-[#22150E] truncate">
                                {admin.displayName}
                              </span>
                              <span className="rounded-md border border-[#C8962E]/35 bg-[#C8962E]/14 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8A5610]">
                                {admin.tag}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-[#6B5447] mt-0.5">
                              @{admin.username}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                admin.hasPin
                                  ? 'border-[#C8962E]/35 bg-[#C8962E]/12 text-[#8A5610]'
                                  : 'border-slate-400/30 bg-slate-500/10 text-slate-500'
                              }`}
                            >
                              {admin.hasPin ? 'PIN 2FA' : 'Sin PIN'}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                admin.active
                                  ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-700'
                                  : 'border-rose-500/30 bg-rose-500/12 text-rose-700'
                              }`}
                            >
                              {admin.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#C8962E]/15">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditCredentialsModal(admin)}
                            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#C8962E]/35 bg-[#C8962E]/14 px-2.5 py-1.5 text-[11px] font-bold text-[#8A5610] hover:bg-[#C8962E]/22 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Cambiar Clave / PIN
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleRevokeSession(admin)}
                            className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/12 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Expulsar sesión
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleAccountActive(admin)}
                            className={`inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                              admin.active
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/18'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/18'
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {admin.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Filterable Non-Admin Accounts */}
          {roleFilter !== 'admin' && (
            <div className="dsb-glass rounded-[22px] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-base font-bold text-[#22150E]">
                  Equipo Operativo ({filteredNonAdmins.length})
                </h3>
                {totalNonAdminPages > 1 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      disabled={otherAccountsPage <= 1}
                      onClick={() => setOtherAccountsPage((p) => Math.max(1, p - 1))}
                      aria-label="Página anterior"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C8962E]/25 hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="font-mono text-[11px] font-semibold text-[#594133]">
                      {Math.min(otherAccountsPage, totalNonAdminPages)} / {totalNonAdminPages}
                    </span>
                    <button
                      type="button"
                      disabled={otherAccountsPage >= totalNonAdminPages}
                      onClick={() => setOtherAccountsPage((p) => Math.min(totalNonAdminPages, p + 1))}
                      aria-label="Página siguiente"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C8962E]/25 hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {pagedNonAdmins.length === 0 ? (
                <p className="text-xs text-[#6B5447] py-3 text-center">
                  No hay cuentas operativas que coincidan con el filtro.
                </p>
              ) : (
                <div className="space-y-2">
                  {pagedNonAdmins.map((acc) => {
                    const roleBadge = getRoleBadgeMeta(acc.role);
                    const isBusy = busyAccountId === acc.id;
                    return (
                      <div
                        key={acc.id}
                        className="dsb-glass-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-white/15 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold shrink-0 ${roleBadge.className}`}
                          >
                            {roleBadge.label}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-[#22150E] truncate">
                                {acc.displayName}
                              </span>
                              <span className="font-mono text-[11px] text-[#6B5447]">
                                @{acc.username}
                              </span>
                              <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#594133]">
                                {acc.tag}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditCredentialsModal(acc)}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[#C8962E]/30 bg-[#C8962E]/12 px-2.5 py-1 text-[11px] font-bold text-[#8A5610] hover:bg-[#C8962E]/20 cursor-pointer disabled:opacity-50"
                          >
                            <KeyRound className="h-3 w-3" />
                            Clave
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleRevokeSession(acc)}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-500/18 cursor-pointer disabled:opacity-50"
                          >
                            <LogOut className="h-3 w-3" />
                            Expulsar
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleAccountActive(acc)}
                            className={`inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                              acc.active
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/18'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/18'
                            }`}
                          >
                            <Power className="h-3 w-3" />
                            {acc.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: EMBAJADORES Y TRASPASOS */}
      {activeSubTab === 'embajadores_transfer' && (
        <div className="space-y-4">
          {/* Header & Explanation Card */}
          <div className="dsb-glass rounded-[22px] p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C8962E]/40 bg-[#C8962E]/15 text-[#8A5610]">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E]">
                      Embajadores y Traspasos
                    </h3>
                    <span className="rounded-full border border-[#C8962E]/35 bg-[#C8962E]/12 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#8A5610] tabular-nums">
                      {embajadorRows.length}{' '}
                      {embajadorRows.length === 1 ? 'embajador' : 'embajadores'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B5447] leading-relaxed">
                    Cambia cualquier Embajador a otro Vendedor en 1 clic. Todos sus prospectos históricos y códigos QR pasarán automáticamente al Vendedor destino.
                  </p>
                </div>
              </div>

              <span className="inline-flex self-start shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-3 py-1 text-[11px] font-bold text-emerald-700">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                Traspaso directo · 0 claves
              </span>
            </div>

            {/* Crisp Emerald/Gold Transfer Success Banner */}
            <AnimatePresence>
              {transferBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  role="status"
                  className="rounded-2xl border border-emerald-500/35 bg-emerald-50 px-3.5 py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-700" />
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs font-bold text-emerald-800 leading-snug break-words">
                        {transferBanner.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[#C8962E]/35 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-[#8A5610] tabular-nums">
                          {transferBanner.movedLeadsCount}{' '}
                          {transferBanner.movedLeadsCount === 1 ? 'prospecto' : 'prospectos'} traspasados
                        </span>
                        <span className="rounded-full border border-[#C8962E]/35 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-[#8A5610] tabular-nums">
                          {transferBanner.movedQrsCount}{' '}
                          {transferBanner.movedQrsCount === 1 ? 'QR' : 'QRs'} traspasados
                        </span>
                        <span className="text-[10.5px] font-semibold text-emerald-700">
                          {transferBanner.previousOwnerName} → {transferBanner.newOwnerName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTransferBanner(null)}
                    aria-label="Cerrar confirmación de traspaso"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compact Search & Vendedor Filter Toolbar */}
            {embajadorRows.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-0.5">
                <div className="relative sm:col-span-7 min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A5610]" />
                  <input
                    type="text"
                    value={embajadorSearch}
                    onChange={(e) => setEmbajadorSearch(e.target.value)}
                    placeholder="Buscar Embajador por nombre o código QR..."
                    aria-label="Buscar Embajador por nombre o código QR"
                    className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/25 bg-white/80 pl-9 pr-9 py-2 text-base sm:text-xs text-[#22150E] placeholder:text-[#6B5447] focus:border-[#C8962E] focus:outline-none"
                  />
                  {embajadorSearch && (
                    <button
                      type="button"
                      onClick={() => setEmbajadorSearch('')}
                      aria-label="Limpiar búsqueda de embajadores"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[#6B5447] hover:bg-black/5 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="relative sm:col-span-5 min-w-0 flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A5610]" />
                    <select
                      aria-label="Filtrar por vendedor actual"
                      value={embajadorOwnerFilter}
                      onChange={(e) => setEmbajadorOwnerFilter(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/25 bg-white/80 pl-8 pr-3 py-2 text-base sm:text-xs font-semibold text-[#22150E] focus:border-[#C8962E] focus:outline-none cursor-pointer"
                    >
                      <option value="all">
                        Todos los vendedores ({embajadorRows.length})
                      </option>
                      <option value="__direct__">
                        Ciprian Directo ({embajadorOwnerCounts.direct})
                      </option>
                      {vendedorAccounts.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.displayName} ({v.tag}) · {embajadorOwnerCounts.byVendedorId.get(v.id) ?? 0}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(embajadorSearch.trim() || embajadorOwnerFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmbajadorSearch('');
                        setEmbajadorOwnerFilter('all');
                      }}
                      title="Limpiar filtros"
                      aria-label="Limpiar filtros de embajadores"
                      className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-xl border border-[#C8962E]/30 bg-[#C8962E]/10 px-3 text-xs font-bold text-[#8A5610] hover:bg-[#C8962E]/18 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Embajadores List / Empty State */}
          <div className="dsb-glass rounded-[22px] p-4 sm:p-5 space-y-3">
            {embajadorRows.length === 0 ? (
              <div className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/20 py-10 px-4 text-center space-y-2.5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#C8962E]/35 bg-[#C8962E]/12 text-[#8A5610]">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <p className="font-serif text-base font-bold text-[#22150E]">
                  Aún no hay Embajadores creados
                </p>
                <p className="text-xs text-[#6B5447] max-w-md mx-auto leading-relaxed">
                  Cuando se registren Embajadores desde el Estudio QR o desde un Vendedor, aparecerán aquí para transferirlos en 1 clic junto con todos sus prospectos y códigos QR.
                </p>
              </div>
            ) : filteredEmbajadorRows.length === 0 ? (
              <div className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/20 py-8 px-4 text-center space-y-2.5">
                <p className="text-sm font-bold text-[#22150E]">
                  No hay Embajadores que coincidan con tu búsqueda
                </p>
                <p className="text-xs text-[#6B5447]">
                  Ajusta el filtro de vendedor actual o limpia el texto de búsqueda.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmbajadorSearch('');
                    setEmbajadorOwnerFilter('all');
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#C8962E]/35 bg-[#C8962E]/12 px-3.5 py-1.5 text-xs font-bold text-[#8A5610] hover:bg-[#C8962E]/20 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restablecer filtros
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#594133] tabular-nums">
                    Mostrando {pagedEmbajadorRows.length} de {filteredEmbajadorRows.length}{' '}
                    {filteredEmbajadorRows.length === 1 ? 'embajador' : 'embajadores'}
                    {filteredEmbajadorRows.length !== embajadorRows.length
                      ? ` (total ${embajadorRows.length})`
                      : ''}
                  </span>
                  {totalEmbajadorPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeEmbajadoresPage <= 1}
                        onClick={() => setEmbajadoresPage((p) => Math.max(1, p - 1))}
                        aria-label="Página anterior de embajadores"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C8962E]/25 text-[#594133] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-[11px] font-bold text-[#594133] tabular-nums">
                        {safeEmbajadoresPage} / {totalEmbajadorPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeEmbajadoresPage >= totalEmbajadorPages}
                        onClick={() =>
                          setEmbajadoresPage((p) => Math.min(totalEmbajadorPages, p + 1))
                        }
                        aria-label="Página siguiente de embajadores"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C8962E]/25 text-[#594133] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  {pagedEmbajadorRows.map((row) => {
                    const { embajador, owner, leadsCount, qrCount, visitsCount, ordenesCount } = row;
                    const currentOwnerId = owner.accountId || '';
                    const selectedTarget =
                      embajador.id in selectedTargets
                        ? selectedTargets[embajador.id]
                        : currentOwnerId;
                    const isUnchanged = selectedTarget === currentOwnerId;
                    const isSubmittingThis = transferringId === embajador.id;
                    const isDisabled = isUnchanged || transferringId !== null;

                    return (
                      <div
                        key={embajador.id}
                        className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/22 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      >
                        {/* Left side: Avatar + identity + current owner + compact metric chips */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <AmbassadorAvatar
                            name={embajador.name}
                            avatarUrl={embajador.avatarUrl}
                            emoji={embajador.emoji}
                            size="md"
                            ring="gold"
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-[#22150E] break-words">
                                {embajador.name}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md border border-[#C8962E]/35 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8A5610]">
                                <QrCode className="h-2.5 w-2.5 shrink-0" />
                                {embajador.code}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  embajador.active
                                    ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
                                    : 'border-rose-500/30 bg-rose-50 text-rose-700'
                                }`}
                              >
                                {embajador.active ? 'Activo' : 'Pausado'}
                              </span>
                            </div>

                            {/* Current owner badge */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                                  owner.isDirect
                                    ? 'border-amber-300 bg-amber-50 text-[#8A5610]'
                                    : 'border-emerald-500/30 bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                Vendedor actual: {owner.name}
                                {owner.tag ? ` (${owner.tag})` : ''}
                              </span>
                            </div>

                            {/* Compact metric chips */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold tabular-nums">
                              <span className="rounded-lg border border-slate-200 bg-white/70 px-2 py-0.5 text-[#594133]">
                                <strong className="font-bold text-[#22150E]">{leadsCount}</strong>{' '}
                                prospectos
                              </span>
                              <span className="rounded-lg border border-slate-200 bg-white/70 px-2 py-0.5 text-[#594133]">
                                <strong className="font-bold text-[#22150E]">{qrCount}</strong>{' '}
                                QRs
                              </span>
                              <span className="rounded-lg border border-slate-200 bg-white/70 px-2 py-0.5 text-[#594133]">
                                <strong className="font-bold text-[#22150E]">{visitsCount}</strong>{' '}
                                visitas
                              </span>
                              <span className="rounded-lg border border-slate-200 bg-white/70 px-2 py-0.5 text-[#594133]">
                                <strong className="font-bold text-[#22150E]">{ordenesCount}</strong>{' '}
                                órdenes
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right side: Target Vendedor selector + 1-click Transferir button */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 lg:min-w-[330px] pt-2 lg:pt-0 border-t lg:border-t-0 border-[#C8962E]/15">
                          <select
                            aria-label={`Vendedor destino para ${embajador.name}`}
                            disabled={transferringId !== null}
                            value={selectedTarget}
                            onChange={(e) =>
                              setSelectedTargets((prev) => ({
                                ...prev,
                                [embajador.id]: e.target.value,
                              }))
                            }
                            className="w-full sm:flex-1 lg:w-[220px] min-h-[40px] rounded-xl border border-[#C8962E]/30 bg-white/85 px-3 py-2 text-base sm:text-xs font-semibold text-[#22150E] focus:border-[#C8962E] focus:outline-none cursor-pointer disabled:opacity-60"
                          >
                            <option value="">Ciprian Directo (sin vendedor)</option>
                            {vendedorAccounts.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.displayName} ({v.tag}){v.active ? '' : ' · Inactivo'}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={() =>
                              void handleReassignEmbajador(
                                embajador.id,
                                selectedTarget ? selectedTarget : null
                              )
                            }
                            data-preserve-surface={!isDisabled ? 'true' : undefined}
                            data-dsb-disabled-control={isDisabled ? 'true' : undefined}
                            className={`inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                              isDisabled
                                ? 'border border-stone-300/80 bg-stone-100/80 text-stone-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] text-white shadow-[0_6px_18px_-4px_rgba(184,134,30,0.55)] border border-[#F5D67B]/55 hover:brightness-105 cursor-pointer'
                            }`}
                          >
                            {isSubmittingThis ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                            ) : (
                              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span>{isSubmittingThis ? 'Transfiriendo...' : 'Transferir'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalEmbajadorPages > 1 && (
                  <div className="pt-2.5 border-t border-[#C8962E]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#6B5447] tabular-nums">
                      Página {safeEmbajadoresPage} de {totalEmbajadorPages} ·{' '}
                      {filteredEmbajadorRows.length}{' '}
                      {filteredEmbajadorRows.length === 1 ? 'embajador' : 'embajadores'}
                    </span>
                    <div className="flex items-center justify-between sm:justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={safeEmbajadoresPage <= 1}
                        onClick={() => setEmbajadoresPage((p) => Math.max(1, p - 1))}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#C8962E]/30 bg-white/75 px-3 py-1 text-xs font-bold text-[#594133] hover:bg-white cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={safeEmbajadoresPage >= totalEmbajadorPages}
                        onClick={() =>
                          setEmbajadoresPage((p) => Math.min(totalEmbajadorPages, p + 1))
                        }
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#C8962E]/30 bg-white/75 px-3 py-1 text-xs font-bold text-[#594133] hover:bg-white cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        Siguiente
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MONITOREO Y PROCESOS */}
      {activeSubTab === 'monitoring' && (
        <div className="space-y-4">
          {/* Live Health Status Strip + KPI Grid */}
          <div className="dsb-glass rounded-[22px] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                    health?.storage === 'supabase'
                      ? 'border-emerald-500/35 bg-emerald-500/14 text-emerald-700'
                      : 'border-amber-500/35 bg-amber-500/14 text-amber-800'
                  }`}
                >
                  <Database className="h-3.5 w-3.5" />
                  {health?.storage === 'supabase' ? 'Supabase Conectado' : 'Almacenamiento Local'}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8962E]/30 bg-[#C8962E]/10 px-3 py-1 text-xs font-semibold text-[#8A5610]">
                  <Clock className="h-3.5 w-3.5" />
                  Uptime: {health ? formatUptime(health.uptimeSeconds) : '—'}
                </span>

                {health?.timestamp && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#6B5447]">
                    <Server className="h-3 w-3" />
                    {new Date(health.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={loadingHealth}
                onClick={() => void loadHealth()}
                className="inline-flex min-h-[38px] self-start sm:self-auto items-center gap-1.5 rounded-full border border-[#C8962E]/35 bg-[#C8962E]/14 px-3.5 py-1.5 text-xs font-bold text-[#8A5610] hover:bg-[#C8962E]/22 transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
                {loadingHealth ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            {healthError && (
              <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-700">
                {healthError}
              </div>
            )}

            {/* 10 Exact System Counts KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {kpiCards.map((kpi) => (
                <div
                  key={kpi.label}
                  className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/20 px-3 py-2.5"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B5447] truncate">
                    {kpi.label}
                  </p>
                  <p className="mt-1 font-mono text-lg sm:text-xl font-extrabold tabular-nums text-[#22150E]">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 2x2 Compact Quick Maintenance Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Download JSON Backup */}
            <div className="dsb-glass rounded-[20px] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C8962E]/35 bg-[#C8962E]/14 text-[#8A5610]">
                  <Download className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#22150E]">Descargar Backup JSON</h4>
                  <p className="mt-0.5 text-[11px] text-[#6B5447] leading-snug">
                    Exporta una copia íntegra de prospectos, cuentas (sin hashes), QRs, regalos y ajustes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={downloadingBackup}
                onClick={() => void handleDownloadBackup()}
                data-preserve-surface="true"
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] px-4 py-2 text-xs font-bold text-white border border-[#F5D67B]/45 hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {downloadingBackup ? 'Generando respaldo...' : 'Descargar Backup JSON'}
              </button>
            </div>

            {/* 2. Purge Alerts */}
            <div className="dsb-glass rounded-[20px] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/12 text-amber-800">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#22150E]">Purgar Alertas de Seguridad</h4>
                  <p className="mt-0.5 text-[11px] text-[#6B5447] leading-snug">
                    Limpia alertas ya revisadas/descartadas o vacía todo el historial de seguridad.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={purgingAlerts !== null}
                  onClick={() => void handlePurgeAlerts('resolved')}
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#C8962E]/35 bg-[#C8962E]/14 px-3 py-2 text-xs font-bold text-[#8A5610] hover:bg-[#C8962E]/22 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {purgingAlerts === 'resolved' ? 'Purgando...' : 'Solo Resueltas'}
                </button>
                <button
                  type="button"
                  disabled={purgingAlerts !== null}
                  onClick={() => void handlePurgeAlerts('all')}
                  onBlur={() => setConfirmPurgeAllAlerts(false)}
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/12 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {purgingAlerts === 'all'
                    ? 'Purgando...'
                    : confirmPurgeAllAlerts
                      ? 'Confirmar Todas'
                      : 'Purgar Todas'}
                </button>
              </div>
            </div>

            {/* 3. Clear Activity Log */}
            <div className="dsb-glass rounded-[20px] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/12 text-[#0B4F6C]">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#22150E]">Limpiar Registro de Actividad</h4>
                  <p className="mt-0.5 text-[11px] text-[#6B5447] leading-snug">
                    Elimina el historial de eventos de auditoría manteniendo un asiento de limpieza AI.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={clearingActivity}
                onClick={() => void handleClearActivity()}
                onBlur={() => setConfirmClearActivity(false)}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/14 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-500/22 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearingActivity
                  ? 'Limpiando registro...'
                  : confirmClearActivity
                    ? 'Clic de nuevo para confirmar limpieza'
                    : 'Limpiar Registro de Actividad'}
              </button>
            </div>

            {/* 4. Master Reset to 0 */}
            <div className="dsb-glass rounded-[20px] p-4 flex flex-col justify-between gap-3 border border-rose-500/25">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/35 bg-rose-500/14 text-rose-700">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#22150E]">Reinicio Maestro a 0</h4>
                  <p className="mt-0.5 text-[11px] text-[#6B5447] leading-snug">
                    Restablece prospectos, métricas e historial QR a 0 en 1 clic sin pedir contraseña.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={!onOpenMasterReset}
                onClick={() => onOpenMasterReset?.()}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/14 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-500/22 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Abrir Reinicio Maestro (Sin Clave)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MI CUENTA AI */}
      {activeSubTab === 'my_account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Identity Card */}
          <div className="lg:col-span-5 dsb-glass rounded-[22px] p-5 space-y-4">
            <div className="flex items-center gap-3.5">
              <RoleSymbolSvg role="ai_manager" className="w-14 h-14 shrink-0" />
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C8962E]/40 bg-[#C8962E]/14 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8A5610]">
                  <Sparkles className="h-3 w-3" />
                  AI MANAGER
                </span>
                <h3 className="mt-1 font-serif text-lg font-bold text-[#22150E] truncate">
                  {currentUser?.displayName || 'Juan Orozco'}
                </h3>
                <p className="font-mono text-xs text-[#6B5447]">
                  @{currentUser?.username || 'JuanOrozco'} · {currentUser?.tag || 'AI-MANAGER'}
                </p>
              </div>
            </div>

            <div className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/25 p-3.5 space-y-2 text-xs text-[#594133]">
              <div className="flex items-center justify-between">
                <span className="text-[#6B5447]">Autenticación:</span>
                <span className="font-bold text-[#8A5610]">2FA Cognitivo (Pregunta Aleatoria)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B5447]">Banco Activo:</span>
                <span className="font-bold text-[#22150E]">
                  {secQuestions.length > 0 ? `${secQuestions.length} preguntas cifradas` : '5 preguntas cifradas'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B5447]">Privilegios:</span>
                <span className="font-bold text-emerald-700">Supremo · 0 Claves</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B5447]">Visibilidad ante Admins:</span>
                <span className="font-bold text-[#22150E]">Oculta (Silenciosa)</span>
              </div>
            </div>
          </div>

          {/* Self-service Update Form */}
          <form
            onSubmit={handleSaveSelfAccount}
            className="lg:col-span-7 dsb-glass rounded-[22px] p-5 space-y-3.5"
            autoComplete="off"
          >
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E]">
                Actualizar Mis Credenciales AI
              </h3>
              <p className="text-[11px] text-[#6B5447]">
                Tu sesión activa se renovará automáticamente al guardar los cambios.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="ai-self-name" className="block text-xs font-bold text-[#594133]">
                  Nombre Visible
                </label>
                <input
                  id="ai-self-name"
                  type="text"
                  value={selfDisplayName}
                  onChange={(e) => setSelfDisplayName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/30 bg-white/80 px-3 py-2 text-base sm:text-sm text-[#22150E] focus:border-[#C8962E] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-self-username" className="block text-xs font-bold text-[#594133]">
                  Usuario de Acceso
                </label>
                <input
                  id="ai-self-username"
                  type="text"
                  value={selfUsername}
                  onChange={(e) => setSelfUsername(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/30 bg-white/80 px-3 py-2 text-base sm:text-sm text-[#22150E] focus:border-[#C8962E] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="ai-self-pass" className="block text-xs font-bold text-[#594133]">
                  Nueva Contraseña (opcional)
                </label>
                <div className="relative">
                  <input
                    id="ai-self-pass"
                    type={showSelfPassword ? 'text' : 'password'}
                    value={selfNewPassword}
                    onChange={(e) => setSelfNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/30 bg-white/80 pl-3 pr-10 py-2 text-base sm:text-sm text-[#22150E] focus:border-[#C8962E] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfPassword((prev) => !prev)}
                    aria-label={showSelfPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[#6B5447] cursor-pointer"
                  >
                    {showSelfPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-self-pass-confirm" className="block text-xs font-bold text-[#594133]">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  id="ai-self-pass-confirm"
                  type={showSelfPassword ? 'text' : 'password'}
                  value={selfConfirmPassword}
                  onChange={(e) => setSelfConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full min-h-[42px] rounded-xl border border-[#C8962E]/30 bg-white/80 px-3 py-2 text-base sm:text-sm text-[#22150E] focus:border-[#C8962E] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingSelf}
                data-preserve-surface="true"
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] px-6 py-2.5 text-xs font-bold text-white shadow-[0_6px_18px_-4px_rgba(184,134,30,0.55)] border border-[#F5D67B]/50 hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {savingSelf ? 'Guardando cambios...' : 'Guardar Cambios AI'}
              </button>
            </div>
          </form>

          {/* Cognitive 2FA Security Questions Manager */}
          <form
            onSubmit={handleSaveSecurityQuestions}
            className="lg:col-span-12 dsb-glass rounded-[22px] p-5 space-y-4"
            autoComplete="off"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E] flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-[#C8962E] shrink-0" />
                  Banco de Preguntas de Seguridad (2FA Aleatorio)
                </h3>
                <p className="text-[11px] text-[#6B5447] mt-0.5">
                  En cada inicio de sesión el sistema elige 1 pregunta al azar. Todas las respuestas se cifran con <span className="font-mono">scrypt</span> y nunca se muestran en texto plano.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSecAnswers((prev) => !prev)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#C8962E]/30 bg-[#C8962E]/10 px-3 py-1.5 text-xs font-bold text-[#8A5610] hover:bg-[#C8962E]/18 cursor-pointer"
                >
                  {showSecAnswers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showSecAnswers ? 'Ocultar nuevas' : 'Mostrar nuevas'}
                </button>
                <button
                  type="button"
                  disabled={secQuestions.length >= 12}
                  onClick={() =>
                    setSecQuestions((prev) => [
                      ...prev,
                      {
                        id: `sq-custom-${Date.now()}`,
                        type: 'custom',
                        prompt: '',
                        answer: '',
                        hasAnswer: false,
                      },
                    ])
                  }
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#C8962E]/35 bg-[#C8962E]/15 px-3 py-1.5 text-xs font-bold text-[#8A5610] hover:bg-[#C8962E]/22 cursor-pointer disabled:opacity-45"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir pregunta
                </button>
              </div>
            </div>

            {loadingSecQuestions ? (
              <p className="text-xs text-[#6B5447] py-4 text-center">Cargando banco de seguridad...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {secQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="dsb-glass-subtle rounded-2xl border border-[#C8962E]/25 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#C8962E]/18 font-mono text-[11px] font-extrabold text-[#8A5610]">
                          #{idx + 1}
                        </span>
                        <select
                          aria-label={`Tipo de pregunta ${idx + 1}`}
                          value={q.type}
                          onChange={(e) => {
                            const nextType = e.target.value as SecurityQuestionType;
                            setSecQuestions((prev) =>
                              prev.map((item) => (item.id === q.id ? { ...item, type: nextType } : item))
                            );
                          }}
                          className="min-h-[34px] rounded-lg border border-[#C8962E]/25 bg-white/80 px-2 py-1 text-xs font-bold text-[#22150E] focus:border-[#C8962E] focus:outline-none"
                        >
                          <option value="personal">Origen / Personal</option>
                          <option value="fecha">Año / Fecha Clave</option>
                          <option value="clave">Palabra Secreta</option>
                          <option value="codigo">Código Personal</option>
                          <option value="gusto">Gusto Personal</option>
                          <option value="custom">Personalizada</option>
                        </select>
                      </div>

                      {secQuestions.length > 3 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSecQuestions((prev) => prev.filter((item) => item.id !== q.id))
                          }
                          aria-label={`Eliminar pregunta ${idx + 1}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={q.prompt}
                      onChange={(e) => {
                        const nextPrompt = e.target.value;
                        setSecQuestions((prev) =>
                          prev.map((item) => (item.id === q.id ? { ...item, prompt: nextPrompt } : item))
                        );
                      }}
                      placeholder="Escribe la pregunta de seguridad..."
                      className="w-full min-h-[40px] rounded-xl border border-[#C8962E]/25 bg-white/80 px-3 py-1.5 text-base sm:text-xs font-semibold text-[#22150E] focus:border-[#C8962E] focus:outline-none"
                    />

                    <input
                      type={showSecAnswers ? 'text' : 'password'}
                      value={q.answer}
                      onChange={(e) => {
                        const nextAns = e.target.value;
                        setSecQuestions((prev) =>
                          prev.map((item) => (item.id === q.id ? { ...item, answer: nextAns } : item))
                        );
                      }}
                      placeholder={
                        q.hasAnswer
                          ? 'Respuesta cifrada guardada (escribir solo si deseas cambiarla)'
                          : 'Escribe la respuesta secreta (obligatoria)'
                      }
                      className="w-full min-h-[40px] rounded-xl border border-[#C8962E]/25 bg-white/80 px-3 py-1.5 text-base sm:text-xs text-[#22150E] placeholder:text-[#6B5447] focus:border-[#C8962E] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingSecQuestions || secQuestions.length < 3}
                data-preserve-surface="true"
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] px-6 py-2.5 text-xs font-bold text-white shadow-[0_6px_18px_-4px_rgba(184,134,30,0.55)] border border-[#F5D67B]/50 hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingSecQuestions ? 'Cifrando y guardando...' : 'Guardar Banco de Seguridad'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT ACCOUNT CREDENTIALS / PIN (ZERO PASSWORD CONFIRMATION) */}
      <AnimatePresence>
        {editingAccount && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Editar credenciales de ${editingAccount.displayName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !savingEditCreds && setEditingAccount(null)}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-[#0C0804]/78 px-3 py-4 backdrop-blur-sm overflow-y-auto"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditedCredentials}
              autoComplete="off"
              data-preserve-surface="true"
              className="relative w-full max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-[24px] border border-[#D4A437]/50 bg-gradient-to-b from-[#211509] via-[#170F07] to-[#100A05] p-5 text-[#FFFDF9] shadow-[0_32px_80px_-14px_rgba(0,0,0,0.88)] space-y-3.5"
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{
                  background: 'linear-gradient(90deg, #3D2806 0%, #8A5E11 32%, #D4A437 68%, #F7DC88 100%)',
                }}
              />

              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F7DC88]">
                    Control Directo AI · Sin Contraseña
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white">
                    {editingAccount.displayName}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={savingEditCreds}
                  onClick={() => setEditingAccount(null)}
                  aria-label="Cerrar editor de credenciales"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#D6C2A3] hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#F5D67B]">Nombre visible (opcional)</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] px-3 py-2 text-base sm:text-sm text-white focus:border-[#F5D67B] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#F5D67B]">Nuevo usuario (opcional)</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] px-3 py-2 text-base sm:text-sm text-white focus:border-[#F5D67B] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#F5D67B]">Nueva contraseña (opcional)</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    placeholder="Dejar vacío para conservar la actual"
                    className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] pl-3 pr-11 py-2 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F5D67B] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((p) => !p)}
                    aria-label={showEditPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center text-white/60 hover:text-[#F5D67B] cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {editingAccount.role === 'admin' && (
                <div className="space-y-2 rounded-2xl border border-[#F5D67B]/25 bg-white/[0.03] p-3">
                  <label className="text-xs font-bold text-[#F5D67B] block">
                    Nuevo PIN 2FA (opcional, 4–8 dígitos)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    disabled={editClearPin}
                    value={editNewPin}
                    onChange={(e) => setEditNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 1966"
                    className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] px-3 py-2 font-mono text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F5D67B] focus:outline-none disabled:opacity-45"
                  />
                  <label className="flex items-center gap-2 text-[11px] text-[#E3CEB6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editClearPin}
                      onChange={(e) => setEditClearPin(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#D4A437]"
                    />
                    Quitar PIN 2FA de esta cuenta
                  </label>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={savingEditCreds}
                  onClick={() => setEditingAccount(null)}
                  className="min-h-[42px] rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditCreds}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F5D67B] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow-lg hover:brightness-105 cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {savingEditCreds ? 'Aplicando...' : 'Aplicar Cambios'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: QUICK CREATE ADMINISTRATOR (ZERO PASSWORD CONFIRMATION) */}
      <AnimatePresence>
        {createAdminOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Crear nueva cuenta de Administrador"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !creatingAdmin && setCreateAdminOpen(false)}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-[#0C0804]/78 px-3 py-4 backdrop-blur-sm overflow-y-auto"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreateAdminSubmit}
              autoComplete="off"
              data-preserve-surface="true"
              className="relative w-full max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-[24px] border border-[#D4A437]/50 bg-gradient-to-b from-[#211509] via-[#170F07] to-[#100A05] p-5 text-[#FFFDF9] shadow-[0_32px_80px_-14px_rgba(0,0,0,0.88)] space-y-3.5"
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{
                  background: 'linear-gradient(90deg, #3D2806 0%, #8A5E11 32%, #D4A437 68%, #F7DC88 100%)',
                }}
              />

              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F7DC88]">
                    Alta Suprema · Sin Contraseña Maestra
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white">
                    Crear Nuevo Administrador
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={creatingAdmin}
                  onClick={() => setCreateAdminOpen(false)}
                  aria-label="Cerrar creación de administrador"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#D6C2A3] hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#F5D67B]">Nombre visible *</label>
                  <input
                    type="text"
                    required
                    value={newAdminDisplayName}
                    onChange={(e) => setNewAdminDisplayName(e.target.value)}
                    placeholder="Ej. Carlos Ciprian"
                    className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] px-3 py-2 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F5D67B] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#F5D67B]">Usuario *</label>
                  <input
                    type="text"
                    required
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    placeholder="Ej. CarlosAdmin"
                    className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] px-3 py-2 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F5D67B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#F5D67B]">Etiqueta (Tag)</label>
                  <input
                    type="text"
                    value={newAdminTag}
                    onChange={(e) => setNewAdminTag(e.target.value.toUpperCase())}
                    placeholder="ADMIN-CARLOS"
                    className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] px-3 py-2 font-mono text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F5D67B] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#F5D67B]">PIN 2FA (4–8 dígitos) *</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    minLength={4}
                    maxLength={8}
                    value={newAdminPin}
                    onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 2026"
                    className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] px-3 py-2 font-mono text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F5D67B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#F5D67B]">Contraseña de acceso *</label>
                <div className="relative">
                  <input
                    type={showNewAdminPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full min-h-[42px] rounded-xl border border-[#F5D67B]/35 bg-[#120B05] pl-3 pr-11 py-2 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F5D67B] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewAdminPassword((p) => !p)}
                    aria-label={showNewAdminPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center text-white/60 hover:text-[#F5D67B] cursor-pointer"
                  >
                    {showNewAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={creatingAdmin}
                  onClick={() => setCreateAdminOpen(false)}
                  className="min-h-[42px] rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F5D67B] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow-lg hover:brightness-105 cursor-pointer disabled:opacity-60"
                >
                  <Crown className="h-3.5 w-3.5" />
                  {creatingAdmin ? 'Creando Admin...' : 'Crear Administrador'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
