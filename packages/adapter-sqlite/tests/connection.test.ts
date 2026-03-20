import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteConnection } from '../src/connection.js';

describe('SQLite Adapter: Connection', () => {
  let db: SqliteConnection;

  beforeEach(async () => {
    // Create in-memory database for tests
    db = new SqliteConnection(':memory:');
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Database lifecycle', () => {
    it('TC-SQLITE-01: opens in-memory database', async () => {
      expect(db).toBeDefined();
      // Should not throw on double open
      await db.open();
    });

    it('TC-SQLITE-02: closes database', async () => {
      await db.close();
      // Second close should not throw
      await db.close();
    });
  });

  describe('Execute queries', () => {
    it('TC-SQLITE-03: execute returns empty array for SELECT with no rows', async () => {
      const result = await db.execute('SELECT 1 as n WHERE 0', []);
      expect(result).toEqual([]);
    });

    it('TC-SQLITE-04: execute returns array of rows for SELECT', async () => {
      const result = await db.execute('SELECT ? as n', [42]);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('n', 42);
    });

    it('TC-SQLITE-05: execute with multiple rows', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER, val TEXT)', []);
      await db.executeUpdate('INSERT INTO test VALUES (1, ?)', ['a']);
      await db.executeUpdate('INSERT INTO test VALUES (2, ?)', ['b']);

      const result = await db.execute('SELECT * FROM test ORDER BY id', []);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('val', 'a');
      expect(result[1]).toHaveProperty('val', 'b');
    });

    it('TC-SQLITE-06: execute with parameterized query', async () => {
      const result = await db.execute('SELECT ? as a, ? as b', [10, 'hello']);
      expect(result[0]).toEqual({ a: 10, b: 'hello' });
    });

    it('TC-SQLITE-07: execute handles NULL values', async () => {
      const result = await db.execute('SELECT ? as val', [null]);
      expect(result[0]).toHaveProperty('val', null);
    });
  });

  describe('Execute updates', () => {
    it('TC-SQLITE-08: executeUpdate returns changedRows count', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)', []);
      const result = await db.executeUpdate('INSERT INTO test (val) VALUES (?)', ['row1']);

      expect(result).toHaveProperty('changedRows');
      expect(result.changedRows).toBeGreaterThan(0);
    });

    it('TC-SQLITE-09: executeUpdate for INSERT', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER, val TEXT)', []);
      const result = await db.executeUpdate('INSERT INTO test VALUES (1, ?)', ['test']);

      expect(result.changedRows).toBeGreaterThan(0);
    });

    it('TC-SQLITE-10: executeUpdate for UPDATE', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER, val TEXT)', []);
      await db.executeUpdate('INSERT INTO test VALUES (1, ?)', ['old']);
      const result = await db.executeUpdate('UPDATE test SET val = ? WHERE id = 1', ['new']);

      expect(result.changedRows).toBeGreaterThan(0);

      const rows = await db.execute('SELECT * FROM test WHERE id = 1', []);
      expect(rows[0]).toHaveProperty('val', 'new');
    });

    it('TC-SQLITE-11: executeUpdate for DELETE', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER, val TEXT)', []);
      await db.executeUpdate('INSERT INTO test VALUES (1, ?)', ['row1']);
      const result = await db.executeUpdate('DELETE FROM test WHERE id = 1', []);

      expect(result.changedRows).toBeGreaterThan(0);

      const rows = await db.execute('SELECT COUNT(*) as cnt FROM test', []);
      expect(rows[0]).toHaveProperty('cnt', 0);
    });

    it('TC-SQLITE-12: executeUpdate with multiple parameters', async () => {
      await db.executeUpdate('CREATE TABLE test (a INTEGER, b TEXT, c REAL)', []);
      const result = await db.executeUpdate('INSERT INTO test VALUES (?, ?, ?)', [42, 'hello', 3.14]);

      expect(result.changedRows).toBeGreaterThan(0);

      const rows = await db.execute('SELECT * FROM test', []);
      expect(rows[0]).toEqual({ a: 42, b: 'hello', c: 3.14 });
    });
  });

  describe('Transactions', () => {
    it('TC-SQLITE-13: transaction commits on success', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER, val TEXT)', []);

      await db.transaction(async (tx) => {
        await tx.executeUpdate('INSERT INTO test VALUES (1, ?)', ['value']);
      });

      const rows = await db.execute('SELECT COUNT(*) as cnt FROM test', []);
      expect(rows[0]).toHaveProperty('cnt', 1);
    });

    it('TC-SQLITE-14: transaction rolls back on error', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)', []);

      try {
        await db.transaction(async (tx) => {
          await tx.executeUpdate('INSERT INTO test VALUES (1, ?)', ['value1']);
          await tx.executeUpdate('INSERT INTO test VALUES (1, ?)', ['value2']); // Duplicate PK
        });
      } catch {
        // Expected to fail
      }

      const rows = await db.execute('SELECT COUNT(*) as cnt FROM test', []);
      expect(rows[0]).toHaveProperty('cnt', 0); // Should be rolled back
    });

    it('TC-SQLITE-15: nested transaction support', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER, val TEXT)', []);

      await db.transaction(async (tx1) => {
        await tx1.executeUpdate('INSERT INTO test VALUES (1, ?)', ['outer']);

        await tx1.transaction(async (tx2) => {
          await tx2.executeUpdate('INSERT INTO test VALUES (2, ?)', ['inner']);
        });
      });

      const rows = await db.execute('SELECT COUNT(*) as cnt FROM test', []);
      expect(rows[0]).toHaveProperty('cnt', 2);
    });

    it('TC-SQLITE-16: transaction returns value', async () => {
      const result = await db.transaction(async (tx) => {
        return 'test_value';
      });

      expect(result).toBe('test_value');
    });
  });

  describe('Error handling', () => {
    it('TC-SQLITE-17: handles constraint violations', async () => {
      await db.executeUpdate('CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)', []);
      await db.executeUpdate('INSERT INTO test VALUES (1, ?)', ['value']);

      let threw = false;
      try {
        await db.executeUpdate('INSERT INTO test VALUES (1, ?)', ['duplicate']);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it('TC-SQLITE-18: handles syntax errors', async () => {
      let threw = false;
      try {
        await db.execute('INVALID SQL SYNTAX', []);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it('TC-SQLITE-19: handles missing table errors', async () => {
      let threw = false;
      try {
        await db.execute('SELECT * FROM nonexistent_table', []);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('Data types', () => {
    it('TC-SQLITE-20: handles TEXT type', async () => {
      await db.executeUpdate('CREATE TABLE test (val TEXT)', []);
      await db.executeUpdate('INSERT INTO test VALUES (?)', ['hello']);

      const rows = await db.execute('SELECT * FROM test', []);
      expect(rows[0]).toHaveProperty('val', 'hello');
      expect(typeof rows[0].val).toBe('string');
    });

    it('TC-SQLITE-21: handles INTEGER type', async () => {
      await db.executeUpdate('CREATE TABLE test (val INTEGER)', []);
      await db.executeUpdate('INSERT INTO test VALUES (?)', [42]);

      const rows = await db.execute('SELECT * FROM test', []);
      expect(rows[0]).toHaveProperty('val', 42);
      expect(typeof rows[0].val).toBe('number');
    });

    it('TC-SQLITE-22: handles REAL type', async () => {
      await db.executeUpdate('CREATE TABLE test (val REAL)', []);
      await db.executeUpdate('INSERT INTO test VALUES (?)', [3.14]);

      const rows = await db.execute('SELECT * FROM test', []);
      expect(rows[0]).toHaveProperty('val', 3.14);
      expect(typeof rows[0].val).toBe('number');
    });

    it('TC-SQLITE-23: handles JSON in TEXT', async () => {
      await db.executeUpdate('CREATE TABLE test (val TEXT)', []);
      const obj = { key: 'value', num: 42 };
      await db.executeUpdate('INSERT INTO test VALUES (?)', [JSON.stringify(obj)]);

      const rows = await db.execute('SELECT * FROM test', []);
      const parsed = JSON.parse(rows[0].val as string);
      expect(parsed).toEqual(obj);
    });
  });
});
