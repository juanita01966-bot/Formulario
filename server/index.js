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
    showcaseStyle: 'luminous-gold',
    randomizeGifts: true,
  },
  gifts: [
    {
      id: 'gift-utensils-6',
      name: 'Juego de Utensilios de 6 Piezas',
      subtitle: 'Set de 6 utensilios profesionales Royal Prestige en acero inoxidable de grado quirúrgico.',
      usageTip: 'Úsalos para voltear, servir pastas, guisos y caldos sin rayar ni dañar tus ollas o sartenes.',
      tag: 'Colección Acero · $300 USD',
      visualKey: 'cutlery',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.48_ccc0c9bc-Photoroom.png',
      accentColor: '#C88A2B',
      active: true,
      stockLabel: 'Edición Exclusiva',
      probability: 11.1,
    },
    {
      id: 'gift-utensil-holder',
      name: 'Recipiente para Utensilios',
      subtitle: 'Cilindro organizador Royal Prestige en acero inoxidable cepillado con base firme (MISC SP0145).',
      usageTip: 'Mantén tus espátulas y cucharones favoritos secos, ordenados y siempre a la mano junto a la estufa.',
      tag: 'Organización · $99 USD',
      visualKey: 'pot',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.48_b86f199c-Photoroom.png',
      accentColor: '#8C6E58',
      active: true,
      stockLabel: 'Disponible',
      probability: 11.1,
    },
    {
      id: 'gift-bowls-3',
      name: 'Juego de 3 Tazones para Mezclar',
      subtitle: 'Set de 3 tazones herméticos en acero inoxidable con base antideslizante y tapas selladoras (PREM PR4902).',
      usageTip: 'Prepara masas, marina carnes y conserva ensaladas frescas por más días gracias a su sello hermético.',
      tag: 'Favorito del Chef · $500 USD',
      visualKey: 'bowls',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.48_17872483-Photoroom.png',
      accentColor: '#B84A27',
      active: true,
      stockLabel: 'Alta Demanda',
      probability: 11.1,
    },
    {
      id: 'gift-santoku-5',
      name: 'Cuchillo Santoku 5"',
      subtitle: 'Cuchillo de precisión alveolado de 5 pulgadas con acero forjado Royal Prestige (MISC SP0296).',
      usageTip: 'Sus alvéolos evitan que el alimento se pegue al rebanar verduras finas, quesos o filetes con corte limpio.',
      tag: 'Corte Maestro · $550 USD',
      visualKey: 'knife',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.49_a69260c7-Photoroom.png',
      accentColor: '#8C3B20',
      active: true,
      stockLabel: 'Edición Limitada',
      probability: 11.1,
    },
    {
      id: 'gift-cleaver-7',
      name: 'Hacha de Cocina de 7"',
      subtitle: 'Hacha profesional de 7 pulgadas en acero balanceado de alto desempeño Royal Prestige (MRCH CU0825).',
      usageTip: 'Aprovecha su hoja ancha para trozar carnes con firmeza y trasladar ingredientes picados de la tabla a la olla.',
      tag: 'Precision Cut · $450 USD',
      visualKey: 'knife',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.49_4eb72c8b-Photoroom.png',
      accentColor: '#5B4636',
      active: true,
      stockLabel: 'Disponible',
      probability: 11.1,
    },
    {
      id: 'gift-icecream-2',
      name: 'Juego de 2 Copas para Helado',
      subtitle: 'Dúo de copas térmicas de acero pulido espejo diseñadas para postres y sorbetes (MISC SP0252).',
      usageTip: 'Enfría las copas 5 minutos antes de servir para mantener helados, mousses o frutas fríos por más tiempo.',
      tag: 'Mesa Gourmet · $199 USD',
      visualKey: 'bowls',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.49_0f9b4d38-Photoroom.png',
      accentColor: '#C88A2B',
      active: true,
      stockLabel: 'Disponible',
      probability: 11.1,
    },
    {
      id: 'gift-mugs-2',
      name: 'Juego de 2 Tazas con Pared Doble',
      subtitle: 'Par de tazas térmicas de doble pared en acero inoxidable Royal Prestige (MISC SP0136).',
      usageTip: 'Disfruta café, té o chocolate a temperatura ideal sin quemarte las manos ni generar condensación.',
      tag: 'Experiencia Térmica · $200 USD',
      visualKey: 'kettle',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.50_c2f45d1c-Photoroom.png',
      accentColor: '#7C4327',
      active: true,
      stockLabel: 'Disponible',
      probability: 11.1,
    },
    {
      id: 'gift-bamboo-large',
      name: 'Tabla de Bambú Grande',
      subtitle: 'Tabla de corte artesanal en bambú orgánico prensado con canal colector de jugos (PREM PR0008).',
      usageTip: 'Corta con seguridad cuidando el filo de tus cuchillos y usa su canal lateral para recoger jugos al asar carnes.',
      tag: 'Madera Noble · $300 USD',
      visualKey: 'bamboo',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.50_ba6c52cc-Photoroom.png',
      accentColor: '#A66328',
      active: true,
      stockLabel: 'Disponible',
      probability: 11.1,
    },
    {
      id: 'gift-warmer-pro',
      name: 'Royal Prestige Warmer Pro',
      subtitle: 'Contenedor térmico eléctrico portátil para conservar tortillas y platillos calientes (PREM PE4000).',
      usageTip: 'Mantén tus tortillas suaves y comidas calientes en la mesa o en reuniones gracias a su batería recargable portátil.',
      tag: 'Edición Estrella · $600 USD',
      visualKey: 'thermo',
      customImageUrl: '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.50_621e0247-Photoroom.png',
      accentColor: '#4B644A',
      active: true,
      stockLabel: 'Edición Estrella',
      probability: 11.1,
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
const VALID_SHOWCASE_STYLES = new Set(['luminous-gold', 'crystal-aurora', 'royal-ember']);
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

function writeJsonFileSafely(targetPath, data) {
  if (IS_VERCEL) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(data, null, 2);
    const tempPath = `${targetPath}.tmp`;
    try {
      fs.writeFileSync(tempPath, serialized, 'utf8');
      fs.renameSync(tempPath, targetPath);
    } catch {
      // Fallback for Windows NTFS transient EPERM/EBUSY locks during atomic rename
      try {
        fs.rmSync(tempPath, { force: true });
      } catch {
        // Ignore temp cleanup failure
      }
      fs.writeFileSync(targetPath, serialized, 'utf8');
    }
  } catch {
    // Ignore write failure on read-only environments
  }
}

function writeAuthStore(authData) {
  writeJsonFileSafely(AUTH_PATH, authData);
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

const DEFAULT_GIFT_PROBABILITY = 10;

function sanitizeGiftProbability(value, fallback = DEFAULT_GIFT_PROBABILITY) {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'object'
  ) {
    return fallback;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) {
    return fallback;
  }
  const clamped = Math.max(0, num);
  const scaled = clamped * 100;
  const rounded = Number.isFinite(scaled) ? Math.round(scaled) / 100 : clamped;
  return rounded === 0 ? 0 : rounded;
}

function normalizeGiftRecord(gift, fallbackProbability = DEFAULT_GIFT_PROBABILITY) {
  if (!gift || typeof gift !== 'object') return gift;
  return {
    ...gift,
    probability: sanitizeGiftProbability(gift.probability, fallbackProbability),
  };
}

function pickWeightedGift(gifts) {
  if (!Array.isArray(gifts) || gifts.length === 0) return null;
  const weights = gifts.map((g) => sanitizeGiftProbability(g?.probability, DEFAULT_GIFT_PROBABILITY));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return gifts[crypto.randomInt(gifts.length)];
  }
  const hi = crypto.randomBytes(4).readUInt32BE(0) >>> 11;
  const lo = crypto.randomBytes(4).readUInt32BE(0);
  const unit = (hi * 0x100000000 + lo) / 0x20000000000000;
  const target = unit * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < gifts.length; i += 1) {
    const w = weights[i];
    if (w <= 0) continue;
    cumulative += w;
    if (target < cumulative) {
      return gifts[i];
    }
  }
  for (let i = gifts.length - 1; i >= 0; i -= 1) {
    if (weights[i] > 0) return gifts[i];
  }
  return gifts[0];
}

let storeMutationQueue = Promise.resolve();
function withStoreMutationLock(fn) {
  const run = storeMutationQueue.then(fn, fn);
  storeMutationQueue = run.catch(() => {});
  return run;
}

function readDefaultStore() {
  if (fs.existsSync(DEFAULT_STORE_PATH)) {
    try {
      const raw = fs.readFileSync(DEFAULT_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        settings: {
          ...BUNDLED_DEFAULT_STORE.settings,
          ...(parsed.settings || {}),
          randomizeGifts:
            typeof parsed.settings?.randomizeGifts === 'boolean' ? parsed.settings.randomizeGifts : true,
        },
        gifts: Array.isArray(parsed.gifts)
          ? parsed.gifts.map((g) => normalizeGiftRecord(g, 11.1))
          : BUNDLED_DEFAULT_STORE.gifts,
      };
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
    const mergedSettings = { ...defaults.settings, ...(parsed.settings || {}) };
    if (typeof mergedSettings.randomizeGifts !== 'boolean') {
      mergedSettings.randomizeGifts =
        typeof defaults.settings.randomizeGifts === 'boolean' ? defaults.settings.randomizeGifts : true;
    }
    const rawGifts = Array.isArray(parsed.gifts) && parsed.gifts.length > 0 ? parsed.gifts : defaults.gifts;
    return {
      settings: mergedSettings,
      gifts: rawGifts.map((g) => normalizeGiftRecord(g, DEFAULT_GIFT_PROBABILITY)),
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
  writeJsonFileSafely(STORE_PATH, store);
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
const memoryGiftUsageTips = new Map();
const memoryGiftProbabilities = new Map();
const memorySettingsFallback = {};

function isMissingColumnError(err, columnNames = []) {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase();
  const looksLikeMissingCol =
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes('pgrst204') ||
    msg.includes('42703') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('could not find the');
  if (!looksLikeMissingCol) return false;
  if (columnNames.length === 0) return true;
  return columnNames.some((col) => msg.includes(String(col).toLowerCase()));
}

async function supabaseWriteWithOptionalColumns(
  restPath,
  method,
  headers,
  payload,
  optionalColumns,
  restExecutor = supabaseRest
) {
  let currentPayload = payload;
  const stripped = new Set();
  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    try {
      return await restExecutor(restPath, {
        method,
        headers,
        body: JSON.stringify(currentPayload),
      });
    } catch (err) {
      const remaining = optionalColumns.filter((col) => !stripped.has(col));
      if (remaining.length === 0 || !isMissingColumnError(err, remaining)) {
        throw err;
      }
      const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase();
      const matched = remaining.filter((col) => msg.includes(col.toLowerCase()));
      const toDrop = matched.length > 0 ? matched : remaining;
      for (const col of toDrop) {
        stripped.add(col);
      }
      const stripRow = (row) => {
        const copy = { ...row };
        for (const col of stripped) {
          delete copy[col];
        }
        return copy;
      };
      currentPayload = Array.isArray(currentPayload)
        ? currentPayload.map(stripRow)
        : stripRow(currentPayload);
    }
  }
  return null;
}

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
    err.details = data && typeof data === 'object' ? data.details : undefined;
    err.hint = data && typeof data === 'object' ? data.hint : undefined;
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
    showcaseStyle: VALID_SHOWCASE_STYLES.has(row.showcase_style)
      ? row.showcase_style
      : VALID_SHOWCASE_STYLES.has(memorySettingsFallback.showcaseStyle)
        ? memorySettingsFallback.showcaseStyle
        : defaults.showcaseStyle || 'luminous-gold',
    randomizeGifts:
      typeof row.randomize_gifts === 'boolean'
        ? row.randomize_gifts
        : typeof memorySettingsFallback.randomizeGifts === 'boolean'
          ? memorySettingsFallback.randomizeGifts
          : typeof defaults.randomizeGifts === 'boolean'
            ? defaults.randomizeGifts
            : true,
  };
}

function mapGiftRow(row) {
  const hasColumnProbability =
    row.probability !== undefined &&
    row.probability !== null &&
    !(typeof row.probability === 'string' && row.probability.trim() === '');
  const fallbackProbability = memoryGiftProbabilities.has(row.id)
    ? memoryGiftProbabilities.get(row.id)
    : DEFAULT_GIFT_PROBABILITY;

  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle || '',
    usageTip:
      typeof row.usage_tip === 'string'
        ? row.usage_tip
        : memoryGiftUsageTips.get(row.id) ?? '',
    tag: row.tag || '',
    visualKey: VALID_VISUAL_KEYS.has(row.visual_key) ? row.visual_key : 'cutlery',
    customImageUrl: row.custom_image_url || undefined,
    accentColor: row.accent_color || '#C88A2B',
    active: Boolean(row.active),
    stockLabel: row.stock_label || 'Disponible',
    probability: hasColumnProbability
      ? sanitizeGiftProbability(row.probability, fallbackProbability)
      : fallbackProbability,
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
    gifts:
      Array.isArray(giftRows) && giftRows.length > 0
        ? giftRows.map(mapGiftRow)
        : defaults.gifts.map((g) => normalizeGiftRecord(g, 11.1)),
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
  const normalizedGifts = Array.isArray(store.gifts)
    ? store.gifts.map((g) => normalizeGiftRecord(g, DEFAULT_GIFT_PROBABILITY))
    : [];
  const defaultRandomize =
    typeof store.settings?.randomizeGifts === 'boolean' ? store.settings.randomizeGifts : true;

  if (!isAuthed) {
    return {
      settings: {
        ...store.settings,
        randomizeGifts: defaultRandomize,
        pinCode: '',
      },
      gifts: normalizedGifts,
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
      randomizeGifts: defaultRandomize,
      pinCode: '',
    },
    gifts: normalizedGifts,
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

// Master-key protected full reset: wipes all leads, metrics, QR history (and optionally gifts/settings)
app.post('/api/admin/reset-all', requireDsbAuth, requireAdminRole, async (req, res) => {
  const bucketKey = getBucketKey(req, 'master');
  const status = checkRateLimit(bucketKey);
  if (status.locked) {
    return res.status(429).json({
      error: `Autorización maestra bloqueada temporalmente (${status.retryAfterSeconds}s).`,
      locked: true,
      retryAfterSeconds: status.retryAfterSeconds,
    });
  }

  const { masterPassword, resetCatalogAndSettings } = req.body || {};
  const masterMatches = verifySecretConstantTime(
    typeof masterPassword === 'string' ? masterPassword : '',
    MASTER_KEY_SALT,
    MASTER_KEY_HASH
  );

  if (!masterMatches) {
    const fail = recordFailedAttempt(bucketKey);
    await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 300)));
    return res.status(fail.locked ? 429 : 403).json({
      error: fail.locked
        ? 'Contraseña maestra inválida. Bloqueo preventivo activado por 15 minutos.'
        : `Contraseña maestra inválida. Intentos restantes: ${fail.remainingAttempts}.`,
      locked: fail.locked,
      retryAfterSeconds: fail.retryAfterSeconds,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  clearAttempts(bucketKey);
  const shouldResetCatalog = resetCatalogAndSettings !== false;

  try {
    const defaults = readDefaultStore();
    memoryQrFallback = [];

    if (USE_SUPABASE) {
      await supabaseRest('leads?id=not.is.null', { method: 'DELETE' });
      await supabaseRest('qr_codes?id=not.is.null', { method: 'DELETE' }).catch((err) => {
        if (!isMissingQrTableError(err)) throw err;
      });

      if (shouldResetCatalog) {
        memoryGiftUsageTips.clear();
        memoryGiftProbabilities.clear();
        const giftRows = defaults.gifts.map((gift, idx) => {
          const probability = sanitizeGiftProbability(gift.probability, 11.1);
          memoryGiftUsageTips.set(gift.id, gift.usageTip || '');
          memoryGiftProbabilities.set(gift.id, probability);
          return {
            id: gift.id,
            name: gift.name,
            subtitle: gift.subtitle,
            usage_tip: gift.usageTip || '',
            tag: gift.tag,
            visual_key: gift.visualKey,
            custom_image_url: gift.customImageUrl || null,
            accent_color: gift.accentColor,
            active: gift.active,
            stock_label: gift.stockLabel,
            probability,
            sort_order: idx + 1,
          };
        });
        await supabaseWriteWithOptionalColumns(
          'gifts',
          'POST',
          { Prefer: 'resolution=merge-duplicates,return=minimal' },
          giftRows,
          ['usage_tip', 'probability']
        );
        const defaultIds = defaults.gifts.map((g) => `"${g.id}"`).join(',');
        await supabaseRest(`gifts?id=not.in.(${encodeURIComponent(defaultIds)})`, {
          method: 'DELETE',
        });

        Object.assign(memorySettingsFallback, {
          showcaseStyle: defaults.settings.showcaseStyle || 'luminous-gold',
          randomizeGifts:
            typeof defaults.settings.randomizeGifts === 'boolean'
              ? defaults.settings.randomizeGifts
              : true,
        });
        await supabaseWriteWithOptionalColumns(
          'app_settings',
          'PATCH',
          { Prefer: 'return=minimal' },
          {
            advisor_name: defaults.settings.advisorName,
            host_title: defaults.settings.hostTitle,
            brand_subtitle: defaults.settings.brandSubtitle,
            default_ticket_amount: defaults.settings.defaultTicketAmount,
            require_pin: defaults.settings.requirePin,
            pin_code: defaults.settings.pinCode,
            gift_theme: defaults.settings.giftTheme || 'autumn',
            custom_box_color: defaults.settings.customBoxColor || '#C88A2B',
            showcase_style: defaults.settings.showcaseStyle || 'luminous-gold',
            randomize_gifts:
              typeof defaults.settings.randomizeGifts === 'boolean'
                ? defaults.settings.randomizeGifts
                : true,
            updated_at: new Date().toISOString(),
          },
          ['showcase_style', 'randomize_gifts']
        );
      }

      if (!IS_VERCEL) {
        const local = ensureStore();
        local.leads = [];
        local.qrHistory = [];
        if (shouldResetCatalog) {
          local.gifts = defaults.gifts;
          local.settings = { ...defaults.settings };
        }
        writeStore(local);
      }

      const updatedStore = await getActiveStore();
      return res.json({
        ok: true,
        state: sanitizeStateForClient(updatedStore, true, 'admin'),
        message: 'Todas las métricas y datos fueron reiniciados a 0.',
      });
    }

    const store = ensureStore();
    store.leads = [];
    store.qrHistory = [];
    if (shouldResetCatalog) {
      store.gifts = defaults.gifts;
      store.settings = { ...defaults.settings };
    }
    writeStore(store);

    return res.json({
      ok: true,
      state: sanitizeStateForClient(store, true, 'admin'),
      message: 'Todas las métricas y datos fueron reiniciados a 0.',
    });
  } catch {
    return res.status(503).json({
      error: 'No se pudo completar el reinicio general. Intenta de nuevo.',
    });
  }
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
      (activeGifts.length > 0 ? pickWeightedGift(activeGifts) : null) ||
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
  const { name, subtitle, usageTip, tag, visualKey, customImageUrl, accentColor, active, stockLabel, probability } =
    req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del regalo es obligatorio.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const newGift = {
        id: generateId('gift'),
        name: cleanName,
        subtitle: typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : 'Obsequio exclusivo Show de Cocina.',
        usageTip: typeof usageTip === 'string' ? usageTip.trim() : '',
        tag: typeof tag === 'string' && tag.trim() ? tag.trim() : 'Edición Especial',
        visualKey: VALID_VISUAL_KEYS.has(visualKey) ? visualKey : 'pot',
        customImageUrl: typeof customImageUrl === 'string' && customImageUrl.trim() ? customImageUrl.trim() : undefined,
        accentColor: typeof accentColor === 'string' && accentColor.trim() ? accentColor.trim() : '#C88A2B',
        active: active !== false,
        stockLabel: typeof stockLabel === 'string' && stockLabel.trim() ? stockLabel.trim() : 'Disponible',
        probability: sanitizeGiftProbability(probability, DEFAULT_GIFT_PROBABILITY),
      };

      if (USE_SUPABASE) {
        memoryGiftUsageTips.set(newGift.id, newGift.usageTip);
        memoryGiftProbabilities.set(newGift.id, newGift.probability);
        await supabaseWriteWithOptionalColumns(
          'gifts',
          'POST',
          { Prefer: 'return=minimal' },
          {
            id: newGift.id,
            name: newGift.name,
            subtitle: newGift.subtitle,
            usage_tip: newGift.usageTip,
            tag: newGift.tag,
            visual_key: newGift.visualKey,
            custom_image_url: newGift.customImageUrl || null,
            accent_color: newGift.accentColor,
            active: newGift.active,
            stock_label: newGift.stockLabel,
            probability: newGift.probability,
            sort_order: Math.floor(Date.now() / 1000),
          },
          ['usage_tip', 'probability']
        );
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
});

app.patch('/api/gifts/probabilities', requireAdminRole, async (req, res) => {
  const { gifts: giftsInput, probabilities: probsInput } = req.body || {};
  const updatesById = new Map();

  if (Array.isArray(giftsInput)) {
    for (const entry of giftsInput) {
      if (entry && typeof entry.id === 'string' && entry.id.trim()) {
        updatesById.set(entry.id.trim(), entry.probability);
      }
    }
  } else if (probsInput && typeof probsInput === 'object' && !Array.isArray(probsInput)) {
    for (const [id, prob] of Object.entries(probsInput)) {
      if (typeof id === 'string' && id.trim()) {
        updatesById.set(id.trim(), prob);
      }
    }
  }

  if (updatesById.size === 0) {
    return res.status(400).json({ error: 'Debes indicar las probabilidades de los regalos.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const updatedItems = [];
      const nextGifts = store.gifts.map((gift) => {
        const normalized = normalizeGiftRecord(gift, DEFAULT_GIFT_PROBABILITY);
        if (!updatesById.has(normalized.id)) {
          return normalized;
        }
        const nextProbability = sanitizeGiftProbability(
          updatesById.get(normalized.id),
          normalized.probability
        );
        const updatedGift = { ...normalized, probability: nextProbability };
        updatedItems.push(updatedGift);
        return updatedGift;
      });

      if (USE_SUPABASE) {
        for (const item of updatedItems) {
          memoryGiftProbabilities.set(item.id, item.probability);
        }
        for (const item of updatedItems) {
          try {
            await supabaseRest(`gifts?id=eq.${encodeURIComponent(item.id)}`, {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ probability: item.probability }),
            });
          } catch (err) {
            if (isMissingColumnError(err, ['probability'])) {
              break;
            }
            throw err;
          }
        }
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(updatedStore, true, 'admin');
        return res.json({ gifts: sanitized.gifts, state: sanitized });
      }

      store.gifts = nextGifts;
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, true, 'admin');
      return res.json({ gifts: sanitized.gifts, state: sanitized });
    } catch {
      return res.status(503).json({ error: 'No se pudieron actualizar las probabilidades.' });
    }
  });
});

app.patch('/api/gifts/:id', requireAdminRole, async (req, res) => {
  const { id } = req.params;
  return withStoreMutationLock(async () => {
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

      const currentProbability = sanitizeGiftProbability(current.probability, DEFAULT_GIFT_PROBABILITY);
      const nextProbability =
        updates.probability !== undefined
          ? sanitizeGiftProbability(updates.probability, currentProbability)
          : currentProbability;

      const nextGift = {
        ...current,
        name: typeof updates.name === 'string' && updates.name.trim() ? updates.name.trim() : current.name,
        subtitle: typeof updates.subtitle === 'string' ? updates.subtitle.trim() : current.subtitle,
        usageTip:
          typeof updates.usageTip === 'string'
            ? updates.usageTip.trim()
            : typeof current.usageTip === 'string'
              ? current.usageTip
              : '',
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
        probability: nextProbability,
      };

      if (USE_SUPABASE) {
        memoryGiftUsageTips.set(id, nextGift.usageTip);
        memoryGiftProbabilities.set(id, nextGift.probability);
        await supabaseWriteWithOptionalColumns(
          `gifts?id=eq.${encodeURIComponent(id)}`,
          'PATCH',
          { Prefer: 'return=minimal' },
          {
            name: nextGift.name,
            subtitle: nextGift.subtitle,
            usage_tip: nextGift.usageTip,
            tag: nextGift.tag,
            visual_key: nextGift.visualKey,
            custom_image_url: nextGift.customImageUrl || null,
            accent_color: nextGift.accentColor,
            active: nextGift.active,
            stock_label: nextGift.stockLabel,
            probability: nextGift.probability,
          },
          ['usage_tip', 'probability']
        );
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
});

app.delete('/api/gifts/:id', requireAdminRole, async (req, res) => {
  const { id } = req.params;
  return withStoreMutationLock(async () => {
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
        memoryGiftUsageTips.delete(id);
        memoryGiftProbabilities.delete(id);
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
});

app.post('/api/gifts/reset', requireAdminRole, async (_req, res) => {
  return withStoreMutationLock(async () => {
    try {
      const defaults = readDefaultStore();

      if (USE_SUPABASE) {
        memoryGiftUsageTips.clear();
        memoryGiftProbabilities.clear();
        const rows = defaults.gifts.map((gift, idx) => {
          const probability = sanitizeGiftProbability(gift.probability, 11.1);
          memoryGiftUsageTips.set(gift.id, gift.usageTip || '');
          memoryGiftProbabilities.set(gift.id, probability);
          return {
            id: gift.id,
            name: gift.name,
            subtitle: gift.subtitle,
            usage_tip: gift.usageTip || '',
            tag: gift.tag,
            visual_key: gift.visualKey,
            custom_image_url: gift.customImageUrl || null,
            accent_color: gift.accentColor,
            active: gift.active,
            stock_label: gift.stockLabel,
            probability,
            sort_order: idx + 1,
          };
        });
        await supabaseWriteWithOptionalColumns(
          'gifts',
          'POST',
          { Prefer: 'resolution=merge-duplicates,return=minimal' },
          rows,
          ['usage_tip', 'probability']
        );
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
      showcaseStyle: VALID_SHOWCASE_STYLES.has(updates.showcaseStyle)
        ? updates.showcaseStyle
        : store.settings.showcaseStyle || 'luminous-gold',
      randomizeGifts:
        typeof updates.randomizeGifts === 'boolean'
          ? updates.randomizeGifts
          : typeof store.settings.randomizeGifts === 'boolean'
            ? store.settings.randomizeGifts
            : true,
    };

    if (USE_SUPABASE) {
      memorySettingsFallback.showcaseStyle = nextSettings.showcaseStyle;
      memorySettingsFallback.randomizeGifts = nextSettings.randomizeGifts;
      await supabaseWriteWithOptionalColumns(
        'app_settings?id=eq.default',
        'PATCH',
        { Prefer: 'return=minimal' },
        {
          advisor_name: nextSettings.advisorName,
          host_title: nextSettings.hostTitle,
          brand_subtitle: nextSettings.brandSubtitle,
          default_ticket_amount: nextSettings.defaultTicketAmount,
          require_pin: nextSettings.requirePin,
          gift_theme: nextSettings.giftTheme,
          custom_box_color: nextSettings.customBoxColor,
          showcase_style: nextSettings.showcaseStyle,
          randomize_gifts: nextSettings.randomizeGifts,
          updated_at: new Date().toISOString(),
        },
        ['showcase_style', 'randomize_gifts', 'gift_theme', 'custom_box_color']
      );
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

export {
  DEFAULT_GIFT_PROBABILITY,
  sanitizeGiftProbability,
  normalizeGiftRecord,
  pickWeightedGift,
  isMissingColumnError,
  supabaseWriteWithOptionalColumns,
  mapGiftRow,
  memoryGiftProbabilities,
};

export default app;
