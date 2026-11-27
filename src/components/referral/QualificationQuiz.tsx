import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Gift, Share2, Sparkles } from 'lucide-react';
import type { CreditTier, LeadQualification } from '../../types/app';

interface QualificationQuizProps {
  leadName: string;
  onComplete: (qualification: LeadQualification) => void;
}

type QuizStage =
  | 'knows_brand'
  | 'yes_is_client'
  | 'yes_rating'
  | 'yes_future_product'
  | 'no_golden_ticket'
  | 'no_healthy_eating'
  | 'no_future_product'
  | 'us_credit';

type UsCreditValue = 'yes' | 'building' | 'no';

interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
  points: number;
}

interface UsCreditOption extends OptionItem {
  value: UsCreditValue;
  shortLabel: string;
  tier: CreditTier;
  minScore: number;
  maxScore: number;
}

const US_CREDIT_OPTIONS: UsCreditOption[] = [
  {
    id: 'us-credit-yes',
    value: 'yes',
    shortLabel: 'Crédito establecido en EE. UU.',
    label: 'Sí, ya tengo crédito establecido en EE. UU.',
    sublabel: 'Cuento con tarjetas de crédito, financiamiento o historial crediticio activo.',
    points: 90,
    tier: 'alto',
    minScore: 82,
    maxScore: 100,
  },
  {
    id: 'us-credit-building',
    value: 'building',
    shortLabel: 'Construyendo crédito en EE. UU.',
    label: 'Estoy empezando a construir mi crédito en EE. UU.',
    sublabel: 'Tengo historial reciente o estoy fortaleciendo mi perfil crediticio.',
    points: 60,
    tier: 'medio',
    minScore: 52,
    maxScore: 72,
  },
  {
    id: 'us-credit-no',
    value: 'no',
    shortLabel: 'Sin crédito establecido en EE. UU.',
    label: 'Aún no he establecido crédito en EE. UU.',
    sublabel: 'Todavía no cuento con historial crediticio en Estados Unidos.',
    points: 30,
    tier: 'basico',
    minScore: 20,
    maxScore: 42,
  },
];

const KNOWS_OPTIONS: Array<OptionItem & { value: boolean }> = [
  {
    id: 'yes',
    value: true,
    label: 'Sí, conozco la marca Royal Prestige',
    sublabel: 'He escuchado sobre sus sistemas de cocina o he visto sus productos.',
    points: 20,
  },
  {
    id: 'no',
    value: false,
    label: 'No, aún no conozco la marca',
    sublabel: 'Me gustaría conocer cómo funcionan sus productos para el hogar.',
    points: 10,
  },
];

const IS_CLIENT_OPTIONS: Array<OptionItem & { value: boolean }> = [
  {
    id: 'client-yes',
    value: true,
    label: 'Sí, soy cliente de Royal Prestige',
    sublabel: 'Ya cuento con productos de la marca en mi cocina.',
    points: 35,
  },
  {
    id: 'client-no',
    value: false,
    label: 'Aún no soy cliente',
    sublabel: 'Conozco la marca, pero todavía no tengo productos en casa.',
    points: 25,
  },
];

const FUTURE_PRODUCTS_YES: OptionItem[] = [
  {
    id: 'ollas',
    label: 'Ollas con la tecnología de cocinar sin agua y sin aceite',
    points: 25,
  },
  {
    id: 'extractor',
    label: 'Extractor de jugos con la tecnología de hacer helados y smoothie',
    points: 25,
  },
  {
    id: 'licuadora',
    label: 'La licuadora con la tecnología que muele y tritura',
    points: 25,
  },
  {
    id: 'purificador',
    label: 'Purificador con tecnología de limpieza profunda para un agua más limpia',
    points: 25,
  },
  {
    id: 'todas',
    label: 'Todas las anteriores',
    points: 30,
  },
];

const HEALTHY_EATING_OPTIONS: OptionItem[] = [
  {
    id: 'healthy-priority',
    label: 'Sí, comer saludable es una prioridad para mi familia',
    points: 40,
  },
  {
    id: 'healthy-interested',
    label: 'Sí, me interesa mejorar nuestra alimentación diaria',
    points: 30,
  },
  {
    id: 'healthy-traditional',
    label: 'Por ahora cocinamos de forma tradicional',
    points: 15,
  },
];

const GOLDEN_TICKET_OPTIONS: Array<OptionItem & { action: 'use' | 'cede'; badge: string }> = [
  {
    id: 'use-ticket',
    action: 'use',
    badge: 'Regalo Directo',
    label: 'Usar mi Boleto Dorado ahora',
    sublabel: 'Quiero descubrir mi obsequio directo de cocina y conocer las líneas de nuestro catálogo exclusivo.',
    points: 35,
  },
  {
    id: 'cede-ticket',
    action: 'cede',
    badge: 'Hasta $2,000 USD',
    label: 'Ceder mi Boleto Dorado a un amigo/familiar y compartir QR ($2,000 USD)',
    sublabel: 'Abre el Folleto Dorado interactivo 3D, comparte tu código QR y multiplica tus probabilidades de ganar.',
    points: 30,
  },
];

const FUTURE_PRODUCTS_NO: OptionItem[] = [
  {
    id: 'ollas-no',
    label: 'Ollas con la tecnología de cocinar sin agua y sin aceite',
    points: 35,
  },
  {
    id: 'extractor-no',
    label: 'Extractor de jugos con la tecnología de hacer helados y smoothie',
    points: 30,
  },
  {
    id: 'licuadora-no',
    label: 'La licuadora con la tecnología que muele y tritura',
    points: 30,
  },
  {
    id: 'purificador-no',
    label: 'Purificador con tecnología de limpieza profunda para un agua más limpia',
    points: 30,
  },
  {
    id: 'todas-no',
    label: 'Todas las anteriores',
    points: 40,
  },
];

export const QualificationQuiz: React.FC<QualificationQuizProps> = ({ leadName, onComplete }) => {
  const prefersReduced = useReducedMotion();
  const [stage, setStage] = useState<QuizStage>('knows_brand');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const [knowsBrand, setKnowsBrand] = useState<boolean | null>(null);
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [healthyInterest, setHealthyInterest] = useState<OptionItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<OptionItem | null>(null);

  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';

  const progressRatio = (() => {
    if (stage === 'knows_brand') return 0.16;
    if (stage === 'yes_is_client' || stage === 'no_golden_ticket') return 0.34;
    if (stage === 'yes_rating' || stage === 'no_healthy_eating') return 0.54;
    if (stage === 'yes_future_product' || stage === 'no_future_product') return 0.76;
    if (stage === 'us_credit') return 0.95;
    return 0.95;
  })();

  const advanceWithDelay = (choiceId: string, callback: () => void) => {
    if (pickedId) return;
    setPickedId(choiceId);
    window.setTimeout(() => {
      setPickedId(null);
      callback();
    }, 260);
  };

  const handleSelectKnowsBrand = (opt: OptionItem & { value: boolean }) => {
    advanceWithDelay(opt.id, () => {
      setKnowsBrand(opt.value);
      setIsClient(opt.value ? null : false);
      setRating(null);
      setHealthyInterest(null);
      setSelectedProduct(null);
      setStage(opt.value ? 'yes_is_client' : 'no_golden_ticket');
    });
  };

  const handleSelectIsClient = (opt: OptionItem & { value: boolean }) => {
    advanceWithDelay(opt.id, () => {
      setIsClient(opt.value);
      setRating(null);
      setHealthyInterest(null);
      setSelectedProduct(null);
      // Only actual Royal Prestige clients rate current products; non-clients branch to the healthy-eating filter
      setStage(opt.value ? 'yes_rating' : 'no_healthy_eating');
    });
  };

  const handleSelectRating = (scoreVal: number) => {
    advanceWithDelay(`rate-${scoreVal}`, () => {
      setRating(scoreVal);
      setSelectedProduct(null);
      setStage('yes_future_product');
    });
  };

  const handleSelectYesFutureProduct = (productOpt: OptionItem) => {
    advanceWithDelay(productOpt.id, () => {
      setSelectedProduct(productOpt);
      setStage('us_credit');
    });
  };

  const handleSelectHealthyEating = (opt: OptionItem) => {
    advanceWithDelay(opt.id, () => {
      setHealthyInterest(opt);
      setSelectedProduct(null);
      setStage('no_future_product');
    });
  };

  const handleSelectGoldenTicket = (opt: OptionItem & { action: 'use' | 'cede' }) => {
    advanceWithDelay(opt.id, () => {
      if (opt.action === 'use') {
        setSelectedProduct(null);
        setStage('no_healthy_eating');
        return;
      }

      const score = 55;
      const tier: CreditTier = score >= 75 ? 'alto' : score >= 45 ? 'medio' : 'basico';
      const payload: LeadQualification = {
        creditProfile: 'No conocía Royal Prestige · Cede Boleto Dorado',
        housingStatus: 'Prefiere ceder el Boleto Dorado a un amigo/familiar',
        investmentPriority: 'Compartir QR · Programa de Anfitrión',
        score,
        tier,
        knowsBrand: false,
        isClient: false,
        productRating: null,
        cedeGoldenTicket: true,
      };
      onComplete(payload);
    });
  };

  const handleSelectNoFutureProduct = (productOpt: OptionItem) => {
    advanceWithDelay(productOpt.id, () => {
      setSelectedProduct(productOpt);
      setStage('us_credit');
    });
  };

  const handleSelectUsCredit = (opt: UsCreditOption) => {
    advanceWithDelay(opt.id, () => {
      const knows = Boolean(knowsBrand);
      const client = Boolean(knows && isClient);
      const productLabel = selectedProduct?.label || 'Productos Royal Prestige';
      const productPoints = selectedProduct?.points ?? 25;

      let engagementRatio = 0.5;
      if (client) {
        const rated = rating ?? 8;
        const ratingPoints = rated >= 8 ? 35 : rated >= 5 ? 20 : 10;
        const rawEngagement = 20 + 35 + ratingPoints + productPoints;
        engagementRatio = Math.min(1, Math.max(0, (rawEngagement - 80) / 40));
      } else {
        const basePoints = knows ? 25 : 15;
        const secondaryPts = healthyInterest?.points ?? 25;
        const rawEngagement = basePoints + secondaryPts + productPoints;
        engagementRatio = Math.min(1, Math.max(0, (rawEngagement - 65) / 40));
      }

      const score = Math.min(
        opt.maxScore,
        Math.max(
          opt.minScore,
          Math.round(opt.minScore + engagementRatio * (opt.maxScore - opt.minScore))
        )
      );
      const tier: CreditTier = opt.tier;

      if (client) {
        const rated = rating ?? 8;
        const payload: LeadQualification = {
          creditProfile: 'Conoce Royal Prestige · Es cliente',
          housingStatus: `Calificación productos: ${rated}/10`,
          investmentPriority: productLabel,
          score,
          tier,
          knowsBrand: true,
          isClient: true,
          productRating: rated,
          desiredProduct: productLabel,
          usCreditEstablished: opt.value,
          usCreditLabel: opt.shortLabel,
          cedeGoldenTicket: false,
        };
        onComplete(payload);
        return;
      }

      const payload: LeadQualification = {
        creditProfile: knows
          ? 'Conoce Royal Prestige · No es cliente'
          : 'No conocía Royal Prestige · Usaría Boleto Dorado',
        housingStatus: healthyInterest?.label || 'Interés en catálogo con Boleto Dorado',
        investmentPriority: productLabel,
        score,
        tier,
        knowsBrand: knows,
        isClient: false,
        productRating: null,
        ...(healthyInterest?.label ? { healthyEatingInterest: healthyInterest.label } : {}),
        desiredProduct: productLabel,
        usCreditEstablished: opt.value,
        usCreditLabel: opt.shortLabel,
        cedeGoldenTicket: false,
      };
      onComplete(payload);
    });
  };

  const handleBack = () => {
    if (pickedId) return;
    if (stage === 'yes_is_client' || stage === 'no_golden_ticket') {
      setStage('knows_brand');
    } else if (stage === 'no_healthy_eating') {
      setStage(knowsBrand ? 'yes_is_client' : 'no_golden_ticket');
    } else if (stage === 'yes_rating') {
      setStage('yes_is_client');
    } else if (stage === 'yes_future_product') {
      setStage('yes_rating');
    } else if (stage === 'no_future_product') {
      setStage('no_healthy_eating');
    } else if (stage === 'us_credit') {
      setStage(knowsBrand && isClient ? 'yes_future_product' : 'no_future_product');
    }
  };

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.97 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-[560px] mx-auto"
    >
      <div className="relative overflow-hidden rounded-[26px] sm:rounded-[32px] bg-[#FFFDF9]/78 backdrop-blur-xl border border-[#DFC9AB]/80 autumn-card-shadow px-4 py-5 sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute inset-2 sm:inset-2.5 rounded-[20px] sm:rounded-[24px] border border-[#E6D5BF]/60" />
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#4B644A]" />

        {/* Clean minimal progress line */}
        <div className="relative z-10 h-1.5 w-full overflow-hidden rounded-full bg-[#E8DAC5] mb-5 sm:mb-6">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#8C3318] via-[#C88A2B] to-[#E5AE4E]"
            animate={{ width: `${Math.round(progressRatio * 100)}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        <AnimatePresence mode="wait">
          {stage === 'knows_brand' && (
            <motion.div
              key="stage-knows"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <p className="text-xs font-medium text-[#8C4A19] mb-1">Hola, {firstName}</p>
              <h2 className="font-serif text-[21px] sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                ¿Conoce la marca Royal Prestige?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Selecciona una respuesta para continuar hacia tu obsequio.
              </p>

              <div className="mt-4 sm:mt-5 space-y-2.5 sm:space-y-3">
                {KNOWS_OPTIONS.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectKnowsBrand(opt)}
                      className={`min-h-[52px] w-full rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#8C3318] bg-[#FAF0E0] ring-2 ring-[#C88A2B]/35'
                          : 'border-[#DFCBB3] bg-[#FCF8F2]/90 hover:border-[#C88A2B] hover:bg-white'
                      }`}
                    >
                      <div>
                        <p className="text-base font-semibold text-[#22150E]">{opt.label}</p>
                        {opt.sublabel && <p className="mt-1 text-xs text-[#6E5341]">{opt.sublabel}</p>}
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-[#8C3318] bg-[#8C3318] text-white' : 'border-[#C6A787] bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {stage === 'yes_is_client' && (
            <motion.div
              key="stage-yes-client"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <h2 className="font-serif text-[21px] sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                ¿Usted es cliente de la marca Royal Prestige?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Indícanos si ya cuentas con alguno de nuestros sistemas en tu hogar.
              </p>

              <div className="mt-4 sm:mt-5 space-y-2.5 sm:space-y-3">
                {IS_CLIENT_OPTIONS.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectIsClient(opt)}
                      className={`min-h-[52px] w-full rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#8C3318] bg-[#FAF0E0] ring-2 ring-[#C88A2B]/35'
                          : 'border-[#DFCBB3] bg-[#FCF8F2]/90 hover:border-[#C88A2B] hover:bg-white'
                      }`}
                    >
                      <div>
                        <p className="text-base font-semibold text-[#22150E]">{opt.label}</p>
                        {opt.sublabel && <p className="mt-1 text-xs text-[#6E5341]">{opt.sublabel}</p>}
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-[#8C3318] bg-[#8C3318] text-white' : 'border-[#C6A787] bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {stage === 'yes_rating' && (
            <motion.div
              key="stage-yes-rating"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <h2 className="font-serif text-[21px] sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                Del 1 al 10, ¿cuánto califica los productos de Royal Prestige?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Toca el número que represente mejor tu valoración de la marca.
              </p>

              <div className="mt-5 sm:mt-6 grid grid-cols-5 gap-2 sm:gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const selected = pickedId === `rate-${num}` || rating === num;
                  return (
                    <motion.button
                      key={num}
                      type="button"
                      whileHover={{ y: -2, scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleSelectRating(num)}
                      className={`min-h-[46px] rounded-2xl border py-2.5 sm:py-3.5 font-serif text-base sm:text-lg font-bold transition-all cursor-pointer ${
                        selected
                          ? 'border-[#8C3318] bg-[#22150E] text-[#F4CA73] shadow-md'
                          : 'border-[#DFCBB3] bg-[#FCF8F2]/90 text-[#22150E] hover:border-[#C88A2B] hover:bg-white'
                      }`}
                    >
                      {num}
                    </motion.button>
                  );
                })}
              </div>
              <div className="mt-2.5 flex justify-between text-[11px] font-medium text-[#7B5D4A] px-1">
                <span>1 · Por mejorar</span>
                <span>10 · Excelente calidad</span>
              </div>
            </motion.div>
          )}

          {stage === 'yes_future_product' && (
            <motion.div
              key="stage-yes-product"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <h2 className="font-serif text-[21px] sm:text-[25px] font-semibold text-[#22150E] leading-snug">
                En un futuro, ¿qué producto le gustaría tener en su casa?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Elige la línea que más te gustaría incorporar en tu hogar.
              </p>

              <div className="mt-4 sm:mt-5 space-y-2.5">
                {FUTURE_PRODUCTS_YES.map((opt) => {
                  const selected = pickedId === opt.id || selectedProduct?.id === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectYesFutureProduct(opt)}
                      className={`min-h-[48px] w-full rounded-2xl border px-3.5 sm:px-4 py-3 sm:py-3.5 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#8C3318] bg-[#FAF0E0] ring-2 ring-[#C88A2B]/35'
                          : 'border-[#DFCBB3] bg-[#FCF8F2]/90 hover:border-[#C88A2B] hover:bg-white'
                      }`}
                    >
                      <span className="text-sm sm:text-[15px] font-semibold text-[#22150E]">{opt.label}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-[#8C3318] bg-[#8C3318] text-white' : 'border-[#C6A787] bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {stage === 'no_healthy_eating' && (
            <motion.div
              key="stage-no-healthy"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <h2 className="font-serif text-[21px] sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                ¿Está buscando comer de manera más saludable?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Cuéntanos cuál es tu enfoque actual para cuidar la nutrición en casa.
              </p>

              <div className="mt-4 sm:mt-5 space-y-2.5 sm:space-y-3">
                {HEALTHY_EATING_OPTIONS.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectHealthyEating(opt)}
                      className={`min-h-[52px] w-full rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#8C3318] bg-[#FAF0E0] ring-2 ring-[#C88A2B]/35'
                          : 'border-[#DFCBB3] bg-[#FCF8F2]/90 hover:border-[#C88A2B] hover:bg-white'
                      }`}
                    >
                      <span className="text-sm sm:text-[15px] font-semibold text-[#22150E]">{opt.label}</span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-[#8C3318] bg-[#8C3318] text-white' : 'border-[#C6A787] bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {stage === 'no_golden_ticket' && (
            <motion.div
              key="stage-no-golden-ticket"
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="relative z-10"
            >
              {/* Gleaming Metallic Mini-Ticket VIP Header Badge */}
              <motion.div
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 22 }}
                className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-[#E5AE4E] bg-gradient-to-r from-[#2A150A] via-[#593112] to-[#2A150A] px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#FEF08A] shadow-[0_10px_24px_-10px_rgba(140,74,25,0.65)] mb-3"
              >
                {!prefersReduced && (
                  <motion.span
                    aria-hidden="true"
                    animate={{ x: ['-140%', '260%'] }}
                    transition={{ duration: 2.1, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  />
                )}
                <Sparkles className="relative h-3.5 w-3.5 text-[#FDE047]" />
                <span className="relative">Boleto Dorado VIP · Beneficio Exclusivo</span>
              </motion.div>

              <h2 className="font-serif text-[19px] sm:text-[24px] font-semibold text-[#22150E] leading-snug">
                Si en un futuro usted tuviera la oportunidad de utilizar el bono especial: nuestro{' '}
                <span className="gold-foil-text font-bold">Boleto Dorado</span>, ¿lo utilizaría con
                algún producto de nuestro catálogo exclusivo o prefiere cederlo a un amigo o
                familiar?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Elige cómo deseas activar tu Boleto Dorado hoy.
              </p>

              <div className="mt-4 sm:mt-5 space-y-3">
                {GOLDEN_TICKET_OPTIONS.map((opt, idx) => {
                  const selected = pickedId === opt.id;
                  const isCede = opt.action === 'cede';
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 320,
                        damping: 24,
                        delay: prefersReduced ? 0 : idx * 0.08,
                      }}
                      whileHover={prefersReduced ? undefined : { y: -2.5, scale: 1.01 }}
                      whileTap={prefersReduced ? undefined : { scale: 0.975 }}
                      onClick={() => handleSelectGoldenTicket(opt)}
                      className={`group relative overflow-hidden min-h-[64px] w-full rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#B8791F] bg-gradient-to-r from-[#FFF6E0] via-[#FAF0DC] to-[#FFF6E0] ring-2 ring-[#E5AE4E]/55 shadow-[0_12px_28px_-10px_rgba(200,138,43,0.45)]'
                          : isCede
                            ? 'border-[#D8A54B]/80 bg-gradient-to-r from-[#2A150B] via-[#3A1E10] to-[#231108] text-[#FFFDF9] shadow-[0_14px_30px_-12px_rgba(34,21,14,0.65)] hover:border-[#FEF08A]'
                            : 'border-[#DFCBB3] bg-[#FCF8F2]/95 hover:border-[#C88A2B] hover:bg-white hover:shadow-[0_10px_24px_-12px_rgba(200,138,43,0.35)]'
                      }`}
                    >
                      {isCede && !prefersReduced && (
                        <motion.span
                          aria-hidden="true"
                          animate={{ x: ['-140%', '260%'] }}
                          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.8, ease: 'easeInOut' }}
                          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-[#FEF08A]/18 to-transparent"
                        />
                      )}
                      <div className="relative flex items-start gap-3 min-w-0">
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                            isCede && !selected
                              ? 'border-[#F4CA73]/50 bg-[#E5AE4E]/15 text-[#FEF08A]'
                              : 'border-[#E5C17B] bg-[#FFF4DC] text-[#8C4A19]'
                          }`}
                        >
                          {isCede ? <Share2 className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] mb-1 ${
                              isCede && !selected
                                ? 'bg-[#E5AE4E]/20 border border-[#FDE68A]/45 text-[#FEF08A]'
                                : 'bg-[#FAF0E0] border border-[#E5C17B]/75 text-[#8C4A19]'
                            }`}
                          >
                            {opt.badge}
                          </span>
                          <p
                            className={`text-sm sm:text-[15px] font-semibold leading-snug ${
                              isCede && !selected ? 'text-[#FFFDF9]' : 'text-[#22150E]'
                            }`}
                          >
                            {opt.label}
                          </p>
                          {opt.sublabel && (
                            <p
                              className={`mt-1 text-xs leading-relaxed ${
                                isCede && !selected ? 'text-[#E3CEB6]' : 'text-[#6E5341]'
                              }`}
                            >
                              {opt.sublabel}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? 'border-[#8C3318] bg-[#8C3318] text-white'
                            : isCede
                              ? 'border-[#F4CA73]/60 bg-[#1B0E07]/70'
                              : 'border-[#C6A787] bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {stage === 'no_future_product' && (
            <motion.div
              key="stage-no-product"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <h2 className="font-serif text-[19px] sm:text-[24px] font-semibold text-[#22150E] leading-snug">
                Si en un futuro fuera a comprar un producto que le ayudaría a mejorar la salud de su familia, ¿qué producto le gustaría tener en su casa?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Selecciona la opción que mejor se adapte a tu hogar.
              </p>

              <div className="mt-4 sm:mt-5 space-y-2.5">
                {FUTURE_PRODUCTS_NO.map((opt) => {
                  const selected = pickedId === opt.id || selectedProduct?.id === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectNoFutureProduct(opt)}
                      className={`min-h-[48px] w-full rounded-2xl border px-3.5 sm:px-4 py-3 sm:py-3.5 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#8C3318] bg-[#FAF0E0] ring-2 ring-[#C88A2B]/35'
                          : 'border-[#DFCBB3] bg-[#FCF8F2]/90 hover:border-[#C88A2B] hover:bg-white'
                      }`}
                    >
                      <span className="text-sm sm:text-[15px] font-semibold text-[#22150E]">{opt.label}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-[#8C3318] bg-[#8C3318] text-white' : 'border-[#C6A787] bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {stage === 'us_credit' && (
            <motion.div
              key="stage-us-credit"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <span className="inline-flex items-center rounded-full border border-[#E5C17B] bg-[#FFF4DC] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8C4A19] mb-2">
                Último paso · Para reclamar tu obsequio
              </span>
              <h2 className="font-serif text-[21px] sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                ¿Has establecido historial de crédito en Estados Unidos?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#5C4332]">
                Esta información es confidencial y nos ayuda a personalizar los beneficios disponibles para ti.
              </p>

              <div className="mt-4 sm:mt-5 space-y-2.5 sm:space-y-3">
                {US_CREDIT_OPTIONS.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectUsCredit(opt)}
                      className={`min-h-[56px] w-full rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#8C3318] bg-[#FAF0E0] ring-2 ring-[#C88A2B]/35'
                          : 'border-[#DFCBB3] bg-[#FCF8F2]/90 hover:border-[#C88A2B] hover:bg-white'
                      }`}
                    >
                      <div>
                        <p className="text-sm sm:text-[15px] font-semibold text-[#22150E]">{opt.label}</p>
                        {opt.sublabel && <p className="mt-1 text-xs text-[#6E5341]">{opt.sublabel}</p>}
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-[#8C3318] bg-[#8C3318] text-white' : 'border-[#C6A787] bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {stage !== 'knows_brand' && (
          <div className="relative z-10 mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-[#E8DAC5] flex justify-start">
            <button
              type="button"
              disabled={Boolean(pickedId)}
              onClick={handleBack}
              className="min-h-[44px] -ml-2.5 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#5C4332] hover:text-[#22150E] hover:bg-[#FAF3E8]/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Pregunta anterior
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
