import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReconcileCreatorPayoutAccount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/reconcile-payout-account", () => ({
  reconcileCreatorPayoutAccount: mockReconcileCreatorPayoutAccount,
}));

import { reconcilePendingClaimCreators } from "./reconcile-pending-claims";

describe("reconcilePendingClaimCreators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles each creator with pending claims once and summarizes readiness", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { creator_id: "creator_active" },
              { creator_id: "creator_active" },
              { creator_id: "creator_pending" },
              { creator_id: "creator_missing" },
            ],
            error: null,
          }),
        }),
      }),
    };

    mockReconcileCreatorPayoutAccount
      .mockResolvedValueOnce({
        stripeAccountId: "acct_active",
        status: { readyForPayouts: true },
      })
      .mockResolvedValueOnce({
        stripeAccountId: "acct_pending",
        status: { readyForPayouts: false },
      })
      .mockResolvedValueOnce(null);

    const summary = await reconcilePendingClaimCreators(supabase as never, "test.reconcile");

    expect(summary).toEqual({
      scannedCount: 3,
      activeCount: 1,
      pendingCount: 1,
      missingAccountCount: 1,
      failures: [],
    });
    expect(mockReconcileCreatorPayoutAccount).toHaveBeenNthCalledWith(1, {
      supabase,
      creatorId: "creator_active",
      source: "test.reconcile.creator_active",
    });
  });
});
