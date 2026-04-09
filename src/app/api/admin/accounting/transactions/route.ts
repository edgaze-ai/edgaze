import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GMV_SUM_PAGE_SIZE = 2000;

/** Paid GMV (sum of amount_cents) without PostgREST aggregates — some projects disable `select(col.sum())`. */
async function sumPaidMarketplaceGmvCents(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: "workflow_purchases" | "prompt_purchases",
): Promise<number> {
  let offset = 0;
  let total = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select("amount_cents")
      .not("stripe_payment_intent_id", "is", null)
      .eq("status", "paid")
      .is("refunded_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + GMV_SUM_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      total += Number(row.amount_cents ?? 0);
    }
    if (rows.length < GMV_SUM_PAGE_SIZE) break;
    offset += GMV_SUM_PAGE_SIZE;
  }
  return total;
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limitRaw = parseInt(url.searchParams.get("limit") || "40", 10) || 40;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const offset = (page - 1) * limit;
    const purchaseType = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    let pFrom: string | null = null;
    let pTo: string | null = null;
    if (fromParam) {
      const d = new Date(fromParam);
      if (!Number.isNaN(d.getTime())) pFrom = d.toISOString();
    }
    if (toParam) {
      const d = new Date(toParam);
      if (!Number.isNaN(d.getTime())) pTo = d.toISOString();
    }

    const pPurchaseType =
      purchaseType === "workflow" || purchaseType === "prompt" ? purchaseType : null;
    const pStatus =
      status === "paid" || status === "refunded" || status === "disputed" ? status : null;

    const admin = createSupabaseAdminClient();

    const marketplacePurchaseOr = [
      "stripe_payment_intent_id.not.is.null",
      "stripe_checkout_session_id.not.is.null",
      "and(amount_cents.gt.0,status.in.(paid,refunded,disputed))",
    ].join(",");

    const wfCountQuery = () => {
      let q = admin
        .from("workflow_purchases")
        .select("*", { count: "exact", head: true })
        .or(marketplacePurchaseOr);
      if (pStatus) q = q.eq("status", pStatus);
      if (pFrom) q = q.gte("created_at", pFrom);
      if (pTo) q = q.lte("created_at", pTo);
      return q;
    };
    const prCountQuery = () => {
      let q = admin
        .from("prompt_purchases")
        .select("*", { count: "exact", head: true })
        .or(marketplacePurchaseOr);
      if (pStatus) q = q.eq("status", pStatus);
      if (pFrom) q = q.gte("created_at", pFrom);
      if (pTo) q = q.lte("created_at", pTo);
      return q;
    };

    let totalCount = 0;
    if (!pPurchaseType) {
      const [wf, pr] = await Promise.all([wfCountQuery(), prCountQuery()]);
      totalCount = (wf.count || 0) + (pr.count || 0);
    } else if (pPurchaseType === "workflow") {
      const wf = await wfCountQuery();
      totalCount = wf.count || 0;
    } else {
      const pr = await prCountQuery();
      totalCount = pr.count || 0;
    }

    // Inline stats (same rules as admin_marketplace_stats migration). GMV is summed in JS
    // because PostgREST may reject aggregate selects ("Use of aggregate functions is not allowed").
    const [wfSalesRes, prSalesRes, rowsRes, paidWorkflowGmvCents, paidPromptGmvCents] =
      await Promise.all([
        admin
          .from("workflow_purchases")
          .select("*", { count: "exact", head: true })
          .not("stripe_payment_intent_id", "is", null),
        admin
          .from("prompt_purchases")
          .select("*", { count: "exact", head: true })
          .not("stripe_payment_intent_id", "is", null),
        admin.rpc("admin_marketplace_transactions_page", {
          p_limit: limit,
          p_offset: offset,
          p_purchase_type: pPurchaseType,
          p_status: pStatus,
          p_from: pFrom,
          p_to: pTo,
        }),
        sumPaidMarketplaceGmvCents(admin, "workflow_purchases"),
        sumPaidMarketplaceGmvCents(admin, "prompt_purchases"),
      ]);

    const statsErr = wfSalesRes.error || prSalesRes.error || rowsRes.error;
    if (statsErr) {
      console.error("[admin/accounting/transactions]", statsErr);
      return NextResponse.json({ error: statsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      stats: {
        workflowSalesTotal: wfSalesRes.count ?? 0,
        promptSalesTotal: prSalesRes.count ?? 0,
        paidWorkflowGmvCents,
        paidPromptGmvCents,
      },
      transactions: rowsRes.data ?? [],
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    });
  } catch (e: unknown) {
    console.error("[admin/accounting/transactions]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load transactions" },
      { status: 500 },
    );
  }
}
