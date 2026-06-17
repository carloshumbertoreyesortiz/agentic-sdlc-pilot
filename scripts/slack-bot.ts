import process from 'node:process';
import { normalizeIntake, type IntakeEvent } from '../src/slack/intake.js';

/**
 * Slack intake bot — read-only entry (US-039, impl guide §12).
 *
 * SCAFFOLD: the Bolt runtime wiring (Socket Mode listener, event subscription)
 * lands once the Slack app is registered and tokens exist (US-038). Until then
 * this entry validates configuration and demonstrates the read-only intake
 * path on a sample event using the tested normaliser (US-040). It never posts
 * to Slack — read-only by construction.
 *
 *   npx tsx scripts/slack-bot.ts
 */

const botToken = process.env.SLACK_BOT_TOKEN;
const appToken = process.env.SLACK_APP_TOKEN;

if (!botToken || !appToken) {
  process.stderr.write(
    [
      'Slack tokens not set — running the offline intake demo only.',
      'To run the live read-only listener (after US-038 registers the app):',
      '  export SLACK_BOT_TOKEN="xoxb-…"   # bot token, read-only scopes',
      '  export SLACK_APP_TOKEN="xapp-…"   # app-level token for Socket Mode',
      'Then this entry will subscribe to app_mention events (read-only).',
      '',
    ].join('\n'),
  );
}

// Demonstrate the normalisation path on a sample mention (no network).
const sample: IntakeEvent = {
  channel: 'C-DEMO',
  user: 'U-DEMO',
  ts: '1700000000.000100',
  text: '<@U0BOT> plan the CSV escaping fix, see <https://www.rfc-editor.org/rfc/rfc4180|RFC 4180>',
  files: [{ name: 'notes.txt', mimetype: 'text/plain', size: 11, content: 'escape "" ' }],
};

process.stdout.write(`${JSON.stringify(normalizeIntake(sample), null, 2)}\n`);
