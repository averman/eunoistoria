import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore } from './helpers/mock-data-store.js';
import {
  validateDocumentCreate, validateConvertToLeaf,
  validateMemberRemoval, findBrokenReferences, validatePresetRules,
} from '../src/validation.js';
import {
  DataStorePort, DocumentId, DocumentRecord, VariantGroupMemberRecord,
  DocumentError, VariantGroupError,
} from '@eunoistoria/types';

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc1' as DocumentId,
    projectId: 'proj1',
    title: 'Test',
    alias: null,
    isComposition: false,
    content: 'content',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ENG-005: Validation Module', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  it('TC-005-01: leaf without content returns LeafRequiresContent', () => {
    const r = validateDocumentCreate({ projectId: 'p', title: 'T', isComposition: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.LeafRequiresContent);
  });

  it('TC-005-02: composition with content returns CompositionCannotHaveContent', () => {
    const r = validateDocumentCreate({ projectId: 'p', title: 'T', isComposition: true, content: 'hello' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.CompositionCannotHaveContent);
  });

  it('TC-005-03: leaf with empty string content is valid', () => {
    const r = validateDocumentCreate({ projectId: 'p', title: 'T', isComposition: false, content: '' });
    expect(r.ok).toBe(true);
  });

  it('TC-005-04: convertToLeaf with slotCount > 0 returns CannotConvertCompositionWithSlots', () => {
    const record = makeRecord({ isComposition: true });
    const r = validateConvertToLeaf(record, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(DocumentError.CannotConvertCompositionWithSlots);
  });

  it('TC-005-05: convertToLeaf on already-leaf is idempotent (ok: true)', () => {
    const record = makeRecord({ isComposition: false });
    const r = validateConvertToLeaf(record, 0);
    expect(r.ok).toBe(true);
  });

  it('TC-005-06: validateMemberRemoval targeting memberOrder 0 returns CannotRemoveUniversalDefault', () => {
    const members: VariantGroupMemberRecord[] = [
      { variantGroupId: 'vg1' as any, documentId: 'doc1' as DocumentId, memberOrder: 0, createdAt: new Date() },
    ];
    const r = validateMemberRemoval(members, 'doc1' as DocumentId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(VariantGroupError.CannotRemoveUniversalDefault);
  });

  it('TC-005-07: validateMemberRemoval targeting non-position-0 member is ok', () => {
    const members: VariantGroupMemberRecord[] = [
      { variantGroupId: 'vg1' as any, documentId: 'doc1' as DocumentId, memberOrder: 0, createdAt: new Date() },
      { variantGroupId: 'vg1' as any, documentId: 'doc2' as DocumentId, memberOrder: 1, createdAt: new Date() },
    ];
    const r = validateMemberRemoval(members, 'doc2' as DocumentId);
    expect(r.ok).toBe(true);
  });

  it('TC-005-08: validateMemberRemoval with unknown documentId returns MemberNotFound', () => {
    const members: VariantGroupMemberRecord[] = [
      { variantGroupId: 'vg1' as any, documentId: 'doc1' as DocumentId, memberOrder: 0, createdAt: new Date() },
    ];
    const r = validateMemberRemoval(members, 'doc999' as DocumentId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(VariantGroupError.MemberNotFound);
  });

  it('TC-005-09: findBrokenReferences with deleted document returns one BrokenReference', async () => {
    const comp = await store.createDocument({ projectId: 'proj1', title: 'Comp', isComposition: true });
    const leaf = await store.createDocument({ projectId: 'proj1', title: 'Leaf', isComposition: false, content: 'c' });
    if (!comp.ok || !leaf.ok) return;

    await store.createSlot(comp.value.id, { referenceType: 'document', referenceDocumentId: leaf.value.id });
    await store.deleteDocument(leaf.value.id);

    const result = await findBrokenReferences('proj1', store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].referenceType).toBe('document');
  });

  it('TC-005-10: findBrokenReferences with empty variant group returns BrokenReference', async () => {
    const comp = await store.createDocument({ projectId: 'proj1', title: 'Comp', isComposition: true });
    const group = await store.createVariantGroup({ projectId: 'proj1', name: 'VG' });
    if (!comp.ok || !group.ok) return;

    await store.createSlot(comp.value.id, { referenceType: 'variant_group', referenceVariantGroupId: group.value.id });

    const result = await findBrokenReferences('proj1', store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].referenceType).toBe('variant_group');
  });

  it('TC-005-11: validatePresetRules with sort_by and no variant_group slots returns issue', async () => {
    const comp = await store.createDocument({ projectId: 'proj1', title: 'Comp', isComposition: true });
    if (!comp.ok) return;
    const preset = await store.createPreset({ projectId: 'proj1', name: 'P', compositionId: comp.value.id });
    if (!preset.ok) return;

    await store.addPresetRule(preset.value.id, {
      premise: { op: 'true' },
      action: { type: 'sort_by', sortKeys: [{ tag: 'lang', value: 'en' }] },
    });

    const result = await validatePresetRules(preset.value.id, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isValid).toBe(false);
    expect(result.value.issues).toHaveLength(1);
  });

  it('TC-005-12: validatePresetRules with only toggle rules returns isValid: true', async () => {
    const comp = await store.createDocument({ projectId: 'proj1', title: 'Comp', isComposition: true });
    if (!comp.ok) return;
    const preset = await store.createPreset({ projectId: 'proj1', name: 'P', compositionId: comp.value.id });
    if (!preset.ok) return;

    await store.addPresetRule(preset.value.id, { premise: { op: 'true' }, action: { type: 'toggle_off' } });

    const result = await validatePresetRules(preset.value.id, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isValid).toBe(true);
  });
});
