import { describe, it, expect } from 'vitest';
import { evaluateRules } from '../src/rule-evaluator.js';
import {
  DocumentId, SlotId,
  SlotRuleContext, VariantMemberContext, Tag, VariableMap,
} from '@eunoistoria/types';

function makeSlotId(id: string): SlotId { return id as SlotId; }
function makeDocId(id: string): DocumentId { return id as DocumentId; }

function makeDocSlot(slotId: string, tags: Tag[]): SlotRuleContext {
  return {
    slotId: makeSlotId(slotId),
    referenceType: 'document',
    documentTags: tags,
    variantGroupMembers: [],
  };
}

function makeVarGroupSlot(slotId: string, members: Array<{ id: string; tags: Tag[] }>): SlotRuleContext {
  const memberContexts: VariantMemberContext[] = members.map((m, i) => ({
    documentId: makeDocId(m.id),
    memberOrder: i,
    tags: m.tags,
  }));
  return {
    slotId: makeSlotId(slotId),
    referenceType: 'variant_group',
    documentTags: memberContexts[0]?.tags ?? [],
    variantGroupMembers: memberContexts,
  };
}

describe('ENG-003: Rule Evaluator', () => {
  it('TC-003-01: no rules returns all slots toggled on and original sort orders', () => {
    const slot1 = makeDocSlot('s1', []);
    const slot2 = makeVarGroupSlot('s2', [
      { id: 'd1', tags: [] },
      { id: 'd2', tags: [] },
    ]);
    const result = evaluateRules([], new Map(), [slot1, slot2]);
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(true);
    expect(result.sortOrders.get(makeSlotId('s2'))).toEqual([makeDocId('d1'), makeDocId('d2')]);
  });

  it('TC-003-02: toggle_off with variable-only true premise toggles all slots off', () => {
    const slots = [makeDocSlot('s1', []), makeDocSlot('s2', [])];
    const result = evaluateRules(
      [{ premise: { op: 'true' }, action: { type: 'toggle_off' } }],
      new Map(),
      slots
    );
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(false);
    expect(result.toggleStates.get(makeSlotId('s2'))).toBe(false);
  });

  it('TC-003-03: toggle_off with variable-only false premise toggles no slots', () => {
    const slots = [makeDocSlot('s1', [])];
    const variables: VariableMap = new Map([['mode', 'author']]);
    const result = evaluateRules(
      [{
        premise: { op: 'eq', left: { type: 'var', var: 'mode' }, right: { type: 'literal', value: 'reader' } },
        action: { type: 'toggle_off' },
      }],
      variables,
      slots
    );
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(true);
  });

  it('TC-003-04: toggle_off with tag premise only toggles matching slots', () => {
    const slot1 = makeDocSlot('s1', [{ key: 'chapter', value: '5' }]);
    const slot2 = makeDocSlot('s2', [{ key: 'chapter', value: '10' }]);
    const result = evaluateRules(
      [{
        premise: { op: 'lt', left: { type: 'tag', tag: 'chapter' }, right: { type: 'literal', value: 8 } },
        action: { type: 'toggle_off' },
      }],
      new Map(),
      [slot1, slot2]
    );
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(false);
    expect(result.toggleStates.get(makeSlotId('s2'))).toBe(true);
  });

  it('TC-003-05: sort_by with literal value reorders members', () => {
    const slot = makeVarGroupSlot('s1', [
      { id: 'fanfic-A', tags: [{ key: 'fanfic', value: 'A' }] },
      { id: 'fanfic-B', tags: [{ key: 'fanfic', value: 'B' }] },
    ]);
    const result = evaluateRules(
      [{
        premise: { op: 'true' },
        action: {
          type: 'sort_by',
          sortKeys: [
            { tag: 'fanfic', value: 'B' },
            { tag: 'fanfic', value: 'A' },
          ],
        },
      }],
      new Map(),
      [slot]
    );
    expect(result.sortOrders.get(makeSlotId('s1'))).toEqual([makeDocId('fanfic-B'), makeDocId('fanfic-A')]);
  });

  it('TC-003-06: sort_by with matchVar uses variable value', () => {
    const slot = makeVarGroupSlot('s1', [
      { id: 'en-doc', tags: [{ key: 'lang', value: 'en' }] },
      { id: 'ja-doc', tags: [{ key: 'lang', value: 'ja' }] },
    ]);
    const variables: VariableMap = new Map([['lang', 'ja']]);
    const result = evaluateRules(
      [{
        premise: { op: 'true' },
        action: { type: 'sort_by', sortKeys: [{ tag: 'lang', matchVar: 'lang' }] },
      }],
      variables,
      [slot]
    );
    expect(result.sortOrders.get(makeSlotId('s1'))).toEqual([makeDocId('ja-doc'), makeDocId('en-doc')]);
  });

  it('TC-003-07: select action sorts matching member first', () => {
    const slot = makeVarGroupSlot('s1', [
      { id: 'arc-doc', tags: [{ key: 'summary', value: 'arc' }] },
      { id: 'chapter-doc', tags: [{ key: 'summary', value: 'chapter' }] },
      { id: 'no-tag-doc', tags: [] },
    ]);
    const result = evaluateRules(
      [{
        premise: { op: 'true' },
        action: { type: 'select', match: { tag: 'summary', value: 'chapter' } },
      }],
      new Map(),
      [slot]
    );
    const order = result.sortOrders.get(makeSlotId('s1'));
    expect(order?.[0]).toBe(makeDocId('chapter-doc'));
    expect(order?.[1]).toBe(makeDocId('arc-doc'));
    expect(order?.[2]).toBe(makeDocId('no-tag-doc'));
  });

  it('TC-003-08: later rule overrides earlier for same slot', () => {
    const slot = makeDocSlot('s1', []);
    const result = evaluateRules(
      [
        { premise: { op: 'true' }, action: { type: 'toggle_off' } },
        { premise: { op: 'true' }, action: { type: 'toggle_on' } },
      ],
      new Map(),
      [slot]
    );
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(true);
  });

  it('TC-003-09: missing tag returns false — slot stays toggled on', () => {
    const slot = makeDocSlot('s1', []); // no tags
    const result = evaluateRules(
      [{
        premise: { op: 'eq', left: { type: 'tag', tag: 'lang' }, right: { type: 'literal', value: 'ja' } },
        action: { type: 'toggle_off' },
      }],
      new Map(),
      [slot]
    );
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(true);
  });

  it('TC-003-10: numeric comparison toggles off chapter:9 but not chapter:10', () => {
    const slot9 = makeDocSlot('s9', [{ key: 'chapter', value: '9' }]);
    const slot10 = makeDocSlot('s10', [{ key: 'chapter', value: '10' }]);
    const result = evaluateRules(
      [{
        premise: { op: 'lt', left: { type: 'tag', tag: 'chapter' }, right: { type: 'literal', value: 10 } },
        action: { type: 'toggle_off' },
      }],
      new Map(),
      [slot9, slot10]
    );
    expect(result.toggleStates.get(makeSlotId('s9'))).toBe(false);
    expect(result.toggleStates.get(makeSlotId('s10'))).toBe(true);
  });

  it('TC-003-11: string fallback type coercion — "prologue" < 103 is false (string comparison)', () => {
    const slot = makeDocSlot('s1', [{ key: 'arc', value: 'prologue' }]);
    const result = evaluateRules(
      [{
        premise: { op: 'lt', left: { type: 'tag', tag: 'arc' }, right: { type: 'literal', value: 103 } },
        action: { type: 'toggle_off' },
      }],
      new Map(),
      [slot]
    );
    // "prologue" does not parse as number, 103 parses as number, so not both numeric → string comparison
    // String("prologue") < String(103) = "prologue" < "103" — in JS string comparison, "p" > "1", so false
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(true);
  });

  it('TC-003-12: not premise — slot stays toggled on (premise = not(eq(lang, en)) = false)', () => {
    const slot = makeDocSlot('s1', [{ key: 'lang', value: 'en' }]);
    const result = evaluateRules(
      [{
        premise: {
          op: 'not',
          condition: {
            op: 'eq',
            left: { type: 'tag', tag: 'lang' },
            right: { type: 'literal', value: 'en' },
          },
        },
        action: { type: 'toggle_off' },
      }],
      new Map(),
      [slot]
    );
    expect(result.toggleStates.get(makeSlotId('s1'))).toBe(true);
  });
});
