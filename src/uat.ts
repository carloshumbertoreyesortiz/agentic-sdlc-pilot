// US-067: UAT-before-prod gate.
//
// Telenor's Create_and_Review rule: all acceptance criteria / test scenarios
// must be tested and documented in the GitHub issue before a change is promoted
// to production ("Ready for Deployment"). The pilot enforces this at the
// CP2 → CP3 transition — no CP3 (deployment closure) proceeds unless UAT is
// documented with evidence.
//
// These are PURE functions over the provenance record (shape in
// src/provenance.ts / docs/provenance.schema.json), unit-tested here; the CI
// gate that loads the record and enforces the result is scripts/validate-uat.ts,
// wired into the required agent-provenance workflow (US-067 Phase 2).

/** The subset of the provenance record the UAT gate reads. */
export interface UatFields {
  /** CP3 (deployment closure) approver — presence signals a CP3 promotion. */
  cp3_approver?: { identity?: string } | null;
  /** True when all acceptance criteria are tested + documented in the issue. */
  uat_documented?: boolean | null;
  /** Link to the UAT documentation / evidence (the GitHub issue). */
  uat_evidence_url?: string | null;
}

export interface UatCheck {
  authorized: boolean;
  reason: string;
}

/**
 * True when this record is claiming a CP3 (deployment) promotion. The gate is
 * inert for ordinary CP2 PRs; it only bites when a record declares it is closing
 * the deployment gate (a non-empty `cp3_approver.identity`).
 */
export function claimsCp3(p: UatFields): boolean {
  return !!p.cp3_approver && (p.cp3_approver.identity ?? '').trim() !== '';
}

/**
 * Validate the UAT-before-prod rule (US-067).
 *
 * Inert unless the record claims CP3. When CP3 is claimed, requires
 * `uat_documented === true` AND a non-empty `uat_evidence_url` — otherwise the
 * gate fails ("Ready for Deployment without documented UAT").
 */
export function validateUat(p: UatFields): UatCheck {
  if (!claimsCp3(p)) {
    return {
      authorized: true,
      reason: 'no CP3 promotion claimed — UAT gate inert',
    };
  }
  if (p.uat_documented !== true) {
    return {
      authorized: false,
      reason: 'CP3 claimed but uat_documented is not true',
    };
  }
  if ((p.uat_evidence_url ?? '').trim() === '') {
    return {
      authorized: false,
      reason: 'CP3 claimed but uat_evidence_url is empty',
    };
  }
  return {
    authorized: true,
    reason: `UAT documented — evidence: ${(p.uat_evidence_url ?? '').trim()}`,
  };
}
