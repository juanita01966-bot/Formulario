import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { MapPin, MessageCircle, RotateCcw, Sparkles, User } from 'lucide-react';
import type { GiftItem, GiftThemeId, ShowcaseStyleId } from '../../types/app';
import { resolveBoxPalette } from '../../shared/giftThemes';
import {
  GiftIllustration,
  StudioPlinthBase,
  resolveGiftUsageTip,
  resolveShowcaseTokens,
} from '../gifts/GiftIllustration';

interface GiftRevealStageProps {
  leadName: string;
  leadAddress?: string;
  gift: GiftItem;
  claimCode: string;
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  showcaseStyle?: ShowcaseStyleId;
  onStartAnother: () => void;
}

type RevealPhase = 'floating' | 'spinning' | 'opening' | 'revealed';

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  kind: 'spark' | 'starburst' | 'leaf';
  rotation: number;
  vr: number;
  gravity?: number;
}

const SPARK_COLORS = ['#FFFFFF', '#FFFBEB', '#FEF08A', '#FDE047', '#F59E0B', '#E5AE4E'];

/** Real CSS 3D Cube Gift Box with hinged top lid & golden satin ribbons */
const Real3DGiftCube: React.FC<{
  phase: RevealPhase;
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  prefersReduced?: boolean;
}> = ({ phase, giftTheme, customBoxColor, prefersReduced = false }) => {
  const isOpening = phase === 'opening';
  const palette = resolveBoxPalette(giftTheme, customBoxColor, 0);

  const faceGradient = `linear-gradient(180deg, ${palette.lid} 0%, ${palette.front} 42%, ${palette.side} 100%)`;
  const sideGradient = `linear-gradient(180deg, ${palette.front} 0%, ${palette.side} 58%, #150905 100%)`;
  const lidSkirtGradient = `linear-gradient(180deg, ${palette.lid} 0%, ${palette.front} 72%, ${palette.side} 100%)`;
  const lidTopGradient = `linear-gradient(135deg, ${palette.lid} 0%, ${palette.front} 55%, ${palette.side} 100%)`;
  const ribbonVerticalGradient = `linear-gradient(90deg, ${palette.ribbonEnd} 0%, ${palette.ribbonMid} 24%, #FFFBEB 50%, ${palette.ribbonStart} 76%, ${palette.ribbonEnd} 100%)`;
  const ribbonHorizontalGradient = `linear-gradient(180deg, ${palette.ribbonStart} 0%, #FFFBEB 45%, ${palette.ribbonMid} 75%, ${palette.ribbonEnd} 100%)`;

  return (
    <div className="relative h-48 w-48 sm:h-56 sm:w-56 flex items-center justify-center perspective-1000">
      {/* Ground / Floating Pedestal Halo */}
      <motion.div
        className="pointer-events-none absolute bottom-3 h-8 w-36 sm:w-40 rounded-full blur-lg will-change-transform"
        style={{
          background: `radial-gradient(ellipse, ${palette.glow} 0%, rgba(253,224,71,0.38) 55%, transparent 78%)`,
        }}
        animate={{
          scale:
            prefersReduced
              ? 1.1
              : phase === 'floating'
                ? [1.1, 0.78, 0.88]
                : phase === 'spinning'
                  ? [0.85, 1.08, 0.85]
                  : 1.55,
          opacity: phase === 'opening' ? 1 : 0.65,
        }}
        transition={{ duration: 0.85, repeat: !prefersReduced && phase === 'spinning' ? Infinity : 0, ease: 'easeInOut' }}
      />
      {/* Crisp contact shadow anchored on floor */}
      <motion.div
        className="pointer-events-none absolute bottom-4 h-3.5 w-24 sm:w-28 rounded-full bg-black/75 blur-[4px] will-change-transform"
        animate={{
          scaleX:
            prefersReduced
              ? 0.9
              : phase === 'floating'
                ? [1.05, 0.76, 0.84]
                : phase === 'spinning'
                  ? [0.82, 0.7, 0.82]
                  : 0.95,
          opacity: phase === 'opening' ? 0.22 : 0.6,
        }}
        transition={{ duration: 0.85, repeat: !prefersReduced && phase === 'spinning' ? Infinity : 0, ease: 'easeInOut' }}
      />

      {/* 3D Animated Container: Stage 1 Floating -> Stage 2 Spinning on Own Axis -> Stage 3 Opening */}
      <motion.div
        className="relative w-32 h-32 preserve-3d will-change-transform"
        initial={prefersReduced ? { scale: 0.95, opacity: 0 } : { y: 36, scale: 0.84, rotateX: -14, rotateY: -25 }}
        animate={
          prefersReduced
            ? { y: 0, scale: isOpening ? 1.06 : 1, rotateX: -16, rotateY: -24, opacity: 1 }
            : phase === 'floating'
              ? {
                  y: [-4, -22, -12, -20],
                  scale: [0.88, 1.02, 1, 1.03],
                  rotateX: [-14, -18, -15],
                  rotateY: [-25, -18, -32],
                }
              : phase === 'spinning'
                ? {
                    y: [-20, -26, -18],
                    scale: 1.06,
                    rotateX: [-16, -22, -16],
                    rotateY: [-32, 328, 688, 1048],
                  }
                : {
                    y: [-18, -12, 4],
                    scale: [1.06, 1.2, 0.96],
                    rotateX: -18,
                    rotateY: 1080,
                  }
        }
        transition={
          prefersReduced
            ? { duration: 0.35 }
            : phase === 'floating'
              ? { duration: 1.1, ease: 'easeInOut' }
              : phase === 'spinning'
                ? { duration: 1.6, ease: [0.32, 0.05, 0.28, 1] }
                : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }
        }
      >
        {/* 3D Cube Side Faces (128x128px, translateZ = 64px) */}
        {[
          { key: 'front', transform: 'translateZ(64px)', bg: faceGradient },
          { key: 'back', transform: 'rotateY(180deg) translateZ(64px)', bg: sideGradient },
          { key: 'right', transform: 'rotateY(90deg) translateZ(64px)', bg: sideGradient },
          { key: 'left', transform: 'rotateY(-90deg) translateZ(64px)', bg: faceGradient },
        ].map((face) => (
          <div
            key={face.key}
            style={{ transform: face.transform, background: face.bg }}
            className="absolute inset-0 rounded-lg border border-[#FDE68A]/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-12px_20px_rgba(0,0,0,0.3)] overflow-hidden backface-hidden"
          >
            {/* Under-lid subtle shadow band */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-black/30 to-transparent" />
            {/* Vertical & Horizontal Golden Satin Ribbons */}
            <div
              style={{ background: ribbonVerticalGradient }}
              className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 shadow-[0_0_8px_rgba(0,0,0,0.28)]"
            />
            <div
              style={{ background: ribbonHorizontalGradient }}
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-5 opacity-95 shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
            />
          </div>
        ))}

        {/* Cube Bottom Face */}
        <div
          style={{ transform: 'rotateX(-90deg)', backgroundColor: palette.side }}
          className="absolute left-0 top-[64px] w-32 h-32 rounded-lg border border-[#C88A2B]/40"
        />

        {/* Interior Glowing Core (shines out when lid opens!) */}
        <motion.div
          style={{ transform: 'rotateX(90deg)' }}
          animate={{ opacity: isOpening ? 1 : 0.2 }}
          className="absolute left-0 -top-[64px] w-32 h-32 rounded-lg bg-gradient-to-br from-[#FFFBEB] via-[#FDE047] to-[#F59E0B] shadow-[0_0_50px_rgba(253,224,71,0.95)]"
        />

        {/* Vertical Light Beam Bursting Out When Opening */}
        {isOpening && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0.2, scaleX: 0.5 }}
            animate={{ opacity: [0, 1, 0.85], scaleY: [0.2, 1.45, 1.8], scaleX: [0.6, 1.35, 1.6] }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            style={{ transformOrigin: 'bottom center' }}
            className="pointer-events-none absolute -top-44 left-1/2 -translate-x-1/2 w-36 h-48 bg-gradient-to-t from-amber-200 via-yellow-200/60 to-transparent blur-md"
          />
        )}

        {/* Hinged 3D Lid (140px x 30px x 140px sitting on top of cube) */}
        <motion.div
          className="absolute -top-4 -left-[6px] w-[140px] h-[30px] preserve-3d"
          animate={
            isOpening
              ? {
                  y: -78,
                  z: -24,
                  rotateX: 52,
                  rotateZ: -10,
                  opacity: 0,
                }
              : { y: 0, z: 0, rotateX: 0, rotateZ: 0, opacity: 1 }
          }
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          {[
            { key: 'lid-f', transform: 'translateZ(70px)' },
            { key: 'lid-b', transform: 'rotateY(180deg) translateZ(70px)' },
            { key: 'lid-r', transform: 'rotateY(90deg) translateZ(70px)' },
            { key: 'lid-l', transform: 'rotateY(-90deg) translateZ(70px)' },
          ].map((skirt) => (
            <div
              key={skirt.key}
              style={{ transform: skirt.transform, background: lidSkirtGradient }}
              className="absolute inset-0 rounded-md border border-[#FEF08A]/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] overflow-hidden"
            >
              <div
                style={{ background: ribbonVerticalGradient }}
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6"
              />
            </div>
          ))}

          {/* Lid Top Cap (140x140 centered at y = 0 => top: -70px) */}
          <div
            style={{ transform: 'rotateX(90deg)', background: lidTopGradient }}
            className="absolute left-0 -top-[70px] w-[140px] h-[140px] rounded-lg border border-[#FEF08A]/80 shadow-[inset_0_0_24px_rgba(255,255,255,0.18)] overflow-hidden"
          >
            <div
              style={{ background: ribbonVerticalGradient }}
              className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6"
            />
            <div
              style={{ background: ribbonHorizontalGradient }}
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-6"
            />
          </div>

          {/* 3D Crossed Satin Bow on top of the lid */}
          <div
            style={{ transform: 'translateY(-18px) rotateY(35deg)' }}
            className="absolute left-1/2 -translate-x-1/2 top-0 w-16 h-6 rounded-full border-4 border-[#FEF08A] bg-[#D4942A]/60 shadow-[0_6px_14px_rgba(0,0,0,0.4)]"
          />
          <div
            style={{ transform: 'translateY(-18px) rotateY(-55deg)' }}
            className="absolute left-1/2 -translate-x-1/2 top-0 w-16 h-6 rounded-full border-4 border-[#FEF08A] bg-[#D4942A]/60 shadow-[0_6px_14px_rgba(0,0,0,0.4)]"
          />
          <div
            style={{ transform: 'translateY(-14px)' }}
            className="absolute left-1/2 -translate-x-1/2 top-0 w-[18px] h-[18px] rounded-full bg-gradient-to-br from-[#FFFBEB] via-[#FEF08A] to-[#D4942A] shadow-[0_0_14px_rgba(254,240,138,0.95)]"
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

/** Luminous Floating Product on Multi-Layered Pedestal Stage for the Final Revealed Gift */
const RevealedGiftShowcase: React.FC<{
  gift: GiftItem;
  showcaseStyle?: ShowcaseStyleId;
  prefersReduced?: boolean;
}> = ({ gift, showcaseStyle = 'luminous-gold', prefersReduced = false }) => {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [spotlight, setSpotlight] = useState({ x: 50, y: 38, active: false });
  const [supportsFineHover, setSupportsFineHover] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setSupportsFineHover(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }
  }, []);

  const lift = useMotionValue(0);
  const giftY = useTransform(lift, [0, 1], [4, -16]);
  const giftRotate = useTransform(lift, [0, 0.5, 1], [-0.9, 0, 0.9]);
  const shadowScaleX = useTransform(lift, [0, 1], [1.08, 0.62]);
  const shadowScaleY = useTransform(lift, [0, 1], [1.05, 0.65]);
  const shadowOpacity = useTransform(lift, [0, 1], [0.8, 0.24]);
  const auraScale = useTransform(lift, [0, 1], [0.96, 1.15]);
  const auraOpacity = useTransform(lift, [0, 1], [0.76, 1]);

  useEffect(() => {
    if (prefersReduced) {
      lift.set(0.45);
      return;
    }
    const controls = animate(lift, [0, 1, 0], {
      duration: 2.9,
      repeat: Infinity,
      ease: 'easeInOut',
    });
    return () => controls.stop();
  }, [lift, prefersReduced]);

  const accent = gift.accentColor || '#C88A2B';
  const tokens = resolveShowcaseTokens(showcaseStyle);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!supportsFineHover || prefersReduced) return;
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

  const handleMouseLeave = () => {
    if (!supportsFineHover) return;
    setTilt({ rx: 0, ry: 0 });
    setSpotlight((prev) => ({ ...prev, active: false }));
  };

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 0 } : { y: 12, opacity: 0, scale: 0.93 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={supportsFineHover ? handleMouseMove : undefined}
      onMouseLeave={supportsFineHover ? handleMouseLeave : undefined}
      style={{ background: tokens.revealGlassBg }}
      className={`relative mb-4 sm:mb-5 flex h-[254px] sm:h-[304px] w-full max-w-[320px] sm:max-w-[376px] flex-col items-center justify-end overflow-hidden rounded-[24px] sm:rounded-[28px] border ${tokens.stageBorder} backdrop-blur-md px-3.5 sm:px-4 pt-5 sm:pt-6 pb-4 sm:pb-5 perspective-1000 shadow-[0_24px_54px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.34)]`}
    >
      {/* Top specular highlight hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
      />

      {/* Volumetric Rotating Sunbeams / God-Rays Behind the Product (GPU transform-only) */}
      <motion.div
        aria-hidden="true"
        animate={prefersReduced ? undefined : { rotate: 360 }}
        transition={prefersReduced ? undefined : { duration: 24, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 h-[340px] w-[340px] sm:h-[400px] sm:w-[400px] opacity-80 will-change-transform"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg 14deg, rgba(255, 251, 235, 0.32) 22deg, rgba(253, 224, 71, 0.22) 29deg, transparent 38deg 66deg, rgba(255, 251, 235, 0.28) 74deg, rgba(244, 202, 115, 0.2) 82deg, transparent 92deg 128deg, rgba(255, 251, 235, 0.34) 136deg, rgba(253, 224, 71, 0.22) 144deg, transparent 154deg 192deg, rgba(255, 251, 235, 0.28) 200deg, rgba(244, 202, 115, 0.18) 208deg, transparent 218deg 256deg, rgba(255, 251, 235, 0.32) 264deg, rgba(253, 224, 71, 0.2) 272deg, transparent 282deg 318deg, rgba(255, 251, 235, 0.26) 326deg, transparent 340deg 360deg)',
          maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 14%, rgba(0,0,0,0.45) 48%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(circle, rgba(0,0,0,1) 14%, rgba(0,0,0,0.45) 48%, transparent 72%)',
        }}
      />

      {/* Counter-Rotating Secondary Sunbeam Halo for Dimensional Depth */}
      <motion.div
        aria-hidden="true"
        animate={prefersReduced ? undefined : { rotate: -360 }}
        transition={prefersReduced ? undefined : { duration: 36, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 h-[310px] w-[310px] sm:h-[360px] sm:w-[360px] opacity-65 will-change-transform"
        style={{
          background:
            'conic-gradient(from 25deg, transparent 0deg 28deg, rgba(254, 240, 138, 0.24) 40deg, transparent 54deg 110deg, rgba(255, 251, 235, 0.24) 124deg, transparent 140deg 205deg, rgba(253, 224, 71, 0.22) 220deg, transparent 236deg 295deg, rgba(255, 251, 235, 0.22) 310deg, transparent 326deg 360deg)',
          maskImage: 'radial-gradient(circle, rgba(0,0,0,0.95) 16%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,0.95) 16%, transparent 70%)',
        }}
      />

      {/* Interactive cursor spotlight sheen */}
      {supportsFineHover && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: spotlight.active ? 1 : 0,
            background: `radial-gradient(230px circle at ${spotlight.x}% ${spotlight.y}%, ${tokens.spotlightTint}, transparent 72%)`,
          }}
        />
      )}

      {/* Amplified Golden Aura Behind the Product */}
      <motion.div
        aria-hidden="true"
        style={{
          scale: auraScale,
          opacity: auraOpacity,
          background: `radial-gradient(circle at 50% 46%, rgba(255, 251, 235, 0.56) 0%, rgba(253, 224, 71, 0.36) 28%, ${tokens.auraCore} 48%, ${accent}24 62%, transparent 78%)`,
        }}
        className="pointer-events-none absolute top-3 sm:top-4 h-52 w-60 sm:h-56 sm:w-72 rounded-full blur-xl will-change-transform"
      />

      {/* Pulsing 4-Point Cross Starlight Gleam Centered Behind Product */}
      {!prefersReduced && (
        <motion.div
          aria-hidden="true"
          animate={{ scale: [0.9, 1.16, 0.9], opacity: [0.46, 0.88, 0.46] }}
          transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-1/2 top-[43%] -translate-x-1/2 -translate-y-1/2 z-10 h-44 w-44 sm:h-48 sm:w-48 will-change-transform"
        >
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[2px] w-full rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(254,240,138,0.5) 35%, rgba(255,255,255,0.95) 50%, rgba(254,240,138,0.5) 65%, transparent 100%)',
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-full rounded-full"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(254,240,138,0.45) 35%, rgba(255,255,255,0.92) 50%, rgba(254,240,138,0.45) 65%, transparent 100%)',
            }}
          />
        </motion.div>
      )}

      {/* Initial Reveal Bloom Flash Inside Showcase Frame */}
      {!prefersReduced && (
        <motion.div
          aria-hidden="true"
          initial={{ scale: 0.35, opacity: 0.96 }}
          animate={{ scale: 1.55, opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-30 h-56 w-56 rounded-full will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(254,240,138,0.72) 32%, rgba(229,174,78,0.22) 60%, transparent 78%)',
          }}
        />
      )}

      {/* Subtle Animated Diagonal Specular Light Sweep Across Pedestal Showcase */}
      {!prefersReduced && (
        <motion.div
          aria-hidden="true"
          animate={{ x: ['-170%', '380%'], opacity: [0, 0.72, 0] }}
          transition={{
            duration: 1.45,
            repeat: Infinity,
            repeatDelay: 3.2,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="pointer-events-none absolute -top-[28%] left-0 z-30 h-[160%] w-24 -skew-x-[22deg] will-change-transform"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255, 251, 235, 0.22) 42%, rgba(255, 255, 255, 0.36) 52%, rgba(254, 240, 138, 0.14) 64%, transparent 100%)',
          }}
        />
      )}

      {/* Floating Transparent PNG Product Bathing in Bottom Podium Spotlight */}
      <motion.div
        style={{ y: giftY, rotate: giftRotate }}
        className="relative z-20 -mb-2 flex items-center justify-center will-change-transform"
      >
        <div
          style={{
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${spotlight.active ? 1.04 : 1})`,
            transition: 'transform 160ms ease-out',
            filter: 'drop-shadow(0 16px 24px rgba(254, 240, 138, 0.3))',
          }}
          className="preserve-3d"
        >
          <GiftIllustration
            visualKey={gift.visualKey}
            customImageUrl={gift.customImageUrl}
            accentColor={accent}
            size={156}
            className="sm:!w-[198px] sm:!h-[198px]"
            variant="clean"
            alt={gift.name}
          />
        </div>
      </motion.div>

      {/* Realistic Architectural Stone / Wood Showroom Plinth */}
      <StudioPlinthBase
        showcaseStyle={showcaseStyle}
        size="lg"
        shadowScaleX={shadowScaleX}
        shadowScaleY={shadowScaleY}
        shadowOpacity={shadowOpacity}
      />
    </motion.div>
  );
};

export const GiftRevealStage: React.FC<GiftRevealStageProps> = ({
  leadName,
  leadAddress,
  gift,
  claimCode,
  giftTheme,
  customBoxColor,
  showcaseStyle = 'luminous-gold',
  onStartAnother,
}) => {
  const prefersReduced = Boolean(useReducedMotion());
  const [phase, setPhase] = useState<RevealPhase>(() => (prefersReduced ? 'revealed' : 'floating'));
  const [climaxFlash, setClimaxFlash] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<RevealPhase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Explicit 3-stage animation timeline: Floating -> Spinning -> Opening -> Climax Flash -> Revealed
  useEffect(() => {
    if (prefersReduced) {
      setPhase('revealed');
      setClimaxFlash(false);
      return;
    }

    const tSpin = window.setTimeout(() => setPhase('spinning'), 1100);
    const tOpen = window.setTimeout(() => setPhase('opening'), 2750);
    const tFlash = window.setTimeout(() => setClimaxFlash(true), 3380);
    const tReveal = window.setTimeout(() => setPhase('revealed'), 3680);

    return () => {
      window.clearTimeout(tSpin);
      window.clearTimeout(tOpen);
      window.clearTimeout(tFlash);
      window.clearTimeout(tReveal);
    };
  }, [prefersReduced]);

  // 60 FPS Canvas Sparkles & Starburst ("Destellos") Engine
  useEffect(() => {
    if (prefersReduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const particles: SparkParticle[] = [];
    const isNarrow = width < 480;
    let burstFired = false;
    let revealBurstFired = false;
    let rafId = 0;
    let frame = 0;

    const spawnBurstDestellos = () => {
      const cx = width / 2;
      const cy = height * 0.41;
      const count = width < 480 ? 115 : 165;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
        const speed = 2.6 + Math.random() * 9.5;
        const roll = Math.random();
        particles.push({
          x: cx + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 18,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.4,
          size: roll > 0.52 ? 5.5 + Math.random() * 6 : 2.2 + Math.random() * 3.4,
          alpha: 1,
          decay: 0.0085 + Math.random() * 0.009,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          kind: roll > 0.87 ? 'leaf' : roll > 0.36 ? 'starburst' : 'spark',
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.16,
          gravity: 0.052,
        });
      }
    };

    const spawnRevealDestellos = () => {
      const cx = width / 2;
      const cy = Math.min(205, height * 0.27);
      const count = width < 480 ? 58 : 88;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 2.0 + Math.random() * 6.8;
        const roll = Math.random();
        particles.push({
          x: cx + (Math.random() - 0.5) * 24,
          y: cy + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          size: roll > 0.4 ? 5 + Math.random() * 5.8 : 2.2 + Math.random() * 2.8,
          alpha: 1,
          decay: 0.011 + Math.random() * 0.009,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          kind: roll > 0.28 ? 'starburst' : 'spark',
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.14,
          gravity: 0.018,
        });
      }
    };

    const spawnSpinOrbits = (intense: boolean) => {
      const cx = width / 2;
      const cy = height * 0.44;
      const angle = frame * (intense ? 0.22 : 0.08) + Math.random() * Math.PI * 2;
      const radius = intense ? 56 + Math.random() * 44 : 42 + Math.random() * 34;
      particles.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * 24 + (Math.random() - 0.5) * 38,
        vx: (Math.random() - 0.5) * (intense ? 1.8 : 0.7),
        vy: -1.1 - Math.random() * (intense ? 2.2 : 1.1),
        size: intense ? 2.8 + Math.random() * 3.8 : 1.8 + Math.random() * 2.2,
        alpha: 0.95,
        decay: 0.022 + Math.random() * 0.015,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        kind: Math.random() > 0.52 ? 'starburst' : 'spark',
        rotation: Math.random() * Math.PI,
        vr: 0.09,
        gravity: -0.012,
      });
    };

    const drawStarburst = (x: number, y: number, r: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      // Fast 2-pass soft bloom without software ctx.shadowBlur
      ctx.globalAlpha = alpha * 0.26;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const theta = (i * Math.PI) / 2;
        ctx.lineTo(Math.cos(theta) * r * 2.15, Math.sin(theta) * r * 2.15);
        ctx.lineTo(Math.cos(theta + Math.PI / 4) * r * 0.32, Math.sin(theta + Math.PI / 4) * r * 0.32);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      const cur = phaseRef.current;
      if (cur === 'floating' && frame % 5 === 0) {
        spawnSpinOrbits(false);
      } else if (cur === 'spinning' && frame % (isNarrow ? 3 : 2) === 0) {
        spawnSpinOrbits(true);
        if (!isNarrow) spawnSpinOrbits(true);
      } else if (cur === 'opening' && !burstFired) {
        burstFired = true;
        spawnBurstDestellos();
      } else if (cur === 'revealed') {
        if (!revealBurstFired) {
          revealBurstFired = true;
          spawnRevealDestellos();
        }
        if (frame % (isNarrow ? 7 : 5) === 0) {
          const zoneTop = 52;
          const zoneBottom = Math.min(310, height * 0.42);
          particles.push({
            x: width * (0.16 + Math.random() * 0.68),
            y: zoneTop + Math.random() * Math.max(80, zoneBottom - zoneTop),
            vx: (Math.random() - 0.5) * 0.7,
            vy: -0.55 - Math.random() * 0.9,
            size: 2.8 + Math.random() * 3.2,
            alpha: 0.95,
            decay: 0.014 + Math.random() * 0.008,
            color: Math.random() > 0.35 ? '#FEF08A' : '#FFFFFF',
            kind: 'starburst',
            rotation: Math.random() * Math.PI,
            vr: 0.06,
            gravity: -0.004,
          });
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity ?? (cur === 'floating' || cur === 'spinning' ? -0.012 : 0.05);
        p.vx *= 0.988;
        p.rotation += p.vr;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        if (p.kind === 'starburst') {
          drawStarburst(p.x, p.y, p.size, p.rotation, p.color, p.alpha);
        } else if (p.kind === 'leaf') {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.15, p.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.25;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [prefersReduced]);

  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';
  const cleanAddress = leadAddress?.trim() || '';
  const usageTip = resolveGiftUsageTip(gift);
  const whatsappText = encodeURIComponent(
    `Hola! Acabo de activar mi experiencia en The Ciprian Company. Mi nombre es ${leadName}${cleanAddress ? ` (${cleanAddress})` : ''}, destapé el regalo "${gift.name}" con código ${claimCode}.`
  );

  const stageHeadline =
    phase === 'floating'
      ? `Elevando tu regalo, ${firstName}...`
      : phase === 'spinning'
        ? 'Preparando tu obsequio...'
        : 'Abriendo tu obsequio exclusivo...';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-[560px] mx-auto"
    >
      <div
        className="relative overflow-hidden rounded-[26px] sm:rounded-[34px] border border-[#C88A2B]/50 border-t-[#FDE68A]/55 backdrop-blur-xl shadow-[0_30px_80px_-15px_rgba(34,21,14,0.68),inset_0_1px_0_rgba(254,240,138,0.24)] px-4 py-6 sm:px-9 sm:py-10 text-center text-[#FAF3E8]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 18%, rgba(59, 31, 19, 0.78) 0%, rgba(28, 13, 7, 0.84) 52%, rgba(17, 7, 3, 0.88) 100%)',
        }}
      >
        {/* Architectural stage horizon rings & diagonal warm studio spotlights */}
        <svg
          aria-hidden="true"
          viewBox="0 0 540 620"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
          preserveAspectRatio="none"
        >
          <circle cx="270" cy="240" r="140" stroke="#F4CA73" strokeOpacity="0.24" strokeWidth="0.9" fill="none" />
          <circle cx="270" cy="240" r="205" stroke="#C88A2B" strokeOpacity="0.16" strokeDasharray="4 6" strokeWidth="0.9" fill="none" />
          <line x1="0" y1="365" x2="540" y2="365" stroke="#F4CA73" strokeOpacity="0.16" strokeWidth="1" />
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none hidden sm:block absolute -top-16 left-1/4 h-72 w-28 -skew-x-12 bg-gradient-to-b from-[#FEF08A]/12 via-[#E5AE4E]/4 to-transparent blur-xl"
        />

        {/* Canvas Starburst Sparks Layer */}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full z-20" />

        {/* Ambient Radial Golden Glow */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[34%] sm:top-[38%] -translate-x-1/2 -translate-y-1/2 h-72 w-72 sm:h-80 sm:w-80 rounded-full blur-2xl sm:blur-3xl will-change-transform"
          animate={
            prefersReduced
              ? { scale: 1.1, opacity: 0.6 }
              : {
                  scale:
                    phase === 'opening'
                      ? [1, 1.85, 1.45]
                      : phase === 'revealed'
                        ? [1.25, 1.12]
                        : phase === 'spinning'
                          ? [1, 1.32, 1]
                          : 1.08,
                  opacity: phase === 'opening' ? 0.95 : phase === 'revealed' ? 0.72 : 0.55,
                }
          }
          transition={{ duration: 0.85, repeat: !prefersReduced && phase === 'spinning' ? Infinity : 0, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.74) 0%, rgba(200, 90, 50, 0.25) 52%, transparent 75%)',
          }}
        />

        {/* Dramatic Climax Light Flash ("Destello Final") across opening -> revealed transition */}
        {climaxFlash && !prefersReduced && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
          >
            {/* Primary expanding golden-white radial bloom flare */}
            <motion.div
              initial={{ scale: 0.16, opacity: 0 }}
              animate={{ scale: [0.16, 1.38, 2.05], opacity: [0, 0.96, 0] }}
              transition={{ duration: 1.05, times: [0, 0.26, 1], ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 h-80 w-80 sm:h-96 sm:w-96 rounded-full will-change-transform"
              style={{
                background:
                  'radial-gradient(circle, rgba(255, 255, 255, 0.98) 0%, rgba(255, 251, 235, 0.9) 20%, rgba(254, 240, 138, 0.62) 44%, rgba(229, 174, 78, 0.2) 66%, transparent 78%)',
              }}
            />

            {/* Crisp anamorphic horizontal lens flare streak */}
            <motion.div
              initial={{ scaleX: 0.12, scaleY: 0.5, opacity: 0 }}
              animate={{ scaleX: [0.12, 1.3, 1.75], scaleY: [0.5, 1.25, 0.25], opacity: [0, 0.95, 0] }}
              transition={{ duration: 0.92, times: [0, 0.24, 1], ease: 'easeOut' }}
              className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 h-16 w-[115%] rounded-full will-change-transform"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(255,255,255,0.96) 0%, rgba(254,240,138,0.72) 28%, rgba(229,174,78,0.22) 56%, transparent 76%)',
              }}
            />

            {/* Expanding golden shockwave light ring */}
            <motion.div
              initial={{ scale: 0.22, opacity: 0.95 }}
              animate={{ scale: 1.7, opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 h-64 w-64 sm:h-72 sm:w-72 rounded-full border-2 border-[#FFFBEB]/85 shadow-[0_0_24px_rgba(254,240,138,0.65)] will-change-transform"
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase !== 'revealed' ? (
            <motion.div
              key="gift-box-3d-stage"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 1.18 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="relative z-10 py-4 sm:py-6 flex flex-col items-center justify-center min-h-[340px] sm:min-h-[400px]"
            >
              <Real3DGiftCube
                phase={phase}
                giftTheme={giftTheme}
                customBoxColor={customBoxColor}
                prefersReduced={prefersReduced}
              />

              <h3 className="mt-4 sm:mt-5 font-serif text-xl sm:text-2xl font-semibold text-[#FFF7E2]">
                {stageHeadline}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-amber-200/80 max-w-xs sm:max-w-sm">
                Un instante mientras descubrimos el obsequio de cocina de tu caja.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="gift-revealed-card"
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              {/* Bespoke Concierge Certificate Header (fits cleanly on 360px+ without overflow) */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 w-full max-w-sm mb-4 sm:mb-5">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#C88A2B]/65" />
                <span className="text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-[0.11em] sm:tracking-[0.2em] text-[#E5AE4E] leading-tight sm:whitespace-nowrap">
                  Certificado Oficial · The Ciprian Company
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#C88A2B]/65" />
              </div>

              {/* Realistic Architectural Plinth Showcase */}
              <RevealedGiftShowcase
                gift={gift}
                showcaseStyle={showcaseStyle}
                prefersReduced={prefersReduced}
              />

              <h2 className="mt-1 font-serif text-[22px] sm:text-[31px] font-semibold text-[#FFFDF9] leading-tight px-1">
                {gift.name}
              </h2>
              <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-[#DECAB4] px-1">
                {gift.subtitle}
              </p>

              {/* Dedicated "Máximo Provecho" Card Strip */}
              <div className="mt-4 sm:mt-5 w-full rounded-2xl border border-[#E5AE4E]/30 bg-gradient-to-br from-[#2B170D]/68 via-[#1E0F08]/74 to-[#150A05]/78 backdrop-blur-md px-3.5 sm:px-4 py-3.5 text-left shadow-[inset_0_1px_0_rgba(254,240,138,0.16)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5AE4E]/15 border border-[#F4CA73]/40 shrink-0">
                    <Sparkles className="h-3 w-3 text-[#F4CA73]" />
                  </span>
                  <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-[#F4CA73]">
                    Cómo sacarle el máximo provecho
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] leading-relaxed text-[#F5E7D6]">
                  {usageTip}
                </p>
              </div>

              {/* Refined Folio & Delivery Information Card */}
              <div className="mt-3.5 sm:mt-4 w-full rounded-2xl bg-[#160B06]/68 backdrop-blur-md border border-[#C88A2B]/35 px-3.5 sm:px-5 py-3.5 sm:py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B89B7A]">
                    Folio de reclamación
                  </p>
                  <p className="mt-0.5 font-mono text-lg sm:text-2xl font-bold tracking-[0.14em] text-[#F4CA73] tabular-nums">
                    {claimCode}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-[#C88A2B]/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-[#E8D5BE] min-w-0">
                    <User className="h-3.5 w-3.5 text-[#C88A2B] shrink-0" />
                    <span className="text-[#A88D71] shrink-0">Titular:</span>
                    <span className="font-semibold text-[#FFFDF9] truncate">{leadName}</span>
                  </div>
                  {cleanAddress && (
                    <div className="flex items-center gap-2 text-[#E8D5BE] min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-[#C88A2B] shrink-0" />
                      <span className="text-[#A88D71] shrink-0">Ubicación:</span>
                      <span className="font-semibold text-[#FFFDF9] truncate">{cleanAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2.5 text-xs text-[#C4AC92] max-w-sm px-1">
                <img
                  src="/images/logo%20ciprian.png"
                  alt="The Ciprian Company"
                  className="h-7 w-7 rounded-full object-cover border border-[#C88A2B]/50 shrink-0"
                />
                <p className="text-left leading-snug">
                  Un asesor de <strong className="text-[#F4E6D2] font-semibold">The Ciprian Company</strong> se
                  comunicará contigo para coordinar la entrega sin costo.
                </p>
              </div>

              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full">
                <a
                  href={`https://wa.me/?text=${whatsappText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-[#E5AE4E] px-5 py-3 text-sm font-bold text-[#1E110A] shadow-md hover:bg-[#F4CA73] transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Guardar comprobante
                </a>
                <button
                  type="button"
                  onClick={onStartAnother}
                  className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full border border-[#C88A2B]/35 bg-transparent px-5 py-3 text-sm font-medium text-[#E8D5BE] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Nuevo registro
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
