import { describe, it, expect } from 'vitest';
import { createMockDataStore } from './helpers/mock-data-store.js';
import { createEngine } from '../src/index.js';
import { AccessFilterPort } from '@eunoistoria/types';

const alwaysTrue: AccessFilterPort = { canAccess: async () => true };

describe('ENG-013: Engine Public API Integration Tests', () => {
  function makeEngine() {
    return createEngine(createMockDataStore(), alwaysTrue);
  }

  it('TC-013-01: full resolution with no rules returns concatenated content', async () => {
    const engine = makeEngine();
    const comp = await engine.documents.create({ projectId: 'p', title: 'C', isComposition: true });
    const l1 = await engine.documents.create({ projectId: 'p', title: 'L1', isComposition: false, content: 'Part One' });
    const l2 = await engine.documents.create({ projectId: 'p', title: 'L2', isComposition: false, content: 'Part Two' });
    if (!comp.ok || !l1.ok || !l2.ok) return;

    await engine.slots.add(comp.value.id, { referenceType: 'document', referenceDocumentId: l1.value.id });
    await engine.slots.add(comp.value.id, { referenceType: 'document', referenceDocumentId: l2.value.id });

    const result = await engine.resolution.resolveComposition(comp.value.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('Part One\n\nPart Two');
  });

  it('TC-013-02: full resolution with toggle_off rule omits toggled slot', async () => {
    const engine = makeEngine();
    const comp = await engine.documents.create({ projectId: 'p', title: 'C', isComposition: true });
    const l1 = await engine.documents.create({ projectId: 'p', title: 'L1', isComposition: false, content: 'One' });
    const l2 = await engine.documents.create({ projectId: 'p', title: 'L2', isComposition: false, content: 'Two' });
    if (!comp.ok || !l1.ok || !l2.ok) return;

    const slot1 = await engine.slots.add(comp.value.id, { referenceType: 'document', referenceDocumentId: l1.value.id });
    await engine.slots.add(comp.value.id, { referenceType: 'document', referenceDocumentId: l2.value.id });
    if (!slot1.ok) return;

    // Tag the first slot's document with chapter:1
    const tag1 = await engine.tags.assign(l1.value.id, 'chapter', '1');
    if (!tag1.ok) return;

    // Create preset with toggle_off rule for chapter:1
    const preset = await engine.presets.create({ projectId: 'p', name: 'P', compositionId: comp.value.id });
    if (!preset.ok) return;
    await engine.presets.addRule(preset.value.id, {
      premise: { op: 'eq', left: { type: 'tag', tag: 'chapter' }, right: { type: 'literal', value: '1' } },
      action: { type: 'toggle_off' },
    });

    const selMap = await engine.resolution.evaluateRules(preset.value.id, new Map());
    if (!selMap.ok) return;
    const result = await engine.resolution.resolve(preset.value.id, new Map(), selMap.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('Two');
  });

  it('TC-013-03: full resolution with sort_by rule resolves preferred member', async () => {
    const engine = makeEngine();
    const comp = await engine.documents.create({ projectId: 'p', title: 'C', isComposition: true });
    const memberA = await engine.documents.create({ projectId: 'p', title: 'A', isComposition: false, content: 'Content A' });
    const memberB = await engine.documents.create({ projectId: 'p', title: 'B', isComposition: false, content: 'Content B' });
    if (!comp.ok || !memberA.ok || !memberB.ok) return;

    await engine.tags.assign(memberA.value.id, 'lang', 'en');
    await engine.tags.assign(memberB.value.id, 'lang', 'ja');

    const group = await engine.variantGroups.create({ projectId: 'p', name: 'LangGroup' });
    if (!group.ok) return;
    await engine.variantGroups.addMember(group.value.id, memberA.value.id);
    await engine.variantGroups.addMember(group.value.id, memberB.value.id);
    await engine.slots.add(comp.value.id, { referenceType: 'variant_group', referenceVariantGroupId: group.value.id });

    const preset = await engine.presets.create({ projectId: 'p', name: 'P', compositionId: comp.value.id });
    if (!preset.ok) return;
    await engine.presets.addRule(preset.value.id, {
      premise: { op: 'true' },
      action: { type: 'sort_by', sortKeys: [{ tag: 'lang', value: 'ja' }] },
    });

    const selMap = await engine.resolution.evaluateRules(preset.value.id, new Map());
    if (!selMap.ok) return;
    const result = await engine.resolution.resolve(preset.value.id, new Map(), selMap.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('Content B');
  });

  it('TC-013-04: evaluateRules returns SelectionMap', async () => {
    const engine = makeEngine();
    const comp = await engine.documents.create({ projectId: 'p', title: 'C', isComposition: true });
    if (!comp.ok) return;
    const preset = await engine.presets.create({ projectId: 'p', name: 'P', compositionId: comp.value.id });
    if (!preset.ok) return;

    const result = await engine.resolution.evaluateRules(preset.value.id, new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.toggleStates).toBeDefined();
    expect(result.value.sortOrders).toBeDefined();
  });

  it('TC-013-05: resolve with manual override includes overridden slot', async () => {
    const engine = makeEngine();
    const comp = await engine.documents.create({ projectId: 'p', title: 'C', isComposition: true });
    const l1 = await engine.documents.create({ projectId: 'p', title: 'L1', isComposition: false, content: 'One' });
    const l2 = await engine.documents.create({ projectId: 'p', title: 'L2', isComposition: false, content: 'Two' });
    if (!comp.ok || !l1.ok || !l2.ok) return;

    const slot1 = await engine.slots.add(comp.value.id, { referenceType: 'document', referenceDocumentId: l1.value.id });
    await engine.slots.add(comp.value.id, { referenceType: 'document', referenceDocumentId: l2.value.id });
    if (!slot1.ok) return;

    const preset = await engine.presets.create({ projectId: 'p', name: 'P', compositionId: comp.value.id });
    if (!preset.ok) return;
    await engine.presets.addRule(preset.value.id, { premise: { op: 'true' }, action: { type: 'toggle_off' } });

    const selMap = await engine.resolution.evaluateRules(preset.value.id, new Map());
    if (!selMap.ok) return;

    // Manually override: turn slot1 back on
    selMap.value.toggleStates.set(slot1.value.id, true);

    const result = await engine.resolution.resolve(preset.value.id, new Map(), selMap.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('One');
  });

  it('TC-013-06: ad-hoc documents appended after composition content', async () => {
    const engine = makeEngine();
    const comp = await engine.documents.create({ projectId: 'p', title: 'C', isComposition: true });
    const leaf = await engine.documents.create({ projectId: 'p', title: 'L', isComposition: false, content: 'Main' });
    const adHoc = await engine.documents.create({ projectId: 'p', title: 'AH', isComposition: false, content: 'Extra' });
    if (!comp.ok || !leaf.ok || !adHoc.ok) return;

    await engine.slots.add(comp.value.id, { referenceType: 'document', referenceDocumentId: leaf.value.id });
    const preset = await engine.presets.create({ projectId: 'p', name: 'P', compositionId: comp.value.id });
    if (!preset.ok) return;
    await engine.presets.addAdHocDocument(preset.value.id, adHoc.value.id);

    const selMap = await engine.resolution.evaluateRules(preset.value.id, new Map());
    if (!selMap.ok) return;
    const result = await engine.resolution.resolve(preset.value.id, new Map(), selMap.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('Main\n\nExtra');
  });

  it('TC-013-07: access filter applied during resolution', async () => {
    const store = createMockDataStore();
    const comp = await store.createDocument({ projectId: 'p', title: 'C', isComposition: true });
    const memberA = await store.createDocument({ projectId: 'p', title: 'A', isComposition: false, content: 'A content' });
    const memberB = await store.createDocument({ projectId: 'p', title: 'B', isComposition: false, content: 'B content' });
    if (!comp.ok || !memberA.ok || !memberB.ok) return;

    const group = await store.createVariantGroup({ projectId: 'p', name: 'VG' });
    if (!group.ok) return;
    await store.addVariantGroupMember(group.value.id, memberA.value.id); // position 0
    await store.addVariantGroupMember(group.value.id, memberB.value.id); // position 1
    await store.createSlot(comp.value.id, { referenceType: 'variant_group', referenceVariantGroupId: group.value.id });

    // Access filter blocks A, allows B
    const filter: AccessFilterPort = { canAccess: async (id) => id === memberB.value.id };
    const engine = createEngine(store, filter);

    const result = await engine.resolution.resolveComposition(comp.value.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('B content');
  });
});
