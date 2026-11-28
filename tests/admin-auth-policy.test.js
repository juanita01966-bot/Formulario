import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEST_STORE_FILE = path.join(
  os.tmpdir(),
  `royal-admin-auth-policy-store-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-admin-auth-policy-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const SPECIAL_SECURITY_KEY = 'PoloNorte121966@';
const ADMIN_CHANGE_PIN = '1532';

const ADMIN_CIPRIAN_USER = 'AdminCiprian';
const ADMIN_CIPRIAN_PASS = 'AdminMaster2026@';
const ADMIN_CIPRIAN_PIN = '1966';

const KEVIN_KAREN_USER = 'KevinyKaren';
const KEVIN_KAREN_PASS = 'KevinKarenOwn2026!';
const KEVIN_KAREN_PIN = '4821';

const { default: app, resetFraudTrackers } = await import('../server/index.js');

async function loginAdmin2FA(baseUrl, username, password, pin) {
  const step1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(step1.status, 200, `Expected 200 on step1 login for ${username}`);
  const d1 = await step1.json();
  assert.strictEqual(d1.requiresPin, true);

  const step2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken: d1.preAuthToken, pin }),
  });
  assert.strictEqual(step2.status, 200, `Expected 200 on step2 PIN verify for ${username}`);
  return step2.json();
}

async function loginDirect1FA(baseUrl, username, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(res.status, 200, `Expected 200 on 1FA login for ${username}`);
  return res.json();
}

function assertUnauthorized(status, label) {
  assert.ok(
    status === 401 || status === 403,
    `Expected 401 or 403 for ${label}, got ${status}`
  );
}

describe('Unified Admin Password Policy & Strict Self-Only Admin Isolation Suite', () => {
  let server;
  let baseUrl;

  let ciprianToken;
  let ciprianId;
  let kevinToken;
  let kevinId;

  let vendedorAccount;
  let vendedorToken;

  before(async () => {
    resetFraudTrackers();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 1. Log in as seeded AdminCiprian
    const ciprianLogin = await loginAdmin2FA(
      baseUrl,
      ADMIN_CIPRIAN_USER,
      ADMIN_CIPRIAN_PASS,
      ADMIN_CIPRIAN_PIN
    );
    ciprianToken = ciprianLogin.sessionToken;
    ciprianId = ciprianLogin.userId;

    // 2. Provision second active Admin account (KevinyKaren) using AdminCiprian's OWN login password
    const createKevin = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ciprianToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminPassword: ADMIN_CIPRIAN_PASS,
        username: KEVIN_KAREN_USER,
        displayName: 'Kevin y Karen',
        role: 'admin',
        tag: 'KEVIN-KAREN',
        password: KEVIN_KAREN_PASS,
        confirmPassword: KEVIN_KAREN_PASS,
        pin: KEVIN_KAREN_PIN,
      }),
    });
    assert.strictEqual(createKevin.status, 201);
    const kevinCreated = await createKevin.json();
    kevinId = kevinCreated.account.id;

    // Log in as KevinyKaren (2FA)
    const kevinLogin = await loginAdmin2FA(
      baseUrl,
      KEVIN_KAREN_USER,
      KEVIN_KAREN_PASS,
      KEVIN_KAREN_PIN
    );
    kevinToken = kevinLogin.sessionToken;
    assert.strictEqual(kevinLogin.userId, kevinId);

    // 3. Provision a Vendedor account
    const createVend = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ciprianToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminPassword: ADMIN_CIPRIAN_PASS,
        username: 'vend_policy_01',
        displayName: 'Vendedor Política Uno',
        role: 'vendedor',
        tag: 'VEND-POL-01',
        password: 'VendPolicyPass1!',
        confirmPassword: 'VendPolicyPass1!',
      }),
    });
    assert.strictEqual(createVend.status, 201);
    vendedorAccount = (await createVend.json()).account;

    const vendLogin = await loginDirect1FA(baseUrl, 'vend_policy_01', 'VendPolicyPass1!');
    vendedorToken = vendLogin.sessionToken;
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

  describe('1. Strict Self-Only Admin Visibility (GET /api/state & GET /api/accounts)', () => {
    test('AdminCiprian sees self + Vendedores + Telemarketing and ZERO rows for KevinyKaren', async () => {
      const [stateRes, accRes] = await Promise.all([
        fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${ciprianToken}` },
        }),
        fetch(`${baseUrl}/api/accounts`, {
          headers: { Authorization: `Bearer ${ciprianToken}` },
        }),
      ]);
      assert.strictEqual(stateRes.status, 200);
      assert.strictEqual(accRes.status, 200);

      const stateBody = await stateRes.json();
      const accBody = await accRes.json();

      for (const [label, list] of [
        ['GET /api/state', stateBody.accounts],
        ['GET /api/accounts', accBody.accounts],
      ]) {
        assert.ok(Array.isArray(list), `${label} must include accounts array`);
        const adminRows = list.filter((a) => a.role === 'admin');
        assert.strictEqual(adminRows.length, 1, `${label} must return exactly 1 admin row for AdminCiprian`);
        assert.strictEqual(adminRows[0].id, ciprianId);
        assert.strictEqual(adminRows[0].username, ADMIN_CIPRIAN_USER);
        assert.strictEqual(
          list.some((a) => a.id === kevinId || a.username === KEVIN_KAREN_USER),
          false,
          `${label} must return ZERO rows for KevinyKaren`
        );
        assert.ok(
          list.some((a) => a.role === 'vendedor' && a.id === vendedorAccount.id),
          `${label} must include Vendedores`
        );
        assert.ok(
          list.some((a) => a.role === 'telemarketing'),
          `${label} must include Telemarketing`
        );
      }
    });

    test('KevinyKaren sees self + Vendedores + Telemarketing and ZERO rows for AdminCiprian', async () => {
      const [stateRes, accRes] = await Promise.all([
        fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${kevinToken}` },
        }),
        fetch(`${baseUrl}/api/accounts`, {
          headers: { Authorization: `Bearer ${kevinToken}` },
        }),
      ]);
      assert.strictEqual(stateRes.status, 200);
      assert.strictEqual(accRes.status, 200);

      const stateBody = await stateRes.json();
      const accBody = await accRes.json();

      for (const [label, list] of [
        ['GET /api/state', stateBody.accounts],
        ['GET /api/accounts', accBody.accounts],
      ]) {
        assert.ok(Array.isArray(list), `${label} must include accounts array`);
        const adminRows = list.filter((a) => a.role === 'admin');
        assert.strictEqual(adminRows.length, 1, `${label} must return exactly 1 admin row for KevinyKaren`);
        assert.strictEqual(adminRows[0].id, kevinId);
        assert.strictEqual(adminRows[0].username, KEVIN_KAREN_USER);
        assert.strictEqual(
          list.some((a) => a.id === ciprianId || a.username === ADMIN_CIPRIAN_USER),
          false,
          `${label} must return ZERO rows for AdminCiprian`
        );
        assert.ok(
          list.some((a) => a.role === 'vendedor' && a.id === vendedorAccount.id),
          `${label} must include Vendedores`
        );
        assert.ok(
          list.some((a) => a.role === 'telemarketing'),
          `${label} must include Telemarketing`
        );
      }
    });
  });

  describe('2. Unified Own-Password Rule on ALL Operational Admin Mutations (Both Admins)', () => {
    async function runOperationalSuiteForAdmin({
      actorLabel,
      token,
      ownPassword,
      otherAdminPassword,
      suffix,
    }) {
      const authHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // A) PATCH /api/settings
      const setMaster = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ advisorName: `Bad ${suffix}`, masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(setMaster.status, `${actorLabel} PATCH /api/settings with SPECIAL_SECURITY_KEY`);

      const setOther = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ advisorName: `Bad ${suffix}`, adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(setOther.status, `${actorLabel} PATCH /api/settings with other admin password`);

      const setOk = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ advisorName: `Advisor ${suffix}`, adminPassword: ownPassword }),
      });
      assert.strictEqual(setOk.status, 200, `${actorLabel} PATCH /api/settings with own password`);

      // B) POST /api/gifts, PATCH /api/gifts/:id, DELETE /api/gifts/:id
      const giftMaster = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: `Gift Bad ${suffix}`, probability: 10, masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(giftMaster.status, `${actorLabel} POST /api/gifts with SPECIAL_SECURITY_KEY`);

      const giftOther = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: `Gift Bad ${suffix}`, probability: 10, adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(giftOther.status, `${actorLabel} POST /api/gifts with other admin password`);

      const giftOk = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: `Gift OK ${suffix}`, probability: 15, adminPassword: ownPassword }),
      });
      assert.strictEqual(giftOk.status, 201, `${actorLabel} POST /api/gifts with own password`);
      const giftId = (await giftOk.json()).gift.id;

      const patchGiftMaster = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ name: `Gift Edit ${suffix}`, masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(patchGiftMaster.status, `${actorLabel} PATCH /api/gifts/:id with SPECIAL_SECURITY_KEY`);

      const patchGiftOther = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ name: `Gift Edit ${suffix}`, adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(patchGiftOther.status, `${actorLabel} PATCH /api/gifts/:id with other admin password`);

      const patchGiftOk = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ name: `Gift Edited ${suffix}`, adminPassword: ownPassword }),
      });
      assert.strictEqual(patchGiftOk.status, 200, `${actorLabel} PATCH /api/gifts/:id with own password`);

      const delGiftMaster = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(delGiftMaster.status, `${actorLabel} DELETE /api/gifts/:id with SPECIAL_SECURITY_KEY`);

      const delGiftOther = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(delGiftOther.status, `${actorLabel} DELETE /api/gifts/:id with other admin password`);

      const delGiftOk = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: ownPassword }),
      });
      assert.strictEqual(delGiftOk.status, 200, `${actorLabel} DELETE /api/gifts/:id with own password`);

      // C) POST /api/accounts, PATCH /api/accounts/:id, DELETE /api/accounts/:id
      const accPayloadBase = {
        username: `temp_vend_${suffix}`,
        displayName: `Temp Vendedor ${suffix}`,
        role: 'vendedor',
        tag: `TMP-${suffix.toUpperCase()}`,
        password: 'TempUserPass1!',
        confirmPassword: 'TempUserPass1!',
      };
      const accMaster = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...accPayloadBase, masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(accMaster.status, `${actorLabel} POST /api/accounts with SPECIAL_SECURITY_KEY`);

      const accOther = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...accPayloadBase, adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(accOther.status, `${actorLabel} POST /api/accounts with other admin password`);

      const accOk = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...accPayloadBase, adminPassword: ownPassword }),
      });
      assert.strictEqual(accOk.status, 201, `${actorLabel} POST /api/accounts with own password`);
      const tempAccId = (await accOk.json()).account.id;

      const patchAccMaster = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ displayName: `Edited ${suffix}`, masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(patchAccMaster.status, `${actorLabel} PATCH /api/accounts/:id with SPECIAL_SECURITY_KEY`);

      const patchAccOther = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ displayName: `Edited ${suffix}`, adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(patchAccOther.status, `${actorLabel} PATCH /api/accounts/:id with other admin password`);

      const patchAccOk = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ displayName: `Edited OK ${suffix}`, adminPassword: ownPassword }),
      });
      assert.strictEqual(patchAccOk.status, 200, `${actorLabel} PATCH /api/accounts/:id with own password`);

      const delAccMaster = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(delAccMaster.status, `${actorLabel} DELETE /api/accounts/:id with SPECIAL_SECURITY_KEY`);

      const delAccOther = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(delAccOther.status, `${actorLabel} DELETE /api/accounts/:id with other admin password`);

      const delAccOk = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: ownPassword }),
      });
      assert.strictEqual(delAccOk.status, 200, `${actorLabel} DELETE /api/accounts/:id with own password`);

      // D) DELETE /api/embajadores/:id
      const createEmb = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: `Embajador ${suffix}`,
          emoji: '🌟',
          code: `EMB-${suffix.toUpperCase()}`,
        }),
      });
      assert.strictEqual(createEmb.status, 201);
      const embId = (await createEmb.json()).referrer.id;

      const delEmbMaster = await fetch(`${baseUrl}/api/embajadores/${embId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ masterPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(delEmbMaster.status, `${actorLabel} DELETE /api/embajadores/:id with SPECIAL_SECURITY_KEY`);

      const delEmbOther = await fetch(`${baseUrl}/api/embajadores/${embId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(delEmbOther.status, `${actorLabel} DELETE /api/embajadores/:id with other admin password`);

      const delEmbOk = await fetch(`${baseUrl}/api/embajadores/${embId}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: ownPassword }),
      });
      assert.strictEqual(delEmbOk.status, 200, `${actorLabel} DELETE /api/embajadores/:id with own password`);

      // E) PATCH /api/leads/:id status downgrade (demo -> cita)
      const phoneDigits = suffix === 'ciprian' ? '555-710-1001' : '555-710-2002';
      const leadCreate = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: `Lead Downgrade ${suffix}`,
          phone: phoneDigits,
          address: 'Dallas, TX',
          acceptedTerms: true,
          referralCode: 'VEND-POL-01',
        }),
      });
      assert.strictEqual(leadCreate.status, 201);
      const leadId = (await leadCreate.json()).lead.id;

      // Advance none -> demo without password
      const advDemo = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ callOutcome: 'scheduled', category: 'demo' }),
      });
      assert.strictEqual(advDemo.status, 200);

      const downMaster = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ category: 'cita', adminPassword: SPECIAL_SECURITY_KEY }),
      });
      assertUnauthorized(downMaster.status, `${actorLabel} PATCH /api/leads/:id downgrade with SPECIAL_SECURITY_KEY`);

      const downOther = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ category: 'cita', adminPassword: otherAdminPassword }),
      });
      assertUnauthorized(downOther.status, `${actorLabel} PATCH /api/leads/:id downgrade with other admin password`);

      const downOk = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ category: 'cita', adminPassword: ownPassword }),
      });
      assert.strictEqual(downOk.status, 200, `${actorLabel} PATCH /api/leads/:id downgrade with own password`);
      assert.strictEqual((await downOk.json()).lead.category, 'cita');

      // F) POST /api/admin/reset-all
      const resetMaster = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ masterPassword: SPECIAL_SECURITY_KEY, resetCatalogAndSettings: false }),
      });
      assertUnauthorized(resetMaster.status, `${actorLabel} POST /api/admin/reset-all with SPECIAL_SECURITY_KEY`);

      const resetOther = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: otherAdminPassword, resetCatalogAndSettings: false }),
      });
      assertUnauthorized(resetOther.status, `${actorLabel} POST /api/admin/reset-all with other admin password`);

      const resetOk = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ adminPassword: ownPassword, resetCatalogAndSettings: false }),
      });
      assert.strictEqual(resetOk.status, 200, `${actorLabel} POST /api/admin/reset-all with own password`);
    }

    test('AdminCiprian: ALL regular operational mutations succeed ONLY with AdminCiprian own password (reject PoloNorte121966@ and KevinyKaren password)', async () => {
      await runOperationalSuiteForAdmin({
        actorLabel: 'AdminCiprian',
        token: ciprianToken,
        ownPassword: ADMIN_CIPRIAN_PASS,
        otherAdminPassword: KEVIN_KAREN_PASS,
        suffix: 'ciprian',
      });
    });

    test('KevinyKaren: ALL regular operational mutations succeed ONLY with KevinyKaren own password (reject PoloNorte121966@ and AdminCiprian password)', async () => {
      await runOperationalSuiteForAdmin({
        actorLabel: 'KevinyKaren',
        token: kevinToken,
        ownPassword: KEVIN_KAREN_PASS,
        otherAdminPassword: ADMIN_CIPRIAN_PASS,
        suffix: 'kevin',
      });
    });
  });

  describe('3. Vendedor Downgrade Rule (Any Active Admin Login Password — NEVER PoloNorte121966@)', () => {
    test('Vendedor downgrading demo -> cita succeeds with AdminCiprian OR KevinyKaren login password, and fails (403 ADMIN_PASSWORD_REQUIRED) with PoloNorte121966@', async () => {
      const createLead = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead Vendedor Downgrade',
          phone: '555-720-3003',
          address: 'Austin, TX',
          acceptedTerms: true,
          referralCode: 'VEND-POL-01',
        }),
      });
      assert.strictEqual(createLead.status, 201);
      const leadId = (await createLead.json()).lead.id;

      // Telemarketing-First Gate: Vendedor cannot classify pending lead (409)
      const advBlocked = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo' }),
      });
      assert.strictEqual(advBlocked.status, 409);

      // Admin/Telemarketing marks lead as scheduled
      const markScheduled = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ciprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'scheduled' }),
      });
      assert.strictEqual(markScheduled.status, 200);

      // Vendedor advances none -> demo without password
      const adv = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo' }),
      });
      assert.strictEqual(adv.status, 200);
      assert.strictEqual((await adv.json()).lead.category, 'demo');

      // Downgrade with PoloNorte121966@ -> 403 ADMIN_PASSWORD_REQUIRED
      const withSpecialKey = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', adminPassword: SPECIAL_SECURITY_KEY }),
      });
      assert.strictEqual(withSpecialKey.status, 403);
      assert.strictEqual((await withSpecialKey.json()).code, 'ADMIN_PASSWORD_REQUIRED');

      // Downgrade with AdminCiprian's login password -> 200
      const withCiprianPass = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', adminPassword: ADMIN_CIPRIAN_PASS }),
      });
      assert.strictEqual(withCiprianPass.status, 200);
      assert.strictEqual((await withCiprianPass.json()).lead.category, 'cita');

      // Advance back cita -> demo without password
      const reAdv = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo' }),
      });
      assert.strictEqual(reAdv.status, 200);

      // Downgrade with KevinyKaren's login password -> 200
      const withKevinPass = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', adminPassword: KEVIN_KAREN_PASS }),
      });
      assert.strictEqual(withKevinPass.status, 200);
      assert.strictEqual((await withKevinPass.json()).lead.category, 'cita');
    });
  });

  describe('4. Only Exception (PoloNorte121966@ + PIN 1532) & Strict Self-Only Cross-Admin Blocks', () => {
    test('Cross-Admin Block: AdminCiprian CANNOT change KevinyKaren password, edit, or delete KevinyKaren (403 + critical security alert)', async () => {
      // 1. Cross-admin POST /api/accounts/<kevinId>/admin-password even WITH valid PoloNorte121966@ + PIN 1532 -> 403
      const crossPwRes = await fetch(`${baseUrl}/api/accounts/${kevinId}/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ciprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: SPECIAL_SECURITY_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: 'HijackedKevinPass2029!',
          confirmNewPassword: 'HijackedKevinPass2029!',
        }),
      });
      assert.strictEqual(crossPwRes.status, 403);

      // Verify KevinyKaren's password & session were NOT modified
      const kevinSessionOk = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${kevinToken}` },
      });
      assert.strictEqual(kevinSessionOk.status, 200);

      const kevinOrigLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: KEVIN_KAREN_USER, password: KEVIN_KAREN_PASS }),
      });
      assert.strictEqual(kevinOrigLogin.status, 200);

      const kevinHijackLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: KEVIN_KAREN_USER, password: 'HijackedKevinPass2029!' }),
      });
      assert.strictEqual(kevinHijackLogin.status, 401);

      // 2. Cross-admin PATCH /api/accounts/<kevinId> -> 403
      const crossEditRes = await fetch(`${baseUrl}/api/accounts/${kevinId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ciprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_CIPRIAN_PASS,
          displayName: 'Tampered Kevin',
          active: false,
        }),
      });
      assert.strictEqual(crossEditRes.status, 403);

      // 3. Cross-admin DELETE /api/accounts/<kevinId> -> 403
      const crossDelRes = await fetch(`${baseUrl}/api/accounts/${kevinId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${ciprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_CIPRIAN_PASS }),
      });
      assert.strictEqual(crossDelRes.status, 403);

      // 4. Verify critical rbac_unauthorized_attempt alerts recorded in securityAlerts
      const alertsRes = await fetch(`${baseUrl}/api/security/alerts`, {
        headers: { Authorization: `Bearer ${ciprianToken}` },
      });
      assert.strictEqual(alertsRes.status, 200);
      const { alerts } = await alertsRes.json();

      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.severity === 'critical' &&
            (a.metadata?.reason === 'ai_manager_route_denied' ||
              a.metadata?.reason === 'cross_admin_password_attempt')
        ),
        'Expected critical rbac_unauthorized_attempt alert for admin-password attempt'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.severity === 'critical' &&
            a.metadata?.reason === 'cross_admin_edit_attempt' &&
            a.metadata?.targetAccountId === kevinId
        ),
        'Expected critical rbac_unauthorized_attempt alert for cross_admin_edit_attempt'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.severity === 'critical' &&
            a.metadata?.reason === 'cross_admin_delete_attempt' &&
            a.metadata?.targetAccountId === kevinId
        ),
        'Expected critical rbac_unauthorized_attempt alert for cross_admin_delete_attempt'
      );
    });

    test('Opción A: Regular Admin CANNOT rotate own password via /admin-password (403); AI Manager rotates Admin password without securityKey/PIN and new password works immediately', async () => {
      const kevinRotatedPass = 'KevinKarenRotated2028!';

      // Regular Admin attempting /admin-password -> strictly 403 (even with PoloNorte121966@ + PIN 1532)
      const normalPassRejected = await fetch(`${baseUrl}/api/accounts/${kevinId}/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kevinToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: SPECIAL_SECURITY_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: kevinRotatedPass,
          confirmNewPassword: kevinRotatedPass,
        }),
      });
      assert.strictEqual(normalPassRejected.status, 403);

      // AI Manager logs in via 2FA cognitive security question and rotates KevinyKaren password without securityKey/PIN -> 200
      const aiStep1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'JuanOrozco', password: SPECIAL_SECURITY_KEY }),
      });
      assert.strictEqual(aiStep1.status, 200);
      const aiD1 = await aiStep1.json();
      const aiAnswers = { 'sq-test-1': 'resp-uno', 'sq-test-2': '2099', 'sq-test-3': 'clave-tres', 'sq-test-4': 'codigo-cuatro', 'sq-test-5': 'gusto-cinco' };
      const aiStep2 = await fetch(`${baseUrl}/api/auth/verify-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: aiD1.preAuthToken, answer: aiAnswers[aiD1.securityChallenge.questionId] }),
      });
      assert.strictEqual(aiStep2.status, 200);
      const aiLogin = await aiStep2.json();
      const oldKevinToken = kevinToken;
      const rotatedRes = await fetch(`${baseUrl}/api/accounts/${kevinId}/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aiLogin.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: kevinRotatedPass,
          confirmNewPassword: kevinRotatedPass,
        }),
      });
      assert.strictEqual(rotatedRes.status, 200);
      const rotatedBody = await rotatedRes.json();
      assert.strictEqual(rotatedBody.ok, true);

      // Old token revoked; old password rejected on login
      const oldTokenCheck = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${oldKevinToken}` },
      });
      assert.strictEqual(oldTokenCheck.status, 401);

      const oldLoginCheck = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: KEVIN_KAREN_USER, password: KEVIN_KAREN_PASS }),
      });
      assert.strictEqual(oldLoginCheck.status, 401);

      // New password immediately works for full 2FA login AND subsequent operational mutations
      const freshLogin = await loginAdmin2FA(
        baseUrl,
        KEVIN_KAREN_USER,
        kevinRotatedPass,
        KEVIN_KAREN_PIN
      );
      kevinToken = freshLogin.sessionToken;

      const oldPassMutation = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${kevinToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ advisorName: 'Old Pass Fail', adminPassword: KEVIN_KAREN_PASS }),
      });
      assertUnauthorized(oldPassMutation.status, 'settings with old KevinyKaren password after rotation');

      const newPassMutation = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${kevinToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ advisorName: 'Kevin Rotated OK', adminPassword: kevinRotatedPass }),
      });
      assert.strictEqual(newPassMutation.status, 200);
    });

    test('Opción A: Regular Admin CANNOT use /api/auth/update-credentials (403); AI Manager updates AdminCiprian credentials and leaves KevinyKaren untouched', async () => {
      const ciprianRotatedPass = 'CiprianRotated2028@';

      // Regular Admin rejected with 403
      const regularAdminRejected = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ciprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: SPECIAL_SECURITY_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: ciprianRotatedPass,
          confirmNewPassword: ciprianRotatedPass,
        }),
      });
      assert.strictEqual(regularAdminRejected.status, 403);

      // AI Manager rotates AdminCiprian's password via update-credentials -> 200
      const aiStep1b = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'JuanOrozco', password: SPECIAL_SECURITY_KEY }),
      });
      assert.strictEqual(aiStep1b.status, 200);
      const aiD1b = await aiStep1b.json();
      const aiAnswersB = { 'sq-test-1': 'resp-uno', 'sq-test-2': '2099', 'sq-test-3': 'clave-tres', 'sq-test-4': 'codigo-cuatro', 'sq-test-5': 'gusto-cinco' };
      const aiStep2b = await fetch(`${baseUrl}/api/auth/verify-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: aiD1b.preAuthToken, answer: aiAnswersB[aiD1b.securityChallenge.questionId] }),
      });
      assert.strictEqual(aiStep2b.status, 200);
      const aiLogin = await aiStep2b.json();
      const oldCiprianToken = ciprianToken;
      const updateRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aiLogin.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetAccountId: ciprianId,
          newPassword: ciprianRotatedPass,
          confirmNewPassword: ciprianRotatedPass,
        }),
      });
      assert.strictEqual(updateRes.status, 200);
      const updateBody = await updateRes.json();
      assert.strictEqual(updateBody.ok, true);

      // Old token revoked; new password works immediately for login AND subsequent operational mutations
      const oldSess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${oldCiprianToken}` },
      });
      assert.strictEqual(oldSess.status, 401);

      const newLogin = await loginAdmin2FA(
        baseUrl,
        ADMIN_CIPRIAN_USER,
        ciprianRotatedPass,
        ADMIN_CIPRIAN_PIN
      );
      ciprianToken = newLogin.sessionToken;

      const mutationWithNewPass = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ciprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ advisorName: 'Ciprian Rotated OK', adminPassword: ciprianRotatedPass }),
      });
      assert.strictEqual(mutationWithNewPass.status, 200);

      // Confirm KevinyKaren's session was completely unaffected
      const kevinStillOk = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${kevinToken}` },
      });
      assert.strictEqual(kevinStillOk.status, 200);
    });
  });
});
