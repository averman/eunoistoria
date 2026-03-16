# ENGINE.md — Engine Sub-Project Spec

## Extendable Markdown Editor — Core Logic Layer

---

## 1. Purpose

The engine is the core logic layer. It is a pure TypeScript library with zero runtime dependencies. It owns:
- Business logic for all CRUD operations (validation, constraint enforcement, cycle detection).
- Rule evaluation (JSON premise/action processing → selection map).
- Composition resolution (tree walking with selection map → flat content).
- Query building (parameterized SQL construction with predicate pushdown decisions).

The engine does NOT own:
- Storage (injected via `DataStorePort`).
- Access control decisions (injected via `AccessFilterPort`).
- Output delivery (injected via `OutputPort`).
- User state (variables, manual overrides — provided at call time).
- UI logic of any kind.

---

## 2. Dependencies

- **Imports from:** `@project/types` (port interfaces, entity types, rule schema types, result types).
- **Imported by:** `packages/power-app`, `packages/reader-app`.
- **Runtime dependencies:** None.
- **Dev dependencies:** `vitest`, `@project/types`.

---

## 3. Port Interfaces Consumed

All defined in `packages/types/`. The engine calls these — never implements them.

### DataStorePort
The primary storage interface. The engine builds parameterized SQL and passes it to `executeQuery`. Also provides higher-level methods for common operations.

Key methods (see `packages/types/` for full signatures):
- `executeQuery(sql: string, params: unknown[]): Promise<Result<Row[], DataStoreError>>`
- `executeCommand(sql: string, params: unknown[]): Promise<Result<CommandResult, DataStoreError>>`
- `transaction<T>(fn: (tx: TransactionPort) => Promise<T>): Promise<Result<T, DataStoreError>>`

### AccessFilterPort
Determines document visibility per user/context.

- `canAccess(documentId: string): Promise<boolean>`

### OutputPort
Receives resolved content.

- `write(content: string, metadata: OutputMetadata): Promise<Result<void, OutputError>>`

---

## 4. Engine Public API

The engine exposes a factory function that accepts ports and returns an `Engine` object:

```typescript
function createEngine(
  dataStore: DataStorePort,
  accessFilter: AccessFilterPort
): Engine;
```

The `Engine` object exposes grouped operations:

```typescript
interface Engine {
  // Document operations
  documents: {
    create(input: CreateDocumentInput): Promise<Result<Document, DocumentError>>;
    get(id: string): Promise<Result<Document, DocumentError>>;
    update(id: string, changes: UpdateDocumentInput): Promise<Result<Document, DocumentError>>;
    delete(id: string): Promise<Result<void, DocumentError>>;
    list(projectId: string, filters?: DocumentFilters): Promise<Result<Document[], DocumentError>>;
    convertToComposition(id: string): Promise<Result<Document, DocumentError>>;
    convertToLeaf(id: string, content: string): Promise<Result<Document, DocumentError>>;
  };

  // Composition slot operations
  slots: {
    add(compositionId: string, input: AddSlotInput): Promise<Result<CompositionSlot, SlotError>>;
    remove(slotId: string): Promise<Result<void, SlotError>>;
    reorder(compositionId: string, ordering: string[]): Promise<Result<void, SlotError>>;
    list(compositionId: string): Promise<Result<CompositionSlot[], SlotError>>;
  };

  // Variant group operations
  variantGroups: {
    create(input: CreateVariantGroupInput): Promise<Result<VariantGroup, VariantGroupError>>;
    delete(id: string): Promise<Result<void, VariantGroupError>>;
    addMember(groupId: string, documentId: string): Promise<Result<VariantGroupMember, VariantGroupError>>;
    removeMember(groupId: string, documentId: string): Promise<Result<void, VariantGroupError>>;
    reorderMembers(groupId: string, ordering: string[]): Promise<Result<void, VariantGroupError>>;
    list(projectId: string): Promise<Result<VariantGroup[], VariantGroupError>>;
    getMembers(groupId: string): Promise<Result<VariantGroupMember[], VariantGroupError>>;
  };

  // Tag operations
  tags: {
    assign(documentId: string, key: string, value: string): Promise<Result<Tag, TagError>>;
    remove(documentId: string, tagId: string): Promise<Result<void, TagError>>;
    getForDocument(documentId: string): Promise<Result<Tag[], TagError>>;
    search(projectId: string, key?: string, value?: string): Promise<Result<Tag[], TagError>>;
  };

  // Preset operations
  presets: {
    create(input: CreatePresetInput): Promise<Result<Preset, PresetError>>;
    update(id: string, changes: UpdatePresetInput): Promise<Result<Preset, PresetError>>;
    delete(id: string): Promise<Result<void, PresetError>>;
    addRule(presetId: string, rule: RuleInput): Promise<Result<PresetRule, PresetError>>;
    removeRule(ruleId: string): Promise<Result<void, PresetError>>;
    reorderRules(presetId: string, ordering: string[]): Promise<Result<void, PresetError>>;
    addAdHocDocument(presetId: string, documentId: string): Promise<Result<PresetAdHocDocument, PresetError>>;
    removeAdHocDocument(presetId: string, documentId: string): Promise<Result<void, PresetError>>;
  };

  // Resolution
  resolution: {
    evaluateRules(presetId: string, variables: VariableMap): Promise<Result<SelectionMap, ResolutionError>>;
    resolve(presetId: string, variables: VariableMap, selectionMap: SelectionMap): Promise<Result<string, ResolutionError>>;
    resolveComposition(compositionId: string): Promise<Result<string, ResolutionError>>;
    estimateTokens(content: string): number;
  };

  // Validation
  validation: {
    wouldCreateCycle(compositionId: string, targetDocumentId: string): Promise<Result<boolean, ValidationError>>;
    validatePresetRules(presetId: string): Promise<Result<RuleValidationReport, ValidationError>>;
    findBrokenReferences(projectId: string): Promise<Result<BrokenReference[], ValidationError>>;
  };
}
```

---

## 5. Internal Modules

### 5.1 `src/rule-evaluator.ts`
- Evaluates JSON rule premises against variables and tag values.
- Type coercion: number-first, string fallback (see DEC-002).
- Produces a `SelectionMap` (per-slot toggle states + per-variant-group sort orders).
- Pure function: no side effects, no data store access (receives pre-fetched data).

### 5.2 `src/resolution.ts`
- Walks a composition tree using the selection map.
- Handles recursive compositions (depth-limited, max 20 levels).
- Skips toggled-off slots.
- For variant group slots, picks the first accessible member per sort order, falls back to position 0.
- Returns flat string content (concatenated markdown).

### 5.3 `src/cycle-detection.ts`
- BFS-based cycle detection.
- Follows both direct document references and variant group memberships.
- Called at write time (when adding/modifying slots), not only at resolution time.

### 5.4 `src/validation.ts`
- Leaf/composition mutual exclusion enforcement.
- Universal default constraint checking.
- Broken reference detection.
- Rule validation (premises referencing non-existent tag keys, etc.).

### 5.5 `src/query-builder.ts`
- Constructs parameterized SQL for CRUD operations.
- Predicate analysis: determines which parts of a filter can be pushed to the data store (simple tag comparisons) vs. evaluated in-memory (variable references, compound conditions).
- Returns `QuerySpec` objects: `{ sql: string; params: unknown[] }`.

### 5.6 `src/crud/`
- One file per entity group: `documents.ts`, `slots.ts`, `variant-groups.ts`, `tags.ts`, `presets.ts`.
- Orchestrates validation + query building + data store calls.
- Business logic lives here (not in the query builder or data store).

### 5.7 `src/token-estimation.ts`
- `estimateTokens(content: string): number` — returns `Math.ceil(content.length / 4)`.
- Conservative heuristic. Informational only.

---

## 6. File Manifest

| File | Owns | Estimated Tokens |
|---|---|---|
| `src/index.ts` | Public API: `createEngine` factory, re-exports | ~200 |
| `src/rule-evaluator.ts` | Premise evaluation, type coercion, selection map construction | ~800 |
| `src/resolution.ts` | Tree walking, slot resolution, depth limiting | ~600 |
| `src/cycle-detection.ts` | BFS cycle detection through documents and variant groups | ~400 |
| `src/validation.ts` | Constraint enforcement, broken reference detection | ~500 |
| `src/query-builder.ts` | SQL construction, predicate pushdown analysis | ~700 |
| `src/crud/documents.ts` | Document CRUD orchestration | ~500 |
| `src/crud/slots.ts` | Slot CRUD orchestration | ~400 |
| `src/crud/variant-groups.ts` | Variant group + member CRUD orchestration | ~500 |
| `src/crud/tags.ts` | Tag assignment/removal orchestration | ~300 |
| `src/crud/presets.ts` | Preset + rule + ad-hoc doc CRUD orchestration | ~500 |
| `src/token-estimation.ts` | Token count heuristic | ~50 |
| `tests/helpers/mock-data-store.ts` | In-memory DataStorePort for testing | ~600 |
| `tests/rule-evaluator.test.ts` | Rule evaluation tests | ~1000 |
| `tests/resolution.test.ts` | Resolution tests | ~800 |
| `tests/cycle-detection.test.ts` | Cycle detection tests | ~500 |
| `tests/validation.test.ts` | Validation tests | ~500 |
| `tests/query-builder.test.ts` | Query builder tests | ~600 |
| `tests/crud/*.test.ts` | CRUD operation tests | ~2000 |

**Total estimated context for full engine:** ~10,450 tokens.
**Typical task context (spec + 2-3 source files + test file):** ~3,000-4,000 tokens.

---

## 7. Key Design Constraints

1. **Zero runtime dependencies.** No exceptions. If you think you need a library, escalate.
2. **Pure functions where possible.** Rule evaluation and resolution are stateless. State lives in the data store, accessed through ports.
3. **SQL is built by the engine.** The data store port executes it. The engine decides what SQL to build, including predicate pushdown.
4. **Errors are Results, not exceptions.** See `docs/CONVENTIONS.md`.
5. **No UI awareness.** The engine does not know about visual builders, checkboxes, sidebars, or any presentation concept. It receives typed inputs and returns typed outputs.
