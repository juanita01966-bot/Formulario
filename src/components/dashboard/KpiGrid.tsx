import React, { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Flame,
  Package,
  PauseCircle,
  ReceiptText,
  RotateCcw,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { Lead, UserRole } from '../../types/app';
import { getRoleTheme } from './roleTheme';

export type KpiFilterKey =
  | 'all'
  | 'vip'
  | 'client'
  | 'non_client'
  | 'pending'
  | 'called'
  | 'scheduled'
  | 'reposo'
  | 'cita'
  | 'demo'
  | 'orden';

interface KpiGridProps {
  leads: Lead[];
  defaultTicketAmount: number;
  activeFilter: KpiFilterKey;
  onSelectFilter: (filter: KpiFilterKey) => void;
  onOpenMasterReset?: () => void;
  resetSuccessMessage?: string | null;
  title?: string;
  userRole?: UserRole;
}

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const startVal = display;
    const diff = value - startVal;
    if (diff === 0) return;

    const start = performance.now();
    const duration = 450;
    let rafId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startVal + diff * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return (
    <span className="tabular-nums">
      {prefix}
      {display.toLocaleString('en-US')}
    </span>
  );
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  leads,
  defaultTicketAmount,
  activeFilter,
  onSelectFilter,
  onOpenMasterReset,
  resetSuccessMessage,
  title = 'Scoreboard de Métricas',
  userRole = 'admin',
}) => {
  const theme = getRoleTheme(userRole);
  const prefersReducedMotion = useReducedMotion();

  const handleCardPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${(event.clientX - rect.left).toFixed(1)}px`);
    el.style.setProperty('--spot-y', `${(event.clientY - rect.top).toFixed(1)}px`);
    el.style.setProperty('--spot-opacity', '1');
  }, []);

  const handleCardPointerLeave = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--spot-opacity', '0');
  }, []);

  const totalLeads = leads.length;
  const calledLeads = leads.filter((l) => l.called).length;
  const vipLeads = leads.filter((l) => l.qualification?.tier === 'alto').length;
  const citasCount = leads.filter((l) => l.category === 'cita').length;
  const demosCount = leads.filter((l) => l.category === 'demo').length;
  const reposoCount = leads.filter((l) => l.callOutcome === 'not_scheduled').length;
  const ordenesLeads = leads.filter((l) => l.category === 'orden');
  const ordenesCount = ordenesLeads.length;

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  const prospectosPct = pct(calledLeads, totalLeads);
  const citasPct = pct(citasCount, totalLeads);
  const demosPct = pct(demosCount, totalLeads);
  const ordenesPct = pct(ordenesCount, Math.max(demosCount + ordenesCount, totalLeads));
  const reposoPct = pct(reposoCount, totalLeads);

  const orderAmounts = ordenesLeads
    .map((l) => l.orderAmount)
    .filter((amt): amt is number => typeof amt === 'number' && amt > 0);
  const avgTicket =
    orderAmounts.length > 0
      ? Math.round(orderAmounts.reduce((acc, cur) => acc + cur, 0) / orderAmounts.length)
      : defaultTicketAmount;
  const totalVolume = orderAmounts.reduce((acc, cur) => acc + cur, 0);

  const cards = [
    {
      key: 'all' as KpiFilterKey,
      tileTone: 'amber' as const,
      title: 'Prospectos',
      count: totalLeads,
      percent: prospectosPct,
      sublabel: `${calledLeads} llamados`,
      icon: Users,
      topBar: 'from-[#B88B32]/85 via-[#E2C275] to-[#9A7426]/80',
      iconBg: 'bg-gradient-to-br from-amber-100/85 to-amber-200/70 text-[#8A5610]',
      barColor: 'from-[#D4AF37] to-[#A87D24]',
      glowBg: 'from-[#D4AF37]/12 to-transparent',
    },
    {
      key: 'cita' as KpiFilterKey,
      tileTone: 'rose' as const,
      title: 'Citas',
      count: citasCount,
      percent: citasPct,
      sublabel: 'del total',
      icon: Calendar,
      topBar: 'from-[#8E2334]/85 via-[#C45C6C] to-[#6E1826]/80',
      iconBg: 'bg-gradient-to-br from-rose-100/85 to-rose-200/70 text-[#941B2F]',
      barColor: 'from-[#C45C6C] to-[#8E2334]',
      glowBg: 'from-[#B23A4E]/12 to-transparent',
    },
    {
      key: 'demo' as KpiFilterKey,
      tileTone: 'sky' as const,
      title: 'Demos',
      count: demosCount,
      percent: demosPct,
      sublabel: 'en muestra',
      icon: Briefcase,
      topBar: 'from-[#1F5F7A]/85 via-[#68A6C4] to-[#16465C]/80',
      iconBg: 'bg-gradient-to-br from-sky-100/85 to-cyan-200/70 text-[#0B4F6C]',
      barColor: 'from-[#68A6C4] to-[#236582]',
      glowBg: 'from-[#4A8FB0]/12 to-transparent',
    },
    {
      key: 'orden' as KpiFilterKey,
      tileTone: 'emerald' as const,
      title: 'Órdenes',
      count: ordenesCount,
      percent: ordenesPct,
      sublabel: 'cerradas',
      icon: Package,
      topBar: 'from-[#246950]/85 via-[#68AB8E] to-[#1B523E]/80',
      iconBg: 'bg-gradient-to-br from-emerald-100/85 to-emerald-200/70 text-[#1F5C42]',
      barColor: 'from-[#68AB8E] to-[#266D53]',
      glowBg: 'from-[#3D8C6E]/12 to-transparent',
    },
    {
      key: 'reposo' as KpiFilterKey,
      tileTone: 'orange' as const,
      title: 'En Reposo',
      count: reposoCount,
      percent: reposoPct,
      sublabel: 'no agendados',
      icon: PauseCircle,
      topBar: 'from-[#9A5E2E]/85 via-[#CF9964] to-[#754520]/80',
      iconBg: 'bg-gradient-to-br from-orange-100/85 to-amber-200/70 text-[#854D1E]',
      barColor: 'from-[#CF9964] to-[#985E2C]',
      glowBg: 'from-[#B87B44]/12 to-transparent',
    },
  ];

  const isVendedor = userRole === 'vendedor';
  const heroHighlightColor = isVendedor ? '#EAD7A2' : '#E9CE8A';
  const heroSubColor = isVendedor ? 'text-[#E3EBDC]/82' : 'text-[#F5F2EB]/78';

  return (
    <section aria-label="Indicadores de desempeño Dashboard Operativo" className="space-y-2.5 sm:space-y-3">
      {/* Scoreboard Header + Admin Master Reset Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900">{title}</h2>
          {resetSuccessMessage && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50/85 backdrop-blur-md px-3 py-0.5 text-xs font-semibold text-emerald-800 shadow-xs">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{resetSuccessMessage}</span>
            </span>
          )}
        </div>

        {onOpenMasterReset && (
          <button
            type="button"
            onClick={onOpenMasterReset}
            className={`inline-flex min-h-[40px] w-full sm:w-auto items-center justify-center gap-2 rounded-full dsb-glass-subtle border px-3.5 py-1.5 text-xs font-bold shadow-sm hover:bg-white/85 transition-all cursor-pointer shrink-0 ${theme.textAccent}`}
            style={{ borderColor: theme.borderTint }}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            Restablecer clientes a 0
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          const isSelected = activeFilter === card.key;
          return (
            <motion.button
              key={card.key}
              type="button"
              onClick={() => onSelectFilter(isSelected && card.key !== 'all' ? 'all' : card.key)}
              onPointerMove={handleCardPointerMove}
              onPointerLeave={handleCardPointerLeave}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : idx * 0.04, duration: 0.3 }}
              whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              className={`group relative overflow-hidden rounded-[18px] sm:rounded-[20px] dsb-glass p-2.5 sm:p-3.5 text-left border transition-all cursor-pointer ${
                idx === 4 ? 'col-span-2 sm:col-span-1' : ''
              } ${isSelected ? theme.ringClass : 'hover:border-white/95'}`}
              style={{
                ['--spot-color' as string]: theme.spotlightRgba,
                borderColor: isSelected ? theme.mid : undefined,
                boxShadow: isSelected
                  ? `0 14px 28px -14px ${theme.glowRgba}, inset 0 1px 0 rgba(255,255,255,0.28)`
                  : undefined,
              }}
            >
              {/* Role-tinted pointer radial spotlight */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
                style={{
                  opacity: 'var(--spot-opacity, 0)',
                  background:
                    'radial-gradient(280px circle at var(--spot-x, 50%) var(--spot-y, 50%), var(--spot-color), transparent 70%)',
                }}
              />
              {/* Restrained metallic hairline top strip */}
              <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-85 ${card.topBar}`} />
              <div
                className={`pointer-events-none hidden sm:block absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${card.glowBg} blur-2xl opacity-35 group-hover:opacity-65 transition-opacity`}
              />

              <div className="relative z-10 flex items-center justify-between gap-1 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span
                    data-dsb-icon-tile={card.tileTone}
                    className={`flex h-6.5 w-6.5 sm:h-7.5 sm:w-7.5 shrink-0 items-center justify-center rounded-lg sm:rounded-xl shadow-xs group-hover:scale-105 transition-transform ${card.iconBg}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[11.5px] sm:text-xs font-semibold text-slate-700 truncate">
                    {card.title}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="relative z-10 mt-2 sm:mt-2.5 flex items-baseline justify-between gap-1 sm:gap-1.5">
                <div className="text-xl sm:text-[28px] font-bold tracking-tight leading-none text-slate-900">
                  <AnimatedNumber value={card.count} />
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-bold tabular-nums border ${theme.badgeClass}`}
                >
                  <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {card.percent}%
                </span>
              </div>

              <div className="relative z-10 mt-1.5 sm:mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/10">
                  <motion.div
                    className={`relative h-full rounded-full bg-gradient-to-r ${card.barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(card.count > 0 ? 6 : 0, card.percent))}%` }}
                    transition={{ duration: prefersReducedMotion ? 0.01 : 0.65, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
                  </motion.div>
                </div>
                <div className="mt-1 sm:mt-1.5 flex items-center justify-between gap-1 sm:gap-1.5 text-[10px] sm:text-[10.5px] text-slate-600">
                  <span className="font-medium truncate">{card.sublabel}</span>
                  <span className={`text-[9.5px] sm:text-[10px] font-semibold shrink-0 ${theme.textAccent}`}>
                    {isSelected ? 'Activo' : 'Filtrar'}
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Executive Ticket Promedio + Live Funnel Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3">
        <motion.div
          data-preserve-surface="true"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.16, duration: 0.35 }}
          className="lg:col-span-7 relative overflow-hidden flex items-center justify-between gap-2.5 sm:gap-3 rounded-[18px] sm:rounded-[20px] px-3.5 sm:px-4 py-2.5 sm:py-3 text-[#F5F2EB] border"
          style={{
            background: theme.heroGradient,
            borderColor: isVendedor ? 'rgba(200, 168, 91, 0.42)' : 'rgba(226, 194, 117, 0.28)',
            boxShadow: `0 18px 38px -16px ${theme.glowRgba}, inset 0 1px 0 rgba(233, 206, 138, 0.24)`,
          }}
        >
          {/* Specular champagne glass sheen overlay */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E9CE8A]/60 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-12 -top-16 h-40 w-48 rounded-full bg-white/[0.06] blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none hidden sm:block absolute -right-10 -bottom-10 h-32 w-32 rounded-full blur-2xl"
            style={{ backgroundColor: isVendedor ? 'rgba(200, 168, 91, 0.20)' : 'rgba(226, 194, 117, 0.13)' }}
          />
          <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.09] backdrop-blur-md border"
              style={{
                borderColor: isVendedor ? 'rgba(200, 168, 91, 0.44)' : 'rgba(226, 194, 117, 0.30)',
                color: heroHighlightColor,
              }}
            >
              <ReceiptText className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-[#F5F2EB] tracking-wide truncate">Ticket promedio</p>
              <p className={`text-[11px] sm:text-xs line-clamp-1 ${heroSubColor}`}>
                {ordenesCount > 0
                  ? `${ordenesCount} ${ordenesCount === 1 ? 'orden cerrada' : 'órdenes cerradas'} · Total $${totalVolume.toLocaleString('en-US')}`
                  : 'Valor base configurado en Dashboard Operativo'}
              </p>
            </div>
          </div>
          <div
            className="relative z-10 shrink-0 text-lg sm:text-[26px] font-bold tracking-tight"
            style={{ color: heroHighlightColor }}
          >
            <AnimatedNumber value={avgTicket} prefix="$" />
          </div>
        </motion.div>

        {/* VIP Credit Spotlight Card */}
        <motion.button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'vip' ? 'all' : 'vip')}
          onPointerMove={handleCardPointerMove}
          onPointerLeave={handleCardPointerLeave}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: 0.35 }}
          whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.005 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          className={`group relative overflow-hidden lg:col-span-5 flex min-h-[54px] sm:min-h-[60px] items-center justify-between gap-2.5 sm:gap-3 rounded-[18px] sm:rounded-[20px] dsb-glass border px-3.5 sm:px-4 py-2.5 sm:py-3 text-left transition-all cursor-pointer ${
            activeFilter === 'vip'
              ? theme.ringClass
              : 'hover:border-[#68AB8E]/45'
          }`}
          style={{
            ['--spot-color' as string]: theme.spotlightRgba,
            borderColor: activeFilter === 'vip' ? theme.mid : undefined,
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
            style={{
              opacity: 'var(--spot-opacity, 0)',
              background:
                'radial-gradient(300px circle at var(--spot-x, 50%) var(--spot-y, 50%), var(--spot-color), transparent 70%)',
            }}
          />
          <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span
              data-dsb-icon-tile="vip"
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100/90 to-amber-100/90 text-emerald-700 border border-emerald-200/80 shadow-xs group-hover:scale-105 transition-transform"
            >
              <Flame className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">Buen Crédito (VIP)</p>
              <p className="text-[11px] sm:text-xs text-slate-600 truncate">
                {pct(vipLeads, totalLeads)}% con alto potencial crediticio
              </p>
            </div>
          </div>
          <div className="relative z-10 text-right shrink-0">
            <span className="text-lg sm:text-2xl font-bold text-emerald-700 tabular-nums">
              <AnimatedNumber value={vipLeads} />
            </span>
            <span className="block text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              {activeFilter === 'vip' ? 'VIP Activo' : 'Filtrar VIP'}
            </span>
          </div>
        </motion.button>
      </div>
    </section>
  );
};
