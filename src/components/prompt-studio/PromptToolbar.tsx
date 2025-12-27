"use client";

import React from "react";
import { Plus, Code2, Play, Save } from "lucide-react";

type Props = {
  onInsertPlaceholder: () => void;
  onMakeJson: () => void;
  onTestPrompt: () => void;
  onSaveVersion: () => void;
};

export default function PromptToolbar({
  onInsertPlaceholder,
  onMakeJson,
  onTestPrompt,
  onSaveVersion,
}: Props) {
  return (
    <div className="border-b border-white/10 bg-black/70 px-4 py-2.5">
      <div className="flex items-center gap-3">
        {/* Insert placeholder – main green CTA */}
        <button
          type="button"
          onClick={onInsertPlaceholder}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-lime-400 to-emerald-500 px-3.5 text-[11px] font-semibold text-black shadow-[0_0_18px_rgba(16,185,129,0.7)] hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          <span>Insert placeholder</span>
        </button>

        {/* Square control buttons */}
        <div className="flex items-center gap-2">
          <ToolbarButton onClick={onMakeJson} icon={Code2} label="Make JSON" />
          <ToolbarButton onClick={onTestPrompt} icon={Play} label="Test prompt" />
          <ToolbarButton onClick={onSaveVersion} icon={Save} label="Save version" />
        </div>
      </div>
    </div>
  );
}

type BtnProps = {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

function ToolbarButton({ onClick, icon: Icon, label }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/18 bg-white/[0.03] px-3 text-[11px] font-medium text-white/80 shadow-sm hover:border-cyan-400 hover:bg-white/[0.08] hover:text-white"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}