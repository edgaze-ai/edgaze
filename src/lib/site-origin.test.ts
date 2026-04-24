import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteOrigin } from "./site-origin";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
});

describe("getSiteOrigin", () => {
  it("defaults production metadata to the www host", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getSiteOrigin()).toBe("https://www.edgaze.ai");
  });

  it("prefers NEXT_PUBLIC_SITE_URL when explicitly configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.edgaze.ai/some/path");

    expect(getSiteOrigin()).toBe("https://preview.edgaze.ai");
  });
});
