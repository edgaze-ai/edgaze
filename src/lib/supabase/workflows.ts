// src/lib/supabase/workflows.ts
"use client";

import { createClient } from "@supabase/supabase-js";
import { stripGraphSecrets } from "@lib/workflow/stripGraphSecrets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

type WorkflowRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  updated_at?: string | null;
  last_opened_at?: string | null;
  published_at?: string | null;
  graph?: any;
  graph_json?: any;
  canvas?: any;
  data?: any;
};

function pickTitle(r: WorkflowRow) {
  return (r.title ?? r.name ?? "Untitled Workflow") as string;
}

function pickGraph(r: WorkflowRow) {
  return r.graph ?? r.graph_json ?? r.canvas ?? r.data ?? { nodes: [], edges: [] };
}

function isMissingColumn(err: any) {
  const msg = String(err?.message || "");
  return msg.includes("does not exist") && msg.includes("column");
}

async function selectWithFallback(selects: string[]) {
  let lastErr: any = null;
  for (const sel of selects) {
    const q = supabase.from("workflows").select(sel);
    const res = await q;
    if (!res.error) return { data: ((res.data ?? []) as unknown) as WorkflowRow[] };
    lastErr = res.error;
    if (!isMissingColumn(res.error)) break;
  }
  throw lastErr || new Error("Query failed");
}

async function singleWithFallback(selects: string[], id: string) {
  let lastErr: any = null;
  for (const sel of selects) {
    const res = await supabase.from("workflows").select(sel).eq("id", id).single();
    if (!res.error) return { data: (res.data as unknown) as WorkflowRow };
    lastErr = res.error;
    if (!isMissingColumn(res.error)) break;
  }
  throw lastErr || new Error("Query failed");
}

async function updateWithFallback(id: string, patches: Record<string, any>[]) {
  let lastErr: any = null;
  for (const patch of patches) {
    const res = await supabase.from("workflows").update(patch).eq("id", id);
    if (!res.error) return;
    lastErr = res.error;
    if (!isMissingColumn(res.error)) break;
  }
  throw lastErr || new Error("Update failed");
}

export async function listMyRecentDraftWorkflows() {
  const { data } = await selectWithFallback([
    "id,title,updated_at,last_opened_at,published_at",
    "id,name,updated_at,last_opened_at,published_at",
    "id,title,updated_at,published_at",
    "id,name,updated_at,published_at",
    "id,title,updated_at",
    "id,name,updated_at",
  ]);

  const drafts = data.filter((r) => (typeof r.published_at === "string" ? !r.published_at : true));

  drafts.sort((a, b) => {
    const ta = new Date((a.last_opened_at || a.updated_at || 0) as any).getTime();
    const tb = new Date((b.last_opened_at || b.updated_at || 0) as any).getTime();
    return tb - ta;
  });

  return drafts.map((r) => ({
    id: r.id,
    title: pickTitle(r),
    updated_at: r.updated_at ?? null,
    last_opened_at: r.last_opened_at ?? null,
    published_at: r.published_at ?? null,
  }));
}

export async function listMyPublishedWorkflows() {
  const { data } = await selectWithFallback([
    "id,title,updated_at,published_at",
    "id,name,updated_at,published_at",
    "id,title,updated_at",
    "id,name,updated_at",
  ]);

  const published = data.filter((r) => typeof r.published_at === "string" && !!r.published_at);

  published.sort((a, b) => {
    const ta = new Date((a.published_at || a.updated_at || 0) as any).getTime();
    const tb = new Date((b.published_at || b.updated_at || 0) as any).getTime();
    return tb - ta;
  });

  return published.map((r) => ({
    id: r.id,
    title: pickTitle(r),
    updated_at: r.updated_at ?? null,
    published_at: r.published_at ?? null,
  }));
}

export async function getWorkflowById(id: string) {
  const { data } = await singleWithFallback(
    [
      "id,title,updated_at,last_opened_at,published_at,graph",
      "id,title,updated_at,last_opened_at,published_at,graph_json",
      "id,title,updated_at,last_opened_at,published_at,canvas",
      "id,title,updated_at,last_opened_at,published_at,data",
      "id,name,updated_at,last_opened_at,published_at,graph",
      "id,name,updated_at,last_opened_at,published_at,canvas",
      "id,name,updated_at,last_opened_at,published_at,data",
    ],
    id
  );

  return {
    id: data.id,
    title: pickTitle(data),
    updated_at: data.updated_at ?? null,
    last_opened_at: data.last_opened_at ?? null,
    published_at: data.published_at ?? null,
    graph: pickGraph(data),
  };
}

export async function createWorkflow(input: { title: string; graph: any }) {
  const safeGraph = stripGraphSecrets(input.graph) as any;
  const inserts: Record<string, any>[] = [
    { title: input.title, graph: safeGraph },
    { title: input.title, graph_json: safeGraph },
    { title: input.title, canvas: safeGraph },
    { title: input.title, data: safeGraph },
    { name: input.title, graph: safeGraph },
    { name: input.title, canvas: safeGraph },
    { name: input.title, data: safeGraph },
    { title: input.title },
    { name: input.title },
  ];

  let lastErr: any = null;

  for (const payload of inserts) {
    const res = await supabase.from("workflows").insert(payload).select("*").single();
    if (!res.error) {
      const r = res.data as WorkflowRow;
      return {
        id: r.id,
        title: pickTitle(r),
        graph: pickGraph(r),
      };
    }
    lastErr = res.error;
    if (!isMissingColumn(res.error)) break;
  }

  throw lastErr || new Error("Failed to create workflow");
}

export async function renameWorkflow(id: string, title: string) {
  await updateWithFallback(id, [{ title }, { name: title }]);
}

export async function touchWorkflowOpened(id: string) {
  const now = new Date().toISOString();
  try {
    await updateWithFallback(id, [{ last_opened_at: now }]);
  } catch (e: any) {
    if (isMissingColumn(e)) return;
    throw e;
  }
}

export async function updateWorkflowGraph(id: string, graph: any) {
  const safeGraph = stripGraphSecrets(graph) as any;
  await updateWithFallback(id, [{ graph: safeGraph }, { graph_json: safeGraph }, { canvas: safeGraph }, { data: safeGraph }]);
}
