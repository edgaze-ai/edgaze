// Check database state for debugging
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.warn("[Check DB API] User:", user?.id);

    // Try to query creator_invites table directly
    const {
      data: invites,
      error: invitesError,
      count,
    } = await supabase
      .from("creator_invites")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(10);

    console.warn("[Check DB API] Query result:", {
      count,
      invitesLength: invites?.length,
      error: invitesError,
    });

    // If we can query it, the table exists!
    const tableExists = !invitesError || invitesError.code !== "PGRST204";

    return NextResponse.json({
      success: true,
      database_check: {
        table_exists: tableExists,
        total_invites: count || 0,
        invites:
          invites?.map((inv) => ({
            id: inv.id,
            creator_name: inv.creator_name,
            status: inv.status,
            has_raw_token: !!inv.raw_token,
            raw_token_length: inv.raw_token?.length || 0,
            created_at: inv.created_at,
          })) || [],
        query_error: invitesError?.message || null,
        query_code: invitesError?.code || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        stack: err.stack,
      },
      { status: 500 },
    );
  }
}
