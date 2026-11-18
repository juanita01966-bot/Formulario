import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Check, Edit3, Eye, EyeOff, ImagePlus, Link2, Palette, Plus, RotateCcw, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type { GiftItem, GiftThemeId, GiftVisualKey } from '../../types/app';
import { GIFT_THEME_PRESETS, resolveBoxPalette } from '../../shared/giftThemes';
import { GIFT_VISUAL_OPTIONS, GiftIllustration } from '../gifts/GiftIllustration';
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
  onUpdateGiftTheme?: (giftTheme: GiftThemeId, customBoxColor?: string) => Promise<void>;
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
  const shadowScaleX = useTransform(floatDriver, [0, 1], [1, 0.76]);
  const shadowScaleY = useTransform(floatDriver, [0, 1], [1, 0.8]);
  const shadowOpacity = useTransform(floatDriver, [0, 1], [0.38, 0.16]);
  const auraScale = useTransform(floatDriver, [0, 1], [0.96, 1.1]);

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
        {/* HD 3D Floating Studio Showcase Pedestal Stage */}
        <div
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          className={`relative h-40 sm:h-44 w-full overflow-hidden rounded-2xl border perspective-1000 flex flex-col items-center justify-center ${
            gift.active
              ? 'border-[#DFC9AB] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-14px_26px_rgba(140,74,25,0.1)]'
              : 'border-stone-200 bg-stone-100/80'
          }`}
          style={{
            background: gift.active
              ? `radial-gradient(110% 85% at 50% 24%, #FFFDF9 0%, #FBF0DF 48%, #EFE0CB 100%)`
              : 'radial-gradient(circle at 50% 45%, rgba(168,162,158,0.18), #F5F5F4 75%)',
          }}
        >
          {/* Dimensional boutique vitrine backdrop: accent radial bloom + perspective horizon + halo rings */}
          {gift.active && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 50% 44%, ${accent}2A 0%, ${accent}0D 42%, transparent 72%)`,
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -left-8 h-48 w-24 rotate-[26deg] bg-gradient-to-r from-transparent via-white/55 to-transparent blur-sm"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#DFC9AB]/45 via-[#EAD8BE]/20 to-transparent border-t border-white/50"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[54%] h-28 w-28 rounded-full border border-[#C88A2B]/20"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[54%] h-36 w-36 rounded-full border border-dashed border-[#C88A2B]/15"
              />
            </>
          )}

          {/* Interactive cursor radial spotlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-200"
            style={{
              opacity: spotlight.active ? 1 : 0,
              background: `radial-gradient(200px circle at ${spotlight.x}% ${spotlight.y}%, rgba(255, 255, 255, 0.72), ${accent}1F 48%, transparent 74%)`,
            }}
          />

          {/* Top studio light specular line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
          />

          {/* Top-right floating Active/Hidden toggle */}
          <div className="absolute top-2.5 right-2.5 z-20">
            <button
              type="button"
              onClick={() => onToggleActive(gift)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer backdrop-blur-md transition-all shadow-sm ${
                gift.active
                  ? 'bg-emerald-50/95 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-stone-200/95 text-stone-600 border border-stone-300 hover:bg-stone-300'
              }`}
            >
              {gift.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {gift.active ? 'Activo' : 'Oculto'}
            </button>
          </div>

          {/* Ambient glowing aura synced with float */}
          <motion.div
            aria-hidden="true"
            style={{
              scale: auraScale,
              background: `radial-gradient(circle, ${accent}38 0%, transparent 70%)`,
            }}
            className="pointer-events-none absolute top-4 h-28 w-28 rounded-full blur-xl will-change-transform"
          />

          {/* Floating Gift Illustration / HD Photo with 3D Interactive Tilt */}
          <motion.div
            style={{ y: giftY }}
            className="relative z-10 flex items-center justify-center will-change-transform"
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
                size={94}
              />
            </div>
          </motion.div>

          {/* Translucent Glass Pedestal Disc & Synchronized Oval Ground Shadow */}
          <div className="relative z-0 -mt-1 flex flex-col items-center justify-center">
            <motion.div
              aria-hidden="true"
              style={{
                scaleX: shadowScaleX,
                scaleY: shadowScaleY,
                opacity: shadowOpacity,
              }}
              className="relative z-10 h-3 w-24 rounded-full bg-gradient-to-r from-transparent via-[#22150E]/75 to-transparent blur-[3px] will-change-transform"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none -mt-2 h-4 w-32 rounded-full border border-white/85 bg-white/50 backdrop-blur-sm shadow-[0_8px_18px_-6px_rgba(34,21,14,0.16),inset_0_1px_0_rgba(255,255,255,0.95)]"
            />
          </div>
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
  onUpdateGiftTheme,
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
      tag: gift.tag,
      visualKey: gift.visualKey,
      customImageUrl: gift.customImageUrl || '',
      accentColor: gift.accentColor,
      active: gift.active,
      stockLabel: gift.stockLabel,
    });
    setErrorMsg(null);
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

  const previewPalette = resolveBoxPalette(giftTheme, customBoxColor, 0);

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
                  Confirmar restaurar 5 originales
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

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <AnimatePresence mode="popLayout">
            {gifts.map((gift, idx) => (
              <GiftCatalogCard
                key={gift.id}
                gift={gift}
                index={idx}
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

              {/* Live Floating Studio Preview Strip */}
              <div
                className="flex items-center gap-4 rounded-2xl border border-[#E6D5BF] p-3.5 shadow-inner"
                style={{
                  background: `radial-gradient(circle at 14% 50%, ${draft.accentColor || '#C88A2B'}22, #FAF3E8 55%)`,
                }}
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/80 border border-white shadow-[0_10px_24px_-10px_rgba(34,21,14,0.2)]">
                  <GiftIllustration
                    visualKey={draft.visualKey}
                    customImageUrl={draft.customImageUrl}
                    accentColor={draft.accentColor}
                    size={56}
                    floating
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C4A19]">
                    {draft.tag || 'Edición Otoño'}
                  </p>
                  <p className="font-serif text-base font-bold text-[#22150E] truncate">
                    {draft.name || 'Vista previa del regalo'}
                  </p>
                  <p className="text-xs text-[#6E5341] truncate">
                    {draft.subtitle || 'Descripción visible cuando se abra la caja.'}
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

              {/* Image source selector: Desktop upload, Google Drive / Link, or SVG preset */}
              <div className="rounded-2xl border border-[#E6D5BF] bg-[#FCF8F2] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#4E382B] flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5 text-[#B84A27]" />
                    Imagen del regalo (Escritorio, Google Drive o Link)
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

                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2.5 items-center">
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
                    Imagen local cargada desde tu equipo y optimizada para la ruleta 3D.
                  </p>
                ) : driveDetected ? (
                  <p className="text-[11px] font-medium text-amber-800">
                    Enlace de Google Drive convertido automáticamente para vista directa (asegúrate de que el archivo esté compartido como “Cualquier persona con el enlace”).
                  </p>
                ) : (
                  <p className="text-[11px] text-[#7D6353]">
                    Opcional: si subes una foto o pegas un enlace de Drive/Web, reemplazará a la ilustración SVG.
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
