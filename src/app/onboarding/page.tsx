'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { isAllowedOnboardingRef } from 'src/lib/creators/onboarding-gate';

function OnboardingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const from = searchParams.get('from');
    const refresh = searchParams.get('refresh');
    const status = searchParams.get('status');
    const error = searchParams.get('error');

    // Valid sources: from param or Stripe return (refresh, status, error)
    const hasValidRef = isAllowedOnboardingRef(from);
    const isStripeReturn = refresh === 'true' || status === 'incomplete' || !!error;

    if (hasValidRef || isStripeReturn) {
      const params = new URLSearchParams();
      params.set('from', from && isAllowedOnboardingRef(from) ? from : 'creators');
      if (refresh) params.set('refresh', refresh);
      if (status) params.set('status', status);
      if (error) params.set('error', error);
      router.replace(`/creators/onboarding?${params.toString()}`);
    } else {
      router.replace('/creators');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-4" />
        <p className="text-white/60">Redirecting…</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-4" />
            <p className="text-white/60">Loading…</p>
          </div>
        </div>
      }
    >
      <OnboardingRedirect />
    </Suspense>
  );
}
