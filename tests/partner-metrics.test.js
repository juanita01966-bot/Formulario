import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePartnerCode,
  resolveEmbajadorOwner,
  getOwnedEmbajadores,
  computeEmbajadorMetrics,
  computeVendedorRollupMetrics,
} from '../src/utils/partnerMetrics.ts';

function makeAccount(overrides = {}) {
  return {
    id: 'acc-1',
    username: 'carlos',
    displayName: 'Carlos Mendoza',
    role: 'vendedor',
    tag: 'CARLOS',
    avatarUrl: 'https://cdn.example.com/carlos.jpg',
    active: true,
    hasPin: false,
    tokenVersion: 1,
    referrerId: 'ref-v1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePartner(overrides = {}) {
  return {
    id: 'ref-1',
    accountId: null,
    partnerType: 'vendedor',
    ownerVendedorAccountId: null,
    ownerVendedorName: null,
    ownerVendedorTag: null,
    name: 'Partner',
    code: 'PARTNER',
    emoji: null,
    avatarUrl: null,
    active: true,
    visitsCount: 0,
    uniqueVisitsCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeLead(overrides = {}) {
  return {
    id: 'lead-1',
    name: 'Prospecto Demo',
    phone: '555-0100',
    acceptedTerms: true,
    giftId: 'gift-1',
    giftName: 'Cuchillos',
    giftVisualKey: 'knife',
    claimCode: 'CIP-1001',
    called: false,
    calledAt: null,
    callOutcome: 'pending',
    category: 'none',
    orderAmount: null,
    notes: '',
    referralCode: null,
    referrerId: null,
    referrerName: null,
    createdAt: '2026-02-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeQr(overrides = {}) {
  return {
    id: 'qr-1',
    name: 'QR Demo',
    targetUrl: 'https://example.com/?ref=CARLOS',
    styleId: 'classic-gold',
    dotShape: 'rounded',
    foregroundColor: '#22150E',
    backgroundColor: '#FFF9ED',
    includeLogo: true,
    referralCode: null,
    referrerId: null,
    accountId: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeVisit(overrides = {}) {
  return {
    id: 'vis-1',
    referrerId: null,
    referralCode: 'CARLOS',
    visitorId: 'visitor-1',
    visitedAt: '2026-02-01T11:00:00.000Z',
    ...overrides,
  };
}

describe('partnerMetrics — normalizePartnerCode', () => {
  it('normalizes accents, case, spaces, punctuation, and length', () => {
    assert.equal(normalizePartnerCode('  María  José!! '), 'MARIA-JOSE');
    assert.equal(normalizePartnerCode('---ana__vip---'), 'ANA__VIP');
    assert.equal(normalizePartnerCode('a'.repeat(50)).length, 32);
    assert.equal(normalizePartnerCode(''), '');
    assert.equal(normalizePartnerCode(null), '');
    assert.equal(normalizePartnerCode(undefined), '');
  });
});

describe('partnerMetrics — resolveEmbajadorOwner', () => {
  it('resolves live owner info from accounts by ownerVendedorAccountId', () => {
    const accounts = [makeAccount()];
    const emb = makePartner({
      id: 'emb-1',
      partnerType: 'embajador',
      name: 'Sofía VIP',
      code: 'SOFIA-VIP',
      ownerVendedorAccountId: 'acc-1',
      ownerVendedorName: 'Old Name',
      ownerVendedorTag: 'OLDTAG',
    });

    const owner = resolveEmbajadorOwner(emb, accounts, []);
    assert.deepEqual(owner, {
      accountId: 'acc-1',
      name: 'Carlos Mendoza',
      tag: 'CARLOS',
      avatarUrl: 'https://cdn.example.com/carlos.jpg',
      isDirect: false,
    });
  });

  it('falls back to tag match in accounts or referrers when accountId is missing', () => {
    const accounts = [makeAccount({ id: 'acc-2', displayName: 'Laura Ventas', tag: 'LAURA' })];
    const emb = makePartner({
      id: 'emb-2',
      partnerType: 'embajador',
      name: 'Elena',
      code: 'ELENA',
      ownerVendedorTag: 'laura',
    });

    const owner = resolveEmbajadorOwner(emb, accounts, []);
    assert.equal(owner.isDirect, false);
    assert.equal(owner.accountId, 'acc-2');
    assert.equal(owner.name, 'Laura Ventas');
    assert.equal(owner.tag, 'LAURA');
  });

  it('returns Ciprian Directo when no owner vendedor is assigned', () => {
    const emb = makePartner({
      id: 'emb-direct',
      partnerType: 'embajador',
      name: 'Embajador Directo',
      code: 'EMB-DIR',
    });

    const owner = resolveEmbajadorOwner(emb, [makeAccount()], []);
    assert.deepEqual(owner, {
      accountId: null,
      name: 'Ciprian Directo',
      tag: null,
      avatarUrl: null,
      isDirect: true,
    });
  });
});

describe('partnerMetrics — getOwnedEmbajadores', () => {
  it('matches only embajadores owned by the vendedor, avoids cross-account tag collisions, and deduplicates', () => {
    const embOwnedById = makePartner({
      id: 'emb-1',
      partnerType: 'embajador',
      name: 'Sofía',
      code: 'SOFIA',
      ownerVendedorAccountId: 'acc-1',
      ownerVendedorTag: 'CARLOS',
    });
    const embOwnedByTagOnly = makePartner({
      id: 'emb-2',
      partnerType: 'embajador',
      name: 'Lucía',
      code: 'LUCIA',
      ownerVendedorAccountId: null,
      ownerVendedorTag: 'carlos',
    });
    const embOtherAccountSameTag = makePartner({
      id: 'emb-other',
      partnerType: 'embajador',
      name: 'Otro',
      code: 'OTRO',
      ownerVendedorAccountId: 'acc-999',
      ownerVendedorTag: 'CARLOS',
    });
    const embUnassigned = makePartner({
      id: 'emb-direct',
      partnerType: 'embajador',
      name: 'Directo',
      code: 'DIRECTO',
    });
    const vendedorRow = makePartner({
      id: 'ref-v1',
      accountId: 'acc-1',
      partnerType: 'vendedor',
      name: 'Carlos',
      code: 'CARLOS',
    });

    const owned = getOwnedEmbajadores(
      { accountId: 'acc-1', tag: 'CARLOS' },
      [embOwnedById, embOwnedById, embOwnedByTagOnly, embOtherAccountSameTag, embUnassigned, vendedorRow]
    );

    assert.deepEqual(
      owned.map((e) => e.id),
      ['emb-1', 'emb-2']
    );
  });
});

describe('partnerMetrics — computeEmbajadorMetrics', () => {
  it('computes deduplicated QRs, leads, funnel, sales, and filtered/unfiltered visits', () => {
    const accounts = [makeAccount()];
    const emb = makePartner({
      id: 'emb-1',
      partnerType: 'embajador',
      name: 'Sofía VIP',
      code: 'SOFIA-VIP',
      ownerVendedorAccountId: 'acc-1',
      ownerVendedorTag: 'CARLOS',
      visitsCount: 12,
      uniqueVisitsCount: 8,
    });

    const leads = [
      makeLead({ id: 'l1', referrerId: 'emb-1', category: 'cita' }),
      makeLead({ id: 'l1', referralCode: 'SOFIA-VIP', category: 'cita' }), // duplicate ID
      makeLead({ id: 'l2', referralCode: 'sofia-vip', category: 'demo' }),
      makeLead({ id: 'l3', referrerId: 'emb-1', category: 'orden', orderAmount: 2500 }),
      makeLead({ id: 'l4', referralCode: 'SOFIA-VIP', category: 'orden', orderAmount: null }), // unset orderAmount -> 0 (no inflation)
      makeLead({ id: 'l-other', referralCode: 'OTHER', category: 'orden', orderAmount: 9999 }),
    ];

    const qrHistory = [
      makeQr({ id: 'q1', referrerId: 'emb-1', referralCode: 'SOFIA-VIP', accountId: 'acc-1' }),
      makeQr({ id: 'q1', referrerId: 'emb-1', referralCode: 'SOFIA-VIP' }), // duplicate ID
      makeQr({ id: 'q2', referralCode: 'sofia-vip' }),
      makeQr({ id: 'q-other', referralCode: 'CARLOS', accountId: 'acc-1' }),
    ];

    const visitLog = [
      makeVisit({ id: 'v1', referrerId: 'emb-1', referralCode: 'SOFIA-VIP', visitorId: 'u1' }),
      makeVisit({ id: 'v1', referrerId: 'emb-1', referralCode: 'SOFIA-VIP', visitorId: 'u1' }), // duplicate
      makeVisit({ id: 'v2', referralCode: 'SOFIA-VIP', visitorId: 'u1' }),
      makeVisit({ id: 'v3', referralCode: 'SOFIA-VIP', visitorId: 'u2' }),
    ];

    const unfiltered = computeEmbajadorMetrics(
      emb,
      leads,
      qrHistory,
      visitLog,
      false,
      accounts,
      [emb],
      1800
    );

    assert.equal(unfiltered.owner.name, 'Carlos Mendoza');
    assert.equal(unfiltered.owner.tag, 'CARLOS');
    assert.equal(unfiltered.owner.isDirect, false);
    assert.equal(unfiltered.qrCount, 2);
    assert.equal(unfiltered.leadsCount, 4);
    assert.equal(unfiltered.citasCount, 1);
    assert.equal(unfiltered.demosCount, 1);
    assert.equal(unfiltered.ordenesCount, 2);
    assert.equal(unfiltered.salesTotal, 2500); // real orderAmount only (null -> 0, never defaultTicketAmount)
    assert.equal(unfiltered.visitsCount, 12); // max(12, 3)
    assert.equal(unfiltered.uniqueVisitsCount, 8); // max(8, 2)

    const filtered = computeEmbajadorMetrics(
      emb,
      leads,
      qrHistory,
      visitLog,
      true,
      accounts,
      [emb],
      1800
    );
    assert.equal(filtered.visitsCount, 3);
    assert.equal(filtered.uniqueVisitsCount, 2);
  });
});

describe('partnerMetrics — computeVendedorRollupMetrics (ZERO double-counting)', () => {
  it('rolls up direct + all linked embajadores with strict deduplication across QRs, leads, and visits', () => {
    const accCarlos = makeAccount({
      id: 'acc-carlos',
      displayName: 'Carlos Mendoza',
      tag: 'CARLOS',
      referrerId: 'ref-carlos',
    });
    const accAna = makeAccount({
      id: 'acc-ana',
      displayName: 'Ana Torres',
      tag: 'ANA',
      referrerId: 'ref-ana',
    });
    const accounts = [accCarlos, accAna];

    const partnerCarlos = makePartner({
      id: 'ref-carlos',
      accountId: 'acc-carlos',
      partnerType: 'vendedor',
      name: 'Carlos Mendoza',
      code: 'CARLOS',
      visitsCount: 10,
      uniqueVisitsCount: 7,
    });
    const embSofia = makePartner({
      id: 'emb-sofia',
      partnerType: 'embajador',
      ownerVendedorAccountId: 'acc-carlos',
      ownerVendedorName: 'Carlos Mendoza',
      ownerVendedorTag: 'CARLOS',
      name: 'Sofía',
      code: 'SOFIA',
      active: true,
      visitsCount: 6,
      uniqueVisitsCount: 4,
    });
    const embMateo = makePartner({
      id: 'emb-mateo',
      partnerType: 'embajador',
      ownerVendedorAccountId: 'acc-carlos',
      ownerVendedorName: 'Carlos Mendoza',
      ownerVendedorTag: 'CARLOS',
      name: 'Mateo',
      code: 'MATEO',
      active: false,
      visitsCount: 4,
      uniqueVisitsCount: 3,
    });
    const embAna = makePartner({
      id: 'emb-ana-1',
      partnerType: 'embajador',
      ownerVendedorAccountId: 'acc-ana',
      ownerVendedorName: 'Ana Torres',
      ownerVendedorTag: 'ANA',
      name: 'Valeria (de Ana)',
      code: 'VALERIA',
      active: true,
      visitsCount: 50,
      uniqueVisitsCount: 40,
    });
    const embDirecto = makePartner({
      id: 'emb-directo',
      partnerType: 'embajador',
      name: 'Ciprian Directo Emb',
      code: 'CIPRIAN-EMB',
      active: true,
      visitsCount: 30,
      uniqueVisitsCount: 25,
    });

    const referrers = [partnerCarlos, embSofia, embMateo, embAna, embDirecto];

    const qrHistory = [
      // Carlos direct QRs (1 unique, 1 duplicate ID)
      makeQr({ id: 'qr-c1', accountId: 'acc-carlos', referrerId: 'ref-carlos', referralCode: 'CARLOS' }),
      makeQr({ id: 'qr-c1', accountId: 'acc-carlos', referrerId: 'ref-carlos', referralCode: 'CARLOS' }),
      makeQr({ id: 'qr-c2', referralCode: 'carlos' }),
      // Embajador QRs that ALSO carry Carlos's accountId (must NOT double-count as direct!)
      makeQr({ id: 'qr-s1', accountId: 'acc-carlos', referrerId: 'emb-sofia', referralCode: 'SOFIA' }),
      makeQr({ id: 'qr-s2', accountId: 'acc-carlos', referralCode: 'SOFIA' }),
      makeQr({ id: 'qr-m1', accountId: 'acc-carlos', referrerId: 'emb-mateo', referralCode: 'MATEO' }),
      // Unrelated embajador & other vendedor QRs
      makeQr({ id: 'qr-other-emb', accountId: 'acc-ana', referrerId: 'emb-ana-1', referralCode: 'VALERIA' }),
      makeQr({ id: 'qr-direct-emb', referrerId: 'emb-directo', referralCode: 'CIPRIAN-EMB' }),
    ];

    const leads = [
      // Carlos direct leads
      makeLead({ id: 'lead-c1', referrerId: 'ref-carlos', referralCode: 'CARLOS', category: 'cita' }),
      makeLead({ id: 'lead-c2', referralCode: 'CARLOS', category: 'orden', orderAmount: 3000 }),
      // Embajador leads (including duplicate ID and cross-tagged edge case)
      makeLead({ id: 'lead-s1', referrerId: 'emb-sofia', referralCode: 'SOFIA', category: 'demo' }),
      makeLead({ id: 'lead-s1', referrerId: 'emb-sofia', referralCode: 'SOFIA', category: 'demo' }), // dup
      makeLead({ id: 'lead-s2', referrerId: 'emb-sofia', referralCode: 'CARLOS', category: 'orden', orderAmount: 1500 }), // must count ONCE under embajador
      makeLead({ id: 'lead-m1', referralCode: 'MATEO', category: 'none' }),
      // Unrelated leads (must NOT be included)
      makeLead({ id: 'lead-ana', referrerId: 'emb-ana-1', referralCode: 'VALERIA', category: 'orden', orderAmount: 5000 }),
      makeLead({ id: 'lead-cip', referralCode: 'CIPRIAN-EMB', category: 'cita' }),
    ];

    const visitLog = [
      makeVisit({ id: 'v-c1', referrerId: 'ref-carlos', referralCode: 'CARLOS', visitorId: 'shared-visitor' }),
      makeVisit({ id: 'v-c1', referrerId: 'ref-carlos', referralCode: 'CARLOS', visitorId: 'shared-visitor' }), // dup
      makeVisit({ id: 'v-s1', referrerId: 'emb-sofia', referralCode: 'SOFIA', visitorId: 'shared-visitor' }),
      makeVisit({ id: 'v-m1', referralCode: 'MATEO', visitorId: 'unique-mateo' }),
      makeVisit({ id: 'v-ana', referralCode: 'VALERIA', visitorId: 'ana-visitor' }),
    ];

    const unfiltered = computeVendedorRollupMetrics(
      {
        accountId: accCarlos.id,
        partnerId: partnerCarlos.id,
        name: accCarlos.displayName,
        tag: accCarlos.tag,
        avatarUrl: accCarlos.avatarUrl,
        active: accCarlos.active,
        partner: partnerCarlos,
      },
      referrers,
      leads,
      qrHistory,
      visitLog,
      false,
      accounts,
      1000
    );

    // Embajador team counts
    assert.equal(unfiltered.embajadoresCount, 2);
    assert.equal(unfiltered.activeEmbajadoresCount, 1);

    // QR rollup (2 direct + 3 embajadores = 5 total, ZERO double-counting!)
    assert.equal(unfiltered.directQrCount, 2);
    assert.equal(unfiltered.embajadoresQrCount, 3);
    assert.equal(unfiltered.totalQrCount, 5);

    // Leads rollup (2 direct + 3 embajadores = 5 total, ZERO double-counting!)
    assert.equal(unfiltered.directLeadsCount, 2);
    assert.equal(unfiltered.embajadoresLeadsCount, 3);
    assert.equal(unfiltered.totalLeadsCount, 5);
    assert.equal(unfiltered.leads.length, 5);

    // Combined funnel & revenue
    assert.equal(unfiltered.citasCount, 1);
    assert.equal(unfiltered.demosCount, 1);
    assert.equal(unfiltered.ordenesCount, 2);
    assert.equal(unfiltered.salesTotal, 4500); // 3000 + 1500

    // Unfiltered visits: direct max(10,1)=10 + sofia max(6,1)=6 + mateo max(4,1)=4 = 20
    assert.equal(unfiltered.visitsCount, 20);
    assert.equal(unfiltered.uniqueVisitsCount, 14); // 7 + 4 + 3

    // Date-filtered visits: strictly from visitLog, deduplicated by visit.id & visitorId
    const filtered = computeVendedorRollupMetrics(
      {
        accountId: accCarlos.id,
        partnerId: partnerCarlos.id,
        name: accCarlos.displayName,
        tag: accCarlos.tag,
        partner: partnerCarlos,
      },
      referrers,
      leads,
      qrHistory,
      visitLog,
      true,
      accounts,
      1000
    );
    assert.equal(filtered.visitsCount, 3); // v-c1, v-s1, v-m1
    assert.equal(filtered.uniqueVisitsCount, 2); // shared-visitor + unique-mateo
  });

  it('handles a Vendedor with zero linked Embajadores cleanly', () => {
    const accSolo = makeAccount({ id: 'acc-solo', displayName: 'Pedro Solo', tag: 'PEDRO', referrerId: 'ref-pedro' });
    const partnerSolo = makePartner({ id: 'ref-pedro', accountId: 'acc-solo', name: 'Pedro Solo', code: 'PEDRO' });

    const res = computeVendedorRollupMetrics(
      {
        accountId: accSolo.id,
        partnerId: partnerSolo.id,
        name: accSolo.displayName,
        tag: accSolo.tag,
        partner: partnerSolo,
      },
      [partnerSolo],
      [makeLead({ id: 'l-p1', referralCode: 'PEDRO', category: 'cita' })],
      [makeQr({ id: 'q-p1', accountId: 'acc-solo', referralCode: 'PEDRO' })],
      [],
      false,
      [accSolo],
      1500
    );

    assert.equal(res.embajadoresCount, 0);
    assert.equal(res.activeEmbajadoresCount, 0);
    assert.equal(res.directQrCount, 1);
    assert.equal(res.embajadoresQrCount, 0);
    assert.equal(res.totalQrCount, 1);
    assert.equal(res.directLeadsCount, 1);
    assert.equal(res.embajadoresLeadsCount, 0);
    assert.equal(res.totalLeadsCount, 1);
    assert.equal(res.citasCount, 1);
  });

  it('calculates salesTotal strictly from real closed orderAmount values with zero defaultTicketAmount inflation', () => {
    const acc = makeAccount({ id: 'acc-real', displayName: 'Laura Ventas', tag: 'LAURA', referrerId: 'ref-laura' });
    const partner = makePartner({ id: 'ref-laura', accountId: 'acc-real', name: 'Laura Ventas', code: 'LAURA' });
    const emb = makePartner({
      id: 'emb-real',
      partnerType: 'embajador',
      ownerVendedorAccountId: 'acc-real',
      ownerVendedorTag: 'LAURA',
      name: 'Elena',
      code: 'ELENA',
    });

    const leads = [
      makeLead({ id: 'o1', referralCode: 'LAURA', category: 'orden', orderAmount: null }),
      makeLead({ id: 'o2', referralCode: 'LAURA', category: 'orden', orderAmount: 0 }),
      makeLead({ id: 'o3', referralCode: 'ELENA', category: 'orden', orderAmount: 3200 }),
      makeLead({ id: 'd1', referralCode: 'LAURA', category: 'demo', orderAmount: 9999 }), // not an orden
    ];

    const res = computeVendedorRollupMetrics(
      {
        accountId: acc.id,
        partnerId: partner.id,
        name: acc.displayName,
        tag: acc.tag,
        partner,
      },
      [partner, emb],
      leads,
      [],
      [],
      false,
      [acc],
      2792
    );

    assert.equal(res.ordenesCount, 3);
    assert.equal(res.salesTotal, 3200);
  });
});
