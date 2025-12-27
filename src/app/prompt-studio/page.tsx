"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../components/auth/AuthContext";
import PromptToolbar from "../../components/prompt-studio/PromptToolbar";
import PlaceholderModal from "../../components/prompt-studio/PlaceholderModal";
import UserFormPreview from "../../components/prompt-studio/PlaceholderUserForm";
import VersionHistoryList from "../../components/prompt-studio/VersionHistoryPanel";
import PublishPromptSheet from "../../components/prompt-studio/PublishPromptModal";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

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

export default function PromptStudioPage() {
  const { userId, requireAuth } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [promptText, setPromptText] = useState("");
  const [placeholders, setPlaceholders] = useState<PlaceholderDef[]>([]);
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [showPlaceholderModal, setShowPlaceholderModal] = useState(false);

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

  // Load latest draft for this user
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

  // Autosave draft (best-effort)
  useEffect(() => {
    if (!userId) return;

    const timeout = setTimeout(async () => {
      const payload = {
        owner_id: userId,
        prompt_text: promptText,
        placeholders,
        meta: publishMeta,
      };

      // If you have a unique draft id system, change this to upsert.
      // For now keep it simple, but you might create many rows.
      await supabase.from("prompt_drafts").insert(payload);
    }, 800);

    return () => clearTimeout(timeout);
  }, [userId, promptText, placeholders, publishMeta, supabase]);

  const charCount = promptText.length;
  const tokenEstimate = useMemo(() => estimateTokens(promptText), [promptText]);

  const highlightedPreview = useMemo(() => {
    if (!promptText) return [];
    const segments: Array<{ text: string; placeholder?: string }> = [];
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
  }, [promptText]);

  const handleInsertPlaceholderClick = () => {
    setShowPlaceholderModal(true);
  };

  const handleConfirmPlaceholder = (name: string, question: string) => {
    setShowPlaceholderModal(false);
    if (!name) return;

    const token = `{{${name}}}`;

    setPromptText((prev) =>
      prev.includes(token) ? prev : prev ? `${prev} ${token}` : token
    );

    setPlaceholders((prev) => {
      const existing = prev.find((p) => p.name === name);
      if (existing) {
        return prev.map((p) => (p.name === name ? { ...p, question } : p));
      }
      return [...prev, { name, question }];
    });
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
    const json = JSON.stringify(
      {
        prompt: promptText,
        placeholders,
      },
      null,
      2
    );
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

  const handlePublishFinished = () => {
    setPublishOpen(false);
  };

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 pt-4 pb-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Prompt Studio</h1>
          <p className="text-xs text-white/55">
            Design, version, and publish prompts with answerable placeholders.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-white/50">
          <span>
            {charCount} chars · ~{tokenEstimate} tokens
          </span>
          <button
            type="button"
            onClick={handleOpenPublish}
            className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-1.5 text-xs font-semibold text-black shadow-[0_0_22px_rgba(56,189,248,0.6)] hover:brightness-110"
          >
            Publish
          </button>
        </div>
      </header>

      <PromptToolbar
        onInsertPlaceholder={handleInsertPlaceholderClick}
        onMakeJson={handleMakeJson}
        onTestPrompt={handleTestPrompt}
        onSaveVersion={handleSaveVersion}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: editor */}
        <div className="flex-1 border-r border-white/10 px-4 py-3">
          <div className="mb-1 text-[11px] text-white/40">Prompt editor</div>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="h-full w-full resize-none rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-base leading-relaxed text-white outline-none focus:border-cyan-400"
            placeholder="Write your system / user prompt here. Use {{variable}} to insert placeholders."
          />
          {placeholders.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-2 text-[11px]">
              {placeholders.map((ph) => (
                <span
                  key={ph.name}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-emerald-200"
                >
                  <span className="font-mono text-[10px]">{`{{${ph.name}}}`}</span>
                  <span className="text-white/70">– {ph.question}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: previews & versions */}
        <div className="w-[360px] flex-shrink-0 space-y-4 px-4 py-3">
          <section className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-white/70">
              Preview with highlighted placeholders
            </div>
            <div className="rounded-lg bg-black/60 px-3 py-2 text-[11px] leading-relaxed">
              {highlightedPreview.length === 0 ? (
                <span className="text-white/40">Start typing your prompt on the left.</span>
              ) : (
                highlightedPreview.map((seg, idx) =>
                  seg.placeholder ? (
                    <span
                      key={idx}
                      className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200"
                    >
                      {seg.text}
                    </span>
                  ) : (
                    <span key={idx}>{seg.text}</span>
                  )
                )
              )}
            </div>
          </section>

          <UserFormPreview placeholders={placeholders} />

          <VersionHistoryList versions={versions} />
        </div>
      </div>

      {/* Placeholder modal */}
      {showPlaceholderModal && (
        <PlaceholderModal
          alreadyUsedNames={placeholders.map((p) => p.name)}
          onClose={() => setShowPlaceholderModal(false)}
          onConfirm={handleConfirmPlaceholder}
        />
      )}

      {/* Publish sheet */}
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
