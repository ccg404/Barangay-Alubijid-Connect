import assert from "node:assert/strict";
import test from "node:test";

const billingModule = await import("./billing.mjs").catch(() => null);
const stateModule = await import("./portal-state.mjs").catch(() => null);

test("a paid tax transition commits through the injected state adapter", () => {
  assert.ok(
    billingModule?.markBillingRecordPaid,
    "markBillingRecordPaid export is missing",
  );
  assert.ok(
    stateModule?.createPortalStateStore,
    "createPortalStateStore export is missing",
  );

  let stored = null;
  const storage = {
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  };
  const seedData = {
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
  const store = stateModule.createPortalStateStore(storage, seedData);
  const initial = store.load();
  const next = billingModule.markBillingRecordPaid(
    initial,
    "tax",
    "tax-1",
    "2027-01-31",
  );
  store.commit(next);

  assert.equal(store.load().propertyTaxes[0].amountDue, 10200);
  assert.equal(store.load().propertyTaxes[0].status, "Paid");
});
