import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AutumnAtmosphereProps {
  variant?: 'public' | 'dashboard';
}

interface LeafSpec {
  id: number;
  left: string;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  rotateStart: number;
  rotateEnd: number;
  color: string;
  accent: string;
  opacity: number;
  shape: 'maple' | 'oak' | 'ginkgo';
}

const LEAVES: LeafSpec[] = [
  { id: 1, left: '5%', size: 52, delay: 0, duration: 15, driftX: 68, rotateStart: -25, rotateEnd: 195, color: '#C84B24', accent: '#F29F4B', opacity: 0.86, shape: 'maple' },
  { id: 2, left: '15%', size: 42, delay: 2.6, duration: 18, driftX: -54, rotateStart: 35, rotateEnd: -165, color: '#D98A1E', accent: '#F9CF6B', opacity: 0.82, shape: 'ginkgo' },
  { id: 3, left: '26%', size: 48, delay: 6.2, duration: 16.5, driftX: 62, rotateStart: 12, rotateEnd: 225, color: '#9E3316', accent: '#D86B38', opacity: 0.8, shape: 'oak' },
  { id: 4, left: '38%', size: 38, delay: 1.4, duration: 19.5, driftX: -48, rotateStart: -40, rotateEnd: 150, color: '#E09A2B', accent: '#FCE192', opacity: 0.76, shape: 'maple' },
  { id: 5, left: '52%', size: 56, delay: 4.5, duration: 17, driftX: 58, rotateStart: 18, rotateEnd: -190, color: '#B8431F', accent: '#EDA145', opacity: 0.84, shape: 'maple' },
  { id: 6, left: '65%', size: 44, delay: 2.0, duration: 14.8, driftX: -62, rotateStart: -15, rotateEnd: 205, color: '#C87D20', accent: '#F6C465', opacity: 0.82, shape: 'ginkgo' },
  { id: 7, left: '77%', size: 50, delay: 5.8, duration: 18.2, driftX: 52, rotateStart: 28, rotateEnd: -175, color: '#8F2D14', accent: '#D45A32', opacity: 0.85, shape: 'oak' },
  { id: 8, left: '88%', size: 46, delay: 8.1, duration: 16, driftX: -56, rotateStart: -30, rotateEnd: 170, color: '#D88924', accent: '#F8D078', opacity: 0.8, shape: 'maple' },
  { id: 9, left: '94%', size: 40, delay: 3.7, duration: 15.4, driftX: -44, rotateStart: 20, rotateEnd: -145, color: '#B23E1B', accent: '#E88B44', opacity: 0.78, shape: 'ginkgo' },
  { id: 10, left: '10%', size: 45, delay: 9.5, duration: 17.5, driftX: 46, rotateStart: -18, rotateEnd: 185, color: '#A83819', accent: '#E5953E', opacity: 0.82, shape: 'oak' },
];

const MOTES = [
  { id: 'm1', left: '14%', top: '24%', size: 7, delay: 0.4, duration: 5.5 },
  { id: 'm2', left: '34%', top: '62%', size: 6, delay: 1.6, duration: 6.8 },
  { id: 'm3', left: '54%', top: '18%', size: 8, delay: 2.3, duration: 5.9 },
  { id: 'm4', left: '78%', top: '42%', size: 6, delay: 0.9, duration: 7.2 },
  { id: 'm5', left: '87%', top: '76%', size: 7, delay: 3.1, duration: 6.1 },
  { id: 'm6', left: '22%', top: '82%', size: 5, delay: 1.2, duration: 5.4 },
];

function LeafSvg({
  shape,
  color,
  accent,
  size,
  id,
}: {
  shape: LeafSpec['shape'];
  color: string;
  accent: string;
  size: number;
  id: number;
}) {
  const gradId = `leaf-grad-${id}`;
  if (shape === 'ginkgo') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className="sm:drop-shadow-[0_6px_8px_rgba(34,21,14,0.28)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={accent} />
            <stop offset="65%" stopColor={color} />
            <stop offset="100%" stopColor="#5C1D0C" />
          </linearGradient>
        </defs>
        <path
          d="M24 43V27M24 27C13 26 5 18 8 8C14 9 19 13 24 17C29 13 34 9 40 8C43 18 35 26 24 27Z"
          fill={`url(#${gradId})`}
          stroke="#5C1D0C"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 27L16 14M24 27L21 15M24 27L27 15M24 27L32 14"
          stroke="#FFF5E4"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (shape === 'oak') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className="sm:drop-shadow-[0_6px_8px_rgba(34,21,14,0.28)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={accent} />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor="#4F1809" />
          </linearGradient>
        </defs>
        <path
          d="M24 44V35M24 35C18 35 14 31 16 27C11 25 11 19 16 17C14 12 19 7 24 5C29 7 34 12 32 17C37 19 37 25 32 27C34 31 30 35 24 35Z"
          fill={`url(#${gradId})`}
          stroke="#4F1809"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 9V35M24 17L18 13M24 22L31 18M24 26L17 22M24 30L30 26"
          stroke="#FFF5E4"
          strokeOpacity="0.6"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className="sm:drop-shadow-[0_6px_9px_rgba(34,21,14,0.3)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={accent} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor="#591A0A" />
        </linearGradient>
      </defs>
      <path
        d="M24 44V33M24 5L28 15L38 12L33 21L42 25L31 29L32 35L24 31L16 35L17 29L6 25L15 21L10 12L20 15L24 5Z"
        fill={`url(#${gradId})`}
        stroke="#591A0A"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M24 11V33M24 22L15 16M24 22L33 16M24 27L14 25M24 27L34 25"
        stroke="#FFF6E6"
        strokeOpacity="0.65"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const AutumnAtmosphere: React.FC<AutumnAtmosphereProps> = ({ variant = 'public' }) => {
  const prefersReduced = useReducedMotion();
  const visibleLeaves = variant === 'dashboard' ? LEAVES.slice(0, 6) : LEAVES;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
      {/* High-resolution luxury minimalist futuristic marble kitchen backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: `url('/images/luxury-kitchen.jpg')`,
          opacity: variant === 'public' ? 0.58 : 0.22,
          transform: 'scale(1.02)',
        }}
      />

      {/* Warm autumn daylight atmospheric adaptation veil */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'public'
              ? 'radial-gradient(circle at 50% 38%, rgba(251, 243, 230, 0.35) 0%, rgba(244, 229, 206, 0.62) 55%, rgba(38, 22, 13, 0.48) 100%)'
              : 'linear-gradient(180deg, rgba(250, 243, 232, 0.86) 0%, rgba(246, 235, 220, 0.9) 100%)',
        }}
      />

      {/* Golden autumn ambient flares */}
      <div
        className="absolute -top-28 -left-24 h-[300px] w-[300px] sm:-top-36 sm:-left-32 sm:h-[480px] sm:w-[480px] rounded-full blur-2xl sm:blur-3xl"
        style={{
          background:
            variant === 'public'
              ? 'radial-gradient(circle, rgba(229, 174, 78, 0.34) 0%, rgba(200, 90, 50, 0.16) 45%, transparent 72%)'
              : 'radial-gradient(circle, rgba(229, 174, 78, 0.18) 0%, rgba(184, 74, 39, 0.08) 45%, transparent 72%)',
        }}
      />
      <div
        className="absolute -bottom-32 -right-24 h-[320px] w-[320px] sm:-bottom-44 sm:-right-28 sm:h-[520px] sm:w-[520px] rounded-full blur-2xl sm:blur-3xl"
        style={{
          background:
            variant === 'public'
              ? 'radial-gradient(circle, rgba(184, 74, 39, 0.28) 0%, rgba(200, 138, 43, 0.14) 48%, transparent 72%)'
              : 'radial-gradient(circle, rgba(184, 74, 39, 0.12) 0%, rgba(61, 107, 82, 0.06) 48%, transparent 72%)',
        }}
      />

      {/* Crisp, large, defined falling autumn leaves (capped on mobile for 60 FPS touch fluidity) */}
      {!prefersReduced &&
        visibleLeaves.map((leaf, idx) => (
          <motion.div
            key={leaf.id}
            className={`absolute -top-20 will-change-transform ${idx >= 5 ? 'hidden sm:block' : ''}`}
            style={{
              left: leaf.left,
              opacity: variant === 'dashboard' ? leaf.opacity * 0.55 : leaf.opacity,
            }}
            initial={{ y: -70, x: 0, rotate: leaf.rotateStart, scale: 0.92 }}
            animate={{
              y: ['-8vh', '114vh'],
              x: [0, leaf.driftX, -leaf.driftX * 0.6, leaf.driftX * 0.85, -leaf.driftX * 0.3],
              rotate: [leaf.rotateStart, leaf.rotateEnd * 0.5, leaf.rotateStart * 0.4, leaf.rotateEnd],
              scale: [0.92, 1.06, 0.95, 1.04],
            }}
            transition={{
              duration: leaf.duration,
              delay: leaf.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <LeafSvg shape={leaf.shape} color={leaf.color} accent={leaf.accent} size={leaf.size} id={leaf.id} />
          </motion.div>
        ))}

      {/* Subtle warm golden motes (desktop/tablet) */}
      {!prefersReduced &&
        variant === 'public' &&
        MOTES.map((mote) => (
          <motion.div
            key={mote.id}
            className="hidden sm:block absolute rounded-full bg-amber-300/65 will-change-transform"
            style={{ left: mote.left, top: mote.top, width: mote.size, height: mote.size }}
            animate={{
              opacity: [0.2, 0.85, 0.2],
              scale: [0.85, 1.4, 0.85],
              y: [0, -16, 0],
            }}
            transition={{
              duration: mote.duration,
              delay: mote.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
    </div>
  );
};
