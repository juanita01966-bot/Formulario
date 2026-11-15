import defaultStoreJson from '../shared/defaultStore.json';
import type {
  AppSettings,
  AppState,
  GiftItem,
  GiftThemeId,
  GiftVisualKey,
  Lead,
  LeadCategory,
  LeadQualification,
} from '../types/app';

const STORAGE_KEY = 'royal_konverta_autumn_store_v1';
const CHANNEL_NAME = 'royal_konverta_sync';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

function cloneDefaults(): AppState {
  return JSON.parse(JSON.stringify(defaultStoreJson)) as AppState;
}

function readLocalState(): AppState {
  if (typeof window === 'undefined') return cloneDefaults();
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
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      gifts: Array.isArray(parsed.gifts) && parsed.gifts.length > 0 ? parsed.gifts : defaults.gifts,
      leads: Array.isArray(parsed.leads) ? parsed.leads : defaults.leads,
    };
  } catch {
    return cloneDefaults();
  }
}

function writeLocalState(state: AppState, broadcast = true): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (broadcast && channel) {
      channel.postMessage({ type: 'STATE_UPDATED', state });
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
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

// ----------------------------------------------------------------------------
// Supabase REST / RPC Transport (active when VITE_SUPABASE_* env vars are set)
// ----------------------------------------------------------------------------

interface SupabaseSettingsRow {
  id: string;
  advisor_name: string;
  host_title: string;
  brand_subtitle: string;
  default_ticket_amount: number;
  require_pin: boolean;
  pin_code: string;
  gift_theme?: string | null;
  custom_box_color?: string | null;
}

interface SupabaseGiftRow {
  id: string;
  name: string;
  subtitle: string;
  tag: string;
  visual_key: string;
  custom_image_url?: string | null;
  accent_color: string;
  active: boolean;
  stock_label: string;
  sort_order?: number;
}

interface SupabaseLeadRow {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  accepted_terms: boolean;
  gift_id: string | null;
  gift_name: string | null;
  gift_visual_key: string | null;
  claim_code: string;
  called: boolean;
  called_at: string | null;
  category: string;
  order_amount: number | null;
  notes?: string | null;
  qualification?: LeadQualification | null;
  created_at: string;
}

function mapSettingsRow(row?: SupabaseSettingsRow): AppSettings {
  const defaults = cloneDefaults().settings;
  if (!row) return defaults;
  return {
    advisorName: row.advisor_name || defaults.advisorName,
    hostTitle: row.host_title || defaults.hostTitle,
    brandSubtitle: row.brand_subtitle || defaults.brandSubtitle,
    defaultTicketAmount: Number(row.default_ticket_amount ?? defaults.defaultTicketAmount),
    requirePin: Boolean(row.require_pin),
    pinCode: row.pin_code || defaults.pinCode,
    giftTheme: (row.gift_theme as GiftThemeId) || 'autumn',
    customBoxColor: row.custom_box_color || '#C88A2B',
  };
}

function mapGiftRow(row: SupabaseGiftRow): GiftItem {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle || '',
    tag: row.tag || '',
    visualKey: (row.visual_key as GiftVisualKey) || 'cutlery',
    customImageUrl: row.custom_image_url || undefined,
    accentColor: row.accent_color || '#C88A2B',
    active: Boolean(row.active),
    stockLabel: row.stock_label || 'Disponible',
  };
}

function mapLeadRow(row: SupabaseLeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address || '',
    acceptedTerms: Boolean(row.accepted_terms),
    giftId: row.gift_id ?? null,
    giftName: row.gift_name ?? null,
    giftVisualKey: (row.gift_visual_key as GiftVisualKey | null) ?? null,
    claimCode: row.claim_code,
    called: Boolean(row.called),
    calledAt: row.called_at ?? null,
    category: (row.category as LeadCategory) || 'none',
    orderAmount:
      row.order_amount !== null && row.order_amount !== undefined ? Number(row.order_amount) : null,
    notes: row.notes || '',
    qualification: row.qualification ?? null,
    createdAt: row.created_at,
  };
}

async function supabaseRest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const rawText = await res.text();
  const parsed = rawText
    ? (JSON.parse(rawText) as T & { message?: string; error?: string; hint?: string })
    : ({} as T);

  if (!res.ok) {
    const errPayload = parsed as { message?: string; error?: string };
    const msg = errPayload.message || errPayload.error || `Supabase HTTP ${res.status}`;
    if (res.status >= 400 && res.status < 500) {
      throw new ApiValidationError(msg);
    }
    throw new Error(msg);
  }

  return parsed;
}

async function supabaseRpc<T>(fnName: string, body: Record<string, unknown>): Promise<T> {
  return supabaseRest<T>(`rpc/${fnName}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function fetchSupabaseState(): Promise<AppState> {
  const defaults = cloneDefaults();
  const [settingsRows, giftRows, leadRows] = await Promise.all([
    supabaseRest<SupabaseSettingsRow[]>('app_settings?id=eq.default&limit=1'),
    supabaseRest<SupabaseGiftRow[]>('gifts?order=sort_order.asc,created_at.asc'),
    supabaseRest<SupabaseLeadRow[]>('leads?order=created_at.desc'),
  ]);

  return {
    settings: mapSettingsRow(settingsRows[0]),
    gifts: giftRows.length > 0 ? giftRows.map(mapGiftRow) : defaults.gifts,
    leads: leadRows.map(mapLeadRow),
  };
}

export async function fetchAppState(): Promise<{ state: AppState; mode: 'api' | 'local' }> {
  if (USE_SUPABASE) {
    try {
      const state = await fetchSupabaseState();
      writeLocalState(state, false);
      return { state, mode: 'api' };
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
      return { state: readLocalState(), mode: 'local' };
    }
  }

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
  if (USE_SUPABASE) {
    const cleanName = payload.name?.trim() || '';
    const cleanPhone = payload.phone?.trim() || '';
    const cleanAddress = payload.address?.trim() || '';

    if (!cleanName || cleanName.length < 2) {
      throw new ApiValidationError('Por favor ingresa tu nombre completo.');
    }
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 7) {
      throw new ApiValidationError('Por favor ingresa un número de teléfono válido.');
    }
    if (!payload.acceptedTerms) {
      throw new ApiValidationError('Debes aceptar el aviso y términos del evento.');
    }

    try {
      const currentState = await fetchSupabaseState();
      const activeGifts = currentState.gifts.filter((g) => g.active);
      const chosenGift =
        currentState.gifts.find((g) => g.id === payload.giftId) ||
        activeGifts[Math.floor(Math.random() * activeGifts.length)] ||
        currentState.gifts[0] ||
        null;

      const leadRow: SupabaseLeadRow = {
        id: generateLocalId('lead'),
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        accepted_terms: true,
        gift_id: chosenGift ? chosenGift.id : payload.giftId || null,
        gift_name: chosenGift ? chosenGift.name : payload.giftName || null,
        gift_visual_key: chosenGift ? chosenGift.visualKey : payload.giftVisualKey || null,
        claim_code: payload.claimCode?.trim() || generateClaimCode(),
        called: false,
        called_at: null,
        category: 'none',
        order_amount: null,
        notes: payload.notes?.trim() || '',
        qualification: payload.qualification ?? null,
        created_at: new Date().toISOString(),
      };

      const inserted = await supabaseRest<SupabaseLeadRow[]>('leads', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(leadRow),
      });

      const created = mapLeadRow(inserted[0] || leadRow);
      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return { lead: created, state: nextState, mode: 'api' };
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

  try {
    const res = await requestJson<{ lead: Lead; state: AppState }>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    writeLocalState(res.state, true);
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
  if (USE_SUPABASE) {
    try {
      const existingRows = await supabaseRest<SupabaseLeadRow[]>(
        `leads?id=eq.${encodeURIComponent(id)}&limit=1`
      );
      if (existingRows.length === 0) {
        throw new ApiValidationError('Prospecto no encontrado.');
      }

      const currentLead = mapLeadRow(existingRows[0]);
      const settingsRows = await supabaseRest<SupabaseSettingsRow[]>(
        'app_settings?id=eq.default&limit=1'
      );
      const currentSettings = mapSettingsRow(settingsRows[0]);

      const patchBody: Record<string, unknown> = {};
      if (updates.name !== undefined) patchBody.name = updates.name.trim();
      if (updates.phone !== undefined) patchBody.phone = updates.phone.trim();
      if (updates.address !== undefined) patchBody.address = updates.address.trim();
      if (updates.notes !== undefined) patchBody.notes = updates.notes;
      if (updates.giftId !== undefined) patchBody.gift_id = updates.giftId;
      if (updates.giftName !== undefined) patchBody.gift_name = updates.giftName;
      if (updates.giftVisualKey !== undefined) patchBody.gift_visual_key = updates.giftVisualKey;
      if (updates.claimCode !== undefined) patchBody.claim_code = updates.claimCode;
      if (updates.qualification !== undefined) patchBody.qualification = updates.qualification;

      let nextCalled = currentLead.called;
      if (updates.called !== undefined) {
        nextCalled = updates.called;
        patchBody.called = updates.called;
        patchBody.called_at = updates.called ? updates.calledAt || new Date().toISOString() : null;
        if (!updates.called) {
          patchBody.category = 'none';
          patchBody.order_amount = null;
        }
      }

      if (updates.category !== undefined) {
        if (updates.category !== 'none' && !nextCalled) {
          throw new ApiValidationError('Debes marcar al prospecto como llamado antes de clasificarlo.');
        }
        patchBody.category = updates.category;
        if (updates.category === 'orden') {
          patchBody.order_amount =
            updates.orderAmount ?? currentLead.orderAmount ?? currentSettings.defaultTicketAmount;
        } else {
          patchBody.order_amount = null;
        }
      } else if (updates.orderAmount !== undefined && currentLead.category === 'orden') {
        patchBody.order_amount = updates.orderAmount;
      }

      const updatedRows = await supabaseRest<SupabaseLeadRow[]>(
        `leads?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(patchBody),
        }
      );

      const updatedLead = mapLeadRow(updatedRows[0]);
      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return { lead: updatedLead, state: nextState };
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

  try {
    const res = await requestJson<{ lead: Lead; state: AppState }>(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    writeLocalState(res.state, true);
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
  if (USE_SUPABASE) {
    try {
      await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return nextState;
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

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
  if (USE_SUPABASE) {
    try {
      const row: SupabaseGiftRow = {
        id: generateLocalId('gift'),
        name: payload.name.trim(),
        subtitle: payload.subtitle.trim(),
        tag: payload.tag.trim(),
        visual_key: payload.visualKey,
        custom_image_url: payload.customImageUrl?.trim() || null,
        accent_color: payload.accentColor || '#C88A2B',
        active: Boolean(payload.active),
        stock_label: payload.stockLabel.trim() || 'Disponible',
        sort_order: Math.floor(Date.now() / 1000),
      };

      const inserted = await supabaseRest<SupabaseGiftRow[]>('gifts', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });

      const createdGift = mapGiftRow(inserted[0] || row);
      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return { gift: createdGift, state: nextState };
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

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
  if (USE_SUPABASE) {
    try {
      const currentGifts = await supabaseRest<SupabaseGiftRow[]>('gifts?order=sort_order.asc');
      const target = currentGifts.find((g) => g.id === id);
      if (!target) {
        throw new ApiValidationError('Regalo no encontrado.');
      }
      if (updates.active === false && currentGifts.filter((g) => g.id !== id && g.active).length < 1) {
        throw new ApiValidationError('Debe quedar al menos un regalo activo para las tarjetas ocultas.');
      }

      const patchBody: Record<string, unknown> = {};
      if (updates.name !== undefined) patchBody.name = updates.name.trim();
      if (updates.subtitle !== undefined) patchBody.subtitle = updates.subtitle.trim();
      if (updates.tag !== undefined) patchBody.tag = updates.tag.trim();
      if (updates.visualKey !== undefined) patchBody.visual_key = updates.visualKey;
      if (updates.customImageUrl !== undefined) {
        patchBody.custom_image_url = updates.customImageUrl.trim() || null;
      }
      if (updates.accentColor !== undefined) patchBody.accent_color = updates.accentColor;
      if (updates.active !== undefined) patchBody.active = updates.active;
      if (updates.stockLabel !== undefined) patchBody.stock_label = updates.stockLabel.trim();

      const updatedRows = await supabaseRest<SupabaseGiftRow[]>(
        `gifts?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(patchBody),
        }
      );

      const updatedGift = mapGiftRow(updatedRows[0]);
      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return { gift: updatedGift, state: nextState };
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

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
  if (USE_SUPABASE) {
    try {
      const currentGifts = await supabaseRest<SupabaseGiftRow[]>('gifts');
      const remaining = currentGifts.filter((g) => g.id !== id);
      if (remaining.filter((g) => g.active).length < 1) {
        throw new ApiValidationError('Debe quedar al menos un regalo activo en el catálogo.');
      }

      await supabaseRest(`gifts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return nextState;
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

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
  if (USE_SUPABASE) {
    try {
      const defaults = cloneDefaults().gifts;
      const defaultRows: SupabaseGiftRow[] = defaults.map((gift, idx) => ({
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
        body: JSON.stringify(defaultRows),
      });

      const defaultIds = defaults.map((g) => `"${g.id}"`).join(',');
      await supabaseRest(`gifts?id=not.in.(${encodeURIComponent(defaultIds)})`, {
        method: 'DELETE',
      });

      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return nextState;
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

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
  if (USE_SUPABASE) {
    try {
      const patchBody: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.advisorName !== undefined) patchBody.advisor_name = updates.advisorName;
      if (updates.hostTitle !== undefined) patchBody.host_title = updates.hostTitle;
      if (updates.brandSubtitle !== undefined) patchBody.brand_subtitle = updates.brandSubtitle;
      if (updates.defaultTicketAmount !== undefined) {
        patchBody.default_ticket_amount = updates.defaultTicketAmount;
      }
      if (updates.requirePin !== undefined) patchBody.require_pin = updates.requirePin;
      if (updates.pinCode !== undefined) patchBody.pin_code = updates.pinCode;
      if (updates.giftTheme !== undefined) patchBody.gift_theme = updates.giftTheme;
      if (updates.customBoxColor !== undefined) patchBody.custom_box_color = updates.customBoxColor;

      await supabaseRest('app_settings?id=eq.default', {
        method: 'PATCH',
        body: JSON.stringify(patchBody),
      });

      const nextState = await fetchSupabaseState();
      writeLocalState(nextState, true);
      return nextState;
    } catch (err) {
      if (err instanceof ApiValidationError) throw err;
    }
  }

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

const DSB_SESSION_TOKEN_KEY = 'cipriano_dsb_session_token';

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
  if (USE_SUPABASE) {
    const data = await supabaseRpc<{
      ok?: boolean;
      preAuthToken?: string;
      username?: string;
    } & AuthErrorResponse>('dsb_login_step1', {
      p_username: username,
      p_password: password,
    });

    if (!data.ok || !data.preAuthToken) {
      throw new DsbAuthError(data);
    }

    return { preAuthToken: data.preAuthToken, username: data.username || username };
  }

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
  if (USE_SUPABASE) {
    const data = await supabaseRpc<{
      ok?: boolean;
      sessionToken?: string;
      username?: string;
    } & AuthErrorResponse>('dsb_verify_pin', {
      p_pin: pin,
      p_pre_auth_token: preAuthToken,
    });

    if (!data.ok || !data.sessionToken) {
      throw new DsbAuthError(data);
    }

    sessionStorage.setItem(DSB_SESSION_TOKEN_KEY, data.sessionToken);
    return { sessionToken: data.sessionToken, username: data.username || 'AdminCripian' };
  }

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
  return { sessionToken: data.sessionToken, username: data.username || 'AdminCripian' };
}

export async function verifyDsbSession(): Promise<{ authenticated: boolean; username?: string }> {
  const token = sessionStorage.getItem(DSB_SESSION_TOKEN_KEY);
  if (!token) return { authenticated: false };

  if (USE_SUPABASE) {
    try {
      const data = await supabaseRpc<{ authenticated: boolean; username?: string }>(
        'dsb_verify_session',
        { p_session_token: token }
      );
      if (!data.authenticated) {
        sessionStorage.removeItem(DSB_SESSION_TOKEN_KEY);
        return { authenticated: false };
      }
      return data;
    } catch {
      return { authenticated: false };
    }
  }

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
  if (USE_SUPABASE) {
    const data = await supabaseRpc<{
      ok?: boolean;
      username?: string;
      message?: string;
    } & AuthErrorResponse>('dsb_update_credentials', {
      p_master_password: payload.masterPassword,
      p_new_username: payload.newUsername ?? null,
      p_new_password: payload.newPassword ?? null,
      p_new_pin: payload.newPin ?? null,
    });

    if (!data.ok) {
      throw new DsbAuthError(data);
    }

    return {
      ok: true,
      username: data.username || 'AdminCripian',
      message: data.message || 'Credenciales actualizadas.',
    };
  }

  const res = await fetch('/api/auth/update-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    username: data.username || 'AdminCripian',
    message: data.message || 'Credenciales actualizadas.',
  };
}
