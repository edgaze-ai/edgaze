"use client";

import React from "react";
import { Plus, Code2, Play, Save, Upload, Type, Hash } from "lucide-react";

type Props = {
  title: string;
  charCount: number;
  tokenEstimate: number;
  onInsertPlaceholder: () => void;
  onMakeJson: () => void;
  onTestPrompt: () => void;
  onSaveVersion: () => void;
  onPublish: () => void;
};

export default function PromptToolbar({
  title,
  charCount,
  tokenEstimate,
  onInsertPlaceholder,
  onMakeJson,
  onTestPrompt,
  onSaveVersion,
  onPublish,
}: Props) {
  return (
    <div className="bg-[#070708]">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Edgaze logo: NO backdrop/padding */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/edgaze-mark.png"
            alt="Edgaze"
            className="h-9 w-9 select-none"
            draggable={false}
          />

          <div className="min-w-0">
            <div className="text-sm font-semibold text-white/90 truncate">
              {title}
            </div>
            <div className="text-[11px] text-white/45 truncate">
              Write, version, and publish prompts with placeholders.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onPublish}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-2 text-[12px] font-semibold text-black shadow-[0_0_18px_rgba(56,189,248,0.18)] hover:brightness-110"
        >
          <Upload className="h-4 w-4" />
          Publish
        </button>
      </div>

      {/* Ribbon panel */}
      <div className="px-5 pb-4">
        <div className="rounded-3xl bg-[#111214] shadow-[0_18px_70px_rgba(0,0,0,0.70),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex flex-wrap items-center gap-2 px-3 py-3">
            <TileButton
              onClick={onInsertPlaceholder}
              icon={Plus}
              label="Placeholder"
              sub="Insert"
              accent
            />
            <TileButton onClick={onMakeJson} icon={Code2} label="JSON" sub="Copy" />
            <TileButton onClick={onTestPrompt} icon={Play} label="Test" sub="Runner" />
            <TileButton onClick={onSaveVersion} icon={Save} label="Version" sub="Save" />

            <div className="ml-2 hidden sm:flex items-center gap-2">
              <MetricTile icon={Type} label="Chars" value={`${charCount}`} />
              <MetricTile icon={Hash} label="Tokens" value={`~${tokenEstimate}`} />
            </div>

            <div className="ml-auto flex sm:hidden items-center gap-2 pr-1">
              <MiniMetric label="Chars" value={`${charCount}`} />
              <MiniMetric label="Tokens" value={`~${tokenEstimate}`} />
            </div>

            <div className="ml-auto hidden sm:block" />
          </div>
        </div>
      </div>
    </div>
  );
}

type TileProps = {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  accent?: boolean;
};

function TileButton({ onClick, icon: Icon, label, sub, accent }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex h-[66px] w-[96px] flex-col items-center justify-center rounded-2xl",
        "bg-[#17181b] shadow-[0_10px_30px_rgba(0,0,0,0.50),inset_0_1px_0_rgba(255,255,255,0.04)]",
        "hover:bg-[#1c1d21] transition",
        accent ? "ring-1 ring-cyan-400/14" : "ring-1 ring-white/5",
      ].join(" ")}
    >
      <Icon className="h-[18px] w-[18px] text-white/85 group-hover:text-white" />
      <div className="mt-1 text-[11px] font-semibold text-white/85 leading-none">
        {label}
      </div>
      <div className="mt-0.5 text-[10px] text-white/40 leading-none">{sub}</div>
    </button>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex h-[66px] w-[96px] flex-col items-center justify-center rounded-2xl bg-[#17181b] ring-1 ring-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.50),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <Icon className="h-[16px] w-[16px] text-white/60" />
      <div className="mt-1 text-[10px] text-white/40 leading-none">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold text-white/85 leading-none">
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#17181b] ring-1 ring-white/5 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[10px] text-white/40 leading-none">{label}</div>
      <div className="text-[12px] font-semibold text-white/85 leading-none">
        {value}
      </div>
    </div>
  );
}
