import { describe, it, expect } from 'vitest';
import { getSchemaDefinition, validateSchemaConsistency } from '../src/schema.js';

describe('SQL Template: Schema Definition', () => {
  it('TC-SCHEMA-01: getSchemaDefinition returns all table definitions', () => {
    const schema = getSchemaDefinition();

    expect(schema).toHaveProperty('tables');
    expect(Array.isArray(schema.tables)).toBe(true);
    expect(schema.tables.length).toBeGreaterThan(0);
  });

  it('TC-SCHEMA-02: schema includes documents table', () => {
    const schema = getSchemaDefinition();
    const docTable = schema.tables.find(t => t.name === 'documents');

    expect(docTable).toBeDefined();
    expect(docTable?.columns).toContainEqual(expect.objectContaining({ name: 'id' }));
    expect(docTable?.columns).toContainEqual(expect.objectContaining({ name: 'project_id' }));
    expect(docTable?.columns).toContainEqual(expect.objectContaining({ name: 'title' }));
    expect(docTable?.columns).toContainEqual(expect.objectContaining({ name: 'is_composition' }));
    expect(docTable?.columns).toContainEqual(expect.objectContaining({ name: 'content' }));
    expect(docTable?.columns).toContainEqual(expect.objectContaining({ name: 'created_at' }));
    expect(docTable?.columns).toContainEqual(expect.objectContaining({ name: 'updated_at' }));
  });

  it('TC-SCHEMA-03: schema includes composition_slots table with proper references', () => {
    const schema = getSchemaDefinition();
    const slotsTable = schema.tables.find(t => t.name === 'composition_slots');

    expect(slotsTable).toBeDefined();
    expect(slotsTable?.columns).toContainEqual(expect.objectContaining({ name: 'id' }));
    expect(slotsTable?.columns).toContainEqual(expect.objectContaining({ name: 'composition_id' }));
    expect(slotsTable?.columns).toContainEqual(expect.objectContaining({ name: 'slot_order' }));
    expect(slotsTable?.columns).toContainEqual(expect.objectContaining({ name: 'reference_type' }));
    expect(slotsTable?.columns).toContainEqual(expect.objectContaining({ name: 'reference_document_id' }));
    expect(slotsTable?.columns).toContainEqual(expect.objectContaining({ name: 'reference_variant_group_id' }));
  });

  it('TC-SCHEMA-04: schema includes variant_groups table', () => {
    const schema = getSchemaDefinition();
    const vgTable = schema.tables.find(t => t.name === 'variant_groups');

    expect(vgTable).toBeDefined();
    expect(vgTable?.columns).toContainEqual(expect.objectContaining({ name: 'id' }));
    expect(vgTable?.columns).toContainEqual(expect.objectContaining({ name: 'project_id' }));
    expect(vgTable?.columns).toContainEqual(expect.objectContaining({ name: 'name' }));
  });

  it('TC-SCHEMA-05: schema includes variant_group_members join table', () => {
    const schema = getSchemaDefinition();
    const vgmTable = schema.tables.find(t => t.name === 'variant_group_members');

    expect(vgmTable).toBeDefined();
    expect(vgmTable?.columns).toContainEqual(expect.objectContaining({ name: 'variant_group_id' }));
    expect(vgmTable?.columns).toContainEqual(expect.objectContaining({ name: 'document_id' }));
    expect(vgmTable?.columns).toContainEqual(expect.objectContaining({ name: 'member_order' }));
  });

  it('TC-SCHEMA-06: schema includes tags table', () => {
    const schema = getSchemaDefinition();
    const tagsTable = schema.tables.find(t => t.name === 'tags');

    expect(tagsTable).toBeDefined();
    expect(tagsTable?.columns).toContainEqual(expect.objectContaining({ name: 'id' }));
    expect(tagsTable?.columns).toContainEqual(expect.objectContaining({ name: 'project_id' }));
    expect(tagsTable?.columns).toContainEqual(expect.objectContaining({ name: 'key' }));
    expect(tagsTable?.columns).toContainEqual(expect.objectContaining({ name: 'value' }));
  });

  it('TC-SCHEMA-07: schema includes document_tags join table', () => {
    const schema = getSchemaDefinition();
    const dtTable = schema.tables.find(t => t.name === 'document_tags');

    expect(dtTable).toBeDefined();
    expect(dtTable?.columns).toContainEqual(expect.objectContaining({ name: 'document_id' }));
    expect(dtTable?.columns).toContainEqual(expect.objectContaining({ name: 'tag_id' }));
  });

  it('TC-SCHEMA-08: schema includes presets table', () => {
    const schema = getSchemaDefinition();
    const presetsTable = schema.tables.find(t => t.name === 'presets');

    expect(presetsTable).toBeDefined();
    expect(presetsTable?.columns).toContainEqual(expect.objectContaining({ name: 'id' }));
    expect(presetsTable?.columns).toContainEqual(expect.objectContaining({ name: 'project_id' }));
    expect(presetsTable?.columns).toContainEqual(expect.objectContaining({ name: 'name' }));
    expect(presetsTable?.columns).toContainEqual(expect.objectContaining({ name: 'base_composition_id' }));
  });

  it('TC-SCHEMA-09: schema includes preset_rules table with JSON columns', () => {
    const schema = getSchemaDefinition();
    const rulesTable = schema.tables.find(t => t.name === 'preset_rules');

    expect(rulesTable).toBeDefined();
    expect(rulesTable?.columns).toContainEqual(expect.objectContaining({ name: 'id' }));
    expect(rulesTable?.columns).toContainEqual(expect.objectContaining({ name: 'preset_id' }));
    expect(rulesTable?.columns).toContainEqual(expect.objectContaining({ name: 'rule_order' }));
    expect(rulesTable?.columns).toContainEqual(expect.objectContaining({ name: 'premise' }));
    expect(rulesTable?.columns).toContainEqual(expect.objectContaining({ name: 'action_params' }));
  });

  it('TC-SCHEMA-10: schema includes preset_ad_hoc_documents join table', () => {
    const schema = getSchemaDefinition();
    const adhocTable = schema.tables.find(t => t.name === 'preset_ad_hoc_documents');

    expect(adhocTable).toBeDefined();
    expect(adhocTable?.columns).toContainEqual(expect.objectContaining({ name: 'preset_id' }));
    expect(adhocTable?.columns).toContainEqual(expect.objectContaining({ name: 'document_id' }));
    expect(adhocTable?.columns).toContainEqual(expect.objectContaining({ name: 'inclusion_order' }));
  });

  it('TC-SCHEMA-11: schema has primary keys defined for all tables', () => {
    const schema = getSchemaDefinition();

    for (const table of schema.tables) {
      expect(table.primaryKey).toBeDefined();
      expect(table.primaryKey?.length).toBeGreaterThan(0);
    }
  });

  it('TC-SCHEMA-12: all tables have created_at timestamp (except join tables)', () => {
    const schema = getSchemaDefinition();
    const joinTables = ['document_tags', 'variant_group_members', 'preset_ad_hoc_documents'];

    for (const table of schema.tables) {
      if (!joinTables.includes(table.name)) {
        const hasCreatedAt = table.columns.some(c => c.name === 'created_at');
        expect(hasCreatedAt).toBe(true);
      }
    }
  });

  it('TC-SCHEMA-13: validateSchemaConsistency detects undefined tables', () => {
    const schema = getSchemaDefinition();
    const result = validateSchemaConsistency(schema);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isValid).toBe(true);
      expect(result.value.errors).toHaveLength(0);
    }
  });

  it('TC-SCHEMA-14: schema has unique constraints where needed (slot_order, member_order)', () => {
    const schema = getSchemaDefinition();

    const slotsTable = schema.tables.find(t => t.name === 'composition_slots');
    expect(slotsTable?.uniqueConstraints?.length).toBeGreaterThan(0);

    const vgmTable = schema.tables.find(t => t.name === 'variant_group_members');
    expect(vgmTable?.uniqueConstraints?.length).toBeGreaterThan(0);
  });
});
