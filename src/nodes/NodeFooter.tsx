"use client";

import { NODE_STYLES } from "./nodeStyles";

type NodeStatus = "idle" | "running" | "success" | "error";

type NodeFooterProps = {
  nodeId: string;
  status?: NodeStatus;
  executionTime?: number;
  errorMessage?: string;
};

function shortId(id: string): string {
  if (id.length <= 8) return id;
  return id.slice(0, 6);
}

export function NodeFooter({
  nodeId,
  status = "idle",
  executionTime,
  errorMessage,
}: NodeFooterProps) {
  const resultDisplay =
    status === "running"
      ? { text: "...", color: NODE_STYLES.status.running.bg }
      : status === "success" && typeof executionTime === "number"
        ? { text: `✓ ${executionTime}ms`, color: NODE_STYLES.status.success.bg }
        : status === "error"
          ? { text: "✗ Error", color: NODE_STYLES.status.error.bg }
          : { text: "—", color: NODE_STYLES.footer.idColor };

  return (
    <div
      className="flex flex-row items-center justify-between"
      style={{
        height: NODE_STYLES.footer.height,
        background: NODE_STYLES.footer.background,
        borderTop: NODE_STYLES.footer.borderTop,
        borderBottomLeftRadius: NODE_STYLES.wrapper.borderRadius,
        borderBottomRightRadius: NODE_STYLES.wrapper.borderRadius,
        padding: NODE_STYLES.footer.padding,
      }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: NODE_STYLES.footer.idFontSize,
          color: NODE_STYLES.footer.idColor,
        }}
      >
        #{shortId(nodeId)}
      </span>
      <span
        className={
          status === "running"
            ? "animate-pulse"
            : ""
        }
        style={{
          fontSize: NODE_STYLES.footer.resultFontSize,
          color: resultDisplay.color,
        }}
      >
        {resultDisplay.text}
      </span>
    </div>
  );
}
