import { describe, it, expect } from 'vitest';
import { tokenCostFromUsage } from './planner.js';

describe('tokenCostFromUsage', () => {
  it('maps API usage to provenance token_cost', () => {
    expect(tokenCostFromUsage({ input_tokens: 12, output_tokens: 34 })).toEqual({
      input: 12,
      output: 34,
    });
  });
});
