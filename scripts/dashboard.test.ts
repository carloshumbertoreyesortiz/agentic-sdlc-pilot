import { describe, it, expect } from 'vitest';
import {
  parsePoints,
  parentEpic,
  pct,
  renderBar,
  storyId,
  storyNum,
  storyTitle,
  isInProgressLabel,
  storyStatusEmoji,
  parseRiskTable,
  isoWeek,
  isoWeekLabel,
  addCalendarDays,
  epicCode,
  epicWindow,
  parseDependsOn,
  buildBlocksMap,
  projectCompletionWeek,
} from './dashboard.js';

describe('parsePoints', () => {
  it('reads story points from a "(N pts)" effort line', () => {
    expect(parsePoints('**Effort:** S (2 pts)')).toBe(2);
    expect(parsePoints('**Effort:** L (13 pts)')).toBe(13);
  });

  it('reads epic points from a "**Points:** N" line', () => {
    expect(parsePoints('**Phase:** 0 · **Stories:** 5 · **Points:** 7')).toBe(7);
  });

  it('returns 0 when no points are present', () => {
    expect(parsePoints('no points here')).toBe(0);
  });
});

describe('parentEpic', () => {
  it('extracts the epic issue number from the parent reference', () => {
    expect(parentEpic('_Parent epic: #23_')).toBe(23);
  });

  it('ignores the bold "E-01" label and finds the numeric ref', () => {
    const body = '**Parent epic:** E-01 — Foundation\n\n_Parent epic: #7_';
    expect(parentEpic(body)).toBe(7);
  });

  it('returns null when there is no numeric parent', () => {
    expect(parentEpic('**Parent epic:** E-01 — Foundation')).toBeNull();
  });
});

describe('pct', () => {
  it('rounds to a whole percent', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 4)).toBe(50);
  });

  it('is 0 when the total is 0 (no divide-by-zero)', () => {
    expect(pct(0, 0)).toBe(0);
  });
});

describe('renderBar', () => {
  it('fills proportionally and never overflows the width', () => {
    expect(renderBar(0, 10, 10)).toBe('`░░░░░░░░░░` 0%');
    expect(renderBar(10, 10, 10)).toBe('`██████████` 100%');
    expect(renderBar(5, 10, 10)).toBe('`█████░░░░░` 50%');
  });

  it('handles an empty total without dividing by zero', () => {
    expect(renderBar(0, 0, 4)).toBe('`░░░░` 0%');
  });
});

describe('story title helpers', () => {
  it('extracts and upper-cases the US id', () => {
    expect(storyId('[STORY] US-007: Verify tier')).toBe('US-007');
    expect(storyId('no id here')).toBe('');
  });

  it('parses the numeric id for ordering', () => {
    expect(storyNum('[STORY] US-045: Dashboard')).toBe(45);
    expect(storyNum('nope')).toBe(0);
  });

  it('strips the [STORY] US-0NN: prefix from the title', () => {
    expect(storyTitle('[STORY] US-001: Install Homebrew on Macs')).toBe(
      'Install Homebrew on Macs',
    );
  });
});

describe('storyStatusEmoji', () => {
  it('maps closed/blocked/in-progress/to-do per the agreed rules', () => {
    expect(storyStatusEmoji({ closed: true, blocked: false, inProgress: false })).toBe(
      '✅ Done',
    );
    expect(storyStatusEmoji({ closed: false, blocked: true, inProgress: false })).toBe(
      '🟧 Blocked',
    );
    expect(storyStatusEmoji({ closed: false, blocked: false, inProgress: true })).toBe(
      '🟨 In progress',
    );
    expect(storyStatusEmoji({ closed: false, blocked: false, inProgress: false })).toBe(
      '⚪ To do',
    );
  });

  it('prefers Done over Blocked when both are set', () => {
    expect(storyStatusEmoji({ closed: true, blocked: true, inProgress: false })).toBe(
      '✅ Done',
    );
  });
});

describe('isInProgressLabel', () => {
  it('recognises in-progress / in progress / wip variants', () => {
    expect(isInProgressLabel('in-progress')).toBe(true);
    expect(isInProgressLabel('In Progress')).toBe(true);
    expect(isInProgressLabel('wip')).toBe(true);
    expect(isInProgressLabel('blocked')).toBe(false);
  });
});

describe('parseRiskTable', () => {
  const md = [
    '# Risk register',
    '',
    '| ID | Risk | Status | Mitigation | Evidence |',
    '|----|------|--------|------------|----------|',
    '| R-01 | admin bypass | Accepted | flip later | PR #62 |',
    '| R-03 | placeholder cost | Resolved 2026-06-11 | real usage | US-022 |',
  ].join('\n');

  it('extracts R-NN rows with status, by column header', () => {
    const rows = parseRiskTable(md);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 'R-01', severity: '—', status: 'Accepted' });
    expect(rows[1].id).toBe('R-03');
    expect(rows[1].status).toBe('Resolved 2026-06-11');
  });

  it('sources severity when the column exists', () => {
    const withSev = [
      '| ID | Severity | Status |',
      '|----|----------|--------|',
      '| R-09 | High | Open |',
    ].join('\n');
    expect(parseRiskTable(withSev)[0]).toEqual({
      id: 'R-09',
      severity: 'High',
      status: 'Open',
    });
  });

  it('returns [] for input with no table', () => {
    expect(parseRiskTable('just prose, no table')).toEqual([]);
  });
});

describe('isoWeek / isoWeekLabel', () => {
  it('puts 2026-01-01 (a Thursday) in ISO week 1', () => {
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toBe(1);
  });

  it('computes the pilot current week (2026-06-12 → W24)', () => {
    expect(isoWeek(new Date('2026-06-12T00:00:00Z'))).toBe(24);
    expect(isoWeekLabel(new Date('2026-06-12T00:00:00Z'))).toBe('W24');
  });

  it('treats Monday and the following Sunday as the same ISO week', () => {
    expect(isoWeek(new Date('2026-06-08T00:00:00Z'))).toBe(
      isoWeek(new Date('2026-06-14T23:59:00Z')),
    );
  });

  it('rolls a Thursday-starting year into week 53 at year-end', () => {
    expect(isoWeek(new Date('2026-12-31T00:00:00Z'))).toBe(53);
  });
});

describe('addCalendarDays', () => {
  it('adds days across a month boundary', () => {
    expect(addCalendarDays('2026-05-26', 7)).toBe('2026-06-02');
    expect(addCalendarDays('2026-06-01', 0)).toBe('2026-06-01');
  });
});

describe('epicCode', () => {
  it('pulls the E-NN code from an epic title', () => {
    expect(epicCode('[EPIC] E-07: Provenance & Compliance Workflow')).toBe('E-07');
    expect(epicCode('no code')).toBe('');
  });
});

describe('epicWindow (milestone override)', () => {
  const est = { start: '2026-06-01', days: 8 };

  it('falls back to start + duration when the milestone has no due_on', () => {
    expect(epicWindow(est, null)).toEqual({
      start: '2026-06-01',
      end: '2026-06-09',
      source: 'estimate',
    });
  });

  it('overrides the end with the milestone due_on when present', () => {
    expect(epicWindow(est, '2026-07-15T08:00:00Z')).toEqual({
      start: '2026-06-01',
      end: '2026-07-15',
      source: 'milestone',
    });
  });
});

describe('dependencies → blocks inversion', () => {
  it('parses the Depends on line', () => {
    expect(parseDependsOn('**Depends on:** US-001, US-002, US-007')).toEqual([
      'US-001',
      'US-002',
      'US-007',
    ]);
    expect(parseDependsOn('**Depends on:** —')).toEqual([]);
  });

  it('inverts depends-on into a blocks map (A blocks B if B depends on A)', () => {
    const map = buildBlocksMap([
      { id: 'US-001', body: '**Depends on:** —' },
      { id: 'US-002', body: '**Depends on:** US-001' },
      { id: 'US-008', body: '**Depends on:** US-001, US-002' },
    ]);
    expect([...(map.get('US-001') ?? [])].sort()).toEqual(['US-002', 'US-008']);
    expect([...(map.get('US-002') ?? [])].sort()).toEqual(['US-008']);
    expect(map.get('US-008')).toBeUndefined();
  });

  it('honours an explicit Blocks line too', () => {
    const map = buildBlocksMap([{ id: 'US-005', body: '**Blocks:** US-009' }]);
    expect([...(map.get('US-005') ?? [])]).toEqual(['US-009']);
  });
});

describe('projectCompletionWeek', () => {
  it('projects current week + open / weekly velocity', () => {
    // 14 closed over 7 weeks = 2/wk; 20 open ⇒ 10 more weeks ⇒ W24 + 10 = W34.
    expect(projectCompletionWeek(20, 14, 7, 24)).toBe(34);
  });

  it('rounds the projection up to a whole week', () => {
    // velocity 3/wk, 10 open ⇒ 3.33 weeks ⇒ ceil ⇒ +4.
    expect(projectCompletionWeek(10, 21, 7, 20)).toBe(24);
  });

  it('returns null when nothing has closed (no measurable velocity)', () => {
    expect(projectCompletionWeek(30, 0, 7, 24)).toBeNull();
  });
});
