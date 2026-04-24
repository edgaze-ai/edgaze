import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /robots.txt", () => {
  it("allows OG image routes while keeping unrelated API paths blocked", async () => {
    const response = GET();
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(body).toContain("Allow: /api/og/");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: https://edgaze.ai/sitemap.xml");
  });
});
