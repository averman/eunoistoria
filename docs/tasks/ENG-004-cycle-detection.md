# ENG-004 — Cycle Detection

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-004-cycle-detection`
- **Depends on:** ENG-001
- **Files created:** `packages/engine/src/cycle-detection.ts`, `packages/engine/tests/cycle-detection.test.ts`

## Objective

Determine whether adding a reference from a given composition to a given target document would create a circular reference. Uses BFS, follows variant group memberships.

## Behavior

**Exported function signature:**
```typescript
export async function wouldCreateCycle(
  compositionId: DocumentId,
  targetDocumentId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<boolean, ValidationError>>
```

**Algorithm:**
1. If `targetDocumentId === compositionId`: return `{ ok: true, value: true }` (self-reference).
2. Fetch the target document via `dataStore.getDocumentRecord(targetDocumentId)`. If not found: return `{ ok: false, error: ValidationError.CompositionNotFound }`.
3. If target is not a composition (`isComposition === false`): return `{ ok: true, value: false }` (leaves cannot form cycles).
4. BFS:
   - `visited = new Set<DocumentId>()`. Add `compositionId` to `visited` at start (this is the node we're protecting).
   - `queue: DocumentId[] = [targetDocumentId]`.
   - While queue is not empty:
     a. `current = queue.shift()`.
     b. If `visited.has(current)`: return `{ ok: true, value: true }`.
     c. `visited.add(current)`.
     d. Fetch slots via `dataStore.listSlots(current)`.
     e. For each slot:
        - If `slot.referenceType === 'document'` and `slot.referenceDocumentId` is defined:
          - Fetch `dataStore.getDocumentRecord(slot.referenceDocumentId)`.
          - If found and `isComposition === true`: add to queue.
        - If `slot.referenceType === 'variant_group'` and `slot.referenceVariantGroupId` is defined:
          - Fetch `dataStore.getVariantGroupMembers(slot.referenceVariantGroupId)`.
          - For each member `documentId`: fetch `getDocumentRecord(documentId)`. If found and `isComposition === true`: add to queue.
5. Queue exhausted: return `{ ok: true, value: false }`.

**DataStore errors** encountered during BFS are propagated as `ValidationError.StorageFailure`.

## Test Cases

TC-004-01: `self_reference_returns_true` — given compositionId A, targetDocumentId A, when `wouldCreateCycle(A, A)`, then `true`.

TC-004-02: `leaf_target_returns_false` — given composition A, leaf document B, when `wouldCreateCycle(A, B)`, then `false`.

TC-004-03: `direct_cycle_returns_true` — given A → B → A (A has a slot pointing to B, B has a slot pointing back to A), when `wouldCreateCycle(A, B)`, then `true`.

TC-004-04: `no_cycle_returns_false` — given A → B → C (B has a slot pointing to C, C is a leaf), when `wouldCreateCycle(A, B)`, then `false`.

TC-004-05: `cycle_through_variant_group_returns_true` — given A → variantGroup V → B → A (A has a variant_group slot pointing to V, V has member B, B has a document slot pointing back to A), when `wouldCreateCycle(A, B)`, then `true`.

TC-004-06: `deep_chain_no_cycle_returns_false` — given A → B → C → D (three levels), when `wouldCreateCycle(A, B)`, then `false`.

TC-004-07: `target_not_found_returns_error` — given non-existent targetDocumentId, then `{ ok: false, error: ValidationError.CompositionNotFound }`.

---
