# ADT-002 — Adapter: SQLite Integration Tests

- **Sub-project:** `packages/adapter-sqlite`
- **Branch:** `feat/ADT-002-sqlite-integration-tests`
- **Depends on:** ADT-001, ENG-013
- **Files created:** `packages/adapter-sqlite/tests/integration.test.ts`

## Objective

Verify the full `DataStorePort` contract is correctly implemented by `SqliteDataStore` against a real in-memory SQLite database. Also verify end-to-end: `createEngine(sqliteDataStore, alwaysTrueAccessFilter)` produces correct resolved markdown.

## Behavior

Each test creates a fresh in-memory SQLite database via `createSqliteDataStore(':memory:')`, calls `initializeSchema()`, then exercises the data store through the engine.

**Test setup helper:**
```typescript
function createAlwaysTrueAccessFilter(): AccessFilterPort {
  return { canAccess: async (_id) => true };
}
```

## Test Cases

TC-ADT-002-01: `schema_initializes_without_error` — `initializeSchema()` completes, all tables exist.
TC-ADT-002-02: `create_and_retrieve_document` — create leaf via `engine.documents.create`, retrieve via `engine.documents.get`, fields match.
TC-ADT-002-03: `create_composition_add_slots_resolve` — create composition with two leaf slots, `engine.resolution.resolveComposition` returns concatenated content.
TC-ADT-002-04: `variant_group_resolution_with_sort_rule` — create variant group with two members, create preset with sort_by rule, `engine.resolution.resolve` returns preferred member.
TC-ADT-002-05: `cycle_detection_prevents_cycle` — attempt to add a slot that would create a cycle → `SlotError.WouldCreateCycle`.
TC-ADT-002-06: `tag_assignment_and_search` — assign tags, `engine.tags.search` returns correct documents.
TC-ADT-002-07: `preset_rule_ordering` — add three rules, reorder them, `listPresetRules` returns in new order.
TC-ADT-002-08: `full_preset_resolution_with_toggle_and_sort` — integration test covering evaluate → override → resolve pipeline end-to-end.

---
