import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export const runtime = "edge";
export const alt = "Edgaze workflow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE = "https://edgaze.ai";

function absoluteImageUrl(url: string | null | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u.startsWith("/") ? `${BASE}${u}` : `${BASE}/${u}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerHandle = searchParams.get("ownerHandle") ?? searchParams.get("owner");
  const edgazeCode = searchParams.get("edgazeCode") ?? searchParams.get("code");

  let title = "Workflow";
  let creatorName = "Creator";
  let priceLabel = "Free";
  let imageUrl: string | undefined;

  if (ownerHandle && edgazeCode) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("workflows")
        .select("title, owner_name, price_usd, is_paid, thumbnail_url, banner_url")
        .eq("owner_handle", ownerHandle)
        .eq("edgaze_code", edgazeCode)
        .eq("is_published", true)
        .maybeSingle();

      if (data) {
        const row = data as {
          title: string | null;
          owner_name: string | null;
          price_usd: number | null;
          is_paid: boolean | null;
          thumbnail_url: string | null;
          banner_url: string | null;
        };
        title = row.title?.trim() || title;
        creatorName = row.owner_name?.trim() || `@${ownerHandle}` || creatorName;
        if (row.is_paid && row.price_usd != null && row.price_usd > 0) {
          priceLabel = `$${Number(row.price_usd).toFixed(2)}`;
        }
        imageUrl = absoluteImageUrl(row.thumbnail_url) || absoluteImageUrl(row.banner_url);
      }
    } catch {
      // use defaults
    }
  }

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#0a0a0a",
        padding: "48px 56px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 600, color: "#22d3ee" }}>Edgaze</span>
        <span style={{ fontSize: 18, color: "rgba(255,255,255,0.7)" }}>{priceLabel}</span>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          gap: 16,
        }}
      >
        {imageUrl ? (
          <div
            style={{
              display: "flex",
              width: 280,
              height: 280,
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src={imageUrl}
              alt=""
              width={280}
              height={280}
              style={{ objectFit: "cover", width: 280, height: 280 }}
            />
          </div>
        ) : null}
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            maxWidth: 900,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 22, color: "rgba(255,255,255,0.6)" }}>by {creatorName}</div>
      </div>

      <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }}>
        Create, sell, and distribute AI products
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
