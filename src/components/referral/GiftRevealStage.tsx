import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, MessageCircle, RotateCcw } from 'lucide-react';
import type { GiftItem } from '../../types/app';
import { GiftIllustration } from '../gifts/GiftIllustration';

interface GiftRevealStageProps {
  leadName: string;
  gift: GiftItem;
  claimCode: string;
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
}

const SPARK_COLORS = ['#FFFBEB', '#FEF08A', '#FDE047', '#F59E0B', '#EA580C', '#E5AE4E'];

/** Real CSS 3D Cube Gift Box with hinged top lid & golden satin ribbons */
const Real3DGiftCube: React.FC<{ phase: RevealPhase }> = ({ phase }) => {
  const isOpening = phase === 'opening';

  return (
    <div className="relative h-56 w-56 flex items-center justify-center perspective-1000">
      {/* Ground / Floating Pedestal Halo */}
      <motion.div
        className="pointer-events-none absolute bottom-4 h-7 w-36 rounded-full bg-amber-300/35 blur-md"
        animate={{
          scale: phase === 'floating' ? [1.1, 0.78, 0.86] : phase === 'spinning' ? [0.85, 1.05, 0.85] : 1.4,
          opacity: phase === 'opening' ? 0.9 : 0.55,
        }}
        transition={{ duration: 0.9, repeat: phase === 'spinning' ? Infinity : 0, ease: 'easeInOut' }}
      />

      {/* 3D Animated Container: Stage 1 Floating -> Stage 2 Spinning on Own Axis -> Stage 3 Opening */}
      <motion.div
        className="relative w-32 h-32 preserve-3d"
        initial={{ y: 36, scale: 0.84, rotateX: -14, rotateY: -25 }}
        animate={
          phase === 'floating'
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
                  scale: [1.06, 1.18, 0.94],
                  rotateX: -18,
                  rotateY: 1080,
                }
        }
        transition={
          phase === 'floating'
            ? { duration: 1.2, ease: 'easeInOut' }
            : phase === 'spinning'
              ? { duration: 1.75, ease: [0.32, 0.05, 0.28, 1] }
              : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
        }
      >
        {/* 3D Cube Side Faces (128x128px, translateZ = 64px) */}
        {[
          { key: 'front', transform: 'translateZ(64px)', bg: 'from-[#C85A32] to-[#7D2912]' },
          { key: 'back', transform: 'rotateY(180deg) translateZ(64px)', bg: 'from-[#9E3B1D] to-[#5E1C0B]' },
          { key: 'right', transform: 'rotateY(90deg) translateZ(64px)', bg: 'from-[#A84423] to-[#69210E]' },
          { key: 'left', transform: 'rotateY(-90deg) translateZ(64px)', bg: 'from-[#B84C27] to-[#742610]' },
        ].map((face) => (
          <div
            key={face.key}
            style={{ transform: face.transform }}
            className={`absolute inset-0 rounded-lg bg-gradient-to-b ${face.bg} border border-[#E5AE4E]/65 shadow-inner overflow-hidden backface-hidden`}
          >
            {/* Vertical & Horizontal Golden Satin Ribbons */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-[#C88A2B] via-[#FEF08A] to-[#A66318] shadow" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-5 bg-gradient-to-b from-[#FEF08A]/90 via-[#D4942A] to-[#9A5B14] opacity-90" />
          </div>
        ))}

        {/* Cube Bottom Face */}
        <div
          style={{ transform: 'rotateX(-90deg)' }}
          className="absolute left-0 top-[64px] w-32 h-32 rounded-lg bg-[#421509] border border-[#C88A2B]/40"
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
              style={{ transform: skirt.transform }}
              className="absolute inset-0 rounded-md bg-gradient-to-b from-[#D45A32] to-[#8C3318] border border-[#FDE68A]/70 overflow-hidden"
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-[#C88A2B] via-[#FEF08A] to-[#A66318]" />
            </div>
          ))}

          {/* Lid Top Cap (140x140 centered at y = 0 => top: -70px) */}
          <div
            style={{ transform: 'rotateX(90deg)' }}
            className="absolute left-0 -top-[70px] w-[140px] h-[140px] rounded-lg bg-gradient-to-br from-[#DF653A] to-[#9E3B1D] border border-[#FDE68A]/80 overflow-hidden"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-[#C88A2B] via-[#FEF08A] to-[#A66318]" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-6 bg-gradient-to-b from-[#C88A2B] via-[#FEF08A] to-[#A66318]" />
          </div>

          {/* 3D Crossed Satin Bow on top of the lid */}
          <div
            style={{ transform: 'translateY(-18px) rotateY(35deg)' }}
            className="absolute left-1/2 -translate-x-1/2 top-0 w-16 h-6 rounded-full border-4 border-[#FEF08A] bg-[#D4942A]/50 shadow-lg"
          />
          <div
            style={{ transform: 'translateY(-18px) rotateY(-55deg)' }}
            className="absolute left-1/2 -translate-x-1/2 top-0 w-16 h-6 rounded-full border-4 border-[#FEF08A] bg-[#D4942A]/50 shadow-lg"
          />
          <div
            style={{ transform: 'translateY(-14px)' }}
            className="absolute left-1/2 -translate-x-1/2 top-0 w-4 h-4 rounded-full bg-[#FEF08A] shadow-[0_0_12px_rgba(254,240,138,0.9)]"
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export const GiftRevealStage: React.FC<GiftRevealStageProps> = ({
  leadName,
  gift,
  claimCode,
  onStartAnother,
}) => {
  const [phase, setPhase] = useState<RevealPhase>('floating');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<RevealPhase>('floating');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Explicit 3-stage animation timeline: Floating -> Spinning on Own Axis -> Opening with Destellos -> Revealed
  useEffect(() => {
    const tSpin = window.setTimeout(() => setPhase('spinning'), 1200);
    const tOpen = window.setTimeout(() => setPhase('opening'), 2950);
    const tReveal = window.setTimeout(() => setPhase('revealed'), 3900);

    return () => {
      window.clearTimeout(tSpin);
      window.clearTimeout(tOpen);
      window.clearTimeout(tReveal);
    };
  }, []);

  // 60 FPS Canvas Sparkles & Starburst ("Destellos") Engine
  useEffect(() => {
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
    let burstFired = false;
    let rafId = 0;
    let frame = 0;

    const spawnBurstDestellos = () => {
      const cx = width / 2;
      const cy = height * 0.41;
      for (let i = 0; i < 165; i++) {
        const angle = (Math.PI * 2 * i) / 165 + (Math.random() - 0.5) * 0.35;
        const speed = 2.6 + Math.random() * 9.8;
        const roll = Math.random();
        particles.push({
          x: cx + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 18,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.6,
          size: roll > 0.55 ? 6 + Math.random() * 6 : 2.2 + Math.random() * 3.4,
          alpha: 1,
          decay: 0.0075 + Math.random() * 0.009,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          kind: roll > 0.86 ? 'leaf' : roll > 0.42 ? 'starburst' : 'spark',
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.16,
        });
      }
    };

    const spawnSpinOrbits = (intense: boolean) => {
      const cx = width / 2;
      const cy = height * 0.44;
      const angle = frame * (intense ? 0.22 : 0.08) + Math.random() * Math.PI * 2;
      const radius = intense ? 58 + Math.random() * 44 : 44 + Math.random() * 36;
      particles.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * 26 + (Math.random() - 0.5) * 42,
        vx: (Math.random() - 0.5) * (intense ? 1.8 : 0.7),
        vy: -1.1 - Math.random() * (intense ? 2.2 : 1.1),
        size: intense ? 2.8 + Math.random() * 3.8 : 1.8 + Math.random() * 2.2,
        alpha: 0.95,
        decay: 0.022 + Math.random() * 0.015,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        kind: Math.random() > 0.55 ? 'starburst' : 'spark',
        rotation: Math.random() * Math.PI,
        vr: 0.09,
      });
    };

    const drawStarburst = (x: number, y: number, r: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const theta = (i * Math.PI) / 2;
        ctx.lineTo(Math.cos(theta) * r * 2.1, Math.sin(theta) * r * 2.1);
        ctx.lineTo(Math.cos(theta + Math.PI / 4) * r * 0.35, Math.sin(theta + Math.PI / 4) * r * 0.35);
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
      } else if (cur === 'spinning' && frame % 2 === 0) {
        spawnSpinOrbits(true);
        spawnSpinOrbits(true);
      } else if (cur === 'opening' && !burstFired) {
        burstFired = true;
        spawnBurstDestellos();
      } else if (cur === 'revealed' && frame % 9 === 0) {
        particles.push({
          x: Math.random() * width,
          y: height * 0.88,
          vx: (Math.random() - 0.5) * 0.9,
          vy: -1 - Math.random() * 1.2,
          size: 2.2 + Math.random() * 2.5,
          alpha: 0.85,
          decay: 0.008,
          color: '#FEF08A',
          kind: 'starburst',
          rotation: 0,
          vr: 0.05,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += cur === 'floating' || cur === 'spinning' ? -0.012 : 0.055;
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
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
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
  }, []);

  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';
  const whatsappText = encodeURIComponent(
    `Hola! Acabo de activar mi experiencia en The Ciprian Company. Mi nombre es ${leadName}, destapé el regalo "${gift.name}" con código ${claimCode}.`
  );

  const stageHeadline =
    phase === 'floating'
      ? `Elevando tu regalo, ${firstName}...`
      : phase === 'spinning'
        ? 'Preparando tu obsequio...'
        : 'Abriendo tu obsequio exclusivo...';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-[540px] mx-auto"
    >
      <div className="relative overflow-hidden rounded-[34px] bg-gradient-to-b from-[#2A160D] via-[#1C0D07] to-[#2C1810] border border-[#C88A2B]/55 shadow-[0_30px_80px_-15px_rgba(34,21,14,0.7)] px-6 py-9 sm:px-9 sm:py-11 text-center text-[#FAF3E8]">
        {/* Canvas Starburst Sparks Layer */}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full z-20" />

        {/* Ambient Radial Golden Glow */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full blur-3xl"
          animate={{
            scale: phase === 'opening' ? [1, 1.9, 1.45] : phase === 'spinning' ? [1, 1.35, 1] : 1.1,
            opacity: phase === 'opening' ? 0.95 : 0.55,
          }}
          transition={{ duration: 0.9, repeat: phase === 'spinning' ? Infinity : 0, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.72) 0%, rgba(200, 90, 50, 0.25) 52%, transparent 75%)',
          }}
        />

        <AnimatePresence mode="wait">
          {phase !== 'revealed' ? (
            <motion.div
              key="gift-box-3d-stage"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.14, filter: 'blur(8px)' }}
              transition={{ duration: 0.45 }}
              className="relative z-10 py-6 flex flex-col items-center justify-center min-h-[400px]"
            >
              <Real3DGiftCube phase={phase} />

              <h3 className="mt-5 font-serif text-2xl font-semibold text-[#FFF7E2]">{stageHeadline}</h3>
              <p className="mt-2 text-sm text-amber-200/80">
                Un instante mientras descubrimos el obsequio de cocina de tu caja.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="gift-revealed-card"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              {/* Bespoke Concierge Certificate Header */}
              <div className="flex items-center justify-center gap-3 w-full max-w-xs mb-5">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#C88A2B]/60" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#E5AE4E]">
                  Certificado de Obsequio
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#C88A2B]/60" />
              </div>

              {/* Clean Architectural Pedestal for the Gift */}
              <motion.div
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="relative mb-5 flex h-36 w-36 items-center justify-center rounded-3xl bg-[#FAF4EA] border border-[#C88A2B]/55 shadow-[0_16px_38px_-10px_rgba(0,0,0,0.55)] p-4"
              >
                <div className="pointer-events-none absolute inset-1.5 rounded-[18px] border border-[#DFC9AB]/70" />
                <GiftIllustration
                  visualKey={gift.visualKey}
                  customImageUrl={gift.customImageUrl}
                  accentColor={gift.accentColor}
                  size={104}
                />
              </motion.div>

              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D8B478]">
                {gift.tag}
              </p>
              <h2 className="mt-1.5 font-serif text-2xl sm:text-[30px] font-semibold text-[#FFFDF9] leading-tight">
                {gift.name}
              </h2>
              <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-[#D8C5B0]">
                {gift.subtitle}
              </p>

              {/* Editorial Voucher Ticket Strip */}
              <div className="mt-6 w-full rounded-2xl bg-[#160B06]/85 border border-[#C88A2B]/35 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B89B7A]">
                    Folio de cortesía · {firstName}
                  </p>
                  <p className="mt-0.5 font-mono text-xl font-bold tracking-[0.14em] text-[#F4CA73] tabular-nums">
                    {claimCode}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/60 px-3.5 py-1.5 text-xs font-medium text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Confirmado en catálogo
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2.5 text-xs text-[#C4AC92] max-w-sm">
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

              <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
                <a
                  href={`https://wa.me/?text=${whatsappText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#E5AE4E] px-5 py-3 text-sm font-bold text-[#1E110A] shadow-md hover:bg-[#F4CA73] transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Guardar comprobante
                </a>
                <button
                  type="button"
                  onClick={onStartAnother}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-[#C88A2B]/35 bg-transparent px-5 py-3 text-sm font-medium text-[#E8D5BE] hover:bg-white/5 transition-colors cursor-pointer"
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
