# Decision Log

## Extendable Markdown Editor — Architectural and Feature Decisions

---

Record decisions here as they are made. Each entry is immutable once recorded. If a decision is reversed, add a new entry referencing the original.

Format:
```
### [ID] [Short Title]
- **Date:** YYYY-MM-DD
- **Context:** [What prompted this decision]
- **Decision:** [What was decided]
- **Rationale:** [Why]
- **Alternatives considered:** [What else was on the table]
- **Consequences:** [What this enables or constrains]
```

---

## Decisions

### DEC-001 Rule System: JSON Objects, Not DSL
- **Date:** 2026-03-15
- **Context:** The rule engine needs a way for users to author rules (`where <premise> do <action>`). Options ranged from a text-based DSL with a parser to JS eval to parameterized JSON with a visual builder.
- **Decision:** Rules are parameterized JSON objects. A visual builder in the UI constructs them. The engine evaluates JSON directly by recursively matching on the `op` field. No parser, no grammar, no eval.
- **Rationale:** A DSL requires building and maintaining a parser — significant effort for a system where the target users are novelists, not programmers. JS eval opens a security surface, especially for the Reader App where rules evaluate against reader-provided variables. JSON objects are trivially serializable, storable as JSONB/TEXT, and the evaluator is a simple recursive function.
- **Alternatives considered:**
  - Text DSL with custom parser — too much build effort, too much to learn for users.
  - JS eval / Function constructor — security risk, especially in Reader App.
  - Parameterized functions without JSON — less flexible, harder to store and transmit.
- **Consequences:** The UI must include a visual rule builder. Users never see JSON. The rule schema is a type definition in `packages/types/`. The engine has no string parsing code.

### DEC-002 Type Coercion: Number-First, String Fallback
- **Date:** 2026-03-15
- **Context:** Tag values are stored as TEXT. Rules perform comparisons like `tag(chapter) < 103`. Need a coercion strategy.
- **Decision:** When comparing two values, attempt numeric parsing first. If both sides parse as numbers, compare numerically. Otherwise, compare as strings (lexicographic).
- **Rationale:** This is a content tool, not a programming language. A simple, predictable quirk is acceptable. The alternative — a type system on tags — adds complexity with no proportional benefit for the target users.
- **Alternatives considered:**
  - Explicit type annotations on tags — too complex for users.
  - Always string comparison — breaks numeric ordering (e.g., "9" > "10" lexicographically).
  - Separate numeric and string tag value columns — schema complexity for little gain.
- **Consequences:** Documented as explicit behavior, not a bug. Exhaustive test coverage in the engine. Mixed comparisons (e.g., `"prologue" < 103`) fall back to string comparison.

### DEC-003 Hexagonal Architecture with Ports for All External Dependencies
- **Date:** 2026-03-15
- **Context:** The engine must serve two products (Power App, Reader App) with different storage backends, access models, and output targets.
- **Decision:** The engine defines port interfaces for all external dependencies: data store, access filter, and output. The engine has zero concrete dependencies. Adapters implement ports for specific backends.
- **Rationale:** Enables the same engine to serve both products without conditional logic. Enables testing with in-memory mocks. Ensures the engine remains a pure, testable library.
- **Alternatives considered:**
  - Direct SQLite integration in the engine with a Postgres wrapper — couples the engine to a specific storage technology.
  - Abstract repository pattern per entity — more interfaces than necessary for the current use case.
- **Consequences:** Every external interaction goes through a port. The engine cannot import database drivers, file system APIs, or HTTP libraries. Adapters are separate packages.

### DEC-004 Engine Builds SQL, Adapters Execute It
- **Date:** 2026-03-15
- **Context:** The data store port needs to support both SQLite and Postgres. Options: abstract query specification language, raw SQL, or ORM.
- **Decision:** The engine builds parameterized SQL strings. An abstract SQL template base (`packages/sql-template`) handles 95% of the work. Dialect adapters extend it for SQLite/Postgres differences. The port essentially receives `execute(query, params)`.
- **Rationale:** Both target databases speak SQL. Building an abstract filter specification language is reimplementing a worse version of SQL. ORMs add dependencies and abstraction layers that complicate debugging. Raw parameterized SQL is simple, transparent, and AI agents handle it reliably.
- **Alternatives considered:**
  - Abstract filter spec that adapters translate to native queries — significant build effort for an abstraction that maps 1:1 to SQL anyway.
  - ORM (Prisma, Drizzle, etc.) — adds runtime dependencies to the engine, complicates testing, abstracts away query control.
  - Dumb port with in-memory engine filtering — doesn't scale for Reader App.
- **Consequences:** The engine is coupled to SQL (but not to any specific SQL dialect). In-memory testing requires `sql.js` or similar. The sql-template package maintains schema DDL and common query patterns. Dialect differences are documented and isolated.

### DEC-005 Predicate Pushdown: Engine Decides, Store Executes
- **Date:** 2026-03-15
- **Context:** Rule evaluation involves filtering documents by tag values, which could be done in-memory (engine fetches everything) or pushed to the database.
- **Decision:** The engine inspects each predicate and determines whether it can be pushed down to the data store (simple tag comparisons, document properties) or must be evaluated locally (variable references, cross-entity conditions, results of prior rule evaluations). Pushdown predicates become SQL WHERE clauses. Local predicates are evaluated in-memory on the reduced result set.
- **Rationale:** Full in-memory filtering works for v1 (small datasets, single author). But the architecture should not paint itself into a corner. By making pushdown a capability of the engine from the start, the Reader App can benefit from database-level filtering without engine redesign.
- **Alternatives considered:**
  - Always fetch everything, filter in-memory — doesn't scale for Reader App.
  - Always pushdown everything — not possible for variable-dependent predicates.
- **Consequences:** The engine has query-planning logic. The SQL template must support dynamic WHERE clause construction from pushdown predicates. Testing must cover both pushdown and local evaluation paths.

### DEC-006 AI-Native Project Structure
- **Date:** 2026-03-15
- **Context:** This project is built by AI agents with a single human owner. The project structure must optimize for agent effectiveness, not human developer ergonomics.
- **Decision:** The project uses a layered context system with explicit loading protocols. Root `CLAUDE.md` is a router (~2k tokens). Sub-project specs contain scoped context. File manifests index contents with token cost estimates. Agents follow prescribed context loading paths, never free-browse.
- **Rationale:** AI agents have limited context windows. Without structure, an agent either loads too much (wasting tokens, losing focus) or too little (missing dependencies, making incorrect assumptions). Prescribed loading paths ensure consistent, efficient context use across all agent sessions.
- **Alternatives considered:**
  - Flat documentation with agents deciding what to read — inconsistent behavior between sessions.
  - Minimal documentation with agents inferring from code — works for small projects, breaks at this scale.
- **Consequences:** Every sub-project needs a maintained spec + manifest. Index maintenance is an explicit protocol (in `CLAUDE.md`). Three-stage pipeline (dev agent → review agent → owner) ensures quality. Feature lifecycle is documented and rigid.

### DEC-007 Three-Stage Review Pipeline
- **Date:** 2026-03-15
- **Context:** With AI agents as developers, code review is critical but the owner cannot review every line efficiently.
- **Decision:** Three stages: dev agent implements, review agent validates against task spec and conventions, owner makes final judgment on the review agent's report.
- **Rationale:** The review agent pre-filters the diff. The owner reads a structured report, not raw code. This lets the owner focus on judgment (is this the right approach?) rather than verification (did it follow the conventions?). The review agent catches mechanical errors. The owner catches design errors.
- **Alternatives considered:**
  - Owner reviews all code directly — doesn't scale with project size.
  - Single agent self-reviews — no independent verification.
  - Automated linting only — catches syntax but not behavioral correctness.
- **Consequences:** Review agent needs its own instruction set (`docs/REVIEW_AGENT_INSTRUCTIONS.md`). Task specs must be precise enough for the review agent to validate against. The pipeline adds latency but reduces defect rate.

### DEC-008 Monorepo Tooling: pnpm + turborepo
- **Date:** 2026-03-16
- **Context:** Deciding on workspace management tooling for the monorepo.
- **Decision:** Use pnpm workspaces and turborepo.
- **Rationale:** Strict dependency isolation and aggressive caching for build/test pipelines.
- **Alternatives considered:** npm workspaces, yarn.
- **Consequences:** The project uses `pnpm-workspace.yaml` and `turbo.json`. All commands are orchestrated via `turbo run`.

### DEC-009 Power App Framework Stack
- **Date:** 2026-03-16
- **Context:** Deciding on the UI and desktop framework for the author app.
- **Decision:** React for UI, Electron for desktop, CodeMirror 6 for the markdown editor.
- **Rationale:** React is well-supported. Electron is proven for complex desktop environments. CodeMirror 6 fits the required composability for markdown slots.
- **Alternatives considered:** Svelte/Solid for UI, Tauri for desktop, Monaco for the editor.
- **Consequences:** `packages/power-app` will be scaffolded as an Electron/React app relying on CodeMirror 6.

### DEC-010 Reader App Server Framework
- **Date:** 2026-03-16
- **Context:** Deciding on the server framework for the reader distribution.
- **Decision:** Fastify, structured to be easily portable to AWS Lambda / Google Cloud Functions.
- **Rationale:** Fastify is lightweight and has excellent serverless adapter support (`@fastify/aws-lambda`).
- **Alternatives considered:** Express, Hono.
- **Consequences:** `packages/reader-app` will expose a fastify app that can be bundled for a serverless runtime.

### DEC-011 Pure Logic-Layer Domain Models (No SQL Relational Mapping)
- **Date:** 2026-03-16
- **Context:** Defining the strict Engine contracts (`packages/types`) based on the DB ERD schema. Needed to decide whether Engine types should mirror relational tables (with foreign keys like `projectId` and `color` properties intended for UI).
- **Decision:** The Engine types are completely decoupled from SQL schemas. They use deeply nested topologies (`DataDocument` matching Input with abstract `CompositionSlot` pointers, and `ResolvedDocument` outputting a unified tree algorithm AST). Structural types eliminate all database cruft and presentation state.
- **Rationale:** A Hexagonal Architecture demands a pure core domain. If the Engine includes SQL foreign keys or table join constructs in its logical evaluation memory, it breaks the separation of concerns. Data Adapters are strictly responsible for doing the SQL JOINs to build and hydrate these topological `DataDocument` trees before sending them to the Engine.
- **Alternatives considered:** 1:1 ERD mapping (SQL-like DTOs). Rejected because it requires the Engine to understand relational lookups and boolean discriminators instead of just evaluating trees natively.
- **Consequences:** Adapters bear the burden of translating relational tables into AST structures. Engine types can safely use TypeScript string literals for dispatch without caring how they are stored.

### DEC-012 Phase 3 MVP: SQLite Only, Postgres Deferred to Phase 5
- **Date:** 2026-03-20
- **Context:** Phase 3 includes both storage adapters (SQLite and Postgres). Scope question: build both in parallel or sequence?
- **Decision:** Build SQLite only for Phase 3 (MVP). Defer Postgres to Phase 5 (Reader App phase). Phase 4 (Power App) unblocks immediately with SQLite support.
- **Rationale:** Power App MVP only needs local-first storage. SQLite alone unblocks Power App development. Postgres is a future-proof design choice already baked into the architecture; deferring it doesn't paint us into a corner. Reader App (Phase 5) naturally maps to Postgres. Focusing on one implementation reduces Phase 3 scope and accelerates MVP delivery.
- **Alternatives considered:** Build both in parallel (adds ~20-30 hours to Phase 3). Build Postgres first (doesn't unblock Power App).
- **Consequences:** `packages/adapter-postgres` remains scaffolded but unimplemented. Phase 5 task is to implement Postgres by cloning/adapting the sqlite adapter. `packages/sql-template` is fully agnostic (parameterized with `?` for SQLite, supports `$n` for Postgres via configuration).

### DEC-013 SQLite Adapter: better-sqlite3 Over sql.js
- **Date:** 2026-03-20
- **Context:** Two mature SQLite options for Node: `better-sqlite3` (native binding, synchronous) and `sql.js` (WASM, purely JS).
- **Decision:** Use `better-sqlite3` for Power App development.
- **Rationale:** `better-sqlite3` offers native performance and simpler semantics (sync API). WASM (`sql.js`) is useful for testing (in-memory, no I/O), but production Power App benefits from native speed. The adapter can support both via a connection abstraction; tests use `:memory:` with `better-sqlite3`.
- **Alternatives considered:** sql.js only (portability, pure JS); hybrid (better-sqlite3 for desktop, sql.js for testing).
- **Consequences:** Phase 3 uses `better-sqlite3`. Tests run against in-memory SQLite. Future work: add optional sql.js variant for cross-platform browser-based testing.

### DEC-014 ID Generation: Timestamp + Random Suffix, Not UUIDs (v1 MVP)
- **Date:** 2026-03-20
- **Context:** Eunoistoria entities (documents, slots, etc.) need globally unique IDs. Options: UUIDs (standard), timestamps, snowflakes, database auto-increment, or application-generated.
- **Decision:** For Phase 3 MVP: timestamp (milliseconds) + random suffix. Format: `doc_${Date.now()}_${random9chars}`. Upgrade to UUIDs for Phase 5 / production.
- **Rationale:** Timestamps are human-readable in logs and databases (useful for debugging). Random suffix prevents collisions in the rare case of simultaneous creation. No additional dependencies. Simple to understand and trace. Fine for the local-first MVP.
- **Alternatives considered:** UUIDs v4 (standard but unreadable). Snowflakes (adds complexity). Database sequence IDs (couples application to SQL schema). NanoID (adds dependency).
- **Consequences:** IDs are 28-char strings, not 36-char UUIDs. Logs are more readable. For Reader App (Phase 5) with potential horizontal scaling, UUIDs should be adopted. Migration path: generate UUIDs on export, or re-ID at phase boundary.
