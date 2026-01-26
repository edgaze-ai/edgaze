// src/app/api/admin/token-limits/route.ts
/**
 * Admin API for managing token limits
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@lib/supabase/server";
import { updateTokenLimits, getTokenLimits } from "@lib/workflow/token-limits";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is admin (you'll need to implement this check based on your auth system)
    // For now, we'll check a profile field or role
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, plan")
      .eq("id", auth.user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true || profile?.plan === "Team";

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const workflowId = url.searchParams.get("workflowId") || undefined;

    const limits = await getTokenLimits(workflowId);

    return NextResponse.json({ success: true, limits });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch token limits" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, plan")
      .eq("id", auth.user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true || profile?.plan === "Team";

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { maxTokensPerWorkflow, maxTokensPerNode, workflowId } = body;

    if (
      typeof maxTokensPerWorkflow !== "number" ||
      typeof maxTokensPerNode !== "number" ||
      maxTokensPerWorkflow < 0 ||
      maxTokensPerNode < 0
    ) {
      return NextResponse.json(
        { error: "Invalid token limit values" },
        { status: 400 }
      );
    }

    const result = await updateTokenLimits(
      {
        maxTokensPerWorkflow,
        maxTokensPerNode,
      },
      workflowId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update token limits" },
      { status: 500 }
    );
  }
}
