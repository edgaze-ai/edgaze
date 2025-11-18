"use client";

import { Sparkles, Type, Image as Img, Square } from "lucide-react";

export default function FEBlockLibrary({
  onAdd,
}: { onAdd: (type: "text" | "button" | "image" | "strip") => void }) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <button className="w-full rounded-[14px] p-[1.5px] edge-grad">
          <div className="w-full rounded-[12px] bg-[#121212] px-4 py-3 text-sm flex items-center justify-center gap-2">
            <Sparkles size={16} />
            Search components with AI
          </div>
        </button>
      </div>

      <div className="text-xs tracking-widest opacity-80">BASICS</div>
      <div className="grid gap-2">
        <button onClick={()=>onAdd("text")} className="edge-glass edge-border rounded-xl px-3 py-2 flex items-center gap-2">
          <Type size={16}/> Text
        </button>
        <button onClick={()=>onAdd("button")} className="edge-glass edge-border rounded-xl px-3 py-2 flex items-center gap-2">
          <Square size={16}/> Button
        </button>
        <button onClick={()=>onAdd("image")} className="edge-glass edge-border rounded-xl px-3 py-2 flex items-center gap-2">
          <Img size={16}/> Image
        </button>
        <button onClick={()=>onAdd("strip")} className="edge-glass edge-border rounded-xl px-3 py-2 flex items-center gap-2">
          + Strip
        </button>
      </div>
    </div>
  );
}
