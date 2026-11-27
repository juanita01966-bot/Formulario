import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarCheck2,
  Check,
  Gift,
  MapPin,
  PauseCircle,
  Phone,
  QrCode,
  Search,
  X,
} from 'lucide-react';
import type { CallOutcome, Lead, ReferralPartner } from '../../types/app';
import type { UpdateLeadPayload } from '../../services/storeClient';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { GlassSpotlightCard } from './GlassSpotlightCard';
import { RoleEmblemBadge, RoleSymbolSvg } from './RoleEmblem';
import { getRoleTheme } from './roleTheme';

interface TelemarketingProspectsViewProps {
  leads: Lead[];
  referrers?: ReferralPartner[];
  operatorName?: string;
  onUpdateLead: (id: string, updates: UpdateLeadPayload) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const TelemarketingProspectsView: React.FC<TelemarketingProspectsViewProps> = ({
  leads,
  referrers = [],
  operatorName,
  onUpdateLead,
  onBusyChange,
}) => {
  const [search, setSearch] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<{
    lead: Lead;
    outcome: Exclude<CallOutcome, 'pending'>;
  } | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    onBusyChange?.(Boolean(pendingConfirm) || Boolean(submittingId));
    return () => onBusyChange?.(false);
  }, [pendingConfirm, submittingId, onBusyChange]);

  const cyanTheme = getRoleTheme('telemarketing');

  const referrerLookup = useMemo(() => {
    const byId = new Map<string, ReferralPartner>();
    const byCode = new Map<string, ReferralPartner>();
    for (const r of referrers) {
      byId.set(r.id, r);
      byCode.set(r.code.trim().toUpperCase(), r);
    }
    return { byId, byCode };
  }, [referrers]);

  const resolveAttribution = (
    lead: Lead
  ): { sellerName: string | null; code: string | null; avatarUrl: string | null } => {
    const code = (lead.referralCode || '').trim().toUpperCase();
    const partner =
      (lead.referrerId ? referrerLookup.byId.get(lead.referrerId) : undefined) ||
      (code ? referrerLookup.byCode.get(code) : undefined);
    const sellerName = partner?.name || lead.referrerName || null;
    const finalCode = code || partner?.code || null;
    return { sellerName, code: finalCode, avatarUrl: partner?.avatarUrl ?? null };
  };

  // Queue strictly displays ONLY pending leads
  const pendingLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const outcome = lead.callOutcome ?? (lead.called ? 'scheduled' : 'pending');
        return outcome === 'pending';
      }),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingLeads;
    const rawCode = q.replace(/^#/, '');
    return pendingLeads.filter((lead) => {
      const name = (lead.name || '').toLowerCase();
      const phone = (lead.phone || '').toLowerCase();
      const address = (lead.address || '').toLowerCase();
      const claimCode = (lead.claimCode || '').toLowerCase();
      const attr = resolveAttribution(lead);
      const sellerStr = `${attr.sellerName || ''} ${attr.code || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        address.includes(q) ||
        sellerStr.includes(q) ||
        (claimCode
          ? claimCode.includes(rawCode) || claimCode.replace(/^otn-/, '').includes(rawCode)
          : false)
      );
    });
  }, [pendingLeads, search, referrerLookup]);

  const handleOpenConfirm = (lead: Lead, outcome: Exclude<CallOutcome, 'pending'>) => {
    setFeedbackBanner(null);
    setModalError(null);
    setPendingConfirm({ lead, outcome });
  };

  const handleCancelConfirm = () => {
    if (submittingId) return;
    setModalError(null);
    setPendingConfirm(null);
  };

  const handleConfirmOutcome = async () => {
    if (!pendingConfirm || submittingId) return;
    const { lead, outcome } = pendingConfirm;
    setSubmittingId(lead.id);
    setModalError(null);
    setFeedbackBanner(null);
    try {
      await onUpdateLead(lead.id, { callOutcome: outcome });
      setPendingConfirm(null);
      setFeedbackBanner({
        type: 'success',
        text:
          outcome === 'scheduled'
            ? `"${lead.name}" marcado como Llamado · Sí agendó cita y enviado al Vendedor.`
            : `"${lead.name}" marcado como Llamado · No agendó y movido a Reposo.`,
      });
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : 'No se pudo registrar el resultado de la llamada.'
      );
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <>
    <GlassSpotlightCard
      as="section"
      role="telemarketing"
      className="rounded-[24px] sm:rounded-[28px] border border-[#0891B2]/25 p-3 sm:p-6 shadow-[0_18px_42px_-18px_rgba(11,79,108,0.22)]"
    >
      {/* Top Tactical Cyan Accent Strip */}
      <div
        aria-hidden="true"
        className="pointer-events-none -mx-3 -mt-3 sm:-mx-6 sm:-mt-6 mb-3.5 sm:mb-5 h-1.5"
        style={{ background: cyanTheme.headerStrip }}
      />

      {/* Tactical Cyan Glass Header Banner */}
      <div
        data-dsb-banner="cyan"
        className="relative overflow-hidden rounded-2xl border border-[#0891B2]/25 bg-gradient-to-r from-[#0B4F6C]/10 via-white/65 to-[#06B6D4]/12 backdrop-blur-md p-3 sm:p-5"
      >
        {/* Cyan sonar ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full blur-2xl"
          style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.30) 0%, transparent 72%)' }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#0B4F6C]/10 border border-[#0891B2]/30 shadow-[0_6px_18px_-8px_rgba(6,182,212,0.45)]">
              <RoleSymbolSvg role="telemarketing" className="h-7 w-7 sm:h-9 sm:w-9" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="font-serif text-base sm:text-2xl font-bold text-[#082F40] leading-snug">
                  Cola de Llamadas · Telemarketing
                </h2>
                <RoleEmblemBadge
                  role="telemarketing"
                  displayName={operatorName}
                  size="sm"
                  showCodename={!operatorName}
                />
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#2A596D] leading-relaxed">
                Contacta a cada prospecto pendiente y registra si agendó cita o pasa a reposo. Una vez marcado desaparecerá de esta cola.
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md border border-[#0891B2]/35 px-3 py-1.5 text-xs font-semibold text-[#0B4F6C] shadow-[0_6px_16px_-10px_rgba(8,145,178,0.4)]">
              <span className="h-2 w-2 rounded-full bg-[#06B6D4] shadow-[0_0_8px_#06B6D4]" />
              Pendientes:{' '}
              <strong className="text-sm font-bold text-[#07364B] tabular-nums">
                {filteredLeads.length}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      <AnimatePresence>
        {feedbackBanner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`mt-4 flex items-start justify-between gap-3 rounded-2xl border backdrop-blur-md px-4 py-3 text-xs font-semibold ${
              feedbackBanner.type === 'success'
                ? 'border-emerald-300/80 bg-emerald-50/85 text-emerald-950'
                : 'border-rose-300/80 bg-rose-50/85 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-2">
              {feedbackBanner.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span>{feedbackBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              aria-label="Cerrar mensaje"
              className="text-current opacity-70 hover:opacity-100 cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Input */}
      <div className="mt-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0891B2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, vendedor, tag o Nº de orden..."
            className="w-full min-h-[44px] rounded-xl border border-[#0891B2]/28 bg-white/72 backdrop-blur-md py-2.5 pl-10 pr-4 text-base sm:text-sm text-[#082F40] placeholder:text-[#5B8394] focus:border-[#0891B2] focus:bg-white/95 focus:ring-4 focus:ring-[#06B6D4]/15 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Pending Leads List */}
      <div className="mt-4 sm:mt-5 space-y-3">
        {filteredLeads.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="dsb-glass-subtle rounded-2xl border border-dashed border-[#0891B2]/35 py-12 text-center px-4"
          >
            <p className="font-serif text-lg font-semibold text-[#0B4F6C]">
              {pendingLeads.length === 0
                ? '¡Cola al día! Sin prospectos pendientes por llamar'
                : 'Sin coincidencias para tu búsqueda'}
            </p>
            <p className="mt-1 text-xs text-[#3C6C80]">
              {pendingLeads.length === 0
                ? 'Cuando ingresen nuevos registros desde los QRs de los vendedores aparecerán aquí automáticamente.'
                : 'Intenta con otro nombre, teléfono, tag o número de orden.'}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredLeads.map((lead, index) => {
              const cleanTel = (lead.phone || '').replace(/[^\d+]/g, '');
              const attr = resolveAttribution(lead);
              const isBusy = submittingId === lead.id;

              return (
                <motion.div
                  key={lead.id || `lead-${index}`}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 24, scale: 0.97 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="dsb-glass-subtle min-w-0 max-w-full rounded-2xl border border-[#0891B2]/25 p-3 sm:p-4 hover:border-[#06B6D4]/70 hover:bg-white/78 hover:shadow-[0_12px_28px_-12px_rgba(6,182,212,0.34)] transition-all space-y-3"
                >
                  {/* Top Attribution & Lead Info */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                        <p className="text-[15px] sm:text-base font-bold text-[#082F40] min-w-0 max-w-full break-words">
                          {lead.name || 'Sin nombre'}
                        </p>
                        {lead.claimCode && (
                          <span className="max-w-full break-words rounded-md bg-[#CFFAFE]/75 border border-[#0891B2]/30 px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#0B4F6C]">
                            Orden {lead.claimCode}
                          </span>
                        )}
                        {attr.sellerName || attr.code ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-[#3F5432]/35 bg-[#E6EEDB]/80 pl-1 pr-2.5 py-0.5 text-[11px] font-bold text-[#2B3A24] shadow-2xs">
                            {attr.avatarUrl ? (
                              <AmbassadorAvatar
                                name={attr.sellerName || attr.code}
                                avatarUrl={attr.avatarUrl}
                                size="xs"
                                ring="none"
                              />
                            ) : (
                              <QrCode className="h-3 w-3 shrink-0 text-[#3F5432] ml-1" />
                            )}
                            <span className="min-w-0 break-words">
                              Vendedor: {attr.sellerName || attr.code}
                              {attr.sellerName && attr.code ? ` · ${attr.code}` : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/75 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            Orgánico
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-[#1E4455] min-w-0">
                        <a
                          href={cleanTel ? `tel:${cleanTel}` : undefined}
                          className="inline-flex min-h-[38px] sm:min-h-0 max-w-full items-center gap-1.5 rounded-xl sm:rounded-none border border-[#0891B2]/30 sm:border-0 bg-[#CFFAFE]/55 sm:bg-transparent px-3 sm:px-0 py-1.5 sm:py-0 font-mono text-sm font-bold text-[#0B4F6C] hover:text-[#0891B2] hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0 text-[#0891B2]" />
                          <span className="tabular-nums break-all">{lead.phone || 'Sin teléfono'}</span>
                        </a>

                        {lead.giftName && (
                          <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-semibold text-[#0B4F6C]">
                            <Gift className="h-3.5 w-3.5 shrink-0 text-[#0891B2]" />
                            <span className="min-w-0 break-words">{lead.giftName}</span>
                          </span>
                        )}

                        {lead.createdAt && (
                          <span className="text-xs text-[#4C7385]">{formatDate(lead.createdAt)}</span>
                        )}
                      </div>

                      {lead.address && (
                        <p className="flex items-start gap-1.5 w-full min-w-0 text-xs text-[#31596B]">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0891B2] mt-0.5" />
                          <span className="break-words min-w-0">{lead.address}</span>
                        </p>
                      )}
                    </div>

                    {/* Two Telemarketing Disposition Buttons */}
                    <div className="grid grid-cols-1 sm:flex sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-[#0891B2]/18">
                      <button
                        type="button"
                        disabled={Boolean(submittingId)}
                        onClick={() => handleOpenConfirm(lead, 'scheduled')}
                        className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 sm:px-4 py-2 text-xs font-bold text-white text-center leading-snug shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <CalendarCheck2 className="h-4 w-4 shrink-0" />
                        <span>{isBusy ? 'Guardando...' : 'Llamado · Sí agendó cita'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(submittingId)}
                        onClick={() => handleOpenConfirm(lead, 'not_scheduled')}
                        className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-amber-300/90 bg-amber-50/85 hover:bg-amber-100/90 px-3.5 sm:px-4 py-2 text-xs font-bold text-amber-950 text-center leading-snug transition-all cursor-pointer disabled:opacity-50"
                      >
                        <PauseCircle className="h-4 w-4 shrink-0 text-amber-700" />
                        <span>{isBusy ? 'Guardando...' : 'Llamado · No agendó (Reposo)'}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Quick Confirmation Modal (outside GlassSpotlightCard so overflow-hidden/backdrop-filter never clips fixed modal) */}
    </GlassSpotlightCard>
      <AnimatePresence>
        {pendingConfirm && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="telemarketing-confirm-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#062331]/60 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto"
            onClick={handleCancelConfirm}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="dsb-glass-strong w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[24px] sm:rounded-[26px] border border-[#0891B2]/35 p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4"
            >
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div
                    className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border ${
                      pendingConfirm.outcome === 'scheduled'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-300 text-amber-800'
                    }`}
                  >
                    {pendingConfirm.outcome === 'scheduled' ? (
                      <CalendarCheck2 className="h-5 w-5" />
                    ) : (
                      <PauseCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0891B2] block">
                      Confirmar gestión telefónica
                    </span>
                    <h3
                      id="telemarketing-confirm-title"
                      className="font-serif text-base sm:text-lg font-bold text-[#082F40] leading-snug"
                    >
                      {pendingConfirm.outcome === 'scheduled'
                        ? '¿Confirmar cita agendada?'
                        : '¿Mover prospecto a Reposo?'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(submittingId)}
                  onClick={handleCancelConfirm}
                  aria-label="Cerrar confirmación"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[#3C6C80] hover:bg-[#CFFAFE]/60 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-[#0891B2]/25 bg-white/75 p-3 sm:p-3.5 text-xs space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#3C6C80] shrink-0">Prospecto:</span>
                  <strong className="text-[#082F40] text-right min-w-0 break-words">{pendingConfirm.lead.name}</strong>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#3C6C80] shrink-0">Teléfono:</span>
                  <span className="font-mono font-bold text-[#082F40] text-right min-w-0 break-all">{pendingConfirm.lead.phone}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#3C6C80] shrink-0">Resultado:</span>
                  <strong
                    className={`text-right min-w-0 break-words ${
                      pendingConfirm.outcome === 'scheduled' ? 'text-emerald-700' : 'text-amber-900'
                    }`}
                  >
                    {pendingConfirm.outcome === 'scheduled'
                      ? 'Llamado · Sí agendó cita'
                      : 'Llamado · No agendó (Reposo)'}
                  </strong>
                </div>
              </div>

              <p className="text-xs text-[#2A596D] leading-relaxed">
                {pendingConfirm.outcome === 'scheduled'
                  ? 'El prospecto desaparecerá de tu cola y quedará habilitado en el panel del Vendedor para su seguimiento.'
                  : 'El prospecto desaparecerá de tu cola y pasará a la sección En Reposo del panel de métricas.'}
              </p>

              {modalError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={Boolean(submittingId)}
                  onClick={handleCancelConfirm}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-[#0891B2]/30 bg-white/75 px-4 py-2 text-xs font-semibold text-[#0B4F6C] hover:bg-[#CFFAFE]/50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(submittingId)}
                  onClick={handleConfirmOutcome}
                  className={`min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-white shadow cursor-pointer disabled:opacity-60 ${
                    pendingConfirm.outcome === 'scheduled'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-700 hover:bg-amber-800'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {submittingId ? 'Guardando...' : 'Confirmar y quitar de cola'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
