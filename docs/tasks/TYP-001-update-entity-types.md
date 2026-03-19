# TYP-001 — Update Entity Types

- **Sub-project:** `packages/types`
- **Branch:** `feat/TYP-001-entity-types-update`
- **Depends on:** none
- **Files modified:** `packages/types/src/entities.ts`

## Objective

Update the existing entity types to match the ERD and remove the `selectedIndex` field that was removed in the final schema design. Add the `TagId` branded type and update `Preset` to carry its `adHocDocuments`.

## Behavior

The following changes are made to `packages/types/src/entities.ts`:

**1. Add `TagId` branded type** next to the other branded identifiers:
```typescript
export type TagId = string & { readonly __brand: unique symbol };
```

**2. Replace `CompositionSlot`** entirely. Remove the old interface and replace with:
```typescript
export interface CompositionSlot {
  id: SlotId;
  compositionId: DocumentId;
  slotOrder: number;                          // 0-indexed position within the composition
  referenceType: 'document' | 'variant_group';
  referenceDocumentId?: DocumentId;           // defined when referenceType === 'document'
  referenceVariantGroupId?: VariantGroupId;   // defined when referenceType === 'variant_group'
}
```
The `documentId?`, `variantGroupId?`, and `selectedIndex?` fields are removed entirely.

**3. Update `Preset`** to add the `adHocDocuments` field:
```typescript
export interface Preset {
  id: PresetId;
  name: string;
  baseCompositionId: DocumentId;
  rules: Rule[];
  adHocDocuments: DocumentId[]; // ordered by inclusion_order ascending; empty array if none
}
```

**4. No other changes.** `DataDocument`, `DataLeaf`, `DataComposition`, `VariantGroup`, `Tag`, `ResolvedDocument`, `ResolvedLeaf`, `ResolvedComposition`, `BaseDataDocument`, `BaseResolvedDocument` are unchanged.

## Test Cases

`packages/types` has no runtime tests — only `tsc --noEmit` is run. Test is: `tsc` passes with zero errors after these changes.

## Scope Boundary

- Does not modify `rules.ts`, `resolution.ts`, `results.ts`, `ports.ts`, or `index.ts`.
- Does not add CRUD types (that is TYP-002).

---
