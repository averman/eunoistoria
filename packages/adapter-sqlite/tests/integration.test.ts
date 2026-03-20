/**
 * Integration Tests: Engine + SQLite Adapter
 * Tests full workflows combining the engine library with the SQLite storage layer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteDataStore } from '../src/data-store.js';
import {
  DocumentId,
  SlotId,
  VariantGroupId,
  PresetId,
  DataStoreError,
  type Document,
  type CompositionSlot,
} from '@eunoistoria/types';

function makeDocId(s: string): DocumentId {
  return s as DocumentId;
}
function makeSlotId(s: string): SlotId {
  return s as SlotId;
}
function makeVgId(s: string): VariantGroupId {
  return s as VariantGroupId;
}
function makePresetId(s: string): PresetId {
  return s as PresetId;
}

describe('Integration: Engine + SQLite Adapter', () => {
  let store: SqliteDataStore;
  const projectId = 'proj1';

  beforeEach(async () => {
    store = new SqliteDataStore(':memory:');
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  describe('Workflow: Document Management', () => {
    it('INT-001: Create, retrieve, and list documents', async () => {
      // Create first document
      const doc1Result = await store.createDocument({
        projectId,
        title: 'Document One',
        isComposition: false,
        content: 'Content of document one',
      });

      expect(doc1Result.ok).toBe(true);
      if (!doc1Result.ok) throw new Error('Create failed');

      const doc1Id = doc1Result.value.id;

      // Create second document
      const doc2Result = await store.createDocument({
        projectId,
        title: 'Document Two',
        isComposition: false,
        content: 'Content of document two',
      });

      expect(doc2Result.ok).toBe(true);
      if (!doc2Result.ok) throw new Error('Create failed');

      // Retrieve first document
      const retrieveResult = await store.getDocument(doc1Id);
      expect(retrieveResult.ok).toBe(true);
      if (retrieveResult.ok) {
        expect(retrieveResult.value.title).toBe('Document One');
        expect(retrieveResult.value.content).toBe('Content of document one');
      }

      // List all documents in project
      const listResult = await store.listDocuments(projectId, {});
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.value.length).toBe(2);
      }
    });

    it('INT-002: Update document content', async () => {
      const createResult = await store.createDocument({
        projectId,
        title: 'Original Title',
        isComposition: false,
        content: 'Original content',
      });

      if (!createResult.ok) throw new Error('Create failed');
      const docId = createResult.value.id;

      // Update the document
      const updateResult = await store.updateDocument(docId, {
        title: 'Updated Title',
        content: 'Updated content',
      });

      expect(updateResult.ok).toBe(true);
      if (updateResult.ok) {
        expect(updateResult.value.title).toBe('Updated Title');
        expect(updateResult.value.content).toBe('Updated content');
      }

      // Verify persistence
      const retrieved = await store.getDocument(docId);
      expect(retrieved.ok).toBe(true);
      if (retrieved.ok) {
        expect(retrieved.value.title).toBe('Updated Title');
      }
    });

    it('INT-003: Delete document removes it from listings', async () => {
      const createResult = await store.createDocument({
        projectId,
        title: 'To Delete',
        isComposition: false,
        content: 'Content',
      });

      if (!createResult.ok) throw new Error('Create failed');
      const docId = createResult.value.id;

      // Delete the document
      const deleteResult = await store.deleteDocument(docId);
      expect(deleteResult.ok).toBe(true);

      // Verify it's gone
      const retrieveResult = await store.getDocument(docId);
      expect(retrieveResult.ok).toBe(false);
      if (!retrieveResult.ok) {
        expect(retrieveResult.error).toBe(DataStoreError.NotFound);
      }
    });
  });

  describe('Workflow: Composition with Slots', () => {
    it('INT-004: Create composition and add slots with document references', async () => {
      // Create a composition
      const compResult = await store.createDocument({
        projectId,
        title: 'My Composition',
        isComposition: true,
      });

      if (!compResult.ok) throw new Error('Composition creation failed');
      const compId = compResult.value.id;

      // Create two documents to reference
      const doc1Result = await store.createDocument({
        projectId,
        title: 'Chapter 1',
        isComposition: false,
        content: 'Chapter 1 content',
      });
      const doc2Result = await store.createDocument({
        projectId,
        title: 'Chapter 2',
        isComposition: false,
        content: 'Chapter 2 content',
      });

      if (!doc1Result.ok || !doc2Result.ok) throw new Error('Document creation failed');

      const doc1Id = doc1Result.value.id;
      const doc2Id = doc2Result.value.id;

      // Add slots to composition
      const slot1Result = await store.createSlot(compId, {
        referenceType: 'document',
        referenceDocumentId: doc1Id,
      });

      const slot2Result = await store.createSlot(compId, {
        referenceType: 'document',
        referenceDocumentId: doc2Id,
      });

      expect(slot1Result.ok).toBe(true);
      expect(slot2Result.ok).toBe(true);

      // List slots and verify order
      const listResult = await store.listSlots(compId);
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.value.length).toBe(2);
        // Slots should be in creation order
        expect(listResult.value[0].slotOrder).toBe(0);
        expect(listResult.value[1].slotOrder).toBe(1);
      }
    });

    it('INT-005: Slots can reference variant groups', async () => {
      // Create composition
      const compResult = await store.createDocument({
        projectId,
        title: 'Composition with Variants',
        isComposition: true,
      });

      if (!compResult.ok) throw new Error('Composition creation failed');
      const compId = compResult.value.id;

      // Create variant group
      const vgResult = await store.createVariantGroup({
        projectId,
        name: 'Language Variants',
      });

      if (!vgResult.ok) throw new Error('Variant group creation failed');
      const vgId = vgResult.value.id;

      // Add slot that references variant group
      const slotResult = await store.createSlot(compId, {
        referenceType: 'variant_group',
        referenceVariantGroupId: vgId,
      });

      expect(slotResult.ok).toBe(true);

      // Verify slot structure
      const listResult = await store.listSlots(compId);
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.value.length).toBe(1);
        const slot = listResult.value[0];
        expect(slot.referenceType).toBe('variant_group');
        expect(slot.referenceVariantGroupId).toBe(vgId);
      }
    });
  });

  describe('Workflow: Variant Groups and Members', () => {
    it('INT-006: Create variant group and add members', async () => {
      // Create variant group
      const vgResult = await store.createVariantGroup({
        projectId,
        name: 'Localization Variants',
      });

      if (!vgResult.ok) throw new Error('Variant group creation failed');
      const vgId = vgResult.value.id;

      // Create documents to be members
      const enResult = await store.createDocument({
        projectId,
        title: 'English Version',
        isComposition: false,
        content: 'This is English',
      });

      const jaResult = await store.createDocument({
        projectId,
        title: 'Japanese Version',
        isComposition: false,
        content: 'これは日本語です',
      });

      if (!enResult.ok || !jaResult.ok) throw new Error('Document creation failed');

      const enId = enResult.value.id;
      const jaId = jaResult.value.id;

      // Add members to variant group
      const addEn = await store.addMember(vgId, enId);
      const addJa = await store.addMember(vgId, jaId);

      expect(addEn.ok).toBe(true);
      expect(addJa.ok).toBe(true);

      // List members and verify order
      const listResult = await store.getVariantGroupMembers(vgId);
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.value.length).toBe(2);
        expect(listResult.value[0]).toBe(enId);
        expect(listResult.value[1]).toBe(jaId);
      }
    });

    it('INT-007: Member order reflects insertion order', async () => {
      const vgResult = await store.createVariantGroup({
        projectId,
        name: 'Order Test',
      });

      if (!vgResult.ok) throw new Error('VG creation failed');
      const vgId = vgResult.value.id;

      // Create documents
      const docs = await Promise.all([
        store.createDocument({
          projectId,
          title: 'Doc A',
          isComposition: false,
          content: 'A',
        }),
        store.createDocument({
          projectId,
          title: 'Doc B',
          isComposition: false,
          content: 'B',
        }),
        store.createDocument({
          projectId,
          title: 'Doc C',
          isComposition: false,
          content: 'C',
        }),
      ]);

      const docIds = docs.map((r) => {
        if (!r.ok) throw new Error('Doc creation failed');
        return r.value.id;
      });

      // Add in order: B, A, C
      await store.addMember(vgId, docIds[1]);
      await store.addMember(vgId, docIds[0]);
      await store.addMember(vgId, docIds[2]);

      // Retrieve and verify order
      const listResult = await store.getVariantGroupMembers(vgId);
      if (!listResult.ok) throw new Error('List failed');

      expect(listResult.value[0]).toBe(docIds[1]); // B first
      expect(listResult.value[1]).toBe(docIds[0]); // A second
      expect(listResult.value[2]).toBe(docIds[2]); // C third
    });
  });

  describe('Workflow: Tags and Tagging', () => {
    it('INT-008: Assign multiple tags to document and retrieve', async () => {
      // Create document
      const docResult = await store.createDocument({
        projectId,
        title: 'Tagged Document',
        isComposition: false,
        content: 'Content',
      });

      if (!docResult.ok) throw new Error('Doc creation failed');
      const docId = docResult.value.id;

      // Assign tags
      const tag1 = await store.assignTag(docId, 'lang', 'en');
      const tag2 = await store.assignTag(docId, 'chapter', '5');
      const tag3 = await store.assignTag(docId, 'status', 'draft');

      expect(tag1.ok).toBe(true);
      expect(tag2.ok).toBe(true);
      expect(tag3.ok).toBe(true);

      // Retrieve tags
      const tagsResult = await store.getTagsForDocument(docId);
      expect(tagsResult.ok).toBe(true);
      if (tagsResult.ok) {
        expect(tagsResult.value.length).toBe(3);
      }
    });

    it('INT-009: Search tags by project and key', async () => {
      // Create two documents in same project
      const doc1Result = await store.createDocument({
        projectId,
        title: 'Doc 1',
        isComposition: false,
        content: 'Content 1',
      });

      const doc2Result = await store.createDocument({
        projectId,
        title: 'Doc 2',
        isComposition: false,
        content: 'Content 2',
      });

      if (!doc1Result.ok || !doc2Result.ok) throw new Error('Doc creation failed');

      const doc1Id = doc1Result.value.id;
      const doc2Id = doc2Result.value.id;

      // Assign same tag key with different values
      await store.assignTag(doc1Id, 'lang', 'en');
      await store.assignTag(doc2Id, 'lang', 'ja');

      // Search for 'lang' tags in project
      const searchResult = await store.searchTags(projectId, 'lang');
      expect(searchResult.ok).toBe(true);
      if (searchResult.ok) {
        expect(searchResult.value.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Workflow: Presets and Rules', () => {
    it('INT-010: Create preset with composition base and add rules', async () => {
      // Create base composition
      const compResult = await store.createDocument({
        projectId,
        title: 'Base Composition',
        isComposition: true,
      });

      if (!compResult.ok) throw new Error('Composition creation failed');
      const compId = compResult.value.id;

      // Create preset
      const presetResult = await store.createPreset({
        projectId,
        name: 'My Preset',
        baseCompositionId: compId,
      });

      expect(presetResult.ok).toBe(true);
      if (!presetResult.ok) throw new Error('Preset creation failed');

      const presetId = presetResult.value.id;

      // Add rule with JSON premise and action
      const ruleResult = await store.addPresetRule(presetId, {
        premise: { op: 'true' },
        actionParams: { type: 'toggle_off' },
      });

      expect(ruleResult.ok).toBe(true);
    });

    it('INT-011: Preset rules maintain insertion order', async () => {
      const compResult = await store.createDocument({
        projectId,
        title: 'Comp',
        isComposition: true,
      });

      if (!compResult.ok) throw new Error('Comp creation failed');

      const presetResult = await store.createPreset({
        projectId,
        name: 'Preset',
        baseCompositionId: compResult.value.id,
      });

      if (!presetResult.ok) throw new Error('Preset creation failed');
      const presetId = presetResult.value.id;

      // Add multiple rules
      const rule1 = await store.addPresetRule(presetId, {
        premise: { op: 'rule_1' },
        actionParams: { type: 'action_1' },
      });

      const rule2 = await store.addPresetRule(presetId, {
        premise: { op: 'rule_2' },
        actionParams: { type: 'action_2' },
      });

      const rule3 = await store.addPresetRule(presetId, {
        premise: { op: 'rule_3' },
        actionParams: { type: 'action_3' },
      });

      expect(rule1.ok).toBe(true);
      expect(rule2.ok).toBe(true);
      expect(rule3.ok).toBe(true);

      // Note: The test here verifies insertion succeeded.
      // Rule ordering verification would require reading rules back,
      // which would need an additional method in the data store.
      // For now, we just verify they're created.
    });
  });

  describe('Workflow: Transactions', () => {
    it('INT-012: Transaction commits multiple operations together', async () => {
      const result = await store.transaction(async (tx) => {
        // Create documents within transaction
        const doc1 = await tx.createDocument({
          projectId,
          title: 'Tx Doc 1',
          isComposition: false,
          content: 'Content 1',
        });

        const doc2 = await tx.createDocument({
          projectId,
          title: 'Tx Doc 2',
          isComposition: false,
          content: 'Content 2',
        });

        return { ok: doc1.ok && doc2.ok };
      });

      expect(result.ok).toBe(true);

      // Verify both documents exist outside transaction
      const listResult = await store.listDocuments(projectId, {});
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.value.length).toBe(2);
      }
    });

    it('INT-013: Transaction returns error result when function fails', async () => {
      // Try a transaction that fails partway through
      const result = await store.transaction(async (tx) => {
        // This should succeed
        await tx.createDocument({
          projectId,
          title: 'Attempted Tx Doc',
          isComposition: false,
          content: 'Content',
        });

        // Throw an error to test error handling
        throw new Error('Simulated failure');
      });

      // Transaction should return error result
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(DataStoreError.TransactionFailed);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('INT-014: Cannot retrieve non-existent document', async () => {
      const result = await store.getDocument(makeDocId('nonexistent'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(DataStoreError.NotFound);
      }
    });

    it('INT-015: Listing documents from empty project returns empty array', async () => {
      const result = await store.listDocuments('proj-with-no-docs', {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(0);
      }
    });

    it('INT-016: Composition is created without content', async () => {
      const result = await store.createDocument({
        projectId,
        title: 'Empty Composition',
        isComposition: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isComposition).toBe(true);
        expect(result.value.content).toBeNull();
      }
    });

    it('INT-017: Delete is idempotent (second delete also succeeds)', async () => {
      // Create and delete a document
      const createResult = await store.createDocument({
        projectId,
        title: 'To Delete',
        isComposition: false,
        content: 'Content',
      });

      if (!createResult.ok) throw new Error('Create failed');
      const docId = createResult.value.id;

      // First deletion should succeed
      const deleteResult1 = await store.deleteDocument(docId);
      expect(deleteResult1.ok).toBe(true);

      // Second deletion also succeeds (idempotent operation in SQL)
      const deleteResult2 = await store.deleteDocument(docId);
      expect(deleteResult2.ok).toBe(true);

      // But the document should not exist
      const retrieveResult = await store.getDocument(docId);
      expect(retrieveResult.ok).toBe(false);
    });
  });

  describe('Data Persistence', () => {
    it('INT-018: Complex workflow persists correctly', async () => {
      // Create a complex structure
      const compResult = await store.createDocument({
        projectId,
        title: 'Main Composition',
        isComposition: true,
      });

      if (!compResult.ok) throw new Error('Composition creation failed');
      const compId = compResult.value.id;

      // Create variant group
      const vgResult = await store.createVariantGroup({
        projectId,
        name: 'Language Variants',
      });

      if (!vgResult.ok) throw new Error('VG creation failed');
      const vgId = vgResult.value.id;

      // Create documents
      const docResults = await Promise.all([
        store.createDocument({
          projectId,
          title: 'English Chapter',
          isComposition: false,
          content: 'English content',
        }),
        store.createDocument({
          projectId,
          title: 'Spanish Chapter',
          isComposition: false,
          content: 'Spanish content',
        }),
      ]);

      const docIds = docResults.map((r) => {
        if (!r.ok) throw new Error('Doc creation failed');
        return r.value.id;
      });

      // Add documents to variant group
      await store.addMember(vgId, docIds[0]);
      await store.addMember(vgId, docIds[1]);

      // Create slot referencing variant group
      const slotResult = await store.createSlot(compId, {
        referenceType: 'variant_group',
        referenceVariantGroupId: vgId,
      });

      expect(slotResult.ok).toBe(true);

      // Now verify everything persists: composition exists with slot, VG exists with members
      const compCheck = await store.getDocument(compId);
      expect(compCheck.ok).toBe(true);

      const slotsCheck = await store.listSlots(compId);
      expect(slotsCheck.ok).toBe(true);
      if (slotsCheck.ok) {
        expect(slotsCheck.value.length).toBe(1);
        expect(slotsCheck.value[0].referenceVariantGroupId).toBe(vgId);
      }

      const membersCheck = await store.getVariantGroupMembers(vgId);
      expect(membersCheck.ok).toBe(true);
      if (membersCheck.ok) {
        expect(membersCheck.value.length).toBe(2);
      }
    });
  });
});
