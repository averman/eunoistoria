import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore } from '../helpers/mock-data-store.js';
import { addSlot, removeSlot, reorderSlots } from '../../src/crud/slots.js';
import { createDocument } from '../../src/crud/documents.js';
import { DataStorePort, SlotError } from '@eunoistoria/types';

describe('ENG-009: CRUD Slots', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  it('TC-009-01: add slot to composition succeeds', async () => {
    const comp = await store.createDocument({ projectId: 'p', title: 'C', isComposition: true });
    const leaf = await store.createDocument({ projectId: 'p', title: 'L', isComposition: false, content: 'c' });
    if (!comp.ok || !leaf.ok) return;
    const r = await addSlot(comp.value.id, { referenceType: 'document', referenceDocumentId: leaf.value.id }, store);
    expect(r.ok).toBe(true);
  });

  it('TC-009-02: add slot to leaf returns CompositionNotFound', async () => {
    const leaf = await store.createDocument({ projectId: 'p', title: 'L', isComposition: false, content: 'c' });
    const target = await store.createDocument({ projectId: 'p', title: 'T', isComposition: false, content: 't' });
    if (!leaf.ok || !target.ok) return;
    const r = await addSlot(leaf.value.id, { referenceType: 'document', referenceDocumentId: target.value.id }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(SlotError.CompositionNotFound);
  });

  it('TC-009-03: add slot creating direct cycle returns WouldCreateCycle', async () => {
    const A = await store.createDocument({ projectId: 'p', title: 'A', isComposition: true });
    const B = await store.createDocument({ projectId: 'p', title: 'B', isComposition: true });
    if (!A.ok || !B.ok) return;
    // B -> A
    await store.createSlot(B.value.id, { referenceType: 'document', referenceDocumentId: A.value.id });
    // Try A -> B (would create cycle A->B->A)
    const r = await addSlot(A.value.id, { referenceType: 'document', referenceDocumentId: B.value.id }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(SlotError.WouldCreateCycle);
  });

  it('TC-009-04: add slot via variant group that would create cycle returns WouldCreateCycle', async () => {
    const A = await store.createDocument({ projectId: 'p', title: 'A', isComposition: true });
    const B = await store.createDocument({ projectId: 'p', title: 'B', isComposition: true });
    if (!A.ok || !B.ok) return;
    // B -> A
    await store.createSlot(B.value.id, { referenceType: 'document', referenceDocumentId: A.value.id });
    // Create variant group with member B
    const group = await store.createVariantGroup({ projectId: 'p', name: 'VG' });
    if (!group.ok) return;
    await store.addVariantGroupMember(group.value.id, B.value.id);
    // Try A -> VG containing B (would create cycle)
    const r = await addSlot(A.value.id, { referenceType: 'variant_group', referenceVariantGroupId: group.value.id }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(SlotError.WouldCreateCycle);
  });

  it('TC-009-05: add slot with missing target returns TargetNotFound', async () => {
    const comp = await store.createDocument({ projectId: 'p', title: 'C', isComposition: true });
    if (!comp.ok) return;
    const r = await addSlot(comp.value.id, { referenceType: 'document', referenceDocumentId: 'non-existent' as any }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(SlotError.TargetNotFound);
  });

  it('TC-009-06: reorder with wrong slot IDs returns InvalidOrdering', async () => {
    const comp = await store.createDocument({ projectId: 'p', title: 'C', isComposition: true });
    if (!comp.ok) return;
    const r = await reorderSlots(comp.value.id, ['wrong-id' as any], store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(SlotError.InvalidOrdering);
  });

  it('TC-009-07: reorder with correct permutation succeeds', async () => {
    const comp = await store.createDocument({ projectId: 'p', title: 'C', isComposition: true });
    const l1 = await store.createDocument({ projectId: 'p', title: '1', isComposition: false, content: '1' });
    const l2 = await store.createDocument({ projectId: 'p', title: '2', isComposition: false, content: '2' });
    if (!comp.ok || !l1.ok || !l2.ok) return;
    const s1 = await store.createSlot(comp.value.id, { referenceType: 'document', referenceDocumentId: l1.value.id });
    const s2 = await store.createSlot(comp.value.id, { referenceType: 'document', referenceDocumentId: l2.value.id });
    if (!s1.ok || !s2.ok) return;
    const r = await reorderSlots(comp.value.id, [s2.value.id, s1.value.id], store);
    expect(r.ok).toBe(true);
  });

  it('TC-009-08: remove nonexistent slot returns NotFound', async () => {
    const r = await removeSlot('non-existent' as any, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(SlotError.NotFound);
  });
});
