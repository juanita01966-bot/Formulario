import { create as createQrMatrix } from 'qrcode';
import { normalizeReferralCode } from '../../services/storeClient';
import {
  extractReferralCodeFromLocation,
  getStoredReferralCode,
} from '../../utils/referralTracking';

export interface ShareQrAssets {
  file: File;
  blob: Blob;
  previewDataUrl: string;
  targetUrl: string;
}

export interface GenerateShareQrOptions {
  referralCode?: string | null;
  referrerName?: string | null;
  referrerAvatarUrl?: string | null;
}

export interface BoostTierInfo {
  level: number;
  name: string;
  badge: string;
  shortLabel: string;
  progress: number;
  message: string;
}

export const BOOST_TIERS: readonly BoostTierInfo[] = [
  {
    level: 1,
    name: 'Invitado',
    badge: 'x1',
    shortLabel: 'Invitado',
    progress: 14,
    message: 'Comparte tu QR para activar tu impulso dorado por hasta $2,000 USD.',
  },
  {
    level: 2,
    name: 'x3 Boost',
    badge: 'x3',
    shortLabel: 'x3 Boost',
    progress: 48,
    message: '¡Impulso x3 activado! Comparte con un contacto más para subir a VIP.',
  },
  {
    level: 3,
    name: 'x5 VIP',
    badge: 'x5 VIP',
    shortLabel: 'x5 VIP',
    progress: 78,
    message: '¡Nivel x5 VIP desbloqueado! Estás a un paso del Máximo Dorado.',
  },
  {
    level: 4,
    name: 'Máximo Dorado',
    badge: '⚡ MAX',
    shortLabel: '⚡ Máximo',
    progress: 100,
    message: '¡⚡ Máximo Dorado activado! Cada nuevo envío sigue sumando oportunidades.',
  },
] as const;

export function resolveBoostTier(shareCount: number): BoostTierInfo {
  const safeCount = Math.max(0, Math.floor(shareCount));
  if (safeCount >= 3) return BOOST_TIERS[3];
  return BOOST_TIERS[safeCount] ?? BOOST_TIERS[0];
}

/**
 * Plays a subtle, warm metallic-gold harmonic triad via Web Audio API.
 * Completely fail-safe (silently ignored when blocked, unsupported, or reduced-motion).
 */
export function playDopamineChime(tierLevel = 1, prefersReduced = false): void {
  if (prefersReduced || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const clampedLevel = Math.max(1, Math.min(4, tierLevel));
    const baseFreqs =
      clampedLevel >= 4
        ? [523.25, 659.25, 783.99, 1046.5]
        : clampedLevel === 3
          ? [493.88, 659.25, 880]
          : clampedLevel === 2
            ? [440, 587.33, 783.99]
            : [392, 523.25, 659.25];

    baseFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === baseFreqs.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.055, now + idx * 0.055 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.36);
    });

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ignore autoplay / unsupported audio context errors
  }
}

const CARD_W = 1080;
const CARD_H = 1350;
const LOGO_PATH = '/images/logo%20ciprian.png';
const DEFAULT_QR_FILENAME = 'QR-The-Ciprian-Company.png';
const TARGET_REF_KEYS = ['ref', 'tag', 'r', 'qr'] as const;

function extractRefCodeFromTargetUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'https://thecipriancompany.com/');
    for (const key of TARGET_REF_KEYS) {
      const direct = parsed.searchParams.get(key);
      if (direct) {
        const normalized = normalizeReferralCode(direct);
        if (normalized) return normalized;
      }
    }
    const lowered = new Map<string, string>();
    for (const [key, value] of parsed.searchParams.entries()) {
      const lower = key.toLowerCase();
      if (value && !lowered.has(lower)) {
        lowered.set(lower, value);
      }
    }
    for (const key of TARGET_REF_KEYS) {
      const match = lowered.get(key);
      if (match) {
        const normalized = normalizeReferralCode(match);
        if (normalized) return normalized;
      }
    }
  } catch {
    return '';
  }
  return '';
}

function resolveEffectiveReferralCode(explicitCode?: string | null): string {
  const fromProp = normalizeReferralCode(explicitCode);
  if (fromProp) return fromProp;
  const fromLocation = extractReferralCodeFromLocation();
  if (fromLocation) return fromLocation;
  return getStoredReferralCode() || '';
}

export function getPublicLandingUrl(referralCode?: string | null): string {
  const effectiveCode = resolveEffectiveReferralCode(referralCode);
  const baseHref =
    typeof window === 'undefined' ? 'https://thecipriancompany.com/' : window.location.href;
  try {
    const url = new URL(baseHref);
    url.hash = '';
    url.search = '';
    if (effectiveCode) {
      url.searchParams.set('ref', effectiveCode);
    }
    return url.toString();
  } catch {
    const fallbackBase =
      typeof window === 'undefined'
        ? 'https://thecipriancompany.com/'
        : `${window.location.origin}/`;
    return effectiveCode
      ? `${fallbackBase}?ref=${encodeURIComponent(effectiveCode)}`
      : fallbackBase;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCornerOrnament(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dirX: 1 | -1,
  dirY: 1 | -1
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.78)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + dirY * 34);
  ctx.lineTo(x, y);
  ctx.lineTo(x + dirX * 34, y);
  ctx.stroke();

  // Tiny gold diamond accent
  ctx.fillStyle = '#FEF08A';
  const dx = x + dirX * 14;
  const dy = y + dirY * 14;
  ctx.beginPath();
  ctx.moveTo(dx, dy - 5);
  ctx.lineTo(dx + 5, dy);
  ctx.lineTo(dx, dy + 5);
  ctx.lineTo(dx - 5, dy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const clean = text.trim();
  if (!clean || ctx.measureText(clean).width <= maxWidth) return clean;
  let clipped = clean;
  while (clipped.length > 3 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1).trimEnd();
  }
  return `${clipped}…`;
}

function loadImageSafe(src?: string | null, timeoutMs = 3000): Promise<HTMLImageElement | null> {
  if (!src || typeof window === 'undefined') return Promise.resolve(null);
  const trimmed = src.trim();
  if (!trimmed) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    const isSameOrigin =
      (trimmed.startsWith('/') && !trimmed.startsWith('//')) ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith(window.location.origin);

    // Omit crossOrigin for data: and same-origin assets; enforce anonymous CORS for remote URLs
    // so a CORS-blocked remote image falls back cleanly instead of tainting canvas.toBlob().
    if (!isSameOrigin) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        finish(img);
      } else {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = trimmed;
  });
}

export async function generateShareQrAssets(
  targetUrl?: string,
  options?: GenerateShareQrOptions
): Promise<ShareQrAssets> {
  const effectiveTargetUrl = targetUrl || getPublicLandingUrl(options?.referralCode);
  const effectiveCode =
    normalizeReferralCode(options?.referralCode) ||
    extractRefCodeFromTargetUrl(effectiveTargetUrl);
  const cleanReferrerName = options?.referrerName?.trim() || '';
  const cleanReferrerAvatarUrl = options?.referrerAvatarUrl?.trim() || '';

  const qr = createQrMatrix(effectiveTargetUrl, { errorCorrectionLevel: 'H' });
  const modulesCount = qr.modules.size;
  const moduleData = qr.modules.data;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo QR.');
  }

  // 1. Rich Obsidian-to-Royal-Amber Backdrop
  const bg = ctx.createRadialGradient(CARD_W / 2, 260, 80, CARD_W / 2, CARD_H / 2, 920);
  bg.addColorStop(0, '#492513');
  bg.addColorStop(0.45, '#211008');
  bg.addColorStop(0.82, '#130804');
  bg.addColorStop(1, '#0B0402');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle volumetric champagne aura behind the QR plate
  const qrAura = ctx.createRadialGradient(CARD_W / 2, 620, 60, CARD_W / 2, 620, 440);
  qrAura.addColorStop(0, 'rgba(253, 230, 138, 0.22)');
  qrAura.addColorStop(0.55, 'rgba(200, 138, 43, 0.09)');
  qrAura.addColorStop(1, 'transparent');
  ctx.fillStyle = qrAura;
  ctx.fillRect(0, 180, CARD_W, 880);

  // 2. Metallic Gold Foil Double Frame + Corner Ornaments
  const foilStroke = ctx.createLinearGradient(40, 40, CARD_W - 40, CARD_H - 40);
  foilStroke.addColorStop(0, '#FDE68A');
  foilStroke.addColorStop(0.3, '#C88A2B');
  foilStroke.addColorStop(0.55, '#FEF08A');
  foilStroke.addColorStop(0.8, '#A16207');
  foilStroke.addColorStop(1, '#F4CA73');

  drawRoundedRect(ctx, 36, 36, CARD_W - 72, CARD_H - 72, 46);
  ctx.strokeStyle = foilStroke;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  drawRoundedRect(ctx, 52, 52, CARD_W - 104, CARD_H - 104, 36);
  ctx.strokeStyle = 'rgba(244, 202, 115, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top specular metallic bar
  const topBar = ctx.createLinearGradient(160, 0, CARD_W - 160, 0);
  topBar.addColorStop(0, 'transparent');
  topBar.addColorStop(0.25, '#B84A27');
  topBar.addColorStop(0.5, '#FEF08A');
  topBar.addColorStop(0.75, '#C88A2B');
  topBar.addColorStop(1, 'transparent');
  ctx.fillStyle = topBar;
  ctx.fillRect(160, 52, CARD_W - 320, 4);

  // Corner ornaments inside inner frame
  drawCornerOrnament(ctx, 74, 74, 1, 1);
  drawCornerOrnament(ctx, CARD_W - 74, 74, -1, 1);
  drawCornerOrnament(ctx, 74, CARD_H - 74, 1, -1);
  drawCornerOrnament(ctx, CARD_W - 74, CARD_H - 74, -1, -1);

  // 3. Header Brand & Headline
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F4CA73';
  ctx.font = '700 23px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('✦  THE CIPRIAN COMPANY · ROYAL PRESTIGE  ✦', CARD_W / 2, 128);

  ctx.fillStyle = '#FFFDF9';
  ctx.font = '700 54px "Fraunces", Georgia, serif';
  ctx.fillText('Escanea y Gana tu Obsequio', CARD_W / 2, 198);

  ctx.fillStyle = '#E6D2BC';
  ctx.font = '500 26px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('Destapa tu cajita sorpresa y participa por hasta $2,000 USD', CARD_W / 2, 244);

  // 4. High-Contrast Framed Ivory QR Plate (with generous quiet zone for instant scan)
  const padSize = 636;
  const padX = (CARD_W - padSize) / 2;
  const padY = 286;

  // Soft outer drop shadow under plate
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  drawRoundedRect(ctx, padX, padY, padSize, padSize, 42);
  ctx.fillStyle = '#FFFDF7';
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, padX, padY, padSize, padSize, 42);
  ctx.strokeStyle = foilStroke;
  ctx.lineWidth = 5;
  ctx.stroke();

  drawRoundedRect(ctx, padX + 12, padY + 12, padSize - 24, padSize - 24, 32);
  ctx.strokeStyle = 'rgba(200, 138, 43, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Render crisp high-contrast QR modules
  const quiet = 4;
  const qrDrawSize = padSize - 56;
  const cell = qrDrawSize / (modulesCount + quiet * 2);
  const originX = padX + 28 + quiet * cell;
  const originY = padY + 28 + quiet * cell;
  const centerClearMin = Math.floor(modulesCount * 0.39);
  const centerClearMax = Math.ceil(modulesCount * 0.61);

  ctx.fillStyle = '#1B0E07';
  for (let row = 0; row < modulesCount; row++) {
    for (let col = 0; col < modulesCount; col++) {
      if (!moduleData[row * modulesCount + col]) continue;
      if (
        row >= centerClearMin &&
        row <= centerClearMax &&
        col >= centerClearMin &&
        col <= centerClearMax
      ) {
        continue;
      }
      const x = originX + col * cell;
      const y = originY + row * cell;
      drawRoundedRect(ctx, x + cell * 0.05, y + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.22);
      ctx.fill();
    }
  }

  // Center medallion logo & optional CORS-safe ambassador portrait loaded in parallel
  const [logoImg, avatarImg] = await Promise.all([
    loadImageSafe(LOGO_PATH),
    cleanReferrerAvatarUrl ? loadImageSafe(cleanReferrerAvatarUrl, 3500) : Promise.resolve(null),
  ]);
  const cx = CARD_W / 2;
  const cy = padY + padSize / 2;
  const medalRadius = 56;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, medalRadius + 8, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDF7';
  ctx.fill();
  ctx.strokeStyle = '#C88A2B';
  ctx.lineWidth = 4.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, medalRadius, 0, Math.PI * 2);
  ctx.clip();
  if (logoImg) {
    ctx.drawImage(logoImg, cx - medalRadius, cy - medalRadius, medalRadius * 2, medalRadius * 2);
  } else {
    ctx.fillStyle = '#1B0E07';
    ctx.fillRect(cx - medalRadius, cy - medalRadius, medalRadius * 2, medalRadius * 2);
    ctx.fillStyle = '#F4CA73';
    ctx.font = '700 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TCC', cx, cy);
  }
  ctx.restore();

  // 5. Bold Gold Probability Multiplier Banner
  const bannerX = 82;
  const bannerW = CARD_W - 164;
  const bannerY = effectiveCode ? 960 : 984;
  const bannerH = 136;

  const bannerBg = ctx.createLinearGradient(bannerX, bannerY, bannerX + bannerW, bannerY + bannerH);
  bannerBg.addColorStop(0, 'rgba(229, 174, 78, 0.22)');
  bannerBg.addColorStop(0.5, 'rgba(253, 230, 138, 0.14)');
  bannerBg.addColorStop(1, 'rgba(184, 74, 39, 0.22)');
  drawRoundedRect(ctx, bannerX, bannerY, bannerW, bannerH, 28);
  ctx.fillStyle = bannerBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.58)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FEF08A';
  ctx.font = '800 24px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    '★ COMPARTE Y MULTIPLICA TUS PROBABILIDADES · HASTA $2,000 USD',
    CARD_W / 2,
    bannerY + 54
  );

  ctx.fillStyle = '#FAF3E8';
  ctx.font = '500 23px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    'Más amigos y familiares participando = mayores oportunidades de ganar',
    CARD_W / 2,
    bannerY + 98
  );

  // 6. Personalized VIP Ambassador Tag Pill & URL Footer
  if (effectiveCode) {
    const pillH = 54;
    const pillY = 1126;
    ctx.font = '700 23px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

    if (avatarImg && avatarImg.naturalWidth > 0 && avatarImg.naturalHeight > 0) {
      const avatarR = 20;
      const vipText = cleanReferrerName
        ? `Invitación VIP de ${cleanReferrerName} · Tag ${effectiveCode}`
        : `Invitación VIP · Tag ${effectiveCode}`;
      const fittedVip = truncateText(ctx, vipText, CARD_W - 280);
      const textW = ctx.measureText(fittedVip).width;
      const pillW = Math.min(CARD_W - 140, 14 + avatarR * 2 + 14 + textW + 28);
      const pillX = (CARD_W - pillW) / 2;

      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 27);
      ctx.fillStyle = 'rgba(244, 202, 115, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const avatarCx = pillX + 12 + avatarR;
      const avatarCy = pillY + pillH / 2;
      const srcSide = Math.min(avatarImg.naturalWidth, avatarImg.naturalHeight);
      const sx = (avatarImg.naturalWidth - srcSide) / 2;
      const sy = (avatarImg.naturalHeight - srcSide) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
      ctx.clip();
      try {
        ctx.drawImage(
          avatarImg,
          sx,
          sy,
          srcSide,
          srcSide,
          avatarCx - avatarR,
          avatarCy - avatarR,
          avatarR * 2,
          avatarR * 2
        );
      } catch {
        ctx.fillStyle = '#26150D';
        ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
      }
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#FDE68A';
      ctx.fillText(fittedVip, avatarCx + avatarR + 14, pillY + 35);
      ctx.textAlign = 'center';
    } else {
      const vipText = cleanReferrerName
        ? `✦ Invitación VIP de ${cleanReferrerName} · Tag ${effectiveCode}`
        : `✦ Invitación VIP · Tag ${effectiveCode}`;
      const fittedVip = truncateText(ctx, vipText, CARD_W - 220);
      const pillW = Math.min(CARD_W - 160, ctx.measureText(fittedVip).width + 64);
      const pillX = (CARD_W - pillW) / 2;

      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 27);
      ctx.fillStyle = 'rgba(244, 202, 115, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FDE68A';
      ctx.fillText(fittedVip, CARD_W / 2, pillY + 35);
    }
  }

  ctx.fillStyle = '#C6AA8A';
  ctx.font = '600 20px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const cleanUrlText = truncateText(ctx, effectiveTargetUrl, CARD_W - 180);
  ctx.fillText(cleanUrlText, CARD_W / 2, effectiveCode ? 1236 : 1200);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('No se pudo exportar la imagen QR.'));
    }, 'image/png');
  });

  const fileName = effectiveCode ? `invitacion-qr-${effectiveCode}.png` : DEFAULT_QR_FILENAME;
  const file = new File([blob], fileName, { type: 'image/png' });
  const previewDataUrl = canvas.toDataURL('image/png');

  return { file, blob, previewDataUrl, targetUrl: effectiveTargetUrl };
}

export function triggerQrDownload(assets: ShareQrAssets): void {
  const objectUrl = URL.createObjectURL(assets.blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = assets.file?.name || DEFAULT_QR_FILENAME;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}
