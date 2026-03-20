/**
 * Database migration system - versioned schema updates.
 */

import { SqlConnection } from './connection.js';
import { getSchemaDefinition } from './schema.js';

export interface Migration {
  version: number;
  sql: string;
}

export interface MigrationError {
  ok: false;
  error: string;
}

export class MigrationManager {
  private migrations: Migration[] = [];

  constructor() {
    this.initializeMigrations();
  }

  private initializeMigrations(): void {
    // Migration v1: Create initial schema
    const schemaDef = getSchemaDefinition();

    const v1Sql = `
      ${this.createTableDocuments()}
      ${this.createTableCompositionSlots()}
      ${this.createTableVariantGroups()}
      ${this.createTableVariantGroupMembers()}
      ${this.createTableTags()}
      ${this.createTableDocumentTags()}
      ${this.createTablePresets()}
      ${this.createTablePresetRules()}
      ${this.createTablePresetAdHocDocuments()}
      CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY);
    `;

    this.migrations.push({
      version: 1,
      sql: v1Sql,
    });
  }

  private createTableDocuments(): string {
    return `
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        alias TEXT,
        is_composition INTEGER NOT NULL DEFAULT 0,
        content TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK ((is_composition = 0 AND content IS NOT NULL) OR (is_composition = 1 AND content IS NULL))
      );
      CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
    `;
  }

  private createTableCompositionSlots(): string {
    return `
      CREATE TABLE IF NOT EXISTS composition_slots (
        id TEXT PRIMARY KEY,
        composition_id TEXT NOT NULL,
        slot_order INTEGER NOT NULL,
        reference_type TEXT NOT NULL CHECK (reference_type IN ('document', 'variant_group')),
        reference_document_id TEXT,
        reference_variant_group_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (composition_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (reference_document_id) REFERENCES documents(id) ON DELETE SET NULL,
        FOREIGN KEY (reference_variant_group_id) REFERENCES variant_groups(id) ON DELETE SET NULL,
        UNIQUE (composition_id, slot_order)
      );
      CREATE INDEX IF NOT EXISTS idx_slots_composition ON composition_slots(composition_id);
    `;
  }

  private createTableVariantGroups(): string {
    return `
      CREATE TABLE IF NOT EXISTS variant_groups (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_variant_groups_project ON variant_groups(project_id);
    `;
  }

  private createTableVariantGroupMembers(): string {
    return `
      CREATE TABLE IF NOT EXISTS variant_group_members (
        variant_group_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        member_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (variant_group_id, document_id),
        FOREIGN KEY (variant_group_id) REFERENCES variant_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        UNIQUE (variant_group_id, member_order)
      );
      CREATE INDEX IF NOT EXISTS idx_vgm_order ON variant_group_members(variant_group_id, member_order);
    `;
  }

  private createTableTags(): string {
    return `
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tags_project_key ON tags(project_id, key);
      CREATE INDEX IF NOT EXISTS idx_tags_project_key_value ON tags(project_id, key, value);
    `;
  }

  private createTableDocumentTags(): string {
    return `
      CREATE TABLE IF NOT EXISTS document_tags (
        document_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (document_id, tag_id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);
    `;
  }

  private createTablePresets(): string {
    return `
      CREATE TABLE IF NOT EXISTS presets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        base_composition_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (base_composition_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_presets_project ON presets(project_id);
    `;
  }

  private createTablePresetRules(): string {
    return `
      CREATE TABLE IF NOT EXISTS preset_rules (
        id TEXT PRIMARY KEY,
        preset_id TEXT NOT NULL,
        rule_order INTEGER NOT NULL,
        premise TEXT NOT NULL,
        action_params TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE,
        UNIQUE (preset_id, rule_order)
      );
    `;
  }

  private createTablePresetAdHocDocuments(): string {
    return `
      CREATE TABLE IF NOT EXISTS preset_ad_hoc_documents (
        preset_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        inclusion_order INTEGER NOT NULL,
        PRIMARY KEY (preset_id, document_id),
        FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        UNIQUE (preset_id, inclusion_order)
      );
    `;
  }

  async getCurrentVersion(connection: SqlConnection): Promise<{ ok: true; value: number } | MigrationError> {
    try {
      const rows = await connection.execute(
        'SELECT version FROM _migrations ORDER BY version DESC LIMIT 1',
        []
      );

      if (rows.length === 0) return { ok: true, value: 0 };

      const version = (rows[0] as { version: number }).version;
      return { ok: true, value: version };
    } catch {
      // Table doesn't exist yet
      return { ok: true, value: 0 };
    }
  }

  getAvailableMigrations(): Migration[] {
    return [...this.migrations];
  }

  getMigration(version: number): Migration | undefined {
    return this.migrations.find(m => m.version === version);
  }

  async runMigration(connection: SqlConnection, version: number): Promise<{ ok: true } | MigrationError> {
    const migration = this.getMigration(version);
    if (!migration) {
      return { ok: false, error: `Migration ${version} not found` };
    }

    try {
      // Split by semicolon and execute each statement
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const sql of statements) {
        await connection.executeUpdate(sql, []);
      }

      // Record migration
      await connection.executeUpdate('INSERT INTO _migrations (version) VALUES (?)', [version]);

      return { ok: true };
    } catch (error) {
      return { ok: false, error: `Migration ${version} failed: ${error}` };
    }
  }

  async runMigrations(
    connection: SqlConnection,
    targetVersion: number
  ): Promise<{ ok: true } | MigrationError> {
    const currentResult = await this.getCurrentVersion(connection);
    if (!currentResult.ok) return currentResult;

    const currentVersion = currentResult.value;

    if (currentVersion >= targetVersion) {
      return { ok: true };
    }

    for (let v = currentVersion + 1; v <= targetVersion; v++) {
      const result = await this.runMigration(connection, v);
      if (!result.ok) return result;
    }

    return { ok: true };
  }
}
