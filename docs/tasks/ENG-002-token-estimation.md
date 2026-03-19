# ENG-002 — Token Estimation

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-002-token-estimation`
- **Depends on:** TYP-005
- **Files created:** `packages/engine/src/token-estimation.ts`, `packages/engine/tests/token-estimation.test.ts`

## Objective

A single pure function that estimates the token count of a string. Conservative heuristic only.

## Behavior

```typescript
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}
```

No edge-case handling. Empty string returns `0`. The function never throws.

## Test Cases

TC-002-01: `estimateTokens("")` returns `0`.
TC-002-02: `estimateTokens("abcd")` returns `1`.
TC-002-03: `estimateTokens("hello")` returns `2` (5 chars → ceil(5/4) = 2).
TC-002-04: `estimateTokens("a".repeat(400))` returns `100`.

---
