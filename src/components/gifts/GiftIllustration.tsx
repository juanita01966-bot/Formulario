import React, { useEffect, useState } from 'react';
import type { GiftVisualKey } from '../../types/app';

export const GIFT_VISUAL_OPTIONS: Array<{
  key: GiftVisualKey;
  label: string;
  defaultColor: string;
}> = [
  { key: 'cutlery', label: 'Cubiertos Inox', defaultColor: '#C88A2B' },
  { key: 'bowls', label: 'Set Tazones', defaultColor: '#B84A27' },
  { key: 'knife', label: 'Cuchillo Chef', defaultColor: '#8C3B20' },
  { key: 'thermo', label: 'Contenedor Térmico', defaultColor: '#4B644A' },
  { key: 'bamboo', label: 'Tabla Bambú', defaultColor: '#A66328' },
  { key: 'skillet', label: 'Sartén Gourmet', defaultColor: '#7C4327' },
  { key: 'pot', label: 'Olla Acero', defaultColor: '#5B4636' },
  { key: 'blender', label: 'Extractor / Licuadora', defaultColor: '#9E4725' },
  { key: 'kettle', label: 'Tetera / Jarra', defaultColor: '#C88A2B' },
];

interface GiftIllustrationProps {
  visualKey?: GiftVisualKey | null;
  customImageUrl?: string;
  accentColor?: string;
  size?: number;
  className?: string;
}

export const GiftIllustration: React.FC<GiftIllustrationProps> = ({
  visualKey = 'cutlery',
  customImageUrl,
  accentColor = '#C88A2B',
  size = 96,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [customImageUrl]);

  if (customImageUrl && !imgFailed) {
    return (
      <img
        src={customImageUrl}
        alt="Regalo de cocina"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        style={{ width: size, height: size }}
        className={`rounded-2xl object-cover shadow-md border border-amber-200/70 bg-white ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="steelGrad" x1="20" y1="15" x2="100" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="45%" stopColor="#CBD5E1" />
          <stop offset="75%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="goldWarm" x1="15" y1="15" x2="105" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F6D58E" />
          <stop offset="55%" stopColor={accentColor} />
          <stop offset="100%" stopColor="#855013" />
        </linearGradient>
        <linearGradient id="woodWarm" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8C089" />
          <stop offset="55%" stopColor="#C48947" />
          <stop offset="100%" stopColor="#8C5320" />
        </linearGradient>
      </defs>

      {/* Soft warm halo */}
      <circle cx="60" cy="60" r="50" fill={accentColor} fillOpacity="0.11" />
      <circle cx="60" cy="60" r="42" stroke={accentColor} strokeOpacity="0.22" strokeDasharray="4 4" />

      {visualKey === 'cutlery' && (
        <g>
          {/* Fork */}
          <path d="M38 22V44M43 22V44M48 22V44M38 40C38 47 43 49 43 54V94" stroke="url(#steelGrad)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="40" y="64" width="6" height="32" rx="3" fill="url(#goldWarm)" />
          {/* Knife */}
          <path d="M62 22C68 24 70 36 69 52H62V22Z" fill="url(#steelGrad)" stroke="#64748B" strokeWidth="1.2" />
          <rect x="61.5" y="53" width="6.5" height="43" rx="3.2" fill="url(#goldWarm)" />
          {/* Spoon */}
          <ellipse cx="83" cy="34" rx="7.5" ry="12" fill="url(#steelGrad)" stroke="#94A3B8" strokeWidth="1.2" />
          <rect x="80" y="46" width="6" height="50" rx="3" fill="url(#goldWarm)" />
        </g>
      )}

      {visualKey === 'bowls' && (
        <g>
          {/* Back smaller bowl */}
          <path d="M36 46H96C95 62 82 72 66 72C50 72 37 62 36 46Z" fill="url(#steelGrad)" stroke="#64748B" strokeWidth="1.5" />
          <ellipse cx="66" cy="46" rx="30" ry="6" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.4" />
          {/* Front larger bowl */}
          <path d="M22 60H86C84 81 71 92 54 92C37 92 24 81 22 60Z" fill="url(#steelGrad)" stroke="#475569" strokeWidth="1.6" />
          <ellipse cx="54" cy="60" rx="32" ry="7" fill="#FFFFFF" stroke="url(#goldWarm)" strokeWidth="2.2" />
          <path d="M32 71C36 80 44 85 54 85" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}

      {visualKey === 'knife' && (
        <g transform="rotate(-32 60 60)">
          {/* Blade */}
          <path d="M22 50L84 42C94 42 102 48 104 58L22 60V50Z" fill="url(#steelGrad)" stroke="#64748B" strokeWidth="1.5" />
          {/* Granton edge scallops */}
          <circle cx="42" cy="55" r="1.6" fill="#64748B" fillOpacity="0.45" />
          <circle cx="52" cy="54.5" r="1.6" fill="#64748B" fillOpacity="0.45" />
          <circle cx="62" cy="54" r="1.6" fill="#64748B" fillOpacity="0.45" />
          <circle cx="72" cy="53.5" r="1.6" fill="#64748B" fillOpacity="0.45" />
          {/* Bolster */}
          <rect x="18" y="49" width="7" height="12" rx="2" fill="url(#goldWarm)" />
          {/* Ergonomic handle */}
          <path d="M-2 50H18V60H-1C-5 60 -6 50 -2 50Z" fill="#2A1B12" stroke="#594133" strokeWidth="1.2" />
          <circle cx="5" cy="55" r="1.8" fill="url(#goldWarm)" />
          <circle cx="12" cy="55" r="1.8" fill="url(#goldWarm)" />
        </g>
      )}

      {visualKey === 'thermo' && (
        <g>
          {/* Container body */}
          <rect x="33" y="42" width="54" height="50" rx="11" fill="url(#steelGrad)" stroke="#64748B" strokeWidth="1.6" />
          {/* Autumn Accent Band */}
          <rect x="33" y="60" width="54" height="15" fill="url(#goldWarm)" fillOpacity="0.9" />
          {/* Thermal Lid */}
          <rect x="30" y="31" width="60" height="14" rx="6" fill="#2B1C14" stroke="url(#goldWarm)" strokeWidth="1.6" />
          {/* Top Handle */}
          <path d="M47 31V25C47 22.8 48.8 21 51 21H69C71.2 21 73 22.8 73 25V31" stroke="url(#goldWarm)" strokeWidth="3.5" strokeLinecap="round" />
          {/* Shine */}
          <path d="M41 48V85" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {visualKey === 'bamboo' && (
        <g transform="rotate(-12 60 60)">
          {/* Board */}
          <rect x="22" y="34" width="76" height="52" rx="10" fill="url(#woodWarm)" stroke="#7C471A" strokeWidth="1.8" />
          {/* Juice groove */}
          <rect x="29" y="41" width="62" height="38" rx="6" stroke="#7C471A" strokeOpacity="0.45" strokeWidth="1.8" />
          {/* Wood grain lines */}
          <path d="M35 53H78M40 62H84M34 70H68" stroke="#F7DCB4" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
          {/* Hanging ring */}
          <circle cx="87" cy="45" r="4" fill="#FAF3E8" stroke="#7C471A" strokeWidth="1.5" />
        </g>
      )}

      {visualKey === 'skillet' && (
        <g>
          {/* Pan body */}
          <circle cx="52" cy="64" r="28" fill="#2A1B12" stroke="url(#steelGrad)" strokeWidth="4" />
          <circle cx="52" cy="64" r="19" stroke="#594133" strokeDasharray="3 3" strokeWidth="1.4" />
          {/* Long steel handle */}
          <path d="M77 48L102 28" stroke="url(#steelGrad)" strokeWidth="8" strokeLinecap="round" />
          <path d="M88 39L102 28" stroke="url(#goldWarm)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="52" cy="64" r="5" fill="url(#goldWarm)" fillOpacity="0.5" />
        </g>
      )}

      {visualKey === 'pot' && (
        <g>
          {/* Side handles */}
          <path d="M22 54H29M91 54H98" stroke="url(#goldWarm)" strokeWidth="5" strokeLinecap="round" />
          {/* Pot body */}
          <path d="M28 48H92V84C92 89 88 93 82 93H38C32 93 28 89 28 84V48Z" fill="url(#steelGrad)" stroke="#64748B" strokeWidth="1.6" />
          {/* Lid */}
          <path d="M25 48C27 36 42 32 60 32C78 32 93 36 95 48H25Z" fill="#E2E8F0" stroke="#64748B" strokeWidth="1.5" />
          {/* Lid knob */}
          <rect x="53" y="24" width="14" height="7" rx="3.5" fill="url(#goldWarm)" />
          <path d="M38 56V84" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {visualKey === 'blender' && (
        <g>
          {/* Pitcher */}
          <path d="M40 28H80L75 70H45L40 28Z" fill="#EFF6FF" fillOpacity="0.85" stroke="#64748B" strokeWidth="1.8" />
          {/* Handle */}
          <path d="M79 36H88C91 36 92 40 91 46L87 60H77" stroke="url(#steelGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {/* Lid */}
          <rect x="38" y="22" width="44" height="7" rx="3" fill="#2A1B12" />
          {/* Base */}
          <path d="M36 70H84L88 94H32L36 70Z" fill="url(#steelGrad)" stroke="#475569" strokeWidth="1.6" />
          <circle cx="60" cy="82" r="5" fill="url(#goldWarm)" />
        </g>
      )}

      {visualKey === 'kettle' && (
        <g>
          {/* Spout */}
          <path d="M36 62L22 48L26 44L41 53" fill="url(#steelGrad)" stroke="#64748B" strokeWidth="1.4" />
          {/* Body */}
          <path d="M34 52C34 42 45 36 60 36C75 36 86 42 86 52L90 84C90 89 85 93 79 93H41C35 93 30 89 30 84L34 52Z" fill="url(#steelGrad)" stroke="#64748B" strokeWidth="1.6" />
          {/* Top Arch Handle */}
          <path d="M40 38C40 22 80 22 80 38" stroke="#2A1B12" strokeWidth="5.5" strokeLinecap="round" />
          {/* Knob */}
          <circle cx="60" cy="34" r="4.5" fill="url(#goldWarm)" />
        </g>
      )}
    </svg>
  );
};
