import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

    const [statsRes, rowsRes] = await Promise.all([
      admin.rpc("admin_marketplace_stats"),
      admin.rpc("admin_marketplace_transactions_page", {
        p_limit: limit,
        p_offset: offset,
        p_purchase_type: pPurchaseType,
        p_status: pStatus,
        p_from: pFrom,
        p_to: pTo,
      }),
    ]);

    if (statsRes.error) {
      console.error("[admin/accounting/transactions] stats", statsRes.error);
      return NextResponse.json({ error: statsRes.error.message }, { status: 500 });
    }
    if (rowsRes.error) {
      console.error("[admin/accounting/transactions] page", rowsRes.error);
      return NextResponse.json({ error: rowsRes.error.message }, { status: 500 });
    }

    const statsRow = (statsRes.data as unknown as Record<string, unknown>[])?.[0] as
      | {
          workflow_sales_total: number;
          prompt_sales_total: number;
          paid_workflow_gmv_cents: number;
          paid_prompt_gmv_cents: number;
        }
      | undefined;

    return NextResponse.json({
      stats: statsRow
        ? {
            workflowSalesTotal: Number(statsRow.workflow_sales_total),
            promptSalesTotal: Number(statsRow.prompt_sales_total),
            paidWorkflowGmvCents: Number(statsRow.paid_workflow_gmv_cents),
            paidPromptGmvCents: Number(statsRow.paid_prompt_gmv_cents),
          }
        : null,
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
