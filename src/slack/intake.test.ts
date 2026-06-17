import { describe, it, expect } from 'vitest';
import {
  stripMention,
  extractUrls,
  isAllowedMime,
  delinkify,
  normalizeIntake,
  intakeAttachmentsAsUntrusted,
  MAX_ATTACHMENT_BYTES,
  type IntakeEvent,
} from './intake.js';

describe('stripMention', () => {
  it('removes a leading bot mention', () => {
    expect(stripMention('<@U123> please plan the thing')).toBe('please plan the thing');
    expect(stripMention('<@U123|agent> hi')).toBe('hi');
  });
  it('leaves text without a leading mention untouched', () => {
    expect(stripMention('just text')).toBe('just text');
  });
});

describe('extractUrls', () => {
  it('handles Slack <url> and <url|label> wrapping and plain links, de-duped', () => {
    const text = 'see <https://a.com|A> and <https://b.com> and https://a.com';
    expect(extractUrls(text)).toEqual(['https://a.com', 'https://b.com']);
  });
  it('returns [] when there are no links', () => {
    expect(extractUrls('no links here')).toEqual([]);
  });
});

describe('delinkify', () => {
  it('replaces Slack link markup with readable text', () => {
    expect(delinkify('see <https://a.com|the spec> now')).toBe('see the spec now');
    expect(delinkify('go <https://b.com>')).toBe('go https://b.com');
  });
});

describe('isAllowedMime', () => {
  it('allows text/image/pdf/json, rejects others', () => {
    expect(isAllowedMime('text/plain')).toBe(true);
    expect(isAllowedMime('image/png')).toBe(true);
    expect(isAllowedMime('application/pdf')).toBe(true);
    expect(isAllowedMime('application/x-sh')).toBe(false);
    expect(isAllowedMime('application/octet-stream')).toBe(false);
  });
});

describe('normalizeIntake', () => {
  const base: IntakeEvent = {
    channel: 'C1',
    user: 'U9',
    ts: '1700000000.000100',
    text: '<@U123> fix the CSV bug see <https://rfc.com|spec>',
  };

  it('builds a bundle with mention stripped, links de-linkified, and urls extracted', () => {
    const b = normalizeIntake(base);
    expect(b.prompt).toBe('fix the CSV bug see spec');
    expect(b.urls).toEqual(['https://rfc.com']);
    expect(b.channel).toBe('C1');
    expect(b.user).toBe('U9');
    expect(b.ts).toBe('1700000000.000100');
  });

  it('hashes accepted attachments (SHA-256) for provenance', () => {
    const b = normalizeIntake({
      ...base,
      files: [{ name: 'note.txt', mimetype: 'text/plain', size: 5, content: 'hello' }],
    });
    expect(b.attachments).toHaveLength(1);
    expect(b.attachments[0].sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(b.rejected).toHaveLength(0);
  });

  it('rejects oversized and unsupported attachments with a clear reason', () => {
    const b = normalizeIntake({
      ...base,
      files: [
        { name: 'big.txt', mimetype: 'text/plain', size: MAX_ATTACHMENT_BYTES + 1 },
        { name: 'evil.sh', mimetype: 'application/x-sh', size: 10 },
      ],
    });
    expect(b.attachments).toHaveLength(0);
    expect(b.rejected.map((r) => r.name)).toEqual(['big.txt', 'evil.sh']);
    expect(b.rejected[0].reason).toMatch(/too large/);
    expect(b.rejected[1].reason).toMatch(/unsupported type/);
  });
});

describe('intakeAttachmentsAsUntrusted', () => {
  it('returns raw content for accepted files (wrapping happens in the planner)', () => {
    const out = intakeAttachmentsAsUntrusted({
      channel: 'C1',
      user: 'U9',
      ts: '1',
      text: 'x',
      files: [
        { name: 'a.txt', mimetype: 'text/plain', size: 1, content: 'A' },
        { name: 'skip.bin', mimetype: 'application/octet-stream', size: 1, content: 'B' },
      ],
    });
    expect(out).toEqual([{ label: 'a.txt', content: 'A' }]);
  });
});
