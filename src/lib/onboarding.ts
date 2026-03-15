// Onboarding State Machine Logic
// Manages the step-by-step flow of creator onboarding

export type OnboardingStep = "welcome" | "message" | "auth" | "profile" | "stripe" | "done";

export interface OnboardingState {
  currentStep: OnboardingStep;
  invite: {
    id: string;
    creator_name: string;
    creator_photo_url: string;
    custom_message: string;
  };
  user?: {
    id: string;
    email?: string;
  };
  profile?: {
    display_name?: string;
    handle?: string;
    avatar_url?: string;
    banner_url?: string;
  };
  stripe?: {
    choice: "now" | "later" | "unset";
    account_id?: string;
    status: "not_started" | "in_progress" | "complete" | "restricted";
  };
}

/**
 * Get the next step in the onboarding flow
 */
export function getNextStep(currentStep: OnboardingStep): OnboardingStep | null {
  const stepOrder: OnboardingStep[] = ["welcome", "message", "auth", "profile", "stripe", "done"];
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
    return null;
  }

  return stepOrder[currentIndex + 1] ?? null;
}

/**
 * Get the previous step in the onboarding flow
 */
export function getPreviousStep(currentStep: OnboardingStep): OnboardingStep | null {
  const stepOrder: OnboardingStep[] = ["welcome", "message", "auth", "profile", "stripe", "done"];
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentIndex <= 0) {
    return null;
  }

  return stepOrder[currentIndex - 1] ?? null;
}

/**
 * Calculate progress percentage (0-100)
 */
export function calculateProgress(currentStep: OnboardingStep): number {
  const stepOrder: OnboardingStep[] = ["welcome", "message", "auth", "profile", "stripe", "done"];
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentIndex === -1) return 0;

  // Progress is based on completed steps
  // welcome = 0%, message = 16.67%, auth = 33.33%, profile = 50%, stripe = 66.67%, done = 100%
  return (currentIndex / (stepOrder.length - 1)) * 100;
}

/**
 * Get step index (0-based)
 */
export function getStepIndex(step: OnboardingStep): number {
  const stepOrder: OnboardingStep[] = ["welcome", "message", "auth", "profile", "stripe", "done"];
  return stepOrder.indexOf(step);
}

/**
 * Check if a step can be accessed (prevent skipping)
 */
export function canAccessStep(
  targetStep: OnboardingStep,
  currentStep: OnboardingStep,
  isAuthenticated: boolean,
): boolean {
  const targetIndex = getStepIndex(targetStep);
  const currentIndex = getStepIndex(currentStep);

  // Can't go backwards past auth if not authenticated
  if (!isAuthenticated && targetIndex >= getStepIndex("auth")) {
    return false;
  }

  // Can only go forward one step at a time, or backwards
  if (targetIndex > currentIndex + 1) {
    return false;
  }

  return true;
}

/**
 * Determine which step to show based on invite status and user state
 */
export function determineInitialStep(
  inviteStatus: "active" | "claimed" | "completed" | "revoked" | "expired",
  isAuthenticated: boolean,
  claimedByCurrentUser: boolean,
  onboardingStep?: OnboardingStep,
): OnboardingStep | "invalid" {
  // Invalid states
  if (inviteStatus === "revoked") return "invalid";
  if (inviteStatus === "expired") return "invalid";
  if (inviteStatus === "completed") return "invalid";
  if (inviteStatus === "claimed" && !claimedByCurrentUser) return "invalid";

  // Fresh invite, not authenticated
  if (inviteStatus === "active" && !isAuthenticated) {
    return "welcome";
  }

  // Claimed by current user, resume their progress
  if (inviteStatus === "claimed" && claimedByCurrentUser && onboardingStep) {
    return onboardingStep;
  }

  // Active invite, user is authenticated (edge case - they might have signed in separately)
  if (inviteStatus === "active" && isAuthenticated) {
    return "profile"; // Skip to profile setup
  }

  return "welcome";
}

/**
 * Validate step transition
 */
export function isValidTransition(from: OnboardingStep, to: OnboardingStep): boolean {
  const fromIndex = getStepIndex(from);
  const toIndex = getStepIndex(to);

  // Can go forward one step
  if (toIndex === fromIndex + 1) return true;

  // Can go backward
  if (toIndex < fromIndex) return true;

  // Can't skip steps
  return false;
}

/**
 * Get step metadata for UI
 */
export function getStepMetadata(step: OnboardingStep) {
  const metadata: Record<OnboardingStep, { title: string; description: string }> = {
    welcome: {
      title: "Welcome",
      description: "Personalized greeting",
    },
    message: {
      title: "Message",
      description: "A note for you",
    },
    auth: {
      title: "Account",
      description: "Create your account",
    },
    profile: {
      title: "Profile",
      description: "Set up your profile",
    },
    stripe: {
      title: "Payouts",
      description: "Connect Stripe",
    },
    done: {
      title: "Complete",
      description: "All set!",
    },
  };

  return metadata[step];
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return state.currentStep === "done";
}

/**
 * Check if profile step is complete
 */
export function isProfileComplete(profile?: OnboardingState["profile"]): boolean {
  if (!profile) return false;
  return !!(profile.display_name && profile.handle && profile.avatar_url);
}

/**
 * Check if Stripe step is complete (or skipped)
 */
export function isStripeComplete(stripe?: OnboardingState["stripe"]): boolean {
  if (!stripe) return false;
  return stripe.choice === "later" || stripe.status === "complete";
}

/**
 * Get completion status for each step
 */
export function getStepCompletionStatus(state: OnboardingState) {
  return {
    welcome: getStepIndex(state.currentStep) > getStepIndex("welcome"),
    message: getStepIndex(state.currentStep) > getStepIndex("message"),
    auth: !!state.user,
    profile: isProfileComplete(state.profile),
    stripe: isStripeComplete(state.stripe),
    done: state.currentStep === "done",
  };
}
