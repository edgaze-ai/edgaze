/**
 * Strip secrets from workflow graph before persisting to DB.
 * Removes node.data.config.apiKey and other secret-like fields so they are never stored.
 */

const SECRET_CONFIG_KEYS = ["apiKey", "api_key", "secret", "token"] as const;

function stripConfig(config: unknown): unknown {
  if (config == null || typeof config !== "object") return config;
  const out = Array.isArray(config) ? [...config] : { ...(config as Record<string, unknown>) };
  if (!Array.isArray(out) && typeof out === "object") {
    const obj = out as Record<string, unknown>;
    for (const key of SECRET_CONFIG_KEYS) {
      if (key in obj) delete obj[key];
    }
  }
  return out;
}

/**
 * Returns a deep copy of the graph with apiKey and other secrets removed from every node's data.config.
 * Does not mutate the input.
 */
export function stripGraphSecrets(graph: unknown): unknown {
  if (graph == null) return graph;
  if (typeof graph !== "object") return graph;
  const g = graph as { nodes?: unknown[]; edges?: unknown[] };
  const nodes = g.nodes;
  if (!Array.isArray(nodes)) return graph;
  const out = { ...g, nodes: nodes.map((node) => {
    if (node == null || typeof node !== "object") return node;
    const n = node as Record<string, unknown>;
    const data = n.data;
    if (data == null || typeof data !== "object") return node;
    const d = data as Record<string, unknown>;
    const config = d.config;
    if (config == null || typeof config !== "object") return node;
    return { ...n, data: { ...d, config: stripConfig(config) } };
  }), edges: Array.isArray(g.edges) ? g.edges : [] };
  return out;
}
