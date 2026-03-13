'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { calculateProgress, type OnboardingStep } from '@/lib/onboarding';
import Image from 'next/image';

import ProgressBar from './components/ProgressBar';
import WelcomeStep from './components/WelcomeStep';
import MessageStep from './components/MessageStep';
import AuthStep from './components/AuthStep';
import ProfileStep from './components/ProfileStep';
import StripeStep from './components/StripeStep';
import AllSetStep from './components/AllSetStep';
import InvalidTokenScreen from './components/InvalidTokenScreen';

interface InviteData {
  id: string;
  creator_name: string;
  creator_photo_url: string;
  custom_message: string;
  status: 'active' | 'claimed' | 'completed' | 'revoked' | 'expired';
}

function OnboardingContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [stripeChoice, setStripeChoice] = useState<'now' | 'later' | 'unset'>('unset');

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    initializeOnboarding();
  }, [token]);

  // Handle Stripe return
  useEffect(() => {
    if (searchParams.get('stripe') === 'return') {
      handleStripeReturn();
    }
  }, [searchParams]);

  const initializeOnboarding = async () => {
    try {
      // Validate token
      console.log('[Onboarding] Raw token from URL:', token);
      console.log('[Onboarding] Token length:', token.length);
      console.log('[Onboarding] Calling validation API...');
      
      const response = await fetch(`/api/invite-token/${encodeURIComponent(token)}/validate`);
      console.log('[Onboarding] Validation response status:', response.status);
      
      const data = await response.json();
      console.log('[Onboarding] Validation data:', data);

      if (!data.valid) {
        console.log('[Onboarding] Token invalid, reason:', data.reason);
        setInvalidReason(data.reason);
        setLoading(false);
        return;
      }
      
      console.log('[Onboarding] Token valid! Invite:', data.invite);

      setInvite(data.invite);

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);

        // Check if they have an onboarding record
        const onboardingResponse = await fetch('/api/onboarding');
        if (onboardingResponse.ok) {
          const { onboarding } = await onboardingResponse.json();
          if (onboarding) {
            setCurrentStep(onboarding.step as OnboardingStep);
            setStripeChoice(onboarding.stripe_choice);
          } else {
            // User is authenticated but no onboarding record, start at profile
            setCurrentStep('profile');
          }
        } else {
          setCurrentStep('profile');
        }
      } else {
        // Not authenticated, start at welcome
        setCurrentStep('welcome');
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to initialize onboarding:', error);
      setInvalidReason('invalid');
      setLoading(false);
    }
  };

  const handleStripeReturn = async () => {
    try {
      // Check Stripe account status
      const response = await fetch('/api/stripe/connect/status');
      if (response.ok) {
        const data = await response.json();
        
        // Update onboarding state
        await fetch('/api/onboarding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'done',
            stripe_status: data.status === 'active' ? 'complete' : 'in_progress',
          }),
        });

        setCurrentStep('done');
      }
    } catch (error) {
      console.error('Failed to handle Stripe return:', error);
    }
  };

  const handleStepComplete = (nextStep: OnboardingStep) => {
    setCurrentStep(nextStep);
  };

  const handleAuthSuccess = (newUserId: string) => {
    setUserId(newUserId);
    setCurrentStep('profile');
  };

  const handleGoToMarketplace = async () => {
    // Mark onboarding as complete
    await fetch('/api/onboarding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complete: true }),
    });

    router.push('/marketplace');
  };

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505]">
        <div className="absolute inset-0 bg-[#050505]" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 15%, rgba(34,211,238,0.08), transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(236,72,153,0.06), transparent 50%)`,
          }}
        />
        <motion.div
          className="relative h-10 w-10 animate-spin rounded-full border-2 border-white/[0.08] border-t-cyan-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      </div>
    );
  }

  if (invalidReason) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050505]">
        <InvalidTokenScreen reason={invalidReason as any} />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050505]">
        <InvalidTokenScreen reason="invalid" />
      </div>
    );
  }

  const progress = calculateProgress(currentStep);

  return (
    <div className="relative min-h-screen w-full overflow-y-auto overflow-x-hidden bg-[#050505] text-white">
      {/* Same gradient treatment as /creators */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[#050505]" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 15%, rgba(34,211,238,0.12), transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(236,72,153,0.1), transparent 50%),
              radial-gradient(circle at 50% 85%, rgba(34,211,238,0.06), transparent 50%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '72px 72px',
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03), transparent 50%)',
          }}
        />
      </div>

      {/* Progress bar */}
      <div className="relative z-10">
        <ProgressBar progress={progress} />
      </div>

      {/* Step content */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
        {currentStep === 'welcome' && (
          <WelcomeStep
            key="welcome"
            creatorName={invite.creator_name}
            creatorPhotoUrl={invite.creator_photo_url}
            onContinue={() => handleStepComplete('message')}
          />
        )}

        {currentStep === 'message' && (
          <MessageStep
            key="message"
            message={invite.custom_message}
            onContinue={() => handleStepComplete('auth')}
          />
        )}

        {currentStep === 'auth' && (
          <AuthStep
            key="auth"
            creatorName={invite.creator_name}
            creatorPhotoUrl={invite.creator_photo_url}
            inviteToken={token}
            onSuccess={handleAuthSuccess}
          />
        )}

        {currentStep === 'profile' && userId && (
          <ProfileStep
            key="profile"
            userId={userId}
            onContinue={() => handleStepComplete('stripe')}
          />
        )}

        {currentStep === 'stripe' && userId && (
          <StripeStep
            key="stripe"
            userId={userId}
            inviteToken={token}
            onContinue={() => handleStepComplete('done')}
          />
        )}

        {currentStep === 'done' && (
          <AllSetStep
            key="done"
            stripeChoice={stripeChoice}
            onGoToMarketplace={handleGoToMarketplace}
          />
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
          <motion.div
            className="h-16 w-16 animate-spin rounded-full border-4 border-transparent bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500"
            style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: '4px' }}
          />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
