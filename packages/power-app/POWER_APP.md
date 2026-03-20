# POWER_APP.md — Power App Sub-Project Spec

## Extendable Markdown Editor — Desktop Author Application

---

## 1. Purpose

The Power App is a local-first Electron desktop application for authors. Users create documents, compose them into hierarchical structures, manage variant groups, and export resolved markdown for AI context assembly or distribution.

This package is the **Presentation Layer** and the only product application in Phase 4a (Reader App is Phase 5).

The app works on a **working directory model**: authors work in a persistent SQLite database stored locally, and optionally export projects as `.eunoistoria` files (compressed + obfuscated archives).

---

## 2. Dependencies

- **Imports from:** `@eunoistoria/engine`, `@eunoistoria/adapter-sqlite`, `@eunoistoria/types`
- **Imported by:** None (product application, not imported)
- **Runtime dependencies:**
  - Electron (desktop framework)
  - React 18 (UI framework)
  - Zustand (state management)
  - CodeMirror 6 (markdown editor)
  - Radix UI (component primitives)
  - Tailwind CSS (styling)
  - archiver (zip creation)
  - unzipper (zip extraction)
  - better-sqlite3 (via adapter-sqlite)
- **Dev dependencies:** electron-vite, vite, @vitejs/plugin-react, tailwindcss, @types packages

---

## 3. Architecture

### Main Process

Runs in Electron main thread:
- **Engine**: Singleton instance of the engine with `SqliteDataStore` adapter
- **Project Manager**: Lifecycle management (new, open, save, export)
- **File Format**: Encode/decode `.eunoistoria` archives
- **IPC Handlers**: Expose engine operations and file I/O to renderer

### Preload Script

Secure context bridge. Exposes `window.eunoistoria` API:
- `project` — new/open/save/saveAs/getInfo
- `documents` — create/get/update/delete/list/search
- `compositions` — listSlots/addSlot/removeSlot/reorderSlots/resolve
- `variantGroups` — list/create/delete/getMembers/addMember/removeMember/reorderMembers

### Renderer (React)

UI layer running in sandboxed BrowserWindow:
- **Layout**: Three-pane shell (left sidebar, main area, right sidebar)
- **Left Sidebar**: OmniSearch (collapsible)
- **Main Area**: Context-aware editor (leaf editor, composition canvas)
- **Right Sidebar**: Off by default (future: preset configurator)

### State Management (Zustand)

Three independent stores:
- **project-store**: Current project info (id, name, sourcePath, isDirty, isLoading)
- **editor-store**: Open document, composition state, variant selections, resolved content
- **search-store**: Search query, results, loading state

---

## 4. User Workflows (Phase 4a MVP)

### New Project
1. Cmd+N or File → New
2. Dialog: enter project name
3. App creates working directory, initializes SQLite, shows empty app

### Author Leaf Documents
1. File → New → Document
2. CodeMirror editor opens, user writes markdown
3. Auto-saves every 500ms

### Build Composition
1. File → New → Composition
2. Canvas view with [+] buttons
3. Click [+] → pick document or variant group to insert
4. Reorder via up/down arrows
5. See live preview of each slot

### Use Variant Groups
1. File → New → Variant Group
2. Add documents as members (position 0 = default)
3. In composition, slot pointing to group shows dropdown
4. Click dropdown → Radix Popover lists members → select one
5. Composition re-renders with selected variant

### Resolve & View
1. Click "Resolve" button in composition canvas
2. Shows flat markdown output in read-only panel
3. Shows estimated token count

### Export Project
1. Cmd+S or File → Export
2. File dialog
3. Write `.eunoistoria` file (doesn't change working directory)
4. Can be reopened later or shared

### Reopen Project
1. File → Open or Cmd+O
2. File picker → select `.eunoistoria`
3. App decodes, extracts, creates new working directory, resumes
4. If current project is dirty, prompts to save first

---

## 5. Public API (IPC Bridge)

All renderer-to-main communication goes through `window.eunoistoria.*` (defined in preload script).

### window.eunoistoria.project
```typescript
create(): Promise<ProjectInfo>
open(filePath: string): Promise<ProjectInfo>
save(): Promise<SaveResult>      // save to sourcePath (or Save As if null)
getInfo(): ProjectInfo | null
close(): Promise<void>           // explicit close (with save prompt)
```

### window.eunoistoria.documents
```typescript
create(input: CreateDocumentInput): Promise<DocumentRecord>
get(id: string): Promise<DocumentRecord>
update(id: string, changes: UpdateDocumentInput): Promise<DocumentRecord>
delete(id: string): Promise<void>
list(filters?: DocumentFilters): Promise<DocumentRecord[]>
search(query: string): Promise<DocumentRecord[]>   // title + alias search
```

### window.eunoistoria.compositions
```typescript
listSlots(compositionId: string): Promise<CompositionSlot[]>
addSlot(compositionId: string, input: CreateSlotInput): Promise<CompositionSlot>
removeSlot(slotId: string): Promise<void>
reorderSlots(compositionId: string, orderedSlotIds: string[]): Promise<void>
resolve(compositionId: string): Promise<string>    // default variants, flat markdown
```

### window.eunoistoria.variantGroups
```typescript
list(): Promise<VariantGroupRecord[]>
create(input: CreateVariantGroupInput): Promise<VariantGroupRecord>
delete(id: string): Promise<void>
getMembers(groupId: string): Promise<VariantGroupMemberRecord[]>
addMember(groupId: string, documentId: string): Promise<VariantGroupMemberRecord>
removeMember(groupId: string, documentId: string): Promise<void>
reorderMembers(groupId: string, orderedDocumentIds: string[]): Promise<void>
```

---

## 6. File Manifest

| File | Owns | Estimated Tokens |
|---|---|---|
| **Main Process** |
| `src/main/index.ts` | Electron app entry, BrowserWindow setup, IPC registration | ~300 |
| `src/main/window.ts` | BrowserWindow lifecycle, menu bar | ~200 |
| `src/main/engine.ts` | Engine + adapter singleton, lazy initialization | ~150 |
| `src/main/project-manager.ts` | Project lifecycle (new/open/save), state.json management | ~500 |
| `src/main/file-format.ts` | `.eunoistoria` encode/decode, zip handling | ~300 |
| `src/main/ipc/index.ts` | Registers all IPC handlers | ~100 |
| `src/main/ipc/project.ts` | project:* IPC handlers | ~200 |
| `src/main/ipc/documents.ts` | document:* IPC handlers | ~250 |
| `src/main/ipc/compositions.ts` | composition:* IPC handlers | ~200 |
| `src/main/ipc/variant-groups.ts` | variantGroup:* IPC handlers | ~200 |
| **Preload** |
| `src/preload/index.ts` | contextBridge.exposeInMainWorld | ~200 |
| **Renderer (React)** |
| `src/renderer/src/main.tsx` | React root entry | ~50 |
| `src/renderer/src/App.tsx` | Root layout, app state management, routing | ~300 |
| `src/renderer/src/store/project-store.ts` | Zustand project state | ~150 |
| `src/renderer/src/store/editor-store.ts` | Zustand editor state | ~200 |
| `src/renderer/src/store/search-store.ts` | Zustand search state | ~100 |
| `src/renderer/src/components/layout/AppLayout.tsx` | Three-pane shell, layout management | ~250 |
| `src/renderer/src/components/layout/LeftSidebar.tsx` | Collapsible sidebar, contains OmniSearch | ~150 |
| `src/renderer/src/components/search/OmniSearch.tsx` | Search input, results list, document selection | ~200 |
| `src/renderer/src/components/editor/LeafEditor.tsx` | CodeMirror 6 integration, autosave | ~300 |
| `src/renderer/src/components/editor/CompositionCanvas.tsx` | Workflow builder, slot rendering, resolve | ~400 |
| `src/renderer/src/components/shared/SlotItem.tsx` | Individual slot card, controls | ~200 |
| `src/renderer/src/components/shared/AddSlotButton.tsx` | [+] button, document/group picker | ~150 |
| `src/renderer/src/components/variant/VariantPopup.tsx` | Radix Popover, variant selector | ~150 |
| `src/renderer/src/lib/ipc.ts` | Typed wrapper for window.eunoistoria | ~100 |
| **Tests** |
| `tests/main/project-manager.test.ts` | Project lifecycle tests | ~300 |
| `tests/main/file-format.test.ts` | Encode/decode roundtrip tests | ~200 |

**Total estimated context:** ~6,500 tokens

---

## 7. Key Design Constraints

1. **No Node.js in renderer.** All file I/O and engine access goes through IPC.
2. **Working directory is persistent.** Projects are always auto-saved to working dir; export is optional.
3. **Zustand stores are independent.** No cross-store dependencies; communication via IPC callbacks.
4. **No rules in Phase 4a.** Dynamic presets and rule evaluation deferred to Phase 4b.
5. **No tags in Phase 4a.** Tag UI deferred to Phase 4b.
6. **OmniSearch is title + alias only.** Full-text body search deferred to Phase 4b.

---

## 8. Testing Strategy

| Layer | Approach | Files |
|---|---|---|
| Main process (lifecycle, file format) | vitest unit tests with mock fs | `tests/main/*.test.ts` |
| IPC handlers | vitest with mock engine | (integration tested via E2E) |
| Renderer components | Not tested in Phase 4a (visual, MVP) | (manual walkthrough only) |
| End-to-end | Manual workflow test | See PA-007 task spec |

---

## 9. Out of Scope (Phase 4a)

- Tags and tag-based filtering
- Dynamic presets and rule builder
- Rule evaluation and token estimation UI
- Drag-and-drop reordering (use arrow buttons for MVP)
- Document history and rollback
- Full-text body search
- Right sidebar (preset configurator)
- Cloud sync or auto-backup
- Real-time collaboration

These are Phase 4b+ features.
