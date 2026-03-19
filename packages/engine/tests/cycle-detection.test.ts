import { describe, it, expect, beforeEach } from 'vitest';
import { wouldCreateCycle } from '../src/cycle-detection.js';
import { createMockDataStore } from './helpers/mock-data-store.js';
import { DataStorePort, DocumentId, ValidationError } from '@eunoistoria/types';

describe('ENG-004: Cycle Detection', () => {
  let store: DataStorePort;

  async function createComposition(title: string) {
    const result = await store.createDocument({ projectId: 'proj1', title, isComposition: true });
    if (!result.ok) throw new Error('create failed');
    return result.value.id;
  }

  async function createLeaf(title: string) {
    const result = await store.createDocument({ projectId: 'proj1', title, isComposition: false, content: title });
    if (!result.ok) throw new Error('create failed');
    return result.value.id;
  }

  async function addDocumentSlot(compositionId: DocumentId, targetId: DocumentId) {
    await store.createSlot(compositionId, { referenceType: 'document', referenceDocumentId: targetId });
  }

  beforeEach(() => {
    store = createMockDataStore();
  });

  it('TC-004-01: self-reference returns true', async () => {
    const A = await createComposition('A');
    const result = await wouldCreateCycle(A, A, store);
    expect(result).toEqual({ ok: true, value: true });
  });

  it('TC-004-02: leaf target returns false', async () => {
    const A = await createComposition('A');
    const B = await createLeaf('B');
    const result = await wouldCreateCycle(A, B, store);
    expect(result).toEqual({ ok: true, value: false });
  });

  it('TC-004-03: direct cycle A->B->A returns true', async () => {
    const A = await createComposition('A');
    const B = await createComposition('B');
    await addDocumentSlot(A, B);
    await addDocumentSlot(B, A);
    const result = await wouldCreateCycle(A, B, store);
    expect(result).toEqual({ ok: true, value: true });
  });

  it('TC-004-04: no cycle A->B->C(leaf) returns false', async () => {
    const A = await createComposition('A');
    const B = await createComposition('B');
    const C = await createLeaf('C');
    await addDocumentSlot(B, C);
    const result = await wouldCreateCycle(A, B, store);
    expect(result).toEqual({ ok: true, value: false });
  });

  it('TC-004-05: cycle through variant group returns true', async () => {
    const A = await createComposition('A');
    const B = await createComposition('B');
    // B has a slot pointing back to A
    await addDocumentSlot(B, A);

    // Create a variant group with member B
    const groupResult = await store.createVariantGroup({ projectId: 'proj1', name: 'VG' });
    if (!groupResult.ok) throw new Error();
    await store.addVariantGroupMember(groupResult.value.id, B);

    // A has a variant_group slot pointing to the group
    await store.createSlot(A, { referenceType: 'variant_group', referenceVariantGroupId: groupResult.value.id });

    const result = await wouldCreateCycle(A, B, store);
    expect(result).toEqual({ ok: true, value: true });
  });

  it('TC-004-06: deep chain A->B->C->D(leaf) returns false', async () => {
    const A = await createComposition('A');
    const B = await createComposition('B');
    const C = await createComposition('C');
    const D = await createLeaf('D');
    await addDocumentSlot(B, C);
    await addDocumentSlot(C, D);
    const result = await wouldCreateCycle(A, B, store);
    expect(result).toEqual({ ok: true, value: false });
  });

  it('TC-004-07: target not found returns error', async () => {
    const A = await createComposition('A');
    const result = await wouldCreateCycle(A, 'non-existent' as DocumentId, store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(ValidationError.CompositionNotFound);
  });
});
