# ENG-012 — CRUD: Presets

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-012-crud-presets`
- **Depends on:** ENG-008
- **Files created:** `packages/engine/src/crud/presets.ts`, `packages/engine/tests/crud/presets.test.ts`

## Objective

Business logic for preset operations: create, update, delete, add/remove/reorder rules, add/remove/reorder ad-hoc documents.

## Behavior

```typescript
export async function createPreset(input: CreatePresetInput, dataStore: DataStorePort): Promise<Result<PresetRecord, PresetError>>
export async function updatePreset(id: PresetId, changes: UpdatePresetInput, dataStore: DataStorePort): Promise<Result<PresetRecord, PresetError>>
export async function deletePreset(id: PresetId, dataStore: DataStorePort): Promise<Result<void, PresetError>>
export async function addRule(presetId: PresetId, input: AddPresetRuleInput, dataStore: DataStorePort): Promise<Result<PresetRuleRecord, PresetError>>
export async function removeRule(presetId: PresetId, ruleId: string, dataStore: DataStorePort): Promise<Result<void, PresetError>>
export async function reorderRules(presetId: PresetId, orderedRuleIds: string[], dataStore: DataStorePort): Promise<Result<void, PresetError>>
export async function addAdHocDocument(presetId: PresetId, documentId: DocumentId, dataStore: DataStorePort): Promise<Result<PresetAdHocDocumentRecord, PresetError>>
export async function removeAdHocDocument(presetId: PresetId, documentId: DocumentId, dataStore: DataStorePort): Promise<Result<void, PresetError>>
export async function reorderAdHocDocuments(presetId: PresetId, orderedDocumentIds: DocumentId[], dataStore: DataStorePort): Promise<Result<void, PresetError>>
```

**`createPreset` flow:**
1. Verify `input.compositionId` exists as a composition: call `dataStore.getDocumentRecord(input.compositionId)`. If not found or `isComposition === false`: `PresetError.CompositionNotFound`.
2. Call `dataStore.createPreset(input)`.

**`updatePreset` flow:**
1. Verify preset exists. If not: `PresetError.NotFound`.
2. If `changes.compositionId` is provided: verify it exists and is a composition. If not: `PresetError.CompositionNotFound`.
3. Call `dataStore.updatePreset(id, changes)`.

**`addRule` flow:**
1. Verify preset exists. If not: `PresetError.NotFound`.
2. Call `dataStore.addPresetRule(presetId, input)` (always appends at end).

**`reorderRules` flow:**
1. Verify preset exists.
2. Fetch current rules. Verify `orderedRuleIds` is a permutation. If not: `PresetError.InvalidRuleOrdering`.
3. Call `dataStore.reorderPresetRules(presetId, orderedRuleIds)`.

**`removeRule` flow:**
1. Verify preset exists.
2. Call `dataStore.removePresetRule(presetId, ruleId)`. If `DataStoreError.NotFound`: `PresetError.RuleNotFound`.

**`addAdHocDocument`, `removeAdHocDocument`, `reorderAdHocDocuments`** follow the same pattern as rules.

## Test Cases

TC-012-01: `create_preset_with_valid_composition_succeeds`.
TC-012-02: `create_preset_with_nonexistent_composition_returns_error` — `PresetError.CompositionNotFound`.
TC-012-03: `create_preset_with_leaf_as_composition_returns_error` — `PresetError.CompositionNotFound` (leaf is not a valid composition reference).
TC-012-04: `add_rule_appends_at_end` — two rules added sequentially have `ruleOrder` 0 then 1.
TC-012-05: `reorder_rules_with_invalid_ids_returns_error` — `PresetError.InvalidRuleOrdering`.
TC-012-06: `remove_nonexistent_rule_returns_error` — `PresetError.RuleNotFound`.
TC-012-07: `delete_preset_removes_all_rules_and_adhoc_docs` — after delete, preset is not found.

---
