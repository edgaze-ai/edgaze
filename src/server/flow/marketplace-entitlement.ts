import { getWorkflowDraftId, isAdmin, workflowExists } from "@lib/supabase/executions";
import { resolveWorkflowAccessDecision } from "./workflow-security";

export const DEMO_RUNNER_IDS = new Set([
  "anonymous_demo_user",
  "admin_demo_user",
  "homepage_demo_user",
]);

export type WorkflowEntitlementRow = {
  id: string;
  owner_id: string;
  is_public: boolean | null;
  is_published: boolean | null;
  is_paid: boolean | null;
  monetisation_mode: string | null;
  removed_at: string | null;
};

export type AuthenticatedRunEntitlement =
  | {
      ok: true;
      effectiveIsBuilderTest: boolean;
      draftIdForCount: string | null;
      /** When true, /api/flow/run should use server-resolved graph (active version). */
      useServerMarketplaceGraph: boolean;
      /** True only when the authenticated user is the workflow owner. */
      isOwner: boolean;
      /**
       * True only for admins running a builder-test against a workflowId that has no
       * published version and no draft on the server. In that case the caller may supply
       * their own graph in the request body for debugging.
       *
       * For every other caller this is always false. If the server graph resolution
       * returns null and this is false, /api/flow/run MUST reject the request — it must
       * never silently fall back to executing a client-supplied graph.
       */
      allowClientGraph: boolean;
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
      useServerMarketplaceGraph: !!(exists && !clientRequestedBuilderTest),
      isOwner: false,
      // Only admins testing a workflow that has no server-side graph at all may
      // supply their own graph in the request body (debugging convenience).
      // When the workflow exists on the server, the server graph always wins.
      allowClientGraph: !exists && !draftId && clientRequestedBuilderTest,
    };
  }

  const decision = await resolveWorkflowAccessDecision({
    workflowId,
    userId,
    requestedMode: clientRequestedBuilderTest ? "edit" : "preview",
  });

  if (decision.workflow == null) {
    const draftId = await getWorkflowDraftId(workflowId, userId);
    if (!draftId) {
      return {
        ok: false,
        message: decision.message ?? "Workflow not found or you don't have access.",
      };
    }
    return {
      ok: true,
      effectiveIsBuilderTest: true,
      draftIdForCount: draftId,
      useServerMarketplaceGraph: false,
      isOwner: true,
      allowClientGraph: false,
    };
  }

  if (!decision.ok) {
    return { ok: false, message: decision.message ?? "Unable to verify workflow access." };
  }

  if (decision.mode === "owner_edit" || decision.mode === "owner_preview") {
    return {
      ok: true,
      effectiveIsBuilderTest: clientRequestedBuilderTest,
      draftIdForCount: null,
      useServerMarketplaceGraph: !clientRequestedBuilderTest,
      isOwner: true,
      allowClientGraph: false,
    };
  }

  return {
    ok: true,
    effectiveIsBuilderTest: false,
    draftIdForCount: null,
    useServerMarketplaceGraph: true,
    isOwner: false,
    allowClientGraph: false,
  };
}
