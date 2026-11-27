import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Gift,
  Loader2,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { normalizeReferralCode } from '../../services/storeClient';
import { getStoredReferralCode } from '../../utils/referralTracking';
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

interface GoldenTicketBookletProps {
  leadName: string;
  referralCode?: string | null;
  referrerName?: string | null;
  referrerAvatarUrl?: string | null;
  onStartAnother: () => void;
  onClaimOwnGift?: () => void;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  kind: 'star' | 'confetti' | 'spark';
  rotation: number;
  vr: number;
}

const INSTRUCTIVO_PAGE1_SRC = '/referencias/instructivo-p1.jpg';
const INSTRUCTIVO_PAGE2_SRC = '/referencias/instructivo-p2.jpg';
const BURST_COLORS = ['#FFFDF9', '#FEF08A', '#FDE047', '#F4CA73', '#E5AE4E', '#FB923C', '#34D399'];

export const GoldenTicketBooklet: React.FC<GoldenTicketBookletProps> = ({
  leadName,
  referralCode = null,
  referrerName = null,
  referrerAvatarUrl = null,
  onStartAnother,
  onClaimOwnGift,
}) => {
  const prefersReduced = Boolean(useReducedMotion());
  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';
  const effectiveReferralCode =
    normalizeReferralCode(referralCode) || getStoredReferralCode() || null;
  const cleanReferrerName = referrerName?.trim() || null;
  const cleanReferrerAvatarUrl = referrerAvatarUrl?.trim() || null;
  const expectedTargetUrl = getPublicLandingUrl(effectiveReferralCode);

  const [activePage, setActivePage] = useState<0 | 1>(0);
  const [flipCount, setFlipCount] = useState(0);
  const [peekHint, setPeekHint] = useState(false);
  const [supportsFineHover, setSupportsFineHover] = useState(false);
  const [bookTilt, setBookTilt] = useState({ rx: 0, ry: 0, sx: 50, sy: 30, active: false });

  const [qrAssets, setQrAssets] = useState<ShareQrAssets | null>(null);
  const [sharingQr, setSharingQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [pulseWave, setPulseWave] = useState(0);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const interactedRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<BurstParticle[]>([]);
  const rafRef = useRef<number>(0);

  const currentTier = resolveBoostTier(shareCount);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setSupportsFineHover(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    generateShareQrAssets(expectedTargetUrl, {
      referralCode: effectiveReferralCode,
      referrerName: cleanReferrerName,
      referrerAvatarUrl: cleanReferrerAvatarUrl,
    })
      .then((assets) => {
        if (mounted) setQrAssets(assets);
      })
      .catch(() => {
        // Generated lazily on click if preload fails
      });

    return () => {
      mounted = false;
    };
  }, [expectedTargetUrl, effectiveReferralCode, cleanReferrerName, cleanReferrerAvatarUrl]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Subtle initial corner-peek hint so visitors immediately notice the 3D turning leaf
  useEffect(() => {
    if (prefersReduced) return;
    const tStart = window.setTimeout(() => {
      if (!interactedRef.current) setPeekHint(true);
    }, 520);
    const tEnd = window.setTimeout(() => {
      setPeekHint(false);
    }, 1400);

    return () => {
      window.clearTimeout(tStart);
      window.clearTimeout(tEnd);
    };
  }, [prefersReduced]);

  // Lightweight 60 FPS on-demand celebratory gold confetti & sparkle burst engine
  const runBurstLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawStar = (x: number, y: number, r: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const theta = (i * Math.PI) / 2;
        ctx.lineTo(Math.cos(theta) * r * 2.1, Math.sin(theta) * r * 2.1);
        ctx.lineTo(Math.cos(theta + Math.PI / 4) * r * 0.34, Math.sin(theta + Math.PI / 4) * r * 0.34);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);
      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        p.vx *= 0.985;
        p.rotation += p.vr;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          list.splice(i, 1);
          continue;
        }

        if (p.kind === 'star') {
          drawStar(p.x, p.y, p.size, p.rotation, p.color, p.alpha);
        } else if (p.kind === 'confetti') {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (list.length > 0) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = 0;
        ctx.clearRect(0, 0, width, height);
      }
    };

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(step);
    }
  }, []);

  const fireGoldenBurst = useCallback(
    (intensity: 'normal' | 'high' = 'normal') => {
      if (prefersReduced) return;
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      if (!canvas || !parent) return;

      const cx = parent.clientWidth / 2;
      const cy = parent.clientHeight * 0.72;
      const count = intensity === 'high' ? 78 : 54;

      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.45;
        const speed = 3.2 + Math.random() * (intensity === 'high' ? 9.4 : 7.2);
        const roll = Math.random();
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * 90,
          y: cy + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.6,
          size: roll > 0.55 ? 4.2 + Math.random() * 4.2 : 2.2 + Math.random() * 2.8,
          alpha: 1,
          decay: 0.011 + Math.random() * 0.01,
          color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
          kind: roll > 0.62 ? 'confetti' : roll > 0.28 ? 'star' : 'spark',
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.24,
        });
      }

      runBurstLoop();
    },
    [prefersReduced, runBurstLoop]
  );

  const registerDopamineAction = useCallback(
    (msg: string, highIntensity = false) => {
      setShareCount((prev) => {
        const next = prev + 1;
        const nextTier = resolveBoostTier(next);
        playDopamineChime(nextTier.level, prefersReduced);
        return next;
      });
      setPulseWave((prev) => prev + 1);
      fireGoldenBurst(highIntensity ? 'high' : 'normal');

      setShareFeedback(msg);
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        setShareFeedback(null);
      }, 4000);
    },
    [fireGoldenBurst, prefersReduced]
  );

  const selectPage = (nextPage: 0 | 1) => {
    interactedRef.current = true;
    setPeekHint(false);
    if (nextPage === activePage) return;
    setActivePage(nextPage);
    setFlipCount((c) => c + 1);
  };

  const togglePage = () => {
    selectPage(activePage === 0 ? 1 : 0);
  };

  const handleBookletPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleBookletPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    // Horizontal swipe turns pages; vertical swipe preserves natural scrolling
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      selectPage(dx < 0 ? 1 : 0);
      return;
    }

    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      togglePage();
    }
  };

  const handleBookMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!supportsFineHover || prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setBookTilt({
      rx: (0.5 - py) * 10,
      ry: (px - 0.5) * 12,
      sx: Math.round(px * 100),
      sy: Math.round(py * 100),
      active: true,
    });
  };

  const handleBookMouseLeave = () => {
    if (!supportsFineHover) return;
    setBookTilt({ rx: 0, ry: 0, sx: 50, sy: 30, active: false });
  };

  const ensureQrAssets = async (): Promise<ShareQrAssets> => {
    if (qrAssets && qrAssets.targetUrl === expectedTargetUrl) {
      return qrAssets;
    }
    const fresh = await generateShareQrAssets(expectedTargetUrl, {
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
      const inviteMessage =
        '¡Participa en la experiencia Royal Prestige con The Ciprian Company! Escanea este código QR o entra al enlace oficial para destapar tu regalo directo y participar por hasta $2,000 USD en productos exclusivos:';

      const isTouchDevice =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;

      if (
        isTouchDevice &&
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [assets.file] })
      ) {
        try {
          await navigator.share({
            title: 'The Ciprian Company · Boleto Dorado Royal Prestige',
            text: `${inviteMessage}\n${assets.targetUrl}`,
            files: [assets.file],
          });
          registerDopamineAction('¡QR VIP compartido! Tu multiplicador dorado subió.', true);
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
        }
      }

      triggerQrDownload(assets);
      const waUrl = `https://wa.me/?text=${encodeURIComponent(
        `${inviteMessage} ${assets.targetUrl}`
      )}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      registerDopamineAction('¡Tarjeta QR HD lista y enlace abierto en WhatsApp!', true);
    } catch {
      setShareFeedback('No se pudo preparar el código QR. Intenta nuevamente.');
    } finally {
      setSharingQr(false);
    }
  };

  const handleCopyInviteLink = async () => {
    const target = qrAssets?.targetUrl || expectedTargetUrl;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(target);
      } else {
        const input = document.createElement('textarea');
        input.value = target;
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
      registerDopamineAction('¡Enlace VIP copiado! Compártelo ahora para sumar oportunidades.');
    } catch {
      setShareFeedback('No se pudo copiar el enlace en este navegador.');
    }
  };

  const handleDownloadOnly = async () => {
    if (sharingQr) return;
    setSharingQr(true);
    try {
      const assets = await ensureQrAssets();
      triggerQrDownload(assets);
      registerDopamineAction('¡Tarjeta QR HD descargada! Lista para enviar a amigos y familiares.');
    } catch {
      setShareFeedback('No se pudo descargar el QR. Intenta nuevamente.');
    } finally {
      setSharingQr(false);
    }
  };

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[610px] mx-auto"
    >
      <div
        className="relative overflow-hidden rounded-[26px] sm:rounded-[34px] border border-[#E5AE4E]/55 border-t-[#FEF08A]/70 backdrop-blur-xl shadow-[0_32px_84px_-14px_rgba(24,11,5,0.78),0_0_40px_rgba(229,174,78,0.16),inset_0_1px_0_rgba(254,240,138,0.28)] px-3.5 py-5 sm:px-8 sm:py-8 text-[#FAF3E8]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 8%, rgba(74, 38, 19, 0.92) 0%, rgba(28, 13, 7, 0.95) 50%, rgba(13, 6, 2, 0.98) 100%)',
        }}
      >
        {/* Celebratory 60 FPS Golden Particle Canvas */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
        />

        {/* Top metallic foil hairline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#FEF08A] to-[#4B644A]"
        />

        {/* Subtle ambient studio glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-48 w-80 rounded-full blur-3xl opacity-45"
          style={{
            background: 'radial-gradient(circle, rgba(253,230,138,0.65), rgba(200,138,43,0.15) 60%, transparent 80%)',
          }}
        />

        {/* Header with gleaming VIP Golden Ticket Badge */}
        <div className="relative z-10 text-center max-w-md mx-auto mb-4 sm:mb-5">
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-[#FDE68A]/55 bg-gradient-to-r from-[#3D2210] via-[#5A3214] to-[#3D2210] px-3.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#FEF08A] shadow-[0_8px_22px_-8px_rgba(229,174,78,0.65)] mb-2.5"
          >
            {!prefersReduced && (
              <motion.span
                aria-hidden="true"
                animate={{ x: ['-140%', '260%'] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }}
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
              />
            )}
            <Sparkles className="relative h-3 w-3 text-[#FDE047]" />
            <span className="relative">Boleto Dorado VIP · Hasta $2,000 USD</span>
          </motion.div>

          <h2 className="font-serif text-[22px] sm:text-[29px] font-semibold text-[#FFFDF9] leading-tight">
            {firstName}, comparte tu{' '}
            <span className="bg-gradient-to-r from-[#FFFBEB] via-[#FDE047] to-[#E5AE4E] bg-clip-text text-transparent">
              Folleto Dorado
            </span>
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-[#DECAB4] leading-relaxed">
            Gira o desliza el cuaderno 3D para descubrir los premios de alto nivel y comparte tu
            código QR para multiplicar tus probabilidades.
          </p>
        </div>

        {/* Page Switcher Pill */}
        <div className="relative z-10 grid grid-cols-2 gap-1.5 rounded-2xl border border-[#C88A2B]/40 bg-[#120703]/90 p-1 mb-4">
          <button
            type="button"
            onClick={() => selectPage(0)}
            className={`min-h-[44px] rounded-xl px-2.5 py-2 text-xs sm:text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activePage === 0
                ? 'bg-gradient-to-r from-[#FDE68A] via-[#E5AE4E] to-[#C88A2B] text-[#1E110A] shadow-md'
                : 'text-[#DECAB4] hover:text-[#FFFDF9] hover:bg-white/5'
            }`}
          >
            <span className="truncate">1 · Premios de Alto Nivel</span>
          </button>
          <button
            type="button"
            onClick={() => selectPage(1)}
            className={`min-h-[44px] rounded-xl px-2.5 py-2 text-xs sm:text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activePage === 1
                ? 'bg-gradient-to-r from-[#FDE68A] via-[#E5AE4E] to-[#C88A2B] text-[#1E110A] shadow-md'
                : 'text-[#DECAB4] hover:text-[#FFFDF9] hover:bg-white/5'
            }`}
          >
            <span className="truncate">2 · Instrucciones y Reglas</span>
          </button>
        </div>

        {/* 3D Interactive Flipping Golden Notebook Stage with Pointer-Reactive Tilt & Holographic Sheen */}
        <div className="relative z-10 mx-auto max-w-[392px] select-none">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-[#DECAB4]">
            <span className="inline-flex items-center gap-1.5 text-[#F4CA73]">
              <BookOpen className="h-3.5 w-3.5" />
              {activePage === 0 ? 'Cara 1 de 2 · Premios' : 'Cara 2 de 2 · Reglas'}
            </span>
            <span className="text-[10.5px] text-[#C8A986]">Toca o desliza para girar ↻</span>
          </div>

          <div
            className="relative"
            onMouseMove={supportsFineHover ? handleBookMouseMove : undefined}
            onMouseLeave={supportsFineHover ? handleBookMouseLeave : undefined}
          >
            {/* Layered stacked paper edges beneath the turning sheet */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-1.5 top-2 bottom-2 left-3 rounded-[20px] border border-[#E5AE4E]/35 bg-[#2C180E]/85 shadow-lg"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 top-3.5 bottom-3.5 left-5 rounded-[20px] border border-[#C88A2B]/20 bg-[#1B0E08]/90"
            />

            {/* 3D Perspective Container */}
            <div
              role="button"
              tabIndex={0}
              aria-label={
                activePage === 0
                  ? 'Cara 1: Premios de Alto Nivel. Toca o desliza para ver Instrucciones y Reglas.'
                  : 'Cara 2: Instrucciones y Reglas. Toca o desliza para volver a Premios de Alto Nivel.'
              }
              onPointerDown={handleBookletPointerDown}
              onPointerUp={handleBookletPointerUp}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  togglePage();
                } else if (e.key === 'ArrowRight') {
                  selectPage(1);
                } else if (e.key === 'ArrowLeft') {
                  selectPage(0);
                }
              }}
              style={{ perspective: '1250px', touchAction: 'pan-y' }}
              className="relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FEF08A]/80 rounded-[20px]"
            >
              <div
                style={{
                  transform: `rotateX(${bookTilt.rx}deg) rotateY(${bookTilt.ry}deg)`,
                  transition: 'transform 180ms ease-out',
                  transformStyle: 'preserve-3d',
                }}
              >
                <motion.div
                  animate={{
                    rotateY: activePage === 0 ? (peekHint ? -13 : 0) : -180,
                  }}
                  transition={
                    prefersReduced
                      ? { duration: 0.18 }
                      : { type: 'spring', stiffness: 180, damping: 22, mass: 0.9 }
                  }
                  style={{ transformStyle: 'preserve-3d' }}
                  className="relative aspect-[1100/1460] w-full will-change-transform"
                >
                  {/* FRONT FACE: Cara 1 — Premios de Alto Nivel */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                    className="absolute inset-0 overflow-hidden rounded-[20px] border-2 border-[#F4CA73]/75 bg-[#1A0D07] shadow-[0_22px_52px_-12px_rgba(0,0,0,0.88)]"
                  >
                    <img
                      src={INSTRUCTIVO_PAGE1_SRC}
                      alt="Equipa tu cocina con Royal Prestige y gana premios de alto nivel"
                      draggable={false}
                      className="h-full w-full object-cover object-center select-none pointer-events-none"
                    />

                    {/* Metallic holographic gold cursor sheen */}
                    {supportsFineHover && !prefersReduced && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
                        style={{
                          opacity: bookTilt.active ? 1 : 0,
                          background: `radial-gradient(280px circle at ${bookTilt.sx}% ${bookTilt.sy}%, rgba(254, 240, 138, 0.28), rgba(229, 174, 78, 0.08) 45%, transparent 72%)`,
                        }}
                      />
                    )}

                    {/* Golden spine crease shadow */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-3 left-1 w-[2px] rounded-full bg-gradient-to-b from-transparent via-[#F4CA73]/80 to-transparent"
                    />

                    {/* Specular flip light sweep */}
                    {!prefersReduced && flipCount > 0 && activePage === 0 && (
                      <motion.div
                        key={`sweep-p1-${flipCount}`}
                        aria-hidden="true"
                        initial={{ x: '-130%', opacity: 0 }}
                        animate={{ x: '240%', opacity: [0, 0.62, 0] }}
                        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                        className="pointer-events-none absolute -top-10 left-0 h-[130%] w-24 -skew-x-[20deg] bg-gradient-to-r from-transparent via-[#FFFBEB]/50 to-transparent"
                      />
                    )}
                  </div>

                  {/* BACK FACE: Cara 2 — Reglas de Participación */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                    className="absolute inset-0 overflow-hidden rounded-[20px] border-2 border-[#F4CA73]/75 bg-[#1A0D07] shadow-[0_22px_52px_-12px_rgba(0,0,0,0.88)]"
                  >
                    <img
                      src={INSTRUCTIVO_PAGE2_SRC}
                      alt="Reglas de participación para el anfitrión"
                      draggable={false}
                      className="h-full w-full object-cover object-center select-none pointer-events-none"
                    />

                    {supportsFineHover && !prefersReduced && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
                        style={{
                          opacity: bookTilt.active ? 1 : 0,
                          background: `radial-gradient(280px circle at ${100 - bookTilt.sx}% ${bookTilt.sy}%, rgba(254, 240, 138, 0.28), rgba(229, 174, 78, 0.08) 45%, transparent 72%)`,
                        }}
                      />
                    )}

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-3 left-1 w-[2px] rounded-full bg-gradient-to-b from-transparent via-[#F4CA73]/80 to-transparent"
                    />

                    {!prefersReduced && flipCount > 0 && activePage === 1 && (
                      <motion.div
                        key={`sweep-p2-${flipCount}`}
                        aria-hidden="true"
                        initial={{ x: '-130%', opacity: 0 }}
                        animate={{ x: '240%', opacity: [0, 0.62, 0] }}
                        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                        className="pointer-events-none absolute -top-10 left-0 h-[130%] w-24 -skew-x-[20deg] bg-gradient-to-r from-transparent via-[#FFFBEB]/50 to-transparent"
                      />
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* DOPAMINE MULTIPLIER HUD + HIGH-IMPACT ACTION DOCK */}
        <div className="relative z-10 mt-5 rounded-[24px] border border-[#F4CA73]/45 bg-gradient-to-br from-[#2F180C]/95 via-[#1C0E07]/96 to-[#110703]/98 p-4 sm:p-5 shadow-[0_20px_48px_-14px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(254,240,138,0.22)]">
          {/* Multiplier HUD Header */}
          <div className="flex items-center justify-between gap-2.5 mb-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.15em] text-[#FDE68A]">
                <Zap className="h-3.5 w-3.5 text-[#FDE047] fill-[#FDE047]/30 shrink-0" />
                <span>Multiplicador de Probabilidades · Hasta $2,000 USD</span>
              </div>
              <p className="mt-0.5 text-xs text-[#E5D3BE] leading-snug">
                {currentTier.message}
              </p>
            </div>

            {/* Pulsing Spring Multiplier Pill */}
            <div className="relative shrink-0">
              {!prefersReduced && pulseWave > 0 && (
                <motion.span
                  key={`ring-${pulseWave}`}
                  aria-hidden="true"
                  initial={{ scale: 0.85, opacity: 0.9 }}
                  animate={{ scale: 1.7, opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#FEF08A]"
                />
              )}
              <motion.div
                key={`tier-badge-${currentTier.level}-${shareCount}`}
                initial={prefersReduced ? undefined : { scale: 0.8, rotate: -4 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                className={`rounded-2xl border px-3 py-1.5 text-center shadow-lg ${
                  currentTier.level >= 4
                    ? 'border-[#FEF08A] bg-gradient-to-br from-[#FEF08A] via-[#E5AE4E] to-[#B45309] text-[#1A0D06]'
                    : currentTier.level >= 2
                      ? 'border-[#FDE68A]/75 bg-gradient-to-br from-[#5C3114] to-[#2C160A] text-[#FEF08A]'
                      : 'border-[#C88A2B]/45 bg-[#1B0D06] text-[#F4CA73]'
                }`}
              >
                <p className="font-mono text-sm sm:text-base font-extrabold leading-none tracking-tight">
                  {currentTier.badge}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider opacity-90">
                  Nivel {currentTier.level}
                </p>
              </motion.div>
            </div>
          </div>

          {/* Interactive 4-Tier Progress Bar */}
          <div className="mb-4">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#120703] border border-[#C88A2B]/30">
              <motion.div
                initial={false}
                animate={{ width: `${currentTier.progress}%` }}
                transition={
                  prefersReduced
                    ? { duration: 0.15 }
                    : { type: 'spring', stiffness: 200, damping: 22 }
                }
                className="relative h-full rounded-full bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#FEF08A] shadow-[0_0_16px_rgba(253,224,71,0.7)]"
              >
                {!prefersReduced && (
                  <motion.span
                    aria-hidden="true"
                    animate={{ x: ['-100%', '220%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                  />
                )}
              </motion.div>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1 text-center">
              {BOOST_TIERS.map((tier) => {
                const reached = currentTier.level >= tier.level;
                const active = currentTier.level === tier.level;
                return (
                  <div
                    key={tier.level}
                    className={`rounded-lg px-1 py-1 text-[10px] font-semibold transition-colors ${
                      active
                        ? 'bg-[#E5AE4E]/22 text-[#FEF08A] border border-[#FDE68A]/50'
                        : reached
                          ? 'text-[#F4CA73]'
                          : 'text-[#8E735A]'
                    }`}
                  >
                    <span className="block truncate">{tier.shortLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* QR Preview Thumbnail + Ambassador Tag Attribution */}
          <div className="flex flex-col min-[400px]:flex-row items-center gap-3.5 sm:gap-4 rounded-2xl border border-[#C88A2B]/35 bg-[#150A05]/85 p-3 sm:p-3.5">
            <motion.button
              type="button"
              onClick={handleDownloadOnly}
              disabled={sharingQr}
              whileHover={prefersReduced ? undefined : { scale: 1.04 }}
              whileTap={prefersReduced ? undefined : { scale: 0.96 }}
              aria-label="Descargar tarjeta QR HD"
              className="group relative shrink-0 rounded-2xl border border-[#F4CA73]/60 bg-[#0E0603] p-1.5 shadow-[0_12px_26px_-8px_rgba(0,0,0,0.8)] cursor-pointer"
            >
              {qrAssets?.previewDataUrl ? (
                <img
                  src={qrAssets.previewDataUrl}
                  alt="Vista previa de Tarjeta QR oficial The Ciprian Company"
                  className="h-28 w-[90px] sm:h-32 sm:w-[104px] rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-28 w-[90px] sm:h-32 sm:w-[104px] items-center justify-center rounded-xl bg-[#1E0F08] text-[#E5AE4E]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1B0E07]/90 border border-[#F4CA73]/60 text-[#FDE68A] shadow">
                <Download className="h-3 w-3" />
              </span>
            </motion.button>

            <div className="text-center min-[400px]:text-left min-w-0 flex-1">
              <p className="text-xs sm:text-[13.5px] font-semibold leading-relaxed text-[#FFFDF9]">
                Envía esta tarjeta QR a tus amigos y familiares para participar por premios de hasta{' '}
                <span className="text-[#FDE047]">$2,000 USD</span>.
              </p>
              {effectiveReferralCode && (
                <div className="mt-2 inline-flex flex-wrap items-center justify-center min-[400px]:justify-start gap-2 rounded-full border border-[#E5AE4E]/45 bg-[#E5AE4E]/14 pl-1.5 pr-3 py-1 text-[11px] font-medium text-[#F4CA73]">
                  <AmbassadorAvatar
                    name={cleanReferrerName || effectiveReferralCode}
                    avatarUrl={cleanReferrerAvatarUrl}
                    size="xs"
                    ring="gold"
                    className="h-6 w-6 shrink-0 ring-offset-[#150A05]"
                  />
                  <span>
                    Invitación VIP{' '}
                    {cleanReferrerName ? (
                      <>
                        de <strong className="font-semibold text-[#FFFDF9]">{cleanReferrerName}</strong>{' '}
                        ·{' '}
                      </>
                    ) : null}
                    Tag{' '}
                    <span className="font-mono font-bold tracking-wider text-[#FEF08A]">
                      {effectiveReferralCode}
                    </span>
                  </span>
                </div>
              )}
              {shareCount > 0 && (
                <p className="mt-1.5 text-[11px] font-semibold text-emerald-300">
                  ✓ {shareCount} {shareCount === 1 ? 'impulso dorado registrado' : 'impulsos dorados registrados'} en esta sesión
                </p>
              )}
            </div>
          </div>

          <AnimatePresence>
            {shareFeedback && (
              <motion.div
                key={shareFeedback}
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/45 bg-emerald-950/65 px-3 py-2 text-xs font-semibold text-emerald-200"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <span>{shareFeedback}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* High-Impact Action Dock */}
          <div className="mt-4 flex flex-col gap-2.5 w-full">
            <motion.button
              type="button"
              onClick={handleShareQrWhatsApp}
              disabled={sharingQr}
              whileHover={prefersReduced ? undefined : { scale: 1.015, y: -1 }}
              whileTap={prefersReduced ? undefined : { scale: 0.975 }}
              className="relative w-full min-h-[52px] overflow-hidden inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FEF08A] via-[#E5AE4E] to-[#C88A2B] px-5 py-3.5 text-sm sm:text-[15px] font-extrabold text-[#1A0D06] shadow-[0_14px_32px_-8px_rgba(229,174,78,0.68)] hover:brightness-105 transition-all cursor-pointer disabled:opacity-75"
            >
              {!prefersReduced && (
                <motion.span
                  aria-hidden="true"
                  animate={{ x: ['-140%', '260%'] }}
                  transition={{ duration: 2.1, repeat: Infinity, repeatDelay: 1.9, ease: 'easeInOut' }}
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                />
              )}
              <span className="relative inline-flex items-center gap-2">
                {sharingQr ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparando Tarjeta QR...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4 stroke-[2.4]" />
                    Compartir QR por WhatsApp
                  </>
                )}
              </span>
            </motion.button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              <motion.button
                type="button"
                onClick={handleCopyInviteLink}
                whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-full border border-[#F4CA73]/50 bg-[#2C170C]/90 px-4 py-2.5 text-sm font-semibold text-[#FEF08A] hover:bg-[#3E2112] transition-colors cursor-pointer"
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

              <motion.button
                type="button"
                onClick={handleDownloadOnly}
                disabled={sharingQr}
                whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-full border border-[#E5AE4E]/45 bg-[#24130A]/90 px-4 py-2.5 text-sm font-semibold text-[#F4CA73] hover:bg-[#381E10] transition-colors cursor-pointer disabled:opacity-70"
              >
                <Download className="h-4 w-4" />
                Descargar Tarjeta QR HD
              </motion.button>
            </div>

            {/* Secondary Escape / Bonus Path so user is always rewarded & never stuck */}
            <div className="pt-2 mt-1 border-t border-[#C88A2B]/25 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {onClaimOwnGift && (
                <motion.button
                  type="button"
                  onClick={onClaimOwnGift}
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/45 bg-emerald-900/35 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-200 hover:bg-emerald-800/45 transition-colors cursor-pointer"
                >
                  <Gift className="h-4 w-4 text-emerald-300" />
                  También quiero abrir mi regalo
                </motion.button>
              )}
              <button
                type="button"
                onClick={onStartAnother}
                className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full border border-[#C88A2B]/35 bg-transparent px-4 py-2.5 text-xs sm:text-sm font-medium text-[#E8D5BE] hover:bg-white/5 transition-colors cursor-pointer ${
                  onClaimOwnGift ? '' : 'sm:col-span-2'
                }`}
              >
                <RotateCcw className="h-4 w-4" />
                Nuevo registro
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
