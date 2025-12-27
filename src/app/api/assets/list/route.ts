// src/app/api/assets/list/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

const BUCKET = "edgaze-assets";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("assets")
      .select("id, path, mime_type, size_bytes, created_at")
      .eq("bucket", BUCKET)
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
