// src/lib/edgazeAssets.ts
import { createSupabaseBrowserClient } from "./supabase/browser";

export const USER_ASSET_QUOTA_BYTES = 200 * 1024 * 1024; // 200 MB hard cap
const BUCKET = "edgaze-assets";

/**
 * Lazy browser-only supabase client.
 * - We DO NOT create a global supabaseClient file again.
 * - We also avoid initializing Supabase during SSR/build.
 */
let _sb: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function getSupabase() {
  if (typeof window === "undefined") {
    throw new Error("Supabase client is not available on the server.");
  }
  if (!_sb) _sb = createSupabaseBrowserClient();
  return _sb;
}

/**
 * DB record in the public.assets table
 */
export type AssetRecord = {
  id: string;
  user_id: string;
  bucket: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

/**
 * Simple shape used by the asset picker UI
 */
export type EdgazeAsset = {
  id: string;
  path: string;
  publicUrl: string;
  createdAt: string;
};

export type UploadResult = {
  publicUrl: string;
  path: string;
  sizeBytes: number;
  mimeType: string;
};

/* -------------------------------------------------------------------------- */
/*                          QUOTA + UPLOAD HELPERS                            */
/* -------------------------------------------------------------------------- */

/**
 * Very lightweight client-side compression:
 *  - max ~1600px on the longest side
 *  - JPEG ~0.75 quality
 */
async function compressImage(file: File): Promise<Blob> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const targetW = Math.round(bitmap.width * ratio);
  const targetH = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.75);
  });
}

/**
 * Total bytes used by this user in the assets bucket (from assets table).
 */
export async function getUserAssetsUsage(userId: string): Promise<number> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("assets")
    .select("size_bytes")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to fetch assets usage", error);
    return 0;
  }

  return (data ?? []).reduce((sum: number, row: any) => {
    return sum + Number(row.size_bytes || 0);
  }, 0);
}

/**
 * Core upload that enforces quota and writes to public.assets.
 * folder:
 *   - if provided, files go under that virtual folder
 *   - if omitted, we default to `${userId}/...`
 */
export async function uploadImageAsset(
  userId: string,
  file: File,
  opts?: { folder?: string }
): Promise<UploadResult> {
  const supabase = getSupabase();

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  const used = await getUserAssetsUsage(userId);

  const compressed = (await compressImage(file)) as Blob;
  const sizeBytes = (compressed as any).size ?? file.size;

  if (used + sizeBytes > USER_ASSET_QUOTA_BYTES) {
    throw new Error(
      "Upload would exceed your 200 MB Edgaze assets quota. Please delete some assets first."
    );
  }

  const ext = file.name.split(".").pop() || "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const folder = opts?.folder || userId;
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: file.type || `image/${ext}`,
    upsert: false,
  });

  if (uploadError) {
    console.error("Supabase upload error", uploadError);
    throw new Error("Failed to upload image. Please try again.");
  }

  // Persist metadata row for quota/management
  const { error: insertError } = await supabase.from("assets").insert({
    user_id: userId,
    bucket: BUCKET,
    path,
    mime_type: file.type,
    size_bytes: sizeBytes,
  });

  if (insertError) {
    console.error("Failed to insert asset metadata", insertError);
    // don't throw – upload still worked
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    publicUrl,
    path,
    sizeBytes,
    mimeType: file.type,
  };
}

/**
 * Backwards-compatible helper used by AssetPickerModal:
 *  - figures out current user via supabase.auth.getUser()
 *  - calls uploadImageAsset(user.id, file, opts)
 */
export async function uploadAsset(
  file: File,
  opts?: { folder?: string }
): Promise<UploadResult> {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.error("uploadAsset: no authenticated user", error);
    throw new Error("You must be signed in to upload assets.");
  }

  return uploadImageAsset(data.user.id, file, opts);
}

/**
 * List assets in the storage bucket for the picker UI.
 * This is storage-based; it does NOT hit the assets table.
 */
export async function listAssets(opts?: {
  folder?: string;
  limit?: number;
}): Promise<EdgazeAsset[]> {
  const supabase = getSupabase();

  const folder = opts?.folder ?? "";
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: opts?.limit ?? 60,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    console.error("listAssets error", error);
    throw error;
  }

  const assets: EdgazeAsset[] =
    data?.map((obj: any) => {
      const path = folder ? `${folder}/${obj.name}` : obj.name;
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      return {
        id: path,
        path,
        publicUrl,
        createdAt: obj.created_at ?? "",
      };
    }) ?? [];

  return assets;
}

/* -------------------------------------------------------------------------- */
/*                   BLURRED PROMPT THUMBNAIL (CLIENT ONLY)                   */
/* -------------------------------------------------------------------------- */

/**
 * Generate a blurred prompt thumbnail as a data URL.
 *
 * On the server it returns "" (never used there).
 */
export function createBlurredPromptThumbnail(promptText: string): string {
  if (typeof document === "undefined") return "";

  const width = 1200;
  const height = 600;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Base background
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);

  // Edgaze side gradient
  const sideGrad = ctx.createLinearGradient(0, 0, width, 0);
  sideGrad.addColorStop(0, "#22d3ee"); // cyan
  sideGrad.addColorStop(0.25, "rgba(34,211,238,0.0)");
  sideGrad.addColorStop(0.75, "rgba(236,72,153,0.0)");
  sideGrad.addColorStop(1, "#ec4899"); // pink
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, width, height);

  // Glass panel in centre
  const panelMargin = 80;
  const panelRadius = 60;
  const panelWidth = width - panelMargin * 2;
  const panelHeight = height - panelMargin * 2;
  const panelX = panelMargin;
  const panelY = panelMargin;
  const r = panelRadius;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(panelX + r, panelY);
  ctx.lineTo(panelX + panelWidth - r, panelY);
  ctx.quadraticCurveTo(panelX + panelWidth, panelY, panelX + panelWidth, panelY + r);
  ctx.lineTo(panelX + panelWidth, panelY + panelHeight - r);
  ctx.quadraticCurveTo(
    panelX + panelWidth,
    panelY + panelHeight,
    panelX + panelWidth - r,
    panelY + panelHeight
  );
  ctx.lineTo(panelX + r, panelY + panelHeight);
  ctx.quadraticCurveTo(panelX, panelY + panelHeight, panelX, panelY + panelHeight - r);
  ctx.lineTo(panelX, panelY + r);
  ctx.quadraticCurveTo(panelX, panelY, panelX + r, panelY);
  ctx.closePath();
  ctx.clip();

  const glassGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
  glassGrad.addColorStop(0, "rgba(15,23,42,0.9)");
  glassGrad.addColorStop(1, "rgba(15,23,42,0.97)");
  ctx.fillStyle = glassGrad;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

  const cleanPrompt = (promptText || "").replace(/\s+/g, " ").trim().slice(0, 260);
  const words = cleanPrompt.split(" ").slice(0, 32);
  const displayText = words.join(" ");

  ctx.filter = "blur(8px)";
  ctx.fillStyle = "rgba(148,163,184,0.95)";
  ctx.font = "900 96px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textBaseline = "top";

  const textX = panelX + 40;
  let textY = panelY + 40;
  const maxTextWidth = panelWidth - 80;

  const allWords = displayText.split(" ");
  let currentLine = "";
  const lines: string[] = [];

  for (const w of allWords) {
    const testLine = currentLine ? currentLine + " " + w : w;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxTextWidth) {
      lines.push(currentLine);
      currentLine = w;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  for (const line of lines) {
    ctx.fillText(line.toUpperCase(), textX, textY);
    textY += 96;
    if (textY > panelY + panelHeight - 120) break;
  }

  ctx.filter = "none";
  ctx.fillStyle = "rgba(15,23,42,0.8)";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

  ctx.restore();

  return canvas.toDataURL("image/png");
}
