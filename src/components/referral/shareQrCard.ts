import { create as createQrMatrix } from 'qrcode';

export interface ShareQrAssets {
  file: File;
  blob: Blob;
  previewDataUrl: string;
  targetUrl: string;
}

const CARD_W = 900;
const CARD_H = 1120;
const LOGO_PATH = '/images/logo%20ciprian.png';

export function getPublicLandingUrl(): string {
  if (typeof window === 'undefined') return 'https://thecipriancompany.com/';
  try {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return `${window.location.origin}/`;
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

function loadImageSafe(src: string, timeoutMs = 2500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = src;
  });
}

export async function generateShareQrAssets(targetUrl = getPublicLandingUrl()): Promise<ShareQrAssets> {
  const qr = createQrMatrix(targetUrl, { errorCorrectionLevel: 'H' });
  const modulesCount = qr.modules.size;
  const moduleData = qr.modules.data;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo QR.');
  }

  // Background espresso-gold radial gradient
  const bg = ctx.createRadialGradient(CARD_W / 2, 180, 60, CARD_W / 2, CARD_H / 2, 760);
  bg.addColorStop(0, '#3D2013');
  bg.addColorStop(0.55, '#1D0F08');
  bg.addColorStop(1, '#110703');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Outer champagne-gold border card
  drawRoundedRect(ctx, 34, 34, CARD_W - 68, CARD_H - 68, 42);
  ctx.strokeStyle = 'rgba(244, 202, 115, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawRoundedRect(ctx, 48, 48, CARD_W - 96, CARD_H - 96, 34);
  ctx.strokeStyle = 'rgba(200, 138, 43, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header brand badge
  ctx.fillStyle = '#E5AE4E';
  ctx.font = '700 22px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE CIPRIAN COMPANY · ROYAL PRESTIGE', CARD_W / 2, 112);

  ctx.fillStyle = '#FFFDF9';
  ctx.font = '700 44px Georgia, serif';
  ctx.fillText('Escanea y Gana tu Obsequio', CARD_W / 2, 174);

  ctx.fillStyle = '#DFC9AB';
  ctx.font = '500 24px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('Elige tu cajita sorpresa de cocina sin costo', CARD_W / 2, 218);

  // Warm ivory QR plate
  const padSize = 570;
  const padX = (CARD_W - padSize) / 2;
  const padY = 264;
  drawRoundedRect(ctx, padX, padY, padSize, padSize, 36);
  ctx.fillStyle = '#FFF9ED';
  ctx.fill();
  ctx.strokeStyle = '#E5AE4E';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Render QR modules
  const quiet = 3;
  const qrDrawSize = padSize - 68;
  const cell = qrDrawSize / (modulesCount + quiet * 2);
  const originX = padX + 34 + quiet * cell;
  const originY = padY + 34 + quiet * cell;
  const centerClearMin = Math.floor(modulesCount * 0.38);
  const centerClearMax = Math.ceil(modulesCount * 0.62);

  ctx.fillStyle = '#22150E';
  for (let row = 0; row < modulesCount; row++) {
    for (let col = 0; col < modulesCount; col++) {
      if (!moduleData[row * modulesCount + col]) continue;
      if (row >= centerClearMin && row <= centerClearMax && col >= centerClearMin && col <= centerClearMax) {
        continue;
      }
      const x = originX + col * cell;
      const y = originY + row * cell;
      drawRoundedRect(ctx, x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.24);
      ctx.fill();
    }
  }

  // Center medallion logo
  const logoImg = await loadImageSafe(LOGO_PATH);
  const cx = CARD_W / 2;
  const cy = padY + padSize / 2;
  const medalRadius = 54;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, medalRadius + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF9ED';
  ctx.fill();
  ctx.strokeStyle = '#C88A2B';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, medalRadius, 0, Math.PI * 2);
  ctx.clip();
  if (logoImg) {
    ctx.drawImage(logoImg, cx - medalRadius, cy - medalRadius, medalRadius * 2, medalRadius * 2);
  } else {
    ctx.fillStyle = '#22150E';
    ctx.fillRect(cx - medalRadius, cy - medalRadius, medalRadius * 2, medalRadius * 2);
    ctx.fillStyle = '#F4CA73';
    ctx.font = '700 32px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TCC', cx, cy);
  }
  ctx.restore();

  // Bottom probability incentive banner
  drawRoundedRect(ctx, 84, 882, CARD_W - 168, 114, 24);
  ctx.fillStyle = 'rgba(229, 174, 78, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 202, 115, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4CA73';
  ctx.font = '700 24px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('★ COMPARTE Y AUMENTA TUS PROBABILIDADES', CARD_W / 2, 926);

  ctx.fillStyle = '#FAF3E8';
  ctx.font = '500 21px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('Más amigos participando = mejores oportunidades de premio', CARD_W / 2, 964);

  // Page URL footer
  ctx.fillStyle = '#B89B7A';
  ctx.font = '600 19px ui-monospace, SFMono-Regular, Menlo, monospace';
  const cleanUrlText = targetUrl.length > 56 ? `${targetUrl.slice(0, 53)}...` : targetUrl;
  ctx.fillText(cleanUrlText, CARD_W / 2, 1044);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('No se pudo exportar la imagen QR.'));
    }, 'image/png');
  });

  const file = new File([blob], 'QR-The-Ciprian-Company.png', { type: 'image/png' });
  const previewDataUrl = canvas.toDataURL('image/png');

  return { file, blob, previewDataUrl, targetUrl };
}

export function triggerQrDownload(assets: ShareQrAssets): void {
  const objectUrl = URL.createObjectURL(assets.blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = 'QR-The-Ciprian-Company.png';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}
