# TYP-005 — Add Engine Interface

- **Sub-project:** `packages/types`
- **Branch:** `feat/TYP-005-engine-interface`
- **Depends on:** TYP-001, TYP-002, TYP-003, TYP-004
- **Files created:** `packages/types/src/engine-interface.ts`
- **Files modified:** `packages/types/src/index.ts`

## Objective

Define the `Engine` interface — the complete public API that `createEngine()` returns. This is the single contract that `power-app` and `reader-app` program against.

## Behavior

Create `packages/types/src/engine-interface.ts`:

```typescript
import {
  DocumentId, SlotId, VariantGroupId, TagId, PresetId, CompositionSlot
} from './entities.js';
import {
  DocumentRecord, VariantGroupRecord, VariantGroupMemberRecord, TagRecord,
  PresetRecord, PresetRuleRecord, PresetAdHocDocumentRecord,
  CreateDocumentInput, UpdateDocumentInput, DocumentFilters, CreateSlotInput,
  CreateVariantGroupInput, CreatePresetInput, UpdatePresetInput,
  AddPresetRuleInput, RuleValidationReport, BrokenReference
} from './crud.js';
import {
  DocumentError, SlotError, VariantGroupError, TagError,
  PresetError, ResolutionError, ValidationError
} from './results.js';
import { SelectionMap, VariableMap } from './resolution.js';
import { Result } from './results.js';

export interface Engine {

  documents: {
    create(input: CreateDocumentInput): Promise<Result<DocumentRecord, DocumentError>>;
    get(id: DocumentId): Promise<Result<DocumentRecord, DocumentError>>;
    update(id: DocumentId, changes: UpdateDocumentInput): Promise<Result<DocumentRecord, DocumentError>>;
    delete(id: DocumentId): Promise<Result<void, DocumentError>>;
    list(projectId: string, filters?: DocumentFilters): Promise<Result<DocumentRecord[], DocumentError>>;
    convertToComposition(id: DocumentId): Promise<Result<DocumentRecord, DocumentError>>;
    convertToLeaf(id: DocumentId, content: string): Promise<Result<DocumentRecord, DocumentError>>;
  };

  slots: {
    add(compositionId: DocumentId, input: CreateSlotInput): Promise<Result<CompositionSlot, SlotError>>;
    remove(slotId: SlotId): Promise<Result<void, SlotError>>;
    reorder(compositionId: DocumentId, orderedSlotIds: SlotId[]): Promise<Result<void, SlotError>>;
    list(compositionId: DocumentId): Promise<Result<CompositionSlot[], SlotError>>;
  };

  variantGroups: {
    create(input: CreateVariantGroupInput): Promise<Result<VariantGroupRecord, VariantGroupError>>;
    delete(id: VariantGroupId): Promise<Result<void, VariantGroupError>>;
    addMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<VariantGroupMemberRecord, VariantGroupError>>;
    removeMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<void, VariantGroupError>>;
    reorderMembers(groupId: VariantGroupId, orderedDocumentIds: DocumentId[]): Promise<Result<void, VariantGroupError>>;
    list(projectId: string): Promise<Result<VariantGroupRecord[], VariantGroupError>>;
    getMembers(groupId: VariantGroupId): Promise<Result<VariantGroupMemberRecord[], VariantGroupError>>;
  };

  tags: {
    assign(documentId: DocumentId, key: string, value: string): Promise<Result<TagRecord, TagError>>;
    remove(documentId: DocumentId, tagId: TagId): Promise<Result<void, TagError>>;
    getForDocument(documentId: DocumentId): Promise<Result<TagRecord[], TagError>>;
    search(projectId: string, key?: string, value?: string): Promise<Result<TagRecord[], TagError>>;
  };

  presets: {
    create(input: CreatePresetInput): Promise<Result<PresetRecord, PresetError>>;
    update(id: PresetId, changes: UpdatePresetInput): Promise<Result<PresetRecord, PresetError>>;
    delete(id: PresetId): Promise<Result<void, PresetError>>;
    addRule(presetId: PresetId, input: AddPresetRuleInput): Promise<Result<PresetRuleRecord, PresetError>>;
    removeRule(presetId: PresetId, ruleId: string): Promise<Result<void, PresetError>>;
    reorderRules(presetId: PresetId, orderedRuleIds: string[]): Promise<Result<void, PresetError>>;
    addAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<PresetAdHocDocumentRecord, PresetError>>;
    removeAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<void, PresetError>>;
    reorderAdHocDocuments(presetId: PresetId, orderedDocumentIds: DocumentId[]): Promise<Result<void, PresetError>>;
  };

  resolution: {
    evaluateRules(presetId: PresetId, variables: VariableMap): Promise<Result<SelectionMap, ResolutionError>>;
    resolve(presetId: PresetId, variables: VariableMap, selectionMap: SelectionMap): Promise<Result<string, ResolutionError>>;
    resolveComposition(compositionId: DocumentId): Promise<Result<string, ResolutionError>>;
    estimateTokens(content: string): number;
  };

  validation: {
    wouldCreateCycle(compositionId: DocumentId, targetDocumentId: DocumentId): Promise<Result<boolean, ValidationError>>;
    validatePresetRules(presetId: PresetId): Promise<Result<RuleValidationReport, ValidationError>>;
    findBrokenReferences(projectId: string): Promise<Result<BrokenReference[], ValidationError>>;
  };
}
```

Export `Engine` from `packages/types/src/index.ts`.

## Test Cases

`tsc --noEmit` passes.

---

---
