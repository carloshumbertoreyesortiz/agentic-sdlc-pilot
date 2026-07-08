import { describe, it, expect } from 'vitest';
import { claimsCp3, validateUat, type UatFields } from './uat.js';

describe('CP3 detection (US-067)', () => {
  it('is not claimed without a cp3_approver', () => {
    expect(claimsCp3({})).toBe(false);
    expect(claimsCp3({ cp3_approver: null })).toBe(false);
    expect(claimsCp3({ cp3_approver: { identity: '' } })).toBe(false);
    expect(claimsCp3({ cp3_approver: { identity: '   ' } })).toBe(false);
  });

  it('is claimed with a non-empty cp3_approver identity', () => {
    expect(claimsCp3({ cp3_approver: { identity: 'Ingrid Marie Urdshals' } })).toBe(true);
  });
});

describe('UAT-before-prod gate (US-067)', () => {
  it('is inert for ordinary CP2 PRs (no CP3 claimed)', () => {
    const r = validateUat({ uat_documented: false });
    expect(r.authorized).toBe(true);
    expect(r.reason).toMatch(/inert/);
  });

  it('FAILS: Ready-for-Deployment (CP3) without UAT documented', () => {
    const p: UatFields = {
      cp3_approver: { identity: 'Ingrid Marie Urdshals' },
      uat_documented: false,
      uat_evidence_url: 'https://github.com/org/repo/issues/42',
    };
    const r = validateUat(p);
    expect(r.authorized).toBe(false);
    expect(r.reason).toMatch(/uat_documented is not true/);
  });

  it('FAILS: CP3 with uat_documented true but empty evidence url', () => {
    const p: UatFields = {
      cp3_approver: { identity: 'Ingrid Marie Urdshals' },
      uat_documented: true,
      uat_evidence_url: '   ',
    };
    const r = validateUat(p);
    expect(r.authorized).toBe(false);
    expect(r.reason).toMatch(/uat_evidence_url is empty/);
  });

  it('FAILS: CP3 with missing uat fields entirely', () => {
    const r = validateUat({ cp3_approver: { identity: 'Ingrid Marie Urdshals' } });
    expect(r.authorized).toBe(false);
  });

  it('PASSES: CP3 with complete UAT evidence', () => {
    const p: UatFields = {
      cp3_approver: { identity: 'Ingrid Marie Urdshals' },
      uat_documented: true,
      uat_evidence_url: 'https://github.com/org/repo/issues/42#uat',
    };
    const r = validateUat(p);
    expect(r.authorized).toBe(true);
    expect(r.reason).toMatch(/UAT documented/);
  });
});
