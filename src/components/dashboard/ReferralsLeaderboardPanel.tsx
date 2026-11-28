import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crown,
  Download,
  Edit3,
  Eye,
  Filter,
  Link2,
  Medal,
  MessageCircle,
  Phone,
  Power,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  Lead,
  QrCodeRecord,
  QrStyleId,
  ReferralMetricKey,
  ReferralPartner,
  ReferralPrizeRule,
  ReferralVisitEvent,
  UserAccount,
  UserRole,
} from '../../types/app';
import type {
  UpdateReferralPayload,
} from '../../services/storeClient';
import {
  buildReferralUrl,
  buildWhatsAppShareUrl,
  downloadReferralQrPng,
  generateReferralQrDataUrl,
  normalizeReferralCodeInput,
  REFERRAL_QR_THEMES,
  sanitizeReferralCodeDraft,
} from './referralQrExport';
import { SecretKeyModal } from './SecretKeyModal';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { AvatarPickerField } from './AvatarPickerField';
import { validateAvatarUrlInput } from '../../utils/avatarImageUtils';
import { getRoleTheme } from './roleTheme';
import {
  computeEmbajadorMetrics,
  computeVendedorRollupMetrics,
  normalizePartnerCode,
  resolveEmbajadorOwner,
  type EmbajadorRollupMetrics,
  type ResolvedOwnerInfo,
  type VendedorRollupMetrics,
} from '../../utils/partnerMetrics';

export const DEFAULT_PRIZE_RULE: ReferralPrizeRule = {
  prizeName: 'Premio Embajador Royal Prestige',
  metric: 'leads',
  targetCount: 5,
  maxWinners: 3,
  pointsPerLead: 1,
  pointsPerCita: 3,
  pointsPerDemo: 5,
  pointsPerOrden: 10,
};

interface ReferralsLeaderboardPanelProps {
  referrers: ReferralPartner[];
  leads: Lead[];
  visitLog?: ReferralVisitEvent[];
  accounts?: UserAccount[];
  qrHistory?: QrCodeRecord[];
  isDateFiltered?: boolean;
  settings: AppSettings;
  defaultOriginUrl: string;
  userRole?: UserRole;
  onUpdatePartner: (id: string, updates: UpdateReferralPayload, masterPassword: string) => Promise<void>;
  onDeletePartner: (id: string, masterPassword: string) => Promise<void>;
  onSavePrizeRule: (rule: ReferralPrizeRule, masterPassword: string) => Promise<void>;
  onGoToAccounts?: () => void;
  onBusyChange?: (busy: boolean) => void;
}

type PartnerScopeFilter = 'vendedores' | 'embajadores';
type FilterMode = 'all' | 'winning' | 'active_activity' | 'no_leads' | 'inactive';
type SortMode =
  | 'prize_rank'
  | 'leads'
  | 'visits'
  | 'conversion'
  | 'points'
  | 'sales'
  | 'name';

interface PartnerMetricsRow {
  partner: ReferralPartner;
  rank: number;
  isEmbajador: boolean;
  owner: ResolvedOwnerInfo | null;
  qrCount: number;
  directQrCount: number;
  embajadoresQrCount: number;
  embajadoresCount: number;
  directLeadsCount: number;
  embajadoresLeadsCount: number;
  vendedorRollup: VendedorRollupMetrics | null;
  embajadorRollup: EmbajadorRollupMetrics | null;
  leads: Lead[];
  leadsCount: number;
  visits: number;
  uniqueVisits: number;
  conversionPct: number;
  citasCount: number;
  demosCount: number;
  ordenesCount: number;
  salesTotal: number;
  points: number;
  metricValue: number;
  progressPct: number;
  reachedTarget: boolean;
  isWinning: boolean;
  prizeStatusLabel: string;
}

function findLeadEmbajadorSource(
  lead: Lead,
  breakdown?: EmbajadorRollupMetrics[]
): ReferralPartner | null {
  if (!breakdown || breakdown.length === 0) return null;
  const leadCode = normalizePartnerCode(lead.referralCode);
  for (const item of breakdown) {
    if (lead.referrerId && lead.referrerId === item.embajador.id) {
      return item.embajador;
    }
    const embCode = normalizePartnerCode(item.embajador.code);
    if (leadCode && embCode && leadCode === embCode) {
      return item.embajador;
    }
  }
  return null;
}

function formatOwnerLabel(owner: ResolvedOwnerInfo | null): string {
  if (!owner || owner.isDirect) return 'Ciprian Directo';
  return owner.tag ? `${owner.name} (${owner.tag})` : owner.name;
}

const METRIC_LABELS: Record<ReferralMetricKey, { short: string; label: string; unit: string }> = {
  leads: { short: 'Registros', label: 'Registros (Leads)', unit: 'registros' },
  citas: { short: 'Citas', label: 'Citas agendadas', unit: 'citas' },
  demos: { short: 'Demos', label: 'Demos realizadas', unit: 'demos' },
  ordenes: { short: 'Órdenes', label: 'Órdenes cerradas', unit: 'órdenes' },
  points: { short: 'Puntaje', label: 'Puntaje ponderado', unit: 'pts' },
};

const QR_STYLE_OPTIONS: Array<{ id: QrStyleId; label: string }> = [
  { id: 'classic-gold', label: 'Dorado Ciprian' },
  { id: 'obsidian-dots', label: 'Obsidiana & Oro' },
  { id: 'ivory-rounded', label: 'Marfil Minimal' },
  { id: 'emerald-heritage', label: 'Esmeralda Royal' },
  { id: 'ruby-atelier', label: 'Borgoña Otoño' },
];

const CATEGORY_BADGE_MAP: Record<string, { label: string; className: string }> = {
  none: { label: 'Prospecto', className: 'bg-stone-100 text-stone-700 border-stone-200' },
  cita: { label: 'Cita', className: 'bg-rose-50 text-rose-800 border-rose-200' },
  demo: { label: 'Demo', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  orden: { label: 'Orden', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

function sanitizePrizeRule(raw?: Partial<ReferralPrizeRule> | null): ReferralPrizeRule {
  const validMetrics: ReferralMetricKey[] = ['leads', 'citas', 'demos', 'ordenes', 'points'];
  const metric = raw?.metric && validMetrics.includes(raw.metric) ? raw.metric : DEFAULT_PRIZE_RULE.metric;
  const toNonNegInt = (val: unknown, fallback: number, min = 0) => {
    const n = Number(val);
    return Number.isFinite(n) ? Math.max(min, Math.round(n)) : fallback;
  };
  return {
    prizeName:
      typeof raw?.prizeName === 'string' && raw.prizeName.trim().length > 0
        ? raw.prizeName.trim()
        : DEFAULT_PRIZE_RULE.prizeName,
    metric,
    targetCount: toNonNegInt(raw?.targetCount, DEFAULT_PRIZE_RULE.targetCount, 1),
    maxWinners: toNonNegInt(raw?.maxWinners, DEFAULT_PRIZE_RULE.maxWinners, 0),
    pointsPerLead: toNonNegInt(raw?.pointsPerLead, DEFAULT_PRIZE_RULE.pointsPerLead, 0),
    pointsPerCita: toNonNegInt(raw?.pointsPerCita, DEFAULT_PRIZE_RULE.pointsPerCita, 0),
    pointsPerDemo: toNonNegInt(raw?.pointsPerDemo, DEFAULT_PRIZE_RULE.pointsPerDemo, 0),
    pointsPerOrden: toNonNegInt(raw?.pointsPerOrden, DEFAULT_PRIZE_RULE.pointsPerOrden, 0),
  };
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = str.replace(/"/g, '""');
  return `"${safe}"`;
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const ReferralsLeaderboardPanel: React.FC<ReferralsLeaderboardPanelProps> = ({
  referrers,
  leads,
  visitLog,
  accounts = [],
  qrHistory = [],
  isDateFiltered = false,
  settings,
  defaultOriginUrl,
  userRole = 'admin',
  onUpdatePartner,
  onDeletePartner,
  onSavePrizeRule,
  onGoToAccounts,
  onBusyChange,
}) => {
  const isAiManager = userRole === 'ai_manager';
  const [activeSubTab, setActiveSubTab] = useState<'ranking' | 'rules'>('ranking');
  const [currentPage, setCurrentPage] = useState(1);
  const RANKING_PAGE_SIZE = 10;

  const prizeRule = useMemo(
    () => sanitizePrizeRule(settings.referralPrizeRule),
    [settings.referralPrizeRule]
  );

  // Prize Rule editor state
  const [ruleDraft, setRuleDraft] = useState<ReferralPrizeRule>(prizeRule);
  const [savingRule, setSavingRule] = useState(false);

  // Sync draft when server settings update and not on rules tab
  useEffect(() => {
    if (activeSubTab !== 'rules') {
      setRuleDraft(prizeRule);
    }
  }, [prizeRule, activeSubTab]);

  // Edit Partner Modal
  const [editingPartner, setEditingPartner] = useState<ReferralPartner | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editStyleId, setEditStyleId] = useState<QrStyleId>('classic-gold');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingVisitsId, setResettingVisitsId] = useState<string | null>(null);

  // Secret Key Authorization Modal for all protected mutations
  const [pendingSecretAction, setPendingSecretAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: (masterPassword: string) => Promise<void>;
  } | null>(null);

  // QR Card HD Modal
  const [qrModalPartner, setQrModalPartner] = useState<ReferralPartner | null>(null);
  const [qrModalStyle, setQrModalStyle] = useState<QrStyleId>('classic-gold');
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string | null>(null);
  const [qrPreviewLoading, setQrPreviewLoading] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  // List filters / UI state
  const [search, setSearch] = useState('');
  const [partnerScope, setPartnerScope] = useState<PartnerScopeFilter>('vendedores');
  const [vendedorOwnerFilter, setVendedorOwnerFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('prize_rank');
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyPartnerId, setBusyPartnerId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inform parent DashboardPage to pause polling while modals/forms are open
  useEffect(() => {
    const isBusy =
      Boolean(editingPartner) ||
      Boolean(qrModalPartner) ||
      Boolean(pendingSecretAction) ||
      activeSubTab === 'rules' ||
      savingRule ||
      savingEdit;
    onBusyChange?.(isBusy);
    return () => onBusyChange?.(false);
  }, [
    editingPartner,
    qrModalPartner,
    pendingSecretAction,
    activeSubTab,
    savingRule,
    savingEdit,
    onBusyChange,
  ]);

  // Render live HD QR card preview when QR modal opens or style changes
  useEffect(() => {
    if (!qrModalPartner) {
      setQrPreviewDataUrl(null);
      return;
    }
    let cancelled = false;
    setQrPreviewLoading(true);
    const url = buildReferralUrl(defaultOriginUrl, qrModalPartner.code);
    generateReferralQrDataUrl({
      partnerName: qrModalPartner.name,
      code: qrModalPartner.code,
      referralUrl: url,
      avatarUrl: qrModalPartner.avatarUrl ?? null,
      emoji: qrModalPartner.emoji ?? null,
      styleId: qrModalStyle,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrPreviewDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrPreviewDataUrl(null);
      })
      .finally(() => {
        if (!cancelled) setQrPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qrModalPartner, qrModalStyle, defaultOriginUrl]);

  const scopeCounts = useMemo(() => {
    let vendedores = 0;
    let embajadores = 0;
    for (const r of referrers) {
      if (r.partnerType === 'embajador') embajadores += 1;
      else vendedores += 1;
    }
    return { vendedores, embajadores };
  }, [referrers]);

  const vendedorFilterOptions = useMemo(() => {
    const options: Array<{
      value: string;
      label: string;
      accountId: string | null;
      tagNorm: string;
    }> = [];
    const seenKeys = new Set<string>();

    const addOption = (
      name: string,
      tag: string | null | undefined,
      accountId: string | null | undefined
    ) => {
      const cleanName = name.trim();
      const tagNorm = normalizePartnerCode(tag);
      const accId = accountId || null;
      if (!cleanName && !tagNorm && !accId) return;
      const dedupeKey = accId ? `acc:${accId}` : `tag:${tagNorm || cleanName.toUpperCase()}`;
      if (seenKeys.has(dedupeKey)) return;
      seenKeys.add(dedupeKey);
      if (tagNorm) seenKeys.add(`tag:${tagNorm}`);
      options.push({
        value: dedupeKey,
        label: tagNorm ? `${cleanName || tagNorm} (${tagNorm})` : cleanName,
        accountId: accId,
        tagNorm,
      });
    };

    for (const acc of accounts) {
      if (acc.role === 'vendedor') {
        addOption(acc.displayName, acc.tag, acc.id);
      }
    }

    for (const r of referrers) {
      if (r.partnerType !== 'embajador') {
        addOption(r.name, r.code, r.accountId);
      }
    }

    for (const r of referrers) {
      if (r.partnerType === 'embajador') {
        const owner = resolveEmbajadorOwner(r, accounts, referrers);
        if (!owner.isDirect) {
          addOption(owner.name, owner.tag, owner.accountId);
        }
      }
    }

    options.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    return options;
  }, [accounts, referrers]);

  // Compute live metrics + official prize ranking (Vendedores roll up direct + all linked Embajadores)
  const rankedRows = useMemo<PartnerMetricsRow[]>(() => {
    const accountById = new Map<string, UserAccount>();
    const accountByTag = new Map<string, UserAccount>();
    for (const acc of accounts) {
      accountById.set(acc.id, acc);
      const norm = normalizePartnerCode(acc.tag);
      if (norm) accountByTag.set(norm, acc);
    }

    const selectedVendedorOpt =
      partnerScope === 'embajadores' && vendedorOwnerFilter !== 'all' && vendedorOwnerFilter !== 'direct'
        ? vendedorFilterOptions.find((opt) => opt.value === vendedorOwnerFilter) || null
        : null;

    const scopedReferrers = referrers.filter((partner) => {
      if (partnerScope === 'vendedores') return partner.partnerType !== 'embajador';
      if (partner.partnerType !== 'embajador') return false;
      if (vendedorOwnerFilter === 'all') return true;
      const owner = resolveEmbajadorOwner(partner, accounts, referrers);
      if (vendedorOwnerFilter === 'direct') return owner.isDirect;
      if (!selectedVendedorOpt || owner.isDirect) return false;
      if (selectedVendedorOpt.accountId && owner.accountId === selectedVendedorOpt.accountId) {
        return true;
      }
      if (
        selectedVendedorOpt.tagNorm &&
        owner.tag &&
        normalizePartnerCode(owner.tag) === selectedVendedorOpt.tagNorm
      ) {
        return true;
      }
      return false;
    });

    const base = scopedReferrers.map((partner) => {
      const isEmbajador = partner.partnerType === 'embajador';

      let matchedLeads: Lead[] = [];
      let leadsCount = 0;
      let citasCount = 0;
      let demosCount = 0;
      let ordenesCount = 0;
      let salesTotal = 0;
      let visits = 0;
      let uniqueVisits = 0;
      let qrCount = 0;
      let directQrCount = 0;
      let embajadoresQrCount = 0;
      let embajadoresCount = 0;
      let directLeadsCount = 0;
      let embajadoresLeadsCount = 0;
      let owner: ResolvedOwnerInfo | null = null;
      let vendedorRollup: VendedorRollupMetrics | null = null;
      let embajadorRollup: EmbajadorRollupMetrics | null = null;

      if (isEmbajador) {
        const embMetrics = computeEmbajadorMetrics(
          partner,
          leads,
          qrHistory,
          visitLog,
          isDateFiltered,
          accounts,
          referrers,
          settings.defaultTicketAmount
        );
        embajadorRollup = embMetrics;
        owner = embMetrics.owner;
        matchedLeads = embMetrics.leads;
        leadsCount = embMetrics.leadsCount;
        citasCount = embMetrics.citasCount;
        demosCount = embMetrics.demosCount;
        ordenesCount = embMetrics.ordenesCount;
        salesTotal = embMetrics.salesTotal;
        visits = embMetrics.visitsCount;
        uniqueVisits = embMetrics.uniqueVisitsCount;
        qrCount = embMetrics.qrCount;
        directQrCount = embMetrics.qrCount;
        directLeadsCount = embMetrics.leadsCount;
      } else {
        const normCode = normalizePartnerCode(partner.code);
        const matchedAccount =
          (partner.accountId ? accountById.get(partner.accountId) : undefined) ||
          (normCode ? accountByTag.get(normCode) : undefined) ||
          null;

        const rollup = computeVendedorRollupMetrics(
          {
            accountId: partner.accountId ?? matchedAccount?.id ?? null,
            partnerId: partner.id,
            name: partner.name,
            tag: partner.code,
            avatarUrl: partner.avatarUrl ?? matchedAccount?.avatarUrl ?? null,
            active: partner.active,
            partner,
          },
          referrers,
          leads,
          qrHistory,
          visitLog,
          isDateFiltered,
          accounts,
          settings.defaultTicketAmount
        );
        vendedorRollup = rollup;
        matchedLeads = rollup.leads;
        leadsCount = rollup.totalLeadsCount;
        citasCount = rollup.citasCount;
        demosCount = rollup.demosCount;
        ordenesCount = rollup.ordenesCount;
        salesTotal = rollup.salesTotal;
        visits = rollup.visitsCount;
        uniqueVisits = rollup.uniqueVisitsCount;
        qrCount = rollup.totalQrCount;
        directQrCount = rollup.directQrCount;
        embajadoresQrCount = rollup.embajadoresQrCount;
        embajadoresCount = rollup.embajadoresCount;
        directLeadsCount = rollup.directLeadsCount;
        embajadoresLeadsCount = rollup.embajadoresLeadsCount;
      }

      const points =
        leadsCount * prizeRule.pointsPerLead +
        citasCount * prizeRule.pointsPerCita +
        demosCount * prizeRule.pointsPerDemo +
        ordenesCount * prizeRule.pointsPerOrden;

      const conversionPct =
        visits > 0 ? Math.round((leadsCount / visits) * 1000) / 10 : 0;

      let metricValue = leadsCount;
      if (prizeRule.metric === 'citas') metricValue = citasCount;
      else if (prizeRule.metric === 'demos') metricValue = demosCount;
      else if (prizeRule.metric === 'ordenes') metricValue = ordenesCount;
      else if (prizeRule.metric === 'points') metricValue = points;

      const target = Math.max(1, prizeRule.targetCount);
      const progressPct = Math.min(100, Math.round((metricValue / target) * 100));
      const reachedTarget = metricValue >= target;

      return {
        partner,
        rank: 0,
        isEmbajador,
        owner,
        qrCount,
        directQrCount,
        embajadoresQrCount,
        embajadoresCount,
        directLeadsCount,
        embajadoresLeadsCount,
        vendedorRollup,
        embajadorRollup,
        leads: matchedLeads,
        leadsCount,
        visits,
        uniqueVisits,
        conversionPct,
        citasCount,
        demosCount,
        ordenesCount,
        salesTotal,
        points,
        metricValue,
        progressPct,
        reachedTarget,
        isWinning: false,
        prizeStatusLabel: '',
      };
    });

    // Official ranking order
    base.sort((a, b) => {
      if (b.metricValue !== a.metricValue) return b.metricValue - a.metricValue;
      if (b.points !== a.points) return b.points - a.points;
      if (b.leadsCount !== a.leadsCount) return b.leadsCount - a.leadsCount;
      if (b.salesTotal !== a.salesTotal) return b.salesTotal - a.salesTotal;
      if (b.visits !== a.visits) return b.visits - a.visits;
      return a.partner.name.localeCompare(b.partner.name, 'es');
    });

    let winnersAssigned = 0;
    const maxW = prizeRule.maxWinners;

    return base.map((row, idx) => {
      const rank = idx + 1;
      let isWinning = false;
      let prizeStatusLabel = `En progreso (${row.metricValue} / ${prizeRule.targetCount})`;

      if (row.reachedTarget && row.metricValue > 0) {
        if (maxW === 0 || winnersAssigned < maxW) {
          isWinning = true;
          winnersAssigned += 1;
          prizeStatusLabel = 'GANANDO';
        } else {
          prizeStatusLabel = 'Meta cumplida (en espera)';
        }
      }

      return {
        ...row,
        rank,
        isWinning,
        prizeStatusLabel,
      };
    });
  }, [
    referrers,
    leads,
    visitLog,
    accounts,
    qrHistory,
    isDateFiltered,
    partnerScope,
    vendedorOwnerFilter,
    vendedorFilterOptions,
    prizeRule,
  ]);

  // Global KPI aggregates (deduplicated: never double-count Embajadores already rolled up inside a Vendedor row)
  const kpis = useMemo(() => {
    const totalPartners = rankedRows.length;
    const activePartners = rankedRows.filter((r) => r.partner.active).length;

    const rolledUpEmbajadorIds = new Set<string>();
    for (const row of rankedRows) {
      if (!row.isEmbajador && row.vendedorRollup) {
        for (const emb of row.vendedorRollup.embajadores) {
          rolledUpEmbajadorIds.add(emb.id);
        }
      }
    }

    let totalVisits = 0;
    let totalUniqueVisits = 0;
    for (const row of rankedRows) {
      if (row.isEmbajador && rolledUpEmbajadorIds.has(row.partner.id)) {
        continue;
      }
      totalVisits += row.visits;
      totalUniqueVisits += row.uniqueVisits;
    }

    // Count unique attributed leads across visible scope
    const attributedLeadIds = new Set<string>();
    const attributedLeads: Lead[] = [];
    for (const row of rankedRows) {
      for (const lead of row.leads) {
        if (!attributedLeadIds.has(lead.id)) {
          attributedLeadIds.add(lead.id);
          attributedLeads.push(lead);
        }
      }
    }

    const totalLeads = attributedLeads.length;
    const conversionPct =
      totalVisits > 0 ? Math.round((totalLeads / totalVisits) * 1000) / 10 : 0;
    const citas = attributedLeads.filter((l) => l.category === 'cita').length;
    const demos = attributedLeads.filter((l) => l.category === 'demo').length;
    const ordenes = attributedLeads.filter((l) => l.category === 'orden').length;
    const salesTotal = attributedLeads
      .filter((l) => l.category === 'orden')
      .reduce(
        (acc, l) =>
          acc +
          (typeof l.orderAmount === 'number' && Number.isFinite(l.orderAmount) && l.orderAmount > 0
            ? l.orderAmount
            : 0),
        0
      );
    const winnersCount = rankedRows.filter((r) => r.isWinning).length;
    const reachedTargetCount = rankedRows.filter((r) => r.reachedTarget).length;

    return {
      totalPartners,
      activePartners,
      totalVisits,
      totalUniqueVisits,
      totalLeads,
      conversionPct,
      citas,
      demos,
      ordenes,
      salesTotal,
      winnersCount,
      reachedTargetCount,
    };
  }, [rankedRows]);

  const podiumRows = useMemo(() => rankedRows.slice(0, 3), [rankedRows]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rankedRows.filter((row) => {
      if (filterMode === 'winning' && !row.isWinning && !row.reachedTarget) return false;
      if (filterMode === 'active_activity' && row.visits === 0 && row.leadsCount === 0) return false;
      if (filterMode === 'no_leads' && row.leadsCount > 0) return false;
      if (filterMode === 'inactive' && row.partner.active) return false;

      if (!q) return true;
      return (
        row.partner.name.toLowerCase().includes(q) ||
        row.partner.code.toLowerCase().includes(q) ||
        (row.partner.phone || '').toLowerCase().includes(q) ||
        (row.partner.notes || '').toLowerCase().includes(q) ||
        (row.owner?.name || '').toLowerCase().includes(q) ||
        (row.owner?.tag || '').toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered];
    if (sortMode === 'leads') {
      sorted.sort((a, b) => b.leadsCount - a.leadsCount || a.rank - b.rank);
    } else if (sortMode === 'visits') {
      sorted.sort((a, b) => b.visits - a.visits || a.rank - b.rank);
    } else if (sortMode === 'conversion') {
      sorted.sort((a, b) => b.conversionPct - a.conversionPct || b.leadsCount - a.leadsCount);
    } else if (sortMode === 'points') {
      sorted.sort((a, b) => b.points - a.points || a.rank - b.rank);
    } else if (sortMode === 'sales') {
      sorted.sort((a, b) => b.salesTotal - a.salesTotal || b.ordenesCount - a.ordenesCount);
    } else if (sortMode === 'name') {
      sorted.sort((a, b) => a.partner.name.localeCompare(b.partner.name, 'es'));
    }
    return sorted;
  }, [rankedRows, search, filterMode, sortMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, partnerScope, vendedorOwnerFilter, filterMode, sortMode]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / RANKING_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIdx = (safePage - 1) * RANKING_PAGE_SIZE;
  const paginatedRows = useMemo(
    () => visibleRows.slice(pageStartIdx, pageStartIdx + RANKING_PAGE_SIZE),
    [visibleRows, pageStartIdx]
  );

  // Handlers
  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
  };

  const handleSaveRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizePrizeRule(ruleDraft);
    setBanner(null);
    const runSave = async (masterPassword: string) => {
      setSavingRule(true);
      try {
        await onSavePrizeRule(cleaned, masterPassword);
        setRuleDraft(cleaned);
        showBanner('success', `Reglas del premio "${cleaned.prizeName}" actualizadas.`);
      } finally {
        setSavingRule(false);
      }
    };
    if (isAiManager) {
      void runSave('').catch((err) =>
        showBanner('error', err instanceof Error ? err.message : 'No se pudieron guardar las reglas.')
      );
      return;
    }
    setPendingSecretAction({
      title: 'Guardar reglas del premio',
      description: `Ingresa tu contraseña de Administrador para actualizar las reglas de "${cleaned.prizeName}".`,
      confirmLabel: 'Autorizar y guardar',
      run: runSave,
    });
  };

  const openEditModal = (partner: ReferralPartner) => {
    setEditingPartner(partner);
    setEditName(partner.name);
    setEditCode(partner.code);
    setEditPhone(partner.phone || '');
    setEditNotes(partner.notes || '');
    setEditAvatarUrl(partner.avatarUrl || '');
    setEditStyleId(partner.qrStyleId || 'classic-gold');
    setEditActive(partner.active);
    setEditError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner || savingEdit) return;
    setEditError(null);
    if (editName.trim().length < 2) {
      setEditError('El nombre del embajador debe tener al menos 2 caracteres.');
      return;
    }
    const normalizedCode = normalizeReferralCodeInput(editCode);
    if (normalizedCode.length < 2) {
      setEditError('El código debe tener al menos 2 caracteres alfanuméricos.');
      return;
    }
    const avatarCheck = validateAvatarUrlInput(editAvatarUrl);
    if (!avatarCheck.ok) {
      setEditError(avatarCheck.error || 'La foto de perfil no es válida.');
      return;
    }
    const targetPartner = editingPartner;
    const payload: UpdateReferralPayload = {
      name: editName.trim(),
      code: normalizedCode,
      phone: editPhone.trim(),
      notes: editNotes.trim(),
      avatarUrl: avatarCheck.value,
      qrStyleId: editStyleId,
      active: editActive,
    };
    setBanner(null);
    setPendingSecretAction({
      title: `Actualizar a ${targetPartner.name}`,
      description: 'Ingresa tu contraseña de Administrador para guardar los cambios del perfil de embajador.',
      confirmLabel: 'Autorizar y guardar',
      run: async (masterPassword) => {
        setSavingEdit(true);
        try {
          await onUpdatePartner(targetPartner.id, payload, masterPassword);
          setEditingPartner(null);
          showBanner('success', `Embajador "${payload.name}" actualizado.`);
        } finally {
          setSavingEdit(false);
        }
      },
    });
  };

  const handleToggleActive = (partner: ReferralPartner) => {
    if (busyPartnerId) return;
    setBanner(null);
    setPendingSecretAction({
      title: partner.active ? `Desactivar QR de ${partner.name}` : `Activar QR de ${partner.name}`,
      description: 'Ingresa tu contraseña de Administrador para cambiar el estado activo de este embajador.',
      confirmLabel: 'Autorizar cambio',
      run: async (masterPassword) => {
        setBusyPartnerId(partner.id);
        try {
          await onUpdatePartner(partner.id, { active: !partner.active }, masterPassword);
        } finally {
          setBusyPartnerId(null);
        }
      },
    });
  };

  const handleResetVisits = (partner: ReferralPartner) => {
    if (resettingVisitsId) return;
    setBanner(null);
    setPendingSecretAction({
      title: `Reiniciar visitas de ${partner.name}`,
      description: 'Ingresa tu contraseña de Administrador para poner en 0 el contador e historial de visitas de este QR.',
      confirmLabel: 'Autorizar reinicio',
      run: async (masterPassword) => {
        setResettingVisitsId(partner.id);
        try {
          await onUpdatePartner(partner.id, { resetVisits: true }, masterPassword);
          if (editingPartner?.id === partner.id) {
            setEditingPartner({ ...editingPartner, visitsCount: 0, uniqueVisitsCount: 0, lastVisitAt: null });
          }
          showBanner('success', `Visitas QR de "${partner.name}" reiniciadas a 0.`);
        } finally {
          setResettingVisitsId(null);
        }
      },
    });
  };

  const handleDelete = (partner: ReferralPartner) => {
    if (busyPartnerId) return;
    setBanner(null);
    setPendingSecretAction({
      title: `Eliminar registro de ${partner.name}`,
      description: 'Ingresa tu contraseña de Administrador para eliminar este perfil del ranking de embajadores.',
      confirmLabel: 'Autorizar y eliminar',
      run: async (masterPassword) => {
        setBusyPartnerId(partner.id);
        try {
          await onDeletePartner(partner.id, masterPassword);
          setConfirmDeleteId(null);
          showBanner('success', `Embajador "${partner.name}" eliminado.`);
        } finally {
          setBusyPartnerId(null);
        }
      },
    });
  };

  const handleCopyLink = async (partner: ReferralPartner) => {
    const url = buildReferralUrl(defaultOriginUrl, partner.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(partner.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === partner.id ? null : cur)), 2000);
    } catch {
      showBanner('error', 'No se pudo copiar al portapapeles.');
    }
  };

  const openQrModal = (partner: ReferralPartner) => {
    setQrModalPartner(partner);
    setQrModalStyle(partner.qrStyleId || 'classic-gold');
  };

  const handleDownloadQrModal = async () => {
    if (!qrModalPartner || downloadingQr) return;
    setDownloadingQr(true);
    try {
      await downloadReferralQrPng({
        partnerName: qrModalPartner.name,
        code: qrModalPartner.code,
        referralUrl: buildReferralUrl(defaultOriginUrl, qrModalPartner.code),
        avatarUrl: qrModalPartner.avatarUrl ?? null,
        emoji: qrModalPartner.emoji ?? null,
        styleId: qrModalStyle,
      });
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo descargar la tarjeta QR.');
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Posicion',
      'Nombre',
      'Codigo',
      'Tipo',
      'Vendedor Vinculado',
      'QRs',
      'Estado Premio',
      'Activo',
      'Visitas',
      'Visitas Unicas',
      'Registros',
      'Conversion %',
      'Citas',
      'Demos',
      'Ordenes',
      'Ventas USD',
      'Puntaje',
      'Telefono',
    ];
    const rows = visibleRows.map((row) => [
      row.rank,
      escapeCsvCell(row.partner.name),
      escapeCsvCell(row.partner.code),
      escapeCsvCell(row.isEmbajador ? 'Embajador' : 'Vendedor (Equipo)'),
      escapeCsvCell(
        row.isEmbajador
          ? `De: ${formatOwnerLabel(row.owner)}`
          : `Equipo propio (${row.embajadoresCount} emb.)`
      ),
      row.qrCount,
      escapeCsvCell(row.prizeStatusLabel),
      escapeCsvCell(row.partner.active ? 'Si' : 'No'),
      row.visits,
      row.uniqueVisits,
      row.leadsCount,
      `${row.conversionPct}%`,
      row.citasCount,
      row.demosCount,
      row.ordenesCount,
      row.salesTotal,
      row.points,
      escapeCsvCell(row.partner.phone || ''),
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ranking-embajadores-ciprian-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const metricInfo = METRIC_LABELS[prizeRule.metric];
  const adminTheme = getRoleTheme(userRole);

  return (
    <div className="space-y-4">
      {/* Editorial Header + Main CTAs + 2 Instant Sub-Tabs */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden dsb-glass rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-5 space-y-3.5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: adminTheme.headerStrip }}
        />
        <div className="pointer-events-none hidden sm:block absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#8B0018]/10 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl text-[#FDE68A] shadow-md border border-white/25"
              style={{ background: adminTheme.heroGradient }}
            >
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8B0018]">
                <Sparkles className="h-3 w-3 text-[#B91C1C] shrink-0" />
                Programa de Embajadores QR · Competencia de Premios
              </span>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#22150E] leading-snug">
                Ranking de Referidos y Ganadores
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            {onGoToAccounts && (
              <button
                type="button"
                onClick={onGoToAccounts}
                style={{ background: adminTheme.heroGradient }}
                className="inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white border border-white/20 hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer shadow-md"
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                Gestionar en Cuentas
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={visibleRows.length === 0}
              className="dsb-glass-subtle inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#4E382B] hover:bg-white/85 transition-colors cursor-pointer disabled:opacity-45"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              CSV
            </button>
          </div>
        </div>

        {/* 2 Instant Sub-Tabs: Ranking en Vivo | Reglas del Premio */}
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Secciones de ranking de referidos"
            className="dsb-glass-subtle grid grid-cols-2 sm:inline-flex gap-1 w-full sm:w-auto rounded-2xl p-1 border"
            style={{ borderColor: adminTheme.borderTint }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'ranking'}
              onClick={() => setActiveSubTab('ranking')}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'ranking' ? adminTheme.activePillClass : 'text-[#594133] hover:bg-white/70'
              }`}
            >
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span>Ranking en Vivo</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'rules'}
              onClick={() => setActiveSubTab('rules')}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'rules' ? adminTheme.activePillClass : 'text-[#594133] hover:bg-white/70'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5 shrink-0" />
              <span>Reglas del Premio</span>
            </button>
          </div>

          <span className="text-[11px] font-semibold text-[#6E5341]">
            Premio activo: <strong className="text-[#22150E]">{prizeRule.prizeName}</strong> · Meta:{' '}
            <strong className="tabular-nums">{prizeRule.targetCount} {metricInfo.unit}</strong>
          </span>
        </div>
      </motion.section>

      {/* Feedback Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold ${
              banner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
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

      {/* Top Ranking Mode Selector + Embajador Vendedor Filter */}
      {activeSubTab === 'ranking' && (
        <section
          aria-label="Selector de ranking por rol"
          className="dsb-glass rounded-[20px] sm:rounded-[22px] p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
            <div
              role="tablist"
              aria-label="Modo de ranking"
              className="dsb-glass-subtle grid grid-cols-2 sm:inline-flex items-center gap-1 rounded-2xl p-1 border w-full sm:w-auto max-w-full"
              style={{ borderColor: adminTheme.borderTint }}
            >
              {(
                [
                  { id: 'vendedores', label: `Ranking de Vendedores (${scopeCounts.vendedores})` },
                  { id: 'embajadores', label: `Ranking de Embajadores (${scopeCounts.embajadores})` },
                ] as Array<{ id: PartnerScopeFilter; label: string }>
              ).map((tab) => {
                const active = partnerScope === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPartnerScope(tab.id)}
                    className={`min-h-[40px] sm:min-h-[36px] rounded-xl px-3 sm:px-3.5 py-1.5 text-[11.5px] sm:text-xs font-bold whitespace-nowrap truncate transition-all cursor-pointer ${
                      active
                        ? adminTheme.activePillClass
                        : 'text-[#594133] hover:bg-white/75'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {partnerScope === 'embajadores' && (
              <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
                <label
                  htmlFor="embajador-vendedor-filter"
                  className="text-xs font-semibold text-[#594133] whitespace-nowrap shrink-0"
                >
                  Vendedor:
                </label>
                <select
                  id="embajador-vendedor-filter"
                  value={vendedorOwnerFilter}
                  onChange={(e) => setVendedorOwnerFilter(e.target.value)}
                  className="flex-1 sm:flex-none min-w-0 sm:min-w-[210px] max-w-full min-h-[44px] sm:min-h-[38px] rounded-xl border border-[#DFCBB3]/85 bg-white/80 backdrop-blur-sm px-3 py-1.5 text-base sm:text-xs font-semibold text-[#22150E] focus:border-[#8B0018] focus:bg-white focus:outline-none transition-colors"
                >
                  <option value="all">Todos los vendedores</option>
                  <option value="direct">Ciprian Directo</option>
                  {vendedorFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <span className="text-[11px] font-medium text-[#6E5341]">
            {partnerScope === 'vendedores'
              ? 'Ranking consolidado por equipo: canal directo + embajadores vinculados.'
              : 'Ranking individual de embajadores con su vendedor vinculado.'}
          </span>
        </section>
      )}

      {/* KPI Overview Bar */}
      <section aria-label="Resumen de embajadores QR" className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3.5">
        <div className="relative overflow-hidden dsb-glass rounded-[18px] sm:rounded-[20px] p-3 sm:p-4 hover:-translate-y-0.5 transition-transform">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C88A2B] to-[#F4CA73]" />
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-[#594133]">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#C88A2B] shrink-0" />
            <span className="truncate">{partnerScope === 'vendedores' ? 'Vendedores' : 'Embajadores'}</span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-bold text-[#22150E] tabular-nums">
            {kpis.activePartners}
            <span className="text-xs sm:text-sm font-semibold text-[#7B5D4A]"> / {kpis.totalPartners}</span>
          </p>
          <p className="mt-0.5 text-[10.5px] sm:text-[11px] text-[#6E5341]">Activos ahora</p>
        </div>

        <div className="relative overflow-hidden dsb-glass rounded-[18px] sm:rounded-[20px] p-3 sm:p-4 hover:-translate-y-0.5 transition-transform">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8B0018] to-[#DC2626]" />
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-[#594133]">
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#8B0018] shrink-0" />
            <span className="truncate">Visitas QR</span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-bold text-[#22150E] tabular-nums">
            {kpis.totalVisits.toLocaleString('en-US')}
          </p>
          <p className="mt-0.5 text-[10.5px] sm:text-[11px] text-[#6E5341] tabular-nums">
            {kpis.totalUniqueVisits.toLocaleString('en-US')} únicas
          </p>
        </div>

        <div className="relative overflow-hidden dsb-glass rounded-[18px] sm:rounded-[20px] p-3 sm:p-4 hover:-translate-y-0.5 transition-transform">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2B3A24] to-[#556B2F]" />
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-[#594133]">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#3F5432] shrink-0" />
            <span className="truncate">Registros QR</span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-bold text-[#22150E] tabular-nums">
            {kpis.totalLeads.toLocaleString('en-US')}
          </p>
          <p className="mt-0.5 text-[10.5px] sm:text-[11px] text-[#3F5432] font-semibold tabular-nums">
            {kpis.conversionPct}% conversión
          </p>
        </div>

        <div className="relative overflow-hidden dsb-glass rounded-[18px] sm:rounded-[20px] p-3 sm:p-4 hover:-translate-y-0.5 transition-transform">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0891B2] to-emerald-600" />
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-[#594133]">
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#0B4F6C] shrink-0" />
            <span className="truncate">Embudo QR</span>
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-[11px] sm:text-sm font-bold text-[#22150E] tabular-nums">
            <span className="text-rose-700">{kpis.citas} Citas</span>
            <span className="text-[#C8B29A]">·</span>
            <span className="text-sky-700">{kpis.demos} Demos</span>
            <span className="text-[#C8B29A]">·</span>
            <span className="text-emerald-700">{kpis.ordenes} Órd.</span>
          </div>
          <p className="mt-1 text-[10.5px] sm:text-[11px] font-semibold text-[#6E5341] tabular-nums">
            Ventas: ${kpis.salesTotal.toLocaleString('en-US')}
          </p>
        </div>

        <div
          style={{ background: adminTheme.heroGradient }}
          className="col-span-2 lg:col-span-1 relative overflow-hidden rounded-[18px] sm:rounded-[20px] border border-white/25 backdrop-blur-xl p-3 sm:p-4 text-[#FFFDF9] shadow-md hover:-translate-y-0.5 transition-transform"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-[#FDE68A]">
            <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">Ganadores</span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-bold text-white tabular-nums">
            {kpis.winnersCount}
            {prizeRule.maxWinners > 0 && (
              <span className="text-xs sm:text-sm font-semibold text-white/75"> / Top {prizeRule.maxWinners}</span>
            )}
          </p>
          <p className="mt-0.5 text-[10.5px] sm:text-[11px] text-white/80 truncate">
            Meta: {prizeRule.targetCount} {metricInfo.unit}
          </p>
        </div>
      </section>

      {/* Sub-tab 2: Reglas del Premio */}
      {activeSubTab === 'rules' && (
      <section className="dsb-glass rounded-[22px] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-white/40 border-b border-[#EFE3D2]">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3DA] border border-[#E5C17B] text-[#8C5510]">
              <Settings2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-sm sm:text-base font-bold text-[#22150E] truncate">
                  {prizeRule.prizeName}
                </h3>
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-900">
                  Criterio: {metricInfo.short}
                </span>
              </div>
              <p className="text-xs text-[#6E5341] mt-0.5">
                Meta mínima: <strong className="text-[#22150E] tabular-nums">{prizeRule.targetCount} {metricInfo.unit}</strong>{' '}
                · Cupo ganador:{' '}
                <strong className="text-[#22150E]">
                  {prizeRule.maxWinners === 0 ? 'Todos los que cumplan la meta' : `Top ${prizeRule.maxWinners}`}
                </strong>
                {prizeRule.metric === 'points' && (
                  <span className="ml-1.5 text-[11px] text-[#8C4A19]">
                    (Reg: {prizeRule.pointsPerLead} · Cita: {prizeRule.pointsPerCita} · Demo: {prizeRule.pointsPerDemo} · Orden: {prizeRule.pointsPerOrden})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveRuleSubmit} className="overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 bg-[#FFFDF9]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-semibold text-[#594133] mb-1">
                      Nombre del premio
                    </label>
                    <input
                      type="text"
                      value={ruleDraft.prizeName}
                      onChange={(e) => setRuleDraft((prev) => ({ ...prev, prizeName: e.target.value }))}
                      maxLength={80}
                      placeholder="Premio Embajador Royal Prestige"
                      className="w-full min-h-[44px] sm:min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">
                      Criterio ganador
                    </label>
                    <select
                      value={ruleDraft.metric}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({
                          ...prev,
                          metric: e.target.value as ReferralMetricKey,
                        }))
                      }
                      className="w-full min-h-[44px] sm:min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                    >
                      <option value="leads">Registros (Leads)</option>
                      <option value="citas">Citas</option>
                      <option value="demos">Demos</option>
                      <option value="ordenes">Órdenes cerradas</option>
                      <option value="points">Puntaje ponderado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">
                      Meta mínima para ganar
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={ruleDraft.targetCount}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({
                          ...prev,
                          targetCount: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-full min-h-[44px] sm:min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-sm font-mono font-bold text-[#22150E] tabular-nums focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">
                      Cantidad de ganadores (0 = todos)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={ruleDraft.maxWinners}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({
                          ...prev,
                          maxWinners: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full min-h-[44px] sm:min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-sm font-mono font-bold text-[#22150E] tabular-nums focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                    />
                    <span className="mt-0.5 block text-[10.5px] text-[#8A6D5B]">
                      {ruleDraft.maxWinners === 0
                        ? 'Todos los que alcancen la meta ganan'
                        : `Solo los mejores ${ruleDraft.maxWinners} que cumplan la meta`}
                    </span>
                  </div>
                </div>

                {/* Weighted Points Configuration */}
                {ruleDraft.metric === 'points' && (
                  <div className="rounded-2xl border border-[#E6D5BF] bg-[#FAF1E4]/55 p-3.5 space-y-2.5">
                    <p className="text-xs font-bold text-[#594133]">
                      Pesos del puntaje ponderado (puntos por cada resultado)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6E5341] mb-1">
                          Por Registro
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={ruleDraft.pointsPerLead}
                          onChange={(e) =>
                            setRuleDraft((prev) => ({
                              ...prev,
                              pointsPerLead: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full min-h-[42px] sm:min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-base sm:text-sm font-mono font-bold text-[#22150E] tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6E5341] mb-1">
                          Por Cita
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={ruleDraft.pointsPerCita}
                          onChange={(e) =>
                            setRuleDraft((prev) => ({
                              ...prev,
                              pointsPerCita: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full min-h-[42px] sm:min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-base sm:text-sm font-mono font-bold text-[#22150E] tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6E5341] mb-1">
                          Por Demo
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={ruleDraft.pointsPerDemo}
                          onChange={(e) =>
                            setRuleDraft((prev) => ({
                              ...prev,
                              pointsPerDemo: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full min-h-[42px] sm:min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-base sm:text-sm font-mono font-bold text-[#22150E] tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6E5341] mb-1">
                          Por Orden
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={ruleDraft.pointsPerOrden}
                          onChange={(e) =>
                            setRuleDraft((prev) => ({
                              ...prev,
                              pointsPerOrden: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full min-h-[42px] sm:min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-base sm:text-sm font-mono font-bold text-[#22150E] tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRuleDraft(prizeRule);
                      setActiveSubTab('ranking');
                    }}
                    className="min-h-[44px] sm:min-h-[40px] w-full sm:w-auto rounded-full border border-[#DFCBB3] px-4 py-1.5 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF1E4] cursor-pointer"
                  >
                    Volver al Ranking
                  </button>
                  <button
                    type="submit"
                    disabled={savingRule}
                    className="inline-flex min-h-[44px] sm:min-h-[40px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-[#22150E] px-5 py-1.5 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingRule ? 'Guardando...' : 'Guardar reglas del premio'}
                  </button>
                </div>
              </div>
        </form>
      </section>
      )}

      {/* Sub-tab 1: Ranking en Vivo */}
      {activeSubTab === 'ranking' && (
        <>
      {/* Top 3 Winners Podium */}
      {podiumRows.length > 0 && (
        <section
          aria-label={`Podio Top 3 ${partnerScope === 'vendedores' ? 'Vendedores' : 'Embajadores'}`}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E] flex items-center gap-2">
              <Crown className="h-5 w-5 text-[#C88A2B] shrink-0" />
              Podio de Líderes · Top {podiumRows.length}
            </h3>
            <span className="text-[11px] sm:text-xs font-semibold text-[#7B5D4A]">
              Ordenado por {metricInfo.label.toLowerCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5 items-stretch">
            {podiumRows.map((row) => {
              const isFirst = row.rank === 1;
              const isSecond = row.rank === 2;
              return (
                <motion.div
                  key={row.partner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.22 }}
                  className={`relative overflow-hidden rounded-[20px] sm:rounded-[22px] border p-3.5 sm:p-5 flex flex-col justify-between transition-all ${
                    isFirst
                      ? 'bg-gradient-to-b from-[#24150D]/95 via-[#1D110A]/95 to-[#130A06]/95 backdrop-blur-xl border-[#C88A2B]/70 text-[#FFFDF9] shadow-[0_18px_38px_-14px_rgba(34,21,14,0.48)]'
                      : isSecond
                        ? 'dsb-glass border-[#D8BE99]/80 text-[#22150E]'
                        : 'dsb-glass border-white/75 text-[#22150E]'
                  }`}
                >
                  {isFirst && (
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#F4CA73]/18 blur-2xl" />
                  )}
                  <div className="relative space-y-2.5 sm:space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        data-preserve-surface={isFirst ? 'true' : undefined}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          isFirst
                            ? 'bg-[#F4CA73] text-[#1A0E08]'
                            : isSecond
                              ? 'bg-[#E6D5BF] text-[#22150E]'
                              : 'bg-[#EFE1CE] text-[#6E4514]'
                        }`}
                      >
                        {isFirst ? <Crown className="h-3.5 w-3.5" /> : <Medal className="h-3.5 w-3.5" />}
                        #{row.rank} Lugar
                      </span>

                      {row.isWinning ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-300">
                          <span className={isFirst ? 'text-emerald-300' : 'text-emerald-800'}>
                            🏆 GANANDO
                          </span>
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold tabular-nums ${
                            isFirst
                              ? 'bg-white/10 text-[#E8D5BE]'
                              : 'bg-[#FAF1E4] border border-[#E6D5BF] text-[#7B5D4A]'
                          }`}
                        >
                          {row.metricValue} / {prizeRule.targetCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <AmbassadorAvatar
                        name={row.partner.name}
                        avatarUrl={row.partner.avatarUrl}
                        emoji={row.partner.emoji}
                        size="md"
                        ring="gold"
                        className={isFirst ? 'ring-offset-[#1D110A]' : ''}
                      />
                      <div className="min-w-0 flex-1">
                        <h4
                          className={`font-serif text-base sm:text-lg font-bold truncate ${
                            isFirst ? 'text-white' : 'text-[#22150E]'
                          }`}
                        >
                          {row.partner.name}
                        </h4>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-block font-mono text-[11px] font-bold tracking-wide truncate max-w-full ${
                              isFirst ? 'text-[#F4CA73]' : 'text-[#9A6315]'
                            }`}
                          >
                            ?ref={row.partner.code}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                              isFirst
                                ? 'bg-white/10 border border-white/15 text-[#F4CA73]'
                                : 'dsb-glass-subtle text-[#594133]'
                            }`}
                          >
                            <QrCode className="h-2.5 w-2.5 shrink-0" />
                            {row.qrCount} {row.qrCount === 1 ? 'QR' : 'QRs'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Role / Linkage / Breakdown Strip */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.isEmbajador ? (
                        <>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isFirst
                                ? 'bg-[#F4CA73]/20 border border-[#F4CA73]/40 text-[#F4CA73]'
                                : 'border border-[#C8A85B]/55 bg-[#FFF4DC] text-[#7A4610]'
                            }`}
                          >
                            <Sparkles className="h-2.5 w-2.5 shrink-0" />
                            Embajador
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold max-w-full truncate ${
                              isFirst
                                ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
                                : 'border border-emerald-300/70 bg-emerald-50 text-emerald-900'
                            }`}
                          >
                            De: {formatOwnerLabel(row.owner)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isFirst
                                ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
                                : 'border border-emerald-300/70 bg-[#E6EEDB] text-emerald-900'
                            }`}
                          >
                            Vendedor · {row.embajadoresCount}{' '}
                            {row.embajadoresCount === 1 ? 'embajador' : 'embajadores'} · {row.qrCount} QRs
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                              isFirst
                                ? 'bg-white/10 text-[#E8D5BE]'
                                : 'dsb-glass-subtle text-[#594133]'
                            }`}
                          >
                            Directo: {row.directLeadsCount} · Embajadores: {row.embajadoresLeadsCount}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
                      <div
                        className={`rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-2 text-center ${
                          isFirst ? 'bg-white/8 border border-white/10' : 'bg-white border border-[#EFE3D2]'
                        }`}
                      >
                        <span
                          className={`block text-[10px] font-semibold truncate ${
                            isFirst ? 'text-[#E8D5BE]' : 'text-[#8A6D5B]'
                          }`}
                        >
                          {metricInfo.short}
                        </span>
                        <span
                          className={`block text-base sm:text-lg font-bold tabular-nums ${
                            isFirst ? 'text-[#F4CA73]' : 'text-[#22150E]'
                          }`}
                        >
                          {row.metricValue}
                        </span>
                      </div>
                      <div
                        className={`rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-2 text-center ${
                          isFirst ? 'bg-white/8 border border-white/10' : 'bg-white border border-[#EFE3D2]'
                        }`}
                      >
                        <span
                          className={`block text-[10px] font-semibold ${
                            isFirst ? 'text-[#E8D5BE]' : 'text-[#8A6D5B]'
                          }`}
                        >
                          Visitas
                        </span>
                        <span
                          className={`block text-base sm:text-lg font-bold tabular-nums ${
                            isFirst ? 'text-white' : 'text-[#22150E]'
                          }`}
                        >
                          {row.visits}
                        </span>
                      </div>
                      <div
                        className={`rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-2 text-center ${
                          isFirst ? 'bg-white/8 border border-white/10' : 'bg-white border border-[#EFE3D2]'
                        }`}
                      >
                        <span
                          className={`block text-[10px] font-semibold ${
                            isFirst ? 'text-[#E8D5BE]' : 'text-[#8A6D5B]'
                          }`}
                        >
                          Conv.
                        </span>
                        <span
                          className={`block text-base sm:text-lg font-bold tabular-nums ${
                            isFirst ? 'text-emerald-300' : 'text-[#3D6B52]'
                          }`}
                        >
                          {row.conversionPct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div
                        className={`h-2 w-full overflow-hidden rounded-full ${
                          isFirst ? 'bg-white/15' : 'bg-[#EFE3D2]'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            row.isWinning
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                              : 'bg-gradient-to-r from-[#C88A2B] to-[#F4CA73]'
                          }`}
                          style={{ width: `${row.progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-current/10 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQrModal(row.partner)}
                      data-preserve-surface={isFirst ? 'true' : undefined}
                      className={`flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                        isFirst
                          ? 'bg-[#F4CA73] text-[#1A0E08] hover:brightness-105'
                          : 'border border-[#C88A2B]/40 bg-[#22150E] text-[#FAF3E8] hover:bg-[#3A2418]'
                      }`}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Ver Tarjeta QR
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(row.partner)}
                      className={`min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        isFirst
                          ? 'bg-white/10 text-white hover:bg-white/20'
                          : 'border border-[#DFCBB3] bg-white text-[#594133] hover:bg-[#FAF1E4]'
                      }`}
                    >
                      {copiedId === row.partner.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedId === row.partner.id ? 'Copiado' : 'Link'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Full Ranking Directory (~20 Ambassadors) */}
      <section className="dsb-glass rounded-[24px] sm:rounded-[26px] p-3.5 sm:p-6 space-y-4">
        {/* Search, Filter Pills & Sort */}
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-900/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7B5D4A]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  partnerScope === 'vendedores'
                    ? 'Buscar vendedor por nombre, código o teléfono...'
                    : 'Buscar embajador, código o vendedor vinculado...'
                }
                className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm py-2.5 pl-10 pr-4 text-base sm:text-sm text-[#22150E] placeholder:text-[#8A6D5B] focus:border-[#8B0018] focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
              <Filter className="h-4 w-4 text-[#8A6D5B] shrink-0" />
              <label htmlFor="referrals-sort-select" className="text-xs font-semibold text-[#594133] whitespace-nowrap">
                Ordenar:
              </label>
              <select
                id="referrals-sort-select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="flex-1 md:flex-none min-h-[44px] sm:min-h-[42px] rounded-xl border border-[#DFCBB3]/85 bg-white/75 backdrop-blur-sm px-3 py-1.5 text-base sm:text-xs font-semibold text-[#22150E] focus:border-[#8B0018] focus:bg-white focus:outline-none transition-colors"
              >
                <option value="prize_rank">Ranking del premio</option>
                <option value="leads">Más registros</option>
                <option value="visits">Más visitas QR</option>
                <option value="conversion">Mejor conversión %</option>
                <option value="points">Mayor puntaje</option>
                <option value="sales">Más ventas ($)</option>
                <option value="name">Nombre (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap">
            {(
              [
                { id: 'all', label: `Todos (${rankedRows.length})` },
                {
                  id: 'winning',
                  label: `🏆 Ganando / Meta (${rankedRows.filter((r) => r.isWinning || r.reachedTarget).length})`,
                },
                {
                  id: 'active_activity',
                  label: `Con actividad (${rankedRows.filter((r) => r.visits > 0 || r.leadsCount > 0).length})`,
                },
                {
                  id: 'no_leads',
                  label: `Sin registros (${rankedRows.filter((r) => r.leadsCount === 0).length})`,
                },
                {
                  id: 'inactive',
                  label: `Inactivos (${rankedRows.filter((r) => !r.partner.active).length})`,
                },
              ] as Array<{ id: FilterMode; label: string }>
            ).map((pill) => {
              const active = filterMode === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setFilterMode(pill.id)}
                  className={`shrink-0 whitespace-nowrap min-h-[38px] sm:min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? adminTheme.activePillClass
                      : 'dsb-glass-subtle text-[#594133] hover:bg-white/85'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty State or Ambassador Rows */}
        {referrers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DEC9AE] bg-[#FAF1E4]/50 px-5 py-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3DA] border border-[#E5C17B] text-[#9A6315]">
              <Trophy className="h-7 w-7" />
            </div>
            <h3 className="font-serif text-xl font-bold text-[#22150E]">
              Aún no hay embajadores registrados
            </h3>
            <p className="text-xs sm:text-sm text-[#6E5341] max-w-md mx-auto">
              Los embajadores se crean y sincronizan automáticamente desde la pestaña <strong>Cuentas</strong> al dar de alta cuentas con rol Vendedor / Embajador.
            </p>
            {onGoToAccounts && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onGoToAccounts}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#22150E] px-5 py-2 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer"
                >
                  <Users className="h-4 w-4" />
                  Ir a Cuentas y crear Embajador
                </button>
              </div>
            )}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DEC9AE] bg-[#FAF1E4]/40 py-10 text-center">
            <p className="font-serif text-lg font-semibold text-[#594133]">
              Sin embajadores en este filtro
            </p>
            <p className="mt-1 text-xs text-[#8B6F5B]">
              Prueba cambiando el filtro o limpiando tu búsqueda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedRows.map((row) => {
              const { partner } = row;
              const isExpanded = expandedPartnerId === partner.id;
              const referralUrl = buildReferralUrl(defaultOriginUrl, partner.code);
              const whatsappHref = buildWhatsAppShareUrl(partner, referralUrl);
              const isBusy = busyPartnerId === partner.id;

              return (
                <div
                  key={partner.id}
                  data-dsb-card={!partner.active ? 'locked' : row.isWinning ? 'winning' : undefined}
                  className={`rounded-2xl border p-3.5 sm:p-4 backdrop-blur-md transition-all duration-200 ${
                    !partner.active
                      ? 'border-stone-200/80 bg-stone-50/65 opacity-80'
                      : row.isWinning
                        ? 'border-emerald-300/85 bg-gradient-to-r from-white/78 via-[#F7FCF9]/75 to-[#F0FAF4]/75 shadow-xs hover:bg-white/88'
                        : 'dsb-glass-subtle bg-white/70 hover:bg-white/85 hover:shadow-sm'
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpandedPartnerId((cur) => (cur === partner.id ? null : partner.id))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedPartnerId((cur) => (cur === partner.id ? null : partner.id));
                      }
                    }}
                    className="group/row flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 cursor-pointer rounded-xl -m-1.5 p-1.5 hover:bg-[#FAF1E4]/45 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C88A2B]/60"
                    title={isExpanded ? 'Clic para ocultar prospectos' : 'Clic para desplegar métricas y prospectos de este QR'}
                  >
                    {/* Left: Rank + Identity + Prize Progress */}
                    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div
                        className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl font-serif text-xs sm:text-sm font-bold tabular-nums border ${
                          row.rank === 1
                            ? 'bg-[#22150E] text-[#F4CA73] border-[#C88A2B]'
                            : row.rank === 2
                              ? 'bg-[#FAF1E4] text-[#22150E] border-[#C88A2B]/60'
                              : row.rank === 3
                                ? 'bg-[#F5E6D3] text-[#7A4610] border-[#D8B892]'
                                : 'bg-[#FAF3E8] text-[#6E5341] border-[#E6D5BF]'
                        }`}
                      >
                        #{row.rank}
                      </div>

                      <AmbassadorAvatar
                        name={partner.name}
                        avatarUrl={partner.avatarUrl}
                        emoji={partner.emoji}
                        size="sm"
                        ring={row.isWinning ? 'gold' : 'subtle'}
                      />

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h4 className="text-[15px] font-bold text-[#22150E] group-hover/row:text-[#8C3318] transition-colors break-words">
                            {partner.name}
                          </h4>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-[#9B816E] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-[#22150E]' : 'group-hover/row:text-[#22150E]'
                            }`}
                          />
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#E6C99E] bg-[#FAF0E0] px-2 py-0.5 font-mono text-[11px] font-bold text-[#8C4A19]">
                            {partner.code}
                          </span>
                          {row.isEmbajador ? (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#C8A85B]/55 bg-[#FFF4DC] px-2 py-0.5 text-[10.5px] font-bold text-[#7A4610]">
                                <Sparkles className="h-2.5 w-2.5 shrink-0 text-[#C88A2B]" />
                                Embajador
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-[#E6EEDB] px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-900 max-w-full truncate">
                                De: {formatOwnerLabel(row.owner)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full dsb-glass-subtle px-2 py-0.5 text-[10.5px] font-bold text-[#594133] tabular-nums">
                                <QrCode className="h-3 w-3 shrink-0 text-[#8B0018]" />
                                {row.qrCount} {row.qrCount === 1 ? 'QR' : 'QRs'}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-[#E6EEDB] px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-900 tabular-nums">
                              Vendedor · {row.embajadoresCount}{' '}
                              {row.embajadoresCount === 1 ? 'embajador' : 'embajadores'} · {row.qrCount}{' '}
                              {row.qrCount === 1 ? 'QR' : 'QRs'}
                            </span>
                          )}
                          {!partner.active && (
                            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                              Inactivo
                            </span>
                          )}
                          {row.isWinning ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-900">
                              🏆 GANANDO · Meta cumplida
                            </span>
                          ) : row.reachedTarget ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-900">
                              Meta cumplida (Top {prizeRule.maxWinners} lleno)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#E6D5BF] bg-[#FAF3E8] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#6E5341] tabular-nums">
                              En progreso ({row.metricValue} / {prizeRule.targetCount})
                            </span>
                          )}
                        </div>

                        {/* Secondary meta (breakdown / phone / notes / last visit) */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#7B5D4A]">
                          {!row.isEmbajador && (
                            <span className="inline-flex items-center gap-1 rounded-md dsb-glass-subtle px-2 py-0.5 text-[11px] font-semibold text-[#594133] tabular-nums">
                              Directo: {row.directLeadsCount} · Embajadores: {row.embajadoresLeadsCount}
                            </span>
                          )}
                          {partner.phone && (
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Phone className="h-3 w-3 text-[#B84A27]" />
                              {partner.phone}
                            </span>
                          )}
                          {partner.lastVisitAt && (
                            <span>Último escaneo: {formatShortDate(partner.lastVisitAt)}</span>
                          )}
                          {partner.notes && (
                            <span className="truncate max-w-full sm:max-w-xs italic text-[#8A6D5B]">
                              “{partner.notes}”
                            </span>
                          )}
                        </div>

                        {/* Smooth progress bar toward goal */}
                        <div className="max-w-md pt-0.5">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFE3D2]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                row.isWinning
                                  ? 'bg-gradient-to-r from-[#3D6B52] to-emerald-500'
                                  : 'bg-gradient-to-r from-[#C88A2B] to-[#E5AE4E]'
                              }`}
                              style={{ width: `${row.progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Center: Compact Live Metrics Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2 w-full xl:w-auto xl:shrink-0">
                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-1.5 sm:px-2.5 py-1.5 text-center min-w-0">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B] truncate">Visitas QR</span>
                        <span className="block text-sm font-bold text-[#22150E] tabular-nums">
                          {row.visits}
                        </span>
                        <span className="block text-[9.5px] text-[#8A6D5B] tabular-nums">
                          {row.uniqueVisits} ún.
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-1.5 sm:px-2.5 py-1.5 text-center min-w-0">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B] truncate">Registros</span>
                        <span className="block text-sm font-bold text-[#B84A27] tabular-nums">
                          {row.leadsCount}
                        </span>
                        <span className="block text-[9.5px] text-[#3D6B52] font-semibold tabular-nums">
                          {row.conversionPct}%
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-1.5 sm:px-2.5 py-1.5 text-center min-w-0">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B] truncate">Citas</span>
                        <span className="block text-sm font-bold text-rose-700 tabular-nums">
                          {row.citasCount}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-1.5 sm:px-2.5 py-1.5 text-center min-w-0">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B] truncate">Demos</span>
                        <span className="block text-sm font-bold text-sky-700 tabular-nums">
                          {row.demosCount}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-1.5 sm:px-2.5 py-1.5 text-center min-w-0">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B] truncate">Órdenes</span>
                        <span className="block text-sm font-bold text-emerald-700 tabular-nums">
                          {row.ordenesCount}
                        </span>
                        {row.salesTotal > 0 && (
                          <span className="block text-[9.5px] font-bold text-emerald-800 tabular-nums truncate">
                            ${row.salesTotal.toLocaleString('en-US')}
                          </span>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#E5C17B] bg-[#FFF6E3] px-1.5 sm:px-2.5 py-1.5 text-center min-w-0">
                        <span className="block text-[10px] font-bold text-[#8A5610] truncate">
                          {prizeRule.metric === 'points' ? 'Puntaje' : metricInfo.short}
                        </span>
                        <span className="block text-sm font-bold text-[#22150E] tabular-nums">
                          {row.metricValue}
                        </span>
                        {prizeRule.metric !== 'points' && (
                          <span className="block text-[9.5px] text-[#8A5610] tabular-nums">
                            {row.points} pts
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Strip */}
                  <div className="mt-3 pt-3 border-t border-[#EFE3D2] flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2">
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => openQrModal(partner)}
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center justify-center gap-1.5 rounded-xl bg-[#22150E] px-2.5 sm:px-3 py-1.5 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] transition-colors cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Tarjeta QR HD</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyLink(partner)}
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center justify-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-[#FAF3E8] px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
                      >
                        {copiedId === partner.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">Enlace copiado</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="h-3.5 w-3.5 text-[#B84A27] shrink-0" />
                            <span className="truncate">Copiar enlace</span>
                          </>
                        )}
                      </button>

                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        WhatsApp
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPartnerId((cur) => (cur === partner.id ? null : partner.id))
                        }
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center justify-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">Ver referidos ({row.leadsCount})</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => openEditModal(partner)}
                        title="Editar embajador"
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-[#DFCBB3] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleActive(partner)}
                        title={partner.active ? 'Desactivar QR' : 'Activar QR'}
                        className={`inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                          partner.active
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
                            : 'border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{partner.active ? 'Activo' : 'Activar'}</span>
                      </button>

                      {confirmDeleteId === partner.id ? (
                        <span className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(partner)}
                            className="font-bold text-rose-700 hover:underline cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[#6E5341] hover:text-[#22150E] cursor-pointer"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(partner.id)}
                          title="Eliminar embajador"
                          aria-label={`Eliminar a ${partner.name}`}
                          className="inline-flex min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/60 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Referred Leads Drawer */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-dashed border-[#DFCBB3] space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-1.5 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className="font-bold text-[#594133]">
                                {row.isEmbajador
                                  ? `Prospectos traídos por ${partner.name} (${row.leadsCount})`
                                  : `Prospectos consolidados de ${partner.name} (${row.leadsCount})`}
                              </span>
                              {row.isEmbajador ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-[#E6EEDB] px-2 py-0.5 text-[10.5px] font-bold text-emerald-900">
                                  De: {formatOwnerLabel(row.owner)}
                                </span>
                              ) : (
                                <>
                                  <span className="inline-flex items-center rounded-full dsb-glass-subtle px-2 py-0.5 text-[10.5px] font-semibold text-[#594133] tabular-nums">
                                    Directo: {row.directLeadsCount} · Embajadores: {row.embajadoresLeadsCount}
                                  </span>
                                  <span className="inline-flex items-center rounded-full dsb-glass-subtle px-2 py-0.5 text-[10.5px] font-semibold text-[#594133] tabular-nums">
                                    QRs: {row.qrCount} (Dir: {row.directQrCount} · Emb: {row.embajadoresQrCount})
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-[#8A6D5B] truncate max-w-full sm:max-w-md">
                              {referralUrl}
                            </span>
                          </div>

                          {row.leads.length === 0 ? (
                            <p className="rounded-xl bg-[#FAF3E8]/60 px-3.5 py-4 text-center text-xs text-[#7B5D4A]">
                              Todavía no hay registros completados desde el QR de {partner.name}.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {row.leads.map((lead) => {
                                const badge = CATEGORY_BADGE_MAP[lead.category] || CATEGORY_BADGE_MAP.none;
                                const sourceEmbajador = !row.isEmbajador
                                  ? findLeadEmbajadorSource(lead, row.vendedorRollup?.embajadoresBreakdown)
                                  : null;
                                return (
                                  <div
                                    key={lead.id}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-3 py-2 text-xs min-w-0"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="font-bold text-[#22150E] truncate">{lead.name}</p>
                                        {!row.isEmbajador &&
                                          (sourceEmbajador ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-[#C8A85B]/55 bg-[#FFF4DC] px-2 py-0.5 text-[9.5px] font-bold text-[#7A4610] max-w-full truncate">
                                              <Sparkles className="h-2.5 w-2.5 shrink-0 text-[#C88A2B]" />
                                              {sourceEmbajador.emoji ? `${sourceEmbajador.emoji} ` : ''}
                                              {sourceEmbajador.name}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center rounded-full border border-emerald-300/70 bg-[#E6EEDB] px-2 py-0.5 text-[9.5px] font-bold text-emerald-900">
                                              Directo · {partner.code}
                                            </span>
                                          ))}
                                      </div>
                                      <p className="text-[11px] text-[#6E5341] truncate">
                                        <span className="font-mono">{lead.phone}</span> · {lead.giftName || 'Sin regalo'}
                                      </p>
                                      <p className="text-[10px] text-[#8A6D5B] truncate">
                                        Orden {lead.claimCode} · {formatShortDate(lead.createdAt)}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0 space-y-1">
                                      <span
                                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
                                      >
                                        {badge.label}
                                      </span>
                                      {lead.category === 'orden' && lead.orderAmount ? (
                                        <p className="font-mono text-[11px] font-bold text-emerald-700 tabular-nums">
                                          ${lead.orderAmount.toLocaleString('en-US')}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pt-3 border-t border-slate-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#594133] tabular-nums">
              Mostrando {pageStartIdx + 1}–{Math.min(pageStartIdx + RANKING_PAGE_SIZE, visibleRows.length)} de{' '}
              {visibleRows.length}
            </span>
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
              <span className="px-2.5 text-xs font-bold text-[#22150E] tabular-nums">
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
          </div>
        )}
      </section>
        </>
      )}

      {/* Modal 2: Edit Ambassador */}
      <AnimatePresence>
        {editingPartner && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-referrer-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/60 backdrop-blur-xs sm:backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            onClick={() => !savingEdit && setEditingPartner(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEdit}
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF] p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4"
            >
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9A6315]">
                    Editar Embajador
                  </span>
                  <h3 id="edit-referrer-title" className="font-serif text-lg sm:text-xl font-bold text-[#22150E] break-words leading-snug">
                    {editingPartner.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7B5D4A] hover:bg-[#FAF1E4] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">
                    Código de referencia *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(sanitizeReferralCodeDraft(e.target.value))}
                    onBlur={() => setEditCode((prev) => normalizeReferralCodeInput(prev))}
                    maxLength={32}
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 font-mono text-base sm:text-sm font-bold text-[#8C4A19] uppercase focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">Estilo QR</label>
                    <select
                      value={editStyleId}
                      onChange={(e) => setEditStyleId(e.target.value as QrStyleId)}
                      className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-sm text-[#22150E]"
                    >
                      {QR_STYLE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">Notas</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>

                <AvatarPickerField
                  name={editName || editingPartner.name}
                  value={editAvatarUrl}
                  onChange={setEditAvatarUrl}
                  disabled={savingEdit}
                  label="Foto de perfil del Embajador"
                />

                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#EFE3D2] bg-[#FAF3E8]/60 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#22150E]">QR Activo</p>
                    <p className="text-[11px] text-[#7B5D4A]">
                      Si está inactivo, los nuevos escaneos no sumarán visitas.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-[#22150E] cursor-pointer"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
                  <div className="text-xs text-amber-950">
                    <p className="font-bold">Contador de visitas</p>
                    <p className="text-[11px] text-amber-800 tabular-nums">
                      {editingPartner.visitsCount} totales · {editingPartner.uniqueVisitsCount} únicas
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={resettingVisitsId === editingPartner.id}
                    onClick={() => handleResetVisits(editingPartner)}
                    className="inline-flex min-h-[38px] sm:min-h-[36px] w-full sm:w-auto items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {resettingVisitsId === editingPartner.id ? 'Reiniciando...' : 'Reiniciar visitas'}
                  </button>
                </div>
              </div>

              {editError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-[#DFCBB3] px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF1E4] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-[#C88A2B]/45 bg-[#22150E] px-5 py-2 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 3: HD Referral QR Card Preview + Download */}
      <AnimatePresence>
        {qrModalPartner && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-card-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#120804]/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            onClick={() => setQrModalPartner(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[24px] sm:rounded-[28px] border border-[#C88A2B]/50 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-4 sm:p-6 text-[#FFFDF9] shadow-2xl space-y-3.5 sm:space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F4CA73]">
                    Tarjeta QR HD · {qrModalPartner.partnerType === 'embajador' ? 'Embajador' : 'Vendedor'}
                  </span>
                  <h3 id="qr-card-modal-title" className="font-serif text-lg sm:text-xl font-bold text-white truncate">
                    {qrModalPartner.name}
                  </h3>
                  {qrModalPartner.partnerType === 'embajador' && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-200 max-w-full truncate">
                      De: {formatOwnerLabel(resolveEmbajadorOwner(qrModalPartner, accounts, referrers))}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalPartner(null)}
                  aria-label="Cerrar tarjeta QR"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#C8B29A] hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Theme Switcher Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {QR_STYLE_OPTIONS.map((opt) => {
                  const theme = REFERRAL_QR_THEMES[opt.id];
                  const active = qrModalStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setQrModalStyle(opt.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                        active
                          ? 'border-[#F4CA73] bg-[#F4CA73]/20 text-[#F4CA73]'
                          : 'border-white/15 bg-white/5 text-[#E8D5BE] hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-white/30"
                        style={{ backgroundColor: theme.accent }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* HD Card Preview */}
              <div className="relative mx-auto w-full max-w-[230px] sm:max-w-[300px] aspect-[4/5] rounded-2xl overflow-hidden border border-[#F4CA73]/35 bg-[#120A06] flex items-center justify-center shadow-xl">
                {qrPreviewLoading || !qrPreviewDataUrl ? (
                  <div className="text-center space-y-2 p-4">
                    <QrCode className="mx-auto h-8 w-8 text-[#F4CA73] animate-pulse" />
                    <p className="text-xs text-[#E8D5BE]">Generando tarjeta HD...</p>
                  </div>
                ) : (
                  <img
                    src={qrPreviewDataUrl}
                    alt={`Tarjeta QR de ${qrModalPartner.name}`}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>

              {/* URL Preview */}
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
                <span className="font-mono text-[11px] text-[#E8D5BE] truncate min-w-0 flex-1">
                  {buildReferralUrl(defaultOriginUrl, qrModalPartner.code)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink(qrModalPartner)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] font-bold text-[#F4CA73] cursor-pointer"
                >
                  {copiedId === qrModalPartner.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-300" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiar
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={downloadingQr}
                  onClick={handleDownloadQrModal}
                  data-preserve-surface="true"
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-4 py-2.5 text-xs font-bold text-[#1A0E08] shadow hover:brightness-105 cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {downloadingQr ? 'Descargando...' : 'Descargar PNG HD'}
                </button>

                <a
                  href={buildWhatsAppShareUrl(
                    qrModalPartner,
                    buildReferralUrl(defaultOriginUrl, qrModalPartner.code)
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar por WhatsApp
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SecretKeyModal
        open={Boolean(pendingSecretAction)}
        bypassPassword={isAiManager}
        title={pendingSecretAction?.title || 'Autorizar cambio'}
        description={pendingSecretAction?.description}
        confirmLabel={pendingSecretAction?.confirmLabel}
        onClose={() => setPendingSecretAction(null)}
        onAuthorize={async (masterPassword) => {
          if (!pendingSecretAction) return;
          await pendingSecretAction.run(masterPassword);
        }}
      />
    </div>
  );
};
