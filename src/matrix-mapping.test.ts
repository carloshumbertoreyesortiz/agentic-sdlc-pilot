import { describe, expect, it } from 'vitest';
import {
  buildIssuePayload,
  sourceUpdatedAt,
  normaliseLogin,
  isBodyTrusted,
  buildTitle,
  buildWorkNoteComment,
  duplicateCommentQuery,
  duplicateSearchQuery,
  extractFields,
  extractJournalId,
  isCallerComment,
  isCallerAcceptance,
  callerIsWaiting,
  isClosureComment,
  isHumanReply,
  PROMPT_MARKER,
  extractSysId,
  mapPriority,
  mapStatus,
  type MatrixIncident,
} from './matrix-mapping.js';
import { plannedFields as legacyPlannedFields } from '../scripts/apply-matrix-fields.js';
import { plannedFields } from '../scripts/decorate-matrix-issues.js';

const incident: MatrixIncident = {
  sys_id: 'a1b2c3d4e5f6',
  number: 'INC0012345',
  short_description: 'Quote PDF fails to generate for CPQ orders',
  description: 'When a sales agent completes a CPQ order the quote PDF fails to render.',
  priority: 2,
  state: 'In Progress',
  caller_id: 'Nina Jakobsen',
  assigned_to: 'Erik Lauvli',
  opened_at: '2026-08-18T09:14:00Z',
  sys_updated_on: '2026-08-18T11:02:00Z',
};

/** The live Project's Priority options, verified 2026-08-18. */
const BOARD_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

describe('mapPriority', () => {
  it('maps the ServiceNow scale onto the pilot P-scale', () => {
    expect(mapPriority(1)).toBe('P0');
    expect(mapPriority(2)).toBe('P1');
    expect(mapPriority(3)).toBe('P2');
    expect(mapPriority(4)).toBe('P3');
  });

  it('only ever emits values the board actually offers', () => {
    for (const p of [1, 2, 3, 4, 5]) {
      expect(BOARD_PRIORITIES).toContain(mapPriority(p));
    }
  });

  it('collapses at the bottom of the scale, not the top', () => {
    expect(mapPriority(4)).toBe(mapPriority(5));
    expect(mapPriority(1)).not.toBe(mapPriority(2));
  });

  it('returns undefined rather than guessing when priority is absent or unknown', () => {
    expect(mapPriority(null)).toBeUndefined();
    expect(mapPriority(9)).toBeUndefined();
  });
});

describe('mapStatus', () => {
  it('maps into the 10-state SFB taxonomy', () => {
    expect(mapStatus('New')).toBe('Backlog');
    expect(mapStatus('In Progress')).toBe('Development');
    expect(mapStatus('Closed')).toBe('Done');
  });

  it('treats both hold-style states as Pending Requestor', () => {
    expect(mapStatus('On Hold')).toBe('Pending Requestor');
    expect(mapStatus('Pending')).toBe('Pending Requestor');
  });

  it('returns null for Cancelled — close as not planned, no Status value', () => {
    expect(mapStatus('Cancelled')).toBeNull();
  });

  it('distinguishes "no Status" (null) from "unknown state" (undefined)', () => {
    expect(mapStatus('Cancelled')).toBeNull();
    expect(mapStatus('Some New State')).toBeUndefined();
  });
});

describe('buildTitle', () => {
  it('prefixes the INC number', () => {
    expect(buildTitle(incident)).toBe(
      'INC0012345 — Quote PDF fails to generate for CPQ orders',
    );
  });

  it('truncates over-long titles, keeping them under the limit', () => {
    const title = buildTitle({ ...incident, short_description: 'x'.repeat(400) });
    expect(title.length).toBeLessThanOrEqual(200);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('buildIssuePayload', () => {
  it('embeds sys_id as an HTML comment — searchable but not rendered', () => {
    const { body } = buildIssuePayload(incident);
    expect(body).toContain('<!-- Matrix-Sys-Id: a1b2c3d4e5f6 -->');
  });

  it('round-trips the match key through extractSysId', () => {
    const { body } = buildIssuePayload(incident);
    expect(extractSysId(body)).toBe(incident.sys_id);
  });

  it('deep-links back to the incident', () => {
    const { body } = buildIssuePayload(incident);
    expect(body).toContain('https://matrix.telenor.no/nav_to.do?uri=incident.do?sys_id=a1b2c3d4e5f6');
  });

  it('carries the matrix label so the whole flow is filterable', () => {
    expect(buildIssuePayload(incident).labels).toContain('matrix');
  });

  it('omits Source rows for absent fields rather than printing blanks', () => {
    const { body } = buildIssuePayload({
      sys_id: 'deadbeef',
      number: 'INC0000001',
      short_description: 'Minimal incident',
    });
    expect(body).not.toContain('| Caller |');
    expect(body).not.toContain('| Raised |');
    expect(body).toContain('<!-- Matrix-Sys-Id: deadbeef -->');
  });

  it('says so explicitly when the incident carries no description', () => {
    const { body } = buildIssuePayload({ ...incident, description: '   ' });
    expect(body).toContain('_No description supplied on the incident._');
  });
});

describe('duplicateSearchQuery', () => {
  it('scopes the search to the repo and the sys_id marker', () => {
    const q = duplicateSearchQuery('TelenorNorgeInternal/s06065-sfb-telenor-sfdc', 'a1b2c3');
    expect(q).toContain('repo:TelenorNorgeInternal/s06065-sfb-telenor-sfdc');
    expect(q).toContain('Matrix-Sys-Id: a1b2c3');
    expect(q).toContain('is:issue');
  });

  it('finds the issue that buildIssuePayload produced — the guard actually guards', () => {
    const { body } = buildIssuePayload(incident);
    const q = duplicateSearchQuery('owner/repo', incident.sys_id);
    const marker = q.match(/"([^"]+)"/)?.[1];
    expect(marker).toBeDefined();
    expect(body).toContain(marker as string);
  });
});

describe('extractSysId', () => {
  it('returns null when no marker is present', () => {
    expect(extractSysId('An issue somebody wrote by hand')).toBeNull();
  });
});

describe('the Project-field metadata block', () => {
  it('round-trips the values the issues API cannot carry', () => {
    const { body } = buildIssuePayload(incident);
    const fields = extractFields(body);
    expect(fields).not.toBeNull();
    expect(fields).toMatchObject({
      sys_id: 'a1b2c3d4e5f6',
      number: 'INC0012345',
      priority: 'P1',
      status: 'Development',
      caller: 'Nina Jakobsen',
    });
  });

  it('returns null for a hand-written issue instead of throwing', () => {
    expect(extractFields('Someone opened this by hand and added the label')).toBeNull();
  });

  it('returns null on malformed JSON rather than crashing the workflow', () => {
    expect(extractFields('<!-- matrix-fields: {not json} -->')).toBeNull();
  });

  it('survives a closing brace inside a value', () => {
    // Nothing stops a ServiceNow display value containing "}". Anchoring the
    // parse on the first brace instead of the comment terminator would drop
    // every field here, silently.
    const { body } = buildIssuePayload({ ...incident, caller_id: 'Nina } Jakobsen' });
    expect(extractFields(body)?.caller).toBe('Nina } Jakobsen');
  });

  it('survives quotes inside a value', () => {
    const { body } = buildIssuePayload({ ...incident, caller_id: 'Nina "Nina" Jakobsen' });
    expect(extractFields(body)?.caller).toBe('Nina "Nina" Jakobsen');
  });

  it('treats an unassigned incident as absent, never as the string "None"', () => {
    const { body } = buildIssuePayload({ ...incident, caller_id: null, assigned_to: null });
    const fields = extractFields(body);
    expect(fields?.caller).toBeUndefined();
    expect(body).not.toContain('None');
    expect(body).not.toContain('| Assigned (Matrix) |');
  });

  it('omits absent values rather than emitting empty strings', () => {
    const { body } = buildIssuePayload({
      sys_id: 'deadbeef',
      number: 'INC0000001',
      short_description: 'Minimal',
    });
    const fields = extractFields(body);
    expect(fields?.priority).toBeUndefined();
    expect(fields?.caller).toBeUndefined();
  });
});

describe('plannedFields (sandbox script)', () => {
  it('always sets the three fixed Flow C values', () => {
    const planned = legacyPlannedFields({ sys_id: 'x', number: 'INC1', url: 'https://m/x' });
    expect(planned).toMatchObject({
      Type: 'Incident',
      'Sub Epic': 'Matrix Defect',
      'External Reference Type': 'Matrix',
    });
  });

  it('carries the External Reference across so the issue links back', () => {
    const planned = legacyPlannedFields({ sys_id: 'x', number: 'INC0012345', url: 'https://m/x' });
    expect(planned['External Reference Id']).toBe('INC0012345');
    expect(planned['External Reference URL']).toBe('https://m/x');
  });

  it('only names fields that exist on the live board', () => {
    // Verified against `gh project field-list 1` on 2026-08-18.
    const boardFields = [
      'Status', 'Priority', 'Size', 'Type', 'Sub Epic', 'Business Area',
      'Business Analyst', 'External Reference Type', 'SFB Case Number',
      'External Reference Id', 'External Reference URL', 'Caller', 'Alternate Contact',
    ];
    const planned = legacyPlannedFields({
      sys_id: 'x', number: 'INC1', url: 'https://m/x',
      priority: 'P1', status: 'Backlog', caller: 'Nina Jakobsen',
    });
    for (const name of Object.keys(planned)) expect(boardFields).toContain(name);
  });

  it('skips Status entirely for a cancelled incident (null, not a value)', () => {
    const planned = legacyPlannedFields({ sys_id: 'x', number: 'INC1', url: 'u', status: null });
    expect(planned.Status).toBeUndefined();
  });
});

describe('buildWorkNoteComment', () => {
  it('tags the origin so an internal note is never mistaken for a caller comment', () => {
    const c = buildWorkNoteComment('Erik Lauvli', '2026-08-18T11:02:00Z', 'Reproduced on test.');
    expect(c.startsWith('**[Matrix work note]**')).toBe(true);
    expect(c).toContain('Reproduced on test.');
  });

  it('distinguishes a caller-visible comment from an internal work note', () => {
    const c = buildWorkNoteComment('Nina', '2026-08-18T11:02:00Z', 'Still broken', undefined, 'comment');
    expect(c.startsWith('**[Matrix comment]**')).toBe(true);
  });

  it('carries the journal id so a retried post can be recognised', () => {
    const c = buildWorkNoteComment('Erik', '2026-08-18T11:02:00Z', 'text', 'journal123');
    expect(extractJournalId(c)).toBe('journal123');
  });

  it('omits the marker when no journal id is supplied', () => {
    const c = buildWorkNoteComment('Erik', '2026-08-18T11:02:00Z', 'text');
    expect(extractJournalId(c)).toBeNull();
  });

  it('the comment guard actually matches what the builder produced', () => {
    const c = buildWorkNoteComment('Erik', '2026-08-18T11:02:00Z', 'text', 'journal123');
    const q = duplicateCommentQuery('owner/repo', 'journal123');
    const marker = q.match(/"([^"]+)"/)?.[1];
    expect(c).toContain(marker as string);
  });
});

describe('comment classification (closure prompts + caller label)', () => {
  const fromMatrixCaller = '**[Matrix comment]** — Roy, 2026-09-08T09:00:00Z\n\nStill broken\n\n<!-- Matrix-Journal-Id: j1 -->';
  const fromMatrixNote = '**[Matrix work note]** — Erik, 2026-09-08T09:00:00Z\n\nLooking\n\n<!-- Matrix-Journal-Id: j2 -->';

  it('recognises a closure comment, case-insensitively and past leading space', () => {
    expect(isClosureComment('[closure]\nClose notes: done')).toBe(true);
    expect(isClosureComment('  [CLOSURE] Close notes: done')).toBe(true);
    expect(isClosureComment('Nearly [closure] but not at the start')).toBe(false);
  });

  it('treats only caller comments as caller comments, not work notes', () => {
    expect(isCallerComment(fromMatrixCaller)).toBe(true);
    expect(isCallerComment(fromMatrixNote)).toBe(false);
  });

  it('counts an ordinary GitHub comment as a human reply', () => {
    expect(isHumanReply('Looked into it, fix on the way')).toBe(true);
  });

  it('does NOT count an [internal] comment as answering the caller', () => {
    // It becomes a Matrix work note, which the caller cannot see — clearing the
    // flag on it would mark the caller answered while they are still waiting.
    expect(isHumanReply('[internal] not sure this is ours')).toBe(false);
  });

  it('does NOT count a Matrix-sourced comment as a human reply', () => {
    expect(isHumanReply(fromMatrixCaller)).toBe(false);
  });

  it('does NOT count our own prompt as a human reply', () => {
    expect(isHumanReply(`${PROMPT_MARKER}\nThis issue was closed but...`)).toBe(false);
  });
});

describe('plannedFields — Status ownership', () => {
  const v = { sys_id: 'x', number: 'INC1', url: 'u', priority: 'P1', status: 'Development' };

  it('applies Status when Matrix has just changed the issue', () => {
    expect(plannedFields(v, true).Status).toBe('Development');
  });

  it('leaves Status alone when the issue has been quiet', () => {
    // A handler moved the card. Project-field edits do not touch the issue's
    // updatedAt, so a quiet issue with a differing Status means a human did it —
    // and re-applying would undo their move within ten minutes.
    expect(plannedFields(v, false).Status).toBeUndefined();
  });

  it('still applies everything else regardless', () => {
    const out = plannedFields(v, false);
    expect(out.Priority).toBe('P1');
    expect(out['External ref. / URL']).toBe('INC1');
  });
});

describe('sourceUpdatedAt', () => {
  const body = [
    '| | |', '|---|---|',
    '| Raised | 2026-09-15T07:03:13Z |',
    '| Source last updated | 2026-09-15T09:26:12Z |',
  ].join('\n');

  it('reads the Matrix-side timestamp, not the Raised one', () => {
    expect(sourceUpdatedAt(body)).toBe(Date.parse('2026-09-15T09:26:12Z'));
  });

  it('takes the generated row, not one a caller planted in the description', () => {
    const planted = [
      'Description: | Source last updated | 2099-01-01T00:00:00Z |',
      '## Source', '| | |', '|---|---|',
      '| Source last updated | 2026-09-15T09:26:12Z |',
    ].join('\n');
    expect(sourceUpdatedAt(planted)).toBe(Date.parse('2026-09-15T09:26:12Z'));
  });

  it('returns null when the row is absent, so the caller can fall back', () => {
    expect(sourceUpdatedAt('no source table here')).toBeNull();
  });

  it("reads ServiceNow's zone-less format as UTC, not the runner's local time", () => {
    expect(sourceUpdatedAt('| Source last updated | 2026-09-15 09:26:12 |'))
      .toBe(Date.parse('2026-09-15T09:26:12Z'));
  });

  it('reads the human-friendly format proposed for the Source table', () => {
    expect(sourceUpdatedAt('| Source last updated | 4 Sep 2026, 09:03 UTC |'))
      .toBe(Date.parse('2026-09-04T09:03:00Z'));
  });

  it('returns null rather than NaN on an unparseable timestamp', () => {
    expect(sourceUpdatedAt('| Source last updated | not-a-date |')).toBeNull();
  });
});

describe('body trust', () => {
  it('treats the three spellings of the App as one account', () => {
    for (const l of ['app/matrix-sfb-sync', 'matrix-sfb-sync[bot]', 'matrix-sfb-sync']) {
      expect(normaliseLogin(l)).toBe('matrix-sfb-sync');
    }
  });

  it('trusts a body never edited since creation', () => {
    expect(isBodyTrusted(null, 'matrix-sfb-sync')).toBe(true);
  });

  it('trusts a body last edited by the sync account, however it is spelled', () => {
    expect(isBodyTrusted('matrix-sfb-sync', 'matrix-sfb-sync')).toBe(true);
    expect(isBodyTrusted('matrix-sfb-sync[bot]', 'matrix-sfb-sync')).toBe(true);
  });

  it('fails closed when the editor is unknown, rather than treating it as unedited', () => {
    expect(isBodyTrusted(undefined, 'matrix-sfb-sync')).toBe(false);
  });

  it('does not trust a body a person edited last', () => {
    // The author is still the App; the metadata is no longer its word.
    expect(isBodyTrusted('someone-with-write', 'matrix-sfb-sync')).toBe(false);
  });
});

describe('markers a caller could plant in the description', () => {
  const real = (fields: string, sysId: string) => [
    `<!-- Matrix-Sys-Id: ${sysId} -->`,
    `<!-- matrix-fields: ${fields} -->`,
    '_Synced from Matrix by the SFB integration._',
  ].join('\n');
  const genuine = '{"sys_id":"real","number":"INC1","url":"u","priority":"P3","status":"Backlog"}';

  it('ignores a planted matrix-fields block and reads the generated one', () => {
    const planted = '<!-- matrix-fields: {"sys_id":"fake","number":"INC9","url":"u","priority":"P0","status":"Done"} -->';
    const v = extractFields(`Description: ${planted}\n\n${real(genuine, 'real')}`);
    expect(v?.priority).toBe('P3');
    expect(v?.status).toBe('Backlog');
  });

  it('is not fooled by an unterminated planted block either', () => {
    const v = extractFields(`Description: <!-- matrix-fields: {"priority":"P0"\n\n${real(genuine, 'real')}`);
    expect(v?.priority).toBe('P3');
  });

  it('ignores a planted Matrix-Sys-Id and reads the generated one', () => {
    expect(extractSysId(`see <!-- Matrix-Sys-Id: someoneelse -->\n${real(genuine, 'real')}`)).toBe('real');
  });
});

describe('caller acceptance', () => {
  const matrixComment = (text: string) => [
    `**[Matrix comment]** — Ingrid Marie Urdshals, 2026-09-21T07:21:53Z`,
    '', text, '',
    '<!-- Matrix-Journal-Id: 650ebb8c24ab47109c462f882b9af166 -->',
  ].join('\n');

  it('recognises the acceptance Matrix generates', () => {
    expect(isCallerAcceptance(matrixComment('Caller has accepted the resolution'))).toBe(true);
  });

  it('does not treat a rejection as acceptance — that one needs a person', () => {
    expect(isCallerAcceptance(matrixComment('The caller rejected the resolution. Reject reason: '))).toBe(false);
  });

  it('ignores the phrase when it is not a caller comment from Matrix', () => {
    // A handler quoting it in GitHub is not the caller accepting anything.
    expect(isCallerAcceptance('caller has accepted the resolution')).toBe(false);
  });

  it('still counts anything the caller says after accepting', () => {
    expect(isCallerAcceptance(matrixComment('Actually it is happening again'))).toBe(false);
  });
});

describe('callerIsWaiting', () => {
  const journal = (n: string) => `<!-- Matrix-Journal-Id: ${n} -->`;
  const caller = (at: string, text: string) => ({
    created_at: at,
    body: `**[Matrix comment]** — Caller, ${at}\n\n${text}\n\n${journal(at)}`,
  });
  const accepted = (at: string) => caller(at, 'Caller has accepted the resolution');
  const reply = (at: string) => ({ created_at: at, body: 'Looking into it now.' });

  it('flags a caller comment nobody has answered', () => {
    expect(callerIsWaiting([caller('2026-09-01T10:00:00Z', 'Still broken')])).toBe(true);
  });

  it('clears once a human replies after it', () => {
    expect(callerIsWaiting([
      caller('2026-09-01T10:00:00Z', 'Still broken'),
      reply('2026-09-01T11:00:00Z'),
    ])).toBe(false);
  });

  it('clears when the caller asks and THEN accepts, with no reply between', () => {
    // The bug Copilot caught: skipping the acceptance left the older question as
    // the effective comment, so the issue stayed flagged after the caller had
    // signed off.
    expect(callerIsWaiting([
      caller('2026-09-01T10:00:00Z', 'Any update?'),
      accepted('2026-09-01T12:00:00Z'),
    ])).toBe(false);
  });

  it('flags again when the caller comes back after accepting', () => {
    expect(callerIsWaiting([
      accepted('2026-09-01T10:00:00Z'),
      caller('2026-09-02T09:00:00Z', 'It is happening again'),
    ])).toBe(true);
  });

  it('still flags a rejection — that reopens the incident', () => {
    expect(callerIsWaiting([
      caller('2026-09-01T10:00:00Z', 'The caller rejected the resolution. Reject reason: '),
    ])).toBe(true);
  });

  it('is not fooled by an [internal] note, which the caller cannot see', () => {
    expect(callerIsWaiting([
      caller('2026-09-01T10:00:00Z', 'Still broken'),
      { created_at: '2026-09-01T11:00:00Z', body: '[internal] chasing this with the vendor' },
    ])).toBe(true);
  });
});
