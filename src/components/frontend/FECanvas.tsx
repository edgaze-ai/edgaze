"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Copy, CopyPlus, Trash2 } from "lucide-react";

/** ===== Types ===== */
type BlockType = "text" | "button" | "image";

type BlockBase = {
  id: string;
  type: BlockType;
  x: number; // within strip, px
  y: number; // within strip, px
  w: number;
  h: number;
};

type TextBlock = BlockBase & {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
};

type ButtonBlock = BlockBase & {
  type: "button";
  label: string;
  fill: string;
  color: string;
  fontSize: number;
  radius: number;
};

type ImageBlock = BlockBase & {
  type: "image";
  src: string;
  fit: "cover" | "contain";
};

type Block = TextBlock | ButtonBlock | ImageBlock;

type Strip = {
  id: string;
  height: number;
  blocks: Block[];
};

export type FECanvasRef = {
  addStrip: () => void;
  addBlock: (kind: BlockType) => void;
  getDesign: () => Strip[];
};

/** ===== Helpers ===== */
const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 10)}`;

// 8px grid snap
const snap = (v: number) => Math.round(v / 8) * 8;

const DEFAULT_STRIP_HEIGHT = 320;

/** ===== Component ===== */
const FECanvas = forwardRef<FECanvasRef, {
  onSelectionChange?: (sel: Block | null) => void;
}>(function FECanvas({ onSelectionChange }, ref) {
  /** state */
  const [strips, setStrips] = useState<Strip[]>([
    { id: uid("strip"), height: DEFAULT_STRIP_HEIGHT, blocks: [] },
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);

  /** refs */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    mode: "move-block" | "resize-strip" | null;
    stripId?: string;
    blockId?: string;
    startX?: number;
    startY?: number;
    startW?: number;
    startH?: number;
    startBlockX?: number;
    startBlockY?: number;
    startStripH?: number;
    handle?: "top" | "bottom";
  }>({ mode: null });

  /** derived */
  const activeBlock = useMemo< Block | null>(() => {
    for (const s of strips) {
      const b = s.blocks.find((x) => x.id === activeId);
      if (b) return b;
    }
    return null;
  }, [activeId, strips]);

  /** public API */
  useImperativeHandle(ref, () => ({
    addStrip: () => {
      setStrips((ss) => [...ss, { id: uid("strip"), height: DEFAULT_STRIP_HEIGHT, blocks: [] }]);
    },
    addBlock: (kind: BlockType) => {
      setStrips((ss) => {
        const s = ss[ss.length - 1];
        if (!s) return ss;
        const base: BlockBase = { id: uid(kind), type: kind, x: 40, y: 40, w: 240, h: 64 };
        let block: Block;
        if (kind === "text") {
          block = { ...(base as any), type: "text", text: "Good Morning", color: "#ffffff", fontSize: 24, h: 40 };
        } else if (kind === "button") {
          block = {
            ...(base as any),
            type: "button",
            label: "Click me",
            fill: "#6b4eff",
            color: "#ffffff",
            fontSize: 16,
            radius: 12,
            h: 44,
            w: 160,
          };
        } else {
          block = { ...(base as any), type: "image", src: "https://picsum.photos/600/300", fit: "cover", w: 320, h: 180 };
        }
        const next = ss.map((st, idx) => (idx === ss.length - 1 ? { ...st, blocks: [...st.blocks, block] } : st));
        return next;
      });
    },
    getDesign: () => strips,
  }), [strips]);

  /** selection -> inspector notify */
  useEffect(() => {
    onSelectionChange?.(activeBlock);
  }, [activeBlock, onSelectionChange]);

  /** clear selection except when clicking inside toolbar */
  const clearSel = (e?: React.MouseEvent) => {
    const t = e?.target as HTMLElement | undefined;
    if (t && (toolbarRef.current?.contains(t) || t.closest("[data-fe-toolbar]"))) return;
    if (activeId) setActiveId(null);
  };

  /** ---- strip sizing ---- */
  const beginStripResize = (stripId: string, handle: "top" | "bottom", e: React.MouseEvent) => {
    e.stopPropagation();
    dragRef.current = {
      mode: "resize-strip",
      stripId,
      handle,
      startY: e.clientY,
      startStripH: strips.find((s) => s.id === stripId)?.height,
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /** ---- block move ---- */
  const beginBlockMove = (stripId: string, blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const s = strips.find((x) => x.id === stripId);
    const b = s?.blocks.find((x) => x.id === blockId);
    if (!b) return;
    setActiveId(blockId);
    dragRef.current = {
      mode: "move-block",
      stripId,
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      startBlockX: b.x,
      startBlockY: b.y,
      startW: b.w,
      startH: b.h,
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onMove = (e: MouseEvent) => {
    const d = dragRef.current;
    if (!d?.mode) return;

    if (d.mode === "resize-strip" && d.stripId) {
      const deltaY = (e.clientY - (d.startY || 0));
      setStrips((ss) =>
        ss.map((s) => {
          if (s.id !== d.stripId) return s;
          let h = d.startStripH || s.height;
          h = d.handle === "bottom" ? h + deltaY : h - deltaY;
          h = Math.max(120, snap(h));
          return { ...s, height: h };
        })
      );
    }

    if (d.mode === "move-block" && d.stripId && d.blockId) {
      const dx = e.clientX - (d.startX || 0);
      const dy = e.clientY - (d.startY || 0);
      setStrips((ss) =>
        ss.map((s) => {
          if (s.id !== d.stripId) return s;
          return {
            ...s,
            blocks: s.blocks.map((b) =>
              b.id === d.blockId
                ? { ...b, x: snap((d.startBlockX || 0) + dx), y: snap((d.startBlockY || 0) + dy) }
                : b
            ),
          };
        })
      );
    }
  };

  const onUp = () => {
    dragRef.current = { mode: null };
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  /** ---- Toolbar positioning ---- */
  const updateToolbarPos = useCallback(() => {
    const tb = toolbarRef.current, host = hostRef.current;
    if (!tb || !activeId || !host) return;

    const el = host.querySelector(`[data-block="${activeId}"]`) as HTMLElement | null;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const hc = host.getBoundingClientRect();

    const desiredTop = r.top - hc.top - tb.offsetHeight - 12;
    const top = desiredTop > 0 ? desiredTop : (r.top - hc.top + r.height + 12);

    let left = r.left - hc.left + r.width / 2 - tb.offsetWidth / 2;
    const minL = 8;
    const maxL = hc.width - tb.offsetWidth - 8;
    left = Math.max(minL, Math.min(maxL, left));

    tb.style.left = `${left}px`;
    tb.style.top = `${top}px`;
  }, [activeId]);

  useEffect(() => { updateToolbarPos(); }, [activeId, strips, updateToolbarPos]);
  useEffect(() => {
    const fn = () => updateToolbarPos();
    window.addEventListener("scroll", fn, true);
    window.addEventListener("resize", fn);
    return () => {
      window.removeEventListener("scroll", fn, true);
      window.removeEventListener("resize", fn);
    };
  }, [updateToolbarPos]);

  /** ---- Toolbar actions ---- */
  const doDelete = () => {
    if (!activeId) return;
    setStrips((ss) => ss.map(s => ({ ...s, blocks: s.blocks.filter(b => b.id !== activeId) })));
    setActiveId(null);
  };
  const doCopy = () => {
    if (!activeBlock) return;
    navigator.clipboard.writeText(JSON.stringify(activeBlock, null, 2));
  };
  const doPaste = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const b = JSON.parse(txt) as Block;
      if (!b || !("type" in b)) return;
      b.id = uid(b.type);
      b.x = (b.x || 40) + 24; b.y = (b.y || 40) + 24;
      setStrips((ss) => {
        const i = ss.length - 1;
        if (i < 0) return ss;
        const next = [...ss];
        next[i] = { ...next[i], blocks: [...next[i].blocks, b] };
        return next;
      });
    } catch { /* ignore */ }
  };
  const doDuplicate = () => {
    if (!activeBlock) return;
    const dup: Block = { ...activeBlock, id: uid(activeBlock.type), x: activeBlock.x + 24, y: activeBlock.y + 24 };
    setStrips((ss) => ss.map(s => s.blocks.some(b => b.id === activeBlock.id)
      ? { ...s, blocks: [...s.blocks, dup] } : s));
    setActiveId(dup.id);
  };

  /** ---- Context property editors (via toolbar) ---- */
  const setTextColor = (val: string) => {
    if (!activeBlock || activeBlock.type !== "text") return;
    setStrips((ss) => ss.map(s => ({
      ...s,
      blocks: s.blocks.map(b => b.id === activeBlock.id ? { ...(b as TextBlock), color: val } : b)
    })));
  };
  const setFontSize = (val: number) => {
    if (!activeBlock || (activeBlock.type !== "text" && activeBlock.type !== "button")) return;
    setStrips((ss) => ss.map(s => ({
      ...s,
      blocks: s.blocks.map(b =>
        b.id === activeBlock.id
          ? (b.type === "text"
              ? { ...(b as TextBlock), fontSize: val, h: Math.max(24, Math.round(val * 1.8)) }
              : { ...(b as ButtonBlock), fontSize: val, h: Math.max(32, Math.round(val * 2)) })
          : b
      )
    })));
  };
  const setFill = (val: string) => {
    if (!activeBlock || activeBlock.type !== "button") return;
    setStrips((ss) => ss.map(s => ({
      ...s,
      blocks: s.blocks.map(b => b.id === activeBlock.id ? { ...(b as ButtonBlock), fill: val } : b)
    })));
  };

  /** ---- Renderers ---- */
  const renderBlock = (s: Strip, b: Block) => {
    const selected = b.id === activeId;

    const baseCls = [
      "absolute select-none",
      selected ? "edge-selected" : "",
    ].join(" ");

    const style: React.CSSProperties = {
      left: b.x,
      top: b.y,
      width: b.w,
      height: b.h,
    };

    const commonProps = {
      "data-block": b.id,
      className: baseCls,
      style,
      onMouseDown: (e: React.MouseEvent) => beginBlockMove(s.id, b.id, e),
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); setActiveId(b.id); },
    };

    if (b.type === "text") {
      return (
        <div key={b.id} {...commonProps}>
          <div
            style={{ color: b.color, fontSize: b.fontSize, lineHeight: 1.2, background: "transparent" }}
          >
            {b.text}
          </div>
          {/* selection rectangle (no fill, only outline) */}
          {selected && (
            <div className="pointer-events-none absolute inset-0 rounded-xl"
                 style={{ outline: "2px solid rgba(255,255,255,.2)", outlineOffset: 0 }} />
          )}
        </div>
      );
    }
    if (b.type === "button") {
      return (
        <div key={b.id} {...commonProps}>
          <button
            className="w-full h-full"
            style={{
              background: b.fill,
              color: b.color,
              borderRadius: b.radius,
              fontSize: b.fontSize,
            }}
          >
            {b.label}
          </button>
          {selected && (
            <div className="pointer-events-none absolute inset-0 rounded-xl"
                 style={{ outline: "2px solid rgba(255,255,255,.25)", outlineOffset: 0 }} />
          )}
        </div>
      );
    }
    return (
      <div key={b.id} {...commonProps}>
        <img
          src={(b as ImageBlock).src}
          alt=""
          className="w-full h-full"
          style={{ objectFit: (b as ImageBlock).fit }}
        />
        {selected && (
          <div className="pointer-events-none absolute inset-0 rounded-xl"
               style={{ outline: "2px solid rgba(255,255,255,.2)", outlineOffset: 0 }} />
        )}
      </div>
    );
  };

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full bg-[#0b0b0b] overflow-auto"
      onMouseDown={(e) => clearSel(e)}
    >
      {/* grid */}
      <div className="absolute inset-0 pointer-events-none"
           style={{
             backgroundImage:
               "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
             backgroundSize: "16px 16px, 16px 16px",
           }} />

      {/* strips */}
      <div className="relative">
        {strips.map((s, idx) => (
          <div key={s.id}
               className="relative border-y border-white/10"
               style={{ height: s.height }}>
            {/* resize handles – no space between strips; handle floats on the border */}
            <div
              title="Resize strip"
              className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 rounded-full p-[1.5px] edge-grad cursor-ns-resize"
              onMouseDown={(e) => beginStripResize(s.id, "top", e)}
            >
              <div className="edge-toolbar px-2 py-1 text-[11px]">⋮</div>
            </div>
            <div
              title="Resize strip"
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full p-[1.5px] edge-grad cursor-ns-resize"
              onMouseDown={(e) => beginStripResize(s.id, "bottom", e)}
            >
              <div className="edge-toolbar px-2 py-1 text-[11px]">⋮</div>
            </div>

            {/* blocks */}
            <div className="relative w-full h-full">
              {s.blocks.map((b) => renderBlock(s, b))}
            </div>
          </div>
        ))}
      </div>

      {/* SELECTION TOOLBAR (icons only, positioned above; click-safe) */}
      {activeBlock && (
        <div ref={toolbarRef} className="absolute z-30" data-fe-toolbar
             onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
          <div className="rounded-full p-[1.5px] edge-grad">
            <div className="edge-toolbar">
              <button title="Copy" onClick={doCopy} aria-label="Copy"><Copy size={16}/></button>
              <button title="Paste" onClick={doPaste} aria-label="Paste"
                      style={{transform:"scaleX(-1)"}}><CopyPlus size={16}/></button>
              <button title="Duplicate" onClick={doDuplicate} aria-label="Duplicate"><CopyPlus size={16}/></button>
              <button title="Delete" onClick={doDelete} className="danger" aria-label="Delete"><Trash2 size={16}/></button>

              {activeBlock.type === "text" && (
                <>
                  <span className="sep" />
                  <input type="color" title="Text color"
                         onMouseDown={(e)=>e.stopPropagation()}
                         onChange={(e)=>setTextColor(e.target.value)} />
                  <input type="number" title="Font size" min={10} max={96}
                         defaultValue={(activeBlock as TextBlock).fontSize}
                         onMouseDown={(e)=>e.stopPropagation()}
                         onBlur={(e)=>setFontSize(Number(e.target.value) || 14)}
                         className="w-14 bg-transparent border border-white/20 rounded px-1 text-sm" />
                </>
              )}

              {activeBlock.type === "button" && (
                <>
                  <span className="sep" />
                  <input type="color" title="Fill"
                         onMouseDown={(e)=>e.stopPropagation()}
                         onChange={(e)=>setFill(e.target.value)} />
                  <input type="number" title="Font size" min={10} max={48}
                         defaultValue={(activeBlock as ButtonBlock).fontSize}
                         onMouseDown={(e)=>e.stopPropagation()}
                         onBlur={(e)=>setFontSize(Number(e.target.value) || 16)}
                         className="w-14 bg-transparent border border-white/20 rounded px-1 text-sm" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default FECanvas;
