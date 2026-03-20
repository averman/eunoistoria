# PA-FIX Walkthrough — SQLite listDocuments titleContains Filter

**Status:** ✅ Complete
**Date:** 2026-03-20
**Tests:** 66 passing (5 new + 61 existing)

---

## Changes Made

### File: `packages/adapter-sqlite/src/data-store.ts`

**Method:** `listDocuments()` (lines 151–184)

**What Changed:**
- Added support for `filters.titleContains` field from `DocumentFilters`
- When provided, the filter performs case-insensitive substring matching on both `title` AND `alias` fields
- Results are sorted with title matches first (using `CASE` expression), then by creation date descending

**SQL Pattern:**
```sql
WHERE project_id = ?
  AND (LOWER(title) LIKE LOWER(?) OR LOWER(alias) LIKE LOWER(?))
ORDER BY CASE WHEN LOWER(title) LIKE LOWER(?) THEN 0 ELSE 1 END ASC, created_at DESC
```

**Key Details:**
- Pattern is wrapped with `%` wildcards for substring matching: `%query%`
- Uses parameterized queries — injection-safe
- Title matches sorted first (CASE...THEN 0), alias-only matches second (THEN 1)
- Existing `isComposition` filter works unchanged
- When no `titleContains` filter, falls back to existing `ORDER BY created_at DESC`

---

### File: `packages/adapter-sqlite/tests/data-store.test.ts`

**Added Test Block:** `describe('listDocuments titleContains filter')` (lines 12–152)

**Test Cases:**

| Test | Purpose | Verification |
|---|---|---|
| **TC-FIX-01** | Title field search (case-insensitive) | "chapter" finds "Chapter 1" and "Chapter 2", not "Introduction" |
| **TC-FIX-02** | Alias field search | "scene" finds documents with "scene1" and "scene2" in alias |
| **TC-FIX-03** | Combined filters | `titleContains` + `isComposition: false` returns only leaf docs matching title |
| **TC-FIX-04** | No matches | Non-existent search query returns empty array (not error) |
| **TC-FIX-05** | SQL injection | Malicious payload `"'; DROP TABLE documents; --"` executes safely, returns empty; table still exists |

---

## Test Results

```
✓ src/index.test.ts  (1 test) 1ms
✓ tests/connection.test.ts  (23 tests) 10ms
✓ tests/integration.test.ts  (18 tests) 14ms
✓ tests/data-store.test.ts  (24 tests) 18ms
  - Includes 5 new titleContains tests (all passing)
  - Includes 19 existing tests (all passing)

Test Files  4 passed (4)
     Tests  66 passed (66)
```

---

## Verification (Manual)

1. ✅ All 5 titleContains test cases pass
2. ✅ Existing 61 tests remain green (no regression)
3. ✅ SQL injection test confirms parameterized query safety
4. ✅ Filter respects project scope (results filtered by projectId)
5. ✅ Sorting prioritizes title matches over alias matches

---

## Impact & Downstream

**Unblocks:** PA-003 (OmniSearch sidebar)

The `listDocuments` method is called by the OmniSearch IPC handler (`window.eunoistoria.documents.search(query)`) in PA-003. Without this fix, search returns all documents regardless of query text. With this fix, search correctly filters documents by title and alias.

**No Breaking Changes:**
- Existing callers of `listDocuments` without `titleContains` filter work unchanged
- `isComposition` filter works as before
- Return type unchanged

---

## Integration Checklist

- [x] Implement titleContains SQL logic
- [x] Write 5 test cases
- [x] Verify all tests pass
- [x] Update IMPLEMENTATION_TRACKER.md
- [x] Create this walkthrough
- [ ] Code review (pending user review)
- [ ] Merge to main (after approval)

Ready for PA-001 (Electron scaffold) → PA-002 (project lifecycle) → PA-003 (OmniSearch) sequence.
