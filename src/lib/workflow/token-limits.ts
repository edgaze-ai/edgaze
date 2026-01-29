// src/lib/workflow/token-limits.ts
/**
 * Configurable token limits per workflow
 * Managed from admin/moderation panel
 */

import { createSupabaseServerClient } from "../supabase/server";

const DEFAULT_MAX_TOKENS_PER_WORKFLOW = 200_000;
const DEFAULT_MAX_TOKENS_PER_NODE = 50_000;

export type TokenLimits = {
  maxTokensPerWorkflow: number;
  maxTokensPerNode: number;
  workflowId?: string; // If set, applies to specific workflow
};

/**
 * Get token limits for a workflow
 * Falls back to defaults if not configured
 */
export async function getTokenLimits(workflowId?: string): Promise<TokenLimits> {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Try to fetch custom limits from database
    // First check workflow-specific limits
    if (workflowId) {
      const { data: workflow } = await supabase
        .from("workflows")
        .select("meta")
        .eq("id", workflowId)
        .maybeSingle();
      
      if (workflow?.meta?.tokenLimits) {
        return {
          maxTokensPerWorkflow: workflow.meta.tokenLimits.maxTokensPerWorkflow || DEFAULT_MAX_TOKENS_PER_WORKFLOW,
          maxTokensPerNode: workflow.meta.tokenLimits.maxTokensPerNode || DEFAULT_MAX_TOKENS_PER_NODE,
          workflowId,
        };
      }
    }
    
    // Check global settings
    const { data: settings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "token_limits")
      .maybeSingle();
    
    if (settings?.value) {
      const limits = settings.value as TokenLimits;
      return {
        maxTokensPerWorkflow: limits.maxTokensPerWorkflow || DEFAULT_MAX_TOKENS_PER_WORKFLOW,
        maxTokensPerNode: limits.maxTokensPerNode || DEFAULT_MAX_TOKENS_PER_NODE,
      };
    }
    
    // Default limits
    return {
      maxTokensPerWorkflow: DEFAULT_MAX_TOKENS_PER_WORKFLOW,
      maxTokensPerNode: DEFAULT_MAX_TOKENS_PER_NODE,
    };
  } catch (error) {
    console.error("Error fetching token limits:", error);
    // Return defaults on error
    return {
      maxTokensPerWorkflow: DEFAULT_MAX_TOKENS_PER_WORKFLOW,
      maxTokensPerNode: DEFAULT_MAX_TOKENS_PER_NODE,
    };
  }
}

/**
 * Update token limits for a workflow (admin only)
 */
export async function updateTokenLimits(
  limits: TokenLimits,
  workflowId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    
    if (workflowId) {
      // Update workflow-specific limits
      const { data: workflow } = await supabase
        .from("workflows")
        .select("meta")
        .eq("id", workflowId)
        .maybeSingle();
      
      const currentMeta = workflow?.meta || {};
      const updatedMeta = {
        ...currentMeta,
        tokenLimits: {
          maxTokensPerWorkflow: limits.maxTokensPerWorkflow,
          maxTokensPerNode: limits.maxTokensPerNode,
        },
      };
      
      const { error } = await supabase
        .from("workflows")
        .update({ meta: updatedMeta })
        .eq("id", workflowId);
      
      if (error) throw error;
    } else {
      // Update global settings
      const { error } = await supabase
        .from("settings")
        .upsert({
          key: "token_limits",
          value: {
            maxTokensPerWorkflow: limits.maxTokensPerWorkflow,
            maxTokensPerNode: limits.maxTokensPerNode,
          },
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to update token limits" };
  }
}

export { DEFAULT_MAX_TOKENS_PER_WORKFLOW, DEFAULT_MAX_TOKENS_PER_NODE };
