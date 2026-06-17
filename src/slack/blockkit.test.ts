import { describe, it, expect } from 'vitest';
import {
  buildPlanApprovalMessage,
  buildPrReviewDm,
  buildDeployApprovalMessage,
  truncate,
  fmtCount,
  prStatsLine,
  provenanceLine,
  formatChanges,
  type SlackBlock,
} from './blockkit.js';

interface Btn {
  action_id: string;
  confirm?: unknown;
}
function buttons(blocks: SlackBlock[]): Btn[] {
  const actions = blocks.find((b) => b.type === 'actions') as
    | { elements: Btn[] }
    | undefined;
  return actions?.elements ?? [];
}
function headerText(blocks: SlackBlock[]): string {
  const h = blocks.find((b) => b.type === 'header') as { text: { text: string } } | undefined;
  return h?.text.text ?? '';
}

describe('pure helpers', () => {
  it('truncate adds an ellipsis past the limit', () => {
    expect(truncate('abcdef', 3)).toBe('abc…');
    expect(truncate('abc', 5)).toBe('abc');
  });
  it('fmtCount compacts thousands', () => {
    expect(fmtCount(96)).toBe('96');
    expect(fmtCount(1200)).toBe('1.2k');
  });
  it('prStatsLine flags large PRs by files or additions', () => {
    expect(prStatsLine(3, 96, 8)).not.toMatch(/large PR/);
    expect(prStatsLine(11, 10, 1)).toMatch(/large PR — review on GitHub/);
    expect(prStatsLine(2, 501, 1)).toMatch(/large PR/);
    expect(prStatsLine(2, 1500, 1)).toContain('1.5k');
  });
  it('provenanceLine renders ✓ with details or a hard ✗ MISSING', () => {
    expect(
      provenanceLine({ run_id: 'r1', model: 'claude-opus-4-8', token_cost: { input: 7, output: 9 } }),
    ).toBe('🔒 Provenance: ✓ run_id `r1` · model `claude-opus-4-8` · cost 7+9 tok');
    expect(provenanceLine(null)).toBe('🔒 Provenance: ✗ MISSING — do not approve');
  });
  it('formatChanges caps at 5 with a "more" line', () => {
    expect(formatChanges([])).toMatch(/No change list/);
    expect(formatChanges(['a', 'b'])).toBe('• a\n• b');
    const many = formatChanges(['1', '2', '3', '4', '5', '6', '7']);
    expect(many).toContain('• 5');
    expect(many).not.toContain('• 6');
    expect(many).toContain('…and 2 more');
  });
});

describe('Checkpoint 1 — plan approval', () => {
  const blocks = buildPlanApprovalMessage({
    runId: 'run-123',
    task: 'X'.repeat(250),
    planSummary: 'plan',
    planUrl: 'https://example/plan',
  });
  it('has the header and approve/edit/reject', () => {
    expect(headerText(blocks)).toMatch(/Checkpoint 1/);
    expect(buttons(blocks).map((b) => b.action_id)).toEqual([
      'plan_approve',
      'plan_edit',
      'plan_reject',
    ]);
  });
  it('shows the task in the body truncated to 200 chars', () => {
    const taskSection = JSON.stringify(blocks).match(/\*Task:\*[^"]*/)?.[0] ?? '';
    expect(taskSection).toContain('…');
    expect(taskSection.replace('*Task:* ', '').replace('…', '').length).toBeLessThanOrEqual(200);
  });
  it('puts a confirm dialog on Approve only', () => {
    const bs = buttons(blocks);
    expect(bs.find((b) => b.action_id === 'plan_approve')?.confirm).toBeTruthy();
    expect(bs.find((b) => b.action_id === 'plan_reject')?.confirm).toBeUndefined();
    expect(JSON.stringify(blocks)).toContain('Approve plan and start coding?');
  });
});

describe('Checkpoint 2 — PR review', () => {
  const base = {
    repo: 'o/r',
    prNumber: 42,
    title: 'feat: thing',
    url: 'https://github.com/o/r/pull/42',
    filesChanged: 3,
    additions: 96,
    deletions: 8,
  };
  it('links to GitHub and offers view/approve/request-changes', () => {
    const blocks = buildPrReviewDm({ ...base, reviewer: 'U777' });
    expect(headerText(blocks)).toMatch(/Checkpoint 2/);
    expect(buttons(blocks).map((b) => b.action_id)).toEqual([
      'pr_view',
      'pr_approve',
      'pr_request_changes',
    ]);
    expect(JSON.stringify(blocks)).toContain('https://github.com/o/r/pull/42');
  });
  it('uses the configured reviewer, else falls back to a channel mention', () => {
    expect(JSON.stringify(buildPrReviewDm({ ...base, reviewer: 'U777' }))).toContain('<@U777>');
    expect(JSON.stringify(buildPrReviewDm(base))).toContain('<!channel>');
  });
  it('flags a large PR and shows the provenance verdict', () => {
    const big = buildPrReviewDm({ ...base, filesChanged: 20, additions: 1200 });
    expect(JSON.stringify(big)).toContain('large PR — review on GitHub');
    expect(JSON.stringify(big)).toContain('✗ MISSING — do not approve');
    const ok = buildPrReviewDm({
      ...base,
      provenance: { run_id: 'r9', model: 'm', token_cost: { input: 1, output: 2 } },
    });
    expect(JSON.stringify(ok)).toContain('✓ run_id `r9`');
  });
});

describe('Checkpoint 3 — deploy approval', () => {
  const blocks = buildDeployApprovalMessage({
    runId: 'run-9',
    environment: 'production',
    ref: 'abc1234',
    summary: 'Deploy.',
    changes: ['#1 a', '#2 b', '#3 c', '#4 d', '#5 e', '#6 f'],
    checks: 'passing',
    previousDeploy: { when: '2026-06-10', ref: 'old123', who: 'carlos', result: 'success' },
  });
  it('has the header and approve/cancel', () => {
    expect(headerText(blocks)).toMatch(/Checkpoint 3/);
    expect(buttons(blocks).map((b) => b.action_id)).toEqual(['deploy_approve', 'deploy_cancel']);
  });
  it('lists changes capped at 5, tests status, and previous deploy', () => {
    const json = JSON.stringify(blocks);
    expect(json).toContain('…and 1 more');
    expect(json).toContain('✅ Tests passing on `abc1234`');
    expect(json).toContain('Previous deploy: 2026-06-10');
  });
  it('puts an env-named confirm dialog on Approve deploy', () => {
    const approve = buttons(blocks).find((b) => b.action_id === 'deploy_approve');
    expect(approve?.confirm).toBeTruthy();
    expect(JSON.stringify(blocks)).toContain('Approve deploy to *production*?');
  });
  it('warns when tests are not passing', () => {
    const failing = buildDeployApprovalMessage({
      runId: 'r',
      environment: 'staging',
      ref: 'x',
      summary: 's',
      changes: [],
      checks: 'failing',
    });
    expect(JSON.stringify(failing)).toContain('❌ Tests NOT passing');
    expect(JSON.stringify(failing)).toContain('none (first deploy)');
  });
});
