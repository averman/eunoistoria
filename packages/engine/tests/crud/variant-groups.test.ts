import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore } from '../helpers/mock-data-store.js';
import {
  createVariantGroup, addMember, removeMember, reorderMembers,
} from '../../src/crud/variant-groups.js';
import { DataStorePort, VariantGroupError } from '@eunoistoria/types';

describe('ENG-010: CRUD Variant Groups', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  async function mkLeaf(title: string) {
    const r = await store.createDocument({ projectId: 'p', title, isComposition: false, content: title });
    if (!r.ok) throw new Error();
    return r.value.id;
  }

  it('TC-010-01: create variant group succeeds', async () => {
    const r = await createVariantGroup({ projectId: 'p', name: 'VG' }, store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.projectId).toBe('p');
    expect(r.value.name).toBe('VG');
  });

  it('TC-010-02: add member to group succeeds, appears at end', async () => {
    const group = await createVariantGroup({ projectId: 'p', name: 'VG' }, store);
    if (!group.ok) return;
    const d1 = await mkLeaf('D1');
    const d2 = await mkLeaf('D2');
    await addMember(group.value.id, d1, store);
    await addMember(group.value.id, d2, store);
    const members = await store.listVariantGroupMemberRecords(group.value.id);
    expect(members.ok).toBe(true);
    if (!members.ok) return;
    expect(members.value[1].documentId).toBe(d2);
    expect(members.value[1].memberOrder).toBe(1);
  });

  it('TC-010-03: add duplicate member returns DocumentAlreadyMember', async () => {
    const group = await createVariantGroup({ projectId: 'p', name: 'VG' }, store);
    if (!group.ok) return;
    const d1 = await mkLeaf('D1');
    await addMember(group.value.id, d1, store);
    const r = await addMember(group.value.id, d1, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(VariantGroupError.DocumentAlreadyMember);
  });

  it('TC-010-04: remove member at position 0 returns CannotRemoveUniversalDefault', async () => {
    const group = await createVariantGroup({ projectId: 'p', name: 'VG' }, store);
    if (!group.ok) return;
    const d1 = await mkLeaf('D1');
    const d2 = await mkLeaf('D2');
    await addMember(group.value.id, d1, store);
    await addMember(group.value.id, d2, store);
    const r = await removeMember(group.value.id, d1, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(VariantGroupError.CannotRemoveUniversalDefault);
  });

  it('TC-010-05: remove non-zero member resequences remaining members', async () => {
    const group = await createVariantGroup({ projectId: 'p', name: 'VG' }, store);
    if (!group.ok) return;
    const d1 = await mkLeaf('D1');
    const d2 = await mkLeaf('D2');
    const d3 = await mkLeaf('D3');
    await addMember(group.value.id, d1, store);
    await addMember(group.value.id, d2, store);
    await addMember(group.value.id, d3, store);
    await removeMember(group.value.id, d2, store);
    const members = await store.listVariantGroupMemberRecords(group.value.id);
    if (!members.ok) return;
    expect(members.value).toHaveLength(2);
    expect(members.value[0].memberOrder).toBe(0);
    expect(members.value[1].memberOrder).toBe(1);
  });

  it('TC-010-06: reorder with invalid IDs returns MemberNotFound', async () => {
    const group = await createVariantGroup({ projectId: 'p', name: 'VG' }, store);
    if (!group.ok) return;
    const r = await reorderMembers(group.value.id, ['bogus' as any], store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(VariantGroupError.MemberNotFound);
  });

  it('TC-010-07: add member to nonexistent group returns NotFound', async () => {
    const d1 = await mkLeaf('D1');
    const r = await addMember('non-existent' as any, d1, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(VariantGroupError.NotFound);
  });
});
