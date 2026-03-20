# Phase 3 Plan — Storage Layer (SQLite Only MVP)

**Status**: 🟢 Ready for Implementation
**Timeline**: ~1-2 weeks
**Scope**: SQLite adapter + common SQL templates (Postgres deferred to Phase 5)
**Objective**: Enable Power App to persist data locally with full CRUD and rule evaluation

---

## 1. Overview

Phase 3 builds the storage layer for the MVP. Rather than implementing both SQLite and Postgres, we'll focus on SQLite only — sufficient for the Power App MVP. Postgres adapter is deferred to Phase 5 (Reader App).

This refocusing:
- ✅ Unblocks Power App development (Phase 4)
- ✅ Reduces complexity and testing scope
- ✅ Lets you ship an MVP faster
- ✅ Postgres can be built independently in parallel later

**Definition of Done**:
- `packages/sql-template` fully implemented
- `packages/adapter-sqlite` fully implemented
- Integration tests passing (engine + sqlite adapter together)
- Power App can perform full CRUD + rule evaluation + resolution with persisted data

---

## 2. Sub-Project Dependencies

```
packages/types (Phase 1) ✅
    ↓
packages/engine (Phase 2) ✅
    ↓
    ├── packages/sql-template (Phase 3 — NEW)
    │       ↓
    │   packages/adapter-sqlite (Phase 3 — NEW)
    │       ↓
    └── packages/power-app (Phase 4 — blocked until Phase 3 complete)
```

---

## 3. Detailed Task Breakdown

### 3.1 SQL Template Package (`packages/sql-template`)

**Purpose**: Abstract SQL generation and schema. All dialects (SQLite, Postgres) inherit from this.

**Deliverables**:

#### 3.1.1 Schema Definitions (`src/schema.ts`)
- **Documents table**
  - Columns: `id`, `project_id`, `title`, `alias`, `is_composition`, `content`, `created_at`, `updated_at`
  - Primary key: `id`
  - Indexes: `(project_id)`, `(created_at)`
  - Check constraint: content is null iff is_composition = true

- **Composition Slots table**
  - Columns: `id`, `composition_id`, `slot_order`, `reference_type`, `reference_document_id`, `reference_variant_group_id`
  - Primary key: `id`
  - Foreign keys: `composition_id` → documents, `reference_document_id` → documents, `reference_variant_group_id` → variant_groups
  - Check constraint: exactly one reference is set (XOR logic)
  - Unique constraint: `(composition_id, slot_order)`

- **Variant Groups table**
  - Columns: `id`, `project_id`, `name`, `created_at`
  - Primary key: `id`
  - Indexes: `(project_id)`

- **Variant Group Members table** (join table)
  - Columns: `variant_group_id`, `document_id`, `member_order`, `created_at`
  - Primary key: `(variant_group_id, document_id)`
  - Unique constraint: `(variant_group_id, member_order)` (no gaps, 0-indexed)
  - Foreign keys: `variant_group_id` → variant_groups, `document_id` → documents

- **Tags table**
  - Columns: `id`, `project_id`, `key`, `value`, `created_at`
  - Primary key: `id`
  - Indexes: `(project_id, key)`, `(project_id, key, value)`

- **Document Tags table** (join)
  - Columns: `document_id`, `tag_id`
  - Primary key: `(document_id, tag_id)`
  - Foreign keys: `document_id` → documents, `tag_id` → tags

- **Presets table**
  - Columns: `id`, `project_id`, `name`, `base_composition_id`, `created_at`, `updated_at`
  - Primary key: `id`
  - Foreign key: `base_composition_id` → documents (with cascade delete validation)
  - Indexes: `(project_id)`

- **Preset Rules table**
  - Columns: `id`, `preset_id`, `rule_order`, `premise` (JSON), `action_params` (JSON), `created_at`
  - Primary key: `id`
  - Foreign key: `preset_id` → presets
  - Unique constraint: `(preset_id, rule_order)`

- **Preset Ad-Hoc Documents table** (join)
  - Columns: `preset_id`, `document_id`, `inclusion_order`
  - Primary key: `(preset_id, document_id)`
  - Foreign keys: `preset_id` → presets, `document_id` → documents
  - Unique constraint: `(preset_id, inclusion_order)`

**Effort**: ~4-6 hours

---

#### 3.1.2 Query Templates (`src/query-builder.ts`)

Build parameterized SQL templates for all CRUD operations:

**Document queries**:
- `getDocument(id)` → SELECT with tags
- `listDocuments(project_id, filters)` → SELECT with filtering
- `createDocument(input)` → INSERT
- `updateDocument(id, changes)` → UPDATE
- `deleteDocument(id)` → DELETE

**Slot queries**:
- `listSlots(composition_id)` → SELECT ordered by slot_order
- `createSlot(input)` → INSERT
- `updateSlot(id, changes)` → UPDATE
- `deleteSlot(id)` → DELETE

**Variant Group queries**:
- `listVariantGroups(project_id)` → SELECT
- `createVariantGroup(input)` → INSERT
- `deleteVariantGroup(id)` → DELETE
- `listVariantGroupMembers(group_id)` → SELECT ordered by member_order
- `addMember(group_id, document_id)` → INSERT
- `removeMember(group_id, document_id)` → DELETE
- `reorderMembers(group_id, orders)` → UPDATE batch

**Tag queries**:
- `getTagsForDocument(document_id)` → SELECT
- `assignTag(document_id, key, value)` → INSERT or UPDATE
- `removeTag(tag_id)` → DELETE
- `searchTags(project_id, key?, value?)` → SELECT with filtering

**Preset queries**:
- `getPreset(id)` → SELECT with rules + ad-hoc docs
- `listPresets(project_id)` → SELECT
- `createPreset(input)` → INSERT
- `updatePreset(id, changes)` → UPDATE
- `deletePreset(id)` → DELETE
- `listPresetRules(preset_id)` → SELECT ordered
- `addPresetRule(preset_id, rule)` → INSERT
- `removePresetRule(rule_id)` → DELETE
- `reorderPresetRules(preset_id, ordering)` → UPDATE batch
- `addAdHocDocument(preset_id, document_id)` → INSERT
- `removeAdHocDocument(preset_id, document_id)` → DELETE

**Effort**: ~6-8 hours

---

#### 3.1.3 Migration System (`src/migrations.ts`)

Schema versioning + migrations:
- `getMigrationVersion()` → check current schema version
- `runMigrations(targetVersion)` → apply pending migrations sequentially
- `createTables()` → initial setup (migration v1)

Keep it simple for MVP: single migration file, idempotent (CREATE TABLE IF NOT EXISTS).

**Effort**: ~1-2 hours

---

#### 3.1.4 Abstract Connection Interface (`src/connection.ts`)

```typescript
interface SqlConnection {
  execute(sql: string, params: unknown[]): Promise<Row[]>;
  executeUpdate(sql: string, params: unknown[]): Promise<{ changedRows: number }>;
  transaction<T>(fn: (tx: SqlConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

Dialect adapters implement this.

**Effort**: ~1 hour

---

#### 3.1.5 Tests (`tests/`)
- Schema integrity tests (can we create tables?)
- Query builder tests (parameterized SQL generation)
- Migration tests (versioning logic)

Use in-memory SQLite for fast tests.

**Effort**: ~3-4 hours

---

### 3.2 SQLite Adapter Package (`packages/adapter-sqlite`)

**Purpose**: Concrete implementation of `DataStorePort` using SQLite.

**Deliverables**:

#### 3.2.1 Connection Management (`src/connection.ts`)
- Wrapper around `better-sqlite3` (sync) or `sql.js` (in-memory for testing)
- File-based database for local storage
- Connection pooling (optional for v1, but set up the interface)
- Transactions support

**Effort**: ~2-3 hours

---

#### 3.2.2 DataStore Implementation (`src/data-store.ts`)

Implement `DataStorePort` interface by:
1. Delegating to sql-template queries
2. Handling SQLite-specific parameter style (`?` placeholders)
3. Mapping SQL rows to TS types (Document, Slot, etc.)
4. Error handling (constraint violations, foreign key errors)

Key methods:
- `getDocument(id)` → execute query, hydrate Document with tags + slots
- `createDocument(input)` → execute insert, return created Document
- `listSlots(composition_id)` → execute query, return ordered array
- Etc. (mirrors all engine queries)

**Effort**: ~8-10 hours

---

#### 3.2.3 Dialect Overrides
- SQLite parameter placeholders: `?` (not `$1, $2`)
- Type affinity: SQLite has limited types; use TEXT for JSON (rules, premises)
- Datetime: use ISO8601 strings (SQLite native)
- No boolean: use INTEGER (0/1)

**Effort**: ~1-2 hours (minor tweaks to query templates)

---

#### 3.2.4 Integration Tests (`tests/integration.test.ts`)

Test full workflows:
- Create project → create documents → create composition with slots → resolve
- Create variant group → add members → update sort order
- Create preset with rules → evaluate rules → resolve with selection map
- Concurrent operations (optional, but good to check)

Use in-memory database for speed.

**Effort**: ~4-6 hours

---

### 3.3 Cross-Package Integration

#### 3.3.1 Update Power App Dependency

In `packages/power-app/package.json`:
- Add dependency: `@eunoistoria/adapter-sqlite`

#### 3.3.2 Update Root `package.json` (if needed)

Ensure turbo build order respects the dependency graph.

**Effort**: ~30 minutes

---

## 4. Implementation Sequence

### Week 1
1. **Day 1-2**: SQL template schema + query builder (12 hours)
2. **Day 3**: Migrations + abstract interface (3 hours)
3. **Day 4**: SQL template tests (4 hours)
4. **Day 5**: Begin adapter SQLite connection (3 hours)

### Week 2
5. **Day 1-2**: DataStore implementation (10 hours)
6. **Day 3**: Dialect overrides + parameter mapping (2 hours)
7. **Day 4-5**: Integration tests + bug fixes (6 hours)

**Parallel** (if resources): Begin Power App architecture design (Phase 4 prep)

---

## 5. Testing Strategy

### Unit Tests
- **sql-template**: Query generation, schema validation, migration logic
- **adapter-sqlite**: Row mapping, error handling, transaction behavior

### Integration Tests
- **adapter-sqlite** + **engine**: Full workflow (create → resolve)
- Use in-memory SQLite (no disk I/O during tests)
- Test data: documents, slots, variant groups, presets, rules

### Manual Testing
- Create local `.db` file
- Power App integration (Phase 4 gates on this)

---

## 6. Known Constraints & Trade-offs

### Postgres Deferred
- Phase 5 (Reader App). No Postgres code written in Phase 3.
- If you need parallel Reader App work, start Phase 5 independently.

### SQLite Limitations
- Single writer (file-level locking). MVP OK, not ideal for multi-user.
- No native JSON. Store rules/premises as TEXT (SQLite handles fine).
- Transaction support depends on library choice (better-sqlite3 is good here).

### Type Safety
- TypeScript strict mode: all rows mapped to TS types, no `any`.
- Runtime type guards where SQL rows are parsed.

### Error Handling
- All SQL errors mapped to `DataStoreError` enum (defined in types).
- No silent failures. Errors propagate via `Result<T, E>`.

---

## 7. Success Criteria

✅ **Definition of Done**:
1. All 14 sql-template test files pass (unit + integration)
2. All adapter-sqlite test files pass
3. Engine can create/read/update/delete all entity types via SQLite
4. Resolution (rule evaluation + tree walking) works with persisted data
5. No TypeScript errors (strict mode)
6. Performance: 200-document resolution < 2 seconds

---

## 8. Estimated Effort

| Component | Hours | Notes |
|-----------|-------|-------|
| Schema definitions | 5 | Careful constraint design |
| Query templates | 7 | Repetitive but straightforward |
| Migrations | 2 | Simple versioning |
| Abstract interface | 1 | Thin layer |
| Tests (sql-template) | 4 | Query generation tests |
| SQLite connection | 3 | Wrapper around better-sqlite3 |
| DataStore implementation | 10 | Bulk of the work |
| Dialect overrides | 2 | Minor tweaks |
| Integration tests | 5 | Full workflows |
| **Total** | **~40 hours** | **1-2 weeks at 20h/week** |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| SQLite parameter escaping | Use parameterized queries only; never string interpolation |
| Data corruption on crash | Wrap all mutations in transactions; test corruption recovery |
| Performance regression | Profile resolution with 200-doc dataset early |
| Schema mismatch | Versioned migrations; schema validation tests |
| Type safety breaks | Strict TS mode; all row parsing type-guarded |

---

## 10. Post-Phase 3

### Phase 4: Power App
- UI layer using engine + sqlite adapter
- Variable sidebar, rule builder, resolution display
- File I/O (export `.md`, save project)

### Phase 5: Reader App + Postgres (Future)
- Server-side resolution
- Postgres adapter (clone sqlite patterns)
- User auth + access control

---

## 11. Key Files Summary

| File | Purpose | LOC Est. |
|------|---------|----------|
| `sql-template/src/schema.ts` | Table definitions | 150 |
| `sql-template/src/query-builder.ts` | SQL generation | 400 |
| `sql-template/src/migrations.ts` | Versioning | 50 |
| `sql-template/src/connection.ts` | Abstract interface | 30 |
| `adapter-sqlite/src/connection.ts` | SQLite wrapper | 100 |
| `adapter-sqlite/src/data-store.ts` | Port implementation | 400 |
| Tests (both packages) | Unit + integration | 600 |
| **Total estimated** | | **~1,730 LOC** |

---

## 12. Next Steps

1. **Your approval**: Do you approve this plan? Any changes?
2. **I will start with**: SQL template schema definitions + query builder
3. **Check-in points**: After schema (Day 2), after sql-template complete (Day 4), after adapter basics (Day 5)
4. **Blockers**: None identified. Engine Phase 2 is solid and fully tested.

---

**Ready to begin?**
