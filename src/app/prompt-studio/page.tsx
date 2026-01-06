"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../components/auth/AuthContext";
import PromptToolbar from "../../components/prompt-studio/PromptToolbar";
import PlaceholderModal from "../../components/prompt-studio/PlaceholderModal";
import PlaceholderEditModal from "../../components/prompt-studio/PlaceholderEditModal";
import UserFormPreview from "../../components/prompt-studio/PlaceholderUserForm";
import PublishPromptSheet from "../../components/prompt-studio/PublishPromptModal";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { Monitor } from "lucide-react";

export type PlaceholderDef = {
  name: string;
  question: string;
};

export type VersionSnapshot = {
  id: string;
  createdAt: string;
  text: string;
  charCount: number;
  tokenEstimate: number;
};

function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 0.75);
}

function cleanPlaceholderName(input: string) {
  return input
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .toLowerCase();
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Segment = { text: string; placeholder?: string };
type TokenRange = { name: string; start: number; end: number }; // end exclusive

function extractTokenRanges(text: string): TokenRange[] {
  const out: TokenRange[] = [];
  const regex = /\{\{([a-zA-Z0-9_.-]+)\}\}/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const name = match[1];
    if (!name) continue; // satisfies TS (and is logically safe)
    out.push({ name, start: match.index, end: regex.lastIndex });
  }

  return out;
}

function splitWithPlaceholders(promptText: string): Segment[] {
  if (!promptText) return [{ text: "" }];
  const segments: Segment[] = [];
  const regex = /\{\{([a-zA-Z0-9_.-]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(promptText))) {
    if (match.index > lastIndex) {
      segments.push({ text: promptText.slice(lastIndex, match.index) });
    }
    segments.push({ text: match[0], placeholder: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < promptText.length) {
    segments.push({ text: promptText.slice(lastIndex) });
  }
  return segments;
}

function clampCaretOutsideTokens(pos: number, ranges: TokenRange[]) {
  for (const r of ranges) {
    if (pos > r.start && pos < r.end) return r.end;
  }
  return pos;
}

function tokenAtPos(pos: number, ranges: TokenRange[]) {
  for (const r of ranges) {
    if (pos > r.start && pos < r.end) return r;
  }
  return null;
}

function DesktopOnlyGate({ blocked }: { blocked: boolean }) {
  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md rounded-3xl bg-[#111214] shadow-[0_20px_80px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 via-sky-500/15 to-pink-500/20">
              <Monitor className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white/90">
                Desktop only (for now)
              </div>
              <div className="text-[11px] text-white/45">
                Prompt Studio isn’t supported on small screens yet.
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-black/30 px-4 py-3 text-[12px] text-white/70">
            Open this page on a larger window (desktop/laptop). Mobile support
            comes later.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromptStudioPage() {
  const { userId, requireAuth } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [promptText, setPromptText] = useState("");
  const [placeholders, setPlaceholders] = useState<PlaceholderDef[]>([]);
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [showPlaceholderModal, setShowPlaceholderModal] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] =
    useState<PlaceholderDef | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);

  const [publishMeta, setPublishMeta] = useState({
    name: "",
    description: "",
    thumbnailUrl: "",
    tags: "",
    visibility: "public" as "public" | "unlisted" | "private",
    paid: false,
    priceUsd: "",
  });

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingInsertRange = useRef<{ start: number; end: number } | null>(null);

  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const check = () => setBlocked(window.innerWidth < 1100);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load latest draft
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;

    (async () => {
      const { data, error } = await supabase
        .from("prompt_drafts")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) return;

      if (data.prompt_text) setPromptText(data.prompt_text);
      if (data.placeholders) setPlaceholders(data.placeholders);
      if (data.meta) setPublishMeta(data.meta);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  // Autosave draft (unchanged)
  useEffect(() => {
    if (!userId) return;

    const timeout = setTimeout(async () => {
      const payload = {
        owner_id: userId,
        prompt_text: promptText,
        placeholders,
        meta: publishMeta,
      };

      await supabase.from("prompt_drafts").insert(payload);
    }, 800);

    return () => clearTimeout(timeout);
  }, [userId, promptText, placeholders, publishMeta, supabase]);

  const charCount = promptText.length;
  const tokenEstimate = useMemo(() => estimateTokens(promptText), [promptText]);

  const tokenRanges = useMemo(() => extractTokenRanges(promptText), [promptText]);
  const overlaySegments = useMemo(
    () => splitWithPlaceholders(promptText),
    [promptText]
  );

  const placeholderMeta = useMemo(() => {
    const map = new Map<string, PlaceholderDef>();
    for (const p of placeholders) map.set(p.name, p);
    return map;
  }, [placeholders]);

  // Fix: if token removed from promptText, remove it from placeholders state
  useEffect(() => {
    const active = new Set(tokenRanges.map((r) => r.name));
    setPlaceholders((prev) => prev.filter((p) => active.has(p.name)));
  }, [tokenRanges]);

  const normalizeCaret = () => {
    const el = editorRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;

    const nextStart = clampCaretOutsideTokens(start, tokenRanges);
    const nextEnd = clampCaretOutsideTokens(end, tokenRanges);

    if (nextStart !== start || nextEnd !== end) {
      el.setSelectionRange(nextStart, nextEnd);
    }
  };

  const syncOverlayScrollFromTextarea = () => {
    const ta = editorRef.current;
    const ov = overlayScrollRef.current;
    if (!ta || !ov) return;
    ov.scrollTop = ta.scrollTop;
    ov.scrollLeft = ta.scrollLeft;
  };

  useEffect(() => {
    syncOverlayScrollFromTextarea();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText]);

  const handleInsertPlaceholderClick = () => {
    const el = editorRef.current;
    if (el) {
      normalizeCaret();
      pendingInsertRange.current = {
        start: el.selectionStart ?? 0,
        end: el.selectionEnd ?? (el.selectionStart ?? 0),
      };
    } else {
      pendingInsertRange.current = {
        start: promptText.length,
        end: promptText.length,
      };
    }
    setShowPlaceholderModal(true);
  };

  const handleConfirmPlaceholder = (name: string, question: string) => {
    setShowPlaceholderModal(false);
    if (!name) return;

    const el = editorRef.current;
    const liveText = el?.value ?? promptText;

    const range = pendingInsertRange.current ?? {
      start: el?.selectionStart ?? liveText.length,
      end: el?.selectionEnd ?? liveText.length,
    };

    const token = `{{${name}}}`;

    const before = liveText.slice(0, range.start);
    const after = liveText.slice(range.end);
    const needsLeftSpace = before.length > 0 && !/\s$/.test(before);
    const prefix = needsLeftSpace ? " " : "";

    const suffix = "";
    const nextText = before + prefix + token + suffix + after;
    setPromptText(nextText);

    setPlaceholders((prev) => {
      const existing = prev.find((p) => p.name === name);
      if (existing)
        return prev.map((p) => (p.name === name ? { ...p, question } : p));
      return [...prev, { name, question }];
    });

    pendingInsertRange.current = null;

    setTimeout(() => {
      const ta = editorRef.current;
      if (!ta) return;
      const pos = before.length + prefix.length + token.length + suffix.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
      normalizeCaret();
      syncOverlayScrollFromTextarea();
    }, 0);
  };

  const handleSaveVersion = () => {
    if (!promptText.trim()) return;
    const snapshot: VersionSnapshot = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      text: promptText,
      charCount,
      tokenEstimate,
    };
    setVersions((prev) => [snapshot, ...prev].slice(0, 20));
  };

  const handleMakeJson = () => {
    const json = JSON.stringify({ prompt: promptText, placeholders }, null, 2);
    navigator.clipboard.writeText(json).catch(() => {});
  };

  const handleTestPrompt = () => {
    if (!requireAuth()) return;
    alert("Test prompt runner not wired yet – coming soon.");
  };

  const handleOpenPublish = () => {
    if (!requireAuth()) return;
    setPublishOpen(true);
  };

  const handlePublishFinished = () => setPublishOpen(false);

  const handlePickVersion = (id: string) => {
    const v = versions.find((x) => x.id === id);
    if (!v) return;
    setPromptText(v.text);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const handleUpdatePlaceholder = (
    nextNameRaw: string,
    nextQuestionRaw: string
  ) => {
    const current = editingPlaceholder;
    if (!current) return;

    const nextName = cleanPlaceholderName(nextNameRaw);
    const nextQuestion = nextQuestionRaw.trim();
    if (!nextName) {
      setEditingPlaceholder(null);
      return;
    }

    setPlaceholders((prev) => {
      const withoutCurrent = prev.filter((p) => p.name !== current.name);
      const exists = withoutCurrent.find((p) => p.name === nextName);

      if (exists) {
        return withoutCurrent.map((p) =>
          p.name === nextName
            ? { ...p, question: nextQuestion || p.question }
            : p
        );
      }
      return [...withoutCurrent, { name: nextName, question: nextQuestion }];
    });

    if (nextName !== current.name) {
      const fromToken = `{{${current.name}}}`;
      const toToken = `{{${nextName}}}`;
      const re = new RegExp(escapeRegExp(fromToken), "g");
      setPromptText((prev) => prev.replace(re, toToken));
    }

    setEditingPlaceholder(null);
    setTimeout(() => {
      editorRef.current?.focus();
      normalizeCaret();
      syncOverlayScrollFromTextarea();
    }, 0);
  };

  const openPlaceholderEditor = (name: string) => {
    const el = editorRef.current;
    if (el) {
      const ranges = tokenRanges;
      const hit = ranges.find((r) => r.name === name);
      if (hit) el.setSelectionRange(hit.end, hit.end);
      normalizeCaret();
    }

    const ph = placeholderMeta.get(name) ?? { name, question: "" };
    setEditingPlaceholder(ph);
  };

  const handleEditorMouseUp = () => {
    const el = editorRef.current;
    if (!el) return;

    const pos = el.selectionStart ?? 0;
    const hit = tokenAtPos(pos, tokenRanges);
    if (!hit) {
      normalizeCaret();
      return;
    }

    el.setSelectionRange(hit.end, hit.end);
    openPlaceholderEditor(hit.name);
  };

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <DesktopOnlyGate blocked={blocked} />

      <PromptToolbar
        title="Prompt Studio"
        charCount={charCount}
        tokenEstimate={tokenEstimate}
        onInsertPlaceholder={handleInsertPlaceholderClick}
        onMakeJson={handleMakeJson}
        onTestPrompt={handleTestPrompt}
        onSaveVersion={handleSaveVersion}
        onPublish={handleOpenPublish}
      />

      <div className="flex flex-1 overflow-hidden px-5 pb-5">
        {/* Editor */}
        <div className="flex-1 pr-4 overflow-hidden">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] tracking-wide text-white/45">Editor</div>
            <div className="text-[11px] text-white/35">
              Overlay + textarea use identical typography. Caret stays outside
              tokens.
            </div>
          </div>

          <div className="relative h-full w-full overflow-hidden rounded-3xl bg-[#0b0b0c] shadow-[0_18px_70px_rgba(0,0,0,0.70),inset_0_1px_0_rgba(255,255,255,0.04)]">
            {/* overlay (scroll is synced to textarea) */}
            <div
              ref={overlayScrollRef}
              className="pointer-events-none absolute inset-0 overflow-auto px-6 py-6"
              aria-hidden="true"
            >
              <div className="whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.65] tracking-normal">
                {overlaySegments.map((seg, idx) => {
                  if (!seg.placeholder) {
                    return (
                      <span key={idx} className="text-white/92">
                        {seg.text}
                      </span>
                    );
                  }

                  // Premium gradient highlight + glow (still NO padding/border/ring)
                  // Uses only shadows (paint-only) so caret math stays correct.
                  return (
                    <span
                      key={idx}
                      className="pointer-events-auto cursor-pointer text-white/95 rounded-md bg-gradient-to-r from-cyan-400/20 via-sky-400/18 to-pink-400/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_0_14px_rgba(56,189,248,0.18),0_0_18px_rgba(236,72,153,0.12)] transition-shadow"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openPlaceholderEditor(seg.placeholder!);
                      }}
                      title="Click to edit placeholder"
                    >
                      {`{{${seg.placeholder}}}`}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* textarea owns interactions + scrolling */}
            <textarea
              ref={editorRef}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onScroll={() => syncOverlayScrollFromTextarea()}
              onMouseUp={handleEditorMouseUp}
              onKeyUp={() => {
                normalizeCaret();
                syncOverlayScrollFromTextarea();
              }}
              onKeyDown={() =>
                setTimeout(() => {
                  normalizeCaret();
                  syncOverlayScrollFromTextarea();
                }, 0)
              }
              onSelect={() => {
                normalizeCaret();
                syncOverlayScrollFromTextarea();
              }}
              spellCheck={false}
              className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-6 py-6 font-sans text-[15px] leading-[1.65] tracking-normal text-transparent caret-white outline-none"
              placeholder="Write your system / user prompt here..."
            />
          </div>
        </div>

        {/* Side preview */}
        <div className="w-[380px] flex-shrink-0 overflow-hidden">
          <div className="mb-2 text-[11px] tracking-wide text-white/45">
            Customer experience preview
          </div>

          <div className="h-full overflow-hidden rounded-3xl bg-[#0b0b0c] shadow-[0_18px_70px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="px-4 py-3">
              <div className="text-[12px] font-semibold text-white/85">
                User form
              </div>
              <div className="text-[11px] text-white/40">
                What they fill before running your prompt.
              </div>
            </div>
            <div className="h-full overflow-y-auto px-3 pb-4">
              <UserFormPreview placeholders={placeholders} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom versions */}
      <div className="px-5 pb-5">
        <div className="rounded-3xl bg-[#0b0b0c] shadow-[0_18px_70px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-[11px] font-semibold text-white/65">
              Version history
            </div>
            <div className="text-[11px] text-white/35">
              Stored locally for now.
            </div>
          </div>

          <div className="px-4 pb-4">
            {versions.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-[11px] text-white/40 ring-1 ring-white/5">
                Save a version from the toolbar to see it here.
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {versions.map((v) => {
                  const d = new Date(v.createdAt);
                  const summary =
                    v.text.length > 110 ? v.text.slice(0, 110) + "…" : v.text;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handlePickVersion(v.id)}
                      className="min-w-[300px] max-w-[340px] flex-shrink-0 rounded-3xl bg-white/[0.03] px-3 py-2.5 text-left ring-1 ring-white/5 hover:bg-white/[0.06] transition"
                    >
                      <div className="mb-1 flex items-center justify-between text-[10px] text-white/45">
                        <span>
                          {d.toLocaleDateString()} {d.toLocaleTimeString()}
                        </span>
                        <span className="rounded-full bg-black/30 px-2 py-0.5 ring-1 ring-white/5">
                          {v.charCount}c · ~{v.tokenEstimate}t
                        </span>
                      </div>
                      <div className="text-[11px] text-white/78 line-clamp-3">
                        {summary}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPlaceholderModal && (
        <PlaceholderModal
          alreadyUsedNames={placeholders.map((p) => p.name)}
          onClose={() => setShowPlaceholderModal(false)}
          onConfirm={handleConfirmPlaceholder}
        />
      )}

      {editingPlaceholder && (
        <PlaceholderEditModal
          current={editingPlaceholder}
          alreadyUsedNames={placeholders.map((p) => p.name)}
          onClose={() => setEditingPlaceholder(null)}
          onSave={handleUpdatePlaceholder}
        />
      )}

      <PublishPromptSheet
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        meta={publishMeta}
        onMetaChange={setPublishMeta}
        promptText={promptText}
        placeholders={placeholders}
        onPublished={handlePublishFinished}
      />
    </div>
  );
}
