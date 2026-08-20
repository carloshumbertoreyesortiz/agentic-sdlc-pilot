// US-075: Matrix (ServiceNow) incident → GitHub issue mapping.
//
// REFERENCE DOCUMENTATION, NOT A RUNTIME COMPONENT. ServiceNow calls GitHub's
// REST API directly — there is no pilot-hosted receiver in the request path
// (see docs/technical-next-steps-matrix-sync.md Step 4). So the mapping is a
// CONTRACT THE SERVICENOW JOB IMPLEMENTS, and this module is its executable
// form: it makes the contract in docs/matrix-github-field-mapping.md
// unambiguous, and gives Step 5's dry-run something to diff actual output
// against.
//
// Every mapping decision here is a DRAFT pending confirmation at the Step 3
// session (Martin / Isak / Ingrid). The tables below carry the same warnings as
// the doc — where a mapping loses information, that is called out rather than
// hidden behind a lookup.

/** The incident fields the mapping reads. Names match ServiceNow's. */
export interface MatrixIncident {
  /** Globally unique. The match key — immune to INC collisions across instances. */
  sys_id: string;
  /** `INC…` — human-readable label only, never the match key. */
  number: string;
  short_description: string;
  description?: string | null;
  /** ServiceNow numeric priority (1 Critical … 5 Planning). */
  priority?: number | null;
  /** ServiceNow state label, e.g. "In Progress". */
  state?: string | null;
  caller_id?: string | null;
  assigned_to?: string | null;
  opened_at?: string | null;
  sys_updated_on?: string | null;
}

/** The JSON body for POST /repos/{owner}/{repo}/issues. */
export interface GitHubIssuePayload {
  title: string;
  body: string;
  labels: string[];
}

/** Marker carrying the match key. An HTML comment: searchable, not rendered. */
const SYS_ID_MARKER = 'Matrix-Sys-Id:';

/**
 * Second marker, carrying the values that CANNOT be set through the issues API.
 *
 * `POST /issues` accepts only title, body, labels and assignees. Everything the
 * board actually runs on — Status, Priority, Type, Sub Epic, Caller, External
 * Reference — lives in GitHub Projects and needs the Projects v2 GraphQL API.
 * ServiceNow therefore cannot set them, and asking it to would mean building
 * GraphQL on the ServiceNow side for fields it does not own.
 *
 * So the values ride along in the body as JSON, and
 * .github/workflows/matrix-issue-fields.yml applies them GitHub-side, where the
 * Projects API is reachable without any network path or firewall involvement.
 */
const FIELDS_MARKER = 'matrix-fields:';

/** The values the GitHub-side workflow reads back out to set Project fields. */
export interface MatrixFieldValues {
  sys_id: string;
  number: string;
  priority?: string;
  status?: string | null;
  caller?: string;
  url: string;
}

/** GitHub titles stay readable; the full text is always in the body regardless. */
const MAX_TITLE = 200;

/**
 * ServiceNow priority → the pilot Priority field.
 *
 * The board's actual options are P0, P1, P2, P3 — verified against the live
 * Project 2026-08-18. (An earlier draft of the mapping doc assumed P1–P4 and
 * emitted a P4 that does not exist; corrected here.)
 *
 * Because P0 exists, the top of the scale maps 1:1 and no information is lost
 * where it matters. The collapse lands at the bottom instead — 4 Low and
 * 5 Planning both become P3 — which is far less consequential than merging
 * Critical with High would have been.
 */
const PRIORITY: Record<number, string> = {
  1: 'P0',
  2: 'P1',
  3: 'P2',
  4: 'P3',
  5: 'P3',
};

/**
 * ServiceNow state → the 10-state SFB Status taxonomy (way-of-work §5).
 *
 * `Resolved → Deployed` is the weakest row: in ServiceNow "resolved" means the
 * handler believes it fixed; in the SFB taxonomy "Deployed" means it reached
 * production. Not the same claim. Flagged for Isak rather than assumed.
 * `Cancelled` maps to no Status — the issue is closed as not planned.
 */
const STATUS: Record<string, string | null> = {
  New: 'Backlog',
  'In Progress': 'Development',
  'On Hold': 'Pending Requestor',
  Pending: 'Pending Requestor',
  Resolved: 'Deployed',
  Closed: 'Done',
  Cancelled: null,
};

export function mapPriority(priority?: number | null): string | undefined {
  if (priority == null) return undefined;
  return PRIORITY[priority];
}

/** Returns `null` for Cancelled (close as not planned) and `undefined` if unknown. */
export function mapStatus(state?: string | null): string | null | undefined {
  if (state == null) return undefined;
  return state in STATUS ? STATUS[state] : undefined;
}

/** `INC0012345 — Short description`, trimmed to MAX_TITLE on a whole character. */
export function buildTitle(incident: MatrixIncident): string {
  const title = `${incident.number} — ${incident.short_description}`.trim();
  return title.length <= MAX_TITLE ? title : `${title.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

/**
 * The search query that MUST run before every create.
 *
 * Replaces the idempotency key originally proposed: GitHub's API has no
 * idempotency mechanism and there is no receiver to honour one. Create only
 * when this returns total_count === 0.
 *
 * Caveat carried from the doc: GitHub's search index lags writes by seconds, so
 * this is the second line of defence — checking whether correlation_id is
 * already populated on the incident is immediate, local, and comes first.
 */
export function duplicateSearchQuery(repo: string, sysId: string): string {
  return `repo:${repo} in:body "${SYS_ID_MARKER} ${sysId}" is:issue`;
}

/** Extracts the sys_id from an issue body, or null. Inverse of the marker. */
export function extractSysId(body: string): string | null {
  const match = body.match(/<!--\s*Matrix-Sys-Id:\s*([^\s>]+)\s*-->/);
  return match ? match[1] : null;
}

/** Builds the JSON metadata comment the GitHub-side workflow consumes. */
export function buildFieldsMetadata(
  incident: MatrixIncident,
  matrixBaseUrl = 'https://matrix.telenor.no',
): string {
  const values: MatrixFieldValues = {
    sys_id: incident.sys_id,
    number: incident.number,
    url: incidentUrl(incident.sys_id, matrixBaseUrl),
  };
  const priority = mapPriority(incident.priority);
  if (priority) values.priority = priority;
  const status = mapStatus(incident.state);
  if (status !== undefined) values.status = status;
  if (incident.caller_id) values.caller = incident.caller_id;

  return `<!-- ${FIELDS_MARKER} ${JSON.stringify(values)} -->`;
}

/**
 * Reads the metadata block back. Returns null when absent or unparseable —
 * a hand-written issue that happens to carry the `matrix` label must not throw
 * and stop the workflow.
 */
export function extractFields(body: string): MatrixFieldValues | null {
  // Bounded by the comment terminator, NOT by the first closing brace. A
  // non-greedy `\{.*?\}` truncates the moment a *value* contains `}` — a caller
  // named "Nina }" would yield invalid JSON and silently drop every field.
  // Nothing forbids `}` in a ServiceNow display value, so the terminator is the
  // only safe anchor.
  const match = body.match(/<!--\s*matrix-fields:\s*([\s\S]*?)\s*-->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as MatrixFieldValues;
    return parsed?.sys_id ? parsed : null;
  } catch {
    return null;
  }
}

/** Renders a Matrix work note as an issue comment, tagged with its origin. */
export function buildWorkNoteComment(author: string, at: string, text: string): string {
  return `**[Matrix work note]** — ${author}, ${at}\n\n${text}`;
}

const NBSP_ROW = (label: string, value: string) => `| ${label} | ${value} |`;

/** Builds the full POST body. Pure — no I/O, no clock, no network. */
export function incidentUrl(sysId: string, matrixBaseUrl = 'https://matrix.telenor.no'): string {
  return `${matrixBaseUrl}/nav_to.do?uri=incident.do?sys_id=${sysId}`;
}

export function buildIssuePayload(
  incident: MatrixIncident,
  matrixBaseUrl = 'https://matrix.telenor.no',
): GitHubIssuePayload {
  const link = incidentUrl(incident.sys_id, matrixBaseUrl);

  const rows = [
    NBSP_ROW('Matrix incident', `[${incident.number}](${link})`),
    incident.caller_id ? NBSP_ROW('Caller', incident.caller_id) : null,
    incident.assigned_to ? NBSP_ROW('Assigned (Matrix)', incident.assigned_to) : null,
    incident.opened_at ? NBSP_ROW('Raised', incident.opened_at) : null,
    incident.sys_updated_on ? NBSP_ROW('Source last updated', incident.sys_updated_on) : null,
  ].filter((r): r is string => r !== null);

  const body = [
    '## Background',
    '',
    incident.description?.trim() || '_No description supplied on the incident._',
    '',
    '## Source',
    '',
    '| | |',
    '|---|---|',
    ...rows,
    '',
    `<!-- ${SYS_ID_MARKER} ${incident.sys_id} -->`,
    buildFieldsMetadata(incident, matrixBaseUrl),
    '_Synced from Matrix by the SFB integration. Do not edit the Source table by hand._',
  ].join('\n');

  return {
    title: buildTitle(incident),
    body,
    // Type = Incident and Sub Epic = Matrix Defect are Project fields, set
    // after creation — they are not part of the issues POST body.
    labels: ['matrix', 'incident'],
  };
}
