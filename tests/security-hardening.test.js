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
  `royal-sec-hardening-store-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-sec-hardening-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const MASTER_KEY = 'PoloNorte121966@';
const ADMIN_DEFAULT_PASSWORD = 'AdminMaster2026@';

const { default: app, resetFraudTrackers } = await import('../server/index.js');

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

describe('Zero-Trust Security Hardening, HTTP Headers, DevTools Tamper Telemetry & Admin Provisioning', () => {
  let server;
  let baseUrl;
  let adminToken;
  let teleToken;
  let seller1Token;
  let seller2Token;

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

    for (const acc of [
      {
        username: 'vend_hardening_1',
        displayName: 'Vendedor Uno Hardening',
        tag: 'VEND-HARD-1',
        password: 'SellerOne2026!',
      },
      {
        username: 'vend_hardening_2',
        displayName: 'Vendedor Dos Hardening',
        tag: 'VEND-HARD-2',
        password: 'SellerTwo2026!',
      },
    ]) {
      const res = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          username: acc.username,
          displayName: acc.displayName,
          role: 'vendedor',
          tag: acc.tag,
          password: acc.password,
          confirmPassword: acc.password,
        }),
      });
      assert.strictEqual(res.status, 201);
    }

    seller1Token = await loginDirect(baseUrl, 'vend_hardening_1', 'SellerOne2026!');
    seller2Token = await loginDirect(baseUrl, 'vend_hardening_2', 'SellerTwo2026!');
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

  describe('1. Defensive HTTP Security Headers (Express & vercel.json)', () => {
    test('Express responses omit x-powered-by and enforce strict security & CSP headers', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-powered-by'), null);
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('referrer-policy'), 'no-referrer');
      assert.strictEqual(
        res.headers.get('permissions-policy'),
        'camera=(), microphone=(), geolocation=(), payment=()'
      );
      assert.strictEqual(res.headers.get('cross-origin-opener-policy'), 'same-origin');
      assert.strictEqual(res.headers.get('x-permitted-cross-domain-policies'), 'none');

      const csp = res.headers.get('content-security-policy') || '';
      assert.match(csp, /object-src 'none'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.match(csp, /base-uri 'self'/);
      assert.match(csp, /https:\/\/fonts\.googleapis\.com/);
      assert.match(csp, /https:\/\/fonts\.gstatic\.com/);
      assert.match(csp, /img-src [^;]*data:/);
      assert.match(csp, /img-src [^;]*blob:/);
      assert.match(csp, /img-src [^;]*https:/);
    });

    test('vercel.json mirrors required HTTP security headers', () => {
      const vercelCfg = JSON.parse(
        fs.readFileSync(path.join(PROJECT_ROOT, 'vercel.json'), 'utf8')
      );
      assert.ok(Array.isArray(vercelCfg.headers) && vercelCfg.headers.length > 0);
      const headerMap = new Map(
        vercelCfg.headers[0].headers.map((h) => [String(h.key).toLowerCase(), h.value])
      );
      assert.strictEqual(headerMap.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(headerMap.get('x-frame-options'), 'DENY');
      assert.strictEqual(headerMap.get('referrer-policy'), 'no-referrer');
      assert.strictEqual(
        headerMap.get('permissions-policy'),
        'camera=(), microphone=(), geolocation=(), payment=()'
      );
    });
  });

  describe('2. Zero-Trust Public & Role-Based Raw-Fetch Tampering Defense', () => {
    let leadSeller1Id;
    let leadSeller2Id;

    test('Public POST /api/leads rejects forged admin/workflow fields with 403 and logs alert; legitimate submission defaults cleanly', async () => {
      const forgedCreate = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-ip': '198.51.100.41' },
        body: JSON.stringify({
          name: 'Atacante Publico',
          phone: '555-801-1001',
          address: 'Dallas, TX',
          acceptedTerms: true,
          called: true,
          callOutcome: 'scheduled',
          category: 'orden',
          orderAmount: 9999,
          promoCodeInvalidated: true,
          sellerLocked: true,
          referrerId: 'ref-forged',
        }),
      });
      assert.strictEqual(forgedCreate.status, 403);

      // Legitimate leads for vendedor 1 & vendedor 2
      const ok1 = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead Legitimo Uno',
          phone: '555-801-2001',
          address: 'Dallas, TX',
          acceptedTerms: true,
          referralCode: 'VEND-HARD-1',
        }),
      });
      assert.strictEqual(ok1.status, 201);
      const lead1 = (await ok1.json()).lead;
      assert.strictEqual(lead1.called, false);
      assert.strictEqual(lead1.callOutcome, 'pending');
      assert.strictEqual(lead1.category, 'none');
      assert.strictEqual(lead1.orderAmount, null);
      assert.strictEqual(lead1.promoCodeInvalidated, false);
      assert.strictEqual(lead1.sellerLocked, false);
      leadSeller1Id = lead1.id;

      const ok2 = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead Legitimo Dos',
          phone: '555-801-2002',
          address: 'Austin, TX',
          acceptedTerms: true,
          referralCode: 'VEND-HARD-2',
        }),
      });
      assert.strictEqual(ok2.status, 201);
      leadSeller2Id = (await ok2.json()).lead.id;

      // Public PATCH attempting to forge referrerId or referralCode -> 401
      const forgedPublicPatch = await fetch(`${baseUrl}/api/leads/${leadSeller1Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId: 'ref-hijack', referralCode: 'VEND-HARD-2' }),
      });
      assert.strictEqual(forgedPublicPatch.status, 401);
    });

    test('Vendedor raw-fetch tampering (forbidden fields or cross-seller lead) returns 403 + logs rbac_unauthorized_attempt', async () => {
      // Vendedor attempting to set sellerLocked: false and callOutcome: 'scheduled' on own lead -> 403
      const tamperWorkflow = await fetch(`${baseUrl}/api/leads/${leadSeller1Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${seller1Token}`,
          'Content-Type': 'application/json',
          'x-test-ip': '198.51.100.51',
        },
        body: JSON.stringify({ sellerLocked: false, callOutcome: 'scheduled' }),
      });
      assert.strictEqual(tamperWorkflow.status, 403);

      // Vendedor attempting to alter PII / referral / gift / promoCodeInvalidated -> 403
      const tamperPii = await fetch(`${baseUrl}/api/leads/${leadSeller1Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${seller1Token}`,
          'Content-Type': 'application/json',
          'x-test-ip': '198.51.100.52',
        },
        body: JSON.stringify({
          name: 'Nombre Alterado',
          phone: '555-999-0000',
          address: 'Fake City',
          promoCodeInvalidated: false,
          referrerId: 'ref-fake',
          referralCode: 'OTHER',
          giftId: 'gift-warmer-pro',
          claimCode: 'OTN-0000',
        }),
      });
      assert.strictEqual(tamperPii.status, 403);

      // Vendedor 1 attempting to touch Vendedor 2's lead -> 403
      const crossSeller = await fetch(`${baseUrl}/api/leads/${leadSeller2Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${seller1Token}`,
          'Content-Type': 'application/json',
          'x-test-ip': '198.51.100.53',
        },
        body: JSON.stringify({ category: 'cita', confirmLock: true }),
      });
      assert.strictEqual(crossSeller.status, 403);

      const { alerts } = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();

      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.actorRole === 'vendedor' &&
            a.metadata?.reason === 'vendedor_forbidden_fields' &&
            String(a.metadata?.forbiddenFields || '').includes('sellerLocked')
        ),
        'Expected rbac_unauthorized_attempt alert for vendedor sellerLocked/callOutcome tampering'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.actorRole === 'vendedor' &&
            a.metadata?.reason === 'vendedor_cross_seller_access'
        ),
        'Expected rbac_unauthorized_attempt alert for vendedor cross-seller access'
      );
    });

    test('Telemarketing raw-fetch tampering (category/orderAmount/sellerLocked/adminPassword) returns 403 + logs rbac_unauthorized_attempt', async () => {
      const tamperOrder = await fetch(`${baseUrl}/api/leads/${leadSeller1Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
          'x-test-ip': '198.51.100.61',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 5000 }),
      });
      assert.strictEqual(tamperOrder.status, 403);

      const tamperAdminFields = await fetch(`${baseUrl}/api/leads/${leadSeller1Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
          'x-test-ip': '198.51.100.62',
        },
        body: JSON.stringify({
          callOutcome: 'scheduled',
          sellerLocked: false,
          promoCodeInvalidated: false,
          adminPassword: 'forged',
        }),
      });
      assert.strictEqual(tamperAdminFields.status, 403);

      // Telemarketing GET /api/referrals returns minimal sanitized referrer list (no phone/notes)
      const teleRefsRes = await fetch(`${baseUrl}/api/referrals`, {
        headers: { Authorization: `Bearer ${teleToken}` },
      });
      assert.strictEqual(teleRefsRes.status, 200);
      const teleRefs = (await teleRefsRes.json()).referrers;
      assert.ok(Array.isArray(teleRefs) && teleRefs.length >= 2);
      assert.strictEqual(teleRefs[0].phone, undefined);
      assert.strictEqual(teleRefs[0].notes, undefined);

      const { alerts } = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.actorRole === 'telemarketing' &&
            a.metadata?.reason === 'telemarketing_forbidden_fields' &&
            String(a.metadata?.forbiddenFields || '').includes('orderAmount')
        ),
        'Expected rbac_unauthorized_attempt alert for telemarketing category/orderAmount tampering'
      );
    });
  });

  describe('3. Client-Side DevTools Tamper Telemetry Endpoint (POST /api/security/client-tamper)', () => {
    test('Requires auth, logs devtools_tamper_attempt visible ONLY to Admin, and enforces rate limit', async () => {
      // Unauthenticated -> 401
      const unauth = await fetch(`${baseUrl}/api/security/client-tamper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'devtools_open', detail: 'Anon test' }),
      });
      assert.strictEqual(unauth.status, 401);

      // Authenticated non-admin (vendedor) -> 200 + creates devtools_tamper_attempt alert
      const tamperRes = await fetch(`${baseUrl}/api/security/client-tamper`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${seller1Token}`,
          'Content-Type': 'application/json',
          'x-test-ip': '203.0.113.44',
        },
        body: JSON.stringify({
          reason: 'session_storage_tamper',
          detail: 'Intento de cambio de rol en sessionStorage a admin',
        }),
      });
      assert.strictEqual(tamperRes.status, 200);
      const tamperBody = await tamperRes.json();
      assert.strictEqual(tamperBody.ok, true);
      assert.strictEqual(tamperBody.recorded, true);
      assert.strictEqual(tamperBody.alerts, undefined);

      // Non-admin CANNOT read alerts via GET /api/security/alerts or GET /api/state
      const sellerAlertsRes = await fetch(`${baseUrl}/api/security/alerts`, {
        headers: { Authorization: `Bearer ${seller1Token}` },
      });
      assert.strictEqual(sellerAlertsRes.status, 403);

      const sellerState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${seller1Token}` },
        })
      ).json();
      assert.strictEqual(sellerState.securityAlerts, undefined);

      // Admin sees the devtools_tamper_attempt alert with actor metadata and masked IP
      const adminAlerts = (
        await (
          await fetch(`${baseUrl}/api/security/alerts`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
        ).json()
      ).alerts;
      const alert = adminAlerts.find(
        (a) =>
          a.code === 'devtools_tamper_attempt' &&
          a.severity === 'high' &&
          a.category === 'access' &&
          a.actorRole === 'vendedor' &&
          a.actorName === 'Vendedor Uno Hardening' &&
          a.actorTag === 'VEND-HARD-1' &&
          a.ipMasked === '203.0.***.44' &&
          a.metadata?.reason === 'session_storage_tamper'
      );
      assert.ok(alert, 'Expected devtools_tamper_attempt alert visible to Admin');

      // Rate-limit check on telemarketing user (10 allowed in 60s, 11th -> 429)
      for (let i = 0; i < 10; i += 1) {
        const ok = await fetch(`${baseUrl}/api/security/client-tamper`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${teleToken}`,
            'Content-Type': 'application/json',
            'x-test-ip': '203.0.113.45',
          },
          body: JSON.stringify({ reason: 'devtools_shortcut', detail: `F12 #${i + 1}` }),
        });
        assert.strictEqual(ok.status, 200);
      }
      const rateLimited = await fetch(`${baseUrl}/api/security/client-tamper`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
          'x-test-ip': '203.0.113.45',
        },
        body: JSON.stringify({ reason: 'devtools_shortcut', detail: 'F12 #11' }),
      });
      assert.strictEqual(rateLimited.status, 429);
    });
  });

  describe('4. Admin Account Provisioning via POST /api/accounts (Own Admin Password + 2FA PIN)', () => {
    test('Creating role=admin enforces logged-in Admin own password (rejects Master Key) + 4-8 digit PIN and supports full 2FA login', async () => {
      // Master Key rejected on regular operational account creation -> 401
      const masterRejected = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          username: 'AdminNuevoTest',
          displayName: 'Admin Nuevo Test',
          role: 'admin',
          tag: 'ADMIN-TEST',
          password: 'StrongAdminPass2026!',
          confirmPassword: 'StrongAdminPass2026!',
          pin: '2468',
        }),
      });
      assert.strictEqual(masterRejected.status, 401);

      // Own Admin password present, missing/invalid PIN -> 400
      const badPin = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          username: 'AdminNuevoTest',
          displayName: 'Admin Nuevo Test',
          role: 'admin',
          tag: 'ADMIN-TEST',
          password: 'StrongAdminPass2026!',
          confirmPassword: 'StrongAdminPass2026!',
          pin: '12',
        }),
      });
      assert.strictEqual(badPin.status, 400);

      // Valid own Admin password + 4-digit PIN -> 201
      const createdRes = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          username: 'AdminNuevoTest',
          displayName: 'Admin Nuevo Test',
          role: 'admin',
          tag: 'ADMIN-TEST',
          password: 'StrongAdminPass2026!',
          confirmPassword: 'StrongAdminPass2026!',
          pin: '2468',
        }),
      });
      assert.strictEqual(createdRes.status, 201);
      const created = await createdRes.json();
      assert.strictEqual(created.account.role, 'admin');
      assert.strictEqual(created.account.hasPin, true);
      assert.strictEqual(created.account.tag, 'ADMIN-TEST');

      // Full 2FA login succeeds for the newly created Admin
      const newAdminToken = await loginAdmin(baseUrl, 'AdminNuevoTest', 'StrongAdminPass2026!', '2468');
      assert.strictEqual(typeof newAdminToken, 'string');
      const sessRes = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${newAdminToken}` },
      });
      assert.strictEqual(sessRes.status, 200);
      const sess = await sessRes.json();
      assert.strictEqual(sess.role, 'admin');
      assert.strictEqual(sess.displayName, 'Admin Nuevo Test');
    });
  });
});
