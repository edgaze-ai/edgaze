import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("app robots metadata", () => {
  it("gives Twitterbot an explicit OG image allow rule and keeps the rest of /api blocked for general bots", () => {
    const metadata = robots();
    const rules = Array.isArray(metadata.rules) ? metadata.rules : [metadata.rules];
    const twitterRule = rules.find((rule) => rule?.userAgent === "Twitterbot");
    const rootRule = rules.find((rule) => rule?.userAgent === "*");

    expect(twitterRule).toBeDefined();
    expect(twitterRule?.allow).toEqual(["/api/og/"]);
    expect(rootRule).toBeDefined();
    expect(rootRule?.allow).toEqual(["/", "/api/og/"]);
    expect(rootRule?.disallow).toContain("/api/");
    expect(metadata.sitemap).toBe("https://www.edgaze.ai/sitemap.xml");
    expect(metadata.host).toBe("www.edgaze.ai");
  });
});
