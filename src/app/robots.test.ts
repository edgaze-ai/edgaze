import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("app robots metadata", () => {
  it("allows OG image routes while keeping the rest of /api blocked", () => {
    const metadata = robots();
    const rootRule = Array.isArray(metadata.rules) ? metadata.rules[0] : metadata.rules;

    expect(rootRule).toBeDefined();
    expect(rootRule?.allow).toEqual(["/", "/api/og/"]);
    expect(rootRule?.disallow).toContain("/api/");
    expect(metadata.sitemap).toBe("https://www.edgaze.ai/sitemap.xml");
    expect(metadata.host).toBe("www.edgaze.ai");
  });
});
