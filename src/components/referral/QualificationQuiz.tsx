import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
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
  | 'no_healthy_eating'
  | 'no_future_product';

interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
  points: number;
}

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
  const [stage, setStage] = useState<QuizStage>('knows_brand');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const [knowsBrand, setKnowsBrand] = useState<boolean | null>(null);
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [healthyInterest, setHealthyInterest] = useState<OptionItem | null>(null);

  const firstName = leadName.trim().split(/\s+/)[0] || 'Invitado';

  const progressRatio = (() => {
    if (stage === 'knows_brand') return 0.2;
    if (knowsBrand === true) {
      if (stage === 'yes_is_client') return 0.45;
      if (stage === 'yes_rating') return 0.7;
      return 0.92;
    }
    if (stage === 'no_healthy_eating') return 0.55;
    return 0.9;
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
      setIsClient(null);
      setRating(null);
      setHealthyInterest(null);
      setStage(opt.value ? 'yes_is_client' : 'no_healthy_eating');
    });
  };

  const handleSelectIsClient = (opt: OptionItem & { value: boolean }) => {
    advanceWithDelay(opt.id, () => {
      setIsClient(opt.value);
      setStage('yes_rating');
    });
  };

  const handleSelectRating = (scoreVal: number) => {
    advanceWithDelay(`rate-${scoreVal}`, () => {
      setRating(scoreVal);
      setStage('yes_future_product');
    });
  };

  const handleFinishYesBranch = (productOpt: OptionItem) => {
    advanceWithDelay(productOpt.id, () => {
      const baseKnownPoints = 20;
      const clientPoints = isClient ? 35 : 25;
      const rated = rating ?? 8;
      const ratingPoints = rated >= 8 ? 35 : rated >= 5 ? 20 : 10;
      const rawTotal = baseKnownPoints + clientPoints + ratingPoints + productOpt.points;
      const score = Math.min(100, Math.round((rawTotal / 120) * 100));
      const tier: CreditTier = score >= 75 ? 'alto' : score >= 45 ? 'medio' : 'basico';

      onComplete({
        creditProfile: isClient
          ? 'Conoce Royal Prestige · Es cliente'
          : 'Conoce Royal Prestige · No es cliente',
        housingStatus: `Calificación productos: ${rated}/10`,
        investmentPriority: productOpt.label,
        score,
        tier,
        knowsBrand: true,
        isClient: Boolean(isClient),
        productRating: rated,
        desiredProduct: productOpt.label,
      });
    });
  };

  const handleSelectHealthyEating = (opt: OptionItem) => {
    advanceWithDelay(opt.id, () => {
      setHealthyInterest(opt);
      setStage('no_future_product');
    });
  };

  const handleFinishNoBranch = (productOpt: OptionItem) => {
    advanceWithDelay(productOpt.id, () => {
      const basePoints = 15;
      const healthyPts = healthyInterest?.points ?? 25;
      const score = Math.min(100, basePoints + healthyPts + productOpt.points);
      const tier: CreditTier = score >= 75 ? 'alto' : score >= 45 ? 'medio' : 'basico';

      onComplete({
        creditProfile: 'No conocía Royal Prestige',
        housingStatus: healthyInterest?.label || 'Interés en alimentación saludable',
        investmentPriority: productOpt.label,
        score,
        tier,
        knowsBrand: false,
        isClient: false,
        productRating: null,
        healthyEatingInterest: healthyInterest?.label,
        desiredProduct: productOpt.label,
      });
    });
  };

  const handleBack = () => {
    if (pickedId) return;
    if (stage === 'yes_is_client' || stage === 'no_healthy_eating') {
      setStage('knows_brand');
    } else if (stage === 'yes_rating') {
      setStage('yes_is_client');
    } else if (stage === 'yes_future_product') {
      setStage('yes_rating');
    } else if (stage === 'no_future_product') {
      setStage('no_healthy_eating');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.97 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-[560px] mx-auto"
    >
      <div className="relative overflow-hidden rounded-[32px] bg-[#FFFDF9]/78 backdrop-blur-xl border border-[#DFC9AB]/80 autumn-card-shadow px-6 py-7 sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute inset-2.5 rounded-[24px] border border-[#E6D5BF]/60" />
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#4B644A]" />

        {/* Clean minimal progress line */}
        <div className="relative z-10 h-1.5 w-full overflow-hidden rounded-full bg-[#E8DAC5] mb-6">
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
              <h2 className="font-serif text-2xl sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                ¿Conoce la marca Royal Prestige?
              </h2>
              <p className="mt-1.5 text-sm text-[#5C4332]">
                Selecciona una respuesta para continuar hacia tu obsequio.
              </p>

              <div className="mt-5 space-y-3">
                {KNOWS_OPTIONS.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectKnowsBrand(opt)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
              <h2 className="font-serif text-2xl sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                ¿Usted es cliente de la marca Royal Prestige?
              </h2>
              <p className="mt-1.5 text-sm text-[#5C4332]">
                Indícanos si ya cuentas con alguno de nuestros sistemas en tu hogar.
              </p>

              <div className="mt-5 space-y-3">
                {IS_CLIENT_OPTIONS.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectIsClient(opt)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
              <h2 className="font-serif text-2xl sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                Del 1 al 10, ¿cuánto califica los productos de Royal Prestige?
              </h2>
              <p className="mt-1.5 text-sm text-[#5C4332]">
                Toca el número que represente mejor tu valoración de la marca.
              </p>

              <div className="mt-6 grid grid-cols-5 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const selected = pickedId === `rate-${num}` || rating === num;
                  return (
                    <motion.button
                      key={num}
                      type="button"
                      whileHover={{ y: -2, scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleSelectRating(num)}
                      className={`rounded-2xl border py-3.5 font-serif text-lg font-bold transition-all cursor-pointer ${
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
              <h2 className="font-serif text-2xl sm:text-[25px] font-semibold text-[#22150E] leading-snug">
                En un futuro, ¿qué producto le gustaría tener en su casa?
              </h2>
              <p className="mt-1.5 text-sm text-[#5C4332]">
                Elige la línea que más te gustaría incorporar en tu hogar.
              </p>

              <div className="mt-5 space-y-2.5">
                {FUTURE_PRODUCTS_YES.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleFinishYesBranch(opt)}
                      className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
              <h2 className="font-serif text-2xl sm:text-[26px] font-semibold text-[#22150E] leading-snug">
                ¿Está buscando comer de manera más saludable?
              </h2>
              <p className="mt-1.5 text-sm text-[#5C4332]">
                Cuéntanos cuál es tu enfoque actual para cuidar la nutrición en casa.
              </p>

              <div className="mt-5 space-y-3">
                {HEALTHY_EATING_OPTIONS.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectHealthyEating(opt)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
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

          {stage === 'no_future_product' && (
            <motion.div
              key="stage-no-product"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
              className="relative z-10"
            >
              <h2 className="font-serif text-xl sm:text-[24px] font-semibold text-[#22150E] leading-snug">
                Si en un futuro fuera a comprar un producto que le ayudaría a mejorar la salud de su familia, ¿qué producto le gustaría tener en su casa?
              </h2>
              <p className="mt-1.5 text-sm text-[#5C4332]">
                Selecciona la opción que mejor se adapte a tu hogar.
              </p>

              <div className="mt-5 space-y-2.5">
                {FUTURE_PRODUCTS_NO.map((opt) => {
                  const selected = pickedId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleFinishNoBranch(opt)}
                      className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
        </AnimatePresence>

        {stage !== 'knows_brand' && (
          <div className="relative z-10 mt-6 pt-4 border-t border-[#E8DAC5] flex justify-start">
            <button
              type="button"
              disabled={Boolean(pickedId)}
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C4332] hover:text-[#22150E] cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Pregunta anterior
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
