/**
 * SQLite Connection - wraps better-sqlite3 or equivalent
 */

import Database from 'better-sqlite3';
import { SqlConnection, SqlRow } from '../../sql-template/src/index';

export class SqliteConnection implements SqlConnection {
  private db: Database.Database | null = null;
  private isOpen = false;
  private inTransaction = false;

  constructor(private path: string) {}

  async open(): Promise<void> {
    if (!this.isOpen) {
      this.db = new Database(this.path);
      this.isOpen = true;
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
    }
  }

  async close(): Promise<void> {
    if (this.isOpen && this.db) {
      this.db.close();
      this.isOpen = false;
      this.db = null;
    }
  }

  async execute(sql: string, params: unknown[]): Promise<SqlRow[]> {
    if (!this.db) throw new Error('Database not open');

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as SqlRow[];
    return rows;
  }

  async executeUpdate(sql: string, params: unknown[]): Promise<{ changedRows: number }> {
    if (!this.db) throw new Error('Database not open');

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);

    return {
      changedRows: result.changes,
    };
  }

  async transaction<T>(fn: (tx: SqlConnection) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not open');

    if (this.inTransaction) {
      // Nested transaction - just run the function
      return fn(this);
    }

    this.inTransaction = true;
    try {
      this.db.exec('BEGIN TRANSACTION');
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }
}
