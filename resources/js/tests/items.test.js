import { describe, expect, it } from "vite-plus/test";
import { getCanonicalItemMap } from "../../game/items";

function buildItems(entries) {
  return new Map(entries.map(({ id, ...rest }) => [id, { alchable: true, mapping: null, ...rest }]));
}

describe("getCanonicalItemMap", function describeCanonicalItemMap() {
  it("groups a charge-tier degradation family (Barrows-style) under the undamaged item", function testChargeTiers() {
    const items = buildItems([
      { id: 100, name: "Ahrim's hood", highalch: 1000 },
      { id: 101, name: "Ahrim's hood 100", highalch: 1000 },
      { id: 102, name: "Ahrim's hood 75", highalch: 1000 },
      { id: 103, name: "Ahrim's hood 50", highalch: 1000 },
      { id: 104, name: "Ahrim's hood 25", highalch: 1000 },
      { id: 105, name: "Ahrim's hood 0", highalch: 1000 },
    ]);

    const canonicalItemMap = getCanonicalItemMap(items);

    expect(canonicalItemMap.get(100)).toBeUndefined();
    for (const id of [101, 102, 103, 104, 105]) {
      expect(canonicalItemMap.get(id)).toBe(100);
    }
  });

  it("groups a (broken) variant with its undamaged item", function testBrokenVariant() {
    const items = buildItems([
      { id: 200, name: "Blood moon chestplate", highalch: 174006 },
      { id: 201, name: "Blood moon chestplate (broken)", highalch: 174006 },
    ]);

    const canonicalItemMap = getCanonicalItemMap(items);

    expect(canonicalItemMap.get(201)).toBe(200);
  });

  it("picks the highalch-matching clean item when duplicate clean names exist", function testDuplicateCleanNames() {
    const items = buildItems([
      { id: 300, name: "Blood moon helm", highalch: 61800 },
      { id: 301, name: "Blood moon helm", highalch: 61800, mapping: [{ id: 300, quantity: 1 }] },
      { id: 302, name: "Blood moon helm", highalch: 60 },
      { id: 303, name: "Blood moon helm (broken)", highalch: 61800 },
    ]);

    const canonicalItemMap = getCanonicalItemMap(items);

    expect(canonicalItemMap.get(301)).toBe(300);
    expect(canonicalItemMap.get(302)).toBe(300);
    expect(canonicalItemMap.get(303)).toBe(300);
  });

  it("leaves a family ungrouped when the broken variant's highalch matches no clean candidate", function testAmbiguousFamily() {
    const items = buildItems([
      { id: 400, name: "Decorative sword", highalch: 300 },
      { id: 401, name: "Decorative sword", highalch: 780 },
      { id: 402, name: "Decorative sword", highalch: 1920 },
      { id: 403, name: "Decorative sword (broken)", highalch: 0 },
    ]);

    const canonicalItemMap = getCanonicalItemMap(items);

    expect(canonicalItemMap.size).toBe(0);
  });

  it("leaves a family ungrouped when no undamaged item exists at all", function testNoCleanMember() {
    const items = buildItems([{ id: 500, name: "Fungicide spray 0", highalch: 0 }]);

    const canonicalItemMap = getCanonicalItemMap(items);

    expect(canonicalItemMap.size).toBe(0);
  });

  it("does not touch items with no degradation suffix, even with duplicate names", function testUnrelatedDuplicateNames() {
    const items = buildItems([
      { id: 600, name: "Key", highalch: 1 },
      { id: 601, name: "Key", highalch: 1 },
      { id: 602, name: "Vial", highalch: 1 },
    ]);

    const canonicalItemMap = getCanonicalItemMap(items);

    expect(canonicalItemMap.size).toBe(0);
  });

  it("caches the result per item Map instance", function testCaching() {
    const items = buildItems([
      { id: 100, name: "Ahrim's hood", highalch: 1000 },
      { id: 101, name: "Ahrim's hood 100", highalch: 1000 },
    ]);

    expect(getCanonicalItemMap(items)).toBe(getCanonicalItemMap(items));
  });
});
