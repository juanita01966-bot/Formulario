import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  ChevronRight,
  Flame,
  Package,
  ReceiptText,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { Lead } from '../../types/app';

export type KpiFilterKey = 'all' | 'vip' | 'pending' | 'called' | 'cita' | 'demo' | 'orden';

interface KpiGridProps {
  leads: Lead[];
  defaultTicketAmount: number;
  activeFilter: KpiFilterKey;
  onSelectFilter: (filter: KpiFilterKey) => void;
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
}) => {
  const totalLeads = leads.length;
  const calledLeads = leads.filter((l) => l.called).length;
  const vipLeads = leads.filter((l) => l.qualification?.tier === 'alto').length;
  const citasCount = leads.filter((l) => l.category === 'cita').length;
  const demosCount = leads.filter((l) => l.category === 'demo').length;
  const ordenesLeads = leads.filter((l) => l.category === 'orden');
  const ordenesCount = ordenesLeads.length;

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  const prospectosPct = pct(calledLeads, totalLeads);
  const citasPct = pct(citasCount, totalLeads);
  const demosPct = pct(demosCount, totalLeads);
  const ordenesPct = pct(ordenesCount, Math.max(demosCount + ordenesCount, totalLeads));

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
      title: 'Prospectos',
      count: totalLeads,
      percent: prospectosPct,
      sublabel: `${calledLeads} llamados`,
      icon: Users,
      topBar: 'from-amber-400 to-amber-600',
      iconBg: 'bg-gradient-to-br from-amber-100 to-amber-200/80 text-[#B7791F]',
      barColor: 'from-[#F6AD55] to-[#D69E2E]',
      glowBg: 'from-amber-400/15 to-transparent',
      ringColor: 'ring-amber-400/60 border-amber-300',
    },
    {
      key: 'cita' as KpiFilterKey,
      title: 'Citas',
      count: citasCount,
      percent: citasPct,
      sublabel: 'del total',
      icon: Calendar,
      topBar: 'from-rose-400 to-rose-600',
      iconBg: 'bg-gradient-to-br from-rose-100 to-rose-200/80 text-[#C53030]',
      barColor: 'from-[#FC8181] to-[#E53E3E]',
      glowBg: 'from-rose-400/15 to-transparent',
      ringColor: 'ring-rose-400/60 border-rose-300',
    },
    {
      key: 'demo' as KpiFilterKey,
      title: 'Demos',
      count: demosCount,
      percent: demosPct,
      sublabel: 'en muestra',
      icon: Briefcase,
      topBar: 'from-sky-400 to-sky-600',
      iconBg: 'bg-gradient-to-br from-sky-100 to-sky-200/80 text-[#2B6CB0]',
      barColor: 'from-[#63B3ED] to-[#3182CE]',
      glowBg: 'from-sky-400/15 to-transparent',
      ringColor: 'ring-sky-400/60 border-sky-300',
    },
    {
      key: 'orden' as KpiFilterKey,
      title: 'Órdenes',
      count: ordenesCount,
      percent: ordenesPct,
      sublabel: 'cerradas',
      icon: Package,
      topBar: 'from-emerald-400 to-emerald-600',
      iconBg: 'bg-gradient-to-br from-emerald-100 to-emerald-200/80 text-[#2F855A]',
      barColor: 'from-[#68D391] to-[#38A169]',
      glowBg: 'from-emerald-400/15 to-transparent',
      ringColor: 'ring-emerald-400/60 border-emerald-300',
    },
  ];

  return (
    <section aria-label="Indicadores de desempeño Métricas Cipriano" className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          const isSelected = activeFilter === card.key;
          return (
            <motion.button
              key={card.key}
              type="button"
              onClick={() => onSelectFilter(isSelected && card.key !== 'all' ? 'all' : card.key)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.35 }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              className={`group relative overflow-hidden rounded-[22px] bg-[#FFFDF9] p-4 sm:p-5 text-left border transition-all cursor-pointer shadow-[0_10px_28px_-14px_rgba(34,21,14,0.16)] hover:shadow-[0_18px_36px_-14px_rgba(184,74,39,0.22)] ${
                isSelected ? `ring-2 ${card.ringColor}` : 'border-[#E6D5BF]/90 hover:border-[#CFAF8A]'
              }`}
            >
              {/* Colored top strip */}
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.topBar}`} />
              {/* Soft radial corner glow */}
              <div
                className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${card.glowBg} blur-xl opacity-70 group-hover:opacity-100 transition-opacity`}
              />

              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-xs group-hover:scale-110 transition-transform ${card.iconBg}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-semibold text-[#594133]">{card.title}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#B89D86] group-hover:translate-x-1 transition-transform" />
              </div>

              <div className="relative mt-4 flex items-baseline justify-between">
                <div className="text-3xl sm:text-[36px] font-bold tracking-tight text-[#22150E]">
                  <AnimatedNumber value={card.count} />
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FAF3E8] px-2 py-0.5 text-[11px] font-bold text-[#8C4A19] tabular-nums">
                  <TrendingUp className="h-3 w-3 text-[#C88A2B]" />
                  {card.percent}%
                </span>
              </div>

              <div className="relative mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFE5D8]">
                  <motion.div
                    className={`relative h-full rounded-full bg-gradient-to-r ${card.barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(card.count > 0 ? 6 : 0, card.percent))}%` }}
                    transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer" />
                  </motion.div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[#7B5D4A]">
                  <span className="font-medium">{card.sublabel}</span>
                  <span className="text-[11px] text-[#9B816E]">Clic para filtrar</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Executive Ticket Promedio + Live Funnel Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:col-span-7 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[22px] bg-gradient-to-r from-[#22150E] via-[#3B2014] to-[#6B2B17] border border-[#C88A2B]/40 px-5 py-4.5 text-[#FAF3E8] shadow-[0_16px_32px_-14px_rgba(34,21,14,0.45)]"
        >
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-amber-400/15 blur-2xl" />
          <div className="relative flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 border border-amber-300/35 text-[#FDE68A]">
              <ReceiptText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#FFFDF9]">Ticket promedio</p>
              <p className="text-xs text-amber-200/80">
                {ordenesCount > 0
                  ? `${ordenesCount} ${ordenesCount === 1 ? 'orden cerrada' : 'órdenes cerradas'} · Total $${totalVolume.toLocaleString('en-US')}`
                  : 'Valor base configurado en Métricas Cipriano'}
              </p>
            </div>
          </div>
          <div className="relative text-2xl sm:text-[30px] font-bold tracking-tight text-[#FDE68A]">
            <AnimatedNumber value={avgTicket} prefix="$" />
          </div>
        </motion.div>

        {/* VIP Credit Spotlight Card */}
        <motion.button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'vip' ? 'all' : 'vip')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          whileHover={{ y: -2 }}
          className={`lg:col-span-5 flex items-center justify-between gap-3 rounded-[22px] border px-5 py-4 text-left transition-all cursor-pointer shadow-[0_10px_24px_-14px_rgba(34,21,14,0.14)] ${
            activeFilter === 'vip'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/40'
              : 'bg-[#FFFDF9] border-[#E6D5BF] hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-amber-100 text-emerald-700 border border-emerald-200">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#22150E]">Buen Crédito (VIP)</p>
              <p className="text-xs text-[#6E5341]">
                {pct(vipLeads, totalLeads)}% con alto potencial crediticio
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">
              <AnimatedNumber value={vipLeads} />
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Filtrar VIP
            </span>
          </div>
        </motion.button>
      </div>
    </section>
  );
};
