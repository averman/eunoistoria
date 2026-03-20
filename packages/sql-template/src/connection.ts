/**
 * Abstract SQL connection interface.
 * All dialect adapters (SQLite, Postgres) implement this interface.
 */

export type SqlRow = Record<string, unknown>;

export interface SqlConnection {
  /**
   * Execute a SELECT query and return rows.
   */
  execute(sql: string, params: unknown[]): Promise<SqlRow[]>;

  /**
   * Execute an INSERT, UPDATE, or DELETE and return result.
   */
  executeUpdate(sql: string, params: unknown[]): Promise<{ changedRows: number }>;

  /**
   * Run multiple operations in a transaction.
   * If the callback throws, the transaction rolls back.
   */
  transaction<T>(fn: (tx: SqlConnection) => Promise<T>): Promise<T>;

  /**
   * Close the connection.
   */
  close(): Promise<void>;
}

export interface SqlExecuteResult {
  ok: true;
  value: void;
}

export interface SqlExecuteError {
  ok: false;
  error: 'ConstraintViolation' | 'NotFound' | 'ConnectionError' | 'Unknown';
}
