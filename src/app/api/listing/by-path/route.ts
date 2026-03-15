/**
 * Public listing by path — for sign-in-to-buy and other surfaces.
 * GET /api/listing/by-path?path=/p/owner/code or path=/owner/code
 * Returns minimal public fields: title, description, thumbnail_url, price_usd, owner_handle, edgaze_code, type.
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parsePath(
  path: string,
): { ownerHandle: string; edgazeCode: string; source: "prompts" | "workflows" } | null {
  const trimmed = (path || "").trim().replace(/^\s*\/+|\/+$/g, "");
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length >= 2) {
    if (segments[0] === "p") {
      return {
        ownerHandle: decodeURIComponent(segments[1] ?? ""),
        edgazeCode: decodeURIComponent(segments[2] ?? ""),
        source: "prompts",
      };
    }
    return {
      ownerHandle: decodeURIComponent(segments[0] ?? ""),
      edgazeCode: decodeURIComponent(segments[1] ?? ""),
      source: "workflows",
    };
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const parsed = parsePath(path);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (parsed.source === "prompts") {
      const baseQuery = () =>
        supabase
          .from("prompts")
          .select(
            "id, title, description, thumbnail_url, price_usd, owner_handle, owner_name, edgaze_code, type",
          )
          .eq("owner_handle", parsed.ownerHandle)
          .eq("edgaze_code", parsed.edgazeCode)
          .is("removed_at", null);

      const { data: dataWithVisibility, error: errWithVisibility } = await baseQuery()
        .in("visibility", ["public", "unlisted"])
        .maybeSingle();

      let data = dataWithVisibility;
      let error = errWithVisibility;
      if ((error || !data) && parsed.ownerHandle && parsed.edgazeCode) {
        const fallback = await baseQuery().maybeSingle();
        if (!fallback.error && fallback.data) {
          data = fallback.data;
          error = null;
        }
      }

      if (error || !data) {
        return NextResponse.json({ listing: null }, { status: 200 });
      }

      return NextResponse.json({
        listing: {
          id: data.id,
          title: data.title ?? "",
          description: data.description ?? null,
          thumbnail_url: data.thumbnail_url ?? null,
          price_usd: data.price_usd ?? null,
          owner_handle: data.owner_handle ?? parsed.ownerHandle,
          owner_name: (data as { owner_name?: string | null }).owner_name ?? null,
          edgaze_code: data.edgaze_code ?? parsed.edgazeCode,
          type: data.type === "workflow" ? "workflow" : "prompt",
        },
      });
    }

    const { data, error } = await supabase
      .from("workflows")
      .select(
        "id, title, description, thumbnail_url, price_usd, owner_handle, owner_name, edgaze_code",
      )
      .eq("owner_handle", parsed.ownerHandle)
      .eq("edgaze_code", parsed.edgazeCode)
      .eq("is_published", true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ listing: null }, { status: 200 });
    }

    return NextResponse.json({
      listing: {
        id: data.id,
        title: data.title ?? "",
        description: data.description ?? null,
        thumbnail_url: data.thumbnail_url ?? null,
        price_usd: data.price_usd ?? null,
        owner_handle: data.owner_handle ?? parsed.ownerHandle,
        owner_name: (data as { owner_name?: string | null }).owner_name ?? null,
        edgaze_code: data.edgaze_code ?? parsed.edgazeCode,
        type: "workflow",
      },
    });
  } catch (e) {
    console.error("[listing/by-path]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
