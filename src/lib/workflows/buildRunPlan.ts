export type RunPlanStep = {
    id: string;
    title: string;
    detail?: string;
  };
  
  function safeStr(v: any) {
    return typeof v === "string" ? v : "";
  }
  
  function niceNameFromNode(n: any): string {
    const data = n?.data ?? {};
    return (
      safeStr(data.title) ||
      safeStr(data.label) ||
      safeStr(data.name) ||
      safeStr(data.specName) ||
      safeStr(data.specId) ||
      "Step"
    );
  }
  
  export function buildRunPlanFromGraph(graph: { nodes?: any[]; edges?: any[] }) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  
    // naive ordering for foundation:
    // - prefer any nodes that look like "input" first, "output" last
    // - otherwise keep stable insertion order
    const score = (n: any) => {
      const t = (niceNameFromNode(n) || "").toLowerCase();
      if (t.includes("input")) return 0;
      if (t.includes("prompt")) return 2;
      if (t.includes("llm") || t.includes("model")) return 3;
      if (t.includes("merge")) return 4;
      if (t.includes("output")) return 9;
      return 5;
    };
  
    const ordered = [...nodes].sort((a, b) => score(a) - score(b));
  
    const steps: RunPlanStep[] = ordered.map((n, idx) => {
      const title = niceNameFromNode(n);
      const hasIn = edges.some((e) => e?.target === n?.id);
      const hasOut = edges.some((e) => e?.source === n?.id);
  
      let detail = "";
      if (!hasIn && hasOut) detail = "Starting point";
      else if (hasIn && !hasOut) detail = "Final result";
      else if (hasIn && hasOut) detail = "Processing";
      else detail = "Isolated step (no connections)";
  
      return {
        id: String(n?.id ?? `step_${idx}`),
        title: title || `Step ${idx + 1}`,
        detail,
      };
    });
  
    return { steps };
  }
  