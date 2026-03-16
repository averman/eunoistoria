# Project Architecture

## Extendable Markdown Editor — Monorepo Structure and Sub-Project Relationships

---

## 1. Monorepo Layout

The project is a TypeScript monorepo. All sub-projects live under `packages/`. Documentation lives under `docs/`. Agent instructions live at the root (`CLAUDE.md`) and within each sub-project (`<PACKAGE_NAME>.md`).

```
/
├── CLAUDE.md                     ← Root agent instructions
├── package.json                  ← Workspace root
├── tsconfig.base.json            ← Shared TypeScript config
├── docs/                         ← Project-level documentation
├── packages/
│   ├── types/                    ← Shared types and port interfaces
│   ├── engine/                   ← Core logic layer
│   ├── sql-template/             ← Abstract SQL data store base
│   ├── adapter-sqlite/           ← SQLite adapter (Power App)
│   ├── adapter-postgres/         ← Postgres adapter (Reader App)
│   ├── power-app/                ← Desktop author application
│   └── reader-app/               ← Web/mobile reader application
```

---

## 2. Sub-Project Descriptions

### 2.1 `packages/types`

Shared TypeScript type definitions and port interface declarations. This package has **zero runtime code** — it is types only. Every other package depends on it.

Contents:
- Entity types: `Document`, `CompositionSlot`, `VariantGroup`, `VariantGroupMember`, `Tag`, `Preset`, `PresetRule`, `PresetAdHocDocument`, `DocumentHistory`.
- Port interfaces: `DataStorePort`, `OutputPort`, `AccessFilterPort`.
- Rule types: JSON rule schema (`Premise`, `Action`, `Rule`), `SelectionMap`, `Variable`.
- Result types: `Result<T, E>`, error enums.

### 2.2 `packages/engine`

The core logic layer. A pure library with zero runtime dependencies. Consumes port interfaces from `types`. Never imports any adapter, UI, or storage code.

Contents:
- Rule evaluator: takes rules + variables + data, produces a `SelectionMap`.
- Resolution walker: takes a composition ID + `SelectionMap` + `DataStorePort` + `AccessFilterPort`, produces resolved content.
- Cycle detection: validates composition references at write time.
- Validation: constraint enforcement (leaf/composition mutual exclusion, universal default, tag integrity).
- CRUD orchestration: business logic around create/update/delete operations, delegating storage to the injected `DataStorePort`.
- Query building: constructs parameterized SQL for the data store port. Splits predicates into pushdown (store-executed) and local (engine-evaluated) portions.

### 2.3 `packages/sql-template`

Abstract base implementation of the `DataStorePort` interface using SQL. Contains:
- Common SQL query templates (parameterized).
- Schema definitions (CREATE TABLE statements in a common SQL subset).
- Migration logic (schema versioning).
- An abstract connection interface that dialect adapters implement.

Does NOT contain any database driver code. Dialect adapters provide the connection.

### 2.4 `packages/adapter-sqlite`

SQLite dialect adapter. Extends `sql-template` with:
- SQLite-specific connection management (via `better-sqlite3` or `sql.js`).
- Dialect overrides where SQLite diverges from the common SQL subset.
- File-based database creation and management.

Used by: Power App.

### 2.5 `packages/adapter-postgres`

Postgres dialect adapter. Extends `sql-template` with:
- Postgres-specific connection management (via `pg`).
- Dialect overrides where Postgres diverges from the common SQL subset.
- Connection pooling.

Used by: Reader App.

### 2.6 `packages/power-app`

Desktop author application. The presentation layer for authors.

Contents:
- Markdown editor (CodeMirror or equivalent).
- Composition structural editor (slot list management).
- Variable sidebar and manual override UI.
- Preset configuration and rule builder (visual builder outputting JSON rules).
- Token estimation display.
- File system output adapter (writes resolved `.md` files).
- Local-first architecture (offline capable, no server dependency in v1).

Depends on: `types`, `engine`, `adapter-sqlite`.

### 2.7 `packages/reader-app`

Web/mobile reader application. The presentation layer for readers.

Contents:
- Server-side resolution (resolves presets per reader request).
- Access filter derived from reader profile (language, tier, preferences).
- Content delivery (resolved markdown rendered for reading).
- No composition structure exposure — readers see flat content.

Depends on: `types`, `engine`, `adapter-postgres`.

---

## 3. Dependency Graph

```
                    ┌──────────┐
                    │  types   │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          │
        ┌──────────┐ ┌─────────────┴───┐
        │  engine  │ │  sql-template   │
        └────┬─────┘ └───────┬─────────┘
             │          ┌────┴────┐
             │          │         │
             │          ▼         ▼
             │  ┌──────────┐ ┌──────────────┐
             │  │ adapter-  │ │  adapter-     │
             │  │ sqlite    │ │  postgres     │
             │  └─────┬────┘ └──────┬────────┘
             │        │             │
        ┌────┴────────┴──┐    ┌────┴──────────┐
        │   power-app    │    │  reader-app    │
        └────────────────┘    └───────────────┘
```

**Rules:**
- Arrows point from consumer to dependency.
- No package may depend on a package that is not its direct ancestor in this graph.
- `engine` and `sql-template` are siblings — neither depends on the other. They both depend on `types`.
- Product apps (`power-app`, `reader-app`) depend on `engine` + their respective adapter.
- No cross-product dependencies. `power-app` never imports from `reader-app` or vice versa.

---

## 4. Build Order

The dependency graph determines the build order. Phase boundaries indicate when prior phases must be complete and tested before the next begins.

### Phase 1: Foundation
1. `packages/types` — all entity types, port interfaces, result types, rule schema types.

### Phase 2: Engine Core
2. `packages/engine` — CRUD orchestration, validation, cycle detection, rule evaluation, resolution walker, query building. Tested with in-memory mocks of `DataStorePort`.

### Phase 3: Storage Layer
3. `packages/sql-template` — common SQL templates, schema, migrations.
4. `packages/adapter-sqlite` — SQLite dialect. Integration tested with engine.
5. `packages/adapter-postgres` — Postgres dialect. Integration tested with engine.

### Phase 4: Power App (v1 product)
6. `packages/power-app` — desktop application. End-to-end tested.

### Phase 5: Reader App (future)
7. `packages/reader-app` — web/mobile application.

**Phase 2 can begin as soon as Phase 1 is complete.** Phase 3 can begin in parallel with Phase 2 (sql-template implements the interfaces defined in Phase 1). Phase 4 requires Phases 2 and 3 (at least adapter-sqlite).

---

## 5. Cross-Cutting Concerns

### 5.1 Error Handling
All packages use the `Result<T, E>` pattern from `types`. No thrown exceptions for business logic errors. Thrown exceptions are reserved for programming bugs (invariant violations). See `docs/CONVENTIONS.md`.

### 5.2 Testing Strategy

| Package | Test Type | Runner | Notes |
|---|---|---|---|
| `types` | Type checking only | `tsc --noEmit` | No runtime tests — types only |
| `engine` | Unit tests | vitest | Mock `DataStorePort` with in-memory implementations |
| `sql-template` | Unit tests | vitest | Test SQL generation, not execution |
| `adapter-sqlite` | Integration tests | vitest | Real SQLite database (in-memory via `sql.js` or file-based) |
| `adapter-postgres` | Integration tests | vitest | Real Postgres (Docker or test instance) |
| `power-app` | Unit + E2E | vitest + Playwright | Component tests + full workflow tests |
| `reader-app` | Unit + E2E | vitest + Playwright | API tests + reader flow tests |

### 5.3 Versioning
All packages share a single version number (monorepo versioning). Bumps happen at the project level, not per-package.
