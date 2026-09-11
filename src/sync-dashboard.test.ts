import { describe, expect, it } from 'vitest';
import { awaitingReply, closedWithoutClosure, renderDashboard, undecorated, type DashIssue } from './sync-dashboard.js';

const base: DashIssue = {
  number: 1, title: 'INC1 - something', state: 'OPEN', labels: ['matrix'],
  status: 'Development', priority: 'P2', onBoard: true, parented: true, hasClosure: false,
};

describe('sync dashboard', () => {
  it('lists issues where the caller is waiting', () => {
    const issues = [base, { ...base, number: 2, labels: ['matrix', 'updated-by-caller'] }];
    expect(awaitingReply(issues).map((i) => i.number)).toEqual([2]);
  });

  it('flags closed issues with no closure information — the incident is still open', () => {
    const issues = [
      { ...base, number: 3, state: 'CLOSED', hasClosure: false },
      { ...base, number: 4, state: 'CLOSED', hasClosure: true },
    ];
    expect(closedWithoutClosure(issues).map((i) => i.number)).toEqual([3]);
  });

  it('flags anything missing board placement or an epic link', () => {
    const issues = [base, { ...base, number: 5, onBoard: false }, { ...base, number: 6, parented: false }];
    expect(undecorated(issues).map((i) => i.number)).toEqual([5, 6]);
  });

  it('leads with what needs a person, not with totals', () => {
    const body = renderDashboard({ issues: [base], generatedAt: 'now' });
    expect(body.indexOf('Needs someone')).toBeLessThan(body.indexOf('Volume'));
  });

  it('says so plainly when nothing needs attention', () => {
    const body = renderDashboard({ issues: [base], generatedAt: 'now' });
    expect(body).toContain('Nobody is waiting on a reply');
  });

  it('warns when the epic is nearly full', () => {
    const body = renderDashboard({
      issues: [base], generatedAt: 'now',
      epic: { number: 826, title: "Incidents from Matrix '26", used: 95, limit: 100 },
    });
    expect(body).toContain('nearly full');
  });

  it('does not warn when the epic has room', () => {
    const body = renderDashboard({
      issues: [base], generatedAt: 'now',
      epic: { number: 826, title: "Incidents from Matrix '26", used: 20, limit: 100 },
    });
    expect(body).not.toContain('nearly full');
  });

  it('reassures that a failed tidy-up run does not stop incidents arriving', () => {
    const body = renderDashboard({
      issues: [base], generatedAt: 'now',
      lastRun: { conclusion: 'failure', at: 'now' },
    });
    expect(body).toContain('Incidents still arrive');
  });

  it('carries a marker so the issue can be found and rewritten', () => {
    expect(renderDashboard({ issues: [], generatedAt: 'now' })).toContain('matrix-sync-dashboard');
  });
});
