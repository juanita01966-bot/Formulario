import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarCheck2,
  ChevronDown,
  Clock,
  MapPin,
  PauseCircle,
  Phone,
  QrCode,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import type { Lead, ReferralPartner, UserAccount, UserRole } from '../../types/app';
import type { UpdateLeadPayload } from '../../services/storeClient';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { getRoleTheme } from './roleTheme';

interface ReposoProspectsSectionProps {
  leads: Lead[];
  referrers?: ReferralPartner[];
  accounts?: UserAccount[];
  userRole: UserRole;
  onUpdateLead?: (id: string, updates: UpdateLeadPayload) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

function formatDateTime(iso?: string | null): string {
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

export const ReposoProspectsSection: React.FC<ReposoProspectsSectionProps> = ({
  leads,
  referrers = [],
  accounts = [],
  userRole,
  onUpdateLead,
  onBusyChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange?.(Boolean(busyId));
    return () => onBusyChange?.(false);
  }, [busyId, onBusyChange]);

  const roleTheme = getRoleTheme(userRole);

  const reposoLeads = useMemo(
    () => leads.filter((l) => l.callOutcome === 'not_scheduled'),
    [leads]
  );

  const sellerLookup = useMemo(() => {
    const byId = new Map<string, { name: string; code: string; avatarUrl: string | null }>();
    const byCode = new Map<string, { name: string; code: string; avatarUrl: string | null }>();

    for (const acc of accounts) {
      if (acc.role !== 'vendedor') continue;
      const code = acc.tag.trim().toUpperCase();
      const entry = { name: acc.displayName, code, avatarUrl: acc.avatarUrl ?? null };
      if (acc.referrerId) byId.set(acc.referrerId, entry);
      if (code) byCode.set(code, entry);
    }
    for (const ref of referrers) {
      const code = ref.code.trim().toUpperCase();
      const existingById = byId.get(ref.id);
      if (existingById) {
        if (!existingById.avatarUrl && ref.avatarUrl) existingById.avatarUrl = ref.avatarUrl;
      } else {
        byId.set(ref.id, { name: ref.name, code, avatarUrl: ref.avatarUrl ?? null });
      }
      if (code) {
        const existingByCode = byCode.get(code);
        if (existingByCode) {
          if (!existingByCode.avatarUrl && ref.avatarUrl) existingByCode.avatarUrl = ref.avatarUrl;
        } else {
          byCode.set(code, { name: ref.name, code, avatarUrl: ref.avatarUrl ?? null });
        }
      }
    }
    return { byId, byCode };
  }, [accounts, referrers]);

  const resolveSeller = (
    lead: Lead
  ): { name: string; code: string; avatarUrl: string | null } | null => {
    const code = (lead.referralCode || '').trim().toUpperCase();
    const matched =
      (lead.referrerId ? sellerLookup.byId.get(lead.referrerId) : undefined) ||
      (code ? sellerLookup.byCode.get(code) : undefined);
    if (matched) return matched;
    if (lead.referrerName || code) {
      return { name: lead.referrerName || code, code, avatarUrl: null };
    }
    return null;
  };

  const handleTransition = async (lead: Lead, nextOutcome: 'pending' | 'scheduled') => {
    if (!onUpdateLead || busyId) return;
    setErrorMsg(null);
    setBusyId(lead.id);
    try {
      await onUpdateLead(lead.id, { callOutcome: nextOutcome });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar el estado del prospecto.');
    } finally {
      setBusyId(null);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <section
      aria-label="Prospectos en reposo (No agendados)"
      className="dsb-glass rounded-[24px] sm:rounded-[26px] overflow-hidden border border-amber-400/45 shadow-[0_16px_36px_-18px_rgba(34,21,14,0.18)]"
      style={{
        boxShadow: `0 16px 36px -20px ${roleTheme.glowRgba}, inset 0 1px 0 rgba(255,255,255,0.85)`,
      }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        data-dsb-banner="amber"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-3.5 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-gradient-to-r from-amber-50/70 via-white/40 to-amber-50/35 text-left cursor-pointer hover:bg-white/60 transition-colors"
      >
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/85 border border-amber-300/90 text-amber-900 shadow-2xs">
            <PauseCircle className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="font-serif text-base sm:text-xl font-bold text-[#1F1714] leading-snug">
                En Reposo · No Agendados
              </h2>
              <span className="inline-flex items-center rounded-full bg-amber-200/75 border border-amber-400/50 px-2.5 py-0.5 text-[11px] sm:text-xs font-bold text-amber-950 tabular-nums">
                {reposoLeads.length} {reposoLeads.length === 1 ? 'prospecto' : 'prospectos'}
              </span>
            </div>
            <p className="text-xs text-[#6B5447] mt-0.5 leading-relaxed">
              {isAdmin
                ? 'Prospectos llamados por Telemarketing que no agendaron cita. Puedes reactivarlos a pendiente o pasarlos a agendado.'
                : 'Prospectos llamados por Telemarketing que no agendaron cita (vista de solo lectura).'}
            </p>
          </div>
        </div>

        <div
          className={`inline-flex min-h-[38px] sm:min-h-0 w-full sm:w-auto items-center justify-between sm:justify-center gap-1.5 rounded-full border border-white/65 bg-white/65 px-3.5 sm:px-3 py-1.5 text-xs font-bold shrink-0 sm:self-center shadow-2xs ${roleTheme.textAccent}`}
        >
          <span>{expanded ? 'Ocultar lista' : 'Ver en reposo'}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/60"
          >
            <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3">
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="min-w-0 break-words">{errorMsg}</span>
                </div>
              )}

              {reposoLeads.length === 0 ? (
                <div className="dsb-glass-subtle rounded-2xl border border-dashed border-amber-300/70 py-8 px-4 text-center">
                  <p className="font-serif text-base font-semibold text-[#4B362A]">
                    No hay prospectos en reposo en este período
                  </p>
                  <p className="mt-1 text-xs text-[#7B6253]">
                    Los contactos que Telemarketing marque como “No agendó” aparecerán aquí automáticamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {reposoLeads.map((lead) => {
                    const seller = resolveSeller(lead);
                    const cleanTel = (lead.phone || '').replace(/[^\d+]/g, '');
                    const isBusy = busyId === lead.id;

                    return (
                      <motion.div
                        key={lead.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="dsb-glass-subtle min-w-0 max-w-full rounded-2xl border border-amber-300/55 p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-white/75 transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                            <h3 className="text-sm sm:text-[15px] font-bold text-[#1F1714] min-w-0 max-w-full break-words">
                              {lead.name}
                            </h3>
                            <span className="max-w-full break-words rounded-md bg-white/80 border border-amber-300/70 px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#8C4A19]">
                              Orden {lead.claimCode}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              <PauseCircle className="h-3 w-3 shrink-0" />
                              En Reposo
                            </span>
                            {seller ? (
                              <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-[#3F5432]/30 bg-[#E6EEDB]/80 pl-1 pr-2.5 py-0.5 text-[10.5px] font-bold text-[#2B3A24]">
                                {seller.avatarUrl ? (
                                  <AmbassadorAvatar
                                    name={seller.name}
                                    avatarUrl={seller.avatarUrl}
                                    size="xs"
                                    ring="none"
                                  />
                                ) : (
                                  <QrCode className="h-3 w-3 shrink-0 text-[#3F5432] ml-1" />
                                )}
                                <span className="min-w-0 break-words">
                                  Vendedor: {seller.name}
                                  {seller.code ? ` · ${seller.code}` : ''}
                                </span>
                              </span>
                            ) : (
                              <span className="rounded-full border border-stone-200/80 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                                Orgánico
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#594336] min-w-0">
                            <a
                              href={cleanTel ? `tel:${cleanTel}` : undefined}
                              className={`inline-flex items-center gap-1 font-mono font-semibold hover:underline break-all ${roleTheme.textAccent}`}
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              {lead.phone}
                            </a>
                            {lead.calledBy && (
                              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                                <UserCheck className="h-3 w-3 shrink-0 text-[#0891B2]" />
                                <span className="min-w-0 break-words">
                                  Llamado por: <strong className="text-[#1F1714]">{lead.calledBy}</strong>
                                </span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0 text-[#8A7162]" />
                              {formatDateTime(lead.calledAt || lead.createdAt)}
                            </span>
                          </div>

                          {lead.address && (
                            <p className="flex items-start gap-1.5 w-full min-w-0 text-xs text-[#594336]">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#8B0018]/75 mt-0.5" />
                              <span className="min-w-0 break-words">{lead.address}</span>
                            </p>
                          )}
                        </div>

                        {isAdmin && onUpdateLead && (
                          <div className="grid grid-cols-1 sm:flex sm:flex-nowrap items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-amber-300/40">
                            <button
                              type="button"
                              disabled={Boolean(busyId)}
                              onClick={() => handleTransition(lead, 'pending')}
                              className="inline-flex min-h-[42px] sm:min-h-[40px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-[#8B0018]/25 bg-white/85 px-3.5 py-2 text-xs font-bold text-[#8B0018] hover:bg-[#FEE2E2]/70 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5 shrink-0 text-[#B91C1C]" />
                              <span>{isBusy ? 'Actualizando...' : 'Reactivar a Pendiente'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyId)}
                              onClick={() => handleTransition(lead, 'scheduled')}
                              className="inline-flex min-h-[42px] sm:min-h-[40px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <CalendarCheck2 className="h-3.5 w-3.5 shrink-0" />
                              <span>{isBusy ? 'Actualizando...' : 'Pasar a Agendado'}</span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
