/**
 * Allowed referrer values for /creators/onboarding.
 * Only users arriving from these contexts can access payout onboarding.
 */
export const ALLOWED_ONBOARDING_REFS = [
  'monetisation',   // Pricing / monetisation page
  'creator-invite', // Creator invite flow (c/[token])
  'studio',         // Publish modal banner (prompt or workflow)
  'creators',       // Creator landing page (hero, final CTA, onboarding panel)
] as const;

export type OnboardingRef = (typeof ALLOWED_ONBOARDING_REFS)[number];

export function isAllowedOnboardingRef(ref: string | null): ref is OnboardingRef {
  return ref !== null && ALLOWED_ONBOARDING_REFS.includes(ref as OnboardingRef);
}

export function onboardingUrlWithRef(ref: OnboardingRef): string {
  return `/creators/onboarding?from=${ref}`;
}
