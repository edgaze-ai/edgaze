import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStripeTransfersCreate = vi.hoisted(() => vi.fn());
const mockStripePaymentIntentsRetrieve = vi.hoisted(() => vi.fn());
const mockSyncPlatformPendingClaimReserve = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    paymentIntents: {
      retrieve: mockStripePaymentIntentsRetrieve,
    },
    transfers: {
      create: mockStripeTransfersCreate,
    },
  },
}));

vi.mock("@/lib/stripe/platform-pending-claim-reserve", () => ({
  syncPlatformPendingClaimReserve: mockSyncPlatformPendingClaimReserve,
}));

import { syncCreatorPayoutAccount, transferPendingClaimEarnings } from "./webhook-processing";

describe("transferPendingClaimEarnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeTransfersCreate.mockResolvedValue({ id: "tr_pending_claim_123" });
    mockStripePaymentIntentsRetrieve.mockRejectedValue(new Error("No such payment_intent"));
    mockSyncPlatformPendingClaimReserve.mockResolvedValue(0);
  });

  it("transfers all pending-claim earnings for payout-ready creators regardless of deadline age", async () => {
    const claimedRows = [
      {
        id: "earn_old",
        net_amount_cents: 319,
        stripe_payment_intent_id: "pi_platform_old",
      },
      {
        id: "earn_recent",
        net_amount_cents: 160,
        stripe_payment_intent_id: "pi_platform_recent",
      },
    ];

    const activatedRows = claimedRows.map((row) => ({
      id: row.id,
      net_amount_cents: row.net_amount_cents,
    }));

    const initialUpdateBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("creator_id");
        expect(value).toBe("creator_123");
        return pendingStatusBuilder;
      },
    };

    const pendingStatusBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("status");
        expect(value).toBe("pending_claim");
        return pendingSelectBuilder;
      },
    };

    const pendingSelectBuilder = {
      select(selection: string) {
        expect(selection).toBe("id, net_amount_cents, stripe_payment_intent_id");
        return Promise.resolve({
          data: claimedRows,
          error: null,
        });
      },
    };

    const activateUpdateBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("creator_id");
        expect(value).toBe("creator_123");
        return activateStatusBuilder;
      },
    };

    const activateStatusBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("status");
        expect(value).toBe("pending");
        return activateIdsBuilder;
      },
    };

    const activateIdsBuilder = {
      in(field: string, values: string[]) {
        expect(field).toBe("id");
        expect(values).toEqual(["earn_old", "earn_recent"]);
        return activateSelectBuilder;
      },
    };

    const activateSelectBuilder = {
      select(selection: string) {
        expect(selection).toBe("id, net_amount_cents");
        return Promise.resolve({
          data: activatedRows,
          error: null,
        });
      },
    };

    const supabase = {
      from(table: string) {
        expect(table).toBe("creator_earnings");
        return {
          update(payload: Record<string, unknown>) {
            if (payload.status === "pending") {
              return initialUpdateBuilder;
            }

            if (payload.status === "available") {
              expect(payload).toMatchObject({
                status: "available",
                stripe_account_id: "acct_123",
                stripe_transfer_id: "tr_pending_claim_123",
              });
              return activateUpdateBuilder;
            }

            throw new Error(
              `Unexpected creator_earnings update payload: ${JSON.stringify(payload)}`,
            );
          },
        };
      },
      rpc(name: string, payload: Record<string, unknown>) {
        expect(name).toBe("increment_creator_balance");
        expect(payload).toEqual({
          creator_id: "creator_123",
          amount_cents: 479,
        });
        return Promise.resolve({ error: null });
      },
    };

    await transferPendingClaimEarnings(
      "creator_123",
      "acct_123",
      supabase as never,
      "test.pending-claim",
    );

    expect(mockStripeTransfersCreate).toHaveBeenCalledWith(
      {
        amount: 479,
        currency: "usd",
        destination: "acct_123",
        metadata: {
          edgaze_creator_id: "creator_123",
          earning_count: "2",
          reconciliation_type: "pending_claim",
        },
      },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^pending_claim_/),
      }),
    );
    expect(mockSyncPlatformPendingClaimReserve).toHaveBeenCalledWith(
      supabase,
      "test.pending-claim.reserve",
    );
  });

  it("releases already-settled connected-account earnings without creating a platform transfer", async () => {
    mockStripePaymentIntentsRetrieve.mockResolvedValue({ id: "pi_connected_1" });

    const claimedRows = [
      {
        id: "earn_connected",
        net_amount_cents: 479,
        stripe_payment_intent_id: "pi_connected_1",
      },
    ];

    const initialUpdateBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("creator_id");
        expect(value).toBe("creator_123");
        return pendingStatusBuilder;
      },
    };

    const pendingStatusBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("status");
        expect(value).toBe("pending_claim");
        return pendingSelectBuilder;
      },
    };

    const pendingSelectBuilder = {
      select(selection: string) {
        expect(selection).toBe("id, net_amount_cents, stripe_payment_intent_id");
        return Promise.resolve({
          data: claimedRows,
          error: null,
        });
      },
    };

    const directAvailableBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("creator_id");
        expect(value).toBe("creator_123");
        return directPendingBuilder;
      },
    };

    const directPendingBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("status");
        expect(value).toBe("pending");
        return directIdsBuilder;
      },
    };

    const directIdsBuilder = {
      in(field: string, values: string[]) {
        expect(field).toBe("id");
        expect(values).toEqual(["earn_connected"]);
        return Promise.resolve({ error: null });
      },
    };

    const supabase = {
      from(table: string) {
        expect(table).toBe("creator_earnings");
        return {
          update(payload: Record<string, unknown>) {
            if (payload.status === "pending") {
              return initialUpdateBuilder;
            }

            if (payload.status === "available") {
              expect(payload).toEqual({
                status: "available",
                stripe_account_id: "acct_123",
              });
              return directAvailableBuilder;
            }

            throw new Error(
              `Unexpected creator_earnings update payload: ${JSON.stringify(payload)}`,
            );
          },
        };
      },
      rpc(name: string, payload: Record<string, unknown>) {
        expect(name).toBe("increment_creator_balance");
        expect(payload).toEqual({
          creator_id: "creator_123",
          amount_cents: 479,
        });
        return Promise.resolve({ error: null });
      },
    };

    await transferPendingClaimEarnings(
      "creator_123",
      "acct_123",
      supabase as never,
      "test.direct-settled",
    );

    expect(mockStripeTransfersCreate).not.toHaveBeenCalled();
    expect(mockSyncPlatformPendingClaimReserve).toHaveBeenCalledWith(
      supabase,
      "test.direct-settled.reserve",
    );
  });

  it("keeps payout access working even when pending-claim transfer reconciliation fails", async () => {
    mockStripePaymentIntentsRetrieve.mockRejectedValue(new Error("No such payment_intent"));
    mockStripeTransfersCreate.mockRejectedValue(
      new Error(
        "You have insufficient funds in your Stripe account. One likely reason you have insufficient funds is that your funds are automatically being paid out; try enabling manual payouts by going to https://dashboard.stripe.com/account/payouts.",
      ),
    );

    const claimedRows = [
      {
        id: "earn_platform_1",
        net_amount_cents: 479,
        stripe_payment_intent_id: "pi_platform_1",
      },
    ];

    const pendingClaimUpdateBuilder = {
      eq(field: string, value: string) {
        if (field === "creator_id") {
          expect(value).toBe("creator_123");
          return pendingStatusBuilder;
        }
        throw new Error(`Unexpected eq on pendingClaimUpdateBuilder: ${field}`);
      },
    };

    const pendingStatusBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("status");
        expect(value).toBe("pending_claim");
        return pendingSelectBuilder;
      },
    };

    const pendingSelectBuilder = {
      select(selection: string) {
        expect(selection).toBe("id, net_amount_cents, stripe_payment_intent_id");
        return Promise.resolve({
          data: claimedRows,
          error: null,
        });
      },
    };

    const revertPendingBuilder = {
      eq(field: string, value: string) {
        if (field === "creator_id") {
          expect(value).toBe("creator_123");
          return revertStatusBuilder;
        }
        throw new Error(`Unexpected eq on revertPendingBuilder: ${field}`);
      },
    };

    const revertStatusBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("status");
        expect(value).toBe("pending");
        return revertIdsBuilder;
      },
    };

    const revertIdsBuilder = {
      in(field: string, values: string[]) {
        expect(field).toBe("id");
        expect(values).toEqual(["earn_platform_1"]);
        return Promise.resolve({ error: null });
      },
    };

    const connectAccountBuilder = {
      select(selection: string) {
        expect(selection).toBe("user_id");
        return {
          eq(field: string, value: string) {
            expect(field).toBe("stripe_account_id");
            expect(value).toBe("acct_123");
            return {
              maybeSingle: () =>
                Promise.resolve({
                  data: { user_id: "creator_123" },
                }),
            };
          },
        };
      },
    };

    const stripeConnectUpdateBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("stripe_account_id");
        expect(value).toBe("acct_123");
        return Promise.resolve({ error: null });
      },
    };

    const profilesUpdateBuilder = {
      eq(field: string, value: string) {
        expect(field).toBe("id");
        expect(value).toBe("creator_123");
        return Promise.resolve({ error: null });
      },
    };

    const supabase = {
      from(table: string) {
        if (table === "stripe_connect_accounts") {
          return {
            select(selection: string) {
              return connectAccountBuilder.select(selection);
            },
            update(payload: Record<string, unknown>) {
              expect(payload).toMatchObject({
                account_status: "active",
                payouts_enabled: true,
                details_submitted: true,
              });
              return stripeConnectUpdateBuilder;
            },
          };
        }

        if (table === "profiles") {
          return {
            update(payload: Record<string, unknown>) {
              expect(payload).toMatchObject({
                stripe_onboarding_status: "completed",
                can_receive_payments: true,
              });
              return profilesUpdateBuilder;
            },
          };
        }

        if (table === "creator_earnings") {
          return {
            update(payload: Record<string, unknown>) {
              if (payload.status === "pending") {
                return pendingClaimUpdateBuilder;
              }

              if (payload.status === "pending_claim") {
                return revertPendingBuilder;
              }

              throw new Error(
                `Unexpected creator_earnings update payload: ${JSON.stringify(payload)}`,
              );
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
      rpc: vi.fn().mockResolvedValue({ error: null }),
    };

    await expect(
      syncCreatorPayoutAccount({
        supabase: supabase as never,
        creatorId: "creator_123",
        stripeAccountId: "acct_123",
        chargesEnabled: false,
        payoutsEnabled: true,
        detailsSubmitted: true,
        payoutSetupComplete: true,
        source: "test.sync",
      }),
    ).resolves.toBeUndefined();
  });
});
