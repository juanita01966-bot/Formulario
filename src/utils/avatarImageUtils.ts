const MAX_AVATAR_DIM = 320;
const MAX_DATA_URL_CHARS = 450_000;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Normalizes Google Drive share links into direct embeddable thumbnail URLs
 * so <img> elements can render them cleanly without Drive viewer HTML wrappers.
 */
export function normalizeAvatarLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${driveFileMatch[1]}&sz=w800`;
  }

  const driveOpenMatch = trimmed.match(
    /drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/
  );
  if (driveOpenMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w800`;
  }

  return trimmed;
}

/**
 * Client-side validation mirroring backend rules:
 * allows empty/null (clears photo), https://, http://, or base64 data:image/(jpeg|jpg|png|webp).
 * Strictly rejects SVG, javascript:, and oversized data URLs.
 */
export function validateAvatarUrlInput(
  raw: string | null | undefined
): { ok: boolean; value: string | null; error?: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  const normalized = normalizeAvatarLink(String(raw));
  if (!normalized) {
    return { ok: true, value: null };
  }

  if (/^data:/i.test(normalized)) {
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(normalized)) {
      return {
        ok: false,
        value: null,
        error: 'Formato de imagen no permitido. Usa JPG, PNG o WebP (no SVG).',
      };
    }
    if (normalized.length > MAX_DATA_URL_CHARS) {
      return {
        ok: false,
        value: null,
        error: 'La imagen es demasiado pesada. Selecciona una foto más liviana.',
      };
    }
    return { ok: true, value: normalized };
  }

  if (normalized.length > 2048) {
    return {
      ok: false,
      value: null,
      error: 'El enlace de la imagen es demasiado largo (máx. 2048 caracteres).',
    };
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        ok: false,
        value: null,
        error: 'El enlace debe comenzar con https:// o http://.',
      };
    }
    if (!parsed.hostname) {
      return { ok: false, value: null, error: 'Ingresa un enlace de imagen válido.' };
    }
    return { ok: true, value: normalized };
  } catch {
    return {
      ok: false,
      value: null,
      error: 'Ingresa un enlace válido que comience con https:// o http://.',
    };
  }
}

/**
 * Center-crops and compresses a local JPG/PNG/WebP image file into a square
 * 320x320 WebP (or JPEG fallback) data URL so it stays crisp and well under 400 KB.
 */
export async function compressAvatarFile(file: File): Promise<string> {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    throw new Error('Por seguridad, las imágenes SVG no están permitidas. Usa JPG, PNG o WebP.');
  }
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error('Formato no válido. Selecciona una foto en formato JPG, PNG o WebP.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('La imagen supera el límite de 12 MB. Elige un archivo más pequeño.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
    el.src = rawDataUrl;
  });

  const srcW = img.naturalWidth || img.width || 1;
  const srcH = img.naturalHeight || img.height || 1;
  const cropSide = Math.min(srcW, srcH);
  const sx = Math.floor((srcW - cropSide) / 2);
  const sy = Math.floor((srcH - cropSide) / 2);
  const outDim = Math.min(MAX_AVATAR_DIM, cropSide);

  const canvas = document.createElement('canvas');
  canvas.width = outDim;
  canvas.height = outDim;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el compresor de imágenes.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, outDim, outDim);

  const webp = canvas.toDataURL('image/webp', 0.86);
  const candidate =
    webp.startsWith('data:image/webp;base64,') && webp.length <= MAX_DATA_URL_CHARS
      ? webp
      : canvas.toDataURL('image/jpeg', 0.84);

  const finalCheck = validateAvatarUrlInput(candidate);
  if (!finalCheck.ok || !finalCheck.value) {
    // Second pass at lower quality if unusually high entropy
    const compact = canvas.toDataURL('image/jpeg', 0.72);
    const retryCheck = validateAvatarUrlInput(compact);
    if (!retryCheck.ok || !retryCheck.value) {
      throw new Error(retryCheck.error || 'No se pudo comprimir la foto de perfil.');
    }
    return retryCheck.value;
  }

  return finalCheck.value;
}
