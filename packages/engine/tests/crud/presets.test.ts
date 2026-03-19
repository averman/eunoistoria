import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore } from '../helpers/mock-data-store.js';
import {
  createPreset, deletePreset, addRule, removeRule, reorderRules,
} from '../../src/crud/presets.js';
import { DataStorePort, PresetError } from '@eunoistoria/types';

describe('ENG-012: CRUD Presets', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  async function mkComp() {
    const r = await store.createDocument({ projectId: 'p', title: 'Comp', isComposition: true });
    if (!r.ok) throw new Error();
    return r.value.id;
  }

  async function mkLeaf() {
    const r = await store.createDocument({ projectId: 'p', title: 'Leaf', isComposition: false, content: 'c' });
    if (!r.ok) throw new Error();
    return r.value.id;
  }

  it('TC-012-01: create preset with valid composition succeeds', async () => {
    const compId = await mkComp();
    const r = await createPreset({ projectId: 'p', name: 'MyPreset', compositionId: compId }, store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe('MyPreset');
  });

  it('TC-012-02: create preset with nonexistent composition returns CompositionNotFound', async () => {
    const r = await createPreset({ projectId: 'p', name: 'P', compositionId: 'bogus' as any }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(PresetError.CompositionNotFound);
  });

  it('TC-012-03: create preset with leaf as composition returns CompositionNotFound', async () => {
    const leafId = await mkLeaf();
    const r = await createPreset({ projectId: 'p', name: 'P', compositionId: leafId }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(PresetError.CompositionNotFound);
  });

  it('TC-012-04: add rule appends at end with ascending ruleOrder', async () => {
    const compId = await mkComp();
    const preset = await createPreset({ projectId: 'p', name: 'P', compositionId: compId }, store);
    if (!preset.ok) return;
    const r1 = await addRule(preset.value.id, { premise: { op: 'true' }, action: { type: 'toggle_on' } }, store);
    const r2 = await addRule(preset.value.id, { premise: { op: 'true' }, action: { type: 'toggle_off' } }, store);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.ruleOrder).toBe(0);
    expect(r2.value.ruleOrder).toBe(1);
  });

  it('TC-012-05: reorder rules with invalid IDs returns InvalidRuleOrdering', async () => {
    const compId = await mkComp();
    const preset = await createPreset({ projectId: 'p', name: 'P', compositionId: compId }, store);
    if (!preset.ok) return;
    const r = await reorderRules(preset.value.id, ['bogus'], store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(PresetError.InvalidRuleOrdering);
  });

  it('TC-012-06: remove nonexistent rule returns RuleNotFound', async () => {
    const compId = await mkComp();
    const preset = await createPreset({ projectId: 'p', name: 'P', compositionId: compId }, store);
    if (!preset.ok) return;
    const r = await removeRule(preset.value.id, 'bogus', store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(PresetError.RuleNotFound);
  });

  it('TC-012-07: delete preset removes it', async () => {
    const compId = await mkComp();
    const preset = await createPreset({ projectId: 'p', name: 'P', compositionId: compId }, store);
    if (!preset.ok) return;
    await deletePreset(preset.value.id, store);
    const check = await store.getPresetRecord(preset.value.id);
    expect(check.ok).toBe(false);
  });
});
