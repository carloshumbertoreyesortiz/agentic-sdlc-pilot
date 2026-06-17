import process from 'node:process';
import bolt from '@slack/bolt';
import { buildIntakeBundle, type AppMentionEvent, type IntakeBundle } from '../src/slack/bot.js';

const { App } = bolt;

/**
 * Slack intake bot — read-only scaffold (US-039, impl guide §12.2).
 *
 * DORMANT BY DEFAULT: App.start() only runs when SLACK_ENABLED=true, so this
 * file compiles, lints, and is exercised by tests (via src/slack/*) without
 * ever attempting a Slack connection. Credentials and the app registration are
 * US-038 — not this story. No tokens are read or required to import this file.
 *
 *   SLACK_ENABLED=true npx tsx scripts/slack-bot.ts   # only after US-038
 */

/** Stub agent trigger — logs the bundle and returns a placeholder run id. */
export function triggerRun(bundle: IntakeBundle): string {
  const runId = `run-pending-${bundle.attachments.length}att`;
  console.log('[slack-bot] triggerRun (stub):', JSON.stringify(bundle));
  return runId;
}

// Construct + connect ONLY when explicitly enabled. Bolt validates tokens in
// its constructor, so building the App while dormant would throw — hence the
// whole App lifecycle lives inside this guard.
if (process.env.SLACK_ENABLED === 'true') {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  app.event('app_mention', async ({ event, say }) => {
    const bundle = buildIntakeBundle(event as unknown as AppMentionEvent);
    const runId = triggerRun(bundle);
    await say(`Plan in progress — run ${runId}. I'll DM you when it's ready for review.`);
  });

  await app.start();
  console.log('[slack-bot] started (Socket Mode).');
} else {
  console.log(
    '[slack-bot] dormant — set SLACK_ENABLED=true to connect. ' +
      'Live run requires the registered Slack app + credentials (US-038).',
  );
}
