import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileCode2,
  History,
  Layers,
  Link2,
  Palette,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { create as createQrMatrix, type QRCode as QrCodeMatrix } from 'qrcode';
import type {
  Lead,
  QrCodeRecord,
  QrDotShape,
  QrStyleId,
  ReferralPartner,
  ReferralVisitEvent,
  UserAccount,
  UserRole,
} from '../../types/app';
import type { CreateQrPayload } from '../../services/storeClient';
import {
  buildReferralUrl,
  downloadReferralQrPng,
  normalizeReferralCodeInput,
} from './referralQrExport';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { getRoleTheme } from './roleTheme';
import {
  computeEmbajadorMetrics,
  computeVendedorRollupMetrics,
  normalizePartnerCode,
  resolveEmbajadorOwner,
  type EmbajadorRollupMetrics,
  type VendedorRollupMetrics,
} from '../../utils/partnerMetrics';

interface QrStudioPanelProps {
  qrHistory: QrCodeRecord[];
  referrers?: ReferralPartner[];
  accounts?: UserAccount[];
  leads?: Lead[];
  visitLog?: ReferralVisitEvent[];
  defaultTicketAmount?: number;
  defaultUrl: string;
  userRole?: UserRole;
  onCreateQr: (payload: CreateQrPayload) => Promise<void>;
  onDeleteQr: (id: string) => Promise<void>;
  onGoToAccounts?: () => void;
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
  referrers = [],
  accounts = [],
  leads = [],
  visitLog = [],
  defaultTicketAmount = 0,
  defaultUrl,
  userRole = 'admin',
  onCreateQr,
  onDeleteQr,
  onGoToAccounts,
}) => {
  const studioTopRef = useRef<HTMLDivElement | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'metrics' | 'history'>('create');
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 9;

  const activeVendedores = useMemo(
    () => accounts.filter((a) => a.role === 'vendedor' && a.active),
    [accounts]
  );

  const activeEmbajadores = useMemo(
    () => referrers.filter((r) => r.partnerType === 'embajador' && r.active),
    [referrers]
  );

  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string>(() => {
    const firstVendedor = accounts.find((a) => a.role === 'vendedor' && a.active);
    if (firstVendedor) return `vendedor:${firstVendedor.id}`;
    const firstEmbajador = referrers.find((r) => r.partnerType === 'embajador' && r.active);
    if (firstEmbajador) return `embajador:${firstEmbajador.id}`;
    return '';
  });

  const selectedEmbajador = useMemo(() => {
    if (selectedRecipientKey.startsWith('embajador:')) {
      const id = selectedRecipientKey.slice('embajador:'.length);
      return activeEmbajadores.find((e) => e.id === id) || null;
    }
    if (activeVendedores.length === 0 && activeEmbajadores.length > 0) {
      return activeEmbajadores[0];
    }
    return null;
  }, [selectedRecipientKey, activeEmbajadores, activeVendedores.length]);

  const selectedAccount = useMemo(() => {
    if (selectedEmbajador) return null;
    if (selectedRecipientKey.startsWith('vendedor:')) {
      const id = selectedRecipientKey.slice('vendedor:'.length);
      return activeVendedores.find((a) => a.id === id) || activeVendedores[0] || null;
    }
    return activeVendedores[0] || null;
  }, [selectedEmbajador, selectedRecipientKey, activeVendedores]);

  useEffect(() => {
    if (selectedEmbajador) {
      const expected = `embajador:${selectedEmbajador.id}`;
      if (selectedRecipientKey !== expected) setSelectedRecipientKey(expected);
    } else if (selectedAccount) {
      const expected = `vendedor:${selectedAccount.id}`;
      if (selectedRecipientKey !== expected) setSelectedRecipientKey(expected);
    } else if (selectedRecipientKey) {
      setSelectedRecipientKey('');
    }
  }, [selectedEmbajador, selectedAccount, selectedRecipientKey]);

  const [name, setName] = useState(() => {
    const firstVendedor = accounts.find((a) => a.role === 'vendedor' && a.active);
    if (firstVendedor) return firstVendedor.displayName;
    const firstEmbajador = referrers.find((r) => r.partnerType === 'embajador' && r.active);
    if (firstEmbajador) return firstEmbajador.name;
    return 'Show Otoño · Mesa VIP';
  });
  const [frameText, setFrameText] = useState('Escanea y reclama tu obsequio');
  const [styleId, setStyleId] = useState<QrStyleId>('classic-gold');
  const [dotShape, setDotShape] = useState<QrDotShape>('rounded');
  const [foregroundColor, setForegroundColor] = useState('#22150E');
  const [backgroundColor, setBackgroundColor] = useState('#FFF9ED');
  const [includeLogo, setIncludeLogo] = useState(true);

  const activeReferralCode = useMemo(() => {
    if (selectedEmbajador) {
      return normalizeReferralCodeInput(selectedEmbajador.code) || selectedEmbajador.code.trim().toUpperCase();
    }
    if (selectedAccount) {
      return normalizeReferralCodeInput(selectedAccount.tag) || selectedAccount.tag.trim().toUpperCase();
    }
    return null;
  }, [selectedEmbajador, selectedAccount]);

  const selectedRecipientName = selectedEmbajador?.name || selectedAccount?.displayName || '';

  const targetUrl = useMemo(
    () => (activeReferralCode ? buildReferralUrl(defaultUrl, activeReferralCode) : defaultUrl),
    [defaultUrl, activeReferralCode]
  );

  const [saving, setSaving] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingSvg, setExportingSvg] = useState(false);
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

  const matchedExistingReferrer = useMemo(() => {
    if (selectedEmbajador) return selectedEmbajador;
    if (!selectedAccount) return null;
    if (selectedAccount.referrerId) {
      const byId = referrers.find((r) => r.id === selectedAccount.referrerId);
      if (byId) return byId;
    }
    if (!activeReferralCode) return null;
    return (
      referrers.find((r) => r.accountId === selectedAccount.id) ||
      referrers.find((r) => r.code.trim().toUpperCase() === activeReferralCode) ||
      null
    );
  }, [selectedEmbajador, selectedAccount, activeReferralCode, referrers]);

  const hasSelectedRecipient = Boolean(selectedEmbajador || selectedAccount);
  const isTrackingActive = Boolean(hasSelectedRecipient && activeReferralCode);

  const allVendedorRollups = useMemo(() => {
    const map = new Map<string, VendedorRollupMetrics>();
    for (const acc of accounts) {
      if (acc.role !== 'vendedor') continue;
      const rollup = computeVendedorRollupMetrics(
        {
          accountId: acc.id,
          partnerId: acc.referrerId ?? null,
          name: acc.displayName,
          tag: acc.tag,
          avatarUrl: acc.avatarUrl ?? null,
          active: acc.active,
        },
        referrers,
        leads,
        qrHistory,
        visitLog,
        false,
        accounts,
        defaultTicketAmount
      );
      map.set(acc.id, rollup);
    }
    return map;
  }, [accounts, referrers, leads, qrHistory, visitLog, defaultTicketAmount]);

  const activeVendedorRollupList = useMemo(
    () =>
      activeVendedores
        .map((acc) => ({
          account: acc,
          metrics: allVendedorRollups.get(acc.id)!,
        }))
        .filter((item) => Boolean(item.metrics)),
    [activeVendedores, allVendedorRollups]
  );

  const embajadorMetricsMap = useMemo(() => {
    const map = new Map<string, EmbajadorRollupMetrics>();
    for (const r of referrers) {
      if (r.partnerType !== 'embajador') continue;
      map.set(
        r.id,
        computeEmbajadorMetrics(
          r,
          leads,
          qrHistory,
          visitLog,
          false,
          accounts,
          referrers,
          defaultTicketAmount
        )
      );
    }
    return map;
  }, [referrers, leads, qrHistory, visitLog, accounts, defaultTicketAmount]);

  const selectedVendedorMetrics = useMemo(() => {
    if (!selectedAccount) return null;
    return allVendedorRollups.get(selectedAccount.id) || null;
  }, [selectedAccount, allVendedorRollups]);

  const selectedEmbajadorMetrics = useMemo(() => {
    if (!selectedEmbajador) return null;
    return embajadorMetricsMap.get(selectedEmbajador.id) || null;
  }, [selectedEmbajador, embajadorMetricsMap]);

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    setStatusBanner(null);
  };

  const applyAccountSelection = (account: UserAccount) => {
    setSelectedRecipientKey(`vendedor:${account.id}`);
    setName(account.displayName.slice(0, 70));
    setFrameText(`Invitación de ${account.displayName} · ${account.tag}`.slice(0, 54));
    const linkedRef =
      referrers.find((r) => r.id === account.referrerId || r.accountId === account.id) || null;
    if (linkedRef?.qrStyleId) {
      const matchedPreset = QR_PRESETS.find((p) => p.id === linkedRef.qrStyleId);
      if (matchedPreset) {
        setStyleId(matchedPreset.id);
        setForegroundColor(matchedPreset.foregroundColor);
        setBackgroundColor(matchedPreset.backgroundColor);
        setDotShape(matchedPreset.dotShape);
      }
    }
    setStatusBanner(null);
  };

  const applyEmbajadorSelection = (embajador: ReferralPartner) => {
    setSelectedRecipientKey(`embajador:${embajador.id}`);
    setName(embajador.name.slice(0, 70));
    setFrameText(`Invitación de ${embajador.name} · ${embajador.code}`.slice(0, 54));
    if (embajador.qrStyleId) {
      const matchedPreset = QR_PRESETS.find((p) => p.id === embajador.qrStyleId);
      if (matchedPreset) {
        setStyleId(matchedPreset.id);
        setForegroundColor(matchedPreset.foregroundColor);
        setBackgroundColor(matchedPreset.backgroundColor);
        setDotShape(matchedPreset.dotShape);
      }
    }
    setStatusBanner(null);
  };

  const handleSelectPreset = (preset: QrPresetConfig) => {
    setStyleId(preset.id);
    setForegroundColor(preset.foregroundColor);
    setBackgroundColor(preset.backgroundColor);
    setDotShape(preset.dotShape);
    setStatusBanner(null);
  };

  const buildCurrentQrSignature = (code: string | null, qrName: string): string => {
    return `${(code || '').trim().toUpperCase()}::${qrName.trim().toLowerCase()}`;
  };

  const isCurrentTrackedQrAlreadySaved = (): boolean => {
    if (!hasSelectedRecipient || !activeReferralCode) return true;
    const trimmedName = name.trim();
    const signature = buildCurrentQrSignature(activeReferralCode, trimmedName);
    if (lastSavedSignatureRef.current === signature) return true;

    const hasHistoryMatch = qrHistory.some((q) => {
      const matchesRecipient = selectedEmbajador
        ? q.referrerId === selectedEmbajador.id ||
          (q.referralCode || '').trim().toUpperCase() === activeReferralCode
        : selectedAccount
        ? q.accountId === selectedAccount.id ||
          (q.referralCode || '').trim().toUpperCase() === activeReferralCode
        : false;
      return (
        matchesRecipient &&
        q.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
    });
    return hasHistoryMatch;
  };

  const saveCurrentQr = async (): Promise<boolean> => {
    if (!hasSelectedRecipient || !activeReferralCode) {
      throw new Error('Debes seleccionar un Vendedor o Embajador activo.');
    }
    const trimmedName = name.trim();
    const normalizedCode = activeReferralCode;
    await onCreateQr({
      name: trimmedName,
      targetUrl: targetUrl.trim(),
      accountId: selectedEmbajador
        ? selectedEmbajador.ownerVendedorAccountId || undefined
        : selectedAccount?.id,
      referrerId: selectedEmbajador
        ? selectedEmbajador.id
        : selectedAccount?.referrerId ?? matchedExistingReferrer?.id ?? null,
      referralCode: normalizedCode,
      styleId,
      dotShape,
      foregroundColor: normalizeHex(foregroundColor, activePreset.foregroundColor),
      backgroundColor: normalizeHex(backgroundColor, activePreset.backgroundColor),
      includeLogo,
      frameText: frameText.trim(),
    });
    lastSavedSignatureRef.current = buildCurrentQrSignature(normalizedCode, trimmedName);
    return true;
  };

  const ensureTrackedQrSavedBeforeExport = async (): Promise<boolean> => {
    if (!hasSelectedRecipient || !activeReferralCode || !nameValid || !urlValid) {
      return false;
    }
    if (isCurrentTrackedQrAlreadySaved()) {
      return false;
    }
    try {
      await saveCurrentQr();
      setStatusBanner({
        type: 'success',
        text: `QR "${name.trim()}" vinculado a ${selectedRecipientName} (?ref=${activeReferralCode}) y guardado en historial.`,
      });
      return true;
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text:
          err instanceof Error
            ? `Descargado, pero no se pudo guardar en historial: ${err.message}`
            : 'Descargado, pero no se pudo guardar automáticamente.',
      });
      return false;
    }
  };

  const handleSaveToHistory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusBanner(null);

    if (!hasSelectedRecipient || !activeReferralCode) {
      setStatusBanner({
        type: 'error',
        text: 'Selecciona un Vendedor o Embajador activo para crear el QR.',
      });
      return;
    }
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
        text: 'El enlace generado no es válido.',
      });
      return;
    }

    setSaving(true);
    try {
      await saveCurrentQr();
      setStatusBanner({
        type: 'success',
        text: `"${name.trim()}" guardado y vinculado a ${selectedRecipientName} (?ref=${activeReferralCode}).`,
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
      if (!item) {
        await ensureTrackedQrSavedBeforeExport();
      }
      if (!item && selectedEmbajador && activeReferralCode && !isCustomizedFromPreset) {
        await downloadReferralQrPng({
          partnerName: selectedEmbajador.name,
          code: activeReferralCode,
          referralUrl: targetUrl.trim(),
          avatarUrl: selectedEmbajador.avatarUrl ?? null,
          emoji: selectedEmbajador.emoji ?? null,
          styleId,
          subtitle: frameText.trim() || undefined,
        });
      } else {
        await exportQrPngHd(params, logoImg);
      }
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error generando el PNG HD.',
      });
    } finally {
      setExportingPng(false);
    }
  };

  const handleDownloadEmbajadorCardPng = async () => {
    if (!selectedEmbajador || !activeReferralCode || !urlValid) return;
    setExportingPng(true);
    try {
      await ensureTrackedQrSavedBeforeExport();
      await downloadReferralQrPng({
        partnerName: selectedEmbajador.name,
        code: activeReferralCode,
        referralUrl: targetUrl.trim(),
        avatarUrl: selectedEmbajador.avatarUrl ?? null,
        emoji: selectedEmbajador.emoji ?? null,
        styleId,
        subtitle: frameText.trim() || undefined,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error generando la tarjeta QR HD.',
      });
    } finally {
      setExportingPng(false);
    }
  };

  const handleDownloadSvg = async () => {
    if (!urlValid) {
      setStatusBanner({
        type: 'error',
        text: 'Ingresa un enlace válido antes de descargar el SVG.',
      });
      return;
    }
    setExportingSvg(true);
    try {
      await ensureTrackedQrSavedBeforeExport();
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
    } finally {
      setExportingSvg(false);
    }
  };

  const handleCopyUrl = async (urlToCopy: string, recordId?: string) => {
    if (!urlToCopy.trim()) return;
    if (!recordId) {
      await ensureTrackedQrSavedBeforeExport();
    }
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
    setStyleId(record.styleId);
    setDotShape(record.dotShape);
    setForegroundColor(record.foregroundColor);
    setBackgroundColor(record.backgroundColor);
    setIncludeLogo(record.includeLogo);
    setFrameText(record.frameText || '');
    const matchedEmb =
      activeEmbajadores.find((e) => record.referrerId && e.id === record.referrerId) ||
      activeEmbajadores.find(
        (e) =>
          record.referralCode &&
          e.code.trim().toUpperCase() === record.referralCode.trim().toUpperCase()
      ) ||
      null;
    if (matchedEmb) {
      setSelectedRecipientKey(`embajador:${matchedEmb.id}`);
      lastSavedSignatureRef.current = buildCurrentQrSignature(
        matchedEmb.code || record.referralCode || null,
        record.name
      );
    } else {
      const matchedAcc =
        activeVendedores.find((a) => record.accountId && a.id === record.accountId) ||
        activeVendedores.find(
          (a) =>
            record.referralCode &&
            a.tag.trim().toUpperCase() === record.referralCode.trim().toUpperCase()
        ) ||
        activeVendedores[0] ||
        null;
      if (matchedAcc) {
        setSelectedRecipientKey(`vendedor:${matchedAcc.id}`);
      }
      lastSavedSignatureRef.current = buildCurrentQrSignature(
        matchedAcc?.tag || record.referralCode || null,
        record.name
      );
    }
    setStatusBanner({
      type: 'success',
      text: `Cargado "${record.name}" en el editor en vivo.`,
    });
    setActiveSubTab('create');
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

  const adminTheme = getRoleTheme(userRole);
  const historyTotalPages = Math.max(1, Math.ceil(qrHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const historyStartIdx = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const paginatedQrHistory = useMemo(
    () => qrHistory.slice(historyStartIdx, historyStartIdx + HISTORY_PAGE_SIZE),
    [qrHistory, historyStartIdx]
  );

  return (
    <div ref={studioTopRef} className="space-y-4">
      {/* Studio Editorial Header + 3 Instant Sub-Tabs */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden dsb-glass rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-5 space-y-3.5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: adminTheme.headerStrip }}
        />
        <div className="pointer-events-none hidden sm:block absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#8B0018]/10 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl text-[#FDE68A] shadow-md border border-white/25"
              style={{ background: adminTheme.heroGradient }}
            >
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8B0018]">
                <Sparkles className="h-3 w-3 text-[#B91C1C] shrink-0" />
                Estudio QR · Alta Definición
              </span>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#22150E] leading-snug">
                Generador de Códigos QR The Ciprian Company
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/90 backdrop-blur-sm border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Nivel H (30%)
            </span>
            <span className="dsb-glass-subtle inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#594133] tabular-nums">
              <History className="h-3.5 w-3.5 text-[#8B0018]" />
              {qrHistory.length} {qrHistory.length === 1 ? 'guardado' : 'guardados'}
            </span>
          </div>
        </div>

        {/* 3 Instant Sub-Tabs: Crear QR | Métricas Vendedores | Historial QR */}
        <div
          role="tablist"
          aria-label="Secciones de Estudio QR"
          className="relative dsb-glass-subtle grid grid-cols-3 sm:inline-flex gap-1 w-full sm:w-auto rounded-2xl p-1 border"
          style={{ borderColor: adminTheme.borderTint }}
        >
          {(
            [
              { id: 'create', label: 'Crear QR', mobileLabel: 'Crear QR', icon: QrCode, badge: null },
              {
                id: 'metrics',
                label: 'Métricas Vendedores',
                mobileLabel: 'Vendedores',
                icon: Users,
                badge: activeVendedorRollupList.length,
              },
              {
                id: 'history',
                label: 'Historial QR',
                mobileLabel: 'Historial',
                icon: History,
                badge: qrHistory.length,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveSubTab(tab.id)}
                className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active ? adminTheme.activePillClass : 'text-[#594133] hover:bg-white/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="sm:hidden">{tab.mobileLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-black/10 text-[#594133]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Sub-tab 1: Crear QR */}
      {activeSubTab === 'create' && (
        <>
      {/* Main Split Workspace: Empty State if no Active Vendedor or Embajador, else Controls + Live Preview */}
      {activeVendedores.length === 0 && activeEmbajadores.length === 0 ? (
        <section className="dsb-glass rounded-[24px] sm:rounded-[26px] border-dashed border-[#C88A2B]/60 p-6 sm:p-10 text-center space-y-3.5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 border border-[#E5C17B] text-[#9A6315] shadow-xs">
            <UserCheck className="h-7 w-7" />
          </div>
          <h3 className="font-serif text-xl font-bold text-[#22150E]">
            Primero crea una cuenta de Vendedor / Embajador
          </h3>
          <p className="text-xs sm:text-sm text-[#594133] max-w-lg mx-auto">
            Por trazabilidad obligatoria, cada código QR debe estar vinculado a una cuenta activa de <strong>Vendedor / Embajador</strong> usando su Tag único.
          </p>
          {onGoToAccounts && (
            <button
              type="button"
              onClick={onGoToAccounts}
              style={{ background: adminTheme.heroGradient }}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
            >
              <UserCheck className="h-4 w-4" />
              Ir a Cuentas y crear Vendedor
            </button>
          )}
        </section>
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left: Generator Controls */}
        <form
          onSubmit={handleSaveToHistory}
          className="xl:col-span-7 dsb-glass rounded-[24px] sm:rounded-[26px] p-4 sm:p-7 space-y-5 sm:space-y-6"
        >
          {/* Identity & Destination */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1.5">
                  Nombre del QR *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  maxLength={70}
                  placeholder="Ej. María · Mesa VIP"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none transition-colors"
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
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none transition-colors"
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
                  className={`min-h-[38px] sm:min-h-[30px] rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
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
                  className="min-h-[38px] sm:min-h-[30px] rounded-full border border-transparent px-3 py-1 text-[11px] font-semibold text-[#8C3318] hover:bg-rose-50 cursor-pointer"
                >
                  Sin texto
                </button>
              )}
            </div>

            {/* Mandatory Vendedor / Ambassador Account Binding */}
            <div
              data-dsb-banner="gold"
              className="rounded-2xl border border-[#C88A2B]/45 bg-gradient-to-r from-[#FFF9EC] via-[#FFFDF9] to-[#FAF1E4]/85 p-3.5 sm:p-4 space-y-3 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22150E] text-[#F4CA73]">
                    <Trophy className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#22150E]">
                      Vendedor o Embajador asignado (Obligatorio)
                    </p>
                    <p className="text-[10.5px] text-[#7B5D4A]">
                      El QR se vincula automáticamente al Tag del vendedor o código del embajador seleccionado.
                    </p>
                  </div>
                </div>
                {activeReferralCode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-emerald-800">
                    <UserCheck className="h-3 w-3" />
                    ?ref={activeReferralCode}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <select
                  id="qr-studio-account-select"
                  value={selectedRecipientKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('embajador:')) {
                      const embId = val.slice('embajador:'.length);
                      const foundEmb = activeEmbajadores.find((item) => item.id === embId);
                      if (foundEmb) applyEmbajadorSelection(foundEmb);
                    } else if (val.startsWith('vendedor:')) {
                      const accId = val.slice('vendedor:'.length);
                      const foundAcc = activeVendedores.find((item) => item.id === accId);
                      if (foundAcc) applyAccountSelection(foundAcc);
                    }
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-2 text-base sm:text-sm font-semibold text-[#22150E] focus:border-[#C88A2B] focus:outline-none"
                >
                  {activeVendedores.length > 0 && (
                    <optgroup label="Vendedores">
                      {activeVendedores.map((acc) => (
                        <option key={`vendedor:${acc.id}`} value={`vendedor:${acc.id}`}>
                          {acc.displayName} (@{acc.username}) · Tag: {acc.tag}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {activeEmbajadores.length > 0 && (
                    <optgroup label="Embajadores (sin acceso)">
                      {activeEmbajadores.map((emb) => {
                        const ownerTag = emb.ownerVendedorTag
                          ? ` · Vendedor: ${emb.ownerVendedorTag}`
                          : emb.ownerVendedorName
                          ? ` · Vendedor: ${emb.ownerVendedorName}`
                          : ' · Ciprian Directo';
                        return (
                          <option key={`embajador:${emb.id}`} value={`embajador:${emb.id}`}>
                            {emb.emoji ? `${emb.emoji} ` : ''}
                            {emb.name} · Código: {emb.code}
                            {ownerTag}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
                {selectedEmbajador && activeReferralCode ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/85 px-3 py-2 text-[11.5px] font-semibold text-emerald-900">
                      <AmbassadorAvatar
                        name={selectedEmbajador.name}
                        avatarUrl={selectedEmbajador.avatarUrl ?? null}
                        emoji={selectedEmbajador.emoji ?? null}
                        size="sm"
                        ring="gold"
                      />
                      <span className="min-w-0 break-words">
                        Embajador &ldquo;{selectedEmbajador.name}&rdquo; (?ref={activeReferralCode}) — cada escaneo y registro se atribuirá automáticamente a este Embajador.
                      </span>
                    </div>

                    {selectedEmbajadorMetrics && (
                      <div className="dsb-glass-subtle rounded-2xl p-3 sm:p-3.5 space-y-2.5 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#7B5D4A]">
                            Métricas en vivo del Embajador
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold max-w-full ${
                              selectedEmbajadorMetrics.owner.isDirect
                                ? 'border-[#DFCBB3] bg-amber-50/80 text-[#594133]'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            <UserCheck className="h-3 w-3 shrink-0 text-[#3F5432]" />
                            <span className="truncate">
                              Vinculado a: {selectedEmbajadorMetrics.owner.name}
                              {selectedEmbajadorMetrics.owner.tag
                                ? ` (${selectedEmbajadorMetrics.owner.tag})`
                                : ''}
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="dsb-glass-subtle rounded-xl px-3 py-2 min-w-0">
                            <p className="text-[10px] font-semibold text-[#7B5D4A] truncate">
                              QRs de este embajador
                            </p>
                            <p className="font-serif text-lg font-bold text-[#22150E] tabular-nums leading-tight mt-0.5">
                              {selectedEmbajadorMetrics.qrCount}
                            </p>
                          </div>
                          <div className="dsb-glass-subtle rounded-xl px-3 py-2 min-w-0">
                            <p className="text-[10px] font-semibold text-[#7B5D4A] truncate">
                              Prospectos
                            </p>
                            <p className="font-serif text-lg font-bold text-[#22150E] tabular-nums leading-tight mt-0.5">
                              {selectedEmbajadorMetrics.leadsCount}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">
                            Visitas: <strong>{selectedEmbajadorMetrics.visitsCount}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">
                            Citas: <strong>{selectedEmbajadorMetrics.citasCount}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                            Demos: <strong>{selectedEmbajadorMetrics.demosCount}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            Órdenes: <strong>{selectedEmbajadorMetrics.ordenesCount}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedAccount && activeReferralCode ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/85 px-3 py-2 text-[11.5px] font-semibold text-emerald-900">
                      <AmbassadorAvatar
                        name={selectedAccount.displayName}
                        avatarUrl={selectedAccount.avatarUrl ?? matchedExistingReferrer?.avatarUrl ?? null}
                        emoji={matchedExistingReferrer?.emoji ?? null}
                        size="sm"
                        ring="gold"
                      />
                      <span className="min-w-0 break-words">
                        Vinculado a &ldquo;{selectedAccount.displayName}&rdquo; (?ref={activeReferralCode}) — cada escaneo y registro se atribuirá automáticamente a esta cuenta.
                      </span>
                    </div>

                    {selectedVendedorMetrics && (
                      <div className="dsb-glass-subtle rounded-2xl p-3 sm:p-3.5 space-y-2.5 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800">
                            <Layers className="h-3 w-3 shrink-0" />
                            <span>
                              Métrica consolidada del vendedor (canal directo + todos sus embajadores)
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="dsb-glass-subtle rounded-xl px-3 py-2 min-w-0">
                            <p className="text-[10px] font-semibold text-[#7B5D4A] truncate">
                              QRs Totales
                            </p>
                            <p className="font-serif text-lg font-bold text-[#22150E] tabular-nums leading-tight mt-0.5">
                              {selectedVendedorMetrics.totalQrCount}
                            </p>
                            <p className="text-[10px] font-medium text-[#7B5D4A] tabular-nums mt-0.5 truncate">
                              Directos: {selectedVendedorMetrics.directQrCount} · Embajadores:{' '}
                              {selectedVendedorMetrics.embajadoresQrCount}
                            </p>
                          </div>

                          <div className="dsb-glass-subtle rounded-xl px-3 py-2 min-w-0">
                            <p className="text-[10px] font-semibold text-[#7B5D4A] truncate">
                              Prospectos Totales
                            </p>
                            <p className="font-serif text-lg font-bold text-[#22150E] tabular-nums leading-tight mt-0.5">
                              {selectedVendedorMetrics.totalLeadsCount}
                            </p>
                            <p className="text-[10px] font-medium text-[#7B5D4A] tabular-nums mt-0.5 truncate">
                              Directos: {selectedVendedorMetrics.directLeadsCount} · Embajadores:{' '}
                              {selectedVendedorMetrics.embajadoresLeadsCount}
                            </p>
                          </div>

                          <div className="dsb-glass-subtle rounded-xl px-3 py-2 min-w-0">
                            <p className="text-[10px] font-semibold text-[#7B5D4A] truncate">
                              Embajadores Vinculados
                            </p>
                            <p className="font-serif text-lg font-bold text-[#22150E] tabular-nums leading-tight mt-0.5">
                              {selectedVendedorMetrics.embajadoresCount}
                            </p>
                            <p className="text-[10px] font-medium text-[#7B5D4A] tabular-nums mt-0.5 truncate">
                              {selectedVendedorMetrics.activeEmbajadoresCount} activos
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">
                            Visitas: <strong>{selectedVendedorMetrics.visitsCount}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">
                            Citas: <strong>{selectedVendedorMetrics.citasCount}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                            Demos: <strong>{selectedVendedorMetrics.demosCount}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            Órdenes: <strong>{selectedVendedorMetrics.ordenesCount}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Locked Derived Destination URL */}
            <div>
              <label className="text-xs font-semibold text-[#594133] flex items-center gap-1.5 mb-1.5">
                <Link2 className="h-3.5 w-3.5 text-[#B84A27]" />
                Enlace de destino automático (con Tag del Vendedor)
              </label>
              <input
                type="url"
                readOnly
                value={targetUrl}
                className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FAF3E8]/80 px-3.5 py-2.5 text-base sm:text-sm font-mono text-[#594133] focus:outline-none cursor-default"
              />
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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
              {QR_PRESETS.map((preset) => {
                const selected = styleId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`group relative flex flex-col items-start rounded-2xl border p-2.5 text-left transition-all cursor-pointer min-w-0 ${
                      selected
                        ? 'border-[#C88A2B] bg-[#FFFDF9] ring-2 ring-[#C88A2B]/30 shadow-md -translate-y-0.5'
                        : 'border-[#E6D5BF] bg-[#FAF3E8]/55 hover:bg-[#FFFDF9] hover:border-[#C88A2B]/60'
                    }`}
                  >
                    <div
                      className="mb-2 flex h-9 sm:h-10 w-full items-center justify-between rounded-xl border px-2.5"
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
                    <p className="text-xs font-bold text-[#22150E] leading-tight truncate w-full">{preset.name}</p>
                    <p className="text-[10px] text-[#7B5D4A] mt-0.5 truncate w-full">{preset.subtitle}</p>
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
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {DOT_SHAPES.map((shape) => {
                  const active = dotShape === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => setDotShape(shape.id)}
                      className={`min-h-[56px] min-w-0 rounded-xl border px-1.5 sm:px-2.5 py-2 text-center transition-all cursor-pointer ${
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
                      <span className="block text-[11px] sm:text-xs font-bold leading-none">{shape.label}</span>
                      <span
                        className={`block text-[9.5px] sm:text-[10px] mt-0.5 leading-tight ${
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
                <label className="flex min-h-[48px] items-center gap-2 rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-2.5 py-2 cursor-pointer hover:border-[#C88A2B]">
                  <input
                    type="color"
                    data-preserve-surface="true"
                    value={normalizeHex(foregroundColor, '#22150E')}
                    onChange={(e) => setForegroundColor(e.target.value.toUpperCase())}
                    className="h-8 w-8 sm:h-7 sm:w-7 shrink-0 cursor-pointer rounded-lg border border-[#D8C0A2] bg-transparent p-0"
                    aria-label="Color de módulos QR"
                  />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold text-[#7B5D4A]">Módulos</span>
                    <span className="block font-mono text-xs font-bold text-[#22150E] truncate">
                      {foregroundColor.toUpperCase()}
                    </span>
                  </div>
                </label>

                <label className="flex min-h-[48px] items-center gap-2 rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-2.5 py-2 cursor-pointer hover:border-[#C88A2B]">
                  <input
                    type="color"
                    data-preserve-surface="true"
                    value={normalizeHex(backgroundColor, '#FFF9ED')}
                    onChange={(e) => setBackgroundColor(e.target.value.toUpperCase())}
                    className="h-8 w-8 sm:h-7 sm:w-7 shrink-0 cursor-pointer rounded-lg border border-[#D8C0A2] bg-transparent p-0"
                    aria-label="Color de fondo QR"
                  />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold text-[#7B5D4A]">Fondo</span>
                    <span className="block font-mono text-xs font-bold text-[#22150E] truncate">
                      {backgroundColor.toUpperCase()}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Center Logo Toggle */}
          <div
            data-dsb-banner="subtle"
            className="flex items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-[#E6D5BF] bg-gradient-to-r from-[#FAF3E8]/85 to-[#FFFDF9] p-3.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full p-[2px] bg-gradient-to-br from-[#F4CA73] via-[#C88A2B] to-[#6E450E] shadow-sm">
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
              className={`relative inline-flex h-8 w-14 sm:h-7 sm:w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                includeLogo
                  ? 'bg-[#22150E] border-[#C88A2B]'
                  : 'bg-[#E5D7C4] border-[#CDBAA1]'
              }`}
            >
              <span
                data-preserve-surface="true"
                className={`inline-block h-6 w-6 sm:h-5 sm:w-5 transform rounded-full transition-transform shadow-sm ${
                  includeLogo ? 'translate-x-7 sm:translate-x-6 bg-[#F4CA73]' : 'translate-x-1 bg-white'
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-[#7B5D4A]">
              {matrixInfo
                ? `Matriz HD ${matrixInfo.size}×${matrixInfo.size} (Versión ${matrixInfo.version})`
                : 'Esperando URL válida'}
            </p>
            <button
              type="submit"
              disabled={saving || !nameValid || !urlValid}
              className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#22150E] via-[#3B2316] to-[#22150E] px-6 py-3 text-xs sm:text-sm font-bold text-[#F4CA73] border border-[#C88A2B]/50 shadow-[0_12px_26px_-10px_rgba(34,21,14,0.5)] hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-50"
            >
              <BookmarkCheck className="h-4 w-4" />
              {saving
                ? isTrackingActive
                  ? 'Guardando y activando...'
                  : 'Guardando en historial...'
                : isTrackingActive
                  ? 'Guardar y activar QR en Métricas'
                  : 'Guardar QR en historial'}
            </button>
          </div>
        </form>

        {/* Right: Interactive Live HD QR Preview Card & Download Actions */}
        <aside className="xl:col-span-5 xl:sticky xl:top-24 space-y-4">
          <div className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] border border-[#E6D5BF] bg-gradient-to-b from-[#24150D] via-[#1B100A] to-[#120A06] p-4 sm:p-7 text-[#FFFDF9] shadow-[0_24px_54px_-18px_rgba(34,21,14,0.45)]">
            {/* Ambient studio glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,202,115,0.18),_transparent_62%)]" />

            <div className="relative flex items-center justify-between gap-2 mb-4 min-w-0">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#E5AE4E] block">
                  Vista Previa HD en Vivo
                </span>
                <h3 className="font-serif text-base sm:text-lg font-bold text-white truncate">
                  {name.trim() || 'Código QR Ciprian'}
                </h3>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${activePreset.badgeBg} ${activePreset.badgeText}`}
              >
                {activePreset.name}
              </span>
            </div>

            {/* Floating Physical QR Card */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="relative mx-auto max-w-[236px] sm:max-w-[320px]"
            >
              <div
                className="relative overflow-hidden rounded-[20px] sm:rounded-[24px] p-3 sm:p-5 shadow-[0_22px_45px_-12px_rgba(0,0,0,0.75)] transition-colors duration-300"
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
            <div className="relative mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
              <span className="truncate font-mono text-[11px] text-[#E8D5BE] min-w-0 flex-1">
                {targetUrl.trim() || defaultUrl}
              </span>
              <button
                type="button"
                onClick={() => handleCopyUrl(targetUrl)}
                className="shrink-0 inline-flex min-h-[38px] sm:min-h-[30px] items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-[#F4CA73] transition-colors cursor-pointer"
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
                data-preserve-surface="true"
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] py-3 text-xs sm:text-sm font-bold text-[#1A0E08] shadow-[0_12px_26px_-8px_rgba(229,174,78,0.45)] hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-50"
              >
                <BookmarkCheck className="h-4 w-4" />
                {saving
                  ? isTrackingActive
                    ? 'Activando en Métricas...'
                    : 'Guardando...'
                  : isTrackingActive
                    ? 'Guardar y activar QR en Métricas'
                    : 'Guardar QR en historial'}
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPng()}
                  disabled={exportingPng || !urlValid}
                  className="min-h-[42px] sm:min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#F4CA73]/30 bg-white/10 hover:bg-white/15 px-2.5 sm:px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  <Download className="h-3.5 w-3.5 text-[#F4CA73] shrink-0" />
                  {exportingPng ? 'Generando...' : 'PNG HD'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  disabled={exportingSvg || !urlValid}
                  className="min-h-[42px] sm:min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-2.5 sm:px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  <FileCode2 className="h-3.5 w-3.5 text-[#F4CA73] shrink-0" />
                  {exportingSvg ? 'Generando...' : 'SVG Vector'}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyUrl(targetUrl)}
                  disabled={!targetUrl.trim()}
                  className="col-span-2 sm:col-span-1 min-h-[42px] sm:min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  {copiedPreviewLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[#F4CA73] shrink-0" />
                  )}
                  {copiedPreviewLink ? 'Copiado' : 'Copiar enlace'}
                </button>
              </div>

              {selectedEmbajador && (
                <button
                  type="button"
                  onClick={handleDownloadEmbajadorCardPng}
                  disabled={exportingPng || !urlValid}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#F4CA73]/40 bg-[#C88A2B]/20 hover:bg-[#C88A2B]/30 px-3 py-2 text-xs font-bold text-[#F4CA73] transition-colors cursor-pointer disabled:opacity-45"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  {exportingPng ? 'Generando tarjeta...' : 'Descargar Tarjeta Embajador HD'}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
      )}
        </>
      )}

      {/* Sub-tab 2: Métricas Vendedores */}
      {activeSubTab === 'metrics' && (
        activeVendedorRollupList.length === 0 ? (
          <section className="dsb-glass rounded-[24px] p-8 text-center space-y-2">
            <Users className="mx-auto h-8 w-8 text-[#C88A2B]/80" />
            <p className="font-serif text-base font-bold text-[#22150E]">
              Sin vendedores activos registrados
            </p>
            <p className="text-xs text-[#6E5341]">
              Crea cuentas de Vendedor desde la pestaña Cuentas para consultar métricas consolidadas de equipo.
            </p>
          </section>
        ) : (
        <section className="dsb-glass rounded-[24px] sm:rounded-[26px] p-4 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                data-dsb-icon-tile="emerald"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-800"
              >
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-base sm:text-xl font-bold text-[#22150E] leading-snug">
                  Métricas por Vendedor (QRs y Prospectos del Equipo)
                </h3>
                <p className="text-xs sm:text-sm text-[#594133]">
                  Consolidado en vivo de cada vendedor (canal directo + embajadores vinculados). Toca una tarjeta para seleccionarlo en el creador QR.
                </p>
              </div>
            </div>
            <span className="dsb-glass-subtle rounded-full px-3 py-1 text-xs font-bold text-[#594133] tabular-nums shrink-0">
              {activeVendedorRollupList.length}{' '}
              {activeVendedorRollupList.length === 1 ? 'vendedor activo' : 'vendedores activos'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeVendedorRollupList.map(({ account, metrics }) => {
              const isSelectedCard = selectedAccount?.id === account.id;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    applyAccountSelection(account);
                    setActiveSubTab('create');
                    studioTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`dsb-glass-subtle text-left rounded-2xl p-3.5 sm:p-4 space-y-3 transition-all cursor-pointer min-w-0 hover:-translate-y-0.5 hover:shadow-md ${
                    isSelectedCard
                      ? 'ring-2 ring-[#C88A2B]/65 border-[#C88A2B]/70'
                      : 'hover:border-[#C88A2B]/45'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <AmbassadorAvatar
                        name={account.displayName}
                        avatarUrl={metrics.avatarUrl}
                        size="md"
                        ring={isSelectedCard ? 'gold' : 'subtle'}
                      />
                      <div className="min-w-0">
                        <p className="font-serif text-sm sm:text-base font-bold text-[#22150E] truncate">
                          {account.displayName}
                        </p>
                        <span className="inline-flex items-center rounded-md border border-[#E5C17B] bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8A5610]">
                          {account.tag}
                        </span>
                      </div>
                    </div>
                    {isSelectedCard && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <Check className="h-3 w-3" />
                        Activo
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="dsb-glass-subtle rounded-xl px-2 py-1.5 min-w-0">
                      <p className="text-[9.5px] font-semibold text-[#7B5D4A] truncate">
                        QRs totales
                      </p>
                      <p className="font-serif text-base font-bold text-[#22150E] tabular-nums leading-tight">
                        {metrics.totalQrCount}
                      </p>
                      <p className="text-[9px] text-[#7B5D4A] tabular-nums truncate">
                        {metrics.directQrCount}D + {metrics.embajadoresQrCount}E
                      </p>
                    </div>

                    <div className="dsb-glass-subtle rounded-xl px-2 py-1.5 min-w-0">
                      <p className="text-[9.5px] font-semibold text-[#7B5D4A] truncate">
                        Embajadores
                      </p>
                      <p className="font-serif text-base font-bold text-[#22150E] tabular-nums leading-tight">
                        {metrics.embajadoresCount}
                      </p>
                      <p className="text-[9px] text-[#7B5D4A] tabular-nums truncate">
                        {metrics.activeEmbajadoresCount} activos
                      </p>
                    </div>

                    <div className="dsb-glass-subtle rounded-xl px-2 py-1.5 min-w-0">
                      <p className="text-[9.5px] font-semibold text-[#7B5D4A] truncate">
                        Prospectos
                      </p>
                      <p className="font-serif text-base font-bold text-[#22150E] tabular-nums leading-tight">
                        {metrics.totalLeadsCount}
                      </p>
                      <p className="text-[9px] text-[#7B5D4A] tabular-nums truncate">
                        {metrics.directLeadsCount}D + {metrics.embajadoresLeadsCount}E
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">
                      Visitas: <strong>{metrics.visitsCount}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">
                      Citas: <strong>{metrics.citasCount}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                      Demos: <strong>{metrics.demosCount}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                      Órdenes: <strong>{metrics.ordenesCount}</strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        )
      )}

      {/* Sub-tab 3: Historial QR (Paginated 9 per page) */}
      {activeSubTab === 'history' && (
      <section className="dsb-glass rounded-[24px] sm:rounded-[26px] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">
              Historial de QRs guardados
            </h3>
            <p className="text-xs sm:text-sm text-[#594133]">
              Recarga cualquier diseño al estudio, descarga en 1024×1024 PNG HD o copia su enlace al instante.
            </p>
          </div>
          <span className="dsb-glass-subtle rounded-full px-3 py-1 text-xs font-bold text-[#594133] tabular-nums">
            Total: {qrHistory.length}
          </span>
        </div>

        {qrHistory.length === 0 ? (
          <div className="dsb-glass-subtle rounded-2xl border-dashed border-[#DEC9AE] px-5 py-10 text-center space-y-2">
            <QrCode className="mx-auto h-9 w-9 text-[#C88A2B]/80" />
            <p className="font-serif text-base font-bold text-[#22150E]">
              Aún no has guardado códigos QR
            </p>
            <p className="text-xs text-[#7B5D4A] max-w-md mx-auto">
              Personaliza el estilo en <strong>Crear QR</strong> y presiona <strong>Guardar QR en historial</strong> para tener tus diseños listos para reimprimir.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence initial={false}>
              {paginatedQrHistory.map((item) => {
                const presetMeta = QR_PRESETS.find((p) => p.id === item.styleId) || QR_PRESETS[0];
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;
                const linkedReferrer =
                  referrers.find((r) => item.referrerId && r.id === item.referrerId) ||
                  referrers.find(
                    (r) =>
                      item.referralCode &&
                      r.code.trim().toUpperCase() === item.referralCode.trim().toUpperCase()
                  );
                const isEmbajadorQr = linkedReferrer?.partnerType === 'embajador';
                const linkedAccount = isEmbajadorQr
                  ? accounts.find(
                      (a) =>
                        linkedReferrer?.ownerVendedorAccountId &&
                        a.id === linkedReferrer.ownerVendedorAccountId
                    )
                  : accounts.find((a) => item.accountId && a.id === item.accountId) ||
                    accounts.find(
                      (a) =>
                        item.referralCode &&
                        a.tag.trim().toUpperCase() === item.referralCode.trim().toUpperCase()
                    );
                const itemAvatarUrl = isEmbajadorQr
                  ? linkedReferrer?.avatarUrl ?? null
                  : linkedAccount?.avatarUrl ?? linkedReferrer?.avatarUrl ?? null;
                const itemEmoji = linkedReferrer?.emoji ?? null;
                const itemOwnerName = isEmbajadorQr
                  ? linkedReferrer?.name || item.name
                  : linkedAccount?.displayName || linkedReferrer?.name || item.name;

                const embMetrics =
                  isEmbajadorQr && linkedReferrer
                    ? embajadorMetricsMap.get(linkedReferrer.id) ||
                      computeEmbajadorMetrics(
                        linkedReferrer,
                        leads,
                        qrHistory,
                        visitLog,
                        false,
                        accounts,
                        referrers,
                        defaultTicketAmount
                      )
                    : null;

                const embOwnerInfo =
                  embMetrics?.owner ||
                  (isEmbajadorQr && linkedReferrer
                    ? resolveEmbajadorOwner(linkedReferrer, accounts, referrers)
                    : null);

                const vendedorMetrics = !isEmbajadorQr
                  ? (linkedAccount ? allVendedorRollups.get(linkedAccount.id) : null) ||
                    (linkedReferrer || item.referralCode
                      ? computeVendedorRollupMetrics(
                          {
                            accountId: linkedAccount?.id ?? item.accountId ?? null,
                            partnerId: linkedReferrer?.id ?? item.referrerId ?? null,
                            name: itemOwnerName,
                            tag:
                              linkedAccount?.tag ||
                              linkedReferrer?.code ||
                              item.referralCode ||
                              '',
                            avatarUrl: itemAvatarUrl,
                            partner: linkedReferrer ?? null,
                          },
                          referrers,
                          leads,
                          qrHistory,
                          visitLog,
                          false,
                          accounts,
                          defaultTicketAmount
                        )
                      : null)
                  : null;

                const itemCodeNorm = normalizePartnerCode(
                  item.referralCode || linkedReferrer?.code || linkedAccount?.tag
                );
                const qrDirectLeadsCount = embMetrics
                  ? embMetrics.leadsCount
                  : vendedorMetrics
                  ? vendedorMetrics.directLeadsCount
                  : leads.filter(
                      (l) =>
                        (item.referrerId && l.referrerId === item.referrerId) ||
                        (Boolean(itemCodeNorm) &&
                          normalizePartnerCode(l.referralCode) === itemCodeNorm)
                    ).length;

                const qrDirectVisitsCount = embMetrics
                  ? embMetrics.visitsCount
                  : (() => {
                      const matchedLogVisits = visitLog.filter(
                        (v) =>
                          (item.referrerId && v.referrerId === item.referrerId) ||
                          (Boolean(itemCodeNorm) &&
                            normalizePartnerCode(v.referralCode) === itemCodeNorm)
                      ).length;
                      return Math.max(
                        Math.max(0, Number(linkedReferrer?.visitsCount) || 0),
                        matchedLogVisits
                      );
                    })();

                return (
                  <motion.article
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="group dsb-glass-subtle flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:-translate-y-0.5 transition-all min-w-0"
                  >
                    <div className="space-y-2.5 min-w-0">
                      <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
                        {/* Mini Live SVG Thumbnail */}
                        <div
                          className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-[#DFCBB3] p-1 shadow-xs"
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
                            {item.referralCode && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#E5C17B] bg-amber-50 pl-1 pr-2 py-0.5 font-mono text-[10px] font-bold text-[#8A5610]">
                                {itemAvatarUrl || itemEmoji ? (
                                  <AmbassadorAvatar
                                    name={itemOwnerName}
                                    avatarUrl={itemAvatarUrl}
                                    emoji={itemEmoji}
                                    size="xs"
                                    ring="none"
                                  />
                                ) : (
                                  <Trophy className="h-2.5 w-2.5 text-[#C88A2B] ml-1" />
                                )}
                                {item.referralCode}
                              </span>
                            )}
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

                      {/* Live Metrics & Linkage Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold tabular-nums">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                          <TrendingUp className="h-3 w-3 shrink-0" />
                          Prospectos: <strong>{qrDirectLeadsCount}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">
                          <Eye className="h-3 w-3 shrink-0" />
                          Visitas: <strong>{qrDirectVisitsCount}</strong>
                        </span>
                        {isEmbajadorQr && embOwnerInfo ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 max-w-full ${
                              embOwnerInfo.isDirect
                                ? 'border-[#DFCBB3] bg-amber-50/80 text-[#594133]'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-900 font-bold'
                            }`}
                          >
                            <UserCheck className="h-3 w-3 shrink-0 text-[#3F5432]" />
                            <span className="truncate max-w-[180px]">
                              Vinculado a: {embOwnerInfo.name}
                              {embOwnerInfo.tag ? ` (${embOwnerInfo.tag})` : ''}
                            </span>
                          </span>
                        ) : vendedorMetrics ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-900">
                            <Users className="h-3 w-3 shrink-0 text-[#8A5610]" />
                            Equipo: {vendedorMetrics.totalLeadsCount} prospectos ·{' '}
                            {vendedorMetrics.totalQrCount} QRs
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Per-item Actions */}
                    <div className="mt-3.5 sm:mt-4 pt-3 border-t border-[#EFE3D2] flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLoadIntoEditor(item)}
                        className="basis-full sm:basis-auto sm:flex-1 sm:min-w-[125px] min-h-[40px] sm:min-h-[34px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#22150E] hover:bg-[#3A2418] px-3 py-2 text-xs sm:text-[11px] font-semibold text-[#FAF3E8] transition-colors cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5 text-[#F4CA73] shrink-0" />
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
                        className="flex-1 sm:flex-none min-h-[40px] sm:min-h-[34px] inline-flex items-center justify-center gap-1 rounded-xl border border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] px-2.5 sm:px-3 py-2 text-xs sm:text-[11px] font-semibold text-[#22150E] transition-colors cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-[#B84A27] shrink-0" />
                        PNG HD
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.targetUrl, item.id)}
                        title="Copiar enlace"
                        aria-label={`Copiar enlace de ${item.name}`}
                        className="flex-1 sm:flex-none min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] inline-flex items-center justify-center gap-1 rounded-xl border border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] px-2.5 py-2 text-xs sm:text-[11px] font-semibold text-[#594133] transition-colors cursor-pointer"
                      >
                        {copiedRecordId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>
                          {copiedRecordId === item.id ? 'Copiado' : 'Link'}
                        </span>
                      </button>

                      {isConfirming ? (
                        <div className="inline-flex min-h-[40px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-1">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteRecord(item.id)}
                            className="min-h-[32px] sm:min-h-0 rounded-lg bg-rose-600 hover:bg-rose-700 px-2.5 py-1 text-[11px] sm:text-[10px] font-bold text-white cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? '...' : 'Borrar'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[32px] sm:min-h-0 rounded-lg px-2 py-1 text-[11px] sm:text-[10px] font-semibold text-rose-800 hover:bg-rose-100 cursor-pointer"
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
                          className="min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] shrink-0 inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 p-2 text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {historyTotalPages > 1 && (
          <div className="pt-3 border-t border-slate-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#594133] tabular-nums">
              Mostrando {historyStartIdx + 1}–{Math.min(historyStartIdx + HISTORY_PAGE_SIZE, qrHistory.length)} de{' '}
              {qrHistory.length} QRs
            </span>
            <div className="flex items-center justify-between sm:justify-end gap-1.5">
              <button
                type="button"
                disabled={safeHistoryPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-[#DFCBB3] bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-[#594133] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
              <span className="px-2.5 text-xs font-bold text-[#22150E] tabular-nums">
                Página {safeHistoryPage} de {historyTotalPages}
              </span>
              <button
                type="button"
                disabled={safeHistoryPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-xl border border-[#DFCBB3] bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-[#594133] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
};
