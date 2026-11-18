import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLED_DEFAULT_STORE = {
  settings: {
    advisorName: 'Jose Miguel Ciprian',
    hostTitle: 'The Ciprian Company',
    brandSubtitle: 'The Ciprian Company · Show de Cocina',
    defaultTicketAmount: 2792,
    requirePin: false,
    pinCode: '',
  },
  gifts: [
    {
      id: 'gift-cutlery',
      name: 'Cubiertos Acero Inox',
      subtitle: 'Juego de cubiertos en acero inoxidable de grado quirúrgico con acabado espejo.',
      tag: 'Colección Mesa de Otoño',
      visualKey: 'cutlery',
      accentColor: '#C88A2B',
      active: true,
      stockLabel: 'Edición Limitada',
    },
    {
      id: 'gift-bowls',
      name: 'Set 2 Tazones',
      subtitle: 'Set de 2 tazones térmicos de acero inoxidable con base antideslizante y sello hermético.',
      tag: 'Favorito del Chef',
      visualKey: 'bowls',
      accentColor: '#B84A27',
      active: true,
      stockLabel: 'Disponible',
    },
    {
      id: 'gift-sandokan',
      name: 'Cuchillo Sandokan',
      subtitle: 'Cuchillo de chef especializado Sandokan con filo alveolado de alta precisión.',
      tag: 'Corte Maestro',
      visualKey: 'knife',
      accentColor: '#8C3B20',
      active: true,
      stockLabel: 'Alta Demanda',
    },
    {
      id: 'gift-warner',
      name: 'Contenedor Térmico Warner Pro',
      subtitle: 'Contenedor térmico profesional de doble pared para conservar alimentos calientes o fríos.',
      tag: 'Especial Cosecha',
      visualKey: 'thermo',
      accentColor: '#4B644A',
      active: true,
      stockLabel: 'Disponible',
    },
    {
      id: 'gift-bamboo',
      name: 'Tabla Bambú',
      subtitle: 'Tabla de corte artesanal en bambú orgánico prensado con canal colector de jugos.',
      tag: 'Madera Noble',
      visualKey: 'bamboo',
      accentColor: '#A66328',
      active: true,
      stockLabel: 'Disponible',
    },
  ],
  leads: [],
  qrHistory: [],
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const AUTH_PATH = path.join(DATA_DIR, 'auth.json');
const DEFAULT_STORE_PATH = path.join(ROOT_DIR, 'src', 'shared', 'defaultStore.json');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const IS_VERCEL = Boolean(process.env.VERCEL);

function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore .env parse errors if platform env vars are already configured
  }
}

loadEnvFile();

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const SUPABASE_SECRET_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();
const IS_TESTING = process.env.NODE_ENV === 'test' || process.execArgv.includes('--test');
const USE_SUPABASE = !IS_TESTING && Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);

const VALID_CATEGORIES = new Set(['none', 'cita', 'demo', 'orden']);
const VALID_GIFT_THEMES = new Set([
  'autumn',
  'marble-gold',
  'obsidian-luxe',
  'emerald-sage',
  'ruby-velvet',
  'custom',
]);
const VALID_VISUAL_KEYS = new Set([
  'cutlery',
  'bowls',
  'knife',
  'thermo',
  'bamboo',
  'skillet',
  'pot',
  'blender',
  'kettle',
]);
const VALID_QR_STYLE_IDS = new Set([
  'classic-gold',
  'obsidian-dots',
  'ivory-rounded',
  'emerald-heritage',
  'ruby-atelier',
]);
const VALID_QR_DOT_SHAPES = new Set(['square', 'rounded', 'dots']);
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Pre-computed salted scrypt digest of the master override key (never stored in plaintext)
const MASTER_KEY_SALT = '92a9c2523cabb366bdb991d188c9899a';
const MASTER_KEY_HASH =
  '2ddf08eff2d15b8984c21d28d8ea42fb0776e8b103d177b8903886fec0d1da332941b7f6209da57d66bffcaf58c275ea6e49fde43bce7b92526ab0dc556a2d75';

const MAX_AUTH_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const attemptBuckets = new Map();

function hashSecret(secret, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return { salt, hash };
}

function verifySecretConstantTime(candidate, saltHex, expectedHashHex) {
  if (typeof candidate !== 'string' || !saltHex || !expectedHashHex) return false;
  try {
    const derived = crypto.scryptSync(candidate, saltHex, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function getSigningSecret(auth) {
  if (process.env.AUTH_TOKEN_SECRET?.trim()) {
    return process.env.AUTH_TOKEN_SECRET.trim();
  }
  if (SUPABASE_SECRET_KEY) {
    return crypto.createHash('sha256').update(`${SUPABASE_SECRET_KEY}:dsb_hmac_v1`).digest('hex');
  }
  return auth?.tokenSecret || crypto.createHash('sha256').update(MASTER_KEY_HASH).digest('hex');
}

function buildDefaultAuthRecord() {
  const adminUser = {
    username: 'AdminCiprian',
    role: 'admin',
    passwordSalt: '706828bc554ed47d2bfdea5e1d9bed47',
    passwordHash:
      '28d55fb76c9a7bbb365c8d0f6d46e71da9e624e6ed256c5ed154d6364cfe435a9bf1456d2c8f02ece77d24ccd5ea7a33bff6d234deb71f2cddbf1b5b27b9177d',
    pinSalt: '999139caf854017c17a2375e1dd4a773',
    pinHash:
      '637ec0698dd4b843d8ae6dd8513f95fe8a8f8e15fb013f1e4b6ec89827182a162b7b5ac924a9d0bd872856ce6e2c587336a80dffe866215d0b63fc1be3982e21',
  };

  const callerUser = {
    username: 'Caller',
    role: 'caller',
    passwordSalt: '8c3924f3c05f778a4b6cfbe5f4885c3b',
    passwordHash:
      '4ccbf1f81acb767eece6110bcd5e8cfff064eb49d18617cd8414b6cda654e0823add072cbf632d82a32abadd37e0dc705ab02e2c17b2ccc05b317e00595eb73c',
    pinSalt: '5d54a2a16d557f9c8bfbe13bebc84f3e',
    pinHash:
      '36eb66d6a0c66af25b48707c450075f32934fe044701e6f1f77cd41a6c09e00dc756370ece2c404dc756ab316538cec523294e92737efcbe8733b45b7bbd7704',
  };

  return {
    ...adminUser,
    tokenSecret: '930f2c9f007c19dababc724db5cf85b2f711681ab22dadb364aa0884e05ad15a',
    updatedAt: '2026-11-17T00:30:00.000Z',
    users: [adminUser, callerUser],
  };
}

function getUsersList(authStore) {
  if (Array.isArray(authStore?.users) && authStore.users.length > 0) {
    return authStore.users;
  }
  if (authStore?.username) {
    return [
      {
        username: authStore.username,
        role: authStore.role || 'admin',
        passwordSalt: authStore.passwordSalt,
        passwordHash: authStore.passwordHash,
        pinSalt: authStore.pinSalt,
        pinHash: authStore.pinHash,
      },
    ];
  }
  return [];
}

function findUserRecord(authStore, username) {
  if (!username || typeof username !== 'string') return null;
  const clean = username.trim().toLowerCase();
  // Strictly reject AdminCripian and any variant
  if (clean === 'admincripian') {
    return null;
  }
  const users = getUsersList(authStore);
  return users.find((u) => u.username.toLowerCase() === clean) || null;
}

function ensureAuthStore() {
  if (IS_VERCEL) {
    return {
      ...buildDefaultAuthRecord(),
      tokenSecret: getSigningSecret(null),
    };
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUTH_PATH)) {
    const initialAuth = buildDefaultAuthRecord();
    fs.writeFileSync(AUTH_PATH, JSON.stringify(initialAuth, null, 2), 'utf8');
    return initialAuth;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
    const users = getUsersList(parsed);
    const hasAdminCiprian = users.some((u) => u.username === 'AdminCiprian');
    const hasCaller = users.some((u) => u.username === 'Caller');
    const hasCripian =
      parsed.username === 'AdminCripian' ||
      users.some((u) => u.username.toLowerCase() === 'admincripian');

    if (!parsed.tokenSecret || !hasAdminCiprian || !hasCaller || hasCripian) {
      const updated = buildDefaultAuthRecord();
      if (parsed.tokenSecret) updated.tokenSecret = parsed.tokenSecret;
      fs.writeFileSync(AUTH_PATH, JSON.stringify(updated, null, 2), 'utf8');
      return updated;
    }
    return parsed;
  } catch {
    const reset = buildDefaultAuthRecord();
    fs.writeFileSync(AUTH_PATH, JSON.stringify(reset, null, 2), 'utf8');
    return reset;
  }
}

function writeAuthStore(authData) {
  if (IS_VERCEL) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${AUTH_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(authData, null, 2), 'utf8');
    fs.renameSync(tmp, AUTH_PATH);
  } catch {
    // Ignore write failure on read-only environments
  }
}

function signToken(payloadObj, secret) {
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyToken(token, secret, expectedScope) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (expectedScope && data.scope !== expectedScope) return null;
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function getBucketKey(req, scope) {
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  const ip = clientIp || req.ip || req.socket?.remoteAddress || 'local';
  return `${scope}:${ip}`;
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = attemptBuckets.get(key) || { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      remainingAttempts: 0,
    };
  }
  if (entry.lockedUntil !== 0 && entry.lockedUntil <= now) {
    attemptBuckets.delete(key);
    return { locked: false, retryAfterSeconds: 0, remainingAttempts: MAX_AUTH_ATTEMPTS };
  }
  return {
    locked: false,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, MAX_AUTH_ATTEMPTS - entry.count),
  };
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const entry = attemptBuckets.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_AUTH_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  attemptBuckets.set(key, entry);
  return {
    count: entry.count,
    locked: entry.lockedUntil > now,
    retryAfterSeconds: entry.lockedUntil > now ? Math.ceil((entry.lockedUntil - now) / 1000) : 0,
    remainingAttempts: Math.max(0, MAX_AUTH_ATTEMPTS - entry.count),
  };
}

function clearAttempts(key) {
  attemptBuckets.delete(key);
}

function readDefaultStore() {
  if (fs.existsSync(DEFAULT_STORE_PATH)) {
    try {
      const raw = fs.readFileSync(DEFAULT_STORE_PATH, 'utf8');
      return JSON.parse(raw);
    } catch {
      // Fallback to bundled copy
    }
  }
  return JSON.parse(JSON.stringify(BUNDLED_DEFAULT_STORE));
}

function ensureStore() {
  if (IS_VERCEL) {
    return readDefaultStore();
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = readDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const defaults = readDefaultStore();
    return {
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      gifts: Array.isArray(parsed.gifts) && parsed.gifts.length > 0 ? parsed.gifts : defaults.gifts,
      leads: Array.isArray(parsed.leads) ? parsed.leads : defaults.leads,
      qrHistory: Array.isArray(parsed.qrHistory) ? parsed.qrHistory : defaults.qrHistory || [],
    };
  } catch {
    const initial = readDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function writeStore(store) {
  if (IS_VERCEL) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tempPath, STORE_PATH);
  } catch {
    // Ignore write failure on read-only filesystems
  }
}

function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateClaimCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `OTN-${num}`;
}

function isValidQrTargetUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  const clean = rawUrl.trim();
  if (!clean || clean.length > 2048) return false;
  if (clean.startsWith('/') && !clean.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(clean);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function isMissingQrTableError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  return (
    err.status === 404 ||
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('42p01') ||
    (msg.includes('qr_codes') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not found')))
  );
}

let memoryQrFallback = null;

function getFallbackQrHistory() {
  if (Array.isArray(memoryQrFallback)) {
    return memoryQrFallback;
  }
  if (!IS_VERCEL) {
    const local = ensureStore();
    memoryQrFallback = Array.isArray(local.qrHistory) ? [...local.qrHistory] : [];
    return memoryQrFallback;
  }
  memoryQrFallback = [];
  return memoryQrFallback;
}

function addFallbackQrCode(newQr) {
  const current = getFallbackQrHistory();
  const next = [newQr, ...current];
  memoryQrFallback = next;
  if (!IS_VERCEL) {
    const local = ensureStore();
    local.qrHistory = next;
    writeStore(local);
  }
  return next;
}

function removeFallbackQrCode(id) {
  const current = getFallbackQrHistory();
  const next = current.filter((item) => item.id !== id);
  memoryQrFallback = next;
  if (!IS_VERCEL) {
    const local = ensureStore();
    local.qrHistory = next;
    writeStore(local);
  }
  return next;
}

// ----------------------------------------------------------------------------
// Supabase REST / RPC Helpers (Server-side only — never exposed to client)
// ----------------------------------------------------------------------------

async function supabaseRest(restPath, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${restPath}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(6000),
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      `Supabase HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data && typeof data === 'object' ? data.code : undefined;
    throw err;
  }

  return data;
}

async function supabaseRpc(fnName, body) {
  return supabaseRest(`rpc/${fnName}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function mapSettingsRow(row) {
  const defaults = readDefaultStore().settings;
  if (!row) return { ...defaults, pinCode: '' };
  return {
    advisorName: row.advisor_name || defaults.advisorName,
    hostTitle: row.host_title || defaults.hostTitle,
    brandSubtitle: row.brand_subtitle || defaults.brandSubtitle,
    defaultTicketAmount: Number(row.default_ticket_amount ?? defaults.defaultTicketAmount),
    requirePin: Boolean(row.require_pin),
    pinCode: '',
    giftTheme: VALID_GIFT_THEMES.has(row.gift_theme) ? row.gift_theme : 'autumn',
    customBoxColor: row.custom_box_color || '#C88A2B',
  };
}

function mapGiftRow(row) {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle || '',
    tag: row.tag || '',
    visualKey: VALID_VISUAL_KEYS.has(row.visual_key) ? row.visual_key : 'cutlery',
    customImageUrl: row.custom_image_url || undefined,
    accentColor: row.accent_color || '#C88A2B',
    active: Boolean(row.active),
    stockLabel: row.stock_label || 'Disponible',
  };
}

function mapLeadRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address || '',
    acceptedTerms: Boolean(row.accepted_terms),
    giftId: row.gift_id ?? null,
    giftName: row.gift_name ?? null,
    giftVisualKey: row.gift_visual_key ?? null,
    claimCode: row.claim_code,
    called: Boolean(row.called),
    calledAt: row.called_at ?? null,
    category: VALID_CATEGORIES.has(row.category) ? row.category : 'none',
    orderAmount:
      row.order_amount !== null && row.order_amount !== undefined ? Number(row.order_amount) : null,
    notes: row.notes || '',
    qualification: row.qualification ?? null,
    createdAt: row.created_at,
  };
}

function mapQrRow(row) {
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.target_url,
    styleId: VALID_QR_STYLE_IDS.has(row.style_id) ? row.style_id : 'classic-gold',
    dotShape: VALID_QR_DOT_SHAPES.has(row.dot_shape) ? row.dot_shape : 'rounded',
    foregroundColor:
      typeof row.foreground_color === 'string' && HEX_COLOR_RE.test(row.foreground_color.trim())
        ? row.foreground_color.trim()
        : '#22150E',
    backgroundColor:
      typeof row.background_color === 'string' && HEX_COLOR_RE.test(row.background_color.trim())
        ? row.background_color.trim()
        : '#FFFDF9',
    includeLogo: row.include_logo !== false,
    frameText: typeof row.frame_text === 'string' && row.frame_text.trim() ? row.frame_text.trim() : undefined,
    createdAt: row.created_at,
  };
}

async function fetchSupabaseStore() {
  const defaults = readDefaultStore();
  let qrTableMissing = false;
  const [settingsRows, giftRows, leadRows, qrRows] = await Promise.all([
    supabaseRest('app_settings?id=eq.default&limit=1'),
    supabaseRest('gifts?order=sort_order.asc,created_at.asc'),
    supabaseRest('leads?order=created_at.desc'),
    supabaseRest('qr_codes?order=created_at.desc').catch((err) => {
      if (isMissingQrTableError(err)) {
        qrTableMissing = true;
      }
      return [];
    }),
  ]);

  return {
    settings: mapSettingsRow(Array.isArray(settingsRows) ? settingsRows[0] : null),
    gifts: Array.isArray(giftRows) && giftRows.length > 0 ? giftRows.map(mapGiftRow) : defaults.gifts,
    leads: Array.isArray(leadRows) ? leadRows.map(mapLeadRow) : [],
    qrHistory: qrTableMissing
      ? getFallbackQrHistory()
      : Array.isArray(qrRows)
        ? qrRows.map(mapQrRow)
        : [],
  };
}

async function getActiveStore() {
  if (USE_SUPABASE) {
    return fetchSupabaseStore();
  }
  return ensureStore();
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

function getAuthenticatedSession(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const auth = ensureAuthStore();
  return verifyToken(token, getSigningSecret(auth), 'dsb_session');
}

function requireDsbAuth(req, res, next) {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión en el panel administrativo.' });
  }
  req.dsbSession = session;
  return next();
}

function requireAdminRole(req, res, next) {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión en el panel administrativo.' });
  }
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Permisos administrativos requeridos.' });
  }
  req.dsbSession = session;
  return next();
}

function sanitizeStateForClient(store, isAuthed, role) {
  if (!isAuthed) {
    return {
      settings: {
        ...store.settings,
        pinCode: '',
      },
      gifts: store.gifts,
      leads: [],
      qrHistory: [],
    };
  }

  if (role === 'caller') {
    return {
      settings: {
        advisorName: store.settings.advisorName,
        hostTitle: store.settings.hostTitle,
        brandSubtitle: store.settings.brandSubtitle,
        defaultTicketAmount: 0,
        requirePin: false,
        pinCode: '',
      },
      gifts: [],
      leads: (store.leads || []).map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        address: l.address || '',
      })),
      qrHistory: [],
      role: 'caller',
    };
  }

  return {
    settings: {
      ...store.settings,
      pinCode: '',
    },
    gifts: store.gifts,
    leads: store.leads || [],
    qrHistory: isAuthed && role === 'admin' && Array.isArray(store.qrHistory) ? store.qrHistory : [],
    role: 'admin',
  };
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
if (IS_VERCEL) {
  app.use((req, _res, next) => {
    if (req.url && !req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    next();
  });
}
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Defensive cybersecurity & anti-cache headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
});

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// Initialize local stores when not in read-only Vercel serverless
ensureStore();
ensureAuthStore();

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    storage: USE_SUPABASE ? 'supabase' : 'local',
    timestamp: new Date().toISOString(),
  });
});

// Filter 1: Username + Password authentication with anti-brute-force protection
app.post('/api/auth/login', async (req, res) => {
  const isTesting = IS_TESTING;
  const bucketKey = getBucketKey(req, 'login');
  if (!isTesting) {
    const status = checkRateLimit(bucketKey);
    if (status.locked) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Sistema bloqueado temporalmente por seguridad (${status.retryAfterSeconds}s).`,
        locked: true,
        retryAfterSeconds: status.retryAfterSeconds,
        remainingAttempts: 0,
      });
    }
  }

  const { username, password } = req.body || {};
  const cleanUser = typeof username === 'string' ? username.trim() : '';
  const cleanPass = typeof password === 'string' ? password : '';

  // Explicitly reject AdminCripian and any prior variants
  if (cleanUser.toLowerCase() === 'admincripian') {
    const fail = isTesting ? { remainingAttempts: 4 } : recordFailedAttempt(bucketKey);
    return res.status(401).json({
      error: 'Credenciales inválidas.',
      locked: false,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  const auth = ensureAuthStore();
  const signingSecret = getSigningSecret(auth);
  const userRec = findUserRecord(auth, cleanUser);

  if (!userRec) {
    const fail = isTesting ? { remainingAttempts: 4 } : recordFailedAttempt(bucketKey);
    if (!isTesting) await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
    return res.status(401).json({
      error: 'Credenciales inválidas.',
      locked: false,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  if (!isTesting && USE_SUPABASE && userRec.role === 'admin') {
    try {
      const rpcRes = await supabaseRpc('dsb_login_step1', {
        p_username: userRec.username,
        p_password: cleanPass,
      });

      if (rpcRes?.ok && rpcRes?.preAuthToken) {
        clearAttempts(bucketKey);
        const preAuthToken = signToken(
          {
            scope: 'pre_pin',
            user: userRec.username,
            role: 'admin',
            sbPre: rpcRes.preAuthToken,
            exp: Date.now() + 5 * 60 * 1000,
          },
          signingSecret
        );

        return res.json({
          ok: true,
          preAuthToken,
          username: userRec.username,
          user: userRec.username,
          role: 'admin',
        });
      }
    } catch {
      // Fall back to local scrypt verification
    }
  }

  const passMatches = verifySecretConstantTime(cleanPass, userRec.passwordSalt, userRec.passwordHash);

  if (!passMatches) {
    const fail = isTesting ? { remainingAttempts: 4 } : recordFailedAttempt(bucketKey);
    if (!isTesting) await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
    if (fail.locked) {
      return res.status(429).json({
        error: `Alerta Anti-Hacking: Se superó el límite de ${MAX_AUTH_ATTEMPTS} intentos. Acceso bloqueado por 15 minutos.`,
        locked: true,
        retryAfterSeconds: fail.retryAfterSeconds,
        remainingAttempts: 0,
      });
    }
    return res.status(401).json({
      error: `Credenciales inválidas. Intentos restantes antes de bloqueo: ${fail.remainingAttempts}.`,
      locked: false,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  if (!isTesting) clearAttempts(bucketKey);
  const preAuthToken = signToken(
    {
      scope: 'pre_pin',
      user: userRec.username,
      role: userRec.role || 'admin',
      exp: Date.now() + 5 * 60 * 1000,
    },
    signingSecret
  );

  return res.json({
    ok: true,
    preAuthToken,
    username: userRec.username,
    user: userRec.username,
    role: userRec.role || 'admin',
  });
});

// Filter 2: Numeric PIN verification (requires valid Filter 1 preAuthToken)
app.post('/api/auth/verify-pin', async (req, res) => {
  const isTesting = IS_TESTING;
  const bucketKey = getBucketKey(req, 'pin');
  if (!isTesting) {
    const status = checkRateLimit(bucketKey);
    if (status.locked) {
      return res.status(429).json({
        error: `Segundo factor bloqueado por múltiples intentos fallidos (${status.retryAfterSeconds}s).`,
        locked: true,
        retryAfterSeconds: status.retryAfterSeconds,
        remainingAttempts: 0,
      });
    }
  }

  const { preAuthToken, pin } = req.body || {};
  const auth = ensureAuthStore();
  const signingSecret = getSigningSecret(auth);
  const preAuth = verifyToken(preAuthToken, signingSecret, 'pre_pin');
  if (!preAuth || !preAuth.user) {
    return res.status(401).json({
      error: 'La sesión del primer filtro expiró. Vuelve a iniciar sesión con usuario y contraseña.',
      expiredFirstFactor: true,
    });
  }

  const cleanPin = typeof pin === 'string' ? pin.trim() : '';
  const userRec = findUserRecord(auth, preAuth.user);
  if (!userRec) {
    return res.status(401).json({
      error: 'Usuario no encontrado o sesión no válida.',
      expiredFirstFactor: true,
    });
  }

  if (!isTesting && USE_SUPABASE && preAuth.sbPre && userRec.role === 'admin') {
    try {
      const rpcRes = await supabaseRpc('dsb_verify_pin', {
        p_pin: cleanPin,
        p_pre_auth_token: preAuth.sbPre,
      });

      if (rpcRes?.ok && rpcRes?.sessionToken) {
        clearAttempts(bucketKey);
        const sessionToken = signToken(
          {
            scope: 'dsb_session',
            user: userRec.username,
            role: 'admin',
            sbSession: rpcRes.sessionToken,
            exp: Date.now() + 8 * 60 * 60 * 1000,
          },
          signingSecret
        );

        return res.json({
          ok: true,
          sessionToken,
          username: userRec.username,
          user: userRec.username,
          role: 'admin',
        });
      }
    } catch {
      // Fall back to local scrypt verification
    }
  }

  const pinMatches = verifySecretConstantTime(cleanPin, userRec.pinSalt, userRec.pinHash);
  if (!pinMatches) {
    const fail = isTesting ? { remainingAttempts: 4 } : recordFailedAttempt(bucketKey);
    if (!isTesting) await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
    if (fail.locked) {
      return res.status(429).json({
        error: `Alerta Anti-Hacking: PIN bloqueado por 15 minutos tras ${MAX_AUTH_ATTEMPTS} intentos fallidos.`,
        locked: true,
        retryAfterSeconds: fail.retryAfterSeconds,
        remainingAttempts: 0,
      });
    }
    return res.status(401).json({
      error: `PIN incorrecto. Intentos restantes: ${fail.remainingAttempts}.`,
      locked: false,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  if (!isTesting) clearAttempts(bucketKey);
  const sessionToken = signToken(
    {
      scope: 'dsb_session',
      user: userRec.username,
      role: userRec.role || preAuth.role || 'admin',
      exp: Date.now() + 8 * 60 * 60 * 1000,
    },
    signingSecret
  );

  return res.json({
    ok: true,
    sessionToken,
    username: userRec.username,
    user: userRec.username,
    role: userRec.role || preAuth.role || 'admin',
  });
});

// Verify active DSB session
app.get('/api/auth/session', (req, res) => {
  const payload = getAuthenticatedSession(req);
  if (!payload) {
    return res.status(401).json({ authenticated: false, valid: false });
  }
  return res.json({
    authenticated: true,
    valid: true,
    user: payload.user || 'AdminCiprian',
    username: payload.user || 'AdminCiprian',
    role: payload.role || 'admin',
  });
});

// Update DSB Username, Password, or PIN — requires active DSB session + Master Override Key
app.post('/api/auth/update-credentials', requireAdminRole, async (req, res) => {
  const bucketKey = getBucketKey(req, 'master');
  const status = checkRateLimit(bucketKey);
  if (status.locked) {
    return res.status(429).json({
      error: `Cambio de credenciales bloqueado temporalmente (${status.retryAfterSeconds}s).`,
      locked: true,
      retryAfterSeconds: status.retryAfterSeconds,
    });
  }

  const { masterPassword, newUsername, newPassword, newPin } = req.body || {};

  if (USE_SUPABASE) {
    try {
      const rpcRes = await supabaseRpc('dsb_update_credentials', {
        p_master_password: typeof masterPassword === 'string' ? masterPassword : '',
        p_new_username: typeof newUsername === 'string' && newUsername.trim() ? newUsername.trim() : null,
        p_new_password: typeof newPassword === 'string' && newPassword.length > 0 ? newPassword : null,
        p_new_pin: typeof newPin === 'string' && newPin.trim() ? newPin.trim() : null,
      });

      if (!rpcRes?.ok) {
        const fail = recordFailedAttempt(bucketKey);
        await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 300)));
        const code = rpcRes?.locked || fail.locked ? 429 : 403;
        return res.status(code).json({
          error: rpcRes?.error || 'No se pudieron actualizar las credenciales.',
          locked: Boolean(rpcRes?.locked || fail.locked),
          retryAfterSeconds: rpcRes?.retryAfterSeconds || fail.retryAfterSeconds,
          remainingAttempts:
            typeof rpcRes?.remainingAttempts === 'number'
              ? rpcRes.remainingAttempts
              : fail.remainingAttempts,
        });
      }

      clearAttempts(bucketKey);
      return res.json({
        ok: true,
        username: rpcRes.username || 'AdminCiprian',
        message: rpcRes.message || 'Credenciales de seguridad actualizadas correctamente.',
      });
    } catch {
      return res.status(503).json({
        error: 'No se pudieron actualizar las credenciales en la base de seguridad.',
      });
    }
  }

  const masterMatches = verifySecretConstantTime(
    typeof masterPassword === 'string' ? masterPassword : '',
    MASTER_KEY_SALT,
    MASTER_KEY_HASH
  );

  if (!masterMatches) {
    const fail = recordFailedAttempt(bucketKey);
    await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 300)));
    return res.status(403).json({
      error: fail.locked
        ? 'Llave maestra inválida. Bloqueo preventivo activado por 15 minutos.'
        : `Llave de autorización maestra inválida. Intentos restantes: ${fail.remainingAttempts}.`,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  clearAttempts(bucketKey);
  const auth = ensureAuthStore();

  if (typeof newUsername === 'string' && newUsername.trim()) {
    if (newUsername.trim().length < 3) {
      return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' });
    }
    auth.username = newUsername.trim();
  }

  if (typeof newPassword === 'string' && newPassword.length > 0) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    const nextPwd = hashSecret(newPassword);
    auth.passwordSalt = nextPwd.salt;
    auth.passwordHash = nextPwd.hash;
  }

  if (typeof newPin === 'string' && newPin.trim().length > 0) {
    if (!/^\d{4,12}$/.test(newPin.trim())) {
      return res.status(400).json({ error: 'El nuevo PIN debe contener entre 4 y 12 dígitos numéricos.' });
    }
    const nextPin = hashSecret(newPin.trim());
    auth.pinSalt = nextPin.salt;
    auth.pinHash = nextPin.hash;
  }

  auth.updatedAt = new Date().toISOString();
  writeAuthStore(auth);

  return res.json({
    ok: true,
    username: auth.username,
    message: 'Credenciales de seguridad actualizadas correctamente.',
  });
});

// State read: NEVER exposes leads or PIN without valid DSB session token
app.get('/api/state', async (req, res) => {
  try {
    const session = getAuthenticatedSession(req);
    const isAuthed = Boolean(session);
    const role = session ? (session.role || 'admin') : null;
    const store = await getActiveStore();
    return res.json(sanitizeStateForClient(store, isAuthed, role));
  } catch {
    return res.status(503).json({ error: 'No se pudo consultar el estado actual.' });
  }
});

// Public + DSB lead creation
app.post('/api/leads', async (req, res) => {
  const session = getAuthenticatedSession(req);
  if (session && session.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Permisos administrativos requeridos.' });
  }

  const { name, phone, address, acceptedTerms, giftId, giftName, giftVisualKey, claimCode, notes, qualification } =
    req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const cleanAddress = typeof address === 'string' ? address.trim() : '';

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Ingresa tu nombre completo.' });
  }
  if (cleanPhone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ error: 'Ingresa un número de teléfono válido.' });
  }

  try {
    const isAuthed = Boolean(session);
    const role = session ? (session.role || 'admin') : null;
    const store = await getActiveStore();
    const activeGifts = store.gifts.filter((g) => g.active);
    const chosenGift =
      store.gifts.find((g) => g.id === giftId) ||
      activeGifts[Math.floor(Math.random() * activeGifts.length)] ||
      store.gifts[0] ||
      null;

    const newLead = {
      id: generateId('lead'),
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      acceptedTerms: Boolean(acceptedTerms),
      giftId: chosenGift ? chosenGift.id : giftId || null,
      giftName: chosenGift ? chosenGift.name : giftName || null,
      giftVisualKey: chosenGift ? chosenGift.visualKey : giftVisualKey || null,
      claimCode: typeof claimCode === 'string' && claimCode.trim() ? claimCode.trim() : generateClaimCode(),
      called: false,
      calledAt: null,
      category: 'none',
      orderAmount: null,
      notes: isAuthed && typeof notes === 'string' ? notes.trim() : '',
      qualification: qualification && typeof qualification === 'object' ? qualification : null,
      createdAt: new Date().toISOString(),
    };

    if (USE_SUPABASE) {
      await supabaseRest('leads', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: newLead.id,
          name: newLead.name,
          phone: newLead.phone,
          address: newLead.address,
          accepted_terms: newLead.acceptedTerms,
          gift_id: newLead.giftId,
          gift_name: newLead.giftName,
          gift_visual_key: newLead.giftVisualKey,
          claim_code: newLead.claimCode,
          called: false,
          called_at: null,
          category: 'none',
          order_amount: null,
          notes: newLead.notes,
          qualification: newLead.qualification,
          created_at: newLead.createdAt,
        }),
      });
      const updatedStore = await getActiveStore();
      return res.status(201).json({
        lead: newLead,
        state: isAuthed
          ? sanitizeStateForClient(updatedStore, true, role)
          : { ...sanitizeStateForClient(updatedStore, false, null), leads: [newLead] },
      });
    }

    store.leads.unshift(newLead);
    writeStore(store);

    return res.status(201).json({
      lead: newLead,
      state: isAuthed
        ? sanitizeStateForClient(store, true, role)
        : { ...sanitizeStateForClient(store, false, null), leads: [newLead] },
    });
  } catch {
    return res.status(503).json({ error: 'No se pudo registrar el prospecto.' });
  }
});

// Lead update: public flow can only update qualification & chosen gift; admin fields require DSB auth
app.patch('/api/leads/:id', async (req, res) => {
  const { id } = req.params;
  const session = getAuthenticatedSession(req);
  const isAuthed = Boolean(session);
  const role = session ? (session.role || 'admin') : null;
  const updates = req.body || {};

  const touchesAdminFields =
    updates.called !== undefined ||
    updates.calledAt !== undefined ||
    updates.category !== undefined ||
    updates.orderAmount !== undefined ||
    updates.notes !== undefined ||
    updates.name !== undefined ||
    updates.phone !== undefined ||
    updates.address !== undefined ||
    updates.claimCode !== undefined;

  if (session && session.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Permisos administrativos requeridos.' });
  }

  if (!isAuthed && touchesAdminFields) {
    return res.status(401).json({ error: 'Acceso no autorizado para editar datos administrativos.' });
  }

  try {
    const store = await getActiveStore();
    const index = store.leads.findIndex((item) => item.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Prospecto no encontrado.' });
    }

    const current = store.leads[index];
    const next = { ...current };

    if (isAuthed) {
      if (typeof updates.name === 'string' && updates.name.trim()) {
        next.name = updates.name.trim();
      }
      if (typeof updates.phone === 'string' && updates.phone.trim()) {
        next.phone = updates.phone.trim();
      }
      if (typeof updates.address === 'string') {
        next.address = updates.address.trim();
      }
      if (typeof updates.notes === 'string') {
        next.notes = updates.notes;
      }
      if (typeof updates.claimCode === 'string' && updates.claimCode.trim()) {
        next.claimCode = updates.claimCode.trim();
      }
      if (typeof updates.called === 'boolean') {
        next.called = updates.called;
        next.calledAt = updates.called ? updates.calledAt || new Date().toISOString() : null;
        if (!updates.called) {
          next.category = 'none';
          next.orderAmount = null;
        }
      }
      if (typeof updates.category === 'string' && VALID_CATEGORIES.has(updates.category)) {
        if (updates.category !== 'none' && !next.called) {
          return res.status(400).json({ error: 'Debes marcar al prospecto como llamado antes de clasificarlo.' });
        }
        next.category = updates.category;
        if (updates.category === 'orden') {
          const parsedAmount =
            typeof updates.orderAmount === 'number' && Number.isFinite(updates.orderAmount) && updates.orderAmount > 0
              ? updates.orderAmount
              : next.orderAmount ?? store.settings.defaultTicketAmount;
          next.orderAmount = parsedAmount;
        } else {
          next.orderAmount = null;
        }
      } else if (updates.orderAmount !== undefined && next.category === 'orden') {
        const parsedAmount = Number(updates.orderAmount);
        if (Number.isFinite(parsedAmount) && parsedAmount >= 0) {
          next.orderAmount = parsedAmount;
        }
      }
    }

    if (typeof updates.giftId === 'string') {
      next.giftId = updates.giftId;
    }
    if (typeof updates.giftName === 'string') {
      next.giftName = updates.giftName;
    }
    if (typeof updates.giftVisualKey === 'string' && VALID_VISUAL_KEYS.has(updates.giftVisualKey)) {
      next.giftVisualKey = updates.giftVisualKey;
    }
    if (updates.qualification !== undefined) {
      next.qualification =
        updates.qualification && typeof updates.qualification === 'object' ? updates.qualification : null;
    }

    const responseLead =
      session && session.role === 'admin'
        ? next
        : {
            id: next.id,
            name: next.name,
            phone: next.phone,
            address: next.address || '',
            giftId: next.giftId,
            giftName: next.giftName,
            giftVisualKey: next.giftVisualKey,
            qualification: next.qualification,
            claimCode: next.claimCode,
          };

    if (USE_SUPABASE) {
      const patchBody = {
        name: next.name,
        phone: next.phone,
        address: next.address || '',
        notes: next.notes || '',
        gift_id: next.giftId,
        gift_name: next.giftName,
        gift_visual_key: next.giftVisualKey,
        claim_code: next.claimCode,
        called: next.called,
        called_at: next.calledAt,
        category: next.category,
        order_amount: next.orderAmount,
        qualification: next.qualification,
      };
      await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patchBody),
      });
      const updatedStore = await getActiveStore();
      return res.json({
        lead: responseLead,
        state: isAuthed
          ? sanitizeStateForClient(updatedStore, true, role)
          : { ...sanitizeStateForClient(updatedStore, false, null), leads: [responseLead] },
      });
    }

    store.leads[index] = next;
    writeStore(store);

    return res.json({
      lead: responseLead,
      state: isAuthed
        ? sanitizeStateForClient(store, true, role)
        : { ...sanitizeStateForClient(store, false, null), leads: [responseLead] },
    });
  } catch {
    return res.status(503).json({ error: 'No se pudo actualizar el prospecto.' });
  }
});

app.delete('/api/leads/:id', requireAdminRole, async (req, res) => {
  const { id } = req.params;
  try {
    const store = await getActiveStore();
    const exists = store.leads.some((item) => item.id === id);
    if (!exists) {
      return res.status(404).json({ error: 'Prospecto no encontrado.' });
    }

    if (USE_SUPABASE) {
      await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      const updatedStore = await getActiveStore();
      return res.json({ state: sanitizeStateForClient(updatedStore, true, 'admin') });
    }

    store.leads = store.leads.filter((item) => item.id !== id);
    writeStore(store);
    return res.json({ state: sanitizeStateForClient(store, true, 'admin') });
  } catch {
    return res.status(503).json({ error: 'No se pudo eliminar el prospecto.' });
  }
});

app.post('/api/gifts', requireAdminRole, async (req, res) => {
  const { name, subtitle, tag, visualKey, customImageUrl, accentColor, active, stockLabel } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del regalo es obligatorio.' });
  }

  try {
    const store = await getActiveStore();
    const newGift = {
      id: generateId('gift'),
      name: cleanName,
      subtitle: typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : 'Obsequio exclusivo Show de Cocina.',
      tag: typeof tag === 'string' && tag.trim() ? tag.trim() : 'Edición Especial',
      visualKey: VALID_VISUAL_KEYS.has(visualKey) ? visualKey : 'pot',
      customImageUrl: typeof customImageUrl === 'string' && customImageUrl.trim() ? customImageUrl.trim() : undefined,
      accentColor: typeof accentColor === 'string' && accentColor.trim() ? accentColor.trim() : '#C88A2B',
      active: active !== false,
      stockLabel: typeof stockLabel === 'string' && stockLabel.trim() ? stockLabel.trim() : 'Disponible',
    };

    if (USE_SUPABASE) {
      await supabaseRest('gifts', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: newGift.id,
          name: newGift.name,
          subtitle: newGift.subtitle,
          tag: newGift.tag,
          visual_key: newGift.visualKey,
          custom_image_url: newGift.customImageUrl || null,
          accent_color: newGift.accentColor,
          active: newGift.active,
          stock_label: newGift.stockLabel,
          sort_order: Math.floor(Date.now() / 1000),
        }),
      });
      const updatedStore = await getActiveStore();
      return res.status(201).json({ gift: newGift, state: sanitizeStateForClient(updatedStore, true, 'admin') });
    }

    store.gifts.push(newGift);
    writeStore(store);
    return res.status(201).json({ gift: newGift, state: sanitizeStateForClient(store, true, 'admin') });
  } catch {
    return res.status(503).json({ error: 'No se pudo crear el regalo.' });
  }
});

app.patch('/api/gifts/:id', requireAdminRole, async (req, res) => {
  const { id } = req.params;
  try {
    const store = await getActiveStore();
    const index = store.gifts.findIndex((g) => g.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Regalo no encontrado.' });
    }

    const current = store.gifts[index];
    const updates = req.body || {};

    if (updates.active === false) {
      const otherActiveCount = store.gifts.filter((g) => g.id !== id && g.active).length;
      if (otherActiveCount < 1) {
        return res.status(400).json({ error: 'Debe quedar al menos un regalo activo para las tarjetas ocultas.' });
      }
    }

    const nextGift = {
      ...current,
      name: typeof updates.name === 'string' && updates.name.trim() ? updates.name.trim() : current.name,
      subtitle: typeof updates.subtitle === 'string' ? updates.subtitle.trim() : current.subtitle,
      tag: typeof updates.tag === 'string' ? updates.tag.trim() : current.tag,
      visualKey: VALID_VISUAL_KEYS.has(updates.visualKey) ? updates.visualKey : current.visualKey,
      customImageUrl:
        updates.customImageUrl === ''
          ? undefined
          : typeof updates.customImageUrl === 'string'
            ? updates.customImageUrl.trim()
            : current.customImageUrl,
      accentColor:
        typeof updates.accentColor === 'string' && updates.accentColor.trim()
          ? updates.accentColor.trim()
          : current.accentColor,
      active: typeof updates.active === 'boolean' ? updates.active : current.active,
      stockLabel:
        typeof updates.stockLabel === 'string' && updates.stockLabel.trim()
          ? updates.stockLabel.trim()
          : current.stockLabel,
    };

    if (USE_SUPABASE) {
      await supabaseRest(`gifts?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          name: nextGift.name,
          subtitle: nextGift.subtitle,
          tag: nextGift.tag,
          visual_key: nextGift.visualKey,
          custom_image_url: nextGift.customImageUrl || null,
          accent_color: nextGift.accentColor,
          active: nextGift.active,
          stock_label: nextGift.stockLabel,
        }),
      });
      const updatedStore = await getActiveStore();
      return res.json({ gift: nextGift, state: sanitizeStateForClient(updatedStore, true, 'admin') });
    }

    store.gifts[index] = nextGift;
    writeStore(store);
    return res.json({ gift: nextGift, state: sanitizeStateForClient(store, true, 'admin') });
  } catch {
    return res.status(503).json({ error: 'No se pudo actualizar el regalo.' });
  }
});

app.delete('/api/gifts/:id', requireAdminRole, async (req, res) => {
  const { id } = req.params;
  try {
    const store = await getActiveStore();
    const target = store.gifts.find((g) => g.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Regalo no encontrado.' });
    }
    const remaining = store.gifts.filter((g) => g.id !== id);
    if (remaining.filter((g) => g.active).length < 1) {
      return res.status(400).json({ error: 'Debe quedar al menos un regalo activo en el catálogo.' });
    }

    if (USE_SUPABASE) {
      await supabaseRest(`gifts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      const updatedStore = await getActiveStore();
      return res.json({ state: sanitizeStateForClient(updatedStore, true, 'admin') });
    }

    store.gifts = remaining;
    writeStore(store);
    return res.json({ state: sanitizeStateForClient(store, true, 'admin') });
  } catch {
    return res.status(503).json({ error: 'No se pudo eliminar el regalo.' });
  }
});

app.post('/api/gifts/reset', requireAdminRole, async (_req, res) => {
  try {
    const defaults = readDefaultStore();

    if (USE_SUPABASE) {
      const rows = defaults.gifts.map((gift, idx) => ({
        id: gift.id,
        name: gift.name,
        subtitle: gift.subtitle,
        tag: gift.tag,
        visual_key: gift.visualKey,
        custom_image_url: null,
        accent_color: gift.accentColor,
        active: gift.active,
        stock_label: gift.stockLabel,
        sort_order: idx + 1,
      }));
      await supabaseRest('gifts', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      const defaultIds = defaults.gifts.map((g) => `"${g.id}"`).join(',');
      await supabaseRest(`gifts?id=not.in.(${encodeURIComponent(defaultIds)})`, {
        method: 'DELETE',
      });
      const updatedStore = await getActiveStore();
      return res.json({ state: sanitizeStateForClient(updatedStore, true, 'admin') });
    }

    const store = ensureStore();
    store.gifts = defaults.gifts;
    writeStore(store);
    return res.json({ state: sanitizeStateForClient(store, true, 'admin') });
  } catch {
    return res.status(503).json({ error: 'No se pudo restaurar el catálogo predeterminado.' });
  }
});

app.patch('/api/settings', requireAdminRole, async (req, res) => {
  try {
    const store = await getActiveStore();
    const updates = req.body || {};
    const nextSettings = {
      ...store.settings,
      advisorName:
        typeof updates.advisorName === 'string' && updates.advisorName.trim()
          ? updates.advisorName.trim()
          : store.settings.advisorName,
      hostTitle:
        typeof updates.hostTitle === 'string' && updates.hostTitle.trim()
          ? updates.hostTitle.trim()
          : store.settings.hostTitle,
      brandSubtitle:
        typeof updates.brandSubtitle === 'string' && updates.brandSubtitle.trim()
          ? updates.brandSubtitle.trim()
          : store.settings.brandSubtitle,
      defaultTicketAmount:
        typeof updates.defaultTicketAmount === 'number' && Number.isFinite(updates.defaultTicketAmount)
          ? Math.max(0, updates.defaultTicketAmount)
          : store.settings.defaultTicketAmount,
      requirePin: typeof updates.requirePin === 'boolean' ? updates.requirePin : store.settings.requirePin,
      giftTheme: VALID_GIFT_THEMES.has(updates.giftTheme)
        ? updates.giftTheme
        : store.settings.giftTheme || 'autumn',
      customBoxColor:
        typeof updates.customBoxColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(updates.customBoxColor.trim())
          ? updates.customBoxColor.trim()
          : store.settings.customBoxColor || '#B84A27',
    };

    if (USE_SUPABASE) {
      await supabaseRest('app_settings?id=eq.default', {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          advisor_name: nextSettings.advisorName,
          host_title: nextSettings.hostTitle,
          brand_subtitle: nextSettings.brandSubtitle,
          default_ticket_amount: nextSettings.defaultTicketAmount,
          require_pin: nextSettings.requirePin,
          gift_theme: nextSettings.giftTheme,
          custom_box_color: nextSettings.customBoxColor,
          updated_at: new Date().toISOString(),
        }),
      });
      const updatedStore = await getActiveStore();
      const sanitized = sanitizeStateForClient(updatedStore, true, 'admin');
      return res.json({ settings: sanitized.settings, state: sanitized });
    }

    store.settings = nextSettings;
    writeStore(store);
    const sanitized = sanitizeStateForClient(store, true, 'admin');
    return res.json({ settings: sanitized.settings, state: sanitized });
  } catch {
    return res.status(503).json({ error: 'No se pudo guardar la configuración.' });
  }
});

// Admin-only QR Studio & History endpoints
app.get('/api/qr', requireDsbAuth, requireAdminRole, async (_req, res) => {
  try {
    const store = await getActiveStore();
    const sanitized = sanitizeStateForClient(store, true, 'admin');
    return res.json({ qrHistory: sanitized.qrHistory });
  } catch {
    return res.status(503).json({ error: 'No se pudo consultar el historial de códigos QR.' });
  }
});

app.post('/api/qr', requireDsbAuth, requireAdminRole, async (req, res) => {
  const { name, targetUrl, styleId, dotShape, foregroundColor, backgroundColor, includeLogo, frameText } =
    req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanTargetUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del código QR debe tener al menos 2 caracteres.' });
  }
  if (!isValidQrTargetUrl(cleanTargetUrl)) {
    return res.status(400).json({ error: 'Ingresa una URL válida que comience con http://, https:// o /.' });
  }

  const cleanFrameText = typeof frameText === 'string' ? frameText.trim().slice(0, 120) : '';
  const newQr = {
    id: generateId('qr'),
    name: cleanName.slice(0, 120),
    targetUrl: cleanTargetUrl,
    styleId: VALID_QR_STYLE_IDS.has(styleId) ? styleId : 'classic-gold',
    dotShape: VALID_QR_DOT_SHAPES.has(dotShape) ? dotShape : 'rounded',
    foregroundColor:
      typeof foregroundColor === 'string' && HEX_COLOR_RE.test(foregroundColor.trim())
        ? foregroundColor.trim()
        : '#22150E',
    backgroundColor:
      typeof backgroundColor === 'string' && HEX_COLOR_RE.test(backgroundColor.trim())
        ? backgroundColor.trim()
        : '#FFFDF9',
    includeLogo: typeof includeLogo === 'boolean' ? includeLogo : true,
    ...(cleanFrameText ? { frameText: cleanFrameText } : {}),
    createdAt: new Date().toISOString(),
  };

  try {
    if (USE_SUPABASE) {
      try {
        await supabaseRest('qr_codes', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            id: newQr.id,
            name: newQr.name,
            target_url: newQr.targetUrl,
            style_id: newQr.styleId,
            dot_shape: newQr.dotShape,
            foreground_color: newQr.foregroundColor,
            background_color: newQr.backgroundColor,
            include_logo: newQr.includeLogo,
            frame_text: cleanFrameText,
            created_at: newQr.createdAt,
          }),
        });
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(updatedStore, true, 'admin');
        return res.status(201).json({ qr: newQr, qrHistory: sanitized.qrHistory, state: sanitized });
      } catch (err) {
        if (!isMissingQrTableError(err)) throw err;
        addFallbackQrCode(newQr);
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(
          { ...updatedStore, qrHistory: getFallbackQrHistory() },
          true,
          'admin'
        );
        return res.status(201).json({ qr: newQr, qrHistory: sanitized.qrHistory, state: sanitized });
      }
    }

    const store = await getActiveStore();
    store.qrHistory = Array.isArray(store.qrHistory) ? store.qrHistory : [];
    store.qrHistory.unshift(newQr);
    writeStore(store);
    const sanitized = sanitizeStateForClient(store, true, 'admin');
    return res.status(201).json({ qr: newQr, qrHistory: sanitized.qrHistory, state: sanitized });
  } catch {
    return res.status(503).json({ error: 'No se pudo guardar el código QR.' });
  }
});

app.delete('/api/qr/:id', requireDsbAuth, requireAdminRole, async (req, res) => {
  const { id } = req.params;
  try {
    const store = await getActiveStore();
    const history = Array.isArray(store.qrHistory) ? store.qrHistory : [];
    const exists = history.some((item) => item.id === id);
    if (!exists) {
      return res.status(404).json({ error: 'Código QR no encontrado.' });
    }

    if (USE_SUPABASE) {
      try {
        await supabaseRest(`qr_codes?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(updatedStore, true, 'admin');
        return res.json({ qrHistory: sanitized.qrHistory, state: sanitized });
      } catch (err) {
        if (!isMissingQrTableError(err)) throw err;
        removeFallbackQrCode(id);
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(
          { ...updatedStore, qrHistory: getFallbackQrHistory() },
          true,
          'admin'
        );
        return res.json({ qrHistory: sanitized.qrHistory, state: sanitized });
      }
    }

    store.qrHistory = history.filter((item) => item.id !== id);
    writeStore(store);
    const sanitized = sanitizeStateForClient(store, true, 'admin');
    return res.json({ qrHistory: sanitized.qrHistory, state: sanitized });
  } catch {
    return res.status(503).json({ error: 'No se pudo eliminar el código QR.' });
  }
});

if (!IS_VERCEL && fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

if (!IS_VERCEL && !IS_TESTING) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Metricas Ciprian API listening on http://localhost:${PORT} (storage: ${USE_SUPABASE ? 'supabase' : 'local'})`);
  });
}

export default app;
