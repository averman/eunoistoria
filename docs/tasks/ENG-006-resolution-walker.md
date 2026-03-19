# ENG-006 — Resolution Walker

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-006-resolution`
- **Depends on:** ENG-003, ENG-001
- **Files created:** `packages/engine/src/resolution.ts`, `packages/engine/tests/resolution.test.ts`

## Objective

Walk a composition tree using a `SelectionMap` and an `AccessFilterPort`, recursively resolving slots to leaf content and concatenating the result into a flat markdown string.

## Behavior

**Exported constant:**
```typescript
export const MAX_RECURSION_DEPTH = 20;
```

**Exported function:**
```typescript
export async function resolveTree(
  nodeId: DocumentId,
  selectionMap: SelectionMap,
  accessFilter: AccessFilterPort,
  dataStore: DataStorePort,
  depth: number
): Promise<Result<string, ResolutionError>>
```

**Algorithm:**
1. If `depth >= MAX_RECURSION_DEPTH`: return `{ ok: false, error: ResolutionError.MaxDepthExceeded }`.
2. Call `dataStore.getDocument(nodeId)`.
   - If `DataStoreError.NotFound`: return `{ ok: true, value: '' }` (broken reference → silent skip, D-BP-08).
   - If other DataStoreError: return `{ ok: false, error: ResolutionError.BrokenReference }`.
3. If document is a `DataLeaf`: return `{ ok: true, value: document.content }`.
4. If document is a `DataComposition`:
   - Initialize `parts: string[] = []`.
   - For each slot in `document.slots` (already ordered by `slotOrder` ascending):
     a. Check toggle state: `const isOn = selectionMap.toggleStates.get(slot.id) ?? true`. If `false`, skip.
     b. Resolve to a `targetId: DocumentId | null`:
        - If `slot.referenceType === 'document'`: `targetId = slot.referenceDocumentId ?? null`.
        - If `slot.referenceType === 'variant_group'`:
          ```
          const sortOrder = selectionMap.sortOrders.get(slot.id);
          let resolved: DocumentId | null = null;
          if (sortOrder && sortOrder.length > 0) {
            for (const candidateId of sortOrder) {
              if (await accessFilter.canAccess(candidateId)) {
                resolved = candidateId;
                break;
              }
            }
          }
          if (resolved === null) {
            // Fallback: position-0 from the data store (universal default)
            const membersResult = await dataStore.getVariantGroupMembers(slot.referenceVariantGroupId!);
            if (membersResult.ok && membersResult.value.length > 0) {
              resolved = membersResult.value[0];
            }
          }
          targetId = resolved;
          ```
     c. If `targetId === null`: skip slot (broken reference → silent).
     d. Recurse: `const childResult = await resolveTree(targetId, selectionMap, accessFilter, dataStore, depth + 1)`.
     e. If `childResult.ok === false`: propagate the error immediately (return `childResult`).
     f. If `childResult.value !== ''`: push to `parts`.
   - Return `{ ok: true, value: parts.join('\n\n') }`.

## Test Cases

TC-006-01: `resolves_leaf_document` — single leaf document with content "Hello", resolveTree returns "Hello".

TC-006-02: `resolves_composition_with_two_leaf_slots` — composition with two leaf slots, content "A" and "B", returns "A\n\nB".

TC-006-03: `skips_toggled_off_slots` — composition with two slots, first slot toggled off via `selectionMap`, returns only second slot's content.

TC-006-04: `selects_first_accessible_variant_group_member` — variant_group slot with two members (A, B). `selectionMap.sortOrders` contains `[B-id, A-id]`. Access filter: A accessible, B not accessible. Returns content of A.

TC-006-05: `falls_back_to_position_zero_when_no_sort_order` — variant_group slot, no sort order in `selectionMap`, two members (default at order 0, other at order 1). Both accessible. Returns content of default (order 0).

TC-006-06: `propagates_max_depth_error` — composition nested 21 levels deep, returns `ResolutionError.MaxDepthExceeded`.

TC-006-07: `skips_broken_document_reference_silently` — slot references a deleted document ID. Returns `ok: true` with the other slots' content (broken slot produces empty, joined correctly).

TC-006-08: `resolves_nested_composition` — A → B (composition) → C (leaf "deep"). Returns "deep".

TC-006-09: `empty_slot_content_not_added_to_parts` — slot resolves to empty string leaf. Result does not contain extra `\n\n` separators for the empty slot.

---
