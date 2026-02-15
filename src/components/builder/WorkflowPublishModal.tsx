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
import { cx } from "../../lib/cx";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { stripGraphSecrets } from "../../lib/workflow/stripGraphSecrets";
import { generateWorkflowThumbnailFile } from "./workflowThumbnailGenerator";
import FoundingCreatorBadge from "../ui/FoundingCreatorBadge";
import ProfileAvatar from "../ui/ProfileAvatar";
import ProfileLink from "../ui/ProfileLink";

type MonetisationMode = "free" | "paywall" | "subscription";
type Visibility = "public" | "unlisted" | "private";

type DraftRow = {
  id: string;
  owner_id: string;
  title: string;
  graph?: any;
  graph_json?: any;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  draft: DraftRow | null;
  editId?: string | null; // If provided, we're editing an existing workflow

  owner?: {
    name?: string;
    handle?: string;
    avatarUrl?: string | null;
  };

  onEnsureDraftSaved?: () => Promise<void>;
  onPublished?: () => void; // will be called ONLY when user clicks Done
};

const BUCKET = "workflow-media";
type PublishTab = "details" | "pricing" | "media" | "visibility";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function safeArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function initials(name?: string | null) {
  const s = (name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

function slugify(input: string) {
  const base = (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `workflow-${suffix}`;
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
  const t = (title || "").trim();
  if (!t) return "workflow";
  const base = normalizeEdgazeCode(t);
  return base || "workflow";
}

function randomSuffix(len = 4) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function toPublicUrl(supabase: any, path: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function uploadFileToBucket(opts: {
  supabase: any;
  userId: string;
  workflowId: string;
  kind: "thumbnail" | "demo" | "qr";
  index?: number;
  file: File;
}) {
  const ext = (opts.file.name.split(".").pop() || "png").toLowerCase();
  const cleanExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 6) || "png";

  const filename =
    opts.kind === "thumbnail"
      ? `thumbnail.${cleanExt}`
      : opts.kind === "qr"
        ? `edgaze-qr.${cleanExt}`
        : `demo-${String(opts.index ?? 0).padStart(2, "0")}.${cleanExt}`;

  const path = `${opts.userId}/workflows/${opts.workflowId}/${filename}`;

  const { error } = await opts.supabase.storage.from(BUCKET).upload(path, opts.file, {
    upsert: true,
    cacheControl: "3600",
    contentType: opts.file.type || undefined,
  });

  if (error) throw error;

  return { path, url: toPublicUrl(opts.supabase, path) };
}

async function codeExistsInTables(supabase: any, code: string, excludeWorkflowId?: string | null) {
  const normalized = normalizeEdgazeCode(code);
  if (!normalized) return true;

  const [w, p] = await Promise.all([
    supabase
      .from("workflows")
      .select("id")
      .eq("edgaze_code", normalized)
      .limit(1),
    supabase.from("prompts").select("id").eq("edgaze_code", normalized).limit(1),
  ]);

  if (w?.error) throw w.error;
  if (p?.error) throw p.error;

  // If editing, exclude the current workflow from the check
  const wHas = Array.isArray(w?.data) && w.data.length > 0 && 
    (!excludeWorkflowId || !w.data.some((row: any) => row.id === excludeWorkflowId));
  const pHas = Array.isArray(p?.data) && p.data.length > 0;
  return wHas || pHas;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

async function qrDataUrlLocal(text: string): Promise<string> {
  // Preferred: local QR generation (no CORS)
  try {
    const mod: any = await import("qrcode");
    const QRCode = mod?.default ?? mod;
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "H",
      margin: 1,
      scale: 10,
      color: { dark: "#0b0c10", light: "#ffffff" },
    });
    return String(dataUrl);
  } catch {
    // Fallback: remote QR if dependency not installed (can fail in some envs)
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("QR fetch failed");
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Failed to read QR blob"));
      r.readAsDataURL(blob);
    });
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

  // Center badge
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

  // Logo
  const logo = await loadImage("/brand/edgaze-mark.png");
  const logoSize = 120;
  ctx.drawImage(logo, (900 - logoSize) / 2, (900 - logoSize) / 2, logoSize, logoSize);

  return canvas.toDataURL("image/png");
}

function ConfettiSides({ active }: { active: boolean }) {
  const [leftStyles, setLeftStyles] = useState<Array<Record<string, string>>>([]);
  const [rightStyles, setRightStyles] = useState<Array<Record<string, string>>>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setLeftStyles(
        Array.from({ length: 45 }, () => ({
          left: `${Math.random() * 100}%`,
          top: "-12%",
          animationDelay: `${Math.random() * 0.25}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
        }))
      );
      setRightStyles(
        Array.from({ length: 45 }, () => ({
          left: `${Math.random() * 100}%`,
          top: "-12%",
          animationDelay: `${Math.random() * 0.25}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
        }))
      );
    });
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[18%]">
        {leftStyles.length > 0 && leftStyles.map((style, i) => (
          <span key={`l-${i}`} className="confetti" style={style} />
        ))}
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-[18%]">
        {rightStyles.length > 0 && rightStyles.map((style, i) => (
          <span key={`r-${i}`} className="confetti" style={style} />
        ))}
      </div>

      <style jsx>{`
        .confetti {
          position: absolute;
          width: 10px;
          height: 16px;
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

export default function WorkflowPublishModal({
  open,
  onClose,
  draft,
  editId,
  owner,
  onEnsureDraftSaved,
  onPublished,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [postingAs, setPostingAs] = useState<{
    name: string;
    handle: string;
    avatarUrl: string | null;
    userId: string;
  } | null>(null);

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

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [published, setPublished] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const thumbInputRef = useRef<HTMLInputElement | null>(null);
  const demoInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const draftGraph = useMemo(() => draft?.graph_json ?? draft?.graph ?? null, [draft]);

  const cleanTags = useMemo(() => {
    const raw = safeArr(tagsInput);
    const cleaned = raw.map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 10);
    return Array.from(new Set(cleaned));
  }, [tagsInput]);

  const safeTitle = useMemo(() => {
    const t = title.trim() || draft?.title?.trim() || "";
    return t || "Untitled workflow";
  }, [title, draft]);

  const safeDescription = useMemo(() => {
    return description.trim() || "Short description of what this workflow does.";
  }, [description]);

  const pricePill = useMemo(() => {
    if (monetisationMode === "paywall") {
      const n = Number(priceUsd);
      const v = Number.isFinite(n) ? clamp(n, 0, 9999) : 0;
      return `$${v.toFixed(2)}`;
    }
    if (monetisationMode === "subscription") return "Subscription";
    return "Free";
  }, [monetisationMode, priceUsd]);

  const previewThumbSrc = useMemo(() => {
    if (thumbnailFile) return URL.createObjectURL(thumbnailFile);
    if (autoThumbDataUrl) return autoThumbDataUrl;
    return null;
  }, [thumbnailFile, autoThumbDataUrl]);

  // Load auth/profile for postingAs
  useEffect(() => {
    if (!open) return;

    let alive = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;

        if (!alive) return;

        if (!user?.id) {
          setPostingAs({
            name: owner?.name || "You",
            handle: owner?.handle || "you",
            avatarUrl: owner?.avatarUrl || null,
            userId: "",
          });
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id,full_name,handle,avatar_url")
          .eq("id", user.id)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        const name = data?.full_name || owner?.name || "You";
        const handle = data?.handle || owner?.handle || "you";

        setPostingAs({
          name,
          handle,
          avatarUrl: data?.avatar_url || owner?.avatarUrl || null,
          userId: user.id,
        });
      } catch {
        setPostingAs({
          name: owner?.name || "You",
          handle: owner?.handle || "you",
          avatarUrl: owner?.avatarUrl || null,
          userId: "",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, supabase, owner?.name, owner?.handle, owner?.avatarUrl]);

  // Reset modal state on open
  useEffect(() => {
    if (!open) return;

    setTab("details");
    setErr(null);
    setBusy(false);

    setPublished(false);
    setPublishedUrl("");
    setQrDataUrl(null);
    setQrBusy(false);
    setConfetti(false);

    // Load existing data when editing
    if (editId && draft) {
      setTitle(draft.title || "");
      setDescription((draft as any).description || "");
      setTagsInput((draft as any).tags || "");
      setVisibility(((draft as any).visibility || "public") as Visibility);
      setMonetisationMode(((draft as any).monetisation_mode || "free") as MonetisationMode);
      setPriceUsd((draft as any).price_usd != null ? String((draft as any).price_usd) : "2.99");
      setEdgazeCode((draft as any).edgaze_code || baseCodeFromTitle(draft.title || ""));
      
      // Load existing demo images if available
      const existingDemos = (draft as any).demo_images || (draft as any).output_demo_urls;
      if (Array.isArray(existingDemos) && existingDemos.length > 0) {
        // We'll keep these as URLs, not files - they're already uploaded
        setDemoFiles(new Array(6).fill(null));
      } else {
        setDemoFiles(new Array(6).fill(null));
      }
    } else {
      setTitle(draft?.title || "");
      setDescription("");
      setTagsInput("");
      setVisibility("public");
      setMonetisationMode("free");
      setPriceUsd("2.99");
      setDemoFiles(new Array(6).fill(null));
      const seeded = baseCodeFromTitle(draft?.title || "");
      setEdgazeCode(seeded);
    }

    setThumbnailFile(null);
    setAutoThumbFile(null);
    setAutoThumbDataUrl(null);
    setAutoThumbBusy(false);

    setCodeStatus("checking");
    setCodeMsg("Checking availability…");
  }, [open, draft?.id, editId]);

  // Code availability check (debounced)
  useEffect(() => {
    if (!open) return;
    if (!postingAs) return;

    const code = normalizeEdgazeCode(edgazeCode);
    if (!code) {
      setCodeStatus("invalid");
      setCodeMsg("Use letters/numbers/-, max 32 chars.");
      return;
    }

    // keep normalized in state
    if (edgazeCode !== code) setEdgazeCode(code);

    if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    codeDebounceRef.current = setTimeout(async () => {
      try {
        if (lastCheckedCodeRef.current === code) return;
        lastCheckedCodeRef.current = code;

        setCodeStatus("checking");
        setCodeMsg("Checking availability…");

        const exists = await codeExistsInTables(supabase, code, editId || null);
        if (exists) {
          setCodeStatus("taken");
          setCodeMsg("Code is taken. Try a different one.");
        } else {
          setCodeStatus("available");
          setCodeMsg("Available.");
        }
      } catch (e: any) {
        setCodeStatus("taken");
        setCodeMsg(e?.message ? `Check failed: ${e.message}` : "Could not verify code. Try again.");
      }
    }, 240);

    return () => {
      if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    };
  }, [open, edgazeCode, supabase, postingAs, editId]);

  // Auto thumbnail generation ON OPEN (no manual trigger)
  useEffect(() => {
    if (!open) return;
    if (!draft?.id) return;
    if (!draftGraph) return;

    // Always generate fresh when modal opens (unless user has uploaded custom)
    if (thumbnailFile) return;

    let alive = true;
    (async () => {
      try {
        setAutoThumbBusy(true);

        const { file, dataUrl } = await generateWorkflowThumbnailFile({
          graph: draftGraph,
          workflowId: draft.id,
          width: 1200,
          height: 630,
          blurPx: 0,
        });

        if (!alive) return;

        setAutoThumbFile(file);
        setAutoThumbDataUrl(dataUrl);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to generate thumbnail.");
      } finally {
        if (alive) setAutoThumbBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, draft?.id, draftGraph, thumbnailFile]);

  function closeNow() {
    if (busy) return;
    onClose();
  }

  async function handlePickThumbnail(file: File | null) {
    setErr(null);
    if (!file) return;
    setThumbnailFile(file);
  }

  async function handlePickDemo(index: number, file: File | null) {
    setErr(null);
    setDemoFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

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

  async function ensureAvailableCodeOrAutofix() {
    const base = normalizeEdgazeCode(edgazeCode) || baseCodeFromTitle(safeTitle);
    try {
      const exists = await codeExistsInTables(supabase, base, editId || null);
      if (!exists) {
        setEdgazeCode(base);
        setCodeStatus("available");
        setCodeMsg("Available.");
        return base;
      }
      for (let i = 0; i < 8; i++) {
        const candidate = `${base.slice(0, 24)}-${randomSuffix(4)}`.slice(0, 32);
        const taken = await codeExistsInTables(supabase, candidate, editId || null);
        if (!taken) {
          setEdgazeCode(candidate);
          setCodeStatus("available");
          setCodeMsg("Available.");
          return candidate;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async function generateQrAndMaybeUpload(opts: { url: string; userId: string; workflowId: string }) {
    setQrBusy(true);
    try {
      const qr = await qrWithCenteredLogoDataUrl(opts.url);
      setQrDataUrl(qr);

      // Upload QR as file (optional)
      try {
        const blob = await (await fetch(qr)).blob();
        const qrFile = new File([blob], `edgaze-qr-${normalizeEdgazeCode(edgazeCode)}.png`, { type: "image/png" });
        await uploadFileToBucket({
          supabase,
          userId: opts.userId,
          workflowId: opts.workflowId,
          kind: "qr",
          file: qrFile,
        });
      } catch {
        // ignore
      }
    } finally {
      setQrBusy(false);
    }
  }

  async function handlePublish() {
    if (!draft?.id) {
      setErr("Open a draft first.");
      return;
    }
    if (!postingAs?.userId) {
      setErr("You must be signed in to publish.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      if (onEnsureDraftSaved) await onEnsureDraftSaved();

      const graph = draftGraph;
      const workflowId = draft.id;
      const userId = postingAs.userId;

      // Ensure code is available or auto-fix
      const normalized = normalizeEdgazeCode(edgazeCode);
      if (!normalized) {
        setErr("Edgaze code is invalid.");
        setBusy(false);
        return;
      }

      let finalCode = normalized;
      if (codeStatus !== "available") {
        const fixed = await ensureAvailableCodeOrAutofix();
        if (!fixed) {
          setErr("Pick a unique Edgaze code.");
          setBusy(false);
          return;
        }
        finalCode = fixed;
      }

      const slug = slugify(safeTitle);

      // Upload thumbnail (only if new file provided, otherwise preserve existing)
      let thumbnailUrl: string | null = null;
      const thumbToUpload = thumbnailFile ?? autoThumbFile;
      if (thumbToUpload) {
        const up = await uploadFileToBucket({
          supabase,
          userId,
          workflowId,
          kind: "thumbnail",
          file: thumbToUpload,
        });
        thumbnailUrl = up.url || null;
      } else if (editId && (draft as any)?.thumbnail_url) {
        // Preserve existing thumbnail when editing
        thumbnailUrl = (draft as any).thumbnail_url;
      }

      // Upload demo images (optional)
      const demoUrls: string[] = [];
      
      // Preserve existing demo URLs when editing
      if (editId) {
        const existingDemos = (draft as any)?.demo_images || (draft as any)?.output_demo_urls;
        if (Array.isArray(existingDemos)) {
          demoUrls.push(...existingDemos.filter(Boolean));
        }
      }
      
      // Add new demo files
      for (let i = 0; i < demoFiles.length; i++) {
        const f = demoFiles[i];
        if (!f) continue;
        const up = await uploadFileToBucket({
          supabase,
          userId,
          workflowId,
          kind: "demo",
          index: i,
          file: f,
        });
        if (up.url) demoUrls.push(up.url);
      }

      const row: any = {
        id: workflowId,
        owner_id: userId, // uuid column
        user_id: userId, // text column in your schema (keep both)
        owner_name: postingAs.name,
        owner_handle: postingAs.handle,

        title: safeTitle,
        slug,

        description: safeDescription,
        tags: cleanTags.join(","),

        visibility,
        is_public: visibility !== "private",

        monetisation_mode: monetisationMode,
        is_paid: monetisationMode === "paywall",
        price_usd: monetisationMode === "paywall" ? Number(priceUsd || 0) : 0,

        thumbnail_url: thumbnailUrl,
        demo_images: demoUrls.length ? demoUrls : null,

        graph_json: stripGraphSecrets(graph) as any,
        graph: stripGraphSecrets(graph) as any,

        edgaze_code: finalCode,

        is_published: true,
        // Only set published_at if this is a new publish, not an edit
        ...(editId ? {} : { published_at: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase.from("workflows").upsert(row, { onConflict: "id" });
      if (upsertErr) throw upsertErr;

      // Build published URL - use current origin (works for localhost and production)
      const origin = typeof window !== "undefined" ? window.location.origin : "https://edgaze.ai";
      const url = `${origin}/${postingAs.handle}/${finalCode}`;
      setPublishedUrl(url);

      // Generate QR now (inside modal)
      await generateQrAndMaybeUpload({ url, userId, workflowId });

      // Show success UI (DO NOT call onPublished here; parent would close modal)
      setPublished(true);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 1200);
    } catch (e: any) {
      setErr(e?.message || "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const canPublish = !!draft?.id && !busy && codeStatus === "available";
  const handle = postingAs?.handle || owner?.handle || "you";
  const shownCode = normalizeEdgazeCode(edgazeCode);

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/80" onClick={published ? undefined : closeNow} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-[min(1180px,96vw)] h-[min(780px,92vh)] rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.75)] overflow-hidden">
          <ConfettiSides active={confetti} />

          {/* Header */}
          <div className="h-[76px] px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={32}
                height={32}
                className="h-8 w-8"
                priority
              />
              <div>
                <div className="text-[16px] font-semibold text-white leading-tight">
                  {published ? "Published" : editId ? "Edit workflow" : "Publish workflow"}
                </div>
                <div className="text-[11px] text-white/45">
                  Posting as {postingAs?.name || owner?.name || "…"} @{handle}
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
                  title={
                    !draft?.id
                      ? "Open a draft first"
                      : codeStatus !== "available"
                        ? "Pick a unique Edgaze code"
                        : editId ? "Update workflow" : "Publish workflow"
                  }
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editId ? "Updating…" : "Publishing…"}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {editId ? "Update" : "Publish"}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    // Now we close + notify parent
                    try {
                      onPublished?.();
                    } finally {
                      onClose();
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold bg-white text-black hover:bg-white/90"
                >
                  Done
                </button>
              )}

              <button
                onClick={published ? () => {} : closeNow}
                className={cx(
                  "h-10 w-10 rounded-full border border-white/12 bg-white/5 text-white/85 grid place-items-center",
                  published ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
                )}
                aria-label="Close"
                title={published ? "Finish with Done" : "Close"}
                disabled={published}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {published ? (
            <div className="h-[calc(100%-76px)] p-6">
              <div className="h-full rounded-3xl border border-white/10 bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(34,211,238,0.14),transparent_55%),radial-gradient(900px_500px_at_90%_0%,rgba(232,121,249,0.12),transparent_55%),linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.55))] p-8 flex flex-col">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                  <div className="text-white text-xl font-semibold">Published</div>
                </div>

                <div className="mt-2 text-sm text-white/60">
                  Your workflow is live. Share it.
                </div>

                <div className="mt-7 grid grid-cols-12 gap-6 flex-1 min-h-0">
                  <div className="col-span-12 md:col-span-7 rounded-3xl border border-white/10 bg-black/35 p-6 min-h-0">
                    <div className="text-[12px] font-semibold text-white/80">Edgaze code</div>
                    <div className="mt-2 text-[44px] leading-none font-semibold text-white tracking-tight">
                      {shownCode || "—"}
                    </div>

                    <div className="mt-6">
                      <div className="text-[12px] font-semibold text-white/80">Share link</div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[12px] text-white/85 overflow-hidden">
                          <span className="inline-flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-white/60" />
                            <span className="truncate">{publishedUrl}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(publishedUrl)}
                          className="h-11 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 inline-flex items-center gap-2 text-[12px] font-semibold"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Allow regenerating QR if it failed
                          if (!publishedUrl || !postingAs?.userId || !draft?.id) return;
                          generateQrAndMaybeUpload({
                            url: publishedUrl,
                            userId: postingAs.userId,
                            workflowId: draft.id,
                          }).catch(() => {});
                        }}
                        className="h-11 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 inline-flex items-center gap-2 text-[12px] font-semibold"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Regenerate QR
                      </button>
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-5 rounded-3xl border border-white/10 bg-black/35 p-6 flex flex-col items-center justify-center">
                    <div className="text-[12px] font-semibold text-white/80">QR code</div>
                    <div className="mt-4 w-[240px] h-[240px] rounded-3xl border border-white/10 bg-white/[0.03] grid place-items-center overflow-hidden">
                      {qrBusy ? (
                        <div className="text-[12px] text-white/60 inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating…
                        </div>
                      ) : qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrDataUrl} alt="Edgaze QR" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-[12px] text-white/60">QR not available</div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() =>
                          qrDataUrl
                            ? downloadDataUrl(qrDataUrl, `edgaze-qr-${shownCode || "workflow"}.png`)
                            : null
                        }
                        disabled={!qrDataUrl}
                        className={cx(
                          "h-11 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 inline-flex items-center gap-2 text-[12px] font-semibold",
                          !qrDataUrl && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                      <button
                        onClick={() => copyToClipboard(publishedUrl)}
                        className="h-11 px-4 rounded-2xl bg-white text-black hover:bg-white/90 inline-flex items-center gap-2 text-[12px] font-semibold"
                      >
                        <Copy className="h-4 w-4" />
                        Copy link
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-[11px] text-white/45">
                  If QR doesn’t scan on some phones, increase screen brightness and try again.
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[calc(100%-76px)] grid grid-cols-12 overflow-hidden">
              {/* Left rail */}
              <div className="col-span-12 md:col-span-3 border-r border-white/10 p-6 overflow-auto">
                <div className="text-[12px] font-semibold text-white/85">Publish</div>
                <div className="mt-1 text-[11px] text-white/45">Set listing details, pricing and media.</div>

                <div className="mt-6 space-y-3">
                  <RailButton
                    active={tab === "details"}
                    title="Details"
                    desc="Title, description, tags, Edgaze code."
                    onClick={() => setTab("details")}
                  />
                  <RailButton
                    active={tab === "pricing"}
                    title="Pricing"
                    desc="Free only (payments unavailable during beta)."
                    onClick={() => setTab("pricing")}
                  />
                  <RailButton
                    active={tab === "media"}
                    title="Media"
                    desc="Thumbnail + output demo images."
                    onClick={() => setTab("media")}
                  />
                  <RailButton
                    active={tab === "visibility"}
                    title="Visibility"
                    desc="Public, unlisted, private."
                    onClick={() => setTab("visibility")}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
                  <ProfileAvatar
                    name={postingAs?.name || owner?.name || "You"}
                    avatarUrl={postingAs?.avatarUrl || null}
                    size={40}
                    handle={handle}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <ProfileLink
                        name={postingAs?.name || owner?.name || "You"}
                        handle={handle}
                        showBadge={true}
                        badgeSize="md"
                        className="min-w-0 truncate text-[12px] text-white/90 font-semibold"
                      />
                    </div>
                    <ProfileLink
                      name={`@${handle}`}
                      handle={handle}
                      className="truncate text-[11px] text-white/45"
                    />
                  </div>
                </div>
              </div>

              {/* Right content */}
              <div className="col-span-12 md:col-span-9 p-6 overflow-auto">
                {err ? (
                  <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100 text-[12px] flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 mt-[1px]" />
                    <div className="leading-relaxed">{err}</div>
                  </div>
                ) : null}

                {/* Preview card */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="grid grid-cols-12">
                    <div className="col-span-12 md:col-span-6 p-5">
                      <div className="text-[11px] text-white/45">Preview</div>
                      <div className="mt-1 text-white text-[16px] font-semibold">{safeTitle}</div>
                      <div className="mt-2 text-[12px] text-white/60 leading-relaxed">{safeDescription}</div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-3 py-1 text-[11px] text-white/85">
                          Prompt
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-3 py-1 text-[11px] text-white/85">
                          {pricePill}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-4 text-[11px] text-white/55">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <ProfileAvatar
                            name={postingAs?.name || "You"}
                            avatarUrl={postingAs?.avatarUrl || null}
                            size={32}
                            handle={handle}
                          />
                          <span className="flex flex-wrap items-center gap-2">
                            <ProfileLink
                              name={postingAs?.name || "You"}
                              handle={handle}
                              showBadge={true}
                              badgeSize="md"
                              className="min-w-0 truncate text-white/75"
                            />
                          </span>
                          <ProfileLink
                            name={`@${handle}`}
                            handle={handle}
                            className="truncate text-white/35"
                          />
                        </span>
                        <span className="inline-flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-white/45">views</span>
                            <span className="text-white/75">14</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-white/45">likes</span>
                            <span className="text-white/75">83</span>
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-6 border-t md:border-t-0 md:border-l border-white/10 p-5">
                      <div className="text-[11px] text-white/45">Thumbnail</div>

                      <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 overflow-hidden aspect-[1200/630]">
                        {previewThumbSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewThumbSrc} alt="Workflow thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-[12px] text-white/55">
                            {autoThumbBusy ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating preview…
                              </span>
                            ) : (
                              <span>Preview will appear here.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section content */}
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  {tab === "details" ? (
                    <div className="space-y-5">
                      <div>
                        <div className="text-[12px] font-semibold text-white/85">Title</div>
                        <input
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            // If user hasn't manually changed code, keep it derived from title
                            if (!edgazeCode || edgazeCode === baseCodeFromTitle(draft?.title || "")) {
                              setEdgazeCode(baseCodeFromTitle(e.target.value));
                            }
                          }}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-white outline-none focus:border-white/20"
                          placeholder="Give your workflow a clear title"
                        />
                      </div>

                      <div>
                        <div className="text-[12px] font-semibold text-white/85">Description</div>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="mt-2 w-full min-h-[110px] rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-white/90 outline-none focus:border-white/20"
                          placeholder="What does this workflow do? Who is it for?"
                        />
                      </div>

                      <div>
                        <div className="text-[12px] font-semibold text-white/85">Tags</div>
                        <div className="mt-1 text-[11px] text-white/45">Comma-separated (max 10)</div>
                        <input
                          value={tagsInput}
                          onChange={(e) => setTagsInput(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-white outline-none focus:border-white/20"
                          placeholder="e.g. study, automation, youtube"
                        />
                      </div>

                      <div>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-[12px] font-semibold text-white/85">Edgaze code</div>
                            <div className="text-[11px] text-white/45">This becomes: edgaze.ai/&lt;handle&gt;/&lt;code&gt;</div>
                          </div>
                          <button
                            onClick={() => {
                              const base = baseCodeFromTitle(safeTitle);
                              setEdgazeCode(base);
                              setCodeStatus("checking");
                              setCodeMsg("Checking availability…");
                            }}
                            className="text-[11px] text-white/70 hover:text-white/90"
                          >
                            Reset to title
                          </button>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={edgazeCode}
                            onChange={(e) => setEdgazeCode(e.target.value)}
                            className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-white outline-none focus:border-white/20"
                            placeholder="my-workflow"
                          />
                          <button
                            onClick={async () => {
                              const fixed = await ensureAvailableCodeOrAutofix();
                              if (!fixed) setErr("Could not find an available code. Try again.");
                            }}
                            className="h-11 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 text-[12px] font-semibold"
                          >
                            Auto-fix
                          </button>
                        </div>

                        <div className="mt-2 text-[11px]">
                          <span
                            className={cx(
                              "inline-flex items-center gap-2",
                              codeStatus === "available" && "text-emerald-200",
                              (codeStatus === "taken" || codeStatus === "invalid") && "text-amber-200",
                              codeStatus === "checking" && "text-white/60",
                              codeStatus === "idle" && "text-white/50"
                            )}
                          >
                            {codeStatus === "checking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            {codeMsg || (codeStatus === "available" ? "Available." : "")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "pricing" ? (
                    <div className="space-y-5">
                      <div>
                        <div className="text-[12px] font-semibold text-white/85">Monetisation</div>
                        <div className="text-[11px] text-white/50 mt-1">
                          Payments unavailable during beta. Only Free is available.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(["free", "paywall", "subscription"] as MonetisationMode[]).map((m) => {
                            const disabled = m !== "free";
                            return (
                              <button
                                key={m}
                                type="button"
                                disabled={disabled}
                                onClick={() => !disabled && setMonetisationMode(m)}
                                className={cx(
                                  "rounded-2xl border px-4 py-3 text-[12px] font-semibold transition-colors",
                                  disabled
                                    ? "border-white/10 bg-white/[0.02] text-white/50 opacity-70 cursor-not-allowed"
                                    : monetisationMode === m
                                      ? "border-white/18 bg-white/[0.08] text-white"
                                      : "border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.04]"
                                )}
                              >
                                {m === "free" ? "Free" : m === "paywall" ? "Paywall" : "Subscription"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "media" ? (
                    <div className="space-y-6">
                      <div>
                        <div className="text-[12px] font-semibold text-white/85">Thumbnail</div>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          <button
                            onClick={() => thumbInputRef.current?.click()}
                            className="h-11 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 inline-flex items-center gap-2 text-[12px] font-semibold"
                          >
                            <Upload className="h-4 w-4" />
                            Upload thumbnail
                          </button>
                          <button
                            onClick={() => {
                              // force regenerate
                              setThumbnailFile(null);
                              setAutoThumbFile(null);
                              setAutoThumbDataUrl(null);
                              setAutoThumbBusy(false);
                              setErr(null);
                            }}
                            className="h-11 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 inline-flex items-center gap-2 text-[12px] font-semibold"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reset to auto
                          </button>

                          <input
                            ref={thumbInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePickThumbnail(e.target.files?.[0] ?? null)}
                          />
                          <div className="text-[11px] text-white/45">
                            Auto preview is generated from your graph.
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[12px] font-semibold text-white/85">Output demo images</div>
                        <div className="mt-1 text-[11px] text-white/45">Up to 6 images.</div>

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                          {demoFiles.map((f, i) => (
                            <button
                              key={i}
                              onClick={() => demoInputRefs.current[i]?.click()}
                              className="aspect-[4/3] rounded-2xl border border-white/10 bg-black/35 hover:bg-black/45 transition-colors overflow-hidden grid place-items-center"
                            >
                              {f ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={URL.createObjectURL(f)} alt={`demo ${i + 1}`} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-[11px] text-white/55">Add demo</div>
                              )}
                              <input
                                ref={(el) => {
                                  demoInputRefs.current[i] = el;
                                }}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handlePickDemo(i, e.target.files?.[0] ?? null)}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "visibility" ? (
                    <div className="space-y-4">
                      <div className="text-[12px] font-semibold text-white/85">Visibility</div>
                      <div className="text-[11px] text-white/50 mt-1">
                        During beta, only <span className="text-white/80 font-semibold">Public</span> is available.
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["public", "unlisted", "private"] as Visibility[]).map((v) => {
                          const disabled = v !== "public";
                          return (
                            <button
                              key={v}
                              type="button"
                              disabled={disabled}
                              onClick={() => !disabled && setVisibility(v)}
                              className={cx(
                                "rounded-2xl border px-4 py-3 text-[12px] font-semibold transition-colors",
                                disabled
                                  ? "border-white/10 bg-white/[0.02] text-white/50 opacity-70 cursor-not-allowed"
                                  : visibility === v
                                    ? "border-white/18 bg-white/[0.08] text-white"
                                    : "border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.04]"
                              )}
                            >
                              {v === "public" ? "Public" : v === "unlisted" ? "Unlisted" : "Private"}
                              {disabled ? " (unavailable)" : ""}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-white/45 leading-relaxed">
                        Public = discoverable. Unlisted and Private are unavailable during beta.
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 text-[11px] text-white/40">
                  By publishing, you confirm you have rights to the content and agree to Edgaze Terms.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
