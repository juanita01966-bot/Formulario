import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { AppState, GiftItem, Lead, LeadQualification } from '../types/app';
import {
  createLead,
  recordReferralVisit,
  resolveReferralCode,
  updateLead,
} from '../services/storeClient';
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

type FlowStep = 'form' | 'quiz' | 'loading' | 'cards' | 'reveal' | 'share_booklet';

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
  const lastClaimCodeRef = useRef<string | null>(null);
  const syncSeqRef = useRef(0);
  const isMountedRef = useRef(true);

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
      ...(referralCode ? { referralCode } : {}),
    });
    lastClaimCodeRef.current = res.lead.claimCode;
    setCurrentLead(res.lead);
    onStateChange(res.state);
    setStep('quiz');
  };

  const handleQuizComplete = async (qualification: LeadQualification) => {
    const wantsBooklet = Boolean(
      (qualification as LeadQualification & { cedeGoldenTicket?: boolean }).cedeGoldenTicket
    );
    setStep(wantsBooklet ? 'share_booklet' : 'loading');
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
    setPlayRound((prev) => prev + 1);
    setStep('form');
    void syncReferralAttribution();
  };

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
              onStartAnother={handleResetFlow}
            />
          )}

          {step === 'share_booklet' && currentLead && (
            <GoldenTicketBooklet
              key={`step-booklet-${playRound}`}
              leadName={currentLead.name}
              onStartAnother={handleResetFlow}
            />
          )}
        </AnimatePresence>
      </main>

      <WelcomeSceneGate />

      {/* Strictly public footer with zero reference to /#/dsb */}
      <footer className="relative z-10 mt-6 sm:mt-8 px-3 text-center text-[11px] text-[#8B6F5B]">
        The Ciprian Company · Todos los derechos reservados
      </footer>
    </div>
  );
};
