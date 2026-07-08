import { describe, it, expect } from 'vitest';
import {
  changeLead,
  technicalLead,
  validateApprover,
  type TeamRouting,
} from './routing.js';

const routing: TeamRouting = {
  initiatives: {
    sfb: {
      change_lead: { name: 'Ingrid Marie Urdshals', handle: null },
      technical_lead: { name: 'Apoorv Shukla', handle: 'apoorv-shukla-telenor' },
    },
    'agentic-pilot': {
      change_lead: { name: 'Carlos Reyes', handle: 'carloshumbertoreyesortiz' },
      technical_lead: { name: 'Carlos Reyes', handle: 'carloshumbertoreyesortiz' },
    },
  },
  defaults: { technical_lead: { name: 'Apoorv Shukla', handle: 'apoorv-shukla-telenor' } },
};

describe('role resolution (US-066)', () => {
  it('resolves the Change Lead per initiative', () => {
    expect(changeLead(routing, 'sfb')?.name).toBe('Ingrid Marie Urdshals');
    expect(changeLead(routing, 'agentic-pilot')?.handle).toBe('carloshumbertoreyesortiz');
    expect(changeLead(routing, 'nope')).toBeNull();
  });

  it('resolves Technical Lead, falling back to defaults', () => {
    expect(technicalLead(routing, 'sfb')?.handle).toBe('apoorv-shukla-telenor');
    // unknown initiative falls back to defaults.technical_lead
    expect(technicalLead(routing, 'unknown')?.handle).toBe('apoorv-shukla-telenor');
  });
});

describe('validateApprover (US-066)', () => {
  it('authorizes the initiative Change Lead (by name or handle)', () => {
    expect(validateApprover(routing, 'sfb', 'Ingrid Marie Urdshals').authorized).toBe(true);
    expect(validateApprover(routing, 'agentic-pilot', 'carloshumbertoreyesortiz').authorized).toBe(true);
  });

  it('rejects a non-Change-Lead approver (unauthorized fails)', () => {
    const r = validateApprover(routing, 'sfb', 'random-person');
    expect(r.authorized).toBe(false);
    expect(r.reason).toContain('not the Change Lead');
  });

  it('Phase 0/1 exception: solo operator is authorized regardless of Change Lead', () => {
    const r = validateApprover(routing, 'agentic-pilot', 'carloshumbertoreyesortiz', {
      soloOperated: true,
      soloOperator: 'carloshumbertoreyesortiz',
    });
    expect(r.authorized).toBe(true);
    expect(r.reason).toContain('solo-operated');
  });

  it('solo-operated still rejects an approver who is not the operator', () => {
    const r = validateApprover(routing, 'agentic-pilot', 'intruder', {
      soloOperated: true,
      soloOperator: 'carloshumbertoreyesortiz',
    });
    expect(r.authorized).toBe(false);
  });

  it('rejects when no Change Lead is configured and not solo', () => {
    expect(validateApprover(routing, 'unmapped-initiative', 'anyone').authorized).toBe(false);
  });
});
