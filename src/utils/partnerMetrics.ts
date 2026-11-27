import type {
  Lead,
  QrCodeRecord,
  ReferralPartner,
  ReferralVisitEvent,
  UserAccount,
} from '../types/app';

export interface ResolvedOwnerInfo {
  accountId: string | null;
  name: string;
  tag: string | null;
  avatarUrl: string | null;
  isDirect: boolean; // true when no vendedor is assigned ("Ciprian Directo")
}

export interface EmbajadorRollupMetrics {
  embajador: ReferralPartner;
  owner: ResolvedOwnerInfo;
  qrCount: number;
  qrs: QrCodeRecord[];
  leads: Lead[];
  leadsCount: number;
  citasCount: number;
  demosCount: number;
  ordenesCount: number;
  salesTotal: number;
  visitsCount: number;
  uniqueVisitsCount: number;
}

export interface VendedorRollupMetrics {
  accountId: string | null;
  partnerId: string | null;
  name: string;
  tag: string;
  avatarUrl: string | null;
  active: boolean;
  embajadores: ReferralPartner[];
  embajadoresCount: number;
  activeEmbajadoresCount: number;
  directQrCount: number;
  embajadoresQrCount: number;
  totalQrCount: number;
  directLeadsCount: number;
  embajadoresLeadsCount: number;
  leads: Lead[];
  totalLeadsCount: number;
  citasCount: number;
  demosCount: number;
  ordenesCount: number;
  salesTotal: number;
  visitsCount: number;
  uniqueVisitsCount: number;
  embajadoresBreakdown: EmbajadorRollupMetrics[];
}

export function normalizePartnerCode(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function leadMatchesPartner(lead: Lead, partner: ReferralPartner, partnerCodeNorm: string): boolean {
  if (lead.referrerId && lead.referrerId === partner.id) return true;
  if (partnerCodeNorm && normalizePartnerCode(lead.referralCode) === partnerCodeNorm) return true;
  return false;
}

function qrMatchesPartner(qr: QrCodeRecord, partner: ReferralPartner, partnerCodeNorm: string): boolean {
  if (qr.referrerId && qr.referrerId === partner.id) return true;
  if (partnerCodeNorm && normalizePartnerCode(qr.referralCode) === partnerCodeNorm) return true;
  return false;
}

function visitMatchesPartner(
  visit: ReferralVisitEvent,
  partner: ReferralPartner,
  partnerCodeNorm: string
): boolean {
  if (visit.referrerId && visit.referrerId === partner.id) return true;
  if (partnerCodeNorm && normalizePartnerCode(visit.referralCode) === partnerCodeNorm) return true;
  return false;
}

function computeLeadsBreakdown(matchedLeads: Lead[], defaultTicketAmount = 0) {
  let citasCount = 0;
  let demosCount = 0;
  let ordenesCount = 0;
  let salesTotal = 0;

  for (const lead of matchedLeads) {
    if (lead.category === 'cita') {
      citasCount += 1;
    } else if (lead.category === 'demo') {
      demosCount += 1;
    } else if (lead.category === 'orden') {
      ordenesCount += 1;
      const amt =
        typeof lead.orderAmount === 'number' && Number.isFinite(lead.orderAmount) && lead.orderAmount > 0
          ? lead.orderAmount
          : defaultTicketAmount;
      salesTotal += amt;
    }
  }

  return { citasCount, demosCount, ordenesCount, salesTotal };
}

export function resolveEmbajadorOwner(
  embajador: ReferralPartner,
  accounts: UserAccount[] = [],
  referrers: ReferralPartner[] = []
): ResolvedOwnerInfo {
  const ownerAccId = embajador.ownerVendedorAccountId || null;
  const ownerTagNorm = normalizePartnerCode(embajador.ownerVendedorTag);
  const ownerNameRaw = (embajador.ownerVendedorName || '').trim();

  const matchedAccount =
    (ownerAccId ? accounts.find((a) => a.id === ownerAccId) : undefined) ||
    (ownerTagNorm
      ? accounts.find(
          (a) => a.role === 'vendedor' && normalizePartnerCode(a.tag) === ownerTagNorm
        )
      : undefined) ||
    null;

  const resolvedAccId = matchedAccount?.id ?? ownerAccId;
  const resolvedTagNorm = normalizePartnerCode(matchedAccount?.tag || embajador.ownerVendedorTag);

  const matchedPartner =
    referrers.find((r) => {
      if (r.partnerType === 'embajador') return false;
      if (matchedAccount?.referrerId && r.id === matchedAccount.referrerId) return true;
      if (resolvedAccId && r.accountId === resolvedAccId) return true;
      if (resolvedTagNorm && normalizePartnerCode(r.code) === resolvedTagNorm) return true;
      return false;
    }) || null;

  const hasOwner = Boolean(
    matchedAccount || ownerAccId || ownerNameRaw || ownerTagNorm || matchedPartner
  );

  if (!hasOwner) {
    return {
      accountId: null,
      name: 'Ciprian Directo',
      tag: null,
      avatarUrl: null,
      isDirect: true,
    };
  }

  const tag =
    (matchedAccount?.tag || embajador.ownerVendedorTag || matchedPartner?.code || '').trim() ||
    null;
  const name =
    (matchedAccount?.displayName || ownerNameRaw || matchedPartner?.name || tag || 'Vendedor').trim();
  const avatarUrl = matchedAccount?.avatarUrl ?? matchedPartner?.avatarUrl ?? null;

  return {
    accountId: resolvedAccId ?? matchedPartner?.accountId ?? null,
    name,
    tag,
    avatarUrl,
    isDirect: false,
  };
}

export function getOwnedEmbajadores(
  vendedor: { accountId?: string | null; tag?: string | null },
  referrers: ReferralPartner[]
): ReferralPartner[] {
  const vAccId = vendedor.accountId || null;
  const vTagNorm = normalizePartnerCode(vendedor.tag);

  if (!vAccId && !vTagNorm) return [];

  const seen = new Set<string>();
  const owned: ReferralPartner[] = [];

  for (const r of referrers) {
    if (r.partnerType !== 'embajador') continue;
    if (seen.has(r.id)) continue;

    let matches = false;
    if (vAccId && r.ownerVendedorAccountId) {
      matches = r.ownerVendedorAccountId === vAccId;
    } else if (vTagNorm && normalizePartnerCode(r.ownerVendedorTag) === vTagNorm) {
      // Match by tag when either side does not carry an accountId
      matches = !vAccId || !r.ownerVendedorAccountId;
    }

    if (matches) {
      seen.add(r.id);
      owned.push(r);
    }
  }

  return owned;
}

export function computeEmbajadorMetrics(
  embajador: ReferralPartner,
  leads: Lead[],
  qrHistory: QrCodeRecord[],
  visitLog?: ReferralVisitEvent[],
  isDateFiltered = false,
  accounts?: UserAccount[],
  referrers?: ReferralPartner[],
  defaultTicketAmount = 0
): EmbajadorRollupMetrics {
  const codeNorm = normalizePartnerCode(embajador.code);
  const owner = resolveEmbajadorOwner(embajador, accounts, referrers);

  const qrMap = new Map<string, QrCodeRecord>();
  for (const qr of qrHistory) {
    if (!qrMap.has(qr.id) && qrMatchesPartner(qr, embajador, codeNorm)) {
      qrMap.set(qr.id, qr);
    }
  }
  const qrs = Array.from(qrMap.values());

  const leadMap = new Map<string, Lead>();
  for (const lead of leads) {
    if (!leadMap.has(lead.id) && leadMatchesPartner(lead, embajador, codeNorm)) {
      leadMap.set(lead.id, lead);
    }
  }
  const matchedLeads = Array.from(leadMap.values());
  const { citasCount, demosCount, ordenesCount, salesTotal } = computeLeadsBreakdown(
    matchedLeads,
    defaultTicketAmount
  );

  const matchedVisitMap = new Map<string, ReferralVisitEvent>();
  if (Array.isArray(visitLog)) {
    for (const ev of visitLog) {
      if (!matchedVisitMap.has(ev.id) && visitMatchesPartner(ev, embajador, codeNorm)) {
        matchedVisitMap.set(ev.id, ev);
      }
    }
  }
  const matchedVisits = Array.from(matchedVisitMap.values());
  const logUniqueCount = new Set(
    matchedVisits.map((ev) => ev.visitorId).filter(Boolean)
  ).size;

  const baseVisits = Math.max(0, Number(embajador.visitsCount) || 0);
  const baseUnique = Math.max(0, Number(embajador.uniqueVisitsCount) || 0);

  const visitsCount =
    isDateFiltered && Array.isArray(visitLog)
      ? matchedVisits.length
      : Math.max(baseVisits, matchedVisits.length);

  const uniqueVisitsCount =
    isDateFiltered && Array.isArray(visitLog)
      ? logUniqueCount
      : Math.max(baseUnique, logUniqueCount);

  return {
    embajador,
    owner,
    qrCount: qrs.length,
    qrs,
    leads: matchedLeads,
    leadsCount: matchedLeads.length,
    citasCount,
    demosCount,
    ordenesCount,
    salesTotal,
    visitsCount,
    uniqueVisitsCount,
  };
}

export function computeVendedorRollupMetrics(
  vendedor: {
    accountId?: string | null;
    partnerId?: string | null;
    name: string;
    tag: string;
    avatarUrl?: string | null;
    active?: boolean;
    partner?: ReferralPartner | null;
  },
  referrers: ReferralPartner[],
  leads: Lead[],
  qrHistory: QrCodeRecord[],
  visitLog?: ReferralVisitEvent[],
  isDateFiltered = false,
  accounts?: UserAccount[],
  defaultTicketAmount = 0
): VendedorRollupMetrics {
  const vAccId = vendedor.accountId ?? null;
  const vTagNorm = normalizePartnerCode(vendedor.tag);

  const matchedAccount =
    (vAccId && accounts ? accounts.find((a) => a.id === vAccId) : undefined) ||
    (vTagNorm && accounts
      ? accounts.find((a) => a.role === 'vendedor' && normalizePartnerCode(a.tag) === vTagNorm)
      : undefined) ||
    null;

  const vendedorPartner =
    vendedor.partner ||
    referrers.find((r) => {
      if (r.partnerType === 'embajador') return false;
      if (vendedor.partnerId && r.id === vendedor.partnerId) return true;
      if (matchedAccount?.referrerId && r.id === matchedAccount.referrerId) return true;
      if (vAccId && r.accountId === vAccId) return true;
      if (vTagNorm && normalizePartnerCode(r.code) === vTagNorm) return true;
      return false;
    }) ||
    null;

  const partnerId = vendedor.partnerId ?? vendedorPartner?.id ?? null;
  const effectiveAccId = vAccId ?? matchedAccount?.id ?? vendedorPartner?.accountId ?? null;

  const embajadores = getOwnedEmbajadores(
    { accountId: effectiveAccId, tag: vendedor.tag || vendedorPartner?.code },
    referrers
  );

  const embajadoresBreakdown = embajadores.map((emb) =>
    computeEmbajadorMetrics(
      emb,
      leads,
      qrHistory,
      visitLog,
      isDateFiltered,
      accounts,
      referrers,
      defaultTicketAmount
    )
  );

  // Deduplicate Embajador QRs across all owned embajadores
  const embQrMap = new Map<string, QrCodeRecord>();
  for (const row of embajadoresBreakdown) {
    for (const qr of row.qrs) {
      if (!embQrMap.has(qr.id)) {
        embQrMap.set(qr.id, qr);
      }
    }
  }

  // Track all known embajador IDs/codes so an embajador QR is never double-attributed as direct vendedor QR
  const allEmbajadorIds = new Set<string>();
  const allEmbajadorCodes = new Set<string>();
  for (const r of referrers) {
    if (r.partnerType === 'embajador') {
      allEmbajadorIds.add(r.id);
      const c = normalizePartnerCode(r.code);
      if (c) allEmbajadorCodes.add(c);
    }
  }

  // Deduplicate direct Vendedor QRs (strictly excluding owned & any embajador QRs)
  const directQrMap = new Map<string, QrCodeRecord>();
  for (const qr of qrHistory) {
    if (embQrMap.has(qr.id) || directQrMap.has(qr.id)) continue;
    const qrCodeNorm = normalizePartnerCode(qr.referralCode);
    if (
      (qr.referrerId && allEmbajadorIds.has(qr.referrerId)) ||
      (qrCodeNorm && allEmbajadorCodes.has(qrCodeNorm))
    ) {
      continue;
    }

    const matchesDirect =
      (Boolean(effectiveAccId) && qr.accountId === effectiveAccId) ||
      (Boolean(partnerId) && qr.referrerId === partnerId) ||
      (Boolean(vTagNorm) && qrCodeNorm === vTagNorm);

    if (matchesDirect) {
      directQrMap.set(qr.id, qr);
    }
  }

  const directQrCount = directQrMap.size;
  const embajadoresQrCount = embQrMap.size;
  const totalQrCount = directQrCount + embajadoresQrCount;

  // Deduplicate Embajador leads across all owned embajadores
  const embLeadMap = new Map<string, Lead>();
  for (const row of embajadoresBreakdown) {
    for (const lead of row.leads) {
      if (!embLeadMap.has(lead.id)) {
        embLeadMap.set(lead.id, lead);
      }
    }
  }

  // Deduplicate direct Vendedor leads (strictly excluding leads already counted under owned embajadores)
  const directLeadMap = new Map<string, Lead>();
  for (const lead of leads) {
    if (embLeadMap.has(lead.id) || directLeadMap.has(lead.id)) continue;

    const leadCodeNorm = normalizePartnerCode(lead.referralCode);
    const matchesDirect =
      (Boolean(partnerId) && lead.referrerId === partnerId) ||
      (Boolean(vTagNorm) && leadCodeNorm === vTagNorm);

    if (matchesDirect) {
      directLeadMap.set(lead.id, lead);
    }
  }

  const directLeadsCount = directLeadMap.size;
  const embajadoresLeadsCount = embLeadMap.size;
  const combinedLeads: Lead[] = [...directLeadMap.values(), ...embLeadMap.values()];
  const totalLeadsCount = directLeadsCount + embajadoresLeadsCount;

  const { citasCount, demosCount, ordenesCount, salesTotal } = computeLeadsBreakdown(
    combinedLeads,
    defaultTicketAmount
  );

  // Deduplicate visits across direct + owned embajadores
  const embVisitMap = new Map<string, ReferralVisitEvent>();
  const directVisitMap = new Map<string, ReferralVisitEvent>();

  if (Array.isArray(visitLog)) {
    const ownedEmbCodes = new Set(
      embajadores.map((e) => normalizePartnerCode(e.code)).filter(Boolean)
    );
    const ownedEmbIds = new Set(embajadores.map((e) => e.id));

    for (const ev of visitLog) {
      const evCodeNorm = normalizePartnerCode(ev.referralCode);
      const matchesOwnedEmb =
        (Boolean(ev.referrerId) && ownedEmbIds.has(ev.referrerId as string)) ||
        (Boolean(evCodeNorm) && ownedEmbCodes.has(evCodeNorm));

      if (matchesOwnedEmb) {
        if (!embVisitMap.has(ev.id)) {
          embVisitMap.set(ev.id, ev);
        }
        continue;
      }

      const matchesDirect =
        (Boolean(partnerId) && ev.referrerId === partnerId) ||
        (Boolean(vTagNorm) && evCodeNorm === vTagNorm);

      if (matchesDirect && !directVisitMap.has(ev.id)) {
        directVisitMap.set(ev.id, ev);
      }
    }
  }

  let visitsCount = 0;
  let uniqueVisitsCount = 0;

  if (isDateFiltered && Array.isArray(visitLog)) {
    const allFilteredVisits = [...directVisitMap.values(), ...embVisitMap.values()];
    visitsCount = allFilteredVisits.length;
    uniqueVisitsCount = new Set(
      allFilteredVisits.map((ev) => ev.visitorId).filter(Boolean)
    ).size;
  } else {
    const directBaseVisits = Math.max(0, Number(vendedorPartner?.visitsCount) || 0);
    const directBaseUnique = Math.max(0, Number(vendedorPartner?.uniqueVisitsCount) || 0);
    const directLogUnique = new Set(
      Array.from(directVisitMap.values())
        .map((ev) => ev.visitorId)
        .filter(Boolean)
    ).size;

    const directVisits = Math.max(directBaseVisits, directVisitMap.size);
    const directUnique = Math.max(directBaseUnique, directLogUnique);

    const embVisitsSum = embajadoresBreakdown.reduce((sum, row) => sum + row.visitsCount, 0);
    const embUniqueSum = embajadoresBreakdown.reduce((sum, row) => sum + row.uniqueVisitsCount, 0);

    visitsCount = directVisits + embVisitsSum;
    uniqueVisitsCount = directUnique + embUniqueSum;
  }

  const activeEmbajadoresCount = embajadores.filter((e) => e.active).length;

  return {
    accountId: effectiveAccId,
    partnerId,
    name: vendedor.name,
    tag: vendedor.tag,
    avatarUrl: vendedor.avatarUrl ?? matchedAccount?.avatarUrl ?? vendedorPartner?.avatarUrl ?? null,
    active: vendedor.active ?? matchedAccount?.active ?? vendedorPartner?.active ?? true,
    embajadores,
    embajadoresCount: embajadores.length,
    activeEmbajadoresCount,
    directQrCount,
    embajadoresQrCount,
    totalQrCount,
    directLeadsCount,
    embajadoresLeadsCount,
    leads: combinedLeads,
    totalLeadsCount,
    citasCount,
    demosCount,
    ordenesCount,
    salesTotal,
    visitsCount,
    uniqueVisitsCount,
    embajadoresBreakdown,
  };
}
