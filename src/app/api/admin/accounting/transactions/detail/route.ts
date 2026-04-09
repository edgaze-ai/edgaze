import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

type WorkflowPurchaseRow = {
  id: string;
  workflow_id: string;
  buyer_id: string;
  created_at: string;
  status: string;
  stripe_payment_intent_id: string | null;
  refunded_at: string | null;
};

type PromptPurchaseRow = {
  id: string;
  prompt_id: string;
  buyer_id: string;
  created_at: string;
  status: string;
  stripe_payment_intent_id: string | null;
  refunded_at: string | null;
};

function asExpandedCharge(ch: Stripe.Charge | string | null | undefined): Stripe.Charge | null {
  if (!ch || typeof ch === "string") return null;
  return ch;
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
    const paymentIntentIdParam = url.searchParams.get("paymentIntentId")?.trim() ?? "";
    const purchaseId = url.searchParams.get("purchaseId")?.trim() ?? "";
    const purchaseTypeParam = url.searchParams.get("purchaseType")?.trim() ?? "";

    const admin = createSupabaseAdminClient();

    let paymentIntentId = paymentIntentIdParam.startsWith("pi_") ? paymentIntentIdParam : null;

    let wfPurchase: WorkflowPurchaseRow | null = null;
    let prPurchase: PromptPurchaseRow | null = null;

    if (purchaseId && (purchaseTypeParam === "workflow" || purchaseTypeParam === "prompt")) {
      if (purchaseTypeParam === "workflow") {
        const { data } = await admin
          .from("workflow_purchases")
          .select(
            "id, workflow_id, buyer_id, created_at, status, stripe_payment_intent_id, refunded_at",
          )
          .eq("id", purchaseId)
          .maybeSingle();
        wfPurchase = data as WorkflowPurchaseRow | null;
      } else {
        const { data } = await admin
          .from("prompt_purchases")
          .select(
            "id, prompt_id, buyer_id, created_at, status, stripe_payment_intent_id, refunded_at",
          )
          .eq("id", purchaseId)
          .maybeSingle();
        prPurchase = data as PromptPurchaseRow | null;
      }
      const piFromRow =
        wfPurchase?.stripe_payment_intent_id ?? prPurchase?.stripe_payment_intent_id;
      if (piFromRow?.startsWith("pi_")) paymentIntentId = piFromRow;
    } else if (paymentIntentId) {
      const [wf, pr] = await Promise.all([
        admin
          .from("workflow_purchases")
          .select(
            "id, workflow_id, buyer_id, created_at, status, stripe_payment_intent_id, refunded_at",
          )
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle(),
        admin
          .from("prompt_purchases")
          .select(
            "id, prompt_id, buyer_id, created_at, status, stripe_payment_intent_id, refunded_at",
          )
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle(),
      ]);
      wfPurchase = wf.data as WorkflowPurchaseRow | null;
      prPurchase = pr.data as PromptPurchaseRow | null;
    }

    const purchaseMeta =
      wfPurchase != null
        ? {
            purchaseTable: "workflow_purchases" as const,
            purchaseId: wfPurchase.id as string,
            resourceId: wfPurchase.workflow_id as string,
            buyerId: wfPurchase.buyer_id as string,
            purchaseCreatedAt: wfPurchase.created_at as string,
            purchaseStatus: wfPurchase.status,
            buyerAccessActive:
              wfPurchase.status === "paid" &&
              (wfPurchase.refunded_at == null || wfPurchase.refunded_at === ""),
          }
        : prPurchase != null
          ? {
              purchaseTable: "prompt_purchases" as const,
              purchaseId: prPurchase.id as string,
              resourceId: prPurchase.prompt_id as string,
              buyerId: prPurchase.buyer_id as string,
              purchaseCreatedAt: prPurchase.created_at as string,
              purchaseStatus: prPurchase.status,
              buyerAccessActive:
                prPurchase.status === "paid" &&
                (prPurchase.refunded_at == null || prPurchase.refunded_at === ""),
            }
          : null;

    if (!purchaseMeta) {
      return NextResponse.json(
        {
          error:
            "Unknown purchase: provide paymentIntentId (pi_…) or purchaseId + purchaseType (workflow|prompt)",
        },
        { status: 404 },
      );
    }

    const resolvedPurchaseType: "workflow" | "prompt" = wfPurchase != null ? "workflow" : "prompt";

    const earningSelect =
      "id, creator_id, status, gross_amount_cents, platform_fee_cents, net_amount_cents, currency, stripe_account_id, stripe_transfer_id, claim_deadline_at, paid_at, refunded_at, created_at, purchase_type, purchase_id, stripe_payment_intent_id";

    let earning;
    if (paymentIntentId) {
      const { data } = await admin
        .from("creator_earnings")
        .select(earningSelect)
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();
      earning = data;
    } else {
      const { data } = await admin
        .from("creator_earnings")
        .select(earningSelect)
        .eq("purchase_id", purchaseMeta.purchaseId)
        .eq("purchase_type", resolvedPurchaseType)
        .maybeSingle();
      earning = data;
    }

    let emailLog: { email_type: string; sent_at: string }[] = [];
    if (earning?.id) {
      const { data: logs } = await admin
        .from("creator_pending_claim_email_log")
        .select("email_type, sent_at")
        .eq("creator_earning_id", earning.id)
        .order("sent_at", { ascending: true });
      emailLog = logs ?? [];
    }

    let payouts: Record<string, unknown>[] = [];
    if (earning?.creator_id && purchaseMeta) {
      const { data: p } = await admin
        .from("creator_payouts")
        .select(
          "id, stripe_payout_id, stripe_account_id, amount_cents, currency, status, arrival_date, paid_at, created_at, failure_code, failure_message",
        )
        .eq("creator_id", earning.creator_id)
        .gte("created_at", purchaseMeta.purchaseCreatedAt)
        .order("created_at", { ascending: false })
        .limit(30);
      payouts = p ?? [];
    }

    let stripeDetail: Record<string, unknown> | null = null;
    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge", "latest_charge.balance_transaction", "latest_charge.refunds"],
        });
        const ch = asExpandedCharge(pi.latest_charge);
        const chConnect = ch as
          | (Stripe.Charge & {
              destination?: string | Stripe.Account | null;
              dispute?: string | null;
            })
          | null;
        const bt =
          ch?.balance_transaction && typeof ch.balance_transaction !== "string"
            ? ch.balance_transaction
            : null;
        let transfer: Stripe.Transfer | null = null;
        const transferId =
          typeof ch?.transfer === "string"
            ? ch.transfer
            : ch?.transfer && typeof ch.transfer !== "string"
              ? ch.transfer.id
              : null;
        if (transferId) {
          try {
            transfer = await stripe.transfers.retrieve(transferId);
          } catch {
            transfer = null;
          }
        }

        stripeDetail = {
          paymentIntentId: pi.id,
          status: pi.status,
          amount: pi.amount,
          amountReceived: pi.amount_received,
          currency: pi.currency,
          applicationFeeAmount: pi.application_fee_amount,
          transferGroup: pi.transfer_group,
          onBehalfOf: pi.on_behalf_of,
          customer: pi.customer,
          receiptEmail: pi.receipt_email,
          description: pi.description,
          metadata: pi.metadata,
          charge: ch
            ? {
                id: ch.id,
                paid: ch.paid,
                refunded: ch.refunded,
                receiptUrl: ch.receipt_url,
                outcome: ch.outcome?.type,
                riskLevel: ch.outcome?.risk_level,
                failureCode: ch.failure_code,
                failureMessage: ch.failure_message,
                transferId: transferId ?? null,
                destination: chConnect?.destination ?? null,
                dispute: chConnect?.dispute ?? null,
              }
            : null,
          balanceTransaction: bt
            ? {
                id: bt.id,
                amount: bt.amount,
                fee: bt.fee,
                net: bt.net,
                currency: bt.currency,
                reportingCategory: bt.reporting_category,
                status: bt.status,
              }
            : null,
          transfer: transfer
            ? {
                id: transfer.id,
                amount: transfer.amount,
                currency: transfer.currency,
                destination: transfer.destination,
                reversed: transfer.reversed,
                sourceTransaction: transfer.source_transaction,
                created: transfer.created,
              }
            : null,
          refunds:
            ch?.refunds?.data?.map((r) => ({
              id: r.id,
              amount: r.amount,
              status: r.status,
              reason: r.reason,
            })) ?? [],
        };
      } catch (e) {
        console.error("[admin/accounting/detail] Stripe retrieve", e);
        stripeDetail = {
          error: e instanceof Error ? e.message : "Stripe retrieve failed",
        };
      }
    } else {
      stripeDetail = {
        skipped: "No PaymentIntent on file; Stripe live object not loaded.",
      };
    }

    return NextResponse.json({
      paymentIntentId: paymentIntentId ?? null,
      purchase: purchaseMeta,
      earning: earning ?? null,
      claimEmails: emailLog,
      payoutsSincePurchase: payouts,
      stripe: stripeDetail,
    });
  } catch (e: unknown) {
    console.error("[admin/accounting/transactions/detail]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load detail" },
      { status: 500 },
    );
  }
}
