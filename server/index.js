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
  visitLog: [],
  securityAlerts: [],
  activityLogs: [],
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = process.env.TEST_STORE_PATH
  ? path.resolve(process.env.TEST_STORE_PATH)
  : path.join(DATA_DIR, 'store.json');
const AUTH_PATH = process.env.TEST_AUTH_PATH
  ? path.resolve(process.env.TEST_AUTH_PATH)
  : path.join(DATA_DIR, 'auth.json');
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

const VALID_ROLES = new Set(['admin', 'telemarketing', 'vendedor']);
const VALID_CATEGORIES = new Set(['none', 'cita', 'demo', 'orden']);
const VALID_CALL_OUTCOMES = new Set(['pending', 'scheduled', 'not_scheduled']);
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

const MAX_SECURITY_ALERTS = 300;
const VALID_SECURITY_ALERT_CODES = new Set([
  'duplicate_phone_attempt',
  'same_device_multi_lead',
  'velocity_ip_burst',
  'suspicious_phone_pattern',
  'qr_visit_farming',
  'vendedor_fast_close',
  'vendedor_order_burst',
  'telemarketing_rapid_reposo',
  'telemarketing_rapid_schedule',
  'rbac_unauthorized_attempt',
  'devtools_tamper_attempt',
  'auth_security_event',
  'admin_audit_event',
]);
const VALID_SECURITY_ALERT_SEVERITIES = new Set(['critical', 'high', 'medium', 'info']);
const VALID_SECURITY_ALERT_CATEGORIES = new Set([
  'qr_abuse',
  'vendedor',
  'telemarketing',
  'access',
  'audit',
]);
const VALID_SECURITY_ALERT_STATUSES = new Set(['open', 'reviewed', 'dismissed']);
const VALID_SECURITY_ACTOR_ROLES = new Set([
  'admin',
  'telemarketing',
  'vendedor',
  'public',
  'system',
]);

const MAX_ACTIVITY_LOGS = 500;
const VALID_ACTIVITY_ACTIONS = new Set([
  'lead_created',
  'lead_created_manual',
  'telemarketing_called',
  'lead_status_advanced',
  'lead_status_reverted',
  'lead_updated',
  'lead_deleted',
  'account_created',
  'account_updated',
  'account_deleted',
  'password_changed',
  'qr_created',
  'qr_deleted',
  'referrer_updated',
  'referrer_deleted',
  'embajador_created',
  'embajador_updated',
  'embajador_deleted',
  'gift_changed',
  'settings_updated',
  'security_alert_updated',
  'master_reset',
]);
const VALID_ACTIVITY_CATEGORIES = new Set([
  'leads',
  'telemarketing',
  'status',
  'accounts',
  'qr',
  'catalog',
  'security',
  'system',
]);
const VALID_ACTIVITY_TARGET_TYPES = new Set([
  'lead',
  'account',
  'qr',
  'referrer',
  'gift',
  'settings',
  'security',
  'system',
]);
const CATEGORY_LABELS_ES = {
  none: 'Sin clasificar',
  cita: 'Cita',
  demo: 'Demo',
  orden: 'Orden',
};
const CALL_OUTCOME_LABELS_ES = {
  pending: 'Pendiente',
  scheduled: 'Agendado',
  not_scheduled: 'En Reposo',
};

function formatLeadCategoryLabel(cat) {
  return CATEGORY_LABELS_ES[cat] || 'Sin clasificar';
}

function formatCallOutcomeLabel(outcome) {
  return CALL_OUTCOME_LABELS_ES[outcome] || 'Pendiente';
}

function buildActorFromSession(session, fallbackRole = 'system', fallbackName = 'Sistema') {
  if (!session || typeof session !== 'object') {
    return {
      actorRole: VALID_SECURITY_ACTOR_ROLES.has(fallbackRole) ? fallbackRole : 'system',
      actorId: null,
      actorName: fallbackName,
      actorUsername: null,
      actorTag: null,
    };
  }
  const role = VALID_SECURITY_ACTOR_ROLES.has(session.role)
    ? session.role
    : normalizeUserRole(session.role || fallbackRole);
  return {
    actorRole: role,
    actorId: typeof session.userId === 'string' && session.userId.trim() ? session.userId.trim() : null,
    actorName:
      (typeof session.displayName === 'string' && session.displayName.trim()) ||
      (typeof session.user === 'string' && session.user.trim()) ||
      (typeof session.username === 'string' && session.username.trim()) ||
      fallbackName,
    actorUsername:
      (typeof session.username === 'string' && session.username.trim()) ||
      (typeof session.user === 'string' && session.user.trim()) ||
      null,
    actorTag: typeof session.tag === 'string' && session.tag.trim() ? session.tag.trim() : null,
  };
}

const leadDeviceTracker = new Map();
const leadIpTracker = new Map();
const visitFarmingTracker = new Map();
const vendedorActivityTracker = new Map();
const teleReposoTracker = new Map();
const teleScheduleTracker = new Map();
const alertDedupBuckets = new Map();
const clientTamperRateTracker = new Map();

function resetFraudTrackers() {
  leadDeviceTracker.clear();
  leadIpTracker.clear();
  visitFarmingTracker.clear();
  vendedorActivityTracker.clear();
  teleReposoTracker.clear();
  teleScheduleTracker.clear();
  alertDedupBuckets.clear();
  clientTamperRateTracker.clear();
  attemptBuckets.clear();
}

function normalizePhoneKey(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits;
}

function hashPhoneKey(phoneKey) {
  if (!phoneKey) return '';
  return crypto.createHash('sha256').update(`phone:${phoneKey}`).digest('hex').slice(0, 20);
}

function maskPhone(raw) {
  const digits = normalizePhoneKey(raw);
  if (!digits) return null;
  if (digits.length <= 4) return `***-${digits}`;
  const last4 = digits.slice(-4);
  if (digits.length === 10) return `***-***-${last4}`;
  return `***-${last4}`;
}

function getClientIp(req) {
  if (
    IS_TESTING &&
    typeof req?.headers?.['x-test-ip'] === 'string' &&
    req.headers['x-test-ip'].trim()
  ) {
    return req.headers['x-test-ip'].trim().slice(0, 64);
  }
  const forwarded = req?.headers?.['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  const raw = clientIp || req?.ip || req?.socket?.remoteAddress || 'local';
  return String(raw).replace(/^::ffff:/i, '').trim() || 'local';
}

function isLoopbackIp(ip) {
  const clean = String(ip || '').trim().toLowerCase();
  return (
    !clean ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean === 'local'
  );
}

function maskIp(ip) {
  if (typeof ip !== 'string' || !ip.trim()) return null;
  const clean = ip.trim().replace(/^::ffff:/i, '');
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
    }
  }
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:***`;
    }
  }
  return `${clean.slice(0, 12)}***`;
}

function sanitizeVisitorId(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[^\w.:-]/g, '').slice(0, 96);
  return cleaned || null;
}

function sanitizeSecurityMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (count >= 24) break;
    const key = String(k || '').trim().slice(0, 64);
    if (!key) continue;
    if (v === null) {
      out[key] = null;
      count += 1;
    } else if (typeof v === 'boolean') {
      out[key] = v;
      count += 1;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v;
      count += 1;
    } else if (typeof v === 'string') {
      out[key] = v.trim().slice(0, 200);
      count += 1;
    }
  }
  return out;
}

function normalizeSecurityAlertRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = VALID_SECURITY_ALERT_CODES.has(raw.code) ? raw.code : null;
  if (!code) return null;
  const severity = VALID_SECURITY_ALERT_SEVERITIES.has(raw.severity) ? raw.severity : 'medium';
  const category = VALID_SECURITY_ALERT_CATEGORIES.has(raw.category) ? raw.category : 'qr_abuse';
  const status = VALID_SECURITY_ALERT_STATUSES.has(raw.status) ? raw.status : 'open';
  const actorRole = VALID_SECURITY_ACTOR_ROLES.has(raw.actorRole) ? raw.actorRole : 'system';
  const nowIso = new Date().toISOString();

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('sec'),
    code,
    severity,
    category,
    status,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 180)
        : 'Alerta de seguridad',
    description:
      typeof raw.description === 'string' ? raw.description.trim().slice(0, 600) : '',
    actorRole,
    actorName:
      typeof raw.actorName === 'string' && raw.actorName.trim()
        ? raw.actorName.trim().slice(0, 120)
        : null,
    actorTag:
      typeof raw.actorTag === 'string' && raw.actorTag.trim()
        ? raw.actorTag.trim().slice(0, 40)
        : null,
    leadId:
      typeof raw.leadId === 'string' && raw.leadId.trim() ? raw.leadId.trim().slice(0, 120) : null,
    leadName:
      typeof raw.leadName === 'string' && raw.leadName.trim()
        ? raw.leadName.trim().slice(0, 120)
        : null,
    claimCode:
      typeof raw.claimCode === 'string' && raw.claimCode.trim()
        ? raw.claimCode.trim().slice(0, 40)
        : null,
    phoneMasked:
      typeof raw.phoneMasked === 'string' && raw.phoneMasked.trim()
        ? raw.phoneMasked.trim().slice(0, 40)
        : null,
    referralCode:
      typeof raw.referralCode === 'string' && raw.referralCode.trim()
        ? normalizeReferralCode(raw.referralCode) || raw.referralCode.trim().toUpperCase().slice(0, 32)
        : null,
    ipMasked:
      typeof raw.ipMasked === 'string' && raw.ipMasked.trim()
        ? raw.ipMasked.trim().slice(0, 64)
        : null,
    metadata: sanitizeSecurityMetadata(raw.metadata),
    reviewedBy:
      typeof raw.reviewedBy === 'string' && raw.reviewedBy.trim()
        ? raw.reviewedBy.trim().slice(0, 80)
        : null,
    reviewedAt:
      typeof raw.reviewedAt === 'string' && raw.reviewedAt.trim() ? raw.reviewedAt.trim() : null,
    reviewNote:
      typeof raw.reviewNote === 'string' && raw.reviewNote.trim()
        ? raw.reviewNote.trim().slice(0, 500)
        : null,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt.trim() : nowIso,
  };
}

function normalizeActivityLogRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const action = VALID_ACTIVITY_ACTIONS.has(raw.action) ? raw.action : null;
  if (!action) return null;
  const category = VALID_ACTIVITY_CATEGORIES.has(raw.category) ? raw.category : 'system';
  const actorRole = VALID_SECURITY_ACTOR_ROLES.has(raw.actorRole) ? raw.actorRole : 'system';
  const targetType = VALID_ACTIVITY_TARGET_TYPES.has(raw.targetType) ? raw.targetType : 'system';
  const nowIso = new Date().toISOString();

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('act'),
    action,
    category,
    actorRole,
    actorId:
      typeof raw.actorId === 'string' && raw.actorId.trim()
        ? raw.actorId.trim().slice(0, 120)
        : null,
    actorName:
      typeof raw.actorName === 'string' && raw.actorName.trim()
        ? raw.actorName.trim().slice(0, 120)
        : 'Sistema',
    actorUsername:
      typeof raw.actorUsername === 'string' && raw.actorUsername.trim()
        ? raw.actorUsername.trim().slice(0, 80)
        : null,
    actorTag:
      typeof raw.actorTag === 'string' && raw.actorTag.trim()
        ? raw.actorTag.trim().slice(0, 40)
        : null,
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim().slice(0, 500)
        : action,
    fromState:
      typeof raw.fromState === 'string' && raw.fromState.trim()
        ? raw.fromState.trim().slice(0, 120)
        : null,
    toState:
      typeof raw.toState === 'string' && raw.toState.trim()
        ? raw.toState.trim().slice(0, 120)
        : null,
    targetType,
    targetId:
      typeof raw.targetId === 'string' && raw.targetId.trim()
        ? raw.targetId.trim().slice(0, 120)
        : null,
    targetLabel:
      typeof raw.targetLabel === 'string' && raw.targetLabel.trim()
        ? raw.targetLabel.trim().slice(0, 180)
        : null,
    metadata: sanitizeSecurityMetadata(raw.metadata),
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt.trim() : nowIso,
  };
}

function detectSuspiciousPhonePattern(rawPhone, cleanName, existingLeads = []) {
  const key = normalizePhoneKey(rawPhone);
  if (key.length >= 7) {
    if (/(\d)\1{6,}/.test(key)) {
      return {
        suspicious: true,
        reason: 'repeated_digits',
        detail: 'Número con 7 o más dígitos idénticos consecutivos.',
      };
    }
    if (
      '01234567890123456789'.includes(key) ||
      '98765432109876543210'.includes(key)
    ) {
      return {
        suspicious: true,
        reason: 'sequential_digits',
        detail: 'Número telefónico con secuencia sintética consecutiva.',
      };
    }
  }

  const normalizedName =
    typeof cleanName === 'string' ? cleanName.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  if (normalizedName.length >= 4 && Array.isArray(existingLeads)) {
    const matched = existingLeads.find((lead) => {
      const existingNorm = String(lead?.name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      return (
        existingNorm === normalizedName &&
        normalizePhoneKey(lead?.phone) !== key
      );
    });
    if (matched) {
      return {
        suspicious: true,
        reason: 'duplicate_name_different_phone',
        detail: `Mismo nombre completo registrado previamente con otro número (${matched.claimCode || matched.id}).`,
        matchedLeadId: matched.id,
        matchedClaimCode: matched.claimCode || null,
      };
    }
  }

  return { suspicious: false };
}

function recordSlidingWindowEntry(trackerMap, key, entry, windowMs, nowMs = Date.now()) {
  const cutoff = nowMs - windowMs;
  const existing = trackerMap.get(key) || [];
  const filtered = existing.filter((item) => (typeof item === 'number' ? item : item.ts) >= cutoff);
  filtered.push(entry);
  trackerMap.set(key, filtered);
  return filtered;
}

// Pre-computed salted scrypt digests (never stored in plaintext)
const MASTER_KEY_SALT = '92a9c2523cabb366bdb991d188c9899a';
const MASTER_KEY_HASH =
  '2ddf08eff2d15b8984c21d28d8ea42fb0776e8b103d177b8903886fec0d1da332941b7f6209da57d66bffcaf58c275ea6e49fde43bce7b92526ab0dc556a2d75';
const ADMIN_PASSWORD_CHANGE_PIN_SALT = '5d54a2a16d557f9c8bfbe13bebc84f3e';
const ADMIN_PASSWORD_CHANGE_PIN_HASH =
  '36eb66d6a0c66af25b48707c450075f32934fe044701e6f1f77cd41a6c09e00dc756370ece2c404dc756ab316538cec523294e92737efcbe8733b45b7bbd7704';

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;
const MAX_VISIT_LOG_ENTRIES = 20000;
const MAX_AVATAR_URL_LENGTH = 2048;
const MAX_AVATAR_DATA_URL_LENGTH = 550000;
const AVATAR_DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i;

function sanitizeAvatarUrl(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: 'La foto de perfil debe ser una URL válida o una imagen JPG, PNG o WebP.',
    };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (/^data:/i.test(trimmed)) {
    if (trimmed.length > MAX_AVATAR_DATA_URL_LENGTH) {
      return {
        ok: false,
        error: 'La imagen de perfil es demasiado pesada. Comprímela a menos de 400 KB.',
      };
    }
    const match = trimmed.match(AVATAR_DATA_URL_RE);
    if (!match) {
      return {
        ok: false,
        error:
          'Formato de imagen no permitido. Solo se aceptan imágenes JPG, PNG o WebP (no SVG).',
      };
    }
    const mime = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
    const base64Body = match[2].replace(/[\r\n]+/g, '');
    if (base64Body.length < 16) {
      return {
        ok: false,
        error: 'La imagen de perfil está vacía o dañada.',
      };
    }
    return { ok: true, value: `data:image/${mime};base64,${base64Body}` };
  }

  if (trimmed.length > MAX_AVATAR_URL_LENGTH) {
    return {
      ok: false,
      error: 'El enlace de la foto excede el máximo de 2048 caracteres.',
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        ok: false,
        error: 'El enlace de la foto debe comenzar con https:// o http://.',
      };
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
      return {
        ok: false,
        error: 'Ingresa un enlace de imagen válido sin credenciales incrustadas.',
      };
    }
    return { ok: true, value: trimmed };
  } catch {
    return {
      ok: false,
      error: 'URL de foto inválida. Usa un enlace https:// o sube una imagen JPG, PNG o WebP.',
    };
  }
}

function sanitizeEmojiInput(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: 'El emoji debe ser un texto válido.',
    };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > 16) {
    return {
      ok: false,
      error: 'El emoji del embajador no puede superar 16 caracteres.',
    };
  }
  if (/[\u0000-\u001F\u007F<>"'\\&A-Za-z0-9]/.test(trimmed)) {
    return {
      ok: false,
      error: 'Solo se permiten emojis válidos (sin letras, números ni caracteres especiales).',
    };
  }
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) {
    return {
      ok: false,
      error: 'Ingresa un emoji válido para el embajador.',
    };
  }
  return { ok: true, value: trimmed };
}

const MAX_AUTH_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const attemptBuckets = new Map();

function hashSecret(secret, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return { salt, hash, combined: `scrypt$${salt}$${hash}` };
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

function verifyMasterKey(candidate) {
  return verifySecretConstantTime(
    typeof candidate === 'string' ? candidate : '',
    MASTER_KEY_SALT,
    MASTER_KEY_HASH
  );
}

function verifyAdminPasswordChangePin(candidate) {
  return verifySecretConstantTime(
    typeof candidate === 'string' ? candidate.trim() : '',
    ADMIN_PASSWORD_CHANGE_PIN_SALT,
    ADMIN_PASSWORD_CHANGE_PIN_HASH
  );
}

function normalizeUserRole(rawRole) {
  if (rawRole === 'caller') return 'telemarketing';
  if (VALID_ROLES.has(rawRole)) return rawRole;
  return 'telemarketing';
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
    id: 'default',
    username: 'AdminCiprian',
    displayName: 'Administrador Ciprian',
    role: 'admin',
    tag: 'ADMIN-CIPRIAN',
    active: true,
    passwordSalt: '706828bc554ed47d2bfdea5e1d9bed47',
    passwordHash:
      '28d55fb76c9a7bbb365c8d0f6d46e71da9e624e6ed256c5ed154d6364cfe435a9bf1456d2c8f02ece77d24ccd5ea7a33bff6d234deb71f2cddbf1b5b27b9177d',
    pinSalt: '999139caf854017c17a2375e1dd4a773',
    pinHash:
      '637ec0698dd4b843d8ae6dd8513f95fe8a8f8e15fb013f1e4b6ec89827182a162b7b5ac924a9d0bd872856ce6e2c587336a80dffe866215d0b63fc1be3982e21',
    tokenVersion: 1,
    createdAt: '2026-11-17T00:30:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };

  const telemarketingUser = {
    id: 'telemarketing',
    username: 'Telemarketing',
    displayName: 'Telemarketing',
    role: 'telemarketing',
    tag: 'TELEMARKETING',
    active: true,
    passwordSalt: '8c3924f3c05f778a4b6cfbe5f4885c3b',
    passwordHash:
      '4ccbf1f81acb767eece6110bcd5e8cfff064eb49d18617cd8414b6cda654e0823add072cbf632d82a32abadd37e0dc705ab02e2c17b2ccc05b317e00595eb73c',
    pinSalt: null,
    pinHash: null,
    tokenVersion: 1,
    createdAt: '2026-11-17T00:30:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };

  return {
    username: adminUser.username,
    role: adminUser.role,
    passwordSalt: adminUser.passwordSalt,
    passwordHash: adminUser.passwordHash,
    pinSalt: adminUser.pinSalt,
    pinHash: adminUser.pinHash,
    tokenSecret: '930f2c9f007c19dababc724db5cf85b2f711681ab22dadb364aa0884e05ad15a',
    updatedAt: '2026-11-24T00:00:00.000Z',
    users: [adminUser, telemarketingUser],
  };
}

function normalizeAccountRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rawRole = raw.role || 'admin';
  const isLegacyCaller =
    rawRole === 'caller' ||
    String(raw.id || '').toLowerCase() === 'caller' ||
    String(raw.username || '').trim().toLowerCase() === 'caller';
  const role = normalizeUserRole(rawRole);
  const rawUsername = typeof raw.username === 'string' ? raw.username.trim() : '';
  const username = isLegacyCaller && rawUsername.toLowerCase() === 'caller' ? 'Telemarketing' : rawUsername;
  if (!username || username.toLowerCase() === 'admincripian') return null;

  const id =
    isLegacyCaller && String(raw.id || '').toLowerCase() === 'caller'
      ? 'telemarketing'
      : typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : role === 'admin'
          ? 'default'
          : generateId('usr');
  const displayName =
    typeof raw.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : role === 'admin' && username === 'AdminCiprian'
        ? 'Administrador Ciprian'
        : username;
  const tag =
    normalizeReferralCode(raw.tag) ||
    normalizeReferralCode(username) ||
    (role === 'admin' ? 'ADMIN-CIPRIAN' : 'USER');
  const tokenVersion =
    Number.isInteger(Number(raw.tokenVersion)) && Number(raw.tokenVersion) >= 1
      ? Math.round(Number(raw.tokenVersion))
      : 1;
  const nowIso = new Date().toISOString();

  const avatarCheck = sanitizeAvatarUrl(raw.avatarUrl);
  const avatarUrl = avatarCheck.ok ? avatarCheck.value : null;

  return {
    id,
    username,
    displayName,
    role,
    tag,
    avatarUrl,
    active: raw.active !== false,
    passwordSalt: typeof raw.passwordSalt === 'string' && raw.passwordSalt ? raw.passwordSalt : null,
    passwordHash: typeof raw.passwordHash === 'string' ? raw.passwordHash : '',
    pinSalt: role === 'admin' && typeof raw.pinSalt === 'string' && raw.pinSalt ? raw.pinSalt : null,
    pinHash: role === 'admin' && typeof raw.pinHash === 'string' && raw.pinHash ? raw.pinHash : null,
    tokenVersion,
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : nowIso,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : nowIso,
  };
}

function getUsersList(authStore) {
  if (Array.isArray(authStore?.users) && authStore.users.length > 0) {
    return authStore.users.map(normalizeAccountRecord).filter(Boolean);
  }
  if (authStore?.username) {
    const single = normalizeAccountRecord({
      id: 'default',
      username: authStore.username,
      displayName: authStore.displayName || authStore.username,
      role: authStore.role || 'admin',
      tag: authStore.tag || 'ADMIN-CIPRIAN',
      active: true,
      passwordSalt: authStore.passwordSalt,
      passwordHash: authStore.passwordHash,
      pinSalt: authStore.pinSalt,
      pinHash: authStore.pinHash,
      tokenVersion: authStore.tokenVersion || 1,
      createdAt: authStore.createdAt,
      updatedAt: authStore.updatedAt,
    });
    return single ? [single] : [];
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

  if (!fs.existsSync(AUTH_PATH)) {
    const initialAuth = buildDefaultAuthRecord();
    writeJsonFileSafely(AUTH_PATH, initialAuth);
    return initialAuth;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
    const rawUsers = Array.isArray(parsed?.users) ? parsed.users : [];
    const hadLegacyCaller = rawUsers.some(
      (u) => u?.role === 'caller' || String(u?.username || '').toLowerCase() === 'caller'
    );
    const hasCripian =
      String(parsed.username || '').toLowerCase() === 'admincripian' ||
      rawUsers.some((u) => String(u?.username || '').toLowerCase() === 'admincripian');

    let users = getUsersList(parsed);
    const hasAdmin = users.some((u) => u.role === 'admin');
    const defaults = buildDefaultAuthRecord();

    if (!parsed.tokenSecret || !hasAdmin || hasCripian) {
      const updated = {
        ...defaults,
        tokenSecret: parsed.tokenSecret || defaults.tokenSecret,
      };
      writeJsonFileSafely(AUTH_PATH, updated);
      return updated;
    }

    const needsMigration =
      hadLegacyCaller ||
      rawUsers.some((u) => !u?.id || !u?.tag || !u?.displayName || typeof u?.tokenVersion !== 'number');

    const adminRec = users.find((u) => u.role === 'admin');
    const normalizedStore = {
      ...parsed,
      username: adminRec.username,
      role: 'admin',
      passwordSalt: adminRec.passwordSalt,
      passwordHash: adminRec.passwordHash,
      pinSalt: adminRec.pinSalt,
      pinHash: adminRec.pinHash,
      users,
    };

    if (needsMigration) {
      writeJsonFileSafely(AUTH_PATH, normalizedStore);
    }
    return normalizedStore;
  } catch {
    const reset = buildDefaultAuthRecord();
    writeJsonFileSafely(AUTH_PATH, reset);
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
  const ip = getClientIp(req);
  return `${scope}:${ip}`;
}

function shouldEnforceAuthRateLimit(req) {
  if (!IS_TESTING) return true;
  return Boolean(req?.headers?.['x-test-ip'] || req?.headers?.['x-forwarded-for']);
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

function generateUniqueEmbajadorCode(name, existingCodesSet) {
  const slug = normalizeReferralCode(name) || '';
  const prefixed = slug
    ? slug.startsWith('EMB-')
      ? slug
      : `EMB-${slug}`
    : 'EMB';
  const base = prefixed.slice(0, 26).replace(/-+$/g, '') || 'EMB';
  if (REFERRAL_CODE_RE.test(base) && !existingCodesSet.has(base)) {
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

  const idStr = String(partner.id);
  const memMeta = memoryReferrerMeta.get(idStr) || null;
  const rawPartnerType =
    partner.partnerType !== undefined ? partner.partnerType : memMeta?.partnerType;
  const partnerType = rawPartnerType === 'embajador' ? 'embajador' : 'vendedor';

  const phone = typeof partner.phone === 'string' && partner.phone.trim() ? partner.phone.trim().slice(0, 40) : undefined;
  const notes = typeof partner.notes === 'string' && partner.notes.trim() ? partner.notes.trim().slice(0, 500) : undefined;
  const visitsCount = sanitizeNonNegativeNumber(partner.visitsCount, 0, { integer: true, min: 0, max: 100000000 });
  const uniqueVisitsCount = Math.min(
    visitsCount,
    sanitizeNonNegativeNumber(partner.uniqueVisitsCount, 0, { integer: true, min: 0, max: 100000000 })
  );

  const accountId =
    partnerType === 'embajador'
      ? null
      : typeof partner.accountId === 'string' && partner.accountId.trim()
        ? partner.accountId.trim()
        : null;

  const rawOwnerId =
    partner.ownerVendedorAccountId !== undefined
      ? partner.ownerVendedorAccountId
      : memMeta?.ownerVendedorAccountId;
  const ownerVendedorAccountId =
    typeof rawOwnerId === 'string' && rawOwnerId.trim() ? rawOwnerId.trim().slice(0, 120) : null;

  const rawOwnerName =
    partner.ownerVendedorName !== undefined
      ? partner.ownerVendedorName
      : memMeta?.ownerVendedorName;
  const ownerVendedorName =
    typeof rawOwnerName === 'string' && rawOwnerName.trim() ? rawOwnerName.trim().slice(0, 120) : null;

  const rawOwnerTag =
    partner.ownerVendedorTag !== undefined
      ? partner.ownerVendedorTag
      : memMeta?.ownerVendedorTag;
  const ownerVendedorTag =
    typeof rawOwnerTag === 'string' && rawOwnerTag.trim()
      ? normalizeReferralCode(rawOwnerTag) || rawOwnerTag.trim().toUpperCase().slice(0, 32)
      : null;

  const rawEmoji = partner.emoji !== undefined ? partner.emoji : memMeta?.emoji;
  const emojiCheck = sanitizeEmojiInput(rawEmoji);
  const emoji = emojiCheck.ok ? emojiCheck.value : null;

  const avatarCheck = sanitizeAvatarUrl(partner.avatarUrl);
  const avatarUrl = avatarCheck.ok ? avatarCheck.value : null;

  return {
    id: idStr,
    ...(accountId ? { accountId } : { accountId: null }),
    partnerType,
    ownerVendedorAccountId,
    ownerVendedorName,
    ownerVendedorTag,
    name: name.slice(0, 120),
    code,
    emoji,
    avatarUrl,
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

function normalizeVisitEvent(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const referralCode = normalizeReferralCode(entry.referralCode);
  if (!referralCode) return null;
  const visitedAt =
    typeof entry.visitedAt === 'string' && entry.visitedAt
      ? entry.visitedAt
      : new Date().toISOString();
  return {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateId('visit'),
    referrerId:
      typeof entry.referrerId === 'string' && entry.referrerId.trim() ? entry.referrerId.trim() : null,
    referralCode,
    visitorId:
      typeof entry.visitorId === 'string' && entry.visitorId.trim()
        ? entry.visitorId.trim().slice(0, 128)
        : 'anon',
    visitedAt,
  };
}

function sanitizeQualification(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cleaned = { ...raw };
  if ('cedeGoldenTicket' in raw && raw.cedeGoldenTicket !== undefined) {
    cleaned.cedeGoldenTicket = Boolean(raw.cedeGoldenTicket);
  }
  return cleaned;
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
  const callOutcome = VALID_CALL_OUTCOMES.has(lead.callOutcome)
    ? lead.callOutcome
    : Boolean(lead.called)
      ? 'scheduled'
      : 'pending';
  const called = Boolean(lead.called) || callOutcome !== 'pending';
  const calledAt = called ? lead.calledAt ?? lead.scheduledAt ?? lead.createdAt ?? null : null;
  const calledBy =
    typeof lead.calledBy === 'string' && lead.calledBy.trim() ? lead.calledBy.trim() : null;
  const scheduledAt =
    callOutcome === 'scheduled' ? lead.scheduledAt ?? calledAt ?? lead.createdAt ?? null : null;

  const sellerLocked = Boolean(lead.sellerLocked);
  const sellerConfirmedAt = sellerLocked
    ? lead.sellerConfirmedAt ?? lead.promoCodeInvalidatedAt ?? null
    : null;
  const sellerConfirmedBy =
    sellerLocked && typeof lead.sellerConfirmedBy === 'string' && lead.sellerConfirmedBy.trim()
      ? lead.sellerConfirmedBy.trim()
      : null;

  const promoCodeInvalidated =
    typeof lead.promoCodeInvalidated === 'boolean'
      ? lead.promoCodeInvalidated || category !== 'none' || sellerLocked
      : category !== 'none' || sellerLocked;
  const promoCodeInvalidatedAt = promoCodeInvalidated
    ? lead.promoCodeInvalidatedAt ?? sellerConfirmedAt ?? calledAt ?? lead.createdAt ?? null
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
    called,
    calledAt,
    callOutcome,
    calledBy,
    scheduledAt,
    category,
    qualification: sanitizeQualification(lead.qualification),
    promoCodeInvalidated,
    promoCodeInvalidatedAt,
    sellerLocked,
    sellerConfirmedAt,
    sellerConfirmedBy,
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

async function verifyStoredSecret(plain, storedHash, legacySalt = null) {
  if (typeof plain !== 'string' || !storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    return verifySecretConstantTime(plain, parts[1], parts[2]);
  }
  if (storedHash.startsWith('sha256$')) {
    return verifySha256StoredHash(plain, storedHash);
  }
  if (storedHash.startsWith('$2') && USE_SUPABASE) {
    try {
      const verified = await supabaseRpc('dsb_verify_secret_hash', {
        p_plain: plain,
        p_stored_hash: storedHash,
      });
      return Boolean(verified);
    } catch {
      return false;
    }
  }
  if (legacySalt) {
    return verifySecretConstantTime(plain, legacySalt, storedHash);
  }
  return false;
}

const OVERLAY_PATH = process.env.TEST_OVERLAY_PATH
  ? path.resolve(process.env.TEST_OVERLAY_PATH)
  : path.join(DATA_DIR, 'supabase-overlay.json');
const LEGACY_ACCOUNT_META_PREFIX = 'meta_v1:';

function logServerError(context, err) {
  if (IS_TESTING) return;
  const parts = [`[API ERROR] ${context}`];
  if (err?.status) parts.push(`status=${err.status}`);
  if (err?.code) parts.push(`code=${err.code}`);
  if (err?.message) parts.push(`msg=${String(err.message).slice(0, 300)}`);
  console.error(parts.join(' | '));
}

function isUniqueViolationError(err) {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '23505' ||
    err.status === 409 ||
    msg.includes('duplicate key') ||
    msg.includes('unique constraint')
  );
}

function isNotNullColumnError(err, columnName) {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase();
  if (code !== '23502' && !msg.includes('not-null constraint')) return false;
  return !columnName || msg.includes(String(columnName).toLowerCase());
}

function encodeAccountLegacyMeta(account) {
  if (!account || typeof account !== 'object') return null;
  const payload = {
    d: typeof account.displayName === 'string' ? account.displayName.slice(0, 100) : '',
    t: typeof account.tag === 'string' ? account.tag.slice(0, 32) : '',
    a: account.active !== false,
    v:
      Number.isInteger(Number(account.tokenVersion)) && Number(account.tokenVersion) >= 1
        ? Math.round(Number(account.tokenVersion))
        : 1,
    c: typeof account.createdAt === 'string' && account.createdAt ? account.createdAt : undefined,
  };
  return `${LEGACY_ACCOUNT_META_PREFIX}${JSON.stringify(payload)}`;
}

function decodeAccountLegacyMeta(raw) {
  if (typeof raw !== 'string' || !raw.startsWith(LEGACY_ACCOUNT_META_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(LEGACY_ACCOUNT_META_PREFIX.length));
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      displayName: typeof parsed.d === 'string' && parsed.d.trim() ? parsed.d.trim() : undefined,
      tag: typeof parsed.t === 'string' && parsed.t.trim() ? parsed.t.trim() : undefined,
      active: typeof parsed.a === 'boolean' ? parsed.a : undefined,
      tokenVersion:
        Number.isInteger(Number(parsed.v)) && Number(parsed.v) >= 1
          ? Math.round(Number(parsed.v))
          : undefined,
      createdAt: typeof parsed.c === 'string' && parsed.c ? parsed.c : undefined,
    };
  } catch {
    return null;
  }
}

function mapAuthAccountRow(row) {
  if (!row || typeof row !== 'object') return null;
  const legacyMeta = decodeAccountLegacyMeta(row.pre_auth_token);
  const rawId = typeof row.id === 'string' ? row.id.trim() : '';
  const isLegacyCallerId = rawId.toLowerCase() === 'caller';
  const lookupId = isLegacyCallerId ? 'telemarketing' : rawId;
  const memMeta =
    memoryAccountMeta.get(lookupId) ||
    (rawId && rawId !== lookupId ? memoryAccountMeta.get(rawId) : null) ||
    null;

  const rawAvatar =
    row.avatar_url !== undefined
      ? row.avatar_url
      : row.avatarUrl !== undefined
        ? row.avatarUrl
        : memMeta?.avatarUrl !== undefined
          ? memMeta.avatarUrl
          : memoryAccountAvatars.get(lookupId) ??
            (rawId ? memoryAccountAvatars.get(rawId) : null) ??
            null;

  const resolvedDisplayName =
    (typeof row.display_name === 'string' && row.display_name.trim()) ||
    (typeof row.displayName === 'string' && row.displayName.trim()) ||
    memMeta?.displayName ||
    legacyMeta?.displayName ||
    '';

  const resolvedTag =
    (typeof row.tag === 'string' && row.tag.trim()) ||
    memMeta?.tag ||
    legacyMeta?.tag ||
    '';

  const resolvedActive =
    typeof row.active === 'boolean'
      ? row.active
      : typeof memMeta?.active === 'boolean'
        ? memMeta.active
        : typeof legacyMeta?.active === 'boolean'
          ? legacyMeta.active
          : true;

  const resolvedTokenVersion =
    row.token_version !== undefined && row.token_version !== null
      ? row.token_version
      : memMeta?.tokenVersion ?? legacyMeta?.tokenVersion ?? 1;

  const resolvedCreatedAt =
    row.created_at || memMeta?.createdAt || legacyMeta?.createdAt || row.updated_at;

  const normalized = normalizeAccountRecord({
    id: row.id,
    username: row.username,
    displayName: resolvedDisplayName,
    role: row.role || 'admin',
    tag: resolvedTag,
    avatarUrl: rawAvatar,
    active: resolvedActive,
    passwordSalt: null,
    passwordHash: row.password_hash || '',
    pinSalt: null,
    pinHash: row.pin_hash || null,
    tokenVersion: resolvedTokenVersion,
    createdAt: resolvedCreatedAt,
    updatedAt: row.updated_at || resolvedCreatedAt,
  });

  if (normalized && rawId && normalized.id !== rawId) {
    memoryAccountDbIds.set(normalized.id, rawId);
  }
  return normalized;
}

let dsbAuthUsesStarSelect = false;

async function fetchAllAuthAccounts() {
  if (USE_SUPABASE) {
    try {
      let rows;
      if (dsbAuthUsesStarSelect) {
        rows = await supabaseRest('dsb_auth?select=*');
      } else {
        try {
          rows = await supabaseRest(
            'dsb_auth?select=id,username,display_name,role,tag,avatar_url,active,password_hash,pin_hash,token_version,created_at,updated_at&order=created_at.asc'
          );
        } catch (err) {
          if (!isMissingColumnError(err)) throw err;
          dsbAuthUsesStarSelect = true;
          rows = await supabaseRest('dsb_auth?select=*');
        }
      }
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped = rows.map(mapAuthAccountRow).filter(Boolean);
        mapped.sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        });
        return mapped;
      }
    } catch (err) {
      logServerError('fetchAllAuthAccounts', err);
      // Fallback to local auth store if Supabase auth table is unreachable
    }
  }
  return getUsersList(ensureAuthStore());
}

async function findAuthAccountByUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const clean = username.trim().toLowerCase();
  if (!clean || clean === 'admincripian') return null;
  const accounts = await fetchAllAuthAccounts();
  return accounts.find((a) => a.username.toLowerCase() === clean) || null;
}

async function findAuthAccountById(id) {
  if (!id || typeof id !== 'string') return null;
  const clean = id.trim();
  if (!clean) return null;
  const accounts = await fetchAllAuthAccounts();
  return accounts.find((a) => a.id === clean) || null;
}

function sanitizeAccountForClient(account, referrers = []) {
  const linkedRef = Array.isArray(referrers)
    ? referrers.find(
        (r) =>
          r.partnerType !== 'embajador' &&
          (r.accountId === account.id || r.code === account.tag)
      ) || null
    : null;
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    tag: account.tag,
    avatarUrl: account.avatarUrl ?? linkedRef?.avatarUrl ?? null,
    active: Boolean(account.active),
    hasPin: Boolean(account.pinHash),
    tokenVersion: account.tokenVersion || 1,
    referrerId: linkedRef ? linkedRef.id : null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

const DSB_AUTH_META_COLUMNS = ['display_name', 'tag', 'active', 'token_version', 'created_at'];

function dsbAuthNeedsLegacyMetaFallback(strippedCols = []) {
  const known = knownMissingColumnsByTable.get('dsb_auth');
  if (known && DSB_AUTH_META_COLUMNS.some((c) => known.has(c))) return true;
  return strippedCols.some((c) => DSB_AUTH_META_COLUMNS.includes(c));
}

function cacheAccountMetadata(account) {
  memoryAccountAvatars.set(account.id, account.avatarUrl ?? null);
  memoryAccountMeta.set(account.id, {
    displayName: account.displayName,
    tag: account.tag,
    avatarUrl: account.avatarUrl ?? null,
    active: Boolean(account.active),
    tokenVersion: account.tokenVersion || 1,
    createdAt: account.createdAt,
  });
  saveSupabaseOverlay();
}

async function persistNewAuthAccount(account, restExecutor = supabaseRest) {
  if (USE_SUPABASE || restExecutor !== supabaseRest) {
    cacheAccountMetadata(account);
    const dbPasswordHash = account.passwordHash.includes('$')
      ? account.passwordHash
      : account.passwordSalt
        ? `scrypt$${account.passwordSalt}$${account.passwordHash}`
        : account.passwordHash;
    // Empty string '' satisfies legacy dsb_auth schemas where pin_hash is NOT NULL,
    // while normalizeAccountRecord and dsb_verify_secret_hash treat '' identically to null (no PIN).
    const dbPinHash =
      account.role === 'admin' && account.pinHash
        ? account.pinHash.includes('$')
          ? account.pinHash
          : account.pinSalt
            ? `scrypt$${account.pinSalt}$${account.pinHash}`
            : account.pinHash
        : '';

    const payload = {
      id: account.id,
      username: account.username,
      display_name: account.displayName,
      role: account.role,
      tag: account.tag,
      avatar_url: account.avatarUrl ?? null,
      active: account.active,
      password_hash: dbPasswordHash,
      pin_hash: dbPinHash,
      master_hash: '',
      token_version: account.tokenVersion || 1,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
    };

    const optionalCols = [
      'display_name',
      'tag',
      'avatar_url',
      'active',
      'token_version',
      'created_at',
      'master_hash',
      'pre_auth_token',
    ];
    if (dsbAuthNeedsLegacyMetaFallback()) {
      payload.pre_auth_token = encodeAccountLegacyMeta(account);
    }

    const strippedOnWrite = [];
    await supabaseWriteWithOptionalColumns(
      'dsb_auth',
      'POST',
      { Prefer: 'return=minimal' },
      payload,
      optionalCols,
      restExecutor,
      {
        onStripped: (cols) => strippedOnWrite.push(...cols),
      }
    );

    if (!payload.pre_auth_token && dsbAuthNeedsLegacyMetaFallback(strippedOnWrite)) {
      await supabaseWriteWithOptionalColumns(
        `dsb_auth?id=eq.${encodeURIComponent(account.id)}`,
        'PATCH',
        { Prefer: 'return=minimal' },
        { pre_auth_token: encodeAccountLegacyMeta(account) },
        ['pre_auth_token'],
        restExecutor
      ).catch(() => {});
    }
    return;
  }

  const auth = ensureAuthStore();
  const users = getUsersList(auth);
  users.push(account);
  auth.users = users;
  auth.updatedAt = account.updatedAt;
  writeAuthStore(auth);
}

async function persistUpdatedAuthAccount(account, restExecutor = supabaseRest) {
  if (USE_SUPABASE || restExecutor !== supabaseRest) {
    cacheAccountMetadata(account);
    const dbId = memoryAccountDbIds.get(account.id) || account.id;
    const dbPasswordHash = account.passwordHash.includes('$')
      ? account.passwordHash
      : account.passwordSalt
        ? `scrypt$${account.passwordSalt}$${account.passwordHash}`
        : account.passwordHash;
    const dbPinHash =
      account.role === 'admin' && account.pinHash
        ? account.pinHash.includes('$')
          ? account.pinHash
          : account.pinSalt
            ? `scrypt$${account.pinSalt}$${account.pinHash}`
            : account.pinHash
        : '';

    const payload = {
      username: account.username,
      display_name: account.displayName,
      role: account.role,
      tag: account.tag,
      avatar_url: account.avatarUrl ?? null,
      active: account.active,
      password_hash: dbPasswordHash,
      pin_hash: dbPinHash,
      token_version: account.tokenVersion || 1,
      updated_at: account.updatedAt,
    };

    const optionalCols = [
      'display_name',
      'tag',
      'avatar_url',
      'active',
      'token_version',
      'pre_auth_token',
    ];
    if (dsbAuthNeedsLegacyMetaFallback()) {
      payload.pre_auth_token = encodeAccountLegacyMeta(account);
    }

    const strippedOnWrite = [];
    await supabaseWriteWithOptionalColumns(
      `dsb_auth?id=eq.${encodeURIComponent(dbId)}`,
      'PATCH',
      { Prefer: 'return=minimal' },
      payload,
      optionalCols,
      restExecutor,
      {
        onStripped: (cols) => strippedOnWrite.push(...cols),
      }
    );

    if (!payload.pre_auth_token && dsbAuthNeedsLegacyMetaFallback(strippedOnWrite)) {
      await supabaseWriteWithOptionalColumns(
        `dsb_auth?id=eq.${encodeURIComponent(dbId)}`,
        'PATCH',
        { Prefer: 'return=minimal' },
        { pre_auth_token: encodeAccountLegacyMeta(account) },
        ['pre_auth_token'],
        restExecutor
      ).catch(() => {});
    }
    return;
  }

  const auth = ensureAuthStore();
  const users = getUsersList(auth);
  const idx = users.findIndex((u) => u.id === account.id);
  if (idx !== -1) {
    users[idx] = account;
  } else {
    users.push(account);
  }
  auth.users = users;
  if (account.role === 'admin' && account.id === 'default') {
    auth.username = account.username;
    auth.passwordSalt = account.passwordSalt;
    auth.passwordHash = account.passwordHash;
    auth.pinSalt = account.pinSalt;
    auth.pinHash = account.pinHash;
  }
  auth.updatedAt = account.updatedAt;
  writeAuthStore(auth);
}

async function persistDeletedAuthAccount(accountId, restExecutor = supabaseRest) {
  if (USE_SUPABASE || restExecutor !== supabaseRest) {
    const dbId = memoryAccountDbIds.get(accountId) || accountId;
    await restExecutor(`dsb_auth?id=eq.${encodeURIComponent(dbId)}`, { method: 'DELETE' });
    memoryAccountDbIds.delete(accountId);
    memoryAccountMeta.delete(accountId);
    memoryAccountAvatars.delete(accountId);
    saveSupabaseOverlay();
    return;
  }
  const auth = ensureAuthStore();
  auth.users = getUsersList(auth).filter((u) => u.id !== accountId);
  auth.updatedAt = new Date().toISOString();
  writeAuthStore(auth);
}

function verifyLocalAdminPassword(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  const auth = ensureAuthStore();
  const users = getUsersList(auth);
  const admins = users.filter((u) => u.role === 'admin' && u.active !== false);
  for (const admin of admins) {
    if (admin.passwordHash?.startsWith('scrypt$')) {
      const parts = admin.passwordHash.split('$');
      if (parts.length === 3 && verifySecretConstantTime(candidate, parts[1], parts[2])) return true;
    } else if (admin.passwordSalt && admin.passwordHash) {
      if (verifySecretConstantTime(candidate, admin.passwordSalt, admin.passwordHash)) return true;
    }
  }
  return false;
}

async function verifyAdminPassword(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  if (!IS_TESTING && USE_SUPABASE) {
    const accounts = await fetchAllAuthAccounts();
    const admins = accounts.filter((a) => a.role === 'admin' && a.active !== false);
    for (const admin of admins) {
      if (await verifyStoredSecret(candidate, admin.passwordHash, admin.passwordSalt)) {
        return true;
      }
    }
    try {
      const verified = await supabaseRpc('dsb_verify_admin_password', { p_password: candidate });
      if (typeof verified === 'boolean') return verified;
    } catch {
      // Fall through to local check
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
        visitLog: Array.isArray(parsed.visitLog)
          ? parsed.visitLog.map(normalizeVisitEvent).filter(Boolean)
          : [],
        securityAlerts: Array.isArray(parsed.securityAlerts)
          ? parsed.securityAlerts
              .map(normalizeSecurityAlertRecord)
              .filter(Boolean)
              .slice(0, MAX_SECURITY_ALERTS)
          : [],
        activityLogs: Array.isArray(parsed.activityLogs)
          ? parsed.activityLogs
              .map(normalizeActivityLogRecord)
              .filter(Boolean)
              .slice(0, MAX_ACTIVITY_LOGS)
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
  if (!fs.existsSync(STORE_PATH)) {
    const initial = readDefaultStore();
    writeJsonFileSafely(STORE_PATH, initial);
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
      visitLog: Array.isArray(parsed.visitLog)
        ? parsed.visitLog.map(normalizeVisitEvent).filter(Boolean)
        : defaults.visitLog || [],
      securityAlerts: Array.isArray(parsed.securityAlerts)
        ? parsed.securityAlerts
            .map(normalizeSecurityAlertRecord)
            .filter(Boolean)
            .slice(0, MAX_SECURITY_ALERTS)
        : defaults.securityAlerts || [],
      activityLogs: Array.isArray(parsed.activityLogs)
        ? parsed.activityLogs
            .map(normalizeActivityLogRecord)
            .filter(Boolean)
            .slice(0, MAX_ACTIVITY_LOGS)
        : defaults.activityLogs || [],
    };
  } catch {
    const initial = readDefaultStore();
    writeJsonFileSafely(STORE_PATH, initial);
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

function isMissingReferralVisitsTableError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  return (
    err.status === 404 ||
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('42p01') ||
    (msg.includes('referral_visits') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not found')))
  );
}

function isMissingSecurityAlertsTableError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  return (
    err.status === 404 ||
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('42p01') ||
    (msg.includes('security_alerts') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not found')))
  );
}

function isMissingActivityLogsTableError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  return (
    err.status === 404 ||
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('42p01') ||
    (msg.includes('activity_logs') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not found')))
  );
}

let memoryQrFallback = null;
let memoryReferrersFallback = null;
let memoryVisitLogFallback = null;
let memorySecurityAlertsFallback = null;
let securityAlertsTableMissing = false;
let memoryActivityLogsFallback = null;
let activityLogsTableMissing = false;
const memoryGiftUsageTips = new Map();
const memoryGiftProbabilities = new Map();
const memoryLeadPromoStates = new Map();
const memoryLeadWorkflowStates = new Map();
const memoryAccountAvatars = new Map();
const memoryAccountMeta = new Map();
const memoryAccountDbIds = new Map();
const memoryReferrerAvatars = new Map();
const memoryReferrerAccountIds = new Map();
const memoryReferrerMeta = new Map();
const memoryQrAccountIds = new Map();
const memorySettingsFallback = {};
const knownMissingColumnsByTable = new Map();

function cacheReferrerMeta(partner) {
  if (!partner || !partner.id) return;
  memoryReferrerAvatars.set(partner.id, partner.avatarUrl ?? null);
  if (partner.accountId && partner.partnerType !== 'embajador') {
    memoryReferrerAccountIds.set(partner.id, partner.accountId);
  } else {
    memoryReferrerAccountIds.delete(partner.id);
  }
  memoryReferrerMeta.set(partner.id, {
    partnerType: partner.partnerType === 'embajador' ? 'embajador' : 'vendedor',
    ownerVendedorAccountId: partner.ownerVendedorAccountId ?? null,
    ownerVendedorName: partner.ownerVendedorName ?? null,
    ownerVendedorTag: partner.ownerVendedorTag ?? null,
    emoji: partner.emoji ?? null,
  });
  saveSupabaseOverlay();
}

function loadSupabaseOverlay() {
  if (!USE_SUPABASE || IS_VERCEL || IS_TESTING) return;
  if (!fs.existsSync(OVERLAY_PATH)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(OVERLAY_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object') return;
    if (raw.accounts && typeof raw.accounts === 'object') {
      for (const [id, meta] of Object.entries(raw.accounts)) {
        if (!id || !meta || typeof meta !== 'object') continue;
        memoryAccountMeta.set(id, meta);
        if (meta.avatarUrl !== undefined) {
          memoryAccountAvatars.set(id, meta.avatarUrl ?? null);
        }
      }
    }
    if (raw.referrers && typeof raw.referrers === 'object') {
      for (const [id, meta] of Object.entries(raw.referrers)) {
        if (!id || !meta || typeof meta !== 'object') continue;
        if (meta.accountId) memoryReferrerAccountIds.set(id, String(meta.accountId));
        if (meta.avatarUrl !== undefined) memoryReferrerAvatars.set(id, meta.avatarUrl ?? null);
        if (
          meta.partnerType !== undefined ||
          meta.ownerVendedorAccountId !== undefined ||
          meta.ownerVendedorName !== undefined ||
          meta.ownerVendedorTag !== undefined ||
          meta.emoji !== undefined
        ) {
          memoryReferrerMeta.set(id, {
            partnerType: meta.partnerType === 'embajador' ? 'embajador' : 'vendedor',
            ownerVendedorAccountId: meta.ownerVendedorAccountId ?? null,
            ownerVendedorName: meta.ownerVendedorName ?? null,
            ownerVendedorTag: meta.ownerVendedorTag ?? null,
            emoji: meta.emoji ?? null,
          });
        }
      }
    }
    if (raw.qrAccountIds && typeof raw.qrAccountIds === 'object') {
      for (const [id, accId] of Object.entries(raw.qrAccountIds)) {
        if (id && accId) memoryQrAccountIds.set(id, String(accId));
      }
    }
    if (raw.leadPromo && typeof raw.leadPromo === 'object') {
      for (const [id, state] of Object.entries(raw.leadPromo)) {
        if (id && state && typeof state === 'object') memoryLeadPromoStates.set(id, state);
      }
    }
    if (raw.leadWorkflow && typeof raw.leadWorkflow === 'object') {
      for (const [id, state] of Object.entries(raw.leadWorkflow)) {
        if (id && state && typeof state === 'object') memoryLeadWorkflowStates.set(id, state);
      }
    }
    if (raw.giftProbabilities && typeof raw.giftProbabilities === 'object') {
      for (const [id, prob] of Object.entries(raw.giftProbabilities)) {
        if (id && typeof prob === 'number' && Number.isFinite(prob)) {
          memoryGiftProbabilities.set(id, prob);
        }
      }
    }
    if (raw.giftUsageTips && typeof raw.giftUsageTips === 'object') {
      for (const [id, tip] of Object.entries(raw.giftUsageTips)) {
        if (id && typeof tip === 'string') memoryGiftUsageTips.set(id, tip);
      }
    }
    if (raw.settings && typeof raw.settings === 'object') {
      Object.assign(memorySettingsFallback, raw.settings);
    }
    if (Array.isArray(raw.securityAlerts)) {
      memorySecurityAlertsFallback = raw.securityAlerts
        .map(normalizeSecurityAlertRecord)
        .filter(Boolean)
        .slice(0, MAX_SECURITY_ALERTS);
    }
    if (Array.isArray(raw.activityLogs)) {
      memoryActivityLogsFallback = raw.activityLogs
        .map(normalizeActivityLogRecord)
        .filter(Boolean)
        .slice(0, MAX_ACTIVITY_LOGS);
    }
  } catch {
    // Ignore malformed overlay file
  }
}

function saveSupabaseOverlay() {
  if (!USE_SUPABASE || IS_VERCEL || IS_TESTING) return;
  const referrersObj = {};
  const allRefIds = new Set([
    ...memoryReferrerAccountIds.keys(),
    ...memoryReferrerAvatars.keys(),
    ...memoryReferrerMeta.keys(),
  ]);
  for (const id of allRefIds) {
    const extra = memoryReferrerMeta.get(id) || {};
    referrersObj[id] = {
      accountId: memoryReferrerAccountIds.get(id) ?? null,
      avatarUrl: memoryReferrerAvatars.has(id) ? memoryReferrerAvatars.get(id) : undefined,
      ...(extra.partnerType !== undefined ? { partnerType: extra.partnerType } : {}),
      ...(extra.ownerVendedorAccountId !== undefined
        ? { ownerVendedorAccountId: extra.ownerVendedorAccountId }
        : {}),
      ...(extra.ownerVendedorName !== undefined
        ? { ownerVendedorName: extra.ownerVendedorName }
        : {}),
      ...(extra.ownerVendedorTag !== undefined ? { ownerVendedorTag: extra.ownerVendedorTag } : {}),
      ...(extra.emoji !== undefined ? { emoji: extra.emoji } : {}),
    };
  }
  const overlay = {
    accounts: Object.fromEntries(memoryAccountMeta.entries()),
    referrers: referrersObj,
    qrAccountIds: Object.fromEntries(memoryQrAccountIds.entries()),
    leadPromo: Object.fromEntries(memoryLeadPromoStates.entries()),
    leadWorkflow: Object.fromEntries(memoryLeadWorkflowStates.entries()),
    giftProbabilities: Object.fromEntries(memoryGiftProbabilities.entries()),
    giftUsageTips: Object.fromEntries(memoryGiftUsageTips.entries()),
    settings: { ...memorySettingsFallback },
    securityAlerts: Array.isArray(memorySecurityAlertsFallback)
      ? memorySecurityAlertsFallback.slice(0, MAX_SECURITY_ALERTS)
      : [],
    activityLogs: Array.isArray(memoryActivityLogsFallback)
      ? memoryActivityLogsFallback.slice(0, MAX_ACTIVITY_LOGS)
      : [],
    updatedAt: new Date().toISOString(),
  };
  writeJsonFileSafely(OVERLAY_PATH, overlay);
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchMissingColumnNames(err, candidateColumns = []) {
  if (!err || candidateColumns.length === 0) return [];
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase();
  const exactMatches = candidateColumns.filter((col) => {
    const lc = String(col).toLowerCase();
    const quotedSingle = `'${lc}'`;
    const quotedDouble = `"${lc}"`;
    if (msg.includes(quotedSingle) || msg.includes(quotedDouble)) return true;
    return new RegExp(`(^|[^a-z0-9_])${escapeRegExp(lc)}([^a-z0-9_]|$)`).test(msg);
  });
  if (exactMatches.length > 0) return exactMatches;
  return candidateColumns.filter((col) => msg.includes(String(col).toLowerCase()));
}

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
  return matchMissingColumnNames(err, columnNames).length > 0;
}

async function supabaseWriteWithOptionalColumns(
  restPath,
  method,
  headers,
  payload,
  optionalColumns,
  restExecutor = supabaseRest,
  options = {}
) {
  const useTableCache = restExecutor === supabaseRest;
  const tableName = String(restPath || '').split('?')[0].trim();
  const stripRow = (row, colsToStrip) => {
    const copy = { ...row };
    for (const col of colsToStrip) {
      delete copy[col];
    }
    return copy;
  };

  const stripped = new Set();
  if (useTableCache && tableName) {
    const cachedMissing = knownMissingColumnsByTable.get(tableName);
    if (cachedMissing && cachedMissing.size > 0) {
      for (const col of optionalColumns) {
        if (cachedMissing.has(col)) stripped.add(col);
      }
    }
  }

  let currentPayload =
    stripped.size > 0
      ? Array.isArray(payload)
        ? payload.map((row) => stripRow(row, stripped))
        : stripRow(payload, stripped)
      : payload;

  if (stripped.size > 0 && typeof options?.onStripped === 'function') {
    options.onStripped([...stripped]);
  }

  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    if (
      method === 'PATCH' &&
      !Array.isArray(currentPayload) &&
      currentPayload &&
      typeof currentPayload === 'object' &&
      Object.keys(currentPayload).length === 0
    ) {
      return null;
    }

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
      const matched = matchMissingColumnNames(err, remaining);
      const toDrop = matched.length > 0 ? matched : remaining;
      for (const col of toDrop) {
        stripped.add(col);
      }
      if (useTableCache && tableName) {
        let cached = knownMissingColumnsByTable.get(tableName);
        if (!cached) {
          cached = new Set();
          knownMissingColumnsByTable.set(tableName, cached);
        }
        for (const col of toDrop) {
          cached.add(col);
        }
      }
      if (typeof options?.onStripped === 'function') {
        options.onStripped(toDrop);
      }
      currentPayload = Array.isArray(currentPayload)
        ? currentPayload.map((row) => stripRow(row, stripped))
        : stripRow(currentPayload, stripped);
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

function getFallbackVisitLog() {
  if (Array.isArray(memoryVisitLogFallback)) {
    return memoryVisitLogFallback;
  }
  if (!IS_VERCEL) {
    const local = ensureStore();
    memoryVisitLogFallback = Array.isArray(local.visitLog)
      ? local.visitLog.map(normalizeVisitEvent).filter(Boolean)
      : [];
    return memoryVisitLogFallback;
  }
  memoryVisitLogFallback = [];
  return memoryVisitLogFallback;
}

function saveFallbackVisitLog(nextVisits) {
  const normalized = Array.isArray(nextVisits)
    ? nextVisits.map(normalizeVisitEvent).filter(Boolean).slice(0, MAX_VISIT_LOG_ENTRIES)
    : [];
  memoryVisitLogFallback = normalized;
  if (!IS_VERCEL) {
    const local = ensureStore();
    local.visitLog = normalized;
    writeStore(local);
  }
  return normalized;
}

function getFallbackSecurityAlerts() {
  if (Array.isArray(memorySecurityAlertsFallback)) {
    return memorySecurityAlertsFallback;
  }
  if (!IS_VERCEL && !USE_SUPABASE) {
    const local = ensureStore();
    memorySecurityAlertsFallback = Array.isArray(local.securityAlerts)
      ? local.securityAlerts
          .map(normalizeSecurityAlertRecord)
          .filter(Boolean)
          .slice(0, MAX_SECURITY_ALERTS)
      : [];
    return memorySecurityAlertsFallback;
  }
  memorySecurityAlertsFallback = [];
  return memorySecurityAlertsFallback;
}

function saveFallbackSecurityAlerts(nextAlerts) {
  const normalized = Array.isArray(nextAlerts)
    ? nextAlerts
        .map(normalizeSecurityAlertRecord)
        .filter(Boolean)
        .slice(0, MAX_SECURITY_ALERTS)
    : [];
  memorySecurityAlertsFallback = normalized;
  if (USE_SUPABASE) {
    saveSupabaseOverlay();
  } else if (!IS_VERCEL) {
    const local = ensureStore();
    local.securityAlerts = normalized;
    writeStore(local);
  }
  return normalized;
}

function mapSecurityAlertRow(row) {
  if (!row || typeof row !== 'object') return null;
  return normalizeSecurityAlertRecord({
    id: row.id,
    code: row.code,
    severity: row.severity,
    category: row.category,
    status: row.status,
    title: row.title,
    description: row.description,
    actorRole: row.actor_role ?? row.actorRole,
    actorName: row.actor_name ?? row.actorName ?? null,
    actorTag: row.actor_tag ?? row.actorTag ?? null,
    leadId: row.lead_id ?? row.leadId ?? null,
    leadName: row.lead_name ?? row.leadName ?? null,
    claimCode: row.claim_code ?? row.claimCode ?? null,
    phoneMasked: row.phone_masked ?? row.phoneMasked ?? null,
    referralCode: row.referral_code ?? row.referralCode ?? null,
    ipMasked: row.ip_masked ?? row.ipMasked ?? null,
    metadata: row.metadata ?? {},
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? null,
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? null,
    reviewNote: row.review_note ?? row.reviewNote ?? null,
    createdAt: row.created_at ?? row.createdAt,
  });
}

function toSecurityAlertDbRow(alert) {
  return {
    id: alert.id,
    code: alert.code,
    severity: alert.severity,
    category: alert.category,
    status: alert.status,
    title: alert.title,
    description: alert.description,
    actor_role: alert.actorRole || 'system',
    actor_name: alert.actorName ?? null,
    actor_tag: alert.actorTag ?? null,
    lead_id: alert.leadId ?? null,
    lead_name: alert.leadName ?? null,
    claim_code: alert.claimCode ?? null,
    phone_masked: alert.phoneMasked ?? null,
    referral_code: alert.referralCode ?? null,
    ip_masked: alert.ipMasked ?? null,
    metadata: alert.metadata || {},
    reviewed_by: alert.reviewedBy ?? null,
    reviewed_at: alert.reviewedAt ?? null,
    review_note: alert.reviewNote ?? null,
    created_at: alert.createdAt,
  };
}

async function recordSecurityAlert(input, options = {}) {
  try {
    const nowMs = Date.now();
    if (options.dedupKey && options.dedupWindowMs > 0) {
      const prevTs = alertDedupBuckets.get(options.dedupKey);
      if (typeof prevTs === 'number' && nowMs - prevTs < options.dedupWindowMs) {
        return null;
      }
      alertDedupBuckets.set(options.dedupKey, nowMs);
      if (alertDedupBuckets.size > 1000) {
        const oldestKey = alertDedupBuckets.keys().next().value;
        if (oldestKey !== undefined) alertDedupBuckets.delete(oldestKey);
      }
    }

    const alert = normalizeSecurityAlertRecord({
      ...input,
      id: generateId('sec'),
      status: 'open',
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: new Date(nowMs).toISOString(),
    });
    if (!alert) return null;

    if (USE_SUPABASE) {
      const currentFallback = getFallbackSecurityAlerts();
      saveFallbackSecurityAlerts([alert, ...currentFallback]);
      if (!securityAlertsTableMissing) {
        try {
          await supabaseRest('security_alerts', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(toSecurityAlertDbRow(alert)),
          });
        } catch (err) {
          if (isMissingSecurityAlertsTableError(err)) {
            securityAlertsTableMissing = true;
          } else {
            logServerError('recordSecurityAlert', err);
          }
        }
      }
      return alert;
    }

    if (options.store && typeof options.store === 'object') {
      const prev = Array.isArray(options.store.securityAlerts) ? options.store.securityAlerts : [];
      options.store.securityAlerts = [alert, ...prev].slice(0, MAX_SECURITY_ALERTS);
      writeStore(options.store);
      return alert;
    }

    const local = ensureStore();
    const prev = Array.isArray(local.securityAlerts) ? local.securityAlerts : [];
    local.securityAlerts = [alert, ...prev].slice(0, MAX_SECURITY_ALERTS);
    writeStore(local);
    return alert;
  } catch (err) {
    logServerError('recordSecurityAlert', err);
    return null;
  }
}

function getFallbackActivityLogs() {
  if (Array.isArray(memoryActivityLogsFallback)) {
    return memoryActivityLogsFallback;
  }
  if (!IS_VERCEL && !USE_SUPABASE) {
    const local = ensureStore();
    memoryActivityLogsFallback = Array.isArray(local.activityLogs)
      ? local.activityLogs
          .map(normalizeActivityLogRecord)
          .filter(Boolean)
          .slice(0, MAX_ACTIVITY_LOGS)
      : [];
    return memoryActivityLogsFallback;
  }
  memoryActivityLogsFallback = [];
  return memoryActivityLogsFallback;
}

function saveFallbackActivityLogs(nextLogs) {
  const normalized = Array.isArray(nextLogs)
    ? nextLogs
        .map(normalizeActivityLogRecord)
        .filter(Boolean)
        .slice(0, MAX_ACTIVITY_LOGS)
    : [];
  memoryActivityLogsFallback = normalized;
  if (USE_SUPABASE) {
    saveSupabaseOverlay();
  } else if (!IS_VERCEL) {
    const local = ensureStore();
    local.activityLogs = normalized;
    writeStore(local);
  }
  return normalized;
}

function mapActivityLogRow(row) {
  if (!row || typeof row !== 'object') return null;
  return normalizeActivityLogRecord({
    id: row.id,
    action: row.action,
    category: row.category,
    actorRole: row.actor_role ?? row.actorRole,
    actorId: row.actor_id ?? row.actorId ?? null,
    actorName: row.actor_name ?? row.actorName,
    actorUsername: row.actor_username ?? row.actorUsername ?? null,
    actorTag: row.actor_tag ?? row.actorTag ?? null,
    summary: row.summary,
    fromState: row.from_state ?? row.fromState ?? null,
    toState: row.to_state ?? row.toState ?? null,
    targetType: row.target_type ?? row.targetType,
    targetId: row.target_id ?? row.targetId ?? null,
    targetLabel: row.target_label ?? row.targetLabel ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at ?? row.createdAt,
  });
}

function toActivityLogDbRow(entry) {
  return {
    id: entry.id,
    action: entry.action,
    category: entry.category || 'system',
    actor_role: entry.actorRole || 'system',
    actor_id: entry.actorId ?? null,
    actor_name: entry.actorName || 'Sistema',
    actor_username: entry.actorUsername ?? null,
    actor_tag: entry.actorTag ?? null,
    summary: entry.summary || entry.action,
    from_state: entry.fromState ?? null,
    to_state: entry.toState ?? null,
    target_type: entry.targetType || 'system',
    target_id: entry.targetId ?? null,
    target_label: entry.targetLabel ?? null,
    metadata: entry.metadata || {},
    created_at: entry.createdAt,
  };
}

function getActiveActivityLogs(store) {
  if (store && Array.isArray(store.activityLogs)) {
    return store.activityLogs
      .map(normalizeActivityLogRecord)
      .filter(Boolean)
      .slice(0, MAX_ACTIVITY_LOGS);
  }
  return getFallbackActivityLogs();
}

async function recordActivityLog(input, options = {}) {
  try {
    const entry = normalizeActivityLogRecord({
      ...input,
      id: generateId('act'),
      createdAt: new Date().toISOString(),
    });
    if (!entry) return null;

    if (USE_SUPABASE) {
      const currentFallback = getFallbackActivityLogs();
      saveFallbackActivityLogs([entry, ...currentFallback]);
      if (!activityLogsTableMissing) {
        try {
          await supabaseRest('activity_logs', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(toActivityLogDbRow(entry)),
          });
        } catch (err) {
          if (isMissingActivityLogsTableError(err)) {
            activityLogsTableMissing = true;
          } else {
            logServerError('recordActivityLog', err);
          }
        }
      }
      return entry;
    }

    if (options.store && typeof options.store === 'object') {
      const prev = Array.isArray(options.store.activityLogs) ? options.store.activityLogs : [];
      options.store.activityLogs = [entry, ...prev].slice(0, MAX_ACTIVITY_LOGS);
      writeStore(options.store);
      return entry;
    }

    const local = ensureStore();
    const prev = Array.isArray(local.activityLogs) ? local.activityLogs : [];
    local.activityLogs = [entry, ...prev].slice(0, MAX_ACTIVITY_LOGS);
    writeStore(local);
    return entry;
  } catch (err) {
    logServerError('recordActivityLog', err);
    return null;
  }
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
  const memWorkflow = memoryLeadWorkflowStates.get(row.id);

  const hasColOutcome = typeof row.call_outcome === 'string' && VALID_CALL_OUTCOMES.has(row.call_outcome);
  const callOutcome = hasColOutcome
    ? row.call_outcome
    : memWorkflow?.callOutcome && VALID_CALL_OUTCOMES.has(memWorkflow.callOutcome)
      ? memWorkflow.callOutcome
      : Boolean(row.called)
        ? 'scheduled'
        : 'pending';
  const called = Boolean(row.called) || callOutcome !== 'pending';
  const calledAt = called ? row.called_at ?? memWorkflow?.calledAt ?? row.created_at ?? null : null;
  const calledBy =
    typeof row.called_by === 'string' && row.called_by.trim()
      ? row.called_by.trim()
      : memWorkflow?.calledBy ?? null;
  const scheduledAt =
    callOutcome === 'scheduled'
      ? row.scheduled_at ?? memWorkflow?.scheduledAt ?? calledAt ?? row.created_at ?? null
      : null;

  const hasColSellerLocked = typeof row.seller_locked === 'boolean';
  const sellerLocked = hasColSellerLocked
    ? row.seller_locked
    : Boolean(memWorkflow?.sellerLocked);
  const sellerConfirmedAt = sellerLocked
    ? row.seller_confirmed_at ?? memWorkflow?.sellerConfirmedAt ?? row.promo_code_invalidated_at ?? null
    : null;
  const sellerConfirmedBy = sellerLocked
    ? (typeof row.seller_confirmed_by === 'string' && row.seller_confirmed_by.trim()
        ? row.seller_confirmed_by.trim()
        : memWorkflow?.sellerConfirmedBy ?? null)
    : null;

  const hasColInvalidated = typeof row.promo_code_invalidated === 'boolean';
  const promoCodeInvalidated = hasColInvalidated
    ? row.promo_code_invalidated || category !== 'none' || sellerLocked
    : memPromo !== undefined
      ? Boolean(memPromo.promoCodeInvalidated) || category !== 'none' || sellerLocked
      : Boolean((category && category !== 'none') || sellerLocked);
  const promoCodeInvalidatedAt = promoCodeInvalidated
    ? row.promo_code_invalidated_at ??
      (memPromo ? memPromo.promoCodeInvalidatedAt : null) ??
      sellerConfirmedAt ??
      (category !== 'none' ? calledAt ?? row.created_at ?? null : null)
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
    called,
    calledAt,
    callOutcome,
    calledBy,
    scheduledAt,
    category,
    orderAmount:
      row.order_amount !== null && row.order_amount !== undefined ? Number(row.order_amount) : null,
    notes: row.notes || '',
    qualification: sanitizeQualification(row.qualification),
    promoCodeInvalidated,
    promoCodeInvalidatedAt,
    sellerLocked,
    sellerConfirmedAt,
    sellerConfirmedBy,
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
    accountId:
      typeof row.account_id === 'string' && row.account_id.trim()
        ? row.account_id.trim()
        : memoryQrAccountIds.get(row.id) ?? null,
    createdAt: row.created_at,
  };
}

function mapReferrerRow(row) {
  if (!row || typeof row !== 'object') return null;
  const memMeta = memoryReferrerMeta.get(row.id) || null;
  const rawAvatar =
    row.avatar_url !== undefined
      ? row.avatar_url
      : row.avatarUrl !== undefined
        ? row.avatarUrl
        : memoryReferrerAvatars.get(row.id) ?? null;
  const rawAccountId =
    row.account_id !== undefined
      ? row.account_id
      : row.accountId !== undefined
        ? row.accountId
        : memoryReferrerAccountIds.get(row.id) ?? null;
  const rawPartnerType =
    row.partner_type !== undefined
      ? row.partner_type
      : row.partnerType !== undefined
        ? row.partnerType
        : memMeta?.partnerType;
  const rawOwnerId =
    row.owner_vendedor_account_id !== undefined
      ? row.owner_vendedor_account_id
      : row.ownerVendedorAccountId !== undefined
        ? row.ownerVendedorAccountId
        : memMeta?.ownerVendedorAccountId ?? null;
  const rawOwnerName =
    row.owner_vendedor_name !== undefined
      ? row.owner_vendedor_name
      : row.ownerVendedorName !== undefined
        ? row.ownerVendedorName
        : memMeta?.ownerVendedorName ?? null;
  const rawOwnerTag =
    row.owner_vendedor_tag !== undefined
      ? row.owner_vendedor_tag
      : row.ownerVendedorTag !== undefined
        ? row.ownerVendedorTag
        : memMeta?.ownerVendedorTag ?? null;
  const rawEmoji =
    row.emoji !== undefined ? row.emoji : memMeta?.emoji ?? null;

  return normalizeReferrerRecord({
    id: row.id,
    accountId: rawAccountId,
    partnerType: rawPartnerType,
    ownerVendedorAccountId: rawOwnerId,
    ownerVendedorName: rawOwnerName,
    ownerVendedorTag: rawOwnerTag,
    name: row.name,
    code: row.code,
    emoji: rawEmoji,
    avatarUrl: rawAvatar,
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

function mapVisitRow(row) {
  if (!row || typeof row !== 'object') return null;
  return normalizeVisitEvent({
    id: row.id,
    referrerId: row.referrer_id ?? null,
    referralCode: row.referral_code,
    visitorId: row.visitor_id ?? 'anon',
    visitedAt: row.visited_at,
  });
}

async function fetchSupabaseStore() {
  const defaults = readDefaultStore();
  let qrTableMissing = false;
  let referrersTableMissing = false;
  let visitsTableMissing = false;
  let localAlertsTableMissing = securityAlertsTableMissing;
  let localActivityTableMissing = activityLogsTableMissing;
  const [settingsRows, giftRows, leadRows, qrRows, referrerRows, visitRows, alertRows, activityRows] = await Promise.all([
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
    supabaseRest('referral_visits?order=visited_at.desc&limit=10000').catch((err) => {
      if (isMissingReferralVisitsTableError(err)) {
        visitsTableMissing = true;
      }
      return [];
    }),
    securityAlertsTableMissing
      ? Promise.resolve([])
      : supabaseRest(`security_alerts?order=created_at.desc&limit=${MAX_SECURITY_ALERTS}`).catch((err) => {
          if (isMissingSecurityAlertsTableError(err)) {
            securityAlertsTableMissing = true;
            localAlertsTableMissing = true;
          }
          return [];
        }),
    activityLogsTableMissing
      ? Promise.resolve([])
      : supabaseRest(`activity_logs?order=created_at.desc&limit=${MAX_ACTIVITY_LOGS}`).catch((err) => {
          if (isMissingActivityLogsTableError(err)) {
            activityLogsTableMissing = true;
            localActivityTableMissing = true;
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
    visitLog: visitsTableMissing
      ? getFallbackVisitLog()
      : Array.isArray(visitRows)
        ? visitRows.map(mapVisitRow).filter(Boolean)
        : [],
    securityAlerts: localAlertsTableMissing
      ? getFallbackSecurityAlerts()
      : Array.isArray(alertRows)
        ? alertRows.map(mapSecurityAlertRow).filter(Boolean).slice(0, MAX_SECURITY_ALERTS)
        : [],
    activityLogs: localActivityTableMissing
      ? getFallbackActivityLogs()
      : Array.isArray(activityRows)
        ? activityRows.map(mapActivityLogRow).filter(Boolean).slice(0, MAX_ACTIVITY_LOGS)
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

async function getAuthenticatedSession(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const auth = ensureAuthStore();
  const payload = verifyToken(token, getSigningSecret(auth), 'dsb_session');
  if (!payload) return null;

  const accounts = await fetchAllAuthAccounts();
  const account =
    (payload.userId && accounts.find((a) => a.id === payload.userId)) ||
    (payload.user && accounts.find((a) => a.username.toLowerCase() === String(payload.user).toLowerCase())) ||
    null;

  if (!account || !account.active) {
    return null;
  }

  const tokenVer = typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 1;
  if (tokenVer !== (account.tokenVersion || 1)) {
    return null;
  }

  return {
    userId: account.id,
    user: account.username,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    tag: account.tag,
    avatarUrl: account.avatarUrl ?? null,
    tokenVersion: account.tokenVersion || 1,
  };
}

async function requireDsbAuth(req, res, next) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión en el panel.' });
    }
    req.dsbSession = session;
    return next();
  } catch {
    return res.status(503).json({ error: 'No se pudo verificar la sesión actual.' });
  }
}

async function requireAdminRole(req, res, next) {
  try {
    const session = req.dsbSession || (await getAuthenticatedSession(req));
    if (!session) {
      return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión en el panel administrativo.' });
    }
    if (session.role !== 'admin') {
      await recordSecurityAlert({
        code: 'rbac_unauthorized_attempt',
        severity: 'high',
        category: 'access',
        title: 'Intento de acceso no autorizado a ruta administrativa',
        description: `${session.displayName || session.user} (${session.role}) intentó acceder a ${req.method} ${req.originalUrl || req.path} sin permisos de administrador.`,
        actorRole: session.role,
        actorName: session.displayName || session.user,
        actorTag: session.tag || null,
        ipMasked: maskIp(getClientIp(req)),
        metadata: {
          method: req.method,
          path: String(req.originalUrl || req.path || '').slice(0, 160),
          reason: 'admin_route_denied',
        },
      });
      return res.status(403).json({ error: 'Acceso denegado. Permisos administrativos requeridos.' });
    }
    req.dsbSession = session;
    return next();
  } catch {
    return res.status(503).json({ error: 'No se pudo verificar los permisos administrativos.' });
  }
}

async function verifyMasterPasswordForMutation(req, res) {
  const bucketKey = getBucketKey(req, 'master');
  const enforceRateLimit = shouldEnforceAuthRateLimit(req);
  const clientIp = getClientIp(req);
  if (enforceRateLimit) {
    const status = checkRateLimit(bucketKey);
    if (status.locked) {
      await recordSecurityAlert(
        {
          code: 'auth_security_event',
          severity: 'critical',
          category: 'access',
          title: 'Llave maestra bloqueada por intentos fallidos',
          description: `Se rechazó un intento con llave maestra bloqueada en ${req.method} ${req.originalUrl || req.path} (${status.retryAfterSeconds}s restantes).`,
          actorRole: req.dsbSession?.role || 'admin',
          actorName: req.dsbSession?.displayName || req.dsbSession?.user || null,
          actorTag: req.dsbSession?.tag || null,
          ipMasked: maskIp(clientIp),
          metadata: {
            scope: 'master_key',
            locked: true,
            retryAfterSeconds: status.retryAfterSeconds,
            path: String(req.originalUrl || req.path || '').slice(0, 120),
          },
        },
        { dedupKey: `auth_lock:master:${clientIp}`, dedupWindowMs: 60 * 1000 }
      );
      res.status(429).json({
        error: `Autorización maestra bloqueada temporalmente (${status.retryAfterSeconds}s).`,
        locked: true,
        retryAfterSeconds: status.retryAfterSeconds,
      });
      return false;
    }
  }

  const candidate =
    typeof req.body?.masterPassword === 'string'
      ? req.body.masterPassword
      : typeof req.headers['x-master-password'] === 'string'
        ? req.headers['x-master-password']
        : '';

  if (!verifyMasterKey(candidate)) {
    if (!enforceRateLimit) {
      res.status(403).json({
        error: 'Llave maestra inválida o requerida para realizar esta operación.',
        remainingAttempts: 4,
      });
      return false;
    }
    const fail = recordFailedAttempt(bucketKey);
    if (fail.locked || fail.count >= 3) {
      await recordSecurityAlert({
        code: 'auth_security_event',
        severity: 'critical',
        category: 'access',
        title: fail.locked
          ? 'Bloqueo de seguridad por intentos fallidos de llave maestra'
          : `Múltiples intentos fallidos de llave maestra (${fail.count})`,
        description: fail.locked
          ? `Se superó el límite de ${MAX_AUTH_ATTEMPTS} intentos de llave maestra desde ${maskIp(clientIp) || 'IP desconocida'}. Acceso bloqueado por 15 minutos.`
          : `Se registraron ${fail.count} intentos consecutivos fallidos de llave maestra en ${req.method} ${req.originalUrl || req.path}.`,
        actorRole: req.dsbSession?.role || 'admin',
        actorName: req.dsbSession?.displayName || req.dsbSession?.user || null,
        actorTag: req.dsbSession?.tag || null,
        ipMasked: maskIp(clientIp),
        metadata: {
          scope: 'master_key',
          failedAttempts: fail.count,
          locked: Boolean(fail.locked),
          path: String(req.originalUrl || req.path || '').slice(0, 120),
        },
      });
    }
    if (!IS_TESTING) {
      await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 300)));
    }
    res.status(fail.locked ? 429 : 403).json({
      error: fail.locked
        ? 'Llave maestra inválida. Bloqueo preventivo activado por 15 minutos.'
        : `Llave maestra inválida. Intentos restantes: ${fail.remainingAttempts}.`,
      locked: fail.locked,
      retryAfterSeconds: fail.retryAfterSeconds,
      remainingAttempts: fail.remainingAttempts,
    });
    return false;
  }

  if (enforceRateLimit) clearAttempts(bucketKey);
  return true;
}

async function verifyCurrentAdminPasswordForMutation(req, res, candidateOverride) {
  const bucketKey = getBucketKey(req, 'admin_action');
  const enforceRateLimit = shouldEnforceAuthRateLimit(req);
  const clientIp = getClientIp(req);
  if (enforceRateLimit) {
    const status = checkRateLimit(bucketKey);
    if (status.locked) {
      await recordSecurityAlert(
        {
          code: 'auth_security_event',
          severity: 'critical',
          category: 'access',
          title: 'Contraseña de administrador bloqueada por intentos fallidos',
          description: `Se rechazó un intento administrativo bloqueado en ${req.method} ${req.originalUrl || req.path} (${status.retryAfterSeconds}s restantes).`,
          actorRole: req.dsbSession?.role || 'admin',
          actorName: req.dsbSession?.displayName || req.dsbSession?.user || null,
          actorTag: req.dsbSession?.tag || null,
          ipMasked: maskIp(clientIp),
          metadata: {
            scope: 'admin_action',
            locked: true,
            retryAfterSeconds: status.retryAfterSeconds,
            path: String(req.originalUrl || req.path || '').slice(0, 120),
          },
        },
        { dedupKey: `auth_lock:admin_action:${clientIp}`, dedupWindowMs: 60 * 1000 }
      );
      res.status(429).json({
        error: `Autorización administrativa bloqueada temporalmente (${status.retryAfterSeconds}s).`,
        locked: true,
        retryAfterSeconds: status.retryAfterSeconds,
        remainingAttempts: 0,
      });
      return false;
    }
  }

  let accounts;
  try {
    accounts = await fetchAllAuthAccounts();
  } catch (err) {
    logServerError('verifyCurrentAdminPasswordForMutation', err);
    res.status(503).json({
      error: 'No se pudo verificar la contraseña de administrador.',
    });
    return false;
  }

  const session = req.dsbSession;
  const sessionUsername = session?.username || session?.user || '';
  const currentAdmin =
    (session?.userId && accounts.find((a) => a.id === session.userId)) ||
    (sessionUsername &&
      accounts.find((a) => a.username.toLowerCase() === String(sessionUsername).toLowerCase())) ||
    null;

  if (!currentAdmin || !currentAdmin.active || currentAdmin.role !== 'admin') {
    res.status(401).json({
      error: 'Tu sesión de administrador no es válida o fue desactivada. Vuelve a iniciar sesión.',
      locked: false,
      retryAfterSeconds: 0,
    });
    return false;
  }

  const candidate =
    candidateOverride !== undefined
      ? typeof candidateOverride === 'string'
        ? candidateOverride
        : ''
      : typeof req.body?.adminPassword === 'string' && req.body.adminPassword.length > 0
        ? req.body.adminPassword
        : typeof req.body?.masterPassword === 'string' && req.body.masterPassword.length > 0
          ? req.body.masterPassword
          : typeof req.headers['x-admin-password'] === 'string' && req.headers['x-admin-password'].length > 0
            ? req.headers['x-admin-password']
            : typeof req.headers['x-master-password'] === 'string' && req.headers['x-master-password'].length > 0
              ? req.headers['x-master-password']
              : '';

  const matches =
    candidate.length > 0 &&
    (await verifyStoredSecret(candidate, currentAdmin.passwordHash, currentAdmin.passwordSalt));

  if (!matches) {
    if (!enforceRateLimit) {
      res.status(401).json({
        error: 'Contraseña de administrador incorrecta. Ingresa la contraseña de tu cuenta actual.',
        locked: false,
        retryAfterSeconds: 0,
        remainingAttempts: 4,
      });
      return false;
    }
    const fail = recordFailedAttempt(bucketKey);
    if (fail.locked || fail.count >= 3) {
      await recordSecurityAlert({
        code: 'auth_security_event',
        severity: 'critical',
        category: 'access',
        title: fail.locked
          ? 'Bloqueo de seguridad por intentos fallidos de contraseña de administrador'
          : `Múltiples intentos fallidos de contraseña de administrador (${fail.count})`,
        description: fail.locked
          ? `Se superó el límite de ${MAX_AUTH_ATTEMPTS} intentos de contraseña administrativa para ${currentAdmin.username} desde ${maskIp(clientIp) || 'IP desconocida'}. Acceso bloqueado por 15 minutos.`
          : `Se registraron ${fail.count} intentos consecutivos fallidos de contraseña administrativa para ${currentAdmin.username} en ${req.method} ${req.originalUrl || req.path}.`,
        actorRole: 'admin',
        actorName: currentAdmin.displayName || currentAdmin.username,
        actorTag: currentAdmin.tag || null,
        ipMasked: maskIp(clientIp),
        metadata: {
          scope: 'admin_action',
          username: currentAdmin.username,
          failedAttempts: fail.count,
          locked: Boolean(fail.locked),
          path: String(req.originalUrl || req.path || '').slice(0, 120),
        },
      });
    }
    if (!IS_TESTING) {
      await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 300)));
    }
    res.status(fail.locked ? 429 : 401).json({
      error: fail.locked
        ? 'Contraseña de administrador incorrecta. Bloqueo preventivo activado por 15 minutos.'
        : `Contraseña de administrador incorrecta. Ingresa la contraseña de tu cuenta actual. Intentos restantes: ${fail.remainingAttempts}.`,
      locked: fail.locked,
      retryAfterSeconds: fail.retryAfterSeconds,
      remainingAttempts: fail.remainingAttempts,
    });
    return false;
  }

  if (enforceRateLimit) clearAttempts(bucketKey);
  return true;
}

async function verifyAnyAdminPassword(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  return verifyAdminPassword(candidate);
}

function filterVisibleAccountsForAdmin(accounts, session) {
  if (!Array.isArray(accounts)) return [];
  const selfUserId = session && session.userId ? String(session.userId) : '';
  return accounts.filter(
    (a) => a && (a.role !== 'admin' || (selfUserId && String(a.id) === selfUserId))
  );
}

function getOwnedEmbajadoresForVendedor(session, allReferrers = []) {
  if (!session?.userId || !Array.isArray(allReferrers)) return [];
  return allReferrers.filter(
    (r) => r && r.partnerType === 'embajador' && r.ownerVendedorAccountId === session.userId
  );
}

function leadBelongsToVendedor(lead, session, linkedReferrer, allReferrers = []) {
  if (!lead || !session) return false;
  const sessionTag = normalizeReferralCode(session.tag);
  const leadCode = normalizeReferralCode(lead.referralCode);
  if (sessionTag && leadCode && leadCode === sessionTag) return true;
  if (linkedReferrer && lead.referrerId && lead.referrerId === linkedReferrer.id) return true;
  const ownedEmbajadores = getOwnedEmbajadoresForVendedor(session, allReferrers);
  for (const emb of ownedEmbajadores) {
    if (lead.referrerId && lead.referrerId === emb.id) return true;
    if (leadCode && emb.code && leadCode === emb.code) return true;
  }
  return false;
}

function sanitizeStateForClient(store, sessionOrAuthed, roleArg, accounts = []) {
  const session =
    sessionOrAuthed && typeof sessionOrAuthed === 'object'
      ? sessionOrAuthed
      : sessionOrAuthed === true
        ? { role: roleArg || 'admin' }
        : null;
  const isAuthed = Boolean(session);
  const role = session ? normalizeUserRole(session.role || roleArg || 'admin') : null;

  const normalizedGifts = Array.isArray(store.gifts)
    ? store.gifts.map((g) => normalizeGiftRecord(g, DEFAULT_GIFT_PROBABILITY))
    : [];
  const normalizedReferrers = Array.isArray(store.referrers)
    ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
    : [];
  const normalizedLeads = Array.isArray(store.leads)
    ? store.leads.map(normalizeLeadRecord)
    : [];
  const normalizedVisitLog = Array.isArray(store.visitLog)
    ? store.visitLog.map(normalizeVisitEvent).filter(Boolean)
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
      accounts: [],
      visitLog: [],
    };
  }

  if (role === 'telemarketing') {
    const pendingLeads = normalizedLeads
      .filter((l) => l.callOutcome === 'pending')
      .map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        address: l.address || '',
        claimCode: l.claimCode,
        referralCode: l.referralCode ?? null,
        referrerId: l.referrerId ?? null,
        referrerName: l.referrerName ?? null,
        createdAt: l.createdAt,
        giftName: l.giftName ?? null,
        callOutcome: l.callOutcome,
      }));
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
      leads: pendingLeads,
      qrHistory: [],
      referrers: normalizedReferrers.map((r) => ({
        id: r.id,
        accountId: r.accountId ?? null,
        partnerType: r.partnerType || 'vendedor',
        ownerVendedorAccountId: r.ownerVendedorAccountId ?? null,
        ownerVendedorName: r.ownerVendedorName ?? null,
        ownerVendedorTag: r.ownerVendedorTag ?? null,
        name: r.name,
        code: r.code,
        emoji: r.emoji ?? null,
        avatarUrl: r.avatarUrl ?? null,
        active: Boolean(r.active),
        visitsCount: 0,
        uniqueVisitsCount: 0,
        lastVisitAt: null,
        createdAt: r.createdAt,
      })),
      accounts: [],
      visitLog: [],
      role: 'telemarketing',
    };
  }

  if (role === 'vendedor') {
    const sessionTag = normalizeReferralCode(session.tag);
    const linkedReferrer =
      normalizedReferrers.find(
        (r) =>
          r.partnerType !== 'embajador' &&
          ((session.userId && r.accountId === session.userId) || (sessionTag && r.code === sessionTag))
      ) || null;
    const ownedEmbajadores = getOwnedEmbajadoresForVendedor(session, normalizedReferrers);
    const ownedEmbajadorIds = new Set(ownedEmbajadores.map((e) => e.id));
    const ownedEmbajadorCodes = new Set(ownedEmbajadores.map((e) => e.code));
    const vendedorReferrers = linkedReferrer
      ? [linkedReferrer, ...ownedEmbajadores.filter((e) => e.id !== linkedReferrer.id)]
      : ownedEmbajadores;

    const ownLeads = normalizedLeads.filter((l) =>
      leadBelongsToVendedor(l, session, linkedReferrer, normalizedReferrers)
    );
    const ownQrs = (Array.isArray(store.qrHistory) ? store.qrHistory : []).filter((qr) => {
      const qrCodeNorm = normalizeReferralCode(qr.referralCode);
      return (
        (session.userId && qr.accountId === session.userId) ||
        (linkedReferrer && qr.referrerId === linkedReferrer.id) ||
        (sessionTag && qrCodeNorm === sessionTag) ||
        (qr.referrerId && ownedEmbajadorIds.has(qr.referrerId)) ||
        (qrCodeNorm && ownedEmbajadorCodes.has(qrCodeNorm))
      );
    });
    const ownVisits = normalizedVisitLog.filter(
      (v) =>
        (linkedReferrer && v.referrerId === linkedReferrer.id) ||
        (sessionTag && v.referralCode === sessionTag) ||
        (v.referrerId && ownedEmbajadorIds.has(v.referrerId)) ||
        (v.referralCode && ownedEmbajadorCodes.has(v.referralCode))
    );

    return {
      settings: {
        advisorName: store.settings.advisorName,
        hostTitle: store.settings.hostTitle,
        brandSubtitle: store.settings.brandSubtitle,
        defaultTicketAmount: Number(store.settings.defaultTicketAmount ?? 2792),
        requirePin: false,
        pinCode: '',
        referralPrizeRule,
      },
      gifts: normalizedGifts.filter((g) => g.active),
      leads: ownLeads,
      qrHistory: ownQrs,
      referrers: vendedorReferrers,
      accounts: [],
      visitLog: ownVisits,
      role: 'vendedor',
    };
  }

  return {
    settings: {
      ...store.settings,
      randomizeGifts: defaultRandomize,
      referralPrizeRule,
      pinCode: '',
    },
    gifts: normalizedGifts,
    leads: normalizedLeads,
    qrHistory: Array.isArray(store.qrHistory) ? store.qrHistory : [],
    referrers: normalizedReferrers,
    accounts: filterVisibleAccountsForAdmin(accounts, session).map((a) =>
      sanitizeAccountForClient(a, normalizedReferrers)
    ),
    visitLog: normalizedVisitLog,
    securityAlerts: Array.isArray(store.securityAlerts)
      ? store.securityAlerts
          .map(normalizeSecurityAlertRecord)
          .filter(Boolean)
          .slice(0, MAX_SECURITY_ALERTS)
      : [],
    activityLogs: getActiveActivityLogs(store),
    role: 'admin',
  };
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: ws: wss:",
  "worker-src 'self' blob:",
].join('; ');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Defensive HTTP security headers (applied at the very top of Express)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  next();
});

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

app.use('/api', (_req, res, next) => {
  applyNoStoreHeaders(res);
  next();
});

// Initialize local stores when not in read-only Vercel serverless
ensureStore();
ensureAuthStore();
loadSupabaseOverlay();

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    storage: USE_SUPABASE ? 'supabase' : 'local',
    timestamp: new Date().toISOString(),
  });
});

const REFERRER_OPTIONAL_COLUMNS = [
  'account_id',
  'avatar_url',
  'partner_type',
  'owner_vendedor_account_id',
  'owner_vendedor_name',
  'owner_vendedor_tag',
  'emoji',
];

async function syncVendedorReferrer(store, account, { mode = 'upsert', previousTag = null } = {}) {
  const existing = Array.isArray(store.referrers) ? [...store.referrers] : [];
  const matchIdx = existing.findIndex(
    (r) =>
      r.partnerType !== 'embajador' &&
      (r.accountId === account.id ||
        (previousTag && r.code === previousTag) ||
        r.code === account.tag)
  );

  if (mode === 'deactivate') {
    if (matchIdx === -1) return null;
    const updated = {
      ...existing[matchIdx],
      accountId: null,
      active: false,
    };
    if (USE_SUPABASE) {
      cacheReferrerMeta(updated);
      try {
        await supabaseWriteWithOptionalColumns(
          `referrers?id=eq.${encodeURIComponent(updated.id)}`,
          'PATCH',
          { Prefer: 'return=minimal' },
          {
            active: false,
            account_id: null,
          },
          REFERRER_OPTIONAL_COLUMNS
        );
      } catch (err) {
        if (!isMissingReferrersTableError(err)) throw err;
        const fb = getFallbackReferrers();
        const fbIdx = fb.findIndex((r) => r.id === updated.id);
        if (fbIdx !== -1) {
          fb[fbIdx] = updated;
          saveFallbackReferrers(fb);
        }
      }
    } else {
      existing[matchIdx] = updated;
      store.referrers = existing;
      writeStore(store);
    }
    return updated;
  }

  if (account.role !== 'vendedor') return null;

  const nowIso = new Date().toISOString();
  if (matchIdx !== -1) {
    const current = existing[matchIdx];
    const updated = normalizeReferrerRecord({
      ...current,
      accountId: account.id,
      partnerType: 'vendedor',
      name: account.displayName.slice(0, 120),
      code: account.tag,
      avatarUrl: account.avatarUrl !== undefined ? account.avatarUrl : current.avatarUrl ?? null,
      active: Boolean(account.active),
    });
    if (current.code !== updated.code) {
      renameReferralVisitorBucket(current.code, updated.code);
    }
    if (USE_SUPABASE) {
      cacheReferrerMeta(updated);
      try {
        await supabaseWriteWithOptionalColumns(
          `referrers?id=eq.${encodeURIComponent(updated.id)}`,
          'PATCH',
          { Prefer: 'return=minimal' },
          {
            account_id: updated.accountId,
            partner_type: 'vendedor',
            name: updated.name,
            code: updated.code,
            avatar_url: updated.avatarUrl ?? null,
            active: updated.active,
          },
          REFERRER_OPTIONAL_COLUMNS
        );
      } catch (err) {
        if (!isMissingReferrersTableError(err)) throw err;
        const fb = getFallbackReferrers();
        const fbIdx = fb.findIndex((r) => r.id === updated.id);
        if (fbIdx !== -1) {
          fb[fbIdx] = updated;
          saveFallbackReferrers(fb);
        }
      }
    } else {
      existing[matchIdx] = updated;
      store.referrers = existing;
      writeStore(store);
    }
    return updated;
  }

  const created = normalizeReferrerRecord({
    id: generateId('ref'),
    accountId: account.id,
    partnerType: 'vendedor',
    ownerVendedorAccountId: null,
    ownerVendedorName: null,
    ownerVendedorTag: null,
    name: account.displayName.slice(0, 120),
    code: account.tag,
    emoji: null,
    avatarUrl: account.avatarUrl ?? null,
    active: Boolean(account.active),
    visitsCount: 0,
    uniqueVisitsCount: 0,
    lastVisitAt: null,
    qrStyleId: 'classic-gold',
    createdAt: nowIso,
  });

  if (USE_SUPABASE) {
    cacheReferrerMeta(created);
    try {
      await supabaseWriteWithOptionalColumns(
        'referrers',
        'POST',
        { Prefer: 'return=minimal' },
        {
          id: created.id,
          account_id: created.accountId,
          partner_type: 'vendedor',
          owner_vendedor_account_id: null,
          owner_vendedor_name: null,
          owner_vendedor_tag: null,
          name: created.name,
          code: created.code,
          emoji: null,
          avatar_url: created.avatarUrl ?? null,
          phone: null,
          notes: null,
          active: created.active,
          visits_count: 0,
          unique_visits_count: 0,
          last_visit_at: null,
          qr_style_id: created.qrStyleId,
          created_at: created.createdAt,
        },
        REFERRER_OPTIONAL_COLUMNS
      );
    } catch (err) {
      if (!isMissingReferrersTableError(err)) throw err;
      saveFallbackReferrers([created, ...getFallbackReferrers()]);
    }
  } else {
    store.referrers = [created, ...existing];
    writeStore(store);
  }
  return created;
}

// Filter 1: Username + Password authentication (1FA for telemarketing/vendedor, 2FA for admin)
app.post('/api/auth/login', async (req, res) => {
  const enforceRateLimit = shouldEnforceAuthRateLimit(req);
  const bucketKey = getBucketKey(req, 'login');
  const clientIp = getClientIp(req);
  if (enforceRateLimit) {
    const status = checkRateLimit(bucketKey);
    if (status.locked) {
      await recordSecurityAlert(
        {
          code: 'auth_security_event',
          severity: 'critical',
          category: 'access',
          title: 'Inicio de sesión bloqueado por fuerza bruta',
          description: `Intento de acceso rechazado mientras la IP ${maskIp(clientIp) || 'desconocida'} permanece bloqueada (${status.retryAfterSeconds}s restantes).`,
          actorRole: 'public',
          actorName: typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 60) || null : null,
          ipMasked: maskIp(clientIp),
          metadata: {
            scope: 'login',
            locked: true,
            retryAfterSeconds: status.retryAfterSeconds,
          },
        },
        { dedupKey: `auth_lock:login:${clientIp}`, dedupWindowMs: 60 * 1000 }
      );
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

  const logLoginFailureAlert = async (fail, targetAccount = null) => {
    if (!enforceRateLimit || (!fail.locked && fail.count < 3)) return;
    await recordSecurityAlert({
      code: 'auth_security_event',
      severity: 'critical',
      category: 'access',
      title: fail.locked
        ? 'Bloqueo Anti-Hacking en inicio de sesión'
        : `Múltiples fallos consecutivos de inicio de sesión (${fail.count})`,
      description: fail.locked
        ? `Se superó el límite de ${MAX_AUTH_ATTEMPTS} intentos fallidos para "${cleanUser || 'usuario desconocido'}". Acceso bloqueado por 15 minutos.`
        : `Se detectaron ${fail.count} intentos fallidos consecutivos de acceso para "${cleanUser || 'usuario desconocido'}".`,
      actorRole: targetAccount?.role || 'public',
      actorName: targetAccount?.displayName || cleanUser || null,
      actorTag: targetAccount?.tag || null,
      ipMasked: maskIp(clientIp),
      metadata: {
        scope: 'login',
        username: cleanUser.slice(0, 60) || null,
        failedAttempts: fail.count,
        locked: Boolean(fail.locked),
      },
    });
  };

  // Explicitly reject AdminCripian and any prior variants
  if (cleanUser.toLowerCase() === 'admincripian') {
    const fail = enforceRateLimit
      ? recordFailedAttempt(bucketKey)
      : { count: 1, locked: false, retryAfterSeconds: 0, remainingAttempts: 4 };
    await logLoginFailureAlert(fail, null);
    if (fail.locked) {
      return res.status(429).json({
        error: `Alerta Anti-Hacking: Se superó el límite de ${MAX_AUTH_ATTEMPTS} intentos. Acceso bloqueado por 15 minutos.`,
        locked: true,
        retryAfterSeconds: fail.retryAfterSeconds,
        remainingAttempts: 0,
      });
    }
    return res.status(401).json({
      error: 'Credenciales inválidas.',
      locked: false,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  const auth = ensureAuthStore();
  const signingSecret = getSigningSecret(auth);
  const account = await findAuthAccountByUsername(cleanUser);

  if (!account) {
    const fail = enforceRateLimit
      ? recordFailedAttempt(bucketKey)
      : { count: 1, locked: false, retryAfterSeconds: 0, remainingAttempts: 4 };
    await logLoginFailureAlert(fail, null);
    if (!IS_TESTING) await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
    if (fail.locked) {
      return res.status(429).json({
        error: `Alerta Anti-Hacking: Se superó el límite de ${MAX_AUTH_ATTEMPTS} intentos. Acceso bloqueado por 15 minutos.`,
        locked: true,
        retryAfterSeconds: fail.retryAfterSeconds,
        remainingAttempts: 0,
      });
    }
    return res.status(401).json({
      error: 'Credenciales inválidas.',
      locked: false,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  if (!account.active) {
    return res.status(403).json({
      error: 'Esta cuenta está desactivada. Contacta al administrador.',
      locked: false,
    });
  }

  const passMatches = await verifyStoredSecret(cleanPass, account.passwordHash, account.passwordSalt);

  if (!passMatches) {
    const fail = enforceRateLimit
      ? recordFailedAttempt(bucketKey)
      : { count: 1, locked: false, retryAfterSeconds: 0, remainingAttempts: 4 };
    await logLoginFailureAlert(fail, account);
    if (!IS_TESTING) await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
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

  if (enforceRateLimit) clearAttempts(bucketKey);

  // Non-admin roles (telemarketing / vendedor) complete login immediately without PIN (1FA)
  if (account.role === 'telemarketing' || account.role === 'vendedor') {
    const sessionToken = signToken(
      {
        scope: 'dsb_session',
        userId: account.id,
        user: account.username,
        role: account.role,
        tokenVersion: account.tokenVersion || 1,
        exp: Date.now() + 8 * 60 * 60 * 1000,
      },
      signingSecret
    );

    return res.json({
      ok: true,
      requiresPin: false,
      sessionToken,
      user: account.username,
      username: account.username,
      userId: account.id,
      displayName: account.displayName,
      role: account.role,
      tag: account.tag,
      avatarUrl: account.avatarUrl ?? null,
    });
  }

  // Admin requires Step 2 PIN (2FA)
  const preAuthToken = signToken(
    {
      scope: 'pre_pin',
      userId: account.id,
      user: account.username,
      role: 'admin',
      tokenVersion: account.tokenVersion || 1,
      exp: Date.now() + 5 * 60 * 1000,
    },
    signingSecret
  );

  return res.json({
    ok: true,
    requiresPin: true,
    preAuthToken,
    user: account.username,
    username: account.username,
    userId: account.id,
    displayName: account.displayName,
    role: 'admin',
    tag: account.tag,
    avatarUrl: account.avatarUrl ?? null,
  });
});

// Filter 2: Numeric PIN verification (admin only, requires valid Filter 1 preAuthToken)
app.post('/api/auth/verify-pin', async (req, res) => {
  const enforceRateLimit = shouldEnforceAuthRateLimit(req);
  const bucketKey = getBucketKey(req, 'pin');
  const clientIp = getClientIp(req);
  if (enforceRateLimit) {
    const status = checkRateLimit(bucketKey);
    if (status.locked) {
      await recordSecurityAlert(
        {
          code: 'auth_security_event',
          severity: 'critical',
          category: 'access',
          title: 'PIN 2FA bloqueado por múltiples intentos fallidos',
          description: `Intento de verificación de PIN rechazado por bloqueo activo (${status.retryAfterSeconds}s restantes).`,
          actorRole: 'admin',
          ipMasked: maskIp(clientIp),
          metadata: {
            scope: 'pin',
            locked: true,
            retryAfterSeconds: status.retryAfterSeconds,
          },
        },
        { dedupKey: `auth_lock:pin:${clientIp}`, dedupWindowMs: 60 * 1000 }
      );
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
  const account =
    (preAuth.userId && (await findAuthAccountById(preAuth.userId))) ||
    (await findAuthAccountByUsername(preAuth.user));

  if (!account || !account.active || account.role !== 'admin') {
    return res.status(401).json({
      error: 'Usuario no encontrado o sesión no válida.',
      expiredFirstFactor: true,
    });
  }

  if ((preAuth.tokenVersion ?? 1) !== (account.tokenVersion || 1)) {
    return res.status(401).json({
      error: 'La sesión del primer filtro expiró. Vuelve a iniciar sesión.',
      expiredFirstFactor: true,
    });
  }

  const pinMatches = await verifyStoredSecret(cleanPin, account.pinHash, account.pinSalt);
  if (!pinMatches) {
    const fail = enforceRateLimit
      ? recordFailedAttempt(bucketKey)
      : { count: 1, locked: false, retryAfterSeconds: 0, remainingAttempts: 4 };
    if (enforceRateLimit && (fail.locked || fail.count >= 3)) {
      await recordSecurityAlert({
        code: 'auth_security_event',
        severity: 'critical',
        category: 'access',
        title: fail.locked
          ? 'Bloqueo Anti-Hacking en verificación de PIN 2FA'
          : `Múltiples intentos fallidos de PIN 2FA (${fail.count})`,
        description: fail.locked
          ? `PIN 2FA bloqueado por 15 minutos tras ${MAX_AUTH_ATTEMPTS} intentos fallidos en la cuenta ${account.username}.`
          : `Se detectaron ${fail.count} intentos fallidos consecutivos de PIN 2FA para ${account.username}.`,
        actorRole: 'admin',
        actorName: account.displayName || account.username,
        actorTag: account.tag || null,
        ipMasked: maskIp(clientIp),
        metadata: {
          scope: 'pin',
          username: account.username,
          failedAttempts: fail.count,
          locked: Boolean(fail.locked),
        },
      });
    }
    if (!IS_TESTING) await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 250)));
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

  if (enforceRateLimit) clearAttempts(bucketKey);
  const sessionToken = signToken(
    {
      scope: 'dsb_session',
      userId: account.id,
      user: account.username,
      role: 'admin',
      tokenVersion: account.tokenVersion || 1,
      exp: Date.now() + 8 * 60 * 60 * 1000,
    },
    signingSecret
  );

  return res.json({
    ok: true,
    sessionToken,
    user: account.username,
    username: account.username,
    userId: account.id,
    displayName: account.displayName,
    role: 'admin',
    tag: account.tag,
    avatarUrl: account.avatarUrl ?? null,
  });
});

// Verify active DSB session (validates active status + live tokenVersion)
app.get('/api/auth/session', async (req, res) => {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ ok: false, authenticated: false, valid: false });
  }
  return res.json({
    ok: true,
    authenticated: true,
    valid: true,
    user: session.user,
    username: session.username,
    userId: session.userId,
    displayName: session.displayName,
    role: session.role,
    tag: session.tag,
    avatarUrl: session.avatarUrl ?? null,
  });
});

// Update Admin Username, Password, or PIN — requires active Admin session + Master Key + Confirmation PIN + 2x newPassword
app.post('/api/auth/update-credentials', requireAdminRole, async (req, res) => {
  const {
    masterPassword,
    confirmationPin,
    newUsername,
    newPassword,
    confirmNewPassword,
    newPin,
  } = req.body || {};

  if (!(await verifyMasterPasswordForMutation(req, res))) return;

  const pinCandidate = typeof confirmationPin === 'string' ? confirmationPin.trim() : '';
  if (!verifyAdminPasswordChangePin(pinCandidate)) {
    return res.status(403).json({
      error: 'PIN de confirmación de administrador inválido o requerido.',
    });
  }

  return withStoreMutationLock(async () => {
    try {
      const accounts = await fetchAllAuthAccounts();
      const targetAdmin = accounts.find(
        (a) => a.id === req.dsbSession.userId && a.role === 'admin'
      );

      if (!targetAdmin) {
        return res.status(404).json({ error: 'Cuenta de administrador no encontrada.' });
      }

      const nextAccount = { ...targetAdmin };
      let hasChange = false;

      if (typeof newUsername === 'string' && newUsername.trim()) {
        const cleanNewUser = newUsername.trim();
        if (!USERNAME_RE.test(cleanNewUser) || cleanNewUser.toLowerCase() === 'admincripian') {
          return res.status(400).json({
            error: 'El usuario debe tener entre 3 y 40 caracteres válidos (letras, números, . _ -).',
          });
        }
        const dup = accounts.some(
          (a) => a.id !== targetAdmin.id && a.username.toLowerCase() === cleanNewUser.toLowerCase()
        );
        if (dup) {
          return res.status(409).json({ error: `El usuario "${cleanNewUser}" ya está en uso.` });
        }
        nextAccount.username = cleanNewUser;
        hasChange = true;
      }

      if (typeof newPassword === 'string' && newPassword.length > 0) {
        if (newPassword.length < 8) {
          return res.status(400).json({
            error: 'La nueva contraseña de administrador debe tener al menos 8 caracteres.',
          });
        }
        if (typeof confirmNewPassword !== 'string' || newPassword !== confirmNewPassword) {
          return res.status(400).json({
            error: 'La confirmación de la nueva contraseña no coincide.',
          });
        }
        const hashed = hashSecret(newPassword);
        nextAccount.passwordSalt = hashed.salt;
        nextAccount.passwordHash = USE_SUPABASE ? hashed.combined : hashed.hash;
        hasChange = true;
      }

      if (typeof newPin === 'string' && newPin.trim().length > 0) {
        const cleanNextPin = newPin.trim();
        if (!/^\d{4,12}$/.test(cleanNextPin)) {
          return res.status(400).json({
            error: 'El nuevo PIN debe contener entre 4 y 12 dígitos numéricos.',
          });
        }
        const hashedPin = hashSecret(cleanNextPin);
        nextAccount.pinSalt = hashedPin.salt;
        nextAccount.pinHash = USE_SUPABASE ? hashedPin.combined : hashedPin.hash;
        hasChange = true;
      }

      if (!hasChange) {
        return res.status(400).json({
          error: 'Debes indicar al menos un cambio (usuario, contraseña o PIN).',
        });
      }

      nextAccount.tokenVersion = (targetAdmin.tokenVersion || 1) + 1;
      nextAccount.updatedAt = new Date().toISOString();

      await persistUpdatedAuthAccount(nextAccount);

      const credActor = buildActorFromSession(req.dsbSession, 'admin', 'Administrador');
      await recordActivityLog({
        action: 'password_changed',
        category: 'accounts',
        ...credActor,
        summary: `${credActor.actorName} actualizó las credenciales de administrador (@${nextAccount.username}).`,
        fromState: null,
        toState: 'Credenciales actualizadas',
        targetType: 'account',
        targetId: nextAccount.id,
        targetLabel: `${nextAccount.displayName} (@${nextAccount.username})`,
        metadata: {
          scope: 'update_credentials',
          changedUsername: Boolean(typeof newUsername === 'string' && newUsername.trim()),
          changedPassword: Boolean(typeof newPassword === 'string' && newPassword.length > 0),
          changedPin: Boolean(typeof newPin === 'string' && newPin.trim().length > 0),
        },
      });

      const auth = ensureAuthStore();
      const signingSecret = getSigningSecret(auth);
      const refreshedToken = signToken(
        {
          scope: 'dsb_session',
          userId: nextAccount.id,
          user: nextAccount.username,
          role: 'admin',
          tokenVersion: nextAccount.tokenVersion,
          exp: Date.now() + 8 * 60 * 60 * 1000,
        },
        signingSecret
      );

      return res.json({
        ok: true,
        username: nextAccount.username,
        sessionToken: refreshedToken,
        tokenVersion: nextAccount.tokenVersion,
        message: 'Credenciales de administrador actualizadas correctamente.',
      });
    } catch (err) {
      logServerError('POST /api/auth/update-credentials', err);
      if (isUniqueViolationError(err)) {
        return res.status(409).json({
          error: 'El nuevo nombre de usuario ya está en uso.',
        });
      }
      return res.status(503).json({
        error: 'No se pudieron actualizar las credenciales de administrador.',
      });
    }
  });
});

// ----------------------------------------------------------------------------
// Admin Accounts Management (/api/accounts)
// ----------------------------------------------------------------------------

app.get('/api/accounts', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  try {
    const [accounts, store] = await Promise.all([fetchAllAuthAccounts(), getActiveStore()]);
    const visibleAccounts = filterVisibleAccountsForAdmin(accounts, req.dsbSession);
    return res.json({
      ok: true,
      accounts: visibleAccounts.map((a) => sanitizeAccountForClient(a, store.referrers)),
    });
  } catch (err) {
    logServerError('GET /api/accounts', err);
    return res.status(503).json({ error: 'No se pudo consultar la lista de cuentas.' });
  }
});

app.post('/api/accounts', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);

  const { username, displayName, role, tag, avatarUrl, password, confirmPassword, pin } =
    req.body || {};
  const cleanRole = typeof role === 'string' ? role.trim() : '';

  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;

  const cleanUser = typeof username === 'string' ? username.trim() : '';
  const cleanDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const normalizedTag = normalizeReferralCode(tag);
  const avatarCheck = sanitizeAvatarUrl(avatarUrl);
  const cleanPin = typeof pin === 'string' ? pin.trim() : '';

  if (!USERNAME_RE.test(cleanUser) || cleanUser.toLowerCase() === 'admincripian') {
    return res.status(400).json({
      error: 'El nombre de usuario debe tener entre 3 y 40 caracteres válidos (letras, números, . _ -).',
    });
  }
  if (cleanDisplayName.length < 2) {
    return res.status(400).json({ error: 'El nombre visible debe tener al menos 2 caracteres.' });
  }
  if (cleanRole !== 'admin' && cleanRole !== 'telemarketing' && cleanRole !== 'vendedor') {
    return res.status(400).json({
      error: 'El rol debe ser "admin", "telemarketing" o "vendedor".',
    });
  }
  if (cleanRole === 'admin' && !/^\d{4,8}$/.test(cleanPin)) {
    return res.status(400).json({
      error: 'Las cuentas de administrador requieren un PIN numérico de 4 a 8 dígitos.',
    });
  }
  if (!normalizedTag) {
    return res.status(400).json({
      error: 'El tag debe tener entre 2 y 32 caracteres alfanuméricos o guiones.',
    });
  }
  if (!avatarCheck.ok) {
    return res.status(400).json({ error: avatarCheck.error });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'La contraseña debe tener al menos 8 caracteres.',
    });
  }
  if (typeof confirmPassword !== 'string' || password !== confirmPassword) {
    return res.status(400).json({
      error: 'Las contraseñas no coinciden.',
    });
  }

  return withStoreMutationLock(async () => {
    let createdAccountId = null;
    try {
      const [accounts, store] = await Promise.all([fetchAllAuthAccounts(), getActiveStore()]);
      if (accounts.some((a) => a.username.toLowerCase() === cleanUser.toLowerCase())) {
        return res.status(409).json({ error: `El usuario "${cleanUser}" ya existe.` });
      }
      if (accounts.some((a) => a.tag.toUpperCase() === normalizedTag)) {
        return res.status(409).json({ error: `El tag "${normalizedTag}" ya está asignado a otra cuenta.` });
      }
      if ((store.referrers || []).some((r) => r.code.toUpperCase() === normalizedTag)) {
        return res.status(409).json({ error: `El tag "${normalizedTag}" ya está en uso en embajadores.` });
      }

      const nowIso = new Date().toISOString();
      const hashed = hashSecret(password);
      const pinHashed = cleanRole === 'admin' ? hashSecret(cleanPin) : null;
      const newAccount = {
        id: generateId(cleanRole === 'admin' ? 'adm' : 'usr'),
        username: cleanUser,
        displayName: cleanDisplayName.slice(0, 100),
        role: cleanRole,
        tag: normalizedTag,
        avatarUrl: avatarCheck.value,
        active: true,
        passwordSalt: hashed.salt,
        passwordHash: USE_SUPABASE ? hashed.combined : hashed.hash,
        pinSalt: pinHashed ? pinHashed.salt : null,
        pinHash: pinHashed ? (USE_SUPABASE ? pinHashed.combined : pinHashed.hash) : null,
        tokenVersion: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await persistNewAuthAccount(newAccount);
      createdAccountId = newAccount.id;

      let syncedReferrer = null;
      if (newAccount.role === 'vendedor') {
        syncedReferrer = await syncVendedorReferrer(store, newAccount, { mode: 'upsert' });
      }

      if (newAccount.role === 'admin') {
        await recordSecurityAlert(
          {
            code: 'admin_audit_event',
            severity: 'medium',
            category: 'audit',
            title: 'Nueva cuenta de administrador creada',
            description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} creó la cuenta de administrador "${newAccount.displayName}" (@${newAccount.username}, tag ${newAccount.tag}).`,
            actorRole: 'admin',
            actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Admin',
            actorTag: req.dsbSession?.tag || null,
            ipMasked: maskIp(getClientIp(req)),
            metadata: {
              action: 'admin_account_created',
              createdAccountId: newAccount.id,
              createdUsername: newAccount.username,
              createdTag: newAccount.tag,
            },
          },
          { store: USE_SUPABASE ? undefined : store }
        );
      }

      const createAccActor = buildActorFromSession(req.dsbSession, 'admin', 'Administrador');
      await recordActivityLog(
        {
          action: 'account_created',
          category: 'accounts',
          ...createAccActor,
          summary: `${createAccActor.actorName} creó la cuenta ${newAccount.role} "${newAccount.displayName}" (@${newAccount.username}, tag ${newAccount.tag}).`,
          fromState: null,
          toState: newAccount.role,
          targetType: 'account',
          targetId: newAccount.id,
          targetLabel: `${newAccount.displayName} (@${newAccount.username})`,
          metadata: {
            role: newAccount.role,
            username: newAccount.username,
            tag: newAccount.tag,
          },
        },
        { store: USE_SUPABASE ? undefined : store }
      );

      const [updatedAccounts, updatedStore] = await Promise.all([
        fetchAllAuthAccounts(),
        USE_SUPABASE ? getActiveStore() : Promise.resolve(store),
      ]);
      const sanitizedState = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', updatedAccounts);

      return res.status(201).json({
        ok: true,
        account: sanitizeAccountForClient(newAccount, updatedStore.referrers),
        referrer: syncedReferrer,
        accounts: sanitizedState.accounts,
        state: sanitizedState,
      });
    } catch (err) {
      logServerError('POST /api/accounts', err);
      if (createdAccountId) {
        await persistDeletedAuthAccount(createdAccountId).catch(() => {});
      }
      if (isUniqueViolationError(err)) {
        return res.status(409).json({
          error: `El usuario "${cleanUser}" o el tag "${normalizedTag}" ya está registrado.`,
        });
      }
      return res.status(503).json({ error: 'No se pudo crear la cuenta.' });
    }
  });
});

app.patch('/api/accounts/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);

  const { id } = req.params;
  const { displayName, tag, avatarUrl, active } = req.body || {};

  // Strict self-only Admin isolation: reject attempts to modify another Admin account immediately
  try {
    const preCheckAccounts = await fetchAllAuthAccounts();
    const preTarget = preCheckAccounts.find((a) => a.id === id);
    if (
      preTarget &&
      preTarget.role === 'admin' &&
      String(preTarget.id) !== String(req.dsbSession.userId)
    ) {
      await recordSecurityAlert({
        code: 'rbac_unauthorized_attempt',
        severity: 'critical',
        category: 'access',
        title: 'Intento bloqueado de modificar otra cuenta de administrador',
        description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} intentó modificar la cuenta de administrador "${preTarget.displayName || preTarget.username}" (@${preTarget.username}).`,
        actorRole: 'admin',
        actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador',
        actorTag: req.dsbSession?.tag || null,
        ipMasked: maskIp(getClientIp(req)),
        metadata: {
          reason: 'cross_admin_edit_attempt',
          targetAccountId: preTarget.id,
          targetUsername: preTarget.username,
          method: req.method,
          path: String(req.originalUrl || req.path || '').slice(0, 160),
        },
      });
      return res.status(403).json({
        error: 'Solo puedes modificar tu propia cuenta de Administrador.',
      });
    }
  } catch (err) {
    logServerError('PATCH /api/accounts/:id precheck', err);
    return res.status(503).json({ error: 'No se pudo verificar la cuenta.' });
  }

  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;

  if (avatarUrl !== undefined) {
    const avatarCheck = sanitizeAvatarUrl(avatarUrl);
    if (!avatarCheck.ok) {
      return res.status(400).json({ error: avatarCheck.error });
    }
  }

  return withStoreMutationLock(async () => {
    try {
      const [accounts, store] = await Promise.all([fetchAllAuthAccounts(), getActiveStore()]);
      const current = accounts.find((a) => a.id === id);
      if (!current) {
        return res.status(404).json({ error: 'Cuenta no encontrada.' });
      }
      if (current.role === 'admin' && String(current.id) !== String(req.dsbSession.userId)) {
        await recordSecurityAlert(
          {
            code: 'rbac_unauthorized_attempt',
            severity: 'critical',
            category: 'access',
            title: 'Intento bloqueado de modificar otra cuenta de administrador',
            description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} intentó modificar la cuenta de administrador "${current.displayName || current.username}" (@${current.username}).`,
            actorRole: 'admin',
            actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador',
            actorTag: req.dsbSession?.tag || null,
            ipMasked: maskIp(getClientIp(req)),
            metadata: {
              reason: 'cross_admin_edit_attempt',
              targetAccountId: current.id,
              targetUsername: current.username,
              method: req.method,
              path: String(req.originalUrl || req.path || '').slice(0, 160),
            },
          },
          { store: USE_SUPABASE ? undefined : store }
        );
        return res.status(403).json({
          error: 'Solo puedes modificar tu propia cuenta de Administrador.',
        });
      }

      const nextAccount = { ...current };
      const previousTag = current.tag;

      if (avatarUrl !== undefined) {
        const avatarCheck = sanitizeAvatarUrl(avatarUrl);
        nextAccount.avatarUrl = avatarCheck.value;
      }

      if (displayName !== undefined) {
        const cleanName = typeof displayName === 'string' ? displayName.trim() : '';
        if (cleanName.length < 2) {
          return res.status(400).json({ error: 'El nombre visible debe tener al menos 2 caracteres.' });
        }
        nextAccount.displayName = cleanName.slice(0, 100);
      }

      if (tag !== undefined) {
        const normalizedTag = normalizeReferralCode(tag);
        if (!normalizedTag) {
          return res.status(400).json({
            error: 'El tag debe tener entre 2 y 32 caracteres alfanuméricos o guiones.',
          });
        }
        const dupAccount = accounts.some(
          (a) => a.id !== current.id && a.tag.toUpperCase() === normalizedTag
        );
        if (dupAccount) {
          return res.status(409).json({ error: `El tag "${normalizedTag}" ya está en uso por otra cuenta.` });
        }
        const dupRef = (store.referrers || []).some(
          (r) => r.accountId !== current.id && r.code.toUpperCase() === normalizedTag
        );
        if (dupRef) {
          return res.status(409).json({ error: `El tag "${normalizedTag}" ya está en uso por otro embajador.` });
        }
        nextAccount.tag = normalizedTag;
      }

      if (typeof active === 'boolean') {
        if (!active && current.role === 'admin') {
          const otherActiveAdmins = accounts.filter(
            (a) => a.id !== current.id && a.role === 'admin' && a.active
          );
          if (current.id === req.dsbSession.userId || otherActiveAdmins.length === 0) {
            return res.status(400).json({
              error: 'No puedes desactivar tu propia cuenta ni la última cuenta de administrador.',
            });
          }
        }
        if (current.active && !active) {
          nextAccount.tokenVersion = (current.tokenVersion || 1) + 1;
        }
        nextAccount.active = active;
      }

      nextAccount.updatedAt = new Date().toISOString();
      await persistUpdatedAuthAccount(nextAccount);

      if (nextAccount.role === 'vendedor') {
        await syncVendedorReferrer(store, nextAccount, { mode: 'upsert', previousTag });
        // Keep owned Embajadores' ownerVendedorName / ownerVendedorTag in sync
        const ownedEmbajadores = (store.referrers || []).filter(
          (r) => r.partnerType === 'embajador' && r.ownerVendedorAccountId === nextAccount.id
        );
        if (ownedEmbajadores.length > 0) {
          for (const emb of ownedEmbajadores) {
            const updatedEmb = normalizeReferrerRecord({
              ...emb,
              ownerVendedorName: nextAccount.displayName.slice(0, 120),
              ownerVendedorTag: nextAccount.tag,
            });
            if (USE_SUPABASE) {
              cacheReferrerMeta(updatedEmb);
              await supabaseWriteWithOptionalColumns(
                `referrers?id=eq.${encodeURIComponent(updatedEmb.id)}`,
                'PATCH',
                { Prefer: 'return=minimal' },
                {
                  owner_vendedor_name: updatedEmb.ownerVendedorName,
                  owner_vendedor_tag: updatedEmb.ownerVendedorTag,
                },
                REFERRER_OPTIONAL_COLUMNS
              ).catch((err) => {
                if (!isMissingReferrersTableError(err)) logServerError('syncOwnedEmbajadores', err);
              });
            } else {
              store.referrers = (store.referrers || []).map((r) =>
                r.id === updatedEmb.id ? updatedEmb : r
              );
            }
          }
          if (!USE_SUPABASE) {
            writeStore(store);
          }
        }
      }

      const updAccActor = buildActorFromSession(req.dsbSession, 'admin', 'Administrador');
      await recordActivityLog(
        {
          action: 'account_updated',
          category: 'accounts',
          ...updAccActor,
          summary: `${updAccActor.actorName} actualizó la cuenta "${nextAccount.displayName}" (@${nextAccount.username})${current.active !== nextAccount.active ? ` (${nextAccount.active ? 'activada' : 'desactivada'})` : ''}.`,
          fromState: current.active ? 'Activa' : 'Inactiva',
          toState: nextAccount.active ? 'Activa' : 'Inactiva',
          targetType: 'account',
          targetId: nextAccount.id,
          targetLabel: `${nextAccount.displayName} (@${nextAccount.username})`,
          metadata: {
            role: nextAccount.role,
            tag: nextAccount.tag,
            active: Boolean(nextAccount.active),
          },
        },
        { store: USE_SUPABASE ? undefined : store }
      );

      const [updatedAccounts, updatedStore] = await Promise.all([
        fetchAllAuthAccounts(),
        USE_SUPABASE ? getActiveStore() : Promise.resolve(store),
      ]);
      const sanitizedState = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', updatedAccounts);

      return res.json({
        ok: true,
        account: sanitizeAccountForClient(nextAccount, updatedStore.referrers),
        accounts: sanitizedState.accounts,
        state: sanitizedState,
      });
    } catch (err) {
      logServerError('PATCH /api/accounts/:id', err);
      if (isUniqueViolationError(err)) {
        return res.status(409).json({ error: 'El tag o usuario indicado ya está en uso.' });
      }
      return res.status(503).json({ error: 'No se pudo actualizar la cuenta.' });
    }
  });
});

app.delete('/api/accounts/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;

  // Reject any attempt to delete an Admin account (self or another Admin) with 403
  try {
    const preCheckAccounts = await fetchAllAuthAccounts();
    const preTarget = preCheckAccounts.find((a) => a.id === id);
    if (preTarget && preTarget.role === 'admin') {
      const isOtherAdmin = String(preTarget.id) !== String(req.dsbSession.userId);
      if (isOtherAdmin) {
        await recordSecurityAlert({
          code: 'rbac_unauthorized_attempt',
          severity: 'critical',
          category: 'access',
          title: 'Intento bloqueado de eliminar otra cuenta de administrador',
          description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} intentó eliminar la cuenta de administrador "${preTarget.displayName || preTarget.username}" (@${preTarget.username}).`,
          actorRole: 'admin',
          actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador',
          actorTag: req.dsbSession?.tag || null,
          ipMasked: maskIp(getClientIp(req)),
          metadata: {
            reason: 'cross_admin_delete_attempt',
            targetAccountId: preTarget.id,
            targetUsername: preTarget.username,
            method: req.method,
            path: String(req.originalUrl || req.path || '').slice(0, 160),
          },
        });
      }
      return res.status(403).json({
        error: isOtherAdmin
          ? 'No tienes permisos para eliminar otra cuenta de Administrador.'
          : 'No se pueden eliminar cuentas de Administrador.',
      });
    }
  } catch (err) {
    logServerError('DELETE /api/accounts/:id precheck', err);
    return res.status(503).json({ error: 'No se pudo verificar la cuenta.' });
  }

  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;

  return withStoreMutationLock(async () => {
    try {
      const [accounts, store] = await Promise.all([fetchAllAuthAccounts(), getActiveStore()]);
      const target = accounts.find((a) => a.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Cuenta no encontrada.' });
      }
      if (target.role === 'admin') {
        const isOtherAdmin = String(target.id) !== String(req.dsbSession.userId);
        if (isOtherAdmin) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'critical',
              category: 'access',
              title: 'Intento bloqueado de eliminar otra cuenta de administrador',
              description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} intentó eliminar la cuenta de administrador "${target.displayName || target.username}" (@${target.username}).`,
              actorRole: 'admin',
              actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador',
              actorTag: req.dsbSession?.tag || null,
              ipMasked: maskIp(getClientIp(req)),
              metadata: {
                reason: 'cross_admin_delete_attempt',
                targetAccountId: target.id,
                targetUsername: target.username,
                method: req.method,
                path: String(req.originalUrl || req.path || '').slice(0, 160),
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
        }
        return res.status(403).json({
          error: isOtherAdmin
            ? 'No tienes permisos para eliminar otra cuenta de Administrador.'
            : 'No se pueden eliminar cuentas de Administrador.',
        });
      }

      await persistDeletedAuthAccount(target.id);

      if (target.role === 'vendedor') {
        await syncVendedorReferrer(store, target, { mode: 'deactivate' });
      }

      const delAccActor = buildActorFromSession(req.dsbSession, 'admin', 'Administrador');
      await recordActivityLog(
        {
          action: 'account_deleted',
          category: 'accounts',
          ...delAccActor,
          summary: `${delAccActor.actorName} eliminó la cuenta ${target.role} "${target.displayName}" (@${target.username}).`,
          fromState: target.role,
          toState: 'Eliminada',
          targetType: 'account',
          targetId: target.id,
          targetLabel: `${target.displayName} (@${target.username})`,
          metadata: {
            role: target.role,
            username: target.username,
            tag: target.tag,
          },
        },
        { store: USE_SUPABASE ? undefined : store }
      );

      const [updatedAccounts, updatedStore] = await Promise.all([
        fetchAllAuthAccounts(),
        USE_SUPABASE ? getActiveStore() : Promise.resolve(store),
      ]);
      const sanitizedState = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', updatedAccounts);

      return res.json({
        ok: true,
        accounts: sanitizedState.accounts,
        state: sanitizedState,
      });
    } catch (err) {
      logServerError('DELETE /api/accounts/:id', err);
      return res.status(503).json({ error: 'No se pudo eliminar la cuenta.' });
    }
  });
});

// Change password for telemarketing / vendedor account ONLY (verifies target user's currentPassword + 2x newPassword)
app.post('/api/accounts/:id/password', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  const { currentPassword, newPassword, confirmNewPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ error: 'Debes ingresar la contraseña actual de la cuenta.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  if (typeof confirmNewPassword !== 'string' || newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'La confirmación de la nueva contraseña no coincide.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const [accounts, store] = await Promise.all([fetchAllAuthAccounts(), getActiveStore()]);
      const target = accounts.find((a) => a.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Cuenta no encontrada.' });
      }
      if (target.role === 'admin') {
        return res.status(400).json({
          error:
            'Las credenciales de administrador solo pueden cambiarse en el módulo de seguridad con llave maestra y PIN.',
        });
      }

      const currentMatches = await verifyStoredSecret(
        currentPassword,
        target.passwordHash,
        target.passwordSalt
      );
      if (!currentMatches) {
        return res.status(403).json({
          error: 'La contraseña actual ingresada para esta cuenta es incorrecta.',
        });
      }

      const hashed = hashSecret(newPassword);
      const updatedAccount = {
        ...target,
        passwordSalt: hashed.salt,
        passwordHash: USE_SUPABASE ? hashed.combined : hashed.hash,
        tokenVersion: (target.tokenVersion || 1) + 1,
        updatedAt: new Date().toISOString(),
      };

      await persistUpdatedAuthAccount(updatedAccount);

      const pwdActor = buildActorFromSession(req.dsbSession, 'admin', 'Administrador');
      await recordActivityLog(
        {
          action: 'password_changed',
          category: 'accounts',
          ...pwdActor,
          summary: `${pwdActor.actorName} cambió la contraseña de la cuenta "${updatedAccount.displayName}" (@${updatedAccount.username}).`,
          fromState: null,
          toState: 'Contraseña actualizada',
          targetType: 'account',
          targetId: updatedAccount.id,
          targetLabel: `${updatedAccount.displayName} (@${updatedAccount.username})`,
          metadata: {
            role: updatedAccount.role,
            username: updatedAccount.username,
          },
        },
        { store: USE_SUPABASE ? undefined : store }
      );

      return res.json({
        ok: true,
        account: sanitizeAccountForClient(updatedAccount, store.referrers),
        message: 'Contraseña actualizada correctamente.',
      });
    } catch (err) {
      logServerError('POST /api/accounts/:id/password', err);
      return res.status(503).json({ error: 'No se pudo actualizar la contraseña de la cuenta.' });
    }
  });
});

// Change password for OWN admin account ONLY (requires Admin session + Security Key + Confirmation PIN + 2x matching newPassword)
app.post('/api/accounts/:id/admin-password', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  const { securityKey, masterPassword, confirmationPin, newPassword, confirmNewPassword } =
    req.body || {};

  // Strict self-only Admin isolation: reject before verifying keys or mutating
  if (String(id) !== String(req.dsbSession.userId)) {
    await recordSecurityAlert({
      code: 'rbac_unauthorized_attempt',
      severity: 'critical',
      category: 'access',
      title: 'Intento bloqueado de cambiar contraseña de otro administrador',
      description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} intentó cambiar la contraseña de la cuenta de administrador "${String(id || '').slice(0, 80)}".`,
      actorRole: 'admin',
      actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador',
      actorTag: req.dsbSession?.tag || null,
      ipMasked: maskIp(getClientIp(req)),
      metadata: {
        reason: 'cross_admin_password_attempt',
        targetAccountId: String(id || '').slice(0, 80),
        method: req.method,
        path: String(req.originalUrl || req.path || '').slice(0, 160),
      },
    });
    return res.status(403).json({
      error: 'Solo puedes cambiar la contraseña de tu propia cuenta de Administrador.',
    });
  }

  const bucketKey = getBucketKey(req, 'admin_pw_change');
  const enforceRateLimit = shouldEnforceAuthRateLimit(req);
  const clientIp = getClientIp(req);

  if (enforceRateLimit) {
    const status = checkRateLimit(bucketKey);
    if (status.locked) {
      await recordSecurityAlert(
        {
          code: 'auth_security_event',
          severity: 'critical',
          category: 'access',
          title: 'Cambio de contraseña de administrador bloqueado por intentos fallidos',
          description: `Se rechazó un intento bloqueado de cambio de contraseña de administrador en ${req.method} ${req.originalUrl || req.path} (${status.retryAfterSeconds}s restantes).`,
          actorRole: req.dsbSession?.role || 'admin',
          actorName: req.dsbSession?.displayName || req.dsbSession?.user || null,
          actorTag: req.dsbSession?.tag || null,
          ipMasked: maskIp(clientIp),
          metadata: {
            scope: 'admin_pw_change',
            locked: true,
            retryAfterSeconds: status.retryAfterSeconds,
            targetAccountId: String(id || '').slice(0, 80),
            path: String(req.originalUrl || req.path || '').slice(0, 120),
          },
        },
        { dedupKey: `auth_lock:admin_pw_change:${clientIp}`, dedupWindowMs: 60 * 1000 }
      );
      return res.status(429).json({
        error: `Cambio de contraseña bloqueado temporalmente (${status.retryAfterSeconds}s).`,
        locked: true,
        retryAfterSeconds: status.retryAfterSeconds,
        remainingAttempts: 0,
      });
    }
  }

  const respondAuthFailure = async (failureKind, baseErrorMessage) => {
    if (!enforceRateLimit) {
      return res.status(401).json({
        error: baseErrorMessage,
        locked: false,
        retryAfterSeconds: 0,
        remainingAttempts: 4,
      });
    }
    const fail = recordFailedAttempt(bucketKey);
    if (fail.locked || fail.count >= 3) {
      await recordSecurityAlert({
        code: 'auth_security_event',
        severity: 'critical',
        category: 'access',
        title: fail.locked
          ? 'Bloqueo de seguridad por intentos fallidos al cambiar contraseña de administrador'
          : `Múltiples intentos fallidos al cambiar contraseña de administrador (${fail.count})`,
        description: fail.locked
          ? `Se superó el límite de ${MAX_AUTH_ATTEMPTS} intentos fallidos (${failureKind}) al cambiar contraseña de administrador desde ${maskIp(clientIp) || 'IP desconocida'}. Acceso bloqueado por 15 minutos.`
          : `Se registraron ${fail.count} intentos consecutivos fallidos (${failureKind}) en ${req.method} ${req.originalUrl || req.path}.`,
        actorRole: req.dsbSession?.role || 'admin',
        actorName: req.dsbSession?.displayName || req.dsbSession?.user || null,
        actorTag: req.dsbSession?.tag || null,
        ipMasked: maskIp(clientIp),
        metadata: {
          scope: 'admin_pw_change',
          failureKind,
          targetAccountId: String(id || '').slice(0, 80),
          failedAttempts: fail.count,
          locked: Boolean(fail.locked),
          path: String(req.originalUrl || req.path || '').slice(0, 120),
        },
      });
    }
    if (!IS_TESTING) {
      await new Promise((r) => setTimeout(r, Math.min(2000, fail.count * 300)));
    }
    return res.status(fail.locked ? 429 : 401).json({
      error: fail.locked
        ? `${baseErrorMessage} Bloqueo preventivo activado por 15 minutos.`
        : baseErrorMessage,
      locked: fail.locked,
      retryAfterSeconds: fail.retryAfterSeconds,
      remainingAttempts: fail.remainingAttempts,
    });
  };

  const securityKeyCandidate =
    typeof securityKey === 'string' && securityKey.length > 0
      ? securityKey
      : typeof masterPassword === 'string'
        ? masterPassword
        : '';

  if (!verifyMasterKey(securityKeyCandidate)) {
    return respondAuthFailure('security_key', 'Clave de seguridad incorrecta.');
  }

  const pinCandidate = typeof confirmationPin === 'string' ? confirmationPin.trim() : '';
  if (!verifyAdminPasswordChangePin(pinCandidate)) {
    return respondAuthFailure('confirmation_pin', 'PIN de confirmación incorrecto.');
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      error: 'La nueva contraseña de administrador debe tener al menos 8 caracteres.',
    });
  }
  if (typeof confirmNewPassword !== 'string' || confirmNewPassword !== newPassword) {
    return res.status(400).json({
      error: 'La confirmación de la nueva contraseña no coincide.',
    });
  }

  return withStoreMutationLock(async () => {
    try {
      const [accounts, store] = await Promise.all([fetchAllAuthAccounts(), getActiveStore()]);
      const target = accounts.find((a) => a.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Cuenta no encontrada.' });
      }
      if (target.role !== 'admin') {
        return res.status(400).json({
          error: 'Esta operación solo está disponible para cuentas de administrador.',
        });
      }

      const hashed = hashSecret(newPassword);
      const nextAccount = {
        ...target,
        passwordSalt: hashed.salt,
        passwordHash: USE_SUPABASE ? hashed.combined : hashed.hash,
        tokenVersion: (target.tokenVersion || 1) + 1,
        updatedAt: new Date().toISOString(),
      };

      await persistUpdatedAuthAccount(nextAccount);

      const isSelf = target.id === req.dsbSession.userId;
      const actorName = req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador';
      await recordSecurityAlert(
        {
          code: 'admin_audit_event',
          severity: 'medium',
          category: 'audit',
          title: 'Contraseña de administrador actualizada',
          description: isSelf
            ? `${actorName} actualizó su propia contraseña de administrador (${target.username}).`
            : `${actorName} actualizó la contraseña del administrador ${target.displayName || target.username} (${target.username}).`,
          actorRole: 'admin',
          actorName,
          actorTag: req.dsbSession?.tag || null,
          ipMasked: maskIp(clientIp),
          metadata: {
            action: 'admin_password_change',
            targetAccountId: target.id,
            targetUsername: target.username,
            selfUpdate: isSelf,
            tokenVersion: nextAccount.tokenVersion,
          },
        },
        { store: USE_SUPABASE ? undefined : store }
      );

      const admPwdActor = buildActorFromSession(req.dsbSession, 'admin', 'Administrador');
      await recordActivityLog(
        {
          action: 'password_changed',
          category: 'accounts',
          ...admPwdActor,
          summary: isSelf
            ? `${actorName} actualizó su propia contraseña de administrador (@${target.username}).`
            : `${actorName} actualizó la contraseña del administrador "${target.displayName || target.username}" (@${target.username}).`,
          fromState: null,
          toState: 'Contraseña actualizada',
          targetType: 'account',
          targetId: target.id,
          targetLabel: `${target.displayName || target.username} (@${target.username})`,
          metadata: {
            role: 'admin',
            selfUpdate: isSelf,
            targetUsername: target.username,
          },
        },
        { store: USE_SUPABASE ? undefined : store }
      );

      let freshSessionToken;
      if (isSelf) {
        const auth = ensureAuthStore();
        const signingSecret = getSigningSecret(auth);
        freshSessionToken = signToken(
          {
            scope: 'dsb_session',
            userId: nextAccount.id,
            user: nextAccount.username,
            role: 'admin',
            tokenVersion: nextAccount.tokenVersion,
            exp: Date.now() + 8 * 60 * 60 * 1000,
          },
          signingSecret
        );
      }

      clearAttempts(bucketKey);

      return res.json({
        ok: true,
        message: 'Contraseña de administrador actualizada correctamente.',
        ...(freshSessionToken ? { sessionToken: freshSessionToken } : {}),
        account: sanitizeAccountForClient(nextAccount, store.referrers),
      });
    } catch (err) {
      logServerError('POST /api/accounts/:id/admin-password', err);
      return res.status(503).json({
        error: 'No se pudo actualizar la contraseña de administrador.',
      });
    }
  });
});

// Admin-password protected full reset: wipes all leads, metrics, QR history, visit log, resets referrer visit counters (and optionally gifts/settings)
async function handleMasterReset(req, res) {
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;

  const { resetCatalogAndSettings } = req.body || {};
  const shouldResetCatalog = resetCatalogAndSettings !== false;

  return withStoreMutationLock(async () => {
    try {
      applyNoStoreHeaders(res);
      const defaults = readDefaultStore();
      memoryQrFallback = [];
      memoryVisitLogFallback = [];
      memoryLeadPromoStates.clear();
      memoryLeadWorkflowStates.clear();
      memoryQrAccountIds.clear();
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
        await supabaseRest('referral_visits?id=not.is.null', { method: 'DELETE' }).catch((err) => {
          if (!isMissingReferralVisitsTableError(err)) throw err;
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
            'app_settings?id=eq.default',
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
            [
              'gift_theme',
              'custom_box_color',
              'showcase_style',
              'randomize_gifts',
              'referral_prize_rule',
            ]
          );
        }

        saveSupabaseOverlay();

        if (!IS_VERCEL) {
          const local = ensureStore();
          local.leads = [];
          local.qrHistory = [];
          local.visitLog = [];
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

        await recordSecurityAlert({
          code: 'admin_audit_event',
          severity: 'medium',
          category: 'audit',
          title: 'Reinicio Maestro ejecutado por administrador',
          description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} ejecutó un reinicio maestro de métricas y registros${shouldResetCatalog ? ' (incluyendo catálogo y configuración)' : ''}.`,
          actorRole: 'admin',
          actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Admin',
          actorTag: req.dsbSession?.tag || null,
          ipMasked: maskIp(getClientIp(req)),
          metadata: {
            action: 'master_reset',
            resetCatalogAndSettings: shouldResetCatalog,
          },
        });
        await recordActivityLog({
          action: 'master_reset',
          category: 'system',
          ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
          summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} ejecutó un Reinicio Maestro de métricas y registros${shouldResetCatalog ? ' (incluyendo catálogo y configuración)' : ''}.`,
          fromState: null,
          toState: 'Reiniciado',
          targetType: 'system',
          targetId: 'master-reset',
          targetLabel: 'Reinicio Maestro',
          metadata: {
            resetCatalogAndSettings: shouldResetCatalog,
          },
        });

        const [updatedStore, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
        return res.json({
          ok: true,
          state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts),
          message: 'Todas las métricas y datos fueron reiniciados a 0.',
        });
      }

      const store = ensureStore();
      store.leads = [];
      store.qrHistory = [];
      store.visitLog = [];
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
      await recordSecurityAlert(
        {
          code: 'admin_audit_event',
          severity: 'medium',
          category: 'audit',
          title: 'Reinicio Maestro ejecutado por administrador',
          description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} ejecutó un reinicio maestro de métricas y registros${shouldResetCatalog ? ' (incluyendo catálogo y configuración)' : ''}.`,
          actorRole: 'admin',
          actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Admin',
          actorTag: req.dsbSession?.tag || null,
          ipMasked: maskIp(getClientIp(req)),
          metadata: {
            action: 'master_reset',
            resetCatalogAndSettings: shouldResetCatalog,
          },
        },
        { store }
      );
      await recordActivityLog(
        {
          action: 'master_reset',
          category: 'system',
          ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
          summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} ejecutó un Reinicio Maestro de métricas y registros${shouldResetCatalog ? ' (incluyendo catálogo y configuración)' : ''}.`,
          fromState: null,
          toState: 'Reiniciado',
          targetType: 'system',
          targetId: 'master-reset',
          targetLabel: 'Reinicio Maestro',
          metadata: {
            resetCatalogAndSettings: shouldResetCatalog,
          },
        },
        { store }
      );
      writeStore(store);

      const accounts = await fetchAllAuthAccounts();
      return res.json({
        ok: true,
        state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts),
        message: 'Todas las métricas y datos fueron reiniciados a 0.',
      });
    } catch (err) {
      logServerError('POST /api/admin/reset-all', err);
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
    const session = await getAuthenticatedSession(req);
    const store = await getActiveStore();
    const accounts = session && session.role === 'admin' ? await fetchAllAuthAccounts() : [];
    return res.json(sanitizeStateForClient(store, session, session?.role ?? null, accounts));
  } catch (err) {
    logServerError('GET /api/state', err);
    return res.status(503).json({ error: 'No se pudo consultar el estado actual.' });
  }
});

// Public + Admin + Vendedor lead creation
app.post('/api/leads', async (req, res) => {
  applyNoStoreHeaders(res);
  const session = await getAuthenticatedSession(req);
  const clientIp = getClientIp(req);
  const ipMasked = maskIp(clientIp);
  if (session && session.role !== 'admin' && session.role !== 'vendedor') {
    await recordSecurityAlert({
      code: 'rbac_unauthorized_attempt',
      severity: 'high',
      category: 'access',
      title: 'Intento no autorizado de creación manual de prospecto',
      description: `${session.displayName || session.user} (${session.role}) intentó crear un prospecto vía POST /api/leads sin permisos.`,
      actorRole: session.role,
      actorName: session.displayName || session.user,
      actorTag: session.tag || null,
      ipMasked,
      metadata: {
        method: 'POST',
        path: '/api/leads',
        reason: 'unauthorized_role_lead_create',
      },
    });
    return res.status(403).json({
      error: 'Acceso denegado. Solo administradores y vendedores pueden registrar prospectos manualmente.',
    });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Cuerpo de solicitud inválido.' });
  }

  if (!session) {
    const PUBLIC_FORBIDDEN_LEAD_FIELDS = [
      'called',
      'calledAt',
      'callOutcome',
      'calledBy',
      'scheduledAt',
      'category',
      'orderAmount',
      'promoCodeInvalidated',
      'promoCodeInvalidatedAt',
      'sellerLocked',
      'sellerConfirmedAt',
      'sellerConfirmedBy',
      'referrerId',
      'referrerName',
      'adminPassword',
      'masterPassword',
      'role',
    ];
    const forgedFields = PUBLIC_FORBIDDEN_LEAD_FIELDS.filter((k) => req.body[k] !== undefined);
    if (typeof req.body.notes === 'string' && req.body.notes.trim().length > 0) {
      forgedFields.push('notes');
    }
    if (forgedFields.length > 0) {
      await recordSecurityAlert({
        code: 'rbac_unauthorized_attempt',
        severity: 'high',
        category: 'access',
        title: 'Intento público de inyección de campos administrativos en prospecto',
        description: `Solicitud pública en POST /api/leads intentó enviar campos protegidos (${forgedFields.join(', ')}).`,
        actorRole: 'public',
        actorName:
          typeof req.body.name === 'string' && req.body.name.trim()
            ? req.body.name.trim().slice(0, 80)
            : null,
        ipMasked,
        metadata: {
          method: 'POST',
          path: '/api/leads',
          reason: 'public_lead_forged_fields',
          forbiddenFields: forgedFields.join(','),
        },
      });
      return res.status(403).json({
        error: 'Acceso denegado. No se permiten campos administrativos en registros públicos.',
      });
    }
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
    referrerId: requestedReferrerId,
    visitorId,
  } = req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const cleanAddress = typeof address === 'string' ? address.trim() : '';
  const cleanVisitorId = sanitizeVisitorId(visitorId);

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Ingresa tu nombre completo.' });
  }
  if (cleanPhone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ error: 'Ingresa un número de teléfono válido.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const isAuthed = Boolean(session);
      const actorRole = isAuthed ? session.role : 'public';
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const referrers = Array.isArray(store.referrers)
        ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
        : [];

      let normalizedRefCode = normalizeReferralCode(referralCode);
      const cleanRequestedRefId =
        typeof requestedReferrerId === 'string' && requestedReferrerId.trim()
          ? requestedReferrerId.trim()
          : '';
      let matchedPartner = null;
      let matchedVendedor = null;

      if (session && session.role === 'vendedor') {
        const sessionTag = normalizeReferralCode(session.tag);
        const vendedorAcc = accounts.find((a) => a.id === session.userId) || null;
        let ownReferrer =
          referrers.find(
            (p) =>
              p.partnerType !== 'embajador' &&
              (p.accountId === session.userId || (sessionTag && p.code === sessionTag))
          ) || null;
        if (!ownReferrer && vendedorAcc) {
          ownReferrer = await syncVendedorReferrer(store, vendedorAcc, { mode: 'upsert' });
        }
        const ownedEmbajadores = getOwnedEmbajadoresForVendedor(session, referrers);

        if (cleanRequestedRefId || normalizedRefCode) {
          const matchesOwnById = Boolean(ownReferrer && cleanRequestedRefId && ownReferrer.id === cleanRequestedRefId);
          const matchesOwnByCode = Boolean(sessionTag && normalizedRefCode && normalizedRefCode === sessionTag);
          const matchedEmb =
            (cleanRequestedRefId && ownedEmbajadores.find((e) => e.id === cleanRequestedRefId)) ||
            (normalizedRefCode && ownedEmbajadores.find((e) => e.code === normalizedRefCode)) ||
            null;

          if (matchedEmb) {
            if (cleanRequestedRefId && matchedEmb.id !== cleanRequestedRefId) {
              // Mismatched id/code
              await recordSecurityAlert(
                {
                  code: 'rbac_unauthorized_attempt',
                  severity: 'high',
                  category: 'access',
                  title: 'Vendedor intentó atribuir prospecto manual a canal ajeno',
                  description: `${session.displayName || session.user} intentó registrar prospecto manual con atribución no autorizada (${cleanRequestedRefId || normalizedRefCode}).`,
                  actorRole: 'vendedor',
                  actorName: session.displayName || session.user,
                  actorTag: session.tag || null,
                  ipMasked,
                  metadata: {
                    reason: 'vendedor_foreign_lead_attribution',
                    requestedReferrerId: cleanRequestedRefId || null,
                    requestedReferralCode: normalizedRefCode || null,
                  },
                },
                { store: USE_SUPABASE ? undefined : store }
              );
              return res.status(403).json({
                error: 'Solo puedes asignar prospectos a tu canal directo o a tus propios embajadores.',
              });
            }
            matchedPartner = matchedEmb;
            normalizedRefCode = matchedEmb.code;
          } else if (matchesOwnById || matchesOwnByCode) {
            if (
              (cleanRequestedRefId && (!ownReferrer || ownReferrer.id !== cleanRequestedRefId)) ||
              (normalizedRefCode && sessionTag && normalizedRefCode !== sessionTag)
            ) {
              await recordSecurityAlert(
                {
                  code: 'rbac_unauthorized_attempt',
                  severity: 'high',
                  category: 'access',
                  title: 'Vendedor intentó atribuir prospecto manual a canal ajeno',
                  description: `${session.displayName || session.user} intentó registrar prospecto manual con atribución no autorizada (${cleanRequestedRefId || normalizedRefCode}).`,
                  actorRole: 'vendedor',
                  actorName: session.displayName || session.user,
                  actorTag: session.tag || null,
                  ipMasked,
                  metadata: {
                    reason: 'vendedor_foreign_lead_attribution',
                    requestedReferrerId: cleanRequestedRefId || null,
                    requestedReferralCode: normalizedRefCode || null,
                  },
                },
                { store: USE_SUPABASE ? undefined : store }
              );
              return res.status(403).json({
                error: 'Solo puedes asignar prospectos a tu canal directo o a tus propios embajadores.',
              });
            }
            matchedPartner = ownReferrer;
            normalizedRefCode = ownReferrer?.code || sessionTag || null;
            matchedVendedor = vendedorAcc;
          } else {
            await recordSecurityAlert(
              {
                code: 'rbac_unauthorized_attempt',
                severity: 'high',
                category: 'access',
                title: 'Vendedor intentó atribuir prospecto manual a canal ajeno',
                description: `${session.displayName || session.user} intentó registrar prospecto manual para un vendedor o embajador ajeno (${cleanRequestedRefId || normalizedRefCode}).`,
                actorRole: 'vendedor',
                actorName: session.displayName || session.user,
                actorTag: session.tag || null,
                ipMasked,
                metadata: {
                  reason: 'vendedor_foreign_lead_attribution',
                  requestedReferrerId: cleanRequestedRefId || null,
                  requestedReferralCode: normalizedRefCode || null,
                },
              },
              { store: USE_SUPABASE ? undefined : store }
            );
            return res.status(403).json({
              error: 'Solo puedes asignar prospectos a tu canal directo o a tus propios embajadores.',
            });
          }
        } else {
          // Default to vendedor's own direct channel
          matchedPartner = ownReferrer;
          normalizedRefCode = ownReferrer?.code || sessionTag || null;
          matchedVendedor = vendedorAcc;
        }
      } else {
        matchedPartner = normalizedRefCode
          ? referrers.find((p) => p.code === normalizedRefCode) || null
          : null;

        if (!matchedPartner && isAuthed && cleanRequestedRefId) {
          matchedPartner = referrers.find((p) => p.id === cleanRequestedRefId) || null;
          if (matchedPartner && !normalizedRefCode) {
            normalizedRefCode = matchedPartner.code;
          }
        }

        if (!matchedPartner && normalizedRefCode) {
          matchedVendedor =
            accounts.find(
              (a) => a.role === 'vendedor' && a.tag.toUpperCase() === normalizedRefCode
            ) || null;
        }
      }

      // 1. Strict Canonical Phone Deduplication (Public QR/Organic + Admin/Vendedor manual creation)
      const normalizedPhone = normalizePhoneKey(cleanPhone);
      const phoneMasked = maskPhone(cleanPhone);
      if (normalizedPhone.length >= 7) {
        const existingLead = (store.leads || []).find(
          (l) => normalizePhoneKey(l.phone) === normalizedPhone
        );
        if (existingLead) {
          const phoneKeyHash = hashPhoneKey(normalizedPhone);
          const existingAlerts = Array.isArray(store.securityAlerts) ? store.securityAlerts : [];
          const hadPriorDuplicateAlert = existingAlerts.some(
            (a) => a.code === 'duplicate_phone_attempt' && a.metadata?.phoneKeyHash === phoneKeyHash
          );
          const isCrossReferral = (normalizedRefCode || null) !== (existingLead.referralCode || null);
          const severity = hadPriorDuplicateAlert || isCrossReferral ? 'critical' : 'high';
          await recordSecurityAlert(
            {
              code: 'duplicate_phone_attempt',
              severity,
              category: 'qr_abuse',
              title: isCrossReferral
                ? 'Intento crítico de duplicado en otro QR / embajador'
                : hadPriorDuplicateAlert
                  ? 'Reincidencia crítica de teléfono duplicado'
                  : 'Intento bloqueado de teléfono duplicado',
              description: `Se bloqueó el registro de "${cleanName}" con teléfono ${phoneMasked || '***'} (ya registrado como "${existingLead.name}", código ${existingLead.claimCode}).${isCrossReferral ? ` Referido intentado: ${normalizedRefCode || 'Orgánico'} vs original: ${existingLead.referralCode || 'Orgánico'}.` : ''}`,
              actorRole,
              actorName: isAuthed ? session.displayName || session.user : cleanName,
              actorTag: isAuthed ? session.tag || null : normalizedRefCode || null,
              leadId: existingLead.id,
              leadName: existingLead.name,
              claimCode: existingLead.claimCode,
              phoneMasked,
              referralCode: normalizedRefCode || existingLead.referralCode || null,
              ipMasked,
              metadata: {
                existingLeadId: existingLead.id,
                existingLeadName: existingLead.name,
                existingClaimCode: existingLead.claimCode,
                existingReferralCode: existingLead.referralCode ?? null,
                attemptedName: cleanName,
                attemptedReferralCode: normalizedRefCode ?? null,
                crossReferralAttempt: isCrossReferral,
                repeatAttempt: hadPriorDuplicateAlert,
                visitorId: cleanVisitorId ?? null,
                phoneKeyHash,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(409).json({
            error: 'Este número de teléfono ya está registrado. Solo se permite un registro por número.',
            code: 'DUPLICATE_PHONE',
          });
        }
      }

      const suspiciousCheck = detectSuspiciousPhonePattern(cleanPhone, cleanName, store.leads || []);

      const activeGifts = store.gifts.filter((g) => g.active);
      const chosenGift =
        store.gifts.find((g) => g.id === giftId) ||
        (activeGifts.length > 0 ? pickWeightedGift(activeGifts) : null) ||
        store.gifts[0] ||
        null;

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const isManualAuthed = Boolean(session && (session.role === 'admin' || session.role === 'vendedor'));
      const manualCalledBy = isManualAuthed ? session.displayName || session.user : null;

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
        called: isManualAuthed,
        calledAt: isManualAuthed ? nowIso : null,
        callOutcome: isManualAuthed ? 'scheduled' : 'pending',
        calledBy: manualCalledBy,
        scheduledAt: isManualAuthed ? nowIso : null,
        category: 'none',
        orderAmount: null,
        notes: isAuthed && typeof notes === 'string' ? notes.trim() : '',
        qualification: sanitizeQualification(qualification),
        promoCodeInvalidated: false,
        promoCodeInvalidatedAt: null,
        sellerLocked: false,
        sellerConfirmedAt: null,
        sellerConfirmedBy: null,
        referralCode: normalizedRefCode || null,
        referrerId: matchedPartner ? matchedPartner.id : null,
        referrerName: matchedPartner
          ? matchedPartner.name
          : matchedVendedor
            ? matchedVendedor.displayName
            : null,
        createdAt: nowIso,
      };

      const fraudAlertsToRecord = [];

      if (suspiciousCheck.suspicious) {
        fraudAlertsToRecord.push({
          alert: {
            code: 'suspicious_phone_pattern',
            severity: 'medium',
            category: 'qr_abuse',
            title:
              suspiciousCheck.reason === 'duplicate_name_different_phone'
                ? 'Nombre idéntico registrado con diferente teléfono'
                : 'Patrón sospechoso de teléfono sintético o falso',
            description: `El registro de "${newLead.name}" (${phoneMasked || '***'}, código ${newLead.claimCode}) activó alerta: ${suspiciousCheck.detail}`,
            actorRole,
            actorName: isAuthed ? session.displayName || session.user : newLead.name,
            actorTag: isAuthed ? session.tag || null : newLead.referralCode || null,
            leadId: newLead.id,
            leadName: newLead.name,
            claimCode: newLead.claimCode,
            phoneMasked,
            referralCode: newLead.referralCode,
            ipMasked,
            metadata: {
              reason: suspiciousCheck.reason,
              matchedLeadId: suspiciousCheck.matchedLeadId ?? null,
              matchedClaimCode: suspiciousCheck.matchedClaimCode ?? null,
              visitorId: cleanVisitorId ?? null,
            },
          },
        });
      }

      if (cleanVisitorId) {
        const deviceEntries = recordSlidingWindowEntry(
          leadDeviceTracker,
          cleanVisitorId,
          { ts: nowMs, leadId: newLead.id, leadName: newLead.name, referralCode: newLead.referralCode },
          24 * 60 * 60 * 1000,
          nowMs
        );
        if (deviceEntries.length >= 2) {
          fraudAlertsToRecord.push({
            alert: {
              code: 'same_device_multi_lead',
              severity: 'high',
              category: 'qr_abuse',
              title: 'Múltiples prospectos desde el mismo dispositivo (24h)',
              description: `El dispositivo ${cleanVisitorId.slice(0, 24)} registró ${deviceEntries.length} prospectos en las últimas 24 horas (último: "${newLead.name}", ${newLead.claimCode}).`,
              actorRole,
              actorName: isAuthed ? session.displayName || session.user : newLead.name,
              actorTag: isAuthed ? session.tag || null : newLead.referralCode || null,
              leadId: newLead.id,
              leadName: newLead.name,
              claimCode: newLead.claimCode,
              phoneMasked,
              referralCode: newLead.referralCode,
              ipMasked,
              metadata: {
                visitorId: cleanVisitorId,
                leadsIn24h: deviceEntries.length,
                previousLeadId: deviceEntries[deviceEntries.length - 2]?.leadId ?? null,
              },
            },
            options: {
              dedupKey: `same_device_multi_lead:${cleanVisitorId}:${deviceEntries.length}`,
              dedupWindowMs: 60 * 1000,
            },
          });
        }
      }

      if (!IS_TESTING || !isLoopbackIp(clientIp)) {
        const ipEntries = recordSlidingWindowEntry(
          leadIpTracker,
          clientIp,
          nowMs,
          30 * 60 * 1000,
          nowMs
        );
        if (ipEntries.length >= 3) {
          fraudAlertsToRecord.push({
            alert: {
              code: 'velocity_ip_burst',
              severity: 'critical',
              category: 'qr_abuse',
              title: 'Ráfaga de registros desde una misma IP (30 min)',
              description: `La dirección ${ipMasked || 'IP'} generó ${ipEntries.length} registros en menos de 30 minutos (último: "${newLead.name}", código ${newLead.claimCode}).`,
              actorRole,
              actorName: isAuthed ? session.displayName || session.user : newLead.name,
              actorTag: isAuthed ? session.tag || null : newLead.referralCode || null,
              leadId: newLead.id,
              leadName: newLead.name,
              claimCode: newLead.claimCode,
              phoneMasked,
              referralCode: newLead.referralCode,
              ipMasked,
              metadata: {
                leadsIn30m: ipEntries.length,
                windowMinutes: 30,
                visitorId: cleanVisitorId ?? null,
              },
            },
            options: {
              dedupKey: `velocity_ip_burst:${clientIp}`,
              dedupWindowMs: 5 * 60 * 1000,
            },
          });
        }
      }

      const leadCreatedActivity = {
        action: isManualAuthed ? 'lead_created_manual' : 'lead_created',
        category: 'leads',
        ...(isAuthed
          ? buildActorFromSession(session, session.role, session.role === 'vendedor' ? 'Vendedor' : 'Administrador')
          : {
              actorRole: 'public',
              actorId: null,
              actorName: newLead.name,
              actorUsername: null,
              actorTag: newLead.referralCode || null,
            }),
        summary: isAuthed
          ? `${session.displayName || session.user || 'Usuario'} registró manualmente al prospecto "${newLead.name}" (${newLead.claimCode})${newLead.referralCode ? ` · QR ${newLead.referralCode}` : ''}.`
          : `Nuevo prospecto registrado: "${newLead.name}" (${newLead.claimCode})${newLead.referralCode ? ` vía QR ${newLead.referralCode}` : ' (registro orgánico)'}.`,
        fromState: null,
        toState: isManualAuthed ? 'Agendado' : 'Pendiente',
        targetType: 'lead',
        targetId: newLead.id,
        targetLabel: `${newLead.name} (${newLead.claimCode})`,
        metadata: {
          claimCode: newLead.claimCode,
          referralCode: newLead.referralCode ?? null,
          referrerName: newLead.referrerName ?? null,
          giftName: newLead.giftName ?? null,
          source: isAuthed ? session.role : 'public',
        },
      };

      if (USE_SUPABASE) {
        memoryLeadPromoStates.set(newLead.id, {
          promoCodeInvalidated: false,
          promoCodeInvalidatedAt: null,
        });
        memoryLeadWorkflowStates.set(newLead.id, {
          callOutcome: newLead.callOutcome,
          calledAt: newLead.calledAt,
          calledBy: newLead.calledBy,
          scheduledAt: newLead.scheduledAt,
          sellerLocked: false,
          sellerConfirmedAt: null,
          sellerConfirmedBy: null,
        });
        saveSupabaseOverlay();
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
            called: newLead.called,
            called_at: newLead.calledAt,
            call_outcome: newLead.callOutcome,
            called_by: newLead.calledBy,
            scheduled_at: newLead.scheduledAt,
            category: 'none',
            order_amount: null,
            notes: newLead.notes,
            qualification: newLead.qualification,
            promo_code_invalidated: false,
            promo_code_invalidated_at: null,
            seller_locked: false,
            seller_confirmed_at: null,
            seller_confirmed_by: null,
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
            'call_outcome',
            'called_by',
            'scheduled_at',
            'seller_locked',
            'seller_confirmed_at',
            'seller_confirmed_by',
          ]
        );
        for (const item of fraudAlertsToRecord) {
          await recordSecurityAlert(item.alert, item.options || {});
        }
        await recordActivityLog(leadCreatedActivity);
        const updatedStore = await getActiveStore();
        return res.status(201).json({
          lead: newLead,
          state: isAuthed
            ? sanitizeStateForClient(
                updatedStore,
                session,
                session.role,
                session.role === 'admin' ? accounts : []
              )
            : { ...sanitizeStateForClient(updatedStore, null, null), leads: [newLead] },
        });
      }

      store.leads.unshift(newLead);
      for (const item of fraudAlertsToRecord) {
        await recordSecurityAlert(item.alert, { ...(item.options || {}), store });
      }
      await recordActivityLog(leadCreatedActivity, { store });
      writeStore(store);

      return res.status(201).json({
        lead: newLead,
        state: isAuthed
          ? sanitizeStateForClient(
              store,
              session,
              session.role,
              session.role === 'admin' ? accounts : []
            )
          : { ...sanitizeStateForClient(store, null, null), leads: [newLead] },
      });
    } catch (err) {
      logServerError('POST /api/leads', err);
      return res.status(503).json({ error: 'No se pudo registrar el prospecto.' });
    }
  });
});

// Lead update: strict role-based workflow (public / telemarketing / vendedor / admin)
app.patch('/api/leads/:id', async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  const session = await getAuthenticatedSession(req);
  const isAuthed = Boolean(session);
  const role = session ? session.role : null;
  const updates = req.body;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ error: 'Cuerpo de solicitud inválido.' });
  }

  const PUBLIC_PATCH_ALLOWED_KEYS = new Set(['giftId', 'giftName', 'giftVisualKey', 'qualification']);
  const rawProvidedKeys = Object.keys(updates).filter((k) => updates[k] !== undefined);
  const touchesProtectedFields = rawProvidedKeys.some((k) => !PUBLIC_PATCH_ALLOWED_KEYS.has(k));

  if (!isAuthed && touchesProtectedFields) {
    return res.status(401).json({ error: 'Acceso no autorizado para editar datos administrativos.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([
        getActiveStore(),
        role === 'admin' ? fetchAllAuthAccounts() : Promise.resolve([]),
      ]);
      const index = store.leads.findIndex((item) => item.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Prospecto no encontrado.' });
      }

      const current = normalizeLeadRecord(store.leads[index]);
      const next = { ...current };
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const clientIp = getClientIp(req);
      const ipMasked = maskIp(clientIp);
      const postMutationAlerts = [];
      let postMutationActivity = null;

      if (role === 'telemarketing') {
        const allowedKeys = new Set(['callOutcome']);
        const providedKeys = Object.keys(updates).filter((k) => updates[k] !== undefined);
        const hasForbidden = providedKeys.some((k) => !allowedKeys.has(k));
        if (hasForbidden) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Telemarketing intentó modificar campos restringidos',
              description: `${session.displayName || session.user} intentó enviar campos no permitidos (${providedKeys.filter((k) => !allowedKeys.has(k)).join(', ')}) en el prospecto ${current.name} (${current.claimCode}).`,
              actorRole: 'telemarketing',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              leadId: current.id,
              leadName: current.name,
              claimCode: current.claimCode,
              phoneMasked: maskPhone(current.phone),
              referralCode: current.referralCode,
              ipMasked,
              metadata: {
                reason: 'telemarketing_forbidden_fields',
                forbiddenFields: providedKeys.filter((k) => !allowedKeys.has(k)).join(','),
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Acceso denegado. Telemarketing solo puede registrar si el prospecto fue agendado o no agendado.',
          });
        }
        if (updates.callOutcome !== 'scheduled' && updates.callOutcome !== 'not_scheduled') {
          return res.status(400).json({
            error: 'Debes seleccionar un estado válido: "scheduled" (agendado) o "not_scheduled" (no agendado).',
          });
        }
        if (current.callOutcome !== 'pending') {
          return res.status(409).json({
            error: 'Este prospecto ya fue gestionado por telemarketing.',
          });
        }

        next.callOutcome = updates.callOutcome;
        next.called = true;
        next.calledAt = nowIso;
        next.calledBy = session.user;
        next.scheduledAt = updates.callOutcome === 'scheduled' ? nowIso : null;

        const teleActor = buildActorFromSession(session, 'telemarketing', 'Telemarketing');
        const teleToState = updates.callOutcome === 'scheduled' ? 'Agendado' : 'En Reposo';
        postMutationActivity = {
          action: 'telemarketing_called',
          category: 'telemarketing',
          ...teleActor,
          summary: `${teleActor.actorName} marcó a "${next.name}" (${next.claimCode}) como ${teleToState}.`,
          fromState: 'Pendiente',
          toState: teleToState,
          targetType: 'lead',
          targetId: next.id,
          targetLabel: `${next.name} (${next.claimCode})`,
          metadata: {
            callOutcome: next.callOutcome,
            referralCode: next.referralCode ?? null,
            claimCode: next.claimCode,
          },
        };

        if (updates.callOutcome === 'not_scheduled') {
          const reposoEntries = recordSlidingWindowEntry(
            teleReposoTracker,
            session.userId,
            nowMs,
            2 * 60 * 1000,
            nowMs
          );
          if (reposoEntries.length >= 3) {
            postMutationAlerts.push({
              alert: {
                code: 'telemarketing_rapid_reposo',
                severity: 'high',
                category: 'telemarketing',
                title: 'Envío masivo acelerado a En Reposo',
                description: `${session.displayName || session.user} envió ${reposoEntries.length} prospectos a En Reposo en menos de 2 minutos (último: "${next.name}", ${next.claimCode}).`,
                actorRole: 'telemarketing',
                actorName: session.displayName || session.user,
                actorTag: session.tag || null,
                leadId: next.id,
                leadName: next.name,
                claimCode: next.claimCode,
                phoneMasked: maskPhone(next.phone),
                referralCode: next.referralCode,
                ipMasked,
                metadata: {
                  reposoCountIn2m: reposoEntries.length,
                  windowSeconds: 120,
                },
              },
              options: {
                dedupKey: `telemarketing_rapid_reposo:${session.userId}`,
                dedupWindowMs: 60 * 1000,
              },
            });
          }
        } else if (updates.callOutcome === 'scheduled') {
          const schedEntries = recordSlidingWindowEntry(
            teleScheduleTracker,
            session.userId,
            nowMs,
            90 * 1000,
            nowMs
          );
          if (schedEntries.length >= 4) {
            postMutationAlerts.push({
              alert: {
                code: 'telemarketing_rapid_schedule',
                severity: 'medium',
                category: 'telemarketing',
                title: 'Agendamiento masivo inusualmente rápido',
                description: `${session.displayName || session.user} marcó ${schedEntries.length} prospectos como Agendados en menos de 90 segundos (último: "${next.name}", ${next.claimCode}).`,
                actorRole: 'telemarketing',
                actorName: session.displayName || session.user,
                actorTag: session.tag || null,
                leadId: next.id,
                leadName: next.name,
                claimCode: next.claimCode,
                phoneMasked: maskPhone(next.phone),
                referralCode: next.referralCode,
                ipMasked,
                metadata: {
                  scheduledCountIn90s: schedEntries.length,
                  windowSeconds: 90,
                },
              },
              options: {
                dedupKey: `telemarketing_rapid_schedule:${session.userId}`,
                dedupWindowMs: 60 * 1000,
              },
            });
          }
        }
      } else if (role === 'vendedor') {
        const sessionTag = normalizeReferralCode(session.tag);
        const allReferrers = Array.isArray(store.referrers)
          ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
          : [];
        const linkedReferrer =
          allReferrers.find(
            (r) =>
              r.partnerType !== 'embajador' &&
              (r.accountId === session.userId || (sessionTag && r.code === sessionTag))
          ) || null;

        if (!leadBelongsToVendedor(current, session, linkedReferrer, allReferrers)) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó acceder a prospecto de otro vendedor',
              description: `${session.displayName || session.user} (${session.tag || 'sin tag'}) intentó modificar el prospecto "${current.name}" (${current.claimCode}), asignado a ${current.referralCode || 'otro canal'}.`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              leadId: current.id,
              leadName: current.name,
              claimCode: current.claimCode,
              phoneMasked: maskPhone(current.phone),
              referralCode: current.referralCode,
              ipMasked,
              metadata: {
                reason: 'vendedor_cross_seller_access',
                targetReferralCode: current.referralCode ?? null,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Acceso denegado. Solo puedes gestionar prospectos asignados a tu cuenta o a tus embajadores.',
          });
        }

        const allowedKeys = new Set(['category', 'orderAmount', 'notes', 'confirmLock', 'adminPassword']);
        const providedKeys = Object.keys(updates).filter((k) => updates[k] !== undefined);
        const hasForbidden = providedKeys.some((k) => !allowedKeys.has(k));
        if (hasForbidden) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó editar campos restringidos',
              description: `${session.displayName || session.user} envió campos no permitidos en "${current.name}" (${current.claimCode}).`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              leadId: current.id,
              leadName: current.name,
              claimCode: current.claimCode,
              phoneMasked: maskPhone(current.phone),
              referralCode: current.referralCode,
              ipMasked,
              metadata: {
                reason: 'vendedor_forbidden_fields',
                forbiddenFields: providedKeys.filter((k) => !allowedKeys.has(k)).join(','),
                requestedCategory: typeof updates.category === 'string' ? updates.category : null,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Acceso denegado. El vendedor solo puede actualizar categoría (cita, demo u orden), monto y notas.',
          });
        }

        if (current.callOutcome === 'not_scheduled') {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó clasificar prospecto en Reposo',
              description: `${session.displayName || session.user} intentó clasificar "${current.name}" (${current.claimCode}) cuyo estado de llamada es "not_scheduled" (En Reposo).`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              leadId: current.id,
              leadName: current.name,
              claimCode: current.claimCode,
              phoneMasked: maskPhone(current.phone),
              referralCode: current.referralCode,
              ipMasked,
              metadata: {
                reason: 'vendedor_unscheduled_lead_attempt',
                callOutcome: current.callOutcome,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(409).json({
            error: 'Este prospecto se encuentra en Reposo. Solo un administrador puede reactivarlo.',
          });
        }

        const hasCategoryUpdate = updates.category !== undefined;
        if (hasCategoryUpdate && !VALID_CATEGORIES.has(updates.category)) {
          return res.status(400).json({
            error: 'Debes elegir un estatus válido: none, cita, demo u orden.',
          });
        }

        const targetCategory = hasCategoryUpdate ? updates.category : current.category;
        const currentRank = CATEGORY_RANK[current.category] ?? 0;
        const targetRank = CATEGORY_RANK[targetCategory] ?? 0;
        const vendActor = buildActorFromSession(session, 'vendedor', 'Vendedor');

        if (targetRank < currentRank) {
          // Downgrade / revert requires valid Admin password
          const candidateAdminPassword =
            typeof updates.adminPassword === 'string' ? updates.adminPassword : '';
          const adminPasswordValid =
            candidateAdminPassword.length > 0 && (await verifyAnyAdminPassword(candidateAdminPassword));
          if (!adminPasswordValid) {
            await recordSecurityAlert(
              {
                code: 'rbac_unauthorized_attempt',
                severity: 'high',
                category: 'access',
                title: 'Vendedor intentó revertir estatus sin contraseña de administrador',
                description: `${session.displayName || session.user} intentó cambiar "${current.name}" (${current.claimCode}) de "${current.category}" a "${targetCategory}" sin autorización válida de administrador.`,
                actorRole: 'vendedor',
                actorName: session.displayName || session.user,
                actorTag: session.tag || null,
                leadId: current.id,
                leadName: current.name,
                claimCode: current.claimCode,
                phoneMasked: maskPhone(current.phone),
                referralCode: current.referralCode,
                ipMasked,
                metadata: {
                  reason: 'vendedor_locked_lead_attempt',
                  currentCategory: current.category,
                  requestedCategory: targetCategory,
                },
              },
              { store: USE_SUPABASE ? undefined : store }
            );
            return res.status(403).json({
              error:
                'Se requiere una contraseña de administrador válida para retroceder o revertir el estatus del prospecto.',
              code: 'ADMIN_PASSWORD_REQUIRED',
            });
          }

          next.category = targetCategory;
          if (typeof updates.notes === 'string') {
            next.notes = updates.notes;
          }
          if (targetCategory === 'none') {
            next.orderAmount = null;
            next.promoCodeInvalidated = false;
            next.promoCodeInvalidatedAt = null;
            next.sellerLocked = false;
            next.sellerConfirmedAt = null;
            next.sellerConfirmedBy = null;
          } else {
            next.orderAmount = null;
            next.promoCodeInvalidated = true;
            next.promoCodeInvalidatedAt = current.promoCodeInvalidatedAt || nowIso;
            next.sellerLocked = true;
            next.sellerConfirmedAt = nowIso;
            next.sellerConfirmedBy = session.user;
          }

          const vendFromState = formatLeadCategoryLabel(current.category);
          const vendToState = formatLeadCategoryLabel(next.category);
          postMutationActivity = {
            action: 'lead_status_reverted',
            category: 'status',
            ...vendActor,
            summary: `${vendActor.actorName}${vendActor.actorTag ? ` (${vendActor.actorTag})` : ''} revirtió a "${next.name}" (${next.claimCode}) de ${vendFromState} a ${vendToState} con autorización de administrador.`,
            fromState: vendFromState,
            toState: vendToState,
            targetType: 'lead',
            targetId: next.id,
            targetLabel: `${next.name} (${next.claimCode})`,
            metadata: {
              fromCategory: current.category,
              toCategory: next.category,
              authorizedByAdminPassword: true,
              referralCode: next.referralCode ?? null,
              claimCode: next.claimCode,
            },
          };
          postMutationAlerts.push({
            alert: {
              code: 'admin_audit_event',
              severity: 'medium',
              category: 'audit',
              title: 'Retroceso de estatus autorizado en vista de vendedor',
              description: `${session.displayName || session.user} revirtió "${next.name}" (${next.claimCode}) de ${current.category} a ${next.category} mediante clave de administrador.`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              leadId: next.id,
              leadName: next.name,
              claimCode: next.claimCode,
              phoneMasked: maskPhone(next.phone),
              referralCode: next.referralCode,
              ipMasked,
              metadata: {
                action: 'vendedor_downgrade_authorized',
                previousCategory: current.category,
                nextCategory: next.category,
              },
            },
          });
        } else if (targetRank > currentRank) {
          if (updates.confirmLock === false) {
            return res.status(400).json({
              error: 'Debes confirmar el avance del estatus del prospecto.',
            });
          }

          if (current.callOutcome === 'pending') {
            next.called = true;
            next.callOutcome = 'scheduled';
            next.calledAt = nowIso;
            next.calledBy = session.displayName || session.user;
            next.scheduledAt = nowIso;
          }

          next.category = targetCategory;
          if (typeof updates.notes === 'string') {
            next.notes = updates.notes;
          }
          const rawSubmittedOrderAmount =
            updates.orderAmount !== undefined && updates.orderAmount !== null && updates.orderAmount !== ''
              ? Number(updates.orderAmount)
              : null;
          if (targetCategory === 'orden') {
            const parsedAmount =
              typeof updates.orderAmount === 'number' &&
              Number.isFinite(updates.orderAmount) &&
              updates.orderAmount > 0
                ? updates.orderAmount
                : store.settings.defaultTicketAmount;
            next.orderAmount = parsedAmount;
          } else {
            next.orderAmount = null;
          }
          next.promoCodeInvalidated = true;
          next.promoCodeInvalidatedAt = current.promoCodeInvalidatedAt || nowIso;
          next.sellerLocked = true;
          next.sellerConfirmedAt = nowIso;
          next.sellerConfirmedBy = session.user;

          const vendFromState = formatLeadCategoryLabel(current.category);
          const vendToState = formatLeadCategoryLabel(next.category);
          postMutationActivity = {
            action: 'lead_status_advanced',
            category: 'status',
            ...vendActor,
            summary: `${vendActor.actorName}${vendActor.actorTag ? ` (${vendActor.actorTag})` : ''} avanzó a "${next.name}" (${next.claimCode}) de ${vendFromState} a ${vendToState}${next.category === 'orden' && next.orderAmount != null ? ` por $${next.orderAmount}` : ''}.`,
            fromState: vendFromState,
            toState: vendToState,
            targetType: 'lead',
            targetId: next.id,
            targetLabel: `${next.name} (${next.claimCode})`,
            metadata: {
              fromCategory: current.category,
              toCategory: next.category,
              orderAmount: next.orderAmount ?? null,
              referralCode: next.referralCode ?? null,
              claimCode: next.claimCode,
            },
          };

          // Fraud Rule: vendedor_fast_close (< 10 min after scheduledAt or createdAt for demo/orden)
          if (targetCategory === 'demo' || targetCategory === 'orden') {
            const refTimestampStr = current.scheduledAt || current.createdAt;
            const refMs = refTimestampStr ? Date.parse(refTimestampStr) : NaN;
            if (Number.isFinite(refMs)) {
              const elapsedMs = nowMs - refMs;
              if (elapsedMs < 10 * 60 * 1000) {
                const elapsedSecs = Math.max(0, Math.round(elapsedMs / 1000));
                postMutationAlerts.push({
                  alert: {
                    code: 'vendedor_fast_close',
                    severity: 'critical',
                    category: 'vendedor',
                    title: `Cierre sospechosamente rápido de ${targetCategory.toUpperCase()} (< 10 min)`,
                    description: `${session.displayName || session.user} (${session.tag || 'sin tag'}) confirmó "${targetCategory}" para "${next.name}" (${next.claimCode}) apenas ${elapsedSecs}s después de ser agendado.`,
                    actorRole: 'vendedor',
                    actorName: session.displayName || session.user,
                    actorTag: session.tag || null,
                    leadId: next.id,
                    leadName: next.name,
                    claimCode: next.claimCode,
                    phoneMasked: maskPhone(next.phone),
                    referralCode: next.referralCode,
                    ipMasked,
                    metadata: {
                      category: next.category,
                      elapsedSeconds: elapsedSecs,
                      orderAmount: next.orderAmount ?? null,
                    },
                  },
                });
              }
            }
          }

          // Fraud Rule: vendedor_order_burst (>= 2 orden or >= 3 classifications in 15m, OR orden with orderAmount < 100)
          const isLowOrderAmount =
            targetCategory === 'orden' &&
            rawSubmittedOrderAmount !== null &&
            Number.isFinite(rawSubmittedOrderAmount) &&
            rawSubmittedOrderAmount < 100;
          const sellerEntries = recordSlidingWindowEntry(
            vendedorActivityTracker,
            session.userId,
            { ts: nowMs, category: next.category, leadId: next.id },
            15 * 60 * 1000,
            nowMs
          );
          const ordersIn15m = sellerEntries.filter((e) => e.category === 'orden').length;
          const classificationsIn15m = sellerEntries.length;
          if (isLowOrderAmount || ordersIn15m >= 2 || classificationsIn15m >= 3) {
            const reasonParts = [];
            if (isLowOrderAmount) {
              reasonParts.push(`monto de orden inusualmente bajo ($${rawSubmittedOrderAmount})`);
            }
            if (ordersIn15m >= 2) {
              reasonParts.push(`${ordersIn15m} órdenes cerradas en 15 min`);
            }
            if (classificationsIn15m >= 3) {
              reasonParts.push(`${classificationsIn15m} clasificaciones confirmadas en 15 min`);
            }
            postMutationAlerts.push({
              alert: {
                code: 'vendedor_order_burst',
                severity: 'high',
                category: 'vendedor',
                title: isLowOrderAmount
                  ? 'Orden con monto sospechosamente bajo (< $100)'
                  : 'Ráfaga anómala de cierres de vendedor (15 min)',
                description: `${session.displayName || session.user} (${session.tag || 'sin tag'}) activó alerta en "${next.name}" (${next.claimCode}): ${reasonParts.join('; ')}.`,
                actorRole: 'vendedor',
                actorName: session.displayName || session.user,
                actorTag: session.tag || null,
                leadId: next.id,
                leadName: next.name,
                claimCode: next.claimCode,
                phoneMasked: maskPhone(next.phone),
                referralCode: next.referralCode,
                ipMasked,
                metadata: {
                  category: next.category,
                  ordersIn15m,
                  classificationsIn15m,
                  submittedOrderAmount: rawSubmittedOrderAmount,
                  lowAmountFlag: isLowOrderAmount,
                },
              },
            });
          }
        } else {
          // targetRank === currentRank: allow cleanly editing notes / orderAmount
          if (current.callOutcome === 'pending') {
            next.called = true;
            next.callOutcome = 'scheduled';
            next.calledAt = nowIso;
            next.calledBy = session.displayName || session.user;
            next.scheduledAt = nowIso;
          }
          if (typeof updates.notes === 'string') {
            next.notes = updates.notes;
          }
          if (next.category === 'orden' && updates.orderAmount !== undefined) {
            const parsedAmount = Number(updates.orderAmount);
            if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
              next.orderAmount = parsedAmount;
            }
          }
          postMutationActivity = {
            action: 'lead_updated',
            category: 'leads',
            ...vendActor,
            summary: `${vendActor.actorName}${vendActor.actorTag ? ` (${vendActor.actorTag})` : ''} actualizó notas o monto de "${next.name}" (${next.claimCode}).`,
            fromState: formatLeadCategoryLabel(current.category),
            toState: formatLeadCategoryLabel(next.category),
            targetType: 'lead',
            targetId: next.id,
            targetLabel: `${next.name} (${next.claimCode})`,
            metadata: {
              category: next.category,
              orderAmount: next.orderAmount ?? null,
              referralCode: next.referralCode ?? null,
              claimCode: next.claimCode,
            },
          };
        }
      } else if (role === 'admin') {
        const currentCategory = current.category;
        const currentInvalidated = Boolean(current.promoCodeInvalidated);
        const currentLocked = Boolean(current.sellerLocked);

        const hasCategoryUpdate =
          typeof updates.category === 'string' && VALID_CATEGORIES.has(updates.category);
        const requestedCategory = hasCategoryUpdate ? updates.category : currentCategory;
        const explicitUninvalidate = updates.promoCodeInvalidated === false;
        const explicitUnlock = updates.sellerLocked === false;
        const explicitCalledFalse = updates.called === false || updates.callOutcome === 'pending';
        const isNotScheduledRevert = updates.callOutcome === 'not_scheduled';
        const effectiveTargetCategory =
          explicitUninvalidate || explicitUnlock || explicitCalledFalse || isNotScheduledRevert
            ? 'none'
            : requestedCategory;

        const isExistingProtected =
          currentCategory !== 'none' || currentInvalidated || currentLocked;
        const isCategoryDowngradeOrRevert =
          CATEGORY_RANK[effectiveTargetCategory] < CATEGORY_RANK[currentCategory];
        const isForwardCategoryAdvance =
          hasCategoryUpdate &&
          CATEGORY_RANK[effectiveTargetCategory] > CATEGORY_RANK[currentCategory] &&
          !explicitUninvalidate &&
          !explicitUnlock &&
          !explicitCalledFalse &&
          !isNotScheduledRevert;
        const requiresAdminPassword =
          isExistingProtected &&
          !isForwardCategoryAdvance &&
          (isCategoryDowngradeOrRevert ||
            explicitUninvalidate ||
            explicitUnlock ||
            explicitCalledFalse ||
            isNotScheduledRevert);

        if (requiresAdminPassword) {
          const candidatePassword =
            typeof updates.adminPassword === 'string' ? updates.adminPassword : '';
          if (!candidatePassword) {
            return res.status(403).json({
              error:
                'Se requiere tu contraseña de administrador para revertir, desbloquear o degradar la categoría del prospecto.',
              code: 'ADMIN_PASSWORD_REQUIRED',
            });
          }
          const loggedInAdmin =
            accounts.find(
              (a) => a.id === session.userId && a.role === 'admin' && a.active !== false
            ) ||
            accounts.find(
              (a) =>
                a.role === 'admin' &&
                a.active !== false &&
                a.username.toLowerCase() === String(session.username || session.user || '').toLowerCase()
            ) ||
            null;
          let passwordOk = false;
          if (loggedInAdmin) {
            passwordOk = await verifyStoredSecret(
              candidatePassword,
              loggedInAdmin.passwordHash,
              loggedInAdmin.passwordSalt
            );
          }
          if (!passwordOk) {
            return res.status(403).json({
              error:
                'Contraseña de administrador incorrecta. No se modificó la categoría ni el bloqueo del prospecto.',
              code: 'ADMIN_PASSWORD_REQUIRED',
            });
          }
        }

        if (typeof updates.name === 'string' && updates.name.trim()) {
          next.name = updates.name.trim();
        }
        if (typeof updates.phone === 'string' && updates.phone.trim()) {
          const nextPhoneTrimmed = updates.phone.trim();
          const nextPhoneKey = normalizePhoneKey(nextPhoneTrimmed);
          if (nextPhoneKey.length < 7) {
            return res.status(400).json({ error: 'Ingresa un número de teléfono válido.' });
          }
          const phoneOwner = (store.leads || []).find(
            (item) => item.id !== id && normalizePhoneKey(item.phone) === nextPhoneKey
          );
          if (phoneOwner) {
            await recordSecurityAlert(
              {
                code: 'duplicate_phone_attempt',
                severity: 'high',
                category: 'qr_abuse',
                title: 'Intento bloqueado de asignar teléfono duplicado al editar prospecto',
                description: `${session.displayName || session.user} intentó cambiar el teléfono de "${current.name}" (${current.claimCode}) al número ${maskPhone(nextPhoneTrimmed) || '***'}, que ya pertenece a "${phoneOwner.name}" (${phoneOwner.claimCode}).`,
                actorRole: 'admin',
                actorName: session.displayName || session.user,
                actorTag: session.tag || null,
                leadId: current.id,
                leadName: current.name,
                claimCode: current.claimCode,
                phoneMasked: maskPhone(nextPhoneTrimmed),
                referralCode: current.referralCode,
                ipMasked,
                metadata: {
                  existingLeadId: phoneOwner.id,
                  existingLeadName: phoneOwner.name,
                  existingClaimCode: phoneOwner.claimCode,
                  attemptedOnLeadId: current.id,
                  phoneKeyHash: hashPhoneKey(nextPhoneKey),
                },
              },
              { store: USE_SUPABASE ? undefined : store }
            );
            return res.status(409).json({
              error: 'Este número de teléfono ya está registrado. Solo se permite un registro por número.',
              code: 'DUPLICATE_PHONE',
            });
          }
          next.phone = nextPhoneTrimmed;
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

        if (typeof updates.callOutcome === 'string' && VALID_CALL_OUTCOMES.has(updates.callOutcome)) {
          next.callOutcome = updates.callOutcome;
          if (updates.callOutcome === 'pending') {
            next.called = false;
            next.calledAt = null;
            next.calledBy = null;
            next.scheduledAt = null;
            next.category = 'none';
            next.orderAmount = null;
            next.promoCodeInvalidated = false;
            next.promoCodeInvalidatedAt = null;
            next.sellerLocked = false;
            next.sellerConfirmedAt = null;
            next.sellerConfirmedBy = null;
          } else if (updates.callOutcome === 'scheduled') {
            next.called = true;
            next.calledAt = updates.calledAt || current.calledAt || nowIso;
            next.calledBy = current.calledBy || session.user;
            next.scheduledAt = updates.scheduledAt || current.scheduledAt || nowIso;
          } else if (updates.callOutcome === 'not_scheduled') {
            next.called = true;
            next.calledAt = updates.calledAt || current.calledAt || nowIso;
            next.calledBy = current.calledBy || session.user;
            next.scheduledAt = null;
            if (current.sellerLocked || current.category !== 'none') {
              next.category = 'none';
              next.orderAmount = null;
              next.promoCodeInvalidated = false;
              next.promoCodeInvalidatedAt = null;
              next.sellerLocked = false;
              next.sellerConfirmedAt = null;
              next.sellerConfirmedBy = null;
            }
          }
        } else if (typeof updates.called === 'boolean') {
          next.called = updates.called;
          next.calledAt = updates.called ? updates.calledAt || nowIso : null;
          if (updates.called) {
            if (next.callOutcome === 'pending') {
              next.callOutcome = 'scheduled';
              next.scheduledAt = next.calledAt;
              next.calledBy = current.calledBy || session.user;
            }
          } else {
            next.callOutcome = 'pending';
            next.calledBy = null;
            next.scheduledAt = null;
            next.category = 'none';
            next.orderAmount = null;
            next.promoCodeInvalidated = false;
            next.promoCodeInvalidatedAt = null;
            next.sellerLocked = false;
            next.sellerConfirmedAt = null;
            next.sellerConfirmedBy = null;
          }
        }

        if (
          updates.promoCodeInvalidated === false ||
          updates.sellerLocked === false ||
          updates.category === 'none'
        ) {
          next.category = 'none';
          next.orderAmount = null;
          next.promoCodeInvalidated = false;
          next.promoCodeInvalidatedAt = null;
          next.sellerLocked = false;
          next.sellerConfirmedAt = null;
          next.sellerConfirmedBy = null;
        } else if (typeof updates.category === 'string' && VALID_CATEGORIES.has(updates.category)) {
          if (updates.category !== 'none' && !next.called) {
            return res
              .status(400)
              .json({ error: 'Debes marcar al prospecto como llamado antes de clasificarlo.' });
          }
          next.category = updates.category;
          next.promoCodeInvalidated = true;
          next.promoCodeInvalidatedAt = current.promoCodeInvalidatedAt || nowIso;
          next.sellerLocked = true;
          next.sellerConfirmedAt = nowIso;
          next.sellerConfirmedBy = session.user;
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

        if (requiresAdminPassword) {
          postMutationAlerts.push({
            alert: {
              code: 'admin_audit_event',
              severity: 'medium',
              category: 'audit',
              title: 'Administrador revirtió o desbloqueó prospecto protegido',
              description: `${session.displayName || session.user} modificó el estado protegido de "${next.name}" (${next.claimCode}): categoría ${currentCategory} -> ${next.category}, bloqueo ${currentLocked ? 'sí' : 'no'} -> ${next.sellerLocked ? 'sí' : 'no'}.`,
              actorRole: 'admin',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              leadId: next.id,
              leadName: next.name,
              claimCode: next.claimCode,
              phoneMasked: maskPhone(next.phone),
              referralCode: next.referralCode,
              ipMasked,
              metadata: {
                action: 'lead_revert_or_unlock',
                previousCategory: currentCategory,
                nextCategory: next.category,
                previousLocked: currentLocked,
                nextLocked: Boolean(next.sellerLocked),
                previousInvalidated: currentInvalidated,
                nextInvalidated: Boolean(next.promoCodeInvalidated),
              },
            },
          });
        }

        const adminActor = buildActorFromSession(session, 'admin', 'Administrador');
        const prevRank = CATEGORY_RANK[currentCategory] ?? 0;
        const nextRank = CATEGORY_RANK[next.category] ?? 0;
        if (nextRank > prevRank) {
          const fromLabel = formatLeadCategoryLabel(currentCategory);
          const toLabel = formatLeadCategoryLabel(next.category);
          postMutationActivity = {
            action: 'lead_status_advanced',
            category: 'status',
            ...adminActor,
            summary: `${adminActor.actorName} avanzó a "${next.name}" (${next.claimCode}) de ${fromLabel} a ${toLabel}${next.category === 'orden' && next.orderAmount != null ? ` por $${next.orderAmount}` : ''}.`,
            fromState: fromLabel,
            toState: toLabel,
            targetType: 'lead',
            targetId: next.id,
            targetLabel: `${next.name} (${next.claimCode})`,
            metadata: {
              fromCategory: currentCategory,
              toCategory: next.category,
              orderAmount: next.orderAmount ?? null,
              referralCode: next.referralCode ?? null,
              claimCode: next.claimCode,
            },
          };
        } else if (
          nextRank < prevRank ||
          (currentLocked && !next.sellerLocked) ||
          (currentInvalidated && !next.promoCodeInvalidated)
        ) {
          const fromLabel = formatLeadCategoryLabel(currentCategory);
          const toLabel = formatLeadCategoryLabel(next.category);
          postMutationActivity = {
            action: 'lead_status_reverted',
            category: 'status',
            ...adminActor,
            summary: `${adminActor.actorName} revirtió el estatus de "${next.name}" (${next.claimCode}) de ${fromLabel} a ${toLabel}${currentLocked && !next.sellerLocked ? ' (desbloqueado)' : ''}.`,
            fromState: fromLabel,
            toState: toLabel,
            targetType: 'lead',
            targetId: next.id,
            targetLabel: `${next.name} (${next.claimCode})`,
            metadata: {
              fromCategory: currentCategory,
              toCategory: next.category,
              previousLocked: currentLocked,
              nextLocked: Boolean(next.sellerLocked),
              referralCode: next.referralCode ?? null,
              claimCode: next.claimCode,
            },
          };
        } else {
          const callChanged = current.callOutcome !== next.callOutcome;
          const fromCall = callChanged ? formatCallOutcomeLabel(current.callOutcome) : null;
          const toCall = callChanged ? formatCallOutcomeLabel(next.callOutcome) : null;
          postMutationActivity = {
            action: 'lead_updated',
            category: 'leads',
            ...adminActor,
            summary: callChanged
              ? `${adminActor.actorName} cambió el estado de llamada de "${next.name}" (${next.claimCode}) de ${fromCall} a ${toCall}.`
              : `${adminActor.actorName} actualizó los datos del prospecto "${next.name}" (${next.claimCode}).`,
            fromState: fromCall,
            toState: toCall,
            targetType: 'lead',
            targetId: next.id,
            targetLabel: `${next.name} (${next.claimCode})`,
            metadata: {
              callOutcome: next.callOutcome,
              category: next.category,
              orderAmount: next.orderAmount ?? null,
              claimCode: next.claimCode,
            },
          };
        }
      }

      // Public + Admin fields (gift & qualification) — blocked for telemarketing/vendedor above
      if (!role || role === 'admin') {
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
          next.qualification = sanitizeQualification(updates.qualification);
        }
      }

      const responseLead =
        role === 'admin' || role === 'vendedor'
          ? next
          : role === 'telemarketing'
            ? {
                id: next.id,
                name: next.name,
                phone: next.phone,
                address: next.address || '',
                claimCode: next.claimCode,
                referralCode: next.referralCode ?? null,
                referrerId: next.referrerId ?? null,
                referrerName: next.referrerName ?? null,
                createdAt: next.createdAt,
                giftName: next.giftName ?? null,
                callOutcome: next.callOutcome,
              }
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
        memoryLeadWorkflowStates.set(id, {
          callOutcome: next.callOutcome,
          calledAt: next.calledAt,
          calledBy: next.calledBy ?? null,
          scheduledAt: next.scheduledAt ?? null,
          sellerLocked: Boolean(next.sellerLocked),
          sellerConfirmedAt: next.sellerConfirmedAt ?? null,
          sellerConfirmedBy: next.sellerConfirmedBy ?? null,
        });
        saveSupabaseOverlay();
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
          call_outcome: next.callOutcome,
          called_by: next.calledBy ?? null,
          scheduled_at: next.scheduledAt ?? null,
          category: next.category,
          order_amount: next.orderAmount,
          qualification: next.qualification,
          promo_code_invalidated: Boolean(next.promoCodeInvalidated),
          promo_code_invalidated_at: next.promoCodeInvalidatedAt ?? null,
          seller_locked: Boolean(next.sellerLocked),
          seller_confirmed_at: next.sellerConfirmedAt ?? null,
          seller_confirmed_by: next.sellerConfirmedBy ?? null,
        };
        await supabaseWriteWithOptionalColumns(
          `leads?id=eq.${encodeURIComponent(id)}`,
          'PATCH',
          { Prefer: 'return=minimal' },
          patchBody,
          [
            'promo_code_invalidated',
            'promo_code_invalidated_at',
            'call_outcome',
            'called_by',
            'scheduled_at',
            'seller_locked',
            'seller_confirmed_at',
            'seller_confirmed_by',
          ]
        );
        for (const item of postMutationAlerts) {
          await recordSecurityAlert(item.alert, item.options || {});
        }
        if (postMutationActivity) {
          await recordActivityLog(postMutationActivity);
        }
        const updatedStore = await getActiveStore();
        return res.json({
          lead: responseLead,
          state: isAuthed
            ? sanitizeStateForClient(updatedStore, session, role, accounts)
            : { ...sanitizeStateForClient(updatedStore, null, null), leads: [responseLead] },
        });
      }

      store.leads[index] = next;
      for (const item of postMutationAlerts) {
        await recordSecurityAlert(item.alert, { ...(item.options || {}), store });
      }
      if (postMutationActivity) {
        await recordActivityLog(postMutationActivity, { store });
      }
      writeStore(store);

      return res.json({
        lead: responseLead,
        state: isAuthed
          ? sanitizeStateForClient(store, session, role, accounts)
          : { ...sanitizeStateForClient(store, null, null), leads: [responseLead] },
      });
    } catch (err) {
      logServerError('PATCH /api/leads/:id', err);
      return res.status(503).json({ error: 'No se pudo actualizar el prospecto.' });
    }
  });
});

app.delete('/api/leads/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const targetLead = store.leads.find((item) => item.id === id);
      if (!targetLead) {
        return res.status(404).json({ error: 'Prospecto no encontrado.' });
      }

      const deleteAuditAlert = {
        code: 'admin_audit_event',
        severity: 'medium',
        category: 'audit',
        title: 'Prospecto eliminado por administrador',
        description: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} eliminó el prospecto "${targetLead.name}" (${targetLead.claimCode || targetLead.id}).`,
        actorRole: 'admin',
        actorName: req.dsbSession?.displayName || req.dsbSession?.user || 'Admin',
        actorTag: req.dsbSession?.tag || null,
        leadId: targetLead.id,
        leadName: targetLead.name,
        claimCode: targetLead.claimCode || null,
        phoneMasked: maskPhone(targetLead.phone),
        referralCode: targetLead.referralCode || null,
        ipMasked: maskIp(getClientIp(req)),
        metadata: {
          action: 'lead_deleted',
          category: targetLead.category || 'none',
        },
      };

      const deleteActivity = {
        action: 'lead_deleted',
        category: 'leads',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} eliminó el prospecto "${targetLead.name}" (${targetLead.claimCode || targetLead.id}).`,
        fromState: formatLeadCategoryLabel(targetLead.category),
        toState: 'Eliminado',
        targetType: 'lead',
        targetId: targetLead.id,
        targetLabel: `${targetLead.name} (${targetLead.claimCode || targetLead.id})`,
        metadata: {
          claimCode: targetLead.claimCode || null,
          category: targetLead.category || 'none',
          referralCode: targetLead.referralCode || null,
        },
      };

      if (USE_SUPABASE) {
        await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        memoryLeadPromoStates.delete(id);
        memoryLeadWorkflowStates.delete(id);
        saveSupabaseOverlay();
        await recordSecurityAlert(deleteAuditAlert);
        await recordActivityLog(deleteActivity);
        const updatedStore = await getActiveStore();
        return res.json({ state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts) });
      }

      store.leads = store.leads.filter((item) => item.id !== id);
      await recordSecurityAlert(deleteAuditAlert, { store });
      await recordActivityLog(deleteActivity, { store });
      writeStore(store);
      return res.json({ state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts) });
    } catch (err) {
      logServerError('DELETE /api/leads/:id', err);
      return res.status(503).json({ error: 'No se pudo eliminar el prospecto.' });
    }
  });
});

app.post('/api/gifts', requireAdminRole, async (req, res) => {
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  const { name, subtitle, usageTip, tag, visualKey, customImageUrl, accentColor, active, stockLabel, probability } =
    req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del regalo es obligatorio.' });
  }

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
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

      const giftCreateActivity = {
        action: 'gift_changed',
        category: 'catalog',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} agregó el obsequio "${newGift.name}" al catálogo.`,
        fromState: null,
        toState: 'Creado',
        targetType: 'gift',
        targetId: newGift.id,
        targetLabel: newGift.name,
        metadata: {
          operation: 'created',
          probability: newGift.probability,
        },
      };

      if (USE_SUPABASE) {
        memoryGiftUsageTips.set(newGift.id, newGift.usageTip);
        memoryGiftProbabilities.set(newGift.id, newGift.probability);
        saveSupabaseOverlay();
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
        await recordActivityLog(giftCreateActivity);
        const updatedStore = await getActiveStore();
        return res.status(201).json({ gift: newGift, state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts) });
      }

      store.gifts.push(newGift);
      await recordActivityLog(giftCreateActivity, { store });
      writeStore(store);
      return res.status(201).json({ gift: newGift, state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts) });
    } catch (err) {
      logServerError('POST /api/gifts', err);
      return res.status(503).json({ error: 'No se pudo crear el regalo.' });
    }
  });
});

app.patch('/api/gifts/probabilities', requireAdminRole, async (req, res) => {
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
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
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
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

      const probsActivity = {
        action: 'gift_changed',
        category: 'catalog',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} actualizó las probabilidades de ${updatedItems.length} obsequio(s).`,
        fromState: null,
        toState: 'Probabilidades actualizadas',
        targetType: 'gift',
        targetId: null,
        targetLabel: 'Probabilidades de obsequios',
        metadata: {
          operation: 'probabilities',
          updatedCount: updatedItems.length,
        },
      };

      if (USE_SUPABASE) {
        for (const item of updatedItems) {
          memoryGiftProbabilities.set(item.id, item.probability);
        }
        saveSupabaseOverlay();
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
        await recordActivityLog(probsActivity);
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts);
        return res.json({ gifts: sanitized.gifts, state: sanitized });
      }

      store.gifts = nextGifts;
      await recordActivityLog(probsActivity, { store });
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, req.dsbSession, 'admin', accounts);
      return res.json({ gifts: sanitized.gifts, state: sanitized });
    } catch (err) {
      logServerError('PATCH /api/gifts/probabilities', err);
      return res.status(503).json({ error: 'No se pudieron actualizar las probabilidades.' });
    }
  });
});

app.patch('/api/gifts/:id', requireAdminRole, async (req, res) => {
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  const { id } = req.params;
  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
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

      const giftUpdateActivity = {
        action: 'gift_changed',
        category: 'catalog',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} actualizó el obsequio "${nextGift.name}".`,
        fromState: current.active ? 'Activo' : 'Inactivo',
        toState: nextGift.active ? 'Activo' : 'Inactivo',
        targetType: 'gift',
        targetId: nextGift.id,
        targetLabel: nextGift.name,
        metadata: {
          operation: 'updated',
          probability: nextGift.probability,
          active: Boolean(nextGift.active),
        },
      };

      if (USE_SUPABASE) {
        memoryGiftUsageTips.set(id, nextGift.usageTip);
        memoryGiftProbabilities.set(id, nextGift.probability);
        saveSupabaseOverlay();
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
        await recordActivityLog(giftUpdateActivity);
        const updatedStore = await getActiveStore();
        return res.json({ gift: nextGift, state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts) });
      }

      store.gifts[index] = nextGift;
      await recordActivityLog(giftUpdateActivity, { store });
      writeStore(store);
      return res.json({ gift: nextGift, state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts) });
    } catch (err) {
      logServerError('PATCH /api/gifts/:id', err);
      return res.status(503).json({ error: 'No se pudo actualizar el regalo.' });
    }
  });
});

app.delete('/api/gifts/:id', requireAdminRole, async (req, res) => {
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  const { id } = req.params;
  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const target = store.gifts.find((g) => g.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Regalo no encontrado.' });
      }
      const remaining = store.gifts.filter((g) => g.id !== id);
      if (remaining.filter((g) => g.active).length < 1) {
        return res.status(400).json({ error: 'Debe quedar al menos un regalo activo en el catálogo.' });
      }

      const giftDeleteActivity = {
        action: 'gift_changed',
        category: 'catalog',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} eliminó el obsequio "${target.name}" del catálogo.`,
        fromState: 'Activo',
        toState: 'Eliminado',
        targetType: 'gift',
        targetId: target.id,
        targetLabel: target.name,
        metadata: {
          operation: 'deleted',
        },
      };

      if (USE_SUPABASE) {
        await supabaseRest(`gifts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        memoryGiftUsageTips.delete(id);
        memoryGiftProbabilities.delete(id);
        saveSupabaseOverlay();
        await recordActivityLog(giftDeleteActivity);
        const updatedStore = await getActiveStore();
        return res.json({ state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts) });
      }

      store.gifts = remaining;
      await recordActivityLog(giftDeleteActivity, { store });
      writeStore(store);
      return res.json({ state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts) });
    } catch (err) {
      logServerError('DELETE /api/gifts/:id', err);
      return res.status(503).json({ error: 'No se pudo eliminar el regalo.' });
    }
  });
});

app.post('/api/gifts/reset', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  return withStoreMutationLock(async () => {
    try {
      const defaults = readDefaultStore();
      const accounts = await fetchAllAuthAccounts();

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
        saveSupabaseOverlay();
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
        await recordActivityLog({
          action: 'gift_changed',
          category: 'catalog',
          ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
          summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} restauró el catálogo predeterminado de obsequios.`,
          fromState: null,
          toState: 'Restaurado',
          targetType: 'gift',
          targetId: null,
          targetLabel: 'Catálogo predeterminado',
          metadata: { operation: 'reset' },
        });
        const updatedStore = await getActiveStore();
        return res.json({ state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts) });
      }

      const store = ensureStore();
      store.gifts = defaults.gifts;
      await recordActivityLog(
        {
          action: 'gift_changed',
          category: 'catalog',
          ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
          summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} restauró el catálogo predeterminado de obsequios.`,
          fromState: null,
          toState: 'Restaurado',
          targetType: 'gift',
          targetId: null,
          targetLabel: 'Catálogo predeterminado',
          metadata: { operation: 'reset' },
        },
        { store }
      );
      writeStore(store);
      return res.json({ state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts) });
    } catch (err) {
      logServerError('POST /api/gifts/reset', err);
      return res.status(503).json({ error: 'No se pudo restaurar el catálogo predeterminado.' });
    }
  });
});

app.patch('/api/settings', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
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

      const settingsActivity = {
        action: 'settings_updated',
        category: 'system',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} actualizó la configuración general de la campaña.`,
        fromState: null,
        toState: 'Configuración guardada',
        targetType: 'settings',
        targetId: 'default',
        targetLabel: 'Configuración general',
        metadata: {
          showcaseStyle: nextSettings.showcaseStyle,
          randomizeGifts: Boolean(nextSettings.randomizeGifts),
          defaultTicketAmount: nextSettings.defaultTicketAmount,
        },
      };

      if (USE_SUPABASE) {
        memorySettingsFallback.showcaseStyle = nextSettings.showcaseStyle;
        memorySettingsFallback.randomizeGifts = nextSettings.randomizeGifts;
        memorySettingsFallback.referralPrizeRule = nextSettings.referralPrizeRule;
        saveSupabaseOverlay();
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
        await recordActivityLog(settingsActivity);
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts);
        return res.json({ settings: sanitized.settings, state: sanitized });
      }

      store.settings = nextSettings;
      await recordActivityLog(settingsActivity, { store });
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, req.dsbSession, 'admin', accounts);
      return res.json({ settings: sanitized.settings, state: sanitized });
    } catch (err) {
      logServerError('PATCH /api/settings', err);
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

function enforceRefParamOnUrl(rawUrl, tag) {
  const clean = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const isRelative = clean.startsWith('/') && !clean.startsWith('//');
  const parsed = new URL(clean || '/', 'https://placeholder.local');
  const keysToDelete = [];
  for (const key of parsed.searchParams.keys()) {
    const lower = key.toLowerCase();
    if (lower === 'ref' || lower === 'r' || lower === 'tag' || lower === 'qr') {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    parsed.searchParams.delete(key);
  }
  parsed.searchParams.set('ref', tag);
  if (isRelative) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return parsed.toString();
}

async function handleGetQrHistory(req, res) {
  try {
    const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
    const sanitized = sanitizeStateForClient(store, req.dsbSession, 'admin', accounts);
    return res.json({ qrHistory: sanitized.qrHistory });
  } catch (err) {
    logServerError('GET /api/qr', err);
    return res.status(503).json({ error: 'No se pudo consultar el historial de códigos QR.' });
  }
}

async function handleCreateQrCode(req, res) {
  const session = req.dsbSession;
  if (!session || (session.role !== 'admin' && session.role !== 'vendedor')) {
    if (session) {
      await recordSecurityAlert({
        code: 'rbac_unauthorized_attempt',
        severity: 'high',
        category: 'access',
        title: 'Intento no autorizado de creación de código QR',
        description: `${session.displayName || session.user} (${session.role}) intentó crear un código QR sin permisos.`,
        actorRole: session.role,
        actorName: session.displayName || session.user,
        actorTag: session.tag || null,
        ipMasked: maskIp(getClientIp(req)),
        metadata: {
          method: req.method,
          path: String(req.originalUrl || req.path || '').slice(0, 160),
          reason: 'qr_create_role_denied',
        },
      });
    }
    return res.status(403).json({
      error: 'Acceso denegado. Solo administradores y vendedores pueden generar códigos QR.',
    });
  }

  const {
    name,
    targetUrl,
    styleId,
    dotShape,
    foregroundColor,
    backgroundColor,
    includeLogo,
    frameText,
    referrerId,
    accountId,
    referralCode,
  } = req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanTargetUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del código QR debe tener al menos 2 caracteres.' });
  }
  if (!isValidQrTargetUrl(cleanTargetUrl)) {
    return res.status(400).json({ error: 'Ingresa una URL válida que comience con http://, https:// o /.' });
  }

  const cleanAccountId =
    typeof accountId === 'string' && accountId.trim() ? accountId.trim().slice(0, 120) : null;
  const cleanReferrerId =
    typeof referrerId === 'string' && referrerId.trim() ? referrerId.trim().slice(0, 120) : null;
  const cleanReferralCode = normalizeReferralCode(referralCode);

  if (!cleanAccountId && !cleanReferrerId && !cleanReferralCode) {
    return res.status(400).json({
      error: 'Debes seleccionar una cuenta activa de vendedor o un embajador activo para generar el código QR.',
    });
  }

  const cleanFrameText = typeof frameText === 'string' ? frameText.trim().slice(0, 120) : '';
  const validStyleId = VALID_QR_STYLE_IDS.has(styleId) ? styleId : 'classic-gold';

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const referrers = Array.isArray(store.referrers)
        ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
        : [];
      const nowIso = new Date().toISOString();
      const clientIp = getClientIp(req);
      const ipMasked = maskIp(clientIp);

      let matchedEmbajador = null;
      let targetAccount = null;

      if (cleanReferrerId) {
        const refMatch = referrers.find((r) => r.id === cleanReferrerId) || null;
        if (refMatch && refMatch.partnerType === 'embajador') {
          matchedEmbajador = refMatch;
        } else if (refMatch) {
          targetAccount =
            (refMatch.accountId && accounts.find((a) => a.id === refMatch.accountId)) ||
            accounts.find((a) => a.tag.toUpperCase() === refMatch.code.toUpperCase()) ||
            null;
        }
      } else if (cleanAccountId) {
        targetAccount = accounts.find((a) => a.id === cleanAccountId) || null;
      } else if (cleanReferralCode) {
        const refMatch = referrers.find((r) => r.code === cleanReferralCode) || null;
        if (refMatch && refMatch.partnerType === 'embajador') {
          matchedEmbajador = refMatch;
        } else if (refMatch) {
          targetAccount =
            (refMatch.accountId && accounts.find((a) => a.id === refMatch.accountId)) ||
            accounts.find((a) => a.tag.toUpperCase() === refMatch.code.toUpperCase()) ||
            null;
        } else {
          targetAccount =
            accounts.find((a) => a.role === 'vendedor' && a.tag.toUpperCase() === cleanReferralCode) ||
            null;
        }
      }

      let linkedPartner = null;
      let resolvedReferralCode = null;
      let resolvedAccountId = null;

      if (matchedEmbajador) {
        if (
          session.role === 'vendedor' &&
          matchedEmbajador.ownerVendedorAccountId !== session.userId
        ) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó generar QR para embajador ajeno',
              description: `${session.displayName || session.user} intentó generar un código QR para el embajador "${matchedEmbajador.name}" (${matchedEmbajador.code}) perteneciente a otro vendedor.`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              referralCode: matchedEmbajador.code,
              ipMasked,
              metadata: {
                reason: 'vendedor_foreign_embajador_qr',
                targetEmbajadorId: matchedEmbajador.id,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Acceso denegado. Solo puedes generar códigos QR para tu cuenta o tus propios embajadores.',
          });
        }
        if (!matchedEmbajador.active) {
          return res.status(400).json({
            error: 'El embajador seleccionado está pausado o inactivo.',
          });
        }
        linkedPartner = matchedEmbajador;
        resolvedReferralCode = matchedEmbajador.code;
        resolvedAccountId = matchedEmbajador.ownerVendedorAccountId ?? null;
      } else {
        if (session.role === 'vendedor' && targetAccount && targetAccount.id !== session.userId) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó generar QR para otro vendedor',
              description: `${session.displayName || session.user} intentó generar un código QR para la cuenta "${targetAccount.displayName}" (${targetAccount.tag}).`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              referralCode: targetAccount.tag,
              ipMasked,
              metadata: {
                reason: 'vendedor_foreign_account_qr',
                targetAccountId: targetAccount.id,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Acceso denegado. Solo puedes generar códigos QR para tu propia cuenta o tus embajadores.',
          });
        }
        if (!targetAccount || targetAccount.role !== 'vendedor' || !targetAccount.active) {
          return res.status(400).json({
            error:
              'El código QR solo puede vincularse a una cuenta activa de vendedor o a un embajador activo.',
          });
        }

        // Ensure synced ReferralPartner exists for this active vendedor account
        linkedPartner = await syncVendedorReferrer(store, targetAccount, { mode: 'upsert' });
        resolvedReferralCode = targetAccount.tag;
        resolvedAccountId = targetAccount.id;
      }

      const finalTargetUrl = enforceRefParamOnUrl(cleanTargetUrl, resolvedReferralCode);

      const newQr = {
        id: generateId('qr'),
        name: cleanName.slice(0, 120),
        targetUrl: finalTargetUrl,
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
        referralCode: resolvedReferralCode,
        referrerId: linkedPartner ? linkedPartner.id : null,
        accountId: resolvedAccountId,
        createdAt: nowIso,
      };

      const qrActor = buildActorFromSession(
        session,
        session.role,
        session.role === 'vendedor' ? 'Vendedor' : 'Administrador'
      );
      const qrCreateActivity = {
        action: 'qr_created',
        category: 'qr',
        ...qrActor,
        summary: `${qrActor.actorName} creó el código QR "${newQr.name}" (${newQr.referralCode}).`,
        fromState: null,
        toState: newQr.referralCode,
        targetType: 'qr',
        targetId: newQr.id,
        targetLabel: newQr.name,
        metadata: {
          referralCode: newQr.referralCode,
          referrerId: newQr.referrerId,
          accountId: newQr.accountId,
          styleId: newQr.styleId,
          partnerType: matchedEmbajador ? 'embajador' : 'vendedor',
        },
      };

      const stateAccounts = session.role === 'admin' ? accounts : [];

      if (USE_SUPABASE) {
        if (newQr.accountId) {
          memoryQrAccountIds.set(newQr.id, newQr.accountId);
          saveSupabaseOverlay();
        }
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
              account_id: newQr.accountId,
              created_at: newQr.createdAt,
            },
            ['referral_code', 'referrer_id', 'account_id']
          );
          await recordActivityLog(qrCreateActivity);
          const updatedStore = await getActiveStore();
          const sanitized = sanitizeStateForClient(updatedStore, session, session.role, stateAccounts);
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
          await recordActivityLog(qrCreateActivity);
          const updatedStore = await getActiveStore();
          const sanitized = sanitizeStateForClient(
            { ...updatedStore, qrHistory: getFallbackQrHistory() },
            session,
            session.role,
            stateAccounts
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
      await recordActivityLog(qrCreateActivity, { store });
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, session, session.role, stateAccounts);
      return res.status(201).json({
        ok: true,
        qr: newQr,
        referrer: linkedPartner || null,
        qrHistory: sanitized.qrHistory,
        state: sanitized,
      });
    } catch (err) {
      logServerError('POST /api/qr', err);
      return res.status(503).json({ error: 'No se pudo guardar el código QR.' });
    }
  });
}

async function handleDeleteQrCode(req, res) {
  const { id } = req.params;
  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const history = Array.isArray(store.qrHistory) ? store.qrHistory : [];
      const targetQr = history.find((item) => item.id === id);
      if (!targetQr) {
        return res.status(404).json({ error: 'Código QR no encontrado.' });
      }

      const qrDeleteActivity = {
        action: 'qr_deleted',
        category: 'qr',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} eliminó el código QR "${targetQr.name}"${targetQr.referralCode ? ` (${targetQr.referralCode})` : ''}.`,
        fromState: targetQr.referralCode || null,
        toState: 'Eliminado',
        targetType: 'qr',
        targetId: targetQr.id,
        targetLabel: targetQr.name,
        metadata: {
          referralCode: targetQr.referralCode ?? null,
        },
      };

      if (USE_SUPABASE) {
        try {
          await supabaseRest(`qr_codes?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
          memoryQrAccountIds.delete(id);
          saveSupabaseOverlay();
          await recordActivityLog(qrDeleteActivity);
          const updatedStore = await getActiveStore();
          const sanitized = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts);
          return res.json({ qrHistory: sanitized.qrHistory, state: sanitized });
        } catch (err) {
          if (!isMissingQrTableError(err)) throw err;
          removeFallbackQrCode(id);
          memoryQrAccountIds.delete(id);
          saveSupabaseOverlay();
          await recordActivityLog(qrDeleteActivity);
          const updatedStore = await getActiveStore();
          const sanitized = sanitizeStateForClient(
            { ...updatedStore, qrHistory: getFallbackQrHistory() },
            req.dsbSession,
            'admin',
            accounts
          );
          return res.json({ qrHistory: sanitized.qrHistory, state: sanitized });
        }
      }

      store.qrHistory = history.filter((item) => item.id !== id);
      await recordActivityLog(qrDeleteActivity, { store });
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, req.dsbSession, 'admin', accounts);
      return res.json({ qrHistory: sanitized.qrHistory, state: sanitized });
    } catch (err) {
      logServerError('DELETE /api/qr/:id', err);
      return res.status(503).json({ error: 'No se pudo eliminar el código QR.' });
    }
  });
}

app.get('/api/qr', requireDsbAuth, requireAdminRole, handleGetQrHistory);
app.post('/api/qr', requireDsbAuth, handleCreateQrCode);
app.delete('/api/qr/:id', requireDsbAuth, requireAdminRole, handleDeleteQrCode);

app.get('/api/qr-codes', requireDsbAuth, requireAdminRole, handleGetQrHistory);
app.post('/api/qr-codes', requireDsbAuth, handleCreateQrCode);
app.delete('/api/qr-codes/:id', requireDsbAuth, requireAdminRole, handleDeleteQrCode);

// ----------------------------------------------------------------------------
// Referral QR / Ambassador Tracking & Timestamped Visit Endpoints
// ----------------------------------------------------------------------------

// Public: resolve referral code to safe public partner info (NEVER exposes phone, notes, or counts)
app.get('/api/referrals/resolve/:code', async (req, res) => {
  applyNoStoreHeaders(res);
  const normalizedCode = normalizeReferralCode(req.params.code);
  if (!normalizedCode) {
    return res.json({ ok: true, partner: null });
  }
  try {
    const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
    const partner = (store.referrers || []).find((p) => p.code === normalizedCode) || null;
    if (partner) {
      return res.json({
        ok: true,
        partner: {
          id: partner.id,
          name: partner.name,
          code: partner.code,
          active: Boolean(partner.active),
          avatarUrl: partner.avatarUrl ?? null,
          emoji: partner.emoji ?? null,
          partnerType: partner.partnerType || 'vendedor',
          ownerVendedorName: partner.ownerVendedorName ?? null,
        },
      });
    }
    const vendedor =
      accounts.find((a) => a.role === 'vendedor' && a.tag.toUpperCase() === normalizedCode) || null;
    if (vendedor) {
      return res.json({
        ok: true,
        partner: {
          id: vendedor.id,
          name: vendedor.displayName,
          code: vendedor.tag,
          active: Boolean(vendedor.active),
          avatarUrl: vendedor.avatarUrl ?? null,
          emoji: null,
          partnerType: 'vendedor',
          ownerVendedorName: null,
        },
      });
    }
    return res.json({ ok: true, partner: null });
  } catch (err) {
    logServerError('GET /api/referrals/resolve/:code', err);
    return res.status(503).json({ error: 'No se pudo verificar el código de referido.' });
  }
});

// Public: record a timestamped visit to a referral QR link (with unique visitor deduplication)
app.post('/api/referrals/visit', async (req, res) => {
  applyNoStoreHeaders(res);
  const { code, visitorId } = req.body || {};
  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) {
    return res.json({ ok: true, counted: false, partner: null });
  }

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const referrers = Array.isArray(store.referrers) ? store.referrers : [];
      let index = referrers.findIndex((p) => p.code === normalizedCode);

      if (index === -1) {
        const vendedor =
          accounts.find(
            (a) => a.role === 'vendedor' && a.active && a.tag.toUpperCase() === normalizedCode
          ) || null;
        if (vendedor) {
          const synced = await syncVendedorReferrer(store, vendedor, { mode: 'upsert' });
          if (synced) {
            referrers.unshift(synced);
            index = 0;
          }
        }
      }

      if (index === -1 || referrers[index].active !== true) {
        return res.json({ ok: true, counted: false, partner: null });
      }

      const partner = referrers[index];
      const clientIp = getClientIp(req);
      let visitorKey =
        typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim().slice(0, 128) : '';
      if (!visitorKey) {
        const ua = String(req.headers['user-agent'] || '');
        visitorKey = `anon:${crypto
          .createHash('sha256')
          .update(`${clientIp}|${ua}`)
          .digest('hex')
          .slice(0, 24)}`;
      }

      const nowMs = Date.now();
      const visitEntries = recordSlidingWindowEntry(
        visitFarmingTracker,
        `${clientIp}|${partner.code}`,
        nowMs,
        10 * 60 * 1000,
        nowMs
      );
      const isVisitFarming = visitEntries.length >= 12;

      const isUnique = recordReferralVisitor(partner.code, visitorKey);
      const nowIso = new Date(nowMs).toISOString();
      const nextPartner = {
        ...partner,
        visitsCount: (partner.visitsCount || 0) + 1,
        uniqueVisitsCount: (partner.uniqueVisitsCount || 0) + (isUnique ? 1 : 0),
        lastVisitAt: nowIso,
      };
      const visitEvent = normalizeVisitEvent({
        id: generateId('visit'),
        referrerId: partner.id,
        referralCode: partner.code,
        visitorId: visitorKey,
        visitedAt: nowIso,
      });

      const visitFarmingAlert = isVisitFarming
        ? {
            code: 'qr_visit_farming',
            severity: 'medium',
            category: 'qr_abuse',
            title: 'Inflado artificial de visitas QR detectado',
            description: `Se detectaron ${visitEntries.length} visitas al QR "${partner.code}" (${partner.name}) desde la misma IP (${maskIp(clientIp) || 'IP'}) en menos de 10 minutos.`,
            actorRole: 'public',
            actorName: partner.name,
            actorTag: partner.code,
            referralCode: partner.code,
            ipMasked: maskIp(clientIp),
            metadata: {
              visitsIn10m: visitEntries.length,
              windowMinutes: 10,
              referrerId: partner.id,
              visitorId: visitorKey,
            },
          }
        : null;

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

        if (visitEvent) {
          try {
            await supabaseRest('referral_visits', {
              method: 'POST',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({
                id: visitEvent.id,
                referrer_id: visitEvent.referrerId,
                referral_code: visitEvent.referralCode,
                visitor_id: visitEvent.visitorId,
                visited_at: visitEvent.visitedAt,
              }),
            });
          } catch (err) {
            if (!isMissingReferralVisitsTableError(err)) throw err;
            saveFallbackVisitLog([visitEvent, ...getFallbackVisitLog()]);
          }
        }

        if (visitFarmingAlert) {
          await recordSecurityAlert(visitFarmingAlert, {
            dedupKey: `qr_visit_farming:${clientIp}:${partner.code}`,
            dedupWindowMs: 10 * 60 * 1000,
          });
        }
      } else {
        referrers[index] = nextPartner;
        store.referrers = referrers;
        if (visitEvent) {
          store.visitLog = [visitEvent, ...(Array.isArray(store.visitLog) ? store.visitLog : [])].slice(
            0,
            MAX_VISIT_LOG_ENTRIES
          );
        }
        if (visitFarmingAlert) {
          await recordSecurityAlert(visitFarmingAlert, {
            dedupKey: `qr_visit_farming:${clientIp}:${partner.code}`,
            dedupWindowMs: 10 * 60 * 1000,
            store,
          });
        }
        writeStore(store);
      }

      return res.json({
        ok: true,
        counted: true,
        partner: {
          id: nextPartner.id,
          name: nextPartner.name,
          code: nextPartner.code,
          avatarUrl: nextPartner.avatarUrl ?? null,
          emoji: nextPartner.emoji ?? null,
          partnerType: nextPartner.partnerType || 'vendedor',
          ownerVendedorName: nextPartner.ownerVendedorName ?? null,
        },
        visit: visitEvent,
      });
    } catch (err) {
      logServerError('POST /api/referrals/visit', err);
      return res.status(503).json({ error: 'No se pudo registrar la visita del referido.' });
    }
  });
});

// DSB authenticated: list referral partners (vendedor sees own + owned embajadores)
app.get('/api/referrals', requireDsbAuth, async (req, res) => {
  applyNoStoreHeaders(res);
  try {
    const store = await getActiveStore();
    let referrers = Array.isArray(store.referrers)
      ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
      : [];
    if (req.dsbSession?.role === 'vendedor') {
      const tag = normalizeReferralCode(req.dsbSession.tag);
      referrers = referrers.filter(
        (r) =>
          (r.partnerType !== 'embajador' &&
            (r.accountId === req.dsbSession.userId || (tag && r.code === tag))) ||
          (r.partnerType === 'embajador' && r.ownerVendedorAccountId === req.dsbSession.userId)
      );
    } else if (req.dsbSession?.role === 'telemarketing') {
      referrers = referrers.map((r) => ({
        id: r.id,
        accountId: r.accountId ?? null,
        partnerType: r.partnerType || 'vendedor',
        ownerVendedorAccountId: r.ownerVendedorAccountId ?? null,
        ownerVendedorName: r.ownerVendedorName ?? null,
        ownerVendedorTag: r.ownerVendedorTag ?? null,
        name: r.name,
        code: r.code,
        emoji: r.emoji ?? null,
        avatarUrl: r.avatarUrl ?? null,
        active: Boolean(r.active),
        visitsCount: 0,
        uniqueVisitsCount: 0,
        lastVisitAt: null,
        createdAt: r.createdAt,
      }));
    }
    return res.json({ ok: true, referrers });
  } catch (err) {
    logServerError('GET /api/referrals', err);
    return res.status(503).json({ error: 'No se pudo consultar la lista de embajadores.' });
  }
});

// Admin-only: batch standalone referral creation disallowed (must use /api/accounts)
app.post('/api/referrals/batch', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  return res.status(400).json({
    error:
      'Los vendedores/embajadores deben crearse desde el módulo de Cuentas (/api/accounts) para asignar su tag único y credenciales de acceso.',
  });
});

// Admin-only: create/sync referral partner ONLY when linked to a valid vendedor accountId
app.post('/api/referrals', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  const { accountId, phone, notes, qrStyleId } = req.body || {};
  const cleanAccountId = typeof accountId === 'string' ? accountId.trim() : '';

  if (!cleanAccountId) {
    return res.status(400).json({
      error:
        'No se pueden crear embajadores independientes sin cuenta. Crea una cuenta de vendedor en /api/accounts.',
    });
  }

  return withStoreMutationLock(async () => {
    try {
      const [accounts, store] = await Promise.all([fetchAllAuthAccounts(), getActiveStore()]);
      const account = accounts.find((a) => a.id === cleanAccountId && a.role === 'vendedor');
      if (!account) {
        return res.status(400).json({
          error: 'Cuenta de vendedor/embajador no encontrada. Crea primero la cuenta en /api/accounts.',
        });
      }

      let partner = await syncVendedorReferrer(store, account, { mode: 'upsert' });
      const cleanPhone =
        typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 40) : partner.phone;
      const cleanNotes =
        typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : partner.notes;
      const nextStyle = VALID_QR_STYLE_IDS.has(qrStyleId) ? qrStyleId : partner.qrStyleId;

      if (cleanPhone !== partner.phone || cleanNotes !== partner.notes || nextStyle !== partner.qrStyleId) {
        partner = normalizeReferrerRecord({
          ...partner,
          phone: cleanPhone,
          notes: cleanNotes,
          qrStyleId: nextStyle,
        });
        if (USE_SUPABASE) {
          await supabaseRest(`referrers?id=eq.${encodeURIComponent(partner.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              phone: partner.phone || null,
              notes: partner.notes || null,
              qr_style_id: partner.qrStyleId,
            }),
          }).catch((err) => {
            if (!isMissingReferrersTableError(err)) throw err;
            const fb = getFallbackReferrers();
            const fbIdx = fb.findIndex((r) => r.id === partner.id);
            if (fbIdx !== -1) {
              fb[fbIdx] = partner;
              saveFallbackReferrers(fb);
            }
          });
        } else {
          store.referrers = (store.referrers || []).map((r) => (r.id === partner.id ? partner : r));
          writeStore(store);
        }
      }

      const updatedStore = USE_SUPABASE ? await getActiveStore() : store;
      return res.status(201).json({
        ok: true,
        referrer: partner,
        state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts),
      });
    } catch (err) {
      logServerError('POST /api/referrals', err);
      return res.status(503).json({ error: 'No se pudo vincular el embajador.' });
    }
  });
});

// Admin-only: update a referral partner (protected with current Admin password; including resetVisits)
app.patch('/api/referrals/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  const { id } = req.params;
  const updates = req.body || {};

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const existing = Array.isArray(store.referrers) ? store.referrers : [];
      const index = existing.findIndex((p) => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Embajador no encontrado.' });
      }

      const current = existing[index];
      const linkedAccount =
        accounts.find(
          (a) =>
            (current.accountId && a.id === current.accountId) ||
            (a.role === 'vendedor' && a.tag.toUpperCase() === current.code.toUpperCase())
        ) || null;

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
        const dupAcc = accounts.some(
          (a) => (!linkedAccount || a.id !== linkedAccount.id) && a.tag.toUpperCase() === normalized
        );
        if (dupAcc) {
          return res.status(409).json({
            error: `El código "${normalized}" ya está asignado a otra cuenta.`,
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

      let nextAvatarUrl = current.avatarUrl ?? null;
      if (updates.avatarUrl !== undefined) {
        const avatarCheck = sanitizeAvatarUrl(updates.avatarUrl);
        if (!avatarCheck.ok) {
          return res.status(400).json({ error: avatarCheck.error });
        }
        nextAvatarUrl = avatarCheck.value;
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

      const nextReferrer = normalizeReferrerRecord({
        id: current.id,
        accountId:
          current.partnerType === 'embajador' ? null : current.accountId ?? linkedAccount?.id ?? null,
        partnerType: current.partnerType || 'vendedor',
        ownerVendedorAccountId: current.ownerVendedorAccountId ?? null,
        ownerVendedorName: current.ownerVendedorName ?? null,
        ownerVendedorTag: current.ownerVendedorTag ?? null,
        name: nextName,
        code: nextCode,
        emoji: current.emoji ?? null,
        avatarUrl: nextAvatarUrl,
        ...(nextPhone ? { phone: nextPhone } : {}),
        ...(nextNotes ? { notes: nextNotes } : {}),
        active: nextActive,
        visitsCount: nextVisitsCount,
        uniqueVisitsCount: nextUniqueVisitsCount,
        lastVisitAt: nextLastVisitAt,
        qrStyleId: nextQrStyleId,
        createdAt: current.createdAt,
      });

      // Sync avatarUrl, tag, or displayName back to linked vendedor account when updated via /api/referrals/:id
      if (linkedAccount && current.partnerType !== 'embajador') {
        const needsAccountSync =
          (updates.avatarUrl !== undefined && linkedAccount.avatarUrl !== nextAvatarUrl) ||
          (updates.code !== undefined && linkedAccount.tag !== nextCode) ||
          (updates.name !== undefined && linkedAccount.displayName !== nextName);
        if (needsAccountSync) {
          const updatedAcc = {
            ...linkedAccount,
            displayName: updates.name !== undefined ? nextName.slice(0, 100) : linkedAccount.displayName,
            tag: updates.code !== undefined ? nextCode : linkedAccount.tag,
            avatarUrl: updates.avatarUrl !== undefined ? nextAvatarUrl : linkedAccount.avatarUrl,
            updatedAt: new Date().toISOString(),
          };
          await persistUpdatedAuthAccount(updatedAcc);
        }
      }

      const refUpdateActivity = {
        action: 'referrer_updated',
        category: 'qr',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: resetVisits
          ? `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} reinició visitas y actualizó al embajador "${nextReferrer.name}" (${nextReferrer.code}).`
          : `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} actualizó al embajador "${nextReferrer.name}" (${nextReferrer.code}).`,
        fromState: current.code,
        toState: nextReferrer.code,
        targetType: 'referrer',
        targetId: nextReferrer.id,
        targetLabel: `${nextReferrer.name} (${nextReferrer.code})`,
        metadata: {
          code: nextReferrer.code,
          active: Boolean(nextReferrer.active),
          resetVisits,
        },
      };

      if (USE_SUPABASE) {
        cacheReferrerMeta(nextReferrer);
        try {
          await supabaseWriteWithOptionalColumns(
            `referrers?id=eq.${encodeURIComponent(id)}`,
            'PATCH',
            { Prefer: 'return=minimal' },
            {
              name: nextReferrer.name,
              code: nextReferrer.code,
              avatar_url: nextReferrer.avatarUrl ?? null,
              emoji: nextReferrer.emoji ?? null,
              partner_type: nextReferrer.partnerType || 'vendedor',
              owner_vendedor_account_id: nextReferrer.ownerVendedorAccountId ?? null,
              owner_vendedor_name: nextReferrer.ownerVendedorName ?? null,
              owner_vendedor_tag: nextReferrer.ownerVendedorTag ?? null,
              phone: nextReferrer.phone || null,
              notes: nextReferrer.notes || null,
              active: nextReferrer.active,
              visits_count: nextReferrer.visitsCount,
              unique_visits_count: nextReferrer.uniqueVisitsCount,
              last_visit_at: nextReferrer.lastVisitAt,
              qr_style_id: nextReferrer.qrStyleId,
            },
            REFERRER_OPTIONAL_COLUMNS
          );
        } catch (err) {
          if (isUniqueViolationError(err)) {
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
        if (resetVisits) {
          await supabaseRest(`referral_visits?referrer_id=eq.${encodeURIComponent(id)}`, {
            method: 'DELETE',
          }).catch((err) => {
            if (!isMissingReferralVisitsTableError(err)) throw err;
            saveFallbackVisitLog(
              getFallbackVisitLog().filter((v) => v.referrerId !== id && v.referralCode !== current.code)
            );
          });
        }
        await recordActivityLog(refUpdateActivity);
        const [updatedStore, refreshedAccounts] = await Promise.all([
          getActiveStore(),
          fetchAllAuthAccounts(),
        ]);
        return res.json({
          ok: true,
          referrer: nextReferrer,
          state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', refreshedAccounts),
        });
      }

      existing[index] = nextReferrer;
      store.referrers = existing;
      if (resetVisits) {
        store.visitLog = (store.visitLog || []).filter(
          (v) => v.referrerId !== id && v.referralCode !== current.code
        );
      }
      await recordActivityLog(refUpdateActivity, { store });
      writeStore(store);
      const refreshedAccounts = await fetchAllAuthAccounts();
      return res.json({
        ok: true,
        referrer: nextReferrer,
        state: sanitizeStateForClient(store, req.dsbSession, 'admin', refreshedAccounts),
      });
    } catch (err) {
      logServerError('PATCH /api/referrals/:id', err);
      return res.status(503).json({ error: 'No se pudo actualizar el embajador.' });
    }
  });
});

// Admin-only: delete a referral partner (protected with current Admin password)
app.delete('/api/referrals/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  const { id } = req.params;
  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const existing = Array.isArray(store.referrers) ? store.referrers : [];
      const target = existing.find((p) => p.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Embajador no encontrado.' });
      }

      clearReferralVisitorBucket(target.code);

      const refDeleteActivity = {
        action: 'referrer_deleted',
        category: 'qr',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} eliminó al embajador "${target.name}" (${target.code}).`,
        fromState: target.code,
        toState: 'Eliminado',
        targetType: 'referrer',
        targetId: target.id,
        targetLabel: `${target.name} (${target.code})`,
        metadata: {
          code: target.code,
        },
      };

      if (USE_SUPABASE) {
        try {
          await supabaseRest(`referrers?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err) {
          if (!isMissingReferrersTableError(err)) throw err;
          saveFallbackReferrers(getFallbackReferrers().filter((p) => p.id !== id));
        }
        memoryReferrerAvatars.delete(id);
        memoryReferrerAccountIds.delete(id);
        memoryReferrerMeta.delete(id);
        saveSupabaseOverlay();
        await recordActivityLog(refDeleteActivity);
        const updatedStore = await getActiveStore();
        return res.json({
          ok: true,
          state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts),
        });
      }

      store.referrers = existing.filter((p) => p.id !== id);
      await recordActivityLog(refDeleteActivity, { store });
      writeStore(store);
      return res.json({
        ok: true,
        state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts),
      });
    } catch (err) {
      logServerError('DELETE /api/referrals/:id', err);
      return res.status(503).json({ error: 'No se pudo eliminar el embajador.' });
    }
  });
});

// ----------------------------------------------------------------------------
// Embajadores CRUD (Non-login referrers owned by a Vendedor or Ciprian Direct)
// ----------------------------------------------------------------------------

// Create an Embajador (Admin or Vendedor; Telemarketing rejected with 403 + alert)
app.post('/api/embajadores', requireDsbAuth, async (req, res) => {
  applyNoStoreHeaders(res);
  const session = req.dsbSession;
  const clientIp = getClientIp(req);
  const ipMasked = maskIp(clientIp);

  if (!session || (session.role !== 'admin' && session.role !== 'vendedor')) {
    if (session) {
      await recordSecurityAlert({
        code: 'rbac_unauthorized_attempt',
        severity: 'high',
        category: 'access',
        title: 'Intento no autorizado de crear Embajador',
        description: `${session.displayName || session.user} (${session.role}) intentó crear un embajador vía POST /api/embajadores sin permisos.`,
        actorRole: session.role,
        actorName: session.displayName || session.user,
        actorTag: session.tag || null,
        ipMasked,
        metadata: {
          method: 'POST',
          path: '/api/embajadores',
          reason: 'embajador_create_role_denied',
        },
      });
    }
    return res.status(403).json({
      error: 'Acceso denegado. Solo administradores y vendedores pueden crear embajadores.',
    });
  }

  const {
    name,
    emoji,
    avatarUrl,
    code,
    qrStyleId,
    phone,
    notes,
    ownerVendedorAccountId,
    createQr,
    targetUrl,
    dotShape,
    foregroundColor,
    backgroundColor,
    includeLogo,
    frameText,
  } = req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'El nombre del embajador debe tener al menos 2 caracteres.' });
  }

  const emojiCheck = sanitizeEmojiInput(emoji);
  if (!emojiCheck.ok) {
    return res.status(400).json({ error: emojiCheck.error });
  }

  const avatarCheck = sanitizeAvatarUrl(avatarUrl);
  if (!avatarCheck.ok) {
    return res.status(400).json({ error: avatarCheck.error });
  }

  const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 40) : undefined;
  const cleanNotes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : undefined;
  const validStyleId = VALID_QR_STYLE_IDS.has(qrStyleId) ? qrStyleId : 'classic-gold';
  const cleanFrameText = typeof frameText === 'string' ? frameText.trim().slice(0, 120) : '';

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const existingReferrers = Array.isArray(store.referrers)
        ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
        : [];

      // Resolve owner vendedor
      let resolvedOwnerId = null;
      let resolvedOwnerName = null;
      let resolvedOwnerTag = null;

      if (session.role === 'vendedor') {
        const requestedOwner =
          typeof ownerVendedorAccountId === 'string' ? ownerVendedorAccountId.trim() : '';
        if (requestedOwner && requestedOwner !== session.userId) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó asignar embajador a otro vendedor',
              description: `${session.displayName || session.user} intentó crear un embajador asignado a "${requestedOwner}".`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              ipMasked,
              metadata: {
                reason: 'vendedor_foreign_embajador_owner',
                requestedOwnerVendedorAccountId: requestedOwner,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Solo puedes crear embajadores vinculados a tu propia cuenta de vendedor.',
          });
        }
        const selfAcc = accounts.find((a) => a.id === session.userId) || null;
        resolvedOwnerId = session.userId;
        resolvedOwnerName = (selfAcc?.displayName || session.displayName || session.user).slice(0, 120);
        resolvedOwnerTag = normalizeReferralCode(selfAcc?.tag || session.tag) || null;
      } else {
        // Admin: optional ownerVendedorAccountId (null/empty = Ciprian Directo)
        const requestedOwner =
          typeof ownerVendedorAccountId === 'string' ? ownerVendedorAccountId.trim() : '';
        if (requestedOwner) {
          const ownerAcc = accounts.find(
            (a) => a.id === requestedOwner && a.role === 'vendedor' && a.active
          );
          if (!ownerAcc) {
            return res.status(400).json({
              error: 'El vendedor seleccionado no existe o está inactivo.',
            });
          }
          resolvedOwnerId = ownerAcc.id;
          resolvedOwnerName = ownerAcc.displayName.slice(0, 120);
          resolvedOwnerTag = ownerAcc.tag;
        }
      }

      // Build existing codes set across referrers and accounts tags
      const existingCodesSet = new Set();
      for (const r of existingReferrers) {
        if (r.code) existingCodesSet.add(r.code.toUpperCase());
      }
      for (const a of accounts) {
        if (a.tag) existingCodesSet.add(a.tag.toUpperCase());
      }

      let resolvedCode;
      if (typeof code === 'string' && code.trim()) {
        const normalized = normalizeReferralCode(code);
        if (!normalized) {
          return res.status(400).json({
            error: 'El código de referido debe tener entre 2 y 32 caracteres alfanuméricos o guiones.',
          });
        }
        if (existingCodesSet.has(normalized)) {
          return res.status(409).json({
            error: `El código "${normalized}" ya está en uso por otro embajador o cuenta.`,
          });
        }
        resolvedCode = normalized;
      } else {
        resolvedCode = generateUniqueEmbajadorCode(cleanName, existingCodesSet);
      }

      const nowIso = new Date().toISOString();
      const newEmbajador = normalizeReferrerRecord({
        id: generateId('emb'),
        accountId: null,
        partnerType: 'embajador',
        ownerVendedorAccountId: resolvedOwnerId,
        ownerVendedorName: resolvedOwnerName,
        ownerVendedorTag: resolvedOwnerTag,
        name: cleanName.slice(0, 120),
        code: resolvedCode,
        emoji: emojiCheck.value,
        avatarUrl: avatarCheck.value,
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        active: true,
        visitsCount: 0,
        uniqueVisitsCount: 0,
        lastVisitAt: null,
        qrStyleId: validStyleId,
        createdAt: nowIso,
      });

      let createdQr = null;
      if (createQr !== false) {
        const baseTargetUrl = isValidQrTargetUrl(targetUrl) ? targetUrl.trim() : '/';
        const finalTargetUrl = enforceRefParamOnUrl(baseTargetUrl, newEmbajador.code);
        createdQr = {
          id: generateId('qr'),
          name: `QR ${newEmbajador.name}`.slice(0, 120),
          targetUrl: finalTargetUrl,
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
          referralCode: newEmbajador.code,
          referrerId: newEmbajador.id,
          accountId: newEmbajador.ownerVendedorAccountId ?? null,
          createdAt: nowIso,
        };
      }

      const actor = buildActorFromSession(
        session,
        session.role,
        session.role === 'vendedor' ? 'Vendedor' : 'Administrador'
      );
      const createActivity = {
        action: 'embajador_created',
        category: 'qr',
        ...actor,
        summary: `${actor.actorName} creó al embajador "${newEmbajador.name}" (${newEmbajador.code})${newEmbajador.ownerVendedorName ? ` vinculado a ${newEmbajador.ownerVendedorName}` : ' (Ciprian Directo)'}.`,
        fromState: null,
        toState: newEmbajador.code,
        targetType: 'referrer',
        targetId: newEmbajador.id,
        targetLabel: `${newEmbajador.name} (${newEmbajador.code})`,
        metadata: {
          code: newEmbajador.code,
          partnerType: 'embajador',
          ownerVendedorAccountId: newEmbajador.ownerVendedorAccountId ?? null,
          ownerVendedorTag: newEmbajador.ownerVendedorTag ?? null,
          qrId: createdQr ? createdQr.id : null,
        },
      };

      const stateAccounts = session.role === 'admin' ? accounts : [];

      if (USE_SUPABASE) {
        cacheReferrerMeta(newEmbajador);
        try {
          await supabaseWriteWithOptionalColumns(
            'referrers',
            'POST',
            { Prefer: 'return=minimal' },
            {
              id: newEmbajador.id,
              account_id: null,
              partner_type: 'embajador',
              owner_vendedor_account_id: newEmbajador.ownerVendedorAccountId ?? null,
              owner_vendedor_name: newEmbajador.ownerVendedorName ?? null,
              owner_vendedor_tag: newEmbajador.ownerVendedorTag ?? null,
              name: newEmbajador.name,
              code: newEmbajador.code,
              emoji: newEmbajador.emoji ?? null,
              avatar_url: newEmbajador.avatarUrl ?? null,
              phone: newEmbajador.phone || null,
              notes: newEmbajador.notes || null,
              active: newEmbajador.active,
              visits_count: 0,
              unique_visits_count: 0,
              last_visit_at: null,
              qr_style_id: newEmbajador.qrStyleId,
              created_at: newEmbajador.createdAt,
            },
            REFERRER_OPTIONAL_COLUMNS
          );
        } catch (err) {
          if (isUniqueViolationError(err)) {
            return res.status(409).json({
              error: `El código "${newEmbajador.code}" ya está en uso.`,
            });
          }
          if (!isMissingReferrersTableError(err)) throw err;
          saveFallbackReferrers([newEmbajador, ...getFallbackReferrers()]);
        }

        if (createdQr) {
          if (createdQr.accountId) {
            memoryQrAccountIds.set(createdQr.id, createdQr.accountId);
            saveSupabaseOverlay();
          }
          try {
            await supabaseWriteWithOptionalColumns(
              'qr_codes',
              'POST',
              { Prefer: 'return=minimal' },
              {
                id: createdQr.id,
                name: createdQr.name,
                target_url: createdQr.targetUrl,
                style_id: createdQr.styleId,
                dot_shape: createdQr.dotShape,
                foreground_color: createdQr.foregroundColor,
                background_color: createdQr.backgroundColor,
                include_logo: createdQr.includeLogo,
                frame_text: cleanFrameText,
                referral_code: createdQr.referralCode,
                referrer_id: createdQr.referrerId,
                account_id: createdQr.accountId,
                created_at: createdQr.createdAt,
              },
              ['referral_code', 'referrer_id', 'account_id']
            );
          } catch (err) {
            if (!isMissingQrTableError(err)) throw err;
            addFallbackQrCode(createdQr);
          }
        }

        await recordActivityLog(createActivity);
        const updatedStore = await getActiveStore();
        return res.status(201).json({
          ok: true,
          referrer: newEmbajador,
          qr: createdQr,
          state: sanitizeStateForClient(updatedStore, session, session.role, stateAccounts),
        });
      }

      store.referrers = [newEmbajador, ...existingReferrers];
      if (createdQr) {
        store.qrHistory = Array.isArray(store.qrHistory) ? store.qrHistory : [];
        store.qrHistory.unshift(createdQr);
      }
      await recordActivityLog(createActivity, { store });
      writeStore(store);

      return res.status(201).json({
        ok: true,
        referrer: newEmbajador,
        qr: createdQr,
        state: sanitizeStateForClient(store, session, session.role, stateAccounts),
      });
    } catch (err) {
      logServerError('POST /api/embajadores', err);
      return res.status(503).json({ error: 'No se pudo crear el embajador.' });
    }
  });
});

// Update / pause / reactivate an Embajador (Admin or owning Vendedor)
app.patch('/api/embajadores/:id', requireDsbAuth, async (req, res) => {
  applyNoStoreHeaders(res);
  const session = req.dsbSession;
  const { id } = req.params;
  const updates = req.body || {};
  const clientIp = getClientIp(req);
  const ipMasked = maskIp(clientIp);

  if (!session || (session.role !== 'admin' && session.role !== 'vendedor')) {
    if (session) {
      await recordSecurityAlert({
        code: 'rbac_unauthorized_attempt',
        severity: 'high',
        category: 'access',
        title: 'Intento no autorizado de editar Embajador',
        description: `${session.displayName || session.user} (${session.role}) intentó editar un embajador vía PATCH /api/embajadores/${id}.`,
        actorRole: session.role,
        actorName: session.displayName || session.user,
        actorTag: session.tag || null,
        ipMasked,
        metadata: {
          method: 'PATCH',
          path: `/api/embajadores/${id}`,
          reason: 'embajador_update_role_denied',
        },
      });
    }
    return res.status(403).json({
      error: 'Acceso denegado. Solo administradores y vendedores pueden editar embajadores.',
    });
  }

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const existing = Array.isArray(store.referrers)
        ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
        : [];
      const index = existing.findIndex((p) => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Embajador no encontrado.' });
      }

      const current = existing[index];
      if (current.partnerType !== 'embajador') {
        return res.status(400).json({
          error: 'Este registro pertenece a una cuenta de vendedor y no a un embajador.',
        });
      }

      if (session.role === 'vendedor') {
        if (current.ownerVendedorAccountId !== session.userId) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó editar un embajador ajeno',
              description: `${session.displayName || session.user} intentó modificar al embajador "${current.name}" (${current.code}) perteneciente a otro vendedor.`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              referralCode: current.code,
              ipMasked,
              metadata: {
                reason: 'vendedor_foreign_embajador_edit',
                targetEmbajadorId: current.id,
                ownerVendedorAccountId: current.ownerVendedorAccountId ?? null,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Acceso denegado. Solo puedes editar o pausar tus propios embajadores.',
          });
        }
        if (
          updates.ownerVendedorAccountId !== undefined &&
          updates.ownerVendedorAccountId !== session.userId
        ) {
          await recordSecurityAlert(
            {
              code: 'rbac_unauthorized_attempt',
              severity: 'high',
              category: 'access',
              title: 'Vendedor intentó transferir propiedad de embajador',
              description: `${session.displayName || session.user} intentó reasignar la propiedad del embajador "${current.name}" (${current.code}).`,
              actorRole: 'vendedor',
              actorName: session.displayName || session.user,
              actorTag: session.tag || null,
              referralCode: current.code,
              ipMasked,
              metadata: {
                reason: 'vendedor_embajador_reassign_denied',
                targetEmbajadorId: current.id,
              },
            },
            { store: USE_SUPABASE ? undefined : store }
          );
          return res.status(403).json({
            error: 'Solo un administrador puede reasignar un embajador a otro vendedor.',
          });
        }
      }

      let nextName = current.name;
      if (updates.name !== undefined) {
        const cleanName = typeof updates.name === 'string' ? updates.name.trim() : '';
        if (cleanName.length < 2) {
          return res.status(400).json({ error: 'El nombre del embajador debe tener al menos 2 caracteres.' });
        }
        nextName = cleanName.slice(0, 120);
      }

      let nextEmoji = current.emoji ?? null;
      if (updates.emoji !== undefined) {
        const emojiCheck = sanitizeEmojiInput(updates.emoji);
        if (!emojiCheck.ok) {
          return res.status(400).json({ error: emojiCheck.error });
        }
        nextEmoji = emojiCheck.value;
      }

      let nextAvatarUrl = current.avatarUrl ?? null;
      if (updates.avatarUrl !== undefined) {
        const avatarCheck = sanitizeAvatarUrl(updates.avatarUrl);
        if (!avatarCheck.ok) {
          return res.status(400).json({ error: avatarCheck.error });
        }
        nextAvatarUrl = avatarCheck.value;
      }

      let nextCode = current.code;
      if (updates.code !== undefined) {
        const normalized = normalizeReferralCode(updates.code);
        if (!normalized) {
          return res.status(400).json({
            error: 'El código de referido debe tener entre 2 y 32 caracteres alfanuméricos o guiones.',
          });
        }
        const dupRef = existing.some((p) => p.id !== id && p.code === normalized);
        if (dupRef) {
          return res.status(409).json({
            error: `Ya existe un embajador con el código "${normalized}".`,
          });
        }
        const dupAcc = accounts.some((a) => a.tag.toUpperCase() === normalized);
        if (dupAcc) {
          return res.status(409).json({
            error: `El código "${normalized}" ya está asignado a una cuenta.`,
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

      let nextOwnerId = current.ownerVendedorAccountId ?? null;
      let nextOwnerName = current.ownerVendedorName ?? null;
      let nextOwnerTag = current.ownerVendedorTag ?? null;
      if (session.role === 'admin' && updates.ownerVendedorAccountId !== undefined) {
        const requestedOwner =
          typeof updates.ownerVendedorAccountId === 'string'
            ? updates.ownerVendedorAccountId.trim()
            : '';
        if (!requestedOwner) {
          nextOwnerId = null;
          nextOwnerName = null;
          nextOwnerTag = null;
        } else {
          const ownerAcc = accounts.find(
            (a) => a.id === requestedOwner && a.role === 'vendedor' && a.active
          );
          if (!ownerAcc) {
            return res.status(400).json({
              error: 'El vendedor seleccionado no existe o está inactivo.',
            });
          }
          nextOwnerId = ownerAcc.id;
          nextOwnerName = ownerAcc.displayName.slice(0, 120);
          nextOwnerTag = ownerAcc.tag;
        }
      }

      const nextActive = typeof updates.active === 'boolean' ? updates.active : current.active;
      const nextQrStyleId = VALID_QR_STYLE_IDS.has(updates.qrStyleId)
        ? updates.qrStyleId
        : current.qrStyleId || 'classic-gold';

      if (nextCode !== current.code) {
        renameReferralVisitorBucket(current.code, nextCode);
      }

      const nextEmbajador = normalizeReferrerRecord({
        ...current,
        accountId: null,
        partnerType: 'embajador',
        ownerVendedorAccountId: nextOwnerId,
        ownerVendedorName: nextOwnerName,
        ownerVendedorTag: nextOwnerTag,
        name: nextName,
        code: nextCode,
        emoji: nextEmoji,
        avatarUrl: nextAvatarUrl,
        phone: nextPhone,
        notes: nextNotes,
        active: nextActive,
        qrStyleId: nextQrStyleId,
      });

      const actor = buildActorFromSession(
        session,
        session.role,
        session.role === 'vendedor' ? 'Vendedor' : 'Administrador'
      );
      const updateActivity = {
        action: 'embajador_updated',
        category: 'qr',
        ...actor,
        summary: `${actor.actorName} actualizó al embajador "${nextEmbajador.name}" (${nextEmbajador.code})${current.active !== nextEmbajador.active ? ` (${nextEmbajador.active ? 'reactivado' : 'pausado'})` : ''}.`,
        fromState: current.active ? 'Activo' : 'Pausado',
        toState: nextEmbajador.active ? 'Activo' : 'Pausado',
        targetType: 'referrer',
        targetId: nextEmbajador.id,
        targetLabel: `${nextEmbajador.name} (${nextEmbajador.code})`,
        metadata: {
          code: nextEmbajador.code,
          partnerType: 'embajador',
          active: Boolean(nextEmbajador.active),
          ownerVendedorAccountId: nextEmbajador.ownerVendedorAccountId ?? null,
        },
      };

      const stateAccounts = session.role === 'admin' ? accounts : [];

      if (USE_SUPABASE) {
        cacheReferrerMeta(nextEmbajador);
        try {
          await supabaseWriteWithOptionalColumns(
            `referrers?id=eq.${encodeURIComponent(id)}`,
            'PATCH',
            { Prefer: 'return=minimal' },
            {
              partner_type: 'embajador',
              owner_vendedor_account_id: nextEmbajador.ownerVendedorAccountId ?? null,
              owner_vendedor_name: nextEmbajador.ownerVendedorName ?? null,
              owner_vendedor_tag: nextEmbajador.ownerVendedorTag ?? null,
              name: nextEmbajador.name,
              code: nextEmbajador.code,
              emoji: nextEmbajador.emoji ?? null,
              avatar_url: nextEmbajador.avatarUrl ?? null,
              phone: nextEmbajador.phone || null,
              notes: nextEmbajador.notes || null,
              active: nextEmbajador.active,
              qr_style_id: nextEmbajador.qrStyleId,
            },
            REFERRER_OPTIONAL_COLUMNS
          );
        } catch (err) {
          if (isUniqueViolationError(err)) {
            return res.status(409).json({
              error: `Ya existe un embajador con el código "${nextEmbajador.code}".`,
            });
          }
          if (!isMissingReferrersTableError(err)) throw err;
          const fallback = getFallbackReferrers();
          const fbIdx = fallback.findIndex((p) => p.id === id);
          if (fbIdx !== -1) {
            fallback[fbIdx] = nextEmbajador;
            saveFallbackReferrers(fallback);
          }
        }
        await recordActivityLog(updateActivity);
        const updatedStore = await getActiveStore();
        return res.json({
          ok: true,
          referrer: nextEmbajador,
          state: sanitizeStateForClient(updatedStore, session, session.role, stateAccounts),
        });
      }

      existing[index] = nextEmbajador;
      store.referrers = existing;
      await recordActivityLog(updateActivity, { store });
      writeStore(store);

      return res.json({
        ok: true,
        referrer: nextEmbajador,
        state: sanitizeStateForClient(store, session, session.role, stateAccounts),
      });
    } catch (err) {
      logServerError('PATCH /api/embajadores/:id', err);
      return res.status(503).json({ error: 'No se pudo actualizar el embajador.' });
    }
  });
});

// Permanent delete of an Embajador (Admin-only + current Admin password)
app.delete('/api/embajadores/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  if (!(await verifyCurrentAdminPasswordForMutation(req, res))) return;
  const { id } = req.params;

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const existing = Array.isArray(store.referrers)
        ? store.referrers.map(normalizeReferrerRecord).filter(Boolean)
        : [];
      const target = existing.find((p) => p.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Embajador no encontrado.' });
      }
      if (target.partnerType !== 'embajador') {
        return res.status(400).json({
          error: 'Solo puedes eliminar embajadores desde esta ruta. Para vendedores usa Cuentas.',
        });
      }

      clearReferralVisitorBucket(target.code);

      const deleteActivity = {
        action: 'embajador_deleted',
        category: 'qr',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${req.dsbSession?.displayName || req.dsbSession?.user || 'Administrador'} eliminó permanentemente al embajador "${target.name}" (${target.code}).`,
        fromState: target.code,
        toState: 'Eliminado',
        targetType: 'referrer',
        targetId: target.id,
        targetLabel: `${target.name} (${target.code})`,
        metadata: {
          code: target.code,
          partnerType: 'embajador',
          ownerVendedorAccountId: target.ownerVendedorAccountId ?? null,
        },
      };

      if (USE_SUPABASE) {
        try {
          await supabaseRest(`referrers?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err) {
          if (!isMissingReferrersTableError(err)) throw err;
          saveFallbackReferrers(getFallbackReferrers().filter((p) => p.id !== id));
        }
        memoryReferrerAvatars.delete(id);
        memoryReferrerAccountIds.delete(id);
        memoryReferrerMeta.delete(id);
        saveSupabaseOverlay();
        await recordActivityLog(deleteActivity);
        const updatedStore = await getActiveStore();
        return res.json({
          ok: true,
          state: sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts),
        });
      }

      store.referrers = existing.filter((p) => p.id !== id);
      await recordActivityLog(deleteActivity, { store });
      writeStore(store);

      return res.json({
        ok: true,
        state: sanitizeStateForClient(store, req.dsbSession, 'admin', accounts),
      });
    } catch (err) {
      logServerError('DELETE /api/embajadores/:id', err);
      return res.status(503).json({ error: 'No se pudo eliminar el embajador.' });
    }
  });
});

// ----------------------------------------------------------------------------
// Client-Side DevTools / Tamper Telemetry (Authenticated DSB Users, Rate-Limited)
// ----------------------------------------------------------------------------

const CLIENT_TAMPER_WINDOW_MS = 60 * 1000;
const CLIENT_TAMPER_MAX_PER_WINDOW = 10;

app.post('/api/security/client-tamper', requireDsbAuth, async (req, res) => {
  applyNoStoreHeaders(res);
  const session = req.dsbSession;
  const clientIp = getClientIp(req);
  const rateKey = session?.userId || clientIp || 'unknown';
  const nowMs = Date.now();
  const entries = recordSlidingWindowEntry(
    clientTamperRateTracker,
    rateKey,
    nowMs,
    CLIENT_TAMPER_WINDOW_MS,
    nowMs
  );
  if (entries.length > CLIENT_TAMPER_MAX_PER_WINDOW) {
    return res.status(429).json({
      error: 'Demasiados reportes de seguridad en poco tiempo.',
      retryAfterSeconds: Math.ceil(CLIENT_TAMPER_WINDOW_MS / 1000),
    });
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const rawReason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const cleanReason = (rawReason.replace(/[^\w.:-]/g, '_').slice(0, 64) || 'devtools_detected');
  const cleanDetail = typeof body.detail === 'string' ? body.detail.trim().slice(0, 300) : '';

  const titleByReason = {
    devtools_shortcut: 'Intento de apertura de DevTools mediante atajo de teclado',
    session_storage_tamper: 'Alteración detectada en almacenamiento de sesión (DevTools)',
    devtools_open: 'Herramientas de desarrollador detectadas abiertas en el panel',
  };
  const title = titleByReason[cleanReason] || 'Intento de manipulación del cliente (DevTools)';
  const actorLabel = session.displayName || session.user || 'Usuario';
  const roleTagSuffix = session.tag ? `${session.role} · ${session.tag}` : session.role;
  const description = `${actorLabel} (${roleTagSuffix}) disparó alerta de protección cliente (${cleanReason})${cleanDetail ? `: ${cleanDetail}` : ''}.`;

  try {
    await recordSecurityAlert({
      code: 'devtools_tamper_attempt',
      severity: 'high',
      category: 'access',
      title,
      description,
      actorRole: session.role,
      actorName: actorLabel,
      actorTag: session.tag || null,
      ipMasked: maskIp(clientIp),
      metadata: {
        reason: cleanReason,
        detail: cleanDetail || null,
        userId: session.userId || null,
      },
    });
    return res.status(200).json({ ok: true, recorded: true });
  } catch (err) {
    logServerError('POST /api/security/client-tamper', err);
    return res.status(503).json({ error: 'No se pudo registrar el evento de seguridad.' });
  }
});

// ----------------------------------------------------------------------------
// Admin-Only Operational Activity Log Endpoint (/api/activity)
// ----------------------------------------------------------------------------

app.get('/api/activity', requireAdminRole, async (_req, res) => {
  applyNoStoreHeaders(res);
  try {
    const store = await getActiveStore();
    const logs = getActiveActivityLogs(store);
    return res.json({ ok: true, logs });
  } catch (err) {
    logServerError('GET /api/activity', err);
    return res.status(503).json({ error: 'No se pudo consultar el historial de actividad.' });
  }
});

// ----------------------------------------------------------------------------
// Admin-Only Security & Anti-Fraud Center Endpoints (/api/security/alerts)
// ----------------------------------------------------------------------------

app.get('/api/security/alerts', requireAdminRole, async (_req, res) => {
  applyNoStoreHeaders(res);
  try {
    const store = await getActiveStore();
    const alerts = Array.isArray(store.securityAlerts)
      ? store.securityAlerts
          .map(normalizeSecurityAlertRecord)
          .filter(Boolean)
          .slice(0, MAX_SECURITY_ALERTS)
      : [];
    return res.json({ ok: true, alerts });
  } catch (err) {
    logServerError('GET /api/security/alerts', err);
    return res.status(503).json({ error: 'No se pudieron consultar las alertas de seguridad.' });
  }
});

app.patch('/api/security/alerts/:id', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { id } = req.params;
  const { status, reviewNote } = req.body || {};

  if (!VALID_SECURITY_ALERT_STATUSES.has(status)) {
    return res.status(400).json({
      error: 'Estado de alerta inválido. Valores permitidos: open, reviewed, dismissed.',
    });
  }

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const currentAlerts = Array.isArray(store.securityAlerts)
        ? store.securityAlerts.map(normalizeSecurityAlertRecord).filter(Boolean)
        : [];
      const index = currentAlerts.findIndex((item) => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Alerta de seguridad no encontrada.' });
      }

      const existing = currentAlerts[index];
      const nowIso = new Date().toISOString();
      const reviewerName = req.dsbSession?.displayName || req.dsbSession?.user || 'Admin';
      const cleanedNote =
        typeof reviewNote === 'string'
          ? reviewNote.trim().slice(0, 500) || null
          : existing.reviewNote ?? null;

      const updatedAlert = normalizeSecurityAlertRecord({
        ...existing,
        status,
        reviewedBy: status === 'open' ? null : reviewerName,
        reviewedAt: status === 'open' ? null : nowIso,
        reviewNote: cleanedNote,
      });

      const nextAlerts = [...currentAlerts];
      nextAlerts[index] = updatedAlert;

      const secUpdateActivity = {
        action: 'security_alert_updated',
        category: 'security',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary: `${reviewerName} cambió el estado de la alerta "${updatedAlert.title}" de ${existing.status} a ${updatedAlert.status}.`,
        fromState: existing.status,
        toState: updatedAlert.status,
        targetType: 'security',
        targetId: updatedAlert.id,
        targetLabel: updatedAlert.title,
        metadata: {
          code: updatedAlert.code,
          severity: updatedAlert.severity,
        },
      };

      if (USE_SUPABASE) {
        saveFallbackSecurityAlerts(nextAlerts);
        if (!securityAlertsTableMissing) {
          try {
            await supabaseRest(`security_alerts?id=eq.${encodeURIComponent(id)}`, {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({
                status: updatedAlert.status,
                reviewed_by: updatedAlert.reviewedBy,
                reviewed_at: updatedAlert.reviewedAt,
                review_note: updatedAlert.reviewNote,
              }),
            });
          } catch (err) {
            if (isMissingSecurityAlertsTableError(err)) {
              securityAlertsTableMissing = true;
            } else {
              throw err;
            }
          }
        }
        await recordActivityLog(secUpdateActivity);
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts);
        return res.json({
          ok: true,
          alert: updatedAlert,
          alerts: sanitized.securityAlerts,
          state: sanitized,
        });
      }

      store.securityAlerts = nextAlerts.slice(0, MAX_SECURITY_ALERTS);
      await recordActivityLog(secUpdateActivity, { store });
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, req.dsbSession, 'admin', accounts);
      return res.json({
        ok: true,
        alert: updatedAlert,
        alerts: sanitized.securityAlerts,
        state: sanitized,
      });
    } catch (err) {
      logServerError('PATCH /api/security/alerts/:id', err);
      return res.status(503).json({ error: 'No se pudo actualizar el estado de la alerta.' });
    }
  });
});

app.post('/api/security/alerts/bulk-status', requireAdminRole, async (req, res) => {
  applyNoStoreHeaders(res);
  const { action } = req.body || {};
  if (action !== 'mark_all_reviewed' && action !== 'clear_resolved') {
    return res.status(400).json({
      error: 'Acción inválida. Usa "mark_all_reviewed" o "clear_resolved".',
    });
  }

  return withStoreMutationLock(async () => {
    try {
      const [store, accounts] = await Promise.all([getActiveStore(), fetchAllAuthAccounts()]);
      const currentAlerts = Array.isArray(store.securityAlerts)
        ? store.securityAlerts.map(normalizeSecurityAlertRecord).filter(Boolean)
        : [];
      const nowIso = new Date().toISOString();
      const reviewerName = req.dsbSession?.displayName || req.dsbSession?.user || 'Admin';

      let nextAlerts;
      if (action === 'mark_all_reviewed') {
        nextAlerts = currentAlerts.map((item) =>
          item.status === 'open'
            ? {
                ...item,
                status: 'reviewed',
                reviewedBy: reviewerName,
                reviewedAt: nowIso,
              }
            : item
        );
      } else {
        nextAlerts = currentAlerts.filter((item) => item.status === 'open');
      }

      const secBulkActivity = {
        action: 'security_alert_updated',
        category: 'security',
        ...buildActorFromSession(req.dsbSession, 'admin', 'Administrador'),
        summary:
          action === 'mark_all_reviewed'
            ? `${reviewerName} marcó todas las alertas abiertas como revisadas.`
            : `${reviewerName} limpió todas las alertas revisadas o descartadas.`,
        fromState: null,
        toState: action === 'mark_all_reviewed' ? 'reviewed' : 'cleared',
        targetType: 'security',
        targetId: null,
        targetLabel: action === 'mark_all_reviewed' ? 'Revisión masiva de alertas' : 'Limpieza de alertas',
        metadata: {
          bulkAction: action,
        },
      };

      if (USE_SUPABASE) {
        saveFallbackSecurityAlerts(nextAlerts);
        if (!securityAlertsTableMissing) {
          try {
            if (action === 'mark_all_reviewed') {
              await supabaseRest('security_alerts?status=eq.open', {
                method: 'PATCH',
                headers: { Prefer: 'return=minimal' },
                body: JSON.stringify({
                  status: 'reviewed',
                  reviewed_by: reviewerName,
                  reviewed_at: nowIso,
                }),
              });
            } else {
              await supabaseRest('security_alerts?status=in.(reviewed,dismissed)', {
                method: 'DELETE',
              });
            }
          } catch (err) {
            if (isMissingSecurityAlertsTableError(err)) {
              securityAlertsTableMissing = true;
            } else {
              throw err;
            }
          }
        }
        await recordActivityLog(secBulkActivity);
        const updatedStore = await getActiveStore();
        const sanitized = sanitizeStateForClient(updatedStore, req.dsbSession, 'admin', accounts);
        return res.json({
          ok: true,
          alerts: sanitized.securityAlerts,
          state: sanitized,
        });
      }

      store.securityAlerts = nextAlerts.slice(0, MAX_SECURITY_ALERTS);
      await recordActivityLog(secBulkActivity, { store });
      writeStore(store);
      const sanitized = sanitizeStateForClient(store, req.dsbSession, 'admin', accounts);
      return res.json({
        ok: true,
        alerts: sanitized.securityAlerts,
        state: sanitized,
      });
    } catch (err) {
      logServerError('POST /api/security/alerts/bulk-status', err);
      return res.status(503).json({ error: 'No se pudo actualizar el lote de alertas.' });
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
  normalizePhoneKey,
  maskPhone,
  maskIp,
  detectSuspiciousPhonePattern,
  normalizeSecurityAlertRecord,
  mapSecurityAlertRow,
  normalizeActivityLogRecord,
  mapActivityLogRow,
  recordActivityLog,
  getActiveActivityLogs,
  resetFraudTrackers,
  sanitizeAvatarUrl,
  sanitizeEmojiInput,
  sanitizeReferralPrizeRule,
  normalizeReferrerRecord,
  normalizeVisitEvent,
  leadBelongsToVendedor,
  verifyAnyAdminPassword,
  enforceRefParamOnUrl,
  pickWeightedGift,
  isMissingColumnError,
  supabaseWriteWithOptionalColumns,
  encodeAccountLegacyMeta,
  decodeAccountLegacyMeta,
  hashSecret,
  mapAuthAccountRow,
  persistNewAuthAccount,
  persistUpdatedAuthAccount,
  persistDeletedAuthAccount,
  mapGiftRow,
  mapLeadRow,
  mapQrRow,
  mapReferrerRow,
  mapVisitRow,
  memoryGiftProbabilities,
  memoryLeadPromoStates,
  memoryLeadWorkflowStates,
  memoryAccountMeta,
  memoryAccountDbIds,
  memoryReferrerAccountIds,
  memoryReferrerMeta,
  memoryQrAccountIds,
};

export default app;
