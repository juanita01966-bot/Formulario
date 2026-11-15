import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GiftItem, GiftThemeId } from '../../types/app';
import { resolveBoxPalette } from '../../shared/giftThemes';

interface MysteryCardsMenuProps {
  leadName: string;
  activeGifts: GiftItem[];
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  onSelectGift: (gift: GiftItem, cardIndex: number) => void;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface GiftBox3DTileProps {
  index: number;
  selectedIndex: number | null;
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  onPick: () => void;
}

const GiftBox3DTile: React.FC<GiftBox3DTileProps> = ({
  index,
  selectedIndex,
  giftTheme,
  customBoxColor,
  onPick,
}) => {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const isSelected = selectedIndex === index;
  const anotherSelected = selectedIndex !== null && !isSelected;
  const palette = resolveBoxPalette(giftTheme, customBoxColor, index);
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'][index] || String(index + 1);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (selectedIndex !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 18,
      ry: (px - 0.5) * 20,
    });
  };

  return (
    <motion.button
      type="button"
      onClick={onPick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      disabled={selectedIndex !== null}
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{
        opacity: anotherSelected ? 0.2 : 1,
        scale: isSelected ? 1.1 : anotherSelected ? 0.88 : 1,
        y: isSelected ? -14 : 0,
      }}
      whileHover={selectedIndex === null ? { y: -6, scale: 1.04 } : undefined}
      whileTap={selectedIndex === null ? { scale: 0.95 } : undefined}
      transition={{
        type: 'spring',
        stiffness: 290,
        damping: 20,
        delay: selectedIndex === null ? index * 0.06 : 0,
      }}
      className="group relative flex flex-col items-center justify-between rounded-2xl border border-[#C88A2B]/35 bg-gradient-to-b from-[#3A1E13]/85 to-[#1E0F09]/95 p-3.5 sm:p-4 perspective-1000 cursor-pointer hover:border-[#F4CA73]/75 hover:shadow-[0_14px_32px_rgba(229,174,78,0.28)] transition-all focus:outline-none"
    >
      {/* Subtle top spacer inside tile */}
      <div className="h-1" />

      {/* Isometric 3D Gift Box SVG floating gently */}
      <motion.div
        animate={
          selectedIndex === null
            ? { y: [0, -5, 0] }
            : isSelected
              ? { y: -10, scale: 1.12 }
              : {}
        }
        transition={{
          duration: 2.6 + (index % 3) * 0.35,
          repeat: selectedIndex === null ? Infinity : 0,
          ease: 'easeInOut',
          delay: index * 0.2,
        }}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 140ms ease-out',
        }}
        className="relative my-1.5 w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center preserve-3d"
      >
        {/* Warm glow behind box */}
        <div className="pointer-events-none absolute inset-2 rounded-full bg-amber-400/20 blur-xl group-hover:bg-amber-300/35 transition-colors" />

        <svg viewBox="0 0 130 130" className="relative w-full h-full drop-shadow-[0_14px_16px_rgba(0,0,0,0.55)]" fill="none">
          <defs>
            <linearGradient id={`goldRib-${index}`} x1="0" y1="0" x2="130" y2="130" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#D4942A" />
              <stop offset="100%" stopColor="#8A5212" />
            </linearGradient>
          </defs>

          {/* Pedestal ground shadow */}
          <ellipse cx="65" cy="116" rx="40" ry="7" fill="rgba(0,0,0,0.45)" />

          {/* Left Front 3D Face */}
          <polygon
            points="23,58 65,78 65,114 23,94"
            fill={palette.front}
            stroke="#E5AE4E"
            strokeOpacity="0.4"
            strokeWidth="0.9"
          />
          {/* Right Shaded 3D Face */}
          <polygon
            points="65,78 107,58 107,94 65,114"
            fill={palette.side}
            stroke="#E5AE4E"
            strokeOpacity="0.3"
            strokeWidth="0.9"
          />

          {/* Vertical Gold Ribbons on Front & Right faces */}
          <polygon points="40,66 49,70.5 49,106.5 40,102" fill={`url(#goldRib-${index})`} />
          <polygon points="81,70.5 90,66 90,102 81,106.5" fill={`url(#goldRib-${index})`} fillOpacity="0.88" />

          {/* 3D Overhanging Lid */}
          {/* Lid Left Rim */}
          <polygon points="18,46 65,68 65,79 18,57" fill={palette.lid} stroke="#F6D58E" strokeOpacity="0.5" strokeWidth="0.9" />
          {/* Lid Right Rim */}
          <polygon points="65,68 112,46 112,57 65,79" fill={palette.side} stroke="#F6D58E" strokeOpacity="0.4" strokeWidth="0.9" />
          {/* Lid Top Diamond Face */}
          <polygon
            points="65,25 112,46 65,68 18,46"
            fill={palette.lid}
            stroke="#FDE68A"
            strokeOpacity="0.6"
            strokeWidth="1.1"
          />

          {/* Crossed Ribbons on Lid Top */}
          <polygon points="42,35.5 51,31.5 91,50.5 82,54.5" fill={`url(#goldRib-${index})`} />
          <polygon points="88,35.5 79,31.5 39,50.5 48,54.5" fill={`url(#goldRib-${index})`} />
          {/* Ribbon down the lid rims */}
          <polygon points="39,55 48,59 48,70 39,66" fill={`url(#goldRib-${index})`} />
          <polygon points="82,59 91,55 91,66 82,70" fill={`url(#goldRib-${index})`} />

          {/* 3D Sculpted Bow on Top */}
          <path
            d="M65 44 C51 28, 34 32, 41 43 C46 50, 58 47, 65 44 Z"
            fill={`url(#goldRib-${index})`}
            stroke="#FEF08A"
            strokeWidth="0.9"
          />
          <path
            d="M65 44 C79 28, 96 32, 89 43 C84 50, 72 47, 65 44 Z"
            fill={`url(#goldRib-${index})`}
            stroke="#FEF08A"
            strokeWidth="0.9"
          />
          <circle cx="65" cy="44" r="5" fill="#FEF08A" stroke="#92400E" strokeWidth="1" />
        </svg>
      </motion.div>

      {/* Bottom label */}
      <div className="w-full text-center pt-1">
        <p className="font-serif text-xs sm:text-sm font-semibold text-[#FFF7E2]">Cajita {roman}</p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#E5AE4E]/80 group-hover:text-[#FDE68A] transition-colors">
          Elegir regalo
        </p>
      </div>
    </motion.button>
  );
};

export const MysteryCardsMenu: React.FC<MysteryCardsMenuProps> = ({
  leadName,
  activeGifts,
  giftTheme,
  customBoxColor,
  onSelectGift,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';

  // Present 4 to 6 3D mystery boxes drawn from active gifts (stable across background sync polls)
  const giftIdsKey = activeGifts.map((g) => g.id).join('|');
  const boxGifts = useMemo(() => {
    const pool = activeGifts.length > 0 ? activeGifts : [];
    if (pool.length === 0) return [];
    const targetCount = Math.min(6, Math.max(4, pool.length));
    const shuffled = shuffleArray(pool);
    const result: GiftItem[] = [];
    for (let i = 0; i < targetCount; i++) {
      result.push(shuffled[i % shuffled.length]);
    }
    return shuffleArray(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftIdsKey]);

  const handleBoxPick = (gift: GiftItem, idx: number) => {
    if (selectedIndex !== null) return;
    setSelectedIndex(idx);
    window.setTimeout(() => {
      onSelectGift(gift, idx);
    }, 340);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[700px] mx-auto"
    >
      <div className="relative overflow-hidden rounded-[34px] bg-[#FFFDF9]/78 backdrop-blur-xl border border-[#DFC9AB]/80 autumn-card-shadow px-5 py-7 sm:px-8 sm:py-9">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#4B644A]" />

        <div className="text-center max-w-md mx-auto mb-6">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#22150E] leading-tight">
            {firstName}, elige una <span className="gold-foil-text">cajita de regalo</span>
          </h2>
          <p className="mt-2 text-sm text-[#5C4332]">
            Toca cualquiera de las cajas dentro del recuadro para elevarla, girarla y descubrir tu obsequio exclusivo.
          </p>
        </div>

        {/* Dedicated 3D Showcase Frame */}
        <div className="relative overflow-hidden rounded-[26px] border-2 border-[#C88A2B]/50 bg-gradient-to-b from-[#27140C] via-[#1C0D07] to-[#2B150D] p-4 sm:p-5 shadow-[inset_0_2px_24px_rgba(0,0,0,0.65)]">
          {/* Subtle top ambient spotlight inside the frame */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-32 w-3/4 blur-2xl opacity-45"
            style={{
              background: 'radial-gradient(ellipse at top, rgba(246, 204, 114, 0.55), transparent 75%)',
            }}
          />

          <div
            className={`relative z-10 grid gap-3 sm:gap-4 ${
              boxGifts.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {boxGifts.map((gift, index) => (
              <GiftBox3DTile
                key={`${gift.id}-${index}`}
                index={index}
                selectedIndex={selectedIndex}
                giftTheme={giftTheme}
                customBoxColor={customBoxColor}
                onPick={() => handleBoxPick(gift, index)}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
