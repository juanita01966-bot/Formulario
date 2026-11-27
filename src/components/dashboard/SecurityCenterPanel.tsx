import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  PhoneOff,
  Radio,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  Lead,
  ReferralPartner,
  SecurityAlert,
  SecurityAlertCategory,
  SecurityAlertSeverity,
  SecurityAlertStatus,
  UserAccount,
  UserRole,
} from '../../types/app';

interface SecurityCenterPanelProps {
  alerts: SecurityAlert[];
  leads: Lead[];
  accounts: UserAccount[];
  referrers: ReferralPartner[];
  userRole?: UserRole;
  onUpdateAlertStatus: (
    id: string,
    status: SecurityAlertStatus,
    reviewNote?: string
  ) => Promise<void>;
  onBulkAction: (action: 'mark_all_reviewed' | 'clear_resolved') => Promise<void>;
  onJumpToLead?: (leadId: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

type StatusFilter = SecurityAlertStatus | 'all';
type SeverityFilter = SecurityAlertSeverity | 'all';
type CategoryFilter = SecurityAlertCategory | 'all';
type RiskLevel = 'high' | 'medium' | 'low';

const SEVERITY_META: Record<
  SecurityAlertSeverity,
  { label: string; badgeClass: string; railClass: string; order: number }
> = {
  critical: {
    label: 'Crítica',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    railClass: 'bg-rose-500',
    order: 0,
  },
  high: {
    label: 'Alta',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    railClass: 'bg-orange-500',
    order: 1,
  },
  medium: {
    label: 'Media',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    railClass: 'bg-amber-500',
    order: 2,
  },
  info: {
    label: 'Info',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    railClass: 'bg-sky-500',
    order: 3,
  },
};

const CATEGORY_LABELS: Record<SecurityAlertCategory, string> = {
  qr_abuse: 'Abuso QR',
  vendedor: 'Vendedores',
  telemarketing: 'Telemarketing',
  access: 'Acceso / RBAC',
  audit: 'Auditoría',
};

const STATUS_LABELS: Record<SecurityAlertStatus, string> = {
  open: 'Abierta',
  reviewed: 'Revisada',
  dismissed: 'Descartada',
};

const RISK_META: Record<RiskLevel, { label: string; badgeClass: string; rank: number }> = {
  high: {
    label: 'Alto',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    rank: 2,
  },
  medium: {
    label: 'Medio',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    rank: 1,
  },
  low: {
    label: 'Bajo',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rank: 0,
  },
};

function formatAlertTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const diffMs = Date.now() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  let relative = '';
  if (diffMin < 1) relative = 'Hace un momento';
  else if (diffMin < 60) relative = `Hace ${diffMin} min`;
  else if (diffMin < 1440) relative = `Hace ${Math.floor(diffMin / 60)} h`;
  else relative = `Hace ${Math.floor(diffMin / 1440)} d`;

  const exact = dt.toLocaleString('es-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${relative} · ${exact}`;
}

function normalizeKey(value?: string | null): string {
  return (value || '').trim().toUpperCase();
}

const ALERTS_PAGE_SIZE = 15;

export const SecurityCenterPanel: React.FC<SecurityCenterPanelProps> = ({
  alerts,
  leads,
  accounts,
  referrers,
  onUpdateAlertStatus,
  onBulkAction,
  onJumpToLead,
  onBusyChange,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'mark_all_reviewed' | 'clear_resolved' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // ---------------------------------------------------------------------------
  // KPI Metrics & Counts
  // ---------------------------------------------------------------------------
  const counts = useMemo(() => {
    let open = 0;
    let reviewed = 0;
    let dismissed = 0;
    let criticalOrHighOpen = 0;
    let criticalOpen = 0;
    let duplicateQrTotal = 0;
    let duplicateQrOpen = 0;
    let leakageAlertsTotal = 0;
    let leakageAlertsOpen = 0;

    for (const alert of alerts) {
      if (alert.status === 'open') {
        open += 1;
        if (alert.severity === 'critical' || alert.severity === 'high') {
          criticalOrHighOpen += 1;
        }
        if (alert.severity === 'critical') {
          criticalOpen += 1;
        }
      } else if (alert.status === 'reviewed') {
        reviewed += 1;
      } else if (alert.status === 'dismissed') {
        dismissed += 1;
      }

      if (alert.code === 'duplicate_phone_attempt') {
        duplicateQrTotal += 1;
        if (alert.status === 'open') duplicateQrOpen += 1;
      }

      const isLeakage =
        alert.category === 'vendedor' ||
        alert.category === 'telemarketing' ||
        alert.code === 'qr_visit_farming' ||
        alert.code === 'same_device_multi_lead' ||
        alert.code === 'velocity_ip_burst' ||
        alert.code === 'suspicious_phone_pattern';
      if (isLeakage) {
        leakageAlertsTotal += 1;
        if (alert.status === 'open') leakageAlertsOpen += 1;
      }
    }

    return {
      total: alerts.length,
      open,
      reviewed,
      dismissed,
      resolved: reviewed + dismissed,
      criticalOrHighOpen,
      criticalOpen,
      duplicateQrTotal,
      duplicateQrOpen,
      leakageAlertsTotal,
      leakageAlertsOpen,
    };
  }, [alerts]);

  // ---------------------------------------------------------------------------
  // Live Team Risk Radar (Vendedores & Telemarketing + Seller Bias Detector)
  // ---------------------------------------------------------------------------
  const vendedorRadar = useMemo(() => {
    interface VendedorRow {
      key: string;
      name: string;
      tag: string;
      active: boolean;
      leadsCount: number;
      duplicateAttempts: number;
      fastCloses: number;
      orderBursts: number;
      openAlerts: number;
      criticalAlerts: number;
      totalAlerts: number;
      risk: RiskLevel;
    }

    const byTag = new Map<string, VendedorRow>();

    for (const acc of accounts) {
      if (acc.role !== 'vendedor') continue;
      const tag = normalizeKey(acc.tag || acc.username);
      if (!tag) continue;
      byTag.set(tag, {
        key: acc.id || tag,
        name: acc.displayName || acc.username,
        tag,
        active: acc.active,
        leadsCount: 0,
        duplicateAttempts: 0,
        fastCloses: 0,
        orderBursts: 0,
        openAlerts: 0,
        criticalAlerts: 0,
        totalAlerts: 0,
        risk: 'low',
      });
    }

    for (const ref of referrers) {
      const tag = normalizeKey(ref.code);
      if (!tag) continue;
      if (!byTag.has(tag)) {
        byTag.set(tag, {
          key: ref.id || tag,
          name: ref.name || tag,
          tag,
          active: ref.active,
          leadsCount: 0,
          duplicateAttempts: 0,
          fastCloses: 0,
          orderBursts: 0,
          openAlerts: 0,
          criticalAlerts: 0,
          totalAlerts: 0,
          risk: 'low',
        });
      }
    }

    const referrerCodeById = new Map<string, string>();
    for (const ref of referrers) {
      const code = normalizeKey(ref.code);
      if (ref.id && code) referrerCodeById.set(ref.id, code);
    }

    for (const lead of leads) {
      const tag =
        normalizeKey(lead.referralCode) ||
        (lead.referrerId ? referrerCodeById.get(lead.referrerId) || '' : '');
      if (!tag) continue;
      const entry = byTag.get(tag);
      if (entry) {
        entry.leadsCount += 1;
      }
    }

    for (const alert of alerts) {
      const candidateTags = new Set<string>();
      const refTag = normalizeKey(alert.referralCode);
      const actorTag = normalizeKey(alert.actorTag);
      if (refTag && byTag.has(refTag)) candidateTags.add(refTag);
      if (actorTag && byTag.has(actorTag)) candidateTags.add(actorTag);
      if (candidateTags.size === 0 && alert.actorName) {
        const lowerActor = alert.actorName.trim().toLowerCase();
        for (const [tag, row] of byTag.entries()) {
          if (row.name.trim().toLowerCase() === lowerActor) {
            candidateTags.add(tag);
          }
        }
      }

      for (const tag of candidateTags) {
        const row = byTag.get(tag);
        if (!row) continue;
        row.totalAlerts += 1;
        if (alert.status === 'open') {
          row.openAlerts += 1;
          if (alert.severity === 'critical') row.criticalAlerts += 1;
        }
        if (alert.code === 'duplicate_phone_attempt') row.duplicateAttempts += 1;
        if (alert.code === 'vendedor_fast_close') row.fastCloses += 1;
        if (alert.code === 'vendedor_order_burst') row.orderBursts += 1;
      }
    }

    const rows = Array.from(byTag.values()).map((row) => {
      let risk: RiskLevel = 'low';
      if (
        row.criticalAlerts > 0 ||
        row.openAlerts >= 2 ||
        row.fastCloses > 0 ||
        row.orderBursts > 0 ||
        row.duplicateAttempts >= 2
      ) {
        risk = 'high';
      } else if (row.openAlerts === 1 || row.duplicateAttempts === 1 || row.totalAlerts > 0) {
        risk = 'medium';
      }
      return { ...row, risk };
    });

    rows.sort((a, b) => {
      if (RISK_META[b.risk].rank !== RISK_META[a.risk].rank) {
        return RISK_META[b.risk].rank - RISK_META[a.risk].rank;
      }
      if (b.openAlerts !== a.openAlerts) return b.openAlerts - a.openAlerts;
      if (b.totalAlerts !== a.totalAlerts) return b.totalAlerts - a.totalAlerts;
      return b.leadsCount - a.leadsCount;
    });

    return rows;
  }, [accounts, referrers, leads, alerts]);

  const telemarketingRadar = useMemo(() => {
    interface OperatorRow {
      key: string;
      name: string;
      tag: string;
      active: boolean;
      processedCount: number;
      scheduledCount: number;
      reposoCount: number;
      reposoPct: number;
      rapidAlerts: number;
      openAlerts: number;
      risk: RiskLevel;
    }

    const byKey = new Map<string, OperatorRow>();
    const keyByAlias = new Map<string, string>();

    const registerAlias = (alias: string | null | undefined, canonicalKey: string) => {
      const cleaned = (alias || '').trim().toLowerCase();
      if (cleaned) keyByAlias.set(cleaned, canonicalKey);
    };

    for (const acc of accounts) {
      if (acc.role !== 'telemarketing') continue;
      const canonical = acc.id || acc.username.toLowerCase();
      byKey.set(canonical, {
        key: canonical,
        name: acc.displayName || acc.username,
        tag: normalizeKey(acc.tag || acc.username),
        active: acc.active,
        processedCount: 0,
        scheduledCount: 0,
        reposoCount: 0,
        reposoPct: 0,
        rapidAlerts: 0,
        openAlerts: 0,
        risk: 'low',
      });
      registerAlias(acc.username, canonical);
      registerAlias(acc.displayName, canonical);
      registerAlias(acc.tag, canonical);
    }

    const resolveOrCreateOperator = (rawName?: string | null, rawTag?: string | null): OperatorRow | null => {
      const nameAlias = (rawName || '').trim().toLowerCase();
      const tagAlias = (rawTag || '').trim().toLowerCase();
      const existingKey = (nameAlias && keyByAlias.get(nameAlias)) || (tagAlias && keyByAlias.get(tagAlias));
      if (existingKey) return byKey.get(existingKey) ?? null;

      const label = (rawName || rawTag || '').trim();
      if (!label) return null;
      const canonical = `op:${label.toLowerCase()}`;
      const created: OperatorRow = {
        key: canonical,
        name: label,
        tag: normalizeKey(rawTag || label),
        active: true,
        processedCount: 0,
        scheduledCount: 0,
        reposoCount: 0,
        reposoPct: 0,
        rapidAlerts: 0,
        openAlerts: 0,
        risk: 'low',
      };
      byKey.set(canonical, created);
      registerAlias(label, canonical);
      if (rawTag) registerAlias(rawTag, canonical);
      return created;
    };

    // Processed leads per operator + seller bias computation
    let totalProcessedLeads = 0;
    let totalReposoLeads = 0;

    const referrerInfoById = new Map<string, { code: string; name: string }>();
    for (const ref of referrers) {
      if (ref.id) {
        referrerInfoById.set(ref.id, {
          code: normalizeKey(ref.code),
          name: ref.name || normalizeKey(ref.code),
        });
      }
    }

    const sellerBuckets = new Map<
      string,
      { tag: string; name: string; processed: number; reposo: number }
    >();

    for (const lead of leads) {
      const outcome = lead.callOutcome ?? (lead.called ? 'scheduled' : 'pending');
      if (outcome !== 'scheduled' && outcome !== 'not_scheduled') continue;

      totalProcessedLeads += 1;
      if (outcome === 'not_scheduled') totalReposoLeads += 1;

      if (lead.calledBy && lead.calledBy.trim()) {
        const op = resolveOrCreateOperator(lead.calledBy);
        if (op) {
          op.processedCount += 1;
          if (outcome === 'scheduled') op.scheduledCount += 1;
          if (outcome === 'not_scheduled') op.reposoCount += 1;
        }
      }

      const refInfo = lead.referrerId ? referrerInfoById.get(lead.referrerId) : undefined;
      const sellerTag = normalizeKey(lead.referralCode) || refInfo?.code || '';
      if (sellerTag) {
        const sellerName = lead.referrerName || refInfo?.name || sellerTag;
        const bucket = sellerBuckets.get(sellerTag) || {
          tag: sellerTag,
          name: sellerName,
          processed: 0,
          reposo: 0,
        };
        bucket.processed += 1;
        if (outcome === 'not_scheduled') bucket.reposo += 1;
        sellerBuckets.set(sellerTag, bucket);
      }
    }

    for (const alert of alerts) {
      if (alert.category !== 'telemarketing' && alert.actorRole !== 'telemarketing') continue;
      const op = resolveOrCreateOperator(alert.actorName, alert.actorTag);
      if (!op) continue;
      if (
        alert.code === 'telemarketing_rapid_reposo' ||
        alert.code === 'telemarketing_rapid_schedule'
      ) {
        op.rapidAlerts += 1;
      }
      if (alert.status === 'open') {
        op.openAlerts += 1;
      }
    }

    const operators = Array.from(byKey.values()).map((op) => {
      const reposoPct =
        op.processedCount > 0 ? Math.round((op.reposoCount / op.processedCount) * 100) : 0;
      let risk: RiskLevel = 'low';
      if (op.rapidAlerts >= 2 || op.openAlerts >= 2 || (op.processedCount >= 5 && reposoPct >= 75)) {
        risk = 'high';
      } else if (op.rapidAlerts === 1 || op.openAlerts === 1 || (op.processedCount >= 5 && reposoPct >= 60)) {
        risk = 'medium';
      }
      return { ...op, reposoPct, risk };
    });

    operators.sort((a, b) => {
      if (RISK_META[b.risk].rank !== RISK_META[a.risk].rank) {
        return RISK_META[b.risk].rank - RISK_META[a.risk].rank;
      }
      if (b.rapidAlerts !== a.rapidAlerts) return b.rapidAlerts - a.rapidAlerts;
      return b.processedCount - a.processedCount;
    });

    // telemarketing_seller_bias detector:
    // Flag any vendedor whose leads have >= 65% Reposo with >= 5 processed leads
    // AND >= 30 percentage points above overall Reposo average.
    const overallReposoPct =
      totalProcessedLeads > 0 ? Math.round((totalReposoLeads / totalProcessedLeads) * 100) : 0;

    const sellerBiasFlags = Array.from(sellerBuckets.values())
      .map((bucket) => {
        const reposoPct =
          bucket.processed > 0 ? Math.round((bucket.reposo / bucket.processed) * 100) : 0;
        const deltaPts = reposoPct - overallReposoPct;
        return {
          ...bucket,
          reposoPct,
          deltaPts,
        };
      })
      .filter((b) => b.processed >= 5 && b.reposoPct >= 65 && b.deltaPts >= 30)
      .sort((a, b) => b.deltaPts - a.deltaPts);

    return {
      operators,
      overallReposoPct,
      totalProcessedLeads,
      sellerBiasFlags,
    };
  }, [accounts, referrers, leads, alerts]);

  const totalLeakageDetected =
    counts.leakageAlertsTotal + telemarketingRadar.sellerBiasFlags.length;

  // ---------------------------------------------------------------------------
  // Filtered Forensic Alerts Feed
  // ---------------------------------------------------------------------------
  const filteredAlerts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return alerts
      .filter((alert) => {
        if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
        if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
        if (categoryFilter !== 'all' && alert.category !== categoryFilter) return false;
        if (q) {
          const haystack = [
            alert.title,
            alert.description,
            alert.code,
            alert.actorName,
            alert.actorTag,
            alert.leadName,
            alert.claimCode,
            alert.referralCode,
            alert.phoneMasked,
            alert.ipMasked,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Open first when viewing all, then newest first
        if (statusFilter === 'all' && a.status !== b.status) {
          if (a.status === 'open') return -1;
          if (b.status === 'open') return 1;
        }
        const timeA = Date.parse(a.createdAt) || 0;
        const timeB = Date.parse(b.createdAt) || 0;
        if (timeB !== timeA) return timeB - timeA;
        return SEVERITY_META[a.severity].order - SEVERITY_META[b.severity].order;
      });
  }, [alerts, statusFilter, severityFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, severityFilter, categoryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / ALERTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIdx = (safePage - 1) * ALERTS_PAGE_SIZE;
  const paginatedAlerts = useMemo(
    () => filteredAlerts.slice(pageStartIdx, pageStartIdx + ALERTS_PAGE_SIZE),
    [filteredAlerts, pageStartIdx]
  );

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const showTemporaryFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 3600);
  };

  const handleAlertStatusChange = async (id: string, status: SecurityAlertStatus) => {
    if (busyId || bulkBusy) return;
    setBusyId(id);
    onBusyChange?.(true);
    try {
      await onUpdateAlertStatus(id, status);
      const label =
        status === 'reviewed'
          ? 'Alerta marcada como revisada.'
          : status === 'dismissed'
            ? 'Alerta descartada.'
            : 'Alerta reabierta para monitoreo.';
      showTemporaryFeedback('success', label);
    } catch (err) {
      showTemporaryFeedback(
        'error',
        err instanceof Error ? err.message : 'No se pudo actualizar el estado de la alerta.'
      );
    } finally {
      setBusyId(null);
      onBusyChange?.(false);
    }
  };

  const handleBulk = async (action: 'mark_all_reviewed' | 'clear_resolved') => {
    if (busyId || bulkBusy) return;
    setBulkBusy(action);
    onBusyChange?.(true);
    try {
      await onBulkAction(action);
      showTemporaryFeedback(
        'success',
        action === 'mark_all_reviewed'
          ? 'Todas las alertas abiertas fueron marcadas como revisadas.'
          : 'Alertas resueltas eliminadas del historial.'
      );
    } catch (err) {
      showTemporaryFeedback(
        'error',
        err instanceof Error ? err.message : 'No se pudo completar la acción masiva.'
      );
    } finally {
      setBulkBusy(null);
      onBusyChange?.(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* a) Header + Quick Actions */}
      <section className="dsb-glass rounded-[22px] sm:rounded-[24px] border border-slate-200/80 p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
            <div
              data-preserve-surface="true"
              className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#8B0018] via-[#B91C1C] to-[#DC2626] text-white shadow-[0_10px_24px_-6px_rgba(185,28,28,0.5)] border border-white/20"
            >
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="font-serif text-lg sm:text-2xl font-bold text-slate-900 leading-tight">
                  Centro de Seguridad y Antifraude
                </h2>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-1 text-[10.5px] sm:text-[11px] font-bold text-emerald-800 leading-snug">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  <span className="min-w-0 break-words">
                    Protección Activa · Deduplicación de Teléfonos + Monitor 24/7
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Auditoría forense en tiempo real de registros QR, prevención de duplicados telefónicos y detección de puntos de fuga en ventas y telemarketing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
            <button
              type="button"
              disabled={counts.open === 0 || Boolean(bulkBusy) || Boolean(busyId)}
              onClick={() => void handleBulk('mark_all_reviewed')}
              className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-emerald-300/80 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-800 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{bulkBusy === 'mark_all_reviewed' ? 'Marcando...' : 'Marcar todas revisadas'}</span>
            </button>
            <button
              type="button"
              disabled={counts.resolved === 0 || Boolean(bulkBusy) || Boolean(busyId)}
              onClick={() => void handleBulk('clear_resolved')}
              className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-slate-300/80 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span>{bulkBusy === 'clear_resolved' ? 'Limpiando...' : 'Limpiar resueltas'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-rose-300 bg-rose-50 text-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <ShieldCheck className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{feedback.text}</span>
          </div>
        )}
      </section>

      {/* b) 4 Security KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Alertas Abiertas
            </span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {counts.open}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug">
            {counts.total} eventos registrados en historial
          </p>
        </div>

        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Críticas / Altas
            </span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {counts.criticalOrHighOpen}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug">
            {counts.criticalOpen} críticas pendientes de acción
          </p>
        </div>

        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Duplicados QR Bloqueados
            </span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-sky-200 bg-sky-50 text-sky-700">
              <PhoneOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {counts.duplicateQrTotal}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug">
            {counts.duplicateQrOpen} intentos abiertos por revisar
          </p>
        </div>

        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Puntos de Fuga Detectados
            </span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Radio className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {totalLeakageDetected}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug">
            {telemarketingRadar.sellerBiasFlags.length > 0
              ? `${telemarketingRadar.sellerBiasFlags.length} sesgo(s) estadístico(s) activos`
              : `${counts.leakageAlertsOpen} anomalías abiertas en equipo`}
          </p>
        </div>
      </section>

      {/* c) Radar de Riesgo del Equipo (Vendedores & Telemarketing) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Vendedores bajo monitoreo */}
        <div className="dsb-glass min-w-0 rounded-[24px] border border-slate-200/80 p-3.5 sm:p-5 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  Vendedores bajo monitoreo
                </h3>
                <p className="text-[11.5px] text-slate-500">
                  Duplicados en QR, cierres ultrarrápidos y ráfagas de órdenes
                </p>
              </div>
            </div>
            <span className="self-start sm:self-center shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 tabular-nums">
              {vendedorRadar.length} activos
            </span>
          </div>

          {vendedorRadar.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Aún no hay vendedores o embajadores registrados para monitorear.
            </div>
          ) : (
            <div className="mt-3 space-y-2.5 max-h-[340px] overflow-y-auto pr-0.5 sm:pr-1">
              {vendedorRadar.map((row) => {
                const riskMeta = RISK_META[row.risk];
                return (
                  <div
                    key={row.key}
                    className="dsb-glass-subtle min-w-0 rounded-2xl border border-slate-200/80 p-2.5 sm:p-3 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="text-sm font-bold text-slate-900 max-w-full truncate">
                            {row.name}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                            {row.tag}
                          </span>
                          {!row.active && (
                            <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              Inactivo
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${riskMeta.badgeClass}`}
                      >
                        Riesgo {riskMeta.label}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-[11px]">
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">Dup. QR</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {row.duplicateAttempts}
                        </strong>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">Cierres rápidos</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {row.fastCloses}
                        </strong>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">Ráfagas orden</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {row.orderBursts}
                        </strong>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">Alertas abiertas</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {row.openAlerts}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Telemarketing bajo monitoreo + Sesgo entre Vendedores */}
        <div className="dsb-glass min-w-0 rounded-[24px] border border-slate-200/80 p-3.5 sm:p-5 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700">
                <UserCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  Telemarketing bajo monitoreo
                </h3>
                <p className="text-[11.5px] text-slate-500">
                  Volumen procesado, % En Reposo y sesgo entre vendedores
                </p>
              </div>
            </div>
            <span className="self-start sm:self-center shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 tabular-nums">
              Prom. Reposo: {telemarketingRadar.overallReposoPct}%
            </span>
          </div>

          {/* Seller Bias Forensic Detector (telemarketing_seller_bias) */}
          <div className="mt-3">
            {telemarketingRadar.sellerBiasFlags.length > 0 ? (
              <div className="space-y-2">
                {telemarketingRadar.sellerBiasFlags.map((bias) => (
                  <div
                    key={bias.tag}
                    className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-xs min-w-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1.5 font-bold text-rose-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Sesgo entre Vendedores detectado
                      </span>
                      <span className="max-w-full break-all rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-800">
                        telemarketing_seller_bias
                      </span>
                    </div>
                    <p className="mt-1.5 text-rose-800 leading-relaxed break-words">
                      Los prospectos de <strong>{bias.name}</strong> ({bias.tag}) presentan{' '}
                      <strong className="tabular-nums">{bias.reposoPct}% En Reposo</strong> (
                      {bias.reposo} de {bias.processed} procesados),{' '}
                      <strong className="tabular-nums">+{bias.deltaPts} pts</strong> por encima del
                      promedio general ({telemarketingRadar.overallReposoPct}%).
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start sm:items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                <span className="min-w-0 break-words leading-snug">
                  Sesgo entre Vendedores: distribución equilibrada (sin anomalías ≥65% Reposo con +30 pts sobre promedio).
                </span>
              </div>
            )}
          </div>

          {telemarketingRadar.operators.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Aún no hay operadores de telemarketing o llamadas registradas.
            </div>
          ) : (
            <div className="mt-3 space-y-2.5 max-h-[260px] overflow-y-auto pr-0.5 sm:pr-1">
              {telemarketingRadar.operators.map((op) => {
                const riskMeta = RISK_META[op.risk];
                return (
                  <div
                    key={op.key}
                    className="dsb-glass-subtle min-w-0 rounded-2xl border border-slate-200/80 p-2.5 sm:p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 max-w-full truncate">
                          {op.name}
                        </span>
                        {op.tag && (
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                            {op.tag}
                          </span>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${riskMeta.badgeClass}`}
                      >
                        Riesgo {riskMeta.label}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-[11px]">
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">Procesados</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {op.processedCount}
                        </strong>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">% En Reposo</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {op.reposoPct}%
                        </strong>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">Alertas rápidas</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {op.rapidAlerts}
                        </strong>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5">
                        <span className="block text-[10px] text-slate-500 truncate">Abiertas</span>
                        <strong className="font-mono text-xs text-slate-900 tabular-nums">
                          {op.openAlerts}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* d) Centro de Notificaciones Forenses */}
      <section className="dsb-glass rounded-[24px] sm:rounded-[28px] border border-slate-200/80 p-3.5 sm:p-6 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 shrink-0 text-rose-700" />
              <span>Centro de Notificaciones Forenses</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Filtra, audita y resuelve eventos de seguridad, duplicados y alertas operativas.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 tabular-nums shrink-0">
            Mostrando {filteredAlerts.length} de {alerts.length} alertas
          </span>
        </div>

        {/* Status Tabs + Filters Bar */}
        <div className="space-y-3">
          {/* Status segmented pills */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'open', label: 'Abiertas', count: counts.open },
                { id: 'reviewed', label: 'Revisadas', count: counts.reviewed },
                { id: 'dismissed', label: 'Descartadas', count: counts.dismissed },
                { id: 'all', label: 'Todas', count: counts.total },
              ] as Array<{ id: StatusFilter; label: string; count: number }>
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-preserve-surface={active ? 'true' : undefined}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`inline-flex min-h-[38px] items-center justify-between sm:justify-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-[#8B0018] to-[#B91C1C] text-white border-white/25 shadow-sm'
                      : 'border-slate-200 bg-white/65 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + Severity + Category Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            <div className="relative min-w-0 lg:col-span-6">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, tag QR, código, teléfono, IP o detalle..."
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="relative min-w-0 lg:col-span-3">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <select
                aria-label="Filtrar por severidad"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white/80 pl-8 pr-3 py-2 text-base sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer"
              >
                <option value="all">Severidad: Todas</option>
                <option value="critical">Crítica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="info">Info</option>
              </select>
            </div>

            <div className="relative min-w-0 lg:col-span-3">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <select
                aria-label="Filtrar por categoría"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white/80 pl-8 pr-3 py-2 text-base sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer"
              >
                <option value="all">Categoría: Todas</option>
                <option value="qr_abuse">Abuso QR</option>
                <option value="vendedor">Vendedores</option>
                <option value="telemarketing">Telemarketing</option>
                <option value="access">Acceso / RBAC</option>
                <option value="audit">Auditoría</option>
              </select>
            </div>
          </div>
        </div>

        {/* Forensic Alert Cards List */}
        {filteredAlerts.length === 0 ? (
          <div className="dsb-glass-subtle rounded-2xl border border-slate-200/80 py-10 px-4 text-center space-y-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              {statusFilter === 'open' && alerts.length > 0
                ? 'Sin alertas abiertas en este filtro'
                : 'No hay alertas que coincidan con tu búsqueda'}
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {statusFilter === 'open' && counts.total > 0
                ? 'Todas las incidencias están controladas. Puedes cambiar el filtro a "Todas" para consultar el historial forense.'
                : 'El monitor antifraude permanece activo 24/7 registrando duplicados y anomalías automáticamente.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {paginatedAlerts.map((alert) => {
              const sevMeta = SEVERITY_META[alert.severity] || SEVERITY_META.info;
              const isRowBusy = busyId === alert.id || Boolean(bulkBusy);
              return (
                <article
                  key={alert.id}
                  className="dsb-glass-subtle relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200/80 p-3 pl-4 sm:p-4 sm:pl-5 shadow-2xs transition-all"
                >
                  {/* Severity left accent bar */}
                  <span
                    data-preserve-surface="true"
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1.5 ${sevMeta.railClass}`}
                  />

                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${sevMeta.badgeClass}`}
                        >
                          {sevMeta.label}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-700">
                          {CATEGORY_LABELS[alert.category] || alert.category}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                            alert.status === 'open'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : alert.status === 'reviewed'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {STATUS_LABELS[alert.status]}
                        </span>
                        <span className="max-w-full break-all rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {alert.code}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug break-words">
                          {alert.title}
                        </h4>
                        <p className="mt-1 text-xs sm:text-[13px] text-slate-700 leading-relaxed break-words">
                          {alert.description}
                        </p>
                      </div>

                      {/* Forensic Metadata Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] min-w-0">
                        {(alert.actorName || alert.actorRole) && (
                          <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white/65 px-2 py-0.5 font-medium text-slate-700 break-words">
                            <span className="text-slate-500">Actor:</span>
                            <strong className="text-slate-900 break-words">
                              {alert.actorName || alert.actorRole}
                            </strong>
                            {alert.actorTag && (
                              <span className="font-mono text-[10px] text-slate-600 break-all">
                                ({alert.actorTag})
                              </span>
                            )}
                          </span>
                        )}

                        {alert.referralCode && (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[10.5px] font-bold text-amber-800 break-all">
                            QR: {alert.referralCode}
                          </span>
                        )}

                        {(alert.leadName || alert.claimCode) && (
                          <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-800 break-words">
                            <span>Prospecto:</span>
                            <strong className="break-words">{alert.leadName || 'Registro'}</strong>
                            {alert.claimCode && (
                              <span className="font-mono text-[10px] break-all">· {alert.claimCode}</span>
                            )}
                          </span>
                        )}

                        {alert.phoneMasked && (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-700 break-all">
                            Tel: {alert.phoneMasked}
                          </span>
                        )}

                        {alert.ipMasked && (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-700 break-all">
                            IP: {alert.ipMasked}
                          </span>
                        )}

                        <span className="inline-flex w-full sm:w-auto items-center gap-1 text-[11px] text-slate-500 pt-0.5 sm:pt-0 sm:ml-auto">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatAlertTimestamp(alert.createdAt)}</span>
                        </span>
                      </div>

                      {alert.reviewedBy && alert.reviewedAt && (
                        <p className="text-[11px] text-slate-500 break-words">
                          Auditada por <strong className="text-slate-700">{alert.reviewedBy}</strong>{' '}
                          ({formatAlertTimestamp(alert.reviewedAt)})
                          {alert.reviewNote ? ` · Nota: ${alert.reviewNote}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap lg:flex-col items-stretch sm:items-center lg:items-end justify-end gap-1.5 w-full lg:w-auto shrink-0 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-slate-200/70">
                      {alert.status === 'open' ? (
                        <>
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void handleAlertStatusChange(alert.id, 'reviewed')}
                            className="inline-flex min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-none lg:w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 transition-colors cursor-pointer disabled:opacity-45"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            <span>Revisada</span>
                          </button>
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void handleAlertStatusChange(alert.id, 'dismissed')}
                            className="inline-flex min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-none lg:w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-45"
                          >
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Descartar</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isRowBusy}
                          onClick={() => void handleAlertStatusChange(alert.id, 'open')}
                          className="inline-flex min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-none lg:w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 transition-colors cursor-pointer disabled:opacity-45"
                        >
                          <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                          <span>Reabrir</span>
                        </button>
                      )}

                      {alert.leadId && onJumpToLead && (
                        <button
                          type="button"
                          onClick={() => onJumpToLead(alert.leadId as string)}
                          className="inline-flex min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-none lg:w-full items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-800 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span>Ver prospecto</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              Mostrando {pageStartIdx + 1}–{Math.min(pageStartIdx + ALERTS_PAGE_SIZE, filteredAlerts.length)} de{' '}
              {filteredAlerts.length} alertas
            </span>
            <div className="flex items-center justify-between sm:justify-end gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-slate-300 bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
              <span className="px-2.5 text-xs font-bold text-slate-900 tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-slate-300 bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
