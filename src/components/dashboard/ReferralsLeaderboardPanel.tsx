import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Check,
  ChevronDown,
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
  Plus,
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
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  Lead,
  QrStyleId,
  ReferralMetricKey,
  ReferralPartner,
  ReferralPrizeRule,
} from '../../types/app';
import type {
  BatchCreateReferralsPayload,
  CreateReferralPayload,
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
  suggestReferralCodeFromName,
} from './referralQrExport';

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
  settings: AppSettings;
  defaultOriginUrl: string;
  onCreatePartner: (payload: CreateReferralPayload) => Promise<void>;
  onBatchCreatePartners: (
    payload: BatchCreateReferralsPayload
  ) => Promise<{ created: ReferralPartner[]; skipped: string[] }>;
  onUpdatePartner: (id: string, updates: UpdateReferralPayload) => Promise<void>;
  onDeletePartner: (id: string) => Promise<void>;
  onSavePrizeRule: (rule: ReferralPrizeRule) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

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

interface ParsedBatchLine {
  name: string;
  phone?: string;
  code: string;
}

function parseBatchLines(raw: string, existingCodes: Set<string>): ParsedBatchLine[] {
  const used = new Set<string>(existingCodes);
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const results: ParsedBatchLine[] = [];
  for (const line of lines) {
    // Supports: "Name", "Name, Phone", "Name | Phone | Code", "Name; Phone"
    const parts = line
      .split(/[,|;\t]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts[0];
    if (name.length < 2) continue;

    let phone: string | undefined;
    let customCode: string | undefined;

    if (parts.length === 2) {
      const digits = parts[1].replace(/\D/g, '');
      if (digits.length >= 6) {
        phone = parts[1];
      } else {
        customCode = normalizeReferralCodeInput(parts[1]);
      }
    } else if (parts.length >= 3) {
      phone = parts[1];
      customCode = normalizeReferralCodeInput(parts[2]);
    }

    let code = customCode && customCode.length >= 2 ? customCode : suggestReferralCodeFromName(name, used);
    if (used.has(code)) {
      code = suggestReferralCodeFromName(name, used);
    }
    used.add(code);
    results.push({ name, phone, code });
  }
  return results.slice(0, 50);
}

export const ReferralsLeaderboardPanel: React.FC<ReferralsLeaderboardPanelProps> = ({
  referrers,
  leads,
  settings,
  defaultOriginUrl,
  onCreatePartner,
  onBatchCreatePartners,
  onUpdatePartner,
  onDeletePartner,
  onSavePrizeRule,
  onBusyChange,
}) => {
  const prizeRule = useMemo(
    () => sanitizePrizeRule(settings.referralPrizeRule),
    [settings.referralPrizeRule]
  );

  // Prize Rule editor state
  const [rulePanelOpen, setRulePanelOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<ReferralPrizeRule>(prizeRule);
  const [savingRule, setSavingRule] = useState(false);

  // Sync draft when server settings update and editor is closed
  useEffect(() => {
    if (!rulePanelOpen) {
      setRuleDraft(prizeRule);
    }
  }, [prizeRule, rulePanelOpen]);

  // Add / Batch Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'batch'>('single');
  const [singleName, setSingleName] = useState('');
  const [singleCode, setSingleCode] = useState('');
  const [singleCodeTouched, setSingleCodeTouched] = useState(false);
  const [singlePhone, setSinglePhone] = useState('');
  const [singleNotes, setSingleNotes] = useState('');
  const [singleStyleId, setSingleStyleId] = useState<QrStyleId>('classic-gold');
  const [submittingSingle, setSubmittingSingle] = useState(false);

  // Batch states
  const [batchText, setBatchText] = useState('');
  const [quickCount, setQuickCount] = useState(20);
  const [quickNamePrefix, setQuickNamePrefix] = useState('Embajador');
  const [quickCodePrefix, setQuickCodePrefix] = useState('EMB');
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Edit Partner Modal
  const [editingPartner, setEditingPartner] = useState<ReferralPartner | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStyleId, setEditStyleId] = useState<QrStyleId>('classic-gold');
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingVisitsId, setResettingVisitsId] = useState<string | null>(null);

  // QR Card HD Modal
  const [qrModalPartner, setQrModalPartner] = useState<ReferralPartner | null>(null);
  const [qrModalStyle, setQrModalStyle] = useState<QrStyleId>('classic-gold');
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string | null>(null);
  const [qrPreviewLoading, setQrPreviewLoading] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  // List filters / UI state
  const [search, setSearch] = useState('');
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
      addModalOpen ||
      Boolean(editingPartner) ||
      Boolean(qrModalPartner) ||
      rulePanelOpen ||
      savingRule ||
      submittingSingle ||
      submittingBatch ||
      savingEdit;
    onBusyChange?.(isBusy);
    return () => onBusyChange?.(false);
  }, [
    addModalOpen,
    editingPartner,
    qrModalPartner,
    rulePanelOpen,
    savingRule,
    submittingSingle,
    submittingBatch,
    savingEdit,
    onBusyChange,
  ]);

  const existingCodesSet = useMemo(
    () => new Set(referrers.map((r) => r.code.trim().toUpperCase())),
    [referrers]
  );

  // Auto-suggest code from name while creating a single partner
  useEffect(() => {
    if (!singleCodeTouched) {
      if (singleName.trim().length >= 2) {
        setSingleCode(suggestReferralCodeFromName(singleName, existingCodesSet));
      } else {
        setSingleCode('');
      }
    }
  }, [singleName, singleCodeTouched, existingCodesSet]);

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

  // Compute live metrics + official prize ranking for all ambassadors
  const rankedRows = useMemo<PartnerMetricsRow[]>(() => {
    const base = referrers.map((partner) => {
      const codeUpper = partner.code.trim().toUpperCase();
      const matchedLeads = leads.filter(
        (lead) =>
          (lead.referrerId && lead.referrerId === partner.id) ||
          (lead.referralCode && lead.referralCode.trim().toUpperCase() === codeUpper)
      );

      const leadsCount = matchedLeads.length;
      const citasCount = matchedLeads.filter((l) => l.category === 'cita').length;
      const demosCount = matchedLeads.filter((l) => l.category === 'demo').length;
      const ordenesCount = matchedLeads.filter((l) => l.category === 'orden').length;
      const salesTotal = matchedLeads
        .filter((l) => l.category === 'orden')
        .reduce(
          (acc, l) => acc + (typeof l.orderAmount === 'number' && l.orderAmount > 0 ? l.orderAmount : 0),
          0
        );

      const points =
        leadsCount * prizeRule.pointsPerLead +
        citasCount * prizeRule.pointsPerCita +
        demosCount * prizeRule.pointsPerDemo +
        ordenesCount * prizeRule.pointsPerOrden;

      const visits = Math.max(0, Number(partner.visitsCount) || 0);
      const uniqueVisits = Math.max(0, Number(partner.uniqueVisitsCount) || 0);
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
  }, [referrers, leads, prizeRule]);

  // Global KPI aggregates
  const kpis = useMemo(() => {
    const totalPartners = referrers.length;
    const activePartners = referrers.filter((r) => r.active).length;
    const totalVisits = rankedRows.reduce((acc, r) => acc + r.visits, 0);
    const totalUniqueVisits = rankedRows.reduce((acc, r) => acc + r.uniqueVisits, 0);

    // Count unique attributed leads across all ambassadors
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
        (acc, l) => acc + (typeof l.orderAmount === 'number' && l.orderAmount > 0 ? l.orderAmount : 0),
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
  }, [referrers, rankedRows]);

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
        (row.partner.notes || '').toLowerCase().includes(q)
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

  const parsedBatchPreview = useMemo(
    () => parseBatchLines(batchText, existingCodesSet),
    [batchText, existingCodesSet]
  );

  // Handlers
  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
  };

  const handleSaveRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRule(true);
    setBanner(null);
    try {
      const cleaned = sanitizePrizeRule(ruleDraft);
      await onSavePrizeRule(cleaned);
      setRuleDraft(cleaned);
      setRulePanelOpen(false);
      showBanner('success', `Reglas del premio "${cleaned.prizeName}" actualizadas.`);
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudieron guardar las reglas del premio.');
    } finally {
      setSavingRule(false);
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = singleName.trim();
    if (cleanName.length < 2) {
      showBanner('error', 'Ingresa un nombre válido (mínimo 2 caracteres).');
      return;
    }
    const cleanCode = normalizeReferralCodeInput(singleCode);
    setSubmittingSingle(true);
    setBanner(null);
    try {
      await onCreatePartner({
        name: cleanName,
        code: cleanCode.length >= 2 ? cleanCode : undefined,
        phone: singlePhone.trim() || undefined,
        notes: singleNotes.trim() || undefined,
        qrStyleId: singleStyleId,
        active: true,
      });
      setSingleName('');
      setSingleCode('');
      setSingleCodeTouched(false);
      setSinglePhone('');
      setSingleNotes('');
      setAddModalOpen(false);
      showBanner('success', `Embajador "${cleanName}" creado con su código QR único.`);
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo crear el embajador.');
    } finally {
      setSubmittingSingle(false);
    }
  };

  const handleBatchTextSubmit = async () => {
    if (parsedBatchPreview.length === 0 || submittingBatch) return;
    setSubmittingBatch(true);
    setBanner(null);
    try {
      const res = await onBatchCreatePartners({
        items: parsedBatchPreview.map((item) => ({
          name: item.name,
          code: item.code,
          phone: item.phone,
        })),
      });
      setBatchText('');
      setAddModalOpen(false);
      const skippedText =
        res.skipped.length > 0 ? ` (${res.skipped.length} omitidos por duplicado)` : '';
      showBanner(
        'success',
        `${res.created.length} ${res.created.length === 1 ? 'embajador creado' : 'embajadores creados'} en lote${skippedText}.`
      );
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'Error al crear el lote de embajadores.');
    } finally {
      setSubmittingBatch(false);
    }
  };

  const handleQuickGenerateBatch = async () => {
    if (submittingBatch) return;
    const count = Math.max(1, Math.min(50, Math.round(Number(quickCount) || 20)));
    const namePrefix = quickNamePrefix.trim() || 'Embajador';
    const codePrefix = normalizeReferralCodeInput(quickCodePrefix) || 'EMB';

    setSubmittingBatch(true);
    setBanner(null);
    try {
      const res = await onBatchCreatePartners({
        count,
        namePrefix,
        codePrefix,
      });
      setAddModalOpen(false);
      const skippedText =
        res.skipped.length > 0 ? ` (${res.skipped.length} ya existían)` : '';
      showBanner(
        'success',
        `Lote listo: ${res.created.length} embajadores generados con prefijo ${codePrefix}${skippedText}.`
      );
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo generar el lote.');
    } finally {
      setSubmittingBatch(false);
    }
  };

  const openEditModal = (partner: ReferralPartner) => {
    setEditingPartner(partner);
    setEditName(partner.name);
    setEditCode(partner.code);
    setEditPhone(partner.phone || '');
    setEditNotes(partner.notes || '');
    setEditStyleId(partner.qrStyleId || 'classic-gold');
    setEditActive(partner.active);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner || savingEdit) return;
    if (editName.trim().length < 2) {
      showBanner('error', 'El nombre del embajador debe tener al menos 2 caracteres.');
      return;
    }
    const normalizedCode = normalizeReferralCodeInput(editCode);
    if (normalizedCode.length < 2) {
      showBanner('error', 'El código debe tener al menos 2 caracteres alfanuméricos.');
      return;
    }
    setSavingEdit(true);
    setBanner(null);
    try {
      await onUpdatePartner(editingPartner.id, {
        name: editName.trim(),
        code: normalizedCode,
        phone: editPhone.trim(),
        notes: editNotes.trim(),
        qrStyleId: editStyleId,
        active: editActive,
      });
      setEditingPartner(null);
      showBanner('success', `Embajador "${editName.trim()}" actualizado.`);
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo actualizar el embajador.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (partner: ReferralPartner) => {
    if (busyPartnerId) return;
    setBusyPartnerId(partner.id);
    setBanner(null);
    try {
      await onUpdatePartner(partner.id, { active: !partner.active });
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusyPartnerId(null);
    }
  };

  const handleResetVisits = async (partner: ReferralPartner) => {
    if (resettingVisitsId) return;
    setResettingVisitsId(partner.id);
    setBanner(null);
    try {
      await onUpdatePartner(partner.id, { resetVisits: true });
      if (editingPartner?.id === partner.id) {
        setEditingPartner({ ...editingPartner, visitsCount: 0, uniqueVisitsCount: 0, lastVisitAt: null });
      }
      showBanner('success', `Visitas QR de "${partner.name}" reiniciadas a 0.`);
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudieron reiniciar las visitas.');
    } finally {
      setResettingVisitsId(null);
    }
  };

  const handleDelete = async (partner: ReferralPartner) => {
    if (busyPartnerId) return;
    setBusyPartnerId(partner.id);
    setBanner(null);
    try {
      await onDeletePartner(partner.id);
      setConfirmDeleteId(null);
      showBanner('success', `Embajador "${partner.name}" eliminado.`);
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo eliminar el embajador.');
    } finally {
      setBusyPartnerId(null);
    }
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

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Editorial Header + Main CTAs */}
      <section className="relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-gradient-to-br from-[#FFFDF9] via-[#FFF8EE] to-[#F7EADA] border border-[#E6D5BF] p-4 sm:p-6 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)]">
        <div className="pointer-events-none hidden sm:block absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#E5AE4E]/18 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#22150E] to-[#3B2418] text-[#F4CA73] shadow-md border border-[#C88A2B]/45">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-[#9A6315]">
                <Sparkles className="h-3.5 w-3.5 text-[#C88A2B] shrink-0" />
                Programa de Embajadores QR · Competencia de Premios
              </span>
              <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#22150E] mt-0.5 leading-snug">
                Ranking de Referidos y Ganadores
              </h2>
              <p className="text-xs sm:text-sm text-[#6E5341] mt-1 max-w-2xl">
                Controla los QRs individuales de tus embajadores, mide visitas, registros y ventas atribuidas en tiempo real, e identifica automáticamente a los ganadores del premio.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAddMode('single');
                setAddModalOpen(true);
              }}
              className="inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full bg-[#22150E] px-4 py-2 text-xs font-bold text-[#F4CA73] border border-[#C88A2B]/40 hover:bg-[#3A2418] transition-colors cursor-pointer shadow-sm"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              Agregar embajador
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('batch');
                setAddModalOpen(true);
              }}
              className="inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#E5AE4E] to-[#C88A2B] px-4 py-2 text-xs font-bold text-[#1A0E08] hover:brightness-105 transition-all cursor-pointer shadow-sm"
            >
              <Users className="h-4 w-4 shrink-0" />
              Lote rápido (20)
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={visibleRows.length === 0}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer disabled:opacity-45"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              CSV
            </button>
          </div>
        </div>
      </section>

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

      {/* KPI Overview Bar */}
      <section aria-label="Resumen de embajadores QR" className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        <div className="relative overflow-hidden rounded-[20px] bg-[#FFFDF9] border border-[#E6D5BF] p-3.5 sm:p-4 shadow-xs">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C88A2B] to-[#F4CA73]" />
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6E5341]">
            <Users className="h-4 w-4 text-[#C88A2B] shrink-0" />
            <span className="truncate">Embajadores</span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-[#22150E] tabular-nums">
            {kpis.activePartners}
            <span className="text-sm font-semibold text-[#8C6D58]"> / {kpis.totalPartners}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[#7B5D4A]">Activos ahora</p>
        </div>

        <div className="relative overflow-hidden rounded-[20px] bg-[#FFFDF9] border border-[#E6D5BF] p-3.5 sm:p-4 shadow-xs">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#B84A27] to-[#E5AE4E]" />
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6E5341]">
            <Eye className="h-4 w-4 text-[#B84A27] shrink-0" />
            <span className="truncate">Visitas QR</span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-[#22150E] tabular-nums">
            {kpis.totalVisits.toLocaleString('en-US')}
          </p>
          <p className="mt-0.5 text-[11px] text-[#7B5D4A] tabular-nums">
            {kpis.totalUniqueVisits.toLocaleString('en-US')} únicas
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[20px] bg-[#FFFDF9] border border-[#E6D5BF] p-3.5 sm:p-4 shadow-xs">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#3D6B52] to-emerald-500" />
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6E5341]">
            <TrendingUp className="h-4 w-4 text-[#3D6B52] shrink-0" />
            <span className="truncate">Registros QR</span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-[#22150E] tabular-nums">
            {kpis.totalLeads.toLocaleString('en-US')}
          </p>
          <p className="mt-0.5 text-[11px] text-[#3D6B52] font-semibold tabular-nums">
            {kpis.conversionPct}% conversión
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[20px] bg-[#FFFDF9] border border-[#E6D5BF] p-3.5 sm:p-4 shadow-xs">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-emerald-600" />
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6E5341]">
            <Award className="h-4 w-4 text-sky-700 shrink-0" />
            <span className="truncate">Embudo QR</span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs sm:text-sm font-bold text-[#22150E] tabular-nums">
            <span className="text-rose-700">{kpis.citas} Citas</span>
            <span className="text-[#C8B29A]">·</span>
            <span className="text-sky-700">{kpis.demos} Demos</span>
            <span className="text-[#C8B29A]">·</span>
            <span className="text-emerald-700">{kpis.ordenes} Órd.</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-[#7B5D4A] tabular-nums">
            Ventas: ${kpis.salesTotal.toLocaleString('en-US')}
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#22150E] via-[#341F14] to-[#4E2A16] border border-[#C88A2B]/55 p-3.5 sm:p-4 text-[#FFFDF9] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F4CA73]">
            <Crown className="h-4 w-4 shrink-0" />
            <span className="truncate">Ganadores</span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {kpis.winnersCount}
            {prizeRule.maxWinners > 0 && (
              <span className="text-sm font-semibold text-[#E8D5BE]"> / Top {prizeRule.maxWinners}</span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-[#E8D5BE] truncate">
            Meta: {prizeRule.targetCount} {metricInfo.unit}
          </p>
        </div>
      </section>

      {/* Prize Rules Card (Collapsible) */}
      <section className="rounded-[22px] bg-[#FFFDF9] border border-[#E6D5BF] shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#FAF1E4]/85 via-[#FFFDF9] to-[#FAF1E4]/70">
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

          <button
            type="button"
            onClick={() => setRulePanelOpen((prev) => !prev)}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-[#DFCBB3] bg-white px-4 py-1.5 text-xs font-bold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer shrink-0"
          >
            {rulePanelOpen ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ocultar reglas
              </>
            ) : (
              <>
                <Settings2 className="h-3.5 w-3.5 text-[#C88A2B]" />
                Configurar premio
              </>
            )}
          </button>
        </div>

        <AnimatePresence>
          {rulePanelOpen && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleSaveRuleSubmit}
              className="overflow-hidden border-t border-[#EFE3D2]"
            >
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
                      className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
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
                      className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
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
                      className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-sm font-mono font-bold text-[#22150E] tabular-nums focus:bg-white focus:border-[#C88A2B] focus:outline-none"
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
                      className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-sm font-mono font-bold text-[#22150E] tabular-nums focus:bg-white focus:border-[#C88A2B] focus:outline-none"
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
                          className="w-full min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-sm font-mono font-bold text-[#22150E] tabular-nums"
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
                          className="w-full min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-sm font-mono font-bold text-[#22150E] tabular-nums"
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
                          className="w-full min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-sm font-mono font-bold text-[#22150E] tabular-nums"
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
                          className="w-full min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-sm font-mono font-bold text-[#22150E] tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRuleDraft(prizeRule);
                      setRulePanelOpen(false);
                    }}
                    className="min-h-[40px] rounded-full border border-[#DFCBB3] px-4 py-1.5 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF1E4] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingRule}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#22150E] px-5 py-1.5 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingRule ? 'Guardando...' : 'Guardar reglas del premio'}
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      {/* Top 3 Winners Podium */}
      {podiumRows.length > 0 && (
        <section aria-label="Podio Top 3 Embajadores" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E] flex items-center gap-2">
              <Crown className="h-5 w-5 text-[#C88A2B]" />
              Podio de Líderes · Top {podiumRows.length}
            </h3>
            <span className="text-xs font-semibold text-[#7B5D4A]">
              Ordenado por {metricInfo.label.toLowerCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
            {podiumRows.map((row) => {
              const isFirst = row.rank === 1;
              const isSecond = row.rank === 2;
              return (
                <motion.div
                  key={row.partner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`relative overflow-hidden rounded-[22px] border p-4 sm:p-5 flex flex-col justify-between transition-all ${
                    isFirst
                      ? 'bg-gradient-to-b from-[#24150D] via-[#1D110A] to-[#130A06] border-[#C88A2B]/70 text-[#FFFDF9] shadow-[0_18px_38px_-14px_rgba(34,21,14,0.48)]'
                      : isSecond
                        ? 'bg-gradient-to-b from-[#FFFDF9] to-[#FAF1E4] border-[#D8BE99] text-[#22150E] shadow-sm'
                        : 'bg-gradient-to-b from-[#FFFDF9] to-[#F8EEE1] border-[#E6D5BF] text-[#22150E] shadow-xs'
                  }`}
                >
                  {isFirst && (
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#F4CA73]/18 blur-2xl" />
                  )}
                  <div className="relative space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
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

                    <div>
                      <h4
                        className={`font-serif text-lg font-bold truncate ${
                          isFirst ? 'text-white' : 'text-[#22150E]'
                        }`}
                      >
                        {row.partner.name}
                      </h4>
                      <span
                        className={`inline-block mt-0.5 font-mono text-[11px] font-bold tracking-wide ${
                          isFirst ? 'text-[#F4CA73]' : 'text-[#9A6315]'
                        }`}
                      >
                        ?ref={row.partner.code}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div
                        className={`rounded-xl px-2.5 py-2 text-center ${
                          isFirst ? 'bg-white/8 border border-white/10' : 'bg-white border border-[#EFE3D2]'
                        }`}
                      >
                        <span
                          className={`block text-[10px] font-semibold ${
                            isFirst ? 'text-[#E8D5BE]' : 'text-[#8A6D5B]'
                          }`}
                        >
                          {metricInfo.short}
                        </span>
                        <span
                          className={`block text-lg font-bold tabular-nums ${
                            isFirst ? 'text-[#F4CA73]' : 'text-[#22150E]'
                          }`}
                        >
                          {row.metricValue}
                        </span>
                      </div>
                      <div
                        className={`rounded-xl px-2.5 py-2 text-center ${
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
                          className={`block text-lg font-bold tabular-nums ${
                            isFirst ? 'text-white' : 'text-[#22150E]'
                          }`}
                        >
                          {row.visits}
                        </span>
                      </div>
                      <div
                        className={`rounded-xl px-2.5 py-2 text-center ${
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
                          className={`block text-lg font-bold tabular-nums ${
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

                  <div className="relative mt-4 pt-3 border-t border-current/10 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQrModal(row.partner)}
                      className={`flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                        isFirst
                          ? 'bg-[#F4CA73] text-[#1A0E08] hover:brightness-105'
                          : 'bg-[#22150E] text-[#FAF3E8] hover:bg-[#3A2418]'
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
      <section className="rounded-[24px] sm:rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-3.5 sm:p-6 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)] space-y-4">
        {/* Search, Filter Pills & Sort */}
        <div className="flex flex-col gap-3 pb-4 border-b border-[#EFE3D2]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9B816E]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar embajador por nombre, código o teléfono..."
                className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] py-2.5 pl-10 pr-4 text-sm text-[#22150E] placeholder:text-[#9D8370] focus:border-[#C88A2B] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Filter className="h-4 w-4 text-[#8A6D5B] shrink-0" />
              <label htmlFor="referrals-sort-select" className="text-xs font-semibold text-[#6E5341] whitespace-nowrap">
                Ordenar:
              </label>
              <select
                id="referrals-sort-select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-1.5 text-xs font-semibold text-[#22150E] focus:border-[#C88A2B] focus:bg-white focus:outline-none"
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
                      ? 'bg-[#B84A27] text-white shadow-sm'
                      : 'bg-[#FAF1E4] text-[#6E5341] hover:bg-[#F0E1CC]'
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
              Crea tus primeros embajadores uno por uno o genera un lote de 20 códigos QR listos para repartir en segundos.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAddMode('batch');
                  setAddModalOpen(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#E5AE4E] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow hover:brightness-105 cursor-pointer"
              >
                <Users className="h-4 w-4" />
                Generar 20 embajadores (EMB-01 a EMB-20)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMode('single');
                  setAddModalOpen(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#22150E] px-5 py-2 text-xs font-bold text-[#FAF3E8] hover:bg-[#3A2418] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Crear embajador individual
              </button>
            </div>
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
            {visibleRows.map((row) => {
              const { partner } = row;
              const isExpanded = expandedPartnerId === partner.id;
              const referralUrl = buildReferralUrl(defaultOriginUrl, partner.code);
              const whatsappHref = buildWhatsAppShareUrl(partner, referralUrl);
              const isBusy = busyPartnerId === partner.id;

              return (
                <div
                  key={partner.id}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${
                    !partner.active
                      ? 'border-stone-200 bg-stone-50/70 opacity-80'
                      : row.isWinning
                        ? 'border-emerald-300 bg-gradient-to-r from-[#FFFDF9] via-[#F7FCF9] to-[#F0FAF4] shadow-xs'
                        : 'border-[#E6D5BF] bg-white hover:border-[#C88A2B]/65'
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
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-serif text-sm font-bold tabular-nums border ${
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

                        {/* Secondary meta (phone / notes / last visit) */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#7B5D4A]">
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
                            <span className="truncate max-w-xs italic text-[#8A6D5B]">
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
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 shrink-0">
                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-2.5 py-1.5 text-center">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B]">Visitas QR</span>
                        <span className="block text-sm font-bold text-[#22150E] tabular-nums">
                          {row.visits}
                        </span>
                        <span className="block text-[9.5px] text-[#8A6D5B] tabular-nums">
                          {row.uniqueVisits} ún.
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-2.5 py-1.5 text-center">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B]">Registros</span>
                        <span className="block text-sm font-bold text-[#B84A27] tabular-nums">
                          {row.leadsCount}
                        </span>
                        <span className="block text-[9.5px] text-[#3D6B52] font-semibold tabular-nums">
                          {row.conversionPct}%
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-2.5 py-1.5 text-center">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B]">Citas</span>
                        <span className="block text-sm font-bold text-rose-700 tabular-nums">
                          {row.citasCount}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-2.5 py-1.5 text-center">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B]">Demos</span>
                        <span className="block text-sm font-bold text-sky-700 tabular-nums">
                          {row.demosCount}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-2.5 py-1.5 text-center">
                        <span className="block text-[10px] font-semibold text-[#8A6D5B]">Órdenes</span>
                        <span className="block text-sm font-bold text-emerald-700 tabular-nums">
                          {row.ordenesCount}
                        </span>
                        {row.salesTotal > 0 && (
                          <span className="block text-[9.5px] font-bold text-emerald-800 tabular-nums">
                            ${row.salesTotal.toLocaleString('en-US')}
                          </span>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#E5C17B] bg-[#FFF6E3] px-2.5 py-1.5 text-center">
                        <span className="block text-[10px] font-bold text-[#8A5610]">
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
                  <div className="mt-3 pt-3 border-t border-[#EFE3D2] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openQrModal(partner)}
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1.5 rounded-xl bg-[#22150E] px-3 py-1.5 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] transition-colors cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Tarjeta QR HD
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyLink(partner)}
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-[#FAF3E8] px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
                      >
                        {copiedId === partner.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Enlace copiado
                          </>
                        ) : (
                          <>
                            <Link2 className="h-3.5 w-3.5 text-[#B84A27]" />
                            Copiar enlace
                          </>
                        )}
                      </button>

                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPartnerId((cur) => (cur === partner.id ? null : partner.id))
                        }
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        Ver referidos ({row.leadsCount})
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
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
                        <div className="mt-3 pt-3 border-t border-dashed border-[#DFCBB3] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#594133]">
                              Prospectos traídos por {partner.name} ({row.leadsCount})
                            </span>
                            <span className="font-mono text-[11px] text-[#8A6D5B] truncate max-w-[240px] sm:max-w-md">
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
                                return (
                                  <div
                                    key={lead.id}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-3 py-2 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#22150E] truncate">{lead.name}</p>
                                      <p className="text-[11px] text-[#6E5341] truncate">
                                        <span className="font-mono">{lead.phone}</span> · {lead.giftName || 'Sin regalo'}
                                      </p>
                                      <p className="text-[10px] text-[#8A6D5B]">
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
      </section>

      {/* Modal 1: Add Single or Batch Ambassadors (~20 people) */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-referrers-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/60 backdrop-blur-xs sm:backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto"
            onClick={() => !submittingSingle && !submittingBatch && setAddModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF] p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A6315]">
                    Alta de Embajadores QR
                  </span>
                  <h3 id="add-referrers-title" className="font-serif text-xl font-bold text-[#22150E]">
                    Crear códigos de referencia
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  aria-label="Cerrar modal"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#7B5D4A] hover:bg-[#FAF1E4] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 rounded-2xl bg-[#F3E8D9] p-1 border border-[#E3D0B8]">
                <button
                  type="button"
                  onClick={() => setAddMode('single')}
                  className={`min-h-[40px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    addMode === 'single'
                      ? 'bg-[#FFFDF9] text-[#22150E] shadow-sm'
                      : 'text-[#6E5341] hover:text-[#22150E]'
                  }`}
                >
                  1 Embajador
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('batch')}
                  className={`min-h-[40px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    addMode === 'batch'
                      ? 'bg-[#FFFDF9] text-[#22150E] shadow-sm'
                      : 'text-[#6E5341] hover:text-[#22150E]'
                  }`}
                >
                  Modo Lote (hasta 20+)
                </button>
              </div>

              {addMode === 'single' ? (
                <form onSubmit={handleSingleSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#594133] mb-1">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={singleName}
                        onChange={(e) => setSingleName(e.target.value)}
                        placeholder="Ej. María González"
                        className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#594133] mb-1">
                        Código único (?ref=...)
                      </label>
                      <input
                        type="text"
                        value={singleCode}
                        onChange={(e) => {
                          setSingleCodeTouched(true);
                          setSingleCode(sanitizeReferralCodeDraft(e.target.value));
                        }}
                        onBlur={() => setSingleCode((prev) => normalizeReferralCodeInput(prev))}
                        placeholder="Auto-sugerido (ej. MARIA-01)"
                        maxLength={32}
                        className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 font-mono text-sm font-bold text-[#8C4A19] uppercase focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#594133] mb-1">
                        WhatsApp / Teléfono (opcional)
                      </label>
                      <input
                        type="tel"
                        value={singlePhone}
                        onChange={(e) => setSinglePhone(e.target.value)}
                        placeholder="Ej. +52 55 1234 5678"
                        className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#594133] mb-1">
                        Estilo de tarjeta QR
                      </label>
                      <select
                        value={singleStyleId}
                        onChange={(e) => setSingleStyleId(e.target.value as QrStyleId)}
                        className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
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
                    <label className="block text-xs font-semibold text-[#594133] mb-1">
                      Notas (opcional)
                    </label>
                    <input
                      type="text"
                      value={singleNotes}
                      onChange={(e) => setSingleNotes(e.target.value)}
                      placeholder="Ej. Grupo Norte · Cliente VIP"
                      className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                    />
                  </div>

                  {normalizeReferralCodeInput(singleCode).length >= 2 && (
                    <div className="rounded-xl border border-[#E6D5BF] bg-[#FAF1E4]/70 px-3.5 py-2 text-xs text-[#594133]">
                      <span className="font-semibold">Enlace generado: </span>
                      <span className="font-mono text-[#8C4A19] break-all">
                        {buildReferralUrl(defaultOriginUrl, normalizeReferralCodeInput(singleCode))}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddModalOpen(false)}
                      className="min-h-[44px] rounded-full border border-[#DFCBB3] px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF1E4] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submittingSingle || singleName.trim().length < 2}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-full bg-[#22150E] px-5 py-2 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {submittingSingle ? 'Creando...' : 'Crear embajador'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">
                  {/* Option A: Paste list of names */}
                  <div className="rounded-2xl border border-[#E6D5BF] bg-[#FCF8F2] p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C4A19]">
                        Opción A · Pegar lista de embajadores (1 por línea)
                      </h4>
                      <p className="text-[11.5px] text-[#6E5341] mt-0.5">
                        Formato aceptado: <code className="font-mono">Nombre</code> o{' '}
                        <code className="font-mono">Nombre, Teléfono</code> (máximo 50 por lote).
                      </p>
                    </div>

                    <textarea
                      rows={5}
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      placeholder={'María González, +52 55 1111 2222\nCarlos Ramírez\nSofía Herrera, +52 55 3333 4444'}
                      className="w-full rounded-xl border border-[#DFCBB3] bg-white p-3 text-xs font-mono text-[#22150E] placeholder:text-[#A8917D] focus:border-[#C88A2B] focus:outline-none"
                    />

                    {parsedBatchPreview.length > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-xl border border-[#EFE3D2] bg-white p-2.5 space-y-1">
                        <p className="text-[10.5px] font-bold uppercase text-[#8A6D5B] mb-1">
                          Vista previa ({parsedBatchPreview.length} listos)
                        </p>
                        {parsedBatchPreview.map((item, idx) => (
                          <div
                            key={`${item.code}-${idx}`}
                            className="flex items-center justify-between gap-2 text-xs py-0.5 border-b border-[#FAF1E4] last:border-0"
                          >
                            <span className="font-semibold text-[#22150E] truncate">{item.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {item.phone && (
                                <span className="font-mono text-[10.5px] text-[#7B5D4A]">{item.phone}</span>
                              )}
                              <span className="rounded bg-[#FAF0E0] px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-[#8C4A19]">
                                {item.code}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={parsedBatchPreview.length === 0 || submittingBatch}
                      onClick={handleBatchTextSubmit}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-[#22150E] px-5 py-2 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-45"
                    >
                      <Users className="h-4 w-4" />
                      {submittingBatch
                        ? 'Creando lote...'
                        : `Crear ${parsedBatchPreview.length} embajadores en 1 clic`}
                    </button>
                  </div>

                  {/* Option B: Instant Generator (e.g. 20 ambassadors EMB-01 to EMB-20) */}
                  <div className="rounded-2xl border border-[#E5C17B] bg-gradient-to-br from-[#FFF9ED] to-[#FAF1E4] p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C5510]">
                        Opción B · Generador instantáneo (ej. 20 personas)
                      </h4>
                      <p className="text-[11.5px] text-[#6E5341] mt-0.5">
                        Arma el lote completo al instante y luego edita el nombre real de cada persona cuando entregues su QR.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#594133] mb-1">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={quickCount}
                          onChange={(e) => setQuickCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                          className="w-full min-h-[40px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-sm font-mono font-bold text-[#22150E] tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#594133] mb-1">
                          Prefijo nombre
                        </label>
                        <input
                          type="text"
                          value={quickNamePrefix}
                          onChange={(e) => setQuickNamePrefix(e.target.value)}
                          placeholder="Embajador"
                          className="w-full min-h-[40px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-sm text-[#22150E]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#594133] mb-1">
                          Prefijo código
                        </label>
                        <input
                          type="text"
                          value={quickCodePrefix}
                          onChange={(e) => setQuickCodePrefix(sanitizeReferralCodeDraft(e.target.value, 12))}
                          onBlur={() =>
                            setQuickCodePrefix((prev) => normalizeReferralCodeInput(prev).slice(0, 12))
                          }
                          placeholder="EMB"
                          maxLength={12}
                          className="w-full min-h-[40px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 font-mono text-sm font-bold text-[#8C4A19] uppercase"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={submittingBatch}
                      onClick={handleQuickGenerateBatch}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-5 py-2.5 text-xs font-bold text-[#1A0E08] shadow hover:brightness-105 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      {submittingBatch
                        ? 'Generando...'
                        : `Generar ${quickCount} embajadores (${normalizeReferralCodeInput(quickCodePrefix) || 'EMB'}-01 a ${normalizeReferralCodeInput(quickCodePrefix) || 'EMB'}-${String(quickCount).padStart(2, '0')})`}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/60 backdrop-blur-xs sm:backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto"
            onClick={() => !savingEdit && setEditingPartner(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEdit}
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF] p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9A6315]">
                    Editar Embajador
                  </span>
                  <h3 id="edit-referrer-title" className="font-serif text-xl font-bold text-[#22150E]">
                    {editingPartner.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#7B5D4A] hover:bg-[#FAF1E4] cursor-pointer"
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
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
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
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 font-mono text-sm font-bold text-[#8C4A19] uppercase focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#594133] mb-1">Estilo QR</label>
                    <select
                      value={editStyleId}
                      onChange={(e) => setEditStyleId(e.target.value as QrStyleId)}
                      className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-sm text-[#22150E]"
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
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm text-[#22150E] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#EFE3D2] bg-[#FAF3E8]/60 px-3.5 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-[#22150E]">QR Activo</p>
                    <p className="text-[11px] text-[#7B5D4A]">
                      Si está inactivo, los nuevos escaneos no sumarán visitas.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-5 w-5 accent-[#22150E] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
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
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {resettingVisitsId === editingPartner.id ? 'Reiniciando...' : 'Reiniciar visitas'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="min-h-[44px] rounded-full border border-[#DFCBB3] px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF1E4] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-full bg-[#22150E] px-5 py-2 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] cursor-pointer disabled:opacity-50"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#120804]/75 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto"
            onClick={() => setQrModalPartner(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-[28px] border border-[#C88A2B]/50 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-5 sm:p-6 text-[#FFFDF9] shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F4CA73]">
                    Tarjeta QR HD · Embajador
                  </span>
                  <h3 id="qr-card-modal-title" className="font-serif text-lg sm:text-xl font-bold text-white truncate">
                    {qrModalPartner.name}
                  </h3>
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
              <div className="relative mx-auto w-full max-w-[300px] aspect-[4/5] rounded-2xl overflow-hidden border border-[#F4CA73]/35 bg-[#120A06] flex items-center justify-center shadow-xl">
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
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-[#E8D5BE] truncate">
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
    </div>
  );
};
