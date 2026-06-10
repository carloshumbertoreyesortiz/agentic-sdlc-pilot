import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { writeProvenance, type Provenance } from '../src/provenance.js';

/**
 * Machine-generates .agent/provenance.json by invoking the US-030 writer.
 * Values are computed at runtime (timestamps, run_id, prompt hash); the
 * task and optional overrides come from argv/env. This is the wiring that
 * makes agent PRs carry real provenance rather than hand-authored JSON.
 *
 *   npx tsx scripts/write-provenance.ts "<task>"
 * Optional env: PROV_RUN_ID, PROV_APPROVER, PROV_MODEL, PROV_STARTED_AT,
 *               PROV_TOOLS (comma list), PROV_TOKENS_IN, PROV_TOKENS_OUT
 */
function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

const startedAt = process.env.PROV_STARTED_AT ?? new Date().toISOString();
const systemContract = readFileSync('CLAUDE.md', 'utf8');

const record: Provenance = {
  run_id: process.env.PROV_RUN_ID ?? `run-${Date.now()}`,
  task: process.argv[2] ?? 'unspecified',
  agent_identity: 'claude-code@agentic-sdlc-pilot',
  human_approver: process.env.PROV_APPROVER ?? 'carloshumbertoreyesortiz',
  model: process.env.PROV_MODEL ?? 'claude-opus-4-8',
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  prompt_hash: sha256(systemContract),
  tool_trace: (process.env.PROV_TOOLS ?? 'Read,Write,Edit,Bash').split(','),
  attachment_hashes: [],
  token_cost: {
    input: Number(process.env.PROV_TOKENS_IN ?? 0),
    output: Number(process.env.PROV_TOKENS_OUT ?? 0),
  },
};

writeProvenance('.agent/provenance.json', record);
process.stdout.write(`wrote .agent/provenance.json run_id=${record.run_id}\n`);
