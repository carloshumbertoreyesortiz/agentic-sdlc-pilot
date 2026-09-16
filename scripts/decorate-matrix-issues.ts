import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { renderDashboard, type DashIssue } from '../src/sync-dashboard.js';
import {
  extractFields,
  isCallerComment,
  isClosureComment,
  sourceUpdatedAt,
  isHumanReply,
  PROMPT_MARKER,
  type MatrixFieldValues,
} from '../src/matrix-mapping.js';

/**
 * US-075: decorates Matrix-sourced issues in the SFB production repo.
 *
 * WHERE THIS RUNS. The production copy lives in
 * `TelenorNorgeInternal/s06065-sfb-telenor-sfdc` as
 * `.github/scripts/matrix-sync/decorate.mts`, driven by `matrix-decorate.yml`
 * on issue events — decoration within seconds of an incident arriving.
 *
 * This copy still runs here on a schedule, and must keep running until the
 * production workflow is confirmed decorating real incidents; deleting it first
 * leaves nothing setting Priority, Status or the epic link. Once that is
 * confirmed, DELETE the workflow here rather than leaving two jobs writing to
 * the same board. Changes should be made in both until then — the production
 * copy is the one that matters.
 */

const TARGET = process.env.TARGET_REPO ?? 'TelenorNorgeInternal/s06065-sfb-telenor-sfdc';
const OWNER = process.env.PROJECT_OWNER ?? 'TelenorNorgeInternal';
const PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER ?? 408);
/** Epics roll every quarter; resolved by name so nothing needs editing. */
const EPIC_PREFIX = process.env.EPIC_PREFIX ?? 'Incidents from Matrix';
const DRY = process.argv.includes('--dry-run');

/** Fixed for every Flow C issue. `Type` is a native org issue type, not a field. */
const ISSUE_TYPE = 'Bug';

/** Flags an issue whose caller has replied and not yet been answered. */
const CALLER_LABEL = 'updated-by-caller';

/**
 * Posted when an issue is closed without closure information.
 *
 * ServiceNow only watches the comments endpoint, so a close with no `[closure]`
 * comment produces NO signal on its side at all — the incident would silently
 * stay open. GitHub knows about the close for free, so the detection belongs
 * here. Carries PROMPT_MARKER so it is posted once rather than every cycle.
 */
/**
 * The prompt, tailored to the issue's priority.
 *
 * The first version printed one template carrying the annotation
 * "<-- P0/P1 only" against the technical-documentation block. On 2026-09-11 a
 * P1 was closed with that block left blank and the annotation left in: Matrix
 * refused the resolve, retried ten times and failed. The reader had been asked
 * to work out whether a section applied to them, and reasonably did not.
 *
 * So the template now shows only what THIS issue needs. We already know the
 * priority — making the person derive it was the defect.
 */
function promptBody(priority: string | undefined): string {
  const needsDoc = priority === 'P0' || priority === 'P1';
  const doc = needsDoc
    ? `
Technical documentation:
Actual start:
Actual end:
Cause:
Actions:
Caused by a change or release:
Problem required:
Case handler:`
    : '';
  const note = needsDoc
    ? `_This is a **${priority}** incident, so Matrix requires the technical documentation as well as the close notes. **Leaving those fields blank will make the resolve fail.**_`
    : `_Close notes are all that is needed for **${priority ?? 'this'}** incidents._`;

  return `${PROMPT_MARKER}
⚠️ **This issue was closed, but the Matrix incident has _not_ been resolved.**

Add a comment starting with \`[closure]\` and the incident will resolve automatically — no need to reopen this issue.

\`\`\`
[closure]
Close notes: <what was done, written for the person who reported it — they see this>${doc}
\`\`\`

${note}`;
}

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function graphql<T = unknown>(query: string, vars: Record<string, string | number> = {}): T {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  // -f sends strings, -F sends typed values. An Int variable passed with -f is
  // rejected outright; a numeric-looking string passed with -F is silently
  // coerced to a number. Dispatching on the JS type keeps both correct.
  for (const [k, v] of Object.entries(vars)) {
    args.push(typeof v === 'number' ? '-F' : '-f', `${k}=${v}`);
  }
  return JSON.parse(gh(args)) as T;
}

interface Field {
  id: string;
  name: string;
  options?: { id: string; name: string }[];
}

function loadProject(): { projectId: string; fields: Field[] } {
  const d = graphql<{
    data?: { organization?: { projectV2?: { id: string; fields: { nodes: (Field | null)[] } } } };
  }>(
    `query($owner: String!, $number: Int!) {
      organization(login: $owner) { projectV2(number: $number) {
        id
        fields(first: 60) {
          nodes {
            ... on ProjectV2Field { id name }
            ... on ProjectV2SingleSelectField { id name options { id name } }
          }
        }
      } }
    }`,
    { owner: OWNER, number: PROJECT_NUMBER },
  );
  const p = d?.data?.organization?.projectV2;
  if (!p) throw new Error(`Project ${PROJECT_NUMBER} not found on ${OWNER}`);
  return { projectId: p.id, fields: p.fields.nodes.filter((f): f is Field => f !== null) };
}

/**
 * Quarter key for an ISO timestamp — `26-Q3`.
 *
 * Derived from the ISSUE's own creation date, never from today. An incident
 * raised on 30 September belongs in Q3 even if nothing decorates it until
 * October; and since the decorator re-reads every issue (`--state all`) on each
 * run, keying on "now" would quietly refile the whole backlog into the new
 * quarter every January, April, July and October.
 */
function quarterKey(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCFullYear()).slice(-2)}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/**
 * Finds the Matrix epics by title, keyed by quarter (`26-Q3`).
 *
 * Quarterly rather than annual since 2026-09-14: SFB raised 109 incidents in
 * the previous year, so a single yearly epic would hit the 100-sub-issue cap
 * partway through — silently, since the parenting call swallows its failure so
 * a full epic can never strand a real incident.
 *
 * Resolved by NAME rather than four configured numbers, deliberately. Numbers
 * nobody updates each quarter keep parenting to the previous one — which works,
 * silently, misfiling months of incidents. A name lookup that finds nothing
 * warns loudly on the first day of the quarter, which is the failure worth
 * having.
 */
function findEpics(): Map<string, { number: number; id: string; title: string }> {
  // Search on the PREFIX ONLY, then filter locally. GitHub's search tokeniser
  // silently drops the apostrophe-year: `Incidents from Matrix '26 in:title`
  // returns nothing, while `Incidents from Matrix in:title` returns the epic.
  // Verified 2026-09-04. Filtering client-side sidesteps the tokeniser entirely
  // and cannot fail this way.
  const out = gh([
    'issue', 'list', '-R', TARGET, '--state', 'open', '--limit', '100',
    '--search', `${EPIC_PREFIX} in:title`, '--json', 'number,title,id',
  ]);
  const rows = JSON.parse(out) as { number: number; title: string; id: string }[];
  const escaped = EPIC_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Matched, not compared: the real titles carry a decorative prefix ("✨ ").
  const pattern = new RegExp(`${escaped}\\s+Q([1-4])\\s+'(\\d{2})`);
  const epics = new Map<string, { number: number; id: string; title: string }>();
  for (const r of rows) {
    const m = r.title.match(pattern);
    if (m) epics.set(`${m[2]}-Q${m[1]}`, { number: r.number, id: r.id, title: r.title });
  }
  return epics;
}

/**
 * The org's `Bug` issue-type id, used when the App cannot read the type list.
 *
 * Reading `organization.issueTypes` needs the **Organization → Issue Types**
 * permission, which the App does not have and which would mean another approval
 * round with the platform team for a single lookup. *Setting* the type only
 * needs Issues: write, which the App does have — so the id is supplied directly
 * and the read is skipped.
 *
 * Captured 2026-09-04 from the live org. Org issue types are stable, but a
 * hardcoded id can still rot, so the lookup is attempted first and this is only
 * the fallback — and which path was taken is logged either way.
 */
/**
 * The account Matrix-sourced issues must be authored by.
 *
 * Without this, ANY issue carrying a `matrix-fields` block and the `matrix`
 * label is treated as authoritative — so anyone who can edit an issue can hand
 * this job a Priority, a Status and an issue type, and have it apply them to an
 * ORG-owned project with an App token. That is a real step up from repository
 * write, which does not by itself grant write on Project 408.
 *
 * The genuine articles are all opened by the App, so the check costs nothing.
 * Raised by Copilot on PR #3193, 2026-09-16.
 */
const SYNC_AUTHOR = process.env.SYNC_AUTHOR ?? 'matrix-sfb-sync';
const BUG_TYPE_ID = process.env.BUG_TYPE_ID ?? 'IT_kwDOB6pan84BIpiw';

function issueTypeId(name: string): string | null {
  try {
    const d = graphql<{ data?: { organization?: { issueTypes: { nodes: { id: string; name: string }[] } } } }>(
      `query($owner: String!) { organization(login: $owner) {
        issueTypes(first: 30) { nodes { id name } } } }`,
      { owner: OWNER },
    );
    const found = d?.data?.organization?.issueTypes?.nodes?.find((t) => t.name === name)?.id;
    if (found) return found;
  } catch {
    // Expected: the App lacks Organization → Issue Types. Not worth an approval
    // round for a lookup whose answer is a constant.
  }
  console.log(`  · issue-type list unreadable — using the configured ${name} id`);
  return BUG_TYPE_ID;
}

/** {field name → value} for one incident. Only fields the board actually has. */
export function plannedFields(
  v: MatrixFieldValues,
  /** False when a Status difference should be treated as a human's board move. */
  applyStatus = true,
): Record<string, string> {
  const out: Record<string, string> = { 'External ref. / URL': v.number };
  if (v.priority) out.Priority = v.priority;
  if (v.status && applyStatus) out.Status = v.status;
  return out;
}

/**
 * True when the failure is the credential being rejected outright, rather than
 * anything about the work.
 *
 * Distinguished so a *known, pending* permission gap degrades to a warning
 * instead of a red run every ten minutes. A workflow that fails on a schedule
 * for a reason nobody can act on this week trains people to ignore it — and it
 * is the same workflow that must be believed when it reports something real.
 * Genuine faults still fail loudly; only this one case is downgraded.
 */
function isAuthRejection(err: unknown): boolean {
  const text = String((err as { stderr?: string; message?: string })?.stderr ?? (err as Error)?.message ?? err);
  return /forbids access|FORBIDDEN|Bad credentials|Resource not accessible/i.test(text);
}

function main(): void {
  let project: { projectId: string; fields: Field[] };
  try {
    project = loadProject();
  } catch (err) {
    if (isAuthRejection(err)) {
      console.log('::warning::SFB_PROD_TOKEN was rejected by GitHub — nothing decorated.');
      console.log('The org accepts neither classic PATs nor (apparently) fine-grained ones,');
      console.log('so this needs Projects: read & write on the matrix-sfb-sync App.');
      console.log('Pending that, run the script locally with credentials that work.');
      return;
    }
    throw err;
  }
  const { projectId, fields } = project;
  const epics = findEpics();
  const nowKey = process.env.EPIC_QUARTER ?? quarterKey(new Date().toISOString());
  console.log(`Epics found: ${[...epics.keys()].sort().join(', ') || '(none)'}`);
  if (!epics.has(nowKey)) {
    console.error(`::warning::No open epic for ${nowKey} (expected "${EPIC_PREFIX} Q<n> '<yy>") — new issues will be left unparented.`);
  }
  const bugTypeId = issueTypeId(ISSUE_TYPE);

  // `--state all`: closed issues still need the closure check, and their board
  // fields are still worth keeping correct.
  const issues = JSON.parse(
    gh(['issue', 'list', '-R', TARGET, '--label', 'matrix', '--state', 'all',
        '--limit', '200', '--json', 'number,id,body,title,state,stateReason,createdAt,closedAt,updatedAt,author']),
  ) as {
    number: number; id: string; body: string; title: string;
    state: string; stateReason?: string | null; createdAt: string;
    closedAt?: string | null; updatedAt?: string | null;
    author?: { login?: string } | null;
  }[];

  console.log(`${issues.length} matrix issue(s) in ${TARGET}`);
  const lastRun = lastSuccessfulRunAt();
  const boundary = lastRun ?? Date.now() - STATUS_WINDOW_MINUTES * 60_000;
  console.log(lastRun
    ? `Status changes considered since the last successful run (${new Date(boundary).toISOString()})`
    : `No run history — falling back to a ${STATUS_WINDOW_MINUTES}m window`);
  const dash: DashIssue[] = [];

  for (const issue of issues) {
    const cancelled = (issue.stateReason ?? '').toUpperCase() === 'NOT_PLANNED';
    const values = extractFields(issue.body ?? '');
    if (!values) {
      // A hand-written issue someone labelled `matrix` — not an error.
      console.log(`#${issue.number}: no matrix-fields metadata, skipping`);
      continue;
    }
    // Metadata is only believed from the sync account. See SYNC_AUTHOR.
    // gh reports App authors as `app/<slug>`; the REST API uses `<slug>[bot]`.
    // Normalise both — matching only one of them skips every real incident,
    // which is what the first run of this check did.
    const author = (issue.author?.login ?? '').replace(/^app\//, '').replace(/\[bot\]$/, '');
    if (author !== SYNC_AUTHOR) {
      console.log(`#${issue.number}: matrix-fields present but authored by ${author || 'unknown'}, not ${SYNC_AUTHOR} — ignoring`);
      continue;
    }
    console.log(`#${issue.number} (${values.number}):`);

    // Comment handling first, and it runs in dry-run too: a dry run that skips
    // the analysis reports nothing useful. Writes inside are guarded.
    const facts = handleComments(issue, DRY, values.priority);

    if (DRY) { console.log('  [dry run — board fields not evaluated]'); continue; }

    // Add to the board. Idempotent — returns the existing item if present.
    const item = graphql<{ data: { addProjectV2ItemById: { item: { id: string } } } }>(
      `mutation($p: ID!, $c: ID!) { addProjectV2ItemById(input: {projectId: $p, contentId: $c}) { item { id } } }`,
      { p: projectId, c: issue.id },
    ).data.addProjectV2ItemById.item.id;

    // Only let Matrix drive Status when MATRIX changed since the last run —
    // otherwise a handler's board move is silently undone.
    //
    // Keyed on the `Source last updated` row Matrix writes into the body, not on
    // the issue's own updatedAt: comments, labels and this job's own
    // `updated-by-caller` edit all bump updatedAt, any of which would then
    // re-apply Matrix's Status over a board move made afterwards. Raised by
    // Copilot on PR #3193, 2026-09-16.
    const changedAt = sourceUpdatedAt(issue.body ?? '')
      ?? (issue.updatedAt ? Date.parse(issue.updatedAt) : 0);
    const statusIsFresh = changedAt >= boundary;
    if (!statusIsFresh && values.status) {
      console.log(`  · Status left as set on the board (unchanged since the last run)`);
    }

    // A cancelled incident keeps whatever Status it last held, which leaves it
    // showing as active work on a board it has permanently left — and Ingrid's
    // "Open Incidents" view filters on `-status:Done`, so it never drops off.
    // The board has no Cancelled option, so Done is the only terminal state
    // available. Raised by Copilot on PR #3193, 2026-09-16.
    const planned = plannedFields(values, statusIsFresh);
    if (cancelled) planned.Status = 'Done';

    for (const [name, value] of Object.entries(planned)) {
      const field = fields.find((f) => f.name === name);
      if (!field) { console.error(`  ! no field "${name}" on the board — skipping`); continue; }
      if (field.options) {
        const opt = field.options.find((o) => o.name === value);
        if (!opt) {
          // Loud: the mapping and the board have drifted. A quiet skip would
          // leave a blank column that nobody traces back to here.
          console.error(`  ! "${value}" is not an option on ${name}. Board offers: ${field.options.map((o) => o.name).join(', ')}`);
          continue;
        }
        graphql(
          `mutation($p: ID!, $i: ID!, $f: ID!, $o: String!) { updateProjectV2ItemFieldValue(input: {projectId: $p, itemId: $i, fieldId: $f, value: {singleSelectOptionId: $o}}) { projectV2Item { id } } }`,
          { p: projectId, i: item, f: field.id, o: opt.id },
        );
      } else {
        graphql(
          `mutation($p: ID!, $i: ID!, $f: ID!, $t: String!) { updateProjectV2ItemFieldValue(input: {projectId: $p, itemId: $i, fieldId: $f, value: {text: $t}}) { projectV2Item { id } } }`,
          { p: projectId, i: item, f: field.id, t: value },
        );
      }
      console.log(`  ✓ ${name} = ${value}`);
    }

    if (bugTypeId) {
      graphql(`mutation($i: ID!, $t: ID!) { updateIssue(input: {id: $i, issueTypeId: $t}) { issue { number } } }`,
        { i: issue.id, t: bugTypeId });
      console.log(`  ✓ Type = ${ISSUE_TYPE}`);
    }

    // The issue's own quarter, not the current one — see quarterKey().
    const epic = epics.get(quarterKey(issue.createdAt)) ?? null;
    let parented = false;
    if (epic) {
      try {
        // Numeric id, not the node id — and -F, since the API rejects a string.
        const dbId = JSON.parse(gh(['api', `repos/${TARGET}/issues/${issue.number}`, '--jq', '.id']));
        execFileSync('gh',
          ['api', '-X', 'POST', `repos/${TARGET}/issues/${epic.number}/sub_issues`, '-F', `sub_issue_id=${dbId}`],
          // stderr swallowed deliberately: "already a sub-issue" is the NORMAL
          // outcome on every re-run, and an error line each cycle trains people
          // to ignore the log — which is where the real failures appear.
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        parented = true;
        console.log(`  ✓ parented to #${epic.number}`);
      } catch {
        // Already a sub-issue (the normal re-run case), or the epic is full at
        // 100. Either way the issue exists and is decorated — never fail the
        // run and strand a real incident.
        //
        // Which of the two it was decides whether the dashboard should be
        // flagging this issue, so ask rather than assume: `parented` used to be
        // hardcoded true, so "Not fully set up" could never report anything and
        // quietly claimed everything was linked. Raised by Copilot on PR #3193.
        parented = hasParent(issue.number);
        console.log(parented
          ? '  · parent link unchanged (already a sub-issue)'
          : `  ! NOT parented — epic #${epic.number} may be full`);
      }
    }

    dash.push({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: facts.labels,
      updatedAt: issue.updatedAt,
      status: values.status ?? null,
      priority: values.priority ?? null,
      onBoard: true,
      parented,
      hasClosure: facts.hasClosure,
      cancelled,
    });
  }

  publishDashboard(dash, epics.get(nowKey)?.number ?? null, DRY, epics.has(nowKey) ? null : nowKey);
}

interface Comment { id: number; body: string; created_at: string }

/**
 * Only prompt about issues closed within this window.
 *
 * Without it, the first run reaches back through history and comments on every
 * matrix issue ever closed — including ones closed before closure information
 * was a concept, and ones already resolved by hand. A tool whose debut is a
 * burst of reproachful comments on finished work does not get trusted again.
 *
 * 24h against a 10-minute poll leaves an enormous margin for outages, so
 * nothing live is missed.
 */
const PROMPT_WINDOW_HOURS = Number(process.env.PROMPT_WINDOW_HOURS ?? 24);

/**
 * How recently the ISSUE must have changed for a Status difference to be
 * treated as coming from Matrix.
 *
 * Without this the decorator re-applies the Matrix status on every cycle, so a
 * handler dragging a card from Development to User Acceptance Test sees it snap
 * back within ten minutes, with nothing explaining why. That is the opposite of
 * the agreed model, where GitHub owns where the work has got to.
 *
 * The discriminator is that **Project field edits do not touch the issue's
 * `updatedAt`, while body updates from Matrix do.** So:
 *   - issue changed recently + Status differs  → Matrix moved it, apply
 *   - issue quiet + Status differs             → a human moved the card, leave it
 *
 * Wider than the 10-minute poll so a slow cycle does not drop a real change.
 */
const STATUS_WINDOW_MINUTES = Number(process.env.STATUS_WINDOW_MINUTES ?? 20);

/**
 * When the previous successful run happened — the real boundary for "did Matrix
 * change this, or did a person move the card?".
 *
 * A FIXED window is wrong because the schedule is not honoured. GitHub
 * deprioritises `schedule` triggers on quiet repositories: a ten-minute cron was
 * observed firing roughly every TWO HOURS (2026-09-14). With a 20-minute window, almost
 * every genuine Matrix status change would land outside it and never be
 * applied — the bug would present as "status sometimes doesn't update", which
 * is close to undiagnosable from the outside.
 *
 * Reading the actual last run makes the window self-correcting: whatever the
 * real cadence turns out to be, the boundary matches it. Falls back to the
 * fixed window when there is no run history (a local invocation, or the first
 * ever run).
 */
/** True when the issue already has a parent — asked, not assumed. */
function hasParent(number: number): boolean {
  try {
    // `parent_issue_url` is the field that actually carries it — there is no
    // `parent` or `sub_issue_parent` on the REST issue object, and asking for
    // one returns null for everything, which reads as "nothing is parented".
    return JSON.parse(gh(['api', `repos/${TARGET}/issues/${number}`, '--jq', '(.parent_issue_url != null)'])) === true;
  } catch {
    return false;
  }
}

function lastSuccessfulRunAt(): number | null {
  try {
    const rows = JSON.parse(
      gh(['run', 'list', '--workflow', 'decorate-matrix-issues.yml', '--status', 'success',
          '--limit', '2', '--json', 'createdAt']),
    ) as { createdAt: string }[];
    // [0] is usually the run currently executing; take the one before it.
    const prev = rows[1] ?? rows[0];
    return prev ? Date.parse(prev.createdAt) : null;
  } catch {
    return null;
  }
}

/** Title of the self-updating status issue. Found by title, so nothing to configure. */
const DASHBOARD_TITLE = 'Matrix ↔ GitHub sync — live status';

/**
 * The three comment-driven behaviours, all of which exist because ServiceNow
 * watches only the comments endpoint and therefore cannot see any of this.
 *
 *  1. closed + no `[closure]`  → post the prompt (once)
 *  2. open + has `[closure]`   → close the issue; writing closure information is
 *                                an unambiguous statement of intent, so the
 *                                developer need not also remember to close
 *  3. caller replied last      → label; cleared when a human replies in GitHub
 */
function handleComments(
  issue: { number: number; state: string; stateReason?: string | null; closedAt?: string | null },
  dry: boolean,
  priority?: string,
): { labels: string[]; hasClosure: boolean } {
  // `--slurp`, and the shaping done here rather than in `--jq`. With
  // `--paginate` alone, gh emits ONE JSON array PER PAGE and `--jq` runs against
  // each separately, so the moment an issue passes 100 comments JSON.parse gets
  // `[...][...]` and throws — aborting the whole run on exactly the long-lived
  // incidents that matter most. `--slurp` returns a single array of pages, which
  // flattens cleanly. Raised by Copilot on PR #3193, 2026-09-16.
  const comments = (JSON.parse(
    gh(['api', '--paginate', '--slurp', `repos/${TARGET}/issues/${issue.number}/comments`]),
  ) as Comment[][]).flat().map(({ id, body, created_at }) => ({ id, body, created_at }));

  const hasClosure = comments.some((c) => isClosureComment(c.body));
  const hasPrompt = comments.some((c) => c.body.includes(PROMPT_MARKER));
  const closed = issue.state.toUpperCase() === 'CLOSED';
  // "Close as not planned" is the contract's signal for CANCELLED, not resolved
  // (field-mapping doc, end-of-life table). A cancelled incident is never asked
  // for close notes, so prompting for them sends someone off to write
  // documentation that cannot be accepted — which is exactly what happened to
  // INC0072921 (#3152) on 2026-09-10: prompted, answered carefully, and the
  // resolve failed ten times because ServiceNow was cancelling the incident.
  const cancelled = closed && (issue.stateReason ?? '').toUpperCase() === 'NOT_PLANNED';

  if (cancelled && !hasClosure && !hasPrompt) {
    console.log('  · closed as not planned — incident will be CANCELLED, no closure info needed');
  } else if (closed && !hasClosure && !hasPrompt) {
    const closedAt = issue.closedAt ? Date.parse(issue.closedAt) : 0;
    const cutoff = Date.now() - PROMPT_WINDOW_HOURS * 3600_000;
    if (closedAt >= cutoff) {
      console.log('  → closed without closure info: posting prompt');
      if (!dry) gh(['issue', 'comment', String(issue.number), '-R', TARGET, '--body', promptBody(priority)]);
    } else {
      console.log(`  · closed without closure info, but >${PROMPT_WINDOW_HOURS}h ago — not prompting`);
    }
  }

  if (!closed && hasClosure) {
    console.log('  → closure info present on an open issue: closing');
    if (!dry) gh(['issue', 'close', String(issue.number), '-R', TARGET, '--reason', 'completed']);
  }

  // Compare the LAST caller comment against the LAST human reply. Counting is
  // not enough: a caller who replies twice after being answered still needs the
  // flag, and a reply after two caller comments clears it.
  const lastCaller = [...comments].reverse().find((c) => isCallerComment(c.body));
  const lastReply = [...comments].reverse().find((c) => isHumanReply(c.body));
  const waiting = !!lastCaller && (!lastReply || lastCaller.created_at > lastReply.created_at);

  const labels = JSON.parse(
    gh(['issue', 'view', String(issue.number), '-R', TARGET, '--json', 'labels',
        '--jq', '[.labels[].name]']),
  ) as string[];
  const labelled = labels.includes(CALLER_LABEL);

  if (waiting && !labelled) {
    console.log(`  → caller is waiting: adding ${CALLER_LABEL}`);
    if (!dry) gh(['issue', 'edit', String(issue.number), '-R', TARGET, '--add-label', CALLER_LABEL]);
  } else if (!waiting && labelled) {
    console.log(`  → answered: removing ${CALLER_LABEL}`);
    if (!dry) gh(['issue', 'edit', String(issue.number), '-R', TARGET, '--remove-label', CALLER_LABEL]);
  }

  // Report the state the dashboard should show, not the state on disk: the
  // label edits above have just changed it, and a dashboard a cycle behind
  // reads as a bug.
  const effective = waiting
    ? [...new Set([...labels, CALLER_LABEL])]
    : labels.filter((l) => l !== CALLER_LABEL);
  return { labels: effective, hasClosure };
}

/**
 * Writes the operational view into a self-updating issue in the private repo.
 *
 * Found by title rather than a configured number, so there is nothing to set up
 * and nothing to go stale. Created on first run.
 */
function publishDashboard(
  dash: DashIssue[],
  epicNumber: number | null,
  dry: boolean,
  epicMissingFor: string | null = null,
): void {
  const generatedAt = gh(['api', '/', '--jq', '"now"', '-i'])
    .split('\n')
    .find((l) => l.toLowerCase().startsWith('date:'))
    ?.slice(5)
    .trim() ?? 'unknown';

  let epic = null;
  if (epicNumber) {
    // `--slurp` for the same reason as the comments fetch above: `--paginate`
    // with `--jq` yields one array per page, and an epic at the 100 cap is
    // precisely when this runs over a page boundary.
    const subs = (JSON.parse(
      gh(['api', '--paginate', '--slurp', `repos/${TARGET}/issues/${epicNumber}/sub_issues`]),
    ) as { number: number }[][]).flat().map((r) => r.number);
    const title = JSON.parse(gh(['issue', 'view', String(epicNumber), '-R', TARGET, '--json', 'title'])).title;
    epic = { number: epicNumber, title, used: subs.length, limit: 100 };
  }

  const body = renderDashboard({ issues: dash, epic, epicMissingFor, generatedAt, lastRun: null });

  const found = JSON.parse(
    gh(['issue', 'list', '-R', TARGET, '--state', 'open', '--limit', '50',
        '--search', `"${DASHBOARD_TITLE}" in:title`, '--json', 'number,title']),
  ) as { number: number; title: string }[];
  const existing = found.find((f) => f.title === DASHBOARD_TITLE);

  if (dry) {
    console.log(`\n[dry run] dashboard would ${existing ? `update #${existing.number}` : 'be created'} (${body.length} chars)`);
    return;
  }
  if (existing) {
    gh(['issue', 'edit', String(existing.number), '-R', TARGET, '--body', body]);
    console.log(`\ndashboard updated: #${existing.number}`);
  } else {
    const url = gh(['issue', 'create', '-R', TARGET, '--title', DASHBOARD_TITLE, '--body', body]).trim();
    console.log(`\ndashboard created: ${url}`);
  }
}

// Entry point. Compared as a resolved URL rather than by filename: a filename
// test silently stops running `main()` the moment the file is renamed, and the
// job then exits 0 having done nothing — green in Actions, incidents piling up
// undecorated. That is not hypothetical; it happened porting this file into the
// SFB repository on 2026-09-15, and was caught only by running it.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
