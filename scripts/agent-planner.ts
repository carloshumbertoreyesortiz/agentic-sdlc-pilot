import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import Anthropic from '@anthropic-ai/sdk';
import { writeProvenance, type Provenance } from '../src/provenance.js';
import { tokenCostFromUsage } from '../src/planner.js';
import {
  UNTRUSTED_GUIDANCE,
  assemblePlannerPrompt,
  type Attachment,
} from '../src/untrusted.js';

/**
 * Headless planner (US-022, impl guide §09).
 * Reads CLAUDE.md as system context, asks the model to plan the task given on
 * argv, writes artifacts/plan.md, and records REAL token usage from the API
 * response into .agent/provenance.json via the US-030 writer.
 *
 * Untrusted-input tagging (US-023): files listed in PLANNER_ATTACHMENTS
 * (comma-separated paths) are wrapped in <untrusted_input> frames as DATA, the
 * system prompt is told to treat them as such, and their SHA-256 hashes are
 * recorded in provenance.
 *
 *   npx tsx scripts/agent-planner.ts "<task>"
 *   PLANNER_ATTACHMENTS="notes.txt,spec.md" npx tsx scripts/agent-planner.ts "<task>"
 */

// --- preflight: fail loudly without a usable key ---------------------------
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey.trim() === '') {
  process.stderr.write(
    [
      'FATAL: ANTHROPIC_API_KEY is absent or empty.',
      'The headless planner needs a real Console API key (US-006). For example:',
      '  export ANTHROPIC_API_KEY="$(security find-generic-password -a "$USER" -s ANTHROPIC_API_KEY -w)"',
      'Then re-run: npx tsx scripts/agent-planner.ts "<task>"',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const task = process.argv[2] ?? 'unspecified task';
const model = process.env.PLANNER_MODEL ?? 'claude-opus-4-8';
const startedAt = new Date().toISOString();

const systemContract = readFileSync('CLAUDE.md', 'utf8');
const system = [
  systemContract,
  '',
  'You are the Planner agent. Produce a concise implementation plan with these',
  'sections: Goal, Out of scope, Files to touch, Test plan, Acceptance criteria,',
  'Risk flags. Plan only — do not write code.',
  '',
  UNTRUSTED_GUIDANCE,
].join('\n');

// Load any attachments as untrusted material and hash them for provenance.
const attachments: Attachment[] = [];
const attachmentHashes: string[] = [];
for (const path of (process.env.PLANNER_ATTACHMENTS ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)) {
  const content = readFileSync(path, 'utf8');
  attachments.push({ label: path, content });
  attachmentHashes.push(`sha256:${createHash('sha256').update(content).digest('hex')}`);
}

const client = new Anthropic({ apiKey });
const response = await client.messages.create({
  model,
  max_tokens: 2048,
  system,
  messages: [{ role: 'user', content: assemblePlannerPrompt(task, attachments) }],
});

const planText = response.content
  .filter((block) => block.type === 'text')
  .map((block) => block.text)
  .join('\n');

mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/plan.md', `${planText}\n`);

const record: Provenance = {
  run_id: process.env.PROV_RUN_ID ?? `planner-${Date.now()}`,
  task,
  agent_identity: 'agent-planner@agentic-sdlc-pilot',
  human_approver: process.env.PROV_APPROVER ?? 'carloshumbertoreyesortiz',
  model,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  prompt_hash: `sha256:${createHash('sha256').update(system).digest('hex')}`,
  tool_trace: ['anthropic.messages.create', 'write:artifacts/plan.md'],
  attachment_hashes: attachmentHashes,
  token_cost: tokenCostFromUsage(response.usage),
};
writeProvenance('.agent/provenance.json', record);

process.stdout.write(
  `plan -> artifacts/plan.md | tokens input=${record.token_cost.input} output=${record.token_cost.output}\n`,
);
