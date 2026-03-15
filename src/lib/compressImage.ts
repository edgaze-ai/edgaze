/**
 * Compress an image as much as needed to fit within maxBytes.
 * Tries progressively lower quality and smaller dimensions.
 * Throws only if the image cannot fit even at minimum quality and size.
 */
export async function compressImageToMaxSize(file: File, maxBytes: number): Promise<Blob> {
  if (typeof document === "undefined")
    throw new Error("compressImageToMaxSize requires browser environment");
  if (!file.type.startsWith("image/")) return file as unknown as Blob;
  if (file.size <= maxBytes) return file as unknown as Blob;

  const img = await loadImage(file);
  const steps: Array<[number, number]> = [
    [2400, 0.85],
    [1800, 0.7],
    [1200, 0.55],
    [900, 0.4],
    [640, 0.3],
    [480, 0.2],
    [400, 0.15],
    [400, 0.1],
  ];

  for (const [maxDim, quality] of steps) {
    const blob = await compressToBlob(img, maxDim, quality);
    if (blob.size <= maxBytes) return blob;
  }

  throw new Error(
    `Image is too large. Even after maximum compression it exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB limit. Try a smaller or simpler image.`,
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function compressToBlob(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let w = img.width;
    let h = img.height;
    if (w > maxDimension || h > maxDimension) {
      if (w >= h) {
        h = Math.round((h / w) * maxDimension);
        w = maxDimension;
      } else {
        w = Math.round((w / h) * maxDimension);
        h = maxDimension;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas not supported"));
      return;
    }
    ctx.drawImage(img, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Compression failed"));
      },
      "image/jpeg",
      quality,
    );
  });
}
