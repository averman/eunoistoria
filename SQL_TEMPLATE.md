# SQL_TEMPLATE.md — SQL Template Sub-Project Spec

## Extendable Markdown Editor — Abstract SQL Data Store Base

---

## 1. Purpose

An abstract base implementation of the `DataStorePort` interface using SQL. It contains the shared query logic, schema definitions, and migration framework that SQLite and Postgres adapters inherit.

This package writes SQL once. Dialect adapters override only where SQLite and Postgres diverge.

---

## 2. Dependencies

- **Imports from:** `@project/types` (port interfaces, entity types, query types).
- **Imported by:** `packages/adapter-sqlite`, `packages/adapter-postgres`.
- **Runtime dependencies:** None. (Database drivers are adapter concerns.)
- **Dev dependencies:** `vitest`, `@project/types`.

---

## 3. Architecture

```
┌───────────────────────────────────────┐
│          sql-template                  │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │  AbstractSqlDataStore           │  │
│  │  (implements DataStorePort)     │  │
│  │                                  │  │
│  │  - Common CRUD SQL              │  │
│  │  - Schema DDL                   │  │
│  │  - Migration runner             │  │
│  │  - Transaction wrapper          │  │
│  │                                  │  │
│  │  Abstract methods:              │  │
│  │  - getConnection()              │  │
│  │  - dialectUuid()                │  │
│  │  - dialectTimestamp()           │  │
│  │  - dialectJson()               │  │
│  │  - dialectParameterStyle()     │  │
│  └──────────┬──────────────────────┘  │
│             │                          │
└─────────────┼──────────────────────────┘
              │
     ┌────────┴────────┐
     │                  │
     ▼                  ▼
┌──────────┐     ┌──────────────┐
│ adapter-  │     │  adapter-     │
│ sqlite    │     │  postgres     │
└──────────┘     └──────────────┘
```

The `AbstractSqlDataStore` class:
- Implements all `DataStorePort` methods using common SQL.
- Calls abstract methods for dialect-specific fragments (UUID generation, timestamp type, JSON handling, parameter placeholder style).
- Dialect adapters extend this class and implement only the abstract methods + provide a database connection.

---

## 4. Schema Management

### 4.1 Schema Definition
Schema DDL is defined as template methods that call dialect helpers for type differences:

```typescript
// Conceptual example
protected getCreateDocumentsTableSql(): string {
  return `CREATE TABLE IF NOT EXISTS documents (
    id ${this.dialectUuid()} PRIMARY KEY,
    project_id ${this.dialectUuid()} NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    alias TEXT,
    is_composition ${this.dialectBoolean()} NOT NULL DEFAULT ${this.dialectFalse()},
    content TEXT,
    created_at ${this.dialectTimestamp()} NOT NULL DEFAULT ${this.dialectNow()},
    updated_at ${this.dialectTimestamp()} NOT NULL DEFAULT ${this.dialectNow()},
    CONSTRAINT check_document_kind CHECK (
      (is_composition = ${this.dialectFalse()}) OR
      (is_composition = ${this.dialectTrue()} AND content IS NULL)
    )
  )`;
}
```

### 4.2 Migrations
Schema versioning via a `schema_migrations` table. Each migration is a numbered SQL script. The migration runner applies pending migrations in order.

Migrations are defined in the sql-template package. Dialect-specific migrations (rare) are defined in adapter packages.

---

## 5. Dialect Abstraction Points

| Method | SQLite | Postgres |
|---|---|---|
| `dialectUuid()` | `TEXT` | `UUID` |
| `dialectUuidGenerate()` | Application-generated (passed as param) | `gen_random_uuid()` |
| `dialectTimestamp()` | `TEXT` | `TIMESTAMPTZ` |
| `dialectNow()` | `datetime('now')` | `now()` |
| `dialectBoolean()` | `INTEGER` | `BOOLEAN` |
| `dialectTrue()` | `1` | `TRUE` |
| `dialectFalse()` | `0` | `FALSE` |
| `dialectJson()` | `TEXT` | `JSONB` |
| `dialectParam(n)` | `?` | `$n` |
| `dialectUpsert()` | `INSERT OR REPLACE` or `ON CONFLICT` | `ON CONFLICT` |
| `dialectFullTextIndex()` | FTS5 virtual table | `tsvector` column + GIN index |
| `dialectFullTextSearch()` | `MATCH` | `@@` with `to_tsquery` |

---

## 6. File Manifest

| File | Owns | Estimated Tokens |
|---|---|---|
| `src/index.ts` | Re-exports AbstractSqlDataStore | ~50 |
| `src/abstract-sql-data-store.ts` | Base class, DataStorePort implementation, common SQL | ~1200 |
| `src/schema.ts` | Table creation DDL templates | ~800 |
| `src/migrations.ts` | Migration runner, migration definitions | ~400 |
| `src/dialect.ts` | Abstract dialect method signatures | ~200 |
| `tests/schema.test.ts` | Schema generation tests (verify SQL output) | ~400 |
| `tests/migrations.test.ts` | Migration ordering and idempotency tests | ~300 |

**Total estimated context:** ~3,350 tokens.

---

## 7. Key Design Constraints

1. **No database driver imports.** The connection is abstract. Adapters provide it.
2. **SQL is generated, not hardcoded.** Dialect methods are called within templates to produce the correct SQL for the target database.
3. **Parameter style is abstracted.** SQLite uses `?`, Postgres uses `$1, $2, ...`. The base class calls `dialectParam(n)` and adapters return the correct format.
4. **Schema changes go here, not in adapters.** Adapters only override dialect-specific DDL if absolutely necessary (e.g., Postgres-specific index types).
