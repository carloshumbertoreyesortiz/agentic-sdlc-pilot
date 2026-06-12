import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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
}
interface GhPr {
  number: number;
  title: string;
  headRefName: string;
  url: string;
  isDraft: boolean;
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
    'number,title,state,body,labels,milestone,closedAt',
  ]);
  return JSON.parse(out) as GhIssue[];
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

function ganttSection(label: string, start: string, end: string, ratio: number): string {
  const dur = daysBetween(start, end);
  const doneDays = Math.max(0, Math.min(dur, Math.round(dur * ratio)));
  const remDays = dur - doneDays;
  const id = label.replace(/[^a-z0-9]/gi, '').slice(0, 8);
  const lines = [`    section ${label}`];
  if (doneDays > 0) {
    lines.push(`    ${pct(ratio * 100, 100)}% complete :done, ${id}d, ${start}, ${doneDays}d`);
  }
  if (remDays > 0) {
    const after = doneDays > 0 ? `after ${id}d` : start;
    lines.push(`    remaining :active, ${id}r, ${after}, ${remDays}d`);
  }
  return lines.join('\n');
}

function buildDashboard(issues: GhIssue[], prs: GhPr[]): string {
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

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

  const out: string[] = [];
  out.push('# 📊 Agentic SDLC Pilot — Delivery Dashboard');
  out.push('');
  out.push(
    `_Auto-generated from the [Issues](https://github.com/${REPO}/issues) · last updated **${now} UTC**. Do not edit by hand — see \`scripts/dashboard.ts\`._`,
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

  // Timeline (Gantt)
  out.push('## 🗓️ Phase timeline');
  out.push('');
  out.push(
    '_Planned windows (vertical line = today). Edit dates in `PHASES` in `scripts/dashboard.ts`._',
  );
  out.push('');
  out.push('```mermaid');
  out.push('gantt');
  out.push('    title Agentic SDLC pilot — phase plan vs. progress');
  out.push('    dateFormat YYYY-MM-DD');
  out.push('    axisFormat %b %d');
  out.push('    todayMarker stroke-width:3px,stroke:#d93f0b,opacity:0.7');
  PHASES.forEach((p) => {
    const t = phaseTally.get(p.key)!;
    const ratio = t.ptsTotal === 0 ? 0 : t.ptsClosed / t.ptsTotal;
    out.push(ganttSection(p.label, p.start, p.end, ratio));
  });
  out.push('```');
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

  return out.join('\n');
}

function main(): void {
  const issues = fetchIssues();
  const prs = fetchAgentPrs();
  const md = buildDashboard(issues, prs);
  writeFileSync('DASHBOARD.md', md);
  process.stdout.write(`DASHBOARD.md written — ${issues.length} issues.\n`);
}

// Only run when executed directly, so tests can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
