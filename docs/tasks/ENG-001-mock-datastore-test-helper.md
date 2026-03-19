# ENG-001 — Mock DataStore (Test Helper)

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-001-mock-data-store`
- **Depends on:** TYP-004
- **Files created:** `packages/engine/tests/helpers/mock-data-store.ts`

## Objective

Build an in-memory implementation of `DataStorePort`. This is the test double used by every engine unit test. It must faithfully implement all 40+ methods of the interface.

## Behavior

**Internal storage.** The mock holds the following private `Map` structures:
- `documents: Map<DocumentId, DocumentRecord>` — flat document records
- `slots: Map<SlotId, CompositionSlot>` — slot records keyed by slotId
- `slotsByComposition: Map<DocumentId, SlotId[]>` — ordered list of slot IDs per composition
- `variantGroups: Map<VariantGroupId, VariantGroupRecord>`
- `variantGroupMembers: Map<VariantGroupId, VariantGroupMemberRecord[]>` — arrays kept sorted ascending by `memberOrder`
- `tags: Map<TagId, TagRecord>`
- `documentTags: Map<DocumentId, TagId[]>`
- `presets: Map<PresetId, PresetRecord>`
- `presetRules: Map<PresetId, PresetRuleRecord[]>` — arrays kept sorted ascending by `ruleOrder`
- `presetAdHocDocs: Map<PresetId, PresetAdHocDocumentRecord[]>` — sorted by `inclusionOrder`

**ID generation.** Use `crypto.randomUUID()` for all generated IDs.

**`getDocument(id)`** — assembles a `DataDocument` from internal state:
1. Look up document in `documents`. If missing: `{ ok: false, error: DataStoreError.NotFound }`.
2. Get tags: look up `documentTags.get(id)`, map each `TagId` to `TagRecord`, return `{ key, value }` pairs as `Tag[]`.
3. If leaf: return `DataLeaf { type: 'leaf', id, title, tags, content: record.content ?? '' }`.
4. If composition: look up `slotsByComposition.get(id) ?? []`, return `DataComposition { type: 'composition', id, title, tags, slots: slots[] }`.

**`getPreset(id)`** — assembles a `Preset` from internal state:
1. Look up in `presets`. If missing: `DataStoreError.NotFound`.
2. Get rules from `presetRules.get(id) ?? []`, map to `Rule[]` by extracting `{ premise, action }`.
3. Get ad-hoc docs from `presetAdHocDocs.get(id) ?? []`, extract `documentId[]` in order.
4. Return `Preset { id, name, baseCompositionId: record.compositionId, rules, adHocDocuments }`.

**`getVariantGroupMembers(id)`** — returns members sorted by `memberOrder` ascending, extract `documentId`.

**`queryDocuments(projectId, predicates)`** — filter in-memory:
1. Collect all document records where `record.projectId === projectId`.
2. For each document, apply ALL predicates (AND logic). A document passes if all predicates return true.
3. For tag predicates: look up the document's tags. For `tag_eq`: find a tag where `tag.key === predicate.key` and `coerce(tag.value) === coerce(predicate.value)`.
4. Apply type coercion (D-BP-10) for all comparison predicates: `const coerce = (v: string): number | string => { const n = Number(v); return isNaN(n) ? v : n; }`. If both coerced values are numbers, compare numerically. Otherwise compare as strings.
5. Hydrate passing documents via `getDocument()` and return as `DataDocument[]`.

**Write methods** must maintain consistency:
- `createDocument`: generate UUID, store in `documents`, initialize `documentTags.set(id, [])`, if composition init `slotsByComposition.set(id, [])`. Return `DocumentRecord`.
- `deleteDocument`: remove from `documents`, `documentTags`, `slotsByComposition`. Do NOT cascade-delete slots/members (mirroring SQL's SET NULL behavior).
- `createSlot`: generate UUID for slotId, store in `slots`, append slotId to `slotsByComposition[compositionId]`. The `slotOrder` equals the current length of `slotsByComposition[compositionId]` before appending.
- `reorderSlots`: replace the `slotsByComposition[compositionId]` array with the provided `orderedSlotIds`. Update `slotOrder` on each slot record to reflect new position.
- `addVariantGroupMember`: `memberOrder` = current members count. Append to `variantGroupMembers[groupId]`.
- `removeVariantGroupMember`: remove the matching member, then re-index remaining members (assign 0, 1, 2... in their current order).
- `reorderVariantGroupMembers`: replace member list in new order, re-assign `memberOrder` values (0, 1, 2...).
- `addPresetRule`: `ruleOrder` = current rule count. Append.
- `removePresetRule`: remove, then re-index remaining rules.
- `reorderPresetRules`: replace rule list, re-assign `ruleOrder` values.
- `assignTag`: find existing tag record in `tags` matching (document's projectId, key, value), or create a new one. Append `tagId` to `documentTags[documentId]`. Return `TagRecord`.
- `removeTag`: remove `tagId` from `documentTags[documentId]` and from `tags`.

**Export.** Export a factory function:
```typescript
export function createMockDataStore(): DataStorePort;
```

## Test Cases

TC-001-01: `createDocument` then `getDocument` returns the correct hydrated `DataDocument`.
TC-001-02: `createDocument` with `isComposition: true` returns a composition with empty slots array.
TC-001-03: `createSlot`, then `getDocument(compositionId)` returns `DataComposition` with the slot populated.
TC-001-04: `addVariantGroupMember` twice, `getVariantGroupMembers` returns both IDs in insertion order.
TC-001-05: `removeVariantGroupMember` for the second member, `listVariantGroupMemberRecords` returns only the first with `memberOrder = 0`.
TC-001-06: `assignTag` twice with same key+value returns the same `TagRecord.id` both times (idempotent tag creation).
TC-001-07: `getDocument` on an unknown ID returns `{ ok: false, error: DataStoreError.NotFound }`.
TC-001-08: `queryDocuments` with `tag_lt` predicate using numeric tag value correctly returns only matching documents.

---
