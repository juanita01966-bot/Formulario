import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, Copy, Crown, PauseCircle, Sparkles, UserCheck } from 'lucide-react';
import type { AppState, GiftItem, Lead, LeadQualification } from '../types/app';
import {
  DEFAULT_PROCESS_CONTROLS,
  createLead,
  recordReferralVisit,
  resolveReferralCode,
  updateLead,
} from '../services/storeClient';
import { setClientGuardEnabled } from '../utils/clientGuard';
import {
  REFERRAL_LOCAL_KEY,
  captureReferralCode,
  extractReferralCodeFromLocation,
  getOrCreateVisitorId,
  getStoredReferralCode,
  hasPingedReferralVisitThisSession,
  markReferralVisitPinged,
} from '../utils/referralTracking';
import { AutumnAtmosphere } from '../components/autumn/AutumnAtmosphere';
import { LeadFormCard, type ActiveReferralInfo } from '../components/referral/LeadFormCard';
import { QualificationQuiz } from '../components/referral/QualificationQuiz';
import { CustomLoader } from '../components/referral/CustomLoader';
import { MysteryCardsMenu } from '../components/referral/MysteryCardsMenu';
import { GiftRevealStage } from '../components/referral/GiftRevealStage';
import { GoldenTicketBooklet } from '../components/referral/GoldenTicketBooklet';
import { WelcomeSceneGate } from '../components/referral/WelcomeSceneGate';

type FlowStep = 'form' | 'quiz' | 'loading' | 'cards' | 'reveal' | 'share_booklet' | 'confirmed';

function cryptoRandomIntRange(min: number, maxExclusive: number): number {
  const span = maxExclusive - min;
  if (span <= 1) return min;
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const range = 0x100000000;
    const limit = range - (range % span);
    const buf = new Uint32Array(1);
    let value = 0;
    do {
      cryptoObj.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return min + (value % span);
  }
  return min + Math.floor(Math.random() * span);
}

interface ReferralFlowProps {
  appState: AppState;
  onStateChange: (next: AppState) => void;
}

export const ReferralFlow: React.FC<ReferralFlowProps> = ({ appState, onStateChange }) => {
  const [step, setStep] = useState<FlowStep>('form');
  const [playRound, setPlayRound] = useState(0);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [revealedGift, setRevealedGift] = useState<GiftItem | null>(null);
  const [capturedReferralCode, setCapturedReferralCode] = useState<string | null>(null);
  const [activeReferralPartner, setActiveReferralPartner] = useState<ActiveReferralInfo | null>(null);
  const [copiedClaimCode, setCopiedClaimCode] = useState(false);
  const lastClaimCodeRef = useRef<string | null>(null);
  const syncSeqRef = useRef(0);
  const isMountedRef = useRef(true);

  const controls = useMemo(
    () => ({
      ...DEFAULT_PROCESS_CONTROLS,
      ...(appState.settings.processControls ?? {}),
    }),
    [appState.settings.processControls]
  );

  useEffect(() => {
    setClientGuardEnabled(controls.clientGuardEnabled);
  }, [controls.clientGuardEnabled]);

  const activeGifts = appState.gifts.filter((g) => g.active);
  const safeActiveGifts = activeGifts.length > 0 ? activeGifts : appState.gifts;

  const syncReferralAttribution = useCallback(async (options?: { skipVisitPing?: boolean }) => {
    const seq = ++syncSeqRef.current;
    const code = captureReferralCode();
    if (!isMountedRef.current || seq !== syncSeqRef.current) return;
    setCapturedReferralCode(code);

    if (!code) {
      setActiveReferralPartner(null);
      return;
    }

    // Clear stale banner immediately if the active referral code switched (e.g. QR-UNO -> QR-DOS)
    setActiveReferralPartner((prev) => (prev && prev.code === code ? prev : null));

    try {
      if (!options?.skipVisitPing && !hasPingedReferralVisitThisSession(code)) {
        markReferralVisitPinged(code);
        const visitorId = getOrCreateVisitorId();
        const visitRes = await recordReferralVisit(code, visitorId);
        if (!isMountedRef.current || seq !== syncSeqRef.current) return;

        if (visitRes.partner && visitRes.partner.active) {
          setActiveReferralPartner({
            code: visitRes.partner.code,
            name: visitRes.partner.name,
            avatarUrl: visitRes.partner.avatarUrl ?? null,
          });
          return;
        }
      }

      const resolved = await resolveReferralCode(code);
      if (!isMountedRef.current || seq !== syncSeqRef.current) return;
      if (resolved && resolved.active) {
        setActiveReferralPartner({
          code: resolved.code,
          name: resolved.name,
          avatarUrl: resolved.avatarUrl ?? null,
        });
      } else {
        setActiveReferralPartner(null);
      }
    } catch {
      if (isMountedRef.current && seq === syncSeqRef.current) {
        setActiveReferralPartner(null);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void syncReferralAttribution();

    const handleUrlChange = () => {
      void syncReferralAttribution();
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== REFERRAL_LOCAL_KEY) return;
      // Only adopt cross-tab attribution when this tab's own URL doesn't pin an explicit ?ref=
      if (!extractReferralCodeFromLocation()) {
        void syncReferralAttribution({ skipVisitPing: true });
      }
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMountedRef.current = false;
      syncSeqRef.current += 1;
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [syncReferralAttribution]);

  const generateFreshClaimCode = useCallback((): string => {
    let candidate = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      candidate = `OTN-${cryptoRandomIntRange(1000, 10000)}`;
      if (candidate !== lastClaimCodeRef.current) break;
    }
    lastClaimCodeRef.current = candidate;
    return candidate;
  }, []);

  const handleFormSubmit = async (formData: {
    name: string;
    phone: string;
    address: string;
    acceptedTerms: boolean;
  }) => {
    // Re-capture at submit time so any fresh ?ref= in URL/storage always wins over stale state
    const latestCode = captureReferralCode();
    if (latestCode !== capturedReferralCode) {
      setCapturedReferralCode(latestCode);
    }
    const referralCode =
      latestCode ||
      capturedReferralCode ||
      activeReferralPartner?.code ||
      getStoredReferralCode() ||
      undefined;
    const res = await createLead({
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
      acceptedTerms: formData.acceptedTerms,
      claimCode: generateFreshClaimCode(),
      visitorId: getOrCreateVisitorId(),
      ...(referralCode ? { referralCode } : {}),
    });
    lastClaimCodeRef.current = res.lead.claimCode;
    setCurrentLead(res.lead);
    onStateChange(res.state);
    if (controls.qualificationQuizEnabled) {
      setStep('quiz');
    } else if (controls.giftRevealEnabled) {
      setStep('loading');
    } else {
      setStep('confirmed');
    }
  };

  const handleQuizComplete = async (qualification: LeadQualification) => {
    const wantsBooklet = Boolean(qualification.cedeGoldenTicket);
    if (wantsBooklet) {
      setStep('share_booklet');
    } else if (controls.giftRevealEnabled) {
      setStep('loading');
    } else {
      setStep('confirmed');
    }
    if (currentLead) {
      try {
        const res = await updateLead(currentLead.id, { qualification });
        setCurrentLead(res.lead);
        onStateChange(res.state);
      } catch {
        // Non-blocking fallback
      }
    }
  };

  const handleLoaderComplete = useCallback(() => {
    setStep('cards');
  }, []);

  const handleSelectMysteryCard = async (gift: GiftItem) => {
    setRevealedGift(gift);
    setStep('reveal');
    if (currentLead) {
      try {
        const res = await updateLead(currentLead.id, {
          giftId: gift.id,
          giftName: gift.name,
          giftVisualKey: gift.visualKey,
        });
        setCurrentLead(res.lead);
        onStateChange(res.state);
      } catch {
        // Non-blocking: UI already shows the gift and lead was created on submit
      }
    }
  };

  const handleResetFlow = () => {
    setCurrentLead(null);
    setRevealedGift(null);
    setCopiedClaimCode(false);
    setPlayRound((prev) => prev + 1);
    setStep('form');
    void syncReferralAttribution();
  };

  const handleClaimOwnGiftFromBooklet = () => {
    setStep(controls.giftRevealEnabled ? 'loading' : 'confirmed');
  };

  const handleCopyClaimCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedClaimCode(true);
      window.setTimeout(() => setCopiedClaimCode(false), 2400);
    } catch {
      // Clipboard API unavailable
    }
  };

  const effectiveShareReferralCode =
    activeReferralPartner?.code || capturedReferralCode || currentLead?.referralCode || null;
  const effectiveShareReferrerName =
    activeReferralPartner?.name || currentLead?.referrerName || null;
  const effectiveShareReferrerAvatarUrl = activeReferralPartner?.avatarUrl || null;

  if (!controls.publicFormEnabled) {
    return (
      <div className="relative min-h-[100dvh] w-full overflow-x-clip flex flex-col items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
        <AutumnAtmosphere variant="public" />

        <main className="relative z-10 w-full max-w-[520px]">
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[28px] sm:rounded-[34px] border border-[#D4A437]/45 bg-[#FFFDF9]/92 p-6 sm:p-9 text-center backdrop-blur-xl autumn-card-shadow"
          >
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{
                background: 'linear-gradient(90deg, #5A3B08 0%, #B3801D 35%, #F5D67B 68%, #C8962E 100%)',
              }}
            />
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4A437]/45 bg-gradient-to-br from-[#3D2806] via-[#8A5E11] to-[#C8962E] text-[#FFF6D1] shadow-[0_14px_34px_-10px_rgba(154,107,22,0.55)]">
              <PauseCircle className="h-8 w-8" />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8962E]/35 bg-[#FDF6E2] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5610]">
              <Crown className="h-3.5 w-3.5" />
              {appState.settings.brandSubtitle || 'The Ciprian Company'}
            </span>

            <h1 className="mt-4 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#22150E] leading-tight">
              {controls.publicFormDisabledTitle || DEFAULT_PROCESS_CONTROLS.publicFormDisabledTitle}
            </h1>

            <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-[#594133]">
              {controls.publicFormDisabledMessage || DEFAULT_PROCESS_CONTROLS.publicFormDisabledMessage}
            </p>

            {appState.settings.advisorName && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-[#E6D5BF] bg-[#FAF3E8]/85 px-4 py-2.5 text-xs font-semibold text-[#594133]">
                <Sparkles className="h-3.5 w-3.5 text-[#B3801D]" />
                <span>Anfitrión oficial: {appState.settings.advisorName}</span>
              </div>
            )}
          </motion.section>
        </main>

        <footer className="relative z-10 mt-6 sm:mt-8 px-3 text-center text-[11px] text-[#8B6F5B]">
          The Ciprian Company · Todos los derechos reservados
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-clip flex flex-col items-center justify-center px-3 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10 sm:pb-12">
      <AutumnAtmosphere variant="public" />

      <main className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          {step === 'form' && (
            <LeadFormCard
              key={`step-form-${playRound}`}
              settings={appState.settings}
              referralPartner={activeReferralPartner}
              referralCode={effectiveShareReferralCode}
              onSubmit={handleFormSubmit}
            />
          )}

          {step === 'quiz' && currentLead && (
            <QualificationQuiz
              key={`step-quiz-${playRound}`}
              leadName={currentLead.name}
              onComplete={handleQuizComplete}
            />
          )}

          {step === 'loading' && currentLead && (
            <CustomLoader
              key={`step-loading-${playRound}`}
              leadName={currentLead.name}
              onComplete={handleLoaderComplete}
            />
          )}

          {step === 'cards' && currentLead && (
            <MysteryCardsMenu
              key={`step-cards-${playRound}`}
              leadName={currentLead.name}
              activeGifts={safeActiveGifts}
              giftTheme={appState.settings.giftTheme}
              customBoxColor={appState.settings.customBoxColor}
              randomizeGifts={appState.settings.randomizeGifts ?? true}
              onSelectGift={handleSelectMysteryCard}
            />
          )}

          {step === 'reveal' && currentLead && revealedGift && (
            <GiftRevealStage
              key={`step-reveal-${playRound}`}
              leadName={currentLead.name}
              leadPhone={currentLead.phone}
              leadAddress={currentLead.address}
              gift={revealedGift}
              claimCode={currentLead.claimCode}
              giftTheme={appState.settings.giftTheme}
              customBoxColor={appState.settings.customBoxColor}
              showcaseStyle={appState.settings.showcaseStyle}
              referralCode={effectiveShareReferralCode}
              referrerName={effectiveShareReferrerName}
              referrerAvatarUrl={effectiveShareReferrerAvatarUrl}
              onStartAnother={handleResetFlow}
            />
          )}

          {step === 'share_booklet' && currentLead && (
            <GoldenTicketBooklet
              key={`step-booklet-${playRound}`}
              leadName={currentLead.name}
              referralCode={effectiveShareReferralCode}
              referrerName={effectiveShareReferrerName}
              referrerAvatarUrl={effectiveShareReferrerAvatarUrl}
              onClaimOwnGift={handleClaimOwnGiftFromBooklet}
              onStartAnother={handleResetFlow}
            />
          )}

          {step === 'confirmed' && currentLead && (
            <motion.section
              key={`step-confirmed-${playRound}`}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-[500px] relative overflow-hidden rounded-[28px] sm:rounded-[34px] border border-[#D4A437]/45 bg-[#FFFDF9]/94 p-6 sm:p-8 text-center backdrop-blur-xl autumn-card-shadow"
            >
              <div
                className="absolute inset-x-0 top-0 h-1.5"
                style={{
                  background: 'linear-gradient(90deg, #5A3B08 0%, #B3801D 35%, #F5D67B 68%, #C8962E 100%)',
                }}
              />
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-600/30 bg-emerald-50 text-emerald-700 shadow-sm">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8962E]/35 bg-[#FDF6E2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A5610]">
                <Crown className="h-3.5 w-3.5" />
                Confirmación VIP Registrada
              </span>

              <h2 className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-[#22150E]">
                ¡Gracias, {currentLead.name}!
              </h2>
              <p className="mt-2 text-sm text-[#594133] leading-relaxed">
                Tus datos han sido registrados con éxito. Nuestro equipo se comunicará contigo muy pronto para coordinar tu experiencia.
              </p>

              <div className="mt-5 rounded-2xl border border-[#D4A437]/40 bg-gradient-to-b from-[#FDF6E2] to-[#F9EDCE] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#8A5610]">
                  Tu Código de Confirmación VIP
                </p>
                <div className="mt-2 flex items-center justify-center gap-2.5">
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-[#22150E]">
                    {currentLead.claimCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyClaimCode(currentLead.claimCode)}
                    aria-label="Copiar código VIP"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#C8962E]/40 bg-white/85 text-[#8A5610] hover:bg-white transition-colors cursor-pointer"
                  >
                    {copiedClaimCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                {copiedClaimCode && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                    Código copiado al portapapeles
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-[#E6D5BF] bg-[#FAF3E8]/75 px-4 py-3 text-left text-xs text-[#594133] space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#8B6F5B]">Asesor Oficial:</span>
                  <span className="font-bold text-[#22150E]">{appState.settings.advisorName}</span>
                </div>
                {effectiveShareReferrerName && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#8B6F5B] inline-flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5 text-[#B3801D]" />
                      Invitación de:
                    </span>
                    <span className="font-bold text-[#22150E]">{effectiveShareReferrerName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#8B6F5B]">Teléfono registrado:</span>
                  <span className="font-mono font-semibold text-[#22150E]">{currentLead.phone}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetFlow}
                className="mt-6 inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5A3B08] via-[#9E6F16] to-[#C8962E] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-105 transition-all cursor-pointer"
              >
                Registrar otro invitado
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <WelcomeSceneGate enabled={controls.welcomeVideoEnabled} />

      {/* Strictly public footer with zero reference to /#/dsb */}
      <footer className="relative z-10 mt-6 sm:mt-8 px-3 text-center text-[11px] text-[#8B6F5B]">
        The Ciprian Company · Todos los derechos reservados
      </footer>
    </div>
  );
};
