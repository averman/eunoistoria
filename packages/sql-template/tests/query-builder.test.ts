import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../src/query-builder.js';
import { DocumentId, SlotId, VariantGroupId, PresetId, TagId } from '@eunoistoria/types';

function makeDocId(s: string): DocumentId { return s as DocumentId; }
function makeSlotId(s: string): SlotId { return s as SlotId; }
function makeVgId(s: string): VariantGroupId { return s as VariantGroupId; }
function makePresetId(s: string): PresetId { return s as PresetId; }
function makeTagId(s: string): TagId { return s as TagId; }

describe('SQL Template: Query Builder', () => {
  let qb: QueryBuilder;

  beforeEach(() => {
    qb = new QueryBuilder('?'); // SQLite-style placeholders for tests
  });

  describe('Document Queries', () => {
    it('TC-QB-01: buildGetDocument generates SELECT with tags', () => {
      const query = qb.buildGetDocument(makeDocId('doc1'));

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('documents');
      expect(query.params).toContain('doc1');
    });

    it('TC-QB-02: buildListDocuments returns parameterized query', () => {
      const query = qb.buildListDocuments('proj1', {});

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('documents');
      expect(query.params[0]).toBe('proj1');
    });

    it('TC-QB-03: buildCreateDocument has correct INSERT structure', () => {
      const query = qb.buildCreateDocument({
        id: makeDocId('doc1'),
        projectId: 'proj1',
        title: 'Test Doc',
        isComposition: false,
        content: 'Hello',
      });

      expect(query.sql).toContain('INSERT');
      expect(query.sql).toContain('documents');
      expect(query.params).toContain('doc1');
      expect(query.params).toContain('proj1');
      expect(query.params).toContain('Test Doc');
    });

    it('TC-QB-04: buildUpdateDocument generates UPDATE with null handling', () => {
      const query = qb.buildUpdateDocument(makeDocId('doc1'), {
        title: 'Updated',
        content: null,
      });

      expect(query.sql).toContain('UPDATE');
      expect(query.sql).toContain('documents');
      expect(query.params).toContain('Updated');
    });

    it('TC-QB-05: buildDeleteDocument generates DELETE with single parameter', () => {
      const query = qb.buildDeleteDocument(makeDocId('doc1'));

      expect(query.sql).toContain('DELETE');
      expect(query.sql).toContain('documents');
      expect(query.params).toEqual(['doc1']);
    });
  });

  describe('Slot Queries', () => {
    it('TC-QB-06: buildListSlots orders by slot_order', () => {
      const query = qb.buildListSlots(makeDocId('comp1'));

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('composition_slots');
      expect(query.sql).toContain('slot_order');
      expect(query.params).toContain('comp1');
    });

    it('TC-QB-07: buildCreateSlot with document reference', () => {
      const query = qb.buildCreateSlot({
        id: makeSlotId('slot1'),
        compositionId: makeDocId('comp1'),
        slotOrder: 0,
        referenceType: 'document',
        referenceDocumentId: makeDocId('doc1'),
      });

      expect(query.sql).toContain('INSERT');
      expect(query.params).toContain('slot1');
      expect(query.params).toContain('document');
    });

    it('TC-QB-08: buildCreateSlot with variant group reference', () => {
      const query = qb.buildCreateSlot({
        id: makeSlotId('slot2'),
        compositionId: makeDocId('comp1'),
        slotOrder: 1,
        referenceType: 'variant_group',
        referenceVariantGroupId: makeVgId('vg1'),
      });

      expect(query.sql).toContain('INSERT');
      expect(query.params).toContain('variant_group');
      expect(query.params).toContain('vg1');
    });

    it('TC-QB-09: buildReorderSlots generates UPDATE batch', () => {
      const query = qb.buildReorderSlots(makeDocId('comp1'), [
        makeSlotId('slot1'),
        makeSlotId('slot2'),
        makeSlotId('slot3'),
      ]);

      expect(query.sql).toContain('UPDATE');
      expect(query.params.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Variant Group Queries', () => {
    it('TC-QB-10: buildListVariantGroups filters by project', () => {
      const query = qb.buildListVariantGroups('proj1');

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('variant_groups');
      expect(query.params).toContain('proj1');
    });

    it('TC-QB-11: buildCreateVariantGroup inserts with name', () => {
      const query = qb.buildCreateVariantGroup({
        id: makeVgId('vg1'),
        projectId: 'proj1',
        name: 'Language Variants',
      });

      expect(query.sql).toContain('INSERT');
      expect(query.params).toContain('Language Variants');
    });

    it('TC-QB-12: buildListVariantGroupMembers orders by member_order', () => {
      const query = qb.buildListVariantGroupMembers(makeVgId('vg1'));

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('variant_group_members');
      expect(query.sql).toContain('member_order');
    });

    it('TC-QB-13: buildAddMember inserts into join table', () => {
      const query = qb.buildAddMember(makeVgId('vg1'), makeDocId('doc1'), 0);

      expect(query.sql).toContain('INSERT');
      expect(query.sql).toContain('variant_group_members');
      expect(query.params).toContain('vg1');
      expect(query.params).toContain('doc1');
      expect(query.params).toContain(0);
    });

    it('TC-QB-14: buildRemoveMember deletes from join table', () => {
      const query = qb.buildRemoveMember(makeVgId('vg1'), makeDocId('doc1'));

      expect(query.sql).toContain('DELETE');
      expect(query.sql).toContain('variant_group_members');
      expect(query.params).toContain('vg1');
    });

    it('TC-QB-15: buildReorderMembers generates UPDATE batch', () => {
      const query = qb.buildReorderMembers(makeVgId('vg1'), [
        makeDocId('doc1'),
        makeDocId('doc2'),
      ]);

      expect(query.sql).toContain('UPDATE');
      expect(query.params.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Tag Queries', () => {
    it('TC-QB-16: buildSearchTags with key and value filters', () => {
      const query = qb.buildSearchTags('proj1', 'lang', 'ja');

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('tags');
      expect(query.params).toContain('proj1');
      expect(query.params).toContain('lang');
      expect(query.params).toContain('ja');
    });

    it('TC-QB-17: buildGetTagsForDocument joins with document_tags', () => {
      const query = qb.buildGetTagsForDocument(makeDocId('doc1'));

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('tags');
      expect(query.sql).toContain('document_tags');
    });

    it('TC-QB-18: buildAssignTag creates or updates', () => {
      const query = qb.buildAssignTag(makeDocId('doc1'), 'lang', 'en');

      expect(query.sql).toContain('INSERT');
      expect(query.params).toContain('lang');
      expect(query.params).toContain('en');
    });

    it('TC-QB-19: buildRemoveTag deletes by tag_id', () => {
      const query = qb.buildRemoveTag(makeTagId('tag1'));

      expect(query.sql).toContain('DELETE');
      expect(query.params).toContain('tag1');
    });
  });

  describe('Preset Queries', () => {
    it('TC-QB-20: buildCreatePreset inserts with base_composition_id', () => {
      const query = qb.buildCreatePreset({
        id: makePresetId('pre1'),
        projectId: 'proj1',
        name: 'Context Preset',
        baseCompositionId: makeDocId('comp1'),
      });

      expect(query.sql).toContain('INSERT');
      expect(query.sql).toContain('presets');
      expect(query.params).toContain('comp1');
    });

    it('TC-QB-21: buildAddPresetRule inserts JSON premise and action', () => {
      const query = qb.buildAddPresetRule(makePresetId('pre1'), 0, {
        premise: { op: 'true' },
        actionParams: { type: 'toggle_off' },
      });

      expect(query.sql).toContain('INSERT');
      expect(query.sql).toContain('preset_rules');
      expect(query.params).toContain(0); // rule_order
    });

    it('TC-QB-22: buildListPresetRules orders by rule_order', () => {
      const query = qb.buildListPresetRules(makePresetId('pre1'));

      expect(query.sql).toContain('SELECT');
      expect(query.sql).toContain('preset_rules');
      expect(query.sql).toContain('rule_order');
    });

    it('TC-QB-23: buildAddAdHocDocument inserts into join table', () => {
      const query = qb.buildAddAdHocDocument(makePresetId('pre1'), makeDocId('doc1'), 0);

      expect(query.sql).toContain('INSERT');
      expect(query.sql).toContain('preset_ad_hoc_documents');
    });
  });

  describe('Parameter Placeholder Style', () => {
    it('TC-QB-24: uses correct placeholder for SQLite (?)', () => {
      const sqlite = new QueryBuilder('?');
      const query = sqlite.buildCreateDocument({
        id: makeDocId('d1'),
        projectId: 'p1',
        title: 'T',
        isComposition: false,
        content: 'C',
      });

      expect(query.sql).toContain('?');
      expect(query.sql).not.toContain('$');
    });

    it('TC-QB-25: uses correct placeholder for Postgres ($n)', () => {
      const postgres = new QueryBuilder('$');
      const query = postgres.buildCreateDocument({
        id: makeDocId('d1'),
        projectId: 'p1',
        title: 'T',
        isComposition: false,
        content: 'C',
      });

      expect(query.sql).toContain('$');
    });
  });

  describe('Edge Cases', () => {
    it('TC-QB-26: handles empty filters in listDocuments', () => {
      const query = qb.buildListDocuments('proj1', {});

      expect(query.sql).toContain('SELECT');
      expect(query.params).toContain('proj1');
    });

    it('TC-QB-27: handles null content in updates', () => {
      const query = qb.buildUpdateDocument(makeDocId('doc1'), {
        content: null,
      });

      expect(query.sql).toContain('UPDATE');
      expect(query.params).toContain(null); // null passed as param, not in SQL
    });

    it('TC-QB-28: parameter count matches placeholder count', () => {
      const query = qb.buildCreateDocument({
        id: makeDocId('d1'),
        projectId: 'p1',
        title: 'T',
        isComposition: false,
        content: 'C',
      });

      const placeholderCount = (query.sql.match(/\?/g) || []).length;
      expect(query.params.length).toBe(placeholderCount);
    });
  });
});
