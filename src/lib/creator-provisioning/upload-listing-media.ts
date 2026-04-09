/**
 * Upload workflow/prompt listing images to workflow-media via API (service role),
 * so admin impersonation is not blocked by storage.objects RLS (path uses creator id, JWT is admin).
 */

export type ListingMediaKind = "thumbnail" | "demo" | "qr";

export async function uploadListingMedia(opts: {
  getAccessToken: () => Promise<string | null>;
  listingType: "workflow" | "prompt";
  resourceId: string;
  kind: ListingMediaKind;
  index?: number;
  file: File;
}): Promise<{ path: string; publicUrl: string }> {
  const token = await opts.getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const form = new FormData();
  form.append("listingType", opts.listingType);
  form.append("resourceId", opts.resourceId);
  form.append("kind", opts.kind);
  if (opts.kind === "demo" && opts.index !== undefined) {
    form.append("index", String(opts.index));
  }
  form.append("file", opts.file);

  const res = await fetch("/api/creator/listing-media/upload", {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const raw = await res.text();
  let data: { error?: string; message?: string; path?: string; publicUrl?: string } = {};
  if (raw) {
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      /* non-JSON error page */
    }
  }

  if (!res.ok) {
    const fromJson =
      (typeof data.error === "string" && data.error.trim()) ||
      (typeof data.message === "string" && data.message.trim());
    const detail =
      fromJson ||
      (raw && !fromJson ? raw.slice(0, 500).trim() : "") ||
      `${res.status} ${res.statusText || ""}`.trim();
    throw new Error(detail || "Upload failed");
  }
  if (!data.path || !data.publicUrl) {
    throw new Error("Upload returned no URL");
  }
  return { path: data.path, publicUrl: data.publicUrl };
}
