import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { extractFields, type MatrixFieldValues } from '../src/matrix-mapping.js';

/**
 * US-075: sets the GitHub Project fields on a Matrix-sourced issue.
 *
 * WHY THIS EXISTS. `POST /repos/{owner}/{repo}/issues` accepts only title, body,
 * labels and assignees. Everything the SFB board actually runs on — Status,
 * Priority, Type, Sub Epic, Caller, External Reference — lives in GitHub
 * Projects and needs the Projects v2 GraphQL API. ServiceNow cannot set them
 * through the REST call it makes, and making it speak GraphQL would push
 * GitHub-side concerns onto a team that does not own them.
 *
 * So ServiceNow embeds the values in the issue body (see buildFieldsMetadata)
 * and this script applies them from inside GitHub Actions, where the Projects
 * API is reachable with no network path, no firewall opening, and no credential
 * crossing an organisational boundary.
 *
 * Field IDs are resolved BY NAME at runtime — hardcoded node IDs rot silently
 * the moment someone recreates a field, and the failure looks like "the sync
 * stopped setting Status" rather than an error.
 *
 *   npx tsx scripts/apply-matrix-fields.ts <issue-number>
 *
 * Env: GH_TOKEN (needs `project` scope — the default Actions GITHUB_TOKEN
 *      cannot write user-owned Projects), PROJECT_OWNER, PROJECT_NUMBER, REPO.
 */

const OWNER = process.env.PROJECT_OWNER ?? 'carloshumbertoreyesortiz';
const PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER ?? 1);
const REPO = process.env.REPO ?? 'carloshumbertoreyesortiz/agentic-sdlc-pilot';

/** Fixed for every issue arriving through Flow C (way-of-work §6). */
const FIXED_FIELDS: Record<string, string> = {
  Type: 'Incident',
  'Sub Epic': 'Matrix Defect',
  'External Reference Type': 'Matrix',
};

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function graphql<T = unknown>(query: string, vars: Record<string, string>): T {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [k, v] of Object.entries(vars)) args.push('-f', `${k}=${v}`);
  return JSON.parse(gh(args)) as T;
}

interface ProjectField {
  id: string;
  name: string;
  /** Present only on single-select fields. */
  options?: { id: string; name: string }[];
}

/** Reads the project's id and every field, so nothing below is hardcoded. */
function loadProject(): { projectId: string; fields: ProjectField[] } {
  const data = graphql<{
    data?: { user?: { projectV2?: { id: string; fields: { nodes: (ProjectField | null)[] } } } };
  }>(
    `query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 50) {
            nodes {
              ... on ProjectV2Field { id name }
              ... on ProjectV2SingleSelectField { id name options { id name } }
            }
          }
        }
      }
    }`,
    { owner: OWNER, number: String(PROJECT_NUMBER) },
  );
  const project = data?.data?.user?.projectV2;
  if (!project) throw new Error(`Project ${PROJECT_NUMBER} not found for ${OWNER}`);
  const fields = project.fields.nodes.filter((f): f is ProjectField => f !== null);
  return { projectId: project.id, fields };
}

/** Adds the issue to the project (idempotent) and returns the item id. */
function addToProject(projectId: string, issueNodeId: string): string {
  const data = graphql<{ data: { addProjectV2ItemById: { item: { id: string } } } }>(
    `mutation($project: ID!, $content: ID!) {
      addProjectV2ItemById(input: {projectId: $project, contentId: $content}) {
        item { id }
      }
    }`,
    { project: projectId, content: issueNodeId },
  );
  return data.data.addProjectV2ItemById.item.id;
}

function setSingleSelect(
  projectId: string,
  itemId: string,
  field: ProjectField,
  optionName: string,
): void {
  const option = field.options?.find((o) => o.name === optionName);
  if (!option) {
    // Loud, not silent: an unmapped value means the mapping contract and the
    // board have drifted, and a quiet skip would hide that until someone
    // noticed a blank column weeks later.
    console.error(
      `  ! "${optionName}" is not an option on ${field.name} — skipping. ` +
        `Board offers: ${field.options?.map((o) => o.name).join(', ')}`,
    );
    return;
  }
  graphql(
    `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field,
        value: {singleSelectOptionId: $option}
      }) { projectV2Item { id } }
    }`,
    { project: projectId, item: itemId, field: field.id, option: option.id },
  );
  console.log(`  ✓ ${field.name} = ${optionName}`);
}

function setText(projectId: string, itemId: string, field: ProjectField, text: string): void {
  graphql(
    `mutation($project: ID!, $item: ID!, $field: ID!, $text: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field, value: {text: $text}
      }) { projectV2Item { id } }
    }`,
    { project: projectId, item: itemId, field: field.id, text },
  );
  console.log(`  ✓ ${field.name} = ${text}`);
}

/** Maps the metadata onto {field name → value}. Exported for testing. */
export function plannedFields(values: MatrixFieldValues): Record<string, string> {
  const planned: Record<string, string> = { ...FIXED_FIELDS };
  if (values.priority) planned.Priority = values.priority;
  if (values.status) planned.Status = values.status;
  if (values.caller) planned.Caller = values.caller;
  planned['External Reference Id'] = values.number;
  planned['External Reference URL'] = values.url;
  return planned;
}

function main(): void {
  const issueNumber = process.argv[2];
  if (!issueNumber) {
    console.error('usage: apply-matrix-fields.ts <issue-number>');
    process.exit(1);
  }

  const issue = JSON.parse(gh(['issue', 'view', issueNumber, '-R', REPO, '--json', 'id,body']));
  const values = extractFields(issue.body ?? '');
  if (!values) {
    // Not an error: somebody may have labelled a hand-written issue `matrix`.
    console.log(`Issue #${issueNumber} carries no matrix-fields metadata — nothing to apply.`);
    return;
  }

  console.log(`Applying Project fields to #${issueNumber} (${values.number}):`);
  const { projectId, fields } = loadProject();
  const itemId = addToProject(projectId, issue.id);

  for (const [name, value] of Object.entries(plannedFields(values))) {
    const field = fields.find((f) => f.name === name);
    if (!field) {
      console.error(`  ! No field named "${name}" on the project — skipping.`);
      continue;
    }
    if (field.options) setSingleSelect(projectId, itemId, field, value);
    else setText(projectId, itemId, field, value);
  }
}

// Only run when invoked directly, so the module stays importable by tests.
if (process.argv[1]?.endsWith('apply-matrix-fields.ts')) main();
