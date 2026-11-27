import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  Globe,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  User,
} from 'lucide-react';
import type { AppSettings, GiftThemeId } from '../../types/app';
import { resolveBoxPalette } from '../../shared/giftThemes';
import { OTHER_CITY_VALUE, US_STATES } from '../../shared/usLocations';
import { LocationDropdown } from './LocationDropdown';
import { TermsModal } from './TermsModal';
import { getPublicLandingUrl, playDopamineChime } from './shareQrCard';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';

export interface ActiveReferralInfo {
  code: string;
  name: string;
  avatarUrl?: string | null;
}

interface LeadFormCardProps {
  settings: AppSettings;
  referralPartner?: ActiveReferralInfo | null;
  referralCode?: string | null;
  onSubmit: (data: {
    name: string;
    phone: string;
    address: string;
    acceptedTerms: boolean;
  }) => Promise<void>;
}

function StylizedHeroGift3D({
  giftTheme,
  customBoxColor,
  compact = false,
}: {
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  compact?: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [supportsFineHover, setSupportsFineHover] = useState(false);
  const palette = resolveBoxPalette(giftTheme, customBoxColor, 0);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setSupportsFineHover(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }
  }, []);

  return (
    <motion.div
      className={`relative flex items-center justify-center perspective-1000 select-none shrink-0 ${
        compact ? 'h-16 w-16' : 'mx-auto mb-5 h-32 w-32'
      }`}
      onMouseMove={
        supportsFineHover && !prefersReduced
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = (e.clientX - rect.left) / rect.width;
              const py = (e.clientY - rect.top) / rect.height;
              setTilt({ rx: (0.5 - py) * 20, ry: (px - 0.5) * 24 });
            }
          : undefined
      }
      onMouseLeave={supportsFineHover ? () => setTilt({ rx: 0, ry: 0 }) : undefined}
      initial={{ scale: 0.88, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {/* Glowing radial aura matching the active theme */}
      <motion.div
        className="absolute inset-0.5 rounded-full blur-xl will-change-transform"
        style={{ background: palette.glow }}
        animate={prefersReduced ? { opacity: 0.7 } : { scale: [0.95, 1.15, 0.95], opacity: [0.55, 0.9, 0.55] }}
        transition={prefersReduced ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating 3D gift box */}
      <motion.div
        animate={prefersReduced ? undefined : { y: [0, compact ? -4 : -7, 0], rotateZ: [-1.2, 1.2, -1.2] }}
        transition={prefersReduced ? undefined : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 140ms ease-out',
        }}
        className={`relative flex items-center justify-center will-change-transform ${compact ? 'h-14 w-14' : 'h-28 w-28'}`}
      >
        <svg viewBox="0 0 130 130" className="w-full h-full drop-shadow-[0_14px_18px_rgba(34,21,14,0.38)]" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="heroGoldRibbon" x1="0" y1="0" x2="130" y2="130" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={palette.ribbonStart} />
              <stop offset="50%" stopColor={palette.ribbonMid} />
              <stop offset="100%" stopColor={palette.ribbonEnd} />
            </linearGradient>
          </defs>

          {/* Pedestal ground shadow */}
          <ellipse cx="65" cy="116" rx="40" ry="7" fill="rgba(34,21,14,0.28)" />

          {/* Left Front 3D Face */}
          <polygon
            points="23,58 65,78 65,114 23,94"
            fill={palette.front}
            stroke="#F4CA73"
            strokeOpacity="0.45"
            strokeWidth="0.9"
          />
          {/* Right Shaded 3D Face */}
          <polygon
            points="65,78 107,58 107,94 65,114"
            fill={palette.side}
            stroke="#F4CA73"
            strokeOpacity="0.35"
            strokeWidth="0.9"
          />

          {/* Vertical Gold Ribbons on Box Sides */}
          <polygon points="40,66 48,70 48,106 40,102" fill="url(#heroGoldRibbon)" />
          <polygon points="82,70 90,66 90,102 82,106" fill="url(#heroGoldRibbon)" opacity="0.9" />

          {/* Lid Left Rim */}
          <polygon points="19,48 65,70 65,80 19,58" fill={palette.lid} />
          {/* Lid Right Rim */}
          <polygon points="65,70 111,48 111,58 65,80" fill={palette.front} />
          {/* Lid Top Diamond */}
          <polygon
            points="65,26 111,48 65,70 19,48"
            fill={palette.lid}
            stroke="#FDE68A"
            strokeOpacity="0.6"
            strokeWidth="1"
          />

          {/* Cross Gold Ribbons Across Lid */}
          <polygon points="39,38 47,34 93,56 85,60" fill="url(#heroGoldRibbon)" />
          <polygon points="83,34 91,38 45,60 37,56" fill="url(#heroGoldRibbon)" />

          {/* Lid Rim Ribbon Extensions */}
          <polygon points="38,57 46,61 46,71 38,67" fill="url(#heroGoldRibbon)" />
          <polygon points="84,61 92,57 92,67 84,71" fill="url(#heroGoldRibbon)" />

          {/* 3D Sculpted Gold Bow Loops */}
          <path
            d="M65 48 C48 28, 34 36, 46 47 C52 52, 60 50, 65 48 Z"
            fill="url(#heroGoldRibbon)"
            stroke="#78350F"
            strokeWidth="0.9"
          />
          <path
            d="M65 48 C82 28, 96 36, 84 47 C78 52, 70 50, 65 48 Z"
            fill="url(#heroGoldRibbon)"
            stroke="#78350F"
            strokeWidth="0.9"
          />
          <circle cx="65" cy="48" r="5.5" fill="#FEF08A" stroke="#92400E" strokeWidth="1.2" />

          {/* Specular Sparkle Accents */}
          <circle cx="28" cy="30" r="2.2" fill="#FDE68A" />
          <circle cx="102" cy="32" r="2.5" fill="#FDE68A" />
          <circle cx="65" cy="16" r="1.8" fill="#FEF08A" />
        </svg>
      </motion.div>
    </motion.div>
  );
}

export const LeadFormCard: React.FC<LeadFormCardProps> = ({
  settings,
  referralPartner = null,
  referralCode = null,
  onSubmit,
}) => {
  const prefersReduced = Boolean(useReducedMotion());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [address, setAddress] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    state: false,
    city: false,
    customCity: false,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const shareTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current !== null) {
        window.clearTimeout(shareTimerRef.current);
      }
    };
  }, []);

  const selectedState = useMemo(
    () => US_STATES.find((s) => s.code === selectedStateCode) || null,
    [selectedStateCode]
  );

  const stateItems = useMemo(
    () =>
      US_STATES.map((s) => ({
        value: s.code,
        label: s.name,
        badge: s.code,
      })),
    []
  );

  const cityItems = useMemo(() => {
    if (!selectedState) return [];
    return [
      ...selectedState.cities.map((c) => ({
        value: c,
        label: c,
      })),
      {
        value: OTHER_CITY_VALUE,
        label: 'Otra ciudad en este estado...',
      },
    ];
  }, [selectedState]);

  const isOtherCity = selectedCity === OTHER_CITY_VALUE;
  const resolvedCity = isOtherCity ? customCity.trim() : selectedCity.trim();

  const nameValid = name.trim().length >= 3;
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 8 && phoneDigits.length <= 15;
  const stateValid = Boolean(selectedState);
  const cityValid = resolvedCity.length >= 2;

  const showNameError = touched.name && !nameValid;
  const showPhoneError = touched.phone && !phoneValid;
  const showStateError = touched.state && !stateValid;
  const showCityError = (touched.city || (isOtherCity && touched.customCity)) && !cityValid;

  const rawHostTitle = settings.hostTitle?.trim() || 'The Ciprian Company';
  const cleanHostTitle =
    rawHostTitle.toUpperCase().includes('QR') || rawHostTitle.toLowerCase().includes('cyprianos')
      ? 'The Ciprian Company'
      : rawHostTitle;

  const handleStateChange = (nextCode: string) => {
    setSelectedStateCode(nextCode);
    setSelectedCity('');
    setCustomCity('');
    setTouched((prev) => ({ ...prev, state: true, city: false, customCity: false }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      name: true,
      phone: true,
      state: true,
      city: true,
      customCity: true,
    });
    setSubmitError(null);

    if (!nameValid || !phoneValid || !stateValid || !cityValid || !accepted) {
      return;
    }

    const locationLabel = selectedState ? `${resolvedCity}, ${selectedState.name}` : resolvedCity;
    const composedAddress = address.trim() ? `${address.trim()} · ${locationLabel}` : locationLabel;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        address: composedAddress,
        acceptedTerms: accepted,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ocurrió un problema al registrar tus datos.');
      setSubmitting(false);
    }
  };

  const showShareToast = (message: string) => {
    setShareFeedback(message);
    playDopamineChime(2, prefersReduced);
    if (shareTimerRef.current !== null) {
      window.clearTimeout(shareTimerRef.current);
    }
    shareTimerRef.current = window.setTimeout(() => {
      setShareFeedback(null);
    }, 3000);
  };

  const handleShareInvite = async () => {
    const shareUrl = getPublicLandingUrl(referralPartner?.code || referralCode);
    const text =
      'Reclama tu obsequio exclusivo y comparte este acceso para participar por hasta $2,000 USD en productos Royal Prestige con The Ciprian Company.';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'The Ciprian Company · Premio Royal Prestige',
          text,
          url: shareUrl,
        });
        showShareToast('¡Invitación VIP compartida!');
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Fallback to clipboard below
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = shareUrl;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      showShareToast('¡Enlace VIP copiado!');
    } catch {
      setShareFeedback(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[500px] mx-auto"
      >
        {/* Outer subtle champagne glow */}
        <div className="pointer-events-none -inset-1 absolute rounded-[36px] bg-gradient-to-br from-[#E5AE4E]/35 via-[#B84A27]/15 to-[#4B644A]/25 blur-xl opacity-75" />

        <div className="relative rounded-[26px] sm:rounded-[32px] bg-[#FFFDF9]/74 backdrop-blur-xl border border-[#DFC9AB]/80 autumn-card-shadow px-4 py-5 sm:px-9 sm:py-9">
          {/* Clipped decorative border & top foil stripe so dropdowns inside can overflow freely */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px] sm:rounded-[32px]">
            <div className="absolute inset-2 sm:inset-2.5 rounded-[20px] sm:rounded-[24px] border border-[#E6D5BF]/60" />
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#4B644A]" />
          </div>

          {/* Circular Company Logo Medallion */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mx-auto mb-3.5 sm:mb-4 flex h-20 w-20 sm:h-32 sm:w-32 items-center justify-center rounded-full overflow-hidden bg-[#1A120D] border-2 border-[#C88A2B]/75 shadow-[0_14px_32px_-8px_rgba(34,21,14,0.45)]"
          >
            <img
              src="/images/logo%20ciprian.png"
              alt={cleanHostTitle}
              className="h-full w-full object-cover"
            />
          </motion.div>

          {/* Subtle Ambassador Invitation Pill (only rendered when a valid referral is active) */}
          <AnimatePresence>
            {referralPartner && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 mb-3.5 sm:mb-4 flex justify-center"
              >
                <div
                  role="status"
                  aria-live="polite"
                  className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[#D8B274]/75 bg-gradient-to-r from-[#FAF0DF] via-[#FFF9EE] to-[#FAF0DF] pl-2 pr-3.5 py-1.5 text-[11.5px] sm:text-xs text-[#5C4332] shadow-[0_6px_18px_-10px_rgba(140,51,24,0.35)] text-center leading-snug"
                >
                  <AmbassadorAvatar
                    name={referralPartner.name}
                    avatarUrl={referralPartner.avatarUrl}
                    size="xs"
                    ring="gold"
                    className="h-7 w-7 text-[11px] shrink-0"
                  />
                  <span>
                    Invitación especial de{' '}
                    <strong className="font-semibold text-[#3D2114]">
                      {referralPartner.name}
                    </strong>
                  </span>
                  <span className="text-[#C88A2B]/80" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-[10.5px] sm:text-[11px] font-semibold tracking-wider text-[#8C3318] uppercase">
                    Tag {referralPartner.code}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hero Copy */}
          <div className="relative z-10 text-center space-y-2 sm:space-y-2.5 mb-4 sm:mb-5">
            <h1 className="font-serif text-[20px] sm:text-[26px] leading-[1.24] font-semibold tracking-tight text-[#22150E]">
              Reclama tu obsequio exclusivo y participa por hasta{' '}
              <span className="gold-foil-text font-bold">$2,000 USD</span> en productos Royal Prestige.
            </h1>

            <p className="text-xs sm:text-[13.5px] text-[#4E382B] leading-relaxed">
              Registra tus datos para destapar tu regalo directo y comparte nuestro código QR con amigos o
              familiares para participar por premios de hasta{' '}
              <strong className="text-[#8C3318]">$2,000 USD</strong> en productos exclusivos de la marca.
            </p>

            <p className="text-[11.5px] sm:text-xs text-[#6E5341] leading-relaxed">
              Al participar, acepto los{' '}
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="inline-block py-1.5 -my-1 px-0.5 font-semibold text-[#9E4725] underline decoration-[#C88A2B]/60 underline-offset-2 hover:text-[#7B2D13] cursor-pointer"
              >
                Términos y Condiciones
              </button>{' '}
              · <span className="font-medium text-[#3D2A1E]">Sin costo ni obligación de compra.</span>
            </p>
          </div>

          {/* Clean Hairline Divider */}
          <div className="relative z-10 h-px w-full bg-gradient-to-r from-transparent via-[#DFCBB3] to-transparent mb-4 sm:mb-5" />

          {/* Form Header with adapted 3D Gift Box beside "Reclama tu premio" */}
          <div className="relative z-10 mb-4 sm:mb-5 flex items-center justify-between gap-3 rounded-2xl bg-[#FAF3E8]/70 border border-[#E6D5BF]/80 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <div className="min-w-0">
              <h2 className="font-serif text-lg sm:text-xl font-semibold text-[#22150E] leading-tight">
                Reclama tu premio
              </h2>
              <p className="text-xs sm:text-[13px] text-[#5C4332] mt-1 leading-snug">
                Completa tus datos, responde unas breves preguntas y destapa tu obsequio.
              </p>
            </div>
            <StylizedHeroGift3D
              compact
              giftTheme={settings.giftTheme}
              customBoxColor={settings.customBoxColor}
            />
          </div>

          <form onSubmit={handleFormSubmit} noValidate className="space-y-3.5 sm:space-y-4">
            {/* Name input */}
            <div>
              <label htmlFor="lead-name" className="sr-only">
                Nombre completo
              </label>
              <div
                className={`group relative flex min-h-[48px] items-center rounded-2xl border bg-[#FCF8F2] transition-all duration-200 ${
                  showNameError
                    ? 'border-red-500 ring-2 ring-red-500/15 bg-red-50/30'
                    : 'border-[#DFCBB3] focus-within:border-[#B84A27] focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-500/10'
                }`}
              >
                <span className="pl-4 pr-2.5 text-[#8C6E58] group-focus-within:text-[#B84A27] transition-colors">
                  <User className="h-[18px] w-[18px]" />
                </span>
                <input
                  id="lead-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Nombre completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                  className="w-full bg-transparent py-3 sm:py-3.5 pr-4 text-base sm:text-[15px] text-[#22150E] placeholder:text-[#9D8370] focus:outline-none"
                />
                {showNameError && (
                  <span className="pr-3.5 text-red-500" aria-hidden="true">
                    <AlertCircle className="h-5 w-5 fill-red-500 text-white" />
                  </span>
                )}
              </div>
              <AnimatePresence>
                {showNameError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1.5 pl-2 text-xs font-medium text-red-600"
                  >
                    Ingresa tu nombre completo.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Phone input */}
            <div>
              <label htmlFor="lead-phone" className="sr-only">
                Teléfono
              </label>
              <div
                className={`group relative flex min-h-[48px] items-center rounded-2xl border bg-[#FCF8F2] transition-all duration-200 ${
                  showPhoneError
                    ? 'border-red-500 ring-2 ring-red-500/15 bg-red-50/30'
                    : 'border-[#DFCBB3] focus-within:border-[#B84A27] focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-500/10'
                }`}
              >
                <span className="pl-4 pr-2.5 text-[#8C6E58] group-focus-within:text-[#B84A27] transition-colors">
                  <Phone className="h-[18px] w-[18px]" />
                </span>
                <input
                  id="lead-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Teléfono (ej. 305 555 0148)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                  className="w-full bg-transparent py-3 sm:py-3.5 pr-4 text-base sm:text-[15px] text-[#22150E] placeholder:text-[#9D8370] focus:outline-none tabular-nums"
                />
                {showPhoneError && (
                  <span className="pr-3.5 text-red-500" aria-hidden="true">
                    <AlertCircle className="h-5 w-5 fill-red-500 text-white" />
                  </span>
                )}
              </div>
              <AnimatePresence>
                {showPhoneError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1.5 pl-2 text-xs font-medium text-red-600"
                  >
                    Ingresa un número de teléfono válido.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* US State & City of Residence Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <LocationDropdown
                  id="lead-state"
                  label="Estado de residencia (EE. UU.)"
                  placeholder="Estado de residencia"
                  searchPlaceholder="Buscar estado..."
                  value={selectedStateCode}
                  items={stateItems}
                  hasError={showStateError}
                  icon={<Globe className="h-[18px] w-[18px]" />}
                  onChange={handleStateChange}
                  onBlurValidate={() => setTouched((prev) => ({ ...prev, state: true }))}
                />
                <AnimatePresence>
                  {showStateError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-1.5 pl-2 text-xs font-medium text-red-600"
                    >
                      Selecciona tu estado de residencia.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <LocationDropdown
                  id="lead-city"
                  label="Ciudad de residencia"
                  placeholder={selectedState ? 'Ciudad de residencia' : 'Primero elige un estado'}
                  searchPlaceholder="Buscar ciudad..."
                  value={selectedCity}
                  items={cityItems}
                  disabled={!selectedState}
                  hasError={showCityError && !isOtherCity}
                  icon={<Building2 className="h-[18px] w-[18px]" />}
                  onChange={(val) => {
                    setSelectedCity(val);
                    if (val !== OTHER_CITY_VALUE) setCustomCity('');
                    setTouched((prev) => ({ ...prev, city: true }));
                  }}
                  onBlurValidate={() => setTouched((prev) => ({ ...prev, city: true }))}
                />
                <AnimatePresence>
                  {showCityError && !isOtherCity && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-1.5 pl-2 text-xs font-medium text-red-600"
                    >
                      Selecciona tu ciudad de residencia.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Custom City input when user selects "Otra ciudad en este estado..." */}
            <AnimatePresence>
              {isOtherCity && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div
                    className={`group relative flex min-h-[48px] items-center rounded-2xl border bg-[#FCF8F2] transition-all duration-200 ${
                      showCityError
                        ? 'border-red-500 ring-2 ring-red-500/15 bg-red-50/30'
                        : 'border-[#DFCBB3] focus-within:border-[#B84A27] focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-500/10'
                    }`}
                  >
                    <span className="pl-4 pr-2.5 text-[#8C6E58] group-focus-within:text-[#B84A27] transition-colors">
                      <Building2 className="h-[18px] w-[18px]" />
                    </span>
                    <input
                      type="text"
                      placeholder={`Escribe tu ciudad en ${selectedState?.name || 'EE. UU.'}`}
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, customCity: true }))}
                      className="w-full bg-transparent py-3 sm:py-3.5 pr-4 text-base sm:text-[15px] text-[#22150E] placeholder:text-[#9D8370] focus:outline-none"
                    />
                    {showCityError && (
                      <span className="pr-3.5 text-red-500" aria-hidden="true">
                        <AlertCircle className="h-5 w-5 fill-red-500 text-white" />
                      </span>
                    )}
                  </div>
                  {showCityError && (
                    <p className="mt-1.5 pl-2 text-xs font-medium text-red-600">
                      Escribe el nombre de tu ciudad de residencia.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Optional Housing Address input (no specific street example required) */}
            <div>
              <label htmlFor="lead-address" className="sr-only">
                Dirección de vivienda (opcional)
              </label>
              <div className="group relative flex min-h-[48px] items-center rounded-2xl border border-[#DFCBB3] bg-[#FCF8F2] transition-all duration-200 focus-within:border-[#B84A27] focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-500/10">
                <span className="pl-4 pr-2.5 text-[#8C6E58] group-focus-within:text-[#B84A27] transition-colors">
                  <MapPin className="h-[18px] w-[18px]" />
                </span>
                <input
                  id="lead-address"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Dirección de vivienda (opcional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-transparent py-3 sm:py-3.5 pr-4 text-base sm:text-[15px] text-[#22150E] placeholder:text-[#9D8370] focus:outline-none"
                />
              </div>
            </div>

            {/* Consent Checkbox */}
            <label className="flex min-h-[48px] items-start gap-3 rounded-2xl border border-[#EFE2D0] bg-[#FAF3E8]/60 p-3.5 cursor-pointer hover:bg-[#FAF3E8] transition-colors">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#C6A787] accent-[#8C3318] cursor-pointer"
              />
              <span className="text-[12.5px] leading-snug text-[#4E382B]">
                Confirmo que soy mayor de 18 años y autorizo que me contacten por llamada, mensaje de texto o WhatsApp
                para validar mi información y coordinar la entrega de mi regalo.
              </span>
            </label>

            {submitError && (
              <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {submitError}
              </p>
            )}

            {/* Conditional CTA button revealed smoothly on acceptance */}
            <AnimatePresence>
              {accepted && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                >
                  <button
                    type="submit"
                    disabled={submitting}
                    className="relative min-h-[50px] w-full overflow-hidden rounded-full bg-gradient-to-r from-[#22150E] via-[#5C2918] to-[#8C3318] py-3.5 sm:py-4 px-6 text-base font-semibold text-[#FFFDF9] shadow-lg shadow-[#5C2918]/25 hover:shadow-xl hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-70"
                  >
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent animate-shimmer" />
                    <span className="relative flex items-center justify-center gap-2">
                      {submitting ? 'Activando experiencia...' : 'Continuar'}
                      <ChevronRight className="h-5 w-5" />
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Masterized QR / VIP Ambassador Invite Share Strip */}
          <div className="relative z-10 mt-5 pt-4 border-t border-[#E6D5BF]/75">
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 rounded-2xl border border-[#E5C17B]/65 bg-gradient-to-r from-[#FAF1E0] via-[#FFF9EE] to-[#FAF1E0] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#9E4725] inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[#C88A2B]" />
                  Comparte y multiplica tus oportunidades
                </p>
                <p className="mt-0.5 text-[11.5px] text-[#5C4332] leading-snug">
                  Comparte este acceso QR y participa por hasta{' '}
                  <strong className="text-[#8C3318]">$2,000 USD</strong>.
                </p>
              </div>
              <motion.button
                type="button"
                onClick={handleShareInvite}
                whileHover={prefersReduced ? undefined : { scale: 1.03, y: -1 }}
                whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                className="relative w-full sm:w-auto shrink-0 min-h-[44px] overflow-hidden inline-flex items-center justify-center gap-1.5 rounded-full border border-[#D4942A]/75 bg-gradient-to-r from-[#26150C] via-[#4D2612] to-[#7A3516] px-4 py-2 text-xs font-bold text-[#FEF08A] shadow-[0_8px_20px_-8px_rgba(92,41,24,0.55)] hover:brightness-110 transition-all cursor-pointer"
              >
                {!prefersReduced && (
                  <motion.span
                    aria-hidden="true"
                    animate={{ x: ['-140%', '260%'] }}
                    transition={{ duration: 2.3, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  {shareFeedback ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                      <span className="text-emerald-200">{shareFeedback}</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5 text-[#FDE047]" />
                      <span>Compartir invitación</span>
                    </>
                  )}
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} hostTitle={settings.hostTitle} />
    </>
  );
};
