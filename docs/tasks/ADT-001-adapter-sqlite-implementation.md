# ADT-001 — Adapter: SQLite Implementation

- **Sub-project:** `packages/adapter-sqlite`
- **Branch:** `feat/ADT-001-sqlite-adapter`
- **Depends on:** SQL-003
- **Files created:** `packages/adapter-sqlite/src/sqlite-connection.ts`, `packages/adapter-sqlite/src/sqlite-data-store.ts`, `packages/adapter-sqlite/src/index.ts`

## Objective

Implement `SqlConnection` and extend `SqlTemplateDataStore` for SQLite using `better-sqlite3` for file-based databases and `sql.js` for in-memory databases (used in integration tests).

## Behavior

**`SqliteConnection`** implements `SqlConnection` using `better-sqlite3`:
- `executeQuery(sql, params)`: runs `db.prepare(sql).all(...params)` and returns rows as `Row[]`.
- `executeCommand(sql, params)`: runs `db.prepare(sql).run(...params)` and returns `{ rowsAffected: info.changes }`.
- `transaction<T>(fn)`: uses `db.transaction(() => { ... })()`.
- `close()`: calls `db.close()`.

**`SqliteDataStore`** extends `SqlTemplateDataStore`:
```typescript
export class SqliteDataStore extends SqlTemplateDataStore {
  protected formatParam(_index: number): string { return '?'; }
}
```

**JSONB override:** SQLite stores `premise` and `action_params` as `TEXT`. The base class already does `JSON.stringify`/`JSON.parse`. No override needed.

**Dialect override for tag UPSERT:** SQLite uses `INSERT OR IGNORE INTO tags ...` followed by a `SELECT` to retrieve the tag record. The `assignTag` method is overridden.

**Exported factory:**
```typescript
export function createSqliteDataStore(dbPath: string): SqliteDataStore
// dbPath ':memory:' for in-memory SQLite
```

**`index.ts`** exports `createSqliteDataStore` and `SqliteDataStore`.

## Test Cases

Covered in ADT-002.

---
