/**
 * Creates a Stripe checkout session for purchasing a prompt or workflow.
 * Handles 401 by refreshing the session and retrying once.
 *
 * sourceTable: "prompts" = listing from /p/ page (prompts table); "workflows" = from /handle/ page (workflows table)
 */
export type CheckoutPayload = {
  type: "prompt" | "workflow";
  promptId?: string;
  workflowId?: string;
  /** Which table the resource lives in - prompts table (for /p/ page) or workflows table */
  sourceTable?: "prompts" | "workflows";
};

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export async function createCheckoutSession(
  payload: CheckoutPayload,
  options: {
    getAccessToken: () => Promise<string | null>;
    refreshSession: () => Promise<void>;
  },
): Promise<CheckoutResult> {
  let token = await options.getAccessToken();
  if (!token) {
    return { ok: false, error: "Session expired. Please sign in again and retry." };
  }

  async function doFetch(t: string) {
    return fetch("/api/stripe/checkout/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  }

  let res = await doFetch(token);

  // On 401, refresh session and retry once
  if (res.status === 401) {
    await options.refreshSession();
    const newToken = await options.getAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: (data?.error as string) || "Could not start checkout.",
    };
  }

  if (data?.url) {
    return { ok: true, url: data.url };
  }

  return { ok: false, error: "Checkout failed. Please try again." };
}
