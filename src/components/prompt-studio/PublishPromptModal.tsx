// src/components/prompt-studio/PublishPromptModal.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  Upload,
  Loader2,
  AlertTriangle,
  Sparkles,
  Link as LinkIcon,
  Copy,
  Download,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import AssetPickerModalRaw from "../assets/AssetPickerModal";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import FoundingCreatorBadge from "../ui/FoundingCreatorBadge";

type PlaceholderDef = {
  name: string;
  question: string;
};

const AssetPickerModal = AssetPickerModalRaw as unknown as React.ComponentType<{
  onClose: () => void;
  onPick: (asset: any) => void;
}>;

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription";

type PublishMeta = {
  name: string;
  description: string;
  thumbnailUrl: string;
  tags: string;
  visibility: Visibility;
  paid: boolean;
  priceUsd: string;
  demoImageUrls?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  meta: PublishMeta;
  onMetaChange: (next: PublishMeta) => void;
  promptText: string;
  placeholders: PlaceholderDef[];
  editId?: string | null; // If provided, we're editing an existing prompt
  onPublished: () => void;
};

const BUCKET = "workflow-media";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Thumbnail prompt snippet: ONLY prompt text (no title/tags/price/etc) and blurred.
 */
function makePromptSnippetForThumb(full: string) {
  const cleaned = (full || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const pct = Math.max(40, Math.floor(cleaned.length * 0.18));
  const maxChars = Math.min(900, pct);
  const snippet = cleaned.slice(0, maxChars);
  return snippet + (cleaned.length > snippet.length ? "…" : "");
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Create an auto thumbnail that contains ONLY blurred prompt text.
 * Important: Some browsers are flaky with ctx.filter; we include a manual blur fallback.
 */
async function createPromptOnlyThumbnail(promptText: string): Promise<string> {
  const W = 1280;
  const H = 800; // 16:10

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Gradient backdrop
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "rgba(34, 211, 238, 1)");
  bg.addColorStop(1, "rgba(232, 121, 249, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Dark overlay
  ctx.fillStyle = "rgba(7, 8, 12, 0.76)";
  ctx.fillRect(0, 0, W, H);

  // Soft bloom
  const rg = ctx.createRadialGradient(W * 0.22, H * 0.22, 60, W * 0.22, H * 0.22, W * 0.9);
  rg.addColorStop(0, "rgba(34, 211, 238, 0.16)");
  rg.addColorStop(0.55, "rgba(232, 121, 249, 0.12)");
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  // Inner card
  const pad = 46;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "rgba(10, 11, 16, 0.72)";
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.stroke();
  ctx.restore();

  const snippet = makePromptSnippetForThumb(promptText);
  if (!snippet) return canvas.toDataURL("image/png");

  const textAreaX = cardX + 70;
  const textAreaY = cardY + 90;
  const textAreaW = cardW - 140;
  const textAreaH = cardH - 180;

  const len = snippet.length;
  const fontSize = len <= 120 ? 58 : len <= 220 ? 46 : len <= 360 ? 38 : 32;
  const lineH = Math.round(fontSize * 1.24);

  // Render text to offscreen canvas
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const octx = off.getContext("2d");
  if (!octx) throw new Error("Canvas not supported");

  octx.save();
  octx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
  octx.textBaseline = "top";
  octx.fillStyle = "rgba(255,255,255,0.92)";

  const maxLines = Math.max(5, Math.min(12, Math.floor(textAreaH / lineH)));
  const lines = wrapTextLines(octx, snippet, textAreaW, maxLines);

  const totalH = lines.length * lineH;
  let y = textAreaY + Math.max(0, Math.floor((textAreaH - totalH) * 0.35));
  for (const line of lines) {
    octx.fillText(line, textAreaX, y);
    y += lineH;
  }
  octx.restore();

  // Draw blurred text only
  ctx.save();
  const hasFilter = typeof (ctx as any).filter === "string";
  if (hasFilter) {
    (ctx as any).filter = "blur(18px)";
    ctx.globalAlpha = 0.95;
    ctx.drawImage(off, 0, 0);
  } else {
    // Manual blur fallback: layered jitter draws
    ctx.globalAlpha = 0.12;
    const radius = 10;
    for (let i = 0; i < 36; i++) {
      const dx = (Math.random() * 2 - 1) * radius;
      const dy = (Math.random() * 2 - 1) * radius;
      ctx.drawImage(off, dx, dy);
    }
    ctx.globalAlpha = 0.35;
    ctx.drawImage(off, 0, 0);
  }
  ctx.restore();

  // Extra veil to ensure unreadable
  ctx.save();
  const veil = ctx.createLinearGradient(textAreaX, textAreaY, textAreaX + textAreaW, textAreaY + textAreaH);
  veil.addColorStop(0, "rgba(0,0,0,0.22)");
  veil.addColorStop(1, "rgba(0,0,0,0.14)");
  ctx.fillStyle = veil;
  drawRoundedRect(ctx, textAreaX - 18, textAreaY - 18, textAreaW + 36, textAreaH + 36, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, textAreaX - 18, textAreaY - 18, textAreaW + 36, textAreaH + 36, 28);
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL("image/png");
}

function normalizeEdgazeCode(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function baseCodeFromTitle(title: string) {
  const base = normalizeEdgazeCode(title || "");
  return base || "prompt";
}

function randomSuffix(len = 4) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function safeArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toPublicUrl(supabase: any, path: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function qrDataUrlLocal(text: string): Promise<string> {
  try {
    const mod: any = await withTimeout(import("qrcode") as any, 2500, "QR module import");
    const QRCode = mod?.default ?? mod;
    const dataUrl = await withTimeout(
      QRCode.toDataURL(text, {
        errorCorrectionLevel: "H",
        margin: 1,
        scale: 10,
        color: { dark: "#0b0c10", light: "#ffffff" },
      }),
      4500,
      "QR generation"
    );
    return String(dataUrl);
  } catch {
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), 6000);
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("QR fetch failed");
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Failed to read QR blob"));
        r.readAsDataURL(blob);
      });
    } finally {
      clearTimeout(kill);
    }
  }
}

async function qrWithCenteredLogoDataUrl(text: string) {
  const qrDataUrl = await qrDataUrlLocal(text);

  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, 0, 0, 900, 900);

  const badgeSize = 200;
  const badgeX = (900 - badgeSize) / 2;
  const badgeY = (900 - badgeSize) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  const r = 36;
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.arcTo(badgeX + badgeSize, badgeY, badgeX + badgeSize, badgeY + badgeSize, r);
  ctx.arcTo(badgeX + badgeSize, badgeY + badgeSize, badgeX, badgeY + badgeSize, r);
  ctx.arcTo(badgeX, badgeY + badgeSize, badgeX, badgeY, r);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeSize, badgeY, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  try {
    const logo = await withTimeout(loadImage("/brand/edgaze-mark.png"), 2500, "Logo load");
    const logoSize = 120;
    ctx.drawImage(logo, (900 - logoSize) / 2, (900 - logoSize) / 2, logoSize, logoSize);
  } catch {
    // ignore
  }

  return canvas.toDataURL("image/png");
}

async function uploadFileToBucket(opts: {
  supabase: any;
  userId: string;
  promptId: string;
  kind: "thumbnail" | "demo" | "qr";
  index?: number;
  file: File;
}) {
  const { supabase, userId, promptId, kind, index, file } = opts;
  const safeKind = kind === "demo" ? `demo-${String(index ?? 0).padStart(2, "0")}` : kind;
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `prompts/${userId}/${promptId}/${safeKind}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;

  const publicUrl = toPublicUrl(supabase, path);
  return { path, url: publicUrl };
}

function ConfettiSides({ active }: { active: boolean }) {
  const [pieceStyles, setPieceStyles] = useState<Array<Record<string, string>>>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setPieceStyles(
        new Array(18).fill(null).map((_, i) => {
          const left = i % 2 === 0;
          const x = left ? Math.random() * 18 : 82 + Math.random() * 18;
          const delay = Math.random() * 0.2;
          const size = 8 + Math.random() * 10;
          return {
            left: `${x}%`,
            top: "-10%",
            width: `${size}px`,
            height: `${size * 1.55}px`,
            animationDelay: `${delay}s`,
          };
        })
      );
    });
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {pieceStyles.length > 0 && pieceStyles.map((style, i) => (
        <div key={i} className="confetti" style={style} />
      ))}
      <style jsx>{`
        .confetti {
          position: absolute;
          border-radius: 3px;
          opacity: 0.95;
          background: linear-gradient(90deg, rgba(34, 211, 238, 1), rgba(232, 121, 249, 1));
          animation: fall 1.05s cubic-bezier(0.12, 0.6, 0.2, 1) forwards;
        }
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.95;
          }
          100% {
            transform: translateY(125vh) rotate(520deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Prompt preview snippet for REVIEW (display only).
 * Keep it short, and we'll blur it heavily in UI.
 */
function makePromptPreviewForUI(text: string) {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const maxChars = Math.min(520, Math.max(160, Math.floor(cleaned.length * 0.12)));
  const snippet = cleaned.slice(0, maxChars);
  return snippet + (cleaned.length > snippet.length ? "…" : "");
}

type StepKey = "details" | "pricing" | "media" | "visibility" | "review";

const STEPS: Array<{ key: StepKey; title: string; desc: string }> = [
  { key: "details", title: "Basics", desc: "Title, description, tags, code." },
  { key: "pricing", title: "Pricing", desc: "Payments (beta = free)." },
  { key: "media", title: "Media", desc: "Thumbnail + optional demos." },
  { key: "visibility", title: "Visibility", desc: "Public (beta)." },
  { key: "review", title: "Review", desc: "Confirm and publish." },
];

function StepDot({
  index,
  title,
  desc,
  active,
  done,
  canClick,
  onClick,
}: {
  index: number;
  title: string;
  desc: string;
  active: boolean;
  done: boolean;
  canClick: boolean;
  onClick: () => void;
}) {

  return (
    <button
      type="button"
      onClick={canClick ? onClick : undefined}
      className={cx(
        "group flex items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors",
        canClick ? "hover:bg-white/[0.04]" : "opacity-80",
        active && "bg-white/[0.05]"
      )}
    >
      <div
        className={cx(
          "grid h-8 w-8 place-items-center rounded-full border text-[12px] font-semibold",
          done
            ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
            : active
              ? "border-white/20 bg-white/[0.06] text-white"
              : "border-white/12 bg-white/[0.03] text-white/80"
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
      </div>
      <div className="min-w-0">
        <div className={cx("text-[12px] font-semibold", active ? "text-white" : "text-white/85")}>{title}</div>
        <div className="text-[11px] text-white/45 truncate">{desc}</div>
      </div>
    </button>
  );
}

export default function PublishPromptModal({
  open,
  onClose,
  meta,
  onMetaChange,
  promptText,
  placeholders,
  editId,
  onPublished,
}: Props) {
  const { userId, profile, requireAuth } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Guided step (0..4)
  const [step, setStep] = useState<number>(0);
  const [completed, setCompleted] = useState<Record<StepKey, boolean>>({
    details: false,
    pricing: false,
    media: false,
    visibility: false,
    review: false,
  });

  // Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [visibility, setVisibility] = useState<Visibility>("public");
  const [monetisationMode, setMonetisationMode] = useState<MonetisationMode>("free");
  const [priceUsd, setPriceUsd] = useState<string>("2.99");

  const [edgazeCode, setEdgazeCode] = useState<string>("");

  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [codeMsg, setCodeMsg] = useState<string>("");

  const codeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [autoThumbFile, setAutoThumbFile] = useState<File | null>(null);
  const [autoThumbDataUrl, setAutoThumbDataUrl] = useState<string | null>(null);
  const [autoThumbBusy, setAutoThumbBusy] = useState(false);

  const [demoFiles, setDemoFiles] = useState<(File | null)[]>(new Array(6).fill(null));
  const [demoUrlsPicked, setDemoUrlsPicked] = useState<string[]>([]);

  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [published, setPublished] = useState(false);
  const [publishedCode, setPublishedCode] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");

  const [confetti, setConfetti] = useState(false);

  const [qrBusy, setQrBusy] = useState(false);
  const [qrErr, setQrErr] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [parentNotified, setParentNotified] = useState(false);

  const ownerName = (profile as any)?.full_name || "Creator";
  const ownerHandle = (profile as any)?.handle || "creator";

  const safeTitle = (title || "").trim();
  const safeDescription = (description || "").trim();

  const demoCount =
    demoUrlsPicked.filter(Boolean).length + demoFiles.filter((f) => !!f).length;

  const hasValidPlaceholders = placeholders.every((p) => (p.name || "").trim() && (p.question || "").trim());

  const isDetailsValid =
    safeTitle.length > 0 &&
    safeDescription.length > 0 &&
    normalizeEdgazeCode(edgazeCode).length >= 3 &&
    promptText.trim().length > 0 &&
    hasValidPlaceholders;

  // Pricing is always "free" during beta (UI enforces)
  const isPricingValid = true;

  // Media: demo images optional during beta
  const isMediaValid = true;

  // Visibility: only public enabled during beta
  const isVisibilityValid = visibility === "public";

  const isReviewValid = isDetailsValid && isPricingValid && isMediaValid && isVisibilityValid;

  const canPublish = !busy && !!userId && codeStatus === "available" && isReviewValid;

  useEffect(() => {
    if (!open) return;

    setPublished(false);
    setPublishedCode("");
    setPublishedUrl("");
    setParentNotified(false);
    setErr(null);
    setBusy(false);
    setQrBusy(false);
    setQrErr(null);
    setQrDataUrl(null);

    // seed from meta
    setTitle(meta?.name || "");
    setDescription(meta?.description || "");
    setTagsInput(meta?.tags || "");
    setVisibility(meta?.visibility || "public");
    setMonetisationMode("free");
    setPriceUsd(meta?.priceUsd || "2.99");

    // Use existing code when editing, otherwise generate from title
    if (editId && (meta as any)?.edgazeCode) {
      setEdgazeCode((meta as any).edgazeCode);
    } else {
      const base = baseCodeFromTitle(meta?.name || "");
      setEdgazeCode(base);
    }

    // reset files
    setThumbnailFile(null);
    setAutoThumbFile(null);
    setAutoThumbDataUrl(null);
    setDemoFiles(new Array(6).fill(null));
    setDemoUrlsPicked(safeArr(meta?.demoImageUrls));

    // step
    setStep(0);
    setCompleted({
      details: false,
      pricing: false,
      media: false,
      visibility: false,
      review: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep parent meta in sync (lightly)
  useEffect(() => {
    if (!open) return;
    onMetaChange?.({
      ...meta,
      name: title,
      description,
      tags: tagsInput,
      visibility,
      paid: false,
      priceUsd,
      demoImageUrls: demoUrlsPicked,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, description, tagsInput, visibility, priceUsd, demoUrlsPicked]);

  function closeNow() {
    if (busy) return;
    onClose();
  }

  async function checkCodeAvailability(code: string) {
    const c = normalizeEdgazeCode(code);
    if (!c || c.length < 3) {
      setCodeStatus("invalid");
      setCodeMsg("Too short.");
      return;
    }

    setCodeStatus("checking");
    setCodeMsg("Checking…");

    const { data, error } = await supabase.from("prompts").select("id").eq("edgaze_code", c).limit(1);

    if (error) {
      setCodeStatus("idle");
      setCodeMsg("Could not check.");
      return;
    }

    // If editing, exclude the current prompt from the check
    const taken = Array.isArray(data) && data.length > 0 && 
      (!editId || !data.some((row: any) => row.id === editId));
    setCodeStatus(taken ? "taken" : "available");
    setCodeMsg(taken ? "Taken" : "Available");
  }

  useEffect(() => {
    if (!open) return;

    if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);

    const c = normalizeEdgazeCode(edgazeCode);
    if (!c) {
      setCodeStatus("invalid");
      setCodeMsg("Invalid.");
      return;
    }

    codeDebounceRef.current = setTimeout(() => {
      checkCodeAvailability(c);
    }, 420);

    return () => {
      if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgazeCode, open]);

  async function ensureAvailableCodeOrAutofix(): Promise<string | null> {
    const base = normalizeEdgazeCode(edgazeCode);
    if (!base) return null;

    const { data } = await supabase.from("prompts").select("id").eq("edgaze_code", base).limit(1);
    // If editing, exclude the current prompt from the check
    const taken = data && data.length > 0 && (!editId || !data.some((row: any) => row.id === editId));
    if (!taken) {
      setCodeStatus("available");
      setCodeMsg("Available");
      setEdgazeCode(base);
      return base;
    }

    for (let i = 0; i < 6; i++) {
      const next = `${base}-${randomSuffix(4)}`.slice(0, 32);
      const { data: d2 } = await supabase.from("prompts").select("id").eq("edgaze_code", next).limit(1);
      const taken2 = d2 && d2.length > 0 && (!editId || !d2.some((row: any) => row.id === editId));
      if (!taken2) {
        setCodeStatus("available");
        setCodeMsg("Available");
        setEdgazeCode(next);
        return next;
      }
    }

    setCodeStatus("taken");
    setCodeMsg("Pick another.");
    return null;
  }

  async function generateAutoThumbnail() {
    setAutoThumbBusy(true);
    try {
      const dataUrl = await createPromptOnlyThumbnail(promptText);
      setAutoThumbDataUrl(dataUrl);

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const f = new File([blob], "auto-thumbnail.png", { type: "image/png" });
      setAutoThumbFile(f);
    } catch {
      setAutoThumbDataUrl(null);
      setAutoThumbFile(null);
    } finally {
      setAutoThumbBusy(false);
    }
  }

  // Generate auto thumbnail on open (if none selected/uploaded)
  useEffect(() => {
    if (!open) return;
    if (!meta?.thumbnailUrl && !thumbnailFile && !autoThumbFile) {
      generateAutoThumbnail().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep auto thumbnail in sync with prompt edits (instant-ish), unless user provided custom thumbnail (upload or asset)
  useEffect(() => {
    if (!open) return;
    if (meta?.thumbnailUrl) return; // asset chosen
    if (thumbnailFile) return; // user upload
    const t = setTimeout(() => {
      generateAutoThumbnail().catch(() => {});
    }, 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText, open, meta?.thumbnailUrl, thumbnailFile]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  async function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function generateQrAndUpload(opts: { url: string; userId: string; promptId: string }) {
    setQrErr(null);
    setQrBusy(true);
    try {
      const qr = await withTimeout(qrWithCenteredLogoDataUrl(opts.url), 9000, "QR render");
      setQrDataUrl(qr);

      try {
        const blob = await (await fetch(qr)).blob();
        const qrFile = new File([blob], `edgaze-qr-${normalizeEdgazeCode(edgazeCode)}.png`, { type: "image/png" });
        await withTimeout(
          uploadFileToBucket({
            supabase,
            userId: opts.userId,
            promptId: opts.promptId,
            kind: "qr",
            file: qrFile,
          }),
          9000,
          "QR upload"
        );
      } catch {
        // ignore upload failures
      }
    } catch (e: any) {
      setQrErr(e?.message || "QR generation failed.");
      setQrDataUrl(null);
    } finally {
      setQrBusy(false);
    }
  }

  function markCompletedForCurrentStep() {
    const key = STEPS[step]?.key;
    if (!key) return;
    setCompleted((prev) => ({ ...prev, [key]: true }));
  }

  function stepCanAdvance(fromStep: number) {
    const key = STEPS[fromStep]?.key;
    if (!key) return false;
    if (key === "details") return isDetailsValid && codeStatus === "available";
    if (key === "pricing") return isPricingValid;
    if (key === "media") return isMediaValid;
    if (key === "visibility") return isVisibilityValid;
    if (key === "review") return isReviewValid;
    return false;
  }

  async function goNext() {
    setErr(null);

    // Step-specific validations + nicer error routing
    const key = STEPS[step]?.key;

    if (key === "details") {
      if (!safeTitle) return setErr("Add a title.");
      if (!safeDescription) return setErr("Add a description.");
      if (!promptText.trim()) return setErr("Prompt text is empty.");
      if (!hasValidPlaceholders) return setErr("Fix placeholder fields before publishing.");
      const c = normalizeEdgazeCode(edgazeCode);
      if (!c || c.length < 3) return setErr("Edgaze code is too short.");
      if (codeStatus === "taken") return setErr("That Edgaze code is taken.");
      if (codeStatus !== "available") return setErr("Wait for the Edgaze code check to finish.");
    }

    // Media: demo images are optional during beta

    if (key === "visibility") {
      if (visibility !== "public") return setErr("Only Public is available during beta.");
    }

    // mark as completed if it is valid
    if (stepCanAdvance(step)) markCompletedForCurrentStep();

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goPrev() {
    setErr(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function goToStep(index: number) {
    // allow clicking back anytime; forward only if previous steps are valid/completed
    if (index <= step) return setStep(index);

    // can jump forward only if all prior steps are valid
    for (let i = 0; i < index; i++) {
      if (!stepCanAdvance(i)) return;
    }
    setStep(index);
  }

  async function handlePublish() {
    setErr(null);

    if (!requireAuth() || !userId) {
      setErr("You must be signed in to publish.");
      return;
    }

    if (!isReviewValid) {
      setErr("Complete all steps before publishing.");
      return;
    }

    setBusy(true);

    try {
      let finalCode = normalizeEdgazeCode(edgazeCode);
      if (!finalCode) {
        setErr("Edgaze code is invalid.");
        setBusy(false);
        return;
      }

      if (codeStatus !== "available") {
        const fixed = await ensureAvailableCodeOrAutofix();
        if (!fixed) {
          setErr("Pick a unique Edgaze code.");
          setBusy(false);
          return;
        }
        finalCode = fixed;
      }

      // Payments are unavailable during beta → always publish as free.
      const forcedMonetisationMode: MonetisationMode = "free";

      const cleanTags = safeArr(tagsInput);

      let promptId: string;
      
      if (editId) {
        // Update existing prompt
        promptId = editId;
        
        const updateRow: any = {
          title: safeTitle,
          description: safeDescription,
          prompt_text: promptText, // FULL prompt
          placeholders,

          tags: cleanTags.join(","),
          visibility,
          monetisation_mode: forcedMonetisationMode,
          is_paid: false,
          price_usd: 0,

          edgaze_code: finalCode,

          is_published: true,
          is_public: true,
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase.from("prompts").update(updateRow).eq("id", editId);
        if (updateErr) throw updateErr;
      } else {
        // Create new prompt
        const insertRow: any = {
          owner_id: userId,
          owner_name: ownerName,
          owner_handle: ownerHandle,

          type: "prompt",
          title: safeTitle,
          description: safeDescription,
          prompt_text: promptText, // FULL prompt
          placeholders,

          tags: cleanTags.join(","),
          visibility,
          monetisation_mode: forcedMonetisationMode,
          is_paid: false,
          price_usd: 0,

          edgaze_code: finalCode,

          is_published: true,
          is_public: true,

          views_count: 0,
          likes_count: 0,
          runs_count: 0,

          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: createErr } = await supabase.from("prompts").insert(insertRow).select("id").single();
        if (createErr) throw createErr;

        promptId = created?.id as string;
        if (!promptId) throw new Error("Prompt created but ID missing.");
      }

      let thumbnailUrl: string | null = null;

      if (meta.thumbnailUrl) {
        // Use thumbnail from meta (could be existing URL or asset picker)
        thumbnailUrl = meta.thumbnailUrl;
      } else if (thumbnailFile || autoThumbFile) {
        // Upload new thumbnail file
        if (!thumbnailFile && !autoThumbFile) {
          await generateAutoThumbnail();
        }
        const thumbToUpload = thumbnailFile ?? autoThumbFile;
        if (thumbToUpload) {
          const up = await uploadFileToBucket({
            supabase,
            userId,
            promptId,
            kind: "thumbnail",
            file: thumbToUpload,
          });
          thumbnailUrl = up.url || null;
        }
      } else if (editId) {
        // When editing, preserve existing thumbnail if no new one provided
        // The meta should already have it, but check anyway
        thumbnailUrl = meta.thumbnailUrl || null;
      }

      const demoUrls: string[] = [];
      const seenUrls = new Set<string>();
      
      // Add picked URLs (these come from asset picker or existing demos when editing)
      for (const u of demoUrlsPicked) {
        if (u && !seenUrls.has(u)) {
          demoUrls.push(u);
          seenUrls.add(u);
        }
      }
      
      // Preserve existing demo URLs when editing (if not already added)
      if (editId && meta?.demoImageUrls) {
        for (const u of meta.demoImageUrls) {
          if (u && !seenUrls.has(u)) {
            demoUrls.push(u);
            seenUrls.add(u);
          }
        }
      }

      // Upload new demo files
      for (let i = 0; i < demoFiles.length; i++) {
        const f = demoFiles[i];
        if (!f) continue;
        const up = await uploadFileToBucket({
          supabase,
          userId,
          promptId,
          kind: "demo",
          index: i,
          file: f,
        });
        if (up.url) demoUrls.push(up.url);
      }

      const demoFinal = demoUrls.filter(Boolean).slice(0, 6);

      // When editing, merge media updates into the main update
      if (editId) {
        const mediaPatch: any = {
          thumbnail_url: thumbnailUrl,
          demo_images: demoFinal.length ? demoFinal : null,
          output_demo_urls: demoFinal.length ? demoFinal : null,
          updated_at: new Date().toISOString(),
        };
        const { error: patchErr } = await supabase.from("prompts").update(mediaPatch).eq("id", promptId);
        if (patchErr) throw patchErr;
      } else {
        // For new prompts, update media separately
        const patch: any = {
          thumbnail_url: thumbnailUrl,
          demo_images: demoFinal.length ? demoFinal : null,
          output_demo_urls: demoFinal.length ? demoFinal : null,
          updated_at: new Date().toISOString(),
        };
        const { error: patchErr } = await supabase.from("prompts").update(patch).eq("id", promptId);
        if (patchErr) throw patchErr;
      }

      // Use current origin (works for localhost and production)
      const origin = typeof window !== "undefined" ? window.location.origin : "https://edgaze.ai";
      const url = `${origin}/p/${ownerHandle}/${finalCode}`;

      setPublishedCode(finalCode);
      setPublishedUrl(url);
      setPublished(true);

      setConfetti(true);
      setTimeout(() => setConfetti(false), 1200);

      await generateQrAndUpload({ url, userId, promptId });

      setCompleted((c) => ({ ...c, review: true }));
      // do NOT auto-close
    } catch (e: any) {
      setErr(e?.message || "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDone() {
    if (!parentNotified) {
      try {
        onPublished?.();
      } catch {
        // ignore
      }
      setParentNotified(true);
    }
    onClose();
  }

  if (!open) return null;

  const stepKey = STEPS[step]?.key;

  const headerCta = !published ? (
    <button
      onClick={stepKey === "review" ? handlePublish : goNext}
      disabled={published ? true : stepKey === "review" ? !canPublish : !stepCanAdvance(step)}
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold",
        "bg-white text-black hover:bg-white/90 transition-colors",
        (stepKey === "review" ? !canPublish : !stepCanAdvance(step)) && "opacity-60 cursor-not-allowed"
      )}
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {editId ? "Updating…" : "Publishing…"}
        </>
      ) : stepKey === "review" ? (
        <>
          <Sparkles className="h-4 w-4" />
          {editId ? "Update" : "Publish"}
        </>
      ) : (
        <>
          <ChevronRight className="h-4 w-4" />
          Next
        </>
      )}
    </button>
  ) : (
    <button
      onClick={handleDone}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold bg-white text-black hover:bg-white/90 transition-colors"
    >
      Done
    </button>
  );

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/80" onClick={published ? undefined : closeNow} />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div className="relative w-[min(1180px,96vw)] h-[min(780px,92vh)] rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.75)] overflow-hidden">
          <ConfettiSides active={confetti} />

          {/* Header */}
          <div className="h-[72px] sm:h-[76px] px-4 sm:px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={32} height={32} className="h-8 w-8" priority style={{ width: "auto", height: "auto" }} />
              <div className="min-w-0">
                <div className="text-[15px] sm:text-[16px] font-semibold text-white leading-tight truncate">
                  {published ? "Published" : editId ? "Edit prompt" : "Publish prompt"}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45 min-w-0">
                  <span className="shrink-0">Posting as</span>
                  <span className="min-w-0 truncate">{ownerName}</span>
                  <FoundingCreatorBadge size="sm" className="shrink-0" />
                  <span className="truncate">@{ownerHandle}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {headerCta}
              <button
                onClick={published ? undefined : closeNow}
                className={cx(
                  "grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10",
                  published && "opacity-60 cursor-not-allowed"
                )}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-12 gap-0 h-[calc(100%-72px)] sm:h-[calc(100%-76px)]">
            {/* Left: Stepper */}
            <div className="col-span-12 md:col-span-4 border-b md:border-b-0 md:border-r border-white/10 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-white/80">Progress</div>
                <div className="text-[11px] text-white/45">
                  Step {Math.min(step + 1, STEPS.length)}/{STEPS.length}
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
              {STEPS.map((s, i) => {
  const canClick =
    i <= step ||
    (() => {
      for (let k = 0; k < i; k++) {
        if (!stepCanAdvance(k)) return false;
      }
      return true;
    })();

  return (
    <StepDot
      key={s.key}
      index={i}
      title={s.title}
      desc={s.desc}
      active={i === step}
      done={!!completed[s.key]}
      canClick={canClick && !busy && !published}
      onClick={() => goToStep(i)}
    />
  );
})}

              </div>

              {!published ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] font-semibold text-white/70">Beta constraints</div>
                  <div className="mt-1 text-[11px] text-white/50">
                    Payments are unavailable during beta. Visibility is Public only.
                  </div>
                </div>
              ) : null}

              {err ? (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>{err}</div>
                  </div>
                </div>
              ) : null}

              {!published ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={step === 0 || busy}
                    className={cx(
                      "h-10 flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 text-[12px] font-semibold text-white/85 hover:bg-white/10",
                      (step === 0 || busy) && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={stepKey === "review" ? handlePublish : goNext}
                    disabled={busy || (stepKey === "review" ? !canPublish : !stepCanAdvance(step))}
                    className={cx(
                      "h-10 flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-3 text-[12px] font-semibold",
                      "bg-white text-black hover:bg-white/90",
                      (stepKey === "review" ? !canPublish : !stepCanAdvance(step)) && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {stepKey === "review" ? (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {editId ? "Update" : "Publish"}
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>

            {/* Right: Content */}
            <div className="col-span-12 md:col-span-8 p-4 sm:p-5 overflow-auto">
              {!published ? (
                <>
                  {stepKey === "details" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Basic details</div>
                        <div className="text-[11px] text-white/50 mt-1">Make it clear and searchable.</div>

                        <div className="mt-4">
                          <div className="text-[12px] font-semibold text-white/80">Title</div>
                          <input
                            value={title}
                            onChange={(e) => {
                              setTitle(e.target.value);
                              const next = e.target.value;
                              if (!edgazeCode) setEdgazeCode(baseCodeFromTitle(next));
                            }}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                            placeholder="Give it a strong title"
                          />
                        </div>

                        <div className="mt-4">
                          <div className="text-[12px] font-semibold text-white/80">Description</div>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-2 w-full min-h-[110px] rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                            placeholder="What does this prompt do?"
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-12 gap-3">
                          <div className="col-span-12 lg:col-span-7">
                            <div className="text-[12px] font-semibold text-white/80">Edgaze code</div>
                            <input
                              value={edgazeCode}
                              onChange={(e) => setEdgazeCode(e.target.value)}
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                              placeholder="e.g. essay-wizard"
                            />
                            <div className="mt-2 text-[11px] text-white/45">
                              Link format: <span className="text-white/70">/p/{ownerHandle}/</span>
                              <span className="text-white/70">{normalizeEdgazeCode(edgazeCode) || "your-code"}</span>
                            </div>
                          </div>

                          <div className="col-span-12 lg:col-span-5">
                            <div className="text-[12px] font-semibold text-white/80">Availability</div>
                            <div
                              className={cx(
                                "mt-2 rounded-2xl border px-4 py-3 text-[12px] font-semibold",
                                codeStatus === "available"
                                  ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
                                  : codeStatus === "taken"
                                    ? "border-red-500/25 bg-red-500/10 text-red-200"
                                    : codeStatus === "invalid"
                                      ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
                                      : "border-white/10 bg-black/35 text-white/70"
                              )}
                            >
                              {codeStatus === "checking" ? "Checking…" : codeMsg || "—"}
                            </div>
                            <div className="mt-2 text-[11px] text-white/45">
                              Codes are lowercase, up to 32 chars.
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-[12px] font-semibold text-white/80">Tags</div>
                          <input
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                            placeholder="comma separated (ai, writing, study)"
                          />
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Readiness</div>
                        <div className="mt-3 grid grid-cols-12 gap-3">
                          {[
                            { ok: safeTitle.length > 0, label: "Title" },
                            { ok: safeDescription.length > 0, label: "Description" },
                            { ok: promptText.trim().length > 0, label: "Prompt text" },
                            { ok: hasValidPlaceholders, label: "Placeholders" },
                            { ok: codeStatus === "available", label: "Code available" },
                          ].map((i) => (
                            <div key={i.label} className="col-span-12 sm:col-span-6">
                              <div
                                className={cx(
                                  "flex items-center justify-between rounded-2xl border px-4 py-3",
                                  i.ok ? "border-cyan-400/20 bg-cyan-400/10" : "border-white/10 bg-black/35"
                                )}
                              >
                                <div className="text-[12px] font-semibold text-white">{i.label}</div>
                                {i.ok ? <CheckCircle2 className="h-4 w-4 text-cyan-200" /> : <div className="text-[11px] text-white/45">—</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {stepKey === "pricing" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Pricing</div>
                        <div className="text-[11px] text-white/50 mt-1">
                          Payments are unavailable during beta. Your prompt will be published as{" "}
                          <span className="text-white/80 font-semibold">Free</span>.
                        </div>

                        <div className="mt-4 grid grid-cols-12 gap-3">
                          <button
                            type="button"
                            onClick={() => setMonetisationMode("free")}
                            className={cx(
                              "col-span-12 md:col-span-6 rounded-2xl border p-4 text-left transition-colors",
                              monetisationMode === "free"
                                ? "border-cyan-400/25 bg-cyan-400/10"
                                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                            )}
                            
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[12px] font-semibold text-white">Free</div>
                              {monetisationMode === "free" ? <CheckCircle2 className="h-4 w-4 text-cyan-200" /> : null}

                            </div>
                            <div className="text-[11px] text-white/55 mt-1">Everyone can use it.</div>
                          </button>

                          <button
                            type="button"
                            disabled
                            className={cx(
                              "col-span-12 md:col-span-6 rounded-2xl border p-4 text-left",
                              "border-white/10 bg-white/[0.02] opacity-70 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[12px] font-semibold text-white">Paywall</div>
                              <span className="text-[10px] rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-white/70">
                                Unavailable
                              </span>
                            </div>
                            <div className="text-[11px] text-white/55 mt-1">Payments unavailable during beta.</div>
                          </button>

                          <button
                            type="button"
                            disabled
                            className={cx(
                              "col-span-12 md:col-span-6 rounded-2xl border p-4 text-left",
                              "border-white/10 bg-white/[0.02] opacity-70 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[12px] font-semibold text-white">Subscription</div>
                              <span className="text-[10px] rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-white/70">
                                Unavailable
                              </span>
                            </div>
                            <div className="text-[11px] text-white/55 mt-1">Payments unavailable during beta.</div>
                          </button>
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="flex items-center gap-2 text-white/80 text-[12px] font-semibold">
                            <Lock className="h-4 w-4 text-white/55" />
                            Beta note
                          </div>
                          <div className="mt-1 text-[11px] text-white/50">
                            Your full prompt is saved to the database. When payments launch, we’ll enable paywalls without
                            you rebuilding your prompt.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {stepKey === "media" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[12px] font-semibold text-white/85">Thumbnail</div>
                            <div className="text-[11px] text-white/50 mt-1">Upload, pick from assets, or use auto-generated.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAssetPickerOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10"
                          >
                            <Upload className="h-4 w-4" />
                            Pick from assets
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-12 gap-4">
                          <div className="col-span-12 lg:col-span-7">
                            <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-semibold text-white/70">
                                  {meta?.thumbnailUrl ? "Selected from assets" : thumbnailFile ? "Uploaded" : "Auto"}
                                </div>
                                <button
                                  type="button"
                                  onClick={generateAutoThumbnail}
                                  disabled={autoThumbBusy || !!meta?.thumbnailUrl || !!thumbnailFile}
                                  className={cx(
                                    "inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10",
                                    (autoThumbBusy || !!meta?.thumbnailUrl || !!thumbnailFile) && "opacity-60 cursor-not-allowed"
                                  )}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Regenerate
                                </button>
                              </div>

                              <div className="mt-3 aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                                {meta?.thumbnailUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={meta.thumbnailUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                                ) : thumbnailFile ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={URL.createObjectURL(thumbnailFile)} alt="Thumbnail upload" className="h-full w-full object-cover" />
                                ) : autoThumbDataUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={autoThumbDataUrl} alt="Auto thumbnail" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full grid place-items-center text-[11px] text-white/55">
                                    {autoThumbBusy ? "Generating…" : "No thumbnail"}
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 text-[11px] text-white/45">
                                Auto thumbnail stays in sync with your prompt unless you upload/pick one.
                              </div>
                            </div>
                          </div>

                          <div className="col-span-12 lg:col-span-5">
                            <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                              <div className="text-[11px] font-semibold text-white/70">Upload a thumbnail</div>
                              <input
                                type="file"
                                accept="image/*"
                                className="mt-3 block w-full text-[12px] text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-[12px] file:font-semibold file:text-black hover:file:bg-white/90"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  setThumbnailFile(f);
                                  if (f) {
                                    // if user uploads, clear asset-selected thumb (avoid ambiguity)
                                    if (meta?.thumbnailUrl) onMetaChange?.({ ...meta, thumbnailUrl: "" });
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setThumbnailFile(null);
                                }}
                                className={cx(
                                  "mt-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10",
                                  !thumbnailFile && "opacity-60 cursor-not-allowed"
                                )}
                                disabled={!thumbnailFile}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Remove upload
                              </button>

                              <div className="mt-3 text-[11px] text-white/45">
                                Upload overrides auto. Asset selection overrides both.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-semibold text-white/85">Demo images</div>
                            <div className="text-[11px] text-white/50 mt-1">
                              Optional. Add up to 6 example outputs.
                            </div>
                          </div>
                          <div className="text-[11px] font-semibold rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-white/70">
                            {demoCount}/6
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-12 gap-3">
                          {new Array(6).fill(null).map((_, i) => (
                            <div
                              key={i}
                              className="col-span-12 sm:col-span-6 lg:col-span-4 rounded-2xl border border-white/10 bg-black/35 p-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-semibold text-white/70">Slot {i + 1}</div>
                                {demoFiles[i] ? <CheckCircle2 className="h-4 w-4 text-cyan-200" /> : null}
                              </div>

                              <input
                                type="file"
                                accept="image/*"
                                className="mt-2 block w-full text-[12px] text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-black hover:file:bg-white/90"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  setDemoFiles((prev) => {
                                    const copy = [...prev];
                                    copy[i] = f;
                                    return copy;
                                  });
                                }}
                              />

                              {demoFiles[i] ? (
                                <div className="mt-2 text-[11px] text-white/45 truncate">{demoFiles[i]?.name}</div>
                              ) : (
                                <div className="mt-2 text-[11px] text-white/45">Upload an example output.</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {stepKey === "visibility" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Visibility</div>
                        <div className="text-[11px] text-white/50 mt-1">
                          During beta, only <span className="text-white/80 font-semibold">Public</span> is available.
                        </div>

                        <div className="mt-4 grid grid-cols-12 gap-3">
                          {(["public", "unlisted", "private"] as Visibility[]).map((v) => {
                            const disabled = v !== "public";
                            return (
                              <button
                                key={v}
                                type="button"
                                disabled={disabled}
                                onClick={() => setVisibility(v)}
                                className={cx(
                                  "col-span-12 md:col-span-4 rounded-2xl border p-4 text-left capitalize transition-colors",
                                  disabled
                                    ? "border-white/10 bg-white/[0.02] opacity-70 cursor-not-allowed"
                                    : visibility === v
                                      ? "border-cyan-400/25 bg-cyan-400/10"
                                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-[12px] font-semibold text-white">{v}</div>
                                  {disabled ? (
                                    <span className="text-[10px] rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-white/70">
                                      Coming soon
                                    </span>
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-cyan-200" />
                                  )}
                                </div>
                                <div className="text-[11px] text-white/55 mt-1">
                                  {v === "public" ? "Visible to everyone." : v === "unlisted" ? "Only via link." : "Only you."}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {stepKey === "review" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Review</div>
                        <div className="text-[11px] text-white/50 mt-1">Confirm everything before publishing.</div>

                        <div className="mt-4 grid grid-cols-12 gap-3">
                          <div className="col-span-12 lg:col-span-7 rounded-3xl border border-white/10 bg-black/35 p-4">
                            <div className="text-[11px] font-semibold text-white/70">Title</div>
                            <div className="mt-1 text-[14px] font-semibold text-white">{safeTitle || "—"}</div>

                            <div className="mt-4 text-[11px] font-semibold text-white/70">Description</div>
                            <div className="mt-1 text-[12px] text-white/75 whitespace-pre-wrap">{safeDescription || "—"}</div>

                            <div className="mt-4 grid grid-cols-12 gap-3">
                              <div className="col-span-12 sm:col-span-6">
                                <div className="text-[11px] font-semibold text-white/70">Edgaze code</div>
                                <div className="mt-1 text-[12px] text-white/80">{normalizeEdgazeCode(edgazeCode) || "—"}</div>
                              </div>
                              <div className="col-span-12 sm:col-span-6">
                                <div className="text-[11px] font-semibold text-white/70">Visibility</div>
                                <div className="mt-1 text-[12px] text-white/80">Public</div>
                              </div>
                            </div>

                            <div className="mt-4 text-[11px] font-semibold text-white/70">Tags</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {safeArr(tagsInput).length ? (
                                safeArr(tagsInput).slice(0, 10).map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/80"
                                  >
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-white/45">No tags</span>
                              )}
                            </div>
                          </div>

                          <div className="col-span-12 lg:col-span-5 rounded-3xl border border-white/10 bg-black/35 p-4">
                            <div className="text-[11px] font-semibold text-white/70">Prompt preview (blurred)</div>
                            <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 p-3 overflow-hidden relative">
                              <div
                                className="text-[12px] leading-relaxed text-white/85 select-none whitespace-pre-wrap"
                                style={{
                                  filter: "blur(7px)",
                                  opacity: 0.9,
                                  transform: "translateZ(0)",
                                  userSelect: "none",
                                }}
                              >
                                {makePromptPreviewForUI(promptText) || "—"}
                              </div>
                              {/* veil + subtle noise to make it barely readable */}
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/25 via-black/15 to-black/30" />
                              <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.06),transparent_45%)]" />
                              <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10 rounded-2xl" />
                            </div>

                            <div className="mt-3 text-[11px] text-white/50">
                              Full prompt is saved. This preview is just for review UI.
                            </div>

                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-[11px] font-semibold text-white/80">By publishing</div>
                              <div className="mt-1 text-[11px] text-white/50">
                                You agree to our{" "}
                                <a className="text-white/80 hover:text-white underline underline-offset-4" href="/docs/terms-of-service">
                                  Terms
                                </a>
                                ,{" "}
                                <a className="text-white/80 hover:text-white underline underline-offset-4" href="/docs/privacy-policy">
                                  Privacy Policy
                                </a>{" "}
                                and{" "}
                                <a className="text-white/80 hover:text-white underline underline-offset-4" href="/docs/community">
                                  Community Guidelines
                                </a>
                                .
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold text-white/70">Media</div>
                            <div className="text-[11px] font-semibold rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-cyan-200">
                              Thumbnail {demoCount > 0 ? `+ ${demoCount} demo(s)` : "(demos optional)"}
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] text-white/50">
                            Demo images are optional during beta.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                // Published view (keeps old functionality)
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white">
                      <CheckCircle2 className="h-5 w-5 text-cyan-300" />
                      <div className="text-[14px] font-semibold">Published</div>
                    </div>

                    <div className="mt-4 grid grid-cols-12 gap-4">
                      <div className="col-span-12 lg:col-span-7 rounded-3xl border border-white/10 bg-black/35 p-4">
                        <div className="text-[11px] font-semibold text-white/70">Edgaze code</div>
                        <div className="mt-2 text-[34px] font-semibold tracking-tight text-white leading-none">{publishedCode}</div>

                        <div className="mt-4 text-[11px] font-semibold text-white/70">Share link</div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 overflow-hidden">
                            <span className="inline-flex items-center gap-2">
                              <LinkIcon className="h-4 w-4 text-white/55" />
                              <span className="truncate">{publishedUrl}</span>
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              await copyToClipboard(publishedUrl);
                            }}
                            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-[12px] font-semibold text-white/90 hover:bg-white/10"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Copy className="h-4 w-4" />
                              Copy
                            </span>
                          </button>
                        </div>

                        <div className="mt-4 text-[11px] text-white/45">
                          Published as <span className="text-white/70 font-semibold">Free</span> during beta.
                        </div>
                      </div>

                      <div className="col-span-12 lg:col-span-5 rounded-3xl border border-white/10 bg-black/35 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold text-white/70">QR</div>
                          <button
                            type="button"
                            onClick={async () => {
                              setQrBusy(true);
                              try {
                                const qr = await withTimeout(qrWithCenteredLogoDataUrl(publishedUrl), 9000, "QR render");
                                setQrDataUrl(qr);
                              } finally {
                                setQrBusy(false);
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Regenerate
                          </button>
                        </div>

                        <div className="mt-3 grid place-items-center rounded-3xl border border-white/10 bg-black/40 p-3">
                          <div className="h-[220px] w-[220px] overflow-hidden rounded-2xl bg-white/[0.03] grid place-items-center">
                            {qrBusy ? (
                              <div className="inline-flex items-center gap-2 text-[12px] text-white/60">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating…
                              </div>
                            ) : qrDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={qrDataUrl} alt="Edgaze QR" className="h-full w-full object-cover" />
                            ) : (
                              <div className="text-[12px] text-white/55">{qrErr || "QR unavailable"}</div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={!qrDataUrl}
                            onClick={() => (qrDataUrl ? downloadDataUrl(qrDataUrl, `edgaze-qr-${publishedCode || "prompt"}.png`) : null)}
                            className={cx(
                              "h-10 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 text-[12px] font-semibold text-white/90 hover:bg-white/10",
                              !qrDataUrl && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <span className="inline-flex items-center gap-2 justify-center w-full">
                              <Download className="h-4 w-4" />
                              Download
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-[11px] text-white/45">
                      You agreed to Terms, Privacy Policy, and Community Guidelines at publish time.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Asset picker */}
          {assetPickerOpen ? (
            <AssetPickerModal
              onClose={() => setAssetPickerOpen(false)}
              onPick={(asset: any) => {
                const url = asset?.url || "";
                if (url) {
                  onMetaChange?.({ ...meta, thumbnailUrl: url });
                  // if picking asset, clear upload to avoid confusion
                  setThumbnailFile(null);
                }
                setAssetPickerOpen(false);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
