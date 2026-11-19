import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Play, Volume2, X } from 'lucide-react';

export const WelcomeSceneGate: React.FC = () => {
  const prefersReduced = useReducedMotion();
  // Opens once per full page load/reload; closing dismisses cleanly until next reload
  const [isOpen, setIsOpen] = useState(true);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [needsPlayTap, setNeedsPlayTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const enforceFullVolume = useCallback((video: HTMLVideoElement) => {
    video.muted = false;
    video.defaultMuted = false;
    if (video.volume < 1) {
      video.volume = 1;
    }
  }, []);

  const attemptAutoplayWithVoice = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      enforceFullVolume(video);
      await video.play();
      setNeedsPlayTap(false);
    } catch {
      // Never fall back to muted playback: stay paused at 0s until first gesture starts it with voice
      video.pause();
      enforceFullVolume(video);
      setNeedsPlayTap(true);
    }
  }, [enforceFullVolume]);

  useEffect(() => {
    if (!isOpen) return;
    void attemptAutoplayWithVoice();
  }, [attemptAutoplayWithVoice, isOpen]);

  // If browser blocked unmuted autoplay on load, any first user interaction starts playback with full voice
  useEffect(() => {
    if (!isOpen || !needsPlayTap || hasVideoEnded) return;
    const unlockWithVoice = () => {
      const video = videoRef.current;
      if (!video) return;
      enforceFullVolume(video);
      void video
        .play()
        .then(() => {
          setNeedsPlayTap(false);
        })
        .catch(() => {});
    };

    window.addEventListener('pointerdown', unlockWithVoice, { capture: true });
    window.addEventListener('keydown', unlockWithVoice, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlockWithVoice, { capture: true });
      window.removeEventListener('keydown', unlockWithVoice, { capture: true });
    };
  }, [enforceFullVolume, hasVideoEnded, isOpen, needsPlayTap]);

  const handleVideoSurfaceClick = () => {
    const video = videoRef.current;
    if (!video || hasVideoEnded) return;
    enforceFullVolume(video);
    if (video.paused) {
      void video
        .play()
        .then(() => setNeedsPlayTap(false))
        .catch(() => {});
    }
  };

  const handleVolumeChange = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume < 1) {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
    }
  };

  const handleManualPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    enforceFullVolume(video);
    void video
      .play()
      .then(() => {
        setNeedsPlayTap(false);
      })
      .catch(() => {});
  };

  const handleVideoEnded = () => {
    setHasVideoEnded(true);
  };

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="promo-intro-popup"
          role="dialog"
          aria-modal="true"
          aria-label="Video de bienvenida Royal Prestige"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center bg-[#140A05]/45 px-3 py-4 sm:px-4 sm:py-5 backdrop-blur-[5px]"
        >
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="relative max-w-full"
          >
            {/* Outer Translucent Double-Bezel Atelier Frame */}
            <div className="relative rounded-[28px] sm:rounded-[32px] border border-white/25 bg-gradient-to-b from-[#F4CA73]/30 via-[#C88A2B]/14 to-[#6B3314]/25 p-1.5 shadow-[0_30px_80px_-14px_rgba(18,9,4,0.62),0_0_45px_rgba(200,138,43,0.18)] backdrop-blur-md">
              {/* Top Specular Highlight on Frame Bezel */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent"
              />

              {/* Inner 9:16 Video Viewport (maintains exact 9:16 proportions inside dynamic viewport) */}
              <div className="relative aspect-[9/16] w-[min(86vw,340px,calc(80dvh*9/16))] sm:w-[min(82vw,372px,calc(82dvh*9/16))] max-h-[82dvh] overflow-hidden rounded-[22px] sm:rounded-[26px] bg-[#140A05] ring-1 ring-white/20">
                <video
                  ref={videoRef}
                  src="/video%20tuto.mp4"
                  autoPlay
                  playsInline
                  preload="auto"
                  controls={false}
                  disablePictureInPicture
                  controlsList="nodownload nofullscreen noremoteplayback"
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={handleVideoSurfaceClick}
                  onVolumeChange={handleVolumeChange}
                  onEnded={handleVideoEnded}
                  className="h-full w-full cursor-pointer object-cover"
                />

                {/* Subtle top vignette for crisp button & volume notice legibility */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 via-black/15 to-transparent"
                />

                {/* Top-Left Informational Volume Notice (purely visual reminder if device volume is low) */}
                {!hasVideoEnded && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.12 }}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-3 sm:left-3.5 sm:top-3.5 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-[#1B0E07]/65 px-3.5 text-[#FAF3E8] backdrop-blur-md"
                  >
                    <Volume2 className="h-4 w-4 shrink-0 text-[#F4CA73]" />
                    <div className="flex items-end gap-[2px] h-3 shrink-0">
                      {[0, 1, 2].map((bar) => (
                        <motion.span
                          key={bar}
                          animate={
                            prefersReduced
                              ? { scaleY: 0.7 }
                              : { scaleY: [0.4, 1, 0.55, 0.9, 0.4] }
                          }
                          transition={
                            prefersReduced
                              ? undefined
                              : {
                                  duration: 0.9 + bar * 0.18,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: bar * 0.14,
                                }
                          }
                          style={{ transformOrigin: 'bottom' }}
                          className="h-3 w-[2px] rounded-full bg-[#F4CA73]"
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap">
                      Sube el volumen
                    </span>
                  </motion.div>
                )}

                {/* Top-Right Close Button (44x44px touch target; gains warm orange glow on video end) */}
                <div className="absolute right-3 top-3 sm:right-3.5 sm:top-3.5 z-30">
                  <div className="relative flex items-center justify-center">
                    {hasVideoEnded && (
                      <>
                        {/* Soft semi-orange outer contour aura blinking */}
                        <motion.span
                          aria-hidden="true"
                          animate={
                            prefersReduced
                              ? { opacity: 0.75, scale: 1.08 }
                              : {
                                  opacity: [0.3, 0.95, 0.3],
                                  scale: [1, 1.24, 1],
                                }
                          }
                          transition={
                            prefersReduced
                              ? undefined
                              : { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
                          }
                          className="pointer-events-none absolute -inset-2 rounded-full border-2 border-[#FB923C]/90 blur-[2px] will-change-transform"
                        />
                        <motion.span
                          aria-hidden="true"
                          animate={
                            prefersReduced
                              ? { opacity: 0.9, scale: 1.04 }
                              : {
                                  opacity: [0.45, 1, 0.45],
                                  scale: [1, 1.12, 1],
                                }
                          }
                          transition={
                            prefersReduced
                              ? undefined
                              : { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
                          }
                          className="pointer-events-none absolute -inset-[3px] rounded-full border-2 border-[#F97316] will-change-transform"
                          style={{
                            boxShadow:
                              '0 0 18px rgba(249,115,22,0.85), 0 0 32px rgba(251,146,60,0.55)',
                          }}
                        />
                      </>
                    )}

                    <motion.button
                      type="button"
                      onClick={handleClose}
                      aria-label="Cerrar ventana promocional"
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.93 }}
                      animate={
                        hasVideoEnded && !prefersReduced
                          ? {
                              boxShadow: [
                                '0 0 10px 1px rgba(249,115,22,0.45)',
                                '0 0 24px 3px rgba(251,146,60,0.9)',
                                '0 0 10px 1px rgba(249,115,22,0.45)',
                              ],
                            }
                          : {}
                      }
                      transition={
                        hasVideoEnded && !prefersReduced
                          ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
                          : undefined
                      }
                      className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-[#1B0E07]/75 text-[#FFFDF9] backdrop-blur-md transition-colors hover:bg-[#1B0E07]/90 cursor-pointer"
                    >
                      <X className="h-5 w-5 stroke-[2.2]" />
                    </motion.button>
                  </div>
                </div>

                {/* Centered Play Fallback only if browser policy blocks unmuted autoplay */}
                {needsPlayTap && !hasVideoEnded && (
                  <button
                    type="button"
                    onClick={handleManualPlay}
                    aria-label="Reproducir video de bienvenida con sonido"
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/35 px-4 text-[#FFFDF9] backdrop-blur-[2px] cursor-pointer"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#F4CA73]/60 bg-[#1B0E07]/85 text-[#FFFDF9] shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
                      <Play className="ml-0.5 h-7 w-7 fill-current text-[#F4CA73]" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#1B0E07]/80 px-3.5 py-1.5 text-xs font-semibold text-[#FFF7E2] backdrop-blur-md">
                      <Volume2 className="h-3.5 w-3.5 text-[#F4CA73]" />
                      Toca para escuchar · Sube tu volumen
                    </span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
