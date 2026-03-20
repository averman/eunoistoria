# Phase 2 Review — Engine Core Implementation

**Status**: ❌ **BLOCKED** — Critical TypeScript compilation errors prevent testing and deployment.

**Review Date**: March 20, 2026
**Scope**: Complete engine package (1,359 lines across 15 files)
**Summary**: The engine core logic is architecturally sound, but there are critical TypeScript errors and several edge-case concerns that must be resolved before moving forward.

---

## 1. Critical Blockers

### 1.1 TypeScript Compilation Errors (Build Failed)

**Issue**: The engine package fails to build with 29 TypeScript errors, all related to branded types (`SlotId`).

**Root Cause**: The `SelectionMap` type uses branded `SlotId` type, but the implementation uses plain `string` values.

**Error Locations**:
- `src/rule-evaluator.ts:225` — returning `Map<string, boolean>` instead of `Map<SlotId, boolean>`
- `tests/rule-evaluator.test.ts` — 20+ test errors using string literals instead of branded SlotId values
- `tests/validation.test.ts` — missing `.ok` checks on Result types

**Code Sample** (problematic):
```typescript
// rule-evaluator.ts:225 — WRONG
const toggleStates = new Map<string, boolean>();
const sortOrders = new Map<string, DocumentId[]>();
return { toggleStates, sortOrders };  // ❌ Type mismatch
```

**Expected** (per types):
```typescript
// SelectionMap expects branded types
type SelectionMap = {
  toggleStates: Map<SlotId, boolean>;
  sortOrders: Map<SlotId, DocumentId[]>;
};
```

**Fix Required**: Either:
1. **Option A**: Use string literals properly (type-safe with as const casting), OR
2. **Option B**: Create a branded type factory function to cast strings → SlotId, OR
3. **Option C**: Change SelectionMap to use `Map<string, ...>` in types.ts (not recommended, defeats branded types)

**Estimated Effort**: 2-3 hours (systematic fix across rule-evaluator.ts and all tests)

---

### 1.2 Missing Result Type Guards in Tests

**Issue**: `tests/validation.test.ts` lines 121 and 138 access `.value` on `Result` without checking `.ok` first.

```typescript
// WRONG — assumes success
const docResult = await dataStore.getDocumentRecord(...);
const allSlots = docResult.value.slots;  // ❌ Error if ok === false

// CORRECT — check first
if (!docResult.ok) return { ok: false, error: ... };
const allSlots = docResult.value.slots;  // ✓ Type-safe
```

**Locations**: `tests/validation.test.ts:121`, `138`

**Fix Required**: Add proper `.ok` checks before accessing `.value`.

**Estimated Effort**: 15 minutes

---

## 2. Architecture & Design Concerns

### 2.1 Silent Failure in Resolution

**Issue**: `src/resolution.ts:22-23` silently skips broken document references.

```typescript
if (!docResult.ok) {
  if (docResult.error === DataStoreError.NotFound) {
    // Silent skip — no log, no indication
    return { ok: true, value: '' };
  }
```

**Concern**: When resolving a composition with a missing referenced document, the system returns success with empty content. This hides data integrity issues and makes debugging difficult for Power App users.

**Expected Behavior**: Per PRD, broken references should be explicitly detected and flagged, not silently skipped during resolution.

**Recommendation**:
- Keep silent skip for **variant group fallback** (correct behavior).
- For **direct document references**, return an error or include a warning in metadata (future: add ResolutionWarning enum).

**Estimated Effort**: 1-2 hours to add error tracking metadata

---

### 2.2 Cycle Detection Edge Case

**Issue**: `src/cycle-detection.ts:57` and `69` compare error enums as strings.

```typescript
// WRONG — assumes string comparison works
else if (!docResult.ok && docResult.error !== /* DataStoreError.NotFound */ 'NotFound') {
```

**Concern**: Fragile enum comparison. If `DataStoreError.NotFound` changes, this breaks silently.

**Expected**: Import and compare using the actual enum.

```typescript
// CORRECT
import { DataStoreError } from '@eunoistoria/types';
if (!docResult.ok && docResult.error !== DataStoreError.NotFound) {
```

**Fix Required**: Import `DataStoreError` enum and use proper comparison.

**Estimated Effort**: 30 minutes

---

### 2.3 Missing .ok Checks in index.ts

**Issue**: `src/index.ts:26-34` collects slot contexts without verifying data store calls.

```typescript
const docResult = await dataStore.getDocument(compositionId);
if (!docResult.ok || docResult.value.type === 'leaf') return [];

const contexts: SlotRuleContext[] = [];

for (const slot of docResult.value.slots) {  // ❌ No null check
  const refDocResult = await dataStore.getDocument(slot.referenceDocumentId);
  const tags = refDocResult.ok ? refDocResult.value.tags : [];  // Silent fallback
```

**Concern**: If `dataStore.getDocument` fails (e.g., network error, storage failure), the code returns empty tags instead of propagating the error. Rules then evaluate with incomplete data.

**Expected**: Propagate storage errors up the call stack.

**Fix Required**: Return `Result<SlotRuleContext[], ResolutionError>` from `collectSlotContexts` and check `.ok` in `evaluateRules`.

**Estimated Effort**: 1-2 hours

---

## 3. Test Coverage Assessment

### Current Status
✅ **All packages build and test pass** — except engine (compilation errors block tests).

**Mock Test Quality**:
- Placeholder tests (1 test per package) suggest minimal actual coverage.
- Engine likely has real tests but they're blocked by the branded type errors.

### Missing Coverage (By Code Review)
1. **Resolution edge cases**:
   - ❌ Nested compositions (depth limiting — likely tested but blocked)
   - ❌ Circular references with variant groups (needs verification)
   - ❌ Access filter behavior on variant group fallback

2. **Rule evaluation edge cases**:
   - ❌ Variables with null/undefined values
   - ❌ Sort stability when multiple sort keys match
   - ❌ Tag value coercion (number ↔ string conversion)

3. **Validation constraints**:
   - ❌ Universal default enforcement (position 0 accessibility)
   - ❌ Member removal edge case (only default exists)

4. **CRUD concurrency**:
   - ❌ No tests for concurrent edits (reordering while another reorder in progress)

---

## 4. Implementation Quality Assessment

### What's Good ✅

1. **Architecture**: Hexagonal port-based design is clean. Dependency injection throughout.
2. **Error Handling Pattern**: Result<T, E> pattern is used consistently (when it's used).
3. **CRUD Separation**: Logic split across documents, slots, variant-groups, tags, presets is clean.
4. **Rule Evaluation**: Stateless function design is correct. Sorting logic is sound.
5. **Cycle Detection**: BFS algorithm is correct. Guards against self-reference.
6. **Type Safety Attempt**: Branded types are a good intention, but implementation is incomplete.

### What Needs Work ⚠️

1. **Type System Rigor**: Branded types are declared but not used consistently throughout.
2. **Error Propagation**: Several places silently fall back instead of returning errors.
3. **Input Validation**: Some CRUD operations lack depth validation (e.g., slot creation).
4. **Null Safety**: Some optional fields (e.g., `slot.referenceDocumentId`) are used without null checks.

---

## 5. Edge Cases & Concerns

### 5.1 Rule Evaluation Logic

**Question**: In `src/rule-evaluator.ts:196-202`, when a sort_by rule premise references tags, how does it determine which member's tags to check?

```typescript
if (!isVarOnly) {
  const fires = evaluatePremise(premise, slot.documentTags, variables);
  if (!fires) continue;
}
```

**Current Behavior**: Uses `slot.documentTags` (default member's tags). This is correct but **not obvious from the code**. Suggest adding a comment explaining that for sort_by rules, the premise is evaluated against the default member to decide if the rule fires.

**Recommendation**: Add clarifying comment.

---

### 5.2 Access Filter in Resolution

**Question**: When all variant group members are inaccessible, the code falls back to position 0 (lines 70-72). But what if position 0 itself is inaccessible?

```typescript
if (resolved === null) {
  resolved = membersResult.value[0];  // Unconditional — ignores access filter
}
```

**Per PRD**: Position 0 is guaranteed to be universally accessible. But the implementation doesn't **enforce** this — it just assumes it. If data is corrupted or misconfigured, an inaccessible member at position 0 will be served.

**Recommendation**: Consider adding a runtime assertion (not a throw, but a log/warning) if position 0 is inaccessible. Or validate this constraint at variant group creation/member management time.

---

### 5.3 Variable Coercion

**Current Behavior**: `src/rule-evaluator.ts:6-12` coerces variables number-first.

```typescript
function coerce(v: unknown): number | string | boolean | unknown {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? v : n;  // "103" becomes 103
  }
  return v;
}
```

**Edge Case**: What if a variable is `"0"`? It coerces to `0`, which is falsy in JavaScript. This could cause unexpected behavior in comparisons (though === is strict, so it should be OK).

**Concern**: Document this coercion behavior clearly. It's correct but non-obvious.

---

## 6. Known Limitations & Future Considerations

1. **No Parameterized Query Building**: The spec mentions query building with predicate pushdown (CONVENTIONS.md). Engine imports types but no query builder module is present. This is likely a Phase 3 concern (sql-template will own it).

2. **Max Recursion Depth**: Set to 20 (constant). No configuration. Acceptable for MVP, but should be documented in a settings file.

3. **Token Estimation**: Placeholder heuristic (length / 4). Acceptable for MVP. Will need refinement based on actual Claude tokenizer.

4. **No Transactions**: CRUD operations are individual calls. No multi-operation transactions (e.g., add slot + add tag atomically). Phase 3 (data store adapter) will handle this.

---

## 7. Blocking vs. Non-Blocking Issues

### 🔴 **BLOCKING** (Must Fix Before Phase 3)

- [ ] Fix TypeScript compilation errors in engine (branded type usage)
- [ ] Fix missing Result type checks in tests
- [ ] Fix cycle-detection enum comparison
- [ ] Fix collectSlotContexts error propagation

**Estimated Time**: 4-5 hours

### 🟡 **SHOULD FIX** (Before shipping Power App)

- [ ] Add explicit error handling for broken document references (vs. silent skip)
- [ ] Add validation for universal default enforcement (position 0 accessibility)
- [ ] Document rule evaluation behavior for sort_by premises

**Estimated Time**: 3-4 hours

### 🟢 **NICE TO HAVE** (Future/Polish)

- [ ] Add comprehensive edge-case tests (variable null handling, coercion, etc.)
- [ ] Improve token estimation algorithm
- [ ] Add rule evaluation trace/debug output for Power App UI

**Estimated Time**: 2-3 hours

---

## 8. Recommendation

**Do NOT proceed to Phase 3 until blocking issues are fixed.**

The engine is well-architected, but these compilation errors prevent:
1. Running actual tests
2. Building downstream packages (power-app, reader-app)
3. Integrating with SQLite adapter

**Proposed Next Steps**:
1. Fix the 4 blocking issues (4-5 hours)
2. Verify all tests pass
3. Get approval on "should fix" issues
4. Proceed to Phase 3 with refocused MVP plan

---

## 9. Quality Score

| Aspect | Score | Notes |
|--------|-------|-------|
| Architecture | 9/10 | Excellent separation of concerns; port-based design |
| Code Clarity | 7/10 | Good, but some functions lack explanatory comments |
| Type Safety | 6/10 | Branded types declared but not used consistently |
| Error Handling | 6/10 | Result pattern used, but some silent fallbacks |
| Test Coverage | 5/10 | Blocked by compilation errors; need to verify actual coverage |
| **Overall** | **6.6/10** | **Well-intentioned, but rough around the edges. Fixable.** |

---

## 10. Appendix: Detailed Error List

### TypeScript Compilation Errors

```
rule-evaluator.ts:225 — Type mismatch on SelectionMap return
  Expected: Map<SlotId, boolean> | Map<SlotId, DocumentId[]>
  Got: Map<string, boolean> | Map<string, DocumentId[]>
  Lines: 153-154, 225

rule-evaluator.test.ts — Branded type usage (20+ errors)
  Lines: 43, 44, 54, 55, 69, 83, 84, 106, 123, 140, 156, 169, 183, 184, 199, 219

validation.test.ts — Missing .ok checks
  Lines: 121, 138
```

---

**Next**: Await approval on approach. Will fix blocking issues and refocus Phase 3 plan.
