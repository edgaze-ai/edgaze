"use client";

import type { Area } from "react-easy-crop";
import {
  MAX_ASSET_FILE_BYTES,
  assetMimeLabel,
  canonicalizeAssetMime,
  resolveAssetMime,
  validateAssetFile,
} from "../asset-upload-validation";

export const THUMBNAIL_ASPECT_RATIO = 1200 / 630;

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function validateListingImageSelection(file: File): Promise<{
  mime: string;
  width: number;
  height: number;
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const error = validateAssetFile(file, bytes, { requireMagicMatchForImages: true });
  if (error) throw new Error(error);

  const mime = canonicalizeAssetMime(resolveAssetMime(file, bytes));
  if (!mime) {
    throw new Error("Unsupported image file. Use PNG, JPEG, GIF, or WebP.");
  }

  const { width, height } = await measureFileImage(file);
  if (width < 1 || height < 1) {
    throw new Error("This image could not be read.");
  }

  return { mime, width, height };
}

export async function measureFileImage(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

export async function cropListingImageToFile(opts: {
  file: File;
  cropArea: Area;
  width: number;
  height: number;
  preferredName: string;
}): Promise<File> {
  const bytes = new Uint8Array(await opts.file.arrayBuffer());
  const mime = canonicalizeAssetMime(resolveAssetMime(opts.file, bytes)) || "image/jpeg";
  const outputMime = mime === "image/gif" ? "image/jpeg" : mime;
  const imageUrl = URL.createObjectURL(opts.file);

  try {
    const image = await loadImageElement(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = opts.width;
    canvas.height = opts.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser does not support image editing.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, opts.width, opts.height);
    context.drawImage(
      image,
      opts.cropArea.x,
      opts.cropArea.y,
      opts.cropArea.width,
      opts.cropArea.height,
      0,
      0,
      opts.width,
      opts.height,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => {
          if (!next) {
            reject(new Error("Failed to create cropped image."));
            return;
          }
          resolve(next);
        },
        outputMime,
        outputMime === "image/png" ? undefined : 0.92,
      );
    });

    return new File([blob], `${opts.preferredName}.${extensionForMime(outputMime)}`, {
      type: outputMime,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function needsThumbnailCrop(width: number, height: number, tolerance = 0.015): boolean {
  const ratio = width / height;
  return Math.abs(ratio - THUMBNAIL_ASPECT_RATIO) > tolerance;
}

export function listingImageRequirementsText() {
  const maxMb = Math.round(MAX_ASSET_FILE_BYTES / 1024 / 1024);
  return `PNG, JPEG/JPG, GIF, or WebP up to ${maxMb} MB. Thumbnails work best at 1200 x 630.`;
}

export function listingMimeSummary(mime: string) {
  return assetMimeLabel(mime);
}
