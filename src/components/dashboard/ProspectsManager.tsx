import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CalendarCheck2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  LayoutList,
  List,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  PauseCircle,
  Phone,
  PhoneCall,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CallOutcome,
  GiftItem,
  Lead,
  LeadCategory,
  ReferralPartner,
  UserAccount,
  UserRole,
} from '../../types/app';
import { GiftIllustration } from '../gifts/GiftIllustration';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import type { KpiFilterKey } from './KpiGrid';
import { getRoleTheme } from './roleTheme';

export interface LeadUpdatePayload {
  called?: boolean;
  callOutcome?: CallOutcome;
  category?: LeadCategory;
  orderAmount?: number | null;
  notes?: string;
  promoCodeInvalidated?: boolean;
  sellerLocked?: boolean;
  confirmLock?: boolean;
  adminPassword?: string;
}

type LeadWithPromo = Lead & {
  promoCodeInvalidated?: boolean;
  promoCodeInvalidatedAt?: string | null;
};

interface ProspectsManagerProps {
  leads: Lead[];
  gifts: GiftItem[];
  referrers?: ReferralPartner[];
  accounts?: UserAccount[];
  userRole?: UserRole;
  currentUser?: {
    userId?: string;
    displayName?: string;
    username?: string;
    tag?: string;
  } | null;
  hideOriginFilter?: boolean;
  defaultTicketAmount: number;
  activeFilter: KpiFilterKey;
  onFilterChange: (filter: KpiFilterKey) => void;
  onUpdateLead: (id: string, updates: LeadUpdatePayload) => Promise<void>;
  onCreateManualLead?: (payload: {
    name: string;
    phone: string;
    address: string;
    giftId: string;
    referrerId?: string | null;
    referralCode?: string | null;
  }) => Promise<void>;
  onDeleteLead?: (id: string) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

const CATEGORY_LABELS: Record<LeadCategory, string> = {
  none: 'Sin clasificar',
  cita: 'Cita',
  demo: 'Demo',
  orden: 'Orden',
};

const CATEGORY_RANK: Record<LeadCategory, number> = {
  none: 0,
  cita: 1,
  demo: 2,
  orden: 3,
};

function isPromoCodeInvalidated(lead: Lead): boolean {
  const extended = lead as LeadWithPromo;
  if (typeof extended.promoCodeInvalidated === 'boolean') {
    return extended.promoCodeInvalidated;
  }
  return lead.category !== 'none';
}

function isClientLead(lead: Lead): boolean | null {
  if (!lead.qualification) return null;
  if (typeof lead.qualification.isClient === 'boolean') {
    return lead.qualification.isClient;
  }
  const profile = (lead.qualification.creditProfile || '').toLowerCase();
  if (profile.includes('no es cliente') || profile.includes('no conoc')) return false;
  if (profile.includes('es cliente')) return true;
  return null;
}

function getUsCreditDisplay(lead: Lead): {
  badgeLabel: string;
  csvLabel: string;
  className: string;
} | null {
  const status = lead.qualification?.usCreditEstablished;
  const rawLabel = lead.qualification?.usCreditLabel?.trim() || '';
  if (status === 'yes') {
    return {
      badgeLabel: 'Crédito EE. UU.: Establecido',
      csvLabel: rawLabel || 'Crédito establecido en EE. UU.',
      className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    };
  }
  if (status === 'building') {
    return {
      badgeLabel: 'Crédito EE. UU.: En construcción',
      csvLabel: rawLabel || 'Construyendo crédito en EE. UU.',
      className: 'bg-amber-50 border-amber-200 text-amber-900',
    };
  }
  if (status === 'no') {
    return {
      badgeLabel: 'Crédito EE. UU.: Sin establecer',
      csvLabel: rawLabel || 'Sin crédito establecido en EE. UU.',
      className: 'bg-stone-100 border-stone-300 text-stone-700',
    };
  }
  if (rawLabel) {
    return {
      badgeLabel: rawLabel,
      csvLabel: rawLabel,
      className: 'bg-[#FAF3E8] border-[#EAD9C2] text-[#4E382B]',
    };
  }
  return null;
}

const FILTER_PILLS: Array<{ key: KpiFilterKey; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pend. Telemarketing' },
  { key: 'scheduled', label: 'Agendados' },
  { key: 'reposo', label: 'En Reposo' },
  { key: 'cita', label: 'Citas' },
  { key: 'demo', label: 'Demos' },
  { key: 'orden', label: 'Órdenes' },
  { key: 'vip', label: '🔥 Buen Crédito (VIP)' },
  { key: 'client', label: 'Es cliente' },
  { key: 'non_client', label: 'No es cliente' },
  { key: 'called', label: 'Ya llamados' },
];

const CATEGORIES: Array<{
  id: Exclude<LeadCategory, 'none'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}> = [
  {
    id: 'cita',
    label: 'Cita',
    icon: Calendar,
    activeClass: 'bg-rose-600 text-white shadow-sm',
  },
  {
    id: 'demo',
    label: 'Demo',
    icon: Briefcase,
    activeClass: 'bg-sky-600 text-white shadow-sm',
  },
  {
    id: 'orden',
    label: 'Orden',
    icon: Package,
    activeClass: 'bg-emerald-600 text-white shadow-sm',
  },
];

function formatRelativeOrDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const ProspectsManager: React.FC<ProspectsManagerProps> = ({
  leads,
  gifts,
  referrers = [],
  accounts = [],
  userRole = 'admin',
  currentUser = null,
  hideOriginFilter = false,
  defaultTicketAmount,
  activeFilter,
  onFilterChange,
  onUpdateLead,
  onCreateManualLead,
  onDeleteLead,
  onBusyChange,
}) => {
  const isAiManager = userRole === 'ai_manager';
  const isAdmin = userRole === 'admin' || isAiManager;
  const isVendedor = userRole === 'vendedor';
  const roleTheme = getRoleTheme(userRole);

  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [expandedCompactIds, setExpandedCompactIds] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [lockedHintId, setLockedHintId] = useState<string | null>(null);
  const [togglingLeadId, setTogglingLeadId] = useState<string | null>(null);
  const [updatingCategoryLeadId, setUpdatingCategoryLeadId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  const defaultGiftId = useMemo(
    () => gifts.find((g) => g.active)?.id || gifts[0]?.id || '',
    [gifts]
  );

  // Manual Lead Modal (Admin & Vendedor)
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualGiftId, setManualGiftId] = useState(defaultGiftId);
  const [manualReferrerKey, setManualReferrerKey] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Security Confirmation Modal (assigning / progressing to Orden)
  const [confirmCategoryModal, setConfirmCategoryModal] = useState<{
    lead: Lead;
    targetCategory: Exclude<LeadCategory, 'none'>;
  } | null>(null);
  const [confirmOrderAmount, setConfirmOrderAmount] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [savingOrderAmountId, setSavingOrderAmountId] = useState<string | null>(null);

  // Admin Password Modal (reverting category / reactivating promo code / downgrading)
  const [adminRevertModal, setAdminRevertModal] = useState<{
    lead: Lead;
    targetCategory: LeadCategory;
    mode: 'reactivate_code' | 'downgrade' | 'unmark_called';
  } | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    const busy =
      manualOpen ||
      Boolean(confirmCategoryModal) ||
      Boolean(adminRevertModal) ||
      Boolean(togglingLeadId) ||
      Boolean(updatingCategoryLeadId) ||
      Boolean(savingOrderAmountId) ||
      expandedNotesId !== null;
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [
    manualOpen,
    confirmCategoryModal,
    adminRevertModal,
    togglingLeadId,
    updatingCategoryLeadId,
    savingOrderAmountId,
    expandedNotesId,
    onBusyChange,
  ]);

  const referrerById = useMemo(() => {
    const map = new Map<string, ReferralPartner>();
    for (const r of referrers) {
      map.set(r.id, r);
    }
    return map;
  }, [referrers]);

  const referrerByCode = useMemo(() => {
    const map = new Map<string, ReferralPartner>();
    for (const r of referrers) {
      map.set(r.code.trim().toUpperCase(), r);
    }
    return map;
  }, [referrers]);

  const accountByTag = useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const acc of accounts) {
      if (acc.role !== 'vendedor') continue;
      map.set(acc.tag.trim().toUpperCase(), acc);
    }
    return map;
  }, [accounts]);

  const resolveLeadReferral = (
    lead: Lead
  ): {
    code: string;
    name: string | null;
    partnerId: string | null;
    avatarUrl: string | null;
    emoji: string | null;
    isEmbajador: boolean;
    ownerVendedorName: string | null;
    ownerVendedorTag: string | null;
  } | null => {
    const rawCode = (lead.referralCode || '').trim().toUpperCase();
    const matchedPartner =
      (lead.referrerId ? referrerById.get(lead.referrerId) : undefined) ||
      (rawCode ? referrerByCode.get(rawCode) : undefined);
    const codeUpper = rawCode || (matchedPartner?.code || '').trim().toUpperCase();
    const matchedAccount = codeUpper ? accountByTag.get(codeUpper) : undefined;
    const avatarUrl = matchedPartner?.avatarUrl ?? matchedAccount?.avatarUrl ?? null;
    const emoji = matchedPartner?.emoji ?? null;
    const isEmbajador = matchedPartner?.partnerType === 'embajador';

    if (matchedPartner) {
      return {
        code: rawCode || matchedPartner.code,
        name: matchedPartner.name,
        partnerId: matchedPartner.id,
        avatarUrl,
        emoji,
        isEmbajador,
        ownerVendedorName: matchedPartner.ownerVendedorName ?? null,
        ownerVendedorTag: matchedPartner.ownerVendedorTag ?? null,
      };
    }
    if (rawCode || lead.referrerName) {
      return {
        code: rawCode,
        name: lead.referrerName || matchedAccount?.displayName || null,
        partnerId: lead.referrerId || matchedAccount?.referrerId || null,
        avatarUrl,
        emoji: null,
        isEmbajador: false,
        ownerVendedorName: null,
        ownerVendedorTag: null,
      };
    }
    return null;
  };

  const originFilterOptions = useMemo(() => {
    let organicCount = 0;
    const countsByPartnerId = new Map<string, number>();
    const orphanCodes = new Map<string, { label: string; count: number }>();

    for (const lead of leads) {
      const ref = resolveLeadReferral(lead);
      if (!ref) {
        organicCount += 1;
        continue;
      }
      if (ref.partnerId && referrerById.has(ref.partnerId)) {
        countsByPartnerId.set(ref.partnerId, (countsByPartnerId.get(ref.partnerId) || 0) + 1);
      } else if (ref.code) {
        const prev = orphanCodes.get(ref.code);
        orphanCodes.set(ref.code, {
          label: ref.name ? `${ref.name} (${ref.code})` : ref.code,
          count: (prev?.count || 0) + 1,
        });
      }
    }

    const partnerEntries = referrers.map((partner) => ({
      value: `partner:${partner.id}`,
      label: `${partner.name} (${partner.code})`,
      count: countsByPartnerId.get(partner.id) || 0,
    }));

    const orphanEntries = Array.from(orphanCodes.entries()).map(([code, meta]) => ({
      value: `code:${code}`,
      label: meta.label,
      count: meta.count,
    }));

    return {
      organicCount,
      partnerEntries,
      orphanEntries,
    };
  }, [leads, referrers, referrerById, referrerByCode]);

  const vendedorOwnTag = (currentUser?.tag || '').trim().toUpperCase();
  const vendedorOwnReferrer = useMemo(() => {
    if (!isVendedor) return null;
    return (
      referrers.find(
        (r) =>
          r.partnerType !== 'embajador' &&
          ((currentUser?.userId && r.accountId === currentUser.userId) ||
            (vendedorOwnTag && r.code.trim().toUpperCase() === vendedorOwnTag))
      ) || null
    );
  }, [isVendedor, referrers, currentUser?.userId, vendedorOwnTag]);

  const { manualVendedorOptions, manualEmbajadorOptions, allManualOptions } = useMemo(() => {
    const vendedoresByTag = new Map<
      string,
      { label: string; referrerId: string | null; code: string; isEmbajador: boolean }
    >();
    const embajadoresByTag = new Map<
      string,
      { label: string; referrerId: string | null; code: string; isEmbajador: boolean }
    >();

    if (isAdmin) {
      for (const acc of accounts) {
        if (acc.role !== 'vendedor' || !acc.active) continue;
        const code = acc.tag.trim().toUpperCase();
        if (!code) continue;
        const linkedRef =
          (acc.referrerId ? referrerById.get(acc.referrerId) : undefined) ||
          referrerByCode.get(code);
        vendedoresByTag.set(code, {
          label: `${acc.displayName} (${code})`,
          referrerId: linkedRef?.id ?? acc.referrerId ?? null,
          code,
          isEmbajador: false,
        });
      }
    }

    for (const ref of referrers) {
      if (!ref.active) continue;
      const code = ref.code.trim().toUpperCase();
      if (!code) continue;

      if (ref.partnerType === 'embajador') {
        const isOwnedByCurrentVendedor =
          !isVendedor ||
          (currentUser?.userId && ref.ownerVendedorAccountId === currentUser.userId) ||
          (vendedorOwnTag && (ref.ownerVendedorTag || '').trim().toUpperCase() === vendedorOwnTag) ||
          (!ref.ownerVendedorAccountId && !ref.ownerVendedorTag && code !== vendedorOwnTag);
        if (!isOwnedByCurrentVendedor) continue;

        const emojiPrefix = ref.emoji?.trim() ? `${ref.emoji.trim()} ` : '✨ ';
        const ownerCtx =
          isAdmin && (ref.ownerVendedorName || ref.ownerVendedorTag)
            ? ` · de ${ref.ownerVendedorName || ref.ownerVendedorTag}`
            : '';
        embajadoresByTag.set(code, {
          label: `${emojiPrefix}${ref.name} (${code})${ownerCtx}`,
          referrerId: ref.id,
          code,
          isEmbajador: true,
        });
        continue;
      }

      if (isAdmin && !vendedoresByTag.has(code)) {
        vendedoresByTag.set(code, {
          label: `${ref.name} (${code})`,
          referrerId: ref.id,
          code,
          isEmbajador: false,
        });
      }
    }

    const vList = Array.from(vendedoresByTag.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'es')
    );
    const eList = Array.from(embajadoresByTag.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'es')
    );
    return {
      manualVendedorOptions: vList,
      manualEmbajadorOptions: eList,
      allManualOptions: [...vList, ...eList],
    };
  }, [accounts, referrers, referrerById, referrerByCode, isAdmin, isVendedor, currentUser?.userId, vendedorOwnTag]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rawCodeQuery = q.replace(/^#/, '');
    return leads.filter((lead) => {
      const outcome: CallOutcome = lead.callOutcome ?? (lead.called ? 'scheduled' : 'pending');
      if (activeFilter === 'vip' && lead.qualification?.tier !== 'alto') return false;
      if (activeFilter === 'client' && isClientLead(lead) !== true) return false;
      if (activeFilter === 'non_client' && isClientLead(lead) !== false) return false;
      if (activeFilter === 'pending' && outcome !== 'pending') return false;
      if (activeFilter === 'scheduled' && outcome !== 'scheduled') return false;
      if (activeFilter === 'reposo' && outcome !== 'not_scheduled') return false;
      if (activeFilter === 'called' && !lead.called) return false;
      if (activeFilter === 'cita' && lead.category !== 'cita') return false;
      if (activeFilter === 'demo' && lead.category !== 'demo') return false;
      if (activeFilter === 'orden' && lead.category !== 'orden') return false;

      if (!hideOriginFilter && originFilter !== 'all') {
        const ref = resolveLeadReferral(lead);
        if (originFilter === 'organic') {
          if (ref !== null) return false;
        } else if (originFilter.startsWith('partner:')) {
          const targetId = originFilter.slice('partner:'.length);
          const targetPartner = referrerById.get(targetId);
          const matchesId = ref?.partnerId === targetId;
          const matchesCode =
            Boolean(targetPartner) &&
            Boolean(ref?.code) &&
            ref?.code === targetPartner!.code.trim().toUpperCase();
          if (!matchesId && !matchesCode) return false;
        } else if (originFilter.startsWith('code:')) {
          const targetCode = originFilter.slice('code:'.length);
          if (!ref || ref.code !== targetCode) return false;
        }
      }

      if (!q) return true;
      const claimLower = (lead.claimCode || '').toLowerCase();
      const claimDigits = claimLower.replace(/^otn-/, '');
      const refInfo = resolveLeadReferral(lead);
      const usCreditInfo = getUsCreditDisplay(lead);
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.address || '').toLowerCase().includes(q) ||
        claimLower.includes(rawCodeQuery) ||
        claimDigits.includes(rawCodeQuery) ||
        (lead.giftName || '').toLowerCase().includes(q) ||
        (refInfo?.code || '').toLowerCase().includes(q) ||
        (refInfo?.name || '').toLowerCase().includes(q) ||
        (lead.qualification?.usCreditLabel || '').toLowerCase().includes(q) ||
        (usCreditInfo?.badgeLabel || '').toLowerCase().includes(q)
      );
    });
  }, [leads, activeFilter, originFilter, search, referrerById, referrerByCode]);

  // Reset pagination to page 1 when filters, search, or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter, originFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * pageSize;
  const paginatedLeads = useMemo(
    () => filteredLeads.slice(pageStartIndex, pageStartIndex + pageSize),
    [filteredLeads, pageStartIndex, pageSize]
  );

  const toggleCompactRowExpanded = (leadId: string) => {
    setExpandedCompactIds((prev) => ({ ...prev, [leadId]: !prev[leadId] }));
  };

  const handleToggleCalled = async (lead: Lead) => {
    if (!isAdmin || togglingLeadId) return;
    setActionError(null);

    const hasStatusLock =
      Boolean(lead.sellerLocked) ||
      CATEGORY_RANK[lead.category] > 0 ||
      isPromoCodeInvalidated(lead);
    if (hasStatusLock) {
      return;
    }

    setTogglingLeadId(lead.id);
    try {
      await onUpdateLead(lead.id, {
        called: !lead.called,
        callOutcome: !lead.called ? 'scheduled' : 'pending',
      });
      setLockedHintId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar el estado de llamada.');
    } finally {
      setTogglingLeadId(null);
    }
  };

  const handleImmediateForwardAdvance = async (
    lead: Lead,
    targetCategory: Exclude<LeadCategory, 'none'>
  ) => {
    if (updatingCategoryLeadId) return;
    setActionError(null);
    setUpdatingCategoryLeadId(lead.id);
    try {
      await onUpdateLead(lead.id, {
        category: targetCategory,
        ...(isVendedor ? {} : { promoCodeInvalidated: true }),
        confirmLock: true,
      });
      setExpandedNotesId((cur) => (cur === lead.id ? null : cur));
      setConfirmDeleteId((cur) => (cur === lead.id ? null : cur));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado del prospecto.'
      );
    } finally {
      setUpdatingCategoryLeadId(null);
    }
  };

  const handleImmediateAiDowngrade = async (lead: Lead, cat: Exclude<LeadCategory, 'none'>) => {
    if (updatingCategoryLeadId) return;
    setActionError(null);
    setUpdatingCategoryLeadId(lead.id);
    try {
      await onUpdateLead(lead.id, {
        category: cat,
        ...(lead.category === 'orden' ? { orderAmount: null } : {}),
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo retroceder el estado del prospecto.'
      );
    } finally {
      setUpdatingCategoryLeadId(null);
    }
  };

  const handleImmediateAiReactivate = async (lead: Lead) => {
    if (updatingCategoryLeadId) return;
    setActionError(null);
    setUpdatingCategoryLeadId(lead.id);
    try {
      await onUpdateLead(lead.id, {
        category: 'none',
        promoCodeInvalidated: false,
        sellerLocked: false,
        orderAmount: null,
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo revertir el estado del prospecto.'
      );
    } finally {
      setUpdatingCategoryLeadId(null);
    }
  };

  const handleCategoryClick = (lead: Lead, cat: Exclude<LeadCategory, 'none'>) => {
    const outcome: CallOutcome = lead.callOutcome ?? (lead.called ? 'scheduled' : 'pending');
    const currentRank = CATEGORY_RANK[lead.category];
    const targetRank = CATEGORY_RANK[cat];

    // Current active stage — no-op
    if (targetRank === currentRank) {
      return;
    }

    // Backward / Downgrade (targetRank < currentRank)
    if (targetRank < currentRank) {
      if (isAiManager) {
        void handleImmediateAiDowngrade(lead, cat);
        return;
      }
      if (!isAdmin && !isVendedor) {
        return;
      }
      setActionError(null);
      setAdminPassword('');
      setShowAdminPassword(false);
      setAdminError(null);
      setAdminRevertModal({
        lead,
        targetCategory: cat,
        mode: 'downgrade',
      });
      return;
    }

    // Forward advance (targetRank > currentRank) — allowed without password once eligible
    if (!isAiManager) {
      if (outcome === 'not_scheduled' || (!lead.called && outcome !== 'scheduled' && currentRank === 0)) {
        setLockedHintId(lead.id);
        window.setTimeout(() => setLockedHintId((cur) => (cur === lead.id ? null : cur)), 2400);
        return;
      }
    }

    if (cat === 'orden') {
      setActionError(null);
      setConfirmError(null);
      setConfirmNotes(lead.notes || '');
      setConfirmOrderAmount(String(lead.orderAmount ?? defaultTicketAmount));
      setConfirmCategoryModal({ lead, targetCategory: cat });
      return;
    }

    void handleImmediateForwardAdvance(lead, cat);
  };

  const handleOpenReactivateModal = (lead: Lead) => {
    if (isAiManager) {
      void handleImmediateAiReactivate(lead);
      return;
    }
    if (!isAdmin && !isVendedor) return;
    setActionError(null);
    setAdminPassword('');
    setShowAdminPassword(false);
    setAdminError(null);
    setAdminRevertModal({
      lead,
      targetCategory: 'none',
      mode: 'reactivate_code',
    });
  };

  const handleConfirmCategoryAssign = async () => {
    if (!confirmCategoryModal || confirmLoading) return;
    const { lead, targetCategory } = confirmCategoryModal;
    let resolvedOrderAmount: number | null = null;
    if (targetCategory === 'orden') {
      const trimmedAmount = confirmOrderAmount.trim();
      const parsed = trimmedAmount === '' ? defaultTicketAmount : Number(trimmedAmount);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setConfirmError('Ingresa un monto de orden válido (mayor o igual a 0).');
        return;
      }
      resolvedOrderAmount = parsed;
    }
    setConfirmError(null);
    setConfirmLoading(true);
    try {
      const trimmedNotes = confirmNotes.trim();
      await onUpdateLead(lead.id, {
        category: targetCategory,
        ...(targetCategory === 'orden' ? { orderAmount: resolvedOrderAmount } : {}),
        ...(trimmedNotes !== (lead.notes || '').trim() ? { notes: trimmedNotes } : {}),
        ...(isVendedor ? {} : { promoCodeInvalidated: true }),
        confirmLock: true,
      });
      setAmountDraft((prev) => {
        if (!(lead.id in prev)) return prev;
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
      setExpandedNotesId((cur) => (cur === lead.id ? null : cur));
      setConfirmDeleteId((cur) => (cur === lead.id ? null : cur));
      setConfirmCategoryModal(null);
    } catch (err) {
      setConfirmError(
        err instanceof Error ? err.message : 'No se pudo confirmar la clasificación.'
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleSubmitAdminRevert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRevertModal || adminLoading) return;
    if (!adminPassword) {
      setAdminError('Ingresa la contraseña de Administrador para autorizar.');
      return;
    }

    const { lead, targetCategory, mode } = adminRevertModal;
    setAdminError(null);
    setAdminLoading(true);
    try {
      if (mode === 'unmark_called') {
        await onUpdateLead(lead.id, {
          called: false,
          category: 'none',
          promoCodeInvalidated: false,
          sellerLocked: false,
          orderAmount: null,
          adminPassword,
        });
      } else if (mode === 'downgrade' && targetCategory !== 'none') {
        await onUpdateLead(lead.id, {
          category: targetCategory,
          ...(lead.category === 'orden' ? { orderAmount: null } : {}),
          adminPassword,
        });
      } else {
        await onUpdateLead(lead.id, {
          category: 'none',
          ...(isVendedor
            ? { orderAmount: null }
            : {
                promoCodeInvalidated: false,
                sellerLocked: false,
                orderAmount: null,
              }),
          adminPassword,
        });
      }
      setAdminPassword('');
      setAdminRevertModal(null);
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : 'Contraseña incorrecta o error de autorización.'
      );
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSaveOrderAmount = async (lead: Lead) => {
    if (savingOrderAmountId) return;
    if (lead.orderAmount !== null && lead.orderAmount !== undefined) return;
    const raw = amountDraft[lead.id] ?? String(defaultTicketAmount);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setActionError('Ingresa un monto de orden válido (mayor o igual a 0).');
      return;
    }
    setActionError(null);
    setSavingOrderAmountId(lead.id);
    try {
      await onUpdateLead(lead.id, { orderAmount: parsed });
      setAmountDraft((prev) => {
        if (!(lead.id in prev)) return prev;
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar el monto de la orden.');
    } finally {
      setSavingOrderAmountId(null);
    }
  };

  const handleSaveNotes = async (lead: Lead) => {
    if (isVendedor) return;
    const isLocked =
      Boolean(lead.sellerLocked) ||
      lead.category !== 'none' ||
      isPromoCodeInvalidated(lead);
    if (isLocked) return;
    const nextNotes = notesDraft[lead.id] ?? lead.notes;
    setActionError(null);
    try {
      await onUpdateLead(lead.id, { notes: nextNotes });
      setExpandedNotesId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar la nota.');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Nombre',
      'Telefono',
      'Direccion',
      'Regalo',
      'Codigo',
      'Calificacion',
      'Puntaje',
      'CreditoEEUU',
      'EstadoMarca',
      'ValoracionSalud',
      'ProductoInteres',
      'Llamado',
      'Categoria',
      'MontoOrden',
      'OrigenQR',
      'CodigoReferido',
      'Fecha',
      'Notas',
    ];
    const rows = filteredLeads.map((l) => {
      const refInfo = resolveLeadReferral(l);
      const usCreditInfo = getUsCreditDisplay(l);
      return [
        `"${l.name.replace(/"/g, '""')}"`,
        `"${l.phone}"`,
        `"${(l.address || '').replace(/"/g, '""')}"`,
        `"${(l.giftName || '').replace(/"/g, '""')}"`,
        `"${l.claimCode}"`,
        `"${l.qualification?.tier || ''}"`,
        l.qualification?.score ?? '',
        `"${(usCreditInfo?.csvLabel || '').replace(/"/g, '""')}"`,
        `"${(l.qualification?.creditProfile || '').replace(/"/g, '""')}"`,
        `"${(l.qualification?.housingStatus || '').replace(/"/g, '""')}"`,
        `"${(l.qualification?.investmentPriority || '').replace(/"/g, '""')}"`,
        l.called ? 'Si' : 'No',
        l.category,
        l.orderAmount ?? '',
        `"${(refInfo?.name || (refInfo ? 'QR' : 'Orgánico')).replace(/"/g, '""')}"`,
        `"${(refInfo?.code || '').replace(/"/g, '""')}"`,
        l.createdAt,
        `"${(l.notes || '').replace(/"/g, '""')}"`,
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metricas-ciprian-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteLeadClick = async (leadId: string) => {
    if (!onDeleteLead || deletingLeadId) return;
    setActionError(null);
    setDeletingLeadId(leadId);
    try {
      await onDeleteLead(leadId);
      setConfirmDeleteId((cur) => (cur === leadId ? null : cur));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el prospecto.');
    } finally {
      setDeletingLeadId(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateManualLead || manualSubmitting) return;
    setManualError(null);
    if (manualName.trim().length < 2) {
      setManualError('Ingresa un nombre completo válido (mínimo 2 caracteres).');
      return;
    }
    if (manualPhone.replace(/\D/g, '').length < 7) {
      setManualError('Ingresa un número de teléfono válido (mínimo 7 dígitos).');
      return;
    }
    const chosenSeller = manualReferrerKey
      ? allManualOptions.find((s) => s.code === manualReferrerKey) || null
      : null;
    const resolvedReferrerId = isVendedor
      ? chosenSeller
        ? chosenSeller.referrerId
        : vendedorOwnReferrer?.id ?? null
      : chosenSeller?.referrerId ?? null;
    const resolvedReferralCode = isVendedor
      ? chosenSeller
        ? chosenSeller.code
        : vendedorOwnTag || vendedorOwnReferrer?.code?.trim().toUpperCase() || null
      : chosenSeller?.code ?? null;
    const resolvedGiftId =
      manualGiftId && gifts.some((g) => g.id === manualGiftId)
        ? manualGiftId
        : defaultGiftId;

    setManualSubmitting(true);
    try {
      await onCreateManualLead({
        name: manualName.trim(),
        phone: manualPhone.trim(),
        address: manualAddress.trim(),
        giftId: resolvedGiftId,
        referrerId: resolvedReferrerId,
        referralCode: resolvedReferralCode,
      });
      setManualName('');
      setManualPhone('');
      setManualAddress('');
      setManualGiftId(defaultGiftId);
      setManualReferrerKey('');
      setManualError(null);
      setManualOpen(false);
    } catch (err) {
      setManualError(
        err instanceof Error ? err.message : 'No se pudo registrar el prospecto.'
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <>
    <section className="relative overflow-hidden dsb-glass rounded-[24px] sm:rounded-[26px] p-3 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: roleTheme.headerStrip }}
      />
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-900/10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#22150E] leading-snug">
              {isVendedor ? 'Mis Prospectos del Show de Cocina' : 'Prospectos del Show de Cocina'}
            </h2>
            <span className="dsb-glass-subtle inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[#594133] tabular-nums">
              {filteredLeads.length}
            </span>
          </div>
          <p className="text-xs text-[#594133] mt-0.5 leading-relaxed">
            {isAiManager
              ? 'Autoridad AI Manager: avanza, retrocede o reactiva códigos en 1 clic sin contraseña.'
              : isVendedor
                ? 'Visualiza y registra tus prospectos. Avanza libremente (Cita → Demo → Orden) sin contraseña; retroceder requiere contraseña de Administrador.'
                : 'Gestiona prospectos y avanza libremente (Cita → Demo → Orden) sin contraseña; retroceder requiere contraseña de Administrador.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
          {/* Compact vs Detailed View Toggle */}
          <div
            role="group"
            aria-label="Modo de vista de prospectos"
            className="dsb-glass-subtle inline-flex items-center rounded-full p-0.5 border border-[#DFCBB3]/75 shrink-0"
          >
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              aria-pressed={viewMode === 'compact'}
              className={`inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? roleTheme.activePillClass
                  : 'text-[#594133] hover:text-[#22150E]'
              }`}
            >
              <List className="h-3.5 w-3.5 shrink-0" />
              <span>Compacta</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              aria-pressed={viewMode === 'detailed'}
              className={`inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'detailed'
                  ? roleTheme.activePillClass
                  : 'text-[#594133] hover:text-[#22150E]'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5 shrink-0" />
              <span>Detallada</span>
            </button>
          </div>

          {(isAdmin || isVendedor) && onCreateManualLead && (
            <button
              type="button"
              data-preserve-surface="true"
              onClick={() => {
                setManualError(null);
                setManualGiftId(defaultGiftId);
                setManualReferrerKey('');
                setManualOpen(true);
              }}
              style={{ background: roleTheme.heroGradient }}
              className="inline-flex min-h-[40px] flex-1 sm:flex-none min-w-0 items-center justify-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold text-white whitespace-nowrap shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Agregar prospecto</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="dsb-glass-subtle inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#4E382B] hover:bg-white/85 transition-colors cursor-pointer shrink-0"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            CSV
          </button>
        </div>
      </div>

      {/* Search, Origin Dropdown & Filter Chips */}
      <div className="mt-3.5 sm:mt-4 space-y-2.5 sm:space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative flex-1 md:max-w-md min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7B5D4A]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, Nº de orden, embajador o regalo..."
              className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm py-2 sm:py-2.5 pl-10 pr-3.5 sm:pr-4 text-base sm:text-sm text-[#22150E] placeholder:text-[#8A6D5B] focus:border-[#8B0018] focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {!hideOriginFilter && isAdmin && (
            <div className="flex items-center gap-2 w-full md:w-auto min-w-0 shrink-0">
              <QrCode className={`h-4 w-4 shrink-0 ${roleTheme.textAccent}`} />
              <label
                htmlFor="prospects-origin-filter"
                className="text-xs font-semibold text-[#594133] whitespace-nowrap shrink-0"
              >
                Origen QR:
              </label>
              <select
                id="prospects-origin-filter"
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="flex-1 md:flex-none min-w-0 w-full md:w-auto md:max-w-[260px] min-h-[42px] sm:min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3 py-2 text-base sm:text-xs font-semibold text-[#22150E] focus:border-[#8B0018] focus:bg-white focus:outline-none transition-colors"
              >
                <option value="all">Todos los orígenes ({leads.length})</option>
                <option value="organic">Orgánico / Sin QR ({originFilterOptions.organicCount})</option>
                {originFilterOptions.partnerEntries.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label} · {entry.count}
                  </option>
                ))}
                {originFilterOptions.orphanEntries.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    QR {entry.label} · {entry.count}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible max-w-full">
          {FILTER_PILLS.map((pill) => {
            const active = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => onFilterChange(pill.key)}
                className={`shrink-0 whitespace-nowrap min-h-[38px] sm:min-h-[34px] rounded-full px-3 sm:px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? roleTheme.activePillClass
                    : 'dsb-glass-subtle text-[#594133] hover:bg-white/85'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/90 backdrop-blur-sm px-3.5 py-2.5 text-xs font-semibold text-rose-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:underline cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Leads List */}
      <div className={viewMode === 'compact' ? 'mt-3.5 space-y-2' : 'mt-4 space-y-3'}>
        {filteredLeads.length === 0 ? (
          <div className="dsb-glass-subtle rounded-2xl border-dashed border-[#DFCBB3] py-10 text-center">
            <p className="font-serif text-lg font-semibold text-[#594133]">Sin prospectos en esta vista</p>
            <p className="mt-1 text-xs text-[#7B5D4A]">
              Cuando alguien complete el formulario público aparecerá automáticamente aquí.
            </p>
          </div>
        ) : (
          paginatedLeads.map((lead) => {
            const matchedGift = gifts.find((g) => g.id === lead.giftId);
            const referralSource = resolveLeadReferral(lead);
            const showLockHint = lockedHintId === lead.id;
            const notesOpen = expandedNotesId === lead.id;
            const promoInvalidated = isPromoCodeInvalidated(lead);
            const leadOutcome: CallOutcome =
              lead.callOutcome ?? (lead.called ? 'scheduled' : 'pending');
            const currentRank = CATEGORY_RANK[lead.category];
            const hasAssignedCategory = currentRank > 0;
            const isFinalStage = lead.category === 'orden';
            const hasStatusLock =
              Boolean(lead.sellerLocked) || hasAssignedCategory || promoInvalidated;
            const canChangeStatusBase =
              isAiManager ||
              (leadOutcome !== 'not_scheduled' &&
                (lead.called || leadOutcome === 'scheduled' || hasAssignedCategory));
            const isUpdatingCategoryThis = updatingCategoryLeadId === lead.id;
            const isOrderAmountLocked =
              lead.category === 'orden' &&
              lead.orderAmount !== null &&
              lead.orderAmount !== undefined;
            const isTogglingThis = togglingLeadId === lead.id;
            const isSavingAmountThis = savingOrderAmountId === lead.id;
            const cleanTel = lead.phone.replace(/[^\d+]/g, '');
            const whatsappUrl = `https://wa.me/${cleanTel.replace(/^\+/, '')}?text=${encodeURIComponent(
              `Hola ${lead.name}, te saludo de Royal Prestige / Show de Cocina respecto a tu obsequio "${lead.giftName || 'regalo de otoño'}" (Número de orden ${lead.claimCode}).`
            )}`;
            const isCompactCollapsed = viewMode === 'compact' && !expandedCompactIds[lead.id];

            if (isCompactCollapsed) {
              return (
                <div
                  key={lead.id}
                  data-dsb-card={
                    isFinalStage ? 'locked' : lead.called || hasAssignedCategory ? 'default' : 'pending'
                  }
                  className={`min-w-0 max-w-full rounded-2xl border px-3 py-2 sm:px-3.5 sm:py-2.5 backdrop-blur-md transition-all duration-150 ${
                    isFinalStage
                      ? 'border-stone-300/80 bg-stone-50/70'
                      : lead.called || hasAssignedCategory
                        ? 'border-white/75 bg-white/72 shadow-[0_4px_14px_-10px_rgba(15,23,42,0.14)] hover:bg-white/88'
                        : 'border-amber-300/80 bg-gradient-to-r from-white/78 to-[#FEF7E8]/75 hover:bg-white/90'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0">
                    {/* Clickable Compact Summary Info */}
                    <button
                      type="button"
                      onClick={() => toggleCompactRowExpanded(lead.id)}
                      aria-expanded={false}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-x-2.5 gap-y-1 min-w-0 flex-1 text-left cursor-pointer group"
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          lead.category === 'orden'
                            ? 'bg-emerald-500'
                            : lead.category === 'demo'
                              ? 'bg-sky-500'
                              : lead.category === 'cita'
                                ? 'bg-rose-500'
                                : leadOutcome === 'not_scheduled'
                                  ? 'bg-amber-500'
                                  : lead.called
                                    ? 'bg-emerald-400'
                                    : 'bg-amber-400'
                        }`}
                      />
                      <span className="text-[13.5px] sm:text-sm font-bold text-[#22150E] truncate max-w-[180px] sm:max-w-[200px] group-hover:underline">
                        {lead.name}
                      </span>
                      <span className="font-mono text-[11.5px] text-[#594133] tabular-nums shrink-0">
                        {lead.phone}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums shrink-0 ${
                          promoInvalidated
                            ? 'bg-stone-100 border-stone-300 text-stone-500 line-through'
                            : 'bg-[#FAF0E0] border-[#E6C99E] text-[#8C4A19]'
                        }`}
                      >
                        {lead.claimCode}
                      </span>
                      {referralSource && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#E5C17B] bg-[#FFF4DC] px-2 py-0.5 text-[10px] font-bold text-[#7A4610] max-w-[150px] truncate shrink-0">
                          {referralSource.isEmbajador && (
                            <Sparkles className="h-2.5 w-2.5 shrink-0 text-[#C88A2B]" />
                          )}
                          <span className="truncate">
                            {referralSource.name || referralSource.code}
                          </span>
                        </span>
                      )}
                      {lead.qualification?.tier === 'alto' && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                          🔥 VIP
                        </span>
                      )}
                      {lead.category === 'orden' && lead.orderAmount != null && (
                        <span className="font-mono text-[11px] font-bold text-emerald-700 tabular-nums shrink-0">
                          ${Number(lead.orderAmount).toLocaleString('en-US')}
                        </span>
                      )}
                      {lead.category === 'none' && leadOutcome === 'not_scheduled' && (
                        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shrink-0">
                          Reposo
                        </span>
                      )}
                    </button>

                    {/* Right: Quick Status Pills (Cita | Demo | Orden) + Expand Chevron */}
                    <div className="relative flex items-center justify-between md:justify-end gap-1.5 shrink-0">
                      <div
                        data-dsb-segmented={canChangeStatusBase ? 'active' : 'disabled'}
                        className={`grid grid-cols-3 flex-1 md:flex-none md:inline-flex items-center rounded-xl p-0.5 border transition-opacity ${
                          canChangeStatusBase
                            ? 'bg-[#FAF3E8] border-[#E3D0B8]'
                            : 'bg-stone-100 border-stone-200 opacity-65'
                        }`}
                      >
                        {CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          const targetRank = CATEGORY_RANK[cat.id];
                          const isSelected = targetRank === currentRank;
                          const isForward = targetRank > currentRank;
                          const isBackward = targetRank < currentRank;

                          const btnDisabled =
                            isUpdatingCategoryThis ||
                            (isSelected
                              ? true
                              : isBackward
                                ? !(isAdmin || isVendedor)
                                : false);
                          const isLockedForward = isForward && !canChangeStatusBase;

                          const btnTitle = isSelected
                            ? `Estado actual: ${cat.label}`
                            : isBackward
                              ? isAiManager
                                ? `Retroceder a ${cat.label} (1 clic · AI Manager)`
                                : `Retroceder a ${cat.label} (requiere contraseña de Administrador)`
                              : canChangeStatusBase
                                ? `Avanzar a ${cat.label}`
                                : leadOutcome === 'not_scheduled'
                                  ? 'En Reposo · No disponible'
                                  : isVendedor
                                    ? 'Pendiente de Telemarketing — se habilitará cuando marquen la llamada'
                                    : 'Expande y marca llamada primero';

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              disabled={btnDisabled}
                              aria-disabled={isLockedForward ? true : undefined}
                              aria-current={isSelected ? 'step' : undefined}
                              onClick={() => handleCategoryClick(lead, cat.id)}
                              title={btnTitle}
                              className={`min-w-0 inline-flex min-h-[36px] sm:min-h-[30px] items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all ${
                                isSelected
                                  ? `${cat.activeClass} cursor-default`
                                  : isBackward
                                    ? isAdmin || isVendedor
                                      ? 'text-[#6E5341] hover:bg-amber-50 hover:text-[#8C3318] cursor-pointer disabled:opacity-55'
                                      : 'text-stone-400 opacity-55 cursor-not-allowed'
                                    : btnDisabled || isLockedForward
                                      ? 'text-stone-400 opacity-60 cursor-not-allowed'
                                      : isForward && canChangeStatusBase
                                        ? 'text-[#594133] hover:bg-white/75 cursor-pointer'
                                        : 'text-stone-500 hover:bg-white/40 cursor-pointer'
                              }`}
                            >
                              {isSelected ? (
                                <Icon className="h-3 w-3 shrink-0" />
                              ) : isBackward && !isAiManager ? (
                                <Lock className="h-2.5 w-2.5 shrink-0 opacity-75" />
                              ) : !canChangeStatusBase && isForward ? (
                                <Lock className="h-2.5 w-2.5 opacity-70 shrink-0" />
                              ) : (
                                <Icon className="h-3 w-3 shrink-0" />
                              )}
                              <span className="truncate">{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleCompactRowExpanded(lead.id)}
                        aria-label={`Expandir detalles de ${lead.name}`}
                        title="Ver detalles completos"
                        className="inline-flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl border border-[#DFCBB3]/85 bg-white/75 hover:bg-white text-[#594133] transition-colors cursor-pointer"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>

                      <AnimatePresence>
                        {showLockHint && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute right-0 -bottom-8 z-20 rounded-lg bg-[#22150E] px-2.5 py-1 text-[10px] font-semibold text-amber-200 shadow-lg whitespace-nowrap"
                          >
                            {leadOutcome === 'not_scheduled'
                              ? 'En Reposo · No disponible'
                              : isVendedor
                                ? 'Pendiente de Telemarketing — se habilitará cuando marquen la llamada'
                                : 'Expande y marca “Ya se llamó” primero'}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={lead.id}
                data-dsb-card={isFinalStage ? 'locked' : lead.called || hasAssignedCategory ? 'default' : 'pending'}
                className={`min-w-0 max-w-full rounded-2xl border p-3 sm:p-4 backdrop-blur-md transition-all duration-200 ${
                  isFinalStage
                    ? 'border-stone-300/80 bg-stone-50/70'
                    : lead.called || hasAssignedCategory
                      ? 'border-white/75 bg-white/72 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] hover:bg-white/85'
                      : 'border-amber-300/80 bg-gradient-to-r from-white/78 to-[#FEF7E8]/75 shadow-[0_6px_20px_-14px_rgba(180,83,9,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] hover:bg-white/88'
                }`}
              >
                {viewMode === 'compact' && (
                  <div className="mb-2.5 pb-2 border-b border-slate-900/10 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#7B5D4A]">
                      Vista expandida · {lead.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCompactRowExpanded(lead.id)}
                      className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-[#DFCBB3] bg-white/80 hover:bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#594133] cursor-pointer"
                    >
                      <span>Contraer</span>
                      <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                    </button>
                  </div>
                )}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 min-w-0">
                  {/* Left: Person & Revealed Gift */}
                  <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    <div
                      className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border ${
                        isFinalStage
                          ? 'bg-stone-100 border-stone-200 opacity-75'
                          : 'bg-[#FAF3E8] border-[#E6D5BF]'
                      }`}
                    >
                      <GiftIllustration
                        visualKey={matchedGift?.visualKey || lead.giftVisualKey || 'cutlery'}
                        customImageUrl={matchedGift?.customImageUrl}
                        accentColor={matchedGift?.accentColor || '#C88A2B'}
                        size={30}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                        <h3 className="text-[14.5px] sm:text-[15px] font-bold text-[#22150E] min-w-0 max-w-full break-words leading-snug">
                          {lead.name}
                        </h3>
                        <span
                          className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10.5px] sm:text-[11px] font-bold tabular-nums break-words ${
                            promoInvalidated
                              ? 'bg-stone-100 border-stone-300 text-stone-500 line-through'
                              : 'bg-[#FAF0E0] border-[#E6C99E] text-[#8C4A19]'
                          }`}
                          title={
                            promoInvalidated
                              ? `Número de orden ${lead.claimCode} invalidado`
                              : `Número de orden ${lead.claimCode} válido`
                          }
                        >
                          <Hash className="h-3 w-3 shrink-0 opacity-75" />
                          <span className="min-w-0 break-all">Orden {lead.claimCode}</span>
                        </span>
                        <span
                          className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold break-words ${
                            promoInvalidated
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          {promoInvalidated ? (
                            <>
                              <Lock className="h-2.5 w-2.5 shrink-0" />
                              <span>Código invalidado</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-2.5 w-2.5 shrink-0" />
                              <span>Código válido</span>
                            </>
                          )}
                        </span>
                        {lead.category === 'orden' ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 break-words">
                            <Lock className="h-2.5 w-2.5 shrink-0" />
                            <span className="min-w-0 break-words">Cerrado · Orden</span>
                          </span>
                        ) : lead.category === 'demo' ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 break-words">
                            <Briefcase className="h-2.5 w-2.5 shrink-0" />
                            <span className="min-w-0 break-words">En curso · Demo</span>
                          </span>
                        ) : lead.category === 'cita' ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 break-words">
                            <Calendar className="h-2.5 w-2.5 shrink-0" />
                            <span className="min-w-0 break-words">En curso · Cita</span>
                          </span>
                        ) : hasStatusLock ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-stone-300 bg-stone-200/80 px-2.5 py-0.5 text-[10px] font-bold text-stone-700 break-words">
                            <Lock className="h-2.5 w-2.5 shrink-0" />
                            <span className="min-w-0 break-words">Bloqueado</span>
                          </span>
                        ) : leadOutcome === 'scheduled' ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 break-words">
                            <CalendarCheck2 className="h-2.5 w-2.5 shrink-0" />
                            <span className="min-w-0 break-words">Cita agendada · Disponible</span>
                          </span>
                        ) : leadOutcome === 'not_scheduled' ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                            <PauseCircle className="h-2.5 w-2.5 shrink-0" />
                            <span>En Reposo</span>
                          </span>
                        ) : (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 break-words">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            <span className="min-w-0 break-words">Pendiente de Telemarketing</span>
                          </span>
                        )}
                        {referralSource && (
                          <span
                            className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-0.5 text-[10.5px] font-bold ${
                              referralSource.isEmbajador
                                ? 'border-[#C8A85B]/75 bg-[#FFF4DC] text-[#6B3F0E]'
                                : 'border-[#E5C17B] bg-[#FFF4DC] text-[#7A4610]'
                            }`}
                            title={
                              referralSource.isEmbajador
                                ? `Embajador: ${referralSource.name || referralSource.code}${
                                    referralSource.ownerVendedorName
                                      ? ` · de ${referralSource.ownerVendedorName}`
                                      : ''
                                  }`
                                : `Referido por ${referralSource.name || referralSource.code}`
                            }
                          >
                            {referralSource.avatarUrl || referralSource.emoji ? (
                              <AmbassadorAvatar
                                name={referralSource.name || referralSource.code}
                                avatarUrl={referralSource.avatarUrl}
                                emoji={referralSource.emoji}
                                size="xs"
                                ring="none"
                              />
                            ) : (
                              <QrCode className="h-3 w-3 shrink-0 text-[#C88A2B] ml-1" />
                            )}
                            <span className="min-w-0 break-words">
                              {referralSource.isEmbajador ? '' : 'QR · '}
                              {referralSource.name ? `${referralSource.name}` : referralSource.code}
                              {referralSource.name && referralSource.code ? ` (${referralSource.code})` : ''}
                            </span>
                            {referralSource.isEmbajador && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-[#C88A2B]/40 bg-white/75 px-1.5 py-0.25 text-[9px] font-extrabold uppercase tracking-wider text-[#8C4A19] shrink-0">
                                <Sparkles className="h-2.5 w-2.5 shrink-0 text-[#C88A2B]" />
                                Embajador
                              </span>
                            )}
                          </span>
                        )}
                        {lead.qualification && (
                          <span
                            className={`max-w-full min-w-0 break-words leading-snug rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide border ${
                              lead.qualification.tier === 'alto'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : lead.qualification.tier === 'medio'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            {lead.qualification.tier === 'alto'
                              ? `🔥 Buen Crédito · Alto Potencial (${lead.qualification.score} pts)`
                              : lead.qualification.tier === 'medio'
                                ? `⭐ Crédito Calificable (${lead.qualification.score} pts)`
                                : `🌱 Potencial Básico (${lead.qualification.score} pts)`}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6E5341] min-w-0">
                        <span className="font-mono tabular-nums font-medium text-[#22150E] break-all">
                          {lead.phone}
                        </span>
                        <span className="text-[#C8B29A]">·</span>
                        <span className="font-semibold text-[#8C3318] min-w-0 break-words">
                          Regalo: {lead.giftName || 'Pendiente por destapar'}
                        </span>
                        <span className="text-[#C8B29A]">·</span>
                        <span>{formatRelativeOrDate(lead.createdAt)}</span>
                      </div>

                      {lead.address && (
                        <div className="mt-1 flex items-start gap-1.5 text-xs text-[#5C4332] min-w-0 max-w-full">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9E4725] mt-0.5" />
                          <span className="break-words min-w-0">{lead.address}</span>
                        </div>
                      )}

                      {lead.qualification && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] min-w-0">
                          {(() => {
                            const usCredit = getUsCreditDisplay(lead);
                            return usCredit ? (
                              <span
                                className={`max-w-full min-w-0 break-words leading-snug rounded-lg border px-2 py-0.5 font-semibold ${usCredit.className}`}
                                title={usCredit.csvLabel}
                              >
                                {usCredit.badgeLabel}
                              </span>
                            ) : null;
                          })()}
                          {isClientLead(lead) !== null && (
                            <span
                              className={`max-w-full min-w-0 break-words rounded-lg border px-2 py-0.5 font-semibold ${
                                isClientLead(lead)
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-amber-50 border-amber-200 text-amber-900'
                              }`}
                            >
                              {isClientLead(lead) ? 'Es cliente' : 'No es cliente'}
                            </span>
                          )}
                          <span className="max-w-full min-w-0 break-words leading-snug rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                            {lead.qualification.creditProfile}
                          </span>
                          <span className="max-w-full min-w-0 break-words leading-snug rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                            {lead.qualification.housingStatus}
                          </span>
                          <span className="max-w-full min-w-0 break-words leading-snug rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                            {lead.qualification.investmentPriority}
                          </span>
                        </div>
                      )}

                      {/* Quick contact, notes & revert bar */}
                      <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                        <a
                          href={`tel:${cleanTel}`}
                          className="inline-flex min-h-[40px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-[#E6D5BF] bg-[#FAF3E8]/70 px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-semibold text-[#4E382B] hover:bg-[#F3E4CE] transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0 text-[#B84A27]" />
                          <span>Llamar</span>
                        </a>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[40px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0" />
                          <span>WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          disabled={(hasStatusLock || isVendedor) && !lead.notes}
                          data-dsb-disabled-control={(hasStatusLock || isVendedor) && !lead.notes ? 'true' : undefined}
                          onClick={() => {
                            if ((hasStatusLock || isVendedor) && !lead.notes) return;
                            setExpandedNotesId(notesOpen ? null : lead.id);
                            setNotesDraft((prev) => ({ ...prev, [lead.id]: lead.notes }));
                          }}
                          title={
                            isVendedor && !lead.notes
                              ? 'Agrega notas al avanzar a Cita, Demo u Orden.'
                              : hasStatusLock && !lead.notes
                                ? 'Agrega notas al avanzar el estado o revierte para editar.'
                                : hasStatusLock || isVendedor
                                  ? 'Ver nota guardada (solo lectura)'
                                  : lead.notes
                                    ? 'Ver o editar nota'
                                    : 'Agregar nota'
                          }
                          className={`inline-flex min-h-[40px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-semibold transition-colors ${
                            (hasStatusLock || isVendedor) && !lead.notes
                              ? 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                              : 'border-[#E6D5BF] bg-white text-[#6E5341] hover:bg-[#FAF3E8] cursor-pointer'
                          }`}
                        >
                          <StickyNote className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0" />
                          <span>{lead.notes ? 'Ver nota' : 'Nota'}</span>
                        </button>

                        {((isAdmin && hasStatusLock) || (isVendedor && hasAssignedCategory)) && (
                          <button
                            type="button"
                            onClick={() => handleOpenReactivateModal(lead)}
                            className="inline-flex max-w-full min-h-[40px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0 text-[#B84A27]" />
                            <span className="break-words text-left">
                              {isAdmin ? 'Revertir / Reactivar código' : 'Revertir estado'}
                            </span>
                          </button>
                        )}

                        {isAdmin && onDeleteLead && (
                          !hasStatusLock && confirmDeleteId === lead.id ? (
                            <span className="inline-flex flex-wrap max-w-full min-h-[40px] sm:min-h-[32px] items-center gap-2 rounded-xl sm:rounded-lg bg-red-50 border border-red-200 px-3 py-1 text-xs sm:text-[11px]">
                              <button
                                type="button"
                                disabled={deletingLeadId === lead.id}
                                onClick={() => handleDeleteLeadClick(lead.id)}
                                className="min-h-[34px] sm:min-h-0 font-bold text-red-700 hover:underline cursor-pointer disabled:opacity-50"
                              >
                                {deletingLeadId === lead.id ? 'Eliminando...' : 'Confirmar eliminar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[34px] sm:min-h-0 text-[#6E5341] hover:text-[#22150E] cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={hasStatusLock}
                              data-dsb-disabled-icon={hasStatusLock ? 'true' : undefined}
                              onClick={() => {
                                if (hasStatusLock) return;
                                setConfirmDeleteId(lead.id);
                              }}
                              className={`inline-flex min-h-[40px] min-w-[40px] sm:min-h-[32px] sm:min-w-[32px] items-center justify-center rounded-xl sm:rounded-lg p-2 sm:p-1 transition-colors ${
                                hasStatusLock
                                  ? 'text-stone-300 cursor-not-allowed'
                                  : 'text-[#A48A77] hover:bg-red-50 hover:text-red-600 cursor-pointer'
                              }`}
                              title={
                                hasStatusLock
                                  ? 'Estado asignado. Revierte / reactiva el código con contraseña de administrador para eliminar.'
                                  : 'Eliminar prospecto'
                              }
                              aria-label={`Eliminar a ${lead.name}`}
                            >
                              <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Called Check (Admin only) + 3 Categories Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 shrink-0 w-full lg:w-auto pt-2.5 lg:pt-0 border-t lg:border-t-0 border-[#DFCBB3]/45">
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={isTogglingThis || hasStatusLock}
                        data-dsb-disabled-control={hasStatusLock ? 'true' : undefined}
                        onClick={() => handleToggleCalled(lead)}
                        title={
                          hasStatusLock
                            ? 'Llamada bloqueada mientras tenga un estado asignado. Usa Revertir / Reactivar código con contraseña de administrador para desmarcar.'
                            : lead.called
                              ? 'Desmarcar llamada'
                              : 'Marcar como llamado / agendado'
                        }
                        className={`inline-flex min-h-[42px] sm:min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold border transition-all ${
                          showLockHint ? 'ring-4 ring-[#B84A27]/30' : ''
                        } ${
                          hasStatusLock
                            ? 'bg-stone-200/85 border-stone-300 text-stone-500 cursor-not-allowed'
                            : lead.called
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm cursor-pointer disabled:opacity-65'
                              : 'bg-[#FAF3E8] border-[#D8B994] text-[#594133] hover:bg-amber-100/70 cursor-pointer disabled:opacity-65'
                        }`}
                      >
                        {hasStatusLock ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                        ) : (
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              lead.called
                                ? 'border-white bg-white/20 text-white'
                                : 'border-[#B89D86] bg-white'
                            }`}
                          >
                            {lead.called && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>
                        )}
                        <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {isTogglingThis
                            ? 'Guardando...'
                            : lead.called
                              ? 'Ya se llamó'
                              : 'Marcar llamado'}
                        </span>
                      </button>
                    )}

                    {/* 3 Categories Segmented Control */}
                    <div className="relative w-full sm:w-auto min-w-0">
                      <div
                        data-dsb-segmented={canChangeStatusBase ? 'active' : 'disabled'}
                        className={`grid grid-cols-3 w-full sm:w-auto sm:inline-flex items-center rounded-xl p-1 border transition-opacity ${
                          canChangeStatusBase
                            ? 'bg-[#FAF3E8] border-[#E3D0B8]'
                            : 'bg-stone-100 border-stone-200 opacity-60'
                        }`}
                      >
                        {CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          const targetRank = CATEGORY_RANK[cat.id];
                          const isSelected = targetRank === currentRank;
                          const isForward = targetRank > currentRank;
                          const isBackward = targetRank < currentRank;

                          const btnDisabled =
                            isUpdatingCategoryThis ||
                            (isSelected
                              ? true
                              : isBackward
                                ? !(isAdmin || isVendedor)
                                : false);
                          const isLockedForward = isForward && !canChangeStatusBase;

                          const btnTitle = isSelected
                            ? `Estado actual: ${cat.label}`
                            : isBackward
                              ? isAiManager
                                ? `Retroceder a ${cat.label} (1 clic · AI Manager)`
                                : `Retroceder a ${cat.label} (requiere contraseña de Administrador)`
                              : canChangeStatusBase
                                ? currentRank === 0
                                  ? `Asignar a ${cat.label} (sin contraseña)`
                                  : `Avanzar a ${cat.label} (sin contraseña)`
                                : leadOutcome === 'not_scheduled'
                                  ? 'En Reposo · No disponible para clasificación'
                                  : isVendedor
                                    ? 'Pendiente de Telemarketing — se habilitará cuando marquen la llamada'
                                    : 'Marca primero el check de llamada para clasificar';

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              disabled={btnDisabled}
                              aria-disabled={isLockedForward ? true : undefined}
                              aria-current={isSelected ? 'step' : undefined}
                              onClick={() => handleCategoryClick(lead, cat.id)}
                              title={btnTitle}
                              className={`relative min-w-0 inline-flex min-h-[40px] sm:min-h-[34px] items-center justify-center gap-1 rounded-lg px-1.5 sm:px-2.5 py-1.5 text-[11.5px] sm:text-xs font-semibold transition-all ${
                                isSelected
                                  ? `${cat.activeClass} cursor-default`
                                  : isBackward
                                    ? isAdmin || isVendedor
                                      ? 'text-[#6E5341] hover:bg-amber-50 hover:text-[#8C3318] cursor-pointer disabled:opacity-55'
                                      : 'text-stone-400 opacity-55 cursor-not-allowed'
                                    : btnDisabled || isLockedForward
                                      ? 'text-stone-400 opacity-60 cursor-not-allowed'
                                      : isForward && canChangeStatusBase
                                        ? 'text-[#594133] hover:bg-white/70 cursor-pointer'
                                        : 'text-stone-500 hover:bg-white/40 cursor-pointer'
                              }`}
                            >
                              {isSelected ? (
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                              ) : isBackward && !isAiManager ? (
                                <Lock className="h-3 w-3 shrink-0 opacity-75" />
                              ) : !canChangeStatusBase && isForward ? (
                                <Lock className="h-3 w-3 opacity-70 shrink-0" />
                              ) : (
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="truncate">{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <AnimatePresence>
                        {showLockHint && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-1.5 sm:mt-0 sm:absolute sm:right-0 sm:-bottom-8 z-20 rounded-lg bg-[#22150E] px-2.5 py-1.5 sm:py-1 text-[10px] font-semibold text-amber-200 shadow-lg text-center sm:whitespace-nowrap"
                          >
                            {leadOutcome === 'not_scheduled'
                              ? 'Prospecto en Reposo · No disponible para clasificación'
                              : isVendedor
                                ? 'Pendiente de Telemarketing — se habilitará cuando marquen la llamada'
                                : 'Primero marca el check “Ya se llamó”'}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Order amount bar when category === 'orden' */}
                {lead.category === 'orden' &&
                  (isOrderAmountLocked ? (
                    <div className="mt-3 pt-2.5 sm:pt-3 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-stone-100/90 rounded-xl px-3 sm:px-3.5 py-2.5 min-w-0 max-w-full">
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-600 min-w-0">
                        <Lock className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                        <span className="min-w-0 break-words">Monto de la orden confirmado y bloqueado:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white/80 px-3 py-1 font-mono text-xs font-bold text-stone-700 tabular-nums">
                          ${Number(lead.orderAmount).toLocaleString('en-US')} USD
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-stone-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
                          <Lock className="h-2.5 w-2.5 shrink-0" />
                          Guardado
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-2.5 sm:pt-3 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-amber-50/70 rounded-xl px-3 py-2.5 min-w-0 max-w-full">
                      <span className="text-xs font-semibold text-[#594133] min-w-0 break-words">
                        Monto de la orden (al guardar quedará bloqueado):
                      </span>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto min-w-0">
                        <div className="flex items-center gap-1.5 flex-1 min-w-[110px] sm:flex-none">
                          <span className="text-sm sm:text-xs font-bold text-[#6E5341] shrink-0">$</span>
                          <input
                            type="number"
                            min={0}
                            disabled={isSavingAmountThis}
                            value={amountDraft[lead.id] ?? String(defaultTicketAmount)}
                            onChange={(e) =>
                              setAmountDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
                            }
                            className="w-full min-w-0 sm:w-28 min-h-[42px] sm:min-h-[34px] rounded-xl sm:rounded-lg border border-[#DFCBB3] bg-white px-3 py-1.5 text-base sm:text-xs font-mono font-bold text-[#22150E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#C88A2B]/40 disabled:opacity-60"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={isSavingAmountThis}
                          onClick={() => handleSaveOrderAmount(lead)}
                          className="min-h-[42px] sm:min-h-[34px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-lg bg-[#22150E] px-3.5 sm:px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#3A2418] transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                        >
                          <Lock className="h-3 w-3 shrink-0" />
                          <span>{isSavingAmountThis ? 'Guardando...' : 'Guardar y bloquear'}</span>
                        </button>
                      </div>
                    </div>
                  ))}

                {/* Expandable Notes */}
                <AnimatePresence>
                  {notesOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      {hasStatusLock || isVendedor ? (
                        <div className="mt-3 pt-2.5 sm:pt-3 border-t border-stone-200 flex items-start gap-2 rounded-xl bg-stone-100/80 px-3 sm:px-3.5 py-2.5 text-xs text-stone-600 min-w-0 max-w-full">
                          <Lock className="h-3.5 w-3.5 shrink-0 text-stone-400 mt-0.5" />
                          <p className="min-w-0 break-words leading-relaxed">
                            {lead.notes || 'Sin nota registrada.'}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 pt-2.5 sm:pt-3 border-t border-[#EFE3D2] flex flex-col sm:flex-row gap-2 min-w-0">
                          <input
                            type="text"
                            value={notesDraft[lead.id] ?? ''}
                            onChange={(e) =>
                              setNotesDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
                            }
                            placeholder="Escribe notas de la llamada, dirección o fecha de cita..."
                            className="flex-1 min-w-0 w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-xs text-[#22150E] focus:bg-white focus:border-[#B84A27] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNotes(lead)}
                            className="min-h-[42px] sm:min-h-[44px] w-full sm:w-auto rounded-xl bg-[#22150E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A2418] cursor-pointer shrink-0"
                          >
                            Guardar nota
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {filteredLeads.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#594133]">
            <span className="font-semibold tabular-nums">
              Mostrando {pageStartIndex + 1}–{Math.min(pageStartIndex + pageSize, filteredLeads.length)} de{' '}
              {filteredLeads.length}
            </span>
            <span className="text-[#C8B29A]">·</span>
            <label className="inline-flex items-center gap-1.5 font-semibold">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as 10 | 20 | 50)}
                aria-label="Prospectos por página"
                className="min-h-[34px] rounded-lg border border-[#DFCBB3] bg-white/80 px-2 py-1 text-base sm:text-xs font-bold text-[#22150E] focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between sm:justify-end gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-[#DFCBB3] bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-[#594133] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
              <span className="px-2.5 text-xs font-bold text-[#22150E] tabular-nums whitespace-nowrap">
                Página {safePage} de {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-[#DFCBB3] bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-[#594133] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>

      {/* Modal 1: Security Confirmation before assigning category (invalidates promo code) */}
      <AnimatePresence>
        {confirmCategoryModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-category-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/65 backdrop-blur-xs sm:backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto"
            onClick={() => !confirmLoading && setConfirmCategoryModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[24px] sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4"
            >
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-amber-100 border border-amber-300 text-[#8C3318]">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#B84A27] block">
                      {confirmCategoryModal.lead.category !== 'none'
                        ? 'Avance de Estado · Sin Contraseña'
                        : 'Confirmación de Estado'}
                    </span>
                    <h3 id="confirm-category-title" className="font-serif text-base sm:text-xl font-bold text-[#22150E] leading-snug">
                      {confirmCategoryModal.lead.category !== 'none'
                        ? `¿Avanzar de ${CATEGORY_LABELS[confirmCategoryModal.lead.category]} a ${CATEGORY_LABELS[confirmCategoryModal.targetCategory]}?`
                        : `¿Asignar a ${CATEGORY_LABELS[confirmCategoryModal.targetCategory]}?`}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => setConfirmCategoryModal(null)}
                  aria-label="Cerrar confirmación"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[#7B5D4A] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-[#E6D5BF] bg-[#FAF3E8]/75 p-3 sm:p-3.5 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#6E5341] shrink-0">Prospecto:</span>
                  <strong className="text-[#22150E] text-right min-w-0 break-words">
                    {confirmCategoryModal.lead.name}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6E5341] shrink-0">Número de orden / cupón:</span>
                  <span className="rounded-md bg-white border border-[#E6C99E] px-2 py-0.5 font-mono font-bold text-[#8C4A19] break-all">
                    {confirmCategoryModal.lead.claimCode}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6E5341] shrink-0">
                    {confirmCategoryModal.lead.category !== 'none' ? 'Progresión:' : 'Nueva clasificación:'}
                  </span>
                  <strong className="text-[#8C3318] text-right">
                    {confirmCategoryModal.lead.category !== 'none'
                      ? `${CATEGORY_LABELS[confirmCategoryModal.lead.category]} → ${CATEGORY_LABELS[confirmCategoryModal.targetCategory]}`
                      : CATEGORY_LABELS[confirmCategoryModal.targetCategory]}
                  </strong>
                </div>
              </div>

              {confirmCategoryModal.targetCategory === 'orden' && (
                <div className="rounded-2xl border border-[#DFCBB3] bg-[#FFF8EC] p-3 sm:p-3.5 space-y-2">
                  <label
                    htmlFor="confirm-order-amount-input"
                    className="block text-xs font-bold text-[#22150E]"
                  >
                    Monto final de la orden ($ USD)
                  </label>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-[#6E5341] shrink-0">$</span>
                    <input
                      id="confirm-order-amount-input"
                      type="number"
                      min={0}
                      step="any"
                      disabled={confirmLoading}
                      value={confirmOrderAmount}
                      onChange={(e) => {
                        setConfirmOrderAmount(e.target.value);
                        setConfirmError(null);
                      }}
                      className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-[#DFCBB3] bg-white px-3.5 py-2 text-base sm:text-sm font-mono font-bold text-[#22150E] tabular-nums focus:border-[#B84A27] focus:outline-none"
                    />
                    <span className="text-xs font-semibold text-[#7B5D4A] shrink-0">USD</span>
                  </div>
                  <p className="text-[11px] text-[#7B5D4A] leading-relaxed">
                    Actualiza el Ticket Promedio y las ventas del QR embajador. Al confirmar quedará guardado y bloqueado.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-category-notes"
                  className="block text-xs font-semibold text-[#594133]"
                >
                  Nota opcional
                </label>
                <input
                  id="confirm-category-notes"
                  type="text"
                  disabled={confirmLoading}
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Ej. Demostración realizada en domicilio..."
                  className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-xs text-[#22150E] focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 sm:p-3.5 text-xs text-amber-950 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-[#8C3318]">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {confirmCategoryModal.targetCategory === 'orden'
                      ? 'Cierre en Orden · Protección contra retroceso'
                      : 'Avance libre hacia adelante · Retroceso protegido'}
                  </span>
                </p>
                {confirmCategoryModal.targetCategory === 'orden' ? (
                  <p className="leading-relaxed">
                    Al confirmar, el prospecto pasará a <strong>Orden</strong> sin contraseña y el código{' '}
                    <strong className="font-mono break-all">{confirmCategoryModal.lead.claimCode}</strong> quedará{' '}
                    <strong>invalidado</strong>.
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    Podrás seguir avanzando <strong>sin contraseña</strong> (
                    {confirmCategoryModal.targetCategory === 'cita' ? 'Cita → Demo → Orden' : 'Demo → Orden'}) cuando el prospecto progrese. El código{' '}
                    <strong className="font-mono break-all">{confirmCategoryModal.lead.claimCode}</strong> quedará{' '}
                    <strong>invalidado</strong>.
                  </p>
                )}
                <p className="leading-relaxed">
                  <strong>Retroceder a un estado anterior</strong> o reactivar el código{' '}
                  <strong>solo será posible con contraseña de Administrador</strong>.
                </p>
              </div>

              {confirmError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="min-w-0 break-words">{confirmError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => setConfirmCategoryModal(null)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-[#DFCBB3] px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={handleConfirmCategoryAssign}
                  className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#22150E] to-[#8C3318] px-4 sm:px-5 py-2 text-xs font-bold text-[#FFFDF9] text-center shadow hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {confirmLoading
                      ? 'Guardando...'
                      : confirmCategoryModal.lead.category !== 'none'
                        ? `Avanzar a ${CATEGORY_LABELS[confirmCategoryModal.targetCategory]}`
                        : `Confirmar ${CATEGORY_LABELS[confirmCategoryModal.targetCategory]}`}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 2: Admin Password Required to Revert / Reactivate Code or Downgrade Category */}
      <AnimatePresence>
        {adminRevertModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-revert-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#120804]/78 px-3.5 sm:px-4 py-4 sm:py-6 backdrop-blur-sm sm:backdrop-blur-md overflow-y-auto"
            onClick={() => !adminLoading && setAdminRevertModal(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmitAdminRevert}
              autoComplete="off"
              className="relative w-full max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-[24px] sm:rounded-[28px] border border-[#C88A2B]/55 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-4 sm:p-6 text-[#FFFDF9] shadow-[0_32px_80px_-14px_rgba(0,0,0,0.85)] space-y-3.5 sm:space-y-4"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-[#F4CA73]/40 bg-[#F4CA73]/15 text-[#F4CA73]">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F4CA73] block">
                      Autorización de Administrador
                    </span>
                    <h3 id="admin-revert-title" className="font-serif text-base sm:text-xl font-bold text-white leading-snug">
                      {adminRevertModal.mode === 'downgrade'
                        ? `Retroceder estado a ${CATEGORY_LABELS[adminRevertModal.targetCategory]}`
                        : 'Revertir y reactivar código'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={adminLoading}
                  onClick={() => setAdminRevertModal(null)}
                  aria-label="Cerrar modal de administrador"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#C8B29A] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-[#F4CA73]/25 bg-white/[0.04] p-3 sm:p-3.5 text-xs space-y-1.5 text-[#E8D5BE]">
                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0">Prospecto:</span>
                  <strong className="text-white text-right min-w-0 break-words">
                    {adminRevertModal.lead.name}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0">Número de orden:</span>
                  <span className="font-mono font-bold text-[#F4CA73] break-all">
                    {adminRevertModal.lead.claimCode}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0">Acción:</span>
                  <strong className="text-white text-right min-w-0 break-words">
                    {adminRevertModal.mode === 'unmark_called'
                      ? 'Quitar llamado, clasificación y reactivar código'
                      : adminRevertModal.mode === 'downgrade'
                        ? `${CATEGORY_LABELS[adminRevertModal.lead.category]} → ${CATEGORY_LABELS[adminRevertModal.targetCategory]} requiere tu contraseña de Administrador`
                        : 'Quitar clasificación y reactivar código'}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="dsb-admin-revert-password"
                  className="flex items-center gap-1.5 text-xs font-bold text-[#F4CA73]"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Contraseña del Administrador
                </label>
                <div className="relative">
                  <input
                    id="dsb-admin-revert-password"
                    type={showAdminPassword ? 'text' : 'password'}
                    autoFocus
                    disabled={adminLoading}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setAdminError(null);
                    }}
                    placeholder="Ingresa la contraseña de acceso Admin"
                    className="w-full min-h-[44px] rounded-xl border border-[#F4CA73]/40 bg-[#110804] pl-3.5 pr-12 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((prev) => !prev)}
                    aria-label={showAdminPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-white/55 hover:text-[#F4CA73] cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/65 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="min-w-0 break-words">{adminError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={adminLoading}
                  onClick={() => setAdminRevertModal(null)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  data-preserve-surface="true"
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span>{adminLoading ? 'Verificando...' : 'Autorizar cambio'}</span>
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Manual Lead Registration */}
      <AnimatePresence>
        {manualOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/55 backdrop-blur-xs sm:backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto"
            onClick={() => !manualSubmitting && setManualOpen(false)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleManualSubmit}
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[24px] sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">Nuevo prospecto manual</h3>
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => setManualOpen(false)}
                  aria-label="Cerrar modal"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-1 text-[#7B5D4A] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-[#594133] mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Ej. Laura Gómez"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-[#594133] mb-1">Teléfono</label>
                <input
                  type="tel"
                  required
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="Ej. +52 55 1234 5678"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-[#594133] mb-1">Dirección</label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Ej. Av. Reforma 120, Col. Centro"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-[#594133] mb-1">Regalo asignado</label>
                <select
                  value={manualGiftId}
                  onChange={(e) => setManualGiftId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                >
                  {gifts.length === 0 ? (
                    <option value="">Sin regalo asignado</option>
                  ) : (
                    <>
                      {gifts.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}{g.active ? '' : ' (Inactivo)'}
                        </option>
                      ))}
                      <option value="">Sin regalo asignado</option>
                    </>
                  )}
                </select>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-[#594133] mb-1">
                  {isVendedor ? 'Canal de atribución' : 'Vendedor / Embajador (opcional)'}
                </label>
                <select
                  value={manualReferrerKey}
                  onChange={(e) => setManualReferrerKey(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                >
                  {isVendedor ? (
                    <>
                      <option value="">
                        Mi canal directo{vendedorOwnTag ? ` (${vendedorOwnTag})` : ''}
                      </option>
                      {manualEmbajadorOptions.length > 0 && (
                        <optgroup label="Mis Embajadores activos">
                          {manualEmbajadorOptions.map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    <>
                      <option value="">Orgánico / Sin vendedor asignado</option>
                      {manualEmbajadorOptions.length > 0 ? (
                        <>
                          {manualVendedorOptions.length > 0 && (
                            <optgroup label="Vendedores">
                              {manualVendedorOptions.map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Embajadores">
                            {manualEmbajadorOptions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      ) : (
                        manualVendedorOptions.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.label}
                          </option>
                        ))
                      )}
                    </>
                  )}
                </select>
              </div>
              {manualError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="min-w-0 break-words">{manualError}</span>
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => setManualOpen(false)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-[#C88A2B]/45 bg-[#22150E] px-5 py-2 text-xs font-semibold text-[#FAF3E8] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
                >
                  {manualSubmitting ? 'Guardando...' : 'Guardar prospecto'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
