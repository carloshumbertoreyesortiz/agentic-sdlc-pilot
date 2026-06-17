/**
 * Block Kit builders for the three human-loop checkpoints (impl guide §12.3 /
 * architecture §04). Each is a pure function: typed input → a Slack `blocks`
 * array, unit-testable without a workspace. The Bolt runtime posts these once
 * the app is live (US-038); the action_ids below are the contract the
 * interaction handlers will listen for.
 */

/** A Block Kit block — kept as a plain object so src/ needs no Slack SDK. */
export type SlackBlock = Record<string, unknown>;

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
}

export interface DeployApprovalInput {
  runId: string;
  environment: string;
  ref: string;
  summary: string;
}

function header(text: string): SlackBlock {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } };
}

function section(markdown: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text: markdown } };
}

function button(
  text: string,
  actionId: string,
  value: string,
  style?: 'primary' | 'danger',
  url?: string,
): SlackBlock {
  const b: SlackBlock = {
    type: 'button',
    text: { type: 'plain_text', text, emoji: true },
    action_id: actionId,
  };
  if (url) b.url = url;
  else b.value = value;
  if (style) b.style = style;
  return b;
}

/** Checkpoint 1 — Plan approval: plan summary + approve / edit / reject. */
export function buildPlanApprovalMessage(input: PlanApprovalInput): SlackBlock[] {
  const summary = input.planUrl
    ? `${input.planSummary}\n\n<${input.planUrl}|Open full plan>`
    : input.planSummary;
  return [
    header('Checkpoint 1 · Plan approval'),
    section(`*Task:* ${input.task}`),
    section(summary),
    { type: 'context', elements: [{ type: 'mrkdwn', text: `run \`${input.runId}\`` }] },
    {
      type: 'actions',
      block_id: 'plan_approval',
      elements: [
        button('Approve', 'plan_approve', input.runId, 'primary'),
        button('Edit', 'plan_edit', input.runId),
        button('Reject', 'plan_reject', input.runId, 'danger'),
      ],
    },
  ];
}

/** Checkpoint 2 — PR review (DM): one-screen summary linking to GitHub. */
export function buildPrReviewDm(input: PrReviewInput): SlackBlock[] {
  const reviewer = input.reviewer ? `<@${input.reviewer}> ` : '';
  return [
    header('Checkpoint 2 · PR review'),
    section(
      `${reviewer}Please review *<${input.url}|${input.repo}#${input.prNumber}>*\n*${input.title}*`,
    ),
    section(
      `:page_facing_up: ${input.filesChanged} files · :heavy_plus_sign: ${input.additions} · :heavy_minus_sign: ${input.deletions}`,
    ),
    {
      type: 'actions',
      block_id: 'pr_review',
      elements: [
        button('View on GitHub', 'pr_view', input.url, undefined, input.url),
        button('Approve', 'pr_approve', String(input.prNumber), 'primary'),
        button('Request changes', 'pr_request_changes', String(input.prNumber), 'danger'),
      ],
    },
  ];
}

/** Checkpoint 3 — Deploy approval: deploy summary + approve / cancel. */
export function buildDeployApprovalMessage(input: DeployApprovalInput): SlackBlock[] {
  return [
    header('Checkpoint 3 · Deploy approval'),
    section(`*Environment:* ${input.environment}\n*Ref:* \`${input.ref}\``),
    section(input.summary),
    { type: 'context', elements: [{ type: 'mrkdwn', text: `run \`${input.runId}\`` }] },
    {
      type: 'actions',
      block_id: 'deploy_approval',
      elements: [
        button('Approve deploy', 'deploy_approve', input.runId, 'primary'),
        button('Cancel', 'deploy_cancel', input.runId, 'danger'),
      ],
    },
  ];
}
