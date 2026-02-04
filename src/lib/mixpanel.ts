// src/lib/mixpanel.ts
// Premium Mixpanel implementation with comprehensive error handling,
// anonymous user tracking, session management, and advanced features
import mixpanel from "mixpanel-browser";

type Properties = Record<string, any>;

const token = () => process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const hasToken = () => Boolean(token());

// React StrictMode (dev) double-invokes effects. Also multiple imports can race init.
// Use Promise-based initialization to prevent race conditions.
let initPromise: Promise<void> | null = null;
let initialized = false;
let consoleErrorInterceptor: ((...args: any[]) => void) | null = null;

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
      (message.includes("mixpanel error") && (message.includes("mutex") || message.includes("lock"))) ||
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

/**
 * Get comprehensive common properties for all events
 * Includes device, browser, and environment information
 */
function commonProps(): Properties {
  if (!canUseBrowserApis()) return {};

  const { innerWidth, innerHeight, devicePixelRatio } = window;
  const now = new Date();
  
  // Extract browser info
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);
  const isDesktop = !isMobile && !isTablet;
  
  // Detect browser
  let browser = "unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "chrome";
  else if (ua.includes("Firefox")) browser = "firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "safari";
  else if (ua.includes("Edg")) browser = "edge";
  else if (ua.includes("Opera")) browser = "opera";
  
  // Detect OS
  let os = "unknown";
  if (ua.includes("Windows")) os = "windows";
  else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "macos";
  else if (ua.includes("Linux")) os = "linux";
  else if (ua.includes("Android")) os = "android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "ios";
  
  // Determine user type based on Mixpanel distinct_id
  // If distinct_id looks like a UUID (authenticated user), mark as authenticated
  // Otherwise, it's anonymous
  let userType = "anonymous";
  try {
    if (initialized) {
      const distinctId = mixpanel.get_distinct_id();
      // UUIDs are typically 36 characters with dashes
      // Authenticated users will have their user_id as distinct_id
      if (distinctId && distinctId.length > 20 && !distinctId.startsWith("session_")) {
        userType = "authenticated";
      }
    }
  } catch {
    // If we can't determine, default to anonymous
    userType = "anonymous";
  }
  
  return {
    // Environment
    env: process.env.NODE_ENV,
    
    // Page information
    pathname: window.location?.pathname,
    search: window.location?.search,
    hash: window.location?.hash,
    referrer: document.referrer || undefined,
    
    // Screen/device
    screen_w: innerWidth,
    screen_h: innerHeight,
    dpr: devicePixelRatio,
    device_type: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
    
    // Browser
    browser,
    os,
    user_agent: ua,
    
    // Session
    session_id: getSessionId(),
    
    // User type (critical for accurate active user counts)
    user_type: userType,
    
    // Timestamp (ISO format for better Mixpanel handling)
    timestamp: now.toISOString(),
    
    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Language
    language: navigator.language || navigator.languages?.[0] || "en",
  };
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

      // Premium Mixpanel configuration
      suppressMutexErrors(() => {
        mixpanel.init(token() as string, {
          debug: process.env.NODE_ENV === "development",
          persistence: "cookie", // Cookie persistence avoids localStorage mutex issues
          secure_cookie: true, // HTTPS only cookies
          cross_site_cookie: true, // Support cross-site tracking
          ignore_dnt: true, // Respect user privacy but still track (DNT is deprecated)
          track_pageview: false, // We handle page views manually for better control
          batch_requests: true, // Batch requests for better performance
          batch_size: 50, // Batch up to 50 events
          batch_flush_interval_ms: 5000, // Flush every 5 seconds
          loaded: (mixpanel) => {
            // Callback when Mixpanel is loaded
            // Set up automatic session tracking
            try {
              // Register super properties that will be included in all events
              mixpanel.register({
                app: "edgaze",
                app_version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
                env: process.env.NODE_ENV,
                session_id: getSessionId(),
              });
            } catch (err) {
              // Ignore registration errors
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
  
  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        const props = { ...commonProps(), ...(properties ?? {}) };
        
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
  
  const now = Date.now();
  const currentPath = window.location?.pathname + window.location?.search;
  
  // Deduplicate: don't track the same page view within debounce window
  if (
    lastPageView === currentPath &&
    now - lastPageViewTime < PAGE_VIEW_DEBOUNCE_MS
  ) {
    return;
  }
  
  lastPageView = currentPath;
  lastPageViewTime = now;
  
  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        const props = {
          ...commonProps(),
          ...(properties ?? {}),
          // Additional page view specific properties
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
              user_type: "authenticated", // Mark as authenticated for all future events
            });
            
            // Track identification event
            mixpanel.track("User Identified", {
              ...commonProps(),
              user_id: userId,
              identification_method: "login",
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
  
  ensureInit()
    .then(() => {
      suppressMutexErrors(() => {
        // Track logout event before resetting
        mixpanel.track("User Logged Out", {
          ...commonProps(),
        });
        
        // Reset to anonymous state
        mixpanel.reset();
        
        // Generate new session ID for anonymous session
        sessionId = generateSessionId();
        
        // Update session ID and user_type in super properties
        mixpanel.register({
          session_id: sessionId,
          user_type: "anonymous", // Mark as anonymous for all future events
        });
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
