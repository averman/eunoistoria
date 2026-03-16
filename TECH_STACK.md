# Technology Stack

## Extendable Markdown Editor — Technology Decisions and Rationale

---

## 1. Language

**TypeScript (strict mode)**

Rationale:
- Engine must run in both desktop (Power App) and server (Reader App) environments. TypeScript compiles to JavaScript, which runs in both.
- Strict mode with no `any` catches type errors at compile time. Critical for a project built primarily by AI agents — type safety is a guardrail.
- Port interfaces map directly to TypeScript interfaces. The hexagonal architecture is expressed naturally in the type system.

---

## 2. Engine (`packages/engine`)

**Zero runtime dependencies.**

The engine is pure TypeScript. No libraries. The rule evaluator, resolution walker, cycle detection, validation, and query builder are all hand-written. This eliminates version conflicts, supply chain risk, and context overhead for AI agents.

The engine builds parameterized SQL strings for the data store port. It does not use an ORM, query builder library, or schema management tool. SQL is a stable, well-known language that AI agents handle reliably.

---

## 3. Shared Types (`packages/types`)

**Zero runtime dependencies. Types only.**

Published as a TypeScript package with `declarations` only. No compiled JavaScript needed — consumers import types directly.

---

## 4. SQL Template (`packages/sql-template`)

**Zero runtime dependencies.** (Database drivers are adapter concerns.)

Contains:
- Parameterized SQL string builders.
- Schema DDL as string constants.
- An abstract `ConnectionPort` interface that dialect adapters implement.

The SQL template targets a common subset of SQL that both SQLite and Postgres support. Dialect differences are isolated to adapter packages.

### Known Dialect Differences

| Feature | SQLite | Postgres |
|---|---|---|
| UUID generation | `hex(randomblob(16))` or application-generated | `gen_random_uuid()` |
| Timestamp type | `TEXT` (ISO 8601 string) | `TIMESTAMPTZ` |
| JSON column | `TEXT` (with JSON functions) | `JSONB` |
| Boolean | `INTEGER` (0/1) | `BOOLEAN` |
| Full-text search | FTS5 | `tsvector` / `tsquery` |
| Upsert syntax | `INSERT OR REPLACE` / `ON CONFLICT` | `ON CONFLICT` |

Each dialect adapter overrides only the methods affected by these differences. Everything else is inherited from the template.

---

## 5. Adapters

### 5.1 `packages/adapter-sqlite`

**Runtime dependency:** `better-sqlite3` (for Node/Tauri) or `sql.js` (for browser/testing).

- Synchronous API (better-sqlite3 is sync, which simplifies the Power App's local-first model).
- File-based storage. One `.db` file per project.
- In-memory mode via `sql.js` for unit/integration testing without file I/O.

### 5.2 `packages/adapter-postgres`

**Runtime dependency:** `pg` (node-postgres).

- Async API with connection pooling.
- Server-managed database. One database per deployment, projects isolated by `project_id`.

---

## 6. Power App (`packages/power-app`)

### 6.1 Desktop Framework

**Deferred.** Candidates: Tauri, Electron.

Tauri is preferred for:
- Smaller binary size.
- Rust backend for file I/O and SQLite access.
- Better security model (no Node.js in the renderer).

Electron is the fallback if Tauri introduces friction for:
- `better-sqlite3` native module binding.
- Complex file system operations.
- Cross-platform packaging.

Decision will be recorded in `docs/DECISION_LOG.md` when implementation begins.

### 6.2 UI Framework

**Deferred.** Candidates: React, Svelte, Solid.

The UI framework choice is independent of the engine and adapters. The engine is consumed through its TypeScript API regardless of UI framework.

### 6.3 Markdown Editor Component

**Deferred.** Candidates: CodeMirror 6, Monaco Editor.

CodeMirror 6 is preferred for:
- Lighter weight.
- Better extensibility model (aligns with "extendable editor" vision).
- Mobile support (relevant for future considerations).

### 6.4 Rule Builder

**Custom visual builder.**

No DSL. No text-based rule language. The visual builder outputs JSON rule objects. The engine evaluates JSON directly. The rule schema is defined in `packages/types/`.

JSON rule format example:
```json
{
  "premise": {
    "op": "lt",
    "left": { "tag": "chapter" },
    "right": { "var": "current_chapter" }
  },
  "action": {
    "type": "sort_by",
    "params": ["summary:chapter"]
  }
}
```

The builder constructs these objects through dropdowns, tag selectors, and value inputs. Users never see or edit JSON.

---

## 7. Reader App (`packages/reader-app`)

### 7.1 Server Framework

**Deferred.** Candidates: Express, Fastify, Hono.

Lightweight framework. The server's job is simple: receive a request with reader context (language, tier, preferences), resolve a preset via the engine, return rendered content.

### 7.2 Frontend

**Deferred.** Could be server-rendered HTML, a SPA, or a native mobile app. The Reader App's frontend is the simplest part of the system — it displays resolved markdown.

---

## 8. Testing

**vitest** for all packages.

Rationale:
- Native TypeScript support.
- Fast execution.
- Compatible with both Node.js and browser-like environments.
- Same runner across all packages (consistency for AI agents).

**Playwright** for E2E tests on product apps (Power App, Reader App).

---

## 9. Monorepo Tooling

**Deferred.** Candidates: npm workspaces, pnpm workspaces, turborepo.

The choice affects build orchestration and caching but not architecture. pnpm workspaces with turborepo is the likely path for:
- Strict dependency isolation (pnpm).
- Build caching and parallel execution (turborepo).

---

## 10. Type Coercion in Rule Evaluation

The rule engine compares tag values (stored as `TEXT`) against rule operands. Coercion behavior:

1. If both sides can be parsed as numbers, compare as numbers.
2. Otherwise, compare as strings (lexicographic).

This is an explicit, documented quirk — not a bug. Tag values like `chapter:103` compare numerically. Tag values like `chapter:prologue` compare as strings. Mixed comparisons (`chapter:prologue < 103`) fall back to string comparison.

This behavior is tested exhaustively in the engine's test suite.

---

## 11. Decisions Not Yet Made

These decisions are deferred to implementation time and will be recorded in `docs/DECISION_LOG.md`:

| Decision | Candidates | Blocked By |
|---|---|---|
| Desktop framework | Tauri, Electron | Power App implementation start |
| UI framework | React, Svelte, Solid | Power App implementation start |
| Markdown editor | CodeMirror 6, Monaco | Power App implementation start |
| Server framework | Express, Fastify, Hono | Reader App implementation start |
| Monorepo tooling | npm/pnpm workspaces, turborepo | Initial monorepo setup |
| UUID generation strategy | Application-generated vs. database-generated | Adapter implementation start |
