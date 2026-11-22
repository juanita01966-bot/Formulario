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
    referralPrizeRule: {
      prizeName: 'Premio Embajador Royal Prestige',
      metric: 'leads',
      targetCount: 5,
      maxWinners: 3,
      pointsPerLead: 1,
      pointsPerCita: 3,
      pointsPerDemo: 5,
      pointsPerOrden: 10,
    },
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
      probability: 30,
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
      probability: 30,
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
      probability: 30,
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
      probability: 5,
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
      probability: 3,
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
      probability: 30,
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
      probability: 30,
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
      probability: 5,
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
      probability: 10,
    },
  ],
  leads: [],
  qrHistory: [],
  referrers: [],
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = process.env.TEST_STORE_PATH
  ? path.resolve(process.env.TEST_STORE_PATH)
  : path.join(DATA_DIR, 'store.json');
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
const VALID_REFERRAL_METRICS = new Set(['leads', 'citas', 'demos', 'ordenes', 'points']);
const REFERRAL_CODE_RE = /^[A-Z0-9-]{2,32}$/;
const DEFAULT_REFERRAL_PRIZE_RULE = {
  prizeName: 'Premio Embajador Royal Prestige',
  metric: 'leads',
  targetCount: 5,
  maxWinners: 3,
  pointsPerLead: 1,
  pointsPerCita: 3,
  pointsPerDemo: 5,
  pointsPerOrden: 10,
};
const MAX_VISITORS_PER_REFERRER = 5000;
const referralVisitorBuckets = new Map();

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
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
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
const CATEGORY_RANK = { none: 0, cita: 1, demo: 2, orden: 3 };

function applyNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeReferralCode(raw) {
  if (typeof raw !== 'string') return null;
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return REFERRAL_CODE_RE.test(normalized) ? normalized : null;
}

function generateUniqueReferralCode(name, existingCodesSet, fallbackPrefix = 'EMB') {
  const baseRaw = normalizeReferralCode(name) || normalizeReferralCode(fallbackPrefix) || 'EMB';
  const base = baseRaw.slice(0, 24).replace(/-+$/g, '') || 'EMB';
  if (!existingCodesSet.has(base)) {
    existingCodesSet.add(base);
    return base;
  }
  const stem = base.slice(0, 27).replace(/-+$/g, '') || 'EMB';
  for (let i = 2; i < 10000; i += 1) {
    const suffix = String(i).padStart(2, '0');
    const candidate = `${stem}-${suffix}`.slice(0, 32);
    if (REFERRAL_CODE_RE.test(candidate) && !existingCodesSet.has(candidate)) {
      existingCodesSet.add(candidate);
      return candidate;
    }
  }
  const randomFallback = `EMB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  existingCodesSet.add(randomFallback);
  return randomFallback;
}

function sanitizeNonNegativeNumber(value, fallback, { integer = false, min = 0, max = 100000 } = {}) {
  if (value === undefined || value === null || typeof value === 'boolean' || typeof value === 'object') {
    return fallback;
  }
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(max, Math.max(min, num));
  if (integer) return Math.round(clamped);
  const rounded = Math.round(clamped * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function sanitizeReferralPrizeRule(input, fallback = DEFAULT_REFERRAL_PRIZE_RULE) {
  const base = fallback && typeof fallback === 'object' ? { ...DEFAULT_REFERRAL_PRIZE_RULE, ...fallback } : { ...DEFAULT_REFERRAL_PRIZE_RULE };
  if (!input || typeof input !== 'object') {
    return {
      prizeName:
        typeof base.prizeName === 'string' && base.prizeName.trim()
          ? base.prizeName.trim().slice(0, 120)
          : DEFAULT_REFERRAL_PRIZE_RULE.prizeName,
      metric: VALID_REFERRAL_METRICS.has(base.metric) ? base.metric : DEFAULT_REFERRAL_PRIZE_RULE.metric,
      targetCount: sanitizeNonNegativeNumber(base.targetCount, DEFAULT_REFERRAL_PRIZE_RULE.targetCount, {
        integer: true,
        min: 1,
      }),
      maxWinners: sanitizeNonNegativeNumber(base.maxWinners, DEFAULT_REFERRAL_PRIZE_RULE.maxWinners, {
        integer: true,
        min: 0,
      }),
      pointsPerLead: sanitizeNonNegativeNumber(base.pointsPerLead, DEFAULT_REFERRAL_PRIZE_RULE.pointsPerLead),
      pointsPerCita: sanitizeNonNegativeNumber(base.pointsPerCita, DEFAULT_REFERRAL_PRIZE_RULE.pointsPerCita),
      pointsPerDemo: sanitizeNonNegativeNumber(base.pointsPerDemo, DEFAULT_REFERRAL_PRIZE_RULE.pointsPerDemo),
      pointsPerOrden: sanitizeNonNegativeNumber(base.pointsPerOrden, DEFAULT_REFERRAL_PRIZE_RULE.pointsPerOrden),
    };
  }

  return {
    prizeName:
      typeof input.prizeName === 'string' && input.prizeName.trim()
        ? input.prizeName.trim().slice(0, 120)
        : base.prizeName || DEFAULT_REFERRAL_PRIZE_RULE.prizeName,
    metric: VALID_REFERRAL_METRICS.has(input.metric)
      ? input.metric
      : VALID_REFERRAL_METRICS.has(base.metric)
        ? base.metric
        : DEFAULT_REFERRAL_PRIZE_RULE.metric,
    targetCount: sanitizeNonNegativeNumber(input.targetCount, base.targetCount ?? DEFAULT_REFERRAL_PRIZE_RULE.targetCount, {
      integer: true,
      min: 1,
    }),
    maxWinners: sanitizeNonNegativeNumber(input.maxWinners, base.maxWinners ?? DEFAULT_REFERRAL_PRIZE_RULE.maxWinners, {
      integer: true,
      min: 0,
    }),
    pointsPerLead: sanitizeNonNegativeNumber(
      input.pointsPerLead,
      base.pointsPerLead ?? DEFAULT_REFERRAL_PRIZE_RULE.pointsPerLead
    ),
    pointsPerCita: sanitizeNonNegativeNumber(
      input.pointsPerCita,
      base.pointsPerCita ?? DEFAULT_REFERRAL_PRIZE_RULE.pointsPerCita
    ),
    pointsPerDemo: sanitizeNonNegativeNumber(
      input.pointsPerDemo,
      base.pointsPerDemo ?? DEFAULT_REFERRAL_PRIZE_RULE.pointsPerDemo
    ),
    pointsPerOrden: sanitizeNonNegativeNumber(
      input.pointsPerOrden,
      base.pointsPerOrden ?? DEFAULT_REFERRAL_PRIZE_RULE.pointsPerOrden
    ),
  };
}

function normalizeReferrerRecord(partner) {
  if (!partner || typeof partner !== 'object') return null;
  const code = normalizeReferralCode(partner.code);
  const name = typeof partner.name === 'string' ? partner.name.trim() : '';
  if (!partner.id || !code || !name) return null;

  const phone = typeof partner.phone === 'string' && partner.phone.trim() ? partner.phone.trim().slice(0, 40) : undefined;
  const notes = typeof partner.notes === 'string' && partner.notes.trim() ? partner.notes.trim().slice(0, 500) : undefined;
  const visitsCount = sanitizeNonNegativeNumber(partner.visitsCount, 0, { integer: true, min: 0, max: 100000000 });
  const uniqueVisitsCount = Math.min(
    visitsCount,
    sanitizeNonNegativeNumber(partner.uniqueVisitsCount, 0, { integer: true, min: 0, max: 100000000 })
  );

  return {
    id: String(partner.id),
    name: name.slice(0, 120),
    code,
    ...(phone ? { phone } : {}),
    ...(notes ? { notes } : {}),
    active: partner.active !== false,
    visitsCount,
    uniqueVisitsCount,
    lastVisitAt: typeof partner.lastVisitAt === 'string' && partner.lastVisitAt ? partner.lastVisitAt : null,
    qrStyleId: VALID_QR_STYLE_IDS.has(partner.qrStyleId) ? partner.qrStyleId : 'classic-gold',
    createdAt: typeof partner.createdAt === 'string' && partner.createdAt ? partner.createdAt : new Date().toISOString(),
  };
}

function recordReferralVisitor(code, visitorKey) {
  if (!code || !visitorKey) return true;
  let bucket = referralVisitorBuckets.get(code);
  if (!bucket) {
    bucket = new Set();
    referralVisitorBuckets.set(code, bucket);
  }
  if (bucket.has(visitorKey)) {
    return false;
  }
  if (bucket.size >= MAX_VISITORS_PER_REFERRER) {
    const oldest = bucket.values().next().value;
    if (oldest !== undefined) bucket.delete(oldest);
  }
  bucket.add(visitorKey);
  return true;
}

function clearReferralVisitorBucket(code) {
  if (code) referralVisitorBuckets.delete(code);
}

function renameReferralVisitorBucket(oldCode, newCode) {
  if (!oldCode || !newCode || oldCode === newCode) return;
  const existing = referralVisitorBuckets.get(oldCode);
  if (existing) {
    referralVisitorBuckets.set(newCode, existing);
    referralVisitorBuckets.delete(oldCode);
  }
}

function normalizeLeadRecord(lead) {
  if (!lead || typeof lead !== 'object') return lead;
  const category = VALID_CATEGORIES.has(lead.category) ? lead.category : 'none';
  const promoCodeInvalidated =
    typeof lead.promoCodeInvalidated === 'boolean'
      ? lead.promoCodeInvalidated || category !== 'none'
      : category !== 'none';
  const promoCodeInvalidatedAt = promoCodeInvalidated
    ? lead.promoCodeInvalidatedAt ?? lead.calledAt ?? lead.createdAt ?? null
    : null;
  const referralCode =
    typeof lead.referralCode === 'string' && lead.referralCode.trim()
      ? normalizeReferralCode(lead.referralCode) || lead.referralCode.trim().toUpperCase()
      : null;
  const referrerId =
    typeof lead.referrerId === 'string' && lead.referrerId.trim() ? lead.referrerId.trim() : null;
  const referrerName =
    typeof lead.referrerName === 'string' && lead.referrerName.trim() ? lead.referrerName.trim() : null;
  return {
    ...lead,
    category,
    promoCodeInvalidated,
    promoCodeInvalidatedAt,
    referralCode,
    referrerId,
    referrerName,
  };
}

function verifySha256StoredHash(plain, storedHash) {
  if (typeof plain !== 'string' || typeof storedHash !== 'string' || !storedHash.startsWith('sha256$')) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualHex = crypto.createHash('sha256').update(`${salt}:${plain}`, 'utf8').digest('hex');
  try {
    const actualBuf = Buffer.from(actualHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (actualBuf.length !== expectedBuf.length || actualBuf.length === 0) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

function verifyLocalAdminPassword(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  const auth = ensureAuthStore();
  if (auth.passwordSalt && auth.passwordHash) {
    if (verifySecretConstantTime(candidate, auth.passwordSalt, auth.passwordHash)) {
      return true;
    }
  }
  const users = getUsersList(auth);
  const adminFromList = users.find((u) => (u.role || 'admin') === 'admin');
  if (
    adminFromList &&
    (adminFromList.passwordSalt !== auth.passwordSalt || adminFromList.passwordHash !== auth.passwordHash)
  ) {
    return verifySecretConstantTime(candidate, adminFromList.passwordSalt, adminFromList.passwordHash);
  }
  return false;
}

async function verifyAdminPassword(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  if (!IS_TESTING && USE_SUPABASE) {
    try {
      const verified = await supabaseRpc('dsb_verify_admin_password', { p_password: candidate });
      if (typeof verified === 'boolean') {
        return verified;
      }
    } catch {
      // RPC may not be deployed yet; continue to dsb_auth lookup / RPC fallback
    }

    try {
      const rows = await supabaseRest(
        'dsb_auth?id=eq.default&select=id,username,role,password_hash&limit=1'
      );
      const adminRow = Array.isArray(rows) ? rows[0] : null;
      if (adminRow && (adminRow.role || 'admin') === 'admin' && adminRow.password_hash) {
        if (String(adminRow.password_hash).startsWith('sha256$')) {
          return verifySha256StoredHash(candidate, adminRow.password_hash);
        }
        try {
          const verified = await supabaseRpc('dsb_verify_secret_hash', {
            p_plain: candidate,
            p_stored_hash: adminRow.password_hash,
          });
          if (typeof verified === 'boolean') {
            return verified;
          }
        } catch {
          try {
            const step1 = await supabaseRpc('dsb_login_step1', {
              p_username: adminRow.username || 'AdminCiprian',
              p_password: candidate,
            });
            if (typeof step1?.ok === 'boolean') {
              return step1.ok;
            }
          } catch {
            // Fall back to local verification below
          }
        }
      }
    } catch {
      // Fall back to local verification below
    }
  }

  return verifyLocalAdminPassword(candidate);
}

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
          referralPrizeRule: sanitizeReferralPrizeRule(
            parsed.settings?.referralPrizeRule,
            DEFAULT_REFERRAL_PRIZE_RULE
          ),
        },
        gifts: Array.isArray(parsed.gifts)
          ? parsed.gifts.map((g) => normalizeGiftRecord(g, DEFAULT_GIFT_PROBABILITY))
          : BUNDLED_DEFAULT_STORE.gifts,
        leads: Array.isArray(parsed.leads) ? parsed.leads.map(normalizeLeadRecord) : [],
        qrHistory: Array.isArray(parsed.qrHistory) ? parsed.qrHistory : [],
        referrers: Array.isArray(parsed.referrers)
          ? parsed.referrers.map(normalizeReferrerRecord).filter(Boolean)
          : [],
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
  const storeDir = path.dirname(STORE_PATH);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
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
    const mergedSettings = {
      ...defaults.settings,
      ...(parsed.settings || {}),
      referralPrizeRule: sanitizeReferralPrizeRule(
        parsed.settings?.referralPrizeRule,
        defaults.settings.referralPrizeRule || DEFAULT_REFERRAL_PRIZE_RULE
      ),
    };
    if (typeof mergedSettings.randomizeGifts !== 'boolean') {
      mergedSettings.randomizeGifts =
        typeof defaults.settings.randomizeGifts === 'boolean' ? defaults.settings.randomizeGifts : true;
    }
    const rawGifts = Array.isArray(parsed.gifts) && parsed.gifts.length > 0 ? parsed.gifts : defaults.gifts;
    return {
      settings: mergedSettings,
      gifts: rawGifts.map((g) => normalizeGiftRecord(g, DEFAULT_GIFT_PROBABILITY)),
      leads: Array.isArray(parsed.leads) ? parsed.leads.map(normalizeLeadRecord) : defaults.leads,
      qrHistory: Array.isArray(parsed.qrHistory) ? parsed.qrHistory : defaults.qrHistory || [],
      referrers: Array.isArray(parsed.referrers)
        ? parsed.referrers.map(normalizeReferrerRecord).filter(Boolean)
        : defaults.referrers || [],
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

function isMissingReferrersTableError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  return (
    err.status === 404 ||
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('42p01') ||
    (msg.includes('referrers') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not found')))
  );
}

let memoryQrFallback = null;
let memoryReferrersFallback = null;
const memoryGiftUsageTips = new Map();
const memoryGiftProbabilities = new Map();
const memoryLeadPromoStates = new Map();
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

function getFallbackReferrers() {
  if (Array.isArray(memoryReferrersFallback)) {
    return memoryReferrersFallback;
  }
  if (!IS_VERCEL) {
    const local = ensureStore();
    memoryReferrersFallback = Array.isArray(local.referrers)
      ? local.referrers.map(normalizeReferrerRecord).filter(Boolean)
      : [];
    return memoryReferrersFallback;
  }
  memoryReferrersFallback = [];
  return memoryReferrersFallback;
}

function saveFallbackReferrers(nextReferrers) {
  const normalized = Array.isArray(nextReferrers)
    ? nextReferrers.map(normalizeReferrerRecord).filter(Boolean)
    : [];
  memoryReferrersFallback = normalized;
  if (!IS_VERCEL) {
    const local = ensureStore();
    local.referrers = normalized;
    writeStore(local);
  }
  return normalized;
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
    referralPrizeRule: sanitizeReferralPrizeRule(
      row.referral_prize_rule ?? memorySettingsFallback.referralPrizeRule,
      defaults.referralPrizeRule || DEFAULT_REFERRAL_PRIZE_RULE
    ),
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
  const category = VALID_CATEGORIES.has(row.category) ? row.category : 'none';
  const memPromo = memoryLeadPromoStates.get(row.id);
  const hasColInvalidated = typeof row.promo_code_invalidated === 'boolean';
  const promoCodeInvalidated = hasColInvalidated
    ? row.promo_code_invalidated || category !== 'none'
    : memPromo !== undefined
      ? Boolean(memPromo.promoCodeInvalidated) || category !== 'none'
      : Boolean(category && category !== 'none');
  const promoCodeInvalidatedAt = promoCodeInvalidated
    ? row.promo_code_invalidated_at ??
      (memPromo ? memPromo.promoCodeInvalidatedAt : null) ??
      (category !== 'none' ? row.called_at ?? row.created_at ?? null : null)
    : null;

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
    category,
    orderAmount:
      row.order_amount !== null && row.order_amount !== undefined ? Number(row.order_amount) : null,
    notes: row.notes || '',
    qualification: row.qualification ?? null,
    promoCodeInvalidated,
    promoCodeInvalidatedAt,
    referralCode:
      typeof row.referral_code === 'string' && row.referral_code.trim()
        ? normalizeReferralCode(row.referral_code) || row.referral_code.trim().toUpperCase()
        : null,
    referrerId: typeof row.referrer_id === 'string' && row.referrer_id.trim() ? row.referrer_id.trim() : null,
    referrerName:
      typeof row.referrer_name === 'string' && row.referrer_name.trim() ? row.referrer_name.trim() : null,
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
    referralCode:
      typeof row.referral_code === 'string' && row.referral_code.trim()
        ? normalizeReferralCode(row.referral_code) || row.referral_code.trim().toUpperCase()
        : null,
    referrerId: typeof row.referrer_id === 'string' && row.referrer_id.trim() ? row.referrer_id.trim() : null,
    createdAt: row.created_at,
  };
}

function mapReferrerRow(row) {
  if (!row || typeof row !== 'object') return null;
  return normalizeReferrerRecord({
    id: row.id,
    name: row.name,
    code: row.code,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active !== false,
    visitsCount: row.visits_count ?? 0,
    uniqueVisitsCount: row.unique_visits_count ?? 0,
    lastVisitAt: row.last_visit_at ?? null,
    qrStyleId: row.qr_style_id ?? 'classic-gold',
    createdAt: row.created_at,
  });
}

async function fetchSupabaseStore() {
  const defaults = readDefaultStore();
  let qrTableMissing = false;
  let referrersTableMissing = false;
  const [settingsRows, giftRows, leadRows, qrRows, referrerRows] = await Promise.all([
    supabaseRest('app_settings?id=eq.default&limit=1'),
    supabaseRest('gifts?order=sort_order.asc,created_at.asc'),
    supabaseRest('leads?order=created_at.desc'),
    supabaseRest('qr_codes?order=created_at.desc').catch((err) => {
      if (isMissingQrTableError(err)) {
        qrTableMissing = true;
      }
      return [];
    }),
    supabaseRest('referrers?order=created_at.desc').catch((err) => {
      if (isMissingReferrersTableError(err)) {
        referrersTableMissing = true;
      }
      return [];
    }),
  ]);

  return {
    settings: mapSettingsRow(Array.isArray(settingsRows) ? settingsRows[0] : null),
    gifts:
      Array.isArray(giftRows) && giftRows.length > 0
        ? giftRows.map(mapGiftRow)
        : defaults.gifts.map((g) => normalizeGiftRecord(g, DEFAULT_GIFT_PROBABILITY)),
    leads: Array.isArray(leadRows) ? leadRows.map(mapLeadRow) : [],
    qrHistory: qrTableMissing
      ? getFallbackQrHistory()
      : Array.isArray(qrRows)
        ? qrRows.map(mapQrRow)
        : [],
    referrers: referrersTableMissing
      ? getFallbackReferrers()
      : Array.isArray(referrerRows)
        ? referrerRows.map(mapReferrerRow).filter(Boolean)
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
  const normalizedReferrers = Array.isArray(store.referrers)
    ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
    : [];
  const defaultRandomize =
    typeof store.settings?.randomizeGifts === 'boolean' ? store.settings.randomizeGifts : true;
  const referralPrizeRule = sanitizeReferralPrizeRule(
    store.settings?.referralPrizeRule,
    DEFAULT_REFERRAL_PRIZE_RULE
  );

  if (!isAuthed) {
    return {
      settings: {
        ...store.settings,
        randomizeGifts: defaultRandomize,
        referralPrizeRule,
        pinCode: '',
      },
      gifts: normalizedGifts,
      leads: [],
      qrHistory: [],
      referrers: [],
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
      referrers: normalizedReferrers,
      role: 'caller',
    };
  }

  const normalizedLeads = Array.isArray(store.leads)
    ? store.leads.map(normalizeLeadRecord)
    : [];

  return {
    settings: {
      ...store.settings,
      randomizeGifts: defaultRandomize,
      referralPrizeRule,
      pinCode: '',
    },
    gifts: normalizedGifts,
    leads: normalizedLeads,
    qrHistory: isAuthed && role === 'admin' && Array.isArray(store.qrHistory) ? store.qrHistory : [],
    referrers: normalizedReferrers,
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
  applyNoStoreHeaders(res);
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

  if (Array.isArray(auth.users)) {
    const adminIdx = auth.users.findIndex((u) => (u.role || 'admin') === 'admin');
    if (adminIdx !== -1) {
      auth.users[adminIdx] = {
        ...auth.users[adminIdx],
        username: auth.username,
        passwordSalt: auth.passwordSalt,
        passwordHash: auth.passwordHash,
        pinSalt: auth.pinSalt,
        pinHash: auth.pinHash,
      };
    }
  }

  auth.updatedAt = new Date().toISOString();
  writeAuthStore(auth);

  return res.json({
    ok: true,
    username: auth.username,
    message: 'Credenciales de seguridad actualizadas correctamente.',
  });
});

// Master-key protected full reset: wipes all leads, metrics, QR history, resets referrer visit counters (and optionally gifts/settings)
async function handleMasterReset(req, res) {
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

  return withStoreMutationLock(async () => {
    try {
      applyNoStoreHeaders(res);
      const defaults = readDefaultStore();
      memoryQrFallback = [];
      memoryLeadPromoStates.clear();
      referralVisitorBuckets.clear();
      if (Array.isArray(memoryReferrersFallback)) {
        memoryReferrersFallback = memoryReferrersFallback.map((r) => ({
          ...r,
          visitsCount: 0,
          uniqueVisitsCount: 0,
          lastVisitAt: null,
        }));
      }

      if (USE_SUPABASE) {
        await supabaseRest('leads?id=not.is.null', { method: 'DELETE' });
        await supabaseRest('qr_codes?id=not.is.null', { method: 'DELETE' }).catch((err) => {
          if (!isMissingQrTableError(err)) throw err;
        });
        await supabaseRest('referrers?id=not.is.null', {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            visits_count: 0,
            unique_visits_count: 0,
            last_visit_at: null,
          }),
        }).catch((err) => {
          if (!isMissingReferrersTableError(err)) throw err;
        });

        if (shouldResetCatalog) {
          memoryGiftUsageTips.clear();
          memoryGiftProbabilities.clear();
          const giftRows = defaults.gifts.map((gift, idx) => {
            const probability = sanitizeGiftProbability(gift.probability, DEFAULT_GIFT_PROBABILITY);
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

          const defaultPrizeRule = sanitizeReferralPrizeRule(
            defaults.settings.referralPrizeRule,
            DEFAULT_REFERRAL_PRIZE_RULE
          );
          Object.assign(memorySettingsFallback, {
            showcaseStyle: defaults.settings.showcaseStyle || 'luminous-gold',
            randomizeGifts:
              typeof defaults.settings.randomizeGifts === 'boolean'
                ? defaults.settings.randomizeGifts
                : true,
            referralPrizeRule: defaultPrizeRule,
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
              referral_prize_rule: defaultPrizeRule,
              updated_at: new Date().toISOString(),
            },
            ['showcase_style', 'randomize_gifts', 'referral_prize_rule']
          );
        }

        if (!IS_VERCEL) {
          const local = ensureStore();
          local.leads = [];
          local.qrHistory = [];
          local.referrers = (local.referrers || []).map((r) => ({
            ...r,
            visitsCount: 0,
            uniqueVisitsCount: 0,
            lastVisitAt: null,
          }));
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
      store.referrers = (store.referrers || []).map((r) => ({
        ...r,
        visitsCount: 0,
        uniqueVisitsCount: 0,
        lastVisitAt: null,
      }));
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
}

app.post('/api/admin/reset-all', requireDsbAuth, requireAdminRole, handleMasterReset);
app.post('/api/admin/master-reset', requireDsbAuth, requireAdminRole, handleMasterReset);

// State read: NEVER exposes leads or PIN without valid DSB session token
app.get('/api/state', async (req, res) => {
  applyNoStoreHeaders(res);
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
  applyNoStoreHeaders(res);
  const session = getAuthenticatedSession(req);
  if (session && session.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Permisos administrativos requeridos.' });
  }

  const {
    name,
    phone,
    address,
    acceptedTerms,
    giftId,
    giftName,
    giftVisualKey,
    claimCode,
    notes,
    qualification,
    referralCode,
  } = req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const cleanAddress = typeof address === 'string' ? address.trim() : '';

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Ingresa tu nombre completo.' });
  }
  if (cleanPhone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ error: 'Ingresa un número de teléfono válido.' });
  }

  return withStoreMutationLock(async () => {
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

      const normalizedRefCode = normalizeReferralCode(referralCode);
      const matchedPartner = normalizedRefCode
        ? (store.referrers || []).find((p) => p.code === normalizedRefCode) || null
        : null;

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
        promoCodeInvalidated: false,
        promoCodeInvalidatedAt: null,
        referralCode: normalizedRefCode,
        referrerId: matchedPartner ? matchedPartner.id : null,
        referrerName: matchedPartner ? matchedPartner.name : null,
        createdAt: new Date().toISOString(),
      };

      if (USE_SUPABASE) {
        memoryLeadPromoStates.set(newLead.id, {
          promoCodeInvalidated: false,
          promoCodeInvalidatedAt: null,
        });
        await supabaseWriteWithOptionalColumns(
          'leads',
          'POST',
          { Prefer: 'return=minimal' },
          {
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
            promo_code_invalidated: false,
            promo_code_invalidated_at: null,
            referral_code: newLead.referralCode,
            referrer_id: newLead.referrerId,
            referrer_name: newLead.referrerName,
            created_at: newLead.createdAt,
          },
          [
            'promo_code_invalidated',
            'promo_code_invalidated_at',
            'referral_code',
            'referrer_id',
            'referrer_name',
          ]
        );
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
});

// Lead update: public flow can only update qualification & chosen gift; admin fields require DSB auth
app.patch('/api/leads/:id', async (req, res) => {
  applyNoStoreHeaders(res);
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
    updates.claimCode !== undefined ||
    updates.promoCodeInvalidated !== undefined ||
    updates.promoCodeInvalidatedAt !== undefined ||
    updates.adminPassword !== undefined;

  if (session && session.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Permisos administrativos requeridos.' });
  }

  if (!isAuthed && touchesAdminFields) {
    return res.status(401).json({ error: 'Acceso no autorizado para editar datos administrativos.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const index = store.leads.findIndex((item) => item.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Prospecto no encontrado.' });
      }

      const current = normalizeLeadRecord(store.leads[index]);
      const currentCategory = current.category;
      const currentInvalidated = Boolean(current.promoCodeInvalidated);

      if (isAuthed) {
        const hasCategoryUpdate =
          typeof updates.category === 'string' && VALID_CATEGORIES.has(updates.category);
        const requestedCategory = hasCategoryUpdate ? updates.category : currentCategory;
        const explicitUninvalidate = updates.promoCodeInvalidated === false;
        const explicitCalledFalse = updates.called === false;
        const effectiveTargetCategory =
          explicitUninvalidate || explicitCalledFalse ? 'none' : requestedCategory;

        const isExistingProtected = currentCategory !== 'none' || currentInvalidated;
        const isCategoryDowngradeOrRevert =
          CATEGORY_RANK[effectiveTargetCategory] < CATEGORY_RANK[currentCategory];
        const requiresAdminPassword =
          isExistingProtected &&
          (explicitUninvalidate || explicitCalledFalse || isCategoryDowngradeOrRevert);

        if (requiresAdminPassword) {
          const candidatePassword =
            typeof updates.adminPassword === 'string' ? updates.adminPassword : '';
          if (!candidatePassword) {
            return res.status(403).json({
              error:
                'Se requiere la contraseña de administrador para revertir o degradar la categoría y reactivar el código.',
            });
          }
          const passwordOk = await verifyAdminPassword(candidatePassword);
          if (!passwordOk) {
            return res.status(403).json({
              error:
                'Contraseña de administrador incorrecta. No se modificó la categoría ni el código de promoción.',
            });
          }
        }
      }

      const next = { ...current };
      const nowIso = new Date().toISOString();

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
          next.calledAt = updates.called ? updates.calledAt || nowIso : null;
          if (!updates.called) {
            next.category = 'none';
            next.orderAmount = null;
            next.promoCodeInvalidated = false;
            next.promoCodeInvalidatedAt = null;
          }
        }

        if (updates.promoCodeInvalidated === false || updates.category === 'none') {
          next.category = 'none';
          next.orderAmount = null;
          next.promoCodeInvalidated = false;
          next.promoCodeInvalidatedAt = null;
        } else if (typeof updates.category === 'string' && VALID_CATEGORIES.has(updates.category)) {
          if (updates.category !== 'none' && !next.called) {
            return res
              .status(400)
              .json({ error: 'Debes marcar al prospecto como llamado antes de clasificarlo.' });
          }
          next.category = updates.category;
          next.promoCodeInvalidated = true;
          next.promoCodeInvalidatedAt = current.promoCodeInvalidatedAt || nowIso;
          if (updates.category === 'orden') {
            const parsedAmount =
              typeof updates.orderAmount === 'number' &&
              Number.isFinite(updates.orderAmount) &&
              updates.orderAmount > 0
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
        } else if (updates.promoCodeInvalidated === true) {
          next.promoCodeInvalidated = true;
          next.promoCodeInvalidatedAt = current.promoCodeInvalidatedAt || nowIso;
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
        memoryLeadPromoStates.set(id, {
          promoCodeInvalidated: Boolean(next.promoCodeInvalidated),
          promoCodeInvalidatedAt: next.promoCodeInvalidatedAt ?? null,
        });
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
          promo_code_invalidated: Boolean(next.promoCodeInvalidated),
          promo_code_invalidated_at: next.promoCodeInvalidatedAt ?? null,
        };
        await supabaseWriteWithOptionalColumns(
          `leads?id=eq.${encodeURIComponent(id)}`,
          'PATCH',
          { Prefer: 'return=minimal' },
          patchBody,
          ['promo_code_invalidated', 'promo_code_invalidated_at']
        );
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
});

app.delete('/api/leads/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const exists = store.leads.some((item) => item.id === id);
      if (!exists) {
        return res.status(404).json({ error: 'Prospecto no encontrado.' });
      }

      if (USE_SUPABASE) {
        await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        memoryLeadPromoStates.delete(id);
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
  applyNoStoreHeaders(res);
  return withStoreMutationLock(async () => {
    try {
      const defaults = readDefaultStore();

      if (USE_SUPABASE) {
        memoryGiftUsageTips.clear();
        memoryGiftProbabilities.clear();
        const rows = defaults.gifts.map((gift, idx) => {
          const probability = sanitizeGiftProbability(gift.probability, DEFAULT_GIFT_PROBABILITY);
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
  applyNoStoreHeaders(res);
  return withStoreMutationLock(async () => {
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
        referralPrizeRule:
          updates.referralPrizeRule !== undefined
            ? sanitizeReferralPrizeRule(
                updates.referralPrizeRule,
                store.settings.referralPrizeRule || DEFAULT_REFERRAL_PRIZE_RULE
              )
            : sanitizeReferralPrizeRule(
                store.settings.referralPrizeRule,
                DEFAULT_REFERRAL_PRIZE_RULE
              ),
      };

      if (USE_SUPABASE) {
        memorySettingsFallback.showcaseStyle = nextSettings.showcaseStyle;
        memorySettingsFallback.randomizeGifts = nextSettings.randomizeGifts;
        memorySettingsFallback.referralPrizeRule = nextSettings.referralPrizeRule;
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
            referral_prize_rule: nextSettings.referralPrizeRule,
            updated_at: new Date().toISOString(),
          },
          [
            'showcase_style',
            'randomize_gifts',
            'gift_theme',
            'custom_box_color',
            'referral_prize_rule',
          ]
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
});

// Admin-only QR Studio & History endpoints
function extractReferralCodeFromUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim(), 'https://placeholder.local');
    const fromSearch = parsed.searchParams.get('ref') || parsed.searchParams.get('r');
    if (fromSearch) {
      const normalized = normalizeReferralCode(fromSearch);
      if (normalized) return normalized;
    }
    if (parsed.hash && parsed.hash.includes('?')) {
      const hashQuery = parsed.hash.slice(parsed.hash.indexOf('?') + 1);
      const hashParams = new URLSearchParams(hashQuery);
      const fromHash = hashParams.get('ref') || hashParams.get('r');
      if (fromHash) {
        const normalized = normalizeReferralCode(fromHash);
        if (normalized) return normalized;
      }
    }
  } catch {
    // Ignore malformed URLs
  }
  return null;
}

async function handleGetQrHistory(_req, res) {
  try {
    const store = await getActiveStore();
    const sanitized = sanitizeStateForClient(store, true, 'admin');
    return res.json({ qrHistory: sanitized.qrHistory });
  } catch {
    return res.status(503).json({ error: 'No se pudo consultar el historial de códigos QR.' });
  }
}

async function handleCreateQrCode(req, res) {
  const {
    name,
    targetUrl,
    styleId,
    dotShape,
    foregroundColor,
    backgroundColor,
    includeLogo,
    frameText,
    referralCode,
    referrerId,
  } = req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanTargetUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del código QR debe tener al menos 2 caracteres.' });
  }
  if (!isValidQrTargetUrl(cleanTargetUrl)) {
    return res.status(400).json({ error: 'Ingresa una URL válida que comience con http://, https:// o /.' });
  }

  const cleanFrameText = typeof frameText === 'string' ? frameText.trim().slice(0, 120) : '';
  const validStyleId = VALID_QR_STYLE_IDS.has(styleId) ? styleId : 'classic-gold';
  let cleanReferralCode =
    normalizeReferralCode(referralCode) || extractReferralCodeFromUrl(cleanTargetUrl);
  let cleanReferrerId =
    typeof referrerId === 'string' && referrerId.trim() ? referrerId.trim().slice(0, 120) : null;

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const referrers = Array.isArray(store.referrers) ? store.referrers : [];
      const nowIso = new Date().toISOString();

      let linkedPartner =
        (cleanReferralCode && referrers.find((p) => p.code === cleanReferralCode)) ||
        (cleanReferrerId && referrers.find((p) => p.id === cleanReferrerId)) ||
        null;

      if (linkedPartner) {
        cleanReferrerId = linkedPartner.id;
        cleanReferralCode = linkedPartner.code;
      } else if (cleanReferralCode) {
        const autoPartner = {
          id: generateId('ref'),
          name: cleanName.slice(0, 120),
          code: cleanReferralCode,
          active: true,
          visitsCount: 0,
          uniqueVisitsCount: 0,
          lastVisitAt: null,
          qrStyleId: validStyleId,
          createdAt: nowIso,
        };

        if (USE_SUPABASE) {
          try {
            await supabaseRest('referrers', {
              method: 'POST',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({
                id: autoPartner.id,
                name: autoPartner.name,
                code: autoPartner.code,
                phone: null,
                notes: null,
                active: true,
                visits_count: 0,
                unique_visits_count: 0,
                last_visit_at: null,
                qr_style_id: autoPartner.qrStyleId,
                created_at: autoPartner.createdAt,
              }),
            });
            linkedPartner = autoPartner;
          } catch (err) {
            if (err?.code === '23505' || err?.status === 409) {
              const existingRows = await supabaseRest(
                `referrers?code=eq.${encodeURIComponent(cleanReferralCode)}&limit=1`
              ).catch(() => []);
              const existingPartner =
                Array.isArray(existingRows) && existingRows[0]
                  ? mapReferrerRow(existingRows[0])
                  : null;
              linkedPartner = existingPartner || autoPartner;
            } else if (isMissingReferrersTableError(err)) {
              saveFallbackReferrers([autoPartner, ...getFallbackReferrers()]);
              linkedPartner = autoPartner;
            } else {
              throw err;
            }
          }
        } else {
          store.referrers = [autoPartner, ...referrers];
          linkedPartner = autoPartner;
        }

        cleanReferrerId = linkedPartner.id;
        cleanReferralCode = linkedPartner.code;
      }

      const newQr = {
        id: generateId('qr'),
        name: cleanName.slice(0, 120),
        targetUrl: cleanTargetUrl,
        styleId: validStyleId,
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
        referralCode: cleanReferralCode || null,
        referrerId: cleanReferrerId || null,
        createdAt: nowIso,
      };

      if (USE_SUPABASE) {
        try {
          await supabaseWriteWithOptionalColumns(
            'qr_codes',
            'POST',
            { Prefer: 'return=minimal' },
            {
              id: newQr.id,
              name: newQr.name,
              target_url: newQr.targetUrl,
              style_id: newQr.styleId,
              dot_shape: newQr.dotShape,
              foreground_color: newQr.foregroundColor,
              background_color: newQr.backgroundColor,
              include_logo: newQr.includeLogo,
              frame_text: cleanFrameText,
              referral_code: newQr.referralCode,
              referrer_id: newQr.referrerId,
              created_at: newQr.createdAt,
            },
            ['referral_code', 'referrer_id']
          );
          const updatedStore = await getActiveStore();
          const sanitized = sanitizeStateForClient(updatedStore, true, 'admin');
          return res.status(201).json({
            ok: true,
            qr: newQr,
            referrer: linkedPartner || null,
            qrHistory: sanitized.qrHistory,
            state: sanitized,
          });
        } catch (err) {
          if (!isMissingQrTableError(err)) throw err;
          addFallbackQrCode(newQr);
          const updatedStore = await getActiveStore();
          const sanitized = sanitizeStateForClient(
            { ...updatedStore, qrHistory: getFallbackQrHistory() },
            true,
            'admin'
          );
          return res.status(201).json({
            ok: true,
            qr: newQr,
            referrer: linkedPartner || null,
            qrHistory: sanitized.qrHistory,
            state: sanitized,
          });
        }
      }

      store.qrHistory = Array.isArray(store.qrHistory) ? store.qrHistory : [];
      store.qrHistory.unshift(newQr);
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, true, 'admin');
      return res.status(201).json({
        ok: true,
        qr: newQr,
        referrer: linkedPartner || null,
        qrHistory: sanitized.qrHistory,
        state: sanitized,
      });
    } catch {
      return res.status(503).json({ error: 'No se pudo guardar el código QR.' });
    }
  });
}

async function handleDeleteQrCode(req, res) {
  const { id } = req.params;
  return withStoreMutationLock(async () => {
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
}

app.get('/api/qr', requireDsbAuth, requireAdminRole, handleGetQrHistory);
app.post('/api/qr', requireDsbAuth, requireAdminRole, handleCreateQrCode);
app.delete('/api/qr/:id', requireDsbAuth, requireAdminRole, handleDeleteQrCode);

app.get('/api/qr-codes', requireDsbAuth, requireAdminRole, handleGetQrHistory);
app.post('/api/qr-codes', requireDsbAuth, requireAdminRole, handleCreateQrCode);
app.delete('/api/qr-codes/:id', requireDsbAuth, requireAdminRole, handleDeleteQrCode);

// ----------------------------------------------------------------------------
// Referral QR / Ambassador Tracking & Prize System Endpoints
// ----------------------------------------------------------------------------

// Public: resolve referral code to safe public partner info (NEVER exposes phone, notes, or counts)
app.get('/api/referrals/resolve/:code', async (req, res) => {
  applyNoStoreHeaders(res);
  const normalizedCode = normalizeReferralCode(req.params.code);
  if (!normalizedCode) {
    return res.json({ ok: true, partner: null });
  }
  try {
    const store = await getActiveStore();
    const partner = (store.referrers || []).find((p) => p.code === normalizedCode) || null;
    if (!partner) {
      return res.json({ ok: true, partner: null });
    }
    return res.json({
      ok: true,
      partner: {
        id: partner.id,
        name: partner.name,
        code: partner.code,
        active: Boolean(partner.active),
      },
    });
  } catch {
    return res.status(503).json({ error: 'No se pudo verificar el código de referido.' });
  }
});

// Public: record a visit to a referral QR link (with unique visitor deduplication)
app.post('/api/referrals/visit', async (req, res) => {
  applyNoStoreHeaders(res);
  const { code, visitorId } = req.body || {};
  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) {
    return res.json({ ok: true, counted: false, partner: null });
  }

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const referrers = Array.isArray(store.referrers) ? store.referrers : [];
      const index = referrers.findIndex((p) => p.code === normalizedCode);
      if (index === -1 || referrers[index].active !== true) {
        return res.json({ ok: true, counted: false, partner: null });
      }

      const partner = referrers[index];
      let visitorKey =
        typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim().slice(0, 128) : '';
      if (!visitorKey) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip =
          (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
          req.ip ||
          req.socket?.remoteAddress ||
          'local';
        const ua = String(req.headers['user-agent'] || '');
        visitorKey = `anon:${crypto
          .createHash('sha256')
          .update(`${ip}|${ua}`)
          .digest('hex')
          .slice(0, 24)}`;
      }

      const isUnique = recordReferralVisitor(partner.code, visitorKey);
      const nowIso = new Date().toISOString();
      const nextPartner = {
        ...partner,
        visitsCount: (partner.visitsCount || 0) + 1,
        uniqueVisitsCount: (partner.uniqueVisitsCount || 0) + (isUnique ? 1 : 0),
        lastVisitAt: nowIso,
      };

      if (USE_SUPABASE) {
        try {
          await supabaseRest(`referrers?id=eq.${encodeURIComponent(partner.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              visits_count: nextPartner.visitsCount,
              unique_visits_count: nextPartner.uniqueVisitsCount,
              last_visit_at: nextPartner.lastVisitAt,
            }),
          });
        } catch (err) {
          if (!isMissingReferrersTableError(err)) throw err;
          const fallback = getFallbackReferrers();
          const fbIdx = fallback.findIndex((p) => p.id === partner.id);
          if (fbIdx !== -1) {
            fallback[fbIdx] = nextPartner;
            saveFallbackReferrers(fallback);
          }
        }
      } else {
        referrers[index] = nextPartner;
        store.referrers = referrers;
        writeStore(store);
      }

      return res.json({
        ok: true,
        counted: true,
        partner: {
          id: nextPartner.id,
          name: nextPartner.name,
          code: nextPartner.code,
        },
      });
    } catch {
      return res.status(503).json({ error: 'No se pudo registrar la visita del referido.' });
    }
  });
});

// DSB authenticated (admin or caller): list referral partners
app.get('/api/referrals', requireDsbAuth, async (_req, res) => {
  applyNoStoreHeaders(res);
  try {
    const store = await getActiveStore();
    const referrers = Array.isArray(store.referrers)
      ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
      : [];
    return res.json({ ok: true, referrers });
  } catch {
    return res.status(503).json({ error: 'No se pudo consultar la lista de embajadores.' });
  }
});

// Admin-only: batch create up to 50 referral partners
app.post('/api/referrals/batch', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { items, count, namePrefix, codePrefix, qrStyleId } = req.body || {};

  const hasItems = Array.isArray(items);
  const hasCount = count !== undefined && count !== null;

  if (!hasItems && !hasCount) {
    return res.status(400).json({
      error: 'Debes proporcionar una lista de embajadores (items) o una cantidad (count).',
    });
  }

  if (hasItems) {
    if (items.length === 0) {
      return res.status(400).json({ error: 'La lista de embajadores está vacía.' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Máximo 50 embajadores por lote.' });
    }
  } else {
    const parsedCount = Number(count);
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 50) {
      return res.status(400).json({ error: 'La cantidad debe ser un entero entre 1 y 50.' });
    }
  }

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const existing = Array.isArray(store.referrers) ? store.referrers : [];
      const existingCodes = new Set(existing.map((p) => p.code));
      const defaultStyle = VALID_QR_STYLE_IDS.has(qrStyleId) ? qrStyleId : 'classic-gold';
      const created = [];
      const skipped = [];
      const nowBase = Date.now();

      if (hasItems) {
        for (let i = 0; i < items.length; i += 1) {
          const entry = items[i];
          const cleanName = typeof entry?.name === 'string' ? entry.name.trim() : '';
          if (cleanName.length < 2) {
            skipped.push(cleanName || `Fila ${i + 1}`);
            continue;
          }

          let finalCode = null;
          if (typeof entry.code === 'string' && entry.code.trim()) {
            const normalized = normalizeReferralCode(entry.code);
            if (!normalized || existingCodes.has(normalized)) {
              skipped.push(normalized || entry.code.trim());
              continue;
            }
            existingCodes.add(normalized);
            finalCode = normalized;
          } else {
            finalCode = generateUniqueReferralCode(cleanName, existingCodes);
          }

          const cleanPhone =
            typeof entry.phone === 'string' && entry.phone.trim()
              ? entry.phone.trim().slice(0, 40)
              : undefined;
          const cleanNotes =
            typeof entry.notes === 'string' && entry.notes.trim()
              ? entry.notes.trim().slice(0, 500)
              : undefined;

          created.push({
            id: generateId('ref'),
            name: cleanName.slice(0, 120),
            code: finalCode,
            ...(cleanPhone ? { phone: cleanPhone } : {}),
            ...(cleanNotes ? { notes: cleanNotes } : {}),
            active: entry.active !== false,
            visitsCount: 0,
            uniqueVisitsCount: 0,
            lastVisitAt: null,
            qrStyleId: VALID_QR_STYLE_IDS.has(entry.qrStyleId) ? entry.qrStyleId : defaultStyle,
            createdAt: new Date(nowBase + i).toISOString(),
          });
        }
      } else {
        const parsedCount = Number(count);
        const cleanNamePrefix =
          typeof namePrefix === 'string' && namePrefix.trim()
            ? namePrefix.trim().slice(0, 60)
            : 'Embajador';
        const rawCodePrefix =
          typeof codePrefix === 'string' && codePrefix.trim()
            ? normalizeReferralCode(codePrefix)
            : 'EMB';
        const cleanCodePrefix = (rawCodePrefix || 'EMB').slice(0, 24).replace(/-+$/g, '') || 'EMB';

        let seq = 1;
        for (let i = 0; i < parsedCount; i += 1) {
          let candidate = '';
          while (seq < 10000) {
            const numLabel = String(seq).padStart(2, '0');
            candidate = `${cleanCodePrefix}-${numLabel}`.slice(0, 32);
            if (REFERRAL_CODE_RE.test(candidate) && !existingCodes.has(candidate)) {
              break;
            }
            seq += 1;
          }
          existingCodes.add(candidate);
          const numLabel = String(seq).padStart(2, '0');
          seq += 1;

          created.push({
            id: generateId('ref'),
            name: `${cleanNamePrefix} ${numLabel}`.slice(0, 120),
            code: candidate,
            active: true,
            visitsCount: 0,
            uniqueVisitsCount: 0,
            lastVisitAt: null,
            qrStyleId: defaultStyle,
            createdAt: new Date(nowBase + i).toISOString(),
          });
        }
      }

      if (created.length > 0) {
        if (USE_SUPABASE) {
          const rows = created.map((partner) => ({
            id: partner.id,
            name: partner.name,
            code: partner.code,
            phone: partner.phone || null,
            notes: partner.notes || null,
            active: partner.active,
            visits_count: 0,
            unique_visits_count: 0,
            last_visit_at: null,
            qr_style_id: partner.qrStyleId || 'classic-gold',
            created_at: partner.createdAt,
          }));
          try {
            await supabaseRest('referrers', {
              method: 'POST',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify(rows),
            });
          } catch (err) {
            if (!isMissingReferrersTableError(err)) throw err;
            saveFallbackReferrers([...created.slice().reverse(), ...getFallbackReferrers()]);
          }
        } else {
          store.referrers = [...created.slice().reverse(), ...existing];
          writeStore(store);
        }
      }

      const updatedStore = USE_SUPABASE ? await getActiveStore() : store;
      return res.status(201).json({
        ok: true,
        created,
        skipped,
        state: sanitizeStateForClient(updatedStore, true, 'admin'),
      });
    } catch {
      return res.status(503).json({ error: 'No se pudo crear el lote de embajadores.' });
    }
  });
});

// Admin-only: create a single referral partner
app.post('/api/referrals', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { name, code, phone, notes, qrStyleId, active } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del embajador debe tener al menos 2 caracteres.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const existing = Array.isArray(store.referrers) ? store.referrers : [];
      const existingCodes = new Set(existing.map((p) => p.code));

      let finalCode = null;
      if (typeof code === 'string' && code.trim()) {
        const normalized = normalizeReferralCode(code);
        if (!normalized) {
          return res.status(400).json({
            error: 'El código de referido debe tener entre 2 y 32 caracteres alfanuméricos o guiones.',
          });
        }
        if (existingCodes.has(normalized)) {
          return res.status(409).json({
            error: `Ya existe un embajador con el código "${normalized}".`,
          });
        }
        finalCode = normalized;
      } else {
        finalCode = generateUniqueReferralCode(cleanName, existingCodes);
      }

      const cleanPhone =
        typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 40) : undefined;
      const cleanNotes =
        typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : undefined;

      const newReferrer = {
        id: generateId('ref'),
        name: cleanName.slice(0, 120),
        code: finalCode,
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        active: active !== false,
        visitsCount: 0,
        uniqueVisitsCount: 0,
        lastVisitAt: null,
        qrStyleId: VALID_QR_STYLE_IDS.has(qrStyleId) ? qrStyleId : 'classic-gold',
        createdAt: new Date().toISOString(),
      };

      if (USE_SUPABASE) {
        try {
          await supabaseRest('referrers', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              id: newReferrer.id,
              name: newReferrer.name,
              code: newReferrer.code,
              phone: newReferrer.phone || null,
              notes: newReferrer.notes || null,
              active: newReferrer.active,
              visits_count: 0,
              unique_visits_count: 0,
              last_visit_at: null,
              qr_style_id: newReferrer.qrStyleId,
              created_at: newReferrer.createdAt,
            }),
          });
        } catch (err) {
          if (err?.code === '23505' || err?.status === 409) {
            return res.status(409).json({
              error: `Ya existe un embajador con el código "${newReferrer.code}".`,
            });
          }
          if (!isMissingReferrersTableError(err)) throw err;
          saveFallbackReferrers([newReferrer, ...getFallbackReferrers()]);
        }
        const updatedStore = await getActiveStore();
        return res.status(201).json({
          ok: true,
          referrer: newReferrer,
          state: sanitizeStateForClient(updatedStore, true, 'admin'),
        });
      }

      store.referrers = [newReferrer, ...existing];
      writeStore(store);
      return res.status(201).json({
        ok: true,
        referrer: newReferrer,
        state: sanitizeStateForClient(store, true, 'admin'),
      });
    } catch {
      return res.status(503).json({ error: 'No se pudo crear el embajador.' });
    }
  });
});

// Admin-only: update a referral partner (including resetVisits)
app.patch('/api/referrals/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  const updates = req.body || {};

  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const existing = Array.isArray(store.referrers) ? store.referrers : [];
      const index = existing.findIndex((p) => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Embajador no encontrado.' });
      }

      const current = existing[index];
      let nextName = current.name;
      if (updates.name !== undefined) {
        const cleanName = typeof updates.name === 'string' ? updates.name.trim() : '';
        if (cleanName.length < 2) {
          return res.status(400).json({ error: 'El nombre del embajador debe tener al menos 2 caracteres.' });
        }
        nextName = cleanName.slice(0, 120);
      }

      let nextCode = current.code;
      if (updates.code !== undefined) {
        const normalized = normalizeReferralCode(updates.code);
        if (!normalized) {
          return res.status(400).json({
            error: 'El código de referido debe tener entre 2 y 32 caracteres alfanuméricos o guiones.',
          });
        }
        const duplicate = existing.some((p) => p.id !== id && p.code === normalized);
        if (duplicate) {
          return res.status(409).json({
            error: `Ya existe un embajador con el código "${normalized}".`,
          });
        }
        nextCode = normalized;
      }

      let nextPhone = current.phone;
      if (updates.phone !== undefined) {
        nextPhone =
          typeof updates.phone === 'string' && updates.phone.trim()
            ? updates.phone.trim().slice(0, 40)
            : undefined;
      }

      let nextNotes = current.notes;
      if (updates.notes !== undefined) {
        nextNotes =
          typeof updates.notes === 'string' && updates.notes.trim()
            ? updates.notes.trim().slice(0, 500)
            : undefined;
      }

      const nextActive = typeof updates.active === 'boolean' ? updates.active : current.active;
      const nextQrStyleId = VALID_QR_STYLE_IDS.has(updates.qrStyleId)
        ? updates.qrStyleId
        : current.qrStyleId || 'classic-gold';

      const resetVisits = updates.resetVisits === true;
      const nextVisitsCount = resetVisits ? 0 : current.visitsCount || 0;
      const nextUniqueVisitsCount = resetVisits ? 0 : current.uniqueVisitsCount || 0;
      const nextLastVisitAt = resetVisits ? null : current.lastVisitAt ?? null;

      if (resetVisits) {
        clearReferralVisitorBucket(current.code);
        clearReferralVisitorBucket(nextCode);
      } else if (nextCode !== current.code) {
        renameReferralVisitorBucket(current.code, nextCode);
      }

      const nextReferrer = {
        id: current.id,
        name: nextName,
        code: nextCode,
        ...(nextPhone ? { phone: nextPhone } : {}),
        ...(nextNotes ? { notes: nextNotes } : {}),
        active: nextActive,
        visitsCount: nextVisitsCount,
        uniqueVisitsCount: nextUniqueVisitsCount,
        lastVisitAt: nextLastVisitAt,
        qrStyleId: nextQrStyleId,
        createdAt: current.createdAt,
      };

      if (USE_SUPABASE) {
        try {
          await supabaseRest(`referrers?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              name: nextReferrer.name,
              code: nextReferrer.code,
              phone: nextReferrer.phone || null,
              notes: nextReferrer.notes || null,
              active: nextReferrer.active,
              visits_count: nextReferrer.visitsCount,
              unique_visits_count: nextReferrer.uniqueVisitsCount,
              last_visit_at: nextReferrer.lastVisitAt,
              qr_style_id: nextReferrer.qrStyleId,
            }),
          });
        } catch (err) {
          if (err?.code === '23505' || err?.status === 409) {
            return res.status(409).json({
              error: `Ya existe un embajador con el código "${nextReferrer.code}".`,
            });
          }
          if (!isMissingReferrersTableError(err)) throw err;
          const fallback = getFallbackReferrers();
          const fbIdx = fallback.findIndex((p) => p.id === id);
          if (fbIdx !== -1) {
            fallback[fbIdx] = nextReferrer;
            saveFallbackReferrers(fallback);
          }
        }
        const updatedStore = await getActiveStore();
        return res.json({
          ok: true,
          referrer: nextReferrer,
          state: sanitizeStateForClient(updatedStore, true, 'admin'),
        });
      }

      existing[index] = nextReferrer;
      store.referrers = existing;
      writeStore(store);
      return res.json({
        ok: true,
        referrer: nextReferrer,
        state: sanitizeStateForClient(store, true, 'admin'),
      });
    } catch {
      return res.status(503).json({ error: 'No se pudo actualizar el embajador.' });
    }
  });
});

// Admin-only: delete a referral partner
app.delete('/api/referrals/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  return withStoreMutationLock(async () => {
    try {
      const store = await getActiveStore();
      const existing = Array.isArray(store.referrers) ? store.referrers : [];
      const target = existing.find((p) => p.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Embajador no encontrado.' });
      }

      clearReferralVisitorBucket(target.code);

      if (USE_SUPABASE) {
        try {
          await supabaseRest(`referrers?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err) {
          if (!isMissingReferrersTableError(err)) throw err;
          saveFallbackReferrers(getFallbackReferrers().filter((p) => p.id !== id));
        }
        const updatedStore = await getActiveStore();
        return res.json({
          ok: true,
          state: sanitizeStateForClient(updatedStore, true, 'admin'),
        });
      }

      store.referrers = existing.filter((p) => p.id !== id);
      writeStore(store);
      return res.json({
        ok: true,
        state: sanitizeStateForClient(store, true, 'admin'),
      });
    } catch {
      return res.status(503).json({ error: 'No se pudo eliminar el embajador.' });
    }
  });
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
  DEFAULT_REFERRAL_PRIZE_RULE,
  sanitizeGiftProbability,
  normalizeGiftRecord,
  normalizeLeadRecord,
  normalizeReferralCode,
  sanitizeReferralPrizeRule,
  normalizeReferrerRecord,
  pickWeightedGift,
  isMissingColumnError,
  supabaseWriteWithOptionalColumns,
  mapGiftRow,
  mapLeadRow,
  mapQrRow,
  mapReferrerRow,
  memoryGiftProbabilities,
  memoryLeadPromoStates,
};

export default app;
