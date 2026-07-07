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

// ── US-076: three-flow planner routing ───────────────────────────────────────
// The pilot's intake splits into three flows (docs/way-of-work.md §1). The
// planner shapes its output per flow, keyed off the `NormalizedIntake.source`
// (the canonical typed schema lands with US-052; until then the flow is passed
// via PLANNER_SOURCE / PLANNER_FLOW). These are pure so each flow is unit-tested
// for shape and for no cross-flow contamination.

/** A = larger initiatives (dialogue); B = SFB TCR (#1121); C = Matrix defect (#1595). */
export type CaptureFlow = 'A' | 'B' | 'C';

/**
 * Map a `NormalizedIntake.source` to its flow. Salesforce → B, Matrix → C, and
 * every conversational/self-serve channel (teams, slack, confluence, outlook,
 * vscode, cli, and the deprecated jira) → A. Unknown/empty defaults to A.
 */
export function flowFromSource(source: string | null | undefined): CaptureFlow {
  switch ((source ?? '').trim().toLowerCase()) {
    case 'salesforce':
      return 'B';
    case 'matrix':
      return 'C';
    default:
      return 'A';
  }
}

/**
 * Flow-specific planner instructions injected into the system prompt. Each block
 * is self-contained and names only its own flow so the three never bleed into
 * one another (asserted in planner.test.ts).
 */
export function plannerInstructions(flow: CaptureFlow): string {
  switch (flow) {
    case 'A':
      return [
        'INTAKE FLOW A — larger initiative via meetings/dialogue (free-form).',
        'Decompose the requirement into an epic plus stories. Give each story a',
        'Type (Feature / Story / Task) and acceptance criteria, classify it by',
        'Business Area, and route it to the responsible Business Analyst',
        '(docs/way-of-work.md §12–§13). Full requirement decomposition.',
      ].join('\n');
    case 'B':
      return [
        'INTAKE FLOW B — SFB TCR Case via #1121 (arrives pre-classified).',
        'The fields are already populated by the upstream sync. Do a VERIFICATION',
        'pass only: confirm Priority, Size, Type, Sub Epic, and SFB Case Number',
        'are present and internally consistent. If every required field is present,',
        'output "conformant — no planning needed" and stop. Do NOT re-decompose or',
        'invent scope.',
      ].join('\n');
    case 'C':
      return [
        'INTAKE FLOW C — Matrix defect via #1595 (triage-focused).',
        'Produce a Bug-type triage: reproduction steps, a hypothesis of the root',
        'cause, and a single recommended next action. Preserve the link to the',
        'Matrix incident via External References. Do not plan a full feature.',
      ].join('\n');
  }
}
