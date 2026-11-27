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
  `royal-activity-prog-store-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-activity-prog-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const MASTER_KEY = 'PoloNorte121966@';
const ADMIN_DEFAULT_PASSWORD = 'AdminMaster2026@';
const SECOND_ADMIN_PASSWORD = 'KevinKarenPass2026@';
const SECOND_ADMIN_PIN = '4321';

const {
  default: app,
  normalizeActivityLogRecord,
  mapActivityLogRow,
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

describe('Forward-Free / Backward-Protected Progression & Operational Activity Log Suite', () => {
  let server;
  let baseUrl;
  let admin1Token;
  let admin2Token;
  let teleToken;
  let vendedorToken;
  let vendedorAccount;

  before(async () => {
    resetFraudTrackers();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    admin1Token = await loginAdmin(baseUrl);
    teleToken = await loginDirect(baseUrl, 'Telemarketing', 'UsuCa2026@');

    // Create a second Admin account (Kevin y Karen) via logged-in Admin's own password + PIN
    const createAdmin2 = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${admin1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminPassword: ADMIN_DEFAULT_PASSWORD,
        username: 'KevinKaren',
        displayName: 'Kevin y Karen',
        role: 'admin',
        tag: 'KEVIN-KAREN',
        password: SECOND_ADMIN_PASSWORD,
        confirmPassword: SECOND_ADMIN_PASSWORD,
        pin: SECOND_ADMIN_PIN,
      }),
    });
    assert.strictEqual(createAdmin2.status, 201);
    admin2Token = await loginAdmin(baseUrl, 'KevinKaren', SECOND_ADMIN_PASSWORD, SECOND_ADMIN_PIN);

    // Create a Vendedor account
    const createVend = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${admin1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminPassword: ADMIN_DEFAULT_PASSWORD,
        username: 'sofia_ventas',
        displayName: 'Sofía Ventas',
        role: 'vendedor',
        tag: 'SOFIA-01',
        password: 'SofiaPassword1!',
        confirmPassword: 'SofiaPassword1!',
      }),
    });
    assert.strictEqual(createVend.status, 201);
    vendedorAccount = (await createVend.json()).account;
    vendedorToken = await loginDirect(baseUrl, 'sofia_ventas', 'SofiaPassword1!');
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

  describe('1. Schema & Activity Log Normalization Helpers', () => {
    test('supabase/schema.sql defines public.activity_logs with indexes, RLS, revoke all, and service_role policy', () => {
      const schemaSql = fs.readFileSync(path.join(PROJECT_ROOT, 'supabase', 'schema.sql'), 'utf8');
      assert.match(schemaSql, /create table if not exists public\.activity_logs/i);
      assert.match(schemaSql, /activity_logs_created_at_idx/i);
      assert.match(schemaSql, /activity_logs_category_idx/i);
      assert.match(schemaSql, /activity_logs_action_idx/i);
      assert.match(schemaSql, /alter table public\.activity_logs enable row level security/i);
      assert.match(schemaSql, /revoke all on table public\.activity_logs from anon, authenticated, public/i);
      assert.match(schemaSql, /activity_logs_service_only/i);
    });

    test('normalizeActivityLogRecord & mapActivityLogRow validate contract and reject unknown actions', () => {
      assert.strictEqual(normalizeActivityLogRecord({ action: 'unknown_action' }), null);

      const mapped = mapActivityLogRow({
        id: 'act-001',
        action: 'lead_status_advanced',
        category: 'status',
        actor_role: 'vendedor',
        actor_id: 'usr-1',
        actor_name: 'Sofía Ventas',
        actor_username: 'sofia_ventas',
        actor_tag: 'SOFIA-01',
        summary: 'Sofía avanzó a Cita',
        from_state: 'Sin clasificar',
        to_state: 'Cita',
        target_type: 'lead',
        target_id: 'lead-1',
        target_label: 'Cliente Prueba (OTN-1001)',
        metadata: { fromCategory: 'none', toCategory: 'cita', orderAmount: null },
        created_at: '2026-11-26T12:00:00.000Z',
      });
      assert.ok(mapped);
      assert.strictEqual(mapped.id, 'act-001');
      assert.strictEqual(mapped.action, 'lead_status_advanced');
      assert.strictEqual(mapped.category, 'status');
      assert.strictEqual(mapped.actorRole, 'vendedor');
      assert.strictEqual(mapped.actorName, 'Sofía Ventas');
      assert.strictEqual(mapped.actorTag, 'SOFIA-01');
      assert.strictEqual(mapped.fromState, 'Sin clasificar');
      assert.strictEqual(mapped.toState, 'Cita');
      assert.strictEqual(mapped.targetType, 'lead');
      assert.strictEqual(mapped.targetId, 'lead-1');
    });
  });

  describe('2. Vendedor Forward-Free Progression (none -> cita -> demo -> orden) & Backward Block', () => {
    let leadStepId;
    let leadJumpId;
    let leadReposoId;

    before(async () => {
      const createLead = async (name, phone) => {
        const r = await fetch(`${baseUrl}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone,
            address: 'Dallas, TX',
            acceptedTerms: true,
            referralCode: 'SOFIA-01',
          }),
        });
        assert.strictEqual(r.status, 201);
        return (await r.json()).lead.id;
      };

      leadStepId = await createLead('Prospecto Escalera', '555-910-1001');
      leadJumpId = await createLead('Prospecto Salto', '555-910-1002');
      leadReposoId = await createLead('Prospecto En Reposo', '555-910-1003');
    });

    test('Telemarketing scheduled & not_scheduled actions are logged with operator name and states', async () => {
      const s1 = await fetch(`${baseUrl}/api/leads/${leadStepId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'scheduled' }),
      });
      assert.strictEqual(s1.status, 200);

      const s2 = await fetch(`${baseUrl}/api/leads/${leadJumpId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'scheduled' }),
      });
      assert.strictEqual(s2.status, 200);

      const r1 = await fetch(`${baseUrl}/api/leads/${leadReposoId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'not_scheduled' }),
      });
      assert.strictEqual(r1.status, 200);

      const actRes = await fetch(`${baseUrl}/api/activity`, {
        headers: { Authorization: `Bearer ${admin1Token}` },
      });
      assert.strictEqual(actRes.status, 200);
      const { logs } = await actRes.json();

      const scheduledLog = logs.find(
        (e) => e.action === 'telemarketing_called' && e.targetId === leadStepId
      );
      assert.ok(scheduledLog, 'Expected telemarketing_called log for scheduled lead');
      assert.strictEqual(scheduledLog.actorRole, 'telemarketing');
      assert.strictEqual(scheduledLog.actorName, 'Telemarketing');
      assert.strictEqual(scheduledLog.fromState, 'Pendiente');
      assert.strictEqual(scheduledLog.toState, 'Agendado');

      const reposoLog = logs.find(
        (e) => e.action === 'telemarketing_called' && e.targetId === leadReposoId
      );
      assert.ok(reposoLog, 'Expected telemarketing_called log for not_scheduled lead');
      assert.strictEqual(reposoLog.fromState, 'Pendiente');
      assert.strictEqual(reposoLog.toState, 'En Reposo');
    });

    test('Vendedor advances none -> cita -> demo -> orden WITHOUT password and every transition is logged', async () => {
      // none -> cita (without confirmLock)
      const toCita = await fetch(`${baseUrl}/api/leads/${leadStepId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', notes: 'Cita confirmada lunes 6pm' }),
      });
      assert.strictEqual(toCita.status, 200);
      const citaData = await toCita.json();
      assert.strictEqual(citaData.lead.category, 'cita');
      assert.strictEqual(citaData.lead.sellerLocked, true);
      assert.strictEqual(citaData.lead.promoCodeInvalidated, true);
      const firstInvalidatedAt = citaData.lead.promoCodeInvalidatedAt;
      assert.ok(firstInvalidatedAt);

      // cita -> demo (without password)
      const toDemo = await fetch(`${baseUrl}/api/leads/${leadStepId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo', notes: 'Demo en casa realizada', confirmLock: true }),
      });
      assert.strictEqual(toDemo.status, 200);
      const demoData = await toDemo.json();
      assert.strictEqual(demoData.lead.category, 'demo');
      assert.strictEqual(demoData.lead.promoCodeInvalidatedAt, firstInvalidatedAt);

      // Blocked downgrade demo -> cita without Admin password -> 403 ADMIN_PASSWORD_REQUIRED
      const demoToCita = await fetch(`${baseUrl}/api/leads/${leadStepId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita' }),
      });
      assert.strictEqual(demoToCita.status, 403);
      assert.strictEqual((await demoToCita.json()).code, 'ADMIN_PASSWORD_REQUIRED');

      // demo -> orden (without password)
      const toOrden = await fetch(`${baseUrl}/api/leads/${leadStepId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 3650, notes: 'Cerró paquete familiar' }),
      });
      assert.strictEqual(toOrden.status, 200);
      const ordenData = await toOrden.json();
      assert.strictEqual(ordenData.lead.category, 'orden');
      assert.strictEqual(ordenData.lead.orderAmount, 3650);
      assert.strictEqual(ordenData.lead.sellerConfirmedBy, 'sofia_ventas');

      // Direct forward jumps: none -> demo -> orden on leadJumpId
      const jumpDemo = await fetch(`${baseUrl}/api/leads/${leadJumpId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vendedorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo' }),
      });
      assert.strictEqual(jumpDemo.status, 200);

      // Verify vendedor is blocked from downgrades and reverting to none without Admin password (403 ADMIN_PASSWORD_REQUIRED),
      // while same-rank edits (orden -> orden) are allowed cleanly (200) per Opción A
      for (const [targetCat, expectedStatus] of [
        ['demo', 403],
        ['cita', 403],
        ['orden', 200],
        ['none', 403],
      ]) {
        const res = await fetch(`${baseUrl}/api/leads/${leadStepId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${vendedorToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category: targetCat }),
        });
        assert.strictEqual(
          res.status,
          expectedStatus,
          `Expected ${expectedStatus} when vendedor attempts orden -> ${targetCat}`
        );
      }

      // Verify activity logs captured every forward transition with actor & fromState -> toState
      const { logs } = await (
        await fetch(`${baseUrl}/api/activity`, {
          headers: { Authorization: `Bearer ${admin1Token}` },
        })
      ).json();
      const stepLogs = logs.filter(
        (e) => e.action === 'lead_status_advanced' && e.targetId === leadStepId
      );
      assert.strictEqual(stepLogs.length, 3);
      assert.ok(
        stepLogs.some(
          (e) =>
            e.actorRole === 'vendedor' &&
            e.actorName === 'Sofía Ventas' &&
            e.actorTag === 'SOFIA-01' &&
            e.fromState === 'Sin clasificar' &&
            e.toState === 'Cita'
        )
      );
      assert.ok(stepLogs.some((e) => e.fromState === 'Cita' && e.toState === 'Demo'));
      assert.ok(
        stepLogs.some(
          (e) => e.fromState === 'Demo' && e.toState === 'Orden' && e.metadata?.orderAmount === 3650
        )
      );

      // Verify rbac_unauthorized_attempt alerts were recorded for blocked downgrades
      const { alerts } = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${admin1Token}` },
        })
      ).json();
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'rbac_unauthorized_attempt' &&
            a.actorRole === 'vendedor' &&
            a.leadId === leadStepId &&
            a.metadata?.reason === 'vendedor_locked_lead_attempt'
        ),
        'Expected rbac_unauthorized_attempt alert for vendedor downgrade attempt'
      );
    });
  });

  describe('3. Admin Forward-Free Advancement & Own-Password Downgrade Protection (Multi-Admin)', () => {
    let adminLeadId;

    before(async () => {
      const r = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Prospecto Control Admin',
          phone: '555-920-2001',
          address: 'Houston, TX',
          acceptedTerms: true,
          referralCode: 'SOFIA-01',
        }),
      });
      assert.strictEqual(r.status, 201);
      adminLeadId = (await r.json()).lead.id;

      // Mark scheduled so it can be classified
      const sched = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callOutcome: 'scheduled' }),
      });
      assert.strictEqual(sched.status, 200);
    });

    test('Admin advances none -> cita -> demo -> orden WITHOUT password; downgrades require logged-in Admin own password (or Master Key)', async () => {
      // Admin advances none -> cita -> demo -> orden with NO password
      for (const payload of [
        { category: 'cita' },
        { category: 'demo' },
        { category: 'orden', orderAmount: 4100 },
      ]) {
        const res = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${admin1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.lead.category, payload.category);
        assert.strictEqual(body.lead.sellerLocked, true);
        assert.strictEqual(body.lead.promoCodeInvalidated, true);
      }

      // Downgrade orden -> demo WITHOUT password -> 403
      const noPwdDown = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo' }),
      });
      assert.strictEqual(noPwdDown.status, 403);

      // Admin 1 attempting downgrade with Admin 2's password -> 403
      const otherAdminPwd = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo', adminPassword: SECOND_ADMIN_PASSWORD }),
      });
      assert.strictEqual(otherAdminPwd.status, 403);

      // Admin 1 downgrades orden -> demo WITH Admin 1's own password -> 200
      const downToDemo = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo', adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(downToDemo.status, 200);
      const downDemoBody = await downToDemo.json();
      assert.strictEqual(downDemoBody.lead.category, 'demo');
      assert.strictEqual(downDemoBody.lead.orderAmount, null);
      assert.strictEqual(downDemoBody.lead.sellerLocked, true);
      assert.strictEqual(downDemoBody.lead.promoCodeInvalidated, true);

      // Admin 2 (Kevin y Karen) attempting demo -> cita with Admin 1's password -> 403
      const a2WrongPwd = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(a2WrongPwd.status, 403);

      // Admin 2 (Kevin y Karen) downgrades demo -> cita WITH Admin 2's OWN password -> 200
      const a2DownOk = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', adminPassword: SECOND_ADMIN_PASSWORD }),
      });
      assert.strictEqual(a2DownOk.status, 200);
      const a2Body = await a2DownOk.json();
      assert.strictEqual(a2Body.lead.category, 'cita');
      assert.strictEqual(a2Body.lead.sellerLocked, true);
      assert.strictEqual(a2Body.lead.promoCodeInvalidated, true);

      // Master Key MUST be rejected on operational lead unlock/downgrade -> 403
      const masterUnlockRejected = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'none',
          sellerLocked: false,
          promoCodeInvalidated: false,
          adminPassword: MASTER_KEY,
        }),
      });
      assert.strictEqual(masterUnlockRejected.status, 403);

      // Full revert cita -> none & unlock using Admin 2's OWN password -> 200
      const selfUnlock = await fetch(`${baseUrl}/api/leads/${adminLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'none',
          sellerLocked: false,
          promoCodeInvalidated: false,
          adminPassword: SECOND_ADMIN_PASSWORD,
        }),
      });
      assert.strictEqual(selfUnlock.status, 200);
      const unlockedBody = await selfUnlock.json();
      assert.strictEqual(unlockedBody.lead.category, 'none');
      assert.strictEqual(unlockedBody.lead.sellerLocked, false);
      assert.strictEqual(unlockedBody.lead.promoCodeInvalidated, false);

      // Check activity logs contain lead_status_reverted entries with accurate actors & transitions
      const { logs } = await (
        await fetch(`${baseUrl}/api/activity`, {
          headers: { Authorization: `Bearer ${admin1Token}` },
        })
      ).json();
      const revertLogs = logs.filter(
        (e) => e.action === 'lead_status_reverted' && e.targetId === adminLeadId
      );
      assert.strictEqual(revertLogs.length, 3);
      assert.ok(
        revertLogs.some(
          (e) =>
            e.actorName === 'Administrador Ciprian' &&
            e.fromState === 'Orden' &&
            e.toState === 'Demo'
        )
      );
      assert.ok(
        revertLogs.some(
          (e) =>
            e.actorName === 'Kevin y Karen' &&
            e.fromState === 'Demo' &&
            e.toState === 'Cita'
        )
      );
      assert.ok(
        revertLogs.some(
          (e) =>
            e.actorName === 'Kevin y Karen' &&
            e.fromState === 'Cita' &&
            e.toState === 'Sin clasificar'
        )
      );
    });
  });

  describe('4. Strict RBAC Isolation & Operational Activity Coverage', () => {
    test('GET /api/activity and state.activityLogs are STRICTLY Admin-only (401/403 & omitted for public/telemarketing/vendedor)', async () => {
      // Public
      const pubState = await (await fetch(`${baseUrl}/api/state`)).json();
      assert.strictEqual(pubState.activityLogs, undefined);
      const pubAct = await fetch(`${baseUrl}/api/activity`);
      assert.strictEqual(pubAct.status, 401);

      // Telemarketing
      const teleState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${teleToken}` },
        })
      ).json();
      assert.strictEqual(teleState.activityLogs, undefined);
      const teleAct = await fetch(`${baseUrl}/api/activity`, {
        headers: { Authorization: `Bearer ${teleToken}` },
      });
      assert.strictEqual(teleAct.status, 403);

      // Vendedor
      const vendState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${vendedorToken}` },
        })
      ).json();
      assert.strictEqual(vendState.activityLogs, undefined);
      const vendAct = await fetch(`${baseUrl}/api/activity`, {
        headers: { Authorization: `Bearer ${vendedorToken}` },
      });
      assert.strictEqual(vendAct.status, 403);

      // Admin
      const adminState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${admin1Token}` },
        })
      ).json();
      assert.ok(Array.isArray(adminState.activityLogs) && adminState.activityLogs.length > 0);
      const adminAct = await fetch(`${baseUrl}/api/activity`, {
        headers: { Authorization: `Bearer ${admin1Token}` },
      });
      assert.strictEqual(adminAct.status, 200);
      const adminActBody = await adminAct.json();
      assert.strictEqual(adminActBody.ok, true);
      assert.ok(Array.isArray(adminActBody.logs) && adminActBody.logs.length > 0);
    });

    test('All operational actions (QR, gifts, settings, alerts, accounts, reset) record clear Spanish activity logs', async () => {
      // QR create + delete
      const qrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Expo Dallas',
          targetUrl: 'https://ciprian.example.com/',
          accountId: vendedorAccount.id,
        }),
      });
      assert.strictEqual(qrRes.status, 201);
      const qrId = (await qrRes.json()).qr.id;

      const qrDel = await fetch(`${baseUrl}/api/qr/${qrId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin1Token}` },
      });
      assert.strictEqual(qrDel.status, 200);

      // Settings update (uses logged-in Admin's own password)
      const setRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showcaseStyle: 'royal-ember', adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(setRes.status, 200);

      // Gift create (uses logged-in Admin's own password)
      const giftRes = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Set Gourmet Prueba', probability: 15, adminPassword: ADMIN_DEFAULT_PASSWORD }),
      });
      assert.strictEqual(giftRes.status, 201);

      // Security alert update
      const { alerts } = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${admin1Token}` },
        })
      ).json();
      assert.ok(alerts.length > 0);
      const alertUpd = await fetch(`${baseUrl}/api/security/alerts/${alerts[0].id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'reviewed', reviewNote: 'Auditado' }),
      });
      assert.strictEqual(alertUpd.status, 200);

      // Master reset (uses logged-in Admin's own password)
      const resetRes = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD, resetCatalogAndSettings: false }),
      });
      assert.strictEqual(resetRes.status, 200);

      const { logs } = await (
        await fetch(`${baseUrl}/api/activity`, {
          headers: { Authorization: `Bearer ${admin1Token}` },
        })
      ).json();

      const recordedActions = new Set(logs.map((l) => l.action));
      for (const expectedAction of [
        'account_created',
        'lead_created',
        'telemarketing_called',
        'lead_status_advanced',
        'lead_status_reverted',
        'lead_updated',
        'qr_created',
        'qr_deleted',
        'settings_updated',
        'gift_changed',
        'security_alert_updated',
        'master_reset',
      ]) {
        assert.ok(
          recordedActions.has(expectedAction),
          `Expected activity log action "${expectedAction}" to be recorded`
        );
      }
    });
  });
});
