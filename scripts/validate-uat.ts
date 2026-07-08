import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { validateUat, type UatFields } from '../src/uat.js';

/**
 * US-067 Phase 2 — UAT-before-prod enforcement for the agent-provenance gate.
 *
 * Reads .agent/provenance.json and, when the record claims a CP3 (deployment)
 * promotion (a non-empty `cp3_approver.identity`), fails the required gate
 * unless UAT is documented (`uat_documented === true`) with a non-empty
 * `uat_evidence_url`. Inert for ordinary CP2 PRs that do not claim CP3, so it
 * never blocks routine work — it only bites at the CP2 → CP3 transition.
 */

const PROV = '.agent/provenance.json';

if (!existsSync(PROV)) {
  process.stdout.write(`::notice::${PROV} not present — UAT gate skipped.\n`);
  process.exit(0);
}

const prov = JSON.parse(readFileSync(PROV, 'utf8')) as UatFields;
const result = validateUat(prov);

if (!result.authorized) {
  process.stdout.write(
    `::error::UAT-before-prod gate failed (US-067) — ${result.reason}. ` +
      'Document all acceptance criteria in the issue, then set ' +
      'uat_documented=true and uat_evidence_url before claiming CP3.\n',
  );
  process.exit(1);
}
process.stdout.write(`UAT gate OK: ${result.reason}\n`);
