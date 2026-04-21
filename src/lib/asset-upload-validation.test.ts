import { describe, expect, it } from "vitest";
import {
  explainAssetMimeMismatch,
  getMimeFromMagic,
  resolveAssetMime,
  validateAssetFile,
} from "./asset-upload-validation";

function bytes(values: number[]) {
  return new Uint8Array(values);
}

describe("asset upload validation", () => {
  it("detects JPEG data even when the file is labelled as PNG", () => {
    const jpegHeader = bytes([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const file = new File([jpegHeader], "thumb.png", { type: "image/png" });

    expect(getMimeFromMagic(jpegHeader)).toBe("image/jpeg");
    expect(resolveAssetMime(file, jpegHeader)).toBe("image/jpeg");
    expect(validateAssetFile(file, jpegHeader, { requireMagicMatchForImages: true })).toContain(
      "The file says PNG, but the actual contents look like JPEG.",
    );
  });

  it("accepts images with an empty browser MIME when magic bytes are valid", () => {
    const pngHeader = bytes([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const file = new File([pngHeader], "thumb", { type: "" });

    expect(validateAssetFile(file, pngHeader, { requireMagicMatchForImages: true })).toBeNull();
    expect(resolveAssetMime(file, pngHeader)).toBe("image/png");
  });

  it("explains mismatches in plain language", () => {
    expect(explainAssetMimeMismatch("image/webp", "image/jpeg")).toContain(
      "renamed without converting it",
    );
  });
});
