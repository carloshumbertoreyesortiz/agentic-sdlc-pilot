// US-075: the operational view of the Matrix ↔ GitHub sync, for Ingrid.
//
// WHY AN ISSUE RATHER THAN A PAGE. The pilot's Pages site is PUBLIC and the SFB
// repo is private: publishing incident numbers and titles there would leak
// customer-reported detail out of Telenor. A self-updating issue inside the
// private repo is visible to exactly the right people, needs no new
// infrastructure or credential, and appears where the team already works.
//
// Pure functions — the rendering is tested; the I/O lives in the script.

export interface DashIssue {
  number: number;
  title: string;
  state: string;
  labels: string[];
  updatedAt?: string | null;
  /** Null when the issue carries no matrix-fields metadata. */
  status?: string | null;
  priority?: string | null;
  onBoard: boolean;
  parented: boolean;
  hasClosure: boolean;
  /** Closed as "not planned" — the incident is being cancelled, not resolved. */
  cancelled?: boolean;
  /** The epic's child list could not be read, so the link is neither confirmed nor denied. */
  parentUnknown?: boolean;
}

export interface DashInput {
  issues: DashIssue[];
  epic?: { number: number; title: string; used: number; limit: number } | null;
  /**
   * Quarter key (`26-Q4`) when no epic exists for it yet.
   *
   * Creating each quarter's epic stays a human job — four minutes a year, and a
   * reasonable moment to look at the board. That only holds if the reminder
   * reaches a human: the script already logs `::warning::`, but that lands in
   * an Actions log nobody opens. It belongs here, where Ingrid is watching.
   */
  epicMissingFor?: string | null;
  generatedAt: string;
  lastRun?: { conclusion: string; at: string } | null;
}

const CALLER_LABEL = 'updated-by-caller';

/** Issues the caller has replied to and nobody has answered. */
export function awaitingReply(issues: DashIssue[]): DashIssue[] {
  return issues.filter((i) => i.labels.includes(CALLER_LABEL));
}

/**
 * Closed, but no closure information — the incident is still open in Matrix.
 *
 * Cancelled issues are excluded. Closing as "not planned" maps to CANCELLED,
 * which takes no close notes, so flagging those as missing closure information
 * reports a problem that does not exist — and buries the ones that are real.
 */
export function closedWithoutClosure(issues: DashIssue[]): DashIssue[] {
  return issues.filter(
    (i) => i.state.toUpperCase() === 'CLOSED' && !i.hasClosure && !i.cancelled,
  );
}

/** Anything the automation has not finished decorating. */
export function undecorated(issues: DashIssue[]): DashIssue[] {
  // `parentUnknown` is excluded: a failed read is not a missing link, and
  // reporting it as one turns a transient API failure into a page of false
  // alarms. It is surfaced separately, as a count, so it is not silent either.
  return issues.filter((i) => !i.onBoard || (!i.parented && !i.parentUnknown));
}

/** Issues whose epic link could not be checked this run. */
export function parentUnchecked(issues: DashIssue[]): DashIssue[] {
  return issues.filter((i) => i.parentUnknown === true);
}

/**
 * Makes caller-written text safe to place in the dashboard body.
 *
 * Incident titles come from Matrix, where the CALLER writes them. Rendered raw,
 * an `@name` in a title would notify that person on every dashboard refresh — a
 * few times an hour once the job is event-driven — and `#123`, `[text](url)` or
 * `<tag>` would add cross-references, links or markup nobody chose. A zero-width
 * space breaks mentions; a backslash neutralises Markdown punctuation.
 */
export function inlineText(text: string): string {
  return text
    // `(` and `)` are deliberately NOT escaped: only `[` and `]` can begin a
    // link, so escaping brackets was pure noise — and it showed, as
    // `terminated\(get an end date\)` in a real incident title.
    .replace(/[\\`*_[\]<>|#~]/g, (c) => `\\${c}`)
    .replace(/@/g, '@\u200b');
}

function link(i: DashIssue): string {
  // Bare `#123`, not a markdown link. A relative `../../issues/123` looks right
  // and is not: GitHub renders the dashboard at /OWNER/REPO/issues/NNNN, so two
  // levels up strips `issues/` AND `REPO/`, landing on /OWNER/issues/123 — a
  // 404 on every row (reported by Ingrid, 2026-09-15). GitHub autolinks the
  // `#123` form against the repository the body lives in, so it cannot acquire
  // the wrong base, and it gains hover cards showing title and state for free.
  return `#${i.number} ${inlineText(i.title)}`;
}

function section(title: string, rows: string[], emptyNote: string): string {
  if (rows.length === 0) return `### ${title}\n\n_${emptyNote}_\n`;
  return `### ${title}\n\n${rows.map((r) => `- ${r}`).join('\n')}\n`;
}

/**
 * Renders the dashboard body.
 *
 * Ordered by what someone would act on, not by what is easy to count: the two
 * lists that need a human come first, health second, volume last. A dashboard
 * that opens with totals trains people to skim past the part that matters.
 */
export function renderDashboard(d: DashInput): string {
  const open = d.issues.filter((i) => i.state.toUpperCase() === 'OPEN');
  const waiting = awaitingReply(d.issues);
  const noClosure = closedWithoutClosure(d.issues);
  const missing = undecorated(d.issues);

  const parts: string[] = [
    '<!-- matrix-sync-dashboard -->',
    '# Matrix ↔ GitHub sync — live status',
    '',
    `_Updated automatically. Last refresh: **${d.generatedAt}**_`,
    '',
    '## Needs someone',
    '',
  ];

  // First, above the per-issue lists: without an epic for the current quarter
  // every incident that arrives lands unparented, so this is the one item here
  // that gets worse the longer it waits.
  if (d.epicMissingFor) {
    const [yy, q] = d.epicMissingFor.split('-');
    parts.push(
      `### 🚨 No epic exists for ${q} '${yy}`,
      '',
      `Incidents raised this quarter are arriving **unparented**. Create an issue titled `
        + `\`✨Incidents from Matrix ${q} '${yy}\` (type **Epic**) and the automation picks it `
        + 'up on the next run — nothing else to change.',
      '',
    );
  }

  parts.push(
    section(
      `⚠️ Caller has replied and is waiting (${waiting.length})`,
      waiting.map(link),
      'Nobody is waiting on a reply.',
    ),
    '',
    section(
      `⚠️ Closed without closure information (${noClosure.length})`,
      noClosure.map((i) => `${link(i)} — the Matrix incident is **still open**`),
      'Every closed issue carried its closure information.',
    ),
    '',
    '## Health',
    '',
    section(
      `Not fully set up (${missing.length})`,
      missing.map((i) => `${link(i)}${!i.onBoard ? ' — not on the board' : ''}${!i.parented ? ' — no epic link' : ''}`),
      'Everything is on the board and linked to the epic.',
    ),
    '',
  );

  const unchecked = parentUnchecked(d.issues);
  if (unchecked.length > 0) {
    parts.push(
      `_Epic links could not be checked for **${unchecked.length}** issue(s) this run — the epic's sub-issue list was unreadable. Nothing was changed._`,
      '',
    );
  }

  if (d.epic) {
    const pct = Math.round((d.epic.used / d.epic.limit) * 100);
    const warn = d.epic.used >= d.epic.limit - 10 ? ' ⚠️ **nearly full**' : '';
    parts.push(
      `**Epic capacity** — #${d.epic.number} ${inlineText(d.epic.title)}: **${d.epic.used} of ${d.epic.limit}** (${pct}%)${warn}`,
      '',
      d.epic.used >= d.epic.limit - 10
        ? '_GitHub caps an issue at 100 sub-issues, and closed ones still count. When it fills, new incidents arrive unparented and are listed above._'
        : '',
      '',
    );
  }

  if (d.lastRun) {
    const ok = d.lastRun.conclusion === 'success';
    parts.push(
      `**Last automation run** — ${ok ? '✅' : '🔴'} ${d.lastRun.conclusion} at ${d.lastRun.at}`,
      '',
      ok ? '' : '_The sync itself is unaffected; this is the GitHub-side tidy-up. Incidents still arrive._',
      '',
    );
  }

  parts.push(
    '## Volume',
    '',
    `| | |`,
    `|---|---|`,
    `| Open | **${open.length}** |`,
    `| Closed | **${d.issues.length - open.length}** |`,
    `| Total synced | **${d.issues.length}** |`,
    '',
    '### Open incidents',
    '',
  );

  if (open.length === 0) {
    parts.push('_None open._');
  } else {
    parts.push('| Issue | Priority | Status |', '|---|---|---|');
    for (const i of open) {
      parts.push(`| ${link(i)} | ${i.priority ?? '—'} | ${i.status ?? '—'} |`);
    }
  }

  parts.push(
    '',
    '---',
    '_Generated by `decorate-matrix-issues`. Do not edit — this body is rewritten on every run._',
  );

  return parts.filter((p) => p !== undefined).join('\n');
}
