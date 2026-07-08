// US-066: checkpoint role routing.
//
// Resolves the Change Lead / Technical Lead for an initiative and validates a
// checkpoint approver against them. These are PURE functions over a parsed
// `TeamRouting` object (the shape of docs/team-routing.yaml, US-070) so they are
// unit-tested here; the CI gate that loads the YAML and enforces the result is
// US-066 Phase 2 (a follow-up that modifies the required agent-provenance gate).

/** A named person; `handle` is a GitHub/Slack handle (never raw email). */
export interface Person {
  name: string;
  handle: string | null;
}

export interface InitiativeRoles {
  change_lead?: Person;
  technical_lead?: Person;
  initiative_lead?: Person;
}

/** Parsed shape of docs/team-routing.yaml. */
export interface TeamRouting {
  initiatives: Record<string, InitiativeRoles>;
  defaults?: { technical_lead?: Person };
}

/** The Change Lead for an initiative, or null if the initiative/role is absent. */
export function changeLead(routing: TeamRouting, initiative: string): Person | null {
  return routing.initiatives?.[initiative]?.change_lead ?? null;
}

/** The Technical Lead for an initiative, falling back to `defaults.technical_lead`. */
export function technicalLead(routing: TeamRouting, initiative: string): Person | null {
  return (
    routing.initiatives?.[initiative]?.technical_lead ??
    routing.defaults?.technical_lead ??
    null
  );
}

export interface ApproverCheck {
  authorized: boolean;
  reason: string;
}

/** True when `approver` matches a person by handle or by name. */
function personMatches(p: Person | null, approver: string): boolean {
  return !!p && (approver === p.handle || approver === p.name);
}

/**
 * Validate a CP1/CP3 approver against the initiative's Change Lead.
 *
 * Phase 0/1 exception (US-066 scope 5): while an initiative is solo-operated,
 * the sole operator is an authorized approver regardless of the Change Lead
 * mapping — mirrors the R-01 `enforce_admins=false` posture. Full role-match
 * enforcement activates when the SFB team joins.
 */
export function validateApprover(
  routing: TeamRouting,
  initiative: string,
  approver: string,
  opts: { soloOperated?: boolean; soloOperator?: string } = {},
): ApproverCheck {
  const cl = changeLead(routing, initiative);

  if (opts.soloOperated) {
    const operator = opts.soloOperator ?? approver;
    if (approver === operator || personMatches(cl, approver)) {
      return {
        authorized: true,
        reason: `solo-operated Phase 0/1 exception — approver "${approver}" accepted`,
      };
    }
    return {
      authorized: false,
      reason: `solo-operated: approver "${approver}" is not the operator "${operator}"`,
    };
  }

  if (!cl) {
    return {
      authorized: false,
      reason: `no Change Lead configured for initiative "${initiative}"`,
    };
  }
  if (personMatches(cl, approver)) {
    return { authorized: true, reason: `approver matches Change Lead (${cl.name})` };
  }
  return {
    authorized: false,
    reason: `approver "${approver}" is not the Change Lead (${cl.name}) for "${initiative}"`,
  };
}
