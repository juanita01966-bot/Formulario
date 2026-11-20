import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Set test environment before importing the app
process.env.NODE_ENV = 'test';

const { default: app } = await import('../server/index.js');

describe('DSB Authentication Standardization & Caller RBAC Test Suite', () => {
  let server;
  let baseUrl;
  let adminSessionToken;
  let callerSessionToken;
  let testLeadId;
  const createdQrIds = new Set();
  const createdGiftIds = new Set();
  let initialShowcaseSettings = null;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Create a sample lead with sensitive data for testing
    const res = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cliente Prueba RBAC',
        phone: '555-123-4567',
        address: 'Calle Primavera 123',
        acceptedTerms: true,
        notes: 'Nota ultra confidencial del cliente',
        qualification: { tier: 'alto', score: 95, creditProfile: 'excelente' },
      }),
    });
    const data = await res.json();
    testLeadId = data.lead.id;
  });

  after(async () => {
    if (adminSessionToken) {
      if (testLeadId) {
        try {
          await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminSessionToken}` },
          });
        } catch {
          // Ignore cleanup failure
        }
      }
      try {
        const stateRes = await fetch(`${baseUrl}/api/state`, {
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        });
        if (stateRes.ok) {
          const currentState = await stateRes.json();
          const leftoverLeads = (currentState.leads || []).filter(
            (l) =>
              l.name === 'Cliente Prueba RBAC' ||
              l.name === 'Lead para Borrar' ||
              l.name === 'Lead Peso Ponderado' ||
              l.name === 'Lead Invalidation Flow'
          );
          for (const lead of leftoverLeads) {
            await fetch(`${baseUrl}/api/leads/${lead.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${adminSessionToken}` },
            });
          }
        }
      } catch {
        // Ignore cleanup failure
      }
    }
    if (createdQrIds.size > 0 && adminSessionToken) {
      for (const qrId of createdQrIds) {
        try {
          await fetch(`${baseUrl}/api/qr/${qrId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminSessionToken}` },
          });
        } catch {
          // Ignore cleanup failure
        }
      }
    }
    if (createdGiftIds.size > 0 && adminSessionToken) {
      for (const giftId of createdGiftIds) {
        try {
          await fetch(`${baseUrl}/api/gifts/${giftId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminSessionToken}` },
          });
        } catch {
          // Ignore cleanup failure
        }
      }
    }
    if (initialShowcaseSettings && adminSessionToken) {
      try {
        await fetch(`${baseUrl}/api/settings`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(initialShowcaseSettings),
        });
      } catch {
        // Ignore cleanup failure
      }
    }
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. Authentication Standardization (Admin & Caller)', () => {
    test('AdminCiprian authenticates Step 1 with valid password (role: admin)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'AdminCiprian',
          password: 'AdminMaster2026@',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(typeof data.preAuthToken, 'string');
      assert.strictEqual(data.role, 'admin');
      assert.strictEqual(data.username, 'AdminCiprian');
    });

    test('AdminCiprian completes Step 2 with valid PIN 1966', async () => {
      // Step 1
      const step1Res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'AdminCiprian',
          password: 'AdminMaster2026@',
        }),
      });
      const { preAuthToken } = await step1Res.json();

      // Step 2
      const step2Res = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preAuthToken,
          pin: '1966',
        }),
      });

      assert.strictEqual(step2Res.status, 200);
      const step2Data = await step2Res.json();
      assert.strictEqual(step2Data.ok, true);
      assert.strictEqual(typeof step2Data.sessionToken, 'string');
      assert.strictEqual(step2Data.role, 'admin');
      assert.strictEqual(step2Data.username, 'AdminCiprian');

      adminSessionToken = step2Data.sessionToken;
    });

    test('AdminCripian (alias/typo) is strictly REJECTED with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'AdminCripian',
          password: 'AdminMaster2026@',
        }),
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.ok, undefined);
      assert.match(data.error, /inválidas/i);
    });

    test('admincripian (lowercase alias) is strictly REJECTED with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admincripian',
          password: 'AdminMaster2026@',
        }),
      });

      assert.strictEqual(res.status, 401);
    });

    test('AdminCiprian with incorrect password is rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'AdminCiprian',
          password: 'WrongPassword2026!',
        }),
      });

      assert.strictEqual(res.status, 401);
    });

    test('AdminCiprian with incorrect PIN is rejected (401)', async () => {
      const step1Res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'AdminCiprian',
          password: 'AdminMaster2026@',
        }),
      });
      const { preAuthToken } = await step1Res.json();

      const step2Res = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preAuthToken,
          pin: '0000',
        }),
      });

      assert.strictEqual(step2Res.status, 401);
      const data = await step2Res.json();
      assert.match(data.error, /PIN incorrecto/i);
    });

    test('Caller authenticates Step 1 with valid password UsuCa2026@ (role: caller)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Caller',
          password: 'UsuCa2026@',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(typeof data.preAuthToken, 'string');
      assert.strictEqual(data.role, 'caller');
      assert.strictEqual(data.username, 'Caller');
    });

    test('Caller completes Step 2 with valid PIN 1532 (role: caller)', async () => {
      const step1Res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Caller',
          password: 'UsuCa2026@',
        }),
      });
      const { preAuthToken } = await step1Res.json();

      const step2Res = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preAuthToken,
          pin: '1532',
        }),
      });

      assert.strictEqual(step2Res.status, 200);
      const step2Data = await step2Res.json();
      assert.strictEqual(step2Data.ok, true);
      assert.strictEqual(typeof step2Data.sessionToken, 'string');
      assert.strictEqual(step2Data.role, 'caller');
      assert.strictEqual(step2Data.username, 'Caller');

      callerSessionToken = step2Data.sessionToken;
    });

    test('Caller with incorrect password is rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Caller',
          password: 'BadPassword!',
        }),
      });

      assert.strictEqual(res.status, 401);
    });

    test('Caller with incorrect PIN is rejected (401)', async () => {
      const step1Res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Caller',
          password: 'UsuCa2026@',
        }),
      });
      const { preAuthToken } = await step1Res.json();

      const step2Res = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preAuthToken,
          pin: '9999',
        }),
      });

      assert.strictEqual(step2Res.status, 401);
    });
  });

  describe('2. Session Verification & Roles', () => {
    test('GET /api/auth/session with Admin token returns valid session with role: admin', async () => {
      const res = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, true);
      assert.strictEqual(data.valid, true);
      assert.strictEqual(data.role, 'admin');
      assert.strictEqual(data.username, 'AdminCiprian');
    });

    test('GET /api/auth/session with Caller token returns valid session with role: caller', async () => {
      const res = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, true);
      assert.strictEqual(data.valid, true);
      assert.strictEqual(data.role, 'caller');
      assert.strictEqual(data.username, 'Caller');
    });

    test('GET /api/auth/session with invalid or forged token returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: 'Bearer invalid.forged.token' },
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.authenticated, false);
    });

    test('GET /api/auth/session without Authorization header returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/session`);

      assert.strictEqual(res.status, 401);
    });
  });

  describe('3. Zero-Trust RBAC Data Sanitization (GET /api/state)', () => {
    test('Admin token receives full state with lead details, notes, qualification, and gifts', async () => {
      const res = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });

      assert.strictEqual(res.status, 200);
      const state = await res.json();
      assert.strictEqual(state.role, 'admin');
      assert.ok(Array.isArray(state.leads));
      assert.ok(state.leads.length > 0);

      const lead = state.leads.find((l) => l.id === testLeadId) || state.leads[0];
      assert.ok(lead);
      // Admin sees sensitive fields
      assert.ok('notes' in lead);
      assert.ok('category' in lead);
      assert.ok('called' in lead);
      assert.ok('claimCode' in lead);
      assert.ok(Array.isArray(state.gifts));
      assert.ok(state.gifts.length > 0);
    });

    test('Caller token receives ONLY id, name, phone, address for each lead (all other fields stripped)', async () => {
      const res = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });

      assert.strictEqual(res.status, 200);
      const state = await res.json();
      assert.strictEqual(state.role, 'caller');
      assert.ok(Array.isArray(state.leads));
      assert.ok(state.leads.length > 0);

      for (const lead of state.leads) {
        const keys = Object.keys(lead).sort();
        const allowedKeys = ['address', 'id', 'name', 'phone'];

        // Every key in lead must be in allowedKeys
        for (const k of keys) {
          assert.ok(
            allowedKeys.includes(k),
            `Lead contains forbidden sensitive key "${k}" for caller role`
          );
        }

        // Explicitly verify critical sensitive fields are completely absent
        assert.strictEqual(lead.notes, undefined, 'Caller must not receive notes');
        assert.strictEqual(lead.qualification, undefined, 'Caller must not receive qualification');
        assert.strictEqual(lead.category, undefined, 'Caller must not receive category');
        assert.strictEqual(lead.called, undefined, 'Caller must not receive called status');
        assert.strictEqual(lead.calledAt, undefined, 'Caller must not receive calledAt');
        assert.strictEqual(lead.orderAmount, undefined, 'Caller must not receive orderAmount');
        assert.strictEqual(lead.claimCode, undefined, 'Caller must not receive claimCode');
        assert.strictEqual(lead.giftId, undefined, 'Caller must not receive giftId');
        assert.strictEqual(lead.giftName, undefined, 'Caller must not receive giftName');
        assert.strictEqual(lead.createdAt, undefined, 'Caller must not receive createdAt');
        assert.strictEqual(lead.acceptedTerms, undefined, 'Caller must not receive acceptedTerms');
      }

      // Caller state must not expose gifts catalog
      assert.deepStrictEqual(state.gifts, []);
    });

    test('Unauthenticated GET /api/state receives empty leads array', async () => {
      const res = await fetch(`${baseUrl}/api/state`);

      assert.strictEqual(res.status, 200);
      const state = await res.json();
      assert.deepStrictEqual(state.leads, []);
    });
  });

  describe('4. Administrative Route Protection (Caller 403 Forbidden)', () => {
    test('DELETE /api/leads/:id with Caller token is REJECTED with HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Acceso denegado|administrativos/i);
    });

    test('PATCH /api/leads/:id with Caller token touching admin fields is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          called: true,
          category: 'cita',
          notes: 'Intento de edicion por caller',
        }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Acceso denegado|administrativos/i);
    });

    test('PATCH /api/leads/:id with Caller token updating qualification is strictly REJECTED with HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qualification: { test: true, bypassed: true, rating: 100 },
        }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Acceso denegado|administrativos/i);
    });

    test('PATCH /api/leads/:id with Caller token updating giftId is strictly REJECTED with HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          giftId: 'some-gift',
          giftName: 'Regalo Modificado por Caller',
        }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Acceso denegado|administrativos/i);
    });

    test('POST /api/leads with Caller token is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Lead Creado por Caller',
          phone: '555-999-0000',
          address: 'Calle No Permitida',
        }),
      });

      assert.strictEqual(res.status, 403);
    });

    test('POST /api/gifts with Caller token is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Regalo Malicioso',
          subtitle: 'No permitido',
        }),
      });

      assert.strictEqual(res.status, 403);
    });

    test('PATCH /api/gifts/:id with Caller token is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/gifts/gift-cutlery`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Nombre Modificado' }),
      });

      assert.strictEqual(res.status, 403);
    });

    test('DELETE /api/gifts/:id with Caller token is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/gifts/gift-cutlery`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });

      assert.strictEqual(res.status, 403);
    });

    test('POST /api/gifts/reset with Caller token is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/gifts/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });

      assert.strictEqual(res.status, 403);
    });

    test('PATCH /api/settings with Caller token is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ advisorName: 'Nuevo Nombre Hackeado' }),
      });

      assert.strictEqual(res.status, 403);
    });

    test('POST /api/auth/update-credentials with Caller token is REJECTED with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: 'PoloNorte121966@',
          newUsername: 'HackedAdmin',
        }),
      });

      assert.strictEqual(res.status, 403);
    });
  });

  describe('5. Admin Authorization on Administrative Operations', () => {
    test('Admin token can successfully update a lead and receives full state and lead', async () => {
      const res = await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          called: true,
          category: 'orden',
          orderAmount: 1250,
          notes: 'Nota administrativa actualizada por AdminCiprian',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.lead.id, testLeadId);
      assert.strictEqual(data.lead.notes, 'Nota administrativa actualizada por AdminCiprian');
      assert.strictEqual(data.lead.category, 'orden');
      assert.strictEqual(data.lead.orderAmount, 1250);
      assert.strictEqual(data.state.role, 'admin');
      assert.ok(Array.isArray(data.state.gifts));
      assert.ok(data.state.gifts.length > 0);
    });

    test('Unauthenticated public PATCH /api/leads/:id does not expose sensitive notes or admin fields in response', async () => {
      const res = await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qualification: { publicStep: 'completed', score: 90 },
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.lead);
      // Verify sensitive administrative fields are not leaked to public client
      assert.strictEqual(data.lead.notes, undefined);
      assert.strictEqual(data.lead.orderAmount, undefined);
      assert.strictEqual(data.lead.called, undefined);
      assert.strictEqual(data.lead.category, undefined);
      assert.ok(data.state);
      assert.strictEqual(data.state.role, undefined);
      // The single lead in state must also be sanitized
      assert.strictEqual(data.state.leads[0].notes, undefined);
      assert.strictEqual(data.state.leads[0].orderAmount, undefined);
    });

    test('Admin token can successfully delete a lead', async () => {
      // First create a disposable lead
      const createRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead para Borrar',
          phone: '555-000-1111',
          address: 'Direccion Borrable',
        }),
      });
      const { lead } = await createRes.json();

      // Delete with admin token
      const deleteRes = await fetch(`${baseUrl}/api/leads/${lead.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });

      assert.strictEqual(deleteRes.status, 200);
      const state = await deleteRes.json();
      assert.strictEqual(state.state.leads.some((l) => l.id === lead.id), false);
    });
  });

  describe('6. QR Studio Endpoints, Validation & Zero-Trust RBAC', () => {
    let createdQrId;

    test('Unauthenticated GET /api/qr, POST /api/qr, and DELETE /api/qr/:id return HTTP 401', async () => {
      const getRes = await fetch(`${baseUrl}/api/qr`);
      assert.strictEqual(getRes.status, 401);

      const postRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'QR Sin Sesion',
          targetUrl: 'https://example.com',
        }),
      });
      assert.strictEqual(postRes.status, 401);

      const delRes = await fetch(`${baseUrl}/api/qr/qr-unauth-test`, {
        method: 'DELETE',
      });
      assert.strictEqual(delRes.status, 401);
    });

    test('AdminCiprian POST /api/qr creates a styled QR code and returns HTTP 201', async () => {
      const payload = {
        name: 'QR Mesa VIP Otoño',
        targetUrl: 'https://royal.ciprian.example/show?mesa=vip',
        styleId: 'obsidian-dots',
        dotShape: 'dots',
        foregroundColor: '#D4942A',
        backgroundColor: '#14100D',
        includeLogo: true,
        frameText: 'Escanea y reclama tu obsequio',
      };

      const res = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.qr);
      assert.strictEqual(typeof data.qr.id, 'string');
      assert.strictEqual(data.qr.name, payload.name);
      assert.strictEqual(data.qr.targetUrl, payload.targetUrl);
      assert.strictEqual(data.qr.styleId, payload.styleId);
      assert.strictEqual(data.qr.dotShape, payload.dotShape);
      assert.strictEqual(data.qr.foregroundColor, payload.foregroundColor);
      assert.strictEqual(data.qr.backgroundColor, payload.backgroundColor);
      assert.strictEqual(data.qr.includeLogo, true);
      assert.strictEqual(data.qr.frameText, payload.frameText);
      assert.strictEqual(typeof data.qr.createdAt, 'string');
      assert.ok(Array.isArray(data.qrHistory));
      assert.ok(data.qrHistory.some((item) => item.id === data.qr.id));
      assert.strictEqual(data.state.role, 'admin');
      assert.ok(data.state.qrHistory.some((item) => item.id === data.qr.id));

      createdQrId = data.qr.id;
      createdQrIds.add(createdQrId);
    });

    test('Saved QR appears in Admin GET /api/state and Admin GET /api/qr', async () => {
      const stateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(stateRes.status, 200);
      const state = await stateRes.json();
      assert.ok(Array.isArray(state.qrHistory));
      const inState = state.qrHistory.find((item) => item.id === createdQrId);
      assert.ok(inState, 'Admin GET /api/state must contain saved QR');
      assert.strictEqual(inState.styleId, 'obsidian-dots');
      assert.strictEqual(inState.dotShape, 'dots');

      const qrRes = await fetch(`${baseUrl}/api/qr`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(qrRes.status, 200);
      const qrData = await qrRes.json();
      assert.ok(Array.isArray(qrData.qrHistory));
      const inQr = qrData.qrHistory.find((item) => item.id === createdQrId);
      assert.ok(inQr, 'Admin GET /api/qr must contain saved QR');
      assert.strictEqual(inQr.foregroundColor, '#D4942A');
      assert.strictEqual(inQr.backgroundColor, '#14100D');
    });

    test('Caller-role GET /api/qr, POST /api/qr, and DELETE /api/qr/:id return HTTP 403 Forbidden', async () => {
      const getRes = await fetch(`${baseUrl}/api/qr`, {
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });
      assert.strictEqual(getRes.status, 403);

      const postRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR No Autorizado',
          targetUrl: 'https://example.com',
        }),
      });
      assert.strictEqual(postRes.status, 403);

      const delRes = await fetch(`${baseUrl}/api/qr/${createdQrId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });
      assert.strictEqual(delRes.status, 403);
    });

    test('Caller and unauthenticated GET /api/state receive qrHistory: [] even when Admin saved QR items', async () => {
      const callerStateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });
      assert.strictEqual(callerStateRes.status, 200);
      const callerState = await callerStateRes.json();
      assert.strictEqual(callerState.role, 'caller');
      assert.deepStrictEqual(callerState.qrHistory, []);

      const publicStateRes = await fetch(`${baseUrl}/api/state`);
      assert.strictEqual(publicStateRes.status, 200);
      const publicState = await publicStateRes.json();
      assert.deepStrictEqual(publicState.qrHistory, []);
    });

    test('Admin POST /api/qr rejects missing/invalid targetUrl or short name with HTTP 400', async () => {
      const invalidCases = [
        { name: 'A', targetUrl: 'https://example.com' },
        { name: '   ', targetUrl: 'https://example.com' },
        { name: 'QR Sin URL' },
        { name: 'QR URL Vacia', targetUrl: '   ' },
        { name: 'QR XSS Protocol', targetUrl: 'javascript:alert(1)' },
        { name: 'QR Protocol Relative', targetUrl: '//evil.example.com' },
        { name: 'QR Malformed URL', targetUrl: 'not-a-valid-url' },
      ];

      for (const body of invalidCases) {
        const res = await fetch(`${baseUrl}/api/qr`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        assert.strictEqual(
          res.status,
          400,
          `Expected HTTP 400 for invalid QR payload: ${JSON.stringify(body)}`
        );
      }
    });

    test('Admin DELETE /api/qr/:id deletes saved QR cleanly (HTTP 200) and returns 404 when missing', async () => {
      const delRes = await fetch(`${baseUrl}/api/qr/${createdQrId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.qrHistory.some((item) => item.id === createdQrId), false);
      assert.strictEqual(delData.state.qrHistory.some((item) => item.id === createdQrId), false);
      createdQrIds.delete(createdQrId);

      // Confirm via GET /api/qr that it is gone
      const listRes = await fetch(`${baseUrl}/api/qr`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      assert.strictEqual(listData.qrHistory.some((item) => item.id === createdQrId), false);

      // Deleting non-existent ID returns 404
      const missingRes = await fetch(`${baseUrl}/api/qr/qr-does-not-exist`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(missingRes.status, 404);
    });
  });

  describe('7. Royal Prestige Catalog, UsageTips, ShowcaseStyle & Randomization RBAC', () => {
    const EXPECTED_GIFT_IDS = [
      'gift-utensils-6',
      'gift-utensil-holder',
      'gift-bowls-3',
      'gift-santoku-5',
      'gift-cleaver-7',
      'gift-icecream-2',
      'gift-mugs-2',
      'gift-bamboo-large',
      'gift-warmer-pro',
    ];

    test('Default store and GET /api/state return the 9 Royal Prestige PNG prizes with usageTip and showcaseStyle / randomizeGifts defaults', async () => {
      const defaultStore = JSON.parse(
        fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'shared', 'defaultStore.json'), 'utf8')
      );
      assert.strictEqual(defaultStore.settings.showcaseStyle, 'luminous-gold');
      assert.strictEqual(defaultStore.settings.randomizeGifts, true);
      assert.strictEqual(defaultStore.gifts.length, 9);
      assert.deepStrictEqual(
        defaultStore.gifts.map((g) => g.id),
        EXPECTED_GIFT_IDS
      );

      for (const routeHeaders of [undefined, { Authorization: `Bearer ${adminSessionToken}` }]) {
        const res = await fetch(`${baseUrl}/api/state`, routeHeaders ? { headers: routeHeaders } : undefined);
        assert.strictEqual(res.status, 200);
        const state = await res.json();

        assert.strictEqual(state.settings.showcaseStyle, 'luminous-gold');
        assert.strictEqual(state.settings.randomizeGifts, true);
        assert.ok(Array.isArray(state.gifts));
        assert.strictEqual(state.gifts.length, 9);
        assert.deepStrictEqual(
          state.gifts.map((g) => g.id),
          EXPECTED_GIFT_IDS
        );

        for (const gift of state.gifts) {
          assert.strictEqual(gift.active, true, `Gift ${gift.id} must be active`);
          assert.strictEqual(typeof gift.usageTip, 'string', `Gift ${gift.id} must include usageTip`);
          assert.ok(gift.usageTip.trim().length >= 15, `Gift ${gift.id} usageTip must be meaningful`);
          assert.strictEqual(typeof gift.customImageUrl, 'string', `Gift ${gift.id} must include customImageUrl`);
          assert.ok(
            gift.customImageUrl.startsWith('/sin%20fondo/') && gift.customImageUrl.endsWith('-Photoroom.png'),
            `Gift ${gift.id} customImageUrl must point to transparent PNG in /sin%20fondo/: ${gift.customImageUrl}`
          );
        }
      }
    });

    test('Unauthenticated gift mutations and PATCH /api/settings are REJECTED with HTTP 401', async () => {
      const createGiftRes = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Regalo Sin Sesion',
          usageTip: 'No autorizado',
        }),
      });
      assert.strictEqual(createGiftRes.status, 401);

      const updateGiftRes = await fetch(`${baseUrl}/api/gifts/gift-utensils-6`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usageTip: 'Intento sin sesion' }),
      });
      assert.strictEqual(updateGiftRes.status, 401);

      const deleteGiftRes = await fetch(`${baseUrl}/api/gifts/gift-utensils-6`, {
        method: 'DELETE',
      });
      assert.strictEqual(deleteGiftRes.status, 401);

      const settingsRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showcaseStyle: 'crystal-aurora', randomizeGifts: false }),
      });
      assert.strictEqual(settingsRes.status, 401);
    });

    test('Caller-role gift mutations with usageTip and PATCH /api/settings showcaseStyle/randomizeGifts are REJECTED with HTTP 403', async () => {
      const createGiftRes = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Regalo Caller Con Tip',
          usageTip: 'Tip bloqueado para caller',
        }),
      });
      assert.strictEqual(createGiftRes.status, 403);

      const updateGiftRes = await fetch(`${baseUrl}/api/gifts/gift-utensils-6`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usageTip: 'Tip modificado por caller' }),
      });
      assert.strictEqual(updateGiftRes.status, 403);

      const settingsRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showcaseStyle: 'crystal-aurora', randomizeGifts: false }),
      });
      assert.strictEqual(settingsRes.status, 403);
    });

    test('AdminCiprian can create, update with usageTip, verify in GET /api/state, and delete a gift cleanly', async () => {
      const createPayload = {
        name: 'Set Gourmet Prueba QA',
        subtitle: 'Obsequio temporal para pruebas de integración.',
        usageTip: 'Úsalo para cocinar al vapor conservando nutrientes y sabor.',
        tag: 'QA Edition',
        visualKey: 'pot',
        customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.48_ccc0c9bc-Photoroom.png',
        accentColor: '#C88A2B',
        stockLabel: 'Prueba',
      };

      const createRes = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPayload),
      });
      assert.strictEqual(createRes.status, 201);
      const created = await createRes.json();
      assert.ok(created.gift);
      assert.strictEqual(typeof created.gift.id, 'string');
      assert.strictEqual(created.gift.name, createPayload.name);
      assert.strictEqual(created.gift.usageTip, createPayload.usageTip);
      assert.strictEqual(created.gift.customImageUrl, createPayload.customImageUrl);
      assert.ok(created.state.gifts.some((g) => g.id === created.gift.id));

      const giftId = created.gift.id;
      createdGiftIds.add(giftId);

      const updatedTip = 'Tip actualizado QA: precalienta 2 minutos antes de sellar carnes.';
      const patchRes = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usageTip: updatedTip,
          subtitle: 'Descripción actualizada por AdminCiprian.',
        }),
      });
      assert.strictEqual(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.strictEqual(patched.gift.id, giftId);
      assert.strictEqual(patched.gift.usageTip, updatedTip);
      assert.strictEqual(patched.gift.subtitle, 'Descripción actualizada por AdminCiprian.');

      const publicStateRes = await fetch(`${baseUrl}/api/state`);
      assert.strictEqual(publicStateRes.status, 200);
      const publicState = await publicStateRes.json();
      const verifiedGift = publicState.gifts.find((g) => g.id === giftId);
      assert.ok(verifiedGift);
      assert.strictEqual(verifiedGift.usageTip, updatedTip);

      // Clean up test-created gift
      const deleteRes = await fetch(`${baseUrl}/api/gifts/${giftId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(deleteRes.status, 200);
      const deleted = await deleteRes.json();
      assert.strictEqual(deleted.state.gifts.some((g) => g.id === giftId), false);
      assert.strictEqual(deleted.state.gifts.length, 9);
      createdGiftIds.delete(giftId);
    });

    test('AdminCiprian can update showcaseStyle and randomizeGifts via PATCH /api/settings and restore defaults cleanly', async () => {
      const initialRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(initialRes.status, 200);
      const initialState = await initialRes.json();
      initialShowcaseSettings = {
        showcaseStyle: initialState.settings.showcaseStyle || 'luminous-gold',
        randomizeGifts:
          typeof initialState.settings.randomizeGifts === 'boolean' ? initialState.settings.randomizeGifts : true,
      };

      const auroraRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          showcaseStyle: 'crystal-aurora',
          randomizeGifts: false,
        }),
      });
      assert.strictEqual(auroraRes.status, 200);
      const auroraData = await auroraRes.json();
      assert.strictEqual(auroraData.settings.showcaseStyle, 'crystal-aurora');
      assert.strictEqual(auroraData.settings.randomizeGifts, false);

      const emberRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          showcaseStyle: 'royal-ember',
        }),
      });
      assert.strictEqual(emberRes.status, 200);
      const emberData = await emberRes.json();
      assert.strictEqual(emberData.settings.showcaseStyle, 'royal-ember');
      assert.strictEqual(emberData.settings.randomizeGifts, false);

      // Invalid showcaseStyle value must not corrupt persisted setting
      const invalidRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          showcaseStyle: 'invalid-style-attempt',
        }),
      });
      assert.strictEqual(invalidRes.status, 200);
      const invalidData = await invalidRes.json();
      assert.strictEqual(invalidData.settings.showcaseStyle, 'royal-ember');

      const publicStateRes = await fetch(`${baseUrl}/api/state`);
      assert.strictEqual(publicStateRes.status, 200);
      const publicState = await publicStateRes.json();
      assert.strictEqual(publicState.settings.showcaseStyle, 'royal-ember');
      assert.strictEqual(publicState.settings.randomizeGifts, false);

      // Restore original defaults
      const restoreRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initialShowcaseSettings),
      });
      assert.strictEqual(restoreRes.status, 200);
      const restored = await restoreRes.json();
      assert.strictEqual(restored.settings.showcaseStyle, 'luminous-gold');
      assert.strictEqual(restored.settings.randomizeGifts, true);
      initialShowcaseSettings = null;
    });
  });

  describe('7b. Gift Probability Persistence, Sanitization & RBAC', () => {
    const EXPECTED_SEEDED_PROBABILITIES = {
      'gift-utensil-holder': 30,
      'gift-bowls-3': 30,
      'gift-utensils-6': 30,
      'gift-icecream-2': 30,
      'gift-mugs-2': 30,
      'gift-bamboo-large': 5,
      'gift-warmer-pro': 10,
      'gift-santoku-5': 5,
      'gift-cleaver-7': 3,
    };

    test('Unauthenticated and Caller PATCH /api/gifts/probabilities are REJECTED (401 / 403)', async () => {
      const unauthRes = await fetch(`${baseUrl}/api/gifts/probabilities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ probabilities: { 'gift-utensils-6': 50 } }),
      });
      assert.strictEqual(unauthRes.status, 401);

      const callerRes = await fetch(`${baseUrl}/api/gifts/probabilities`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ probabilities: { 'gift-utensils-6': 50 } }),
      });
      assert.strictEqual(callerRes.status, 403);
    });

    test('GET /api/state returns updated seeded probabilities on all 9 gifts and omits gifts for Caller', async () => {
      const publicRes = await fetch(`${baseUrl}/api/state`);
      assert.strictEqual(publicRes.status, 200);
      const publicState = await publicRes.json();
      assert.strictEqual(publicState.gifts.length, 9);
      for (const gift of publicState.gifts) {
        assert.strictEqual(gift.probability, EXPECTED_SEEDED_PROBABILITIES[gift.id]);
      }

      const callerRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${callerSessionToken}` },
      });
      assert.strictEqual(callerRes.status, 200);
      const callerState = await callerRes.json();
      assert.deepStrictEqual(callerState.gifts, []);
    });

    test('Admin POST /api/gifts & PATCH /api/gifts/:id sanitize probability (defaults, >=0 clamping, 2 decimals) and support concurrent updates', async () => {
      // 1. Missing probability defaults to 10; negative clamps to 0; decimal rounds cleanly
      const defaultRes = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Regalo Default Prob' }),
      });
      assert.strictEqual(defaultRes.status, 201);
      const defaultData = await defaultRes.json();
      assert.strictEqual(defaultData.gift.probability, 10);
      createdGiftIds.add(defaultData.gift.id);

      const negRes = await fetch(`${baseUrl}/api/gifts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Regalo Negativo Prob', probability: -15.4 }),
      });
      assert.strictEqual(negRes.status, 201);
      const negData = await negRes.json();
      assert.strictEqual(negData.gift.probability, 0);
      createdGiftIds.add(negData.gift.id);

      // 2. PATCH clamps negative, rounds 2 decimals, and keeps current on invalid non-numeric input
      const patchRoundRes = await fetch(`${baseUrl}/api/gifts/${defaultData.gift.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ probability: 33.337 }),
      });
      assert.strictEqual(patchRoundRes.status, 200);
      const patchRoundData = await patchRoundRes.json();
      assert.strictEqual(patchRoundData.gift.probability, 33.34);

      const patchInvalidRes = await fetch(`${baseUrl}/api/gifts/${defaultData.gift.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ probability: 'not-a-number' }),
      });
      assert.strictEqual(patchInvalidRes.status, 200);
      const patchInvalidData = await patchInvalidRes.json();
      assert.strictEqual(patchInvalidData.gift.probability, 33.34);

      // 3. Concurrent PATCH /api/gifts/:id calls must not overwrite each other
      const [c1, c2] = await Promise.all([
        fetch(`${baseUrl}/api/gifts/${defaultData.gift.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ probability: 42.5 }),
        }),
        fetch(`${baseUrl}/api/gifts/${negData.gift.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ probability: 18.25 }),
        }),
      ]);
      assert.strictEqual(c1.status, 200);
      assert.strictEqual(c2.status, 200);

      const verifyRes = await fetch(`${baseUrl}/api/state`);
      const verifyState = await verifyRes.json();
      assert.strictEqual(
        verifyState.gifts.find((g) => g.id === defaultData.gift.id)?.probability,
        42.5
      );
      assert.strictEqual(
        verifyState.gifts.find((g) => g.id === negData.gift.id)?.probability,
        18.25
      );

      // Clean up temporary gifts
      for (const gid of [defaultData.gift.id, negData.gift.id]) {
        await fetch(`${baseUrl}/api/gifts/${gid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        });
        createdGiftIds.delete(gid);
      }
    });

    test('Admin PATCH /api/gifts/probabilities updates weights in bulk, respects 0-weight in POST /api/leads fallback, and POST /api/gifts/reset restores seeded weights', async () => {
      const bulkRes = await fetch(`${baseUrl}/api/gifts/probabilities`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          probabilities: {
            'gift-utensils-6': 100,
            'gift-utensil-holder': 0,
            'gift-bowls-3': -10,
            'gift-santoku-5': 0,
            'gift-cleaver-7': 0,
            'gift-icecream-2': 0,
            'gift-mugs-2': 0,
            'gift-bamboo-large': 0,
            'gift-warmer-pro': 0,
          },
        }),
      });
      assert.strictEqual(bulkRes.status, 200);
      const bulkData = await bulkRes.json();
      assert.strictEqual(
        bulkData.gifts.find((g) => g.id === 'gift-utensils-6')?.probability,
        100
      );
      assert.strictEqual(
        bulkData.gifts.find((g) => g.id === 'gift-bowls-3')?.probability,
        0
      );

      // Lead created without giftId must draw only positive-weight gift ('gift-utensils-6')
      const leadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead Peso Ponderado',
          phone: '555-777-8888',
          address: 'Test Ave',
        }),
      });
      assert.strictEqual(leadRes.status, 201);
      const leadData = await leadRes.json();
      assert.strictEqual(leadData.lead.giftId, 'gift-utensils-6');

      await fetch(`${baseUrl}/api/leads/${leadData.lead.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });

      // Reset catalog back to default seeded weights
      const resetRes = await fetch(`${baseUrl}/api/gifts/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(resetRes.status, 200);
      const resetData = await resetRes.json();
      assert.strictEqual(resetData.state.gifts.length, 9);
      for (const gift of resetData.state.gifts) {
        assert.strictEqual(gift.probability, EXPECTED_SEEDED_PROBABILITIES[gift.id]);
      }
    });
  });

  describe('7c. Anti-Cache Headers & Promo Code Invalidation with Admin-Password-Only Revert', () => {
    test('GET /api/state and PATCH /api/leads/:id enforce Cache-Control: no-store and Pragma: no-cache', async () => {
      const stateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(stateRes.status, 200);
      const cacheControl = stateRes.headers.get('cache-control') || '';
      assert.match(cacheControl, /no-store/i);
      assert.match(cacheControl, /no-cache/i);
      assert.match(cacheControl, /must-revalidate/i);
      assert.strictEqual(stateRes.headers.get('pragma'), 'no-cache');

      const patchRes = await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Verificación no-store' }),
      });
      assert.strictEqual(patchRes.status, 200);
      assert.match(patchRes.headers.get('cache-control') || '', /no-store/i);
      assert.strictEqual(patchRes.headers.get('pragma'), 'no-cache');
    });

    test('Category assignment invalidates promo code, forward progression preserves invalidation, and revert/downgrade strictly requires valid Admin password', async () => {
      const createRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead Invalidation Flow',
          phone: '555-888-9999',
          address: 'Dallas, TX',
          claimCode: 'OTN-7788',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const created = await createRes.json();
      const leadId = created.lead.id;
      assert.strictEqual(created.lead.promoCodeInvalidated, false);
      assert.strictEqual(created.lead.promoCodeInvalidatedAt, null);

      // Unauthenticated and Caller cannot mutate promoCodeInvalidated
      const unauthPatch = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCodeInvalidated: false }),
      });
      assert.strictEqual(unauthPatch.status, 401);

      const callerPatch = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ promoCodeInvalidated: false }),
      });
      assert.strictEqual(callerPatch.status, 403);

      // Mark called first
      const calledRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ called: true }),
      });
      assert.strictEqual(calledRes.status, 200);
      const calledData = await calledRes.json();
      assert.strictEqual(calledData.lead.called, true);
      assert.strictEqual(calledData.lead.promoCodeInvalidated, false);

      // Assign category 'cita' -> invalidates promo code
      const citaRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'cita' }),
      });
      assert.strictEqual(citaRes.status, 200);
      const citaData = await citaRes.json();
      assert.strictEqual(citaData.lead.category, 'cita');
      assert.strictEqual(citaData.lead.promoCodeInvalidated, true);
      assert.strictEqual(typeof citaData.lead.promoCodeInvalidatedAt, 'string');
      const invalidatedTimestamp = citaData.lead.promoCodeInvalidatedAt;

      // Forward progression 'cita' -> 'demo' -> 'orden' works without adminPassword and preserves invalidation
      const demoRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'demo' }),
      });
      assert.strictEqual(demoRes.status, 200);
      const demoData = await demoRes.json();
      assert.strictEqual(demoData.lead.category, 'demo');
      assert.strictEqual(demoData.lead.promoCodeInvalidated, true);
      assert.strictEqual(demoData.lead.promoCodeInvalidatedAt, invalidatedTimestamp);

      const ordenRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 2792 }),
      });
      assert.strictEqual(ordenRes.status, 200);
      const ordenData = await ordenRes.json();
      assert.strictEqual(ordenData.lead.category, 'orden');
      assert.strictEqual(ordenData.lead.orderAmount, 2792);
      assert.strictEqual(ordenData.lead.promoCodeInvalidated, true);

      // Revert / downgrade / uninvalidate / called:false WITHOUT or WITH WRONG adminPassword MUST return 403
      const protectedPayloads = [
        { category: 'none' },
        { category: 'none', adminPassword: 'WrongPassword!' },
        { promoCodeInvalidated: false },
        { promoCodeInvalidated: false, adminPassword: 'WrongPassword!' },
        { category: 'demo' },
        { category: 'cita', adminPassword: 'WrongPassword!' },
        { called: false },
      ];
      for (const body of protectedPayloads) {
        const blockedRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        assert.strictEqual(
          blockedRes.status,
          403,
          `Expected 403 for protected revert/downgrade payload: ${JSON.stringify(body)}`
        );
      }

      // Downgrade 'orden' -> 'demo' WITH valid Admin password succeeds while keeping code invalidated
      const downgradeOkRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'demo',
          adminPassword: 'AdminMaster2026@',
        }),
      });
      assert.strictEqual(downgradeOkRes.status, 200);
      const downgradeOkData = await downgradeOkRes.json();
      assert.strictEqual(downgradeOkData.lead.category, 'demo');
      assert.strictEqual(downgradeOkData.lead.orderAmount, null);
      assert.strictEqual(downgradeOkData.lead.promoCodeInvalidated, true);

      // Full revert to 'none' & promoCodeInvalidated: false WITH valid Admin password succeeds
      const revertOkRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'none',
          promoCodeInvalidated: false,
          adminPassword: 'AdminMaster2026@',
        }),
      });
      assert.strictEqual(revertOkRes.status, 200);
      const revertOkData = await revertOkRes.json();
      assert.strictEqual(revertOkData.lead.category, 'none');
      assert.strictEqual(revertOkData.lead.promoCodeInvalidated, false);
      assert.strictEqual(revertOkData.lead.promoCodeInvalidatedAt, null);
      assert.strictEqual(revertOkData.lead.orderAmount, null);

      // Assign 'orden' again and revert solely via { promoCodeInvalidated: false, adminPassword }
      await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'orden', orderAmount: 3100 }),
      });
      const reactivateRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promoCodeInvalidated: false,
          adminPassword: 'AdminMaster2026@',
        }),
      });
      assert.strictEqual(reactivateRes.status, 200);
      const reactivateData = await reactivateRes.json();
      assert.strictEqual(reactivateData.lead.category, 'none');
      assert.strictEqual(reactivateData.lead.promoCodeInvalidated, false);
      assert.strictEqual(reactivateData.lead.promoCodeInvalidatedAt, null);
      assert.strictEqual(reactivateData.lead.orderAmount, null);

      // Verify qualification.cedeGoldenTicket passes cleanly through PATCH /api/leads/:id and GET /api/state
      const cedeRes = await fetch(`${baseUrl}/api/leads/${leadId}`, {
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
            productRating: null,
            cedeGoldenTicket: true,
          },
        }),
      });
      assert.strictEqual(cedeRes.status, 200);
      const cedeData = await cedeRes.json();
      assert.strictEqual(cedeData.lead.qualification?.cedeGoldenTicket, true);

      const adminStateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      assert.strictEqual(adminStateRes.status, 200);
      const adminState = await adminStateRes.json();
      const persistedLead = adminState.leads.find((l) => l.id === leadId);
      assert.strictEqual(persistedLead?.qualification?.cedeGoldenTicket, true);

      await fetch(`${baseUrl}/api/leads/${leadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
    });
  });

  describe('8. Master-Key Full Reset (POST /api/admin/reset-all)', () => {
    test('Unauthenticated and Caller requests to POST /api/admin/reset-all are REJECTED (401 / 403)', async () => {
      const unauthRes = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPassword: 'PoloNorte121966@' }),
      });
      assert.strictEqual(unauthRes.status, 401);

      const callerRes = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ masterPassword: 'PoloNorte121966@' }),
      });
      assert.strictEqual(callerRes.status, 403);
    });

    test('Admin POST /api/admin/reset-all rejects invalid masterPassword with 403 without wiping leads', async () => {
      const leadRes = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead Protegido Master',
          phone: '555-321-7777',
          address: 'Dallas, TX',
        }),
      });
      assert.strictEqual(leadRes.status, 201);

      const badRes = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ masterPassword: 'WrongMasterPassword!' }),
      });
      assert.strictEqual(badRes.status, 403);

      const stateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      const state = await stateRes.json();
      assert.ok(state.leads.some((l) => l.name === 'Lead Protegido Master'));
    });

    test('Admin POST /api/admin/reset-all with valid Master Password clears leads & QR history to 0 cleanly', async () => {
      const qrRes = await fetch(`${baseUrl}/api/qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'QR Temporal Reset',
          targetUrl: 'https://royal.ciprian.example/reset-test',
        }),
      });
      assert.strictEqual(qrRes.status, 201);

      const okRes = await fetch(`${baseUrl}/api/admin/reset-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterPassword: 'PoloNorte121966@',
          resetCatalogAndSettings: true,
        }),
      });
      assert.strictEqual(okRes.status, 200);
      const data = await okRes.json();
      assert.strictEqual(data.ok, true);
      assert.deepStrictEqual(data.state.leads, []);
      assert.deepStrictEqual(data.state.qrHistory, []);
      assert.strictEqual(data.state.gifts.length, 9);
      assert.strictEqual(data.state.settings.showcaseStyle, 'luminous-gold');
      assert.strictEqual(data.state.settings.randomizeGifts, true);
    });
  });
});
