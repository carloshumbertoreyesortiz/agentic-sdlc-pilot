/**
 * Block Kit builders for the three human-loop checkpoints (impl guide §12.3 /
 * architecture §04). Each is a pure function: typed input → a Slack `blocks`
 * array, unit-testable without a workspace. The Bolt runtime posts these once
 * the app is live (US-038); the action_ids below are the contract the
 * interaction handlers will listen for.
 */

/** A Block Kit block — kept as a plain object so src/ needs no Slack SDK. */
export type SlackBlock = Record<string, unknown>;

/** Stats above which a PR is flagged "large — review on GitHub". */
export const LARGE_PR_FILES = 10;
export const LARGE_PR_ADDITIONS = 500;

/** Token cost / model captured in .agent/provenance.json for a PR. */
export interface ProvenanceSummary {
  run_id: string;
  model: string;
  token_cost: { input: number; output: number };
}

export interface PlanApprovalInput {
  runId: string;
  task: string;
  planSummary: string;
  planUrl?: string;
}

export interface PrReviewInput {
  repo: string;
  prNumber: number;
  title: string;
  url: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  reviewer?: string;
  /** From .agent/provenance.json on the PR; null/undefined ⇒ MISSING. */
  provenance?: ProvenanceSummary | null;
}

export interface PreviousDeploy {
  when: string;
  ref: string;
  who: string;
  result: string;
}

export interface DeployApprovalInput {
  runId: string;
  environment: string;
  ref: string;
  summary: string;
  /** Change descriptions (issues/PRs) since the previous deploy ref. */
  changes: string[];
  /** Result of the last `check` workflow run on this ref. */
  checks: 'passing' | 'failing' | 'unknown';
  previousDeploy?: PreviousDeploy;
}

// ── small pure helpers (unit-tested) ────────────────────────────────────────

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Compact count: 1200 → "1.2k", 96 → "96". */
export function fmtCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** PR stats line, with a "large PR" warning past the caps. */
export function prStatsLine(files: number, additions: number, deletions: number): string {
  const base = `:page_facing_up: ${files} files · :heavy_plus_sign: ${fmtCount(additions)} · :heavy_minus_sign: ${fmtCount(deletions)}`;
  return files > LARGE_PR_FILES || additions > LARGE_PR_ADDITIONS
    ? `${base} (large PR — review on GitHub)`
    : base;
}

/** Provenance line — defence-in-depth so reviewers never approve unverified work. */
export function provenanceLine(p: ProvenanceSummary | null | undefined): string {
  if (!p) return '🔒 Provenance: ✗ MISSING — do not approve';
  const cost = `${p.token_cost.input}+${p.token_cost.output} tok`;
  return `🔒 Provenance: ✓ run_id \`${p.run_id}\` · model \`${p.model}\` · cost ${cost}`;
}

/** Bulleted change list, capped with "…and N more". */
export function formatChanges(changes: string[], cap = 5): string {
  if (changes.length === 0) return '_No change list available._';
  const shown = changes.slice(0, cap).map((c) => `• ${c}`);
  if (changes.length > cap) shown.push(`…and ${changes.length - cap} more`);
  return shown.join('\n');
}

// ── block primitives ────────────────────────────────────────────────────────

function header(text: string): SlackBlock {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } };
}

function section(markdown: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text: markdown } };
}

function context(markdown: string): SlackBlock {
  return { type: 'context', elements: [{ type: 'mrkdwn', text: markdown }] };
}

function confirmDialog(title: string, text: string, confirmText: string): SlackBlock {
  return {
    title: { type: 'plain_text', text: title },
    text: { type: 'mrkdwn', text },
    confirm: { type: 'plain_text', text: confirmText },
    deny: { type: 'plain_text', text: 'Cancel' },
  };
}

interface ButtonOpts {
  style?: 'primary' | 'danger';
  url?: string;
  confirm?: SlackBlock;
}

function button(text: string, actionId: string, value: string, opts: ButtonOpts = {}): SlackBlock {
  const b: SlackBlock = {
    type: 'button',
    text: { type: 'plain_text', text, emoji: true },
    action_id: actionId,
  };
  if (opts.url) b.url = opts.url;
  else b.value = value;
  if (opts.style) b.style = opts.style;
  if (opts.confirm) b.confirm = opts.confirm;
  return b;
}

// ── checkpoint builders ──────────────────────────────────────────────────────

/** Checkpoint 1 — Plan approval: task + plan + approve(confirm) / edit / reject. */
export function buildPlanApprovalMessage(input: PlanApprovalInput): SlackBlock[] {
  const summary = input.planUrl
    ? `${input.planSummary}\n\n<${input.planUrl}|Open full plan>`
    : input.planSummary;
  return [
    header('Checkpoint 1 · Plan approval'),
    section(`*Task:* ${truncate(input.task, 200)}`),
    section(summary),
    context(`run \`${input.runId}\``),
    {
      type: 'actions',
      block_id: 'plan_approval',
      elements: [
        button('Approve', 'plan_approve', input.runId, {
          style: 'primary',
          confirm: confirmDialog('Approve plan?', 'Approve plan and start coding?', 'Approve'),
        }),
        button('Edit', 'plan_edit', input.runId),
        button('Reject', 'plan_reject', input.runId, { style: 'danger' }),
      ],
    },
  ];
}

/** Checkpoint 2 — PR review (DM): summary + provenance + GitHub link. */
export function buildPrReviewDm(input: PrReviewInput): SlackBlock[] {
  const mention = input.reviewer ? `<@${input.reviewer}> ` : '<!channel> ';
  return [
    header('Checkpoint 2 · PR review'),
    section(
      `${mention}Please review *<${input.url}|${input.repo}#${input.prNumber}>*\n*${input.title}*`,
    ),
    section(prStatsLine(input.filesChanged, input.additions, input.deletions)),
    section(provenanceLine(input.provenance)),
    {
      type: 'actions',
      block_id: 'pr_review',
      elements: [
        button('View on GitHub', 'pr_view', input.url, { url: input.url }),
        button('Approve', 'pr_approve', String(input.prNumber), { style: 'primary' }),
        button('Request changes', 'pr_request_changes', String(input.prNumber), {
          style: 'danger',
        }),
      ],
    },
  ];
}

/** Checkpoint 3 — Deploy approval: changes + tests + prior deploy + approve(confirm) / cancel. */
export function buildDeployApprovalMessage(input: DeployApprovalInput): SlackBlock[] {
  const checksLine =
    input.checks === 'passing'
      ? `✅ Tests passing on \`${input.ref}\``
      : input.checks === 'failing'
        ? `❌ Tests NOT passing on \`${input.ref}\` — do not deploy`
        : `⚠️ Test status unknown for \`${input.ref}\``;
  const prev = input.previousDeploy
    ? `Previous deploy: ${input.previousDeploy.when} · \`${input.previousDeploy.ref}\` · ${input.previousDeploy.who} · ${input.previousDeploy.result}`
    : 'Previous deploy: none (first deploy)';
  return [
    header('Checkpoint 3 · Deploy approval'),
    section(`*Environment:* ${input.environment}\n*Ref:* \`${input.ref}\``),
    section(input.summary),
    section(`*Changes in this deploy:*\n${formatChanges(input.changes)}`),
    section(checksLine),
    context(prev),
    context(`run \`${input.runId}\``),
    {
      type: 'actions',
      block_id: 'deploy_approval',
      elements: [
        button('Approve deploy', 'deploy_approve', input.runId, {
          style: 'primary',
          confirm: confirmDialog(
            'Approve deploy?',
            `Approve deploy to *${input.environment}*?`,
            'Deploy',
          ),
        }),
        button('Cancel', 'deploy_cancel', input.runId, { style: 'danger' }),
      ],
    },
  ];
}
