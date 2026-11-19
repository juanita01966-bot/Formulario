import type { GiftItem } from '../../types/app';
import { resolveGiftUsageTip } from '../gifts/GiftIllustration';

export interface CouponInvoiceParams {
  leadName: string;
  leadPhone?: string;
  leadAddress?: string;
  claimCode: string;
  gift: GiftItem;
  issuedAt?: Date;
}

const CANVAS_W = 1080;
const CANVAS_H = 1520;

function drawRoundedRectPath(
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

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        // Fit remainder onto last line with ellipsis if needed
        const rest = [current, ...words.slice(i + 1)].join(' ');
        let clipped = rest;
        while (clipped.length > 3 && ctx.measureText(`${clipped}…`).width > maxWidth) {
          clipped = clipped.slice(0, -1).trimEnd();
        }
        lines.push(clipped.length < rest.length ? `${clipped}…` : rest);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines;
}

function truncateSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const clean = text.trim();
  if (!clean) return '';
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  let clipped = clean;
  while (clipped.length > 2 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1).trimEnd();
  }
  return `${clipped}…`;
}

function loadImageSafe(src?: string): Promise<HTMLImageElement | null> {
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

    const timer = window.setTimeout(() => finish(null), 4500);

    const isSameOrigin =
      (trimmed.startsWith('/') && !trimmed.startsWith('//')) ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith(window.location.origin);

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

function drawFallbackGiftEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Gift body front + side
  ctx.fillStyle = '#B84A27';
  drawRoundedRectPath(ctx, cx - 54, cy - 22, 108, 76, 10);
  ctx.fill();
  ctx.strokeStyle = '#F4CA73';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Vertical gold ribbon
  const ribGrad = ctx.createLinearGradient(cx - 12, cy - 22, cx + 12, cy + 54);
  ribGrad.addColorStop(0, '#FEF08A');
  ribGrad.addColorStop(0.5, '#E5AE4E');
  ribGrad.addColorStop(1, '#9A6315');
  ctx.fillStyle = ribGrad;
  ctx.fillRect(cx - 11, cy - 22, 22, 76);

  // Lid
  ctx.fillStyle = '#D45A32';
  drawRoundedRectPath(ctx, cx - 62, cy - 44, 124, 26, 8);
  ctx.fill();
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = ribGrad;
  ctx.fillRect(cx - 12, cy - 44, 24, 26);

  // Bow loops
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx - 18, cy - 54, 16, 10, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + 18, cy - 54, 16, 10, 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#FFFBEB';
  ctx.beginPath();
  ctx.arc(cx, cy - 48, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVerifiedSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  const outerGrad = ctx.createRadialGradient(cx - 16, cy - 16, 6, cx, cy, 62);
  outerGrad.addColorStop(0, '#FFFBEB');
  outerGrad.addColorStop(0.45, '#E5AE4E');
  outerGrad.addColorStop(1, '#8C5514');

  // Scalloped / ringed medal
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(229, 174, 78, 0.12)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = outerGrad;
  ctx.stroke();

  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.72)';
  ctx.stroke();
  ctx.setLineDash([]);

  // Checkmark badge inside
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 17, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(229, 174, 78, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#F4CA73';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 8);
  ctx.lineTo(cx - 2, cy - 2);
  ctx.lineTo(cx + 9, cy - 14);
  ctx.strokeStyle = '#FFFBEB';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = '#F4CA73';
  ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VERIFICADO', cx, cy + 20);
  ctx.fillStyle = '#DECAB4';
  ctx.font = '600 8.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('OFICIAL', cx, cy + 32);
  ctx.restore();
}

function drawDeterministicBarcode(
  ctx: CanvasRenderingContext2D,
  code: string,
  centerX: number,
  topY: number
) {
  const seedText = `TCC-${code}-2026`;
  const barWidths: number[] = [];
  for (let i = 0; i < 42; i++) {
    const ch = seedText.charCodeAt(i % seedText.length);
    const val = (ch * (i + 7) + i * 13) % 7;
    barWidths.push(val < 2 ? 2 : val < 5 ? 4 : 6);
  }
  const gap = 4;
  const totalWidth = barWidths.reduce((sum, w) => sum + w, 0) + (barWidths.length - 1) * gap;
  let cursorX = centerX - totalWidth / 2;

  ctx.save();
  const barGrad = ctx.createLinearGradient(cursorX, topY, cursorX + totalWidth, topY + 26);
  barGrad.addColorStop(0, '#C88A2B');
  barGrad.addColorStop(0.5, '#FEF08A');
  barGrad.addColorStop(1, '#C88A2B');
  ctx.fillStyle = barGrad;

  for (let i = 0; i < barWidths.length; i++) {
    const bw = barWidths[i];
    const bh = i % 5 === 0 ? 28 : 22;
    const by = topY + (28 - bh) / 2;
    ctx.globalAlpha = i % 3 === 0 ? 0.92 : 0.68;
    ctx.fillRect(cursorX, by, bw, bh);
    cursorX += bw + gap;
  }
  ctx.restore();
}

function formatIssuedDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('es-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export async function renderCouponInvoiceCanvas(
  params: CouponInvoiceParams
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }

  const [logoImg, giftImg] = await Promise.all([
    loadImageSafe('/images/logo%20ciprian.png'),
    loadImageSafe(params.gift.customImageUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D no disponible en este navegador.');
  }

  // 1. Rich Atelier Espresso Backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bgGrad.addColorStop(0, '#231109');
  bgGrad.addColorStop(0.35, '#190C06');
  bgGrad.addColorStop(1, '#110703');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle ambient warm studio glows
  const topGlow = ctx.createRadialGradient(CANVAS_W / 2, 160, 20, CANVAS_W / 2, 160, 480);
  topGlow.addColorStop(0, 'rgba(229, 174, 78, 0.22)');
  topGlow.addColorStop(0.6, 'rgba(184, 74, 39, 0.08)');
  topGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, CANVAS_W, 650);

  const bottomGlow = ctx.createRadialGradient(CANVAS_W / 2, 1080, 30, CANVAS_W / 2, 1080, 520);
  bottomGlow.addColorStop(0, 'rgba(244, 202, 115, 0.14)');
  bottomGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 750, CANVAS_W, 770);

  // Outer gold atelier frame
  ctx.strokeStyle = 'rgba(200, 138, 43, 0.55)';
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, 24, 24, CANVAS_W - 48, CANVAS_H - 48, 34);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.2)';
  ctx.lineWidth = 1;
  drawRoundedRectPath(ctx, 36, 36, CANVAS_W - 72, CANVAS_H - 72, 26);
  ctx.stroke();

  // Top metallic foil strip inside frame
  const topStrip = ctx.createLinearGradient(64, 0, CANVAS_W - 64, 0);
  topStrip.addColorStop(0, 'transparent');
  topStrip.addColorStop(0.25, '#B84A27');
  topStrip.addColorStop(0.5, '#FEF08A');
  topStrip.addColorStop(0.75, '#C88A2B');
  topStrip.addColorStop(1, 'transparent');
  ctx.fillStyle = topStrip;
  ctx.fillRect(64, 36, CANVAS_W - 128, 3);

  // 2. Header: Logo Medallion + Brand + Title
  const logoCx = CANVAS_W / 2;
  const logoCy = 104;
  const logoR = 44;

  ctx.save();
  ctx.beginPath();
  ctx.arc(logoCx, logoCy, logoR + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(229, 174, 78, 0.18)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#E5AE4E';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
  ctx.clip();
  if (logoImg) {
    ctx.drawImage(logoImg, logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
  } else {
    ctx.fillStyle = '#1E110A';
    ctx.fillRect(logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
    ctx.fillStyle = '#F4CA73';
    ctx.font = '700 28px "Fraunces", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TCC', logoCx, logoCy + 2);
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#E5AE4E';
  ctx.font = '700 17px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('THE CIPRIAN COMPANY · SHOW DE COCINA', CANVAS_W / 2, 180);

  ctx.fillStyle = '#FFFDF9';
  ctx.font = '700 32px "Fraunces", Georgia, serif';
  ctx.fillText('FACTURA DE OBSEQUIO · CUPÓN OFICIAL', CANVAS_W / 2, 222);

  ctx.fillStyle = 'rgba(244, 202, 115, 0.55)';
  ctx.fillRect(220, 240, 270, 1);
  ctx.fillRect(590, 240, 270, 1);
  ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#F4CA73';
  ctx.fillText('✦', CANVAS_W / 2, 245);

  // 3. Highlighted Metallic Gold NÚMERO DE ORDEN Block
  const orderX = 64;
  const orderY = 266;
  const orderW = CANVAS_W - 128;
  const orderH = 190;

  const orderBg = ctx.createLinearGradient(orderX, orderY, orderX + orderW, orderY + orderH);
  orderBg.addColorStop(0, '#2F190D');
  orderBg.addColorStop(0.5, '#3E2212');
  orderBg.addColorStop(1, '#261309');
  drawRoundedRectPath(ctx, orderX, orderY, orderW, orderH, 24);
  ctx.fillStyle = orderBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(244, 202, 115, 0.65)';
  ctx.stroke();

  ctx.fillStyle = '#F4CA73';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NÚMERO DE ORDEN · CÓDIGO DE RECLAMO', CANVAS_W / 2, orderY + 38);

  const codeGrad = ctx.createLinearGradient(340, orderY + 52, 740, orderY + 112);
  codeGrad.addColorStop(0, '#FDE68A');
  codeGrad.addColorStop(0.5, '#FFFBEB');
  codeGrad.addColorStop(1, '#E5AE4E');
  ctx.fillStyle = codeGrad;
  ctx.font = '700 58px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(params.claimCode, CANVAS_W / 2, orderY + 102);

  drawDeterministicBarcode(ctx, params.claimCode, CANVAS_W / 2, orderY + 120);

  ctx.fillStyle = '#C8A986';
  ctx.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(
    `VERIFIED · CIPRIAN-ATELIER · ${params.claimCode}`,
    CANVAS_W / 2,
    orderY + 170
  );

  // 4. Structured Warm-Ivory Invoice Details Table
  const tableX = 64;
  const tableY = 480;
  const tableW = CANVAS_W - 128;
  const tableH = 326;

  const ivoryGrad = ctx.createLinearGradient(tableX, tableY, tableX, tableY + tableH);
  ivoryGrad.addColorStop(0, '#FFFDF9');
  ivoryGrad.addColorStop(1, '#F6EBDC');
  drawRoundedRectPath(ctx, tableX, tableY, tableW, tableH, 24);
  ctx.fillStyle = ivoryGrad;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#DFC9AB';
  ctx.stroke();

  // Top accent strip on ivory card
  ctx.save();
  drawRoundedRectPath(ctx, tableX, tableY, tableW, tableH, 24);
  ctx.clip();
  const cardTopAccent = ctx.createLinearGradient(tableX, tableY, tableX + tableW, tableY);
  cardTopAccent.addColorStop(0, '#B84A27');
  cardTopAccent.addColorStop(0.5, '#E5AE4E');
  cardTopAccent.addColorStop(1, '#4B644A');
  ctx.fillStyle = cardTopAccent;
  ctx.fillRect(tableX, tableY, tableW, 6);
  ctx.restore();

  // Details Header + Status Pill
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8C4A19';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('DETALLES DEL COMPROBANTE', tableX + 32, tableY + 42);

  const badgeText = 'CÓDIGO VÁLIDO · PENDIENTE DE CANJE';
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 28;
  const badgeX = tableX + tableW - 32 - badgeW;
  const badgeY = tableY + 21;
  drawRoundedRectPath(ctx, badgeX, badgeY, badgeW, 30, 15);
  ctx.fillStyle = '#ECFDF5';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#A7F3D0';
  ctx.stroke();
  ctx.fillStyle = '#047857';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 19.5);

  ctx.fillStyle = '#E6D5BF';
  ctx.fillRect(tableX + 32, tableY + 62, tableW - 64, 1);

  const issuedStr = formatIssuedDate(params.issuedAt || new Date());
  const cleanPhone = params.leadPhone?.trim() || 'Registrado en sistema';
  const cleanAddress = params.leadAddress?.trim() || 'Cobertura autorizada';

  const rows: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Fecha y hora de emisión', value: issuedStr },
    { label: 'Titular del cupón', value: params.leadName.trim() || 'Invitado Especial' },
    { label: 'Teléfono de contacto', value: cleanPhone },
    { label: 'Ubicación', value: cleanAddress },
    { label: 'Total Cortesía', value: '$0.00 USD · Sin obligación de compra', highlight: true },
  ];

  rows.forEach((row, idx) => {
    const ry = tableY + 102 + idx * 46;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6E5341';
    ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(row.label, tableX + 32, ry);

    ctx.textAlign = 'right';
    ctx.fillStyle = row.highlight ? '#047857' : '#22150E';
    ctx.font = row.highlight
      ? '700 18px "Plus Jakarta Sans", sans-serif'
      : '700 18px "Plus Jakarta Sans", sans-serif';
    const fittedVal = truncateSingleLine(ctx, row.value, tableW - 320);
    ctx.fillText(fittedVal, tableX + tableW - 32, ry);

    if (idx < rows.length - 1) {
      ctx.fillStyle = '#EFE3D2';
      ctx.fillRect(tableX + 32, ry + 16, tableW - 64, 1);
    }
  });

  // 5. Featured Prize Block
  const prizeX = 64;
  const prizeY = 830;
  const prizeW = CANVAS_W - 128;
  const prizeH = 440;

  const prizeBg = ctx.createLinearGradient(prizeX, prizeY, prizeX + prizeW, prizeY + prizeH);
  prizeBg.addColorStop(0, '#2C170C');
  prizeBg.addColorStop(0.55, '#1D0E07');
  prizeBg.addColorStop(1, '#130804');
  drawRoundedRectPath(ctx, prizeX, prizeY, prizeW, prizeH, 26);
  ctx.fillStyle = prizeBg;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = 'rgba(200, 138, 43, 0.55)';
  ctx.stroke();

  // Left Showcase Pedestal Frame
  const stageX = prizeX + 28;
  const stageY = prizeY + 28;
  const stageW = 304;
  const stageH = prizeH - 56;

  drawRoundedRectPath(ctx, stageX, stageY, stageW, stageH, 20);
  const stageBg = ctx.createRadialGradient(
    stageX + stageW / 2,
    stageY + stageH * 0.42,
    18,
    stageX + stageW / 2,
    stageY + stageH * 0.5,
    220
  );
  stageBg.addColorStop(0, 'rgba(254, 240, 138, 0.24)');
  stageBg.addColorStop(0.5, 'rgba(200, 138, 43, 0.1)');
  stageBg.addColorStop(1, 'rgba(17, 7, 3, 0.92)');
  ctx.fillStyle = stageBg;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(244, 202, 115, 0.38)';
  ctx.stroke();

  // Plinth ellipse inside showcase
  const plinthCx = stageX + stageW / 2;
  const plinthCy = stageY + stageH - 46;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(plinthCx, plinthCy, 108, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3A2112';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(244, 202, 115, 0.65)';
  ctx.stroke();

  const lensGlow = ctx.createRadialGradient(plinthCx, plinthCy, 4, plinthCx, plinthCy, 86);
  lensGlow.addColorStop(0, 'rgba(255, 251, 235, 0.72)');
  lensGlow.addColorStop(0.6, 'rgba(229, 174, 78, 0.18)');
  lensGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = lensGlow;
  ctx.fillRect(stageX + 20, plinthCy - 24, stageW - 40, 48);
  ctx.restore();

  if (giftImg) {
    const maxImgW = stageW - 44;
    const maxImgH = stageH - 102;
    const scale = Math.min(maxImgW / giftImg.naturalWidth, maxImgH / giftImg.naturalHeight);
    const drawW = giftImg.naturalWidth * scale;
    const drawH = giftImg.naturalHeight * scale;
    const drawX = stageX + (stageW - drawW) / 2;
    const drawY = stageY + 24 + (maxImgH - drawH) / 2;
    ctx.drawImage(giftImg, drawX, drawY, drawW, drawH);
  } else {
    drawFallbackGiftEmblem(ctx, plinthCx, stageY + stageH * 0.43);
  }

  // Right Prize Information
  const infoX = stageX + stageW + 32;
  const infoW = prizeX + prizeW - infoX - 30;

  const tagLabel = (params.gift.tag || 'OBSEQUIO EXCLUSIVO ROYAL PRESTIGE').toUpperCase();
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  const tagPillW = Math.min(infoW, ctx.measureText(tagLabel).width + 26);
  drawRoundedRectPath(ctx, infoX, stageY + 2, tagPillW, 28, 14);
  ctx.fillStyle = 'rgba(229, 174, 78, 0.18)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(244, 202, 115, 0.45)';
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F4CA73';
  ctx.fillText(truncateSingleLine(ctx, tagLabel, tagPillW - 20), infoX + 13, stageY + 20);

  // Gift Name (up to 2 lines)
  ctx.fillStyle = '#FFFDF9';
  ctx.font = '700 32px "Fraunces", Georgia, serif';
  const nameLines = wrapTextLines(ctx, params.gift.name, infoW, 2);
  nameLines.forEach((line, i) => {
    ctx.fillText(line, infoX, stageY + 68 + i * 38);
  });

  // Gift Subtitle (up to 3 lines)
  const subtitleStartY = stageY + 68 + nameLines.length * 38 + 6;
  ctx.fillStyle = '#DECAB4';
  ctx.font = '400 17px "Plus Jakarta Sans", sans-serif';
  const subLines = wrapTextLines(ctx, params.gift.subtitle || '', infoW, 3);
  subLines.forEach((line, i) => {
    ctx.fillText(line, infoX, subtitleStartY + i * 24);
  });

  // Usage Tip Sub-Card inside Prize block
  const tipBoxY = prizeY + prizeH - 166;
  const tipBoxH = 138;
  drawRoundedRectPath(ctx, infoX, tipBoxY, infoW, tipBoxH, 16);
  ctx.fillStyle = 'rgba(17, 7, 3, 0.65)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(229, 174, 78, 0.35)';
  ctx.stroke();

  ctx.fillStyle = '#F4CA73';
  ctx.font = '700 12.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('✦  CÓMO SACARLE EL MÁXIMO PROVECHO', infoX + 18, tipBoxY + 30);

  const usageTip = resolveGiftUsageTip(params.gift);
  ctx.fillStyle = '#F5E7D6';
  ctx.font = '400 16px "Plus Jakarta Sans", sans-serif';
  const tipLines = wrapTextLines(ctx, usageTip, infoW - 36, 3);
  tipLines.forEach((line, i) => {
    ctx.fillText(line, infoX + 18, tipBoxY + 60 + i * 24);
  });

  // 6. Footer with Official Verified Seal & Validity Note
  drawVerifiedSeal(ctx, 148, 1380);

  const noteX = 236;
  const noteW = CANVAS_W - 64 - noteX;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#E5AE4E';
  ctx.font = '700 13.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('VALIDACIÓN OFICIAL DEL CUPÓN', noteX, 1344);

  ctx.fillStyle = '#EFE3D2';
  ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
  const validityLines = wrapTextLines(
    ctx,
    'Presenta este Número de Orden para validar tu obsequio. El código se invalida automáticamente una vez asignado en sistema.',
    noteW,
    3
  );
  validityLines.forEach((line, i) => {
    ctx.fillText(line, noteX, 1374 + i * 25);
  });

  ctx.fillStyle = '#B89B7A';
  ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'The Ciprian Company · Todos los derechos reservados',
    noteX,
    1448
  );

  return canvas;
}

export async function saveCouponInvoicePng(params: CouponInvoiceParams): Promise<void> {
  const canvas = await renderCouponInvoiceCanvas(params);
  const safeCode = (params.claimCode || 'CUPON').replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Factura-Cupon-${safeCode}.png`;

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((result) => resolve(result), 'image/png', 1);
    } catch {
      resolve(null);
    }
  });

  if (blob) {
    const supportsDownloadAttr =
      typeof document !== 'undefined' && 'download' in document.createElement('a');

    if (supportsDownloadAttr) {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      } catch {
        URL.revokeObjectURL(objectUrl);
      }
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const file = new File([blob], filename, { type: 'image/png' });
      const canShareFiles =
        typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;
      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: `Factura de Obsequio · ${params.claimCode}`,
            text: `Cupón oficial ${params.claimCode} - ${params.gift.name}`,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
        }
      }
    }
  }

  // Fallback data URL anchor click
  const dataUrl = canvas.toDataURL('image/png');
  const fallbackAnchor = document.createElement('a');
  fallbackAnchor.href = dataUrl;
  fallbackAnchor.download = filename;
  fallbackAnchor.rel = 'noopener';
  fallbackAnchor.style.display = 'none';
  document.body.appendChild(fallbackAnchor);
  fallbackAnchor.click();
  document.body.removeChild(fallbackAnchor);
}
