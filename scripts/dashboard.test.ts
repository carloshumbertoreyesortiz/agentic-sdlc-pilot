import { describe, it, expect } from 'vitest';
import { parsePoints, parentEpic, pct, renderBar } from './dashboard.js';

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
