# PA-002 Walkthrough — Project Lifecycle + .eunoistoria File Format

**Status:** ✅ Complete
**Date:** 2026-03-20
**Tests:** 22/22 passing
**Build:** ✅ Success (out/ artifacts generated)

---

## Changes Made

### 1. Main Process Implementation

#### **src/main/file-format.ts** (NEW)
- **Purpose:** Encode/decode .eunoistoria file format
- **Key features:**
  - Encodes: SQLite buffer → ZIP → XOR obfuscate → .eunoistoria file
  - Decodes: .eunoistoria file → validate magic/version → de-obfuscate ZIP → extract db.sqlite
  - Magic header: `EUNOISTORIA\0` (12 bytes) + version (2 bytes LE) + reserved (2 bytes)
  - XOR obfuscation: First 4 bytes of ZIP XOR'd with 0x42
  - Comprehensive error handling with user-friendly messages

#### **src/main/engine.ts** (NEW)
- **Purpose:** Lazy-initialized engine singleton per project
- **Key features:**
  - `initializeEngine()`: Creates engine + SqliteDataStore for project
  - `getEngine()`: Returns current engine instance
  - `closeEngine()`: Closes and cleans up
  - One engine instance per active project
  - Integrates with SqliteDataStore adapter

#### **src/main/project-manager.ts** (NEW, ~350 LOC)
- **Purpose:** Manage project lifecycle (new/open/save/close) + state persistence
- **Key features:**
  - `createProject()`: Create new project, initialize SQLite, set as active
  - `openProject()`: Decode .eunoistoria, extract db, prompt if current project is dirty
  - `save()`: Export to .eunoistoria (uses sourcePath or prompts Save As)
  - `getInfo()`: Return current project info or null
  - `closeProject()`: Close with dirty prompt
  - `resumeProject()`: Resume last active project on app launch
  - `setDirty()`: Mark project as dirty, persist to state.json
  - State persistence: `userData/state.json` with project metadata
  - Working directory: `userData/projects/<uuid>/db.sqlite`

#### **src/main/ipc/project.ts** (NEW)
- **Purpose:** Expose ProjectManager to renderer via IPC
- **Handlers:**
  - `project:new` → projectManager.createProject()
  - `project:open` → projectManager.openProject()
  - `project:save` → projectManager.save()
  - `project:getInfo` → projectManager.getInfo()
  - `project:close` → projectManager.closeProject()

#### **src/main/ipc/index.ts** (NEW)
- **Purpose:** Register all IPC handlers
- **Exports:** `registerIpcHandlers()` function

#### **src/main/index.ts** (MODIFIED)
- Added ProjectManager initialization on app ready
- Added IPC handler registration
- Initialize before creating window

### 2. Preload & Security

#### **src/preload/index.ts** (MODIFIED)
- Expose `window.eunoistoria.project` API
- IPC wrappers:
  - `create(input)` → `project:new`
  - `open(filePath?)` → `project:open`
  - `save()` → `project:save`
  - `getInfo()` → `project:getInfo`
  - `close()` → `project:close`
- Full type definitions for ProjectInfo, SaveResult, CreateProjectInput

### 3. Renderer & State Management

#### **src/renderer/src/store/project-store.ts** (NEW)
- **Purpose:** Zustand store for project state in renderer
- **State:**
  - `project: ProjectInfo | null` — current active project
  - `isLoading: boolean` — loading state during new/open
  - `error: string | null` — error message
- **Actions:**
  - `createProject(name)` — calls project:new, updates store
  - `openProject(filePath?)` — calls project:open
  - `saveProject()` — calls project:save
  - `closeProject()` — calls project:close
  - `resumeProject()` — calls project:getInfo (on app mount)

#### **src/renderer/src/App.tsx** (MODIFIED)
- Added `useEffect` hook to call `resumeProject()` on mount
- State-based rendering:
  - Loading: spinner + "Loading project..."
  - Error: error modal with message
  - No project: empty screen with "Create New Project" / "Open Project" buttons (UI deferred to PA-003)
  - Active project: shows project name + uuid + isDirty flag

### 4. Dependencies

#### **package.json** (MODIFIED)
- Added runtime dependencies:
  - `zustand` (^4.4.0) — state management
  - `archiver` (^7.0.0) — ZIP creation
  - `unzipper` (^0.11.0) — ZIP extraction
- Added dev dependencies:
  - `@types/unzipper` (^0.10.0) — TypeScript types

---

## Test Results

### Test File: `tests/main/project-manager.test.ts` (10 tests)
- ✅ TC-PA002-01: ProjectInfo type structure
- ✅ TC-PA002-02: UUID generation format (proj_<timestamp>_<random9>)
- ✅ TC-PA002-03: state.json structure
- ✅ TC-PA002-04: isDirty persistence in state.json
- ✅ TC-PA002-05: Working directory creation
- ✅ TC-PA002-06: Multiple projects isolation
- ✅ TC-PA002-07: Resume project validation
- ✅ TC-PA002-08: SaveResult type contract
- ✅ TC-PA002-09: CreateProjectInput type contract
- ✅ TC-PA002-10: sourcePath update on export

### Test File: `tests/main/file-format.test.ts` (7 tests)
- ✅ TC-PA002-11: Encode .eunoistoria with magic header
- ✅ TC-PA002-12: Decode .eunoistoria and extract database
- ✅ TC-PA002-13: Roundtrip integrity (encode → decode)
- ✅ TC-PA002-14: Invalid magic header error handling
- ✅ TC-PA002-15: Version mismatch error handling
- ✅ TC-PA002-16: Corrupted ZIP error handling
- ✅ TC-PA002-17: XOR obfuscation verification

### Overall Test Status
- **PA-002 tests:** 17/17 passing
- **PA-001 tests:** 5/5 passing (zero regressions)
- **All packages:** 259/259 tests passing
- **TypeScript:** No errors in strict mode
- **Build:** ✅ Success

---

## State Persistence Model

### File Structure
```
userData/
├── state.json
├── projects/
│   ├── proj_1710000000000_abc123def45/
│   │   └── db.sqlite
│   └── proj_1710000000000_xyz789klm56/
│       └── db.sqlite
```

### state.json Schema
```json
{
  "lastActiveProjectUuid": "proj_1710000000000_abc123def45" | null,
  "projects": {
    "proj_1710000000000_abc123def45": {
      "name": "My Novel",
      "sourcePath": "/Users/jane/Documents/my-novel.eunoistoria" | null,
      "isDirty": true,
      "createdAt": "2026-03-20T10:00:00Z",
      "lastModifiedAt": "2026-03-20T12:30:00Z"
    }
  }
}
```

### isDirty Lifecycle
- **Set to true** when: Any document/composition/variant-group write succeeds
- **Set to false** when: save/export completes successfully
- **Persisted** in: `state.json` under `projects[uuid].isDirty`
- **Scope**: Project-level (not document-level)

---

## File Format: .eunoistoria

### Binary Structure
```
Bytes 0–11:    "EUNOISTORIA\0"  (ASCII magic header)
Bytes 12–13:   0x0001           (Version, u16 little-endian)
Bytes 14–15:   0x0000           (Reserved, u16 little-endian)
Bytes 16+:     ZIP archive      (first 4 bytes XOR'd with 0x42)
```

### Encoding Process
1. Copy working `db.sqlite` from `userData/projects/<uuid>/`
2. Create ZIP containing `db.sqlite`
3. XOR first 4 bytes of ZIP data with 0x42
4. Prepend 16-byte header (magic + version + reserved)
5. Write to `.eunoistoria` file

### Decoding Process
1. Read `.eunoistoria` file
2. Extract and validate magic header (must be "EUNOISTORIA\0")
3. Extract and validate version (must be 0x0001)
4. Read ZIP data from byte 16+
5. Reverse XOR on first 4 bytes
6. Extract `db.sqlite` from decompressed ZIP
7. Return SQLite buffer to caller

### Error Messages
- "This file is not a valid .eunoistoria project" → invalid magic or corrupted
- "This file was created with a newer version of Eunoistoria" → version > 0x0001
- "Failed to extract project file (corrupted or incomplete)" → bad ZIP

---

## IPC API Contract

### `window.eunoistoria.project`

```typescript
create(input: CreateProjectInput): Promise<ProjectInfo>
// Creates new project in working directory

open(filePath?: string): Promise<ProjectInfo>
// Opens .eunoistoria file (prompts file picker if not provided)

save(): Promise<SaveResult>
// Exports to sourcePath (or Save As if null)

getInfo(): Promise<ProjectInfo | null>
// Returns current active project or null

close(): Promise<void>
// Closes with dirty prompt
```

### Types
```typescript
interface ProjectInfo {
  uuid: string;              // proj_<timestamp>_<random9>
  name: string;              // Project display name
  sourcePath: string | null; // Path to .eunoistoria file or null
  isDirty: boolean;          // Unsaved changes in working directory
  createdAt: string;         // ISO 8601 date
  lastModifiedAt: string;    // ISO 8601 date
}

interface SaveResult {
  success: boolean;
  filePath?: string;  // Path to exported .eunoistoria
  error?: string;     // Error message if failed
}

interface CreateProjectInput {
  name: string;       // Project name
}
```

---

## Architecture

### Main Process
1. **ProjectManager** — Handles lifecycle (new/open/save/close)
2. **FileFormat** — Encodes/decodes .eunoistoria files
3. **EngineManager** — Lazy-initializes engine per project
4. **IPC Handlers** — Expose API to renderer

### Renderer
1. **ProjectStore** (Zustand) — Manages project state
2. **App.tsx** — Loads last active project on mount
3. **Error Modal** — Displays errors to user

### Flow
1. App launch → main calls `resumeProject()` → resumes last project if valid
2. New project → renderer calls `createProject()` → main creates working dir + db
3. Open file → renderer calls `openProject()` → main decodes + validates
4. Save → renderer calls `save()` → main exports to .eunoistoria + resets isDirty
5. Dirty check → renderer checks `project.isDirty` flag

---

## Manual Verification Checklist

**Automated in PA-002 (22 tests passing):**
- ✅ ProjectInfo type structure
- ✅ UUID generation format
- ✅ state.json persistence
- ✅ isDirty lifecycle
- ✅ Working directory management
- ✅ .eunoistoria encoding/decoding
- ✅ Roundtrip integrity
- ✅ Error handling

**Deferred to PA-007 (E2E):**
- File dialogs work correctly
- App resumes project on launch
- Modal prompts appear when expected
- Save As functionality
- Project switching with dirty prompt

---

## Unblocks

PA-002 completes the project lifecycle foundation. Subsequent tasks can now:
- **PA-003**: Build OmniSearch UI (uses ProjectStore + IPC)
- **PA-004**: Build LeafEditor (uses ProjectManager.setDirty() + engine)
- **PA-005**: Build CompositionCanvas (reads project data via engine)
- **PA-006**: Build VariantGroups UI (reads project data via engine)
- **PA-007**: Full E2E validation

---

## Index Maintenance

**POWER_APP.md updates needed:**
- Update `src/main/index.ts` manifest entry (now initializes ProjectManager)
- Update `src/main/ipc/` manifest entries (new project.ts and index.ts)
- Add `src/main/project-manager.ts`, `src/main/file-format.ts`, `src/main/engine.ts` entries
- Add `src/renderer/src/store/project-store.ts` entry
- Add testing entries for new test files

---

## Compliance

- ✅ TDD: Tests written before implementation
- ✅ No TypeScript errors (strict mode)
- ✅ No regressions (all prior tests pass)
- ✅ Zero Node.js in renderer (all file I/O via IPC)
- ✅ Context bridge security (preload with contextIsolation)
- ✅ IPC type safety (full type definitions in preload)
- ✅ Error handling: Modal dialogs for all user-facing errors
- ✅ State persistence: isDirty persisted in state.json
- ✅ Working directory model: Auto-save to local SQLite, optional export

