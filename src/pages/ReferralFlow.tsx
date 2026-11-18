import React, { useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { AppState, GiftItem, Lead, LeadQualification } from '../types/app';
import { createLead, updateLead } from '../services/storeClient';
import { AutumnAtmosphere } from '../components/autumn/AutumnAtmosphere';
import { LeadFormCard } from '../components/referral/LeadFormCard';
import { QualificationQuiz } from '../components/referral/QualificationQuiz';
import { CustomLoader } from '../components/referral/CustomLoader';
import { MysteryCardsMenu } from '../components/referral/MysteryCardsMenu';
import { GiftRevealStage } from '../components/referral/GiftRevealStage';
import { WelcomeOrbGuide } from '../components/referral/WelcomeOrbGuide';

type FlowStep = 'form' | 'quiz' | 'loading' | 'cards' | 'reveal';

interface ReferralFlowProps {
  appState: AppState;
  onStateChange: (next: AppState) => void;
}

export const ReferralFlow: React.FC<ReferralFlowProps> = ({ appState, onStateChange }) => {
  const [step, setStep] = useState<FlowStep>('form');
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [revealedGift, setRevealedGift] = useState<GiftItem | null>(null);

  const activeGifts = appState.gifts.filter((g) => g.active);
  const safeActiveGifts = activeGifts.length > 0 ? activeGifts : appState.gifts;

  const handleFormSubmit = async (formData: {
    name: string;
    phone: string;
    address: string;
    acceptedTerms: boolean;
  }) => {
    const res = await createLead({
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
      acceptedTerms: formData.acceptedTerms,
    });
    setCurrentLead(res.lead);
    onStateChange(res.state);
    setStep('quiz');
  };

  const handleQuizComplete = async (qualification: LeadQualification) => {
    setStep('loading');
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
    setStep('form');
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 pb-24 sm:py-12 sm:pb-14">
      <AutumnAtmosphere variant="public" />

      <main className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          {step === 'form' && (
            <LeadFormCard key="step-form" settings={appState.settings} onSubmit={handleFormSubmit} />
          )}

          {step === 'quiz' && currentLead && (
            <QualificationQuiz
              key="step-quiz"
              leadName={currentLead.name}
              onComplete={handleQuizComplete}
            />
          )}

          {step === 'loading' && currentLead && (
            <CustomLoader key="step-loading" leadName={currentLead.name} onComplete={handleLoaderComplete} />
          )}

          {step === 'cards' && currentLead && (
            <MysteryCardsMenu
              key="step-cards"
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
              key="step-reveal"
              leadName={currentLead.name}
              leadAddress={currentLead.address}
              gift={revealedGift}
              claimCode={currentLead.claimCode}
              giftTheme={appState.settings.giftTheme}
              customBoxColor={appState.settings.customBoxColor}
              showcaseStyle={appState.settings.showcaseStyle}
              onStartAnother={handleResetFlow}
            />
          )}
        </AnimatePresence>
      </main>

      <WelcomeOrbGuide currentStep={step} leadName={currentLead?.name} />

      {/* Strictly public footer with zero reference to /#/dsb */}
      <footer className="relative z-10 mt-8 text-center text-[11px] text-[#8B6F5B]">
        The Ciprian Company · Todos los derechos reservados
      </footer>
    </div>
  );
};
