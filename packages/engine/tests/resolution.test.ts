import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTree, MAX_RECURSION_DEPTH } from '../src/resolution.js';
import { createMockDataStore } from './helpers/mock-data-store.js';
import {
  DataStorePort, AccessFilterPort, SelectionMap, DocumentId, SlotId,
  ResolutionError,
} from '@eunoistoria/types';

const alwaysAccess: AccessFilterPort = { canAccess: async () => true };
const neverAccess: AccessFilterPort = { canAccess: async () => false };
const defaultMap: SelectionMap = { toggleStates: new Map(), sortOrders: new Map() };

describe('ENG-006: Resolution Walker', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  async function leaf(content: string): Promise<DocumentId> {
    const r = await store.createDocument({ projectId: 'proj1', title: content, isComposition: false, content });
    if (!r.ok) throw new Error();
    return r.value.id;
  }

  async function composition(title: string): Promise<DocumentId> {
    const r = await store.createDocument({ projectId: 'proj1', title, isComposition: true });
    if (!r.ok) throw new Error();
    return r.value.id;
  }

  it('TC-006-01: leaf document returns its content', async () => {
    const id = await leaf('Hello');
    const result = await resolveTree(id, defaultMap, alwaysAccess, store, 0);
    expect(result).toEqual({ ok: true, value: 'Hello' });
  });

  it('TC-006-02: composition with two leaf slots returns A\\n\\nB', async () => {
    const comp = await composition('C');
    const a = await leaf('A');
    const b = await leaf('B');
    await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: a });
    await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: b });
    const result = await resolveTree(comp, defaultMap, alwaysAccess, store, 0);
    expect(result).toEqual({ ok: true, value: 'A\n\nB' });
  });

  it('TC-006-03: skips toggled off slots', async () => {
    const comp = await composition('C');
    const a = await leaf('A');
    const b = await leaf('B');
    const slotA = await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: a });
    await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: b });
    if (!slotA.ok) return;

    const selMap: SelectionMap = {
      toggleStates: new Map([[slotA.value.id, false]]),
      sortOrders: new Map(),
    };
    const result = await resolveTree(comp, selMap, alwaysAccess, store, 0);
    expect(result).toEqual({ ok: true, value: 'B' });
  });

  it('TC-006-04: selects first accessible variant group member from sort order', async () => {
    const comp = await composition('C');
    const a = await leaf('A-content');
    const b = await leaf('B-content');
    const group = await store.createVariantGroup({ projectId: 'proj1', name: 'VG' });
    if (!group.ok) return;
    await store.addVariantGroupMember(group.value.id, a);
    await store.addVariantGroupMember(group.value.id, b);

    const slotResult = await store.createSlot(comp, { referenceType: 'variant_group', referenceVariantGroupId: group.value.id });
    if (!slotResult.ok) return;

    // sortOrders prefers B, A, but access filter blocks B
    const selMap: SelectionMap = {
      toggleStates: new Map(),
      sortOrders: new Map([[slotResult.value.id, [b, a]]]),
    };
    const accessFilter: AccessFilterPort = {
      canAccess: async (id) => id === a,
    };
    const result = await resolveTree(comp, selMap, accessFilter, store, 0);
    expect(result).toEqual({ ok: true, value: 'A-content' });
  });

  it('TC-006-05: falls back to position-0 when no sort order', async () => {
    const comp = await composition('C');
    const def = await leaf('Default');
    const other = await leaf('Other');
    const group = await store.createVariantGroup({ projectId: 'proj1', name: 'VG' });
    if (!group.ok) return;
    await store.addVariantGroupMember(group.value.id, def);
    await store.addVariantGroupMember(group.value.id, other);

    await store.createSlot(comp, { referenceType: 'variant_group', referenceVariantGroupId: group.value.id });
    const result = await resolveTree(comp, defaultMap, alwaysAccess, store, 0);
    expect(result).toEqual({ ok: true, value: 'Default' });
  });

  it('TC-006-06: propagates MaxDepthExceeded error', async () => {
    // Create a chain 21 levels deep
    let current = await leaf('deep');
    for (let i = 0; i < MAX_RECURSION_DEPTH + 1; i++) {
      const comp = await composition(`level-${i}`);
      await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: current });
      current = comp;
    }
    const result = await resolveTree(current, defaultMap, alwaysAccess, store, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(ResolutionError.MaxDepthExceeded);
  });

  it('TC-006-07: skips broken document reference silently', async () => {
    const comp = await composition('C');
    const a = await leaf('A-content');
    const b = await leaf('B-content');
    await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: a });
    await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: b });
    await store.deleteDocument(a); // break reference
    const result = await resolveTree(comp, defaultMap, alwaysAccess, store, 0);
    expect(result).toEqual({ ok: true, value: 'B-content' });
  });

  it('TC-006-08: resolves nested composition A->B->C(leaf)', async () => {
    const c = await leaf('deep');
    const b = await composition('B');
    await store.createSlot(b, { referenceType: 'document', referenceDocumentId: c });
    const a = await composition('A');
    await store.createSlot(a, { referenceType: 'document', referenceDocumentId: b });
    const result = await resolveTree(a, defaultMap, alwaysAccess, store, 0);
    expect(result).toEqual({ ok: true, value: 'deep' });
  });

  it('TC-006-09: empty slot content not added to parts', async () => {
    const comp = await composition('C');
    const empty = await leaf('');
    const a = await leaf('A');
    await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: empty });
    await store.createSlot(comp, { referenceType: 'document', referenceDocumentId: a });
    const result = await resolveTree(comp, defaultMap, alwaysAccess, store, 0);
    expect(result).toEqual({ ok: true, value: 'A' });
  });
});
