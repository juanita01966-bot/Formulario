import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Clock,
  Cpu,
  ExternalLink,
  Filter,
  Gift,
  GitCompareArrows,
  Globe,
  PhoneCall,
  QrCode,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  ActivityLogCategory,
  ActivityLogEntry,
  UserAccount,
  UserRole,
} from '../../types/app';
import { RoleSymbolSvg } from './RoleEmblem';

interface ActivityLogPanelProps {
  logs: ActivityLogEntry[];
  accounts?: UserAccount[];
  onJumpToLead?: (leadId: string) => void;
}

type RoleFilter = 'all' | 'vendedor' | 'telemarketing' | 'admin' | 'public';
type CategoryFilter = 'all' | ActivityLogCategory;

const PAGE_SIZE = 40;

const CATEGORY_LABELS: Record<ActivityLogCategory, string> = {
  status: 'Cambios de estado',
  telemarketing: 'Telemarketing',
  leads: 'Prospectos',
  accounts: 'Cuentas',
  qr: 'QR y Embajadores',
  catalog: 'Regalos y Ajustes',
  security: 'Seguridad',
  system: 'Sistema',
};

const CATEGORY_BADGE_CLASSES: Record<ActivityLogCategory, string> = {
  status: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  telemarketing: 'border-sky-200 bg-sky-50 text-sky-800',
  leads: 'border-amber-200 bg-amber-50 text-amber-800',
  accounts: 'border-slate-200 bg-slate-100 text-slate-700',
  qr: 'border-amber-200 bg-amber-50 text-amber-800',
  catalog: 'border-slate-200 bg-slate-100 text-slate-700',
  security: 'border-rose-200 bg-rose-50 text-rose-800',
  system: 'border-slate-200 bg-slate-100 text-slate-700',
};

const CATEGORY_RAIL_CLASSES: Record<ActivityLogCategory, string> = {
  status: 'bg-emerald-600',
  telemarketing: 'bg-sky-600',
  leads: 'bg-amber-500',
  accounts: 'bg-slate-500',
  qr: 'bg-amber-600',
  catalog: 'bg-slate-400',
  security: 'bg-rose-600',
  system: 'bg-slate-500',
};

const ROLE_META: Record<
  UserRole | 'public' | 'system',
  { label: string; chipClass: string }
> = {
  admin: {
    label: 'Administrador',
    chipClass: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  telemarketing: {
    label: 'Telemarketing',
    chipClass: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  vendedor: {
    label: 'Vendedor',
    chipClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  public: {
    label: 'Público',
    chipClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  system: {
    label: 'Sistema',
    chipClass: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

const FUNNEL_STATE_RANKS: Record<string, number> = {
  none: 0,
  ninguno: 0,
  ninguna: 0,
  'sin estado': 0,
  'sin categoría': 0,
  'sin categoria': 0,
  'sin clasificar': 0,
  nuevo: 0,
  pendiente: 0,
  cita: 1,
  demo: 2,
  orden: 3,
};

const TELEMARKETING_STATE_KEYS = new Set([
  'pending',
  'pendiente',
  'scheduled',
  'agendado',
  'not_scheduled',
  'no agendado',
  'en reposo',
  'reposo',
]);

const PRETTY_STATE_LABELS: Record<string, string> = {
  none: 'Sin estado',
  cita: 'Cita',
  demo: 'Demo',
  orden: 'Orden',
  pending: 'Pendiente',
  scheduled: 'Agendado',
  not_scheduled: 'En reposo',
  open: 'Abierta',
  reviewed: 'Revisada',
  dismissed: 'Descartada',
  active: 'Activo',
  inactive: 'Inactivo',
};

function formatStateLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const lower = trimmed.toLowerCase();
  if (PRETTY_STATE_LABELS[lower]) {
    return PRETTY_STATE_LABELS[lower];
  }
  return trimmed;
}

type TransitionTone = 'advance' | 'revert' | 'telemarketing' | 'telemarketing_reposo' | 'neutral';

function resolveTransitionTone(
  category: ActivityLogCategory,
  fromState: string,
  toState: string
): TransitionTone {
  const fromKey = fromState.trim().toLowerCase();
  const toKey = toState.trim().toLowerCase();

  if (
    category === 'telemarketing' ||
    (TELEMARKETING_STATE_KEYS.has(fromKey) && TELEMARKETING_STATE_KEYS.has(toKey))
  ) {
    if (toKey === 'not_scheduled' || toKey === 'en reposo' || toKey === 'reposo' || toKey === 'no agendado') {
      return 'telemarketing_reposo';
    }
    return 'telemarketing';
  }

  const fromRank = FUNNEL_STATE_RANKS[fromKey];
  const toRank = FUNNEL_STATE_RANKS[toKey];
  if (typeof fromRank === 'number' && typeof toRank === 'number') {
    if (toRank > fromRank) return 'advance';
    if (toRank < fromRank) return 'revert';
  }

  return 'neutral';
}

function formatActivityTimestamp(iso: string): { relative: string; formatted: string } {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return { relative: '', formatted: iso };
  }
  const diffMs = Math.max(0, Date.now() - dt.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  let relative = '';
  if (diffMin < 1) relative = 'Hace un momento';
  else if (diffMin < 60) relative = `Hace ${diffMin} min`;
  else if (diffMin < 1440) relative = `Hace ${Math.floor(diffMin / 60)} h`;
  else relative = `Hace ${Math.floor(diffMin / 1440)} d`;

  const formatted = dt.toLocaleString('es-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return { relative, formatted };
}

function isSameLocalDay(iso: string, now: Date): boolean {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return false;
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}

function renderTargetIcon(targetType?: ActivityLogEntry['targetType']) {
  switch (targetType) {
    case 'lead':
      return <User className="h-3 w-3 shrink-0" />;
    case 'account':
      return <Users className="h-3 w-3 shrink-0" />;
    case 'qr':
    case 'referrer':
      return <QrCode className="h-3 w-3 shrink-0" />;
    case 'gift':
      return <Gift className="h-3 w-3 shrink-0" />;
    case 'settings':
      return <Settings className="h-3 w-3 shrink-0" />;
    case 'security':
      return <ShieldAlert className="h-3 w-3 shrink-0" />;
    default:
      return <ClipboardList className="h-3 w-3 shrink-0" />;
  }
}

export const ActivityLogPanel: React.FC<ActivityLogPanelProps> = ({
  logs,
  accounts = [],
  onJumpToLead,
}) => {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sort newest first once
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const timeA = Date.parse(a.createdAt) || 0;
      const timeB = Date.parse(b.createdAt) || 0;
      return timeB - timeA;
    });
  }, [logs]);

  // KPI Metrics & Role Counts
  const stats = useMemo(() => {
    const now = new Date();
    let statusChanges = 0;
    let telemarketingCalls = 0;
    let todayCount = 0;
    const roleCounts: Record<RoleFilter, number> = {
      all: sortedLogs.length,
      vendedor: 0,
      telemarketing: 0,
      admin: 0,
      public: 0,
    };

    for (const entry of sortedLogs) {
      if (entry.category === 'status') statusChanges += 1;
      if (entry.category === 'telemarketing') telemarketingCalls += 1;
      if (isSameLocalDay(entry.createdAt, now)) todayCount += 1;
      if (
        entry.actorRole === 'vendedor' ||
        entry.actorRole === 'telemarketing' ||
        entry.actorRole === 'admin' ||
        entry.actorRole === 'public'
      ) {
        roleCounts[entry.actorRole] += 1;
      }
    }

    return {
      total: sortedLogs.length,
      statusChanges,
      telemarketingCalls,
      todayCount,
      roleCounts,
    };
  }, [sortedLogs]);

  // Unique Actor / Persona options from logs + accounts
  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();

    const register = (name?: string | null) => {
      const clean = (name || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, clean);
      }
    };

    for (const acc of accounts) {
      register(acc.displayName || acc.username);
    }
    for (const entry of sortedLogs) {
      register(entry.actorName);
    }

    return Array.from(seen.values()).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [accounts, sortedLogs]);

  // Filtered activity entries
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const actorNeedle = actorFilter === 'all' ? '' : actorFilter.trim().toLowerCase();

    return sortedLogs.filter((entry) => {
      if (roleFilter !== 'all' && entry.actorRole !== roleFilter) return false;
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (actorNeedle) {
        const entryActor = (entry.actorName || '').trim().toLowerCase();
        if (entryActor !== actorNeedle) return false;
      }
      if (q) {
        const haystack = [
          entry.summary,
          entry.actorName,
          entry.actorUsername,
          entry.actorTag,
          entry.targetLabel,
          entry.fromState,
          entry.toState,
          entry.fromState ? formatStateLabel(entry.fromState) : '',
          entry.toState ? formatStateLabel(entry.toState) : '',
          entry.action,
          CATEGORY_LABELS[entry.category],
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sortedLogs, roleFilter, categoryFilter, actorFilter, searchQuery]);

  const hasActiveFilters =
    roleFilter !== 'all' ||
    categoryFilter !== 'all' ||
    actorFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setRoleFilter('all');
    setCategoryFilter('all');
    setActorFilter('all');
    setSearchQuery('');
    setVisibleCount(PAGE_SIZE);
  };

  const visibleLogs = useMemo(
    () => filteredLogs.slice(0, visibleCount),
    [filteredLogs, visibleCount]
  );

  const remainingCount = Math.max(0, filteredLogs.length - visibleLogs.length);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* a) Header */}
      <section className="dsb-glass rounded-[24px] sm:rounded-[28px] border border-slate-200/80 p-3.5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
            <div
              data-preserve-surface="true"
              className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#8B0018] via-[#A61B31] to-[#C89436] text-white shadow-[0_10px_24px_-6px_rgba(139,0,24,0.48)] border border-white/20"
            >
              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="font-serif text-lg sm:text-2xl font-bold text-slate-900 leading-tight">
                  Registro de Movimientos
                </h2>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-1 text-[10.5px] sm:text-[11px] font-bold text-emerald-800 leading-snug tabular-nums">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  <span className="min-w-0 break-words">
                    {stats.total} {stats.total === 1 ? 'movimiento' : 'movimientos'} en vivo
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                Bitácora cronológica de cada movimiento operativo del sistema — cambios de estado, llamadas de telemarketing, registros de prospectos, cuentas, QR y ajustes — con trazabilidad exacta de quién lo ejecutó.
              </p>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex min-h-[40px] w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-300/80 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>
      </section>

      {/* b) 4 Compact KPI Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Movimientos Totales
            </span>
            <span
              data-dsb-icon-tile="amber"
              className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-amber-200 bg-amber-50 text-amber-700"
            >
              <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {stats.total}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug break-words">
            Eventos auditados en bitácora
          </p>
        </div>

        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Cambios de Estado
            </span>
            <span
              data-dsb-icon-tile="emerald"
              className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              <GitCompareArrows className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {stats.statusChanges}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug break-words">
            Avances y reversiones Cita / Demo / Orden
          </p>
        </div>

        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Llamadas Telemarketing
            </span>
            <span
              data-dsb-icon-tile="sky"
              className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-sky-200 bg-sky-50 text-sky-700"
            >
              <PhoneCall className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {stats.telemarketingCalls}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug break-words">
            Agendamientos y pases a Reposo
          </p>
        </div>

        <div className="dsb-glass min-w-0 rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight min-w-0 break-words">
              Movimientos Hoy
            </span>
            <span
              data-dsb-icon-tile="rose"
              className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
            >
              <CalendarClock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {stats.todayCount}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 leading-snug break-words">
            Actividad registrada en la jornada actual
          </p>
        </div>
      </section>

      {/* c) Filter Bar + d) Chronological Activity Feed */}
      <section className="dsb-glass rounded-[24px] sm:rounded-[28px] border border-slate-200/80 p-3.5 sm:p-6 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-serif text-base sm:text-xl font-bold text-slate-900">
              Historial Cronológico de Actividad
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 break-words">
              Filtra por rol, categoría, persona o palabra clave para auditar cualquier movimiento.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 tabular-nums shrink-0">
            Mostrando {visibleLogs.length} de {filteredLogs.length}
            {filteredLogs.length !== stats.total ? ` (total ${stats.total})` : ''}
          </span>
        </div>

        {/* Filter Bar (.dsb-glass-subtle) */}
        <div className="dsb-glass-subtle rounded-2xl border border-slate-200/80 p-3 sm:p-3.5 space-y-3">
          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 sm:pb-0 sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { id: 'all', label: 'Todos', count: stats.roleCounts.all },
                { id: 'vendedor', label: 'Vendedor', count: stats.roleCounts.vendedor },
                { id: 'telemarketing', label: 'Telemarketing', count: stats.roleCounts.telemarketing },
                { id: 'admin', label: 'Administrador', count: stats.roleCounts.admin },
                { id: 'public', label: 'Público', count: stats.roleCounts.public },
              ] as Array<{ id: RoleFilter; label: string; count: number }>
            ).map((pill) => {
              const active = roleFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  data-preserve-surface={active ? 'true' : undefined}
                  onClick={() => {
                    setRoleFilter(pill.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-[#8B0018] to-[#B91C1C] text-white border-white/25 shadow-sm'
                      : 'border-slate-200 bg-white/65 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="whitespace-nowrap">{pill.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + Category + Actor Selects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Buscar resumen, persona, tag, prospecto o estado..."
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white/80 pl-9 pr-9 py-2 text-base sm:text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVisibleCount(PAGE_SIZE);
                  }}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative min-w-0 lg:col-span-4">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <select
                aria-label="Filtrar por categoría"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as CategoryFilter);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white/80 pl-8 pr-3 py-2 text-base sm:text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer"
              >
                <option value="all">Todas las categorías</option>
                <option value="status">Cambios de estado</option>
                <option value="telemarketing">Telemarketing</option>
                <option value="leads">Prospectos</option>
                <option value="accounts">Cuentas</option>
                <option value="qr">QR y Embajadores</option>
                <option value="catalog">Regalos y Ajustes</option>
                <option value="security">Seguridad</option>
                <option value="system">Sistema</option>
              </select>
            </div>

            <div className="relative min-w-0 lg:col-span-3">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <select
                aria-label="Filtrar por persona"
                value={actorFilter}
                onChange={(e) => {
                  setActorFilter(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white/80 pl-8 pr-3 py-2 text-base sm:text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer"
              >
                <option value="all">Todas las personas</option>
                {actorOptions.map((actorName) => (
                  <option key={actorName} value={actorName}>
                    {actorName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chronological Feed */}
        {visibleLogs.length === 0 ? (
          <div className="dsb-glass-subtle rounded-2xl border border-slate-200/80 py-10 px-4 text-center space-y-2.5">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              {stats.total === 0
                ? 'Aún no hay movimientos registrados'
                : 'No hay movimientos que coincidan con tus filtros'}
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {stats.total === 0
                ? 'Cada cambio de estado, llamada de telemarketing, alta de prospecto, QR o ajuste administrativo aparecerá aquí automáticamente.'
                : 'Prueba ajustando el rol, la categoría, la persona o limpiando el texto de búsqueda.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-1 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white/75 hover:bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restablecer filtros</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {visibleLogs.map((entry) => {
              const roleMeta = ROLE_META[entry.actorRole] || ROLE_META.system;
              const categoryLabel = CATEGORY_LABELS[entry.category] || entry.category;
              const categoryBadgeClass =
                CATEGORY_BADGE_CLASSES[entry.category] || CATEGORY_BADGE_CLASSES.system;
              const hasTransition = Boolean(
                entry.fromState &&
                  entry.toState &&
                  entry.fromState.trim() &&
                  entry.toState.trim()
              );
              const transitionTone = hasTransition
                ? resolveTransitionTone(
                    entry.category,
                    entry.fromState as string,
                    entry.toState as string
                  )
                : null;

              const railClass =
                transitionTone === 'advance'
                  ? 'bg-emerald-600'
                  : transitionTone === 'revert'
                    ? 'bg-rose-600'
                    : transitionTone === 'telemarketing'
                      ? 'bg-sky-600'
                      : transitionTone === 'telemarketing_reposo'
                        ? 'bg-amber-500'
                        : CATEGORY_RAIL_CLASSES[entry.category] || 'bg-slate-500';

              const { relative, formatted } = formatActivityTimestamp(entry.createdAt);
              const isRoleWithSvg =
                entry.actorRole === 'admin' ||
                entry.actorRole === 'telemarketing' ||
                entry.actorRole === 'vendedor';

              return (
                <article
                  key={entry.id}
                  className="dsb-glass-subtle relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200/80 p-3 pl-4 sm:p-4 sm:pl-5 shadow-2xs transition-all"
                >
                  {/* Category / transition left accent rail */}
                  <span
                    data-preserve-surface="true"
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1.5 ${railClass}`}
                  />

                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-2.5 sm:gap-3 min-w-0">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Top row: Actor emblem + Actor name + Role/Tag/Category chips + Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
                          {isRoleWithSvg ? (
                            <RoleSymbolSvg
                              role={entry.actorRole as UserRole}
                              className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                              animated={false}
                            />
                          ) : entry.actorRole === 'public' ? (
                            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
                              <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </span>
                          ) : (
                            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600">
                              <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </span>
                          )}

                          <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900 break-words">
                              {entry.actorName || roleMeta.label}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleMeta.chipClass}`}
                            >
                              {roleMeta.label}
                            </span>
                            {entry.actorTag && (
                              <span className="rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 break-all">
                                {entry.actorTag}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryBadgeClass}`}
                            >
                              {categoryLabel}
                            </span>
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0 tabular-nums">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>
                            {relative ? `${relative} · ${formatted}` : formatted}
                          </span>
                        </div>
                      </div>

                      {/* Summary text */}
                      <p className="text-xs sm:text-[13.5px] font-medium text-slate-800 leading-relaxed break-words">
                        {entry.summary}
                      </p>

                      {/* State transition + Target badge row */}
                      {(hasTransition || entry.targetLabel) && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 min-w-0">
                          {hasTransition && (
                            <span
                              className={`inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${
                                transitionTone === 'advance'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                  : transitionTone === 'revert'
                                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                                    : transitionTone === 'telemarketing'
                                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                                      : transitionTone === 'telemarketing_reposo'
                                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                                        : 'border-amber-200 bg-amber-50 text-amber-800'
                              }`}
                            >
                              {transitionTone === 'advance' ? (
                                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                              ) : transitionTone === 'revert' ? (
                                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                              ) : transitionTone === 'telemarketing' ||
                                transitionTone === 'telemarketing_reposo' ? (
                                <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <GitCompareArrows className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="break-words">
                                {formatStateLabel(entry.fromState as string)}
                              </span>
                              <ArrowRight className="h-3 w-3 shrink-0 opacity-80" />
                              <span className="break-words">
                                {formatStateLabel(entry.toState as string)}
                              </span>
                            </span>
                          )}

                          {entry.targetLabel && (
                            <span className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-slate-200 bg-white/65 px-2.5 py-1 text-[11px] font-semibold text-slate-700 break-words">
                              {renderTargetIcon(entry.targetType)}
                              <span className="min-w-0 break-words">{entry.targetLabel}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Jump to Lead CTA when applicable */}
                    {entry.targetType === 'lead' && entry.targetId && onJumpToLead && (
                      <div className="flex items-center justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/70">
                        <button
                          type="button"
                          onClick={() => onJumpToLead(entry.targetId as string)}
                          className="inline-flex min-h-[38px] sm:min-h-[36px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-800 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span>Ver prospecto</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {remainingCount > 0 && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-300/80 bg-white/75 hover:bg-white px-5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition-colors cursor-pointer tabular-nums"
                >
                  <ChevronDown className="h-4 w-4 shrink-0" />
                  <span>
                    Mostrar más ({Math.min(PAGE_SIZE, remainingCount)} de {remainingCount} restantes)
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
