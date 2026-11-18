import assert from "node:assert/strict";
import test from "node:test";

const module = await import("./billing.mjs").catch(() => null);

test("returns 'overdue' when due date has passed", () => {
  assert.ok(module?.billReminder, "billReminder export is missing");
  const result = module.billReminder(
    { dueDate: "2026-09-01", status: "Unpaid" },
    "2026-09-24",
  );
  assert.equal(result.level, "overdue");
  assert.equal(result.days, -23);
  assert.ok(result.message.length > 0);
});

test("returns 'due-today' when due date is today", () => {
  assert.ok(module?.billReminder, "billReminder export is missing");
  const result = module.billReminder(
    { dueDate: "2026-09-24", status: "Unpaid" },
    "2026-09-24",
  );
  assert.equal(result.level, "due-today");
  assert.equal(result.days, 0);
});

test("returns 'due-soon' when within 7 days", () => {
  assert.ok(module?.billReminder, "billReminder export is missing");
  const result = module.billReminder(
    { dueDate: "2026-09-28", status: "Unpaid" },
    "2026-09-24",
  );
  assert.equal(result.level, "due-soon");
  assert.equal(result.days, 4);
});

test("returns 'due-soon' at exactly 7 days boundary", () => {
  assert.ok(module?.billReminder, "billReminder export is missing");
  const result = module.billReminder(
    { dueDate: "2026-10-01", status: "Unpaid" },
    "2026-09-24",
  );
  assert.equal(result.level, "due-soon");
  assert.equal(result.days, 7);
});

test("returns 'upcoming' when more than 7 days away", () => {
  assert.ok(module?.billReminder, "billReminder export is missing");
  const result = module.billReminder(
    { dueDate: "2026-10-15", status: "Unpaid" },
    "2026-09-24",
  );
  assert.equal(result.level, "upcoming");
  assert.equal(result.days, 21);
});

test("returns 'paid' for paid records regardless of date", () => {
  assert.ok(module?.billReminder, "billReminder export is missing");
  const result = module.billReminder(
    { dueDate: "2026-09-01", status: "Paid" },
    "2026-09-24",
  );
  assert.equal(result.level, "paid");
  assert.equal(result.days, -23);
});

test("returns 'none' when no due date is set", () => {
  assert.ok(module?.billReminder, "billReminder export is missing");
  const result = module.billReminder(
    { dueDate: null, status: "Unpaid" },
    "2026-09-24",
  );
  assert.equal(result.level, "none");
  assert.equal(result.days, null);
});

test("billReminderLevel returns correct CSS class names", () => {
  assert.ok(module?.billReminderLevel, "billReminderLevel export is missing");
  assert.equal(module.billReminderLevel("overdue"), "bill-overdue");
  assert.equal(module.billReminderLevel("due-today"), "bill-due-today");
  assert.equal(module.billReminderLevel("due-soon"), "bill-due-soon");
  assert.equal(module.billReminderLevel("upcoming"), "bill-upcoming");
  assert.equal(module.billReminderLevel("paid"), "bill-paid");
  assert.equal(module.billReminderLevel("unknown"), "bill-upcoming");
});

test("outstandingBillingRecordsWithReminders includes reminder data", () => {
  assert.ok(module?.outstandingBillingRecordsWithReminders, "outstandingBillingRecordsWithReminders export is missing");
  const state = {
    waterBills: [
      { id: "w1", householdId: "h1", status: "Unpaid", dueDate: "2026-09-20", amountDue: 100, period: "2026-09", consumption: 10 },
    ],
    propertyTaxes: [
      { id: "t1", householdId: "h1", year: 2026, assessedValue: 500000, amountDue: 0, status: "Unpaid", dueDate: "2026-12-31" },
    ],
  };
  const result = module.outstandingBillingRecordsWithReminders(state, "2026-09-24");
  assert.equal(result.length, 2);
  assert.equal(result[0].reminder.level, "overdue");
  assert.equal(result[1].reminder.level, "upcoming");
});