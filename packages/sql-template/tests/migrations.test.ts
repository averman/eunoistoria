import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationManager } from '../src/migrations.js';

interface MockConnection {
  execute: (sql: string, params: unknown[]) => Promise<unknown[]>;
  executeUpdate: (sql: string, params: unknown[]) => Promise<{ changedRows: number }>;
}

describe('SQL Template: Migrations', () => {
  let mockConn: MockConnection;

  beforeEach(() => {
    mockConn = {
      execute: vi.fn(async () => []),
      executeUpdate: vi.fn(async () => ({ changedRows: 0 })),
    };
  });

  it('TC-MIG-01: MigrationManager initializes', () => {
    const mgr = new MigrationManager();
    expect(mgr).toBeDefined();
  });

  it('TC-MIG-02: getCurrentVersion returns 0 for fresh database', async () => {
    (mockConn.execute as any).mockResolvedValueOnce([]);

    const mgr = new MigrationManager();
    const version = await mgr.getCurrentVersion(mockConn as any);

    expect(version.ok).toBe(true);
    if (version.ok) {
      expect(version.value).toBe(0);
    }
  });

  it('TC-MIG-03: getAvailableMigrations returns migration list', () => {
    const mgr = new MigrationManager();
    const migrations = mgr.getAvailableMigrations();

    expect(Array.isArray(migrations)).toBe(true);
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0].version).toBe(1);
  });

  it('TC-MIG-04: getMigration(1) returns v1 schema creation', () => {
    const mgr = new MigrationManager();
    const migration = mgr.getMigration(1);

    expect(migration).toBeDefined();
    expect(migration?.sql.length).toBeGreaterThan(0);
  });

  it('TC-MIG-05: runMigration applies SQL for a version', async () => {
    (mockConn.executeUpdate as any).mockResolvedValue({ changedRows: 1 });
    (mockConn.execute as any).mockResolvedValue([]);

    const mgr = new MigrationManager();
    const result = await mgr.runMigration(mockConn as any, 1);

    expect(result.ok).toBe(true);
  });

  it('TC-MIG-06: runMigrations applies all pending migrations', async () => {
    (mockConn.executeUpdate as any).mockResolvedValue({ changedRows: 1 });
    (mockConn.execute as any).mockResolvedValueOnce([]) // getCurrentVersion
      .mockResolvedValueOnce([]) // v1 tables created
      .mockResolvedValueOnce([]); // version updated

    const mgr = new MigrationManager();
    const result = await mgr.runMigrations(mockConn as any, 1);

    expect(result.ok).toBe(true);
  });

  it('TC-MIG-07: v1 migration creates all required tables', () => {
    const mgr = new MigrationManager();
    const migration = mgr.getMigration(1);

    const requiredTables = [
      'documents',
      'composition_slots',
      'variant_groups',
      'variant_group_members',
      'tags',
      'document_tags',
      'presets',
      'preset_rules',
      'preset_ad_hoc_documents',
    ];

    if (migration) {
      for (const tableName of requiredTables) {
        expect(migration.sql.toLowerCase()).toContain(`create table`);
        expect(migration.sql.toLowerCase()).toContain(tableName);
      }
    }
  });

  it('TC-MIG-08: v1 migration includes primary keys', () => {
    const mgr = new MigrationManager();
    const migration = mgr.getMigration(1);

    expect(migration?.sql).toContain('PRIMARY KEY');
  });

  it('TC-MIG-09: v1 migration includes foreign keys', () => {
    const mgr = new MigrationManager();
    const migration = mgr.getMigration(1);

    expect(migration?.sql).toContain('FOREIGN KEY');
    expect(migration?.sql).toContain('REFERENCES');
  });

  it('TC-MIG-10: v1 migration includes unique constraints for ordering', () => {
    const mgr = new MigrationManager();
    const migration = mgr.getMigration(1);

    expect(migration?.sql.toLowerCase()).toContain('unique');
  });

  it('TC-MIG-11: v1 migration includes CHECK constraints for composition/content exclusivity', () => {
    const mgr = new MigrationManager();
    const migration = mgr.getMigration(1);

    expect(migration?.sql.toLowerCase()).toContain('check');
  });

  it('TC-MIG-12: migration error propagates correctly', async () => {
    (mockConn.executeUpdate as any).mockRejectedValue(new Error('Constraint violation'));

    const mgr = new MigrationManager();
    const result = await mgr.runMigration(mockConn as any, 1);

    expect(result.ok).toBe(false);
  });

  it('TC-MIG-13: runMigrations idempotent (running twice succeeds)', async () => {
    let callCount = 0;
    (mockConn.execute as any).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return []; // getCurrentVersion = 0
      if (callCount === 2) return []; // after v1 run, getCurrentVersion = 1
      return [];
    });
    (mockConn.executeUpdate as any).mockResolvedValue({ changedRows: 1 });

    const mgr = new MigrationManager();

    const result1 = await mgr.runMigrations(mockConn as any, 1);
    expect(result1.ok).toBe(true);

    // Second run should skip (already at version 1)
    const result2 = await mgr.runMigrations(mockConn as any, 1);
    expect(result2.ok).toBe(true);
  });
});
