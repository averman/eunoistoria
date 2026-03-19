import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore } from './helpers/mock-data-store.js';
import {
  DataStorePort, DocumentId, VariantGroupId, DataStoreError,
} from '@eunoistoria/types';

describe('ENG-001: MockDataStore', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  it('TC-001-01: createDocument then getDocument returns correct hydrated DataDocument', async () => {
    const record = await store.createDocument({
      projectId: 'proj1',
      title: 'My Leaf',
      isComposition: false,
      content: 'Hello World',
    });
    expect(record.ok).toBe(true);
    if (!record.ok) return;

    const doc = await store.getDocument(record.value.id);
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;

    expect(doc.value.type).toBe('leaf');
    expect(doc.value.title).toBe('My Leaf');
    if (doc.value.type === 'leaf') {
      expect(doc.value.content).toBe('Hello World');
    }
  });

  it('TC-001-02: createDocument with isComposition: true returns composition with empty slots', async () => {
    const record = await store.createDocument({
      projectId: 'proj1',
      title: 'Composition',
      isComposition: true,
    });
    expect(record.ok).toBe(true);
    if (!record.ok) return;

    const doc = await store.getDocument(record.value.id);
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;

    expect(doc.value.type).toBe('composition');
    if (doc.value.type === 'composition') {
      expect(doc.value.slots).toHaveLength(0);
    }
  });

  it('TC-001-03: createSlot then getDocument returns composition with slot populated', async () => {
    const compRecord = await store.createDocument({
      projectId: 'proj1', title: 'Comp', isComposition: true,
    });
    const leafRecord = await store.createDocument({
      projectId: 'proj1', title: 'Leaf', isComposition: false, content: 'content',
    });
    expect(compRecord.ok && leafRecord.ok).toBe(true);
    if (!compRecord.ok || !leafRecord.ok) return;

    await store.createSlot(compRecord.value.id, {
      referenceType: 'document',
      referenceDocumentId: leafRecord.value.id,
    });

    const doc = await store.getDocument(compRecord.value.id);
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    expect(doc.value.type).toBe('composition');
    if (doc.value.type === 'composition') {
      expect(doc.value.slots).toHaveLength(1);
      expect(doc.value.slots[0].referenceType).toBe('document');
      expect(doc.value.slots[0].referenceDocumentId).toBe(leafRecord.value.id);
    }
  });

  it('TC-001-04: addVariantGroupMember twice returns both IDs in insertion order', async () => {
    const groupResult = await store.createVariantGroup({ projectId: 'proj1', name: 'Group' });
    const doc1 = await store.createDocument({ projectId: 'proj1', title: 'D1', isComposition: false, content: 'c1' });
    const doc2 = await store.createDocument({ projectId: 'proj1', title: 'D2', isComposition: false, content: 'c2' });
    expect(groupResult.ok && doc1.ok && doc2.ok).toBe(true);
    if (!groupResult.ok || !doc1.ok || !doc2.ok) return;

    await store.addVariantGroupMember(groupResult.value.id, doc1.value.id);
    await store.addVariantGroupMember(groupResult.value.id, doc2.value.id);

    const members = await store.getVariantGroupMembers(groupResult.value.id);
    expect(members.ok).toBe(true);
    if (!members.ok) return;
    expect(members.value).toEqual([doc1.value.id, doc2.value.id]);
  });

  it('TC-001-05: removeVariantGroupMember for second member leaves first with memberOrder 0', async () => {
    const groupResult = await store.createVariantGroup({ projectId: 'proj1', name: 'Group' });
    const doc1 = await store.createDocument({ projectId: 'proj1', title: 'D1', isComposition: false, content: 'c1' });
    const doc2 = await store.createDocument({ projectId: 'proj1', title: 'D2', isComposition: false, content: 'c2' });
    if (!groupResult.ok || !doc1.ok || !doc2.ok) return;

    await store.addVariantGroupMember(groupResult.value.id, doc1.value.id);
    await store.addVariantGroupMember(groupResult.value.id, doc2.value.id);
    await store.removeVariantGroupMember(groupResult.value.id, doc2.value.id);

    const membersResult = await store.listVariantGroupMemberRecords(groupResult.value.id);
    expect(membersResult.ok).toBe(true);
    if (!membersResult.ok) return;
    expect(membersResult.value).toHaveLength(1);
    expect(membersResult.value[0].documentId).toBe(doc1.value.id);
    expect(membersResult.value[0].memberOrder).toBe(0);
  });

  it('TC-001-06: assignTag twice with same key+value returns same TagRecord id (idempotent)', async () => {
    const docResult = await store.createDocument({ projectId: 'proj1', title: 'Doc', isComposition: false, content: 'c' });
    if (!docResult.ok) return;

    const tag1 = await store.assignTag(docResult.value.id, 'lang', 'en');
    const tag2 = await store.assignTag(docResult.value.id, 'lang', 'en');
    expect(tag1.ok && tag2.ok).toBe(true);
    if (!tag1.ok || !tag2.ok) return;
    expect(tag1.value.id).toBe(tag2.value.id);
  });

  it('TC-001-07: getDocument on unknown ID returns NotFound error', async () => {
    const result = await store.getDocument('non-existent' as DocumentId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(DataStoreError.NotFound);
    }
  });

  it('TC-001-08: queryDocuments with tag_lt predicate returns only matching documents', async () => {
    const doc1 = await store.createDocument({ projectId: 'proj1', title: 'Ch1', isComposition: false, content: 'c1' });
    const doc2 = await store.createDocument({ projectId: 'proj1', title: 'Ch10', isComposition: false, content: 'c2' });
    if (!doc1.ok || !doc2.ok) return;

    await store.assignTag(doc1.value.id, 'chapter', '1');
    await store.assignTag(doc2.value.id, 'chapter', '10');

    const result = await store.queryDocuments('proj1', [{ type: 'tag_lt', key: 'chapter', value: '5' }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].id).toBe(doc1.value.id);
  });
});
