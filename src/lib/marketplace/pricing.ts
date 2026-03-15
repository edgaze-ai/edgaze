/**
 * Marketplace pricing limits
 */
export const PROMPT_MAX_USD = 50;
export const WORKFLOW_MAX_USD = 150;
export const WORKFLOW_MIN_USD = 5;
export const PROMPT_MIN_USD = 3;
export const MIN_TRANSACTION_USD = 3; // Used for checkout validation (prompts min is 3)

export function validatePromptPrice(priceUsd: number): { valid: boolean; error?: string } {
  if (priceUsd < MIN_TRANSACTION_USD) {
    return { valid: false, error: `Minimum price is $${MIN_TRANSACTION_USD}` };
  }
  if (priceUsd > PROMPT_MAX_USD) {
    return { valid: false, error: `Maximum price for prompts is $${PROMPT_MAX_USD}` };
  }
  return { valid: true };
}

export function validateWorkflowPrice(
  priceUsd: number,
  minOverride?: number,
): { valid: boolean; error?: string } {
  const effectiveMin =
    minOverride !== undefined ? Math.max(WORKFLOW_MIN_USD, minOverride) : WORKFLOW_MIN_USD;
  if (priceUsd < effectiveMin) {
    return {
      valid: false,
      error: `Minimum price for workflows is $${effectiveMin.toFixed(2)}`,
    };
  }
  if (priceUsd > WORKFLOW_MAX_USD) {
    return { valid: false, error: `Maximum price for workflows is $${WORKFLOW_MAX_USD}` };
  }
  return { valid: true };
}
