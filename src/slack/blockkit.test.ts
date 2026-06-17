import { describe, it, expect } from 'vitest';
import {
  buildPlanApprovalMessage,
  buildPrReviewDm,
  buildDeployApprovalMessage,
  type SlackBlock,
} from './blockkit.js';

/** Collect every action_id present in an actions block. */
function actionIds(blocks: SlackBlock[]): string[] {
  const actions = blocks.find((b) => b.type === 'actions') as
    | { elements: { action_id: string }[] }
    | undefined;
  return (actions?.elements ?? []).map((e) => e.action_id);
}

function headerText(blocks: SlackBlock[]): string {
  const h = blocks.find((b) => b.type === 'header') as
    | { text: { text: string } }
    | undefined;
  return h?.text.text ?? '';
}

describe('buildPlanApprovalMessage (Checkpoint 1)', () => {
  const blocks = buildPlanApprovalMessage({
    runId: 'run-123',
    task: 'Fix CSV escaping',
    planSummary: 'Touch src/csv.ts; add tests.',
    planUrl: 'https://example/plan',
  });

  it('has a Checkpoint 1 header and the three approve/edit/reject buttons', () => {
    expect(headerText(blocks)).toMatch(/Checkpoint 1/);
    expect(actionIds(blocks)).toEqual(['plan_approve', 'plan_edit', 'plan_reject']);
  });

  it('carries the run id on the buttons and links the full plan', () => {
    const json = JSON.stringify(blocks);
    expect(json).toContain('run-123');
    expect(json).toContain('https://example/plan');
  });
});

describe('buildPrReviewDm (Checkpoint 2)', () => {
  const blocks = buildPrReviewDm({
    repo: 'carloshumbertoreyesortiz/agentic-sdlc-pilot',
    prNumber: 42,
    title: 'feat: thing',
    url: 'https://github.com/x/y/pull/42',
    filesChanged: 3,
    additions: 120,
    deletions: 4,
    reviewer: 'U777',
  });

  it('has a Checkpoint 2 header and links to the PR on GitHub', () => {
    expect(headerText(blocks)).toMatch(/Checkpoint 2/);
    const json = JSON.stringify(blocks);
    expect(json).toContain('https://github.com/x/y/pull/42');
    expect(json).toContain('#42');
  });

  it('offers view / approve / request-changes actions and pings the reviewer', () => {
    expect(actionIds(blocks)).toEqual(['pr_view', 'pr_approve', 'pr_request_changes']);
    expect(JSON.stringify(blocks)).toContain('<@U777>');
  });
});

describe('buildDeployApprovalMessage (Checkpoint 3)', () => {
  const blocks = buildDeployApprovalMessage({
    runId: 'run-9',
    environment: 'staging',
    ref: 'abc1234',
    summary: 'Deploy 3 services.',
  });

  it('has a Checkpoint 3 header and approve/cancel buttons', () => {
    expect(headerText(blocks)).toMatch(/Checkpoint 3/);
    expect(actionIds(blocks)).toEqual(['deploy_approve', 'deploy_cancel']);
  });

  it('shows the environment and ref', () => {
    const json = JSON.stringify(blocks);
    expect(json).toContain('staging');
    expect(json).toContain('abc1234');
  });
});
