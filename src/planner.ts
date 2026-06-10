import type { TokenCost } from './provenance.js';

/** Shape of the Anthropic Messages API `usage` object we care about. */
export interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Map a real API `usage` object into a provenance `token_cost`. */
export function tokenCostFromUsage(usage: ApiUsage): TokenCost {
  return { input: usage.input_tokens, output: usage.output_tokens };
}
