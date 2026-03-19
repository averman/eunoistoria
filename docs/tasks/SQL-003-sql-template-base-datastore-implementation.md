# SQL-003 — SQL Template: Base DataStore Implementation

- **Sub-project:** `packages/sql-template`
- **Branch:** `feat/SQL-003-base-implementation`
- **Depends on:** SQL-001, SQL-002, TYP-004
- **Files created:** `packages/sql-template/src/sql-template-data-store.ts`, `packages/sql-template/tests/sql-template-data-store.test.ts`

## Objective

Implement all `DataStorePort` methods using the `SqlConnection` interface. This abstract class forms the shared implementation for both SQLite and Postgres adapters. Dialects extend it to provide a `SqlConnection` and override the parameter format.

## Behavior

**Class definition:**
```typescript
export abstract class SqlTemplateDataStore implements DataStorePort {
  protected constructor(protected readonly connection: SqlConnection) {}

  // Dialect adapters override this to control parameter style.
  // Return '?' for SQLite, '$N' (1-indexed) for Postgres.
  protected abstract formatParam(index: number): string;

  // Convenience: build a parameterized SQL statement with p(1), p(2)...
  protected p(index: number): string { return this.formatParam(index); }

  // Schema initialization: run all DDL in sequence.
  async initializeSchema(): Promise<void> { ... }

  // All DataStorePort methods implemented here.
  ...
}
```

**Row-to-domain mapping rules:**

`getDocument(id)`:
1. `SELECT id, project_id, title, alias, is_composition, content FROM documents WHERE id = {p(1)}`, params: `[id]`.
2. If no rows: `DataStoreError.NotFound`.
3. `SELECT t.key, t.value FROM tags t JOIN document_tags dt ON t.id = dt.tag_id WHERE dt.document_id = {p(1)}`, params: `[id]`.
4. If `is_composition = false`: return `DataLeaf { type: 'leaf', id, title, tags, content: row.content ?? '' }`.
5. If `is_composition = true`: `SELECT id, slot_order, ref_type, ref_document_id, ref_variant_group_id FROM composition_slots WHERE composition_id = {p(1)} ORDER BY slot_order ASC`. Assemble `CompositionSlot[]`. Return `DataComposition { type: 'composition', id, title, tags, slots }`.

`getPreset(id)`:
1. SELECT preset record.
2. SELECT preset rules ordered by `rule_order ASC`, deserialize `premise` and `action_params` JSON columns.
3. SELECT preset adhoc documents ordered by `inclusion_order ASC`, extract `document_id`.
4. Assemble `Preset { id, name, baseCompositionId, rules: Rule[], adHocDocuments: DocumentId[] }`.

`assignTag(documentId, key, value)`:
1. Fetch `project_id` from `documents WHERE id = {p(1)}`.
2. UPSERT tag: `INSERT INTO tags (id, project_id, key, value, color) VALUES ({p(1)},{p(2)},{p(3)},{p(4)},{p(5)}) ON CONFLICT (project_id, key, value) DO UPDATE SET id = tags.id RETURNING id, project_id, key, value, color, created_at`. (Postgres syntax; SQLite adapter overrides with `INSERT OR IGNORE`.)
3. INSERT into `document_tags (document_id, tag_id)` using `ON CONFLICT DO NOTHING`.
4. Return the TagRecord.

`queryDocuments(projectId, predicates)`:
1. Build a WHERE clause from `predicates`. Each predicate maps to a SQL condition on `t.key` and `t.value` via a `JOIN document_tags / tags`:
   - `tag_eq { key, value }` → `EXISTS (SELECT 1 FROM document_tags dt2 JOIN tags t2 ON dt2.tag_id=t2.id WHERE dt2.document_id=d.id AND t2.key={pN} AND t2.value={pN+1})`.
   - Other comparisons follow the same pattern with appropriate operators.
   - `is_composition` → `d.is_composition = {pN}`.
2. For each matching document: call `getDocument(id)` to hydrate. (Sequential is acceptable for Phase 3 scope.)

**All `reorder*` methods** use an approach of updating each row's order column individually within a transaction:
```sql
UPDATE composition_slots SET slot_order = {p(1)} WHERE id = {p(2)}
-- repeated for each slot
```
Wrapped in `connection.transaction()`.

**JSON serialization:** `Premise` and `Action` objects are serialized to string via `JSON.stringify` before INSERT, and parsed via `JSON.parse` on SELECT.

## Test Cases

SQL-003 is an abstract class — it is tested through the adapters in ADT-002 and ADT-004. The `tests/sql-template-data-store.test.ts` file contains unit tests for the query-building helpers only (not execution):

TC-SQL-003-01: `buildTagEqPredicate` correctly generates parameterized SQL fragment.
TC-SQL-003-02: `buildQueryDocumentsSQL` with two predicates generates correct compound WHERE clause.

---

---
