"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Copy, X, ExternalLink } from "lucide-react";

type PromptPlaceholder = {
  key: string;
  question?: string | null;
  label?: string | null;
  hint?: string | null;
  required?: boolean | null;
  default?: string | null;
};

type Provider = "edgaze" | "chatgpt" | "claude" | "gemini" | "perplexity";
const EDGAZE_RUN_COMING_SOON = true;

function providerInfo(p: Provider) {
  if (p === "edgaze")
    return { name: "Edgaze", sub: "Coming soon", icon: "/brand/edgaze-mark.png", kind: "internal" as const };
  if (p === "chatgpt") return { name: "ChatGPT", sub: "Prefill", icon: "/misc/chatgpt.png", kind: "external" as const };
  if (p === "claude") return { name: "Claude", sub: "Prefill", icon: "/misc/claude.png", kind: "external" as const };
  if (p === "gemini") return { name: "Gemini", sub: "AI Studio", icon: "/misc/gemini.png", kind: "external" as const };
  return { name: "Perplexity", sub: "Search", icon: "/misc/perplexity.png", kind: "external" as const };
}

function buildProviderUrl(p: Provider, filledPrompt: string) {
  const enc = encodeURIComponent(filledPrompt || "");
  if (p === "chatgpt") return `https://chatgpt.com/?q=${enc}`;
  if (p === "claude") return `https://claude.ai/new?q=${enc}`;
  if (p === "perplexity") return `https://www.perplexity.ai/search?q=${enc}`;
  if (p === "gemini") return `https://aistudio.google.com/app/prompts/new_chat?prompt=${enc}`;
  return "";
}

function fillPrompt(template: string, values: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/{{\s*([a-zA-Z0-9_\-\.]+)\s*}}/g, (_m, k) => {
    const key = String(k || "").trim();
    return values[key] ?? "";
  });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  template: string;
  placeholders: PromptPlaceholder[];
};

export default function PromptRunModal({
  open,
  onClose,
  title,
  template,
  placeholders,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [providerHint, setProviderHint] = useState<Provider>("chatgpt");
  const [mobileTab, setMobileTab] = useState<"fields" | "prompt">("fields");
  const openedAtRef = useRef<number | null>(null);
  const fieldFillsRef = useRef<Set<string>>(new Set());

  // Reset values only when modal opens
  useEffect(() => {
    if (!open) {
      openedAtRef.current = null;
      fieldFillsRef.current.clear();
      return;
    }
    
    openedAtRef.current = Date.now();
    
    const init: Record<string, string> = {};
    placeholders.forEach((p) => {
      init[p.key] = (p.default ?? "").toString();
    });
    setValues(init);
    setCopied(false);
    setProviderHint("chatgpt");
    setMobileTab(placeholders.length > 0 ? "fields" : "prompt");
  }, [open]);

  // Update values when placeholders change (add new ones, but keep existing values)
  useEffect(() => {
    if (!open) return;
    
    setValues((prev) => {
      const updated = { ...prev };
      placeholders.forEach((p) => {
        if (!(p.key in updated)) {
          updated[p.key] = (p.default ?? "").toString();
        }
      });
      // Remove values for placeholders that no longer exist
      Object.keys(updated).forEach((key) => {
        if (!placeholders.some((p) => p.key === key)) {
          delete updated[key];
        }
      });
      return updated;
    });
  }, [placeholders, open]);

  if (!open) return null;

  const filled = fillPrompt(template, values);

  const anyMissingRequired = placeholders.some((p) => {
    const req = Boolean(p.required);
    if (!req) return false;
    const v = (values[p.key] ?? "").trim();
    return !v;
  });

  async function openProvider(p: Provider) {
    setProviderHint(p);

    if (filled.trim()) {
      const ok = await copyToClipboard(filled);
      setCopied(ok);
      setTimeout(() => setCopied(false), 900);
    }

    if (p === "edgaze") return;
    const url = buildProviderUrl(p, filled);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const Providers = (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {(["edgaze", "chatgpt", "claude", "gemini", "perplexity"] as Provider[]).map((p) => {
        const info = providerInfo(p);
        const active = providerHint === p;
        const isEdgazeDisabled = p === "edgaze" && EDGAZE_RUN_COMING_SOON;
        const disabled = isEdgazeDisabled || (p !== "edgaze" && !filled.trim());

        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => openProvider(p)}
            className={cn(
              "rounded-2xl border px-3 py-2 text-left",
              active ? "border-cyan-400/60 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10",
              disabled && "opacity-60 cursor-not-allowed"
            )}
            title={isEdgazeDisabled ? "Run in Edgaze is coming soon" : undefined}
          >
            <div className="flex items-center gap-2">
              <Image src={info.icon} alt={info.name} width={18} height={18} className="h-[18px] w-[18px]" />
              <div className="min-w-0">
                <div className={cn("text-[12px] font-semibold leading-tight", isEdgazeDisabled ? "text-white/70" : "text-white")}>
                  {info.name}
                </div>
                <div className="text-[10px] text-white/45 leading-tight">{info.sub}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const FieldsPanel = (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-white/90">Fill placeholders</div>
        {placeholders.length > 0 ? (
          <div className="text-[11px] text-white/45">{placeholders.length} fields</div>
        ) : (
          <div className="text-[11px] text-white/45">No placeholders</div>
        )}
      </div>

      {placeholders.length === 0 ? (
        <div className="mt-3 text-[12px] text-white/55">This prompt can be run as-is.</div>
      ) : (
        <div className="mt-3 space-y-3 overflow-y-auto pr-1">
          {placeholders.map((p) => {
            const label = (p.label || p.question || p.key || "").toString();
            const q = (p.question || "").toString();
            const v = values[p.key] ?? "";
            const required = Boolean(p.required);

            return (
              <div key={p.key} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-white/90 break-words leading-snug">
                      {label} {required && <span className="ml-1 text-amber-300">*</span>}
                    </div>
                    {q && <div className="mt-1 text-[11px] text-white/55 leading-snug">{q}</div>}
                  </div>
                  <div className="text-[11px] text-white/40 whitespace-nowrap">
                    {"{{"} {p.key} {"}}"}
                  </div>
                </div>

                <input
                  value={v}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setValues((prev) => ({ ...prev, [p.key]: newValue }));
                  }}
                  placeholder={p.hint || ""}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none focus:border-cyan-400/60"
                />
              </div>
            );
          })}
        </div>
      )}

      {anyMissingRequired && (
        <div className="mt-3 text-[11px] text-amber-300">Fill the required fields (*) for best results.</div>
      )}
    </div>
  );

  const PromptPanel = (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white/90">Generated prompt</div>
          <div className="mt-1 text-[11px] text-white/55 leading-snug">
            One click opens a provider with your prompt prefilled. Link is also copied automatically.
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(filled);
            setCopied(ok);
            setTimeout(() => setCopied(false), 900);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-black hover:bg-white/90"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <textarea
        readOnly
        value={filled}
        className="mt-3 h-40 sm:h-44 w-full resize-none rounded-3xl border border-white/10 bg-black/45 p-3 text-[12px] text-white/85 outline-none"
      />

      <div className="mt-3">{Providers}</div>

      <div className="mt-3 rounded-3xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
        <div className="flex items-start gap-2">
          <ExternalLink className="h-4 w-4 mt-[1px] text-white/45" />
          <div className="min-w-0">
            <div className="text-white/80 font-semibold">Fast fallback</div>
            <div className="mt-0.5 leading-snug">If prefill doesn't show, paste (Cmd+V / Ctrl+V) and send.</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-[min(1120px,98vw)] max-h-[92vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">Run</div>
              <div className="mt-0.5 text-[12px] text-white/55 break-words leading-snug">{title}</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile optimized: tabs (prevents giant useless scroll) */}
          <div className="sm:hidden border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setMobileTab("fields")}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-[12px] font-semibold",
                  mobileTab === "fields" ? "border-cyan-400/60 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Fields
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("prompt")}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-[12px] font-semibold",
                  mobileTab === "prompt" ? "border-cyan-400/60 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Prompt
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            <div className="p-3 sm:p-5">
              {/* Desktop layout */}
              <div className="hidden sm:grid grid-cols-12 gap-4 sm:gap-5">
                <div className="col-span-12 lg:col-span-5">
                  <div className="max-h-[520px] overflow-y-auto">{FieldsPanel}</div>
                </div>
                <div className="col-span-12 lg:col-span-7">
                  {PromptPanel}
                </div>
              </div>

              {/* Mobile layout */}
              <div className="sm:hidden">
                <div className="max-h-[calc(92vh-140px)] overflow-y-auto pb-24">
                  {mobileTab === "fields" ? FieldsPanel : PromptPanel}
                </div>

                {/* Mobile sticky action bar */}
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[145] p-3">
                  <div className="pointer-events-auto rounded-3xl border border-white/10 bg-[#0b0c10]/90 backdrop-blur-md p-2 shadow-[0_-20px_80px_rgba(0,0,0,0.7)]">
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyToClipboard(filled);
                        setCopied(ok);
                        setTimeout(() => setCopied(false), 900);
                      }}
                      disabled={!filled.trim()}
                      className={cn(
                        "w-full rounded-2xl px-4 py-3 text-[13px] font-semibold",
                        filled.trim()
                          ? "bg-white text-black hover:bg-white/90"
                          : "bg-white/10 text-white/60 cursor-not-allowed"
                      )}
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <Copy className="h-4 w-4" />
                        {copied ? "Copied" : "Copy prompt"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-gradient-to-r from-cyan-400/40 via-white/10 to-pink-500/40" />
        </div>
      </div>
    </div>
  );
}
