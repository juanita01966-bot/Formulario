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
  `royal-embajadores-store-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-embajadores-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const MASTER_KEY = 'PoloNorte121966@';
const ADMIN_DEFAULT_PASSWORD = 'AdminMaster2026@';

const {
  default: app,
  sanitizeEmojiInput,
  resetFraudTrackers,
} = await import('../server/index.js');

async function loginAdmin(baseUrl, username = 'AdminCiprian', password = ADMIN_DEFAULT_PASSWORD, pin = '1966') {
  const step1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(step1.status, 200);
  const d1 = await step1.json();
  assert.strictEqual(d1.requiresPin, true);

  const step2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken: d1.preAuthToken, pin }),
  });
  assert.strictEqual(step2.status, 200);
  return (await step2.json()).sessionToken;
}

async function loginDirect(baseUrl, username, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(res.status, 200);
  return (await res.json()).sessionToken;
}

describe('Embajadores, Vendedor Manual Leads & Vendedor 3-State Permissions Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let teleToken;
  let vendedorAToken;
  let vendedorBToken;
  let vendedorAAccount;
  let vendedorBAccount;

  before(async () => {
    resetFraudTrackers();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    adminToken = await loginAdmin(baseUrl);
    teleToken = await loginDirect(baseUrl, 'Telemarketing', 'UsuCa2026@');

    // Create Vendedor A
    const createA = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminPassword: ADMIN_DEFAULT_PASSWORD,
        username: 'vendedor_alpha',
        displayName: 'Alpha Ventas',
        role: 'vendedor',
        tag: 'ALPHA-01',
        password: 'AlphaPassword1!',
        confirmPassword: 'AlphaPassword1!',
      }),
    });
    assert.strictEqual(createA.status, 201);
    vendedorAAccount = (await createA.json()).account;
    vendedorAToken = await loginDirect(baseUrl, 'vendedor_alpha', 'AlphaPassword1!');

    // Create Vendedor B
    const createB = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminPassword: ADMIN_DEFAULT_PASSWORD,
        username: 'vendedor_beta',
        displayName: 'Beta Ventas',
        role: 'vendedor',
        tag: 'BETA-02',
        password: 'BetaPassword1!',
        confirmPassword: 'BetaPassword1!',
      }),
    });
    assert.strictEqual(createB.status, 201);
    vendedorBAccount = (await createB.json()).account;
    vendedorBToken = await loginDirect(baseUrl, 'vendedor_beta', 'BetaPassword1!');
  });

  after(async () => {
    resetFraudTrackers();
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

  describe('1. Schema, Emoji Sanitization & Zero-XSS Validation', () => {
    test('supabase/schema.sql adds idempotent Embajadores columns and indexes on public.referrers', () => {
      const schemaSql = fs.readFileSync(path.join(PROJECT_ROOT, 'supabase', 'schema.sql'), 'utf8');
      assert.match(schemaSql, /alter table public\.referrers\s+add column if not exists partner_type/i);
      assert.match(schemaSql, /add column if not exists owner_vendedor_account_id/i);
      assert.match(schemaSql, /add column if not exists owner_vendedor_name/i);
      assert.match(schemaSql, /add column if not exists owner_vendedor_tag/i);
      assert.match(schemaSql, /add column if not exists emoji/i);
      assert.match(schemaSql, /referrers_partner_type_idx/i);
      assert.match(schemaSql, /referrers_owner_vendedor_account_id_idx/i);
    });

    test('sanitizeEmojiInput accepts safe emojis and strictly rejects HTML/XSS/alphanumeric/oversized strings', () => {
      assert.deepStrictEqual(sanitizeEmojiInput('🌟'), { ok: true, value: '🌟' });
      assert.deepStrictEqual(sanitizeEmojiInput('👑✨'), { ok: true, value: '👑✨' });
      assert.deepStrictEqual(sanitizeEmojiInput('  '), { ok: true, value: null });
      assert.deepStrictEqual(sanitizeEmojiInput(null), { ok: true, value: null });

      for (const bad of [
        '<script>alert(1)</script>',
        '<img src=x>',
        'ABC',
        '123',
        '🌟A',
        '"quoted"',
        '🌟'.repeat(10),
        '!!!',
      ]) {
        const res = sanitizeEmojiInput(bad);
        assert.strictEqual(res.ok, false, `Expected sanitizeEmojiInput to reject ${JSON.stringify(bad)}`);
      }
    });
  });

  describe('2. Embajador Creation (Vendedor & Admin), No Login Account, and Strict RBAC Isolation', () => {
    let embVendedorAWithEmoji;
    let embAdminWithAvatar;
    let embAdminDirect;

    test('Vendedor A creates Embajador with emoji and Admin creates Embajadores with avatarUrl/direct — ZERO dsb_auth accounts created', async () => {
      // Vendedor A creates Embajador with emoji (auto-generated code)
      const resA = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'María Anfitriona',
          emoji: '🌟',
          qrStyleId: 'emerald-heritage',
          phone: '555-300-1001',
          notes: 'Anfitriona VIP zona norte',
          targetUrl: 'https://royal.ciprian.example/',
          createQr: true,
        }),
      });
      assert.strictEqual(resA.status, 201);
      const dataA = await resA.json();
      embVendedorAWithEmoji = dataA.referrer;
      assert.strictEqual(embVendedorAWithEmoji.partnerType, 'embajador');
      assert.strictEqual(embVendedorAWithEmoji.accountId, null);
      assert.strictEqual(embVendedorAWithEmoji.emoji, '🌟');
      assert.strictEqual(embVendedorAWithEmoji.ownerVendedorAccountId, vendedorAAccount.id);
      assert.strictEqual(embVendedorAWithEmoji.ownerVendedorTag, 'ALPHA-01');
      assert.match(embVendedorAWithEmoji.code, /^EMB-/);
      assert.ok(dataA.qr, 'Expected initial QR created for Embajador');
      assert.strictEqual(dataA.qr.referrerId, embVendedorAWithEmoji.id);
      assert.strictEqual(dataA.qr.referralCode, embVendedorAWithEmoji.code);
      assert.strictEqual(
        dataA.qr.targetUrl,
        `https://royal.ciprian.example/?ref=${embVendedorAWithEmoji.code}`
      );

      // Admin creates Embajador with avatarUrl assigned to Vendedor A
      const resAdminAssigned = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Lucía Foto',
          avatarUrl: 'https://cdn.example.com/lucia-emb.jpg',
          code: 'EMB-LUCIA',
          ownerVendedorAccountId: vendedorAAccount.id,
          qrStyleId: 'classic-gold',
          createQr: true,
          targetUrl: 'https://royal.ciprian.example/',
        }),
      });
      assert.strictEqual(resAdminAssigned.status, 201);
      embAdminWithAvatar = (await resAdminAssigned.json()).referrer;
      assert.strictEqual(embAdminWithAvatar.partnerType, 'embajador');
      assert.strictEqual(embAdminWithAvatar.accountId, null);
      assert.strictEqual(embAdminWithAvatar.avatarUrl, 'https://cdn.example.com/lucia-emb.jpg');
      assert.strictEqual(embAdminWithAvatar.code, 'EMB-LUCIA');
      assert.strictEqual(embAdminWithAvatar.ownerVendedorAccountId, vendedorAAccount.id);

      // Admin creates Ciprian Directo Embajador (no owner vendedor)
      const resAdminDirect = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Ciprian Embajador Directo',
          emoji: '👑',
          code: 'EMB-DIRECTO',
          createQr: false,
        }),
      });
      assert.strictEqual(resAdminDirect.status, 201);
      const directJson = await resAdminDirect.json();
      embAdminDirect = directJson.referrer;
      assert.strictEqual(embAdminDirect.ownerVendedorAccountId, null);
      assert.strictEqual(directJson.qr, null);

      // Verify NO dsb_auth account was created for any Embajador
      const accRes = await fetch(`${baseUrl}/api/accounts`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(accRes.status, 200);
      const { accounts } = await accRes.json();
      assert.strictEqual(
        accounts.some(
          (a) =>
            a.displayName === 'María Anfitriona' ||
            a.displayName === 'Lucía Foto' ||
            a.tag === embVendedorAWithEmoji.code ||
            a.tag === 'EMB-LUCIA'
        ),
        false,
        'Embajadores must NEVER create accounts in dsb_auth'
      );

      // Verify cannot log in using Embajador name or code
      for (const candidateUser of [
        'María Anfitriona',
        embVendedorAWithEmoji.code,
        'EMB-LUCIA',
        'Lucía Foto',
      ]) {
        const loginAttempt = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: candidateUser, password: 'AnyPassword1!' }),
        });
        assert.strictEqual(loginAttempt.status, 401);
      }

      // Reject XSS/invalid emoji via HTTP
      const badEmojiRes = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Malicioso',
          emoji: '<script>',
        }),
      });
      assert.strictEqual(badEmojiRes.status, 400);
    });

    test('RBAC Isolation: Vendedor B cannot view, edit, pause, reassign, or generate QRs for Vendedor A Embajadores (403 + alert)', async () => {
      // Vendedor B state does NOT contain Vendedor A's Embajadores
      const stateBRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${vendedorBToken}` },
      });
      assert.strictEqual(stateBRes.status, 200);
      const stateB = await stateBRes.json();
      assert.strictEqual(
        stateB.referrers.some((r) => r.id === embVendedorAWithEmoji.id || r.id === embAdminWithAvatar.id),
        false,
        'Vendedor B must NOT see Vendedor A Embajadores'
      );

      // Vendedor A state DOES contain both own Embajadores + own direct referrer
      const stateARes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${vendedorAToken}` },
      });
      assert.strictEqual(stateARes.status, 200);
      const stateA = await stateARes.json();
      assert.ok(stateA.referrers.some((r) => r.id === embVendedorAWithEmoji.id));
      assert.ok(stateA.referrers.some((r) => r.id === embAdminWithAvatar.id));
      assert.strictEqual(
        stateA.referrers.some((r) => r.id === embAdminDirect.id),
        false,
        'Vendedor A must NOT see Ciprian Directo Embajador'
      );

      // Vendedor B tries to edit Vendedor A's Embajador -> 403
      const editForeign = await fetch(`${baseUrl}/api/embajadores/${embVendedorAWithEmoji.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hackeado' }),
      });
      assert.strictEqual(editForeign.status, 403);

      // Vendedor B tries to pause Vendedor A's Embajador -> 403
      const pauseForeign = await fetch(`${baseUrl}/api/embajadores/${embVendedorAWithEmoji.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: false }),
      });
      assert.strictEqual(pauseForeign.status, 403);

      // Vendedor B tries to create an Embajador assigned to Vendedor A -> 403
      const createForeignOwner = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Intruso',
          emoji: '🔥',
          ownerVendedorAccountId: vendedorAAccount.id,
        }),
      });
      assert.strictEqual(createForeignOwner.status, 403);

      // Vendedor B tries to generate a QR for Vendedor A's Embajador -> 403
      const qrForeign = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Robado',
          targetUrl: 'https://royal.ciprian.example/',
          referrerId: embVendedorAWithEmoji.id,
        }),
      });
      assert.strictEqual(qrForeign.status, 403);

      // Telemarketing cannot create or edit Embajadores or create QRs -> 403
      const teleCreateEmb = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Tele Emb', emoji: '✨' }),
      });
      assert.strictEqual(teleCreateEmb.status, 403);

      const teleQr = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Tele QR',
          targetUrl: 'https://royal.ciprian.example/',
          referrerId: embVendedorAWithEmoji.id,
        }),
      });
      assert.strictEqual(teleQr.status, 403);

      // Confirm rbac_unauthorized_attempt alerts were recorded in Admin Security Center
      const alertsRes = await fetch(`${baseUrl}/api/security/alerts`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(alertsRes.status, 200);
      const { alerts } = await alertsRes.json();
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.metadata?.reason === 'vendedor_foreign_embajador_edit'
        ),
        'Expected rbac_unauthorized_attempt for foreign embajador edit/pause'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.metadata?.reason === 'vendedor_foreign_embajador_qr'
        ),
        'Expected rbac_unauthorized_attempt for foreign embajador QR generation'
      );
    });

    test('Public ?ref=<EMBAJADOR_CODE> resolve, visit & lead registration attributes to Embajador and flows to owning Vendedor & Admin', async () => {
      // Public resolve includes emoji, partnerType, ownerVendedorName and zero PII
      const resolveRes = await fetch(
        `${baseUrl}/api/referrals/resolve/${encodeURIComponent(embVendedorAWithEmoji.code)}`
      );
      assert.strictEqual(resolveRes.status, 200);
      const resolveData = await resolveRes.json();
      assert.strictEqual(resolveData.partner.partnerType, 'embajador');
      assert.strictEqual(resolveData.partner.emoji, '🌟');
      assert.strictEqual(resolveData.partner.ownerVendedorName, 'Alpha Ventas');
      assert.strictEqual(resolveData.partner.phone, undefined);
      assert.strictEqual(resolveData.partner.notes, undefined);

      // Record public visit
      const visitRes = await fetch(`${baseUrl}/api/referrals/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: embVendedorAWithEmoji.code,
          visitorId: 'emb-visitor-001',
        }),
      });
      assert.strictEqual(visitRes.status, 200);
      const visitData = await visitRes.json();
      assert.strictEqual(visitData.partner.emoji, '🌟');
      assert.strictEqual(visitData.partner.partnerType, 'embajador');

      // Public lead registration via ?ref=<EMBAJADOR_CODE>
      const pubLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Cliente Embajador Público',
          phone: '555-710-2001',
          address: 'Houston, TX',
          acceptedTerms: true,
          referralCode: embVendedorAWithEmoji.code,
        }),
      });
      assert.strictEqual(pubLeadRes.status, 201);
      const pubLead = (await pubLeadRes.json()).lead;
      assert.strictEqual(pubLead.referrerId, embVendedorAWithEmoji.id);
      assert.strictEqual(pubLead.referralCode, embVendedorAWithEmoji.code);
      assert.strictEqual(pubLead.callOutcome, 'pending');

      // Owning Vendedor A sees this Embajador lead & visit in GET /api/state
      const stateA = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${vendedorAToken}` },
        })
      ).json();
      assert.ok(stateA.leads.some((l) => l.id === pubLead.id));
      assert.ok(stateA.visitLog.some((v) => v.referralCode === embVendedorAWithEmoji.code));

      // Vendedor B does NOT see this lead or visit
      const stateB = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${vendedorBToken}` },
        })
      ).json();
      assert.strictEqual(stateB.leads.some((l) => l.id === pubLead.id), false);
      assert.strictEqual(
        stateB.visitLog.some((v) => v.referralCode === embVendedorAWithEmoji.code),
        false
      );

      // Admin sees this lead and Embajador
      const adminState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.ok(adminState.leads.some((l) => l.id === pubLead.id));
    });

    test('Vendedor creates custom QR for own Embajador; Admin creates custom QR; pause/reactivate works for Vendedor; permanent DELETE is Admin-only + Master Key', async () => {
      // Vendedor A creates custom QR for own Embajador
      const vendQrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Evento Sábado María',
          targetUrl: 'https://royal.ciprian.example/?ref=FAKE',
          referrerId: embVendedorAWithEmoji.id,
          styleId: 'obsidian-dots',
          dotShape: 'dots',
        }),
      });
      assert.strictEqual(vendQrRes.status, 201);
      const vendQr = (await vendQrRes.json()).qr;
      assert.strictEqual(vendQr.referrerId, embVendedorAWithEmoji.id);
      assert.strictEqual(vendQr.referralCode, embVendedorAWithEmoji.code);
      assert.strictEqual(
        vendQr.targetUrl,
        `https://royal.ciprian.example/?ref=${embVendedorAWithEmoji.code}`
      );

      // Admin creates custom QR for Embajador
      const adminQrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Admin Lucía',
          targetUrl: 'https://royal.ciprian.example/',
          referrerId: embAdminWithAvatar.id,
          styleId: 'ruby-atelier',
        }),
      });
      assert.strictEqual(adminQrRes.status, 201);
      const adminQr = (await adminQrRes.json()).qr;
      assert.strictEqual(adminQr.referrerId, embAdminWithAvatar.id);
      assert.strictEqual(adminQr.referralCode, 'EMB-LUCIA');

      // Vendedor A pauses & reactivates own Embajador without master password
      const pauseRes = await fetch(`${baseUrl}/api/embajadores/${embVendedorAWithEmoji.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: false }),
      });
      assert.strictEqual(pauseRes.status, 200);
      assert.strictEqual((await pauseRes.json()).referrer.active, false);

      // Paused Embajador cannot receive new QR
      const pausedQrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Pausado',
          targetUrl: 'https://royal.ciprian.example/',
          referrerId: embVendedorAWithEmoji.id,
        }),
      });
      assert.strictEqual(pausedQrRes.status, 400);

      // Reactivate Embajador
      const reactivateRes = await fetch(`${baseUrl}/api/embajadores/${embVendedorAWithEmoji.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: true }),
      });
      assert.strictEqual(reactivateRes.status, 200);
      assert.strictEqual((await reactivateRes.json()).referrer.active, true);

      // Permanent DELETE rejected for Vendedor (403)
      const vendDelete = await fetch(`${baseUrl}/api/embajadores/${embVendedorAWithEmoji.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ masterPassword: MASTER_KEY }),
      });
      assert.strictEqual(vendDelete.status, 403);

      // Permanent DELETE rejected for Admin without valid own admin password (401) or with Master Key (401)
      const adminDeleteBadKey = await fetch(`${baseUrl}/api/embajadores/${embAdminDirect.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: 'WrongPassword!' }),
      });
      assert.strictEqual(adminDeleteBadKey.status, 401);

      const adminDeleteMasterRejected = await fetch(`${baseUrl}/api/embajadores/${embAdminDirect.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ masterPassword: MASTER_KEY }),
      });
      assert.strictEqual(adminDeleteMasterRejected.status, 401);

      // Permanent DELETE succeeds for Admin with own admin password (200)
      const adminDeleteOk = await fetch(`${baseUrl}/api/embajadores/${embAdminDirect.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(adminDeleteOk.status, 200);
      const afterDelState = (await adminDeleteOk.json()).state;
      assert.strictEqual(
        afterDelState.referrers.some((r) => r.id === embAdminDirect.id),
        false
      );

      // Verify embajador_deleted logged in activity
      const { logs } = await (
        await fetch(`${baseUrl}/api/activity`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.ok(logs.some((l) => l.action === 'embajador_deleted' && l.targetId === embAdminDirect.id));
    });
  });

  describe('3. Vendedor Manual Lead Creation (Direct & Embajador Attribution + Duplicate/Foreign Checks)', () => {
    let embForManual;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Sofía Manual Emb',
          emoji: '💎',
          code: 'EMB-MANUAL',
        }),
      });
      assert.strictEqual(res.status, 201);
      embForManual = (await res.json()).referrer;
    });

    test('Vendedor creates manual lead on direct channel AND attributed to own Embajador; rejects foreign (403) and duplicate phone (409)', async () => {
      // 1. Direct channel manual lead (omitting referralCode defaults to vendedor's own tag)
      const directRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Prospecto Directo Vendedor',
          phone: '555-720-3001',
          address: 'Austin, TX',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(directRes.status, 201);
      const directLead = (await directRes.json()).lead;
      assert.strictEqual(directLead.referralCode, 'ALPHA-01');
      assert.strictEqual(directLead.called, true);
      assert.strictEqual(directLead.callOutcome, 'scheduled');

      // 2. Manual lead attributed to Vendedor A's Embajador
      const embLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Prospecto Embajador Manual',
          phone: '555-720-3002',
          address: 'San Antonio, TX',
          acceptedTerms: true,
          referrerId: embForManual.id,
          referralCode: embForManual.code,
        }),
      });
      assert.strictEqual(embLeadRes.status, 201);
      const embLead = (await embLeadRes.json()).lead;
      assert.strictEqual(embLead.referrerId, embForManual.id);
      assert.strictEqual(embLead.referralCode, 'EMB-MANUAL');
      assert.strictEqual(embLead.called, true);
      assert.strictEqual(embLead.callOutcome, 'scheduled');

      // 3. Duplicate phone returns 409 DUPLICATE_PHONE
      const dupRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Duplicado Manual',
          phone: '(555) 720-3002',
          address: 'Dallas, TX',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(dupRes.status, 409);
      assert.strictEqual((await dupRes.json()).code, 'DUPLICATE_PHONE');

      // 4. Vendedor A trying to attribute manual lead to Vendedor B's tag -> 403 + alert
      const foreignTagRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Prospecto Ajeno',
          phone: '555-720-3003',
          address: 'Dallas, TX',
          acceptedTerms: true,
          referralCode: 'BETA-02',
        }),
      });
      assert.strictEqual(foreignTagRes.status, 403);

      // 5. Vendedor B trying to attribute manual lead to Vendedor A's Embajador -> 403
      const foreignEmbRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedorBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Prospecto Embajador Ajeno',
          phone: '555-720-3004',
          address: 'Dallas, TX',
          acceptedTerms: true,
          referrerId: embForManual.id,
          referralCode: embForManual.code,
        }),
      });
      assert.strictEqual(foreignEmbRes.status, 403);

      // 6. Telemarketing is denied manual lead creation -> 403
      const teleLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Tele Manual Prohibido',
          phone: '555-720-3005',
          address: 'Dallas, TX',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(teleLeadRes.status, 403);

      // 7. Activity logs recorded lead_created_manual for both Vendedor manual leads
      const { logs } = await (
        await fetch(`${baseUrl}/api/activity`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.ok(
        logs.some(
          (l) =>
            l.action === 'lead_created_manual' &&
            l.targetId === directLead.id &&
            l.actorRole === 'vendedor'
        ),
        'Expected lead_created_manual log for direct manual lead'
      );
      assert.ok(
        logs.some(
          (l) =>
            l.action === 'lead_created_manual' &&
            l.targetId === embLead.id &&
            l.actorRole === 'vendedor'
        ),
        'Expected lead_created_manual log for embajador manual lead'
      );
    });
  });

  describe('4. Telemarketing-First Gate for Vendedor 3-State Progression & Admin-Password Downgrades', () => {
    test('Vendedor is blocked (409) on pending lead until Telemarketing marks scheduled, then advances none -> cita -> demo -> orden without password; downgrades require valid Admin password; Reposo stays locked', async () => {
      // Create a fresh PUBLIC pending lead (NOT touched by Telemarketing)
      const pubRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prospecto Pendiente Opcion A',
          phone: '555-730-4001',
          address: 'Miami, FL',
          acceptedTerms: true,
          referralCode: 'ALPHA-01',
        }),
      });
      assert.strictEqual(pubRes.status, 201);
      const pendingLead = (await pubRes.json()).lead;
      assert.strictEqual(pendingLead.callOutcome, 'pending');
      assert.strictEqual(pendingLead.called, false);

      // 0. Vendedor attempting to classify a PENDING lead without Telemarketing -> 409
      const blockedPending = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', notes: 'Intento sin Telemarketing' }),
      });
      assert.strictEqual(blockedPending.status, 409);
      const blockedBody = await blockedPending.json();
      assert.match(String(blockedBody.error || ''), /Pendiente de Telemarketing/i);

      // 0b. Telemarketing marks callOutcome: 'scheduled'
      const teleSchedule = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'scheduled' }),
      });
      assert.strictEqual(teleSchedule.status, 200);
      assert.strictEqual((await teleSchedule.json()).lead.callOutcome, 'scheduled');

      // 1. Now Vendedor advances none -> cita freely without password
      const toCita = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', notes: 'Vendedor agendó tras Telemarketing' }),
      });
      assert.strictEqual(toCita.status, 200);
      const citaLead = (await toCita.json()).lead;
      assert.strictEqual(citaLead.category, 'cita');
      assert.strictEqual(citaLead.called, true);
      assert.strictEqual(citaLead.callOutcome, 'scheduled');
      assert.ok(citaLead.calledAt);
      assert.ok(citaLead.scheduledAt);

      // 2. cita -> demo without password
      const toDemo = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo' }),
      });
      assert.strictEqual(toDemo.status, 200);
      assert.strictEqual((await toDemo.json()).lead.category, 'demo');

      // 3. Backward downgrade demo -> cita WITHOUT adminPassword -> 403 ADMIN_PASSWORD_REQUIRED
      const downNoPwd = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita' }),
      });
      assert.strictEqual(downNoPwd.status, 403);
      assert.strictEqual((await downNoPwd.json()).code, 'ADMIN_PASSWORD_REQUIRED');

      // 4. Backward downgrade demo -> cita WITH wrong adminPassword -> 403 ADMIN_PASSWORD_REQUIRED
      const downWrongPwd = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', adminPassword: 'WrongAdminPassword!' }),
      });
      assert.strictEqual(downWrongPwd.status, 403);
      assert.strictEqual((await downWrongPwd.json()).code, 'ADMIN_PASSWORD_REQUIRED');

      // 5. Backward downgrade demo -> cita WITH valid Admin password -> 200
      const downOk = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(downOk.status, 200);
      assert.strictEqual((await downOk.json()).lead.category, 'cita');

      // 6. Advance cita -> orden without password
      const toOrden = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 4100 }),
      });
      assert.strictEqual(toOrden.status, 200);
      const ordenLead = (await toOrden.json()).lead;
      assert.strictEqual(ordenLead.category, 'orden');
      assert.strictEqual(ordenLead.orderAmount, 4100);

      // 7. Downgrade orden -> demo WITH valid Admin password -> 200 (clears orderAmount)
      const ordenToDemo = await fetch(`${baseUrl}/api/leads/${pendingLead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo', adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(ordenToDemo.status, 200);
      const revertedToDemo = (await ordenToDemo.json()).lead;
      assert.strictEqual(revertedToDemo.category, 'demo');
      assert.strictEqual(revertedToDemo.orderAmount, null);

      // 8. Reposo (not_scheduled) lead remains locked for Vendedor (409)
      const reposoPub = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prospecto Reposo Opcion A',
          phone: '555-730-4002',
          address: 'Miami, FL',
          acceptedTerms: true,
          referralCode: 'ALPHA-01',
        }),
      });
      assert.strictEqual(reposoPub.status, 201);
      const reposoLeadId = (await reposoPub.json()).lead.id;

      const markReposo = await fetch(`${baseUrl}/api/leads/${reposoLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'not_scheduled' }),
      });
      assert.strictEqual(markReposo.status, 200);

      const vendOnReposo = await fetch(`${baseUrl}/api/leads/${reposoLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita' }),
      });
      assert.strictEqual(vendOnReposo.status, 409);

      // 9. Verify EVERY forward and revert transition is logged in GET /api/activity
      const { logs } = await (
        await fetch(`${baseUrl}/api/activity`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      const leadLogs = logs.filter((l) => l.targetId === pendingLead.id);
      assert.ok(
        leadLogs.some(
          (l) =>
            l.action === 'lead_status_advanced' &&
            l.fromState === 'Sin clasificar' &&
            l.toState === 'Cita'
        ),
        'Expected none -> cita log'
      );
      assert.ok(
        leadLogs.some(
          (l) => l.action === 'lead_status_advanced' && l.fromState === 'Cita' && l.toState === 'Demo'
        ),
        'Expected cita -> demo log'
      );
      assert.ok(
        leadLogs.some(
          (l) =>
            l.action === 'lead_status_reverted' &&
            l.fromState === 'Demo' &&
            l.toState === 'Cita' &&
            l.metadata?.authorizedByAdminPassword === true
        ),
        'Expected demo -> cita authorized revert log'
      );
      assert.ok(
        leadLogs.some(
          (l) =>
            l.action === 'lead_status_advanced' &&
            l.fromState === 'Cita' &&
            l.toState === 'Orden'
        ),
        'Expected cita -> orden log'
      );
      assert.ok(
        leadLogs.some(
          (l) =>
            l.action === 'lead_status_reverted' &&
            l.fromState === 'Orden' &&
            l.toState === 'Demo' &&
            l.metadata?.authorizedByAdminPassword === true
        ),
        'Expected orden -> demo authorized revert log'
      );
    });
  });
});
