import defaultStoreJson from '../shared/defaultStore.json';
import type {
  AppSettings,
  AppState,
  GiftItem,
  GiftVisualKey,
  Lead,
  LeadCategory,
  LeadQualification,
  QrCodeRecord,
  QrDotShape,
  QrStyleId,
  ShowcaseStyleId,
} from '../types/app';

const STORAGE_KEY = 'royal_konverta_autumn_store_v1';
const CHANNEL_NAME = 'royal_konverta_sync';
const DSB_SESSION_TOKEN_KEY = 'cipriano_dsb_session_token';

const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

function getDsbSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(DSB_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function isDsbAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  if (!getDsbSessionToken()) return false;
  try {
    return window.sessionStorage.getItem(DSB_ROLE_KEY) === 'admin';
  } catch {
    return false;
  }
}

export const DEFAULT_GIFT_PROBABILITY = 10;

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
  const promoCodeInvalidated =
    typeof lead.promoCodeInvalidated === 'boolean'
      ? lead.promoCodeInvalidated || category !== 'none'
      : category !== 'none';
  const promoCodeInvalidatedAt = promoCodeInvalidated
    ? lead.promoCodeInvalidatedAt ?? lead.calledAt ?? lead.createdAt ?? null
    : null;
  return {
    ...lead,
    category,
    promoCodeInvalidated,
    promoCodeInvalidatedAt,
  };
}

function normalizeAppState(state: AppState): AppState {
  const role = (state as AppState & { role?: string }).role;
  if (role === 'caller') {
    return state;
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
    },
    gifts: Array.isArray(state.gifts) ? state.gifts.map(normalizeGift) : [],
    leads: Array.isArray(state.leads) ? state.leads.map(normalizeLead) : [],
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
    },
    gifts: Array.isArray(defaults.gifts) ? defaults.gifts.map(normalizeGift) : [],
    leads: [],
    qrHistory: [],
  };
}

function readLocalState(): AppState {
  if (typeof window === 'undefined') return cloneDefaults();
  const hasDsbSession = Boolean(getDsbSessionToken());
  const isAdmin = isDsbAdminSession();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = cloneDefaults();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const defaults = cloneDefaults();
    const rawGifts =
      Array.isArray(parsed.gifts) && parsed.gifts.length > 0 ? parsed.gifts : defaults.gifts;
    const mergedSettings: AppSettings = {
      ...defaults.settings,
      ...(parsed.settings || {}),
      pinCode: '',
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
      leads: hasDsbSession && Array.isArray(parsed.leads) ? parsed.leads.map(normalizeLead) : [],
      qrHistory: isAdmin && Array.isArray(parsed.qrHistory) ? parsed.qrHistory : [],
    };
  } catch {
    return cloneDefaults();
  }
}

function writeLocalState(state: AppState, broadcast = true): void {
  if (typeof window === 'undefined') return;
  const hasDsbSession = Boolean(getDsbSessionToken());
  const stateRole = (state as AppState & { role?: string }).role;
  const isAdmin =
    hasDsbSession && (stateRole ? stateRole === 'admin' : isDsbAdminSession());
  const sanitizedState: AppState = {
    settings: {
      ...state.settings,
      pinCode: '',
      ...(stateRole === 'caller'
        ? {}
        : {
            randomizeGifts:
              typeof state.settings?.randomizeGifts === 'boolean'
                ? state.settings.randomizeGifts
                : true,
          }),
    },
    gifts: Array.isArray(state.gifts) ? state.gifts.map(normalizeGift) : [],
    // Never persist other people's leads or admin QR history into browser LocalStorage on public/caller routes
    leads: hasDsbSession
      ? stateRole === 'caller'
        ? state.leads
        : (state.leads || []).map(normalizeLead)
      : [],
    qrHistory: isAdmin && Array.isArray(state.qrHistory) ? state.qrHistory : [],
  };

  try {
    const serialized = JSON.stringify(sanitizedState);
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

class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getDsbSessionToken();
  const res = await fetch(url, {
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

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    if (res.status === 404 && !data.error) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (res.status >= 400 && res.status < 500) {
      throw new ApiValidationError(data.error || 'Solicitud inválida.');
    }
    throw new Error(data.error || `HTTP ${res.status}`);
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
    if (err instanceof ApiValidationError) throw err;
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
    if (err instanceof ApiValidationError) throw err;

    const state = readLocalState();
    const activeGifts = state.gifts.filter((g) => g.active);
    const chosenGift =
      state.gifts.find((g) => g.id === payload.giftId) ||
      (activeGifts.length > 0 ? pickWeightedGift(activeGifts) : null) ||
      state.gifts[0] ||
      null;

    const lead: Lead = {
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
      category: 'none',
      orderAmount: null,
      notes: payload.notes?.trim() || '',
      qualification: payload.qualification ?? null,
      promoCodeInvalidated: false,
      promoCodeInvalidatedAt: null,
      createdAt: new Date().toISOString(),
    };

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
  adminPassword?: string;
}

export async function updateLead(
  id: string,
  updates: UpdateLeadPayload
): Promise<{ lead: Lead; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{ lead: Lead; state: AppState }>(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const normalizedState = commitMutatedState(res.state, Boolean(getDsbSessionToken()));
    return { lead: normalizeLead(res.lead), state: normalizedState };
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;

    const state = readLocalState();
    const index = state.leads.findIndex((l) => l.id === id);
    if (index === -1) throw new Error('Prospecto no encontrado.');

    const currentLead = normalizeLead(state.leads[index]);
    const nextLead: Lead = { ...currentLead };
    const nowIso = new Date().toISOString();

    if (updates.name !== undefined) nextLead.name = updates.name.trim();
    if (updates.phone !== undefined) nextLead.phone = updates.phone.trim();
    if (updates.address !== undefined) nextLead.address = updates.address.trim();
    if (updates.notes !== undefined) nextLead.notes = updates.notes;
    if (updates.giftId !== undefined) nextLead.giftId = updates.giftId;
    if (updates.giftName !== undefined) nextLead.giftName = updates.giftName;
    if (updates.giftVisualKey !== undefined) nextLead.giftVisualKey = updates.giftVisualKey;
    if (updates.claimCode !== undefined) nextLead.claimCode = updates.claimCode;
    if (updates.qualification !== undefined) nextLead.qualification = updates.qualification;

    if (updates.called !== undefined) {
      nextLead.called = updates.called;
      nextLead.calledAt = updates.called ? updates.calledAt || nowIso : null;
      if (!updates.called) {
        nextLead.category = 'none';
        nextLead.orderAmount = null;
        nextLead.promoCodeInvalidated = false;
        nextLead.promoCodeInvalidatedAt = null;
      }
    }

    if (updates.promoCodeInvalidated === false || updates.category === 'none') {
      nextLead.category = 'none';
      nextLead.orderAmount = null;
      nextLead.promoCodeInvalidated = false;
      nextLead.promoCodeInvalidatedAt = null;
    } else if (updates.category !== undefined) {
      if (!nextLead.called) {
        throw new ApiValidationError('Debes marcar al prospecto como llamado antes de clasificarlo.');
      }
      nextLead.category = updates.category;
      nextLead.promoCodeInvalidated = true;
      nextLead.promoCodeInvalidatedAt = currentLead.promoCodeInvalidatedAt || nowIso;
      if (updates.category === 'orden') {
        nextLead.orderAmount = updates.orderAmount ?? nextLead.orderAmount ?? state.settings.defaultTicketAmount;
      } else {
        nextLead.orderAmount = null;
      }
    } else if (updates.orderAmount !== undefined && nextLead.category === 'orden') {
      nextLead.orderAmount = updates.orderAmount;
    } else if (updates.promoCodeInvalidated === true) {
      nextLead.promoCodeInvalidated = true;
      nextLead.promoCodeInvalidatedAt = currentLead.promoCodeInvalidatedAt || nowIso;
    }

    const nextLeads = [...state.leads];
    nextLeads[index] = nextLead;
    const nextState = commitMutatedState({ ...state, leads: nextLeads }, true);
    return { lead: nextLead, state: nextState };
  } finally {
    endMutation();
  }
}

export async function deleteLead(id: string): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ state: AppState }>(`/api/leads/${id}`, {
      method: 'DELETE',
    });
    return commitMutatedState(res.state, true);
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    return commitMutatedState(
      { ...state, leads: state.leads.filter((l) => l.id !== id) },
      true
    );
  } finally {
    endMutation();
  }
}

const VALID_SHOWCASE_STYLES = new Set<ShowcaseStyleId>([
  'luminous-gold',
  'crystal-aurora',
  'royal-ember',
]);

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
}

export async function createGift(payload: UpsertGiftPayload): Promise<{ gift: GiftItem; state: AppState }> {
  const sanitizedPayload: UpsertGiftPayload = {
    ...payload,
    probability: sanitizeGiftProbability(payload.probability, DEFAULT_GIFT_PROBABILITY),
  };
  beginMutation();
  try {
    const res = await requestJson<{ gift: GiftItem; state: AppState }>('/api/gifts', {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return { gift: normalizeGift(res.gift), state: normalizedState };
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const gift: GiftItem = normalizeGift({
      id: generateLocalId('gift'),
      ...payload,
      usageTip: payload.usageTip?.trim() || '',
      customImageUrl: payload.customImageUrl?.trim() || undefined,
      probability: sanitizeGiftProbability(payload.probability, DEFAULT_GIFT_PROBABILITY),
    });
    const nextState = commitMutatedState({ ...state, gifts: [...state.gifts, gift] }, true);
    return { gift, state: nextState };
  } finally {
    endMutation();
  }
}

export async function updateGift(
  id: string,
  updates: Partial<UpsertGiftPayload>
): Promise<{ gift: GiftItem; state: AppState }> {
  const hasFiniteProbUpdate =
    updates.probability !== undefined &&
    typeof updates.probability === 'number' &&
    Number.isFinite(updates.probability);
  const apiUpdates: Partial<UpsertGiftPayload> =
    updates.probability !== undefined
      ? {
          ...updates,
          probability: hasFiniteProbUpdate
            ? sanitizeGiftProbability(updates.probability, DEFAULT_GIFT_PROBABILITY)
            : undefined,
        }
      : updates;
  beginMutation();
  try {
    const res = await requestJson<{ gift: GiftItem; state: AppState }>(`/api/gifts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(apiUpdates),
    });
    const normalizedState = commitMutatedState(res.state, true);
    return { gift: normalizeGift(res.gift), state: normalizedState };
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const index = state.gifts.findIndex((g) => g.id === id);
    if (index === -1) throw new Error('Regalo no encontrado.');
    if (updates.active === false && state.gifts.filter((g) => g.id !== id && g.active).length < 1) {
      throw new ApiValidationError('Debe quedar al menos un regalo activo para las tarjetas ocultas.');
    }
    const currentGift = state.gifts[index];
    const currentProbability = sanitizeGiftProbability(
      currentGift.probability,
      DEFAULT_GIFT_PROBABILITY
    );
    const nextGift: GiftItem = normalizeGift({
      ...currentGift,
      ...updates,
      usageTip:
        updates.usageTip !== undefined
          ? updates.usageTip.trim()
          : currentGift.usageTip || '',
      customImageUrl:
        updates.customImageUrl === ''
          ? undefined
          : updates.customImageUrl ?? currentGift.customImageUrl,
      probability:
        updates.probability !== undefined
          ? sanitizeGiftProbability(updates.probability, currentProbability)
          : currentProbability,
    });
    const nextGifts = [...state.gifts];
    nextGifts[index] = nextGift;
    const nextState = commitMutatedState({ ...state, gifts: nextGifts }, true);
    return { gift: nextGift, state: nextState };
  } finally {
    endMutation();
  }
}

export async function updateGiftProbabilities(
  probabilities: Record<string, number> | Array<{ id: string; probability: number }>
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

  const updatesMap = new Map(entries.map((entry) => [entry.id, entry.probability]));

  beginMutation();
  try {
    const res = await requestJson<{ gifts: GiftItem[]; state: AppState }>(
      '/api/gifts/probabilities',
      {
        method: 'PATCH',
        body: JSON.stringify({ gifts: entries }),
      }
    );
    const normalizedState = commitMutatedState(res.state, true);
    return { gifts: normalizedState.gifts, state: normalizedState };
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const nextGifts = state.gifts.map((gift) => {
      const normalized = normalizeGift(gift);
      const nextProb = updatesMap.get(normalized.id);
      return nextProb !== undefined ? { ...normalized, probability: nextProb } : normalized;
    });
    const nextState = commitMutatedState({ ...state, gifts: nextGifts }, true);
    return { gifts: nextGifts, state: nextState };
  } finally {
    endMutation();
  }
}

export async function deleteGift(id: string): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ state: AppState }>(`/api/gifts/${id}`, {
      method: 'DELETE',
    });
    return commitMutatedState(res.state, true);
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const remaining = state.gifts.filter((g) => g.id !== id);
    if (remaining.filter((g) => g.active).length < 1) {
      throw new ApiValidationError('Debe quedar al menos un regalo activo en el catálogo.');
    }
    return commitMutatedState({ ...state, gifts: remaining }, true);
  } finally {
    endMutation();
  }
}

export async function resetDefaultGifts(): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ state: AppState }>('/api/gifts/reset', {
      method: 'POST',
    });
    return commitMutatedState(res.state, true);
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const defaults = cloneDefaults();
    return commitMutatedState({ ...state, gifts: defaults.gifts }, true);
  } finally {
    endMutation();
  }
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppState> {
  beginMutation();
  try {
    const res = await requestJson<{ settings: AppSettings; state: AppState }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return commitMutatedState(res.state, true);
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const nextSettings: AppSettings = {
      ...state.settings,
      ...updates,
      pinCode: '',
      showcaseStyle:
        updates.showcaseStyle && VALID_SHOWCASE_STYLES.has(updates.showcaseStyle)
          ? updates.showcaseStyle
          : state.settings.showcaseStyle || 'luminous-gold',
      randomizeGifts:
        typeof updates.randomizeGifts === 'boolean'
          ? updates.randomizeGifts
          : typeof state.settings.randomizeGifts === 'boolean'
            ? state.settings.randomizeGifts
            : true,
    };
    return commitMutatedState({ ...state, settings: nextSettings }, true);
  } finally {
    endMutation();
  }
}

const VALID_QR_STYLE_IDS = new Set<QrStyleId>([
  'classic-gold',
  'obsidian-dots',
  'ivory-rounded',
  'emerald-heritage',
  'ruby-atelier',
]);
const VALID_QR_DOT_SHAPES = new Set<QrDotShape>(['square', 'rounded', 'dots']);
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidQrTargetUrl(rawUrl: string): boolean {
  const clean = rawUrl.trim();
  if (!clean || clean.length > 2048) return false;
  if (clean.startsWith('/') && !clean.startsWith('//')) return true;
  try {
    const parsed = new URL(clean);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export interface CreateQrPayload {
  name: string;
  targetUrl: string;
  styleId?: QrStyleId;
  dotShape?: QrDotShape;
  foregroundColor?: string;
  backgroundColor?: string;
  includeLogo?: boolean;
  frameText?: string;
}

export async function createQrCode(
  payload: CreateQrPayload
): Promise<{ qr: QrCodeRecord; state: AppState }> {
  beginMutation();
  try {
    const res = await requestJson<{ qr: QrCodeRecord; qrHistory?: QrCodeRecord[]; state: AppState }>(
      '/api/qr',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    const normalizedState = commitMutatedState(res.state, true);
    return { qr: res.qr, state: normalizedState };
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;

    if (!isDsbAdminSession()) {
      throw new ApiValidationError('Acceso denegado. Permisos administrativos requeridos.');
    }

    const cleanName = payload.name.trim();
    const cleanUrl = payload.targetUrl.trim();
    if (cleanName.length < 2) {
      throw new ApiValidationError('El nombre del código QR debe tener al menos 2 caracteres.');
    }
    if (!isValidQrTargetUrl(cleanUrl)) {
      throw new ApiValidationError('Ingresa una URL válida que comience con http://, https:// o /.');
    }

    const cleanFrameText = payload.frameText?.trim().slice(0, 120) || undefined;
    const qr: QrCodeRecord = {
      id: generateLocalId('qr'),
      name: cleanName.slice(0, 120),
      targetUrl: cleanUrl,
      styleId:
        payload.styleId && VALID_QR_STYLE_IDS.has(payload.styleId)
          ? payload.styleId
          : 'classic-gold',
      dotShape:
        payload.dotShape && VALID_QR_DOT_SHAPES.has(payload.dotShape)
          ? payload.dotShape
          : 'rounded',
      foregroundColor:
        payload.foregroundColor && HEX_COLOR_RE.test(payload.foregroundColor.trim())
          ? payload.foregroundColor.trim()
          : '#22150E',
      backgroundColor:
        payload.backgroundColor && HEX_COLOR_RE.test(payload.backgroundColor.trim())
          ? payload.backgroundColor.trim()
          : '#FFFDF9',
      includeLogo: typeof payload.includeLogo === 'boolean' ? payload.includeLogo : true,
      ...(cleanFrameText ? { frameText: cleanFrameText } : {}),
      createdAt: new Date().toISOString(),
    };

    const state = readLocalState();
    const nextState = commitMutatedState(
      {
        ...state,
        qrHistory: [qr, ...(state.qrHistory || [])],
      },
      true
    );
    return { qr, state: nextState };
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
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;

    if (!isDsbAdminSession()) {
      throw new ApiValidationError('Acceso denegado. Permisos administrativos requeridos.');
    }

    const state = readLocalState();
    return commitMutatedState(
      {
        ...state,
        qrHistory: (state.qrHistory || []).filter((item) => item.id !== id),
      },
      true
    );
  } finally {
    endMutation();
  }
}

export function subscribeStoreSync(onSync: (state: AppState) => void): () => void {
  let lastDeliveredJson = '';

  const deliverIfChanged = (candidate: AppState, fromAuthedSource: boolean) => {
    if (activeMutationCount > 0) return;
    const isCurrentTabAuthed = Boolean(getDsbSessionToken());
    if (isCurrentTabAuthed && !fromAuthedSource) {
      // Never allow an unauthenticated public tab's stripped state to wipe DSB leads/QR history
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
      const parsed = JSON.parse(event.newValue) as AppState;
      const isCurrentTabAuthed = Boolean(getDsbSessionToken());
      const incomingHasLeads = Array.isArray(parsed.leads) && parsed.leads.length > 0;
      const currentHasLeads =
        Array.isArray(latestCommittedState?.leads) && latestCommittedState.leads.length > 0;
      if (isCurrentTabAuthed && !incomingHasLeads && currentHasLeads) {
        // Public tabs strip leads in localStorage; authed DSB resets arrive via BroadcastChannel (sourceAuthed: true)
        return;
      }
      deliverIfChanged(parsed, !isCurrentTabAuthed || incomingHasLeads);
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

export interface AuthErrorResponse {
  error?: string;
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

export const DSB_ROLE_KEY = 'cipriano_dsb_role';

interface FallbackAccount {
  username: string;
  role: 'admin' | 'caller';
  userHashes: Set<string>;
  pwdHashes: Set<string>;
  pinHashes: Set<string>;
}

const FALLBACK_ACCOUNTS: FallbackAccount[] = [
  {
    username: 'AdminCiprian',
    role: 'admin',
    userHashes: new Set(['5dbd4bd91051c7b5b11a696562016355f51672251611218c71923683fdde56c4']),
    pwdHashes: new Set(['8f7289679cd994a3283afaec616377653dd3a4fb23f6946f8265c4b9e2c908ee']),
    pinHashes: new Set(['ab43d09287dec7e951522e1adc084a95af2cea3bb6a3d7bb940843ac8a63b0be']),
  },
  {
    username: 'Caller',
    role: 'caller',
    userHashes: new Set([
      '9e61aba50ade2e90a650017fea1d840dacdb5585235eabe2fb1e9cec4e22461c',
      'a7f29f0f9b6cb60d7c71f379434e320f772bf22d7ba59f6b986872583804aa18',
    ]),
    pwdHashes: new Set([
      'eb60d6e50255d26572a94097be640ad4c7311845b039a1ffa1e38e8b9ce14f01',
      '2e2c8fb944e94b281f6920fbbff91db858908f5d023f0423c9314c44280cf277',
    ]),
    pinHashes: new Set([
      '8e78515e0134148dbebf546e488caaaa069c73d6af3adef96ec8c2c29acfbd1e',
      '7c975a64380ca9ce63737ecae6ae406856b3e6425cff2fdfc100e470123565f4',
    ]),
  },
];
const FALLBACK_ATTEMPTS_KEY = 'cipriano_dsb_attempts';

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getFallbackRateLimit(scope: 'login' | 'pin'): {
  locked: boolean;
  retryAfterSeconds: number;
  count: number;
} {
  try {
    const raw = sessionStorage.getItem(`${FALLBACK_ATTEMPTS_KEY}_${scope}`);
    if (!raw) return { locked: false, retryAfterSeconds: 0, count: 0 };
    const parsed = JSON.parse(raw) as { count: number; lockedUntil: number };
    const now = Date.now();
    if (parsed.lockedUntil > now) {
      return {
        locked: true,
        retryAfterSeconds: Math.ceil((parsed.lockedUntil - now) / 1000),
        count: parsed.count,
      };
    }
    if (parsed.lockedUntil > 0 && parsed.lockedUntil <= now) {
      sessionStorage.removeItem(`${FALLBACK_ATTEMPTS_KEY}_${scope}`);
      return { locked: false, retryAfterSeconds: 0, count: 0 };
    }
    return { locked: false, retryAfterSeconds: 0, count: parsed.count || 0 };
  } catch {
    return { locked: false, retryAfterSeconds: 0, count: 0 };
  }
}

function recordFallbackFailure(scope: 'login' | 'pin'): {
  locked: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
} {
  const cur = getFallbackRateLimit(scope);
  const nextCount = cur.count + 1;
  const max = 5;
  const lockedUntil = nextCount >= max ? Date.now() + 15 * 60 * 1000 : 0;
  try {
    sessionStorage.setItem(
      `${FALLBACK_ATTEMPTS_KEY}_${scope}`,
      JSON.stringify({ count: nextCount, lockedUntil })
    );
  } catch {
    // Ignore storage restriction
  }
  return {
    locked: lockedUntil > Date.now(),
    retryAfterSeconds: lockedUntil > Date.now() ? 900 : 0,
    remainingAttempts: Math.max(0, max - nextCount),
  };
}

function clearFallbackFailures(scope: 'login' | 'pin'): void {
  try {
    sessionStorage.removeItem(`${FALLBACK_ATTEMPTS_KEY}_${scope}`);
  } catch {
    // Ignore storage cleanup error
  }
}

export async function loginStep1(
  username: string,
  password: string
): Promise<{ preAuthToken: string; username: string; role?: 'admin' | 'caller' }> {
  const cleanUser = username.trim();
  // Strictly reject AdminCripian and variants
  if (cleanUser.toLowerCase() === 'admincripian') {
    throw new DsbAuthError({ error: 'Credenciales inválidas.', remainingAttempts: 4 });
  }

  let apiUnavailable = false;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password }),
    });

    if (res.status === 404 || res.status >= 500) {
      apiUnavailable = true;
    } else {
      const data = (await res.json().catch(() => null)) as
        | ({ preAuthToken?: string; username?: string; user?: string; role?: 'admin' | 'caller' } & AuthErrorResponse)
        | null;

      if (!data) {
        apiUnavailable = true;
      } else if (!res.ok || !data.preAuthToken) {
        throw new DsbAuthError(data);
      } else {
        return {
          preAuthToken: data.preAuthToken,
          username: data.username || data.user || cleanUser,
          role: data.role || (cleanUser.toLowerCase() === 'caller' ? 'caller' : 'admin'),
        };
      }
    }
  } catch (err) {
    if (err instanceof DsbAuthError) throw err;
    apiUnavailable = true;
  }

  if (!apiUnavailable) {
    throw new DsbAuthError({ error: 'No se pudo completar la autenticación.' });
  }

  const rl = getFallbackRateLimit('login');
  if (rl.locked) {
    throw new DsbAuthError({
      error: `Demasiados intentos fallidos. Sistema bloqueado temporalmente (${rl.retryAfterSeconds}s).`,
      locked: true,
      retryAfterSeconds: rl.retryAfterSeconds,
      remainingAttempts: 0,
    });
  }

  const [userHash, pwdHash] = await Promise.all([
    sha256Hex(`dsb_user_v1:${cleanUser.toLowerCase()}`),
    sha256Hex(`dsb_pwd_v1:${password}`),
  ]);

  const matchedAccount = FALLBACK_ACCOUNTS.find(
    (acc) => acc.userHashes.has(userHash) && acc.pwdHashes.has(pwdHash)
  );

  if (!matchedAccount) {
    const fail = recordFallbackFailure('login');
    throw new DsbAuthError({
      error: fail.locked
        ? 'Alerta Anti-Hacking: Se superó el límite de 5 intentos. Acceso bloqueado por 15 minutos.'
        : `Credenciales inválidas. Intentos restantes antes de bloqueo: ${fail.remainingAttempts}.`,
      locked: fail.locked,
      retryAfterSeconds: fail.retryAfterSeconds,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  clearFallbackFailures('login');
  const expiresAt = Date.now() + 5 * 60 * 1000;
  return {
    preAuthToken: `local_pre.${matchedAccount.role}.${expiresAt}`,
    username: matchedAccount.username,
    role: matchedAccount.role,
  };
}

export async function verifyPinStep2(
  preAuthToken: string,
  pin: string
): Promise<{ sessionToken: string; username: string; role?: 'admin' | 'caller' }> {
  const isLocalPre = preAuthToken.startsWith('local_pre.');

  if (!isLocalPre) {
    let apiUnavailable = false;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuthToken, pin }),
      });

      if (res.status === 404 || res.status >= 500) {
        apiUnavailable = true;
      } else {
        const data = (await res.json().catch(() => null)) as
          | ({ sessionToken?: string; username?: string; user?: string; role?: 'admin' | 'caller' } & AuthErrorResponse)
          | null;

        if (!data) {
          apiUnavailable = true;
        } else if (!res.ok || !data.sessionToken) {
          throw new DsbAuthError(data);
        } else {
          const role = data.role || 'admin';
          sessionStorage.setItem(DSB_SESSION_TOKEN_KEY, data.sessionToken);
          sessionStorage.setItem(DSB_ROLE_KEY, role);
          stateMutationEpoch += 1;
          latestCommittedState = null;
          return {
            sessionToken: data.sessionToken,
            username: data.username || data.user || 'AdminCiprian',
            role,
          };
        }
      }
    } catch (err) {
      if (err instanceof DsbAuthError) throw err;
      apiUnavailable = true;
    }

    if (!apiUnavailable) {
      throw new DsbAuthError({ error: 'No se pudo verificar el PIN.' });
    }
  }

  // Fallback local PIN verification
  const parts = preAuthToken.split('.');
  const role: 'admin' | 'caller' = parts[1] === 'caller' ? 'caller' : 'admin';
  const exp = Number(parts[2] || parts[1]);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    throw new DsbAuthError({
      error: 'La sesión del primer filtro expiró. Vuelve a iniciar sesión.',
      expiredFirstFactor: true,
    });
  }

  const rl = getFallbackRateLimit('pin');
  if (rl.locked) {
    throw new DsbAuthError({
      error: `Segundo factor bloqueado temporalmente (${rl.retryAfterSeconds}s).`,
      locked: true,
      retryAfterSeconds: rl.retryAfterSeconds,
      remainingAttempts: 0,
    });
  }

  const pinHash = await sha256Hex(`dsb_pin_v1:${pin.trim()}`);
  const account = FALLBACK_ACCOUNTS.find((a) => a.role === role);
  if (!account || !account.pinHashes.has(pinHash)) {
    const fail = recordFallbackFailure('pin');
    throw new DsbAuthError({
      error: fail.locked
        ? 'Alerta Anti-Hacking: PIN bloqueado por 15 minutos tras 5 intentos fallidos.'
        : `PIN incorrecto. Intentos restantes: ${fail.remainingAttempts}.`,
      locked: fail.locked,
      retryAfterSeconds: fail.retryAfterSeconds,
      remainingAttempts: fail.remainingAttempts,
    });
  }

  clearFallbackFailures('pin');
  const sessionToken = `local_dsb.${role}.${Date.now() + 8 * 60 * 60 * 1000}`;
  sessionStorage.setItem(DSB_SESSION_TOKEN_KEY, sessionToken);
  sessionStorage.setItem(DSB_ROLE_KEY, role);
  stateMutationEpoch += 1;
  latestCommittedState = null;
  return { sessionToken, username: account.username, role };
}

export async function verifyDsbSession(): Promise<{
  authenticated: boolean;
  username?: string;
  role?: 'admin' | 'caller';
}> {
  const token = sessionStorage.getItem(DSB_SESSION_TOKEN_KEY);
  if (!token) return { authenticated: false };

  if (token.startsWith('local_dsb.')) {
    const parts = token.split('.');
    const role: 'admin' | 'caller' = parts[1] === 'caller' ? 'caller' : 'admin';
    const exp = Number(parts[2] || parts[1]);
    if (Number.isFinite(exp) && Date.now() <= exp) {
      sessionStorage.setItem(DSB_ROLE_KEY, role);
      return { authenticated: true, username: role === 'caller' ? 'Caller' : 'AdminCiprian', role };
    }
    sessionStorage.removeItem(DSB_SESSION_TOKEN_KEY);
    sessionStorage.removeItem(DSB_ROLE_KEY);
    return { authenticated: false };
  }

  try {
    const res = await fetch('/api/auth/session', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(DSB_SESSION_TOKEN_KEY);
        sessionStorage.removeItem(DSB_ROLE_KEY);
      }
      return { authenticated: false };
    }
    const data = (await res.json()) as {
      authenticated: boolean;
      username?: string;
      user?: string;
      role?: 'admin' | 'caller';
    };
    const role = data.role || (sessionStorage.getItem(DSB_ROLE_KEY) as 'admin' | 'caller') || 'admin';
    sessionStorage.setItem(DSB_ROLE_KEY, role);
    return {
      authenticated: data.authenticated,
      username: data.username || data.user,
      role,
    };
  } catch {
    return { authenticated: false };
  }
}

export function logoutDsbSession(): void {
  stateMutationEpoch += 1;
  latestCommittedState = null;
  lastWrittenLocalJson = '';
  sessionStorage.removeItem(DSB_SESSION_TOKEN_KEY);
  sessionStorage.removeItem(DSB_ROLE_KEY);
  sessionStorage.removeItem('konverta_dsb_unlocked');
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...parsed, leads: [], qrHistory: [] })
      );
    }
  } catch {
    // Ignore storage cleanup error
  }
}

export interface UpdateCredentialsPayload {
  masterPassword: string;
  newUsername?: string;
  newPassword?: string;
  newPin?: string;
}

export async function updateDsbCredentials(
  payload: UpdateCredentialsPayload
): Promise<{ ok: boolean; username: string; message: string }> {
  const token = getDsbSessionToken();
  const res = await fetch('/api/auth/update-credentials', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    username?: string;
    message?: string;
  } & AuthErrorResponse;

  if (!res.ok || !data.ok) {
    throw new DsbAuthError(data);
  }

  return {
    ok: true,
    username: data.username || 'Admin',
    message: data.message || 'Credenciales actualizadas.',
  };
}

export async function resetAllWorkspaceData(
  masterPassword: string,
  resetCatalogAndSettings = true
): Promise<{ ok: boolean; state: AppState; message: string }> {
  const token = getDsbSessionToken();
  beginMutation();
  try {
    const res = await fetch('/api/admin/reset-all', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        masterPassword,
        resetCatalogAndSettings,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      state?: AppState;
      message?: string;
    } & AuthErrorResponse;

    if (!res.ok || !data.ok || !data.state) {
      throw new DsbAuthError(data);
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
