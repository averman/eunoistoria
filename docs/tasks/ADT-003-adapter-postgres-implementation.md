# ADT-003 — Adapter: Postgres Implementation

- **Sub-project:** `packages/adapter-postgres`
- **Branch:** `feat/ADT-003-postgres-adapter`
- **Depends on:** SQL-003
- **Files created:** `packages/adapter-postgres/src/postgres-connection.ts`, `packages/adapter-postgres/src/postgres-data-store.ts`, `packages/adapter-postgres/src/index.ts`

## Objective

Implement `SqlConnection` and extend `SqlTemplateDataStore` for Postgres using the `pg` npm package.

## Behavior

**`PostgresConnection`** implements `SqlConnection`:
- Constructor accepts a `pg.Pool` instance.
- `executeQuery(sql, params)`: `pool.query(sql, params)` → map `rows`.
- `executeCommand(sql, params)`: `pool.query(sql, params)` → `{ rowsAffected: result.rowCount ?? 0 }`.
- `transaction<T>(fn)`: acquire a client from the pool, `BEGIN`, call `fn`, `COMMIT` or `ROLLBACK` on error, release.
- `close()`: `pool.end()`.

**`PostgresDataStore`** extends `SqlTemplateDataStore`:
```typescript
export class PostgresDataStore extends SqlTemplateDataStore {
  protected formatParam(index: number): string { return `$${index}`; }
}
```

**JSONB override:** the `preset_rules` table uses `JSONB` for `premise` and `action_params` in Postgres. The `pg` driver returns parsed JS objects for JSONB columns. Override the rule retrieval methods to skip `JSON.parse` when the column value is already an object.

**Tag UPSERT:** Postgres uses `INSERT INTO tags ... ON CONFLICT (project_id, key, value) DO UPDATE SET id = tags.id RETURNING *`.

**Exported factory:**
```typescript
export function createPostgresDataStore(connectionString: string): PostgresDataStore
```

## Test Cases

Covered in ADT-004.

---
