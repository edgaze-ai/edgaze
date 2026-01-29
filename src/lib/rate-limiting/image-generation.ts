// Image generation rate limiting utilities
import { createSupabaseServerClient } from "@lib/supabase/server";

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
 * Check if image generation is allowed for this user
 * Returns: 5 free images per user, then requires BYOK
 */
export async function checkImageGenerationAllowed(
  identifier: string,
  identifierType: IdentifierType,
  userId?: string | null,
  hasApiKey: boolean = false
): Promise<ImageGenerationCheck> {
  try {
    // If no user ID, require API key (anonymous users must BYOK)
    if (!userId) {
      if (hasApiKey) {
        return {
          allowed: true,
          requiresApiKey: false,
          error: undefined,
        };
      }
      return {
        allowed: false,
        requiresApiKey: true,
        error: "Please sign in to get 5 free images, or provide your OpenAI API key.",
      };
    }

    const supabase = await createSupabaseServerClient();
    
    // Call the database function to check free tier limits
    const { data, error } = await supabase.rpc("can_generate_image_free", {
      p_user_id: userId,
      p_has_api_key: hasApiKey,
    });
    
    if (error) {
      const msg = error.message || String(error);
      console.error("Error checking image generation limit:", error);
      return {
        allowed: false,
        requiresApiKey: true,
        error: msg
          ? `Image limit check failed: ${msg}. You can still provide your OpenAI API key to generate images.`
          : "Unable to verify image generation limits. Please provide your OpenAI API key.",
      };
    }
    
    if (!data) {
      return {
        allowed: false,
        requiresApiKey: true,
        error:
          "Image limit check returned no data. If the problem persists, provide your OpenAI API key to generate images.",
      };
    }

    const result = data as {
      allowed: boolean;
      requires_api_key: boolean;
      free_remaining?: number;
      free_used?: number;
      reason?: string;
      error?: string;
    };
    
    return {
      allowed: result.allowed === true,
      requiresApiKey: result.requires_api_key === true,
      freeRemaining: result.free_remaining,
      freeUsed: result.free_used,
      error: result.error,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Exception checking image generation limit:", err);
    return {
      allowed: false,
      requiresApiKey: true,
      error: msg
        ? `Image limit check error: ${msg}. You can provide your OpenAI API key to generate images.`
        : "Error checking image generation limits. Please provide your OpenAI API key.",
    };
  }
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
  apiKeyProvided: boolean = false
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { error } = await supabase.rpc("record_image_generation", {
      p_identifier: identifier,
      p_identifier_type: identifierType,
      p_user_id: userId || null,
      p_workflow_id: workflowId || null,
      p_node_id: nodeId || null,
      p_image_url: imageUrl || null,
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
