import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const AUTH_PATH = path.join(DATA_DIR, 'auth.json');
const DEFAULT_STORE_PATH = path.join(ROOT_DIR, 'src', 'shared', 'defaultStore.json');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

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

// Pre-computed salted scrypt digest of the master override key (never stored in plaintext)
const MASTER_KEY_SALT = '92a9c2523cabb366bdb991d188c9899a';
const MASTER_KEY_HASH =
  '2ddf08eff2d15b8984c21d28d8ea42fb0776e8b103d177b8903886fec0d1da332941b7f6209da57d66bffcaf58c275ea6e49fde43bce7b92526ab0dc556a2d75';

const MAX_AUTH_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes anti-brute-force lockout
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

function ensureAuthStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUTH_PATH)) {
    const pwd = hashSecret('AdminMaster2026@');
    const pin = hashSecret('1966');
    const initialAuth = {
      username: 'AdminCripian',
      passwordSalt: pwd.salt,
      passwordHash: pwd.hash,
      pinSalt: pin.salt,
      pinHash: pin.hash,
      tokenSecret: crypto.randomBytes(32).toString('hex'),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(AUTH_PATH, JSON.stringify(initialAuth, null, 2), 'utf8');
    return initialAuth;
  }
  try {
    return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
  } catch {
    const pwd = hashSecret('AdminMaster2026@');
    const pin = hashSecret('1966');
    const fallback = {
      username: 'AdminCripian',
      passwordSalt: pwd.salt,
      passwordHash: pwd.hash,
      pinSalt: pin.salt,
      pinHash: pin.hash,
      tokenSecret: crypto.randomBytes(32).toString('hex'),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(AUTH_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function writeAuthStore(authData) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmp = `${AUTH_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(authData, null, 2), 'utf8');
  fs.renameSync(tmp, AUTH_PATH);
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
  const ip = req.ip || req.socket?.remoteAddress || 'local';
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
  const raw = fs.readFileSync(DEFAULT_STORE_PATH, 'utf8');
  return JSON.parse(raw);
}

function ensureStore() {
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
    };
  } catch {
    const initial = readDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function writeStore(store) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempPath, STORE_PATH);
}

function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateClaimCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `OTN-${num}`;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Defensive cybersecurity headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Ensure store & auth exist at startup
ensureStore();
ensureAuthStore();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Filter 1: Username + Password authentication with anti-brute-force protection
app.post('/api/auth/login', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const bucketKey = getBucketKey(req, 'login');
  const status = checkRateLimit(bucketKey);
  if (status.locked) {
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Sistema bloqueado temporalmente por seguridad (${status.retryAfterSeconds}s).`,
      locked: true,
      retryAfterSeconds: status.retryAfterSeconds,
      remainingAttempts: 0,
    });
  }

  const { username, password } = req.body || {};
  const cleanUser = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const cleanPass = typeof password === 'string' ? password : '';

  const auth = ensureAuthStore();
  const expectedUser = String(auth.username || 'AdminCripian').toLowerCase();

  const userBuf = Buffer.from(cleanUser.padEnd(64, '\0'));
  const expUserBuf = Buffer.from(expectedUser.padEnd(64, '\0'));
  const altCiprianBuf = Buffer.from('adminciprian'.padEnd(64, '\0'));
  const matchesPrimary =
    userBuf.length === expUserBuf.length && crypto.timingSafeEqual(userBuf, expUserBuf);
  const matchesDefaultAlias =
    expectedUser === 'admincripian' &&
    userBuf.length === altCiprianBuf.length &&
    crypto.timingSafeEqual(userBuf, altCiprianBuf);
  const userMatches = matchesPrimary || matchesDefaultAlias;
  const passMatches = verifySecretConstantTime(cleanPass, auth.passwordSalt, auth.passwordHash);

  if (!userMatches || !passMatches) {
    const fail = recordFailedAttempt(bucketKey);
    await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
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

  clearAttempts(bucketKey);
  const preAuthToken = signToken(
    {
      scope: 'pre_pin',
      user: auth.username,
      exp: Date.now() + 5 * 60 * 1000,
    },
    auth.tokenSecret
  );

  return res.json({
    ok: true,
    preAuthToken,
    username: auth.username,
  });
});

// Filter 2: Numeric PIN verification (requires valid Filter 1 preAuthToken)
app.post('/api/auth/verify-pin', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const bucketKey = getBucketKey(req, 'pin');
  const status = checkRateLimit(bucketKey);
  if (status.locked) {
    return res.status(429).json({
      error: `Segundo factor bloqueado por múltiples intentos fallidos (${status.retryAfterSeconds}s).`,
      locked: true,
      retryAfterSeconds: status.retryAfterSeconds,
      remainingAttempts: 0,
    });
  }

  const { preAuthToken, pin } = req.body || {};
  const auth = ensureAuthStore();
  const preAuth = verifyToken(preAuthToken, auth.tokenSecret, 'pre_pin');
  if (!preAuth) {
    return res.status(401).json({
      error: 'La sesión del primer filtro expiró. Vuelve a iniciar sesión con usuario y contraseña.',
      expiredFirstFactor: true,
    });
  }

  const cleanPin = typeof pin === 'string' ? pin.trim() : '';
  const pinMatches = verifySecretConstantTime(cleanPin, auth.pinSalt, auth.pinHash);

  if (!pinMatches) {
    const fail = recordFailedAttempt(bucketKey);
    await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
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

  clearAttempts(bucketKey);
  const sessionToken = signToken(
    {
      scope: 'dsb_session',
      user: auth.username,
      exp: Date.now() + 8 * 60 * 60 * 1000,
    },
    auth.tokenSecret
  );

  return res.json({
    ok: true,
    sessionToken,
    username: auth.username,
  });
});

// Verify active DSB session
app.get('/api/auth/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const auth = ensureAuthStore();
  const payload = verifyToken(token, auth.tokenSecret, 'dsb_session');
  if (!payload) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true, username: auth.username });
});

// Update DSB Username, Password, or PIN — strictly requires the Master Override Key
app.post('/api/auth/update-credentials', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
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

app.get('/api/state', (_req, res) => {
  const store = ensureStore();
  // Never expose raw PIN codes in public state payload
  const safeStore = {
    ...store,
    settings: {
      ...store.settings,
      pinCode: '••••',
    },
  };
  res.json(safeStore);
});

app.post('/api/leads', (req, res) => {
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

  const store = ensureStore();
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
    notes: typeof notes === 'string' ? notes.trim() : '',
    qualification: qualification && typeof qualification === 'object' ? qualification : null,
    createdAt: new Date().toISOString(),
  };

  store.leads.unshift(newLead);
  writeStore(store);

  return res.status(201).json({ lead: newLead, state: store });
});

app.patch('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const store = ensureStore();
  const index = store.leads.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Prospecto no encontrado.' });
  }

  const current = store.leads[index];
  const updates = req.body || {};
  const next = { ...current };

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
  if (typeof updates.giftId === 'string') {
    next.giftId = updates.giftId;
  }
  if (typeof updates.giftName === 'string') {
    next.giftName = updates.giftName;
  }
  if (typeof updates.giftVisualKey === 'string' && VALID_VISUAL_KEYS.has(updates.giftVisualKey)) {
    next.giftVisualKey = updates.giftVisualKey;
  }
  if (typeof updates.claimCode === 'string' && updates.claimCode.trim()) {
    next.claimCode = updates.claimCode.trim();
  }
  if (updates.qualification !== undefined) {
    next.qualification = updates.qualification && typeof updates.qualification === 'object' ? updates.qualification : null;
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
    } else if (updates.category !== 'orden') {
      next.orderAmount = null;
    }
  } else if (updates.orderAmount !== undefined && next.category === 'orden') {
    const parsedAmount = Number(updates.orderAmount);
    if (Number.isFinite(parsedAmount) && parsedAmount >= 0) {
      next.orderAmount = parsedAmount;
    }
  }

  store.leads[index] = next;
  writeStore(store);

  return res.json({ lead: next, state: store });
});

app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const store = ensureStore();
  const nextLeads = store.leads.filter((item) => item.id !== id);
  if (nextLeads.length === store.leads.length) {
    return res.status(404).json({ error: 'Prospecto no encontrado.' });
  }
  store.leads = nextLeads;
  writeStore(store);
  return res.json({ state: store });
});

app.post('/api/gifts', (req, res) => {
  const { name, subtitle, tag, visualKey, customImageUrl, accentColor, active, stockLabel } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del regalo es obligatorio.' });
  }

  const store = ensureStore();
  const newGift = {
    id: generateId('gift'),
    name: cleanName,
    subtitle: typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : 'Obsequio exclusivo Show de Cocina.',
    tag: typeof tag === 'string' && tag.trim() ? tag.trim() : 'Edición Otoño',
    visualKey: VALID_VISUAL_KEYS.has(visualKey) ? visualKey : 'pot',
    customImageUrl: typeof customImageUrl === 'string' && customImageUrl.trim() ? customImageUrl.trim() : undefined,
    accentColor: typeof accentColor === 'string' && accentColor.trim() ? accentColor.trim() : '#C88A2B',
    active: active !== false,
    stockLabel: typeof stockLabel === 'string' && stockLabel.trim() ? stockLabel.trim() : 'Disponible',
  };

  store.gifts.push(newGift);
  writeStore(store);
  return res.status(201).json({ gift: newGift, state: store });
});

app.patch('/api/gifts/:id', (req, res) => {
  const { id } = req.params;
  const store = ensureStore();
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

  store.gifts[index] = nextGift;
  writeStore(store);
  return res.json({ gift: nextGift, state: store });
});

app.delete('/api/gifts/:id', (req, res) => {
  const { id } = req.params;
  const store = ensureStore();
  const target = store.gifts.find((g) => g.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Regalo no encontrado.' });
  }
  const remaining = store.gifts.filter((g) => g.id !== id);
  if (remaining.filter((g) => g.active).length < 1) {
    return res.status(400).json({ error: 'Debe quedar al menos un regalo activo en el catálogo.' });
  }
  store.gifts = remaining;
  writeStore(store);
  return res.json({ state: store });
});

app.post('/api/gifts/reset', (_req, res) => {
  const store = ensureStore();
  const defaults = readDefaultStore();
  store.gifts = defaults.gifts;
  writeStore(store);
  return res.json({ state: store });
});

app.patch('/api/settings', (req, res) => {
  const store = ensureStore();
  const updates = req.body || {};
  store.settings = {
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
  writeStore(store);
  const safeSettings = { ...store.settings, pinCode: '••••' };
  return res.json({ settings: safeSettings, state: { ...store, settings: safeSettings } });
});

if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Metricas Cipriano API listening on http://localhost:${PORT}`);
});
