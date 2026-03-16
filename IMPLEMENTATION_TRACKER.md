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

## 🏃 Phase 1: Foundation (`packages/types`)
*Zero runtime code. Strict type definitions matching `docs/ERD.md` and `docs/DESIGN.md`.*

- [ ] Define **Entity Types**: `Document`, `CompositionSlot`, `VariantGroup`, `VariantGroupMember`, `Tag`.
- [ ] Define **Rule & Preset Types**: `Preset`, `PresetRule` (JSON schema), `PresetAdHocDocument`.
- [ ] Define **Resolution Types**: `SelectionMap`, `Variable`.
- [ ] Define **Utility Types**: `Result<T,E>` and error enums.
- [ ] Define **Port Interfaces**: `DataStorePort`, `AccessFilterPort`, `OutputPort`.

---

## ⏳ Phase 2: Engine Core (`packages/engine`)
*Pure TypeScript business logic. Mock `DataStorePort` with in-memory tests.*

- [ ] Implement **CRUD Orchestration**: Create, update, delete for all core entities (delegating to port).
- [ ] Implement **Validation & Cycle Detection**: Mutual exclusion of leaf/composition content, universal default checks, and circular reference prevention.
- [ ] Implement **Rule Evaluator**: Takes JSON rules, variables, and tags -> produces `SelectionMap`.
- [ ] Implement **Resolution Walker**: Walks `CompositionSlot` tree using a `SelectionMap` and `AccessFilterPort` -> produces flat `.md`.
- [ ] Implement **Query Builder**: Translates Engine predicate parameters into a pushdown/local evaluation plan.

---

## ⏳ Phase 3: Storage Layer
*Database interaction through the `DataStorePort`.*

**Part A: `packages/sql-template`**
- [ ] Define base DDL creation strings across common SQL.
- [ ] Implement parameterized SQL query templates.
- [ ] Create an abstract connection interface for dialects.

**Part B: Dialect Adapters**
- [ ] Implement `packages/adapter-sqlite` (SQLite overrides, file/memory persistence via `better-sqlite3` and `sql.js`).
- [ ] Write Integration test suite linking `engine` with `adapter-sqlite`.
- [ ] Implement `packages/adapter-postgres` (Postgres overrides, connection pooling via `pg`).
- [ ] Write Integration test suite linking `engine` with `adapter-postgres`.

---

## ⏳ Phase 4: Power App (`packages/power-app`)
*Desktop application using React + Electron.*

- [ ] Initialize Electron + React window scaffolding.
- [ ] Build **Project Browser** (Tag-based unified file tree viewer).
- [ ] Build **Leaf Editor** (CodeMirror 6 integration for prose markdown).
- [ ] Build **Composition Builder** (Drag-and-drop slot lists, visual broken reference handling).
- [ ] Build **Preset Configurator** (Visual Rule builder outputting JSON rules, variable state panel, token estimation display).
- [ ] Integrate File System output adapter to export `.md`.

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
