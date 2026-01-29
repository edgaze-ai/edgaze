// src/lib/workflow/device-tracking.ts
/**
 * Device-based tracking for one-time demo runs
 * Uses localStorage + fingerprinting for reliable device identification
 */

const DEVICE_ID_KEY = "edgaze_device_id";
const DEMO_RUNS_KEY = "edgaze_demo_runs";

export type DeviceFingerprint = {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  cookieEnabled: boolean;
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
  };
}

/**
 * Generate a device ID from fingerprint
 */
function generateDeviceId(): string {
  const fp = getDeviceFingerprint();
  const str = `${fp.userAgent}|${fp.language}|${fp.platform}|${fp.screenResolution}|${fp.timezone}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `device_${Math.abs(hash).toString(36)}`;
}

/**
 * Get or create device ID
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "unknown";
  
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    // Fallback if localStorage is unavailable
    return generateDeviceId();
  }
}

/**
 * Track a demo run for a workflow (allows up to 5 runs per device)
 */
export function trackDemoRun(workflowId: string): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const deviceId = getDeviceId();
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
 * Get demo run count for a workflow on this device
 */
export function getDemoRunCount(workflowId: string): number {
  if (typeof window === "undefined") return 0;
  
  try {
    const deviceId = getDeviceId();
    const runs = getAllDemoRuns();
    const key = `${workflowId}:${deviceId}`;
    return runs.get(key) || 0;
  } catch {
    return 0;
  }
}

/**
 * Set demo run count for a workflow on this device
 */
function setDemoRunCount(workflowId: string, count: number): void {
  if (typeof window === "undefined") return;
  
  try {
    const deviceId = getDeviceId();
    const runs = getAllDemoRuns();
    const key = `${workflowId}:${deviceId}`;
    runs.set(key, count);
    localStorage.setItem(DEMO_RUNS_KEY, JSON.stringify(Object.fromEntries(runs)));
  } catch {
    // ignore
  }
}

/**
 * Check if demo run is allowed for this device
 * For product page: strict one-time (count < 1)
 * For builder/preview: allows 5 runs (count < 5)
 */
export function canRunDemo(workflowId: string, strictOneTime: boolean = false): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const count = getDemoRunCount(workflowId);
    return strictOneTime ? count < 1 : count < 5; // Strict one-time for product page, 5 for builder
  } catch {
    return false;
  }
}

/**
 * Get remaining demo runs for a workflow
 */
export function getRemainingDemoRuns(workflowId: string, strictOneTime: boolean = false): number {
  if (typeof window === "undefined") return 0;
  
  try {
    const count = getDemoRunCount(workflowId);
    const maxRuns = strictOneTime ? 1 : 5;
    return Math.max(0, maxRuns - count);
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
