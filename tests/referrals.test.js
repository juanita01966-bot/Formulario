import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Isolate test store in OS temp dir so concurrent test suites never collide on store.json
const TEST_STORE_FILE = path.join(
  os.tmpdir(),
  `royal-referrals-test-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;

const {
  default: app,
  DEFAULT_REFERRAL_PRIZE_RULE,
  normalizeReferralCode,
  sanitizeReferralPrizeRule,
  normalizeReferrerRecord,
  mapLeadRow,
  mapQrRow,
  mapReferrerRow,
} = await import('../server/index.js');

async function loginAs(baseUrl, username, password, pin) {
  const step1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(step1.status, 200, `Step 1 login failed for ${username}`);
  const { preAuthToken } = await step1.json();

  const step2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken, pin }),
  });
  assert.strictEqual(step2.status, 200, `Step 2 PIN failed for ${username}`);
  const { sessionToken } = await step2.json();
  return sessionToken;
}

describe('Referral QR / Ambassador Tracking & Prize System Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let callerToken;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    adminToken = await loginAs(baseUrl, 'AdminCiprian', 'AdminMaster2026@', '1966');
    callerToken = await loginAs(baseUrl, 'Caller', 'UsuCa2026@', '1532');
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      if (fs.existsSync(TEST_STORE_FILE)) {
        fs.unlinkSync(TEST_STORE_FILE);
      }
    } catch {
      // Ignore temp file cleanup error
    }
  });

  describe('1. Unit Helpers, Schema & Default Store Contract', () => {
    test('normalizeReferralCode normalizes accents, case, whitespace and rejects invalid codes', () => {
      assert.strictEqual(normalizeReferralCode('  maria-01  '), 'MARIA-01');
      assert.strictEqual(normalizeReferralCode('María José'), 'MARIA-JOSE');
      assert.strictEqual(normalizeReferralCode('emb_20!@#'), 'EMB20');
      assert.strictEqual(normalizeReferralCode('a'), null);
      assert.strictEqual(normalizeReferralCode('---'), null);
      assert.strictEqual(normalizeReferralCode(''), null);
      assert.strictEqual(normalizeReferralCode(null), null);
      assert.strictEqual(normalizeReferralCode('A'.repeat(40)), 'A'.repeat(32));
    });

    test('sanitizeReferralPrizeRule enforces valid metrics and safe numeric bounds', () => {
      const def = sanitizeReferralPrizeRule(undefined);
      assert.deepStrictEqual(def, DEFAULT_REFERRAL_PRIZE_RULE);

      const custom = sanitizeReferralPrizeRule({
        prizeName: '  Viaje Cancún  ',
        metric: 'points',
        targetCount: 15,
        maxWinners: 0,
        pointsPerLead: 2,
        pointsPerCita: 4,
        pointsPerDemo: 6,
        pointsPerOrden: 12,
      });
      assert.deepStrictEqual(custom, {
        prizeName: 'Viaje Cancún',
        metric: 'points',
        targetCount: 15,
        maxWinners: 0,
        pointsPerLead: 2,
        pointsPerCita: 4,
        pointsPerDemo: 6,
        pointsPerOrden: 12,
      });

      const sanitizedBad = sanitizeReferralPrizeRule({
        prizeName: '   ',
        metric: 'invalid_metric',
        targetCount: -10,
        maxWinners: -3,
        pointsPerLead: -1,
      });
      assert.strictEqual(sanitizedBad.prizeName, DEFAULT_REFERRAL_PRIZE_RULE.prizeName);
      assert.strictEqual(sanitizedBad.metric, 'leads');
      assert.strictEqual(sanitizedBad.targetCount, 1);
      assert.strictEqual(sanitizedBad.maxWinners, 0);
      assert.strictEqual(sanitizedBad.pointsPerLead, 0);
    });

    test('Supabase row mappers preserve referral fields cleanly', () => {
      const mappedPartner = mapReferrerRow({
        id: 'ref-1',
        name: 'Laura Méndez',
        code: 'laura-01',
        phone: '555-888-9999',
        notes: 'VIP',
        active: true,
        visits_count: 14,
        unique_visits_count: 9,
        last_visit_at: '2026-11-21T10:00:00.000Z',
        qr_style_id: 'emerald-heritage',
        created_at: '2026-11-20T10:00:00.000Z',
      });
      assert.strictEqual(mappedPartner.code, 'LAURA-01');
      assert.strictEqual(mappedPartner.visitsCount, 14);
      assert.strictEqual(mappedPartner.uniqueVisitsCount, 9);
      assert.strictEqual(mappedPartner.qrStyleId, 'emerald-heritage');

      const mappedLead = mapLeadRow({
        id: 'lead-1',
        name: 'Juan',
        phone: '555-111-2222',
        claim_code: 'OTN-1234',
        referral_code: 'laura-01',
        referrer_id: 'ref-1',
        referrer_name: 'Laura Méndez',
        created_at: '2026-11-21T11:00:00.000Z',
      });
      assert.strictEqual(mappedLead.referralCode, 'LAURA-01');
      assert.strictEqual(mappedLead.referrerId, 'ref-1');
      assert.strictEqual(mappedLead.referrerName, 'Laura Méndez');

      const mappedQr = mapQrRow({
        id: 'qr-1',
        name: 'QR Laura',
        target_url: 'https://example.com/?ref=LAURA-01',
        referral_code: 'laura-01',
        referrer_id: 'ref-1',
        created_at: '2026-11-21T11:00:00.000Z',
      });
      assert.strictEqual(mappedQr.referralCode, 'LAURA-01');
      assert.strictEqual(mappedQr.referrerId, 'ref-1');

      const clampedPartner = normalizeReferrerRecord({
        id: 'ref-2',
        name: 'Test',
        code: 'TST-02',
        visitsCount: 3,
        uniqueVisitsCount: 99,
      });
      assert.strictEqual(clampedPartner.uniqueVisitsCount, 3);
    });

    test('defaultStore.json and supabase/schema.sql define full referral persistence contract', () => {
      const defaultStore = JSON.parse(
        fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'shared', 'defaultStore.json'), 'utf8')
      );
      assert.deepStrictEqual(defaultStore.referrers, []);
      assert.deepStrictEqual(defaultStore.settings.referralPrizeRule, DEFAULT_REFERRAL_PRIZE_RULE);

      const schemaSql = fs.readFileSync(path.join(PROJECT_ROOT, 'supabase', 'schema.sql'), 'utf8');
      assert.match(schemaSql, /create table if not exists public\.referrers/i);
      assert.match(schemaSql, /referrers_service_only/i);
      assert.match(schemaSql, /revoke all on table public\.referrers from anon, authenticated, public/i);
      assert.match(schemaSql, /alter table public\.app_settings add column if not exists referral_prize_rule jsonb/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists referral_code text/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists referrer_id text/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists referrer_name text/i);
      assert.match(schemaSql, /alter table public\.qr_codes add column if not exists referral_code text/i);
      assert.match(schemaSql, /alter table public\.qr_codes add column if not exists referrer_id text/i);
    });
  });

  describe('2. RBAC, CRUD, Auto-Code Generation & Duplicate Code Rejection (409)', () => {
    let createdPartner;

    test('Unauthenticated and Caller sessions cannot create, batch-create, edit, or delete referrers', async () => {
      // Unauthenticated -> 401
      const unauthGet = await fetch(`${baseUrl}/api/referrals`);
      assert.strictEqual(unauthGet.status, 401);

      const unauthPost = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sin Auth' }),
      });
      assert.strictEqual(unauthPost.status, 401);

      const unauthBatch = await fetch(`${baseUrl}/api/referrals/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 5 }),
      });
      assert.strictEqual(unauthBatch.status, 401);

      // Caller -> 403 on mutations, 200 on GET /api/referrals
      const callerGet = await fetch(`${baseUrl}/api/referrals`, {
        headers: { Authorization: `Bearer ${callerToken}` },
      });
      assert.strictEqual(callerGet.status, 200);
      const callerList = await callerGet.json();
      assert.strictEqual(callerList.ok, true);
      assert.ok(Array.isArray(callerList.referrers));

      const callerPost = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Caller Intento' }),
      });
      assert.strictEqual(callerPost.status, 403);

      const callerBatch = await fetch(`${baseUrl}/api/referrals/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 3 }),
      });
      assert.strictEqual(callerBatch.status, 403);

      const callerPatch = await fetch(`${baseUrl}/api/referrals/ref-any`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Editado' }),
      });
      assert.strictEqual(callerPatch.status, 403);

      const callerDelete = await fetch(`${baseUrl}/api/referrals/ref-any`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${callerToken}` },
      });
      assert.strictEqual(callerDelete.status, 403);
    });

    test('Admin creates referral partner with explicit code, auto-generates unique code when omitted, and rejects duplicate with 409', async () => {
      const res1 = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'María González',
          code: '  maria-01 ',
          phone: '555-777-8899',
          notes: 'Embajadora zona norte - privado',
          qrStyleId: 'emerald-heritage',
        }),
      });
      assert.strictEqual(res1.status, 201);
      const data1 = await res1.json();
      assert.strictEqual(data1.ok, true);
      assert.strictEqual(data1.referrer.code, 'MARIA-01');
      assert.strictEqual(data1.referrer.name, 'María González');
      assert.strictEqual(data1.referrer.phone, '555-777-8899');
      assert.strictEqual(data1.referrer.notes, 'Embajadora zona norte - privado');
      assert.strictEqual(data1.referrer.active, true);
      assert.strictEqual(data1.referrer.visitsCount, 0);
      assert.strictEqual(data1.referrer.uniqueVisitsCount, 0);
      assert.strictEqual(data1.referrer.lastVisitAt, null);
      assert.ok(Array.isArray(data1.state.referrers));
      createdPartner = data1.referrer;

      // Duplicate explicit code (different case) -> 409
      const dupRes = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Otra María',
          code: 'MARIA-01',
        }),
      });
      assert.strictEqual(dupRes.status, 409);

      // Auto-generated code from name (and deduplication on same name)
      const auto1 = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Carlos Pérez' }),
      });
      assert.strictEqual(auto1.status, 201);
      const autoData1 = await auto1.json();
      assert.strictEqual(autoData1.referrer.code, 'CARLOS-PEREZ');

      const auto2 = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Carlos Pérez' }),
      });
      assert.strictEqual(auto2.status, 201);
      const autoData2 = await auto2.json();
      assert.strictEqual(autoData2.referrer.code, 'CARLOS-PEREZ-02');
    });

    test('GET /api/state hides referrers from unauthenticated visitors while exposing them to admin and caller', async () => {
      const publicRes = await fetch(`${baseUrl}/api/state`);
      assert.strictEqual(publicRes.status, 200);
      const publicState = await publicRes.json();
      assert.deepStrictEqual(publicState.referrers, []);

      const callerRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${callerToken}` },
      });
      assert.strictEqual(callerRes.status, 200);
      const callerState = await callerRes.json();
      assert.ok(callerState.referrers.some((r) => r.code === 'MARIA-01'));

      const adminRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(adminRes.status, 200);
      const adminState = await adminRes.json();
      assert.ok(adminState.referrers.some((r) => r.id === createdPartner.id));
    });
  });

  describe('3. Public Resolve (Zero PII Leak), Visit Deduplication & Lead Attribution', () => {
    let activePartner;
    let inactivePartner;

    before(async () => {
      const res1 = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Sofía Ramírez',
          code: 'SOFIA-VIP',
          phone: '555-999-0001',
          notes: 'Nota confidencial Sofía',
          active: true,
        }),
      });
      activePartner = (await res1.json()).referrer;

      const res2 = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Roberto Inactivo',
          code: 'ROBERTO-OFF',
          phone: '555-000-1111',
          notes: 'Pausado',
          active: false,
        }),
      });
      inactivePartner = (await res2.json()).referrer;
    });

    test('GET /api/referrals/resolve/:code normalizes code and NEVER leaks phone, notes, or visit counts', async () => {
      const res = await fetch(`${baseUrl}/api/referrals/resolve/sofia-vip`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.deepStrictEqual(data.partner, {
        id: activePartner.id,
        name: 'Sofía Ramírez',
        code: 'SOFIA-VIP',
        active: true,
      });
      assert.strictEqual('phone' in data.partner, false);
      assert.strictEqual('notes' in data.partner, false);
      assert.strictEqual('visitsCount' in data.partner, false);
      assert.strictEqual('uniqueVisitsCount' in data.partner, false);
      assert.strictEqual('lastVisitAt' in data.partner, false);

      // Inactive partner returns active: false
      const inactiveRes = await fetch(`${baseUrl}/api/referrals/resolve/ROBERTO-OFF`);
      assert.strictEqual(inactiveRes.status, 200);
      const inactiveData = await inactiveRes.json();
      assert.strictEqual(inactiveData.partner.active, false);
      assert.strictEqual('phone' in inactiveData.partner, false);

      // Unknown code returns partner: null
      const unknownRes = await fetch(`${baseUrl}/api/referrals/resolve/DOES-NOT-EXIST`);
      assert.strictEqual(unknownRes.status, 200);
      const unknownData = await unknownRes.json();
      assert.deepStrictEqual(unknownData, { ok: true, partner: null });
    });

    test('POST /api/referrals/visit increments visits, deduplicates uniqueVisitsCount by visitorId, and ignores unknown/inactive', async () => {
      // Visit 1 from visitor-A
      const v1 = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'sofia-vip', visitorId: 'visitor-A' }),
      });
      assert.strictEqual(v1.status, 200);
      const d1 = await v1.json();
      assert.deepStrictEqual(d1, {
        ok: true,
        counted: true,
        partner: { id: activePartner.id, name: 'Sofía Ramírez', code: 'SOFIA-VIP' },
      });

      // Reload by same visitor-A -> visitsCount +1, uniqueVisitsCount unchanged
      const v2 = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'SOFIA-VIP', visitorId: 'visitor-A' }),
      });
      assert.strictEqual(v2.status, 200);
      assert.strictEqual((await v2.json()).counted, true);

      // Visit by visitor-B -> both visitsCount and uniqueVisitsCount increment
      const v3 = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'SOFIA-VIP', visitorId: 'visitor-B' }),
      });
      assert.strictEqual(v3.status, 200);

      // Inactive partner -> counted: false
      const inactiveVisit = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'ROBERTO-OFF', visitorId: 'visitor-C' }),
      });
      assert.strictEqual(inactiveVisit.status, 200);
      assert.deepStrictEqual(await inactiveVisit.json(), {
        ok: true,
        counted: false,
        partner: null,
      });

      // Unknown partner -> counted: false
      const unknownVisit = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'NO-EXISTE', visitorId: 'visitor-C' }),
      });
      assert.strictEqual(unknownVisit.status, 200);
      assert.deepStrictEqual(await unknownVisit.json(), {
        ok: true,
        counted: false,
        partner: null,
      });

      // Verify exact counts via admin GET /api/referrals
      const listRes = await fetch(`${baseUrl}/api/referrals`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const { referrers } = await listRes.json();
      const sofia = referrers.find((r) => r.id === activePartner.id);
      assert.strictEqual(sofia.visitsCount, 3);
      assert.strictEqual(sofia.uniqueVisitsCount, 2);
      assert.ok(typeof sofia.lastVisitAt === 'string' && sofia.lastVisitAt.length > 0);

      const roberto = referrers.find((r) => r.id === inactivePartner.id);
      assert.strictEqual(roberto.visitsCount, 0);
      assert.strictEqual(roberto.uniqueVisitsCount, 0);
    });

    test('POST /api/leads normalizes referralCode and auto-populates referrerId & referrerName', async () => {
      const leadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prospecto Referido',
          phone: '555-234-5678',
          address: 'Av. Reforma 100',
          acceptedTerms: true,
          referralCode: '  sofia-vip ',
        }),
      });
      assert.strictEqual(leadRes.status, 201);
      const { lead, state } = await leadRes.json();
      assert.strictEqual(lead.referralCode, 'SOFIA-VIP');
      assert.strictEqual(lead.referrerId, activePartner.id);
      assert.strictEqual(lead.referrerName, 'Sofía Ramírez');
      // Unauthenticated POST /api/leads still hides referrers list
      assert.deepStrictEqual(state.referrers, []);

      // Unknown referral code still preserves normalized code without crashing
      const orphanLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prospecto Código Libre',
          phone: '555-345-6789',
          address: 'Calle 5',
          acceptedTerms: true,
          referralCode: 'promo-externa',
        }),
      });
      assert.strictEqual(orphanLeadRes.status, 201);
      const orphan = (await orphanLeadRes.json()).lead;
      assert.strictEqual(orphan.referralCode, 'PROMO-EXTERNA');
      assert.strictEqual(orphan.referrerId, null);
      assert.strictEqual(orphan.referrerName, null);
    });

    test('PATCH /api/referrals/:id updates partner, checks duplicate code (409), resets visits, and DELETE removes partner', async () => {
      // Reject duplicate code on update
      const dupPatch = await fetch(`${baseUrl}/api/referrals/${activePartner.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'ROBERTO-OFF' }),
      });
      assert.strictEqual(dupPatch.status, 409);

      // Update details & resetVisits
      const patchRes = await fetch(`${baseUrl}/api/referrals/${activePartner.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Sofía Ramírez Editada',
          resetVisits: true,
        }),
      });
      assert.strictEqual(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.strictEqual(patched.ok, true);
      assert.strictEqual(patched.referrer.name, 'Sofía Ramírez Editada');
      assert.strictEqual(patched.referrer.visitsCount, 0);
      assert.strictEqual(patched.referrer.uniqueVisitsCount, 0);
      assert.strictEqual(patched.referrer.lastVisitAt, null);

      // Returning visitor-A counts as unique again after resetVisits
      await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'SOFIA-VIP', visitorId: 'visitor-A' }),
      });
      const afterResetList = await (
        await fetch(`${baseUrl}/api/referrals`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      const sofiaAfter = afterResetList.referrers.find((r) => r.id === activePartner.id);
      assert.strictEqual(sofiaAfter.visitsCount, 1);
      assert.strictEqual(sofiaAfter.uniqueVisitsCount, 1);

      // Delete inactivePartner
      const delRes = await fetch(`${baseUrl}/api/referrals/${inactivePartner.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.ok, true);
      assert.strictEqual(
        delData.state.referrers.some((r) => r.id === inactivePartner.id),
        false
      );

      // Deleting again returns 404
      const delMissing = await fetch(`${baseUrl}/api/referrals/${inactivePartner.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(delMissing.status, 404);
    });
  });

  describe('4. Batch Creation (20 Ambassadors), QR Code Linking, Prize Rule & Master Reset', () => {
    test('POST /api/referrals/batch creates 20 ambassadors in one click and handles items mode with duplicate skipping', async () => {
      const batch20Res = await fetch(`${baseUrl}/api/referrals/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count: 20,
          namePrefix: 'Embajador',
          codePrefix: 'EMB',
        }),
      });
      assert.strictEqual(batch20Res.status, 201);
      const batch20 = await batch20Res.json();
      assert.strictEqual(batch20.ok, true);
      assert.strictEqual(batch20.created.length, 20);
      assert.deepStrictEqual(batch20.skipped, []);
      assert.strictEqual(batch20.created[0].code, 'EMB-01');
      assert.strictEqual(batch20.created[19].code, 'EMB-20');

      // Items mode: auto-deduplicates omitted codes and skips explicit duplicate
      const itemsRes = await fetch(`${baseUrl}/api/referrals/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            { name: 'Ana Torres', phone: '555-100-2000' },
            { name: 'Ana Torres', phone: '555-100-2001' },
            { name: 'Duplicado Explícito', code: 'EMB-01' },
          ],
        }),
      });
      assert.strictEqual(itemsRes.status, 201);
      const itemsData = await itemsRes.json();
      assert.strictEqual(itemsData.created.length, 2);
      assert.strictEqual(itemsData.created[0].code, 'ANA-TORRES');
      assert.strictEqual(itemsData.created[1].code, 'ANA-TORRES-02');
      assert.deepStrictEqual(itemsData.skipped, ['EMB-01']);

      // Over 50 items rejected with 400
      const overLimit = await fetch(`${baseUrl}/api/referrals/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 51 }),
      });
      assert.strictEqual(overLimit.status, 400);
    });

    test('POST /api/qr-codes and POST /api/qr persist referralCode and referrerId', async () => {
      const stateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const { referrers } = await stateRes.json();
      const emb01 = referrers.find((r) => r.code === 'EMB-01');
      assert.ok(emb01);

      const qrRes = await fetch(`${baseUrl}/api/qr-codes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Embajador 01',
          targetUrl: 'https://royal.ciprian.example/?ref=EMB-01',
          referralCode: 'emb-01',
          referrerId: emb01.id,
        }),
      });
      assert.strictEqual(qrRes.status, 201);
      const qrData = await qrRes.json();
      assert.strictEqual(qrData.qr.referralCode, 'EMB-01');
      assert.strictEqual(qrData.qr.referrerId, emb01.id);

      // Verify persisted in GET /api/state
      const afterQrState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      const savedQr = afterQrState.qrHistory.find((q) => q.id === qrData.qr.id);
      assert.strictEqual(savedQr.referralCode, 'EMB-01');
      assert.strictEqual(savedQr.referrerId, emb01.id);
    });

    test('PATCH /api/settings persists referralPrizeRule cleanly', async () => {
      const nextRule = {
        prizeName: 'Bono Oro Royal Prestige $1,000',
        metric: 'points',
        targetCount: 25,
        maxWinners: 5,
        pointsPerLead: 2,
        pointsPerCita: 5,
        pointsPerDemo: 8,
        pointsPerOrden: 15,
      };
      const patchRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ referralPrizeRule: nextRule }),
      });
      assert.strictEqual(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.deepStrictEqual(patched.settings.referralPrizeRule, nextRule);

      const verifyState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.deepStrictEqual(verifyState.settings.referralPrizeRule, nextRule);
    });

    test('POST /api/admin/master-reset resets referrer visit counters to 0 when wiping leads', async () => {
      // Ensure EMB-01 has a visit
      await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'EMB-01', visitorId: 'pre-reset-visitor' }),
      });

      const resetRes = await fetch(`${baseUrl}/api/admin/master-reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: 'PoloNorte121966@',
          resetCatalogAndSettings: true,
        }),
      });
      assert.strictEqual(resetRes.status, 200);
      const resetData = await resetRes.json();
      assert.strictEqual(resetData.ok, true);
      assert.deepStrictEqual(resetData.state.leads, []);
      assert.deepStrictEqual(resetData.state.qrHistory, []);
      assert.deepStrictEqual(
        resetData.state.settings.referralPrizeRule,
        DEFAULT_REFERRAL_PRIZE_RULE
      );
      assert.ok(resetData.state.referrers.length >= 20);
      for (const partner of resetData.state.referrers) {
        assert.strictEqual(partner.visitsCount, 0);
        assert.strictEqual(partner.uniqueVisitsCount, 0);
        assert.strictEqual(partner.lastVisitAt, null);
      }
    });
  });

  describe('5. Auto-Tracking QRs Created Directly via POST /api/qr (2-QR End-to-End Scenario)', () => {
    test('Creating 2 different QRs via POST /api/qr auto-registers both in state.referrers, tracks visits & leads separately, and reuses existing partner on duplicate code', async () => {
      // QR #1: Explicit referralCode without pre-creating a referrer
      const qr1Res = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR María',
          targetUrl: 'https://royal.ciprian.example/?ref=maria-auto-01',
          referralCode: 'maria-auto-01',
          styleId: 'emerald-heritage',
        }),
      });
      assert.strictEqual(qr1Res.status, 201);
      const qr1Data = await qr1Res.json();
      assert.strictEqual(qr1Data.ok, true);
      assert.ok(qr1Data.referrer, 'QR #1 should auto-create and return linked referrer');
      assert.strictEqual(qr1Data.referrer.name, 'QR María');
      assert.strictEqual(qr1Data.referrer.code, 'MARIA-AUTO-01');
      assert.strictEqual(qr1Data.referrer.active, true);
      assert.strictEqual(qr1Data.referrer.visitsCount, 0);
      assert.strictEqual(qr1Data.referrer.uniqueVisitsCount, 0);
      assert.strictEqual(qr1Data.referrer.qrStyleId, 'emerald-heritage');
      assert.strictEqual(qr1Data.qr.referralCode, 'MARIA-AUTO-01');
      assert.strictEqual(qr1Data.qr.referrerId, qr1Data.referrer.id);
      assert.ok(
        qr1Data.state.referrers.some(
          (r) => r.id === qr1Data.referrer.id && r.code === 'MARIA-AUTO-01' && r.name === 'QR María'
        )
      );

      // QR #2: No referralCode in body — extracted automatically from ?r= query param in targetUrl
      const qr2Res = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Carlos',
          targetUrl: 'https://royal.ciprian.example/?r=carlos-auto-02',
          styleId: 'ruby-atelier',
        }),
      });
      assert.strictEqual(qr2Res.status, 201);
      const qr2Data = await qr2Res.json();
      assert.strictEqual(qr2Data.ok, true);
      assert.ok(qr2Data.referrer, 'QR #2 should auto-create referrer from targetUrl ?r= param');
      assert.strictEqual(qr2Data.referrer.name, 'QR Carlos');
      assert.strictEqual(qr2Data.referrer.code, 'CARLOS-AUTO-02');
      assert.strictEqual(qr2Data.referrer.qrStyleId, 'ruby-atelier');
      assert.strictEqual(qr2Data.qr.referralCode, 'CARLOS-AUTO-02');
      assert.strictEqual(qr2Data.qr.referrerId, qr2Data.referrer.id);
      assert.ok(
        qr2Data.state.referrers.some(
          (r) => r.id === qr2Data.referrer.id && r.code === 'CARLOS-AUTO-02' && r.name === 'QR Carlos'
        )
      );

      // Simulate visits to both QRs (2 total / 2 unique for María, 1 total / 1 unique for Carlos)
      const visitM1 = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'MARIA-AUTO-01', visitorId: 'vis-m-1' }),
      });
      assert.strictEqual((await visitM1.json()).counted, true);

      const visitM2 = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'maria-auto-01', visitorId: 'vis-m-2' }),
      });
      assert.strictEqual((await visitM2.json()).counted, true);

      const visitC1 = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'CARLOS-AUTO-02', visitorId: 'vis-c-1' }),
      });
      assert.strictEqual((await visitC1.json()).counted, true);

      // Submit a lead from each QR's code
      const leadMRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invitada de María',
          phone: '555-801-1001',
          address: 'Monterrey',
          acceptedTerms: true,
          referralCode: 'MARIA-AUTO-01',
        }),
      });
      assert.strictEqual(leadMRes.status, 201);
      const leadM = (await leadMRes.json()).lead;
      assert.strictEqual(leadM.referralCode, 'MARIA-AUTO-01');
      assert.strictEqual(leadM.referrerId, qr1Data.referrer.id);
      assert.strictEqual(leadM.referrerName, 'QR María');

      const leadCRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invitado de Carlos',
          phone: '555-802-2002',
          address: 'Guadalajara',
          acceptedTerms: true,
          referralCode: 'carlos-auto-02',
        }),
      });
      assert.strictEqual(leadCRes.status, 201);
      const leadC = (await leadCRes.json()).lead;
      assert.strictEqual(leadC.referralCode, 'CARLOS-AUTO-02');
      assert.strictEqual(leadC.referrerId, qr2Data.referrer.id);
      assert.strictEqual(leadC.referrerName, 'QR Carlos');

      // Creating a second QR with already-existing MARIA-AUTO-01 reuses existing partner without duplicating
      const beforeCount = (
        await (
          await fetch(`${baseUrl}/api/referrals`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
        ).json()
      ).referrers.filter((r) => r.code === 'MARIA-AUTO-01').length;
      assert.strictEqual(beforeCount, 1);

      const qrDupCodeRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR María Versión Impresa',
          targetUrl: 'https://royal.ciprian.example/?ref=MARIA-AUTO-01',
          referralCode: 'MARIA-AUTO-01',
        }),
      });
      assert.strictEqual(qrDupCodeRes.status, 201);
      const qrDupData = await qrDupCodeRes.json();
      assert.strictEqual(qrDupData.ok, true);
      assert.strictEqual(qrDupData.referrer.id, qr1Data.referrer.id);
      assert.strictEqual(qrDupData.qr.referrerId, qr1Data.referrer.id);
      assert.strictEqual(
        qrDupData.state.referrers.filter((r) => r.code === 'MARIA-AUTO-01').length,
        1
      );

      // Plain QR without referralCode or ?ref= does NOT auto-create a referrer
      const plainQrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Genérico Sin Ref',
          targetUrl: 'https://royal.ciprian.example/evento',
        }),
      });
      assert.strictEqual(plainQrRes.status, 201);
      const plainQrData = await plainQrRes.json();
      assert.strictEqual(plainQrData.ok, true);
      assert.strictEqual(plainQrData.referrer, null);
      assert.strictEqual(plainQrData.qr.referralCode, null);
      assert.strictEqual(plainQrData.qr.referrerId, null);

      // Confirm exact visit counts and attributed leads in Admin GET /api/state
      const finalState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      const mariaPartner = finalState.referrers.find((r) => r.id === qr1Data.referrer.id);
      const carlosPartner = finalState.referrers.find((r) => r.id === qr2Data.referrer.id);
      assert.strictEqual(mariaPartner.visitsCount, 2);
      assert.strictEqual(mariaPartner.uniqueVisitsCount, 2);
      assert.strictEqual(carlosPartner.visitsCount, 1);
      assert.strictEqual(carlosPartner.uniqueVisitsCount, 1);
      assert.ok(finalState.leads.some((l) => l.id === leadM.id && l.referrerId === mariaPartner.id));
      assert.ok(finalState.leads.some((l) => l.id === leadC.id && l.referrerId === carlosPartner.id));
    });
  });
});
