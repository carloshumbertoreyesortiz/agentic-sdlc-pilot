import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Generates DASHBOARD.md — a delivery dashboard for the agentic-sdlc-pilot
 * backlog. It renders natively on GitHub (Mermaid + Markdown), so there is no
 * external service to host: a project "where are we" view that lives in Git.
 *
 * Sections:
 *   - Overall progress (issues + story points)
 *   - Phase timeline as a Mermaid Gantt, with a today-marker
 *   - Per-phase and per-epic progress bars
 *   - In-flight agent/* PRs and recently shipped stories
 *
 * Data comes from the GitHub Issues API via the `gh` CLI, so it behaves the
 * same locally and in CI (the workflow passes GH_TOKEN).
 *
 *   npm run dashboard            # writes DASHBOARD.md
 *
 * The phase windows in PHASES are *planned* dates — they are the single place
 * to edit as the schedule firms up (milestones in GitHub carry no due dates).
 */

const REPO =
  process.env.DASHBOARD_REPO ?? 'carloshumbertoreyesortiz/agentic-sdlc-pilot';

// Planned phase windows for the Gantt timeline. EDIT HERE as dates firm up.
const PHASES = [
  {
    key: 'phase:0',
    label: 'Phase 0 — Foundation',
    start: '2026-05-26',
    end: '2026-06-13',
  },
  {
    key: 'phase:1',
    label: 'Phase 1 — Plan-only pilot',
    start: '2026-06-09',
    end: '2026-07-04',
  },
  {
    key: 'phase:2',
    label: 'Phase 2 — Full agentic SDLC',
    start: '2026-07-07',
    end: '2026-08-01',
  },
] as const;

// Planned epic windows: per-epic start + working-day duration. Single source of
// truth for the epic Gantt UNTIL a milestone gets a real `due_on`, which then
// overrides the end date (data-driven path; see epicWindow + fetchMilestones).
// EDIT HERE as dates firm up.
const EPIC_DATES: Record<string, { start: string; days: number }> = {
  'E-01': { start: '2026-05-26', days: 7 },
  'E-02': { start: '2026-05-28', days: 9 },
  'E-04': { start: '2026-06-01', days: 8 },
  'E-03': { start: '2026-06-09', days: 6 },
  'E-05': { start: '2026-06-11', days: 10 },
  'E-06': { start: '2026-06-16', days: 6 },
  'E-07': { start: '2026-06-18', days: 7 },
  'E-09': { start: '2026-06-23', days: 10 },
  'E-10': { start: '2026-07-01', days: 6 },
  'E-08': { start: '2026-07-07', days: 10 },
};

interface GhLabel {
  name: string;
}
interface GhIssue {
  number: number;
  title: string;
  state: string; // OPEN | CLOSED
  body: string;
  labels: GhLabel[];
  milestone: { title: string } | null;
  closedAt: string | null;
  createdAt: string | null;
  assignees: { login: string }[];
}
interface GhPr {
  number: number;
  title: string;
  headRefName: string;
  url: string;
  isDraft: boolean;
}
interface Milestone {
  title: string;
  dueOn: string | null;
}
interface MergedPr {
  number: number;
  title: string;
  mergedAt: string;
}

function gh(args: string[]): string {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function fetchIssues(): GhIssue[] {
  const out = gh([
    'issue',
    'list',
    '-R',
    REPO,
    '--state',
    'all',
    '--limit',
    '300',
    '--json',
    'number,title,state,body,labels,milestone,closedAt,createdAt,assignees',
  ]);
  return JSON.parse(out) as GhIssue[];
}

function fetchMilestones(): Milestone[] {
  try {
    const out = gh(['api', `repos/${REPO}/milestones?state=all`]);
    const arr = JSON.parse(out) as { title: string; due_on: string | null }[];
    return arr.map((m) => ({ title: m.title, dueOn: m.due_on }));
  } catch {
    return [];
  }
}

function fetchMergedPrs(sinceISO: string): MergedPr[] {
  try {
    const out = gh([
      'pr',
      'list',
      '-R',
      REPO,
      '--state',
      'merged',
      '--limit',
      '100',
      '--search',
      `merged:>=${sinceISO}`,
      '--json',
      'number,title,mergedAt',
    ]);
    return JSON.parse(out) as MergedPr[];
  } catch {
    return [];
  }
}

function fetchAgentPrs(): GhPr[] {
  try {
    const out = gh([
      'pr',
      'list',
      '-R',
      REPO,
      '--state',
      'open',
      '--limit',
      '50',
      '--json',
      'number,title,headRefName,url,isDraft',
    ]);
    return (JSON.parse(out) as GhPr[]).filter((p) =>
      p.headRefName.startsWith('agent/'),
    );
  } catch {
    return [];
  }
}

// ── pure helpers (unit-tested in dashboard.test.ts) ──────────────────────────

export function hasLabel(i: GhIssue, name: string): boolean {
  return i.labels.some((l) => l.name === name);
}

export function isClosed(i: GhIssue): boolean {
  return i.state.toUpperCase() === 'CLOSED';
}

/** Story points: stories carry `(N pts)`; epics carry `**Points:** N`. */
export function parsePoints(body: string): number {
  const story = body.match(/\((\d+)\s*pts?\)/i);
  if (story) return Number(story[1]);
  const epic = body.match(/\*\*Points:\*\*\s*(\d+)/i);
  return epic ? Number(epic[1]) : 0;
}

/** The epic issue number a story belongs to, from its `_Parent epic: #N_`. */
export function parentEpic(body: string): number | null {
  const m = body.match(/Parent epic:[^\n]*#(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** The `US-0NN` id from a story title, upper-cased (empty if none). */
export function storyId(title: string): string {
  const m = title.match(/US-\d+/i);
  return m ? m[0].toUpperCase() : '';
}

/** The numeric part of the story id, for ordering (0 if none). */
export function storyNum(title: string): number {
  const m = title.match(/US-(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/** Story title with the `[STORY] US-0NN:` prefix stripped. */
export function storyTitle(title: string): string {
  return title.replace(/^\[STORY\]\s*US-\d+:\s*/i, '').trim();
}

/** A label name that marks active work (none exist in the repo yet). */
export function isInProgressLabel(name: string): boolean {
  return /in[-\s]?progress|wip/i.test(name);
}

/**
 * Status cell per the agreed mapping:
 *   closed -> Done · open+blocked -> Blocked ·
 *   open+assignee+in-progress label -> In progress · else -> To do.
 */
export function storyStatusEmoji(s: {
  closed: boolean;
  blocked: boolean;
  inProgress: boolean;
}): string {
  if (s.closed) return '✅ Done';
  if (s.blocked) return '🟧 Blocked';
  if (s.inProgress) return '🟨 In progress';
  return '⚪ To do';
}

export interface RiskRow {
  id: string;
  severity: string;
  status: string;
}

/**
 * Parses the markdown table in docs/risks.md by column header, so it survives
 * column reordering. Severity is sourced faithfully — if the doc has no
 * Severity column, it renders as `—` (not invented).
 */
export function parseRiskTable(md: string): RiskRow[] {
  const rows = md.split('\n').filter((l) => l.trim().startsWith('|'));
  if (rows.length < 3) return [];
  const header = rows[0].split('|').map((c) => c.trim().toLowerCase());
  const iId = header.indexOf('id');
  const iSev = header.indexOf('severity');
  const iStatus = header.indexOf('status');
  if (iId < 0) return [];
  return rows
    .slice(2) // skip header row + `|---|` separator
    .map((line) => line.split('|').map((c) => c.trim()))
    .filter((cells) => /^R-\d+/i.test(cells[iId] ?? ''))
    .map((cells) => ({
      id: cells[iId] ?? '',
      severity: iSev >= 0 ? (cells[iSev] ?? '—') : '—',
      status: iStatus >= 0 ? (cells[iStatus] ?? '') : '',
    }));
}

// ── v2: weeks, epic windows, dependencies, velocity ──────────────────────────

/** ISO-8601 week number (1–53) for a date. */
export function isoWeek(d: Date): number {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000);
}

/** `W24`-style label (zero-padded). */
export function isoWeekLabel(d: Date): string {
  return `W${String(isoWeek(d)).padStart(2, '0')}`;
}

/** UTC-midnight Monday of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date;
}

/** `2026-06-12` + n calendar days → `YYYY-MM-DD`. */
export function addCalendarDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** `Jun 08` short day label (UTC). */
export function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  });
}

/** The `E-0N` code from an epic title (upper-cased, empty if none). */
export function epicCode(title: string): string {
  const m = title.match(/E-\d+/i);
  return m ? m[0].toUpperCase() : '';
}

export interface EpicWindow {
  start: string;
  end: string;
  source: 'milestone' | 'estimate';
}

/**
 * Resolves an epic's Gantt window. A milestone `due_on` (when present) is the
 * data-driven path and OVERRIDES the planned end; otherwise the EPIC_DATES
 * estimate (start + working-day duration) is the fallback.
 */
export function epicWindow(
  est: { start: string; days: number },
  dueOn: string | null,
): EpicWindow {
  if (dueOn) {
    return { start: est.start, end: dueOn.slice(0, 10), source: 'milestone' };
  }
  return {
    start: est.start,
    end: addCalendarDays(est.start, est.days),
    source: 'estimate',
  };
}

/** US-ids listed on a story's `**Depends on:**` line. */
export function parseDependsOn(body: string): string[] {
  const m = body.match(/\*\*Depends on:\*\*\s*([^\n]*)/i);
  return m ? (m[1].match(/US-\d+/gi) ?? []).map((s) => s.toUpperCase()) : [];
}

/** US-ids listed on an explicit `**Blocks:**` line (rare; usually inverted). */
export function parseBlocks(body: string): string[] {
  const m = body.match(/\*\*Blocks:\*\*\s*([^\n]*)/i);
  return m ? (m[1].match(/US-\d+/gi) ?? []).map((s) => s.toUpperCase()) : [];
}

/**
 * Maps each story id → the set of stories it blocks. Sources both explicit
 * `Blocks:` lines and the inverse of every `Depends on:` (if B depends on A,
 * then A blocks B).
 */
export function buildBlocksMap(
  stories: { id: string; body: string }[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const link = (blocker: string, blocked: string): void => {
    if (!blocker || !blocked) return;
    if (!map.has(blocker)) map.set(blocker, new Set());
    map.get(blocker)!.add(blocked);
  };
  for (const s of stories) {
    parseBlocks(s.body).forEach((b) => link(s.id, b));
    parseDependsOn(s.body).forEach((dep) => link(dep, s.id));
  }
  return map;
}

/**
 * Linear projection of the week by which all open stories close at the
 * recent pace: currentWeek + open / (closedInWindow / weeksInWindow).
 * Returns null when there is no measurable velocity.
 */
export function projectCompletionWeek(
  open: number,
  closedInWindow: number,
  weeksInWindow: number,
  currentWeek: number,
): number | null {
  const velocity = closedInWindow / Math.max(1, weeksInWindow);
  if (velocity <= 0) return null;
  return Math.ceil(currentWeek + open / velocity);
}

export function pct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** A unicode progress bar, e.g. `████████░░░░░░░░░░░░░░░░` 33%. */
export function renderBar(done: number, total: number, width = 24): string {
  const ratio = total === 0 ? 0 : done / total;
  const filled = Math.min(width, Math.round(ratio * width));
  return `\`${'█'.repeat(filled)}${'░'.repeat(width - filled)}\` ${pct(done, total)}%`;
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

// ── aggregation ──────────────────────────────────────────────────────────────

interface Tally {
  closed: number;
  total: number;
  ptsClosed: number;
  ptsTotal: number;
}

function emptyTally(): Tally {
  return { closed: 0, total: 0, ptsClosed: 0, ptsTotal: 0 };
}

function add(t: Tally, issue: GhIssue): void {
  const pts = parsePoints(issue.body);
  t.total += 1;
  t.ptsTotal += pts;
  if (isClosed(issue)) {
    t.closed += 1;
    t.ptsClosed += pts;
  }
}

// ── rendering ────────────────────────────────────────────────────────────────

type EpicTag = 'done' | 'active' | 'crit' | '';

/**
 * Aggregate Gantt tag for an epic from its stories' states (first match wins):
 *   all closed -> done · any open in-progress -> active ·
 *   any open blocked -> crit · else -> '' (planned, untagged).
 */
function epicTag(epicStories: GhIssue[]): EpicTag {
  if (epicStories.length === 0) return '';
  if (epicStories.every(isClosed)) return 'done';
  const open = epicStories.filter((s) => !isClosed(s));
  if (
    open.some(
      (s) =>
        s.assignees.length > 0 &&
        s.labels.some((l) => isInProgressLabel(l.name)),
    )
  ) {
    return 'active';
  }
  if (open.some((s) => hasLabel(s, 'blocked'))) return 'crit';
  return '';
}

function buildDashboard(
  issues: GhIssue[],
  prs: GhPr[],
  riskMd: string,
  milestones: Map<string, string | null>,
  mergedPrs: MergedPr[],
  now: Date,
): string {
  const stories = issues.filter((i) => hasLabel(i, 'story'));
  const epics = issues
    .filter((i) => hasLabel(i, 'epic'))
    .sort((a, b) => a.title.localeCompare(b.title));

  const overall = emptyTally();
  stories.forEach((s) => add(overall, s));

  // Per phase (stories only — epics are containers).
  const phaseTally = new Map<string, Tally>();
  PHASES.forEach((p) => phaseTally.set(p.key, emptyTally()));
  stories.forEach((s) => {
    const p = PHASES.find((ph) => hasLabel(s, ph.key));
    if (p) add(phaseTally.get(p.key)!, s);
  });

  // ── v2 shared computations ──
  // Epic Gantt windows (milestone due_on overrides the EPIC_DATES estimate).
  const epicWindowByNum = new Map<number, EpicWindow>();
  epics.forEach((e) => {
    const est = EPIC_DATES[epicCode(e.title)] ?? { start: '2026-06-01', days: 7 };
    const dueOn = milestones.get(e.milestone?.title ?? '') ?? null;
    epicWindowByNum.set(e.number, epicWindow(est, dueOn));
  });
  // Inverse-dependency map for the per-story "Blocks" column.
  const blocksMap = buildBlocksMap(
    stories.map((s) => ({ id: storyId(s.title), body: s.body })),
  );

  // KPI counts (stories only).
  const totalStories = stories.length;
  const doneCount = stories.filter(isClosed).length;
  const blockedCount = stories.filter(
    (s) => !isClosed(s) && hasLabel(s, 'blocked'),
  ).length;
  const inProgCount = stories.filter(
    (s) =>
      !isClosed(s) &&
      s.assignees.length > 0 &&
      s.labels.some((l) => isInProgressLabel(l.name)),
  ).length;
  const todoCount = totalStories - doneCount - blockedCount - inProgCount;

  // Last 6 weeks + current week (oldest → newest).
  const curMon = mondayOf(now);
  const weeks: { mon: Date; sun: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const mon = new Date(curMon);
    mon.setUTCDate(mon.getUTCDate() - i * 7);
    const sun = new Date(mon);
    sun.setUTCDate(sun.getUTCDate() + 6);
    weeks.push({ mon, sun });
  }
  const within = (iso: string | null, mon: Date, sun: Date): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= mon.getTime() && t < sun.getTime() + 86_400_000;
  };
  const closedInWindow = stories.filter(
    (s) => isClosed(s) && within(s.closedAt, weeks[0].mon, weeks[6].sun),
  ).length;
  const currentWeek = isoWeek(now);
  const projected = projectCompletionWeek(
    totalStories - doneCount,
    closedInWindow,
    weeks.length,
    currentWeek,
  );
  const blockedOwners = stories
    .filter((s) => !isClosed(s) && hasLabel(s, 'blocked'))
    .map((s) => `${storyId(s.title)} (${s.assignees[0]?.login ?? 'unassigned'})`);

  const updated = now.toISOString().replace('T', ' ').slice(0, 16);

  const out: string[] = [];
  out.push('# 📊 Agentic SDLC Pilot — Delivery Dashboard');
  out.push('');
  out.push(
    `_Auto-generated from the [Issues](https://github.com/${REPO}/issues) · last updated **${updated} UTC**. Do not edit by hand — see \`scripts/dashboard.ts\`._`,
  );
  out.push('');

  // Overall
  out.push('## Overall progress');
  out.push('');
  out.push(`**Stories:** ${overall.closed} / ${overall.total} done`);
  out.push('');
  out.push(renderBar(overall.closed, overall.total, 36));
  out.push('');
  out.push(
    `**Story points:** ${overall.ptsClosed} / ${overall.ptsTotal} delivered`,
  );
  out.push('');
  out.push(renderBar(overall.ptsClosed, overall.ptsTotal, 36));
  out.push('');

  // KPI tile strip (large cells via `## n`).
  out.push('## 📊 KPIs');
  out.push('');
  out.push(
    '| Total | ✅ Done | 🟧 Blocked | 🟨 In Progress | ⚪ To Do | 🎯 % | 📅 Week |',
  );
  out.push('| --- | --- | --- | --- | --- | --- | --- |');
  out.push(
    `| ## ${totalStories} | ## ${doneCount} | ## ${blockedCount} | ## ${inProgCount} | ## ${todoCount} | ## ${pct(doneCount, totalStories)}% | ## ${isoWeekLabel(now)} |`,
  );
  out.push('');

  // Velocity callout (one line above the Gantt).
  const curSun = new Date(curMon);
  curSun.setUTCDate(curSun.getUTCDate() + 6);
  const projText =
    projected === null
      ? 'n/a (no recent closures)'
      : `~W${String(projected).padStart(2, '0')}`;
  const critText = blockedOwners.length > 0 ? blockedOwners.join(', ') : 'none';
  out.push(
    `> **Velocity** — Today is ${isoWeekLabel(now)} (${fmtDay(curMon)}–${fmtDay(curSun)}). ` +
      `${closedInWindow} of ${totalStories} stories closed in ${isoWeekLabel(weeks[0].mon)}–${isoWeekLabel(weeks[6].mon)}. ` +
      `Projected completion at current pace: ${projText}. Critical path: ${critText}.`,
  );
  out.push('');

  // Epic-level Gantt (ISO weeks, weekends excluded, tagged by aggregate state).
  out.push('## 🗓️ Epic timeline');
  out.push('');
  out.push(
    '_Bars are epics; axis in ISO weeks (`W%V`), weekends excluded. Colour = aggregate story state: `done` · `active` (in progress) · `crit` (blocked) · plain (planned). A milestone `due_on` overrides the planned end (else `EPIC_DATES`)._',
  );
  out.push('');
  out.push('```mermaid');
  out.push('gantt');
  out.push('    title Agentic SDLC pilot — epic timeline (ISO weeks)');
  out.push('    dateFormat YYYY-MM-DD');
  out.push('    axisFormat W%V');
  out.push('    excludes weekends');
  out.push('    todayMarker stroke-width:3px,stroke:#d93f0b,opacity:0.7');
  PHASES.forEach((ph) => {
    const phaseEpics = epics
      .filter((e) => hasLabel(e, ph.key))
      .sort((a, b) => epicCode(a.title).localeCompare(epicCode(b.title)));
    if (phaseEpics.length === 0) return;
    out.push(`    section ${ph.label}`);
    phaseEpics.forEach((e) => {
      const code = epicCode(e.title);
      const win = epicWindowByNum.get(e.number)!;
      const tag = epicTag(stories.filter((s) => parentEpic(s.body) === e.number));
      const name = e.title
        .replace(/^\[EPIC\]\s*E-\d+:\s*/i, '')
        .replace(/&/g, 'and')
        .replace(/[^\w -]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const prefix = tag ? `${tag}, ` : '';
      out.push(
        `    ${code} ${name} :${prefix}${code.replace('-', '')}, ${win.start}, ${win.end}`,
      );
    });
  });
  out.push('```');
  out.push('');

  // Weekly activity (below the Gantt).
  out.push('### Weekly activity');
  out.push('');
  out.push('| Week | Opened | Closed | Net | Notable |');
  out.push('| --- | --- | --- | --- | --- |');
  weeks.forEach((w) => {
    const opened = issues.filter((i) => within(i.createdAt, w.mon, w.sun)).length;
    const closed = issues.filter((i) => within(i.closedAt, w.mon, w.sun)).length;
    const net = closed - opened;
    const pr = mergedPrs.find((p) => within(p.mergedAt, w.mon, w.sun));
    const notable = pr ? `#${pr.number} ${pr.title.replace(/\|/g, '/')}` : '—';
    out.push(
      `| ${isoWeekLabel(w.mon)} (${fmtDay(w.mon)}–${fmtDay(w.sun)}) | ${opened} | ${closed} | ${net >= 0 ? '+' : ''}${net} | ${notable} |`,
    );
  });
  out.push('');

  // Per-phase table
  out.push('## Progress by phase');
  out.push('');
  out.push('| Phase | Stories | Points | Progress |');
  out.push('| --- | --- | --- | --- |');
  PHASES.forEach((p) => {
    const t = phaseTally.get(p.key)!;
    out.push(
      `| ${p.label} | ${t.closed}/${t.total} | ${t.ptsClosed}/${t.ptsTotal} | ${renderBar(t.ptsClosed, t.ptsTotal, 18)} |`,
    );
  });
  out.push('');

  // Status pie
  out.push('## Status distribution');
  out.push('');
  out.push('```mermaid');
  out.push('pie showData');
  out.push('    title Stories by status');
  out.push(`    "Done" : ${overall.closed}`);
  out.push(`    "In backlog" : ${overall.total - overall.closed}`);
  out.push('```');
  out.push('');

  // Per-epic table
  out.push('## Progress by epic');
  out.push('');
  out.push('| Epic | Stories | Points | Progress |');
  out.push('| --- | --- | --- | --- |');
  epics.forEach((e) => {
    const t = emptyTally();
    stories.filter((s) => parentEpic(s.body) === e.number).forEach((s) => add(t, s));
    const name = e.title.replace(/^\[EPIC\]\s*/i, '');
    out.push(
      `| [${name}](https://github.com/${REPO}/issues/${e.number}) | ${t.closed}/${t.total} | ${t.ptsClosed}/${t.ptsTotal} | ${renderBar(t.ptsClosed, t.ptsTotal, 18)} |`,
    );
  });
  out.push('');

  // Per-epic story detail (collapsed by default — manager view stays scannable)
  out.push('### Stories by epic');
  out.push('');
  out.push('_Click an epic to expand its stories._');
  out.push('');
  epics.forEach((e) => {
    const epicStories = stories
      .filter((s) => parentEpic(s.body) === e.number)
      .sort((a, b) => storyNum(a.title) - storyNum(b.title));
    const closed = epicStories.filter(isClosed).length;
    const name = e.title.replace(/^\[EPIC\]\s*/i, '');
    out.push(
      `<details><summary><strong>${name}</strong> — ${closed}/${epicStories.length} done</summary>`,
    );
    out.push('');
    out.push('| Story | Title | Status | Est. Week | Blocks |');
    out.push('| --- | --- | --- | --- | --- |');
    const win = epicWindowByNum.get(e.number)!;
    const spanDays = daysBetween(win.start, win.end);
    epicStories.forEach((s, idx) => {
      const blocked = hasLabel(s, 'blocked');
      const inProgress =
        s.assignees.length > 0 && s.labels.some((l) => isInProgressLabel(l.name));
      const status = storyStatusEmoji({
        closed: isClosed(s),
        blocked,
        inProgress,
      });
      const estDate = addCalendarDays(
        win.start,
        Math.round((idx / Math.max(1, epicStories.length)) * spanDays),
      );
      const estWeek = isoWeekLabel(new Date(`${estDate}T00:00:00Z`));
      const id = storyId(s.title);
      const blocks = [...(blocksMap.get(id) ?? [])].sort();
      const blocksText = blocks.length > 0 ? blocks.join(', ') : '—';
      out.push(
        `| [${id}](https://github.com/${REPO}/issues/${s.number}) | ${storyTitle(s.title)} | ${status} | ${estWeek} | ${blocksText} |`,
      );
    });
    out.push('');
    out.push('</details>');
    out.push('');
  });

  // In-flight
  out.push('## 🚧 In flight');
  out.push('');
  if (prs.length === 0) {
    out.push('_No open `agent/*` pull requests right now._');
  } else {
    prs.forEach((p) => {
      const draft = p.isDraft ? ' _(draft)_' : '';
      out.push(`- [#${p.number}](${p.url}) ${p.title} — \`${p.headRefName}\`${draft}`);
    });
  }
  out.push('');

  // Recently shipped
  const recent = issues
    .filter((i) => hasLabel(i, 'story') && isClosed(i) && i.closedAt)
    .sort((a, b) => (a.closedAt! < b.closedAt! ? 1 : -1))
    .slice(0, 8);
  out.push('## ✅ Recently shipped');
  out.push('');
  if (recent.length === 0) {
    out.push('_Nothing closed yet._');
  } else {
    recent.forEach((i) => {
      const when = i.closedAt!.slice(0, 10);
      const name = i.title.replace(/^\[STORY\]\s*/i, '');
      out.push(`- \`${when}\` [${name}](https://github.com/${REPO}/issues/${i.number})`);
    });
  }
  out.push('');

  // Risk register (sourced from docs/risks.md)
  const risks = parseRiskTable(riskMd);
  if (risks.length > 0) {
    out.push('## ⚠️ Risk register');
    out.push('');
    out.push('_Source: [docs/risks.md](docs/risks.md)._');
    out.push('');
    out.push('| ID | Severity | Status |');
    out.push('| --- | --- | --- |');
    risks.forEach((r) => {
      out.push(`| ${r.id} | ${r.severity} | ${r.status} |`);
    });
    out.push('');
    if (!/\|\s*severity\s*\|/i.test(riskMd)) {
      out.push(
        '_Severity is not yet a column in `docs/risks.md`, so it shows as `—`. Add a `Severity` column there and it will populate automatically._',
      );
      out.push('');
    }
  }

  return out.join('\n');
}

function readRisks(): string {
  try {
    return readFileSync('docs/risks.md', 'utf8');
  } catch {
    return '';
  }
}

function main(): void {
  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7 * 7); // 7 weeks back for merged-PR window
  const issues = fetchIssues();
  const prs = fetchAgentPrs();
  const milestones = new Map(
    fetchMilestones().map((m) => [m.title, m.dueOn] as const),
  );
  const mergedPrs = fetchMergedPrs(since.toISOString().slice(0, 10));
  const md = buildDashboard(issues, prs, readRisks(), milestones, mergedPrs, now);
  writeFileSync('DASHBOARD.md', md);
  process.stdout.write(`DASHBOARD.md written — ${issues.length} issues.\n`);
}

// Only run when executed directly, so tests can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
