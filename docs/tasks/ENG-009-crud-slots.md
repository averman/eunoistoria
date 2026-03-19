# ENG-009 — CRUD: Slots

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-009-crud-slots`
- **Depends on:** ENG-008, ENG-004
- **Files created:** `packages/engine/src/crud/slots.ts`, `packages/engine/tests/crud/slots.test.ts`

## Objective

Business logic for composition slot operations: add, remove, reorder, list. Adding a slot that would create a cycle is rejected.

## Behavior

```typescript
export async function addSlot(compositionId: DocumentId, input: CreateSlotInput, dataStore: DataStorePort): Promise<Result<CompositionSlot, SlotError>>
export async function removeSlot(slotId: SlotId, dataStore: DataStorePort): Promise<Result<void, SlotError>>
export async function reorderSlots(compositionId: DocumentId, orderedSlotIds: SlotId[], dataStore: DataStorePort): Promise<Result<void, SlotError>>
export async function listSlots(compositionId: DocumentId, dataStore: DataStorePort): Promise<Result<CompositionSlot[], SlotError>>
```

**`addSlot` flow:**
1. Fetch `getDocumentRecord(compositionId)`. If not found: `SlotError.CompositionNotFound`.
2. If `record.isComposition === false`: `SlotError.CompositionNotFound` (only compositions have slots).
3. `validateSlotCreateInput(input)`. If error: propagate as `SlotError`.
4. Cycle detection:
   - If `input.referenceType === 'document'` and `input.referenceDocumentId` is defined:
     - Call `wouldCreateCycle(compositionId, input.referenceDocumentId, dataStore)`.
     - If result is `true`: return `SlotError.WouldCreateCycle`.
   - If `input.referenceType === 'variant_group'` and `input.referenceVariantGroupId` is defined:
     - Fetch `dataStore.getVariantGroupMembers(input.referenceVariantGroupId)`.
     - For each member `documentId`: call `wouldCreateCycle(compositionId, documentId, dataStore)`. If any returns `true`: `SlotError.WouldCreateCycle`.
5. Verify the target exists:
   - If `referenceType === 'document'`: call `getDocumentRecord(input.referenceDocumentId!)`. If not found: `SlotError.TargetNotFound`.
   - If `referenceType === 'variant_group'`: call `dataStore.getVariantGroup(input.referenceVariantGroupId!)`. If not found: `SlotError.TargetNotFound`.
6. Call `dataStore.createSlot(compositionId, input)`.

**`removeSlot` flow:**
1. Fetch `dataStore.listSlots` for the slot's composition, or directly look up the slot. Use `dataStore.listSlots` is impractical without the compositionId — instead: call all necessary lookups to verify the slot exists. Simplification: attempt `dataStore.deleteSlot(slotId)`. If `DataStoreError.NotFound`: `SlotError.NotFound`.

**`reorderSlots` flow:**
1. Fetch `dataStore.listSlots(compositionId)`.
2. Verify `orderedSlotIds` is a permutation of existing slot IDs (same set, different order). If lengths differ or any ID is not present: `SlotError.InvalidOrdering`.
3. Call `dataStore.reorderSlots(compositionId, orderedSlotIds)`.

**`listSlots` flow:**
1. Fetch `getDocumentRecord(compositionId)`. If not found: `SlotError.CompositionNotFound`.
2. Call `dataStore.listSlots(compositionId)`.

## Test Cases

TC-009-01: `add_slot_to_composition_succeeds` — slot is created, slot list contains new slot.
TC-009-02: `add_slot_to_leaf_returns_error` — `SlotError.CompositionNotFound`.
TC-009-03: `add_slot_creating_direct_cycle_returns_error` — `SlotError.WouldCreateCycle`.
TC-009-04: `add_slot_creating_cycle_via_variant_group_returns_error` — member of variant group would create cycle → `SlotError.WouldCreateCycle`.
TC-009-05: `add_slot_with_missing_target_returns_error` — `SlotError.TargetNotFound`.
TC-009-06: `reorder_with_wrong_slot_ids_returns_error` — `SlotError.InvalidOrdering`.
TC-009-07: `reorder_with_correct_permutation_succeeds` — slots returned in new order after reorder.
TC-009-08: `remove_nonexistent_slot_returns_not_found` — `SlotError.NotFound`.

---
