import { beforeEach, describe, expect, it, vi } from "vitest";
import { listingSocialImageVersion } from "../lib/listing-preview-image";

const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

describe("social metadata", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("includes the default fallback image on a generic public page", async () => {
    const marketplaceLayout = await import("./marketplace/layout");
    const images = marketplaceLayout.metadata.openGraph?.images as Array<{ url: string }>;

    expect(images[0]?.url).toBe("https://edgaze.ai/og.png?v=3");
    expect((marketplaceLayout.metadata.twitter?.images as Array<{ url: string }>)[0]?.url).toBe(
      "https://edgaze.ai/og.png?v=3",
    );
  });

  it("keeps profile routes excluded from search/social indexing defaults", async () => {
    const layoutModule = await import("./profile/layout");
    const pageModule = await import("./profile/[handle]/page");

    expect(layoutModule.metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
    expect(pageModule.metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it("emits absolute workflow OG image URLs", async () => {
    const listing = {
      title: "Workflow title",
      description: "Workflow description",
      thumbnail_url: "https://cdn.example.com/workflow.png",
      banner_url: null,
      demo_images: [],
      output_demo_urls: [],
      price_usd: null,
      is_paid: false,
      updated_at: "2026-04-23T08:15:30.000Z",
    };

    mockCreateSupabaseAdminClient.mockReturnValue({
      from: () => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          in: () => chain,
          maybeSingle: async () => ({ data: listing, error: null }),
        };
        return chain;
      },
    });

    const workflowLayout = await import("./[ownerHandle]/[edgazeCode]/layout");
    const metadata = await workflowLayout.generateMetadata({
      params: Promise.resolve({ ownerHandle: "creator", edgazeCode: "workflow-code" }),
      children: null,
    });
    const images = metadata.openGraph?.images as Array<{ url: string }>;

    expect(metadata.alternates?.canonical).toBe("https://edgaze.ai/creator/workflow-code");
    expect(images[0]?.url).toBe(
      `https://edgaze.ai/api/og/workflow?ownerHandle=creator&edgazeCode=workflow-code&v=${listingSocialImageVersion(
        listing,
      )}`,
    );
  });

  it("emits absolute prompt OG image URLs", async () => {
    const listing = {
      title: "Prompt title",
      description: "Prompt description",
      thumbnail_url: "https://cdn.example.com/prompt.png",
      demo_images: [],
      output_demo_urls: [],
      type: "prompt",
      price_usd: null,
      is_paid: false,
      updated_at: "2026-04-23T08:15:30.000Z",
    };

    mockCreateSupabaseAdminClient.mockReturnValue({
      from: () => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          in: () => chain,
          maybeSingle: async () => ({ data: listing, error: null }),
        };
        return chain;
      },
    });

    const promptLayout = await import("./p/[ownerHandle]/[edgazeCode]/layout");
    const metadata = await promptLayout.generateMetadata({
      params: Promise.resolve({ ownerHandle: "creator", edgazeCode: "prompt-code" }),
      children: null,
    });
    const images = metadata.openGraph?.images as Array<{ url: string }>;

    expect(metadata.alternates?.canonical).toBe("https://edgaze.ai/p/creator/prompt-code");
    expect(images[0]?.url).toBe(
      `https://edgaze.ai/api/og/prompt?ownerHandle=creator&edgazeCode=prompt-code&v=${listingSocialImageVersion(
        listing,
      )}`,
    );
  });
});
