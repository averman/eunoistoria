import { describe, it, expect } from 'vitest';
import { buildQueryPlan } from '../src/query-builder.js';
import { Premise, VariableMap } from '@eunoistoria/types';

describe('ENG-007: Query Builder', () => {
  it('TC-007-01: tag_eq with literal is pushdown', () => {
    const premise: Premise = { op: 'eq', left: { type: 'tag', tag: 'lang' }, right: { type: 'literal', value: 'ja' } };
    const plan = buildQueryPlan(premise, new Map());
    expect(plan.pushdownPredicates).toEqual([{ type: 'tag_eq', key: 'lang', value: 'ja' }]);
    expect(plan.localPredicates).toHaveLength(0);
  });

  it('TC-007-02: tag_lt with resolved variable is pushdown', () => {
    const premise: Premise = { op: 'lt', left: { type: 'tag', tag: 'chapter' }, right: { type: 'var', var: 'current' } };
    const variables: VariableMap = new Map([['current', 103]]);
    const plan = buildQueryPlan(premise, variables);
    expect(plan.pushdownPredicates).toEqual([{ type: 'tag_lt', key: 'chapter', value: '103' }]);
    expect(plan.localPredicates).toHaveLength(0);
  });

  it('TC-007-03: tag with missing variable is local', () => {
    const premise: Premise = { op: 'lt', left: { type: 'tag', tag: 'chapter' }, right: { type: 'var', var: 'current' } };
    const plan = buildQueryPlan(premise, new Map());
    expect(plan.pushdownPredicates).toHaveLength(0);
    expect(plan.localPredicates).toEqual([premise]);
  });

  it('TC-007-04: var_eq_var is local (left is not tag)', () => {
    const premise: Premise = { op: 'eq', left: { type: 'var', var: 'a' }, right: { type: 'literal', value: 'x' } };
    const plan = buildQueryPlan(premise, new Map());
    expect(plan.pushdownPredicates).toHaveLength(0);
    expect(plan.localPredicates).toEqual([premise]);
  });

  it('TC-007-05: and premise is local', () => {
    const premise: Premise = {
      op: 'and',
      conditions: [
        { op: 'eq', left: { type: 'tag', tag: 'lang' }, right: { type: 'literal', value: 'en' } },
      ],
    };
    const plan = buildQueryPlan(premise, new Map());
    expect(plan.pushdownPredicates).toHaveLength(0);
    expect(plan.localPredicates).toEqual([premise]);
  });

  it('TC-007-06: always premise produces no predicates', () => {
    const premise: Premise = { op: 'always' };
    const plan = buildQueryPlan(premise, new Map());
    expect(plan.pushdownPredicates).toHaveLength(0);
    expect(plan.localPredicates).toHaveLength(0);
  });
});
