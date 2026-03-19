import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore } from '../helpers/mock-data-store.js';
import {
  createDocument, getDocument, updateDocument, deleteDocument,
  listDocuments, convertToComposition, convertToLeaf,
} from '../../src/crud/documents.js';
import { DataStorePort, DocumentError } from '@eunoistoria/types';

describe('ENG-008: CRUD Documents', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  it('TC-008-01: create leaf document returns DocumentRecord', async () => {
    const r = await createDocument({ projectId: 'p', title: 'Leaf', isComposition: false, content: 'hello' }, store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.isComposition).toBe(false);
    expect(r.value.content).toBe('hello');
  });

  it('TC-008-02: create composition returns record with isComposition: true, content: null', async () => {
    const r = await createDocument({ projectId: 'p', title: 'Comp', isComposition: true }, store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.isComposition).toBe(true);
    expect(r.value.content).toBeNull();
  });

  it('TC-008-03: create leaf without content returns LeafRequiresContent', async () => {
    const r = await createDocument({ projectId: 'p', title: 'Leaf', isComposition: false }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.LeafRequiresContent);
  });

  it('TC-008-04: create composition with content returns CompositionCannotHaveContent', async () => {
    const r = await createDocument({ projectId: 'p', title: 'Comp', isComposition: true, content: 'oops' }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.CompositionCannotHaveContent);
  });

  it('TC-008-05: get nonexistent document returns NotFound', async () => {
    const r = await getDocument('non-existent' as any, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.NotFound);
  });

  it('TC-008-06: update content of composition returns CompositionCannotHaveContent', async () => {
    const comp = await createDocument({ projectId: 'p', title: 'Comp', isComposition: true }, store);
    if (!comp.ok) return;
    const r = await updateDocument(comp.value.id, { content: 'oops' }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.CompositionCannotHaveContent);
  });

  it('TC-008-07: convert composition with slots to leaf returns error', async () => {
    const comp = await createDocument({ projectId: 'p', title: 'Comp', isComposition: true }, store);
    const leaf = await createDocument({ projectId: 'p', title: 'Leaf', isComposition: false, content: 'c' }, store);
    if (!comp.ok || !leaf.ok) return;
    await store.createSlot(comp.value.id, { referenceType: 'document', referenceDocumentId: leaf.value.id });
    const r = await convertToLeaf(comp.value.id, 'new content', store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.CannotConvertCompositionWithSlots);
  });

  it('TC-008-08: convertToComposition on already-composition is idempotent', async () => {
    const comp = await createDocument({ projectId: 'p', title: 'Comp', isComposition: true }, store);
    if (!comp.ok) return;
    const r = await convertToComposition(comp.value.id, store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.isComposition).toBe(true);
  });

  it('TC-008-09: convertToLeaf on already-leaf is idempotent', async () => {
    const doc = await createDocument({ projectId: 'p', title: 'Leaf', isComposition: false, content: 'original' }, store);
    if (!doc.ok) return;
    const r = await convertToLeaf(doc.value.id, 'new content', store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.content).toBe('original'); // idempotent: returns current record
  });

  it('TC-008-10: convert empty composition to leaf succeeds', async () => {
    const comp = await createDocument({ projectId: 'p', title: 'Comp', isComposition: true }, store);
    if (!comp.ok) return;
    const r = await convertToLeaf(comp.value.id, 'new content', store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.isComposition).toBe(false);
    expect(r.value.content).toBe('new content');
  });
});
