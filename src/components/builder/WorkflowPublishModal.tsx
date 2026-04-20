"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
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
  BadgeDollarSign,
  FileText,
  Globe2,
  Images,
} from "lucide-react";
import { cx } from "../../lib/cx";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../auth/AuthContext";
import { uploadListingMedia } from "../../lib/creator-provisioning/upload-listing-media";
import { generateWorkflowThumbnailFile } from "./workflowThumbnailGenerator";
import ProfileAvatar from "../ui/ProfileAvatar";
import ProfileLink from "../ui/ProfileLink";
import {
  WORKFLOW_MAX_USD,
  WORKFLOW_MIN_USD,
  validateWorkflowPrice,
} from "../../lib/marketplace/pricing";
import {
  estimateWorkflowCostForRuns,
  getMinimumWorkflowPrice,
  getRecommendedWorkflowPrice,
} from "../../lib/workflow/cost-estimation";
import { PayoutSystemCard } from "../publish/PayoutSystemCard";
import { createImageObjectUrl, sanitizeImageSrc } from "../../lib/security/safe-values";

type MonetisationMode = "free" | "paywall";
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

type PublishTab = "details" | "pricing" | "media" | "visibility";

const WORKFLOW_TABS: Array<{
  key: PublishTab;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "details",
    title: "Details",
    desc: "Title, description, tags, Edgaze code.",
    icon: FileText,
  },
  {
    key: "pricing",
    title: "Pricing",
    desc: "Free or set a price ($5-$150).",
    icon: BadgeDollarSign,
  },
  { key: "media", title: "Media", desc: "Thumbnail + output demo images.", icon: Images },
  { key: "visibility", title: "Visibility", desc: "Public, unlisted, private.", icon: Globe2 },
];

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
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}

async function codeExistsInTables(supabase: any, code: string, excludeWorkflowId?: string | null) {
  const normalized = normalizeEdgazeCode(code);
  if (!normalized) return true;

  const [w, p] = await Promise.all([
    supabase.from("workflows").select("id").eq("edgaze_code", normalized).limit(1),
    supabase.from("prompts").select("id").eq("edgaze_code", normalized).limit(1),
  ]);

  if (w?.error) throw w.error;
  if (p?.error) throw p.error;

  // If editing, exclude the current workflow from the check
  const wHas =
    Array.isArray(w?.data) &&
    w.data.length > 0 &&
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
        })),
      );
      setRightStyles(
        Array.from({ length: 45 }, () => ({
          left: `${Math.random() * 100}%`,
          top: "-12%",
          animationDelay: `${Math.random() * 0.25}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
        })),
      );
    });
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[18%]">
        {leftStyles.length > 0 &&
          leftStyles.map((style, i) => <span key={`l-${i}`} className="confetti" style={style} />)}
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-[18%]">
        {rightStyles.length > 0 &&
          rightStyles.map((style, i) => <span key={`r-${i}`} className="confetti" style={style} />)}
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
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full text-left rounded-2xl border p-3 transition-all duration-200",
        active
          ? "border-cyan-400/25 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(255,255,255,0.04))] shadow-[0_14px_34px_rgba(6,182,212,0.12)]"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cx(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors",
            active
              ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100"
              : "border-white/10 bg-white/[0.04] text-white/75",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white/90">{title}</div>
          <div className="mt-0.5 text-[10px] text-white/45">{desc}</div>
        </div>
      </div>
    </button>
  );
}

function MobileTabPill({
  active,
  title,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
    >
      <div
        className={cx(
          "grid h-11 w-11 place-items-center rounded-full border transition-all duration-200",
          active
            ? "border-cyan-300/35 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.36),rgba(12,14,20,0.92)_72%)] text-white shadow-[0_10px_24px_rgba(34,211,238,0.18)]"
            : "border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(12,14,20,0.96)_70%)] text-white/70 group-hover:border-white/20 group-hover:text-white/90",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div
        className={cx(
          "text-[9px] font-medium tracking-[0.02em]",
          active ? "text-white" : "text-white/58",
        )}
      >
        {title}
      </div>
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
  const { user: authUser, profile: authProfile, getAccessToken } = useAuth();

  const [postingAs, setPostingAs] = useState<{
    name: string;
    handle: string;
    avatarUrl: string | null;
    userId: string;
    canReceivePayments?: boolean;
    isVerifiedCreator?: boolean;
  } | null>(null);

  const [tab, setTab] = useState<PublishTab>("details");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [monetisationMode, setMonetisationMode] = useState<MonetisationMode>("free");
  const [priceUsd, setPriceUsd] = useState<string>("2.99");

  const [edgazeCode, setEdgazeCode] = useState<string>("");
  const [codeStatus, setCodeStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
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
  const [acceptedCreatorTerms, setAcceptedCreatorTerms] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<PublishTab>("details");

  const thumbInputRef = useRef<HTMLInputElement | null>(null);
  const demoInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<PublishTab, HTMLDivElement | null>>({
    details: null,
    pricing: null,
    media: null,
    visibility: null,
  });

  const draftGraph = useMemo(() => draft?.graph_json ?? draft?.graph ?? null, [draft]);

  const costEstimate = useMemo(() => {
    if (!draftGraph) return null;
    const cost10 = estimateWorkflowCostForRuns(draftGraph, 10);
    const min = getMinimumWorkflowPrice(draftGraph);
    const recommended = getRecommendedWorkflowPrice(draftGraph);
    return { cost10, min, recommended };
  }, [draftGraph]);

  const effectiveMinPrice = useMemo(() => {
    return costEstimate?.min ?? WORKFLOW_MIN_USD;
  }, [costEstimate]);

  const cleanTags = useMemo(() => {
    const raw = safeArr(tagsInput);
    const cleaned = raw
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 10);
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
    return "Free";
  }, [monetisationMode, priceUsd]);

  const uploadedThumbnailPreviewUrl = useMemo(
    () => createImageObjectUrl(thumbnailFile),
    [thumbnailFile],
  );
  const previewThumbSrc = useMemo(() => {
    if (uploadedThumbnailPreviewUrl) return sanitizeImageSrc(uploadedThumbnailPreviewUrl);
    if (autoThumbDataUrl) return sanitizeImageSrc(autoThumbDataUrl);
    return null;
  }, [uploadedThumbnailPreviewUrl, autoThumbDataUrl]);

  useEffect(() => {
    return () => {
      if (uploadedThumbnailPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadedThumbnailPreviewUrl);
      }
    };
  }, [uploadedThumbnailPreviewUrl]);

  // Effective listing owner (creator when admin impersonates). Do not use supabase.auth.getUser()
  // for owner_id — JWT stays the admin, which fails workflows RLS on update.
  useEffect(() => {
    if (!open) return;

    const uid = authUser?.id ?? null;
    if (!uid) {
      setPostingAs({
        name: owner?.name || "You",
        handle: owner?.handle || "you",
        avatarUrl: owner?.avatarUrl || null,
        userId: "",
        canReceivePayments: false,
        isVerifiedCreator: false,
      });
      return;
    }

    const name = authProfile?.full_name || owner?.name || "You";
    const handle = authProfile?.handle || owner?.handle || "you";

    setPostingAs({
      name,
      handle,
      avatarUrl: authProfile?.avatar_url ?? owner?.avatarUrl ?? null,
      userId: uid,
      canReceivePayments: Boolean(authProfile?.can_receive_payments),
      isVerifiedCreator: Boolean(authProfile?.is_verified_creator),
    });
  }, [open, authUser?.id, authProfile, owner?.name, owner?.handle, owner?.avatarUrl]);

  // Reset modal state on open
  useEffect(() => {
    if (!open) return;

    setTab("details");
    setMobileActiveTab("details");
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
    setErr(null);
    setBusy(false);

    setPublished(false);
    setPublishedUrl("");
    setQrDataUrl(null);
    setQrBusy(false);
    setConfetti(false);
    setAcceptedCreatorTerms(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when open/draft id changes; draft body not needed for reset
  }, [open, draft?.id, editId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileViewport(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

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

  async function generateQrAndMaybeUpload(opts: { url: string; workflowId: string }) {
    setQrBusy(true);
    try {
      const qr = await qrWithCenteredLogoDataUrl(opts.url);
      setQrDataUrl(qr);

      // Upload QR as file (optional)
      try {
        const blob = await (await fetch(qr)).blob();
        const qrFile = new File([blob], `edgaze-qr-${normalizeEdgazeCode(edgazeCode)}.png`, {
          type: "image/png",
        });
        await uploadListingMedia({
          getAccessToken,
          listingType: "workflow",
          resourceId: opts.workflowId,
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

      const workflowId = draft.id;

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

      // Upload thumbnail (only if new file provided, otherwise preserve existing)
      let thumbnailUrl: string | null = null;
      const thumbToUpload = thumbnailFile ?? autoThumbFile;
      if (thumbToUpload) {
        const up = await uploadListingMedia({
          getAccessToken,
          listingType: "workflow",
          resourceId: workflowId,
          kind: "thumbnail",
          file: thumbToUpload,
        });
        thumbnailUrl = up.publicUrl || null;
      } else if (editId && (draft as any)?.thumbnail_url) {
        // Preserve existing thumbnail when editing
        thumbnailUrl = (draft as any).thumbnail_url;
      }

      const thumbnailAutoGenerated = thumbnailFile
        ? false
        : thumbToUpload
          ? true
          : Boolean((draft as any)?.thumbnail_auto_generated);

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
        const up = await uploadListingMedia({
          getAccessToken,
          listingType: "workflow",
          resourceId: workflowId,
          kind: "demo",
          index: i,
          file: f,
        });
        if (up.publicUrl) demoUrls.push(up.publicUrl);
      }

      const effectiveMonetisation: MonetisationMode =
        monetisationMode === "paywall" ? "paywall" : "free";
      const effectivePrice =
        effectiveMonetisation === "paywall"
          ? (() => {
              const v = validateWorkflowPrice(Number(priceUsd) || 0, effectiveMinPrice);
              if (!v.valid) throw new Error(v.error);
              return Number(priceUsd) || effectiveMinPrice;
            })()
          : 0;

      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated.");

      const saveRes = await fetch("/api/creator/workflow-listing", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workflowId,
          isEdit: Boolean(editId),
          title: safeTitle,
          description: safeDescription,
          tags: cleanTags,
          visibility,
          monetisationMode: effectiveMonetisation,
          priceUsd: effectivePrice,
          edgazeCode: finalCode,
          thumbnailUrl,
          thumbnailAutoGenerated,
          demoUrls,
          creatorTermsAccepted: acceptedCreatorTerms,
        }),
      });

      const saveJson = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error((saveJson as { error?: string }).error || "Publish failed.");
      }

      // Build published URL - use current origin (works for localhost and production)
      const origin = typeof window !== "undefined" ? window.location.origin : "https://edgaze.ai";
      const url = `${origin}/${postingAs.handle}/${finalCode}`;
      setPublishedUrl(url);

      // Generate QR now (inside modal)
      await generateQrAndMaybeUpload({ url, workflowId });

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

  const needsTermsAcceptance = monetisationMode === "paywall" && !postingAs?.canReceivePayments;
  const canPublish =
    !!draft?.id &&
    !busy &&
    codeStatus === "available" &&
    (!needsTermsAcceptance || acceptedCreatorTerms);
  const handle = postingAs?.handle || owner?.handle || "you";
  const shownCode = normalizeEdgazeCode(edgazeCode);
  const showAllMobileSections = isMobileViewport && !published;
  const activeMobileTab = showAllMobileSections ? mobileActiveTab : tab;
  const mobileSpyOffset = 28;

  function scrollToWorkflowSection(nextTab: PublishTab) {
    setTab(nextTab);
    setMobileActiveTab(nextTab);
    const root = contentScrollRef.current;
    const node = sectionRefs.current[nextTab];
    if (!node || !root) return;
    const nextTop = Math.max(0, node.offsetTop - mobileSpyOffset);
    root.scrollTo({ top: nextTop, behavior: "smooth" });
  }

  useEffect(() => {
    if (!open) return;
    if (!showAllMobileSections) return;
    const root = contentScrollRef.current;
    if (!root) return;

    const entries = Object.entries(sectionRefs.current).filter(([, node]) => !!node) as Array<
      [PublishTab, HTMLDivElement]
    >;
    if (!entries.length) return;

    let rafId = 0;

    const syncActiveTab = () => {
      const scrollTop = root.scrollTop + mobileSpyOffset + 8;
      const isNearBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 24;
      let nextTab = entries[0][0];

      if (isNearBottom) {
        nextTab = entries[entries.length - 1][0];
      } else {
        for (const [key, node] of entries) {
          if (node.offsetTop <= scrollTop) {
            nextTab = key;
          } else {
            break;
          }
        }
      }

      setMobileActiveTab((prev) => (prev === nextTab ? prev : nextTab));
      setTab((prev) => (prev === nextTab ? prev : nextTab));
    };

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(syncActiveTab);
    };

    syncActiveTab();
    root.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      cancelAnimationFrame(rafId);
      root.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open, showAllMobileSections]);

  if (!open) return null;

  const shell = (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/80" onClick={published ? undefined : closeNow} />

      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-4">
        <div
          className="relative flex h-[100dvh] w-full flex-col overflow-hidden border-y border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.75)] sm:h-[min(620px,88vh)] sm:max-h-[92vh] sm:w-[min(900px,96vw)] sm:rounded-2xl sm:border"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 12px)",
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          <ConfettiSides active={confetti} />

          {/* Header */}
          <div className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:flex sm:h-[56px] sm:items-center sm:justify-between sm:px-5 sm:py-0">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={28}
                height={28}
                className="h-7 w-7 shrink-0"
                priority
              />
              <div className="min-w-0">
                <div className="text-[13px] sm:text-[14px] font-semibold text-white leading-tight truncate">
                  {published ? "Published" : editId ? "Edit workflow" : "Publish workflow"}
                </div>
                <div className="text-[10px] sm:text-[11px] text-white/45 truncate">
                  Posting as {postingAs?.name || owner?.name || "…"} @{handle}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 sm:mt-0">
              {!published ? (
                <button
                  onClick={handlePublish}
                  disabled={!canPublish}
                  className={cx(
                    "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold sm:h-auto sm:flex-none sm:px-3",
                    "bg-white text-black hover:bg-white/90 transition-colors",
                    !canPublish && "opacity-60 cursor-not-allowed",
                  )}
                  title={
                    !draft?.id
                      ? "Open a draft first"
                      : codeStatus !== "available"
                        ? "Pick a unique Edgaze code"
                        : editId
                          ? "Update workflow"
                          : "Publish workflow"
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
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold bg-white text-black hover:bg-white/90 sm:h-auto sm:flex-none sm:px-3"
                >
                  Done
                </button>
              )}

              <button
                onClick={published ? () => {} : closeNow}
                className={cx(
                  "h-9 w-9 shrink-0 rounded-full border border-white/12 bg-white/5 text-white/85 grid place-items-center",
                  published ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10",
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
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
              <div className="flex min-h-full flex-col rounded-3xl border border-white/10 bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(34,211,238,0.14),transparent_55%),radial-gradient(900px_500px_at_90%_0%,rgba(232,121,249,0.12),transparent_55%),linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.55))] p-4 sm:p-8">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                  <div className="text-white text-xl font-semibold">Published</div>
                </div>

                <div className="mt-2 text-sm text-white/60">Your workflow is live. Share it.</div>

                <div className="mt-7 grid grid-cols-12 gap-6 flex-1 min-h-0">
                  <div className="col-span-12 min-h-0 rounded-3xl border border-white/10 bg-black/35 p-4 sm:p-6 md:col-span-7">
                    <div className="text-[12px] font-semibold text-white/80">Edgaze code</div>
                    <div className="mt-2 break-words text-[30px] font-semibold leading-none tracking-tight text-white sm:text-[44px]">
                      {shownCode || "—"}
                    </div>

                    <div className="mt-6">
                      <div className="text-[12px] font-semibold text-white/80">Share link</div>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[12px] text-white/85 overflow-hidden">
                          <span className="inline-flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 shrink-0 text-white/60" />
                            <span className="min-w-0 truncate">{publishedUrl}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(publishedUrl)}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10 sm:w-auto"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        onClick={() => {
                          // Allow regenerating QR if it failed
                          if (!publishedUrl || !draft?.id) return;
                          generateQrAndMaybeUpload({
                            url: publishedUrl,
                            workflowId: draft.id,
                          }).catch(() => {});
                        }}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10 sm:w-auto"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Regenerate QR
                      </button>
                    </div>
                  </div>

                  <div className="col-span-12 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/35 p-4 sm:p-6 md:col-span-5">
                    <div className="text-[12px] font-semibold text-white/80">QR code</div>
                    <div className="mt-4 grid aspect-square w-full max-w-[240px] place-items-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                      {qrBusy ? (
                        <div className="text-[12px] text-white/60 inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating…
                        </div>
                      ) : qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="Edgaze QR"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[12px] text-white/60">QR not available</div>
                      )}
                    </div>

                    <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
                      <button
                        onClick={() =>
                          qrDataUrl
                            ? downloadDataUrl(qrDataUrl, `edgaze-qr-${shownCode || "workflow"}.png`)
                            : null
                        }
                        disabled={!qrDataUrl}
                        className={cx(
                          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10",
                          !qrDataUrl && "opacity-60 cursor-not-allowed",
                        )}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                      <button
                        onClick={() => copyToClipboard(publishedUrl)}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-[12px] font-semibold text-black hover:bg-white/90"
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:grid md:grid-cols-12">
              {/* Left rail */}
              <div className="shrink-0 border-b border-white/10 px-3 py-2.5 md:col-span-3 md:overflow-auto md:border-b-0 md:border-r md:p-6">
                <div className="text-[12px] font-semibold text-white/85">Publish</div>
                <div className="mt-0.5 text-[11px] text-white/45">
                  Set listing details, pricing and media.
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 md:hidden">
                  {WORKFLOW_TABS.map((item) => (
                    <MobileTabPill
                      key={item.key}
                      active={activeMobileTab === item.key}
                      title={item.title}
                      icon={item.icon}
                      onClick={() =>
                        showAllMobileSections ? scrollToWorkflowSection(item.key) : setTab(item.key)
                      }
                    />
                  ))}
                </div>

                <div className="mt-6 hidden space-y-3 md:block">
                  {WORKFLOW_TABS.map((item) => (
                    <RailButton
                      key={item.key}
                      active={tab === item.key}
                      title={item.title}
                      desc={item.desc}
                      icon={item.icon}
                      onClick={() => setTab(item.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Right content */}
              <div
                ref={contentScrollRef}
                className="min-h-0 flex-1 overflow-y-auto p-4 md:col-span-9 md:p-6"
              >
                {err ? (
                  <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100 text-[12px] flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 mt-[1px]" />
                    <div className="leading-relaxed">{err}</div>
                  </div>
                ) : null}

                {/* Section content */}
                <div className="space-y-4">
                  {showAllMobileSections || tab === "details" ? (
                    <div
                      ref={(node) => {
                        sectionRefs.current.details = node;
                      }}
                      data-section="details"
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
                    >
                      <div className="mb-4 flex items-center gap-3 md:hidden">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-white">Details</div>
                          <div className="text-[11px] text-white/45">
                            Title, description, tags, Edgaze code.
                          </div>
                        </div>
                      </div>
                      <div className="space-y-5">
                        <div>
                          <div className="text-[12px] font-semibold text-white/85">Title</div>
                          <input
                            value={title}
                            onChange={(e) => {
                              setTitle(e.target.value);
                              // If user hasn't manually changed code, keep it derived from title
                              if (
                                !edgazeCode ||
                                edgazeCode === baseCodeFromTitle(draft?.title || "")
                              ) {
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
                          <div className="mt-1 text-[11px] text-white/45">
                            Comma-separated (max 10)
                          </div>
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
                              <div className="text-[12px] font-semibold text-white/85">
                                Edgaze code
                              </div>
                              <div className="text-[11px] text-white/45">
                                This becomes: edgaze.ai/&lt;handle&gt;/&lt;code&gt;
                              </div>
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
                                (codeStatus === "taken" || codeStatus === "invalid") &&
                                  "text-amber-200",
                                codeStatus === "checking" && "text-white/60",
                                codeStatus === "idle" && "text-white/50",
                              )}
                            >
                              {codeStatus === "checking" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {codeMsg || (codeStatus === "available" ? "Available." : "")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {showAllMobileSections || tab === "pricing" ? (
                    <div
                      ref={(node) => {
                        sectionRefs.current.pricing = node;
                      }}
                      data-section="pricing"
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
                    >
                      <div className="mb-4 flex items-center gap-3 md:hidden">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                          <BadgeDollarSign className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-white">Pricing</div>
                          <div className="text-[11px] text-white/45">
                            Free or set a premium price.
                          </div>
                        </div>
                      </div>
                      <div className="space-y-5">
                        {!postingAs?.canReceivePayments && (
                          <PayoutSystemCard
                            variant="workflow"
                            showCheckbox={monetisationMode === "paywall"}
                            acceptedCreatorTerms={acceptedCreatorTerms}
                            onAcceptedChange={setAcceptedCreatorTerms}
                          />
                        )}
                        {costEstimate && monetisationMode === "paywall" && (
                          <div className="rounded-2xl border border-white/10 bg-black/35 p-4 space-y-3">
                            <div className="text-[12px] font-semibold text-white/90">
                              Infrastructure cost estimate
                            </div>
                            <div className="grid gap-2 text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-white/60">Estimated cost for 10 runs</span>
                                <span className="text-white font-medium">
                                  ${costEstimate.cost10.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/60">Minimum price</span>
                                <span className="text-white font-medium">
                                  ${costEstimate.min.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/60">Recommended price</span>
                                <span className="text-emerald-300 font-medium">
                                  ${costEstimate.recommended.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] text-white/50 leading-relaxed">
                              This infrastructure cost estimate is provided as pricing guidance for
                              creators. It is{" "}
                              <strong className="text-white/70">not deducted</strong> from your
                              balance or payouts. The only standard platform deduction is the Edgaze
                              marketplace fee of <strong className="text-white/70">20%</strong>. Use
                              this estimate to set pricing that appropriately covers operating cost
                              and your target margin.
                            </p>
                            <Link
                              href="/docs/infrastructure-cost-estimation"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                            >
                              Learn more about cost estimation
                            </Link>
                          </div>
                        )}
                        <div>
                          <div className="text-[12px] font-semibold text-white/85">
                            Monetisation
                          </div>
                          <div className="text-[11px] text-white/50 mt-1">
                            Choose Free or set a price (${effectiveMinPrice.toFixed(2)}–$
                            {WORKFLOW_MAX_USD} for workflows).
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(["free", "paywall"] as MonetisationMode[]).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setMonetisationMode(m)}
                                className={cx(
                                  "rounded-2xl border px-4 py-3 text-[12px] font-semibold transition-colors",
                                  monetisationMode === m
                                    ? "border-cyan-400/25 bg-cyan-400/10 text-white"
                                    : "border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.04]",
                                )}
                              >
                                {m === "free" ? "Free" : "Paywall"}
                              </button>
                            ))}
                          </div>
                          {monetisationMode === "paywall" && (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[12px] font-semibold text-white/90">
                                  Price (USD)
                                </div>
                                {costEstimate && (
                                  <button
                                    type="button"
                                    onClick={() => setPriceUsd(costEstimate.recommended.toFixed(2))}
                                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                                  >
                                    Use recommended (${costEstimate.recommended.toFixed(2)})
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min={effectiveMinPrice}
                                max={WORKFLOW_MAX_USD}
                                step="0.99"
                                value={priceUsd}
                                onChange={(e) => setPriceUsd(e.target.value)}
                                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[14px] text-white placeholder-white/40 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 focus:outline-none"
                                placeholder={costEstimate?.recommended.toFixed(2) ?? "5.99"}
                              />
                              {validateWorkflowPrice(Number(priceUsd) || 0, effectiveMinPrice)
                                .error && (
                                <p className="mt-2 text-[11px] text-amber-400">
                                  {
                                    validateWorkflowPrice(Number(priceUsd) || 0, effectiveMinPrice)
                                      .error
                                  }
                                </p>
                              )}
                              <p className="mt-2 text-[11px] text-white/45">
                                Minimum ${effectiveMinPrice.toFixed(2)}, maximum ${WORKFLOW_MAX_USD}{" "}
                                for workflows.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {showAllMobileSections || tab === "media" ? (
                    <div
                      ref={(node) => {
                        sectionRefs.current.media = node;
                      }}
                      data-section="media"
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
                    >
                      <div className="mb-4 flex items-center gap-3 md:hidden">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                          <Images className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-white">Media</div>
                          <div className="text-[11px] text-white/45">
                            Thumbnail and demo outputs.
                          </div>
                        </div>
                      </div>
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
                          <div className="text-[12px] font-semibold text-white/85">
                            Output demo images
                          </div>
                          <div className="mt-1 text-[11px] text-white/45">Up to 6 images.</div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                            {demoFiles.map((f, i) => (
                              <button
                                key={i}
                                onClick={() => demoInputRefs.current[i]?.click()}
                                className="aspect-[4/3] rounded-2xl border border-white/10 bg-black/35 hover:bg-black/45 transition-colors overflow-hidden grid place-items-center"
                              >
                                {f ? (
                                  <img
                                    src={URL.createObjectURL(f)}
                                    alt={`demo ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />
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
                    </div>
                  ) : null}

                  {showAllMobileSections || tab === "visibility" ? (
                    <div
                      ref={(node) => {
                        sectionRefs.current.visibility = node;
                      }}
                      data-section="visibility"
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
                    >
                      <div className="mb-4 flex items-center gap-3 md:hidden">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                          <Globe2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-white">Visibility</div>
                          <div className="text-[11px] text-white/45">
                            Choose how the listing appears.
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="text-[12px] font-semibold text-white/85">Visibility</div>
                        <div className="text-[11px] text-white/50 mt-1">
                          Choose who can see your workflow.
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
                                      : "border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.04]",
                                )}
                              >
                                {v === "public"
                                  ? "Public"
                                  : v === "unlisted"
                                    ? "Unlisted"
                                    : "Private"}
                                {disabled ? " (unavailable)" : ""}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[11px] text-white/45 leading-relaxed">
                          Public = discoverable in the marketplace.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="grid grid-cols-12">
                    <div className="col-span-12 p-4 md:col-span-6 md:p-5">
                      <div className="text-[11px] text-white/45">Preview</div>
                      <div className="mt-1 text-white text-[16px] font-semibold">{safeTitle}</div>
                      <div className="mt-2 text-[12px] text-white/60 leading-relaxed">
                        {safeDescription}
                      </div>

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
                              verified={Boolean(postingAs?.isVerifiedCreator)}
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

                    <div className="col-span-12 border-t border-white/10 p-4 md:col-span-6 md:border-l md:border-t-0 md:p-5">
                      <div className="text-[11px] text-white/45">Thumbnail</div>

                      <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 overflow-hidden aspect-[1200/630]">
                        {previewThumbSrc ? (
                          <img
                            src={previewThumbSrc}
                            alt="Workflow thumbnail"
                            className="w-full h-full object-cover"
                          />
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

                <div className="mt-4 text-[11px] text-white/40">
                  By publishing, you confirm you have rights to the content and agree to our{" "}
                  <a
                    href="/docs/terms-of-service"
                    className="text-white/60 hover:text-white underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Service
                  </a>
                  ,{" "}
                  <a
                    href="/docs/creator-terms"
                    className="text-white/60 hover:text-white underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Creator Terms
                  </a>
                  ,{" "}
                  <a
                    href="/docs/acceptable-use-policy"
                    className="text-white/60 hover:text-white underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Acceptable Use Policy
                  </a>
                  , and{" "}
                  <a
                    href="/docs/refund-policy"
                    className="text-white/60 hover:text-white underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Refund Policy
                  </a>
                  .
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(shell, document.body);
}
