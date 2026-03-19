import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../src/token-estimation.js';

describe('ENG-002: Token Estimation', () => {
  it('TC-002-01: empty string returns 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('TC-002-02: "abcd" returns 1', () => {
    expect(estimateTokens('abcd')).toBe(1);
  });

  it('TC-002-03: "hello" returns 2 (ceil(5/4)=2)', () => {
    expect(estimateTokens('hello')).toBe(2);
  });

  it('TC-002-04: 400-char string returns 100', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });
});
