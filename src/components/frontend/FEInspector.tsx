"use client";

import { FESelection } from "./FECanvas";

export default function FEInspector({
  selection,
  block,
  onChange,
}: {
  selection: FESelection | null;
  block: any | null;
  onChange: (patch: any) => void;
}) {
  if (!selection?.id || !block) {
    return <p className="text-sm text-white/60">Select a block on the frontend canvas.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs text-white/60">Block ID: <span className="text-white/90">{selection.id}</span></div>
      {block.type === "text" && (
        <>
          <label className="block opacity-75">Text</label>
          <input className="w-full rounded-xl px-3 py-2 bg-transparent edge-border"
                 defaultValue={block.text}
                 onBlur={(e)=>onChange({ text:e.target.value })}/>
        </>
      )}
      {block.type === "button" && (
        <>
          <label className="block opacity-75">Label</label>
          <input className="w-full rounded-xl px-3 py-2 bg-transparent edge-border"
                 defaultValue={block.label}
                 onBlur={(e)=>onChange({ label:e.target.value })}/>
        </>
      )}
    </div>
  );
}
