export const AS_OF_DATE = "2026-09-24";

const TAX_RATE = 0.02;
const EARLY_DISCOUNT_RATE = 0.1;
const LATE_PENALTY_RATE = 0.02;
const CENTS = 100;

function roundToCents(value) {
  return Math.round((value + Number.EPSILON) * CENTS) / CENTS;
}

function dateParts(value) {
  if (value instanceof Date) {
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) throw new TypeError(`Invalid billing date: ${value}`);
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new TypeError(`Invalid billing date: ${value}`);
  }
  return { year, month, day };
}

function compareDates(left, right) {
  return (
    left.year - right.year ||
    left.month - right.month ||
    left.day - right.day
  );
}

function addCalendarMonthsClamped(date, months) {
  const absoluteMonth = date.year * 12 + date.month - 1 + months;
  const year = Math.floor(absoluteMonth / 12);
  const monthIndex = absoluteMonth % 12;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    year,
    month: monthIndex + 1,
    day: Math.min(date.day, lastDay),
  };
}

function completedCalendarMonths(dueDate, today) {
  const due = dateParts(dueDate);
  const asOf = dateParts(today);
  let months = (asOf.year - due.year) * 12 + asOf.month - due.month;
  while (months > 0 && compareDates(asOf, addCalendarMonthsClamped(due, months)) < 0) {
    months -= 1;
  }
  return Math.max(0, months);
}

export function effectiveBillStatus(bill) {
  return bill.status === "Paid" ? "Paid" : "Overdue";
}

export function outstandingBillingRecords(state) {
  return [
    ...state.waterBills
      .filter((bill) => bill.status !== "Paid")
      .map((record) => ({ type: "water", record })),
    ...state.propertyTaxes
      .filter((record) => record.status !== "Paid")
      .map((record) => ({ type: "tax", record })),
  ];
}

export function calculateTax(tax, today = AS_OF_DATE) {
  const base = roundToCents(Number(tax.assessedValue) * TAX_RATE);
  if (tax.status === "Paid") {
    const discount = roundToCents(Number(tax.discountApplied) || 0);
    const penalty = roundToCents(Number(tax.penaltyAccrued) || 0);
    const paidAmount = Number(tax.amountDue);
    return {
      base,
      discount,
      penalty,
      total: Number.isFinite(paidAmount)
        ? roundToCents(paidAmount)
        : roundToCents(Math.max(0, base - discount + penalty)),
    };
  }

  const discountDeadline = `${tax.year}-10-31`;
  const discount =
    compareDates(dateParts(today), dateParts(discountDeadline)) <= 0
      ? roundToCents(base * EARLY_DISCOUNT_RATE)
      : 0;
  const overdueMonths = completedCalendarMonths(tax.dueDate, today);
  const penalty = roundToCents(base * LATE_PENALTY_RATE * overdueMonths);
  const total = roundToCents(Math.max(0, base - discount + penalty));

  return { base, discount, penalty, total };
}

export function markBillingRecordPaid(state, type, id, today = AS_OF_DATE) {
  const collectionName =
    type === "water"
      ? "waterBills"
      : type === "tax"
        ? "propertyTaxes"
        : null;
  if (!collectionName) throw new TypeError(`Unknown billing record type: ${type}`);

  const collection = state[collectionName];
  const record = collection.find((item) => item.id === id);
  if (!record) throw new Error(`Billing record not found: ${id}`);

  let paidRecord = { ...record, status: "Paid" };
  if (type === "tax") {
    const calculation = calculateTax(record, today);
    paidRecord = {
      ...paidRecord,
      amountDue: calculation.total,
      discountApplied: calculation.discount,
      penaltyAccrued: calculation.penalty,
    };
  }

  return {
    ...state,
    [collectionName]: collection.map((item) =>
      item.id === id ? paidRecord : item,
    ),
  };
}
