import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
  Download,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  PhoneCall,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import type { GiftItem, Lead, LeadCategory, ReferralPartner } from '../../types/app';
import { GiftIllustration } from '../gifts/GiftIllustration';
import type { KpiFilterKey } from './KpiGrid';

export interface LeadUpdatePayload {
  called?: boolean;
  category?: LeadCategory;
  orderAmount?: number | null;
  notes?: string;
  promoCodeInvalidated?: boolean;
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
  defaultTicketAmount: number;
  activeFilter: KpiFilterKey;
  onFilterChange: (filter: KpiFilterKey) => void;
  onUpdateLead: (id: string, updates: LeadUpdatePayload) => Promise<void>;
  onCreateManualLead: (payload: {
    name: string;
    phone: string;
    address: string;
    giftId: string;
  }) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

const CATEGORY_RANK: Record<LeadCategory, number> = {
  none: 0,
  cita: 1,
  demo: 2,
  orden: 3,
};

const CATEGORY_LABELS: Record<LeadCategory, string> = {
  none: 'Sin clasificar',
  cita: 'Cita',
  demo: 'Demo',
  orden: 'Orden',
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

const FILTER_PILLS: Array<{ key: KpiFilterKey; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'vip', label: '🔥 Buen Crédito (VIP)' },
  { key: 'client', label: 'Es cliente' },
  { key: 'non_client', label: 'No es cliente' },
  { key: 'pending', label: 'Por llamar' },
  { key: 'called', label: 'Ya llamados' },
  { key: 'cita', label: 'Citas' },
  { key: 'demo', label: 'Demos' },
  { key: 'orden', label: 'Órdenes' },
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
  defaultTicketAmount,
  activeFilter,
  onFilterChange,
  onUpdateLead,
  onCreateManualLead,
  onDeleteLead,
  onBusyChange,
}) => {
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [lockedHintId, setLockedHintId] = useState<string | null>(null);
  const [togglingLeadId, setTogglingLeadId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Manual Lead Modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualGiftId, setManualGiftId] = useState(gifts[0]?.id || '');

  // Security Confirmation Modal (assigning / progressing category -> invalidates promo code)
  const [confirmCategoryModal, setConfirmCategoryModal] = useState<{
    lead: Lead;
    targetCategory: Exclude<LeadCategory, 'none'>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Admin Password Modal (reverting category / reactivating promo code / downgrading)
  const [adminRevertModal, setAdminRevertModal] = useState<{
    lead: Lead;
    targetCategory: LeadCategory;
    mode: 'revert' | 'downgrade' | 'unmark_called';
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
      expandedNotesId !== null;
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [
    manualOpen,
    confirmCategoryModal,
    adminRevertModal,
    togglingLeadId,
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

  const resolveLeadReferral = (lead: Lead): { code: string; name: string | null; partnerId: string | null } | null => {
    const rawCode = (lead.referralCode || '').trim().toUpperCase();
    const matchedPartner =
      (lead.referrerId ? referrerById.get(lead.referrerId) : undefined) ||
      (rawCode ? referrerByCode.get(rawCode) : undefined);

    if (matchedPartner) {
      return {
        code: rawCode || matchedPartner.code,
        name: matchedPartner.name,
        partnerId: matchedPartner.id,
      };
    }
    if (rawCode || lead.referrerName) {
      return {
        code: rawCode,
        name: lead.referrerName || null,
        partnerId: lead.referrerId || null,
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

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rawCodeQuery = q.replace(/^#/, '');
    return leads.filter((lead) => {
      if (activeFilter === 'vip' && lead.qualification?.tier !== 'alto') return false;
      if (activeFilter === 'client' && isClientLead(lead) !== true) return false;
      if (activeFilter === 'non_client' && isClientLead(lead) !== false) return false;
      if (activeFilter === 'pending' && lead.called) return false;
      if (activeFilter === 'called' && !lead.called) return false;
      if (activeFilter === 'cita' && lead.category !== 'cita') return false;
      if (activeFilter === 'demo' && lead.category !== 'demo') return false;
      if (activeFilter === 'orden' && lead.category !== 'orden') return false;

      if (originFilter !== 'all') {
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
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.address || '').toLowerCase().includes(q) ||
        claimLower.includes(rawCodeQuery) ||
        claimDigits.includes(rawCodeQuery) ||
        (lead.giftName || '').toLowerCase().includes(q) ||
        (refInfo?.code || '').toLowerCase().includes(q) ||
        (refInfo?.name || '').toLowerCase().includes(q)
      );
    });
  }, [leads, activeFilter, originFilter, search, referrerById, referrerByCode]);

  const handleToggleCalled = async (lead: Lead) => {
    if (togglingLeadId) return;
    setActionError(null);

    const promoLocked = lead.category !== 'none' || isPromoCodeInvalidated(lead);
    if (lead.called && promoLocked) {
      setAdminPassword('');
      setShowAdminPassword(false);
      setAdminError(null);
      setAdminRevertModal({
        lead,
        targetCategory: 'none',
        mode: 'unmark_called',
      });
      return;
    }

    setTogglingLeadId(lead.id);
    try {
      await onUpdateLead(lead.id, { called: !lead.called });
      setLockedHintId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar el estado de llamada.');
    } finally {
      setTogglingLeadId(null);
    }
  };

  const handleCategoryClick = (lead: Lead, cat: Exclude<LeadCategory, 'none'>) => {
    if (!lead.called) {
      setLockedHintId(lead.id);
      window.setTimeout(() => setLockedHintId((cur) => (cur === lead.id ? null : cur)), 2200);
      return;
    }

    setActionError(null);
    const nextCategory: LeadCategory = lead.category === cat ? 'none' : cat;
    const currentRank = CATEGORY_RANK[lead.category];
    const nextRank = CATEGORY_RANK[nextCategory];
    const promoLocked = lead.category !== 'none' || isPromoCodeInvalidated(lead);

    if (nextCategory !== 'none' && (!promoLocked || nextRank > currentRank)) {
      setConfirmError(null);
      setConfirmCategoryModal({ lead, targetCategory: nextCategory });
      return;
    }

    setAdminPassword('');
    setShowAdminPassword(false);
    setAdminError(null);
    setAdminRevertModal({
      lead,
      targetCategory: nextCategory,
      mode: nextCategory === 'none' ? 'revert' : 'downgrade',
    });
  };

  const handleOpenReactivateModal = (lead: Lead) => {
    setActionError(null);
    setAdminPassword('');
    setShowAdminPassword(false);
    setAdminError(null);
    setAdminRevertModal({
      lead,
      targetCategory: 'none',
      mode: 'revert',
    });
  };

  const handleConfirmCategoryAssign = async () => {
    if (!confirmCategoryModal || confirmLoading) return;
    const { lead, targetCategory } = confirmCategoryModal;
    setConfirmError(null);
    setConfirmLoading(true);
    try {
      await onUpdateLead(lead.id, {
        category: targetCategory,
        orderAmount: targetCategory === 'orden' ? lead.orderAmount ?? defaultTicketAmount : null,
        promoCodeInvalidated: true,
      });
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
          orderAmount: null,
          adminPassword,
        });
      } else if (mode === 'downgrade' && targetCategory !== 'none') {
        await onUpdateLead(lead.id, {
          category: targetCategory,
          orderAmount: null,
          adminPassword,
        });
      } else {
        await onUpdateLead(lead.id, {
          category: 'none',
          promoCodeInvalidated: false,
          orderAmount: null,
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
    const raw = amountDraft[lead.id];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setActionError(null);
    try {
      await onUpdateLead(lead.id, { orderAmount: parsed });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar el monto de la orden.');
    }
  };

  const handleSaveNotes = async (lead: Lead) => {
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
      return [
        `"${l.name.replace(/"/g, '""')}"`,
        `"${l.phone}"`,
        `"${(l.address || '').replace(/"/g, '""')}"`,
        `"${(l.giftName || '').replace(/"/g, '""')}"`,
        `"${l.claimCode}"`,
        `"${l.qualification?.tier || ''}"`,
        l.qualification?.score ?? '',
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualName.trim().length < 2 || manualPhone.replace(/\D/g, '').length < 7) return;
    await onCreateManualLead({
      name: manualName.trim(),
      phone: manualPhone.trim(),
      address: manualAddress.trim(),
      giftId: manualGiftId || gifts[0]?.id || '',
    });
    setManualName('');
    setManualPhone('');
    setManualAddress('');
    setManualOpen(false);
  };

  return (
    <section className="rounded-[24px] sm:rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-3.5 sm:p-6 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)]">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 pb-4 sm:pb-5 border-b border-[#EFE3D2]">
        <div className="min-w-0">
          <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#22150E]">
            Prospectos del Show de Cocina
          </h2>
          <p className="text-xs sm:text-sm text-[#7B5D4A] mt-0.5">
            Marca el check de llamada realizada para desbloquear la clasificación en Cita, Demo u Orden.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full bg-[#22150E] px-4 py-2 text-xs font-semibold text-[#FAF3E8] hover:bg-[#3A2418] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Agregar prospecto
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FAF3E8] px-4 py-2 text-xs font-semibold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer shrink-0"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            CSV
          </button>
        </div>
      </div>

      {/* Search, Origin Dropdown & Filter Chips */}
      <div className="mt-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 md:max-w-md min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9B816E]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, Nº de orden, embajador o regalo..."
              className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] py-2.5 pl-10 pr-4 text-base sm:text-sm text-[#22150E] placeholder:text-[#9D8370] focus:border-[#B84A27] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <QrCode className="h-4 w-4 text-[#C88A2B] shrink-0" />
            <label
              htmlFor="prospects-origin-filter"
              className="text-xs font-semibold text-[#6E5341] whitespace-nowrap"
            >
              Origen QR:
            </label>
            <select
              id="prospects-origin-filter"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="min-h-[44px] max-w-full sm:max-w-[260px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-xs font-semibold text-[#22150E] focus:border-[#C88A2B] focus:bg-white focus:outline-none"
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
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible max-w-full">
          {FILTER_PILLS.map((pill) => {
            const active = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => onFilterChange(pill.key)}
                className={`shrink-0 whitespace-nowrap min-h-[44px] sm:min-h-[34px] rounded-full px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#B84A27] text-white shadow-sm'
                    : 'bg-[#FAF3E8] text-[#6E5341] hover:bg-[#F0E1CC]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
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
      <div className="mt-5 space-y-3">
        {filteredLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DFCBB3] bg-[#FAF3E8]/40 py-12 text-center">
            <p className="font-serif text-lg font-semibold text-[#594133]">Sin prospectos en esta vista</p>
            <p className="mt-1 text-xs text-[#8B6F5B]">
              Cuando alguien complete el formulario público aparecerá automáticamente aquí.
            </p>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const matchedGift = gifts.find((g) => g.id === lead.giftId);
            const referralSource = resolveLeadReferral(lead);
            const showLockHint = lockedHintId === lead.id;
            const notesOpen = expandedNotesId === lead.id;
            const promoInvalidated = isPromoCodeInvalidated(lead);
            const isTogglingThis = togglingLeadId === lead.id;
            const cleanTel = lead.phone.replace(/[^\d+]/g, '');
            const whatsappUrl = `https://wa.me/${cleanTel.replace(/^\+/, '')}?text=${encodeURIComponent(
              `Hola ${lead.name}, te saludo de Royal Prestige / Show de Cocina respecto a tu obsequio "${lead.giftName || 'regalo de otoño'}" (Número de orden ${lead.claimCode}).`
            )}`;

            return (
              <div
                key={lead.id}
                className={`rounded-2xl border p-3.5 sm:p-4 transition-colors ${
                  lead.called
                    ? 'border-[#DFCBB3] bg-white'
                    : 'border-amber-300/90 bg-gradient-to-r from-[#FFFDF7] to-[#FEF7E8]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
                  {/* Left: Person & Revealed Gift */}
                  <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#FAF3E8] border border-[#E6D5BF]">
                      <GiftIllustration
                        visualKey={matchedGift?.visualKey || lead.giftVisualKey || 'cutlery'}
                        customImageUrl={matchedGift?.customImageUrl}
                        accentColor={matchedGift?.accentColor || '#C88A2B'}
                        size={32}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h3 className="text-[15px] font-bold text-[#22150E] break-words">{lead.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
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
                          Orden {lead.claimCode}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            promoInvalidated
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          {promoInvalidated ? (
                            <>
                              <Lock className="h-2.5 w-2.5 shrink-0" />
                              Código invalidado
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-2.5 w-2.5 shrink-0" />
                              Código válido
                            </>
                          )}
                        </span>
                        {!lead.called && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            Nuevo
                          </span>
                        )}
                        {referralSource && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-[#E5C17B] bg-[#FFF4DC] px-2.5 py-0.5 text-[10.5px] font-bold text-[#7A4610]"
                            title={`Referido por ${referralSource.name || referralSource.code}`}
                          >
                            <QrCode className="h-3 w-3 shrink-0 text-[#C88A2B]" />
                            <span>
                              QR · {referralSource.name ? `${referralSource.name}` : referralSource.code}
                              {referralSource.name && referralSource.code ? ` (${referralSource.code})` : ''}
                            </span>
                          </span>
                        )}
                        {lead.qualification && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide border ${
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

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#6E5341]">
                        <span className="font-mono tabular-nums font-medium text-[#22150E]">{lead.phone}</span>
                        <span className="text-[#C8B29A]">·</span>
                        <span className="font-semibold text-[#8C3318]">
                          Regalo: {lead.giftName || 'Pendiente por destapar'}
                        </span>
                        <span className="text-[#C8B29A]">·</span>
                        <span>{formatRelativeOrDate(lead.createdAt)}</span>
                      </div>

                      {lead.address && (
                        <div className="mt-1 flex items-start gap-1.5 text-xs text-[#5C4332] min-w-0">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9E4725] mt-0.5" />
                          <span className="break-words min-w-0">{lead.address}</span>
                        </div>
                      )}

                      {lead.qualification && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {isClientLead(lead) !== null && (
                            <span
                              className={`rounded-lg border px-2 py-0.5 font-semibold ${
                                isClientLead(lead)
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-amber-50 border-amber-200 text-amber-900'
                              }`}
                            >
                              {isClientLead(lead) ? 'Es cliente' : 'No es cliente'}
                            </span>
                          )}
                          <span className="rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                            {lead.qualification.creditProfile}
                          </span>
                          <span className="rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                            {lead.qualification.housingStatus}
                          </span>
                          <span className="rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                            {lead.qualification.investmentPriority}
                          </span>
                        </div>
                      )}

                      {/* Quick contact, notes & revert bar */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`tel:${cleanTel}`}
                          className="inline-flex min-h-[44px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-[#E6D5BF] bg-[#FAF3E8]/70 px-3 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-semibold text-[#4E382B] hover:bg-[#F3E4CE] transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-[#B84A27]" />
                          Llamar
                        </a>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-emerald-200 bg-emerald-50 px-3 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                          WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedNotesId(notesOpen ? null : lead.id);
                            setNotesDraft((prev) => ({ ...prev, [lead.id]: lead.notes }));
                          }}
                          className="inline-flex min-h-[44px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-[#E6D5BF] bg-white px-3 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-semibold text-[#6E5341] hover:bg-[#FAF3E8] transition-colors cursor-pointer"
                        >
                          <StickyNote className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                          {lead.notes ? 'Ver nota' : 'Nota'}
                        </button>

                        {(lead.category !== 'none' || promoInvalidated) && (
                          <button
                            type="button"
                            onClick={() => handleOpenReactivateModal(lead)}
                            className="inline-flex min-h-[44px] sm:min-h-[32px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-amber-300 bg-amber-50 px-3 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-[#B84A27]" />
                            Revertir / Reactivar código
                          </button>
                        )}

                        {confirmDeleteId === lead.id ? (
                          <span className="inline-flex min-h-[44px] sm:min-h-[32px] items-center gap-2 rounded-xl sm:rounded-lg bg-red-50 border border-red-200 px-3 py-1 text-xs sm:text-[11px]">
                            <button
                              type="button"
                              onClick={() => onDeleteLead(lead.id)}
                              className="min-h-[36px] sm:min-h-0 font-bold text-red-700 hover:underline cursor-pointer"
                            >
                              Confirmar eliminar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[36px] sm:min-h-0 text-[#6E5341] hover:text-[#22150E] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(lead.id)}
                            className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] items-center justify-center rounded-xl sm:rounded-lg p-2 sm:p-1 text-[#A48A77] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                            title="Eliminar prospecto"
                            aria-label={`Eliminar a ${lead.name}`}
                          >
                            <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Called Check + 3 Categories Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0 w-full lg:w-auto">
                    {/* Check "Ya se llamó" */}
                    <button
                      type="button"
                      disabled={isTogglingThis}
                      onClick={() => handleToggleCalled(lead)}
                      className={`inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold border transition-all cursor-pointer disabled:opacity-65 ${
                        showLockHint ? 'ring-4 ring-[#B84A27]/30' : ''
                      } ${
                        lead.called
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-[#FAF3E8] border-[#D8B994] text-[#594133] hover:bg-amber-100/70'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          lead.called
                            ? 'border-white bg-white/20 text-white'
                            : 'border-[#B89D86] bg-white'
                        }`}
                      >
                        {lead.called && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>
                        {isTogglingThis
                          ? 'Guardando...'
                          : lead.called
                            ? 'Ya se llamó'
                            : 'Marcar llamado'}
                      </span>
                    </button>

                    {/* 3 Categories Segmented Control */}
                    <div className="relative w-full sm:w-auto">
                      <div
                        className={`grid grid-cols-3 w-full sm:w-auto sm:inline-flex items-center rounded-xl p-1 border transition-opacity ${
                          lead.called
                            ? 'bg-[#FAF3E8] border-[#E3D0B8]'
                            : 'bg-stone-100 border-stone-200 opacity-60'
                        }`}
                      >
                        {CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          const isSelected = lead.category === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleCategoryClick(lead, cat.id)}
                              title={
                                lead.called
                                  ? `Asignar a ${cat.label}`
                                  : 'Marca primero el check de llamada para clasificar'
                              }
                              className={`relative inline-flex min-h-[44px] sm:min-h-[34px] items-center justify-center gap-1 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                                isSelected
                                  ? cat.activeClass
                                  : 'text-[#594133] hover:bg-white/70'
                              }`}
                            >
                              {!lead.called ? (
                                <Lock className="h-3 w-3 opacity-70 shrink-0" />
                              ) : (
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span>{cat.label}</span>
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
                            Primero marca el check “Ya se llamó”
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Order amount editor when category === 'orden' */}
                {lead.category === 'orden' && (
                  <div className="mt-3 pt-3 border-t border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-emerald-50/50 rounded-xl px-3 py-2.5">
                    <span className="text-xs font-semibold text-emerald-900">
                      Monto de la orden (actualiza Ticket Promedio):
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-sm sm:text-xs font-bold text-emerald-800">$</span>
                      <input
                        type="number"
                        min={0}
                        value={amountDraft[lead.id] ?? String(lead.orderAmount ?? defaultTicketAmount)}
                        onChange={(e) =>
                          setAmountDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
                        }
                        className="flex-1 sm:flex-none sm:w-28 min-h-[44px] sm:min-h-[34px] rounded-xl sm:rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-base sm:text-xs font-mono font-bold text-[#22150E] tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveOrderAmount(lead)}
                        className="min-h-[44px] sm:min-h-[34px] rounded-xl sm:rounded-lg bg-emerald-700 px-4 sm:px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer shrink-0"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

                {/* Expandable Notes */}
                <AnimatePresence>
                  {notesOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-[#EFE3D2] flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={notesDraft[lead.id] ?? ''}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
                          }
                          placeholder="Escribe notas de la llamada, dirección o fecha de cita..."
                          className="flex-1 min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-xs text-[#22150E] focus:bg-white focus:border-[#B84A27] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(lead)}
                          className="min-h-[44px] rounded-xl bg-[#22150E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A2418] cursor-pointer shrink-0"
                        >
                          Guardar nota
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

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
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[24px] sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 border border-amber-300 text-[#8C3318]">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#B84A27] block">
                      Confirmación de Seguridad
                    </span>
                    <h3 id="confirm-category-title" className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">
                      ¿Asignar a {CATEGORY_LABELS[confirmCategoryModal.targetCategory]}?
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => setConfirmCategoryModal(null)}
                  aria-label="Cerrar confirmación"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#7B5D4A] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-[#E6D5BF] bg-[#FAF3E8]/75 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6E5341]">Prospecto:</span>
                  <strong className="text-[#22150E] text-right">{confirmCategoryModal.lead.name}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6E5341]">Número de orden / cupón:</span>
                  <span className="rounded-md bg-white border border-[#E6C99E] px-2 py-0.5 font-mono font-bold text-[#8C4A19]">
                    {confirmCategoryModal.lead.claimCode}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6E5341]">Nueva clasificación:</span>
                  <strong className="text-[#8C3318]">
                    {CATEGORY_LABELS[confirmCategoryModal.targetCategory]}
                  </strong>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  Advertencia de invalidación de código
                </p>
                <p className="leading-relaxed">
                  Al confirmar, el código de promoción{' '}
                  <strong className="font-mono">{confirmCategoryModal.lead.claimCode}</strong> quedará{' '}
                  <strong>invalidado permanentemente</strong> para evitar duplicados o re-canjes.
                </p>
                <p className="leading-relaxed">
                  Revertir esta clasificación o reactivar el código{' '}
                  <strong>solo será posible con la contraseña de Administrador</strong>.
                </p>
              </div>

              {confirmError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{confirmError}</span>
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
                  className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#22150E] to-[#8C3318] px-5 py-2 text-xs font-bold text-[#FFFDF9] shadow hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {confirmLoading
                    ? 'Confirmando...'
                    : `Confirmar ${CATEGORY_LABELS[confirmCategoryModal.targetCategory]} e invalidar`}
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
              className="relative w-full max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-[24px] sm:rounded-[28px] border border-[#C88A2B]/55 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-5 sm:p-6 text-[#FFFDF9] shadow-[0_32px_80px_-14px_rgba(0,0,0,0.85)] space-y-4"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-[#F4CA73]/40 bg-[#F4CA73]/15 text-[#F4CA73]">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F4CA73] block">
                      Autorización de Administrador
                    </span>
                    <h3 id="admin-revert-title" className="font-serif text-lg sm:text-xl font-bold text-white leading-snug">
                      {adminRevertModal.mode === 'downgrade'
                        ? `Cambiar a ${CATEGORY_LABELS[adminRevertModal.targetCategory]}`
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

              <div className="rounded-2xl border border-[#F4CA73]/25 bg-white/[0.04] p-3.5 text-xs space-y-1.5 text-[#E8D5BE]">
                <div className="flex items-center justify-between gap-2">
                  <span>Prospecto:</span>
                  <strong className="text-white text-right">{adminRevertModal.lead.name}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Número de orden:</span>
                  <span className="font-mono font-bold text-[#F4CA73]">
                    {adminRevertModal.lead.claimCode}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Acción:</span>
                  <strong className="text-white text-right">
                    {adminRevertModal.mode === 'unmark_called'
                      ? 'Quitar llamado, clasificación y reactivar código'
                      : adminRevertModal.mode === 'downgrade'
                        ? `Cambiar de ${CATEGORY_LABELS[adminRevertModal.lead.category]} a ${CATEGORY_LABELS[adminRevertModal.targetCategory]}`
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
                  <span>{adminError}</span>
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
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {adminLoading ? 'Verificando...' : 'Autorizar cambio'}
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
            onClick={() => setManualOpen(false)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleManualSubmit}
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">Nuevo prospecto manual</h3>
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  aria-label="Cerrar modal"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-1 text-[#7B5D4A] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>
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
              <div>
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
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Dirección</label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Ej. Av. Reforma 120, Col. Centro"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Regalo asignado</label>
                <select
                  value={manualGiftId || gifts[0]?.id || ''}
                  onChange={(e) => setManualGiftId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                >
                  {gifts.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] w-full sm:w-auto rounded-full bg-[#22150E] px-5 py-2 text-xs font-semibold text-[#FAF3E8] hover:bg-[#3A2418] cursor-pointer"
                >
                  Guardar prospecto
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
