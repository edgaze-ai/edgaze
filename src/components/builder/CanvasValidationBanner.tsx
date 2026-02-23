"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  Wrench,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { ValidationResult, ValidationIssue } from "../../lib/workflow/validation";

function IssueRow({
  issue,
  isError,
  onFocusNode,
  onExpand,
}: {
  issue: ValidationIssue;
  isError: boolean;
  onFocusNode?: (nodeId: string, fieldHint?: string) => void;
  onExpand: () => void;
}) {
  const canFocus = issue.nodeId && onFocusNode;
  return (
    <div
      role={canFocus ? "button" : undefined}
      tabIndex={canFocus ? 0 : undefined}
      onClick={
        canFocus
          ? () => {
              onFocusNode(issue.nodeId!, issue.fieldHint);
              onExpand();
            }
          : undefined
      }
      onKeyDown={
        canFocus
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFocusNode(issue.nodeId!, issue.fieldHint);
                onExpand();
              }
            }
          : undefined
      }
      className={`text-[12px] leading-relaxed rounded-lg px-3 py-2 flex flex-col gap-1 ${
        canFocus ? "cursor-pointer hover:opacity-95 transition-opacity" : ""
      }`}
      style={{
        background: isError ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.06)",
        border: `1px solid ${isError ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.15)"}`,
        color: isError ? "#f0a0a0" : "#d4b86a",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex-1 min-w-0">{issue.message}</span>
        {canFocus && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium opacity-80">
            Fix <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
      {issue.fixGuidance && (
        <div className="text-[10px] opacity-85" style={{ color: "inherit" }}>
          → {issue.fixGuidance}
        </div>
      )}
    </div>
  );
}

export default function CanvasValidationBanner({
  validation,
  onFocusNode,
  onHide,
}: {
  validation: ValidationResult;
  onFocusNode?: (nodeId: string, fieldHint?: string) => void;
  onHide?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;
  if (!hasErrors && !hasWarnings) return null;

  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;
  const total = errorCount + warningCount;
  const label =
    total === 1 ? "1 issue" : `${total} issues`;

  const handleCollapse = () => {
    setExpanded(false);
    onHide?.();
  };

  const glass = {
    background: "rgba(10, 10, 12, 0.75)",
    backdropFilter: "blur(20px) saturate(160%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow:
      "0 0 0 1px rgba(0,0,0,0.3), 0 20px 50px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)",
  };

  return (
    <div className="relative flex flex-col items-end">
      {/* Expanded panel - grows upward */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mb-2 w-[min(400px,92vw)] rounded-2xl overflow-hidden"
            style={glass}
          >
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: hasErrors
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(245,158,11,0.15)",
                  border: `1px solid ${hasErrors ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                }}
              >
                <Wrench
                  className="h-4 w-4"
                  style={{ color: hasErrors ? "#ef4444" : "#f59e0b" }}
                />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">
                  Fix workflow issues
                </div>
                <div className="text-[11px]" style={{ color: "#888" }}>
                  I’ll help you fix these {total} issue{total === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {validation.errors.map((issue: ValidationIssue, i: number) => (
                <IssueRow
                  key={`e-${i}`}
                  issue={issue}
                  isError
                  onFocusNode={onFocusNode}
                  onExpand={() => setExpanded(false)}
                />
              ))}
              {validation.warnings.map((issue: ValidationIssue, i: number) => (
                <IssueRow
                  key={`w-${i}`}
                  issue={issue}
                  isError={false}
                  onFocusNode={onFocusNode}
                  onExpand={() => setExpanded(false)}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                onClick={handleCollapse}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all ml-auto"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Collapse
              </button>
            </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pill trigger */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 rounded-full px-5 py-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={glass}
        aria-expanded={expanded}
      >
        <div
          className="flex items-center gap-2"
          style={{ color: hasErrors ? "#ef4444" : "#f59e0b" }}
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-[12px] font-medium">
            {expanded ? "Collapse" : label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {errorCount > 0 && (
            <span
              className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                background: "rgba(239,68,68,0.9)",
                color: "white",
              }}
            >
              {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span
              className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                background: "rgba(245,158,11,0.9)",
                color: "#1a1a1a",
              }}
            >
              {warningCount}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-white/50" />
        ) : (
          <ChevronUp className="h-4 w-4 text-white/50" />
        )}
      </button>
    </div>
  );
}
