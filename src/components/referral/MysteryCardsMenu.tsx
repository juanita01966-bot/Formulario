import React, { useEffect, useId, useMemo, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { GiftItem, GiftThemeId } from '../../types/app';
import { resolveBoxPalette } from '../../shared/giftThemes';

interface MysteryCardsMenuProps {
  leadName: string;
  activeGifts: GiftItem[];
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  randomizeGifts?: boolean;
  onSelectGift: (gift: GiftItem, cardIndex: number) => void;
}

function cryptoRandomInt(max: number): number {
  if (max <= 1) return 0;
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const range = 0x100000000;
    const limit = range - (range % max);
    const buf = new Uint32Array(1);
    let value = 0;
    do {
      cryptoObj.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

function cryptoShuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cryptoRandomPick<T>(items: readonly T[]): T {
  return items[cryptoRandomInt(items.length)];
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
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [spotlight, setSpotlight] = useState({ x: 50, y: 35, active: false });

  const isSelected = selectedIndex === index;
  const anotherSelected = selectedIndex !== null && !isSelected;
  const palette = resolveBoxPalette(giftTheme, customBoxColor, index);
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][index] || String(index + 1);

  // Unique per-card SVG gradient & filter IDs so multi-card renders never collide
  const goldRibId = `goldRib-${uid}`;
  const goldShadeId = `goldShade-${uid}`;
  const bowFillId = `bowFill-${uid}`;
  const boxFrontId = `boxFront-${uid}`;
  const boxSideId = `boxSide-${uid}`;
  const boxLidId = `boxLid-${uid}`;
  const boxRimId = `boxRim-${uid}`;
  const boxDropId = `boxDrop-${uid}`;

  // Single 60 FPS motion driver linking levitation height to inverse contact shadow
  const lift = useMotionValue(0);
  const boxY = useTransform(lift, [0, 1, 1.8], [0, -9, -18]);
  const boxScale = useTransform(lift, [0, 1, 1.8], [1, 1.02, 1.12]);
  const shadowScaleX = useTransform(lift, [0, 1, 1.8], [1, 0.72, 0.54]);
  const shadowScaleY = useTransform(lift, [0, 1, 1.8], [1, 0.76, 0.62]);
  const shadowOpacity = useTransform(lift, [0, 1, 1.8], [0.72, 0.34, 0.2]);
  const auraScale = useTransform(lift, [0, 1, 1.8], [0.94, 1.14, 1.3]);
  const auraOpacity = useTransform(lift, [0, 1, 1.8], [0.35, 0.65, 0.85]);

  useEffect(() => {
    if (selectedIndex === null) {
      const controls = animate(lift, [0, 1, 0], {
        duration: 2.8 + (index % 3) * 0.35,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: index * 0.22,
      });
      return () => controls.stop();
    }

    if (isSelected) {
      const controls = animate(lift, 1.8, {
        type: 'spring',
        stiffness: 260,
        damping: 18,
      });
      return () => controls.stop();
    }

    const controls = animate(lift, 0, { duration: 0.25 });
    return () => controls.stop();
  }, [index, isSelected, lift, selectedIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (selectedIndex !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setTilt({
      rx: (0.5 - py) * 18,
      ry: (px - 0.5) * 20,
    });
    setSpotlight({
      x: Math.round(px * 100),
      y: Math.round(py * 100),
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
    setSpotlight((prev) => ({ ...prev, active: false }));
  };

  return (
    <motion.button
      type="button"
      onClick={onPick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      disabled={selectedIndex !== null}
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{
        opacity: anotherSelected ? 0.2 : 1,
        scale: isSelected ? 1.07 : anotherSelected ? 0.88 : 1,
        y: isSelected ? -10 : 0,
      }}
      whileHover={selectedIndex === null ? { y: -6, scale: 1.035 } : undefined}
      whileTap={selectedIndex === null ? { scale: 0.96 } : undefined}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 22,
        delay: selectedIndex === null ? index * 0.055 : 0,
      }}
      className="group relative flex flex-col items-center justify-between overflow-hidden rounded-[22px] border border-[#C88A2B]/40 border-t-[#FDE68A]/55 p-3.5 sm:p-4 backdrop-blur-md perspective-1000 cursor-pointer shadow-[0_16px_34px_-12px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(254,240,138,0.24)] hover:border-[#F4CA73]/80 hover:border-t-[#FEF08A]/85 hover:shadow-[0_22px_44px_-10px_rgba(229,174,78,0.36),inset_0_1px_0_rgba(254,240,138,0.45)] transition-[border-color,box-shadow] duration-300 focus:outline-none"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 18%, rgba(229, 174, 78, 0.16) 0%, rgba(48, 25, 15, 0.94) 52%, rgba(15, 7, 4, 0.99) 100%)',
      }}
    >
      {/* Subtle luxury micro-grid & concentric studio rings inside each tile */}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 220"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22]"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={`tileGrid-${uid}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.7" fill="#FDE68A" fillOpacity="0.45" />
          </pattern>
        </defs>
        <rect width="200" height="220" fill={`url(#tileGrid-${uid})`} />
        <circle cx="100" cy="86" r="56" stroke="#F4CA73" strokeOpacity="0.22" strokeWidth="0.8" fill="none" />
        <circle cx="100" cy="86" r="76" stroke="#C88A2B" strokeOpacity="0.14" strokeDasharray="3 4" strokeWidth="0.7" fill="none" />
      </svg>

      {/* Diagonal satin gallery sheen across card background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -left-10 h-44 w-28 rotate-[28deg] bg-gradient-to-r from-transparent via-[#FEF08A]/[0.08] to-transparent blur-sm"
      />

      {/* Dynamic cursor-tracked radial spotlight sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: spotlight.active ? 1 : 0,
          background: `radial-gradient(210px circle at ${spotlight.x}% ${spotlight.y}%, rgba(254, 240, 138, 0.24), rgba(200, 138, 43, 0.09) 46%, transparent 74%)`,
        }}
      />

      {/* Subtle glassmorphic top highlight strip */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#FEF08A]/55 to-transparent"
      />

      {/* 3D Floating Box Stage */}
      <div className="relative z-10 my-1 flex w-full flex-col items-center justify-center pt-1 pb-2 perspective-1000">
        {/* Ambient back studio glow synchronized with levitation */}
        <motion.div
          aria-hidden="true"
          style={{
            scale: auraScale,
            opacity: auraOpacity,
            background: `radial-gradient(circle, ${palette.glow} 0%, rgba(253, 224, 71, 0.14) 55%, transparent 76%)`,
          }}
          className="pointer-events-none absolute top-3 h-24 w-24 sm:h-28 sm:w-28 rounded-full blur-xl will-change-transform"
        />

        {/* Levitating 3D Isometric Gift Box */}
        <motion.div
          style={{
            y: boxY,
            scale: boxScale,
          }}
          className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center will-change-transform"
        >
          <div
            style={{
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transition: 'transform 140ms ease-out',
            }}
            className="w-full h-full preserve-3d"
          >
            <svg
              viewBox="0 0 130 124"
              className="w-full h-full overflow-visible"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                {/* Metallic 24k satin ribbon */}
                <linearGradient id={goldRibId} x1="20" y1="18" x2="110" y2="112" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={palette.ribbonStart} />
                  <stop offset="32%" stopColor="#FFFBEB" />
                  <stop offset="56%" stopColor={palette.ribbonMid} />
                  <stop offset="85%" stopColor={palette.ribbonEnd} />
                  <stop offset="100%" stopColor={palette.ribbonMid} />
                </linearGradient>

                {/* Shaded side ribbon for realistic fold depth */}
                <linearGradient id={goldShadeId} x1="65" y1="44" x2="108" y2="106" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={palette.ribbonMid} />
                  <stop offset="55%" stopColor={palette.ribbonEnd} />
                  <stop offset="100%" stopColor="#5A3409" />
                </linearGradient>

                {/* Sculpted bow loop highlight */}
                <linearGradient id={bowFillId} x1="36" y1="22" x2="94" y2="48" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFFBEB" />
                  <stop offset="38%" stopColor={palette.ribbonStart} />
                  <stop offset="76%" stopColor={palette.ribbonMid} />
                  <stop offset="100%" stopColor={palette.ribbonEnd} />
                </linearGradient>

                {/* Multi-stop 3D lit box faces */}
                <linearGradient id={boxFrontId} x1="23" y1="54" x2="65" y2="114" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={palette.lid} />
                  <stop offset="28%" stopColor={palette.front} />
                  <stop offset="100%" stopColor={palette.side} />
                </linearGradient>

                <linearGradient id={boxSideId} x1="65" y1="54" x2="107" y2="112" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={palette.front} />
                  <stop offset="45%" stopColor={palette.side} />
                  <stop offset="100%" stopColor={palette.side} />
                </linearGradient>

                <linearGradient id={boxLidId} x1="18" y1="26" x2="112" y2="66" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                  <stop offset="100%" stopColor={palette.lid} stopOpacity="0" />
                </linearGradient>

                <linearGradient id={boxRimId} x1="18" y1="45" x2="65" y2="78" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={palette.lid} />
                  <stop offset="100%" stopColor={palette.front} />
                </linearGradient>

                <filter id={boxDropId} x="-22%" y="-22%" width="144%" height="144%">
                  <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#050201" floodOpacity="0.62" />
                </filter>
              </defs>

              <g filter={`url(#${boxDropId})`}>
                {/* Left Front 3D Lit Face */}
                <polygon
                  points="23,56 65,76 65,112 23,92"
                  fill={`url(#${boxFrontId})`}
                  stroke={palette.ribbonStart}
                  strokeOpacity="0.38"
                  strokeWidth="0.9"
                />
                {/* Right Shaded 3D Face */}
                <polygon
                  points="65,76 107,56 107,92 65,112"
                  fill={`url(#${boxSideId})`}
                  stroke={palette.ribbonMid}
                  strokeOpacity="0.28"
                  strokeWidth="0.9"
                />

                {/* Vertical Gold Ribbons on Front & Right faces */}
                <polygon points="39.5,64 49.5,68.8 49.5,104.8 39.5,100" fill={`url(#${goldRibId})`} />
                <line x1="41.2" y1="65" x2="41.2" y2="100.8" stroke="#FFFBEB" strokeOpacity="0.6" strokeWidth="0.9" />

                <polygon points="80.5,68.8 90.5,64 90.5,100 80.5,104.8" fill={`url(#${goldShadeId})`} />
                <line x1="82" y1="68.3" x2="82" y2="104" stroke={palette.ribbonStart} strokeOpacity="0.45" strokeWidth="0.8" />

                {/* Subtle cast shadow directly beneath overhanging lid */}
                <polygon points="23,56 65,76 65,80.5 23,60.5" fill="#000000" fillOpacity="0.26" />
                <polygon points="65,76 107,56 107,60.5 65,80.5" fill="#000000" fillOpacity="0.32" />

                {/* 3D Overhanging Lid */}
                {/* Lid Left Rim */}
                <polygon
                  points="17,44 65,67 65,78 17,55"
                  fill={`url(#${boxRimId})`}
                  stroke={palette.ribbonStart}
                  strokeOpacity="0.55"
                  strokeWidth="0.9"
                />
                {/* Lid Right Rim */}
                <polygon
                  points="65,67 113,44 113,55 65,78"
                  fill={palette.side}
                  stroke={palette.ribbonMid}
                  strokeOpacity="0.45"
                  strokeWidth="0.9"
                />
                {/* Lid Top Diamond Face */}
                <polygon
                  points="65,23 113,44 65,67 17,44"
                  fill={palette.lid}
                  stroke="#FEF08A"
                  strokeOpacity="0.68"
                  strokeWidth="1.05"
                />
                {/* Top surface specular highlight sheen */}
                <polygon points="65,23 113,44 65,67 17,44" fill={`url(#${boxLidId})`} />

                {/* Crisp Center Edge Highlight along front corner */}
                <line x1="65" y1="67" x2="65" y2="112" stroke="#FEF08A" strokeOpacity="0.38" strokeWidth="0.9" />

                {/* Crossed Ribbons on Lid Top */}
                <polygon points="41,33.5 51,29.2 92,48.8 82,53.2" fill={`url(#${goldRibId})`} />
                <polygon points="89,33.5 79,29.2 38,48.8 48,53.2" fill={`url(#${goldRibId})`} />
                {/* Folded ribbons down the lid rims */}
                <polygon points="38,54 48,58.8 48,69.8 38,65" fill={`url(#${goldRibId})`} />
                <polygon points="82,58.8 92,54 92,65 82,69.8" fill={`url(#${goldShadeId})`} />

                {/* 3D Sculpted Satin Bow with tail folds & center knot highlight */}
                {/* Bow tails */}
                <path
                  d="M62 43 C54 48, 46 53, 41 56 L47 58 C53 54, 59 49, 64 44 Z"
                  fill={`url(#${goldShadeId})`}
                />
                <path
                  d="M68 43 C76 48, 84 53, 89 56 L83 58 C77 54, 71 49, 66 44 Z"
                  fill={`url(#${goldShadeId})`}
                />
                {/* Left & Right upper bow loops */}
                <path
                  d="M65 42 C51 24, 31 28, 39 41 C44 49, 57 46, 65 42 Z"
                  fill={`url(#${bowFillId})`}
                  stroke="#FFFBEB"
                  strokeOpacity="0.75"
                  strokeWidth="0.9"
                />
                <path
                  d="M65 42 C79 24, 99 28, 91 41 C86 49, 73 46, 65 42 Z"
                  fill={`url(#${bowFillId})`}
                  stroke="#FFFBEB"
                  strokeOpacity="0.75"
                  strokeWidth="0.9"
                />
                {/* Inner bow loop depth folds */}
                <path d="M44 38 C49 34, 57 38, 62 41" stroke={palette.ribbonEnd} strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M86 38 C81 34, 73 38, 68 41" stroke={palette.ribbonEnd} strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
                {/* Satin Center Knot */}
                <ellipse cx="65" cy="41.5" rx="6" ry="5" fill={`url(#${bowFillId})`} stroke="#92400E" strokeWidth="0.9" />
                <ellipse cx="63.5" cy="39.8" rx="2.4" ry="1.4" fill="#FFFFFF" fillOpacity="0.75" />
              </g>
            </svg>
          </div>
        </motion.div>

        {/* Dynamic Ground Contact Shadow: scales down & softens as box levitates higher */}
        <motion.div
          aria-hidden="true"
          style={{
            scaleX: shadowScaleX,
            scaleY: shadowScaleY,
            opacity: shadowOpacity,
          }}
          className="relative z-0 -mt-1.5 h-3.5 w-20 sm:w-24 rounded-full bg-gradient-to-r from-transparent via-black/90 to-transparent blur-[3.5px] will-change-transform"
        />
        {/* Subtle champagne floor reflection disc */}
        <motion.div
          aria-hidden="true"
          style={{
            scaleX: shadowScaleX,
            opacity: auraOpacity,
          }}
          className="pointer-events-none -mt-2.5 h-2 w-16 rounded-full bg-gradient-to-r from-transparent via-[#FDE68A]/25 to-transparent blur-[4px] will-change-transform"
        />
      </div>

      {/* Bottom label */}
      <div className="relative z-10 w-full text-center pt-1">
        <p className="font-serif text-xs sm:text-sm font-semibold tracking-wide text-[#FFF7E2]">
          Cajita {roman}
        </p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#E5AE4E]/85 group-hover:text-[#FEF08A] transition-colors">
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
  randomizeGifts = true,
  onSelectGift,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';

  // Present 4 to 6 3D mystery boxes drawn from active gifts (stable across background sync polls)
  const giftIdsKey = activeGifts.map((g) => g.id).join('|');
  const boxGifts = useMemo(() => {
    const pool = activeGifts.length > 0 ? activeGifts : [];
    if (pool.length === 0) return [];
    const targetCount = Math.min(9, Math.max(4, pool.length));
    const orderedPool = randomizeGifts ? cryptoShuffle(pool) : pool;
    const result: GiftItem[] = [];
    for (let i = 0; i < targetCount; i++) {
      result.push(orderedPool[i % orderedPool.length]);
    }
    return randomizeGifts ? cryptoShuffle(result) : result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftIdsKey, randomizeGifts]);

  const handleBoxPick = (tileGift: GiftItem, idx: number) => {
    if (selectedIndex !== null) return;
    setSelectedIndex(idx);
    const awardedGift =
      randomizeGifts && activeGifts.length > 0 ? cryptoRandomPick(activeGifts) : tileGift;
    window.setTimeout(() => {
      onSelectGift(awardedGift, idx);
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
      <div className="relative overflow-hidden rounded-[34px] bg-[#FFFDF9]/82 backdrop-blur-xl border border-[#DFC9AB]/80 autumn-card-shadow px-5 py-7 sm:px-8 sm:py-9">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#4B644A]" />

        <div className="text-center max-w-md mx-auto mb-6">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#22150E] leading-tight">
            {firstName}, elige una <span className="gold-foil-text">cajita de regalo</span>
          </h2>
          <p className="mt-2 text-sm text-[#5C4332]">
            {randomizeGifts
              ? 'Cada cajita mezcla premios Royal Prestige al azar. Toca cualquiera para elevarla, girarla y descubrir tu obsequio exclusivo.'
              : 'Toca cualquiera de las cajas dentro del recuadro para elevarla, girarla y descubrir tu obsequio exclusivo.'}
          </p>
        </div>

        {/* Dedicated 3D HD Floating Showcase Gallery */}
        <div
          className="relative overflow-hidden rounded-[26px] border border-[#C88A2B]/55 border-t-[#FDE68A]/60 p-4 sm:p-5 shadow-[0_24px_52px_-16px_rgba(24,11,5,0.72),inset_0_2px_28px_rgba(0,0,0,0.7)]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, #3E2114 0%, #1F1009 46%, #110703 100%)',
          }}
        >
          {/* Architectural 3D Perspective Stage Horizon & Radial Depth */}
          <svg
            aria-hidden="true"
            viewBox="0 0 640 360"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
            preserveAspectRatio="none"
          >
            <line x1="0" y1="220" x2="640" y2="220" stroke="#F4CA73" strokeOpacity="0.16" strokeWidth="1" />
            <line x1="320" y1="220" x2="40" y2="360" stroke="#F4CA73" strokeOpacity="0.14" strokeWidth="0.9" />
            <line x1="320" y1="220" x2="180" y2="360" stroke="#F4CA73" strokeOpacity="0.14" strokeWidth="0.9" />
            <line x1="320" y1="220" x2="320" y2="360" stroke="#F4CA73" strokeOpacity="0.18" strokeWidth="0.9" />
            <line x1="320" y1="220" x2="460" y2="360" stroke="#F4CA73" strokeOpacity="0.14" strokeWidth="0.9" />
            <line x1="320" y1="220" x2="600" y2="360" stroke="#F4CA73" strokeOpacity="0.14" strokeWidth="0.9" />
            <circle cx="320" cy="145" r="190" stroke="#E5AE4E" strokeOpacity="0.1" strokeDasharray="5 6" fill="none" />
          </svg>

          {/* Diagonal volumetric light shafts */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 left-1/4 h-64 w-32 -skew-x-12 bg-gradient-to-b from-[#FEF08A]/12 via-[#E5AE4E]/5 to-transparent blur-xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 right-1/4 h-64 w-28 skew-x-12 bg-gradient-to-b from-[#FDE68A]/10 via-[#C88A2B]/4 to-transparent blur-xl"
          />

          {/* Top specular rim hairline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#FEF08A]/65 to-transparent"
          />

          {/* Top studio champagne spotlight cone */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -top-4 -translate-x-1/2 h-40 w-4/5 blur-2xl opacity-55"
            style={{
              background: 'radial-gradient(ellipse at top, rgba(253, 230, 138, 0.55), rgba(200, 138, 43, 0.16) 55%, transparent 78%)',
            }}
          />

          {/* Subtle bottom warm floor bounce glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 h-24 w-3/4 blur-2xl opacity-35"
            style={{
              background: 'radial-gradient(ellipse at bottom, rgba(229, 174, 78, 0.45), transparent 75%)',
            }}
          />

          <div
            className={`relative z-10 grid gap-3 sm:gap-4 ${
              boxGifts.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {boxGifts.map((gift, index) => (
              <GiftBox3DTile
                key={`mystery-box-${index}`}
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
