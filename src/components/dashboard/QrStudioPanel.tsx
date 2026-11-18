import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BookmarkCheck,
  Check,
  Copy,
  Download,
  FileCode2,
  History,
  Link2,
  Palette,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { create as createQrMatrix, type QRCode as QrCodeMatrix } from 'qrcode';
import type { QrCodeRecord, QrDotShape, QrStyleId } from '../../types/app';
import type { CreateQrPayload } from '../../services/storeClient';

interface QrStudioPanelProps {
  qrHistory: QrCodeRecord[];
  defaultUrl: string;
  onCreateQr: (payload: CreateQrPayload) => Promise<void>;
  onDeleteQr: (id: string) => Promise<void>;
}

interface QrPresetConfig {
  id: QrStyleId;
  name: string;
  subtitle: string;
  foregroundColor: string;
  backgroundColor: string;
  dotShape: QrDotShape;
  badgeBg: string;
  badgeText: string;
  ringColor: string;
}

const QR_PRESETS: QrPresetConfig[] = [
  {
    id: 'classic-gold',
    name: 'Dorado Ciprian',
    subtitle: 'Espresso & Champán',
    foregroundColor: '#22150E',
    backgroundColor: '#FFF9ED',
    dotShape: 'rounded',
    badgeBg: 'bg-[#FFF3DA] border-[#E5C17B]',
    badgeText: 'text-[#734A12]',
    ringColor: '#C88A2B',
  },
  {
    id: 'obsidian-dots',
    name: 'Obsidiana & Oro',
    subtitle: 'Noche Imperial',
    foregroundColor: '#D4942A',
    backgroundColor: '#14100D',
    dotShape: 'dots',
    badgeBg: 'bg-[#1F1813] border-[#C88A2B]/50',
    badgeText: 'text-[#F4CA73]',
    ringColor: '#F4CA73',
  },
  {
    id: 'ivory-rounded',
    name: 'Marfil Minimal',
    subtitle: 'Galería Limpia',
    foregroundColor: '#1E1B18',
    backgroundColor: '#FFFFFF',
    dotShape: 'rounded',
    badgeBg: 'bg-stone-100 border-stone-300',
    badgeText: 'text-stone-800',
    ringColor: '#A2683A',
  },
  {
    id: 'emerald-heritage',
    name: 'Esmeralda Royal',
    subtitle: 'Bosque & Crema',
    foregroundColor: '#2B533E',
    backgroundColor: '#FAFDF9',
    dotShape: 'square',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-900',
    ringColor: '#3D6B52',
  },
  {
    id: 'ruby-atelier',
    name: 'Borgoña Otoño',
    subtitle: 'Terracota & Lino',
    foregroundColor: '#8C3318',
    backgroundColor: '#FFF8F2',
    dotShape: 'dots',
    badgeBg: 'bg-[#FCEEE7] border-[#E8BCA7]',
    badgeText: 'text-[#7A2B14]',
    ringColor: '#B84A27',
  },
];

const DOT_SHAPES: Array<{ id: QrDotShape; label: string; hint: string }> = [
  { id: 'square', label: 'Clásico', hint: 'Módulos precisos' },
  { id: 'rounded', label: 'Suave', hint: 'Bordes orgánicos' },
  { id: 'dots', label: 'Puntos HD', hint: 'Esferas de lujo' },
];

const FRAME_SUGGESTIONS = [
  'Escanea y reclama tu obsequio',
  'Show de Cocina · Mesa VIP',
  'Invitado Especial Ciprian',
];

const LOGO_PUBLIC_PATH = '/images/logo%20ciprian.png';
const QR_QUIET_MARGIN = 3;

function isValidQrUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function normalizeHex(raw: string, fallback: string): string {
  const clean = raw.trim();
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean.toUpperCase() : fallback;
}

function parseHexLuminance(hex: string): number | null {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(fg: string, bg: string): number | null {
  const l1 = parseHexLuminance(fg);
  const l2 = parseHexLuminance(bg);
  if (l1 === null || l2 === null) return null;
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function isDarkHex(hex: string): boolean {
  const lum = parseHexLuminance(hex);
  return lum !== null && lum < 0.22;
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

function roundedSquarePath(x: number, y: number, w: number, r: number): string {
  const s = Number(w.toFixed(3));
  const cr = Number(Math.min(r, w / 2).toFixed(3));
  const x0 = Number(x.toFixed(3));
  const y0 = Number(y.toFixed(3));
  const x1 = Number((x + s).toFixed(3));
  const y1 = Number((y + s).toFixed(3));
  return (
    `M${(x0 + cr).toFixed(3)},${y0}` +
    `H${(x1 - cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${x1},${(y0 + cr).toFixed(3)}` +
    `V${(y1 - cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${(x1 - cr).toFixed(3)},${y1}` +
    `H${(x0 + cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${x0},${(y1 - cr).toFixed(3)}` +
    `V${(y0 + cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${(x0 + cr).toFixed(3)},${y0}Z`
  );
}

function buildDataModulesPath(
  matrix: QrCodeMatrix,
  dotShape: QrDotShape,
  includeLogo: boolean
): string {
  const size = matrix.modules.size;
  const chunks: string[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix.modules.get(row, col)) continue;
      if (isInFinderPattern(row, col, size)) continue;
      if (includeLogo && isInCenterSafeZone(row, col, size)) continue;

      const x = QR_QUIET_MARGIN + col;
      const y = QR_QUIET_MARGIN + row;

      if (dotShape === 'square') {
        chunks.push(`M${x},${y}h1.015v1.015h-1.015Z`);
      } else if (dotShape === 'rounded') {
        chunks.push(roundedSquarePath(x + 0.06, y + 0.06, 0.88, 0.25));
      } else {
        const cy = (y + 0.5).toFixed(3);
        const r = 0.42;
        chunks.push(
          `M${(x + 0.5 - r).toFixed(3)},${cy}a${r},${r} 0 1 0 ${(r * 2).toFixed(3)},0a${r},${r} 0 1 0 ${(-r * 2).toFixed(3)},0`
        );
      }
    }
  }

  return chunks.join('');
}

function slugifyFilename(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'ciprian-qr';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

interface QrVisualParams {
  targetUrl: string;
  dotShape: QrDotShape;
  foregroundColor: string;
  backgroundColor: string;
  includeLogo: boolean;
  frameText?: string;
  name?: string;
}

interface QrSvgArtworkProps extends QrVisualParams {
  className?: string;
  logoSrc?: string;
  decorativeRingColor?: string;
}

const QrSvgArtwork: React.FC<QrSvgArtworkProps> = ({
  targetUrl,
  dotShape,
  foregroundColor,
  backgroundColor,
  includeLogo,
  className = 'w-full h-full',
  logoSrc = LOGO_PUBLIC_PATH,
  decorativeRingColor = '#C88A2B',
}) => {
  const rawUid = useId();
  const uid = rawUid.replace(/:/g, '');

  const computed = useMemo(() => {
    const safeText = targetUrl.trim() || 'https://thecipriancompany.com';
    try {
      const matrix = createQrMatrix(safeText, { errorCorrectionLevel: 'H' });
      const size = matrix.modules.size;
      const totalUnits = size + QR_QUIET_MARGIN * 2;
      const modulesPath = buildDataModulesPath(matrix, dotShape, includeLogo);
      return { size, totalUnits, modulesPath };
    } catch {
      return null;
    }
  }, [targetUrl, dotShape, includeLogo]);

  if (!computed) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-[#D8C0A2] bg-[#FAF3E8]/60 p-6 text-center text-xs text-[#7B5D4A] ${className}`}
      >
        Ingresa un enlace válido para visualizar el código QR.
      </div>
    );
  }

  const { size, totalUnits, modulesPath } = computed;
  const center = QR_QUIET_MARGIN + size / 2;
  const medallionRadius = size * 0.118;
  const imgRadius = medallionRadius * 0.87;
  const eyeOuterRx = dotShape === 'square' ? 0.2 : dotShape === 'rounded' ? 1.65 : 2.1;

  const finderOrigins: Array<[number, number]> = [
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN + size - 7, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN + size - 7],
  ];

  return (
    <svg
      viewBox={`0 0 ${totalUnits} ${totalUnits}`}
      className={className}
      role="img"
      aria-label={`Código QR para ${targetUrl}`}
    >
      <defs>
        <clipPath id={`qr-logo-clip-${uid}`}>
          <circle cx={center} cy={center} r={imgRadius} />
        </clipPath>
        <linearGradient id={`qr-gold-ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="48%" stopColor={decorativeRingColor} />
          <stop offset="100%" stopColor="#8B550E" />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={totalUnits} height={totalUnits} fill={backgroundColor} />

      <path d={modulesPath} fill={foregroundColor} />

      {finderOrigins.map(([fx, fy], idx) => (
        <g key={idx}>
          <rect
            x={fx + 0.5}
            y={fy + 0.5}
            width={6}
            height={6}
            rx={eyeOuterRx}
            fill="none"
            stroke={foregroundColor}
            strokeWidth={1}
          />
          {dotShape === 'dots' ? (
            <circle cx={fx + 3.5} cy={fy + 3.5} r={1.5} fill={foregroundColor} />
          ) : (
            <rect
              x={fx + 2}
              y={fy + 2}
              width={3}
              height={3}
              rx={dotShape === 'rounded' ? 0.85 : 0.12}
              fill={foregroundColor}
            />
          )}
        </g>
      ))}

      {includeLogo && (
        <g>
          <circle cx={center} cy={center} r={medallionRadius + 0.55} fill={backgroundColor} />
          <circle
            cx={center}
            cy={center}
            r={medallionRadius}
            fill={backgroundColor}
            stroke={`url(#qr-gold-ring-${uid})`}
            strokeWidth={Math.max(0.32, size * 0.013)}
          />
          <image
            href={logoSrc}
            x={center - imgRadius}
            y={center - imgRadius}
            width={imgRadius * 2}
            height={imgRadius * 2}
            clipPath={`url(#qr-logo-clip-${uid})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      )}
    </svg>
  );
};

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

async function exportQrPngHd(
  params: QrVisualParams,
  logoImg: HTMLImageElement | null
): Promise<void> {
  const safeUrl = params.targetUrl.trim();
  const matrix = createQrMatrix(safeUrl, { errorCorrectionLevel: 'H' });
  const size = matrix.modules.size;
  const totalUnits = size + QR_QUIET_MARGIN * 2;
  const caption = (params.frameText || '').trim();
  const resolvedLogoImg = params.includeLogo ? logoImg || (await loadLogoImage()) : null;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el lienzo HD.');

  // Full canvas luxury background
  ctx.fillStyle = params.backgroundColor;
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle decorative outer bevel frame safely outside QR quiet zone
  ctx.save();
  ctx.strokeStyle = isDarkHex(params.backgroundColor)
    ? 'rgba(244, 202, 115, 0.38)'
    : 'rgba(200, 138, 43, 0.28)';
  ctx.lineWidth = 3;
  traceRoundedRect(ctx, 18, 18, 988, 988, 38);
  ctx.stroke();
  ctx.restore();

  const qrBoxSize = caption ? 836 : 936;
  const offsetX = (1024 - qrBoxSize) / 2;
  const offsetY = caption ? 34 : 44;
  const unit = qrBoxSize / totalUnits;

  ctx.fillStyle = params.foregroundColor;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix.modules.get(row, col)) continue;
      if (isInFinderPattern(row, col, size)) continue;
      if (params.includeLogo && isInCenterSafeZone(row, col, size)) continue;

      const x = offsetX + (QR_QUIET_MARGIN + col) * unit;
      const y = offsetY + (QR_QUIET_MARGIN + row) * unit;

      if (params.dotShape === 'square') {
        ctx.fillRect(x, y, unit + 0.45, unit + 0.45);
      } else if (params.dotShape === 'rounded') {
        const pad = unit * 0.06;
        const side = unit * 0.88;
        traceRoundedRect(ctx, x + pad, y + pad, side, side, unit * 0.25);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x + unit * 0.5, y + unit * 0.5, unit * 0.42, 0, Math.PI * 2);
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
  const eyeOuterRadius =
    params.dotShape === 'square'
      ? unit * 0.2
      : params.dotShape === 'rounded'
      ? unit * 1.65
      : unit * 2.1;

  for (const [colOrigin, rowOrigin] of finderOrigins) {
    const fx = offsetX + colOrigin * unit;
    const fy = offsetY + rowOrigin * unit;

    ctx.save();
    ctx.strokeStyle = params.foregroundColor;
    ctx.lineWidth = unit;
    traceRoundedRect(ctx, fx + unit * 0.5, fy + unit * 0.5, unit * 6, unit * 6, eyeOuterRadius);
    ctx.stroke();

    ctx.fillStyle = params.foregroundColor;
    if (params.dotShape === 'dots') {
      ctx.beginPath();
      ctx.arc(fx + unit * 3.5, fy + unit * 3.5, unit * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      traceRoundedRect(
        ctx,
        fx + unit * 2,
        fy + unit * 2,
        unit * 3,
        unit * 3,
        params.dotShape === 'rounded' ? unit * 0.85 : unit * 0.12
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // Center Ciprian medallion
  if (params.includeLogo) {
    const cx = offsetX + (QR_QUIET_MARGIN + size / 2) * unit;
    const cy = offsetY + (QR_QUIET_MARGIN + size / 2) * unit;
    const medallionR = size * 0.118 * unit;
    const imgR = medallionR * 0.87;

    ctx.save();
    ctx.fillStyle = params.backgroundColor;
    ctx.beginPath();
    ctx.arc(cx, cy, medallionR + unit * 0.55, 0, Math.PI * 2);
    ctx.fill();

    if (resolvedLogoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, imgR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(resolvedLogoImg, cx - imgR, cy - imgR, imgR * 2, imgR * 2);
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
  }

  // Optional editorial bottom frame caption
  if (caption) {
    ctx.save();
    const ruleGrad = ctx.createLinearGradient(252, 886, 772, 886);
    ruleGrad.addColorStop(0, 'transparent');
    ruleGrad.addColorStop(0.5, '#C88A2B');
    ruleGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = ruleGrad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(252, 886);
    ctx.lineTo(772, 886);
    ctx.stroke();

    const fontSize = caption.length > 36 ? 28 : caption.length > 26 ? 32 : 36;
    ctx.font = `700 ${fontSize}px Fraunces, Georgia, serif`;
    ctx.fillStyle = params.foregroundColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, 512, 942, 880);
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1)
  );
  const filename = `qr-${slugifyFilename(params.name || 'ciprian')}.png`;

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
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

function exportQrSvgFile(params: QrVisualParams, logoDataUri: string | null): void {
  const safeUrl = params.targetUrl.trim();
  const matrix = createQrMatrix(safeUrl, { errorCorrectionLevel: 'H' });
  const size = matrix.modules.size;
  const totalUnits = size + QR_QUIET_MARGIN * 2;
  const modulesPath = buildDataModulesPath(matrix, params.dotShape, params.includeLogo);
  const caption = (params.frameText || '').trim();

  const qrBoxSize = caption ? 836 : 936;
  const offsetX = (1024 - qrBoxSize) / 2;
  const offsetY = caption ? 34 : 44;
  const scale = qrBoxSize / totalUnits;

  const center = QR_QUIET_MARGIN + size / 2;
  const medallionRadius = size * 0.118;
  const imgRadius = medallionRadius * 0.87;
  const eyeOuterRx = params.dotShape === 'square' ? 0.2 : params.dotShape === 'rounded' ? 1.65 : 2.1;

  const finderOrigins: Array<[number, number]> = [
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN + size - 7, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN + size - 7],
  ];

  const eyesXml = finderOrigins
    .map(([fx, fy]) => {
      const outer = `<rect x="${fx + 0.5}" y="${fy + 0.5}" width="6" height="6" rx="${eyeOuterRx}" fill="none" stroke="${escapeXml(
        params.foregroundColor
      )}" stroke-width="1" />`;
      const pupil =
        params.dotShape === 'dots'
          ? `<circle cx="${fx + 3.5}" cy="${fy + 3.5}" r="1.5" fill="${escapeXml(params.foregroundColor)}" />`
          : `<rect x="${fx + 2}" y="${fy + 2}" width="3" height="3" rx="${
              params.dotShape === 'rounded' ? 0.85 : 0.12
            }" fill="${escapeXml(params.foregroundColor)}" />`;
      return `${outer}\n      ${pupil}`;
    })
    .join('\n      ');

  const logoHref = logoDataUri || `${window.location.origin}${LOGO_PUBLIC_PATH}`;
  const logoXml = params.includeLogo
    ? `
      <circle cx="${center}" cy="${center}" r="${(medallionRadius + 0.55).toFixed(3)}" fill="${escapeXml(
        params.backgroundColor
      )}" />
      <circle cx="${center}" cy="${center}" r="${medallionRadius.toFixed(3)}" fill="${escapeXml(
        params.backgroundColor
      )}" stroke="url(#ciprianGoldRing)" stroke-width="${Math.max(0.32, size * 0.013).toFixed(3)}" />
      <image href="${escapeXml(logoHref)}" x="${(center - imgRadius).toFixed(3)}" y="${(
        center - imgRadius
      ).toFixed(3)}" width="${(imgRadius * 2).toFixed(3)}" height="${(
        imgRadius * 2
      ).toFixed(3)}" clip-path="url(#ciprianLogoClip)" preserveAspectRatio="xMidYMid slice" />`
    : '';

  const fontSize = caption.length > 36 ? 28 : caption.length > 26 ? 32 : 36;
  const captionXml = caption
    ? `
  <line x1="252" y1="886" x2="772" y2="886" stroke="#C88A2B" stroke-opacity="0.55" stroke-width="2" />
  <text x="512" y="944" text-anchor="middle" dominant-baseline="middle" font-family="Fraunces, Georgia, serif" font-size="${fontSize}" font-weight="700" fill="${escapeXml(
        params.foregroundColor
      )}">${escapeXml(caption)}</text>`
    : '';

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <clipPath id="ciprianLogoClip">
      <circle cx="${center}" cy="${center}" r="${imgRadius.toFixed(3)}" />
    </clipPath>
    <linearGradient id="ciprianGoldRing" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A" />
      <stop offset="50%" stop-color="#C88A2B" />
      <stop offset="100%" stop-color="#8B550E" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="${escapeXml(params.backgroundColor)}" />
  <rect x="18" y="18" width="988" height="988" rx="38" fill="none" stroke="#C88A2B" stroke-opacity="0.32" stroke-width="3" />
  <g transform="translate(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}) scale(${scale.toFixed(5)})">
    <path d="${modulesPath}" fill="${escapeXml(params.foregroundColor)}" />
      ${eyesXml}${logoXml}
  </g>${captionXml}
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `qr-${slugifyFilename(params.name || 'ciprian')}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const QrStudioPanel: React.FC<QrStudioPanelProps> = ({
  qrHistory,
  defaultUrl,
  onCreateQr,
  onDeleteQr,
}) => {
  const studioTopRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState('Show Otoño · Mesa VIP');
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [frameText, setFrameText] = useState('Escanea y reclama tu obsequio');
  const [styleId, setStyleId] = useState<QrStyleId>('classic-gold');
  const [dotShape, setDotShape] = useState<QrDotShape>('rounded');
  const [foregroundColor, setForegroundColor] = useState('#22150E');
  const [backgroundColor, setBackgroundColor] = useState('#FFF9ED');
  const [includeLogo, setIncludeLogo] = useState(true);

  const [saving, setSaving] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [copiedPreviewLink, setCopiedPreviewLink] = useState(false);
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);

  // Preload Ciprian medallion logo as both HTMLImageElement and inline Data URI for crisp self-contained PNG/SVG exports
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) setLogoImg(img);
    };
    img.src = LOGO_PUBLIC_PATH;

    fetch(LOGO_PUBLIC_PATH)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || !active) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (active && typeof reader.result === 'string') {
            setLogoDataUri(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        // Fallback to URL path in SVG if fetch fails
      });

    return () => {
      active = false;
    };
  }, []);

  const activePreset = useMemo(
    () => QR_PRESETS.find((p) => p.id === styleId) || QR_PRESETS[0],
    [styleId]
  );

  const isCustomizedFromPreset =
    foregroundColor.toUpperCase() !== activePreset.foregroundColor.toUpperCase() ||
    backgroundColor.toUpperCase() !== activePreset.backgroundColor.toUpperCase() ||
    dotShape !== activePreset.dotShape;

  const urlValid = isValidQrUrl(targetUrl);
  const nameValid = name.trim().length >= 2;
  const contrastRatio = useMemo(
    () => getContrastRatio(foregroundColor, backgroundColor),
    [foregroundColor, backgroundColor]
  );
  const lowContrast = contrastRatio !== null && contrastRatio < 3.0;

  const matrixInfo = useMemo(() => {
    if (!urlValid) return null;
    try {
      const qr = createQrMatrix(targetUrl.trim(), { errorCorrectionLevel: 'H' });
      return {
        size: qr.modules.size,
        version: qr.version,
      };
    } catch {
      return null;
    }
  }, [targetUrl, urlValid]);

  const darkCardStage = isDarkHex(backgroundColor);

  const handleSelectPreset = (preset: QrPresetConfig) => {
    setStyleId(preset.id);
    setForegroundColor(preset.foregroundColor);
    setBackgroundColor(preset.backgroundColor);
    setDotShape(preset.dotShape);
    setStatusBanner(null);
  };

  const handleSaveToHistory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusBanner(null);

    if (!nameValid) {
      setStatusBanner({
        type: 'error',
        text: 'Escribe un nombre descriptivo para el QR (mínimo 2 caracteres).',
      });
      return;
    }
    if (!urlValid) {
      setStatusBanner({
        type: 'error',
        text: 'Ingresa un enlace válido que comience con https://, http:// o /.',
      });
      return;
    }

    setSaving(true);
    try {
      await onCreateQr({
        name: name.trim(),
        targetUrl: targetUrl.trim(),
        styleId,
        dotShape,
        foregroundColor: normalizeHex(foregroundColor, activePreset.foregroundColor),
        backgroundColor: normalizeHex(backgroundColor, activePreset.backgroundColor),
        includeLogo,
        frameText: frameText.trim(),
      });
      setStatusBanner({
        type: 'success',
        text: `"${name.trim()}" guardado en el historial QR.`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar el código QR.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPng = async (item?: QrVisualParams) => {
    const params: QrVisualParams = item || {
      name,
      targetUrl,
      dotShape,
      foregroundColor,
      backgroundColor,
      includeLogo,
      frameText,
    };
    if (!isValidQrUrl(params.targetUrl)) {
      setStatusBanner({
        type: 'error',
        text: 'Ingresa un enlace válido antes de descargar el PNG HD.',
      });
      return;
    }
    setExportingPng(true);
    try {
      await exportQrPngHd(params, logoImg);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error generando el PNG HD.',
      });
    } finally {
      setExportingPng(false);
    }
  };

  const handleDownloadSvg = () => {
    if (!urlValid) {
      setStatusBanner({
        type: 'error',
        text: 'Ingresa un enlace válido antes de descargar el SVG.',
      });
      return;
    }
    exportQrSvgFile(
      {
        name,
        targetUrl,
        dotShape,
        foregroundColor,
        backgroundColor,
        includeLogo,
        frameText,
      },
      logoDataUri
    );
  };

  const handleCopyUrl = async (urlToCopy: string, recordId?: string) => {
    if (!urlToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(urlToCopy.trim());
      if (recordId) {
        setCopiedRecordId(recordId);
        window.setTimeout(() => setCopiedRecordId((cur) => (cur === recordId ? null : cur)), 2000);
      } else {
        setCopiedPreviewLink(true);
        window.setTimeout(() => setCopiedPreviewLink(false), 2000);
      }
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleLoadIntoEditor = (record: QrCodeRecord) => {
    setName(record.name);
    setTargetUrl(record.targetUrl);
    setStyleId(record.styleId);
    setDotShape(record.dotShape);
    setForegroundColor(record.foregroundColor);
    setBackgroundColor(record.backgroundColor);
    setIncludeLogo(record.includeLogo);
    setFrameText(record.frameText || '');
    setStatusBanner({
      type: 'success',
      text: `Cargado "${record.name}" en el editor en vivo.`,
    });
    studioTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteRecord = async (id: string) => {
    setDeletingId(id);
    setStatusBanner(null);
    try {
      await onDeleteQr(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo eliminar el código QR.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div ref={studioTopRef} className="space-y-6">
      {/* Studio Editorial Header */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#FFFDF9] via-[#FFF8EE] to-[#F7EADA] border border-[#E6D5BF] p-5 sm:p-7 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#E5AE4E]/15 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#22150E] to-[#3B2418] text-[#F4CA73] shadow-md border border-[#C88A2B]/40">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A6315]">
                <Sparkles className="h-3.5 w-3.5 text-[#C88A2B]" />
                Estudio QR · Alta Definición
              </span>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#22150E] mt-0.5">
                Generador de Códigos QR The Ciprian Company
              </h2>
              <p className="text-xs sm:text-sm text-[#6E5341] mt-1 max-w-2xl">
                Crea tarjetas QR con acabados de lujo, emblema dorado central e impresión en 1024×1024 PNG o SVG vectorial para mesas, invitaciones y flyers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Corrección Nivel H (30%)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF3E8] border border-[#DFCBB3] px-3 py-1 text-xs font-semibold text-[#594133] tabular-nums">
              <History className="h-3.5 w-3.5 text-[#B84A27]" />
              {qrHistory.length} {qrHistory.length === 1 ? 'guardado' : 'guardados'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Split Workspace: Controls + Floating Live Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Generator Controls */}
        <form
          onSubmit={handleSaveToHistory}
          className="xl:col-span-7 rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-5 sm:p-7 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)] space-y-6"
        >
          {/* Identity & Destination */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1.5">
                  Nombre del QR *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setStatusBanner(null);
                  }}
                  maxLength={70}
                  placeholder="Ej. Show Otoño · Mesa VIP"
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1.5">
                  Texto inferior / etiqueta del marco
                </label>
                <input
                  type="text"
                  value={frameText}
                  onChange={(e) => setFrameText(e.target.value)}
                  maxLength={54}
                  placeholder="Ej. Escanea y reclama tu obsequio"
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Quick Frame Text Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#8A6D5B] mr-1">Sugerencias:</span>
              {FRAME_SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFrameText(label)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    frameText === label
                      ? 'border-[#C88A2B] bg-[#FFF4DC] text-[#7A4B0F]'
                      : 'border-[#E6D5BF] bg-[#FAF3E8]/70 text-[#6E5341] hover:bg-[#F3E4CE]'
                  }`}
                >
                  {label}
                </button>
              ))}
              {frameText && (
                <button
                  type="button"
                  onClick={() => setFrameText('')}
                  className="rounded-full border border-transparent px-2 py-1 text-[11px] font-semibold text-[#8C3318] hover:bg-rose-50 cursor-pointer"
                >
                  Sin texto
                </button>
              )}
            </div>

            {/* Destination URL + One-click Default Form Chip */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-semibold text-[#594133] flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-[#B84A27]" />
                  Enlace de destino (URL) *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetUrl(defaultUrl);
                    setStatusBanner(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#C88A2B]/45 bg-[#FFF6E3] px-3 py-1 text-[11px] font-bold text-[#8A5610] hover:bg-[#FDEBC3] transition-colors cursor-pointer shadow-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  Usar enlace del formulario
                </button>
              </div>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => {
                  setTargetUrl(e.target.value);
                  setStatusBanner(null);
                }}
                placeholder={defaultUrl}
                className={`w-full rounded-xl border bg-[#FCF8F2] px-3.5 py-2.5 text-sm font-mono text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:outline-none transition-colors ${
                  urlValid ? 'border-[#DFCBB3] focus:border-[#C88A2B]' : 'border-rose-400 focus:border-rose-500'
                }`}
              />
              {!urlValid && (
                <p className="mt-1 text-[11px] font-semibold text-rose-700">
                  El enlace debe iniciar con https://, http:// o /
                </p>
              )}
            </div>
          </div>

          {/* 5 Editorial Style Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6E5341] flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-[#C88A2B]" />
                Estilos de Firma (Presets)
              </label>
              {isCustomizedFromPreset && (
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                  Color / forma personalizada
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {QR_PRESETS.map((preset) => {
                const selected = styleId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`group relative flex flex-col items-start rounded-2xl border p-2.5 text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-[#C88A2B] bg-[#FFFDF9] ring-2 ring-[#C88A2B]/30 shadow-md -translate-y-0.5'
                        : 'border-[#E6D5BF] bg-[#FAF3E8]/55 hover:bg-[#FFFDF9] hover:border-[#C88A2B]/60'
                    }`}
                  >
                    <div
                      className="mb-2 flex h-10 w-full items-center justify-between rounded-xl border px-2.5"
                      style={{
                        backgroundColor: preset.backgroundColor,
                        borderColor: preset.ringColor,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`h-3 w-3 ${
                            preset.dotShape === 'dots'
                              ? 'rounded-full'
                              : preset.dotShape === 'rounded'
                              ? 'rounded-[4px]'
                              : 'rounded-[1px]'
                          }`}
                          style={{ backgroundColor: preset.foregroundColor }}
                        />
                        <span
                          className={`h-2 w-2 ${
                            preset.dotShape === 'dots'
                              ? 'rounded-full'
                              : preset.dotShape === 'rounded'
                              ? 'rounded-[3px]'
                              : 'rounded-[1px]'
                          }`}
                          style={{ backgroundColor: preset.foregroundColor, opacity: 0.75 }}
                        />
                      </div>
                      {selected && (
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: preset.ringColor }}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#22150E] leading-tight">{preset.name}</p>
                    <p className="text-[10px] text-[#7B5D4A] mt-0.5">{preset.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dot Shape + Custom Colors + Center Logo Toggle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-[#EFE3D2]">
            {/* Shape Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#594133]">Forma de los módulos</label>
              <div className="grid grid-cols-3 gap-2">
                {DOT_SHAPES.map((shape) => {
                  const active = dotShape === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => setDotShape(shape.id)}
                      className={`rounded-xl border px-2.5 py-2 text-center transition-all cursor-pointer ${
                        active
                          ? 'border-[#22150E] bg-[#22150E] text-[#FFFDF9] shadow-sm'
                          : 'border-[#DFCBB3] bg-[#FCF8F2] text-[#594133] hover:bg-[#F5E9D6]'
                      }`}
                    >
                      <div className="mx-auto mb-1 flex h-5 w-5 items-center justify-center gap-0.5">
                        <span
                          className={`h-2 w-2 ${
                            shape.id === 'dots'
                              ? 'rounded-full'
                              : shape.id === 'rounded'
                              ? 'rounded-[3px]'
                              : 'rounded-none'
                          } ${active ? 'bg-[#F4CA73]' : 'bg-[#8C3318]'}`}
                        />
                        <span
                          className={`h-2 w-2 ${
                            shape.id === 'dots'
                              ? 'rounded-full'
                              : shape.id === 'rounded'
                              ? 'rounded-[3px]'
                              : 'rounded-none'
                          } ${active ? 'bg-[#F4CA73]' : 'bg-[#8C3318]'}`}
                        />
                      </div>
                      <span className="block text-xs font-bold leading-none">{shape.label}</span>
                      <span
                        className={`block text-[10px] mt-0.5 ${
                          active ? 'text-[#E8D5BE]' : 'text-[#8A6D5B]'
                        }`}
                      >
                        {shape.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#594133]">Colores personalizados</label>
                {contrastRatio !== null && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      lowContrast
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    {lowContrast ? 'Contraste bajo' : `Contraste ${contrastRatio.toFixed(1)}:1`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2.5 rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-2.5 py-2 cursor-pointer hover:border-[#C88A2B]">
                  <input
                    type="color"
                    value={normalizeHex(foregroundColor, '#22150E')}
                    onChange={(e) => setForegroundColor(e.target.value.toUpperCase())}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded-lg border border-[#D8C0A2] bg-transparent p-0"
                    aria-label="Color de módulos QR"
                  />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold text-[#7B5D4A]">Módulos</span>
                    <span className="block font-mono text-xs font-bold text-[#22150E]">
                      {foregroundColor.toUpperCase()}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-2.5 py-2 cursor-pointer hover:border-[#C88A2B]">
                  <input
                    type="color"
                    value={normalizeHex(backgroundColor, '#FFF9ED')}
                    onChange={(e) => setBackgroundColor(e.target.value.toUpperCase())}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded-lg border border-[#D8C0A2] bg-transparent p-0"
                    aria-label="Color de fondo QR"
                  />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold text-[#7B5D4A]">Fondo</span>
                    <span className="block font-mono text-xs font-bold text-[#22150E]">
                      {backgroundColor.toUpperCase()}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Center Logo Toggle */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E6D5BF] bg-gradient-to-r from-[#FAF3E8]/85 to-[#FFFDF9] p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-[2px] bg-gradient-to-br from-[#F4CA73] via-[#C88A2B] to-[#6E450E] shadow-sm">
                <img
                  src={LOGO_PUBLIC_PATH}
                  alt="Logo The Ciprian Company"
                  className="h-full w-full rounded-full object-cover bg-[#1A0E08]"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#22150E]">
                  Incluir logo The Ciprian Company en el centro
                </p>
                <p className="text-[11px] text-[#7B5D4A]">
                  Zona segura circular con aro dorado y redundancia de lectura Nivel H.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={includeLogo}
              onClick={() => setIncludeLogo((prev) => !prev)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                includeLogo
                  ? 'bg-[#22150E] border-[#C88A2B]'
                  : 'bg-[#E5D7C4] border-[#CDBAA1]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full transition-transform shadow-sm ${
                  includeLogo ? 'translate-x-6 bg-[#F4CA73]' : 'translate-x-1 bg-white'
                }`}
              />
            </button>
          </div>

          {/* Status Feedback Banner */}
          <AnimatePresence>
            {statusBanner && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${
                  statusBanner.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                {statusBanner.type === 'success' ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span>{statusBanner.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Primary Save Action inside Form */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-[#7B5D4A]">
              {matrixInfo
                ? `Matriz HD ${matrixInfo.size}×${matrixInfo.size} (Versión ${matrixInfo.version})`
                : 'Esperando URL válida'}
            </p>
            <button
              type="submit"
              disabled={saving || !nameValid || !urlValid}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#22150E] via-[#3B2316] to-[#22150E] px-6 py-3 text-xs sm:text-sm font-bold text-[#F4CA73] border border-[#C88A2B]/50 shadow-[0_12px_26px_-10px_rgba(34,21,14,0.5)] hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-50"
            >
              <BookmarkCheck className="h-4 w-4" />
              {saving ? 'Guardando en historial...' : 'Guardar QR en historial'}
            </button>
          </div>
        </form>

        {/* Right: Interactive Live HD QR Preview Card & Download Actions */}
        <aside className="xl:col-span-5 xl:sticky xl:top-24 space-y-4">
          <div className="relative overflow-hidden rounded-[28px] border border-[#E6D5BF] bg-gradient-to-b from-[#24150D] via-[#1B100A] to-[#120A06] p-5 sm:p-7 text-[#FFFDF9] shadow-[0_24px_54px_-18px_rgba(34,21,14,0.45)]">
            {/* Ambient studio glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,202,115,0.18),_transparent_62%)]" />

            <div className="relative flex items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E5AE4E]">
                  Vista Previa HD en Vivo
                </span>
                <h3 className="font-serif text-lg font-bold text-white truncate max-w-[260px]">
                  {name.trim() || 'Código QR Ciprian'}
                </h3>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${activePreset.badgeBg} ${activePreset.badgeText}`}
              >
                {activePreset.name}
              </span>
            </div>

            {/* Floating Physical QR Card */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="relative mx-auto max-w-[320px]"
            >
              <div
                className="relative overflow-hidden rounded-[24px] p-4 sm:p-5 shadow-[0_22px_45px_-12px_rgba(0,0,0,0.75)] transition-colors duration-300"
                style={{
                  backgroundColor,
                  border: `1.5px solid ${
                    darkCardStage ? 'rgba(244, 202, 115, 0.48)' : 'rgba(200, 138, 43, 0.36)'
                  }`,
                }}
              >
                <div className="aspect-square w-full overflow-hidden rounded-xl">
                  <QrSvgArtwork
                    targetUrl={urlValid ? targetUrl : defaultUrl}
                    dotShape={dotShape}
                    foregroundColor={foregroundColor}
                    backgroundColor={backgroundColor}
                    includeLogo={includeLogo}
                    decorativeRingColor={activePreset.ringColor}
                  />
                </div>

                {frameText.trim() && (
                  <div className="mt-3 pt-2.5 border-t border-[#C88A2B]/35 text-center">
                    <p
                      className="font-serif text-sm sm:text-base font-bold leading-snug break-words"
                      style={{ color: foregroundColor }}
                    >
                      {frameText.trim()}
                    </p>
                  </div>
                )}
              </div>

              {/* Contact Shadow */}
              <div className="mx-auto mt-3 h-3 w-4/5 rounded-full bg-black/55 blur-md" />
            </motion.div>

            {/* Target URL Pill */}
            <div className="relative mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px] text-[#E8D5BE]">
                {targetUrl.trim() || defaultUrl}
              </span>
              <button
                type="button"
                onClick={() => handleCopyUrl(targetUrl)}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-[#F4CA73] transition-colors cursor-pointer"
              >
                {copiedPreviewLink ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-300" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copiar
                  </>
                )}
              </button>
            </div>

            {/* Export & Save Buttons */}
            <div className="relative mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => handleSaveToHistory()}
                disabled={saving || !nameValid || !urlValid}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] py-3 text-xs sm:text-sm font-bold text-[#1A0E08] shadow-[0_12px_26px_-8px_rgba(229,174,78,0.45)] hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-50"
              >
                <BookmarkCheck className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar QR en historial'}
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPng()}
                  disabled={exportingPng || !urlValid}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#F4CA73]/30 bg-white/10 hover:bg-white/15 px-3 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  <Download className="h-3.5 w-3.5 text-[#F4CA73]" />
                  {exportingPng ? 'Generando...' : 'PNG HD'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  disabled={!urlValid}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  <FileCode2 className="h-3.5 w-3.5 text-[#F4CA73]" />
                  SVG Vector
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyUrl(targetUrl)}
                  disabled={!targetUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  {copiedPreviewLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[#F4CA73]" />
                  )}
                  {copiedPreviewLink ? 'Copiado' : 'Copiar enlace'}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Saved QR Codes History Gallery */}
      <section className="rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-5 sm:p-7 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#22150E]">
              Historial de QRs guardados
            </h3>
            <p className="text-xs sm:text-sm text-[#7B5D4A]">
              Recarga cualquier diseño al estudio, descarga en 1024×1024 PNG HD o copia su enlace al instante.
            </p>
          </div>
          <span className="rounded-full bg-[#FAF3E8] border border-[#E6D5BF] px-3 py-1 text-xs font-bold text-[#594133] tabular-nums">
            Total: {qrHistory.length}
          </span>
        </div>

        {qrHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DEC9AE] bg-[#FAF3E8]/55 px-6 py-10 text-center space-y-2">
            <QrCode className="mx-auto h-9 w-9 text-[#C88A2B]/80" />
            <p className="font-serif text-base font-bold text-[#22150E]">
              Aún no has guardado códigos QR
            </p>
            <p className="text-xs text-[#7B5D4A] max-w-md mx-auto">
              Personaliza el estilo arriba y presiona <strong>Guardar QR en historial</strong> para tener tus diseños listos para reimprimir.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence initial={false}>
              {qrHistory.map((item) => {
                const presetMeta = QR_PRESETS.find((p) => p.id === item.styleId) || QR_PRESETS[0];
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;

                return (
                  <motion.article
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="group flex flex-col justify-between rounded-2xl border border-[#E6D5BF] bg-gradient-to-b from-[#FFFDF9] to-[#FAF3E8]/60 p-4 shadow-sm hover:shadow-md hover:border-[#C88A2B]/60 transition-all"
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Mini Live SVG Thumbnail */}
                      <div
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#DFCBB3] p-1 shadow-xs"
                        style={{ backgroundColor: item.backgroundColor }}
                      >
                        <QrSvgArtwork
                          targetUrl={item.targetUrl}
                          dotShape={item.dotShape}
                          foregroundColor={item.foregroundColor}
                          backgroundColor={item.backgroundColor}
                          includeLogo={item.includeLogo}
                          decorativeRingColor={presetMeta.ringColor}
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${presetMeta.badgeBg} ${presetMeta.badgeText}`}
                          >
                            <span
                              className="h-2 w-2 rounded-full border border-black/15"
                              style={{ backgroundColor: item.foregroundColor }}
                            />
                            {presetMeta.name}
                          </span>
                          <span className="text-[10px] font-medium text-[#8A6D5B]">
                            {formatShortDate(item.createdAt)}
                          </span>
                        </div>

                        <h4 className="font-serif text-base font-bold text-[#22150E] truncate">
                          {item.name}
                        </h4>

                        <p className="truncate font-mono text-[11px] text-[#6E5341]" title={item.targetUrl}>
                          {item.targetUrl}
                        </p>

                        {item.frameText && (
                          <p className="truncate text-[11px] italic text-[#8C4A19]">
                            “{item.frameText}”
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Per-item Actions */}
                    <div className="mt-4 pt-3 border-t border-[#EFE3D2] flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLoadIntoEditor(item)}
                        className="flex-1 min-w-[115px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#22150E] hover:bg-[#3A2418] px-2.5 py-2 text-[11px] font-semibold text-[#FAF3E8] transition-colors cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5 text-[#F4CA73]" />
                        Cargar en editor
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadPng({
                            name: item.name,
                            targetUrl: item.targetUrl,
                            dotShape: item.dotShape,
                            foregroundColor: item.foregroundColor,
                            backgroundColor: item.backgroundColor,
                            includeLogo: item.includeLogo,
                            frameText: item.frameText,
                          })
                        }
                        title="Descargar PNG HD 1024×1024"
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] px-2.5 py-2 text-[11px] font-semibold text-[#22150E] transition-colors cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-[#B84A27]" />
                        PNG HD
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.targetUrl, item.id)}
                        title="Copiar enlace"
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] px-2.5 py-2 text-[11px] font-semibold text-[#594133] transition-colors cursor-pointer"
                      >
                        {copiedRecordId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span className="sr-only sm:not-sr-only">
                          {copiedRecordId === item.id ? 'Copiado' : 'Link'}
                        </span>
                      </button>

                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-1.5 py-1">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteRecord(item.id)}
                            className="rounded-lg bg-rose-600 hover:bg-rose-700 px-2 py-1 text-[10px] font-bold text-white cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? '...' : 'Borrar'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg px-1.5 py-1 text-[10px] font-semibold text-rose-800 hover:bg-rose-100 cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          title="Eliminar QR"
                          aria-label={`Eliminar ${item.name}`}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 p-2 text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
};
