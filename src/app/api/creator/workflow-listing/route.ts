import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripGraphSecrets } from "@/lib/workflow/stripGraphSecrets";
import { validateWorkflowPrice } from "@/lib/marketplace/pricing";
import { getMinimumWorkflowPrice } from "@/lib/workflow/cost-estimation";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";
import type { WorkflowGraph } from "@/lib/workflow/cost-estimation";

function normalizeEdgazeCode(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function slugify(input: string) {
  const base = (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `workflow-${suffix}`;
}

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall";

type Body = {
  workflowId: string;
  isEdit: boolean;
  title: string;
  description: string;
  tags: string[];
  visibility: Visibility;
  monetisationMode: MonetisationMode;
  priceUsd: number;
  edgazeCode: string;
  thumbnailUrl: string | null;
  demoUrls: string[];
  graph: WorkflowGraph | unknown;
  creatorTermsAccepted?: boolean;
};

async function codeTaken(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  code: string,
  excludeWorkflowId?: string,
) {
  const [{ data: wRows }, { data: pRows }] = await Promise.all([
    admin.from("workflows").select("id").eq("edgaze_code", code).limit(2),
    admin.from("prompts").select("id").eq("edgaze_code", code).limit(1),
  ]);
  const w = (wRows ?? []) as { id: string }[];
  const takenW = w.length > 0 && (!excludeWorkflowId || !w.some((r) => r.id === excludeWorkflowId));
  const takenP = (pRows ?? []).length > 0;
  return takenW || takenP;
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveActorContext(req, user);
    const ownerId = actor.effectiveProfileId;

    const body = (await req.json()) as Body;
    const workflowId = String(body.workflowId || "").trim();
    if (!workflowId) {
      return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: profileRow, error: profileErr } = await admin
      .from("profiles")
      .select("id,full_name,handle,can_receive_payments")
      .eq("id", ownerId)
      .maybeSingle();

    if (profileErr || !profileRow) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const ownerName = String((profileRow as { full_name?: string }).full_name || "Creator");
    const ownerHandle = String((profileRow as { handle?: string }).handle || "creator");
    const canReceivePayments = Boolean(
      (profileRow as { can_receive_payments?: boolean }).can_receive_payments,
    );

    const { data: existing } = await admin
      .from("workflows")
      .select("id,owner_id,published_at,edgaze_code")
      .eq("id", workflowId)
      .maybeSingle();

    const existingRow = existing as {
      id: string;
      owner_id: string;
      published_at: string | null;
      edgaze_code: string | null;
    } | null;

    if (existingRow && String(existingRow.owner_id) !== String(ownerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (body.isEdit && !existingRow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const title = String(body.title || "").trim() || "Untitled workflow";
    const description =
      String(body.description || "").trim() || "Short description of what this workflow does.";
    const tags = Array.isArray(body.tags)
      ? body.tags
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];
    const visibility = (body.visibility || "public") as Visibility;
    if (!["public", "unlisted", "private"].includes(visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }

    const monetisationMode = body.monetisationMode === "paywall" ? "paywall" : "free";
    const code = normalizeEdgazeCode(body.edgazeCode || "");
    if (!code) {
      return NextResponse.json({ error: "Invalid Edgaze code" }, { status: 400 });
    }

    if (await codeTaken(admin, code, workflowId)) {
      return NextResponse.json({ error: "That Edgaze code is already in use" }, { status: 409 });
    }

    const graph = body.graph as WorkflowGraph;
    const safeGraph = stripGraphSecrets(graph ?? { nodes: [], edges: [] }) as Record<
      string,
      unknown
    >;
    const minPrice = getMinimumWorkflowPrice(graph ?? null);

    let priceUsd = Number(body.priceUsd) || 0;
    if (monetisationMode === "free") {
      priceUsd = 0;
    } else {
      const termsOk = Boolean(body.creatorTermsAccepted);
      if (!canReceivePayments && !termsOk) {
        return NextResponse.json(
          { error: "Accept the Creator Terms to publish a paid workflow" },
          { status: 400 },
        );
      }
      const v = validateWorkflowPrice(priceUsd, minPrice);
      if (!v.valid) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
    }

    const slug = slugify(title);
    const thumbnailUrl =
      typeof body.thumbnailUrl === "string" && body.thumbnailUrl.trim()
        ? body.thumbnailUrl.trim()
        : null;
    const demoUrls = Array.isArray(body.demoUrls)
      ? body.demoUrls.filter((u): u is string => typeof u === "string" && !!u.trim()).slice(0, 12)
      : [];

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      id: workflowId,
      owner_id: ownerId,
      user_id: String(ownerId),
      owner_name: ownerName,
      owner_handle: ownerHandle,
      title,
      slug,
      description,
      tags: tags.length ? tags.join(",") : "",
      visibility,
      is_public: visibility !== "private",
      monetisation_mode: monetisationMode,
      is_paid: monetisationMode === "paywall",
      price_usd: priceUsd,
      thumbnail_url: thumbnailUrl,
      demo_images: demoUrls.length ? demoUrls : null,
      graph_json: safeGraph,
      graph: safeGraph,
      edgaze_code: code,
      is_published: true,
      updated_at: now,
    };

    if (existingRow?.published_at) {
      row.published_at = existingRow.published_at;
    } else {
      row.published_at = now;
    }

    const { error: upsertErr } = await admin.from("workflows").upsert(row, { onConflict: "id" });
    if (upsertErr) {
      console.error("[workflow-listing]", upsertErr);
      return NextResponse.json({ error: upsertErr.message || "Save failed" }, { status: 500 });
    }

    await logCreatorAuditEvent({
      action: "workflow.listing.upsert",
      actorUserId: actor.realUserId,
      actorRole: actor.adminRole,
      actorMode: actor.actorMode === "admin_impersonation" ? "admin_impersonation" : "creator_self",
      effectiveProfileId: actor.effectiveProfileId,
      impersonationSessionId: actor.impersonationSessionId ?? null,
      resourceType: "workflow",
      resourceId: workflowId,
      metadata: { edgaze_code: code, monetisation_mode: monetisationMode, is_edit: body.isEdit },
    });

    return NextResponse.json({
      ok: true,
      workflowId,
      edgazeCode: code,
      ownerHandle,
    });
  } catch (e: unknown) {
    console.error("[workflow-listing]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
