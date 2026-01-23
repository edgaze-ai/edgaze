// src/lib/mixpanel.ts
import mixpanel from "mixpanel-browser";

type Properties = Record<string, any>;

const token = () => process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const hasToken = () => Boolean(token());

// React StrictMode (dev) double-invokes effects. Also multiple imports can race init.
// Use Promise-based initialization to prevent race conditions.
let initPromise: Promise<void> | null = null;
let initialized = false;
let consoleErrorInterceptor: ((...args: any[]) => void) | null = null;

function canUseBrowserApis() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

// Intercept console.error to filter out Mixpanel mutex timeout errors
// These are harmless internal errors that Mixpanel logs but we don't want to see
function setupConsoleErrorFilter() {
  if (!canUseBrowserApis() || consoleErrorInterceptor) return;

  const originalConsoleError = console.error;
  consoleErrorInterceptor = (...args: any[]) => {
    // Check if this is a Mixpanel mutex timeout error
    // Format: "Mixpanel error: "[lock] Timeout waiting for mutex on __mpq_..."
    // Mixpanel can call console.error with various formats, so check all args
    let message = "";
    
    if (args.length > 0) {
      // Try to extract message from all possible formats
      for (const arg of args) {
        if (typeof arg === "string") {
          message += arg + " ";
        } else if (arg?.message) {
          message += String(arg.message) + " ";
        } else if (arg?.toString) {
          message += arg.toString() + " ";
        } else {
          message += String(arg) + " ";
        }
      }
    }
    
    message = message.trim().toLowerCase();

    const isMutexError =
      message.includes("[lock]") ||
      message.includes("timeout waiting for mutex") ||
      message.includes("clearing lock") ||
      message.includes("__mpq_") ||
      (message.includes("mixpanel error") && (message.includes("mutex") || message.includes("lock")));

    // Suppress mutex errors, pass through everything else
    if (!isMutexError) {
      originalConsoleError.apply(console, args);
    }
    // Otherwise silently ignore - these are harmless Mixpanel internal errors
  };

  console.error = consoleErrorInterceptor;
}

function commonProps(): Properties {
  if (!canUseBrowserApis()) return {};

  const { innerWidth, innerHeight, devicePixelRatio } = window;
  return {
    env: process.env.NODE_ENV,
    pathname: window.location?.pathname,
    search: window.location?.search,
    hash: window.location?.hash,
    referrer: document.referrer || undefined,
    screen_w: innerWidth,
    screen_h: innerHeight,
    dpr: devicePixelRatio,
    user_agent: navigator.userAgent,
  };
}

// Suppress mutex timeout errors from Mixpanel's internal storage operations
function suppressMutexErrors(fn: () => void) {
  try {
    fn();
  } catch (error: any) {
    // Suppress mutex lock timeout errors - these are harmless and happen during
    // concurrent access from multiple tabs or rapid calls
    if (
      error?.message?.includes("[lock]") ||
      error?.message?.includes("Timeout waiting for mutex") ||
      error?.message?.includes("clearing lock")
    ) {
      // Silently ignore - Mixpanel handles this internally
      return;
    }
    // Re-throw other errors
    throw error;
  }
}

async function ensureInit(): Promise<void> {
  // If already initialized, return immediately
  if (initialized) return;
  
  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise;
  }
  
  if (!hasToken()) return;
  if (!canUseBrowserApis()) return;

  // Create a single initialization promise that all callers will wait for
  initPromise = (async () => {
    if (initialized) return; // Double-check after async gap
    
    initialized = true;

    // Set up console.error filter BEFORE initializing Mixpanel
    // This prevents mutex timeout errors from cluttering the console
    setupConsoleErrorFilter();

    // Cookie persistence avoids Mixpanel's localStorage mutex/lock spam in modern browsers
    // (especially with multiple tabs + dev reloads).
    suppressMutexErrors(() => {
      mixpanel.init(token() as string, {
        debug: process.env.NODE_ENV !== "production",
        persistence: "cookie",
        secure_cookie: true,
        cross_site_cookie: true,
        ignore_dnt: true,
        // We'll handle route-based page views ourselves (App Router).
        track_pageview: false,
      });
    });

    // Helpful defaults for every event without repeating in call sites.
    suppressMutexErrors(() => {
      mixpanel.register({
        app: "edgaze",
        env: process.env.NODE_ENV,
      });
    });
  })();

  return initPromise;
}

export const initMixpanel = () => {
  ensureInit().catch(() => {
    // Ignore initialization errors
  });
};

export const track = (event: string, properties?: Properties) => {
  if (!hasToken()) return;
  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        mixpanel.track(event, { ...commonProps(), ...(properties ?? {}) });
      });
    })
    .catch(() => {
      // never block product UX on analytics
    });
};

export const trackPageView = (properties?: Properties) => {
  if (!hasToken()) return;
  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        mixpanel.track("Page Viewed", { ...commonProps(), ...(properties ?? {}) });
      });
    })
    .catch(() => {
      // never block product UX on analytics
    });
};

/**
 * Call exactly once after a user logs in (or session appears).
 * This merges anonymous pre-login events into the user profile.
 */
export const identifyUser = (
  userId: string,
  props?: Record<string, any>
) => {
  if (!hasToken()) return;
  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        const currentDistinctId = mixpanel.get_distinct_id();

        // If we are currently anonymous and about to identify as a real user,
        // alias merges anonymous history into the user profile.
        if (currentDistinctId && currentDistinctId !== userId) {
          try {
            mixpanel.alias(userId, currentDistinctId);
          } catch {
            // alias can throw if called twice; safe to ignore
          }
        }

        mixpanel.identify(userId);

        if (props) {
          try {
            // Use Mixpanel-reserved keys where possible for better UI/joins.
            const peopleProps: Record<string, any> = { ...props };
            if (peopleProps.email && !peopleProps.$email) peopleProps.$email = peopleProps.email;
            if (peopleProps.name && !peopleProps.$name) peopleProps.$name = peopleProps.name;

            mixpanel.people.set(peopleProps);

            // Also register as super properties so they flow into subsequent events.
            mixpanel.register({
              user_id: userId,
              email: peopleProps.email ?? undefined,
              handle: peopleProps.handle ?? undefined,
              plan: peopleProps.plan ?? undefined,
            });
          } catch {}
        }
      });
    })
    .catch(() => {
      // never block product UX on analytics
    });
};

export const resetIdentity = () => {
  if (!hasToken()) return;
  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        mixpanel.reset();
      });
    })
    .catch(() => {
      // never block product UX on analytics
    });
};

// Set up console error filter immediately when module loads (if in browser)
// This ensures we catch Mixpanel errors even if they happen before explicit init
if (canUseBrowserApis()) {
  setupConsoleErrorFilter();
}
