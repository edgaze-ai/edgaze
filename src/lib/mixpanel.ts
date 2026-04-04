// src/lib/mixpanel.ts
// Mixpanel: intentional product analytics (not noise). Session replay + lean event payloads.
import mixpanel from "mixpanel-browser";

type Properties = Record<string, any>;
/** Event payload; exported for safeTrack helpers in UI code. */
export type TrackProperties = Properties;

const token = () => process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const hasToken = () => Boolean(token());

function recordSessionsPercent(): number {
  const raw = process.env.NEXT_PUBLIC_MIXPANEL_RECORD_PERCENT;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (!Number.isNaN(n)) return Math.min(100, Math.max(0, n));
  }
  return process.env.NODE_ENV === "production" ? 100 : 0;
}

// React StrictMode (dev) double-invokes effects. Also multiple imports can race init.
// Use Promise-based initialization to prevent race conditions.
let initPromise: Promise<void> | null = null;
let initialized = false;
let consoleErrorInterceptor: ((...args: any[]) => void) | null = null;

function isInternalDevice(): boolean {
  if (!canUseBrowserApis()) return false;
  try {
    const flag = window.localStorage.getItem("edgaze:disable_mixpanel");
    if (flag === "true") return true;
  } catch {
    // ignore storage errors
  }
  return false;
}

// Session tracking to prevent duplicate events
let sessionId: string | null = null;
let lastPageView: string | null = null;
let lastPageViewTime: number = 0;
const PAGE_VIEW_DEBOUNCE_MS = 1000; // Prevent duplicate page views within 1 second

// Track initialization errors to prevent spam
let initErrorLogged = false;

function canUseBrowserApis() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create session ID
 */
function getSessionId(): string {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  return sessionId;
}

/**
 * Enhanced console.error filter for Mixpanel errors
 * Filters out harmless internal errors while preserving real issues
 */
function setupConsoleErrorFilter() {
  if (!canUseBrowserApis() || consoleErrorInterceptor) return;

  const originalConsoleError = console.error;
  consoleErrorInterceptor = (...args: any[]) => {
    // Check if this is a Mixpanel mutex timeout error or other harmless errors
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

    // List of harmless Mixpanel errors to suppress
    const isHarmlessError =
      message.includes("[lock]") ||
      message.includes("timeout waiting for mutex") ||
      message.includes("clearing lock") ||
      message.includes("__mpq_") ||
      message.includes("mutex") ||
      message.includes("storage quota exceeded") || // Browser storage limits
      (message.includes("mixpanel error") &&
        (message.includes("mutex") || message.includes("lock"))) ||
      message.includes("failed to persist") ||
      message.includes("quotaexceedederror");

    // Suppress harmless errors, pass through everything else
    if (!isHarmlessError) {
      originalConsoleError.apply(console, args);
    }
    // Otherwise silently ignore - these are harmless Mixpanel internal errors
  };

  console.error = consoleErrorInterceptor;
}

/** Device / environment context registered once as super-properties (not duplicated on every event). */
function staticRegisterProps(): Properties {
  if (!canUseBrowserApis()) return {};

  const { innerWidth, innerHeight, devicePixelRatio } = window;
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);

  let browser = "unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "chrome";
  else if (ua.includes("Firefox")) browser = "firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "safari";
  else if (ua.includes("Edg")) browser = "edge";
  else if (ua.includes("Opera")) browser = "opera";

  let os = "unknown";
  if (ua.includes("Windows")) os = "windows";
  else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "macos";
  else if (ua.includes("Linux")) os = "linux";
  else if (ua.includes("Android")) os = "android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "ios";

  return {
    env: process.env.NODE_ENV,
    screen_w: innerWidth,
    screen_h: innerHeight,
    dpr: devicePixelRatio,
    device_type: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
    browser,
    os,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language || navigator.languages?.[0] || "en",
    user_type: "anonymous",
  };
}

/**
 * Small per-event context. Heavy device/UA/session fields live in super-properties + replay.
 */
function eventContext(): Properties {
  if (!canUseBrowserApis()) return {};
  const ref = document.referrer || "";
  let ref_host: string | undefined;
  try {
    if (ref) ref_host = new URL(ref).hostname;
  } catch {
    ref_host = undefined;
  }
  return {
    path: window.location?.pathname || undefined,
    ...(window.location?.search ? { query: window.location.search.slice(1) } : {}),
    ...(ref_host ? { ref_host } : {}),
  };
}

function registerSuperContext(client: Pick<typeof mixpanel, "register">) {
  client.register({
    app: "edgaze",
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    session_id: getSessionId(),
    ...staticRegisterProps(),
  });
}

/**
 * Suppress mutex timeout errors from Mixpanel's internal storage operations
 */
function suppressMutexErrors<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error: any) {
    // Suppress mutex lock timeout errors - these are harmless and happen during
    // concurrent access from multiple tabs or rapid calls
    if (
      error?.message?.includes("[lock]") ||
      error?.message?.includes("Timeout waiting for mutex") ||
      error?.message?.includes("clearing lock") ||
      error?.message?.includes("QuotaExceededError")
    ) {
      // Silently ignore - Mixpanel handles this internally
      return undefined;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Initialize Mixpanel with premium configuration
 */
async function ensureInit(): Promise<void> {
  if (isInternalDevice()) return;
  // If already initialized, return immediately
  if (initialized) return;

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise;
  }

  if (!hasToken()) {
    if (!initErrorLogged) {
      console.warn("[Mixpanel] NEXT_PUBLIC_MIXPANEL_TOKEN not configured");
      initErrorLogged = true;
    }
    return;
  }

  if (!canUseBrowserApis()) return;

  // Create a single initialization promise that all callers will wait for
  initPromise = (async () => {
    if (initialized) return; // Double-check after async gap

    try {
      // Set up console.error filter BEFORE initializing Mixpanel
      // This prevents mutex timeout errors from cluttering the console
      setupConsoleErrorFilter();

      // Intentional analytics: no autocapture flood; session replay optional via env.
      suppressMutexErrors(() => {
        mixpanel.init(token() as string, {
          debug: process.env.NODE_ENV === "development",
          persistence: "cookie",
          secure_cookie: true,
          cross_site_cookie: true,
          ignore_dnt: true,
          track_pageview: false,
          autocapture: false,
          batch_requests: true,
          batch_size: 50,
          batch_flush_interval_ms: 5000,
          record_sessions_percent: recordSessionsPercent(),
          record_mask_all_inputs: true,
          record_collect_fonts: true,
          hooks: {
            before_send_events: (payload) => {
              const p = payload.properties;
              if (p && typeof p === "object") {
                delete p.user_agent;
                for (const k of Object.keys(p)) {
                  const v = p[k];
                  if (typeof v === "string" && v.length > 800) {
                    p[k] = `${v.slice(0, 800)}…`;
                  }
                }
              }
              return payload;
            },
          },
          loaded: (mp) => {
            try {
              registerSuperContext(mp);
            } catch {
              // ignore
            }
          },
        });
      });

      initialized = true;
      initErrorLogged = false;
    } catch (error: any) {
      // Log initialization errors only once
      if (!initErrorLogged) {
        console.error("[Mixpanel] Initialization error:", error);
        initErrorLogged = true;
      }
      // Reset state so we can retry
      initialized = false;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Initialize Mixpanel (public API)
 */
export const initMixpanel = () => {
  ensureInit().catch(() => {
    // Ignore initialization errors - don't block app
  });
};

/**
 * Track an event with comprehensive error handling
 */
export const track = (event: string, properties?: Properties) => {
  if (!hasToken()) return;
  if (isInternalDevice()) return;

  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        const props = { ...eventContext(), ...(properties ?? {}) };

        // Ensure event name is valid (Mixpanel requirement)
        const sanitizedEvent = event.trim() || "Unknown Event";

        mixpanel.track(sanitizedEvent, props);
      });
    })
    .catch((error) => {
      // Log tracking errors only in development
      if (process.env.NODE_ENV === "development") {
        console.warn("[Mixpanel] Tracking error:", error);
      }
      // Never block product UX on analytics
    });
};

/**
 * Track page view with deduplication
 */
export const trackPageView = (properties?: Properties) => {
  if (!hasToken()) return;
  if (isInternalDevice()) return;

  const now = Date.now();
  const currentPath = window.location?.pathname + window.location?.search;

  // Deduplicate: don't track the same page view within debounce window
  if (lastPageView === currentPath && now - lastPageViewTime < PAGE_VIEW_DEBOUNCE_MS) {
    return;
  }

  lastPageView = currentPath;
  lastPageViewTime = now;

  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        const props = {
          ...eventContext(),
          ...(properties ?? {}),
          page_title: document.title || undefined,
          page_url: window.location?.href || undefined,
        };

        mixpanel.track("Page Viewed", props);
      });
    })
    .catch(() => {
      // Never block product UX on analytics
    });
};

/**
 * Identify a user and merge anonymous history
 * Call exactly once after a user logs in (or session appears).
 * This merges anonymous pre-login events into the user profile.
 */
export const identifyUser = (userId: string, props?: Record<string, any>) => {
  if (!hasToken()) return;
  if (isInternalDevice()) return;

  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        const currentDistinctId = mixpanel.get_distinct_id();

        // If we are currently anonymous and about to identify as a real user,
        // alias merges anonymous history into the user profile.
        // This is critical for accurate user journey tracking.
        if (currentDistinctId && currentDistinctId !== userId) {
          try {
            // Alias the anonymous ID to the user ID
            // This ensures all anonymous events are attributed to the user
            mixpanel.alias(userId, currentDistinctId);
          } catch (err) {
            // alias can throw if called twice; safe to ignore
            // Mixpanel handles duplicate aliases gracefully
          }
        }

        // Identify the user
        mixpanel.identify(userId);

        if (props) {
          try {
            // Use Mixpanel-reserved keys where possible for better UI/joins
            const peopleProps: Record<string, any> = { ...props };

            // Map standard properties to Mixpanel reserved properties
            if (peopleProps.email && !peopleProps.$email) {
              peopleProps.$email = peopleProps.email;
            }
            if (peopleProps.name && !peopleProps.$name) {
              peopleProps.$name = peopleProps.name;
            }
            if (peopleProps.handle && !peopleProps.$username) {
              peopleProps.$username = peopleProps.handle;
            }

            // Set user properties in Mixpanel People
            mixpanel.people.set(peopleProps);

            // Also register as super properties so they flow into subsequent events
            mixpanel.register({
              user_id: userId,
              email: peopleProps.email ?? undefined,
              handle: peopleProps.handle ?? undefined,
              plan: peopleProps.plan ?? undefined,
              email_verified: peopleProps.email_verified ?? undefined,
              user_type: "authenticated",
            });
          } catch (err) {
            // Ignore property setting errors
          }
        }
      });
    })
    .catch(() => {
      // Never block product UX on analytics
    });
};

/**
 * Reset identity (for logout)
 * Clears the distinct_id to start fresh for anonymous tracking
 */
export const resetIdentity = () => {
  if (!hasToken()) return;
  if (isInternalDevice()) return;

  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        // Track logout event before resetting
        mixpanel.track("User Logged Out", {
          ...eventContext(),
        });

        mixpanel.reset();

        sessionId = generateSessionId();

        registerSuperContext(mixpanel);
      });
    })
    .catch(() => {
      // Never block product UX on analytics
    });
};

/**
 * Set user properties (for updating user info)
 */
export const setUserProperties = (props: Record<string, any>) => {
  if (!hasToken()) return;
  if (isInternalDevice()) return;

  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        const peopleProps: Record<string, any> = { ...props };

        // Map to Mixpanel reserved properties
        if (peopleProps.email && !peopleProps.$email) {
          peopleProps.$email = peopleProps.email;
        }
        if (peopleProps.name && !peopleProps.$name) {
          peopleProps.$name = peopleProps.name;
        }
        if (peopleProps.handle && !peopleProps.$username) {
          peopleProps.$username = peopleProps.handle;
        }

        mixpanel.people.set(peopleProps);
        mixpanel.register(peopleProps);
      });
    })
    .catch(() => {
      // Never block product UX on analytics
    });
};

/**
 * Increment user property (for counters like workflow runs, etc.)
 */
export const incrementUserProperty = (property: string, value: number = 1) => {
  if (!hasToken()) return;
  if (isInternalDevice()) return;

  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        mixpanel.people.increment(property, value);
      });
    })
    .catch(() => {
      // Never block product UX on analytics
    });
};

/**
 * Track time-based events (for funnels and conversion tracking)
 */
export const timeEvent = (eventName: string) => {
  if (!hasToken()) return;
  if (isInternalDevice()) return;

  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        mixpanel.time_event(eventName);
      });
    })
    .catch(() => {
      // Never block product UX on analytics
    });
};

// Set up console error filter immediately when module loads (if in browser)
// This ensures we catch Mixpanel errors even if they happen before explicit init
if (canUseBrowserApis()) {
  setupConsoleErrorFilter();
}
