import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canonicalizeAssetMime,
  resolveAssetMime,
  validateAssetFile,
} from "@/lib/asset-upload-validation";

const BUCKET = "workflow-media";

type ListingType = "workflow" | "prompt";
type Kind = "thumbnail" | "demo" | "qr";

function safeExt(originalName: string): string {
  const raw = (originalName.split(".").pop() || "png").toLowerCase();
  const clean = raw.replace(/[^a-z0-9]/g, "").slice(0, 6);
  return clean || "png";
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveActorContext(req, user);
    const ownerId = actor.effectiveProfileId;
    const admin = createSupabaseAdminClient();

    const form = await req.formData();
    const listingType = String(form.get("listingType") || "") as ListingType;
    const resourceId = String(form.get("resourceId") || "").trim();
    const kind = String(form.get("kind") || "") as Kind;
    const indexRaw = form.get("index");
    const index =
      typeof indexRaw === "string" && indexRaw !== "" ? Number.parseInt(indexRaw, 10) : undefined;

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
    }
    if (listingType !== "workflow" && listingType !== "prompt") {
      return NextResponse.json({ error: "Invalid listingType" }, { status: 400 });
    }
    if (kind !== "thumbnail" && kind !== "demo" && kind !== "qr") {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    if (kind === "demo" && (index === undefined || Number.isNaN(index) || index < 0)) {
      return NextResponse.json({ error: "demo requires index" }, { status: 400 });
    }

    if (listingType === "workflow") {
      const { data: wf } = await admin
        .from("workflows")
        .select("owner_id")
        .eq("id", resourceId)
        .maybeSingle();
      const row = wf as { owner_id?: string } | null;
      if (row && String(row.owner_id) !== String(ownerId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const { data: pr } = await admin
        .from("prompts")
        .select("owner_id")
        .eq("id", resourceId)
        .maybeSingle();
      const row = pr as { owner_id?: string } | null;
      if (row && String(row.owner_id) !== String(ownerId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const validationError = validateAssetFile(file, buf, { requireMagicMatchForImages: true });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const resolvedMime =
      canonicalizeAssetMime(resolveAssetMime(file, buf)) ||
      canonicalizeAssetMime(file.type) ||
      "application/octet-stream";
    const ext = resolvedMime.startsWith("image/")
      ? extensionForMime(resolvedMime)
      : safeExt(file.name);
    const filename =
      kind === "thumbnail"
        ? `thumbnail.${ext}`
        : kind === "qr"
          ? `edgaze-qr.${ext}`
          : `demo-${String(index ?? 0).padStart(2, "0")}.${ext}`;

    const path =
      listingType === "workflow"
        ? `${ownerId}/workflows/${resourceId}/${filename}`
        : `prompts/${ownerId}/${resourceId}/${filename}`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buf, {
      upsert: true,
      cacheControl: "3600",
      contentType: resolvedMime,
    });

    if (uploadError) {
      console.error("[listing-media/upload]", uploadError);
      const err = uploadError as { message?: string; error?: string };
      const msg =
        (typeof err.message === "string" && err.message.trim()) ||
        (typeof err.error === "string" && err.error.trim()) ||
        "Storage upload failed (check workflow-media bucket exists)";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl ?? "";

    return NextResponse.json({ ok: true, path, publicUrl });
  } catch (e: unknown) {
    console.error("[listing-media/upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
