import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  Palette,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { GiftItem, GiftThemeId, GiftVisualKey, ShowcaseStyleId } from '../../types/app';
import { GIFT_THEME_PRESETS, resolveBoxPalette } from '../../shared/giftThemes';
import {
  GIFT_VISUAL_OPTIONS,
  GiftIllustration,
  OFFICIAL_ROYAL_PNG_GALLERY,
  SHOWCASE_STYLE_OPTIONS,
  StudioPlinthBase,
  resolveGiftUsageTip,
  resolveShowcaseTokens,
} from '../gifts/GiftIllustration';
import type { UpsertGiftPayload } from '../../services/storeClient';

/**
 * Normalizes Google Drive share URLs into direct embeddable thumbnail URLs
 * so <img> elements can render them without Drive viewer HTML wrappers.
 */
function normalizeImageUrl(raw: string): { url: string; isDrive: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: '', isDrive: false };

  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch?.[1]) {
    return {
      url: `https://drive.google.com/thumbnail?id=${driveFileMatch[1]}&sz=w800`,
      isDrive: true,
    };
  }

  const driveOpenMatch = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch?.[1]) {
    return {
      url: `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w800`,
      isDrive: true,
    };
  }

  return {
    url: trimmed,
    isDrive: trimmed.includes('drive.google.com/thumbnail?id='),
  };
}

/**
 * Resizes and compresses a desktop-uploaded image file to a lightweight data URL
 * (max 640x640) so it persists cleanly in JSON/localStorage.
 */
async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido (PNG, JPG, WebP, SVG).');
  }
  const maxDim = 640;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });

  if (file.type === 'image/svg+xml' || file.size <= 120 * 1024) {
    return dataUrl;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, width, height);
  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}

interface GiftsEditorProps {
  gifts: GiftItem[];
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  showcaseStyle?: ShowcaseStyleId;
  randomizeGifts?: boolean;
  onUpdateGiftTheme?: (giftTheme: GiftThemeId, customBoxColor?: string) => Promise<void>;
  onUpdateShowcaseSettings?: (updates: {
    showcaseStyle?: ShowcaseStyleId;
    randomizeGifts?: boolean;
  }) => Promise<void>;
  onCreateGift: (payload: UpsertGiftPayload) => Promise<void>;
  onUpdateGift: (id: string, updates: Partial<UpsertGiftPayload>) => Promise<void>;
  onDeleteGift: (id: string) => Promise<void>;
  onResetGifts: () => Promise<void>;
}

const ACCENT_PRESETS = [
  { color: '#C88A2B', name: 'Ámbar Dorado' },
  { color: '#B84A27', name: 'Terracota' },
  { color: '#8C3B20', name: 'Castaño Otoño' },
  { color: '#4B644A', name: 'Salvia Bosque' },
  { color: '#A66328', name: 'Bambú Tostado' },
  { color: '#261810', name: 'Nogal Oscuro' },
];

const EMPTY_DRAFT: UpsertGiftPayload = {
  name: '',
  subtitle: '',
  usageTip: '',
  tag: 'Edición Otoño',
  visualKey: 'skillet',
  customImageUrl: '',
  accentColor: '#C88A2B',
  active: true,
  stockLabel: 'Disponible',
};

interface GiftCatalogCardProps {
  gift: GiftItem;
  index: number;
  showcaseStyle?: ShowcaseStyleId;
  confirmDeleteId: string | null;
  onToggleActive: (gift: GiftItem) => void;
  onEdit: (gift: GiftItem) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

const GiftCatalogCard: React.FC<GiftCatalogCardProps> = ({
  gift,
  index,
  showcaseStyle = 'luminous-gold',
  confirmDeleteId,
  onToggleActive,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) => {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [spotlight, setSpotlight] = useState({ x: 50, y: 40, active: false });

  // Synchronized 60 FPS GPU floating loop & breathing oval ground shadow
  const floatDriver = useMotionValue(0);
  const giftY = useTransform(floatDriver, [0, 1], [0, -7]);
  const shadowScaleX = useTransform(floatDriver, [0, 1], [1, 0.74]);
  const shadowScaleY = useTransform(floatDriver, [0, 1], [1, 0.78]);
  const shadowOpacity = useTransform(floatDriver, [0, 1], [0.68, 0.28]);
  const auraScale = useTransform(floatDriver, [0, 1], [0.95, 1.12]);
  const auraOpacity = useTransform(floatDriver, [0, 1], [0.55, 0.88]);

  useEffect(() => {
    const controls = animate(floatDriver, [0, 1, 0], {
      duration: 3.1 + (index % 3) * 0.3,
      repeat: Infinity,
      ease: 'easeInOut',
      delay: (index % 4) * 0.25,
    });
    return () => controls.stop();
  }, [floatDriver, index]);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setTilt({
      rx: (0.5 - py) * 14,
      ry: (px - 0.5) * 16,
    });
    setSpotlight({
      x: Math.round(px * 100),
      y: Math.round(py * 100),
      active: true,
    });
  };

  const handleStageMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
    setSpotlight((prev) => ({ ...prev, active: false }));
  };

  const accent = gift.accentColor || '#C88A2B';
  const tokens = resolveShowcaseTokens(showcaseStyle);
  const usageTip = resolveGiftUsageTip(gift);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className={`group/card relative rounded-[24px] border p-3.5 sm:p-4 flex flex-col justify-between transition-all ${
        gift.active
          ? 'border-[#DFC9AB]/90 bg-gradient-to-b from-[#FFFDF9] to-[#FCF7EE] shadow-[0_14px_30px_-14px_rgba(34,21,14,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] hover:border-[#C88A2B]/65 hover:shadow-[0_20px_38px_-14px_rgba(140,74,25,0.2)]'
          : 'border-stone-200/90 bg-stone-50/85 opacity-80'
      }`}
    >
      <div>
        {/* Miniature Realistic Showroom Plinth Stage */}
        <div
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          className={`relative h-44 sm:h-48 w-full overflow-hidden rounded-2xl border perspective-1000 flex flex-col items-center justify-end pb-3 pt-4 ${
            gift.active
              ? `${tokens.stageBorder} shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_12px_26px_-14px_rgba(15,8,4,0.6)]`
              : 'border-stone-300 opacity-70 grayscale-[0.4]'
          }`}
          style={{
            background: gift.active
              ? tokens.miniStageBg
              : 'radial-gradient(circle at 50% 45%, #44403C, #1C1917 75%)',
          }}
        >
          {/* Interactive cursor radial spotlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-200"
            style={{
              opacity: spotlight.active ? 1 : 0,
              background: `radial-gradient(200px circle at ${spotlight.x}% ${spotlight.y}%, ${tokens.spotlightTint}, transparent 72%)`,
            }}
          />

          {/* Top studio light specular line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
          />

          {/* Top-right floating Active/Hidden toggle */}
          <div className="absolute top-2.5 right-2.5 z-30">
            <button
              type="button"
              onClick={() => onToggleActive(gift)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer backdrop-blur-md transition-all shadow-sm ${
                gift.active
                  ? 'bg-emerald-950/85 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-900'
                  : 'bg-stone-900/90 text-stone-300 border border-stone-500/40 hover:bg-stone-800'
              }`}
            >
              {gift.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {gift.active ? 'Activo' : 'Oculto'}
            </button>
          </div>

          {/* Soft overhead gallery key-light behind product */}
          {gift.active && (
            <motion.div
              aria-hidden="true"
              style={{
                scale: auraScale,
                opacity: auraOpacity,
                background: `radial-gradient(ellipse at 50% 42%, ${tokens.auraCore} 0%, ${accent}22 50%, transparent 74%)`,
              }}
              className="pointer-events-none absolute top-3 h-32 w-36 rounded-full blur-xl will-change-transform"
            />
          )}

          {/* Frameless Transparent PNG Gift Artwork with 3D Interactive Tilt */}
          <motion.div
            style={{ y: giftY }}
            className="relative z-20 mb-0 flex items-center justify-center will-change-transform"
          >
            <div
              style={{
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${spotlight.active ? 1.04 : 1})`,
                transition: 'transform 160ms ease-out',
              }}
              className="preserve-3d"
            >
              <GiftIllustration
                visualKey={gift.visualKey}
                customImageUrl={gift.customImageUrl}
                accentColor={accent}
                size={96}
                variant="clean"
                alt={gift.name}
              />
            </div>
          </motion.div>

          {/* Realistic Architectural Plinth */}
          <StudioPlinthBase
            showcaseStyle={showcaseStyle}
            size="sm"
            shadowScaleX={shadowScaleX}
            shadowScaleY={shadowScaleY}
            shadowOpacity={shadowOpacity}
          />
        </div>

        {/* Gift Copy */}
        <div className="mt-3.5 px-0.5">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
              style={{ backgroundColor: accent }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C4A19]">
              {gift.tag}
            </span>
          </div>
          <h3 className="mt-1 font-serif text-lg font-bold text-[#22150E] leading-snug">
            {gift.name}
          </h3>
          <p className="mt-1 text-xs text-[#6E5341] leading-relaxed line-clamp-2">
            {gift.subtitle}
          </p>

          {/* Concise Usage Tip Callout */}
          <div className="mt-2.5 rounded-xl border border-[#EAD9C2] bg-[#FAF4EA] px-2.5 py-2">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#9A5B1F]">
              <Sparkles className="h-2.5 w-2.5 text-[#C88A2B] shrink-0" />
              Máximo provecho
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#594133] line-clamp-2">
              {usageTip}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#EFE3D2] flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#8B6F5B] truncate">{gift.stockLabel}</span>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(gift)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E6D5BF] bg-[#FAF3E8] px-2.5 py-1.5 text-xs font-semibold text-[#22150E] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5 text-[#B84A27]" />
            Editar
          </button>

          {confirmDeleteId === gift.id ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => onConfirmDelete(gift.id)}
                className="font-bold text-red-700 cursor-pointer"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="text-[#6E5341] cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onRequestDelete(gift.id)}
              className="rounded-lg p-1.5 text-[#A48A77] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              title="Eliminar regalo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const GiftsEditor: React.FC<GiftsEditorProps> = ({
  gifts,
  giftTheme = 'autumn',
  customBoxColor = '#B84A27',
  showcaseStyle = 'luminous-gold',
  randomizeGifts = true,
  onUpdateGiftTheme,
  onUpdateShowcaseSettings,
  onCreateGift,
  onUpdateGift,
  onDeleteGift,
  onResetGifts,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpsertGiftPayload>(EMPTY_DRAFT);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingShowcase, setSavingShowcase] = useState(false);
  const [driveDetected, setDriveDetected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewUid = useId().replace(/:/g, '');
  const activeCount = gifts.filter((g) => g.active).length;

  const openCreateModal = () => {
    setEditingGiftId(null);
    setDraft(EMPTY_DRAFT);
    setErrorMsg(null);
    setDriveDetected(false);
    setModalOpen(true);
  };

  const openEditModal = (gift: GiftItem) => {
    setEditingGiftId(gift.id);
    setDraft({
      name: gift.name,
      subtitle: gift.subtitle,
      usageTip: gift.usageTip || '',
      tag: gift.tag,
      visualKey: gift.visualKey,
      customImageUrl: gift.customImageUrl || '',
      accentColor: gift.accentColor,
      active: gift.active,
      stockLabel: gift.stockLabel,
    });
    setErrorMsg(null);
    setDriveDetected(Boolean(gift.customImageUrl?.includes('drive.google.com')));
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (draft.name.trim().length < 2) {
      setErrorMsg('Escribe el nombre del regalo de cocina.');
      return;
    }

    try {
      if (editingGiftId) {
        await onUpdateGift(editingGiftId, draft);
      } else {
        await onCreateGift(draft);
      }
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar el regalo.');
    }
  };

  const handleToggleActive = async (gift: GiftItem) => {
    setErrorMsg(null);
    try {
      await onUpdateGift(gift.id, { active: !gift.active });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      await onDeleteGift(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el regalo.');
    }
  };

  const handleShowcaseUpdate = async (updates: {
    showcaseStyle?: ShowcaseStyleId;
    randomizeGifts?: boolean;
  }) => {
    if (!onUpdateShowcaseSettings || savingShowcase) return;
    setErrorMsg(null);
    setSavingShowcase(true);
    try {
      await onUpdateShowcaseSettings(updates);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar la visualización.');
    } finally {
      setSavingShowcase(false);
    }
  };

  const previewPalette = resolveBoxPalette(giftTheme, customBoxColor, 0);
  const activeShowcaseTokens = resolveShowcaseTokens(showcaseStyle);

  return (
    <section className="space-y-5">
      <div className="rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-5 sm:p-6 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF0E0] border border-[#E6C99E] px-3 py-0.5 text-[11px] font-semibold text-[#8C4A19] mb-2">
              <Sparkles className="h-3 w-3 text-[#C88A2B]" />
              {activeCount} {activeCount === 1 ? 'regalo activo' : 'regalos activos'} en tarjetas ocultas
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#22150E]">
              Catálogo de Regalos de Cocina
            </h2>
            <p className="text-xs sm:text-sm text-[#7B5D4A] mt-0.5">
              Añade, edita, oculta o elimina los regalos que se revelan en la animación de la caja dorada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {confirmReset ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-300 px-3 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={async () => {
                    await onResetGifts();
                    setConfirmReset(false);
                  }}
                  className="font-bold text-[#8C3318] hover:underline cursor-pointer"
                >
                  Confirmar restaurar 9 originales
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-[#6E5341] cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FAF3E8] px-3.5 py-2 text-xs font-semibold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar base
              </button>
            )}

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#22150E] to-[#8C3318] px-4 py-2 text-xs font-semibold text-[#FFFDF9] shadow hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Añadir regalo
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Thematic & Custom Color Selector for 3D Gift Boxes */}
        <div className="mt-5 rounded-2xl border border-[#E6D5BF] bg-[#FAF3E8]/75 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Live Floating 3D Box Mini Preview */}
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-[#2A160D] to-[#160B06] border border-[#C88A2B]/45 p-1.5 shadow-[inset_0_1px_0_rgba(254,240,138,0.28),0_10px_20px_-8px_rgba(34,21,14,0.45)]">
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-full h-full"
                >
                  <svg viewBox="0 0 130 130" className="w-full h-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" fill="none" aria-hidden="true">
                    <defs>
                      <linearGradient id={`miniRib-${previewUid}`} x1="20" y1="20" x2="110" y2="110" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={previewPalette.ribbonStart} />
                        <stop offset="50%" stopColor={previewPalette.ribbonMid} />
                        <stop offset="100%" stopColor={previewPalette.ribbonEnd} />
                      </linearGradient>
                    </defs>
                    <polygon points="23,58 65,78 65,114 23,94" fill={previewPalette.front} stroke={previewPalette.ribbonStart} strokeOpacity="0.35" strokeWidth="0.9" />
                    <polygon points="65,78 107,58 107,94 65,114" fill={previewPalette.side} stroke={previewPalette.ribbonMid} strokeOpacity="0.25" strokeWidth="0.9" />
                    <polygon points="40,66 48,70 48,106 40,102" fill={`url(#miniRib-${previewUid})`} />
                    <polygon points="82,70 90,66 90,102 82,106" fill={`url(#miniRib-${previewUid})`} fillOpacity="0.88" />
                    <polygon points="18,47 65,69 65,78 18,56" fill={previewPalette.lid} />
                    <polygon points="65,69 112,47 112,56 65,78" fill={previewPalette.side} />
                    <polygon points="65,26 112,47 65,69 18,47" fill={previewPalette.lid} stroke="#FEF08A" strokeOpacity="0.5" strokeWidth="1" />
                    <polygon points="39,37 47,33 93,55 85,59" fill={`url(#miniRib-${previewUid})`} />
                    <polygon points="83,33 91,37 45,59 37,55" fill={`url(#miniRib-${previewUid})`} />
                    <circle cx="65" cy="46" r="6" fill={`url(#miniRib-${previewUid})`} />
                  </svg>
                </motion.div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Palette className="h-4 w-4 text-[#B84A27]" />
                  <h3 className="text-sm font-bold text-[#22150E]">
                    Temáticas y Color de las Cajas 3D
                  </h3>
                </div>
                <p className="text-xs text-[#6E5341] mt-0.5">
                  Personaliza la estética de la caja 3D principal y las cajitas misteriosas por temática o color libre.
                </p>
              </div>
            </div>

            {/* Custom Color Picker Control */}
            <div className="flex items-center gap-2.5 self-start lg:self-center rounded-xl border border-[#DFCBB3] bg-white px-3 py-2">
              <label className="text-xs font-semibold text-[#4E382B] whitespace-nowrap">
                Color libre:
              </label>
              <input
                type="color"
                value={customBoxColor || '#B84A27'}
                onChange={(e) => {
                  onUpdateGiftTheme?.('custom', e.target.value);
                }}
                className="h-7 w-9 cursor-pointer rounded border border-[#DFCBB3] bg-transparent p-0.5"
                title="Elegir color personalizado para las cajas 3D"
              />
              <button
                type="button"
                onClick={() => onUpdateGiftTheme?.('custom', customBoxColor || '#B84A27')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  giftTheme === 'custom'
                    ? 'bg-[#22150E] text-[#F4CA73]'
                    : 'bg-[#FAF3E8] text-[#594133] hover:bg-[#EFE2D0]'
                }`}
              >
                {giftTheme === 'custom' ? 'Color activo' : 'Usar color'}
              </button>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {GIFT_THEME_PRESETS.map((theme) => {
              const active = giftTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateGiftTheme?.(theme.id, customBoxColor)}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-[#B84A27] bg-white ring-2 ring-[#B84A27]/25 shadow-sm'
                      : 'border-[#E6D5BF] bg-[#FFFDF9]/80 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center -space-x-1">
                      {theme.swatches.map((hex, i) => (
                        <span
                          key={i}
                          className="h-4 w-4 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    {active && (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#B84A27] text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-[#22150E] leading-tight">{theme.name}</p>
                  <p className="text-[10px] text-[#7B5D4A] mt-0.5 line-clamp-2">{theme.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visualización & Aleatoriedad Control Strip */}
        <div className="mt-4 rounded-2xl border border-[#E6D5BF] bg-gradient-to-br from-[#FFFDF9] to-[#FAF3E8] p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#C88A2B]" />
                <h3 className="text-sm font-bold text-[#22150E]">
                  Visualización &amp; Aleatoriedad
                </h3>
              </div>
              <p className="text-xs text-[#6E5341] mt-0.5">
                Elige la iluminación de la base lumínica donde flotan los premios y controla la selección aleatoria anti-abuso.
              </p>
            </div>

            {/* Selección Aleatoria Anti-Abuso Toggle */}
            <button
              type="button"
              disabled={savingShowcase || !onUpdateShowcaseSettings}
              onClick={() => handleShowcaseUpdate({ randomizeGifts: !randomizeGifts })}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all cursor-pointer disabled:opacity-60 ${
                randomizeGifts
                  ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950 shadow-sm'
                  : 'border-[#DFCBB3] bg-white text-[#4E382B] hover:bg-[#FAF3E8]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    randomizeGifts
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  <Shuffle className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight">
                    Selección Aleatoria Anti-Abuso
                  </p>
                  <p className="text-[10.5px] opacity-80 leading-snug">
                    {randomizeGifts
                      ? 'Activa · Mezcla cajas y sortea al tocar para evitar trucos'
                      : 'Desactivada · Orden fijo según catálogo'}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  randomizeGifts
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {randomizeGifts ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SHOWCASE_STYLE_OPTIONS.map((styleOpt) => {
              const active = showcaseStyle === styleOpt.id;
              return (
                <button
                  key={styleOpt.id}
                  type="button"
                  disabled={savingShowcase || !onUpdateShowcaseSettings}
                  onClick={() => handleShowcaseUpdate({ showcaseStyle: styleOpt.id })}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer disabled:opacity-60 ${
                    active
                      ? 'border-[#C88A2B] bg-white ring-2 ring-[#C88A2B]/25 shadow-sm'
                      : 'border-[#E6D5BF] bg-[#FFFDF9]/85 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/15 shadow-inner"
                      style={{ background: styleOpt.miniStageBg }}
                    >
                      <span
                        className="h-3.5 w-6 rounded-full border"
                        style={{
                          borderColor: styleOpt.swatches[0],
                          boxShadow: `0 0 10px ${styleOpt.swatches[0]}`,
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#22150E] leading-tight">
                        {styleOpt.name}
                      </p>
                      <p className="text-[10px] text-[#7B5D4A] mt-0.5 line-clamp-2">
                        {styleOpt.subtitle}
                      </p>
                    </div>
                  </div>
                  {active && (
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C88A2B] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <AnimatePresence mode="popLayout">
            {gifts.map((gift, idx) => (
              <GiftCatalogCard
                key={gift.id}
                gift={gift}
                index={idx}
                showcaseStyle={showcaseStyle}
                confirmDeleteId={confirmDeleteId}
                onToggleActive={handleToggleActive}
                onEdit={openEditModal}
                onRequestDelete={(id) => setConfirmDeleteId(id)}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/60 backdrop-blur-sm p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveModal}
              className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#EFE3D2]">
                <h3 className="font-serif text-xl font-bold text-[#22150E]">
                  {editingGiftId ? 'Editar regalo de cocina' : 'Nuevo regalo de cocina'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-full p-1 text-[#7B5D4A] hover:bg-[#FAF3E8]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Live Floating Luminous Base Preview Strip */}
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-[#DFCBB3] bg-[#FAF3E8]/70 p-3.5 shadow-inner"
              >
                <div
                  className={`relative flex h-28 w-full sm:w-28 shrink-0 flex-col items-center justify-end overflow-hidden rounded-2xl border pb-2 pt-2 ${activeShowcaseTokens.stageBorder} shadow-[0_12px_26px_-10px_rgba(15,8,4,0.55)]`}
                  style={{ background: activeShowcaseTokens.miniStageBg }}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-2 h-20 w-20 rounded-full blur-lg opacity-80"
                    style={{
                      background: `radial-gradient(ellipse at 50% 45%, ${activeShowcaseTokens.auraCore} 0%, transparent 74%)`,
                    }}
                  />
                  <div className="relative z-20 -mb-0.5">
                    <GiftIllustration
                      visualKey={draft.visualKey}
                      customImageUrl={draft.customImageUrl}
                      accentColor={draft.accentColor}
                      size={64}
                      variant="clean"
                    />
                  </div>
                  <StudioPlinthBase showcaseStyle={showcaseStyle} size="xs" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C4A19]">
                    {draft.tag || 'Edición Otoño'}
                  </p>
                  <p className="font-serif text-base font-bold text-[#22150E] truncate">
                    {draft.name || 'Vista previa del regalo'}
                  </p>
                  <p className="text-xs text-[#6E5341] line-clamp-2">
                    {draft.subtitle || 'Descripción visible cuando se abra la caja.'}
                  </p>
                  <p className="pt-0.5 text-[11px] text-[#8C4A19] line-clamp-2">
                    <span className="font-bold">Máximo provecho:</span>{' '}
                    {draft.usageTip?.trim() ||
                      resolveGiftUsageTip({
                        name: draft.name,
                        visualKey: draft.visualKey,
                        usageTip: draft.usageTip,
                      })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">Nombre del regalo *</label>
                  <input
                    type="text"
                    required
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Sartén Gourmet 10 pulgadas"
                    className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">Etiqueta de colección</label>
                  <input
                    type="text"
                    value={draft.tag}
                    onChange={(e) => setDraft((prev) => ({ ...prev, tag: e.target.value }))}
                    placeholder="Ej. Favorito del Chef"
                    className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={draft.subtitle}
                  onChange={(e) => setDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Describe brevemente el utensilio de cocina..."
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">
                  Cómo sacarle el máximo provecho (Mensaje corto)
                </label>
                <textarea
                  rows={2}
                  value={draft.usageTip || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, usageTip: e.target.value }))}
                  placeholder="Ej. Úsalo para sellar carnes y saltear vegetales conservando sus jugos y sabor natural."
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>

              {/* Image source selector: Official PNG Gallery, Desktop upload, Google Drive / Link, or SVG preset */}
              <div className="rounded-2xl border border-[#E6D5BF] bg-[#FCF8F2] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#4E382B] flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5 text-[#B84A27]" />
                    Imagen sin fondo (Galería Oficial, Escritorio o Link)
                  </label>
                  {draft.customImageUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, customImageUrl: '' }));
                        setDriveDetected(false);
                      }}
                      className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 cursor-pointer"
                    >
                      Quitar imagen y usar ilustración
                    </button>
                  ) : null}
                </div>

                {/* Galería Oficial Sin Fondo (9 PNGs Royal Prestige) */}
                <div>
                  <p className="text-[11px] font-semibold text-[#6E5341] mb-1.5">
                    Galería Oficial Sin Fondo (9 PNGs Royal Prestige)
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {OFFICIAL_ROYAL_PNG_GALLERY.map((item) => {
                      const isSelected = draft.customImageUrl === item.url;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setDriveDetected(false);
                            setDraft((prev) => ({
                              ...prev,
                              customImageUrl: item.url,
                              visualKey: item.visualKey,
                              accentColor: item.accentColor,
                            }));
                          }}
                          className={`group/png flex flex-col items-center gap-1 rounded-xl border p-1.5 text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#C88A2B] bg-amber-50/80 ring-2 ring-[#C88A2B]/30 shadow-sm'
                              : 'border-[#E6D5BF] bg-white hover:bg-[#FAF3E8]'
                          }`}
                        >
                          <div
                            className="relative flex h-11 w-full items-center justify-center rounded-lg overflow-hidden"
                            style={{ background: activeShowcaseTokens.miniStageBg }}
                          >
                            <img
                              src={item.url}
                              alt={item.label}
                              draggable={false}
                              className="h-9 w-9 object-contain bg-transparent select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover/png:scale-110"
                            />
                            {isSelected && (
                              <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#E5AE4E] text-[#1E110A]">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <span className="text-[9.5px] font-semibold text-[#4E382B] leading-tight line-clamp-2">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2.5 items-center pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setErrorMsg(null);
                      setUploadingImage(true);
                      try {
                        const dataUrl = await compressImageFile(file);
                        setDraft((prev) => ({ ...prev, customImageUrl: dataUrl }));
                        setDriveDetected(false);
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : 'No se pudo cargar la imagen.');
                      } finally {
                        setUploadingImage(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFCBB3] bg-white px-3.5 py-2 text-xs font-semibold text-[#4E382B] hover:bg-[#F5E9D6] transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#B84A27]" />
                    {uploadingImage ? 'Procesando...' : 'Subir desde escritorio'}
                  </button>

                  <div className="relative">
                    <Link2 className="w-3.5 h-3.5 text-[#8A6D5B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={draft.customImageUrl?.startsWith('data:') ? '' : draft.customImageUrl || ''}
                      onChange={(e) => {
                        const { url, isDrive } = normalizeImageUrl(e.target.value);
                        setDriveDetected(isDrive);
                        setDraft((prev) => ({ ...prev, customImageUrl: url }));
                      }}
                      placeholder="Pega enlace de Google Drive o URL directa (https://...)"
                      className="w-full rounded-xl border border-[#DFCBB3] bg-white pl-8 pr-3 py-2 text-xs focus:border-[#B84A27] focus:outline-none"
                    />
                  </div>
                </div>

                {draft.customImageUrl?.startsWith('data:') ? (
                  <p className="text-[11px] font-medium text-emerald-700">
                    Imagen local cargada desde tu equipo y optimizada para la base lumínica.
                  </p>
                ) : driveDetected ? (
                  <p className="text-[11px] font-medium text-amber-800">
                    Enlace de Google Drive convertido automáticamente para vista directa (asegúrate de que el archivo esté compartido como “Cualquier persona con el enlace”).
                  </p>
                ) : (
                  <p className="text-[11px] text-[#7D6353]">
                    Selecciona un producto oficial sin fondo arriba, sube un PNG transparente o pega un enlace web/Drive.
                  </p>
                )}
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-2">
                  Ilustración de cocina (respaldo o predeterminada)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {GIFT_VISUAL_OPTIONS.map((opt) => {
                    const selected = draft.visualKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            visualKey: opt.key as GiftVisualKey,
                            accentColor: opt.defaultColor,
                          }))
                        }
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-all cursor-pointer ${
                          selected
                            ? 'border-[#B84A27] bg-amber-50/70 ring-2 ring-[#B84A27]/20'
                            : 'border-[#E6D5BF] bg-white hover:bg-[#FAF3E8]'
                        }`}
                      >
                        <GiftIllustration visualKey={opt.key} accentColor={opt.defaultColor} size={34} />
                        <span className="text-[10px] font-semibold text-[#4E382B] leading-tight">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Disponibilidad</label>
                <input
                  type="text"
                  value={draft.stockLabel}
                  onChange={(e) => setDraft((prev) => ({ ...prev, stockLabel: e.target.value }))}
                  placeholder="Ej. Edición Limitada"
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-xs focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>

              {/* Accent Color & Active Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1.5">Color del regalo (Temático o libre)</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, accentColor: preset.color }))}
                        title={preset.name}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow cursor-pointer"
                        style={{
                          backgroundColor: preset.color,
                          outline: draft.accentColor === preset.color ? `2px solid ${preset.color}` : 'none',
                        }}
                      >
                        {draft.accentColor === preset.color && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    ))}
                    <label
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FCF8F2] px-2.5 py-1 text-[11px] font-semibold text-[#4E382B] cursor-pointer hover:bg-white"
                      title="Selector de color libre"
                    >
                      <input
                        type="color"
                        value={draft.accentColor || '#C88A2B'}
                        onChange={(e) => setDraft((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span>Libre</span>
                    </label>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2.5 rounded-xl bg-[#FAF3E8] border border-[#E6D5BF] px-3.5 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 accent-[#3D6B52]"
                  />
                  <span className="text-xs font-semibold text-[#22150E]">Visible en tarjetas ocultas</span>
                </label>
              </div>

              {errorMsg && <p className="text-xs font-semibold text-red-600">{errorMsg}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EFE3D2]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#22150E] px-5 py-2.5 text-xs font-semibold text-[#FAF3E8] hover:bg-[#3A2418] cursor-pointer"
                >
                  {editingGiftId ? 'Guardar cambios' : 'Crear regalo'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
