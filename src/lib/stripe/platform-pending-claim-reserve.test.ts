import { beforeEach, describe, expect, it, vi } from "vitest";

const mockBalanceSettingsUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    balanceSettings: {
      update: mockBalanceSettingsUpdate,
    },
  },
}));

import { syncPlatformPendingClaimReserve } from "./platform-pending-claim-reserve";

describe("syncPlatformPendingClaimReserve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalanceSettingsUpdate.mockResolvedValue({});
  });

  it("keeps a platform reserve equal to currently claimable pending claims", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                net_amount_cents: 479,
                claim_deadline_at: "2099-07-21T00:00:00.000Z",
              },
              {
                net_amount_cents: 1250,
                claim_deadline_at: "2000-01-01T00:00:00.000Z",
              },
              {
                net_amount_cents: 600,
                claim_deadline_at: null,
              },
            ],
            error: null,
          }),
        }),
      }),
    };

    const reserve = await syncPlatformPendingClaimReserve(supabase as never, "test");

    expect(reserve).toBe(1079);
    expect(mockBalanceSettingsUpdate).toHaveBeenCalledWith({
      payments: {
        payouts: {
          minimum_balance_by_currency: {
            usd: 1079,
          },
        },
      },
    });
  });
});
