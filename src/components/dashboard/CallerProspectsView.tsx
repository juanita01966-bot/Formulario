import React, { useMemo, useState } from 'react';
import { Phone, MapPin, QrCode, Search, UserCheck } from 'lucide-react';
import type { Lead, ReferralPartner } from '../../types/app';

interface CallerProspectsViewProps {
  leads: Lead[];
  referrers?: ReferralPartner[];
}

export const CallerProspectsView: React.FC<CallerProspectsViewProps> = ({
  leads,
  referrers = [],
}) => {
  const [search, setSearch] = useState('');

  const referrerLookup = useMemo(() => {
    const byId = new Map<string, ReferralPartner>();
    const byCode = new Map<string, ReferralPartner>();
    for (const r of referrers) {
      byId.set(r.id, r);
      byCode.set(r.code.trim().toUpperCase(), r);
    }
    return { byId, byCode };
  }, [referrers]);

  const resolveReferralLabel = (lead: Lead): string | null => {
    const code = (lead.referralCode || '').trim().toUpperCase();
    const partner =
      (lead.referrerId ? referrerLookup.byId.get(lead.referrerId) : undefined) ||
      (code ? referrerLookup.byCode.get(code) : undefined);
    const name = partner?.name || lead.referrerName || '';
    const finalCode = code || partner?.code || '';
    if (!name && !finalCode) return null;
    if (name && finalCode) return `QR · ${name} (${finalCode})`;
    return `QR · ${name || finalCode}`;
  };

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    const rawCode = q.replace(/^#/, '');
    return leads.filter((lead) => {
      const name = (lead.name || '').toLowerCase();
      const phone = (lead.phone || '').toLowerCase();
      const address = (lead.address || '').toLowerCase();
      const claimCode = (lead.claimCode || '').toLowerCase();
      const refBadge = (resolveReferralLabel(lead) || '').toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        address.includes(q) ||
        refBadge.includes(q) ||
        (claimCode ? claimCode.includes(rawCode) || claimCode.replace(/^otn-/, '').includes(rawCode) : false)
      );
    });
  }, [leads, search, referrerLookup]);

  return (
    <section className="rounded-[24px] sm:rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-3.5 sm:p-6 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)]">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 sm:pb-5 border-b border-[#EFE3D2]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#22150E]">
              Directorio de Clientes
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
              <UserCheck className="w-3.5 h-3.5" />
              Perfil Caller
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#7B5D4A]">
            Vista restringida de contacto. Acceso exclusivo a nombres, teléfonos y direcciones.
          </p>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span className="text-xs font-semibold text-[#8C6D58]">
            Total clientes:{' '}
            <strong className="text-sm font-bold text-[#22150E] tabular-nums">
              {filteredLeads.length}
            </strong>
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="mt-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9B816E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, dirección o Nº de orden..."
            className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] py-2.5 pl-10 pr-4 text-base sm:text-sm text-[#22150E] placeholder:text-[#9D8370] focus:border-[#B84A27] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Restricted Client List */}
      <div className="mt-4 sm:mt-5 space-y-2.5">
        {filteredLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DFCBB3] bg-[#FAF3E8]/40 py-12 text-center">
            <p className="font-serif text-lg font-semibold text-[#594133]">
              Sin clientes disponibles
            </p>
            <p className="mt-1 text-xs text-[#8B6F5B]">
              No se encontraron registros que coincidan con la búsqueda.
            </p>
          </div>
        ) : (
          filteredLeads.map((lead, index) => {
            const cleanTel = (lead.phone || '').replace(/[^\d+]/g, '');
            const referralBadge = resolveReferralLabel(lead);

            return (
              <div
                key={lead.id || `lead-${index}`}
                className="rounded-2xl border border-[#DFCBB3] bg-white p-3.5 sm:p-4 hover:border-[#C88A2B]/60 transition-colors shadow-sm"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 items-start md:items-center">
                  {/* Nombre */}
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#A2683A] block">
                      Nombre
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm sm:text-base font-bold text-[#22150E] break-words">
                        {lead.name || 'Sin nombre'}
                      </p>
                      {lead.claimCode && (
                        <span className="rounded-md bg-[#FAF0E0] border border-[#E6C99E] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8C4A19]">
                          Orden {lead.claimCode}
                        </span>
                      )}
                      {referralBadge && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#E5C17B] bg-[#FFF4DC] px-2 py-0.5 text-[10px] font-bold text-[#7A4610]">
                          <QrCode className="h-2.5 w-2.5 shrink-0 text-[#C88A2B]" />
                          {referralBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teléfono */}
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#A2683A] block mb-1 md:mb-0">
                      Teléfono
                    </span>
                    <a
                      href={cleanTel ? `tel:${cleanTel}` : undefined}
                      className="inline-flex min-h-[44px] md:min-h-0 items-center gap-2 rounded-xl md:rounded-none border border-[#E6D5BF] md:border-0 bg-[#FAF3E8] md:bg-transparent px-3 md:px-0 py-2 md:py-0 font-mono text-sm font-semibold text-[#B84A27] hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[#B84A27]" />
                      <span className="tabular-nums">{lead.phone || 'Sin teléfono'}</span>
                    </a>
                  </div>

                  {/* Dirección */}
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#A2683A] block">
                      Dirección
                    </span>
                    <p className="flex items-start gap-1.5 w-full min-w-0 text-xs sm:text-sm text-[#4E311E]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9B816E] mt-0.5" />
                      <span className="break-words min-w-0">{lead.address || 'Sin dirección registrada'}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
