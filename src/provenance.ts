import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TokenCost {
  input: number;
  output: number;
}

/** Provenance record written to .agent/provenance.json (see docs/provenance.schema.json). */
export interface Provenance {
  run_id: string;
  task: string;
  agent_identity: string;
  human_approver: string;
  model: string;
  started_at: string;
  finished_at: string;
  prompt_hash: string;
  tool_trace: string[];
  attachment_hashes: string[];
  token_cost: TokenCost;
  /**
   * Reference to the CP1-approved plan hash for this work. Optional during the
   * grace period ending 2026-08-02 (US-071 Phase 1); becomes required in the
   * follow-up story that depends on US-066 (CP3 gate). Not in REQUIRED_FIELDS
   * yet — absence must not fail validation during the grace period.
   */
  scope_anchor?: string | null;
  /** CP1 (plan approval) approver — US-066. Optional during Phase 0/1 (solo). */
  cp1_approver?: { identity: string; approved_at?: string; plan_hash?: string } | null;
  /** CP3 (deployment closure) approver — US-066. Optional during Phase 0/1 (solo). */
  cp3_approver?: { identity: string; approved_at?: string } | null;
  /** Initiative owning this work (team-routing.yaml key); defaults to agentic-pilot. US-066. */
  initiative?: string;
  /**
   * US-067: true when all acceptance criteria are tested + documented in the
   * GitHub issue (UAT). Enforced to be true at the CP2 → CP3 transition (when
   * cp3_approver is present); see src/uat.ts + scripts/validate-uat.ts.
   */
  uat_documented?: boolean | null;
  /** US-067: link to the UAT documentation / evidence. Non-empty required at CP3. */
  uat_evidence_url?: string | null;
}

export const REQUIRED_FIELDS: (keyof Provenance)[] = [
  'run_id',
  'task',
  'agent_identity',
  'human_approver',
  'model',
  'started_at',
  'finished_at',
  'prompt_hash',
  'tool_trace',
  'attachment_hashes',
  'token_cost',
];

/** Returns the required fields that are absent or null in `p`. */
export function missingFields(p: Partial<Provenance>): string[] {
  return REQUIRED_FIELDS.filter((k) => p[k] === undefined || p[k] === null).map(String);
}

/** Canonical JSON form (2-space indent, trailing newline). */
export function serializeProvenance(p: Provenance): string {
  return `${JSON.stringify(p, null, 2)}\n`;
}

/**
 * Writes a provenance record to `path`, creating parent dirs.
 * Throws if any required field is missing — mirrors the CI gate so the
 * agent fails locally before producing an unmergeable PR.
 */
export function writeProvenance(path: string, p: Provenance): void {
  const missing = missingFields(p);
  if (missing.length > 0) {
    throw new Error(`provenance missing required fields: ${missing.join(', ')}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeProvenance(p));
}
