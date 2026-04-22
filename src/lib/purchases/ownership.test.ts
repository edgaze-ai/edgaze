import { describe, expect, it } from "vitest";
import { findAccessiblePurchaseForResource } from "./ownership";

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

describe("findAccessiblePurchaseForResource", () => {
  it("uses the alternate purchase table when the preferred one has no paid row", async () => {
    const supabase = createSupabaseQueryMock({
      prompt_purchases: [
        {
          id: "purchase_1",
          prompt_id: "resource_123",
          buyer_id: "buyer_1",
          status: "paid",
          refunded_at: null,
        },
      ],
      workflow_purchases: [],
    });

    const result = await findAccessiblePurchaseForResource({
      supabase,
      resourceId: "resource_123",
      buyerId: "buyer_1",
      preferredTable: "workflow_purchases",
      type: "workflow",
      allowedStatuses: ["paid"],
    });

    expect(result.accessible).toBe(true);
    expect(result.table).toBe("prompt_purchases");
    expect(result.purchase?.id).toBe("purchase_1");
  });
});
