import { describe, expect, it } from 'vitest';
import {
  buildIssuePayload,
  buildTitle,
  buildWorkNoteComment,
  duplicateSearchQuery,
  extractFields,
  extractSysId,
  mapPriority,
  mapStatus,
  type MatrixIncident,
} from './matrix-mapping.js';
import { plannedFields } from '../scripts/apply-matrix-fields.js';

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

describe('plannedFields', () => {
  it('always sets the three fixed Flow C values', () => {
    const planned = plannedFields({ sys_id: 'x', number: 'INC1', url: 'https://m/x' });
    expect(planned).toMatchObject({
      Type: 'Incident',
      'Sub Epic': 'Matrix Defect',
      'External Reference Type': 'Matrix',
    });
  });

  it('carries the External Reference across so the issue links back', () => {
    const planned = plannedFields({ sys_id: 'x', number: 'INC0012345', url: 'https://m/x' });
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
    const planned = plannedFields({
      sys_id: 'x', number: 'INC1', url: 'https://m/x',
      priority: 'P1', status: 'Backlog', caller: 'Nina Jakobsen',
    });
    for (const name of Object.keys(planned)) expect(boardFields).toContain(name);
  });

  it('skips Status entirely for a cancelled incident (null, not a value)', () => {
    const planned = plannedFields({ sys_id: 'x', number: 'INC1', url: 'u', status: null });
    expect(planned.Status).toBeUndefined();
  });
});

describe('buildWorkNoteComment', () => {
  it('tags the origin so an internal note is never mistaken for a caller comment', () => {
    const c = buildWorkNoteComment('Erik Lauvli', '2026-08-18T11:02:00Z', 'Reproduced on test.');
    expect(c.startsWith('**[Matrix work note]**')).toBe(true);
    expect(c).toContain('Reproduced on test.');
  });
});
