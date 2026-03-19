# Detailed Task Breakdown — Phase 2 (Engine) + Phase 3 (Storage)

**Extendable Markdown Editor**
**Authored:** 2026-03-19
**Scope:** `packages/types` (expansion), `packages/engine` (full), `packages/sql-template` (full), `packages/adapter-sqlite` (full), `packages/adapter-postgres` (full)

This document is the full story-breakdown for Phases 2 and 3. Every design decision is resolved here. Implementing agents write tests first (TDD) and then implement to pass them. No decisions remain open.

---

## Resolved Design Decisions

The following decisions were made during breakdown and must not be re-opened by implementing agents. Escalate only if a contradiction is found.

| # | Decision |
|---|---|
| D-BP-01 | `CompositionSlot` is updated: `selectedIndex` removed, `compositionId` + `slotOrder` + `referenceType` added. |
| D-BP-02 | `Preset` is updated to include `adHocDocuments: DocumentId[]`. |
| D-BP-03 | `DataStorePort` is expanded with full CRUD methods and a `queryDocuments` method for predicate pushdown. |
| D-BP-04 | The engine exposes two document representations: `DocumentRecord` (flat CRUD record) and `DataDocument` (hydrated resolution tree). Adapters are responsible for hydration. |
| D-BP-05 | Project entities are not managed by the engine. `projectId` is a plain `string` parameter used for scoping queries. No `Project` type and no project CRUD in the engine. |
| D-BP-06 | All input/output types shared across package boundaries (CRUD inputs, error enums, `Engine` interface) live in `packages/types`. |
| D-BP-07 | The rule evaluator is a pure function. It receives pre-fetched `SlotRuleContext[]`. The resolution orchestrator in `ENG-013` is responsible for fetching that data before calling the evaluator. |
| D-BP-08 | `resolveTree()` returns `Result<string, ResolutionError>`. Broken references in the tree emit empty string (graceful skip, `ok: true`). `MaxDepthExceeded` propagates as `ok: false`. |
| D-BP-09 | `MAX_RECURSION_DEPTH = 20` is a named constant in `src/resolution.ts`. |
| D-BP-10 | Type coercion for comparisons is number-first: if both sides parse as `Number()`, compare numerically; otherwise compare as strings. Applied in the rule evaluator AND in `queryDocuments` mock. |
| D-BP-11 | `select` action is equivalent to `sort_by` with one `SortKey`. It sets the matched member(s) first in sort order for that slot. Non-matching members follow in original relative order. |
| D-BP-12 | `addRule` always appends at the end of the rule list. Use `reorderRules` to change positions. |
| D-BP-13 | `convertToComposition` is idempotent on an already-composition document. `convertToLeaf` is idempotent on an already-leaf document. |
| D-BP-14 | `removeMember` from a variant group rejects if the member being removed is at `memberOrder = 0`. To change the default, reorder first. |
| D-BP-15 | SQL parameter placeholder: `?` for SQLite, `$N` (1-indexed) for Postgres. The base template uses an abstract `formatParam(index: number): string` method. |
| D-BP-16 | `assignTag` at the DataStorePort level handles find-or-create of the tag record internally (adapter concern). The engine validates duplicates before calling the port. |
| D-BP-17 | Resolution joins content parts with `"\n\n"` (two newlines). |

---

## Dependency Map

```
TYP-001 ──► TYP-002 ──► TYP-004 ──► ENG-001 ──► ENG-003
         ├─► TYP-003 ──► TYP-004       │        ──► ENG-004
         └─► TYP-005                   │        ──► ENG-005
                                        │        ──► ENG-007
                                        │
                                        ▼
                          ENG-003+ENG-004+ENG-005+ENG-007
                                        │
                                        ▼
                          ENG-008 ──► ENG-009
                                  ──► ENG-010
                                  ──► ENG-011
                                  ──► ENG-012
                                        │
                                        ▼
                                     ENG-013 (+ ENG-002, ENG-006)
                                        │
                              ┌─────────┼─────────┐
                              ▼         ▼         ▼
                           SQL-001   SQL-002   SQL-003
                                                  │
                                        ┌─────────┴─────────┐
                                        ▼                   ▼
                                     ADT-001             ADT-003
                                     ADT-002             ADT-004
```

---

## Task Index

| ID | Title | Package | Depends On |
|---|---|---|---|
| TYP-001 | Update Entity Types | types | — |
| TYP-002 | Add CRUD & Auxiliary Types | types | TYP-001 |
| TYP-003 | Add Engine Error Enums | types | — |
| TYP-004 | Expand DataStorePort | types | TYP-001, TYP-002, TYP-003 |
| TYP-005 | Add Engine Interface | types | TYP-001, TYP-002, TYP-003, TYP-004 |
| ENG-001 | Mock DataStore (test helper) | engine | TYP-004 |
| ENG-002 | Token Estimation | engine | TYP-005 |
| ENG-003 | Rule Evaluator | engine | ENG-001 |
| ENG-004 | Cycle Detection | engine | ENG-001 |
| ENG-005 | Validation Module | engine | ENG-001 |
| ENG-006 | Resolution Walker | engine | ENG-003, ENG-001 |
| ENG-007 | Query Builder | engine | TYP-002, TYP-004 |
| ENG-008 | CRUD: Documents | engine | ENG-004, ENG-005, ENG-007, ENG-001 |
| ENG-009 | CRUD: Slots | engine | ENG-008, ENG-004 |
| ENG-010 | CRUD: Variant Groups | engine | ENG-008, ENG-005 |
| ENG-011 | CRUD: Tags | engine | ENG-008 |
| ENG-012 | CRUD: Presets | engine | ENG-008 |
| ENG-013 | Engine Public API (`createEngine`) | engine | ENG-002, ENG-006, ENG-008–ENG-012 |
| SQL-001 | SQL Template: Schema DDL | sql-template | TYP-004 |
| SQL-002 | SQL Template: Connection Interface | sql-template | — |
| SQL-003 | SQL Template: Base DataStore Implementation | sql-template | SQL-001, SQL-002, TYP-004 |
| ADT-001 | Adapter: SQLite Implementation | adapter-sqlite | SQL-003 |
| ADT-002 | Adapter: SQLite Integration Tests | adapter-sqlite | ADT-001, ENG-013 |
| ADT-003 | Adapter: Postgres Implementation | adapter-postgres | SQL-003 |
| ADT-004 | Adapter: Postgres Integration Tests | adapter-postgres | ADT-003, ENG-013 |

---

---

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

# TYP-002 — Add CRUD & Auxiliary Types

- **Sub-project:** `packages/types`
- **Branch:** `feat/TYP-002-crud-types`
- **Depends on:** TYP-001
- **Files created:** `packages/types/src/crud.ts`
- **Files modified:** `packages/types/src/index.ts`

## Objective

Add all CRUD input/output types, flat record types (the DB-level representation returned for CRUD operations), validation output types, predicate types for pushdown, and the `SlotRuleContext` type used by the pure rule evaluator.

## Behavior

Create `packages/types/src/crud.ts` with **exactly** the following exports. No omissions, no additions.

```typescript
import {
  DocumentId, SlotId, VariantGroupId, TagId, PresetId,
  Tag, CompositionSlot
} from './entities.js';
import { Premise, Action } from './rules.js';

// ─── Flat DB-level record types ──────────────────────────────────────────────

export interface DocumentRecord {
  id: DocumentId;
  projectId: string;
  title: string;
  alias: string | null;
  isComposition: boolean;
  content: string | null;       // null when isComposition is true
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantGroupRecord {
  id: VariantGroupId;
  projectId: string;
  name: string;
  createdAt: Date;
}

export interface VariantGroupMemberRecord {
  variantGroupId: VariantGroupId;
  documentId: DocumentId;
  memberOrder: number;          // 0-indexed; position 0 is the universal default
  createdAt: Date;
}

export interface TagRecord {
  id: TagId;
  projectId: string;
  key: string;
  value: string;
  color: string;                // hex string, e.g. '#6366f1'
  createdAt: Date;
}

export interface PresetRecord {
  id: PresetId;
  projectId: string;
  name: string;
  compositionId: DocumentId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresetRuleRecord {
  id: string;
  presetId: PresetId;
  ruleOrder: number;            // 0-indexed; lower = evaluated first
  premise: Premise;
  action: Action;
  description: string | null;
}

export interface PresetAdHocDocumentRecord {
  presetId: PresetId;
  documentId: DocumentId;
  inclusionOrder: number;       // 0-indexed; order appended after the composition tree
}

// ─── CRUD input types ────────────────────────────────────────────────────────

export interface CreateDocumentInput {
  projectId: string;
  title: string;
  alias?: string;
  isComposition: boolean;
  content?: string;             // required when isComposition is false; omit when true
}

export interface UpdateDocumentInput {
  title?: string;
  alias?: string | null;        // null explicitly clears the alias
  isComposition?: boolean;      // used only for convert operations (engine validates)
  content?: string | null;      // null clears content (used when converting to composition)
}

export interface DocumentFilters {
  isComposition?: boolean;
  titleContains?: string;       // case-insensitive substring match
  tagKey?: string;
  tagValue?: string;            // only used when tagKey is also provided
}

export interface CreateSlotInput {
  referenceType: 'document' | 'variant_group';
  referenceDocumentId?: DocumentId;       // required when referenceType === 'document'
  referenceVariantGroupId?: VariantGroupId; // required when referenceType === 'variant_group'
}
// Note: slotOrder is always appended at the end by the engine. Clients reorder via reorderSlots().

export interface CreateVariantGroupInput {
  projectId: string;
  name: string;
}

export interface CreatePresetInput {
  projectId: string;
  name: string;
  compositionId: DocumentId;
}

export interface UpdatePresetInput {
  name?: string;
  compositionId?: DocumentId;
}

export interface AddPresetRuleInput {
  premise: Premise;
  action: Action;
  description?: string;
}
// Note: rules are always appended at the end. Clients reorder via reorderRules().

// ─── Validation output types ─────────────────────────────────────────────────

export interface RuleValidationReport {
  presetId: string;
  issues: RuleValidationIssue[];
  isValid: boolean;             // true only when issues is empty
}

export interface RuleValidationIssue {
  ruleIndex: number;            // 0-indexed position in the rule list
  issueType: 'no_matching_slots' | 'unknown_variable_reference';
  description: string;
}

export interface BrokenReference {
  compositionId: DocumentId;
  slotId: SlotId;
  referenceType: 'document' | 'variant_group';
  referencedId: string;         // the ID of the missing document or variant group
}

// ─── Predicate pushdown types ────────────────────────────────────────────────

export type DocumentPredicate =
  | { type: 'tag_eq';      key: string; value: string }
  | { type: 'tag_neq';     key: string; value: string }
  | { type: 'tag_lt';      key: string; value: string }
  | { type: 'tag_lte';     key: string; value: string }
  | { type: 'tag_gt';      key: string; value: string }
  | { type: 'tag_gte';     key: string; value: string }
  | { type: 'tag_in';      key: string; values: string[] }
  | { type: 'tag_not_in';  key: string; values: string[] }
  | { type: 'tag_has_key'; key: string }
  | { type: 'is_composition'; value: boolean };

export interface QueryPlan {
  pushdownPredicates: DocumentPredicate[];
  localPredicates: Premise[];   // evaluated in-memory after the store returns results
}

// ─── Rule evaluator context (pre-fetched data passed to the pure evaluator) ──

export interface SlotRuleContext {
  slotId: SlotId;
  referenceType: 'document' | 'variant_group';
  // For document-reference slots: the referenced document's tags.
  // For variant_group slots: the default member's (memberOrder=0) tags.
  documentTags: Tag[];
  // Populated only when referenceType === 'variant_group'.
  // All members in ascending memberOrder, each with their tags.
  variantGroupMembers: VariantMemberContext[];
}

export interface VariantMemberContext {
  documentId: DocumentId;
  memberOrder: number;
  tags: Tag[];
}
```

Add all exports from `crud.ts` to `packages/types/src/index.ts`.

## Test Cases

`tsc --noEmit` passes with zero errors. All exports are accessible from `@project/types`.

## Scope Boundary

- Does not modify `entities.ts`, `ports.ts`, `results.ts`, or `rules.ts`.
- Does not define the `Engine` interface (that is TYP-005).

---

# TYP-003 — Add Engine Error Enums

- **Sub-project:** `packages/types`
- **Branch:** `feat/TYP-003-error-enums`
- **Depends on:** none
- **Files modified:** `packages/types/src/results.ts`

## Objective

Add the per-entity error enums that the engine's CRUD methods return. These are separate from `DataStoreError` (which is a low-level storage error) and `ResolutionError` (which already exists).

## Behavior

Append the following enums to `packages/types/src/results.ts`. Do not modify existing content.

```typescript
export enum DocumentError {
  NotFound = 'NotFound',
  CompositionCannotHaveContent = 'CompositionCannotHaveContent',
  LeafRequiresContent = 'LeafRequiresContent',
  CannotConvertCompositionWithSlots = 'CannotConvertCompositionWithSlots',
  StorageFailure = 'StorageFailure',
}

export enum SlotError {
  NotFound = 'NotFound',
  CompositionNotFound = 'CompositionNotFound',
  TargetNotFound = 'TargetNotFound',
  WouldCreateCycle = 'WouldCreateCycle',
  InvalidOrdering = 'InvalidOrdering',
  StorageFailure = 'StorageFailure',
}

export enum VariantGroupError {
  NotFound = 'NotFound',
  MemberNotFound = 'MemberNotFound',
  CannotRemoveUniversalDefault = 'CannotRemoveUniversalDefault',
  DocumentAlreadyMember = 'DocumentAlreadyMember',
  StorageFailure = 'StorageFailure',
}

export enum TagError {
  NotFound = 'NotFound',
  DocumentNotFound = 'DocumentNotFound',
  DuplicateTagOnDocument = 'DuplicateTagOnDocument',
  StorageFailure = 'StorageFailure',
}

export enum PresetError {
  NotFound = 'NotFound',
  CompositionNotFound = 'CompositionNotFound',
  RuleNotFound = 'RuleNotFound',
  InvalidRuleOrdering = 'InvalidRuleOrdering',
  StorageFailure = 'StorageFailure',
}

export enum ValidationError {
  PresetNotFound = 'PresetNotFound',
  CompositionNotFound = 'CompositionNotFound',
  StorageFailure = 'StorageFailure',
}
```

Export all new enums from `packages/types/src/index.ts`.

## Test Cases

`tsc --noEmit` passes. All enums accessible from `@project/types`.

---

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

# ENG-002 — Token Estimation

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-002-token-estimation`
- **Depends on:** TYP-005
- **Files created:** `packages/engine/src/token-estimation.ts`, `packages/engine/tests/token-estimation.test.ts`

## Objective

A single pure function that estimates the token count of a string. Conservative heuristic only.

## Behavior

```typescript
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}
```

No edge-case handling. Empty string returns `0`. The function never throws.

## Test Cases

TC-002-01: `estimateTokens("")` returns `0`.
TC-002-02: `estimateTokens("abcd")` returns `1`.
TC-002-03: `estimateTokens("hello")` returns `2` (5 chars → ceil(5/4) = 2).
TC-002-04: `estimateTokens("a".repeat(400))` returns `100`.

---

# ENG-003 — Rule Evaluator

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-003-rule-evaluator`
- **Depends on:** ENG-001
- **Files created:** `packages/engine/src/rule-evaluator.ts`, `packages/engine/tests/rule-evaluator.test.ts`

## Objective

A pure function that takes an ordered list of rules, runtime variables, and pre-fetched slot context data, and produces a `SelectionMap` representing the final toggle states and sort orders for all slots.

## Behavior

**Exported function signature:**
```typescript
export function evaluateRules(
  rules: Rule[],
  variables: VariableMap,
  slotContexts: SlotRuleContext[]
): SelectionMap
```

**SelectionMap initialization:**
- `toggleStates`: a new `Map`. All slot IDs start as `true` (toggled on). Slots not in the map are implicitly `true`.
- `sortOrders`: a new `Map`. For each `variant_group` slot in `slotContexts`, initialize with members sorted by `memberOrder` ascending (i.e., `[members[0].documentId, members[1].documentId, ...]`).

**Rule processing order:** rules are processed in array order, index 0 first. Later rules that affect the same slot override earlier rules on that slot.

**Premise evaluation — `isPremiseVariableOnly(premise)`:**
A premise is variable-only if no `tag` operand appears anywhere in its tree. This includes nested `and`, `or`, `not` premises. The check is recursive.
- Variable-only premises are evaluated once globally (true/false for the whole rule pass).
- Premises containing any `tag` operand are evaluated per-slot or per-member.

**Operand resolution:**
- `{ type: 'tag', tag: key }` → look up `tag.key === key` in the provided `Tag[]`, return `tag.value` (string) if found; return `undefined` if no tag with that key exists.
- `{ type: 'var', var: name }` → return `variables.get(name)`, which may be `undefined`.
- `{ type: 'literal', value }` → return `value` directly.
- `{ type: 'literal_list', values }` → return `values` array directly (used as the right side of `in`/`not_in`).

**Type coercion for comparisons (D-BP-10):**
```
function coerce(v: unknown): number | string | boolean | unknown {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? v : n;
  }
  return v;
}
```
For binary comparisons (eq, neq, lt, lte, gt, gte): coerce both sides. If BOTH results are numbers, compare numerically. Otherwise, compare as strings using `String(left)` vs `String(right)`.

**Missing operand behavior:**
- If a `tag` operand resolves to `undefined` (tag key not present on document): the entire comparison returns `false`.
- If a `var` operand resolves to `undefined` (variable not in map): the entire comparison returns `false`.
- `{ op: 'true' }` and `{ op: 'always' }` always return `true` regardless of operands.

**Premise evaluation logic:**
- `eq`: `coerce(left) === coerce(right)` (with numeric-if-both rule).
- `neq`: `coerce(left) !== coerce(right)`.
- `lt/lte/gt/gte`: numeric if both parse as numbers, otherwise string comparison.
- `in`: coerce left, then check if any element of the right list, after coercion, equals the coerced left.
- `not_in`: opposite of `in`.
- `and`: all children must be `true`.
- `or`: at least one child must be `true`.
- `not`: negate the single child.

**Action application:**

For each rule, after evaluating the premise:

**`toggle_on` / `toggle_off`:**
- If premise is variable-only and evaluates to `true`: apply the toggle to ALL slots.
- If premise is variable-only and evaluates to `false`: apply to no slots.
- If premise references tags: for each slot in `slotContexts`:
  - Use `slot.documentTags` as the tag array for premise evaluation.
  - If premise evaluates to `true`: set `selectionMap.toggleStates.set(slot.slotId, action === 'toggle_on')`.

**`sort_by`:**
- Applies only to `variant_group` slots.
- For each variant_group slot in `slotContexts`:
  - If the rule's premise is variable-only and evaluates to `false`: skip this slot.
  - If the rule's premise is variable-only and evaluates to `true`: apply sort to this slot.
  - If the rule's premise references tags: evaluate premise against each **member's** tags individually. Sorting is based on which sort key each member matches. (The premise determines whether this rule fires at all for this slot. For sort_by, if the premise references a tag, evaluate it against EACH MEMBER's tags to determine that member's sort priority. See below.)

  **Sort algorithm for a slot's members:**
  Given `sortKeys: SortKey[]`, for each member:
  1. Find the index of the **first** matching sort key.
     - A sort key `{ tag, value }` matches a member if the member has a tag where `key === tag` AND `coerce(tagValue) === coerce(value)`.
     - A sort key `{ tag, matchVar }` matches a member if the member has a tag where `key === tag` AND `coerce(tagValue) === coerce(variables.get(matchVar))`.
  2. If no sort key matches: assign priority = `sortKeys.length` (lowest priority).
  3. Sort members by priority ascending (lower index = higher priority). Use a **stable sort** to preserve relative original order among members with equal priority.
  4. Store the resulting `DocumentId[]` in `selectionMap.sortOrders.set(slot.slotId, [...])`.

**`select`:**
- Applies only to `variant_group` slots.
- Treat as `sort_by` with a single sort key: `[{ tag: action.match.tag, value: action.match.value }]`.
- If premise is variable-only and evaluates to `true`: apply to all variant_group slots.
- If premise references tags: evaluate premise (does the slot's `documentTags` match?) — if true, apply the single-key sort to this slot's members.

## Test Cases

TC-003-01: `evaluateRules([], variables, slotContexts)` — given zero rules, when evaluated, then SelectionMap has all slots toggled on and sort orders unchanged from original member order.

TC-003-02: toggle_off with variable-only premise that is true — given one rule `{ premise: { op:'true' }, action: { type:'toggle_off' } }` and two slots, when evaluated, then both slots are toggled off.

TC-003-03: toggle_off with variable-only premise that is false — given rule `{ premise: { op:'eq', left:{type:'var',var:'mode'}, right:{type:'literal',value:'reader'} }, action:{type:'toggle_off'} }` and `variables = Map([['mode','author']])`, then no slots are toggled off.

TC-003-04: toggle_off with tag premise — given one document slot tagged `chapter:5`, one document slot tagged `chapter:10`, rule `{ premise: { op:'lt', left:{type:'tag',tag:'chapter'}, right:{type:'literal',value:8} }, action:{type:'toggle_off'} }`, when evaluated, then only the `chapter:5` slot is toggled off.

TC-003-05: sort_by with literal value — given one variant_group slot with two members tagged `fanfic:A` (order 0) and `fanfic:B` (order 1), rule `{ premise:{op:'true'}, action:{type:'sort_by', sortKeys:[{tag:'fanfic',value:'B'},{tag:'fanfic',value:'A'}]} }`, then sort order becomes `[fanfic-B-id, fanfic-A-id]`.

TC-003-06: sort_by with matchVar — given variable `lang = 'ja'`, one variant_group slot with members tagged `lang:en` (order 0), `lang:ja` (order 1), rule `sort_by [{ tag:'lang', matchVar:'lang' }]` with premise `{ op:'true' }`, then sort order becomes `[ja-id, en-id]`.

TC-003-07: select action — given variant_group slot with members `[summary:arc, summary:chapter, (no summary tag)]`, rule `{ premise:{op:'true'}, action:{type:'select', match:{tag:'summary',value:'chapter'}} }`, then sort order is `[summary:chapter-id, summary:arc-id, no-tag-id]`.

TC-003-08: later rule overrides earlier — given toggle_off rule at index 0 then toggle_on rule at index 1, both with `op:'true'`, for the same slot, then final toggle state is `true`.

TC-003-09: missing tag returns false — given document slot with no tags, rule `{ premise:{op:'eq', left:{type:'tag',tag:'lang'}, right:{type:'literal',value:'ja'}}, action:{type:'toggle_off'} }`, then slot remains toggled on.

TC-003-10: numeric comparison — given document slot tagged `chapter:9`, rule `toggle_off` where `tag(chapter) < 10`, then slot is toggled off. Same slot tagged `chapter:10` is NOT toggled off.

TC-003-11: `resolves_type_coercion_string_fallback` — given document slot tagged `arc:prologue`, rule `toggle_off` where `tag(arc) < 103`, when evaluated with number-first coercion: `"prologue"` does not parse as number, so comparison is string-based (`"prologue" < "103"` → false in lexicographic order), then slot is NOT toggled off.

TC-003-12: `not` premise — given slot tagged `lang:en`, rule `toggle_off` with premise `{ op:'not', condition:{op:'eq', left:{type:'tag',tag:'lang'}, right:{type:'literal',value:'en'}} }`, then slot is NOT toggled off (premise evaluates to `not(true)` = false).

---

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

# ENG-007 — Query Builder

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-007-query-builder`
- **Depends on:** TYP-002, TYP-004
- **Files created:** `packages/engine/src/query-builder.ts`, `packages/engine/tests/query-builder.test.ts`

## Objective

Analyze a `Premise` and determine which parts can be pushed down to the data store as `DocumentPredicate[]` (index-friendly, tag-comparison-only filters) versus which parts must be evaluated in-memory.

## Behavior

**Exported function:**
```typescript
export function buildQueryPlan(premise: Premise, variables: VariableMap): QueryPlan
```

**Pushdown eligibility rules:** A premise is fully pushdownable (converted to a `DocumentPredicate`) only when ALL of the following are true:
1. It is a leaf comparison (not `and`, `or`, `not`).
2. The left operand is `{ type: 'tag', tag: string }`.
3. The right operand is `{ type: 'literal', value }` OR `{ type: 'literal_list', values }` OR `{ type: 'var', var }` where the variable **is present** in `variables`.

If the premise meets all three conditions, convert it to a `DocumentPredicate`:
- `{ op: 'eq' }` → `{ type: 'tag_eq', key: left.tag, value: String(resolvedRight) }`
- `{ op: 'neq' }` → `{ type: 'tag_neq', ... }`
- `{ op: 'lt' }` → `{ type: 'tag_lt', ... }`
- `{ op: 'lte' }` → `{ type: 'tag_lte', ... }`
- `{ op: 'gt' }` → `{ type: 'tag_gt', ... }`
- `{ op: 'gte' }` → `{ type: 'tag_gte', ... }`
- `{ op: 'in' }` with `literal_list` right → `{ type: 'tag_in', key: left.tag, values: right.values.map(String) }`
- `{ op: 'not_in' }` with `literal_list` right → `{ type: 'tag_not_in', ... }`
- `{ op: 'true' }` or `{ op: 'always' }` → no predicate; return `{ pushdownPredicates: [], localPredicates: [] }`.

If the premise does NOT meet the conditions: return `{ pushdownPredicates: [], localPredicates: [premise] }`.

**Compound premises (`and`, `or`, `not`)** are never pushed down. They are returned as `localPredicates`.

## Test Cases

TC-007-01: `tag_eq_with_literal_is_pushdown` — `{ op:'eq', left:{type:'tag',tag:'lang'}, right:{type:'literal',value:'ja'} }` → `pushdownPredicates: [{ type:'tag_eq', key:'lang', value:'ja' }]`, `localPredicates: []`.

TC-007-02: `tag_lt_with_resolved_variable_is_pushdown` — `{ op:'lt', left:{type:'tag',tag:'chapter'}, right:{type:'var',var:'current'} }` with `variables = Map([['current', 103]])` → `{ type:'tag_lt', key:'chapter', value:'103' }` in pushdown.

TC-007-03: `tag_with_missing_variable_is_local` — same premise but variable not in `variables` → `localPredicates: [premise]`, `pushdownPredicates: []`.

TC-007-04: `var_eq_var_is_local` — `{ op:'eq', left:{type:'var',var:'a'}, right:{type:'literal',value:'x'} }` → both operands are vars/literals (left is not `tag`) → local.

TC-007-05: `and_premise_is_local` — compound `and` premise → `localPredicates: [premise]`.

TC-007-06: `always_premise_produces_no_predicates` — `{ op:'always' }` → empty pushdown, empty local.

---

# ENG-008 — CRUD: Documents

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-008-crud-documents`
- **Depends on:** ENG-004, ENG-005, ENG-007, ENG-001
- **Files created:** `packages/engine/src/crud/documents.ts`, `packages/engine/tests/crud/documents.test.ts`

## Objective

Business logic for all document CRUD operations: create, get, update, delete, list, convertToComposition, convertToLeaf. All validation happens before the data store is called.

## Behavior

**Exported functions** (each takes `dataStore: DataStorePort` as the last argument):

```typescript
export async function createDocument(input: CreateDocumentInput, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function getDocument(id: DocumentId, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function updateDocument(id: DocumentId, changes: UpdateDocumentInput, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function deleteDocument(id: DocumentId, dataStore: DataStorePort): Promise<Result<void, DocumentError>>
export async function listDocuments(projectId: string, filters: DocumentFilters | undefined, dataStore: DataStorePort): Promise<Result<DocumentRecord[], DocumentError>>
export async function convertToComposition(id: DocumentId, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function convertToLeaf(id: DocumentId, content: string, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
```

**`createDocument` flow:**
1. Call `validateDocumentCreate(input)`. If error: return mapped error.
2. Call `dataStore.createDocument(input)`. Map `DataStoreError` to `DocumentError.StorageFailure`.

**`getDocument` flow:**
1. `dataStore.getDocumentRecord(id)`. If `DataStoreError.NotFound`: `DocumentError.NotFound`. Other errors: `DocumentError.StorageFailure`.

**`updateDocument` flow:**
1. Fetch current record via `getDocumentRecord(id)`. If not found: `DocumentError.NotFound`.
2. Call `validateDocumentUpdate(record, changes)`. If error: return.
3. Call `dataStore.updateDocument(id, changes)`.

**`deleteDocument` flow:**
1. Call `dataStore.deleteDocument(id)`. If `DataStoreError.NotFound`: `DocumentError.NotFound`.

**`listDocuments` flow:**
1. Call `dataStore.listDocuments(projectId, filters)`. Map errors to `DocumentError.StorageFailure`.

**`convertToComposition` flow:**
1. Fetch record. If not found: `DocumentError.NotFound`.
2. Call `validateConvertToComposition(record)`.
3. If `record.isComposition === true`: return current record immediately (idempotent).
4. Call `dataStore.updateDocument(id, { isComposition: true, content: null })`.

**`convertToLeaf` flow:**
1. Fetch record. If not found: `DocumentError.NotFound`.
2. If `record.isComposition === false`: return current record immediately (idempotent).
3. Call `dataStore.listSlots(id)` to get slot count.
4. Call `validateConvertToLeaf(record, slots.length)`. If error: return.
5. Call `dataStore.updateDocument(id, { isComposition: false, content })`.

**DataStoreError mapping rule (applies to all functions):**
- `DataStoreError.NotFound` → entity-specific `NotFound` error.
- All other `DataStoreError` variants → `StorageFailure`.

## Test Cases

TC-008-01: `create_leaf_document` — creates a leaf with content, returns DocumentRecord with correct fields.
TC-008-02: `create_composition_document` — creates a composition, returns record with `isComposition: true, content: null`.
TC-008-03: `create_leaf_without_content_returns_error` — `LeafRequiresContent`.
TC-008-04: `create_composition_with_content_returns_error` — `CompositionCannotHaveContent`.
TC-008-05: `get_nonexistent_document_returns_not_found` — `DocumentError.NotFound`.
TC-008-06: `update_content_of_composition_returns_error` — `DocumentError.CompositionCannotHaveContent`.
TC-008-07: `convert_composition_to_leaf_with_slots_returns_error` — `DocumentError.CannotConvertCompositionWithSlots`.
TC-008-08: `convert_to_composition_is_idempotent` — calling `convertToComposition` on an already-composition returns the current record without error.
TC-008-09: `convert_to_leaf_is_idempotent` — calling `convertToLeaf` on an already-leaf returns the current record without error.
TC-008-10: `convert_empty_composition_to_leaf` — composition with zero slots → succeeds, returns record with `isComposition: false, content: provided`.

---

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

# ENG-010 — CRUD: Variant Groups

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-010-crud-variant-groups`
- **Depends on:** ENG-008, ENG-005
- **Files created:** `packages/engine/src/crud/variant-groups.ts`, `packages/engine/tests/crud/variant-groups.test.ts`

## Objective

Business logic for variant group operations: create, delete, add/remove/reorder members, list.

## Behavior

```typescript
export async function createVariantGroup(input: CreateVariantGroupInput, dataStore: DataStorePort): Promise<Result<VariantGroupRecord, VariantGroupError>>
export async function deleteVariantGroup(id: VariantGroupId, dataStore: DataStorePort): Promise<Result<void, VariantGroupError>>
export async function addMember(groupId: VariantGroupId, documentId: DocumentId, dataStore: DataStorePort): Promise<Result<VariantGroupMemberRecord, VariantGroupError>>
export async function removeMember(groupId: VariantGroupId, documentId: DocumentId, dataStore: DataStorePort): Promise<Result<void, VariantGroupError>>
export async function reorderMembers(groupId: VariantGroupId, orderedDocumentIds: DocumentId[], dataStore: DataStorePort): Promise<Result<void, VariantGroupError>>
export async function listVariantGroups(projectId: string, dataStore: DataStorePort): Promise<Result<VariantGroupRecord[], VariantGroupError>>
export async function getMembers(groupId: VariantGroupId, dataStore: DataStorePort): Promise<Result<VariantGroupMemberRecord[], VariantGroupError>>
```

**`addMember` flow:**
1. Verify group exists via `dataStore.getVariantGroup(groupId)`. If not found: `VariantGroupError.NotFound`.
2. Verify document exists via `dataStore.getDocumentRecord(documentId)`. If not found: `VariantGroupError.NotFound` (repurposed — no separate document error; document not found in this context means invalid reference).
3. Fetch current members. If any member has `documentId === documentId` argument: return `VariantGroupError.DocumentAlreadyMember`.
4. Call `dataStore.addVariantGroupMember(groupId, documentId)`.

**`removeMember` flow:**
1. Verify group exists. If not: `VariantGroupError.NotFound`.
2. Fetch current members via `dataStore.listVariantGroupMemberRecords(groupId)`.
3. Call `validateMemberRemoval(members, documentId)`. If error: return.
4. Call `dataStore.removeVariantGroupMember(groupId, documentId)`.

**`reorderMembers` flow:**
1. Fetch current members.
2. Verify `orderedDocumentIds` is a permutation of current member `documentId`s. If not: `VariantGroupError.NotFound` (cannot reorder with unknown members) — use a dedicated check: if set mismatch, return `VariantGroupError.MemberNotFound`.
3. Call `dataStore.reorderVariantGroupMembers(groupId, orderedDocumentIds)`.

## Test Cases

TC-010-01: `create_variant_group_succeeds` — returns VariantGroupRecord with correct projectId and name.
TC-010-02: `add_member_to_group_succeeds` — member appears in getMembers result at end (highest order).
TC-010-03: `add_duplicate_member_returns_error` — `VariantGroupError.DocumentAlreadyMember`.
TC-010-04: `remove_member_at_position_zero_returns_error` — `VariantGroupError.CannotRemoveUniversalDefault`.
TC-010-05: `remove_member_at_non_zero_position_succeeds_and_resequences` — after removal, remaining members have contiguous 0-indexed orders.
TC-010-06: `reorder_members_with_invalid_ids_returns_error` — `VariantGroupError.MemberNotFound`.
TC-010-07: `add_member_to_nonexistent_group_returns_not_found`.

---

# ENG-011 — CRUD: Tags

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-011-crud-tags`
- **Depends on:** ENG-008
- **Files created:** `packages/engine/src/crud/tags.ts`, `packages/engine/tests/crud/tags.test.ts`

## Objective

Business logic for tag assignment and removal on documents, and tag search.

## Behavior

```typescript
export async function assignTag(documentId: DocumentId, key: string, value: string, dataStore: DataStorePort): Promise<Result<TagRecord, TagError>>
export async function removeTag(documentId: DocumentId, tagId: TagId, dataStore: DataStorePort): Promise<Result<void, TagError>>
export async function getTagsForDocument(documentId: DocumentId, dataStore: DataStorePort): Promise<Result<TagRecord[], TagError>>
export async function searchTags(projectId: string, key: string | undefined, value: string | undefined, dataStore: DataStorePort): Promise<Result<TagRecord[], TagError>>
```

**`assignTag` flow:**
1. Verify document exists via `getDocumentRecord(documentId)`. If not found: `TagError.DocumentNotFound`.
2. Fetch existing tags via `dataStore.listTagsForDocument(documentId)`.
3. Check for duplicate: if any existing `TagRecord` has `key === key && value === value` → `TagError.DuplicateTagOnDocument`.
4. Call `dataStore.assignTag(documentId, key, value)`.

**`removeTag` flow:**
1. Verify document exists. If not found: `TagError.DocumentNotFound`.
2. Call `dataStore.removeTag(documentId, tagId)`. If `DataStoreError.NotFound`: `TagError.NotFound`.

## Test Cases

TC-011-01: `assign_tag_to_document_succeeds` — tag appears in `getTagsForDocument` result.
TC-011-02: `assign_duplicate_tag_to_document_returns_error` — `TagError.DuplicateTagOnDocument`.
TC-011-03: `assign_same_key_different_value_succeeds` — documents can have multiple tags with same key.
TC-011-04: `remove_tag_succeeds` — tag no longer appears in `getTagsForDocument`.
TC-011-05: `remove_nonexistent_tag_returns_not_found` — `TagError.NotFound`.
TC-011-06: `assign_tag_to_nonexistent_document_returns_error` — `TagError.DocumentNotFound`.

---

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

# SQL-001 — SQL Template: Schema DDL

- **Sub-project:** `packages/sql-template`
- **Branch:** `feat/SQL-001-schema-ddl`
- **Depends on:** TYP-004
- **Files created:** `packages/sql-template/src/schema.ts`

## Objective

Define all `CREATE TABLE` and `CREATE INDEX` statements as exported string constants. These are the canonical schema for both SQLite and Postgres adapters. Dialect-specific adjustments are handled in adapters.

## Behavior

Export one constant per table and one grouped constant for indexes. Table DDL uses ANSI-compatible SQL (no dialect-specific types unless absolutely necessary). Use `TEXT` for strings, `INTEGER` for integers, `BOOLEAN` for booleans, `TIMESTAMPTZ` for timestamps. Dialect adapters may override specific type names.

**Exported constants** (each is a `string`):

- `DDL_TABLE_DOCUMENTS` — creates the `documents` table with the schema from ERD section 3.2.
- `DDL_TABLE_COMPOSITION_SLOTS` — from ERD 3.3.
- `DDL_TABLE_VARIANT_GROUPS` — from ERD 3.4.
- `DDL_TABLE_VARIANT_GROUP_MEMBERS` — from ERD 3.5.
- `DDL_TABLE_TAGS` — from ERD 3.6.
- `DDL_TABLE_DOCUMENT_TAGS` — from ERD 3.7.
- `DDL_TABLE_PRESETS` — from ERD 3.8.
- `DDL_TABLE_PRESET_RULES` — from ERD 3.9. The `premise` and `action_params` columns are `TEXT` (JSON serialized string) in the base schema. Postgres adapter overrides to `JSONB`.
- `DDL_TABLE_PRESET_ADHOC_DOCUMENTS` — from ERD 3.10.
- `DDL_TABLE_DOCUMENT_HISTORY` — from ERD 3.11.
- `DDL_INDEXES` — a single string containing all `CREATE INDEX` statements, separated by `;`. These are taken directly from the ERD index definitions.
- `ALL_DDL` — an array of all the above constants in dependency-safe creation order: `[DDL_TABLE_DOCUMENTS, DDL_TABLE_COMPOSITION_SLOTS, ...]`. Applied in sequence during schema initialization.

**Creation order** (respects FK dependencies):
1. `documents`
2. `tags`
3. `variant_groups`
4. `composition_slots`
5. `variant_group_members`
6. `document_tags`
7. `presets`
8. `preset_rules`
9. `preset_adhoc_documents`
10. `document_history`

## Test Cases

TC-SQL-001-01: Each DDL constant is a non-empty string containing `CREATE TABLE`.
TC-SQL-001-02: `ALL_DDL` array has exactly 10 entries.

---

# SQL-002 — SQL Template: Connection Interface

- **Sub-project:** `packages/sql-template`
- **Branch:** `feat/SQL-002-connection-interface`
- **Depends on:** none
- **Files created:** `packages/sql-template/src/connection.ts`

## Objective

Define the `SqlConnection` interface and supporting types that dialect adapters must implement. This is the low-level execution contract.

## Behavior

Create `packages/sql-template/src/connection.ts`:

```typescript
export interface Row {
  [column: string]: unknown;
}

export interface CommandResult {
  rowsAffected: number;
}

export interface TransactionContext {
  executeQuery(sql: string, params: unknown[]): Promise<Row[]>;
  executeCommand(sql: string, params: unknown[]): Promise<CommandResult>;
}

export interface SqlConnection {
  executeQuery(sql: string, params: unknown[]): Promise<Row[]>;
  executeCommand(sql: string, params: unknown[]): Promise<CommandResult>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

## Test Cases

`tsc --noEmit` passes.

---

# SQL-003 — SQL Template: Base DataStore Implementation

- **Sub-project:** `packages/sql-template`
- **Branch:** `feat/SQL-003-base-implementation`
- **Depends on:** SQL-001, SQL-002, TYP-004
- **Files created:** `packages/sql-template/src/sql-template-data-store.ts`, `packages/sql-template/tests/sql-template-data-store.test.ts`

## Objective

Implement all `DataStorePort` methods using the `SqlConnection` interface. This abstract class forms the shared implementation for both SQLite and Postgres adapters. Dialects extend it to provide a `SqlConnection` and override the parameter format.

## Behavior

**Class definition:**
```typescript
export abstract class SqlTemplateDataStore implements DataStorePort {
  protected constructor(protected readonly connection: SqlConnection) {}

  // Dialect adapters override this to control parameter style.
  // Return '?' for SQLite, '$N' (1-indexed) for Postgres.
  protected abstract formatParam(index: number): string;

  // Convenience: build a parameterized SQL statement with p(1), p(2)...
  protected p(index: number): string { return this.formatParam(index); }

  // Schema initialization: run all DDL in sequence.
  async initializeSchema(): Promise<void> { ... }

  // All DataStorePort methods implemented here.
  ...
}
```

**Row-to-domain mapping rules:**

`getDocument(id)`:
1. `SELECT id, project_id, title, alias, is_composition, content FROM documents WHERE id = {p(1)}`, params: `[id]`.
2. If no rows: `DataStoreError.NotFound`.
3. `SELECT t.key, t.value FROM tags t JOIN document_tags dt ON t.id = dt.tag_id WHERE dt.document_id = {p(1)}`, params: `[id]`.
4. If `is_composition = false`: return `DataLeaf { type: 'leaf', id, title, tags, content: row.content ?? '' }`.
5. If `is_composition = true`: `SELECT id, slot_order, ref_type, ref_document_id, ref_variant_group_id FROM composition_slots WHERE composition_id = {p(1)} ORDER BY slot_order ASC`. Assemble `CompositionSlot[]`. Return `DataComposition { type: 'composition', id, title, tags, slots }`.

`getPreset(id)`:
1. SELECT preset record.
2. SELECT preset rules ordered by `rule_order ASC`, deserialize `premise` and `action_params` JSON columns.
3. SELECT preset adhoc documents ordered by `inclusion_order ASC`, extract `document_id`.
4. Assemble `Preset { id, name, baseCompositionId, rules: Rule[], adHocDocuments: DocumentId[] }`.

`assignTag(documentId, key, value)`:
1. Fetch `project_id` from `documents WHERE id = {p(1)}`.
2. UPSERT tag: `INSERT INTO tags (id, project_id, key, value, color) VALUES ({p(1)},{p(2)},{p(3)},{p(4)},{p(5)}) ON CONFLICT (project_id, key, value) DO UPDATE SET id = tags.id RETURNING id, project_id, key, value, color, created_at`. (Postgres syntax; SQLite adapter overrides with `INSERT OR IGNORE`.)
3. INSERT into `document_tags (document_id, tag_id)` using `ON CONFLICT DO NOTHING`.
4. Return the TagRecord.

`queryDocuments(projectId, predicates)`:
1. Build a WHERE clause from `predicates`. Each predicate maps to a SQL condition on `t.key` and `t.value` via a `JOIN document_tags / tags`:
   - `tag_eq { key, value }` → `EXISTS (SELECT 1 FROM document_tags dt2 JOIN tags t2 ON dt2.tag_id=t2.id WHERE dt2.document_id=d.id AND t2.key={pN} AND t2.value={pN+1})`.
   - Other comparisons follow the same pattern with appropriate operators.
   - `is_composition` → `d.is_composition = {pN}`.
2. For each matching document: call `getDocument(id)` to hydrate. (Sequential is acceptable for Phase 3 scope.)

**All `reorder*` methods** use an approach of updating each row's order column individually within a transaction:
```sql
UPDATE composition_slots SET slot_order = {p(1)} WHERE id = {p(2)}
-- repeated for each slot
```
Wrapped in `connection.transaction()`.

**JSON serialization:** `Premise` and `Action` objects are serialized to string via `JSON.stringify` before INSERT, and parsed via `JSON.parse` on SELECT.

## Test Cases

SQL-003 is an abstract class — it is tested through the adapters in ADT-002 and ADT-004. The `tests/sql-template-data-store.test.ts` file contains unit tests for the query-building helpers only (not execution):

TC-SQL-003-01: `buildTagEqPredicate` correctly generates parameterized SQL fragment.
TC-SQL-003-02: `buildQueryDocumentsSQL` with two predicates generates correct compound WHERE clause.

---

---

# ADT-001 — Adapter: SQLite Implementation

- **Sub-project:** `packages/adapter-sqlite`
- **Branch:** `feat/ADT-001-sqlite-adapter`
- **Depends on:** SQL-003
- **Files created:** `packages/adapter-sqlite/src/sqlite-connection.ts`, `packages/adapter-sqlite/src/sqlite-data-store.ts`, `packages/adapter-sqlite/src/index.ts`

## Objective

Implement `SqlConnection` and extend `SqlTemplateDataStore` for SQLite using `better-sqlite3` for file-based databases and `sql.js` for in-memory databases (used in integration tests).

## Behavior

**`SqliteConnection`** implements `SqlConnection` using `better-sqlite3`:
- `executeQuery(sql, params)`: runs `db.prepare(sql).all(...params)` and returns rows as `Row[]`.
- `executeCommand(sql, params)`: runs `db.prepare(sql).run(...params)` and returns `{ rowsAffected: info.changes }`.
- `transaction<T>(fn)`: uses `db.transaction(() => { ... })()`.
- `close()`: calls `db.close()`.

**`SqliteDataStore`** extends `SqlTemplateDataStore`:
```typescript
export class SqliteDataStore extends SqlTemplateDataStore {
  protected formatParam(_index: number): string { return '?'; }
}
```

**JSONB override:** SQLite stores `premise` and `action_params` as `TEXT`. The base class already does `JSON.stringify`/`JSON.parse`. No override needed.

**Dialect override for tag UPSERT:** SQLite uses `INSERT OR IGNORE INTO tags ...` followed by a `SELECT` to retrieve the tag record. The `assignTag` method is overridden.

**Exported factory:**
```typescript
export function createSqliteDataStore(dbPath: string): SqliteDataStore
// dbPath ':memory:' for in-memory SQLite
```

**`index.ts`** exports `createSqliteDataStore` and `SqliteDataStore`.

## Test Cases

Covered in ADT-002.

---

# ADT-002 — Adapter: SQLite Integration Tests

- **Sub-project:** `packages/adapter-sqlite`
- **Branch:** `feat/ADT-002-sqlite-integration-tests`
- **Depends on:** ADT-001, ENG-013
- **Files created:** `packages/adapter-sqlite/tests/integration.test.ts`

## Objective

Verify the full `DataStorePort` contract is correctly implemented by `SqliteDataStore` against a real in-memory SQLite database. Also verify end-to-end: `createEngine(sqliteDataStore, alwaysTrueAccessFilter)` produces correct resolved markdown.

## Behavior

Each test creates a fresh in-memory SQLite database via `createSqliteDataStore(':memory:')`, calls `initializeSchema()`, then exercises the data store through the engine.

**Test setup helper:**
```typescript
function createAlwaysTrueAccessFilter(): AccessFilterPort {
  return { canAccess: async (_id) => true };
}
```

## Test Cases

TC-ADT-002-01: `schema_initializes_without_error` — `initializeSchema()` completes, all tables exist.
TC-ADT-002-02: `create_and_retrieve_document` — create leaf via `engine.documents.create`, retrieve via `engine.documents.get`, fields match.
TC-ADT-002-03: `create_composition_add_slots_resolve` — create composition with two leaf slots, `engine.resolution.resolveComposition` returns concatenated content.
TC-ADT-002-04: `variant_group_resolution_with_sort_rule` — create variant group with two members, create preset with sort_by rule, `engine.resolution.resolve` returns preferred member.
TC-ADT-002-05: `cycle_detection_prevents_cycle` — attempt to add a slot that would create a cycle → `SlotError.WouldCreateCycle`.
TC-ADT-002-06: `tag_assignment_and_search` — assign tags, `engine.tags.search` returns correct documents.
TC-ADT-002-07: `preset_rule_ordering` — add three rules, reorder them, `listPresetRules` returns in new order.
TC-ADT-002-08: `full_preset_resolution_with_toggle_and_sort` — integration test covering evaluate → override → resolve pipeline end-to-end.

---

# ADT-003 — Adapter: Postgres Implementation

- **Sub-project:** `packages/adapter-postgres`
- **Branch:** `feat/ADT-003-postgres-adapter`
- **Depends on:** SQL-003
- **Files created:** `packages/adapter-postgres/src/postgres-connection.ts`, `packages/adapter-postgres/src/postgres-data-store.ts`, `packages/adapter-postgres/src/index.ts`

## Objective

Implement `SqlConnection` and extend `SqlTemplateDataStore` for Postgres using the `pg` npm package.

## Behavior

**`PostgresConnection`** implements `SqlConnection`:
- Constructor accepts a `pg.Pool` instance.
- `executeQuery(sql, params)`: `pool.query(sql, params)` → map `rows`.
- `executeCommand(sql, params)`: `pool.query(sql, params)` → `{ rowsAffected: result.rowCount ?? 0 }`.
- `transaction<T>(fn)`: acquire a client from the pool, `BEGIN`, call `fn`, `COMMIT` or `ROLLBACK` on error, release.
- `close()`: `pool.end()`.

**`PostgresDataStore`** extends `SqlTemplateDataStore`:
```typescript
export class PostgresDataStore extends SqlTemplateDataStore {
  protected formatParam(index: number): string { return `$${index}`; }
}
```

**JSONB override:** the `preset_rules` table uses `JSONB` for `premise` and `action_params` in Postgres. The `pg` driver returns parsed JS objects for JSONB columns. Override the rule retrieval methods to skip `JSON.parse` when the column value is already an object.

**Tag UPSERT:** Postgres uses `INSERT INTO tags ... ON CONFLICT (project_id, key, value) DO UPDATE SET id = tags.id RETURNING *`.

**Exported factory:**
```typescript
export function createPostgresDataStore(connectionString: string): PostgresDataStore
```

## Test Cases

Covered in ADT-004.

---

# ADT-004 — Adapter: Postgres Integration Tests

- **Sub-project:** `packages/adapter-postgres`
- **Branch:** `feat/ADT-004-postgres-integration-tests`
- **Depends on:** ADT-003, ENG-013
- **Files created:** `packages/adapter-postgres/tests/integration.test.ts`

## Objective

Same contract verification as ADT-002 but against a real Postgres instance. Tests are skipped if the environment variable `POSTGRES_TEST_URL` is not set.

## Behavior

Test setup:
```typescript
const TEST_URL = process.env['POSTGRES_TEST_URL'];
const skip = !TEST_URL;

beforeEach(async () => {
  if (skip) return;
  // Drop and recreate a test schema to ensure isolation.
  store = createPostgresDataStore(TEST_URL!);
  await store.initializeSchema();
});
```

All test cases mirror ADT-002 (TC-ADT-002-01 through TC-ADT-002-08) applied to the Postgres adapter.

Additionally:
TC-ADT-004-09: `jsonb_rules_round_trip` — add a preset rule with a compound `and` premise, retrieve it, verify `premise` deserialized correctly as a JavaScript object matching the original.

---

## Notes for Implementing Agents

1. **Start with TYP-001 through TYP-005.** Nothing else compiles until types are in place.
2. **ENG-001 (MockDataStore) before any other engine task.** Every engine test file depends on it.
3. **ENG-003, ENG-004, ENG-005, ENG-007 can be implemented in parallel** — they have no inter-dependencies.
4. **ENG-008 through ENG-012 depend on the pure-function modules being complete and tested first.** Do not start CRUD work without passing tests for ENG-004 and ENG-005.
5. **Every public function must have at least one test. Every error path must have a test.** This is non-negotiable per project conventions.
6. **Do not modify `packages/types` after the TYP tasks are merged** without owner approval. The Engine interface is frozen at TYP-005.
7. **SQL-003 is abstract and is not tested in isolation** beyond its helper functions. The integration tests in ADT-002 and ADT-004 are the real contract tests.
8. **Any deviation from the exact type signatures or behaviors specified here requires owner approval.** Flag in the completion artifact, do not self-decide.
