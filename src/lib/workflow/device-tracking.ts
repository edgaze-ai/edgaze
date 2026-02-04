// src/lib/workflow/device-tracking.ts
/**
 * Device-based tracking for one-time demo runs
 * Uses server-side tracking with device fingerprint + IP for strict security
 * localStorage is used only for optimistic UI updates
 */

const DEVICE_ID_KEY = "edgaze_device_id";
const DEMO_RUNS_KEY = "edgaze_demo_runs";
const DEMO_CHECK_CACHE_KEY = "edgaze_demo_check_cache";

export type DeviceFingerprint = {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  cookieEnabled: boolean;
  hardwareConcurrency?: number;
  maxTouchPoints?: number;
};

/**
 * Generate a stable device fingerprint
 */
export function getDeviceFingerprint(): DeviceFingerprint {
  if (typeof window === "undefined") {
    return {
      userAgent: "",
      language: "",
      platform: "",
      screenResolution: "",
      timezone: "",
      cookieEnabled: false,
    };
  }

  return {
    userAgent: navigator.userAgent || "",
    language: navigator.language || "",
    platform: navigator.platform || "",
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    cookieEnabled: navigator.cookieEnabled || false,
    hardwareConcurrency: navigator.hardwareConcurrency || undefined,
    maxTouchPoints: navigator.maxTouchPoints || undefined,
  };
}

/**
 * Generate a device fingerprint hash (for server-side tracking)
 * This creates a stable, unique identifier based on device characteristics
 */
export function generateDeviceFingerprintHash(): string {
  const fp = getDeviceFingerprint();
  // Include more characteristics for better uniqueness
  const str = `${fp.userAgent}|${fp.language}|${fp.platform}|${fp.screenResolution}|${fp.timezone}|${fp.hardwareConcurrency || 0}|${fp.maxTouchPoints || 0}`;
  
  // Use a more robust hash function (similar to djb2)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) + char;
  }
  
  // Return a longer hash for better uniqueness
  return `fp_${Math.abs(hash).toString(36)}_${str.length}`;
}

/**
 * Get or create device fingerprint hash (for server-side tracking)
 */
export function getDeviceFingerprintHash(): string {
  if (typeof window === "undefined") return "unknown";
  
  try {
    let fingerprintHash = localStorage.getItem(DEVICE_ID_KEY);
    if (!fingerprintHash) {
      fingerprintHash = generateDeviceFingerprintHash();
      localStorage.setItem(DEVICE_ID_KEY, fingerprintHash);
    }
    return fingerprintHash;
  } catch {
    // Fallback if localStorage is unavailable
    return generateDeviceFingerprintHash();
  }
}

/**
 * Check if demo run is allowed (server-side check)
 * This is the authoritative check - localStorage is only for optimistic UI
 */
export async function canRunDemoServer(workflowId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  try {
    const fingerprintHash = getDeviceFingerprintHash();
    
    // Check server-side
    const response = await fetch("/api/demo-runs/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflowId,
        deviceFingerprint: fingerprintHash,
      }),
    });

    if (!response.ok) {
      console.error("[Demo Runs] Server check failed:", response.status);
      return false;
    }

    const data = await response.json();
    
    // Cache the result in localStorage for optimistic UI
    if (data.ok && typeof data.allowed === "boolean") {
      try {
        const cache = JSON.parse(localStorage.getItem(DEMO_CHECK_CACHE_KEY) || "{}");
        cache[workflowId] = { allowed: data.allowed, timestamp: Date.now() };
        localStorage.setItem(DEMO_CHECK_CACHE_KEY, JSON.stringify(cache));
      } catch {
        // ignore cache errors
      }
      return data.allowed;
    }

    return false;
  } catch (err) {
    console.error("[Demo Runs] Error checking server:", err);
    // On error, check localStorage cache as fallback
    return canRunDemoLocal(workflowId);
  }
}

/**
 * Track a demo run server-side (strict one-time enforcement)
 */
export async function trackDemoRunServer(workflowId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  try {
    const fingerprintHash = getDeviceFingerprintHash();
    
    // Record on server
    const response = await fetch("/api/demo-runs/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflowId,
        deviceFingerprint: fingerprintHash,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Demo Runs] Server track failed:", response.status, errorData);
      return false;
    }

    const data = await response.json();
    
    if (data.ok && data.allowed) {
      // Update local cache
      try {
        const cache = JSON.parse(localStorage.getItem(DEMO_CHECK_CACHE_KEY) || "{}");
        cache[workflowId] = { allowed: false, timestamp: Date.now() };
        localStorage.setItem(DEMO_CHECK_CACHE_KEY, JSON.stringify(cache));
        
        // Also update legacy localStorage tracking for backwards compatibility
        trackDemoRunLocal(workflowId);
      } catch {
        // ignore cache errors
      }
      return true;
    }

    return false;
  } catch (err) {
    console.error("[Demo Runs] Error tracking server:", err);
    return false;
  }
}

/**
 * Local check (fallback/optimistic UI only)
 */
function canRunDemoLocal(workflowId: string): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    // Check cache first
    const cache = JSON.parse(localStorage.getItem(DEMO_CHECK_CACHE_KEY) || "{}");
    const cached = cache[workflowId];
    if (cached && typeof cached.allowed === "boolean") {
      // Cache is valid for 1 hour
      if (Date.now() - cached.timestamp < 3600000) {
        return cached.allowed;
      }
    }
    
    // Fallback to legacy localStorage check
    const count = getDemoRunCount(workflowId);
    return count < 1;
  } catch {
    return false;
  }
}

/**
 * Track a demo run for a workflow (server-side, strict one-time)
 * This is the main function to use - it enforces server-side tracking
 */
export async function trackDemoRun(workflowId: string): Promise<boolean> {
  return trackDemoRunServer(workflowId);
}

/**
 * Legacy local tracking (for backwards compatibility with builder)
 */
function trackDemoRunLocal(workflowId: string): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const fingerprintHash = getDeviceFingerprintHash();
    const runs = getDemoRunCount(workflowId);
    
    // Increment run count
    const newCount = runs + 1;
    setDemoRunCount(workflowId, newCount);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get demo run count for a workflow on this device (localStorage only)
 */
function getDemoRunCount(workflowId: string): number {
  if (typeof window === "undefined") return 0;
  
  try {
    const fingerprintHash = getDeviceFingerprintHash();
    const runs = getAllDemoRuns();
    const key = `${workflowId}:${fingerprintHash}`;
    return runs.get(key) || 0;
  } catch {
    return 0;
  }
}

/**
 * Set demo run count for a workflow on this device (localStorage only)
 */
function setDemoRunCount(workflowId: string, count: number): void {
  if (typeof window === "undefined") return;
  
  try {
    const fingerprintHash = getDeviceFingerprintHash();
    const runs = getAllDemoRuns();
    const key = `${workflowId}:${fingerprintHash}`;
    runs.set(key, count);
    localStorage.setItem(DEMO_RUNS_KEY, JSON.stringify(Object.fromEntries(runs)));
  } catch {
    // ignore
  }
}

/**
 * Check if demo run is allowed for this device
 * For product page: strict one-time (server-side enforced)
 * For builder/preview: allows 5 runs (local only)
 * 
 * Note: For product page (strictOneTime=true), this checks server-side.
 * For builder (strictOneTime=false), this uses local tracking.
 */
export async function canRunDemo(workflowId: string, strictOneTime: boolean = false): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  // For strict one-time (product page), use server-side check
  if (strictOneTime) {
    return canRunDemoServer(workflowId);
  }
  
  // For builder/preview (5 runs), use local tracking
  return canRunDemoLocal(workflowId);
}

/**
 * Synchronous version for backwards compatibility (uses cache/localStorage)
 * Use canRunDemo() for authoritative checks
 */
export function canRunDemoSync(workflowId: string, strictOneTime: boolean = false): boolean {
  if (typeof window === "undefined") return false;
  
  if (strictOneTime) {
    // Check cache first
    return canRunDemoLocal(workflowId);
  }
  
  try {
    const count = getDemoRunCount(workflowId);
    return count < 5; // Builder allows 5 runs
  } catch {
    return false;
  }
}

/**
 * Get remaining demo runs for a workflow
 * For strict one-time, checks server-side cache
 */
export async function getRemainingDemoRuns(workflowId: string, strictOneTime: boolean = false): Promise<number> {
  if (typeof window === "undefined") return 0;
  
  if (strictOneTime) {
    const allowed = await canRunDemoServer(workflowId);
    return allowed ? 1 : 0;
  }
  
  try {
    const count = getDemoRunCount(workflowId);
    return Math.max(0, 5 - count); // Builder allows 5 runs
  } catch {
    return 0;
  }
}

/**
 * Synchronous version for backwards compatibility
 */
export function getRemainingDemoRunsSync(workflowId: string, strictOneTime: boolean = false): number {
  if (typeof window === "undefined") return 0;
  
  try {
    if (strictOneTime) {
      // Check cache
      const cache = JSON.parse(localStorage.getItem(DEMO_CHECK_CACHE_KEY) || "{}");
      const cached = cache[workflowId];
      if (cached && typeof cached.allowed === "boolean") {
        return cached.allowed ? 1 : 0;
      }
      // Fallback to legacy check
      const count = getDemoRunCount(workflowId);
      return count < 1 ? 1 : 0;
    }
    
    const count = getDemoRunCount(workflowId);
    return Math.max(0, 5 - count);
  } catch {
    return 0;
  }
}

/**
 * Get all demo runs as a map (workflowId:deviceId -> count)
 */
function getAllDemoRuns(): Map<string, number> {
  if (typeof window === "undefined") return new Map();
  
  try {
    const stored = localStorage.getItem(DEMO_RUNS_KEY);
    if (!stored) return new Map();
    const obj = JSON.parse(stored) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

/**
 * Clear demo runs (for testing/admin)
 */
export function clearDemoRuns(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DEMO_RUNS_KEY);
  } catch {
    // ignore
  }
}
