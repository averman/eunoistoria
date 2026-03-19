/**
 * ENG-002: Token Estimation
 * Conservative heuristic: count characters / 4, rounded up.
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}
