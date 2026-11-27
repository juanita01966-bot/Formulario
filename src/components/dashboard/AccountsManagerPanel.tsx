import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Plus,
  Power,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { ReferralPartner, UserAccount } from '../../types/app';
import type {
  CreateAccountPayload,
  UpdateAccountPasswordPayload,
  UpdateAccountPayload,
  UpdateAdminAccountPasswordPayload,
} from '../../services/storeClient';
import { DsbAuthError } from '../../services/storeClient';
import {
  normalizeReferralCodeInput,
  sanitizeReferralCodeDraft,
  suggestReferralCodeFromName,
} from './referralQrExport';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { AvatarPickerField } from './AvatarPickerField';
import { SecretKeyModal } from './SecretKeyModal';
import { validateAvatarUrlInput } from '../../utils/avatarImageUtils';
import { getRoleTheme } from './roleTheme';
import { RoleEmblemBadge, RoleSymbolSvg } from './RoleEmblem';

const ACCOUNT_USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;

type PendingCreateAccountDraft = Omit<CreateAccountPayload, 'masterPassword' | 'adminPassword'>;

interface AccountsManagerPanelProps {
  accounts: UserAccount[];
  referrers?: ReferralPartner[];
  currentUserId?: string;
  currentUsername?: string;
  currentDisplayName?: string;
  onCreateAccount: (payload: CreateAccountPayload) => Promise<void>;
  onUpdateAccount: (id: string, payload: UpdateAccountPayload) => Promise<void>;
  onUpdateAccountPassword: (id: string, payload: UpdateAccountPasswordPayload) => Promise<string>;
  onUpdateAdminAccountPassword?: (
    id: string,
    payload: UpdateAdminAccountPasswordPayload
  ) => Promise<string>;
  onDeleteAccount: (id: string, masterPassword: string) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatLockoutDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export const AccountsManagerPanel: React.FC<AccountsManagerPanelProps> = ({
  accounts,
  referrers = [],
  currentUserId,
  currentUsername,
  currentDisplayName,
  onCreateAccount,
  onUpdateAccount,
  onUpdateAccountPassword,
  onUpdateAdminAccountPassword,
  onDeleteAccount,
  onBusyChange,
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | 'vendedor' | 'telemarketing' | 'admin'>('all');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cDisplayName, setCDisplayName] = useState('');
  const [cUsername, setCUsername] = useState('');
  const [cRole, setCRole] = useState<'vendedor' | 'telemarketing'>('vendedor');
  const [cTag, setCTag] = useState('');
  const [cTagTouched, setCTagTouched] = useState(false);
  const [cAvatarUrl, setCAvatarUrl] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cConfirmPassword, setCConfirmPassword] = useState('');
  const [cShowPasswords, setCShowPasswords] = useState(false);
  const [cSubmitting, setCSubmitting] = useState(false);
  const [cError, setCError] = useState<string | null>(null);
  const [pendingCreateDraft, setPendingCreateDraft] = useState<PendingCreateAccountDraft | null>(
    null
  );

  const cErrorRef = useRef<HTMLDivElement | null>(null);
  const eErrorRef = useRef<HTMLDivElement | null>(null);
  const createBackdropDownRef = useRef(false);
  const editBackdropDownRef = useRef(false);
  const passBackdropDownRef = useRef(false);
  const secretBackdropDownRef = useRef(false);

  // Edit Modal (displayName, tag, active, avatarUrl — requires logged-in Admin password)
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [eDisplayName, setEDisplayName] = useState('');
  const [eTag, setETag] = useState('');
  const [eAvatarUrl, setEAvatarUrl] = useState('');
  const [eActive, setEActive] = useState(true);
  const [eMasterPassword, setEMasterPassword] = useState('');
  const [eShowMaster, setEShowMaster] = useState(false);
  const [eSubmitting, setESubmitting] = useState(false);
  const [eError, setEError] = useState<string | null>(null);

  // Change Password Modal (strictly 3 fields: currentPassword, newPassword, confirmNewPassword)
  const [passwordModalAccount, setPasswordModalAccount] = useState<UserAccount | null>(null);
  const [pCurrent, setPCurrent] = useState('');
  const [pNew, setPNew] = useState('');
  const [pConfirm, setPConfirm] = useState('');
  const [pShow, setPShow] = useState(false);
  const [pSubmitting, setPSubmitting] = useState(false);
  const [pError, setPError] = useState<string | null>(null);

  // Delete / Toggle Active Secret Key Modal
  const [secretActionModal, setSecretActionModal] = useState<{
    kind: 'delete' | 'toggle';
    account: UserAccount;
  } | null>(null);
  const [sMasterPassword, setSMasterPassword] = useState('');
  const [sShowMaster, setSShowMaster] = useState(false);
  const [sSubmitting, setSSubmitting] = useState(false);
  const [sError, setSError] = useState<string | null>(null);

  // Dedicated Self-Only Admin Password Change Section State
  const [adminPwExpanded, setAdminPwExpanded] = useState(true);
  const [adminSecurityKey, setAdminSecurityKey] = useState('');
  const [adminConfirmationPin, setAdminConfirmationPin] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminSecKey, setShowAdminSecKey] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showAdminNewPw, setShowAdminNewPw] = useState(false);
  const [showAdminConfirmPw, setShowAdminConfirmPw] = useState(false);
  const [adminPwFocused, setAdminPwFocused] = useState(false);
  const [adminPwSubmitting, setAdminPwSubmitting] = useState(false);
  const [adminPwError, setAdminPwError] = useState<string | null>(null);
  const [adminPwSuccess, setAdminPwSuccess] = useState<string | null>(null);
  const [adminPwLockoutSeconds, setAdminPwLockoutSeconds] = useState(0);

  const adminPwSectionRef = useRef<HTMLElement | null>(null);
  const adminSecKeyInputRef = useRef<HTMLInputElement | null>(null);
  const adminPwErrorRef = useRef<HTMLDivElement | null>(null);

  // Strict Self-Only Admin Isolation: never expose other Admin accounts in directory or counts
  const scopedAccounts = useMemo(
    () =>
      accounts.filter((acc) => {
        if (acc.role !== 'admin') return true;
        if (currentUserId) return acc.id === currentUserId;
        if (currentUsername) {
          return acc.username.toLowerCase() === currentUsername.trim().toLowerCase();
        }
        return false;
      }),
    [accounts, currentUserId, currentUsername]
  );

  const currentAdminAccount = useMemo(
    () =>
      currentUserId
        ? scopedAccounts.find((a) => a.id === currentUserId && a.role === 'admin')
        : scopedAccounts.find((a) => a.role === 'admin'),
    [scopedAccounts, currentUserId]
  );

  const selfAdminTargetId = currentAdminAccount?.id || currentUserId || '';

  const adminLabel = useMemo(() => {
    const display = (currentDisplayName || currentAdminAccount?.displayName || '').trim();
    const uname = (currentUsername || currentAdminAccount?.username || '').trim();
    if (display && uname && display.toLowerCase() !== uname.toLowerCase()) {
      return `${display} (@${uname})`;
    }
    if (uname) return `@${uname}`;
    return display || 'tu cuenta actual';
  }, [currentDisplayName, currentUsername, currentAdminAccount]);

  const isAdminPwLockedOut = adminPwLockoutSeconds > 0;
  useEffect(() => {
    if (!isAdminPwLockedOut) return;
    const timer = window.setInterval(() => {
      setAdminPwLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAdminPwLockedOut]);

  const adminPwDirty = Boolean(
    adminSecurityKey || adminConfirmationPin || adminNewPassword || adminConfirmPassword
  );

  useEffect(() => {
    const busy =
      createOpen ||
      Boolean(pendingCreateDraft) ||
      Boolean(editingAccount) ||
      Boolean(passwordModalAccount) ||
      Boolean(secretActionModal) ||
      adminPwSubmitting ||
      adminPwFocused ||
      adminPwDirty;
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [
    createOpen,
    pendingCreateDraft,
    editingAccount,
    passwordModalAccount,
    secretActionModal,
    adminPwSubmitting,
    adminPwFocused,
    adminPwDirty,
    onBusyChange,
  ]);

  useEffect(() => {
    if (adminPwError) {
      adminPwErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [adminPwError]);

  useEffect(() => {
    if (cError) {
      cErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [cError]);

  useEffect(() => {
    if (eError) {
      eErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [eError]);

  const existingTags = useMemo(() => {
    const tags = new Set<string>();
    for (const a of accounts) {
      const code = a.tag.trim().toUpperCase();
      if (code) tags.add(code);
    }
    for (const r of referrers) {
      const code = r.code.trim().toUpperCase();
      if (code) tags.add(code);
    }
    return tags;
  }, [accounts, referrers]);

  useEffect(() => {
    if (!cTagTouched && createOpen) {
      if (cDisplayName.trim().length >= 2) {
        setCTag(suggestReferralCodeFromName(cDisplayName, existingTags));
      } else {
        setCTag('');
      }
    }
  }, [cDisplayName, cTagTouched, createOpen, existingTags]);

  const counts = useMemo(() => {
    return {
      all: scopedAccounts.length,
      vendedor: scopedAccounts.filter((a) => a.role === 'vendedor').length,
      telemarketing: scopedAccounts.filter((a) => a.role === 'telemarketing').length,
      admin: scopedAccounts.filter((a) => a.role === 'admin').length,
    };
  }, [scopedAccounts]);

  const visibleAccounts = useMemo(() => {
    if (roleFilter === 'all') return scopedAccounts;
    return scopedAccounts.filter((a) => a.role === roleFilter);
  }, [scopedAccounts, roleFilter]);

  const openCreateModal = () => {
    setCDisplayName('');
    setCUsername('');
    setCRole('vendedor');
    setCTag('');
    setCTagTouched(false);
    setCAvatarUrl('');
    setCPassword('');
    setCConfirmPassword('');
    setCShowPasswords(false);
    setCError(null);
    setPendingCreateDraft(null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cSubmitting || pendingCreateDraft) return;
    setCError(null);

    const cleanDisplay = cDisplayName.trim();
    const cleanUser = cUsername.trim();
    const cleanTag = normalizeReferralCodeInput(cTag);

    if (cleanDisplay.length < 2) {
      setCError('Ingresa un nombre visible válido (mínimo 2 caracteres).');
      return;
    }
    if (!ACCOUNT_USERNAME_RE.test(cleanUser) || cleanUser.toLowerCase() === 'admincripian') {
      setCError(
        'El usuario debe tener entre 3 y 40 caracteres válidos (solo letras sin acentos, números, . _ - sin espacios).'
      );
      return;
    }
    if (cleanTag.length < 2) {
      setCError('Ingresa un Tag único válido (mínimo 2 caracteres alfanuméricos).');
      return;
    }
    const avatarCheck =
      cRole === 'vendedor' ? validateAvatarUrlInput(cAvatarUrl) : { ok: true, value: null };
    if (!avatarCheck.ok) {
      setCError(avatarCheck.error || 'La foto de perfil no es válida.');
      return;
    }
    if (cPassword.length < 8) {
      setCError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (cPassword !== cConfirmPassword) {
      setCError('Las contraseñas no coinciden.');
      return;
    }

    setPendingCreateDraft({
      username: cleanUser,
      displayName: cleanDisplay,
      role: cRole,
      tag: cleanTag,
      ...(cRole === 'vendedor' && avatarCheck.value ? { avatarUrl: avatarCheck.value } : {}),
      password: cPassword,
      confirmPassword: cConfirmPassword,
    });
  };

  const handleAuthorizeCreateAccount = async (authSecret: string) => {
    if (!pendingCreateDraft) return;
    const draft = pendingCreateDraft;
    setCSubmitting(true);
    try {
      await onCreateAccount({
        ...draft,
        masterPassword: authSecret,
        adminPassword: authSecret,
      });
      setPendingCreateDraft(null);
      setCreateOpen(false);
      setBanner({
        type: 'success',
        text: `Cuenta "${draft.displayName}" (${draft.role === 'vendedor' ? 'Vendedor / Embajador' : 'Telemarketing'}) creada con tag ${draft.tag}.`,
      });
    } finally {
      setCSubmitting(false);
    }
  };

  const openEditModal = (acc: UserAccount) => {
    setEditingAccount(acc);
    setEDisplayName(acc.displayName);
    setETag(acc.tag);
    setEAvatarUrl(acc.avatarUrl || '');
    setEActive(acc.active);
    setEMasterPassword('');
    setEShowMaster(false);
    setEError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || eSubmitting) return;
    setEError(null);

    const cleanDisplay = eDisplayName.trim();
    const cleanTag = normalizeReferralCodeInput(eTag);

    if (cleanDisplay.length < 2) {
      setEError('El nombre visible debe tener al menos 2 caracteres.');
      return;
    }
    if (cleanTag.length < 2) {
      setEError('El Tag debe tener al menos 2 caracteres alfanuméricos.');
      return;
    }
    const avatarCheck =
      editingAccount.role === 'vendedor'
        ? validateAvatarUrlInput(eAvatarUrl)
        : { ok: true, value: null };
    if (!avatarCheck.ok) {
      setEError(avatarCheck.error || 'La foto de perfil no es válida.');
      return;
    }
    if (!eMasterPassword) {
      setEError('Ingresa tu contraseña de Administrador para guardar los cambios.');
      return;
    }

    setESubmitting(true);
    try {
      await onUpdateAccount(editingAccount.id, {
        masterPassword: eMasterPassword,
        displayName: cleanDisplay,
        tag: cleanTag,
        ...(editingAccount.role === 'vendedor' ? { avatarUrl: avatarCheck.value } : {}),
        active: eActive,
      });
      setEditingAccount(null);
      setBanner({
        type: 'success',
        text: `Cuenta "${cleanDisplay}" actualizada correctamente.`,
      });
    } catch (err) {
      setEError(
        err instanceof DsbAuthError || err instanceof Error
          ? err.message
          : 'No se pudo actualizar la cuenta.'
      );
    } finally {
      setESubmitting(false);
    }
  };

  const openPasswordModal = (acc: UserAccount) => {
    setPasswordModalAccount(acc);
    setPCurrent('');
    setPNew('');
    setPConfirm('');
    setPShow(false);
    setPError(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalAccount || pSubmitting) return;
    setPError(null);

    if (!pCurrent) {
      setPError('Ingresa la contraseña antigua del usuario.');
      return;
    }
    if (pNew.length < 8) {
      setPError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (pNew !== pConfirm) {
      setPError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setPSubmitting(true);
    try {
      const msg = await onUpdateAccountPassword(passwordModalAccount.id, {
        currentPassword: pCurrent,
        newPassword: pNew,
        confirmNewPassword: pConfirm,
      });
      setPasswordModalAccount(null);
      setBanner({
        type: 'success',
        text: `${msg} (${passwordModalAccount.displayName})`,
      });
    } catch (err) {
      setPError(
        err instanceof DsbAuthError || err instanceof Error
          ? err.message
          : 'No se pudo cambiar la contraseña.'
      );
    } finally {
      setPSubmitting(false);
    }
  };

  const openSecretAction = (kind: 'delete' | 'toggle', account: UserAccount) => {
    setSecretActionModal({ kind, account });
    setSMasterPassword('');
    setSShowMaster(false);
    setSError(null);
  };

  const handleSecretActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretActionModal || sSubmitting) return;
    setSError(null);
    if (!sMasterPassword) {
      setSError('Ingresa tu contraseña de Administrador.');
      return;
    }

    const { kind, account } = secretActionModal;
    setSSubmitting(true);
    try {
      if (kind === 'delete') {
        await onDeleteAccount(account.id, sMasterPassword);
        setBanner({
          type: 'success',
          text: `Cuenta "${account.displayName}" eliminada.`,
        });
      } else {
        await onUpdateAccount(account.id, {
          masterPassword: sMasterPassword,
          active: !account.active,
        });
        setBanner({
          type: 'success',
          text: account.active
            ? `Cuenta "${account.displayName}" desactivada.`
            : `Cuenta "${account.displayName}" reactivada.`,
        });
      }
      setSecretActionModal(null);
    } catch (err) {
      setSError(
        err instanceof DsbAuthError || err instanceof Error
          ? err.message
          : 'Contraseña de Administrador incorrecta o error al aplicar la acción.'
      );
    } finally {
      setSSubmitting(false);
    }
  };

  const handleFocusSelfAdminPassword = () => {
    setAdminPwExpanded(true);
    setAdminPwError(null);
    setAdminPwSuccess(null);
    window.requestAnimationFrame(() => {
      adminPwSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        adminSecKeyInputRef.current?.focus({ preventScroll: true });
      }, 280);
    });
  };

  const handleResetAdminPasswordFields = () => {
    setAdminSecurityKey('');
    setAdminConfirmationPin('');
    setAdminNewPassword('');
    setAdminConfirmPassword('');
    setShowAdminSecKey(false);
    setShowAdminPin(false);
    setShowAdminNewPw(false);
    setShowAdminConfirmPw(false);
    setAdminPwError(null);
  };

  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateAdminAccountPassword || adminPwSubmitting || adminPwLockoutSeconds > 0) return;

    setAdminPwError(null);
    setAdminPwSuccess(null);

    if (!selfAdminTargetId) {
      setAdminPwError('No se identificó tu cuenta de Administrador activa para actualizar.');
      return;
    }

    if (!adminSecurityKey.trim()) {
      setAdminPwError('Ingresa la clave de seguridad para autorizar el cambio.');
      return;
    }

    const cleanPin = adminConfirmationPin.trim();
    if (!cleanPin) {
      setAdminPwError('Ingresa el PIN de confirmación.');
      return;
    }
    if (cleanPin.length < 4) {
      setAdminPwError('El PIN de confirmación debe tener al menos 4 dígitos.');
      return;
    }

    if (adminNewPassword.length < 8) {
      setAdminPwError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPwError('La nueva contraseña y su confirmación (2da vez) no coinciden.');
      return;
    }

    setAdminPwSubmitting(true);
    try {
      const msg = await onUpdateAdminAccountPassword(selfAdminTargetId, {
        securityKey: adminSecurityKey,
        confirmationPin: cleanPin,
        newPassword: adminNewPassword,
        confirmNewPassword: adminConfirmPassword,
      });

      setAdminSecurityKey('');
      setAdminConfirmationPin('');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
      setShowAdminSecKey(false);
      setShowAdminPin(false);
      setShowAdminNewPw(false);
      setShowAdminConfirmPw(false);
      setAdminPwError(null);
      setAdminPwLockoutSeconds(0);
      setAdminPwSuccess(`${msg} (${adminLabel})`);
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setAdminPwError(err.message);
        if (err.locked && err.retryAfterSeconds > 0) {
          setAdminPwLockoutSeconds(err.retryAfterSeconds);
        }
      } else if (err instanceof Error && err.message) {
        setAdminPwError(err.message);
      } else {
        setAdminPwError('No se pudo actualizar la contraseña de Administrador.');
      }
    } finally {
      setAdminPwSubmitting(false);
    }
  };

  const adminTheme = getRoleTheme('admin');

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden dsb-glass rounded-[24px] sm:rounded-[26px] p-4 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: adminTheme.headerStrip }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
            <div
              className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl shadow-md border border-white/25"
              style={{ background: adminTheme.heroGradient }}
            >
              <RoleSymbolSvg role="admin" className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-[#8B0018]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#B91C1C] shrink-0" />
                Gestión de Cuentas y Tags Únicos
              </span>
              <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#22150E] mt-0.5 leading-snug">
                Cuentas de Telemarketing y Vendedores
              </h2>
              <p className="text-xs sm:text-sm text-[#594133] mt-1 max-w-2xl">
                Cada Vendedor / Embajador tiene su propio Tag único sincronizado automáticamente con Estudio QR y Métricas. Crear, editar, activar/desactivar o eliminar cuentas de equipo se autoriza con tu contraseña de Administrador ({adminLabel}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            style={{ background: adminTheme.heroGradient }}
            className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            Crear cuenta nueva
          </button>
        </div>
      </motion.section>

      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`flex items-start justify-between gap-3 rounded-2xl border backdrop-blur-md px-4 py-3 text-xs font-semibold ${
              banner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
                : 'border-rose-200 bg-rose-50/90 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2">
              {banner.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span>{banner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-current opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Pills + Directory */}
      <section className="dsb-glass rounded-[24px] sm:rounded-[26px] p-3.5 sm:p-6 space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap border-b border-slate-900/10 pb-3 -mx-0.5 px-0.5">
          {(
            [
              { id: 'all', label: `Todas (${counts.all})`, roleKey: 'admin' as const },
              { id: 'vendedor', label: `Vendedores / Embajadores (${counts.vendedor})`, roleKey: 'vendedor' as const },
              { id: 'telemarketing', label: `Telemarketing (${counts.telemarketing})`, roleKey: 'telemarketing' as const },
              { id: 'admin', label: `Mi cuenta Admin (${counts.admin})`, roleKey: 'admin' as const },
            ] as const
          ).map((tab) => {
            const active = roleFilter === tab.id;
            const tabTheme = getRoleTheme(tab.roleKey);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] sm:min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? tabTheme.activePillClass
                    : 'dsb-glass-subtle text-[#594133] hover:bg-white/80'
                }`}
              >
                {tab.id !== 'all' && (
                  <RoleSymbolSvg role={tab.roleKey} className="h-4 w-4 shrink-0" animated={false} />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {visibleAccounts.length === 0 ? (
          <div className="dsb-glass-subtle rounded-2xl border-dashed border-[#DEC9AE] py-10 px-4 text-center space-y-2.5">
            <p className="font-serif text-lg font-semibold text-[#594133]">
              No hay cuentas en esta categoría
            </p>
            <p className="text-xs text-[#6E5341]">
              Crea una cuenta de Vendedor / Embajador o Telemarketing para comenzar.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              style={{ background: adminTheme.heroGradient }}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-white hover:brightness-110 cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Crear cuenta nueva
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAccounts.map((acc) => {
              const isAdminAcc = acc.role === 'admin';
              const isSelf = Boolean(
                (currentUserId && acc.id === currentUserId) ||
                  (!currentUserId &&
                    currentUsername &&
                    acc.username.toLowerCase() === currentUsername.trim().toLowerCase())
              );
              const accTheme = getRoleTheme(acc.role);

              return (
                <div
                  key={acc.id}
                  data-dsb-card={!acc.active ? 'locked' : undefined}
                  style={{
                    borderColor: acc.active ? accTheme.borderTint : undefined,
                  }}
                  className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 transition-all duration-200 ${
                    !acc.active
                      ? 'border-stone-300/80 bg-stone-100/65 backdrop-blur-md opacity-80'
                      : 'dsb-glass-subtle bg-white/70 hover:bg-white/85 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  {/* Signature role side-bar */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-1"
                    style={{ background: acc.active ? accTheme.heroGradient : '#a8a29e' }}
                  />

                  <div className="flex items-start gap-3 min-w-0 pl-1.5">
                    {acc.role === 'vendedor' ? (
                      <div className="relative shrink-0">
                        <AmbassadorAvatar
                          name={acc.displayName}
                          avatarUrl={acc.avatarUrl}
                          size="md"
                          ring={acc.active ? 'gold' : 'subtle'}
                        />
                        <span
                          className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-sm"
                          aria-hidden="true"
                        >
                          <RoleSymbolSvg role="vendedor" className="h-4 w-4" animated={false} />
                        </span>
                      </div>
                    ) : (
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs backdrop-blur-md bg-white/80"
                        style={{ borderColor: accTheme.borderTint }}
                      >
                        <RoleSymbolSvg role={acc.role} className="h-8 w-8" animated={false} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h3 className="text-[15px] font-bold text-[#22150E] break-words">
                          {acc.displayName}
                        </h3>
                        <span className="font-mono text-xs text-[#594133] bg-white/80 border border-slate-900/10 rounded-md px-2 py-0.5 max-w-full truncate">
                          @{acc.username}
                        </span>
                        <RoleEmblemBadge
                          role={acc.role}
                          tag={acc.tag}
                          size="sm"
                          showCodename
                        />
                        {!acc.active && (
                          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                            Inactiva
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#6E5341]">
                        Creada: {formatDate(acc.createdAt)} · Acceso:{' '}
                        {isAdminAcc ? 'Usuario + Contraseña + PIN' : 'Usuario + Contraseña (sin PIN)'}
                      </p>
                    </div>
                  </div>

                  {/* Per-account actions */}
                  <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto lg:shrink-0 pt-2.5 border-t border-slate-900/10 lg:pt-0 lg:border-t-0">
                    {!isAdminAcc ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openPasswordModal(acc)}
                          className="inline-flex min-h-[38px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-[#FAF3E8] px-2.5 sm:px-3 py-1.5 text-xs font-bold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-[#B84A27] shrink-0" />
                          Cambiar contraseña
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(acc)}
                          className="inline-flex min-h-[38px] flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl border border-[#DFCBB3] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 shrink-0" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => openSecretAction('toggle', acc)}
                          className={`inline-flex min-h-[38px] flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                            acc.active
                              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
                              : 'border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5 shrink-0" />
                          {acc.active ? 'Desactivar' : 'Activar'}
                        </button>

                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => openSecretAction('delete', acc)}
                            title="Eliminar cuenta"
                            aria-label={`Eliminar cuenta ${acc.displayName}`}
                            className="inline-flex min-h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                        {isSelf && onUpdateAdminAccountPassword ? (
                          <button
                            type="button"
                            onClick={handleFocusSelfAdminPassword}
                            style={{ background: adminTheme.heroGradient }}
                            className="inline-flex min-h-[44px] sm:min-h-[38px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-white/20 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer"
                          >
                            <KeyRound className="h-3.5 w-3.5 shrink-0" />
                            Cambiar mi clave
                          </button>
                        ) : (
                          <span className="rounded-xl border border-[#E6D5BF] bg-[#FAF3E8]/80 px-3 py-1.5 text-[11px] font-semibold text-[#7B5D4A]">
                            Tu cuenta de Administrador
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Dedicated Section: Self-Only Change Admin Password */}
      {onUpdateAdminAccountPassword && (
        <section
          ref={adminPwSectionRef}
          aria-labelledby="admin-password-section-title"
          className="relative overflow-hidden dsb-glass rounded-[24px] sm:rounded-[26px] p-4 sm:p-6 scroll-mt-6"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1"
            style={{ background: adminTheme.headerStrip }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md border border-white/25"
                style={{ background: adminTheme.heroGradient }}
              >
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-[#8B0018]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#B91C1C] shrink-0" />
                  Seguridad de Administrador · Solo Tu Propia Cuenta
                </span>
                <h3
                  id="admin-password-section-title"
                  className="font-serif text-lg sm:text-xl font-bold text-[#22150E] mt-0.5 leading-snug"
                >
                  Cambiar mi contraseña de Administrador
                </h3>
                <p className="text-xs sm:text-sm text-[#594133] mt-1 max-w-2xl">
                  Única función que requiere la Clave de Seguridad especial y el PIN de confirmación. Por seguridad, solo puedes cambiar la contraseña de tu propia cuenta.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdminPwExpanded((prev) => !prev)}
              aria-expanded={adminPwExpanded}
              className="inline-flex min-h-[44px] sm:min-h-[40px] w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 self-start sm:self-center rounded-full border border-[#8B0018]/25 bg-white/75 px-3.5 py-1.5 text-xs font-bold text-[#8B0018] hover:bg-white transition-colors cursor-pointer"
            >
              <span>{adminPwExpanded ? 'Ocultar formulario' : 'Abrir formulario'}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  adminPwExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {adminPwExpanded && (
              <motion.div
                key="admin-pw-body"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <form
                  onSubmit={handleAdminPasswordSubmit}
                  onFocus={() => setAdminPwFocused(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setAdminPwFocused(false);
                    }
                  }}
                  noValidate
                  autoComplete="off"
                  className="mt-4 pt-4 sm:mt-5 sm:pt-5 border-t border-slate-900/10 space-y-3.5 sm:space-y-4"
                >
                  {!selfAdminTargetId ? (
                    <div className="dsb-glass-subtle rounded-2xl border border-[#DEC9AE] px-4 py-5 text-center text-xs font-semibold text-[#6E5341]">
                      No se identificó tu cuenta de Administrador activa para actualizar.
                    </div>
                  ) : (
                    <>
                      {/* Read-Only Self Admin Identity Card (strictly locked to logged-in Admin) */}
                      <div className="dsb-glass-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-[#8B0018]/25 px-3.5 sm:px-4 py-3 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white/80 shadow-xs"
                            style={{ borderColor: adminTheme.borderTint }}
                          >
                            <RoleSymbolSvg role="admin" className="h-5 w-5" animated={false} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-[#22150E] break-words">
                              Tu cuenta: <span className="text-[#8B0018]">{adminLabel}</span>
                            </p>
                            <p className="text-[11px] font-medium text-[#6E5341]">
                              Tu sesión permanecerá activa
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1.5 self-start sm:self-center rounded-full border border-emerald-200 bg-emerald-50/85 px-2.5 py-1 text-[10.5px] font-bold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          Cuenta bloqueada a tu sesión
                        </span>
                      </div>

                      {/* Authorization Block: Security Key + Confirmation PIN */}
                      <div className="dsb-glass-subtle rounded-2xl border border-[#8B0018]/25 p-3.5 sm:p-4 space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B0018]">
                          <ShieldAlert className="h-4 w-4 shrink-0 text-[#B91C1C]" />
                          <span>Autorización de seguridad (requerida)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div>
                            <label
                              htmlFor="admin-pw-security-key"
                              className="block text-xs font-semibold text-[#594133] mb-1.5"
                            >
                              Clave de seguridad *
                            </label>
                            <div className="relative">
                              <input
                                ref={adminSecKeyInputRef}
                                id="admin-pw-security-key"
                                type={showAdminSecKey ? 'text' : 'password'}
                                autoComplete="new-password"
                                disabled={adminPwSubmitting}
                                value={adminSecurityKey}
                                onChange={(e) => {
                                  setAdminSecurityKey(e.target.value);
                                  setAdminPwError(null);
                                  setAdminPwSuccess(null);
                                }}
                                placeholder="Ingresa la clave de seguridad"
                                className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/90 bg-white/85 pl-3.5 pr-11 py-2.5 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors disabled:opacity-60"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAdminSecKey((prev) => !prev)}
                                aria-label={
                                  showAdminSecKey
                                    ? 'Ocultar clave de seguridad'
                                    : 'Mostrar clave de seguridad'
                                }
                                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-[#7B5D4A] hover:text-[#22150E] cursor-pointer"
                              >
                                {showAdminSecKey ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="admin-pw-confirmation-pin"
                              className="block text-xs font-semibold text-[#594133] mb-1.5"
                            >
                              PIN de confirmación *
                            </label>
                            <div className="relative">
                              <Lock className="pointer-events-none h-4 w-4 text-[#7B5D4A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                id="admin-pw-confirmation-pin"
                                type={showAdminPin ? 'text' : 'password'}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={12}
                                disabled={adminPwSubmitting}
                                value={adminConfirmationPin}
                                onChange={(e) => {
                                  setAdminConfirmationPin(e.target.value.replace(/\D/g, ''));
                                  setAdminPwError(null);
                                  setAdminPwSuccess(null);
                                }}
                                placeholder="Ingresa el PIN de seguridad"
                                className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/90 bg-white/85 pl-10 pr-11 py-2.5 text-base sm:text-sm font-mono tracking-widest text-[#22150E] placeholder:font-sans placeholder:tracking-normal focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors disabled:opacity-60"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAdminPin((prev) => !prev)}
                                aria-label={
                                  showAdminPin
                                    ? 'Ocultar PIN de confirmación'
                                    : 'Mostrar PIN de confirmación'
                                }
                                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-[#7B5D4A] hover:text-[#22150E] cursor-pointer"
                              >
                                {showAdminPin ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* New Password + Confirm New Password (2nd time) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                          <label
                            htmlFor="admin-pw-new"
                            className="block text-xs font-semibold text-[#594133] mb-1.5"
                          >
                            Nueva contraseña *
                          </label>
                          <div className="relative">
                            <input
                              id="admin-pw-new"
                              type={showAdminNewPw ? 'text' : 'password'}
                              autoComplete="new-password"
                              disabled={adminPwSubmitting}
                              value={adminNewPassword}
                              onChange={(e) => {
                                setAdminNewPassword(e.target.value);
                                setAdminPwError(null);
                                setAdminPwSuccess(null);
                              }}
                              placeholder="Mínimo 8 caracteres"
                              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/90 bg-white/85 pl-3.5 pr-11 py-2.5 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors disabled:opacity-60"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminNewPw((prev) => !prev)}
                              aria-label={
                                showAdminNewPw
                                  ? 'Ocultar nueva contraseña'
                                  : 'Mostrar nueva contraseña'
                              }
                              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-[#7B5D4A] hover:text-[#22150E] cursor-pointer"
                            >
                              {showAdminNewPw ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p
                            className={`mt-1 text-[11px] font-medium ${
                              adminNewPassword.length >= 8
                                ? 'text-emerald-700'
                                : 'text-[#7B5D4A]'
                            }`}
                          >
                            {adminNewPassword.length >= 8
                              ? 'Longitud válida (8+ caracteres)'
                              : 'Debe tener al menos 8 caracteres'}
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor="admin-pw-confirm"
                            className="block text-xs font-semibold text-[#594133] mb-1.5"
                          >
                            Confirmar nueva contraseña (2da vez) *
                          </label>
                          <div className="relative">
                            <input
                              id="admin-pw-confirm"
                              type={showAdminConfirmPw ? 'text' : 'password'}
                              autoComplete="new-password"
                              disabled={adminPwSubmitting}
                              value={adminConfirmPassword}
                              onChange={(e) => {
                                setAdminConfirmPassword(e.target.value);
                                setAdminPwError(null);
                                setAdminPwSuccess(null);
                              }}
                              placeholder="Repite la nueva contraseña"
                              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/90 bg-white/85 pl-3.5 pr-11 py-2.5 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#8B0018] focus:outline-none transition-colors disabled:opacity-60"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminConfirmPw((prev) => !prev)}
                              aria-label={
                                showAdminConfirmPw
                                  ? 'Ocultar confirmación de contraseña'
                                  : 'Mostrar confirmación de contraseña'
                              }
                              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-[#7B5D4A] hover:text-[#22150E] cursor-pointer"
                            >
                              {showAdminConfirmPw ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          {adminConfirmPassword.length > 0 && (
                            <p
                              className={`mt-1 text-[11px] font-medium ${
                                adminNewPassword === adminConfirmPassword
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {adminNewPassword === adminConfirmPassword
                                ? 'Las contraseñas coinciden'
                                : 'Las contraseñas aún no coinciden'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Lockout Countdown Notice */}
                      {adminPwLockoutSeconds > 0 && (
                        <div
                          role="status"
                          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/85 px-3.5 py-2.5 text-xs font-semibold text-amber-900"
                        >
                          <Clock className="h-4 w-4 shrink-0 text-amber-700" />
                          <span className="tabular-nums">
                            Demasiados intentos fallidos. Podrás reintentar en{' '}
                            <strong>{formatLockoutDuration(adminPwLockoutSeconds)}</strong>.
                          </span>
                        </div>
                      )}

                      {/* Inline Error Alert */}
                      {adminPwError && (
                        <div
                          ref={adminPwErrorRef}
                          role="alert"
                          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-xs font-semibold text-rose-900"
                        >
                          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                          <span>{adminPwError}</span>
                        </div>
                      )}

                      {/* Inline Success Banner */}
                      {adminPwSuccess && (
                        <div
                          role="status"
                          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-3 text-xs font-semibold text-emerald-900"
                        >
                          <div className="flex items-start gap-2">
                            <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <span>{adminPwSuccess}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdminPwSuccess(null)}
                            aria-label="Cerrar mensaje de éxito"
                            className="text-current opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Submit & Reset Actions */}
                      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-1">
                        {adminPwDirty && (
                          <button
                            type="button"
                            disabled={adminPwSubmitting}
                            onClick={handleResetAdminPasswordFields}
                            className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-full border border-[#DFCBB3] bg-white/70 px-4 py-2 text-xs font-semibold text-[#594133] hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Limpiar campos
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={adminPwSubmitting || adminPwLockoutSeconds > 0}
                          style={{ background: adminTheme.heroGradient }}
                          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-60"
                        >
                          <KeyRound className="h-4 w-4 shrink-0" />
                          {adminPwSubmitting
                            ? 'Actualizando contraseña...'
                            : adminPwLockoutSeconds > 0
                              ? `Bloqueado (${formatLockoutDuration(adminPwLockoutSeconds)})`
                              : 'Actualizar mi contraseña de Administrador'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Modal 1: Create Account */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-account-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
            onMouseDown={(e) => {
              createBackdropDownRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
              const startedOnBackdrop = createBackdropDownRef.current;
              createBackdropDownRef.current = false;
              if (!startedOnBackdrop || e.target !== e.currentTarget) return;
              if (cSubmitting || pendingCreateDraft) return;
              setCreateOpen(false);
            }}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreateSubmit}
              noValidate
              autoComplete="off"
              className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF] p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4"
            >
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A6315]">
                    Nueva Cuenta de Equipo
                  </span>
                  <h3 id="create-account-title" className="font-serif text-lg sm:text-xl font-bold text-[#22150E] leading-snug">
                    Crear Usuario y Tag Único
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={cSubmitting || Boolean(pendingCreateDraft)}
                  onClick={() => setCreateOpen(false)}
                  aria-label="Cerrar modal"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7B5D4A] hover:bg-[#FAF1E4] cursor-pointer disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                {(['vendedor', 'telemarketing'] as const).map((roleOption) => {
                  const optTheme = getRoleTheme(roleOption);
                  const selected = cRole === roleOption;
                  return (
                    <button
                      key={roleOption}
                      type="button"
                      onClick={() => setCRole(roleOption)}
                      style={{
                        borderColor: selected ? optTheme.primary : optTheme.borderTint,
                        boxShadow: selected ? `0 8px 22px -10px ${optTheme.glowRgba}` : undefined,
                      }}
                      className={`flex items-center gap-2.5 rounded-2xl border p-2.5 sm:p-3 text-left transition-all cursor-pointer min-w-0 ${
                        selected
                          ? 'bg-white ring-2 ring-offset-1'
                          : 'bg-white/60 hover:bg-white/85 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <RoleSymbolSvg role={roleOption} className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" animated={selected} />
                      <div className="min-w-0 flex-1">
                        <span
                          data-dsb-role-label={roleOption}
                          className="block text-xs font-bold leading-tight truncate"
                          style={{ color: optTheme.primary }}
                        >
                          {roleOption === 'vendedor' ? 'Vendedor / Embajador' : 'Telemarketing'}
                        </span>
                        <span className="block text-[10.5px] font-medium text-[#6E5341] truncate mt-0.5">
                          {optTheme.codename}
                        </span>
                      </div>
                      {selected && (
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: optTheme.primary }}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={cDisplayName}
                    onChange={(e) => setCDisplayName(e.target.value)}
                    placeholder="Ej. María González"
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">
                    Usuario de acceso *
                  </label>
                  <input
                    type="text"
                    required
                    value={cUsername}
                    onChange={(e) => setCUsername(e.target.value)}
                    placeholder="Ej. maria.gonzalez"
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">
                  Tag único (?ref=...) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={cTag}
                  onChange={(e) => {
                    setCTagTouched(true);
                    setCTag(sanitizeReferralCodeDraft(e.target.value));
                  }}
                  onBlur={() => setCTag((prev) => normalizeReferralCodeInput(prev))}
                  placeholder="Ej. MARIA-01"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 font-mono text-base sm:text-sm font-bold uppercase text-[#8C4A19] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-[#7B5D4A]">
                  {cRole === 'vendedor'
                    ? 'Se vinculará automáticamente a su perfil Embajador y a todos los códigos QR que generes para este vendedor.'
                    : 'Identificador único interno del operador de Telemarketing.'}
                </p>
              </div>

              {cRole === 'vendedor' && (
                <AvatarPickerField
                  name={cDisplayName || cUsername || 'Vendedor'}
                  value={cAvatarUrl}
                  onChange={setCAvatarUrl}
                  disabled={cSubmitting}
                  label="Foto de perfil del Vendedor / Embajador (opcional)"
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setCShowPasswords((p) => !p)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E5341] hover:text-[#22150E] cursor-pointer"
                  >
                    {cShowPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {cShowPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">
                      Contraseña (mín. 8 caracteres) *
                    </label>
                    <input
                      type={cShowPasswords ? 'text' : 'password'}
                      required
                      disabled={cSubmitting}
                      value={cPassword}
                      onChange={(e) => setCPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">
                      Confirmar contraseña *
                    </label>
                    <input
                      type={cShowPasswords ? 'text' : 'password'}
                      required
                      disabled={cSubmitting}
                      value={cConfirmPassword}
                      onChange={(e) => setCConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#C88A2B]/45 bg-[#23140D] p-3.5 text-[#FFFDF9] flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 text-[#F4CA73] mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-[#F4CA73]">
                    Autorización con contraseña de Administrador
                  </p>
                  <p className="text-[#E8D5BE] mt-0.5">
                    Al continuar, te pediremos la contraseña de tu cuenta de administrador ({adminLabel}) para crear esta cuenta de{' '}
                    {cRole === 'vendedor' ? 'Vendedor / Embajador' : 'Telemarketing'}.
                  </p>
                </div>
              </div>

              {cError && (
                <div
                  ref={cErrorRef}
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{cError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={cSubmitting || Boolean(pendingCreateDraft)}
                  onClick={() => setCreateOpen(false)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-[#DFCBB3] px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF1E4] cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cSubmitting || Boolean(pendingCreateDraft)}
                  className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-[#C88A2B]/45 bg-[#22150E] px-5 py-2 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {cSubmitting ? 'Creando cuenta...' : 'Continuar y autorizar'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 2: Edit Account (displayName, tag, active + Admin password) */}
      <AnimatePresence>
        {editingAccount && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-account-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
            onMouseDown={(e) => {
              editBackdropDownRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
              const startedOnBackdrop = editBackdropDownRef.current;
              editBackdropDownRef.current = false;
              if (!startedOnBackdrop || e.target !== e.currentTarget || eSubmitting) return;
              setEditingAccount(null);
            }}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleEditSubmit}
              noValidate
              autoComplete="off"
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF] p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4"
            >
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9A6315] block truncate">
                    Editar Cuenta (@{editingAccount.username})
                  </span>
                  <h3 id="edit-account-title" className="font-serif text-lg sm:text-xl font-bold text-[#22150E] break-words leading-snug">
                    {editingAccount.displayName}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={eSubmitting}
                  onClick={() => setEditingAccount(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7B5D4A] hover:bg-[#FAF1E4] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">
                    Nombre visible *
                  </label>
                  <input
                    type="text"
                    required
                    value={eDisplayName}
                    onChange={(e) => setEDisplayName(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">
                    Tag único *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={eTag}
                    onChange={(e) => setETag(sanitizeReferralCodeDraft(e.target.value))}
                    onBlur={() => setETag((prev) => normalizeReferralCodeInput(prev))}
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 font-mono text-base sm:text-sm font-bold uppercase text-[#8C4A19] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>

                {editingAccount.role === 'vendedor' && (
                  <AvatarPickerField
                    name={eDisplayName || editingAccount.displayName}
                    value={eAvatarUrl}
                    onChange={setEAvatarUrl}
                    disabled={eSubmitting}
                    label="Foto de perfil del Vendedor / Embajador"
                  />
                )}

                <label className="flex items-center justify-between gap-3 rounded-xl border border-[#EFE3D2] bg-[#FAF3E8]/60 px-3.5 py-2.5 cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#22150E]">Cuenta activa</p>
                    <p className="text-[11px] text-[#7B5D4A]">
                      Si se desactiva, se revoca inmediatamente su sesión actual.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={eActive}
                    onChange={(e) => setEActive(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-[#22150E]"
                  />
                </label>

                <div className="rounded-2xl border border-[#C88A2B]/45 bg-[#23140D] p-3.5 text-[#FFFDF9] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#F4CA73]">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Tu contraseña de Administrador *
                    </label>
                    <button
                      type="button"
                      onClick={() => setEShowMaster((p) => !p)}
                      className="text-[11px] text-[#E8D5BE] hover:text-white cursor-pointer"
                    >
                      {eShowMaster ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <input
                    type={eShowMaster ? 'text' : 'password'}
                    required
                    value={eMasterPassword}
                    onChange={(e) => setEMasterPassword(e.target.value)}
                    placeholder={`Ingresa tu contraseña de administrador (${adminLabel})`}
                    className="w-full min-h-[44px] rounded-xl border border-[#F4CA73]/40 bg-[#110804] px-3.5 py-2 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                  />
                </div>
              </div>

              {eError && (
                <div
                  ref={eErrorRef}
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{eError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={eSubmitting}
                  onClick={() => setEditingAccount(null)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-[#DFCBB3] px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF1E4] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={eSubmitting}
                  className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-[#C88A2B]/45 bg-[#22150E] px-5 py-2 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
                >
                  {eSubmitting ? 'Guardando...' : 'Autorizar y guardar'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 3: Change Password for Telemarketing / Vendedor (strictly 3 fields: old + 2x new) */}
      <AnimatePresence>
        {passwordModalAccount && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-user-password-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#120804]/78 px-3 sm:px-4 py-3 sm:py-4 backdrop-blur-sm overflow-y-auto"
            onMouseDown={(e) => {
              passBackdropDownRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
              const startedOnBackdrop = passBackdropDownRef.current;
              passBackdropDownRef.current = false;
              if (!startedOnBackdrop || e.target !== e.currentTarget || pSubmitting) return;
              setPasswordModalAccount(null);
            }}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handlePasswordSubmit}
              autoComplete="off"
              className="relative w-full max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[26px] border border-[#C88A2B]/55 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-4 sm:p-6 text-[#FFFDF9] shadow-2xl space-y-4"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {passwordModalAccount.role === 'vendedor' ? (
                    <AmbassadorAvatar
                      name={passwordModalAccount.displayName}
                      avatarUrl={passwordModalAccount.avatarUrl}
                      size="sm"
                      ring="gold"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F4CA73]/40 bg-[#F4CA73]/15 text-[#F4CA73]">
                      <KeyRound className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F4CA73] block">
                      Cambio de Contraseña · @{passwordModalAccount.username}
                    </span>
                    <h3
                      id="change-user-password-title"
                      className="font-serif text-lg font-bold text-white truncate"
                    >
                      {passwordModalAccount.displayName}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pSubmitting}
                  onClick={() => setPasswordModalAccount(null)}
                  aria-label="Cerrar modal"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#C8B29A] hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPShow((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E8D5BE] hover:text-[#F4CA73] cursor-pointer"
                >
                  {pShow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {pShow ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#E8D5BE] mb-1">
                    Contraseña antigua *
                  </label>
                  <input
                    type={pShow ? 'text' : 'password'}
                    required
                    autoFocus
                    disabled={pSubmitting}
                    value={pCurrent}
                    onChange={(e) => {
                      setPCurrent(e.target.value);
                      setPError(null);
                    }}
                    placeholder="Ingresa la contraseña actual de la cuenta"
                    className="w-full min-h-[44px] rounded-xl border border-white/20 bg-[#110804] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E8D5BE] mb-1">
                    Nueva contraseña (mín. 8 caracteres) *
                  </label>
                  <input
                    type={pShow ? 'text' : 'password'}
                    required
                    disabled={pSubmitting}
                    value={pNew}
                    onChange={(e) => {
                      setPNew(e.target.value);
                      setPError(null);
                    }}
                    placeholder="Nueva contraseña"
                    className="w-full min-h-[44px] rounded-xl border border-white/20 bg-[#110804] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E8D5BE] mb-1">
                    Confirmar nueva contraseña *
                  </label>
                  <input
                    type={pShow ? 'text' : 'password'}
                    required
                    disabled={pSubmitting}
                    value={pConfirm}
                    onChange={(e) => {
                      setPConfirm(e.target.value);
                      setPError(null);
                    }}
                    placeholder="Repite la nueva contraseña"
                    className="w-full min-h-[44px] rounded-xl border border-white/20 bg-[#110804] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                  />
                </div>
              </div>

              {pError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/65 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{pError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={pSubmitting}
                  onClick={() => setPasswordModalAccount(null)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pSubmitting}
                  data-preserve-surface="true"
                  className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow hover:brightness-105 cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {pSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 4: Admin Password Confirmation for Toggle Active / Delete */}
      <AnimatePresence>
        {secretActionModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#120804]/78 px-3 sm:px-4 py-3 sm:py-4 backdrop-blur-sm overflow-y-auto"
            onMouseDown={(e) => {
              secretBackdropDownRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
              const startedOnBackdrop = secretBackdropDownRef.current;
              secretBackdropDownRef.current = false;
              if (!startedOnBackdrop || e.target !== e.currentTarget || sSubmitting) return;
              setSecretActionModal(null);
            }}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSecretActionSubmit}
              autoComplete="off"
              className="relative w-full max-w-[430px] max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[26px] border border-[#C88A2B]/55 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-4 sm:p-6 text-[#FFFDF9] shadow-2xl space-y-4"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F4CA73]">
                    Autorización de Administrador
                  </span>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-white break-words leading-snug">
                    {secretActionModal.kind === 'delete'
                      ? `¿Eliminar cuenta "${secretActionModal.account.displayName}"?`
                      : secretActionModal.account.active
                        ? `¿Desactivar "${secretActionModal.account.displayName}"?`
                        : `¿Activar "${secretActionModal.account.displayName}"?`}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={sSubmitting}
                  onClick={() => setSecretActionModal(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#C8B29A] hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-[#E3CEB6] leading-relaxed">
                {secretActionModal.kind === 'delete'
                  ? 'La cuenta perderá acceso inmediatamente y su perfil Embajador quedará desactivado/desvinculado de forma segura (conservando sus prospectos históricos).'
                  : secretActionModal.account.active
                    ? 'Al desactivar esta cuenta se cerrarán sus sesiones activas.'
                    : 'La cuenta volverá a poder iniciar sesión y recibir atribución en QRs.'}
              </p>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#F4CA73]">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Tu contraseña de Administrador
                </label>
                <div className="relative">
                  <input
                    type={sShowMaster ? 'text' : 'password'}
                    autoFocus
                    required
                    disabled={sSubmitting}
                    value={sMasterPassword}
                    onChange={(e) => {
                      setSMasterPassword(e.target.value);
                      setSError(null);
                    }}
                    placeholder={`Ingresa tu contraseña de administrador (${adminLabel})`}
                    className="w-full min-h-[44px] rounded-xl border border-[#F4CA73]/40 bg-[#110804] pl-3.5 pr-12 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSShowMaster((p) => !p)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-white/60 hover:text-[#F4CA73] cursor-pointer"
                  >
                    {sShowMaster ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {sError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/65 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{sError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={sSubmitting}
                  onClick={() => setSecretActionModal(null)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sSubmitting}
                  data-preserve-surface={secretActionModal.kind === 'delete' ? undefined : 'true'}
                  className={`min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold shadow cursor-pointer disabled:opacity-60 ${
                    secretActionModal.kind === 'delete'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] text-[#1A0E08]'
                  }`}
                >
                  {sSubmitting
                    ? 'Verificando...'
                    : secretActionModal.kind === 'delete'
                      ? 'Confirmar eliminación'
                      : 'Confirmar cambio'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Modal 5: Per-Admin Password Authorization for Create Account */}
      <SecretKeyModal
        open={Boolean(pendingCreateDraft)}
        badgeLabel="Autorización de Administrador"
        title="Confirmar con tu contraseña de Administrador"
        description={
          pendingCreateDraft
            ? `Ingresa tu contraseña de administrador (${adminLabel}) para crear esta cuenta de ${
                pendingCreateDraft.role === 'vendedor' ? 'Vendedor / Embajador' : 'Telemarketing'
              }.`
            : undefined
        }
        inputLabel="Tu contraseña de Administrador"
        inputPlaceholder={`Ingresa tu contraseña de administrador (${adminLabel})`}
        emptyErrorMessage="Ingresa tu contraseña de Administrador."
        confirmLabel="Autorizar y crear cuenta"
        closeOnNonAuthError
        onNonAuthError={(err) => setCError(err.message || 'No se pudo crear la cuenta.')}
        onClose={() => setPendingCreateDraft(null)}
        onAuthorize={handleAuthorizeCreateAccount}
      />
    </div>
  );
};
