export const STORAGE_KEY = "barangay-connect-state-v1";

const COLLECTIONS = [
  "households",
  "staff",
  "waterBills",
  "propertyTaxes",
  "reports",
  "questions",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isValidState(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.version === 1 &&
    COLLECTIONS.every(
      (name) =>
        Array.isArray(value[name]) &&
        value[name].every(
          (record) =>
            record !== null &&
            typeof record === "object" &&
            !Array.isArray(record) &&
            typeof record.id === "string",
        ),
    )
  );
}

function assertValidState(value) {
  if (!isValidState(value)) {
    throw new Error("Saved portal data is invalid or uses an unsupported version.");
  }
}

function normalizeState(value, seedData) {
  const normalized = {
    ...clone(seedData),
    ...clone(value),
    version: 1,
    waterBills: value.waterBills.map((bill) =>
      bill.status === "Paid" ? bill : { ...bill, status: "Overdue" },
    ),
  };
  assertValidState(normalized);
  return normalized;
}

export function createPortalStateStore(storage, seedData) {
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function"
  ) {
    throw new TypeError("Portal state storage must provide getItem and setItem.");
  }

  function load() {
    let serialized;
    try {
      serialized = storage.getItem(STORAGE_KEY);
    } catch (cause) {
      throw new Error("Unable to read saved portal data.", { cause });
    }

    if (serialized === null) return { version: 1, ...clone(seedData) };

    let saved;
    try {
      saved = JSON.parse(serialized);
    } catch (cause) {
      throw new Error("Saved portal data could not be parsed.", { cause });
    }

    assertValidState(saved);
    return normalizeState(saved, seedData);
  }

  function commit(nextState) {
    assertValidState(nextState);
    const normalized = normalizeState(nextState, seedData);
    let serialized;
    try {
      serialized = JSON.stringify(normalized);
    } catch (cause) {
      throw new Error("Unable to serialize portal data.", { cause });
    }
    try {
      storage.setItem(STORAGE_KEY, serialized);
    } catch (cause) {
      throw new Error("Unable to save portal data.", { cause });
    }
    return clone(normalized);
  }

  return { load, commit };
}
