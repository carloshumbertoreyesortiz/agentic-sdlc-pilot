import { describe, it, expect } from 'vitest';
import { missingFields, serializeProvenance, REQUIRED_FIELDS, type Provenance } from './provenance.js';

const valid: Provenance = {
  run_id: 'r',
  task: 't',
  agent_identity: 'a',
  human_approver: 'h',
  model: 'm',
  started_at: '2026-01-01T00:00:00Z',
  finished_at: '2026-01-01T00:00:00Z',
  prompt_hash: 'p',
  tool_trace: [],
  attachment_hashes: [],
  token_cost: { input: 0, output: 0 },
};

describe('provenance', () => {
  it('declares 11 required fields', () => {
    expect(REQUIRED_FIELDS).toHaveLength(11);
  });

  it('accepts a complete record', () => {
    expect(missingFields(valid)).toEqual([]);
  });

  it('reports a missing field', () => {
    const incomplete: Partial<Provenance> = { ...valid };
    delete (incomplete as Record<string, unknown>).run_id;
    expect(missingFields(incomplete)).toContain('run_id');
  });

  it('serializes with a trailing newline', () => {
    expect(serializeProvenance(valid).endsWith('}\n')).toBe(true);
  });
});
