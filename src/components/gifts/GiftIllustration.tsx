import React, { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';
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
  floating?: boolean;
  floatDelay?: number;
}

export const GiftIllustration: React.FC<GiftIllustrationProps> = ({
  visualKey = 'cutlery',
  customImageUrl,
  accentColor = '#C88A2B',
  size = 96,
  className = '',
  floating = false,
  floatDelay = 0,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const steelCylId = `steelCyl-${uid}`;
  const steelDarkId = `steelDark-${uid}`;
  const steelInnerId = `steelInner-${uid}`;
  const goldWarmId = `goldWarm-${uid}`;
  const goldBrightId = `goldBright-${uid}`;
  const woodWarmId = `woodWarm-${uid}`;
  const obsidianId = `obsidian-${uid}`;
  const glassId = `glass-${uid}`;
  const haloId = `halo-${uid}`;
  const dropGlowId = `dropGlow-${uid}`;

  useEffect(() => {
    setImgFailed(false);
  }, [customImageUrl]);

  const resolvedKey: GiftVisualKey = visualKey || 'cutlery';
  const showCustomImage = Boolean(customImageUrl && !imgFailed);

  const artwork = showCustomImage ? (
    <div
      style={{ width: size, height: size }}
      className={`group/giftimg relative inline-flex shrink-0 items-center justify-center rounded-2xl ${className}`}
    >
      {/* Ambient studio rim glow behind custom image */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1.5 rounded-3xl opacity-45 blur-md transition-opacity duration-300 group-hover/giftimg:opacity-75"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${accentColor}55, transparent 72%)`,
        }}
      />
      {/* Frameless HD floating showcase container */}
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-b from-white/95 to-[#FAF3E8]/90 ring-1 ring-white/75 shadow-[0_14px_28px_-8px_rgba(24,12,6,0.42),0_4px_10px_-2px_rgba(200,138,43,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]">
        <img
          src={customImageUrl}
          alt="Regalo de cocina"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover/giftimg:scale-[1.06]"
        />
        {/* Subtle specular glass edge sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-black/10 ring-1 ring-inset ring-white/40"
        />
      </div>
    </div>
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={`overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Multi-stop anisotropic brushed stainless steel */}
        <linearGradient id={steelCylId} x1="16" y1="18" x2="104" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="22%" stopColor="#FFFFFF" />
          <stop offset="46%" stopColor="#CBD5E1" />
          <stop offset="72%" stopColor="#64748B" />
          <stop offset="88%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>

        {/* Deep shaded stainless / underside */}
        <linearGradient id={steelDarkId} x1="20" y1="20" x2="100" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>

        {/* Concave interior brushed metal */}
        <radialGradient id={steelInnerId} cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>

        {/* Multi-stop studio accent / gold alloy */}
        <linearGradient id={goldWarmId} x1="14" y1="14" x2="106" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="24%" stopColor="#FDE68A" />
          <stop offset="56%" stopColor={accentColor} />
          <stop offset="86%" stopColor="#78350F" />
          <stop offset="100%" stopColor={accentColor} />
        </linearGradient>

        {/* Specular bright accent highlight */}
        <linearGradient id={goldBrightId} x1="20" y1="10" x2="95" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor={accentColor} />
        </linearGradient>

        {/* Layered organic bamboo / walnut */}
        <linearGradient id={woodWarmId} x1="18" y1="26" x2="102" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F4D7A7" />
          <stop offset="38%" stopColor="#D69A56" />
          <stop offset="76%" stopColor="#9E5E24" />
          <stop offset="100%" stopColor="#703E14" />
        </linearGradient>

        {/* Contoured matte obsidian / cast iron */}
        <linearGradient id={obsidianId} x1="20" y1="20" x2="96" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5C4032" />
          <stop offset="42%" stopColor="#2B1B12" />
          <stop offset="100%" stopColor="#120905" />
        </linearGradient>

        {/* Crystal Tritan glass pitcher */}
        <linearGradient id={glassId} x1="36" y1="24" x2="84" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="36%" stopColor="#DBEAFE" stopOpacity="0.58" />
          <stop offset="72%" stopColor="#93C5FD" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0.82" />
        </linearGradient>

        {/* Soft studio halo radial */}
        <radialGradient id={haloId} cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.28" />
          <stop offset="55%" stopColor={accentColor} stopOpacity="0.1" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>

        {/* Crisp studio 3D ambient drop shadow */}
        <filter id={dropGlowId} x="-24%" y="-24%" width="148%" height="148%">
          <feDropShadow dx="0" dy="5" stdDeviation="3.8" floodColor="#1A0C06" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Studio backdrop aura */}
      <circle cx="60" cy="58" r="52" fill={`url(#${haloId})`} />
      <circle
        cx="60"
        cy="58"
        r="44"
        stroke={accentColor}
        strokeOpacity="0.2"
        strokeWidth="0.9"
        strokeDasharray="3 4"
      />

      <g filter={`url(#${dropGlowId})`}>
        {resolvedKey === 'cutlery' && (
          <g>
            {/* Fork */}
            <path
              d="M31 20V41M36 20V41M41 20V41M46 20V41"
              stroke={`url(#${steelCylId})`}
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d="M31 39C31 46 38.5 48 38.5 54V63"
              stroke={`url(#${steelCylId})`}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="35" y="61" width="7" height="3.5" rx="1.6" fill={`url(#${goldBrightId})`} />
            <rect x="35.5" y="64" width="6" height="34" rx="3" fill={`url(#${obsidianId})`} stroke={`url(#${goldWarmId})`} strokeWidth="1" />
            <path d="M37.5 67V94" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" />

            {/* Chef Table Knife */}
            <path
              d="M57 19C64.5 21 67 34 66 53H57V19Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.1"
            />
            <path d="M59.2 22V50" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.4" strokeLinecap="round" />
            <rect x="56.5" y="52.5" width="9.5" height="4" rx="1.8" fill={`url(#${goldBrightId})`} />
            <rect x="57.5" y="56" width="7.5" height="42" rx="3.6" fill={`url(#${goldWarmId})`} stroke="#78350F" strokeWidth="0.8" />
            <path d="M59.5 60V94" stroke="#FFFBEB" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />

            {/* Gourmet Spoon */}
            <ellipse
              cx="83"
              cy="32"
              rx="8.5"
              ry="13"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.1"
            />
            <ellipse cx="83" cy="31.5" rx="5.8" ry="9.5" fill={`url(#${steelInnerId})`} />
            <path d="M78.5 26C79 23.5 81 22 83 22" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.4" strokeLinecap="round" />
            <rect x="81" y="44.5" width="4" height="10" fill={`url(#${steelCylId})`} />
            <rect x="79.5" y="53" width="7" height="3.5" rx="1.6" fill={`url(#${goldBrightId})`} />
            <rect x="80" y="56" width="6" height="42" rx="3" fill={`url(#${obsidianId})`} stroke={`url(#${goldWarmId})`} strokeWidth="1" />
            <path d="M81.8 60V94" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}

        {resolvedKey === 'bowls' && (
          <g>
            {/* Rear nested bowl */}
            <path
              d="M36 42H98C96.5 61 83.5 72 67 72C50.5 72 37.5 61 36 42Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.3"
            />
            <ellipse cx="67" cy="42" rx="31" ry="6.8" fill={`url(#${steelInnerId})`} stroke={`url(#${goldWarmId})`} strokeWidth="1.6" />
            <path d="M44 41.5C50 38.5 62 37.5 72 38" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />

            {/* Front hero bowl */}
            <path
              d="M20 57H88C86 81 72 94 54 94C36 94 22 81 20 57Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.4"
            />
            {/* Encapsulated flat base foot */}
            <ellipse cx="54" cy="93.5" rx="14" ry="2.6" fill={`url(#${steelDarkId})`} />
            {/* Concave inner bowl + rolled satin-gold rim */}
            <ellipse cx="54" cy="57" rx="34" ry="7.8" fill={`url(#${steelInnerId})`} stroke={`url(#${goldBrightId})`} strokeWidth="2.4" />
            <ellipse cx="54" cy="57" rx="30.5" ry="5.5" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="0.9" />
            {/* Studio specular curve on outer belly */}
            <path d="M29 66C33 78 41 85 52 87" stroke="#FFFFFF" strokeOpacity="0.82" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M35 67C38 75 43 80 50 82" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        )}

        {resolvedKey === 'knife' && (
          <g transform="rotate(-28 60 60)">
            {/* Forged high-carbon blade */}
            <path
              d="M42 46L96 39C104 39 110 45 111 56L42 59V46Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.2"
            />
            {/* Upper spine highlight */}
            <path d="M44 47.2L96 40.5" stroke="#FFFFFF" strokeOpacity="0.88" strokeWidth="1.4" strokeLinecap="round" />
            {/* Razor bevel edge */}
            <path d="M43 57.5L109 55" stroke="#FFFFFF" strokeOpacity="0.92" strokeWidth="1.2" strokeLinecap="round" />
            {/* Granton air pockets */}
            {[55, 64, 73, 82, 91].map((cx) => (
              <ellipse
                key={cx}
                cx={cx}
                cy="52.5"
                rx="1.8"
                ry="2.6"
                fill="#475569"
                fillOpacity="0.38"
                stroke="#FFFFFF"
                strokeOpacity="0.45"
                strokeWidth="0.5"
              />
            ))}
            {/* Gold forged bolster */}
            <rect x="35" y="45.5" width="7.5" height="14" rx="2.2" fill={`url(#${goldBrightId})`} stroke="#78350F" strokeWidth="0.8" />
            {/* Ergonomic 3D handle */}
            <path
              d="M11 46.5H35V58.5H12C8 58.5 7 46.5 11 46.5Z"
              fill={`url(#${obsidianId})`}
              stroke="#5C4032"
              strokeWidth="1.1"
            />
            <path d="M12 48.2H33" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" />
            {/* Triple brass rivets */}
            <circle cx="15.5" cy="52.5" r="1.8" fill={`url(#${goldBrightId})`} />
            <circle cx="22.5" cy="52.5" r="1.8" fill={`url(#${goldBrightId})`} />
            <circle cx="29.5" cy="52.5" r="1.8" fill={`url(#${goldBrightId})`} />
          </g>
        )}

        {resolvedKey === 'thermo' && (
          <g>
            {/* Base ring */}
            <rect x="35" y="88" width="50" height="6" rx="3" fill={`url(#${steelDarkId})`} />
            {/* Insulated steel cylinder */}
            <rect
              x="32"
              y="42"
              width="56"
              height="49"
              rx="11"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.4"
            />
            {/* Accent thermal collar */}
            <rect x="32" y="58" width="56" height="17" fill={`url(#${goldWarmId})`} />
            <line x1="33" y1="58" x2="87" y2="58" stroke="#FFFBEB" strokeOpacity="0.65" strokeWidth="1" />
            <line x1="33" y1="75" x2="87" y2="75" stroke="#1E293B" strokeOpacity="0.35" strokeWidth="1" />
            {/* Specular vertical sheen */}
            <path d="M40 46V86" stroke="#FFFFFF" strokeOpacity="0.72" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M46 47V85" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.4" strokeLinecap="round" />
            {/* Matte obsidian twist lid + gold gasket */}
            <rect
              x="29"
              y="30"
              width="62"
              height="14"
              rx="6"
              fill={`url(#${obsidianId})`}
              stroke={`url(#${goldBrightId})`}
              strokeWidth="1.5"
            />
            <path d="M35 33.5H85" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.2" strokeLinecap="round" />
            {/* Ergonomic fold handle */}
            <path
              d="M46 30V23.5C46 21.2 47.8 19.5 50 19.5H70C72.2 19.5 74 21.2 74 23.5V30"
              stroke={`url(#${goldBrightId})`}
              strokeWidth="3.8"
              strokeLinecap="round"
            />
          </g>
        )}

        {resolvedKey === 'bamboo' && (
          <g transform="rotate(-10 60 60)">
            {/* 3D solid end-grain thickness slab */}
            <rect x="21" y="37" width="78" height="53" rx="10" fill="#6B3A12" />
            {/* Top bamboo surface */}
            <rect
              x="21"
              y="32"
              width="78"
              height="52"
              rx="10"
              fill={`url(#${woodWarmId})`}
              stroke="#7C471A"
              strokeWidth="1.4"
            />
            {/* Top-left bevel highlight */}
            <path d="M27 34.5H93" stroke="#FFFBEB" strokeOpacity="0.52" strokeWidth="1.4" strokeLinecap="round" />
            {/* Recessed perimeter juice groove */}
            <rect
              x="28"
              y="39"
              width="64"
              height="38"
              rx="6"
              stroke="#6B3A12"
              strokeOpacity="0.55"
              strokeWidth="2"
            />
            <rect
              x="28.8"
              y="39.8"
              width="62.4"
              height="36.4"
              rx="5.4"
              stroke="#FDE68A"
              strokeOpacity="0.32"
              strokeWidth="0.9"
            />
            {/* Wood grain accents */}
            <path
              d="M35 49H74M41 58H84M34 67H70"
              stroke="#FFF3D6"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Hanging brass ring & grommet */}
            <circle cx="85" cy="45" r="4.6" fill={`url(#${goldBrightId})`} stroke="#78350F" strokeWidth="1" />
            <circle cx="85" cy="45" r="2.2" fill="#2A1B12" />
          </g>
        )}

        {resolvedKey === 'skillet' && (
          <g>
            {/* 3/4 Perspective Induction Skillet Sidewall */}
            <path
              d="M20 56C20 74 34 86 52 86C70 86 84 74 84 56H20Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.4"
            />
            {/* Encapsulated thermal base shadow */}
            <ellipse cx="52" cy="84" rx="22" ry="4.5" fill={`url(#${steelDarkId})`} />
            {/* Rolled surgical steel pouring rim */}
            <ellipse
              cx="52"
              cy="56"
              rx="32"
              ry="18"
              fill={`url(#${steelCylId})`}
              stroke="#FFFFFF"
              strokeOpacity="0.8"
              strokeWidth="1.6"
            />
            {/* Dark gourmet cooking interior */}
            <ellipse
              cx="52"
              cy="56"
              rx="27.5"
              ry="14.5"
              fill={`url(#${obsidianId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.2"
            />
            {/* Concentric sear ring + subtle oil sheen */}
            <ellipse
              cx="52"
              cy="57"
              rx="18"
              ry="9"
              stroke="#8C6D58"
              strokeOpacity="0.4"
              strokeDasharray="3 3"
              strokeWidth="1.1"
            />
            <path d="M32 54C36 48 45 45 56 46" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />

            {/* Gold forged rivet flange */}
            <path d="M80 51L89 45L92 50L81 56Z" fill={`url(#${goldBrightId})`} stroke="#78350F" strokeWidth="0.8" />
            {/* Long contoured ergonomic handle */}
            <path d="M85 48L108 31" stroke={`url(#${steelCylId})`} strokeWidth="7.5" strokeLinecap="round" />
            <path d="M89 45L108 31" stroke={`url(#${goldWarmId})`} strokeWidth="4.2" strokeLinecap="round" />
            <path d="M87 44.5L105 31" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.1" strokeLinecap="round" />
            <circle cx="106.5" cy="32" r="1.4" fill="#2A1B12" />
          </g>
        )}

        {resolvedKey === 'pot' && (
          <g>
            {/* Riveted twin side handles */}
            <path
              d="M27 52H20C17.5 52 16 54 16 56.5C16 59 17.5 61 20 61H27"
              stroke={`url(#${goldBrightId})`}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M93 52H100C102.5 52 104 54 104 56.5C104 59 102.5 61 100 61H93"
              stroke={`url(#${goldBrightId})`}
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Induction base ring */}
            <rect x="30" y="88" width="60" height="5.5" rx="2.5" fill={`url(#${steelDarkId})`} />
            {/* Heavy-gauge 5-ply stainless pot belly */}
            <path
              d="M27 47H93V83C93 88.5 88.5 92 83 92H37C31.5 92 27 88.5 27 83V47Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.4"
            />
            {/* Studio vertical light reflection */}
            <path d="M36 53V84" stroke="#FFFFFF" strokeOpacity="0.78" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M42 54V83" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="1.4" strokeLinecap="round" />
            {/* Rolled rim & domed mirror lid */}
            <path
              d="M24 47C26.5 34.5 41.5 30 60 30C78.5 30 93.5 34.5 96 47H24Z"
              fill={`url(#${steelInnerId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.4"
            />
            <path d="M34 42C41 35.5 52 33.5 62 33.5" stroke="#FFFFFF" strokeOpacity="0.82" strokeWidth="1.8" strokeLinecap="round" />
            {/* Gold thermal lid knob */}
            <rect x="52" y="22.5" width="16" height="7" rx="3.5" fill={`url(#${goldBrightId})`} stroke="#78350F" strokeWidth="0.9" />
            <rect x="55" y="29" width="10" height="2.2" fill={`url(#${goldWarmId})`} />
          </g>
        )}

        {resolvedKey === 'blender' && (
          <g>
            {/* Anti-slip rubber feet */}
            <rect x="36" y="92" width="10" height="3.5" rx="1.5" fill="#1E110A" />
            <rect x="74" y="92" width="10" height="3.5" rx="1.5" fill="#1E110A" />
            {/* Brushed steel & obsidian motor base */}
            <path
              d="M35 69H85L90 92H30L35 69Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.4"
            />
            <rect x="35" y="68" width="50" height="5" rx="2" fill={`url(#${obsidianId})`} />
            {/* Rotary gold power dial */}
            <circle cx="60" cy="82" r="6.2" fill={`url(#${obsidianId})`} stroke={`url(#${goldBrightId})`} strokeWidth="1.6" />
            <circle cx="60" cy="82" r="3" fill={`url(#${goldBrightId})`} />
            {/* Crystal Tritan pitcher */}
            <path
              d="M38 27H82L76 68H44L38 27Z"
              fill={`url(#${glassId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.5"
            />
            {/* Internal surgical blade cross */}
            <path d="M51 64L60 58L69 64M54 66H66" stroke={`url(#${steelDarkId})`} strokeWidth="2.2" strokeLinecap="round" />
            {/* Glass specular facets & measure ticks */}
            <path d="M44 33L48 62" stroke="#FFFFFF" strokeOpacity="0.82" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M68 38H73M67 45H72M66 52H71" stroke="#475569" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
            {/* Pitcher ergonomic handle */}
            <path
              d="M80 34H89.5C92.5 34 93.5 38 92 45L88 60H77.5"
              stroke={`url(#${steelCylId})`}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Fitted lid & tamper cap */}
            <rect x="36" y="21" width="48" height="7" rx="3" fill={`url(#${obsidianId})`} stroke={`url(#${goldWarmId})`} strokeWidth="1.1" />
            <rect x="52" y="16" width="16" height="5.5" rx="2.5" fill={`url(#${goldBrightId})`} />
          </g>
        )}

        {resolvedKey === 'kettle' && (
          <g>
            {/* Curved arched comfort handle */}
            <path
              d="M39 40C39 20 81 20 81 40"
              stroke={`url(#${obsidianId})`}
              strokeWidth="6.2"
              strokeLinecap="round"
            />
            <path d="M44 33C50 25 70 25 76 33" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="39" cy="40" r="3.2" fill={`url(#${goldBrightId})`} />
            <circle cx="81" cy="40" r="3.2" fill={`url(#${goldBrightId})`} />

            {/* Angled pouring spout */}
            <path
              d="M35 64L18 47L23 42L41 53Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <circle cx="20.5" cy="44.5" r="2.2" fill={`url(#${goldBrightId})`} />

            {/* Sculpted stainless body */}
            <path
              d="M34 50C34 40 45 35 60 35C75 35 86 40 86 50L91 84C91 89.5 86 93 80 93H40C34 93 29 89.5 29 84L34 50Z"
              fill={`url(#${steelCylId})`}
              stroke={`url(#${steelDarkId})`}
              strokeWidth="1.5"
            />
            {/* Gold induction skirt ring */}
            <path d="M31 86.5C35 89 45 90.5 60 90.5C75 90.5 85 89 89 86.5" stroke={`url(#${goldWarmId})`} strokeWidth="2.4" strokeLinecap="round" />
            {/* Studio reflection */}
            <path d="M40 52L37 82" stroke="#FFFFFF" strokeOpacity="0.78" strokeWidth="3.2" strokeLinecap="round" />
            {/* Domed lid + gold finial */}
            <ellipse cx="60" cy="39" rx="16" ry="4.5" fill={`url(#${steelInnerId})`} stroke={`url(#${steelDarkId})`} strokeWidth="1.1" />
            <circle cx="60" cy="33.5" r="4.8" fill={`url(#${goldBrightId})`} stroke="#78350F" strokeWidth="0.9" />
          </g>
        )}
      </g>
    </svg>
  );

  if (!floating) {
    return artwork;
  }

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{
          duration: 3.1,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: floatDelay,
        }}
        className="relative z-10 will-change-transform"
      >
        {artwork}
      </motion.div>
      {/* Synchronized floating ground contact shadow */}
      <motion.div
        aria-hidden="true"
        animate={{
          scaleX: [1, 0.78, 1],
          scaleY: [1, 0.82, 1],
          opacity: [0.42, 0.2, 0.42],
        }}
        transition={{
          duration: 3.1,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: floatDelay,
        }}
        style={{ width: Math.round(size * 0.72), height: Math.max(8, Math.round(size * 0.14)) }}
        className="mt-1 rounded-full bg-gradient-to-r from-transparent via-[#1E0E07]/70 to-transparent blur-[3px] will-change-transform"
      />
    </div>
  );
};
