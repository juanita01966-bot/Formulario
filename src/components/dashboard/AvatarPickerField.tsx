import React, { useRef, useState } from 'react';
import { AlertTriangle, Check, Link2, Trash2, Upload } from 'lucide-react';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import {
  compressAvatarFile,
  normalizeAvatarLink,
  validateAvatarUrlInput,
} from '../../utils/avatarImageUtils';

interface AvatarPickerFieldProps {
  name?: string;
  value: string;
  onChange: (nextUrl: string) => void;
  disabled?: boolean;
  label?: string;
}

export const AvatarPickerField: React.FC<AvatarPickerFieldProps> = ({
  name,
  value,
  onChange,
  disabled = false,
  label = 'Foto de perfil del Embajador (opcional)',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [driveConverted, setDriveConverted] = useState(false);

  const isLocalDataUrl = value.startsWith('data:image/');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLocalError(null);
    setDriveConverted(false);
    setUploading(true);
    try {
      const compressed = await compressAvatarFile(file);
      onChange(compressed);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo procesar la foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlChange = (raw: string) => {
    setLocalError(null);
    if (!raw.trim()) {
      setDriveConverted(false);
      onChange('');
      return;
    }
    const normalized = normalizeAvatarLink(raw);
    setDriveConverted(
      normalized !== raw.trim() && normalized.includes('drive.google.com/thumbnail?id=')
    );
    onChange(normalized);
  };

  const handleUrlBlur = () => {
    if (!value || isLocalDataUrl) return;
    const check = validateAvatarUrlInput(value);
    if (!check.ok && check.error) {
      setLocalError(check.error);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E6D5BF] bg-[#FAF4EA]/80 p-3 sm:p-3.5 space-y-2.5 sm:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-[#4E382B]">{label}</label>
        {value && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => {
              setLocalError(null);
              setDriveConverted(false);
              onChange('');
            }}
            className="inline-flex min-h-[32px] items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Quitar foto
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-3.5">
        <AmbassadorAvatar
          name={name || 'Embajador'}
          avatarUrl={value || null}
          size="xl"
          ring="gold"
        />

        <div className="flex-1 w-full min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={disabled || uploading}
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[42px] sm:min-h-[40px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-white px-3.5 py-2 text-xs font-bold text-[#4E382B] hover:bg-[#F5E9D6] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5 text-[#B84A27] shrink-0" />
              {uploading ? 'Comprimiendo...' : 'Subir desde dispositivo'}
            </button>

            {isLocalDataUrl && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                Foto cargada y optimizada
              </span>
            )}
          </div>

          <div className="relative">
            <Link2 className="h-3.5 w-3.5 text-[#8A6D5B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              disabled={disabled || uploading}
              value={isLocalDataUrl ? '' : value}
              onChange={(e) => handleUrlChange(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="O pega un enlace de imagen (https://... o Google Drive)"
              className="w-full min-h-[44px] sm:min-h-[40px] rounded-xl border border-[#DFCBB3] bg-white pl-8 pr-3 py-2 text-base sm:text-xs text-[#22150E] placeholder:text-[#A8917D] focus:border-[#C88A2B] focus:outline-none disabled:opacity-50"
            />
          </div>

          {driveConverted && !localError && (
            <p className="text-[11px] font-medium text-amber-800">
              Enlace de Google Drive convertido automáticamente para vista directa.
            </p>
          )}

          {localError ? (
            <p className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </p>
          ) : (
            <p className="text-[10.5px] text-[#7B5D4A]">
              JPG, PNG o WebP (se recorta automáticamente a cuadrado 320×320 para máxima nitidez).
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
