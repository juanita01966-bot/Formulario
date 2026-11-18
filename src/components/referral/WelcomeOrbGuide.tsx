import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, type MotionValue, useMotionValue, useSpring } from 'framer-motion';
import { Minimize2, RotateCcw, Sparkles, Volume2, VolumeX, X } from 'lucide-react';

export type ReferralGuideStep = 'form' | 'quiz' | 'loading' | 'cards' | 'reveal';

interface WelcomeOrbGuideProps {
  currentStep: ReferralGuideStep;
  leadName?: string;
}

interface StepCopy {
  badge: string;
  title: string;
  spokenText: string;
}

function getStepCopy(step: ReferralGuideStep, leadName?: string): StepCopy {
  const firstName = leadName?.trim().split(/\s+/)[0] || '';

  switch (step) {
    case 'form':
      return {
        badge: 'Guía Royal Prestige',
        title: '¡Tu regalo exclusivo te espera!',
        spokenText:
          '¡Felicidades! Eres ganador de premios exclusivos de la marca Royal Prestige. Para reclamar tu regalo directo solo registra tu nombre, teléfono, estado y ciudad de residencia aquí abajo, ¡y listo!',
      };
    case 'quiz':
      return {
        badge: 'Paso 2 · Tu Cocina',
        title: firstName ? `${firstName}, personaliza tu obsequio` : 'Personaliza tu obsequio',
        spokenText:
          'Excelente. Responde estas breves preguntas sobre tu cocina para preparar tu obsequio ideal.',
      };
    case 'loading':
      return {
        badge: 'Preparando Selección',
        title: 'Seleccionando tus premios VIP',
        spokenText:
          'Estamos seleccionando y preparando tu selección exclusiva de premios Royal Prestige...',
      };
    case 'cards':
      return {
        badge: 'Cajitas Aleatorias',
        title: '¡Elige tu caja ganadora!',
        spokenText:
          'Todas las cajitas mezclan premios al azar. ¡Toca cualquiera para elevarla y descubrir qué te ganaste!',
      };
    case 'reveal':
      return {
        badge: 'Premio Oficial',
        title: firstName ? `¡Enhorabuena, ${firstName}!` : '¡Enhorabuena!',
        spokenText: '¡Enhorabuena! Aquí tienes tu premio oficial y tu folio de cortesía.',
      };
  }
}

function pickBestSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const spanishVoices = voices.filter((v) => /^es([-_]|$)/i.test(v.lang));
  if (!spanishVoices.length) return null;

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    if (/es-(MX|US|419)/i.test(v.lang)) score += 60;
    else if (/es-ES/i.test(v.lang)) score += 50;
    else score += 25;

    if (/natural|neural|online|premium|enhanced/i.test(v.name)) score += 45;
    if (/google|microsoft|dalia|sabina|paloma|paulina|monica|helena|elena|laura|jorge|alonso/i.test(v.name)) {
      score += 30;
    }
    if (!v.localService) score += 12;
    if (v.default) score += 5;
    return score;
  };

  const sorted = [...spanishVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return sorted[0] || null;
}

const VoiceWaveformBars: React.FC<{ active: boolean; compact?: boolean }> = ({
  active,
  compact = false,
}) => {
  const heights = compact ? [6, 11, 8] : [8, 15, 11, 16, 9];

  return (
    <span className="inline-flex items-center gap-[2.5px]" aria-hidden="true">
      {heights.map((maxH, idx) => (
        <motion.span
          key={idx}
          className="w-[2.5px] rounded-full bg-gradient-to-t from-[#C88A2B] via-[#F4CA73] to-[#FFFBEB]"
          animate={
            active
              ? {
                  height: [3, maxH, Math.max(4, Math.round(maxH * 0.45)), maxH - 2, 3],
                  opacity: [0.7, 1, 0.85, 1, 0.7],
                }
              : {
                  height: 3,
                  opacity: 0.45,
                }
          }
          transition={
            active
              ? {
                  duration: 0.72 + idx * 0.09,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: idx * 0.08,
                }
              : { duration: 0.25 }
          }
        />
      ))}
    </span>
  );
};

interface LuminousOrbSphereProps {
  isSpeaking: boolean;
  isMuted: boolean;
  lookX: MotionValue<number>;
  lookY: MotionValue<number>;
  sizeClass?: string;
}

const LuminousOrbSphere: React.FC<LuminousOrbSphereProps> = ({
  isSpeaking,
  isMuted,
  lookX,
  lookY,
  sizeClass = 'h-14 w-14 sm:h-16 sm:w-16',
}) => {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const ringGradA = `orbRingA-${uid}`;
  const ringGradB = `orbRingB-${uid}`;

  return (
    <div className={`relative flex items-center justify-center select-none ${sizeClass}`}>
      {/* Breathing outer energy halo */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2.5 rounded-full blur-lg"
        style={{
          background:
            'radial-gradient(circle, rgba(254,240,138,0.68) 0%, rgba(229,174,78,0.42) 48%, rgba(184,74,39,0.12) 74%, transparent 100%)',
        }}
        animate={
          isSpeaking
            ? { scale: [0.98, 1.24, 1.02, 1.2, 0.98], opacity: [0.7, 1, 0.8, 1, 0.7] }
            : { scale: [0.94, 1.09, 0.94], opacity: [0.48, 0.78, 0.48] }
        }
        transition={{
          duration: isSpeaking ? 1.4 : 3.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Acoustic speaking ripples */}
      <AnimatePresence>
        {isSpeaking && (
          <>
            {[0, 0.55].map((delay) => (
              <motion.span
                key={`ripple-${delay}`}
                aria-hidden="true"
                initial={{ scale: 0.88, opacity: 0.7 }}
                animate={{ scale: 1.72, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.45,
                  repeat: Infinity,
                  delay,
                  ease: 'easeOut',
                }}
                className="pointer-events-none absolute inset-0 rounded-full border border-[#F4CA73]/75 shadow-[0_0_12px_rgba(244,202,115,0.4)]"
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Dual counter-rotating SVG orbital rings */}
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)]"
        animate={{ rotate: 360 }}
        transition={{ duration: isSpeaking ? 5.5 : 10, repeat: Infinity, ease: 'linear' }}
      >
        <defs>
          <linearGradient id={ringGradA} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#F4CA73" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#C88A2B" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="21"
          transform="rotate(-24 50 50)"
          fill="none"
          stroke={`url(#${ringGradA})`}
          strokeWidth="1.6"
        />
        <circle cx="88" cy="34" r="2.6" fill="#FFFBEB" />
      </motion.svg>

      <motion.svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)]"
        animate={{ rotate: -360 }}
        transition={{ duration: isSpeaking ? 4.4 : 7.5, repeat: Infinity, ease: 'linear' }}
      >
        <defs>
          <linearGradient id={ringGradB} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#D97706" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8C3318" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <ellipse
          cx="50"
          cy="50"
          rx="42"
          ry="19"
          transform="rotate(28 50 50)"
          fill="none"
          stroke={`url(#${ringGradB})`}
          strokeWidth="1.4"
        />
        <circle cx="15" cy="30" r="2.2" fill="#FDE68A" />
      </motion.svg>

      {/* Main 3D luminous plasma core sphere */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative h-full w-full overflow-hidden rounded-full border border-[#FEF08A]/75 shadow-[inset_0_-8px_14px_rgba(120,42,14,0.85),inset_0_4px_10px_rgba(255,251,235,0.85),0_10px_28px_rgba(200,138,43,0.58)]"
        style={{
          background:
            'radial-gradient(circle at 36% 32%, #FFFBEB 0%, #FEF08A 22%, #E5AE4E 54%, #B84A27 84%, #5C220F 100%)',
        }}
      >
        {/* Swirling warm plasma energy inside sphere */}
        <motion.div
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          className="absolute -inset-2 opacity-75 mix-blend-screen"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(255,251,235,0.7) 70deg, transparent 150deg, rgba(245,158,11,0.55) 230deg, transparent 360deg)',
          }}
        />

        {/* Pointer-responsive inner incandescent core */}
        <motion.div
          aria-hidden="true"
          style={{ x: lookX, y: lookY }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.div
            animate={isSpeaking ? { scale: [1, 1.24, 0.96, 1.18, 1] } : { scale: [0.96, 1.08, 0.96] }}
            transition={{
              duration: isSpeaking ? 0.85 : 2.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-[#FFFBEB] blur-[1.5px] shadow-[0_0_16px_6px_rgba(254,240,138,0.95)]"
          />
        </motion.div>

        {/* Glass specular top crescent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[16%] top-[10%] h-[28%] w-[52%] -rotate-12 rounded-full bg-gradient-to-b from-white/80 to-transparent blur-[0.5px]"
        />

        {/* Subtle muted slash indicator badge when silenced */}
        {isMuted && (
          <span
            aria-hidden="true"
            className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1E110A]/90 border border-[#F4CA73]/60 text-[#F4CA73]"
          >
            <VolumeX className="h-2.5 w-2.5" />
          </span>
        )}
      </motion.div>
    </div>
  );
};

export const WelcomeOrbGuide: React.FC<WelcomeOrbGuideProps> = ({ currentStep, leadName }) => {
  const isSpeechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [waitingForGesture, setWaitingForGesture] = useState(false);

  const orbAnchorRef = useRef<HTMLButtonElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speakIdRef = useRef(0);
  const watchdogRef = useRef<number | null>(null);
  const isMutedRef = useRef(isMuted);
  const isHiddenRef = useRef(isHidden);
  const pendingAutoSpeakRef = useRef(false);

  isMutedRef.current = isMuted;
  isHiddenRef.current = isHidden;

  const copy = getStepCopy(currentStep, leadName);
  const spokenTextRef = useRef(copy.spokenText);
  spokenTextRef.current = copy.spokenText;

  // Smooth spring motion tracking pointer without ever obscuring form fields
  const rawFollowX = useMotionValue(0);
  const rawFollowY = useMotionValue(0);
  const rawLookX = useMotionValue(0);
  const rawLookY = useMotionValue(0);

  const orbX = useSpring(rawFollowX, { stiffness: 130, damping: 18, mass: 0.65 });
  const orbY = useSpring(rawFollowY, { stiffness: 130, damping: 18, mass: 0.65 });
  const lookX = useSpring(rawLookX, { stiffness: 190, damping: 20, mass: 0.45 });
  const lookY = useSpring(rawLookY, { stiffness: 190, damping: 20, mass: 0.45 });

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (isHiddenRef.current) return;
      const anchor = orbAnchorRef.current;
      let normX = 0;
      let normY = 0;

      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const scale = Math.max(window.innerWidth, window.innerHeight, 600) * 0.45;
        normX = Math.max(-1, Math.min(1, dx / scale));
        normY = Math.max(-1, Math.min(1, dy / scale));
      } else {
        normX = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
        normY = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      }

      rawFollowX.set(normX * 9);
      rawFollowY.set(normY * 7);
      rawLookX.set(normX * 5);
      rawLookY.set(normY * 4);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [rawFollowX, rawFollowY, rawLookX, rawLookY]);

  // Collapse speech bubble automatically when typing in an input on small mobile viewports (<640px)
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (window.innerWidth >= 640) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setIsMinimized(true);
      }
    };

    window.addEventListener('focusin', onFocusIn);
    return () => window.removeEventListener('focusin', onFocusIn);
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    speakIdRef.current += 1;
    clearWatchdog();
    pendingAutoSpeakRef.current = false;
    setIsSpeaking(false);
    if (!isSpeechSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis errors in restricted environments
    }
  }, [clearWatchdog, isSpeechSupported]);

  // Load Spanish voices cleanly (including async voiceschanged)
  useEffect(() => {
    if (!isSpeechSupported) return;
    const synth = window.speechSynthesis;

    const refreshVoices = () => {
      try {
        voicesRef.current = synth.getVoices();
      } catch {
        voicesRef.current = [];
      }
    };

    refreshVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refreshVoices);
      return () => synth.removeEventListener('voiceschanged', refreshVoices);
    }
    const prevHandler = synth.onvoiceschanged;
    synth.onvoiceschanged = refreshVoices;
    return () => {
      synth.onvoiceschanged = prevHandler;
    };
  }, [isSpeechSupported]);

  const speakMessage = useCallback(
    (text: string, { fromAutoplay = false }: { fromAutoplay?: boolean } = {}) => {
      if (!isSpeechSupported || isMutedRef.current || isHiddenRef.current) return;
      const synth = window.speechSynthesis;

      const myId = ++speakIdRef.current;
      clearWatchdog();

      try {
        synth.cancel();
        if (synth.paused) {
          synth.resume();
        }
      } catch {
        // Ignore cancel errors
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        const currentVoices = voicesRef.current.length ? voicesRef.current : synth.getVoices();
        const bestVoice = pickBestSpanishVoice(currentVoices);

        utterance.lang = bestVoice?.lang || 'es-MX';
        if (bestVoice) utterance.voice = bestVoice;
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;

        let didStart = false;

        utterance.onstart = () => {
          if (myId !== speakIdRef.current) return;
          didStart = true;
          clearWatchdog();
          pendingAutoSpeakRef.current = false;
          setWaitingForGesture(false);
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          if (myId !== speakIdRef.current) return;
          clearWatchdog();
          setIsSpeaking(false);
        };

        utterance.onerror = (event) => {
          if (myId !== speakIdRef.current) return;
          clearWatchdog();
          setIsSpeaking(false);
          const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error;
          if (fromAutoplay && (!didStart || errCode === 'not-allowed')) {
            pendingAutoSpeakRef.current = true;
            setWaitingForGesture(true);
          }
        };

        synth.speak(utterance);

        if (fromAutoplay) {
          watchdogRef.current = window.setTimeout(() => {
            if (myId !== speakIdRef.current || isMutedRef.current || isHiddenRef.current) return;
            if (!didStart && !synth.speaking) {
              pendingAutoSpeakRef.current = true;
              setWaitingForGesture(true);
            }
          }, 480);
        }
      } catch {
        setIsSpeaking(false);
        if (fromAutoplay) {
          pendingAutoSpeakRef.current = true;
          setWaitingForGesture(true);
        }
      }
    },
    [clearWatchdog, isSpeechSupported]
  );

  // Trigger voice automatically when step changes (and on initial mount for 'form')
  useEffect(() => {
    if (isMuted || isHidden) return;
    const timer = window.setTimeout(() => {
      speakMessage(spokenTextRef.current, { fromAutoplay: true });
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentStep, isHidden, isMuted, speakMessage]);

  // If browser blocked autoplay before user gesture, start narration on first interaction
  useEffect(() => {
    if (!waitingForGesture || !isSpeechSupported || isMuted || isHidden) return;

    const unlockAndSpeak = (event: Event) => {
      if (!pendingAutoSpeakRef.current || isMutedRef.current || isHiddenRef.current) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-orb-control], [data-orb-button]')) {
        return;
      }
      pendingAutoSpeakRef.current = false;
      setWaitingForGesture(false);
      speakMessage(spokenTextRef.current, { fromAutoplay: false });
    };

    window.addEventListener('click', unlockAndSpeak, { capture: true });
    window.addEventListener('keydown', unlockAndSpeak, { capture: true });
    return () => {
      window.removeEventListener('click', unlockAndSpeak, { capture: true });
      window.removeEventListener('keydown', unlockAndSpeak, { capture: true });
    };
  }, [isHidden, isMuted, isSpeechSupported, speakMessage, waitingForGesture]);

  // Clean cancellation on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const handleToggleMute = () => {
    if (isMuted) {
      isMutedRef.current = false;
      setIsMuted(false);
      setWaitingForGesture(false);
      speakMessage(copy.spokenText, { fromAutoplay: false });
    } else {
      isMutedRef.current = true;
      setIsMuted(true);
      setWaitingForGesture(false);
      stopSpeech();
    }
  };

  const handleReplay = () => {
    isMutedRef.current = false;
    setIsMuted(false);
    setWaitingForGesture(false);
    speakMessage(copy.spokenText, { fromAutoplay: false });
  };

  const handleListenPrompt = () => {
    isMutedRef.current = false;
    setIsMuted(false);
    setWaitingForGesture(false);
    speakMessage(copy.spokenText, { fromAutoplay: false });
  };

  const handleHideGuide = () => {
    isHiddenRef.current = true;
    setIsHidden(true);
    setWaitingForGesture(false);
    stopSpeech();
  };

  const handleOrbClick = () => {
    if (isMinimized) {
      setIsMinimized(false);
      if (waitingForGesture && !isMuted) {
        setWaitingForGesture(false);
        speakMessage(copy.spokenText, { fromAutoplay: false });
      }
    } else {
      setIsMinimized(true);
    }
  };

  if (isHidden) {
    return null;
  }

  return (
    <aside
      aria-label="Asistente de bienvenida con voz Royal Prestige"
      className="pointer-events-none fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 flex flex-col items-end gap-2.5 max-w-[calc(100vw-24px)]"
    >
      {/* Floating Speech Bubble Card */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            key={`orb-bubble-${currentStep}`}
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="pointer-events-auto relative w-[min(calc(100vw-24px),340px)] overflow-hidden rounded-[22px] border border-[#C88A2B]/55 bg-gradient-to-br from-[#23140C]/95 via-[#1B0F09]/96 to-[#130904]/97 text-[#FFFDF9] shadow-[0_22px_50px_-12px_rgba(24,12,6,0.68),inset_0_1px_0_rgba(254,240,138,0.22)] backdrop-blur-xl"
          >
            {/* Top burnished gold accent hairline */}
            <div className="h-[2px] w-full bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

            <div className="px-4 py-3.5 space-y-2.5">
              {/* Top Row: Step Badge + Audio Waveform + Minimize / Hide */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#F4CA73]/35 bg-[#F4CA73]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#F4CA73]">
                    <Sparkles className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{copy.badge}</span>
                  </span>
                  {isSpeechSupported && <VoiceWaveformBars active={isSpeaking} />}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-orb-control="minimize"
                    onClick={() => setIsMinimized(true)}
                    title="Minimizar guía"
                    aria-label="Minimizar guía"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[#D8C1A8] hover:bg-white/10 hover:text-[#FFFDF9] transition-colors cursor-pointer"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-orb-control="hide"
                    onClick={handleHideGuide}
                    title="Ocultar guía"
                    aria-label="Ocultar guía"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[#D8C1A8] hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Concierge Creative Headline & Speech Copy */}
              <div>
                <p className="font-serif text-[14.5px] font-semibold leading-snug text-[#FEF08A]">
                  {copy.title}
                </p>
                <p className="mt-1 text-[12px] sm:text-[12.5px] leading-relaxed text-[#F1E4D4]">
                  {copy.spokenText}
                </p>
              </div>

              {/* Voice Controls Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#C88A2B]/20">
                <div className="flex items-center gap-1.5">
                  {isSpeechSupported ? (
                    waitingForGesture && !isMuted && !isSpeaking ? (
                      <button
                        type="button"
                        data-orb-control="play"
                        onClick={handleListenPrompt}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#E5AE4E] px-3 py-1 text-[11px] font-bold text-[#1A0E08] shadow-[0_4px_14px_rgba(244,202,115,0.4)] hover:brightness-105 transition-all cursor-pointer"
                      >
                        <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                        <span>Escuchar guía</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-orb-control="mute"
                        onClick={handleToggleMute}
                        title={isMuted ? 'Activar narración por voz' : 'Silenciar narración por voz'}
                        aria-label={isMuted ? 'Activar voz' : 'Silenciar voz'}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                          isMuted
                            ? 'border-[#C88A2B]/30 bg-white/5 text-[#CBB59D] hover:bg-white/10'
                            : 'border-[#F4CA73]/40 bg-[#F4CA73]/15 text-[#FEF08A] hover:bg-[#F4CA73]/25'
                        }`}
                      >
                        {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        <span>{isMuted ? 'Activar voz' : isSpeaking ? 'Pausar voz' : 'Voz activa'}</span>
                      </button>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#CBB59D]">
                      <Sparkles className="h-3 w-3 text-[#F4CA73]" />
                      Guía paso a paso
                    </span>
                  )}

                  {isSpeechSupported && (
                    <button
                      type="button"
                      data-orb-control="replay"
                      onClick={handleReplay}
                      title="Repetir mensaje"
                      aria-label="Repetir mensaje"
                      className="inline-flex items-center gap-1 rounded-full border border-[#C88A2B]/30 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[#E8D5BE] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Repetir</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  data-orb-control="hide"
                  onClick={handleHideGuide}
                  className="text-[10.5px] font-medium text-[#B89B7A] hover:text-[#F4CA73] transition-colors cursor-pointer"
                >
                  Ocultar guía
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Luminous 3D Pointer-Following Floating Orb Button */}
      <motion.div style={{ x: orbX, y: orbY }} className="pointer-events-auto flex items-center gap-2">
        {isMinimized && (
          <motion.button
            type="button"
            data-orb-button="pill"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleOrbClick}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#C88A2B]/50 bg-[#1B0F09]/92 px-3 py-1.5 text-[11px] font-semibold text-[#FEF08A] shadow-lg backdrop-blur-md hover:bg-[#26160D] transition-colors cursor-pointer"
          >
            {isSpeaking ? (
              <>
                <VoiceWaveformBars active compact />
                <span>Hablando...</span>
              </>
            ) : waitingForGesture && !isMuted ? (
              <>
                <Volume2 className="h-3 w-3 text-[#F4CA73] animate-pulse" />
                <span>Escuchar guía</span>
              </>
            ) : (
              <span>Guía Royal</span>
            )}
          </motion.button>
        )}

        <motion.button
          ref={orbAnchorRef}
          type="button"
          data-orb-button="toggle"
          onClick={handleOrbClick}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
          aria-expanded={!isMinimized}
          aria-label={isMinimized ? 'Expandir guía Royal Prestige' : 'Minimizar guía Royal Prestige'}
          title={isMinimized ? 'Expandir guía Royal Prestige' : 'Minimizar guía'}
          className="relative flex items-center justify-center rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4CA73] cursor-pointer"
        >
          <LuminousOrbSphere
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            lookX={lookX}
            lookY={lookY}
          />
        </motion.button>
      </motion.div>
    </aside>
  );
};
