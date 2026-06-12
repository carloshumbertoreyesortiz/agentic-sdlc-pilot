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
