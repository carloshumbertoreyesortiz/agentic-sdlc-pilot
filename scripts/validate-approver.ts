import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import yaml from 'js-yaml';
import { validateApprover, changeLead, type TeamRouting } from '../src/routing.js';

/**
 * US-066 Phase 2 — CP1 approver enforcement for the agent-provenance gate.
 *
 * Reads .agent/provenance.json + docs/team-routing.yaml and checks that the CP1
 * approver is authorized for the work's initiative (via src/routing.ts
 * validateApprover). Exits non-zero (fails the required gate) on an unauthorized
 * approver.
 *
 * Phase 0/1 posture: the `agentic-pilot` initiative is solo-operated, so the sole
 * operator (its Change Lead) is authorized — mirrors R-01. Full role-match
 * enforcement kicks in for any initiative a provenance record declares that is
 * not solo-operated (e.g. `initiative: sfb` once the SFB team joins).
 */

const PROV = '.agent/provenance.json';
const ROUTING = 'docs/team-routing.yaml';

if (!existsSync(ROUTING)) {
  process.stdout.write(`::notice::${ROUTING} not present — approver validation skipped.\n`);
  process.exit(0);
}

const prov = JSON.parse(readFileSync(PROV, 'utf8')) as {
  human_approver?: string;
  initiative?: string;
  cp1_approver?: { identity?: string } | null;
};
const routing = yaml.load(readFileSync(ROUTING, 'utf8')) as TeamRouting;

const approver = prov.cp1_approver?.identity ?? prov.human_approver ?? '';
const initiative = prov.initiative ?? 'agentic-pilot';
// Phase 0/1: agentic-pilot is solo-operated unless a record says otherwise.
const soloOperated = initiative === 'agentic-pilot';
const cl = changeLead(routing, initiative);
const soloOperator = cl?.handle ?? cl?.name ?? approver;

const result = validateApprover(routing, initiative, approver, { soloOperated, soloOperator });

if (!result.authorized) {
  process.stdout.write(`::error::CP1 approver validation failed (US-066) — ${result.reason}\n`);
  process.exit(1);
}
process.stdout.write(`approver OK (initiative=${initiative}): ${result.reason}\n`);
