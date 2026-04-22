import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserAndClient = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());
const mockGrantPaidCheckoutSessionAccess = vi.hoisted(() => vi.fn());
const mockSessionRetrieve = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({
  getUserAndClient: mockGetUserAndClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: mockSessionRetrieve,
      },
    },
  },
}));

vi.mock("@/lib/stripe/webhook-processing", () => ({
  grantPaidCheckoutSessionAccess: mockGrantPaidCheckoutSessionAccess,
}));

import { GET } from "./route";

function createSupabaseQueryMock(rowsByTable: Record<string, any[]>) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              const filters = [{ column, value }];

              const builder = {
                eq(nextColumn: string, nextValue: string) {
                  filters.push({ column: nextColumn, value: nextValue });
                  return builder;
                },
                async maybeSingle() {
                  const rows = rowsByTable[table] || [];
                  const match =
                    rows.find((row) =>
                      filters.every(({ column: filterColumn, value: filterValue }) => {
                        return row[filterColumn] === filterValue;
                      }),
                    ) || null;

                  return { data: match, error: null };
                },
              };

              return builder;
            },
          };
        },
      };
    },
  };
}

describe("GET /api/stripe/checkout/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSupabaseAdminClient.mockReturnValue({ role: "admin" });
    mockGrantPaidCheckoutSessionAccess.mockResolvedValue(undefined);
  });

  it("confirms workflow purchases created via the prompts source path after self-heal", async () => {
    const rowsByTable = {
      prompt_purchases: [] as any[],
      workflow_purchases: [] as any[],
    };

    const supabase = createSupabaseQueryMock(rowsByTable);

    mockGetUserAndClient.mockResolvedValue({
      user: { id: "buyer_1" },
      supabase,
    });

    mockSessionRetrieve.mockResolvedValue({
      id: "cs_test_123",
      payment_status: "paid",
      metadata: {
        buyer_id: "buyer_1",
        workflow_id: "wf_123",
        purchase_type: "workflow",
        source_table: "prompts",
      },
    });

    mockGrantPaidCheckoutSessionAccess.mockImplementation(async () => {
      rowsByTable.prompt_purchases.push({
        id: "purchase_1",
        prompt_id: "wf_123",
        buyer_id: "buyer_1",
        stripe_checkout_session_id: "cs_test_123",
        status: "paid",
      });
    });

    const response = await GET(
      new Request(
        "https://www.edgaze.ai/api/stripe/checkout/confirm?session_id=cs_test_123&resource_id=wf_123&type=workflow",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      confirmed: true,
      purchaseId: "purchase_1",
      status: "paid",
      recoveredFromWebhookDelay: true,
    });
    expect(mockGrantPaidCheckoutSessionAccess).toHaveBeenCalledTimes(1);
  });
});
