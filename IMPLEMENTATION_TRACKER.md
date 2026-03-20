# Implementation Tracker

This document breaks down the "Extendable Markdown Editor" project architecture into actionable phases for AI agents. 

Agents must mark items as `[x]` when verified complete, and track major milestones in `CHANGELOG.md`.

## ✅ Phase 0: Project Scaffolding
- [x] Initialize Monorepo (pnpm + turborepo).
- [x] Scaffold sub-projects (`types`, `engine`, `sql-template`, `adapter-*`, `power-app`, `reader-app`).
- [x] Configure base testing (`vitest`) and strict `tsc` configurations.
- [x] Sync `CLAUDE.md` context loading and agent workflows.
- [x] Author core `README.md` and structure `docs/` folder.
- [x] Initialize Git repository and link remote origin.

---

## ✅ Phase 1: Foundation (`packages/types`)
*Zero runtime code. Strict type definitions matching `docs/ERD.md` and `docs/DESIGN.md`.*

- [x] Define **Entity Types**: `Document`, `CompositionSlot`, `VariantGroup`, `Tag`, `Preset` (updated per Domain Model Iteration 8).
- [x] Define **Rule Types**: `Premise`, `Action`, `Operand`, `SortKey` (JSON schema AST).
- [x] Define **Resolution Types**: `SelectionMap`, `VariableMap`.
- [x] Define **Utility Types**: `Result<T,E>` and error enums.
- [x] Define **Port Interfaces**: `DataStorePort`, `AccessFilterPort`, `OutputPort`.

---

## ✅ Phase 2: Engine Core (`packages/engine`)
*Pure TypeScript business logic. Mock `DataStorePort` with in-memory tests.*
*Full task specs: `docs/tasks/TYP-001` through `ENG-013` (see `docs/TASK_BREAKDOWN_P2_P3.md` for overview).*

- [x] **TYP-001** Update Entity Types (`CompositionSlot`, `Preset`, add `TagId`)
- [x] **TYP-002** Add CRUD & Auxiliary Types (`DocumentRecord`, input types, `SlotRuleContext`, `DocumentPredicate`, etc.)
- [x] **TYP-003** Add Engine Error Enums (`DocumentError`, `SlotError`, `VariantGroupError`, `TagError`, `PresetError`, `ValidationError`)
- [x] **TYP-004** Expand `DataStorePort` (full CRUD + `queryDocuments`)
- [x] **TYP-005** Add `Engine` Interface to `packages/types`
- [x] **ENG-001** Mock DataStore test helper (`tests/helpers/mock-data-store.ts`)
- [x] **ENG-002** Token Estimation (`src/token-estimation.ts`)
- [x] **ENG-003** Rule Evaluator (`src/rule-evaluator.ts`)
- [x] **ENG-004** Cycle Detection (`src/cycle-detection.ts`)
- [x] **ENG-005** Validation Module (`src/validation.ts`)
- [x] **ENG-006** Resolution Walker (`src/resolution.ts`)
- [x] **ENG-007** Query Builder (`src/query-builder.ts`)
- [x] **ENG-008** CRUD: Documents (`src/crud/documents.ts`)
- [x] **ENG-009** CRUD: Slots (`src/crud/slots.ts`)
- [x] **ENG-010** CRUD: Variant Groups (`src/crud/variant-groups.ts`)
- [x] **ENG-011** CRUD: Tags (`src/crud/tags.ts`)
- [x] **ENG-012** CRUD: Presets (`src/crud/presets.ts`)
- [x] **ENG-013** Engine Public API — `createEngine` factory (`src/index.ts`)

---

## ✅ Phase 3: Storage Layer (SQLite MVP)
*Database interaction through the `DataStorePort`. Postgres deferred to Phase 5.*

*Full task specs: `docs/tasks/SQL-001` through `ADT-002` completed.*

**Part A: `packages/sql-template`** ✅
- [x] **SQL-001** Schema DDL — all 9 `CREATE TABLE` + indexes + constraints
- [x] **SQL-002** Connection Interface (`SqlConnection` abstract, `Row`, Transaction support)
- [x] **SQL-003** Query Builder — 30+ parameterized SQL templates (SQLite/Postgres compatible)
- [x] **SQL-004** Migration System — versioned schema migrations with rollback
- [x] **SQL-005** Full test suite — 66 tests (schema, queries, migrations, connection)

**Part B: SQLite Adapter** ✅
- [x] **ADT-001** `packages/adapter-sqlite` — `SqliteConnection` + `SqliteDataStore` (via `better-sqlite3`)
- [x] **ADT-002** Full test suite — 61 tests (connection, data store, integration workflows)
- [x] **ADT-003** Index API exports (`src/index.ts`)
- [x] **ADT-004** Type declarations and dependency management (`package.json`, `@types/better-sqlite3`)

**Part C: Postgres Adapter** (Deferred to Phase 5)
- [ ] **ADT-005** `packages/adapter-postgres` — PostgresConnection + PostgresDataStore
- [ ] **ADT-006** Postgres integration test suite

---

## ⏳ Phase 4: Power App (`packages/power-app`)
*Desktop application using React + Electron.*

### Phase 4a: MVP (Basic Authoring + Composition + Variant Selection)
*Electron + React + Zustand. Working directory model (game engine paradigm). OmniSearch (title+alias). Visual composition canvas. Basic resolution (no rules).*

**Sub-tasks:**
- [x] **PA-FIX** Fix `adapter-sqlite` `listDocuments` `titleContains` filter (prerequisite for omnisearch)
- [x] **PA-001** Scaffold Electron + Vite + React + dependencies
- [ ] **PA-002** Project lifecycle (new, open, save, save-as) + `.eunoistoria` file format
- [ ] **PA-003** OmniSearch sidebar (title + alias search, results list)
- [ ] **PA-004** Leaf editor (CodeMirror 6 markdown editor with autosave)
- [ ] **PA-005** Composition canvas (visual workflow builder, [+] buttons, slot items, resolve)
- [ ] **PA-006** Variant groups + variant selector popup (Radix Popover)
- [ ] **PA-007** End-to-end validation + `POWER_APP.md` spec

### Phase 4b: Power User Features (Future)
- [ ] Tags + tag assignment UI
- [ ] Drag-and-drop reordering (slots and variant members)
- [ ] Dynamic presets + visual rule builder
- [ ] Rule evaluation + token estimation display
- [ ] Document history + rollback
- [ ] Right sidebar (preset configurator)

---

## ⏳ Phase 5: Reader App (`packages/reader-app`)
*Serverless-ready Fastify setup.*

- [ ] Scaffold Fastify application.
- [ ] Build HTTP endpoints to resolve and query presets.
- [ ] Implement `AccessFilterPort` matching Reader Profile tiers/variables against DB state.
- [ ] (Optional Desktop/Web Frontend) Implement read-only markdown rendering.

---

### Agent Work Protocol
1. Open this file before starting the next phase.
2. Build tests before implementation (TDD).
3. Upon completion of a file or module, log it in `CHANGELOG.md` and check the box here.
4. Notify the user to review progress after major phase boundaries.
