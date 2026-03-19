# ENG-003 — Rule Evaluator

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-003-rule-evaluator`
- **Depends on:** ENG-001
- **Files created:** `packages/engine/src/rule-evaluator.ts`, `packages/engine/tests/rule-evaluator.test.ts`

## Objective

A pure function that takes an ordered list of rules, runtime variables, and pre-fetched slot context data, and produces a `SelectionMap` representing the final toggle states and sort orders for all slots.

## Behavior

**Exported function signature:**
```typescript
export function evaluateRules(
  rules: Rule[],
  variables: VariableMap,
  slotContexts: SlotRuleContext[]
): SelectionMap
```

**SelectionMap initialization:**
- `toggleStates`: a new `Map`. All slot IDs start as `true` (toggled on). Slots not in the map are implicitly `true`.
- `sortOrders`: a new `Map`. For each `variant_group` slot in `slotContexts`, initialize with members sorted by `memberOrder` ascending (i.e., `[members[0].documentId, members[1].documentId, ...]`).

**Rule processing order:** rules are processed in array order, index 0 first. Later rules that affect the same slot override earlier rules on that slot.

**Premise evaluation — `isPremiseVariableOnly(premise)`:**
A premise is variable-only if no `tag` operand appears anywhere in its tree. This includes nested `and`, `or`, `not` premises. The check is recursive.
- Variable-only premises are evaluated once globally (true/false for the whole rule pass).
- Premises containing any `tag` operand are evaluated per-slot or per-member.

**Operand resolution:**
- `{ type: 'tag', tag: key }` → look up `tag.key === key` in the provided `Tag[]`, return `tag.value` (string) if found; return `undefined` if no tag with that key exists.
- `{ type: 'var', var: name }` → return `variables.get(name)`, which may be `undefined`.
- `{ type: 'literal', value }` → return `value` directly.
- `{ type: 'literal_list', values }` → return `values` array directly (used as the right side of `in`/`not_in`).

**Type coercion for comparisons (D-BP-10):**
```
function coerce(v: unknown): number | string | boolean | unknown {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? v : n;
  }
  return v;
}
```
For binary comparisons (eq, neq, lt, lte, gt, gte): coerce both sides. If BOTH results are numbers, compare numerically. Otherwise, compare as strings using `String(left)` vs `String(right)`.

**Missing operand behavior:**
- If a `tag` operand resolves to `undefined` (tag key not present on document): the entire comparison returns `false`.
- If a `var` operand resolves to `undefined` (variable not in map): the entire comparison returns `false`.
- `{ op: 'true' }` and `{ op: 'always' }` always return `true` regardless of operands.

**Premise evaluation logic:**
- `eq`: `coerce(left) === coerce(right)` (with numeric-if-both rule).
- `neq`: `coerce(left) !== coerce(right)`.
- `lt/lte/gt/gte`: numeric if both parse as numbers, otherwise string comparison.
- `in`: coerce left, then check if any element of the right list, after coercion, equals the coerced left.
- `not_in`: opposite of `in`.
- `and`: all children must be `true`.
- `or`: at least one child must be `true`.
- `not`: negate the single child.

**Action application:**

For each rule, after evaluating the premise:

**`toggle_on` / `toggle_off`:**
- If premise is variable-only and evaluates to `true`: apply the toggle to ALL slots.
- If premise is variable-only and evaluates to `false`: apply to no slots.
- If premise references tags: for each slot in `slotContexts`:
  - Use `slot.documentTags` as the tag array for premise evaluation.
  - If premise evaluates to `true`: set `selectionMap.toggleStates.set(slot.slotId, action === 'toggle_on')`.

**`sort_by`:**
- Applies only to `variant_group` slots.
- For each variant_group slot in `slotContexts`:
  - If the rule's premise is variable-only and evaluates to `false`: skip this slot.
  - If the rule's premise is variable-only and evaluates to `true`: apply sort to this slot.
  - If the rule's premise references tags: evaluate premise against each **member's** tags individually. Sorting is based on which sort key each member matches. (The premise determines whether this rule fires at all for this slot. For sort_by, if the premise references a tag, evaluate it against EACH MEMBER's tags to determine that member's sort priority. See below.)

  **Sort algorithm for a slot's members:**
  Given `sortKeys: SortKey[]`, for each member:
  1. Find the index of the **first** matching sort key.
     - A sort key `{ tag, value }` matches a member if the member has a tag where `key === tag` AND `coerce(tagValue) === coerce(value)`.
     - A sort key `{ tag, matchVar }` matches a member if the member has a tag where `key === tag` AND `coerce(tagValue) === coerce(variables.get(matchVar))`.
  2. If no sort key matches: assign priority = `sortKeys.length` (lowest priority).
  3. Sort members by priority ascending (lower index = higher priority). Use a **stable sort** to preserve relative original order among members with equal priority.
  4. Store the resulting `DocumentId[]` in `selectionMap.sortOrders.set(slot.slotId, [...])`.

**`select`:**
- Applies only to `variant_group` slots.
- Treat as `sort_by` with a single sort key: `[{ tag: action.match.tag, value: action.match.value }]`.
- If premise is variable-only and evaluates to `true`: apply to all variant_group slots.
- If premise references tags: evaluate premise (does the slot's `documentTags` match?) — if true, apply the single-key sort to this slot's members.

## Test Cases

TC-003-01: `evaluateRules([], variables, slotContexts)` — given zero rules, when evaluated, then SelectionMap has all slots toggled on and sort orders unchanged from original member order.

TC-003-02: toggle_off with variable-only premise that is true — given one rule `{ premise: { op:'true' }, action: { type:'toggle_off' } }` and two slots, when evaluated, then both slots are toggled off.

TC-003-03: toggle_off with variable-only premise that is false — given rule `{ premise: { op:'eq', left:{type:'var',var:'mode'}, right:{type:'literal',value:'reader'} }, action:{type:'toggle_off'} }` and `variables = Map([['mode','author']])`, then no slots are toggled off.

TC-003-04: toggle_off with tag premise — given one document slot tagged `chapter:5`, one document slot tagged `chapter:10`, rule `{ premise: { op:'lt', left:{type:'tag',tag:'chapter'}, right:{type:'literal',value:8} }, action:{type:'toggle_off'} }`, when evaluated, then only the `chapter:5` slot is toggled off.

TC-003-05: sort_by with literal value — given one variant_group slot with two members tagged `fanfic:A` (order 0) and `fanfic:B` (order 1), rule `{ premise:{op:'true'}, action:{type:'sort_by', sortKeys:[{tag:'fanfic',value:'B'},{tag:'fanfic',value:'A'}]} }`, then sort order becomes `[fanfic-B-id, fanfic-A-id]`.

TC-003-06: sort_by with matchVar — given variable `lang = 'ja'`, one variant_group slot with members tagged `lang:en` (order 0), `lang:ja` (order 1), rule `sort_by [{ tag:'lang', matchVar:'lang' }]` with premise `{ op:'true' }`, then sort order becomes `[ja-id, en-id]`.

TC-003-07: select action — given variant_group slot with members `[summary:arc, summary:chapter, (no summary tag)]`, rule `{ premise:{op:'true'}, action:{type:'select', match:{tag:'summary',value:'chapter'}} }`, then sort order is `[summary:chapter-id, summary:arc-id, no-tag-id]`.

TC-003-08: later rule overrides earlier — given toggle_off rule at index 0 then toggle_on rule at index 1, both with `op:'true'`, for the same slot, then final toggle state is `true`.

TC-003-09: missing tag returns false — given document slot with no tags, rule `{ premise:{op:'eq', left:{type:'tag',tag:'lang'}, right:{type:'literal',value:'ja'}}, action:{type:'toggle_off'} }`, then slot remains toggled on.

TC-003-10: numeric comparison — given document slot tagged `chapter:9`, rule `toggle_off` where `tag(chapter) < 10`, then slot is toggled off. Same slot tagged `chapter:10` is NOT toggled off.

TC-003-11: `resolves_type_coercion_string_fallback` — given document slot tagged `arc:prologue`, rule `toggle_off` where `tag(arc) < 103`, when evaluated with number-first coercion: `"prologue"` does not parse as number, so comparison is string-based (`"prologue" < "103"` → false in lexicographic order), then slot is NOT toggled off.

TC-003-12: `not` premise — given slot tagged `lang:en`, rule `toggle_off` with premise `{ op:'not', condition:{op:'eq', left:{type:'tag',tag:'lang'}, right:{type:'literal',value:'en'}} }`, then slot is NOT toggled off (premise evaluates to `not(true)` = false).

---
