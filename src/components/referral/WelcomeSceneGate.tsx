import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, X } from 'lucide-react';

export const WelcomeSceneGate: React.FC = () => {
  // Opens once per full page load/reload; closing dismisses cleanly until next reload
  const [isOpen, setIsOpen] = useState(true);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [needsPlayTap, setNeedsPlayTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const attemptAutoplayOnce = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.muted = false;
      await video.play();
      setNeedsPlayTap(false);
    } catch {
      // Browser policy blocked unmuted autoplay: fall back quietly to muted autoplay
      try {
        video.muted = true;
        await video.play();
        setNeedsPlayTap(false);
      } catch {
        setNeedsPlayTap(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      void attemptAutoplayOnce();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [attemptAutoplayOnce, isOpen]);

  const handleVideoSurfaceClick = () => {
    const video = videoRef.current;
    if (!video || hasVideoEnded) return;
    if (video.muted) {
      video.muted = false;
    }
    if (video.paused) {
      void video.play().catch(() => {});
    }
  };

  const handleManualPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    void video
      .play()
      .then(() => setNeedsPlayTap(false))
      .catch(() => {
        video.muted = true;
        void video.play().then(() => setNeedsPlayTap(false));
      });
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#140A05]/45 px-4 py-5 backdrop-blur-[5px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="relative"
          >
            {/* Outer Translucent Double-Bezel Atelier Frame */}
            <div className="relative rounded-[32px] border border-white/25 bg-gradient-to-b from-[#F4CA73]/30 via-[#C88A2B]/14 to-[#6B3314]/25 p-1.5 shadow-[0_30px_80px_-14px_rgba(18,9,4,0.62),0_0_45px_rgba(200,138,43,0.18)] backdrop-blur-md">
              {/* Top Specular Highlight on Frame Bezel */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent"
              />

              {/* Inner 9:16 Video Viewport */}
              <div className="relative aspect-[9/16] w-[min(86vw,340px)] sm:w-[min(82vw,372px)] max-h-[82dvh] overflow-hidden rounded-[26px] bg-[#140A05] ring-1 ring-white/20">
                <video
                  ref={videoRef}
                  src="/video%20tuto.mp4"
                  playsInline
                  preload="auto"
                  onClick={handleVideoSurfaceClick}
                  onEnded={handleVideoEnded}
                  className="h-full w-full cursor-pointer object-cover"
                />

                {/* Subtle top vignette for crisp button legibility */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent"
                />

                {/* Top-Right Close Button (keeps its exact color; gains a blinking warm semi-orange outline glow on video end) */}
                <div className="absolute right-3.5 top-3.5 z-30">
                  <div className="relative flex items-center justify-center">
                    {hasVideoEnded && (
                      <>
                        {/* Soft semi-orange outer contour aura blinking */}
                        <motion.span
                          aria-hidden="true"
                          animate={{
                            opacity: [0.3, 0.95, 0.3],
                            scale: [1, 1.24, 1],
                          }}
                          transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute -inset-2 rounded-full border-2 border-[#FB923C]/90 blur-[2px]"
                        />
                        <motion.span
                          aria-hidden="true"
                          animate={{
                            opacity: [0.45, 1, 0.45],
                            scale: [1, 1.12, 1],
                          }}
                          transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute -inset-[3px] rounded-full border-2 border-[#F97316]"
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
                        hasVideoEnded
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
                        hasVideoEnded
                          ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
                          : undefined
                      }
                      className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-[#1B0E07]/72 text-[#FFFDF9] backdrop-blur-md transition-colors hover:bg-[#1B0E07]/90"
                    >
                      <X className="h-5 w-5 stroke-[2.2]" />
                    </motion.button>
                  </div>
                </div>

                {/* Centered Play Fallback only if mobile blocks muted autoplay */}
                {needsPlayTap && !hasVideoEnded && (
                  <button
                    type="button"
                    onClick={handleManualPlay}
                    aria-label="Reproducir video de bienvenida"
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 text-[#FFFDF9] backdrop-blur-[2px]"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-[#1B0E07]/80 text-[#FFFDF9] shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
                      <Play className="ml-0.5 h-7 w-7 fill-current" />
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
