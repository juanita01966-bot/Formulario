import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface CustomLoaderProps {
  leadName: string;
  onComplete: () => void;
}

export const CustomLoader: React.FC<CustomLoaderProps> = ({ leadName, onComplete }) => {
  const prefersReduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';

  useEffect(() => {
    const start = performance.now();
    const duration = prefersReduced ? 900 : 2700;
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const ratio = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(Math.round(eased * 100));

      if (ratio < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        window.setTimeout(onComplete, 220);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete, prefersReduced]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[460px] mx-auto"
    >
      <div className="relative overflow-hidden rounded-[26px] sm:rounded-[32px] bg-[#FFFDF9]/78 backdrop-blur-xl border border-[#DFC9AB]/80 autumn-card-shadow px-5 py-7 sm:px-7 sm:py-9 text-center">
        <div className="pointer-events-none absolute inset-2 sm:inset-2.5 rounded-[20px] sm:rounded-[24px] border border-[#E6D5BF]/60" />
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#4B644A]" />

        {/* Realistic Overhead Culinary Place Setting Animation: Fork & Knife moving onto Porcelain Plate */}
        <div className="relative z-10 mx-auto mb-5 sm:mb-6 w-full max-w-[232px] sm:max-w-[280px]">
          <svg
            viewBox="0 0 280 200"
            className="w-full h-auto drop-shadow-[0_14px_24px_rgba(34,21,14,0.16)]"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              {/* Placemat warm linen */}
              <linearGradient id="placematGrad" x1="16" y1="14" x2="264" y2="186" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F3E6D3" />
                <stop offset="100%" stopColor="#E1CCB0" />
              </linearGradient>

              {/* Fine porcelain rim & well */}
              <radialGradient id="plateOuterGrad" cx="46%" cy="42%" r="60%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="68%" stopColor="#FAF6EE" />
                <stop offset="100%" stopColor="#DDD0BE" />
              </radialGradient>
              <radialGradient id="plateWellGrad" cx="44%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="72%" stopColor="#F6F1E7" />
                <stop offset="100%" stopColor="#E5D9C7" />
              </radialGradient>

              {/* Brushed surgical steel gradient for fork & knife */}
              <linearGradient id="steelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94A3B8" />
                <stop offset="35%" stopColor="#F8FAFC" />
                <stop offset="65%" stopColor="#CBD5E1" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>
              <linearGradient id="handleDarkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B2518" />
                <stop offset="50%" stopColor="#22140C" />
                <stop offset="100%" stopColor="#140B06" />
              </linearGradient>
              <linearGradient id="goldTrimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F4CA73" />
                <stop offset="55%" stopColor="#C88A2B" />
                <stop offset="100%" stopColor="#8C5616" />
              </linearGradient>
            </defs>

            {/* Linen Placemat Base */}
            <rect
              x="16"
              y="16"
              width="248"
              height="168"
              rx="22"
              fill="url(#placematGrad)"
              stroke="#C9AF8E"
              strokeWidth="1.2"
            />
            <rect
              x="23"
              y="23"
              width="234"
              height="154"
              rx="17"
              stroke="#B89B7A"
              strokeOpacity="0.45"
              strokeDasharray="4 4"
              strokeWidth="1"
            />

            {/* Soft table shadow under plate */}
            <ellipse cx="143" cy="105" rx="68" ry="66" fill="rgba(34,21,14,0.14)" />

            {/* Realistic Porcelain Dinner Plate */}
            <motion.g
              initial={{ scale: 0.9, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: '140px 100px' }}
            >
              <circle cx="140" cy="100" r="66" fill="url(#plateOuterGrad)" stroke="#D0C1AC" strokeWidth="1.2" />
              {/* Gold Rim Detail */}
              <circle cx="140" cy="100" r="59" stroke="url(#goldTrimGrad)" strokeWidth="1.6" strokeOpacity="0.85" />
              {/* Recessed Plate Center */}
              <circle cx="140" cy="100" r="45" fill="url(#plateWellGrad)" stroke="#E3D7C5" strokeWidth="1" />
              {/* Specular Glaze Highlight */}
              <path
                d="M108 74C118 63 136 60 152 63"
                stroke="#FFFFFF"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeOpacity="0.7"
              />
            </motion.g>

            {/* Steel Dinner Fork sliding from left onto the plate */}
            <motion.g
              initial={{ x: -58, y: 18, rotate: -18, opacity: 0 }}
              animate={{
                x: [null, 22, 34],
                y: [null, -4, 0],
                rotate: [-18, 6, 12],
                opacity: [0, 1, 1],
              }}
              transition={{
                duration: 2.2,
                times: [0, 0.55, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ transformOrigin: '92px 105px' }}
            >
              {/* Soft utensil drop shadow */}
              <rect x="88" y="88" width="12" height="72" rx="6" fill="rgba(34,21,14,0.16)" />
              {/* Ergonomic handle */}
              <rect x="85" y="106" width="11" height="52" rx="5.5" fill="url(#handleDarkGrad)" stroke="#4E3424" strokeWidth="0.7" />
              {/* Brass rivets */}
              <circle cx="90.5" cy="120" r="1.4" fill="#E5AE4E" />
              <circle cx="90.5" cy="144" r="1.4" fill="#E5AE4E" />
              {/* Neck & Gold bolster */}
              <rect x="87" y="99" width="7" height="8" rx="1.5" fill="url(#goldTrimGrad)" />
              <path d="M88 76H93V100H88Z" fill="url(#steelGrad)" />
              {/* 4 Precision Steel Tines */}
              <path
                d="M82 52C82 49 83.2 49 83.4 52V71C83.4 74.5 86 76 90.5 76C95 76 97.6 74.5 97.6 71V52C97.8 49 99 49 99 52V72C99 77 95.5 79.5 90.5 79.5C85.5 79.5 82 77 82 72V52Z"
                fill="url(#steelGrad)"
                stroke="#64748B"
                strokeWidth="0.4"
              />
              <rect x="86.2" y="51" width="1.8" height="22" rx="0.9" fill="url(#steelGrad)" />
              <rect x="90" y="51" width="1.8" height="22" rx="0.9" fill="url(#steelGrad)" />
              <rect x="93.8" y="51" width="1.8" height="22" rx="0.9" fill="url(#steelGrad)" />
            </motion.g>

            {/* Steel Dinner Knife sliding from right onto the plate */}
            <motion.g
              initial={{ x: 58, y: 18, rotate: 18, opacity: 0 }}
              animate={{
                x: [null, -22, -34],
                y: [null, -4, 0],
                rotate: [18, -6, -12],
                opacity: [0, 1, 1],
              }}
              transition={{
                duration: 2.2,
                times: [0, 0.55, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ transformOrigin: '188px 105px' }}
            >
              {/* Soft utensil drop shadow */}
              <rect x="186" y="88" width="12" height="72" rx="6" fill="rgba(34,21,14,0.16)" />
              {/* Ergonomic handle */}
              <rect x="184" y="106" width="11.5" height="52" rx="5.5" fill="url(#handleDarkGrad)" stroke="#4E3424" strokeWidth="0.7" />
              {/* Brass rivets */}
              <circle cx="189.7" cy="120" r="1.4" fill="#E5AE4E" />
              <circle cx="189.7" cy="144" r="1.4" fill="#E5AE4E" />
              {/* Gold bolster collar */}
              <rect x="185.5" y="99" width="8.5" height="8" rx="1.5" fill="url(#goldTrimGrad)" />
              {/* Mirror-polished Chef Knife Blade */}
              <path
                d="M185.5 99V56C185.5 47 190.5 43 194.8 46.5C195.8 47.4 196.2 50 196 54L194 99H185.5Z"
                fill="url(#steelGrad)"
                stroke="#64748B"
                strokeWidth="0.5"
              />
              {/* Blade edge sheen */}
              <path d="M187.5 54V94" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="1.2" strokeLinecap="round" />
            </motion.g>

            {/* Subtle golden shimmer when cutlery rests over the plate */}
            <motion.circle
              cx="140"
              cy="100"
              r="36"
              stroke="#F4CA73"
              strokeWidth="1.5"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 0.55, 0], scale: [0.75, 1.15, 1.25] }}
              transition={{ duration: 1.4, delay: 1.5, ease: 'easeOut' }}
              style={{ transformOrigin: '140px 100px' }}
            />
          </svg>
        </div>

        <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#22150E] leading-tight">
          Preparando tu mesa y tu obsequio,{' '}
          <span className="gold-foil-text">{firstName}</span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-[#5C4332]">
          Un momento mientras disponemos tus cajas disponibles...
        </p>

        {/* Clean Progress Bar */}
        <div className="mt-6 relative z-10">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6E5341] mb-2">
            <span>Verificando disponibilidad</span>
            <span className="font-mono tabular-nums text-[#8C3318]">{progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E8DAC5]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#8C3318] via-[#C88A2B] to-[#F0C975]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
