import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Check,
  Download,
  Loader2,
  RotateCcw,
  Share2,
} from 'lucide-react';
import {
  generateShareQrAssets,
  getPublicLandingUrl,
  triggerQrDownload,
  type ShareQrAssets,
} from './shareQrCard';

interface GoldenTicketBookletProps {
  leadName: string;
  onStartAnother: () => void;
}

const INSTRUCTIVO_PAGE1_SRC = '/referencias/instructivo-p1.jpg';
const INSTRUCTIVO_PAGE2_SRC = '/referencias/instructivo-p2.jpg';

export const GoldenTicketBooklet: React.FC<GoldenTicketBookletProps> = ({
  leadName,
  onStartAnother,
}) => {
  const prefersReduced = Boolean(useReducedMotion());
  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';

  const [activePage, setActivePage] = useState<0 | 1>(0);
  const [flipCount, setFlipCount] = useState(0);
  const [peekHint, setPeekHint] = useState(false);

  const [qrAssets, setQrAssets] = useState<ShareQrAssets | null>(null);
  const [sharingQr, setSharingQr] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const interactedRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    generateShareQrAssets(getPublicLandingUrl())
      .then((assets) => {
        if (mounted) setQrAssets(assets);
      })
      .catch(() => {
        // Generated lazily on click if initial preload fails
      });

    return () => {
      mounted = false;
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
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
    }, 1350);

    return () => {
      window.clearTimeout(tStart);
      window.clearTimeout(tEnd);
    };
  }, [prefersReduced]);

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

  const showTemporaryFeedback = (msg: string) => {
    setShareFeedback(msg);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setShareFeedback(null);
    }, 3400);
  };

  const handleShareQr = async () => {
    if (sharingQr) return;
    setSharingQr(true);
    setShareFeedback(null);
    try {
      const assets = qrAssets ?? (await generateShareQrAssets(getPublicLandingUrl()));
      if (!qrAssets) setQrAssets(assets);

      const inviteMessage =
        '¡Participa en la experiencia Royal Prestige con The Ciprian Company! Escanea este código QR o entra al enlace oficial para descubrir tu regalo directo y participar por premios de alto nivel:';

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
            title: 'The Ciprian Company · Invitación Royal Prestige',
            text: `${inviteMessage}\n${assets.targetUrl}`,
            files: [assets.file],
          });
          showTemporaryFeedback('¡Código QR compartido!');
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          // Fall through cleanly to PNG download + WhatsApp web link
        }
      }

      triggerQrDownload(assets);
      const waUrl = `https://wa.me/?text=${encodeURIComponent(
        `${inviteMessage} ${assets.targetUrl}`
      )}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      showTemporaryFeedback('QR descargado y enlace listo en WhatsApp');
    } catch {
      showTemporaryFeedback('No se pudo preparar el código QR. Intenta nuevamente.');
    } finally {
      setSharingQr(false);
    }
  };

  const handleDownloadOnly = async () => {
    if (sharingQr) return;
    setSharingQr(true);
    try {
      const assets = qrAssets ?? (await generateShareQrAssets(getPublicLandingUrl()));
      if (!qrAssets) setQrAssets(assets);
      triggerQrDownload(assets);
      showTemporaryFeedback('Imagen QR guardada en tu dispositivo');
    } catch {
      showTemporaryFeedback('No se pudo descargar el QR. Intenta nuevamente.');
    } finally {
      setSharingQr(false);
    }
  };

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[600px] mx-auto"
    >
      <div
        className="relative overflow-hidden rounded-[26px] sm:rounded-[34px] border border-[#C88A2B]/50 border-t-[#FDE68A]/55 backdrop-blur-xl shadow-[0_30px_80px_-15px_rgba(34,21,14,0.68),inset_0_1px_0_rgba(254,240,138,0.24)] px-3.5 py-5 sm:px-8 sm:py-8 text-[#FAF3E8]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 12%, rgba(62, 33, 19, 0.88) 0%, rgba(28, 13, 7, 0.92) 52%, rgba(16, 7, 3, 0.96) 100%)',
        }}
      >
        {/* Top metallic foil hairline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#F4CA73] to-[#4B644A]"
        />

        {/* Header */}
        <div className="text-center max-w-md mx-auto mb-4 sm:mb-5">
          <h2 className="font-serif text-[21px] sm:text-[28px] font-semibold text-[#FFFDF9] leading-tight">
            {firstName}, comparte tu{' '}
            <span className="bg-gradient-to-r from-[#FDE68A] via-[#E5AE4E] to-[#F4CA73] bg-clip-text text-transparent">
              Folleto Dorado
            </span>
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-[#DECAB4] leading-relaxed">
            Toca o desliza el cuaderno interactivo para conocer los premios de alto nivel y cómo
            participar compartiendo tu código QR.
          </p>
        </div>

        {/* Single Page Switcher (between Page 1 and Page 2) */}
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#C88A2B]/35 bg-[#140905]/85 p-1 mb-4">
          <button
            type="button"
            onClick={() => selectPage(0)}
            className={`min-h-[44px] rounded-xl px-2.5 py-2 text-xs sm:text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activePage === 0
                ? 'bg-gradient-to-r from-[#E5AE4E] to-[#C88A2B] text-[#1E110A] shadow-md'
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
                ? 'bg-gradient-to-r from-[#E5AE4E] to-[#C88A2B] text-[#1E110A] shadow-md'
                : 'text-[#DECAB4] hover:text-[#FFFDF9] hover:bg-white/5'
            }`}
          >
            <span className="truncate">2 · Instrucciones y Reglas</span>
          </button>
        </div>

        {/* 3D Interactive Flipping Golden Notebook Stage */}
        <div className="relative mx-auto max-w-[390px] select-none">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-[#DECAB4]">
            <span className="inline-flex items-center gap-1.5 text-[#F4CA73]">
              <BookOpen className="h-3.5 w-3.5" />
              {activePage === 0 ? 'Página 1 de 2 · Premios' : 'Página 2 de 2 · Reglas'}
            </span>
            <span className="text-[10.5px] text-[#C8A986]">Toca o desliza para girar ↻</span>
          </div>

          <div className="relative">
            {/* Layered stacked paper edges beneath the turning sheet */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-1.5 top-2 bottom-2 left-3 rounded-[20px] border border-[#C88A2B]/30 bg-[#2C180E]/85 shadow-lg"
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
                  ? 'Página 1: Premios de Alto Nivel. Toca o desliza para ver Instrucciones y Reglas.'
                  : 'Página 2: Instrucciones y Reglas. Toca o desliza para volver a Premios de Alto Nivel.'
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
              <motion.div
                animate={{
                  rotateY: activePage === 0 ? (peekHint ? -12 : 0) : -180,
                }}
                transition={
                  prefersReduced
                    ? { duration: 0.18 }
                    : { type: 'spring', stiffness: 175, damping: 22, mass: 0.9 }
                }
                style={{ transformStyle: 'preserve-3d' }}
                className="relative aspect-[1100/1460] w-full will-change-transform"
              >
                {/* FRONT FACE: Página 1 — Premios de Alto Nivel (cropped edge-to-edge) */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                  className="absolute inset-0 overflow-hidden rounded-[20px] border-2 border-[#E5AE4E]/65 bg-[#1A0D07] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.85)]"
                >
                  <img
                    src={INSTRUCTIVO_PAGE1_SRC}
                    alt="Equipa tu cocina con Royal Prestige y gana premios de alto nivel"
                    draggable={false}
                    className="h-full w-full object-cover object-center select-none pointer-events-none"
                  />

                  {/* Golden spine crease shadow */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
                  />
                  {/* Metallic spine edge binding */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-3 left-1 w-[2px] rounded-full bg-gradient-to-b from-transparent via-[#F4CA73]/75 to-transparent"
                  />

                  {/* Specular flip light sweep */}
                  {!prefersReduced && flipCount > 0 && activePage === 0 && (
                    <motion.div
                      key={`sweep-p1-${flipCount}`}
                      aria-hidden="true"
                      initial={{ x: '-130%', opacity: 0 }}
                      animate={{ x: '240%', opacity: [0, 0.55, 0] }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="pointer-events-none absolute -top-10 left-0 h-[130%] w-24 -skew-x-[20deg] bg-gradient-to-r from-transparent via-[#FFFBEB]/45 to-transparent"
                    />
                  )}
                </div>

                {/* BACK FACE: Página 2 — Reglas de Participación (cropped edge-to-edge) */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 overflow-hidden rounded-[20px] border-2 border-[#E5AE4E]/65 bg-[#1A0D07] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.85)]"
                >
                  <img
                    src={INSTRUCTIVO_PAGE2_SRC}
                    alt="Reglas de participación para el anfitrión"
                    draggable={false}
                    className="h-full w-full object-cover object-center select-none pointer-events-none"
                  />

                  {/* Golden spine crease shadow */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-3 left-1 w-[2px] rounded-full bg-gradient-to-b from-transparent via-[#F4CA73]/75 to-transparent"
                  />

                  {/* Specular flip light sweep */}
                  {!prefersReduced && flipCount > 0 && activePage === 1 && (
                    <motion.div
                      key={`sweep-p2-${flipCount}`}
                      aria-hidden="true"
                      initial={{ x: '-130%', opacity: 0 }}
                      animate={{ x: '240%', opacity: [0, 0.55, 0] }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="pointer-events-none absolute -top-10 left-0 h-[130%] w-24 -skew-x-[20deg] bg-gradient-to-r from-transparent via-[#FFFBEB]/45 to-transparent"
                    />
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Share QR by WhatsApp Card directly below the 3D flipping notebook */}
        <div className="mt-5 rounded-[22px] border border-[#E5AE4E]/40 bg-gradient-to-br from-[#2B170D]/90 via-[#1E0F08]/95 to-[#140905]/98 p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(254,240,138,0.18)]">
          <div className="flex flex-col min-[380px]:flex-row items-center gap-3.5 sm:gap-4">
            {/* Miniature QR Card Preview */}
            <div className="shrink-0 rounded-2xl border border-[#E5AE4E]/55 bg-[#120703] p-1.5 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.75)]">
              {qrAssets?.previewDataUrl ? (
                <img
                  src={qrAssets.previewDataUrl}
                  alt="Código QR oficial de participación The Ciprian Company"
                  className="h-28 w-[90px] sm:h-32 sm:w-[104px] rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-28 w-[90px] sm:h-32 sm:w-[104px] items-center justify-center rounded-xl bg-[#1E0F08] text-[#E5AE4E]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
            </div>

            <div className="text-center min-[380px]:text-left min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#F4CA73]">
                Comparte y multiplica tus oportunidades
              </p>
              <p className="mt-1 text-xs sm:text-[13.5px] font-medium leading-relaxed text-[#FFFDF9]">
                Entre con más personas compartas este código QR, mayores serán tus probabilidades de
                ganar uno de los grandes premios.
              </p>
            </div>
          </div>

          {shareFeedback && (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-950/50 px-3 py-2 text-xs font-medium text-emerald-200">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span>{shareFeedback}</span>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2.5 w-full">
            <button
              type="button"
              onClick={handleShareQr}
              disabled={sharingQr}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F4CA73] via-[#E5AE4E] to-[#C88A2B] px-5 py-3 text-sm font-bold text-[#1E110A] shadow-[0_12px_28px_-8px_rgba(229,174,78,0.55)] hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-75"
            >
              {sharingQr ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando QR...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Compartir QR
                </>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={handleDownloadOnly}
                disabled={sharingQr}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full border border-[#E5AE4E]/45 bg-[#2A170D]/80 px-4 py-3 text-sm font-semibold text-[#F4CA73] hover:bg-[#3A2012] transition-colors cursor-pointer disabled:opacity-70"
              >
                <Download className="h-4 w-4" />
                Descargar QR
              </button>
              <button
                type="button"
                onClick={onStartAnother}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full border border-[#C88A2B]/35 bg-transparent px-4 py-3 text-sm font-medium text-[#E8D5BE] hover:bg-white/5 transition-colors cursor-pointer"
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
