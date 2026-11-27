import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TEST_STORE_FILE = path.join(
  os.tmpdir(),
  `royal-referrals-test-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-referrals-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const MASTER_KEY = 'PoloNorte121966@';
const ADMIN_DEFAULT_PASSWORD = 'AdminMaster2026@';

const {
  default: app,
  DEFAULT_REFERRAL_PRIZE_RULE,
  normalizeLeadRecord,
  normalizeReferralCode,
  sanitizeAvatarUrl,
  sanitizeReferralPrizeRule,
  normalizeReferrerRecord,
  normalizeVisitEvent,
  enforceRefParamOnUrl,
  mapLeadRow,
  mapQrRow,
  mapReferrerRow,
  mapVisitRow,
} = await import('../server/index.js');

async function loginAdmin(baseUrl, username = 'AdminCiprian', password = 'AdminMaster2026@', pin = '1966') {
  const step1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(step1.status, 200, `Step 1 admin login failed for ${username}`);
  const d1 = await step1.json();
  assert.strictEqual(d1.requiresPin, true);

  const step2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken: d1.preAuthToken, pin }),
  });
  assert.strictEqual(step2.status, 200, `Step 2 PIN failed for ${username}`);
  return (await step2.json()).sessionToken;
}

async function loginDirect(baseUrl, username, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(res.status, 200, `Direct 1FA login failed for ${username}`);
  const data = await res.json();
  assert.strictEqual(data.requiresPin, false);
  return data.sessionToken;
}

describe('Ambassador Accounts, Strict QR Linking & Timestamped Visits Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let teleToken;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    adminToken = await loginAdmin(baseUrl);
    teleToken = await loginDirect(baseUrl, 'Telemarketing', 'UsuCa2026@');
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    for (const file of [TEST_STORE_FILE, TEST_AUTH_FILE]) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        // Ignore cleanup failure
      }
    }
  });

  describe('1. Unit Helpers, URL Tag Enforcement & Schema Contract', () => {
    test('normalizeReferralCode, enforceRefParamOnUrl, normalizeVisitEvent & row mappers work cleanly', () => {
      assert.strictEqual(normalizeReferralCode('  maria-01  '), 'MARIA-01');
      assert.strictEqual(normalizeReferralCode('María José'), 'MARIA-JOSE');
      assert.strictEqual(normalizeReferralCode('a'), null);

      assert.strictEqual(
        enforceRefParamOnUrl('https://royal.ciprian.example/show?tag=OLD&mesa=1', 'MARIA-01'),
        'https://royal.ciprian.example/show?mesa=1&ref=MARIA-01'
      );
      assert.strictEqual(
        enforceRefParamOnUrl('/?r=wrong', 'CARLOS-02'),
        '/?ref=CARLOS-02'
      );

      const visit = normalizeVisitEvent({
        referrerId: 'ref-1',
        referralCode: 'maria-01',
        visitorId: 'vis-1',
        visitedAt: '2026-11-24T12:00:00.000Z',
      });
      assert.strictEqual(visit.referralCode, 'MARIA-01');
      assert.strictEqual(visit.referrerId, 'ref-1');

      const mappedVisit = mapVisitRow({
        id: 'visit-1',
        referrer_id: 'ref-1',
        referral_code: 'maria-01',
        visitor_id: 'vis-99',
        visited_at: '2026-11-24T13:00:00.000Z',
      });
      assert.strictEqual(mappedVisit.id, 'visit-1');
      assert.strictEqual(mappedVisit.referralCode, 'MARIA-01');
      assert.strictEqual(mappedVisit.visitedAt, '2026-11-24T13:00:00.000Z');

      const mappedPartner = mapReferrerRow({
        id: 'ref-1',
        account_id: 'usr-1',
        name: 'Laura Méndez',
        code: 'laura-01',
        avatar_url: 'https://cdn.example.com/laura.jpg',
        active: true,
        visits_count: 5,
        unique_visits_count: 3,
        created_at: '2026-11-20T10:00:00.000Z',
      });
      assert.strictEqual(mappedPartner.accountId, 'usr-1');
      assert.strictEqual(mappedPartner.code, 'LAURA-01');
      assert.strictEqual(mappedPartner.avatarUrl, 'https://cdn.example.com/laura.jpg');

      // sanitizeAvatarUrl unit checks
      const samplePng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      assert.deepStrictEqual(sanitizeAvatarUrl(null), { ok: true, value: null });
      assert.deepStrictEqual(sanitizeAvatarUrl('   '), { ok: true, value: null });
      assert.deepStrictEqual(sanitizeAvatarUrl('https://cdn.example.com/a.webp'), {
        ok: true,
        value: 'https://cdn.example.com/a.webp',
      });
      assert.strictEqual(sanitizeAvatarUrl(samplePng).ok, true);
      assert.strictEqual(
        sanitizeAvatarUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=').ok,
        false
      );
      assert.strictEqual(sanitizeAvatarUrl('javascript:alert(1)').ok, false);
      assert.strictEqual(
        sanitizeAvatarUrl(`data:image/jpeg;base64,${'A'.repeat(560000)}`).ok,
        false
      );

      const mappedQr = mapQrRow({
        id: 'qr-1',
        name: 'QR Laura',
        target_url: 'https://example.com/?ref=LAURA-01',
        referral_code: 'laura-01',
        referrer_id: 'ref-1',
        account_id: 'usr-1',
        created_at: '2026-11-21T11:00:00.000Z',
      });
      assert.strictEqual(mappedQr.accountId, 'usr-1');

      const mappedLead = mapLeadRow({
        id: 'lead-1',
        name: 'Juan',
        phone: '555-111-2222',
        claim_code: 'OTN-1234',
        call_outcome: 'not_scheduled',
        called_by: 'Telemarketing',
        seller_locked: false,
        referral_code: 'laura-01',
        referrer_id: 'ref-1',
        referrer_name: 'Laura Méndez',
        created_at: '2026-11-21T11:00:00.000Z',
      });
      assert.strictEqual(mappedLead.callOutcome, 'not_scheduled');
      assert.strictEqual(mappedLead.called, true);
      assert.strictEqual(mappedLead.calledBy, 'Telemarketing');
    });

    test('defaultStore.json and supabase/schema.sql define updated persistence contract', () => {
      const defaultStore = JSON.parse(
        fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'shared', 'defaultStore.json'), 'utf8')
      );
      assert.deepStrictEqual(defaultStore.referrers, []);
      assert.deepStrictEqual(defaultStore.visitLog, []);
      assert.deepStrictEqual(defaultStore.settings.referralPrizeRule, DEFAULT_REFERRAL_PRIZE_RULE);

      const schemaSql = fs.readFileSync(path.join(PROJECT_ROOT, 'supabase', 'schema.sql'), 'utf8');
      assert.match(schemaSql, /create table if not exists public\.referrers/i);
      assert.match(schemaSql, /create table if not exists public\.referral_visits/i);
      assert.match(schemaSql, /referral_visits_service_only/i);
      assert.match(schemaSql, /referrers_service_only/i);
      assert.match(schemaSql, /revoke all on table public\.referrers from anon, authenticated, public/i);
      assert.match(schemaSql, /alter table public\.app_settings add column if not exists referral_prize_rule jsonb/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists referral_code text/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists referrer_id text/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists referrer_name text/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists call_outcome text/i);
      assert.match(schemaSql, /alter table public\.leads add column if not exists seller_locked boolean/i);
      assert.match(schemaSql, /alter table public\.qr_codes add column if not exists referral_code text/i);
      assert.match(schemaSql, /alter table public\.qr_codes add column if not exists referrer_id text/i);
      assert.match(schemaSql, /alter table public\.qr_codes add column if not exists account_id text/i);
      assert.match(schemaSql, /alter table public\.referrers add column if not exists account_id text/i);
      assert.match(schemaSql, /alter table public\.referrers add column if not exists avatar_url text/i);
      assert.match(schemaSql, /alter table public\.dsb_auth add column if not exists avatar_url text/i);
      assert.match(schemaSql, /alter table public\.dsb_auth add column if not exists token_version int/i);
    });
  });

  describe('2. Vendedor Account <-> Referrer Auto-Sync, Standalone Rejection & Strict QR Linking', () => {
    let vendedorAccount;
    let vendedorReferrer;
    let vendedorToken;
    let teleAccountId;

    test('Standalone POST /api/referrals and /api/referrals/batch are rejected (401 without adminPassword, 400 without vendedor accountId)', async () => {
      const noMaster = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Sin Llave' }),
      });
      assert.strictEqual(noMaster.status, 401);

      const masterRejected = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Master Rechazada', masterPassword: MASTER_KEY }),
      });
      assert.strictEqual(masterRejected.status, 401);

      const standalone = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Sin Cuenta', adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(standalone.status, 400);

      const batchBlocked = await fetch(`${baseUrl}/api/referrals/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 5, adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(batchBlocked.status, 400);
    });

    test('Creating a vendedor account auto-syncs a ReferralPartner and allows strict QR creation with forced ?ref=TAG', async () => {
      const createRes = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          username: 'sofia_vend',
          displayName: 'Sofía Ramírez',
          role: 'vendedor',
          tag: 'sofia-vip',
          avatarUrl: 'https://cdn.example.com/sofia.jpg',
          password: 'SofiaPassword1!',
          confirmPassword: 'SofiaPassword1!',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const data = await createRes.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.account.tag, 'SOFIA-VIP');
      assert.strictEqual(data.account.avatarUrl, 'https://cdn.example.com/sofia.jpg');
      assert.strictEqual(data.account.hasPin, false);
      assert.ok(data.referrer);
      assert.strictEqual(data.referrer.accountId, data.account.id);
      assert.strictEqual(data.referrer.code, 'SOFIA-VIP');
      assert.strictEqual(data.referrer.name, 'Sofía Ramírez');
      assert.strictEqual(data.referrer.avatarUrl, 'https://cdn.example.com/sofia.jpg');
      vendedorAccount = data.account;
      vendedorReferrer = data.referrer;

      const teleAcc = data.accounts.find((a) => a.role === 'telemarketing');
      teleAccountId = teleAcc.id;

      // Vendedor logs in 1FA
      vendedorToken = await loginDirect(baseUrl, 'sofia_vend', 'SofiaPassword1!');

      // Plain QR without accountId/referrerId -> 400
      const plainQr = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Genérico Prohibido',
          targetUrl: 'https://royal.ciprian.example/',
        }),
      });
      assert.strictEqual(plainQr.status, 400);

      // QR linked to telemarketing account -> 400
      const teleQr = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Telemarketing Prohibido',
          targetUrl: 'https://royal.ciprian.example/',
          accountId: teleAccountId,
        }),
      });
      assert.strictEqual(teleQr.status, 400);

      // QR linked to active vendedor account succeeds & forces ?ref=SOFIA-VIP
      const okQrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Sofía Mesa 1',
          targetUrl: 'https://royal.ciprian.example/?ref=OTHER-FAKE',
          accountId: vendedorAccount.id,
          styleId: 'emerald-heritage',
        }),
      });
      assert.strictEqual(okQrRes.status, 201);
      const qrData = await okQrRes.json();
      assert.strictEqual(qrData.qr.accountId, vendedorAccount.id);
      assert.strictEqual(qrData.qr.referrerId, vendedorReferrer.id);
      assert.strictEqual(qrData.qr.referralCode, 'SOFIA-VIP');
      assert.strictEqual(qrData.qr.targetUrl, 'https://royal.ciprian.example/?ref=SOFIA-VIP');
    });

    test('Public resolve (zero PII), timestamped visits in visitLog, lead attribution & resetVisits work end-to-end', async () => {
      // Resolve includes avatarUrl and zero PII
      const resolveRes = await fetch(`${baseUrl}/api/referrals/resolve/sofia-vip`);
      assert.strictEqual(resolveRes.status, 200);
      const resolveData = await resolveRes.json();
      assert.deepStrictEqual(resolveData.partner, {
        id: vendedorReferrer.id,
        name: 'Sofía Ramírez',
        code: 'SOFIA-VIP',
        active: true,
        avatarUrl: 'https://cdn.example.com/sofia.jpg',
        emoji: null,
        partnerType: 'vendedor',
        ownerVendedorName: null,
      });

      // Record 3 visits (2 unique) and confirm visit response exposes partner.avatarUrl
      for (const visitorId of ['vis-1', 'vis-1', 'vis-2']) {
        const vRes = await fetch(`${baseUrl}/api/referrals/visit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'sofia-vip', visitorId }),
        });
        assert.strictEqual(vRes.status, 200);
        const vData = await vRes.json();
        assert.strictEqual(vData.counted, true);
        assert.strictEqual(vData.partner.avatarUrl, 'https://cdn.example.com/sofia.jpg');
        assert.strictEqual(vData.visit.referralCode, 'SOFIA-VIP');
        assert.ok(typeof vData.visit.visitedAt === 'string');
      }

      // Admin state includes visitLog with 3 timestamped events
      const adminState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.strictEqual(adminState.visitLog.length, 3);
      const sofiaPartner = adminState.referrers.find((r) => r.id === vendedorReferrer.id);
      assert.strictEqual(sofiaPartner.visitsCount, 3);
      assert.strictEqual(sofiaPartner.uniqueVisitsCount, 2);

      // Vendedor state includes ONLY own visitLog & own QRs
      const vendState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${vendedorToken}` },
        })
      ).json();
      assert.strictEqual(vendState.role, 'vendedor');
      assert.strictEqual(vendState.visitLog.length, 3);
      assert.strictEqual(vendState.qrHistory.length, 1);

      // Telemarketing gets empty visitLog & empty qrHistory
      const teleState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${teleToken}` },
        })
      ).json();
      assert.deepStrictEqual(teleState.visitLog, []);
      assert.deepStrictEqual(teleState.qrHistory, []);

      // Lead submission attributes to Sofía and preserves US credit qualification
      const leadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prospecto de Sofía',
          phone: '555-610-9090',
          address: 'Houston, TX',
          acceptedTerms: true,
          referralCode: 'sofia-vip',
        }),
      });
      assert.strictEqual(leadRes.status, 201);
      const { lead } = await leadRes.json();
      assert.strictEqual(lead.referralCode, 'SOFIA-VIP');
      assert.strictEqual(lead.referrerId, vendedorReferrer.id);
      assert.strictEqual(lead.referrerName, 'Sofía Ramírez');

      const qualPatch = await fetch(`${baseUrl}/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qualification: {
            creditProfile: 'excelente',
            housingStatus: 'propia',
            investmentPriority: 'salud',
            score: 92,
            tier: 'alto',
            usCreditEstablished: 'yes',
            usCreditLabel: 'Crédito establecido en EE. UU.',
            cedeGoldenTicket: true,
          },
        }),
      });
      assert.strictEqual(qualPatch.status, 200);
      const patched = await qualPatch.json();
      assert.strictEqual(patched.lead.qualification.usCreditEstablished, 'yes');
      assert.strictEqual(patched.lead.qualification.cedeGoldenTicket, true);

      // Reset visits on referrer requires logged-in Admin's own password and clears visitLog
      const noMasterReset = await fetch(`${baseUrl}/api/referrals/${vendedorReferrer.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resetVisits: true }),
      });
      assert.strictEqual(noMasterReset.status, 401);

      const okReset = await fetch(`${baseUrl}/api/referrals/${vendedorReferrer.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resetVisits: true, adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(okReset.status, 200);
      const afterReset = await okReset.json();
      assert.strictEqual(afterReset.referrer.visitsCount, 0);
      assert.strictEqual(afterReset.state.visitLog.length, 0);

      // Updating vendedor tag syncs referrer code
      const tagUpdate = await fetch(`${baseUrl}/api/accounts/${vendedorAccount.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          displayName: 'Sofía Ramírez Pro',
          tag: 'SOFIA-PRO',
        }),
      });
      assert.strictEqual(tagUpdate.status, 200);
      const tagData = await tagUpdate.json();
      const updatedPartner = tagData.state.referrers.find((r) => r.id === vendedorReferrer.id);
      assert.strictEqual(updatedPartner.code, 'SOFIA-PRO');
      assert.strictEqual(updatedPartner.name, 'Sofía Ramírez Pro');

      // Master reset wipes leads, qrHistory, visitLog (requires logged-in Admin's own password)
      const masterResetRes = await fetch(`${baseUrl}/api/admin/master-reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD, resetCatalogAndSettings: true }),
      });
      assert.strictEqual(masterResetRes.status, 200);
      const resetJson = await masterResetRes.json();
      assert.deepStrictEqual(resetJson.state.leads, []);
      assert.deepStrictEqual(resetJson.state.qrHistory, []);
      assert.deepStrictEqual(resetJson.state.visitLog, []);
    });
  });
});
