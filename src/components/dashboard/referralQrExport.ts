import { create as createQrMatrix } from 'qrcode';
import type { QrStyleId } from '../../types/app';

export const LOGO_PUBLIC_PATH = '/images/logo%20ciprian.png';
const QR_QUIET_MARGIN = 3;

export interface ReferralQrTheme {
  id: QrStyleId;
  label: string;
  cardBg: string;
  cardInnerBg: string;
  fg: string;
  accent: string;
  muted: string;
  border: string;
  dark: boolean;
}

export const REFERRAL_QR_THEMES: Record<QrStyleId, ReferralQrTheme> = {
  'classic-gold': {
    id: 'classic-gold',
    label: 'Dorado Ciprian',
    cardBg: '#FFFDF9',
    cardInnerBg: '#FFF9ED',
    fg: '#22150E',
    accent: '#C88A2B',
    muted: '#7B5D4A',
    border: '#DFC394',
    dark: false,
  },
  'obsidian-dots': {
    id: 'obsidian-dots',
    label: 'Obsidiana & Oro',
    cardBg: '#16100C',
    cardInnerBg: '#1F1711',
    fg: '#F4CA73',
    accent: '#C88A2B',
    muted: '#D5BFA8',
    border: '#C88A2B',
    dark: true,
  },
  'ivory-rounded': {
    id: 'ivory-rounded',
    label: 'Marfil Minimal',
    cardBg: '#FFFFFF',
    cardInnerBg: '#FAF8F5',
    fg: '#1E1B18',
    accent: '#A2683A',
    muted: '#6B6259',
    border: '#E5DDD3',
    dark: false,
  },
  'emerald-heritage': {
    id: 'emerald-heritage',
    label: 'Esmeralda Royal',
    cardBg: '#FAFDF9',
    cardInnerBg: '#F1F8F3',
    fg: '#234734',
    accent: '#3D6B52',
    muted: '#577363',
    border: '#B8D4C2',
    dark: false,
  },
  'ruby-atelier': {
    id: 'ruby-atelier',
    label: 'Borgoña Otoño',
    cardBg: '#FFF9F5',
    cardInnerBg: '#FCEEE7',
    fg: '#7E2B14',
    accent: '#B84A27',
    muted: '#7E5A4B',
    border: '#E4B7A0',
    dark: false,
  },
};

export function sanitizeReferralCodeDraft(raw: string, maxLen = 32): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/g, '')
    .slice(0, maxLen);
}

export function normalizeReferralCodeInput(raw: string): string {
  return sanitizeReferralCodeDraft(raw, 32).replace(/-+$/g, '');
}

export function suggestReferralCodeFromName(
  name: string,
  existingCodes?: Set<string>
): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  let base = '';
  if (words.length === 0) {
    base = 'EMB';
  } else if (words.length === 1) {
    base = words[0].slice(0, 10);
  } else {
    base = `${words[0].slice(0, 7)}${words[1].slice(0, 3)}`;
  }

  base = normalizeReferralCodeInput(base);
  if (base.length < 2) {
    base = `${base || 'E'}01`;
  }

  if (!existingCodes || !existingCodes.has(base)) {
    return base;
  }

  for (let i = 2; i <= 99; i++) {
    const suffix = String(i).padStart(2, '0');
    const candidate = `${base.slice(0, 29)}${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  return `${base.slice(0, 24)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function buildReferralUrl(originUrl: string, code: string): string {
  const normalizedCode = normalizeReferralCodeInput(code) || code.trim().toUpperCase();
  const rawOrigin = (originUrl || (typeof window !== 'undefined' ? window.location.origin : '')).trim();

  try {
    const parsed = new URL(rawOrigin || 'https://thecipriancompany.com/');
    parsed.searchParams.set('ref', normalizedCode);
    return parsed.toString();
  } catch {
    const cleanBase = rawOrigin.replace(/\/+$/, '');
    if (cleanBase.includes('?')) {
      return `${cleanBase}&ref=${encodeURIComponent(normalizedCode)}`;
    }
    return `${cleanBase}/?ref=${encodeURIComponent(normalizedCode)}`;
  }
}

export function buildWhatsAppShareUrl(
  partner: { name: string; code: string; phone?: string },
  referralUrl: string,
  brandName = 'The Ciprian Company'
): string {
  const cleanDigits = (partner.phone || '').replace(/[^\d]/g, '');
  const message =
    `Hola ${partner.name}, aquí tienes tu enlace y QR personal de Embajador (${partner.code}) para invitar a tus contactos al Show de Cocina de ${brandName}:\n\n` +
    `${referralUrl}\n\n` +
    `Cada persona que escanee o se registre con tu enlace quedará registrada automáticamente a tu nombre para el premio.`;

  const encoded = encodeURIComponent(message);
  return cleanDigits.length >= 7
    ? `https://wa.me/${cleanDigits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

function isInFinderPattern(row: number, col: number, size: number): boolean {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7)
  );
}

function isInCenterSafeZone(row: number, col: number, size: number): boolean {
  const center = size / 2;
  const clearRadius = size * 0.132 + 0.55;
  return Math.hypot(col + 0.5 - center, row + 0.5 - center) < clearRadius;
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadLogoImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = LOGO_PUBLIC_PATH;
  });
}

function loadCorsSafeAvatarImage(avatarUrl?: string | null): Promise<HTMLImageElement | null> {
  const src = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), 4000);
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if ((img.naturalWidth || img.width) > 0 && (img.naturalHeight || img.height) > 0) {
        finish(img);
      } else {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = src;
  });
}

function drawCircularPortrait(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
  ringColor: string
): void {
  const srcW = img.naturalWidth || img.width || 1;
  const srcH = img.naturalHeight || img.height || 1;
  const side = Math.min(srcW, srcH);
  const sx = (srcW - side) / 2;
  const sy = (srcH - side) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, side, side, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, '#FDE68A');
  grad.addColorStop(0.5, ringColor);
  grad.addColorStop(1, '#8B550E');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCircularEmojiMedallion(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  cx: number,
  cy: number,
  radius: number,
  ringColor: string
): void {
  ctx.save();
  const bgGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  bgGrad.addColorStop(0, '#3A2216');
  bgGrad.addColorStop(0.5, '#26150D');
  bgGrad.addColorStop(1, '#7A4610');
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const fontSize = Math.round(radius * 1.15);
  ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 2);
  ctx.restore();

  ctx.save();
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, '#FDE68A');
  grad.addColorStop(0.5, ringColor);
  grad.addColorStop(1, '#8B550E');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function slugify(value: string): string {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'embajador';
}

export interface RenderReferralQrCardOptions {
  partnerName: string;
  code: string;
  referralUrl: string;
  avatarUrl?: string | null;
  emoji?: string | null;
  styleId?: QrStyleId;
  subtitle?: string;
  brandTitle?: string;
}

export type DownloadReferralQrOptions = RenderReferralQrCardOptions;

export async function renderReferralQrCardCanvas(
  options: RenderReferralQrCardOptions
): Promise<HTMLCanvasElement> {
  const theme = REFERRAL_QR_THEMES[options.styleId || 'classic-gold'] || REFERRAL_QR_THEMES['classic-gold'];
  const matrix = createQrMatrix(options.referralUrl, { errorCorrectionLevel: 'H' });
  const size = matrix.modules.size;
  const totalUnits = size + QR_QUIET_MARGIN * 2;
  const [logoImg, avatarImg] = await Promise.all([
    loadLogoImage(),
    loadCorsSafeAvatarImage(options.avatarUrl),
  ]);

  const W = 1024;
  const H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo HD para la tarjeta QR.');
  }

  // Outer card background
  ctx.fillStyle = theme.cardBg;
  ctx.fillRect(0, 0, W, H);

  // Subtle top luxury gold/terracotta ribbon bar
  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, '#B84A27');
  topGrad.addColorStop(0.5, '#E5AE4E');
  topGrad.addColorStop(1, '#3D6B52');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 14);

  // Outer decorative luxury frame
  ctx.save();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 3;
  traceRoundedRect(ctx, 32, 36, W - 64, H - 72, 40);
  ctx.stroke();

  // Inner hairline accent frame
  ctx.strokeStyle = theme.dark ? 'rgba(244, 202, 115, 0.22)' : 'rgba(200, 138, 43, 0.18)';
  ctx.lineWidth = 1.5;
  traceRoundedRect(ctx, 48, 52, W - 96, H - 104, 30);
  ctx.stroke();
  ctx.restore();

  // Header brand badge
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.accent;
  ctx.font = '700 22px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText(
    (options.brandTitle || 'THE CIPRIAN COMPANY · EMBAJADOR OFICIAL').toUpperCase(),
    W / 2,
    102
  );

  // Ambassador Name (with optional circular gold-bordered portrait or emoji medallion beside name)
  const nameText = options.partnerName.trim() || 'Embajador Ciprian';
  const nameFontSize = nameText.length > 26 ? 38 : nameText.length > 18 ? 44 : 50;
  const cleanEmoji = typeof options.emoji === 'string' ? options.emoji.trim() : '';
  ctx.fillStyle = theme.fg;
  ctx.font = `700 ${nameFontSize}px Fraunces, Georgia, serif`;

  if (avatarImg || cleanEmoji) {
    const avatarR = 34;
    const gap = 20;
    const maxNameWidth = W - 260;
    const measuredW = Math.min(ctx.measureText(nameText).width, maxNameWidth);
    const totalRowW = avatarR * 2 + gap + measuredW;
    const startX = (W - totalRowW) / 2;
    if (avatarImg) {
      drawCircularPortrait(ctx, avatarImg, startX + avatarR, 160, avatarR, theme.accent);
    } else {
      drawCircularEmojiMedallion(ctx, cleanEmoji, startX + avatarR, 160, avatarR, theme.accent);
    }
    ctx.textAlign = 'left';
    ctx.fillText(nameText, startX + avatarR * 2 + gap, 162, maxNameWidth);
    ctx.textAlign = 'center';
  } else {
    ctx.fillText(nameText, W / 2, 162, W - 160);
  }

  // Decorative gold divider
  const divGrad = ctx.createLinearGradient(W / 2 - 220, 206, W / 2 + 220, 206);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.5, theme.accent);
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, 206);
  ctx.lineTo(W / 2 + 220, 206);
  ctx.stroke();
  ctx.restore();

  // QR Container Panel
  const qrCardSize = 760;
  const qrCardX = (W - qrCardSize) / 2;
  const qrCardY = 238;

  ctx.save();
  ctx.fillStyle = theme.cardInnerBg;
  traceRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 32);
  ctx.fill();
  ctx.strokeStyle = theme.dark ? 'rgba(244, 202, 115, 0.45)' : 'rgba(200, 138, 43, 0.32)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Draw QR Modules
  const qrInnerSize = 712;
  const offsetX = qrCardX + (qrCardSize - qrInnerSize) / 2;
  const offsetY = qrCardY + (qrCardSize - qrInnerSize) / 2;
  const unit = qrInnerSize / totalUnits;
  const isDots = theme.id === 'obsidian-dots' || theme.id === 'ruby-atelier';

  ctx.fillStyle = theme.fg;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix.modules.get(row, col)) continue;
      if (isInFinderPattern(row, col, size)) continue;
      if (isInCenterSafeZone(row, col, size)) continue;

      const x = offsetX + (QR_QUIET_MARGIN + col) * unit;
      const y = offsetY + (QR_QUIET_MARGIN + row) * unit;

      if (isDots) {
        ctx.beginPath();
        ctx.arc(x + unit * 0.5, y + unit * 0.5, unit * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const pad = unit * 0.06;
        const side = unit * 0.88;
        traceRoundedRect(ctx, x + pad, y + pad, side, side, unit * 0.24);
        ctx.fill();
      }
    }
  }

  // Finder eyes
  const finderOrigins: Array<[number, number]> = [
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN + size - 7, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN + size - 7],
  ];
  const eyeOuterRadius = isDots ? unit * 2.0 : unit * 1.6;

  for (const [colOrigin, rowOrigin] of finderOrigins) {
    const fx = offsetX + colOrigin * unit;
    const fy = offsetY + rowOrigin * unit;

    ctx.save();
    ctx.strokeStyle = theme.fg;
    ctx.lineWidth = unit;
    traceRoundedRect(ctx, fx + unit * 0.5, fy + unit * 0.5, unit * 6, unit * 6, eyeOuterRadius);
    ctx.stroke();

    ctx.fillStyle = theme.fg;
    if (isDots) {
      ctx.beginPath();
      ctx.arc(fx + unit * 3.5, fy + unit * 3.5, unit * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      traceRoundedRect(ctx, fx + unit * 2, fy + unit * 2, unit * 3, unit * 3, unit * 0.82);
      ctx.fill();
    }
    ctx.restore();
  }

  // Center Ciprian medallion
  const cx = offsetX + (QR_QUIET_MARGIN + size / 2) * unit;
  const cy = offsetY + (QR_QUIET_MARGIN + size / 2) * unit;
  const medallionR = size * 0.118 * unit;
  const imgR = medallionR * 0.87;

  ctx.save();
  ctx.fillStyle = theme.cardInnerBg;
  ctx.beginPath();
  ctx.arc(cx, cy, medallionR + unit * 0.55, 0, Math.PI * 2);
  ctx.fill();

  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, imgR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, cx - imgR, cy - imgR, imgR * 2, imgR * 2);
    ctx.restore();
  }

  const ringGrad = ctx.createLinearGradient(
    cx - medallionR,
    cy - medallionR,
    cx + medallionR,
    cy + medallionR
  );
  ringGrad.addColorStop(0, '#FDE68A');
  ringGrad.addColorStop(0.5, '#C88A2B');
  ringGrad.addColorStop(1, '#8B550E');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = Math.max(4, size * 0.013 * unit);
  ctx.beginPath();
  ctx.arc(cx, cy, medallionR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Code Pill Badge
  const codeText = `CÓDIGO: ${options.code.toUpperCase()}`;
  const pillW = Math.min(640, Math.max(360, codeText.length * 24 + 80));
  const pillH = 66;
  const pillX = (W - pillW) / 2;
  const pillY = 1034;

  ctx.save();
  ctx.fillStyle = theme.dark ? 'rgba(244, 202, 115, 0.14)' : '#FAF1E4';
  traceRoundedRect(ctx, pillX, pillY, pillW, pillH, 33);
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = theme.dark ? '#F4CA73' : '#7A4610';
  ctx.font = '700 28px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(codeText, W / 2, pillY + pillH / 2 + 1);
  ctx.restore();

  // Footer invitation line
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.fg;
  ctx.font = '700 30px Fraunces, Georgia, serif';
  ctx.fillText(
    options.subtitle || 'Escanea y reclama tu obsequio del Show de Cocina',
    W / 2,
    1146,
    W - 140
  );

  ctx.fillStyle = theme.muted;
  ctx.font = '500 20px ui-monospace, SFMono-Regular, Menlo, monospace';
  const displayUrl = options.referralUrl.replace(/^https?:\/\//i, '');
  ctx.fillText(displayUrl, W / 2, 1196, W - 140);
  ctx.restore();

  return canvas;
}

export async function generateReferralQrDataUrl(
  options: RenderReferralQrCardOptions
): Promise<string> {
  const canvas = await renderReferralQrCardCanvas(options);
  return canvas.toDataURL('image/png', 1);
}

export async function downloadReferralQrPng(
  options: RenderReferralQrCardOptions
): Promise<void> {
  const canvas = await renderReferralQrCardCanvas(options);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1)
  );
  const filename = `qr-embajador-${slugify(options.code || options.partnerName)}.png`;

  if (blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  } else {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png', 1);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
