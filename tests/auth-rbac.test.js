import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

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
    if (testLeadId && adminSessionToken) {
      try {
        await fetch(`${baseUrl}/api/leads/${testLeadId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        });
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
});
