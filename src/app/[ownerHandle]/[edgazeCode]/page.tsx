// src/app/[ownerHandle]/[edgazeCode]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  Eye,
  Heart,
  Sparkles,
  Share2,
  X,
  Link as LinkIcon,
  Copy,
  Download,
  RotateCcw,
  ExternalLink,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "src/lib/supabase/browser";
import { useAuth } from "src/components/auth/AuthContext";
import CommentsSection from "src/components/marketplace/CommentsSection";

type WorkflowListing = {
  id: string;
  owner_id: string | null; // workflows.owner_id is uuid
  owner_name: string | null;
  owner_handle: string | null;

  title: string | null;
  description: string | null;
  tags: string | null;

  banner_url: string | null;
  thumbnail_url: string | null;

  edgaze_code: string | null;

  is_public: boolean | null;
  is_published: boolean | null;

  monetisation_mode: "free" | "paywall" | "subscription" | "both" | null;
  is_paid: boolean | null;
  price_usd: number | null;

  views_count: number | null;
  likes_count: number | null;

  demo_images: string[] | null;
  output_demo_urls: string[] | null;

  graph_json: any | null;
  graph: any | null;
};

type PurchaseRow = {
  id: string;
  status: string; // workflow_purchases.status (text)
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

/* ---------- QR helpers (same approach as prompt page) ---------- */
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
    const mod: any = await withTimeout(
      import("qrcode") as any,
      2500,
      "QR module import"
    );
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
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(
        text
      )}`;
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
  ctx.arcTo(
    badgeX + badgeSize,
    badgeY,
    badgeX + badgeSize,
    badgeY + badgeSize,
    r
  );
  ctx.arcTo(
    badgeX + badgeSize,
    badgeY + badgeSize,
    badgeX,
    badgeY + badgeSize,
    r
  );
  ctx.arcTo(badgeX, badgeY + badgeSize, badgeX, badgeY, r);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeSize, badgeY, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  try {
    const logo = await withTimeout(loadImage("/brand/edgaze-mark.png"), 2500, "Logo load");
    const logoSize = 120;
    ctx.drawImage(
      logo,
      (900 - logoSize) / 2,
      (900 - logoSize) / 2,
      logoSize,
      logoSize
    );
  } catch {
    // ignore
  }

  return canvas.toDataURL("image/png");
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

async function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- Confetti (no deps) ---------- */
function fireMiniConfetti() {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9999";
  document.body.appendChild(root);

  const pieces = 90;
  const colors = [
    "#22d3ee",
    "#60a5fa",
    "#ec4899",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#ffffff",
  ];

  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const delay = Math.random() * 120;
    const dur = 900 + Math.random() * 900;

    p.style.position = "absolute";
    p.style.left = `${left}vw`;
    p.style.top = `-12px`;
    p.style.width = `${size}px`;
    p.style.height = `${size * 0.6}px`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)]!;
    p.style.opacity = "0.95";
    p.style.borderRadius = "3px";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    p.style.filter = "drop-shadow(0 8px 18px rgba(0,0,0,0.35))";

    const drift = (Math.random() - 0.5) * 220;
    const spin = (Math.random() - 0.5) * 720;

    p.animate(
      [
        { transform: `translate(0px, 0px) rotate(0deg)`, opacity: 1 },
        {
          transform: `translate(${drift}px, 110vh) rotate(${spin}deg)`,
          opacity: 0.95,
        },
      ],
      {
        duration: dur,
        delay,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      }
    );

    root.appendChild(p);
  }

  setTimeout(() => {
    root.remove();
  }, 2400);
}

/* ---------- Share Modal ---------- */
function ShareModal({
  open,
  onClose,
  shareUrl,
  code,
  ownerHandle,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  code: string;
  ownerHandle: string;
}) {
  const [qrBusy, setQrBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCopied(false);
    setQrDataUrl(null);
    (async () => {
      setQrBusy(true);
      try {
        const qr = await withTimeout(
          qrWithCenteredLogoDataUrl(shareUrl),
          9000,
          "QR render"
        );
        if (!alive) return;
        setQrDataUrl(qr);
      } catch {
        if (!alive) return;
        setQrDataUrl(null);
      } finally {
        if (alive) setQrBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, shareUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div className="relative w-[min(1120px,98vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={28}
                height={28}
                className="h-6 w-6 sm:h-7 sm:w-7"
              />
              <div>
                <div className="text-[13px] sm:text-[14px] font-semibold text-white">
                  Share
                </div>
                <div className="hidden sm:block text-[11px] text-white/50">
                  Share link, QR, and Edgaze code
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Close share"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-12 gap-4 sm:gap-5">
              <div className="col-span-12 sm:col-span-7">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="text-[11px] font-semibold text-white/70">
                    Edgaze code
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-[34px] sm:text-[40px] font-semibold tracking-tight text-white leading-none">
                      {code || "—"}
                    </div>
                    <div className="text-right text-[11px] text-white/45">
                      <span className="text-white/70 font-semibold">
                        @{ownerHandle || "creator"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-[11px] font-semibold text-white/70">
                      Share link
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 text-[12px] text-white/85 overflow-hidden">
                        <span className="inline-flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-white/55" />
                          <span className="truncate">{shareUrl}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await copyToClipboard(shareUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 900);
                        }}
                        className="h-10 sm:h-11 rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Copy className="h-4 w-4" />
                          {copied ? "Copied" : "Copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-white/45">
                    URL uses <span className="text-white/70">edgaze.ai</span>.
                  </div>
                </div>
              </div>

              <div className="col-span-12 sm:col-span-5">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-white/70">
                      QR code
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setQrBusy(true);
                        try {
                          const qr = await withTimeout(
                            qrWithCenteredLogoDataUrl(shareUrl),
                            9000,
                            "QR render"
                          );
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

                  <div className="mt-3 grid place-items-center rounded-3xl border border-white/10 bg-black/35 p-3">
                    <div className="h-[160px] w-[160px] sm:h-[210px] sm:w-[210px] overflow-hidden rounded-2xl bg-white/[0.03] grid place-items-center">
                      {qrBusy ? (
                        <div className="inline-flex items-center gap-2 text-[12px] text-white/60">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating…
                        </div>
                      ) : qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrDataUrl}
                          alt="Edgaze QR"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-[12px] text-white/55">
                          QR unavailable
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!qrDataUrl}
                      onClick={() =>
                        qrDataUrl
                          ? downloadDataUrl(
                              qrDataUrl,
                              `edgaze-qr-${code || "workflow"}.png`
                            )
                          : null
                      }
                      className={cn(
                        "h-10 sm:h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10",
                        !qrDataUrl && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <Download className="h-4 w-4" />
                        Download
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await copyToClipboard(shareUrl);
                      }}
                      className="h-10 sm:h-11 flex-1 rounded-2xl bg-white px-3 sm:px-4 text-[12px] font-semibold text-black hover:bg-white/90"
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <Copy className="h-4 w-4" />
                        Copy link
                      </span>
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-4 w-4 mt-[1px] text-white/45" />
                      <div className="min-w-0">
                        <div className="text-white/80 font-semibold">
                          Share friction killer
                        </div>
                        <div className="mt-0.5 leading-snug">
                          Copy link → paste anywhere. Edgaze code is short for
                          shoutouts on video.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-white/40">
                    QR auto-generates; regenerate if needed.
                  </div>
                </div>
              </div>

              <div className="col-span-12 sm:hidden text-[11px] text-white/45">
                QR + link are ready to share.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Purchase success modal ---------- */
function PurchaseSuccessModal({
  open,
  title,
  onClose,
  onOpenStudio,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onOpenStudio: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    fireMiniConfetti();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-[min(640px,94vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.85)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 border border-emerald-400/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-200" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-white">
                  Purchased
                </div>
                <div className="text-[11px] text-white/55">
                  Access is now attached to your account
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[12px] text-white/70">You unlocked</div>
              <div className="mt-1 text-[16px] font-semibold text-white leading-snug">
                {title}
              </div>
              <div className="mt-3 space-y-2 text-[12px] text-white/75">
                <div>• Open in Workflow Studio (read-only)</div>
                <div>• Run the workflow</div>
                <div>• Remix license coming soon</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]"
              >
                <Sparkles className="h-4 w-4" />
                Open in Workflow Studio
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold border border-white/15 bg-white/5 text-white hover:border-cyan-400/70"
              >
                Continue browsing
              </button>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              This opens in{" "}
              <span className="text-white/70 font-semibold">preview mode</span>{" "}
              (no editing). Owners still get full edit mode.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function WorkflowProductPage() {
  const params = useParams<{ ownerHandle: string; edgazeCode: string }>();
  const router = useRouter();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { requireAuth, userId, profile } = useAuth();

  const [listing, setListing] = useState<WorkflowListing | null>(null);
  const [loading, setLoading] = useState(true);

  const [mainDemoIndex, setMainDemoIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseRow | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);

  const [upNext, setUpNext] = useState<WorkflowListing[]>([]);
  const [upNextLoading, setUpNextLoading] = useState(false);
  const [upNextHasMore, setUpNextHasMore] = useState(true);
  const [upNextCursor, setUpNextCursor] = useState(0);
  const upNextSentinelRef = useRef<HTMLDivElement | null>(null);

  const ownerHandle = params?.ownerHandle;
  const edgazeCode = params?.edgazeCode;

  // Keep this behavior consistent with your prompts page: paid becomes free during closed beta.
  const CLOSED_BETA = true;

  useEffect(() => {
    if (!ownerHandle || !edgazeCode) return;
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("workflows")
        .select(
          [
            "id",
            "owner_id",
            "owner_name",
            "owner_handle",
            "title",
            "description",
            "tags",
            "banner_url",
            "thumbnail_url",
            "edgaze_code",
            "is_public",
            "is_published",
            "monetisation_mode",
            "is_paid",
            "price_usd",
            "views_count",
            "likes_count",
            "demo_images",
            "output_demo_urls",
            "graph_json",
            "graph",
          ].join(",")
        )
        .eq("owner_handle", ownerHandle)
        .eq("edgaze_code", edgazeCode)
        .eq("is_published", true)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Workflow listing load error", error);
        setListing(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setListing(null);
        setLoading(false);
        return;
      }

      // TS build fix: cast through unknown to avoid GenericStringError overlap type.
      const record = data as unknown as WorkflowListing;

      // Basic guard: don’t show private.
      if (record.is_public === false) {
        setListing(null);
        setLoading(false);
        return;
      }

      setListing(record);
      setLoading(false);

      // Views increment (best-effort).
      supabase
        .from("workflows")
        .update({ views_count: (record.views_count ?? 0) + 1 })
        .eq("id", record.id)
        .then(
          () => {},
          () => {}
        );
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ownerHandle, edgazeCode, supabase]);

  const demoImages: string[] = useMemo(() => {
    if (!listing) return [];
    if (Array.isArray(listing.demo_images) && listing.demo_images.length > 0)
      return listing.demo_images;
    if (
      Array.isArray(listing.output_demo_urls) &&
      listing.output_demo_urls.length > 0
    )
      return listing.output_demo_urls;
    if (listing.banner_url) return [listing.banner_url];
    if (listing.thumbnail_url) return [listing.thumbnail_url];
    return [];
  }, [listing]);

  const activeDemo = demoImages[mainDemoIndex] || null;

  const currentUserId = userId ?? null;
  const currentUserName = (profile as any)?.full_name ?? null;
  const currentUserHandle = (profile as any)?.handle ?? null;

  const canonicalShareUrl = useMemo(() => {
    const h = listing?.owner_handle || ownerHandle || "";
    const c = listing?.edgaze_code || edgazeCode || "";
    // NO /p
    return `https://edgaze.ai/${h}/${c}`;
  }, [listing?.owner_handle, listing?.edgaze_code, ownerHandle, edgazeCode]);

  // Typed routes in Next can be strict; cast to any for runtime-safe string routes.
  const goBack = () => router.push("/marketplace" as any);

  const isNaturallyFree = useMemo(() => {
    if (!listing) return true;
    return listing.monetisation_mode === "free" || listing.is_paid === false;
  }, [listing]);

  const showClosedBetaFree = useMemo(() => {
    if (!listing) return false;
    return CLOSED_BETA && !isNaturallyFree;
  }, [CLOSED_BETA, isNaturallyFree, listing]);

  const paidLabel = useMemo(() => {
    if (!listing) return "Free";
    if (isNaturallyFree) return "Free";
    return listing.price_usd != null
      ? `$${Number(listing.price_usd).toFixed(2)}`
      : "Paid";
  }, [listing, isNaturallyFree]);

  const primaryCtaLabel = useMemo(() => {
    if (showClosedBetaFree) return "Get access (Free)";
    if (isNaturallyFree) return "Open in Workflow Studio";
    return "Buy access";
  }, [showClosedBetaFree, isNaturallyFree]);

  const isOwner = useMemo(() => {
    if (!listing || !currentUserId) return false;
    return String(listing.owner_id ?? "") === String(currentUserId);
  }, [listing, currentUserId]);

  const isOwned = useMemo(() => {
    if (!listing) return false;
    if (isOwner) return true;
    if (isNaturallyFree) return true;
    return Boolean(
      purchase && (purchase.status === "paid" || purchase.status === "beta")
    );
  }, [listing, isOwner, isNaturallyFree, purchase]);

  function openWorkflowStudio() {
    if (!listing) return;

    // Owners get full builder. Everyone else opens preview-only (read-only) mode.
    const wid = listing.id;
    const mode = isOwner ? "edit" : "preview";

    router.push(
      (`/builder?workflowId=${encodeURIComponent(
        wid
      )}&mode=${encodeURIComponent(mode)}` as any) as any
    );
  }

  async function loadPurchaseRow(workflowId: string, uid: string) {
    const { data, error } = await supabase
      .from("workflow_purchases")
      .select("id,status")
      .eq("workflow_id", workflowId)
      .eq("buyer_id", uid)
      .maybeSingle();

    if (error) {
      console.error("workflow purchase load error", error);
      return null;
    }
    return (data as PurchaseRow) ?? null;
  }

  useEffect(() => {
    if (!listing?.id) return;
    if (!userId) {
      setPurchase(null);
      setPurchaseError(null);
      return;
    }
    let alive = true;
    (async () => {
      const row = await loadPurchaseRow(listing.id, userId);
      if (!alive) return;
      setPurchase(row);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id, userId]);

  async function grantAccessOrOpen() {
    if (!listing) return;
    setPurchaseError(null);

    // Free listings are still "open", but we want preview mode for non-owners too.
    if (isNaturallyFree && !isOwner) {
      openWorkflowStudio();
      return;
    }

    if (!requireAuth()) return;

    if (isOwned) {
      openWorkflowStudio();
      return;
    }

    // Closed beta: paywalled becomes free access row.
    if (showClosedBetaFree) {
      setPurchaseLoading(true);
      try {
        const uid = userId!;
        const { data, error } = await supabase
          .from("workflow_purchases")
          .insert({
            buyer_id: uid,
            workflow_id: listing.id,
            status: "beta",
          })
          .select("id,status")
          .maybeSingle();

        if (error) {
          console.error("workflow beta access insert error", error);
          setPurchaseError(
            "Could not grant access. Fix RLS on workflow_purchases (INSERT + SELECT for buyer_id)."
          );
          return;
        }

        setPurchase((data as PurchaseRow) ?? null);
        setPurchaseSuccessOpen(true);
        return;
      } finally {
        setPurchaseLoading(false);
      }
    }

    // Real paid checkout (Stripe) not wired yet.
    if (!isNaturallyFree) {
      setPurchaseError(
        "Paid checkout not wired yet. Stripe should create workflow_purchases(status='paid') server-side."
      );
      return;
    }

    openWorkflowStudio();
  }

  async function loadMoreUpNext(reset = false) {
    if (upNextLoading) return;

    const pageSize = 12;
    const from = reset ? 0 : upNextCursor;
    const to = from + pageSize - 1;

    setUpNextLoading(true);

    const baseSelect = [
      "id",
      "owner_id",
      "owner_name",
      "owner_handle",
      "title",
      "thumbnail_url",
      "banner_url",
      "edgaze_code",
      "is_public",
      "is_published",
      "monetisation_mode",
      "is_paid",
      "price_usd",
      "views_count",
      "likes_count",
      "tags",
    ].join(",");

    let q = supabase
      .from("workflows")
      .select(baseSelect)
      .eq("is_published", true)
      .eq("is_public", true)
      .order("views_count", { ascending: false })
      .order("likes_count", { ascending: false });

    if (listing?.id) q = q.neq("id", listing.id);

    const { data, error } = await q.range(from, to);

    if (error) {
      console.error("Workflow Up next load error", error);
      setUpNextLoading(false);
      return;
    }

    // TS build fix: cast through unknown to avoid GenericStringError[] overlap type.
    const rows = (data ?? []) as unknown as WorkflowListing[];
    setUpNext((prev) => (reset ? rows : [...prev, ...rows]));
    setUpNextCursor(from + rows.length);
    setUpNextHasMore(rows.length === pageSize);
    setUpNextLoading(false);
  }

  useEffect(() => {
    if (!listing) return;
    setUpNext([]);
    setUpNextCursor(0);
    setUpNextHasMore(true);
    loadMoreUpNext(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id]);

  useEffect(() => {
    if (!upNextSentinelRef.current) return;
    if (!upNextHasMore) return;

    const el = upNextSentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) loadMoreUpNext(false);
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextHasMore, upNextCursor, upNextLoading]);

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-[#050505] text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
          <p className="text-sm text-white/60">Loading workflow…</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex h-full flex-col bg-[#050505] text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-lg font-semibold">Workflow not found</p>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:border-cyan-400 hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <PurchaseSuccessModal
        open={purchaseSuccessOpen}
        title={listing.title || "Untitled workflow"}
        onClose={() => setPurchaseSuccessOpen(false)}
        onOpenStudio={() => {
          setPurchaseSuccessOpen(false);
          openWorkflowStudio();
        }}
      />

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={canonicalShareUrl}
        code={listing.edgaze_code || ""}
        ownerHandle={listing.owner_handle || ""}
      />

      {/* Desktop top bar */}
      <header className="hidden sm:block sticky top-0 z-30 border-b border-white/10 bg-[#050505]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs text-white/75 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Marketplace
            </button>

            <span className="truncate text-xs text-white/40">
              edgaze.ai/{listing.owner_handle}/{listing.edgaze_code}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">
                {initialsFromName(listing.owner_name || listing.owner_handle)}
              </div>
              <div className="hidden flex-col sm:flex leading-tight">
                <span className="text-xs font-medium text-white/90">
                  {listing.owner_name || "Creator"}
                </span>
                {listing.owner_handle && (
                  <span className="text-[11px] text-white/50">
                    @{listing.owner_handle}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <div className="sm:hidden sticky top-0 z-30 bg-[#050505]/85 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={goBack}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/85"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={grantAccessOrOpen}
            disabled={purchaseLoading}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold",
              purchaseLoading
                ? "bg-white/10 text-white/70 border border-white/10"
                : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]"
            )}
          >
            {purchaseLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOwned ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {isOwned ? "Open" : primaryCtaLabel}
          </button>

          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/85"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 sm:px-6">
          {purchaseError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
              <div className="font-semibold">Access error</div>
              <div className="mt-1 text-rose-100/80">{purchaseError}</div>
              <div className="mt-2 text-rose-100/70">
                Fix:{" "}
                <span className="font-semibold">workflow_purchases</span> RLS
                must allow <span className="font-semibold">INSERT</span> and{" "}
                <span className="font-semibold">SELECT</span> for the buyer_id.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
            {/* LEFT */}
            <div className="min-w-0">
              <section className="relative overflow-hidden rounded-2xl bg-black/60 border border-white/10">
                <div className="aspect-video w-full">
                  {activeDemo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeDemo}
                      alt={listing.title || "Workflow demo image"}
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={() =>
                        window.open(activeDemo, "_blank", "noopener,noreferrer")
                      }
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-xs text-white/50">
                      No demo images yet.
                    </div>
                  )}
                </div>

                {demoImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setMainDemoIndex((prev) =>
                          prev === 0 ? demoImages.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:border-cyan-400"
                      aria-label="Previous"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMainDemoIndex((prev) =>
                          prev === demoImages.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:border-cyan-400"
                      aria-label="Next"
                    >
                      {">"}
                    </button>
                  </>
                )}
              </section>

              {demoImages.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {demoImages.map((img, idx) => (
                    <button
                      key={img + idx}
                      type="button"
                      onClick={() => setMainDemoIndex(idx)}
                      className={cn(
                        "relative h-14 w-24 flex-none overflow-hidden rounded-xl border border-white/10 bg-black/60",
                        idx === mainDemoIndex &&
                          "border-cyan-400 shadow-[0_0_14px_rgba(56,189,248,0.55)]"
                      )}
                      aria-label={`Select demo ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={`Demo ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-[3px] text-[11px] font-medium bg-pink-500/15 text-pink-200">
                    Workflow
                  </span>

                  {listing.edgaze_code && (
                    <span className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-2 py-[3px] text-[11px] font-semibold text-black shadow-[0_0_14px_rgba(56,189,248,0.55)]">
                      /{listing.edgaze_code}
                    </span>
                  )}

                  {isOwned && !isNaturallyFree && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-[3px] text-[11px] font-semibold text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Purchased
                    </span>
                  )}

                  {!isOwner && (
                    <span className="rounded-full bg-white/5 px-2 py-[3px] text-[11px] font-semibold text-white/70">
                      Preview only
                    </span>
                  )}
                </div>

                <h1 className="text-[18px] sm:text-[22px] font-semibold leading-snug">
                  {listing.title || "Untitled workflow"}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {listing.views_count ?? 0} views
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {listing.likes_count ?? 0} likes
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                    {initialsFromName(listing.owner_name || listing.owner_handle)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white/90">
                      {listing.owner_name || "Creator"}
                    </div>
                    <div className="truncate text-[12px] text-white/55">
                      @{listing.owner_handle || "creator"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={grantAccessOrOpen}
                  className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-cyan-400/70"
                >
                  {isOwned ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {isOwned ? "Open" : primaryCtaLabel}
                </button>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-sm leading-relaxed text-white/75">
                  {listing.description || "No description provided yet."}
                </p>

                {listing.tags && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
                    {listing.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-white/5 px-2 py-1"
                        >
                          #{t}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* ✅ FIXED: pass only props that exist on CommentsSectionProps */}
              <div className="hidden sm:block mt-6 border-t border-white/10 pt-6">
                <CommentsSection
                  listingId={listing.id}
                  listingOwnerId={listing.owner_id}
                />
              </div>

              {/* Mobile: preview a few comments, open full sheet on tap */}
              <div className="sm:hidden mt-6 border-t border-white/10 pt-5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setCommentsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setCommentsOpen(true);
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left cursor-pointer select-none"
                  aria-label="Open comments"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-white/85">
                      Comments
                    </div>
                    <div className="text-[11px] text-white/55">Tap to view</div>
                  </div>

                  <div className="mt-3 max-h-[140px] overflow-hidden relative">
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#050505] to-transparent" />
                    <div className="pointer-events-none opacity-90">
                      <CommentsSection
                        listingId={listing.id}
                        listingOwnerId={listing.owner_id}
                      />
                    </div>
                  </div>
                </div>

                {commentsOpen && (
                  <div className="fixed inset-0 z-[110]">
                    <div
                      className="absolute inset-0 bg-black/80"
                      onClick={() => setCommentsOpen(false)}
                    />
                    <div className="absolute inset-x-0 bottom-0 top-[10%] rounded-t-3xl border border-white/10 bg-[#050505] overflow-hidden">
                      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                        <div className="text-[14px] font-semibold text-white">
                          Comments
                        </div>
                        <button
                          type="button"
                          onClick={() => setCommentsOpen(false)}
                          className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80"
                          aria-label="Close comments"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="h-[calc(100%-52px)] overflow-y-auto px-4 py-4">
                        <CommentsSection
                          listingId={listing.id}
                          listingOwnerId={listing.owner_id}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile up next */}
              <div className="lg:hidden mt-8 border-t border-white/10 pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/85">Up next</h3>
                  <span className="text-[11px] text-white/45">Workflows</span>
                </div>

                <div className="flex flex-col gap-3">
                  {upNext.map((s) => {
                    const suggestionFree =
                      s.monetisation_mode === "free" || s.is_paid === false;
                    const href =
                      s.owner_handle && s.edgaze_code
                        ? `/${s.owner_handle}/${s.edgaze_code}`
                        : null;
                    const suggestionPaidLabel = suggestionFree
                      ? "Free"
                      : s.price_usd != null
                      ? `$${Number(s.price_usd).toFixed(2)}`
                      : "Paid";

                    const thumb = s.thumbnail_url || s.banner_url || null;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!href}
                        onClick={() => href && router.push(href as any)}
                        className={cn(
                          "group flex w-full items-start gap-3 text-left",
                          !href && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={s.title || "Workflow thumbnail"}
                              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                              Workflow
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] font-semibold text-white/90">
                            {s.title || "Untitled workflow"}
                          </p>
                          <p className="mt-1 truncate text-[12px] text-white/55">
                            @{s.owner_handle || s.owner_name || "creator"}
                          </p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="truncate text-[11px] text-white/40">
                              {s.tags
                                ? s.tags
                                    .split(",")
                                    .map((t) => t.trim())
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((t) => `#${t}`)
                                    .join("  ")
                                : ""}
                            </p>

                            <span className="text-[12px] font-semibold text-white/75">
                              {CLOSED_BETA && !suggestionFree ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="line-through decoration-white/40">
                                    {suggestionPaidLabel === "Paid"
                                      ? "$—"
                                      : suggestionPaidLabel}
                                  </span>
                                  <span className="text-white/85">Free</span>
                                </span>
                              ) : (
                                suggestionPaidLabel
                              )}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <div ref={upNextSentinelRef} className="h-8" />

                  {upNextLoading && (
                    <div className="flex items-center gap-2 text-[12px] text-white/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading…</span>
                    </div>
                  )}

                  {!upNextHasMore && upNext.length > 0 && (
                    <p className="text-[12px] text-white/45">
                      You reached the end.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <aside className="min-w-0 hidden lg:block">
              <div className="lg:sticky lg:top-[76px]">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_30px_rgba(15,23,42,0.65)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">
                        {isOwned ? "You have access" : "Unlock this workflow"}
                      </h2>
                      <p className="mt-1 text-[12px] text-white/55">
                        {isOwned
                          ? isOwner
                            ? "Open it in Workflow Studio."
                            : "Open it in Workflow Studio (read-only)."
                          : "Access attaches to your Edgaze account."}
                      </p>
                    </div>

                    {showClosedBetaFree && !isOwned && (
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/60">
                        Closed beta
                      </span>
                    )}

                    {isOwned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Owned
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    {showClosedBetaFree && !isNaturallyFree ? (
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[11px] text-white/45">Price</div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <div className="text-2xl font-semibold">$0.00</div>
                            <div className="text-[12px] text-white/55">
                              during closed beta
                            </div>
                          </div>
                          <div className="mt-1 text-[12px] text-white/50">
                            <span className="line-through decoration-white/40">
                              {paidLabel === "Paid" ? "$—" : paidLabel}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-white/45">
                          Limited access drop
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[11px] text-white/45">Price</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <div className="text-2xl font-semibold">
                            {paidLabel === "Free" ? "$0.00" : paidLabel}
                          </div>
                          {!isNaturallyFree && (
                            <span className="text-[12px] text-white/55">
                              one-time
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={grantAccessOrOpen}
                      disabled={purchaseLoading}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold",
                        purchaseLoading
                          ? "bg-white/10 text-white/70 border border-white/10"
                          : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]"
                      )}
                    >
                      {purchaseLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isOwned ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {isOwned
                        ? isOwner
                          ? "Open in Workflow Studio"
                          : "Open in Workflow Studio (Preview)"
                        : primaryCtaLabel}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:border-cyan-400/70"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>

                  {!isOwned && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                      <div className="font-semibold text-white/80">
                        What you get
                      </div>
                      <div className="mt-2 space-y-1">
                        <div>• Open in Workflow Studio (read-only)</div>
                        <div>• Run the workflow</div>
                        <div>• Remix license coming soon</div>
                      </div>
                    </div>
                  )}

                  {isOwned && !isOwner && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                      <div className="font-semibold text-white/80">
                        Preview mode
                      </div>
                      <div className="mt-2 space-y-1">
                        <div>• No editing, no publish</div>
                        <div>• No block library / inspector</div>
                        <div>• You can run (and move nodes)</div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/85">Up next</h3>
                    <span className="text-[11px] text-white/45">Workflows</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {upNext.map((s) => {
                      const suggestionFree =
                        s.monetisation_mode === "free" || s.is_paid === false;
                      const href =
                        s.owner_handle && s.edgaze_code
                          ? `/${s.owner_handle}/${s.edgaze_code}`
                          : null;
                      const suggestionPaidLabel = suggestionFree
                        ? "Free"
                        : s.price_usd != null
                        ? `$${Number(s.price_usd).toFixed(2)}`
                        : "Paid";
                      const thumb = s.thumbnail_url || s.banner_url || null;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!href}
                          onClick={() => href && router.push(href as any)}
                          className={cn(
                            "group flex w-full items-start gap-3 text-left",
                            !href && "cursor-not-allowed opacity-60"
                          )}
                        >
                          <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt={s.title || "Workflow thumbnail"}
                                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                                Workflow
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[13px] font-semibold text-white/90">
                              {s.title || "Untitled workflow"}
                            </p>
                            <p className="mt-1 truncate text-[12px] text-white/55">
                              @{s.owner_handle || s.owner_name || "creator"}
                            </p>
                            <div className="mt-1 flex items-center justify-between">
                              <p className="truncate text-[11px] text-white/40">
                                {s.tags
                                  ? s.tags
                                      .split(",")
                                      .map((t) => t.trim())
                                      .filter(Boolean)
                                      .slice(0, 2)
                                      .map((t) => `#${t}`)
                                      .join("  ")
                                  : ""}
                              </p>

                              <span className="text-[12px] font-semibold text-white/75">
                                {CLOSED_BETA && !suggestionFree ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="line-through decoration-white/40">
                                      {suggestionPaidLabel === "Paid"
                                        ? "$—"
                                        : suggestionPaidLabel}
                                    </span>
                                    <span className="text-white/85">Free</span>
                                  </span>
                                ) : (
                                  suggestionPaidLabel
                                )}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    <div ref={upNextSentinelRef} className="h-8" />

                    {upNextLoading && (
                      <div className="flex items-center gap-2 text-[12px] text-white/60">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading…</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
