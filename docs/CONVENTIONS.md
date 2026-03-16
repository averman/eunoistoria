# Code Conventions

## Extendable Markdown Editor — Coding Standards and Patterns

---

## 1. TypeScript

### 1.1 Strict Mode
All packages use `strict: true` in `tsconfig.json`. No `any` anywhere. Use `unknown` when the type is genuinely unknown, then narrow with type guards.

### 1.2 Naming

| Entity | Convention | Example |
|---|---|---|
| Files | `kebab-case.ts` | `rule-evaluator.ts` |
| Types / Interfaces | `PascalCase` | `CompositionSlot`, `DataStorePort` |
| Functions | `camelCase` | `resolvePreset`, `evaluateRules` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RECURSION_DEPTH` |
| Variables | `camelCase` | `selectionMap`, `accessFilter` |
| Enum members | `PascalCase` | `RefType.Document`, `RefType.VariantGroup` |
| Test files | `*.test.ts` mirroring source | `rule-evaluator.test.ts` |
| Sub-project spec files | `UPPER_CASE.md` | `ENGINE.md`, `TYPES.md` |

**No abbreviations.** `document` not `doc`. `composition` not `comp`. `variant` not `var` (also a reserved word). `configuration` not `config`. Exception: universally understood abbreviations like `id`, `url`, `sql`.

### 1.3 Imports
- Use explicit named imports. No `import *`.
- Group imports: external packages → workspace packages → relative imports. Blank line between groups.
- Port interfaces are imported from `@project/types`, never from adapter packages.

### 1.4 Exports
- One primary export per file. Supporting types can be co-exported.
- No default exports. Always named exports.
- Index files (`index.ts`) re-export the public API. Internal modules are not re-exported.

---

## 2. Architecture Patterns

### 2.1 Result Type (No Thrown Exceptions for Business Logic)

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

All operations that can fail for business reasons return `Result`. Thrown exceptions are reserved for programming bugs (invariant violations that should never happen at runtime).

```typescript
// CORRECT — business error as Result
function createDocument(input: CreateDocumentInput): Result<Document, CreateDocumentError> {
  if (input.isComposition && input.content !== null) {
    return { ok: false, error: CreateDocumentError.CompositionCannotHaveContent };
  }
  // ...
  return { ok: true, value: document };
}

// CORRECT — invariant violation as thrown exception
function resolveSlot(slot: CompositionSlot): string {
  if (slot.refType === RefType.Document && slot.refDocumentId === null) {
    throw new Error("Invariant violation: document slot has null refDocumentId");
  }
  // ...
}
```

### 2.2 Port Interfaces

Ports are TypeScript interfaces defined in `packages/types/`. They use async methods (returning `Promise<Result<T, E>>`) even when the underlying implementation is synchronous. This ensures adapters are interchangeable without signature changes.

```typescript
interface DataStorePort {
  getDocument(id: string): Promise<Result<Document, DataStoreError>>;
  createDocument(input: CreateDocumentInput): Promise<Result<Document, DataStoreError>>;
  executeQuery(query: string, params: unknown[]): Promise<Result<Row[], DataStoreError>>;
  // ...
}
```

### 2.3 Dependency Injection

The engine receives ports through function parameters or factory functions. No service locators, no dependency injection containers.

```typescript
// CORRECT — ports as parameters
function resolvePreset(
  presetId: string,
  variables: Map<string, unknown>,
  dataStore: DataStorePort,
  accessFilter: AccessFilterPort,
  output: OutputPort
): Promise<Result<string, ResolutionError>> {
  // ...
}

// ALSO CORRECT — factory that returns a configured engine
function createEngine(
  dataStore: DataStorePort,
  accessFilter: AccessFilterPort
): Engine {
  return {
    resolvePreset: (presetId, variables) => resolvePreset(presetId, variables, dataStore, accessFilter),
    // ...
  };
}
```

### 2.4 Functions Over Classes

Use plain functions for stateless operations (rule evaluation, resolution, validation, cycle detection). Use classes only for stateful entities (database connections, adapters with pooling).

```typescript
// CORRECT — stateless logic as function
function evaluatePremise(premise: Premise, variables: Map<string, unknown>, tags: Tag[]): boolean {
  // ...
}

// CORRECT — stateful adapter as class
class SqliteAdapter implements DataStorePort {
  private db: Database;
  constructor(path: string) { /* ... */ }
  // ...
}
```

---

## 3. JSON Rule Schema

Rules are JSON objects, not strings. The engine evaluates them by recursively matching on the `op` field. No `eval()`, no string parsing.

### 3.1 Premise Schema

```typescript
type Premise =
  | { op: "eq"; left: Operand; right: Operand }
  | { op: "neq"; left: Operand; right: Operand }
  | { op: "lt"; left: Operand; right: Operand }
  | { op: "lte"; left: Operand; right: Operand }
  | { op: "gt"; left: Operand; right: Operand }
  | { op: "gte"; left: Operand; right: Operand }
  | { op: "in"; left: Operand; right: Operand }
  | { op: "not_in"; left: Operand; right: Operand }
  | { op: "and"; conditions: Premise[] }
  | { op: "or"; conditions: Premise[] }
  | { op: "not"; condition: Premise }
  | { op: "true" };

type Operand =
  | { tag: string }          // value of a tag key on the document
  | { var: string }          // value of a runtime variable
  | { value: string | number | boolean }  // literal
  | { values: (string | number)[] };      // literal list (for "in" checks)
```

### 3.2 Action Schema

```typescript
type Action =
  | { type: "sort_by"; sortKeys: SortKey[] }
  | { type: "toggle_on" }
  | { type: "toggle_off" }
  | { type: "select"; match: { tag: string; value: string | number } };

type SortKey = {
  tag: string;
  value?: string | number;   // prefer members where tag matches this value
  matchVar?: string;          // prefer members where tag matches this variable's value
};
```

### 3.3 Storage

Rules are stored as JSONB (Postgres) or TEXT containing JSON (SQLite) in the `premise` and `action_params` columns of the `preset_rules` table. The engine deserializes them into the typed schema on read.

---

## 4. SQL Conventions

### 4.1 Parameterized Queries

All queries use positional parameters (`$1, $2, $3` for Postgres, `?, ?, ?` for SQLite). No string interpolation. No template literals with embedded values.

The SQL template base handles parameter style differences between dialects.

### 4.2 Query Building

The engine builds SQL as string concatenation with explicit parameter arrays. Not an ORM. Not a query builder library.

```typescript
// CORRECT
function buildGetDocumentsByTags(projectId: string, tagKey: string, tagValue: string): QuerySpec {
  return {
    sql: `SELECT d.* FROM documents d
          JOIN document_tags dt ON d.id = dt.document_id
          JOIN tags t ON dt.tag_id = t.id
          WHERE d.project_id = $1 AND t.key = $2 AND t.value = $3`,
    params: [projectId, tagKey, tagValue]
  };
}
```

### 4.3 Schema Naming

| Entity | Table name | Convention |
|---|---|---|
| Entities | Plural `snake_case` | `documents`, `variant_groups`, `preset_rules` |
| Join tables | Both entity names | `document_tags`, `variant_group_members` |
| Columns | Singular `snake_case` | `project_id`, `is_composition`, `member_order` |
| Indexes | `idx_{table}_{columns}` | `idx_documents_project_id` |
| Constraints | `check_{description}` or `unique_{columns}` | `check_document_kind`, `unique_slot_order` |

---

## 5. Testing Conventions

### 5.1 File Structure
Test files live alongside source in a `tests/` directory mirroring `src/`:
```
packages/engine/
├── src/
│   ├── rule-evaluator.ts
│   └── resolution.ts
└── tests/
    ├── rule-evaluator.test.ts
    └── resolution.test.ts
```

### 5.2 Test Naming
Test names describe the behavior being verified:

```typescript
// CORRECT
describe("resolvePreset", () => {
  it("returns full content for leaf documents", () => { /* ... */ });
  it("skips toggled-off slots", () => { /* ... */ });
  it("falls back to universal default when no accessible member matches sort", () => { /* ... */ });
  it("returns error for circular references", () => { /* ... */ });
});

// WRONG
describe("resolvePreset", () => {
  it("test1", () => { /* ... */ });
  it("works correctly", () => { /* ... */ });
  it("handles edge case", () => { /* ... */ });
});
```

### 5.3 Test Helpers
Shared test utilities (mock data store, fixture builders) live in `tests/helpers/` within each package. Cross-package test utilities are not allowed — each package maintains its own.

### 5.4 Mock Data Store
Engine tests use an in-memory implementation of `DataStorePort`. This mock is maintained within the engine package's test helpers. It stores entities in plain `Map` objects.

---

## 6. File Organization Within Packages

```
packages/<name>/
├── <NAME>.md              ← Sub-project spec and manifest
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           ← Public API re-exports
│   ├── <module>.ts        ← Implementation files
│   └── types.ts           ← Package-internal types (if any)
└── tests/
    ├── helpers/            ← Test utilities, mock implementations
    └── <module>.test.ts    ← Test files
```

---

## 7. Git Conventions

### 7.1 Commit Messages
```
<type>(<scope>): <description>

<body — optional, explains why>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
Scope: package name (`engine`, `types`, `sql-template`, etc.) or `project` for cross-cutting.

### 7.2 Branch Naming
```
<type>/<task-id>-<short-description>
```

Example: `feat/ENG-012-sort-by-action`, `fix/SQL-003-parameter-ordering`.
