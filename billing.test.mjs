import assert from "node:assert/strict";
import test from "node:test";

const billingModule = await import("./billing.mjs").catch(() => null);

test("calculates and rounds each property-tax line on a full calendar-month anniversary", () => {
  assert.ok(billingModule?.calculateTax, "calculateTax export is missing");

  const result = billingModule.calculateTax(
    {
      year: 2026,
      assessedValue: 500001,
      amountDue: 0,
      status: "Unpaid",
      dueDate: "2026-12-31",
    },
    "2027-01-30",
  );
  assert.deepEqual(result, {
    base: 10000.02,
    discount: 0,
    penalty: 0,
    total: 10000.02,
  });
});

test("applies penalties at clamped end-of-month anniversaries", () => {
  assert.ok(billingModule?.calculateTax, "calculateTax export is missing");

  const result = billingModule.calculateTax(
    {
      year: 2026,
      assessedValue: 500000,
      amountDue: 0,
      status: "Unpaid",
      dueDate: "2026-12-31",
    },
    "2027-02-28",
  );
  assert.deepEqual(result, {
    base: 10000,
    discount: 0,
    penalty: 400,
    total: 10400,
  });
});

test("uses a paid tax amount and its saved breakdown as a historical snapshot", () => {
  assert.ok(billingModule?.calculateTax, "calculateTax export is missing");

  const result = billingModule.calculateTax(
    {
      year: 2026,
      assessedValue: 500000,
      amountDue: 9200,
      discountApplied: 1000,
      penaltyAccrued: 200,
      status: "Paid",
      dueDate: "2026-12-31",
    },
    "2030-01-01",
  );
  assert.deepEqual(result, {
    base: 10000,
    discount: 1000,
    penalty: 200,
    total: 9200,
  });
});

test("marks an entire billing record paid without mutating the prior state", () => {
  assert.ok(
    billingModule?.markBillingRecordPaid,
    "markBillingRecordPaid export is missing",
  );

  const state = {
    version: 1,
    households: [],
    staff: [],
    waterBills: [],
    propertyTaxes: [
      {
        id: "tax-1",
        householdId: "h1",
        year: 2026,
        assessedValue: 500000,
        amountDue: 0,
        discountApplied: 0,
        penaltyAccrued: 0,
        status: "Unpaid",
        dueDate: "2026-12-31",
      },
    ],
    reports: [],
    questions: [],
  };

  const next = billingModule.markBillingRecordPaid(
    state,
    "tax",
    "tax-1",
    "2027-01-31",
  );
  assert.equal(state.propertyTaxes[0].status, "Unpaid");
  assert.deepEqual(next.propertyTaxes[0], {
    ...state.propertyTaxes[0],
    amountDue: 10200,
    discountApplied: 0,
    penaltyAccrued: 200,
    status: "Paid",
  });
});
