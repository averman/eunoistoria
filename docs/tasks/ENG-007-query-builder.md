# ENG-007 — Query Builder

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-007-query-builder`
- **Depends on:** TYP-002, TYP-004
- **Files created:** `packages/engine/src/query-builder.ts`, `packages/engine/tests/query-builder.test.ts`

## Objective

Analyze a `Premise` and determine which parts can be pushed down to the data store as `DocumentPredicate[]` (index-friendly, tag-comparison-only filters) versus which parts must be evaluated in-memory.

## Behavior

**Exported function:**
```typescript
export function buildQueryPlan(premise: Premise, variables: VariableMap): QueryPlan
```

**Pushdown eligibility rules:** A premise is fully pushdownable (converted to a `DocumentPredicate`) only when ALL of the following are true:
1. It is a leaf comparison (not `and`, `or`, `not`).
2. The left operand is `{ type: 'tag', tag: string }`.
3. The right operand is `{ type: 'literal', value }` OR `{ type: 'literal_list', values }` OR `{ type: 'var', var }` where the variable **is present** in `variables`.

If the premise meets all three conditions, convert it to a `DocumentPredicate`:
- `{ op: 'eq' }` → `{ type: 'tag_eq', key: left.tag, value: String(resolvedRight) }`
- `{ op: 'neq' }` → `{ type: 'tag_neq', ... }`
- `{ op: 'lt' }` → `{ type: 'tag_lt', ... }`
- `{ op: 'lte' }` → `{ type: 'tag_lte', ... }`
- `{ op: 'gt' }` → `{ type: 'tag_gt', ... }`
- `{ op: 'gte' }` → `{ type: 'tag_gte', ... }`
- `{ op: 'in' }` with `literal_list` right → `{ type: 'tag_in', key: left.tag, values: right.values.map(String) }`
- `{ op: 'not_in' }` with `literal_list` right → `{ type: 'tag_not_in', ... }`
- `{ op: 'true' }` or `{ op: 'always' }` → no predicate; return `{ pushdownPredicates: [], localPredicates: [] }`.

If the premise does NOT meet the conditions: return `{ pushdownPredicates: [], localPredicates: [premise] }`.

**Compound premises (`and`, `or`, `not`)** are never pushed down. They are returned as `localPredicates`.

## Test Cases

TC-007-01: `tag_eq_with_literal_is_pushdown` — `{ op:'eq', left:{type:'tag',tag:'lang'}, right:{type:'literal',value:'ja'} }` → `pushdownPredicates: [{ type:'tag_eq', key:'lang', value:'ja' }]`, `localPredicates: []`.

TC-007-02: `tag_lt_with_resolved_variable_is_pushdown` — `{ op:'lt', left:{type:'tag',tag:'chapter'}, right:{type:'var',var:'current'} }` with `variables = Map([['current', 103]])` → `{ type:'tag_lt', key:'chapter', value:'103' }` in pushdown.

TC-007-03: `tag_with_missing_variable_is_local` — same premise but variable not in `variables` → `localPredicates: [premise]`, `pushdownPredicates: []`.

TC-007-04: `var_eq_var_is_local` — `{ op:'eq', left:{type:'var',var:'a'}, right:{type:'literal',value:'x'} }` → both operands are vars/literals (left is not `tag`) → local.

TC-007-05: `and_premise_is_local` — compound `and` premise → `localPredicates: [premise]`.

TC-007-06: `always_premise_produces_no_predicates` — `{ op:'always' }` → empty pushdown, empty local.

---
