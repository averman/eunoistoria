# ENG-005 — Validation Module

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-005-validation`
- **Depends on:** ENG-001
- **Files created:** `packages/engine/src/validation.ts`, `packages/engine/tests/validation.test.ts`

## Objective

Pure and near-pure validation functions used by CRUD modules before calling the data store. Also provides the `findBrokenReferences` scan operation.

## Behavior

**Exported functions:**

```typescript
// Validates a CreateDocumentInput before calling the data store.
export function validateDocumentCreate(input: CreateDocumentInput): Result<void, DocumentError>

// Validates an UpdateDocumentInput applied to an existing document.
// slotCount is the current number of slots on the document (0 for leaves).
export function validateDocumentUpdate(
  record: DocumentRecord,
  changes: UpdateDocumentInput
): Result<void, DocumentError>

// Validates conversion to composition.
// slotCount: current number of slots on this document.
export function validateConvertToComposition(record: DocumentRecord): Result<void, DocumentError>

// Validates conversion to leaf.
export function validateConvertToLeaf(
  record: DocumentRecord,
  slotCount: number
): Result<void, DocumentError>

// Validates a CreateSlotInput structure (before any async checks).
export function validateSlotCreateInput(input: CreateSlotInput): Result<void, SlotError>

// Validates a variant group member removal.
export function validateMemberRemoval(
  members: VariantGroupMemberRecord[],
  documentId: DocumentId
): Result<void, VariantGroupError>

// Scans all compositions in the project for broken slot references.
export async function findBrokenReferences(
  projectId: string,
  dataStore: DataStorePort
): Promise<Result<BrokenReference[], ValidationError>>

// Validates a preset's rules against its composition structure.
export async function validatePresetRules(
  presetId: PresetId,
  dataStore: DataStorePort
): Promise<Result<RuleValidationReport, ValidationError>>
```

**`validateDocumentCreate` rules:**
- If `input.isComposition === false` and `input.content` is `undefined` → `DocumentError.LeafRequiresContent`.
- If `input.isComposition === true` and `input.content !== undefined` → `DocumentError.CompositionCannotHaveContent`.
- Otherwise: `{ ok: true, value: undefined }`.

**`validateDocumentUpdate` rules:**
- If `changes.content !== undefined && changes.content !== null` and `record.isComposition === true` → `DocumentError.CompositionCannotHaveContent`.
- Otherwise: `{ ok: true, value: undefined }`.

**`validateConvertToComposition` rules:**
- If `record.isComposition === true`: return `{ ok: true, value: undefined }` (idempotent, already a composition).
- Otherwise: `{ ok: true, value: undefined }` (conversion is always allowed from leaf to composition).

**`validateConvertToLeaf` rules:**
- If `record.isComposition === false`: return `{ ok: true, value: undefined }` (idempotent, already a leaf).
- If `record.isComposition === true` and `slotCount > 0`: return `{ ok: false, error: DocumentError.CannotConvertCompositionWithSlots }`.
- Otherwise: `{ ok: true, value: undefined }`.

**`validateSlotCreateInput` rules:**
- If `input.referenceType === 'document'` and `input.referenceDocumentId === undefined` → `SlotError.TargetNotFound`.
- If `input.referenceType === 'variant_group'` and `input.referenceVariantGroupId === undefined` → `SlotError.TargetNotFound`.
- Otherwise: `{ ok: true, value: undefined }`.

**`validateMemberRemoval` rules:**
- Find the member with `documentId` in `members`. If not found: `VariantGroupError.MemberNotFound`.
- If the found member's `memberOrder === 0`: `VariantGroupError.CannotRemoveUniversalDefault`.
- Otherwise: `{ ok: true, value: undefined }`.

**`findBrokenReferences` algorithm:**
1. `dataStore.listDocuments(projectId, { isComposition: true })` to get all compositions.
2. For each composition, call `dataStore.listSlots(composition.id)`.
3. For each slot:
   - If `referenceType === 'document'`:
     - Call `dataStore.getDocumentRecord(slot.referenceDocumentId!)`.
     - If result is `DataStoreError.NotFound`: add `BrokenReference { compositionId, slotId, referenceType: 'document', referencedId: slot.referenceDocumentId! }`.
   - If `referenceType === 'variant_group'`:
     - Call `dataStore.getVariantGroup(slot.referenceVariantGroupId!)`.
     - If `DataStoreError.NotFound`: add `BrokenReference`.
     - If found: call `dataStore.listVariantGroupMemberRecords(slot.referenceVariantGroupId!)`. If members is empty: also add `BrokenReference` (empty variant group has no default).
4. Return all found broken references.

**`validatePresetRules` algorithm:**
1. Fetch preset via `dataStore.getPresetRecord(presetId)`. If not found: `ValidationError.PresetNotFound`.
2. Fetch rules via `dataStore.listPresetRules(presetId)`.
3. Fetch the composition's slots via `dataStore.listSlots(preset.compositionId)` (top-level only; deep validation is out of scope).
4. For each rule, check if the action could ever match any slot:
   - `sort_by` or `select`: if no slots have `referenceType === 'variant_group'` → issue `{ ruleIndex, issueType: 'no_matching_slots', description: '...' }`.
   - `toggle_on` or `toggle_off`: no issue (toggle rules can always apply, even if the result is a no-op).
5. Return `RuleValidationReport { presetId, issues, isValid: issues.length === 0 }`.

## Test Cases

TC-005-01: `validateDocumentCreate` with `isComposition: false, content: undefined` → `DocumentError.LeafRequiresContent`.
TC-005-02: `validateDocumentCreate` with `isComposition: true, content: 'hello'` → `DocumentError.CompositionCannotHaveContent`.
TC-005-03: `validateDocumentCreate` with `isComposition: false, content: ''` → `ok: true` (empty string is valid content).
TC-005-04: `validateConvertToLeaf` with a composition having `slotCount: 2` → `DocumentError.CannotConvertCompositionWithSlots`.
TC-005-05: `validateConvertToLeaf` on an already-leaf document → `ok: true` (idempotent).
TC-005-06: `validateMemberRemoval` targeting the member at `memberOrder: 0` → `VariantGroupError.CannotRemoveUniversalDefault`.
TC-005-07: `validateMemberRemoval` targeting a non-position-0 member → `ok: true`.
TC-005-08: `validateMemberRemoval` with a documentId not in the group → `VariantGroupError.MemberNotFound`.
TC-005-09: `findBrokenReferences` with one slot pointing to a deleted document → returns one `BrokenReference`.
TC-005-10: `findBrokenReferences` with a variant_group slot pointing to a group with zero members → returns one `BrokenReference`.
TC-005-11: `validatePresetRules` with a `sort_by` rule and no variant_group slots → report has one issue, `isValid: false`.
TC-005-12: `validatePresetRules` with only toggle rules → `isValid: true`, no issues.

---
