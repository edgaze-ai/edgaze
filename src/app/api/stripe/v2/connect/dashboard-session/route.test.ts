import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserAndClient = vi.hoisted(() => vi.fn());
const mockResolveActorContext = vi.hoisted(() => vi.fn());
const mockCreateConnectDashboardAccountSession = vi.hoisted(() => vi.fn());
const mockReconcileCreatorPayoutAccount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({
  getUserAndClient: mockGetUserAndClient,
}));

vi.mock("@/lib/auth/actor-context", () => ({
  resolveActorContext: mockResolveActorContext,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ admin: true })),
}));

vi.mock("@/lib/stripe/connect-marketplace", () => ({
  createConnectDashboardAccountSession: mockCreateConnectDashboardAccountSession,
}));

vi.mock("@/lib/stripe/reconcile-payout-account", () => ({
  reconcileCreatorPayoutAccount: mockReconcileCreatorPayoutAccount,
}));

import { ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { POST } from "./route";

describe("POST /api/stripe/v2/connect/dashboard-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserAndClient.mockResolvedValue({ user: { id: "creator_1" } });
    mockResolveActorContext.mockResolvedValue({
      actorMode: "creator_self",
      effectiveProfileId: "workspace_creator_1",
    });
    mockCreateConnectDashboardAccountSession.mockResolvedValue({
      clientSecret: "dash_secret_123",
    });
  });

  it("reconciles live Stripe readiness before granting dashboard access", async () => {
    mockReconcileCreatorPayoutAccount.mockResolvedValue({
      stripeAccountId: "acct_live_ready",
      status: {
        readyForPayouts: true,
      },
    });

    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/connect/dashboard-session", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockReconcileCreatorPayoutAccount).toHaveBeenCalledWith({
      supabase: { admin: true },
      creatorId: "workspace_creator_1",
      source: "v2.dashboard-session",
    });
    expect(mockCreateConnectDashboardAccountSession).toHaveBeenCalledWith("acct_live_ready");
    await expect(response.json()).resolves.toEqual({ clientSecret: "dash_secret_123" });
  });

  it("returns 400 when Stripe still says the account is not payout-ready", async () => {
    mockReconcileCreatorPayoutAccount.mockResolvedValue({
      stripeAccountId: "acct_pending",
      status: {
        readyForPayouts: false,
      },
    });

    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/connect/dashboard-session", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Connect account not active yet",
    });
  });

  it("returns 403 when an impersonating admin attempts to open the dashboard", async () => {
    mockResolveActorContext.mockRejectedValue(new ImpersonationForbiddenError());

    const response = await POST(
      new Request("https://www.edgaze.ai/api/stripe/v2/connect/dashboard-session", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Not allowed during impersonation",
    });
  });
});
