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
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import AssetPickerModal from "../assets/AssetPickerModal";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type PlaceholderDef = {
  name: string;
  question: string;
};

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription";
type PublishTab = "details" | "pricing" | "media" | "visibility";

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
  onPublished: () => void;
};

const BUCKET = "workflow-media";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Thumbnail prompt snippet: keep it readable in layout while still being a true excerpt.
 * Requirement: ONLY prompt text (no title/tags/price/etc) and blurred.
 */
function makePromptSnippetForThumb(full: string) {
  const cleaned = (full || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  // Use up to 18% for thumbnails (still just prompt text), hard-clamped.
  const pct = Math.max(40, Math.floor(cleaned.length * 0.18));
  const maxChars = Math.min(900, pct);
  const snippet = cleaned.slice(0, maxChars);
  return snippet + (cleaned.length > snippet.length ? "…" : "");
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function createPromptOnlyThumbnail(promptText: string): Promise<string> {
  const W = 1280;
  const H = 800; // 16:10

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Workflow-style gradient backdrop (teal -> purple)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "rgba(34, 211, 238, 1)");
  bg.addColorStop(1, "rgba(232, 121, 249, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Dark overlay
  ctx.fillStyle = "rgba(7, 8, 12, 0.74)";
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

  // Font size scales based on snippet length (fills space for short prompts)
  const len = snippet.length;
  const fontSize = len <= 120 ? 58 : len <= 220 ? 46 : len <= 360 ? 38 : 32;
  const lineH = Math.round(fontSize * 1.24);

  // Render text to offscreen so blur is consistent
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

  // Draw blurred text only (no other text)
  ctx.save();
  ctx.filter = "blur(16px)";
  ctx.globalAlpha = 0.95;
  ctx.drawImage(off, 0, 0);
  ctx.restore();

  // Extra veil to ensure unreadable
  ctx.save();
  const veil = ctx.createLinearGradient(textAreaX, textAreaY, textAreaX + textAreaW, textAreaY + textAreaH);
  veil.addColorStop(0, "rgba(0,0,0,0.18)");
  veil.addColorStop(1, "rgba(0,0,0,0.10)");
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
  if (!active) return null;
  const pieces = new Array(18).fill(null).map((_, i) => i);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {pieces.map((i) => {
        const left = i % 2 === 0;
        const x = left ? Math.random() * 18 : 82 + Math.random() * 18;
        const delay = Math.random() * 0.2;
        const size = 8 + Math.random() * 10;
        return (
          <div
            key={i}
            className="confetti"
            style={{
              left: `${x}%`,
              top: `-10%`,
              width: `${size}px`,
              height: `${size * 1.55}px`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
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

function RailButton({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full text-left rounded-2xl border p-4 transition-colors",
        active ? "border-white/14 bg-white/[0.06]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
      )}
    >
      <div className="text-[12px] font-semibold text-white/90">{title}</div>
      <div className="mt-1 text-[11px] text-white/45">{desc}</div>
    </button>
  );
}

/**
 * Prompt preview snippet: STRICT <= 10% of prompt, clamped to a sane upper bound.
 * This is used for paywall DB storage only.
 */
function makePromptPreviewStrict(text: string) {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const tenPct = Math.max(12, Math.floor(cleaned.length * 0.1));
  const maxChars = Math.min(420, tenPct); // <=10% and never huge
  const snippet = cleaned.slice(0, maxChars);
  return snippet + (cleaned.length > snippet.length ? "…" : "");
}

export default function PublishPromptModal({
  open,
  onClose,
  meta,
  onMetaChange,
  promptText,
  placeholders,
  onPublished,
}: Props) {
  const { userId, profile, requireAuth } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [tab, setTab] = useState<PublishTab>("details");

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
  const lastCheckedCodeRef = useRef<string>("");

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
    setMonetisationMode(meta?.paid ? "paywall" : "free");
    setPriceUsd(meta?.priceUsd || "2.99");

    // default code from title
    const base = baseCodeFromTitle(meta?.name || "");
    setEdgazeCode(base);

    // reset files
    setThumbnailFile(null);
    setAutoThumbFile(null);
    setAutoThumbDataUrl(null);
    setDemoFiles(new Array(6).fill(null));
    setDemoUrlsPicked(safeArr(meta?.demoImageUrls));

    setTab("details");
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
      paid: monetisationMode === "paywall",
      priceUsd,
      demoImageUrls: demoUrlsPicked,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, description, tagsInput, visibility, monetisationMode, priceUsd, demoUrlsPicked]);

  function closeNow() {
    if (busy) return;
    onClose();
  }

  async function checkCodeAvailability(code: string) {
    const c = normalizeEdgazeCode(code);
    if (!c || c.length < 3) {
      setCodeStatus("invalid");
      setCodeMsg("Code too short.");
      return;
    }

    setCodeStatus("checking");
    setCodeMsg("Checking…");

    lastCheckedCodeRef.current = c;

    const { data, error } = await supabase.from("prompts").select("id").eq("edgaze_code", c).limit(1);

    if (error) {
      setCodeStatus("idle");
      setCodeMsg("Could not check.");
      return;
    }

    const taken = Array.isArray(data) && data.length > 0;
    setCodeStatus(taken ? "taken" : "available");
    setCodeMsg(taken ? "Taken" : "Available");
  }

  useEffect(() => {
    if (!open) return;

    if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);

    const c = normalizeEdgazeCode(edgazeCode);
    if (!c) {
      setCodeStatus("invalid");
      setCodeMsg("Invalid code.");
      return;
    }

    codeDebounceRef.current = setTimeout(() => {
      checkCodeAvailability(c);
    }, 450);

    return () => {
      if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgazeCode, open]);

  async function ensureAvailableCodeOrAutofix(): Promise<string | null> {
    const base = normalizeEdgazeCode(edgazeCode);
    if (!base) return null;

    // fast path
    const { data } = await supabase.from("prompts").select("id").eq("edgaze_code", base).limit(1);
    if (!data || data.length === 0) {
      setCodeStatus("available");
      setCodeMsg("Available");
      setEdgazeCode(base);
      return base;
    }

    // try a few suffixes
    for (let i = 0; i < 6; i++) {
      const next = `${base}-${randomSuffix(4)}`.slice(0, 32);
      const { data: d2 } = await supabase.from("prompts").select("id").eq("edgaze_code", next).limit(1);
      if (!d2 || d2.length === 0) {
        setCodeStatus("available");
        setCodeMsg("Available");
        setEdgazeCode(next);
        return next;
      }
    }

    setCodeStatus("taken");
    setCodeMsg("Pick another code.");
    return null;
  }

  async function generateAutoThumbnail() {
    setAutoThumbBusy(true);
    try {
      // ONLY prompt text (blurred), nothing else.
      const dataUrl = await createPromptOnlyThumbnail(promptText);

      setAutoThumbDataUrl(dataUrl);

      // convert to File
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

  useEffect(() => {
    if (!open) return;
    // generate once if no thumbnail
    if (!meta?.thumbnailUrl && !thumbnailFile && !autoThumbFile) {
      generateAutoThumbnail().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep auto thumbnail in sync if user changes prompt / pricing while in modal
  useEffect(() => {
    if (!open) return;
    if (tab !== "media") return;
    // only regenerate if user hasn't manually uploaded a thumbnail
    if (thumbnailFile) return;
    // debounce a bit
    const t = setTimeout(() => {
      generateAutoThumbnail().catch(() => {});
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText, open, tab, thumbnailFile]);

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

      // optional upload (never block UI forever)
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

  async function handlePublish() {
    setErr(null);

    if (!requireAuth()) {
      setErr("You must be signed in to publish.");
      return;
    }
    if (!userId) {
      setErr("You must be signed in to publish.");
      return;
    }

    const safeTitle = (title || "").trim();
    const safeDescription = (description || "").trim();

    if (!safeTitle) {
      setErr("Add a title.");
      setTab("details");
      return;
    }
    if (!safeDescription) {
      setErr("Add a description.");
      setTab("details");
      return;
    }
    if (!promptText.trim()) {
      setErr("Prompt text is empty.");
      setTab("details");
      return;
    }
    if (!placeholders.every((p) => (p.name || "").trim() && (p.question || "").trim())) {
      setErr("Fix placeholder fields before publishing.");
      setTab("details");
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

      // IMPORTANT: protect paid prompts immediately.
      // For paywall prompts, store ONLY <=10% preview in prompt_text.
      const preview = makePromptPreviewStrict(promptText);
      const storedPromptText = monetisationMode === "paywall" ? preview : promptText;

      const cleanTags = safeArr(tagsInput);

      const insertRow: any = {
        owner_id: userId,
        owner_name: ownerName,
        owner_handle: ownerHandle,

        type: "prompt",
        title: safeTitle,
        description: safeDescription,
        prompt_text: storedPromptText,
        placeholders,

        tags: cleanTags.join(","),
        visibility,
        monetisation_mode: monetisationMode,
        is_paid: monetisationMode === "paywall",
        price_usd: monetisationMode === "paywall" ? Number(priceUsd || 0) : 0,

        edgaze_code: finalCode,

        is_published: true,
        is_public: visibility !== "private",

        views_count: 0,
        likes_count: 0,
        runs_count: 0,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error: createErr } = await supabase.from("prompts").insert(insertRow).select("id").single();
      if (createErr) throw createErr;

      const promptId = created?.id as string;
      if (!promptId) throw new Error("Prompt created but ID missing.");

      let thumbnailUrl: string | null = null;

      if (meta.thumbnailUrl) {
        thumbnailUrl = meta.thumbnailUrl;
      } else {
        // Ensure we have an auto thumb if user didn't upload
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
      }

      const demoUrls: string[] = [];
      for (const u of demoUrlsPicked) if (u) demoUrls.push(u);

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

      const patch: any = {
        thumbnail_url: thumbnailUrl,
        demo_images: demoFinal.length ? demoFinal : null,
        output_demo_urls: demoFinal.length ? demoFinal : null,
        updated_at: new Date().toISOString(),
      };

      const { error: patchErr } = await supabase.from("prompts").update(patch).eq("id", promptId);
      if (patchErr) throw patchErr;

      const url = `https://edgaze.ai/p/${ownerHandle}/${finalCode}`;

      setPublishedCode(finalCode);
      setPublishedUrl(url);
      setPublished(true);

      setConfetti(true);
      setTimeout(() => setConfetti(false), 1200);

      await generateQrAndUpload({ url, userId, promptId });

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

  const safeTitle = (title || "").trim();
  const safeDescription = (description || "").trim();

  const canPublish =
    !busy &&
    !!userId &&
    codeStatus === "available" &&
    safeTitle.length > 0 &&
    safeDescription.length > 0 &&
    promptText.trim().length > 0 &&
    placeholders.every((p) => (p.name || "").trim() && (p.question || "").trim());

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/80" onClick={published ? undefined : closeNow} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-[min(1180px,96vw)] h-[min(780px,92vh)] rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.75)] overflow-hidden">
          <ConfettiSides active={confetti} />

          <div className="h-[76px] px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={32} height={32} className="h-8 w-8" priority />
              <div>
                <div className="text-[16px] font-semibold text-white leading-tight">
                  {published ? "Published" : "Publish prompt"}
                </div>
                <div className="text-[11px] text-white/45">
                  Posting as {ownerName} @{ownerHandle}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!published ? (
                <button
                  onClick={handlePublish}
                  disabled={!canPublish}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold",
                    "bg-white text-black hover:bg-white/90 transition-colors",
                    !canPublish && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Publish
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
              )}

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
          <div className="grid grid-cols-12 gap-0 h-[calc(100%-76px)]">
            {/* Left rail */}
            <div className="col-span-12 md:col-span-4 border-b md:border-b-0 md:border-r border-white/10 p-5">
              <div className="space-y-2">
                <RailButton active={tab === "details"} title="Details" desc="Title, description, code, tags." onClick={() => setTab("details")} />
                <RailButton active={tab === "pricing"} title="Pricing" desc="Free or paywall price." onClick={() => setTab("pricing")} />
                <RailButton active={tab === "media"} title="Media" desc="Thumbnail + demo images." onClick={() => setTab("media")} />
                <RailButton active={tab === "visibility"} title="Visibility" desc="Public / unlisted / private." onClick={() => setTab("visibility")} />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold text-white/70">Paywall protection</div>
                <div className="mt-1 text-[11px] text-white/50">
                  Paid prompts store only a preview in the database. Full prompt stays private.
                </div>
              </div>

              {err ? (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>{err}</div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Main panel */}
            <div className="col-span-12 md:col-span-8 p-5 overflow-auto">
              {!published ? (
                <>
                  {tab === "details" ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[12px] font-semibold text-white/80">Title</div>
                        <input
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            if (!edgazeCode) setEdgazeCode(baseCodeFromTitle(e.target.value));
                          }}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                          placeholder="Give it a strong title"
                        />
                      </div>

                      <div>
                        <div className="text-[12px] font-semibold text-white/80">Description</div>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="mt-2 w-full min-h-[110px] rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                          placeholder="What does this prompt do?"
                        />
                      </div>

                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-12 md:col-span-7">
                          <div className="text-[12px] font-semibold text-white/80">Edgaze code</div>
                          <input
                            value={edgazeCode}
                            onChange={(e) => setEdgazeCode(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                            placeholder="e.g. essay-wizard"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-5">
                          <div className="text-[12px] font-semibold text-white/80">Status</div>
                          <div className="mt-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[12px] text-white/70">
                            {codeStatus === "checking" ? "Checking…" : codeMsg || "—"}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[12px] font-semibold text-white/80">Tags</div>
                        <input
                          value={tagsInput}
                          onChange={(e) => setTagsInput(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/40"
                          placeholder="comma separated (ai, writing, study)"
                        />
                      </div>
                    </div>
                  ) : null}

                  {tab === "pricing" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Monetisation</div>
                        <div className="mt-3 grid grid-cols-12 gap-3">
                          <button
                            onClick={() => setMonetisationMode("free")}
                            className={cx(
                              "col-span-12 md:col-span-6 rounded-2xl border p-4 text-left",
                              monetisationMode === "free"
                                ? "border-cyan-400/30 bg-cyan-400/10"
                                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                            )}
                          >
                            <div className="text-[12px] font-semibold text-white">Free</div>
                            <div className="text-[11px] text-white/55 mt-1">Everyone can use it.</div>
                          </button>

                          <button
                            onClick={() => setMonetisationMode("paywall")}
                            className={cx(
                              "col-span-12 md:col-span-6 rounded-2xl border p-4 text-left",
                              monetisationMode === "paywall"
                                ? "border-pink-400/30 bg-pink-400/10"
                                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                            )}
                          >
                            <div className="text-[12px] font-semibold text-white">Paywall</div>
                            <div className="text-[11px] text-white/55 mt-1">Users must purchase to see full prompt.</div>
                          </button>
                        </div>

                        {monetisationMode === "paywall" ? (
                          <div className="mt-4">
                            <div className="text-[12px] font-semibold text-white/80">Price (USD)</div>
                            <input
                              value={priceUsd}
                              onChange={(e) => setPriceUsd(e.target.value)}
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[13px] text-white outline-none focus:border-pink-400/40"
                              placeholder="2.99"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {tab === "media" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-semibold text-white/85">Thumbnail</div>
                            <div className="text-[11px] text-white/50 mt-1">Upload or use auto-generated.</div>
                          </div>
                          <button
                            onClick={() => setAssetPickerOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10"
                          >
                            <Upload className="h-4 w-4" />
                            Pick from assets
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-12 gap-4">
                          <div className="col-span-12 md:col-span-6">
                            <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                              <div className="text-[11px] font-semibold text-white/70">Auto</div>
                              <div className="mt-3 aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                                {autoThumbDataUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={autoThumbDataUrl} alt="Auto thumbnail" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full grid place-items-center text-[11px] text-white/55">
                                    {autoThumbBusy ? "Generating…" : "No auto thumbnail"}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={generateAutoThumbnail}
                                disabled={autoThumbBusy}
                                className={cx(
                                  "mt-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10",
                                  autoThumbBusy && "opacity-60 cursor-not-allowed"
                                )}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Regenerate
                              </button>
                            </div>
                          </div>

                          <div className="col-span-12 md:col-span-6">
                            <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                              <div className="text-[11px] font-semibold text-white/70">Upload</div>
                              <input
                                type="file"
                                accept="image/*"
                                className="mt-3 block w-full text-[12px] text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-[12px] file:font-semibold file:text-black hover:file:bg-white/90"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  setThumbnailFile(f);
                                }}
                              />
                              <div className="mt-3 text-[11px] text-white/45">
                                If uploaded, your file overrides auto thumbnail.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Demo images (optional)</div>
                        <div className="text-[11px] text-white/50 mt-1">Up to 6.</div>

                        <div className="mt-4 grid grid-cols-12 gap-3">
                          {new Array(6).fill(null).map((_, i) => (
                            <div key={i} className="col-span-12 md:col-span-4 rounded-2xl border border-white/10 bg-black/35 p-3">
                              <div className="text-[11px] font-semibold text-white/70">Slot {i + 1}</div>
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
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "visibility" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-[12px] font-semibold text-white/85">Visibility</div>
                        <div className="mt-3 grid grid-cols-12 gap-3">
                          {(["public", "unlisted", "private"] as Visibility[]).map((v) => (
                            <button
                              key={v}
                              onClick={() => setVisibility(v)}
                              className={cx(
                                "col-span-12 md:col-span-4 rounded-2xl border p-4 text-left capitalize",
                                visibility === v
                                  ? "border-white/14 bg-white/[0.06]"
                                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                              )}
                            >
                              <div className="text-[12px] font-semibold text-white">{v}</div>
                              <div className="text-[11px] text-white/55 mt-1">
                                {v === "public" ? "Visible to everyone." : v === "unlisted" ? "Only via link." : "Only you."}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white">
                      <CheckCircle2 className="h-5 w-5 text-cyan-300" />
                      <div className="text-[14px] font-semibold">Published</div>
                    </div>

                    <div className="mt-4 grid grid-cols-12 gap-4">
                      <div className="col-span-12 md:col-span-7 rounded-3xl border border-white/10 bg-black/35 p-4">
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
                      </div>

                      <div className="col-span-12 md:col-span-5 rounded-3xl border border-white/10 bg-black/35 p-4">
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
                            onClick={() =>
                              qrDataUrl ? downloadDataUrl(qrDataUrl, `edgaze-qr-${publishedCode || "prompt"}.png`) : null
                            }
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
                      Paid prompts are protected (only a preview is stored publicly).
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {assetPickerOpen ? (
            <AssetPickerModal
              open={assetPickerOpen}
              onClose={() => setAssetPickerOpen(false)}
              onPick={(asset: any) => {
                const url = asset?.url || "";
                if (url) {
                  onMetaChange?.({ ...meta, thumbnailUrl: url });
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
