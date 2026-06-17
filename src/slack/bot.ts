import { createHash } from 'node:crypto';
import { wrapUntrusted } from '../untrusted.js';

/**
 * Canonical intake contract (impl guide §12.2 / architecture §03) and the
 * helpers the Slack bot uses. Pure and SDK-free, so it builds with the rest of
 * src/ and is unit-testable without a Slack connection. The Bolt runtime that
 * calls these lives in scripts/slack-bot.ts (dormant until US-038).
 */

/** A Slack file as delivered on an app_mention event (subset we use). */
export interface SlackFile {
  mimetype: string;
  url_private: string;
  name?: string;
}

/** The app_mention event subset we read. */
export interface AppMentionEvent {
  text: string;
  files?: SlackFile[];
}

export interface IntakeAttachment {
  kind: 'image' | 'file';
  url: string;
  hash: string;
}

/** The §12.2 IntakeBundle handed to the agent — always trust:'untrusted'. */
export interface IntakeBundle {
  text: string;
  attachments: IntakeAttachment[];
  trust: 'untrusted';
}

export function sha256(input: string): string {
  return `sha256:${createHash('sha256').update(input).digest('hex')}`;
}

/**
 * Build the §12.2 IntakeBundle from an app_mention event: images vs files by
 * mimetype, each attachment referenced by url_private and hashed (US-040), the
 * whole bundle marked untrusted.
 */
export function buildIntakeBundle(event: AppMentionEvent): IntakeBundle {
  return {
    text: event.text,
    attachments: (event.files ?? []).map((f) => ({
      kind: f.mimetype.startsWith('image/') ? 'image' : 'file',
      url: f.url_private,
      hash: sha256(f.url_private),
    })),
    trust: 'untrusted',
  };
}

/**
 * Render the bundle as untrusted material for the agent, reusing the US-023
 * tagging (so the message text and every attachment reference are framed as
 * data, not instructions — never reinvented here).
 */
export function bundleToUntrusted(bundle: IntakeBundle): string {
  const parts = [wrapUntrusted('slack-message', bundle.text)];
  for (const a of bundle.attachments) {
    parts.push(wrapUntrusted(`attachment:${a.kind}`, `${a.url}\n${a.hash}`));
  }
  return parts.join('\n');
}
