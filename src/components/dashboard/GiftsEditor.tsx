import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  Gift,
  ImagePlus,
  Link2,
  Palette,
  Percent,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { GiftItem, GiftThemeId, GiftVisualKey, ShowcaseStyleId, UserRole } from '../../types/app';
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
import { SecretKeyModal } from './SecretKeyModal';
import { getRoleTheme } from './roleTheme';

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

type GiftWithProbability = GiftItem & { probability?: number };
type UpsertGiftWithProbability = UpsertGiftPayload & { probability?: number };

function sanitizeProbabilityValue(raw: unknown, fallback = 10): number {
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.round(num * 100) / 100;
}

function getGiftProbability(gift: GiftItem): number {
  const raw = (gift as GiftWithProbability).probability;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? Math.round(raw * 100) / 100
    : 10;
}

function parseWeightInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}

function formatWeightNumber(value: number): string {
  const clean = Math.round(value * 100) / 100;
  return Number.isInteger(clean) ? String(clean) : String(Number(clean.toFixed(2)));
}

function formatProbabilityPercent(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%';
  if (pct >= 99.95) return '100%';
  return `${pct.toFixed(1)}%`;
}

interface GiftsEditorProps {
  gifts: GiftItem[];
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  showcaseStyle?: ShowcaseStyleId;
  randomizeGifts?: boolean;
  userRole?: UserRole;
  onUpdateGiftTheme?: (
    giftTheme: GiftThemeId,
    customBoxColor: string | undefined,
    masterPassword: string
  ) => Promise<void>;
  onUpdateShowcaseSettings?: (
    updates: {
      showcaseStyle?: ShowcaseStyleId;
      randomizeGifts?: boolean;
    },
    masterPassword: string
  ) => Promise<void>;
  onCreateGift: (payload: UpsertGiftWithProbability, masterPassword: string) => Promise<void>;
  onUpdateGift: (
    id: string,
    updates: Partial<UpsertGiftWithProbability>,
    masterPassword: string
  ) => Promise<void>;
  onSaveGiftProbabilities?: (
    updates: Array<{ id: string; probability: number }>,
    masterPassword: string
  ) => Promise<void>;
  onDeleteGift: (id: string, masterPassword: string) => Promise<void>;
  onResetGifts: (masterPassword: string) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

const ACCENT_PRESETS = [
  { color: '#C88A2B', name: 'Ámbar Dorado' },
  { color: '#B84A27', name: 'Terracota' },
  { color: '#8C3B20', name: 'Castaño Otoño' },
  { color: '#4B644A', name: 'Salvia Bosque' },
  { color: '#A66328', name: 'Bambú Tostado' },
  { color: '#261810', name: 'Nogal Oscuro' },
];

const EMPTY_DRAFT: UpsertGiftWithProbability = {
  name: '',
  subtitle: '',
  usageTip: '',
  tag: 'Edición Otoño',
  visualKey: 'skillet',
  customImageUrl: '',
  accentColor: '#C88A2B',
  active: true,
  stockLabel: 'Disponible',
  probability: 11.1,
};

interface GiftCatalogCardProps {
  gift: GiftItem;
  index: number;
  weight: number;
  effectivePercent: number;
  showcaseStyle?: ShowcaseStyleId;
  confirmDeleteId: string | null;
  onToggleActive: (gift: GiftItem) => void;
  onSaveCardProbability: (giftId: string, probability: number) => Promise<boolean>;
  onEdit: (gift: GiftItem) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

const GiftCatalogCard: React.FC<GiftCatalogCardProps> = ({
  gift,
  index,
  weight,
  effectivePercent,
  showcaseStyle = 'luminous-gold',
  confirmDeleteId,
  onToggleActive,
  onSaveCardProbability,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) => {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [spotlight, setSpotlight] = useState({ x: 50, y: 40, active: false });
  const [editingInlineProb, setEditingInlineProb] = useState(false);
  const [inlineProbInput, setInlineProbInput] = useState(() => String(weight));
  const [savingInlineProb, setSavingInlineProb] = useState(false);
  const [inlineProbSaved, setInlineProbSaved] = useState(false);

  useEffect(() => {
    if (!editingInlineProb) {
      setInlineProbInput(String(weight));
    }
  }, [weight, editingInlineProb]);

  const handleInlineProbSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingInlineProb) return;
    const nextProb = parseWeightInput(inlineProbInput);
    setSavingInlineProb(true);
    try {
      const savedOk = await onSaveCardProbability(gift.id, nextProb);
      if (savedOk) {
        setEditingInlineProb(false);
        setInlineProbSaved(true);
        window.setTimeout(() => setInlineProbSaved(false), 2200);
      }
    } catch {
      // Error banner handled by parent GiftsEditor / SecretKeyModal
    } finally {
      setSavingInlineProb(false);
    }
  };

  // Synchronized 60 FPS GPU floating loop & breathing oval ground shadow
  const floatDriver = useMotionValue(0);
  const giftY = useTransform(floatDriver, [0, 1], [2, -11]);
  const shadowScaleX = useTransform(floatDriver, [0, 1], [1.04, 0.64]);
  const shadowScaleY = useTransform(floatDriver, [0, 1], [1, 0.68]);
  const shadowOpacity = useTransform(floatDriver, [0, 1], [0.76, 0.24]);
  const auraScale = useTransform(floatDriver, [0, 1], [0.95, 1.12]);
  const auraOpacity = useTransform(floatDriver, [0, 1], [0.65, 0.96]);

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
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      data-dsb-card={!gift.active ? 'locked' : undefined}
      className={`group/card relative rounded-[24px] border p-3.5 sm:p-4 flex flex-col justify-between backdrop-blur-lg transition-all duration-200 ${
        gift.active
          ? 'dsb-glass-subtle bg-white/72 hover:-translate-y-1 hover:bg-white/86 hover:border-[#C88A2B]/60 hover:shadow-[0_20px_38px_-14px_rgba(139,0,24,0.16)]'
          : 'border-stone-200/80 bg-stone-50/65 opacity-80'
      }`}
    >
      <div>
        {/* Miniature Realistic Showroom Plinth Stage */}
        <div
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          className={`relative h-32 sm:h-36 w-full overflow-hidden rounded-2xl border perspective-1000 flex flex-col items-center justify-end pb-2.5 pt-3 ${
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
              className={`inline-flex min-h-[38px] sm:min-h-[30px] items-center gap-1 rounded-full px-3 py-1.5 sm:py-1 text-[11px] font-bold cursor-pointer backdrop-blur-xs sm:backdrop-blur-md transition-all shadow-sm ${
                gift.active
                  ? 'bg-emerald-950/85 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-900'
                  : 'bg-stone-900/90 text-stone-300 border border-stone-500/40 hover:bg-stone-800'
              }`}
            >
              {gift.active ? <Eye className="h-3.5 w-3.5 sm:h-3 sm:w-3" /> : <EyeOff className="h-3.5 w-3.5 sm:h-3 sm:w-3" />}
              {gift.active ? 'Activo' : 'Oculto'}
            </button>
          </div>

          {/* Soft overhead gallery key-light behind product (pure radial gradient for 60 FPS mobile) */}
          {gift.active && (
            <motion.div
              aria-hidden="true"
              style={{
                scale: auraScale,
                opacity: auraOpacity,
                background: `radial-gradient(ellipse at 50% 44%, ${tokens.auraCore} 0%, ${accent}24 44%, transparent 72%)`,
              }}
              className="pointer-events-none absolute top-2 h-36 w-40 rounded-full will-change-transform"
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                style={{ backgroundColor: accent }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C4A19] truncate">
                {gift.tag}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                !gift.active
                  ? 'border-stone-200 bg-stone-100 text-stone-600'
                  : weight === 0
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-[#E6C99E] bg-[#FAF0E0] text-[#8C4A19]'
              }`}
              title={`Peso configurado: ${formatWeightNumber(weight)}`}
            >
              {!gift.active
                ? 'Inactivo · 0%'
                : weight === 0
                  ? '0% · Sin sorteo'
                  : `${formatProbabilityPercent(effectivePercent)} · p:${formatWeightNumber(weight)}`}
            </span>
          </div>
          <h3 className="mt-1 font-serif text-base sm:text-lg font-bold text-[#22150E] leading-snug">
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

      <div className="mt-3.5 sm:mt-4 pt-3 border-t border-[#EFE3D2] space-y-2.5">
        {editingInlineProb ? (
          <form onSubmit={handleInlineProbSubmit} className="flex flex-wrap items-center gap-1.5">
            <label
              htmlFor={`card-prob-${gift.id}`}
              className="w-full sm:w-auto text-[11px] font-bold text-[#8C4A19] sm:mr-auto"
            >
              Probabilidad / Peso (%):
            </label>
            <input
              id={`card-prob-${gift.id}`}
              type="number"
              min={0}
              step="0.1"
              autoFocus
              disabled={savingInlineProb}
              value={inlineProbInput}
              onChange={(e) => setInlineProbInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingInlineProb(false);
                  setInlineProbInput(String(weight));
                }
              }}
              className="flex-1 sm:flex-none min-w-[72px] sm:w-20 min-h-[42px] sm:min-h-[34px] rounded-xl sm:rounded-lg border border-[#C88A2B] bg-white px-2.5 py-1 text-right font-mono text-base sm:text-xs font-bold text-[#22150E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#C88A2B]/30"
            />
            <button
              type="submit"
              disabled={savingInlineProb}
              aria-label={`Guardar probabilidad de ${gift.name}`}
              className="inline-flex min-h-[42px] sm:min-h-[34px] items-center justify-center gap-1 rounded-xl sm:rounded-lg bg-[#22150E] px-3 py-1.5 text-xs font-semibold text-[#F4CA73] hover:bg-[#3A2418] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{savingInlineProb ? '...' : 'Guardar'}</span>
            </button>
            <button
              type="button"
              disabled={savingInlineProb}
              onClick={() => {
                setEditingInlineProb(false);
                setInlineProbInput(String(weight));
              }}
              aria-label="Cancelar edición de porcentaje"
              className="inline-flex min-h-[42px] min-w-[42px] sm:min-h-[34px] sm:min-w-[34px] shrink-0 items-center justify-center rounded-xl sm:rounded-lg border border-[#E6D5BF] bg-white text-[#6E5341] hover:bg-[#FAF3E8] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-medium text-[#8B6F5B] truncate">{gift.stockLabel}</span>
              {inlineProbSaved && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                  <Check className="h-2.5 w-2.5" />
                  Guardado
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInlineProbInput(String(weight));
                  setEditingInlineProb(true);
                }}
                title={`Editar probabilidad / peso (${formatWeightNumber(weight)}%)`}
                aria-label={`Editar probabilidad de ${gift.name}: ${formatWeightNumber(weight)}%`}
                className="inline-flex flex-1 sm:flex-none min-h-[40px] sm:min-h-[34px] items-center justify-center gap-1 rounded-xl sm:rounded-lg border border-[#E6C99E] bg-[#FAF0E0] px-2.5 py-1.5 text-xs font-bold text-[#8C4A19] hover:bg-[#F3DFC0] transition-colors cursor-pointer tabular-nums"
              >
                <Percent className="h-3 w-3 shrink-0 text-[#B84A27]" />
                <span>{formatWeightNumber(weight)}%</span>
              </button>

              <button
                type="button"
                onClick={() => onEdit(gift)}
                className="inline-flex flex-1 sm:flex-none min-h-[40px] sm:min-h-[34px] items-center justify-center gap-1.5 rounded-xl sm:rounded-lg border border-[#E6D5BF] bg-[#FAF3E8] px-3 sm:px-2.5 py-1.5 text-xs font-semibold text-[#22150E] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#B84A27] shrink-0" />
                Editar
              </button>

              {confirmDeleteId === gift.id ? (
                <div className="inline-flex min-h-[40px] sm:min-h-[34px] shrink-0 items-center gap-2 rounded-xl sm:rounded-lg bg-red-50 border border-red-200 px-3 sm:px-2.5 py-1.5 text-xs sm:text-[11px]">
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
                  className="inline-flex min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] shrink-0 items-center justify-center rounded-xl sm:rounded-lg p-2 sm:p-1.5 text-[#A48A77] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                  title="Eliminar regalo"
                  aria-label={`Eliminar ${gift.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
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
  userRole = 'admin',
  onUpdateGiftTheme,
  onUpdateShowcaseSettings,
  onCreateGift,
  onUpdateGift,
  onSaveGiftProbabilities: _onSaveGiftProbabilities,
  onDeleteGift,
  onResetGifts,
  onBusyChange,
}) => {
  const isAiManager = userRole === 'ai_manager';
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'aesthetics' | 'raffle'>('catalog');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpsertGiftWithProbability>(EMPTY_DRAFT);
  const [modalWeightInput, setModalWeightInput] = useState('11.1');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingShowcase, setSavingShowcase] = useState(false);
  const [driveDetected, setDriveDetected] = useState(false);
  const [customColorDraft, setCustomColorDraft] = useState(customBoxColor || '#B84A27');
  const [pendingSecretAction, setPendingSecretAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: (masterPassword: string) => Promise<void>;
    onCancel?: () => void;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCustomColorDraft(customBoxColor || '#B84A27');
  }, [customBoxColor]);

  useEffect(() => {
    onBusyChange?.(modalOpen || savingShowcase || Boolean(pendingSecretAction));
    return () => onBusyChange?.(false);
  }, [modalOpen, savingShowcase, pendingSecretAction, onBusyChange]);

  const requestSecretAuth = (
    title: string,
    description: string,
    confirmLabel: string,
    run: (masterPassword: string) => Promise<void>,
    onCancel?: () => void,
    allowInstantForAi = true
  ) => {
    setErrorMsg(null);
    if (isAiManager && allowInstantForAi) {
      void run('').catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo completar el cambio.');
        onCancel?.();
      });
      return;
    }
    setPendingSecretAction({ title, description, confirmLabel, run, onCancel });
  };

  const previewUid = useId().replace(/:/g, '');
  const activeCount = gifts.filter((g) => g.active).length;

  let totalActiveWeight = 0;
  for (const gift of gifts) {
    if (gift.active) {
      totalActiveWeight += getGiftProbability(gift);
    }
  }

  const handleQuickSaveCardProbability = (giftId: string, probability: number): Promise<boolean> => {
    const targetGift = gifts.find((g) => g.id === giftId);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      requestSecretAuth(
        'Actualizar probabilidad del regalo',
        `Ingresa tu contraseña de Administrador para guardar la nueva probabilidad (${probability}%) de "${targetGift?.name || 'este regalo'}".`,
        'Autorizar y guardar',
        async (masterPassword) => {
          await onUpdateGift(giftId, { probability }, masterPassword);
          finish(true);
        },
        () => finish(false)
      );
    });
  };

  const openCreateModal = () => {
    setEditingGiftId(null);
    setDraft(EMPTY_DRAFT);
    setModalWeightInput(String(EMPTY_DRAFT.probability ?? 11.1));
    setErrorMsg(null);
    setDriveDetected(false);
    setModalOpen(true);
  };

  const openEditModal = (gift: GiftItem) => {
    const effectiveWeight = getGiftProbability(gift);
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
      probability: effectiveWeight,
    });
    setModalWeightInput(String(effectiveWeight));
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

    const sanitizedPayload: UpsertGiftWithProbability = {
      ...draft,
      probability: sanitizeProbabilityValue(modalWeightInput, draft.probability ?? 10),
    };

    const currentEditingId = editingGiftId;
    requestSecretAuth(
      currentEditingId ? 'Guardar cambios del regalo' : 'Crear nuevo regalo',
      `Ingresa tu contraseña de Administrador para ${currentEditingId ? 'actualizar' : 'añadir'} "${sanitizedPayload.name.trim()}" en el catálogo.`,
      currentEditingId ? 'Autorizar y guardar' : 'Autorizar y crear',
      async (masterPassword) => {
        if (currentEditingId) {
          await onUpdateGift(currentEditingId, sanitizedPayload, masterPassword);
        } else {
          await onCreateGift(sanitizedPayload, masterPassword);
        }
        setModalOpen(false);
      }
    );
  };

  const handleToggleActive = async (gift: GiftItem) => {
    requestSecretAuth(
      gift.active ? 'Ocultar regalo del sorteo' : 'Activar regalo en el sorteo',
      `Ingresa tu contraseña de Administrador para cambiar el estado de "${gift.name}".`,
      'Autorizar cambio',
      async (masterPassword) => {
        await onUpdateGift(gift.id, { active: !gift.active }, masterPassword);
      }
    );
  };

  const handleDelete = async (id: string) => {
    const targetGift = gifts.find((g) => g.id === id);
    requestSecretAuth(
      'Eliminar regalo del catálogo',
      isAiManager
        ? `Confirma para eliminar "${targetGift?.name || 'este regalo'}" del catálogo (AI Manager · Sin contraseña).`
        : `Ingresa tu contraseña de Administrador para eliminar "${targetGift?.name || 'este regalo'}".`,
      'Autorizar y eliminar',
      async (masterPassword) => {
        await onDeleteGift(id, masterPassword);
        setConfirmDeleteId(null);
      },
      undefined,
      false
    );
  };

  const handleShowcaseUpdate = async (updates: {
    showcaseStyle?: ShowcaseStyleId;
    randomizeGifts?: boolean;
  }) => {
    if (!onUpdateShowcaseSettings || savingShowcase) return;
    requestSecretAuth(
      'Actualizar configuración de vitrina',
      'Ingresa tu contraseña de Administrador para aplicar el cambio de visualización o sorteo.',
      'Autorizar cambio',
      async (masterPassword) => {
        setSavingShowcase(true);
        try {
          await onUpdateShowcaseSettings(updates, masterPassword);
        } finally {
          setSavingShowcase(false);
        }
      }
    );
  };

  const handleRequestThemeUpdate = (nextTheme: GiftThemeId, nextColor?: string) => {
    if (!onUpdateGiftTheme) return;
    requestSecretAuth(
      'Cambiar temática de cajas 3D',
      'Ingresa tu contraseña de Administrador para guardar la nueva temática o color de las cajas 3D.',
      'Autorizar y aplicar',
      async (masterPassword) => {
        await onUpdateGiftTheme(nextTheme, nextColor, masterPassword);
      }
    );
  };

  const previewPalette = resolveBoxPalette(giftTheme, customBoxColor, 0);
  const activeShowcaseTokens = resolveShowcaseTokens(showcaseStyle);

  // Live preview % inside the Create / Edit Modal
  const modalWeightNumber = parseWeightInput(modalWeightInput);
  const otherActiveWeightSum = gifts.reduce((sum, g) => {
    if (editingGiftId && g.id === editingGiftId) return sum;
    if (!g.active) return sum;
    return sum + getGiftProbability(g);
  }, 0);
  const modalTotalActiveWeight = otherActiveWeightSum + (draft.active ? modalWeightNumber : 0);
  const modalEffectivePercent =
    draft.active && modalTotalActiveWeight > 0
      ? (modalWeightNumber / modalTotalActiveWeight) * 100
      : 0;

  const adminTheme = getRoleTheme(userRole);

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden dsb-glass rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: adminTheme.headerStrip }}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">
                Catálogo de Regalos de Cocina
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/75 border border-[#8B0018]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#8B0018]">
                <Sparkles className="h-3 w-3 text-[#B91C1C] shrink-0" />
                {activeCount} {activeCount === 1 ? 'activo' : 'activos'}
              </span>
            </div>
            <p className="text-xs text-[#594133]">
              Añade, edita, oculta o ajusta probabilidades y estética de las 9 cajas doradas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            {confirmReset ? (
              <div className="inline-flex min-h-[40px] w-full sm:w-auto flex-wrap items-center justify-center gap-2 rounded-2xl sm:rounded-full bg-amber-50 border border-amber-300 px-3.5 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    requestSecretAuth(
                      'Restaurar 9 regalos oficiales',
                      isAiManager
                        ? 'Confirma para restaurar el catálogo original de 9 regalos Royal Prestige (AI Manager · Sin contraseña).'
                        : 'Ingresa tu contraseña de Administrador para restaurar el catálogo original de 9 regalos Royal Prestige.',
                      'Autorizar y restaurar',
                      async (masterPassword) => {
                        await onResetGifts(masterPassword);
                        setConfirmReset(false);
                      },
                      undefined,
                      false
                    );
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
                className="inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FAF3E8] px-3.5 py-1.5 text-xs font-semibold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                Restaurar base
              </button>
            )}

            <button
              type="button"
              onClick={openCreateModal}
              style={{ background: adminTheme.heroGradient }}
              className="inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Añadir regalo
            </button>
          </div>
        </div>

        {/* 3 Instant Sub-Tabs: Catálogo y Probabilidades | Estética Cajas 3D | Sorteo y Orden */}
        <div
          role="tablist"
          aria-label="Secciones del editor de regalos"
          className="mt-3.5 dsb-glass-subtle grid grid-cols-3 sm:inline-flex gap-1 w-full sm:w-auto rounded-2xl p-1 border"
          style={{ borderColor: adminTheme.borderTint }}
        >
          {(
            [
              { id: 'catalog', label: 'Catálogo y Probabilidades', mobileLabel: 'Catálogo', icon: Gift },
              { id: 'aesthetics', label: 'Estética Cajas 3D', mobileLabel: 'Cajas 3D', icon: Palette },
              { id: 'raffle', label: 'Sorteo y Orden', mobileLabel: 'Sorteo', icon: Shuffle },
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
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="mt-3.5 rounded-xl bg-red-50/90 backdrop-blur-sm border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Sub-tab 1: Catálogo y Probabilidades (DEFAULT) */}
        {activeSubTab === 'catalog' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
            <AnimatePresence>
              {gifts.map((gift, idx) => {
                const weight = getGiftProbability(gift);
                const effectivePercent =
                  gift.active && totalActiveWeight > 0 ? (weight / totalActiveWeight) * 100 : 0;
                return (
                  <GiftCatalogCard
                    key={gift.id}
                    gift={gift}
                    index={idx}
                    weight={weight}
                    effectivePercent={effectivePercent}
                    showcaseStyle={showcaseStyle}
                    confirmDeleteId={confirmDeleteId}
                    onToggleActive={handleToggleActive}
                    onSaveCardProbability={handleQuickSaveCardProbability}
                    onEdit={openEditModal}
                    onRequestDelete={(id) => setConfirmDeleteId(id)}
                    onConfirmDelete={handleDelete}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Sub-tab 2: Estética Cajas 3D */}
        {activeSubTab === 'aesthetics' && (
          <div className="mt-4 space-y-4">
        {/* Thematic & Custom Color Selector for 3D Gift Boxes */}
        <div className="dsb-glass-subtle rounded-2xl p-3.5 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
              {/* Live Floating 3D Box Mini Preview */}
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-[#2A160D] to-[#160B06] border border-[#C88A2B]/45 p-1.5 shadow-[inset_0_1px_0_rgba(254,240,138,0.28),0_10px_20px_-8px_rgba(34,21,14,0.45)]">
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
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Palette className="h-4 w-4 text-[#B84A27] shrink-0" />
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
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2.5 w-full lg:w-auto rounded-xl border border-[#DFCBB3] bg-white px-3 py-2 min-h-[44px]">
              <div className="flex items-center gap-2.5">
                <label className="text-xs font-semibold text-[#4E382B] whitespace-nowrap">
                  Color libre:
                </label>
                <input
                  type="color"
                  data-preserve-surface="true"
                  value={customColorDraft}
                  onChange={(e) => {
                    setCustomColorDraft(e.target.value);
                  }}
                  className="h-8 w-10 cursor-pointer rounded border border-[#DFCBB3] bg-transparent p-0.5"
                  title="Elegir color personalizado para las cajas 3D"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRequestThemeUpdate('custom', customColorDraft)}
                className={`min-h-[38px] sm:min-h-[32px] rounded-lg px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  giftTheme === 'custom'
                    ? 'bg-[#22150E] text-[#F4CA73]'
                    : 'bg-[#FAF3E8] text-[#594133] hover:bg-[#EFE2D0]'
                }`}
              >
                {giftTheme === 'custom' ? 'Aplicar color' : 'Usar color'}
              </button>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {GIFT_THEME_PRESETS.map((theme) => {
              const active = giftTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleRequestThemeUpdate(theme.id, customColorDraft)}
                  className={`flex min-h-[72px] flex-col justify-between rounded-xl border p-2.5 sm:p-3 text-left transition-all cursor-pointer ${
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

        {/* Showcase Plinth Lighting Selector */}
        <div className="mt-4 dsb-glass-subtle rounded-2xl p-3.5 sm:p-5">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#C88A2B] shrink-0" />
              <h3 className="text-sm font-bold text-[#22150E]">
                Estilo de Vitrina Lumínica
              </h3>
            </div>
            <p className="text-xs text-[#6E5341] mt-0.5">
              Elige la iluminación de la base lumínica donde flotan los premios al destaparse.
            </p>
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
                  className={`flex min-h-[60px] items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer disabled:opacity-60 ${
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
          </div>
        )}

        {/* Sub-tab 3: Sorteo y Orden */}
        {activeSubTab === 'raffle' && (
          <div className="mt-4 space-y-4">
        {/* Selección Aleatoria Anti-Abuso */}
        <div className="dsb-glass-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                randomizeGifts ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
              }`}
            >
              <Shuffle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-[#22150E] leading-tight">
                Selección Aleatoria Anti-Abuso
              </p>
              <p className="text-[11px] text-[#6E5341] leading-snug mt-0.5">
                {randomizeGifts
                  ? 'Activa · Cada caja sortea según el % configurado en cada tarjeta'
                  : 'Desactivada · Orden fijo según catálogo'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={savingShowcase || !onUpdateShowcaseSettings}
            onClick={() => handleShowcaseUpdate({ randomizeGifts: !randomizeGifts })}
            className={`inline-flex min-h-[42px] sm:min-h-[36px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl sm:rounded-full border px-4 py-2 sm:py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60 ${
              randomizeGifts
                ? 'border-emerald-300 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                : 'border-[#DFCBB3] bg-white text-[#4E382B] hover:bg-[#FAF3E8]'
            }`}
          >
            {randomizeGifts ? 'ON · Aleatorio' : 'OFF · Fijo'}
          </button>
        </div>

        {/* Live Probability Weight Distribution Summary */}
        <div className="dsb-glass-subtle rounded-2xl p-3.5 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#22150E]">
                Distribución actual de probabilidades
              </h3>
              <p className="text-xs text-[#6E5341]">
                Peso total activo: <strong className="tabular-nums">{formatWeightNumber(totalActiveWeight)}</strong> · {activeCount} regalos participando
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('catalog')}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-[#DFCBB3] bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-[#594133] cursor-pointer"
            >
              Ajustar pesos en Catálogo
            </button>
          </div>
          <div className="space-y-2">
            {gifts.map((gift) => {
              const weight = getGiftProbability(gift);
              const pct = gift.active && totalActiveWeight > 0 ? (weight / totalActiveWeight) * 100 : 0;
              return (
                <div key={gift.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`font-semibold truncate ${gift.active ? 'text-[#22150E]' : 'text-stone-400 line-through'}`}>
                      {gift.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#8C4A19] tabular-nums shrink-0">
                      {gift.active ? `${formatProbabilityPercent(pct)} (p:${formatWeightNumber(weight)})` : 'Oculto · 0%'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/10">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%`,
                        background: gift.active ? adminTheme.progressGradient : '#a8a29e',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/60 backdrop-blur-xs sm:backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            onClick={() => setModalOpen(false)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveModal}
              className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] p-4 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFE3D2]">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#22150E]">
                  {editingGiftId ? 'Editar regalo de cocina' : 'Nuevo regalo de cocina'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Cerrar modal"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-1 text-[#7B5D4A] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Live Floating Luminous Base Preview Strip */}
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-[#DFCBB3] bg-[#FAF3E8]/70 p-3 sm:p-3.5 shadow-inner"
              >
                <div
                  className={`relative flex h-24 sm:h-28 w-full sm:w-28 shrink-0 flex-col items-center justify-end overflow-hidden rounded-2xl border pb-2 pt-2 ${activeShowcaseTokens.stageBorder} shadow-[0_12px_26px_-10px_rgba(15,8,4,0.55)]`}
                  style={{ background: activeShowcaseTokens.miniStageBg }}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-2 h-24 w-24 rounded-full opacity-80"
                    style={{
                      background: `radial-gradient(ellipse at 50% 45%, ${activeShowcaseTokens.auraCore} 0%, transparent 72%)`,
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
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1">Etiqueta de colección</label>
                  <input
                    type="text"
                    value={draft.tag}
                    onChange={(e) => setDraft((prev) => ({ ...prev, tag: e.target.value }))}
                    placeholder="Ej. Favorito del Chef"
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
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
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
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
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>

              {/* Weight / Probability Control inside Modal */}
              <div className="rounded-2xl border border-[#E6D5BF] bg-[#FAF4EA] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="modal-gift-probability"
                    className="text-xs font-bold text-[#4E382B] flex items-center gap-1.5"
                  >
                    <Percent className="w-3.5 h-3.5 text-[#B84A27]" />
                    Probabilidad / Peso en sorteo (9 Espacios)
                  </label>
                  <span className="rounded-full border border-[#E6C99E] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#8C4A19] tabular-nums">
                    {draft.active
                      ? `Efectiva: ${formatProbabilityPercent(modalEffectivePercent)}`
                      : 'Inactivo · 0%'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                  <input
                    type="range"
                    data-preserve-surface="true"
                    min={0}
                    max={Math.max(100, Math.ceil(modalWeightNumber / 25) * 25)}
                    step={0.1}
                    aria-label="Deslizador de probabilidad del regalo"
                    value={Math.min(
                      Math.max(100, Math.ceil(modalWeightNumber / 25) * 25),
                      modalWeightNumber
                    )}
                    onChange={(e) => {
                      const clean = Math.round(Number(e.target.value) * 10) / 10;
                      setModalWeightInput(String(clean));
                      setDraft((prev) => ({ ...prev, probability: clean }));
                    }}
                    className="w-full sm:flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-[#E6D5BF] accent-[#B84A27]"
                  />
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-[11px] font-semibold text-[#6E5341]">Peso:</span>
                    <input
                      id="modal-gift-probability"
                      type="number"
                      min={0}
                      step="0.1"
                      value={modalWeightInput}
                      onChange={(e) => {
                        setModalWeightInput(e.target.value);
                        setDraft((prev) => ({
                          ...prev,
                          probability: parseWeightInput(e.target.value),
                        }));
                      }}
                      className="w-24 min-h-[44px] sm:min-h-[36px] rounded-xl sm:rounded-lg border border-[#DFCBB3] bg-white px-2.5 py-1.5 text-right font-mono text-base sm:text-xs font-bold text-[#22150E] tabular-nums focus:border-[#B84A27] focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-[#7D6353]">
                  {modalWeightNumber === 0
                    ? 'Con peso 0 este regalo tendrá 0% de probabilidad (no saldrá en las 9 cajas).'
                    : 'Acepta valores de 0 a 100+ (con decimales). El % efectivo se calcula sobre la suma de regalos activos.'}
                </p>
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
                      className="min-h-[36px] text-[11px] font-semibold text-rose-700 hover:text-rose-800 cursor-pointer"
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
                          className={`group/png flex min-h-[68px] flex-col items-center gap-1 rounded-xl border p-1.5 text-center transition-all cursor-pointer ${
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
                              <span
                                data-preserve-surface="true"
                                className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#E5AE4E] text-[#1E110A]"
                              >
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
                    className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-2 rounded-xl border border-[#DFCBB3] bg-white px-3.5 py-2 text-xs font-semibold text-[#4E382B] hover:bg-[#F5E9D6] transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#B84A27]" />
                    {uploadingImage ? 'Procesando...' : 'Subir desde escritorio'}
                  </button>

                  <div className="relative min-w-0">
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
                      className="w-full min-h-[44px] sm:min-h-[38px] rounded-xl border border-[#DFCBB3] bg-white pl-8 pr-3 py-2 text-base sm:text-xs focus:border-[#B84A27] focus:outline-none"
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
                        className={`flex min-h-[60px] flex-col items-center gap-1 rounded-xl border p-2 text-center transition-all cursor-pointer ${
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
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2 text-base sm:text-xs focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>

              {/* Accent Color & Active Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-[#594133] mb-1.5">Color del regalo (Temático o libre)</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, accentColor: preset.color }))}
                        title={preset.name}
                        className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 border-white shadow cursor-pointer"
                        style={{
                          backgroundColor: preset.color,
                          outline: draft.accentColor === preset.color ? `2px solid ${preset.color}` : 'none',
                        }}
                      >
                        {draft.accentColor === preset.color && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    ))}
                    <label
                      className="inline-flex min-h-[36px] sm:min-h-0 items-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FCF8F2] px-2.5 py-1 text-[11px] font-semibold text-[#4E382B] cursor-pointer hover:bg-white"
                      title="Selector de color libre"
                    >
                      <input
                        type="color"
                        data-preserve-surface="true"
                        value={draft.accentColor || '#C88A2B'}
                        onChange={(e) => setDraft((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="h-5 w-5 sm:h-4 sm:w-4 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span>Libre</span>
                    </label>
                  </div>
                </div>

                <label className="inline-flex min-h-[44px] items-center gap-2.5 rounded-xl bg-[#FAF3E8] border border-[#E6D5BF] px-3.5 py-2 cursor-pointer">
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

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-[#EFE3D2]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] w-full sm:w-auto rounded-full px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-[#C88A2B]/45 bg-[#22150E] px-5 py-2.5 text-xs font-semibold text-[#FAF3E8] hover:bg-[#3A2418] cursor-pointer"
                >
                  {editingGiftId ? 'Guardar cambios' : 'Crear regalo'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <SecretKeyModal
        open={Boolean(pendingSecretAction)}
        bypassPassword={isAiManager}
        title={pendingSecretAction?.title || 'Autorizar cambio'}
        description={pendingSecretAction?.description}
        confirmLabel={pendingSecretAction?.confirmLabel}
        onClose={() => {
          pendingSecretAction?.onCancel?.();
          setPendingSecretAction(null);
        }}
        onAuthorize={async (masterPassword) => {
          if (!pendingSecretAction) return;
          await pendingSecretAction.run(masterPassword);
        }}
      />
    </section>
  );
};
