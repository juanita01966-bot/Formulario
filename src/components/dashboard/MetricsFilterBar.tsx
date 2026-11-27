import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Filter, RotateCcw, Users } from 'lucide-react';
import type { ReferralPartner, UserAccount, UserRole } from '../../types/app';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { getRoleTheme } from './roleTheme';

export type DatePreset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom';

export interface AmbassadorOption {
  value: string; // 'tag:<TAG>'
  label: string;
  name: string;
  tag: string;
  avatarUrl?: string | null;
  emoji?: string | null;
  partnerType?: 'vendedor' | 'embajador';
  ownerVendedorName?: string | null;
  ownerVendedorTag?: string | null;
  active?: boolean;
}

interface MetricsFilterBarProps {
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  onDatePresetChange: (preset: DatePreset) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  showAmbassadorFilter?: boolean;
  ambassadorFilter?: string; // 'all' | 'organic' | 'direct' | 'tag:<TAG>'
  onAmbassadorFilterChange?: (value: string) => void;
  vendedorDirectTag?: string;
  accounts?: UserAccount[];
  referrers?: ReferralPartner[];
  totalLeadsCount?: number;
  filteredLeadsCount?: number;
  onClearFilters?: () => void;
  userRole?: UserRole;
}

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
];

export function resolveDateBounds(
  preset: DatePreset,
  customFrom: string,
  customTo: string
): { startMs: number | null; endMs: number | null } {
  if (preset === 'all') return { startMs: null, endMs: null };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === 'today') {
    return { startMs: startOfToday.getTime(), endMs: endOfToday.getTime() };
  }
  if (preset === '7d') {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }
  if (preset === '30d') {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 29);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }

  // custom
  let startMs: number | null = null;
  let endMs: number | null = null;
  if (customFrom) {
    const d = new Date(`${customFrom}T00:00:00`);
    if (!Number.isNaN(d.getTime())) startMs = d.getTime();
  }
  if (customTo) {
    const d = new Date(`${customTo}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) endMs = d.getTime();
  }
  return { startMs, endMs };
}

export function isTimestampInRange(
  iso: string | null | undefined,
  bounds: { startMs: number | null; endMs: number | null }
): boolean {
  if (bounds.startMs === null && bounds.endMs === null) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (bounds.startMs !== null && t < bounds.startMs) return false;
  if (bounds.endMs !== null && t > bounds.endMs) return false;
  return true;
}

export const MetricsFilterBar: React.FC<MetricsFilterBarProps> = ({
  datePreset,
  dateFrom,
  dateTo,
  onDatePresetChange,
  onDateFromChange,
  onDateToChange,
  showAmbassadorFilter = true,
  ambassadorFilter = 'all',
  onAmbassadorFilterChange,
  vendedorDirectTag,
  accounts = [],
  referrers = [],
  totalLeadsCount,
  filteredLeadsCount,
  onClearFilters,
  userRole = 'admin',
}) => {
  const theme = getRoleTheme(userRole);
  const prefersReducedMotion = useReducedMotion();
  const isVendedor = userRole === 'vendedor';
  const normalizedDirectTag = (vendedorDirectTag || '').trim().toUpperCase();

  // Build deduplicated lists of vendedor and embajador options
  const { vendedorOptions, embajadorOptions, allAmbassadorOptions } = React.useMemo(() => {
    const vendedorByTag = new Map<string, AmbassadorOption>();
    const embajadorByTag = new Map<string, AmbassadorOption>();
    const embCountByOwnerId = new Map<string, number>();
    const embCountByOwnerTag = new Map<string, number>();

    for (const ref of referrers) {
      if (ref.partnerType !== 'embajador') continue;
      if (ref.ownerVendedorAccountId) {
        embCountByOwnerId.set(
          ref.ownerVendedorAccountId,
          (embCountByOwnerId.get(ref.ownerVendedorAccountId) || 0) + 1
        );
      }
      const oTag = (ref.ownerVendedorTag || '').trim().toUpperCase();
      if (oTag) {
        embCountByOwnerTag.set(oTag, (embCountByOwnerTag.get(oTag) || 0) + 1);
      }
    }

    if (!isVendedor) {
      for (const acc of accounts) {
        if (acc.role !== 'vendedor') continue;
        const tag = acc.tag.trim().toUpperCase();
        if (!tag) continue;
        const embCount =
          embCountByOwnerId.get(acc.id) || embCountByOwnerTag.get(tag) || 0;
        vendedorByTag.set(tag, {
          value: `tag:${tag}`,
          label: `${acc.displayName} (${tag})${embCount > 0 ? ` · +${embCount} emb.` : ''}${acc.active ? '' : ' · Inactivo'}`,
          name: acc.displayName,
          tag,
          avatarUrl: acc.avatarUrl ?? null,
          partnerType: 'vendedor',
          active: acc.active,
        });
      }
    }

    for (const ref of referrers) {
      const tag = ref.code.trim().toUpperCase();
      if (!tag) continue;

      if (ref.partnerType === 'embajador') {
        const prefix = ref.emoji?.trim() ? `${ref.emoji.trim()} ` : '✨ ';
        const ownerCtx =
          !isVendedor && (ref.ownerVendedorName || ref.ownerVendedorTag)
            ? ` · de ${ref.ownerVendedorName || ref.ownerVendedorTag}`
            : '';
        embajadorByTag.set(tag, {
          value: `tag:${tag}`,
          label: `${prefix}${ref.name} (${tag})${ownerCtx}${ref.active ? '' : ' · Inactivo'}`,
          name: ref.name,
          tag,
          avatarUrl: ref.avatarUrl ?? null,
          emoji: ref.emoji ?? null,
          partnerType: 'embajador',
          ownerVendedorName: ref.ownerVendedorName ?? null,
          ownerVendedorTag: ref.ownerVendedorTag ?? null,
          active: ref.active,
        });
        continue;
      }

      if (isVendedor) continue;

      const existing = vendedorByTag.get(tag);
      if (existing) {
        if (!existing.avatarUrl && ref.avatarUrl) {
          existing.avatarUrl = ref.avatarUrl;
        }
        if (!existing.emoji && ref.emoji) {
          existing.emoji = ref.emoji;
        }
        continue;
      }
      const embCount =
        (ref.accountId ? embCountByOwnerId.get(ref.accountId) : 0) ||
        embCountByOwnerTag.get(tag) ||
        0;
      vendedorByTag.set(tag, {
        value: `tag:${tag}`,
        label: `${ref.name} (${tag})${embCount > 0 ? ` · +${embCount} emb.` : ''}${ref.active ? '' : ' · Inactivo'}`,
        name: ref.name,
        tag,
        avatarUrl: ref.avatarUrl ?? null,
        emoji: ref.emoji ?? null,
        partnerType: 'vendedor',
        active: ref.active,
      });
    }

    const vList = Array.from(vendedorByTag.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'es')
    );
    const eList = Array.from(embajadorByTag.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'es')
    );

    return {
      vendedorOptions: vList,
      embajadorOptions: eList,
      allAmbassadorOptions: [...vList, ...eList],
    };
  }, [accounts, referrers, isVendedor]);

  const selectedAmbassadorOption = React.useMemo(
    () =>
      ambassadorFilter.startsWith('tag:')
        ? allAmbassadorOptions.find((opt) => opt.value === ambassadorFilter) || null
        : null,
    [ambassadorFilter, allAmbassadorOptions]
  );

  const hasActiveFilter =
    datePreset !== 'all' || (showAmbassadorFilter && ambassadorFilter !== 'all');

  const pillTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 400, damping: 30 };

  return (
    <section
      aria-label="Filtros globales de métricas"
      className="rounded-[18px] sm:rounded-[24px] dsb-glass px-3 sm:px-5 py-3 sm:py-4 space-y-2.5 sm:space-y-3 min-w-0 max-w-full overflow-hidden"
      style={{ borderColor: theme.borderTint }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
        {/* Date Presets */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-2 min-w-0 w-full lg:w-auto">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
            <CalendarDays className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${theme.textAccent}`} />
            Período:
          </span>
          <div className="flex items-center gap-1 overflow-x-auto overscroll-x-contain w-full sm:w-auto max-w-full sm:flex-wrap rounded-full bg-white/45 backdrop-blur-md p-1 border border-white/75 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {DATE_PRESETS.map((preset) => {
              const active = datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onDatePresetChange(preset.id)}
                  className={`relative shrink-0 whitespace-nowrap min-h-[32px] sm:min-h-[30px] rounded-full px-2.5 sm:px-3 py-1 text-[11.5px] sm:text-xs font-semibold transition-colors cursor-pointer ${
                    active ? 'text-white' : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="dsb-date-preset-pill"
                      transition={pillTransition}
                      className={`absolute inset-0 rounded-full ${theme.activePillClass}`}
                    />
                  )}
                  <span className="relative z-10">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ambassador Filter + Reset */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto min-w-0 shrink-0">
          {showAmbassadorFilter && onAmbassadorFilterChange && (
            <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
              {selectedAmbassadorOption ? (
                <AmbassadorAvatar
                  name={selectedAmbassadorOption.name}
                  avatarUrl={selectedAmbassadorOption.avatarUrl}
                  emoji={selectedAmbassadorOption.emoji}
                  size="xs"
                  ring="gold"
                />
              ) : (
                <Users className={`h-4 w-4 shrink-0 ${theme.textAccent}`} />
              )}
              <label
                htmlFor="global-ambassador-filter"
                className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0"
              >
                {isVendedor ? 'Canal:' : 'Vendedor:'}
              </label>
              <select
                id="global-ambassador-filter"
                value={ambassadorFilter}
                onChange={(e) => onAmbassadorFilterChange(e.target.value)}
                className="w-full sm:w-auto flex-1 sm:flex-none min-w-0 min-h-[40px] sm:min-h-[38px] max-w-full sm:max-w-[260px] rounded-xl border bg-white/70 backdrop-blur-md px-2.5 sm:px-3 py-1.5 text-base sm:text-xs font-semibold text-slate-900 focus:bg-white/95 focus:outline-none transition-colors shadow-2xs"
                style={{ borderColor: theme.borderTint }}
              >
                {isVendedor ? (
                  <>
                    <option value="all">Todos mis canales</option>
                    <option value="direct">
                      Mi canal directo{normalizedDirectTag ? ` (${normalizedDirectTag})` : ''}
                    </option>
                    {embajadorOptions.length > 0 && (
                      <optgroup label="Mis Embajadores">
                        {embajadorOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  <>
                    <option value="all">Todos los vendedores</option>
                    <option value="organic">Orgánico / Sin QR</option>
                    {embajadorOptions.length > 0 ? (
                      <>
                        {vendedorOptions.length > 0 && (
                          <optgroup label="Vendedores (incluye sus Embajadores)">
                            {vendedorOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Embajadores">
                          {embajadorOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      vendedorOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))
                    )}
                  </>
                )}
              </select>
            </div>
          )}

          {hasActiveFilter && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className={`inline-flex w-full sm:w-auto justify-center min-h-[36px] sm:min-h-[38px] items-center gap-1.5 rounded-full border bg-white/70 backdrop-blur-md px-3 py-1.5 text-xs font-semibold hover:bg-white/95 transition-colors cursor-pointer shadow-2xs ${theme.textAccent}`}
              style={{ borderColor: theme.borderTint }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Range Inputs + Result Summary */}
      {(datePreset === 'custom' || (hasActiveFilter && totalLeadsCount !== undefined)) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/75 min-w-0">
          {datePreset === 'custom' ? (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 text-xs w-full sm:w-auto min-w-0">
              <label className="flex flex-col sm:inline-flex sm:flex-row sm:items-center gap-1 sm:gap-1.5 font-semibold text-slate-700 min-w-0">
                <span>Desde:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="w-full sm:w-auto min-w-0 min-h-[40px] sm:min-h-[38px] rounded-xl border bg-white/70 backdrop-blur-md px-2 sm:px-2.5 py-1 text-base sm:text-xs font-semibold text-slate-900 focus:bg-white/95 focus:outline-none transition-colors shadow-2xs"
                  style={{ borderColor: theme.borderTint }}
                />
              </label>
              <label className="flex flex-col sm:inline-flex sm:flex-row sm:items-center gap-1 sm:gap-1.5 font-semibold text-slate-700 min-w-0">
                <span>Hasta:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="w-full sm:w-auto min-w-0 min-h-[40px] sm:min-h-[38px] rounded-xl border bg-white/70 backdrop-blur-md px-2 sm:px-2.5 py-1 text-base sm:text-xs font-semibold text-slate-900 focus:bg-white/95 focus:outline-none transition-colors shadow-2xs"
                  style={{ borderColor: theme.borderTint }}
                />
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
              <Filter className={`h-3.5 w-3.5 shrink-0 ${theme.textAccent}`} />
              <span className="truncate sm:whitespace-normal">Filtro activo aplicado a KPIs, Reposo, QRs y Prospectos.</span>
            </div>
          )}

          {totalLeadsCount !== undefined && filteredLeadsCount !== undefined && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tabular-nums self-start sm:self-auto shrink-0 ${theme.badgeClass}`}
            >
              Mostrando {filteredLeadsCount} de {totalLeadsCount} prospectos
            </span>
          )}
        </div>
      )}
    </section>
  );
};
