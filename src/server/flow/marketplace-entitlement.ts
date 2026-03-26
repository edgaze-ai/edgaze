import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getWorkflowDraftId, isAdmin, workflowExists } from "@lib/supabase/executions";

export const DEMO_RUNNER_IDS = new Set(["anonymous_demo_user", "admin_demo_user"]);

export type WorkflowEntitlementRow = {
  id: string;
  owner_id: string;
  is_public: boolean | null;
  is_published: boolean | null;
  is_paid: boolean | null;
  monetisation_mode: string | null;
  removed_at: string | null;
};

function isNaturallyFree(row: Pick<WorkflowEntitlementRow, "is_paid" | "monetisation_mode">) {
  return row.monetisation_mode === "free" || row.is_paid === false;
}

export type AuthenticatedRunEntitlement =
  | {
      ok: true;
      effectiveIsBuilderTest: boolean;
      draftIdForCount: string | null;
      /** When true, /api/flow/run should use server-resolved graph (active version). */
      useServerMarketplaceGraph: boolean;
    }
  | { ok: false; message: string };

/**
 * Whether the signed-in user may run this workflow id. Does not apply to anonymous/admin demo runners.
 */
export async function getAuthenticatedRunEntitlement(
  userId: string,
  workflowId: string,
  clientRequestedBuilderTest: boolean,
): Promise<AuthenticatedRunEntitlement> {
  if (DEMO_RUNNER_IDS.has(userId)) {
    throw new Error(
      "getAuthenticatedRunEntitlement: use demo runners only in anonymous/admin branches",
    );
  }

  if (await isAdmin(userId)) {
    const exists = await workflowExists(workflowId);
    const draftId = !exists ? await getWorkflowDraftId(workflowId, userId) : null;
    return {
      ok: true,
      effectiveIsBuilderTest: clientRequestedBuilderTest,
      draftIdForCount: draftId,
      // Admins may debug arbitrary client graphs when exercising builder test flows.
      useServerMarketplaceGraph: !!(exists && !clientRequestedBuilderTest),
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: wf, error } = await supabase
    .from("workflows")
    .select("id, owner_id, is_public, is_published, is_paid, monetisation_mode, removed_at")
    .eq("id", workflowId)
    .maybeSingle();

  if (error) {
    console.error("[entitlement] workflow fetch", error);
    return { ok: false, message: "Unable to verify workflow access." };
  }

  if (!wf) {
    const draftId = await getWorkflowDraftId(workflowId, userId);
    if (!draftId) {
      return { ok: false, message: "Workflow not found or you don't have access." };
    }
    return {
      ok: true,
      effectiveIsBuilderTest: true,
      draftIdForCount: draftId,
      useServerMarketplaceGraph: false,
    };
  }

  const row = wf as WorkflowEntitlementRow;

  if (row.removed_at != null) {
    return { ok: false, message: "This workflow is no longer available." };
  }
  if (row.is_public === false) {
    return { ok: false, message: "This workflow is private." };
  }
  if (row.is_published === false) {
    if (String(row.owner_id ?? "") !== String(userId)) {
      return { ok: false, message: "This workflow is not published." };
    }
  }

  const isOwner = String(row.owner_id ?? "") === String(userId);
  const free = isNaturallyFree(row);

  if (isOwner) {
    return {
      ok: true,
      effectiveIsBuilderTest: clientRequestedBuilderTest,
      draftIdForCount: null,
      useServerMarketplaceGraph: !clientRequestedBuilderTest,
    };
  }

  if (free) {
    return {
      ok: true,
      effectiveIsBuilderTest: false,
      draftIdForCount: null,
      useServerMarketplaceGraph: true,
    };
  }

  const { data: purchase } = await supabase
    .from("workflow_purchases")
    .select("id, status, refunded_at")
    .eq("workflow_id", workflowId)
    .eq("buyer_id", userId)
    .maybeSingle();

  const paid =
    purchase &&
    (purchase as { status?: string }).status === "paid" &&
    (purchase as { refunded_at?: string | null }).refunded_at == null;

  if (!paid) {
    return {
      ok: false,
      message: "Purchase this workflow to run it, or try the one-time demo.",
    };
  }

  return {
    ok: true,
    effectiveIsBuilderTest: false,
    draftIdForCount: null,
    useServerMarketplaceGraph: true,
  };
}
