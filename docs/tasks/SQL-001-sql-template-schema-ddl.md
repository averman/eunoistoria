# SQL-001 — SQL Template: Schema DDL

- **Sub-project:** `packages/sql-template`
- **Branch:** `feat/SQL-001-schema-ddl`
- **Depends on:** TYP-004
- **Files created:** `packages/sql-template/src/schema.ts`

## Objective

Define all `CREATE TABLE` and `CREATE INDEX` statements as exported string constants. These are the canonical schema for both SQLite and Postgres adapters. Dialect-specific adjustments are handled in adapters.

## Behavior

Export one constant per table and one grouped constant for indexes. Table DDL uses ANSI-compatible SQL (no dialect-specific types unless absolutely necessary). Use `TEXT` for strings, `INTEGER` for integers, `BOOLEAN` for booleans, `TIMESTAMPTZ` for timestamps. Dialect adapters may override specific type names.

**Exported constants** (each is a `string`):

- `DDL_TABLE_DOCUMENTS` — creates the `documents` table with the schema from ERD section 3.2.
- `DDL_TABLE_COMPOSITION_SLOTS` — from ERD 3.3.
- `DDL_TABLE_VARIANT_GROUPS` — from ERD 3.4.
- `DDL_TABLE_VARIANT_GROUP_MEMBERS` — from ERD 3.5.
- `DDL_TABLE_TAGS` — from ERD 3.6.
- `DDL_TABLE_DOCUMENT_TAGS` — from ERD 3.7.
- `DDL_TABLE_PRESETS` — from ERD 3.8.
- `DDL_TABLE_PRESET_RULES` — from ERD 3.9. The `premise` and `action_params` columns are `TEXT` (JSON serialized string) in the base schema. Postgres adapter overrides to `JSONB`.
- `DDL_TABLE_PRESET_ADHOC_DOCUMENTS` — from ERD 3.10.
- `DDL_TABLE_DOCUMENT_HISTORY` — from ERD 3.11.
- `DDL_INDEXES` — a single string containing all `CREATE INDEX` statements, separated by `;`. These are taken directly from the ERD index definitions.
- `ALL_DDL` — an array of all the above constants in dependency-safe creation order: `[DDL_TABLE_DOCUMENTS, DDL_TABLE_COMPOSITION_SLOTS, ...]`. Applied in sequence during schema initialization.

**Creation order** (respects FK dependencies):
1. `documents`
2. `tags`
3. `variant_groups`
4. `composition_slots`
5. `variant_group_members`
6. `document_tags`
7. `presets`
8. `preset_rules`
9. `preset_adhoc_documents`
10. `document_history`

## Test Cases

TC-SQL-001-01: Each DDL constant is a non-empty string containing `CREATE TABLE`.
TC-SQL-001-02: `ALL_DDL` array has exactly 10 entries.

---
