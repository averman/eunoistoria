# Changelog — Extendable Markdown Editor

All notable changes to this project are documented here. Format: [Date] [Phase/Component] [Change Type] [Description]

---

## 2026-03-20 — Phase 4a: Power App MVP (In Progress)

### PA-FIX: SQLite Adapter listDocuments Filter
- **Type:** Bug Fix (Prerequisite)
- **Status:** ✅ Complete (66/66 tests passing)
- **Changes:**
  - Implemented `titleContains` filter in `SqliteDataStore.listDocuments()`
  - Case-insensitive substring matching on `title` and `alias` fields
  - Results prioritize title matches over alias matches
  - SQL injection protected via parameterized queries
- **Files:**
  - `packages/adapter-sqlite/src/data-store.ts` — added filter logic + sorting
  - `packages/adapter-sqlite/tests/data-store.test.ts` — 5 new test cases (TC-FIX-01 to TC-FIX-05)
- **Unblocks:** PA-003 (OmniSearch)
- **Reference:** `docs/tasks/PA-FIX-WALKTHROUGH.md`

### PA-001: Electron + Vite + React Scaffold
- **Type:** Feature (Foundation)
- **Status:** ✅ Complete (5/5 tests passing, build successful)
- **Changes:**
  - Scaffolded Electron desktop app using electron-vite
  - React 18 renderer with TypeScript strict mode
  - Tailwind CSS styling foundation
  - Context-bridge security pattern (preload + contextIsolation)
  - Hot module reloading (HMR) support
- **New Files (16):**
  - Config: `package.json`, `tsconfig.{json,node.json,web.json}`, `electron.vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.ts`
  - Main Process: `src/main/index.ts`
  - Preload: `src/preload/index.ts`
  - Renderer: `src/renderer/{index.html, src/main.tsx, src/App.tsx, src/index.css}`
  - Tests: `tests/scaffold.test.ts`
- **Dependencies Added (19):**
  - Runtime: react, react-dom, @eunoistoria/{engine, adapter-sqlite, types}
  - Dev: electron, electron-vite, vite, @vitejs/plugin-react, tailwindcss, typescript tools, vitest
- **Unblocks:** PA-002 (Project Lifecycle)
- **Reference:** `docs/tasks/PA-001-WALKTHROUGH.md`

### PA-002: Project Lifecycle + .eunoistoria File Format
- **Type:** Feature (Persistence Layer)
- **Status:** ✅ Complete (17/17 tests passing, build successful)
- **Changes:**
  - Implemented project lifecycle (new, open, save, save-as, close, resume)
  - .eunoistoria file format: magic header + version + obfuscated ZIP
  - Project-scoped isDirty flag persisted in state.json
  - Working directory model: `userData/projects/<uuid>/db.sqlite`
  - ProjectManager singleton handles lifecycle + state persistence
  - FileFormat codec for encode/decode .eunoistoria
  - EngineManager for lazy-initialized engine per project
  - IPC handlers expose project API to renderer
  - Zustand store for client-side project state
  - Error handling via modal dialogs
- **New Files (7):**
  - Main: `src/main/project-manager.ts`, `src/main/file-format.ts`, `src/main/engine.ts`
  - IPC: `src/main/ipc/project.ts`, `src/main/ipc/index.ts`
  - Renderer: `src/renderer/src/store/project-store.ts`
  - Tests: `tests/main/project-manager.test.ts`, `tests/main/file-format.test.ts`
- **Modified Files (3):**
  - `src/main/index.ts` — ProjectManager initialization + IPC registration
  - `src/preload/index.ts` — Project API exposure with full types
  - `src/renderer/src/App.tsx` — Project state handling + mount resume logic
- **Dependencies Added (3):**
  - Runtime: zustand (state management), archiver (ZIP creation), unzipper (ZIP extraction)
  - Dev: @types/unzipper (TypeScript definitions)
- **Unblocks:** PA-003 (OmniSearch), PA-004 (LeafEditor), PA-005 (Composition Canvas)
- **Reference:** `docs/tasks/PA-002-WALKTHROUGH.md`

---

## 2026-03-16 — Phase 3: Storage Layer with SQLite MVP (Complete)

### Phase 3a: SQL Template Package
- **Type:** Feature (Core Infrastructure)
- **Status:** ✅ Complete (66 tests)
- **Summary:** Schema DDL, parameterized SQL templates, migration system, connection abstraction

### Phase 3b: SQLite Adapter
- **Type:** Feature (Integration)
- **Status:** ✅ Complete (61 tests)
- **Summary:** SqliteConnection + SqliteDataStore via better-sqlite3, full CRUD implementation

---

## 2026-03-15 — Phase 2: Engine Core (Complete)

- **Type:** Feature (Business Logic)
- **Status:** ✅ Complete (127 tests)
- **Summary:**
  - TYP-001 to TYP-005: Type system updates (CRUD + validation types)
  - ENG-001 to ENG-013: Engine implementation (token estimation, rule evaluation, cycle detection, CRUD, resolution, query builder)

---

## 2026-03-15 — Phase 1: Foundation Types (Complete)

- **Type:** Feature (Type Definitions)
- **Status:** ✅ Complete
- **Summary:** Entity types, rule types, resolution types, port interfaces, error enums

---

## 2026-03-15 — Phase 0: Project Scaffolding (Complete)

- **Type:** Infrastructure
- **Status:** ✅ Complete
- **Summary:** Monorepo setup (pnpm + turborepo), sub-project scaffolding, test configuration, documentation structure

---

## Upcoming

### Phase 4a (In Progress)
- [ ] PA-002 — Project Lifecycle + .eunoistoria File Format
- [ ] PA-003 — OmniSearch Sidebar
- [ ] PA-004 — Leaf Editor (CodeMirror)
- [ ] PA-005 — Composition Canvas
- [ ] PA-006 — Variant Groups + Selector
- [ ] PA-007 — End-to-End Validation

### Phase 4b (Deferred)
- Tags + tag-based filtering UI
- Drag-and-drop reordering
- Dynamic presets + visual rule builder
- Rule evaluation + token estimation display
- Document history + rollback
- Right sidebar (preset configurator)

### Phase 5 (Deferred)
- Postgres adapter implementation
- Reader App (Fastify backend)
- Web/mobile frontend for reader distribution

---

## Key Metrics

| Phase | Tests | Status | Date |
|---|---|---|---|
| Phase 0 | — | ✅ | 2026-03-15 |
| Phase 1 | — | ✅ | 2026-03-15 |
| Phase 2 | 127 | ✅ | 2026-03-15 |
| Phase 3 | 127 | ✅ | 2026-03-20 |
| Phase 4a (PA-FIX) | 66 | ✅ | 2026-03-20 |
| Phase 4a (PA-001) | 5 | ✅ | 2026-03-20 |

**Total Tests Passing:** 325+ (across all completed phases and tasks)
