import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Trophy,
  Users,
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
} from '../../types/app';
import {
  buildReferralUrl,
  downloadReferralQrPng,
  normalizeReferralCodeInput,
} from './referralQrExport';
import { DEFAULT_PRIZE_RULE } from './ReferralsLeaderboardPanel';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { GlassSpotlightCard } from './GlassSpotlightCard';
import { getRoleTheme } from './roleTheme';

interface QrMetricsAccordionProps {
  referrers: ReferralPartner[];
  qrHistory: QrCodeRecord[];
  leads: Lead[];
  visitLog?: ReferralVisitEvent[];
  isDateFiltered?: boolean;
  ambassadorFilter?: string;
  settings: AppSettings;
  defaultOriginUrl: string;
  onGoToReferrals: () => void;
  onGoToQrStudio: () => void;
}

interface TrackedQrRow {
  key: string;
  partnerId: string | null;
  accountId?: string | null;
  name: string;
  code: string;
  avatarUrl?: string | null;
  emoji?: string | null;
  partnerType?: 'vendedor' | 'embajador';
  ownerVendedorAccountId?: string | null;
  ownerVendedorName?: string | null;
  ownerVendedorTag?: string | null;
  active: boolean;
  styleId: QrStyleId;
  visits: number;
  uniqueVisits: number;
  leads: Lead[];
  leadsCount: number;
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
}

const METRIC_UNIT_LABELS: Record<ReferralMetricKey, { short: string; unit: string }> = {
  leads: { short: 'Registros', unit: 'registros' },
  citas: { short: 'Citas', unit: 'citas' },
  demos: { short: 'Demos', unit: 'demos' },
  ordenes: { short: 'Órdenes', unit: 'órdenes' },
  points: { short: 'Puntaje', unit: 'pts' },
};

const CATEGORY_BADGES: Record<string, { label: string; className: string }> = {
  none: { label: 'Prospecto', className: 'bg-stone-100/90 text-stone-700 border-stone-200' },
  cita: { label: 'Cita', className: 'bg-rose-50/90 text-rose-800 border-rose-200' },
  demo: { label: 'Demo', className: 'bg-sky-50/90 text-sky-800 border-sky-200' },
  orden: { label: 'Orden', className: 'bg-emerald-50/90 text-emerald-800 border-emerald-200' },
};

function sanitizeRule(raw?: Partial<ReferralPrizeRule> | null): ReferralPrizeRule {
  const valid: ReferralMetricKey[] = ['leads', 'citas', 'demos', 'ordenes', 'points'];
  const metric = raw?.metric && valid.includes(raw.metric) ? raw.metric : DEFAULT_PRIZE_RULE.metric;
  const toInt = (v: unknown, fb: number, min = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.round(n)) : fb;
  };
  return {
    prizeName:
      typeof raw?.prizeName === 'string' && raw.prizeName.trim()
        ? raw.prizeName.trim()
        : DEFAULT_PRIZE_RULE.prizeName,
    metric,
    targetCount: toInt(raw?.targetCount, DEFAULT_PRIZE_RULE.targetCount, 1),
    maxWinners: toInt(raw?.maxWinners, DEFAULT_PRIZE_RULE.maxWinners, 0),
    pointsPerLead: toInt(raw?.pointsPerLead, DEFAULT_PRIZE_RULE.pointsPerLead, 0),
    pointsPerCita: toInt(raw?.pointsPerCita, DEFAULT_PRIZE_RULE.pointsPerCita, 0),
    pointsPerDemo: toInt(raw?.pointsPerDemo, DEFAULT_PRIZE_RULE.pointsPerDemo, 0),
    pointsPerOrden: toInt(raw?.pointsPerOrden, DEFAULT_PRIZE_RULE.pointsPerOrden, 0),
  };
}

function formatLeadDate(iso?: string | null): string {
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

export const QrMetricsAccordion: React.FC<QrMetricsAccordionProps> = ({
  referrers,
  qrHistory,
  leads,
  visitLog,
  isDateFiltered = false,
  ambassadorFilter = 'all',
  settings,
  defaultOriginUrl,
  onGoToReferrals,
  onGoToQrStudio,
}) => {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const adminTheme = getRoleTheme('admin');

  const prizeRule = useMemo(
    () => sanitizeRule(settings.referralPrizeRule),
    [settings.referralPrizeRule]
  );

  const trackedRows = useMemo<TrackedQrRow[]>(() => {
    const seenIds = new Set<string>();
    const seenCodes = new Set<string>();

    const entries: Array<{
      key: string;
      partnerId: string | null;
      accountId?: string | null;
      name: string;
      code: string;
      avatarUrl?: string | null;
      emoji?: string | null;
      partnerType?: 'vendedor' | 'embajador';
      ownerVendedorAccountId?: string | null;
      ownerVendedorName?: string | null;
      ownerVendedorTag?: string | null;
      active: boolean;
      styleId: QrStyleId;
      visits: number;
      uniqueVisits: number;
    }> = [];

    for (const partner of referrers) {
      const codeUpper = normalizeReferralCodeInput(partner.code) || partner.code.trim().toUpperCase();
      seenIds.add(partner.id);
      if (codeUpper) seenCodes.add(codeUpper);
      entries.push({
        key: `partner:${partner.id}`,
        partnerId: partner.id,
        accountId: partner.accountId ?? null,
        name: partner.name,
        code: codeUpper,
        avatarUrl: partner.avatarUrl ?? null,
        emoji: partner.emoji ?? null,
        partnerType: partner.partnerType === 'embajador' ? 'embajador' : 'vendedor',
        ownerVendedorAccountId: partner.ownerVendedorAccountId ?? null,
        ownerVendedorName: partner.ownerVendedorName ?? null,
        ownerVendedorTag: partner.ownerVendedorTag ?? null,
        active: partner.active,
        styleId: partner.qrStyleId || 'classic-gold',
        visits: Math.max(0, Number(partner.visitsCount) || 0),
        uniqueVisits: Math.max(0, Number(partner.uniqueVisitsCount) || 0),
      });
    }

    // Deduplicate any orphan qrHistory entries that have a referralCode not in referrers
    for (const qr of qrHistory) {
      const codeUpper = qr.referralCode ? normalizeReferralCodeInput(qr.referralCode) : '';
      if (!codeUpper) continue;
      if (qr.referrerId && seenIds.has(qr.referrerId)) continue;
      if (seenCodes.has(codeUpper)) continue;
      seenCodes.add(codeUpper);
      entries.push({
        key: `qr:${qr.id}`,
        partnerId: qr.referrerId || null,
        accountId: qr.accountId ?? null,
        name: qr.name,
        code: codeUpper,
        partnerType: 'vendedor',
        active: true,
        styleId: qr.styleId || 'classic-gold',
        visits: 0,
        uniqueVisits: 0,
      });
    }

    const filteredEntries = entries.filter((entry) => {
      if (ambassadorFilter === 'organic') return false;
      if (ambassadorFilter.startsWith('tag:')) {
        const targetTag = ambassadorFilter.slice('tag:'.length).trim().toUpperCase();
        const targetEntry = entries.find((e) => e.code === targetTag);
        if (targetEntry?.partnerType === 'embajador') {
          return entry.code === targetTag;
        }
        if (entry.code === targetTag) return true;
        if (entry.partnerType === 'embajador') {
          const ownerTagUpper = (entry.ownerVendedorTag || '').trim().toUpperCase();
          if (ownerTagUpper && ownerTagUpper === targetTag) return true;
          if (
            targetEntry?.accountId &&
            entry.ownerVendedorAccountId &&
            entry.ownerVendedorAccountId === targetEntry.accountId
          ) {
            return true;
          }
        }
        return false;
      }
      return true;
    });

    const useVisitLog = Array.isArray(visitLog) && (isDateFiltered || visitLog.length > 0);

    const computed = filteredEntries.map((entry) => {
      const matchedLeads = leads.filter(
        (lead) =>
          (entry.partnerId && lead.referrerId === entry.partnerId) ||
          (lead.referralCode && lead.referralCode.trim().toUpperCase() === entry.code)
      );

      let visits = entry.visits;
      let uniqueVisits = entry.uniqueVisits;
      if (useVisitLog && visitLog) {
        const matchedVisits = visitLog.filter(
          (ev) =>
            (entry.partnerId && ev.referrerId === entry.partnerId) ||
            (ev.referralCode && ev.referralCode.trim().toUpperCase() === entry.code)
        );
        if (isDateFiltered || matchedVisits.length > 0) {
          visits = matchedVisits.length;
          uniqueVisits = new Set(matchedVisits.map((ev) => ev.visitorId)).size;
        }
      }

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
        ...entry,
        visits,
        uniqueVisits,
        leads: matchedLeads,
        leadsCount,
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
      };
    });

    computed.sort((a, b) => {
      if (b.metricValue !== a.metricValue) return b.metricValue - a.metricValue;
      if (b.leadsCount !== a.leadsCount) return b.leadsCount - a.leadsCount;
      if (b.visits !== a.visits) return b.visits - a.visits;
      return a.name.localeCompare(b.name, 'es');
    });

    let winners = 0;
    return computed.map((row) => {
      const isWinning =
        row.reachedTarget &&
        row.metricValue > 0 &&
        (prizeRule.maxWinners === 0 || winners < prizeRule.maxWinners);
      if (isWinning) winners += 1;
      return { ...row, isWinning };
    });
  }, [referrers, qrHistory, leads, visitLog, isDateFiltered, ambassadorFilter, prizeRule]);

  const activeCount = useMemo(
    () => trackedRows.filter((r) => r.active).length,
    [trackedRows]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trackedRows;
    return trackedRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.ownerVendedorName || '').toLowerCase().includes(q) ||
        (r.ownerVendedorTag || '').toLowerCase().includes(q)
    );
  }, [trackedRows, search]);

  const handleCopy = async (row: TrackedQrRow) => {
    const url = buildReferralUrl(defaultOriginUrl, row.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(row.key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === row.key ? null : cur)), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadPng = async (row: TrackedQrRow) => {
    if (downloadingKey) return;
    setDownloadingKey(row.key);
    try {
      await downloadReferralQrPng({
        partnerName: row.name,
        code: row.code,
        referralUrl: buildReferralUrl(defaultOriginUrl, row.code),
        avatarUrl: row.avatarUrl ?? null,
        emoji: row.emoji ?? null,
        styleId: row.styleId,
      });
    } catch {
      // Ignore export error silently here
    } finally {
      setDownloadingKey(null);
    }
  };

  const metricInfo = METRIC_UNIT_LABELS[prizeRule.metric];

  return (
    <GlassSpotlightCard
      as="section"
      role="admin"
      aria-label="Métricas por QR creado"
      className="rounded-[24px] sm:rounded-[26px] border border-[#8B0018]/20 p-3 sm:p-6 shadow-[0_16px_38px_-18px_rgba(139,0,24,0.18)] space-y-3.5 sm:space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-[#8B0018]/14">
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
          <div
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl text-[#FEF3C7] border border-white/25 shadow-sm"
            style={{ background: adminTheme.heroGradient }}
          >
            <QrCode className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="font-serif text-base sm:text-xl font-bold text-[#1F1714] leading-snug">
                Métricas por QR creado
              </h2>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${adminTheme.badgeClass}`}>
                {activeCount} {activeCount === 1 ? 'QR activo' : 'QRs activos'}
              </span>
            </div>
            <p className="text-xs text-[#6B5447] mt-0.5 leading-relaxed">
              Haz clic en cualquier QR para desplegar sus visitas, conversiones y los prospectos que ha traído.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={onGoToReferrals}
            className="inline-flex min-h-[40px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full border border-[#8B0018]/22 bg-white/75 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-[#4B2E2B] hover:bg-white transition-colors cursor-pointer"
          >
            <Trophy className="h-3.5 w-3.5 shrink-0 text-[#C88A2B]" />
            <span>Ir a Ranking y Premios</span>
          </button>
          <button
            type="button"
            onClick={onGoToQrStudio}
            className={`inline-flex min-h-[40px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all hover:brightness-110 cursor-pointer ${adminTheme.activePillClass}`}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Crear nuevo QR</span>
          </button>
        </div>
      </div>

      {/* Quick Search when > 6 QRs */}
      {trackedRows.length > 6 && (
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B0018]/65" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar QR por nombre o código..."
            className="w-full min-h-[42px] rounded-xl border border-[#8B0018]/22 bg-white/72 backdrop-blur-md py-2 pl-10 pr-4 text-base sm:text-sm text-[#1F1714] placeholder:text-[#8A7162] focus:border-[#8B0018] focus:bg-white focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Content */}
      {trackedRows.length === 0 ? (
        <div className="dsb-glass-subtle rounded-2xl border border-dashed border-[#8B0018]/28 px-5 py-8 text-center space-y-2.5">
          <p className="font-serif text-base font-bold text-[#1F1714]">
            Aún no hay QRs rastreados en Métricas
          </p>
          <p className="text-xs text-[#6B5447] max-w-md mx-auto">
            Crea un código QR en Estudio QR y aparecerá aquí automáticamente con su nombre, visitas y lista de prospectos registrados.
          </p>
          <button
            type="button"
            onClick={onGoToQrStudio}
            className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold hover:brightness-110 cursor-pointer ${adminTheme.activePillClass}`}
          >
            <QrCode className="h-4 w-4" />
            Crear primer QR en Estudio QR
          </button>
        </div>
      ) : filteredRows.length === 0 ? (
        <p className="dsb-glass-subtle rounded-2xl border border-dashed border-[#8B0018]/25 py-8 text-center text-xs text-[#6B5447]">
          No se encontró ningún QR que coincida con “{search}”.
        </p>
      ) : (
        <div className="space-y-2.5">
          {filteredRows.map((row) => {
            const isExpanded = expandedKey === row.key;
            const referralUrl = buildReferralUrl(defaultOriginUrl, row.code);

            return (
              <div
                key={row.key}
                data-dsb-card={isExpanded ? 'default' : row.isWinning ? 'winning' : undefined}
                className={`overflow-hidden rounded-2xl border backdrop-blur-md transition-all ${
                  isExpanded
                    ? 'border-[#8B0018]/45 bg-white/82 shadow-[0_12px_28px_-12px_rgba(139,0,24,0.22)]'
                    : row.isWinning
                      ? 'border-emerald-300/85 bg-gradient-to-r from-white/75 to-emerald-50/65 hover:border-emerald-400'
                      : 'dsb-glass-subtle border-white/65 hover:bg-white/78 hover:border-[#8B0018]/30'
                }`}
              >
                {/* Clickable QR Row Header */}
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedKey((cur) => (cur === row.key ? null : row.key))}
                  className="w-full min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 w-full sm:w-auto">
                    <AmbassadorAvatar
                      name={row.name}
                      avatarUrl={row.avatarUrl}
                      emoji={row.emoji}
                      size="sm"
                      ring={row.isWinning ? 'gold' : 'subtle'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="font-serif text-sm sm:text-base font-bold text-[#1F1714] max-w-full truncate">
                          {row.name}
                        </span>
                        <span className="max-w-full truncate rounded-md border border-[#8B0018]/22 bg-[#FEE2E2]/55 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-[#8B0018]">
                          ?ref={row.code}
                        </span>
                        {row.partnerType === 'embajador' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#C8A85B]/55 bg-[#FFF4DC] px-2 py-0.5 text-[10px] font-bold text-[#7A4610]">
                            <Sparkles className="h-2.5 w-2.5 shrink-0 text-[#C88A2B]" />
                            <span>Embajador</span>
                          </span>
                        )}
                        {row.partnerType === 'embajador' &&
                          (row.ownerVendedorName || row.ownerVendedorTag) && (
                            <span className="max-w-full truncate rounded-full border border-[#3F5432]/25 bg-[#E9F0E2] px-2 py-0.5 text-[10px] font-semibold text-[#2B3A24]">
                              de {row.ownerVendedorName || row.ownerVendedorTag}
                            </span>
                          )}
                        {!row.active && (
                          <span className="rounded-full bg-stone-200/90 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                            Inactivo
                          </span>
                        )}
                        {row.isWinning && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                            🏆 Ganando
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Inline Pills + Chevron */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#8B0018]/10 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/75 px-2 sm:px-2.5 py-0.5 text-[11px] font-semibold text-[#4B362A] tabular-nums">
                        <Eye className="h-3 w-3 shrink-0 text-[#C88A2B]" />
                        {row.visits} {row.visits === 1 ? 'visita' : 'visitas'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#8B0018]/22 bg-[#FEE2E2]/65 px-2 sm:px-2.5 py-0.5 text-[11px] font-bold text-[#8B0018] tabular-nums">
                        <Users className="h-3 w-3 shrink-0 text-[#B91C1C]" />
                        {row.leadsCount} {row.leadsCount === 1 ? 'prospecto' : 'prospectos'}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/85 px-2 sm:px-2.5 py-0.5 text-[11px] font-bold text-[#2F684B] tabular-nums">
                        {row.conversionPct}%
                      </span>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#7B6253] transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-[#8B0018]' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded Metrics & Prospects Drawer */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden border-t border-[#8B0018]/14"
                    >
                      <div className="p-3 sm:p-4 bg-white/55 backdrop-blur-md space-y-3.5 sm:space-y-4">
                        {/* Metric Tiles */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          <div className="dsb-glass-subtle min-w-0 rounded-xl p-2 sm:p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#7B6253]">Visitas QR</span>
                            <span className="block text-base font-bold text-[#1F1714] tabular-nums">
                              {row.visits}
                            </span>
                            <span className="block text-[10px] text-[#7B6253] tabular-nums">
                              {row.uniqueVisits} únicas
                            </span>
                          </div>
                          <div className="dsb-glass-subtle min-w-0 rounded-xl p-2 sm:p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#7B6253]">Prospectos</span>
                            <span className="block text-base font-bold text-[#8B0018] tabular-nums">
                              {row.leadsCount}
                            </span>
                          </div>
                          <div className="dsb-glass-subtle min-w-0 rounded-xl p-2 sm:p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#7B6253]">Conversión</span>
                            <span className="block text-base font-bold text-[#2F684B] tabular-nums">
                              {row.conversionPct}%
                            </span>
                          </div>
                          <div className="dsb-glass-subtle min-w-0 rounded-xl p-2 sm:p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#7B6253]">Citas</span>
                            <span className="block text-base font-bold text-rose-700 tabular-nums">
                              {row.citasCount}
                            </span>
                          </div>
                          <div className="dsb-glass-subtle min-w-0 rounded-xl p-2 sm:p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#7B6253]">Demos</span>
                            <span className="block text-base font-bold text-sky-700 tabular-nums">
                              {row.demosCount}
                            </span>
                          </div>
                          <div className="dsb-glass-subtle min-w-0 rounded-xl p-2 sm:p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#7B6253]">Órdenes</span>
                            <span className="block text-base font-bold text-emerald-700 tabular-nums">
                              {row.ordenesCount}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-2 lg:col-span-1 min-w-0 rounded-xl border border-[#C8A85B]/60 bg-[#FFF8E7]/85 p-2 sm:p-2.5 text-center">
                            <span className="block text-[10px] font-bold text-[#8A5610]">Ventas ($)</span>
                            <span className="block text-base font-bold text-[#1F1714] tabular-nums break-words">
                              ${row.salesTotal.toLocaleString('en-US')}
                            </span>
                          </div>
                        </div>

                        {/* Prize Progress Bar + Quick Copy / Download Actions */}
                        <div className="dsb-glass-subtle flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 rounded-xl px-3 sm:px-3.5 py-2.5">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                              <span className="font-bold text-[#4B362A] min-w-0 truncate">
                                Meta · {prizeRule.prizeName}
                              </span>
                              <span className="font-mono text-[11px] font-bold text-[#8B0018] tabular-nums shrink-0">
                                {row.metricValue} / {prizeRule.targetCount} {metricInfo.unit} ({row.progressPct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[#8B0018]/12">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${row.progressPct}%`,
                                  background: row.isWinning
                                    ? 'linear-gradient(90deg, #2F684B 0%, #10B981 100%)'
                                    : adminTheme.progressGradient,
                                }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopy(row)}
                              className="inline-flex min-h-[40px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-[#8B0018]/22 bg-white/85 px-2.5 sm:px-3 py-1.5 text-[11.5px] sm:text-xs font-semibold text-[#4B2E2B] hover:bg-white transition-colors cursor-pointer"
                            >
                              {copiedKey === row.key ? (
                                <>
                                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  <span className="truncate">Enlace copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 shrink-0 text-[#8B0018]" />
                                  <span className="truncate">Copiar enlace</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={downloadingKey === row.key}
                              onClick={() => handleDownloadPng(row)}
                              className={`inline-flex min-h-[40px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-[11.5px] sm:text-xs font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 ${adminTheme.activePillClass}`}
                            >
                              <Download className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {downloadingKey === row.key ? 'Generando...' : 'Descargar QR'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Prospects Brought by this QR */}
                        <div className="space-y-2 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-1 sm:gap-2 text-xs min-w-0">
                            <span className="font-bold text-[#1F1714]">
                              Prospectos traídos por este QR ({row.leadsCount})
                            </span>
                            <span className="font-mono text-[11px] text-[#7B6253] truncate max-w-full sm:max-w-sm block">
                              {referralUrl}
                            </span>
                          </div>

                          {row.leads.length === 0 ? (
                            <div className="dsb-glass-subtle rounded-xl border border-dashed border-[#8B0018]/22 px-4 py-5 text-center space-y-1">
                              <p className="text-xs font-semibold text-[#4B362A]">
                                Aún no hay prospectos registrados con este QR
                              </p>
                              <p className="text-[11px] text-[#7B6253]">
                                Comparte el enlace o descarga el QR PNG para empezar a recibir registros atribuidos a {row.name}.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {row.leads.map((lead) => {
                                const badge = CATEGORY_BADGES[lead.category] || CATEGORY_BADGES.none;
                                return (
                                  <div
                                    key={lead.id}
                                    className="dsb-glass-subtle min-w-0 max-w-full overflow-hidden flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs hover:bg-white/80 transition-colors"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-[#1F1714] truncate">{lead.name}</p>
                                      <p className="text-[11px] text-[#594336] truncate">
                                        <span className="font-mono">{lead.phone}</span> ·{' '}
                                        {lead.giftName || 'Sin regalo'}
                                      </p>
                                      <p className="text-[10px] text-[#7B6253] truncate">
                                        Orden {lead.claimCode} · {formatLeadDate(lead.createdAt)}
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
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </GlassSpotlightCard>
  );
};
