import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEST_STORE_FILE = path.join(
  os.tmpdir(),
  `royal-ai-manager-store-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-ai-manager-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const AI_MGR_PASS = 'PoloNorte121966@';
const AI_SECURITY_ANSWERS = {
  'sq-test-1': 'resp-uno',
  'sq-test-2': '2099',
  'sq-test-3': 'clave-tres',
  'sq-test-4': 'codigo-cuatro',
  'sq-test-5': 'gusto-cinco',
};
const ADMIN_CIPRIAN_USER = 'AdminCiprian';
const ADMIN_CIPRIAN_PASS = 'AdminMaster2026@';
const ADMIN_CIPRIAN_PIN = '1966';

const { default: app, resetFraudTrackers } = await import('../server/index.js');

async function loginAiManager2FA(baseUrl, username = 'JuanOrozco', password = AI_MGR_PASS, answersMap = AI_SECURITY_ANSWERS) {
  const step1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(step1.status, 200, `Expected 200 on step1 AI login for ${username}`);
  const d1 = await step1.json();
  assert.strictEqual(d1.ok, true);
  assert.strictEqual(d1.requiresPin, false);
  assert.strictEqual(d1.requiresSecurityQuestion, true);
  assert.strictEqual(d1.sessionToken, undefined, 'Step 1 must NEVER issue sessionToken before cognitive 2FA');
  assert.ok(d1.preAuthToken, 'Expected preAuthToken');
  assert.ok(d1.securityChallenge?.questionId, 'Expected random securityChallenge');

  const answer = answersMap[d1.securityChallenge.questionId];
  assert.ok(answer, `Missing answer for questionId=${d1.securityChallenge.questionId}`);

  const step2 = await fetch(`${baseUrl}/api/auth/verify-security-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken: d1.preAuthToken, answer }),
  });
  assert.strictEqual(step2.status, 200, `Expected 200 on step2 security question verify`);
  const d2 = await step2.json();
  return { step1: d1, step2: d2 };
}

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

function collectForbiddenSecretKeys(obj, prefix = '', found = []) {
  if (!obj || typeof obj !== 'object') return found;
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => collectForbiddenSecretKeys(item, `${prefix}[${idx}]`, found));
    return found;
  }
  const forbidden = new Set([
    'passwordHash',
    'password_hash',
    'passwordSalt',
    'password_salt',
    'pinHash',
    'pin_hash',
    'pinSalt',
    'pin_salt',
    'masterHash',
    'master_hash',
  ]);
  for (const [k, v] of Object.entries(obj)) {
    const nextPath = prefix ? `${prefix}.${k}` : k;
    if (forbidden.has(k) && v !== undefined && v !== null && v !== '') {
      found.push(nextPath);
    }
    if (v && typeof v === 'object') {
      collectForbiddenSecretKeys(v, nextPath, found);
    }
  }
  return found;
}

describe('AI Manager Supreme Role (Juan Orozco), Opción A & Live Process Controls Suite', () => {
  let server;
  let baseUrl;

  let aiManagerToken;
  let aiManagerId;
  let adminCiprianToken;
  let adminCiprianId;
  let secondAdminId;
  let secondAdminToken;
  let vendedorId;
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

    const ciprianLogin = await loginAdmin2FA(
      baseUrl,
      ADMIN_CIPRIAN_USER,
      ADMIN_CIPRIAN_PASS,
      ADMIN_CIPRIAN_PIN
    );
    adminCiprianToken = ciprianLogin.sessionToken;
    adminCiprianId = ciprianLogin.userId;
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

  describe('1. 2FA Random Cognitive Security Question Login for Juan Orozco (ai_manager)', () => {
    test('Succeeds with "JuanOrozco" AND "Juan Orozco" + PoloNorte121966@ -> random security question -> verifies answer, blocks wrong/replayed challenge, and manages question bank', async () => {
      const badPass = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'JuanOrozco', password: 'WrongPassword123!' }),
      });
      assert.strictEqual(badPass.status, 401);

      // Step 1 with "JuanOrozco" returns random security challenge (never sessionToken)
      const s1NoSpace = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'JuanOrozco', password: AI_MGR_PASS }),
      });
      assert.strictEqual(s1NoSpace.status, 200);
      const d1 = await s1NoSpace.json();
      assert.strictEqual(d1.ok, true);
      assert.strictEqual(d1.requiresPin, false);
      assert.strictEqual(d1.requiresSecurityQuestion, true);
      assert.strictEqual(d1.role, 'ai_manager');
      assert.strictEqual(d1.tag, 'AI-MANAGER');
      assert.strictEqual(d1.sessionToken, undefined);
      assert.ok(d1.preAuthToken);
      assert.ok(Object.prototype.hasOwnProperty.call(AI_SECURITY_ANSWERS, d1.securityChallenge.questionId));

      // Wrong answer -> 401
      const wrongAns = await fetch(`${baseUrl}/api/auth/verify-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: d1.preAuthToken, answer: 'respuesta-incorrecta' }),
      });
      assert.strictEqual(wrongAns.status, 401);

      // Correct answer (case & whitespace insensitive) -> 200 + sessionToken
      const correctAns = AI_SECURITY_ANSWERS[d1.securityChallenge.questionId];
      const okStep2 = await fetch(`${baseUrl}/api/auth/verify-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: d1.preAuthToken, answer: `  ${correctAns.toUpperCase()}  ` }),
      });
      assert.strictEqual(okStep2.status, 200);
      const v1 = await okStep2.json();
      assert.strictEqual(v1.ok, true);
      assert.strictEqual(v1.role, 'ai_manager');
      assert.strictEqual(typeof v1.sessionToken, 'string');

      // Anti-replay: reusing same preAuthToken must fail with 401 expiredFirstFactor
      const replayRes = await fetch(`${baseUrl}/api/auth/verify-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken: d1.preAuthToken, answer: correctAns }),
      });
      assert.strictEqual(replayRes.status, 401);
      assert.strictEqual((await replayRes.json()).expiredFirstFactor, true);

      // Login with space ("Juan Orozco") also succeeds full 2FA
      const { step2: v2 } = await loginAiManager2FA(baseUrl, 'Juan Orozco', AI_MGR_PASS);
      assert.strictEqual(v2.userId, v1.userId);
      assert.strictEqual(v2.role, 'ai_manager');

      aiManagerToken = v2.sessionToken;
      aiManagerId = v2.userId;
      assert.strictEqual(aiManagerId, 'ai-manager-juan');

      const sessRes = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${aiManagerToken}` },
      });
      assert.strictEqual(sessRes.status, 200);
      const sess = await sessRes.json();
      assert.strictEqual(sess.authenticated, true);
      assert.strictEqual(sess.role, 'ai_manager');
      assert.strictEqual(sess.userId, 'ai-manager-juan');

      // Randomization across pool: over 20 challenges, should observe >1 distinct question IDs
      const seenQuestions = new Set([d1.securityChallenge.questionId]);
      for (let i = 0; i < 18; i += 1) {
        const probe = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'JuanOrozco', password: AI_MGR_PASS }),
        });
        const pData = await probe.json();
        seenQuestions.add(pData.securityChallenge.questionId);
      }
      assert.ok(seenQuestions.size >= 2, `Expected randomized questions across pool, saw ${seenQuestions.size}`);

      // Security questions bank GET returns prompts ONLY (ZERO hashes) and blocks regular admin (403)
      const adminSqBlocked = await fetch(`${baseUrl}/api/ai-manager/security-questions`, {
        headers: { Authorization: `Bearer ${adminCiprianToken}` },
      });
      assert.strictEqual(adminSqBlocked.status, 403);

      const getSq = await fetch(`${baseUrl}/api/ai-manager/security-questions`, {
        headers: { Authorization: `Bearer ${aiManagerToken}` },
      });
      assert.strictEqual(getSq.status, 200);
      const sqPayload = await getSq.json();
      assert.strictEqual(sqPayload.questions.length, 5);
      for (const q of sqPayload.questions) {
        assert.strictEqual(q.hasAnswer, true);
        assert.strictEqual(q.answerHash, undefined);
        assert.strictEqual(q.answer, undefined);
      }

      // PUT enforces minimum 3 questions
      const tooFew = await fetch(`${baseUrl}/api/ai-manager/security-questions`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${aiManagerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: sqPayload.questions.slice(0, 2) }),
      });
      assert.strictEqual(tooFew.status, 400);
    });
  });

  describe('2. Zero-Password Supreme Authority', () => {
    test('ai_manager executes settings, gifts, accounts (incl. new admin), embajadores delete, lead downgrade+unlock, and master reset WITHOUT any password', async () => {
      const aiHeaders = {
        Authorization: `Bearer ${aiManagerToken}`,
        'Content-Type': 'application/json',
      };

      // A) PATCH /api/settings (no password)
      const setRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({ advisorName: 'Juan Orozco AI Studio' }),
      });
      assert.strictEqual(setRes.status, 200);
      assert.strictEqual((await setRes.json()).settings.advisorName, 'Juan Orozco AI Studio');

      // B) POST / PATCH / DELETE /api/gifts (no password)
      const createGift = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ name: 'Regalo Supremo AI', probability: 20 }),
      });
      assert.strictEqual(createGift.status, 201);
      const giftId = (await createGift.json()).gift.id;

      const patchGift = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({ name: 'Regalo Supremo Editado' }),
      });
      assert.strictEqual(patchGift.status, 200);

      const delGift = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'DELETE',
        headers: aiHeaders,
        body: JSON.stringify({}),
      });
      assert.strictEqual(delGift.status, 200);

      // C) POST / PATCH / DELETE /api/accounts (create admin + temp vendedor, no password)
      const createAdmin = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          username: 'KevinyKaren',
          displayName: 'Kevin y Karen',
          role: 'admin',
          tag: 'KEVIN-KAREN',
          password: 'KevinInitial2026!',
          confirmPassword: 'KevinInitial2026!',
          pin: '4821',
        }),
      });
      assert.strictEqual(createAdmin.status, 201);
      secondAdminId = (await createAdmin.json()).account.id;

      const kevinLogin = await loginAdmin2FA(baseUrl, 'KevinyKaren', 'KevinInitial2026!', '4821');
      secondAdminToken = kevinLogin.sessionToken;

      const createVend = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          username: 'vend_ai_test',
          displayName: 'Vendedor AI Test',
          role: 'vendedor',
          tag: 'VEND-AI-01',
          password: 'VendAiPass2026!',
          confirmPassword: 'VendAiPass2026!',
        }),
      });
      assert.strictEqual(createVend.status, 201);
      vendedorId = (await createVend.json()).account.id;

      const vendLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'vend_ai_test', password: 'VendAiPass2026!' }),
      });
      assert.strictEqual(vendLoginRes.status, 200);
      vendedorToken = (await vendLoginRes.json()).sessionToken;

      const createTemp = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          username: 'temp_ai_del',
          displayName: 'Temporal AI',
          role: 'vendedor',
          tag: 'TMP-AI-99',
          password: 'TempAiPass2026!',
          confirmPassword: 'TempAiPass2026!',
        }),
      });
      assert.strictEqual(createTemp.status, 201);
      const tempAccId = (await createTemp.json()).account.id;

      const patchTemp = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({ displayName: 'Temporal AI Editado' }),
      });
      assert.strictEqual(patchTemp.status, 200);

      const delTemp = await fetch(`${baseUrl}/api/accounts/${tempAccId}`, {
        method: 'DELETE',
        headers: aiHeaders,
        body: JSON.stringify({}),
      });
      assert.strictEqual(delTemp.status, 200);

      // Cannot delete own ai_manager account (400)
      const selfDel = await fetch(`${baseUrl}/api/accounts/${aiManagerId}`, {
        method: 'DELETE',
        headers: aiHeaders,
        body: JSON.stringify({}),
      });
      assert.strictEqual(selfDel.status, 400);

      // D) POST + DELETE /api/embajadores/:id (no password)
      const createEmb = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ name: 'Embajador AI', emoji: '👑', code: 'EMB-AI-01' }),
      });
      assert.strictEqual(createEmb.status, 201);
      const embId = (await createEmb.json()).referrer.id;

      const delEmb = await fetch(`${baseUrl}/api/embajadores/${embId}`, {
        method: 'DELETE',
        headers: aiHeaders,
        body: JSON.stringify({}),
      });
      assert.strictEqual(delEmb.status, 200);

      // E) PATCH /api/leads/:id downgrade orden -> cita + unlock sellerLocked WITHOUT password
      const createLead = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          name: 'Lead Supremo AI',
          phone: '555-880-1122',
          address: 'Miami, FL',
          acceptedTerms: true,
          referralCode: 'VEND-AI-01',
        }),
      });
      assert.strictEqual(createLead.status, 201);
      const leadId = (await createLead.json()).lead.id;

      // Vendedor closes & locks as orden
      const vendClose = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'orden',
          orderAmount: 5500,
          confirmLock: true,
        }),
      });
      assert.strictEqual(vendClose.status, 200);
      assert.strictEqual((await vendClose.json()).lead.sellerLocked, true);

      // ai_manager downgrades orden -> cita & unlocks sellerLocked WITHOUT any password
      const aiDowngrade = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({
          category: 'cita',
          sellerLocked: false,
        }),
      });
      assert.strictEqual(aiDowngrade.status, 200);
      const downgraded = (await aiDowngrade.json()).lead;
      assert.strictEqual(downgraded.category, 'cita');
      assert.strictEqual(downgraded.sellerLocked, false);

      // F) POST /api/admin/reset-all WITHOUT any password
      const aiReset = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ resetCatalogAndSettings: false }),
      });
      assert.strictEqual(aiReset.status, 200);
      assert.deepStrictEqual((await aiReset.json()).state.leads, []);
    });
  });

  describe('3. Strict Invisibility & Hierarchy Protection (Opción A)', () => {
    test('Regular admin sees ZERO rows for ai_manager or other admins; blocked (403 + critical alert) on /api/ai-manager/*, admin password changes, and tampering with ai-manager-juan', async () => {
      const adminHeaders = {
        Authorization: `Bearer ${adminCiprianToken}`,
        'Content-Type': 'application/json',
      };

      // A) Invisibility in GET /api/state and GET /api/accounts
      const [stateRes, accRes] = await Promise.all([
        fetch(`${baseUrl}/api/state`, { headers: adminHeaders }),
        fetch(`${baseUrl}/api/accounts`, { headers: adminHeaders }),
      ]);
      assert.strictEqual(stateRes.status, 200);
      assert.strictEqual(accRes.status, 200);
      const stateList = (await stateRes.json()).accounts;
      const accList = (await accRes.json()).accounts;

      for (const list of [stateList, accList]) {
        assert.strictEqual(list.some((a) => a.role === 'ai_manager'), false);
        assert.strictEqual(list.some((a) => a.id === aiManagerId), false);
        assert.strictEqual(list.some((a) => a.id === secondAdminId), false);
        const admins = list.filter((a) => a.role === 'admin');
        assert.strictEqual(admins.length, 1);
        assert.strictEqual(admins[0].id, adminCiprianId);
      }

      // B) Every /api/ai-manager/* route returns 403 for regular admin
      const aiManagerCalls = [
        { method: 'PATCH', path: '/api/ai-manager/process-controls', body: { publicFormEnabled: false } },
        { method: 'POST', path: `/api/ai-manager/accounts/${adminCiprianId}/credentials`, body: { newPassword: 'HackedPass2027!' } },
        { method: 'POST', path: `/api/ai-manager/accounts/${secondAdminId}/revoke-sessions`, body: {} },
        { method: 'GET', path: '/api/ai-manager/system-health' },
        { method: 'GET', path: '/api/ai-manager/export-backup' },
        { method: 'POST', path: '/api/ai-manager/alerts/purge', body: { scope: 'resolved' } },
        { method: 'POST', path: '/api/ai-manager/activity/clear', body: {} },
      ];
      for (const call of aiManagerCalls) {
        const res = await fetch(`${baseUrl}${call.path}`, {
          method: call.method,
          headers: adminHeaders,
          ...(call.body ? { body: JSON.stringify(call.body) } : {}),
        });
        assert.strictEqual(res.status, 403, `Expected 403 for admin calling ${call.method} ${call.path}`);
      }

      // C) Opción A: Regular admin CANNOT change own or other admin password/PIN (403)
      const admPwdRes = await fetch(`${baseUrl}/api/accounts/${adminCiprianId}/admin-password`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          securityKey: AI_MGR_PASS,
          confirmationPin: '1532',
          newPassword: 'BlockedChange2027!',
          confirmNewPassword: 'BlockedChange2027!',
        }),
      });
      assert.strictEqual(admPwdRes.status, 403);

      const updCredsRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          masterPassword: AI_MGR_PASS,
          confirmationPin: '1532',
          newPassword: 'BlockedChange2027!',
          confirmNewPassword: 'BlockedChange2027!',
        }),
      });
      assert.strictEqual(updCredsRes.status, 403);

      // D) Regular admin CANNOT PATCH or DELETE ai-manager-juan (403 + critical alert)
      const patchAiRes = await fetch(`${baseUrl}/api/accounts/${aiManagerId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
          adminPassword: ADMIN_CIPRIAN_PASS,
          displayName: 'Tampered AI Manager',
          active: false,
        }),
      });
      assert.strictEqual(patchAiRes.status, 403);

      const delAiRes = await fetch(`${baseUrl}/api/accounts/${aiManagerId}`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ adminPassword: ADMIN_CIPRIAN_PASS }),
      });
      assert.strictEqual(delAiRes.status, 403);

      // Verify critical rbac_unauthorized_attempt alerts recorded
      const alertsRes = await fetch(`${baseUrl}/api/security/alerts`, {
        headers: { Authorization: `Bearer ${aiManagerToken}` },
      });
      assert.strictEqual(alertsRes.status, 200);
      const { alerts } = await alertsRes.json();
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.severity === 'critical' &&
            a.metadata?.reason === 'ai_manager_route_denied'
        ),
        'Expected critical rbac_unauthorized_attempt alert for /api/ai-manager/* attempt'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.severity === 'critical' &&
            a.metadata?.targetAccountId === aiManagerId
        ),
        'Expected critical rbac_unauthorized_attempt alert for ai-manager-juan tampering'
      );
    });
  });

  describe('4. Admin Credential & Session Control', () => {
    test('ai_manager sees ALL admins, updates Admin password + 2FA PIN without password (revoking old token), and revokes sessions immediately', async () => {
      const aiHeaders = {
        Authorization: `Bearer ${aiManagerToken}`,
        'Content-Type': 'application/json',
      };

      // Sees ALL admins (AdminCiprian + KevinyKaren) + ai_manager
      const accRes = await fetch(`${baseUrl}/api/accounts`, { headers: aiHeaders });
      assert.strictEqual(accRes.status, 200);
      const { accounts } = await accRes.json();
      assert.ok(accounts.some((a) => a.username === ADMIN_CIPRIAN_USER));
      assert.ok(accounts.some((a) => a.username === 'KevinyKaren'));
      assert.ok(accounts.some((a) => a.role === 'ai_manager'));

      // Change KevinyKaren password AND 2FA PIN without password
      const oldKevinToken = secondAdminToken;
      const newKevinPass = 'KevinSupremeRotated2028!';
      const newKevinPin = '7391';
      const credRes = await fetch(`${baseUrl}/api/ai-manager/accounts/${secondAdminId}/credentials`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          newPassword: newKevinPass,
          newPin: newKevinPin,
        }),
      });
      assert.strictEqual(credRes.status, 200);

      // Old session immediately invalidated (401)
      const oldSess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${oldKevinToken}` },
      });
      assert.strictEqual(oldSess.status, 401);

      // Admin logs in with NEW password + NEW PIN
      const freshKevin = await loginAdmin2FA(baseUrl, 'KevinyKaren', newKevinPass, newKevinPin);
      secondAdminToken = freshKevin.sessionToken;

      const validKevinSess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${secondAdminToken}` },
      });
      assert.strictEqual(validKevinSess.status, 200);

      // Revoke sessions immediately invalidates target token (401)
      const revokeRes = await fetch(
        `${baseUrl}/api/ai-manager/accounts/${secondAdminId}/revoke-sessions`,
        {
          method: 'POST',
          headers: aiHeaders,
          body: JSON.stringify({}),
        }
      );
      assert.strictEqual(revokeRes.status, 200);

      const revokedSess = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${secondAdminToken}` },
      });
      assert.strictEqual(revokedSess.status, 401);

      // Revoked Bearer token on GET /api/state -> 401 SESSION_REVOKED
      const revokedStateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${secondAdminToken}` },
      });
      assert.strictEqual(revokedStateRes.status, 401);
      assert.strictEqual((await revokedStateRes.json()).code, 'SESSION_REVOKED');

      // Unauthenticated GET /api/state without Bearer still returns 200 public state
      const publicStateRes = await fetch(`${baseUrl}/api/state`);
      assert.strictEqual(publicStateRes.status, 200);
      const publicStateBody = await publicStateRes.json();
      assert.ok(Array.isArray(publicStateBody.gifts));
    });
  });

  describe('5. Live Process Controls (PATCH /api/ai-manager/process-controls)', () => {
    test('Pausing publicFormEnabled blocks public POST /api/leads (503 PUBLIC_FORM_DISABLED) while keeping admin/ai_manager manual lead creation working; toggles persist', async () => {
      const aiHeaders = {
        Authorization: `Bearer ${aiManagerToken}`,
        'Content-Type': 'application/json',
      };

      const pauseRes = await fetch(`${baseUrl}/api/ai-manager/process-controls`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({
          publicFormEnabled: false,
          publicFormDisabledTitle: 'Mantenimiento Programado VIP',
          publicFormDisabledMessage: 'Volvemos en unos minutos con sorpresas exclusivas.',
          welcomeVideoEnabled: false,
          qualificationQuizEnabled: false,
          giftRevealEnabled: false,
          clientGuardEnabled: false,
        }),
      });
      assert.strictEqual(pauseRes.status, 200);
      const pauseBody = await pauseRes.json();
      assert.strictEqual(pauseBody.processControls.publicFormEnabled, false);
      assert.strictEqual(pauseBody.processControls.welcomeVideoEnabled, false);
      assert.strictEqual(pauseBody.processControls.qualificationQuizEnabled, false);
      assert.strictEqual(pauseBody.processControls.giftRevealEnabled, false);
      assert.strictEqual(pauseBody.processControls.clientGuardEnabled, false);

      // Public GET /api/state reflects updated processControls
      const pubStateRes = await fetch(`${baseUrl}/api/state`);
      assert.strictEqual(pubStateRes.status, 200);
      const pubState = await pubStateRes.json();
      assert.strictEqual(pubState.settings.processControls.publicFormEnabled, false);
      assert.strictEqual(
        pubState.settings.processControls.publicFormDisabledTitle,
        'Mantenimiento Programado VIP'
      );
      assert.strictEqual(pubState.settings.processControls.welcomeVideoEnabled, false);
      assert.strictEqual(pubState.settings.processControls.qualificationQuizEnabled, false);
      assert.strictEqual(pubState.settings.processControls.giftRevealEnabled, false);
      assert.strictEqual(pubState.settings.processControls.clientGuardEnabled, false);

      // Public POST /api/leads returns 503 PUBLIC_FORM_DISABLED
      const pubLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invitado Bloqueado',
          phone: '555-901-0001',
          address: 'Dallas, TX',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(pubLeadRes.status, 503);
      const pubLeadErr = await pubLeadRes.json();
      assert.strictEqual(pubLeadErr.code, 'PUBLIC_FORM_DISABLED');

      // ai_manager manual lead creation STILL works (201)
      const aiLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          name: 'Lead Manual AI',
          phone: '555-901-0002',
          address: 'Dallas, TX',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(aiLeadRes.status, 201);

      // regular admin manual lead creation STILL works (201)
      const adminLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminCiprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Lead Manual Admin',
          phone: '555-901-0003',
          address: 'Houston, TX',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(adminLeadRes.status, 201);

      // Re-enable all controls
      const resumeRes = await fetch(`${baseUrl}/api/ai-manager/process-controls`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({
          publicFormEnabled: true,
          welcomeVideoEnabled: true,
          qualificationQuizEnabled: true,
          giftRevealEnabled: true,
          clientGuardEnabled: true,
        }),
      });
      assert.strictEqual(resumeRes.status, 200);
      assert.strictEqual((await resumeRes.json()).processControls.publicFormEnabled, true);
    });
  });

  describe('6. System Health, Zero-Secret Backup & Maintenance', () => {
    test('system-health returns accurate counts, export-backup leaks ZERO secrets, and alerts/purge + activity/clear work cleanly', async () => {
      const aiHeaders = {
        Authorization: `Bearer ${aiManagerToken}`,
        'Content-Type': 'application/json',
      };

      // A) GET /api/ai-manager/system-health
      const healthRes = await fetch(`${baseUrl}/api/ai-manager/system-health`, {
        headers: aiHeaders,
      });
      assert.strictEqual(healthRes.status, 200);
      const health = await healthRes.json();
      assert.strictEqual(health.storage, 'local');
      assert.strictEqual(typeof health.uptimeSeconds, 'number');
      assert.strictEqual(health.counts.aiManagers, 1);
      assert.strictEqual(health.counts.admins, 2);
      assert.ok(health.counts.leads >= 2);
      assert.strictEqual(health.processControls.publicFormEnabled, true);

      // B) GET /api/ai-manager/export-backup (ZERO secrets leaked)
      const backupRes = await fetch(`${baseUrl}/api/ai-manager/export-backup`, {
        headers: aiHeaders,
      });
      assert.strictEqual(backupRes.status, 200);
      const backup = await backupRes.json();
      assert.ok(Array.isArray(backup.accounts) && backup.accounts.length >= 4);
      assert.ok(Array.isArray(backup.leads) && backup.leads.length >= 2);
      assert.ok(Array.isArray(backup.gifts) && backup.gifts.length > 0);
      assert.strictEqual(backup.settings.pinCode, '');

      const leakedKeys = collectForbiddenSecretKeys(backup);
      assert.deepStrictEqual(
        leakedKeys,
        [],
        `Backup must NEVER leak secret keys/hashes; found: ${leakedKeys.join(', ')}`
      );

      // C) POST /api/ai-manager/alerts/purge (resolved, then all)
      const alertsBefore = (
        await (await fetch(`${baseUrl}/api/security/alerts`, { headers: aiHeaders })).json()
      ).alerts;
      assert.ok(alertsBefore.length > 0);

      // Mark one alert reviewed so 'resolved' purge removes it
      const reviewOne = await fetch(`${baseUrl}/api/security/alerts/${alertsBefore[0].id}`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({ status: 'reviewed' }),
      });
      assert.strictEqual(reviewOne.status, 200);

      const purgeResolved = await fetch(`${baseUrl}/api/ai-manager/alerts/purge`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ scope: 'resolved' }),
      });
      assert.strictEqual(purgeResolved.status, 200);
      const purgeResolvedBody = await purgeResolved.json();
      assert.strictEqual(purgeResolvedBody.ok, true);
      assert.ok(purgeResolvedBody.removed >= 1);

      const purgeAll = await fetch(`${baseUrl}/api/ai-manager/alerts/purge`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ scope: 'all' }),
      });
      assert.strictEqual(purgeAll.status, 200);
      const purgeAllBody = await purgeAll.json();
      assert.strictEqual(purgeAllBody.ok, true);
      assert.deepStrictEqual(purgeAllBody.state.securityAlerts, []);

      // D) POST /api/ai-manager/activity/clear
      const clearAct = await fetch(`${baseUrl}/api/ai-manager/activity/clear`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({}),
      });
      assert.strictEqual(clearAct.status, 200);
      const clearActBody = await clearAct.json();
      assert.strictEqual(clearActBody.ok, true);
      assert.ok(clearActBody.removed >= 1);
      assert.strictEqual(clearActBody.state.activityLogs.length, 1);
      assert.strictEqual(clearActBody.state.activityLogs[0].action, 'activity_cleared');
    });
  });

  describe('7. Embajador-to-Vendedor Reassignment (POST /api/ai-manager/embajadores/:id/reassign)', () => {
    let vendA;
    let vendAToken;
    let vendB;
    let vendBToken;
    let embajador;
    let extraQrId;
    let lead1Id;
    let lead2Id;

    test('Transfers Embajador, ALL historical leads, and ALL QRs cleanly from Vendedor A -> Vendedor B -> Ciprian Directo (null) with zero password, and blocks admin/vendedor with 403 + critical alert', async () => {
      resetFraudTrackers();
      const aiHeaders = {
        Authorization: `Bearer ${aiManagerToken}`,
        'Content-Type': 'application/json',
      };

      // 1. Create Vendedor A and Vendedor B
      const createVendA = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          username: 'vend_transfer_a',
          displayName: 'Vendedor Transfer A',
          role: 'vendedor',
          tag: 'TR-A01',
          password: 'VendTransferA2026!',
          confirmPassword: 'VendTransferA2026!',
        }),
      });
      assert.strictEqual(createVendA.status, 201);
      vendA = (await createVendA.json()).account;

      const loginARes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'vend_transfer_a', password: 'VendTransferA2026!' }),
      });
      assert.strictEqual(loginARes.status, 200);
      vendAToken = (await loginARes.json()).sessionToken;

      const createVendB = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({
          username: 'vend_transfer_b',
          displayName: 'Vendedor Transfer B',
          role: 'vendedor',
          tag: 'TR-B02',
          password: 'VendTransferB2026!',
          confirmPassword: 'VendTransferB2026!',
        }),
      });
      assert.strictEqual(createVendB.status, 201);
      vendB = (await createVendB.json()).account;

      const loginBRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'vend_transfer_b', password: 'VendTransferB2026!' }),
      });
      assert.strictEqual(loginBRes.status, 200);
      vendBToken = (await loginBRes.json()).sessionToken;

      // 2. Create Embajador under Vendedor A (with initial QR)
      const createEmbRes = await fetch(`${baseUrl}/api/embajadores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Sofía Embajadora Traspaso',
          emoji: '🌟',
          code: 'EMB-TRASPASO-01',
          targetUrl: 'https://royal.ciprian.example/',
          createQr: true,
        }),
      });
      assert.strictEqual(createEmbRes.status, 201);
      const embPayload = await createEmbRes.json();
      embajador = embPayload.referrer;
      assert.strictEqual(embajador.ownerVendedorAccountId, vendA.id);
      assert.ok(embPayload.qr && embPayload.qr.id, 'Expected initial QR created for Embajador');

      // 3. Create an extra QR for that Embajador
      const extraQrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Evento Extra Sofía',
          targetUrl: `https://royal.ciprian.example/?ref=${embajador.code}`,
          referrerId: embajador.id,
          referralCode: embajador.code,
          accountId: vendA.id,
        }),
      });
      assert.strictEqual(extraQrRes.status, 201);
      const extraQrBody = await extraQrRes.json();
      extraQrId = extraQrBody.qr?.id || extraQrBody.id;
      assert.ok(extraQrId, 'Expected extra QR id');

      // 4. Register 2 public leads via ?ref=<EMBAJADOR_CODE>
      const pubLead1 = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prospecto Embajador Uno',
          phone: '555-771-1001',
          address: 'Miami, FL',
          acceptedTerms: true,
          referralCode: embajador.code,
        }),
      });
      assert.strictEqual(pubLead1.status, 201);
      lead1Id = (await pubLead1.json()).lead.id;

      const pubLead2 = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prospecto Embajador Dos',
          phone: '555-771-1002',
          address: 'Orlando, FL',
          acceptedTerms: true,
          referralCode: embajador.code,
        }),
      });
      assert.strictEqual(pubLead2.status, 201);
      lead2Id = (await pubLead2.json()).lead.id;

      const isEmbQr = (q) => q.referrerId === embajador.id || q.referralCode === embajador.code;
      const isEmbLead = (l) => l.id === lead1Id || l.id === lead2Id;

      // 5. Verify pre-reassignment visibility: Vendedor A sees all, Vendedor B sees 0
      const [stateABefore, stateBBefore] = await Promise.all([
        fetch(`${baseUrl}/api/state`, { headers: { Authorization: `Bearer ${vendAToken}` } }).then((r) => r.json()),
        fetch(`${baseUrl}/api/state`, { headers: { Authorization: `Bearer ${vendBToken}` } }).then((r) => r.json()),
      ]);
      assert.strictEqual(stateABefore.leads.filter(isEmbLead).length, 2);
      assert.strictEqual(stateABefore.referrers.filter((r) => r.id === embajador.id).length, 1);
      assert.ok(stateABefore.qrHistory.filter(isEmbQr).length >= 2);

      assert.strictEqual(stateBBefore.leads.filter(isEmbLead).length, 0);
      assert.strictEqual(stateBBefore.referrers.filter((r) => r.id === embajador.id).length, 0);
      assert.strictEqual(stateBBefore.qrHistory.filter(isEmbQr).length, 0);

      // 6. ai_manager reassigns Embajador from Vendedor A -> Vendedor B (ZERO password!)
      const reassignToB = await fetch(`${baseUrl}/api/ai-manager/embajadores/${embajador.id}/reassign`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ targetVendedorAccountId: vendB.id }),
      });
      assert.strictEqual(reassignToB.status, 200);
      const reassignToBBody = await reassignToB.json();
      assert.strictEqual(reassignToBBody.ok, true);
      assert.strictEqual(reassignToBBody.movedLeadsCount, 2);
      assert.ok(reassignToBBody.movedQrsCount >= 2, `Expected movedQrsCount >= 2, got ${reassignToBBody.movedQrsCount}`);
      assert.strictEqual(reassignToBBody.referrer.ownerVendedorAccountId, vendB.id);
      assert.strictEqual(reassignToBBody.newOwnerName, 'Vendedor Transfer B');

      // 7. Verify immediately after reassignment: Vendedor A has 0, Vendedor B has ALL leads + Embajador + QRs
      const [stateAAfterB, stateBAfterB] = await Promise.all([
        fetch(`${baseUrl}/api/state`, { headers: { Authorization: `Bearer ${vendAToken}` } }).then((r) => r.json()),
        fetch(`${baseUrl}/api/state`, { headers: { Authorization: `Bearer ${vendBToken}` } }).then((r) => r.json()),
      ]);

      assert.strictEqual(stateAAfterB.leads.filter(isEmbLead).length, 0, 'Vendedor A must have 0 moved leads');
      assert.strictEqual(stateAAfterB.referrers.filter((r) => r.id === embajador.id).length, 0, 'Vendedor A must have 0 moved Embajador');
      assert.strictEqual(stateAAfterB.qrHistory.filter(isEmbQr).length, 0, 'Vendedor A must have 0 moved QRs');

      assert.strictEqual(stateBAfterB.leads.filter(isEmbLead).length, 2, 'Vendedor B must have ALL 2 leads');
      assert.strictEqual(stateBAfterB.referrers.filter((r) => r.id === embajador.id).length, 1, 'Vendedor B must have the Embajador');
      const vendBQrs = stateBAfterB.qrHistory.filter(isEmbQr);
      assert.ok(vendBQrs.length >= 2, 'Vendedor B must have ALL Embajador QRs');
      assert.ok(vendBQrs.every((q) => q.accountId === vendB.id), 'All transferred QRs must have accountId === vendB.id');

      // 8. Reassign Embajador to null (Ciprian Directo) -> Vendedor B sees 0, Admin & AI Manager still see all
      const reassignDirect = await fetch(`${baseUrl}/api/ai-manager/embajadores/${embajador.id}/reassign`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ targetVendedorAccountId: null }),
      });
      assert.strictEqual(reassignDirect.status, 200);
      const reassignDirectBody = await reassignDirect.json();
      assert.strictEqual(reassignDirectBody.ok, true);
      assert.strictEqual(reassignDirectBody.movedLeadsCount, 2);
      assert.ok(reassignDirectBody.movedQrsCount >= 2);
      assert.strictEqual(reassignDirectBody.referrer.ownerVendedorAccountId, null);
      assert.strictEqual(reassignDirectBody.newOwnerName, 'Ciprian Directo');

      const [stateBAfterNull, stateAdminAfterNull, stateAiAfterNull] = await Promise.all([
        fetch(`${baseUrl}/api/state`, { headers: { Authorization: `Bearer ${vendBToken}` } }).then((r) => r.json()),
        fetch(`${baseUrl}/api/state`, { headers: { Authorization: `Bearer ${adminCiprianToken}` } }).then((r) => r.json()),
        fetch(`${baseUrl}/api/state`, { headers: { Authorization: `Bearer ${aiManagerToken}` } }).then((r) => r.json()),
      ]);

      assert.strictEqual(stateBAfterNull.leads.filter(isEmbLead).length, 0, 'Vendedor B must have 0 leads after moving to Ciprian Directo');
      assert.strictEqual(stateBAfterNull.referrers.filter((r) => r.id === embajador.id).length, 0);
      assert.strictEqual(stateBAfterNull.qrHistory.filter(isEmbQr).length, 0);

      for (const elevatedState of [stateAdminAfterNull, stateAiAfterNull]) {
        assert.strictEqual(elevatedState.leads.filter(isEmbLead).length, 2);
        assert.strictEqual(elevatedState.referrers.filter((r) => r.id === embajador.id).length, 1);
        assert.ok(elevatedState.qrHistory.filter(isEmbQr).length >= 2);
      }

      // 9. Input validation guards: non-vendedor target (400) and unknown Embajador (404)
      const badTargetRes = await fetch(`${baseUrl}/api/ai-manager/embajadores/${embajador.id}/reassign`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ targetVendedorAccountId: adminCiprianId }),
      });
      assert.strictEqual(badTargetRes.status, 400);

      const missingEmbRes = await fetch(`${baseUrl}/api/ai-manager/embajadores/emb-does-not-exist/reassign`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ targetVendedorAccountId: vendA.id }),
      });
      assert.strictEqual(missingEmbRes.status, 404);

      // 10. RBAC enforcement: regular admin and vendedor receive 403 + critical rbac_unauthorized_attempt alert
      const adminAttempt = await fetch(`${baseUrl}/api/ai-manager/embajadores/${embajador.id}/reassign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminCiprianToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetVendedorAccountId: vendA.id }),
      });
      assert.strictEqual(adminAttempt.status, 403);

      const vendAttempt = await fetch(`${baseUrl}/api/ai-manager/embajadores/${embajador.id}/reassign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetVendedorAccountId: vendA.id }),
      });
      assert.strictEqual(vendAttempt.status, 403);

      const alertsRes = await fetch(`${baseUrl}/api/security/alerts`, {
        headers: { Authorization: `Bearer ${aiManagerToken}` },
      });
      assert.strictEqual(alertsRes.status, 200);
      const { alerts } = await alertsRes.json();
      const reassignDeniedAlerts = alerts.filter(
        (a) =>
          a.code === 'rbac_unauthorized_attempt' &&
          a.severity === 'critical' &&
          a.metadata?.reason === 'ai_manager_route_denied' &&
          String(a.metadata?.path || '').includes(`/embajadores/${embajador.id}/reassign`)
      );
      assert.ok(
        reassignDeniedAlerts.some((a) => a.actorRole === 'admin'),
        'Expected critical rbac_unauthorized_attempt alert for admin attempting reassignment'
      );
      assert.ok(
        reassignDeniedAlerts.some((a) => a.actorRole === 'vendedor'),
        'Expected critical rbac_unauthorized_attempt alert for vendedor attempting reassignment'
      );
    });
  });

  describe('8. Stealth Activity Logs (ai_manager Actions Invisible to Regular Admins)', () => {
    test('ai_manager sees BOTH ai_manager and admin activity logs; regular admin sees ZERO ai_manager logs across /api/state and /api/activity (including ?actorRole=ai_manager)', async () => {
      const aiHeaders = {
        Authorization: `Bearer ${aiManagerToken}`,
        'Content-Type': 'application/json',
      };
      const adminHeaders = {
        Authorization: `Bearer ${adminCiprianToken}`,
        'Content-Type': 'application/json',
      };

      // A) Perform multiple actions as ai_manager (processControls, settings, admin credentials — plus embajador_reassigned from Suite 7)
      const pcRes = await fetch(`${baseUrl}/api/ai-manager/process-controls`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({ welcomeVideoEnabled: false }),
      });
      assert.strictEqual(pcRes.status, 200);

      const setRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({ advisorName: 'Stealth Check Advisor' }),
      });
      assert.strictEqual(setRes.status, 200);

      const credRes = await fetch(`${baseUrl}/api/ai-manager/accounts/${secondAdminId}/credentials`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ newPin: '6428' }),
      });
      assert.strictEqual(credRes.status, 200);

      // Re-enable welcomeVideoEnabled to leave controls clean
      const pcRestore = await fetch(`${baseUrl}/api/ai-manager/process-controls`, {
        method: 'PATCH',
        headers: aiHeaders,
        body: JSON.stringify({ welcomeVideoEnabled: true }),
      });
      assert.strictEqual(pcRestore.status, 200);

      // B) Perform actions as regular admin (create lead + update lead status)
      const adminLeadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Lead Visible Para Admin',
          phone: '555-772-2001',
          address: 'Tampa, FL',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(adminLeadRes.status, 201);
      const adminLeadId = (await adminLeadRes.json()).lead.id;

      const adminPatchLead = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ category: 'cita' }),
      });
      assert.strictEqual(adminPatchLead.status, 200);

      // C) Verify ai_manager sees BOTH ai_manager (incl. embajador_reassigned) AND admin actions
      const [aiStateRes, aiActivityRes, aiActivityOnlyRes] = await Promise.all([
        fetch(`${baseUrl}/api/state`, { headers: aiHeaders }),
        fetch(`${baseUrl}/api/activity`, { headers: aiHeaders }),
        fetch(`${baseUrl}/api/activity?actorRole=ai_manager`, { headers: aiHeaders }),
      ]);
      assert.strictEqual(aiStateRes.status, 200);
      assert.strictEqual(aiActivityRes.status, 200);
      assert.strictEqual(aiActivityOnlyRes.status, 200);

      const aiStateLogs = (await aiStateRes.json()).activityLogs;
      const aiActivityBody = await aiActivityRes.json();
      const aiActivityEntries = aiActivityBody.entries;
      const aiOnlyEntries = (await aiActivityOnlyRes.json()).entries;

      for (const feed of [aiStateLogs, aiActivityEntries]) {
        assert.ok(
          feed.some((e) => e.actorRole === 'ai_manager' && e.action === 'embajador_reassigned'),
          'ai_manager must see embajador_reassigned in activity logs'
        );
        assert.ok(
          feed.some((e) => e.actorRole === 'ai_manager'),
          'ai_manager must see ai_manager actions'
        );
        assert.ok(
          feed.some((e) => e.actorRole === 'admin' && e.targetId === adminLeadId),
          'ai_manager must also see admin actions'
        );
      }
      assert.ok(aiOnlyEntries.length >= 4, 'ai_manager ?actorRole=ai_manager must return ai_manager entries');
      assert.ok(aiOnlyEntries.every((e) => e.actorRole === 'ai_manager'));

      // D) Verify regular admin sees ZERO ai_manager entries anywhere (while still seeing normal admin/public/vendedor entries)
      const [adminStateRes, adminActivityRes, adminQueryAiRes, adminSearchReassignRes] = await Promise.all([
        fetch(`${baseUrl}/api/state`, { headers: adminHeaders }),
        fetch(`${baseUrl}/api/activity`, { headers: adminHeaders }),
        fetch(`${baseUrl}/api/activity?actorRole=ai_manager`, { headers: adminHeaders }),
        fetch(`${baseUrl}/api/activity?search=reasign`, { headers: adminHeaders }),
      ]);
      assert.strictEqual(adminStateRes.status, 200);
      assert.strictEqual(adminActivityRes.status, 200);
      assert.strictEqual(adminQueryAiRes.status, 200);
      assert.strictEqual(adminSearchReassignRes.status, 200);

      const adminStateLogs = (await adminStateRes.json()).activityLogs;
      const adminActivityBody = await adminActivityRes.json();
      const adminQueryAiBody = await adminQueryAiRes.json();
      const adminSearchReassignBody = await adminSearchReassignRes.json();

      for (const feed of [adminStateLogs, adminActivityBody.entries, adminActivityBody.logs]) {
        assert.ok(Array.isArray(feed) && feed.length > 0, 'Admin must still see non-AI operational activity');
        assert.strictEqual(
          feed.every(
            (e) =>
              e.actorRole !== 'ai_manager' &&
              e.actorId !== 'ai-manager-juan' &&
              e.actorTag !== 'AI-MANAGER'
          ),
          true,
          'Regular admin must NEVER see any ai_manager activity log entries'
        );
        assert.strictEqual(
          feed.some((e) => e.action === 'embajador_reassigned'),
          false,
          'Regular admin must NEVER see embajador_reassigned performed by ai_manager'
        );
        assert.ok(
          feed.some((e) => e.actorRole === 'admin' && e.targetId === adminLeadId),
          'Regular admin must still see normal admin activity entries'
        );
      }

      assert.strictEqual(adminQueryAiBody.total, 0);
      assert.deepStrictEqual(adminQueryAiBody.entries, []);
      assert.deepStrictEqual(adminQueryAiBody.logs, []);

      assert.strictEqual(adminSearchReassignBody.total, 0);
      assert.deepStrictEqual(adminSearchReassignBody.entries, []);
    });
  });
});
