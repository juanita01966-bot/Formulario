import defaultStoreJson from '../shared/defaultStore.json';
import type {
  ActivityLogCategory,
  ActivityLogEntry,
  AppSettings,
  AppState,
  AuthSessionInfo,
  CallOutcome,
  GiftItem,
  GiftVisualKey,
  Lead,
  LeadCategory,
  LeadQualification,
  ProcessControls,
  QrCodeRecord,
  QrDotShape,
  QrStyleId,
  ReferralMetricKey,
  ReferralPartner,
  ReferralPartnerType,
  ReferralPrizeRule,
  ReferralVisitEvent,
  SecurityAlert,
  SecurityAlertCategory,
  SecurityAlertSeverity,
  SecurityAlertStatus,
  ShowcaseStyleId,
  SystemHealthReport,
  UserAccount,
  UserRole,
} from '../types/app';

const STORAGE_KEY = 'royal_konverta_autumn_store_v1';
const CHANNEL_NAME = 'royal_konverta_sync';
const DSB_SESSION_TOKEN_KEY = 'cipriano_dsb_session_token';
export const DSB_ROLE_KEY = 'cipriano_dsb_role';
const DSB_USER_KEY = 'cipriano_dsb_user';
export const DSB_SESSION_REVOKED_EVENT = 'dsb-session-revoked';

const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

export interface StoredSessionUser {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  tag: string;
  avatarUrl?: string | null;
}

function getDsbSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(DSB_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function isElevatedAdminRole(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'ai_manager';
}

function getDsbRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DSB_ROLE_KEY);
    if (raw === 'caller') return 'telemarketing';
    if (raw === 'ai_manager' || raw === 'admin' || raw === 'telemarketing' || raw === 'vendedor') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function getStoredSessionUser(): StoredSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DSB_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSessionUser>;
    if (!parsed.username || !parsed.role) return null;
    return {
      userId: parsed.userId || '',
      username: parsed.username,
      displayName: parsed.displayName || parsed.username,
      role: parsed.role,
      tag: parsed.tag || '',
      avatarUrl: typeof parsed.avatarUrl === 'string' && parsed.avatarUrl.trim() ? parsed.avatarUrl.trim() : null,
    };
  } catch {
    return null;
  }
}

function saveSessionStorage(sessionToken: string, user: StoredSessionUser): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(DSB_SESSION_TOKEN_KEY, sessionToken);
    window.sessionStorage.setItem(DSB_ROLE_KEY, user.role);
    window.sessionStorage.setItem(DSB_USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

function clearSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DSB_SESSION_TOKEN_KEY);
    window.sessionStorage.removeItem(DSB_ROLE_KEY);
    window.sessionStorage.removeItem(DSB_USER_KEY);
    window.sessionStorage.removeItem('konverta_dsb_unlocked');
  } catch {
    // Ignore storage errors
  }
}

function notifySessionRevoked(message?: string): void {
  clearSessionStorage();
  latestCommittedState = null;
  stateMutationEpoch += 1;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DSB_SESSION_REVOKED_EVENT, {
        detail: {
          message: message || 'Tu sesión fue cerrada por seguridad. Inicia sesión nuevamente.',
        },
      })
    );
  }
}

function decodeBase64UrlJson<T = Record<string, unknown>>(segment: string): T | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    const binary = window.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonText =
      typeof TextDecoder !== 'undefined'
        ? new TextDecoder().decode(bytes)
        : decodeURIComponent(escape(binary));
    const parsed = JSON.parse(jsonText) as T;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Verifies that sessionStorage role/user metadata matches the signed HMAC/JWT
 * token payload. Detects DevTools -> Session Storage tampering (e.g. changing
 * `cipriano_dsb_role` from `vendedor` to `admin` or spoofing `cipriano_dsb_user`).
 */
export function verifySessionStorageIntegrity(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const token = window.sessionStorage.getItem(DSB_SESSION_TOKEN_KEY);
    const rawRole = window.sessionStorage.getItem(DSB_ROLE_KEY);
    const rawUser = window.sessionStorage.getItem(DSB_USER_KEY);

    // No session data present -> nothing tampered.
    if (!token && !rawRole && !rawUser) {
      return true;
    }

    // Role or user metadata injected without a signed token -> tampered.
    if (!token) {
      return false;
    }

    // Support both 2-part HMAC (`payload.sig`, used by server/index.js) and
    // 3-part JWT (`header.payload.sig`).
    const parts = token.split('.');
    let payloadSegment = '';
    if (parts.length === 2 && parts[0] && parts[1]) {
      payloadSegment = parts[0];
    } else if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      payloadSegment = parts[1];
    } else {
      return false;
    }

    const payload = decodeBase64UrlJson<{
      scope?: string;
      userId?: string;
      user?: string;
      username?: string;
      role?: string;
      exp?: number;
    }>(payloadSegment);

    if (!payload) return false;
    if (payload.scope && payload.scope !== 'dsb_session') return false;

    const tokenRoleRaw = payload.role === 'caller' ? 'telemarketing' : payload.role;
    if (
      tokenRoleRaw !== 'ai_manager' &&
      tokenRoleRaw !== 'admin' &&
      tokenRoleRaw !== 'telemarketing' &&
      tokenRoleRaw !== 'vendedor'
    ) {
      return false;
    }

    const tokenUsername = String(payload.user || payload.username || '').trim();
    if (!tokenUsername) return false;

    // Must match stored role key strictly.
    const storedRoleNormalized = rawRole === 'caller' ? 'telemarketing' : rawRole;
    if (!storedRoleNormalized || storedRoleNormalized !== tokenRoleRaw) {
      return false;
    }

    // Must match stored user JSON strictly.
    if (!rawUser) return false;
    const parsedUser = JSON.parse(rawUser) as Partial<StoredSessionUser> | null;
    if (!parsedUser || typeof parsedUser !== 'object') return false;

    const storedUserRole =
      (parsedUser.role as string) === 'caller' ? 'telemarketing' : parsedUser.role;
    if (!storedUserRole || storedUserRole !== tokenRoleRaw) {
      return false;
    }

    const storedUsername = String(parsedUser.username || '').trim();
    if (!storedUsername || storedUsername.toLowerCase() !== tokenUsername.toLowerCase()) {
      return false;
    }

    if (
      payload.userId &&
      parsedUser.userId &&
      String(parsedUser.userId).trim() !== String(payload.userId).trim()
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_GIFT_PROBABILITY = 10;

export const DEFAULT_PROCESS_CONTROLS: ProcessControls = {
  publicFormEnabled: true,
  publicFormDisabledTitle: 'Experiencia en Pausa Temporal',
  publicFormDisabledMessage:
    'Estamos preparando una nueva edición del Show de Cocina Royal Prestige. Vuelve muy pronto.',
  welcomeVideoEnabled: true,
  qualificationQuizEnabled: true,
  giftRevealEnabled: true,
  clientGuardEnabled: true,
};

export function normalizeProcessControls(
  controls?: Partial<ProcessControls> | null
): ProcessControls {
  const src = controls && typeof controls === 'object' ? controls : {};
  const publicFormDisabledTitle =
    typeof src.publicFormDisabledTitle === 'string' && src.publicFormDisabledTitle.trim()
      ? src.publicFormDisabledTitle.trim().slice(0, 140)
      : DEFAULT_PROCESS_CONTROLS.publicFormDisabledTitle;
  const publicFormDisabledMessage =
    typeof src.publicFormDisabledMessage === 'string' && src.publicFormDisabledMessage.trim()
      ? src.publicFormDisabledMessage.trim().slice(0, 500)
      : DEFAULT_PROCESS_CONTROLS.publicFormDisabledMessage;
  return {
    publicFormEnabled:
      typeof src.publicFormEnabled === 'boolean'
        ? src.publicFormEnabled
        : DEFAULT_PROCESS_CONTROLS.publicFormEnabled,
    publicFormDisabledTitle,
    publicFormDisabledMessage,
    welcomeVideoEnabled:
      typeof src.welcomeVideoEnabled === 'boolean'
        ? src.welcomeVideoEnabled
        : DEFAULT_PROCESS_CONTROLS.welcomeVideoEnabled,
    qualificationQuizEnabled:
      typeof src.qualificationQuizEnabled === 'boolean'
        ? src.qualificationQuizEnabled
        : DEFAULT_PROCESS_CONTROLS.qualificationQuizEnabled,
    giftRevealEnabled:
      typeof src.giftRevealEnabled === 'boolean'
        ? src.giftRevealEnabled
        : DEFAULT_PROCESS_CONTROLS.giftRevealEnabled,
    clientGuardEnabled:
      typeof src.clientGuardEnabled === 'boolean'
        ? src.clientGuardEnabled
        : DEFAULT_PROCESS_CONTROLS.clientGuardEnabled,
  };
}

export const DEFAULT_REFERRAL_PRIZE_RULE: ReferralPrizeRule = {
  prizeName: 'Premio Embajador Royal Prestige',
  metric: 'leads',
  targetCount: 5,
  maxWinners: 3,
  pointsPerLead: 1,
  pointsPerCita: 3,
  pointsPerDemo: 5,
  pointsPerOrden: 10,
};

const VALID_REFERRAL_METRICS = new Set<ReferralMetricKey>([
  'leads',
  'citas',
  'demos',
  'ordenes',
  'points',
]);

const VALID_QR_STYLE_IDS = new Set<QrStyleId>([
  'classic-gold',
  'obsidian-dots',
  'ivory-rounded',
  'emerald-heritage',
  'ruby-atelier',
]);

const VALID_CALL_OUTCOMES = new Set<CallOutcome>(['pending', 'scheduled', 'not_scheduled']);

const VALID_ALERT_SEVERITIES = new Set<SecurityAlertSeverity>(['critical', 'high', 'medium', 'info']);
const VALID_ALERT_CATEGORIES = new Set<SecurityAlertCategory>([
  'qr_abuse',
  'vendedor',
  'telemarketing',
  'access',
  'audit',
]);
const VALID_ALERT_STATUSES = new Set<SecurityAlertStatus>(['open', 'reviewed', 'dismissed']);

const VALID_ACTIVITY_CATEGORIES = new Set<ActivityLogCategory>([
  'leads',
  'telemarketing',
  'status',
  'accounts',
  'qr',
  'catalog',
  'security',
  'system',
]);

const VALID_ACTIVITY_ACTOR_ROLES = new Set<ActivityLogEntry['actorRole']>([
  'ai_manager',
  'admin',
  'telemarketing',
  'vendedor',
  'public',
  'system',
]);

const VALID_ACTIVITY_TARGET_TYPES = new Set<NonNullable<ActivityLogEntry['targetType']>>([
  'lead',
  'account',
  'qr',
  'referrer',
  'gift',
  'settings',
  'security',
  'system',
]);

function normalizeActivityLogEntry(entry: ActivityLogEntry): ActivityLogEntry {
  const category: ActivityLogCategory = VALID_ACTIVITY_CATEGORIES.has(entry.category)
    ? entry.category
    : 'system';
  const rawActorRole = (entry.actorRole as string) === 'caller' ? 'telemarketing' : entry.actorRole;
  const actorRole: ActivityLogEntry['actorRole'] = VALID_ACTIVITY_ACTOR_ROLES.has(
    rawActorRole as ActivityLogEntry['actorRole']
  )
    ? (rawActorRole as ActivityLogEntry['actorRole'])
    : 'system';
  const targetType =
    entry.targetType && VALID_ACTIVITY_TARGET_TYPES.has(entry.targetType)
      ? entry.targetType
      : undefined;

  return {
    id: String(entry.id || ''),
    action: String(entry.action || 'activity'),
    category,
    actorRole,
    actorId: entry.actorId ?? null,
    actorName: String(entry.actorName || '').trim() || 'Sistema',
    actorUsername: entry.actorUsername ?? null,
    actorTag: entry.actorTag ?? null,
    summary: String(entry.summary || ''),
    fromState: entry.fromState ?? null,
    toState: entry.toState ?? null,
    ...(targetType ? { targetType } : {}),
    targetId: entry.targetId ?? null,
    targetLabel: entry.targetLabel ?? null,
    ...(entry.metadata && typeof entry.metadata === 'object' ? { metadata: entry.metadata } : {}),
    createdAt: entry.createdAt || new Date().toISOString(),
  };
}

export function normalizePhoneKey(raw: unknown): string {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

function normalizeSecurityAlert(alert: SecurityAlert): SecurityAlert {
  const severity: SecurityAlertSeverity = VALID_ALERT_SEVERITIES.has(alert.severity)
    ? alert.severity
    : 'info';
  const category: SecurityAlertCategory = VALID_ALERT_CATEGORIES.has(alert.category)
    ? alert.category
    : 'audit';
  const status: SecurityAlertStatus = VALID_ALERT_STATUSES.has(alert.status)
    ? alert.status
    : 'open';
  return {
    id: String(alert.id || ''),
    code: String(alert.code || 'security_event'),
    severity,
    category,
    status,
    title: String(alert.title || 'Evento de seguridad'),
    description: String(alert.description || ''),
    ...(alert.actorRole ? { actorRole: alert.actorRole } : {}),
    actorName: alert.actorName ?? null,
    actorTag: alert.actorTag ?? null,
    leadId: alert.leadId ?? null,
    leadName: alert.leadName ?? null,
    claimCode: alert.claimCode ?? null,
    phoneMasked: alert.phoneMasked ?? null,
    referralCode: alert.referralCode ?? null,
    ipMasked: alert.ipMasked ?? null,
    ...(alert.metadata && typeof alert.metadata === 'object' ? { metadata: alert.metadata } : {}),
    reviewedBy: alert.reviewedBy ?? null,
    reviewedAt: alert.reviewedAt ?? null,
    reviewNote: alert.reviewNote ?? null,
    createdAt: alert.createdAt || new Date().toISOString(),
  };
}

export function normalizeReferralCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
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
  return cleaned.length >= 2 ? cleaned : '';
}

function normalizePositiveInt(value: unknown, fallback: number, min = 1, max = 100000): number {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function normalizeReferralPrizeRule(
  rule?: Partial<ReferralPrizeRule> | null
): ReferralPrizeRule {
  const src = rule && typeof rule === 'object' ? rule : {};
  const prizeName =
    typeof src.prizeName === 'string' && src.prizeName.trim()
      ? src.prizeName.trim().slice(0, 140)
      : DEFAULT_REFERRAL_PRIZE_RULE.prizeName;
  const metric: ReferralMetricKey =
    typeof src.metric === 'string' && VALID_REFERRAL_METRICS.has(src.metric as ReferralMetricKey)
      ? (src.metric as ReferralMetricKey)
      : DEFAULT_REFERRAL_PRIZE_RULE.metric;

  return {
    prizeName,
    metric,
    targetCount: normalizePositiveInt(
      src.targetCount,
      DEFAULT_REFERRAL_PRIZE_RULE.targetCount,
      1,
      100000
    ),
    maxWinners: normalizePositiveInt(
      src.maxWinners,
      DEFAULT_REFERRAL_PRIZE_RULE.maxWinners,
      0,
      1000
    ),
    pointsPerLead: normalizePositiveInt(
      src.pointsPerLead,
      DEFAULT_REFERRAL_PRIZE_RULE.pointsPerLead,
      0,
      10000
    ),
    pointsPerCita: normalizePositiveInt(
      src.pointsPerCita,
      DEFAULT_REFERRAL_PRIZE_RULE.pointsPerCita,
      0,
      10000
    ),
    pointsPerDemo: normalizePositiveInt(
      src.pointsPerDemo,
      DEFAULT_REFERRAL_PRIZE_RULE.pointsPerDemo,
      0,
      10000
    ),
    pointsPerOrden: normalizePositiveInt(
      src.pointsPerOrden,
      DEFAULT_REFERRAL_PRIZE_RULE.pointsPerOrden,
      0,
      10000
    ),
  };
}

function normalizeReferralPartner(partner: ReferralPartner): ReferralPartner {
  const visitsCount = Math.max(0, Math.round(Number(partner.visitsCount) || 0));
  const uniqueVisitsCount = Math.max(0, Math.round(Number(partner.uniqueVisitsCount) || 0));
  const code =
    normalizeReferralCode(partner.code) ||
    String(partner.code || '')
      .trim()
      .toUpperCase();
  const partnerType: ReferralPartnerType =
    partner.partnerType === 'embajador' ? 'embajador' : 'vendedor';
  const ownerVendedorAccountId =
    typeof partner.ownerVendedorAccountId === 'string' && partner.ownerVendedorAccountId.trim()
      ? partner.ownerVendedorAccountId.trim()
      : null;
  const ownerVendedorName =
    typeof partner.ownerVendedorName === 'string' && partner.ownerVendedorName.trim()
      ? partner.ownerVendedorName.trim()
      : null;
  const ownerVendedorTag =
    typeof partner.ownerVendedorTag === 'string' && partner.ownerVendedorTag.trim()
      ? normalizeReferralCode(partner.ownerVendedorTag) || partner.ownerVendedorTag.trim().toUpperCase()
      : null;
  const emoji =
    typeof partner.emoji === 'string' && partner.emoji.trim() ? partner.emoji.trim() : null;

  return {
    id: String(partner.id || ''),
    accountId: partnerType === 'embajador' ? null : partner.accountId ?? null,
    partnerType,
    ownerVendedorAccountId,
    ownerVendedorName,
    ownerVendedorTag,
    name: String(partner.name || '').trim(),
    code,
    emoji,
    avatarUrl:
      typeof partner.avatarUrl === 'string' && partner.avatarUrl.trim()
        ? partner.avatarUrl.trim()
        : null,
    ...(typeof partner.phone === 'string' && partner.phone.trim()
      ? { phone: partner.phone.trim() }
      : {}),
    ...(typeof partner.notes === 'string' && partner.notes.trim()
      ? { notes: partner.notes.trim() }
      : {}),
    active: typeof partner.active === 'boolean' ? partner.active : true,
    visitsCount,
    uniqueVisitsCount: Math.min(uniqueVisitsCount, visitsCount || uniqueVisitsCount),
    lastVisitAt: partner.lastVisitAt ?? null,
    ...(partner.qrStyleId && VALID_QR_STYLE_IDS.has(partner.qrStyleId)
      ? { qrStyleId: partner.qrStyleId }
      : {}),
    createdAt: partner.createdAt || new Date().toISOString(),
  };
}

function normalizeVisitEvent(entry: ReferralVisitEvent): ReferralVisitEvent {
  return {
    id: String(entry.id || ''),
    referrerId: entry.referrerId ?? null,
    referralCode: normalizeReferralCode(entry.referralCode) || String(entry.referralCode || '').toUpperCase(),
    visitorId: String(entry.visitorId || 'anon'),
    visitedAt: entry.visitedAt || new Date().toISOString(),
  };
}

export function sanitizeGiftProbability(
  value: unknown,
  fallback = DEFAULT_GIFT_PROBABILITY
): number {
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

function normalizeGift(gift: GiftItem): GiftItem {
  return {
    ...gift,
    probability: sanitizeGiftProbability(gift.probability, DEFAULT_GIFT_PROBABILITY),
  };
}

function normalizeLead(lead: Lead): Lead {
  const category = lead.category || 'none';
  const callOutcome: CallOutcome = VALID_CALL_OUTCOMES.has(lead.callOutcome)
    ? lead.callOutcome
    : lead.called
      ? 'scheduled'
      : 'pending';
  const called = Boolean(lead.called) || callOutcome !== 'pending';
  const sellerLocked = Boolean(lead.sellerLocked);
  const promoCodeInvalidated =
    typeof lead.promoCodeInvalidated === 'boolean'
      ? lead.promoCodeInvalidated || category !== 'none' || sellerLocked
      : category !== 'none' || sellerLocked;
  const promoCodeInvalidatedAt = promoCodeInvalidated
    ? lead.promoCodeInvalidatedAt ?? lead.sellerConfirmedAt ?? lead.calledAt ?? lead.createdAt ?? null
    : null;
  const referralCode =
    typeof lead.referralCode === 'string' && lead.referralCode.trim()
      ? normalizeReferralCode(lead.referralCode) || lead.referralCode.trim().toUpperCase()
      : null;
  const referrerId =
    typeof lead.referrerId === 'string' && lead.referrerId.trim() ? lead.referrerId.trim() : null;
  const referrerName =
    typeof lead.referrerName === 'string' && lead.referrerName.trim()
      ? lead.referrerName.trim()
      : null;

  return {
    ...lead,
    called,
    calledAt: called ? lead.calledAt ?? null : null,
    callOutcome,
    calledBy: lead.calledBy ?? null,
    scheduledAt: callOutcome === 'scheduled' ? lead.scheduledAt ?? lead.calledAt ?? null : null,
    category,
    promoCodeInvalidated,
    promoCodeInvalidatedAt,
    sellerLocked,
    sellerConfirmedAt: sellerLocked ? lead.sellerConfirmedAt ?? promoCodeInvalidatedAt : null,
    sellerConfirmedBy: sellerLocked ? lead.sellerConfirmedBy ?? null : null,
    referralCode,
    referrerId,
    referrerName,
  };
}

function normalizeAppState(state: AppState): AppState {
  const hasDsbSession = Boolean(getDsbSessionToken());
  const role = state.role;
  const effectiveRole = role ?? getDsbRole();
  const isAdmin = hasDsbSession && isElevatedAdminRole(effectiveRole);
  const processControls = normalizeProcessControls(state.settings?.processControls);
  if (role === 'telemarketing') {
    return {
      ...state,
      settings: {
        ...state.settings,
        pinCode: '',
        referralPrizeRule: normalizeReferralPrizeRule(state.settings?.referralPrizeRule),
        processControls,
      },
      gifts: [],
      leads: Array.isArray(state.leads) ? state.leads.map(normalizeLead) : [],
      qrHistory: [],
      referrers: Array.isArray(state.referrers)
        ? state.referrers.map(normalizeReferralPartner)
        : [],
      accounts: [],
      visitLog: [],
      securityAlerts: [],
      activityLogs: [],
      role: 'telemarketing',
    };
  }
  return {
    ...state,
    settings: {
      ...state.settings,
      pinCode: '',
      randomizeGifts:
        typeof state.settings?.randomizeGifts === 'boolean'
          ? state.settings.randomizeGifts
          : true,
      referralPrizeRule: normalizeReferralPrizeRule(state.settings?.referralPrizeRule),
      processControls,
    },
    gifts: Array.isArray(state.gifts) ? state.gifts.map(normalizeGift) : [],
    leads: Array.isArray(state.leads) ? state.leads.map(normalizeLead) : [],
    qrHistory: Array.isArray(state.qrHistory) ? state.qrHistory : [],
    referrers: Array.isArray(state.referrers)
      ? state.referrers.map(normalizeReferralPartner)
      : [],
    accounts: Array.isArray(state.accounts) ? state.accounts : [],
    visitLog: Array.isArray(state.visitLog) ? state.visitLog.map(normalizeVisitEvent) : [],
    securityAlerts:
      isAdmin && Array.isArray(state.securityAlerts)
        ? state.securityAlerts.map(normalizeSecurityAlert)
        : [],
    activityLogs:
      isAdmin && Array.isArray(state.activityLogs)
        ? state.activityLogs.map(normalizeActivityLogEntry)
        : [],
    ...(role ? { role } : {}),
  };
}

const TAB_INSTANCE_ID = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let stateMutationEpoch = 0;
let activeMutationCount = 0;
let latestCommittedState: AppState | null = null;
let latestFetchSeq = 0;
let lastWrittenLocalJson = '';

function beginMutation(): void {
  activeMutationCount += 1;
  stateMutationEpoch += 1;
}

function commitMutatedState(state: AppState, broadcast = true): AppState {
  const normalized = normalizeAppState(state);
  stateMutationEpoch += 1;
  latestCommittedState = normalized;
  writeLocalState(normalized, broadcast);
  return normalized;
}

function endMutation(): void {
  activeMutationCount = Math.max(0, activeMutationCount - 1);
}

function cloneDefaults(): AppState {
  const defaults = JSON.parse(JSON.stringify(defaultStoreJson)) as AppState;
  return {
    ...defaults,
    settings: {
      ...defaults.settings,
      pinCode: '',
      randomizeGifts:
        typeof defaults.settings?.randomizeGifts === 'boolean'
          ? defaults.settings.randomizeGifts
          : true,
      referralPrizeRule: normalizeReferralPrizeRule(defaults.settings?.referralPrizeRule),
      processControls: normalizeProcessControls(defaults.settings?.processControls),
    },
    gifts: Array.isArray(defaults.gifts) ? defaults.gifts.map(normalizeGift) : [],
    leads: [],
    qrHistory: [],
    referrers: [],
    accounts: [],
    visitLog: [],
    securityAlerts: [],
    activityLogs: [],
  };
}

interface PublicCatalogStorage {
  settings: AppSettings;
  gifts: GiftItem[];
}

const LEGACY_PII_STORAGE_KEYS = [
  'leads',
  'qrHistory',
  'referrers',
  'accounts',
  'visitLog',
  'securityAlerts',
  'activityLogs',
] as const;

function buildPublicCatalogSnapshot(
  source?: Partial<AppState> | null
): PublicCatalogStorage {
  const defaults = cloneDefaults();
  const rawGifts =
    Array.isArray(source?.gifts) && source.gifts.length > 0 ? source.gifts : defaults.gifts;
  const mergedSettings: AppSettings = {
    ...defaults.settings,
    ...(source?.settings || {}),
    pinCode: '',
    referralPrizeRule: normalizeReferralPrizeRule(
      source?.settings?.referralPrizeRule ?? defaults.settings.referralPrizeRule
    ),
    processControls: normalizeProcessControls(
      source?.settings?.processControls ?? defaults.settings.processControls
    ),
  };
  if (typeof mergedSettings.randomizeGifts !== 'boolean') {
    mergedSettings.randomizeGifts =
      typeof defaults.settings.randomizeGifts === 'boolean'
        ? defaults.settings.randomizeGifts
        : true;
  }
  return {
    settings: mergedSettings,
    gifts: rawGifts.map(normalizeGift),
  };
}

function hasLegacyPiiKeys(parsed: Record<string, unknown>): boolean {
  const parsedSettings = parsed.settings as Record<string, unknown> | undefined;
  return (
    LEGACY_PII_STORAGE_KEYS.some((key) => key in parsed) ||
    'role' in parsed ||
    Boolean(
      parsedSettings &&
        typeof parsedSettings.pinCode === 'string' &&
        parsedSettings.pinCode.length > 0
    )
  );
}

function scrubLegacyLocalStoragePii(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') {
      window.localStorage.removeItem(STORAGE_KEY);
      lastWrittenLocalJson = '';
      return;
    }
    if (!hasLegacyPiiKeys(parsed)) return;
    const cleanCatalog = buildPublicCatalogSnapshot(parsed as Partial<AppState>);
    const serialized = JSON.stringify(cleanCatalog);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    lastWrittenLocalJson = serialized;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      lastWrittenLocalJson = '';
    } catch {
      // Ignore storage cleanup error
    }
  }
}

scrubLegacyLocalStoragePii();

function readLocalState(): AppState {
  if (typeof window === 'undefined') return cloneDefaults();
  const hasDsbSession = Boolean(getDsbSessionToken());
  const role = getDsbRole();
  const isAdmin = hasDsbSession && isElevatedAdminRole(role);
  const canSeeQr = hasDsbSession && (isElevatedAdminRole(role) || role === 'vendedor');
  const inMemory = latestCommittedState;

  let catalog: PublicCatalogStorage;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      catalog = buildPublicCatalogSnapshot(inMemory);
      const serialized = JSON.stringify(catalog);
      window.localStorage.setItem(STORAGE_KEY, serialized);
      lastWrittenLocalJson = serialized;
    } else {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      catalog = buildPublicCatalogSnapshot(parsed as Partial<AppState>);
      if (parsed && typeof parsed === 'object' && hasLegacyPiiKeys(parsed)) {
        const serialized = JSON.stringify(catalog);
        window.localStorage.setItem(STORAGE_KEY, serialized);
        lastWrittenLocalJson = serialized;
      }
    }
  } catch {
    catalog = buildPublicCatalogSnapshot(inMemory);
  }

  return {
    settings: catalog.settings,
    gifts: catalog.gifts,
    // Keep all PII & operational records strictly in memory (never persisted to localStorage).
    leads: Array.isArray(inMemory?.leads) ? inMemory.leads.map(normalizeLead) : [],
    qrHistory: canSeeQr && Array.isArray(inMemory?.qrHistory) ? inMemory.qrHistory : [],
    referrers:
      hasDsbSession && Array.isArray(inMemory?.referrers)
        ? inMemory.referrers.map(normalizeReferralPartner)
        : [],
    accounts: isAdmin && Array.isArray(inMemory?.accounts) ? inMemory.accounts : [],
    visitLog:
      canSeeQr && Array.isArray(inMemory?.visitLog)
        ? inMemory.visitLog.map(normalizeVisitEvent)
        : [],
    securityAlerts:
      isAdmin && Array.isArray(inMemory?.securityAlerts)
        ? inMemory.securityAlerts.map(normalizeSecurityAlert)
        : [],
    activityLogs:
      isAdmin && Array.isArray(inMemory?.activityLogs)
        ? inMemory.activityLogs.map(normalizeActivityLogEntry)
        : [],
    ...(inMemory?.role ? { role: inMemory.role } : {}),
  };
}

function writeLocalState(state: AppState, broadcast = true): void {
  if (typeof window === 'undefined') return;
  const hasDsbSession = Boolean(getDsbSessionToken());
  const role = state.role ?? getDsbRole();
  const isAdmin = hasDsbSession && isElevatedAdminRole(role);
  const canSeeQr = hasDsbSession && (isElevatedAdminRole(role) || role === 'vendedor');

  const sanitizedState: AppState = {
    settings: {
      ...state.settings,
      pinCode: '',
      referralPrizeRule: normalizeReferralPrizeRule(state.settings?.referralPrizeRule),
      processControls: normalizeProcessControls(state.settings?.processControls),
      ...(role === 'telemarketing'
        ? {}
        : {
            randomizeGifts:
              typeof state.settings?.randomizeGifts === 'boolean'
                ? state.settings.randomizeGifts
                : true,
          }),
    },
    gifts: Array.isArray(state.gifts) ? state.gifts.map(normalizeGift) : [],
    leads: hasDsbSession ? (state.leads || []).map(normalizeLead) : [],
    qrHistory: canSeeQr && Array.isArray(state.qrHistory) ? state.qrHistory : [],
    referrers:
      hasDsbSession && Array.isArray(state.referrers)
        ? state.referrers.map(normalizeReferralPartner)
        : [],
    accounts: isAdmin && Array.isArray(state.accounts) ? state.accounts : [],
    visitLog:
      canSeeQr && Array.isArray(state.visitLog)
        ? state.visitLog.map(normalizeVisitEvent)
        : [],
    securityAlerts:
      isAdmin && Array.isArray(state.securityAlerts)
        ? state.securityAlerts.map(normalizeSecurityAlert)
        : [],
    activityLogs:
      isAdmin && Array.isArray(state.activityLogs)
        ? state.activityLogs.map(normalizeActivityLogEntry)
        : [],
    ...(role ? { role } : {}),
  };

  try {
    // Persist ONLY non-PII public catalog (settings without pinCode + gifts) in localStorage.
    let giftsToPersist = sanitizedState.gifts;
    if (role === 'telemarketing' && giftsToPersist.length === 0) {
      try {
        const existingRaw = window.localStorage.getItem(STORAGE_KEY);
        if (existingRaw) {
          const existingParsed = JSON.parse(existingRaw) as Partial<AppState>;
          if (Array.isArray(existingParsed.gifts) && existingParsed.gifts.length > 0) {
            giftsToPersist = existingParsed.gifts.map(normalizeGift);
          }
        }
      } catch {
        // Ignore parse failure
      }
    }

    const publicCatalog: PublicCatalogStorage = {
      settings: {
        ...sanitizedState.settings,
        pinCode: '',
      },
      gifts: giftsToPersist,
    };

    const serialized = JSON.stringify(publicCatalog);
    if (serialized !== lastWrittenLocalJson) {
      window.localStorage.setItem(STORAGE_KEY, serialized);
      lastWrittenLocalJson = serialized;
    }
    if (broadcast && channel) {
      channel.postMessage({
        type: 'STATE_UPDATED',
        state: sanitizedState,
        tabId: TAB_INSTANCE_ID,
        sourceAuthed: hasDsbSession,
      });
    }
  } catch {
    // Ignore storage quota errors
  }
}

function generateLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateClaimCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `OTN-${num}`;
}

function cryptoRandomUnit(): number {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(2);
    cryptoObj.getRandomValues(buf);
    const hi = buf[0] >>> 11;
    const lo = buf[1];
    return (hi * 0x100000000 + lo) / 0x20000000000000;
  }
  return Math.random();
}

export function pickWeightedGift(gifts: GiftItem[]): GiftItem | null {
  if (!Array.isArray(gifts) || gifts.length === 0) return null;
  const weights = gifts.map((g) => sanitizeGiftProbability(g.probability, DEFAULT_GIFT_PROBABILITY));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    const idx = Math.min(gifts.length - 1, Math.floor(cryptoRandomUnit() * gifts.length));
    return gifts[idx] ?? null;
  }
  const target = cryptoRandomUnit() * totalWeight;
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
  return gifts[0] ?? null;
}

export class ApiValidationError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'ApiValidationError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getDsbSessionToken();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: init?.cache ?? 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
  }

  const data = (await res.json().catch(() => ({}))) as T & AuthErrorResponse;

  if (!res.ok) {
    if (res.status === 401 || res.status === 429) {
      if (
        res.status === 401 &&
        (data?.code === 'SESSION_REVOKED' || (Boolean(token) && url === '/api/state'))
      ) {
        notifySessionRevoked(data?.error);
      }
      throw new DsbAuthError({
        ...data,
        error:
          data.error ||
          (res.status === 429
            ? 'Demasiados intentos fallidos. Intenta de nuevo más tarde.'
            : 'Autorización requerida o credenciales incorrectas.'),
      });
    }
    if (
      res.status === 403 &&
      (data.locked !== undefined ||
        data.remainingAttempts !== undefined ||
        data.retryAfterSeconds !== undefined)
    ) {
      throw new DsbAuthError({
        ...data,
        error: data.error || 'Autorización denegada o contraseña de administrador incorrecta.',
      });
    }
    if (res.status === 404 && !data.error) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (res.status >= 400 && res.status < 500) {
      const errCode = typeof data.code === 'string' ? data.code : undefined;
      throw new ApiValidationError(data.error || 'Solicitud inválida.', res.status, errCode);
    }
    if (res.status === 503 && data.code === 'PUBLIC_FORM_DISABLED') {
      throw new ApiValidationError(
        data.error || 'El formulario público está temporalmente en pausa.',
        503,
        data.code
      );
    }
    throw new Error(data.error || `Error del servidor (HTTP ${res.status}). Intenta de nuevo.`);
  }

  return data;
}

export async function fetchAppState(): Promise<{
  state: AppState;
  mode: 'api' | 'local';
  stale?: boolean;
}> {
  const startEpoch = stateMutationEpoch;
  const mySeq = ++latestFetchSeq;

  if (activeMutationCount > 0 && latestCommittedState) {
    return { state: latestCommittedState, mode: 'api', stale: true };
  }

  try {
    const state = normalizeAppState(
      await requestJson<AppState>('/api/state', { cache: 'no-store' })
    );
    if (activeMutationCount > 0 || stateMutationEpoch !== startEpoch || mySeq !== latestFetchSeq) {
      return {
        state: latestCommittedState ?? readLocalState(),
        mode: 'api',
        stale: true,
      };
    }
    latestCommittedState = state;
    writeLocalState(state, false);
    return { state, mode: 'api', stale: false };
  } catch (err) {
    if (err instanceof ApiValidationError || err instanceof DsbAuthError) throw err;
    if (activeMutationCount > 0 || stateMutationEpoch !== startEpoch || mySeq !== latestFetchSeq) {
      return {
        state: latestCommittedState ?? readLocalState(),
        mode: 'local',
        stale: true,
      };
    }
    const localState = readLocalState();
    latestCommittedState = localState;
    return { state: localState, mode: 'local', stale: false };
  }
}

export const fetchWorkspaceState = fetchAppState;

// ----------------------------------------------------------------------------
// Leads API
// ----------------------------------------------------------------------------

export interface CreateLeadPayload {
  name: string;
  phone: string;
  address?: string;
  acceptedTerms: boolean;
  giftId?: string | null;
  giftName?: string | null;
  giftVisualKey?: GiftVisualKey | null;
  claimCode?: string;
  notes?: string;
  qualification?: LeadQualification | null;
  referralCode?: string | null;
  referrerId?: string | null;
  visitorId?: string | null;
}

export async function createLead(
  payload: CreateLeadPayload
): Promise<{ lead: Lead; state: AppState; mode: 'api' | 'local' }> {
  beginMutation();
  try {
    const res = await requestJson<{ lead: Lead; state: AppState }>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const normalizedState = commitMutatedState(res.state, Boolean(getDsbSessionToken()));
    return { lead: normalizeLead(res.lead), state: normalizedState, mode: 'api' };
  } catch (err) {
    if (err instanceof ApiValidationError || err instanceof DsbAuthError) throw err;

    const state = readLocalState();
    const incomingPhoneKey = normalizePhoneKey(payload.phone);
    if (incomingPhoneKey.length >= 7) {
      const hasDuplicatePhone = state.leads.some(
        (existing) => normalizePhoneKey(existing.phone) === incomingPhoneKey
      );
      if (hasDuplicatePhone) {
        throw new ApiValidationError(
          'Este número de teléfono ya está registrado. Solo se permite un registro por número.',
          409
        );
      }
    }

    const activeGifts = state.gifts.filter((g) => g.active);
    const chosenGift =
      state.gifts.find((g) => g.id === payload.giftId) ||
      (activeGifts.length > 0 ? pickWeightedGift(activeGifts) : null) ||
      state.gifts[0] ||
      null;

    const normalizedRefCode = payload.referralCode
      ? normalizeReferralCode(payload.referralCode)
      : '';
    const matchedReferrer = normalizedRefCode
      ? (state.referrers || []).find((r) => r.code === normalizedRefCode) || null
      : null;

    const lead: Lead = normalizeLead({
      id: generateLocalId('lead'),
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      address: payload.address?.trim() || '',
      acceptedTerms: payload.acceptedTerms,
      giftId: chosenGift ? chosenGift.id : payload.giftId || null,
      giftName: chosenGift ? chosenGift.name : payload.giftName || null,
      giftVisualKey: chosenGift ? chosenGift.visualKey : payload.giftVisualKey || null,
      claimCode: payload.claimCode || generateClaimCode(),
      called: false,
      calledAt: null,
      callOutcome: 'pending',
      calledBy: null,
      scheduledAt: null,
      category: 'none',
      orderAmount: null,
      notes: payload.notes?.trim() || '',
      qualification: payload.qualification ?? null,
      promoCodeInvalidated: false,
      promoCodeInvalidatedAt: null,
      sellerLocked: false,
      sellerConfirmedAt: null,
      sellerConfirmedBy: null,
      referralCode: normalizedRefCode || null,
      referrerId: matchedReferrer ? matchedReferrer.id : null,
      referrerName: matchedReferrer ? matchedReferrer.name : null,
      createdAt: new Date().toISOString(),
    });

    const nextState = commitMutatedState(
      {
        ...state,
        leads: [lead, ...state.leads],
      },
      true
    );
    return { lead, state: nextState, mode: 'local' };
  } finally {
    endMutation();
  }
}

export interface UpdateLeadPayload {
  name?: string;
  phone?: string;
  address?: string;
  called?: boolean;
  calledAt?: string | null;
  callOutcome?: CallOutcome;
  category?: LeadCategory;
  orderAmount?: number | null;
  notes?: string;
  giftId?: string | null;
  giftName?: string | null;
  giftVisualKey?: GiftVisualKey | null;
  claimCode?: string;
  qualification?: LeadQualification | null;
  promoCodeInvalidated?: boolean;
  promoCodeInvalidatedAt?: string | null;
  sellerLocked?: boolean;
  confirmLock?: boolean;
  referrerId?: string | null;
  referralCode?: string | null;
  adminPassword?: string;
}

export async function updateLead(
  id: string,
  updates: UpdateLeadPayload
): Promise<{ lead: Lead; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{ lead: Lead; state: AppState }>(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const normalizedState = commitMutatedState(res.state, Boolean(getDsbSessionToken()));
    return { lead: normalizeLead(res.lead), state: normalizedState };
  } finally {
    endMutation();
  }
}

export async function deleteLead(id: string): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ state: AppState }>(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return commitMutatedState(res.state, true);
  } finally {
    endMutation();
  }
}

// ----------------------------------------------------------------------------
// Gifts & Settings API (Protected by Current Admin Password)
// ----------------------------------------------------------------------------

export interface UpsertGiftPayload {
  name: string;
  subtitle: string;
  usageTip?: string;
  tag: string;
  visualKey: GiftVisualKey;
  customImageUrl?: string;
  accentColor: string;
  active: boolean;
  stockLabel: string;
  probability?: number;
  adminPassword?: string;
  masterPassword?: string;
}

export async function createGift(
  payload: UpsertGiftPayload,
  adminPassword?: string
): Promise<{ gift: GiftItem; state: AppState }> {
  const effectivePassword = adminPassword ?? payload.adminPassword ?? payload.masterPassword;
  const sanitizedPayload = {
    ...payload,
    probability: sanitizeGiftProbability(payload.probability, DEFAULT_GIFT_PROBABILITY),
    ...(effectivePassword !== undefined
      ? { adminPassword: effectivePassword, masterPassword: effectivePassword }
      : {}),
  };
  beginMutation();
  try {
    const res = await requestJson<{ gift: GiftItem; state: AppState }>('/api/gifts', {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return { gift: normalizeGift(res.gift), state: normalizedState };
  } finally {
    endMutation();
  }
}

export async function updateGift(
  id: string,
  updates: Partial<UpsertGiftPayload>,
  adminPassword?: string
): Promise<{ gift: GiftItem; state: AppState }> {
  const effectivePassword = adminPassword ?? updates.adminPassword ?? updates.masterPassword;
  const hasFiniteProbUpdate =
    updates.probability !== undefined &&
    typeof updates.probability === 'number' &&
    Number.isFinite(updates.probability);
  const apiUpdates = {
    ...updates,
    ...(updates.probability !== undefined
      ? {
          probability: hasFiniteProbUpdate
            ? sanitizeGiftProbability(updates.probability, DEFAULT_GIFT_PROBABILITY)
            : undefined,
        }
      : {}),
    ...(effectivePassword !== undefined
      ? { adminPassword: effectivePassword, masterPassword: effectivePassword }
      : {}),
  };

  beginMutation();
  try {
    const res = await requestJson<{ gift: GiftItem; state: AppState }>(`/api/gifts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(apiUpdates),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return { gift: normalizeGift(res.gift), state: normalizedState };
  } finally {
    endMutation();
  }
}

export async function updateGiftProbabilities(
  probabilities: Record<string, number> | Array<{ id: string; probability: number }>,
  adminPassword?: string
): Promise<{ gifts: GiftItem[]; state: AppState }> {
  const entries = Array.isArray(probabilities)
    ? probabilities
        .filter((item) => item && typeof item.id === 'string' && item.id.trim().length > 0)
        .map((item) => ({
          id: item.id.trim(),
          probability: sanitizeGiftProbability(item.probability, DEFAULT_GIFT_PROBABILITY),
        }))
    : Object.entries(probabilities).map(([id, probability]) => ({
        id: id.trim(),
        probability: sanitizeGiftProbability(probability, DEFAULT_GIFT_PROBABILITY),
      }));

  beginMutation();
  try {
    const res = await requestJson<{ gifts: GiftItem[]; state: AppState }>(
      '/api/gifts/probabilities',
      {
        method: 'PATCH',
        body: JSON.stringify({
          gifts: entries,
          ...(adminPassword !== undefined
            ? { adminPassword, masterPassword: adminPassword }
            : {}),
        }),
      }
    );
    const normalizedState = commitMutatedState(res.state, true);
    return { gifts: normalizedState.gifts, state: normalizedState };
  } finally {
    endMutation();
  }
}

export async function deleteGift(id: string, adminPassword?: string): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ state: AppState }>(`/api/gifts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminPassword
        ? { 'X-Admin-Password': adminPassword, 'X-Master-Password': adminPassword }
        : undefined,
      body: JSON.stringify(
        adminPassword !== undefined ? { adminPassword, masterPassword: adminPassword } : {}
      ),
    });
    return commitMutatedState(res.state, true);
  } finally {
    endMutation();
  }
}

export async function resetDefaultGifts(adminPassword?: string): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ state: AppState }>('/api/gifts/reset', {
      method: 'POST',
      body: JSON.stringify(
        adminPassword !== undefined ? { adminPassword, masterPassword: adminPassword } : {}
      ),
    });
    return commitMutatedState(res.state, true);
  } finally {
    endMutation();
  }
}

export async function updateSettings(
  updates: Partial<AppSettings> & {
    adminPassword?: string;
    masterPassword?: string;
    showcaseStyle?: ShowcaseStyleId;
  },
  adminPassword?: string
): Promise<AppState> {
  const effectivePassword = adminPassword ?? updates.adminPassword ?? updates.masterPassword;
  beginMutation();
  try {
    const res = await requestJson<{ settings: AppSettings; state: AppState }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        ...updates,
        ...(effectivePassword !== undefined
          ? { adminPassword: effectivePassword, masterPassword: effectivePassword }
          : {}),
      }),
    });
    return commitMutatedState(res.state, true);
  } finally {
    endMutation();
  }
}

// ----------------------------------------------------------------------------
// QR Studio API (Strictly linked to active vendedor account)
// ----------------------------------------------------------------------------

export interface CreateQrPayload {
  name: string;
  targetUrl: string;
  accountId?: string | null;
  referrerId?: string | null;
  styleId?: QrStyleId;
  dotShape?: QrDotShape;
  foregroundColor?: string;
  backgroundColor?: string;
  includeLogo?: boolean;
  frameText?: string;
  referralCode?: string | null;
}

export async function createQrCode(
  payload: CreateQrPayload
): Promise<{ qr: QrCodeRecord; referrer?: ReferralPartner | null; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{
      qr: QrCodeRecord;
      referrer?: ReferralPartner | null;
      qrHistory?: QrCodeRecord[];
      state: AppState;
    }>('/api/qr', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      qr: res.qr,
      referrer: res.referrer ? normalizeReferralPartner(res.referrer) : null,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export async function deleteQrCode(id: string): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ qrHistory?: QrCodeRecord[]; state: AppState }>(
      `/api/qr/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
    return commitMutatedState(res.state, true);
  } finally {
    endMutation();
  }
}

// ----------------------------------------------------------------------------
// Referrals & Visits API
// ----------------------------------------------------------------------------

export interface CreateReferralPayload {
  accountId?: string;
  name?: string;
  code?: string;
  phone?: string;
  notes?: string;
  qrStyleId?: QrStyleId;
  active?: boolean;
  adminPassword?: string;
  masterPassword?: string;
}

export interface BatchCreateReferralsPayload {
  items?: Array<{ name: string; code?: string; phone?: string; notes?: string }>;
  count?: number;
  namePrefix?: string;
  codePrefix?: string;
  adminPassword?: string;
  masterPassword?: string;
}

export interface UpdateReferralPayload {
  name?: string;
  code?: string;
  avatarUrl?: string | null;
  phone?: string;
  notes?: string;
  active?: boolean;
  qrStyleId?: QrStyleId;
  resetVisits?: boolean;
  adminPassword?: string;
  masterPassword?: string;
}

export interface ResolvedReferralPartner {
  id: string;
  name: string;
  code: string;
  active: boolean;
  avatarUrl?: string | null;
  emoji?: string | null;
  partnerType?: ReferralPartnerType;
  ownerVendedorName?: string | null;
}

export async function resolveReferralCode(code: string): Promise<ResolvedReferralPartner | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  try {
    const res = await requestJson<{ ok?: boolean; partner?: ResolvedReferralPartner | null }>(
      `/api/referrals/resolve/${encodeURIComponent(normalized)}`,
      { cache: 'no-store' }
    );
    if (!res.partner) return null;
    return {
      id: res.partner.id,
      name: res.partner.name,
      code: normalizeReferralCode(res.partner.code) || res.partner.code,
      active: typeof res.partner.active === 'boolean' ? res.partner.active : true,
      avatarUrl:
        typeof res.partner.avatarUrl === 'string' && res.partner.avatarUrl.trim()
          ? res.partner.avatarUrl.trim()
          : null,
      emoji:
        typeof res.partner.emoji === 'string' && res.partner.emoji.trim()
          ? res.partner.emoji.trim()
          : null,
      partnerType: res.partner.partnerType === 'embajador' ? 'embajador' : 'vendedor',
      ownerVendedorName:
        typeof res.partner.ownerVendedorName === 'string' && res.partner.ownerVendedorName.trim()
          ? res.partner.ownerVendedorName.trim()
          : null,
    };
  } catch {
    return null;
  }
}

export async function recordReferralVisit(
  code: string,
  visitorId: string
): Promise<{ ok: boolean; counted: boolean; partner?: ResolvedReferralPartner | null }> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    return { ok: false, counted: false, partner: null };
  }

  try {
    const res = await requestJson<{
      ok?: boolean;
      counted?: boolean;
      partner?: Partial<ResolvedReferralPartner> | null;
    }>('/api/referrals/visit', {
      method: 'POST',
      body: JSON.stringify({ code: normalized, visitorId }),
    });
    const partner =
      res.partner && res.partner.id && res.partner.name && res.partner.code
        ? {
            id: res.partner.id,
            name: res.partner.name,
            code: normalizeReferralCode(res.partner.code) || res.partner.code,
            active: typeof res.partner.active === 'boolean' ? res.partner.active : true,
            avatarUrl:
              typeof res.partner.avatarUrl === 'string' && res.partner.avatarUrl.trim()
                ? res.partner.avatarUrl.trim()
                : null,
            emoji:
              typeof res.partner.emoji === 'string' && res.partner.emoji.trim()
                ? res.partner.emoji.trim()
                : null,
            partnerType: (res.partner.partnerType === 'embajador'
              ? 'embajador'
              : 'vendedor') as ReferralPartnerType,
            ownerVendedorName:
              typeof res.partner.ownerVendedorName === 'string' &&
              res.partner.ownerVendedorName.trim()
                ? res.partner.ownerVendedorName.trim()
                : null,
          }
        : null;
    return {
      ok: Boolean(res.ok ?? true),
      counted: Boolean(res.counted),
      partner,
    };
  } catch {
    return { ok: false, counted: false, partner: null };
  }
}

export async function createReferralPartner(
  payload: CreateReferralPayload,
  adminPassword?: string
): Promise<{ referrer: ReferralPartner; state: AppState }> {
  const effectivePassword = adminPassword ?? payload.adminPassword ?? payload.masterPassword;
  beginMutation();
  try {
    const res = await requestJson<{ ok?: boolean; referrer: ReferralPartner; state: AppState }>(
      '/api/referrals',
      {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          ...(effectivePassword !== undefined
            ? { adminPassword: effectivePassword, masterPassword: effectivePassword }
            : {}),
        }),
      }
    );
    const normalizedState = commitMutatedState(res.state, true);
    return { referrer: normalizeReferralPartner(res.referrer), state: normalizedState };
  } finally {
    endMutation();
  }
}

export async function batchCreateReferralPartners(
  payload: BatchCreateReferralsPayload,
  adminPassword?: string
): Promise<{ created: ReferralPartner[]; skipped: string[]; state: AppState }> {
  const effectivePassword = adminPassword ?? payload.adminPassword ?? payload.masterPassword;
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      created: ReferralPartner[];
      skipped: string[];
      state: AppState;
    }>('/api/referrals/batch', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        ...(effectivePassword !== undefined
          ? { adminPassword: effectivePassword, masterPassword: effectivePassword }
          : {}),
      }),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      created: Array.isArray(res.created) ? res.created.map(normalizeReferralPartner) : [],
      skipped: Array.isArray(res.skipped) ? res.skipped : [],
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export async function updateReferralPartner(
  id: string,
  updates: UpdateReferralPayload,
  adminPassword?: string
): Promise<{ referrer: ReferralPartner; state: AppState }> {
  const effectivePassword = adminPassword ?? updates.adminPassword ?? updates.masterPassword;
  beginMutation();
  try {
    const res = await requestJson<{ ok?: boolean; referrer: ReferralPartner; state: AppState }>(
      `/api/referrals/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...updates,
          ...(effectivePassword !== undefined
            ? { adminPassword: effectivePassword, masterPassword: effectivePassword }
            : {}),
        }),
      }
    );
    const normalizedState = commitMutatedState(res.state, true);
    return { referrer: normalizeReferralPartner(res.referrer), state: normalizedState };
  } finally {
    endMutation();
  }
}

export async function deleteReferralPartner(
  id: string,
  adminPassword?: string
): Promise<{ state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{ ok?: boolean; state: AppState }>(
      `/api/referrals/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: adminPassword
          ? { 'X-Admin-Password': adminPassword, 'X-Master-Password': adminPassword }
          : undefined,
        body: JSON.stringify(
          adminPassword !== undefined ? { adminPassword, masterPassword: adminPassword } : {}
        ),
      }
    );
    const normalizedState = commitMutatedState(res.state, true);
    return { state: normalizedState };
  } finally {
    endMutation();
  }
}

// ----------------------------------------------------------------------------
// Embajadores API (Non-login referral partners linked to a Vendedor or Ciprian Direct)
// ----------------------------------------------------------------------------

export interface CreateEmbajadorPayload {
  name: string;
  emoji?: string | null;
  avatarUrl?: string | null;
  code?: string;
  qrStyleId?: QrStyleId;
  phone?: string;
  notes?: string;
  ownerVendedorAccountId?: string | null;
  createQr?: boolean;
  targetUrl?: string;
  dotShape?: QrDotShape;
  foregroundColor?: string;
  backgroundColor?: string;
  includeLogo?: boolean;
  frameText?: string;
}

export interface UpdateEmbajadorPayload {
  name?: string;
  emoji?: string | null;
  avatarUrl?: string | null;
  code?: string;
  qrStyleId?: QrStyleId;
  phone?: string;
  notes?: string;
  active?: boolean;
  ownerVendedorAccountId?: string | null;
}

export async function createEmbajadorRemote(
  payload: CreateEmbajadorPayload
): Promise<{ state: AppState; referrer: ReferralPartner; qr?: QrCodeRecord | null }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      state: AppState;
      referrer: ReferralPartner;
      qr?: QrCodeRecord | null;
    }>('/api/embajadores', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      state: normalizedState,
      referrer: normalizeReferralPartner(res.referrer),
      qr: res.qr ?? null,
    };
  } finally {
    endMutation();
  }
}

export async function updateEmbajadorRemote(
  id: string,
  updates: UpdateEmbajadorPayload
): Promise<{ state: AppState; referrer: ReferralPartner }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      state: AppState;
      referrer: ReferralPartner;
    }>(`/api/embajadores/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      state: normalizedState,
      referrer: normalizeReferralPartner(res.referrer),
    };
  } finally {
    endMutation();
  }
}

export async function deleteEmbajadorRemote(
  id: string,
  adminPassword = ''
): Promise<{ state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{ ok?: boolean; state: AppState }>(
      `/api/embajadores/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: adminPassword
          ? { 'X-Admin-Password': adminPassword, 'X-Master-Password': adminPassword }
          : undefined,
        body: JSON.stringify({ adminPassword, masterPassword: adminPassword }),
      }
    );
    const normalizedState = commitMutatedState(res.state, true);
    return { state: normalizedState };
  } finally {
    endMutation();
  }
}

export const createQrCodeRemote = createQrCode;
export const createLeadRemote = createLead;
export const updateLeadRemote = updateLead;

// ----------------------------------------------------------------------------
// Accounts Management API (Admin only)
// ----------------------------------------------------------------------------

export interface CreateAccountPayload {
  masterPassword?: string;
  adminPassword?: string;
  username: string;
  displayName: string;
  role: 'admin' | 'telemarketing' | 'vendedor';
  tag: string;
  avatarUrl?: string | null;
  password: string;
  confirmPassword: string;
  pin?: string;
}

export interface UpdateAccountPayload {
  masterPassword?: string;
  adminPassword?: string;
  displayName?: string;
  tag?: string;
  avatarUrl?: string | null;
  active?: boolean;
}

export interface UpdateAccountPasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface UpdateAdminAccountPasswordPayload {
  securityKey: string;
  confirmationPin: string;
  newPassword: string;
  confirmNewPassword: string;
}

export async function fetchAccounts(): Promise<UserAccount[]> {
  const res = await requestJson<{ ok?: boolean; accounts: UserAccount[] }>('/api/accounts', {
    cache: 'no-store',
  });
  return Array.isArray(res.accounts) ? res.accounts : [];
}

export async function createAccount(
  payload: CreateAccountPayload
): Promise<{
  account: UserAccount;
  referrer?: ReferralPartner | null;
  accounts: UserAccount[];
  state: AppState;
}> {
  const normalizedTag = normalizeReferralCode(payload.tag) || payload.tag.trim().toUpperCase();
  const cleanAvatar =
    typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim()
      ? payload.avatarUrl.trim()
      : null;
  const sanitizedPayload: CreateAccountPayload = {
    ...payload,
    adminPassword: payload.adminPassword ?? payload.masterPassword,
    masterPassword: payload.masterPassword,
    username: payload.username.trim(),
    displayName: payload.displayName.trim(),
    tag: normalizedTag,
    ...(payload.role === 'vendedor' && cleanAvatar ? { avatarUrl: cleanAvatar } : {}),
  };

  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      account: UserAccount;
      referrer?: ReferralPartner | null;
      accounts: UserAccount[];
      state: AppState;
    }>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
    });
    const nextAccounts = Array.isArray(res.accounts)
      ? res.accounts
      : Array.isArray(res.state?.accounts)
        ? res.state.accounts
        : [];
    const normalizedState = commitMutatedState({ ...res.state, accounts: nextAccounts }, true);
    return {
      account: res.account,
      referrer: res.referrer ? normalizeReferralPartner(res.referrer) : null,
      accounts: nextAccounts,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export async function updateAccount(
  id: string,
  payload: UpdateAccountPayload
): Promise<{ account: UserAccount; accounts: UserAccount[]; state: AppState }> {
  const effectivePassword = payload.adminPassword ?? payload.masterPassword;
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      account: UserAccount;
      accounts: UserAccount[];
      state: AppState;
    }>(`/api/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...payload,
        adminPassword: effectivePassword,
        masterPassword: effectivePassword,
      }),
    });
    const nextAccounts = Array.isArray(res.accounts)
      ? res.accounts
      : Array.isArray(res.state?.accounts)
        ? res.state.accounts
        : [];
    const normalizedState = commitMutatedState({ ...res.state, accounts: nextAccounts }, true);
    return {
      account: res.account,
      accounts: nextAccounts,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export async function updateAccountPassword(
  id: string,
  payload: UpdateAccountPasswordPayload
): Promise<{ ok: boolean; account: UserAccount; message: string }> {
  const res = await requestJson<{
    ok?: boolean;
    account: UserAccount;
    message?: string;
  }>(`/api/accounts/${encodeURIComponent(id)}/password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    ok: true,
    account: res.account,
    message: res.message || 'Contraseña actualizada correctamente.',
  };
}

export async function updateAdminAccountPassword(
  id: string,
  payload: UpdateAdminAccountPasswordPayload
): Promise<{ ok: boolean; message: string; sessionToken?: string; account?: UserAccount }> {
  const res = await requestJson<{
    ok?: boolean;
    message?: string;
    sessionToken?: string;
    account?: UserAccount;
  }>(`/api/accounts/${encodeURIComponent(id)}/admin-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res.sessionToken) {
    const existing = getStoredSessionUser();
    const updatedAccount = res.account;
    saveSessionStorage(res.sessionToken, {
      userId: existing?.userId || updatedAccount?.id || id,
      username: updatedAccount?.username || existing?.username || 'AdminCiprian',
      displayName:
        updatedAccount?.displayName ||
        existing?.displayName ||
        updatedAccount?.username ||
        'Administrador',
      role: updatedAccount?.role || existing?.role || 'admin',
      tag: updatedAccount?.tag || existing?.tag || 'ADMIN-CIPRIAN',
      avatarUrl: updatedAccount?.avatarUrl ?? existing?.avatarUrl ?? null,
    });
  }

  return {
    ok: true,
    message: res.message || 'Contraseña de administrador actualizada correctamente.',
    ...(res.sessionToken ? { sessionToken: res.sessionToken } : {}),
    ...(res.account ? { account: res.account } : {}),
  };
}

export async function deleteAccount(
  id: string,
  adminPassword = ''
): Promise<{ ok: boolean; accounts: UserAccount[]; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      accounts: UserAccount[];
      state: AppState;
    }>(`/api/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'X-Admin-Password': adminPassword,
        'X-Master-Password': adminPassword,
      },
      body: JSON.stringify({ adminPassword, masterPassword: adminPassword }),
    });
    const nextAccounts = Array.isArray(res.accounts)
      ? res.accounts
      : Array.isArray(res.state?.accounts)
        ? res.state.accounts
        : [];
    const normalizedState = commitMutatedState({ ...res.state, accounts: nextAccounts }, true);
    return {
      ok: true,
      accounts: nextAccounts,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

// ----------------------------------------------------------------------------
// Security & Anti-Fraud Center API (Admin only)
// ----------------------------------------------------------------------------

export async function updateSecurityAlertStatus(
  id: string,
  status: SecurityAlertStatus,
  reviewNote?: string
): Promise<{ alert: SecurityAlert; alerts: SecurityAlert[]; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      alert: SecurityAlert;
      alerts?: SecurityAlert[];
      state: AppState;
    }>(`/api/security/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(reviewNote !== undefined ? { reviewNote } : {}),
      }),
    });
    const normalizedState = commitMutatedState(res.state, true);
    const normalizedAlerts = Array.isArray(res.alerts)
      ? res.alerts.map(normalizeSecurityAlert)
      : normalizedState.securityAlerts ?? [];
    return {
      alert: normalizeSecurityAlert(res.alert),
      alerts: normalizedAlerts,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export async function bulkUpdateSecurityAlerts(
  action: 'mark_all_reviewed' | 'clear_resolved'
): Promise<{ alerts: SecurityAlert[]; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      alerts?: SecurityAlert[];
      state: AppState;
    }>('/api/security/alerts/bulk-status', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    const normalizedState = commitMutatedState(res.state, true);
    const normalizedAlerts = Array.isArray(res.alerts)
      ? res.alerts.map(normalizeSecurityAlert)
      : normalizedState.securityAlerts ?? [];
    return {
      alerts: normalizedAlerts,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export function reportClientTamper(reason: string, detail?: string): void {
  if (typeof window === 'undefined') return;
  const token = getDsbSessionToken();
  if (!token) return;
  const cleanReason = String(reason || '').trim().slice(0, 80);
  if (!cleanReason) return;
  const cleanDetail =
    typeof detail === 'string' && detail.trim() ? detail.trim().slice(0, 320) : undefined;

  try {
    void fetch('/api/security/client-tamper', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason: cleanReason,
        ...(cleanDetail ? { detail: cleanDetail } : {}),
      }),
    }).catch(() => {
      // Swallow network/API errors silently
    });
  } catch {
    // Swallow runtime errors silently
  }
}

// ----------------------------------------------------------------------------
// Activity Log API (Admin only — strictly in-memory, never written to localStorage)
// ----------------------------------------------------------------------------

export async function fetchActivityLogs(): Promise<ActivityLogEntry[]> {
  const res = await requestJson<
    | { ok?: boolean; activityLogs?: ActivityLogEntry[]; logs?: ActivityLogEntry[] }
    | ActivityLogEntry[]
  >('/api/activity', {
    cache: 'no-store',
  });
  const raw = Array.isArray(res)
    ? res
    : Array.isArray(res.activityLogs)
      ? res.activityLogs
      : Array.isArray(res.logs)
        ? res.logs
        : [];
  return raw.map(normalizeActivityLogEntry);
}

// ----------------------------------------------------------------------------
// Cross-tab Sync
// ----------------------------------------------------------------------------

export function subscribeStoreSync(onSync: (state: AppState) => void): () => void {
  let lastDeliveredJson = '';

  const deliverIfChanged = (candidate: AppState, fromAuthedSource: boolean) => {
    if (activeMutationCount > 0) return;
    const isCurrentTabAuthed = Boolean(getDsbSessionToken());
    if (isCurrentTabAuthed && !fromAuthedSource) {
      return;
    }
    const normalized = normalizeAppState(candidate);
    const serialized = JSON.stringify(normalized);
    if (serialized === lastDeliveredJson) return;
    lastDeliveredJson = serialized;
    latestCommittedState = normalized;
    onSync(normalized);
  };

  const handleChannel = (event: MessageEvent) => {
    const payload = event.data as
      | { type?: string; state?: AppState; tabId?: string; sourceAuthed?: boolean }
      | undefined;
    if (payload?.type !== 'STATE_UPDATED' || !payload.state) return;
    if (payload.tabId && payload.tabId === TAB_INSTANCE_ID) return;
    deliverIfChanged(payload.state, Boolean(payload.sourceAuthed));
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as Partial<PublicCatalogStorage>;
      if (!parsed || typeof parsed !== 'object') return;
      const base = latestCommittedState ?? readLocalState();
      const merged: AppState = {
        ...base,
        settings: {
          ...base.settings,
          ...(parsed.settings || {}),
          pinCode: '',
          referralPrizeRule: normalizeReferralPrizeRule(
            parsed.settings?.referralPrizeRule ?? base.settings.referralPrizeRule
          ),
          processControls: normalizeProcessControls(
            parsed.settings?.processControls ?? base.settings.processControls
          ),
        },
        gifts:
          base.role === 'telemarketing'
            ? []
            : Array.isArray(parsed.gifts)
              ? parsed.gifts.map(normalizeGift)
              : base.gifts,
      };
      deliverIfChanged(merged, Boolean(getDsbSessionToken()));
    } catch {
      // Ignore parse failure
    }
  };

  channel?.addEventListener('message', handleChannel);
  window.addEventListener('storage', handleStorage);

  return () => {
    channel?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

// ----------------------------------------------------------------------------
// Authentication & Security API (Strict server-side verification, zero client hash bypass)
// ----------------------------------------------------------------------------

export interface AuthErrorResponse {
  error?: string;
  code?: string;
  locked?: boolean;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
  expiredFirstFactor?: boolean;
}

export class DsbAuthError extends Error {
  locked: boolean;
  retryAfterSeconds: number;
  remainingAttempts?: number;
  expiredFirstFactor: boolean;

  constructor(payload: AuthErrorResponse) {
    super(payload.error || 'Error de autenticación.');
    this.name = 'DsbAuthError';
    this.locked = Boolean(payload.locked);
    this.retryAfterSeconds = Number(payload.retryAfterSeconds || 0);
    this.remainingAttempts =
      typeof payload.remainingAttempts === 'number' ? payload.remainingAttempts : undefined;
    this.expiredFirstFactor = Boolean(payload.expiredFirstFactor);
  }
}

export interface LoginStep1Result {
  requiresPin: boolean;
  requiresSecurityQuestion?: boolean;
  securityChallenge?: {
    questionId: string;
    type: 'personal' | 'fecha' | 'clave' | 'codigo' | 'gusto' | 'custom';
    typeLabel: string;
    prompt: string;
  };
  preAuthToken?: string;
  sessionToken?: string;
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  tag: string;
  avatarUrl?: string | null;
}

export async function loginStep1(username: string, password: string): Promise<LoginStep1Result> {
  const cleanUser = username.trim();
  if (cleanUser.toLowerCase() === 'admincripian') {
    throw new DsbAuthError({ error: 'Credenciales inválidas.', remainingAttempts: 4 });
  }

  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password }),
    });
  } catch {
    throw new DsbAuthError({
      error: 'No se pudo conectar con el servidor de autenticación. Intenta de nuevo.',
    });
  }

  const data = (await res.json().catch(() => null)) as
    | ({
        ok?: boolean;
        requiresPin?: boolean;
        requiresSecurityQuestion?: boolean;
        securityChallenge?: {
          questionId: string;
          type: 'personal' | 'fecha' | 'clave' | 'codigo' | 'gusto' | 'custom';
          typeLabel: string;
          prompt: string;
        };
        preAuthToken?: string;
        sessionToken?: string;
        userId?: string;
        username?: string;
        user?: string;
        displayName?: string;
        role?: UserRole;
        tag?: string;
        avatarUrl?: string | null;
      } & AuthErrorResponse)
    | null;

  if (!data || !res.ok || !data.ok) {
    throw new DsbAuthError(data || { error: 'No se pudo completar la autenticación.' });
  }

  const resolvedRole: UserRole = data.role || 'admin';
  const resolvedUsername = data.username || data.user || cleanUser;
  const resolvedDisplayName = data.displayName || resolvedUsername;
  const resolvedUserId = data.userId || '';
  const resolvedTag = data.tag || '';
  const resolvedAvatarUrl =
    typeof data.avatarUrl === 'string' && data.avatarUrl.trim() ? data.avatarUrl.trim() : null;
  const requiresSecurityQuestion = Boolean(data.requiresSecurityQuestion);
  const requiresPin =
    !requiresSecurityQuestion &&
    (data.requiresPin !== undefined ? Boolean(data.requiresPin) : resolvedRole === 'admin');

  if (!requiresPin && !requiresSecurityQuestion) {
    if (!data.sessionToken) {
      throw new DsbAuthError({ error: 'Respuesta de sesión inválida.' });
    }
    saveSessionStorage(data.sessionToken, {
      userId: resolvedUserId,
      username: resolvedUsername,
      displayName: resolvedDisplayName,
      role: resolvedRole,
      tag: resolvedTag,
      avatarUrl: resolvedAvatarUrl,
    });
    stateMutationEpoch += 1;
    latestCommittedState = null;
    return {
      requiresPin: false,
      requiresSecurityQuestion: false,
      sessionToken: data.sessionToken,
      userId: resolvedUserId,
      username: resolvedUsername,
      displayName: resolvedDisplayName,
      role: resolvedRole,
      tag: resolvedTag,
      avatarUrl: resolvedAvatarUrl,
    };
  }

  if (!data.preAuthToken) {
    throw new DsbAuthError({ error: 'No se recibió token de segundo factor.' });
  }

  return {
    requiresPin,
    requiresSecurityQuestion,
    securityChallenge: data.securityChallenge,
    preAuthToken: data.preAuthToken,
    userId: resolvedUserId,
    username: resolvedUsername,
    displayName: resolvedDisplayName,
    role: resolvedRole,
    tag: resolvedTag,
    avatarUrl: resolvedAvatarUrl,
  };
}

export async function verifySecurityQuestionStep2(
  preAuthToken: string,
  answer: string
): Promise<{
  sessionToken: string;
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  tag: string;
  avatarUrl?: string | null;
}> {
  let res: Response;
  try {
    res = await fetch('/api/auth/verify-security-question', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preAuthToken, answer }),
    });
  } catch {
    throw new DsbAuthError({
      error: 'No se pudo conectar con el servidor para verificar tu respuesta.',
    });
  }

  const data = (await res.json().catch(() => null)) as
    | ({
        ok?: boolean;
        sessionToken?: string;
        userId?: string;
        username?: string;
        user?: string;
        displayName?: string;
        role?: UserRole;
        tag?: string;
        avatarUrl?: string | null;
      } & AuthErrorResponse)
    | null;

  if (!data || !res.ok || !data.sessionToken) {
    throw new DsbAuthError(data || { error: 'Respuesta de seguridad incorrecta.' });
  }

  const user: StoredSessionUser = {
    userId: data.userId || '',
    username: data.username || data.user || 'JuanOrozco',
    displayName: data.displayName || data.username || data.user || 'Juan Orozco',
    role: data.role || 'ai_manager',
    tag: data.tag || 'AI-MANAGER',
    avatarUrl:
      typeof data.avatarUrl === 'string' && data.avatarUrl.trim() ? data.avatarUrl.trim() : null,
  };

  saveSessionStorage(data.sessionToken, user);
  stateMutationEpoch += 1;
  latestCommittedState = null;

  return {
    sessionToken: data.sessionToken,
    ...user,
  };
}

export async function fetchAiSecurityQuestions(): Promise<
  Array<{
    id: string;
    type: 'personal' | 'fecha' | 'clave' | 'codigo' | 'gusto' | 'custom';
    typeLabel: string;
    prompt: string;
    hasAnswer: boolean;
  }>
> {
  const res = await requestJson<{
    ok: boolean;
    questions: Array<{
      id: string;
      type: 'personal' | 'fecha' | 'clave' | 'codigo' | 'gusto' | 'custom';
      typeLabel: string;
      prompt: string;
      hasAnswer: boolean;
    }>;
  }>('/api/ai-manager/security-questions', {
    method: 'GET',
    cache: 'no-store',
  });
  return Array.isArray(res.questions) ? res.questions : [];
}

export async function updateAiSecurityQuestions(
  questions: Array<{
    id?: string;
    type: 'personal' | 'fecha' | 'clave' | 'codigo' | 'gusto' | 'custom';
    typeLabel?: string;
    prompt: string;
    answer?: string;
  }>
): Promise<{
  ok: boolean;
  questions: Array<{
    id: string;
    type: 'personal' | 'fecha' | 'clave' | 'codigo' | 'gusto' | 'custom';
    typeLabel: string;
    prompt: string;
    hasAnswer: boolean;
  }>;
  message: string;
}> {
  return requestJson('/api/ai-manager/security-questions', {
    method: 'PUT',
    body: JSON.stringify({ questions }),
  });
}

export async function verifyPinStep2(
  preAuthToken: string,
  pin: string
): Promise<{
  sessionToken: string;
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  tag: string;
  avatarUrl?: string | null;
}> {
  let res: Response;
  try {
    res = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preAuthToken, pin }),
    });
  } catch {
    throw new DsbAuthError({
      error: 'No se pudo conectar con el servidor para verificar el PIN.',
    });
  }

  const data = (await res.json().catch(() => null)) as
    | ({
        ok?: boolean;
        sessionToken?: string;
        userId?: string;
        username?: string;
        user?: string;
        displayName?: string;
        role?: UserRole;
        tag?: string;
        avatarUrl?: string | null;
      } & AuthErrorResponse)
    | null;

  if (!data || !res.ok || !data.sessionToken) {
    throw new DsbAuthError(data || { error: 'No se pudo verificar el PIN.' });
  }

  const user: StoredSessionUser = {
    userId: data.userId || '',
    username: data.username || data.user || 'AdminCiprian',
    displayName: data.displayName || data.username || data.user || 'AdminCiprian',
    role: data.role || 'admin',
    tag: data.tag || 'ADMIN-CIPRIAN',
    avatarUrl:
      typeof data.avatarUrl === 'string' && data.avatarUrl.trim() ? data.avatarUrl.trim() : null,
  };

  saveSessionStorage(data.sessionToken, user);
  stateMutationEpoch += 1;
  latestCommittedState = null;

  return {
    sessionToken: data.sessionToken,
    ...user,
  };
}

export async function verifyDsbSession(): Promise<AuthSessionInfo> {
  const token = getDsbSessionToken();
  if (!token) return { authenticated: false };

  try {
    const res = await fetch('/api/auth/session', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearSessionStorage();
      }
      return { authenticated: false };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      authenticated?: boolean;
      userId?: string;
      username?: string;
      user?: string;
      displayName?: string;
      role?: UserRole;
      tag?: string;
      avatarUrl?: string | null;
    };
    if (!data.authenticated && !data.ok) {
      clearSessionStorage();
      return { authenticated: false };
    }
    const user: StoredSessionUser = {
      userId: data.userId || '',
      username: data.username || data.user || '',
      displayName: data.displayName || data.username || data.user || '',
      role: data.role || getDsbRole() || 'admin',
      tag: data.tag || '',
      avatarUrl:
        typeof data.avatarUrl === 'string' && data.avatarUrl.trim() ? data.avatarUrl.trim() : null,
    };
    saveSessionStorage(token, user);
    return {
      authenticated: true,
      ...user,
    };
  } catch {
    return { authenticated: false };
  }
}

export function logoutDsbSession(): void {
  stateMutationEpoch += 1;
  latestCommittedState = null;
  lastWrittenLocalJson = '';
  clearSessionStorage();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      const publicCatalog = buildPublicCatalogSnapshot(parsed);
      const serialized = JSON.stringify(publicCatalog);
      window.localStorage.setItem(STORAGE_KEY, serialized);
      lastWrittenLocalJson = serialized;
    }
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage cleanup error
    }
  }
}

export interface UpdateCredentialsPayload {
  masterPassword: string;
  confirmationPin: string;
  newUsername?: string;
  newPassword?: string;
  confirmNewPassword?: string;
  newPin?: string;
}

export async function updateDsbCredentials(
  payload: UpdateCredentialsPayload
): Promise<{ ok: boolean; username: string; sessionToken?: string; message: string }> {
  const token = getDsbSessionToken();
  let res: Response;
  try {
    res = await fetch('/api/auth/update-credentials', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new DsbAuthError({
      error: 'No se pudo conectar con el servidor para actualizar credenciales. Intenta de nuevo.',
    });
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    username?: string;
    sessionToken?: string;
    message?: string;
  } & AuthErrorResponse;

  if (!res.ok || !data.ok) {
    throw new DsbAuthError(
      data.error ? data : { error: `No se pudieron actualizar las credenciales (HTTP ${res.status}).` }
    );
  }

  if (data.sessionToken) {
    const existing = getStoredSessionUser();
    saveSessionStorage(data.sessionToken, {
      userId: existing?.userId || 'default',
      username: data.username || existing?.username || 'AdminCiprian',
      displayName: existing?.displayName || data.username || 'Administrador Ciprian',
      role: existing?.role || 'admin',
      tag: existing?.tag || 'ADMIN-CIPRIAN',
      avatarUrl: existing?.avatarUrl ?? null,
    });
  }

  return {
    ok: true,
    username: data.username || 'AdminCiprian',
    sessionToken: data.sessionToken,
    message: data.message || 'Credenciales actualizadas.',
  };
}

export async function resetAllWorkspaceData(
  adminPassword = '',
  resetCatalogAndSettings = true
): Promise<{ ok: boolean; state: AppState; message: string }> {
  const token = getDsbSessionToken();
  beginMutation();
  try {
    let res: Response;
    try {
      res = await fetch('/api/admin/reset-all', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          adminPassword,
          masterPassword: adminPassword,
          resetCatalogAndSettings,
        }),
      });
    } catch {
      throw new DsbAuthError({
        error: 'No se pudo conectar con el servidor para reiniciar los datos. Intenta de nuevo.',
      });
    }

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      state?: AppState;
      message?: string;
    } & AuthErrorResponse;

    if (!res.ok || !data.ok || !data.state) {
      throw new DsbAuthError(
        data.error ? data : { error: `No se pudo completar el reinicio (HTTP ${res.status}).` }
      );
    }

    const normalizedState = commitMutatedState(data.state, true);
    return {
      ok: true,
      state: normalizedState,
      message: data.message || 'Todas las métricas y datos fueron reiniciados a 0.',
    };
  } finally {
    endMutation();
  }
}

// ----------------------------------------------------------------------------
// AI Manager Supreme Control API (Exclusive to role === 'ai_manager')
// ----------------------------------------------------------------------------

export async function updateProcessControlsRemote(
  updates: Partial<ProcessControls>
): Promise<{ state: AppState; processControls: ProcessControls }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      processControls: ProcessControls;
      state: AppState;
    }>('/api/ai-manager/process-controls', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const normalizedState = commitMutatedState(res.state, true);
    const processControls = normalizeProcessControls(
      res.processControls ?? normalizedState.settings?.processControls
    );
    return { state: normalizedState, processControls };
  } finally {
    endMutation();
  }
}

export async function aiManagerUpdateAccountCredentials(
  id: string,
  payload: {
    username?: string;
    displayName?: string;
    tag?: string;
    newPassword?: string;
    newPin?: string | null;
    active?: boolean;
    role?: UserRole;
  }
): Promise<{
  ok: boolean;
  account: UserAccount;
  state: AppState;
  sessionToken?: string;
  message: string;
}> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      account: UserAccount;
      state: AppState;
      sessionToken?: string;
      message?: string;
    }>(`/api/ai-manager/accounts/${encodeURIComponent(id)}/credentials`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.sessionToken && res.account) {
      const existing = getStoredSessionUser();
      saveSessionStorage(res.sessionToken, {
        userId: res.account.id || existing?.userId || id,
        username: res.account.username || existing?.username || 'JuanOrozco',
        displayName: res.account.displayName || existing?.displayName || 'Juan Orozco',
        role: res.account.role || existing?.role || 'ai_manager',
        tag: res.account.tag || existing?.tag || 'AI-MANAGER',
        avatarUrl: res.account.avatarUrl ?? existing?.avatarUrl ?? null,
      });
    }

    const normalizedState = commitMutatedState(res.state, true);
    return {
      ok: true,
      account: res.account,
      state: normalizedState,
      ...(res.sessionToken ? { sessionToken: res.sessionToken } : {}),
      message: res.message || 'Credenciales de cuenta actualizadas correctamente.',
    };
  } finally {
    endMutation();
  }
}

export async function aiManagerRevokeSessions(
  id: string
): Promise<{ ok: boolean; account: UserAccount; state: AppState; message: string }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      account: UserAccount;
      state: AppState;
      message?: string;
    }>(`/api/ai-manager/accounts/${encodeURIComponent(id)}/revoke-sessions`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      ok: true,
      account: res.account,
      state: normalizedState,
      message: res.message || 'Sesiones activas revocadas correctamente.',
    };
  } finally {
    endMutation();
  }
}

export async function fetchSystemHealth(): Promise<SystemHealthReport> {
  const res = await requestJson<SystemHealthReport & { ok?: boolean }>(
    '/api/ai-manager/system-health',
    { cache: 'no-store' }
  );
  return {
    storage: res.storage,
    timestamp: res.timestamp,
    uptimeSeconds: res.uptimeSeconds,
    counts: res.counts,
    processControls: normalizeProcessControls(res.processControls),
  };
}

export async function downloadSystemBackup(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>('/api/ai-manager/export-backup', {
    cache: 'no-store',
  });
}

export async function aiManagerPurgeAlerts(
  scope: 'resolved' | 'all' = 'resolved'
): Promise<{ ok: boolean; removed: number; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      removed?: number;
      state: AppState;
    }>('/api/ai-manager/alerts/purge', {
      method: 'POST',
      body: JSON.stringify({ scope }),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      ok: true,
      removed: typeof res.removed === 'number' ? res.removed : 0,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export async function aiManagerClearActivity(): Promise<{
  ok: boolean;
  removed: number;
  state: AppState;
}> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      removed?: number;
      state: AppState;
    }>('/api/ai-manager/activity/clear', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      ok: true,
      removed: typeof res.removed === 'number' ? res.removed : 0,
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}

export async function aiManagerReassignEmbajador(
  id: string,
  targetVendedorAccountId: string | null
): Promise<{
  ok: boolean;
  referrer: ReferralPartner;
  movedLeadsCount: number;
  movedQrsCount: number;
  previousOwnerName: string;
  newOwnerName: string;
  message: string;
  state: AppState;
}> {
  beginMutation();
  try {
    const res = await requestJson<{
      ok?: boolean;
      referrer: ReferralPartner;
      movedLeadsCount?: number;
      movedQrsCount?: number;
      previousOwnerName?: string;
      newOwnerName?: string;
      message?: string;
      state: AppState;
    }>(`/api/ai-manager/embajadores/${encodeURIComponent(id)}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ targetVendedorAccountId }),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return {
      ok: true,
      referrer: normalizeReferralPartner(res.referrer),
      movedLeadsCount: typeof res.movedLeadsCount === 'number' ? res.movedLeadsCount : 0,
      movedQrsCount: typeof res.movedQrsCount === 'number' ? res.movedQrsCount : 0,
      previousOwnerName: res.previousOwnerName || 'Ciprian Directo',
      newOwnerName: res.newOwnerName || 'Ciprian Directo',
      message: res.message || 'Embajador reasignado correctamente.',
      state: normalizedState,
    };
  } finally {
    endMutation();
  }
}
