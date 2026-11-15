import defaultStoreJson from '../shared/defaultStore.json';
import type {
  AppSettings,
  AppState,
  GiftItem,
  GiftVisualKey,
  Lead,
  LeadCategory,
  LeadQualification,
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

function cloneDefaults(): AppState {
  const defaults = JSON.parse(JSON.stringify(defaultStoreJson)) as AppState;
  return {
    ...defaults,
    settings: { ...defaults.settings, pinCode: '' },
    leads: [],
  };
}

function readLocalState(): AppState {
  if (typeof window === 'undefined') return cloneDefaults();
  const hasDsbSession = Boolean(getDsbSessionToken());
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = cloneDefaults();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const defaults = cloneDefaults();
    return {
      settings: { ...defaults.settings, ...(parsed.settings || {}), pinCode: '' },
      gifts: Array.isArray(parsed.gifts) && parsed.gifts.length > 0 ? parsed.gifts : defaults.gifts,
      leads: hasDsbSession && Array.isArray(parsed.leads) ? parsed.leads : [],
    };
  } catch {
    return cloneDefaults();
  }
}

function writeLocalState(state: AppState, broadcast = true): void {
  if (typeof window === 'undefined') return;
  const hasDsbSession = Boolean(getDsbSessionToken());
  const sanitizedState: AppState = {
    settings: { ...state.settings, pinCode: '' },
    gifts: state.gifts,
    // Never persist other people's leads into browser LocalStorage on the public route
    leads: hasDsbSession ? state.leads : [],
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedState));
    if (broadcast && channel) {
      channel.postMessage({ type: 'STATE_UPDATED', state: sanitizedState });
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
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    if (res.status >= 400 && res.status < 500) {
      throw new ApiValidationError(data.error || 'Solicitud inválida.');
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

export async function fetchAppState(): Promise<{ state: AppState; mode: 'api' | 'local' }> {
  try {
    const state = await requestJson<AppState>('/api/state');
    writeLocalState(state, false);
    return { state, mode: 'api' };
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    return { state: readLocalState(), mode: 'local' };
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
  try {
    const res = await requestJson<{ lead: Lead; state: AppState }>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    writeLocalState(res.state, Boolean(getDsbSessionToken()));
    return { ...res, mode: 'api' };
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;

    const state = readLocalState();
    const activeGifts = state.gifts.filter((g) => g.active);
    const chosenGift =
      state.gifts.find((g) => g.id === payload.giftId) ||
      activeGifts[Math.floor(Math.random() * activeGifts.length)] ||
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
      createdAt: new Date().toISOString(),
    };

    const nextState: AppState = {
      ...state,
      leads: [lead, ...state.leads],
    };
    writeLocalState(nextState, true);
    return { lead, state: nextState, mode: 'local' };
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
}

export async function updateLead(
  id: string,
  updates: UpdateLeadPayload
): Promise<{ lead: Lead; state: AppState }> {
  try {
    const res = await requestJson<{ lead: Lead; state: AppState }>(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    writeLocalState(res.state, Boolean(getDsbSessionToken()));
    return res;
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;

    const state = readLocalState();
    const index = state.leads.findIndex((l) => l.id === id);
    if (index === -1) throw new Error('Prospecto no encontrado.');

    const nextLead: Lead = { ...state.leads[index] };
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
      nextLead.calledAt = updates.called ? updates.calledAt || new Date().toISOString() : null;
      if (!updates.called) {
        nextLead.category = 'none';
        nextLead.orderAmount = null;
      }
    }

    if (updates.category !== undefined) {
      if (updates.category !== 'none' && !nextLead.called) {
        throw new ApiValidationError('Debes marcar al prospecto como llamado antes de clasificarlo.');
      }
      nextLead.category = updates.category;
      if (updates.category === 'orden') {
        nextLead.orderAmount = updates.orderAmount ?? nextLead.orderAmount ?? state.settings.defaultTicketAmount;
      } else {
        nextLead.orderAmount = null;
      }
    } else if (updates.orderAmount !== undefined && nextLead.category === 'orden') {
      nextLead.orderAmount = updates.orderAmount;
    }

    const nextLeads = [...state.leads];
    nextLeads[index] = nextLead;
    const nextState = { ...state, leads: nextLeads };
    writeLocalState(nextState, true);
    return { lead: nextLead, state: nextState };
  }
}

export async function deleteLead(id: string): Promise<AppState> {
  try {
    const res = await requestJson<{ state: AppState }>(`/api/leads/${id}`, {
      method: 'DELETE',
    });
    writeLocalState(res.state, true);
    return res.state;
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const nextState = { ...state, leads: state.leads.filter((l) => l.id !== id) };
    writeLocalState(nextState, true);
    return nextState;
  }
}

export interface UpsertGiftPayload {
  name: string;
  subtitle: string;
  tag: string;
  visualKey: GiftVisualKey;
  customImageUrl?: string;
  accentColor: string;
  active: boolean;
  stockLabel: string;
}

export async function createGift(payload: UpsertGiftPayload): Promise<{ gift: GiftItem; state: AppState }> {
  try {
    const res = await requestJson<{ gift: GiftItem; state: AppState }>('/api/gifts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    writeLocalState(res.state, true);
    return res;
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const gift: GiftItem = {
      id: generateLocalId('gift'),
      ...payload,
      customImageUrl: payload.customImageUrl?.trim() || undefined,
    };
    const nextState = { ...state, gifts: [...state.gifts, gift] };
    writeLocalState(nextState, true);
    return { gift, state: nextState };
  }
}

export async function updateGift(
  id: string,
  updates: Partial<UpsertGiftPayload>
): Promise<{ gift: GiftItem; state: AppState }> {
  try {
    const res = await requestJson<{ gift: GiftItem; state: AppState }>(`/api/gifts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    writeLocalState(res.state, true);
    return res;
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const index = state.gifts.findIndex((g) => g.id === id);
    if (index === -1) throw new Error('Regalo no encontrado.');
    if (updates.active === false && state.gifts.filter((g) => g.id !== id && g.active).length < 1) {
      throw new ApiValidationError('Debe quedar al menos un regalo activo para las tarjetas ocultas.');
    }
    const nextGift: GiftItem = {
      ...state.gifts[index],
      ...updates,
      customImageUrl:
        updates.customImageUrl === ''
          ? undefined
          : updates.customImageUrl ?? state.gifts[index].customImageUrl,
    };
    const nextGifts = [...state.gifts];
    nextGifts[index] = nextGift;
    const nextState = { ...state, gifts: nextGifts };
    writeLocalState(nextState, true);
    return { gift: nextGift, state: nextState };
  }
}

export async function deleteGift(id: string): Promise<AppState> {
  try {
    const res = await requestJson<{ state: AppState }>(`/api/gifts/${id}`, {
      method: 'DELETE',
    });
    writeLocalState(res.state, true);
    return res.state;
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const remaining = state.gifts.filter((g) => g.id !== id);
    if (remaining.filter((g) => g.active).length < 1) {
      throw new ApiValidationError('Debe quedar al menos un regalo activo en el catálogo.');
    }
    const nextState = { ...state, gifts: remaining };
    writeLocalState(nextState, true);
    return nextState;
  }
}

export async function resetDefaultGifts(): Promise<AppState> {
  try {
    const res = await requestJson<{ state: AppState }>('/api/gifts/reset', {
      method: 'POST',
    });
    writeLocalState(res.state, true);
    return res.state;
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const defaults = cloneDefaults();
    const nextState = { ...state, gifts: defaults.gifts };
    writeLocalState(nextState, true);
    return nextState;
  }
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppState> {
  try {
    const res = await requestJson<{ settings: AppSettings; state: AppState }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    writeLocalState(res.state, true);
    return res.state;
  } catch (err) {
    if (err instanceof ApiValidationError) throw err;
    const state = readLocalState();
    const nextState = { ...state, settings: { ...state.settings, ...updates } };
    writeLocalState(nextState, true);
    return nextState;
  }
}

export function subscribeStoreSync(onSync: (state: AppState) => void): () => void {
  const handleChannel = (event: MessageEvent) => {
    if (event.data?.type === 'STATE_UPDATED' && event.data.state) {
      onSync(event.data.state as AppState);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        onSync(JSON.parse(event.newValue) as AppState);
      } catch {
        // Ignore parse failure
      }
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

export async function loginStep1(
  username: string,
  password: string
): Promise<{ preAuthToken: string; username: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    preAuthToken?: string;
    username?: string;
  } & AuthErrorResponse;

  if (!res.ok || !data.preAuthToken) {
    throw new DsbAuthError(data);
  }

  return { preAuthToken: data.preAuthToken, username: data.username || username };
}

export async function verifyPinStep2(
  preAuthToken: string,
  pin: string
): Promise<{ sessionToken: string; username: string }> {
  const res = await fetch('/api/auth/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken, pin }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    sessionToken?: string;
    username?: string;
  } & AuthErrorResponse;

  if (!res.ok || !data.sessionToken) {
    throw new DsbAuthError(data);
  }

  sessionStorage.setItem(DSB_SESSION_TOKEN_KEY, data.sessionToken);
  return { sessionToken: data.sessionToken, username: data.username || 'Admin' };
}

export async function verifyDsbSession(): Promise<{ authenticated: boolean; username?: string }> {
  const token = sessionStorage.getItem(DSB_SESSION_TOKEN_KEY);
  if (!token) return { authenticated: false };
  try {
    const res = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      sessionStorage.removeItem(DSB_SESSION_TOKEN_KEY);
      return { authenticated: false };
    }
    const data = (await res.json()) as { authenticated: boolean; username?: string };
    return data;
  } catch {
    return { authenticated: false };
  }
}

export function logoutDsbSession(): void {
  sessionStorage.removeItem(DSB_SESSION_TOKEN_KEY);
  sessionStorage.removeItem('konverta_dsb_unlocked');
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...parsed, leads: [] })
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
