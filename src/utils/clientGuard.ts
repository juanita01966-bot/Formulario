import {
  logoutDsbSession,
  reportClientTamper,
  verifySessionStorageIntegrity,
} from '../services/storeClient';

const SHIELD_OVERLAY_ID = 'ciprian-security-shield-overlay';
const GUARD_TOAST_ID = 'ciprian-security-guard-toast';
const REPORT_THROTTLE_MS = 30_000;
const SESSION_CHECK_INTERVAL_MS = 2_500;
const TOAST_DURATION_MS = 3_200;

let guardInstalled = false;
let guardEnabled = true;
let tamperReloadTriggered = false;
let toastTimerId: number | null = null;
const lastReportAt = new Map<string, number>();

export function setClientGuardEnabled(enabled: boolean): void {
  guardEnabled = Boolean(enabled);
}

export function isClientGuardEnabled(): boolean {
  return guardEnabled;
}

function isOnDashboardRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const pathname = window.location.pathname || '';
  return /^#\/dsb(?:$|[/?#])/i.test(hash) || /^\/dsb(?:$|[/?#])/i.test(pathname);
}

function reportTamperThrottled(reason: string, detail?: string): void {
  const now = Date.now();
  const prev = lastReportAt.get(reason) ?? 0;
  if (now - prev < REPORT_THROTTLE_MS) return;
  lastReportAt.set(reason, now);
  reportClientTamper(reason, detail);
}

function isEditableContextTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  let el: Element | null = null;
  if (target instanceof Element) {
    el = target;
  } else if (typeof Node !== 'undefined' && target instanceof Node) {
    el = target.parentElement;
  }
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return Boolean(el.closest('input, textarea, [contenteditable="true"], [contenteditable=""]'));
}

function getBlockedDevToolsShortcut(event: KeyboardEvent): string | null {
  const key = (event.key || '').toLowerCase();
  const code = event.code || '';

  if (key === 'f12' || code === 'F12') {
    return 'F12';
  }

  if (event.ctrlKey && event.shiftKey && !event.altKey) {
    if (key === 'i' || code === 'KeyI') return 'Ctrl+Shift+I';
    if (key === 'j' || code === 'KeyJ') return 'Ctrl+Shift+J';
    if (key === 'c' || code === 'KeyC') return 'Ctrl+Shift+C';
    if (key === 'k' || code === 'KeyK') return 'Ctrl+Shift+K';
  }

  if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
    if (key === 'u' || code === 'KeyU') return 'Ctrl+U';
  }

  if (event.metaKey && event.altKey) {
    if (key === 'i' || code === 'KeyI') return 'Meta+Alt+I';
    if (key === 'j' || code === 'KeyJ') return 'Meta+Alt+J';
    if (key === 'c' || code === 'KeyC') return 'Meta+Alt+C';
    if (key === 'u' || code === 'KeyU') return 'Meta+Alt+U';
  }

  return null;
}

function hideSecurityShieldOverlay(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(SHIELD_OVERLAY_ID);
  if (existing) {
    existing.remove();
  }
}

function showSecurityToast(messageText: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const host = document.body || document.documentElement;
  if (!host) return;

  let toast = document.getElementById(GUARD_TOAST_ID) as HTMLDivElement | null;
  if (!toast) {
    toast = document.createElement('div');
    toast.id = GUARD_TOAST_ID;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = [
      'position: fixed',
      'bottom: 20px',
      'right: 20px',
      'z-index: 2147483647',
      'max-width: 360px',
      'padding: 12px 16px',
      'border-radius: 14px',
      'background: linear-gradient(180deg, rgba(20, 18, 24, 0.96), rgba(12, 11, 16, 0.98))',
      'border: 1px solid rgba(212, 175, 55, 0.38)',
      'box-shadow: 0 18px 42px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(233, 202, 122, 0.22)',
      'color: #F5F2EB',
      'font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'font-size: 12.5px',
      'font-weight: 600',
      'display: flex',
      'align-items: center',
      'gap: 10px',
      'pointer-events: none',
      'transition: opacity 180ms ease, transform 180ms ease',
    ].join('; ');
    host.appendChild(toast);
  }

  toast.innerHTML =
    '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:rgba(212,175,55,0.14);border:1px solid rgba(212,175,55,0.32);color:#E6C677;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span><span></span>';
  const textSpan = toast.querySelectorAll('span')[1];
  if (textSpan) textSpan.textContent = messageText;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  if (toastTimerId !== null) {
    window.clearTimeout(toastTimerId);
  }
  toastTimerId = window.setTimeout(() => {
    const el = document.getElementById(GUARD_TOAST_ID);
    if (el) el.remove();
    toastTimerId = null;
  }, TOAST_DURATION_MS);
}

function enforceSessionStorageIntegrity(): void {
  if (tamperReloadTriggered) return;
  if (!isOnDashboardRoute()) return;
  if (verifySessionStorageIntegrity()) return;

  tamperReloadTriggered = true;
  reportClientTamper(
    'session_storage_tamper',
    'Intento de alteración de rol o sesión en almacenamiento local'
  );
  logoutDsbSession();

  try {
    window.location.hash = '#/dsb';
    window.location.reload();
  } catch {
    // Ignore navigation errors in restricted test environments
  }
}

function applyProductionConsoleLock(): void {
  if (!import.meta.env?.PROD) return;
  try {
    const warn = console.warn.bind(console);
    warn(
      '%c¡DETENTE! — Zona Protegida de Seguridad Ciprian',
      'color: #E6C677; background: #121015; font-size: 18px; font-weight: 800; padding: 8px 14px; border: 1px solid #D4AF37; border-radius: 6px;'
    );
    warn(
      '%cEl acceso no autorizado, inspección de sesión o manipulación de la consola es monitoreado y registrado en auditoría.',
      'color: #D5CFC4; font-size: 12px; font-weight: 600;'
    );
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.table = noop;
  } catch {
    // Ignore read-only console environments
  }
}

export function installClientSecurityGuard(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Clean up any stale full-screen shield overlay left over from prior HMR sessions
  hideSecurityShieldOverlay();
  if (guardInstalled) return;
  guardInstalled = true;

  // 1. Production Console Lock
  applyProductionConsoleLock();

  // 2. Context Menu Protection (allow only inside editable form inputs)
  document.addEventListener(
    'contextmenu',
    (event) => {
      if (!guardEnabled) return;
      if (isEditableContextTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (isOnDashboardRoute()) {
        showSecurityToast('Inspección bloqueada · Seguridad Ciprian');
      }
    },
    true
  );

  // 3. DevTools Keyboard Shortcut Blocker (capture phase)
  window.addEventListener(
    'keydown',
    (event) => {
      if (!guardEnabled) return;
      const combo = getBlockedDevToolsShortcut(event);
      if (!combo) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (isOnDashboardRoute()) {
        showSecurityToast(`Atajo ${combo} bloqueado · Seguridad Ciprian`);
        reportTamperThrottled('devtools_shortcut', combo);
      }
    },
    true
  );

  // 4. SessionStorage Tamper Guard (validates role/user against signed HMAC token)
  enforceSessionStorageIntegrity();
  window.setInterval(enforceSessionStorageIntegrity, SESSION_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      enforceSessionStorageIntegrity();
    }
  });
  window.addEventListener('focus', enforceSessionStorageIntegrity);
  window.addEventListener('hashchange', enforceSessionStorageIntegrity);
}
