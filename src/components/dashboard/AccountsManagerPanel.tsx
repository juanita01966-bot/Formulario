import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
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
import type { ReferralPartner, UserAccount, UserRole } from '../../types/app';
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
  userRole?: UserRole;
  currentUserId?: string;
  currentUsername?: string;
  currentDisplayName?: string;
  openCreateAdminSignal?: number;
  onGoToAiControl?: () => void;
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

export const AccountsManagerPanel: React.FC<AccountsManagerPanelProps> = ({
  accounts,
  referrers = [],
  userRole = 'admin',
  currentUserId,
  currentUsername,
  currentDisplayName,
  openCreateAdminSignal = 0,
  onGoToAiControl,
  onCreateAccount,
  onUpdateAccount,
  onUpdateAccountPassword,
  onDeleteAccount,
  onBusyChange,
}) => {
  const isAiManager = userRole === 'ai_manager';
  const [roleFilter, setRoleFilter] = useState<'all' | 'vendedor' | 'telemarketing' | 'admin'>('all');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cDisplayName, setCDisplayName] = useState('');
  const [cUsername, setCUsername] = useState('');
  const [cRole, setCRole] = useState<'vendedor' | 'telemarketing' | 'admin'>('vendedor');
  const [cTag, setCTag] = useState('');
  const [cTagTouched, setCTagTouched] = useState(false);
  const [cAvatarUrl, setCAvatarUrl] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cConfirmPassword, setCConfirmPassword] = useState('');
  const [cPin, setCPin] = useState('');
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
  const lastCreateAdminSignalRef = useRef(openCreateAdminSignal);

  // Edit Modal (displayName, tag, active, avatarUrl)
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

  // Delete / Toggle Active Modal
  const [secretActionModal, setSecretActionModal] = useState<{
    kind: 'delete' | 'toggle';
    account: UserAccount;
  } | null>(null);
  const [sMasterPassword, setSMasterPassword] = useState('');
  const [sShowMaster, setSShowMaster] = useState(false);
  const [sSubmitting, setSSubmitting] = useState(false);
  const [sError, setSError] = useState<string | null>(null);

  // AI Manager sees ALL accounts (including all Admins); regular Admin sees strict self-only Admin + team
  const scopedAccounts = useMemo(
    () =>
      isAiManager
        ? accounts
        : accounts.filter((acc) => {
            if (acc.role === 'ai_manager') return false;
            if (acc.role !== 'admin') return true;
            if (currentUserId) return acc.id === currentUserId;
            if (currentUsername) {
              return acc.username.toLowerCase() === currentUsername.trim().toLowerCase();
            }
            return false;
          }),
    [accounts, isAiManager, currentUserId, currentUsername]
  );

  const currentAdminAccount = useMemo(
    () =>
      currentUserId
        ? scopedAccounts.find((a) => a.id === currentUserId)
        : scopedAccounts.find((a) => a.role === 'admin' || a.role === 'ai_manager'),
    [scopedAccounts, currentUserId]
  );

  const adminLabel = useMemo(() => {
    const display = (currentDisplayName || currentAdminAccount?.displayName || '').trim();
    const uname = (currentUsername || currentAdminAccount?.username || '').trim();
    if (display && uname && display.toLowerCase() !== uname.toLowerCase()) {
      return `${display} (@${uname})`;
    }
    if (uname) return `@${uname}`;
    return display || 'tu cuenta actual';
  }, [currentDisplayName, currentUsername, currentAdminAccount]);

  useEffect(() => {
    const busy =
      createOpen ||
      Boolean(pendingCreateDraft) ||
      Boolean(editingAccount) ||
      Boolean(passwordModalAccount) ||
      Boolean(secretActionModal);
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [
    createOpen,
    pendingCreateDraft,
    editingAccount,
    passwordModalAccount,
    secretActionModal,
    onBusyChange,
  ]);

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

  const openCreateModal = (initialRole: 'vendedor' | 'telemarketing' | 'admin' = 'vendedor') => {
    setCDisplayName('');
    setCUsername('');
    setCRole(initialRole === 'admin' && !isAiManager ? 'vendedor' : initialRole);
    setCTag('');
    setCTagTouched(false);
    setCAvatarUrl('');
    setCPassword('');
    setCConfirmPassword('');
    setCPin('');
    setCShowPasswords(false);
    setCError(null);
    setPendingCreateDraft(null);
    setCreateOpen(true);
  };

  useEffect(() => {
    if (isAiManager && openCreateAdminSignal > lastCreateAdminSignalRef.current) {
      lastCreateAdminSignalRef.current = openCreateAdminSignal;
      openCreateModal('admin');
    }
  }, [isAiManager, openCreateAdminSignal]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
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
    const cleanPin = cPin.trim();
    if (cRole === 'admin' && !/^\d{4,8}$/.test(cleanPin)) {
      setCError('El PIN 2FA de Administrador es obligatorio y debe tener entre 4 y 8 dígitos.');
      return;
    }

    const draft: PendingCreateAccountDraft = {
      username: cleanUser,
      displayName: cleanDisplay,
      role: cRole,
      tag: cleanTag,
      ...(cRole === 'vendedor' && avatarCheck.value ? { avatarUrl: avatarCheck.value } : {}),
      password: cPassword,
      confirmPassword: cConfirmPassword,
      ...(cRole === 'admin' ? { pin: cleanPin } : {}),
    };

    if (isAiManager) {
      setCSubmitting(true);
      try {
        await onCreateAccount({
          ...draft,
          masterPassword: '',
          adminPassword: '',
        });
        setCreateOpen(false);
        const roleLabel =
          draft.role === 'admin'
            ? 'Administrador'
            : draft.role === 'vendedor'
              ? 'Vendedor / Embajador'
              : 'Telemarketing';
        setBanner({
          type: 'success',
          text: `Cuenta "${draft.displayName}" (${roleLabel}) creada con tag ${draft.tag}.`,
        });
      } catch (err) {
        setCError(
          err instanceof DsbAuthError || err instanceof Error
            ? err.message
            : 'No se pudo crear la cuenta.'
        );
      } finally {
        setCSubmitting(false);
      }
      return;
    }

    setPendingCreateDraft(draft);
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
      const roleLabel =
        draft.role === 'admin'
          ? 'Administrador'
          : draft.role === 'vendedor'
            ? 'Vendedor / Embajador'
            : 'Telemarketing';
      setBanner({
        type: 'success',
        text: `Cuenta "${draft.displayName}" (${roleLabel}) creada con tag ${draft.tag}.`,
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
    if (!isAiManager && !eMasterPassword) {
      setEError('Ingresa tu contraseña de Administrador para guardar los cambios.');
      return;
    }

    setESubmitting(true);
    try {
      await onUpdateAccount(editingAccount.id, {
        masterPassword: isAiManager ? '' : eMasterPassword,
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
    if (!isAiManager && !sMasterPassword) {
      setSError('Ingresa tu contraseña de Administrador.');
      return;
    }

    const { kind, account } = secretActionModal;
    const effectiveSecret = isAiManager ? '' : sMasterPassword;
    setSSubmitting(true);
    try {
      if (kind === 'delete') {
        await onDeleteAccount(account.id, effectiveSecret);
        setBanner({
          type: 'success',
          text: `Cuenta "${account.displayName}" eliminada.`,
        });
      } else {
        await onUpdateAccount(account.id, {
          masterPassword: effectiveSecret,
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

  const adminTheme = getRoleTheme(userRole);

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden dsb-glass rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: adminTheme.headerStrip }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl shadow-md border border-white/25"
              style={{ background: adminTheme.heroGradient }}
            >
              <RoleSymbolSvg role={userRole} className="h-6 w-6 sm:h-7 sm:w-7" animated={false} />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8B0018]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#B91C1C] shrink-0" />
                {isAiManager
                  ? 'Directorio Global · Autoridad AI Manager'
                  : 'Gestión de Cuentas y Tags Únicos'}
              </span>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#22150E] leading-snug">
                {isAiManager
                  ? 'Todas las Cuentas (Administradores, Vendedores y Telemarketing)'
                  : 'Cuentas de Telemarketing y Vendedores'}
              </h2>
              <p className="text-xs text-[#594133] mt-0.5 max-w-2xl">
                {isAiManager
                  ? 'Crea, edita, activa/desactiva o elimina cualquier cuenta (incluyendo Administradores) en 1 clic sin contraseñas. Para rotar contraseñas o PIN 2FA de Administradores usa Centro AI.'
                  : `Cada Vendedor / Embajador tiene su Tag único sincronizado con Estudio QR y Métricas. Crear, editar o eliminar cuentas de equipo se autoriza con tu contraseña (${adminLabel}).`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openCreateModal('vendedor')}
            style={{ background: adminTheme.heroGradient }}
            className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer shrink-0"
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
      <section className="dsb-glass rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-5 space-y-3.5">
        <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap border-b border-slate-900/10 pb-3 -mx-0.5 px-0.5">
          {(
            [
              { id: 'all', label: `Todas (${counts.all})`, roleKey: userRole },
              { id: 'vendedor', label: `Vendedores / Embajadores (${counts.vendedor})`, roleKey: 'vendedor' as const },
              { id: 'telemarketing', label: `Telemarketing (${counts.telemarketing})`, roleKey: 'telemarketing' as const },
              {
                id: 'admin',
                label: isAiManager
                  ? `Administradores (${counts.admin})`
                  : `Mi cuenta Admin (${counts.admin})`,
                roleKey: 'admin' as const,
              },
            ] as const
          ).map((tab) => {
            const active = roleFilter === tab.id;
            const tabTheme = getRoleTheme(tab.roleKey);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[36px] rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
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
              onClick={() => openCreateModal(roleFilter === 'admin' && isAiManager ? 'admin' : 'vendedor')}
              style={{ background: adminTheme.heroGradient }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-white hover:brightness-110 cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Crear cuenta nueva
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleAccounts.map((acc) => {
              const isAdminAcc = acc.role === 'admin';
              const isAiMgrAcc = acc.role === 'ai_manager';
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
                  className={`relative overflow-hidden rounded-2xl border p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-all duration-200 ${
                    !acc.active
                      ? 'border-stone-300/80 bg-stone-100/65 backdrop-blur-md opacity-80'
                      : 'dsb-glass-subtle bg-white/70 hover:bg-white/85 hover:shadow-sm'
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
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs backdrop-blur-md bg-white/80"
                        style={{ borderColor: accTheme.borderTint }}
                      >
                        <RoleSymbolSvg role={acc.role} className="h-7 w-7" animated={false} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h3 className="text-[14.5px] font-bold text-[#22150E] break-words">
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
                        {isAiMgrAcc
                          ? '1FA Directo · Autoridad Suprema'
                          : isAdminAcc
                            ? 'Usuario + Contraseña + PIN 2FA'
                            : 'Usuario + Contraseña (sin PIN)'}
                      </p>
                    </div>
                  </div>

                  {/* Per-account actions */}
                  <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto lg:shrink-0 pt-2 border-t border-slate-900/10 lg:pt-0 lg:border-t-0">
                    {isAiMgrAcc ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 py-1.5 text-[11px] font-bold text-amber-900">
                          <Crown className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                          Cuenta Suprema
                        </span>
                        {onGoToAiControl && (
                          <button
                            type="button"
                            onClick={onGoToAiControl}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-xs font-bold text-[#594133] hover:bg-[#FAF1E4] cursor-pointer"
                          >
                            Centro AI
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ) : !isAdminAcc ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openPasswordModal(acc)}
                          className="inline-flex min-h-[36px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-[#FAF3E8] px-2.5 sm:px-3 py-1.5 text-xs font-bold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-[#B84A27] shrink-0" />
                          Cambiar contraseña
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(acc)}
                          className="inline-flex min-h-[36px] flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl border border-[#DFCBB3] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 shrink-0" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => openSecretAction('toggle', acc)}
                          className={`inline-flex min-h-[36px] flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
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
                            className="inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : isAiManager ? (
                      <>
                        {onGoToAiControl && (
                          <button
                            type="button"
                            onClick={onGoToAiControl}
                            className="inline-flex min-h-[36px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Crown className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                            Clave / PIN en Centro AI
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(acc)}
                          className="inline-flex min-h-[36px] flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl border border-[#DFCBB3] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 shrink-0" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openSecretAction('toggle', acc)}
                          className={`inline-flex min-h-[36px] flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
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
                            title="Eliminar cuenta Admin"
                            aria-label={`Eliminar cuenta ${acc.displayName}`}
                            className="inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="rounded-xl border border-[#E6D5BF] bg-[#FAF3E8]/80 px-3 py-1.5 text-[11px] font-semibold text-[#7B5D4A]">
                        Tu cuenta de Administrador
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Compact Single-Card Policy Banner (Opción A for Admin, Centro AI shortcut for AI Manager) */}
      <section
        aria-label="Política de credenciales Administradoras"
        className="relative overflow-hidden dsb-glass rounded-[20px] sm:rounded-[22px] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ borderColor: adminTheme.borderTint }}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            data-preserve-surface="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#FDE68A] shadow-sm border border-white/20"
            style={{ background: adminTheme.heroGradient }}
          >
            {isAiManager ? <Crown className="h-4.5 w-4.5" /> : <Lock className="h-4.5 w-4.5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-[#22150E] leading-snug">
              {isAiManager
                ? 'Cambio de contraseña y PIN 2FA de cuentas Administradoras'
                : 'El cambio de contraseña o PIN de cuentas Administradoras es gestionado exclusivamente por el AI Manager.'}
            </p>
            <p className="text-[11px] sm:text-xs text-[#6E5341] mt-0.5">
              {isAiManager
                ? 'Usa Centro AI para rotar contraseñas, PINs 2FA y revocar sesiones activas de cualquier Administrador en 1 clic.'
                : 'Por política de seguridad institucional, solo el AI Manager puede modificar credenciales de Administrador.'}
            </p>
          </div>
        </div>
        {isAiManager && onGoToAiControl && (
          <button
            type="button"
            onClick={onGoToAiControl}
            style={{ background: adminTheme.heroGradient }}
            className="inline-flex min-h-[38px] w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:brightness-110 cursor-pointer"
          >
            <span>Ir a Centro AI</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </section>

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

              <div className={`grid grid-cols-1 ${isAiManager ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2`}>
                {(isAiManager
                  ? (['vendedor', 'telemarketing', 'admin'] as const)
                  : (['vendedor', 'telemarketing'] as const)
                ).map((roleOption) => {
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
                      className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition-all cursor-pointer min-w-0 ${
                        selected
                          ? 'bg-white ring-2 ring-offset-1'
                          : 'bg-white/60 hover:bg-white/85 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <RoleSymbolSvg role={roleOption} className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" animated={selected} />
                      <div className="min-w-0 flex-1">
                        <span
                          data-dsb-role-label={roleOption}
                          className="block text-xs font-bold leading-tight truncate"
                          style={{ color: optTheme.primary }}
                        >
                          {roleOption === 'admin'
                            ? 'Administrador'
                            : roleOption === 'vendedor'
                              ? 'Vendedor'
                              : 'Telemarketing'}
                        </span>
                        <span className="block text-[10px] font-medium text-[#6E5341] truncate mt-0.5">
                          {optTheme.codename}
                        </span>
                      </div>
                      {selected && (
                        <span
                          className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-white"
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
                    : cRole === 'admin'
                      ? 'Identificador único de la nueva cuenta Administradora (acceso con contraseña + PIN 2FA).'
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

              {cRole === 'admin' && isAiManager && (
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">
                    PIN 2FA de Administrador (4 a 8 dígitos) *
                  </label>
                  <input
                    type={cShowPasswords ? 'text' : 'password'}
                    required
                    inputMode="numeric"
                    maxLength={8}
                    disabled={cSubmitting}
                    value={cPin}
                    onChange={(e) => setCPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Ej. 2025 (obligatorio, 4 a 8 dígitos)"
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 font-mono text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none disabled:opacity-60"
                  />
                </div>
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

              {!isAiManager && (
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
              )}

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
                  {cSubmitting
                    ? 'Creando cuenta...'
                    : isAiManager
                      ? 'Crear cuenta'
                      : 'Continuar y autorizar'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 2: Edit Account */}
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

                {!isAiManager && (
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
                )}
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
                  {eSubmitting
                    ? 'Guardando...'
                    : isAiManager
                      ? 'Guardar cambios'
                      : 'Autorizar y guardar'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 3: Change Password for Telemarketing / Vendedor */}
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

      {/* Modal 4: Confirmation for Toggle Active / Delete (Zero-Password for AI Manager) */}
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
                    {isAiManager ? 'Autoridad AI Manager · Sin Contraseña' : 'Autorización de Administrador'}
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

              {!isAiManager && (
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
              )}

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
                    ? 'Aplicando...'
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
        bypassPassword={isAiManager}
        badgeLabel="Autorización de Administrador"
        title="Confirmar con tu contraseña de Administrador"
        description={
          pendingCreateDraft
            ? `Ingresa tu contraseña de administrador (${adminLabel}) para crear esta cuenta de ${
                pendingCreateDraft.role === 'admin'
                  ? 'Administrador'
                  : pendingCreateDraft.role === 'vendedor'
                    ? 'Vendedor / Embajador'
                    : 'Telemarketing'
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

