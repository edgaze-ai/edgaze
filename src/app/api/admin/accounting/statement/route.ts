import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TxRow = {
  created_at: string;
  purchase_type: string;
  resource_title: string | null;
  edgaze_code: string | null;
  creator_handle: string | null;
  buyer_handle: string | null;
  status: string;
  amount_cents: number | null;
  creator_net_cents: number | null;
  platform_fee_cents: number | null;
  stripe_payment_intent_id: string | null;
  connect_stripe_account_id: string | null;
  earning_status: string | null;
  first_sale_email_sent_at: string | null;
  buyer_access_active?: boolean | null;
  purchase_fulfilled_at?: string | null;
  funds_route?: string | null;
};

function fmtUsd(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function clip(s: string, n: number) {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function buildPdfBuffer(params: {
  rows: TxRow[];
  generatedAt: string;
  periodLabel: string;
  filtersLine: string;
  totals: { count: number; gross: number; net: number; fees: number };
}): Promise<Buffer> {
  const { rows, generatedAt, periodLabel, filtersLine, totals } = params;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      margin: 44,
      size: "LETTER",
      info: {
        Title: "Edgaze marketplace accounting statement",
        Author: "Edgaze",
      },
    });
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).fillColor("#111").text("Edgaze", { continued: false });
    doc.moveDown(0.25);
    doc.fontSize(11).fillColor("#444").text("Marketplace accounting statement", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#666");
    doc.text(`Generated: ${generatedAt}`);
    doc.text(`Period: ${periodLabel}`);
    doc.text(`Filters: ${filtersLine}`);
    doc.moveDown(0.75);

    doc.fontSize(10).fillColor("#111").text("Summary", { underline: true });
    doc.moveDown(0.35);
    doc.fontSize(9).fillColor("#333");
    doc.text(`Line items: ${totals.count}`);
    doc.text(`Gross charged: ${fmtUsd(totals.gross)}`);
    doc.text(`Platform fees (recorded): ${fmtUsd(totals.fees)}`);
    doc.text(`Creator net (recorded): ${fmtUsd(totals.net)}`);
    doc.moveDown(0.85);

    doc.fontSize(10).fillColor("#111").text("Transactions", { underline: true });
    doc.moveDown(0.4);

    const tableTop = doc.y;
    const col = {
      date: 44,
      party: 128,
      listing: 300,
      money: 430,
      access: 492,
    };
    const lh = 10;

    doc.fontSize(7).fillColor("#555");
    doc.text("When (UTC)", col.date, tableTop, { width: 78 });
    doc.text("Buyer → seller · access", col.party, tableTop, { width: 168 });
    doc.text("Listing", col.listing, tableTop, { width: 118 });
    doc.text("Gross / status", col.money, tableTop, { width: 54, align: "right" });
    doc.text("Funds / Connect", col.access, tableTop, { width: 74 });
    doc.moveDown(0.6);

    let y = doc.y;
    doc.fontSize(7).fillColor("#222");

    for (const r of rows) {
      if (y > 680) {
        doc.addPage();
        y = 44;
        doc.fontSize(7).fillColor("#222");
      }
      const dt = clip(
        new Date(r.created_at)
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d{3}Z$/, " UTC"),
        24,
      );
      const buyer = r.buyer_handle ? `@${r.buyer_handle}` : "—";
      const seller = r.creator_handle ? `@${r.creator_handle}` : "—";
      const access = r.buyer_access_active ? "access active" : "no access";
      const fulfill = r.purchase_fulfilled_at
        ? clip(new Date(r.purchase_fulfilled_at).toISOString(), 16)
        : "—";
      const title = clip(`${r.resource_title || "—"} (${r.edgaze_code || "—"})`, 36);
      const route = clip((r.funds_route || "—").replace(/_/g, " "), 14);
      const connect = r.connect_stripe_account_id ? clip(r.connect_stripe_account_id, 16) : "—";
      const emailFlag = r.first_sale_email_sent_at ? "claim✓" : "";

      doc.text(dt, col.date, y, { width: 78, lineBreak: false });
      doc.text(clip(`${buyer} → ${seller}`, 28), col.party, y, { width: 168 });
      doc.text(title, col.listing, y, { width: 118 });
      doc.text(`${fmtUsd(r.amount_cents)}  ${clip(r.status, 9)}`, col.money, y, {
        width: 54,
        align: "right",
      });
      doc.text(clip(`${route} / ${connect} ${emailFlag}`.trim(), 36), col.access, y, { width: 74 });
      y += lh + 2;
      doc
        .fillColor("#444")
        .text(`${clip(r.purchase_type, 9)}  ${access}  fulfilled ${fulfill}`, col.party, y, {
          width: 400,
        });
      doc.fillColor("#222");
      y += lh + 6;
    }

    doc.fontSize(7).fillColor("#888");
    doc.text(
      `Access = paid purchase row, not refunded (library / run entitlement). Use the admin panel for PaymentIntent detail and Stripe reconciliation.`,
      44,
      Math.min(y + 14, 740),
      { width: 520 },
    );

    doc.end();
  });
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
    const purchaseType = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const pPurchaseType =
      purchaseType === "workflow" || purchaseType === "prompt" ? purchaseType : null;
    const pStatus =
      status === "paid" || status === "refunded" || status === "disputed" ? status : null;

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
    const periodLabel =
      pFrom && pTo
        ? `${pFrom.slice(0, 10)} → ${pTo.slice(0, 10)}`
        : pFrom
          ? `From ${pFrom.slice(0, 10)}`
          : pTo
            ? `Through ${pTo.slice(0, 10)}`
            : "All time";

    const filtersLine = [
      pPurchaseType ? `type=${pPurchaseType}` : "type=all",
      pStatus ? `status=${pStatus}` : "status=all",
    ].join(", ");

    const admin = createSupabaseAdminClient();
    const { data: rowsRaw, error } = await admin.rpc("admin_marketplace_transactions_page", {
      p_limit: 5000,
      p_offset: 0,
      p_purchase_type: pPurchaseType,
      p_status: pStatus,
      p_from: pFrom,
      p_to: pTo,
    });

    if (error) {
      console.error("[admin/accounting/statement]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (rowsRaw || []) as TxRow[];
    let gross = 0;
    let net = 0;
    let fees = 0;
    for (const r of rows) {
      gross += r.amount_cents || 0;
      net += r.creator_net_cents || 0;
      fees += r.platform_fee_cents || 0;
    }

    const generatedAt = new Date()
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, " UTC");
    const buf = await buildPdfBuffer({
      rows,
      generatedAt,
      periodLabel,
      filtersLine,
      totals: { count: rows.length, gross, net, fees },
    });

    const fname = `edgaze-accounting-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    console.error("[admin/accounting/statement]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build PDF" },
      { status: 500 },
    );
  }
}
