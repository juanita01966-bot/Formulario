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
} from '../../types/app';
import {
  buildReferralUrl,
  downloadReferralQrPng,
  normalizeReferralCodeInput,
} from './referralQrExport';
import { DEFAULT_PRIZE_RULE } from './ReferralsLeaderboardPanel';

interface QrMetricsAccordionProps {
  referrers: ReferralPartner[];
  qrHistory: QrCodeRecord[];
  leads: Lead[];
  settings: AppSettings;
  defaultOriginUrl: string;
  onGoToReferrals: () => void;
  onGoToQrStudio: () => void;
}

interface TrackedQrRow {
  key: string;
  partnerId: string | null;
  name: string;
  code: string;
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
  none: { label: 'Prospecto', className: 'bg-stone-100 text-stone-700 border-stone-200' },
  cita: { label: 'Cita', className: 'bg-rose-50 text-rose-800 border-rose-200' },
  demo: { label: 'Demo', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  orden: { label: 'Orden', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
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
  settings,
  defaultOriginUrl,
  onGoToReferrals,
  onGoToQrStudio,
}) => {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

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
      name: string;
      code: string;
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
        name: partner.name,
        code: codeUpper,
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
        name: qr.name,
        code: codeUpper,
        active: true,
        styleId: qr.styleId || 'classic-gold',
        visits: 0,
        uniqueVisits: 0,
      });
    }

    const computed = entries.map((entry) => {
      const matchedLeads = leads.filter(
        (lead) =>
          (entry.partnerId && lead.referrerId === entry.partnerId) ||
          (lead.referralCode && lead.referralCode.trim().toUpperCase() === entry.code)
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

      const conversionPct =
        entry.visits > 0 ? Math.round((leadsCount / entry.visits) * 1000) / 10 : 0;

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
  }, [referrers, qrHistory, leads, prizeRule]);

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
        r.code.toLowerCase().includes(q)
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
    <section
      aria-label="Métricas por QR creado"
      className="rounded-[24px] sm:rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-3.5 sm:p-6 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)] space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-[#EFE3D2]">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#22150E] to-[#3B2418] text-[#F4CA73] border border-[#C88A2B]/40 shadow-xs">
            <QrCode className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">
                Métricas por QR creado
              </h2>
              <span className="inline-flex items-center rounded-full bg-[#FAF1E4] border border-[#DFCBB3] px-2.5 py-0.5 text-[11px] font-bold text-[#7A4610] tabular-nums">
                {activeCount} {activeCount === 1 ? 'QR activo' : 'QRs activos'}
              </span>
            </div>
            <p className="text-xs text-[#7B5D4A] mt-0.5">
              Haz clic en cualquier QR para desplegar sus visitas, conversiones y los prospectos que ha traído.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onGoToReferrals}
            className="inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FAF1E4] px-3.5 py-1.5 text-xs font-bold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
          >
            <Trophy className="h-3.5 w-3.5 text-[#C88A2B]" />
            Ir a Ranking y Premios
          </button>
          <button
            type="button"
            onClick={onGoToQrStudio}
            className="inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full bg-[#22150E] px-4 py-1.5 text-xs font-bold text-[#F4CA73] border border-[#C88A2B]/40 hover:bg-[#3A2418] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear nuevo QR
          </button>
        </div>
      </div>

      {/* Quick Search when > 6 QRs */}
      {trackedRows.length > 6 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9B816E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar QR por nombre o código..."
            className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] py-2 pl-10 pr-4 text-sm text-[#22150E] placeholder:text-[#9D8370] focus:border-[#C88A2B] focus:bg-white focus:outline-none"
          />
        </div>
      )}

      {/* Content */}
      {trackedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DEC9AE] bg-[#FAF1E4]/45 px-5 py-8 text-center space-y-2.5">
          <p className="font-serif text-base font-bold text-[#22150E]">
            Aún no hay QRs rastreados en Métricas
          </p>
          <p className="text-xs text-[#7B5D4A] max-w-md mx-auto">
            Crea un código QR en Estudio QR y aparecerá aquí automáticamente con su nombre, visitas y lista de prospectos registrados.
          </p>
          <button
            type="button"
            onClick={onGoToQrStudio}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#E5AE4E] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow-xs hover:brightness-105 cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            Crear primer QR en Estudio QR
          </button>
        </div>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#DEC9AE] bg-[#FAF1E4]/35 py-8 text-center text-xs text-[#7B5D4A]">
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
                className={`overflow-hidden rounded-2xl border transition-all ${
                  isExpanded
                    ? 'border-[#C88A2B] bg-[#FFFDF9] shadow-md'
                    : row.isWinning
                      ? 'border-emerald-300/90 bg-gradient-to-r from-[#FFFDF9] to-[#F3FBF6] hover:border-emerald-400'
                      : 'border-[#E6D5BF] bg-[#FCF8F2]/60 hover:bg-white hover:border-[#C88A2B]/65'
                }`}
              >
                {/* Clickable QR Row Header */}
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedKey((cur) => (cur === row.key ? null : row.key))}
                  className="w-full px-3.5 sm:px-4 py-3 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        row.isWinning
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-[#FAF1E4] border-[#E6D5BF] text-[#8C4A19]'
                      }`}
                    >
                      <QrCode className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-serif text-sm sm:text-base font-bold text-[#22150E] truncate">
                          {row.name}
                        </span>
                        <span className="rounded-md border border-[#E6C99E] bg-[#FAF0E0] px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-[#8C4A19]">
                          ?ref={row.code}
                        </span>
                        {!row.active && (
                          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                            Inactivo
                          </span>
                        )}
                        {row.isWinning && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                            🏆 Ganando
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Inline Pills + Chevron */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#E6D5BF] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#594133] tabular-nums">
                        <Eye className="h-3 w-3 text-[#C88A2B]" />
                        {row.visits} {row.visits === 1 ? 'visita' : 'visitas'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#E8C5B4] bg-[#FCEEE7] px-2.5 py-0.5 text-[11px] font-bold text-[#8C3318] tabular-nums">
                        <Users className="h-3 w-3 text-[#B84A27]" />
                        {row.leadsCount} {row.leadsCount === 1 ? 'prospecto' : 'prospectos'}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#3D6B52] tabular-nums">
                        {row.conversionPct}%
                      </span>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#8A6D5B] transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-[#22150E]' : ''
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
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden border-t border-[#EFE3D2]"
                    >
                      <div className="p-3.5 sm:p-4 bg-[#FFFDF9] space-y-4">
                        {/* Metric Tiles */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#8A6D5B]">Visitas QR</span>
                            <span className="block text-base font-bold text-[#22150E] tabular-nums">
                              {row.visits}
                            </span>
                            <span className="block text-[10px] text-[#8A6D5B] tabular-nums">
                              {row.uniqueVisits} únicas
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#8A6D5B]">Prospectos</span>
                            <span className="block text-base font-bold text-[#B84A27] tabular-nums">
                              {row.leadsCount}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#8A6D5B]">Conversión</span>
                            <span className="block text-base font-bold text-[#3D6B52] tabular-nums">
                              {row.conversionPct}%
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#8A6D5B]">Citas</span>
                            <span className="block text-base font-bold text-rose-700 tabular-nums">
                              {row.citasCount}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#8A6D5B]">Demos</span>
                            <span className="block text-base font-bold text-sky-700 tabular-nums">
                              {row.demosCount}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] p-2.5 text-center">
                            <span className="block text-[10px] font-semibold text-[#8A6D5B]">Órdenes</span>
                            <span className="block text-base font-bold text-emerald-700 tabular-nums">
                              {row.ordenesCount}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-2 lg:col-span-1 rounded-xl border border-[#E5C17B] bg-[#FFF6E3] p-2.5 text-center">
                            <span className="block text-[10px] font-bold text-[#8A5610]">Ventas ($)</span>
                            <span className="block text-base font-bold text-[#22150E] tabular-nums">
                              ${row.salesTotal.toLocaleString('en-US')}
                            </span>
                          </div>
                        </div>

                        {/* Prize Progress Bar + Quick Copy / Download Actions */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-[#EFE3D2] bg-[#FAF1E4]/55 px-3.5 py-2.5">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-[#594133] truncate">
                                Meta · {prizeRule.prizeName}
                              </span>
                              <span className="font-mono text-[11px] font-bold text-[#8C4A19] tabular-nums shrink-0">
                                {row.metricValue} / {prizeRule.targetCount} {metricInfo.unit} ({row.progressPct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8D8C3]">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  row.isWinning
                                    ? 'bg-gradient-to-r from-[#3D6B52] to-emerald-500'
                                    : 'bg-gradient-to-r from-[#C88A2B] to-[#F4CA73]'
                                }`}
                                style={{ width: `${row.progressPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopy(row)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-white px-3 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#FAF1E4] transition-colors cursor-pointer"
                            >
                              {copiedKey === row.key ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  Enlace copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 text-[#B84A27]" />
                                  Copiar enlace
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={downloadingKey === row.key}
                              onClick={() => handleDownloadPng(row)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#22150E] px-3 py-1.5 text-xs font-bold text-[#F4CA73] hover:bg-[#3A2418] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {downloadingKey === row.key ? 'Generando...' : 'Descargar QR PNG'}
                            </button>
                          </div>
                        </div>

                        {/* Prospects Brought by this QR */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-[#22150E]">
                              Prospectos traídos por este QR ({row.leadsCount})
                            </span>
                            <span className="font-mono text-[11px] text-[#8A6D5B] truncate max-w-full sm:max-w-sm">
                              {referralUrl}
                            </span>
                          </div>

                          {row.leads.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[#DFCBB3] bg-[#FCF8F2] px-4 py-5 text-center space-y-1">
                              <p className="text-xs font-semibold text-[#594133]">
                                Aún no hay prospectos registrados con este QR
                              </p>
                              <p className="text-[11px] text-[#8A6D5B]">
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
                                    className="flex items-center justify-between gap-2.5 rounded-xl border border-[#EFE3D2] bg-[#FCF8F2] px-3 py-2 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#22150E] truncate">{lead.name}</p>
                                      <p className="text-[11px] text-[#6E5341] truncate">
                                        <span className="font-mono">{lead.phone}</span> ·{' '}
                                        {lead.giftName || 'Sin regalo'}
                                      </p>
                                      <p className="text-[10px] text-[#8A6D5B]">
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
    </section>
  );
};
