function sanitizeOwnerHandle(ownerHandle?: string | null): string {
  const raw = String(ownerHandle ?? "")
    .trim()
    .replace(/^@+/, "");
  const clean = raw.replace(/[^\w.-]+/g, "");
  return clean || "creator";
}

export function getDemoWatermarkedImageUrl(imageUrl: string, ownerHandle?: string | null): string {
  const params = new URLSearchParams({
    src: imageUrl,
    owner: sanitizeOwnerHandle(ownerHandle),
  });
  return `/api/demo/watermarked-image?${params.toString()}`;
}

export function formatDemoWatermarkHandle(ownerHandle?: string | null): string {
  return `@${sanitizeOwnerHandle(ownerHandle)}`;
}

const watermarkBlobUrlCache = new Map<string, Promise<string>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function fetchImageBlob(src: string): Promise<Blob> {
  if (/^data:image\//i.test(src)) {
    const res = await fetch(src);
    return await res.blob();
  }

  const res = await fetch(src, {
    mode: "cors",
    credentials: "omit",
    cache: "force-cache",
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }
  return await res.blob();
}

function drawWatermarkLayer(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  ownerHandle: string;
  logo: HTMLImageElement;
}) {
  const { ctx, width, height, ownerHandle, logo } = params;
  const minEdge = Math.max(1, Math.min(width, height));
  const tileWidth = Math.max(240, Math.min(460, Math.round(minEdge * 0.34)));
  const tileHeight = Math.max(180, Math.min(330, Math.round(tileWidth * 0.72)));
  const logoSize = Math.max(44, Math.min(92, Math.round(tileWidth * 0.24)));
  const brandFont = Math.max(18, Math.min(34, Math.round(tileWidth * 0.11)));
  const ownerFont = Math.max(14, Math.min(26, Math.round(tileWidth * 0.08)));
  const offsetX = width * 1.35;
  const offsetY = height * 1.35;
  const safeOwner = `@${ownerHandle}`;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-28 * Math.PI) / 180);

  for (let y = -offsetY; y < offsetY; y += tileHeight) {
    for (let x = -offsetX; x < offsetX; x += tileWidth) {
      ctx.save();
      ctx.translate(x, y);

      ctx.strokeStyle = "rgba(216,216,216,0.14)";
      ctx.lineWidth = Math.max(2, minEdge * 0.0048);
      ctx.beginPath();
      ctx.moveTo(-32, 0);
      ctx.lineTo(tileWidth + 32, 0);
      ctx.stroke();

      ctx.strokeStyle = "rgba(210,210,210,0.09)";
      ctx.lineWidth = Math.max(1, minEdge * 0.0025);
      ctx.beginPath();
      ctx.moveTo(-24, tileHeight * 0.22);
      ctx.lineTo(tileWidth + 24, tileHeight * 0.22);
      ctx.moveTo(-24, tileHeight * 0.74);
      ctx.lineTo(tileWidth + 24, tileHeight * 0.74);
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.17;
      ctx.filter = "grayscale(1) brightness(1.9)";
      ctx.drawImage(logo, tileWidth * 0.08, tileHeight * 0.12, logoSize, logoSize);
      ctx.restore();

      ctx.fillStyle = "rgba(232,232,232,0.17)";
      ctx.font = `700 ${brandFont}px Arial, sans-serif`;
      ctx.fillText("EDGAZE", tileWidth * 0.42, tileHeight * 0.34);

      ctx.fillStyle = "rgba(228,228,228,0.18)";
      ctx.font = `700 ${ownerFont}px Arial, sans-serif`;
      ctx.fillText(safeOwner, tileWidth * 0.08, tileHeight * 0.63);

      ctx.fillStyle = "rgba(204,204,204,0.14)";
      ctx.font = `600 ${Math.max(12, ownerFont - 2)}px Arial, sans-serif`;
      ctx.fillText("DEMO PREVIEW", tileWidth * 0.08, tileHeight * 0.84);

      ctx.restore();
    }
  }

  ctx.restore();

  const badgeWidth = Math.max(240, Math.min(820, Math.round(width * 0.48)));
  const badgeHeight = Math.max(96, Math.min(180, Math.round(height * 0.12)));
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = (height - badgeHeight) / 2;
  const centerLogoSize = Math.max(64, Math.min(148, Math.round(minEdge * 0.09)));

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "rgba(20,20,20,0.4)";
  ctx.strokeStyle = "rgba(232,232,232,0.16)";
  ctx.lineWidth = Math.max(1, minEdge * 0.002);
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.filter = "grayscale(1) brightness(1.9)";
  ctx.drawImage(
    logo,
    badgeX + badgeHeight * 0.18,
    height / 2 - centerLogoSize / 2,
    centerLogoSize,
    centerLogoSize,
  );
  ctx.restore();

  ctx.fillStyle = "rgba(240,240,240,0.2)";
  ctx.font = `800 ${Math.max(18, Math.min(34, Math.round(badgeHeight * 0.24)))}px Arial, sans-serif`;
  ctx.fillText("EDGAZE DEMO", badgeX + badgeHeight * 0.18 + centerLogoSize + 22, height / 2 - 6);

  ctx.fillStyle = "rgba(232,232,232,0.19)";
  ctx.font = `700 ${Math.max(14, Math.min(24, Math.round(badgeHeight * 0.17)))}px Arial, sans-serif`;
  ctx.fillText(safeOwner, badgeX + badgeHeight * 0.18 + centerLogoSize + 22, height / 2 + 24);
  ctx.restore();
}

export async function createDemoWatermarkedImageBlobUrl(
  imageUrl: string,
  ownerHandle?: string | null,
): Promise<string> {
  const normalizedOwner = sanitizeOwnerHandle(ownerHandle);
  const cacheKey = `${normalizedOwner}\u0000${imageUrl}`;
  const cached = watermarkBlobUrlCache.get(cacheKey);
  if (cached) return await cached;

  const promise = (async () => {
    const serverUrl = getDemoWatermarkedImageUrl(imageUrl, normalizedOwner);

    try {
      const watermarkedBlob = await fetchImageBlob(serverUrl);
      if (watermarkedBlob.size > 0) {
        return URL.createObjectURL(watermarkedBlob);
      }
    } catch {
      // Fall through to client-side stamping.
    }

    const [sourceBlob, logo] = await Promise.all([
      fetchImageBlob(imageUrl),
      loadImage("/brand/edgaze-mark.png"),
    ]);
    const sourceObjectUrl = URL.createObjectURL(sourceBlob);

    try {
      const sourceImage = await loadImage(sourceObjectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = sourceImage.naturalWidth || sourceImage.width;
      canvas.height = sourceImage.naturalHeight || sourceImage.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas unavailable");
      }

      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      drawWatermarkLayer({
        ctx,
        width: canvas.width,
        height: canvas.height,
        ownerHandle: normalizedOwner,
        logo,
      });

      const outBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create watermarked image"));
        }, "image/png");
      });

      return URL.createObjectURL(outBlob);
    } finally {
      URL.revokeObjectURL(sourceObjectUrl);
    }
  })();

  watermarkBlobUrlCache.set(cacheKey, promise);
  try {
    return await promise;
  } catch (error) {
    watermarkBlobUrlCache.delete(cacheKey);
    throw error;
  }
}
