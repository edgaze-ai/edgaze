import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockResolveActorContext = vi.hoisted(() => vi.fn());
const mockProductsCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock("@/lib/auth/actor-context", () => ({
  resolveActorContext: mockResolveActorContext,
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    products: { create: mockProductsCreate },
  },
}));

import { ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { POST } from "./route";

describe("POST /api/stripe/v2/products/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "creator_1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { stripe_account_id: "acct_123", account_status: "active" },
            }),
          }),
        }),
      }),
    });

    mockResolveActorContext.mockResolvedValue({ actorMode: "creator_self" });
    mockProductsCreate.mockResolvedValue({
      id: "prod_123",
      name: "Workflow Pack",
      default_price: "price_123",
      created: 1,
    });
  });

  it("returns 403 when an impersonating admin tries to create products", async () => {
    mockResolveActorContext.mockRejectedValue(new ImpersonationForbiddenError());

    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/products/create", {
        method: "POST",
        body: JSON.stringify({ name: "Workflow Pack", priceInCents: 1500 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Not allowed during impersonation",
    });
  });

  it("creates products on the authenticated creator account", async () => {
    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/products/create", {
        method: "POST",
        body: JSON.stringify({ name: "Workflow Pack", priceInCents: 1500 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockProductsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Workflow Pack",
        default_price_data: expect.objectContaining({ unit_amount: 1500, currency: "usd" }),
        metadata: { edgaze_user_id: "creator_1" },
      }),
      { stripeAccount: "acct_123" },
    );
  });
});
