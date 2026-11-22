import { normalizeReferralCode } from '../services/storeClient';

export const REFERRAL_LOCAL_KEY = 'ciprian_referral_attribution_v1';
const REFERRAL_SESSION_KEY = 'ciprian_referral_session_code_v1';
const REFERRAL_VISITOR_ID_KEY = 'ciprian_referral_visitor_id_v1';
const REFERRAL_PINGED_PREFIX = 'ciprian_referral_visit_pinged_v1:';
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface StoredReferralAttribution {
  code: string;
  capturedAt: number;
  expiresAt: number;
}

interface SessionReferralAttribution {
  code: string;
  capturedAt: number;
}

// In-memory fallbacks for restricted storage environments & React StrictMode dedup
let memoryReferralCode: string | null = null;
let memoryVisitorId: string | null = null;
const memoryPingedCodes = new Set<string>();

function extractRefParamFromSearch(search: string): string | null {
  if (!search) return null;
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (!query) return null;

  try {
    const params = new URLSearchParams(query);
    const direct = params.get('ref') ?? params.get('r');
    if (direct) return direct;

    // Case-insensitive fallback (e.g. ?REF=... or ?R=...)
    for (const [key, value] of params.entries()) {
      const lower = key.toLowerCase();
      if ((lower === 'ref' || lower === 'r') && value) {
        return value;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Extracts and normalizes `?ref=CODE` or `?r=CODE` from window.location.search
 * or hash query string (e.g. `#/?ref=CODE`).
 */
export function extractReferralCodeFromLocation(
  locationLike?: Pick<Location, 'search' | 'hash'>
): string | null {
  const loc =
    locationLike ?? (typeof window !== 'undefined' ? window.location : undefined);
  if (!loc) return null;

  const fromSearch = extractRefParamFromSearch(loc.search || '');
  if (fromSearch) {
    const normalized = normalizeReferralCode(fromSearch);
    if (normalized) return normalized;
  }

  const hash = loc.hash || '';
  const queryIdx = hash.indexOf('?');
  if (queryIdx !== -1) {
    const fromHash = extractRefParamFromSearch(hash.slice(queryIdx));
    if (fromHash) {
      const normalized = normalizeReferralCode(fromHash);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Persists a normalized referral code in both localStorage (30-day expiry)
 * and sessionStorage so navigation/reloads preserve lead attribution.
 */
export function persistReferralCode(rawCode: string): string | null {
  const normalized = normalizeReferralCode(rawCode);
  if (!normalized) return null;

  memoryReferralCode = normalized;

  if (typeof window === 'undefined') return normalized;

  const now = Date.now();
  const payload: StoredReferralAttribution = {
    code: normalized,
    capturedAt: now,
    expiresAt: now + REFERRAL_TTL_MS,
  };

  try {
    window.localStorage.setItem(REFERRAL_LOCAL_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / privacy mode errors
  }

  const sessionPayload: SessionReferralAttribution = {
    code: normalized,
    capturedAt: now,
  };

  try {
    window.sessionStorage.setItem(REFERRAL_SESSION_KEY, JSON.stringify(sessionPayload));
  } catch {
    // Ignore storage quota / privacy mode errors
  }

  return normalized;
}

function readLocalReferralAttribution(): StoredReferralAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REFERRAL_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredReferralAttribution>;
    const normalized = normalizeReferralCode(parsed.code);
    const expiresAt = Number(parsed.expiresAt || 0);
    const capturedAt = Number(parsed.capturedAt || 0);
    if (normalized && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return {
        code: normalized,
        capturedAt: Number.isFinite(capturedAt) ? capturedAt : 0,
        expiresAt,
      };
    }
    // Clean up expired or malformed entry
    window.localStorage.removeItem(REFERRAL_LOCAL_KEY);
  } catch {
    // Ignore localStorage read failure
  }
  return null;
}

function readSessionReferralAttribution(): SessionReferralAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(REFERRAL_SESSION_KEY);
    if (!raw) return null;
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as Partial<SessionReferralAttribution>;
      const normalized = normalizeReferralCode(parsed.code);
      const capturedAt = Number(parsed.capturedAt || 0);
      if (normalized) {
        return {
          code: normalized,
          capturedAt: Number.isFinite(capturedAt) ? capturedAt : 0,
        };
      }
      return null;
    }
    // Backwards compatibility with plain string session entry
    const normalized = normalizeReferralCode(raw);
    if (normalized) {
      return { code: normalized, capturedAt: 0 };
    }
  } catch {
    // Ignore sessionStorage read failure
  }
  return null;
}

/**
 * Reads any active (non-expired) referral code from localStorage / sessionStorage.
 * When both exist, prefers whichever was captured most recently (favoring localStorage on tie)
 * so opening a newer QR in another tab overrides stale session attribution.
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return memoryReferralCode;

  const localAttr = readLocalReferralAttribution();
  const sessionAttr = readSessionReferralAttribution();

  let chosen: { code: string; capturedAt: number } | null = null;
  if (localAttr && sessionAttr) {
    chosen = localAttr.capturedAt >= sessionAttr.capturedAt ? localAttr : sessionAttr;
  } else {
    chosen = localAttr || sessionAttr;
  }

  if (chosen) {
    memoryReferralCode = chosen.code;
    if (!sessionAttr || sessionAttr.code !== chosen.code || sessionAttr.capturedAt < chosen.capturedAt) {
      try {
        window.sessionStorage.setItem(
          REFERRAL_SESSION_KEY,
          JSON.stringify({ code: chosen.code, capturedAt: chosen.capturedAt })
        );
      } catch {
        // Ignore
      }
    }
    return chosen.code;
  }

  return memoryReferralCode;
}

/**
 * Captures referral code from current URL (overwriting any previous stored code)
 * or falls back to any valid persisted code in sessionStorage / localStorage.
 */
export function captureReferralCode(): string | null {
  const urlCode = extractReferralCodeFromLocation();
  if (urlCode) {
    return persistReferralCode(urlCode);
  }
  return getStoredReferralCode();
}

function generateAnonymousVisitorId(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `vis-${cryptoObj.randomUUID()}`;
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(12);
    cryptoObj.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `vis-${hex}`;
  }
  return `vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Returns a stable anonymous visitor ID persisted in localStorage.
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') {
    if (!memoryVisitorId) memoryVisitorId = generateAnonymousVisitorId();
    return memoryVisitorId;
  }

  try {
    const existing = window.localStorage.getItem(REFERRAL_VISITOR_ID_KEY);
    if (existing && existing.trim().length >= 6) {
      memoryVisitorId = existing.trim();
      return memoryVisitorId;
    }
  } catch {
    // Ignore read error
  }

  const nextId = memoryVisitorId || generateAnonymousVisitorId();
  memoryVisitorId = nextId;

  try {
    window.localStorage.setItem(REFERRAL_VISITOR_ID_KEY, nextId);
  } catch {
    // Ignore write error
  }

  return nextId;
}

/**
 * Checks whether we already pinged `/api/referrals/visit` for this code
 * during the current browser session (prevents F5 refresh spam).
 */
export function hasPingedReferralVisitThisSession(code: string): boolean {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return true;
  if (memoryPingedCodes.has(normalized)) return true;

  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(`${REFERRAL_PINGED_PREFIX}${normalized}`) === '1';
  } catch {
    return false;
  }
}

/**
 * Marks a referral code as pinged for the current browser session.
 */
export function markReferralVisitPinged(code: string): void {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  memoryPingedCodes.add(normalized);

  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${REFERRAL_PINGED_PREFIX}${normalized}`, '1');
  } catch {
    // Ignore storage error
  }
}
