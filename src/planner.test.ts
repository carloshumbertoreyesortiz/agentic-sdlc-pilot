import { describe, it, expect } from 'vitest';
import {
  tokenCostFromUsage,
  flowFromSource,
  plannerInstructions,
  type CaptureFlow,
} from './planner.js';

describe('tokenCostFromUsage', () => {
  it('maps API usage to provenance token_cost', () => {
    expect(tokenCostFromUsage({ input_tokens: 12, output_tokens: 34 })).toEqual({
      input: 12,
      output: 34,
    });
  });
});

describe('flowFromSource (US-076)', () => {
  it('routes Salesforce to Flow B and Matrix to Flow C', () => {
    expect(flowFromSource('salesforce')).toBe('B');
    expect(flowFromSource('matrix')).toBe('C');
  });

  it('routes conversational/self-serve channels to Flow A', () => {
    for (const s of ['teams', 'slack', 'confluence', 'outlook', 'vscode', 'cli', 'jira']) {
      expect(flowFromSource(s)).toBe('A');
    }
  });

  it('defaults unknown/empty/null source to Flow A', () => {
    expect(flowFromSource(undefined)).toBe('A');
    expect(flowFromSource(null)).toBe('A');
    expect(flowFromSource('')).toBe('A');
    expect(flowFromSource('whatever')).toBe('A');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(flowFromSource('  SalesForce ')).toBe('B');
    expect(flowFromSource('MATRIX')).toBe('C');
  });
});

describe('plannerInstructions (US-076)', () => {
  it('Flow A asks for full decomposition (epic + stories + Business Area)', () => {
    const t = plannerInstructions('A');
    expect(t).toContain('FLOW A');
    expect(t.toLowerCase()).toContain('decompose');
    expect(t.toLowerCase()).toContain('business area');
  });

  it('Flow B is a verification pass that can skip planning', () => {
    const t = plannerInstructions('B');
    expect(t).toContain('FLOW B');
    expect(t.toLowerCase()).toContain('verification');
    expect(t.toLowerCase()).toContain('conformant');
  });

  it('Flow C produces bug triage (repro + hypothesis + next action)', () => {
    const t = plannerInstructions('C');
    expect(t).toContain('FLOW C');
    expect(t.toLowerCase()).toContain('triage');
    expect(t.toLowerCase()).toContain('reproduction');
  });

  it('has no cross-flow contamination — each block names only its own flow', () => {
    const others: Record<CaptureFlow, string[]> = {
      A: ['FLOW B', 'FLOW C'],
      B: ['FLOW A', 'FLOW C'],
      C: ['FLOW A', 'FLOW B'],
    };
    (['A', 'B', 'C'] as CaptureFlow[]).forEach((f) => {
      const t = plannerInstructions(f);
      others[f].forEach((marker) => expect(t).not.toContain(marker));
    });
  });
});
