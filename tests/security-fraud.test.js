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
  `royal-security-fraud-store-${process.pid}-${Date.now()}.json`
);
const TEST_AUTH_FILE = path.join(
  os.tmpdir(),
  `royal-security-fraud-auth-${process.pid}-${Date.now()}.json`
);
process.env.NODE_ENV = 'test';
process.env.TEST_STORE_PATH = TEST_STORE_FILE;
process.env.TEST_AUTH_PATH = TEST_AUTH_FILE;

const MASTER_KEY = 'PoloNorte121966@';
const ADMIN_DEFAULT_PASSWORD = 'AdminMaster2026@';

const {
  default: app,
  normalizePhoneKey,
  maskPhone,
  maskIp,
  detectSuspiciousPhonePattern,
  normalizeSecurityAlertRecord,
  mapSecurityAlertRow,
  resetFraudTrackers,
} = await import('../server/index.js');

async function loginAdmin(baseUrl) {
  const step1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'AdminCiprian', password: 'AdminMaster2026@' }),
  });
  assert.strictEqual(step1.status, 200);
  const d1 = await step1.json();
  const step2 = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken: d1.preAuthToken, pin: '1966' }),
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

describe('Anti-Fraud Engine, Canonical Phone Deduplication & Security Center Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let teleToken;
  let carlosToken;
  let mariaToken;

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

    // Create 2 vendedor accounts for cross-referral and seller fraud tests
    for (const acc of [
      {
        username: 'carlos_sec',
        displayName: 'Carlos Seguridad',
        tag: 'CARLOS-SEC',
        password: 'CarlosPassword1!',
      },
      {
        username: 'maria_sec',
        displayName: 'María Seguridad',
        tag: 'MARIA-SEC',
        password: 'MariaPassword1!',
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

    carlosToken = await loginDirect(baseUrl, 'carlos_sec', 'CarlosPassword1!');
    mariaToken = await loginDirect(baseUrl, 'maria_sec', 'MariaPassword1!');
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
        // Ignore cleanup errors
      }
    }
  });

  describe('1. Unit Helpers & Supabase SQL Schema Contract', () => {
    test('normalizePhoneKey, maskPhone, maskIp & detectSuspiciousPhonePattern work accurately', () => {
      assert.strictEqual(normalizePhoneKey('+1 (555) 234-5678'), '5552345678');
      assert.strictEqual(normalizePhoneKey('555-234-5678'), '5552345678');
      assert.strictEqual(normalizePhoneKey('5552345678'), '5552345678');
      assert.strictEqual(normalizePhoneKey('1-555.234.5678'), '5552345678');
      assert.strictEqual(normalizePhoneKey(''), '');

      assert.strictEqual(maskPhone('+1 (555) 234-5678'), '***-***-5678');
      assert.strictEqual(maskPhone('5552345678'), '***-***-5678');
      assert.strictEqual(maskPhone(''), null);

      assert.strictEqual(maskIp('203.0.113.42'), '203.0.***.42');
      assert.strictEqual(maskIp('::ffff:198.51.100.9'), '198.51.***.9');
      assert.strictEqual(maskIp('2001:db8::1'), '2001:db8:***');
      assert.strictEqual(maskIp(''), null);

      assert.strictEqual(detectSuspiciousPhonePattern('0000000000', 'Ana Test', []).suspicious, true);
      assert.strictEqual(detectSuspiciousPhonePattern('111-111-1111', 'Ana Test', []).suspicious, true);
      assert.strictEqual(detectSuspiciousPhonePattern('555-888-8888', 'Ana Test', []).suspicious, true);
      assert.strictEqual(detectSuspiciousPhonePattern('123-456-7890', 'Ana Test', []).suspicious, true);
      assert.strictEqual(detectSuspiciousPhonePattern('012-345-6789', 'Ana Test', []).suspicious, true);
      assert.strictEqual(detectSuspiciousPhonePattern('987-654-3210', 'Ana Test', []).suspicious, true);
      assert.strictEqual(detectSuspiciousPhonePattern('555-234-5678', 'Ana Real', []).suspicious, false);

      const dupNameCheck = detectSuspiciousPhonePattern('555-908-1234', 'Ana Real', [
        { id: 'lead-1', name: '  ana   real ', phone: '555-234-5678', claimCode: 'OTN-1000' },
      ]);
      assert.strictEqual(dupNameCheck.suspicious, true);
      assert.strictEqual(dupNameCheck.reason, 'duplicate_name_different_phone');

      const mapped = mapSecurityAlertRow({
        id: 'sec-1',
        code: 'duplicate_phone_attempt',
        severity: 'critical',
        category: 'qr_abuse',
        status: 'open',
        title: 'Duplicado',
        description: 'Detalle',
        actor_role: 'public',
        phone_masked: '***-***-5678',
        ip_masked: '203.0.***.42',
        referral_code: 'carlos-sec',
        metadata: { repeatAttempt: true },
        created_at: '2026-11-26T00:00:00.000Z',
      });
      assert.strictEqual(mapped.id, 'sec-1');
      assert.strictEqual(mapped.referralCode, 'CARLOS-SEC');
      assert.strictEqual(mapped.metadata.repeatAttempt, true);
      assert.strictEqual(normalizeSecurityAlertRecord({ code: 'invalid_code' }), null);
    });

    test('supabase/schema.sql defines public.security_alerts with indexes and service_role RLS', () => {
      const schemaSql = fs.readFileSync(path.join(PROJECT_ROOT, 'supabase', 'schema.sql'), 'utf8');
      assert.match(schemaSql, /create table if not exists public\.security_alerts/i);
      assert.match(schemaSql, /security_alerts_created_at_idx/i);
      assert.match(schemaSql, /security_alerts_status_idx/i);
      assert.match(schemaSql, /alter table public\.security_alerts enable row level security/i);
      assert.match(schemaSql, /revoke all on table public\.security_alerts from anon, authenticated, public/i);
      assert.match(schemaSql, /security_alerts_service_only/i);
    });
  });

  describe('2. Strict Canonical Phone Deduplication & Escalation', () => {
    let lead1Id;
    let lead2Id;

    test('POST /api/leads blocks duplicate canonical phones with 409 across formats, escalates repeat & cross-referral attempts to critical, and blocks Admin duplicates + PATCH phone collisions', async () => {
      // First registration succeeds
      const first = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lucía Morales',
          phone: '+1 (555) 234-5678',
          address: 'Dallas, TX',
          acceptedTerms: true,
          referralCode: 'CARLOS-SEC',
          visitorId: 'dev-first-001',
        }),
      });
      assert.strictEqual(first.status, 201);
      lead1Id = (await first.json()).lead.id;

      // Same phone formatted differently under SAME referral -> 409 + severity 'high'
      const dupSameRef = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-ip': '198.51.100.11' },
        body: JSON.stringify({
          name: 'Lucía Duplicada',
          phone: '555-234-5678',
          address: 'Dallas, TX',
          acceptedTerms: true,
          referralCode: 'CARLOS-SEC',
          visitorId: 'dev-dup-001',
        }),
      });
      assert.strictEqual(dupSameRef.status, 409);
      const dupBody1 = await dupSameRef.json();
      assert.strictEqual(dupBody1.code, 'DUPLICATE_PHONE');

      // Repeat attempt with raw digits -> 409 + escalates to 'critical'
      const dupRepeat = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-ip': '198.51.100.12' },
        body: JSON.stringify({
          name: 'Lucía Reincidente',
          phone: '5552345678',
          address: 'Dallas, TX',
          acceptedTerms: true,
          referralCode: 'CARLOS-SEC',
        }),
      });
      assert.strictEqual(dupRepeat.status, 409);

      // Register a second distinct lead under CARLOS-SEC, then attempt same phone under MARIA-SEC -> immediate 'critical'
      const second = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jorge Herrera',
          phone: '555-390-4411',
          address: 'Austin, TX',
          acceptedTerms: true,
          referralCode: 'CARLOS-SEC',
        }),
      });
      assert.strictEqual(second.status, 201);
      lead2Id = (await second.json()).lead.id;

      const crossRefDup = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jorge Cruzado',
          phone: '+1 555 390 4411',
          address: 'Austin, TX',
          acceptedTerms: true,
          referralCode: 'MARIA-SEC',
        }),
      });
      assert.strictEqual(crossRefDup.status, 409);

      // Admin manual creation with duplicate phone -> 409
      const adminDup = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Admin Duplicado',
          phone: '(555) 234-5678',
          address: 'Houston, TX',
          acceptedTerms: true,
        }),
      });
      assert.strictEqual(adminDup.status, 409);
      assert.strictEqual((await adminDup.json()).code, 'DUPLICATE_PHONE');

      // Admin PATCH changing lead2 phone to lead1's phone -> 409
      const patchDup = await fetch(`${baseUrl}/api/leads/${lead2Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: '1-555-234-5678' }),
      });
      assert.strictEqual(patchDup.status, 409);
      assert.strictEqual((await patchDup.json()).code, 'DUPLICATE_PHONE');

      // Verify recorded duplicate_phone_attempt alerts & severities
      const alertsRes = await fetch(`${baseUrl}/api/security/alerts`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(alertsRes.status, 200);
      const { alerts } = await alertsRes.json();
      const dupAlerts = alerts.filter((a) => a.code === 'duplicate_phone_attempt');
      assert.ok(dupAlerts.length >= 5, `Expected at least 5 duplicate alerts, got ${dupAlerts.length}`);

      const firstDupAlert = dupAlerts.find((a) => a.metadata?.attemptedName === 'Lucía Duplicada');
      assert.strictEqual(firstDupAlert?.severity, 'high');
      assert.strictEqual(firstDupAlert?.phoneMasked, '***-***-5678');
      assert.strictEqual(firstDupAlert?.ipMasked, '198.51.***.11');
      assert.strictEqual(firstDupAlert?.leadId, lead1Id);

      const repeatDupAlert = dupAlerts.find((a) => a.metadata?.attemptedName === 'Lucía Reincidente');
      assert.strictEqual(repeatDupAlert?.severity, 'critical');
      assert.strictEqual(repeatDupAlert?.metadata?.repeatAttempt, true);

      const crossDupAlert = dupAlerts.find((a) => a.metadata?.attemptedName === 'Jorge Cruzado');
      assert.strictEqual(crossDupAlert?.severity, 'critical');
      assert.strictEqual(crossDupAlert?.metadata?.crossReferralAttempt, true);
      assert.strictEqual(crossDupAlert?.referralCode, 'MARIA-SEC');
    });
  });

  describe('3. Real-Time Fraud & Leakage Detection Engine', () => {
    test('Detects same_device_multi_lead, velocity_ip_burst, suspicious_phone_pattern, and qr_visit_farming', async () => {
      // same_device_multi_lead + velocity_ip_burst (3 leads from same test IP, 2 from same visitorId)
      const ip = '203.0.113.77';
      const leadPayloads = [
        { name: 'Dispositivo Uno', phone: '555-410-1001', visitorId: 'shared-dev-99' },
        { name: 'Dispositivo Dos', phone: '555-410-1002', visitorId: 'shared-dev-99' },
        { name: 'Ráfaga Tres', phone: '123-456-7890', visitorId: 'other-dev-01' }, // also triggers suspicious_phone_pattern (sequential)
      ];
      for (const payload of leadPayloads) {
        const r = await fetch(`${baseUrl}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-ip': ip },
          body: JSON.stringify({
            ...payload,
            address: 'Miami, FL',
            acceptedTerms: true,
            referralCode: 'CARLOS-SEC',
          }),
        });
        assert.strictEqual(r.status, 201);
      }

      // Same exact full name with different phone -> suspicious_phone_pattern
      const sameNameLead = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Dispositivo Uno',
          phone: '555-410-9999',
          address: 'Miami, FL',
          acceptedTerms: true,
          referralCode: 'CARLOS-SEC',
        }),
      });
      assert.strictEqual(sameNameLead.status, 201);

      // qr_visit_farming: 12 visits to same referralCode from same IP within 10 min
      for (let i = 0; i < 12; i += 1) {
        const vr = await fetch(`${baseUrl}/api/referrals/visit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-ip': '203.0.113.90' },
          body: JSON.stringify({ code: 'CARLOS-SEC', visitorId: `farm-vis-${i}` }),
        });
        assert.strictEqual(vr.status, 200);
      }

      const { alerts } = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();

      assert.ok(
        alerts.some((a) => a.code === 'same_device_multi_lead' && a.severity === 'high' && a.category === 'qr_abuse'),
        'Expected same_device_multi_lead alert'
      );
      assert.ok(
        alerts.some((a) => a.code === 'velocity_ip_burst' && a.severity === 'critical' && a.category === 'qr_abuse'),
        'Expected velocity_ip_burst alert'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'suspicious_phone_pattern' &&
            a.severity === 'medium' &&
            a.metadata?.reason === 'sequential_digits'
        ),
        'Expected suspicious_phone_pattern (sequential) alert'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'suspicious_phone_pattern' &&
            a.metadata?.reason === 'duplicate_name_different_phone'
        ),
        'Expected suspicious_phone_pattern (duplicate name) alert'
      );
      assert.ok(
        alerts.some((a) => a.code === 'qr_visit_farming' && a.severity === 'medium' && a.referralCode === 'CARLOS-SEC'),
        'Expected qr_visit_farming alert'
      );
    });

    test('Detects telemarketing_rapid_schedule, telemarketing_rapid_reposo, vendedor_fast_close, and vendedor_order_burst (including low orderAmount < 100)', async () => {
      // Create 7 fresh leads for CARLOS-SEC (4 to schedule rapidly, 3 to send to reposo rapidly)
      const leadIds = [];
      for (let i = 0; i < 7; i += 1) {
        const r = await fetch(`${baseUrl}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Prospecto Flujo ${i + 1}`,
            phone: `555-720-200${i}`,
            address: 'Orlando, FL',
            acceptedTerms: true,
            referralCode: 'CARLOS-SEC',
          }),
        });
        assert.strictEqual(r.status, 201);
        leadIds.push((await r.json()).lead.id);
      }

      // Telemarketing rapidly schedules 4 leads -> telemarketing_rapid_schedule
      for (let i = 0; i < 4; i += 1) {
        const sr = await fetch(`${baseUrl}/api/leads/${leadIds[i]}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${teleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ callOutcome: 'scheduled' }),
        });
        assert.strictEqual(sr.status, 200);
      }

      // Telemarketing rapidly marks 3 leads as not_scheduled (En Reposo) -> telemarketing_rapid_reposo
      for (let i = 4; i < 7; i += 1) {
        const rr = await fetch(`${baseUrl}/api/leads/${leadIds[i]}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${teleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ callOutcome: 'not_scheduled' }),
        });
        assert.strictEqual(rr.status, 200);
      }

      // Vendedor closes lead 0 immediately (< 10 min) as 'orden' with $0 -> vendedor_fast_close + vendedor_order_burst (lowAmountFlag)
      const c0 = await fetch(`${baseUrl}/api/leads/${leadIds[0]}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${carlosToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 0, confirmLock: true }),
      });
      assert.strictEqual(c0.status, 200);

      // Vendedor closes lead 1 as 'orden' ($2900) -> vendedor_order_burst (2nd orden in 15 min)
      const c1 = await fetch(`${baseUrl}/api/leads/${leadIds[1]}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${carlosToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 2900, confirmLock: true }),
      });
      assert.strictEqual(c1.status, 200);

      // Vendedor closes lead 2 as 'cita' -> vendedor_order_burst (3rd classification in 15 min)
      const c2 = await fetch(`${baseUrl}/api/leads/${leadIds[2]}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${carlosToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', confirmLock: true }),
      });
      assert.strictEqual(c2.status, 200);

      // Vendedor tries to downgrade locked orden lead 0 without Admin password -> 403 + rbac_unauthorized_attempt
      const lockedTry = await fetch(`${baseUrl}/api/leads/${leadIds[0]}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${carlosToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo', confirmLock: true }),
      });
      assert.strictEqual(lockedTry.status, 403);

      // Vendedor tries to classify unscheduled/reposo lead 4 -> 409 + rbac_unauthorized_attempt
      const unschedTry = await fetch(`${baseUrl}/api/leads/${leadIds[4]}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${carlosToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo', confirmLock: true }),
      });
      assert.strictEqual(unschedTry.status, 409);

      // Maria tries to touch Carlos's lead 3 -> 403 + rbac_unauthorized_attempt
      const crossSellerTry = await fetch(`${baseUrl}/api/leads/${leadIds[3]}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${mariaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita', confirmLock: true }),
      });
      assert.strictEqual(crossSellerTry.status, 403);

      const { alerts } = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();

      assert.ok(
        alerts.some((a) => a.code === 'telemarketing_rapid_schedule' && a.severity === 'medium' && a.category === 'telemarketing'),
        'Expected telemarketing_rapid_schedule alert'
      );
      assert.ok(
        alerts.some((a) => a.code === 'telemarketing_rapid_reposo' && a.severity === 'high' && a.category === 'telemarketing'),
        'Expected telemarketing_rapid_reposo alert'
      );
      assert.ok(
        alerts.some((a) => a.code === 'vendedor_fast_close' && a.severity === 'critical' && a.category === 'vendedor'),
        'Expected vendedor_fast_close alert'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'vendedor_order_burst' &&
            a.severity === 'high' &&
            a.metadata?.lowAmountFlag === true
        ),
        'Expected vendedor_order_burst (low amount) alert'
      );
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'vendedor_order_burst' &&
            Number(a.metadata?.ordersIn15m) >= 2
        ),
        'Expected vendedor_order_burst (orders burst) alert'
      );
      assert.ok(
        alerts.some((a) => a.code === 'rbac_unauthorized_attempt' && a.metadata?.reason === 'vendedor_cross_seller_access'),
        'Expected rbac_unauthorized_attempt for cross-seller access'
      );
      assert.ok(
        alerts.some((a) => a.code === 'rbac_unauthorized_attempt' && a.metadata?.reason === 'vendedor_locked_lead_attempt'),
        'Expected rbac_unauthorized_attempt for locked lead attempt'
      );
      assert.ok(
        alerts.some((a) => a.code === 'rbac_unauthorized_attempt' && a.metadata?.reason === 'vendedor_unscheduled_lead_attempt'),
        'Expected rbac_unauthorized_attempt for unscheduled lead attempt'
      );

      // Admin reverts locked lead 0 -> admin_audit_event (lead_revert_or_unlock)
      const revertRes = await fetch(`${baseUrl}/api/leads/${leadIds[0]}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'none',
          sellerLocked: false,
          promoCodeInvalidated: false,
          adminPassword: 'AdminMaster2026@',
        }),
      });
      assert.strictEqual(revertRes.status, 200);

      // Admin deletes lead 6 -> admin_audit_event (lead_deleted)
      const delRes = await fetch(`${baseUrl}/api/leads/${leadIds[6]}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(delRes.status, 200);

      const postAuditAlerts = (
        await (
          await fetch(`${baseUrl}/api/security/alerts`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
        ).json()
      ).alerts;
      assert.ok(
        postAuditAlerts.some(
          (a) => a.code === 'admin_audit_event' && a.category === 'audit' && a.metadata?.action === 'lead_revert_or_unlock'
        ),
        'Expected admin_audit_event for lead revert/unlock'
      );
      assert.ok(
        postAuditAlerts.some(
          (a) => a.code === 'admin_audit_event' && a.category === 'audit' && a.metadata?.action === 'lead_deleted'
        ),
        'Expected admin_audit_event for lead deletion'
      );
    });

    test('Detects auth_security_event on >= 3 failed attempts and 429 lockout', async () => {
      const attackerIp = '203.0.113.200';
      for (let i = 1; i <= 4; i += 1) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-ip': attackerIp },
          body: JSON.stringify({ username: 'AdminCiprian', password: `WrongPass${i}!` }),
        });
        assert.strictEqual(res.status, 401);
      }

      // 5th attempt triggers 429 lockout
      const fifth = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-ip': attackerIp },
        body: JSON.stringify({ username: 'AdminCiprian', password: 'WrongPass5!' }),
      });
      assert.strictEqual(fifth.status, 429);

      const { alerts } = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.ok(
        alerts.some(
          (a) =>
            a.code === 'auth_security_event' &&
            a.severity === 'critical' &&
            a.category === 'access' &&
            a.metadata?.locked === true
        ),
        'Expected auth_security_event lockout alert'
      );
    });
  });

  describe('4. Strict Admin-Only RBAC Isolation & Alert Management Endpoints', () => {
    test('securityAlerts is NEVER exposed to public, telemarketing, or vendedor; non-admin calls to /api/security/* return 401/403 and log rbac_unauthorized_attempt', async () => {
      const pubState = await (await fetch(`${baseUrl}/api/state`)).json();
      assert.strictEqual(pubState.securityAlerts, undefined);

      const teleState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${teleToken}` },
        })
      ).json();
      assert.strictEqual(teleState.securityAlerts, undefined);

      const vendState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${carlosToken}` },
        })
      ).json();
      assert.strictEqual(vendState.securityAlerts, undefined);

      const adminState = await (
        await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.ok(Array.isArray(adminState.securityAlerts) && adminState.securityAlerts.length > 0);

      // Unauthenticated -> 401
      const unauthGet = await fetch(`${baseUrl}/api/security/alerts`);
      assert.strictEqual(unauthGet.status, 401);

      // Vendedor -> 403 + logs rbac_unauthorized_attempt
      const vendGet = await fetch(`${baseUrl}/api/security/alerts`, {
        headers: { Authorization: `Bearer ${carlosToken}` },
      });
      assert.strictEqual(vendGet.status, 403);

      // Telemarketing -> 403
      const teleBulk = await fetch(`${baseUrl}/api/security/alerts/bulk-status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'mark_all_reviewed' }),
      });
      assert.strictEqual(teleBulk.status, 403);

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
            a.metadata?.reason === 'admin_route_denied'
        ),
        'Expected rbac_unauthorized_attempt for vendedor accessing /api/security/alerts'
      );
    });

    test('Admin PATCH /api/security/alerts/:id, POST /api/security/alerts/bulk-status, and Master Reset audit work cleanly', async () => {
      const initial = await (
        await fetch(`${baseUrl}/api/security/alerts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      assert.ok(initial.alerts.length >= 2);
      const targetId = initial.alerts[0].id;

      // Invalid status -> 400
      const badStatus = await fetch(`${baseUrl}/api/security/alerts/${targetId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'bogus' }),
      });
      assert.strictEqual(badStatus.status, 400);

      // Mark reviewed with reviewNote
      const reviewed = await fetch(`${baseUrl}/api/security/alerts/${targetId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'reviewed', reviewNote: 'Confirmado con supervisor' }),
      });
      assert.strictEqual(reviewed.status, 200);
      const revData = await reviewed.json();
      assert.strictEqual(revData.ok, true);
      assert.strictEqual(revData.alert.status, 'reviewed');
      assert.strictEqual(revData.alert.reviewNote, 'Confirmado con supervisor');
      assert.ok(revData.alert.reviewedBy);
      assert.ok(revData.alert.reviewedAt);
      assert.ok(Array.isArray(revData.state.securityAlerts));

      // Reopen alert -> clears reviewedBy/reviewedAt
      const reopened = await fetch(`${baseUrl}/api/security/alerts/${targetId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'open' }),
      });
      assert.strictEqual(reopened.status, 200);
      const reopenData = await reopened.json();
      assert.strictEqual(reopenData.alert.status, 'open');
      assert.strictEqual(reopenData.alert.reviewedBy, null);
      assert.strictEqual(reopenData.alert.reviewedAt, null);

      // Bulk mark_all_reviewed
      const bulkRev = await fetch(`${baseUrl}/api/security/alerts/bulk-status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'mark_all_reviewed' }),
      });
      assert.strictEqual(bulkRev.status, 200);
      const bulkRevData = await bulkRev.json();
      assert.strictEqual(bulkRevData.ok, true);
      assert.strictEqual(bulkRevData.alerts.every((a) => a.status !== 'open'), true);

      // Bulk clear_resolved removes all reviewed/dismissed alerts
      const bulkClear = await fetch(`${baseUrl}/api/security/alerts/bulk-status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'clear_resolved' }),
      });
      assert.strictEqual(bulkClear.status, 200);
      const bulkClearData = await bulkClear.json();
      assert.strictEqual(bulkClearData.alerts.length, 0);

      // Master Reset logs admin_audit_event (master_reset) using logged-in Admin's own password
      const resetRes = await fetch(`${baseUrl}/api/admin/master-reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword: ADMIN_DEFAULT_PASSWORD, resetCatalogAndSettings: true }),
      });
      assert.strictEqual(resetRes.status, 200);
      const resetData = await resetRes.json();
      assert.ok(
        resetData.state.securityAlerts.some(
          (a) => a.code === 'admin_audit_event' && a.metadata?.action === 'master_reset'
        ),
        'Expected admin_audit_event after Master Reset'
      );
    });
  });
});
