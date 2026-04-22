export type PurchaseTable = "prompt_purchases" | "workflow_purchases";

export type PurchaseRow = {
  id: string;
  status: string | null;
  refunded_at?: string | null;
  stripe_checkout_session_id?: string | null;
};

const PURCHASE_TABLES: PurchaseTable[] = ["prompt_purchases", "workflow_purchases"];

function resourceColumnForTable(table: PurchaseTable) {
  return table === "workflow_purchases" ? "workflow_id" : "prompt_id";
}

function orderedPurchaseTables(params: {
  preferredTable?: PurchaseTable | null;
  type?: string | null;
}) {
  const ordered: PurchaseTable[] = [];

  if (params.preferredTable) {
    ordered.push(params.preferredTable);
  } else if (params.type === "workflow") {
    ordered.push("workflow_purchases");
  } else if (params.type === "prompt") {
    ordered.push("prompt_purchases");
  }

  for (const table of PURCHASE_TABLES) {
    if (!ordered.includes(table)) {
      ordered.push(table);
    }
  }

  return ordered;
}

export async function findPurchaseForResource(params: {
  supabase: any;
  resourceId: string;
  buyerId: string;
  preferredTable?: PurchaseTable | null;
  type?: string | null;
}) {
  const { supabase, resourceId, buyerId, preferredTable, type } = params;
  let lastError: unknown = null;

  for (const table of orderedPurchaseTables({ preferredTable, type })) {
    const { data, error } = await supabase
      .from(table)
      .select("id, status, refunded_at, stripe_checkout_session_id")
      .eq(resourceColumnForTable(table), resourceId)
      .eq("buyer_id", buyerId)
      .maybeSingle();

    if (error) {
      lastError = error;
      continue;
    }

    if (data) {
      return {
        table,
        purchase: data as PurchaseRow,
        error: null,
      };
    }
  }

  return {
    table: null,
    purchase: null,
    error: lastError,
  };
}

export async function findAccessiblePurchaseForResource(params: {
  supabase: any;
  resourceId: string;
  buyerId: string;
  preferredTable?: PurchaseTable | null;
  type?: string | null;
  allowedStatuses?: string[];
}) {
  const { allowedStatuses = ["paid", "beta"] } = params;
  const result = await findPurchaseForResource(params);
  const purchase = result.purchase;

  if (!purchase) {
    return {
      ...result,
      accessible: false,
    };
  }

  const normalizedStatus = String(purchase.status ?? "").toLowerCase();
  const accessible = allowedStatuses.includes(normalizedStatus) && purchase.refunded_at == null;

  return {
    ...result,
    accessible,
  };
}
