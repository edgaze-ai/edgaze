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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
        {/* Premium animated background */}
        <motion.div
          className="absolute left-[20%] top-[30%] h-[400px] w-[400px] rounded-full bg-cyan-400/20 blur-[100px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[20%] bottom-[30%] h-[500px] w-[500px] rounded-full bg-pink-500/20 blur-[120px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-transparent bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500" style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: '4px' }} />
          <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-cyan-400/20 via-sky-500/20 to-pink-500/20 blur-xl" />
        </motion.div>
      </div>
    );
  }

  if (invalidReason) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-black">
        <InvalidTokenScreen reason={invalidReason as any} />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-black">
        <InvalidTokenScreen reason="invalid" />
      </div>
    );
  }

  const progress = calculateProgress(currentStep);

  return (
    <div className="relative min-h-screen w-full overflow-y-auto overflow-x-hidden bg-black">
      {/* Premium Background with Edgaze Gradients */}
      <div className="fixed inset-0 z-0">
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute left-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-cyan-400/20 blur-[120px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[10%] top-[40%] h-[600px] w-[600px] rounded-full bg-pink-500/20 blur-[120px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-[50%] bottom-[20%] h-[400px] w-[400px] rounded-full bg-sky-500/15 blur-[100px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.15),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.12),transparent_50%)]" />
        
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
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
