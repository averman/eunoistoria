# ENG-013 — Engine Public API (`createEngine`)

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-013-public-api`
- **Depends on:** ENG-002, ENG-006, ENG-008, ENG-009, ENG-010, ENG-011, ENG-012
- **Files modified:** `packages/engine/src/index.ts`
- **Files created:** `packages/engine/tests/integration.test.ts`

## Objective

Implement the `createEngine` factory function that wires all CRUD modules and resolution logic into the `Engine` interface. This is the public entry point of the package.

## Behavior

**Exported function:**
```typescript
export function createEngine(dataStore: DataStorePort, accessFilter: AccessFilterPort): Engine
```

The factory returns an object satisfying the `Engine` interface. Each method is a thin closure that captures `dataStore` and `accessFilter` and delegates to the appropriate module function.

**`resolution.evaluateRules(presetId, variables)` implementation:**
1. Call `dataStore.getPreset(presetId)`. If not found: `ResolutionError.PresetNotFound`.
2. Build `slotContexts: SlotRuleContext[]` by recursively walking the composition tree:
   ```
   async function collectSlotContexts(compositionId: DocumentId): Promise<SlotRuleContext[]>
     document = await dataStore.getDocument(compositionId)
     if document is DataLeaf: return []
     contexts = []
     for slot of document.slots:
       if slot.referenceType === 'document' and slot.referenceDocumentId is defined:
         refDoc = await dataStore.getDocument(slot.referenceDocumentId)
         tags = refDoc.ok ? refDoc.value.tags : []
         contexts.push({ slotId: slot.id, referenceType: 'document', documentTags: tags, variantGroupMembers: [] })
         if refDoc.ok and refDoc.value.type === 'composition':
           contexts.push(...await collectSlotContexts(slot.referenceDocumentId))
       if slot.referenceType === 'variant_group' and slot.referenceVariantGroupId is defined:
         memberIds = await dataStore.getVariantGroupMembers(slot.referenceVariantGroupId)
         memberContexts = []
         for (index, memberId) of memberIds.value (if ok):
           memberDoc = await dataStore.getDocument(memberId)
           memberTags = memberDoc.ok ? memberDoc.value.tags : []
           memberContexts.push({ documentId: memberId, memberOrder: index, tags: memberTags })
         defaultMemberTags = memberContexts[0]?.tags ?? []
         contexts.push({ slotId: slot.id, referenceType: 'variant_group', documentTags: defaultMemberTags, variantGroupMembers: memberContexts })
   return contexts
   ```
3. Call `evaluateRules(preset.rules, variables, slotContexts)` (pure function from ENG-003).
4. Return `{ ok: true, value: selectionMap }`.

**`resolution.resolve(presetId, variables, selectionMap)` implementation:**
1. Fetch `dataStore.getPreset(presetId)`. If not found: `ResolutionError.PresetNotFound`.
2. Call `resolveTree(preset.baseCompositionId, selectionMap, accessFilter, dataStore, 0)`.
3. If error: propagate.
4. Collect ad-hoc document content: for each `docId` in `preset.adHocDocuments`, call `resolveTree(docId, selectionMap, accessFilter, dataStore, 0)`.
5. Collect all non-empty parts (main tree + ad-hoc results) and join with `'\n\n'`.
6. Return `{ ok: true, value: fullContent }`.

**`resolution.resolveComposition(compositionId)` implementation:**
1. Create a default `SelectionMap`: `{ toggleStates: new Map(), sortOrders: new Map() }`.
2. Call `resolveTree(compositionId, defaultSelectionMap, accessFilter, dataStore, 0)`.

**`validation.wouldCreateCycle`** → delegates to `ENG-004`.
**`validation.validatePresetRules`** → delegates to `ENG-005`.
**`validation.findBrokenReferences`** → delegates to `ENG-005`.

**`src/index.ts` exports:** `createEngine` only. Internal module functions are NOT re-exported.

## Test Cases (Integration)

TC-013-01: `full_resolution_with_no_rules` — create composition, two leaf children, call `resolveComposition` → returns concatenated content with `\n\n`.
TC-013-02: `full_resolution_with_toggle_off_rule` — preset with one rule toggling off one slot → resolved content omits that slot.
TC-013-03: `full_resolution_with_sort_by_rule` — variant group slot with two members, sort_by rule prefers member B → resolved content is member B's content.
TC-013-04: `evaluate_rules_returns_selection_map` — confirms `evaluateRules` returns the correct map without doing resolution.
TC-013-05: `resolve_with_manual_override` — `evaluateRules` returns a SelectionMap, test manually flips one toggle, then calls `resolve` with modified map → overridden slot is included.
TC-013-06: `ad_hoc_documents_appended_after_tree` — preset with one ad-hoc document → ad-hoc content appears after the composition content in the output.
TC-013-07: `access_filter_applied_during_resolution` — variant group has two members, access filter blocks member A → member B (position 1) is used even though A is position 0 in sort order.

---

---
