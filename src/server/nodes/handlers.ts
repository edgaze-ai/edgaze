import type { GraphNode, NodeRuntimeHandler, RuntimeContext } from "../flow/types";

const inputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const external = ctx.inputs?.[node.id];
  if (external !== undefined) {
    ctx.setNodeOutput(node.id, external);
    return external;
  }
  const value =
    node.data?.config?.value ??
    node.data?.config?.text ??
    node.data?.config ??
    "";
  ctx.setNodeOutput(node.id, value);
  return value;
};

const mergeHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const inbound = ctx.getInboundValues(node.id);
  const first = inbound.find((v) => v !== null && v !== undefined && `${v}`.trim() !== "");
  const value =
    first !== undefined
      ? first
      : inbound.every((v) => typeof v === "string")
      ? (inbound as string[]).join(" ")
      : inbound;
  ctx.setNodeOutput(node.id, value);
  return value;
};

const outputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const inbound = ctx.getInboundValues(node.id);
  const value = inbound.length <= 1 ? inbound[0] : inbound;
  ctx.setNodeOutput(node.id, value);
  return value;
};

export const runtimeRegistry: Record<string, NodeRuntimeHandler> = {
  input: inputHandler,
  merge: mergeHandler,
  output: outputHandler,
};
