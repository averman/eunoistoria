import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteDataStore } from '../src/data-store.js';
import { DocumentId, SlotId, VariantGroupId, PresetId, TagId, DataStoreError } from '@eunoistoria/types';

function makeDocId(s: string): DocumentId { return s as DocumentId; }
function makeSlotId(s: string): SlotId { return s as SlotId; }
function makeVgId(s: string): VariantGroupId { return s as VariantGroupId; }
function makePresetId(s: string): PresetId { return s as PresetId; }
function makeTagId(s: string): TagId { return s as TagId; }

describe('SQLite Adapter: DataStore', () => {
  let store: SqliteDataStore;

  beforeEach(async () => {
    store = new SqliteDataStore(':memory:');
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  describe('listDocuments titleContains filter', () => {
    it('TC-FIX-01: titleContains searches title field (case-insensitive)', async () => {
      await store.createDocument({
        projectId: 'proj1',
        title: 'Chapter 1',
        isComposition: false,
        content: 'Content A',
      });
      await store.createDocument({
        projectId: 'proj1',
        title: 'Introduction',
        isComposition: false,
        content: 'Content B',
      });
      await store.createDocument({
        projectId: 'proj1',
        title: 'Chapter 2',
        isComposition: false,
        content: 'Content C',
      });

      const result = await store.listDocuments('proj1', { titleContains: 'chapter' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.map(d => d.title)).toContain('Chapter 1');
        expect(result.value.map(d => d.title)).toContain('Chapter 2');
        expect(result.value.map(d => d.title)).not.toContain('Introduction');
      }
    });

    it('TC-FIX-02: titleContains searches alias field', async () => {
      await store.createDocument({
        projectId: 'proj1',
        title: 'Doc A',
        alias: 'ch1, scene1',
        isComposition: false,
        content: 'Content A',
      });
      await store.createDocument({
        projectId: 'proj1',
        title: 'Doc B',
        alias: 'intro, opening',
        isComposition: false,
        content: 'Content B',
      });
      await store.createDocument({
        projectId: 'proj1',
        title: 'Doc C',
        alias: 'ch2, scene2',
        isComposition: false,
        content: 'Content C',
      });

      const result = await store.listDocuments('proj1', { titleContains: 'scene' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.map(d => d.alias)).toContain('ch1, scene1');
        expect(result.value.map(d => d.alias)).toContain('ch2, scene2');
      }
    });

    it('TC-FIX-03: titleContains combined with isComposition filter', async () => {
      await store.createDocument({
        projectId: 'proj1',
        title: 'Chapter 1',
        isComposition: false,
        content: 'Content',
      });
      await store.createDocument({
        projectId: 'proj1',
        title: 'Chapter Book',
        isComposition: true,
      });

      const result = await store.listDocuments('proj1', {
        titleContains: 'chapter',
        isComposition: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].title).toBe('Chapter 1');
        expect(result.value[0].isComposition).toBe(false);
      }
    });

    it('TC-FIX-04: titleContains with no matches returns empty array', async () => {
      await store.createDocument({
        projectId: 'proj1',
        title: 'Chapter 1',
        isComposition: false,
        content: 'Content',
      });

      const result = await store.listDocuments('proj1', { titleContains: 'nonexistent' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('TC-FIX-05: titleContains SQL injection resistance', async () => {
      await store.createDocument({
        projectId: 'proj1',
        title: 'Chapter 1',
        isComposition: false,
        content: 'Content',
      });

      const result = await store.listDocuments('proj1', {
        titleContains: "'; DROP TABLE documents; --",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }

      // Verify table still exists by listing normally
      const verify = await store.listDocuments('proj1', {});
      expect(verify.ok).toBe(true);
      if (verify.ok) {
        expect(verify.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Document operations', () => {
    it('TC-DS-01: createDocument inserts and returns document', async () => {
      const result = await store.createDocument({
        projectId: 'proj1',
        title: 'Test Doc',
        isComposition: false,
        content: 'Hello World',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveProperty('id');
        expect(result.value).toHaveProperty('title', 'Test Doc');
        expect(result.value).toHaveProperty('content', 'Hello World');
        expect(result.value).toHaveProperty('isComposition', false);
      }
    });

    it('TC-DS-02: getDocument retrieves created document', async () => {
      const created = await store.createDocument({
        projectId: 'proj1',
        title: 'Test',
        isComposition: false,
        content: 'Content',
      });

      if (!created.ok) throw new Error('Create failed');

      const retrieved = await store.getDocument(created.value.id);
      expect(retrieved.ok).toBe(true);
      if (retrieved.ok) {
        expect(retrieved.value.title).toBe('Test');
        expect(retrieved.value.content).toBe('Content');
      }
    });

    it('TC-DS-03: getDocument returns NotFound for missing document', async () => {
      const result = await store.getDocument(makeDocId('nonexistent'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(DataStoreError.NotFound);
      }
    });

    it('TC-DS-04: updateDocument modifies content', async () => {
      const created = await store.createDocument({
        projectId: 'proj1',
        title: 'Original',
        isComposition: false,
        content: 'Original Content',
      });

      if (!created.ok) throw new Error('Create failed');

      const updated = await store.updateDocument(created.value.id, {
        title: 'Updated',
        content: 'Updated Content',
      });

      expect(updated.ok).toBe(true);
      if (updated.ok) {
        expect(updated.value.title).toBe('Updated');
        expect(updated.value.content).toBe('Updated Content');
      }
    });

    it('TC-DS-05: deleteDocument removes document', async () => {
      const created = await store.createDocument({
        projectId: 'proj1',
        title: 'To Delete',
        isComposition: false,
        content: 'Content',
      });

      if (!created.ok) throw new Error('Create failed');

      const deleted = await store.deleteDocument(created.value.id);
      expect(deleted.ok).toBe(true);

      const retrieved = await store.getDocument(created.value.id);
      expect(retrieved.ok).toBe(false);
    });

    it('TC-DS-06: listDocuments returns all documents in project', async () => {
      await store.createDocument({
        projectId: 'proj1',
        title: 'Doc1',
        isComposition: false,
        content: 'Content1',
      });
      await store.createDocument({
        projectId: 'proj1',
        title: 'Doc2',
        isComposition: false,
        content: 'Content2',
      });
      await store.createDocument({
        projectId: 'proj2',
        title: 'Doc3',
        isComposition: false,
        content: 'Content3',
      });

      const result = await store.listDocuments('proj1', {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.every(d => d.projectId === 'proj1')).toBe(true);
      }
    });

    it('TC-DS-07: createComposition creates composition without content', async () => {
      const result = await store.createDocument({
        projectId: 'proj1',
        title: 'Composition',
        isComposition: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isComposition).toBe(true);
        expect(result.value.content).toBeNull();
      }
    });
  });

  describe('Slot operations', () => {
    it('TC-DS-08: createSlot with document reference', async () => {
      const comp = await store.createDocument({
        projectId: 'proj1',
        title: 'Comp',
        isComposition: true,
      });
      const doc = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc',
        isComposition: false,
        content: 'C',
      });

      if (!comp.ok || !doc.ok) throw new Error('Create failed');

      const result = await store.createSlot(comp.value.id, {
        referenceType: 'document',
        referenceDocumentId: doc.value.id,
      });

      expect(result.ok).toBe(true);
    });

    it('TC-DS-09: listSlots returns ordered slots', async () => {
      const comp = await store.createDocument({
        projectId: 'proj1',
        title: 'Comp',
        isComposition: true,
      });
      const doc1 = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc1',
        isComposition: false,
        content: 'C1',
      });
      const doc2 = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc2',
        isComposition: false,
        content: 'C2',
      });

      if (!comp.ok || !doc1.ok || !doc2.ok) throw new Error('Create failed');

      await store.createSlot(comp.value.id, {
        referenceType: 'document',
        referenceDocumentId: doc1.value.id,
      });
      await store.createSlot(comp.value.id, {
        referenceType: 'document',
        referenceDocumentId: doc2.value.id,
      });

      const result = await store.listSlots(comp.value.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('TC-DS-10: deleteSlot removes slot', async () => {
      const comp = await store.createDocument({
        projectId: 'proj1',
        title: 'Comp',
        isComposition: true,
      });
      const doc = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc',
        isComposition: false,
        content: 'C',
      });

      if (!comp.ok || !doc.ok) throw new Error('Create failed');

      const slot = await store.createSlot(comp.value.id, {
        referenceType: 'document',
        referenceDocumentId: doc.value.id,
      });

      if (!slot.ok) throw new Error('Slot create failed');

      const deleted = await store.deleteSlot(slot.value.id);
      expect(deleted.ok).toBe(true);

      const list = await store.listSlots(comp.value.id);
      if (list.ok) {
        expect(list.value).toHaveLength(0);
      }
    });
  });

  describe('Variant Group operations', () => {
    it('TC-DS-11: createVariantGroup inserts group', async () => {
      const result = await store.createVariantGroup({
        projectId: 'proj1',
        name: 'Languages',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveProperty('name', 'Languages');
      }
    });

    it('TC-DS-12: addMember adds document to variant group', async () => {
      const vg = await store.createVariantGroup({
        projectId: 'proj1',
        name: 'VG',
      });
      const doc = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc',
        isComposition: false,
        content: 'C',
      });

      if (!vg.ok || !doc.ok) throw new Error('Create failed');

      const result = await store.addMember(vg.value.id, doc.value.id);
      expect(result.ok).toBe(true);
    });

    it('TC-DS-13: getVariantGroupMembers returns members in order', async () => {
      const vg = await store.createVariantGroup({
        projectId: 'proj1',
        name: 'VG',
      });
      const doc1 = await store.createDocument({
        projectId: 'proj1',
        title: 'D1',
        isComposition: false,
        content: 'C1',
      });
      const doc2 = await store.createDocument({
        projectId: 'proj1',
        title: 'D2',
        isComposition: false,
        content: 'C2',
      });

      if (!vg.ok || !doc1.ok || !doc2.ok) throw new Error('Create failed');

      await store.addMember(vg.value.id, doc1.value.id);
      await store.addMember(vg.value.id, doc2.value.id);

      const result = await store.getVariantGroupMembers(vg.value.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toBe(doc1.value.id);
        expect(result.value[1]).toBe(doc2.value.id);
      }
    });
  });

  describe('Tag operations', () => {
    it('TC-DS-14: assignTag creates tag and assigns to document', async () => {
      const doc = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc',
        isComposition: false,
        content: 'C',
      });

      if (!doc.ok) throw new Error('Create failed');

      const result = await store.assignTag(doc.value.id, 'lang', 'en');
      expect(result.ok).toBe(true);
    });

    it('TC-DS-15: getTagsForDocument returns all tags', async () => {
      const doc = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc',
        isComposition: false,
        content: 'C',
      });

      if (!doc.ok) throw new Error('Create failed');

      await store.assignTag(doc.value.id, 'lang', 'en');
      await store.assignTag(doc.value.id, 'chapter', '5');

      const result = await store.getTagsForDocument(doc.value.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('TC-DS-16: searchTags finds tags by project', async () => {
      const doc = await store.createDocument({
        projectId: 'proj1',
        title: 'Doc',
        isComposition: false,
        content: 'C',
      });

      if (!doc.ok) throw new Error('Create failed');

      await store.assignTag(doc.value.id, 'lang', 'en');
      await store.assignTag(doc.value.id, 'lang', 'ja');

      const result = await store.searchTags('proj1', 'lang');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Preset operations', () => {
    it('TC-DS-17: createPreset creates preset', async () => {
      const comp = await store.createDocument({
        projectId: 'proj1',
        title: 'Comp',
        isComposition: true,
      });

      if (!comp.ok) throw new Error('Create failed');

      const result = await store.createPreset({
        projectId: 'proj1',
        name: 'My Preset',
        baseCompositionId: comp.value.id,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveProperty('name', 'My Preset');
      }
    });

    it('TC-DS-18: addPresetRule adds rule with JSON', async () => {
      const comp = await store.createDocument({
        projectId: 'proj1',
        title: 'Comp',
        isComposition: true,
      });

      if (!comp.ok) throw new Error('Create failed');

      const preset = await store.createPreset({
        projectId: 'proj1',
        name: 'Preset',
        baseCompositionId: comp.value.id,
      });

      if (!preset.ok) throw new Error('Preset create failed');

      const result = await store.addPresetRule(preset.value.id, {
        premise: { op: 'true' },
        actionParams: { type: 'toggle_off' },
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('Transactions', () => {
    it('TC-DS-19: multiple operations in transaction', async () => {
      const result = await store.transaction(async (tx) => {
        const doc1 = await tx.createDocument({
          projectId: 'proj1',
          title: 'Doc1',
          isComposition: false,
          content: 'C1',
        });

        const doc2 = await tx.createDocument({
          projectId: 'proj1',
          title: 'Doc2',
          isComposition: false,
          content: 'C2',
        });

        return { ok: doc1.ok && doc2.ok };
      });

      expect(result.ok).toBe(true);
    });
  });
});
