import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../flow/_auth";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    // Auth: Bearer token only (client sends Authorization: Bearer <accessToken>)
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError ?? "Not authenticated" },
        { status: 401 }
      );
    }

    const reporterId = user.id;
    const supabase = createSupabaseAdminClient();

    const body = await req.json();
    const { target_type, target_id, reason, details } = body;

    // Validate input
    if (!target_type || !["prompt", "workflow", "comment", "user"].includes(target_type)) {
      return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
    }

    if (!target_id || typeof target_id !== "string") {
      return NextResponse.json({ error: "Invalid target_id" }, { status: 400 });
    }

    if (!reason || typeof reason !== "string") {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    // Check if user already reported this target (using admin client to bypass RLS)
    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", reporterId)
      .eq("target_type", target_type)
      .eq("target_id", target_id)
      .maybeSingle();

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this item" },
        { status: 409 }
      );
    }

    // Insert report
    const { data: report, error: insertError } = await supabase
      .from("reports")
      .insert({
        reporter_id: reporterId,
        target_type,
        target_id,
        reason,
        details: details || null,
        status: "open",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert report:", insertError);
      return NextResponse.json(
        { error: "Failed to submit report" },
        { status: 500 }
      );
    }

    // Check if this target now has 3+ reports and reduce visibility if needed
    // Only for prompts and workflows
    if (target_type === "prompt" || target_type === "workflow") {
      const { count } = await supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("target_type", target_type)
        .eq("target_id", target_id)
        .in("status", ["open", "triaged"]);

      if (count && count >= 3) {
        // Reduce visibility to "unlisted" (hide from marketplace but still accessible via direct link)
        const tableName = target_type === "prompt" ? "prompts" : "workflows";
        
        // Get current visibility
        const { data: currentItem } = await supabase
          .from(tableName)
          .select("visibility")
          .eq("id", target_id)
          .maybeSingle();

        // Only reduce if currently public
        if (currentItem?.visibility === "public") {
          await supabase
            .from(tableName)
            .update({ visibility: "unlisted" })
            .eq("id", target_id);
        }
      }
    }

    return NextResponse.json({ ok: true, report_id: report.id }, { status: 201 });
  } catch (err: any) {
    console.error("Unexpected report submission error:", err);
    return NextResponse.json(
      { error: "Unexpected error while submitting report" },
      { status: 500 }
    );
  }
}
