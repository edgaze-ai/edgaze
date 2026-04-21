import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { stripGraphSecrets } from "@lib/workflow/stripGraphSecrets";

export type WorkflowAccessMode =
  | "owner_edit"
  | "owner_preview"
  | "buyer_preview"
  | "free_preview"
  | "anonymous_demo_allowed"
  | "deny";

type WorkflowSecurityRow = {
  id: string;
  owner_id: string;
  is_public: boolean | null;
  is_published: boolean | null;
  is_paid: boolean | null;
  monetisation_mode: string | null;
  removed_at: string | null;
};

export type WorkflowAccessDecision = {
  ok: boolean;
  mode: WorkflowAccessMode;
  message?: string;
  isOwner: boolean;
  workflow: WorkflowSecurityRow | null;
};

export function isAnonymousWorkflowDemoEligibleMode(mode: WorkflowAccessMode) {
  return mode === "anonymous_demo_allowed" || mode === "free_preview";
}

export function isWorkflowNaturallyFree(row: {
  is_paid?: boolean | null;
  monetisation_mode?: string | null;
}) {
  return row.monetisation_mode === "free" || row.is_paid === false;
}

export async function resolveWorkflowAccessDecision(params: {
  workflowId: string;
  userId?: string | null;
  requestedMode?: "edit" | "preview" | null;
}): Promise<WorkflowAccessDecision> {
  const { workflowId, userId, requestedMode } = params;
  const supabase = createSupabaseAdminClient();

  const { data: wf, error } = await supabase
    .from("workflows")
    .select("id, owner_id, is_public, is_published, is_paid, monetisation_mode, removed_at")
    .eq("id", workflowId)
    .maybeSingle();

  if (error) {
    console.error("[workflow-security] workflow fetch failed", error);
    return {
      ok: false,
      mode: "deny",
      message: "Unable to verify workflow access.",
      isOwner: false,
      workflow: null,
    };
  }

  if (!wf) {
    return {
      ok: false,
      mode: "deny",
      message: "Workflow not found.",
      isOwner: false,
      workflow: null,
    };
  }

  const row = wf as WorkflowSecurityRow;
  const isOwner = Boolean(userId) && String(row.owner_id) === String(userId);

  if (row.removed_at != null) {
    return {
      ok: false,
      mode: "deny",
      message: "This workflow is no longer available.",
      isOwner,
      workflow: row,
    };
  }

  if (row.is_public === false && !isOwner) {
    return {
      ok: false,
      mode: "deny",
      message: "This workflow is private.",
      isOwner,
      workflow: row,
    };
  }

  if (isOwner) {
    return {
      ok: true,
      mode: requestedMode === "preview" ? "owner_preview" : "owner_edit",
      isOwner: true,
      workflow: row,
    };
  }

  if (row.is_published === false) {
    return {
      ok: false,
      mode: "deny",
      message: "This workflow is not published.",
      isOwner: false,
      workflow: row,
    };
  }

  if (isWorkflowNaturallyFree(row)) {
    return {
      ok: true,
      mode: "free_preview",
      isOwner: false,
      workflow: row,
    };
  }

  if (!userId) {
    return {
      ok: true,
      mode: "anonymous_demo_allowed",
      isOwner: false,
      workflow: row,
    };
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("workflow_purchases")
    .select("id, status, refunded_at")
    .eq("workflow_id", workflowId)
    .eq("buyer_id", userId)
    .maybeSingle();

  if (purchaseError) {
    console.error("[workflow-security] purchase fetch failed", purchaseError);
    return {
      ok: false,
      mode: "deny",
      message: "Unable to verify workflow access.",
      isOwner: false,
      workflow: row,
    };
  }

  const hasPaidPurchase =
    Boolean(purchase) &&
    (purchase as { status?: string }).status === "paid" &&
    (purchase as { refunded_at?: string | null }).refunded_at == null;

  if (!hasPaidPurchase) {
    return {
      ok: false,
      mode: "deny",
      message: "Purchase this workflow to run it, or try the one-time demo.",
      isOwner: false,
      workflow: row,
    };
  }

  return {
    ok: true,
    mode: "buyer_preview",
    isOwner: false,
    workflow: row,
  };
}

type PreviewNode = {
  id?: unknown;
  type?: unknown;
  position?: unknown;
  positionAbsolute?: unknown;
  width?: unknown;
  height?: unknown;
  selected?: unknown;
  dragging?: unknown;
  data?: {
    specId?: unknown;
    title?: unknown;
    subtitle?: unknown;
    description?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function sanitizeDemoInputConfig(config: unknown): Record<string, unknown> | undefined {
  if (config == null || typeof config !== "object" || Array.isArray(config)) return undefined;
  const raw = config as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  const scalarKeys = [
    "question",
    "description",
    "helpText",
    "inputType",
    "placeholder",
    "defaultValue",
    "label",
    "inputKey",
    "name",
    "nickname",
    "required",
  ] as const;

  for (const key of scalarKeys) {
    const value = raw[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  const rawOptions = raw.options ?? raw.dropdownOptions ?? raw.dropdown;
  if (Array.isArray(rawOptions)) {
    const options: Array<string | { label?: string; value?: string }> = [];
    for (const item of rawOptions) {
      if (typeof item === "string") {
        if (item.trim()) options.push(item);
        continue;
      }
      if (item == null || typeof item !== "object" || Array.isArray(item)) continue;

      const option = item as Record<string, unknown>;
      const label = typeof option.label === "string" ? option.label : undefined;
      const value =
        typeof option.value === "string"
          ? option.value
          : typeof option.id === "string"
            ? option.id
            : undefined;

      if (!label && !value) continue;
      options.push({
        ...(label ? { label } : {}),
        ...(value ? { value } : {}),
      });
    }

    if (options.length > 0) {
      sanitized.options = options;
    }
  } else if (typeof rawOptions === "string" && rawOptions.trim()) {
    sanitized.options = rawOptions;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeWorkflowGraphForClient(
  graph: { nodes?: unknown[]; edges?: unknown[] },
  purpose: "preview" | "demo_input_collection",
) {
  const secretStripped = stripGraphSecrets(graph) as { nodes?: unknown[]; edges?: unknown[] };
  const nodes = Array.isArray(secretStripped.nodes) ? secretStripped.nodes : [];
  const edges = Array.isArray(secretStripped.edges) ? secretStripped.edges : [];

  return {
    nodes: nodes.map((node) => {
      const raw = (node ?? {}) as PreviewNode;
      return {
        id: raw.id,
        type: raw.type,
        position: raw.position,
        positionAbsolute: raw.positionAbsolute,
        width: raw.width,
        height: raw.height,
        selected: raw.selected,
        dragging: raw.dragging,
        data: {
          specId: raw.data?.specId,
          title: raw.data?.title,
          subtitle: raw.data?.subtitle,
          description: raw.data?.description,
          ...(purpose === "demo_input_collection" && raw.data?.specId === "input"
            ? { config: sanitizeDemoInputConfig(raw.data?.config) }
            : {}),
        },
      };
    }),
    edges,
  };
}
