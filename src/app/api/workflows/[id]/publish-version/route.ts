import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { createWorkflowVersion, setWorkflowActiveVersion } from "@lib/supabase/workflow-versions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const { id: workflowId } = await params;
    const body = await req.json();
    const { graph } = body as { graph?: { nodes: unknown[]; edges: unknown[] } };

    if (!graph?.nodes || !Array.isArray(graph.nodes)) {
      return NextResponse.json({ error: "Invalid graph" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: wf, error: wfError } = await supabase
      .from("workflows")
      .select("id, owner_id, user_id")
      .eq("id", workflowId)
      .maybeSingle();

    if (wfError || !wf) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const ownerId = (wf as { owner_id?: string; user_id?: string }).owner_id ?? (wf as { user_id?: string }).user_id;
    if (String(ownerId) !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const version = await createWorkflowVersion(workflowId, {
      nodes: graph.nodes,
      edges: Array.isArray(graph.edges) ? graph.edges : [],
    });
    await setWorkflowActiveVersion(workflowId, version.id);

    return NextResponse.json({ versionId: version.id, versionHash: version.version_hash });
  } catch (e: unknown) {
    console.error("[publish-version]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to publish version" }, { status: 500 });
  }
}
