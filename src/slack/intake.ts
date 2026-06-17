import { createHash } from 'node:crypto';
import { type Attachment } from '../untrusted.js';

/**
 * Slack intake normalisation (US-039 groundwork / US-040).
 *
 * Turns a raw mention event into a consistent, hashed, audit-ready
 * `IntakeBundle`: mention text stripped, URLs extracted, attachments validated
 * + SHA-256 hashed, oversized/unsupported files rejected with a clear reason.
 * Attachment content is treated as untrusted (US-023) when handed to the agent.
 *
 * Pure and side-effect-free, so it is fully unit-testable without Slack.
 */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MiB
export const ALLOWED_MIME_PREFIXES = ['text/', 'image/png', 'image/jpeg', 'application/pdf', 'application/json'];

export interface IntakeFileInput {
  name: string;
  mimetype: string;
  size: number;
  content?: string;
}

export interface IntakeEvent {
  channel: string;
  user: string;
  text: string;
  ts: string;
  files?: IntakeFileInput[];
}

export interface IntakeAttachment {
  name: string;
  mimetype: string;
  size: number;
  sha256: string | null;
}

export interface IntakeRejection {
  name: string;
  reason: string;
}

export interface IntakeBundle {
  channel: string;
  user: string;
  ts: string;
  prompt: string;
  urls: string[];
  attachments: IntakeAttachment[];
  rejected: IntakeRejection[];
}

/** Remove a leading Slack mention (`<@U123>` / `<@U123|name>`) from the text. */
export function stripMention(text: string): string {
  return text.replace(/^\s*<@[UW][A-Z0-9]+(\|[^>]*)?>\s*/, '').trim();
}

/** Extract URLs, handling Slack's `<url>` / `<url|label>` wrapping and plain links. */
export function extractUrls(text: string): string[] {
  const urls: string[] = [];
  const slackLink = /<(https?:\/\/[^|>]+)(?:\|[^>]*)?>/g;
  let m: RegExpExecArray | null;
  while ((m = slackLink.exec(text)) !== null) urls.push(m[1]);
  // Plain links not already captured inside <…>.
  const stripped = text.replace(slackLink, ' ');
  const plain = stripped.match(/https?:\/\/[^\s<>|]+/g) ?? [];
  for (const u of plain) urls.push(u);
  return [...new Set(urls)];
}

export function isAllowedMime(mimetype: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mimetype.startsWith(p));
}

/** Replace Slack link markup with readable text: `<url|label>`→label, `<url>`→url. */
export function delinkify(text: string): string {
  return text
    .replace(/<(https?:\/\/[^|>]+)\|([^>]*)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

/** Normalise a raw mention event into an IntakeBundle. */
export function normalizeIntake(event: IntakeEvent): IntakeBundle {
  const attachments: IntakeAttachment[] = [];
  const rejected: IntakeRejection[] = [];

  for (const file of event.files ?? []) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      rejected.push({
        name: file.name,
        reason: `too large (${file.size} bytes > ${MAX_ATTACHMENT_BYTES} limit)`,
      });
      continue;
    }
    if (!isAllowedMime(file.mimetype)) {
      rejected.push({ name: file.name, reason: `unsupported type "${file.mimetype}"` });
      continue;
    }
    attachments.push({
      name: file.name,
      mimetype: file.mimetype,
      size: file.size,
      sha256: file.content !== undefined ? sha256(file.content) : null,
    });
  }

  return {
    channel: event.channel,
    user: event.user,
    ts: event.ts,
    prompt: delinkify(stripMention(event.text)),
    urls: extractUrls(event.text),
    attachments,
    rejected,
  };
}

/**
 * Accepted attachment contents as planner attachments (US-023): returns the
 * RAW content keyed by file name — `assemblePlannerPrompt` does the
 * <untrusted_input> wrapping, so we don't double-wrap here.
 */
export function intakeAttachmentsAsUntrusted(event: IntakeEvent): Attachment[] {
  return (event.files ?? [])
    .filter((f) => f.content !== undefined && f.size <= MAX_ATTACHMENT_BYTES && isAllowedMime(f.mimetype))
    .map((f) => ({ label: f.name, content: f.content as string }));
}
