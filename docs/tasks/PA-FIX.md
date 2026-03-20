# Task Spec: PA-FIX Adapter SQLite listDocuments titleContains Filter

## 1. Assignment

- **Sub-project:** `packages/adapter-sqlite`
- **Branch:** `fix/adapter-sqlite-list-documents-filter`
- **Depends on:** None (Phase 3 already complete)
- **Blocked by:** None

## 2. Objective

Fix the `listDocuments` method in `SqliteDataStore` to properly support the `titleContains` filter option from `DocumentFilters`. This enables omnisearch (PA-003) to work correctly by allowing case-insensitive LIKE queries on both title and alias fields.

## 3. Behavior

- The `listDocuments(projectId, filters?)` method must respect the `titleContains` field in the `filters` parameter.
- When `filters.titleContains` is provided, the query must return documents where either the `title` OR `alias` contains the substring (case-insensitive).
- Title matches should have higher priority/weight in the results (if you implement a secondary sort).
- The query must remain a **single database query** (not multiple queries merged in memory).
- Existing behavior for other filters (`isComposition`) must not change.

## 4. Interface Changes

- [ ] No interface changes required. (Implement the existing signature correctly.)

## 5. Test Cases

1. **titleContains: searches title field** — given a project with documents titled ["Chapter 1", "Introduction", "Chapter 2"], when searching with `titleContains: "chapter"`, then results contain "Chapter 1" and "Chapter 2" (case-insensitive).
2. **titleContains: searches alias field** — given a project with documents having aliases ["ch1, scene1", "intro, opening", "ch2, scene2"], when searching with `titleContains: "scene"`, then results contain documents matching that alias.
3. **titleContains: combined with other filters** — given mixed documents (compositions and leaves), when searching with `titleContains: "chapter"` AND `isComposition: false`, then only leaf documents matching the title are returned.
4. **titleContains: empty result** — given documents with no matches, when searching with `titleContains: "nonexistent"`, then results are an empty array (no error).
5. **titleContains: SQL injection resistance** — when searching with `titleContains: "'; DROP TABLE documents; --"`, the query executes safely with no SQL injection.

## 6. Context Loading

- `CLAUDE.md` (always)
- `packages/adapter-sqlite/ADAPTER_SQLITE.md` (note: doesn't exist yet, but read from schema if available)
- `packages/adapter-sqlite/src/data-store.ts` (current implementation)
- `packages/adapter-sqlite/tests/data-store.test.ts` (test file to add cases to)
- `packages/types/src/crud.ts` (to understand `DocumentFilters` shape)

## 7. HITL Tier

- [ ] Default HITL rules apply (no overrides).

## 8. Collaboration Constraints

- [ ] No other agents are working in this sub-project. (Other Phase 4a tasks depend on this fix, but don't modify adapter-sqlite.)

## 9. Scope Boundary

- This task fixes ONLY the `listDocuments` method's `titleContains` filter.
- Does NOT implement body text search (deferred to Phase 4b).
- Does NOT implement tag-based filtering (Phase 4b).
- Does NOT refactor the entire data store.

## 10. Notes

The omnisearch feature (PA-003) calls `documents.search(query)` via IPC, which in turn calls `listDocuments(projectId, { titleContains: query })` in the adapter. This is a prerequisite for omnisearch to work. If this fix is not complete, PA-003 will have no search results.
