import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import {
  Check,
  Copy,
  Download,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  RotateCcw,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import type { GiftItem, GiftThemeId, ShowcaseStyleId } from '../../types/app';
import { normalizeReferralCode } from '../../services/storeClient';
import { getStoredReferralCode } from '../../utils/referralTracking';
import { resolveBoxPalette } from '../../shared/giftThemes';
import {
  GiftIllustration,
  StudioPlinthBase,
  resolveGiftUsageTip,
  resolveShowcaseTokens,
} from '../gifts/GiftIllustration';
import { saveCouponInvoicePng } from './couponInvoice';
import {
  BOOST_TIERS,
  generateShareQrAssets,
  getPublicLandingUrl,
  playDopamineChime,
  resolveBoostTier,
  triggerQrDownload,
  type ShareQrAssets,
} from './shareQrCard';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';

interface GiftRevealStageProps {
  leadName: string;
  leadPhone?: string;
  leadAddress?: string;
  gift: GiftItem;
  claimCode: string;
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  showcaseStyle?: ShowcaseStyleId;
  referralCode?: string | null;
  referrerName?: string | null;
  referrerAvatarUrl?: string | null;
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
  leadPhone,
  leadAddress,
  gift,
  claimCode,
  giftTheme,
  customBoxColor,
  showcaseStyle = 'luminous-gold',
  referralCode = null,
  referrerName = null,
  referrerAvatarUrl = null,
  onStartAnother,
}) => {
  const prefersReduced = Boolean(useReducedMotion());
  const effectiveReferralCode =
    normalizeReferralCode(referralCode) || getStoredReferralCode() || null;
  const cleanReferrerName = referrerName?.trim() || null;
  const cleanReferrerAvatarUrl = referrerAvatarUrl?.trim() || null;
  const expectedLandingUrl = getPublicLandingUrl(effectiveReferralCode);
  const [phase, setPhase] = useState<RevealPhase>(() => (prefersReduced ? 'revealed' : 'floating'));
  const [climaxFlash, setClimaxFlash] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceSaved, setInvoiceSaved] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [qrAssets, setQrAssets] = useState<ShareQrAssets | null>(null);
  const [sharingQr, setSharingQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [pulseWave, setPulseWave] = useState(0);
  const [qrSharedFeedback, setQrSharedFeedback] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<RevealPhase>(phase);
  const boostBurstRef = useRef<(() => void) | null>(null);
  const invoiceTimerRef = useRef<number | null>(null);
  const qrTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const currentTier = resolveBoostTier(shareCount);

  useEffect(() => {
    let active = true;
    generateShareQrAssets(expectedLandingUrl, {
      referralCode: effectiveReferralCode,
      referrerName: cleanReferrerName,
      referrerAvatarUrl: cleanReferrerAvatarUrl,
    })
      .then((assets) => {
        if (active) setQrAssets(assets);
      })
      .catch(() => {
        // Non-blocking: generated lazily on click
      });

    return () => {
      active = false;
    };
  }, [expectedLandingUrl, effectiveReferralCode, cleanReferrerName, cleanReferrerAvatarUrl]);

  useEffect(() => {
    return () => {
      if (invoiceTimerRef.current !== null) {
        window.clearTimeout(invoiceTimerRef.current);
      }
      if (qrTimerRef.current !== null) {
        window.clearTimeout(qrTimerRef.current);
      }
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

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

    boostBurstRef.current = () => {
      const cx = width / 2;
      const cy = height * 0.74;
      const count = width < 480 ? 48 : 74;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.45;
        const speed = 2.8 + Math.random() * 8.2;
        const roll = Math.random();
        particles.push({
          x: cx + (Math.random() - 0.5) * 90,
          y: cy + (Math.random() - 0.5) * 26,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          size: roll > 0.45 ? 4.6 + Math.random() * 4.8 : 2.2 + Math.random() * 3,
          alpha: 1,
          decay: 0.011 + Math.random() * 0.01,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          kind: roll > 0.7 ? 'leaf' : roll > 0.25 ? 'starburst' : 'spark',
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.2,
          gravity: 0.09,
        });
      }
    };

    rafId = requestAnimationFrame(render);
    return () => {
      boostBurstRef.current = null;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [prefersReduced]);

  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';
  const cleanPhone = leadPhone?.trim() || '';
  const cleanAddress = leadAddress?.trim() || '';
  const usageTip = resolveGiftUsageTip(gift);
  const publicLandingUrl =
    qrAssets && qrAssets.targetUrl === expectedLandingUrl
      ? qrAssets.targetUrl
      : expectedLandingUrl;
  const whatsappQrMessage = `¡Hola! Participa en la experiencia exclusiva de The Ciprian Company, destapa tu regalo de cocina y participa por hasta $2,000 USD aquí: ${publicLandingUrl}`;
  const whatsappQrHref = `https://wa.me/?text=${encodeURIComponent(whatsappQrMessage)}`;

  const triggerBoostCelebration = (msg: string) => {
    setShareCount((prev) => {
      const next = prev + 1;
      const nextTier = resolveBoostTier(next);
      playDopamineChime(nextTier.level, prefersReduced);
      return next;
    });
    setPulseWave((prev) => prev + 1);
    boostBurstRef.current?.();
    setQrSharedFeedback(msg);
    if (qrTimerRef.current !== null) {
      window.clearTimeout(qrTimerRef.current);
    }
    qrTimerRef.current = window.setTimeout(() => {
      setQrSharedFeedback(null);
    }, 4400);
  };

  const ensureQrAssets = async (): Promise<ShareQrAssets> => {
    if (qrAssets && qrAssets.targetUrl === expectedLandingUrl) {
      return qrAssets;
    }
    const fresh = await generateShareQrAssets(expectedLandingUrl, {
      referralCode: effectiveReferralCode,
      referrerName: cleanReferrerName,
      referrerAvatarUrl: cleanReferrerAvatarUrl,
    });
    setQrAssets(fresh);
    return fresh;
  };

  const handleShareQrWhatsApp = async () => {
    if (sharingQr) return;
    setSharingQr(true);
    try {
      const assets = await ensureQrAssets();
      const shareMessage = `¡Hola! Participa en la experiencia exclusiva de The Ciprian Company, destapa tu regalo de cocina y participa por hasta $2,000 USD aquí: ${assets.targetUrl}`;
      const shareWhatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
        try {
          if (nav.canShare({ files: [assets.file] })) {
            await nav.share({
              title: 'The Ciprian Company · Código QR de Premio',
              text: shareMessage,
              files: [assets.file],
            });
            triggerBoostCelebration('¡QR VIP compartido! Tu multiplicador dorado subió.');
            return;
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
        }
      }

      triggerQrDownload(assets);
      window.open(shareWhatsappHref, '_blank', 'noopener,noreferrer');
      triggerBoostCelebration('¡Tarjeta QR HD descargada y lista en WhatsApp!');
    } catch {
      window.open(whatsappQrHref, '_blank', 'noopener,noreferrer');
    } finally {
      setSharingQr(false);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicLandingUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = publicLandingUrl;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopiedLink(false), 2600);
      triggerBoostCelebration('¡Enlace VIP copiado! Compártelo para subir de nivel.');
    } catch {
      setQrSharedFeedback('No se pudo copiar el enlace en este navegador.');
    }
  };

  const handleDownloadQrCard = async () => {
    if (sharingQr) return;
    setSharingQr(true);
    try {
      const assets = await ensureQrAssets();
      triggerQrDownload(assets);
      triggerBoostCelebration('¡Tarjeta QR HD guardada! Compártela para multiplicar oportunidades.');
    } catch {
      setQrSharedFeedback('No se pudo generar la tarjeta QR. Intenta nuevamente.');
    } finally {
      setSharingQr(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (savingInvoice) return;
    setSavingInvoice(true);
    setInvoiceError(null);
    try {
      await saveCouponInvoicePng({
        leadName,
        leadPhone: cleanPhone || undefined,
        leadAddress: cleanAddress || undefined,
        claimCode,
        gift,
      });
      setInvoiceSaved(true);
      if (invoiceTimerRef.current !== null) {
        window.clearTimeout(invoiceTimerRef.current);
      }
      invoiceTimerRef.current = window.setTimeout(() => {
        setInvoiceSaved(false);
      }, 3200);
    } catch {
      setInvoiceError('No se pudo generar la factura en este navegador. Intenta de nuevo.');
    } finally {
      setSavingInvoice(false);
    }
  };

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

              {/* Refined Order Number & Delivery Information Card */}
              <div className="mt-3.5 sm:mt-4 w-full rounded-2xl bg-[#160B06]/68 backdrop-blur-md border border-[#C88A2B]/35 px-3.5 sm:px-5 py-3.5 sm:py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B89B7A]">
                      Número de orden
                    </p>
                    <p className="mt-0.5 font-mono text-lg sm:text-2xl font-bold tracking-[0.14em] text-[#F4CA73] tabular-nums">
                      {claimCode}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                    <Check className="h-3 w-3" />
                    Código válido
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-[#C88A2B]/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-[#E8D5BE] min-w-0">
                    <User className="h-3.5 w-3.5 text-[#C88A2B] shrink-0" />
                    <span className="text-[#A88D71] shrink-0">Titular:</span>
                    <span className="font-semibold text-[#FFFDF9] truncate">{leadName}</span>
                  </div>
                  {cleanPhone && (
                    <div className="flex items-center gap-2 text-[#E8D5BE] min-w-0">
                      <Phone className="h-3.5 w-3.5 text-[#C88A2B] shrink-0" />
                      <span className="text-[#A88D71] shrink-0">Tel:</span>
                      <span className="font-semibold text-[#FFFDF9] truncate tabular-nums">{cleanPhone}</span>
                    </div>
                  )}
                  {cleanAddress && (
                    <div className={`flex items-center gap-2 text-[#E8D5BE] min-w-0 ${cleanPhone ? 'sm:col-span-2' : ''}`}>
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

              {/* Masterized Post-Reveal Dopamine QR Booster Card ($2,000 USD) */}
              <div className="mt-4 w-full rounded-[22px] border border-[#F4CA73]/45 bg-gradient-to-br from-[#2B170C]/90 via-[#1B130B]/92 to-[#130905]/95 backdrop-blur-md p-3.5 sm:p-4 text-left shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(254,240,138,0.2)]">
                {/* Booster Header + Pulsing Multiplier Pill */}
                <div className="flex items-center justify-between gap-2.5 mb-2.5">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 mb-1">
                      <Zap className="h-2.5 w-2.5 fill-emerald-300/40" />
                      Multiplica tus probabilidades · Hasta $2,000 USD
                    </div>
                    <p className="text-[11.5px] leading-snug text-[#EFE2D0]">
                      {currentTier.message}
                    </p>
                  </div>

                  <div className="relative shrink-0">
                    {!prefersReduced && pulseWave > 0 && (
                      <motion.span
                        key={`reveal-ring-${pulseWave}`}
                        aria-hidden="true"
                        initial={{ scale: 0.85, opacity: 0.9 }}
                        animate={{ scale: 1.65, opacity: 0 }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-[#FEF08A]"
                      />
                    )}
                    <motion.div
                      key={`reveal-tier-${currentTier.level}-${shareCount}`}
                      initial={prefersReduced ? undefined : { scale: 0.82, rotate: -3 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                      className={`rounded-xl border px-2.5 py-1 text-center ${
                        currentTier.level >= 4
                          ? 'border-[#FEF08A] bg-gradient-to-br from-[#FEF08A] via-[#E5AE4E] to-[#B45309] text-[#1A0D06]'
                          : currentTier.level >= 2
                            ? 'border-[#FDE68A]/70 bg-[#4A2710] text-[#FEF08A]'
                            : 'border-[#C88A2B]/45 bg-[#1B0D06] text-[#F4CA73]'
                      }`}
                    >
                      <span className="block font-mono text-xs sm:text-sm font-extrabold leading-none">
                        {currentTier.badge}
                      </span>
                      <span className="block mt-0.5 text-[8.5px] font-bold uppercase tracking-wider opacity-90">
                        Nivel {currentTier.level}
                      </span>
                    </motion.div>
                  </div>
                </div>

                {/* 4-Tier Interactive Progress Meter */}
                <div className="mb-3">
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#120703] border border-[#C88A2B]/30">
                    <motion.div
                      initial={false}
                      animate={{ width: `${currentTier.progress}%` }}
                      transition={
                        prefersReduced
                          ? { duration: 0.15 }
                          : { type: 'spring', stiffness: 210, damping: 22 }
                      }
                      className="h-full rounded-full bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#FEF08A] shadow-[0_0_12px_rgba(253,224,71,0.65)]"
                    />
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
                    {BOOST_TIERS.map((tier) => (
                      <span
                        key={tier.level}
                        className={`text-[9.5px] font-semibold truncate ${
                          currentTier.level === tier.level
                            ? 'text-[#FEF08A]'
                            : currentTier.level > tier.level
                              ? 'text-[#E5AE4E]'
                              : 'text-[#8B6F56]'
                        }`}
                      >
                        {tier.shortLabel}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Live Miniature QR Share Card Preview + Attribution */}
                <div className="flex items-center gap-3 rounded-xl border border-[#C88A2B]/30 bg-[#140905]/80 p-2.5">
                  <motion.button
                    type="button"
                    onClick={handleDownloadQrCard}
                    disabled={sharingQr}
                    whileHover={prefersReduced ? undefined : { scale: 1.05 }}
                    whileTap={prefersReduced ? undefined : { scale: 0.95 }}
                    aria-label="Descargar tarjeta QR HD"
                    className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#F4CA73]/55 bg-[#0F0603] p-1 shadow-md cursor-pointer"
                  >
                    {qrAssets?.previewDataUrl ? (
                      <img
                        src={qrAssets.previewDataUrl}
                        alt="Vista previa de Tarjeta QR para compartir por WhatsApp"
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <QrCode className="h-7 w-7 text-[#F4CA73]" />
                    )}
                    <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1B0E07]/90 border border-[#F4CA73]/60 text-[#FEF08A]">
                      <Download className="h-2.5 w-2.5" />
                    </span>
                  </motion.button>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug text-[#EFE2D0]">
                      Al <strong className="text-[#FFFDF9]">compartir este QR por WhatsApp</strong> con
                      amigos o familiares aumentas tus probabilidades de ganar{' '}
                      <strong className="text-[#FDE047]">hasta $2,000 USD</strong>.
                    </p>
                    {effectiveReferralCode && (
                      <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#E5AE4E]/40 bg-[#E5AE4E]/14 pl-1.5 pr-2.5 py-0.5 text-[10.5px] font-medium text-[#F4CA73]">
                        <AmbassadorAvatar
                          name={cleanReferrerName || effectiveReferralCode}
                          avatarUrl={cleanReferrerAvatarUrl}
                          size="xs"
                          ring="gold"
                          className="h-6 w-6 shrink-0 ring-offset-[#140905]"
                        />
                        <span>
                          Invitación VIP{' '}
                          {cleanReferrerName ? (
                            <>
                              de <strong className="text-[#FFFDF9]">{cleanReferrerName}</strong> ·{' '}
                            </>
                          ) : null}
                          Tag{' '}
                          <span className="font-mono font-bold tracking-wider text-[#FEF08A]">
                            {effectiveReferralCode}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {qrSharedFeedback && (
                    <motion.p
                      key={qrSharedFeedback}
                      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      {qrSharedFeedback}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {invoiceError && (
                <p className="mt-3 w-full rounded-xl border border-red-400/40 bg-red-950/50 px-3.5 py-2 text-xs text-red-200">
                  {invoiceError}
                </p>
              )}

              <div className="mt-4 sm:mt-5 flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleSaveInvoice}
                  disabled={savingInvoice}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F4CA73] via-[#E5AE4E] to-[#C88A2B] px-5 py-3 text-sm font-bold text-[#1E110A] shadow-[0_12px_28px_-8px_rgba(229,174,78,0.55)] hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-75"
                >
                  {savingInvoice ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando factura...
                    </>
                  ) : invoiceSaved ? (
                    <>
                      <Check className="h-4 w-4" />
                      Factura guardada
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Guardar cupón (Factura)
                    </>
                  )}
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  <motion.button
                    type="button"
                    onClick={handleShareQrWhatsApp}
                    disabled={sharingQr}
                    whileHover={prefersReduced ? undefined : { scale: 1.015, y: -1 }}
                    whileTap={prefersReduced ? undefined : { scale: 0.975 }}
                    className="relative w-full min-h-[48px] overflow-hidden inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/55 bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 px-4 py-3 text-sm font-bold text-[#FFFDF9] shadow-[0_12px_26px_-8px_rgba(16,185,129,0.55)] hover:brightness-110 transition-all cursor-pointer disabled:opacity-75"
                  >
                    {!prefersReduced && (
                      <motion.span
                        aria-hidden="true"
                        animate={{ x: ['-140%', '260%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      />
                    )}
                    <span className="relative inline-flex items-center gap-2">
                      {sharingQr ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                      Compartir QR por WhatsApp
                    </span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleCopyInviteLink}
                    whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full border border-[#F4CA73]/45 bg-[#2A170D]/85 px-4 py-3 text-sm font-semibold text-[#FEF08A] hover:bg-[#3A2012] transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-300" />
                        <span className="text-emerald-200">¡Enlace VIP copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copiar enlace</span>
                      </>
                    )}
                  </motion.button>
                </div>

                <button
                  type="button"
                  onClick={onStartAnother}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-full border border-[#C88A2B]/35 bg-transparent px-5 py-2.5 text-sm font-medium text-[#E8D5BE] hover:bg-white/5 transition-colors cursor-pointer"
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
