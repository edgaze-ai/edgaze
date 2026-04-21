import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveTrustedUrl } from "@/lib/security/url-policy";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const trustedSupabaseUrl = resolveTrustedUrl(supabaseUrl, {
    allowedProtocols: ["https:"],
    allowedHostnameSuffixes: [".supabase.co", ".supabase.in"],
    allowLocalhost: false,
    allowPrivateIpv4: false,
  });
  if (!trustedSupabaseUrl) {
    return NextResponse.json({ error: "Invalid Supabase URL" }, { status: 500 });
  }
  const edgeFunctionUrl = new URL(
    "/functions/v1/send-pending-payout-email",
    trustedSupabaseUrl,
  ).toString();

  const now = new Date();
  const reminders = [
    { emailType: "day_30" as const, daysSinceCreation: 30, daysRemaining: 60 },
    { emailType: "day_60" as const, daysSinceCreation: 60, daysRemaining: 30 },
    { emailType: "day_80" as const, daysSinceCreation: 80, daysRemaining: 10 },
  ];

  let totalSent = 0;

  for (const { emailType, daysSinceCreation, daysRemaining } of reminders) {
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - daysSinceCreation - 1);
    const toDate = new Date(now);
    toDate.setDate(toDate.getDate() - daysSinceCreation + 1);

    const { data: pendingCreators } = await supabase
      .from("creator_earnings")
      .select("creator_id, id, net_amount_cents, claim_deadline_at, created_at")
      .eq("status", "pending_claim")
      .gte("claim_deadline_at", now.toISOString())
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", toDate.toISOString());

    if (!pendingCreators || pendingCreators.length === 0) continue;

    const byCreator = new Map<
      string,
      { totalCents: number; earliestDeadline: string; earliestId: string }
    >();
    for (const row of pendingCreators) {
      const existing = byCreator.get(row.creator_id);
      const deadline = row.claim_deadline_at || "";
      if (!existing) {
        byCreator.set(row.creator_id, {
          totalCents: row.net_amount_cents || 0,
          earliestDeadline: deadline,
          earliestId: row.id,
        });
      } else {
        existing.totalCents += row.net_amount_cents || 0;
        if (deadline < existing.earliestDeadline) {
          existing.earliestDeadline = deadline;
          existing.earliestId = row.id;
        }
      }
    }

    for (const [creatorId, agg] of byCreator) {
      const { data: alreadySent } = await supabase
        .from("creator_pending_claim_email_log")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("email_type", emailType)
        .limit(1)
        .maybeSingle();

      if (alreadySent) continue;

      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("full_name, handle")
        .eq("id", creatorId)
        .single();

      const { data: authUser } = await supabase.auth.admin.getUserById(creatorId);
      const email = authUser?.user?.email;
      if (!email || !email.includes("@")) continue;

      const amountFormatted = `$${(agg.totalCents / 100).toFixed(2)}`;
      const deadlineDate = new Date(agg.earliestDeadline);
      const claimDeadlineFormatted = deadlineDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      try {
        const res = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(serviceRoleKey ? { Authorization: `Bearer ${serviceRoleKey}` } : {}),
          },
          body: JSON.stringify({
            email,
            full_name: creatorProfile?.full_name ?? null,
            handle: creatorProfile?.handle ?? null,
            amountCents: agg.totalCents,
            amountFormatted,
            daysRemaining,
            emailType,
            claimDeadlineFormatted,
          }),
        });
        if (res.ok) {
          await supabase.from("creator_pending_claim_email_log").insert({
            creator_id: creatorId,
            creator_earning_id: agg.earliestId,
            email_type: emailType,
          });
          totalSent++;
        }
      } catch (err) {
        console.error(`[CRON] pending-payout-reminders ${emailType} for ${creatorId}:`, err);
      }
    }
  }

  return NextResponse.json({ success: true, sentCount: totalSent });
}
