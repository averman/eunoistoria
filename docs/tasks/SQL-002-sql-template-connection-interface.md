# SQL-002 — SQL Template: Connection Interface

- **Sub-project:** `packages/sql-template`
- **Branch:** `feat/SQL-002-connection-interface`
- **Depends on:** none
- **Files created:** `packages/sql-template/src/connection.ts`

## Objective

Define the `SqlConnection` interface and supporting types that dialect adapters must implement. This is the low-level execution contract.

## Behavior

Create `packages/sql-template/src/connection.ts`:

```typescript
export interface Row {
  [column: string]: unknown;
}

export interface CommandResult {
  rowsAffected: number;
}

export interface TransactionContext {
  executeQuery(sql: string, params: unknown[]): Promise<Row[]>;
  executeCommand(sql: string, params: unknown[]): Promise<CommandResult>;
}

export interface SqlConnection {
  executeQuery(sql: string, params: unknown[]): Promise<Row[]>;
  executeCommand(sql: string, params: unknown[]): Promise<CommandResult>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

## Test Cases

`tsc --noEmit` passes.

---
