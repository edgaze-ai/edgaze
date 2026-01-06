// src/components/builder/workflowThumbnailGenerator.ts
"use client";

type Graph = {
  nodes?: Array<{
    id: string;
    position?: { x: number; y: number };
    data?: any;
    type?: string;
  }>;
  edges?: Array<{
    id?: string;
    source: string;
    target: string;
  }>;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hashToHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
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

function toCanvasBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to create image blob"))),
      type,
      quality
    );
  });
}

function safeNodeTitle(n: any) {
  const d = n?.data ?? {};
  return (
    String(d?.title || d?.label || d?.name || d?.blockName || d?.specName || n?.type || "Node")
      .trim()
      .slice(0, 24) || "Node"
  );
}

function normalizeGraph(graph: Graph | null | undefined) {
  const g = graph ?? {};
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];
  return { nodes, edges };
}

function computeLayout(nodes: any[]) {
  const pts = nodes.map((n, i) => {
    const px = n.position?.x;
    const py = n.position?.y;
    if (typeof px === "number" && typeof py === "number") return { id: n.id, x: px, y: py, node: n };

    // deterministic grid fallback
    const cols = 5;
    const gx = (i % cols) * 320;
    const gy = Math.floor(i / cols) * 220;
    return { id: n.id, x: gx, y: gy, node: n };
  });

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }

  return { pts, minX, minY, maxX, maxY };
}

/**
 * Shared base background so prompt + workflow thumbnails feel consistent.
 */
function paintBaseBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Base background
  ctx.fillStyle = "#07080b";
  ctx.fillRect(0, 0, width, height);

  // Subtle grid
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  const grid = 42;
  for (let x = 0; x <= width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Edgaze accents (subtle)
  const g1 = ctx.createRadialGradient(
    width * 0.18,
    height * -0.1,
    10,
    width * 0.18,
    height * -0.1,
    width * 0.85
  );
  g1.addColorStop(0, "rgba(34,211,238,0.20)");
  g1.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, width, height);

  const g2 = ctx.createRadialGradient(
    width * 0.9,
    height * -0.1,
    10,
    width * 0.9,
    height * -0.1,
    width * 0.9
  );
  g2.addColorStop(0, "rgba(232,121,249,0.18)");
  g2.addColorStop(1, "rgba(232,121,249,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, width, height);
}

function softVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const vg = ctx.createRadialGradient(
    width / 2,
    height / 2,
    50,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);
}

function premiumFrame(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // premium border
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  drawRoundedRect(ctx, 22, 22, width - 44, height - 44, 30);
  ctx.fill();

  // final subtle darken
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(0, 0, width, height);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  // naive truncation to fit in maxWidth with current ctx.font
  const t = String(text || "");
  if (!t) return "";
  if (ctx.measureText(t).width <= maxWidth) return t;

  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = t.slice(0, mid) + "…";
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  const cut = Math.max(1, lo - 1);
  return t.slice(0, cut) + "…";
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const lines: string[] = [];
  let cur = "";

  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;

    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);

  // if overflow, ellipsis last line
  if (lines.length === maxLines && words.length > 0) {
    const last = lines.at(-1);
    if (typeof last === "string") {
      lines[lines.length - 1] = fitText(ctx, last, maxWidth);
    }
  }

  return lines;
}

/**
 * Existing workflow generator (unchanged behavior).
 */
export async function generateWorkflowThumbnailFile(opts: {
  graph: Graph | null | undefined;
  workflowId: string;
  width?: number;
  height?: number;
  blurPx?: number; // default 0 (crisp)
}): Promise<{ file: File; dataUrl: string }> {
  const width = opts.width ?? 1200;
  const height = opts.height ?? 630;
  const blurPx = clamp(opts.blurPx ?? 0, 0, 22);

  const { nodes, edges } = normalizeGraph(opts.graph);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  paintBaseBackground(ctx, width, height);

  if (nodes.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    drawRoundedRect(ctx, width * 0.18, height * 0.28, width * 0.64, height * 0.44, 24);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 22px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("Workflow preview", width * 0.18 + 26, height * 0.28 + 52);

    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("Add nodes to generate a graph thumbnail", width * 0.18 + 26, height * 0.28 + 80);
  } else {
    const { pts, minX, minY, maxX, maxY } = computeLayout(nodes);

    // Fit to frame
    const pad = 90;
    const worldW = Math.max(1, maxX - minX + 360);
    const worldH = Math.max(1, maxY - minY + 240);

    const scale = Math.min((width - pad * 2) / worldW, (height - pad * 2) / worldH);
    const offsetX = pad - minX * scale + (width - (worldW * scale + pad * 2)) / 2;
    const offsetY = pad - minY * scale + (height - (worldH * scale + pad * 2)) / 2;

    const byId = new Map(pts.map((p) => [p.id, p]));

    // Edges
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;

      // center-ish anchors
      const x1 = a.x * scale + offsetX + 170 * scale;
      const y1 = a.y * scale + offsetY + 60 * scale;
      const x2 = b.x * scale + offsetX + 170 * scale;
      const y2 = b.y * scale + offsetY + 60 * scale;

      const mx = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Nodes as cards (screenshot-like)
    for (const p of pts) {
      const x = p.x * scale + offsetX;
      const y = p.y * scale + offsetY;
      const w = 340 * scale;
      const h = 120 * scale;

      const hue = hashToHue(p.id);
      const glow = `hsla(${hue}, 90%, 70%, 0.22)`;

      // glow
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 22;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      drawRoundedRect(ctx, x, y, w, h, 18 * scale);
      ctx.fill();
      ctx.restore();

      // body
      ctx.fillStyle = "rgba(10,11,15,0.78)";
      drawRoundedRect(ctx, x, y, w, h, 18 * scale);
      ctx.fill();

      // border
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, x, y, w, h, 18 * scale);
      ctx.stroke();

      // accent strip
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, "rgba(34,211,238,0.85)");
      grad.addColorStop(1, "rgba(232,121,249,0.85)");
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, x + 14 * scale, y + 16 * scale, 8 * scale, h - 32 * scale, 6 * scale);
      ctx.fill();

      // title
      const title = safeNodeTitle(p.node);
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.font = `${Math.max(12, Math.floor(16 * scale))}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillText(title, x + 34 * scale, y + 44 * scale);

      // subtitle / type
      const sub = String(p.node?.type || "block").slice(0, 20);
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.font = `${Math.max(10, Math.floor(12 * scale))}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillText(sub, x + 34 * scale, y + 70 * scale);

      // tiny handle dots
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + w - (28 + i * 16) * scale, y + h - 24 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    softVignette(ctx, width, height);
  }

  // Optional blur pass (default 0: crisp)
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas not supported");

  octx.save();
  octx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
  octx.drawImage(canvas, 0, 0);
  octx.restore();

  premiumFrame(octx, width, height);

  const blob = await toCanvasBlob(out, "image/png");
  const file = new File([blob], `workflow-thumb-${opts.workflowId}.png`, { type: "image/png" });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Failed to read thumbnail"));
    r.readAsDataURL(blob);
  });

  return { file, dataUrl };
}

/**
 * Prompt thumbnails
 * - Same visual language as workflow thumbs (background/grid/accents/frame)
 * - Shows title/desc/tags
 * - Shows blurred preview text block (premium “preview” feel)
 */

export async function generatePromptThumbnailFile(opts: {
  promptId: string;
  title: string;
  description?: string;
  tags?: string[];
  previewText?: string; // should already be preview-safe (shorter), but we blur anyway
  width?: number;
  height?: number;
  blurPx?: number; // blur pass for whole image (default 0)
  previewBlurPx?: number; // blur only preview text (default 3.5)
}): Promise<{ file: File; dataUrl: string }> {
  const width = opts.width ?? 1200;
  const height = opts.height ?? 630;
  const blurPx = clamp(opts.blurPx ?? 0, 0, 22);
  const previewBlurPx = clamp(opts.previewBlurPx ?? 3.5, 0, 12);

  const title = String(opts.title || "Prompt").trim().slice(0, 90);
  const description = String(opts.description || "").trim().slice(0, 160);
  const tags = Array.isArray(opts.tags) ? opts.tags.map(String).filter(Boolean).slice(0, 6) : [];
  const preview = String(opts.previewText || "").trim().slice(0, 520);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  paintBaseBackground(ctx, width, height);

  // Main card
  const pad = 80;
  const cardX = pad;
  const cardY = 84;
  const cardW = width - pad * 2;
  const cardH = height - 168;

  // glow behind card
  ctx.save();
  ctx.shadowColor = "rgba(232,121,249,0.16)";
  ctx.shadowBlur = 34;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();
  ctx.restore();

  // card body
  ctx.fillStyle = "rgba(10,11,15,0.78)";
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();

  // card border
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.stroke();

  // accent strip (same gradient language)
  const stripGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  stripGrad.addColorStop(0, "rgba(34,211,238,0.88)");
  stripGrad.addColorStop(1, "rgba(232,121,249,0.88)");
  ctx.fillStyle = stripGrad;
  drawRoundedRect(ctx, cardX + 22, cardY + 26, 10, cardH - 52, 8);
  ctx.fill();

  const contentX = cardX + 52;
  const contentW = cardW - 74;

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 34px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  const titleLine = fitText(ctx, title || "Prompt", contentW);
  ctx.fillText(titleLine, contentX, cardY + 74);

  // Description (2 lines)
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  const descLines = wrapLines(ctx, description || "Premium prompt listing", contentW, 2);
  for (let i = 0; i < descLines.length; i++) {
    ctx.fillText(descLines[i] ?? "", contentX, cardY + 106 + i * 22);

  }

  // Tags pill row
  let tagY = cardY + 158;
  if (tags.length) {
    let x = contentX;
    const pillH = 28;
    ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    for (const t of tags) {
      const label = t.length > 18 ? t.slice(0, 18) + "…" : t;
      const tw = ctx.measureText(label).width;
      const w = tw + 26;
      if (x + w > contentX + contentW) break;

      // pill bg
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      drawRoundedRect(ctx, x, tagY, w, pillH, 999);
      ctx.fill();

      // pill border
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x, tagY, w, pillH, 999);
      ctx.stroke();

      // text
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.fillText(label, x + 13, tagY + 19);

      x += w + 10;
    }
    tagY += 46;
  }

  // Preview block
  const previewX = contentX;
  const previewY = tagY;
  const previewW = contentW;
  const previewH = Math.max(150, cardY + cardH - 28 - previewY);

  // preview container
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  drawRoundedRect(ctx, previewX, previewY, previewW, previewH, 22);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, previewX, previewY, previewW, previewH, 22);
  ctx.stroke();

  // preview header
  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText("Prompt preview", previewX + 18, previewY + 28);

  // blurred preview text
  ctx.save();
  ctx.font = "500 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.filter = previewBlurPx > 0 ? `blur(${previewBlurPx}px)` : "none";

  const textMaxW = previewW - 36;
  const lines = wrapLines(ctx, preview || "Preview", textMaxW, 8);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i] ?? "", previewX + 18, previewY + 56 + i * 20);
  }
  ctx.restore();

  // subtle gradient fade bottom
  const fade = ctx.createLinearGradient(0, previewY + previewH - 80, 0, previewY + previewH);
  fade.addColorStop(0, "rgba(10,11,15,0)");
  fade.addColorStop(1, "rgba(10,11,15,0.70)");
  ctx.fillStyle = fade;
  ctx.fillRect(previewX, previewY + previewH - 80, previewW, 80);

  softVignette(ctx, width, height);

  // Optional blur pass over entire image (kept off by default)
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas not supported");

  octx.save();
  octx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
  octx.drawImage(canvas, 0, 0);
  octx.restore();

  premiumFrame(octx, width, height);

  const blob = await toCanvasBlob(out, "image/png");
  const file = new File([blob], `prompt-thumb-${opts.promptId}.png`, { type: "image/png" });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Failed to read thumbnail"));
    r.readAsDataURL(blob);
  });

  return { file, dataUrl };
}

/**
 * Convenience: create a prompt thumbnail dataUrl only.
 * Use this for instant in-modal preview without needing File/Blob roundtrips.
 */
export async function createPromptThumbnailDataUrl(opts: {
  title: string;
  description?: string;
  tags?: string[];
  previewText?: string;
  width?: number;
  height?: number;
  previewBlurPx?: number;
}): Promise<string> {
  const { dataUrl } = await generatePromptThumbnailFile({
    promptId: "preview",
    title: opts.title,
    description: opts.description,
    tags: opts.tags,
    previewText: opts.previewText,
    width: opts.width,
    height: opts.height,
    previewBlurPx: opts.previewBlurPx,
  });
  return dataUrl;
}

/**
 * Backwards-compatible alias name (if your modal already imported this).
 * This matches what you were trying to use: createBlurredPromptThumbnail(...)
 */
export async function createBlurredPromptThumbnail(opts: {
  title: string;
  subtitle?: string;
  tags?: string[];
  preview?: string;
  width?: number;
  height?: number;
  previewBlurPx?: number;
}): Promise<string> {
  return await createPromptThumbnailDataUrl({
    title: opts.title,
    description: opts.subtitle,
    tags: opts.tags,
    previewText: opts.preview,
    width: opts.width,
    height: opts.height,
    previewBlurPx: opts.previewBlurPx ?? 3.5,
  });
}
