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
  `royal-auth-rbac-store-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-auth-rbac-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const MASTER_KEY = 'PoloNorte121966@';
const ADMIN_CHANGE_PIN = '1532';
const ADMIN_DEFAULT_PASSWORD = 'AdminMaster2026@';
const ADMIN_UPDATED_PASSWORD = 'AdminNewPass2027@';

const {
  default: app,
  supabaseWriteWithOptionalColumns,
  encodeAccountLegacyMeta,
  decodeAccountLegacyMeta,
  hashSecret,
  mapAuthAccountRow,
  mapReferrerRow,
  mapQrRow,
  persistNewAuthAccount,
  persistUpdatedAuthAccount,
  persistDeletedAuthAccount,
  memoryAccountMeta,
  memoryAccountDbIds,
  memoryReferrerAccountIds,
  memoryQrAccountIds,
} = await import('../server/index.js');

describe('Multi-Role Auth, Accounts Security, Telemarketing/Vendedor Workflow & RBAC Suite', () => {
  let server;
  let baseUrl;
  let adminSessionToken;
  let teleSessionToken;
  let vendedor1Account;
  let vendedor2Account;
  let vendedor1Token;
  let vendedor2Token;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
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

  describe('1. Authentication: Admin 2FA vs Telemarketing/Vendedor 1FA', () => {
    test('AdminCiprian requires 2FA (password + PIN 1966) and AdminCripian is strictly rejected', async () => {
      const badAlias = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminCripian', password: 'AdminMaster2026@' }),
      });
      assert.strictEqual(badAlias.status, 401);

      const step1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminCiprian', password: 'AdminMaster2026@' }),
      });
      assert.strictEqual(step1.status, 200);
      const d1 = await step1.json();
      assert.strictEqual(d1.ok, true);
      assert.strictEqual(d1.requiresPin, true);
      assert.strictEqual(d1.role, 'admin');
      assert.strictEqual(d1.tag, 'ADMIN-CIPRIAN');
      assert.strictEqual(typeof d1.preAuthToken, 'string');
      assert.strictEqual(d1.sessionToken, undefined);

      const badPin = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: d1.preAuthToken, pin: '0000' }),
      });
      assert.strictEqual(badPin.status, 401);

      const step2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: d1.preAuthToken, pin: '1966' }),
      });
      assert.strictEqual(step2.status, 200);
      const d2 = await step2.json();
      assert.strictEqual(d2.ok, true);
      assert.strictEqual(d2.role, 'admin');
      assert.strictEqual(d2.username, 'AdminCiprian');
      assert.strictEqual(typeof d2.sessionToken, 'string');
      adminSessionToken = d2.sessionToken;
    });

    test('Telemarketing logs in directly with 1FA (NO PIN required)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Telemarketing', password: 'UsuCa2026@' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.requiresPin, false);
      assert.strictEqual(data.role, 'telemarketing');
      assert.strictEqual(data.tag, 'TELEMARKETING');
      assert.strictEqual(typeof data.sessionToken, 'string');
      assert.strictEqual(data.preAuthToken, undefined);
      teleSessionToken = data.sessionToken;

      const sessRes = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${teleSessionToken}` },
      });
      assert.strictEqual(sessRes.status, 200);
      const sess = await sessRes.json();
      assert.strictEqual(sess.ok, true);
      assert.strictEqual(sess.authenticated, true);
      assert.strictEqual(sess.role, 'telemarketing');
      assert.strictEqual(sess.tag, 'TELEMARKETING');
    });
  });

  describe('2. Accounts Management, Password Change Rules & Token Revocation', () => {
    test('Admin creates Vendedor accounts with own admin password; non-admin gets 403; wrong/missing password gets 401; duplicates get 409', async () => {
      // Telemarketing rejected on /api/accounts
      const teleGet = await fetch(`${baseUrl}/api/accounts`, {
        headers: { Authorization: `Bearer ${teleSessionToken}` },
      });
      assert.strictEqual(teleGet.status, 403);

      // Missing admin password -> 401
      const noPassword = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'vendedor1',
          displayName: 'Carlos Ventas',
          role: 'vendedor',
          tag: 'CARLOS-01',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      assert.strictEqual(noPassword.status, 401);
      const noPasswordBody = await noPassword.json();
      assert.strictEqual(noPasswordBody.locked, false);
      assert.strictEqual(typeof noPasswordBody.remainingAttempts, 'number');

      // Master key is NOT accepted when creating vendedor/telemarketing -> 401
      const masterRejected = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          username: 'vendedor1',
          displayName: 'Carlos Ventas',
          role: 'vendedor',
          tag: 'CARLOS-01',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      assert.strictEqual(masterRejected.status, 401);

      // Create Vendedor 1 with logged-in admin's own password (adminPassword field)
      const c1 = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          username: 'vendedor1',
          displayName: 'Carlos Ventas',
          role: 'vendedor',
          tag: 'CARLOS-01',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      assert.strictEqual(c1.status, 201);
      const d1 = await c1.json();
      vendedor1Account = d1.account;
      assert.strictEqual(vendedor1Account.role, 'vendedor');
      assert.strictEqual(vendedor1Account.tag, 'CARLOS-01');
      assert.strictEqual(vendedor1Account.hasPin, false);
      assert.strictEqual(vendedor1Account.passwordHash, undefined);

      // Duplicate tag rejected with 409
      const dupTag = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          username: 'vendedor_dup',
          displayName: 'Dup',
          role: 'vendedor',
          tag: 'carlos-01',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      assert.strictEqual(dupTag.status, 409);

      // Create Vendedor 2 using backward-compatible masterPassword field carrying the admin's password
      const c2 = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: ADMIN_DEFAULT_PASSWORD,
          username: 'vendedor2',
          displayName: 'María Ventas',
          role: 'vendedor',
          tag: 'MARIA-02',
          password: 'MariaPassword1!',
          confirmPassword: 'MariaPassword1!',
        }),
      });
      assert.strictEqual(c2.status, 201);
      vendedor2Account = (await c2.json()).account;

      // Both vendedores log in directly (1FA)
      const l1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'vendedor1', password: 'Password123!' }),
      });
      assert.strictEqual(l1.status, 200);
      const ld1 = await l1.json();
      assert.strictEqual(ld1.requiresPin, false);
      vendedor1Token = ld1.sessionToken;

      const l2 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'vendedor2', password: 'MariaPassword1!' }),
      });
      assert.strictEqual(l2.status, 200);
      vendedor2Token = (await l2.json()).sessionToken;
    });

    test('POST /api/accounts/:id/password validates target currentPassword + 2x newPassword, rejects admin, and revokes old tokens', async () => {
      // Rejects admin account with 400
      const adminReject = await fetch(`${baseUrl}/api/accounts/default/password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: 'AdminMaster2026@',
          newPassword: 'NewPassword99!',
          confirmNewPassword: 'NewPassword99!',
        }),
      });
      assert.strictEqual(adminReject.status, 400);

      // Wrong currentPassword -> 403
      const wrongCurrent = await fetch(`${baseUrl}/api/accounts/${vendedor1Account.id}/password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: 'WrongOldPassword!',
          newPassword: 'NewPassword99!',
          confirmNewPassword: 'NewPassword99!',
        }),
      });
      assert.strictEqual(wrongCurrent.status, 403);

      // Mismatch confirmNewPassword -> 400
      const mismatch = await fetch(`${baseUrl}/api/accounts/${vendedor1Account.id}/password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword99!',
          confirmNewPassword: 'Different99!',
        }),
      });
      assert.strictEqual(mismatch.status, 400);

      // Valid password change revokes old token
      const oldToken = vendedor1Token;
      const okPwd = await fetch(`${baseUrl}/api/accounts/${vendedor1Account.id}/password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword99!',
          confirmNewPassword: 'NewPassword99!',
        }),
      });
      assert.strictEqual(okPwd.status, 200);

      const oldSess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${oldToken}` },
      });
      assert.strictEqual(oldSess.status, 401);

      // Login with new password succeeds
      const relogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'vendedor1', password: 'NewPassword99!' }),
      });
      assert.strictEqual(relogin.status, 200);
      vendedor1Token = (await relogin.json()).sessionToken;
    });

    test('Account avatarUrl supports HTTPS + compressed base64, syncs to referrers/all roles, clears to null, and rejects SVG/XSS/oversized with 400', async () => {
      const samplePng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

      // Reject SVG XSS, javascript:, and oversized base64 on POST & PATCH
      const badAvatars = [
        'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+',
        'javascript:alert(1)',
        `data:image/webp;base64,${'A'.repeat(560000)}`,
      ];
      for (const bad of badAvatars) {
        const badPatch = await fetch(`${baseUrl}/api/accounts/${vendedor1Account.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD, avatarUrl: bad }),
        });
        assert.strictEqual(badPatch.status, 400, `Expected 400 for invalid avatar: ${bad.slice(0, 40)}`);
      }

      // Set base64 PNG avatar on vendedor1 -> syncs to referrers & appears in all 3 roles' GET /api/state + session
      const setPng = await fetch(`${baseUrl}/api/accounts/${vendedor1Account.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD, avatarUrl: samplePng }),
      });
      assert.strictEqual(setPng.status, 200);
      const setPngData = await setPng.json();
      assert.strictEqual(setPngData.account.avatarUrl, samplePng);
      const syncedRef = setPngData.state.referrers.find((r) => r.code === 'CARLOS-01');
      assert.strictEqual(syncedRef.avatarUrl, samplePng);

      // Telemarketing GET /api/state exposes avatarUrl on referrers[]
      const teleState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${teleSessionToken}` },
        })
      ).json();
      const teleRef = teleState.referrers.find((r) => r.code === 'CARLOS-01');
      assert.strictEqual(teleRef.avatarUrl, samplePng);

      // Vendedor session & GET /api/state expose avatarUrl
      const v1Sess = await (
        await fetch(`${baseUrl}/api/auth/session`, {
          headers: { Authorization: `Bearer ${vendedor1Token}` },
        })
      ).json();
      assert.strictEqual(v1Sess.avatarUrl, samplePng);

      const v1State = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${vendedor1Token}` },
        })
      ).json();
      assert.strictEqual(v1State.referrers[0].avatarUrl, samplePng);

      // PATCH /api/referrals/:id updates avatarUrl and syncs back to linked account
      const httpsAvatar = 'https://cdn.example.com/carlos-pro.webp';
      const refPatch = await fetch(`${baseUrl}/api/referrals/${syncedRef.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD, avatarUrl: httpsAvatar }),
      });
      assert.strictEqual(refPatch.status, 200);
      const refPatchData = await refPatch.json();
      assert.strictEqual(refPatchData.referrer.avatarUrl, httpsAvatar);
      const syncedAcc = refPatchData.state.accounts.find((a) => a.id === vendedor1Account.id);
      assert.strictEqual(syncedAcc.avatarUrl, httpsAvatar);

      // Clearing avatar to null clears both account & referrer
      const clearRes = await fetch(`${baseUrl}/api/accounts/${vendedor1Account.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD, avatarUrl: null }),
      });
      assert.strictEqual(clearRes.status, 200);
      const clearData = await clearRes.json();
      assert.strictEqual(clearData.account.avatarUrl, null);
      assert.strictEqual(
        clearData.state.referrers.find((r) => r.code === 'CARLOS-01').avatarUrl,
        null
      );
    });
  });

  describe('3. Telemarketing Queue, Reposo, Vendedor Ownership & Lock, and Admin Unlock', () => {
    let leadAId; // CARLOS-01 -> scheduled -> confirmed & locked
    let leadBId; // CARLOS-01 -> not_scheduled (reposo) -> reactivated by admin
    let leadCId; // MARIA-02 -> isolated from CARLOS-01

    before(async () => {
      const makeLead = async (name, phone, referralCode) => {
        const r = await fetch(`${baseUrl}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, address: 'Dallas, TX', acceptedTerms: true, referralCode }),
        });
        assert.strictEqual(r.status, 201);
        return (await r.json()).lead.id;
      };

      leadAId = await makeLead('Lead Agendado Carlos', '555-101-1001', 'CARLOS-01');
      leadBId = await makeLead('Lead Reposo Carlos', '555-102-1002', 'CARLOS-01');
      leadCId = await makeLead('Lead De Maria', '555-103-1003', 'MARIA-02');
    });

    test('Telemarketing sees pending leads WITH seller attribution, marks scheduled/not_scheduled, and processed leads disappear from queue', async () => {
      const beforeState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${teleSessionToken}` },
        })
      ).json();
      assert.strictEqual(beforeState.role, 'telemarketing');
      assert.deepStrictEqual(beforeState.gifts, []);
      assert.deepStrictEqual(beforeState.qrHistory, []);
      assert.deepStrictEqual(beforeState.accounts, []);
      const leadA = beforeState.leads.find((l) => l.id === leadAId);
      assert.ok(leadA);
      assert.strictEqual(leadA.referralCode, 'CARLOS-01');
      assert.strictEqual(leadA.referrerName, 'Carlos Ventas');
      assert.strictEqual(leadA.callOutcome, 'pending');
      assert.strictEqual(leadA.notes, undefined);

      // Telemarketing cannot set category or notes -> 403
      const forbidden = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'scheduled', category: 'cita' }),
      });
      assert.strictEqual(forbidden.status, 403);

      // Mark Lead A as scheduled -> disappears from telemarketing state
      const schedRes = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'scheduled' }),
      });
      assert.strictEqual(schedRes.status, 200);
      const schedData = await schedRes.json();
      assert.strictEqual(schedData.lead.callOutcome, 'scheduled');
      assert.strictEqual(schedData.state.leads.some((l) => l.id === leadAId), false);

      // Re-marking Lead A -> 409
      const dupMark = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'not_scheduled' }),
      });
      assert.strictEqual(dupMark.status, 409);

      // Mark Lead B as not_scheduled (Reposo) -> disappears from telemarketing state
      const reposoRes = await fetch(`${baseUrl}/api/leads/${leadBId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'not_scheduled' }),
      });
      assert.strictEqual(reposoRes.status, 200);
      const reposoData = await reposoRes.json();
      assert.strictEqual(reposoData.state.leads.some((l) => l.id === leadBId), false);
    });

    test('Vendedor sees ONLY own leads across all statuses, can ONLY confirm & lock scheduled leads, and Admin can unlock/reactivate', async () => {
      const v1State = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${vendedor1Token}` },
        })
      ).json();
      assert.strictEqual(v1State.role, 'vendedor');
      assert.strictEqual(v1State.leads.some((l) => l.id === leadAId), true);
      assert.strictEqual(v1State.leads.some((l) => l.id === leadBId), true);
      assert.strictEqual(v1State.leads.some((l) => l.id === leadCId), false);

      // Cross-seller PATCH -> 403
      const crossSeller = await fetch(`${baseUrl}/api/leads/${leadCId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', confirmLock: true }),
      });
      assert.strictEqual(crossSeller.status, 403);

      // Reposo (not_scheduled) lead -> 409
      const reposoTry = await fetch(`${baseUrl}/api/leads/${leadBId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', confirmLock: true }),
      });
      assert.strictEqual(reposoTry.status, 409);

      // Explicit confirmLock: false -> 400
      const rejectFalseConfirm = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', confirmLock: false }),
      });
      assert.strictEqual(rejectFalseConfirm.status, 400);

      // Scheduled lead advances forward cleanly (none -> cita without confirmLock -> orden with confirmLock: true)
      const advanceCita = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita' }),
      });
      assert.strictEqual(advanceCita.status, 200);
      assert.strictEqual((await advanceCita.json()).lead.category, 'cita');

      // Forward progression cita -> orden by vendedor -> 200
      const confirmRes = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'orden',
          orderAmount: 3500,
          notes: 'Venta cerrada en demo',
          confirmLock: true,
        }),
      });
      assert.strictEqual(confirmRes.status, 200);
      const confirmData = await confirmRes.json();
      assert.strictEqual(confirmData.lead.category, 'orden');
      assert.strictEqual(confirmData.lead.orderAmount, 3500);
      assert.strictEqual(confirmData.lead.sellerLocked, true);
      assert.strictEqual(confirmData.lead.sellerConfirmedBy, 'vendedor1');
      assert.strictEqual(confirmData.lead.promoCodeInvalidated, true);

      // Once at orden, vendedor CANNOT downgrade without Admin password -> 403 ADMIN_PASSWORD_REQUIRED
      const lockedRetry = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo', confirmLock: true }),
      });
      assert.strictEqual(lockedRetry.status, 403);
      assert.strictEqual((await lockedRetry.json()).code, 'ADMIN_PASSWORD_REQUIRED');

      // Same-rank orden edit (updating orderAmount/notes) is permitted per Opción A -> 200
      const repeatSameRetry = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 4200 }),
      });
      assert.strictEqual(repeatSameRetry.status, 200);
      assert.strictEqual((await repeatSameRetry.json()).lead.orderAmount, 4200);

      // Admin cannot unlock without adminPassword -> 403
      const unlockNoPwd = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'none', sellerLocked: false }),
      });
      assert.strictEqual(unlockNoPwd.status, 403);

      // Admin unlocks with valid adminPassword -> 200
      const unlockOk = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'none',
          sellerLocked: false,
          promoCodeInvalidated: false,
          adminPassword: 'AdminMaster2026@',
        }),
      });
      assert.strictEqual(unlockOk.status, 200);
      const unlocked = await unlockOk.json();
      assert.strictEqual(unlocked.lead.category, 'none');
      assert.strictEqual(unlocked.lead.sellerLocked, false);
      assert.strictEqual(unlocked.lead.promoCodeInvalidated, false);
      assert.strictEqual(unlocked.lead.orderAmount, null);

      // Admin reactivates Lead B from reposo -> pending (reappears in telemarketing queue)
      const reactivateRes = await fetch(`${baseUrl}/api/leads/${leadBId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'pending' }),
      });
      assert.strictEqual(reactivateRes.status, 200);

      const teleAfter = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${teleSessionToken}` },
        })
      ).json();
      assert.strictEqual(teleAfter.leads.some((l) => l.id === leadBId), true);

      // Public PATCH preserving qualification.cedeGoldenTicket = true
      const cedePatch = await fetch(`${baseUrl}/api/leads/${leadAId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qualification: {
            creditProfile: 'No conocía Royal Prestige · Cede Boleto Dorado',
            housingStatus: 'Prefiere ceder el Boleto Dorado a un amigo/familiar',
            investmentPriority: 'Compartir QR · Programa de Anfitrión',
            score: 55,
            tier: 'medio',
            knowsBrand: false,
            isClient: false,
            cedeGoldenTicket: true,
          },
        }),
      });
      assert.strictEqual(cedePatch.status, 200);
      const cedeData = await cedePatch.json();
      assert.strictEqual(cedeData.lead.qualification?.cedeGoldenTicket, true);

      const adminCheck = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        })
      ).json();
      const persistedLead = adminCheck.leads.find((l) => l.id === leadAId);
      assert.strictEqual(persistedLead?.qualification?.cedeGoldenTicket, true);
    });
  });

  describe('4. Own Admin Password on Operational Mutations & Special Security Key ONLY on Admin Credential Change (Key + 2x New + PIN 1532)', () => {
    test('Settings and Gift mutations require logged-in Admin own password (401 without it or with Master Key, 200/201 with own password)', async () => {
      const noMasterSettings = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showcaseStyle: 'crystal-aurora' }),
      });
      assert.strictEqual(noMasterSettings.status, 401);

      const masterKeySettingsRejected = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showcaseStyle: 'crystal-aurora', masterPassword: MASTER_KEY }),
      });
      assert.strictEqual(masterKeySettingsRejected.status, 401);

      const okSettings = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showcaseStyle: 'crystal-aurora', adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(okSettings.status, 200);
      assert.strictEqual((await okSettings.json()).settings.showcaseStyle, 'crystal-aurora');

      const noMasterGift = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Regalo Sin Clave' }),
      });
      assert.strictEqual(noMasterGift.status, 401);

      const okGift = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Regalo Con Clave', probability: 25, adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(okGift.status, 201);
      const giftId = (await okGift.json()).gift.id;

      const noMasterDelGift = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(noMasterDelGift.status, 401);

      const okDelGift = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(okDelGift.status, 200);
    });

    test('POST /api/auth/update-credentials enforces PoloNorte121966@ + PIN 1532 + 2x matching newPassword and rotates admin token', async () => {
      // Missing PIN -> 403
      const noPin = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          newPassword: 'AdminNewPass2027@',
          confirmNewPassword: 'AdminNewPass2027@',
        }),
      });
      assert.strictEqual(noPin.status, 403);

      // Wrong PIN -> 403
      const badPin = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          confirmationPin: '9999',
          newPassword: 'AdminNewPass2027@',
          confirmNewPassword: 'AdminNewPass2027@',
        }),
      });
      assert.strictEqual(badPin.status, 403);

      // Mismatched confirmNewPassword -> 400
      const badConfirm = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: 'AdminNewPass2027@',
          confirmNewPassword: 'MismatchPass2027@',
        }),
      });
      assert.strictEqual(badConfirm.status, 400);

      // Valid update rotates token & invalidates old token
      const oldAdminToken = adminSessionToken;
      const okCreds = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: 'AdminNewPass2027@',
          confirmNewPassword: 'AdminNewPass2027@',
        }),
      });
      assert.strictEqual(okCreds.status, 200);
      const credsData = await okCreds.json();
      assert.strictEqual(credsData.ok, true);
      assert.strictEqual(typeof credsData.sessionToken, 'string');
      adminSessionToken = credsData.sessionToken;

      const oldAdminSess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${oldAdminToken}` },
      });
      assert.strictEqual(oldAdminSess.status, 401);

      const newAdminSess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(newAdminSess.status, 200);
    });

    test('Deactivating & deleting an account immediately revokes its session and disables its referrer', async () => {
      const deact = await fetch(`${baseUrl}/api/accounts/${vendedor2Account.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_UPDATED_PASSWORD, active: false }),
      });
      assert.strictEqual(deact.status, 200);

      const v2Sess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${vendedor2Token}` },
      });
      assert.strictEqual(v2Sess.status, 401);

      const v2Login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'vendedor2', password: 'MariaPassword1!' }),
      });
      assert.strictEqual(v2Login.status, 403);

      const delRes = await fetch(`${baseUrl}/api/accounts/${vendedor2Account.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_UPDATED_PASSWORD }),
      });
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.accounts.some((a) => a.id === vendedor2Account.id), false);
    });

    test('Anti-cache headers and Master Reset clear leads, QRs & visitLog cleanly', async () => {
      const stateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(stateRes.status, 200);
      assert.match(stateRes.headers.get('cache-control') || '', /no-store/i);
      assert.strictEqual(stateRes.headers.get('pragma'), 'no-cache');

      const resetRes = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_UPDATED_PASSWORD, resetCatalogAndSettings: true }),
      });
      assert.strictEqual(resetRes.status, 200);
      const resetData = await resetRes.json();
      assert.deepStrictEqual(resetData.state.leads, []);
      assert.deepStrictEqual(resetData.state.qrHistory, []);
      assert.deepStrictEqual(resetData.state.visitLog, []);
      assert.strictEqual(resetData.state.gifts.length, 9);
    });
  });

  describe('5. Regression Suite: Live Supabase Schema Drift, Legacy dsb_auth & Referrer Sync', () => {
    test('persistNewAuthAccount / persistUpdatedAuthAccount send non-null pin_hash="" for vendedor, survive missing dsb_auth columns via meta_v1 fallback, and resolve legacy id="caller"', async () => {
      memoryAccountMeta.clear();
      memoryAccountDbIds.clear();

      // Simulate legacy live Supabase dsb_auth table:
      // - pin_hash is NOT NULL (rejects null with 23502)
      // - master_hash is NOT NULL (rejects null/missing on POST with 23502)
      // - display_name, tag, avatar_url, active, token_version, created_at DO NOT EXIST (PGRST204)
      const legacyColumns = new Set([
        'id',
        'username',
        'role',
        'password_hash',
        'pin_hash',
        'master_hash',
        'pre_auth_token',
        'updated_at',
      ]);
      const mockTable = new Map([
        [
          'caller',
          {
            id: 'caller',
            username: 'Caller',
            role: 'caller',
            password_hash: 'sha256$s$h',
            pin_hash: '',
            master_hash: '',
            pre_auth_token: null,
            updated_at: '2026-11-20T00:00:00.000Z',
          },
        ],
      ]);

      const mockRest = async (restPath, init = {}) => {
        const method = init.method || 'GET';
        const body = init.body ? JSON.parse(init.body) : null;
        if (method === 'POST' && restPath === 'dsb_auth') {
          for (const col of Object.keys(body)) {
            if (!legacyColumns.has(col)) {
              const err = new Error(`Could not find the '${col}' column of 'dsb_auth' in the schema cache`);
              err.code = 'PGRST204';
              throw err;
            }
          }
          if (body.pin_hash === null || body.pin_hash === undefined) {
            const err = new Error('null value in column "pin_hash" of relation "dsb_auth" violates not-null constraint');
            err.code = '23502';
            throw err;
          }
          if (body.master_hash === null || body.master_hash === undefined) {
            const err = new Error('null value in column "master_hash" of relation "dsb_auth" violates not-null constraint');
            err.code = '23502';
            throw err;
          }
          mockTable.set(body.id, { ...body });
          return null;
        }
        if (method === 'PATCH' && restPath.startsWith('dsb_auth?id=eq.')) {
          const targetId = decodeURIComponent(restPath.split('id=eq.')[1]);
          for (const col of Object.keys(body)) {
            if (!legacyColumns.has(col)) {
              const err = new Error(`Could not find the '${col}' column of 'dsb_auth' in the schema cache`);
              err.code = 'PGRST204';
              throw err;
            }
          }
          if ('pin_hash' in body && body.pin_hash === null) {
            const err = new Error('null value in column "pin_hash" of relation "dsb_auth" violates not-null constraint');
            err.code = '23502';
            throw err;
          }
          const existing = mockTable.get(targetId);
          if (existing) {
            mockTable.set(targetId, { ...existing, ...body });
          }
          return null;
        }
        if (method === 'DELETE' && restPath.startsWith('dsb_auth?id=eq.')) {
          const targetId = decodeURIComponent(restPath.split('id=eq.')[1]);
          mockTable.delete(targetId);
          return null;
        }
        throw new Error(`Unexpected mock call: ${method} ${restPath}`);
      };

      const vendedorAcc = {
        id: 'usr-vend-legacy-1',
        username: 'pedrov',
        displayName: 'Pedro Ventas',
        role: 'vendedor',
        tag: 'PEDRO-VIP',
        avatarUrl: 'https://cdn.example.com/pedro.png',
        active: true,
        passwordSalt: 'aabbcc',
        passwordHash: 'scrypt$aabbcc$ddeeff',
        pinSalt: null,
        pinHash: null,
        tokenVersion: 1,
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:00:00.000Z',
      };

      await persistNewAuthAccount(vendedorAcc, mockRest);

      const storedRow = mockTable.get(vendedorAcc.id);
      assert.ok(storedRow, 'Vendedor row must be inserted into legacy dsb_auth');
      assert.strictEqual(storedRow.pin_hash, '', 'Non-admin pin_hash must be empty string, never null');
      assert.strictEqual(storedRow.master_hash, '', 'master_hash must be preserved as non-null empty string');
      assert.strictEqual(storedRow.role, 'vendedor');
      assert.ok(
        typeof storedRow.pre_auth_token === 'string' && storedRow.pre_auth_token.startsWith('meta_v1:'),
        'Compact legacy metadata fallback must be persisted when optional columns are missing'
      );

      // Simulate server restart / cold start by clearing in-memory metadata map
      memoryAccountMeta.clear();
      const reloaded = mapAuthAccountRow(storedRow);
      assert.strictEqual(reloaded.displayName, 'Pedro Ventas');
      assert.strictEqual(reloaded.tag, 'PEDRO-VIP');
      assert.strictEqual(reloaded.active, true);
      assert.strictEqual(reloaded.tokenVersion, 1);
      assert.strictEqual(reloaded.pinHash, null);

      // Update account: deactivate + bump tokenVersion + rename tag -> survives restart
      const updatedVendedor = {
        ...vendedorAcc,
        displayName: 'Pedro VIP Pro',
        tag: 'PEDRO-PRO',
        active: false,
        tokenVersion: 2,
        updatedAt: '2026-11-25T11:00:00.000Z',
      };
      await persistUpdatedAuthAccount(updatedVendedor, mockRest);
      memoryAccountMeta.clear();
      const reloadedAfterPatch = mapAuthAccountRow(mockTable.get(vendedorAcc.id));
      assert.strictEqual(reloadedAfterPatch.displayName, 'Pedro VIP Pro');
      assert.strictEqual(reloadedAfterPatch.tag, 'PEDRO-PRO');
      assert.strictEqual(reloadedAfterPatch.active, false);
      assert.strictEqual(reloadedAfterPatch.tokenVersion, 2);

      // Legacy id="caller" row maps to id="telemarketing", and PATCH/DELETE target real DB id="caller"
      const mappedTele = mapAuthAccountRow(mockTable.get('caller'));
      assert.strictEqual(mappedTele.id, 'telemarketing');
      assert.strictEqual(memoryAccountDbIds.get('telemarketing'), 'caller');

      await persistUpdatedAuthAccount(
        {
          ...mappedTele,
          displayName: 'Equipo Telemarketing',
          tokenVersion: 3,
          updatedAt: '2026-11-25T12:00:00.000Z',
        },
        mockRest
      );
      assert.strictEqual(mockTable.get('caller').username, 'Telemarketing');
      assert.strictEqual(mockTable.get('caller').role, 'telemarketing');
      assert.strictEqual(decodeAccountLegacyMeta(mockTable.get('caller').pre_auth_token)?.tokenVersion, 3);

      await persistDeletedAuthAccount(vendedorAcc.id, mockRest);
      assert.strictEqual(mockTable.has(vendedorAcc.id), false);

      // Verify exact column matching & empty PATCH guard in supabaseWriteWithOptionalColumns
      let patchCount = 0;
      await supabaseWriteWithOptionalColumns(
        'leads?id=eq.lead-x',
        'PATCH',
        {},
        { promo_code_invalidated: true, promo_code_invalidated_at: '2026-11-25T00:00:00.000Z' },
        ['promo_code_invalidated', 'promo_code_invalidated_at'],
        async (_p, init) => {
          patchCount += 1;
          const b = JSON.parse(init.body);
          if ('promo_code_invalidated_at' in b) {
            const e = new Error("Could not find the 'promo_code_invalidated_at' column of 'leads' in the schema cache");
            e.code = 'PGRST204';
            throw e;
          }
          if ('promo_code_invalidated' in b) {
            const e = new Error("Could not find the 'promo_code_invalidated' column of 'leads' in the schema cache");
            e.code = 'PGRST204';
            throw e;
          }
          throw new Error('Should not send empty PATCH {}');
        }
      );
      assert.strictEqual(patchCount, 2, 'Must strip one column at a time and skip empty PATCH {} cleanly');

      // Verify mapReferrerRow & mapQrRow fallback to memory accountId maps when account_id column is missing
      memoryReferrerAccountIds.set('ref-legacy-1', 'usr-vend-legacy-1');
      const mappedRef = mapReferrerRow({
        id: 'ref-legacy-1',
        name: 'Pedro Ventas',
        code: 'PEDRO-VIP',
        active: true,
        visits_count: 0,
        unique_visits_count: 0,
        created_at: '2026-11-25T10:00:00.000Z',
      });
      assert.strictEqual(mappedRef.accountId, 'usr-vend-legacy-1');
      memoryReferrerAccountIds.delete('ref-legacy-1');

      memoryQrAccountIds.set('qr-legacy-1', 'usr-vend-legacy-1');
      const mappedQr = mapQrRow({
        id: 'qr-legacy-1',
        name: 'QR Pedro',
        target_url: 'https://example.com/?ref=PEDRO-VIP',
        referral_code: 'PEDRO-VIP',
        referrer_id: 'ref-legacy-1',
        created_at: '2026-11-25T10:00:00.000Z',
      });
      assert.strictEqual(mappedQr.accountId, 'usr-vend-legacy-1');
      memoryQrAccountIds.delete('qr-legacy-1');

      // Verify encodeAccountLegacyMeta / decodeAccountLegacyMeta roundtrip
      const encoded = encodeAccountLegacyMeta({
        displayName: 'Test User',
        tag: 'TEST-01',
        active: false,
        tokenVersion: 4,
        createdAt: '2026-11-25T00:00:00.000Z',
      });
      assert.deepStrictEqual(decodeAccountLegacyMeta(encoded), {
        displayName: 'Test User',
        tag: 'TEST-01',
        active: false,
        tokenVersion: 4,
        createdAt: '2026-11-25T00:00:00.000Z',
      });
      assert.strictEqual(decodeAccountLegacyMeta('random-hex-token'), null);

      memoryAccountMeta.clear();
      memoryAccountDbIds.clear();
    });

    test('Vendedor creation + linked referrer lifecycle + PATCH /api/referrals/:id syncs tag/name back to account + delete deactivates referrer', async () => {
      // Create a fresh vendedor account with empty avatarUrl string (as UI forms often send)
      // Note: Section 4 rotated AdminCiprian's password to ADMIN_UPDATED_PASSWORD
      const createRes = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_UPDATED_PASSWORD,
          username: 'vendedor_reg_1',
          displayName: 'Lucía Vendedora',
          role: 'vendedor',
          tag: 'lucia-ventas',
          avatarUrl: '',
          password: 'LuciaPassword1!',
          confirmPassword: 'LuciaPassword1!',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const created = await createRes.json();
      assert.strictEqual(created.ok, true);
      assert.strictEqual(created.account.tag, 'LUCIA-VENTAS');
      assert.strictEqual(created.account.avatarUrl, null);
      assert.ok(created.referrer);
      assert.strictEqual(created.referrer.accountId, created.account.id);
      assert.strictEqual(created.referrer.code, 'LUCIA-VENTAS');

      // Update referrer code/name via PATCH /api/referrals/:id -> syncs tag/displayName back to vendedor account
      const patchRef = await fetch(`${baseUrl}/api/referrals/${created.referrer.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_UPDATED_PASSWORD,
          name: 'Lucía Elite',
          code: 'LUCIA-ELITE',
        }),
      });
      assert.strictEqual(patchRef.status, 200);
      const patchRefData = await patchRef.json();
      assert.strictEqual(patchRefData.referrer.code, 'LUCIA-ELITE');
      const syncedAccount = patchRefData.state.accounts.find((a) => a.id === created.account.id);
      assert.strictEqual(syncedAccount.tag, 'LUCIA-ELITE');
      assert.strictEqual(syncedAccount.displayName, 'Lucía Elite');

      // Delete vendedor account -> account removed and linked referrer deactivated
      const delRes = await fetch(`${baseUrl}/api/accounts/${created.account.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_UPDATED_PASSWORD }),
      });
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.accounts.some((a) => a.id === created.account.id), false);
      const deactivatedRef = delData.state.referrers.find((r) => r.id === created.referrer.id);
      assert.strictEqual(deactivatedRef.active, false);
      assert.strictEqual(deactivatedRef.accountId, null);
    });
  });

  describe('6. Multi-Admin Per-Account Password Isolation for Vendedor & Telemarketing Creation', () => {
    test('Each logged-in Admin must authorize vendedor/telemarketing creation strictly with their OWN password (never another admin password or master key)', async () => {
      const adminBPassword = 'AdminB_Distinct2026!';
      const adminBPin = '2468';
      const pwdHashed = hashSecret(adminBPassword);
      const pinHashed = hashSecret(adminBPin);
      const nowIso = new Date().toISOString();

      await persistNewAuthAccount({
        id: 'admin-segundo',
        username: 'AdminSegundo',
        displayName: 'Segundo Administrador',
        role: 'admin',
        tag: 'ADMIN-SEGUNDO',
        avatarUrl: null,
        active: true,
        passwordSalt: pwdHashed.salt,
        passwordHash: pwdHashed.hash,
        pinSalt: pinHashed.salt,
        pinHash: pinHashed.hash,
        tokenVersion: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // Log in as Admin B (2FA)
      const bStep1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminSegundo', password: adminBPassword }),
      });
      assert.strictEqual(bStep1.status, 200);
      const bD1 = await bStep1.json();
      assert.strictEqual(bD1.requiresPin, true);

      const bStep2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: bD1.preAuthToken, pin: adminBPin }),
      });
      assert.strictEqual(bStep2.status, 200);
      const adminBToken = (await bStep2.json()).sessionToken;
      assert.strictEqual(typeof adminBToken, 'string');

      // --- Admin B session checks ---
      // Admin B trying Admin A's current password -> 401
      const bWithAdminAPwd = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_UPDATED_PASSWORD,
          username: 'vend_b_fail_1',
          displayName: 'Fallido Uno',
          role: 'vendedor',
          tag: 'B-FAIL-01',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(bWithAdminAPwd.status, 401);
      const bFail1 = await bWithAdminAPwd.json();
      assert.strictEqual(bFail1.locked, false);
      assert.strictEqual(typeof bFail1.remainingAttempts, 'number');

      // Admin B trying wrong password for telemarketing -> 401
      const bWithWrongPwd = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: 'CompletelyWrongPassword!',
          username: 'tele_b_fail_1',
          displayName: 'Tele Fallido',
          role: 'telemarketing',
          tag: 'TELE-B-FAIL',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(bWithWrongPwd.status, 401);

      // Admin B trying MASTER_KEY for telemarketing -> 401
      const bWithMasterKey = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          username: 'tele_b_fail_2',
          displayName: 'Tele Master Fail',
          role: 'telemarketing',
          tag: 'TELE-B-MFAIL',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(bWithMasterKey.status, 401);

      // Admin B creating vendedor with Admin B's own password -> 201
      const bCreateVend = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: adminBPassword,
          username: 'vend_from_admin_b',
          displayName: 'Vendedor De Admin B',
          role: 'vendedor',
          tag: 'VEND-B-01',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(bCreateVend.status, 201);
      assert.strictEqual((await bCreateVend.json()).account.role, 'vendedor');

      // Admin B creating telemarketing with Admin B's own password via masterPassword compat field -> 201
      const bCreateTele = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: adminBPassword,
          username: 'tele_from_admin_b',
          displayName: 'Tele De Admin B',
          role: 'telemarketing',
          tag: 'TELE-B-01',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(bCreateTele.status, 201);
      assert.strictEqual((await bCreateTele.json()).account.role, 'telemarketing');

      // --- Admin A session checks (current password is ADMIN_UPDATED_PASSWORD) ---
      // Admin A trying Admin B's password -> 401
      const aWithAdminBPwd = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: adminBPassword,
          username: 'vend_a_fail_1',
          displayName: 'Fallido Admin A',
          role: 'vendedor',
          tag: 'A-FAIL-01',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(aWithAdminBPwd.status, 401);

      // Admin A trying its old rotated password -> 401
      const aWithOldPwd = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_DEFAULT_PASSWORD,
          username: 'tele_a_fail_1',
          displayName: 'Tele Old Pwd',
          role: 'telemarketing',
          tag: 'TELE-A-OLD',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(aWithOldPwd.status, 401);

      // Admin A creating vendedor with Admin A's current password -> 201
      const aCreateVend = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_UPDATED_PASSWORD,
          username: 'vend_from_admin_a',
          displayName: 'Vendedor De Admin A',
          role: 'vendedor',
          tag: 'VEND-A-01',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(aCreateVend.status, 201);
      assert.strictEqual((await aCreateVend.json()).account.role, 'vendedor');

      // Admin A creating telemarketing with Admin A's current password -> 201
      const aCreateTele = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: ADMIN_UPDATED_PASSWORD,
          username: 'tele_from_admin_a',
          displayName: 'Tele De Admin A',
          role: 'telemarketing',
          tag: 'TELE-A-01',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(aCreateTele.status, 201);
      assert.strictEqual((await aCreateTele.json()).account.role, 'telemarketing');

      // Creating role='admin' ALSO uses logged-in Admin's own password (rejects MASTER_KEY with 401; rejects missing PIN with 400)
      const roleAdminWithMaster = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          username: 'other_admin',
          displayName: 'Other Admin',
          role: 'admin',
          tag: 'OTHER-ADM',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
          pin: '2468',
        }),
      });
      assert.strictEqual(roleAdminWithMaster.status, 401);

      const roleAdminMissingPin = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: ADMIN_UPDATED_PASSWORD,
          username: 'other_admin',
          displayName: 'Other Admin',
          role: 'admin',
          tag: 'OTHER-ADM',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(roleAdminMissingPin.status, 400);

      // Rate limit lockout (429) on repeated wrong admin passwords from a tracked IP
      const testIp = '198.51.100.77';
      for (let i = 1; i <= 4; i += 1) {
        const failRes = await fetch(`${baseUrl}/api/accounts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminBToken}`,
            'Content-Type': 'application/json',
            'x-test-ip': testIp,
          },
          body: JSON.stringify({
            adminPassword: 'WrongPasswordAttempt!',
            username: 'lock_test_vend',
            displayName: 'Lock Test',
            role: 'vendedor',
            tag: 'LOCK-TEST',
            password: 'UserPass123!',
            confirmPassword: 'UserPass123!',
          }),
        });
        assert.strictEqual(failRes.status, 401);
        const failBody = await failRes.json();
        assert.strictEqual(failBody.locked, false);
        assert.strictEqual(failBody.remainingAttempts, 5 - i);
      }

      const fifthFail = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
          'Content-Type': 'application/json',
          'x-test-ip': testIp,
        },
        body: JSON.stringify({
          adminPassword: 'WrongPasswordAttempt!',
          username: 'lock_test_vend',
          displayName: 'Lock Test',
          role: 'vendedor',
          tag: 'LOCK-TEST',
          password: 'UserPass123!',
          confirmPassword: 'UserPass123!',
        }),
      });
      assert.strictEqual(fifthFail.status, 429);
      const lockedBody = await fifthFail.json();
      assert.strictEqual(lockedBody.locked, true);
      assert.ok(lockedBody.retryAfterSeconds > 0);
      assert.strictEqual(lockedBody.remainingAttempts, 0);
    });
  });

  describe('7. Admin-Only Password Change Endpoint (POST /api/accounts/:id/admin-password)', () => {
    test('Enforces RBAC, security key, confirmation PIN, 2x matching newPassword, admin-only target, token rotation, cross-admin update & lockout', async () => {
      const adminASelfNewPass = 'AdminASelfRotated2028@';
      const adminBNewPass = 'AdminBByAdminA2028!';

      // 1. Non-admin callers (telemarketing & vendedor) are rejected with 403
      const teleCall = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teleSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(teleCall.status, 403);

      const vendCall = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendedor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(vendCall.status, 403);

      // 2. Wrong security key -> 401
      const wrongKey = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: 'WrongSecurityKey999!',
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(wrongKey.status, 401);
      const wrongKeyBody = await wrongKey.json();
      assert.strictEqual(wrongKeyBody.error, 'Clave de seguridad incorrecta.');
      assert.strictEqual(wrongKeyBody.locked, false);
      assert.strictEqual(typeof wrongKeyBody.remainingAttempts, 'number');

      // 3. Wrong confirmation PIN -> 401
      const wrongPin = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: '0000',
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(wrongPin.status, 401);
      const wrongPinBody = await wrongPin.json();
      assert.strictEqual(wrongPinBody.error, 'PIN de confirmación incorrecto.');
      assert.strictEqual(wrongPinBody.locked, false);
      assert.strictEqual(typeof wrongPinBody.remainingAttempts, 'number');

      // 4. Short newPassword (<8 chars) & mismatched confirmNewPassword -> 400
      const shortPass = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: 'short1!',
          confirmNewPassword: 'short1!',
        }),
      });
      assert.strictEqual(shortPass.status, 400);

      const mismatchPass = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: 'DifferentConfirm2028@',
        }),
      });
      assert.strictEqual(mismatchPass.status, 400);
      const mismatchBody = await mismatchPass.json();
      assert.strictEqual(mismatchBody.error, 'La confirmación de la nueva contraseña no coincide.');

      // 5. Rejects ANY target id !== req.dsbSession.userId (vendedor, telemarketing, unknown, or other admin) with 403 Forbidden
      const nonAdminVend = await fetch(`${baseUrl}/api/accounts/${vendedor1Account.id}/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(nonAdminVend.status, 403);

      const nonAdminTele = await fetch(`${baseUrl}/api/accounts/telemarketing/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(nonAdminTele.status, 403);

      const missingTarget = await fetch(`${baseUrl}/api/accounts/nonexistent-admin-id/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(missingTarget.status, 403);

      // 6. Self update (Admin A updates Admin A): returns fresh sessionToken, revokes old token, logs audit alert, 2FA works with new password & rejects old
      const oldAdminAToken = adminSessionToken;
      const selfOk = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${oldAdminAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminASelfNewPass,
          confirmNewPassword: adminASelfNewPass,
        }),
      });
      assert.strictEqual(selfOk.status, 200);
      const selfData = await selfOk.json();
      assert.strictEqual(selfData.ok, true);
      assert.strictEqual(selfData.message, 'Contraseña de administrador actualizada correctamente.');
      assert.strictEqual(typeof selfData.sessionToken, 'string');
      assert.strictEqual(selfData.account.id, 'default');
      assert.strictEqual(selfData.account.passwordHash, undefined);
      adminSessionToken = selfData.sessionToken;

      // Old token revoked, fresh token active
      const oldASess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${oldAdminAToken}` },
      });
      assert.strictEqual(oldASess.status, 401);

      const newASess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(newASess.status, 200);

      // Old password rejected on login
      const oldALogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminCiprian', password: ADMIN_UPDATED_PASSWORD }),
      });
      assert.strictEqual(oldALogin.status, 401);

      // New password succeeds via 2FA login + PIN 1966
      const newALogin1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminCiprian', password: adminASelfNewPass }),
      });
      assert.strictEqual(newALogin1.status, 200);
      const newALogin1Data = await newALogin1.json();
      assert.strictEqual(newALogin1Data.requiresPin, true);

      const newALogin2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: newALogin1Data.preAuthToken, pin: '1966' }),
      });
      assert.strictEqual(newALogin2.status, 200);
      assert.strictEqual(typeof (await newALogin2.json()).sessionToken, 'string');

      // Audit event recorded in securityAlerts
      const stateAfterSelf = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        })
      ).json();
      const selfAudit = (stateAfterSelf.securityAlerts || []).find(
        (a) =>
          a.code === 'admin_audit_event' &&
          a.category === 'audit' &&
          a.severity === 'medium' &&
          a.metadata?.action === 'admin_password_change' &&
          a.metadata?.targetAccountId === 'default'
      );
      assert.ok(selfAudit, 'Expected admin_audit_event for Admin A self password update');

      // 7. Strict Self-Only Cross-Admin Block: Admin A attempting to change Admin B's ("admin-segundo") password -> 403 + critical alert
      // First establish an active Admin B session so we can prove it stays untouched
      const bPre1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminSegundo', password: 'AdminB_Distinct2026!' }),
      });
      assert.strictEqual(bPre1.status, 200);
      const bPre2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: (await bPre1.json()).preAuthToken, pin: '2468' }),
      });
      assert.strictEqual(bPre2.status, 200);
      const oldAdminBToken = (await bPre2.json()).sessionToken;

      // Admin A attempting to update Admin B (even WITH valid MASTER_KEY + PIN 1532) MUST return 403
      const crossBlocked = await fetch(`${baseUrl}/api/accounts/admin-segundo/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: adminBNewPass,
          confirmNewPassword: adminBNewPass,
        }),
      });
      assert.strictEqual(crossBlocked.status, 403);

      // Both sessions remain valid and Admin B's original password still works (unchanged)
      const aStillValid = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(aStillValid.status, 200);

      const bStillValid = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${oldAdminBToken}` },
      });
      assert.strictEqual(bStillValid.status, 200);

      const bOrigLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminSegundo', password: 'AdminB_Distinct2026!' }),
      });
      assert.strictEqual(bOrigLogin.status, 200);

      const bForgedLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AdminSegundo', password: adminBNewPass }),
      });
      assert.strictEqual(bForgedLogin.status, 401);

      // Critical security alert recorded for cross-admin password attempt
      const stateAfterCross = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        })
      ).json();
      assert.ok(
        (stateAfterCross.securityAlerts || []).some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.severity === 'critical' &&
            a.metadata?.reason === 'cross_admin_password_attempt' &&
            a.metadata?.targetAccountId === 'admin-segundo'
        ),
        'Expected critical rbac_unauthorized_attempt alert for cross-admin password attempt'
      );

      // 8. Rate-limit lockout on admin_pw_change bucket (5 failures -> 429)
      const pwTestIp = '203.0.113.88';
      for (let i = 1; i <= 4; i += 1) {
        const failRes = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminSessionToken}`,
            'Content-Type': 'application/json',
            'x-test-ip': pwTestIp,
          },
          body: JSON.stringify({
            securityKey: i % 2 === 0 ? MASTER_KEY : 'WrongKey!',
            confirmationPin: i % 2 === 0 ? '9999' : ADMIN_CHANGE_PIN,
            newPassword: 'AnotherPass2029!',
            confirmNewPassword: 'AnotherPass2029!',
          }),
        });
        assert.strictEqual(failRes.status, 401);
        const failBody = await failRes.json();
        assert.strictEqual(failBody.locked, false);
        assert.strictEqual(failBody.remainingAttempts, 5 - i);
      }

      const fifthFail = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
          'x-test-ip': pwTestIp,
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: '9999',
          newPassword: 'AnotherPass2029!',
          confirmNewPassword: 'AnotherPass2029!',
        }),
      });
      assert.strictEqual(fifthFail.status, 429);
      const lockedData = await fifthFail.json();
      assert.strictEqual(lockedData.locked, true);
      assert.ok(lockedData.retryAfterSeconds > 0);
      assert.strictEqual(lockedData.remainingAttempts, 0);

      // Even with valid credentials, locked IP gets 429
      const blockedValid = await fetch(`${baseUrl}/api/accounts/default/admin-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
          'x-test-ip': pwTestIp,
        },
        body: JSON.stringify({
          securityKey: MASTER_KEY,
          confirmationPin: ADMIN_CHANGE_PIN,
          newPassword: 'AnotherPass2029!',
          confirmNewPassword: 'AnotherPass2029!',
        }),
      });
      assert.strictEqual(blockedValid.status, 429);
      const blockedBody = await blockedValid.json();
      assert.strictEqual(blockedBody.locked, true);
      assert.strictEqual(blockedBody.remainingAttempts, 0);
    });
  });
});
