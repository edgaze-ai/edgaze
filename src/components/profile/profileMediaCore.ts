import type { Area } from "react-easy-crop";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImageToMaxSize } from "../../lib/compressImage";

export type MediaKind = "banner" | "avatar";

export type LocalAsset = {
  file: File;
  objectUrl: string;
};

export const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg"]);

export const MEDIA_CONFIG: Record<
  MediaKind,
  {
    title: string;
    description: string;
    aspect: number;
    cropShape: "rect" | "round";
    outputWidth: number;
    outputHeight: number;
    maxBytes: number;
    emptyLabel: string;
  }
> = {
  banner: {
    title: "Banner",
    description: "Wide hero for your public profile.",
    aspect: 3 / 1,
    cropShape: "rect",
    outputWidth: 1500,
    outputHeight: 500,
    maxBytes: 10 * 1024 * 1024,
    emptyLabel: "Upload banner",
  },
  avatar: {
    title: "Profile photo",
    description: "Shown as your avatar everywhere on Edgaze.",
    aspect: 1,
    cropShape: "round",
    outputWidth: 1024,
    outputHeight: 1024,
    maxBytes: 5 * 1024 * 1024,
    emptyLabel: "Upload photo",
  },
};

export function mimeTypeToExtension(mimeType: string) {
  return mimeType === "image/png" ? "png" : "jpg";
}

export function normalizeMimeType(file: File) {
  return file.type === "image/png" ? "image/png" : "image/jpeg";
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

export async function measureImage(src: string) {
  const image = await loadImageElement(src);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export async function cropImageToBlob({
  src,
  cropArea,
  outputWidth,
  outputHeight,
  mimeType,
}: {
  src: string;
  cropArea: Area;
  outputWidth: number;
  outputHeight: number;
  mimeType: string;
}): Promise<Blob> {
  const image = await loadImageElement(src);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser does not support image editing.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, outputWidth, outputHeight);
  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create cropped image."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      mimeType === "image/png" ? undefined : 0.92,
    );
  });
}

export async function uploadPreparedProfileMedia(
  supabase: SupabaseClient,
  profileId: string,
  kind: MediaKind,
  asset: LocalAsset,
  cropArea: Area,
): Promise<string> {
  const config = MEDIA_CONFIG[kind];
  const initialMimeType = normalizeMimeType(asset.file);
  const croppedBlob = await cropImageToBlob({
    src: asset.objectUrl,
    cropArea,
    outputWidth: config.outputWidth,
    outputHeight: config.outputHeight,
    mimeType: initialMimeType,
  });

  const preparedFile = new File([croppedBlob], `${kind}.${mimeTypeToExtension(initialMimeType)}`, {
    type: initialMimeType,
  });

  const uploadPayload =
    preparedFile.size > config.maxBytes
      ? await compressImageToMaxSize(preparedFile, config.maxBytes)
      : preparedFile;

  const uploadMimeType = uploadPayload.type || initialMimeType;
  const extension = mimeTypeToExtension(uploadMimeType);
  const bucket = kind === "avatar" ? "avatars" : "banners";
  const path = `${profileId}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, uploadPayload, {
    cacheControl: "3600",
    upsert: false,
    contentType: uploadMimeType,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Failed to get public image URL.");
  }

  return data.publicUrl;
}
