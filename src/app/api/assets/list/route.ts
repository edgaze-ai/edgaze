// src/app/api/assets/list/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const BUCKET = "edgaze-assets";

async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route handlers can throw if headers already sent; safe to ignore.
          }
        },
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await supabaseServer();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json(
        { error: "Not authenticated", assets: [] },
        { status: 401 }
      );
    }

    const userId = auth.user.id;

    const { data, error } = await supabase
      .from("assets")
      .select("id, path, mime_type, size_bytes, created_at")
      .eq("bucket", BUCKET)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error listing assets:", error);
      return NextResponse.json(
        { error: "Failed to list assets", assets: [] },
        { status: 500 }
      );
    }

    const assets =
      data?.map((row) => {
        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(row.path);

        return {
          id: row.id,
          publicUrl: publicData.publicUrl,
          filename: row.path.split("/").slice(-1)[0],
          sizeBytes: row.size_bytes,
          createdAt: row.created_at,
        };
      }) ?? [];

    return NextResponse.json({ assets });
  } catch (err) {
    console.error("Unexpected list error:", err);
    return NextResponse.json(
      { error: "Unexpected error listing assets", assets: [] },
      { status: 500 }
    );
  }
}
