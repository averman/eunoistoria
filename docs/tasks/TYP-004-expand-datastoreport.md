# TYP-004 — Expand DataStorePort

- **Sub-project:** `packages/types`
- **Branch:** `feat/TYP-004-datastore-port`
- **Depends on:** TYP-001, TYP-002, TYP-003
- **Files modified:** `packages/types/src/ports.ts`

## Objective

Replace the current minimal `DataStorePort` (3 read methods) with the full interface covering all reads, CRUD writes, and predicate-pushdown query. This is the complete contract that all adapters must implement.

## Behavior

Replace the entire `DataStorePort` interface in `packages/types/src/ports.ts` with:

```typescript
import {
  DocumentId, SlotId, VariantGroupId, TagId, PresetId,
  DataDocument, Preset
} from './entities.js';
import {
  DocumentRecord, VariantGroupRecord, VariantGroupMemberRecord, TagRecord,
  PresetRecord, PresetRuleRecord, PresetAdHocDocumentRecord, CompositionSlot,
  CreateDocumentInput, UpdateDocumentInput, DocumentFilters, CreateSlotInput,
  CreateVariantGroupInput, CreatePresetInput, UpdatePresetInput,
  AddPresetRuleInput, DocumentPredicate
} from './crud.js';
import { Result, DataStoreError } from './results.js';

export interface DataStorePort {

  // ─── Resolution-time reads (hydrated domain objects) ─────────────────────
  // Adapters assemble full nested trees from relational tables before returning.

  getDocument(id: DocumentId): Promise<Result<DataDocument, DataStoreError>>;
  getPreset(id: PresetId): Promise<Result<Preset, DataStoreError>>;
  getVariantGroupMembers(id: VariantGroupId): Promise<Result<DocumentId[], DataStoreError>>;
  // Returns member DocumentIds ordered by memberOrder ascending.

  // ─── CRUD-time reads (flat records) ──────────────────────────────────────

  getDocumentRecord(id: DocumentId): Promise<Result<DocumentRecord, DataStoreError>>;
  listDocuments(projectId: string, filters?: DocumentFilters): Promise<Result<DocumentRecord[], DataStoreError>>;
  listSlots(compositionId: DocumentId): Promise<Result<CompositionSlot[], DataStoreError>>;
  // Returns slots ordered by slotOrder ascending.

  getVariantGroup(id: VariantGroupId): Promise<Result<VariantGroupRecord, DataStoreError>>;
  listVariantGroups(projectId: string): Promise<Result<VariantGroupRecord[], DataStoreError>>;
  listVariantGroupMemberRecords(groupId: VariantGroupId): Promise<Result<VariantGroupMemberRecord[], DataStoreError>>;
  // Returns members ordered by memberOrder ascending.

  listTagsForDocument(documentId: DocumentId): Promise<Result<TagRecord[], DataStoreError>>;
  searchTags(projectId: string, key?: string, value?: string): Promise<Result<TagRecord[], DataStoreError>>;
  // key only: returns all tags with that key; key+value: exact match; neither: returns all tags in project.

  getPresetRecord(id: PresetId): Promise<Result<PresetRecord, DataStoreError>>;
  listPresets(projectId: string): Promise<Result<PresetRecord[], DataStoreError>>;
  listPresetRules(presetId: PresetId): Promise<Result<PresetRuleRecord[], DataStoreError>>;
  // Returns rules ordered by ruleOrder ascending.
  listPresetAdHocDocuments(presetId: PresetId): Promise<Result<PresetAdHocDocumentRecord[], DataStoreError>>;
  // Returns ad-hoc docs ordered by inclusionOrder ascending.

  // ─── Predicate-pushdown query ─────────────────────────────────────────────
  // Engine supplies pushdown predicates; adapter builds full SQL (with JOINs),
  // executes, and returns fully-hydrated DataDocument objects.
  // All predicates are AND-combined.

  queryDocuments(projectId: string, predicates: DocumentPredicate[]): Promise<Result<DataDocument[], DataStoreError>>;

  // ─── Document writes ──────────────────────────────────────────────────────

  createDocument(input: CreateDocumentInput): Promise<Result<DocumentRecord, DataStoreError>>;
  updateDocument(id: DocumentId, input: UpdateDocumentInput): Promise<Result<DocumentRecord, DataStoreError>>;
  deleteDocument(id: DocumentId): Promise<Result<void, DataStoreError>>;

  // ─── Slot writes ──────────────────────────────────────────────────────────

  createSlot(compositionId: DocumentId, input: CreateSlotInput): Promise<Result<CompositionSlot, DataStoreError>>;
  // Adapter appends the slot at the next available slotOrder position.
  deleteSlot(slotId: SlotId): Promise<Result<void, DataStoreError>>;
  reorderSlots(compositionId: DocumentId, orderedSlotIds: SlotId[]): Promise<Result<void, DataStoreError>>;
  // orderedSlotIds must be a permutation of the current slot IDs for compositionId.

  // ─── Variant group writes ─────────────────────────────────────────────────

  createVariantGroup(input: CreateVariantGroupInput): Promise<Result<VariantGroupRecord, DataStoreError>>;
  deleteVariantGroup(id: VariantGroupId): Promise<Result<void, DataStoreError>>;
  addVariantGroupMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<VariantGroupMemberRecord, DataStoreError>>;
  // Adapter appends the member at the next available memberOrder position.
  removeVariantGroupMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<void, DataStoreError>>;
  // Adapter re-sequences remaining members to fill the gap (memberOrder stays 0-indexed contiguous).
  reorderVariantGroupMembers(groupId: VariantGroupId, orderedDocumentIds: DocumentId[]): Promise<Result<void, DataStoreError>>;
  // orderedDocumentIds must be a permutation of the current member documentIds.

  // ─── Tag writes ───────────────────────────────────────────────────────────

  assignTag(documentId: DocumentId, key: string, value: string): Promise<Result<TagRecord, DataStoreError>>;
  // Adapter handles find-or-create of the tag record using the document's projectId.
  removeTag(documentId: DocumentId, tagId: TagId): Promise<Result<void, DataStoreError>>;

  // ─── Preset writes ────────────────────────────────────────────────────────

  createPreset(input: CreatePresetInput): Promise<Result<PresetRecord, DataStoreError>>;
  updatePreset(id: PresetId, input: UpdatePresetInput): Promise<Result<PresetRecord, DataStoreError>>;
  deletePreset(id: PresetId): Promise<Result<void, DataStoreError>>;
  addPresetRule(presetId: PresetId, input: AddPresetRuleInput): Promise<Result<PresetRuleRecord, DataStoreError>>;
  // Adapter appends at the next available ruleOrder position.
  removePresetRule(presetId: PresetId, ruleId: string): Promise<Result<void, DataStoreError>>;
  // Adapter re-sequences remaining rules to fill the gap.
  reorderPresetRules(presetId: PresetId, orderedRuleIds: string[]): Promise<Result<void, DataStoreError>>;
  addPresetAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<PresetAdHocDocumentRecord, DataStoreError>>;
  removePresetAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<void, DataStoreError>>;
  reorderPresetAdHocDocuments(presetId: PresetId, orderedDocumentIds: DocumentId[]): Promise<Result<void, DataStoreError>>;
}
```

`AccessFilterPort` and `OutputPort` remain unchanged.

## Test Cases

`tsc --noEmit` passes.

---
