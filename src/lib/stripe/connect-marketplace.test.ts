import { describe, expect, it } from "vitest";
import { canRouteMarketplaceFundsToConnectedAccount } from "./connect-marketplace";

describe("canRouteMarketplaceFundsToConnectedAccount", () => {
  it("allows routing when transfers are usable even if payouts are still finalizing", () => {
    expect(
      canRouteMarketplaceFundsToConnectedAccount({
        accountId: "acct_123",
        country: "US",
        readyForPayouts: false,
        readyToProcessPayments: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: true,
        transfersCapabilityStatus: "pending",
        requirementsCurrentlyDue: [],
        requirementsPastDue: [],
        requirementsEventuallyDue: [],
        requirementsDisabledReason: null,
        edgazeUserId: "user_123",
      }),
    ).toBe(true);
  });

  it("blocks routing when Stripe has hard-disabled the account", () => {
    expect(
      canRouteMarketplaceFundsToConnectedAccount({
        accountId: "acct_123",
        country: "US",
        readyForPayouts: false,
        readyToProcessPayments: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: true,
        transfersCapabilityStatus: "active",
        requirementsCurrentlyDue: [],
        requirementsPastDue: [],
        requirementsEventuallyDue: [],
        requirementsDisabledReason: "requirements.past_due",
        edgazeUserId: "user_123",
      }),
    ).toBe(false);
  });
});
