# Changelog

All notable changes to the Extendable Markdown Editor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning (monorepo scoped).

## [Unreleased]

### Added
- **Phase 1 Complete**: Implemented pure, functional `packages/types` interfaces for the Hexagonal Architecture Engine.
  - `entities.ts`: Defined `DataDocument` (unresolved input) and `ResolvedDocument` (output AST).
  - `rules.ts`: Defined strictly typed JSON AST structure for `Premise` and `Action`.
  - `ports.ts`: Defined `DataStorePort`, `AccessFilterPort`, and `OutputPort` interfaces.
- Initialized pnpm monorepo structure with Turborepo caching.
- Scaffolded 7 core packages: \`types\`, \`engine\`, \`sql-template\`, \`adapter-sqlite\`, \`adapter-postgres\`, \`power-app\`, \`reader-app\`.
- Set up base \`tsconfig.json\` and \`vitest.workspace.ts\`.
- Added dummy tests validating build/test pipelines across all workspaces.
- Synchronized `CLAUDE.md` and `REVIEW_AGENT_INSTRUCTIONS.md` to reflect the Antigravity agent workflow and Walkthrough artifacts.
- Authored a semantics-first `README.md` identifying the product as a Multiversal CMS.
- Initialized local git repository and linked to `origin` remote.
- **Phase 2 Complete**: Implemented the full `packages/engine` business logic layer (TYP-001–ENG-013).
  - `packages/types`: Added `crud.ts` (flat DB records, CRUD inputs, `DocumentPredicate`, `QueryPlan`, `SlotRuleContext`); expanded `DataStorePort` (40+ methods); added `engine-interface.ts` (`Engine` interface); added 6 engine error enums to `results.ts`; updated `entities.ts` (`TagId`, new `CompositionSlot` schema, `Preset.adHocDocuments`).
  - `packages/engine/src`: `token-estimation.ts`, `rule-evaluator.ts` (toggle/sort/select with type coercion D-BP-10), `cycle-detection.ts` (BFS), `validation.ts`, `resolution.ts` (recursive walker with access filter), `query-builder.ts`, plus `crud/` modules for documents, slots, variant groups, tags, and presets.
  - `packages/engine/tests`: 104 tests across 14 test files (mock data store, unit tests per module, CRUD tests, integration tests) — all passing.
  - Engine public API exposed via `createEngine(dataStore, accessFilter): Engine` factory.
- **Phase 3 Complete**: Implemented the storage layer with SQLite MVP (SQL-001–ADT-004, Postgres deferred to Phase 5).
  - `packages/sql-template`: Abstract SQL template system with schema definitions (9 tables), parameterized query builder (30+ methods supporting SQLite and Postgres syntax), and migration versioning. 66 tests passing.
  - `packages/adapter-sqlite`: SQLite adapter implementing `DataStorePort` via `better-sqlite3`. Provides full CRUD operations, transaction support with rollback, and complete DataStore interface. 61 tests passing (23 connection tests, 19 data-store tests, 18 integration tests).
  - Built on TDD: All tests created before implementation, all passing.
  - Architecture: Hexagonal (ports/adapters), zero engine dependencies on specific databases, clean separation of concerns.
  - Ready for Phase 4 (Power App) to begin using SQLite-backed storage.


### Changed
- Finalized architecture decisions in `DECISION_LOG.md`: 
  - Monorepo tooling: pnpm + turborepo
  - UI framework: React + Electron + CodeMirror 6
  - Server framework: Fastify (Serverless ready)
- Reorganized raw documentation markdown files into structured `docs/` and `packages/` directories.

### Fixed
- N/A

---

*Note for Agents: Update this file incrementally as features from the Implementation Tracker are completed.*
