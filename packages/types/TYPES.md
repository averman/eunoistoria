# TYPES.md — Shared Types Sub-Project Spec

## Extendable Markdown Editor — Type Definitions and Port Interfaces

---

## 1. Purpose

This package contains all shared TypeScript type definitions and port interface declarations. It has **zero runtime code** — types only. Every other package in the monorepo depends on it.

This is the single source of truth for:
- Entity types (what data looks like).
- Port interfaces (how components communicate).
- Rule schema types (what rules look like as JSON).
- Result and error types (how errors are communicated).

---

## 2. Dependencies

- **Imports from:** Nothing. This is the root of the dependency tree.
- **Imported by:** Every other package.
- **Runtime dependencies:** None.
- **Dev dependencies:** None (type-checked via `tsc --noEmit`).

---

## 3. Contents

### 3.1 Entity Types

| Type | Description | Source Reference |
|---|---|---|
| `Project` | Top-level container. `id`, `name`, timestamps. | ERD §3.1 |
| `Document` | Core entity. `id`, `projectId`, `title`, `alias`, `isComposition`, `content`, timestamps. | ERD §3.2 |
| `CompositionSlot` | Ordered slot in a composition. `id`, `compositionId`, `slotOrder`, `refType`, `refDocumentId`, `refVariantGroupId`. | ERD §3.3 |
| `VariantGroup` | Named set of interchangeable documents. `id`, `projectId`, `name`, timestamp. | ERD §3.4 |
| `VariantGroupMember` | Join: document ↔ variant group. `variantGroupId`, `documentId`, `memberOrder`, timestamp. | ERD §3.5 |
| `Tag` | Project-scoped key-value definition. `id`, `projectId`, `key`, `value`. | ERD §3.6 |
| `DocumentTag` | Join: document ↔ tag. `documentId`, `tagId`. | ERD §3.7 |
| `Preset` | Named configuration. `id`, `projectId`, `name`, `compositionId`, timestamps. | ERD §3.8 |
| `PresetRule` | Ordered rule within a preset. `id`, `presetId`, `ruleOrder`, `premise` (JSON), `actionType`, `actionParams` (JSON). | ERD §3.9 |
| `PresetAdHocDocument` | Extra document appended to preset output. `presetId`, `documentId`, `inclusionOrder`. | ERD §3.10 |
| `DocumentHistory` | Immutable snapshot. `id`, `documentId`, `title`, `content`, `isComposition`, timestamp. | ERD §3.11 |

### 3.2 Port Interfaces

| Interface | Owner | Description |
|---|---|---|
| `DataStorePort` | Implemented by adapters | SQL execution, transactions |
| `AccessFilterPort` | Implemented by product apps | `canAccess(documentId) → boolean` |
| `OutputPort` | Implemented by product apps | Receives resolved content |
| `TransactionPort` | Implemented by adapters | Scoped transaction operations |
| `ConnectionPort` | Implemented by dialect adapters | Database connection abstraction (used by sql-template) |

### 3.3 Rule Schema Types

| Type | Description |
|---|---|
| `Premise` | Discriminated union on `op`: comparison operators, logical combinators, `true` literal. |
| `Operand` | Tag reference, variable reference, literal value, or literal list. |
| `Action` | Discriminated union on `type`: `sort_by`, `toggle_on`, `toggle_off`, `select`. |
| `SortKey` | Tag key + preferred value or variable match. |
| `Rule` | Complete rule: `premise` + `action`. |
| `RuleInput` | User-facing rule creation input (same shape, used for validation before storage). |

### 3.4 Resolution Types

| Type | Description |
|---|---|
| `SelectionMap` | Per-slot toggle states + per-variant-group sort orders. Output of rule evaluation, input to tree walking. |
| `VariableMap` | `Map<string, string \| number \| boolean \| string[]>` — runtime variables from presentation layer. |
| `OutputMetadata` | Metadata attached to resolved output (preset name, timestamp, token estimate). |

### 3.5 Result and Error Types

| Type | Description |
|---|---|
| `Result<T, E>` | `{ ok: true; value: T } \| { ok: false; error: E }` |
| `DataStoreError` | Enum: `ConnectionFailed`, `QueryFailed`, `TransactionFailed`, `ConstraintViolation`. |
| `DocumentError` | Enum: `NotFound`, `InvalidKind`, `CompositionHasContent`, `LeafHasSlots`, `StoreError`. |
| `SlotError` | Enum: `CompositionNotFound`, `InvalidReference`, `CycleDetected`, `StoreError`. |
| `VariantGroupError` | Enum: `NotFound`, `EmptyGroup`, `StoreError`. |
| `TagError` | Enum: `DocumentNotFound`, `DuplicateTag`, `StoreError`. |
| `PresetError` | Enum: `NotFound`, `InvalidCompositionRef`, `InvalidRule`, `StoreError`. |
| `ResolutionError` | Enum: `PresetNotFound`, `MaxDepthExceeded`, `BrokenReference`, `StoreError`. |
| `ValidationError` | Enum: `StoreError`. |
| `OutputError` | Enum: `WriteFailed`. |

### 3.6 Query Types

| Type | Description |
|---|---|
| `QuerySpec` | `{ sql: string; params: unknown[] }` — parameterized query. |
| `CommandResult` | `{ rowsAffected: number }` — result of INSERT/UPDATE/DELETE. |
| `Row` | `Record<string, unknown>` — generic row from SELECT. |
| `DocumentFilters` | Optional filters for document listing: by tags, title, alias, isComposition. |

### 3.7 Enums

| Enum | Values |
|---|---|
| `RefType` | `Document`, `VariantGroup` |
| `ActionType` | `SortBy`, `ToggleOn`, `ToggleOff`, `Select` |

---

## 4. File Manifest

| File | Owns | Estimated Tokens |
|---|---|---|
| `src/index.ts` | Re-exports all public types | ~100 |
| `src/entities.ts` | Entity types (Document, Slot, VariantGroup, etc.) | ~400 |
| `src/ports.ts` | Port interfaces (DataStorePort, AccessFilterPort, OutputPort) | ~300 |
| `src/rules.ts` | Rule schema types (Premise, Action, Operand, SortKey) | ~350 |
| `src/resolution.ts` | Resolution types (SelectionMap, VariableMap, OutputMetadata) | ~200 |
| `src/results.ts` | Result type and all error enums | ~400 |
| `src/query.ts` | Query types (QuerySpec, CommandResult, Row, DocumentFilters) | ~150 |
| `src/enums.ts` | RefType, ActionType enums | ~50 |

**Total estimated context for full types package:** ~1,950 tokens.

---

## 5. Change Protocol

This package is the most sensitive in the monorepo. Every other package depends on it. Changes here cascade everywhere.

**Any change to this package requires:**
1. Pre-approval from the project owner (documented in the task spec).
2. Assessment of downstream impact (which packages are affected).
3. Coordinated updates to affected packages (may require multiple task specs).

**Adding new types** is lower risk than **modifying existing types.** New types are additive. Modified types break consumers.
