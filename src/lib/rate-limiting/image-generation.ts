// Image generation rate limiting utilities
import { createServerClient } from "@lib/supabase/server";

export type IdentifierType = "ip" | "device" | "user";

export interface ImageGenerationCheck {
  allowed: boolean;
  requiresApiKey: boolean;
  freeRemaining?: number;
  freeUsed?: number;
  error?: string;
}

/**
 * Extract client identifier from request headers
 * Tries IP address first, then falls back to device fingerprint if available
 */
export function extractClientIdentifier(req: Request): {
  identifier: string;
  type: IdentifierType;
} {
  // Try to get IP from various headers (common in production)
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip"); // Cloudflare

  let ip: string | null = null;

  if (cfConnectingIp) {
    ip = cfConnectingIp.split(",")[0]?.trim() ?? null;
  } else if (realIp) {
    ip = realIp.split(",")[0]?.trim() ?? null;
  } else if (forwardedFor) {
    ip = forwardedFor.split(",")[0]?.trim() ?? null;
  }

  // Try device fingerprint from headers (if client sends it)
  const deviceFingerprint = req.headers.get("x-device-fingerprint");

  if (deviceFingerprint && deviceFingerprint.length > 10) {
    return {
      identifier: deviceFingerprint,
      type: "device",
    };
  }

  // Fall back to IP (or a default if no IP found)
  if (ip && ip !== "::1" && ip !== "127.0.0.1") {
    return {
      identifier: ip,
      type: "ip",
    };
  }

  // Last resort: use a default identifier (shouldn't happen in production)
  return {
    identifier: "unknown",
    type: "ip",
  };
}

/**
 * Check if image generation is allowed for this user (platform key).
 * Signed-in users may use the platform OpenAI key without a per-user image cap.
 * Anonymous users must provide their own API key.
 */
export async function checkImageGenerationAllowed(
  _identifier: string,
  _identifierType: IdentifierType,
  userId?: string | null,
  hasApiKey: boolean = false,
): Promise<ImageGenerationCheck> {
  try {
    if (hasApiKey) {
      return {
        allowed: true,
        requiresApiKey: false,
        error: undefined,
      };
    }
    if (userId) {
      return {
        allowed: true,
        requiresApiKey: false,
        error: undefined,
      };
    }
    return {
      allowed: false,
      requiresApiKey: true,
      error: "Please sign in or provide your OpenAI API key.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Exception checking image generation allowance:", err);
    return {
      allowed: false,
      requiresApiKey: true,
      error: msg
        ? `Could not verify image generation eligibility: ${msg}. You can provide your OpenAI API key to generate images.`
        : "Could not verify image generation eligibility. Please provide your OpenAI API key.",
    };
  }
}

/** Keep tracking rows small: data URLs and huge strings bloat Postgres TOAST. */
function sanitizeImageUrlForTracking(url: string | null | undefined): string | null {
  if (url == null || url === "") return null;
  if (/^data:/i.test(url.trim())) return "inline-data-url-redacted";
  const max = 2048;
  return url.length > max ? url.slice(0, max) : url;
}

/**
 * Record an image generation event
 */
export async function recordImageGeneration(
  identifier: string,
  identifierType: IdentifierType,
  userId: string | null | undefined,
  workflowId: string | null | undefined,
  nodeId: string | null | undefined,
  imageUrl: string | null | undefined,
  usedFreeTier: boolean = true,
  apiKeyProvided: boolean = false,
): Promise<void> {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase.rpc("record_image_generation", {
      p_identifier: identifier,
      p_identifier_type: identifierType,
      p_user_id: userId || null,
      p_workflow_id: workflowId || null,
      p_node_id: nodeId || null,
      p_image_url: sanitizeImageUrlForTracking(imageUrl),
      p_used_free_tier: usedFreeTier,
      p_api_key_provided: apiKeyProvided,
    });

    if (error) {
      console.error("Error recording image generation:", error);
      // Don't throw - recording failure shouldn't block the response
    }
  } catch (err) {
    console.error("Exception recording image generation:", err);
    // Don't throw - recording failure shouldn't block the response
  }
}
