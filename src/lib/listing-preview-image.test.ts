import { describe, expect, it } from "vitest";
import {
  listingSocialImageVersion,
  promptOgImageUrl,
  workflowOgImageUrl,
} from "./listing-preview-image";

describe("listing preview social images", () => {
  const listing = {
    thumbnail_url: "https://cdn.example.com/workflows/123/thumbnail.jpg",
    banner_url: null,
    demo_images: [],
    output_demo_urls: [],
    updated_at: "2026-04-23T08:15:30.000Z",
  };

  it("uses listing updated_at and selected image URL in the social image version", () => {
    const originalVersion = listingSocialImageVersion(listing);
    const changedImageVersion = listingSocialImageVersion({
      ...listing,
      thumbnail_url: "https://cdn.example.com/workflows/123/thumbnail-v2.jpg",
    });
    const changedUpdatedAtVersion = listingSocialImageVersion({
      ...listing,
      updated_at: "2026-04-23T08:20:30.000Z",
    });

    expect(originalVersion).not.toBe(changedImageVersion);
    expect(originalVersion).not.toBe(changedUpdatedAtVersion);
    expect(originalVersion).toContain(String(Date.parse(listing.updated_at)));
  });

  it("builds absolute workflow OG URLs so X can fetch the image directly", () => {
    expect(workflowOgImageUrl("creator", "workflow-code", listing, "https://edgaze.ai")).toBe(
      `https://edgaze.ai/api/og/workflow?ownerHandle=creator&edgazeCode=workflow-code&v=${listingSocialImageVersion(
        listing,
      )}`,
    );
  });

  it("builds absolute prompt OG URLs so Meta-family crawlers fetch the image directly", () => {
    expect(
      promptOgImageUrl(
        "creator",
        "prompt-code",
        {
          thumbnail_url: listing.thumbnail_url,
          demo_images: listing.demo_images,
          output_demo_urls: listing.output_demo_urls,
          updated_at: listing.updated_at,
        },
        "https://edgaze.ai",
      ),
    ).toBe(
      `https://edgaze.ai/api/og/prompt?ownerHandle=creator&edgazeCode=prompt-code&v=${listingSocialImageVersion(
        {
          thumbnail_url: listing.thumbnail_url,
          demo_images: listing.demo_images,
          output_demo_urls: listing.output_demo_urls,
          updated_at: listing.updated_at,
        },
      )}`,
    );
  });
});
