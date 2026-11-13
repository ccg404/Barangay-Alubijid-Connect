import assert from "node:assert/strict";
import test from "node:test";

const stateModule = await import("./portal-state.mjs").catch(() => null);

const seedData = {
  households: [{ id: "h1" }],
  staff: [{ id: "s1" }],
  waterBills: [{ id: "w1", status: "Unpaid" }],
  propertyTaxes: [],
  reports: [],
  questions: [],
};

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = nextValue;
    },
    value() {
      return value;
    },
  };
}

test("loads cloned seed data when no saved record exists", () => {
  assert.ok(
    stateModule?.createPortalStateStore,
    "createPortalStateStore export is missing",
  );
  const store = stateModule.createPortalStateStore(memoryStorage(), seedData);
  const loaded = store.load();
  loaded.households[0].id = "changed";
  assert.equal(seedData.households[0].id, "h1");
  assert.equal(store.load().version, 1);
});

test("rejects corrupt saved JSON without replacing it with seed data", () => {
  assert.ok(
    stateModule?.createPortalStateStore,
    "createPortalStateStore export is missing",
  );
  const storage = memoryStorage("{broken");
  const store = stateModule.createPortalStateStore(storage, seedData);
  assert.throws(() => store.load(), /saved portal data/i);
  assert.equal(storage.value(), "{broken");
});

test("rejects incomplete or unsupported saved records", () => {
  assert.ok(
    stateModule?.createPortalStateStore,
    "createPortalStateStore export is missing",
  );
  const incomplete = JSON.stringify({ version: 1, households: [] });
  const store = stateModule.createPortalStateStore(
    memoryStorage(incomplete),
    seedData,
  );
  assert.throws(() => store.load(), /saved portal data/i);
});

test("rejects malformed entries before they reach portal rendering", () => {
  assert.ok(
    stateModule?.createPortalStateStore,
    "createPortalStateStore export is missing",
  );
  const saved = JSON.stringify({
    version: 1,
    ...seedData,
    waterBills: [null],
  });
  const store = stateModule.createPortalStateStore(memoryStorage(saved), seedData);
  assert.throws(() => store.load(), /saved portal data/i);
});

test("does not publish a next snapshot when saving fails", () => {
  assert.ok(
    stateModule?.createPortalStateStore,
    "createPortalStateStore export is missing",
  );
  const persisted = JSON.stringify({ version: 1, ...seedData });
  const storage = {
    getItem: () => persisted,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
  const store = stateModule.createPortalStateStore(storage, seedData);
  const loaded = store.load();
  const next = { ...loaded, waterBills: [{ id: "w1", status: "Paid" }] };
  assert.throws(() => store.commit(next), /save portal data/i);
  assert.equal(store.load().waterBills[0].status, "Overdue");
});

test("persists a complete next snapshot and normalizes unpaid water status", () => {
  assert.ok(
    stateModule?.createPortalStateStore,
    "createPortalStateStore export is missing",
  );
  const storage = memoryStorage();
  const store = stateModule.createPortalStateStore(storage, seedData);
  const next = store.commit(store.load());
  assert.equal(next.waterBills[0].status, "Overdue");
  assert.equal(JSON.parse(storage.value()).waterBills[0].status, "Overdue");
});
