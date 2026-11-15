import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
              {/* Live 3D Box Mini Preview */}
              {(() => {
                const previewPalette = resolveBoxPalette(giftTheme, customBoxColor, 0);
                return (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#22150E] border border-[#C88A2B]/40 p-1.5 shadow-inner">
                    <svg viewBox="0 0 130 130" className="w-full h-full" fill="none">
                      <polygon points="23,58 65,78 65,114 23,94" fill={previewPalette.front} />
                      <polygon points="65,78 107,58 107,94 65,114" fill={previewPalette.side} />
                      <polygon points="40,66 48,70 48,106 40,102" fill={previewPalette.ribbonMid} />
                      <polygon points="82,70 90,66 90,102 82,106" fill={previewPalette.ribbonMid} />
                      <polygon points="65,26 111,48 65,70 19,48" fill={previewPalette.lid} />
                      <polygon points="39,38 47,34 93,56 85,60" fill={previewPalette.ribbonStart} />
                      <polygon points="83,34 91,38 45,60 37,56" fill={previewPalette.ribbonStart} />
                      <circle cx="65" cy="48" r="6" fill={previewPalette.ribbonStart} />
                    </svg>
                  </div>
                );
              })()}
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

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {gifts.map((gift) => (
              <motion.div
                layout
                key={gift.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className={`relative rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                  gift.active
                    ? 'border-[#E6D5BF] bg-white shadow-sm'
                    : 'border-stone-200 bg-stone-50/80 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#FAF3E8] border border-[#E6D5BF]">
                      <GiftIllustration
                        visualKey={gift.visualKey}
                        customImageUrl={gift.customImageUrl}
                        accentColor={gift.accentColor}
                        size={52}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(gift)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                        gift.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {gift.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {gift.active ? 'Activo' : 'Oculto'}
                    </button>
                  </div>

                  <div className="mt-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: gift.accentColor }}
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

                <div className="mt-4 pt-3 border-t border-[#EFE3D2] flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#8B6F5B]">{gift.stockLabel}</span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(gift)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E6D5BF] bg-[#FAF3E8] px-2.5 py-1 text-xs font-semibold text-[#22150E] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#B84A27]" />
                      Editar
                    </button>

                    {confirmDeleteId === gift.id ? (
                      <div className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleDelete(gift.id)}
                          className="font-bold text-red-700 cursor-pointer"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[#6E5341] cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(gift.id)}
                        className="rounded-lg p-1.5 text-[#A48A77] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                        title="Eliminar regalo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
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

              {/* Live Preview Strip */}
              <div className="flex items-center gap-4 rounded-2xl bg-[#FAF3E8] border border-[#E6D5BF] p-3.5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white border border-[#E6D5BF] shadow-sm">
                  <GiftIllustration
                    visualKey={draft.visualKey}
                    customImageUrl={draft.customImageUrl}
                    accentColor={draft.accentColor}
                    size={54}
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
