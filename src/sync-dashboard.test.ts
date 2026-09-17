import { describe, expect, it } from 'vitest';
import { awaitingReply, closedWithoutClosure, inlineText, renderDashboard, undecorated, type DashIssue } from './sync-dashboard.js';

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

  it('does not flag cancelled issues as missing closure information', () => {
    // Closing as "not planned" maps to CANCELLED, which takes no close notes.
    // INC0072921 (#3152) was cancelled this way and the sync reported it as a
    // failure for two days; flagging it here would have said the same thing.
    const issues = [
      { ...base, number: 7, state: 'CLOSED', hasClosure: false, cancelled: true },
      { ...base, number: 8, state: 'CLOSED', hasClosure: false },
    ];
    expect(closedWithoutClosure(issues).map((i) => i.number)).toEqual([8]);
  });

  it('flags anything missing board placement or an epic link', () => {
    const issues = [base, { ...base, number: 5, onBoard: false }, { ...base, number: 6, parented: false }];
    expect(undecorated(issues).map((i) => i.number)).toEqual([5, 6]);
  });

  it('shouts when the quarter has no epic, and says how to fix it', () => {
    // The script already logs ::warning:: for this, but an Actions log is not a
    // notification — nobody opens one. Ingrid keeps epic creation as a manual
    // job on the strength of being told when it is due, so the telling has to
    // land somewhere she actually looks.
    const body = renderDashboard({ issues: [base], epicMissingFor: '26-Q4', generatedAt: 'now' });
    expect(body).toContain("No epic exists for Q4 '26");
    expect(body).toContain("Incidents from Matrix Q4 '26");
    expect(body.indexOf('No epic exists')).toBeLessThan(body.indexOf('Caller has replied'));
  });

  it('says nothing about epics when the quarter has one', () => {
    const body = renderDashboard({ issues: [base], generatedAt: 'now' });
    expect(body).not.toContain('No epic exists');
  });

  it('links issues by bare reference, never by a relative path', () => {
    // `../../issues/N` resolves to /OWNER/issues/N from the dashboard's own
    // URL — the repo segment is eaten, and every row 404s.
    const body = renderDashboard({
      issues: [{ ...base, number: 3138, state: 'CLOSED' }],
      epic: { number: 3185, title: "Q3 '26", used: 23, limit: 100 },
      generatedAt: 'now',
    });
    expect(body).not.toContain('../');
    expect(body).toContain('#3138');
    expect(body).toContain('#3185');
  });

  it('does not let a caller-written title mention, link or reference anything', () => {
    // Titles are written by callers in Matrix. Raw, an @mention would notify on
    // every dashboard refresh.
    const title = 'INC1 - ask @ops-team see #42 [here](http://x) <b>';
    const body = renderDashboard({
      issues: [{ ...base, labels: ['matrix', 'updated-by-caller'], title }],
      generatedAt: 'now',
    });
    expect(body).not.toContain('@ops-team');
    expect(body).not.toContain('](http');
    expect(body).not.toContain(' #42');
    expect(body).not.toContain('<b>');
  });

  it('leaves an ordinary incident title readable', () => {
    expect(inlineText('INC0072789 - notifications not sent')).toBe('INC0072789 - notifications not sent');
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
