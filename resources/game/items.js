import * as z from "zod/v4";
import { fetchVersionedData } from "../api/fetch-versioned-data";

const itemDataSchema = z
  .record(
    z.string().regex(/^\d+$/),
    z.object({
      name: z.string(),
      highalch: z.uint32(),
      alchable: z.boolean(),
      stacks: z
        .array(z.tuple([z.uint32(), z.uint32()]))
        .min(1)
        .optional(),
      mapping: z
        .array(z.object({ id: z.uint32(), quantity: z.uint32() }))
        .optional()
        .nullable(),
    }),
  )
  .transform(function mapItemData(itemData) {
    return new Map(Object.entries(itemData).map(([itemId, item]) => [Number.parseInt(itemId), item]));
  });
const itemTagsSchema = z.object({
  tags: z.array(z.string().nonempty()).transform(function mapTags(tags) {
    return tags.map((tag, index) => [tag, index]);
  }),
  items: z.record(
    z.string(),
    z
      .string()
      .nonempty()
      .transform(function parseTags(tags) {
        return BigInt(tags);
      }),
  ),
});
export function composeItemIconHref({ itemID, quantity }, itemDatum) {
  let id = itemID;
  if (itemDatum?.stacks) {
    for (const [stackBreakpoint, stackItemID] of itemDatum.stacks) {
      if (stackBreakpoint > quantity) break;
      id = stackItemID;
    }
  }
  return `/item-icons/${id}.webp`;
}

export function isRunePouch(id) {
  const RUNE_POUCH = 12791;
  const DIVINE_RUNE_POUCH = 27281;
  return id === RUNE_POUCH || id === DIVINE_RUNE_POUCH;
}

export async function fetchItemData() {
  const data = await fetchVersionedData("/data/item_data.json");

  return itemDataSchema.parseAsync(data);
}

export async function fetchItemTags() {
  const data = await fetchVersionedData("/data/item_tags.json");

  return itemTagsSchema.parseAsync(data);
}

export function quantityColor(quantity) {
  if (quantity >= 10_000_000) return "#00ff00";
  if (quantity >= 100_000) return "#ffffff";
  return "#ffff00";
}

export function formatShortQuantity(quantity) {
  if (quantity >= 1000000000) {
    return Math.floor(quantity / 1000000000) + "B";
  } else if (quantity >= 10000000) {
    return Math.floor(quantity / 1000000) + "M";
  } else if (quantity >= 100000) {
    return Math.floor(quantity / 1000) + "K";
  }
  return quantity.toString();
}

export function formatVeryShortQuantity(quantity) {
  if (quantity >= 1000 && quantity < 100000) {
    return Math.floor(quantity / 1000) + "K";
  }
  return formatShortQuantity(quantity);
}
function resolveItemVariant(itemID, items, visited = new Set()) {
  if (!items) return itemID;
  if (visited.has(itemID)) return itemID;
  visited.add(itemID);
  const itemEntry = items.get(itemID);
  const mapping = itemEntry?.mapping;
  if (mapping?.length !== 1 || mapping[0].quantity !== 1) {
    return itemID;
  }
  const next = mapping[0].id;
  if (next === itemID) return itemID;
  return resolveItemVariant(next, items, visited);
}

export function mappedHighAlch(itemID, items) {
  if (!items) return 0;
  const itemEntry = items.get(itemID);
  if (!itemEntry) return 0;
  if (itemEntry.alchable) return itemEntry.highalch;
  const resolvedID = resolveItemVariant(itemID, items);
  if (resolvedID === itemID) return 0;
  const resolvedEntry = items.get(resolvedID);
  if (!resolvedEntry?.alchable) return 0;
  return resolvedEntry.highalch;
}

export function mappedAlchable(itemID, items) {
  if (!items) return false;
  const itemEntry = items.get(itemID);
  if (!itemEntry) return false;
  if (itemEntry.alchable) return true;
  const resolvedID = resolveItemVariant(itemID, items);
  if (resolvedID === itemID) return false;
  return Boolean(items.get(resolvedID)?.alchable);
}

const DEGRADED_BROKEN_PATTERN = /^(.*?)\s*\(broken\)$/i;
const DEGRADED_CHARGE_PATTERN = /^(.*)\s(?:100|75|50|25|0)$/;

function stripDegradationSuffix(name) {
  const brokenMatch = DEGRADED_BROKEN_PATTERN.exec(name);
  if (brokenMatch) return { base: brokenMatch[1], matched: true };
  const chargeMatch = DEGRADED_CHARGE_PATTERN.exec(name);
  if (chargeMatch) return { base: chargeMatch[1], matched: true };
  return { base: name, matched: false };
}

// Picks which item in a degradation family (e.g. Ahrim's hood / Ahrim's hood 75 / ... / Ahrim's
// hood (broken)) represents the whole family in the UI. Some item names are ambiguous duplicates
// (e.g. "Decorative armour" covers several unrelated cosmetic tiers under one name) - highalch
// equality against the degraded variants is used to rule those out rather than guess.
function pickCanonicalID(cleanIDs, suffixedIDs, items) {
  if (cleanIDs.length === 0) return undefined;
  if (cleanIDs.length === 1) return cleanIDs[0];

  const suffixedHighAlchValues = new Set(suffixedIDs.map((id) => items.get(id).highalch));
  const matched = cleanIDs.filter((id) => suffixedHighAlchValues.has(items.get(id).highalch));

  if (matched.length === 0) return undefined;
  if (matched.length === 1) return matched[0];

  const matchedHighAlchValues = new Set(matched.map((id) => items.get(id).highalch));
  if (matchedHighAlchValues.size !== 1) return undefined;

  return Math.min(...matched);
}

const canonicalItemMapCache = new WeakMap();

// Maps each degraded/damaged variant's item ID to the ID of its undamaged family representative,
// so the items list can show one combined row instead of one row per degradation tier. Only
// includes entries for variants that should redirect - a canonical item itself has no entry.
export function getCanonicalItemMap(items) {
  if (!items) return new Map();
  const cached = canonicalItemMapCache.get(items);
  if (cached) return cached;

  const nameIndex = new Map();
  for (const [itemID, item] of items) {
    const ids = nameIndex.get(item.name) ?? [];
    ids.push(itemID);
    nameIndex.set(item.name, ids);
  }

  const suffixGroups = new Map();
  for (const [itemID, item] of items) {
    const { base, matched } = stripDegradationSuffix(item.name);
    if (!matched) continue;
    const ids = suffixGroups.get(base) ?? [];
    ids.push(itemID);
    suffixGroups.set(base, ids);
  }

  const canonicalItemMap = new Map();
  for (const [base, suffixedIDs] of suffixGroups) {
    const cleanIDs = nameIndex.get(base) ?? [];
    const canonicalID = pickCanonicalID(cleanIDs, suffixedIDs, items);
    if (canonicalID === undefined) continue;

    for (const itemID of new Set([...cleanIDs, ...suffixedIDs])) {
      if (itemID !== canonicalID) {
        canonicalItemMap.set(itemID, canonicalID);
      }
    }
  }

  canonicalItemMapCache.set(items, canonicalItemMap);
  return canonicalItemMap;
}

export function mappedGEPrice(itemID, gePrices, items, memo = new Map(), visited = new Set()) {
  if (!gePrices || !items) {
    return 0;
  }
  if (memo.has(itemID)) {
    return memo.get(itemID);
  }
  if (itemID === 995) {
    memo.set(itemID, 1);
    return 1;
  }
  if (itemID === 13204) {
    memo.set(itemID, 1000);
    return 1000;
  }
  const itemEntry = items.get(itemID);
  if (!itemEntry) {
    return 0;
  }
  if (itemEntry.mapping && itemEntry.mapping.length > 0) {
    visited.add(itemID);
    const total = itemEntry.mapping.reduce((sum, { id, quantity }) => {
      return sum + mappedGEPrice(id, gePrices, items, memo, visited) * quantity;
    }, 0);
    visited.delete(itemID);
    memo.set(itemID, total);
    return total;
  }
  const direct = gePrices.get(itemID) ?? 0;
  memo.set(itemID, direct);
  return direct;
}
