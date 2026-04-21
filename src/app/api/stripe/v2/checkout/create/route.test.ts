import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserAndClient = vi.hoisted(() => vi.fn());
const mockResolveActorContext = vi.hoisted(() => vi.fn());
const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockPricesRetrieve = vi.hoisted(() => vi.fn());
const mockSessionsCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({
  getUserAndClient: mockGetUserAndClient,
}));

vi.mock("@/lib/auth/actor-context", () => ({
  resolveActorContext: mockResolveActorContext,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    prices: { retrieve: mockPricesRetrieve },
    checkout: { sessions: { create: mockSessionsCreate } },
  },
}));

vi.mock("@/lib/stripe/config", () => ({
  stripeConfig: {
    appUrl: "https://www.edgaze.ai",
    platformFeePercentage: 20,
  },
}));

import { ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { POST } from "./route";

describe("POST /api/stripe/v2/checkout/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClient.mockResolvedValue({});
    mockGetUserAndClient.mockResolvedValue({ user: { id: "buyer_1" } });
    mockResolveActorContext.mockResolvedValue({ actorMode: "creator_self" });
    mockPricesRetrieve.mockResolvedValue({ unit_amount: 2500 });
    mockSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      client_secret: "secret_123",
      url: "https://checkout.stripe.test/session",
    });
  });

  it("returns 401 when the buyer is not authenticated", async () => {
    mockGetUserAndClient.mockResolvedValue({ user: null });

    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/checkout/create", {
        method: "POST",
        body: JSON.stringify({ connectedAccountId: "acct_123", priceId: "price_123" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("returns 403 when an impersonating admin attempts checkout creation", async () => {
    mockResolveActorContext.mockRejectedValue(new ImpersonationForbiddenError());

    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/checkout/create", {
        method: "POST",
        body: JSON.stringify({ connectedAccountId: "acct_123", priceId: "price_123" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Not allowed during impersonation",
    });
  });

  it("falls back to app-owned redirect URLs when a foreign origin is supplied", async () => {
    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/checkout/create", {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: "acct_123",
          priceId: "price_123",
          embedded: false,
          successUrl: "https://evil.example/success",
          cancelUrl: "https://evil.example/cancel",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "https://www.edgaze.ai/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://www.edgaze.ai/store",
      }),
      { stripeAccount: "acct_123" },
    );
  });
});
