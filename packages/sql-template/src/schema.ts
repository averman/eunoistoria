/**
 * SQL Schema definitions for all tables.
 */

export interface ColumnDef {
  name: string;
  type: string; // 'TEXT', 'INTEGER', 'REAL', 'BLOB', 'JSONB', etc.
  nullable?: boolean;
  default?: string | number;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  primaryKey: string[];
  foreignKeys?: Array<{
    columns: string[];
    referenceTable: string;
    referenceColumns: string[];
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  }>;
  uniqueConstraints?: Array<{
    columns: string[];
    name?: string;
  }>;
  checkConstraints?: Array<{
    condition: string;
    name?: string;
  }>;
  indexes?: Array<{
    columns: string[];
    name?: string;
    unique?: boolean;
  }>;
}

export interface SchemaDef {
  version: number;
  tables: TableDef[];
}

export function getSchemaDefinition(): SchemaDef {
  return {
    version: 1,
    tables: [
      // Documents table - leaf or composition
      {
        name: 'documents',
        columns: [
          { name: 'id', type: 'TEXT' },
          { name: 'project_id', type: 'TEXT' },
          { name: 'title', type: 'TEXT' },
          { name: 'alias', type: 'TEXT', nullable: true },
          { name: 'is_composition', type: 'INTEGER' }, // 0 = leaf, 1 = composition
          { name: 'content', type: 'TEXT', nullable: true }, // null for compositions
          { name: 'created_at', type: 'TEXT' },
          { name: 'updated_at', type: 'TEXT' },
        ],
        primaryKey: ['id'],
        indexes: [
          { columns: ['project_id'], name: 'idx_documents_project_id' },
          { columns: ['created_at'], name: 'idx_documents_created_at' },
        ],
        checkConstraints: [
          {
            condition: '(is_composition = 0 AND content IS NOT NULL) OR (is_composition = 1 AND content IS NULL)',
            name: 'check_document_kind',
          },
        ],
      },

      // Composition slots - ordered references within a composition
      {
        name: 'composition_slots',
        columns: [
          { name: 'id', type: 'TEXT' },
          { name: 'composition_id', type: 'TEXT' },
          { name: 'slot_order', type: 'INTEGER' },
          { name: 'reference_type', type: 'TEXT' }, // 'document' or 'variant_group'
          { name: 'reference_document_id', type: 'TEXT', nullable: true },
          { name: 'reference_variant_group_id', type: 'TEXT', nullable: true },
          { name: 'created_at', type: 'TEXT' },
        ],
        primaryKey: ['id'],
        foreignKeys: [
          {
            columns: ['composition_id'],
            referenceTable: 'documents',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columns: ['reference_document_id'],
            referenceTable: 'documents',
            referenceColumns: ['id'],
            onDelete: 'SET NULL',
          },
          {
            columns: ['reference_variant_group_id'],
            referenceTable: 'variant_groups',
            referenceColumns: ['id'],
            onDelete: 'SET NULL',
          },
        ],
        uniqueConstraints: [
          {
            columns: ['composition_id', 'slot_order'],
            name: 'unique_slot_order',
          },
        ],
        indexes: [{ columns: ['composition_id'], name: 'idx_slots_composition' }],
      },

      // Variant groups - named sets of documents
      {
        name: 'variant_groups',
        columns: [
          { name: 'id', type: 'TEXT' },
          { name: 'project_id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'created_at', type: 'TEXT' },
        ],
        primaryKey: ['id'],
        indexes: [{ columns: ['project_id'], name: 'idx_variant_groups_project' }],
      },

      // Variant group members - join table with ordering
      {
        name: 'variant_group_members',
        columns: [
          { name: 'variant_group_id', type: 'TEXT' },
          { name: 'document_id', type: 'TEXT' },
          { name: 'member_order', type: 'INTEGER' },
          { name: 'created_at', type: 'TEXT' },
        ],
        primaryKey: ['variant_group_id', 'document_id'],
        foreignKeys: [
          {
            columns: ['variant_group_id'],
            referenceTable: 'variant_groups',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columns: ['document_id'],
            referenceTable: 'documents',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniqueConstraints: [
          {
            columns: ['variant_group_id', 'member_order'],
            name: 'unique_member_order',
          },
        ],
        indexes: [{ columns: ['variant_group_id', 'member_order'] }],
      },

      // Tags - key-value pairs
      {
        name: 'tags',
        columns: [
          { name: 'id', type: 'TEXT' },
          { name: 'project_id', type: 'TEXT' },
          { name: 'key', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
          { name: 'created_at', type: 'TEXT' },
        ],
        primaryKey: ['id'],
        indexes: [
          { columns: ['project_id', 'key'], name: 'idx_tags_project_key' },
          { columns: ['project_id', 'key', 'value'], name: 'idx_tags_project_key_value' },
        ],
      },

      // Document tags - join table
      {
        name: 'document_tags',
        columns: [
          { name: 'document_id', type: 'TEXT' },
          { name: 'tag_id', type: 'TEXT' },
        ],
        primaryKey: ['document_id', 'tag_id'],
        foreignKeys: [
          {
            columns: ['document_id'],
            referenceTable: 'documents',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columns: ['tag_id'],
            referenceTable: 'tags',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indexes: [{ columns: ['tag_id'], name: 'idx_document_tags_tag' }],
      },

      // Presets - named rule configurations
      {
        name: 'presets',
        columns: [
          { name: 'id', type: 'TEXT' },
          { name: 'project_id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'base_composition_id', type: 'TEXT' },
          { name: 'created_at', type: 'TEXT' },
          { name: 'updated_at', type: 'TEXT' },
        ],
        primaryKey: ['id'],
        foreignKeys: [
          {
            columns: ['base_composition_id'],
            referenceTable: 'documents',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indexes: [{ columns: ['project_id'], name: 'idx_presets_project' }],
      },

      // Preset rules - ordered rules within a preset (stored as JSON)
      {
        name: 'preset_rules',
        columns: [
          { name: 'id', type: 'TEXT' },
          { name: 'preset_id', type: 'TEXT' },
          { name: 'rule_order', type: 'INTEGER' },
          { name: 'premise', type: 'TEXT' }, // JSON
          { name: 'action_params', type: 'TEXT' }, // JSON
          { name: 'created_at', type: 'TEXT' },
        ],
        primaryKey: ['id'],
        foreignKeys: [
          {
            columns: ['preset_id'],
            referenceTable: 'presets',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniqueConstraints: [
          {
            columns: ['preset_id', 'rule_order'],
            name: 'unique_rule_order',
          },
        ],
      },

      // Preset ad-hoc documents - join table for manual context inclusion
      {
        name: 'preset_ad_hoc_documents',
        columns: [
          { name: 'preset_id', type: 'TEXT' },
          { name: 'document_id', type: 'TEXT' },
          { name: 'inclusion_order', type: 'INTEGER' },
        ],
        primaryKey: ['preset_id', 'document_id'],
        foreignKeys: [
          {
            columns: ['preset_id'],
            referenceTable: 'presets',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columns: ['document_id'],
            referenceTable: 'documents',
            referenceColumns: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniqueConstraints: [
          {
            columns: ['preset_id', 'inclusion_order'],
            name: 'unique_inclusion_order',
          },
        ],
      },
    ],
  };
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateSchemaConsistency(schema: SchemaDef): {
  ok: true;
  value: SchemaValidationResult;
} {
  const errors: string[] = [];
  const tableNames = new Set(schema.tables.map(t => t.name));

  for (const table of schema.tables) {
    // Validate foreign keys reference existing tables
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        if (!tableNames.has(fk.referenceTable)) {
          errors.push(`Table ${table.name}: foreign key references non-existent table ${fk.referenceTable}`);
        }
      }
    }

    // Validate primary keys exist as columns
    for (const pkCol of table.primaryKey) {
      if (!table.columns.some(c => c.name === pkCol)) {
        errors.push(`Table ${table.name}: primary key column ${pkCol} not defined`);
      }
    }

    // Validate unique constraints reference existing columns
    if (table.uniqueConstraints) {
      for (const uc of table.uniqueConstraints) {
        for (const col of uc.columns) {
          if (!table.columns.some(c => c.name === col)) {
            errors.push(`Table ${table.name}: unique constraint references non-existent column ${col}`);
          }
        }
      }
    }

    // Validate indexes reference existing columns
    if (table.indexes) {
      for (const idx of table.indexes) {
        for (const col of idx.columns) {
          if (!table.columns.some(c => c.name === col)) {
            errors.push(`Table ${table.name}: index references non-existent column ${col}`);
          }
        }
      }
    }
  }

  return {
    ok: true,
    value: {
      isValid: errors.length === 0,
      errors,
    },
  };
}
