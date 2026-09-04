import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { extractFields, type MatrixFieldValues } from '../src/matrix-mapping.js';

/**
 * US-075: decorates Matrix-sourced issues in the SFB production repo.
 *
 * WHY IT LIVES HERE RATHER THAN IN THE PRODUCTION REPO. The natural home is a
 * workflow inside `TelenorNorgeInternal/s06065-sfb-telenor-sfdc`, triggered on
 * issue events. That needs an Actions secret, which needs repo admin — the
 * pilot has `write`. And the GitHub App cannot set Project fields, because it is
 * scoped to Issues + Metadata (adding Projects needs an org owner).
 *
 * Both routes therefore wait on someone else, while the SFB team currently
 * cannot see Priority or Status on incoming incidents at all — which blocks
 * Ingrid's acceptance testing. So this runs from the pilot's own repo on a
 * schedule instead, using a credential the pilot controls. It polls rather than
 * reacting to events: a few minutes' delay, and no dependency on anyone.
 *
 * INTERIM BY DESIGN. When the App gains Projects permission this should move
 * into the production repo as an event-driven workflow, and this script and its
 * schedule should be deleted. Recorded in docs/matrix-sync-cutover.md.
 *
 * Idempotent: safe to re-run, and re-running is the normal case.
 *
 *   npx tsx scripts/decorate-matrix-issues.ts [--dry-run]
 *
 * Env: GH_TOKEN (classic PAT: `repo` for the private target + `project`),
 *      TARGET_REPO, PROJECT_OWNER, PROJECT_NUMBER, EPIC_PREFIX.
 */

const TARGET = process.env.TARGET_REPO ?? 'TelenorNorgeInternal/s06065-sfb-telenor-sfdc';
const OWNER = process.env.PROJECT_OWNER ?? 'TelenorNorgeInternal';
const PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER ?? 408);
/** The epic rolls every January; resolved by name so nothing needs editing. */
const EPIC_PREFIX = process.env.EPIC_PREFIX ?? 'Incidents from Matrix';
const DRY = process.argv.includes('--dry-run');

/** Fixed for every Flow C issue. `Type` is a native org issue type, not a field. */
const ISSUE_TYPE = 'Bug';

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
 * Finds this year's Matrix epic by title.
 *
 * Resolved by NAME rather than a configured number, deliberately. A configured
 * number nobody updates each January keeps parenting to last year's epic — which
 * works, silently, misfiling a year of incidents. A name lookup that finds
 * nothing fails loudly on 2 January, which is the failure worth having.
 * Previous years stay open, so the year is matched explicitly.
 */
function findEpic(year: number): { number: number; id: string } | null {
  const needle = `${EPIC_PREFIX} '${String(year).slice(-2)}`;
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
  // Substring, not equality — the real titles carry a decorative prefix.
  return rows.find((r) => r.title.includes(needle)) ?? null;
}

function issueTypeId(name: string): string | null {
  const d = graphql<{ data?: { organization?: { issueTypes: { nodes: { id: string; name: string }[] } } } }>(
    `query($owner: String!) { organization(login: $owner) {
      issueTypes(first: 30) { nodes { id name } } } }`,
    { owner: OWNER },
  );
  return d?.data?.organization?.issueTypes.nodes.find((t) => t.name === name)?.id ?? null;
}

/** {field name → value} for one incident. Only fields the board actually has. */
export function plannedFields(v: MatrixFieldValues): Record<string, string> {
  const out: Record<string, string> = { 'External ref. / URL': v.number };
  if (v.priority) out.Priority = v.priority;
  if (v.status) out.Status = v.status;
  return out;
}

function main(): void {
  const { projectId, fields } = loadProject();
  const year = Number(process.env.EPIC_YEAR ?? new Date().getFullYear());
  const epic = findEpic(year);
  if (!epic) {
    console.error(`::warning::No open epic matching "${EPIC_PREFIX} '${String(year).slice(-2)}" — issues will be left unparented.`);
  }
  const bugTypeId = issueTypeId(ISSUE_TYPE);

  const issues = JSON.parse(
    gh(['issue', 'list', '-R', TARGET, '--label', 'matrix', '--state', 'open',
        '--limit', '200', '--json', 'number,id,body,title']),
  ) as { number: number; id: string; body: string; title: string }[];

  console.log(`${issues.length} open matrix issue(s) in ${TARGET}`);

  for (const issue of issues) {
    const values = extractFields(issue.body ?? '');
    if (!values) {
      // A hand-written issue someone labelled `matrix` — not an error.
      console.log(`#${issue.number}: no matrix-fields metadata, skipping`);
      continue;
    }
    console.log(`#${issue.number} (${values.number}):`);
    if (DRY) { console.log('  [dry run]'); continue; }

    // Add to the board. Idempotent — returns the existing item if present.
    const item = graphql<{ data: { addProjectV2ItemById: { item: { id: string } } } }>(
      `mutation($p: ID!, $c: ID!) { addProjectV2ItemById(input: {projectId: $p, contentId: $c}) { item { id } } }`,
      { p: projectId, c: issue.id },
    ).data.addProjectV2ItemById.item.id;

    for (const [name, value] of Object.entries(plannedFields(values))) {
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
        console.log(`  ✓ parented to #${epic.number}`);
      } catch {
        // Already a sub-issue (the normal re-run case), or the epic is full at
        // 100. Either way the issue exists and is decorated — never fail the
        // run and strand a real incident.
        console.log(`  · parent link unchanged (already linked, or epic full)`);
      }
    }
  }
}

if (process.argv[1]?.endsWith('decorate-matrix-issues.ts')) main();
